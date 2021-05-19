import { CSSDimensions, CSSPosition, Dimensions, Position } from "./Types";

interface Map {
  x: number;
  y: number;
  file: String;
}

interface MapsByLevel {
  level0: Map[];
  level3: Map[];
}

interface PointOfInterest {
  x: number;
  y: number;
  text: String;
}

interface POIsByLevel {
  level0: PointOfInterest[];
  level3: PointOfInterest[];
}

interface Coords {
  x: number;
  y: number;
}

interface ScaleInfo {
  mapLevel: number;
  edgeLengthPx: number;
}

export default class MapCollage {
  maps: MapsByLevel;
  pois: POIsByLevel;
  pxPerBlock: number;

  originMap: Map | undefined;
  lowestMapCoords: Coords;
  highestMapCoords: Coords;

  fullMapDimensions: Dimensions;

  constructor(
    maps: MapsByLevel,
    pointsOfInterest: POIsByLevel,
    sizing: ScaleInfo
  ) {
    console.log("COLLAGE: creating map collage object");
    this.maps = maps;
    this.pois = pointsOfInterest;
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

    // create level 3 "island" with edges and corners (convex and concave)

    console.log("COLLAGE: full initial state:", this);
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

  getMapPosWithinCollage(mapCoords: Coords): Position {
    // translates a map's relative coords obtained from getCoordsRelativeToCollage to
    // an object that can be used to position the map within the collage with CSS
    const coords = this.getCoordsRelativeToCollage(mapCoords);
    return new Position(coords.x * this.pxPerBlock, coords.y * this.pxPerBlock);
  }

  getMarkerPos(marker: PointOfInterest): CSSPosition {
    // translates a marker's position (which is stored in minecraft block units) into
    // an object that can be used to position the marker within the collage with CSS
    const coords = this.getCoordsRelativeToCollage({
      x: marker.x,
      y: marker.y,
    });
    // this could actually be pre-calculated and assigned to the point of interest
    // objects in the constructor
    return {
      left: coords.x * this.pxPerBlock + "px",
      top: coords.y * this.pxPerBlock + "px",
    };
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
      -x * this.pxPerBlock + (viewport._width - mapEdgeLength) / 2,
      -y * this.pxPerBlock + (viewport._height - mapEdgeLength) / 2
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

  getCoordsWithinCollageFromViewportPos(
    viewportPos: Position,
    collagePos: Position
  ): Coords {
    // given a position within the viewport and the current position of the full
    // collage, this method translates the position within the viewport to coords in
    // minecraft units (1 unit == 1 block, origin is arbitrary)
    const x = (-collagePos._left + viewportPos._left) / this.pxPerBlock;
    const y = (-collagePos._top + viewportPos._top) / this.pxPerBlock;
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
    console.log("trying to find map at viewport position", viewportPos);
    console.log("full collage is positioned at", collagePos);
    const coordsWithinCollage = this.getCoordsWithinCollageFromViewportPos(
      viewportPos,
      collagePos
    );
    console.log(
      "map appears to have coords within collage",
      coordsWithinCollage
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
