<template>
    <svg
        id="subMapOutlineOverlay"
        :viewBox="`0 0 ${edgeLength + subMapBorderWidth * 2} ${edgeLength + subMapBorderWidth * 2}`"
        xmlns="http://www.w3.org/2000/svg"
        :style="{
            position: 'absolute',
            width: edgeLength + 2 * subMapBorderWidth + 'px',
            height: edgeLength + 2 * subMapBorderWidth + 'px',
        }"
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
export default {
    props: {
        edgeLength: {
            type: Number,
            required: true
        },
        // objects containing at least the keys "x", "y", and a "file" key that acts
        // as a unique id
        subMaps: {
            type: Array,
            required: true
        },
        subMapsPerMap: {
            type: Number,
            required: true
        },
        subMapBorderWidth: {
            type: Number,
            required: true
        }
    },
    methods: {
        subMapHasAdjacent(subMap, dx, dy) {
            // TODO: revist this
            return this.$parent.relativeCoordsMapExistsAt(subMap.x, subMap.y, dx, dy, 0);
        },
        getSubMapBorders(subMap) {
            const subMapPos = {
                x: subMap.x * this.subMapEdgeLength,
                y: subMap.y * this.subMapEdgeLength
            };

            const lines = [];

            if (!this.subMapHasAdjacent(subMap, 0, -1)) {
                const topLine = {
                    id: subMap.file + "top",
                    width: this.subMapEdgeLength + this.subMapBorderWidth * 2,
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
                    width: this.subMapEdgeLength + this.subMapBorderWidth * 2,
                    height: this.subMapBorderWidth,
                    x: subMapPos.x,
                    y: subMapPos.y + this.subMapEdgeLength + this.subMapBorderWidth
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
                    bottomLine.width -= this.subMapEdgeLength;
                }
                lines.push(bottomLine);
            }

            if (!this.subMapHasAdjacent(subMap, -1, 0)) {
                const leftLine = {
                    id: subMap.file + "left",
                    width: this.subMapBorderWidth,
                    height: this.subMapEdgeLength + this.subMapBorderWidth * 2,
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
                    height: this.subMapEdgeLength + this.subMapBorderWidth * 2,
                    x: subMapPos.x + this.subMapEdgeLength + this.subMapBorderWidth,
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
        subMapEdgeLength() {
            return this.edgeLength / Math.sqrt(this.subMapsPerMap);
        }
    }
};
</script>