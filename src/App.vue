<template>
    <div id="app" class="appZoomedIn">
        <span v-if="zoomLevel !== 0 && outliningSubMaps"
            >Click within an outlined area to Zoom</span
        >
        <div
            ref="map"
            class="mapContainer"
            :class="pannable ? '' : 'mapContainerNonPannable'"
            :style="{
                ...fullMapDimensions,
                ...fullMapPosPx,
            }"
            @click="handleMouseClick"
            @mousemove="handleMouseMove"
            @touchmove="handleMouseMove"
            @mousedown="startPanning"
            @touchstart="startPanning"
            @mouseup="panning = false"
            @touchend="panning = false"
            @touchcancel="panning = false"
            @mouseenter="mouseOverMap = true"
            @mouseleave="
                mouseOverMap = false;
                panning = false;
            "
        >
            <img
                v-for="map in availableMaps.level3"
                :key="map.file"
                :src="'maps/' + map.file"
                :style="{
                    opacity: zoomLevel == 0 ? 0.3 : 1,
                    width: edgeLength + 'px',
                    height: edgeLength + 'px',
                    ...getMapPosPx(map, 3),
                }"
                class="subMap"
            />
            <img
                v-for="subMap in this.availableMaps.level0"
                :key="subMap.file"
                :src="`maps/${subMap.file}`"
                class="subMap"
                :style="{
                    ...getMapPosPx(subMap, 0),
                    width: subMapEdgeLength + 'px',
                    height: subMapEdgeLength + 'px',
                    visiblity: true || zoomLevel == 0 ? '' : 'hidden',
                    opacity: true || zoomLevel == 0 ? 1 : 0,
                }"
            />
            <transition name="fade">
                <sub-map-outlines
                    v-if="outliningSubMaps"
                    :subMapsPerMap="64"
                    :subMapBorderWidth="subMapBorderWidth"
                    :edgeLength="edgeLength"
                    :subMaps="this.availableMaps.level0"
                />
            </transition>
            <template v-if="false">
                <div
                    class="mapMarker"
                    :style="{ left: location.x + '%', top: location.y + '%' }"
                    v-for="(location, i) in currentPointsOfInterest"
                    :key="location.x + ',' + location.y"
                >
                    <div class="glowything"></div>
                    <img src="marker.png" style="height: 100%; width: 100%" class="markerImage" />
                    <span class="caption" :style="captionPos.length && captionPos[i]" ref="caption">
                        {{ location.text }}
                    </span>
                </div>
            </template>
        </div>
        <span v-if="mouseOverMap && !deployed" id="cornerDisplay">
            {{ mouseX.toFixed(2) + ", " + mouseY.toFixed(2) }}
        </span>
        <img
            :style="{
                right: '50px',
                top: '50px',
            }"
            :src="zoomLevel == 0 ? 'zoomout.svg' : 'zoom.svg'"
            id="zoomButton"
            @click="
                if (zoomLevel !== 0) {
                    outliningSubMaps = true;
                } else {
                    zoomLevel = 3;
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
        zoomLevel: 3,
        fullMapPos: { left: 0, top: 0 },
        outliningSubMaps: false,
        pannable: true,
        panning: false,
        lastPanningX: -1,
        lastPanningY: -1
    }),
    mounted() {
        // this.positionCaptions();
        if (history.scrollRestoration) {
            history.scrollRestoration = "manual";
        }
        this.fullMapPos = this.getPosCenteredOn([0, 0]);

        const minX = Math.min(...this.availableMaps.level3.map(m => m.x));
        const minY = Math.min(...this.availableMaps.level3.map(m => m.y));

        console.log("rightmost level 3 map is at", minX);
        console.log("uppermost level 3 map is at", minY);
        console.log("our map dimensions are", this.fullMapDimensions);
        console.log("positioning our map at", this.fullMapPos);
        console.log(
            "we're trying to center the level 3 map at 0,0, which has the position within the full map of",
            this.getMapPosPx(this.centerMap, 3)
        );
    },
    methods: {
        handleMouseMove(event) {
            const mapBounds = this.$refs.map.getBoundingClientRect();
            this.mouseX = ((event.pageX - mapBounds.left) / mapBounds.width) * 100;
            this.mouseY = ((event.pageY - mapBounds.top) / mapBounds.height) * 100;

            if (this.panning) {
                if (event.touches && event.touches.length > 1) {
                    return;
                }
                event.preventDefault();
                const newX = event.type.startsWith("mouse") ? event.pageX : event.touches[0]?.pageX;
                const newY = event.type.startsWith("mouse") ? event.pageY : event.touches[0]?.pageY;

                const bounds = this.currentPanningBounds;

                this.fullMapPos.left += newX - this.lastPanningX;
                this.fullMapPos.left = Math.max(
                    Math.min(bounds.upperXBound, this.fullMapPos.left),
                    bounds.lowerXBound
                );

                this.fullMapPos.top += newY - this.lastPanningY;
                this.fullMapPos.top = Math.max(
                    Math.min(bounds.upperYBound, this.fullMapPos.top),
                    bounds.lowerYBound
                );

                this.lastPanningX = newX;
                this.lastPanningY = newY;
            }
        },
        startPanning(event) {
            if (this.pannable) {
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
            if (this.outliningSubMaps && !this.zoomLevel == 0) {
                const [xPos, yPos] = [this.mouseX, this.mouseY].map(c => Math.floor(c / (100 / 8)));
                if (this.mapExistsAt(xPos, yPos, 0)) {
                    this.zoomLevel = 0;
                    this.fullMapPos = this.getPosCenteredOn([xPos, yPos], 0);
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
        getPosCenteredOn(mapCoords, level = this.zoomLevel) {
            // takes an [x, y] array specifying a map. returns the pixel
            // values for the left and top css properties that, when given to the
            // full map, will center that map.
            const { x, y } = this.getMapPos({ x: mapCoords[0], y: mapCoords[1] }, level);
            const relevantEdgeLength = level == 0 ? this.subMapEdgeLength : this.edgeLength;
            return {
                left: -x + (this.windowWidth - relevantEdgeLength) / 2,
                top: -y + (this.windowHeight - relevantEdgeLength) / 2
            };
        },
        getMapPos(map, level) {
            const relevantEdgeLength = level == 0 ? this.subMapEdgeLength : this.edgeLength;

            const x = (map.x - this.lowestMapCoords.x * (level == 0 ? 8 : 1)) * relevantEdgeLength;
            const y = (map.y - this.lowestMapCoords.y * (level == 0 ? 8 : 1)) * relevantEdgeLength;

            return { x, y };
        },
        getMapPosPx(map, level) {
            const pos = this.getMapPos(map, level);
            return { left: pos.x + "px", top: pos.y + "px" };
        },
        mapExistsAt(x, y, level) {
            return this.availableMaps["level" + level].some(m => m.x === x && m.y === y);
        },
        relativeCoordsMapExistsAt(x, y, dx, dy, level = this.zoomLevel) {
            const [checkX, checkY] = [x + dx, y + dy];
            return this.mapExistsAt(checkX, checkY, level);
        }
    },
    computed: {
        edgeLength() {
            if (this.windowHeight > this.windowWidth) {
                return 0.95 * this.windowWidth * (this.zoomLevel == 0 ? 8 : 1);
            } else {
                return 0.9 * this.windowHeight * (this.zoomLevel == 0 ? 8 : 1);
            }
        },
        subMapEdgeLength() {
            return this.edgeLength / 8;
        },
        subMapBorderWidth() {
            return 3;
        },
        centerMap() {
            return this.availableMaps.level3.find(m => m.x === 0 && m.y === 0);
        },
        fullMapDimensions() {
            const exes = this.availableMaps.level3.map(m => m.x);
            const whys = this.availableMaps.level3.map(m => m.y);
            return {
                width: (Math.max(...exes) + 1 - Math.min(...exes)) * this.edgeLength + "px",
                height: (Math.max(...whys) + 1 - Math.min(...whys)) * this.edgeLength + "px"
            };
        },
        currentPointsOfInterest() {
            // TODO: filter points of interest by proximity to zoomed-in area?
            if (this.pannable) {
                return pointsOfInterest.level3.concat(pointsOfInterest.level0);
            } else {
                return pointsOfInterest.level3;
            }
        },
        lowestMapCoords() {
            // always for the level 3 maps
            let minX = Math.min(...this.availableMaps.level3.map(m => m.x));
            let minY = Math.min(...this.availableMaps.level3.map(m => m.y));
            return { x: minX, y: minY };
        },
        scaledLowestMapCoords() {
            return {
                x: this.lowestMapCoords.x * (this.zoomLevel == 0 ? 8 : 1),
                y: this.lowestMapCoords.y * (this.zoomLevel == 0 ? 8 : 1)
            };
        },
        currentlyCenteredMap() {
            const relevantEdgeLength =
                this.zoomLevel == 0 ? this.subMapEdgeLength : this.edgeLength;
            const x = Math.floor(
                (-this.fullMapPos.left + this.windowWidth / 2) / relevantEdgeLength
            );
            const y = Math.floor(
                (-this.fullMapPos.top + this.windowHeight / 2) / relevantEdgeLength
            );
            return [x + this.scaledLowestMapCoords.x, y + this.scaledLowestMapCoords.y];
        },
        currentPanningBounds() {
            const focused = this.currentlyCenteredMap;
            let lowerXBound;
            if (this.relativeCoordsMapExistsAt(...focused, 1, 0)) {
                lowerXBound = -Infinity;
            } else {
                lowerXBound = this.getPosCenteredOn(focused).left;
            }
            const upperXBound = this.relativeCoordsMapExistsAt(...focused, -1, 0)
                ? Infinity
                : this.getPosCenteredOn(focused).left;
            const lowerYBound = this.relativeCoordsMapExistsAt(...focused, 0, 1)
                ? -Infinity
                : this.getPosCenteredOn(focused).top;
            const upperYBound = this.relativeCoordsMapExistsAt(...focused, 0, -1)
                ? Infinity
                : this.getPosCenteredOn(focused).top;
            return { lowerXBound, upperXBound, lowerYBound, upperYBound };
        },
        currentSubMaps() {
            return this.availableMaps.level0.filter(
                // temporary until we are rendering multiple level 3 maps
                m => m.x >= 0 && m.x < 8 && m.y >= 0 && m.y < 8
            );
        },
        fullMapPosPx() {
            return { left: this.fullMapPos.left + "px", top: this.fullMapPos.top + "px" };
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
#cornerDisplay {
    position: fixed;
    left: 5px;
    bottom: 5px;
}
#zoomButton {
    width: 30px;
    height: 30px;
    position: fixed;
    z-index: 12;
}
.subMap {
    position: absolute;
    transition-duration: 1s;
    transition-property: width, height, left, top, visibility, opacity;
    user-select: none;
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
