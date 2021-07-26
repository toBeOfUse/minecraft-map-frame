import Island from "./Island";
import Vue, { PropType, VNode } from "vue";
import * as tsx from 'vue-tsx-support'
import { ItemsInLevel } from "./Types";

const IslandMask = tsx.component({
    name: "IslandMask",
    functional: true,
    props: {
        island: {
            required: true,
            type: Island,
        },
        fill: {
            type: String,
            default: "black",
        },
        mask: {
            type: String,
            required: false,
            default: ""
        }
    },
    render: (createElement, context) => {
        const h = createElement;
        return (
            <polygon
                fill={context.props.fill}
                points={context.props.island.corners
                    .map((c) => c.x + "," + c.y)
                    .join(" ")}
                mask={context.props.mask}
            />
        );
    },
});

const MapOverlay = tsx.component({
    name: "MapOverlay",
    functional: true,
    props: {
        islands: { type: Array as () => ItemsInLevel<Island>[], required: true },
        outliningSubMaps: { type: Boolean, required: false, default: false }
    },
    render(createElement, context) {
        const p = context.props;
        const level3Island = p.islands[3].items[0];
        const mask = [<IslandMask island={level3Island} fill="white" />]
        for (const island of p.islands[0].items) {
            mask.push(<IslandMask fill="black" island={island} />)
        }
        return <svg
            id="overlay"
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${level3Island.minX} ${level3Island.minY} ` +
                `${level3Island.maxX - level3Island.minX} ${level3Island.maxY - level3Island.minY}`}
            width="100%"
            height="100%"
            style="position: absolute; left: 0; top: 0"
        >
            <mask id="level0Islands">
                {mask}
            </mask>
            <IslandMask island={level3Island} fill="#ffffff44" mask={p.outliningSubMaps ? 'url(#level0Islands)' : ''} />
        </svg>;
    }
})

export default MapOverlay;
