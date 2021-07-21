# profile.py

import pstats, cProfile

import pyximport
pyximport.install()

from fast_nbt_convert import convert

cProfile.runctx("""
for i in range(0, 60):
    convert(f'./put_raw_data_here/map_{i}.dat')
""", globals(), locals(), "Profile.prof")

s = pstats.Stats("Profile.prof")
s.strip_dirs().sort_stats("time").print_stats()