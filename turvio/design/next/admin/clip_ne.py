import json, sys
RAW = sys.argv[1]
B = (8.9, 49.3, 12.7, 51.7)
inb = lambda x, y: B[0] <= x <= B[2] and B[1] <= y <= B[3]
def lines(geom):
    t = geom['type']; c = geom['coordinates']
    if t == 'LineString': return [c]
    if t == 'MultiLineString': return c
    if t == 'Polygon': return [c[0]]
    if t == 'MultiPolygon': return [p[0] for p in c]
    return []
def simp(pts, tol=0.004):
    out = [];
    for p in pts:
        if not out or abs(p[0]-out[-1][0]) + abs(p[1]-out[-1][1]) > tol: out.append([round(p[0], 4), round(p[1], 4)])
    if out and out[-1] != [round(pts[-1][0],4), round(pts[-1][1],4)]: out.append([round(pts[-1][0],4), round(pts[-1][1],4)])
    return out
def clipped(pts):
    segs, cur = [], []
    for p in pts:
        if inb(*p[:2]): cur.append(p[:2])
        else:
            if cur: cur.append(p[:2]); segs.append(cur); cur = []
    if cur: segs.append(cur)
    return [s for s in segs if len(s) > 1]
def load(n): return json.load(open(f'{RAW}/{n}.geojson'))['features']
out = {}
roads = []
for f in load('ne_10m_roads'):
    pr = f['properties']; typ = pr.get('type') or ''; 
    for l in lines(f['geometry']):
        for s in clipped(l): roads.append({'t': 'm' if 'Major' in typ or pr.get('expressway') == 1 else 'r', 'n': pr.get('name') or '', 'c': simp(s, .002)})
out['roads'] = roads
out['rail'] = [simp(s, .003) for f in load('ne_10m_railroads') for l in lines(f['geometry']) for s in clipped(l)]
out['rivers'] = [{'n': f['properties'].get('name') or '', 'c': simp(s, .002)} for n in ('ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe') for f in load(n) for l in lines(f['geometry']) for s in clipped(l)]
def polys(n, keep=lambda p: True, tol=.002):
    res = []
    for f in load(n):
        if not keep(f['properties']): continue
        g = f['geometry']; ps = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates'] if g['type'] == 'MultiPolygon' else []
        for p in ps:
            ring = p[0]
            if any(inb(*q[:2]) for q in ring): res.append({'n': f['properties'].get('name') or f['properties'].get('NAME') or '', 'c': simp(ring, tol)})
    return res
out['lakes'] = polys('ne_10m_lakes') + polys('ne_10m_lakes_europe')
out['urban'] = polys('ne_10m_urban_areas', tol=.001)
out['states'] = [{'n': s['n'], 'c': s['c']} for s in polys('ne_10m_admin_1_states_provinces', lambda p: p.get('iso_a2') == 'DE', tol=.006)]
out['places'] = [{'n': f['properties']['name'], 'x': round(f['geometry']['coordinates'][0], 4), 'y': round(f['geometry']['coordinates'][1], 4), 'r': f['properties'].get('scalerank', 9), 'p': f['properties'].get('pop_max', 0)} for f in load('ne_10m_populated_places_simple') if inb(*f['geometry']['coordinates'][:2])]
json.dump(out, open('ne_region.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print({k: len(v) for k, v in out.items()})
print(sorted(set(r['n'] for r in roads if r['n']))[:40])
print([p['n'] for p in sorted(out['places'], key=lambda p: p['r'])][:40])
print([s['n'] for s in out['states']], [u['n'] for u in out['lakes']][:10])
