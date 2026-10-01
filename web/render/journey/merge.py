"""Interleave the original 120-frame film (even indices of the 239-frame
film) with the rendered in-between frames (odd indices).

    /opt/bl/bin/python merge.py desktop      # -> /tmp/journey2/all/desktop
"""

import os
import shutil
import sys

cam = sys.argv[1]
even = f"/tmp/journey/post/{cam}"
odd = f"/tmp/journey2/post/{cam}"
out = f"/tmp/journey2/all/{cam}"
os.makedirs(out, exist_ok=True)
n = 0
for j in range(120):
    shutil.copyfile(os.path.join(even, f"f{j:03d}.png"), os.path.join(out, f"f{2 * j:03d}.png"))
    n += 1
for i in range(1, 238, 2):
    shutil.copyfile(os.path.join(odd, f"f{i:03d}.png"), os.path.join(out, f"f{i:03d}.png"))
    n += 1
print(cam, n, "frames")
