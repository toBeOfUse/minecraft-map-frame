import { PathData } from "../Paths";

const paths: PathData[] = [
  new PathData(
    "nether_oak_boat.png",
    "#451952",
    [
      { x: 172, y: 53 },
      { x: 2311, y: 53 },
      { x: 2311, y: -1326 }
    ],
    false,
    true
  ),
  new PathData(
    "nether_oak_boat.png",
    "#451952",
    [
      { x: 2311, y: 53 },
      { x: 2800.98, y: 53 },
      { x: 2800, y: -177.09 },
      { x: 3800, y: -177.09 },
      { x: 3800, y: -667 },
      { x: 8950, y: -667 }
    ],
    false,
    true
  ),
  new PathData(
    "nether_oak_boat.png",
    "#451952",
    [
      {
        x: 2286.75,
        y: 39.38
      },
      {
        x: 2286.75,
        y: 799.14
      },
      {
        x: 1658.42,
        y: 799.14
      }
    ],
    false,
    true
  ),
  new PathData("oak_boat.png", "blue", [
    { x: 204, y: 157 },
    { x: 420, y: 250 },
    { x: 420, y: 508 },
    { x: 788, y: 508 }
  ]),
  new PathData("minecart.png", "lightgray", [
    { x: -43, y: -57 },
    { x: -451, y: -57 },
    { x: -451, y: -193 },
    { x: -1195, y: -919 },
    { x: -1366, y: -919 }
  ]),
  new PathData("cobblestone.png", "gray", [
    { x: -451, y: -57 },
    { x: -1106, y: -57 }
  ]),
  new PathData(
    "lilypad.png",
    "#258a40",
    [
      { x: 654.42, y: 448.04 },
      { x: 589.75, y: 318.78 },
      { x: 719.08, y: 93.99 },
      { x: 1211.42, y: -258.88 },
      { x: 1679.8, y: -722.0 },
      { x: 2147.84, y: -1120 },
      { x: 2317.2, y: -1153.1 },
      { x: 2351.07, y: -1216.22 }
    ],
    true
  )
];

export default paths;
