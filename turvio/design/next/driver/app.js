/* TURVIO NEXT · Driver prototype. Synthetic data only – nothing here reads or writes real records. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const P = {
  today:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>', map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  stops:'<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="4.5" cy="18" r="1.5"/>',
  scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>', more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  nav:'<path d="M3 11 21 3l-8 18-2-8z"/>', check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>', x:'<path d="M6 6l12 12M18 6 6 18"/>', alert:'<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
  pkg:'<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', cam:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  sig:'<path d="M3 17c3-6 5-9 7-9 3 0-1 9 2 9 2 0 3-4 5-4 1 0 1 2 4 2"/><path d="M3 21h18"/>', cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>', up:'<path d="m6 15 6-6 6 6"/>', down:'<path d="m6 9 6 6 6-6"/>',
  pin:'<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>', gps:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  wand:'<path d="m15 4 5 5L9 20l-5-5zM14 2v2M20 8h2M18 4l1-1"/>', phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', plus:'<path d="M12 5v14M5 12h14"/>', chevR:'<path d="m9 6 6 6-6 6"/>', chevL:'<path d="m15 6-6 6 6 6"/>', chev:'<path d="m6 9 6 6 6-6"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>', cloud:'<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>', cloudOff:'<path d="M2 2l20 20M7 18a5 5 0 0 1-1.5-9.8M10 6.2A6 6 0 0 1 19 10a4 4 0 0 1 1.7 7.6"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', truck:'<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', hist:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>', file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  paste:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  door:'<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12h.01"/>', home:'<path d="M3 11 12 4l9 7v10H3z"/>', lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', ban:'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  box:'<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5"/><path d="m8 5.5 9 5"/>', dots:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  signal:'<path d="M3 20h2v-3H3zM8 20h2v-6H8zM13 20h2v-9h-2zM18 20h2V8h-2z"/>', wifi:'<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>', batt:'<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2M5 10h11v4H5z"/>'
};
const ic = (n, s = 20, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const LOCALE = { de: 'de-DE', en: 'en-GB', ro: 'ro-RO', ar: 'ar-u-nu-latn' };
const S = { lang: store.get('dr-lang', 'de'), tab: 'today', sheet: 'peek', sel: null, online: true, simFail: false, navApp: store.get('dr-nav', null), scanTarget: null, scanMode: 'cam', scanned: [], scanIdx: 0, auto: false,
  motion: store.get('dr-motion', false), gpsOn: true, filter: 'open', q: '', showDone: false, opt: null, clock: 11 * 60 + 42, lastSync: '11:40', queue: [], history: [], size: store.get('dr-size', '390x844') };
const t = (k, v) => { let s = (I18N[S.lang] && I18N[S.lang][k]) ?? I18N.de[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.split(`{${a}}`).join(b); return s; };
const nf = (n, d = 0) => new Intl.NumberFormat(LOCALE[S.lang], { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const eur = (n) => new Intl.NumberFormat(LOCALE[S.lang], { style: 'currency', currency: 'EUR' }).format(n);
const reduce = () => S.motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
const hm = m => { m = Math.round(m); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const clk = () => DATA.fmtT(S.clock);

/* ---------------- synthetic tour */
const NAMES = ['Fam. Krüger', 'M. Schneider', 'Praxis Dr. Lenz', 'Café Lister Meile', 'K. Yilmaz', 'S. Popa', 'Buchhandlung Lindner', 'A. Hoffmann', 'J. Becker', 'Büro Nord GmbH', 'L. Wolf', 'T. Richter', 'E. Haddad', 'R. Ionescu'];
let T = null, uid = 0;
function makeTour() {
  const tr = DATA.mkTour({ id: 'd1', code: 'HAN-01', area: 'List · Oststadt', key: 'list', cx: 1.2, cy: -1.75, rx: .95, ry: .75, n: 92, seed: 11, color: 0, optimized: true, done: 37 });
  const r = GEO.rng(5); const st = tr.stops; const d = 37;
  // driver deviations since dispatch optimisation: a few late changes in the open part
  for (let k = 0; k < 3; k++) { const i = d + 6 + Math.floor(r() * 40); const j = d + 6 + Math.floor(r() * 40); const [s] = st.splice(i, 1); st.splice(j, 0, s); }
  st.forEach((s, i) => { s.name = NAMES[i % NAMES.length]; s.codes = Array.from({ length: s.parcels }, () => 'TRV ' + String(4400 + Math.floor(r() * 500)) + ' ' + String(1000 + Math.floor(r() * 8999)) + ' ' + String(10 + Math.floor(r() * 89)));
    s.proof = s.parcels >= 3 ? 'sig' : r() < .12 ? 'photo' : null; s.type = 'del'; s.cod = null; if (s.status !== 'open') s.time = DATA.fmtT(7 * 60 + 40 + i * 6.2); });
  st[d].proof = null; st[d].parcels = 2; st[d].codes = st[d].codes.slice(0, 2).concat(st[d].codes.length < 2 ? ['TRV 4471 0093 25'] : []).slice(0, 2); st[d].note = null;
  st[d + 1].proof = 'photo'; st[d + 1].note = 'Ablage: Garage'; st[d + 2].proof = 'sig'; st[d + 2].cod = 24.9; st[d + 4].type = 'pick'; st[d + 4].proof = null; st[d + 9].cod = 58;
  return tr;
}
function reset() { T = makeTour(); S.sel = null; S.queue = []; S.history = []; S.scanned = []; S.scanIdx = 0; S.clock = 11 * 60 + 42; S.opt = null; }
const nextIdx = () => T.stops.findIndex(s => s.status === 'open');
function gpsPos() { const i = Math.max(1, T.stops.findIndex(s => s.status === 'open')); const a = T.stops[i - 1], b = T.stops[i] || a; const c = DATA.corner(a, b); return { x: a.x + (c.x - a.x) * .35, y: a.y + (c.y - a.y) * .35 }; }
function metrics() { const st = T.stops, n = st.length, done = st.filter(s => s.status === 'done').length, failed = st.filter(s => s.status === 'failed').length, open = st.filter(s => s.status === 'open');
  const g = gpsPos(); let km = 0, prev = g; open.forEach(s => { km += DATA.dist(prev, s); prev = s; }); if (open.length) km += DATA.dist(prev, DATA.DEPOT);
  const min = km / DATA.SPEED * 60 + open.length * DATA.SERVICE; return { n, done, failed, fin: done + failed, open: open.length, parcels: open.reduce((a, s) => a + s.parcels, 0), km, min, end: DATA.fmtT(S.clock + min) }; }
function distTo(i) { const s = T.stops[i]; const g = gpsPos(); let km = 0, prev = g; for (let k = nextIdx(); k >= 0 && k <= i; k++) { if (T.stops[k].status !== 'open') continue; km += DATA.dist(prev, T.stops[k]); prev = T.stops[k]; } if (T.stops[i].status !== 'open') km = DATA.dist(g, s);
  const U = (v, u, d) => new Intl.NumberFormat(LOCALE[S.lang], { style: 'unit', unit: u, maximumFractionDigits: d }).format(v); return { txt: km < 1 ? U(Math.round(km * 100) * 10, 'meter', 0) : U(km, 'kilometer', 1), min: Math.max(1, Math.round(km / DATA.SPEED * 60 + 0.5)) }; }

/* ---------------- toasts */
function toast(title, sub = '', kind = 'ok', action = null) {
  const box = $('#toastx'); const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  const c = kind === 'ok' ? ['var(--mint-soft)', 'var(--mint)', 'check'] : kind === 'bad' ? ['var(--coral-soft)', 'var(--coral)', 'x'] : kind === 'warn' ? ['var(--amber-soft)', 'var(--amber)', 'alert'] : ['var(--violet-soft)', 'var(--violet-text)', 'bolt'];
  el.innerHTML = `<span class="ti" style="background:${c[0]};color:${c[1]}">${ic(c[2], 16, 2.6)}</span><div style="flex:1;min-width:0"><div>${title}</div>${sub ? `<div style="font-size:12px;color:var(--text-3);font-weight:500">${sub}</div>` : ''}</div>${action ? `<button class="btn btn-sm" type="button" style="height:40px">${action.label}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
  box.innerHTML = ''; box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, action ? 6000 : 2800);
}
function ripple(e) { const b = e.target.closest('.bb,.cta'); if (!b || reduce()) return; const r = b.getBoundingClientRect(); const s = document.createElement('span'); s.className = 'rip'; const d = Math.max(r.width, r.height); s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`; b.appendChild(s); setTimeout(() => s.remove(), 600); }

/* ---------------- sync */
function syncState() { if (!S.online) return 'offline'; if (S.queue.some(q => q.st === 'sending')) return 'syncing'; if (S.queue.some(q => q.st === 'failed')) return 'failed'; if (S.queue.some(q => q.st === 'waiting')) return 'pending'; return 'online'; }
function syncPill() { const st = syncState(); const n = S.queue.filter(q => q.st !== 'ok').length;
  const lab = st === 'offline' ? (n ? `${t('offline')} · ${t('pending', { n })}` : t('offline')) : st === 'syncing' ? t('syncing') : st === 'failed' ? t('failed') : st === 'pending' ? t('pending', { n }) : t('online');
  return `<button class="syncpill sp-${st}" type="button" data-act="sync" aria-label="${t('syncTitle')}"><span class="dot"></span>${st === 'offline' ? ic('cloudOff', 15) : ''}${lab}</button>`; }
function enqueue(item) { S.queue.unshift({ id: ++uid, st: 'waiting', ...item }); pump(); }
function pump() { if (!S.online) { refreshChrome(); return; }
  S.queue.filter(q => q.st === 'waiting').forEach(q => { q.st = 'sending'; setTimeout(() => { if (!S.online) { q.st = 'waiting'; } else if (S.simFail) q.st = 'failed'; else { q.st = 'ok'; S.lastSync = clk(); } refreshChrome(); }, 1100 + Math.random() * 500); });
  refreshChrome(); }
function refreshChrome() { $$('.syncpill').forEach(p => { const d = document.createElement('div'); d.innerHTML = syncPill(); p.replaceWith(d.firstElementChild); });
  const sb = $('#sbar-net'); if (sb) sb.innerHTML = S.online ? ic('signal', 15) + ic('wifi', 15) : ic('cloudOff', 15); if ($('#sync-sheet.on')) openSync(); }

/* ================= MAP ================= */
const M = { el: null, svg: null, dyn: null, view: { x: 0, y: 0, w: 300 }, cw: 1, ch: 1, anim: 0, ptr: new Map(), pinch: null };
function mapInit() {
  const box = document.createElement('div'); box.className = 'mapbox';
  box.innerHTML = `<svg role="img" aria-label="${t('map')}" style="direction:ltr"><defs><linearGradient id="nsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--violet-hi)"/><stop offset="1" style="stop-color:var(--cobalt)"/></linearGradient>
    <linearGradient id="rgo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--cyan)"/><stop offset="1" style="stop-color:var(--cobalt)"/></linearGradient></defs><g id="geobase">${GEO.base()}</g><g class="dyn"></g></svg>`;
  M.el = box; M.svg = box.querySelector('svg'); M.dyn = box.querySelector('.dyn');
  let tap = null;
  box.addEventListener('pointerdown', e => { M.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { box.setPointerCapture(e.pointerId); } catch {}
    if (M.ptr.size === 1) tap = { x: e.clientX, y: e.clientY, vx: M.view.x, vy: M.view.y, moved: false, t: performance.now(), target: e.target };
    if (M.ptr.size === 2) { const [a, b] = [...M.ptr.values()]; M.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: M.view.w, vx: M.view.x, vy: M.view.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; tap = null; } });
  box.addEventListener('pointermove', e => { if (!M.ptr.has(e.pointerId)) return; M.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = box.getBoundingClientRect();
    if (M.pinch && M.ptr.size === 2) { const [a, b] = [...M.ptr.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const w = Math.max(60, Math.min(1500, M.pinch.w * M.pinch.d / d));
      const fx = (M.pinch.cx - r.left) / r.width, fy = (M.pinch.cy - r.top) / r.height; const h0 = M.pinch.w * M.ch / M.cw, h = w * M.ch / M.cw;
      M.view = { x: M.pinch.vx + (M.pinch.w - w) * fx, y: M.pinch.vy + (h0 - h) * fy, w }; apply(); return; }
    if (!tap) return; const dx = e.clientX - tap.x, dy = e.clientY - tap.y; if (!tap.moved && Math.hypot(dx, dy) < 6) return; tap.moved = true;
    const s = M.view.w / M.cw; M.view.x = tap.vx - dx * s; M.view.y = tap.vy - dy * s; apply(); });
  const up = e => { M.ptr.delete(e.pointerId); if (M.ptr.size < 2) M.pinch = null; if (tap && !tap.moved && M.ptr.size === 0) { const now = performance.now();
      if (M.lastTap && now - M.lastTap < 300) { const r = box.getBoundingClientRect(); zoomAt(.5, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); M.lastTap = 0; }
      else { M.lastTap = now; const g = tap.target.closest && tap.target.closest('[data-stop]'); if (g) selectStop(+g.dataset.stop, true); } }
    if (M.ptr.size === 0) tap = null; };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('wheel', e => { e.preventDefault(); const r = box.getBoundingClientRect(); zoomAt(Math.pow(1.0022, Math.max(-200, Math.min(200, e.deltaY))), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
}
function measure() { const r = M.el.getBoundingClientRect(); M.cw = Math.max(1, r.width); M.ch = Math.max(1, r.height); }
function apply() { const v = M.view, h = v.w * M.ch / M.cw; M.svg.setAttribute('viewBox', `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${h.toFixed(2)}`); renderDyn(); }
function zoomAt(f, fx, fy) { const v = M.view, w = Math.max(60, Math.min(1500, v.w * f)), h0 = v.w * M.ch / M.cw, h = w * M.ch / M.cw; fly({ x: v.x + (v.w - w) * fx, y: v.y + (h0 - h) * fy, w }, 240); }
function fly(tg, dur = 600) { cancelAnimationFrame(M.anim); if (reduce()) { M.view = tg; apply(); return; } const fr = { ...M.view }, t0 = performance.now();
  const step = n => { const p = Math.min(1, (n - t0) / dur), e = 1 - Math.pow(1 - p, 3); M.view = { x: fr.x + (tg.x - fr.x) * e, y: fr.y + (tg.y - fr.y) * e, w: fr.w + (tg.w - fr.w) * e }; apply(); if (p < 1) M.anim = requestAnimationFrame(step); }; M.anim = requestAnimationFrame(step); }
function sheetPx() { const dh = $('#device').clientHeight; return S.sheet === 'peek' ? 292 : S.sheet === 'half' ? Math.round(dh * .62) : dh - 64; }
function fitPts(pts, animate = true, minW = 120) { measure(); const W = pts.map(p => GEO.W([p.x, p.y])); const x0 = Math.min(...W.map(p => p[0])), x1 = Math.max(...W.map(p => p[0])), y0 = Math.min(...W.map(p => p[1])), y1 = Math.max(...W.map(p => p[1]));
  const padT = 70, padB = Math.min(sheetPx(), M.ch * .62) + 20, padX = 28; const aw = M.cw - padX * 2, ah = Math.max(60, M.ch - padT - padB);
  const s = Math.max((x1 - x0) / aw, (y1 - y0) / ah, minW / M.cw); const w = s * M.cw; const tg = { x: (x0 + x1) / 2 - (padX + aw / 2) * s, y: (y0 + y1) / 2 - (padT + ah / 2) * s, w };
  animate ? fly(tg) : (M.view = tg, apply()); }
function focusStop(i, animate = true) { const s = T.stops[i]; const up = T.stops.slice(i + 1).filter(x => x.status === 'open').slice(0, 2); fitPts([gpsPos(), s, ...up], animate, 300); }
function routePath(seq) { if (seq.length < 2) return ''; let d = ''; seq.forEach((p, i) => { const [X, Y] = GEO.W([p.x, p.y]); if (!i) { d += `M${X.toFixed(1)},${Y.toFixed(1)}`; return; } const c = DATA.corner(seq[i - 1], p); const [cx, cy] = GEO.W([c.x, c.y]); d += `L${cx.toFixed(1)},${cy.toFixed(1)}L${X.toFixed(1)},${Y.toFixed(1)}`; }); return d; }
function prio(i, nx) { const s = T.stops[i]; if (i === nx) return -1e9; if (i === S.sel) return -1e8; if (s.status === 'open') return i - nx; if (s.status === 'failed') return 5e4 + i; return 1e5 + (nx - i); }
function renderDyn() {
  if (!M.dyn) return; const s = M.view.w / M.cw, st = T.stops, nx = nextIdx(); let o = '';
  const g = gpsPos(); const done = st.filter(x => x.status !== 'open'), open = st.filter(x => x.status === 'open');
  o += `<path d="${routePath([DATA.DEPOT, ...done, g])}" fill="none" style="stroke:var(--text-3)" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round" opacity=".55" vector-effect="non-scaling-stroke"/>`;
  const rp = routePath([g, ...open, DATA.DEPOT]);
  o += `<path d="${rp}" fill="none" style="stroke:var(--cyan)" stroke-width="10" opacity=".16" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><path d="${rp}" fill="none" style="stroke:var(--cyan)" stroke-width="3.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (nx >= 0) o += `<path class="route-flow" d="${routePath([g, st[nx]])}"/>`;
  { const [X, Y] = GEO.W([g.x, g.y]); const tgt = nx >= 0 ? GEO.W([st[nx].x, st[nx].y]) : [X, Y - 1]; const ang = Math.atan2(tgt[1] - Y, tgt[0] - X) * 180 / Math.PI + 90;
    o += `<g>${S.gpsOn ? `<circle class="gps-pulse" cx="${X}" cy="${Y}" r="${12 * s}" style="fill:var(--cobalt)" opacity=".5"/>` : ''}<circle cx="${X}" cy="${Y}" r="${26 * s}" style="fill:var(--cobalt)" opacity=".1"/>
      <path transform="rotate(${ang.toFixed(1)} ${X} ${Y})" d="M${X},${Y} L${X - 13 * s},${Y - 30 * s} A${32 * s},${32 * s} 0 0 1 ${X + 13 * s},${Y - 30 * s} Z" style="fill:var(--cobalt)" opacity=".22"/>
      <circle cx="${X}" cy="${Y}" r="${9 * s}" style="fill:${S.gpsOn ? 'var(--cobalt)' : 'var(--text-3)'};stroke:#fff" stroke-width="${3 * s}"/></g>`; }
  // declutter
  const order = st.map((x, i) => i).sort((a, b) => prio(a, nx) - prio(b, nx)); const placed = []; const pin = new Set(); const zoomOK = s < 1.15;
  for (const i of order) { const [X, Y] = GEO.W([st[i].x, st[i].y]); const px = X / s, py = Y / s; const need = i === nx ? 30 : 23;
    if ((zoomOK || i === nx || i === S.sel) && placed.every(([a, b, r]) => Math.hypot(a - px, b - py) >= Math.max(r, need))) { placed.push([px, py, need]); pin.add(i); } }
  st.forEach((x, i) => { if (pin.has(i)) return; const [X, Y] = GEO.W([x.x, x.y]); const c = x.status === 'done' ? 'var(--text-3)' : x.status === 'failed' ? 'var(--coral)' : 'var(--cyan)';
    o += `<circle data-stop="${i}" cx="${X}" cy="${Y}" r="${(x.status === 'open' ? 3.4 : 2.4) * s}" style="fill:${c};stroke:var(--m-bg)" stroke-width="${1.2 * s}" opacity="${x.status === 'open' ? .9 : .55}"/>`; });
  [...pin].sort((a, b) => prio(b, nx) - prio(a, nx)).forEach(i => { const x = st[i]; const [X, Y] = GEO.W([x.x, x.y]);
    if (i === nx) { o += `<g data-stop="${i}"><circle cx="${X}" cy="${Y}" r="${21 * s}" style="fill:var(--violet-hi)" opacity=".18"/><circle cx="${X}" cy="${Y}" r="${15 * s}" style="fill:url(#nsg);stroke:#fff" stroke-width="${2.5 * s}"/><text x="${X}" y="${Y + 4.4 * s}" text-anchor="middle" style="font-size:${12.5 * s}px;font-weight:800;fill:#fff">${i + 1}</text>
      <g><rect x="${X - 34 * s}" y="${Y - 44 * s}" width="${68 * s}" height="${20 * s}" rx="${7 * s}" style="fill:var(--surface);stroke:var(--violet-hi)" stroke-width="${1.2 * s}"/><text x="${X}" y="${Y - 30.5 * s}" text-anchor="middle" style="font-size:${10 * s}px;font-weight:800;fill:var(--violet-text)">${t('nextStop')}</text></g></g>`; return; }
    const done = x.status === 'done', fail = x.status === 'failed', sel = i === S.sel;
    o += `<g data-stop="${i}">${sel ? `<circle cx="${X}" cy="${Y}" r="${16 * s}" style="fill:none;stroke:var(--violet-hi)" stroke-width="${2.5 * s}"/>` : ''}<circle cx="${X}" cy="${Y}" r="${11 * s}" style="fill:${done ? 'var(--surface-2)' : 'var(--surface)'};stroke:${fail ? 'var(--coral)' : done ? 'var(--line-3)' : 'var(--cyan)'}" stroke-width="${(done ? 1.2 : 2.2) * s}"/>
      <text x="${X}" y="${Y + 3.6 * s}" text-anchor="middle" style="font-size:${(i >= 99 ? 8.5 : 10) * s}px;font-weight:800;fill:${fail ? 'var(--coral)' : done ? 'var(--text-3)' : 'var(--text)'}">${i + 1}</text></g>`; });
  { const [X, Y] = GEO.W([DATA.DEPOT.x, DATA.DEPOT.y]); o += `<rect x="${X - 10 * s}" y="${Y - 10 * s}" width="${20 * s}" height="${20 * s}" rx="${6 * s}" style="fill:var(--text);stroke:var(--m-bg)" stroke-width="${2 * s}"/><path d="M${X - 5 * s},${Y + 5 * s}V${Y - 1 * s}L${X},${Y - 5 * s}L${X + 5 * s},${Y - 1 * s}V${Y + 5 * s}Z" style="fill:var(--m-bg)"/>`; }
  o += GEO.labels(s, s < .75);
  M.dyn.innerHTML = o;
}

/* ================= SCREENS ================= */
function chipsFor(s) { const c = [];
  c.push(`<span class="tagx t-mute">${ic('pkg', 13)}${s.parcels === 1 ? t('parcel1') : t('parcels', { n: s.parcels })}</span>`);
  if (s.type === 'pick') c.push(`<span class="tagx t-info">${ic('box', 13)}${t('pickup')}</span>`);
  if (s.win) c.push(`<span class="tagx t-warn">${ic('clock', 13)}${t('until', { t: s.win })}</span>`);
  if (s.proof === 'photo') c.push(`<span class="tagx t-vi">${ic('cam', 13)}${t('photoReq')}</span>`);
  if (s.proof === 'sig') c.push(`<span class="tagx t-vi">${ic('sig', 13)}${t('sigReq')}</span>`);
  if (s.cod) c.push(`<span class="tagx t-warn">${ic('cash', 13)}${t('cod', { a: eur(s.cod) })}</span>`);
  return c.join(''); }
function vToday() {
  const m = metrics(), nx = nextIdx(), st = T.stops;
  const strip = st.map((s, i) => `<i class="${i === nx ? 'n' : s.status === 'done' ? 'd' : s.status === 'failed' ? 'f' : ''}"></i>`).join('');
  const ns = nx >= 0 ? st[nx] : null; const dd = ns ? distTo(nx) : null;
  const upcoming = st.map((s, i) => [s, i]).filter(([s, i]) => s.status === 'open' && i !== nx).slice(0, 3);
  return `<div class="app-top"><span class="logo-mark" role="img" aria-label="TURVIO" style="height:30px"></span><div style="padding-inline-start:2px"><div class="hello">${t('hello')}</div><div class="hname">R. Neumann</div></div>${syncPill()}</div>
  <section class="hero-t" aria-label="${t('tourToday')}">
    <div class="ht-row"><span class="ht-code">${T.code} · ${T.area}</span><button class="tagx t-mute" type="button" data-act="tours" style="margin-inline-start:auto;border:0">${t('toursN', { n: 2 })}${ic('chev', 13)}</button></div>
    <div class="ht-big"><div class="ht-num num" id="hnum">${m.fin}<small> / ${m.n}</small></div><div><div style="font-weight:800">${t('stops')} ${t('done')}</div>
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><span class="tagx ${T.optimized ? 't-ok' : 't-mute'}">${ic(T.optimized ? 'check' : 'alert', 13, 2.6)}${T.optimized ? t('optimized') : t('notOptimized')}</span><span class="pill pill-demo" style="height:26px">${t('demo')}</span></div></div></div>
    <div class="strip" aria-hidden="true">${strip}</div>
    <div class="hstats"><div class="hs"><b class="num">${m.open}</b><span>${t('open')}</span></div><div class="hs"><b class="num">${m.parcels}</b><span>${t('parcelsLeft')}</span></div><div class="hs"><b class="num">${nf(m.km, 1)}</b><span>${t('kmLeft')}</span></div><div class="hs"><b class="num">${hm(m.min)}</b><span>${t('timeLeft')}</span></div></div>
    <div style="position:relative;margin-top:10px;font-size:12.5px;color:var(--hero-text-2);font-weight:700;display:flex;gap:8px">${ic('clock', 15)}${t('endAt', { t: m.end })}</div>
  </section>
  ${ns ? `<button class="cta" type="button" data-act="continue">${ic('nav', 20, 2.4)}${m.fin ? t('continueTour') : t('startTour')}</button>
  <section class="ns"><div class="ns-h"><span class="badge-n num">${nx + 1}</span><div style="min-width:0;flex:1"><div class="sub" style="color:var(--violet-text);font-weight:800">${t('nextStop')} · ${dd.txt}</div><div class="addr">${ns.street} ${ns.no}</div><div class="sub"><bdi>${ns.zip} Hannover</bdi> · <bdi>${ns.name}</bdi></div></div></div>
    <div class="chips" style="margin-top:12px">${chipsFor(ns)}</div>
    <div class="bigbtns"><button class="bb bb-nav" type="button" data-act="nav" data-i="${nx}">${ic('nav', 19, 2.4)}${t('navigate')}</button><button class="bb bb-sec" type="button" data-act="open" data-i="${nx}">${t('details')}</button></div></section>` :
  `<section class="ns" style="text-align:center"><div style="font-size:40px">✓</div><div class="addr">${t('tourDone')}</div></section>`}
  <div class="sec-h">${t('afterThat')}<button class="k" type="button" data-act="tab" data-tab="stops" style="border:0;background:none">${t('allStops', { n: m.n })} ›</button></div>
  ${upcoming.map(([s, i]) => stopRow(s, i)).join('')}
  <button class="row" type="button" data-act="optimize" style="margin-top:8px"><span class="lic" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--violet-soft);color:var(--violet-text)">${ic('wand', 19)}</span><div><div class="r-a">${t('optTitle')}</div><div class="sub">${t('fromHereS')}</div></div><span class="r-r">${ic(S.lang === 'ar' ? 'chevL' : 'chevR', 18)}</span></button>`;
}
function stopRow(s, i) { const nx = nextIdx(); const cls = s.status === 'done' ? 'done' : s.status === 'failed' ? 'fail' : '';
  const flags = [s.win ? ic('clock', 14) : '', s.proof === 'photo' ? ic('cam', 14) : '', s.proof === 'sig' ? ic('sig', 14) : '', s.cod ? ic('cash', 14) : '', s.type === 'pick' ? ic('box', 14) : ''].join('');
  return `<button class="row ${s.status !== 'open' ? 'dim' : ''}" type="button" data-act="open" data-i="${i}"><span class="badge-n sm ${cls} num" ${i === nx ? 'style="border-color:var(--violet-hi);background:var(--violet-soft)"' : ''}>${i + 1}</span>
    <div style="min-width:0"><div class="r-a">${s.street} ${s.no}</div><div class="sub" style="display:flex;gap:6px;align-items:center;white-space:nowrap;overflow:hidden">${s.parcels === 1 ? t('parcel1') : t('parcels', { n: s.parcels })}<span class="ic-flags">${flags}</span></div></div>
    <span class="r-r num">${s.status === 'done' ? `<span style="color:var(--mint)">${ic('check', 18, 2.6)}</span>` : s.status === 'failed' ? `<span style="color:var(--coral)">${ic('x', 18, 2.6)}</span>` : (i === nx ? distTo(i).txt : '')}</span></button>`; }
function vStops() {
  const st = T.stops, q = S.q.toLowerCase(), nx = nextIdx();
  const match = s => !q || (`${s.street} ${s.no} ${s.zip} ${s.name} ${s.codes.join(' ')}`).toLowerCase().includes(q);
  const all = st.map((s, i) => [s, i]).filter(([s]) => match(s));
  const open = all.filter(([s]) => s.status === 'open'), done = all.filter(([s]) => s.status === 'done'), fail = all.filter(([s]) => s.status === 'failed');
  const f = S.filter; let body = '';
  const sec = (title, list) => list.length ? `<div class="sec-h">${title}<span class="k">${list.length}</span></div>${list.map(([s, i]) => stopRow(s, i)).join('')}` : '';
  if (f === 'open' || f === 'all') body += sec(t('sNext'), open.slice(0, 10)) + sec(t('sLater'), open.slice(10));
  if (f === 'prob' || f === 'all') body += sec(t('sProb'), fail);
  if (f === 'done' || f === 'all') body += sec(t('sDone'), done);
  return `<div class="app-top"><div><div class="hname">${t('stops')}</div><div class="sub">${T.code} · ${metrics().fin}/${st.length}</div></div><button class="iconbtn" type="button" data-act="addstop" aria-label="${t('addStop')}" style="margin-inline-start:auto;background:var(--violet);color:#fff;border:0">${ic('plus', 22, 2.4)}</button></div>
    <label class="searchx">${ic('search', 18)}<input id="sq" type="search" value="${S.q}" placeholder="${t('searchStops')}" aria-label="${t('searchStops')}"></label>
    <div class="chiprow" style="margin-top:10px">${[['open', t('fOpen'), open.length], ['prob', t('fProb'), fail.length], ['done', t('fDone'), done.length], ['all', t('fAll'), all.length]].map(([k, l, n]) => `<button class="fchip" type="button" data-filter="${k}" aria-pressed="${f === k}">${l} <span class="num" style="opacity:.7">${n}</span></button>`).join('')}</div>
    <div id="stoplist">${body || `<div class="empty" style="padding:40px 10px"><span class="sub">—</span></div>`}</div>`;
}
function vMore() {
  const m = metrics(); const li = (icn, title, sub, act, extra = '') => `<button class="li" type="button" ${act ? `data-act="${act}"` : ''}><span class="lic">${ic(icn, 18)}</span><span class="grow"><b>${title}</b>${sub ? `<span class="s">${sub}</span>` : ''}</span>${extra || ic(S.lang === 'ar' ? 'chevL' : 'chevR', 18)}</button>`;
  const tg = (id, on) => `<label class="tgl" onclick="event.stopPropagation()"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="tr"></span></label>`;
  const light = document.documentElement.dataset.theme === 'light';
  return `<div class="app-top"><div class="hname">${t('more')}</div></div>
  <section class="ns" style="margin-top:0;display:flex;align-items:center;gap:12px"><span class="avatar" style="width:52px;height:52px;border-radius:17px;font-size:15px">RN</span><div style="flex:1;min-width:0"><div style="font-weight:800;font-size:17px">R. Neumann</div><div class="sub">${t('vehicle')}: H-JL 101 · ${T.code}</div></div>${syncPill()}</section>
  <div class="sec-h">${t('profile')}</div>
  <div class="list-card">
    ${li('globe', t('language'), { de: 'Deutsch', en: 'English', ro: 'Română', ar: 'العربية' }[S.lang], 'lang')}
    <div class="li"><span class="lic">${ic(light ? 'sun' : 'moon', 18)}</span><span class="grow"><b>${t('theme')}</b><span class="s">${light ? t('light') : t('dark')}</span></span><button class="theme-switch" id="theme" type="button" role="switch" aria-checked="${light}" aria-label="${t('theme')}"><span class="knob"><span class="ic-moon">${ic('moon', 14, 2.2)}</span><span class="ic-sun">${ic('sun', 14, 2.2)}</span></span></button></div>
    ${li('nav', t('navApp'), S.navApp ? t(S.navApp) : t('askEach'), 'navpref')}
    <div class="li"><span class="lic" style="color:${S.gpsOn ? 'var(--mint)' : 'var(--text-3)'}">${ic('gps', 18)}</span><span class="grow"><b>${t('gps')}</b><span class="s">${S.gpsOn ? t('gpsOn') : t('gpsOff')}</span></span>${tg('p-gps', S.gpsOn)}</div>
    <div class="li"><span class="lic">${ic('bolt', 18)}</span><span class="grow"><b>${t('motion')}</b></span>${tg('p-mot', S.motion)}</div>
  </div>
  <div class="sec-h">${t('tourToday')}</div>
  <div class="list-card">${li('refresh', t('syncTitle'), t('lastSync', { t: S.lastSync }), 'sync')}${li('list', t('summary'), `${m.fin}/${m.n} · ${nf(m.km, 1)} ${t('kmLeft')}`, 'summary')}${li('hist', t('history'), S.history.length ? `${S.history.length}` : t('noHistory'), 'history')}${li('truck', t('tours'), t('toursN', { n: 2 }), 'tours')}</div>
  <div class="sec-h">${t('demoCtl')}<span class="proto" style="margin-inline-start:6px">${t('proto')}</span></div>
  <div class="list-card"><div class="li"><span class="lic">${ic('cloudOff', 18)}</span><span class="grow"><b>${t('simOffline')}</b></span>${tg('p-off', !S.online)}</div><div class="li"><span class="lic">${ic('alert', 18)}</span><span class="grow"><b>${t('simFail')}</b></span>${tg('p-fail', S.simFail)}</div>${li('refresh', t('reset'), '', 'reset')}</div>
  <div style="text-align:center;margin:18px 0 6px;font-size:11.5px;color:var(--text-3);font-weight:600"><span class="logo-lockup" role="img" aria-label="TURVIO" style="height:18px;margin:0 auto 8px"></span>Driver · ${t('versionL')} <span title="Staging" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--amber);margin-inline-start:4px"></span></div>`;
}
/* ---------- map screen + sheet */
function sheetBody() {
  const nx = nextIdx(); const i = S.sel ?? nx; if (i < 0) return `<div style="padding:20px;text-align:center" class="addr">${t('tourDone')}</div>`;
  const s = T.stops[i], dd = distTo(i), isNext = i === nx, open = s.status === 'open';
  let h = `<div class="ns-h"><span class="badge-n num ${s.status === 'done' ? 'sm done' : s.status === 'failed' ? 'sm fail' : ''}">${i + 1}</span><div style="min-width:0;flex:1"><div class="sub" style="color:${isNext ? 'var(--violet-text)' : 'var(--text-3)'};font-weight:800">${open ? (isNext ? t('nextStop') : t('stopN', { n: i + 1 })) + ' · ' + t('away', { d: dd.txt, m: dd.min }) : s.status === 'done' ? `${t('delivered')} · ${s.time || ''}` : `${t('notDelivered')} · ${s.reason ? t(s.reason) : ''}`}</div><div class="addr" style="font-size:18px">${s.street} ${s.no}</div><div class="sub"><bdi>${s.zip} Hannover</bdi> · <bdi>${s.name}</bdi></div></div></div>`;
  if (open) h += `<div class="bigbtns" style="grid-template-columns:1.1fr 1fr 58px"><button class="bb bb-nav" type="button" data-act="nav" data-i="${i}">${ic('nav', 19, 2.4)}${t('navigate')}</button><button class="bb bb-ok" type="button" data-act="deliver" data-i="${i}">${ic('check', 20, 2.8)}${t('delivered')}</button><button class="bb bb-fail" type="button" data-act="fail" data-i="${i}" aria-label="${t('problem')}">${ic('alert', 20, 2.2)}</button></div>`;
  h += `<div class="chips" style="margin-top:12px">${chipsFor(s)}</div>`;
  if (s.note) h += `<div class="warn" style="grid-template-columns:4px 1fr;margin-top:10px"><span class="sv" style="background:var(--amber)"></span><span style="font-size:13px;font-weight:600">${t('note')}: ${s.note}</span></div>`;
  h += `<div class="sec-h" style="margin-top:14px">${t('tracking')}<span class="k">${s.codes.length}</span></div><div class="list-card">${s.codes.map(c => `<div class="li" style="min-height:44px"><span class="lic" style="width:28px;height:28px">${ic('pkg', 15)}</span><span class="grow num" style="font-weight:700;font-size:13.5px">${c}</span></div>`).join('')}</div>
    <div class="bigbtns"><button class="bb bb-sec" type="button" data-act="call">${ic('phone', 18)}${t('call')}</button>${open ? `<button class="bb bb-fail" type="button" data-act="fail" data-i="${i}">${t('notDelivered')}</button>` : `<button class="bb bb-sec" type="button" data-act="selnext">${t('nextStop')}</button>`}</div>`;
  const up = T.stops.map((x, k) => [x, k]).filter(([x, k]) => x.status === 'open' && k !== i).slice(0, 8);
  h += `<div class="sec-h">${t('afterThat')}</div>${up.map(([x, k]) => stopRow(x, k)).join('')}`;
  return h;
}
function vMap() { const m = metrics();
  return `<div class="mapwrap" id="mapwrap"><div class="m-top"><button class="mpill" type="button" data-act="tab" data-tab="today" aria-label="${t('today')}"><span class="num">${m.fin}/${m.n}</span><span class="pb"><i style="width:${(m.fin / m.n * 100).toFixed(1)}%"></i></span><span class="num" style="color:var(--text-3)">${nf(m.km, 1)} km · ${hm(m.min)}</span></button>${syncPill()}</div>
    <span class="m-note">${t('mapIllus')}</span>
    <div class="m-ctrl" id="mctrl"><button class="fab" type="button" data-act="optimize" aria-label="${t('optTitle')}">${ic('wand', 20)}</button><button class="fab" type="button" data-act="fit" aria-label="${t('fitRoute')}">${ic('fit', 20)}</button><button class="fab on" type="button" data-act="recenter" aria-label="${t('recenter')}">${ic('gps', 21, 2.2)}</button></div>
    <section class="sheet" id="sheet" aria-label="${t('details')}"><div class="grab" id="grab" role="button" tabindex="0" aria-label="${t('details')}"><i></i></div><div class="sheet-b" id="sheetb">${sheetBody()}</div></section></div>`; }
function setSheet(st, animateMap = true) { S.sheet = st; const sh = $('#sheet'); if (!sh) return; sh.style.height = sheetPx() + 'px'; $('#mctrl').style.bottom = (Math.min(sheetPx(), $('#device').clientHeight * .62) + 12) + 'px'; $('#mctrl').style.opacity = st === 'full' ? 0 : 1; }

/* ---------- scan screen */
const SAMPLE = () => { const nx = Math.max(0, nextIdx()); return [
  { code: 'TRV 4471 0093 25', kind: 'match', i: nx + 8 }, { code: 'TRV 4471 0093 61', kind: 'new', street: 'Wedekindstraße', no: 38, zip: '30161', parcels: 1, conf: .97 },
  { code: 'TRV 4471 0093 25', kind: 'dup' }, { code: 'TRV 4471 0094 08', kind: 'new', street: 'Ferdinand-Wallbrecht-Str.', no: 12, zip: '30163', parcels: 2, conf: .91 },
  { code: '?? 0042-X', kind: 'invalid' }, { code: 'TRV 4471 0094 77', kind: 'match', i: nx + 15 }, { code: 'TRV 4471 0095 02', kind: 'new', street: 'Jakobistraße', no: 54, zip: '30163', parcels: 1, conf: .88 }]; };
function vScan() {
  const tgt = S.scanTarget === 'lookup' ? t('lookupMode') : S.scanTarget === 'new' ? 'HAN-07' : T.code;
  const items = S.scanned; const nNew = items.filter(x => x.kind === 'new').length;
  const head = `<div class="app-top" style="padding-inline:16px;padding-bottom:8px"><div class="hname">${t('scanTitle')}</div><button class="tagx t-vi" type="button" data-act="target" style="margin-inline-start:auto;border:0;height:34px">${t('targetIs', { x: tgt })}${ic('chev', 13)}</button></div>
    <div style="padding:0 16px 10px">${seg('smode', [['cam', t('camera')], ['manual', t('manualT')], ['paste', t('paste')]], S.scanMode, 'sm')}</div>`;
  let main = '';
  if (S.scanMode === 'cam') main = `<div class="cam" id="cam"><div class="shelf"></div><div class="parcel"><div class="lbl"><div class="bc"></div><div class="ln"></div><div class="ln" style="width:70%"></div><div class="ln" style="width:50%"></div></div></div>
      <div class="reticle" id="ret"><i></i><i></i><i></i><i></i><div class="laser"></div></div><div class="flash" id="flash"></div><div class="scan-msg" id="smsg"></div>
      <span class="m-note" style="top:auto;bottom:118px;left:16px">${t('camSim')}</span>
      <div style="position:absolute;left:0;right:0;bottom:30px;display:flex;align-items:center;justify-content:center;gap:16px">
        <label class="tgl" style="color:#fff;background:rgba(10,12,18,.6);padding:8px 12px;border-radius:14px"><input type="checkbox" id="auto" ${S.auto ? 'checked' : ''}><span class="tr"></span>${t('auto')}</label>
        <button type="button" data-act="scanone" aria-label="${t('scanDemo')}" style="width:74px;height:74px;border-radius:50%;border:5px solid #fff;background:linear-gradient(135deg,var(--violet-hi),var(--cobalt));color:#fff;display:grid;place-items:center">${ic('scan', 28, 2.4)}</button>
        <span style="width:100px;color:#fff;font-size:12px;font-weight:700;text-align:start">${t('scanDemo')}</span></div></div>`;
  else if (S.scanMode === 'manual') main = `<div style="flex:1;overflow:auto;padding:4px 16px 12px"><div class="fld"><label for="m-st">${t('street')}</label><input id="m-st" value="Lister Meile 41" autocomplete="off"></div><div style="display:grid;grid-template-columns:1fr 1.4fr;gap:8px"><div class="fld"><label for="m-zip">${t('zip')}</label><input id="m-zip" value="30161" inputmode="numeric"></div><div class="fld"><label for="m-city">${t('city')}</label><input id="m-city" value="Hannover"></div></div>
      <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:8px;align-items:end"><div class="fld"><label for="m-n">${t('nParcels')}</label><input id="m-n" value="1" inputmode="numeric"></div><div class="fld">${seg('mtype', [['del', t('typeDelivery')], ['pick', t('typePickup')]], 'del', 'sm')}</div></div>
      <button class="bb bb-nav wide" type="button" data-act="manualadd" style="width:100%">${ic('plus', 18, 2.4)}${t('addOne')}</button></div>`;
  else main = `<div style="flex:1;overflow:auto;padding:4px 16px 12px"><label class="sub" for="pta">${t('pasteHint')}</label><textarea class="ta" id="pta" style="margin-top:6px">Podbielskistraße 210, 30177 Hannover\nSpichernstraße 9, 30161 Hannover\nCeller Straße 61, 30161 Hannover\nKollenrodtstraße 33, 30163 Hannover</textarea><button class="bb bb-nav wide" type="button" data-act="parse" style="width:100%;margin-top:10px">${ic('paste', 18)}${t('parse')}</button></div>`;
  const tray = `<div class="tray" id="tray"><div style="display:flex;align-items:center;gap:8px"><b>${t('scannedN', { n: items.length })}</b>${nNew && S.scanTarget !== 'lookup' ? `<button class="btn btn-primary btn-sm" type="button" data-act="addscanned" style="margin-inline-start:auto;height:40px"><span class="lbl">${t('addN', { n: nNew })}</span></button>` : ''}</div>
    ${items.map((x, k) => { const c = x.kind === 'match' ? ['var(--mint-soft)', 'var(--mint)', 'check', t('matched', { n: x.i + 1 })] : x.kind === 'new' ? ['var(--cobalt-soft)', 'var(--cobalt-text)', 'pin', `${x.street} ${x.no} · ${t('conf', { p: Math.round(x.conf * 100) + ' %' })}`] : x.kind === 'found' ? ['var(--mint-soft)', 'var(--mint)', 'check', t('found', { n: x.i + 1 })] : ['var(--surface-2)', 'var(--text-3)', 'search', t('notFound')];
      return `<div class="sitem"><span class="si" style="background:${c[0]};color:${c[1]}">${ic(c[2], 17, 2.4)}</span><div style="min-width:0"><div class="num" style="font-weight:700;font-size:13.5px">${x.code}</div><div class="sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c[3]}</div></div>${x.kind === 'new' ? `<span style="display:flex;gap:4px"><button class="iconbtn" style="width:40px;height:40px" type="button" data-act="editscan" data-k="${k}" aria-label="${t('edit')}">${ic('edit', 16)}</button><button class="iconbtn" style="width:40px;height:40px" type="button" data-act="rmscan" data-k="${k}" aria-label="${t('remove')}">${ic('trash', 16)}</button></span>` : ''}</div>`; }).join('')}</div>`;
  return `<div style="position:absolute;inset:0;display:flex;flex-direction:column">${head}${main}${tray}</div>`;
}
function seg(id, items, value, cls = '') { return `<div class="seg ${cls}" role="group" data-seg="${id}" style="width:100%;display:flex">${items.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === value}" style="flex:1">${l}</button>`).join('')}<span class="seg-ind"></span></div>`; }
function placeSeg(root = document) { $$('.seg', root).forEach(s => { const b = s.querySelector('[aria-pressed="true"]'), ind = s.querySelector('.seg-ind'); if (!b || !ind) return; ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft - 3}px)`; }); }

/* ================= RENDER ================= */
const TABS = ['today', 'map', 'stops', 'scan', 'more'];
function renderTabbar() {
  $('#tabbar').innerHTML = `<span class="tb-ind" id="tbind"></span>` + TABS.map(k => k === 'scan' ? `<button class="tb scan" type="button" data-tab="${k}" aria-label="${t('scan')}" ${S.tab === k ? 'aria-current="page"' : ''}><span class="sc">${ic('scan', 24, 2.2)}</span><span class="l">${t(k)}</span></button>` :
    `<button class="tb" type="button" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ic(k, 22, 2)}<span>${t(k)}</span></button>`).join('');
  requestAnimationFrame(() => { const b = $(`.tb[data-tab="${S.tab}"]`), ind = $('#tbind'); if (!b || !ind) return; const on = S.tab !== 'scan'; ind.style.opacity = on ? 1 : 0; ind.style.width = (b.offsetWidth - 8) + 'px'; ind.style.transform = `translateX(${b.offsetLeft + 4}px)`; });
}
function render(o = {}) {
  document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  const va = $('#view'); const tab = S.tab;
  if (tab === 'map') { va.innerHTML = vMap(); const w = $('#mapwrap'); w.prepend(M.el); measure(); setSheet(S.sheet); if (o.fit !== false && (o.fresh || o.fit)) { const i = S.sel ?? nextIdx(); i >= 0 ? focusStop(i, !o.fresh) : fitPts(T.stops, false); } else apply(); bindSheet(); }
  else if (tab === 'scan') { va.innerHTML = `<div class="scr" style="padding:0;overflow:hidden">${vScan()}</div>`; if (!S.scanTarget) setTimeout(openTarget, 250); }
  else { const y = o.keep ? ($('.scr') || {}).scrollTop || 0 : 0; va.innerHTML = `<div class="scr" ${o.keep ? 'style="animation:none"' : ''}>${tab === 'today' ? vToday() : tab === 'stops' ? vStops() : vMore()}</div>`; if (o.keep) $('.scr').scrollTop = y; }
  placeSeg(va); renderTabbar(); refreshNetIcons();
}
function refreshNetIcons() { const sb = $('#sbar-net'); if (sb) sb.innerHTML = S.online ? ic('signal', 15) + ic('wifi', 15) : ic('cloudOff', 15); }
function go(tab, o = {}) { if (tab !== 'scan') stopAuto(); S.tab = tab; render({ fresh: true, ...o }); }

/* sheet drag */
function bindSheet() { const g = $('#grab'), sh = $('#sheet'); if (!g) return; let d = null;
  const start = e => { d = { y: e.clientY, h: sh.offsetHeight }; sh.classList.add('drag'); g.setPointerCapture(e.pointerId); };
  g.addEventListener('pointerdown', start);
  g.addEventListener('pointermove', e => { if (!d) return; const h = Math.max(160, Math.min($('#device').clientHeight - 50, d.h - (e.clientY - d.y))); sh.style.height = h + 'px'; });
  g.addEventListener('pointerup', e => { if (!d) return; const moved = Math.abs(e.clientY - d.y); sh.classList.remove('drag'); const h = sh.offsetHeight; d = null; const dh = $('#device').clientHeight;
    if (moved < 5) { setSheet(S.sheet === 'peek' ? 'half' : S.sheet === 'half' ? 'full' : 'peek'); return; }
    const snaps = [['peek', 292], ['half', dh * .62], ['full', dh - 64]]; snaps.sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h)); setSheet(snaps[0][0]); });
  g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheet(S.sheet === 'peek' ? 'half' : S.sheet === 'half' ? 'full' : 'peek'); } });
}
function selectStop(i, fromMap) { S.sel = i; if (S.tab !== 'map') { S.sheet = 'half'; go('map'); return; } $('#sheetb').innerHTML = sheetBody(); if (S.sheet === 'peek' && !fromMap) setSheet('half'); renderDyn(); if (!fromMap) focusStop(i); else { const [x, y] = toScr(T.stops[i]); if (y > M.ch - sheetPx() + 20 || x < 10 || x > M.cw - 10) focusStop(i); } }
const toScr = p => { const [X, Y] = GEO.W([p.x, p.y]); return [(X - M.view.x) / M.view.w * M.cw, (Y - M.view.y) / (M.view.w * M.ch / M.cw) * M.ch]; };

/* ================= LAYERS: sheets, full screens ================= */
function msheet(html, id = 'ms') { closeLayers(); const L = $('#layer'), m = $('#msheet'); m.id = 'msheet'; m.dataset.kind = id; m.innerHTML = `<div class="grab"><i></i></div>${html}`; L.classList.add('on'); requestAnimationFrame(() => m.classList.add('on')); placeSeg(m); }
function closeLayers() { $('#layer').classList.remove('on'); $('#msheet').classList.remove('on'); $('#full').classList.remove('on'); }
function full(html) { const f = $('#full'); f.innerHTML = html; $('#msheet').classList.remove('on'); $('#layer').classList.remove('on'); requestAnimationFrame(() => f.classList.add('on')); placeSeg(f); }
function openSync() { const st = syncState(); const items = S.queue.slice(0, 12);
  const stL = { waiting: [t('waiting'), 'var(--amber)'], sending: [t('sending'), 'var(--cyan)'], ok: [t('confirmed'), 'var(--mint)'], failed: [t('sendFail'), 'var(--coral)'] };
  const html = `<h3>${t('syncTitle')}</h3><p class="sub" style="margin:4px 0 12px">${t('syncSub')}</p>
    <div class="opt" style="cursor:default">${ic(S.online ? 'cloud' : 'cloudOff', 22)}<div style="flex:1"><b>${{ online: t('synced'), offline: t('offline'), syncing: t('syncing'), failed: t('failed'), pending: t('pending', { n: S.queue.filter(q => q.st !== 'ok').length }) }[st]}</b><span class="s">${t('lastSync', { t: S.lastSync })}</span></div>
      ${st === 'failed' || (st === 'pending' && S.online) ? `<button class="btn btn-primary btn-sm" type="button" data-act="retry" style="height:44px"><span class="lbl">${t('retry')}</span></button>` : ''}</div>
    <div class="list-card">${items.length ? items.map(q => `<div class="li"><span class="lic" style="color:${q.kind === 'del' ? 'var(--mint)' : 'var(--coral)'}">${ic(q.kind === 'del' ? 'check' : 'x', 16, 2.6)}</span><span class="grow"><b>${q.label}</b><span class="s">${q.time}${q.proof ? ' · ' + t('proofLocal') : ''}</span></span><span style="font-size:12px;font-weight:800;color:${stL[q.st][1]};white-space:nowrap">${stL[q.st][0]}</span></div>`).join('') : `<div class="li"><span class="grow s">${t('noPending')}</span></div>`}</div>
    <div class="note" style="margin-top:10px">${ic('alert', 14)}<span>${t('syncSim')}</span></div>`;
  if ($('#msheet.on') && $('#msheet').dataset.kind === 'sync') { $('#msheet').innerHTML = `<div class="grab"><i></i></div>${html}`; } else msheet(html, 'sync'); }
function openTarget() { if (S.tab !== 'scan') return;
  msheet(`<h3>${t('targetQ')}</h3><p class="sub" style="margin:4px 0 12px">${t('targetSub')}</p>
    ${[['active', 'truck', t('tActive', { c: T.code }), t('tActiveS')], ['new', 'plus', t('tNew'), t('tNewS')], ['lookup', 'search', t('tLookup'), t('tLookupS')]].map(([k, icn, a, b]) => `<button class="opt" type="button" data-target="${k}" aria-pressed="${S.scanTarget === k}"><span class="oi">${ic(icn, 20)}</span><span><b>${a}</b><span class="s">${b}</span></span></button>`).join('')}`, 'target'); }
function openNavChooser(i) { msheet(`<h3>${t('navWith')}</h3><p class="sub" style="margin:4px 0 12px">${T.stops[i].street} ${T.stops[i].no}, ${T.stops[i].zip}</p>
    ${[['gmaps', '#3478FF'], ['waze', '#18B6E8'], ['apple', '#6F55FF']].map(([k, c]) => `<button class="opt" type="button" data-navapp="${k}" data-i="${i}"><span class="oi" style="background:${c};color:#fff;font-weight:800">${t(k)[0]}</span><span><b>${t(k)}</b></span></button>`).join('')}
    <label class="opt" style="cursor:pointer"><span class="oi">${ic('check', 18)}</span><span style="flex:1"><b>${t('always')}</b></span><span class="tgl"><input type="checkbox" id="navalways"><span class="tr"></span></span></label>`, 'nav'); }
function handoff(app, i) { closeLayers(); const s = T.stops[i]; const h = $('#navh'); const c = { gmaps: '#3478FF', waze: '#18B6E8', apple: '#6F55FF' }[app];
  h.innerHTML = `<span class="navlogo" style="background:${c}">${t(app)[0]}</span><div class="addr">${t('opening', { app: t(app) })}</div><div class="sub" style="font-size:14px">${s.street} ${s.no}, ${s.zip} Hannover</div>
    <div class="note" style="max-width:300px;justify-content:center">${ic('alert', 14)}<span>${t('navSim')}</span></div>
    <button class="bb bb-ok" type="button" data-act="arrived" data-i="${i}" style="width:100%;max-width:320px">${ic('pin', 20, 2.4)}${t('arrived')}</button><button class="bb bb-sec" type="button" data-act="backturvio" style="width:100%;max-width:320px">${t('backTo')}</button>`;
  h.classList.add('on'); }

/* ---------- delivery flow */
let undoSnap = null;
function snap() { return { stops: T.stops.map(s => ({ ...s })), queueLen: S.queue.length, hist: S.history.length, clock: S.clock, sel: S.sel }; }
function deliver(i) { const s = T.stops[i]; const steps = []; if (s.cod) steps.push('cod'); if (s.proof === 'photo') steps.push('photo'); if (s.proof === 'sig') steps.push('sig'); runSteps(i, steps, {}); }
function runSteps(i, steps, proof) { if (!steps.length) { finish(i, 'done', proof); return; } const [k, ...rest] = steps; const s = T.stops[i];
  const head = (title) => `<div class="full-h"><button class="iconbtn" type="button" data-act="closefull" aria-label="${t('close')}">${ic('x', 20, 2.2)}</button><div style="flex:1;min-width:0"><div style="font-weight:800;font-size:16px">${title}</div><div class="sub">${t('stopN', { n: i + 1 })} · ${s.street} ${s.no}</div></div><span class="tagx t-vi">${t('required')}</span></div>`;
  if (k === 'cod') { full(`${head(t('codTitle'))}<div class="full-b"><div class="ns" style="text-align:center;margin-top:30px"><div class="sub">${t('codHint')}</div><div style="font-size:44px;font-weight:800;letter-spacing:-.03em;margin:12px 0" class="num">${eur(s.cod)}</div></div><button class="bb bb-ok" type="button" id="codok" style="width:100%;margin-top:16px">${ic('cash', 20)}${t('codConfirm', { a: eur(s.cod) })}</button></div>`);
    $('#codok').onclick = () => runSteps(i, rest, { ...proof, cod: true }); return; }
  if (k === 'photo') { full(`${head(t('proofPhoto'))}<div class="full-b"><div class="photo" id="ph"><div class="door"></div><div class="pk"></div><span class="m-note" style="top:12px">${t('camSim')}</span></div><button class="shutter" type="button" id="shut" aria-label="${t('takePhoto')}"></button>
      <div class="bigbtns" id="phact" style="display:none"><button class="bb bb-sec" type="button" id="retake">${t('retake')}</button><button class="bb bb-ok" type="button" id="usep">${ic('check', 20, 2.6)}${t('usePhoto')}</button></div></div>`);
    $('#shut').onclick = () => { const f = document.createElement('div'); f.className = 'flash go'; $('#ph').appendChild(f); $('#ph').classList.add('taken'); $('#shut').style.display = 'none'; $('#phact').style.display = 'grid'; };
    $('#retake').onclick = () => { $('#ph').classList.remove('taken'); $('#shut').style.display = 'block'; $('#phact').style.display = 'none'; };
    $('#usep').onclick = () => runSteps(i, rest, { ...proof, photo: true }); return; }
  if (k === 'sig') { full(`${head(t('signTitle'))}<div class="full-b"><canvas class="sig" id="sigc" aria-label="${t('signHint')}"></canvas><div class="sub" style="text-align:center;margin-top:6px">${t('signHint')}</div>
      <div class="fld" style="margin-top:12px"><label for="signame">${t('recipientName')}</label><input id="signame" value="${s.name}"></div>
      <div class="bigbtns"><button class="bb bb-sec" type="button" id="sigclr">${t('clear')}</button><button class="bb bb-ok" type="button" id="sigok" disabled style="opacity:.45">${ic('check', 20, 2.6)}${t('confirmSign')}</button></div></div>`);
    const c = $('#sigc'); const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2; const x = c.getContext('2d'); x.scale(2, 2); x.lineWidth = 2.6; x.lineCap = 'round'; x.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff';
    let drawing = false, strokes = 0; const pt = e => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    c.onpointerdown = e => { drawing = true; c.setPointerCapture(e.pointerId); const [a, b] = pt(e); x.beginPath(); x.moveTo(a, b); };
    c.onpointermove = e => { if (!drawing) return; const [a, b] = pt(e); x.lineTo(a, b); x.stroke(); strokes++; if (strokes > 8) { const ok = $('#sigok'); ok.disabled = false; ok.style.opacity = 1; } };
    c.onpointerup = () => { drawing = false; };
    $('#sigclr').onclick = () => { x.clearRect(0, 0, c.width, c.height); strokes = 0; const ok = $('#sigok'); ok.disabled = true; ok.style.opacity = .45; };
    $('#sigok').onclick = () => runSteps(i, rest, { ...proof, sig: true }); return; }
}
function finish(i, status, info) {
  undoSnap = snap(); const s = T.stops[i]; S.clock += 4; s.status = status; s.time = clk(); if (info.reason) s.reason = info.reason;
  let label = `${t('stopN', { n: i + 1 })} · ${s.street} ${s.no}`;
  if (status === 'failed' && info.retry) { const copy = { ...s, status: 'open', reason: null, id: s.id + '-r', note: (s.note ? s.note + ' · ' : '') + t('reattempt') }; T.stops.push(copy); }
  S.history.unshift({ i, status, time: s.time, label, reason: info.reason });
  enqueue({ kind: status === 'done' ? 'del' : 'fail', label, time: s.time, proof: !!(info.photo || info.sig) });
  closeLayers(); const ov = $('#doneov'); const ok = status === 'done';
  ov.innerHTML = `<div class="done-card" style="position:relative"><svg class="done-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" fill="${ok ? 'var(--mint-soft)' : 'var(--coral-soft)'}"/><circle class="c" cx="50" cy="50" r="45" fill="none" style="stroke:${ok ? 'var(--mint)' : 'var(--coral)'}" stroke-width="5" stroke-linecap="round" transform="rotate(-90 50 50)"/>
    <path class="k" d="${ok ? 'M30 52 44 65 70 38' : 'M36 36 64 64M64 36 36 64'}" fill="none" style="stroke:${ok ? 'var(--mint)' : 'var(--coral)'}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>${ok ? '<span class="burst"></span>' : ''}
    <div class="addr" style="font-size:18px">${ok ? t('delivered') : t('notDelivered')} · ${i + 1}</div><div class="sub">${(() => { const n = nextIdx(); return n >= 0 ? t('nextIs', { n: n + 1 }) : t('tourDone'); })()}</div></div>`;
  ov.classList.add('on'); S.sel = null;
  setTimeout(() => { ov.classList.remove('on'); if (S.tab === 'map') { $('#sheetb').innerHTML = sheetBody(); setSheet('peek'); renderDyn(); const n = nextIdx(); if (n >= 0) focusStop(n); const mt = $('.m-top .mpill'); if (mt) { const d = document.createElement('div'); d.innerHTML = vMap(); mt.replaceWith(d.querySelector('.mpill')); } } else render({ keep: true });
    toast(ok ? t('deliveredToast', { n: i + 1 }) : t('failedToast', { n: i + 1 }), ok ? (s.parcels === 1 ? t('parcel1') : t('parcels', { n: s.parcels })) : t(info.reason), ok ? 'ok' : 'bad', { label: t('undo'), fn: doUndo }); }, reduce() ? 300 : 950);
}
function doUndo() { if (!undoSnap) return; T.stops = undoSnap.stops; S.queue.splice(0, S.queue.length - undoSnap.queueLen); S.history.splice(0, S.history.length - undoSnap.hist); S.clock = undoSnap.clock; undoSnap = null; S.sel = nextIdx();
  if (S.tab === 'map') { $('#sheetb').innerHTML = sheetBody(); renderDyn(); focusStop(S.sel); } else render({ keep: true }); refreshChrome(); toast(t('undone'), '', 'info'); }
function failFlow(i) { let reason = null, retry = false;
  const reasons = [['rNotHome', 'door'], ['rAddress', 'pin'], ['rAccess', 'lock'], ['rRefused', 'ban'], ['rDamaged', 'box'], ['rOther', 'dots']];
  msheet(`<h3>${t('failTitle')}</h3><p class="sub" style="margin:4px 0 12px">${t('stopN', { n: i + 1 })} · ${T.stops[i].street} ${T.stops[i].no}</p>
    <div class="rgrid" id="rgrid">${reasons.map(([k, icn]) => `<button class="rtile" type="button" data-reason="${k}" aria-pressed="false">${ic(icn, 20)}${t(k)}</button>`).join('')}</div>
    <label class="opt" style="cursor:pointer;margin-top:10px"><span class="oi">${ic('refresh', 18)}</span><span style="flex:1"><b>${t('reattempt')}</b><span class="s">${t('reattemptS')}</span></span><span class="tgl"><input type="checkbox" id="retry"><span class="tr"></span></span></label>
    <div class="fld"><label for="fnote">${t('addNote')} (${t('optional')})</label><input id="fnote" placeholder="${t('notePh')}"></div>
    <button class="bb bb-fail" type="button" id="freport" style="width:100%;background:var(--coral);color:#fff;opacity:.45">${t('report')}</button>`, 'fail');
  const m = $('#msheet');
  m.querySelector('#rgrid').onclick = e => { const b = e.target.closest('[data-reason]'); if (!b) return; reason = b.dataset.reason; $$('[data-reason]', m).forEach(x => x.setAttribute('aria-pressed', x === b)); const r = m.querySelector('#retry'); if (reason === 'rNotHome' && !r.dataset.touched) { r.checked = true; } m.querySelector('#freport').style.opacity = 1; };
  m.querySelector('#retry').onchange = e => { e.target.dataset.touched = 1; };
  m.querySelector('#freport').onclick = () => { if (!reason) { toast(t('chooseReason'), '', 'warn'); return; } retry = m.querySelector('#retry').checked; finish(i, 'failed', { reason, retry }); };
}

/* ---------- optimization */
function optimizeFrom(start, stops) { const n = stops.length; if (n < 3) return stops.slice(); const Pts = [start, ...stops, DATA.DEPOT]; const D = Pts.map(a => Pts.map(b => DATA.dist(a, b)));
  const used = new Array(n + 1).fill(false); used[0] = true; const ord = [0]; for (let k = 0; k < n; k++) { const l = ord[ord.length - 1]; let best = -1, bd = 1e9; for (let j = 1; j <= n; j++) if (!used[j] && D[l][j] < bd) { bd = D[l][j]; best = j; } used[best] = true; ord.push(best); } ord.push(n + 1);
  let imp = true, g = 0; while (imp && g++ < 80) { imp = false; for (let i = 1; i < ord.length - 2; i++) for (let j = i + 1; j < ord.length - 1; j++) { const a = ord[i - 1], b = ord[i], c = ord[j], d = ord[j + 1]; if (D[a][c] + D[b][d] < D[a][b] + D[c][d] - 1e-9) { ord.splice(i, j - i + 1, ...ord.slice(i, j + 1).reverse()); imp = true; } } }
  const neu = ord.slice(1, -1).map(i => stops[i - 1]); const len = arr => { let s = 0, p = start; arr.forEach(x => { s += DATA.dist(p, x); p = x; }); return s + DATA.dist(p, DATA.DEPOT); }; return len(neu) < len(stops) - .01 ? neu : stops.slice(); }
function routeLen(start, arr) { let s = 0, p = start; arr.forEach(x => { s += DATA.dist(p, x); p = x; }); return s + DATA.dist(p, DATA.DEPOT); }
function openOpt() { const g = gpsPos(); const open = T.stops.filter(s => s.status === 'open'); S.opt = { phase: 'run', step: 0, g, old: open, neu: null, mode: 'both' }; drawOpt(); const tick = () => { if (!S.opt || S.opt.phase !== 'run') return; S.opt.step++; if (S.opt.step < 3) { drawOpt(); setTimeout(tick, reduce() ? 50 : 520); } else { S.opt.neu = optimizeFrom(g, open); S.opt.phase = 'res'; drawOpt(true); } }; setTimeout(tick, reduce() ? 50 : 520); }
function drawOpt(anim) { const o = S.opt; if (!o) return; const head = `<div class="full-h"><button class="iconbtn" type="button" data-act="closeopt" aria-label="${t('close')}">${ic('x', 20, 2.2)}</button><div style="flex:1"><div style="font-weight:800;font-size:17px">${t('optTitle')}</div><div class="sub">${t('fromHere')} · ${t('remainingN', { n: o.old.length })}</div></div><span class="pill pill-demo">${t('demo')}</span></div>`;
  if (o.phase === 'run') { full(`${head}<div class="full-b"><div class="opt-run" style="padding-top:30px">${['os1', 'os2', 'os3'].map((k, i) => `<div class="opt-step ${i < o.step ? 'ok' : i === o.step ? 'run' : ''}" style="font-size:15px"><span class="os">${i < o.step ? ic('check', 12, 3) : ''}</span>${t(k)}</div>`).join('')}</div><div class="pbar" style="margin-top:20px"><i style="width:${o.step * 33}%;background:linear-gradient(90deg,var(--cyan),var(--violet-hi));transition:width .4s"></i></div></div>`); return; }
  const ok = routeLen(o.g, o.old), nk = routeLen(o.g, o.neu), om = ok / DATA.SPEED * 60, nm = nk / DATA.SPEED * 60; const idx = new Map(o.old.map((s, i) => [s.id, i])); const changed = o.neu.filter((s, i) => idx.get(s.id) !== i).length; const same = changed === 0;
  const W = o.neu.concat([o.g]).map(p => GEO.W([p.x, p.y])); const pad = 30, x0 = Math.min(...W.map(p => p[0])) - pad, x1 = Math.max(...W.map(p => p[0])) + pad, y0 = Math.min(...W.map(p => p[1])) - pad, y1 = Math.max(...W.map(p => p[1])) + pad;
  const vw = Math.max(x1 - x0, (y1 - y0) * 1.4), vh = vw / 1.4, vx = (x0 + x1) / 2 - vw / 2, vy = (y0 + y1) / 2 - vh / 2; const s = vw / 360;
  const [gx, gy] = GEO.W([o.g.x, o.g.y]);
  const mm = `<svg viewBox="${vx} ${vy} ${vw} ${vh}" style="direction:ltr"><use href="#geobase"/>${o.mode !== 'after' ? `<path d="${routePath([o.g, ...o.old])}" fill="none" style="stroke:var(--text-3)" stroke-width="2" stroke-dasharray="5 5" opacity=".8" vector-effect="non-scaling-stroke"/>` : ''}
    ${o.mode !== 'before' ? `<path ${anim && !reduce() ? 'class="route-new" pathLength="1000" stroke-dasharray="1000" style="--L:1000"' : ''} d="${routePath([o.g, ...o.neu])}" fill="none" stroke="url(#rgo)" stroke-width="3.4" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${(o.mode === 'before' ? o.old : o.neu).map((p, i) => { const [X, Y] = GEO.W([p.x, p.y]); return i < 12 ? `<circle cx="${X}" cy="${Y}" r="${8 * s}" style="fill:var(--surface);stroke:var(--cyan)" stroke-width="${1.6 * s}"/><text x="${X}" y="${Y + 3 * s}" text-anchor="middle" style="font-size:${8 * s}px;font-weight:800;fill:var(--text)">${i + 1}</text>` : `<circle cx="${X}" cy="${Y}" r="${2.6 * s}" style="fill:var(--cyan)"/>`; }).join('')}
    <circle cx="${gx}" cy="${gy}" r="${7 * s}" style="fill:var(--cobalt);stroke:#fff" stroke-width="${2.4 * s}"/></svg>`;
  const wins = o.neu.map(p => p.win).filter(Boolean).length;
  const moves = o.neu.map((p, i) => ({ p, i, o: idx.get(p.id) })).filter(x => x.o !== x.i).sort((a, b) => Math.abs(b.o - b.i) - Math.abs(a.o - a.i)).slice(0, 5);
  full(`${head}<div class="full-b"><div class="mini-map">${mm}<span class="m-note" style="top:10px">${t('mapIllus')}</span></div>
    <div style="margin-top:10px">${seg('omode', [['before', t('before')], ['after', t('after')], ['both', t('both')]], o.mode, 'sm')}</div>
    ${same ? `<div class="ns" style="text-align:center"><div style="color:var(--mint)">${ic('check', 34, 2.6)}</div><div class="addr" style="font-size:17px">${t('already')}</div><div class="sub">${t('alreadyS')}</div></div>` :
    `<div class="cmpx"><div class="c"><div class="k">${t('distance')}</div><div class="v num">${nf(nk, 1)} km</div><div class="o num">${nf(ok, 1)} km</div><span class="save num">−${nf(ok - nk, 1)} km</span></div><div class="c"><div class="k">${t('drive')}</div><div class="v num">${hm(nm)}</div><div class="o num">${hm(om)}</div><span class="save num">−${nf(om - nm)} min</span></div></div>
    <div class="cons" style="margin-top:10px"><span class="ci" style="background:var(--mint-soft);color:var(--mint)">${ic('check', 14, 2.6)}</span><span>${t('changedN', { n: changed })} · ${t('twOk', { a: wins, b: wins })}</span></div>
    <div class="sec-h">${t('changes')}</div>${moves.map(x => `<div class="chg"><span class="from num">${x.o + 1}</span><span class="to num">${x.i + 1}</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700">${x.p.street} ${x.p.no}</span></div>`).join('')}`}
    <div class="note" style="margin-top:12px">${ic('alert', 14)}<span>${t('calcNote')}</span></div>
    <div class="bigbtns"><button class="bb bb-sec" type="button" data-act="closeopt">${t('cancel')}</button><button class="bb bb-nav" type="button" data-act="applyopt" ${same ? 'disabled style="opacity:.45"' : ''}>${ic('check', 20, 2.6)}${t('apply')}</button></div></div>`);
}
function applyOpt() { const o = S.opt; undoSnap = snap(); const closed = T.stops.filter(s => s.status !== 'open'); T.stops = closed.concat(o.neu); T.optimized = true; S.opt = null; S.sel = null; closeLayers();
  if (S.tab === 'map') { $('#sheetb').innerHTML = sheetBody(); renderDyn(); fitPts([gpsPos(), ...T.stops.filter(s => s.status === 'open')]); } else render({ keep: true });
  toast(t('applied'), '', 'ok', { label: t('undo'), fn: () => { T.stops = undoSnap.stops; undoSnap = null; render({ keep: true }); toast(t('undone'), '', 'info'); } }); }

/* ---------- scanner */
let autoT = null;
function stopAuto() { clearInterval(autoT); autoT = null; S.auto = false; }
function scanOne() {
  const list = SAMPLE(); const x = { ...list[S.scanIdx % list.length] }; S.scanIdx++;
  if (S.scanTarget === 'lookup') { if (x.kind === 'match') x.kind = 'found'; else if (x.kind === 'new') x.kind = 'nf'; }
  if (x.kind !== 'invalid' && x.kind !== 'dup' && S.scanned.some(y => y.code === x.code)) x.kind = 'dup';
  const ret = $('#ret'), msg = $('#smsg'), fl = $('#flash'); if (!ret) return;
  const cls = x.kind === 'dup' ? 'dup' : x.kind === 'invalid' ? 'err' : 'hit'; ret.classList.remove('hit', 'dup', 'err'); void ret.offsetWidth; ret.classList.add(cls);
  fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); try { navigator.vibrate && navigator.vibrate(cls === 'hit' ? 30 : [40, 40, 40]); } catch {}
  const txt = x.kind === 'match' ? t('matched', { n: x.i + 1 }) : x.kind === 'new' ? `${t('newAddr')}: ${x.street} ${x.no}` : x.kind === 'dup' ? t('dup') : x.kind === 'invalid' ? t('invalid') : x.kind === 'found' ? t('found', { n: x.i + 1 }) : t('notFound');
  const col = cls === 'hit' ? '#2CE6A6' : cls === 'dup' ? '#FFB85C' : '#FF718B';
  msg.innerHTML = `<span style="width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:${col};color:#0B0D12">${ic(cls === 'hit' ? 'check' : cls === 'dup' ? 'alert' : 'x', 16, 2.8)}</span><div><div class="num">${x.code}</div><div style="font-weight:600;opacity:.8">${txt}</div></div>`; msg.classList.add('on'); clearTimeout(msg._t); msg._t = setTimeout(() => msg.classList.remove('on'), 1600);
  if (x.kind !== 'dup' && x.kind !== 'invalid') { S.scanned.unshift(x); const tr = $('#tray'); if (tr) { const d = document.createElement('div'); d.innerHTML = vScan(); tr.replaceWith(d.querySelector('#tray')); } }
}
function addScanned() { const news = S.scanned.filter(x => x.kind === 'new'); if (!news.length) return; const r = GEO.rng(S.scanIdx + 3);
  news.forEach((x, k) => { const c = { x: 1.2 + (r() - .5) * 1.6, y: -1.75 + (r() - .5) * 1.2 }; T.stops.push({ id: 'sc' + (++uid), x: c.x, y: c.y, street: x.street, no: x.no, zip: x.zip, parcels: x.parcels || 1, win: null, status: 'open', note: null, name: '—', codes: [x.code], proof: null, type: x.type || 'del', cod: null }); });
  T.optimized = false; S.scanned = S.scanned.filter(x => x.kind !== 'new'); render({ keep: true }); toast(t('added', { n: news.length }), t('notOptimized'), 'ok');
  setTimeout(() => msheet(`<h3>${t('reoptQ')}</h3><p class="sub" style="margin:4px 0 14px">${t('fromHereS')}</p><div class="bigbtns"><button class="bb bb-sec" type="button" data-act="closelayers">${t('cancel')}</button><button class="bb bb-nav" type="button" data-act="optimize">${ic('wand', 19)}${t('reopt')}</button></div>`, 'reopt'), 500); }

/* ================= EVENTS ================= */
document.addEventListener('pointerdown', ripple);
document.addEventListener('click', e => {
  const T0 = e.target;
  const tb = T0.closest('.tb'); if (tb) { go(tb.dataset.tab); return; }
  if (T0.closest('#layer')) { closeLayers(); return; }
  const sb = T0.closest('.seg button'); if (sb) { const sg = sb.parentElement.dataset.seg, v = sb.dataset.v; $$('button', sb.parentElement).forEach(b => b.setAttribute('aria-pressed', b === sb)); placeSeg(sb.parentElement.parentElement);
    if (sg === 'smode') { S.scanMode = v; stopAuto(); setTimeout(() => render(), 160); } else if (sg === 'omode') { S.opt.mode = v; drawOpt(false); } else if (sg === 'lang') { setTimeout(() => setLang(v), 160); } return; }
  const sz = T0.closest('[data-size]'); if (sz) { setSize(sz.dataset.size); return; }
  const tg = T0.closest('[data-target]'); if (tg) { S.scanTarget = tg.dataset.target; closeLayers(); if (S.scanTarget === 'new') toast(t('newTourMade'), '', 'info'); render(); return; }
  const na = T0.closest('[data-navapp]'); if (na) { const i = +na.dataset.i; if ($('#navalways') && $('#navalways').checked) { S.navApp = na.dataset.navapp; store.set('dr-nav', S.navApp); } handoff(na.dataset.navapp, i); return; }
  const pr = T0.closest('[data-navpref]'); if (pr) { S.navApp = pr.dataset.navpref === 'ask' ? null : pr.dataset.navpref; store.set('dr-nav', S.navApp); closeLayers(); render({ keep: true }); toast(t('saved')); return; }
  const lg = T0.closest('[data-lang]'); if (lg) { closeLayers(); setLang(lg.dataset.lang); return; }
  const fc = T0.closest('[data-filter]'); if (fc) { S.filter = fc.dataset.filter; render({ keep: true }); return; }
  const a = T0.closest('[data-act]'); if (!a) return; const act = a.dataset.act, i = a.dataset.i != null ? +a.dataset.i : null;
  switch (act) {
    case 'tab': go(a.dataset.tab); break;
    case 'continue': S.sel = null; S.sheet = 'peek'; go('map'); break;
    case 'open': selectStop(i, false); break;
    case 'nav': S.navApp ? handoff(S.navApp, i) : openNavChooser(i); break;
    case 'arrived': $('#navh').classList.remove('on'); S.sel = i; S.sheet = 'half'; if (S.tab !== 'map') go('map'); else { $('#sheetb').innerHTML = sheetBody(); setSheet('half'); } break;
    case 'backturvio': $('#navh').classList.remove('on'); break;
    case 'deliver': deliver(i); break;
    case 'fail': failFlow(i); break;
    case 'selnext': S.sel = null; $('#sheetb').innerHTML = sheetBody(); renderDyn(); focusStop(nextIdx()); break;
    case 'call': toast(t('callSim'), '', 'info'); break;
    case 'recenter': focusStop(nextIdx() >= 0 ? nextIdx() : 0); break;
    case 'fit': fitPts([gpsPos(), ...T.stops], true); break;
    case 'optimize': closeLayers(); openOpt(); break;
    case 'closeopt': S.opt = null; closeLayers(); break;
    case 'applyopt': applyOpt(); break;
    case 'closefull': closeLayers(); break;
    case 'closelayers': closeLayers(); break;
    case 'sync': openSync(); break;
    case 'retry': S.simFail = false; const pf = $('#p-fail'); if (pf) pf.checked = false; S.queue.forEach(q => { if (q.st === 'failed') q.st = 'waiting'; }); pump(); break;
    case 'tours': msheet(`<h3>${t('tours')}</h3><div style="height:8px"></div><button class="opt" type="button" aria-pressed="true" data-act="closelayers"><span class="oi" style="background:var(--violet-soft);color:var(--violet-text)">${ic('truck', 20)}</span><span style="flex:1"><b>${T.code} · ${T.area}</b><span class="s">${metrics().fin}/${T.stops.length} · ${t('activeTour')}</span></span></button>
        <div class="opt" style="opacity:.8"><span class="oi">${ic('box', 20)}</span><span style="flex:1"><b>${t('otherTour')}</b><span class="s">${t('otherTourS')}</span></span><span class="proto">${t('proto')}</span></div>`, 'tours'); break;
    case 'addstop': msheet(`<h3>${t('addStop')}</h3><div style="height:8px"></div>${[['scan', 'scan', t('scanTitle'), t('tActiveS')], ['manual', 'edit', t('manual'), t('manualS')], ['paste', 'paste', t('bulk'), t('bulkS')], ['import', 'file', t('importFile'), t('importS')]].map(([k, icn, ti, su]) => `<button class="opt" type="button" data-act="addvia" data-k="${k}"><span class="oi">${ic(icn, 20)}</span><span style="flex:1"><b>${ti}</b><span class="s">${su}</span></span>${k === 'import' ? `<span class="proto">${t('proto')}</span>` : ''}</button>`).join('')}`, 'add'); break;
    case 'addvia': { const k = a.dataset.k; closeLayers(); if (k === 'import') { toast(t('importFile'), t('proto'), 'info'); break; } S.scanTarget = S.scanTarget || 'active'; S.scanMode = k === 'scan' ? 'cam' : k; go('scan'); break; }
    case 'target': openTarget(); break;
    case 'scanone': scanOne(); break;
    case 'addscanned': addScanned(); break;
    case 'rmscan': S.scanned.splice(+a.dataset.k, 1); render(); break;
    case 'editscan': { const k = +a.dataset.k, x = S.scanned[k]; msheet(`<h3>${t('edit')}</h3><p class="sub num" style="margin:4px 0 12px">${x.code}</p><div class="fld"><label for="e-st">${t('street')}</label><input id="e-st" value="${x.street} ${x.no}"></div><div class="fld"><label for="e-zip">${t('zip')}</label><input id="e-zip" value="${x.zip}"></div><button class="bb bb-nav" type="button" id="e-save" style="width:100%">${t('save')}</button>`, 'edit');
      $('#e-save').onclick = () => { const v = $('#e-st').value.trim(); const m2 = v.match(/^(.*?)\s+(\d+\w?)$/); if (m2) { x.street = m2[1]; x.no = m2[2]; } else x.street = v; x.zip = $('#e-zip').value.trim(); x.conf = 1; closeLayers(); render(); toast(t('saved')); }; break; }
    case 'manualadd': { const v = $('#m-st').value.trim(); const m2 = v.match(/^(.*?)\s+(\d+\w?)$/) || [0, v, '']; const type = $('[data-seg="mtype"] [aria-pressed="true"]').dataset.v; S.scanned.unshift({ code: '—', kind: 'new', street: m2[1], no: m2[2], zip: $('#m-zip').value, parcels: +$('#m-n').value || 1, conf: 1, type }); render(); toast(t('newAddr'), v, 'ok'); break; }
    case 'parse': { const lines = $('#pta').value.split('\n').map(x => x.trim()).filter(Boolean); lines.forEach(l => { const m2 = l.match(/^(.*?)\s+(\d+\w?),\s*(\d{5})/); if (m2) S.scanned.unshift({ code: '—', kind: 'new', street: m2[1], no: m2[2], zip: m2[3], parcels: 1, conf: .95 }); }); render(); toast(t('scannedN', { n: lines.length }), t('pasteHint'), 'ok'); break; }
    case 'lang': msheet(`<h3>${t('language')}</h3><div style="height:8px"></div>${[['de', 'Deutsch'], ['en', 'English'], ['ro', 'Română'], ['ar', 'العربية']].map(([c, n]) => `<button class="opt" type="button" data-lang="${c}" aria-pressed="${S.lang === c}"><span class="oi" style="font-weight:800">${c.toUpperCase()}</span><span style="flex:1"><b>${n}</b></span>${S.lang === c ? ic('check', 18, 2.6) : ''}</button>`).join('')}`, 'lang'); break;
    case 'navpref': msheet(`<h3>${t('navApp')}</h3><div style="height:8px"></div>${[['ask', t('askEach')], ['gmaps', t('gmaps')], ['waze', t('waze')], ['apple', t('apple')]].map(([k, n]) => `<button class="opt" type="button" data-navpref="${k}" aria-pressed="${(S.navApp || 'ask') === k}"><span class="oi">${ic('nav', 18)}</span><span style="flex:1"><b>${n}</b></span></button>`).join('')}`, 'np'); break;
    case 'summary': { const m = metrics(); msheet(`<h3>${t('summary')}</h3><p class="sub" style="margin:4px 0 12px">${T.code} · ${T.area}</p><div class="cmpx"><div class="c"><div class="k">${t('sumDel')}</div><div class="v num">${T.stops.filter(s => s.status === 'done').length}</div></div><div class="c"><div class="k">${t('sumFail')}</div><div class="v num">${m.failed}</div></div><div class="c"><div class="k">${t('open')}</div><div class="v num">${m.open}</div></div><div class="c"><div class="k">${t('sumParcels')}</div><div class="v num">${T.stops.filter(s => s.status === 'done').reduce((a, s) => a + s.parcels, 0)}</div></div></div>`, 'sum'); break; }
    case 'history': msheet(`<h3>${t('history')}</h3><div style="height:8px"></div><div class="list-card">${S.history.length ? S.history.map(h => `<div class="li"><span class="lic" style="color:${h.status === 'done' ? 'var(--mint)' : 'var(--coral)'}">${ic(h.status === 'done' ? 'check' : 'x', 16, 2.6)}</span><span class="grow"><b>${h.label}</b><span class="s">${t('at', { t: h.time })}${h.reason ? ' · ' + t(h.reason) : ''}</span></span></div>`).join('') : `<div class="li"><span class="grow s">${t('noHistory')}</span></div>`}</div>`, 'hist'); break;
    case 'reset': reset(); render(); toast(t('resetDone'), '', 'info'); break;
  }
});
document.addEventListener('change', e => { const id = e.target.id;
  if (id === 'p-off') { S.online = !e.target.checked; if (S.online) pump(); render({ keep: true }); }
  if (id === 'p-fail') { S.simFail = e.target.checked; }
  if (id === 'p-gps') { S.gpsOn = e.target.checked; render({ keep: true }); }
  if (id === 'p-mot') { S.motion = e.target.checked; store.set('dr-motion', S.motion); document.documentElement.classList.toggle('calm', S.motion); }
  if (id === 'auto') { S.auto = e.target.checked; clearInterval(autoT); if (S.auto) { scanOne(); autoT = setInterval(() => { if (S.tab !== 'scan' || !$('#ret')) { stopAuto(); return; } scanOne(); }, 1500); } }
});
document.addEventListener('input', e => { if (e.target.id === 'sq') { S.q = e.target.value; const d = document.createElement('div'); d.innerHTML = vStops(); $('#stoplist').replaceWith(d.querySelector('#stoplist')); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeLayers(); $('#navh').classList.remove('on'); } });
document.addEventListener('click', e => { if (e.target.closest('#theme')) setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', e); });
function setTheme(next, ev) { const ap = () => { document.documentElement.dataset.theme = next; store.set('dr-theme', next); if (S.tab === 'more') render({ keep: true }); };
  if (!document.startViewTransition || reduce()) { ap(); return; } const x = ev?.clientX ?? innerWidth / 2, y = ev?.clientY ?? 40, r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const tr = document.startViewTransition(ap); tr.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 600, easing: 'cubic-bezier(.2,.75,.25,1)', pseudoElement: '::view-transition-new(root)' })); }
function setLang(l) { S.lang = l; store.set('dr-lang', l); render({ keep: S.tab !== 'map', fit: false }); renderStage(); }
function setSize(sz) { S.size = sz; store.set('dr-size', sz); const [w, h] = sz.split('x'); const d = $('#device'); d.style.setProperty('--dw', w + 'px'); d.style.setProperty('--dh', h + 'px'); renderStage(); setTimeout(() => { if (S.tab === 'map') { measure(); setSheet(S.sheet); apply(); } renderTabbar(); }, 420); }
function renderStage() { $('#stagebar').innerHTML = `<span style="display:inline-flex;align-items:center;gap:10px"><img src="${APPICON}" width="30" height="30" alt="TURVIO" style="border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.35)">Driver · ${t('proto')} · ${t('demo')}</span><div class="seg sm" style="display:inline-flex">${['390x844', '360x780', '412x915'].map(s => `<button type="button" data-size="${s}" aria-pressed="${S.size === s}">${s.replace('x', ' × ')}</button>`).join('')}<span class="seg-ind"></span></div>`; placeSeg($('#stagebar')); }
addEventListener('resize', () => { if (S.tab === 'map' && M.el.isConnected) { measure(); setSheet(S.sheet); apply(); } renderTabbar(); });

/* boot */
if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = store.get('dr-theme', 'dark');
document.documentElement.classList.toggle('calm', S.motion);
reset(); mapInit(); renderStage(); setSize(S.size); render({ fresh: true });
{ const sp = $('#splash'); const hide = () => { sp.classList.add('out'); setTimeout(() => sp.remove(), 420); }; sp.addEventListener('click', hide); setTimeout(hide, reduce() ? 350 : 1250); }
setInterval(() => { const c = $('#sbar-clock'); if (c) c.textContent = clk(); }, 5000);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { placeSeg(); renderTabbar(); });
})();
