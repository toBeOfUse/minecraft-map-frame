"""this script expects to be in the same folder as a "put_raw_data_here" directory
with files with the naming scheme map_00.dat (where any number can stand in for the
00); such files can be found in the "data" folder where your minecraft level is
stored. it then takes those files, generates pngs that depict the maps that they
represent, and places those pngs in the "public/maps" folder of this repository, also
placing metadata about them in a json file in the "src/mapdata" directory."""

from PIL import Image
import json
from pathlib import Path
import re
from collections import defaultdict
import gzip

# MUST be a multiple of 128 (the edge length of the maps in the DATs)
MAP_SIZE_PX = 1024


def nbt_search(nbt_bytes, key, value_type):
    # using .find to scan through the whole bytes object for each separate key seems
    # bad, but in the files i've seen the keys we want are always close to the
    # beginning; if this is not always the case, this function could be made a
    # constructor for a class so that it only scans through and parses the file once
    # and builds a dict of data that it refers to on search calls
    pos = nbt_bytes.find(key)+len(key)
    if value_type == "int":
        return int.from_bytes(nbt_bytes[pos:pos+4], byteorder="big", signed=True)
    elif value_type == "byte":
        return int.from_bytes(nbt_bytes[pos:pos+1], byteorder="big", signed=True)
    elif value_type == "bytes":
        size = nbt_search(nbt_bytes, key, "int")
        return nbt_bytes[pos+4:pos+4+size]


# obtain the look-up table that converts dat data into colors
with open("./colorchart.json") as color_chart_file:
    color_chart = json.load(color_chart_file)

for i in range(len(color_chart)):
    color_chart[i] = bytes(int(x) for x in color_chart[i].split(", "))

# regular expression that extracts the id of a map from the filename of a .dat that
# contains a map
map_file_re = re.compile(r"map_(\d+).dat")

processed_maps = defaultdict(list)
unused_maps = defaultdict(list)

try:
    with open("./skip_these_maps.json") as blacklist_file:
        skips = json.load(blacklist_file)["ids"]
except:
    skips = []

map_dats = list(Path('./put_raw_data_here/').glob("map_*.dat"))
for i, file in enumerate(map_dats):
    progress_string = f" ({i+1}/{len(map_dats)})"

    with open(file, "rb") as data_file:
        raw_data = gzip.decompress(data_file.read())

    # the scale is a value from 0 to 4, with 0 being the most zoomed-in map and 4
    # being the least
    map_scale = nbt_search(raw_data, b'scale', 'byte')
    # east-west coordinate
    map_x_center = nbt_search(raw_data, b'xCenter', 'int')
    # north-south coordinate
    map_z_center = nbt_search(raw_data, b'zCenter', 'int')

    # side length in blocks of the relevant map
    side_length = 128*2**map_scale
    # by default, the coordinates of the top left corner of minecraft maps have the
    # form -64 + (sideLength)(distanceFromOrigin//sideLength), so that a level 0
    # (128x128) map made less than a side length away from the origin will be
    # centered on it (thus having a top left corner at -64, -64.) This is excessively
    # complex, so in this application the top left corner of a map that contains the
    # in-game origin will always have coordinates 0, 0. the coordinates of said top
    # left corner are what we are storing, here.
    relative_x = int(map_x_center - side_length/2 + 64)
    relative_y = int(map_z_center - side_length/2 + 64)

    map_id_match = map_file_re.search(str(file))
    map_id = map_id_match[1] or "no_id"

    map_image_path = f"../public/maps/level{map_scale}_{relative_x},{relative_y}_{map_id}.png"

    map_object = {
        "id": map_id,
        "x": relative_x,
        "y": relative_y,
    }

    if int(map_id) in skips:
        print("skipping map "+str(file) +
              " in accordance with config file"+progress_string)
        map_desc = f"level{map_scale}_{relative_x},{relative_y}"
        unused_maps[map_desc].append(
            map_object | {"deliberately_skipped": True})
        continue

    color_codes = nbt_search(raw_data, b'colors', 'bytes')
    assert len(color_codes) == 128*128

    image_bytes = bytearray(128*128*4)
    blanks_encountered = 0
    max_blanks = 128*128/4
    for i in range(0, len(color_codes)*4, 4):
        image_bytes[i:i+3] = color_chart[color_codes[int(i//4)]]
        if color_chart[color_codes[int(i//4)]] == b"\xff\xff\xff\x00":
            blanks_encountered += 1
        if blanks_encountered > max_blanks:
            break

    if not (blanks_encountered > max_blanks):

        map_image = Image.frombytes("RGBA", (128, 128), bytes(image_bytes))
        map_image = map_image.resize(
            (MAP_SIZE_PX, MAP_SIZE_PX), resample=Image.NEAREST)
        map_image.save(map_image_path, optimize=True)

        print("converted "+file.name+progress_string)
        processed_maps[f"level{map_scale}"].append(
            map_object | {"path": map_image_path}
        )

    else:
        print(file.name+" was mostly blank; discarding"+progress_string)

print("removing unused maps...")


def get_coords_string(map_info):
    return f"{map_info['x']},{map_info['y']}"


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
            unused_maps[map_desc].append(
                maps[i] | {"deliberately_skipped": False})
            maps.pop(i)
        else:
            i += 1

    for final_map_data in maps:
        final_map_data["file"] = final_map_data["path"].split("/")[-1]

processed_maps["unused_maps"] = unused_maps

# try to remove any actual files that were generated for maps that ended up unused
for unused_map in sum(unused_maps.values(), []):
    if "path" in unused_map:
        path = unused_map["path"]
        try:
            print("removing unused map", path)
            Path(path).unlink()
            del unused_map["path"]
            del unused_map["file"]
        except:
            print("could not delete unused file", path)

print("creating composite map...")
lowest_x = min(level3Map["x"] for level3Map in processed_maps["level3"])
lowest_y = min(level3Map["y"] for level3Map in processed_maps["level3"])
highest_x = max(level3Map["x"] for level3Map in processed_maps["level3"])
highest_y = max(level3Map["y"] for level3Map in processed_maps["level3"])
full_map_size = ((highest_x-lowest_x+MAP_SIZE_PX),
                 (highest_y-lowest_y+MAP_SIZE_PX))
print("composite map will be", full_map_size[0], "by", full_map_size[1])
full_map_image = Image.new("RGBA", full_map_size, (255, 255, 255, 0))
for i, level3_map in enumerate(processed_maps["level3"]):
    level3_map_image = Image.open(level3_map["path"])
    full_map_image.paste(
        level3_map_image, (level3_map["x"]-lowest_x, level3_map["y"]-lowest_y))
    print(f"\rpasted in {i+1}/{len(processed_maps['level3'])}", end="")
full_map_image.save("../public/maps/full_map_level_3.png")
print()

with open("../src/mapdata/processed_maps.json", "w+") as output_record:
    json.dump(processed_maps, output_record)
print("done")
