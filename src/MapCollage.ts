import {
  Map,
  PointOfInterest,
  Dimensions,
  Position,
  Coords,
  getEdgeLength,
  ItemsInLevel
} from "./Types";
import Island from "./Island";

import RBush from "rbush";
import { BBox } from "rbush";

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

interface IndexedItem<Type> extends BBox {
  item: Type;
}

class MyRBush<Type> extends RBush<IndexedItem<Type>> {
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  updateMinMax(item: IndexedItem<Type>) {
    if (item.minX < this.minX) {
      this.minX = item.minX;
    }
    if (item.minY < this.minY) {
      this.minY = item.minY;
    }
    if (item.maxX > this.maxX) {
      this.maxX = item.maxX;
    }
    if (item.maxY > this.maxY) {
      this.maxY = item.maxY;
    }
  }
  load(items: ReadonlyArray<IndexedItem<Type>>): MyRBush<Type> {
    for (const item of items) {
      this.updateMinMax(item);
    }
    super.load(items);
    return this;
  }
  insert(item: IndexedItem<Type>): MyRBush<Type> {
    this.updateMinMax(item);
    super.insert(item);
    return this;
  }
  remove() {
    console.error(
      "remove operations are not supported in this application bc they are " +
      "not necessary and would require new minimum and maximum xs and ys to be found"
    );
    return this;
  }
  getSearchResults(bbox: BBox): Type[] {
    return super.search(bbox).map(result => result.item);
  }
  getAll(): Type[] {
    return super.all().map(result => result.item);
  }
}

/**
 * This class stores both Maps and PointsOfInterest in indexed and unindexed form.
 * Each of the four instance variables are possibly-sparse arrays where the items
 * corresponding to level 0 are stored at this.instanceVariable[0], and so on.
 */
class IndexedMapItems {
  mapIndex: MyRBush<Map>[] = [];
  POIIndex: MyRBush<PointOfInterest>[] = [];
  maps: ItemsInLevel<Map>[] = [];
  pointsOfInterest: ItemsInLevel<PointOfInterest>[] = [];

  constructor(itemGroups: ItemsInLevel<Map | PointOfInterest>[]) {
    for (const itemGroup of itemGroups) {
      if ("file" in itemGroup.items[0]) {
        const newIndex = new MyRBush<Map>();
        const edgeLength = getEdgeLength(itemGroup.level);
        newIndex.load(
          itemGroup.items.map(map => ({
            minX: map.x,
            minY: map.y,
            maxX: map.x + edgeLength,
            maxY: map.y + edgeLength,
            item: map as Map
          }))
        );
        this.maps[itemGroup.level] = itemGroup as ItemsInLevel<Map>;
        this.mapIndex[itemGroup.level] = newIndex;
      } else if ("text" in itemGroup.items[0]) {
        const newIndex = new MyRBush<PointOfInterest>();
        newIndex.load(
          itemGroup.items.map(poi => ({
            minX: poi.x,
            minY: poi.y,
            maxX: poi.x,
            maxY: poi.y,
            item: poi as PointOfInterest
          }))
        );
        this.pointsOfInterest[itemGroup.level] = itemGroup as ItemsInLevel<PointOfInterest>;
        this.POIIndex[itemGroup.level] = newIndex;
      } else {
        console.error("failed to index group of strange items", itemGroup);
      }
    }
  }

  searchMaps(level: number, bbox: BBox): Map[] {
    return this.mapIndex[level].getSearchResults(bbox);
  }

  searchPOIs(level: number, bbox: BBox): PointOfInterest[] {
    return this.POIIndex[level].getSearchResults(bbox);
  }

  get allMaps(): Map[] {
    return this.maps.map(g => g.items).flat();
  }

  get allPOIs(): PointOfInterest[] {
    return this.pointsOfInterest.map(g => g.items).flat();
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
    [-1, 0]
  ];

  constructor(
    maps: MapsByLevel,
    pointsOfInterest: ItemsInLevel<PointOfInterest>[],
    sizing: ScaleInfo
  ) {
    console.log("COLLAGE: creating map collage object");
    console.log("COLLAGE: sizing information for converting blocks to pixels:", sizing);
    this.pxPerBlock = sizing.edgeLengthPx / getEdgeLength(sizing.mapLevel);

    const mapsAsItems: ItemsInLevel<Map>[] = [];
    mapsAsItems[0] = { level: 0, items: maps.level0 };
    mapsAsItems[3] = { level: 3, items: maps.level3 };

    // Object.values makes these arrays no longer sparse
    this.items = Object.freeze(
      new IndexedMapItems(
        Object.values(
          (mapsAsItems as ItemsInLevel<any>[]).concat(
            pointsOfInterest as ItemsInLevel<any>[]
          )
        )
      )
    );

    // TODO: figure out what to do in the hypothetical scenario where this map is not
    // present
    const originCenter = getEdgeLength(3) / 2;
    this.originMap = this.items.searchMaps(3, {
      minX: originCenter,
      minY: originCenter,
      maxX: originCenter,
      maxY: originCenter
    })[0];

    this.lowestMapCoords = {
      x: this.items.mapIndex[3].minX,
      y: this.items.mapIndex[3].minY
    };
    this.highestMapCoords = {
      x: this.items.mapIndex[3].maxX,
      y: this.items.mapIndex[3].maxY
    };

    this.fullMapDimensions = new Dimensions(
      (this.highestMapCoords.x - this.lowestMapCoords.x) * this.pxPerBlock,
      (this.highestMapCoords.y - this.lowestMapCoords.y) * this.pxPerBlock
    );

    const checkedMaps = { "0": new Set(), "3": new Set() };
    let level: keyof typeof checkedMaps;
    for (level in checkedMaps) {
      const levelInt = parseInt(level);
      const mapsAtLevel = this.items.maps[levelInt].items;
      this.islands[levelInt] = { level: levelInt, items: [] };
      while (checkedMaps[level].size < mapsAtLevel.length) {
        const isl = new Island(levelInt);
        const uncheckedMap = mapsAtLevel.find(m => !checkedMaps[level].has(m));
        if (uncheckedMap) {
          const islandMaps = this.buildIsland(uncheckedMap, levelInt);
          for (const map of islandMaps) {
            checkedMaps[level].add(map);
          }
          isl.addMaps(islandMaps);
        }
        if (level == "0") {
          isl.findEdges();
        }
        this.islands[levelInt].items.push(isl);
      }
    }

    console.log(this.islands[3].items.length, "level 3 islands found. connecting...");
    let largeIsland = this.islands[3].items[0];
    for (const level3Island of this.islands[3].items.slice(1)) {
      largeIsland = largeIsland.connect(level3Island);
    }
    largeIsland.findEdges();
    this.islands[3].items = [largeIsland];

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
  }

  buildIsland(map: Map, level: number): Set<Map> {
    const result = new Set<Map>();
    const edgeLength = getEdgeLength(level);
    const search = (map: Map | undefined) => {
      if (!map) {
        console.warn("in buildIsland, 'search' was called with a falsy map:", map);
        return;
      } // should not happen
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
      (this.highestMapCoords.x - this.lowestMapCoords.x) * this.pxPerBlock,
      (this.highestMapCoords.y - this.lowestMapCoords.y) * this.pxPerBlock
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
    // translates coords expressed in MapCollage units to an object that can be used
    // to position the map within the collage with CSS
    const relCoords = this.getCoordsRelativeToCollage(absCoords);
    return new Position(relCoords.x * this.pxPerBlock, relCoords.y * this.pxPerBlock);
  }

  /**
   * returns the pixel values for the left and top css properties that, when given to
   * the full map, will place the point specified in MapCollage units at the
   * destination point within the viewport specified in px.
   * @param pointCoords a point in MapCollage units that is within the map
   * @param pointDestPx a point in px that is within the viewport
   */
  getPosWithPlacedPoint(pointCoords: Coords, pointDestPx: Coords): Position {
    const { x, y } = this.getCoordsRelativeToCollage(pointCoords);
    return new Position(
      -x * this.pxPerBlock + pointDestPx.x,
      -y * this.pxPerBlock + pointDestPx.y
    );
  }

  /**
   * returns the pixel values for the left and top css properties that, when given
   * to the collage container, will center the specified point.
   * @param pointCoords the x and y of the point that you wish to center within the viewport
   * @param viewport the dimensions of the viewport in pixels
   * @returns pixel position that can be converted to CSS and used to place the full map
   */
  getPosCenteredOn(pointCoords: Coords, viewport: Dimensions): Position {
    return this.getPosWithPlacedPoint(pointCoords, {
      x: viewport.width / 2,
      y: viewport.height / 2
    });
  }

  getPosCenteredOnMap(mapCoords: Coords, mapLevel: number, viewport: Dimensions): Position {
    // returns the pixel values for the left and top css properties that, when given
    // to the collage container, will center the specified map.
    const { x, y } = this.getCoordsRelativeToCollage(mapCoords);
    const mapEdgeLength = getEdgeLength(mapLevel) * this.pxPerBlock;
    return new Position(
      -x * this.pxPerBlock + (viewport.width - mapEdgeLength) / 2,
      -y * this.pxPerBlock + (viewport.height - mapEdgeLength) / 2
    );
  }

  getBBoxCenteredOnMap(
    mapCoords: Coords,
    currentLevel: number,
    mapLevel: number,
    viewport: Dimensions
  ): BBox {
    const scaleFactor = getEdgeLength(mapLevel) / getEdgeLength(currentLevel);
    const windowWidth = (viewport.width / this.pxPerBlock) * scaleFactor;
    const windowHeight = (viewport.height / this.pxPerBlock) * scaleFactor;
    const mapCenterX = mapCoords.x + getEdgeLength(mapLevel) / 2;
    const mapCenterY = mapCoords.y + getEdgeLength(mapLevel) / 2;
    return {
      minX: mapCenterX - windowWidth / 2,
      minY: mapCenterY - windowHeight / 2,
      maxX: mapCenterX + windowWidth / 2,
      maxY: mapCenterY + windowHeight / 2
    };
  }

  getBBoxFromViewport(fullMapPos: Position, viewport: Dimensions, margin: number = 256): BBox {
    const viewportMin = this.getCoordsWithinCollageFromViewportPos(
      new Position(0, 0),
      fullMapPos
    );
    const viewportMax = this.getCoordsWithinCollageFromViewportPos(
      new Position(viewport.width, viewport.height),
      fullMapPos
    );
    return {
      minX: viewportMin.x - margin,
      minY: viewportMin.y - margin,
      maxX: viewportMax.x + margin,
      maxY: viewportMax.y + margin
    };
  }

  /**
   * @param x X coordinate corresponding to the top left corner of a map
   * @param y Y Coordinate corresponding to the top left corner of a map
   * @param level Zoom level that we are looking for this map at
   * @returns A Map if it exists at this x, y, and zoom level; else undefined
   */
  getMapFromCoords(x: number, y: number, level: number): Map | undefined {
    const halfEdge = getEdgeLength(level) / 2;
    return this.items.searchMaps(level, {
      minX: x + halfEdge,
      minY: y + halfEdge,
      maxX: x + halfEdge,
      maxY: y + halfEdge
    })[0];
  }

  mapExistsAt(mapCoords: Coords, mapLevel: number): boolean {
    return !!this.getMapFromCoords(mapCoords.x, mapCoords.y, mapLevel);
  }

  mapExistsAtRelativeTo(baseCoords: Coords, offsetCoords: Coords, level: number): boolean {
    const absoluteCoords: Coords = {
      x: baseCoords.x + offsetCoords.x,
      y: baseCoords.y + offsetCoords.y
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
        y: dy * getEdgeLength(level)
      },
      level
    );
  }

  getCoordsWithinCollageFromViewportPos(viewportPos: Position, collagePos: Position): Coords {
    // given a position within the viewport and the current position of the full
    // collage, this method translates the position within the viewport to coords in
    // minecraft units (1 unit == 1 block)
    const x = (-collagePos.left + viewportPos.left) / this.pxPerBlock;
    const y = (-collagePos.top + viewportPos.top) / this.pxPerBlock;
    return { x: x + this.lowestMapCoords.x, y: y + this.lowestMapCoords.y };
  }

  getMapFromViewportPos(viewportPos: Position, collagePos: Position, mapLevel: number) {
    // given a position within the viewport, the current position of the collage, and
    // a map level, this method returns the object of the map that occupies that
    // viewport position.
    const coordsWithinCollage = this.getCoordsWithinCollageFromViewportPos(
      viewportPos,
      collagePos
    );
    return this.items.searchMaps(mapLevel, {
      minX: coordsWithinCollage.x,
      minY: coordsWithinCollage.y,
      maxX: coordsWithinCollage.x,
      maxY: coordsWithinCollage.y
    })[0];
  }

  BBoxToCSS(bbox: BBox) {
    const position = this.getPosWithinCollage({
      x: bbox.minX,
      y: bbox.minY
    }).toCSS();
    return {
      ...position,
      width: (bbox.maxX - bbox.minX) * this.pxPerBlock + "px",
      height: (bbox.maxY - bbox.minY) * this.pxPerBlock + "px"
    };
  }
}
