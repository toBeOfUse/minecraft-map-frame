import { VNode } from "vue";
import * as tsx from "vue-tsx-support";
import { ItemsInLevel, Coords, Island } from "./Types";
import { PathData, SVGCubicCurveSegment } from "./Paths";

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

    // a year plus later: look at the lines. find the normals. shift the lines
    // along the normals by the margin amount. treat overlapping points as the
    // same so the shape doesn't get pulled apart at convex corners.

    const maps = i.maps;

    // const referencePoint = {
    //   x: (i.minX + i.minY) / 2,
    //   y: (i.minY + i.maxY) / 2
    // };
    // // const adjustCoord = (coord: number, reference: number) =>
    // //   coord < reference ? coord - m : coord + m;
    // // const adjustCorner = (corner: Corner): Coords => ({
    // //   x: adjustCoord(corner.x, referencePoint.x),
    // //   y: adjustCoord(corner.y, referencePoint.y)
    // // });
    return maps.map(map => (
      <rect
        fill={context.props.fill}
        x={map.x - m / 2}
        y={map.y - m / 2}
        width={i.mapSideLength + m}
        height={i.mapSideLength + m}
        mask={context.props.mask}
      />
    ));
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
    // const corners = context.props.island.corners;
    const w = context.props.outlineWidth;

    return <IslandMask island={context.props.island} margin={w} mask={"url(#level0Islands)"} />;
    // const polys: VNode[] = [];
    // for (let i = 0; i < corners.length; i++) {
    //   const cornerFrom = i == 0 ? corners[corners.length - 1] : corners[i - 1];
    //   const cornerTo = corners[i];
    //   const edgeAxis = cornerFrom.x == cornerTo.x ? "y" : "x";
    //   const edgeDirection = cornerTo[edgeAxis] < cornerFrom[edgeAxis] ? -w : w;
    //   const points: Coords[] = [cornerFrom, cornerTo];
    //   // to get the second two points, move the first ones "out" (along the
    //   // normal of the edge). then, if the angle is concave, move the second point
    //   // "back"; if it's convex, move the second point "forward;" and do the
    //   // opposite for the first point.
    //   const outAxis = edgeAxis == "x" ? "y" : "x";
    //   let outDirection;
    //   if (edgeAxis == "x" && edgeDirection == w) {
    //     outDirection = -w;
    //   } else if (edgeAxis == "y" && edgeDirection == w) {
    //     outDirection = w;
    //   } else if (edgeAxis == "x" && edgeDirection == -w) {
    //     outDirection = w;
    //   } else if (edgeAxis == "y" && edgeDirection == -w) {
    //     outDirection = -w;
    //   }
    //   const outOffset = { [outAxis]: outDirection, [edgeAxis]: 0 };
    //   const point3 = {
    //     x: cornerTo.x + Number(outOffset.x),
    //     y: cornerTo.y + Number(outOffset.y)
    //   };
    //   const point4 = {
    //     x: cornerFrom.x + Number(outOffset.x),
    //     y: cornerFrom.y + Number(outOffset.y)
    //   };
    //   if (cornerTo.angle == CornerType.Convex) {
    //     point3[edgeAxis] += edgeDirection;
    //   }
    //   if (cornerFrom.angle == CornerType.Convex) {
    //     point4[edgeAxis] += -edgeDirection;
    //   }
    //   points.push(point3);
    //   points.push(point4);
    //   polys.push(
    //     <polygon
    //       fill={context.props.outlineColor}
    //       points={points.map(p => p.x + "," + p.y).join(" ")}
    //     />
    //   );
    // }
    // return polys;
  }
});

// const IslandBorder = tsx.component({
//   name: "IslandBorder",
//   functional: true,
//   props: {
//     island: {
//       type: Island,
//       required: true
//     },
//     top: {
//       type: String,
//       required: true
//     },
//     bottom: {
//       type: String,
//       required: true
//     },
//     left: {
//       type: String,
//       required: true
//     },
//     right: {
//       type: String,
//       required: true
//     }
//   },
//   render(createElement, context) {
//     const corners = context.props.island.corners;
//     const border: VNode[] = [];
//     for (let i = 0; i < corners.length; i++) {
//       const cornerFrom = i == 0 ? corners[corners.length - 1] : corners[i - 1];
//       const cornerTo = corners[i];
//       const edgeAxis = cornerFrom.x == cornerTo.x ? "y" : "x";
//       const edgeDirection = cornerTo[edgeAxis] < cornerFrom[edgeAxis] ? -1 : 1;
//       const edgeWidth = Math.abs(cornerTo[edgeAxis] - cornerFrom[edgeAxis]);
//       // we are overlapping these svg images very slightly, by widening them, to
//       // avoid the hairline cracks that appear between them in many browsers
//       // and svg viewers :(
//       const adjustedWidth = edgeWidth / 2 + 2;
//       const cornerWidth = adjustedWidth / 6;
//       const imageBoxDimensions = { attrs: { width: adjustedWidth, height: adjustedWidth } };
//       const cornerBoxDimensions = {
//         attrs: { width: cornerWidth + 1, height: cornerWidth + 1 }
//       };
//       if (edgeAxis == "x") {
//         if (edgeDirection == 1) {
//           border.push(
//             <image
//               href="borders/top.png"
//               x={cornerFrom.x}
//               y={cornerFrom.y - adjustedWidth}
//               {...imageBoxDimensions}
//               preserveAspectRatio="xMinYMax"
//             />
//           );
//           border.push(
//             <image
//               href="borders/top.png"
//               x={cornerFrom.x + adjustedWidth - 1}
//               y={cornerFrom.y - adjustedWidth}
//               {...imageBoxDimensions}
//               preserveAspectRatio="xMinYMax"
//             />
//           );
//           if (cornerFrom.angle == CornerType.Convex) {
//             border.push(
//               <image
//                 href="borders/topleft.png"
//                 x={cornerFrom.x - cornerWidth}
//                 y={cornerFrom.y - cornerWidth}
//                 {...cornerBoxDimensions}
//                 preserveAspectRatio="xMaxYMax"
//               />
//             );
//           } else if (cornerFrom.angle == CornerType.Concave) {
//             border.push(
//               <rect
//                 x={cornerFrom.x}
//                 y={cornerFrom.y - cornerWidth}
//                 {...cornerBoxDimensions}
//                 fill={MAP_BG}
//               />
//             );
//           }
//         } else {
//           border.push(
//             <image
//               href="borders/bottom.png"
//               x={cornerTo.x}
//               y={cornerFrom.y}
//               {...imageBoxDimensions}
//               preserveAspectRatio="xMinYMin"
//             />
//           );
//           border.push(
//             <image
//               href="borders/bottom.png"
//               x={cornerTo.x + adjustedWidth - 1}
//               y={cornerFrom.y}
//               {...imageBoxDimensions}
//               preserveAspectRatio="xMinYMin"
//             />
//           );
//           if (cornerFrom.angle == CornerType.Convex) {
//             border.push(
//               <image
//                 href="borders/bottomright.png"
//                 x={cornerFrom.x}
//                 y={cornerFrom.y}
//                 {...cornerBoxDimensions}
//                 preserveAspectRatio="xMinYMin"
//               />
//             );
//           }
//         }
//       } else {
//         if (edgeDirection == 1) {
//           border.push(
//             <image
//               href="borders/right.png"
//               x={cornerFrom.x}
//               y={cornerFrom.y}
//               {...imageBoxDimensions}
//               preserveAspectRatio="xMinYMin"
//             />
//           );
//           border.push(
//             <image
//               href="borders/right.png"
//               x={cornerFrom.x}
//               y={cornerFrom.y + adjustedWidth - 1}
//               {...imageBoxDimensions}
//               preserveAspectRatio="xMinYMin"
//             />
//           );
//           if (cornerFrom.angle == CornerType.Convex) {
//             border.push(
//               <image
//                 href="borders/topright.png"
//                 x={cornerFrom.x}
//                 y={cornerFrom.y - cornerWidth}
//                 {...cornerBoxDimensions}
//                 preserveAspectRatio="xMinYMax"
//               />
//             );
//           }
//         } else {
//           border.push(
//             <image
//               href="borders/left.png"
//               x={cornerFrom.x - adjustedWidth}
//               y={cornerTo.y}
//               {...imageBoxDimensions}
//               preserveAspectRatio="xMaxYMin"
//             />
//           );
//           border.push(
//             <image
//               href="borders/left.png"
//               x={cornerFrom.x - adjustedWidth}
//               y={cornerTo.y + adjustedWidth - 1}
//               {...imageBoxDimensions}
//               preserveAspectRatio="xMaxYMin"
//             />
//           );
//           if (cornerFrom.angle == CornerType.Convex) {
//             border.push(
//               <image
//                 href="borders/bottomleft.png"
//                 x={cornerFrom.x - cornerWidth}
//                 y={cornerFrom.y}
//                 {...cornerBoxDimensions}
//                 preserveAspectRatio="xMaxYMax"
//               />
//             );
//           } else if (cornerFrom.angle == CornerType.Concave) {
//             border.push(
//               <rect
//                 fill={MAP_BG}
//                 x={cornerFrom.x - cornerWidth}
//                 y={cornerFrom.y - cornerWidth}
//                 {...cornerBoxDimensions}
//               />
//             );
//           }
//         }
//       }
//     }
//     return border;
//   }
// });

const MapPath = tsx.component({
  name: "MapPath",
  functional: true,
  props: {
    path: {
      type: PathData,
      required: true
    }
  },
  render(createElement, context) {
    const path = context.props.path;
    const pathWidth = 25; // width of the path including the outline
    const outlineWidth = 5;
    const circleRadius = 25;
    const iconWidth = 40;
    if (path.nether) {
      return (
        <path
          fill="none"
          stroke={path.color}
          opacity="0.4"
          stroke-width={pathWidth * 3}
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#netherBlur)"
          d={path.toCommands()}
        />
      );
    }
    const debug = [];
    if (path.svgComps[1] instanceof SVGCubicCurveSegment) {
      for (const point of path.points) {
        debug.push(<circle cx={point.x} cy={point.y} r="5" fill="red" opacity="0.6" />);
      }
      const comps = path.svgComps.slice(1, -1) as SVGCubicCurveSegment[];
      for (const comp of comps) {
        debug.push(<circle cx={comp.c1.x} cy={comp.c1.y} r="5" fill="black" opacity="0.6" />);
        debug.push(<circle cx={comp.c2.x} cy={comp.c2.y} r="5" fill="blue" opacity="0.6" />);
      }
    }
    return [
      <path
        fill="none"
        stroke={path.darkColor}
        stroke-width={pathWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
        d={path.toCommands()}
      />,
      ...path
        .getAccentPoints(200)
        .map(p => (
          <circle
            cx={p.x}
            cy={p.y}
            r={circleRadius}
            fill={path.color}
            stroke={path.darkColor}
            stroke-width={outlineWidth / 2}
          />
        )),
      <path
        fill="none"
        stroke={path.color}
        stroke-width={pathWidth - outlineWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
        d={path.toCommands()}
      />,
      ...path
        .getAccentPoints(200)
        .map(p => (
          <image
            href={path.icon}
            x={p.x - iconWidth / 2}
            y={p.y - iconWidth / 2}
            width={iconWidth}
            height={iconWidth}
          />
        ))
      // ...debug
    ];
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
    const level3Island = [...context.props.islands[3].items].sort(
      (a, b) => b.maps.length - a.maps.length
    )[0];
    return (
      <svg
        id={context.props.id}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={
          `${level3Island.minX} ${level3Island.minY} ` +
          `${level3Island.maxX - level3Island.minX} ${level3Island.maxY - level3Island.minY}`
        }
        width="100%"
        height="100%"
        style="position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none"
      >
        {context.children}
      </svg>
    );
  }
});

// const MapUnderlay = tsx.component({
//   name: "MapUnderlay",
//   functional: true,
//   props: {
//     islands: {
//       type: Array as () => ItemsInLevel<Island>[],
//       required: true
//     }
//   },
//   render(createElement, context) {
//     const p = context.props;
//     return (
//       <SVGContainer islands={p.islands} id="underlay">
//         <IslandBorder
//           island={p.islands[3].items[0]}
//           top="borders/top.png"
//           bottom="borders/bottom.png"
//           left="borders/left.png"
//           right="borders/right.png"
//         />
//         <IslandMask island={p.islands[3].items[0]} fill={MAP_BG} margin={10} />
//       </SVGContainer>
//     );
//   }
// });

const overlayCache = {
  mask: undefined as undefined | VueTsxSupport.JSX.Element[],
  outlines: undefined as undefined | VueTsxSupport.JSX.Element[],
  paths: undefined as undefined | VueTsxSupport.JSX.Element[]
};

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
    const level3Island = [...p.islands[3].items].sort((a, b) => b.maps.length - a.maps.length)[0];
    if (!overlayCache.mask) {
      const mask = [<IslandMask island={level3Island} fill="white" />];
      for (const island of p.islands[0].items) {
        mask.push(<IslandMask fill="black" island={island} />);
      }
      overlayCache.mask = mask;
    }

    if (!overlayCache.outlines) {
      overlayCache.outlines = p.islands[0].items.map(i => (
        <IslandOutline island={i} outlineWidth={10} />
      ));
    }

    if (!overlayCache.paths) {
      overlayCache.paths = context.props.paths.map(p => <MapPath path={p} />);
    }

    return (
      <SVGContainer islands={p.islands} id="overlay">
        <defs>
          <mask id="level0Islands">{overlayCache.mask}</mask>
          <filter id="netherBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
          </filter>
        </defs>
        {p.fadingOutBGMaps ? (
          <IslandMask
            island={level3Island}
            fill="#ffffff44"
            mask={p.outliningSubMaps ? "url(#level0Islands)" : ""}
          />
        ) : null}
        {p.outliningSubMaps ? overlayCache.outlines : null}
        {p.highlightingPaths ? overlayCache.paths : null}
        {/* stronghold zones: <circle
                    cx="64"
                    cy="64"
                    r="2048"
                    stroke="#aaaaaaaa"
                    stroke-width="768"
                    fill="transparent"
                />
                <circle
                    cx="64"
                    cy="64"
                    r="5120"
                    stroke="#aaaaaaaa"
                    stroke-width="768"
                    fill="transparent"
                />
                <circle
                    cx="64"
                    cy="64"
                    r="8192"
                    stroke="#aaaaaaaa"
                    stroke-width="768"
                    fill="transparent"
                />
                <circle
                    cx="64"
                    cy="64"
                    r="11264"
                    stroke="#aaaaaaaa"
                    stroke-width="768"
                    fill="transparent"
                /> */}
      </SVGContainer>
    );
  }
});

export { MapOverlay }; //, MapUnderlay };
