#!/usr/bin/env python3
"""Extract German postal addresses from an OpenStreetMap extract into CSV.

Usage:
  python3 tools/osm_addresses.py niedersachsen-latest.osm.pbf > addresses.csv
  (then: cd apps/api && npx tsx src/scripts/import-addresses.ts addresses.csv)

Takes nodes, buildings (ways) and multipolygon relations with addr:street +
addr:housenumber + addr:postcode (+ addr:city or addr:suburb); ways and relations get
the centroid of their (outer) nodes.
Output columns: street;house_number;postcode;city;lat;lng
Requires pyosmium (pip install osmium). Data: © OpenStreetMap contributors, ODbL –
keep the attribution wherever results are shown.
"""
import csv
import sys

import osmium


class Addresses(osmium.SimpleHandler):
    def __init__(self, writer):
        super().__init__()
        self.w = writer
        self.count = 0

    def _emit(self, tags, lat, lng):
        street = tags.get("addr:street") or tags.get("addr:place")
        hn = tags.get("addr:housenumber")
        pc = tags.get("addr:postcode", "")
        city = tags.get("addr:city") or tags.get("addr:suburb") or ""
        if not street or not hn or len(pc) != 5 or not pc.isdigit() or not city:
            return
        self.w.writerow([street, hn, pc, city, f"{lat:.7f}", f"{lng:.7f}"])
        self.count += 1

    def node(self, n):
        if "addr:housenumber" in n.tags and n.location.valid():
            self._emit(n.tags, n.location.lat, n.location.lon)

    def way(self, w):
        if "addr:housenumber" not in w.tags:
            return
        pts = [(nd.lat, nd.lon) for nd in w.nodes if nd.location.valid()]
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts = pts[:-1]  # closed way: do not count the first node twice
        if pts:
            self._emit(w.tags, sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))

    def area(self, a):
        # Closed ways are handled in way(); here only multipolygon relations
        # (large buildings, e.g. town halls) – centroid of the outer rings' nodes.
        if a.from_way() or "addr:housenumber" not in a.tags:
            return
        pts = []
        for ring in a.outer_rings():
            ring_pts = [(nd.lat, nd.lon) for nd in ring if nd.location.valid()]
            pts.extend(ring_pts[:-1] if len(ring_pts) > 1 and ring_pts[0] == ring_pts[-1] else ring_pts)
        if pts:
            self._emit(a.tags, sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def main(path):
    writer = csv.writer(sys.stdout, delimiter=";")
    writer.writerow(["street", "house_number", "postcode", "city", "lat", "lng"])
    h = Addresses(writer)
    h.apply_file(path, locations=True)
    print(f"{h.count} addresses", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
