import Island from "./Island";
import Vue, { PropType, VNode } from "vue";
import * as tsx from "vue-tsx-support";
import { ItemsInLevel, Coords, CornerType, getEdgeLength, Corner } from "./Types";

const IslandMask = tsx.component({
    name: "IslandMask",
    functional: true,
    props: {
        island: {
            required: true,
            type: Island
        },
        fill: {
            type: String,
            default: "black"
        },
        mask: {
            type: String,
            required: false,
            default: ""
        },
        margin: {
            type: Number,
            required: false,
            default: 0
        }
    },
    render: (createElement, context) => {
        const h = createElement;
        const i = context.props.island;
        const m = context.props.margin;
        const referencePoint = {
            x: (i.minX + i.minY) / 2,
            y: (i.minY + i.maxY) / 2
        };
        const adjustCoord = (coord: number, reference: number) =>
            coord < reference ? coord - m : coord + m;
        const adjustCorner = (corner: Corner): Coords => ({
            x: adjustCoord(corner.x, referencePoint.x),
            y: adjustCoord(corner.y, referencePoint.y)
        });
        return (
            <polygon
                fill={context.props.fill}
                points={i.corners
                    .map(c => adjustCorner(c))
                    .map(c => c.x + "," + c.y)
                    .join(" ")}
                mask={context.props.mask}
            />
        );
    }
});

const IslandOutline = tsx.component({
    name: "IslandOutline",
    functional: true,
    props: {
        island: {
            type: Island,
            required: true
        },
        outlineColor: {
            type: String,
            required: false,
            default: "black"
        },
        outlineWidth: {
            type: Number,
            default: 3
        }
    },
    render(createElement, context) {
        const corners = context.props.island.corners;
        const w = context.props.outlineWidth;
        const polys: VNode[] = [];
        for (let i = 0; i < corners.length; i++) {
            const cornerFrom = i == 0 ? corners[corners.length - 1] : corners[i - 1];
            const cornerTo = corners[i];
            const edgeAxis = cornerFrom.x == cornerTo.x ? "y" : "x";
            const edgeDirection = cornerTo[edgeAxis] < cornerFrom[edgeAxis] ? -w : w;
            const points: Coords[] = [cornerFrom, cornerTo];
            // to get the second two points, move the first ones "out" (along the
            // normal of the edge). then, if the angle is concave, move the second point
            // "back"; if it's convex, move the second point "forward;" and do the
            // opposite for the first point.
            const outAxis = edgeAxis == "x" ? "y" : "x";
            let outDirection;
            if (edgeAxis == "x" && edgeDirection == w) {
                outDirection = -w;
            } else if (edgeAxis == "y" && edgeDirection == w) {
                outDirection = w;
            } else if (edgeAxis == "x" && edgeDirection == -w) {
                outDirection = w;
            } else if (edgeAxis == "y" && edgeDirection == -w) {
                outDirection = -w;
            }
            const outOffset = { [outAxis]: outDirection, [edgeAxis]: 0 };
            const point3 = {
                x: cornerTo.x + Number(outOffset.x),
                y: cornerTo.y + Number(outOffset.y)
            };
            const point4 = {
                x: cornerFrom.x + Number(outOffset.x),
                y: cornerFrom.y + Number(outOffset.y)
            };
            if (cornerTo.angle == CornerType.Convex) {
                point3[edgeAxis] += edgeDirection;
            }
            if (cornerFrom.angle == CornerType.Convex) {
                point4[edgeAxis] += -edgeDirection;
            }
            points.push(point3);
            points.push(point4);
            polys.push(
                <polygon
                    fill={context.props.outlineColor}
                    points={points.map(p => p.x + "," + p.y).join(" ")}
                />
            );
        }
        return polys;
    }
});

const IslandBorder = tsx.component({
    name: "IslandBorder",
    functional: true,
    props: {
        island: {
            type: Island,
            required: true
        },
        top: {
            type: String,
            required: true
        },
        bottom: {
            type: String,
            required: true
        },
        left: {
            type: String,
            required: true
        },
        right: {
            type: String,
            required: true
        }
    },
    render(createElement, context) {
        const corners = context.props.island.corners;
        const border: VNode[] = [];
        for (let i = 0; i < corners.length; i++) {
            const cornerFrom = i == 0 ? corners[corners.length - 1] : corners[i - 1];
            const cornerTo = corners[i];
            const edgeAxis = cornerFrom.x == cornerTo.x ? "y" : "x";
            const edgeDirection = cornerTo[edgeAxis] < cornerFrom[edgeAxis] ? -1 : 1;
            const edgeWidth = Math.abs(cornerTo[edgeAxis] - cornerFrom[edgeAxis]);
            const imageBoxDimensions = { attrs: { width: edgeWidth, height: edgeWidth } };
            if (edgeAxis == "x") {
                if (edgeDirection == 1) {
                    border.push(
                        <image
                            href="borders/top.png"
                            x={cornerFrom.x}
                            y={cornerFrom.y - edgeWidth}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMinYMax"
                        />
                    );
                } else {
                    border.push(
                        <image
                            href="borders/bottom.png"
                            x={cornerTo.x}
                            y={cornerFrom.y}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMinYMin"
                        />
                    );
                }
            } else {
                if (edgeDirection == 1) {
                    border.push(
                        <image
                            href="borders/right.png"
                            x={cornerFrom.x}
                            y={cornerFrom.y}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMinYMin"
                        />
                    );
                } else {
                    border.push(
                        <image
                            href="borders/left.png"
                            x={cornerFrom.x - edgeWidth}
                            y={cornerTo.y}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMaxYMin"
                        />
                    );
                }
            }
        }
        return border;
    }
});

const SVGContainer = tsx.component({
    name: "SVGContainer",
    functional: true,
    props: {
        islands: {
            type: Array as () => ItemsInLevel<Island>[],
            required: true
        }
    },
    render(createElement, context) {
        const level3Island = context.props.islands[3].items[0];
        return (
            <svg
                id="overlay"
                xmlns="http://www.w3.org/2000/svg"
                viewBox={
                    `${level3Island.minX} ${level3Island.minY} ` +
                    `${level3Island.maxX - level3Island.minX} ${level3Island.maxY -
                        level3Island.minY}`
                }
                width="100%"
                height="100%"
                style="position: absolute; left: 0; top: 0; overflow: visible"
            >
                {context.children}
            </svg>
        );
    }
});

const MapUnderlay = tsx.component({
    name: "MapUnderlay",
    functional: true,
    props: {
        islands: {
            type: Array as () => ItemsInLevel<Island>[],
            required: true
        }
    },
    render(createElement, context) {
        return (
            <SVGContainer islands={context.props.islands}>
                <IslandMask island={context.props.islands[3].items[0]} fill="#D6BF97" margin={10} />
            </SVGContainer>
        );
    }
});

const MapOverlay = tsx.component({
    name: "MapOverlay",
    functional: true,
    props: {
        islands: {
            type: Array as () => ItemsInLevel<Island>[],
            required: true
        },
        outliningSubMaps: { type: Boolean, required: false, default: false },
        fadingOutBGMaps: { type: Boolean, required: false, default: true }
    },
    render(createElement, context) {
        const p = context.props;
        const level3Island = p.islands[3].items[0];
        const mask = [<IslandMask island={level3Island} fill="white" />];
        for (const island of p.islands[0].items) {
            mask.push(<IslandMask fill="black" island={island} />);
        }
        return (
            <SVGContainer islands={p.islands}>
                <mask id="level0Islands">{mask}</mask>
                {p.fadingOutBGMaps ? (
                    <IslandMask
                        island={level3Island}
                        fill="#ffffff44"
                        mask={p.outliningSubMaps ? "url(#level0Islands)" : ""}
                    />
                ) : null}
                {p.outliningSubMaps
                    ? p.islands[0].items.map(i => <IslandOutline island={i} />)
                    : null}
                <IslandBorder
                    island={p.islands[3].items[0]}
                    top="borders/top.png"
                    bottom="borders/bottom.png"
                    left="borders/left.png"
                    right="borders/right.png"
                />
            </SVGContainer>
        );
    }
});

export { MapOverlay, MapUnderlay };
