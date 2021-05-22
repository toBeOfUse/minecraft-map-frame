<template>
    <div id="app" :class="zoomLevel == 0 ? 'appZoomedIn' : ''">
        <span v-if="zoomLevel !== 0 && outliningSubMaps"
            >Click within an outlined area to Zoom</span
        >
        <div
            ref="map"
            class="mapContainer"
            :class="isMidZoom && 'transitiony'"
            :style="{
                ...collage.fullMapDimensions.toCSS(),
                ...fullMapPos.toCSS(),
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
                v-for="map in collage.maps.level3"
                :key="map.file"
                :src="'maps/' + map.file"
                :style="{
                    opacity: getLevel3MapOpacity(map),
                    width: edgeLength + 'px',
                    height: edgeLength + 'px',
                    ...collage.getPosWithinCollage(map).toCSS(),
                }"
                class="subMap"
            />
            <img
                v-for="subMap in collage.maps.level0"
                :key="subMap.file"
                :src="`maps/${subMap.file}`"
                class="subMap"
                :style="{
                    ...collage.getPosWithinCollage(subMap).toCSS(),
                    width: subMapEdgeLength + 'px',
                    height: subMapEdgeLength + 'px',
                    visiblity: zoomLevel == 0 ? '' : 'hidden',
                    opacity: zoomLevel == 0 ? 1 : 0,
                }"
            />
            <sub-map-outlines
                :zoomLevel="0"
                :subMapBorderWidth="subMapBorderWidth"
                :collage="collage"
                :style="{
                    visiblity: outliningSubMaps ? '' : 'hidden',
                    opacity: outliningSubMaps ? 1 : 0,
                    ...getOutlinePos(0),
                }"
            />
            <!--
            <sub-map-outlines
                :zoomLevel="3"
                :subMapBorderWidth="fullMapBorderWidth"
                :collage="collage"
                :style="getOutlinePos(3)"
            />
            -->
            <div
                class="mapMarker"
                :style="collage.getPosWithinCollage(location).toCSS()"
                v-for="(location, i) in currentPointsOfInterest"
                :key="location.x + ',' + location.y"
            >
                <img src="marker.png" style="height: 100%; width: 100%" class="markerImage" />
                <span class="caption" :style="captionPos.length && captionPos[i]">
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
            :src="zoomLevel == 0 ? 'zoomout.svg' : 'zoom.svg'"
            id="zoomButton"
            @click="magnifyingGlassClick"
        />
    </div>
</template>

<script>
import { vueWindowSizeMixin } from "vue-window-size";
import availableMaps from "./mapdata/processed_maps.json";
import pointsOfInterest from "./mapdata/points_of_interest.json";
import SubMapOutlines from "./SubMapOutlines.vue";
import MapCollage from "./MapCollage.ts";
import { Position, Dimensions } from "./Types.ts";

export default {
    name: "App",
    components: { SubMapOutlines },
    data: () => ({
        collage: null,
        mouseOverMap: false,
        deployed: window.location.protocol == "https:",
        mouseX: 0,
        mouseY: 0,
        captionPos: [],
        zoomLevel: 3, // currently can be only either 0 or 3
        isMidZoom: false,
        fullMapPos: new Position(NaN, NaN), // properly set in "created" hook
        outliningSubMaps: false,
        panning: false,
        lastPanningX: -1,
        lastPanningY: -1,
        lastZoomedInOnSubMap: [NaN, NaN]
    }),
    created() {
        this.collage = new MapCollage(availableMaps, pointsOfInterest, {
            mapLevel: 3,
            edgeLengthPx: this.edgeLength
        });
        this.fullMapPos = this.collage.getPosCenteredOn(
            { x: 0, y: 0 },
            3,
            new Dimensions(this.windowWidth, this.windowHeight)
        );
    },
    mounted() {
        // this.positionCaptions();
        if (history.scrollRestoration) {
            history.scrollRestoration = "manual";
        }
    },
    methods: {
        handleMouseMove(event) {
            // interface logic
            if (!this.deployed) {
                const eventPos = this.collage.getCoordsWithinCollageFromViewportPos(
                    new Position(event.clientX, event.clientY),
                    this.fullMapPos
                );
                this.mouseX = eventPos.x;
                this.mouseY = eventPos.y;
            }

            if (this.panning) {
                if (event.touches && event.touches.length > 1) {
                    return;
                }
                event.preventDefault();
                const newX = event.type.startsWith("mouse") ? event.pageX : event.touches[0]?.pageX;
                const newY = event.type.startsWith("mouse") ? event.pageY : event.touches[0]?.pageY;

                const bounds = this.currentPanningBounds;

                this.fullMapPos._left += newX - this.lastPanningX;
                this.fullMapPos._left = Math.max(
                    Math.min(bounds.upperXBound, this.fullMapPos._left),
                    bounds.lowerXBound
                );

                this.fullMapPos._top += newY - this.lastPanningY;
                this.fullMapPos._top = Math.max(
                    Math.min(bounds.upperYBound, this.fullMapPos._top),
                    bounds.lowerYBound
                );

                this.lastPanningX = newX;
                this.lastPanningY = newY;
            }
        },
        startPanning(event) {
            // interface logic
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
        },
        handleMouseClick(event) {
            // interface logic
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
            if (this.outliningSubMaps && this.zoomLevel !== 0) {
                const clickedMap = this.collage.getMapFromViewportPos(
                    new Position(event.clientX, event.clientY),
                    this.fullMapPos,
                    0
                );
                if (clickedMap) {
                    const { x, y } = clickedMap;
                    console.log("map at this position was clicked", x, y);
                    this.lastZoomedInOnSubMap = [x, y];
                    this.isMidZoom = true;
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            this.zoomLevel = 0;
                            this.fullMapPos = this.collage.getPosCenteredOn({ x, y }, 0, {
                                height: this.windowHeight,
                                width: this.windowWidth
                            });
                            this.$refs.map.addEventListener("transitionend", event => {
                                if (event.target === event.currentTarget) {
                                    this.isMidZoom = false;
                                }
                            });
                        });
                    });
                } else {
                    console.log("area with no submap was clicked");
                }
            }
        },
        magnifyingGlassClick() {
            // interface logic
            if (this.zoomLevel !== 0) {
                this.outliningSubMaps = true;
            } else {
                this.isMidZoom = true;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.zoomLevel = 3;
                        this.outliningSubMaps = false;
                        this.fullMapPos = this.collage.getPosCenteredOn(
                            { x: 0, y: 0 },
                            3,
                            new Dimensions(this.windowWidth, this.windowHeight)
                        );
                        this.$refs.map.addEventListener("transitionend", event => {
                            if (event.target === event.currentTarget) {
                                this.isMidZoom = false;
                            }
                        });
                    });
                });
            }
        },
        positionCaptions() {
            // interface logic
            // todo: re-tool this to work with a panning map, somehow (it isn't
            // currently being called)
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
        getLevel3MapOpacity(map) {
            // interface logic
            return this.zoomLevel == 0
                ? 0.3
                : map.x == this.currentlyCenteredMap.x && map.y == this.currentlyCenteredMap.y
                ? 1
                : 0.7;
        },
        getOutlinePos(zoomLevel) {
            const borderWidth = zoomLevel == 3 ? this.fullMapBorderWidth : this.subMapBorderWidth;
            return {
                position: "absolute",
                left: -borderWidth + "px",
                top: -borderWidth + "px",
                width: "calc(100% + " + borderWidth * 2 + "px)",
                height: "calc(100% + " + borderWidth * 2 + "px)"
            };
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
            // this is the width of the sub-map borders at the initial zoom level in
            // pixels (it automatically becomes wider when we zoom in via the scaling
            // of the svg outline overlay via css)
            return 3;
        },
        fullMapBorderWidth() {
            return this.subMapBorderWidth * 5; // shrug emoji
        },
        currentPointsOfInterest() {
            // interface logic
            if (this.isMidZoom) {
                return this.collage.pois.level3.concat(this.collage.pois.level0);
            } else if (this.zoomLevel == 0 && !this.isMidZoom) {
                return this.collage.pois.level3.concat(this.collage.pois.level0);
            } else {
                return this.collage.pois.level3.filter(
                    p =>
                        p.x > this.currentlyCenteredMap.x &&
                        p.x < this.currentlyCenteredMap.x + 1024 &&
                        p.y > this.currentlyCenteredMap.y &&
                        p.y < this.currentlyCenteredMap.y + 1024
                );
            }
        },
        currentlyCenteredMap() {
            // interface logic
            const result = this.collage.getMapFromViewportPos(
                new Position(this.windowWidth / 2, this.windowHeight / 2),
                this.fullMapPos,
                3
            );
            if (!result) {
                console.error("could not find a map at the center of the viewport");
            }
            return result;
        },
        currentPanningBounds() {
            // interface logic
            return {
                lowerXBound: -Infinity,
                upperXBound: Infinity,
                lowerYBound: -Infinity,
                upperYBound: Infinity
            };
        },
        currentSubMapIsland() {
            // TODO: put in code to get this info from this.collage
            return undefined;
        }
    },
    watch: {
        edgeLength(_oldValue, newValue) {
            this.collage.resize({ mapLevel: 3, edgeLengthPx: newValue });
        }
    },
    mixins: [vueWindowSizeMixin]
};
</script>

<style lang="scss">
@font-face {
    font-family: "andada";
    src: url("/andada-regular-webfont.woff2") format("woff2"),
        url("/andada-regular-webfont.woff") format("woff");
    font-weight: normal;
    font-style: normal;
}

@mixin standard-transitions {
    transition-duration: 1s;
    transition-property: width, height, left, top, opacity, visibility;
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
.mapContainer {
    position: absolute;
}
.transitiony {
    @include standard-transitions;
}
.subMapOutlineOverlay {
    @include standard-transitions;
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
    user-select: none;
    @include standard-transitions;
}
.mapMarker {
    position: absolute;
    height: 25px;
    width: 25px;
    z-index: 8;
    @include standard-transitions;
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
.mapMarker:hover::after {
    border-radius: 50%;
    opacity: 0.6;
    background-color: #1be91b;
    filter: blur(10px);
    width: 35px;
    height: 35px;
    position: absolute;
    left: 0;
    top: 0;
    transform: translate(-50%, -50%);
    mix-blend-mode: screen;
    content: "";
}
</style>
