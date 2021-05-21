<template>
    <svg
        class="subMapOutlineOverlay"
        :viewBox="`0 0 ${viewBoxDimensions.x} ${viewBoxDimensions.y}`"
        xmlns="http://www.w3.org/2000/svg"
    >
        <text v-for="pos in getSubMapBorders()" :key="pos.id" v-bind="pos">
            {{ pos.text }}
        </text>
    </svg>
</template>

<script>
import MapCollage from "./MapCollage";
import { CornerType } from "./Types";
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
            return this.collage.subMapHasAdjacent(subMap, dx, dy, this.zoomLevel);
        },
        getSubMapBorders() {
            let i = 0;
            const corners = [];
            for (const island of this.collage.islands.level0) {
                for (const corner of island.corners) {
                    const cornerPos = this.collage.getMapPosWithinCollage(corner);
                    const type = CornerType[corner.angle];
                    corners.push({
                        text: i + " " + type,
                        id: i,
                        x: cornerPos._left,
                        y: cornerPos._top
                    });
                    i++;
                }
            }
            return corners;
        }
    },
    computed: {
        subMaps() {
            return this.collage.maps["level" + this.zoomLevel];
        }
    }
};
</script>