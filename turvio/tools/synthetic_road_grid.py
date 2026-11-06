#!/usr/bin/env python3
"""Write a SYNTHETIC street grid (OSM XML) over the Hannover pilot area.

Used only to test the OSRM integration end to end (extract -> contract -> routed ->
optimizer/API) where a real OpenStreetMap extract cannot be downloaded. Travel times
on this grid are NOT real Hannover road times.
"""
import sys

lat0, lat1, lng0, lng1 = 52.32, 52.44, 9.64, 9.84
step_lat, step_lng = 0.0027, 0.0044  # ~300 m blocks
rows = int((lat1 - lat0) / step_lat) + 1
cols = int((lng1 - lng0) / step_lng) + 1
out = ['<?xml version="1.0" encoding="UTF-8"?>', '<osm version="0.6" generator="turvio-synthetic-grid">']


def nid(r, c):
    return 1 + r * cols + c


for r in range(rows):
    for c in range(cols):
        out.append(f'<node id="{nid(r, c)}" lat="{lat0 + r * step_lat:.6f}" lon="{lng0 + c * step_lng:.6f}" version="1"/>')
wid = 1


def way(nodes, kind, name):
    global wid
    nd = "".join(f'<nd ref="{n}"/>' for n in nodes)
    out.append(f'<way id="{wid}" version="1">{nd}<tag k="highway" v="{kind}"/><tag k="name" v="{name}"/></way>')
    wid += 1


for r in range(rows):
    way([nid(r, c) for c in range(cols)], "primary" if r % 10 == 5 else "residential", f"Synthetische Querstrasse {r}")
for c in range(cols):
    way([nid(r, c) for r in range(rows)], "primary" if c % 10 == 5 else "residential", f"Synthetische Laengsstrasse {c}")
out.append("</osm>")
open(sys.argv[1] if len(sys.argv) > 1 else "synthetic-grid.osm", "w").write("\n".join(out))
