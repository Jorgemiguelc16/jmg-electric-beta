/* LÁMINA DE LEYENDA Y DETALLES (IE-03)
   A la izquierda, la leyenda de los símbolos de la Norma DGE (R.M. N.° 091-2002-EM/VME) que usan los planos del
   proyecto: los de las salidas que tiene (las mismas del diagrama de alturas), las canalizaciones y conductores, y
   los del unifilar. A la derecha, el detalle del pozo de puesta a tierra en corte, con la varilla, el conductor y
   la resistencia del cálculo (Reglas 060-702 y 060-712, Tabla 17) y los materiales y medidas de Parámetros › Tierra
   y metrado (criterio de diseño), con su cuadro de materiales. Abajo, notas y rótulo. Símbolos en js/planos/simbolos.js. */
function detalles(r) {
  const c = r.c,
    p = r.pat,
    pz = c.pozo,
    o = [],
    { L, T, R, C, TRI } = trazos(o);
  const { INK, NAVY, CU, GR, LN } = PAL,
    W = 1123;
  const titulo = (x, y, w, t) => {
    R(x, y, w, 18, { st: "", fi: NAVY });
    T(x + w / 2, y + 12.5, t, { s: 8.5, b: 1, a: "middle", f: "#fff" });
  };
  T(20, 28, "LEYENDA Y DETALLES", { s: 13, b: 1, f: NAVY });
  T(20, 43, "Símbolos de la Norma DGE usados en los planos del proyecto · detalle del pozo de puesta a tierra", {
    s: 8.5,
    f: GR
  });

  /* ---------- Leyenda de símbolos ---------- */
  const S = salidasAltura(r),
    hay = k => S.some(s => s.k === k),
    cod = k => (S.find(s => s.k === k) || {}).cod,
    eq = k => r.tabs.some(t => equiposDe(r, t.tab).some(([e]) => e === k));
  const G = [
    [
      "Tableros y medición",
      [
        ["tab", "Tablero de distribución empotrado", "09-91-17"],
        ["med", r.mode === "multi" ? "Medidor de energía (banco de medidores)" : "Medidor de energía", "08-80-22"]
      ]
    ],
    [
      "Alumbrado",
      [
        hay("luz") && ["luz", "Salida de alumbrado adosada o colgada en techo", "09-93-51"],
        hay("braq") && ["braq", "Salida de alumbrado adosada en pared (braquete)", "09-93-52"],
        hay("emer") && ["emer", "Luminaria de alumbrado de emergencia", "09-93-67"],
        hay("int") && ["int", "Interruptor unipolar", "09-93-30"]
      ]
    ],
    [
      "Tomacorrientes y salidas de fuerza",
      [
        (hay("toma") || hay("tomaC")) && ["toma", "Tomacorriente monofásico con toma de tierra", "09-93-17"],
        hay("coc") && ["coc", "Salida trifásica para cocina", "09-93-18"],
        hay("aire") && [
          cod("aire") === "09-93-15" ? "aire3" : "aire",
          `Salida para aire acondicionado (${cod("aire") === "09-93-15" ? "trifásica" : "monofásica"})`,
          cod("aire")
        ],
        hay("fza") && [
          cod("fza") === "09-93-15" ? "fza3" : "fza",
          `Salida de fuerza: motor u otra carga (${cod("fza") === "09-93-15" ? "trifásica" : "monofásica"})`,
          cod("fza")
        ]
      ]
    ],
    [
      "Equipos y comunicaciones",
      [
        hay("terma") && ["terma", "Calentador de agua (terma o ducha eléctrica)", "09-93-69"],
        hay("itc") && ["itc", "Interfono (intercomunicador)", "09-93-73"]
      ]
    ],
    [
      "Canalizaciones y conductores",
      [
        ["caja", "Caja de paso", "09-93-08"],
        ["subida", "Canalización hacia arriba", "09-93-05"],
        ["bajada", "Canalización hacia abajo", "09-93-06"],
        ["neutro", "Conductor neutro", "09-93-01"],
        ["prot", "Conductor de protección", "09-93-02"]
      ]
    ],
    [
      "Diagrama unifilar",
      [
        ["itm", "Interruptor termomagnético", "07-72-21"],
        ["dif", "Interruptor diferencial", "07-72-17"],
        eq("rel") && ["rel", "Relé de sobretensión y subtensión", "07-73-01"],
        eq("med") && ["med", "Medidor de energía del tablero", "08-80-22"],
        eq("ctr") && ["ctr", "Contactor", "07-72-18"],
        eq("ctr") && ["reloj", "Reloj horario", "08-80-40"],
        eq("dps") && ["dps", "Protector contra sobretensiones (pararrayos)", "07-75-23"],
        ["pat", "Puesta a tierra de protección", "03-31-46"]
      ]
    ]
  ]
    .map(([g, it]) => [g, it.filter(Boolean)])
    .filter(([, it]) => it.length);
  const lx = 20,
    lw = 540,
    y0 = 58;
  o.push(`<g data-capa="E-LEYENDA">`);
  titulo(lx, y0, lw, "LEYENDA DE SÍMBOLOS · NORMA DGE (R.M. N.° 091-2002-EM/VME)");
  let ly = y0 + 18;
  R(lx, ly, lw, 16, { st: LN, fi: "#f3f6f9", sw: 0.8 });
  T(lx + 30, ly + 11, "SÍMBOLO", { s: 6.6, b: 1, a: "middle", f: GR });
  T(lx + 68, ly + 11, "DESCRIPCIÓN", { s: 6.6, b: 1, f: GR });
  T(lx + lw - 12, ly + 11, "CÓDIGO DGE", { s: 6.6, b: 1, a: "end", f: GR });
  ly += 16;
  G.forEach(([g, it]) => {
    R(lx, ly, lw, 15, { st: LN, fi: "#e3e9f0", sw: 0.8 });
    T(lx + 8, ly + 10.5, g.toUpperCase(), { s: 6.8, b: 1, f: NAVY });
    ly += 15;
    it.forEach(([k, d, cd]) => {
      const vertical = ["itm", "dif", "ctr", "dps", "pat", "rel"].includes(k),
        h = vertical ? 30 : 22;
      R(lx, ly, lw, h, { st: LN, fi: "#fff", sw: 0.8 });
      L(lx + 60, ly, lx + 60, ly + h, 0.8, LN);
      simboloDGE(o, k, lx + 30, ly + h / 2, vertical ? 1.15 : 0.95);
      T(lx + 68, ly + h / 2 + 3.5, d, { s: 7.8 });
      T(lx + lw - 12, ly + h / 2 + 3.5, cd, { s: 7.6, b: 1, a: "end", f: GR });
      ly += h;
    });
  });

  /* ---------- Detalle del pozo de puesta a tierra ---------- */
  const px = 580,
    pw = W - 20 - px,
    cx = px + 190,
    yG = 116,
    hp = 250,
    yH = yG + 42,
    yB = yH + hp,
    trat = p.fr < 1 && (pz.sal > 0 || pz.carb > 0);
  o.push(`</g><g data-capa="E-DETALLE">`);
  titulo(px, y0, pw, "DETALLE DEL POZO DE PUESTA A TIERRA · ESCALA S/E");
  // Escala vertical: el hoyo (su profundidad, si se indicó) y la varilla deben caber en el dibujo
  const Htot = pz.h || p.Lv + 0.6,
    k = Math.min((hp + 42) / Htot, (hp + 34) / (p.Lv + 0.25)),
    yR0 = yG + 0.25 * k,
    yR1 = yR0 + p.Lv * k;
  // Terreno, caja de registro con su tapa y hoyo
  L(px + 14, yG, px + pw - 14, yG, 1.4);
  for (let x = px + 22; x < px + pw - 20; x += 9) if (x < cx - 40 || x > cx + 40) L(x, yG + 2, x - 6, yG + 8, 0.6, GR);
  R(cx - 34, yG, 68, 42, { fi: "#e6e9ed", sw: 1.2 });
  R(cx - 25, yG, 50, 33, { fi: "#fff", sw: 1 });
  R(cx - 32, yG - 6, 64, 6, { fi: "#d5dae0", sw: 1.1 });
  L(cx - 55, yH, cx - 55, yB, 1.2);
  L(cx + 55, yH, cx + 55, yB, 1.2);
  L(cx - 55, yB, cx + 55, yB, 1.2);
  L(cx - 55, yH, cx - 34, yH, 1.2);
  L(cx + 34, yH, cx + 55, yH, 1.2);
  // Relleno de tierra cernida (puntos) y capas del tratamiento
  let sd = 7;
  const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 70; i++) C(cx - 50 + rnd() * 100, yH + 6 + rnd() * (hp - 12), 0.8, { fi: GR, st: "" });
  const capas = trat ? [yH + hp * 0.3, yH + hp * 0.68] : [];
  capas.forEach(yc => {
    R(cx - 55, yc, 110, 12, { st: CU, fi: "#f2d3ad", sw: 0.6 });
    for (let x = cx - 50; x < cx + 52; x += 7) L(x, yc + 10, x + 4, yc + 2, 0.6, CU);
  });
  // Varilla de cobre con su punta, conector y conductor al tablero por el tubo PVC
  R(cx - 2.5, yR0, 5, yR1 - yR0, { st: "", fi: CU });
  TRI(cx - 2.5, yR1, cx + 2.5, yR1, cx, yR1 + 6, CU);
  R(cx - 5, yR0 - 3, 10, 8, { st: "", fi: "#1f2328" });
  const yT = yG + 14;
  L(cx + 5, yR0 + 1, cx + 30, yT, 1.4, CU);
  L(cx + 30, yT - 3, px + 330, yT - 3, 0.9, GR);
  L(cx + 30, yT + 3, px + 330, yT + 3, 0.9, GR);
  L(cx + 30, yT, px + 330, yT, 1.4, CU);
  T(px + 334, yT + 3, "Al tablero", { s: 7.2, f: GR });
  // Cotas: varilla (del cálculo) y, si se indicaron, profundidad y diámetro del hoyo
  const cotaV = (x, ya, yb, t) => {
    L(x, ya, x, yb, 0.7, GR);
    L(x - 3, ya + 3, x + 3, ya - 3, 0.9, GR);
    L(x - 3, yb + 3, x + 3, yb - 3, 0.9, GR);
    o.push(
      `<text x="${px2(x - 4)}" y="${px2((ya + yb) / 2)}" font-size="7.4" font-weight="700" text-anchor="middle" fill="${INK}" transform="rotate(-90 ${px2(x - 4)} ${px2((ya + yb) / 2)})">${esc(t)}</text>`
    );
  };
  cotaV(cx - 70, yR0, yR1, `Varilla ${fmt(p.Lv, 2)} m`);
  if (pz.h) cotaV(cx - 92, yG, yG + pz.h * k, `Hoyo ${fmt(pz.h, 2)} m`);
  if (pz.d) {
    L(cx - 55, yB + 14, cx + 55, yB + 14, 0.7, GR);
    L(cx - 58, yB + 17, cx - 52, yB + 11, 0.9, GR);
    L(cx + 52, yB + 17, cx + 58, yB + 11, 0.9, GR);
    T(cx, yB + 11, `Ø ${fmt(pz.d, 2)} m`, { s: 7.4, b: 1, a: "middle" });
  }
  T(px + 18, yG - 4, "Nivel del terreno", { s: 6.8, f: GR });
  // Numeración del cuadro de materiales
  const PULGD = PULG[p.dv] || fmt(p.dv * 1000, 1) + " mm",
    nV = p.nVar,
    M = [
      [1, pz.cond + 3 * (nV - 1), "m", `Conductor desnudo de cobre de ${r.Selec} mm²`, "Conductor"],
      [2, nV, "Und.", `Varilla de cobre Ø ${PULGD} × ${fmt(p.Lv, 2)} m`, "Varilla"],
      [3, nV, "Und.", "Conector de bronce tipo Anderson", "Conector"],
      [4, trat ? pz.sal * nV : 0, "kg", "Sal industrial (tratamiento)", "Sal"],
      [5, trat ? pz.carb * nV : 0, "kg", "Carbón vegetal (tratamiento)", "Carbón"],
      [6, pz.tierra * nV, "m³", "Tierra negra cernida, compactada por capas", "Tierra cernida"],
      [
        7,
        pz.tapa ? nV : 0,
        "Und.",
        `Tapa de concreto de ${fmt(pz.tapa, 2)} × ${fmt(pz.tapa, 2)} × ${fmt(pz.tapaE, 2)} m para la caja de registro`,
        "Tapa"
      ],
      [8, pz.pvc, "m", "Tubo PVC de protección del conductor", "Tubo PVC"]
    ].filter(m => m[1] > 0);
  const balon = (n, bx, by, tx, ty) => {
    if (!M.some(m => m[0] === n)) return;
    L(bx - 7, by, tx, ty, 0.6, GR);
    o.push(`<circle cx="${px2(bx)}" cy="${px2(by)}" r="7" fill="#fff" stroke="${NAVY}" stroke-width="1"/>`);
    T(bx, by + 3, String(n), { s: 7.5, b: 1, a: "middle", f: NAVY });
    T(bx + 10, by + 3, M.find(m => m[0] === n)[4], { s: 6.8, f: GR });
  };
  const bx = cx + 112;
  balon(7, cx - 100, yG - 20, cx - 30, yG - 4);
  balon(8, bx, yG - 16, cx + 100, yT - 3);
  balon(3, bx, yG + 44, cx + 5, yR0 + 1);
  balon(1, bx, yG + 68, cx + 18, yR0 + (yT - yR0) / 2);
  balon(2, bx, yH + hp * 0.5, cx + 3, yH + hp * 0.5);
  if (trat) {
    balon(4, bx, capas[0] + 6, cx + 55, capas[0] + 6);
    balon(5, bx, capas[1] + 6, cx + 55, capas[1] + 6);
  }
  balon(6, bx, yB - 20, cx + 40, yB - 30);
  // Datos del cálculo
  const dx = px + pw - 150;
  R(dx, yG + 34, 140, 84, { st: LN, fi: "#f3f6f9", sw: 0.8 });
  T(dx + 8, yG + 48, "DATOS DEL CÁLCULO", { s: 6.8, b: 1, f: NAVY });
  [
    `Resistividad: ${fmt(p.rho, 0)} Ω·m`,
    `Factor de tratamiento: ${fmt(p.fr, 2)}`,
    `R con una varilla: ${fmt(p.Rt, 2)} Ω`,
    nV > 1 ? `${nV} pozos: R ≈ ${fmt(p.Rn, 2)} Ω` : `Pozos: 1 (≤ 25 Ω)`,
    "Reglas 060-702 y 060-712"
  ].forEach((t, i) => T(dx + 8, yG + 62 + i * 11, t, { s: 7.2 }));
  // Cuadro de materiales (cantidades totales para todos los pozos)
  let my = yB + 30;
  R(px, my, pw, 16, { st: LN, fi: "#e3e9f0", sw: 0.8 });
  [
    ["ÍTEM", px + 18, "middle"],
    ["CANT.", px + 62, "end"],
    ["UND.", px + 72, "start"],
    [`DESCRIPCIÓN${nV > 1 ? ` · ${nV} POZOS` : ""}`, px + 106, "start"]
  ].forEach(([t, x, a]) => T(x, my + 11, t, { s: 6.6, b: 1, a, f: GR }));
  my += 16;
  M.forEach(([n, q, u, d]) => {
    R(px, my, pw, 15, { st: LN, fi: "#fff", sw: 0.8 });
    T(px + 18, my + 10.5, String(n), { s: 7.4, b: 1, a: "middle", f: NAVY });
    T(px + 62, my + 10.5, fmt(q, Number.isInteger(+q.toFixed(2)) ? 0 : 1), { s: 7.4, b: 1, a: "end" });
    T(px + 72, my + 10.5, u, { s: 7.2, f: GR });
    T(px + 106, my + 10.5, d, { s: 7.4 });
    my += 15;
  });

  /* ---------- Notas y rótulo ---------- */
  const yr = Math.max(ly, my) + 16,
    hr = 124,
    rx = W - 480,
    rw = W - 20 - rx;
  o.push(`</g>`);
  const notas = [
    "Símbolos de la Norma DGE «Símbolos gráficos en electricidad» (R.M. N.° 091-2002-EM/VME), redibujados conservando sus proporciones. Solo se listan los que usan los planos del proyecto.",
    `Varilla de cobre de ${fmt(p.Lv, 2)} m × ${PULGD} (mínimo 2 m y 13 mm, Regla 060-702) y conductor de ${r.Selec} mm² según la Tabla 17; resistencia no mayor de 25 Ω (Regla 060-712).`,
    "Medidas del hoyo y de la caja, y cantidades de materiales: criterio de diseño (Parámetros › Tierra y metrado). Verifíquelas con el estudio de resistividad del terreno.",
    trat
      ? "Relleno de tierra cernida compactada por capas, con las capas de sal y carbón del tratamiento; puede emplearse bentonita o gel con el factor de tratamiento correspondiente."
      : "Relleno de tierra cernida compactada por capas; sin tratamiento del suelo (factor 1).",
    nV > 1 ? `Se requieren ${nV} pozos iguales, unidos entre sí con conductor desnudo de cobre.` : ""
  ].filter(Boolean);
  notasSvg(o, 20, yr, rx - 40, hr, notas);
  rotuloSvg(o, rx, yr, rw, hr, c.proj, "Leyenda y detalle del pozo de tierra · Escala S/E", "IE-03");
  const H = yr + hr + 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/><rect x="6" y="4" width="${W - 12}" height="${H - 10}" fill="none" stroke="${NAVY}" stroke-width="1.5"/>${o.join("")}</svg>`;
  return { svg, W, H };
}
function cardDetalles(r, nro) {
  const u = detalles(r);
  return `<section class="card"><h2><span><span class="num">${nro}</span>Leyenda y detalles</span></h2>
  <div class="unif">${u.svg}</div><div class="body"><p class="hint">Leyenda de los símbolos de la Norma DGE que usan los planos del proyecto y detalle del pozo de puesta a tierra: la varilla, el conductor y la resistencia salen del cálculo; las medidas y materiales, de Parámetros › Tierra y metrado. Se descarga en DXF, PNG y SVG desde la cinta (Planos).</p></div></section>`;
}
