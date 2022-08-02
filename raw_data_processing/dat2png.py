"""this script expects to be given a folder as a "put_raw_data_here" directory
with files with the naming scheme map_00.dat (where any number can stand in for the
00); such files can be found in the "data" folder where your minecraft level is
stored. it then takes those files, generates pngs that depict the maps that they
represent, and places those pngs in the "public/maps" folder of this repository, also
placing metadata about them in a json file in the "src/mapdata" directory."""

from os import PathLike
import json
from pathlib import Path
import re
from collections import defaultdict
from argparse import ArgumentParser

from PIL import Image
from PIL.Image import Resampling
import pyximport
pyximport.install()

from models import Map, Island
from fast_nbt_convert import convert


# MUST be a multiple of 128 (the edge length in pixels of the maps in the DATs)
MAP_SIZE_PX = 1024

# regular expression that extracts the id of a map from the filename of a .dat that
# contains a map
map_file_re = re.compile(r"map_(\d+).dat")


def process_all(raw_data_path: PathLike) -> None:
    processed_maps: dict[int, list[Map]] = defaultdict(list)
    unused_maps: list[Map] = []

    try:
        with open("./skip_these_maps.json") as blacklist_file:
            skips = json.load(blacklist_file)["ids"]
    except:
        skips = []

    map_dats = list(Path(raw_data_path).glob("map_*.dat"))

    for i, file in enumerate(map_dats):
        progress_string = f" ({i+1}/{len(map_dats)})"

        map_id = int(map_file_re.search(str(file))[1])

        if map_id in skips:
            print("skipping map "+str(file) +
                  " in accordance with config file"+progress_string)
            continue

        map_data: Map = convert(str(file), map_id)
        if (map_data.dimension != "minecraft:overworld"):
            print(f"skipping non-overworld map {file} ({map_data.dimension})")
            continue

        max_blanks = 128*128/4

        if not (map_data.blank_pixels > max_blanks):
            print("acquired "+file.name+progress_string)
            processed_maps[map_data.scale].append(map_data)
        else:
            print(file.name+" was mostly blank; discarding" + progress_string)

    print("filtering out redundant maps and converting the rest to PNGs...")

    for scale_level, maps in processed_maps.items():
        # sort the maps so that maps with the same coords are next to each other and
        # within groups of maps with the same coords, they are sorted newest to oldest
        # based on their ids.
        maps.sort(key=lambda x: (x.top_left, -x.id))
        i = 1
        while i < len(maps):
            if maps[i].top_left == maps[i-1].top_left:
                unused_maps.append(maps[i])
                maps.pop(i)
            else:
                i += 1

        print(f"PNGifying {len(maps)} level {scale_level} maps:")
        for i, map in enumerate(maps, start=1):
            map_image_path = (f"../public/maps/Level{map.scale}"
                              f"MapAt{map.top_left}.{map.image_hash()}.png")
            if not Path(map_image_path).exists():
                map_image = Image.frombytes("RGBA", (128, 128), map.rgba)
                map_image = map_image.resize(
                    (MAP_SIZE_PX, MAP_SIZE_PX), resample=Resampling.NEAREST)
                map_image.save(map_image_path, optimize=True)
            map.file = map_image_path.split("/")[-1]
            print(f"\rsaved {i}/{len(maps)}", end="")
        print()

    processed_maps["unused_maps"] = unused_maps

    islands = {}
    for k, v in processed_maps.items():
        if k != "unused_maps":
            islands[k] = [x.to_dict() for x in Island.maps_to_islands(v)]

    with open("../src/mapdata/processed_maps.json", "w+") as output_record:
        json.dump(islands, output_record)
    print("done")


if __name__ == "__main__":
    parser = ArgumentParser("Convert Minecraft DAT files named things like map_00.dat to PNGs")
    parser.add_argument(
        "--raw_data_path", '-r', type=str, required=True,
        help="path to the Minecraft DAT files you are converting")
    args = parser.parse_args()
    process_all(args.raw_data_path)
