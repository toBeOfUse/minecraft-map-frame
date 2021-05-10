<template>
    <div id="app" :class="zoomedIn ? 'appZoomedIn' : 'appZoomedOut'">
        <span v-if="!zoomedIn && outliningSubMaps">Click within an outlined area to Zoom</span>
        <div
            class="mapContainer"
            :class="pannable ? '' : 'mapContainerNonPannable'"
            :style="{
                width: edgeLength + 'px',
                height: edgeLength + 'px',
                ...(zoomedIn
                    ? {
                          left: zoomedInPos.left + 'px',
                          top: zoomedInPos.top + 'px',
                      }
                    : zoomedOutPos),
            }"
            @click="handleMouseClick"
            @mousemove="handleMouseMove"
            @touchmove="handleMouseMove"
            @mousedown="startPanning"
            @touchstart="startPanning"
            @mouseup="panning = false"
            @touchend="panning = false"
            @mouseenter="mouseOverMap = true"
            @mouseleave="mouseOverMap = false"
        >
            <img
                ref="map"
                id="map"
                :src="'maps/' + this.availableMaps.level3.find((m) => m.x === 0 && m.y === 0).file"
                :style="{ opacity: zoomedIn ? 0.3 : 1 }"
            />
            <img
                v-for="subMap in currentSubMaps"
                :key="subMap.file"
                :src="`maps/${subMap.file}`"
                class="subMap"
                :style="{
                    ...getSubMapPos(subMap),
                    width: '12.5%',
                    height: '12.5%',
                    visiblity: zoomedIn ? '' : 'hidden',
                    opacity: zoomedIn ? 1 : 0,
                }"
            />
            <transition name="fade">
                <sub-map-outlines
                    v-if="outliningSubMaps"
                    :subMapsPerMap="64"
                    :subMapBorderWidth="subMapBorderWidth"
                    :edgeLength="edgeLength"
                    :subMaps="currentSubMaps"
                />
            </transition>
            <div
                class="mapMarker"
                :style="{ left: location.x + '%', top: location.y + '%' }"
                v-for="(location, i) in currentPointsOfInterest"
                :key="location.text"
            >
                <div class="glowything"></div>
                <img src="marker.png" style="height: 100%; width: 100%" class="markerImage" />
                <span class="caption" :style="captionPos.length && captionPos[i]" ref="caption">
                    {{ location.text }}
                </span>
            </div>
        </div>
        <span v-if="mouseOverMap && !deployed" id="cornerDisplay">
            {{ mouseX.toFixed(2) + ", " + mouseY.toFixed(2) }}
        </span>
        <img
            :style="{
                right: '50px',
                top: '50px',
            }"
            :src="zoomedIn ? 'zoomout.svg' : 'zoom.svg'"
            id="zoomButton"
            @click="
                if (!zoomedIn) {
                    outliningSubMaps = true;
                } else {
                    zoomedIn = false;
                    outliningSubMaps = false;
                    pannable = false;
                }
            "
        />
    </div>
</template>

<script>
import { vueWindowSizeMixin } from "vue-window-size";
import availableMaps from "./mapdata/processed_maps.json";
import pointsOfInterest from "./mapdata/points_of_interest.json";
import SubMapOutlines from "./SubMapOutlines.vue";

export default {
    name: "App",
    components: { SubMapOutlines },
    data: () => ({
        availableMaps,
        pointsOfInterest,
        mouseOverMap: false,
        deployed: window.location.protocol == "https:",
        mouseX: 0,
        mouseY: 0,
        captionPos: [],
        zoomedIn: false,
        zoomedInPos: [-1, -1],
        outliningSubMaps: false,
        pannable: false,
        panning: false,
        lastPanningX: -1,
        lastPanningY: -1
    }),
    mounted() {
        // this.positionCaptions();
        if (history.scrollRestoration) {
            history.scrollRestoration = "manual";
        }
    },
    methods: {
        handleMouseMove(event) {
            const mapBounds = this.$refs.map.getBoundingClientRect();
            this.mouseX = ((event.pageX - mapBounds.left) / mapBounds.width) * 100;
            this.mouseY = ((event.pageY - mapBounds.top) / mapBounds.height) * 100;

            if (this.zoomedIn && this.panning) {
                if (event.touches && event.touches.length > 1) {
                    return;
                }
                event.preventDefault();
                const newX = event.type.startsWith("mouse") ? event.pageX : event.touches[0]?.pageX;
                const newY = event.type.startsWith("mouse") ? event.pageY : event.touches[0]?.pageY;

                const bounds = this.currentPanningBounds;

                this.zoomedInPos.left += newX - this.lastPanningX;
                this.zoomedInPos.left = Math.max(
                    Math.min(bounds.upperXBound, this.zoomedInPos.left),
                    bounds.lowerXBound
                );

                this.zoomedInPos.top += newY - this.lastPanningY;
                this.zoomedInPos.top = Math.max(
                    Math.min(bounds.upperYBound, this.zoomedInPos.top),
                    bounds.lowerYBound
                );

                this.lastPanningX = newX;
                this.lastPanningY = newY;
            }
        },
        startPanning(event) {
            if (this.zoomedIn) {
                if (event.touches && event.touches.length > 1) {
                    return;
                }
                this.panning = true;
                this.lastPanningX = event.type.startsWith("mouse")
                    ? event.pageX
                    : event.touches[0]?.pageX;
                this.lastPanningY = event.type.startsWith("mouse")
                    ? event.pageY
                    : event.touches[0]?.pageY;
            }
        },
        handleMouseClick() {
            if (!this.deployed && navigator.clipboard) {
                const coords = JSON.stringify(
                    {
                        x: Number(this.mouseX.toFixed(2)),
                        y: Number(this.mouseY.toFixed(2)),
                        text: ""
                    },
                    null,
                    4
                );
                navigator.clipboard.writeText(coords);
            }
            if (this.outliningSubMaps && !this.zoomedIn) {
                const [xPos, yPos] = [this.mouseX, this.mouseY].map(c => Math.floor(c / (100 / 8)));
                if (this.subMapExistsAt(xPos, yPos)) {
                    this.zoomedIn = true;
                    this.zoomedInPos = this.getZoomedInPos([xPos, yPos]);
                    setTimeout(() => (this.pannable = true), 1000);
                }
            }
        },
        positionCaptions() {
            // todo: re-examine the neccessity of this (it is not currently being
            // called)
            if (this.captionPos.length) {
                return;
            }
            const newCaptionPos = [];
            for (let i = 0; i < this.$refs.caption.length; i++) {
                const caption = this.$refs.caption[i];
                const rect = caption.getBoundingClientRect();
                if (rect.x < 0) {
                    newCaptionPos.push({
                        position: "fixed",
                        left: "5px",
                        top: rect.top + "px",
                        transform: "unset"
                    });
                } else if (rect.right > window.innerWidth) {
                    newCaptionPos.push({
                        position: "fixed",
                        right: "5px",
                        top: rect.top + "px",
                        left: "unset",
                        transform: "unset"
                    });
                } else {
                    newCaptionPos.push({});
                }
            }
            this.captionPos = newCaptionPos;
        },
        subMapExistsAt(x, y) {
            return this.currentSubMaps.some(m => m.x === x && m.y === y);
        },
        getZoomedInPos(subMapCoords) {
            // takes an [x, y] array specifying a level 0 submap. returns the pixel
            // values for the left and top css properties that, when given to the
            // main map, will center that submap.
            if (this.zoomedIn) {
                return {
                    left:
                        -this.subMapEdgeLength * subMapCoords[0] +
                        (this.windowWidth - this.subMapEdgeLength) / 2,
                    top:
                        -this.subMapEdgeLength * subMapCoords[1] +
                        (this.windowHeight - this.subMapEdgeLength) / 2
                };
            } else {
                return {};
            }
        },
        getSubMapPos(map) {
            let [left, top] = [map.x * 12.5 + "%", map.y * 12.5 + "%"];
            return { left, top };
        },
        subMapHasAdjacent(x, y, dx, dy) {
            const [checkX, checkY] = [x + dx, y + dy];
            return this.subMapExistsAt(checkX, checkY);
        }
    },
    computed: {
        edgeLength() {
            if (this.windowHeight > this.windowWidth) {
                return 0.95 * this.windowWidth * (this.zoomedIn ? 7 : 1);
            } else {
                return 0.9 * this.windowHeight * (this.zoomedIn ? 7 : 1);
            }
        },
        subMapEdgeLength() {
            return this.edgeLength / 8;
        },
        subMapBorderWidth() {
            return 3;
        },
        currentPointsOfInterest() {
            // TODO: filter points of interest by proximity to zoomed-in area?
            if (this.pannable) {
                return pointsOfInterest.level3.concat(pointsOfInterest.level0);
            } else {
                return pointsOfInterest.level3;
            }
        },
        currentlyFocusedMap() {
            const x = Math.floor(
                (this.windowWidth / 2 - this.zoomedInPos.left) / this.subMapEdgeLength
            );
            const y = Math.floor(
                (this.windowHeight / 2 - this.zoomedInPos.top) / this.subMapEdgeLength
            );
            return [x, y];
        },
        currentPanningBounds() {
            const focused = this.currentlyFocusedMap;
            let lowerXBound;
            if (this.subMapHasAdjacent(...focused, 1, 0)) {
                lowerXBound = -Infinity;
            } else if (
                this.subMapHasAdjacent(...focused, 0, 1) &&
                this.subMapHasAdjacent(...focused, 1, 1)
            ) {
                lowerXBound = -Infinity;
            } else {
                lowerXBound = this.getZoomedInPos(focused).left;
            }
            const upperXBound = this.subMapHasAdjacent(...focused, -1, 0)
                ? Infinity
                : this.getZoomedInPos(focused).left;
            const lowerYBound = this.subMapHasAdjacent(...focused, 0, 1)
                ? -Infinity
                : this.getZoomedInPos(focused).top;
            const upperYBound = this.subMapHasAdjacent(...focused, 0, -1)
                ? Infinity
                : this.getZoomedInPos(focused).top;
            return { lowerXBound, upperXBound, lowerYBound, upperYBound };
        },
        zoomedOutPos() {
            return {
                left: (this.windowWidth - this.edgeLength) / 2 + "px",
                top: (this.windowHeight - this.edgeLength) / 2 + "px"
            };
        },
        currentSubMaps() {
            return this.availableMaps.level0.filter(
                // temporary until we are rendering multiple level 3 maps
                m => m.x >= 0 && m.x < 8 && m.y >= 0 && m.y < 8
            );
        }
    },
    mixins: [vueWindowSizeMixin]
};
</script>

<style>
@font-face {
    font-family: "andada";
    src: url("/andada-regular-webfont.woff2") format("woff2"),
        url("/andada-regular-webfont.woff") format("woff");
    font-weight: normal;
    font-style: normal;
}

html,
body {
    margin: 0;
    height: auto;
    width: 100%;
    height: 100%;
}
#app {
    overflow: hidden;
    width: 100%;
    height: 100%;
    position: relative;
    text-align: center;
    font-family: "andada", serif;
}
.appZoomedOut {
    height: 100%;
    position: absolute;
    width: 100%;
}
.mapContainer {
    position: absolute;
}
.mapContainerNonPannable {
    transition-duration: 1s;
    transition-property: width, height, left, top;
}
#map {
    width: 100%;
    height: 100%;
    transition-duration: 2.5s;
    transition-property: opacity;
    transition-timing-function: linear;
}
#cornerDisplay {
    position: fixed;
    left: 5px;
    bottom: 5px;
}
#zoomButton {
    width: 30px;
    height: 30px;
    position: fixed;
}
.subMap {
    position: absolute;
    transition-duration: 1s;
    transition-property: width, height, left, top, visibility, opacity;

    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Old versions of Firefox */
    -ms-user-select: none; /* Internet Explorer/Edge */
    user-select: none; /* Non-prefixed version, currently
                            supported by Chrome, Edge, Opera and Firefox */
}
.mapMarker {
    position: absolute;
    height: 25px;
    width: 25px;
    transition: opacity 100ms, width 1s, height 1s;
    z-index: 8;
}
.appZoomedIn .mapMarker {
    height: 40px;
    width: 40px;
}
.mapMarker:hover {
    opacity: 1;
    z-index: 10;
}
.markerImage {
    transform: translate(-50%, -50%);
}
.caption {
    opacity: 0;
    position: absolute;
    color: #ddd;
    background-color: #00000099;
    padding: 5px;
    border-radius: 6px;
    transition: opacity 100ms;
    /* position sometimes overriden by javascript */
    left: 0;
    top: -50%;
    transform: translate(-50%, -105%);
    max-width: 125px;
    width: max-content;
    text-align: center;
    pointer-events: none;
}
.mapMarker:hover .caption {
    opacity: 1;
}
.glowything {
    border-radius: 50%;
    opacity: 0;
    background-color: #00c100;
    filter: blur(10px);
    width: 35px;
    height: 35px;
    position: absolute;
    left: 0;
    top: 0;
    transform: translate(-50%, -50%);
}
.mapMarker:hover .glowything {
    opacity: 0.6;
}
.fade-enter-active,
.fade-leave-active {
    transition: opacity 1s;
}
.fade-enter,
.fade-leave-to {
    opacity: 0;
}
</style>
