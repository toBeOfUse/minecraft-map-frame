
from base64 import urlsafe_b64encode as b64
from collections import defaultdict
from dataclasses import dataclass, field
from hashlib import blake2b
from typing import Optional


@dataclass(order=True, frozen=True)
class MapSpacePoint:
    """
    In Minecraft world-space, maps can be located with x and z coordinates and
    the top left corner of a map that contains the origin will be located at
    (-64, -64). For simplicity, we want to operate in "map space", where the
    axes are x and y, and the top left corner of a map that contains the
    world-space origin will be at the map space origin of (0, 0).
    """
    x: int
    y: int

    def __add__(self, other: "MapSpacePoint") -> "MapSpacePoint":
        return MapSpacePoint(self.x+other.x, self.y+other.y)
    
    def __repr__(self) -> str:
        return f"({self.x}, {self.y})"
    
    def to_dict(self) -> dict[str, int]:
        return {"x": self.x, "y": self.y}


@dataclass(frozen=True)
class MapSpaceLineSegment:
    start: MapSpacePoint
    end: MapSpacePoint
    
    def __repr__(self) -> str:
        return f"{self.start} -> {self.end}"
    
    def to_dict(self) -> dict:
        return {
            "start": self.start.to_dict(),
            "end": self.end.to_dict()
        }

@dataclass
class Polygon:
    segments: list[MapSpaceLineSegment]

    def to_dict(self) -> dict:
        return {"segments": [x.to_dict() for x in self.segments]}

@dataclass
class Map:
    id: int
    scale: int
    blank_pixels: int
    x_center: int
    z_center: int
    dimension: str
    rgba: bytes
    file: str = ""

    @property
    def side_length(self) -> int:
        return 128*2**self.scale
    
    @property
    def top_left(self) -> MapSpacePoint:
        return MapSpacePoint(
            int(self.x_center - self.side_length/2 + 64),
            int(self.z_center - self.side_length/2 + 64),
        )
    
    @property
    def top_right(self) -> MapSpacePoint:
        return self.top_left + MapSpacePoint(self.side_length, 0)
    
    @property
    def bottom_left(self) -> MapSpacePoint:
        return self.top_left + MapSpacePoint(0, self.side_length)
    
    @property
    def bottom_right(self) -> MapSpacePoint:
        return self.top_left + MapSpacePoint(self.side_length, self.side_length)
    
    @property
    def left(self) -> MapSpaceLineSegment:
        "the direction of each line is clockwise around the map"
        return MapSpaceLineSegment(self.bottom_left, self.top_left)
    
    @property
    def top(self) -> MapSpaceLineSegment:
        "the direction of each line is clockwise around the map"
        return MapSpaceLineSegment(self.top_left, self.top_right)
    
    @property
    def right(self) -> MapSpaceLineSegment:
        "the direction of each line is clockwise around the map"
        return MapSpaceLineSegment(self.top_right, self.bottom_right)
    
    @property
    def bottom(self) -> MapSpaceLineSegment:
        "the direction of each line is clockwise around the map"
        return MapSpaceLineSegment(self.bottom_right, self.bottom_left)
    
    @property
    def coords_string(self) -> str:
        return f"{self.top_left.x},{self.top_left.y}"
    
    def __repr__(self) -> str:
        return (f"Map(id={self.id}, scale={self.scale}, "
                f"top_left={self.top_left})")

    def image_hash(self) -> str:
        return b64(blake2b(self.rgba, digest_size=12).digest()).decode("utf-8")
    
    def __hash__(self) -> int:
        return hash(self.rgba)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "scale": self.scale,
            "blank_pixels": self.blank_pixels,
            "x": self.top_left.x,
            "y": self.top_left.y,
            "dimension": self.dimension,
            "file": self.file
        }

@dataclass
class Island:
    _maps: list[Map]
    _outline: Polygon = field(init=False)

    @property
    def maps(self) -> list[Map]:
        return [*self._maps]
    
    @property
    def outline(self) -> Polygon:
        return Polygon([*self._outline.segments])

    @property
    def scale(self) -> int:
        return self._maps[0].scale

    def to_dict(self) -> dict:
        return {
            "maps": [x.to_dict() for x in self._maps],
            "scale": self.scale,
            "outline": self._outline.to_dict()
        }

    def __post_init__(self):
        assert len(self._maps) > 0, "error: empty island"

        start_index: dict[MapSpacePoint, list[MapSpaceLineSegment]] = defaultdict(list)

        _line_tally: dict[MapSpaceLineSegment, int] = defaultdict(lambda: 0)
        def tally_key(line: MapSpaceLineSegment) -> MapSpaceLineSegment:
            return MapSpaceLineSegment(*sorted([line.start, line.end]))
        def add_tally(line: MapSpaceLineSegment) -> None:
            _line_tally[tally_key(line)] += 1
        def get_tally(line: MapSpaceLineSegment) -> int:
            return _line_tally[tally_key(line)]
            
        
        # we want to find the top left point of a map with the lowest available
        # y-value (so on the top edge of the island). then, to get a clockwise
        # polygon, we can just go to the top right point of the same map, follow
        # the other line segment that has that point, and so on.
        starting_line: Optional[MapSpaceLineSegment] = None
        lowest_y = float("inf")
        for map in self._maps:
            for side_name in ["left", "top", "right", "bottom"]:
                side: MapSpaceLineSegment = getattr(map, side_name)
                add_tally(side)
                start_index[side.start].append(side)
                if side_name == "top":
                    if side.start.y == side.end.y and side.start.y < lowest_y:
                        lowest_y = side.start.y
                        starting_line = side
        
        def find_next_line(line: MapSpaceLineSegment) -> MapSpaceLineSegment:
            potential_directions = start_index[line.end]
            # logically, for our outline, we want to only use lines that
            # belong to exactly one map, so we'll use that to pick which way
            # to go.
            for d in potential_directions:
                if get_tally(d) > 1:
                    continue
                return d
        
        outline: list[MapSpaceLineSegment] = [starting_line]
        active_line = find_next_line(starting_line)
        while active_line != starting_line:
            outline.append(active_line)
            active_line = find_next_line(active_line)
        
        self._outline = Polygon(outline)
    

    @classmethod
    def maps_to_islands(cls, maps: list[Map]) -> list["Island"]:
        """Takes a list of maps with the same scale and divides them into
        islands."""
        for i in range(1, len(maps)):
            assert maps[i-1].scale == maps[i].scale
        maps = [*maps]
        
        map_index: dict[MapSpacePoint, Map] = {m.top_left: m for m in maps}
        """Indexes maps by their top-left point"""

        islands: list[Island] = []
        while len(maps) > 0:
            def search(search_start: Map, found: set[Map]):
                """this method finds all maps adjacent to `seach_start`, moves
                them from `maps` to `collection`, and then calls itself on them
                to find all maps adjacent to them and do the same thing, until
                it runs out of connected maps."""

                # search by the theoretical top left corners of the map to the
                # left, the map above, the map to the right, and the map below
                for adjacent_point in [
                    search_start.top_left + MapSpacePoint(-search_start.side_length, 0),
                    search_start.top_left + MapSpacePoint(0, -search_start.side_length),
                    search_start.top_right,
                    search_start.bottom_left
                ]:
                    if adjacent_point in map_index:
                        found_adj_map = map_index[adjacent_point]
                        found.add(found_adj_map)
                        # remove map so it doesn't get "found" and added to the
                        # island again ever
                        maps.remove(found_adj_map)
                        del map_index[adjacent_point]
                        search(found_adj_map, found)
            starting_map = maps.pop()
            del map_index[starting_map.top_left]
            collection = {starting_map}
            search(starting_map, collection)
            print(f"created island of size {len(collection)}")
            islands.append(Island(list(collection)))
        return islands
