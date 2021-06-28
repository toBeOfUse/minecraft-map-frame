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
            @mouseenter="mouseOverMap = true"
            @mouseleave="
                mouseOverMap = false;
                panning = false;
            "
            @transitionend="zoomTransitionEnd"
        >
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
                            v-for="(island, i) in collage.islands.level0"
                            :key="i"
                            fill="white"
                            :points="island.corners.map((c) => c.x + ',' + c.y).join(' ')"
                        />
                    </template>
                </mask>
                <image
                    :href="fullMapImage"
                    :x="collage.lowestMapCoords.x"
                    :y="collage.lowestMapCoords.y"
                    width="100%"
                    height="100%"
                    mask="url(#islands)"
                />
            </svg>
            <transition name="fade">
                <img
                    v-if="currentlyCenteredMap && !outliningSubMaps && !isMidZoom"
                    :src="subMapImages[currentlyCenteredMap.file]"
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
                :subMapBorderWidth="fullMapBorderWidth"
                :collage="collage"
                :style="getOutlinePos(3)"
            />
            -->
            <div
                class="mapMarker"
                :style="collage.getPosWithinCollage(location).toCSS()"
                v-for="location in currentPointsOfInterest"
                :key="location.x + ',' + location.y"
            >
                <img
                    :src="markerIcons[location.type]"
                    style="height: 100%; width: 100%"
                    class="markerImage"
                />
                <span class="caption">
                    {{ location.text }}
                </span>
            </div>
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
            <span v-if="currentlyCenteredMap">
                Map ID: #{{ currentlyCenteredMap.id }}
                <br />
                {{ collage.getEdgeLength(zoomLevel) }} x
                {{ collage.getEdgeLength(zoomLevel) }} blocks
                <br />
                {{ getMinecraftCoordinates(currentlyCenteredMap)[0] }}
                <br />
                {{ getMinecraftCoordinates(currentlyCenteredMap)[1] }}
            </span>
            <a target="_blank" href="travel_brochure_96dpi.pdf">Complimentary Brochure</a>
        </div>
    </div>
</template>

<script>
import { vueWindowSizeMixin } from "vue-window-size";
import availableMaps from "./mapdata/processed_maps.json";
import pointsOfInterest from "./mapdata/points_of_interest.ts";
import MapOutlines from "./MapOutlines.vue";
import { MapCollage, Position, Dimensions, Island, clamp } from "./Types.ts";
import { POIType } from "./Types";

export default {
    name: "App",
    components: { MapOutlines },
    data: () => ({
        collage: null,
        mouseOverMap: false,
        deployed: window.location.protocol == "https:",
        mouseX: 0,
        mouseY: 0,
        zoomLevel: 3, // currently can be only either 0 or 3
        isMidZoom: false,
        fullMapPos: new Position(NaN, NaN), // properly set in "created" hook
        outliningSubMaps: false,
        panning: false,
        lastPanningX: -1,
        lastPanningY: -1,
        currentIsland: null,
        currentPointsOfInterest: [],
        lastZoomedInOnSubMap: [NaN, NaN],
        markerIcons: {
            normal: "/marker.png",
            village: "/emerald.png"
        },
        allowedPOITypes: Object.values(POIType),
        poiTypeFilter: "byProximity", // or "byIsland" or "allIslands"
        fullMapImage: "/maps/full_map_level_3.png",
        subMapImages: {}
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
        // this will have to be changed if we add support for multiple level 3
        // islands
        this.currentIsland = this.collage.islands.level3[0];
        const fullMap = new Image();
        fullMap.src = this.fullMapImage;
        fullMap.onload = () => {
            for (const map of availableMaps.level3) {
                this.getSubMapImage(map, fullMap);
            }
        };
    },
    mounted() {
        if (history.scrollRestoration) {
            history.scrollRestoration = "manual";
        }
        this.getCurrentPointsOfInterest();
    },
    methods: {
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

                if (!this.outliningSubMaps) {
                    this.getCurrentPointsOfInterest();
                }

                this.lastPanningX = newX;
                this.lastPanningY = newY;
            }
        },
        startPanning(event) {
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
                    const { x, y } = clickedMap;
                    console.log("map at this position was clicked", x, y);
                    this.lastZoomedInOnSubMap = [x, y];
                    this.isMidZoom = true;
                    this.currentIsland = Island.getIslandContainingMap(0, { x, y });
                    this.getCurrentPointsOfInterest("byIsland").then(() => {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                this.zoomLevel = 0;
                                // this.edgeLength updated when this.zoomLevel did
                                this.collage.resize({ mapLevel: 3, edgeLengthPx: this.edgeLength });
                                this.fullMapPos = this.collage.getPosCenteredOn(
                                    { x, y },
                                    0,
                                    new Dimensions(this.windowWidth, this.windowHeight)
                                );
                            });
                        });
                    });
                } else {
                    console.log("area with no submap was clicked");
                }
            }
        },
        magnifyingGlassClick() {
            if (this.zoomLevel !== 0) {
                this.outliningSubMaps = !this.outliningSubMaps;
            } else {
                this.isMidZoom = true;
                // this will have to be changed if we add support for multiple level 3
                // islands
                this.currentIsland = this.collage.islands.level3[0];
                this.getCurrentPointsOfInterest("byProximity").then(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            const currentLevel3Map = this.collage.getMapFromViewportPos(
                                new Position(this.windowWidth / 2, this.windowHeight / 2),
                                this.fullMapPos,
                                3
                            );
                            this.zoomLevel = 3;
                            this.outliningSubMaps = false;
                            // this.edgeLength updated when this.zoomLevel did
                            this.collage.resize({ mapLevel: 3, edgeLengthPx: this.edgeLength });
                            this.fullMapPos = this.collage.getPosCenteredOn(
                                currentLevel3Map,
                                3,
                                new Dimensions(this.windowWidth, this.windowHeight)
                            );
                        });
                    });
                });
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
            const edge = this.collage.getEdgeLength(this.zoomLevel);
            return [
                `x: ${map.x - 64} - ${map.x - 64 + edge}`,
                `z: ${map.y - 64} - ${map.y - 64 + edge}`
            ];
        },
        async getCurrentPointsOfInterest(mode = this.poiTypeFilter) {
            // this function is called by mounted(), when showVillages or showMisc
            // change, when poiTypeFilter changes, and while panning when zoomed out
            this.poiTypeFilter = mode;
            const possibleTypes = Object.values(POIType);
            if (mode == "byIsland") {
                // allowed [island+type] combinations: the current island id and all
                // allowed types
                const allowedKeys = this.allowedPOITypes.map(type => [this.currentIsland.id, type]);
                console.log("searching for [island+type] keys:", allowedKeys);
                if (allowedKeys.length == 0) {
                    this.currentPointsOfInterest = [];
                } else {
                    let query = this.collage.pois.where("[island+type]");
                    if (allowedKeys.length == 1) {
                        query = query.equals(...allowedKeys);
                    } else {
                        query = query.anyOf(...allowedKeys);
                    }
                    this.currentPointsOfInterest = await query.toArray();
                }
            } else if (mode == "allIslands") {
                const islandKeys = await this.collage.pois.orderBy("island").uniqueKeys();
                const notAllowedTypes = possibleTypes.filter(
                    t => !this.allowedPOITypes.includes(t)
                );
                // not allowed values for [island+type]: -1 and anything; 1-6 and the
                // not currently allowed types
                const notAllowedKeys = Object.values(POIType).map(type => [-1, type]);
                for (const ik of islandKeys) {
                    for (const nat of notAllowedTypes) {
                        notAllowedKeys.push([ik, nat]);
                    }
                }
                console.log("excluding [island+type] keys:", notAllowedKeys);
                this.currentPointsOfInterest = await this.collage.pois
                    .where("[island+type]")
                    .noneOf(...notAllowedKeys)
                    .toArray();
            } else if (mode == "byProximity") {
                const viewportCenter = this.collage.getCoordsWithinCollageFromViewportPos(
                    new Position(this.windowWidth / 2, this.windowHeight / 2),
                    this.fullMapPos
                );
                const halfAScreen = new Dimensions(
                    // hack to make sure that we always consider the viewport to be
                    // zoomed out for this method (because we always use byIsland
                    // when zoomed in and so byProximity means we are either zoomed
                    // out or about to zoom out)
                    (this.screenSizeInBlockUnits.width / 2) * (this.zoomLevel == 0 ? 8 : 1),
                    (this.screenSizeInBlockUnits.height / 2) * (this.zoomLevel == 0 ? 8 : 1)
                );
                this.currentPointsOfInterest = (
                    await this.collage.pois
                        .where("[level+x+y]")
                        .between(
                            [
                                3,
                                viewportCenter.x - halfAScreen.width,
                                viewportCenter.y - halfAScreen.height
                            ],
                            [
                                3,
                                viewportCenter.x + halfAScreen.width,
                                viewportCenter.y + halfAScreen.height
                            ]
                        )
                        .toArray()
                ).filter(
                    poi =>
                        this.allowedPOITypes.includes(poi.type) &&
                        // redo y-tests because the Dexie query is not cooperating
                        poi.y > viewportCenter.y - halfAScreen.height &&
                        poi.y < viewportCenter.y + halfAScreen.height
                );
            } else {
                console.log("unsupported point of interest filtering mode:", mode);
            }
            console.log(
                "retrieved current pois. there are",
                this.currentPointsOfInterest.length,
                "of them"
            );
        },
        getSubMapImage(map, fullMapImage) {
            const subMap = document.createElement("canvas");
            subMap.width = 1024;
            subMap.height = 1024;
            subMap
                .getContext("2d")
                .drawImage(
                    fullMapImage,
                    map.x - this.collage.lowestMapCoords.x,
                    map.y - this.collage.lowestMapCoords.y,
                    1024,
                    1024,
                    0,
                    0,
                    1024,
                    1024
                );
            subMap.toBlob(blob => {
                this.subMapImages = { ...this.subMapImages, [map.file]: URL.createObjectURL(blob) };
            });
        }
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
                Math.floor(coordsWithinCollage.x / this.collage.getEdgeLength(this.zoomLevel)) *
                this.collage.getEdgeLength(this.zoomLevel);
            const mapY =
                Math.floor(coordsWithinCollage.y / this.collage.getEdgeLength(this.zoomLevel)) *
                this.collage.getEdgeLength(this.zoomLevel);
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
    watch: {
        outliningSubMaps(newValue, oldValue) {
            if (oldValue === false && newValue === true) {
                this.getCurrentPointsOfInterest("allIslands");
            }
        },
        allowedPOITypes() {
            this.getCurrentPointsOfInterest();
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
