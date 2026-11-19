/* DIAGRAMA DE ALTURAS DE MONTAJE
   Elevación típica de muro con las salidas que tiene el proyecto (según sus circuitos), agrupadas por zonas y cada
   una sobre la línea de su nivel desde el piso terminado (NPT); a la derecha, la leyenda con el símbolo, el código
   DGE, la altura y la verificación con la A.120; abajo, notas y rótulo. Símbolos de la Norma DGE «Símbolos gráficos
   en electricidad» (R.M. N.° 091-2002-EM/VME, sección 093), redibujados conservando sus proporciones. Las alturas
   son parámetros del proyecto (Parámetros › Alturas). Usa solo líneas, rectángulos, círculos, triángulos y textos,
   para que svgDxf() lo pase a AutoCAD igual que el unifilar. Los símbolos de la leyenda están en js/planos/simbolos.js. */
// Límites de la A.120: interruptores y timbres hasta 1.35 m (Art. 11 d); alcance frontal de 0.40 a 1.20 m (Art. 10)
const A120 = { int: [0, 1.35, "Art. 11 d"], toma: [0.4, 1.2, "Art. 10"] };
// Zona de cada salida, en el orden en que se dibujan
const ZONA_ALT = {
  med: "Medición y tablero",
  tab: "Medición y tablero",
  int: "Alumbrado",
  braq: "Alumbrado",
  luz: "Alumbrado",
  emer: "Alumbrado",
  toma: "Tomacorrientes",
  tomaC: "Tomacorrientes",
  terma: "Fuerza y equipos",
  coc: "Fuerza y equipos",
  aire: "Fuerza y equipos",
  fza: "Fuerza y equipos",
  itc: "Comunicaciones"
};
// Salidas del proyecto, en el orden en que se dibujan, con su altura (m) y el límite de la A.120 si lo tiene
function salidasAltura(r) {
  const a = r.c.alt,
    tx = r.circ.map(q => `${q.tipo} ${q.desc}`.toLowerCase()),
    hay = re => tx.some(t => re.test(t)),
    S = [];
  const add = (k, nom, corto, cod, h, chk) => S.push({ k, nom, corto, cod, h, chk, z: ZONA_ALT[k] });
  // Tomacorriente monofásico con tierra (09-93-17) o trifásico (09-93-15), según los circuitos de esa salida
  const fases = re =>
    r.circ.some(q => q.f3 && re.test(`${q.tipo} ${q.desc}`.toLowerCase())) ? "09-93-15" : "09-93-17";
  const alum = hay(/alumbrado|iluminaci[oó]n(?! de emergencia)/);
  add(
    "med",
    r.mode === "multi" ? "Banco de medidores (eje de la caja)" : "Medidor de energía (eje de la caja)",
    "Medidor",
    "08-80-22",
    a.med
  );
  add("tab", "Tablero de distribución (borde superior)", "Tablero", "09-91-17", a.tab);
  if (alum) {
    add("int", "Interruptor de alumbrado", "Interruptor", "09-93-30", a.int, A120.int);
    add("braq", "Salida de alumbrado en pared (braquete)", "Braquete", "09-93-52", a.braq);
    add("luz", "Salida de alumbrado en techo (centro de luz)", "Centro de luz", "09-93-51", a.techo);
  }
  if (hay(/emergencia/)) add("emer", "Luminaria de emergencia", "Emergencia", "09-93-67", a.braq);
  if (tx.some(t => /tomacorriente/.test(t) && !/cocina|lavander/.test(t)))
    add("toma", "Tomacorriente con toma de tierra", "Tomacorriente", "09-93-17", a.toma, A120.toma);
  if (hay(/tomacorriente.*(cocina|lavander)/))
    add("tomaC", "Tomacorriente de cocina y lavandería", "Toma de cocina", "09-93-17", a.tomaC, A120.toma);
  if (hay(/calentador|ducha|terma/))
    add("terma", "Salida para terma o ducha eléctrica", "Terma o ducha", "09-93-69", a.terma);
  if (hay(/cocina el[eé]ctrica/)) add("coc", "Salida para cocina eléctrica", "Cocina", "09-93-18", a.fza);
  if (hay(/aire acondicionado/))
    add("aire", "Salida para aire acondicionado", "Aire acond.", fases(/aire acondicionado/), a.aire);
  const esFza = q => /^(motor|otra carga)/i.test(q.tipo) && !/alumbrado|intercomunicador|portero/i.test(q.desc);
  if (r.circ.some(esFza))
    add(
      "fza",
      "Salida de fuerza (motor u otra carga)",
      "Fuerza",
      r.circ.some(q => esFza(q) && q.f3) ? "09-93-15" : "09-93-17",
      a.fza
    );
  if (hay(/intercomunicador|portero/))
    add("itc", "Intercomunicador (interfono)", "Interfono", "09-93-73", a.int, A120.int);
  return S;
}
// ¿Rige la A.120 en esta edificación? (Art. 2: atención al público y áreas comunes de edificios con ascensor)
function a120Aplica(r) {
  return r.viv === false ? "si" : r.mode === "multi" ? "comun" : "no";
}
function alturas(r) {
  const c = r.c,
    a = c.alt,
    o = [],
    S = salidasAltura(r),
    rige = a120Aplica(r);
  const { INK, NAVY, CU, GR, LN } = PAL,
    W = 1123;
  // Línea; en el DXF, los niveles (punteados) y la tubería (cobre) van en sus propias capas
  const L = (x1, y1, x2, y2, w = 1.3, col = INK, dash) =>
    o.push(
      `<line x1="${px2(x1)}" y1="${px2(y1)}" x2="${px2(x2)}" y2="${px2(y2)}" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}" data-capa="E-NIVELES"` : col === CU ? ' data-capa="E-TUBERIA"' : ""}/>`
    );
  const T = (x, y, t, { s = 9, b = 0, a = "start", f = INK, rot = 0 } = {}) =>
    o.push(
      `<text x="${px2(x)}" y="${px2(y)}" font-size="${s}"${b ? ' font-weight="700"' : ""} text-anchor="${a}" fill="${f}"${rot ? ` transform="rotate(${rot} ${px2(x)} ${px2(y)})"` : ""}>${esc(t)}</text>`
    );
  const R = (x, y, w, h, { st = INK, fi = "none", sw = 1.2 } = {}) =>
    o.push(
      `<rect x="${px2(x)}" y="${px2(y)}" width="${px2(w)}" height="${px2(h)}" fill="${fi}"${st ? ` stroke="${st}" stroke-width="${sw}"` : ""}/>`
    );
  const C = (x, y, rr, { fi = "#fff", st = INK } = {}) =>
    o.push(
      `<circle cx="${px2(x)}" cy="${px2(y)}" r="${px2(rr)}" fill="${fi}"${st ? ` stroke="${st}" stroke-width="1.2"` : ""}/>`
    );
  const TRI = (x1, y1, x2, y2, x3, y3, fi = INK) =>
    o.push(`<path d="M${px2(x1)} ${px2(y1)}L${px2(x2)} ${px2(y2)}L${px2(x3)} ${px2(y3)}Z" fill="${fi}"/>`);
  // Arco con segmentos rectos (el DXF no lee arcos de SVG): centro, radio y ángulos en grados
  const arco = (x, y, rr, a1, a2, n = 10) => {
    for (let i = 0; i < n; i++) {
      const t1 = ((a1 + ((a2 - a1) * i) / n) * Math.PI) / 180,
        t2 = ((a1 + ((a2 - a1) * (i + 1)) / n) * Math.PI) / 180;
      L(x + rr * Math.cos(t1), y + rr * Math.sin(t1), x + rr * Math.cos(t2), y + rr * Math.sin(t2), 1.2);
    }
  };
  // Achurado a 45° dentro de una franja horizontal
  const achurado = (x0, x1, ya, yb, paso = 8) => {
    const h = yb - ya;
    for (let xs = x0 - h; xs < x1; xs += paso) {
      let xa = xs,
        ya1 = yb,
        xb = xs + h,
        yb1 = ya;
      if (xa < x0) {
        ya1 = yb - (x0 - xa);
        xa = x0;
      }
      if (xb > x1) {
        yb1 = ya + (xb - x1);
        xb = x1;
      }
      if (xb > xa) L(xa, ya1, xb, yb1, 0.5, GR);
    }
  };
  // Título
  T(20, 28, "DIAGRAMA DE ALTURAS DE MONTAJE", { s: 13, b: 1, f: NAVY });
  T(20, 43, "Elevación típica de muro · alturas en metros desde el nivel de piso terminado (NPT) · escala S/E", {
    s: 8.5,
    f: GR
  });
  /* Elevación: muro entre el piso terminado y el fondo de la losa; las marcas de nivel van a la derecha */
  const x0 = 58,
    x1 = 696,
    xm = x1 - 50,
    yT = 92,
    k = Math.min(128, 360 / Math.max(a.techo, 1)),
    yP = yT + a.techo * k,
    Y = h => yP - h * k;
  o.push(`<g data-capa="E-ELEVACION">`);
  if (rige !== "no") {
    R(x0, Y(1.2), xm - 8 - x0, 0.8 * k, { st: "", fi: "#eaf2fb" });
    T(x0 - 7, Y(0.8), "Alcance A.120", { s: 6.5, a: "middle", f: GR, rot: -90 });
  }
  // Niveles: una línea por cada altura distinta, con su marca (triángulo y cota) a la derecha
  const niveles = [...new Set(S.filter(s => s.k !== "luz").map(s => Math.round(s.h * 100)))]
    .filter(h => h > 0 && h < Math.round(a.techo * 100))
    .sort((p, q) => q - p);
  let yAnt = -1e9;
  const marca = (h, txt, extra) => {
    const y = Y(h);
    L(xm, y, xm + 4, y - 7, 0.9);
    L(xm + 4, y - 7, xm - 4, y - 7, 0.9);
    L(xm - 4, y - 7, xm, y, 0.9);
    const yt = Math.max(y - 1, yAnt + 10);
    yAnt = yt;
    T(xm + 8, yt, txt, { s: 7.6, b: 1, f: NAVY });
    if (extra) T(xm + 8, yt + 9, extra, { s: 6.4, f: GR });
  };
  niveles.forEach(hc => L(x0, Y(hc / 100), xm - 8, Y(hc / 100), 0.6, "#9aa6b2", "3 3"));
  // Losa, muro y piso
  L(x0, yT - 12, x1, yT - 12, 1);
  achurado(x0, x1, yT - 12, yT);
  L(x0, yT, x1, yT, 1.4);
  L(x0, yT, x0, yP, 1.2);
  L(x1, yT, x1, yP, 1.2);
  L(x0 - 8, yP, x1 + 8, yP, 1.8);
  achurado(x0 - 8, x1 + 8, yP, yP + 9);
  yAnt = -1e9;
  marca(a.techo, `+${fmt(a.techo, 2)}`, "Fondo de losa");
  niveles.forEach(hc => marca(hc / 100, `+${fmt(hc / 100, 2)}`));
  T(xm + 8, yP - 4, "±0.00 NPT", { s: 7.6, b: 1, f: NAVY });
  L(xm, yP, xm + 4, yP - 7, 0.9);
  L(xm + 4, yP - 7, xm - 4, yP - 7, 0.9);
  L(xm - 4, yP - 7, xm, yP, 0.9);
  // Posición de cada salida: por zonas, con un espacio entre zonas
  const zonas = [...new Set(S.map(s => s.z))],
    GAP = 0.8,
    xa = x0 + 14,
    xb = xm - 22,
    paso = (xb - xa) / Math.max(S.length + GAP * (zonas.length - 1), 1);
  S.forEach((s, i) => (s.x = xa + paso * (i + 0.5 + GAP * zonas.indexOf(s.z))));
  /* Aparatos como se ven instalados (vista frontal), centrados en el eje de la caja; en la leyenda va su símbolo
     DGE. Cada uno indica cuánto sobresale arriba y abajo del eje, para que la tubería llegue a su borde. */
  const ELI = (x, y, rx, ry, fi = "#fff") =>
    o.push(
      `<ellipse cx="${px2(x)}" cy="${px2(y)}" rx="${px2(rx)}" ry="${px2(ry)}" fill="${fi}" stroke="${INK}" stroke-width="1.1"/>`
    );
  const placa = (x, y, w, h) => {
    R(x - w / 2, y - h / 2, w, h, { fi: "#fff", sw: 1.1 });
    R(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4, { st: LN, sw: 0.6 });
  };
  const agujero = (x, y) => C(x, y, 1.1, { fi: INK, st: "" });
  // Tomacorriente doble con toma de tierra (dos alvéolos y el contacto de tierra en cada módulo)
  const enchufe = (x, y) => {
    C(x, y, 5, { fi: "#f3f6f9" });
    agujero(x - 2, y + 0.5);
    agujero(x + 2, y + 0.5);
    L(x, y - 3.4, x, y - 1.8, 1);
  };
  // Salida de fuerza: tomacorriente redondo de tres polos
  const fuerza = (x, y, letra) => {
    placa(x, y, 22, 24);
    C(x, y, 7, { fi: "#f3f6f9" });
    [90, 210, 330].forEach(g =>
      agujero(x + 3.6 * Math.cos((g * Math.PI) / 180), y - 3.6 * Math.sin((g * Math.PI) / 180))
    );
    T(x + 14, y - 8, letra, { s: 7.5, b: 1, f: NAVY });
  };
  const APA = {
    med: (x, y) => {
      // Caja portamedidor con visor y cerradura
      R(x - 15, y - 21, 30, 42, { fi: "#fff", sw: 1.3 });
      R(x - 11, y - 16, 22, 20, { fi: "#eaf2fb", sw: 0.9 });
      T(x, y - 8.5, "kWh", { s: 6, b: 1, a: "middle" });
      R(x - 7, y - 4, 14, 5, { fi: "#fff", sw: 0.7 });
      C(x + 9, y + 14, 1.6, { fi: INK, st: "" });
      return [21, 21];
    },
    tab: (x, y, ht) => {
      // Gabinete con puerta, chapa y señal de riesgo eléctrico; y es el borde superior
      R(x - 16, y, 32, ht, { fi: "#fff", sw: 1.4 });
      R(x - 13, y + 3, 26, ht - 6, { fi: "#f3f6f9", sw: 0.8 });
      R(x + 8, y + ht / 2 - 5, 2.5, 10, { fi: INK, sw: 0.8 });
      TRI(x - 6, y + 19, x + 6, y + 19, x, y + 8.5, "#ffd200");
      L(x - 6, y + 19, x + 6, y + 19, 0.9);
      L(x + 6, y + 19, x, y + 8.5, 0.9);
      L(x, y + 8.5, x - 6, y + 19, 0.9);
      L(x + 1, y + 11.5, x - 1.4, y + 15, 0.9);
      L(x - 1.4, y + 15, x + 1.4, y + 15, 0.9);
      L(x + 1.4, y + 15, x - 1, y + 18, 0.9);
      return [0, ht];
    },
    int: (x, y) => {
      // Placa con tecla basculante
      placa(x, y, 18, 26);
      R(x - 5, y - 8, 10, 16, { fi: "#f3f6f9", sw: 0.9 });
      L(x - 5, y, x + 5, y, 0.6);
      return [13, 13];
    },
    toma: (x, y) => {
      placa(x, y, 18, 30);
      enchufe(x, y - 7);
      enchufe(x, y + 7);
      return [15, 15];
    },
    braq: (x, y) => {
      // Braquete: base en el muro y globo
      R(x - 7, y - 14, 14, 5, { fi: "#fff", sw: 1 });
      L(x, y - 9, x, y - 7, 1);
      ELI(x, y + 2, 8, 9);
      L(x - 8, y + 2, x + 8, y + 2, 0.6, LN);
      return [14, 11];
    },
    luz: x => {
      // Plafón en el techo: florón, vástago, pantalla y foco
      R(x - 8, yT, 16, 3, { fi: "#fff", sw: 1 });
      L(x, yT + 3, x, yT + 7, 1);
      L(x - 6, yT + 7, x + 6, yT + 7, 1.1);
      L(x + 6, yT + 7, x + 14, yT + 17, 1.1);
      L(x + 14, yT + 17, x - 14, yT + 17, 1.1);
      L(x - 14, yT + 17, x - 6, yT + 7, 1.1);
      arco(x, yT + 17, 5, 0, 180, 8);
      return [0, 0];
    },
    emer: (x, y) => {
      // Equipo autónomo de dos faros con piloto de carga
      L(x - 9, y - 6, x - 9, y - 9, 1);
      L(x + 9, y - 6, x + 9, y - 9, 1);
      C(x - 9, y - 12, 4.5);
      C(x + 9, y - 12, 4.5);
      R(x - 17, y - 6, 34, 13, { fi: "#fff", sw: 1.2 });
      C(x + 12, y + 0.5, 1.6, { fi: "#2f7a4b", st: "" });
      T(x - 3, y + 3, "EMERG.", { s: 4.8, b: 1, a: "middle", f: GR });
      return [17, 7];
    },
    tomaC: (x, y) => APA.toma(x, y),
    terma: (x, y) => {
      // Terma eléctrica: tanque con termostato y tuberías de agua
      R(x - 13, y - 22, 26, 44, { fi: "#fff", sw: 1.3 });
      L(x - 13, y - 16, x + 13, y - 16, 0.6, LN);
      L(x - 13, y + 16, x + 13, y + 16, 0.6, LN);
      C(x, y + 6, 3.5, { fi: "#f3f6f9" });
      L(x - 6, y + 22, x - 6, y + 28, 1.1);
      L(x + 6, y + 22, x + 6, y + 28, 1.1);
      return [22, 22];
    },
    coc: (x, y) => (fuerza(x, y, "C"), [12, 12]),
    aire: (x, y) => (fuerza(x, y, "A"), [12, 12]),
    fza: (x, y) => (fuerza(x, y, "F"), [12, 12]),
    itc: (x, y) => {
      // Interfono: rejilla del altavoz, micrófono y botón
      placa(x, y, 20, 34);
      [-11, -8, -5].forEach(d => L(x - 5, y + d, x + 5, y + d, 0.9));
      C(x, y + 3, 1.5, { fi: INK, st: "" });
      C(x, y + 10, 3.2, { fi: "#f3f6f9" });
      return [17, 17];
    }
  };
  // Tubería (referencial): alumbrado y mandos por el techo; tomacorrientes y fuerza por el piso; el tablero, por ambos
  const yDe = s => (s.k === "luz" ? yT + 12 : Y(Math.min(Math.max(s.h, 0), a.techo))),
    PORT = ["int", "braq", "emer", "aire", "itc", "tab"],
    PORP = ["med", "tab", "toma", "tomaC", "terma", "coc", "fza"];
  const dib = [];
  S.forEach(s => {
    const y = yDe(s),
      mark = o.length,
      [ar, ab] = APA[s.k](s.x, y, 0.4 * k);
    dib.push(o.splice(mark));
    if (PORT.includes(s.k)) L(s.x, yT, s.x, y - ar, 1.1, CU);
    if (PORP.includes(s.k)) L(s.x, yP, s.x, y + ab, 1.1, CU);
  });
  // Los aparatos se dibujan encima de las tuberías
  dib.forEach(d => o.push(...d));
  // Nombres y zonas debajo del piso
  const partir = (t, n) => {
    const ln = [];
    let u = "";
    t.split(" ").forEach(w => {
      if ((u + " " + w).trim().length > n && u) {
        ln.push(u);
        u = w;
      } else u = (u + " " + w).trim();
    });
    ln.push(u);
    return ln;
  };
  S.forEach(s => partir(s.corto, 9).forEach((l, j) => T(s.x, yP + 22 + j * 8.5, l, { s: 6.8, a: "middle" })));
  zonas.forEach(z => {
    const g = S.filter(s => s.z === z),
      xi = g[0].x - paso * 0.45,
      xf = g[g.length - 1].x + paso * 0.45,
      yz = yP + 44;
    L(xi, yz - 4, xi, yz, 0.8, NAVY);
    L(xi, yz, xf, yz, 0.8, NAVY);
    L(xf, yz - 4, xf, yz, 0.8, NAVY);
    T((xi + xf) / 2, yz + 11, z, { s: 7.2, b: 1, a: "middle", f: NAVY });
  });
  o.push(`</g><g data-capa="E-LEYENDA">`);
  /* Leyenda y cuadro de alturas, agrupados por zona como el dibujo */
  const bx = 716,
    bw = W - 20 - bx,
    y0 = 58;
  R(bx, y0, bw, 18, { st: "", fi: NAVY });
  T(bx + bw / 2, y0 + 12.5, "LEYENDA Y CUADRO DE ALTURAS", { s: 8.5, b: 1, a: "middle", f: "#fff" });
  let yy = y0 + 18;
  R(bx, yy, bw, 16, { st: LN, fi: "#f3f6f9", sw: 0.8 });
  [
    ["SÍMBOLO", bx + 22, "middle"],
    ["DESCRIPCIÓN", bx + 46, "start"],
    ["CÓD. DGE", bx + 232, "start"],
    ["ALTURA", bx + 306, "end"],
    ["A.120", bx + 340, "middle"]
  ].forEach(([t, x, an]) => T(x, yy + 11, t, { s: 6.6, b: 1, a: an, f: GR }));
  yy += 16;
  const estado = s => {
    if (!s.chk) return ["—", GR, 0];
    const ok = s.h >= s.chk[0] - 1e-9 && s.h <= s.chk[1] + 1e-9;
    return ok ? ["Cumple", "#2f7a4b", 1] : rige === "no" ? ["Fuera de rango", GR, 1] : ["No cumple", "#b42318", 1];
  };
  zonas.forEach(z => {
    R(bx, yy, bw, 15, { st: LN, fi: "#e3e9f0", sw: 0.8 });
    T(bx + 8, yy + 10.5, z.toUpperCase(), { s: 6.8, b: 1, f: NAVY });
    yy += 15;
    S.filter(s => s.z === z).forEach(s => {
      const [et, ec, eb] = estado(s);
      R(bx, yy, bw, 24, { st: LN, fi: "#fff", sw: 0.8 });
      L(bx + 44, yy, bx + 44, yy + 24, 0.8, LN);
      // Símbolo DGE de la salida (las de fuerza y aire, trifásicas si su código es el de 09-93-15)
      simboloDGE(
        o,
        (s.k === "fza" || s.k === "aire") && s.cod === "09-93-15" ? s.k + "3" : s.k,
        bx + 22,
        yy + 12,
        0.85
      );
      T(bx + 50, yy + 15.5, s.nom, { s: 7.5 });
      T(bx + 232, yy + 15.5, s.cod, { s: 7.3, f: GR });
      T(bx + 306, yy + 15.5, `${fmt(s.h, 2)} m`, { s: 7.8, b: 1, a: "end" });
      T(bx + 340, yy + 15.5, et, { s: 7, b: eb, a: "middle", f: ec });
      yy += 24;
    });
  });
  o.push(`</g><g data-capa="E-NOTAS">`);
  // Notas y rótulo
  const yr = Math.max(yP + 74, yy + 16),
    hr = 124,
    rx = W - 480,
    rw = W - 20 - rx;
  R(20, yr, rx - 40, hr, { st: NAVY, sw: 1 });
  T(30, yr + 16, "NOTAS", { s: 9, b: 1, f: NAVY });
  const RIGE = {
    si: "rige en esta edificación (atención al público, Art. 2)",
    comun: "rige en las áreas comunes si el edificio exige ascensor (Art. 2)",
    no: "no es obligatoria en vivienda unifamiliar, salvo vivienda accesible (Art. 30); se indica como referencia"
  };
  const notas = [
    `Alturas desde el NPT hasta el eje de la caja; el tablero, hasta su borde superior. El centro de luz va en el fondo de la losa (+${fmt(a.techo, 2)} m).`,
    "La elevación muestra los aparatos instalados; la leyenda, su símbolo de la Norma DGE «Símbolos gráficos en electricidad» (R.M. N.° 091-2002-EM/VME), sección 093, redibujado conservando sus proporciones.",
    `Norma A.120 del RNE: ${RIGE[rige]}. Interruptores y timbres hasta 1.35 m (Art. 11 d); alcance frontal de 0.40 a 1.20 m (Art. 10).`,
    "Las alturas sin límite en la A.120 (—) son criterio del proyectista: verifíquelas con la arquitectura, el mobiliario y los equipos. El medidor, según la concesionaria.",
    "Recorridos de tubería referenciales: alumbrado y mandos por el techo; tomacorrientes y salidas de fuerza por el piso."
  ];
  let ny = yr + 32;
  notas.forEach((t, i) => {
    partir(t, 150).forEach((l, j) => {
      if (!j) T(30, ny, `${i + 1}.`, { s: 7.6, b: 1, f: NAVY });
      T(42, ny, l, { s: 7.6 });
      ny += 10;
    });
    ny += 1.5;
  });
  o.push(`</g>`);
  rotuloSvg(o, rx, yr, rw, hr, c.proj, "Diagrama de alturas de montaje · Escala S/E", "IE-02");
  const H = yr + hr + 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/><rect x="6" y="4" width="${W - 12}" height="${H - 10}" fill="none" stroke="${NAVY}" stroke-width="1.5"/>${o.join("")}</svg>`;
  return { svg, W, H };
}
function cardAlturas(r, nro) {
  const u = alturas(r);
  return `<section class="card"><h2><span><span class="num">${nro}</span>Diagrama de alturas de montaje</span></h2>
  <div class="unif">${u.svg}</div><div class="body"><p class="hint">Muestra las salidas que tiene el proyecto según sus circuitos, cada una a la altura indicada en Parámetros › Alturas. Los interruptores y tomacorrientes se comparan con la Norma A.120 del RNE (accesibilidad); las demás alturas son criterio del proyectista. Se descarga en DXF, PNG y SVG desde la cinta (Planos).</p></div></section>`;
}
