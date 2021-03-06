import {
  Map,
  Corner,
  CornerType,
  PointOfInterest,
  Coords,
  Line,
  mod,
  Shape,
  getEdgeLength,
} from "./Types";

/**
 * objects of this class correspond to contiguous groups of maps. island objects
 * store references to the maps within them and Corner objects that implicitly define
 * their borders, which is useful for drawing borders around them and for restricting
 * map panning to the bounds of a particular island. the public static properties and
 * methods of the Island class can be used to look up what island a given map belongs
 * to on demand.
 */
export default class Island {
  private static idSource: number = 0;
  level: number;
  private maps: Set<Map> = new Set();

  minX: number = Infinity;
  minY: number = Infinity;
  maxX: number = -Infinity;
  maxY: number = -Infinity;

  id: number;

  // Islands should be understood as having references to points of interest, not as
  // owning them; multiple islands can share points of interest if the islands are of
  // maps at different zoom levels
  pointsOfInterest: PointOfInterest[] = [];

  // this stores strings created by the coordsToID method; its purpose is to allow
  // for quick (constant-time) checks to see whether a map with certain coords is
  // part of a specific island object or not
  private localMapIndex: Set<String> = new Set();

  // this stores the map corners that lie along an outer edge of the island. they are
  // stored in clockwise winding order. The borders of the island can be said to be
  // the lines lying between each "corner". This array is not populated until
  // findEdges is called
  corners: Corner[] = [];

  // this is null if findEdges has not yet been called
  islandShape: Shape | null = null;

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
    return getEdgeLength(this.level);
  }

  static globalMapIndex: Record<string, Island> = {};

  constructor(level: number) {
    this.id = Island.idSource++;

    this.level = level;

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

  private static coordsToID(coords: Coords): string {
    return coords.x + "," + coords.y;
  }

  private static globalCoordsToID(level: number, coords: Coords): string {
    return level + "," + Island.coordsToID(coords);
  }

  static getIslandContainingMap(mapLevel: number, mapCoords: Coords): Island {
    return Island.globalMapIndex[this.globalCoordsToID(mapLevel, mapCoords)];
  }

  addMap(map: Map): void {
    if (this.minX > map.x) {
      this.minX = map.x;
    }
    if (this.minY > map.y) {
      this.minY = map.y;
    }
    if (this.maxX < map.x + this.edgeLength) {
      this.maxX = map.x + this.edgeLength;
    }
    if (this.maxY < map.y + this.edgeLength) {
      this.maxY = map.y + this.edgeLength;
    }
    if (this.localMapIndex.has(Island.coordsToID(map))) {
      if (map.file === false) {
        return; // placeholder blank maps should not overwrite "real" ones
      } else {
        console.warn(
          "warning: double-adding map to island; god knows what happens now",
          map
        );
      }
    }
    this.maps.add(map);
    this.localMapIndex.add(Island.coordsToID(map));
    Island.globalMapIndex[Island.globalCoordsToID(this.level, map)] = this;
  }

  addMaps(maps: Iterable<Map>) {
    for (const map of maps) {
      this.addMap(map);
    }
  }

  addPOI(poi: PointOfInterest) {
    // to be extra safe, we could verify here that the point of interest actually
    // belongs on this island
    poi.isPartOfIsland(this);
    this.pointsOfInterest.push(poi);
  }

  connect(otherIsland: Island): Island {
    if (this.level !== otherIsland.level) {
      throw "trying to connect two islands with different zoom levels";
    }
    if (this.maps.size == 0 || otherIsland.maps.size == 0) {
      throw "trying to connect two islands where one has no maps";
    }
    if (this.islandShape || otherIsland.islandShape) {
      console.warn(
        "connecting two islands when one already has had its edges found; note that the result will Not have defined edges"
      );
    }
    const combo = new Island(this.level);
    combo.addMaps(this.maps);
    combo.addMaps(otherIsland.maps);

    // if the two islands are already touching, then no further action is necessary.

    const mapsToCheck =
      this.maps.size < otherIsland.maps.size ? this.maps : otherIsland.maps;
    const checkingAgainst =
      this.maps.size < otherIsland.maps.size
        ? otherIsland.localMapIndex
        : this.localMapIndex;
    for (const map of mapsToCheck) {
      if (checkingAgainst.has(Island.coordsToID(map))) {
        return combo;
      }
      // checking the bottom, then the right, then the top, then the left (arbitrary
      // order)
      const offsets = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ];
      for (const offset of offsets) {
        if (
          checkingAgainst.has(
            Island.coordsToID({ x: map.x + offset[0], y: map.y + offset[1] })
          )
        ) {
          return combo;
        }
      }
    }

    // create a "path" of empty maps connecting the two islands. it will emerge from
    // the center of the bounding box of "our" island, move right or left as
    // necessary, and then move up or down as necessary, in order to reach the center
    // of the bounding box of "their" island

    const ourXCenter = (this.minX + this.maxX) / 2;
    const ourYCenter = (this.minY + this.maxY) / 2;
    const ourCenterMapX =
      Math.floor(ourXCenter / this.edgeLength) * this.edgeLength;
    const ourCenterMapY =
      Math.floor(ourYCenter / this.edgeLength) * this.edgeLength;

    console.assert(
      this.localMapIndex.has(
        Island.coordsToID({ x: ourCenterMapX, y: ourCenterMapY })
      )
    );

    const theirXCenter = (otherIsland.minX + otherIsland.maxX) / 2;
    const theirYCenter = (otherIsland.minY + otherIsland.maxY) / 2;
    const theirCenterMapX =
      Math.floor(theirXCenter / otherIsland.edgeLength) *
      otherIsland.edgeLength;
    const theirCenterMapY =
      Math.floor(theirYCenter / otherIsland.edgeLength) *
      otherIsland.edgeLength;

    console.assert(
      otherIsland.localMapIndex.has(
        Island.coordsToID({ x: theirCenterMapX, y: theirCenterMapY })
      )
    );

    let penPositionX = ourCenterMapX;
    let penPositionY = ourCenterMapY;
    while (penPositionX < theirCenterMapX) {
      // blank maps that would "cover up" existing maps will automatically be ignored
      // by addMap
      combo.addMap({ x: penPositionX, y: penPositionY, file: false });
      penPositionX += this.edgeLength;
    }
    penPositionY += this.edgeLength;
    while (penPositionY < theirCenterMapY) {
      // blank maps that would "cover up" existing maps will automatically be ignored
      // by addMap
      combo.addMap({ x: penPositionX, y: penPositionY, file: false });
      penPositionY += this.edgeLength;
    }

    return combo;
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
        if (!this.localMapIndex.has(Island.coordsToID(coordsToCheck))) {
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

      // TODO: make this more comprehensible by using the principle that every sign
      // and direction arrangement that exists in a (clockwise, like our winding
      // order) walk around a square is a convex corner, and every one that isn't is
      // a concave corner
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

    // if there is an island like this:
    //  _________
    // |    |    |
    // |____|____|
    //      |    |
    //      |____|
    // we want the island shape to cut the convex corner located in the middle, so
    // that the user can go from the bottom right sub-map directly along the diagonal
    // to the top left sub-map. we could create a full-on convex hull, but it's
    // simpler just to make lines that skip the convex corners and thus only have
    // horizontal, vertical, or 45 degree angle lines.

    const shapeCorners = sortedCorners.filter(
      (c) => c.angle !== CornerType.Concave
    );
    const shapeLines = [];
    for (let i = 0; i < shapeCorners.length; i++) {
      const cornerFrom = shapeCorners[i];
      const cornerTo = shapeCorners[(i + 1) % shapeCorners.length];
      shapeLines.push(
        new Line(cornerFrom.x, cornerFrom.y, cornerTo.x, cornerTo.y)
      );
    }
    this.islandShape = Object.freeze(new Shape(shapeLines));
  }
}
