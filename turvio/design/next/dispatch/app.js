/* TURVIO NEXT · Dispatch prototype. Synthetic data only – nothing here reads or writes real records. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const { TOURS, DRIVERS, VEHICLES, COLORS, DEPOT } = DATA;

/* ---------------- icons (shared set with Admin) */
const P = {
  overview:'<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  planning:'<path d="M9 4h6M9 4a2 2 0 0 0-2 2v0h10v0a2 2 0 0 0-2-2M7 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1"/><path d="m8.5 13 2.5 2.5 4.5-5"/>',
  tours:'<circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8"/>',
  live:'<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  drivers:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 14.5V21M9.6 11.3 3.5 9.5M14.4 11.3l6.1-1.8"/>',
  vehicles:'<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>',
  locations:'<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6"/>',
  analytics:'<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  prefs:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8.5 3 8.5H3S6 15 6 8"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  chev:'<path d="m6 9 6 6 6-6"/>', chevR:'<path d="m9 6 6 6-6 6"/>', chevL:'<path d="m15 6-6 6 6 6"/>', check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>', x:'<path d="M6 6l12 12M18 6 6 18"/>',
  up:'<path d="m6 15 6-6 6 6"/>', down:'<path d="m6 9 6 6 6-6"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', alert:'<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
  shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>', plus:'<path d="M12 5v14M5 12h14"/>', menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h2M8 17h2M13 13h3M13 17h3"/>',
  wand:'<path d="m15 4 5 5L9 20l-5-5zM14 2v2M20 8h2M18 4l1-1"/>', send:'<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>', grip:'<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  zin:'<path d="M12 5v14M5 12h14"/>', zout:'<path d="M5 12h14"/>', target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>', fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  panelL:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>', panelR:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/>',
  pkg:'<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  logout:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>', trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', move:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  expand:'<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', shrink:'<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  wifiOff:'<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 5.2-2.5M19 12.6a10 10 0 0 0-2.6-1.8M2 8.8a15 15 0 0 1 4.5-2.7M22 8.8A15 15 0 0 0 11 5.1M12 20h.01"/>'
};
const ic = (n, s = 18, w = 1.9) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

/* ---------------- state + i18n */
const S = { lang: store.get('td-lang', 'de'), section: 'overview', selTour: null, selStop: null, planTour: 't6', sel: new Set(), lastSel: null, preview: null, optRun: null,
  pl: true, pr: innerWidth >= 1680, chip: 'all', q: '', collapsed: store.get('td-collapsed', false), motion: store.get('td-motion', false), envHint: store.get('td-env', true), undo: null, layers: { routes: true, stops: true, veh: true } };
const LOCALE = { de: 'de-DE', en: 'en-GB', ar: 'ar-u-nu-latn' };
const t = (k, v) => { let s = (I18N[S.lang] && I18N[S.lang][k]) ?? I18N.de[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replace(`{${a}}`, b); return s; };
const nf = (n, d = 0) => new Intl.NumberFormat(LOCALE[S.lang], { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const pf = (n, d = 0) => new Intl.NumberFormat(LOCALE[S.lang], { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const hm = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return `${h}:${String(m).padStart(2, '0')} ${t('h')}`; };
const reduce = () => S.motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
const tour = id => TOURS.find(x => x.id === id);
const drv = id => DRIVERS.find(d => d.id === id);
const veh = id => VEHICLES.find(v => v.id === id);
const col = tr => COLORS[tr.color];

function animateNum(el, to, fmt, dur = 700) {
  if (!el) return; const from = parseFloat(el.dataset.v ?? 0) || 0; el.dataset.v = to;
  if (reduce() || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(); const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
}
function toast(title, sub = '', kind = 'ok', action = null) {
  const box = $('#toasts'); const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  const c = kind === 'ok' ? ['var(--mint-soft)', 'var(--mint)', 'check'] : kind === 'warn' ? ['var(--amber-soft)', 'var(--amber)', 'alert'] : ['var(--violet-soft)', 'var(--violet-text)', 'info'];
  el.innerHTML = `<span class="ti" style="background:${c[0]};color:${c[1]}">${ic(c[2], 16, 2.4)}</span><div style="flex:1;min-width:0"><div>${title}</div>${sub ? `<div style="font-size:12px;color:var(--text-3);font-weight:500">${sub}</div>` : ''}</div>${action ? `<button class="btn btn-sm" type="button">${action.label}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
  box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, action ? 6500 : 3400);
}
function seg(id, items, value, cls = '') { return `<div class="seg ${cls}" role="group" data-seg="${id}">${items.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === value}">${l}</button>`).join('')}<span class="seg-ind"></span></div>`; }
function placeSeg(root = document) { $$('.seg', root).forEach(s => { const b = s.querySelector('[aria-pressed="true"]'), ind = s.querySelector('.seg-ind'); if (!b || !ind) return; ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft - 3}px)`; }); }
function kick(root = document) { requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]', root).forEach(b => b.style.width = b.dataset.w))); }

/* ---------------- tour metrics */
function tm(tr) {
  const n = tr.stops.length, done = tr.stops.filter(s => s.status !== 'open').length, failed = tr.stops.filter(s => s.status === 'failed').length;
  const km = DATA.routeKm(tr.stops), min = DATA.routeMin(tr.stops), parcels = tr.stops.reduce((a, s) => a + s.parcels, 0);
  const remMin = tr.day === 0 ? DATA.routeMin(tr.stops.slice(done)) * (1 + (tr.delay || 0) / 300) + (tr.delay || 0) : 0;
  return { n, done, failed, open: n - done, km, min, parcels, end: tr.day === 0 ? DATA.fmtT(DATA.NOW + remMin) : DATA.fmtT(450 + min) };
}

/* ---------------- shell */
const NAV = [['gOps', ['overview', 'planning', 'tours', 'live']], ['gRes', ['drivers', 'vehicles', 'locations']], ['gMore', ['analytics', 'prefs']]];
function renderShell() {
  document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  $('#app').classList.toggle('collapsed', S.collapsed);
  const drafts = TOURS.filter(x => x.day === 1 && x.status === 'draft').length;
  $('#side').innerHTML = `
    <div class="brand" role="img" aria-label="TURVIO"><span class="logo-mark brand-collapsed"></span>
      <div class="fade brand-full"><span class="logo-lockup"></span><div class="brand-sub">${t('appSub')}</div></div></div>
    <nav class="nav" aria-label="${t('appSub')}"><span class="nav-ind"></span>
      ${NAV.map(([g, items]) => `<div class="nav-label">${t(g)}</div>` + items.map(k => `<a href="#${k}" data-sec="${k}" data-tip="${t(k)}" ${S.section === k ? 'aria-current="page"' : ''}>${ic(k, 20, 1.8)}<span class="fade">${t(k)}</span>${k === 'planning' && drafts ? `<span class="count fade">${drafts}</span>` : k === 'live' ? '<span class="count alert">1</span>' : ''}</a>`).join('')).join('')}
    </nav>
    <div class="side-foot">
      <button class="collapse-btn" id="collapse" type="button" aria-expanded="${!S.collapsed}">${ic('chevL', 18, 2)}<span class="fade">${t('collapse')}</span></button>
      <div class="dd" id="dd-me"><button class="me" type="button" aria-haspopup="true"><span class="avatar">MB${S.envHint ? '<span class="env-dot" title="Staging"></span>' : ''}</span><span class="fade" style="min-width:0"><span class="me-name" style="display:block">M. Becker</span><span class="me-role">${t('role')}</span></span></button>
        <div class="menu start" style="bottom:calc(100% + 8px);top:auto;transform-origin:bottom left">
          <div class="mi" style="cursor:default">${ic('shield', 16)}<span>${t('twofa')}</span></div>
          <div class="mi" style="cursor:default"><span class="dot" style="background:var(--amber)"></span><span>${t('env')}<span class="sub">${t('staging')}</span></span></div>
          <div class="menu-sep"></div>
          <button class="mi" type="button" data-go="prefs">${ic('prefs', 16)}${t('prefs')}</button>
          <button class="mi" type="button" id="signout">${ic('logout', 16)}${t('signOut')}</button></div></div>
    </div>`;
  $('#topbar').innerHTML = `
    <button class="icon-btn menu-btn" id="mnav" type="button" aria-label="Menu">${ic('menu', 20)}</button>
    <button class="search" id="open-cmd" type="button">${ic('search', 17)}<span class="stxt">${t('search')}</span><span class="kbd">⌘K</span></button>
    <div class="top-right">
      <div class="dd" id="dd-lang"><button class="dd-btn" type="button" aria-haspopup="true" aria-label="${t('language')}">${ic('globe', 17)}<span>${S.lang.toUpperCase()}</span><span class="chev">${ic('chev', 15, 2.2)}</span></button>
        <div class="menu" role="menu"><div class="menu-h">${t('language')}</div>
          ${[['de', 'Deutsch', 'DE'], ['en', 'English', 'EN'], ['ar', 'العربية', 'ع']].map(([c, n, f]) => `<button class="mi" type="button" role="menuitemradio" aria-checked="${S.lang === c}" data-lang="${c}"><span class="flag">${f}</span>${n}<span class="check">${ic('check', 16, 2.4)}</span></button>`).join('')}</div></div>
      <button class="theme-switch" id="theme" type="button" role="switch" aria-checked="${document.documentElement.dataset.theme === 'light'}" aria-label="${t('theme')}"><span class="knob"><span class="ic-moon">${ic('moon', 14, 2.2)}</span><span class="ic-sun">${ic('sun', 14, 2.2)}</span></span></button>
      <div class="dd" id="dd-notif"><button class="icon-btn" type="button" aria-haspopup="true" aria-label="${t('notif')}">${ic('bell', 19)}<span class="badge-dot"></span></button>
        <div class="menu" style="width:340px"><div style="display:flex;align-items:center;padding:8px 10px"><b>${t('notif')}</b><button class="btn btn-sm" style="margin-inline-start:auto" type="button" id="markread">${t('markRead')}</button></div>
          ${alerts().slice(0, 3).map(a => `<button class="mi" type="button" data-alert="${a.tour}|${a.stop ?? ''}"><span class="dot" style="background:${a.c}"></span><span>${a.title}<span class="sub">${a.sub}</span></span></button>`).join('')}</div></div>
    </div>`;
  requestAnimationFrame(placeNav);
}
function placeNav() { const a = $('.nav a[aria-current="page"]'), ind = $('.nav-ind'); if (!a || !ind) return; ind.style.transform = `translateY(${a.offsetTop}px)`; ind.style.opacity = 1; }
function head(title, sub, right = '') { return `<div class="page-head"><div><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h1 class="page-title">${title}</h1><span class="pill pill-demo" data-tip="${t('demoTip')}" tabindex="0">${ic('info', 13, 2.2)}${t('demo')}</span></div><div class="page-sub">${sub}</div></div>${right ? `<div class="filters">${right}</div>` : ''}</div>`; }

/* ---------------- alerts */
function alerts() {
  const out = [];
  for (const tr of TOURS.filter(x => x.day === 0)) {
    if (tr.delay) { const m = tm(tr); out.push({ tour: tr.id, c: 'var(--amber)', ic: 'clock', title: `${tr.code} · ${t('delayMin', { n: tr.delay })}`, sub: `${drv(tr.driver).name} · ${t('returnBy', { t: m.end })}` }); }
    if (tr.tracking === 'off') out.push({ tour: tr.id, c: 'var(--coral)', ic: 'wifiOff', title: `${tr.code} · ${t('locOff')}`, sub: `${drv(tr.driver).name} · ${t('lastKnown', { t: tr.seen })}` });
  }
  for (const tr of TOURS.filter(x => x.day === 0)) { const i = tr.stops.findIndex(s => s.status === 'failed'); if (i >= 0) { const s = tr.stops[i]; out.push({ tour: tr.id, stop: i, c: 'var(--violet-hi)', ic: 'pkg', title: `${tr.code} · ${t('stops')} ${i + 1} · ${t('stFailed')}`, sub: `${s.street} ${s.no}, ${s.zip}` }); } }
  return out;
}

/* ================= MAP ENGINE ================= */
const M = { el: null, svg: null, dyn: null, view: { x: 150, y: 150, w: 1000, h: 700 }, cw: 1, ch: 1, anim: null, newRouteAnim: false };
function mapInit() {
  const box = document.createElement('div'); box.className = 'mapbox'; box.id = 'mapbox';
  box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Karte Hannover" style="direction:ltr"><defs>
    <linearGradient id="rg-new" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--cyan)"/><stop offset=".5" style="stop-color:var(--cobalt)"/><stop offset="1" style="stop-color:var(--violet-hi)"/></linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <g class="base">${GEO.base()}</g><g class="dyn"></g></svg>`;
  M.el = box; M.svg = box.querySelector('svg'); M.dyn = box.querySelector('.dyn');
  let drag = null;
  box.addEventListener('pointerdown', e => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, vx: M.view.x, vy: M.view.y, moved: false }; });
  addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { drag.moved = true; box.classList.add('dragging'); try { box.setPointerCapture(e.pointerId); } catch {} closePop(); }
    const s = M.view.w / M.cw; M.view.x = drag.vx - dx * s; M.view.y = drag.vy - dy * s; applyView(); });
  addEventListener('pointerup', e => { if (!drag) return; const moved = drag.moved; drag = null; box.classList.remove('dragging'); if (!moved) mapClick(e); });
  box.addEventListener('wheel', e => { e.preventDefault(); const r = box.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const base = M.tgt && M.animating ? M.tgt : { ...M.view }; const f = Math.pow(1.0018, Math.max(-240, Math.min(240, e.deltaY))); const w = Math.max(90, Math.min(1400, base.w * f)); const h0 = base.w * M.ch / M.cw, h = w * M.ch / M.cw;
    M.tgt = { x: base.x + (base.w - w) * fx, y: base.y + (h0 - h) * fy, w }; flyView(M.tgt, 260); }, { passive: false });
  const tip = document.createElement('div'); tip.className = 'tip map-tip'; box.appendChild(tip); M.tip = tip;
  box.addEventListener('pointermove', e => { if (drag && drag.moved) { tip.classList.remove('on'); return; } const g = e.target.closest && e.target.closest('[data-stop],[data-tour]'); if (!g) { tip.classList.remove('on'); if (S.hoverRoute) { S.hoverRoute = null; } return; }
    let h = ''; if (g.dataset.stop) { const [tid, i] = g.dataset.stop.split('|'); const tr = tour(tid); const list = S.preview && S.preview.tour === tid && S.preview.mode !== 'before' ? S.preview.neu : tr.stops; const st = list[+i]; if (!st) return;
      h = `<div class="tip-h" style="display:flex;gap:8px;align-items:center;margin:0"><span class="sn ${st.status === 'done' ? 'done' : st.status === 'failed' ? 'failed' : ''}" style="--tc:${col(tr)};width:24px;height:24px;font-size:11px;border-radius:8px">${+i + 1}</span>${st.street} ${st.no}</div><div class="tip-r" style="margin-top:4px">${tr.code} · ${st.parcels} ${t('parcels')}${st.win ? ' · ' + t('window', { t: st.win }) : ''}</div>`; }
    else { const tr = tour(g.dataset.tour); const m = tm(tr); const d = drv(tr.driver); h = `<div class="tip-h" style="margin:0;display:flex;gap:8px;align-items:center"><span class="dot" style="background:${col(tr)}"></span>${tr.code} · ${tr.area}</div><div class="tip-r" style="margin-top:4px">${d ? d.name : ''} · ${m.done}/${m.n} ${t('stops')}</div>`; }
    tip.innerHTML = h; const r = box.getBoundingClientRect(); let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14; if (x + 260 > r.width) x -= 280; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('on'); });
  box.addEventListener('pointerleave', () => tip.classList.remove('on'));
  box.addEventListener('dblclick', e => { const r = box.getBoundingClientRect(); zoomAt(1 / 1.8, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, true); });
}
function measure() { const r = M.el.getBoundingClientRect(); M.cw = Math.max(1, r.width); M.ch = Math.max(1, r.height); M.view.h = M.view.w * M.ch / M.cw; }
function applyView() { M.view.h = M.view.w * M.ch / M.cw; M.svg.setAttribute('viewBox', `${M.view.x.toFixed(2)} ${M.view.y.toFixed(2)} ${M.view.w.toFixed(2)} ${M.view.h.toFixed(2)}`); renderDyn(); placePop(); }
function zoomAt(f, fx, fy, animate) {
  const w = Math.max(90, Math.min(1400, M.view.w * f)); const h = w * M.ch / M.cw;
  const tx = M.view.x + (M.view.w - w) * fx, ty = M.view.y + (M.view.h - h) * fy;
  animate ? flyView({ x: tx, y: ty, w }) : (Object.assign(M.view, { x: tx, y: ty, w }), applyView());
}
function flyView(target, dur = 650) {
  cancelAnimationFrame(M.anim); closePop();
  if (reduce()) { Object.assign(M.view, target); applyView(); return; }
  const from = { ...M.view }, t0 = performance.now(); M.animating = true; const quick = dur < 400;
  const step = now => { const p = Math.min(1, (now - t0) / dur), e = quick ? 1 - Math.pow(1 - p, 3) : p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    M.view.x = from.x + (target.x - from.x) * e; M.view.y = from.y + (target.y - from.y) * e; M.view.w = from.w + (target.w - from.w) * e; applyView(); if (p < 1) M.anim = requestAnimationFrame(step); else M.animating = false; };
  M.anim = requestAnimationFrame(step);
}
function fitTo(pts, animate = true) {
  if (!pts.length) return; measure();
  const W = pts.map(p => GEO.W([p.x, p.y])); let x0 = Math.min(...W.map(p => p[0])), x1 = Math.max(...W.map(p => p[0])), y0 = Math.min(...W.map(p => p[1])), y1 = Math.max(...W.map(p => p[1]));
  const wide = innerWidth > 860; const padL = wide && $('.panel.left:not(.hidden-l)') ? $('.panel.left').offsetWidth + 50 : 40, padR = wide && $('.panel.right:not(.hidden-r)') ? $('.panel.right').offsetWidth + 50 : 70, padT = 70, padB = 60;
  const aw = Math.max(80, M.cw - padL - padR), ah = Math.max(80, M.ch - padT - padB);
  const s = Math.max((x1 - x0) / aw, (y1 - y0) / ah, 0.32); const w = s * M.cw;
  const target = { x: (x0 + x1) / 2 - (padL + aw / 2) * s, y: (y0 + y1) / 2 - (padT + ah / 2) * s, w };
  animate ? flyView(target) : (Object.assign(M.view, target), applyView());
}
const toScreen = (x, y) => { const [X, Y] = GEO.W([x, y]); return [(X - M.view.x) / M.view.w * M.cw, (Y - M.view.y) / M.view.h * M.ch]; };

function visibleTours() { if (S.section === 'planning') return TOURS.filter(x => x.day === 1); return TOURS.filter(x => x.day === 0); }
function routeD(stops, from = 0, to = stops.length, withDepot = true) {
  const seq = []; if (withDepot && from === 0) seq.push(DEPOT); for (let i = from; i < to; i++) seq.push(stops[i]); if (withDepot && to === stops.length) seq.push(DEPOT);
  if (seq.length < 2) return '';
  let d = ''; seq.forEach((p, i) => { const [X, Y] = GEO.W([p.x, p.y]); if (!i) { d += `M${X.toFixed(1)},${Y.toFixed(1)}`; return; } const c = DATA.corner(seq[i - 1], p); const [cx, cy] = GEO.W([c.x, c.y]); d += `L${cx.toFixed(1)},${cy.toFixed(1)}L${X.toFixed(1)},${Y.toFixed(1)}`; });
  return d;
}
function vehPos(tr) { const m = tm(tr); const i = m.done; const a = i > 0 ? tr.stops[i - 1] : DEPOT, b = tr.stops[Math.min(i, tr.stops.length - 1)]; const c = DATA.corner(a, b); return { x: c.x + (b.x - c.x) * .35, y: c.y + (b.y - c.y) * .35 }; }
function prio(list, i, m, tr) { const st = list[i]; if (tr.day === 0 && i === m.done) return -1e6; if (st.status === 'failed') return -5e5 + i; if (st.status === 'open') return (tr.day === 0 ? i - m.done : i); return 1e5 + (m.done - i); }
function renderDyn() {
  if (!M.dyn) return; const s = M.view.w / M.cw; let o = '';
  const tours = visibleTours(); const focus = S.section === 'planning' ? tour(S.planTour) : (S.hoverTour ? tour(S.hoverTour) : S.selTour ? tour(S.selTour) : null);
  const numbered = s < 1.05;
  // routes
  if (S.layers.routes) for (const tr of tours) {
    if (S.preview && tr.id === S.preview.tour) continue;
    if (!tr.stops.length) continue;
    const isF = focus && focus.id === tr.id, dim = focus && !isF;
    const m = tm(tr), c = col(tr);
    if (isF) o += `<path d="${routeD(tr.stops)}" fill="none" style="stroke:${c}" stroke-width="10" opacity=".18" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
    if (tr.day === 0 && m.done > 0) { o += `<path d="${routeD(tr.stops, 0, m.done)}" fill="none" style="stroke:${c}" stroke-width="${isF ? 3 : 2}" opacity="${dim ? .12 : .4}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-dasharray="${isF ? '1 5' : ''}" stroke-linecap="round"/>`;
      o += `<path d="${routeD(tr.stops, m.done - 1, m.stops ? m.n : tr.stops.length)}" fill="none" style="stroke:${c}" stroke-width="${isF ? 4 : 2.4}" opacity="${dim ? .18 : .95}" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`; }
    else o += `<path d="${routeD(tr.stops)}" fill="none" style="stroke:${c}" stroke-width="${isF ? 4 : 2.4}" opacity="${dim ? .18 : (tr.optimized ? .95 : .7)}" vector-effect="non-scaling-stroke" stroke-linejoin="round" ${tr.optimized ? '' : 'stroke-dasharray="6 5"'}/>`;
    if (isF && (tr.day === 0 || tr.optimized)) o += `<path class="route-flow" d="${tr.day === 0 ? routeD(tr.stops, Math.max(0, m.done - 1)) : routeD(tr.stops)}"/>`;
    if (S.section !== 'planning') o += `<path class="hit-route" data-tour="${tr.id}" d="${routeD(tr.stops)}"/>`;
  }
  if (S.preview) { const tr = tour(S.preview.tour);
    if (S.preview.mode !== 'after') o += `<path d="${routeD(S.preview.old)}" fill="none" style="stroke:var(--text-3)" stroke-width="2.2" stroke-dasharray="5 5" opacity=".8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
    if (S.preview.mode !== 'before') { o += `<path d="${routeD(S.preview.neu)}" fill="none" stroke="url(#rg-new)" stroke-width="${10 * s}" opacity=".22" stroke-linejoin="round"/>`;
      o += `<path ${M.newRouteAnim ? 'class="route-new" pathLength="1000" stroke-dasharray="1000" style="--L:1000"' : ''} d="${routeD(S.preview.neu)}" fill="none" stroke="url(#rg-new)" stroke-width="${4 * s}" stroke-linejoin="round" stroke-linecap="round"/>`; }
  }
  // stops
  if (S.layers.stops) for (const tr of tours) {
    const isF = focus && focus.id === tr.id, dim = focus && !isF, c = col(tr), m = tm(tr);
    const list = S.preview && S.preview.tour === tr.id && S.preview.mode !== 'before' ? S.preview.neu : tr.stops;
    let pinOK = null;
    if (isF && numbered) { // priority placement: current, next open stops, failed, then the rest – keep >= 21px apart on screen
      const order = list.map((st, i) => i).sort((p, q) => prio(list, p, m, tr) - prio(list, q, m, tr)); const placed = []; pinOK = new Set();
      for (const i of order) { const [X, Y] = GEO.W([list[i].x, list[i].y]); const px = X / s, py = Y / s; if (placed.every(([a2, b2]) => Math.hypot(a2 - px, b2 - py) >= 21)) { placed.push([px, py]); pinOK.add(i); } } }
    list.forEach((st, i) => { const [X, Y] = GEO.W([st.x, st.y]); const sel = S.sel.has(st.id) && S.section === 'planning';
      if (isF && numbered && !pinOK.has(i)) { o += `<circle class="mk-stop" data-stop="${tr.id}|${i}" cx="${X}" cy="${Y}" r="${3.6 * s}" style="fill:${st.status === 'failed' ? 'var(--coral)' : st.status === 'done' ? 'var(--text-3)' : c};stroke:var(--m-bg)" stroke-width="${1.2 * s}"/>`; if (sel) o += `<circle cx="${X}" cy="${Y}" r="${7 * s}" style="fill:none;stroke:var(--violet-hi)" stroke-width="${2 * s}"/>`; return; }
      if (isF && numbered) {
        const now = tr.day === 0 && i === m.done, done = st.status === 'done', fail = st.status === 'failed';
        if (now) o += `<circle class="pulse-ring" cx="${X}" cy="${Y}" r="${11 * s}" style="fill:${c}"/>`;
        if (sel) o += `<circle cx="${X}" cy="${Y}" r="${14 * s}" style="fill:none;stroke:var(--violet-hi)" stroke-width="${2.5 * s}"/>`;
        o += `<g class="mk-stop" data-stop="${tr.id}|${i}"><circle cx="${X}" cy="${Y}" r="${10.5 * s}" style="fill:${now ? c : done ? 'var(--surface-2)' : 'var(--surface)'};stroke:${fail ? 'var(--coral)' : c}" stroke-width="${(done ? 1.2 : 2) * s}" opacity="${done ? .85 : 1}"/>
          <text x="${X}" y="${Y + 3.4 * s}" text-anchor="middle" style="font-size:${(i >= 99 ? 8.5 : 10) * s}px;font-weight:800;fill:${now ? '#fff' : fail ? 'var(--coral)' : done ? 'var(--text-3)' : 'var(--text)'}">${i + 1}</text></g>`;
      } else {
        const r = (isF ? 4 : 2.6) * s; const op = dim ? .25 : st.status === 'open' ? .95 : .4;
        if (sel) o += `<circle cx="${X}" cy="${Y}" r="${7 * s}" style="fill:none;stroke:var(--violet-hi)" stroke-width="${2 * s}"/>`;
        o += `<circle class="mk-stop" data-stop="${tr.id}|${i}" cx="${X}" cy="${Y}" r="${r}" style="fill:${st.status === 'failed' ? 'var(--coral)' : c};stroke:var(--m-bg)" stroke-width="${s}" opacity="${op}"/>`;
      } });
  }
  // depot
  { const [X, Y] = GEO.W([DEPOT.x, DEPOT.y]); o += `<g><rect x="${X - 11 * s}" y="${Y - 11 * s}" width="${22 * s}" height="${22 * s}" rx="${6 * s}" style="fill:var(--text);stroke:var(--m-bg)" stroke-width="${2 * s}"/><path d="M${X - 5 * s},${Y + 5 * s}V${Y - 1 * s}L${X},${Y - 5 * s}L${X + 5 * s},${Y - 1 * s}V${Y + 5 * s}Z" style="fill:var(--m-bg)"/><text x="${X}" y="${Y + 25 * s}" text-anchor="middle" class="m-lm" style="font-size:${10.5 * s}px;stroke-width:${3 * s}px">Depot</text></g>`; }
  // vehicles
  if (S.layers.veh && S.section !== 'planning') for (const tr of tours.filter(x => x.day === 0)) {
    const p = vehPos(tr); const [X, Y] = GEO.W([p.x, p.y]); const off = tr.tracking === 'off'; const c = off ? 'var(--text-3)' : col(tr); const dim = focus && focus.id !== tr.id; const d = drv(tr.driver);
    o += `<g class="mk-veh" data-tour="${tr.id}" opacity="${dim ? .45 : 1}">`;
    if (!off && !dim) o += `<circle class="pulse-ring" cx="${X}" cy="${Y}" r="${12 * s}" style="fill:${c}"/>`;
    o += `<circle cx="${X}" cy="${Y}" r="${12 * s}" style="fill:${off ? 'var(--surface)' : c};stroke:${off ? 'var(--text-3)' : 'var(--m-bg)'}" stroke-width="${2.5 * s}" ${off ? `stroke-dasharray="${3 * s} ${2.5 * s}"` : ''}/>
      <path d="M${X - 5 * s},${Y + 4 * s}L${X},${Y - 6 * s}L${X + 5 * s},${Y + 4 * s}L${X},${Y + 1.5 * s}Z" style="fill:${off ? 'var(--text-3)' : '#fff'}"/>
      <g><rect x="${X + 15 * s}" y="${Y - 10 * s}" width="${(off ? 74 : 54) * s}" height="${20 * s}" rx="${7 * s}" style="fill:var(--surface);stroke:var(--line-2)" stroke-width="${s}"/>
      <text x="${X + 22 * s}" y="${Y + 3.6 * s}" style="font-size:${10 * s}px;font-weight:800;fill:var(--text)">${tr.code.slice(4)} · ${d.ini}${off ? ` · ${tr.seen}` : ''}</text></g></g>`;
  }
  o += GEO.labels(s, s < 0.75);
  M.dyn.innerHTML = o;
  M.newRouteAnim = false;
}
function mapClick(e) {
  const g = e.target.closest && e.target.closest('[data-stop],[data-tour]'); if (!g || !M.el.contains(g)) { closePop(); return; }
  if (g.dataset.stop) { const [tid, i] = g.dataset.stop.split('|'); const tr = tour(tid);
    if (S.section === 'planning') { if (tid !== S.planTour) { S.planTour = tid; S.sel.clear(); render(); return; } openPop(tid, +i); return; }
    if (S.selTour !== tid) { selectTour(tid, false); }
    openPop(tid, +i); return; }
  if (g.dataset.tour) selectTour(g.dataset.tour, true);
}
/* stop popover */
function openPop(tid, i) {
  const tr = tour(tid); const list = S.preview && S.preview.tour === tid && S.preview.mode !== 'before' ? S.preview.neu : tr.stops; const st = list[i]; if (!st) return;
  S.selStop = { tid, i }; const m = tm(tr);
  const et = DATA.etas(list); const now = tr.day === 0 && i === m.done;
  const status = st.status === 'done' ? ['t-ok', t('stDone')] : st.status === 'failed' ? ['t-bad', t('stFailed')] : now ? ['t-vi', t('stNow')] : ['t-mute', t('stOpen')];
  closePop(true);
  const el = document.createElement('div'); el.className = 'pop'; el.id = 'pop';
  el.innerHTML = `<button class="x" type="button" aria-label="${t('close')}" id="pop-x">${ic('x', 15, 2.2)}</button>
    <div style="display:flex;align-items:center;gap:8px"><span class="sn ${st.status === 'done' ? 'done' : st.status === 'failed' ? 'failed' : now ? 'now' : ''}" style="--tc:${col(tr)}">${i + 1}</span><div><div style="font-weight:800">${tr.code}</div><div class="ph-s">${tr.area}</div></div></div>
    <div style="margin-top:12px;font-weight:700;font-size:14px">${st.street} ${st.no}</div><div class="ph-s">${st.zip} Hannover</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><span class="tag ${status[0]}">${status[1]}</span><span class="tag t-mute">${ic('pkg', 13, 2)}${st.parcels} ${t('parcels')}</span>${st.win ? `<span class="tag t-warn">${ic('clock', 13, 2)}${t('window', { t: st.win })}</span>` : ''}${st.note ? `<span class="tag t-info">${st.note}</span>` : ''}</div>
    <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12.5px;color:var(--text-3);font-weight:600"><span>${t('eta')}</span><b class="num" style="color:var(--text)">${st.status === 'open' ? DATA.fmtT(et[i] + (tr.day === 0 ? (tr.delay || 0) + 270 * 0 : 0)) : '—'}</b></div>`;
  M.el.parentElement.appendChild(el); placePop();
}
function placePop() { const el = $('#pop'); if (!el || !S.selStop) return; const tr = tour(S.selStop.tid); const list = S.preview && S.preview.tour === tr.id && S.preview.mode !== 'before' ? S.preview.neu : tr.stops; const st = list[S.selStop.i]; if (!st) return;
  const [x, y] = toScreen(st.x, st.y); const r = M.el.getBoundingClientRect(), pr = M.el.parentElement.getBoundingClientRect(); const ox = r.left - pr.left, oy = r.top - pr.top;
  let L = ox + x + 18, T = oy + y - 40; if (L + 270 > pr.width - 10) L = ox + x - 288; T = Math.max(10, Math.min(pr.height - el.offsetHeight - 10, T));
  el.style.left = L + 'px'; el.style.top = T + 'px'; el.style.visibility = (x < 0 || y < 0 || x > M.cw || y > M.ch) ? 'hidden' : 'visible'; }
function closePop(keepSel) { const el = $('#pop'); if (el) el.remove(); if (!keepSel) S.selStop = null; }

/* ================= VIEWS ================= */
function kpis() {
  const tt = TOURS.filter(x => x.day === 0); let done = 0, open = 0, failed = 0, planned = 0; tt.forEach(tr => { const m = tm(tr); done += m.done; open += m.open; failed += m.failed; planned += m.n; });
  const dl = tt.filter(x => x.delay).length, off = tt.filter(x => x.tracking === 'off').length;
  const k = (acc, accS, icn, label, id, val, foot, bar) => `<div class="kp" style="--acc:${acc};--acc-soft:${accS}"><div class="kp-top"><span class="kpi-ic">${ic(icn, 16, 2.1)}</span>${label}</div><div class="kp-v num" id="${id}" data-to="${val}">0</div>${bar != null ? `<div class="prog"><i data-w="${bar}%"></i></div>` : ''}<div class="kp-f">${foot}</div></div>`;
  return `<div class="kpis">${k('var(--violet-hi)', 'var(--violet-soft)', 'tours', t('kActive'), 'k1', tt.length, t('ofPlanned', { n: tt.length }), 100)}
    ${k('var(--cobalt)', 'var(--cobalt-soft)', 'drivers', t('kDrivers'), 'k2', tt.length, `<span style="color:var(--coral)">${t('trackOff', { n: off })}</span>`)}
    ${k('var(--mint)', 'var(--mint-soft)', 'check', t('kDone'), 'k3', done, `${pf(done / planned)} · ${nf(planned)} ${t('stops')}`, (done / planned * 100).toFixed(1))}
    ${k('var(--cyan)', 'var(--cyan-soft)', 'pkg', t('kOpen'), 'k4', open, `${pf(open / planned)}`, (open / planned * 100).toFixed(1))}
    ${k('var(--amber)', 'var(--amber-soft)', 'clock', t('kDelayed'), 'k5', dl, tt.filter(x => x.delay).map(x => `${x.code} · +${x.delay} ${t('min')}`).join(', '))}
    ${k('var(--coral)', 'var(--coral-soft)', 'alert', t('kExc'), 'k6', failed, t('excFoot', { p: pf(failed / Math.max(1, done), 1) }))}</div>`;
}
function tourCard(tr) {
  const m = tm(tr), d = drv(tr.driver), v = veh(tr.vehicle), c = col(tr);
  const chip = tr.delay ? `<span class="tag t-warn">${t('delayMin', { n: tr.delay })}</span>` : tr.tracking === 'off' ? `<span class="tag t-bad">${ic('wifiOff', 13, 2)}${t('locOff')}</span>` : tr.status === 'draft' ? `<span class="tag t-mute">${t('draft')}</span>` : tr.status === 'published' ? `<span class="tag t-ok">${t('published')}</span>` : `<span class="tag t-info">${t('onRoad')}</span>`;
  return `<button class="tc" type="button" data-tc="${tr.id}" aria-selected="${S.selTour === tr.id}"><span class="cb" style="background:${c}"></span><div style="min-width:0">
    <div class="tc-h"><span class="tc-code">${tr.code}</span><span class="tc-d">${tr.area}</span><span style="margin-inline-start:auto">${chip}</span></div>
    <div class="tc-meta">${d ? `<span class="av">${d.ini}</span>${d.name}` : `<span style="color:var(--text-3)">—</span>`}${v ? `<span style="color:var(--text-3)">· ${v.plate}</span>` : ''}<span class="num" style="margin-inline-start:auto;color:var(--text)">${m.done}/${m.n}</span></div>
    <div class="pbar"><i data-w="${(m.done / m.n * 100).toFixed(1)}%" style="background:${c}"></i></div>
    <div class="tc-meta" style="margin-top:6px;color:var(--text-3)"><span>${t('returnBy', { t: m.end })}</span>${m.failed ? `<span style="margin-inline-start:auto;color:var(--coral)">${m.failed} ${t('lgFailed')}</span>` : ''}</div></div></button>`;
}
function stopRows(tr, opts = {}) {
  const m = tm(tr), et = DATA.etas(tr.stops);
  return tr.stops.map((s, i) => { const now = tr.day === 0 && i === m.done; const cls = s.status === 'done' ? 'done' : s.status === 'failed' ? 'failed' : now ? 'now' : '';
    const sel = S.sel.has(s.id);
    return `<div class="srow ${sel ? 'sel' : ''} ${now ? 'cur' : ''}" data-si="${i}" ${opts.drag ? 'draggable="true" tabindex="0"' : 'tabindex="0"'} role="button" style="--tc:${col(tr)};grid-template-columns:${opts.drag ? 'auto 18px ' : ''}30px 1fr auto">
      ${opts.drag ? `<button class="ck" type="button" role="checkbox" aria-checked="${sel}" data-ck="${s.id}" aria-label="${s.street} ${s.no}">${ic('check', 12, 3)}</button><span class="handle" aria-hidden="true">${ic('grip', 14, 2)}</span>` : ''}
      <span class="sn ${cls} num">${i + 1}</span>
      <div style="min-width:0"><div class="s-a">${s.street} ${s.no}</div><div class="s-b">${s.zip} · ${s.parcels} ${t('parcels')}${s.win ? ` · <span style="color:var(--amber)">${t('window', { t: s.win })}</span>` : ''}${s.check ? ` · <span style="color:var(--coral)">⚠</span>` : ''}</div></div>
      <div class="s-r num">${s.status === 'done' ? `<span style="color:var(--mint)">${ic('check', 15, 2.6)}</span>` : s.status === 'failed' ? `<span style="color:var(--coral)">${ic('x', 15, 2.6)}</span>` : DATA.fmtT(et[i] + (tr.day === 0 ? (tr.delay || 0) : 0))}</div></div>`; }).join('');
}
function overviewPanelLeft() {
  if (S.selTour) { const tr = tour(S.selTour), m = tm(tr), d = drv(tr.driver), v = veh(tr.vehicle);
    return `<div class="panel-h"><div class="ph-row"><button class="icon-btn" style="width:34px;height:34px" type="button" id="back" aria-label="${t('back')}">${ic(S.lang === 'ar' ? 'chevR' : 'chevL', 17, 2.2)}</button>
      <span style="width:10px;height:10px;border-radius:4px;background:${col(tr)}"></span><div><div class="ph-t">${tr.code}</div><div class="ph-s">${tr.area}</div></div>
      <span style="margin-inline-start:auto">${tr.delay ? `<span class="tag t-warn">${t('delayMin', { n: tr.delay })}</span>` : tr.tracking === 'off' ? `<span class="tag t-bad">${t('locOff')}</span>` : `<span class="tag t-info">${t('onRoad')}</span>`}</span></div>
      <div class="ph-row" style="font-size:12.5px;font-weight:600;color:var(--text-2)"><span class="av">${d.ini}</span>${d.name}<span style="color:var(--text-3)">· ${v.plate}</span>
        <span style="margin-inline-start:auto;color:var(--text-3)">${tr.tracking === 'off' ? t('lastKnown', { t: tr.seen }) : `${tr.seen} · ${t('simulated')}`}</span></div>
      <div class="metrics"><div class="metric"><b class="num">${m.done}/${m.n}</b><span>${t('stops')}</span></div><div class="metric"><b class="num">${m.failed}</b><span>${t('lgFailed')}</span></div><div class="metric"><b class="num">${nf(m.km, 1)}</b><span>${t('km')}</span></div><div class="metric"><b class="num">${m.end}</b><span>${t('colEnd')}</span></div></div>
      <div class="pbar" style="margin:0"><i data-w="${(m.done / m.n * 100).toFixed(1)}%" style="background:${col(tr)}"></i></div></div>
      <div class="panel-b"><div class="sl">${stopRows(tr)}</div></div>
      <div class="panel-f"><button class="btn btn-sm" type="button" id="contact">${ic('phone', 15)}${t('contact')}</button><button class="btn btn-sm btn-ghost" type="button" id="fit-tour" style="margin-inline-start:auto">${ic('fit', 15)}${t('showOnMap')}</button></div>`; }
  const tt = TOURS.filter(x => x.day === 0).filter(tr => (S.chip === 'all' || (S.chip === 'delayed' ? (tr.delay || tr.tracking === 'off') : !tr.delay)) && (!S.q || (tr.code + tr.area + (drv(tr.driver)?.name || '')).toLowerCase().includes(S.q.toLowerCase())));
  return `<div class="panel-h"><div class="ph-row"><div><div class="ph-t">${t('toursToday')}</div><div class="ph-s">${t('today')} · ${t('depot')}</div></div></div>
    <label class="input">${ic('search', 16)}<input id="tq" type="search" placeholder="${t('searchTours')}" value="${S.q}" aria-label="${t('searchTours')}"></label>
    <div class="chips">${[['all', t('all')], ['road', t('onRoad')], ['delayed', t('delayed')]].map(([k, l]) => `<button class="chip" type="button" data-chip="${k}" aria-pressed="${S.chip === k}">${l}</button>`).join('')}</div></div>
    <div class="panel-b" style="display:flex;flex-direction:column;gap:4px">${tt.map(tourCard).join('') || `<div class="empty" style="padding:30px"><span class="ph-s">—</span></div>`}</div>`;
}
function alertsPanel() {
  const al = alerts();
  return `<div class="panel-h"><div class="ph-row"><div class="ph-t">${t('alerts')}</div><span class="count" style="margin-inline-start:6px;font-size:12px;font-weight:800;color:var(--coral);background:var(--coral-soft);padding:1px 8px;border-radius:99px">${al.length}</span></div></div>
    <div class="panel-b" style="display:flex;flex-direction:column;gap:8px">${al.map(a => `<button class="warn" type="button" data-alert="${a.tour}|${a.stop ?? ''}" style="text-align:start;cursor:pointer;width:100%;grid-template-columns:4px 30px 1fr"><span class="sv" style="background:${a.c}"></span><span class="fi-ic" style="width:30px;height:30px;border-radius:10px;background:var(--surface);color:${a.c}">${ic(a.ic, 15, 2.1)}</span><div style="min-width:0"><div style="font-weight:700;font-size:13px">${a.title}</div><div style="font-size:12px;color:var(--text-3)">${a.sub}</div></div></button>`).join('')}
    <div class="note" style="margin-top:6px">${ic('info', 14, 2)}<span>${t('simTip')}</span></div></div>`;
}
function wsChrome(opts) {
  return `${opts.left ? `<aside class="panel left ${opts.wide ? 'wide' : ''} ${S.pl ? '' : 'hidden-l'}" id="pl">${opts.left}</aside><button class="tab-toggle l ${opts.wide ? 'wide' : ''} ${S.pl ? '' : 'closed'}" id="tg-l" type="button" aria-label="${t('layers')}">${ic('panelL', 17)}</button>` : ''}
    ${opts.right ? `<aside class="panel right ${S.pr ? '' : 'hidden-r'}" id="pr">${opts.right}</aside><button class="tab-toggle r ${S.pr ? '' : 'closed'}" id="tg-r" type="button" aria-label="${t('alerts')}">${ic('panelR', 17)}${S.pr ? '' : '<span class="badge-dot" style="top:6px;inset-inline-end:6px"></span>'}</button>` : ''}
    ${opts.stat ? `<div class="mstat" data-tip="${t('simTip')}" tabindex="0"><span class="live-dot" style="background:var(--amber)"></span>${opts.stat}</div>` : ''}
    <div class="ctrl ${opts.right && S.pr ? 'shift' : ''}"><div class="ctrl-grp"><button type="button" id="zin" aria-label="${t('zoomIn')}" data-tip="${t('zoomIn')}">${ic('zin', 18, 2.2)}</button><button type="button" id="zout" aria-label="${t('zoomOut')}">${ic('zout', 18, 2.2)}</button></div>
      <div class="ctrl-grp"><button type="button" id="recenter" aria-label="${t('recenter')}">${ic('target', 18, 2)}</button><button type="button" id="fitall" aria-label="${t('fit')}">${ic('fit', 18, 2)}</button></div>
      <div class="ctrl-grp"><button type="button" id="maxmap" aria-label="${t(S.max ? 'mapRestore' : 'mapMax')}" aria-pressed="${!!S.max}">${ic(S.max ? 'shrink' : 'expand', 18, 2)}</button></div></div>
    ${opts.legend ? `<div class="mleg"><span style="display:flex;align-items:center;gap:6px"><span class="dot" style="background:var(--text-3);opacity:.6"></span>${t('lgDone')}</span><span style="display:flex;align-items:center;gap:6px"><span class="dot" style="background:var(--violet-hi)"></span>${t('lgOpen')}</span><span style="display:flex;align-items:center;gap:6px"><span class="dot" style="background:var(--coral)"></span>${t('lgFailed')}</span><span style="display:flex;align-items:center;gap:6px"><span class="dot" style="background:var(--cyan);box-shadow:0 0 0 3px var(--cyan-soft)"></span>${t('lgVeh')} (${t('simulated')})</span><span style="color:var(--text-3);border-inline-start:1px solid var(--line-2);padding-inline-start:10px">${t('mapIllus')}</span></div>` : ''}`;
}
function vOverview() {
  return { cls: 'ws-page', html: `${head(t('ovTitle'), `${t('today')} · ${t('depot')}`, `<button class="btn btn-primary" type="button" data-newtour="1"><span class="bi">${ic('plus', 16, 2.4)}</span><span class="lbl">${t('newTour')}</span></button>`)}
    ${kpis()}
    <section class="ws mid ${S.max ? 'max' : ''}" id="ws">${wsChrome({ left: overviewPanelLeft(), right: alertsPanel(), stat: t('simBanner'), legend: true })}</section>`,
    after: () => { const tt = TOURS.filter(x => x.day === 0); ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].forEach(id => { const el = $('#' + id); animateNum(el, +el.dataset.to, v => nf(v)); }); },
    fit: () => S.selTour ? tour(S.selTour).stops : TOURS.filter(x => x.day === 0).flatMap(x => x.stops) };
}
function vLive() {
  const tt = TOURS.filter(x => x.day === 0);
  const left = `<div class="panel-h"><div class="ph-t">${t('drivers')}</div><div class="ph-s">${t('liveSub')}</div></div><div class="panel-b" style="display:flex;flex-direction:column;gap:4px">${tt.map(tr => { const m = tm(tr), d = drv(tr.driver), off = tr.tracking === 'off';
    return `<button class="tc" type="button" data-tc="${tr.id}" aria-selected="${S.selTour === tr.id}"><span class="cb" style="background:${col(tr)}"></span><div style="min-width:0"><div class="tc-h"><span class="av" style="width:30px;height:30px;font-size:11px">${d.ini}</span><div><div style="font-weight:800;font-size:13.5px">${d.name}</div><div class="tc-d">${tr.code} · ${veh(tr.vehicle).plate}</div></div><span style="margin-inline-start:auto">${off ? `<span class="tag t-bad">${t('locOff')}</span>` : tr.delay ? `<span class="tag t-warn">${t('delayMin', { n: tr.delay })}</span>` : `<span class="tag t-ok">${t('onRoad')}</span>`}</span></div>
      <div class="pbar"><i data-w="${(m.done / m.n * 100).toFixed(1)}%" style="background:${col(tr)}"></i></div>
      <div class="tc-meta" style="color:var(--text-3)"><span class="num">${m.done}/${m.n} ${t('stops')}</span><span style="margin-inline-start:auto;display:flex;align-items:center;gap:5px">${off ? ic('wifiOff', 13, 2) : '<span class="dot" style="background:var(--amber)"></span>'}${off ? t('lastKnown', { t: tr.seen }) : `${tr.seen} · ${t('simulated')}`}</span></div></div></button>`; }).join('')}</div>`;
  return { cls: 'ws-page', html: `${head(t('liveTitle'), t('liveSub'))}<section class="ws tall ${S.max ? 'max' : ''}" id="ws">${wsChrome({ left: S.selTour ? overviewPanelLeft() : left, stat: t('simBanner'), legend: true })}</section>`, fit: () => S.selTour ? tour(S.selTour).stops : tt.flatMap(x => x.stops) };
}

/* ---------- planning */
function planPanel() {
  const drafts = TOURS.filter(x => x.day === 1); const tr = tour(S.planTour) || drafts[0]; if (tr) S.planTour = tr.id;
  const m = tr ? tm(tr) : null; const d = tr && drv(tr.driver), v = tr && veh(tr.vehicle);
  const st = tr ? [tr.stops.length > 0, !!(tr.driver && tr.vehicle), tr.optimized, tr.status === 'published'] : [false, false, false, false];
  const nowIdx = st.indexOf(false);
  const busyDrivers = new Set(drafts.filter(x => x.id !== tr?.id && x.driver).map(x => x.driver)), busyVeh = new Set(drafts.filter(x => x.id !== tr?.id && x.vehicle).map(x => x.vehicle));
  const nsel = tr ? tr.stops.filter(s => S.sel.has(s.id)).length : 0;
  const allSel = tr && nsel === tr.stops.length && nsel > 0;
  return `<div class="panel-h">
    <div class="ph-row"><div><div class="ph-t">${t('drafts')}</div><div class="ph-s">${t('tomorrow')}</div></div><button class="btn btn-sm" type="button" data-newtour="1" style="margin-inline-start:auto">${ic('plus', 15, 2.4)}${t('newTour')}</button></div>
    <div class="chips">${drafts.map(x => `<button class="chip" type="button" data-pt="${x.id}" aria-pressed="${x.id === S.planTour}" style="display:inline-flex;align-items:center;gap:6px"><span class="dot" style="background:${col(x)}"></span>${x.code}${x.status === 'published' ? ` ${ic('check', 12, 3)}` : ''}</button>`).join('')}</div>
    ${tr ? `<div class="ph-row"><span style="width:10px;height:10px;border-radius:4px;background:${col(tr)}"></span><div style="min-width:0"><div class="ph-t" style="font-size:15px">${tr.code} · ${tr.area}</div></div><span style="margin-inline-start:auto">${tr.status === 'published' ? `<span class="tag t-ok">${t('published')}</span>` : tr.optimized ? `<span class="tag t-vi">${t('optimizedL')}</span>` : `<span class="tag t-mute">${t('draft')} · ${t('notOpt')}</span>`}</span></div>
    <div class="steps">${[t('stepImport'), t('stepAssign'), t('stepOpt'), t('stepPub')].map((l, i) => `<div class="step ${st[i] ? 'done' : i === nowIdx ? 'now' : ''}"><i></i>${i + 1} · ${l}</div>`).join('')}</div>
    <div class="assign">
      <div class="dd" id="dd-drv"><button class="dd-btn" type="button" aria-haspopup="true">${d ? `<span class="av">${d.ini}</span>` : ic('drivers', 17)}<span class="lbl2"><small>${t('driver')}</small><span>${d ? d.name : t('choose')}</span></span><span class="chev">${ic('chev', 15, 2.2)}</span></button>
        <div class="menu"><div class="menu-h">${t('driver')} · ${t('tomorrow')}</div>${DRIVERS.map(x => `<button class="mi" type="button" data-drv="${x.id}" aria-checked="${tr.driver === x.id}"><span class="av">${x.ini}</span><span>${x.name}<span class="sub">${busyDrivers.has(x.id) ? t('busy') : t('available')}</span></span><span class="check">${ic('check', 16, 2.4)}</span></button>`).join('')}</div></div>
      <div class="dd" id="dd-veh"><button class="dd-btn" type="button" aria-haspopup="true">${ic('vehicles', 17)}<span class="lbl2"><small>${t('vehicle')}</small><span>${v ? v.plate : t('choose')}</span></span><span class="chev">${ic('chev', 15, 2.2)}</span></button>
        <div class="menu"><div class="menu-h">${t('vehicle')}</div>${VEHICLES.map(x => `<button class="mi" type="button" data-veh="${x.id}" aria-checked="${tr.vehicle === x.id}"><span class="flag" style="width:auto;padding:0 6px">${x.plate.slice(5)}</span><span>${x.plate}<span class="sub">${x.type} · ${t('capacity', { n: x.cap })}${busyVeh.has(x.id) ? ' · ' + t('busy') : ''}</span></span><span class="check">${ic('check', 16, 2.4)}</span></button>`).join('')}</div></div></div>
    <div class="metrics"><div class="metric"><b class="num" id="pm-n">${m.n}</b><span>${t('stops')}</span></div><div class="metric"><b class="num">${nf(m.parcels)}</b><span>${t('parcels')}</span></div><div class="metric"><b class="num" id="pm-km">${nf(m.km, 1)}</b><span>${t('km')}</span></div><div class="metric"><b class="num" id="pm-t">${hm(m.min)}</b><span>${t('duration')}</span></div></div>
    ${tr.stops.length ? `<div class="ph-row"><button class="ck" type="button" role="checkbox" id="selall" aria-checked="${allSel ? 'true' : nsel ? 'mixed' : 'false'}" aria-label="${t('selectAll')}">${nsel && !allSel ? ic('zout', 12, 3) : ic('check', 12, 3)}</button><span style="font-size:12.5px;font-weight:700;color:var(--text-2)">${t('selectAll')}</span><span class="ph-s" style="margin-inline-start:auto">${t('dragHint')}</span></div>
    ${nsel ? `<div class="bulk"><span>${t('nSelected', { n: nsel })}</span><span style="margin-inline-start:auto;display:flex;gap:6px">
      ${drafts.filter(x => x.id !== tr.id && x.status !== 'published').map(x => `<button class="btn btn-sm" type="button" data-moveto="${x.id}">${ic('move', 14, 2)}${x.code}</button>`).join('')}
      <button class="btn btn-sm btn-danger" type="button" id="bulk-rm" aria-label="${t('remove')}">${ic('trash', 14, 2)}</button><button class="btn btn-sm btn-ghost" type="button" id="bulk-clear">${t('clearSel')}</button></span></div>` : ''}` : ''}` : ''}
  </div>
  <div class="panel-b">${tr && tr.stops.length ? `<div class="sl" id="plist">${stopRows(tr, { drag: tr.status !== 'published' })}</div>` : `<div class="empty"><div class="empty-art">${ic('upload', 40, 1.6)}</div><b>${t('emptyTour')}</b><span class="ph-s">${t('emptyTourSub')}</span><button class="btn btn-primary" type="button" id="open-import"><span class="bi">${ic('upload', 16, 2.2)}</span><span class="lbl">${t('importStops')}</span></button></div>`}</div>
  ${tr && tr.stops.length && tr.status !== 'published' ? `<div class="panel-f"><button class="btn ${tr.optimized ? '' : 'btn-primary'}" type="button" id="optimize" style="flex:1">${ic('wand', 16, 2)}<span>${t('optimize')}</span></button><button class="btn ${tr.optimized ? 'btn-primary' : ''}" type="button" id="publish" style="flex:1"><span class="bi">${ic('send', 16, 2)}</span><span class="lbl">${t('publish')}</span><span class="spin"></span><span class="ok">${ic('check', 18, 2.6)}</span></button></div>` : ''}`;
}
function proposalPanel() {
  if (S.optRun) return `<div class="panel-h"><div class="ph-t">${t('optRunning')}</div><div class="ph-s">${tour(S.planTour).code} · ${tour(S.planTour).stops.length} ${t('stops')}</div></div>
    <div class="panel-b"><div class="opt-run">${['os1', 'os2', 'os3', 'os4'].map((k, i) => `<div class="opt-step ${i < S.optRun.step ? 'ok' : i === S.optRun.step ? 'run' : ''}"><span class="os">${i < S.optRun.step ? ic('check', 12, 3) : ''}</span>${t(k)}</div>`).join('')}</div>
    <div class="pbar"><i style="width:${S.optRun.step * 25}%;background:linear-gradient(90deg,var(--cyan),var(--violet-hi));transition:width .4s var(--ease)"></i></div></div>`;
  const p = S.preview; if (!p) return '';
  const tr = tour(p.tour); const ok = DATA.routeKm(p.old), nk = DATA.routeKm(p.neu), om = DATA.routeMin(p.old), nm = DATA.routeMin(p.neu);
  const oldIdx = new Map(p.old.map((s, i) => [s.id, i])); const changed = p.neu.filter((s, i) => oldIdx.get(s.id) !== i).length;
  const moves = p.neu.map((s, i) => ({ s, i, o: oldIdx.get(s.id) })).sort((a, b) => Math.abs(b.o - b.i) - Math.abs(a.o - a.i)).slice(0, 6);
  const et = DATA.etas(p.neu); const wins = p.neu.map((s, i) => s.win ? { ok: et[i] <= (+s.win.slice(0, 2)) * 60 + +s.win.slice(3) } : null).filter(Boolean); const wOk = wins.filter(w => w.ok).length;
  const parcels = p.neu.reduce((a, s) => a + s.parcels, 0); const v = veh(tr.vehicle);
  return `<div class="panel-h"><div class="ph-row"><span class="kpi-ic" style="width:32px;height:32px;border-radius:10px;background:var(--violet-soft);color:var(--violet-text)">${ic('wand', 17, 2)}</span><div><div class="ph-t">${t('proposal')}</div><div class="ph-s">${tr.code} · ${t('changed', { n: changed, m: p.neu.length })}</div></div></div>
    ${seg('pmode', [['before', t('before')], ['after', t('after')], ['both', t('both')]], p.mode, 'sm')}</div>
    <div class="panel-b" style="padding:12px 14px;display:flex;flex-direction:column;gap:12px">
      <div class="cmp"><div class="cmp-c"><div class="k">${t('distance')}</div><div class="cmp-row"><span class="cmp-new num">${nf(nk, 1)} ${t('km')}</span></div><div class="cmp-old num">${nf(ok, 1)} ${t('km')}</div><span class="save num">−${nf(ok - nk, 1)} ${t('km')} · ${pf((ok - nk) / ok)}</span></div>
        <div class="cmp-c"><div class="k">${t('duration')}</div><div class="cmp-row"><span class="cmp-new num">${hm(nm)}</span></div><div class="cmp-old num">${hm(om)}</div><span class="save num">−${nf(om - nm)} ${t('min')}</span></div></div>
      <div><div class="eyebrow" style="color:var(--text-3);margin-bottom:4px">${t('constraints')}</div>
        <div class="cons"><span class="ci" style="background:${wOk === wins.length ? 'var(--mint-soft)' : 'var(--amber-soft)'};color:${wOk === wins.length ? 'var(--mint)' : 'var(--amber)'}">${ic(wOk === wins.length ? 'check' : 'alert', 14, 2.4)}</span><span>${wOk === wins.length ? t('consTw', { a: wOk, b: wins.length }) : t('consTwWarn', { n: wins.length - wOk })}</span></div>
        <div class="cons"><span class="ci" style="background:${v ? 'var(--mint-soft)' : 'var(--amber-soft)'};color:${v ? 'var(--mint)' : 'var(--amber)'}">${ic(v ? 'check' : 'alert', 14, 2.4)}</span><span>${v ? t('consCap', { a: parcels, b: v.cap, p: pf(parcels / v.cap) }) : t('needAssign')}</span></div>
        ${p.neu.some(s => s.check) ? `<div class="cons"><span class="ci" style="background:var(--amber-soft);color:var(--amber)">${ic('alert', 14, 2.4)}</span><span>${t('consAddr')}</span></div>` : ''}</div>
      <div><div class="eyebrow" style="color:var(--text-3);margin-bottom:4px">${t('orderChanges')}</div>${moves.map(x => `<div class="chg"><span class="from num">${x.o + 1}</span><span class="to num">${x.i + 1}</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600">${x.s.street} ${x.s.no}</span></div>`).join('')}</div>
      <div class="note">${ic('info', 14, 2)}<span>${t('calcNote')}</span></div></div>
    <div class="panel-f"><button class="btn" type="button" id="discard" style="flex:1">${t('discard')}</button><button class="btn btn-primary" type="button" id="apply" style="flex:1.4"><span class="bi">${ic('check', 16, 2.4)}</span><span class="lbl">${t('apply')}</span></button></div>`;
}
function vPlanning() {
  const right = S.optRun || S.preview ? proposalPanel() : null;
  if (right) S.pr = true;
  return { cls: 'ws-page', html: `${head(t('planTitle'), t('planSub'), `<span class="pill" style="background:var(--surface);border:1px solid var(--line);height:40px;padding:0 14px;border-radius:12px;font-size:13px;color:var(--text-2)">${ic('clock', 15)}${t('tomorrow')}</span><button class="btn" type="button" id="open-import2"><span class="bi">${ic('upload', 16, 2.2)}</span><span class="lbl">${t('importStops')}</span></button><button class="btn btn-primary" type="button" data-newtour="1"><span class="bi">${ic('plus', 16, 2.4)}</span><span class="lbl">${t('newTour')}</span></button>`)}
    <section class="ws tall ${S.max ? 'max' : ''}" id="ws">${wsChrome({ left: planPanel(), wide: true, right })}</section>`,
    fit: () => { const tr = tour(S.planTour); return tr && tr.stops.length ? tr.stops : TOURS.filter(x => x.day === 1).flatMap(x => x.stops).concat([DEPOT]); } };
}
/* ---------- tables */
function vTours() {
  const rows = TOURS.map(tr => { const m = tm(tr), d = drv(tr.driver);
    const st = tr.day === 1 ? (tr.status === 'published' ? ['t-ok', t('published')] : ['t-mute', t('draft')]) : tr.delay ? ['t-warn', t('delayed')] : tr.tracking === 'off' ? ['t-bad', t('locOff')] : ['t-info', t('onRoad')];
    return `<tr class="row" data-open="${tr.id}" tabindex="0"><td><div style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:4px;background:${col(tr)}"></span><div><b>${tr.code}</b><div style="font-size:12px;color:var(--text-3)">${tr.area}</div></div></div></td><td>${tr.day ? t('tomorrow').split(',')[0] : t('today').split(',')[0]}</td><td>${d ? d.name : '—'}</td><td><span class="tag ${st[0]}">${st[1]}</span></td>
      <td style="min-width:160px"><div style="display:flex;align-items:center;gap:10px"><div class="pbar" style="flex:1;margin:0"><i data-w="${(m.done / m.n * 100).toFixed(1)}%" style="background:${col(tr)}"></i></div><span class="num" style="font-size:12.5px;font-weight:700">${m.done}/${m.n}</span></div></td><td class="num hide-sm" style="text-align:end">${nf(m.km, 1)} ${t('km')}</td><td class="num hide-sm" style="text-align:end">${m.end}</td></tr>`; }).join('');
  return { html: `${head(t('tours'), t('toursSub'), `<button class="btn btn-primary" type="button" data-newtour="1"><span class="bi">${ic('plus', 16, 2.4)}</span><span class="lbl">${t('newTour')}</span></button>`)}<div class="grid"><section class="card s12"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('colTour')}</th><th></th><th>${t('colDriver')}</th><th>${t('colStatus')}</th><th>${t('colProgress')}</th><th class="hide-sm" style="text-align:end">${t('distance')}</th><th class="hide-sm" style="text-align:end">${t('colEnd')}</th></tr></thead><tbody>${rows}</tbody></table></div></section></div>` };
}
function vDrivers() {
  const rows = DRIVERS.map(d => { const tr = TOURS.find(x => x.driver === d.id && x.day === 0), tm2 = TOURS.find(x => x.driver === d.id && x.day === 1);
    return `<tr><td><div style="display:flex;align-items:center;gap:10px"><span class="av" style="width:30px;height:30px;font-size:11px">${d.ini}</span><b style="font-weight:600">${d.name}</b></div></td><td>${tr ? `<span class="tag t-info">${tr.code}</span>` : `<span class="tag t-ok">${t('free')}</span>`}</td><td>${tm2 ? `<span class="tag t-mute">${tm2.code}</span>` : '—'}</td><td class="hide-sm" style="color:var(--text-3)">${tr ? (tr.tracking === 'off' ? t('lastKnown', { t: tr.seen }) : `${tr.seen} · ${t('simulated')}`) : '—'}</td></tr>`; }).join('');
  return { html: `${head(t('drivers'), t('driversSub'))}<div class="grid"><section class="card s12"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('colDriver')}</th><th>${t('today').split(',')[0]}</th><th>${t('tomorrow').split(',')[0]}</th><th class="hide-sm">${t('colGps')}</th></tr></thead><tbody>${rows}</tbody></table></div></section></div>` };
}
function vVehicles() {
  const rows = VEHICLES.map(v => { const tr = TOURS.find(x => x.vehicle === v.id && x.day === 0); const p = tr ? tm(tr).parcels : 0;
    return `<tr><td><b class="num">${v.plate}</b></td><td style="color:var(--text-2)">${v.type}</td><td style="min-width:150px"><div style="display:flex;align-items:center;gap:10px"><div class="pbar" style="flex:1;margin:0"><i data-w="${(p / v.cap * 100).toFixed(1)}%" style="background:var(--cobalt)"></i></div><span class="num" style="font-size:12px;font-weight:700">${p}/${v.cap}</span></div></td><td>${tr ? `<span class="tag t-info">${tr.code}</span>` : `<span class="tag t-ok">${t('free')}</span>`}</td></tr>`; }).join('');
  return { html: `${head(t('vehicles'), t('vehiclesSub'))}<div class="grid"><section class="card s12"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('colVehicle')}</th><th>${t('colType')}</th><th>${t('colCap')}</th><th>${t('today').split(',')[0]}</th></tr></thead><tbody>${rows}</tbody></table></div></section></div>` };
}
function vSoon(k, txt) { return { html: `${head(t(k), t('soonTitle'))}<div class="grid"><section class="card s12"><div class="empty"><div class="empty-art">${ic(k, 44, 1.5)}</div><b style="font-size:16px">${t('soonTitle')}</b><span class="ph-s" style="max-width:460px;font-size:13px">${t(txt)}</span></div></section></div>` }; }
function vPrefs() {
  const light = document.documentElement.dataset.theme === 'light';
  return { html: `${head(t('prefs'), t('prefsSub'))}<div class="grid"><section class="card s8">
    <div class="setrow" style="border-top:0"><div class="grow"><b>${t('language')}</b><div class="card-d">${t('langSub')}</div></div>${seg('lang', [['de', 'Deutsch'], ['en', 'English'], ['ar', 'العربية']], S.lang, 'sm')}</div>
    <div class="setrow"><div class="grow"><b>${t('theme')}</b><div class="card-d">${t('themeSub')}</div></div>${seg('themeSeg', [['dark', t('dark')], ['light', t('light')]], light ? 'light' : 'dark', 'sm')}</div>
    <div class="setrow"><div class="grow"><b>${t('motion')}</b><div class="card-d">${t('motionSub')}</div></div><label class="tgl"><input type="checkbox" id="p-mot" ${S.motion ? 'checked' : ''}><span class="tr"></span><span class="sr">${t('motion')}</span></label></div>
    <div class="setrow"><div class="grow"><b>${t('envHint')}</b><div class="card-d">${t('envHintSub')}</div></div><label class="tgl"><input type="checkbox" id="p-env" ${S.envHint ? 'checked' : ''}><span class="tr"></span><span class="sr">${t('envHint')}</span></label></div></section></div>` };
}
const VIEWS = { overview: vOverview, planning: vPlanning, tours: vTours, live: vLive, drivers: vDrivers, vehicles: vVehicles, locations: () => vSoon('locations', 'soonLoc'), analytics: () => vSoon('analytics', 'soonAna'), prefs: vPrefs };

/* ================= RENDER ================= */
let lastSec = null, curView = null;
function render(opts = {}) {
  const v = VIEWS[S.section](); curView = v; const page = $('#page');
  page.className = 'page ' + (v.cls || '');
  const fresh = opts.nav || lastSec !== S.section; const y = scrollY;
  page.innerHTML = `<div class="${fresh ? 'view' : ''}" style="display:flex;flex-direction:column;gap:18px">${v.html}</div>`;
  lastSec = S.section;
  const ws = $('#ws'); if (ws) { ws.prepend(M.el); measure(); if (fresh || opts.fit) { M.view.w = M.view.w || 1000; fitTo(v.fit(), !fresh); } else applyView(); }
  v.after && v.after(); placeSeg(page); kick(page);
  if (S.selStop && ws) openPop(S.selStop.tid, S.selStop.i);
  if (opts.nav) scrollTo({ top: 0 }); else scrollTo({ top: y });
}
function go(sec) { if (S.max) { S.max = false; document.body.style.overflow = ''; } if (!VIEWS[sec]) sec = 'overview'; if (sec !== S.section) { S.selStop = null; if (sec !== 'planning') { S.preview = null; } if (!['overview', 'live'].includes(sec)) S.selTour = null; }
  S.section = sec; history.replaceState(null, '', '#' + sec);
  $$('.nav a').forEach(a => a.dataset.sec === sec ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')); placeNav(); $('#app').classList.remove('mnav'); render({ nav: true }); }
function selectTour(id, fly = true) { S.selTour = id; S.selStop = null; S.pl = true; render(); if (fly) fitTo(tour(id).stops); }

/* ---------------- planning actions */
function toggleMax() { S.max = !S.max; const ws = $('#ws'); if (!ws) return; const pts = curView.fit(); ws.classList.toggle('max', S.max); const b = $('#maxmap'); if (b) { b.innerHTML = ic(S.max ? 'shrink' : 'expand', 18, 2); b.setAttribute('aria-pressed', S.max); b.setAttribute('aria-label', t(S.max ? 'mapRestore' : 'mapMax')); }
  document.body.style.overflow = S.max ? 'hidden' : ''; requestAnimationFrame(() => { measure(); fitTo(pts, true); }); }
function curPlan() { return tour(S.planTour); }
function setUndo(label, snapshot) { S.undo = snapshot; toast(label, '', 'ok', { label: t('undo'), fn: () => { const tr = tour(snapshot.id); tr.stops = snapshot.stops; tr.optimized = snapshot.optimized; S.undo = null; render(); toast(t('undone'), '', 'info'); } }); }
function runOptimize() {
  const tr = curPlan(); if (!tr || !tr.stops.length) return;
  S.preview = null; S.optRun = { step: 0 }; S.pr = true; render(); fitTo(tr.stops);
  const tick = () => { S.optRun.step++; if (S.optRun.step < 4) { const pr = $('#pr'); if (pr) pr.innerHTML = proposalPanel(); setTimeout(tick, reduce() ? 60 : 480); }
    else { const normal = tr.stops.filter(s => !s.check), chk = tr.stops.filter(s => s.check);
      const neu = DATA.optimize(normal).concat(chk);
      S.optRun = null; S.preview = { tour: tr.id, old: tr.stops.slice(), neu, mode: 'both' }; M.newRouteAnim = !reduce(); render(); fitTo(tr.stops); } };
  setTimeout(tick, reduce() ? 60 : 480);
}
function applyOpt() { const p = S.preview; const tr = tour(p.tour); const snap = { id: tr.id, stops: tr.stops.slice(), optimized: tr.optimized }; tr.stops = p.neu; tr.optimized = true; S.preview = null; render(); setUndo(t('applied'), snap); }
function discardOpt() { S.preview = null; render(); toast(t('discarded'), '', 'info'); }
function moveStop(from, to) { const tr = curPlan(); if (from === to || to < 0 || to >= tr.stops.length) return; const snap = { id: tr.id, stops: tr.stops.slice(), optimized: tr.optimized };
  const [s] = tr.stops.splice(from, 1); tr.stops.splice(to, 0, s); render(); setUndo(t('reordered'), snap); setTimeout(() => { const r = $(`#plist .srow[data-si="${to}"]`); r && r.focus(); }, 30); }

/* ---------------- dialogs */
function dlg(html, mount) { const d = $('#dlg'); d.innerHTML = html; d.classList.add('on'); $('#scrim').classList.add('on'); mount && mount(d); setTimeout(() => { const f = d.querySelector('input,button.btn-primary'); f && f.focus(); }, 60); }
function closeDlg() { $('#dlg').classList.remove('on'); if (!$('#cmd').classList.contains('on')) $('#scrim').classList.remove('on'); }
function newTourDlg() {
  const n = TOURS.filter(x => x.day === 1).length + 6;
  dlg(`<div class="dlg-h"><span class="kpi-ic" style="background:var(--violet-soft);color:var(--violet-text)">${ic('plus', 18, 2.4)}</span><div><div class="ph-t" style="font-size:18px">${t('newTitle')}</div><div class="ph-s">${t('depot')}</div></div></div>
    <div class="dlg-b"><div class="field"><label for="nt-name">${t('tourName')}</label><input id="nt-name" value="HAN-0${n} · Südstadt · Bult"></div>
    <div class="field"><label for="nt-date">${t('tourDate')}</label><input id="nt-date" value="${t('tomorrow')}" readonly></div></div>
    <div class="dlg-f"><button class="btn btn-ghost" type="button" data-close="1">${t('cancel')}</button><button class="btn btn-primary" type="button" id="nt-go"><span class="bi">${ic('plus', 16, 2.4)}</span><span class="lbl">${t('create')}</span></button></div>`, d => {
    d.querySelector('#nt-go').onclick = () => { const name = d.querySelector('#nt-name').value.trim() || `HAN-0${n}`; const [code, ...rest] = name.split('·').map(s => s.trim());
      const id = 't' + Date.now(); TOURS.push({ id, code: code || `HAN-0${n}`, area: rest.join(' · ') || 'Hannover', key: 'sued', color: 6 + (TOURS.length % 2), driver: null, vehicle: null, day: 1, status: 'draft', optimized: false, stops: [] });
      closeDlg(); S.planTour = id; S.sel.clear(); S.preview = null; if (S.section !== 'planning') go('planning'); else render({ fit: true }); renderShell(); toast(t('created'), t('createdSub')); }; });
}
function importDlg() {
  const tr = curPlan(); const N = 86;
  const body = (state) => `<div class="dlg-h"><span class="kpi-ic" style="background:var(--cobalt-soft);color:var(--cobalt-text)">${ic('upload', 18, 2.2)}</span><div><div class="ph-t" style="font-size:18px">${t('impTitle')}</div><div class="ph-s">${tr.code} · ${t('tomorrow')}</div></div></div>
    <div class="dlg-b">${state === 0 ? `<div class="drop" id="drop">${ic('file', 34, 1.6)}<b>${t('impDrop')}</b><span class="ph-s">${t('impOr')}</span><button class="btn" type="button" id="imp-sample">${ic('file', 16)}${t('impSample')}</button></div>` :
      `<div class="file"><span class="kpi-ic" style="background:var(--mint-soft);color:var(--mint)">${ic('file', 18)}</span><div style="flex:1"><b>${t('impFile')}</b><div class="ph-s">${t('impRows', { n: N })}</div></div><span class="tag t-ok">${ic('check', 13, 2.6)}</span></div>
      <div><div class="eyebrow" style="color:var(--text-3);margin-bottom:6px">${t('impMap')}</div><div class="tbl-wrap"><table class="tbl maptbl"><thead><tr>${['colAddr', 'colZip', 'colCity', 'colParcels', 'colNote'].map(k => `<th>${t(k)}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Sallstraße 41</td><td>30171</td><td>Hannover</td><td>2</td><td>—</td></tr><tr><td>Geibelstraße 7</td><td>30173</td><td>Hannover</td><td>1</td><td>Hinterhof</td></tr><tr><td>Stolzestraße 12a</td><td>30171</td><td>Hannover</td><td>3</td><td>—</td></tr></tbody></table></div></div>
      <div class="warn" style="grid-template-columns:4px 1fr"><span class="sv" style="background:var(--amber)"></span><span style="font-size:12.5px;font-weight:600">${t('impWarn')}</span></div>`}</div>
    <div class="dlg-f"><button class="btn btn-ghost" type="button" data-close="1">${t('cancel')}</button>${state ? `<button class="btn btn-primary" type="button" id="imp-go"><span class="bi">${ic('upload', 16, 2.2)}</span><span class="lbl">${t('impGo', { n: N })}</span><span class="spin"></span><span class="ok">${ic('check', 18, 2.6)}</span></button>` : ''}</div>`;
  const mount = d => {
    const sample = d.querySelector('#imp-sample'); if (sample) sample.onclick = () => { d.innerHTML = body(1); mount(d); };
    const drop = d.querySelector('#drop'); if (drop) { drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); }); drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); toast(t('impLocal'), '', 'warn'); }); }
    const go2 = d.querySelector('#imp-go'); if (go2) go2.onclick = () => { go2.classList.add('loading'); setTimeout(() => { go2.classList.remove('loading'); go2.classList.add('done');
      setTimeout(() => { const gen = DATA.importTour(tr.code); tr.stops = gen.stops.map((s, i) => ({ ...s, id: tr.id + '-' + i })); tr.stops[7].check = true; tr.optimized = false; tr.status = 'draft';
        closeDlg(); S.sel.clear(); S.preview = null; render({ fit: true }); renderShell(); toast(t('imported', { n: tr.stops.length }), t('importedSub')); }, 500); }, 1100); };
  };
  dlg(body(0), mount);
}
function publishDlg() {
  const tr = curPlan(); if (!tr.driver || !tr.vehicle) { toast(t('needAssign'), '', 'warn'); return; }
  const d = drv(tr.driver);
  dlg(`<div class="dlg-h"><span class="kpi-ic" style="background:var(--mint-soft);color:var(--mint)">${ic('send', 18, 2.2)}</span><div><div class="ph-t" style="font-size:18px">${t('pubTitle')}</div><div class="ph-s">${tr.code} · ${veh(tr.vehicle).plate}</div></div></div>
    <div class="dlg-b"><p style="margin:0;color:var(--text-2)">${t('pubBody', { d: d.name, c: tr.code, n: tr.stops.length, date: t('tomorrow') })}</p>
    ${tr.optimized ? '' : `<div class="warn" style="grid-template-columns:4px 1fr"><span class="sv" style="background:var(--amber)"></span><span style="font-size:12.5px;font-weight:600">${t('needOpt')}</span></div>`}
    <div class="metrics"><div class="metric"><b class="num">${tr.stops.length}</b><span>${t('stops')}</span></div><div class="metric"><b class="num">${nf(tm(tr).parcels)}</b><span>${t('parcels')}</span></div><div class="metric"><b class="num">${nf(tm(tr).km, 1)}</b><span>${t('km')}</span></div><div class="metric"><b class="num">${hm(tm(tr).min)}</b><span>${t('duration')}</span></div></div></div>
    <div class="dlg-f"><button class="btn btn-ghost" type="button" data-close="1">${t('cancel')}</button><button class="btn btn-primary" type="button" id="pub-go"><span class="bi">${ic('send', 16, 2)}</span><span class="lbl">${t('pubGo')}</span><span class="spin"></span><span class="ok">${ic('check', 18, 2.6)}</span></button></div>`, dd => {
    const b = dd.querySelector('#pub-go'); b.onclick = () => { b.classList.add('loading'); setTimeout(() => { b.classList.remove('loading'); b.classList.add('done'); setTimeout(() => { tr.status = 'published'; S.sel.clear(); closeDlg(); render(); renderShell(); toast(t('pubDone'), t('pubDoneSub', { d: d.name })); }, 600); }, 1200); }; });
}

/* ---------------- theme */
function setTheme(next, ev) {
  const apply = () => { document.documentElement.dataset.theme = next; store.set('td-theme', next); const sw = $('#theme'); sw && sw.setAttribute('aria-checked', next === 'light'); };
  if (!document.startViewTransition || reduce()) { apply(); if (S.section === 'prefs') render(); return; }
  const x = ev?.clientX ?? innerWidth - 80, y = ev?.clientY ?? 30, r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const tr = document.startViewTransition(apply);
  tr.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 620, easing: 'cubic-bezier(.2,.75,.25,1)', pseudoElement: '::view-transition-new(root)' }));
  tr.finished.then(() => { if (S.section === 'prefs') render(); });
}
function setLang(l) { S.lang = l; store.set('td-lang', l); closeMenus(); renderShell(); render(); }

/* ---------------- events */
function closeMenus(except) { $$('.dd.open').forEach(d => { if (d !== except) d.classList.remove('open'); }); }
document.addEventListener('click', e => {
  const T = e.target;
  const ddBtn = T.closest('.dd > button'); if (ddBtn) { const dd = ddBtn.parentElement; const open = !dd.classList.contains('open'); closeMenus(dd); dd.classList.toggle('open', open); ddBtn.setAttribute('aria-expanded', open); return; }
  if (!T.closest('.menu')) closeMenus();
  const a = T.closest('.nav a'); if (a) { e.preventDefault(); go(a.dataset.sec); return; }
  const g = T.closest('[data-go]'); if (g) { closeMenus(); go(g.dataset.go); return; }
  const lb = T.closest('[data-lang]'); if (lb) { setLang(lb.dataset.lang); return; }
  if (T.closest('[data-newtour]')) { newTourDlg(); return; }
  if (T.closest('[data-close]') || T.closest('#scrim')) { closeDlg(); closeCmd(); return; }
  const al = T.closest('[data-alert]'); if (al) { closeMenus(); const [tid, si] = al.dataset.alert.split('|'); if (!['overview', 'live'].includes(S.section)) go('overview'); selectTour(tid, true); if (si !== '') setTimeout(() => openPop(tid, +si), 700); return; }
  const tc = T.closest('[data-tc]'); if (tc) { selectTour(tc.dataset.tc, true); return; }
  if (T.closest('#back')) { S.selTour = null; closePop(); render(); fitTo(curView.fit()); return; }
  if (T.closest('#fit-tour')) { fitTo(tour(S.selTour).stops); return; }
  if (T.closest('#contact')) { toast(t('contactToast'), drv(tour(S.selTour).driver).name, 'info'); return; }
  if (T.closest('#pop-x')) { closePop(); return; }
  const chip = T.closest('[data-chip]'); if (chip) { S.chip = chip.dataset.chip; render(); return; }
  const pt = T.closest('[data-pt]'); if (pt) { S.planTour = pt.dataset.pt; S.sel.clear(); S.preview = null; closePop(); render({ fit: true }); return; }
  const dv = T.closest('[data-drv]'); if (dv) { curPlan().driver = dv.dataset.drv; closeMenus(); render(); return; }
  const vh = T.closest('[data-veh]'); if (vh) { curPlan().vehicle = vh.dataset.veh; closeMenus(); render(); return; }
  if (T.closest('#selall')) { const tr = curPlan(); const all = tr.stops.every(s => S.sel.has(s.id)); tr.stops.forEach(s => all ? S.sel.delete(s.id) : S.sel.add(s.id)); render(); return; }
  const ck = T.closest('[data-ck]'); if (ck) { const tr = curPlan(); const id = ck.dataset.ck; const idx = tr.stops.findIndex(s => s.id === id);
    if (e.shiftKey && S.lastSel != null) { const [a2, b2] = [Math.min(S.lastSel, idx), Math.max(S.lastSel, idx)]; for (let i = a2; i <= b2; i++) S.sel.add(tr.stops[i].id); } else S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id);
    S.lastSel = idx; render(); return; }
  if (T.closest('#bulk-clear')) { S.sel.clear(); render(); return; }
  if (T.closest('#bulk-rm')) { const tr = curPlan(); const snap = { id: tr.id, stops: tr.stops.slice(), optimized: tr.optimized }; tr.stops = tr.stops.filter(s => !S.sel.has(s.id)); S.sel.clear(); render(); setUndo(t('remove') + ' · ' + (snap.stops.length - tr.stops.length), snap); return; }
  const mt = T.closest('[data-moveto]'); if (mt) { const tr = curPlan(), dest = tour(mt.dataset.moveto); const moving = tr.stops.filter(s => S.sel.has(s.id)); const snap = { id: tr.id, stops: tr.stops.slice(), optimized: tr.optimized };
    tr.stops = tr.stops.filter(s => !S.sel.has(s.id)); dest.stops = dest.stops.concat(moving); dest.optimized = false; S.sel.clear(); render(); toast(`${moving.length} → ${dest.code}`, t('notOpt'), 'ok'); return; }
  if (T.closest('#optimize')) { runOptimize(); return; }
  if (T.closest('#apply')) { applyOpt(); return; }
  if (T.closest('#discard')) { discardOpt(); return; }
  if (T.closest('#publish')) { publishDlg(); return; }
  if (T.closest('#open-import') || T.closest('#open-import2')) { if (curPlan().status === 'published') return; importDlg(); return; }
  const sr = T.closest('#plist .srow'); if (sr && !T.closest('.ck')) { const i = +sr.dataset.si; openPop(S.planTour, i); const st = curPlan().stops[i]; const [x, y] = toScreen(st.x, st.y); if (x < 0 || y < 0 || x > M.cw || y > M.ch) { fitTo([st, ...curPlan().stops.slice(Math.max(0, i - 3), i + 3)]); setTimeout(() => openPop(S.planTour, i), 700); } return; }
  const sr2 = T.closest('.panel .srow'); if (sr2 && S.selTour) { const i = +sr2.dataset.si; const st = tour(S.selTour).stops[i]; const s = M.view.w / M.cw; const [X, Y] = GEO.W([st.x, st.y]); const w = Math.min(M.view.w, 260); flyView({ x: X - w * .55, y: Y - w * M.ch / M.cw / 2, w }); setTimeout(() => openPop(S.selTour, i), 680); return; }
  const tr2 = T.closest('tr.row[data-open]'); if (tr2) { const x = tour(tr2.dataset.open); if (x.day === 1) { S.planTour = x.id; go('planning'); } else { S.selTour = x.id; go('live'); } return; }
  if (T.closest('#zin')) { zoomAt(1 / 1.5, .5, .5, true); return; }
  if (T.closest('#zout')) { zoomAt(1.5, .5, .5, true); return; }
  if (T.closest('#recenter')) { fitTo(curView.fit()); return; }
  if (T.closest('#maxmap')) { toggleMax(); return; }
  if (T.closest('#fitall')) { fitTo(visibleTours().flatMap(x => x.stops).concat([DEPOT])); return; }
  if (T.closest('#tg-l')) { S.pl = !S.pl; $('#pl').classList.toggle('hidden-l', !S.pl); T.closest('#tg-l').classList.toggle('closed', !S.pl); return; }
  if (T.closest('#tg-r')) { S.pr = !S.pr; $('#pr').classList.toggle('hidden-r', !S.pr); T.closest('#tg-r').classList.toggle('closed', !S.pr); $('.ctrl').classList.toggle('shift', S.pr); return; }
  const sb = T.closest('.seg button'); if (sb) { const sg = sb.parentElement.dataset.seg, v = sb.dataset.v; $$('button', sb.parentElement).forEach(b => b.setAttribute('aria-pressed', b === sb)); placeSeg(sb.parentElement.parentElement);
    if (sg === 'pmode') { S.preview.mode = v; renderDyn(); if (S.selStop) openPop(S.selStop.tid, S.selStop.i); }
    else if (sg === 'lang') setTimeout(() => setLang(v), 180); else if (sg === 'themeSeg') setTimeout(() => setTheme(v, e), 120); return; }
  if (T.closest('#theme')) { setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', e); return; }
  if (T.closest('#collapse')) { S.collapsed = !S.collapsed; store.set('td-collapsed', S.collapsed); $('#app').classList.toggle('collapsed', S.collapsed); setTimeout(() => { placeNav(); if (M.el.isConnected) { measure(); applyView(); } }, 360); return; }
  if (T.closest('#mnav')) { $('#app').classList.toggle('mnav'); return; }
  if (T.closest('#open-cmd')) { openCmd(); return; }
  if (T.closest('#markread')) { $$('.badge-dot').forEach(b => b.remove()); closeMenus(); return; }
  if (T.closest('#signout')) { closeMenus(); toast(t('signOut'), t('soonTitle'), 'info'); return; }
});
document.addEventListener('pointerover', e => { const c = e.target.closest && e.target.closest('[data-tc]'); const id = c ? c.dataset.tc : null; if (id !== S.hoverTour && (id || S.hoverTour)) { S.hoverTour = id; if (M.el && M.el.isConnected) renderDyn(); } });
document.addEventListener('input', e => { if (e.target.id === 'tq') { S.q = e.target.value; const pos = e.target.selectionStart; const pl = $('#pl'); pl.innerHTML = overviewPanelLeft(); kick(pl); const i = $('#tq'); i.focus(); i.setSelectionRange(pos, pos); } });
document.addEventListener('change', e => {
  if (e.target.id === 'p-mot') { S.motion = e.target.checked; store.set('td-motion', S.motion); document.documentElement.classList.toggle('calm', S.motion); toast(t('savedT')); }
  if (e.target.id === 'p-env') { S.envHint = e.target.checked; store.set('td-env', S.envHint); renderShell(); toast(t('savedT')); }
});
/* drag & drop reorder */
let dragFrom = null;
document.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('#plist .srow'); if (!r) return; dragFrom = +r.dataset.si; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch {} });
document.addEventListener('dragover', e => { const r = e.target.closest && e.target.closest('#plist .srow'); if (dragFrom == null || !r) return; e.preventDefault(); $$('#plist .drop-before').forEach(x => x.classList.remove('drop-before')); r.classList.add('drop-before'); });
document.addEventListener('drop', e => { const r = e.target.closest && e.target.closest('#plist .srow'); if (dragFrom == null || !r) return; e.preventDefault(); let to = +r.dataset.si; if (to > dragFrom) to -= 1; const f = dragFrom; dragFrom = null; moveStop(f, to); });
document.addEventListener('dragend', () => { dragFrom = null; $$('#plist .dragging,#plist .drop-before').forEach(x => x.classList.remove('dragging', 'drop-before')); });
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmd(); return; }
  if (e.key === 'Escape' && S.max && !$('#dlg').classList.contains('on')) { toggleMax(); return; }
  if (e.key === 'Escape') { closeMenus(); closeCmd(); closeDlg(); closePop(); $('#app').classList.remove('mnav'); }
  const r = e.target.closest && e.target.closest('#plist .srow'); if (r && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); const i = +r.dataset.si; moveStop(i, i + (e.key === 'ArrowUp' ? -1 : 1)); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.srow, tr.row, .pill-demo, .mstat')) { e.preventDefault(); e.target.click(); }
});
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { placeSeg(); if (M.el && M.el.isConnected) { measure(); applyView(); } }, 120); });
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== S.section && VIEWS[h]) go(h); });

/* ---------------- command palette */
let cmdSel = 0, cmdItems = [];
function cmdData() { return [...Object.keys(VIEWS).map(k => ({ ic: k, label: t(k), k: t('cmdGo'), run: () => go(k) })),
  ...TOURS.map(x => ({ ic: 'tours', label: `${x.code} · ${x.area}`, k: x.day ? t('planning') : (drv(x.driver)?.name || ''), run: () => { if (x.day) { S.planTour = x.id; go('planning'); } else { if (!['overview', 'live'].includes(S.section)) go('overview'); selectTour(x.id, true); } } })),
  { ic: 'sun', label: t('cmdTheme'), k: '', run: () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light') },
  ...[['de', 'Deutsch'], ['en', 'English'], ['ar', 'العربية']].filter(([c]) => c !== S.lang).map(([c, n]) => ({ ic: 'globe', label: `${t('cmdLang')}: ${n}`, k: '', run: () => setLang(c) }))]; }
function openCmd() { $('#scrim').classList.add('on'); $('#cmd').classList.add('on'); const i = $('#cmd-in'); i.placeholder = t('cmdPh'); i.value = ''; cmdSel = 0; drawCmd(''); setTimeout(() => i.focus(), 30); }
function closeCmd() { $('#cmd').classList.remove('on'); if (!$('#dlg').classList.contains('on')) $('#scrim').classList.remove('on'); }
function drawCmd(q) { cmdItems = cmdData().filter(x => x.label.toLowerCase().includes(q.toLowerCase())); cmdSel = Math.min(cmdSel, Math.max(0, cmdItems.length - 1));
  $('#cmd-list').innerHTML = cmdItems.map((x, i) => `<button class="cmd-item" type="button" data-i="${i}" aria-selected="${i === cmdSel}">${ic(x.ic, 18)}${x.label}<span class="k">${x.k}</span></button>`).join(''); }
$('#cmd-in').addEventListener('input', e => { cmdSel = 0; drawCmd(e.target.value); });
$('#cmd-in').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { cmdSel = Math.min(cmdItems.length - 1, cmdSel + 1); drawCmd(e.target.value); e.preventDefault(); } if (e.key === 'ArrowUp') { cmdSel = Math.max(0, cmdSel - 1); drawCmd(e.target.value); e.preventDefault(); } if (e.key === 'Enter' && cmdItems[cmdSel]) { const it = cmdItems[cmdSel]; closeCmd(); it.run(); } });
$('#cmd-list').addEventListener('click', e => { const b = e.target.closest('.cmd-item'); if (!b) return; const it = cmdItems[+b.dataset.i]; closeCmd(); it.run(); });

/* ---------------- boot */
TOURS.find(x => x.id === 't6').stops[12].check = true;
if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = store.get('td-theme', 'dark');
document.documentElement.classList.toggle('calm', S.motion);
const h0 = location.hash.slice(1); if (VIEWS[h0]) S.section = h0;
mapInit(); renderShell(); render({ nav: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { placeSeg(); placeNav(); });
})();
