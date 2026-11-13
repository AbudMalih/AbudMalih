/* TURVIO NEXT · Platform Admin prototype. Synthetic data only – nothing here reads or writes real records. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
                set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

/* ------------------------------------------------------------------ icons */
const P = {
  overview:'<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  analytics:'<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  organizations:'<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>',
  locations:'<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6 6 0 0 1 3.5 6"/>',
  fleet:'<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>',
  system:'<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  audit:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  prefs:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8.5 3 8.5H3S6 15 6 8"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  chev:'<path d="m6 9 6 6 6-6"/>', chevR:'<path d="m9 6 6 6-6 6"/>', chevL:'<path d="m15 6-6 6 6 6"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>', x:'<path d="M6 6l12 12M18 6 6 18"/>',
  up:'<path d="m6 15 6-6 6 6"/>', down:'<path d="m6 9 6 6 6-6"/>',
  download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  steer:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 14.5V21M9.6 11.3 3.5 9.5M14.4 11.3l6.1-1.8"/>',
  route:'<circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8"/>',
  alert:'<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
  shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  userPlus:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', pkg:'<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', menu:'<path d="M4 7h16M4 12h16M4 17h16"/>', side:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 10l-2 2 2 2"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>', pin:'<circle cx="12" cy="10" r="3"/><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/>',
  logout:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>', bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5"/>', expand:'<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', shrink:'<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'
};
const ic = (n, s = 18, w = 1.9) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

/* ------------------------------------------------------------------ state + i18n */
const S = {
  lang: store.get('tv-lang', 'de'), range: store.get('tv-range', '30'), org: 'all', loc: 'all',
  section: 'overview', metric: 'deliveries', compare: true, hidden: new Set(), excSel: null, actTab: 'all',
  collapsed: store.get('tv-collapsed', false), mapBig: false, motion: store.get('tv-motion', false), envHint: store.get('tv-env', true)
};
const LOCALE = { de: 'de-DE', en: 'en-GB', ar: 'ar-u-nu-latn' };
const t = (k, v) => { let s = (I18N[S.lang] && I18N[S.lang][k]) ?? I18N.de[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replace(`{${a}}`, b); return s; };
const nf = (n, d = 0) => new Intl.NumberFormat(LOCALE[S.lang], { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const pf = (n, d = 1) => new Intl.NumberFormat(LOCALE[S.lang], { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const df = (d, o = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat(LOCALE[S.lang], o).format(d);

/* ------------------------------------------------------------------ synthetic data */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ORGS = [{ id: 'jarbou', name: 'JARBOU Logistik', kind: 'pilot', created: new Date(2026, 3, 14), members: 46 },
              { id: 'muster', name: 'Muster Kurier', kind: 'test', created: new Date(2026, 9, 22), members: 5 }];
const LOCS = [
  { id: 'suhl', org: 'jarbou', name: 'Suhl', lon: 10.69, lat: 50.61, drivers: 14, vehicles: 12, base: 1180, rate: .978, ontime: .955, plate: 'SHL' },
  { id: 'erfurt', org: 'jarbou', name: 'Erfurt', lon: 11.03, lat: 50.98, drivers: 11, vehicles: 10, base: 930, rate: .972, ontime: .948, plate: 'EF' },
  { id: 'schweinfurt', org: 'jarbou', name: 'Schweinfurt', lon: 10.23, lat: 50.05, drivers: 8, vehicles: 8, base: 660, rate: .968, ontime: .941, plate: 'SW' },
  { id: 'coburg', org: 'jarbou', name: 'Coburg', lon: 10.96, lat: 50.26, drivers: 6, vehicles: 5, base: 470, rate: .951, ontime: .918, plate: 'CO' },
  { id: 'ilmenau', org: 'muster', name: 'Ilmenau', lon: 10.91, lat: 50.68, drivers: 3, vehicles: 3, base: 190, rate: .962, ontime: .93, plate: 'IK' }
];
const REASONS = [['notHome', .46, 'var(--coral)'], ['address', .18, 'var(--amber)'], ['access', .16, 'var(--violet-hi)'], ['refused', .12, 'var(--cobalt)'], ['damaged', .08, 'var(--cyan)']];
const TODAY = new Date(2026, 10, 11);
const DAYS = 190, NOW_FRAC = .63;
const SERIES = {};
for (const [li, L] of LOCS.entries()) {
  const r = rng(97 + li * 131), arr = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(TODAY); d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const wf = dow === 0 ? 0 : dow === 6 ? .52 : dow === 1 ? 1.08 : 1;
    const f = wf * (1 + .07 * Math.sin(i / 8.5 + li)) * (1 + (DAYS - i) * .0011) * (.94 + r() * .12);
    let stops = Math.round(L.base * f);
    let rate = L.rate + (r() - .5) * .014;
    if (L.id === 'coburg' && i <= 3) rate = .936 + r() * .006;
    const ontime = L.ontime + (r() - .5) * .02;
    if (i === 0) stops = Math.round(stops * NOW_FRAC);
    const delivered = Math.round(stops * rate), failed = stops - delivered;
    const tours = stops ? Math.max(1, Math.round(stops / (i === 0 ? 86 * NOW_FRAC : 86))) : 0;
    const kmOpt = tours * (62 + r() * 16), kmPlan = kmOpt * (1.1 + r() * .07);
    const exc = {}; let rest = failed;
    REASONS.forEach(([k, w], j) => { const v = j === REASONS.length - 1 ? rest : Math.round(failed * w * (.85 + r() * .3)); exc[k] = Math.max(0, Math.min(rest, v)); rest -= exc[k]; });
    arr.push({ date: d, stops, delivered, failed, ontime: Math.round(delivered * ontime), tours, kmOpt, kmPlan, exc });
  }
  SERIES[L.id] = arr;
}
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6);
const HOUR_W = [0, .02, .09, .13, .14, .13, .11, .1, .1, .08, .05, .03, .015, .005, 0];
function activeLocs() { return LOCS.filter(l => (S.org === 'all' || l.org === S.org) && (S.loc === 'all' || l.id === S.loc)); }

function aggregate() {
  const locs = activeLocs();
  if (S.range === 'today') {
    const mk = (dayIdx, cut) => HOURS.map((h, k) => {
      let delivered = 0, failed = 0, stops = 0, tours = 0, ontime = 0;
      for (const L of locs) { const full = SERIES[L.id][dayIdx]; const scale = dayIdx === 0 ? 1 / NOW_FRAC : 1;
        const tot = full.stops * scale; const v = tot * HOUR_W[k];
        stops += v; delivered += v * (full.delivered / Math.max(1, full.stops)); ontime += v * (full.ontime / Math.max(1, full.stops)); tours += full.tours; }
      const fut = cut && h + 1 > 15.33;
      return { label: `${String(h).padStart(2, '0')}:00`, stops: Math.round(stops), delivered: fut ? null : Math.round(delivered), forecast: fut ? Math.round(delivered) : null, failed: fut ? null : Math.round(stops - delivered), ontime: Math.round(ontime), tours: Math.round(tours / HOURS.length) };
    });
    const cur = mk(0, true), prev = mk(7, false);
    const sum = (a, k, lim) => a.reduce((s, x, i) => s + (lim === undefined || HOURS[i] < lim ? (x[k] || 0) : 0), 0);
    const t0 = locs.map(L => SERIES[L.id][0]), t7 = locs.map(L => SERIES[L.id][7]);
    const tot = (a, k) => a.reduce((s, x) => s + x[k], 0);
    return { buckets: cur, prev, hourly: true,
      totals: { delivered: tot(t0, 'delivered'), failed: tot(t0, 'failed'), stops: tot(t0, 'stops'), ontime: tot(t0, 'ontime'), tours: tot(t0, 'tours'), kmSave: t0.reduce((s, x) => s + x.kmPlan - x.kmOpt, 0), exc: excSum(t0) },
      ptotals: { delivered: Math.round(tot(t7, 'delivered') * NOW_FRAC), failed: Math.round(tot(t7, 'failed') * NOW_FRAC), stops: Math.round(tot(t7, 'stops') * NOW_FRAC), ontime: Math.round(tot(t7, 'ontime') * NOW_FRAC), tours: tot(t7, 'tours'), kmSave: t7.reduce((s, x) => s + x.kmPlan - x.kmOpt, 0) * NOW_FRAC } };
  }
  const n = +S.range;
  const day = (i) => { const o = { date: SERIES.suhl[i].date, stops: 0, delivered: 0, failed: 0, ontime: 0, tours: 0, kmOpt: 0, kmPlan: 0 };
    for (const L of locs) { const x = SERIES[L.id][i]; for (const k of ['stops', 'delivered', 'failed', 'ontime', 'tours', 'kmOpt', 'kmPlan']) o[k] += x[k]; } return o; };
  const cur = [], prev = [];
  for (let i = n - 1; i >= 0; i--) cur.push(day(i));
  for (let i = 2 * n - 1; i >= n; i--) prev.push(day(i));
  const tot = (a) => a.reduce((s, x) => { for (const k of ['stops', 'delivered', 'failed', 'ontime', 'tours']) s[k] = (s[k] || 0) + x[k]; s.kmSave = (s.kmSave || 0) + x.kmPlan - x.kmOpt; return s; }, {});
  const excRows = []; for (const L of locs) for (let i = 0; i < n; i++) excRows.push(SERIES[L.id][i]);
  const T = tot(cur); T.exc = excSum(excRows);
  return { buckets: cur.map(x => ({ ...x, label: df(x.date) })), prev: prev.map(x => ({ ...x, label: df(x.date) })), totals: T, ptotals: tot(prev), hourly: false };
}
function excSum(rows) { const o = {}; for (const [k] of REASONS) o[k] = rows.reduce((s, x) => s + x.exc[k], 0); return o; }
function todayFleet(L) { const r = rng(L.id.length * 77); const inUse = Math.max(1, L.vehicles - (L.id === 'suhl' ? 1 : L.id === 'erfurt' ? 1 : L.id === 'coburg' ? 1 : 0)); const drv = Math.min(L.drivers, inUse + (L.id === 'suhl' ? 1 : 0)); const x = SERIES[L.id][0]; return { inUse, drv, planned: Math.round(x.stops / NOW_FRAC), done: x.stops, toursActive: x.tours, perDriver: Math.round(x.stops / drv), r }; }

/* ------------------------------------------------------------------ helpers */
function animateNum(el, to, fmt, dur = 700) {
  if (!el) return;
  const from = parseFloat(el.dataset.v ?? 0) || 0; el.dataset.v = to;
  if (S.motion || matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (now) => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function delta(cur, prev, { invert = false, pct = true, abs = false } = {}) {
  if (!prev) return '';
  const d = abs ? cur - prev : (cur - prev) / prev;
  const up = d > 0.0005, down = d < -0.0005;
  const cls = up ? 'up' : down ? 'down' : 'flat';
  const tone = invert ? (up ? 'bad' : down ? 'good' : '') : '';
  const txt = abs ? (d > 0 ? '+' : '') + nf(d * 100, 1) + ' pp' : (d > 0 ? '+' : '') + pf(d, 1);
  return `<span class="delta ${cls} ${tone} num">${up ? ic('up', 13, 2.6) : down ? ic('down', 13, 2.6) : ''}${txt}</span>`;
}
function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
let uid = 0;

/* generic chart: bars (stacked) + lines, crosshair tooltip */
function chart(el, cfg) {
  const W = Math.max(280, el.clientWidth), H = cfg.h || 260;
  const m = { l: cfg.noAxis ? 0 : 46, r: cfg.noAxis ? 0 : 10, t: cfg.noAxis ? 6 : 10, b: cfg.noAxis ? 0 : 28 };
  const n = cfg.labels.length, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const bw = iw / n;
  const x = (i) => m.l + bw * i + bw / 2;
  let max = cfg.max;
  if (max == null) { let mx = 0; for (let i = 0; i < n; i++) { let st = 0; for (const s of cfg.series) { const v = s.values[i]; if (v == null || S.hidden.has(s.key)) continue; if (s.type === 'bar') st += v; else mx = Math.max(mx, v); } mx = Math.max(mx, st); } max = niceMax(mx * 1.08); }
  const min = cfg.min ?? 0;
  const y = (v) => m.t + ih - (v - min) / (max - min) * ih;
  const id = 'c' + (++uid);
  let g = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${cfg.aria || ''}" direction="ltr" style="direction:ltr"><defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--violet-hi)"/><stop offset="1" style="stop-color:var(--cobalt)"/></linearGradient>
    <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--violet-hi);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--violet-hi);stop-opacity:0"/></linearGradient>
    <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--cyan);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--cyan);stop-opacity:0"/></linearGradient></defs>`;
  if (!cfg.noAxis) {
    for (let k = 0; k <= 4; k++) { const v = min + (max - min) * k / 4, yy = y(v);
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" style="stroke:var(--chart-grid)"/><text class="ax num" x="${m.l - 8}" y="${yy + 4}" text-anchor="end">${cfg.yFmt ? cfg.yFmt(v) : nf(v)}</text>`; }
    const every = Math.ceil(n / Math.max(4, Math.floor(iw / 78)));
    for (let i = 0; i < n; i += every) g += `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${cfg.labels[i]}</text>`;
  }
  const bars = cfg.series.filter(s => s.type === 'bar' && !S.hidden.has(s.key));
  if (bars.length) {
    g += '<g class="bar-g">';
    const pad = Math.max(1, Math.min(bw * .28, 10)), w = Math.max(1.5, bw - pad);
    for (let i = 0; i < n; i++) { let acc = 0; bars.forEach((s, j) => { const v = s.values[i]; if (v == null || v === 0) return; const y0 = y(acc), y1 = y(acc + v); acc += v;
      const top = j === bars.length - 1 || bars.slice(j + 1).every(z => !z.values[i]);
      g += `<rect class="b" x="${(x(i) - w / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" rx="${top ? Math.min(4, w / 2) : 0}" style="fill:${s.fill || s.color};${s.opacity ? 'opacity:' + s.opacity + ';' : ''}animation-delay:${(i / n * .35).toFixed(3)}s"/>`; }); }
    g += '</g>';
  }
  for (const s of cfg.series.filter(s => s.type === 'line' && !S.hidden.has(s.key))) {
    const pts = []; s.values.forEach((v, i) => { if (v != null) pts.push([x(i), y(v)]); });
    if (pts.length < 2) continue;
    const d = smooth(pts);
    if (s.area) g += `<path class="reveal-area" d="${d} L${pts[pts.length - 1][0]},${m.t + ih} L${pts[0][0]},${m.t + ih} Z" fill="url(#${id}${s.area})"/>`;
    g += `<path class="${s.dash ? '' : 'reveal-line'}" d="${d}" fill="none" style="stroke:${s.color};--len:4000" stroke-width="${s.width || 2.2}" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="4 5" opacity=".75"' : ''}/>`;
    if (s.end) { const p = pts[pts.length - 1]; g += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" style="fill:var(--surface);stroke:${s.color}" stroke-width="2.5"/>`; }
  }
  g += `<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" style="stroke:var(--line-3);opacity:0" stroke-dasharray="3 3"/><g class="xdots"></g><rect class="hit" x="${m.l}" y="0" width="${iw}" height="${H}" fill="transparent"/></svg>`;
  el.innerHTML = g + '<div class="tip"></div>';
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), xh = el.querySelector('.xh'), dots = el.querySelector('.xdots');
  const move = (ev) => {
    const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * W / r.width;
    const i = Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / bw)));
    xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.style.opacity = 1;
    let rows = '', dd = '';
    for (const s of cfg.series) { if (S.hidden.has(s.key)) continue; const v = s.values[i]; if (v == null) continue;
      rows += `<div class="tip-r"><span class="sw" style="background:${s.color}"></span>${s.name}<b class="num">${s.fmt ? s.fmt(v) : nf(v)}</b></div>`;
      if (s.type === 'line') dd += `<circle cx="${x(i)}" cy="${y(v)}" r="4" style="fill:${s.color};stroke:var(--surface)" stroke-width="2"/>`; }
    dots.innerHTML = dd;
    tip.innerHTML = `<div class="tip-h">${cfg.tipLabels ? cfg.tipLabels[i] : cfg.labels[i]}</div>${rows}`;
    const tx = x(i) / W * r.width; const tw = tip.offsetWidth;
    tip.style.left = Math.min(r.width - tw, Math.max(0, tx + (tx > r.width / 2 ? -tw - 14 : 14))) + 'px'; tip.style.top = '8px'; tip.classList.add('on');
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', () => { tip.classList.remove('on'); xh.style.opacity = 0; dots.innerHTML = ''; });
}
function spark(values, w = 96, h = 28, color = 'var(--violet-hi)') {
  const mx = Math.max(...values), mn = Math.min(...values);
  const pts = values.map((v, i) => [i * w / (values.length - 1), h - 3 - (v - mn) / ((mx - mn) || 1) * (h - 6)]);
  const p = pts[pts.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="direction:ltr"><path d="${smooth(pts)}" fill="none" style="stroke:${color}" stroke-width="1.8" stroke-linecap="round"/><circle cx="${p[0]}" cy="${p[1]}" r="2.6" style="fill:${color}"/></svg>`;
}
function ring(frac, size = 112, sw = 11, label = '') {
  const r = (size - sw) / 2, c = 2 * Math.PI * r, id = 'r' + (++uid);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--cyan)"/><stop offset=".5" style="stop-color:var(--cobalt)"/><stop offset="1" style="stop-color:var(--violet-hi)"/></linearGradient></defs>
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--surface-2)" stroke-width="${sw}"/>
  <circle class="ring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-to="${c * (1 - frac)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset 1.2s var(--ease)"/></svg>`;
}
function kickoff(root = document) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.ring-arc', root).forEach(a => a.setAttribute('stroke-dashoffset', a.dataset.to));
    $$('[data-w]', root).forEach(b => b.style.width = b.dataset.w);
  }));
}
function seg(id, items, value, cls = '') {
  return `<div class="seg ${cls}" role="group" data-seg="${id}">${items.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === value}">${l}</button>`).join('')}<span class="seg-ind"></span></div>`;
}
function placeSeg(root = document) {
  $$('.seg', root).forEach(s => { const b = s.querySelector('[aria-pressed="true"]'), ind = s.querySelector('.seg-ind'); if (!b || !ind) return;
    ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft - 3}px)`; });
}
function toast(title, sub = '', kind = 'ok') {
  const box = $('#toasts'); const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  const col = kind === 'ok' ? ['var(--mint-soft)', 'var(--mint)', 'check'] : ['var(--coral-soft)', 'var(--coral)', 'alert'];
  el.innerHTML = `<span class="ti" style="background:${col[0]};color:${col[1]}">${ic(col[2], 16, 2.4)}</span><div><div>${title}</div>${sub ? `<div style="font-size:12px;color:var(--text-3);font-weight:500">${sub}</div>` : ''}</div>`;
  box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
}

/* ------------------------------------------------------------------ shell */
const NAV = [['gMain', ['overview', 'analytics']], ['gMgmt', ['organizations', 'locations', 'users', 'fleet']], ['gPlat', ['system', 'audit', 'prefs']]];
function renderShell() {
  document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  const app = $('#app'); app.classList.toggle('collapsed', S.collapsed);
  $('#side').innerHTML = `
    <div class="brand" role="img" aria-label="TURVIO"><span class="logo-mark brand-collapsed"></span>
      <div class="fade brand-full"><span class="logo-lockup"></span><div class="brand-sub">${t('appSub')}</div></div></div>
    <nav class="nav" aria-label="${t('appSub')}"><span class="nav-ind"></span>
      ${NAV.map(([g, items]) => `<div class="nav-label">${t(g)}</div>` + items.map(k => `<a href="#${k}" data-sec="${k}" data-tip="${t(k)}" ${S.section === k ? 'aria-current="page"' : ''}>${ic(k, 20, 1.8)}<span class="fade">${t(k)}</span>${k === 'organizations' ? '<span class="count fade">2</span>' : k === 'system' ? '<span class="count alert">1</span>' : ''}</a>`).join('')).join('')}
    </nav>
    <div class="side-foot">
      <button class="collapse-btn" id="collapse" type="button" aria-expanded="${!S.collapsed}">${ic('chevL', 18, 2)}<span class="fade">${t('collapse')}</span></button>
      <div class="dd" id="dd-me"><button class="me" type="button" aria-haspopup="true"><span class="avatar">LA${S.envHint ? '<span class="env-dot" title="Staging"></span>' : ''}</span><span class="fade" style="min-width:0"><span class="me-name" style="display:block">Lunapact Admin</span><span class="me-role">${t('role')}</span></span></button>
        <div class="menu start" style="bottom:calc(100% + 8px);top:auto;transform-origin:bottom left">
          <div class="mi" style="cursor:default">${ic('shield', 16)}<span>${t('twofa')}</span><span class="check" style="opacity:1;transform:none">${ic('check', 16, 2.4)}</span></div>
          <div class="mi" style="cursor:default"><span class="dot" style="background:var(--amber)"></span><span>${t('env')}<span class="sub">${t('staging')}</span></span></div>
          <div class="menu-sep"></div>
          <button class="mi" type="button" data-go="prefs">${ic('prefs', 16)}${t('prefs')}</button>
          <button class="mi" type="button" id="signout">${ic('logout', 16)}${t('signOut')}</button>
        </div></div>
    </div>`;
  $('#topbar').innerHTML = `
    <button class="icon-btn menu-btn" id="mnav" type="button" aria-label="Menu">${ic('menu', 20)}</button>
    <button class="search" id="open-cmd" type="button">${ic('search', 17)}<span class="stxt">${t('search')}</span><span class="kbd">⌘K</span></button>
    <div class="top-right">
      <div class="dd" id="dd-lang"><button class="dd-btn" type="button" aria-haspopup="true" aria-label="${t('language')}">${ic('globe', 17)}<span>${S.lang.toUpperCase()}</span><span class="chev">${ic('chev', 15, 2.2)}</span></button>
        <div class="menu" role="menu"><div class="menu-h">${t('language')}</div>
          ${[['de', 'Deutsch', 'DE'], ['en', 'English', 'EN'], ['ar', 'العربية', 'ع']].map(([c, n, f]) => `<button class="mi" type="button" role="menuitemradio" aria-checked="${S.lang === c}" data-lang="${c}"><span class="flag">${f}</span>${n}<span class="check">${ic('check', 16, 2.4)}</span></button>`).join('')}
        </div></div>
      <button class="theme-switch" id="theme" type="button" role="switch" aria-checked="${document.documentElement.dataset.theme === 'light'}" aria-label="${t('theme')}"><span class="knob"><span class="ic-moon">${ic('moon', 14, 2.2)}</span><span class="ic-sun">${ic('sun', 14, 2.2)}</span></span></button>
      <div class="dd" id="dd-notif"><button class="icon-btn" type="button" aria-haspopup="true" aria-label="${t('notifTitle')}">${ic('bell', 19)}<span class="badge-dot"></span></button>
        <div class="menu" style="width:340px"><div style="display:flex;align-items:center;padding:8px 10px"><b>${t('notifTitle')}</b><button class="btn" style="height:28px;padding:0 10px;margin-inline-start:auto;font-size:12px" type="button" id="markread">${t('markRead')}</button></div>
          ${WARN().slice(0, 3).map(w => `<button class="mi" type="button" data-go="${w.go}"><span class="dot" style="background:${w.c}"></span><span>${w.t}<span class="sub">${w.s}</span></span></button>`).join('')}
        </div></div>
    </div>`;
  requestAnimationFrame(placeNav);
}
function placeNav() { const a = $('.nav a[aria-current="page"]'), ind = $('.nav-ind'); if (!a || !ind) return; ind.style.transform = `translateY(${a.offsetTop}px)`; ind.style.opacity = 1; }

/* ------------------------------------------------------------------ shared filter bar */
function filterBar(opts = {}) {
  const orgName = S.org === 'all' ? t('allOrgs') : ORGS.find(o => o.id === S.org).name;
  const locName = S.loc === 'all' ? t('allLocs') : LOCS.find(l => l.id === S.loc).name;
  const locs = LOCS.filter(l => S.org === 'all' || l.org === S.org);
  return `<div class="filters">
    ${seg('range', [['today', t('today')], ['7', t('d7')], ['30', t('d30')], ['90', t('d90')]], S.range)}
    <div class="dd" id="dd-org"><button class="dd-btn" type="button" aria-haspopup="true">${ic('organizations', 16)}<span>${orgName}</span><span class="chev">${ic('chev', 15, 2.2)}</span></button>
      <div class="menu"><div class="menu-h">${t('orgL')}</div>
        <button class="mi" type="button" data-org="all" aria-checked="${S.org === 'all'}">${t('allOrgs')}<span class="check">${ic('check', 16, 2.4)}</span></button>
        ${ORGS.map(o => `<button class="mi" type="button" data-org="${o.id}" aria-checked="${S.org === o.id}"><span>${o.name}<span class="sub">${t(o.kind === 'pilot' ? 'pilot' : 'testTenant')}</span></span><span class="check">${ic('check', 16, 2.4)}</span></button>`).join('')}
      </div></div>
    <div class="dd" id="dd-loc"><button class="dd-btn" type="button" aria-haspopup="true">${ic('locations', 16)}<span>${locName}</span><span class="chev">${ic('chev', 15, 2.2)}</span></button>
      <div class="menu"><div class="menu-h">${t('locL')}</div>
        <button class="mi" type="button" data-loc="all" aria-checked="${S.loc === 'all'}">${t('allLocs')}<span class="check">${ic('check', 16, 2.4)}</span></button>
        ${locs.map(l => `<button class="mi" type="button" data-loc="${l.id}" aria-checked="${S.loc === l.id}"><span>${l.name}<span class="sub">${ORGS.find(o => o.id === l.org).name}</span></span><span class="check">${ic('check', 16, 2.4)}</span></button>`).join('')}
      </div></div>
    ${opts.export === false ? '' : `<button class="btn btn-primary" id="export" type="button"><span class="bi">${ic('download', 16, 2.2)}</span><span class="lbl">${t('export')}</span><span class="spin"></span><span class="ok">${ic('check', 18, 2.6)}</span></button>`}
  </div>`;
}
function head(title, sub, right = '') {
  return `<div class="page-head"><div><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h1 class="page-title">${title}</h1><span class="pill pill-demo" data-tip="${t('demoTip')}" tabindex="0">${ic('info', 13, 2.2)}${t('demo')}</span></div><div class="page-sub">${sub}</div></div>${right}</div>`;
}

/* ------------------------------------------------------------------ overview components */
function heroCard(A) {
  const T = A.totals, PT = A.ptotals;
  const rate = T.delivered / Math.max(1, T.delivered + T.failed), prate = PT.delivered / Math.max(1, PT.delivered + PT.failed);
  const ot = T.ontime / Math.max(1, T.delivered);
  return `<section class="hero" aria-label="${t('delivered')}">
    <div class="hero-top">
      <div><div class="eyebrow">${t('delivered')}</div>
        <div class="hero-num num" id="h-del" data-v="0">0</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:10px">${delta(T.delivered, PT.delivered)}<span class="hero-label" style="margin:0">${S.range === 'today' ? t('vsLastWeek') : t('vsPrev')}</span></div></div>
      <div class="hero-stats">
        <div><div class="hs-v num" id="h-rate">${pf(rate)}</div><div class="hs-l">${t('successRate')}</div><div style="margin-top:4px">${delta(rate, prate, { abs: true })}</div></div>
        <div><div class="hs-v num" id="h-tours">${nf(T.tours)}</div><div class="hs-l">${t('tours')}</div><div style="margin-top:4px">${delta(T.tours, PT.tours)}</div></div>
        <div><div class="hs-v num">${pf(ot)}</div><div class="hs-l" style="display:flex;gap:4px;align-items:center">${t('onTime')}<button class="info" type="button" data-tip="${t('srcOntime')}" aria-label="${t('srcOntime')}">${ic('info', 13, 2.2)}</button></div><div style="margin-top:4px">${delta(ot, PT.ontime / Math.max(1, PT.delivered), { abs: true })}</div></div>
      </div>
    </div>
    <div class="hero-chart chart" id="hero-chart"></div>
  </section>`;
}
function liveCard() {
  const locs = activeLocs(); let planned = 0, done = 0, tours = 0, drv = 0;
  const rows = locs.map(L => { const f = todayFleet(L); planned += f.planned; done += f.done; tours += f.toursActive; drv += f.drv; return [L, f]; });
  return `<section class="card live">
    <div class="card-h"><div><div class="card-t" style="display:flex;align-items:center;gap:8px"><span class="live-dot"></span>${t('liveTitle')}</div><div class="card-d">${t('liveSub')}</div></div></div>
    <div class="ring-wrap">${ring(done / planned, 116, 12, `${done} / ${planned}`)}
      <div><div style="font-size:30px;font-weight:800;letter-spacing:-.03em" class="num">${pf(done / planned, 0)}</div><div style="font-size:12.5px;color:var(--text-3);font-weight:600"><span class="num">${nf(done)}</span> ${t('of')} <span class="num">${nf(planned)}</span> ${t('stopsDone')}</div>
        <div style="display:flex;gap:16px;margin-top:10px"><div><b class="num" style="font-size:17px">${nf(tours)}</b><div style="font-size:11.5px;color:var(--text-3);font-weight:600">${t('toursOnRoad')}</div></div><div><b class="num" style="font-size:17px">${nf(drv)}</b><div style="font-size:11.5px;color:var(--text-3);font-weight:600">${t('driversOnRoad')}</div></div></div></div></div>
    <div style="margin-top:14px">${rows.map(([L, f]) => `<div class="loc-row"><span style="font-weight:600;font-size:13px">${L.name}</span><span class="num" style="font-size:12.5px;color:var(--text-2);font-weight:600">${nf(f.done)} / ${nf(f.planned)}</span><div class="bar"><i data-w="${(f.done / f.planned * 100).toFixed(1)}%"></i></div></div>`).join('')}</div>
  </section>`;
}
function kpiCards(A) {
  const locs = activeLocs(); const T = A.totals, PT = A.ptotals;
  let drv = 0, drvT = 0, veh = 0, vehT = 0; locs.forEach(L => { const f = todayFleet(L); drv += f.drv; drvT += L.drivers; veh += f.inUse; vehT += L.vehicles; });
  const hrs = T.kmSave / 38;
  const failShare = T.failed / Math.max(1, T.stops);
  const card = (acc, accS, icn, label, val, extra, src, id) => `<section class="card hov kpi s3" style="--acc:${acc};--acc-soft:${accS}">
    <div style="display:flex;align-items:center;gap:10px"><span class="kpi-ic">${ic(icn, 19, 2)}</span><span class="kpi-l">${label}</span><button class="info" style="margin-inline-start:auto" type="button" data-tip="${src}" aria-label="${src}">${ic('info', 14, 2.1)}</button></div>
    <div class="kpi-v num" ${id ? `id="${id}"` : ''}>${val}</div>${extra}</section>`;
  return card('var(--cobalt)', 'var(--cobalt-soft)', 'steer', t('activeDrivers'), `${nf(drv)} <small>/ ${nf(drvT)}</small>`,
      `<div class="prog"><i data-w="${(drv / drvT * 100).toFixed(1)}%"></i></div><div class="kpi-foot">${pf(drv / drvT, 0)} ${t('today_')}</div>`, t('srcDrivers'))
    + card('var(--cyan)', 'var(--cyan-soft)', 'fleet', t('vehiclesInUse'), `${nf(veh)} <small>/ ${nf(vehT)}</small>`,
      `<div class="prog"><i data-w="${(veh / vehT * 100).toFixed(1)}%"></i></div><div class="kpi-foot">${pf(veh / vehT, 0)} ${t('today_')}</div>`, t('srcDrivers'))
    + card('var(--mint)', 'var(--mint-soft)', 'route', t('optSaved'), `<span id="k-km">${nf(T.kmSave)}</span> <small>${t('kmUnit')}</small>`,
      `<div class="kpi-foot">${delta(T.kmSave, PT.kmSave)}<span class="num">≈ ${nf(hrs)} ${t('hoursShort')}</span></div>`, t('srcOpt'))
    + card('var(--coral)', 'var(--coral-soft)', 'alert', t('exceptions'), `<span id="k-exc">${nf(T.failed)}</span>`,
      `<div class="kpi-foot">${delta(T.failed, PT.failed, { invert: true })}<span class="num">${pf(failShare)} ${t('shareFailed')}</span></div>`, t('srcExc'));
}
function perfCard(span = 's8') {
  const tabs = [['deliveries', t('mDeliveries')], ['rate', t('mRate')], ['ontime', t('mOntime')], ['tours', t('mTours')]];
  return `<section class="card ${span}" id="perf">
    <div class="card-h" style="flex-wrap:wrap"><div><div class="card-t">${t('perfTitle')}</div><div class="card-d">${t('perfSub')}</div></div>
      <div class="act">${seg('metric', tabs, S.metric, 'sm')}</div></div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;flex-wrap:wrap"><div class="legend" id="legend"></div>
      <label class="tgl" style="margin-inline-start:auto"><input type="checkbox" id="cmp" ${S.compare ? 'checked' : ''}><span class="tr"></span>${t('lgPrev')}</label></div>
    <div class="chart" id="perf-chart"></div></section>`;
}
function drawPerf(A) {
  const el = $('#perf-chart'); if (!el) return;
  const b = A.buckets, p = A.prev, labels = b.map(x => x.label);
  const tipLabels = A.hourly ? labels : b.map(x => df(x.date, { weekday: 'short', day: 'numeric', month: 'short' }));
  let series = [];
  const pv = (fn) => p.map(fn);
  if (S.metric === 'deliveries') {
    series = [{ key: 'del', name: t('lgDelivered'), type: 'bar', color: 'var(--violet-hi)', fill: `url(#c${uid + 1}b)`, values: b.map(x => x.delivered) },
              { key: 'fail', name: t('lgFailed'), type: 'bar', color: 'var(--coral)', values: b.map(x => x.failed) }];
    if (A.hourly) series.push({ key: 'fc', name: t('lgForecast'), type: 'bar', color: 'var(--line-3)', values: b.map(x => x.forecast) });
    if (S.compare) series.push({ key: 'prev', name: t('lgPrev'), type: 'line', dash: true, color: 'var(--text-3)', values: pv(x => x.delivered) });
  } else if (S.metric === 'rate' || S.metric === 'ontime') {
    const f = S.metric === 'rate' ? (x => x.stops ? x.delivered / (x.delivered + x.failed) : null) : (x => x.delivered ? x.ontime / x.delivered : null);
    const cur = b.map(x => x.delivered == null ? null : f(x));
    series = [{ key: 'm', name: S.metric === 'rate' ? t('lgRate') : t('lgOntime'), type: 'line', area: S.metric === 'rate' ? 'a' : 'c', end: true, color: S.metric === 'rate' ? 'var(--violet-hi)' : 'var(--cyan)', values: cur, fmt: v => pf(v) }];
    if (S.compare) series.push({ key: 'prev', name: t('lgPrev'), type: 'line', dash: true, color: 'var(--text-3)', values: pv(f), fmt: v => pf(v) });
    const vals = [...cur, ...(S.compare ? pv(f) : [])].filter(v => v != null);
    chart(el, { labels, tipLabels, series, h: 270, min: Math.floor(Math.min(...vals) * 100 - 1) / 100, max: Math.min(1, Math.ceil(Math.max(...vals) * 100 + 1) / 100), yFmt: v => pf(v, 0), aria: t('perfTitle') });
    legend(series); return;
  } else {
    series = [{ key: 't', name: t('lgTours'), type: 'bar', color: 'var(--cobalt)', values: b.map(x => x.delivered == null ? null : x.tours) }];
    if (S.compare) series.push({ key: 'prev', name: t('lgPrev'), type: 'line', dash: true, color: 'var(--text-3)', values: pv(x => x.tours) });
  }
  chart(el, { labels, tipLabels, series, h: 270, aria: t('perfTitle') });
  legend(series);
}
function legend(series) {
  const el = $('#legend'); if (!el) return;
  el.innerHTML = series.filter(s => s.key !== 'prev').map(s => `<button class="lg-btn" type="button" data-key="${s.key}" aria-pressed="${!S.hidden.has(s.key)}"><span class="sw" style="background:${s.color}"></span>${s.name}</button>`).join('');
}
function excCard(A, span = 's4') {
  const tot = Object.values(A.totals.exc).reduce((a, b) => a + b, 0) || 1;
  const rows = REASONS.map(([k, , c]) => [k, A.totals.exc[k], c]).sort((a, b) => b[1] - a[1]);
  return `<section class="card ${span}"><div class="card-h"><div><div class="card-t">${t('excTitle')}</div><div class="card-d">${t('excSub')}</div></div><div class="act"><button class="info" type="button" data-tip="${t('srcExc')}" aria-label="${t('srcExc')}">${ic('info', 14, 2.1)}</button></div></div>
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px"><span class="num" style="font-size:30px;font-weight:800;letter-spacing:-.03em">${nf(A.totals.failed)}</span><span style="color:var(--text-3);font-weight:600;font-size:13px">${t('exceptions')}</span></div>
    <div class="rlist">${rows.map(([k, v, c], i) => `<button type="button" class="reason ${S.excSel && S.excSel !== k ? 'dim' : ''}" data-reason="${k}" aria-pressed="${S.excSel === k}">
      <span style="font-weight:600;font-size:13px">${t(k)}</span><span class="num" style="font-weight:700;font-size:13px">${nf(v)} <span style="color:var(--text-3);font-weight:600">· ${pf(v / tot, 0)}</span></span>
      <span class="rb"><i class="hbar" style="width:${(v / rows[0][1] * 100).toFixed(1)}%;background:${c};animation-delay:${i * .08}s"></i></span></button>`).join('')}</div></section>`;
}

/* map */
function mapCard(A, span = 's5') {
  const big = S.mapBig; span = big ? 's12' : span;
  const L = RM.layers;
  return `<section class="card ${span}" id="mapcard"><div class="card-h" style="flex-wrap:wrap"><div><div class="card-t">${t('mapTitle')}</div><div class="card-d">${t('mapSub')}</div></div>
    <div class="act">${S.loc !== 'all' ? `<button class="btn" type="button" id="map-reset" style="height:32px;padding:0 12px;font-size:12.5px">${ic('x', 14, 2.4)}${t('resetFilter')}</button>` : ''}
      <div class="dd" id="dd-layers"><button class="dd-btn" type="button" aria-haspopup="true" style="height:32px;font-size:12.5px">${ic('layers', 15)}${t('mapLayers')}<span class="chev">${ic('chev', 14, 2.2)}</span></button>
        <div class="menu" style="min-width:230px"><div class="menu-h">${t('mapLayers')}</div>
          ${[['heat', t('lyHeat')], ['areas', t('lyAreas')], ['rail', t('lyRail')]].map(([k, l]) => `<label class="mi" style="cursor:pointer"><span style="flex:1">${l}</span><span class="tgl"><input type="checkbox" data-ly="${k}" ${L[k] ? 'checked' : ''}><span class="tr"></span></span></label>`).join('')}</div></div>
      <button class="icon-btn" type="button" id="map-big" style="width:32px;height:32px;border-radius:10px" aria-label="${t(big ? 'mapSmall' : 'mapBig')}" data-tip="${t(big ? 'mapSmall' : 'mapBig')}">${ic(big ? 'shrink' : 'expand', 15, 2)}</button></div></div>
    <div class="rmap ${big ? 'big' : ''}" id="rmap"></div></section>`;
}
function mapOpts(refit) {
  const locs = LOCS.filter(l => S.org === 'all' || l.org === S.org);
  const n = S.range === 'today' ? 1 : +S.range; const vol = {}; locs.forEach(L => { vol[L.id] = SERIES[L.id].slice(0, n).reduce((a, x) => a + x.stops, 0); });
  return { locs, vol, sel: S.loc, refit, ic, nf: v => nf(v), pf: v => pf(v), reduce: () => S.motion || matchMedia('(prefers-reduced-motion: reduce)').matches,
    t: { title: t('mapTitle'), zin: '+', zout: '−', fit: t('resetFilter'), density: t('mapDensity'), attr: t('mapAttr'), stops: t('stops'), rate: t('colRate'), ontime: t('colOntime'), drivers: t('colDrivers'), click: t('mapClick') },
    detail: L => { const a = SERIES[L.id].slice(0, n); const del = a.reduce((s, x) => s + x.delivered, 0), fail = a.reduce((s, x) => s + x.failed, 0), on = a.reduce((s, x) => s + x.ontime, 0);
      const tr = SERIES[L.id].slice(1, 15).reverse().filter(x => x.stops).map(x => x.delivered / (x.delivered + x.failed));
      return { org: ORGS.find(o => o.id === L.org).name, rate: del / Math.max(1, del + fail), ontime: on / Math.max(1, del), drv: todayFleet(L).drv, spark: spark(tr, 170, 30, 'var(--violet-hi)') }; },
    onSelect: id => { S.loc = S.loc === id ? 'all' : id; render({ refitMap: true }); } };
}
function locTable(A, span = 's7') {
  const locs = LOCS.filter(l => S.org === 'all' || l.org === S.org);
  const n = S.range === 'today' ? 1 : +S.range;
  const rows = locs.map(L => { const a = SERIES[L.id].slice(0, n); const s = k => a.reduce((x, y) => x + y[k], 0);
    const st = s('stops'), del = s('delivered'), fail = s('failed'), on = s('ontime'); const rate = del / Math.max(1, del + fail);
    const trend = SERIES[L.id].slice(1, 15).reverse().filter(x => x.stops).map(x => x.delivered / (x.delivered + x.failed));
    const exc = excSum(a); const top = Object.entries(exc).sort((p, q) => q[1] - p[1])[0][0]; const f = todayFleet(L);
    return { L, st, rate, on: on / Math.max(1, del), trend, top, f, tours: s('tours') }; }).sort((a, b) => b.st - a.st);
  const tone = r => r >= .97 ? 't-ok' : r >= .955 ? 't-info' : 't-warn';
  return `<section class="card ${span}"><div class="card-h"><div><div class="card-t">${t('locTitle')}</div><div class="card-d">${ORGS.filter(o => S.org === 'all' || o.id === S.org).map(o => o.name).join(' · ')}</div></div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('colLoc')}</th><th style="text-align:end">${t('colStops')}</th><th>${t('colRate')}</th><th class="hide-sm" style="text-align:end">${t('colOntime')}</th><th class="hide-sm">${t('colTrend')}</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr class="row ${S.loc === r.L.id ? 'open' : ''}" data-xp="${r.L.id}" tabindex="0" aria-expanded="${S.loc === r.L.id}">
      <td><div style="display:flex;align-items:center;gap:10px"><span style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--violet-soft);color:var(--violet-text);font-weight:800;font-size:12px">${r.L.name.slice(0, 2).toUpperCase()}</span><div><div style="font-weight:700">${r.L.name}</div><div style="font-size:12px;color:var(--text-3)">${ORGS.find(o => o.id === r.L.org).name}</div></div></div></td>
      <td class="num" style="text-align:end;font-weight:700">${nf(r.st)}</td>
      <td><span class="tag ${tone(r.rate)} num">${pf(r.rate)}</span></td>
      <td class="num hide-sm" style="text-align:end;color:var(--text-2);font-weight:600">${pf(r.on)}</td>
      <td class="hide-sm">${spark(r.trend, 96, 28, r.rate < .955 ? 'var(--amber)' : 'var(--violet-hi)')}</td>
      <td style="text-align:end"><span class="chev" style="display:inline-block">${ic('chevR', 16, 2.2)}</span></td></tr>
      <tr class="xp ${S.loc === r.L.id ? 'open' : ''}" data-for="${r.L.id}"><td colspan="6"><div class="xp-in"><div><div class="xp-body">
        <div class="mini"><b class="num">${nf(r.f.toursActive)}</b><span>${t('toursToday')}</span></div>
        <div class="mini"><b class="num">${nf(Math.round(r.st / Math.max(1, r.tours)))}</b><span>${t('avgStops')}</span></div>
        <div class="mini"><b class="num">${nf(r.f.drv)} / ${nf(r.L.drivers)}</b><span>${t('colDrivers')}</span></div>
        <div class="mini"><b style="font-size:13.5px;line-height:1.35;padding-top:2px">${t(r.top)}</b><span>${t('topExc')}</span></div>
      </div></div></div></td></tr>`).join('')}
    </tbody></table></div></section>`;
}
function optCard(A, span = 's4') {
  return `<section class="card ${span}"><div class="card-h"><div><div class="card-t">${t('optTitle')}</div><div class="card-d">${t('optSub')}</div></div><div class="act"><button class="info" type="button" data-tip="${t('srcOpt')}" aria-label="${t('srcOpt')}">${ic('info', 14, 2.1)}</button></div></div>
    <div style="display:flex;align-items:baseline;gap:10px"><span class="num" style="font-size:30px;font-weight:800;letter-spacing:-.03em;color:var(--mint)" id="opt-pct"></span><span style="color:var(--text-3);font-weight:600;font-size:13px">${t('avgSave')}</span></div>
    <div class="legend" style="margin:8px 0 2px"><span class="lg-btn" style="cursor:default"><span class="sw" style="background:var(--line-3)"></span>${t('planned')}</span><span class="lg-btn" style="cursor:default"><span class="sw" style="background:var(--mint)"></span>${t('optimized')}</span></div>
    <div class="chart" id="opt-chart"></div></section>`;
}
function drawOpt() {
  const el = $('#opt-chart'); if (!el) return;
  const locs = activeLocs(); const weeks = 8, labels = [], plan = [], opt = [];
  for (let w = weeks - 1; w >= 0; w--) { let p = 0, o = 0; for (let d = 0; d < 7; d++) { const i = w * 7 + d + 1; for (const L of locs) { p += SERIES[L.id][i].kmPlan; o += SERIES[L.id][i].kmOpt; } }
    const dt = new Date(TODAY); dt.setDate(dt.getDate() - w * 7 - 7); labels.push(S.lang === 'de' ? 'KW ' + isoWeek(dt) : S.lang === 'ar' ? 'أ' + isoWeek(dt) : 'W' + isoWeek(dt)); plan.push(Math.round(p)); opt.push(Math.round(o)); }
  const sp = plan.reduce((a, b) => a + b, 0), so = opt.reduce((a, b) => a + b, 0);
  $('#opt-pct').textContent = '−' + pf((sp - so) / sp, 1);
  // grouped bars: draw as two series side-by-side using two charts overlay -> simpler: custom
  const W = Math.max(260, el.clientWidth), H = 190, m = { l: 44, r: 6, t: 8, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = niceMax(Math.max(...plan) * 1.05), bw = iw / weeks, y = v => m.t + ih - v / max * ih;
  let g = `<svg viewBox="0 0 ${W} ${H}" height="${H}" style="direction:ltr" role="img" aria-label="${t('optTitle')}">`;
  for (let k = 0; k <= 5; k += (max >= 10000 ? 1 : 1)) { const v = max * k / 5; g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--chart-grid)"/><text class="ax num" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${nf(v / 1000, max / 5 % 1000 ? 1 : 0)}k</text>`; }
  g += '<g class="bar-g">';
  const w = Math.min(14, bw * .32);
  for (let i = 0; i < weeks; i++) { const cx = m.l + bw * i + bw / 2;
    g += `<rect class="b" x="${cx - w - 1.5}" y="${y(plan[i])}" width="${w}" height="${ih + m.t - y(plan[i])}" rx="3" style="fill:var(--line-3);animation-delay:${i * .04}s"><title>${labels[i]} · ${t('planned')}: ${nf(plan[i])} km</title></rect>`;
    g += `<rect class="b" x="${cx + 1.5}" y="${y(opt[i])}" width="${w}" height="${ih + m.t - y(opt[i])}" rx="3" style="fill:var(--mint);animation-delay:${i * .04 + .05}s"><title>${labels[i]} · ${t('optimized')}: ${nf(opt[i])} km</title></rect>`;
    if (i % 2 === 1 || weeks <= 6) g += `<text class="ax" x="${cx}" y="${H - 7}" text-anchor="middle">${labels[i]}</text>`; }
  el.innerHTML = g + '</g></svg>';
}
function isoWeek(d) { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - y0) / 864e5 + 1) / 7); }
function fleetCard(span = 's4') {
  const locs = activeLocs();
  return `<section class="card ${span}"><div class="card-h"><div><div class="card-t">${t('fleetTitle')}</div><div class="card-d">${t('fleetSub')}</div></div></div>
    <div style="display:flex;flex-direction:column;gap:14px">${locs.map(L => { const f = todayFleet(L);
      return `<div><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:7px"><b style="font-size:13px">${L.name}</b><span class="num" style="font-size:12px;color:var(--text-3);font-weight:600">${nf(f.inUse)}/${nf(L.vehicles)}</span><span class="num" style="margin-inline-start:auto;font-size:12px;color:var(--text-2);font-weight:600">${nf(f.perDriver)} ${t('perDriver')}</span></div>
        <div style="display:flex;gap:4px">${Array.from({ length: L.vehicles }, (_, i) => `<span style="flex:1;height:14px;border-radius:5px;background:${i < f.inUse ? 'linear-gradient(180deg,var(--cyan),var(--cobalt))' : 'var(--surface-2)'};${i < f.inUse ? '' : 'box-shadow:inset 0 0 0 1px var(--line-2)'}"></span>`).join('')}</div></div>`; }).join('')}</div></section>`;
}
const SERVICES = [['svApi', 'ok', 99.98, 84], ['svDb', 'ok', 99.99, 12], ['svOpt', 'ok', 99.9, 2600], ['svOsrm', 'ok', 99.95, 140], ['svGeo', 'ok', 99.7, 310], ['svMail', 'ok', 99.9, 0], ['svTiles', 'planned', null, null]];
function healthCard(span = 's4') {
  return `<section class="card ${span}"><div class="card-h"><div><div class="card-t">${t('healthTitle')}</div><div class="card-d">${t('healthSub')}</div></div><div class="act"><button class="info" type="button" data-tip="${t('srcHealth')}" aria-label="${t('srcHealth')}">${ic('info', 14, 2.1)}</button></div></div>
    <div>${SERVICES.map(([k, st, up, lat], i) => { const r = rng(i * 13 + 3); const vals = Array.from({ length: 24 }, () => (lat || 50) * (.8 + r() * .5));
      return `<div class="health"><div style="display:flex;align-items:center;gap:10px;min-width:0"><span class="dot" style="background:${st === 'ok' ? 'var(--mint)' : 'var(--text-3)'};box-shadow:0 0 0 4px ${st === 'ok' ? 'var(--mint-soft)' : 'var(--surface-2)'}"></span><span style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t(k)}</span></div>
        <span class="hide-sm">${st === 'ok' ? spark(vals, 64, 20, 'var(--cyan)') : ''}</span>
        <span class="num" style="font-size:12.5px;font-weight:700;color:${st === 'ok' ? 'var(--text)' : 'var(--text-3)'};min-width:58px;text-align:end">${st === 'ok' ? nf(up, 2) + ' %' : t('plannedSv')}</span></div>`; }).join('')}</div></section>`;
}
const ACT = () => {
  const L = S.lang, z = (de, en, ar) => ({ de, en, ar }[L]);
  return [
    { k: 'ops', c: 'var(--mint)', cs: 'var(--mint-soft)', i: 'check', time: '15:12', t: z('Tour SHL-07 abgeschlossen', 'Tour SHL-07 completed', 'اكتملت الجولة SHL-07'), s: z('Suhl · 94 von 96 Stopps zugestellt', 'Suhl · 94 of 96 stops delivered', 'زول · تم تسليم 94 من 96 نقطة'), more: [[z('Dauer', 'Duration', 'المدة'), '7:48 h'], [z('Strecke', 'Distance', 'المسافة'), '71,4 km'], [z('Ausnahmen', 'Exceptions', 'الاستثناءات'), '2']] },
    { k: 'users', c: 'var(--violet-text)', cs: 'var(--violet-soft)', i: 'key', time: '14:51', t: z('Rolle geändert: Disposition → Admin', 'Role changed: Dispatch → Admin', 'تغيير الدور: التوزيع ← مسؤول'), s: z('S. Krämer · JARBOU Logistik', 'S. Krämer · JARBOU Logistik', 'س. كريمر · JARBOU Logistik'), more: [[z('Durch', 'By', 'بواسطة'), 'Lunapact Admin'], [z('Zugriff', 'Access', 'الوصول'), z('Alle Standorte', 'All locations', 'كل المواقع')]] },
    { k: 'sec', c: 'var(--coral)', cs: 'var(--coral-soft)', i: 'lock', time: '14:22', t: z('5 fehlgeschlagene Anmeldungen', '5 failed sign-ins', '5 محاولات دخول فاشلة'), s: z('Konto vorübergehend gesperrt · fahrer.erfurt', 'Account temporarily locked · fahrer.erfurt', 'تم قفل الحساب مؤقتًا · fahrer.erfurt'), more: [[z('Sperre', 'Lock', 'القفل'), '15 min'], [z('Ursprung', 'Origin', 'المصدر'), 'DE · Mobil']] },
    { k: 'ops', c: 'var(--cobalt-text)', cs: 'var(--cobalt-soft)', i: 'upload', time: '13:40', t: z('Import: 412 Stopps für morgen', 'Import: 412 stops for tomorrow', 'استيراد: 412 نقطة توقف للغد'), s: z('Erfurt · 3 Adressen zur Prüfung', 'Erfurt · 3 addresses to review', 'إرفورت · 3 عناوين للمراجعة'), more: [[z('Datei', 'File', 'الملف'), 'erfurt_1112.xlsx'], [z('Touren', 'Tours', 'الجولات'), '5']] },
    { k: 'users', c: 'var(--violet-text)', cs: 'var(--violet-soft)', i: 'userPlus', time: '11:05', t: z('Einladung angenommen', 'Invitation accepted', 'تم قبول الدعوة'), s: z('Neue Fahrerin · Schweinfurt', 'New driver · Schweinfurt', 'سائقة جديدة · شفاينفورت'), more: [[z('Rolle', 'Role', 'الدور'), z('Fahrer', 'Driver', 'سائق')], ['2FA', z('aktiv', 'on', 'مفعّل')]] },
    { k: 'sec', c: 'var(--amber)', cs: 'var(--amber-soft)', i: 'shield', time: '09:18', t: z('Anmeldung von neuem Gerät', 'Sign-in from a new device', 'تسجيل دخول من جهاز جديد'), s: z('Admin-Konto · Zwei-Faktor bestätigt', 'Admin account · two-factor confirmed', 'حساب مسؤول · تم التحقق بخطوتين'), more: [[z('Gerät', 'Device', 'الجهاز'), 'macOS · Safari'], [z('Ort', 'Location', 'الموقع'), 'Suhl, DE']] }
  ];
};
function actCard(span = 's7') {
  const items = ACT().filter(a => S.actTab === 'all' || a.k === S.actTab);
  return `<section class="card ${span}" id="act"><div class="card-h" style="flex-wrap:wrap"><div><div class="card-t">${t('actTitle')}</div><div class="card-d">${t('actSub')}</div></div>
    <div class="act">${seg('act', [['all', t('aAll')], ['ops', t('aOps')], ['users', t('aUsers')], ['sec', t('aSec')]], S.actTab, 'sm')}</div></div>
    <div class="feed">${items.map(a => `<div class="fi" tabindex="0" role="button" aria-expanded="false"><span class="fi-ic" style="background:${a.cs};color:${a.c}">${ic(a.i, 17, 2.1)}</span><div style="min-width:0"><div class="fi-t">${a.t}</div><div class="fi-s">${a.s}</div></div><span class="fi-time num">${a.time}</span>
      <div class="fi-more"><div><div class="inner">${a.more.map(([k, v]) => `<span><span style="color:var(--text-3)">${k}:</span> <b>${v}</b></span>`).join('')}</div></div></div></div>`).join('')}</div></section>`;
}
const WARN = () => { const L = S.lang, z = (de, en, ar) => ({ de, en, ar }[L]); return [
  { c: 'var(--amber)', go: 'locations', t: z('Coburg: Erfolgsquote unter 95 %', 'Coburg: success rate below 95%', 'كوبورغ: نسبة النجاح أقل من 95%'), s: z('Seit 3 Tagen · häufigster Grund: nicht angetroffen', 'For 3 days · top reason: not at home', 'منذ 3 أيام · السبب الأكثر: المستلم غير موجود') },
  { c: 'var(--coral)', go: 'fleet', t: z('2 Fahrzeuge ohne GPS-Signal', '2 vehicles without GPS signal', 'مركبتان بدون إشارة GPS'), s: z('Erfurt · seit mehr als 30 Min.', 'Erfurt · for over 30 min', 'إرفورت · منذ أكثر من 30 دقيقة') },
  { c: 'var(--violet-hi)', go: 'system', t: z('12 Standort-Hinweise offen', '12 open location notes', '12 ملاحظة موقع مفتوحة'), s: z('Zufahrt prüfen, bevor Touren optimiert werden', 'Check access before optimizing tours', 'تحقق من الوصول قبل تحسين الجولات') },
  { c: 'var(--cobalt)', go: 'system', t: z('1 Optimierung mit Fallback beendet', '1 optimization finished with fallback', 'انتهت عملية تحسين واحدة بحل احتياطي'), s: z('Zeitbudget erreicht · Ergebnis geprüft', 'Time budget reached · result validated', 'تم بلوغ الحد الزمني · تم التحقق من النتيجة') }]; };
function warnCard(span = 's5') {
  return `<section class="card ${span}"><div class="card-h"><div><div class="card-t">${t('warnTitle')}</div><div class="card-d">${WARN().length}</div></div></div>
    <div style="display:flex;flex-direction:column;gap:10px">${WARN().map(w => `<div class="warn"><span class="sv" style="background:${w.c}"></span><div style="min-width:0"><div style="font-weight:700;font-size:13.5px">${w.t}</div><div style="font-size:12.5px;color:var(--text-3)">${w.s}</div></div><button class="btn" type="button" data-go="${w.go}" style="height:32px;padding:0 12px;font-size:12.5px">${t('view')}</button></div>`).join('')}</div></section>`;
}

/* ------------------------------------------------------------------ sections */
function vOverview() {
  const A = aggregate();
  return { html: `${head(t('ovTitle'), t('ovSub'), filterBar())}
    <div class="grid">${heroCard(A)}${liveCard()}</div>
    <div class="grid">${kpiCards(A)}</div>
    <div class="grid">${perfCard()}${excCard(A)}</div>
    <div class="grid">${mapCard(A)}${locTable(A)}</div>
    <div class="grid">${optCard(A)}${fleetCard()}${healthCard()}</div>
    <div class="grid">${actCard()}${warnCard()}</div>`, after: () => { drawHero(A); drawPerf(A); drawOpt(); animateNum($('#h-del'), A.totals.delivered, v => nf(v)); } };
}
function drawHero(A) {
  const el = $('#hero-chart'); if (!el) return;
  const b = A.buckets; let vals, lab;
  if (A.hourly) { let c = 0; vals = b.map(x => x.delivered == null ? null : (c += x.delivered)); lab = t('lgDelivered'); }
  else { const all = [...A.prev, ...b]; vals = b.map((x, i) => { const w = all.slice(A.prev.length + i - 6, A.prev.length + i + 1); return Math.round(w.reduce((s, y) => s + y.delivered, 0) / 7); }); lab = t('lgDelivered') + ' · Ø 7 T'; }
  el.innerHTML = '';
  chart(el, { labels: b.map(x => x.label), tipLabels: A.hourly ? null : b.map(x => df(x.date, { weekday: 'short', day: 'numeric', month: 'short' })), noAxis: true, h: Math.max(150, el.clientHeight), min: Math.min(...vals.filter(v => v != null)) * (A.hourly ? 0 : .8), max: Math.max(...vals.filter(v => v != null)) * 1.12,
    series: [{ key: 'h', name: lab, type: 'line', area: 'a', color: 'var(--violet-hi)', values: vals, width: 2.6, end: true }], aria: t('delivered') });
}
function vAnalytics() {
  const A = aggregate();
  return { html: `${head(t('analytics'), t('perfSub'), filterBar())}
    <div class="grid">${perfCard('s12')}</div>
    <div class="grid">${excCard(A, 's4')}${optCard(A, 's4')}${fleetCard('s4')}</div>
    <div class="grid">${locTable(A, 's12')}</div>`, after: () => { drawPerf(A); drawOpt(); } };
}
function vOrgs() {
  const rows = ORGS.map(o => { const ls = LOCS.filter(l => l.org === o.id); return { o, ls, drv: ls.reduce((a, l) => a + l.drivers, 0), veh: ls.reduce((a, l) => a + l.vehicles, 0), st: ls.reduce((a, l) => a + SERIES[l.id].slice(0, 30).reduce((s, x) => s + x.stops, 0), 0) }; });
  return { html: `${head(t('orgTitle'), t('orgSub'), `<div class="filters"><button class="btn btn-primary" type="button" id="neworg"><span class="bi">${ic('plus', 16, 2.4)}</span><span class="lbl">${t('newOrg')}</span><span class="spin"></span><span class="ok">${ic('check', 18, 2.6)}</span></button></div>`)}
    <div class="grid"><section class="card s12"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('colName')}</th><th>${t('colStatus')}</th><th style="text-align:end">${t('locations')}</th><th style="text-align:end">${t('colDrivers')}</th><th class="hide-sm" style="text-align:end">${t('vehicles')}</th><th class="hide-sm" style="text-align:end">${t('stops')} · 30</th><th class="hide-sm">${t('created')}</th><th></th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr class="row ${i === 0 ? 'open' : ''}" data-xp="o${i}" tabindex="0"><td><div style="display:flex;align-items:center;gap:12px"><span style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-weight:800;background:${i ? 'var(--surface-2)' : 'linear-gradient(135deg,var(--violet-hi),var(--cobalt))'};color:${i ? 'var(--text-2)' : '#fff'}">${r.o.name[0]}</span><div><div style="font-weight:700">${r.o.name}</div><div style="font-size:12px;color:var(--text-3)">${nf(r.o.members)} ${t('members')}</div></div></div></td>
      <td><span class="tag ${r.o.kind === 'pilot' ? 't-ok' : 't-info'}">${t(r.o.kind === 'pilot' ? 'pilot' : 'testTenant')}</span></td><td class="num" style="text-align:end">${r.ls.length}</td><td class="num" style="text-align:end">${r.drv}</td><td class="num hide-sm" style="text-align:end">${r.veh}</td><td class="num hide-sm" style="text-align:end;font-weight:700">${nf(r.st)}</td><td class="hide-sm" style="color:var(--text-2)">${df(r.o.created, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td style="text-align:end"><span class="chev" style="display:inline-block">${ic('chevR', 16, 2.2)}</span></td></tr>
      <tr class="xp ${i === 0 ? 'open' : ''}" data-for="o${i}"><td colspan="8"><div class="xp-in"><div><div class="xp-body">${r.ls.map(l => `<div class="mini"><b>${l.name}</b><span class="num">${l.drivers} ${t('colDrivers')} · ${l.vehicles} ${t('vehicles')}</span></div>`).join('')}</div></div></div></td></tr>`).join('')}
    </tbody></table></div></section></div>` };
}
function vLocs() {
  const A = aggregate();
  return { html: `${head(t('locations'), t('locSub'), filterBar({ export: false }))}
    <div class="grid">${mapCard(A, 's6')}<div class="s6" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-content:start">${LOCS.filter(l => S.org === 'all' || l.org === S.org).map(L => { const a = SERIES[L.id].slice(1, 31).reverse(); const r = a.filter(x => x.stops).map(x => x.delivered / (x.delivered + x.failed)); const f = todayFleet(L);
      return `<section class="card hov" style="padding:16px"><div style="display:flex;align-items:center;gap:10px"><b style="font-size:15px">${L.name}</b><span class="tag ${r[r.length - 1] < .955 ? 't-warn' : 't-ok'} num" style="margin-inline-start:auto">${pf(r[r.length - 1])}</span></div><div style="font-size:12px;color:var(--text-3);margin-bottom:8px">${ORGS.find(o => o.id === L.org).name}</div>${spark(r, 220, 40, r[r.length - 1] < .955 ? 'var(--amber)' : 'var(--violet-hi)')}<div style="display:flex;gap:14px;margin-top:8px;font-size:12px;color:var(--text-2);font-weight:600"><span class="num">${f.drv}/${L.drivers} ${t('colDrivers')}</span><span class="num">${f.inUse}/${L.vehicles} ${t('vehicles')}</span></div></section>`; }).join('')}</div></div>
    <div class="grid">${locTable(A, 's12')}</div>` };
}
const PEOPLE = [['Lunapact Admin', 'roleOwner', 'all', true, '1'], ['S. Krämer', 'roleAdmin', 'all', true, '24'], ['M. Becker', 'roleDispatch', 'Suhl', true, '3'], ['T. Hoffmann', 'roleDispatch', 'Erfurt', true, '12'], ['A. Yilmaz', 'roleDispatch', 'Schweinfurt · Coburg', false, '58'], ['R. Neumann', 'roleDriver', 'Suhl', false, '2'], ['D. Popescu', 'roleDriver', 'Erfurt', false, '6']];
function vUsers() {
  const perms = [['pPlan', [1, 1, 1, 0]], ['pAssign', [1, 1, 1, 0]], ['pImport', [1, 1, 1, 0]], ['pLocs', [1, 1, 0, 0]], ['pUsers', [1, 1, 0, 0]], ['pReports', [1, 1, 1, 0]], ['pDeliver', [0, 0, 0, 1]]];
  const roleTag = { roleOwner: 't-vi', roleAdmin: 't-info', roleDispatch: 't-ok', roleDriver: 't-mute' };
  return { html: `${head(t('users'), t('usersSub'), `<div class="filters"><button class="btn btn-primary" type="button" id="invite"><span class="bi">${ic('userPlus', 16, 2.2)}</span><span class="lbl">${t('invite')}</span><span class="spin"></span><span class="ok">${ic('check', 18, 2.6)}</span></button></div>`)}
    <div class="grid"><section class="card s7"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('colName')}</th><th>${t('colRole')}</th><th class="hide-sm">${t('colScope')}</th><th>${t('col2fa')}</th><th class="hide-sm" style="text-align:end">${t('colLast')}</th></tr></thead><tbody>
      ${PEOPLE.map(([n, r, sc, f2, last]) => `<tr><td><div style="display:flex;align-items:center;gap:10px"><span class="avatar" style="width:30px;height:30px;font-size:11px">${n.split(' ').map(s => s[0]).join('').slice(0, 2)}</span><b style="font-weight:600">${n}</b></div></td><td><span class="tag ${roleTag[r]}">${t(r)}</span></td><td class="hide-sm" style="color:var(--text-2)">${sc === 'all' ? t('allLocsScope') : sc}</td><td>${f2 ? `<span style="color:var(--mint)">${ic('shield', 17, 2)}</span>` : `<span style="color:var(--text-3)">—</span>`}</td><td class="hide-sm num" style="text-align:end;color:var(--text-3)">${t('gpsAgo', { n: last })}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="card s5"><div class="card-h"><div class="card-t">${t('permTitle')}</div></div><div class="tbl-wrap"><table class="tbl matrix"><thead><tr><th></th>${['roleOwner', 'roleAdmin', 'roleDispatch', 'roleDriver'].map(r => `<th>${t(r)}</th>`).join('')}</tr></thead><tbody>
      ${perms.map(([p, v]) => `<tr><td style="white-space:normal;font-weight:600;font-size:13px">${t(p)}</td>${v.map(x => `<td>${x ? `<span class="yes">${ic('check', 17, 2.6)}</span>` : `<span class="no">${ic('x', 14, 2)}</span>`}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></section></div>` };
}
function vFleet() {
  const rows = []; let n = 0; const drivers = ['R. Neumann', 'D. Popescu', 'K. Schulz', 'L. Wagner', 'J. Weber', 'M. Ahmadi', 'F. Lange', 'P. Roth', 'E. Krause', 'N. Haddad', 'B. Vogel', 'C. Ionescu'];
  for (const L of activeLocs()) { const f = todayFleet(L); for (let i = 0; i < L.vehicles; i++) { const st = i < f.inUse ? 'onRoad' : (i === L.vehicles - 1 && L.id === 'suhl') ? 'service' : 'atDepot'; const gpsBad = L.id === 'erfurt' && i < 2;
    rows.push(`<tr><td><b class="num" style="font-weight:700">${L.plate}-JL ${210 + n}</b></td><td style="color:var(--text-2)">${L.name}</td><td>${st === 'onRoad' ? drivers[n % drivers.length] : '—'}</td><td><span class="tag ${st === 'onRoad' ? 't-ok' : st === 'service' ? 't-warn' : 't-mute'}">${t(st)}</span></td><td class="num" style="text-align:end;font-weight:600">${st === 'onRoad' ? Math.round(f.perDriver * (.85 + (n % 5) * .06)) : '—'}</td><td class="hide-sm" style="text-align:end;color:${gpsBad ? 'var(--coral)' : 'var(--text-3)'};font-weight:600">${st === 'onRoad' ? t('gpsAgo', { n: gpsBad ? 34 + n : 1 + (n % 3) }) : '—'}</td></tr>`); n++; } }
  return { html: `${head(t('fleet'), t('fleetPageSub'), filterBar({ export: false }))}
    <div class="grid">${fleetCard('s4')}<section class="card s8"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('colVehicle')}</th><th>${t('colLoc')}</th><th>${t('colDriver')}</th><th>${t('colStatus')}</th><th style="text-align:end">${t('stops')}</th><th class="hide-sm" style="text-align:end">${t('colGps')}</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section></div>` };
}
function vSystem() {
  const tiles = [[t('optRuns'), '38', 'var(--violet-hi)'], [t('optAvg'), '2,6 ' + t('sUnit'), 'var(--cyan)'], [t('optFallback'), '1', 'var(--amber)'], [t('locChecks'), '12', 'var(--coral)']];
  return { html: `${head(t('system'), t('sysSub'))}
    <div class="grid">${tiles.map(([l, v, c]) => `<section class="card s3 kpi" style="--acc:${c}"><span class="kpi-l">${l}</span><div class="kpi-v num">${v}</div></section>`).join('')}</div>
    <div class="grid">${healthCard('s6')}${warnCard('s6')}</div>` };
}
function vAudit() {
  const L = S.lang, z = (de, en, ar) => ({ de, en, ar }[L]);
  const ev = [['15:02', z('Rolle geändert', 'Role changed', 'تغيير الدور'), 'Lunapact Admin', 'S. Krämer', 't-vi'], ['13:47', z('Einladung gesendet', 'Invitation sent', 'إرسال دعوة'), 'S. Krämer', 'driver@…', 't-info'], ['11:05', z('Mitglied beigetreten', 'Member joined', 'انضمام عضو'), '—', z('Neue Fahrerin', 'New driver', 'سائقة جديدة'), 't-ok'], ['10:12', z('Standortzugriff geändert', 'Location access changed', 'تغيير الوصول للموقع'), 'S. Krämer', 'A. Yilmaz', 't-vi'], ['09:30', z('Organisation geändert', 'Organization updated', 'تحديث المؤسسة'), 'Lunapact Admin', 'Muster Kurier', 't-mute'], [z('Gestern', 'Yesterday', 'أمس') + ' 17:20', z('Einladung gesendet', 'Invitation sent', 'إرسال دعوة'), 'T. Hoffmann', 'dispo@…', 't-info']];
  return { html: `${head(t('audit'), t('auditSub'))}<div class="grid"><section class="card s12"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('colTime')}</th><th>${t('colEvent')}</th><th>${t('colActor')}</th><th>${t('colObject')}</th></tr></thead><tbody>
    ${ev.map(([a, b, c, d, tg]) => `<tr><td class="num" style="color:var(--text-3);font-weight:600">${a}</td><td><span class="tag ${tg}">${b}</span></td><td>${c}</td><td style="color:var(--text-2)">${d}</td></tr>`).join('')}</tbody></table></div></section></div>` };
}
function vPrefs() {
  const light = document.documentElement.dataset.theme === 'light';
  return { html: `${head(t('prefs'), t('prefsSub'))}<div class="grid"><section class="card s8">
    <div class="setrow" style="border-top:0"><div class="grow"><b>${t('language')}</b><div class="card-d">${t('langSub')}</div></div>${seg('lang', [['de', 'Deutsch'], ['en', 'English'], ['ar', 'العربية']], S.lang, 'sm')}</div>
    <div class="setrow"><div class="grow"><b>${t('theme')}</b><div class="card-d">${t('themeSub')}</div></div>${seg('themeSeg', [['dark', t('dark')], ['light', t('light')]], light ? 'light' : 'dark', 'sm')}</div>
    <div class="setrow"><div class="grow"><b>${t('compactNav')}</b><div class="card-d">${t('compactNavSub')}</div></div><label class="tgl"><input type="checkbox" id="p-col" ${S.collapsed ? 'checked' : ''}><span class="tr"></span><span class="sr">${t('compactNav')}</span></label></div>
    <div class="setrow"><div class="grow"><b>${t('motion')}</b><div class="card-d">${t('motionSub')}</div></div><label class="tgl"><input type="checkbox" id="p-mot" ${S.motion ? 'checked' : ''}><span class="tr"></span><span class="sr">${t('motion')}</span></label></div>
    <div class="setrow"><div class="grow"><b>${t('envHint')}</b><div class="card-d">${t('envHintSub')}</div></div><label class="tgl"><input type="checkbox" id="p-env" ${S.envHint ? 'checked' : ''}><span class="tr"></span><span class="sr">${t('envHint')}</span></label></div>
  </section></div>` };
}
const VIEWS = { overview: vOverview, analytics: vAnalytics, organizations: vOrgs, locations: vLocs, users: vUsers, fleet: vFleet, system: vSystem, audit: vAudit, prefs: vPrefs };

/* ------------------------------------------------------------------ render */
let lastSection = null;
function render(opts = {}) {
  const v = VIEWS[S.section]();
  const page = $('#page');
  const keepScroll = !opts.nav ? window.scrollY : 0;
  page.innerHTML = `<div class="${opts.nav || lastSection !== S.section ? 'view' : ''}" style="display:flex;flex-direction:column;gap:20px">${v.html}</div>`;
  lastSection = S.section;
  v.after && v.after();
  const rmEl = $('#rmap'); if (rmEl) RM.mount(rmEl, mapOpts(!!opts.refitMap || !!opts.nav));
  placeSeg(page); kickoff(page);
  if (opts.nav) window.scrollTo({ top: 0 }); else window.scrollTo({ top: keepScroll });
}
function go(sec) { if (!VIEWS[sec]) sec = 'overview'; S.section = sec; if (location.hash !== '#' + sec) history.replaceState(null, '', '#' + sec);
  $$('.nav a').forEach(a => a.toggleAttribute('aria-current', a.dataset.sec === sec)); $$('.nav a[aria-current]').forEach(a => a.setAttribute('aria-current', 'page'));
  placeNav(); $('#app').classList.remove('mnav'); render({ nav: true }); }

/* theme with circular reveal */
function setTheme(next, ev) {
  const apply = () => { document.documentElement.dataset.theme = next; store.set('tv-theme', next); const sw = $('#theme'); sw && sw.setAttribute('aria-checked', next === 'light'); };
  const reduce = S.motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) { apply(); afterTheme(); return; }
  const x = ev?.clientX ?? innerWidth - 80, y = ev?.clientY ?? 30, r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const tr = document.startViewTransition(apply);
  tr.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 620, easing: 'cubic-bezier(.2,.75,.25,1)', pseudoElement: '::view-transition-new(root)' }));
  tr.finished.then(afterTheme);
}
function afterTheme() { if (S.section === 'prefs') render(); else RM.refresh(); }

/* ------------------------------------------------------------------ events */
function closeMenus(except) { $$('.dd.open').forEach(d => { if (d !== except) d.classList.remove('open'); }); }
document.addEventListener('click', (e) => {
  const tEl = e.target;
  const ddBtn = tEl.closest('.dd > button');
  if (ddBtn) { const dd = ddBtn.parentElement; const open = !dd.classList.contains('open'); closeMenus(dd); dd.classList.toggle('open', open); ddBtn.setAttribute('aria-expanded', open); return; }
  if (!tEl.closest('.menu')) closeMenus();
  const a = tEl.closest('.nav a'); if (a) { e.preventDefault(); go(a.dataset.sec); return; }
  const goBtn = tEl.closest('[data-go]'); if (goBtn) { closeMenus(); go(goBtn.dataset.go); return; }
  const lb = tEl.closest('[data-lang]'); if (lb) { setLang(lb.dataset.lang); return; }
  const ob = tEl.closest('[data-org]:not(.depot)'); if (ob && ob.classList.contains('mi')) { S.org = ob.dataset.org; if (S.loc !== 'all' && LOCS.find(l => l.id === S.loc).org !== S.org && S.org !== 'all') S.loc = 'all'; closeMenus(); render(); return; }
  const lo = tEl.closest('.mi[data-loc]'); if (lo) { S.loc = lo.dataset.loc; closeMenus(); render({ refitMap: true }); return; }
  
  if (tEl.closest('#map-reset')) { S.loc = 'all'; render({ refitMap: true }); return; }
  if (tEl.closest('#map-big')) { S.mapBig = !S.mapBig; render({ refitMap: true }); setTimeout(() => $('#mapcard') && $('#mapcard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60); return; }
  const sb = tEl.closest('.seg button'); if (sb) { const sg = sb.parentElement.dataset.seg, v = sb.dataset.v;
    $$('button', sb.parentElement).forEach(b => b.setAttribute('aria-pressed', b === sb)); placeSeg(sb.parentElement.parentElement);
    if (sg === 'range') { S.range = v; store.set('tv-range', v); setTimeout(render, 160); }
    else if (sg === 'metric') { S.metric = v; S.hidden.clear(); drawPerf(aggregate()); }
    else if (sg === 'act') { S.actTab = v; setTimeout(() => { const c = $('#act'); const tmp = document.createElement('div'); tmp.innerHTML = actCard(c.className.match(/s\d+/)[0]); c.replaceWith(tmp.firstElementChild); placeSeg($('#act')); }, 140); }
    else if (sg === 'lang') setTimeout(() => setLang(v), 180);
    else if (sg === 'themeSeg') setTimeout(() => setTheme(v, e), 120);
    return; }
  const lg = tEl.closest('.lg-btn[data-key]'); if (lg) { const k = lg.dataset.key; S.hidden.has(k) ? S.hidden.delete(k) : S.hidden.add(k); drawPerf(aggregate()); return; }
  const rs = tEl.closest('.reason'); if (rs) { S.excSel = S.excSel === rs.dataset.reason ? null : rs.dataset.reason; $$('.reason').forEach(r => { r.classList.toggle('dim', !!S.excSel && r.dataset.reason !== S.excSel); r.setAttribute('aria-pressed', r.dataset.reason === S.excSel); }); return; }
  const row = tEl.closest('tr.row'); if (row) { const id = row.dataset.xp; const xp = $(`tr.xp[data-for="${id}"]`); const open = !row.classList.contains('open'); row.classList.toggle('open', open); xp && xp.classList.toggle('open', open); row.setAttribute('aria-expanded', open); return; }
  const fi = tEl.closest('.fi'); if (fi) { const o = !fi.classList.contains('open'); fi.classList.toggle('open', o); fi.setAttribute('aria-expanded', o); return; }
  const busy = tEl.closest('#export, #neworg, #invite'); if (busy && !busy.classList.contains('loading') && !busy.classList.contains('done')) {
    busy.classList.add('loading'); setTimeout(() => { busy.classList.remove('loading'); busy.classList.add('done');
      toast(busy.id === 'export' ? t('exported') : t('saved'), busy.id === 'export' ? t('exportedSub') : t('soon'));
      setTimeout(() => busy.classList.remove('done'), 1800); }, 1300); return; }
  if (tEl.closest('#theme')) { setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', e); return; }
  if (tEl.closest('#collapse')) { S.collapsed = !S.collapsed; store.set('tv-collapsed', S.collapsed); $('#app').classList.toggle('collapsed', S.collapsed); $('#collapse').setAttribute('aria-expanded', !S.collapsed); setTimeout(() => { placeNav(); redrawCharts(); }, 360); return; }
  if (tEl.closest('#mnav')) { $('#app').classList.toggle('mnav'); return; }
  if (tEl.closest('#open-cmd')) { openCmd(); return; }
  if (tEl.closest('#markread')) { $$('.badge-dot').forEach(b => b.remove()); closeMenus(); toast(t('markRead')); return; }
  if (tEl.closest('#signout')) { closeMenus(); toast(t('signOut'), t('soon')); return; }
  if (tEl.closest('#scrim')) { closeCmd(); return; }
});
document.addEventListener('change', (e) => {
  if (e.target.dataset && e.target.dataset.ly) { RM.setLayer(e.target.dataset.ly, e.target.checked); return; }
  if (e.target.id === 'cmp') { S.compare = e.target.checked; drawPerf(aggregate()); }
  if (e.target.id === 'p-col') { S.collapsed = e.target.checked; store.set('tv-collapsed', S.collapsed); $('#app').classList.toggle('collapsed', S.collapsed); setTimeout(placeNav, 360); toast(t('saved')); }
  if (e.target.id === 'p-mot') { S.motion = e.target.checked; store.set('tv-motion', S.motion); document.documentElement.classList.toggle('calm', S.motion); toast(t('saved')); }
  if (e.target.id === 'p-env') { S.envHint = e.target.checked; store.set('tv-env', S.envHint); renderShell(); toast(t('saved')); }
});
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmd(); return; }
  if (e.key === 'Escape') { closeMenus(); closeCmd(); $('#app').classList.remove('mnav'); }
  if ((e.key === 'Enter' || e.key === ' ') && (e.target.matches('tr.row, .fi, .depot, .pill-demo'))) { e.preventDefault(); e.target.click(); }
});
function setLang(l) { S.lang = l; store.set('tv-lang', l); closeMenus(); renderShell(); render(); }
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redrawCharts, 150); placeSeg(); });
function redrawCharts() { if (['overview', 'analytics'].includes(S.section)) { const A = aggregate(); drawHero(A); drawPerf(A); drawOpt(); } RM.refresh(); placeSeg(); }
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== S.section && VIEWS[h]) go(h); });

/* command palette */
let cmdSel = 0, cmdItems = [];
function cmdData() {
  return [...Object.keys(VIEWS).map(k => ({ ic: k, label: t(k), k: t('cmdGo'), run: () => go(k) })),
    ...LOCS.map(L => ({ ic: 'pin', label: L.name, k: t('locL'), run: () => { S.loc = L.id; S.org = 'all'; go('overview'); } })),
    { ic: 'sun', label: t('cmdTheme'), k: '', run: () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light') },
    ...[['de', 'Deutsch'], ['en', 'English'], ['ar', 'العربية']].filter(([c]) => c !== S.lang).map(([c, n]) => ({ ic: 'globe', label: `${t('cmdLang')}: ${n}`, k: '', run: () => setLang(c) }))];
}
function openCmd() { $('#scrim').classList.add('on'); const c = $('#cmd'); c.classList.add('on'); const inp = $('#cmd-in'); inp.placeholder = t('cmdPh'); inp.value = ''; cmdSel = 0; drawCmd(''); setTimeout(() => inp.focus(), 30); }
function closeCmd() { $('#scrim').classList.remove('on'); $('#cmd').classList.remove('on'); }
function drawCmd(q) { cmdItems = cmdData().filter(x => x.label.toLowerCase().includes(q.toLowerCase())); cmdSel = Math.min(cmdSel, Math.max(0, cmdItems.length - 1));
  $('#cmd-list').innerHTML = cmdItems.map((x, i) => `<button class="cmd-item" type="button" data-i="${i}" aria-selected="${i === cmdSel}">${ic(x.ic, 18)}${x.label}<span class="k">${x.k}</span></button>`).join(''); }
$('#cmd-in').addEventListener('input', e => { cmdSel = 0; drawCmd(e.target.value); });
$('#cmd-in').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { cmdSel = Math.min(cmdItems.length - 1, cmdSel + 1); drawCmd(e.target.value); e.preventDefault(); }
  if (e.key === 'ArrowUp') { cmdSel = Math.max(0, cmdSel - 1); drawCmd(e.target.value); e.preventDefault(); }
  if (e.key === 'Enter' && cmdItems[cmdSel]) { const it = cmdItems[cmdSel]; closeCmd(); it.run(); } });
$('#cmd-list').addEventListener('click', e => { const b = e.target.closest('.cmd-item'); if (!b) return; const it = cmdItems[+b.dataset.i]; closeCmd(); it.run(); });

/* ------------------------------------------------------------------ boot */
if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = store.get('tv-theme', 'dark');
document.documentElement.classList.toggle('calm', S.motion);
const h0 = location.hash.slice(1); if (VIEWS[h0]) S.section = h0;
renderShell(); render({ nav: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { placeSeg(); placeNav(); });
})();
