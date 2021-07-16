<template>
    <div
        class="mapMarker"
        :class="litUp ? 'litUp' : ''"
        :style="position"
        @mouseover="hovered = true"
        @mouseout="hovered = false"
        @click="
            clicked = !clicked;
            if (!clicked) hovered = false;
        "
    >
        <img :src="markerIcons[POI.type]" class="markerImage" />
        <span class="caption">
            {{ POI.text }}
        </span>
    </div>
</template>
<script>
import { PointOfInterest } from "./Types";
export default {
    data: () => ({
        clicked: false,
        hovered: false,
        markerIcons: {
            normal: "/marker.png",
            village: "/emerald.png"
        },
        console
    }),
    props: {
        POI: { type: PointOfInterest, required: true },
        position: {
            required: true
        }
    },
    computed: {
        litUp() {
            return this.clicked || this.hovered;
        }
    }
};
</script>
<style lang="scss" scoped>
@mixin standard-transitions {
    transition-duration: 1s;
    transition-property: width, height, left, top, opacity, visibility;
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
.mapMarker.litUp {
    opacity: 1;
    z-index: 10;
}
.markerImage {
    transform: translate(-50%, -50%);
    height: 100%;
    width: 100%;
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
.mapMarker.litUp .caption {
    opacity: 1;
}
.mapMarker.litUp::after {
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
    pointer-events: none;
    content: "";
}
</style>