/* Stylized Hannover vector map. Coordinates in km relative to Kröpcke (x east, y south), world units = km*100. */
const GEO = (() => {
  const W = v => [(v[0] + 5.5) * 100, (v[1] + 6.5) * 100];
  const pts = a => a.map(W).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const path = (a) => { const p = a.map(W); let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; d += ` Q${p[i][0].toFixed(1)},${p[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`; }
    const l = p[p.length - 1]; return d + ` L${l[0].toFixed(1)},${l[1].toFixed(1)}`; };
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // regions: [x0,y0,x1,y1, angleDeg, spacingKm]
  const REG = [
    [-0.7, -0.9, 1.0, 1.0, 12, .12], [0.6, -3.1, 1.9, -0.3, -8, .16], [-1.9, -3.3, 0.5, -0.6, 22, .15], [-3.1, -0.5, -0.5, 2.6, -14, .14],
    [0.2, 0.9, 2.7, 4.3, 6, .15], [-1.6, -5.1, 2.6, -3.0, 2, .21], [3.7, -4.6, 7.5, 4.0, 28, .22], [-5.5, 2.4, -0.4, 6.5, -24, .24],
    [0.7, 4.0, 4.6, 6.5, 10, .2], [-5.5, -5.0, -1.8, -0.4, 38, .25], [-5.5, -0.5, -3.0, 2.5, 4, .26], [1.8, -3.0, 3.8, 4.0, 18, .2],
    [-5.5, -6.5, 7.5, -5.3, 0, .32], [2.5, -5.3, 3.8, -3.0, -10, .22],
    [-16, -16, -5.5, 16, 15, .42], [7.5, -16, 20, 16, -12, .42], [-5.5, -16, 7.5, -6.5, 5, .42], [-5.5, 6.5, 7.5, 16, -8, .42]
  ];
  const EILENRIEDE = [[1.55, 1.25], [1.65, -0.2], [1.95, -1.4], [2.6, -2.3], [3.5, -2.75], [4.25, -2.2], [4.15, -0.9], [3.6, 0.4], [3.0, 1.35], [2.2, 1.6]];
  const PARKS = [EILENRIEDE,
    [[-2.75, -1.85], [-1.95, -1.85], [-1.95, -2.65], [-2.75, -2.65]],
    [[-1.9, -1.7], [-1.05, -1.75], [-1.0, -2.9], [-1.7, -3.2], [-2.0, -2.6]],
    [[-0.05, 0.62], [0.42, 0.6], [0.45, 1.08], [-0.02, 1.1]],
    [[0.55, 3.0], [1.25, 2.95], [1.3, 3.8], [0.6, 3.85]],
    [[-1.2, 1.3], [-0.55, 1.2], [-0.35, 2.6], [-0.9, 2.9], [-1.25, 2.2]],
    [[5.3, 0.1], [6.9, -0.1], [7.2, 1.0], [5.5, 1.1]],
    [[-4.6, 3.4], [-3.4, 3.2], [-3.2, 4.2], [-4.4, 4.5]]];
  const MASCHSEE = [[0.05, 1.18], [0.42, 1.22], [0.62, 1.6], [0.6, 2.2], [0.46, 2.55], [0.22, 2.48], [0.1, 1.95], [0.0, 1.5]];
  const LEINE = [[-0.6, 6.5], [-0.45, 4.2], [-0.2, 2.7], [-0.2, 1.5], [-0.45, 0.45], [-0.6, -0.3], [-1.0, -1.2], [-1.55, -2.1], [-2.2, -3.0], [-3.2, -3.8], [-4.4, -4.5], [-5.5, -4.9]];
  const IHME = [[-1.9, 6.5], [-1.5, 4.0], [-1.25, 2.6], [-0.95, 1.4], [-0.75, 0.55], [-0.6, -0.25]];
  const CANAL = [[-5.5, -5.75], [-3.2, -5.3], [-1.0, -5.05], [1.0, -5.4], [3.0, -5.65], [5.0, -5.25], [7.5, -4.7]];
  const RAIL = [[[-5.5, -1.05], [-2.5, -0.75], [-0.6, -0.45], [0.17, -0.25], [1.4, 0.15], [3.2, 0.55], [7.5, 1.1]], [[0.17, -0.25], [0.4, -1.6], [0.75, -3.4], [1.0, -6.5]], [[0.17, -0.25], [0.95, 1.2], [1.3, 3.4], [1.7, 6.5]]];
  const MOTOR = [
    ['Westschnellweg', [[-2.6, 6.5], [-2.45, 3.0], [-2.35, 0.6], [-2.6, -1.5], [-3.0, -3.5], [-3.3, -6.5]]],
    ['Messeschnellweg', [[4.65, 6.5], [4.5, 3.5], [4.4, 1.0], [4.7, -1.5], [5.2, -4.0], [5.6, -6.5]]],
    ['Südschnellweg', [[-5.5, 4.65], [-2.45, 4.45], [0.5, 4.6], [3.0, 4.3], [4.5, 4.05], [7.5, 4.25]]]];
  const MAJOR = [
    ['Hildesheimer Str.', [[0.25, 0.35], [0.8, 1.5], [1.1, 3.0], [1.45, 4.6], [1.9, 6.5]]],
    ['Vahrenwalder Str.', [[0.3, -0.55], [0.5, -2.0], [0.7, -3.5], [0.9, -5.5], [1.1, -6.5]]],
    ['Podbielskistr.', [[0.85, -1.45], [1.9, -2.55], [3.2, -3.25], [4.9, -3.8], [7.5, -4.3]]],
    ['Limmerstr.', [[-0.6, -0.2], [-2.0, -0.05], [-3.5, 0.25], [-5.5, 0.5]]],
    ['Marienstr.', [[0.4, 0.2], [1.5, 0.6], [3.0, 1.15], [4.4, 1.1], [7.5, 1.6]]],
    ['Göttinger Chaussee', [[-0.75, 1.0], [-1.5, 2.5], [-2.2, 4.4], [-3.0, 6.5]]],
    ['Engelbosteler Damm', [[-0.35, -0.6], [-0.75, -2.2], [-1.1, -3.6], [-1.5, -5.3]]],
    ['Friedrichswall', [[-0.6, 0.5], [0.0, 0.55], [0.55, 0.42], [0.9, 0.0], [0.7, -0.6], [0.0, -0.8], [-0.6, -0.3]]],
    ['Kirchröder Str.', [[3.3, 0.75], [5.0, 0.6], [7.5, 0.85]]],
    ['Bödekerstr.', [[0.75, -0.6], [1.45, -0.35], [2.2, -0.9]]],
    ['Stöckener Str.', [[-1.55, -2.1], [-2.6, -3.2], [-3.6, -4.6], [-4.3, -6.5]]],
    ['Sutelstr.', [[3.3, -3.2], [3.9, -1.8], [4.6, -1.5]]]];
  const DISTRICTS = [['Mitte', 0.15, 0.15], ['List', 1.15, -2.3], ['Oststadt', 1.05, -0.85], ['Südstadt', 1.55, 2.05], ['Linden', -1.75, 0.55], ['Nordstadt', -0.95, -1.55],
    ['Vahrenwald', 0.15, -3.55], ['Herrenhausen', -3.2, -2.9], ['Kleefeld', 5.2, -0.2], ['Groß-Buchholz', 5.6, -2.6], ['Döhren', 2.2, 5.0], ['Ricklingen', -2.9, 2.8], ['Bothfeld', 3.4, -4.6], ['Calenberger Neustadt', -0.9, 0.05]];
  const LANDMARKS = [['Maschsee', 0.3, 1.9, 'w'], ['Eilenriede', 2.9, -0.6, 'p'], ['Mittellandkanal', -2.2, -5.05, 'w'], ['Leine', -0.33, 3.4, 'w'], ['Herrenhäuser Gärten', -2.35, -2.25, 'p'], ['Hauptbahnhof', 0.17, -0.25, 'r'], ['Ihme', -1.32, 2.9, 'w'], ['Georgengarten', -1.45, -2.45, 'p'], ['Maschpark', 0.2, 0.86, 'p'], ['Stadtfriedhof Engesohde', 0.92, 3.42, 'p'], ['Hermann-Löns-Park', 6.2, 0.5, 'p'], ['Ricklinger Teiche', -0.85, 2.05, 'p']];

  function streets() {
    const r = rng(42); let out = '', clips = '';
    REG.forEach((g, i) => {
      const [x0, y0, x1, y1, ang, sp] = g; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + .2;
      const a = ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const id = 'rg' + i; const [X0, Y0] = W([x0, y0]), [X1, Y1] = W([x1, y1]);
      clips += `<clipPath id="${id}"><rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}"/></clipPath>`;
      let d = '';
      for (const dir of [0, 1]) for (let o = -R; o <= R; o += sp * (dir ? 1.35 : 1)) {
        let s = -R;
        while (s < R) { const len = .25 + r() * 1.1; const e = Math.min(R, s + len);
          if (r() > .14) { const p = (u) => { const lx = dir ? o : u, ly = dir ? u : o; return W([cx + lx * ca - ly * sa, cy + lx * sa + ly * ca]); };
            const A = p(s), B = p(e); d += `M${A[0].toFixed(1)},${A[1].toFixed(1)}L${B[0].toFixed(1)},${B[1].toFixed(1)}`; }
          s = e + (r() < .25 ? sp * .9 : 0); }
      }
      if (i < 14) { let b = ''; const r2 = rng(900 + i);
        for (let o = -R; o < R; o += sp) for (let u = -R; u < R; u += sp * 1.35) { if (r2() < .22) continue;
          const ins = .17 + r2() * .08, u0 = u + sp * 1.35 * ins, u1 = u + sp * 1.35 * (1 - ins), o0 = o + sp * ins, o1 = o + sp * (1 - ins);
          const q = (uu, oo) => W([cx + uu * ca - oo * sa, cy + uu * sa + oo * ca]);
          const A = q(u0, o0), B = q(u1, o0), C = q(u1, o1), D = q(u0, o1);
          b += `M${A[0].toFixed(1)},${A[1].toFixed(1)}L${B[0].toFixed(1)},${B[1].toFixed(1)}L${C[0].toFixed(1)},${C[1].toFixed(1)}L${D[0].toFixed(1)},${D[1].toFixed(1)}Z`; }
        out = `<path clip-path="url(#${id})" d="${b}" class="m-bldg"/>` + out; }
      out += `<path clip-path="url(#${id})" d="${d}" class="m-st"/>`;
    });
    return { clips, out };
  }
  function base() {
    const st = streets();
    let g = `<defs>${st.clips}</defs><rect x="-1200" y="-1200" width="3700" height="3700" class="m-bg"/>${st.out}`;
    g += PARKS.map(p => `<path d="${path([...p, p[0], p[1]])}Z" class="m-park"/>`).join('');
    g += `<path d="${path(LEINE)}" class="m-river"/><path d="${path(IHME)}" class="m-river" style="stroke-width:3.2"/><path d="${path(CANAL)}" class="m-river" style="stroke-width:6"/>`;
    g += `<polygon points="${pts(MASCHSEE)}" class="m-water"/>`;
    g += RAIL.map(r => `<path d="${path(r)}" class="m-rail"/>`).join('');
    g += MAJOR.map(([, a]) => `<path d="${path(a)}" class="m-maj-c"/>`).join('') + MAJOR.map(([, a]) => `<path d="${path(a)}" class="m-maj"/>`).join('');
    g += MOTOR.map(([, a]) => `<path d="${path(a)}" class="m-mot-c"/>`).join('') + MOTOR.map(([, a]) => `<path d="${path(a)}" class="m-mot"/>`).join('');
    return g;
  }
  function labels(s, zoomed) {
    // s = world units per screen px
    let o = '';
    const fs = (px) => (px * s).toFixed(2);
    DISTRICTS.forEach(([n, x, y]) => { if (!zoomed && n === 'Calenberger Neustadt') return; const [X, Y] = W([x, y]);
      o += `<text x="${X}" y="${Y}" class="m-dl" style="font-size:${fs(10.5)}px;letter-spacing:${fs(1.6)}px;stroke-width:${fs(3)}px" text-anchor="middle">${n.toUpperCase()}</text>`; });
    LANDMARKS.forEach(([n, x, y, k]) => { const [X, Y] = W([x, y]);
      o += `<text x="${X}" y="${Y + (k === 'r' ? -9 * s : 0)}" class="m-lm ${k}" style="font-size:${fs(k === 'r' ? 10.5 : 11.5)}px;stroke-width:${fs(3)}px" text-anchor="middle">${n}</text>`;
      if (k === 'r') o += `<rect x="${X - 4.5 * s}" y="${Y - 4.5 * s}" width="${9 * s}" height="${9 * s}" rx="${2 * s}" class="m-hbf" style="stroke-width:${fs(1.5)}px"/>`; });
    if (zoomed) MAJOR.forEach(([n, a]) => { const m = W(a[Math.floor(a.length / 2)]); o += `<text x="${m[0]}" y="${m[1]}" class="m-sl" style="font-size:${fs(9.5)}px;stroke-width:${fs(3)}px" text-anchor="middle">${n}</text>`; });
    MOTOR.forEach(([n, a]) => { const m = W(a[2]); o += `<g><rect x="${m[0] - 34 * s}" y="${m[1] - 8 * s}" width="${68 * s}" height="${16 * s}" rx="${4 * s}" class="m-shield" style="stroke-width:${fs(1)}px"/><text x="${m[0]}" y="${m[1] + 3.5 * s}" class="m-shield-t" style="font-size:${fs(9)}px" text-anchor="middle">${n}</text></g>`; });
    return o;
  }
  return { W, base, labels, rng, REG };
})();
