<template>
    <svg
        class="subMapOutlineOverlay"
        :viewBox="`0 0 ${viewBoxDimensions.x} ${viewBoxDimensions.y}`"
        xmlns="http://www.w3.org/2000/svg"
    >
        <template v-for="subMap in subMaps">
            <rect
                v-for="line in getSubMapBorders(subMap)"
                :key="subMap.file + line.id"
                v-bind="line"
            />
        </template>
    </svg>
</template>

<script>
import MapCollage from "./MapCollage";
export default {
    props: {
        collage: {
            type: MapCollage,
            required: true
        },
        zoomLevel: {
            type: Number,
            required: true
        },
        subMapBorderWidth: {
            type: Number,
            required: true
        }
    },
    data: () => ({
        viewBoxDimensions: { x: 0, y: 0 },
        subMapEdgeLength: 0
    }),
    created() {
        // the dimensions of the viewbox and the borders within it are frozen here at
        // component creation; to resize this component, alter its width and height
        // css properties from its parent component. Resizing the svg element this
        // way prevents weird artifacts during width and height transitions.
        this.viewBoxDimensions = {
            x: this.collage.fullMapDimensions._width + this.subMapBorderWidth * 2,
            y: this.collage.fullMapDimensions._height + this.subMapBorderWidth * 2
        };
        this.subMapEdgeLength =
            this.collage.getEdgeLength(this.zoomLevel) * this.collage.pxPerBlock;
    },
    methods: {
        subMapHasAdjacent(subMap, dx, dy) {
            // this method allows you to check if there is a map directly above (use
            // dy == -1), below (dy==1), to the left (dx==-1), or to the right (dx ==
            // 1) of another map.
            return this.collage.mapExistsAtRelativeTo(
                { x: subMap.x, y: subMap.y },
                {
                    x: dx * this.collage.getEdgeLength(this.zoomLevel),
                    y: dy * this.collage.getEdgeLength(this.zoomLevel)
                },
                this.zoomLevel
            );
        },
        getSubMapBorders(subMap) {
            const subMapPosLeftTop = this.collage.getMapPosWithinCollage(subMap);
            const subMapPos = { x: subMapPosLeftTop._left, y: subMapPosLeftTop._top };

            const lines = [];

            const workingEdgeLength = this.subMapEdgeLength;

            if (!this.subMapHasAdjacent(subMap, 0, -1)) {
                const topLine = {
                    id: subMap.file + "top",
                    width: workingEdgeLength + this.subMapBorderWidth * 2,
                    height: this.subMapBorderWidth,
                    ...subMapPos
                };
                // if there's a sub-map up and to the left that the top border could
                // intrude upon, don't extend it left:
                if (this.subMapHasAdjacent(subMap, -1, -1)) {
                    topLine.x += this.subMapBorderWidth;
                    topLine.width -= this.subMapBorderWidth;
                }
                // if there's a sub-map up and to the right that the top border could
                // intrude upon, don't extend it right:
                if (this.subMapHasAdjacent(subMap, 1, -1)) {
                    topLine.width -= this.subMapBorderWidth;
                }
                lines.push(topLine);
            }

            if (!this.subMapHasAdjacent(subMap, 0, 1)) {
                const bottomLine = {
                    id: subMap.file + "bottom",
                    width: workingEdgeLength + this.subMapBorderWidth * 2,
                    height: this.subMapBorderWidth,
                    x: subMapPos.x,
                    y: subMapPos.y + workingEdgeLength + this.subMapBorderWidth
                };
                // if there's a sub-map down and to the left that the bottom border could
                // intrude upon, don't extend it left:
                if (this.subMapHasAdjacent(subMap, -1, 1)) {
                    bottomLine.x += this.subMapBorderWidth;
                    bottomLine.width -= this.subMapBorderWidth;
                }
                // if there's a sub-map down and to the right that the bottom border could
                // intrude upon, don't extend it right:
                if (this.subMapHasAdjacent(subMap, 1, 1)) {
                    bottomLine.width -= this.subMapBorderWidth;
                }
                lines.push(bottomLine);
            }

            if (!this.subMapHasAdjacent(subMap, -1, 0)) {
                const leftLine = {
                    id: subMap.file + "left",
                    width: this.subMapBorderWidth,
                    height: workingEdgeLength + this.subMapBorderWidth * 2,
                    ...subMapPos
                };
                // if there's a sub-map up and to the left that the left border could
                // intrude upon, don't extend it up:
                if (this.subMapHasAdjacent(subMap, -1, -1)) {
                    leftLine.y += this.subMapBorderWidth;
                    leftLine.height -= this.subMapBorderWidth;
                }
                // if there's a sub-map down and to the left that the left border
                // could intrude upon, don't extend it down:
                if (this.subMapHasAdjacent(subMap, -1, 1)) {
                    leftLine.height -= this.subMapBorderWidth;
                }
                lines.push(leftLine);
            }

            if (!this.subMapHasAdjacent(subMap, 1, 0)) {
                const rightLine = {
                    id: subMap.file + "right",
                    width: this.subMapBorderWidth,
                    height: workingEdgeLength + this.subMapBorderWidth * 2,
                    x: subMapPos.x + workingEdgeLength + this.subMapBorderWidth,
                    y: subMapPos.y
                };
                // if there's a sub-map up and to the right that the right border could
                // intrude upon, don't extend it up:
                if (this.subMapHasAdjacent(subMap, 1, -1)) {
                    rightLine.y += this.subMapBorderWidth;
                    rightLine.height -= this.subMapBorderWidth;
                }
                // if there's a sub-map down and to the right that the right border
                // could intrude upon, don't extend it down:
                if (this.subMapHasAdjacent(subMap, 1, 1)) {
                    rightLine.height -= this.subMapBorderWidth;
                }
                lines.push(rightLine);
            }

            return lines;
        }
    },
    computed: {
        subMaps() {
            return this.collage.maps["level" + this.zoomLevel];
        }
    }
};
</script>