import {
  PointOfInterest,
  Dimensions,
  Position,
  Map,
  Island,
  Coords,
} from "./Types";

import Dexie from "dexie";

interface MapsByLevel {
  level0: Map[];
  level3: Map[];
}

interface IslandsByLevel {
  level0: Island[];
  level3: Island[];
}

interface ScaleInfo {
  mapLevel: number;
  edgeLengthPx: number;
}

class POIDB extends Dexie {
  public POIs: Dexie.Table<PointOfInterest, number>;
  constructor() {
    super("POIDB");
    this.version(3).stores({
      POIs: "++id,[level+x+y],type,island",
    });
    this.POIs = this.table("POIs");
    // clear out old pois from previous sessions
    this.transaction("rw", this.POIs, () => {
      this.POIs.toCollection().eachPrimaryKey((pk) => {
        this.POIs.delete(pk);
      });
    });
  }
}

/**
 * this class stores our rendering primitives (maps and points of interest) and
 * translates their coordinates from the internal block-based coordinate system to
 * pixel-based coordinates we can put into CSS, and vice-versa. it also divides up
 * maps and the points of interest that are on them into contiguous groups
 * represented by objects of the Island class, with which you can interact either
 * directly through the islands property or through the Island class' static methods.
 * for most practical purposes, this class should be used as a singleton.
 */
export default class MapCollage {
  maps: MapsByLevel;
  pois: Dexie.Table<PointOfInterest, number>;
  pxPerBlock: number;

  originMap: Map | undefined;
  lowestMapCoords: Coords;
  highestMapCoords: Coords;

  fullMapDimensions: Dimensions;

  islands: IslandsByLevel;

  // dx and dy for top, right, bottom, left
  public static readonly sides: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  constructor(
    maps: MapsByLevel,
    pointsOfInterest: PointOfInterest[],
    sizing: ScaleInfo
  ) {
    console.log("COLLAGE: creating map collage object");
    this.maps = Object.freeze(maps);
    console.log(
      "COLLAGE: sizing information for converting blocks to pixels:",
      sizing
    );
    this.pxPerBlock = sizing.edgeLengthPx / this.getEdgeLength(sizing.mapLevel);
    // TODO: figure out what to do in the hypothetical scenario where this map is not
    // present
    this.originMap = this.maps.level3.find((m) => m.x === 0 && m.y === 0);

    console.log("COLLAGE: found origin map:", this.originMap);

    const exes = this.maps.level3.map((m) => m.x);
    const whys = this.maps.level3.map((m) => m.y);
    this.lowestMapCoords = { x: Math.min(...exes), y: Math.min(...whys) };
    this.highestMapCoords = { x: Math.max(...exes), y: Math.max(...whys) };

    this.fullMapDimensions = new Dimensions(
      (this.highestMapCoords.x +
        this.getEdgeLength(3) -
        this.lowestMapCoords.x) *
        this.pxPerBlock,
      (this.highestMapCoords.y +
        this.getEdgeLength(3) -
        this.lowestMapCoords.y) *
        this.pxPerBlock
    );

    this.islands = { level3: [], level0: [] };

    const checkedMaps = { level0: new Set(), level3: new Set() };
    let level: keyof MapsByLevel;
    for (level in checkedMaps) {
      const levelInt = parseInt(level.slice(-1));
      while (checkedMaps[level].size < this.maps[level].length) {
        const isl = new Island(levelInt);
        const uncheckedMap = this.maps[level].find(
          (m) => !checkedMaps[level].has(m)
        );
        if (uncheckedMap) {
          const islandMaps = this.buildIsland(uncheckedMap, levelInt);
          for (const map of islandMaps) {
            checkedMaps[level].add(map);
          }
          isl.addMaps(islandMaps);
        }
        isl.findEdges();
        this.islands[level].push(isl);
      }
    }

    // we want to divide up all of the points of interest into their level 0 islands,
    // if they exist on one. to do this, we will figure out what level 0 map they
    // would occupy, check if the map exists, and look up the island containing it
    // and add the point to it.

    for (const poi of pointsOfInterest) {
      const mapX =
        Math.floor(poi.x / this.getEdgeLength(0)) * this.getEdgeLength(0);
      const mapY =
        Math.floor(poi.y / this.getEdgeLength(0)) * this.getEdgeLength(0);
      if (this.mapExistsAt({ x: mapX, y: mapY }, 0)) {
        Island.getIslandContainingMap(0, { x: mapX, y: mapY }).addPOI(poi);
      }
    }

    const db = new POIDB();
    db.transaction("rw", db.POIs, () => {
      db.POIs.bulkAdd(pointsOfInterest);
    });
    this.pois = db.POIs;

    Object.freeze(this.islands);

    console.log("COLLAGE: full initial state:", this);
  }

  buildIsland(map: Map, level: number): Set<Map> {
    const result = new Set<Map>();
    const edgeLength = this.getEdgeLength(level);
    const search = (map: Map | undefined) => {
      if (!map) return; // should not happen
      if (!result.has(map)) {
        result.add(map);
        for (const side of MapCollage.sides) {
          if (this.subMapHasAdjacent(map, ...side, level)) {
            search(
              this.getMapFromCoords(
                map.x + side[0] * edgeLength,
                map.y + side[1] * edgeLength,
                level
              )
            );
          }
        }
      }
    };
    search(map);
    return result;
  }

  resize(sizing: ScaleInfo) {
    this.pxPerBlock = sizing.edgeLengthPx / this.getEdgeLength(sizing.mapLevel);
    this.fullMapDimensions = new Dimensions(
      (this.highestMapCoords.x +
        this.getEdgeLength(3) -
        this.lowestMapCoords.x) *
        this.pxPerBlock,
      (this.highestMapCoords.y +
        this.getEdgeLength(3) -
        this.lowestMapCoords.y) *
        this.pxPerBlock
    );
  }

  getEdgeLength(level: number): number {
    // this class uses units where 128 units is equal to the length of each edge
    // of a level 0 map (just like in minecraft). this function returns the
    // length each edge of any map of any level in those units
    return 128 * 2 ** level;
  }

  getCoordsRelativeToCollage(mapCoords: Coords): Coords {
    // translates coords based on the arbitrary in-game origin point to coords with
    // the top left corner of the collage as their origin point.
    const x = mapCoords.x - this.lowestMapCoords.x;
    const y = mapCoords.y - this.lowestMapCoords.y;
    return { x, y };
  }

  getPosWithinCollage(absCoords: Coords): Position {
    // translates a map's relative coords obtained from getCoordsRelativeToCollage to
    // an object that can be used to position the map within the collage with CSS
    const relCoords = this.getCoordsRelativeToCollage(absCoords);
    return new Position(
      relCoords.x * this.pxPerBlock,
      relCoords.y * this.pxPerBlock
    );
  }

  getPosCenteredOn(
    mapCoords: Coords,
    mapLevel: number,
    viewport: Dimensions
  ): Position {
    // returns the pixel values for the left and top css properties that, when given
    // to the collage container, will center the specified map.
    const { x, y } = this.getCoordsRelativeToCollage(mapCoords);
    const mapEdgeLength = this.getEdgeLength(mapLevel) * this.pxPerBlock;
    return new Position(
      -x * this.pxPerBlock + (viewport.width - mapEdgeLength) / 2,
      -y * this.pxPerBlock + (viewport.height - mapEdgeLength) / 2
    );
  }

  mapExistsAt(mapCoords: Coords, mapLevel: number): boolean {
    const level = mapLevel == 0 ? this.maps.level0 : this.maps.level3;
    return level.some((m: Map) => m.x === mapCoords.x && m.y === mapCoords.y);
  }

  mapExistsAtRelativeTo(
    baseCoords: Coords,
    offsetCoords: Coords,
    level: number
  ): boolean {
    const absoluteCoords: Coords = {
      x: baseCoords.x + offsetCoords.x,
      y: baseCoords.y + offsetCoords.y,
    };
    return this.mapExistsAt(absoluteCoords, level);
  }

  subMapHasAdjacent(map: Map, dx: number, dy: number, level: number) {
    // this method allows you to check if there is a map directly above (use
    // dy == -1), below (dy==1), to the left (dx==-1), or to the right (dx ==
    // 1) of another map.
    return this.mapExistsAtRelativeTo(
      { x: map.x, y: map.y },
      {
        x: dx * this.getEdgeLength(level),
        y: dy * this.getEdgeLength(level),
      },
      level
    );
  }

  getCoordsWithinCollageFromViewportPos(
    viewportPos: Position,
    collagePos: Position
  ): Coords {
    // given a position within the viewport and the current position of the full
    // collage, this method translates the position within the viewport to coords in
    // minecraft units (1 unit == 1 block, origin is arbitrary)
    const x = (-collagePos.left + viewportPos.left) / this.pxPerBlock;
    const y = (-collagePos.top + viewportPos.top) / this.pxPerBlock;
    return { x: x + this.lowestMapCoords.x, y: y + this.lowestMapCoords.y };
  }

  getMapFromCoords(x: number, y: number, level: number) {
    // TODO: to scale better, this method should be replaced with a version that queries
    // a sorted index of maps, or possibly queries an object with keys that
    // incorporate the information from this method's parameters
    const maps = level == 0 ? this.maps.level0 : this.maps.level3;
    return maps.find((m) => m.x == x && m.y == y);
  }

  getMapFromViewportPos(
    viewportPos: Position,
    collagePos: Position,
    mapLevel: number
  ) {
    // given a position within the viewport, the current position of the collage, and
    // a map level, this method returns the object of the map that occupies that
    // viewport position.
    const coordsWithinCollage = this.getCoordsWithinCollageFromViewportPos(
      viewportPos,
      collagePos
    );
    const level = mapLevel == 0 ? this.maps.level0 : this.maps.level3;
    const relevantEdgeLength = this.getEdgeLength(mapLevel);
    const flooredCoords = {
      x:
        Math.floor(coordsWithinCollage.x / relevantEdgeLength) *
        relevantEdgeLength,
      y:
        Math.floor(coordsWithinCollage.y / relevantEdgeLength) *
        relevantEdgeLength,
    };
    return level?.find(
      (m: Map) => m.x === flooredCoords.x && m.y === flooredCoords.y
    );
  }
}
