/* MEMORIA EN EXCEL · MEMORIA (continuación): resumen, suministro, puesta a tierra, verificaciones y firmas.
   Parte de exportar() (js/exportar/excel.js): recibe en X el libro, los estilos, las ayudas y lo que dejaron las hojas
   anteriores. */
function excelResumen(X) {
  const {
    r,
    c,
    multi,
    a0,
    K,
    F,
    wsM,
    cell,
    span,
    inp,
    val,
    seccion,
    thead,
    nota,
    cfmt,
    LM,
    MDREF,
    tipoRow,
    genRow,
    cStart,
    subRows,
    subMul,
    cEnd,
    balRow
  } = X;
  let { m } = X;
  /* ---------- MEMORIA: resumen, suministro, tierra y firmas ---------- */
  wsM.getRow(m - 1).addPageBreak();
  m = seccion(wsM, m, LM, "3.  RESUMEN DE RESULTADOS");
  m = thead(wsM, m, [
    [1, 6, "Concepto"],
    [7, 8, "Valor"],
    [9, 10, "Unidad / referencia"]
  ]);
  const rs = (lab, v, u, f) => {
    span(wsM, m, 1, 6, lab, { box: 1, ind: 1 });
    span(wsM, m, 7, 8, v, { ...val, bold: 1, fmt: f });
    span(wsM, m, 9, 10, u, { ...val, color: K.grey, size: 8 });
    m++;
  };
  const C2 = `'Cálculos'!`;
  if (multi)
    rs(
      r.TC ? "Número de unidades (departamentos y locales)" : "Número de departamentos",
      // Con locales de otro uso, sus filas están en otra tabla: se suma cada tipo
      r.TC
        ? F(r.T.map(t => `B${tipoRow[t.nombre]}`).join("+"), r.units.length)
        : F(`SUM(B${tipoRow[r.T[0].nombre]}:B${tipoRow[r.T[r.T.length - 1].nombre]})`, r.units.length),
      "unid.",
      "0"
    );
  rs("Potencia instalada", F(subRows.map((q, i) => `${subMul[i]}*${C2}E${q}`).join("+"), r.CI), "W", "0");
  rs("Máxima demanda", F(MDREF, multi ? r.MD : r.md.MD), "W", "0");
  rs("Potencia a contratar sugerida", F(`ROUNDUP(${MDREF}/500,0)/2`, r.contratada), "kW", "0.0");
  rs("Sistema de suministro", SIST[r.sk].nom, "Tabla 201-01", "@");
  rs(
    "Tipo de conexión",
    multi ? "En derivación" : "Conexión simple",
    multi ? "Banco de medidores · DGE 301.C" : "Norma DGE, 301.A",
    "@"
  );
  rs(`Corriente nominal del alimentador ${multi ? "general" : "principal"}`, F(`${C2}H${genRow}`, a0.I), "A", "0.00");
  rs(
    "Interruptor termomagnético general",
    F(`"${a0.s.tri ? 3 : 2}×"&${C2}J${genRow}&" A · ${a0.pdc} kA"`, `${a0.s.tri ? 3 : 2}×${a0.itm} A · ${a0.pdc} kA`),
    "",
    "@"
  );
  rs(
    `Conductor del alimentador ${multi ? "general" : "principal"}`,
    F(
      `"${a0.s.n}-1×"&${C2}K${genRow}&" mm² Cu${c.desig ? " " + c.desig : ""}"`,
      `${a0.s.n}-1×${a0.S} mm² Cu${c.desig ? " " + c.desig : ""}`
    ),
    "",
    "@"
  );
  rs(
    "Caída de tensión máxima total",
    F(`MAX(${C2}O${cStart}:O${cEnd})`, Math.max(...r.circ.map(q => q.dVt))),
    "% · límite 4 %",
    "0.00"
  );
  rs(
    "Circuitos derivados",
    F(`COUNTIF(${C2}P${cStart}:P${cEnd},"CONFORME")+COUNTIF(${C2}P${cStart}:P${cEnd},"REVISAR")`, r.circ.length),
    `+ ${c.reserva} de reserva por tablero`,
    "0"
  );
  if (r.bal) rs("Desbalance de cargas entre fases", F(`${C2}D${balRow}`, r.bal.desb / 100), "criterio ≤ 10 %", "0.0%");
  rs(
    "Verificación general",
    F(
      `IF(COUNTIF(${C2}P${genRow}:P${cEnd},"REVISAR")=0,"CONFORME","REVISAR")`,
      r.alims.every(a => a.ok) && r.circ.every(q => q.ok) ? "CONFORME" : "REVISAR"
    ),
    "",
    "@"
  );
  cfmt(wsM, `G${m - 1}:H${m - 1}`);
  m++;
  const p = r.pat;
  m = seccion(wsM, m, LM, "4.  SISTEMA DE PUESTA A TIERRA");
  m = thead(wsM, m, [
    [1, 4, "Parámetro"],
    [5, 6, "Valor"],
    [7, 7, "Unidad"],
    [8, 10, "Criterio"]
  ]);
  const p0 = m;
  const pr = (lab, v, u, crit, st) => {
    span(wsM, m, 1, 4, lab, { box: 1, ind: 1 });
    span(wsM, m, 5, 6, v, st);
    cell(wsM, m, 7, u, { ...val, color: K.grey });
    span(wsM, m, 8, 10, crit, { box: 1, size: 8, color: K.grey });
    m++;
  };
  pr("Resistividad del suelo", p.rho, "Ω·m", "Medición por método de Wenner", { ...inp, fmt: "0" });
  pr("Longitud de la varilla", p.Lv, "m", "Mínimo 2 m · Regla 060-702(3)", { ...inp, fmt: "0.00" });
  pr("Diámetro de la varilla", p.dv, "m", "Cu ≥ 13 mm; acero-cobre ≥ 16 mm", { ...inp, fmt: "0.0000" });
  pr(
    "Resistencia del electrodo sin tratamiento",
    F(`E${p0}/(2*PI()*E${p0 + 1})*(LN(4*E${p0 + 1}/(E${p0 + 2}/2))-1)`, p.Rv),
    "Ω",
    "Electrodo vertical (Dwight)",
    { ...val, fmt: "0.00" }
  );
  pr("Factor de reducción por tratamiento", p.fr, "—", "Bentonita, gel u otro (estimado)", { ...inp, fmt: "0.00" });
  pr("Resistencia con tratamiento", F(`E${p0 + 3}*E${p0 + 4}`, p.Rt), "Ω", "Valor esperado", {
    ...val,
    fmt: "0.00",
    bold: 1
  });
  pr("Electrodos (varillas) en paralelo", p.nVar, "unid.", "Separación ≥ longitud de varilla (mín. 2 m)", {
    ...inp,
    fmt: "0"
  });
  const nC = `E${p0 + 6}`,
    fx = FAGR.slice(1).reduceRight(
      (acc, [n1, f1], i) => {
        const [n0, f0] = FAGR[i];
        return `IF(${nC}<=${n1},${f0}+${+(f1 - f0).toFixed(4)}*(${nC}-${n0})/${n1 - n0},${acc})`;
      },
      String(FAGR[FAGR.length - 1][1])
    );
  pr("Factor de agrupamiento", F(`IF(${nC}<=1,1,${fx})`, p.F), "—", "Varillas en paralelo (interpolado)", {
    ...val,
    fmt: "0.00"
  });
  pr("Resistencia del conjunto", F(`E${p0 + 5}*E${p0 + 7}/${nC}`, p.Rn), "Ω", "R = Rt · F / n", {
    ...val,
    fmt: "0.00",
    bold: 1
  });
  pr("Conductor de puesta a tierra", r.Selec, "mm²", "Cobre · Tabla 17", { ...val, fmt: "0" });
  pr(
    "Verificación",
    F(`IF(E${p0 + 8}<=25,"CONFORME","REVISAR")`, p.Rn <= 25 ? "CONFORME" : "REVISAR"),
    "",
    "R ≤ 25 Ω · Regla 060-712",
    { ...val, bold: 1 }
  );
  cfmt(wsM, `E${m - 1}:F${m - 1}`);
  m++;
  m = seccion(wsM, m, LM, "5.  VERIFICACIONES NORMATIVAS");
  alertas(r).forEach(([ok, ref, t]) => {
    span(wsM, m, 1, 2, ref, { bold: 1, size: 8, color: K.navy, fill: K.lab, box: 1, wrap: 1 });
    span(wsM, m, 3, 9, t, { box: 1, wrap: 1, size: 8.5 });
    cell(wsM, m, 10, ok === true ? "CONFORME" : ok === "warn" ? "OBSERVACIÓN" : "REVISAR", {
      ...val,
      bold: 1,
      size: 8
    });
    wsM.getRow(m).height = Math.max(20, Math.ceil(t.length / 95) * 12);
    m++;
  });
  cfmt(wsM, `J${m - alertas(r).length}:J${m - 1}`);
  m++;
  m = seccion(wsM, m, LM, "6.  CONFORMIDAD");
  const firma = (c1, c2, tit, nombre, cip = "") => {
    span(wsM, m, c1, c2, tit, { bold: 1, size: 8.5, color: K.navy, fill: K.lab, box: 1, h: "center" });
    [
      ["Nombre", nombre],
      ["CIP N°", cip],
      ["Firma y sello", ""]
    ].forEach(([l, v], i) => {
      const rw = m + 1 + i;
      cell(wsM, rw, c1, l, { size: 8, color: K.grey, box: 1, fill: K.lab });
      span(wsM, rw, c1 + 1, c2, v, { box: 1 });
      wsM.getRow(rw).height = i === 2 ? 42 : 18;
    });
  };
  firma(1, 5, "ELABORADO POR", c.proj.proy || "", c.proj.cip);
  firma(6, 10, "REVISADO Y APROBADO POR", "");
  m += 5;
  nota(
    wsM,
    m,
    LM,
    `La presente memoria ha sido elaborada con JMG - ELECTRIC ${VERSION}, aplicando los criterios del Código Nacional de Electricidad – Utilización, el RNE EM.010 y las Normas DGE. Los valores obtenidos constituyen una herramienta de apoyo al diseño; su validación, adecuación a las condiciones reales de obra y firma corresponden al ingeniero proyectista responsable.`
  );
}
