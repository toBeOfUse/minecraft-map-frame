"""this script expects to be given a folder as a "put_raw_data_here" directory
with files with the naming scheme map_00.dat (where any number can stand in for the
00); such files can be found in the "data" folder where your minecraft level is
stored. it then takes those files, generates pngs that depict the maps that they
represent, and places those pngs in the "public/maps" folder of this repository, also
placing metadata about them in a json file in the "src/mapdata" directory."""


import pyximport
pyximport.install()
from fast_nbt_convert import convert

from argparse import ArgumentParser
from base64 import urlsafe_b64encode as b64
from hashlib import blake2b
from collections import defaultdict
import re
from pathlib import Path
import json
from PIL import Image


def get_coords_string(map_info):
    return f"{map_info['x']},{map_info['y']}"


# MUST be a multiple of 128 (the edge length in pixels of the maps in the DATs)
MAP_SIZE_PX = 1024

# regular expression that extracts the id of a map from the filename of a .dat that
# contains a map
map_file_re = re.compile(r"map_(\d+).dat")


def process_all(raw_data_path):
    processed_maps = defaultdict(list)
    unused_maps = defaultdict(list)

    try:
        with open("./skip_these_maps.json") as blacklist_file:
            skips = json.load(blacklist_file)["ids"]
    except:
        skips = []

    map_dats = list(Path(raw_data_path).glob("map_*.dat"))

    for i, file in enumerate(map_dats):
        progress_string = f" ({i+1}/{len(map_dats)})"

        map_id_match = map_file_re.search(str(file))
        map_id = map_id_match[1] or "no_id"

        if int(map_id) in skips:
            print("skipping map "+str(file) +
                  " in accordance with config file"+progress_string)
            continue

        map_data = convert(str(file))

        # side length in blocks of the relevant map
        side_length = 128*2**map_data["scale"]
        # by default, the coordinates of the top left corner of minecraft maps have the
        # form -64 + (sideLength)(distanceFromOrigin//sideLength), so that a level 0
        # (128x128) map made less than a side length away from the origin will be
        # centered on it (thus having a top left corner at -64, -64.) This is excessively
        # complex, so in this application the top left corner of a map that contains the
        # in-game origin will always have coordinates 0, 0. the coordinates of said top
        # left corner are what we are storing, here.
        relative_x = int(map_data["relative_x"] - side_length/2 + 64)
        relative_y = int(map_data["relative_z"] - side_length/2 + 64)

        map_object = {
            "id": map_id,
            "x": relative_x,
            "y": relative_y,
            "temp_file": map_data["temp_file"]
        }

        max_blanks = 128*128/4

        if not (map_data["blanks"] > max_blanks):
            print("acquired "+file.name+progress_string)
            processed_maps[f"level{map_data['scale']}"].append(
                map_object
            )
        else:
            print(file.name+" was mostly blank; discarding" + progress_string)

    print("filtering out redundant maps and converting the rest to PNGs...")

    for scale_level, maps in processed_maps.items():
        # sort the maps so that maps with the same coords are next to each other and
        # within groups of maps with the same coords, they are sorted newest to oldest
        # based on their ids.
        maps.sort(key=lambda x: (get_coords_string(x), -int(x["id"])))
        i = 1
        while i < len(maps):
            if get_coords_string(maps[i]) == get_coords_string(maps[i-1]):
                # mark older maps with the same coords as newer ones as unused
                map_desc = f"{scale_level}_{maps[i]['x']},{maps[i]['y']}"
                unused_maps[map_desc].append(maps[i])
                maps.pop(i)
            else:
                i += 1

        print(f"PNGifying {len(maps)} level {scale_level[-1]} maps:")
        for i, final_map_data in enumerate(maps, start=1):
            
            with open(final_map_data["temp_file"], "rb") as temp_image:
                image_bytes = temp_image.read()
            image_hash = b64(blake2b(image_bytes, digest_size=12).digest()).decode("utf-8")
            map_image_path = f"../public/maps/{scale_level}"
            map_image_path += f"_{final_map_data['x']},{final_map_data['y']}"
            map_image_path += f"_{final_map_data['id']}.{image_hash}.png"
            if not Path(map_image_path).exists():
                map_image = Image.frombytes("RGBA", (128, 128), image_bytes)
                map_image = map_image.resize(
                    (MAP_SIZE_PX, MAP_SIZE_PX), resample=Image.NEAREST)
                map_image.save(map_image_path, optimize=True)
            final_map_data["file"] = map_image_path.split("/")[-1]
            Path(final_map_data["temp_file"]).unlink()
            del final_map_data["temp_file"]
            print(f"\rsaved {i}/{len(maps)}", end="")
        print()

    processed_maps["unused_maps"] = unused_maps

    with open("../src/mapdata/processed_maps.json", "w+") as output_record:
        json.dump(processed_maps, output_record)
    print("done")


if __name__ == "__main__":
    parser = ArgumentParser("Convert Minecraft DAT files named things like map_00.dat to PNGs")
    parser.add_argument(
        "--raw_data_path", '-r', type=str, required=True,
        help="path to the Minecraft DAT files you are converting")
    args = parser.parse_args()
    process_all(args.raw_data_path)
