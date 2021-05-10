from PIL import Image
import json
from pathlib import Path
import re
from collections import defaultdict

with open("colorchart.json") as color_chart_file:
    color_chart = json.load(color_chart_file)

for i in range(len(color_chart)):
    color_chart[i] = bytes(int(x) for x in color_chart[i].split(", "))

map_file_re = re.compile(r"map_(\d+).json")

processed_maps = defaultdict(list)

for file in Path('.').glob("map_*.json"):

    with open(file) as map_file:
        map_data = json.load(map_file)["data"]

    side_length = 128*2**map_data["scale"]
    zero_point = -64 + side_length/2
    relative_x = int((map_data["xCenter"]-zero_point)//side_length)
    relative_y = int((map_data["zCenter"]-zero_point)//side_length)

    color_codes = map_data["colors"]
    assert len(color_codes) == 128*128

    image_bytes = bytearray(128*128*4)
    blanks_encountered = 0
    max_blanks = 128*128/2
    for i in range(len(color_codes)):
        image_bytes[i*4:i*4+3] = color_chart[color_codes[i]]
        if color_chart[color_codes[i]] == b"\xff\xff\xff\x00":
            blanks_encountered += 1
        if blanks_encountered > max_blanks:
            break

    if not (blanks_encountered > max_blanks):
        map_id_match = map_file_re.search(str(file))
        map_id = map_id_match[1] or "no_id"

        map_image_filename = f"../public/maps/level{map_data['scale']}_{relative_x},{relative_y}_{map_id}.png"

        map_image = Image.frombytes("RGBA", (128, 128), bytes(image_bytes))
        map_image = map_image.resize((1024, 1024), resample=Image.NEAREST)
        map_image.save(map_image_filename, optimize=True)

        processed_maps["level"+str(map_data["scale"])].append({
            "x": relative_x,
            "y": relative_y,
            "file": map_image_filename,
            "blank_pixels": blanks_encountered
        })

        print("converted "+str(file))

    else:
        print(str(file)+" was mostly blank")

print("removing redundant maps...")
def get_coords(map_info): return f"{map_info['x']},{map_info['y']}"


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
