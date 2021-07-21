#cython: language_level=3
import json
import gzip
from cpython cimport array
import array
from libc.string cimport memcmp

with open("colorchart.json") as chart_file:
    color_chart_json = json.load(chart_file)
flat_color_chart = []
for rgba in color_chart_json:
    for x in rgba:
        flat_color_chart.append(x)

cdef color_chart_array = array.array("B", flat_color_chart)
cdef unsigned char[:] color_chart = color_chart_array

def nbt_search(unsigned char[:] nbt_bytes, unsigned char[] key, int key_length, char * value_type):
    # using .find to scan through the whole bytes object for each separate key seems
    # bad, but in the files i've seen the keys we want are always close to the
    # beginning; if this is not always the case, this function could be made a
    # constructor for a class so that it only scans through and parses the file once
    # and builds a dict of data that it refers to on search calls
    cdef int i
    cdef int pos
    for i in range(0, len(nbt_bytes)):
        if memcmp(&nbt_bytes[i], &key[0], key_length) == 0:
            pos = i + key_length
            break
    if value_type == b"int":
        return int.from_bytes(nbt_bytes[pos:pos+4], byteorder="big", signed=True)
    elif value_type == b"byte":
        return int.from_bytes(nbt_bytes[pos:pos+1], byteorder="big", signed=True)
    elif value_type == b"bytes":
        size = nbt_search(nbt_bytes, key, key_length, b"int")
        return nbt_bytes[pos+4:pos+4+size]


def convert(str file_path):
    with open(file_path, "rb") as data_file:
        nbt_data = gzip.decompress(data_file.read())
    cdef nbt_array = array.array("B", nbt_data)
    cdef unsigned char[:] nbt_access = nbt_array
    map_scale = nbt_search(nbt_access, b'scale', len('scale'), b'byte')
    map_x_center = nbt_search(nbt_access, b'xCenter', len('xCenter'), b'int')
    map_z_center = nbt_search(nbt_access, b'zCenter', len('zCenter'), b'int')
    map_color_data = nbt_search(nbt_access, b'colors', len('colors'), b'bytes')
    rgba_color_data = array.array("B", [0]*128*128*4)
    cdef int i, j, initial_code, modifier_code, multiplier
    cdef int blanks_encountered = 0
    for i in range(0, 128*128*4, 4):
            initial_code = map_color_data[i//4]
            modifier_code = initial_code % 4
            if modifier_code == 0:
                multiplier = 180
            elif modifier_code == 1:
                multiplier = 220
            elif modifier_code == 2:
                multiplier = 255
            elif modifier_code == 3:
                multiplier = 135
            base_color = color_chart[(initial_code//4)*4:((initial_code//4)*4)+4]
            rgba_color_data[i] = base_color[0] * multiplier // 255
            rgba_color_data[i+1] = base_color[1] * multiplier // 255
            rgba_color_data[i+2] = base_color[2] * multiplier // 255
            rgba_color_data[i+3] = base_color[3]
            if base_color[3] == 0:
                blanks_encountered += 1

    file_name = file_path.split("/")[-1].split("\\")[-1]
    output_file = "./temp/"+file_name+"_temp.bin"
    with open(output_file, "wb+") as output:
        output.write(rgba_color_data.tobytes())
    
    return {"scale": map_scale, "blanks": blanks_encountered, "relative_x": map_x_center, "relative_z": map_z_center, "temp_file": output_file }
