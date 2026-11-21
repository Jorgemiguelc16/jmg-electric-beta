/* RÓTULO DE LAS LÁMINAS
   rotuloSvg(): el rótulo que llevan todos los planos (logo, datos del proyecto, plano, fecha y número de lámina). */
/* Rótulo de las láminas (unifilar y alturas): logo, datos del proyecto, plano y número de lámina, dentro del
   recuadro x, y, w, h. El logo vectorial (oculto en pantalla) es el que usa el DXF. */
/* Número de lámina corrido: en el expediente, cuando van primero las láminas de planta del diseño, las que genera la
   plataforma (IE-01 unifilar, IE-02 alturas…) siguen después. ROT_DESP es cuánto se corren (0 fuera del expediente). */
let ROT_DESP = 0;
const ieNum = s =>
  ROT_DESP ? String(s).replace(/^IE-(\d+)/, (m, n) => "IE-" + String(+n + ROT_DESP).padStart(2, "0")) : s;
function rotuloSvg(o, rx, yr, rw, hr, P, plano, lamina) {
  lamina = ieNum(lamina);
  const { INK } = PAL;
  const L = (x1, y1, x2, y2, w = 1.3, col = INK) =>
    o.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}"/>`);
  const T = (x, y, t, { s = 9, b = 0, a = "start", f = INK } = {}) =>
    o.push(
      `<text x="${x}" y="${y}" font-size="${s}"${b ? ' font-weight="700"' : ""} text-anchor="${a}" fill="${f}">${esc(t)}</text>`
    );
  const LY = "#ffd200",
    LB = "#1f2328",
    { CU, NAVY } = PAL;
  o.push(`<g data-capa="E-ROTULO">`);
  o.push(`<rect x="${rx}" y="${yr}" width="110" height="${hr}" fill="${LB}"/>`);
  if (typeof LOGO_JPG === "string")
    o.push(
      `<image x="${rx}" y="${yr}" width="110" height="${hr}" href="${LOGO_JPG}" preserveAspectRatio="xMidYMid slice"/>`
    );
  o.push(`<g display="none" data-dxf="logo">`);
  // Logo dibujado con figuras rellenas, medido sobre la imagen del logo (200 × 200): así se ve igual en cualquier
  // AutoCAD, sin depender de la fuente. Letras «JMG» de bloques y el rayo amarillo dentro de la M
  {
    // Misma escala que la imagen en pantalla: cubre la caja de 110 de ancho por el alto del rótulo
    const e = Math.max(110, hr) / 200,
      x0 = rx + 55 - 100 * e,
      y0 = yr + hr / 2 - 100 * e,
      fig = pts =>
        o.push(
          `<path d="${pts.map(([u, v], n) => `${n ? "L" : "M"}${px2(x0 + u * e)} ${px2(y0 + v * e)}`).join("")}Z" fill="${LY}"/>`
        ),
      caja = (u1, v1, u2, v2) =>
        fig([
          [u1, v1],
          [u2, v1],
          [u2, v2],
          [u1, v2]
        ]);
    // J
    caja(46.9, 61, 62.3, 121.3);
    caja(17.8, 106.6, 46.9, 121.3);
    caja(17.8, 96, 32.9, 106.6);
    // M: trazos verticales, brazo izquierdo y arranque del derecho
    caja(68.1, 61, 83.1, 121.3);
    fig([
      [68.1, 61],
      [86.3, 61],
      [95, 77.5],
      [83.1, 90]
    ]);
    caja(111.9, 61, 126.9, 121.3);
    fig([
      [109.4, 61],
      [111.9, 61],
      [111.9, 85.6]
    ]);
    // Rayo
    fig([
      [98.1, 61.5],
      [108.8, 61.3],
      [104.6, 85]
    ]);
    fig([
      [98.1, 61.5],
      [104.6, 85],
      [96, 96.3],
      [86.9, 96.3]
    ]);
    fig([
      [104.6, 85],
      [110, 88.1],
      [96, 96.3]
    ]);
    fig([
      [96, 96.3],
      [110, 88.1],
      [90.3, 120]
    ]);
    // G
    caja(133.1, 61, 148.1, 121.3);
    caja(148.1, 61, 182.5, 75);
    caja(156.3, 85, 182.5, 99.4);
    caja(166.9, 99.4, 182.5, 106.6);
    caja(148.1, 106.6, 182.5, 121.3);
    T(x0 + 100 * e, y0 + 140 * e, "PROJECTS & ENERGY", { s: 8, b: 1, a: "middle", f: LY });
  }
  o.push(`</g>`);
  const rot = [
    ["PROYECTO", P.nombre || "—"],
    ["PROPIETARIO", P.prop || "—"],
    ["UBICACIÓN", P.ubic || "—"],
    ["PROYECTISTA", (P.proy || "—") + (P.cip ? ` · CIP ${P.cip}` : "")],
    ["PLANO", plano],
    [
      "FECHA · LÁMINA",
      `${new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })} · ${lamina}`
    ]
  ];
  rot.forEach(([k, v], i) => {
    const yy = yr + (i * hr) / 6;
    if (i) L(rx + 110, yy, rx + rw, yy, 0.8, "#bfc8d2");
    T(rx + 118, yy + 12.5, k, { s: 7, b: 1, f: CU });
    T(rx + 205, yy + 12.5, String(v).slice(0, Math.max(20, Math.floor((rw - 215) / 4.6))), {
      s: 8.5,
      b: i === 0 || i === 4,
      f: i === 0 || i === 4 ? NAVY : INK
    });
  });
  o.push(`<rect x="${rx}" y="${yr}" width="${rw}" height="${hr}" fill="none" stroke="${NAVY}" stroke-width="1"/>`);
  o.push(`</g>`);
}

/* Rótulo de las láminas del diseño (js/editor/laminas.js), en milímetros de papel y proporcional al papel (k: 1 en A2
   y A1, menor en A3 y A4). Casillas con su nombre arriba y el dato debajo: proyecto, propietario, ubicación, plano y
   especialidad, proyectista con su CIP y el espacio para la firma y el sello, escala, fecha y lámina. q pasa de mm a
   unidades del SVG. d = { plano, esc, num, de, k } */
function rotuloLamina(o, q, x, y, w, h, P, d) {
  const { INK, NAVY, CU } = PAL,
    k = d.k || 1,
    L = (x1, y1, x2, y2, g = 0.18) =>
      o.push(`<line x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}" stroke="${NAVY}" stroke-width="${q(g)}"/>`),
    // Texto que cabe en su ancho: se parte en dos líneas si hay alto, si no se achica (hasta 60 %) y se corta
    T = (t, x0, y0, ancho, fs, { b = 0, a = "start", col = INK, alto = 0 } = {}) => {
      t = String(t || "—");
      const cw = 0.56,
        cabe = (s, f) => s.length * f * cw <= ancho;
      let ls = [t],
        f = fs;
      if (!cabe(t, f) && alto >= fs * 2.3) {
        const ps = t.split(" "),
          l1 = [];
        while (ps.length && cabe([...l1, ps[0]].join(" "), f)) l1.push(ps.shift());
        if (l1.length && ps.length) ls = [l1.join(" "), ps.join(" ")];
      }
      const mx = Math.max(...ls.map(s => s.length));
      if (mx * f * cw > ancho) f = Math.max(fs * 0.6, ancho / (mx * cw));
      ls = ls.map(s =>
        s.length * f * cw > ancho ? s.slice(0, Math.max(3, Math.floor(ancho / (f * cw)) - 1)) + "…" : s
      );
      const xx = a === "middle" ? x0 + ancho / 2 : x0,
        y1 = y0 - ((ls.length - 1) * f * 1.15) / 2;
      ls.forEach((s, i) =>
        o.push(
          `<text x="${q(xx)}" y="${q(y1 + i * f * 1.15)}" font-size="${q(f)}"${b ? ' font-weight="700"' : ""} text-anchor="${a}" dominant-baseline="central" fill="${col}">${esc(s)}</text>`
        )
      );
    },
    // Casilla: nombre arriba a la izquierda y dato centrado en lo que queda
    C = (x0, y0, cw, ch, et, v, op = {}) => {
      const fe = 1.55 * k,
        p = 1.4 * k;
      o.push(
        `<text x="${q(x0 + p)}" y="${q(y0 + p + fe * 0.8)}" font-size="${q(fe)}" font-weight="700" letter-spacing="${q(0.08 * k)}" fill="${CU}">${esc(et)}</text>`
      );
      const top = y0 + p + fe * 1.3;
      T(v, x0 + p, (top + y0 + ch) / 2, cw - 2 * p, (op.fs || 2.5) * k, { ...op, alto: y0 + ch - top - p });
    };
  o.push(`<g data-capa="E-ROTULO">`);
  // Filas (fracciones del alto): proyecto, propietario, ubicación | plano y especialidad | proyectista y firma | escala, fecha y lámina
  const f = [0.2, 0.12, 0.12, 0.18, 0.2, 0.18].map(v => v * h),
    yy = f.reduce((a, v) => (a.push(a[a.length - 1] + v), a), [y]),
    lw = w * 0.25;
  // Logo
  o.push(`<rect x="${q(x)}" y="${q(y)}" width="${q(lw)}" height="${q(yy[3] - y)}" fill="#0b0b0b"/>`);
  if (typeof LOGO_JPG === "string")
    o.push(
      `<image x="${q(x)}" y="${q(y)}" width="${q(lw)}" height="${q(yy[3] - y)}" href="${LOGO_JPG}" preserveAspectRatio="xMidYMid slice"/>`
    );
  C(x + lw, yy[0], w - lw, f[0], "PROYECTO", P.nombre, { b: 1, col: NAVY, fs: 3.1 });
  C(x + lw, yy[1], w - lw, f[1], "PROPIETARIO", P.prop);
  C(x + lw, yy[2], w - lw, f[2], "UBICACIÓN", P.ubic);
  const pw = w * 0.66;
  C(x, yy[3], pw, f[3], "PLANO", d.plano, { b: 1, col: NAVY, fs: 2.9 });
  C(x + pw, yy[3], w - pw, f[3], "ESPECIALIDAD", "INSTALACIONES ELÉCTRICAS", { b: 1, fs: 2.3 });
  const fw = w * 0.58;
  C(x, yy[4], fw, f[4] / 2, "PROYECTISTA", P.proy);
  C(x, yy[4] + f[4] / 2, fw, f[4] / 2, "REG. CIP N.°", P.cip || "");
  C(x + fw, yy[4], w - fw, f[4], "FIRMA Y SELLO", " ");
  const ew = w * 0.22,
    dw = w * 0.34;
  C(x, yy[5], ew, f[5], "ESCALA", d.esc, { b: 1, fs: 3 });
  C(
    x + ew,
    yy[5],
    dw,
    f[5],
    "FECHA",
    new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" }).toUpperCase(),
    { fs: 2.4 }
  );
  C(x + ew + dw, yy[5], w - ew - dw, f[5], d.de ? `LÁMINA · ${d.de}` : "LÁMINA", d.num, { b: 1, col: NAVY, fs: 6 });
  // Divisiones
  [1, 2].forEach(i => L(x + lw, yy[i], x + w, yy[i]));
  [3, 4, 5].forEach(i => L(x, yy[i], x + w, yy[i], 0.3));
  L(x + w * 0.58, yy[4] + 0, x + w * 0.58, yy[5]);
  L(x, yy[4] + f[4] / 2, x + fw, yy[4] + f[4] / 2);
  L(x + lw, y, x + lw, yy[3], 0.3);
  L(x + pw, yy[3], x + pw, yy[4]);
  L(x + ew, yy[5], x + ew, yy[6]);
  L(x + ew + dw, yy[5], x + ew + dw, yy[6]);
  o.push(
    `<rect x="${q(x)}" y="${q(y)}" width="${q(w)}" height="${q(h)}" fill="none" stroke="${NAVY}" stroke-width="${q(0.5)}"/>`
  );
  o.push(`</g>`);
}
