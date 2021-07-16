<template>
    <div id="app" :class="zoomLevel == 0 ? 'appZoomedIn' : ''">
        <div
            class="mapContainer"
            :class="isMidZoom && 'transitiony'"
            :style="{
                ...collage.fullMapDimensions.toCSS(),
                ...fullMapPos.toCSS(),
            }"
            @click="handleMapClick"
            @mousemove="handleMouseMove"
            @touchmove="handleMouseMove"
            @mousedown="startPanning"
            @touchstart="startPanning"
            @mouseup="panning = false"
            @touchend="panning = false"
            @touchcancel="panning = false"
            @mouseleave="panning = false"
            @transitionend="zoomTransitionEnd"
        >
            <img
                v-for="map in getCurrentlyVisibleMaps(3)"
                :key="map.file"
                :src="`maps/${map.file}`"
                class="subMap"
                :style="{
                    ...collage.getPosWithinCollage(map).toCSS(),
                    width: edgeLength + 'px',
                    height: edgeLength + 'px',
                }"
            />
            <svg
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
                :viewBox="mapViewBox"
                :width="collage.fullMapDimensions.width"
                :height="collage.fullMapDimensions.height"
                style="position: absolute; left: 0; top: 0"
                id="bigMap"
            >
                <mask id="islands">
                    <rect
                        :x="collage.lowestMapCoords.x"
                        :y="collage.lowestMapCoords.y"
                        width="100%"
                        height="100%"
                        fill="#555"
                    />
                    <template v-if="outliningSubMaps">
                        <polygon
                            v-for="(island, i) in collage.islands[0].items"
                            :key="i"
                            fill="black"
                            :points="island.corners.map((c) => c.x + ',' + c.y).join(' ')"
                        />
                    </template>
                </mask>
                <rect
                    :x="collage.lowestMapCoords.x"
                    :y="collage.lowestMapCoords.y"
                    width="100%"
                    height="100%"
                    fill="#ffffff"
                    mask="url(#islands)"
                />
            </svg>
            <transition name="fade">
                <img
                    v-if="currentlyCenteredMap && !outliningSubMaps && !isMidZoom"
                    :src="'/maps/' + currentlyCenteredMap.file"
                    :key="currentlyCenteredMap.file"
                    :style="{
                        width: edgeLength + 'px',
                        height: edgeLength + 'px',
                        ...collage.getPosWithinCollage(currentlyCenteredMap).toCSS(),
                    }"
                    class="subMap"
                />
            </transition>
            <img
                v-for="subMap in getCurrentlyVisibleMaps(0)"
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
            <MapOutlines
                :zoomLevel="0"
                :borderWidth="subMapBorderWidth"
                :collage="collage"
                :style="{
                    visiblity: outliningSubMaps ? '' : 'hidden',
                    opacity: outliningSubMaps ? 1 : 0,
                    ...getOutlinePos(0),
                }"
            />
            <!--
            <MapOutlines
                :zoomLevel="3"
                :subMapBorderWidth=""
                :collage="collage"
                :style="getOutlinePos(3)"
            />
            -->
            <MapMarker
                v-for="location in currentPointsOfInterest"
                :key="location.x + ',' + location.y"
                :position="collage.getPosWithinCollage(location).toCSS()"
                :POI="location"
                :coverageIndex="captionCoverageIndex"
            />
        </div>
        <div id="cornerModal">
            <span
                style="display: flex; align-items: center; cursor: pointer"
                @click="magnifyingGlassClick"
                ><img
                    :src="zoomLevel == 0 || outliningSubMaps ? 'zoomout.svg' : 'zoom.svg'"
                    id="zoomButton"
                />{{ zoomButtonText }}</span
            >
            <div class="rowMobile">
                <label>
                    <input type="checkbox" value="village" v-model="allowedPOITypes" />
                    Villages
                </label>
                <label>
                    <input type="checkbox" value="normal" v-model="allowedPOITypes" />
                    Other fun stuff
                </label>
            </div>
            <span v-if="currentlyCenteredMap" class="mapInfo">
                Map ID: #{{ currentlyCenteredMap.id }}
                <br />
                {{ getEdgeLength(zoomLevel) }} x {{ getEdgeLength(zoomLevel) }} blocks
                <br />
                {{ getMinecraftCoordinates(currentlyCenteredMap) }}
            </span>
            <a target="_blank" href="travel_brochure_96dpi.pdf">Complimentary Brochure</a>
        </div>
    </div>
</template>

<script>
import { vueWindowSizeMixin } from "vue-window-size";
import RBush from "rbush";
import availableMaps from "./mapdata/processed_maps.json";
import pointsOfInterest from "./mapdata/points_of_interest.ts";
import MapOutlines from "./MapOutlines.vue";
import MapMarker from "./Marker.vue";
import { Position, Dimensions, clamp, getEdgeLength } from "./Types.ts";
import MapCollage from "./MapCollage";
import Island from "./Island";
import { POIType } from "./Types";

export default {
    name: "App",
    components: { MapOutlines, MapMarker },
    data: () => ({
        collage: null, // MapCollage object instantiated in "created" hook
        deployed: window.location.protocol == "https:",
        mouseX: 0,
        mouseY: 0,
        zoomLevel: 3, // currently can be only either 0 or 3
        isMidZoom: false,
        fullMapPos: new Position(NaN, NaN), // properly set in "created" hook
        outliningSubMaps: false,
        renderingSubMaps: false,
        panning: false,
        lastPanningX: -1,
        lastPanningY: -1,
        currentIsland: null,
        allowedPOITypes: Object.values(POIType),
        poiTypeFilter: "byProximity", // or "byIsland" or "allIslands"
        captionCoverageIndex: new RBush(),
        // whilst zooming in or out, it is necessary to have loaded into the DOM the
        // maps and POIs that are visible both before and after the change in zoom
        // level occurs, to ensure a smooth transition. these next two state
        // components record the rectangles in {minX, minY, maxX, maxY} format in
        // MapCollage units that contain the maps that are visible during each of
        // those states. these two components are only used when isMidZoom is true;
        // the rest of the time the current "window" containing the maps and POIs
        // that are to be shown is calculated with MapCollage.getBBoxFromViewport.
        zoomedOutWindow: {},
        zoomedInWindow: {}
    }),
    created() {
        this.collage = new MapCollage(availableMaps, pointsOfInterest, {
            mapLevel: 3,
            edgeLengthPx: this.edgeLength
        });
        const preAreaMatch = location.hash.match(/^#level(\d+)x(-?\d+)z(-?\d+)$/);
        let successfullyLoadedNonDefaultStartingPoint = false;
        if (preAreaMatch) {
            const level = parseInt(preAreaMatch[1]);
            // converting x and y from minecraft units to the coordinate system we're
            // using for our maps (where the top left of any map that contains the
            // origin lies at 0, 0)
            const x = parseFloat(preAreaMatch[2]) + 64;
            const y = parseFloat(preAreaMatch[3]) + 64;
            const edge = getEdgeLength(level);
            const mapX = Math.floor(x / edge) * edge;
            const mapY = Math.floor(y / edge) * edge;
            let currentIsland;
            if (level == 3) {
                // will have to be changed if we add support for multiple level3 islands
                currentIsland = this.collage.islands[3].items[0];
            } else {
                console.log("starting with map at level", level, "and coords", mapX, mapY);
                currentIsland = Island.getIslandContainingMap(level, { x: mapX, y: mapY });
                console.log("found island", currentIsland);
            }
            if (currentIsland) {
                this.zoomLevel = level;
                this.currentIsland = currentIsland;
                if (level == 0) {
                    this.outliningSubMaps = true;
                    this.collage.resize({ mapLevel: 3, edgeLengthPx: this.edgeLength });
                    this.fullMapPos = this.collage.getPosCenteredOn(
                        { x, y },
                        new Dimensions(this.windowWidth, this.windowHeight)
                    );
                    this.poiTypeFilter = "byIsland";
                }
                successfullyLoadedNonDefaultStartingPoint = true;
            }
        }
        if (!successfullyLoadedNonDefaultStartingPoint) {
            this.fullMapPos = this.collage.getPosCenteredOnMap(
                { x: 0, y: 0 },
                3,
                new Dimensions(this.windowWidth, this.windowHeight)
            );

            // this will have to be changed if we add support for multiple level 3
            // islands
            this.currentIsland = this.collage.islands[3].items[0];
        }
        // the actual next values are not known unless isMidZoom
        this.nextFullMapPos = this.fullMapPos;
        this.nextZoomLevel = this.zoomLevel;
    },
    mounted() {
        if (history.scrollRestoration) {
            history.scrollRestoration = "manual";
        }
    },
    methods: {
        zoom(direction, map) {
            if (direction == "in") {
                const { x, y } = map;
                console.log("map at this position was clicked", x, y);
                this.isMidZoom = true;
                this.currentIsland = Island.getIslandContainingMap(0, { x, y });
                this.poiTypeFilter = "byIsland";
                this.renderingSubMaps = true;
                this.zoomedInWindow = this.collage.getBBoxCenteredOnMap(
                    { x, y },
                    3,
                    0,
                    new Dimensions(this.windowWidth, this.windowHeight)
                );
                this.zoomedOutWindow = this.collage.getBBoxFromViewport(
                    this.fullMapPos,
                    new Dimensions(this.windowWidth, this.windowHeight)
                );
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.zoomLevel = 0;
                        // this.edgeLength updated when this.zoomLevel did
                        this.collage.resize({ mapLevel: 3, edgeLengthPx: this.edgeLength });
                        this.fullMapPos = this.collage.getPosCenteredOnMap(
                            { x, y },
                            0,
                            new Dimensions(this.windowWidth, this.windowHeight)
                        );
                    });
                });
            } else if (direction == "out") {
                this.isMidZoom = true;
                // this will have to be changed if we add support for multiple level 3
                // islands
                this.currentIsland = this.collage.islands[3].items[0];
                this.poiTypeFilter = "byProximity";
                this.renderingSubMaps = false;

                this.zoomedOutWindow = this.collage.getBBoxCenteredOnMap(
                    map,
                    0,
                    3,
                    new Dimensions(this.windowWidth, this.windowHeight)
                );
                this.zoomedInWindow = this.collage.getBBoxFromViewport(
                    this.fullMapPos,
                    new Dimensions(this.windowWidth, this.windowHeight)
                );
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.zoomLevel = 3;
                        this.outliningSubMaps = false;
                        // this.edgeLength updated when this.zoomLevel did
                        this.collage.resize({ mapLevel: 3, edgeLengthPx: this.edgeLength });
                        this.fullMapPos = this.collage.getPosCenteredOnMap(
                            map,
                            3,
                            new Dimensions(this.windowWidth, this.windowHeight)
                        );
                    });
                });
            } else {
                console.error(direction, "is not a real direction");
            }
        },
        handleMouseMove(event) {
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

                this.fullMapPos = new Position(
                    clamp(
                        this.fullMapPos.left + newX - this.lastPanningX,
                        bounds.lowerXBound,
                        bounds.upperXBound
                    ),
                    clamp(
                        this.fullMapPos.top + newY - this.lastPanningY,
                        bounds.lowerYBound,
                        bounds.upperYBound
                    )
                );

                this.lastPanningX = newX;
                this.lastPanningY = newY;
            }
        },
        startPanning(event) {
            if (event.touches && event.touches.length > 1) {
                return;
            }
            if (this.isMidZoom) {
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
        handleMapClick(event) {
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
                    this.zoom("in", clickedMap);
                } else {
                    console.log("area with no submap was clicked");
                }
            }
        },
        magnifyingGlassClick() {
            if (this.zoomLevel !== 0) {
                this.outliningSubMaps = !this.outliningSubMaps;
                if (this.outliningSubMaps) {
                    this.poiTypeFilter = "allIslands";
                } else {
                    this.poiTypeFilter = "byProximity";
                }
            } else {
                const currentLevel3Map = this.collage.getMapFromViewportPos(
                    new Position(this.windowWidth / 2, this.windowHeight / 2),
                    this.fullMapPos,
                    3
                );
                this.zoom("out", currentLevel3Map);
            }
        },
        zoomTransitionEnd(event) {
            if (event.target === event.currentTarget) {
                this.isMidZoom = false;
            }
        },
        getLevel3MapOpacity(map) {
            return this.zoomLevel == 0
                ? 0.3
                : map.x == this.currentlyCenteredMap?.x && map.y == this.currentlyCenteredMap?.y
                ? 1
                : 0.7;
        },
        getOutlinePos(zoomLevel) {
            // position outline so it sticks out of the sides of the map so that maps
            // on the edge can be outlined
            const borderWidth = zoomLevel == 3 ? this.fullMapBorderWidth : this.subMapBorderWidth;
            const scaleFactor = this.zoomLevel == 3 ? 1 : 8;
            return {
                position: "absolute",
                left: -borderWidth * scaleFactor + "px",
                top: -borderWidth * scaleFactor + "px",
                width: "calc(100% + " + borderWidth * 2 * scaleFactor + "px)",
                height: "calc(100% + " + borderWidth * 2 * scaleFactor + "px)"
            };
        },
        getMinecraftCoordinates(map) {
            const edge = getEdgeLength(this.zoomLevel);
            return (
                `x: ${map.x - 64} thru ${map.x - 64 + edge}\n` +
                `z: ${map.y - 64} thru ${map.y - 64 + edge}`
            );
        },
        getCurrentlyVisibleMaps(level) {
            if (level == 0 && !this.renderingSubMaps) {
                return [];
            } else {
                if (this.isMidZoom) {
                    const zoomedOutMaps = this.collage.items.searchMaps(
                        level,
                        this.zoomedOutWindow
                    );
                    const zoomedInMaps = this.collage.items.searchMaps(level, this.zoomedInWindow);
                    // remove duplicates
                    const files = new Set();
                    const allMaps = [];
                    for (const map of zoomedOutMaps.concat(zoomedInMaps)) {
                        if (!files.has(map.file)) {
                            files.add(map.file);
                            allMaps.push(map);
                        }
                    }
                    return allMaps;
                } else {
                    const openWindow = this.collage.getBBoxFromViewport(
                        this.fullMapPos,
                        new Dimensions(this.windowWidth, this.windowHeight)
                    );

                    return this.collage.items.searchMaps(level, openWindow);
                }
            }
        },
        getEdgeLength // adding this to the instance just to make it usable in the template
    },
    computed: {
        screenSizeInBlockUnits() {
            return new Dimensions(
                this.windowWidth / this.collage.pxPerBlock,
                this.windowHeight / this.collage.pxPerBlock
            );
        },
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
        mapViewBox() {
            return (
                this.collage.lowestMapCoords.x +
                " " +
                this.collage.lowestMapCoords.y +
                " " +
                (this.collage.highestMapCoords.x - this.collage.lowestMapCoords.x + 1024) +
                " " +
                (this.collage.highestMapCoords.y - this.collage.lowestMapCoords.y + 1024)
            );
        },
        currentlyCenteredMap() {
            if (!this.collage) {
                return undefined;
            }
            const result = this.collage.getMapFromViewportPos(
                new Position(this.windowWidth / 2, this.windowHeight / 2),
                this.fullMapPos,
                this.zoomLevel
            );
            return result;
        },
        currentPanningBounds() {
            // translate the point at the center of the viewport into the map collage's
            // coordinate system
            const centerPoint = new Position(this.windowWidth / 2, this.windowHeight / 2);
            const coordsWithinCollage = this.collage.getCoordsWithinCollageFromViewportPos(
                centerPoint,
                this.fullMapPos
            );
            // round the coordinates of the point at the center of the viewport down to
            // retrieve the upper left corner of the map that is currently centered
            // at whatever zoom level we are at
            const mapX =
                Math.floor(coordsWithinCollage.x / getEdgeLength(this.zoomLevel)) *
                getEdgeLength(this.zoomLevel);
            const mapY =
                Math.floor(coordsWithinCollage.y / getEdgeLength(this.zoomLevel)) *
                getEdgeLength(this.zoomLevel);
            // use the islandShape object's properties to retrieve the lines that
            // bound the current island that are directly left and right and directly
            // below and above the current center-of-the-viewport point
            const xBoundLines = this.currentIsland.islandShape.yIndex[mapY];
            const yBoundLines = this.currentIsland.islandShape.xIndex[mapX];
            // determine the minimum x and y values and the maximum x and y values
            // that the center-of-the-viewport can have in the collage coordinate
            // system while still being over the current island
            const mapSpaceLowerBounds = {
                x: xBoundLines[0].xAt(coordsWithinCollage.y),
                y: yBoundLines[0].yAt(coordsWithinCollage.x)
            };
            const mapSpaceUpperBounds = {
                x: xBoundLines[xBoundLines.length - 1].xAt(coordsWithinCollage.y),
                y: yBoundLines[yBoundLines.length - 1].yAt(coordsWithinCollage.x)
            };
            // translate those minimums and maximum into pixel coordinates relative
            // to the top left of the viewport
            const screenSpaceLowerBounds = this.collage.getPosWithinCollage(mapSpaceLowerBounds);
            screenSpaceLowerBounds._left += this.fullMapPos.left;
            screenSpaceLowerBounds._top += this.fullMapPos.top;
            const screenSpaceUpperBounds = this.collage.getPosWithinCollage(mapSpaceUpperBounds);
            screenSpaceUpperBounds._left += this.fullMapPos.left;
            screenSpaceUpperBounds._top += this.fullMapPos.top;
            // translate the pixel coordinates establishing the minimums and maximums
            // for the center point of the screen into pixel coordinate bounds for
            // the placement of the map. the + 1s are a hack to keep the user from
            // panning onto the right and top edges of the current island, which are
            // a sort of edge case
            return {
                lowerXBound:
                    this.fullMapPos.left - (screenSpaceUpperBounds.left - centerPoint.left) + 1,
                upperXBound:
                    this.fullMapPos.left + (centerPoint.left - screenSpaceLowerBounds.left),
                lowerYBound:
                    this.fullMapPos.top - (screenSpaceUpperBounds.top - centerPoint.top) + 1,
                upperYBound: this.fullMapPos.top + (centerPoint.top - screenSpaceLowerBounds.top)
            };
            // break glass in case of debugging something completely different:
            // return {
            //     lowerXBound: -Infinity,
            //     upperXBound: Infinity,
            //     lowerYBound: -Infinity,
            //     upperYBound: Infinity
            // };
        },
        currentPointsOfInterest() {
            let narrowedDownPoints = [];
            if (this.isMidZoom) {
                let points;
                points = this.collage.items.searchPOIs(3, this.zoomedOutWindow);
                points = points.concat(this.collage.items.searchPOIs(0, this.zoomedOutWindow));
                points = points.concat(this.collage.items.searchPOIs(3, this.zoomedInWindow));
                points = points.concat(this.collage.items.searchPOIs(0, this.zoomedInWindow));
                const IDs = new Set();
                for (const point of points) {
                    if (!IDs.has(point.id)) {
                        IDs.add(point.id);
                        narrowedDownPoints.push(point);
                    }
                }
            } else {
                const currentWindow = this.collage.getBBoxFromViewport(
                    this.fullMapPos,
                    new Dimensions(this.windowWidth, this.windowHeight)
                );
                narrowedDownPoints = this.collage.items.searchPOIs(3, currentWindow);
                if (this.outliningSubMaps) {
                    narrowedDownPoints = narrowedDownPoints.concat(
                        this.collage.items.searchPOIs(0, currentWindow)
                    );
                }
            }

            const mode = this.poiTypeFilter;
            if (mode == "byIsland") {
                narrowedDownPoints = narrowedDownPoints.filter(poi =>
                    poi.islandIDs.includes(this.currentIsland.id)
                );
            } else if (mode == "allIslands") {
                narrowedDownPoints = narrowedDownPoints.filter(poi => !poi.onlyLevel3);
            } else {
                if (mode !== "byProximity") {
                    console.log("unsupported point of interest filtering mode:", mode);
                }
            }
            return narrowedDownPoints.filter(poi => this.allowedPOITypes.includes(poi.type));
        },
        zoomButtonText() {
            if (this.zoomLevel == 3) {
                if (this.outliningSubMaps) {
                    return "Click within an outlined area";
                } else {
                    return "Zoom In";
                }
            } else {
                return "Zoom Out";
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

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
    opacity: 0;
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
#bigMap {
    @include standard-transitions;
}
#cornerDisplay {
    position: fixed;
    left: 5px;
    bottom: 5px;
}
#zoomButton {
    width: 25px;
    height: 25px;
    margin-right: 3px;
    margin-left: 3px;
}
.rowMobile {
    display: flex;
    flex-direction: column;
    @media (max-aspect-ratio: 1/1) {
        flex-direction: row;
        > label:not(:last-child) {
            margin-right: 5px;
        }
    }
}
#cornerModal {
    position: fixed;
    right: 50px;
    top: 50px;
    width: 150px;
    @media (max-aspect-ratio: 1/1) {
        right: unset;
        top: unset;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        width: 60%;
        font-size: 80%;
        align-items: center;
    }
    background-color: peachpuff;
    border-radius: 3px;
    border: 2px solid black;
    padding: 2.5px;
    display: flex;
    flex-direction: column;
    z-index: 12;
    > * {
        margin-bottom: 5px;
    }
    :last-child {
        margin-bottom: 0;
    }
}
.mapInfo {
    white-space: pre;
    @media (max-aspect-ratio: 1/1) {
        text-align: center;
    }
}
.subMap {
    position: absolute;
    user-select: none;
    @include standard-transitions;
}
</style>
