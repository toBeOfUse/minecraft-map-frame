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

enum SideOfLine {
  left,
  right,
  directlyOn
}

class Line {
  start: Coords;
  end: Coords;
  constructor(start: Coords, end: Coords) {
    this.start = start;
    this.end = end;
  }
  get aabb(): AABB {
    return AABB.fromPoints(this.start, this.end);
  }
  get standardForm(): { A: number; B: number; C: number } {
    const partial = {
      A: this.end.y - this.start.y,
      B: this.start.x - this.end.x
    };
    return {
      ...partial,
      C: partial.A * this.start.x + partial.B * this.start.y
    };
  }
  closestPointOn(point: Coords): Coords {
    function addCoords(a: Coords, b: Coords): Coords {
      return { x: a.x + b.x, y: a.y + b.y };
    }
    function subtractCoords(a: Coords, b: Coords): Coords {
      return { x: a.x - b.x, y: a.y - b.y };
    }

    const posVector = subtractCoords(this.end, this.start);
    const rotPosVector = { x: -posVector.y, y: posVector.x };
    const projLine = new Line(point, addCoords(point, rotPosVector));

    // https://www.topcoder.com/thrive/articles/Geometry%20Concepts%20part%202:%20%20Line%20Intersection%20and%20its%20Applications
    const l1 = this.standardForm;
    const l2 = projLine.standardForm;

    const det = l1.A * l2.B - l2.A * l1.B;
    if (det == 0) {
      return point;
    } else {
      const result = { x: (l2.B * l1.C - l1.B * l2.C) / det, y: (l1.A * l2.C - l2.A * l1.C) / det };
      if (this.aabb.pointOn(result)) {
        return result;
      } else {
        const d1 = distance(result, this.start);
        const d2 = distance(result, this.end);
        if (d1 < d2) {
          return this.start;
        } else {
          return this.end;
        }
      }
    }
  }
}

class AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  constructor(minX: number, maxX: number, minY: number, maxY: number) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }
  static fromPoints(...points: Coords[]) {
    const exes = points.map(p => p.x);
    const whys = points.map(p => p.y);
    return new AABB(Math.min(...exes), Math.max(...exes), Math.min(...whys), Math.max(...whys));
  }
  get width(): number {
    return this.maxX - this.minX;
  }
  get height(): number {
    return this.maxY - this.minY;
  }
  pointOn(point: Coords, tolerance = Number.EPSILON) {
    return (
      point.x + tolerance >= this.minX &&
      point.x - tolerance <= this.maxX &&
      point.y + tolerance >= this.minY &&
      point.y - tolerance <= this.maxY
    );
  }
}

interface Corner extends Coords {
  type: "convex" | "concave";
}

interface StoredIsland {
  maps: Map[];
  scale: number;
  outline: Corner[];
}

class IslandOutline {
  corners: readonly Corner[];
  collisionLines: readonly Line[];
  constructor(corners: Corner[], mapSideLength: number) {
    this.corners = Object.freeze(corners.map(c => Object.freeze(c)));
    const collisionPoints: Coords[] = [];
    for (let i = 0; i < corners.length; i++) {
      const corner = corners[i];
      if (corner.type == "convex") {
        collisionPoints.push(corner);
      } else {
        const prev = i == 0 ? corners.slice(-1)[0] : corners[i - 1];
        const after = corners[(i + 1) % corners.length];
        if (prev.type == "concave" || after.type == "concave") {
          // if we have multiple concave corners in a row, ignore them for
          // collision purposes (that would look something like this:
          //   _____
          //  |_    |
          //   _|   |
          //  |_____|. the collision polygon in this case would just be a square.)
          continue;
        }
        // cut out the concave corner. make a point one map side length further
        // towards the previous corner and then another point one map side length
        // further towards the next corner. if these points would be redundant,
        // don't make them.
        const prevDist = distance(prev, corner);
        const prevScaleFactor = (prevDist - mapSideLength) / prevDist;
        if (prevScaleFactor != 0) {
          const p1 = lerp(prev, corner, prevScaleFactor);
          collisionPoints.push({ x: Math.round(p1.x), y: Math.round(p1.y) });
        }
        const afterDist = distance(corner, after);
        const afterScaleFactor = mapSideLength / afterDist;
        if (afterScaleFactor != 1) {
          const p2 = lerp(corner, after, afterScaleFactor);
          collisionPoints.push({ x: Math.round(p2.x), y: Math.round(p2.y) });
        }
      }
    }
    const lines = [];
    for (let i = 0; i < collisionPoints.length; i++) {
      const from = i == 0 ? collisionPoints.slice(-1)[0] : collisionPoints[i - 1];
      const to = collisionPoints[i];
      lines.push(Object.freeze(new Line(from, to)));
    }
    this.collisionLines = Object.freeze(
      lines.map(l => Object.freeze(new Line(Object.freeze(l.start), Object.freeze(l.end))))
    );
  }
  /**
   * De-obfuscation of https://wrfranklin.org/Research/Short_Notes/pnpoly.html
   */
  pointIsInside(point: Coords): boolean {
    let inside = false;
    for (const line of this.collisionLines) {
      const inYRange = line.start.y > point.y != line.end.y > point.y;
      if (inYRange) {
        // any line segment with a y-range that encompasses point.y whose x when
        // y=point.y is greater than point.x counts as a collision.
        const toTheRight =
          point.x <
          ((line.end.x - line.start.x) * (point.y - line.start.y)) / (line.end.y - line.start.y) +
            line.start.x;
        if (toTheRight) {
          inside = !inside;
        }
      }
    }
    return inside;
  }
  keepPointInside(point: Coords): Coords {
    if (!this.pointIsInside(point)) {
      let minAdjustment = Infinity;
      let result: Coords | null = null;
      for (const line of this.collisionLines) {
        const newPoint = line.closestPointOn(point);
        const adjustmentSize = distance(point, newPoint);
        if (adjustmentSize < minAdjustment) {
          minAdjustment = adjustmentSize;
          result = newPoint;
        }
      }
      return result as Coords;
    } else {
      return point;
    }
  }
}

class Island {
  level: number;
  id: number;
  private static idSource: number = 0;
  maps: Map[];
  pointsOfInterest: PointOfInterest[] = [];
  minX: number = Infinity;
  maxX: number = -Infinity;
  minY: number = Infinity;
  maxY: number = -Infinity;
  outline: IslandOutline;
  static mapIndex: Record<string, Island> = {};
  private static getMapIndexKey(level: number, topLeft: Coords) {
    return `${level}: (${topLeft.x}, ${topLeft.y})`;
  }
  constructor(record: StoredIsland) {
    this.level = record.scale;
    this.id = Island.idSource++;
    this.maps = record.maps.map(m => Object.freeze(m));
    this.outline = new IslandOutline(record.outline, this.mapSideLength);
    for (const map of this.maps) {
      Island.mapIndex[Island.getMapIndexKey(this.level, map)] = this;
      this.minX = Math.min(this.minX, map.x);
      this.minY = Math.min(this.minY, map.y);
      this.maxX = Math.max(this.maxX, map.x + getEdgeLength(this.level));
      this.maxY = Math.max(this.maxY, map.y + getEdgeLength(this.level));
    }
  }
  addPOI(poi: PointOfInterest) {
    poi.setPartOfIsland(this);
    this.pointsOfInterest.push(poi);
  }
  static getIslandContainingMap(level: number, topLeft: Coords) {
    return Island.mapIndex[Island.getMapIndexKey(level, topLeft)];
  }
  pointInIsland(): boolean {
    return true;
  }
  get mapSideLength(): number {
    return getEdgeLength(this.level);
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

  setPartOfIsland(island: Island) {
    this.islandIDs.push(island.id);
    if (island.level != 3) {
      this.onlyLevel3 = false;
    }
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
 * linear interpolation between two points.
 * @param p1 point we are coming from
 * @param p2 point we are going to
 * @param weight the fraction of the total distance between the two points that
 * we want to cross, expressed in the range [0, 1]
 * @returns Coords for a point between p1 and p2
 */
function lerp(p1: Coords, p2: Coords, weight: number): Coords {
  return { x: p1.x * (1 - weight) + p2.x * weight, y: p1.y * (1 - weight) + p2.y * weight };
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
  Coords,
  clamp,
  mod,
  getEdgeLength,
  distance,
  PointOfInterest,
  StoredPOI,
  POIType,
  Line,
  ItemsInLevel,
  Island,
  StoredIsland,
  AABB
};
