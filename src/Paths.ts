import { Bezier } from "bezier-js";
import chroma from "chroma-js";
import type { BBox } from "rbush";

import { Coords, distance } from "./Types";

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
        return (
            (includeInitialMove ? `M ${this.p1.x} ${this.p1.y} ` : "") +
            `L ${this.p2.x} ${this.p2.y}`
        );
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
        };
    }
}

class SVGQuadraticCurveSegment implements SVGPathComponent {
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
        return (
            (includeInitialMove ? `M ${this.p1.x} ${this.p1.y} ` : "") +
            `Q ${this.controlPoint.x} ${this.controlPoint.y} ${this.p2.x} ${this.p2.y}`
        );
    }
    get length() {
        return this.curve.length();
    }
    getPointAt(t: number): Coords {
        if (t < 0 || t > 1) {
            throw "calling getPointAt in SVGQuadraticCurveSegment with invalid t: " + t;
        }
        return this.curve.get(t);
    }
}

class SVGCubicCurveSegment implements SVGPathComponent {
    p1: Coords;
    c1: Coords;
    p2: Coords;
    c2: Coords;
    curve: Bezier;
    constructor(p1: Coords, c1: Coords, p2: Coords, c2: Coords) {
        this.p1 = p1;
        this.c1 = c1;
        this.p2 = p2;
        this.c2 = c2;
        this.curve = new Bezier(p1, c1, c2, p2);
    }
    asCommand(includeInitialMove: boolean = false): string {
        return (
            (includeInitialMove ? `M ${this.p1.x} ${this.p1.y} ` : "") +
            `C ${this.c1.x} ${this.c1.y} ${this.c2.x} ${this.c2.y} ${this.p2.x} ${this.p2.y}`
        );
    }
    get length() {
        return this.curve.length();
    }
    getPointAt(t: number): Coords {
        if (t < 0 || t > 1) {
            throw "calling getPointAt in SVGCubicCurveSegment with invalid t: " + t;
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
            // note: this vector needs to be normalized so we can set its length easily
            let lastControlPointVector = { x: 0, y: 0 };
            for (let i = 1; i < this.points.length; i++) {
                const p1 = this.points[i - 1];
                const p2 = this.points[i];
                // get the first control point by taking the mirror image of the vector to
                // the previous control point and lengthening it according to how much ground
                // this curve has to cover
                const lineSegmentLength = distance(p1, p2);
                const controlPointDistance = lineSegmentLength / 4;
                const c1: Coords = {
                    x: p1.x + -lastControlPointVector.x * controlPointDistance,
                    y: p1.y + -lastControlPointVector.y * controlPointDistance
                };
                let c2;
                if (i < this.points.length - 1) {
                    const nextPoint = this.points[i + 1];
                    // vector that points from p2 to p1
                    const vector1 = { x: p1.x - p2.x, y: p1.y - p2.y };
                    // vector that points from the next point to p2
                    const vector2 = { x: p2.x - nextPoint.x, y: p2.y - nextPoint.y };
                    const middleVector = {
                        x: (vector1.x + vector2.x) / 2,
                        y: (vector1.y + vector2.y) / 2
                    };
                    const mvLength = distance(middleVector, { x: 0, y: 0 });
                    const normalizedCPV = {
                        x: middleVector.x / mvLength,
                        y: middleVector.y / mvLength
                    };
                    lastControlPointVector = normalizedCPV;
                    const controlPointVector = {
                        x: normalizedCPV.x * controlPointDistance,
                        y: normalizedCPV.y * controlPointDistance
                    };
                    c2 = {
                        x: p2.x + controlPointVector.x,
                        y: p2.y + controlPointVector.y
                    };
                } else {
                    c2 = p2;
                }
                if (i == 0 || i == this.points.length - 1) {
                    this.svgComps.push(new SVGLineSegment(p1, p2));
                } else {
                    this.svgComps.push(new SVGCubicCurveSegment(p1, c1, p2, c2));
                }
            }
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
                        result.push(comp.getPointAt(startingT + (i * spaceBetween) / comp.length));
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
        return chroma(this.color)
            .darken(2)
            .hex();
    }
}

export {PathData, SVGCubicCurveSegment}
