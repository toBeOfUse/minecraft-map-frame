<template>
    <div id="app" :class="zoomLevel == 0 ? 'appZoomedIn' : ''">
        <div
            class="mapContainer"
            :class="[isMidZoom && 'zoomTransition']"
            :style="{
                ...collage.fullMapDimensions.toCSS(),
                ...fullMapPos.toCSS(),
            }"
            @click="handleMapClick"
            @mousemove="handlePointerMove"
            @touchmove="handlePointerMove"
            @mousedown="handlePointerAdd"
            @touchstart="handlePointerAdd"
            @mouseup="handlePointerRemove"
            @touchend="handlePointerRemove"
            @touchcancel="handlePointerRemove"
            @mouseleave="handlePointerRemove"
            @transitionend="zoomTransitionEnd"
            @wheel="handleWheel"
        >
            <img
                v-for="map in currentlyVisibleMaps"
                :key="map.file"
                :src="`maps/${map.file}`"
                class="subMap"
                :style="{
                    ...collage.getPosWithinCollage(map).toCSS(),
                    width: level3MapSizePx + 'px',
                    height: level3MapSizePx + 'px',
                }"
            />
            <MapOverlay
                :islands="collage.islands"
                :outliningSubMaps="outliningSubMaps"
                :fadingOutBGMaps="outliningSubMaps || highlightingMap"
            />
            <img
                v-if="currentlyCenteredMap && !outliningSubMaps && highlightingMap && !isMidZoom"
                :src="'/maps/' + currentlyCenteredMap.file"
                :style="{
                    width: level3MapSizePx + 'px',
                    height: level3MapSizePx + 'px',
                    ...collage.getPosWithinCollage(currentlyCenteredMap).toCSS(),
                }"
                class="subMap"
            />
            <img
                v-for="subMap in currentlyVisibleSubMaps"
                :key="subMap.file"
                :src="`maps/${subMap.file}`"
                class="subMap"
                :style="{
                    ...collage.getPosWithinCollage(subMap).toCSS(),
                    width: level0MapSizePx + 'px',
                    height: level0MapSizePx + 'px',
                    visiblity: zoomLevel == 0 ? '' : 'hidden',
                    opacity: zoomLevel == 0 ? 1 : 0,
                }"
            />
            <MapMarker
                v-for="location in currentPointsOfInterest"
                :key="location.x + ',' + location.y"
                :position="collage.getPosWithinCollage(location)"
                :fullMapPos="fullMapPos"
                :POI="location"
                :coverageIndex="captionCoverageIndex"
                :initiallyActive="location.x == 64 && location.y == 64"
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
            <div class="poiCheckboxes">
                <div class="poiCheckboxGroup">
                    <span>
                        <input
                            id="village"
                            type="checkbox"
                            value="village"
                            v-model="allowedPOITypes"
                        />
                        <label for="village"> Villages </label>
                    </span>
                    <span>
                        <input
                            id="mining"
                            type="checkbox"
                            value="mining"
                            v-model="allowedPOITypes"
                        />
                        <label for="mining"> Mining spots </label>
                    </span>
                </div>
                <div class="poiCheckboxGroup">
                    <span>
                        <input
                            id="monsters"
                            type="checkbox"
                            value="monsters"
                            v-model="allowedPOITypes"
                        />
                        <label for="monsters"> Monster hangouts </label>
                    </span>
                    <span>
                        <input
                            id="normal"
                            type="checkbox"
                            value="normal"
                            v-model="allowedPOITypes"
                        />
                        <label for="normal"> Other fun stuff </label>
                    </span>
                </div>
            </div>
            <span v-if="currentlyCenteredMap" class="mapInfo">
                Map ID: #{{ currentlyCenteredMap.id }}
                {{ infoBoxDelimiter }}
                {{ getEdgeLength(zoomLevel) }} x {{ getEdgeLength(zoomLevel) }} blocks
                <br />
                {{ getMinecraftCoordinates(currentlyCenteredMap) }}
            </span>
            <a target="_blank" href="travel_brochure_96dpi.pdf">Complimentary Brochure</a>
            <span v-if="!deployed">{{ debug }}</span>
        </div>
    </div>
</template>

<script>
import { vueWindowSizeMixin } from "vue-window-size";
import RBush from "rbush";
import availableMaps from "./mapdata/processed_maps.json";
import pointsOfInterest from "./mapdata/points_of_interest.ts";
import MapMarker from "./Marker.vue";
import { Position, Dimensions, clamp, getEdgeLength } from "./Types.ts";
import MapCollage from "./MapCollage";
import Island from "./Island";
import MapOverlay from "./Overlays.tsx";

export default {
    name: "App",
    components: { MapMarker, MapOverlay },
    data: () => ({
        collage: null, // MapCollage object instantiated in "created" hook
        deployed: window.location.protocol == "https:",
        mouseX: 0,
        mouseY: 0,
        zoomLevel: 3, // currently can be only either 0 or 3
        isMidZoom: false,
        fullMapPos: new Position(NaN, NaN), // properly set in "created" hook
        debouncedFullMapPos: new Position(NaN, NaN),
        outliningSubMaps: false,
        renderingSubMaps: false,
        panning: false,
        lastPanningX: -1,
        lastPanningY: -1,
        lastDistBetweenTouches: -1,
        currentIsland: null,
        allowedPOITypes: ["normal", "village", "mining", "monsters"],
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
        zoomedInWindow: {},
        scaleFactor: 1,
        maxScaleFactor: 1.5,
        minScaleFactor: 0.3,
        debug: ""
    }),
    created() {
        this.collage = new MapCollage(availableMaps, pointsOfInterest, {
            mapLevel: 3,
            edgeLengthPx: this.level3MapSizePx
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
                    this.collage.resize({ mapLevel: 3, edgeLengthPx: this.level3MapSizePx });
                    this.fullMapPos = this.collage.getPosCenteredOn(
                        { x, y },
                        this.viewportDimensions
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
                this.viewportDimensions
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
        handleWheel(event) {
            const pointUnderMouse = this.collage.getCoordsWithinCollageFromViewportPos(
                new Position(event.pageX, event.pageY),
                this.fullMapPos
            );
            const originalCenterPoint = this.collage.getCoordsWithinCollageFromViewportPos(
                new Position(this.windowWidth / 2, this.windowHeight / 2),
                this.fullMapPos
            );
            let newFactor = this.scaleFactor + event.deltaY * -0.0005;
            newFactor = clamp(newFactor, this.minScaleFactor, this.maxScaleFactor);
            if (newFactor !== this.scaleFactor) {
                this.scaleFactor = newFactor;
                this.collage.resize({
                    mapLevel: 3,
                    edgeLengthPx: this.level3MapSizePx
                });
                // we have to scale the map, move the map to keep the center point
                // the same, obtain the bounds, and then move it as much as the
                // bounds allow to restore the point under the mouse to the same
                // point on the map that it used to be
                const intermediateFullMapPos = this.collage.getPosCenteredOn(
                    originalCenterPoint,
                    this.viewportDimensions
                );
                this.fullMapPos = intermediateFullMapPos;
                const newFullMapPos = this.collage.getPosWithPlacedPoint(pointUnderMouse, {
                    x: event.pageX,
                    y: event.pageY
                });
                const bounds = this.currentPanningBounds;
                this.fullMapPos = new Position(
                    clamp(newFullMapPos.left, bounds.lowerXBound, bounds.upperXBound),
                    clamp(newFullMapPos.top, bounds.lowerYBound, bounds.upperYBound)
                );
            }
        },
        levelChange(newLevel, map) {
            if (newLevel == 0) {
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
                    this.viewportDimensions
                );
                this.zoomedOutWindow = this.collage.getBBoxFromViewport(
                    this.fullMapPos,
                    this.viewportDimensions
                );
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.zoomLevel = 0;
                        this.scaleFactor = 1;
                        // this.level3MapSizePx updated when this.zoomLevel did
                        this.collage.resize({ mapLevel: 3, edgeLengthPx: this.level3MapSizePx });
                        this.fullMapPos = this.collage.getPosCenteredOnMap(
                            { x, y },
                            0,
                            this.viewportDimensions
                        );
                    });
                });
            } else if (newLevel == 3) {
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
                    this.viewportDimensions
                );
                this.zoomedInWindow = this.collage.getBBoxFromViewport(
                    this.fullMapPos,
                    this.viewportDimensions
                );
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.zoomLevel = 3;
                        this.scaleFactor = 1;
                        this.outliningSubMaps = false;
                        // this.level3MapSizePx updated when this.zoomLevel did
                        this.collage.resize({ mapLevel: 3, edgeLengthPx: this.level3MapSizePx });
                        this.fullMapPos = this.collage.getPosCenteredOnMap(
                            map,
                            3,
                            this.viewportDimensions
                        );
                    });
                });
            } else {
                console.error(newLevel, "is not a valid new level");
            }
        },
        handlePointerMove(event) {
            if (!this.deployed) {
                const eventPos = this.collage.getCoordsWithinCollageFromViewportPos(
                    new Position(event.clientX, event.clientY),
                    this.fullMapPos
                );
                this.mouseX = eventPos.x;
                this.mouseY = eventPos.y;
            }

            if (this.panning) {
                event.preventDefault();
                let newX, newY;
                if (event.type.startsWith("mouse") || event.touches?.length == 1) {
                    const newPointerX = event.type.startsWith("mouse")
                        ? event.pageX
                        : event.touches[0]?.pageX;
                    newX = this.fullMapPos.left + newPointerX - this.lastPanningX;
                    const newPointerY = event.type.startsWith("mouse")
                        ? event.pageY
                        : event.touches[0]?.pageY;
                    newY = this.fullMapPos.top + newPointerY - this.lastPanningY;
                    this.lastPanningX = newPointerX;
                    this.lastPanningY = newPointerY;
                } else if (event.touches?.length > 1) {
                    const x1 = event.touches[0].pageX,
                        x2 = event.touches[1].pageX;
                    const y1 = event.touches[0].pageY,
                        y2 = event.touches[1].pageY;
                    const newMiddleX = (x1 + x2) / 2;
                    const newMiddleY = (y1 + y2) / 2;

                    const oldMiddleMapCoords = this.collage.getCoordsWithinCollageFromViewportPos(
                        new Position(this.lastPanningX, this.lastPanningY),
                        this.fullMapPos
                    );

                    const viewportCenterMapCoords = this.collage.getCoordsWithinCollageFromViewportPos(
                        new Position(this.windowWidth / 2, this.windowHeight / 2),
                        this.fullMapPos
                    );

                    const newDistBetweenTouches = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

                    this.scaleFactor = clamp(
                        this.scaleFactor * (newDistBetweenTouches / this.lastDistBetweenTouches),
                        this.minScaleFactor,
                        this.maxScaleFactor
                    );
                    this.collage.resize({
                        mapLevel: 3,
                        edgeLengthPx: this.level3MapSizePx
                    });

                    // because scaling the map shifts our window into it, and our
                    // window into the collage is mandated to have a map in the
                    // active island at its center point, we have to correct for that
                    // and keep the center point the same before and after scaling to
                    // keep from going "out of bounds"
                    this.fullMapPos = this.collage.getPosCenteredOn(
                        viewportCenterMapCoords,
                        this.viewportDimensions
                    );

                    const newPosition = this.collage.getPosWithPlacedPoint(oldMiddleMapCoords, {
                        x: newMiddleX,
                        y: newMiddleY
                    });

                    newX = newPosition.left;
                    newY = newPosition.top;

                    this.lastPanningX = newMiddleX;
                    this.lastPanningY = newMiddleY;

                    this.lastDistBetweenTouches = newDistBetweenTouches;
                }
                const bounds = this.currentPanningBounds;

                this.fullMapPos = new Position(
                    clamp(newX, bounds.lowerXBound, bounds.upperXBound),
                    clamp(newY, bounds.lowerYBound, bounds.upperYBound)
                );
            }
        },
        handlePointerAdd(event) {
            if (this.isMidZoom) {
                return;
            }
            this.panning = true;
            if (event.type.startsWith("mouse") || event.touches?.length == 1) {
                this.lastPanningX = event.type.startsWith("mouse")
                    ? event.pageX
                    : event.touches[0]?.pageX;
                this.lastPanningY = event.type.startsWith("mouse")
                    ? event.pageY
                    : event.touches[0]?.pageY;
            } else if (event.touches?.length > 1) {
                const x1 = event.touches[0].pageX,
                    x2 = event.touches[1].pageX;
                const y1 = event.touches[0].pageY,
                    y2 = event.touches[1].pageY;
                this.lastPanningX = (x1 + x2) / 2;
                this.lastPanningY = (y1 + y2) / 2;
                this.lastDistBetweenTouches = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            }
        },
        handlePointerRemove(event) {
            if (event.type.startsWith("mouse") || event.touches?.length === 0) {
                this.panning = false;
            } else if (event.touches?.length === 1) {
                this.lastPanningX = event.touches[0].pageX;
                this.lastPanningY = event.touches[0].pageY;
            }
        },
        handleMapClick(event) {
            if (!this.deployed && navigator.clipboard) {
                const coords = `{
                    x: ${this.mouseX.toFixed(2)},
                    y: ${this.mouseY.toFixed(2)},
                    text: "",
                    type: Normal,
                },`;
                navigator.clipboard.writeText(coords);
            }
            if (this.outliningSubMaps && this.zoomLevel !== 0) {
                const clickedMap = this.collage.getMapFromViewportPos(
                    new Position(event.clientX, event.clientY),
                    this.fullMapPos,
                    0
                );
                if (clickedMap) {
                    this.levelChange(0, clickedMap);
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
                this.levelChange(3, currentLevel3Map);
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
        getOutlinePos() {
            // position outline so it sticks out of the sides of the map so that maps
            // on the edge can be outlined
            const borderWidth = this.subMapBorderWidth;
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
                `x: ${map.x - 64} thru ${map.x - 64 + edge}` +
                this.infoBoxDelimiter +
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
                        this.debouncedFullMapPos,
                        this.viewportDimensions
                    );

                    return this.collage.items.searchMaps(level, openWindow);
                }
            }
        },
        getEdgeLength // adding this to the instance just to make it usable in the template
    },
    computed: {
        verticalMode() {
            return this.windowHeight > this.windowWidth;
        },
        viewportDimensions() {
            return new Dimensions(this.windowWidth, this.windowHeight);
        },
        infoBoxDelimiter() {
            if (this.verticalMode) {
                return " / ";
            } else {
                return "\n";
            }
        },
        screenSizeInBlockUnits() {
            return new Dimensions(
                this.windowWidth / this.collage.pxPerBlock,
                this.windowHeight / this.collage.pxPerBlock
            );
        },
        level3MapSizePx() {
            if (this.windowHeight > this.windowWidth) {
                return 0.95 * this.windowWidth * this.scaleFactor * (this.zoomLevel == 0 ? 8 : 1);
            } else {
                return 0.9 * this.windowHeight * this.scaleFactor * (this.zoomLevel == 0 ? 8 : 1);
            }
        },
        level0MapSizePx() {
            return this.level3MapSizePx / 8;
        },
        subMapBorderWidth() {
            // this is the width of the sub-map borders at the initial zoom level in
            // pixels (it automatically becomes wider when we zoom in via the scaling
            // of the svg outline overlay via css)
            return 3;
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
            // break glass in case of debugging something completely different:
            // return {
            //     lowerXBound: -Infinity,
            //     upperXBound: Infinity,
            //     lowerYBound: -Infinity,
            //     upperYBound: Infinity
            // };

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
            const result = {
                lowerXBound:
                    this.fullMapPos.left - (screenSpaceUpperBounds.left - centerPoint.left) + 1,
                upperXBound:
                    this.fullMapPos.left + (centerPoint.left - screenSpaceLowerBounds.left),
                lowerYBound:
                    this.fullMapPos.top - (screenSpaceUpperBounds.top - centerPoint.top) + 1,
                upperYBound: this.fullMapPos.top + (centerPoint.top - screenSpaceLowerBounds.top)
            };

            return result;
        },
        currentPointsOfInterest() {
            let narrowedDownPoints = [];
            if (this.isMidZoom) {
                let points;
                // TODO: just union the windows beforehand somehow instead of unioning the set of points
                points = this.collage.items.searchPOIs(3, this.zoomedOutWindow);
                points = points.concat(this.collage.items.searchPOIs(3, this.zoomedInWindow));
                if (this.outliningSubMaps) {
                    points = points.concat(this.collage.items.searchPOIs(0, this.zoomedOutWindow));
                    points = points.concat(this.collage.items.searchPOIs(0, this.zoomedInWindow));
                }
                const IDs = new Set();
                for (const point of points) {
                    if (!IDs.has(point.id)) {
                        IDs.add(point.id);
                        narrowedDownPoints.push(point);
                    }
                }
            } else {
                const currentWindow = this.collage.getBBoxFromViewport(
                    this.debouncedFullMapPos,
                    this.viewportDimensions
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
            const poiTypeGroups = {
                spawn: "normal"
            };
            return narrowedDownPoints.filter(
                poi =>
                    this.allowedPOITypes.includes(poi.type) ||
                    this.allowedPOITypes.includes(poiTypeGroups[poi.type])
            );
        },
        currentlyVisibleMaps() {
            return this.getCurrentlyVisibleMaps(3);
        },
        currentlyVisibleSubMaps() {
            return this.getCurrentlyVisibleMaps(0);
        },
        zoomButtonText() {
            if (this.zoomLevel == 3) {
                if (this.outliningSubMaps) {
                    return "Click within an outlined area";
                } else {
                    return "Zoom Way In";
                }
            } else {
                return "Zoom Way Out";
            }
        },
        highlightingMap() {
            return this.scaleFactor > 0.7;
        }
    },
    watch: {
        fullMapPos(newValue) {
            const debounceLevel = 50;
            const newDebouncedX = Math.floor(newValue.left / debounceLevel) * debounceLevel;
            const newDebouncedY = Math.floor(newValue.top / debounceLevel) * debounceLevel;
            if (
                newDebouncedX != this.debouncedFullMapPos.left ||
                newDebouncedY != this.debouncedFullMapPos.top
            ) {
                this.debouncedFullMapPos = new Position(newDebouncedX, newDebouncedY);
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
.zoomTransition {
    @include standard-transitions;
}
.zoomTransition * {
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
.poiCheckboxes {
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    width: 100%;
    > input {
        display: inline;
    }
    > label {
        display: inline;
    }
    @media (max-aspect-ratio: 1/1) {
        flex-direction: row;
        > label {
            text-align: center;
        }
        > label:not(:last-child) {
            margin-right: 5px;
        }
    }
}
.poiCheckboxGroup {
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
}
#cornerModal {
    position: fixed;
    right: 50px;
    top: 50px;
    width: 200px;
    @media (max-aspect-ratio: 1/1) {
        right: unset;
        top: unset;
        width: 250px;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 80%;
        align-items: center;
    }
    background-color: peachpuff;
    border-radius: 3px;
    border: 2px solid black;
    padding: 2.5px;
    display: flex;
    flex-direction: column;
    z-index: 110;
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
    pointer-events: none;
}
</style>
