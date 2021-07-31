import { PathData } from "../Types";

const paths: PathData[] = [
    new PathData("/oak_boat.png", [
        { x: 204, y: 157 },
        { x: 420, y: 250 },
        { x: 420, y: 508 },
        { x: 788, y: 508 }
    ]),
    new PathData("/minecart.png", [
        { x: -43, y: -57 },
        { x: -451, y: -57 },
        { x: -451, y: -193 },
        { x: -1195, y: -919 },
        { x: -1366, y: -919 }
    ]),
    new PathData("/cobblestone.png", [
        { x: -503, y: -57 },
        { x: -1106, y: -57 }
    ]),
    new PathData(
        "/lilypad.png",
        [
            { x: 654.42, y: 448.04 },
            { x: 589.75, y: 318.78 },
            { x: 719.08, y: 93.99 },
            { x: 1211.42, y: -258.88 },
            { x: 1679.8, y: -722.0 },
            { x: 2189.41, y: -1159.26 }
        ],
        true
    ),
    new PathData("/nether_oak_boat.png", [
        { x: 172, y: 53 },
        { x: 2311, y: 53 },
        { x: 2311, y: -1326 }
    ]),
    new PathData(
        "/nether_oak_boat.png",
        [
            { x: 2311, y: 53 },
            { x: 8950, y: -667 }
        ],
        true
    )
];

export default paths;
