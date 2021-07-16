<template>
    <div
        class="mapMarker"
        :class="[displayingCaption ? 'displayingCaption' : '', clicked ? 'stayingOn' : '']"
        :style="position.toCSS()"
        @mouseover="hovered = true"
        @mouseout="
            hovered = false;
            fading = true;
        "
        @click="
            clicked = !clicked;
            if (!clicked) {
                hovered = false;
                fading = true;
            }
            $event.targetedMapMarker = true;
        "
        @transitionend="
            if (fading) {
                fading = false;
                reset();
            }
        "
    >
        <img :src="markerIcons[POI.type]" class="markerImage" ref="image" />
        <span class="caption" :class="captionPosClass" ref="caption">
            {{ POI.text }}
        </span>
    </div>
</template>
<script>
import RBush from "rbush";
import { PointOfInterest, Position } from "./Types";
export default {
    data: () => ({
        clicked: false,
        hovered: false,
        fading: false,
        markerIcons: {
            normal: "/marker.png",
            village: "/emerald.png"
        },
        handleNonMarkerClick: null,
        captionPosClass: "topCaption",
        captionPosBBox: null,
        lastMouseDownFullMapPos: null
    }),
    props: {
        POI: { type: PointOfInterest, required: true },
        position: {
            type: Position,
            required: true
        },
        fullMapPos: {
            type: Position,
            required: true
        },
        coverageIndex: {
            type: RBush,
            required: true
        }
    },
    created() {
        // create arrow functions unique to each instance of the component that will
        // be attached/removed as event listeners to the document body when
        // this.clicked changes so it can remove this element's "clicked" status
        // after a non-marker element is clicked if the map hasn't moved since the
        // last mousedown event (if the map has moved, then this "click" is actually
        // the result of panning)
        this.handleNonMarkerClick = event => {
            if (!event.targetedMapMarker && this.fullMapPos == this.lastMouseDownFullMapPos) {
                this.clicked = false;
            }
        };
        this.trackMapPos = () => {
            this.lastMouseDownFullMapPos = this.fullMapPos;
        };
        this.lastMouseDownFullMapPos = this.fullMapPos;
    },
    methods: {
        reset() {
            this.captionPosClass = "topCaption";
        }
    },
    computed: {
        displayingCaption() {
            return this.clicked || this.hovered;
        }
    },
    watch: {
        clicked(newValue) {
            if (newValue) {
                document.body.addEventListener("click", this.handleNonMarkerClick);
                document.body.addEventListener("mousedown", this.trackMapPos);
            } else {
                document.body.removeEventListener("click", this.handleNonMarkerClick);
                document.body.removeEventListener("mousedown", this.trackMapPos);
            }
        },
        displayingCaption(newValue, oldValue) {
            console.log("displayingCaption changing from", oldValue, "to", newValue);
            if (newValue && !oldValue) {
                this.fading = false;
                const captionRect = this.$refs.caption.getBoundingClientRect();
                const imageRect = this.$refs.image.getBoundingClientRect();
                let captionBBox = {
                    minX: captionRect.left - this.fullMapPos.left,
                    minY: captionRect.top - this.fullMapPos.top,
                    maxX: captionRect.right - this.fullMapPos.left,
                    maxY: captionRect.bottom - this.fullMapPos.top
                };
                const imageBBox = {
                    minX: imageRect.left - this.fullMapPos.left,
                    minY: imageRect.top - this.fullMapPos.top,
                    maxX: imageRect.right - this.fullMapPos.left,
                    maxY: imageRect.bottom - this.fullMapPos.top
                };
                let captionPosClass = this.captionPosClass;
                if (captionPosClass == "topCaption") {
                    // otherwise, the caption was brought back mid-way through
                    // fading out and we should just leave it for visual continuity
                    if (this.coverageIndex.collides(captionBBox)) {
                        captionPosClass = "rightCaption";
                        captionBBox = {
                            minX: imageBBox.maxX,
                            minY: imageBBox.minY + imageRect.height / 2 - captionRect.height / 2
                        };
                        captionBBox.maxX = captionBBox.minX + captionRect.width;
                        captionBBox.maxY = captionBBox.minY + captionRect.height;

                        if (this.coverageIndex.collides(captionBBox)) {
                            captionPosClass = "bottomCaption";
                            captionBBox = {
                                minX: imageBBox.minX + imageRect.width / 2 - captionRect.width / 2,
                                minY: imageBBox.maxY
                            };
                            captionBBox.maxX = captionBBox.minX + captionRect.width;
                            captionBBox.maxY = captionBBox.minY + captionRect.height;
                            if (this.coverageIndex.collides(captionBBox)) {
                                captionPosClass = "leftCaption";
                                captionBBox = {
                                    minX: imageBBox.minX - captionRect.width,
                                    minY:
                                        imageBBox.minY +
                                        imageRect.height / 2 -
                                        captionRect.height / 2
                                };
                                captionBBox.maxX = captionBBox.minX + captionRect.width;
                                captionBBox.maxY = captionBBox.minY + captionRect.height;
                            }
                        }
                    }
                }
                // captionBBox = { ...captionBBox, ref: this.$refs.caption }; // for debugging only
                this.coverageIndex.insert(captionBBox);
                console.log("items in coverage index", this.coverageIndex.all().length);
                this.captionPosBBox = captionBBox;
                this.captionPosClass = captionPosClass;
            } else if (!newValue && oldValue && this.captionPosBBox) {
                this.coverageIndex.remove(this.captionPosBBox);
                this.captionPosBBox = null;
                console.log("items in coverage index", this.coverageIndex.all().length);
            }
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
.mapMarker.displayingCaption {
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
    max-width: 125px;
    width: max-content;
    text-align: center;
    pointer-events: none;
    font-size: 0.8em;
}
.topCaption {
    left: 0;
    top: -50%;
    transform: translate(-50%, -100%);
}
.bottomCaption {
    left: 0;
    top: 50%;
    transform: translate(-50%, 0%);
}
.leftCaption {
    right: 150%;
    top: 0;
    transform: translate(0, -50%);
}
.rightCaption {
    left: 50%;
    top: 0;
    transform: translate(0, -50%);
}
.mapMarker.displayingCaption .caption {
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
    pointer-events: none;
    content: "";
}
.mapMarker.stayingOn:hover .caption {
    text-shadow: #fff 1px 0 10px;
}
</style>