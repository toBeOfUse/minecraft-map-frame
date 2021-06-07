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


with open("./colorchart.json") as color_chart_file:
    color_chart = json.load(color_chart_file)

for i in range(len(color_chart)):
    color_chart[i] = bytes(int(x) for x in color_chart[i].split(", "))

map_file_re = re.compile(r"map_(\d+).dat")

processed_maps = defaultdict(list)

try:
    with open("./skip_these_maps.json") as blacklist_file:
        skips = json.load(blacklist_file)["ids"]
except:
    skips = []

for file in Path('./put_raw_data_here/').glob("map_*.dat"):

    map_id_match = map_file_re.search(str(file))
    map_id = map_id_match[1] or "no_id"
    if int(map_id) in skips:
        print("skipping map "+str(file)+" in accordance with config file")
        continue

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
        map_id_match = map_file_re.search(str(file))
        map_id = map_id_match[1] or "no_id"

        map_image_filename = f"../public/maps/level{map_scale}_{relative_x},{relative_y}_{map_id}.png"

        map_image = Image.frombytes("RGBA", (128, 128), bytes(image_bytes))
        map_image = map_image.resize((1024, 1024), resample=Image.NEAREST)
        map_image.save(map_image_filename, optimize=True)

        processed_maps["level"+str(map_scale)].append({
            "id": map_id,
            "x": relative_x,
            "y": relative_y,
            "file": map_image_filename,
            "blank_pixels": blanks_encountered
        })

        print("converted "+file.name)

    else:
        print(file.name+" was mostly blank")

print("removing redundant maps...")


def get_coords(map_info):
    return f"{map_info['x']},{map_info['y']}"


redundant_files = []
for scale_level in processed_maps.values():
    # sort the maps so that maps with the same coords are next to each other and
    # within groups of maps with the same coords, they are sorted newest to oldest.

    # potential TODO: if the pixels in two maps of the same area are identical, the
    # more-filled-out map should take precedence regardless of whether it's newer,
    # because the newer map doesn't have anything new. this might take a while to
    # determine, though; map comparisons would have to be done byte-by-byte so that
    # pixels that are transparent in either map could be skipped
    scale_level.sort(key=lambda x: (get_coords(x), -int(x["id"])))
    i = 1
    while i < len(scale_level):
        if get_coords(scale_level[i]) == get_coords(scale_level[i-1]):
            # mark older maps with the same coords as newer ones as redundant
            redundant_files.append(scale_level[i]["file"])
            scale_level.pop(i)
        else:
            i += 1

    for final_map_data in scale_level:
        final_map_data["file"] = final_map_data["file"].split("/")[-1]

for file in redundant_files:
    try:
        print("removing redundant map", file)
        Path(file).unlink()
    except:
        print("could not delete redundant file " + file)

with open("../src/mapdata/processed_maps.json", "w+") as output_record:
    json.dump(processed_maps, output_record)
print("done")
