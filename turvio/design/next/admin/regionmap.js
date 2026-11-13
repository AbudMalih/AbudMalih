/* Regional analytics map: real geography (Natural Earth, public domain) + synthetic operational overlays. */
const RM = (() => {
  const G = NE_REGION;
  const LON0 = 8.9, LAT1 = 51.7, K = Math.cos(50.5 * Math.PI / 180) * 1000;
  const P = (lon, lat) => [(lon - LON0) * K, (LAT1 - lat) * 1000];
  const WORLD = { w: (12.7 - 8.9) * K, h: (51.7 - 49.3) * 1000 };
  const TOWNS = [['Gotha', 10.70, 50.95, 2], ['Meiningen', 10.41, 50.57, 2], ['Bamberg', 10.89, 49.89, 1], ['Arnstadt', 10.95, 50.83, 3], ['Weimar', 11.33, 50.98, 2], ['Eisenach', 10.32, 50.98, 2],
    ['Sonneberg', 11.17, 50.36, 3], ['Hildburghausen', 10.73, 50.43, 3], ['Bad Kissingen', 10.08, 50.20, 3], ['Fulda', 9.68, 50.55, 1], ['Kronach', 11.33, 50.24, 3], ['Saalfeld', 11.36, 50.65, 3], ['Schmalkalden', 10.45, 50.72, 3], ['Lichtenfels', 11.06, 50.14, 3]];
  const STATES = [['THÜRINGEN', 11.15, 50.86], ['BAYERN', 10.55, 49.72], ['HESSEN', 9.35, 50.45], ['SACHSEN', 12.45, 50.55], ['SACHSEN-ANHALT', 11.75, 51.52], ['NIEDERSACHSEN', 9.55, 51.6]];
  const pathOf = (c, close) => { let d = ''; c.forEach((p, i) => { const [x, y] = P(p[0], p[1]); d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1); }); return d + (close ? 'Z' : ''); };
  let baseSvg = null;
  function base() {
    if (baseSvg) return baseSvg;
    let g = `<rect x="-2000" y="-2000" width="${WORLD.w + 4000}" height="${WORLD.h + 4000}" class="rm-out"/>`;
    g += `<path d="${G.states.map(s => pathOf(s.c, true)).join('')}" class="rm-land"/>`;
    const th = G.states.find(s => s.n === 'Thüringen'); if (th) g += `<path d="${pathOf(th.c, true)}" class="rm-focus"/>`;
    g += `<path d="${G.urban.map(u => pathOf(u.c, true)).join('')}" class="rm-urban"/>`;
    g += `<path d="${G.rivers.map(r => pathOf(r.c)).join('')}" class="rm-river"/>`;
    g += `<path d="${G.rail.map(r => pathOf(r)).join('')}" class="rm-rail" data-layer="rail"/>`;
    g += `<path d="${G.states.map(s => pathOf(s.c, true)).join('')}" class="rm-border"/>`;
    const minor = G.roads.filter(r => r.t !== 'm'), major = G.roads.filter(r => r.t === 'm');
    g += `<path d="${minor.map(r => pathOf(r.c)).join('')}" class="rm-road"/>`;
    g += `<path d="${major.map(r => pathOf(r.c)).join('')}" class="rm-mw-c"/><path d="${major.map(r => pathOf(r.c)).join('')}" class="rm-mw"/>`;
    return (baseSvg = g);
  }
  /* heat: synthetic delivery density rendered once to canvas */
  let heatURL = null, heatKey = '';
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function heat(locs, vol, dark) {
    const key = locs.map(l => l.id + vol[l.id]).join() + dark; if (key === heatKey) return heatURL; heatKey = key;
    const CW = 760, CH = Math.round(CW * WORLD.h / WORLD.w), c = document.createElement('canvas'); c.width = CW; c.height = CH; const x = c.getContext('2d');
    const vmax = Math.max(...Object.values(vol), 1);
    for (const L of locs) { const r = rng(L.id.length * 97 + 5); const n = 260, spread = .05 + .085 * Math.sqrt(L.base / 1180), w = vol[L.id] / vmax;
      for (let i = 0; i < n; i++) { const u = r(), v = r(); const rad = Math.sqrt(-2 * Math.log(u + 1e-9)) * spread, a = 2 * Math.PI * v;
        const lon = L.lon + Math.cos(a) * rad / .636 * (.8 + r() * .5), lat = L.lat + Math.sin(a) * rad * (.8 + r() * .4);
        const [px, py] = P(lon, lat); const cx = px / WORLD.w * CW, cy = py / WORLD.h * CH, R = 9 + r() * 8;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, `rgba(0,0,0,${.11 * (.35 + w * .65)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - R, cy - R, R * 2, R * 2); } }
    const img = x.getImageData(0, 0, CW, CH), d = img.data;
    const stops = dark ? [[52, 120, 255], [111, 85, 255], [150, 120, 255], [196, 178, 255]] : [[60, 110, 235], [91, 68, 232], [110, 70, 225], [130, 60, 210]];
    for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; if (!a) continue; const t = Math.min(1, a * 1.6); const seg = t < .45 ? 0 : t < .8 ? 1 : 2; const f = seg === 0 ? t / .45 : seg === 1 ? (t - .45) / .35 : (t - .8) / .2;
      const A = stops[seg], B = stops[seg + 1]; d[i] = A[0] + (B[0] - A[0]) * f; d[i + 1] = A[1] + (B[1] - A[1]) * f; d[i + 2] = A[2] + (B[2] - A[2]) * f; d[i + 3] = Math.min(255, Math.pow(t, .8) * (dark ? 210 : 170)); }
    x.putImageData(img, 0, 0); heatURL = c.toDataURL(); return heatURL;
  }
  /* state persists across dashboard re-renders */
  const st = { view: null, layers: { heat: true, areas: true, rail: true }, anim: 0 };
  let ctx = null;
  function mount(el, o) {
    ctx = { el, o };
    const dark = document.documentElement.dataset.theme !== 'light';
    el.innerHTML = `<svg class="rm-svg" role="img" aria-label="${o.t.title}" style="direction:ltr"><defs>
      <linearGradient id="rmDep" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--violet-hi)"/><stop offset="1" style="stop-color:var(--cobalt)"/></linearGradient></defs>
      <g class="rm-base">${base()}</g><image class="rm-heat" href="${heat(o.locs, o.vol, dark)}" x="0" y="0" width="${WORLD.w}" height="${WORLD.h}" preserveAspectRatio="none" ${st.layers.heat ? '' : 'style="display:none"'}/><g class="rm-dyn"></g></svg>
      <div class="tip rm-tip"></div>
      <div class="rm-ctrl"><div class="ctrl-grp"><button type="button" data-rm="in" aria-label="${o.t.zin}">${o.ic('plus', 17, 2.2)}</button><button type="button" data-rm="out" aria-label="${o.t.zout}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg></button></div>
        <div class="ctrl-grp"><button type="button" data-rm="fit" aria-label="${o.t.fit}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div></div>
      <div class="rm-legend"><span class="rm-lg-h">${o.t.density}</span><span class="heat"></span><span class="rm-lg-sep"></span>
        <span class="rm-pi"><i style="border-color:var(--mint)"></i>≥ 97 %</span><span class="rm-pi"><i style="border-color:var(--cobalt)"></i>95,5–97 %</span><span class="rm-pi"><i style="border-color:var(--amber)"></i>&lt; 95,5 %</span></div>
      <div class="rm-attr">${o.t.attr}</div>`;
    const svg = el.querySelector('svg');
    measure(); if (!st.view || o.refit) fit(false);
    apply();
    let drag = null;
    svg.addEventListener('pointerdown', e => { if (e.button) return; drag = { x: e.clientX, y: e.clientY, vx: st.view.x, vy: st.view.y, m: false }; });
    svg.addEventListener('pointermove', e => {
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.m && Math.hypot(dx, dy) > 4) { drag.m = true; svg.setPointerCapture(e.pointerId); el.classList.add('drag'); hideTip(); }
        if (drag.m) { const s = st.view.w / ctx.cw; st.view.x = drag.vx - dx * s; st.view.y = drag.vy - dy * s; apply(); return; } }
      const dep = e.target.closest('[data-dep]'); dep ? showTip(dep.dataset.dep, e) : hideTip(); });
    svg.addEventListener('pointerup', e => { const was = drag && drag.m; drag = null; el.classList.remove('drag'); if (was) return;
      const dep = e.target.closest('[data-dep]'); if (dep) { o.onSelect(dep.dataset.dep); return; }
      const cl = e.target.closest('[data-cl]'); if (cl) { const ids = cl.dataset.cl.split(','); fitTo(o.locs.filter(l => ids.includes(l.id)), true, 2.4); } });
    svg.addEventListener('pointerleave', hideTip);
    svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoom(e.deltaY < 0 ? .8 : 1.25, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
    svg.addEventListener('dblclick', e => { const r = svg.getBoundingClientRect(); zoom(.55, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
    el.querySelector('.rm-ctrl').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; const a = b.dataset.rm; a === 'in' ? zoom(.65, .5, .5) : a === 'out' ? zoom(1.5, .5, .5) : fit(true); });
    if (!st.layers.rail) svg.querySelector('[data-layer="rail"]').style.display = 'none';
    el.addEventListener('keydown', e => { const dep = e.target.closest && e.target.closest('[data-dep]'); if (dep && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); o.onSelect(dep.dataset.dep); } });
  }
  function measure() { const r = ctx.el.getBoundingClientRect(); ctx.cw = Math.max(1, r.width); ctx.ch = Math.max(1, r.height); }
  function fitTo(locs, animate, minW) {
    const pts = locs.map(l => P(l.lon, l.lat)); const pad = 180; let x0 = Math.min(...pts.map(p => p[0])) - pad, x1 = Math.max(...pts.map(p => p[0])) + pad, y0 = Math.min(...pts.map(p => p[1])) - pad, y1 = Math.max(...pts.map(p => p[1])) + pad;
    let w = Math.max(x1 - x0, (y1 - y0) * ctx.cw / ctx.ch, minW ? 1250 : 900); const h = w * ctx.ch / ctx.cw;
    const tgt = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2 + h * .03, w };
    animate ? fly(tgt) : (st.view = tgt);
  }
  function fit(animate) { const sel = ctx.o.sel !== 'all' ? ctx.o.locs.filter(l => l.id === ctx.o.sel) : ctx.o.locs; fitTo(sel.length ? sel : ctx.o.locs, animate, sel.length === 1); }
  function zoom(f, fx, fy) { const v = st.view, w = Math.max(160, Math.min(WORLD.w * 1.2, v.w * f)), h0 = v.w * ctx.ch / ctx.cw, h = w * ctx.ch / ctx.cw; fly({ x: v.x + (v.w - w) * fx, y: v.y + (h0 - h) * fy, w }, 260); }
  function fly(tgt, dur = 620) {
    cancelAnimationFrame(st.anim); hideTip();
    if (ctx.o.reduce()) { st.view = tgt; apply(); return; }
    const from = { ...st.view }, t0 = performance.now();
    const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); st.view = { x: from.x + (tgt.x - from.x) * e, y: from.y + (tgt.y - from.y) * e, w: from.w + (tgt.w - from.w) * e }; apply(); if (p < 1) st.anim = requestAnimationFrame(step); };
    st.anim = requestAnimationFrame(step);
  }
  function apply() { const v = st.view, h = v.w * ctx.ch / ctx.cw; const svg = ctx.el.querySelector('svg'); svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${h.toFixed(1)}`); const hm = ctx.el.querySelector('.rm-heat'); if (hm) hm.style.opacity = Math.max(.35, Math.min(1, (v.w / ctx.cw) / 1.6)).toFixed(2); dyn(); }
  function dyn() {
    const o = ctx.o, s = st.view.w / ctx.cw, g = ctx.el.querySelector('.rm-dyn'); let h = '';
    const fs = px => (px * s).toFixed(2);
    // state + town labels
    STATES.forEach(([n, lo, la]) => { const [x, y] = P(lo, la); h += `<text x="${x}" y="${y}" class="rm-state" text-anchor="middle" style="font-size:${fs(10.5)}px;letter-spacing:${fs(2.4)}px">${n}</text>`; });
    { const [x, y] = P(10.62, 50.68); h += `<text x="${x}" y="${y}" class="rm-forest" text-anchor="middle" transform="rotate(-28 ${x} ${y})" style="font-size:${fs(11)}px;letter-spacing:${fs(1.5)}px">Thüringer Wald</text>`; }
    const depotNames = new Set(o.locs.map(l => l.name));
    [...TOWNS, ...G.places.map(p => [p.n, p.x, p.y, 1])].forEach(([n, lo, la, rank]) => { if (depotNames.has(n)) return; if (rank === 3 && s > 1.6) return; const [x, y] = P(lo, la);
      h += `<circle cx="${x}" cy="${y}" r="${(rank === 1 ? 2.6 : 2) * s}" class="rm-town-d"/><text x="${x + 6 * s}" y="${y + 3.5 * s}" class="rm-town" style="font-size:${fs(rank === 1 ? 11 : 10)}px;stroke-width:${fs(3)}px">${n}</text>`; });
    // service areas = regional performance
    const ANG = { suhl: -2.4, erfurt: -.75, schweinfurt: -2.3, coburg: -.6, ilmenau: .5 };
    if (st.layers.areas) o.locs.forEach(L => { const [x, y] = P(L.lon, L.lat); const r = (130 + 170 * Math.sqrt(L.base / 1180)); const c = L.rate >= .97 ? 'var(--mint)' : L.rate >= .955 ? 'var(--cobalt)' : 'var(--amber)'; const sel = o.sel === L.id;
      h += `<circle cx="${x}" cy="${y}" r="${r}" style="fill:${c};fill-opacity:${sel ? .08 : .035};stroke:${c};stroke-opacity:${sel ? .9 : .55}" stroke-width="${(sel ? 2 : 1.3) * s}" stroke-dasharray="${5 * s} ${4 * s}"/>`;
      if (s < 1.9 && ctx.cw > 600) { const a = ANG[L.id] ?? -.8; const [lx, ly] = [x + r * Math.cos(a), y + r * Math.sin(a)]; h += `<g><rect x="${lx - 26 * s}" y="${ly - 10 * s}" width="${52 * s}" height="${20 * s}" rx="${10 * s}" style="fill:var(--surface);stroke:${c}" stroke-width="${1.2 * s}"/><text x="${lx}" y="${ly + 3.8 * s}" text-anchor="middle" style="font-size:${fs(10.5)}px;font-weight:800;fill:${c}">${o.pf(L.rate)}</text></g>`; } });
    // depots with clustering
    const pts = o.locs.map(L => ({ L, p: P(L.lon, L.lat) })); const used = new Set(); const groups = [];
    pts.forEach((a, i) => { if (used.has(i)) return; const grp = [a]; used.add(i); pts.forEach((b, j) => { if (!used.has(j) && Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) / s < (ctx.cw < 600 ? 70 : 46)) { grp.push(b); used.add(j); } }); groups.push(grp); });
    groups.forEach(grp => {
      if (grp.length > 1) { const x = grp.reduce((q, z) => q + z.p[0], 0) / grp.length, y = grp.reduce((q, z) => q + z.p[1], 0) / grp.length; const v = grp.reduce((q, z) => q + o.vol[z.L.id], 0);
        h += `<g class="rm-cl" data-cl="${grp.map(z => z.L.id).join(',')}" tabindex="0" role="button" aria-label="${grp.map(z => z.L.name).join(', ')}"><circle cx="${x}" cy="${y}" r="${20 * s}" style="fill:var(--violet-hi);opacity:.22"/><circle cx="${x}" cy="${y}" r="${15 * s}" style="fill:url(#rmDep);stroke:var(--surface)" stroke-width="${2.5 * s}"/><text x="${x}" y="${y + 4.2 * s}" text-anchor="middle" style="font-size:${fs(12)}px;font-weight:800;fill:#fff">${grp.length}</text>
          <g><rect x="${x + 22 * s}" y="${y - 12 * s}" width="${(grp.map(z => z.L.name).join(' · ').length * 6.6 + 18) * s}" height="${24 * s}" rx="${8 * s}" class="rm-pill" stroke-width="${s}"/><text x="${x + 31 * s}" y="${y + 4 * s}" style="font-size:${fs(11.5)}px;font-weight:700;fill:var(--text)">${grp.map(z => z.L.name).join(' · ')}</text></g></g>`; return; }
      const { L, p: [x, y] } = grp[0]; const sel = o.sel === L.id; const dim = o.sel !== 'all' && !sel;
      h += `<g class="rm-dep ${sel ? 'sel' : ''}" data-dep="${L.id}" tabindex="0" role="button" aria-label="${L.name}" opacity="${dim ? .55 : 1}">
        ${sel ? `<circle class="pulse-ring" cx="${x}" cy="${y}" r="${16 * s}" style="fill:var(--violet-hi)"/>` : ''}
        <rect x="${x - 13 * s}" y="${y - 13 * s}" width="${26 * s}" height="${26 * s}" rx="${8 * s}" style="fill:url(#rmDep);stroke:var(--surface)" stroke-width="${2.5 * s}"/>
        <path d="M${x - 6 * s},${y + 5 * s}V${y - 1 * s}L${x},${y - 6 * s}L${x + 6 * s},${y - 1 * s}V${y + 5 * s}Z" style="fill:#fff"/>
        <g><rect x="${x + 18 * s}" y="${y - 14 * s}" width="${(Math.max(L.name.length, 9) * 7.2 + 20) * s}" height="${30 * s}" rx="${9 * s}" class="rm-pill" stroke-width="${s}"/>
        <text x="${x + 28 * s}" y="${y - 1 * s}" style="font-size:${fs(12)}px;font-weight:800;fill:var(--text)">${L.name}</text>
        <text x="${x + 28 * s}" y="${y + 11 * s}" style="font-size:${fs(10)}px;font-weight:600;fill:var(--text-3)">${o.nf(o.vol[L.id])} ${o.t.stops}</text></g></g>`; });
    g.innerHTML = h;
  }
  function showTip(id, e) {
    const o = ctx.o, L = o.locs.find(l => l.id === id); const tip = ctx.el.querySelector('.rm-tip'); const d = o.detail(L);
    tip.innerHTML = `<div class="tip-h" style="display:flex;align-items:center;gap:8px">${L.name}<span style="margin-inline-start:auto;font-weight:600;color:var(--text-3);font-size:11.5px">${d.org}</span></div>
      <div class="tip-r">${o.t.stops}<b class="num">${o.nf(o.vol[L.id])}</b></div><div class="tip-r">${o.t.rate}<b class="num">${o.pf(d.rate)}</b></div><div class="tip-r">${o.t.ontime}<b class="num">${o.pf(d.ontime)}</b></div><div class="tip-r">${o.t.drivers}<b class="num">${d.drv}/${L.drivers}</b></div>
      <div style="margin-top:6px">${d.spark}</div><div style="font-size:11px;color:var(--text-3);margin-top:4px">${o.t.click}</div>`;
    const r = ctx.el.getBoundingClientRect(); let x = e.clientX - r.left + 16, y = e.clientY - r.top + 12; if (x + 200 > r.width) x -= 220; if (y + 170 > r.height) y -= 180;
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('on');
  }
  function hideTip() { const t = ctx && ctx.el.querySelector('.rm-tip'); t && t.classList.remove('on'); }
  function setLayer(k, on) { st.layers[k] = on; if (!ctx) return; const hm = ctx.el.querySelector('.rm-heat'); if (hm) hm.style.display = st.layers.heat ? '' : 'none'; const rl = ctx.el.querySelector('[data-layer="rail"]'); if (rl) rl.style.display = st.layers.rail ? '' : 'none'; dyn(); }
  function refresh() { if (!ctx || !ctx.el.isConnected) return; measure(); const hm = ctx.el.querySelector('.rm-heat'); if (hm) hm.setAttribute('href', heat(ctx.o.locs, ctx.o.vol, document.documentElement.dataset.theme !== 'light')); apply(); }
  return { mount, setLayer, refresh, layers: st.layers, reset: () => { st.view = null; } };
})();
