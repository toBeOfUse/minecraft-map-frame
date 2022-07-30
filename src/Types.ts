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

interface Line {
  start: Coords;
  end: Coords;
}

interface StoredPolygon {
  segments: Line[];
}

interface StoredIsland {
  maps: Map[];
  scale: number;
  outline: StoredPolygon;
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
  collisionOutline: Line[];
  static mapIndex: Record<string, Island> = {};
  private static getMapIndexKey(level: number, topLeft: Coords) {
    return `${level}: (${topLeft.x}, ${topLeft.y})`;
  }
  constructor(record: StoredIsland) {
    this.level = record.scale;
    this.id = Island.idSource++;
    this.maps = record.maps;
    this.collisionOutline = record.outline.segments;
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
  StoredIsland
};
