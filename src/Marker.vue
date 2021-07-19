<template>
    <div
        class="mapMarker"
        :class="[
            displayingCaption ? 'displayingCaption' : '',
            clicked ? 'stayingOn' : '',
            iconLitUp ? 'litUp' : '',
        ]"
        :style="position.toCSS()"
        @mouseover="
            hovered = true;
            iconLitUp = true;
        "
        @mouseout="
            hovered = false;
            fading = true;
            iconLitUp = false;
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
        iconLitUp: false,
        markerIcons: {
            normal: "/marker.png",
            village: "/emerald.png",
            mining: "/pickaxe.png",
            monsters: "/sword.png",
            spawn: "/door2.png"
        },
        handleNonMarkerClick: null,
        captionPosClass: "topCaption",
        captionPosBBox: null,
        lastMouseDownFullMapPos: null,
        killSwitch: null
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
        },
        initiallyActive: {
            type: Boolean,
            required: false
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
                this.iconLitUp = false;
            }
        };
        this.trackMapPos = () => {
            this.lastMouseDownFullMapPos = this.fullMapPos;
        };
        this.killSwitch = () => {
            console.log("kill switch called");
            this.clicked = false;
            this.fading = true;
        };
        this.lastMouseDownFullMapPos = this.fullMapPos;
        if (this.initiallyActive) {
            this.clicked = true;
            this.iconLitUp = true;
        }
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
                    const topCollision = this.coverageIndex.search(captionBBox);
                    if (topCollision.length) {
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
                                if (this.coverageIndex.collides(captionBBox)) {
                                    captionPosClass = "topCaption";
                                    captionBBox = {
                                        minX: captionRect.left - this.fullMapPos.left,
                                        minY: captionRect.top - this.fullMapPos.top,
                                        maxX: captionRect.right - this.fullMapPos.left,
                                        maxY: captionRect.bottom - this.fullMapPos.top
                                    };
                                    for (const overlap of topCollision) {
                                        overlap.killSwitch();
                                    }
                                }
                            }
                        }
                    }
                }
                captionBBox = { ...captionBBox, killSwitch: this.killSwitch };
                this.coverageIndex.insert(captionBBox);
                this.captionPosBBox = captionBBox;
                this.captionPosClass = captionPosClass;
            } else if (!newValue && oldValue && this.captionPosBBox) {
                this.coverageIndex.remove(this.captionPosBBox);
                this.captionPosBBox = null;
            }
        }
    },
    beforeDestroy() {
        if (this.captionPosBBox) {
            this.coverageIndex.remove(this.captionPosBBox);
        }
    }
};
</script>
<style lang="scss" scoped>
// .mapMarker rules are in App.vue
.appZoomedIn .mapMarker {
    height: 40px;
    width: 40px;
}
.mapMarker.displayingCaption {
    opacity: 1;
}
.markerImage {
    transform: translate(-50%, -50%);
    height: 100%;
    width: 100%;
    position: absolute;
    z-index: 99;
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
    @media (max-aspect-ratio: 1/1) {
        font-size: 0.75em;
    }
    z-index: 100;
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
.mapMarker.stayingOn.litUp .caption {
    text-shadow: #fff 1px 0 10px;
}
</style>