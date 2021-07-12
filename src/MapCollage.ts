import {
  Map,
  PointOfInterest,
  Dimensions,
  Position,
  Coords,
  getEdgeLength,
  ItemsInLevel,
  Window,
} from "./Types";
import Island from "./Island";

import Flatbush from "flatbush";

/**
 * This interface is only used for the result of importing processed_maps.json; the
 * rest of the time we can use the more generic ItemsInLevel interface
 */
interface MapsByLevel {
  level0: Map[];
  level1: Map[];
  level2: Map[];
  level3: Map[];
  level4: Map[];
}

/**
 * This class stores both Maps and PointsOfInterest in indexed and unindexed form.
 * Each of the four instance variables are possibly-sparse arrays where the items
 * corresponding to level 0 are stored at this.instanceVariable[0], and so on.
 */
class IndexedMapItems {
  mapIndex: Flatbush[] = [];
  POIIndex: Flatbush[] = [];
  maps: ItemsInLevel<Map>[] = [];
  pointsOfInterest: ItemsInLevel<PointOfInterest>[] = [];

  constructor(itemGroups: ItemsInLevel<Map | PointOfInterest>[]) {
    for (const itemGroup of itemGroups) {
      const newIndex = new Flatbush(itemGroup.items.length);
      if ("file" in itemGroup.items[0]) {
        for (const item of itemGroup.items) {
          const edgeLength = getEdgeLength(itemGroup.level);
          newIndex.add(
            item.x,
            item.y,
            item.x + edgeLength,
            item.y + edgeLength
          );
        }
        this.maps[itemGroup.level] = itemGroup as ItemsInLevel<Map>;
        this.mapIndex[itemGroup.level] = newIndex;
      } else if ("text" in itemGroup.items[0]) {
        for (const item of itemGroup.items) {
          newIndex.add(item.x, item.y, item.x, item.y);
        }
        this.pointsOfInterest[itemGroup.level] = itemGroup as ItemsInLevel<
          PointOfInterest
        >;
        this.POIIndex[itemGroup.level] = newIndex;
      } else {
        console.error("failed to index group of strange items", itemGroup);
      }
      newIndex.finish();
    }
  }

  searchMaps(
    level: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): Map[] {
    const locations = this.mapIndex[level].search(minX, minY, maxX, maxY);
    return locations.map((l) => this.maps[level].items[l]);
  }

  searchPOIs(
    level: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): PointOfInterest[] {
    const locations = this.POIIndex[level].search(minX, minY, maxX, maxY);
    return locations.map((l) => this.pointsOfInterest[level].items[l]);
  }

  get allMaps(): Map[] {
    return this.maps.map((g) => g.items).flat();
  }

  get allPOIs(): PointOfInterest[] {
    return this.pointsOfInterest.map((g) => g.items).flat();
  }
}

interface ScaleInfo {
  mapLevel: number;
  edgeLengthPx: number;
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
  items: IndexedMapItems;
  pxPerBlock: number;

  originMap: Map | undefined;
  lowestMapCoords: Coords;
  highestMapCoords: Coords;

  fullMapDimensions: Dimensions;

  islands: ItemsInLevel<Island>[] = [];

  // dx and dy for top, right, bottom, left
  public static readonly sides: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  constructor(
    maps: MapsByLevel,
    pointsOfInterest: ItemsInLevel<PointOfInterest>[],
    sizing: ScaleInfo
  ) {
    console.log("COLLAGE: creating map collage object");
    console.log(
      "COLLAGE: sizing information for converting blocks to pixels:",
      sizing
    );
    this.pxPerBlock = sizing.edgeLengthPx / getEdgeLength(sizing.mapLevel);

    const mapsAsItems: ItemsInLevel<Map>[] = [];
    mapsAsItems[0] = { level: 0, items: maps.level0 };
    mapsAsItems[3] = { level: 3, items: maps.level3 };

    // Object.values makes these arrays no longer sparse
    this.items = new IndexedMapItems(
      Object.values(
        (mapsAsItems as ItemsInLevel<any>[]).concat(
          pointsOfInterest as ItemsInLevel<any>[]
        )
      )
    );

    // TODO: figure out what to do in the hypothetical scenario where this map is not
    // present
    const originCenter = getEdgeLength(3) / 2;
    this.originMap = this.items.searchMaps(
      3,
      originCenter,
      originCenter,
      originCenter,
      originCenter
    )[0];

    console.log("COLLAGE: found origin map:", this.originMap);

    this.lowestMapCoords = {
      x: this.items.mapIndex[3].minX,
      y: this.items.mapIndex[3].minY,
    };
    this.highestMapCoords = {
      x: this.items.mapIndex[3].maxX,
      y: this.items.mapIndex[3].maxY,
    };

    this.fullMapDimensions = new Dimensions(
      (this.highestMapCoords.x + getEdgeLength(3) - this.lowestMapCoords.x) *
        this.pxPerBlock,
      (this.highestMapCoords.y + getEdgeLength(3) - this.lowestMapCoords.y) *
        this.pxPerBlock
    );

    const checkedMaps = { "0": new Set(), "3": new Set() };
    let level: keyof typeof checkedMaps;
    for (level in checkedMaps) {
      const levelInt = parseInt(level);
      const mapsAtLevel = this.items.maps[levelInt].items;
      this.islands[levelInt] = { level: levelInt, items: [] };
      while (checkedMaps[level].size < mapsAtLevel.length) {
        const isl = new Island(levelInt);
        const uncheckedMap = mapsAtLevel.find(
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
        this.islands[levelInt].items.push(isl);
      }
    }

    // we want to divide up all of the points of interest into their level 0 islands,
    // if they exist on one. to do this, we will figure out what level 0 map they
    // would occupy, check if the map exists, and look up the island containing it
    // and add the point to it.

    for (const poi of this.items.allPOIs) {
      const mapX = Math.floor(poi.x / getEdgeLength(0)) * getEdgeLength(0);
      const mapY = Math.floor(poi.y / getEdgeLength(0)) * getEdgeLength(0);
      if (this.mapExistsAt({ x: mapX, y: mapY }, 0)) {
        Island.getIslandContainingMap(0, { x: mapX, y: mapY }).addPOI(poi);
      }
    }

    Object.freeze(this.islands);

    console.log("COLLAGE: full initial state:", this);
  }

  buildIsland(map: Map, level: number): Set<Map> {
    const result = new Set<Map>();
    const edgeLength = getEdgeLength(level);
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
    this.pxPerBlock = sizing.edgeLengthPx / getEdgeLength(sizing.mapLevel);
    this.fullMapDimensions = new Dimensions(
      (this.highestMapCoords.x + getEdgeLength(3) - this.lowestMapCoords.x) *
        this.pxPerBlock,
      (this.highestMapCoords.y + getEdgeLength(3) - this.lowestMapCoords.y) *
        this.pxPerBlock
    );
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

  getPosCenteredOn(pointCoords: Coords, viewport: Dimensions): Position {
    // returns the pixel values for the left and top css properties that, when given
    // to the collage container, will center the specified point.
    const { x, y } = this.getCoordsRelativeToCollage(pointCoords);
    return new Position(
      -x * this.pxPerBlock + viewport.width / 2,
      -y * this.pxPerBlock + viewport.height / 2
    );
  }

  getPosCenteredOnMap(
    mapCoords: Coords,
    mapLevel: number,
    viewport: Dimensions
  ): Position {
    // returns the pixel values for the left and top css properties that, when given
    // to the collage container, will center the specified map.
    const { x, y } = this.getCoordsRelativeToCollage(mapCoords);
    const mapEdgeLength = getEdgeLength(mapLevel) * this.pxPerBlock;
    return new Position(
      -x * this.pxPerBlock + (viewport.width - mapEdgeLength) / 2,
      -y * this.pxPerBlock + (viewport.height - mapEdgeLength) / 2
    );
  }

  // TODO: create "window" type to standardize these methods?

  getWindowCenteredOnMap(
    mapCoords: Coords,
    currentLevel: number,
    mapLevel: number,
    viewport: Dimensions
  ): Window {
    const scaleFactor = getEdgeLength(mapLevel) / getEdgeLength(currentLevel);
    const windowWidth = (viewport.width / this.pxPerBlock) * scaleFactor;
    const windowHeight = (viewport.height / this.pxPerBlock) * scaleFactor;
    const mapCenterX = mapCoords.x + getEdgeLength(mapLevel) / 2;
    const mapCenterY = mapCoords.y + getEdgeLength(mapLevel) / 2;
    return [
      mapCenterX - windowWidth / 2,
      mapCenterY - windowHeight / 2,
      mapCenterX + windowWidth / 2,
      mapCenterY + windowHeight / 2,
    ];
  }

  getWindowFromViewport(fullMapPos: Position, viewport: Dimensions): Window {
    const viewportMin = this.getCoordsWithinCollageFromViewportPos(
      new Position(0, 0),
      fullMapPos
    );
    const viewportMax = this.getCoordsWithinCollageFromViewportPos(
      new Position(viewport.width, viewport.height),
      fullMapPos
    );
    return [viewportMin.x, viewportMin.y, viewportMax.x, viewportMax.y];
  }

  /**
   * @param x X coordinate corresponding to the top left corner of a map
   * @param y Y Coordinate corresponding to the top left corner of a map
   * @param level Zoom level that we are looking for this map at
   * @returns A Map if it exists at this x, y, and zoom level; else undefined
   */
  getMapFromCoords(x: number, y: number, level: number): Map | undefined {
    const halfEdge = getEdgeLength(level) / 2;
    return this.items.searchMaps(
      level,
      x + halfEdge,
      y + halfEdge,
      x + halfEdge,
      y + halfEdge
    )[0];
  }

  mapExistsAt(mapCoords: Coords, mapLevel: number): boolean {
    return !!this.getMapFromCoords(mapCoords.x, mapCoords.y, mapLevel);
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
        x: dx * getEdgeLength(level),
        y: dy * getEdgeLength(level),
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
    return this.items.searchMaps(
      mapLevel,
      coordsWithinCollage.x,
      coordsWithinCollage.y,
      coordsWithinCollage.x,
      coordsWithinCollage.y
    )[0];
  }
}
