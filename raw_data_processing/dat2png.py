"""this script expects to be in the same folder as files with the naming scheme
map_00.dat (where any number can stand in for the 00); such files can be found in the
"data" folder of your minecraft level directory. it then takes those files, generates
pngs that depict the maps that they represent, and places those pngs in the
"public/maps" folder of this repository, also placing metadata about them in a json
file in the "src/mapdata" directory."""

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

for file in Path('.').glob("map_*.dat"):

    with open(file, "rb") as data_file:
        raw_data = gzip.decompress(data_file.read())

    map_scale = nbt_search(raw_data, b'scale', 'byte')
    map_x_center = nbt_search(raw_data, b'xCenter', 'int')
    map_z_center = nbt_search(raw_data, b'zCenter', 'int')

    side_length = 128*2**map_scale
    zero_point = -64 + side_length/2
    relative_x = int((map_x_center-zero_point)//side_length)
    relative_y = int((map_z_center-zero_point)//side_length)

    color_codes = nbt_search(raw_data, b'colors', 'bytes')
    assert len(color_codes) == 128*128

    image_bytes = bytearray(128*128*4)
    blanks_encountered = 0
    max_blanks = 128*128/2
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
            "x": relative_x,
            "y": relative_y,
            "file": map_image_filename,
            "blank_pixels": blanks_encountered
        })

        print("converted "+str(file))

    else:
        print(str(file)+" was mostly blank")

print("removing redundant maps...")


def get_coords(map_info):
    return f"{map_info['x']},{map_info['y']}"


for scale_level in processed_maps.values():
    scale_level.sort(key=get_coords)
    i = 1
    while i < len(scale_level):
        if get_coords(scale_level[i]) == get_coords(scale_level[i-1]):
            if scale_level[i]["blank_pixels"] > scale_level[i-1]["blank_pixels"]:
                deleted = scale_level.pop(i)
            else:
                deleted = scale_level.pop(i-1)
            Path(deleted["file"]).unlink()
        else:
            i += 1

    for final_map_data in scale_level:
        final_map_data["file"] = final_map_data["file"].split("/")[-1]

with open("../src/mapdata/processed_maps.json", "w+") as output_record:
    json.dump(processed_maps, output_record)
print("done")
