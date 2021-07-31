import Island from "./Island";
import { VNode } from "vue";
import * as tsx from "vue-tsx-support";
import { ItemsInLevel, Coords, CornerType, Corner, PathData, Position } from "./Types";
import MapCollage from "./MapCollage";

const MAP_BG = "#D6BF97";

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
        // TODO: this method of adding a margin won't, like, work, if there are
        // horizontal lines going right below the reference point's y-level. and
        // stuff. how do ???
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
            // we are overlapping these svg images very slightly, by widening them, to
            // avoid the hairline cracks that appear between them in many browsers
            // and svg viewers :(
            const adjustedWidth = edgeWidth / 2 + 2;
            const cornerWidth = adjustedWidth / 6;
            const imageBoxDimensions = { attrs: { width: adjustedWidth, height: adjustedWidth } };
            const cornerBoxDimensions = {
                attrs: { width: cornerWidth + 1, height: cornerWidth + 1 }
            };
            if (edgeAxis == "x") {
                if (edgeDirection == 1) {
                    border.push(
                        <image
                            href="borders/top.png"
                            x={cornerFrom.x}
                            y={cornerFrom.y - adjustedWidth}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMinYMax"
                        />
                    );
                    border.push(
                        <image
                            href="borders/top.png"
                            x={cornerFrom.x + adjustedWidth - 1}
                            y={cornerFrom.y - adjustedWidth}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMinYMax"
                        />
                    );
                    if (cornerFrom.angle == CornerType.Convex) {
                        border.push(
                            <image
                                href="borders/topleft.png"
                                x={cornerFrom.x - cornerWidth}
                                y={cornerFrom.y - cornerWidth}
                                {...cornerBoxDimensions}
                                preserveAspectRatio="xMaxYMax"
                            />
                        );
                    } else if (cornerFrom.angle == CornerType.Concave) {
                        border.push(
                            <rect
                                x={cornerFrom.x}
                                y={cornerFrom.y - cornerWidth}
                                {...cornerBoxDimensions}
                                fill={MAP_BG}
                            />
                        );
                    }
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
                    border.push(
                        <image
                            href="borders/bottom.png"
                            x={cornerTo.x + adjustedWidth - 1}
                            y={cornerFrom.y}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMinYMin"
                        />
                    );
                    if (cornerFrom.angle == CornerType.Convex) {
                        border.push(
                            <image
                                href="borders/bottomright.png"
                                x={cornerFrom.x}
                                y={cornerFrom.y}
                                {...cornerBoxDimensions}
                                preserveAspectRatio="xMinYMin"
                            />
                        );
                    }
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
                    border.push(
                        <image
                            href="borders/right.png"
                            x={cornerFrom.x}
                            y={cornerFrom.y + adjustedWidth - 1}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMinYMin"
                        />
                    );
                    if (cornerFrom.angle == CornerType.Convex) {
                        border.push(
                            <image
                                href="borders/topright.png"
                                x={cornerFrom.x}
                                y={cornerFrom.y - cornerWidth}
                                {...cornerBoxDimensions}
                                preserveAspectRatio="xMinYMax"
                            />
                        );
                    }
                } else {
                    border.push(
                        <image
                            href="borders/left.png"
                            x={cornerFrom.x - adjustedWidth}
                            y={cornerTo.y}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMaxYMin"
                        />
                    );
                    border.push(
                        <image
                            href="borders/left.png"
                            x={cornerFrom.x - adjustedWidth}
                            y={cornerTo.y + adjustedWidth - 1}
                            {...imageBoxDimensions}
                            preserveAspectRatio="xMaxYMin"
                        />
                    );
                    if (cornerFrom.angle == CornerType.Convex) {
                        border.push(
                            <image
                                href="borders/bottomleft.png"
                                x={cornerFrom.x - cornerWidth}
                                y={cornerFrom.y}
                                {...cornerBoxDimensions}
                                preserveAspectRatio="xMaxYMax"
                            />
                        );
                    } else if (cornerFrom.angle == CornerType.Concave) {
                        border.push(
                            <rect
                                fill={MAP_BG}
                                x={cornerFrom.x - cornerWidth}
                                y={cornerFrom.y - cornerWidth}
                                {...cornerBoxDimensions}
                            />
                        );
                    }
                }
            }
        }
        return border;
    }
});

const MapPath = tsx.component({
    name: "MapPath",
    functional: true,
    props: {
        path: {
            type: PathData,
            required: true
        },
        pxPerBlock: {
            type: Number,
            required: true
        },
        position: {
            type: Object as () => Position,
            required: true
        }
    },
    render(createElement, context) {
        const path = context.props.path;
        const px = context.props.pxPerBlock;
        const width = (path.bounds.maxX - path.bounds.minX) * px;
        const height = (path.bounds.maxY - path.bounds.minY) * px;
        const points = path.length / 70;
        const iconSize = Math.min(px * 55, 33);
        return (
            <div
                class="path"
                style={{
                    position: "absolute",
                    width: width + "px",
                    height: height + "px",
                    ...context.props.position.toCSS()
                }}
            >
                {path.getPoints(points).map((p, i) => (
                    <img
                        width={iconSize}
                        height={iconSize}
                        src={path.icon}
                        style={{
                            position: "absolute",
                            left: (((p.x - path.bounds.minX) * px) / width) * 100 + "%",
                            top: (((p.y - path.bounds.minY) * px) / height) * 100 + "%",
                            pointerEvents: "none",
                            transform: "translate(-50%, -50%)",
                            transition: "left 100ms ease-in-out, top 100ms ease-in-out"
                        }}
                        key={i}
                    />
                ))}
            </div>
        );
    }
});

const SVGContainer = tsx.component({
    name: "SVGContainer",
    functional: true,
    props: {
        islands: {
            type: Array as () => ItemsInLevel<Island>[],
            required: true
        },
        id: {
            type: String,
            required: false
        }
    },
    render(createElement, context) {
        const level3Island = context.props.islands[3].items[0];
        return (
            <svg
                id={context.props.id}
                xmlns="http://www.w3.org/2000/svg"
                viewBox={
                    `${level3Island.minX} ${level3Island.minY} ` +
                    `${level3Island.maxX - level3Island.minX} ${level3Island.maxY -
                        level3Island.minY}`
                }
                width="100%"
                height="100%"
                style="position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none"
                shape-rendering="crispEdges"
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
        const p = context.props;
        return (
            <SVGContainer islands={p.islands} id="underlay">
                <IslandBorder
                    island={p.islands[3].items[0]}
                    top="borders/top.png"
                    bottom="borders/bottom.png"
                    left="borders/left.png"
                    right="borders/right.png"
                />
                <IslandMask island={p.islands[3].items[0]} fill={MAP_BG} margin={10} />
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
        paths: {
            type: Array as () => PathData[],
            required: false,
            default: []
        },
        outliningSubMaps: { type: Boolean, required: false, default: false },
        fadingOutBGMaps: { type: Boolean, required: false, default: true },
        highlightingPaths: { type: Boolean, required: false, default: false }
    },
    render(createElement, context) {
        const p = context.props;
        const level3Island = p.islands[3].items[0];
        const mask = [<IslandMask island={level3Island} fill="white" />];
        for (const island of p.islands[0].items) {
            mask.push(<IslandMask fill="black" island={island} />);
        }
        const pathMask = [<IslandMask island={level3Island} fill="white" />].concat(
            p.paths.map(path => (
                <path
                    stroke="black"
                    stroke-width="65"
                    fill="none"
                    d={
                        `M ${path.points[0].x},${path.points[0].y} ` +
                        path.points
                            .slice(1)
                            .map(p => `L ${p.x},${p.y}`)
                            .join(" ")
                    }
                    stroke-linejoin="round"
                    filter={path.smoothed ? "url(#blur)" : ""}
                />
            ))
        );
        return (
            <SVGContainer islands={p.islands} id="overlay">
                <defs>
                    <filter id="blur">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="15" />
                    </filter>
                    <mask id="level0Islands">{mask}</mask>
                    <mask id="paths">{pathMask}</mask>
                </defs>
                {p.fadingOutBGMaps ? (
                    <IslandMask
                        island={level3Island}
                        fill="#ffffff44"
                        mask={
                            p.outliningSubMaps
                                ? "url(#level0Islands)"
                                : p.highlightingPaths
                                ? "url(#paths)"
                                : ""
                        }
                    />
                ) : null}
                {p.outliningSubMaps
                    ? p.islands[0].items.map(i => <IslandOutline island={i} />)
                    : null}
            </SVGContainer>
        );
    }
});

const PathsOverlay = tsx.component({
    name: "PathsOverlay",
    props: {
        collage: {
            type: MapCollage,
            required: true
        },
        paths: {
            type: Array as () => PathData[],
            required: true
        }
    },
    functional: true,
    render(createElement, context) {
        const c = context.props.collage;
        return (
            <div
                id="pathsOverlay"
                style="position: absolute; left: 0; top: 0; width: 100%; height: 100%"
            >
                {context.props.paths.map(p => (
                    <MapPath
                        path={p}
                        pxPerBlock={c.pxPerBlock}
                        position={c.getPosWithinCollage({ x: p.bounds.minX, y: p.bounds.minY })}
                    />
                ))}
            </div>
        );
    }
});

export { MapOverlay, MapUnderlay, PathsOverlay };
