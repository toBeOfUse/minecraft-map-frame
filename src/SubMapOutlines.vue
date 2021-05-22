<template>
    <svg
        class="subMapOutlineOverlay"
        :viewBox="`0 0 ${viewBoxDimensions.width} ${viewBoxDimensions.height}`"
        xmlns="http://www.w3.org/2000/svg"
    >
        <rect v-for="pos in getSubMapBorders()" :key="pos.id" v-bind="pos" />
    </svg>
</template>

<script lang="ts">
import Vue from "vue";
import MapCollage from "./MapCollage";
import { Dimensions, Map, Coords, Position, CornerType } from "./Types";
const comp = Vue.extend({
    name: "SubMapOutlines",
    props: {
        collage: {
            type: MapCollage,
            required: true,
        },
        zoomLevel: {
            type: Number,
            required: true,
        },
        subMapBorderWidth: {
            type: Number,
            required: true,
        },
    },
    data() {
        return {
            viewBoxDimensions: {} as Dimensions,
            subMapEdgeLength: 0 as number,
        };
    },
    created(): void {
        // the dimensions of the viewbox and the borders within it are frozen here at
        // component creation; to resize this component, alter its width and height
        // css properties from its parent component. Resizing the svg element this
        // way prevents weird artifacts during width and height transitions.
        this.viewBoxDimensions = new Dimensions(
            this.collage.fullMapDimensions.width + this.subMapBorderWidth * 2,
            this.collage.fullMapDimensions.height + this.subMapBorderWidth * 2
        );
        this.subMapEdgeLength =
            this.collage.getEdgeLength(this.zoomLevel) * this.collage.pxPerBlock;
        // TODO: freeze the results of calling getPosWithinCollage with all the
        // available corners; then use that data during getSubMapBorders
    },
    methods: {
        subMapHasAdjacent(subMap: Map, dx: number, dy: number): boolean {
            // this method allows you to check if there is a map directly above (use
            // dy == -1), below (dy==1), to the left (dx==-1), or to the right (dx ==
            // 1) of another map.
            return this.collage.subMapHasAdjacent(subMap, dx, dy, this.zoomLevel);
        },
        getSubMapBorders() {
            let cornerCount = 0;
            const lines = [];
            for (const island of this.collage.islands.level0) {
                for (let i = 0; i < island.corners.length; i++) {
                    const cornerFrom = island.corners[i];
                    const cornerTo = island.corners[(i + 1) % island.corners.length];
                    const mainAxis = cornerFrom.x == cornerTo.x ? "y" : "x";
                    const direction = Math.sign(cornerTo[mainAxis] - cornerFrom[mainAxis]);
                    // counterclockwise circle of cardinal vector directions in the
                    // browser (and minecraft map) coordinate system
                    const circleOfVectors = ["+x", "-y", "-x", "+y"];
                    // the normal vector points *out* from the map/edge that it's
                    // attached to; we only care about its general direction; it can
                    // be found by rotating the vector that the edge forms around the
                    // given circle of vectors
                    const normalVector =
                        circleOfVectors[
                            (circleOfVectors.indexOf((direction > 0 ? "+" : "-") + mainAxis) + 1) %
                                circleOfVectors.length
                        ];

                    const normalVectorAxis = normalVector.substring(1) as keyof Coords;
                    const normalVectorDirection = parseInt(normalVector.substring(0, 1) + "1");

                    const innerBorder = [
                        this.collage.getPosWithinCollage(cornerFrom).asCoords(),
                        this.collage.getPosWithinCollage(cornerTo).asCoords(),
                    ];

                    // adjust for the fact that the outline overlay svg extends
                    // towards the left and towards the top of the underlying map by
                    // this.subMapBorderWidth px (so that it could display borders to
                    // the left of and above every map)
                    innerBorder[0].x += this.subMapBorderWidth;
                    innerBorder[0].y += this.subMapBorderWidth;
                    innerBorder[1].x += this.subMapBorderWidth;
                    innerBorder[1].y += this.subMapBorderWidth;

                    // deep copy the inner border, and then translate it by
                    // this.subMapBorderWidth px in the direction of the normal
                    // vector
                    const outerBorder = [
                        new Position(innerBorder[0].x, innerBorder[0].y).asCoords(),
                        new Position(innerBorder[1].x, innerBorder[1].y).asCoords(),
                    ];
                    outerBorder[0][normalVectorAxis] +=
                        normalVectorDirection * this.subMapBorderWidth;
                    outerBorder[1][normalVectorAxis] +=
                        normalVectorDirection * this.subMapBorderWidth;

                    // if the corner we're drawing the line To is convex, extend it
                    // out a little further along the direction that the edge is in
                    // to cover the corner
                    if (cornerTo.angle == CornerType.Convex) {
                        outerBorder[1][mainAxis] += direction * this.subMapBorderWidth;
                        innerBorder[1][mainAxis] += direction * this.subMapBorderWidth;
                    }

                    // find the point at the top left of our border rectangle (lowest
                    // x, lowest y) and the point at the bottom right (highest x,
                    // highest y)
                    const x1 = Math.min(
                        ...innerBorder.map((c) => c.x),
                        ...outerBorder.map((c) => c.x)
                    );
                    const y1 = Math.min(
                        ...innerBorder.map((c) => c.y),
                        ...outerBorder.map((c) => c.y)
                    );
                    const x2 = Math.max(
                        ...innerBorder.map((c) => c.x),
                        ...outerBorder.map((c) => c.x)
                    );
                    const y2 = Math.max(
                        ...innerBorder.map((c) => c.y),
                        ...outerBorder.map((c) => c.y)
                    );

                    lines.push({
                        id: cornerCount,
                        x: x1,
                        y: y1,
                        width: x2 - x1,
                        height: y2 - y1,
                    });
                    cornerCount++;
                }
            }
            return lines;
        },
    },
    computed: {
        subMaps(): Map[] {
            if (this.zoomLevel == 0) {
                return this.collage.maps.level0;
            } else {
                return this.collage.maps.level3;
            }
        },
    },
});
export default comp;
</script>