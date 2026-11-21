/* LÁMINA DEL TABLERO GENERAL DEL EDIFICIO (IE-05, solo edificios)
   Entre la caja toma de la concesionaria y el banco de medidores: el interruptor general del alimentador general
   (en caja moldeada) y las barras de cobre N, R, S y T, de las que sale con pletina y perno la fase de cada
   suministro (la que le asigna el balance) y su neutro, hacia su medidor. Como en el detalle de tableros: vista de
   la puerta con su señal, vista interior con los conductores en sus colores, datos del tablero y cuadro de
   conexiones; abajo, notas y rótulo. Interruptor, conductores y fases salen del cálculo; las dimensiones del
   gabinete y de las barras son del fabricante. Nada de esto cambia el cálculo. */
function tableroGeneral(r) {
  if (r.mode !== "multi") return null;
  const c = r.c,
    o = [],
    { L, T, R, C } = trazos(o);
  const { INK, NAVY, CU, GR, LN, VE } = PAL,
    W = 1123;
  // Conductores en sus colores (js/planos/dibujo.js), con los extremos redondeados
  const colTxt = colTxtCond,
    cable = conductorSvg(o, 1.4, true);
  // Recorrido de un cable por varios puntos
  const tramo = (pts, f, w) => pts.slice(1).forEach((p, i) => cable(pts[i][0], pts[i][1], p[0], p[1], f, w));
  const perno = (x, y, rr = 2.6) => {
    C(x, y, rr, { fi: "#fff", st: INK, sw: 0.7 });
    L(x - rr * 0.6, y, x + rr * 0.6, y, 0.6);
  };
  const sis = SIST[r.sk],
    tri = sis.tri,
    conN = !tri || sis.n === 4,
    gen = r.alims[0],
    polos = tri ? ["R", "S", "T"] : ["R"],
    barras = [...(conN ? ["N"] : []), ...polos],
    nomF = f => (f === "R" && !tri ? "F" : f),
    /* Salidas del TG: con el banco junto al TG, una por suministro (cada medidor del banco toma su fase de las barras);
       con el banco en otro lugar, el alimentador al banco y, si sale del TG, el del TSG */
    aBM = r.alims.find(a => a.pKey === "bm"),
    M = aBM
      ? [
          {
            nom: "BM",
            tipo: "Banco de medidores",
            tab: "banco de medidores",
            tri: aBM.s.tri,
            fase: aBM.s.tri ? "RST" : "R",
            kW: aBM.P / 1000,
            a: aBM,
            med: "",
            bm: true
          },
          ...suministrosBanco(r, true).filter(m => m.tab === "TSG" && r.topo.tsgTG)
        ]
      : suministrosBanco(r, true);
  // Salidas: una por fase de cada suministro (el TSG trifásico toma R, S y T) y su neutro
  const filas = [];
  M.forEach(m => (m.tri ? polos : [tri ? m.fase : "R"]).forEach(f => filas.push({ m, f })));
  const cond = (n, S, St) => `${n}-1×${S} + 1×${St}(T) mm²`;

  T(20, 28, "TABLERO GENERAL DEL EDIFICIO", { s: 13, b: 1, f: NAVY });
  T(
    20,
    43,
    "Vista de la puerta y vista interior esquemática · interruptor general y barras de cobre hacia el banco de medidores · escala S/E",
    { s: 8.5, f: GR }
  );
  const yb = 58;
  T(20, yb + 14, "TABLERO TG", { s: 11, b: 1, f: NAVY });
  T(
    150,
    yb + 14,
    `Tablero general · ${sis.txt} · PdC ${gen.pdc} kA · interruptor general ${polos.length}×${gen.itm} A · ${aBM ? "salida al banco de medidores" : `${M.length} suministros`} · llega de la caja toma F1`,
    { s: 8, f: GR }
  );
  /* Gabinete: la puerta y la vista interior del mismo tamaño, porque son el mismo tablero, en la proporción de su
     medida de catálogo (criterio); los textos van fuera del gabinete, con su línea de referencia */
  const yc = yb + 24,
    np = polos.length,
    mh = 116,
    my = yc + 40,
    paso = 15,
    yB1 = my + mh + 50,
    yB2 = yB1 + 24 + filas.length * paso + 6,
    yDin = yB2 + 30,
    yPE = yDin + 40,
    bh = yPE + 36 - yc,
    gm = medidaGabinete(0, true),
    wG = Math.min(330, Math.max(230, (bh * gm.a) / gm.h)),
    wD = wG,
    // Puerta e interior juntos, centrados en el espacio libre a la izquierda del cuadro de datos
    xD = 20 + Math.max(0, (W - 314 - (2 * wG + 24 + 150)) / 2),
    x0 = xD + wD + 24,
    xc = x0 + wG / 2,
    xF = x0 + wG + 8;
  const pp = 26,
    mw = np * pp + 18,
    mx = xc - mw / 2,
    pb = 28,
    bw = 12,
    anchoB = (barras.length - 1) * pb + bw,
    xb0 = xc - anchoB / 2,
    xBar = f => xb0 + barras.indexOf(f) * pb,
    cx = f => xBar(f) + bw / 2;
  o.push(`<g data-capa="E-TABLEROS">`);

  /* ---------- Vista de la puerta ---------- */
  const xdc = xD + wD / 2;
  puertaMetalica(o, xD, yc, wD, bh, { s: 90, ys: yc + 44, tab: "TG", nom: "TABLERO GENERAL", sNom: 7.4 });
  T(xdc, yc + bh + 14, "VISTA DE LA PUERTA", { s: 7, b: 1, a: "middle", f: GR });
  T(xdc, yc + bh + 24, `≈ ${gm.a} × ${gm.h} mm (referencial)`, { s: 6.4, a: "middle", f: GR });

  /* ---------- Vista interior ---------- */
  R(x0, yc, wG, bh, { sw: 1.4 });
  R(x0 + 6, yc + 6, wG - 12, bh - 12, { st: LN, sw: 0.7 });
  T(xc, yc + bh + 14, "VISTA INTERIOR (SIN PUERTA)", { s: 7, b: 1, a: "middle", f: GR });
  // Interruptor general en caja moldeada: bornes con tornillos arriba y abajo, placa, unidad de disparo y palanca
  const bx = k => mx + 9 + pp * (k + 0.5);
  R(mx, my, mw, mh, { fi: "#1f2328", sw: 1.2 });
  polos.forEach((f, k) => {
    [my + 4, my + mh - 18].forEach(y => {
      R(bx(k) - 9, y, 18, 14, { fi: "#c9ced5", st: GR, sw: 0.5 });
      C(bx(k), y + 7, 3.2, { fi: "#fff", st: GR, sw: 0.6 });
    });
  });
  R(mx + 6, my + 24, mw - 12, 10, { fi: "#c9ced5", st: "", sw: 0 });
  T(xc, my + 31.5, `${np}P · ${gen.itm} A`, { s: 6.4, b: 1, a: "middle" });
  R(mx + 8, my + 40, mw * 0.5, 24, { fi: "#d9eedf", st: GR, sw: 0.6 });
  T(mx + 8 + mw * 0.25, my + 55, `${gen.itm} A`, { s: 7, b: 1, a: "middle" });
  R(mx + mw - 26, my + 40, 16, 34, { fi: "#e6e9ed", st: "", sw: 0 });
  R(mx + mw - 22, my + 44, 8, 12, { fi: INK, st: "", sw: 0 });
  T(mx + 10, my + 82, `Icu ${gen.pdc} kA`, { s: 6.2, f: "#fff" });
  // Datos del interruptor y de la llegada, fuera del gabinete con su línea de referencia
  const xt = xF + 4,
    ref = (x, y) => L(x, y, xF, y, 0.5, GR);
  ref(bx(np - 1) + 4, yc + 17);
  T(xt, yc + 20, "Llega de la caja toma F1", { s: 6.8, b: 1, f: NAVY });
  T(xt, yc + 30, cond(tri ? sis.n : 2, gen.S, gen.St), { s: 6.6, f: GR });
  ref(mx + mw + 2, my + 27);
  T(xt, my + 30, "INTERRUPTOR GENERAL", { s: 7.4, b: 1, f: NAVY });
  T(xt, my + 42, `${np}×${gen.itm} A · ${gen.pdc} kA`, { s: 7.2, b: 1 });
  T(xt, my + 53, "Caja moldeada", { s: 6.6, f: GR });
  T(xt, my + 63, "Alimentador general (IE-01)", { s: 6.6, f: GR });
  // Llegada: fases al interruptor; neutro y tierra por el borde izquierdo
  polos.forEach((f, k) =>
    tramo(
      [
        [bx(k), yc + 6],
        [bx(k), my + 4]
      ],
      f,
      2.6
    )
  );
  // Barras de cobre juntas, en el orden de la foto de obra (N, R, S, T), sobre placas aislantes arriba y abajo
  [yB1 - 10, yB2 - 2].forEach(y => R(xb0 - 14, y, anchoB + 28, 12, { fi: CU, st: "", sw: 0 }));
  barras.forEach(f => {
    // El neutro, blanco con borde gris (en AutoCAD, gris claro, para no confundirlo con la S negra)
    R(xBar(f), yB1 - 6, bw, yB2 - yB1 + 8, { fi: f === "N" ? "#e6e9ed" : COND[f], st: f === "N" ? GR : "", sw: 0.8 });
    perno(cx(f), yB1 - 4, 3);
    perno(cx(f), yB2 + 4, 3);
    T(cx(f), yB1 - 16, nomF(f), { s: 7.4, b: 1, a: "middle", f: colTxt(f) });
  });
  // Del interruptor a la cabeza de cada barra, con cable grueso
  polos.forEach((f, k) =>
    tramo(
      [
        [bx(k), my + mh],
        [bx(k), my + mh + 18],
        [cx(f), my + mh + 18],
        [cx(f), yB1 - 4]
      ],
      f,
      3.2
    )
  );
  if (conN)
    tramo(
      [
        [x0 + 16, yc + 6],
        [x0 + 16, my + mh + 32],
        [cx("N"), my + mh + 32],
        [cx("N"), yB1 - 4]
      ],
      "N",
      3.2
    );
  /* Salidas: la pletina de cada fase sale del perno de su barra hacia la bornera de la derecha y pasa por delante de
     las otras barras, que están en otro plano sobre sus aisladores: donde cruza lleva una manga aislante. El neutro
     de cada suministro sale de la barra N hacia la izquierda, en la fila de su primera fase. */
  const xS = xb0 + anchoB + 24,
    xNL = xb0 - 24;
  filas.forEach((sa, k) => {
    const y = yB1 + 24 + k * paso;
    R(cx(sa.f), y - 3, xS - cx(sa.f), 6, { fi: "#c98a4b", st: CU, sw: 0.5 });
    barras
      .slice(barras.indexOf(sa.f) + 1)
      .forEach(b => R(xBar(b) - 2, y - 4.5, bw + 4, 9, { fi: "#5a6775", st: INK, sw: 0.5 }));
    const conNeutro = conN && filas.findIndex(x => x.m === sa.m) === k;
    perno(cx(sa.f), y, 2.4);
    perno(xS, y, 2.4);
    cable(xS + 3, y, xS + 18, y, sa.f, 1.4);
    ref(xS + 20, y);
    T(xt, y + 3, `${sa.m.med ? sa.m.med + " " : ""}${sa.m.nom} · ${nomF(sa.f)}${conNeutro ? "-N" : ""} → ${sa.m.tab}`, {
      s: 6.2,
      b: 1,
      f: colTxt(sa.f)
    });
    if (conNeutro) {
      R(xNL, y - 2.5, cx("N") - xNL, 5, { fi: "#c98a4b", st: CU, sw: 0.5 });
      perno(cx("N"), y, 2.2);
      perno(xNL, y, 2.2);
      cable(xNL - 18, y, xNL - 3, y, "N", 1.4);
    }
  });
  // Riel DIN para equipos (DPS u otros, si el proyecto los lleva)
  const mr = (wG - 70) / 2;
  R(xc - mr, yDin, 2 * mr, 14, { fi: "#c9ced5", st: GR, sw: 0.7 });
  for (let x = xc - mr + 6; x < xc + mr - 4; x += 12) R(x, yDin + 5, 6, 4, { fi: "#e6e9ed", st: "", sw: 0 });
  ref(xc + mr + 2, yDin + 7);
  T(xt, yDin + 10, "Riel DIN", { s: 6.6, f: GR });
  // Barra de tierra con sus bornes y aisladores; conductor de tierra a la puerta y al pozo
  R(xc - mr, yPE, 2 * mr, 10, { fi: CU, st: "", sw: 0 });
  [xc - mr - 8, xc + mr - 2].forEach(x => R(x, yPE - 2, 10, 14, { fi: "#ffd200", st: GR, sw: 0.5 }));
  for (let x = xc - mr + 10; x < xc + mr - 4; x += 18) C(x, yPE + 5, 2.4, { fi: "#fff", st: GR, sw: 0.5 });
  T(xc, yPE + 24, `Barra de tierra (PE) · ${r.Selec} mm² al pozo`, { s: 6.8, a: "middle", f: VE });
  tramo(
    [
      [xc + mr + 8, yPE + 5],
      [x0 + wG - 14, yPE + 5],
      [x0 + wG - 14, yPE - 34]
    ],
    "PE",
    1.6
  );
  T(x0 + wG - 18, yPE - 6, "A la puerta", { s: 6.4, a: "end", f: VE });
  tramo(
    [
      [x0 + 10, yc + 6],
      [x0 + 10, yPE + 5],
      [xc - mr - 8, yPE + 5]
    ],
    "PE",
    1.6
  );
  o.push(`</g>`);

  /* ---------- Datos del tablero y cuadro de conexiones ---------- */
  const dw = 250,
    dx = W - 20 - dw;
  o.push(`<g data-capa="E-CUADROS">`);
  R(dx, yc, dw, 18, { st: "", fi: NAVY });
  T(dx + dw / 2, yc + 12.5, "DATOS DEL TABLERO TG", { s: 7.8, b: 1, a: "middle", f: "#fff" });
  const datos = [
    ["Sistema", sis.txt],
    ["Interruptor general", `${np}×${gen.itm} A`],
    ["Poder de corte", `${gen.pdc} kA`],
    ["Icc en barras", `${fmt(r.iccTG, 2)} kA`],
    ["Alimentador", cond(tri ? sis.n : 2, gen.S, gen.St)],
    ["Barras", `Cobre · ${barras.map(nomF).join(", ")}`],
    ["Salidas", aBM ? `al banco de medidores${M.length > 1 ? " y al TSG" : ""}` : `${M.length} suministros`],
    ["Tierra", `${r.Selec} mm² al pozo`],
    ["Gabinete (referencial)", `≈ ${gm.a} × ${gm.h} mm`],
    ["Espacio de trabajo", "1 m al frente (020-308)"]
  ];
  datos.forEach(([k, v], i) => {
    const yy = yc + 18 + i * 17;
    R(dx, yy, dw, 17, { st: LN, fi: i % 2 ? "#fff" : "#f3f6f9", sw: 0.8 });
    T(dx + 8, yy + 12, k, { s: 7.2, f: GR });
    T(dx + dw - 8, yy + 12, v, { s: 7.4, b: 1, a: "end" });
  });
  let yy = yc + 18 + datos.length * 17 + 12;
  R(dx, yy, dw, 18, { st: "", fi: NAVY });
  T(dx + dw / 2, yy + 12.5, "CONEXIONES DEL TABLERO TG", { s: 7.8, b: 1, a: "middle", f: "#fff" });
  yy += 18;
  R(dx, yy, dw, 14, { st: LN, fi: "#e3e9f0", sw: 0.8 });
  [
    ["SALIDA", dx + 5],
    ["HACIA", dx + 44],
    ["BORNES", dx + 140],
    ["ITM", dx + 186]
  ].forEach(([t, x]) => T(x, yy + 10, t, { s: 5.8, b: 1, f: GR }));
  yy += 14;
  M.forEach((m, i) => {
    R(dx, yy, dw, 13, { st: LN, fi: i % 2 ? "#fff" : "#f3f6f9", sw: 0.8 });
    T(dx + 5, yy + 9.5, m.med ? `${m.med} ${m.nom}` : m.nom, { s: 6.6, b: 1, f: NAVY });
    T(dx + 44, yy + 9.5, m.bm ? "Alimentador → banco" : m.med ? `Medidor → ${m.tab}` : `Directo → ${m.tab}`, {
      s: 6.4
    });
    T(dx + 140, yy + 9.5, (m.tri ? polos.map(nomF) : [nomF(tri ? m.fase : "R")]).concat(conN ? ["N"] : []).join("-"), {
      s: 6.4,
      b: 1
    });
    T(dx + 186, yy + 9.5, `${m.a.s.tri ? 3 : 2}×${m.a.itm} A`, { s: 6.4 });
    yy += 13;
  });
  // Filas libres hasta el pie de las vistas, para que los cuadros tengan su mismo alto
  for (let i = M.length; yy < yc + bh - 0.5; i++) {
    const h = Math.min(13, yc + bh - yy);
    R(dx, yy, dw, h, { st: LN, fi: i % 2 ? "#fff" : "#f3f6f9", sw: 0.8 });
    yy += h;
  }
  o.push(`</g>`);

  /* ---------- Notas y rótulo ---------- */
  const yr = Math.max(yc + bh + 38, yy + 16),
    hr = 124,
    rx = W - 480,
    rw = W - 20 - rx;
  const notas = [
    `Caja toma F1 (concesionaria) → tablero general → banco de medidores (lámina ${ieNum("IE-06")}) → tablero de cada suministro (lámina ${ieNum("IE-04")}). Los medidores quedan en el lado de carga del interruptor general (Regla 040-402(2)).`,
    `Interruptor general y alimentador del cálculo (lámina ${ieNum("IE-01")}). Tipo de interruptor y sección de las barras según el fabricante; la medida del gabinete es referencial, de catálogo (criterio).`,
    "Espacio de trabajo libre de 1 m frente al tablero, con piso no deslizante, que permita abrir la puerta al menos 90° (Regla 020-308).",
    "Cada salida toma con perno la fase del balance y su neutro; las pletinas pasan por delante de las otras barras (en otro plano, sobre aisladores) con manga aislante. El interruptor de cada suministro va después de su medidor.",
    "Conductores: R rojo, S negro, T azul (orden de fases: criterio), N blanco, tierra verde-amarillo. Barra de tierra unida a la puerta y al pozo."
  ];
  notasSvg(o, 20, yr, rx - 40, hr, notas);
  rotuloSvg(o, rx, yr, rw, hr, c.proj, "Tablero general del edificio · Escala S/E", "IE-05");
  const H = yr + hr + 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/><rect x="6" y="4" width="${W - 12}" height="${H - 10}" fill="none" stroke="${NAVY}" stroke-width="1.5"/>${o.join("")}</svg>`;
  return { svg, W, H };
}
function cardTableroGeneral(r, nro) {
  const u = tableroGeneral(r);
  return `<section class="card"><h2><span><span class="num">${nro}</span>Tablero general del edificio</span></h2>
  <div class="unif">${u.svg}</div><div class="body"><p class="hint">Interruptor general del alimentador general y barras de cobre N, R, S y T de las que sale la fase de cada suministro, según el balance, hacia su medidor. Se descarga en DXF, PNG y SVG desde la cinta (Planos).</p></div></section>`;
}
