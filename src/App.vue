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
                    opacity: getLevel3MapOpacity(map),
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
                    visiblity: zoomLevel == 0 ? '' : 'hidden',
                    opacity: zoomLevel == 0 ? 1 : 0,
                }"
            />
            <sub-map-outlines
                :zoomLevel="0"
                :subMapBorderWidth="subMapBorderWidth"
                :subMaps="this.availableMaps.level0"
                :style="{
                    visiblity: outliningSubMaps ? '' : 'hidden',
                    opacity: outliningSubMaps ? 1 : 0,
                    position: 'absolute',
                    left: -subMapBorderWidthPx + 'px',
                    top: -subMapBorderWidthPx + 'px',
                    width: 'calc(100% + ' + subMapBorderWidthPx * 2 + 'px)',
                    height: 'calc(100% + ' + subMapBorderWidthPx * 2 + 'px)',
                }"
            />
            <sub-map-outlines
                :zoomLevel="3"
                :subMapBorderWidth="subMapBorderWidth * 5"
                :subMaps="this.availableMaps.level3"
                :style="{
                    position: 'absolute',
                    left: -subMapBorderWidthPx * 5 + 'px',
                    top: -subMapBorderWidthPx * 5 + 'px',
                    width: 'calc(100% + ' + subMapBorderWidthPx * 5 * 2 + 'px)',
                    height: 'calc(100% + ' + subMapBorderWidthPx * 5 * 2 + 'px)',
                }"
            />
            <div
                class="mapMarker"
                :style="getMarkerPos(location)"
                v-for="(location, i) in currentPointsOfInterest"
                :key="location.x + ',' + location.y"
            >
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
            :src="zoomLevel == 0 ? 'zoomout.svg' : 'zoom.svg'"
            id="zoomButton"
            @click="toggleZoomLevel"
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
        isMidZoom: false,
        fullMapPos: { left: 0, top: 0 },
        outliningSubMaps: false,
        pannable: true,
        panning: false,
        lastPanningX: -1,
        lastPanningY: -1,
        lastZoomedInOnSubMap: [NaN, NaN]
    }),
    mounted() {
        // this.positionCaptions();
        if (history.scrollRestoration) {
            history.scrollRestoration = "manual";
        }
        this.fullMapPos = this.getPosCenteredOn([0, 0]);

        const minX = Math.min(...this.availableMaps.level3.map(m => m.x));
        const minY = Math.min(...this.availableMaps.level3.map(m => m.y));

        console.log("lefttmost level 3 map is at", minX);
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
            if (!this.deployed) {
                const eventPos = this.getMapPositionAtViewportPos(event.clientX, event.clientY, 3);
                this.mouseX = eventPos[0] * 128;
                this.mouseY = eventPos[1] * 128;
            }

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
        handleMouseClick(event) {
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
                const [x, y] = this.getMapAtViewportPos(event.clientX, event.clientY, 0);
                console.log("map at this position was clicked", x, y);
                if (this.mapExistsAt(x, y, 0)) {
                    this.lastZoomedInOnSubMap = [x, y];
                    this.isMidZoom = true;
                    requestAnimationFrame(() => {
                        this.zoomLevel = 0;
                        this.fullMapPos = this.getPosCenteredOn([x, y], 0);
                        this.$refs.map.addEventListener("transitionend", event => {
                            if (event.target === event.currentTarget) {
                                this.isMidZoom = false;
                            }
                        });
                    });
                }
            }
        },
        toggleZoomLevel() {
            if (this.zoomLevel !== 0) {
                this.outliningSubMaps = true;
            } else {
                this.isMidZoom = true;
                requestAnimationFrame(() => {
                    this.zoomLevel = 3;
                    this.outliningSubMaps = false;
                    this.fullMapPos = this.getPosCenteredOn([0, 0]);
                    this.$refs.map.addEventListener("transitionend", event => {
                        if (event.target === event.currentTarget) {
                            this.isMidZoom = false;
                        }
                    });
                });
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
            const { x, y } = this.getMapPos(mapCoords, level);
            const relevantEdgeLength = level == 0 ? this.subMapEdgeLength : this.edgeLength;
            return {
                left: -x + (this.windowWidth - relevantEdgeLength) / 2,
                top: -y + (this.windowHeight - relevantEdgeLength) / 2
            };
        },
        getMapPos(coords, level) {
            const relevantEdgeLength = level == 0 ? this.subMapEdgeLength : this.edgeLength;

            const x =
                (coords[0] - this.lowestMapCoords.x * (level == 0 ? 8 : 1)) * relevantEdgeLength;
            const y =
                (coords[1] - this.lowestMapCoords.y * (level == 0 ? 8 : 1)) * relevantEdgeLength;

            return { x, y };
        },
        getMapPosPx(map, level) {
            const pos = this.getMapPos([map.x, map.y], level);
            return { left: pos.x + "px", top: pos.y + "px" };
        },
        getMarkerPos(marker) {
            const pos = this.getMapPos([marker.x / 128, marker.y / 128], 3);
            return { left: pos.x + "px", top: pos.y + "px" };
        },
        mapExistsAt(x, y, level) {
            return this.availableMaps["level" + level].some(m => m.x === x && m.y === y);
        },
        relativeCoordsMapExistsAt(x, y, dx, dy, level = this.zoomLevel) {
            const [checkX, checkY] = [x + dx, y + dy];
            return this.mapExistsAt(checkX, checkY, level);
        },
        getMapPositionAtViewportPos(viewportX, viewportY, level) {
            const relevantEdgeLength = level == 0 ? this.subMapEdgeLength : this.edgeLength;
            const x = (-this.fullMapPos.left + viewportX) / relevantEdgeLength;
            const y = (-this.fullMapPos.top + viewportY) / relevantEdgeLength;
            return [
                x + this.lowestMapCoords.x * (level == 0 ? 8 : 1),
                y + this.lowestMapCoords.y * (level == 0 ? 8 : 1)
            ];
        },
        getMapAtViewportPos(viewportX, viewportY, level) {
            const pos = this.getMapPositionAtViewportPos(viewportX, viewportY, level);
            return pos.map(Math.floor);
        },
        getLevel3MapOpacity(map) {
            return this.zoomLevel == 0
                ? 0.3
                : map.x == this.currentlyCenteredMap[0] && map.y == this.currentlyCenteredMap[1]
                ? 1
                : 0.7;
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
            // the sub-map-outlines component uses units where the length of a level
            // 3 map is always 1, bc its moment-to-moment size is much easier to
            // control and transition when setting it in pixels from the outside,
            // rather than calculating the border placement in pixels on the inside;
            // the sub map border width is here expressed in these units.
            return 3 / 1000;
        },
        subMapBorderWidthPx() {
            return this.subMapBorderWidth * this.edgeLength;
        },
        centerMap() {
            return this.availableMaps.level3.find(m => m.x === 0 && m.y === 0);
        },
        fullMapDimensions() {
            return {
                width:
                    (this.highestMapCoords.x + 1 - this.lowestMapCoords.x) * this.edgeLength + "px",
                height:
                    (this.highestMapCoords.y + 1 - this.lowestMapCoords.y) * this.edgeLength + "px"
            };
        },
        currentPointsOfInterest() {
            if (this.isMidZoom) {
                return pointsOfInterest.level3.concat(
                    pointsOfInterest.level0.filter(p =>
                        this.currentSubMapIsland.has(
                            Math.floor((p.x / 128) * 8) + "," + Math.floor((p.y / 128) * 8)
                        )
                    )
                );
            } else if (this.zoomLevel == 0 && !this.isMidZoom) {
                return pointsOfInterest.level3
                    .concat(pointsOfInterest.level0)
                    .filter(p =>
                        this.currentSubMapIsland.has(
                            Math.floor((p.x / 128) * 8) + "," + Math.floor((p.y / 128) * 8)
                        )
                    );
            } else {
                return pointsOfInterest.level3.filter(
                    p =>
                        p.x / 128 > this.currentlyCenteredMap[0] &&
                        p.x / 128 < this.currentlyCenteredMap[0] + 1 &&
                        p.y / 128 > this.currentlyCenteredMap[1] &&
                        p.y / 128 < this.currentlyCenteredMap[1] + 1
                );
            }
        },
        lowestMapCoords() {
            // always for the level 3 maps
            let minX = Math.min(...this.availableMaps.level3.map(m => m.x));
            let minY = Math.min(...this.availableMaps.level3.map(m => m.y));
            return { x: minX, y: minY };
        },
        highestMapCoords() {
            // always for the level 3 maps
            let maxX = Math.max(...this.availableMaps.level3.map(m => m.x));
            let maxY = Math.max(...this.availableMaps.level3.map(m => m.y));
            return { x: maxX, y: maxY };
        },
        scaledLowestMapCoords() {
            return {
                x: this.lowestMapCoords.x * (this.zoomLevel == 0 ? 8 : 1),
                y: this.lowestMapCoords.y * (this.zoomLevel == 0 ? 8 : 1)
            };
        },
        currentlyCenteredMap() {
            return this.getMapAtViewportPos(
                this.windowWidth / 2,
                this.windowHeight / 2,
                this.zoomLevel
            );
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
        },
        currentSubMapIsland() {
            const result = new Set();
            const islandSearch = startingMap => {
                const hashable = startingMap[0] + "," + startingMap[1];
                if (!result.has(hashable)) {
                    result.add(hashable);
                    if (this.mapExistsAt(startingMap[0] - 1, startingMap[1], 0)) {
                        islandSearch([startingMap[0] - 1, startingMap[1]]);
                    }
                    if (this.mapExistsAt(startingMap[0], startingMap[1] - 1, 0)) {
                        islandSearch([startingMap[0] - 1, startingMap[1] - 1]);
                    }
                    if (this.mapExistsAt(startingMap[0] + 1, startingMap[1], 0)) {
                        islandSearch([startingMap[0] + 1, startingMap[1]]);
                    }
                    if (this.mapExistsAt(startingMap[0], startingMap[1] + 1, 0)) {
                        islandSearch([startingMap[0], startingMap[1] + 1]);
                    }
                }
            };

            if (this.lastZoomedInOnSubMap[0] !== this.lastZoomedInOnSubMap[0]) {
                return null;
            } else {
                islandSearch(this.lastZoomedInOnSubMap);
                return result;
            }
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
#subMapOutlineOverlay {
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
