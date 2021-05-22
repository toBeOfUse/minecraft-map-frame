interface Coords {
  x: number;
  y: number;
}

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
  get x() {
    return this._left;
  }
  set x(newValue) {
    this._left = newValue;
  }
  get y() {
    return this._top;
  }
  set y(newValue) {
    this._top = newValue;
  }
}

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

interface Map {
  x: number;
  y: number;
  file: String;
}

class Island {
  private level: number;
  private maps: Set<Map>;
  private mapIndex: Set<String>;
  // this stores the map corners that lie along an outer edge of the island. they are
  // stored in clockwise winding order. The "edges" of the island can be said to be
  // the lines lying between each "corner".
  corners: Corner[];

  // the following two fields store coordinates that are meant to be used relative to
  // a map's base coordinates. the first stores the relative position of each corner
  // of the map (starting with the top left and going clockwise;) the second stores
  // the coords of the adjacent maps that, for each that does not exist, means that
  // the current map is on one of the edges of the island. the first entry stores the
  // coordinates to check to see if there is a map above the current map; the second
  // to the right, then below, then to the left. these fields are populated in the
  // constructor because we need to know what zoom level we are at before we can
  // create them. the "corners" field in coordsToCheckForEdges indicates the indices
  // of the corner coordinates in cornerOffsets that should be used to create the
  // corners for the currently-being-discovered edge.
  private cornerOffsets: Coords[];
  private coordsToCheckForEdges: {
    x: number;
    y: number;
    corners: [number, number];
  }[];

  get edgeLength() {
    return 128 * 2 ** this.level;
  }

  constructor(level: number) {
    this.level = level;
    this.maps = new Set();
    this.corners = [];
    this.mapIndex = new Set();

    // see lengthy explanation above (where these fields are declared)
    this.cornerOffsets = [
      { x: 0, y: 0 },
      { x: this.edgeLength, y: 0 },
      { x: this.edgeLength, y: this.edgeLength },
      { x: 0, y: this.edgeLength },
    ];

    this.coordsToCheckForEdges = [
      { x: 0, y: -this.edgeLength, corners: [0, 1] },
      { x: this.edgeLength, y: 0, corners: [1, 2] },
      { x: 0, y: this.edgeLength, corners: [2, 3] },
      { x: -this.edgeLength, y: 0, corners: [3, 0] },
    ];
  }

  private coordsToID(coords: Coords): string {
    return coords.x + "," + coords.y;
  }

  addMap(map: Map): void {
    this.maps.add(map);
    this.mapIndex.add(this.coordsToID(map));
  }

  addMaps(maps: Iterable<Map>) {
    for (const map of maps) {
      this.addMap(map);
    }
  }

  findEdges(): void {
    const edges: [Corner, Corner][] = [];
    for (const map of this.maps) {
      const cornerCoords = this.cornerOffsets.map((offset) => ({
        x: offset.x + map.x,
        y: offset.y + map.y,
      }));
      for (const offset of this.coordsToCheckForEdges) {
        const coordsToCheck = { x: offset.x + map.x, y: offset.y + map.y };
        if (!this.mapIndex.has(this.coordsToID(coordsToCheck))) {
          const corner1Coords = cornerCoords[offset.corners[0]];
          const corner1 = new Corner(corner1Coords.x, corner1Coords.y);

          const corner2Coords = cornerCoords[offset.corners[1]];
          const corner2 = new Corner(corner2Coords.x, corner2Coords.y);
          edges.push([corner1, corner2]);
        }
      }
    }

    const sortedCorners = [edges[0][0], edges[0][1]];
    while (sortedCorners.length < edges.length) {
      const lookingFor = sortedCorners[sortedCorners.length - 1];
      // optimization: we could index edges by their first corner and then use a
      // lookup to grab them instead of this brute force "find"
      const found = edges.find(
        (edge) => edge[0].x == lookingFor.x && edge[0].y == lookingFor.y
      );
      if (found) {
        sortedCorners.push(found[1]);
      } else {
        console.error("could not find corner to follow", lookingFor);
      }
    }

    const mod = (n: number, m: number) => ((n % m) + m) % m;

    for (let i = 0; i < sortedCorners.length; i++) {
      const corner0 = sortedCorners[mod(i - 1, sortedCorners.length)];
      const corner1 = sortedCorners[i];
      const corner2 = sortedCorners[mod(i + 1, sortedCorners.length)];

      interface VectorMeta {
        direction: keyof Coords;
        sign: number;
      }

      const v1 = { x: corner0.x - corner1.x, y: corner0.y - corner1.y };
      const v1meta: VectorMeta = {
        direction: (v1.x == 0 ? "y" : "x") as keyof typeof v1,
        sign: NaN,
      };
      v1meta.sign = Math.sign(v1[v1meta.direction]);

      const v2 = { x: corner2.x - corner1.x, y: corner2.y - corner1.y };
      const v2meta: VectorMeta = {
        direction: (v2.x == 0 ? "y" : "x") as keyof typeof v2,
        sign: NaN,
      };
      v2meta.sign = Math.sign(v2[v2meta.direction]);

      if (v1meta.direction == v2meta.direction) {
        corner1.angle = CornerType.Straight;
      } else if (v1meta.direction == "x" && v2meta.direction == "y") {
        if (v1meta.sign == v2meta.sign) {
          corner1.angle = CornerType.Concave;
        } else {
          corner1.angle = CornerType.Convex;
        }
      } else {
        if (v1meta.sign != v2meta.sign) {
          corner1.angle = CornerType.Concave;
        } else {
          corner1.angle = CornerType.Convex;
        }
      }
    }

    this.corners = sortedCorners;
  }
}

export {
  CSSDimensions,
  CSSPosition,
  Dimensions,
  Position,
  Map,
  Corner,
  CornerType,
  Island,
  Coords,
};
