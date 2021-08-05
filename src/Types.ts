import type Island from "./Island";
import type { BBox } from "rbush";
import chroma from "chroma-js";
import { Bezier } from "bezier-js";

// simple cartesian grid types
interface CSSDimensions {
  width: string;
  height: string;
}

class Dimensions {
  _width: number;
  _height: number;
  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  toCSS(): CSSDimensions {
    return { width: this._width + "px", height: this._height + "px" };
  }
}

interface CSSPosition {
  left: string;
  top: string;
}

class Position {
  _left: number;
  _top: number;
  constructor(left: number, top: number) {
    this._left = left;
    this._top = top;
  }
  toCSS(): CSSPosition {
    return { top: this._top + "px", left: this._left + "px" };
  }
  asCoords(): Coords {
    return { x: this._left, y: this._top };
  }
  get left() {
    return this._left;
  }
  get top() {
    return this._top;
  }
}

interface Coords {
  x: number;
  y: number;
}

// types used by the Island class to draw borders around Island objects
enum CornerType {
  Unset,
  Straight,
  Concave,
  Convex,
}

class Corner {
  x: number;
  y: number;
  angle: CornerType;

  constructor(x: number, y: number) {
    this.angle = CornerType.Unset;
    this.x = x;
    this.y = y;
  }

  setCornerType(type: CornerType) {
    this.angle = type;
  }
}

class Line {
  // we need to be able to index our lines by their left-most x coordinate and by
  // their upper-most y coordinate, so these two numbers are ordered least to
  // greatest. (the second number in the tuple is there for the hasHeight and
  // hasWidth properties.)
  xRange: [number, number];
  yRange: [number, number];
  get hasWidth() {
    return this.xRange[0] !== this.xRange[1];
  }
  get hasHeight() {
    return this.yRange[0] !== this.yRange[1];
  }
  get width() {
    return this.xRange[1] - this.xRange[0];
  }
  get height() {
    return this.yRange[1] - this.yRange[0];
  }

  constructor(
    public x1: number,
    public y1: number,
    public x2: number,
    public y2: number
  ) {
    this.xRange = [Math.min(x1, x2), Math.max(x1, x2)];
    this.yRange = [Math.min(y1, y2), Math.max(y1, y2)];
  }
  // returns the x-coordinate of the point on the line segment that is on the
  // horizontal line for the given y-coordinate. returns NaN in the case of a
  // nonsensical query.
  xAt(y: number): number {
    if (!this.hasHeight || y < this.yRange[0] || y > this.yRange[1]) {
      return NaN;
    } else {
      // figure out how far along the line the given y coordinate places us, on a
      // scale from 0-1 (if the weight is 0, we are at the same vertical position as
      // the first point in the line; if the weight is 1, we are at the same vertical
      // position as the second point in the line; the rest of the possibilities
      // exist in between)
      const weight = Math.abs(y - this.y1) / this.height;
      // linearly interpolate between the x coordinates by applying the weight
      return this.x2 * weight + this.x1 * (1 - weight);
    }
  }
  yAt(x: number): number {
    if (!this.hasWidth || x < this.xRange[0] || x > this.xRange[1]) {
      return NaN;
    } else {
      const weight = Math.abs(x - this.x1) / this.width;
      return this.y2 * weight + this.y1 * (1 - weight);
    }
  }
}

class Shape {
  // xIndex allows you to look up horizontal and diagonal lines by their left-most x
  // coordinate, yielding an array of lines sorted by their upper-most y coordinate
  xIndex: Record<number, Line[]> = {};
  // yIndex allows you to look up vertical and diagonal lines by their upper-most y
  // coordinate, yielding an array of lines sorted by their left-most x coordinate
  yIndex: Record<number, Line[]> = {};
  constructor(public lines: Line[]) {
    for (const line of lines) {
      if (line.hasHeight) {
        if (line.yRange[0] in this.yIndex) {
          this.yIndex[line.yRange[0]].push(line);
          this.yIndex[line.yRange[0]].sort((a, b) => a.xRange[0] - b.xRange[0]);
        } else {
          this.yIndex[line.yRange[0]] = [line];
        }
      }

      if (line.hasWidth) {
        if (line.xRange[0] in this.xIndex) {
          this.xIndex[line.xRange[0]].push(line);
          this.xIndex[line.xRange[0]].sort((a, b) => a.yRange[0] - b.yRange[0]);
        } else {
          this.xIndex[line.xRange[0]] = [line];
        }
      }
    }
  }
}

// types to be rendered; based on the structure of the objects in the corresponding
// json files
interface Map {
  x: number;
  y: number;
  // maps with "false" files are used as empty placeholders when creating contiguous
  // "Islands"
  file: String | false;
}

enum POIType {
  Normal = "normal",
  Village = "village",
  Mining = "mining",
  Monsters = "monsters",
  Spawn = "spawn",
  Biome = "biome"
}

interface StoredPOI {
  x: number;
  y: number;
  text: String;
  type: POIType;
  pathMarker?: boolean;
}

class PointOfInterest {
  x: number;
  y: number;
  text: String;
  type: POIType;
  islandIDs: number[] = [];
  onlyLevel3: boolean = true;
  level: 0 | 3;
  id: number;
  pathMarker: boolean;

  private static idSource = 0;

  constructor(record: StoredPOI, level: 0 | 3) {
    this.x = record.x;
    this.y = record.y;
    this.text = record.text;
    this.type = record.type;
    this.level = level;
    this.pathMarker = record.pathMarker || false;
    this.id = PointOfInterest.idSource;
    PointOfInterest.idSource += 1;
  }

  isPartOfIsland(island: Island) {
    this.islandIDs.push(island.id);
    if (island.level != 3) {
      this.onlyLevel3 = false;
    }
  }
}

interface SVGPathComponent {
  getPointAt(t: number): Coords;
  asCommand(includeInitialMove: boolean): string;
  readonly length: number;
  p1: Coords;
  p2: Coords;
}

class SVGLineSegment implements SVGPathComponent {
  p1: Coords;
  p2: Coords;
  constructor(p1: Coords, p2: Coords) {
    this.p1 = p1;
    this.p2 = p2;
  }
  asCommand(includeInitialMove: boolean = false): string {
    return ((includeInitialMove ? `M ${this.p1.x} ${this.p1.y} ` : '') +
      `L ${this.p2.x} ${this.p2.y}`);
  }
  get length() {
    return distance(this.p1, this.p2);
  }
  getPointAt(t: number): Coords {
    if (t < 0 || t > 1) {
      throw "calling getPointAt in SVGLineSegment with invalid t: " + t;
    }
    return {
      x: this.p1.x + t * (this.p2.x - this.p1.x),
      y: this.p1.y + t * (this.p2.y - this.p1.y)
    }
  }
}

class SVGCurveSegment implements SVGPathComponent {
  p1: Coords;
  p2: Coords;
  controlPoint: Coords;
  curve: Bezier;
  constructor(p1: Coords, p2: Coords, controlPoint: Coords) {
    this.p1 = p1;
    this.p2 = p2;
    this.controlPoint = controlPoint;
    this.curve = new Bezier(p1, controlPoint, p2);
  }
  asCommand(includeInitialMove: boolean = false): string {
    return ((includeInitialMove ? `M ${this.p1.x} ${this.p1.y} ` : '') +
      `Q ${this.controlPoint.x} ${this.controlPoint.y} ${this.p2.x} ${this.p2.y}`);
  }
  get length() {
    return this.curve.length();
  }
  getPointAt(t: number): Coords {
    if (t < 0 || t > 1) {
      throw "calling getPointAt in SVGCurveSegment with invalid t: " + t;
    }
    return this.curve.get(t);
  }
}

class PathData {
  icon: string;
  points: Coords[];
  bounds: BBox = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  smoothed: boolean;
  color: string;
  svgComps: SVGPathComponent[];
  nether: boolean;

  constructor(icon: string, color: string, points: Coords[], smoothed = false, nether = false) {
    if (points.length < 1) {
      throw "Cannot initialize path with empty points array";
    }
    this.icon = icon;
    this.points = points;
    this.smoothed = smoothed;
    this.color = color;
    this.nether = nether;
    for (const point of points) {
      if (point.x < this.bounds.minX) {
        this.bounds.minX = point.x;
      }
      if (point.x > this.bounds.maxX) {
        this.bounds.maxX = point.x;
      }
      if (point.y < this.bounds.minY) {
        this.bounds.minY = point.y;
      }
      if (point.y > this.bounds.maxY) {
        this.bounds.maxY = point.y;
      }
    }
    this.svgComps = [];
    if (!smoothed) {
      for (let i = 0; i < points.length - 1; i++) {
        this.svgComps.push(new SVGLineSegment(points[i], points[i + 1]));
      }
    } else {
      let currentPoint = this.points[0];
      for (let i = 1; i < this.points.length - 1; i++) {
        const destinationPoint = this.points[i];
        const currentLineLength = distance(currentPoint, destinationPoint);
        const scaleThisLineBy = 1 - (40 / currentLineLength);
        const lineTo = {
          x: currentPoint.x + scaleThisLineBy * (destinationPoint.x - currentPoint.x),
          y: currentPoint.y + scaleThisLineBy * (destinationPoint.y - currentPoint.y)
        };
        this.svgComps.push(new SVGLineSegment(this.points[i - 1], lineTo));
        currentPoint = lineTo;
        const pointAfterDestination = this.points[i + 1];
        const nextLineLength = distance(destinationPoint, pointAfterDestination);
        const scaleNextLineBy = 40 / nextLineLength;
        const curveTo = {
          x: destinationPoint.x + scaleNextLineBy * (pointAfterDestination.x - destinationPoint.x),
          y: destinationPoint.y + scaleNextLineBy * (pointAfterDestination.y - destinationPoint.y)
        };
        this.svgComps.push(new SVGCurveSegment(currentPoint, curveTo, destinationPoint));
        currentPoint = curveTo;
      }
      const lastPoint = this.points[this.points.length - 1];
      this.svgComps.push(new SVGLineSegment(currentPoint, lastPoint));
    }
  }

  get length(): number {
    return this.svgComps.reduce((previous, current) => previous + current.length, 0);
  }

  toCommands(): string {
    return this.svgComps.map((c, i) => c.asCommand(i == 0)).join(" ");
  }

  getAccentPoints(spaceBetween: number): Coords[] {
    const result: Coords[] = [];

    if (!this.smoothed) {
      for (const comp of this.svgComps) {
        result.push(comp.p1);
        const extraPoints = Math.floor(comp.length / spaceBetween) - 1;
        if (extraPoints > 0) {
          const extraPointsLength = (extraPoints - 1) * spaceBetween;
          const startingDistance = (comp.length - extraPointsLength) / 2;
          const startingT = startingDistance / comp.length;
          for (let i = 0; i < extraPoints; i++) {
            result.push(comp.getPointAt(startingT + (i * spaceBetween / comp.length)));
          }
        }
        result.push(comp.p2);
      }
    } else {
      let currentCompIndex = 0;
      let lengthOfPreviousComps = 0;
      const howManyPoints = Math.floor(this.length / spaceBetween);
      for (let i = 0; i < howManyPoints; i++) {
        const t = i / howManyPoints;
        const lengthAtT = t * this.length;
        let currentComp = this.svgComps[currentCompIndex];
        let tForThisComp = (lengthAtT - lengthOfPreviousComps) / currentComp.length;
        while (tForThisComp > 1) {
          lengthOfPreviousComps += currentComp.length;
          currentCompIndex++;
          currentComp = this.svgComps[currentCompIndex];
          tForThisComp = (lengthAtT - lengthOfPreviousComps) / currentComp.length;
        }
        result.push(currentComp.getPointAt(tForThisComp));
      }
      result.push(this.points[this.points.length - 1]);
    }
    return result;
  }

  get darkColor(): string {
    return chroma(this.color).darken(2).hex();
  }

}

interface ItemsInLevel<Type extends Map | PointOfInterest | Island> {
  level: number;
  items: Type[];
}

// sigh
function clamp(input: number, min: number, max: number) {
  return Math.max(min, Math.min(input, max));
}

/**
 * modulus function that works for negative numbers
 */
function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

/**
 * our internal representation uses units where 128 units is equal to the length
 * of each edge of a level 0 map (just like in minecraft). this function returns
 * the length each edge of any map of any level in those units
 */
function getEdgeLength(level: number): number {
  return 128 * 2 ** level;
}

function distance(p1: Coords, p2: Coords) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

export {
  CSSDimensions,
  CSSPosition,
  Dimensions,
  Position,
  Map,
  Corner,
  CornerType,
  Coords,
  clamp,
  mod,
  getEdgeLength,
  distance,
  PointOfInterest,
  StoredPOI,
  POIType,
  Line,
  Shape,
  ItemsInLevel,
  PathData
};
