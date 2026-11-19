/* RÓTULO DE LAS LÁMINAS
   rotuloSvg(): el rótulo que llevan todos los planos (logo, datos del proyecto, plano, fecha y número de lámina). */
/* Rótulo de las láminas (unifilar y alturas): logo, datos del proyecto, plano y número de lámina, dentro del
   recuadro x, y, w, h. El logo vectorial (oculto en pantalla) es el que usa el DXF. */
function rotuloSvg(o, rx, yr, rw, hr, P, plano, lamina) {
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
