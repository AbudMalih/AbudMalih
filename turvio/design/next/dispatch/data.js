/* Synthetic dispatch data + illustrative route maths. Nothing here is real. */
const DATA = (() => {
  const rng = GEO.rng;
  const DEPOT = { x: 0.62, y: -3.95 };
  const angleAt = (x, y) => { for (const g of GEO.REG) if (x >= g[0] && x <= g[2] && y >= g[1] && y <= g[3]) return g[4] * Math.PI / 180; return 0; };
  const dist = (p, q) => { const a = angleAt(q.x, q.y), dx = q.x - p.x, dy = q.y - p.y; const u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a); return (Math.abs(u) + Math.abs(v)) * 1.06; };
  const corner = (p, q) => { const a = angleAt(q.x, q.y), dx = q.x - p.x, dy = q.y - p.y; const u = dx * Math.cos(a) + dy * Math.sin(a); return { x: p.x + u * Math.cos(a), y: p.y + u * Math.sin(a) }; };
  function routeKm(stops) { if (!stops.length) return 0; let d = dist(DEPOT, stops[0]); for (let i = 1; i < stops.length; i++) d += dist(stops[i - 1], stops[i]); return d + dist(stops[stops.length - 1], DEPOT); }
  const SPEED = 21, SERVICE = 2.4; // km/h, min per stop (illustrative)
  const routeMin = (stops) => routeKm(stops) / SPEED * 60 + stops.length * SERVICE;
  function optimize(stops) {
    const n = stops.length; if (n < 3) return stops.slice();
    const P = [DEPOT, ...stops]; const D = P.map(a => P.map(b => dist(a, b)));
    const used = new Array(n + 1).fill(false); used[0] = true; const ord = [0];
    for (let k = 0; k < n; k++) { const l = ord[ord.length - 1]; let best = -1, bd = 1e9; for (let j = 1; j <= n; j++) if (!used[j] && D[l][j] < bd) { bd = D[l][j]; best = j; } used[best] = true; ord.push(best); }
    ord.push(0);
    let improved = true, guard = 0;
    while (improved && guard++ < 60) { improved = false;
      for (let i = 1; i < ord.length - 2; i++) for (let j = i + 1; j < ord.length - 1; j++) {
        const a = ord[i - 1], b = ord[i], c = ord[j], d = ord[j + 1];
        if (D[a][c] + D[b][d] < D[a][b] + D[c][d] - 1e-9) { ord.splice(i, j - i + 1, ...ord.slice(i, j + 1).reverse()); improved = true; } } }
    // time-window stops first if they slipped late: keep simple – move window stops into first half when beyond
    return ord.slice(1, -1).map(i => stops[i - 1]);
  }
  const fmtT = (min) => { min = Math.round(min); const h = Math.floor(min / 60) % 24, m = min % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };
  function etas(stops, startMin = 450) { const out = []; let t = startMin, prev = DEPOT; for (const s of stops) { t += dist(prev, s) / SPEED * 60; out.push(t); t += SERVICE; prev = s; } return out; }

  const STREETS = {
    list: [['Lister Meile', '30161'], ['Podbielskistraße', '30163'], ['Wedekindstraße', '30161'], ['Jakobistraße', '30163'], ['Ferdinand-Wallbrecht-Str.', '30163'], ['Bödekerstraße', '30161'], ['Kollenrodtstraße', '30163'], ['Celler Straße', '30161'], ['Spichernstraße', '30161']],
    linden: [['Limmerstraße', '30451'], ['Fössestraße', '30451'], ['Davenstedter Straße', '30449'], ['Stärkestraße', '30451'], ['Elisenstraße', '30451'], ['Fannystraße', '30451'], ['Deisterstraße', '30449'], ['Charlottenstraße', '30449'], ['Kötnerholzweg', '30451']],
    sued: [['Hildesheimer Straße', '30169'], ['Sallstraße', '30171'], ['Geibelstraße', '30173'], ['Stolzestraße', '30171'], ['Krausenstraße', '30171'], ['Böhmerstraße', '30173'], ['Altenbekener Damm', '30173'], ['Heidornstraße', '30171'], ['Alte Döhrener Str.', '30173']],
    nord: [['Engelbosteler Damm', '30167'], ['Vahrenwalder Straße', '30165'], ['Kopernikusstraße', '30167'], ['Schaufelder Straße', '30167'], ['Callinstraße', '30167'], ['Haltenhoffstraße', '30167'], ['Wiesenstraße', '30169'], ['Melanchthonstraße', '30165']],
    klee: [['Kirchröder Straße', '30625'], ['Berckhusenstraße', '30625'], ['Scheidestraße', '30625'], ['Sutelstraße', '30659'], ['Pinkenburger Straße', '30655'], ['Roderbruchstraße', '30655'], ['Karl-Wiechert-Allee', '30625']],
    doeh: [['Hildesheimer Straße', '30519'], ['Peiner Straße', '30519'], ['Fiedelerstraße', '30519'], ['Wiehbergstraße', '30519'], ['Abelmannstraße', '30519'], ['Bothmerstraße', '30519'], ['Brückstraße', '30519'], ['Am Lindenhofe', '30519']]
  };
  function genStops(seed, cx, cy, rx, ry, n, key, tourId) {
    const r = rng(seed), out = [], a = angleAt(cx, cy), ca = Math.cos(a), sa = Math.sin(a), sp = .085;
    const cand = [];
    for (let u = -rx; u <= rx; u += sp) for (let v = -ry; v <= ry; v += sp * 1.25) { if ((u * u) / (rx * rx) + (v * v) / (ry * ry) > 1) continue; cand.push([u + (r() - .5) * .03, v + (r() - .5) * .03]); }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const st = STREETS[key];
    for (let i = 0; i < n && i < cand.length; i++) { const [u, v] = cand[i]; const [s, z] = st[Math.floor(r() * st.length)];
      out.push({ id: tourId + '-' + i, x: cx + u * ca - v * sa, y: cy + u * sa + v * ca, street: s, no: 1 + Math.floor(r() * 140), zip: z, parcels: 1 + (r() < .7 ? 0 : r() < .7 ? 1 : 2 + Math.floor(r() * 3)), win: r() < .04 ? (r() < .5 ? '12:00' : '10:00') : null, status: 'open', note: r() < .06 ? 'Hinterhof' : null }); }
    return out;
  }
  const DRIVERS = [['d1', 'R. Neumann'], ['d2', 'D. Popescu'], ['d3', 'K. Schulz'], ['d4', 'M. Ahmadi'], ['d5', 'L. Wagner'], ['d6', 'J. Weber'], ['d7', 'N. Haddad'], ['d8', 'C. Ionescu']].map(([id, name]) => ({ id, name, ini: name.split(' ').map(s => s[0]).join('').replace('.', '') }));
  const VEHICLES = [['v1', 'H-JL 101', 'Transporter 3,5 t', 220], ['v2', 'H-JL 102', 'Transporter 3,5 t', 220], ['v3', 'H-JL 103', 'E-Transporter', 180], ['v4', 'H-JL 104', 'Sprinter Kasten', 260], ['v5', 'H-JL 105', 'Transporter 3,5 t', 220], ['v6', 'H-JL 106', 'E-Transporter', 180], ['v7', 'H-JL 107', 'Sprinter Kasten', 260], ['v8', 'H-JL 108', 'Transporter 3,5 t', 220]].map(([id, plate, type, cap]) => ({ id, plate, type, cap }));
  const COLORS = ['var(--violet-hi)', 'var(--cobalt)', 'var(--cyan)', 'var(--mint)', 'var(--amber)', 'var(--coral)', '#B07CFF', '#5FB3FF'];
  const NOW = 15 * 60 + 20;
  function mkTour(o) {
    let stops = genStops(o.seed, o.cx, o.cy, o.rx, o.ry, o.n, o.key, o.code);
    if (o.optimized) stops = optimize(stops);
    else { // realistic file order: roughly by area, with the disorder a real export has
      stops = optimize(stops); const r = rng(o.seed + 3);
      for (let k = 0; k < Math.round(stops.length * .16); k++) { const i = Math.floor(r() * stops.length), j = Math.floor(r() * stops.length); const [s] = stops.splice(i, 1); stops.splice(j, 0, s); }
      for (let k = 0; k < 2; k++) { const i = Math.floor(r() * (stops.length - 12)); const seg = stops.splice(i, 8).reverse(); stops.splice(Math.floor(r() * stops.length), 0, ...seg); }
      stops[3].win = '10:00'; stops[Math.floor(stops.length * .4)].win = '12:00'; stops[Math.floor(stops.length * .7)].win = '12:00'; }
    const t = { ...o, stops, optimized: !!o.optimized };
    if (o.done != null) { const r = rng(o.seed + 9); stops.forEach((s, i) => { if (i < o.done) s.status = r() < .035 ? 'failed' : 'done'; }); }
    return t;
  }
  const TOURS = [
    mkTour({ id: 't1', code: 'HAN-01', area: 'List · Oststadt', key: 'list', cx: 1.2, cy: -1.75, rx: .95, ry: .75, n: 94, seed: 11, color: 0, driver: 'd1', vehicle: 'v1', day: 0, status: 'active', done: 58, optimized: true, tracking: 'sim', seen: '15:18' }),
    mkTour({ id: 't2', code: 'HAN-02', area: 'Linden', key: 'linden', cx: -1.75, cy: 0.85, rx: .85, ry: .9, n: 88, seed: 22, color: 1, driver: 'd2', vehicle: 'v2', day: 0, status: 'active', done: 71, optimized: true, tracking: 'sim', seen: '15:19' }),
    mkTour({ id: 't3', code: 'HAN-03', area: 'Südstadt', key: 'sued', cx: 1.6, cy: 2.2, rx: .9, ry: 1.0, n: 96, seed: 33, color: 2, driver: 'd3', vehicle: 'v3', day: 0, status: 'active', done: 40, delay: 24, optimized: true, tracking: 'sim', seen: '15:17' }),
    mkTour({ id: 't4', code: 'HAN-04', area: 'Nordstadt · Vahrenwald', key: 'nord', cx: -0.55, cy: -2.1, rx: .9, ry: .85, n: 90, seed: 44, color: 3, driver: 'd4', vehicle: 'v4', day: 0, status: 'active', done: 52, optimized: true, tracking: 'sim', seen: '15:19' }),
    mkTour({ id: 't5', code: 'HAN-05', area: 'Kleefeld · Groß-Buchholz', key: 'klee', cx: 5.05, cy: -0.9, rx: .9, ry: 1.1, n: 84, seed: 55, color: 4, driver: 'd5', vehicle: 'v5', day: 0, status: 'active', done: 33, optimized: true, tracking: 'off', seen: '14:02' }),
    mkTour({ id: 't6', code: 'HAN-06', area: 'Döhren · Wülfel', key: 'doeh', cx: 2.3, cy: 5.0, rx: 1.0, ry: .8, n: 92, seed: 66, color: 5, driver: null, vehicle: null, day: 1, status: 'draft', optimized: false })
  ];
  function importTour(code) {
    return mkTour({ id: 't' + Date.now(), code, area: 'Südstadt · Bult', key: 'sued', cx: 2.05, cy: 1.2, rx: .7, ry: .75, n: 86, seed: 77, color: 6, driver: null, vehicle: null, day: 1, status: 'draft', optimized: false });
  }
  return { DEPOT, TOURS, DRIVERS, VEHICLES, COLORS, NOW, dist, corner, routeKm, routeMin, optimize, etas, fmtT, angleAt, importTour, SPEED, SERVICE, mkTour };
})();
