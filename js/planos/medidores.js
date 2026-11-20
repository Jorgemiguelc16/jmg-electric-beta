/* LÁMINA DEL BANCO DE MEDIDORES Y BALANCE DE FASES (IE-06, solo edificios)
   A la izquierda, la vista frontal del banco con las medidas de la concesionaria (Parámetros › Banco de medidores,
   Luz del Sur por defecto, plano «Banco de medidores en 2 filas»): caja toma F1, cajas de medidor monofásico (LRM)
   o trifásico (LTR) en filas de largo D = número de conexiones × ancho de caja, y la verificación de la altura
   máxima. A la derecha, los suministros de cada fase y el balance de cargas (las conexiones a las barras se ven en
   el interior del tablero general, lámina IE-05, js/planos/tablerogeneral.js). Abajo, el
   cuadro de suministros con la verificación del calibre de la instalación interna (tabla de la concesionaria),
   notas y rótulo. Nada de esto cambia el cálculo. */
// Calibre de la instalación interna (del medidor al tablero) según Luz del Sur, transcrito del plano «Banco de
// medidores en 2 filas»: [conexión, potencia hasta (kW), texto, AWG, mm², tipo]
const CALIBRE_LDS = [
  ["Monofásico", 3, "mínimo", "N.° 14", 2.5, "TW/THW"],
  ["Monofásico", 3, "máximo", "N.° 06", 16, "TW/THW"],
  ["Monofásico", 6, "mínimo", "N.° 10", 6, "TW/THW"],
  ["Monofásico", 6, "máximo", "N.° 06", 16, "TW/THW"],
  ["Monofásico", 10, "máximo", "N.° 06", 16, "TW/THW"],
  ["Trifásico", 10, "mínimo", "N.° 10", 6, "TW/THW"],
  ["Trifásico", 10, "máximo", "N.° 06", 16, "TW/THW"],
  ["Trifásico", 20, "mínimo", "N.° 06", 16, "THW"],
  ["Trifásico", 20, "mínimo", "N.° 04", 25, "THW"]
];
// Verificación del conductor con la tabla: el rango es el primero cuya potencia alcanza la del suministro. Solo se
// verifica lo que la tabla indica sin ambigüedad: un único «mínimo» y el «máximo» del rango
function calibreConc(tri, kW) {
  const con = tri ? "Trifásico" : "Monofásico",
    tope = [...new Set(CALIBRE_LDS.filter(x => x[0] === con).map(x => x[1]))].find(h => kW <= h + 1e-9);
  if (tope == null) return { fuera: true };
  const fil = CALIBRE_LDS.filter(x => x[0] === con && x[1] === tope),
    mins = fil.filter(x => x[2] === "mínimo"),
    max = fil.find(x => x[2] === "máximo");
  return { tope, min: mins.length === 1 ? mins[0][4] : null, max: max ? max[4] : null, dudoso: mins.length !== 1 };
}
// Suministros del banco de medidores: cada departamento con la fase que le asigna el balance y el servicio general
// conTSG: también el TSG directo desde el TG (en el tablero general sí tiene su salida)
function suministrosBanco(r, conTSG = false) {
  const items = r.bal ? r.bal.items.filter(x => x.ti != null) : r.units.map(u => ({ ...u, fase: "—" }));
  const M = items.map(u => {
    const t = r.T[u.ti],
      tb = r.tabs.find(x => x.tab === t.tab),
      a = r.alims[tb.feeder],
      k = +((String(u.ref).match(/N[º°]\s*(\d+)/) || [])[1] || u.ord);
    return {
      nom: `${t.nombre.replace(/^Tipo\s*/i, "")}-${k}`,
      orden: [t._i, k],
      tipo: t.nombre,
      tab: t.tab,
      // Medidor trifásico elegido en el tipo de departamento
      tri: !!u.f3,
      fase: u.f3 ? "RST" : u.fase,
      kW: t.md.MD / 1000,
      a
    };
  });
  // El TSG directo desde el TG (criterio del proyectista) no tiene medidor en el banco
  const tsg = r.tabs.find(x => x.tab === "TSG");
  if (tsg && (conTSG || !(r.topo && r.topo.tsgTG))) {
    const a = r.alims[tsg.feeder];
    M.push({
      nom: "TSG",
      tipo: "Servicios generales",
      tab: "TSG",
      tri: a.s.tri,
      fase: a.s.tri ? "RST" : "R",
      kW: a.P / 1000,
      a
    });
  }
  /* Numeración de los medidores del banco (M-1, M-2…), la misma del plano del editor (dsMedidoresBanco): los
     departamentos en el orden de sus tipos y de su número, y al final el de servicios generales. El TSG directo
     desde el TG no tiene medidor. */
  const sinMed = m => m.tab === "TSG" && r.topo && r.topo.tsgTG,
    dep = M.filter(m => m.orden).sort((x, y) => x.orden[0] - y.orden[0] || x.orden[1] - y.orden[1]),
    out = [...dep, ...M.filter(m => !m.orden)];
  let n = 0;
  out.forEach(m => (m.med = sinMed(m) ? "" : `M-${++n}`));
  return out;
}
function bancoMedidores(r) {
  if (r.mode !== "multi") return null;
  const c = r.c,
    bm = c.bm,
    o = [],
    { L, T, R } = trazos(o);
  const { INK, NAVY, CU, GR, LN, VE } = PAL,
    W = 1123;
  // Fases en sus colores (js/planos/dibujo.js); en esta lámina el neutro va en gris
  const COLF = { R: COND.R, S: COND.S, T: COND.T, N: "#8a9199" };
  const titulo = (x, y, w, t) => {
    R(x, y, w, 18, { st: "", fi: NAVY });
    T(x + w / 2, y + 12.5, t, { s: 8.5, b: 1, a: "middle", f: "#fff" });
  };
  const tri = SIST[r.sk].tri;
  const M = suministrosBanco(r);
  /* Letra que cabe en un ancho (px): la de s o una más chica, hasta 4.6 (ancho medio de la letra en negrita, 0.6 de
     su tamaño); si aún no cabe, el texto se corta con «…» */
  const cabe = (txt, w, s) => {
    const t = Math.max(4.6, Math.min(s, w / (0.6 * txt.length)));
    if (t * 0.6 * txt.length <= w) return [txt, t];
    const n = Math.max(1, Math.floor(w / (0.6 * t)) - 1);
    return [txt.slice(0, n) + "…", t];
  };
  T(20, 28, "BANCO DE MEDIDORES Y BALANCE DE FASES", { s: 13, b: 1, f: NAVY });
  T(
    20,
    43,
    `Vista exterior con las medidas de la concesionaria (${bm.conc}) · fase de cada suministro según el balance · escala S/E`,
    { s: 8.5, f: GR }
  );

  /* ---------- Vista frontal ---------- */
  const xA = 20,
    wA = 560,
    yA = 58;
  titulo(xA, yA, wA, "VISTA EXTERIOR · CAJAS DE LA CONCESIONARIA");
  o.push(`<g data-capa="E-DETALLE">`);
  const caja = m => (m.tri ? [bm.ltrA, bm.ltrH, "LTR"] : [bm.lrmA, bm.lrmH, "LRM"]);
  // Con pocos medidores, una sola fila (hasta 4 cajas por fila antes de pasar a la siguiente: criterio de dibujo)
  const nf = Math.min(bm.filas, Math.max(1, Math.ceil(M.length / 4))),
    per = Math.ceil(M.length / nf),
    filas = [];
  for (let i = 0; i < M.length; i += per) filas.push(M.slice(i, i + per));
  // Filas de abajo hacia arriba: la primera lista va arriba, como se lee el banco
  const abajo = filas.slice().reverse(),
    altoF = abajo.map(f => Math.max(...f.map(m => caja(m)[1]))),
    largoF = abajo.map(f => f.reduce((s, m) => s + caja(m)[0], 0)),
    D = Math.max(...largoF);
  const yb = [];
  let ytop = bm.tomaS + bm.base;
  abajo.forEach((f, i) => {
    yb.push(ytop);
    ytop += altoF[i] + (i < abajo.length - 1 ? bm.sepF : 0);
  });
  const okH = ytop <= bm.hMax + 1e-9;
  // Escala: el banco y sus cotas dentro del recuadro
  const anchoM = bm.tomaA + bm.sepT + D,
    altoM = Math.max(ytop, bm.hMax, bm.tomaS + bm.tomaH) + 0.15,
    k = Math.min((wA - 200) / anchoM, 400 / altoM),
    X0 = xA + 70 + (wA - 200 - anchoM * k) / 2,
    Y0 = yA + 52 + altoM * k,
    X = m => X0 + m * k,
    Y = m => Y0 - m * k;
  // Cota con flechas y texto (vertical a la izquierda o derecha, horizontal abajo)
  const cota = (x1, y1, x2, y2, txt, lado = 1) => {
    const v = x1 === x2;
    L(x1, y1, x2, y2, 0.6, GR);
    [
      [x1, y1],
      [x2, y2]
    ].forEach(([x, y]) => L(x - 2.5, y + 2.5, x + 2.5, y - 2.5, 0.8, GR));
    if (v) T(x1 + lado * 4, (y1 + y2) / 2 + 3, txt, { s: 7, a: lado > 0 ? "start" : "end", f: GR });
    else T((x1 + x2) / 2, y1 + 10 * lado, txt, { s: 7, a: "middle", f: GR });
  };
  // Suelo y altura máxima
  L(xA + 10, Y0, xA + wA - 10, Y0, 1.6, INK);
  for (let x = xA + 14; x < xA + wA - 14; x += 9) L(x, Y0 + 6, x + 6, Y0, 0.5, GR);
  T(xA + wA - 14, Y0 + 16, "Nivel de suelo", { s: 7, a: "end", f: GR });
  L(X(-0.1), Y(bm.hMax), X(anchoM + 0.05), Y(bm.hMax), 0.7, "#b42318", "5 3");
  T(X(anchoM + 0.05), Y(bm.hMax) - 3, `Altura máxima ${fmt(bm.hMax, 2)} m`, { s: 7, a: "end", f: "#b42318" });
  // Caja toma F1 y llegada de la acometida
  const cTw = bm.tomaA * k,
    cTh = bm.tomaH * k,
    cTx = X(0),
    cTy = Y(bm.tomaS + bm.tomaH);
  R(cTx, cTy, cTw, cTh, { fi: "#c9ced5", sw: 1.2 });
  R(cTx + 4, cTy + 4, cTw - 8, cTh - 8, { fi: "#e6e9ed", sw: 0.8 });
  R(cTx + cTw - 10, cTy + cTh / 2 + 14, 3, 12, { fi: INK, st: "", sw: 0 });
  T(cTx + cTw / 2, cTy + cTh - 8, "Concesionaria", { s: 6, a: "middle", f: GR });
  ["CAJA", "TOMA", "F1"].forEach((t, i) =>
    T(X(bm.tomaA / 2), Y(bm.tomaS + bm.tomaH / 2) - 8 + i * 9, t, { s: 7.4, b: 1, a: "middle" })
  );
  L(X(bm.tomaA / 2) - 4, Y(bm.tomaS), X(bm.tomaA / 2) - 4, Y0, 0.8, INK, "3 2");
  L(X(bm.tomaA / 2) + 4, Y(bm.tomaS), X(bm.tomaA / 2) + 4, Y0, 0.8, INK, "3 2");
  T(X(bm.tomaA / 2) + 8, Y(bm.tomaS / 2), "Acometida", { s: 6.8, f: GR });
  // Cajas de medidores
  abajo.forEach((f, i) => {
    let x = bm.tomaA + bm.sepT;
    f.forEach(m => {
      const [a, h, tp] = caja(m),
        bx = X(x),
        by = Y(yb[i] + h),
        bw = a * k,
        bh = h * k;
      R(bx, by, bw, bh, { fi: "#c9ced5", sw: 1.1 });
      R(bx + 3, by + 3, bw - 6, bh - 6, { fi: "#f3f6f9", sw: 0.7 });
      // Visor con el medidor: pantalla y placa de datos
      const vw = bw * 0.7,
        vx = bx + (bw - vw) / 2,
        vy = by + bh * 0.08,
        vh = bh * 0.38;
      R(vx, vy, vw, vh, { fi: "#fff", st: GR, sw: 0.7 });
      R(vx + vw * 0.15, vy + vh * 0.14, vw * 0.7, vh * 0.3, { fi: "#d9eedf", st: GR, sw: 0.5 });
      T(bx + bw / 2, vy + vh * 0.37, "0000", { s: 5.6, b: 1, a: "middle", f: INK });
      T(bx + bw / 2, vy + vh * 0.8, "kWh", { s: 5.6, b: 1, a: "middle", f: GR });
      R(bx + bw - 7, by + bh * 0.62, 2.5, 9, { fi: INK, st: "", sw: 0 });
      // Número del medidor y su tablero (el nombre completo está en el cuadro de suministros)
      [
        [m.med || m.nom, 0.53, 6.6],
        [m.tab, 0.64, 5.8]
      ].forEach(([t0, fy, s0]) => {
        const [t, s] = cabe(t0, bw - 16, s0);
        T(bx + bw / 2, by + bh * fy, t, { s, b: 1, a: "middle", f: NAVY });
      });
      const fc = m.fase.length === 1 ? COLF[m.fase] || INK : INK;
      T(bx + bw / 2, by + bh * 0.77, m.fase, { s: 7, b: 1, a: "middle", f: fc });
      T(bx + bw / 2, by + bh * 0.9, tp, { s: 6, a: "middle", f: GR });
      // Salida de la instalación interna hacia el tablero del suministro
      L(bx + bw / 2, by, bx + bw / 2, by - 10, 0.7, INK, "3 2");
      x += a;
    });
  });
  // Cotas: caja toma (izquierda), filas (derecha), anchos (abajo)
  cota(X(-0.06), Y0, X(-0.06), Y(bm.tomaS), `${fmt(bm.tomaS, 2)} m`, -1);
  cota(X(-0.06), Y(bm.tomaS), X(-0.06), Y(bm.tomaS + bm.tomaH), `${fmt(bm.tomaH, 2)} m`, -1);
  const xr = X(bm.tomaA + bm.sepT + D) + 8;
  cota(xr, Y0, xr, Y(bm.tomaS), `${fmt(bm.tomaS, 2)} m`);
  cota(xr, Y(bm.tomaS), xr, Y(bm.tomaS + bm.base), `${fmt(bm.base, 2)} m`);
  cota(xr + 44, Y0, xr + 44, Y(ytop), `${fmt(ytop, 2)} m`);
  T(xr + 48, Y(ytop / 2) + 13, "al borde", { s: 6.2, f: GR });
  T(xr + 48, Y(ytop / 2) + 21, "superior", { s: 6.2, f: GR });
  // Ancho de cada tipo de caja, debajo de la primera de su tipo
  const vistos = {};
  abajo.forEach((f, i) => {
    let x = bm.tomaA + bm.sepT;
    f.forEach(m => {
      const [a, , tp] = caja(m);
      if (!vistos[tp]) {
        vistos[tp] = 1;
        cota(X(x), Y(yb[i]) + 7, X(x + a), Y(yb[i]) + 7, `${fmt(a, 2)} m`);
      }
      x += a;
    });
  });
  abajo.forEach((f, i) => {
    cota(xr, Y(yb[i]), xr, Y(yb[i] + altoF[i]), `${fmt(altoF[i], 2)} m`);
    if (i < abajo.length - 1) cota(xr, Y(yb[i] + altoF[i]), xr, Y(yb[i + 1]), `${fmt(bm.sepF, 2)} m`);
  });
  const yc = Y0 + 14;
  cota(X(0), yc, X(bm.tomaA), yc, `${fmt(bm.tomaA, 2)} m`);
  cota(X(bm.tomaA), yc, X(bm.tomaA + bm.sepT), yc, `${fmt(bm.sepT, 2)} m`);
  cota(X(bm.tomaA + bm.sepT), yc, X(bm.tomaA + bm.sepT + D), yc, `D = ${fmt(D, 2)} m`);
  T(
    X(bm.tomaA + bm.sepT),
    yc + 22,
    `D = número de conexiones (${Math.max(...abajo.map(f => f.length))}) × ancho de caja`,
    {
      s: 6.8,
      f: GR
    }
  );
  T(
    xA + 14,
    yA + 32,
    `Altura del banco ${fmt(ytop, 2)} m ${okH ? "≤" : ">"} ${fmt(bm.hMax, 2)} m · ${okH ? "Cumple" : "Revisar"}`,
    { s: 7.4, b: 1, f: okH ? VE : "#b42318" }
  );
  T(xA + 14, yA + 43, "Rotular el N.° de departamento u oficina en cada caja", { s: 7, f: GR });
  T(
    xA + 14,
    yA + 54,
    `Caja LRM (monofásica) ${fmt(bm.lrmA, 2)} × ${fmt(bm.lrmH, 2)} m${M.some(m => m.tri) ? ` · caja LTR (trifásica) ${fmt(bm.ltrA, 2)} × ${fmt(bm.ltrH, 2)} m` : ""} · caja toma ${fmt(bm.tomaA, 2)} × ${fmt(bm.tomaH, 2)} m (ancho × alto)`,
    { s: 7, f: GR }
  );
  o.push(`</g>`);
  const yFinA = yc + 32;

  /* ---------- Balance de cargas por fase y asignación de cada suministro ---------- */
  const xB = 600,
    wB = W - 20 - xB;
  titulo(xB, yA, wB, "BALANCE DE CARGAS POR FASE");
  o.push(`<g data-capa="E-DETALLE">`);
  let yBal = yA + 40;
  // Suministros conectados a cada fase (el interior del tablero general, lámina IE-05, muestra sus conexiones)
  if (tri) {
    T(xB + 10, yBal, "SUMINISTROS POR FASE", { s: 7.6, b: 1, f: NAVY });
    yBal += 14;
    ["R", "S", "T"].forEach(f => {
      const de = M.filter(m => m.fase === f || m.tri).map(m => m.nom);
      T(xB + 14, yBal, f, { s: 7.6, b: 1, f: COLF[f] });
      T(xB + 28, yBal, de.join(" · ") || "—", { s: 7.2 });
      yBal += 13;
    });
    yBal += 12;
  }
  if (r.bal) {
    T(xB + 10, yBal, "DEMANDA POR FASE", { s: 7.6, b: 1, f: NAVY });
    yBal += 10;
    const pmax = Math.max(...r.bal.ph),
      wbar = wB - 200;
    r.bal.nm.forEach((f, i) => {
      const y = yBal + i * 16,
        v = r.bal.ph[i];
      T(xB + 14, y + 9, f, { s: 7.4, b: 1, f: COLF[f] || INK });
      R(xB + 28, y + 1, wbar, 10, { fi: "#eef1f4", st: "" });
      R(xB + 28, y + 1, (wbar * v) / pmax, 10, { fi: COLF[f] || INK, st: "" });
      T(xB + 34 + wbar, y + 9, `${fmt(v / 1000, 2)} kW · ${fmt((v / r.bal.avg - 1) * 100, 1)} %`, { s: 7 });
    });
    yBal += r.bal.nm.length * 16 + 6;
    const okB = r.bal.desb <= 10 + 1e-9;
    T(
      xB + 14,
      yBal + 6,
      `Desbalance ${fmt(r.bal.desb, 1)} % ${okB ? "≤" : ">"} 10 % (criterio de diseño) · ${okB ? "Cumple" : r.bal.desb <= r.bal.desbMin + 0.05 ? "mínimo posible" : "revisar el reparto"}`,
      { s: 7.4, b: 1, f: okB ? VE : CU }
    );
    yBal += 14;
    // Con pocos suministros grandes (los departamentos van completos a una fase) el reparto no puede equilibrarse
    if (!okB && r.bal.desb <= r.bal.desbMin + 0.05)
      T(
        xB + 14,
        yBal + 4,
        "Con suministros monofásicos que van completos a una fase, este es el menor desbalance posible.",
        {
          s: 6.8,
          f: GR
        }
      );
    yBal += 12;
  }
  o.push(`</g>`);

  /* ---------- Cuadro de suministros y calibres de la concesionaria ---------- */
  let yC = Math.max(yFinA, yBal) + 10;
  o.push(`<g data-capa="E-CUADROS">`);
  titulo(20, yC, W - 40, "CUADRO DE SUMINISTROS DEL BANCO DE MEDIDORES");
  yC += 18;
  const cols = [
    ["N.°", 20, 36, "middle"],
    ["Suministro", 56, 190, "start"],
    ["Conexión", 246, 70, "start"],
    ["Caja", 316, 40, "start"],
    ["MD (kW)", 356, 60, "end"],
    ["Fase", 416, 50, "middle"],
    ["ITM", 466, 60, "middle"],
    ["Conductor de la instalación interna", 526, 210, "start"],
    [`Calibre según ${bm.conc === "Luz del Sur" ? "Luz del Sur" : "Luz del Sur (referencia)"}`, 736, 200, "start"],
    ["Estado", 936, 167, "start"]
  ];
  const tx = ([, x, w, a]) => (a === "middle" ? x + w / 2 : a === "end" ? x + w - 6 : x + 6);
  R(20, yC, W - 40, 15, { st: LN, fi: "#e3e9f0", sw: 0.8 });
  cols.forEach(cl => T(tx(cl), yC + 10.5, cl[0], { s: 6.8, b: 1, a: cl[3], f: GR }));
  yC += 15;
  M.forEach((m, i) => {
    const v = calibreConc(m.tri, m.kW),
      S = m.a.S;
    const txt = v.fuera
      ? "Fuera de la tabla: consultar"
      : `Hasta ${v.tope} kW · ${v.min != null ? `mín. ${v.min} mm²` : "mín. no definido"}${v.max != null ? ` · máx. ${v.max} mm²` : ""}`;
    const est = v.fuera
      ? ["Consultar a la concesionaria", CU]
      : v.min != null && S < v.min
        ? [`Menor que el mínimo (${v.min} mm²)`, "#b42318"]
        : v.max != null && S > v.max
          ? [`Mayor que el máximo (${v.max} mm²)`, CU]
          : v.dudoso
            ? ["Ver nota 4", CU]
            : ["Cumple", VE];
    R(20, yC, W - 40, 14, { st: LN, fi: i % 2 ? "#fff" : "#f7f9fb", sw: 0.6 });
    const val = [
      m.med || String(i + 1),
      m.tab === "TSG"
        ? "TSG · Servicios generales"
        : // El tipo, si el nombre del suministro no lo dice ya (DISCOTECA-1 es del tipo DISCOTECA; A-1, del Tipo A)
          `${m.nom}${m.nom.startsWith(m.tipo) ? "" : " · " + m.tipo} (${m.tab})`,
      m.tri ? "Trifásica" : "Monofásica",
      m.tri ? "LTR" : "LRM",
      fmt(m.kW, 2),
      m.fase,
      `${m.a.s.tri ? 3 : 2}×${m.a.itm} A`,
      `${m.a.s.tri ? 4 : 2}-1×${S} + 1×${m.a.St}(T) mm²${c.desig ? " " + c.desig : ""}`,
      txt,
      est[0]
    ];
    cols.forEach((cl, j) => {
      // Cada texto dentro de su columna
      const [t, s] = cabe(val[j], cl[2] - 10, 6.8);
      T(tx(cl), yC + 10, t, {
        s,
        b: j === 1 || j === 9,
        a: cl[3],
        f: j === 9 ? est[1] : j === 5 && m.fase.length === 1 ? COLF[m.fase] || INK : INK
      });
    });
    yC += 14;
  });
  // Tabla de la concesionaria, transcrita
  yC += 14;
  T(20, yC, "CALIBRE DE INSTALACIÓN INTERNA · LUZ DEL SUR (plano «Banco de medidores en 2 filas»)", {
    s: 7.6,
    b: 1,
    f: NAVY
  });
  yC += 6;
  const cc = [
    ["Conexión", 20, 110],
    ["Potencia", 130, 90],
    ["Sección", 220, 90],
    ["AWG", 310, 70],
    ["mm²", 380, 60],
    ["Tipo", 440, 70]
  ];
  R(20, yC, 490, 14, { st: LN, fi: "#e3e9f0", sw: 0.8 });
  cc.forEach(([t, x]) => T(x + 6, yC + 10, t, { s: 6.6, b: 1, f: GR }));
  yC += 14;
  CALIBRE_LDS.forEach((x, i) => {
    R(20, yC, 490, 12.5, { st: LN, fi: i % 2 ? "#fff" : "#f7f9fb", sw: 0.5 });
    [x[0], `hasta ${x[1]} kW`, x[2], x[3], String(x[4]), x[5]].forEach((t, j) =>
      T(cc[j][1] + 6, yC + 9, t, { s: 6.6 })
    );
    yC += 12.5;
  });
  o.push(`</g>`);

  /* ---------- Notas y rótulo ---------- */
  const yr = yC + 16,
    hr = 124,
    rx = W - 480,
    rw = W - 20 - rx;
  const notas = [
    `Medidas del banco según la concesionaria (${bm.conc}), editables en Parámetros › Banco de medidores; no las fija el CNE.`,
    `La cajuela respeta ${fmt(bm.dist, 2)} m respecto a las instalaciones de gas, agua y desagüe; su fondo es de material noble; se respetan las distancias mínimas de seguridad del CNE.`,
    "Cada suministro se conecta a la fase que le asigna el balance de cargas (departamentos completos a una fase); el interruptor general y su alimentador son los del cálculo (lámina IE-01).",
    "Tabla de calibres transcrita de Luz del Sur: se verifica el mínimo del rango cuando la tabla indica uno solo y el máximo cuando lo indica. «Hasta 10 kW» monofásico solo da un máximo y «hasta 20 kW» trifásico da dos mínimos: confirmar con la concesionaria.",
    "Se deja una reserva de conductor no menor de 450 mm en los puntos de conexión de cada medidor (Regla 040-402(1)(c)).",
    bm.conc !== "Luz del Sur" ? `La tabla de calibres es la de Luz del Sur: verifíquela con la de ${bm.conc}.` : ""
  ].filter(Boolean);
  notasSvg(o, 20, yr, rx - 40, hr, notas);
  rotuloSvg(o, rx, yr, rw, hr, c.proj, "Banco de medidores y balance de fases · Escala S/E", "IE-06");
  const H = yr + hr + 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/><rect x="6" y="4" width="${W - 12}" height="${H - 10}" fill="none" stroke="${NAVY}" stroke-width="1.5"/>${o.join("")}</svg>`;
  return { svg, W, H };
}
function cardMedidores(r, nro) {
  const u = bancoMedidores(r);
  if (!u)
    return `<section class="card"><h2><span><span class="num">${nro}</span>Banco de medidores</span></h2><div class="body"><p class="hint">El banco de medidores corresponde a los edificios multifamiliares. En una vivienda unifamiliar el medidor va en su caja, según la concesionaria.</p></div></section>`;
  return `<section class="card"><h2><span><span class="num">${nro}</span>Banco de medidores y balance de fases</span></h2>
  <div class="unif">${u.svg}</div><div class="body"><p class="hint">Vista frontal con las medidas de la concesionaria (Parámetros › Banco de medidores, Luz del Sur por defecto), conexión de cada suministro a su fase según el balance y verificación del calibre de la instalación interna. Se descarga en DXF, PNG y SVG desde la cinta (Planos).</p></div></section>`;
}
