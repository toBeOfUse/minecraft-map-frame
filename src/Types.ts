import Island from "./Island";
import MapCollage from "./MapCollage";

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

interface PointOfInterest {
  x: number;
  y: number;
  text: String;
}

// sigh
function clamp(input: number, min: number, max: number) {
  return Math.max(min, Math.min(input, max));
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
  clamp,
  PointOfInterest,
  MapCollage,
};
