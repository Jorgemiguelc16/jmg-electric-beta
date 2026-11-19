/* MEMORIA EN EXCEL · PRESUPUESTO: las partidas del metrado por sus precios unitarios (js/resultados/presupuesto.js), con
   fórmulas: la cantidad suma el desperdicio en tuberías y conductores, el parcial es cantidad × precio, cada título
   suma sus partidas y el pie lleva CD, gastos generales, utilidad, subtotal, IGV y total. Los precios, el
   desperdicio y los porcentajes son celdas de entrada: se pueden cambiar en el mismo Excel.
   Parte de exportar() (js/exportar/excel.js), solo si el proyecto tiene precios (X.PRE con alguna partida con precio). */
function excelPresupuesto(X) {
  const { c, multi, K, F, NH, wsP, PRE, setup, cell, span, inp, val, cabecera, thead, nota, tot } = X;
  if (!wsP || !PRE) return;
  const LT = 9,
    ws = wsP,
    soles = "#,##0.00";
  setup(ws, "portrait", [9, 13, 13, 13, 7, 9, 10, 11, 13]);
  let t = cabecera(ws, LT, "PRESUPUESTO DE INSTALACIONES ELÉCTRICAS", `Hoja ${multi ? 10 : 8} de ${NH}`);
  // Desperdicio de tuberías y conductores (celda de entrada)
  span(ws, t, 1, 6, "Desperdicio en tuberías y conductores (%)", {
    box: 1,
    fill: K.lab,
    size: 8.5,
    bold: 1,
    color: K.navy
  });
  const dR = t;
  cell(ws, t, 7, Math.round(PRE.d * 1e4) / 100, { ...inp, fmt: "0.##" });
  span(ws, t, 8, LT, "Metrado neto × (1 + desperdicio)", { size: 7.5, color: K.grey, it: 1, ind: 1 });
  t += 2;
  t = thead(ws, t, [
    [1, 1, "Ítem"],
    [2, 4, "Descripción"],
    [5, 5, "Und."],
    [6, 6, "Metrado"],
    [7, 7, "Cantidad"],
    [8, 8, "P. U. (S/)"],
    [9, 9, "Parcial (S/)"]
  ]);
  const t0 = t,
    titulos = [];
  let sec = null;
  const cerrarSec = () => {
    if (!sec) return;
    const f = sec.filas.length ? `SUM(I${sec.filas[0]}:I${sec.filas[sec.filas.length - 1]})` : "0";
    ws.getCell(sec.row, 9).value = F(f, Math.round(sec.sub * 100) / 100);
  };
  PRE.filas.forEach(x => {
    if (x.sec) {
      cerrarSec();
      cell(ws, t, 1, x.cod, { bold: 1, color: K.navy, fill: K.soft, box: 1, h: "center" });
      span(ws, t, 2, 8, x.sec, { bold: 1, size: 9, color: K.navy, fill: K.soft, box: 1, ind: 1 });
      cell(ws, t, 9, null, { bold: 1, color: K.navy, fill: K.soft, box: 1, h: "right", fmt: soles });
      ws.getRow(t).height = 18;
      sec = { row: t, filas: [], sub: x.sub };
      titulos.push(t);
      t++;
      return;
    }
    cell(ws, t, 1, x.cod, { ...val, size: 8.5 });
    span(ws, t, 2, 4, x.desc, { box: 1, ind: 1, wrap: 1, size: 8.5 });
    cell(ws, t, 5, x.und, val);
    cell(ws, t, 6, x.cant, { ...val, fmt: "0" });
    cell(ws, t, 7, x.desp ? F(`ROUND(F${t}*(1+$G$${dR}/100),2)`, x.q) : F(`F${t}`, x.q), { ...val, fmt: "0.##" });
    cell(ws, t, 8, x.pu ?? null, { ...inp, fmt: soles, h: "right" });
    cell(ws, t, 9, F(`IF(H${t}="","",ROUND(G${t}*H${t},2))`, x.par ?? ""), { ...val, h: "right", fmt: soles });
    ws.getRow(t).height = Math.max(16, Math.ceil(x.desc.length / 44) * 12);
    if (sec) sec.filas.push(t);
    t++;
  });
  cerrarSec();
  ws.pageSetup.printTitlesRow = `${t0 - 1}:${t0 - 1}`;
  // Pie: CD, gastos generales, utilidad, subtotal, IGV y total
  t++;
  const fila = (lab, f, v, pct, ref, st = {}) => {
    span(ws, t, 1, pct === undefined ? 8 : 6, lab, { box: 1, bold: !!st.bold, h: "right", ind: 1, size: 9 });
    if (pct !== undefined) {
      cell(ws, t, 7, pct, { ...inp, fmt: '0.##" %"' });
      cell(ws, t, 8, ref, { box: 1, size: 7, color: K.grey, wrap: 1 });
    }
    cell(ws, t, 9, F(f, v), { box: 1, h: "right", bold: !!st.bold, fmt: soles });
    ws.getRow(t).height = 18;
    return t++;
  };
  const rCD = fila("COSTO DIRECTO", titulos.length ? titulos.map(r => `I${r}`).join("+") : "0", PRE.cd, undefined, "", {
      bold: 1
    }),
    rGG = fila("Gastos generales", `ROUND(I${rCD}*G${t}/100,2)`, PRE.gg, PRESU.gg, "Criterio"),
    rUT = fila("Utilidad", `ROUND(I${rCD}*G${t}/100,2)`, PRE.ut, PRESU.ut, "Criterio"),
    rSB = fila("SUBTOTAL", `I${rCD}+I${rGG}+I${rUT}`, PRE.sub, undefined, "", { bold: 1 }),
    rIG = fila("IGV", `ROUND(I${rSB}*G${t}/100,2)`, PRE.igv, PRESU.igv, "16 % + 2 % IPM");
  fila("TOTAL PRESUPUESTO (S/)", `I${rSB}+I${rIG}`, PRE.tot, undefined, "", { bold: 1 });
  tot(ws, t - 1, 1, LT);
  t = nota(
    ws,
    t + 1,
    LT,
    `Presupuesto referencial generado con JMG - ELECTRIC ${VERSION}. Las cantidades salen del metrado (partidas de la Norma Técnica de Metrados, R.D. N.° 073-2010-VIVIENDA, título OE.5); en tuberías y conductores, la cantidad suma el desperdicio al metrado neto. Los precios unitarios (materiales y mano de obra) los pone el proyectista. Gastos generales y utilidad: porcentajes del costo directo, criterio del proyectista. IGV sobre el subtotal. Las celdas en azul se pueden cambiar.${PRE.nT > PRE.nP ? ` ${PRE.nT - PRE.nP} partida(s) sin precio no suman al costo directo.` : ""}`
  );
  const firma = (c1, c2, tit, nombre, cip = "") => {
    span(ws, t + 1, c1, c2, tit, { bold: 1, size: 8.5, color: K.navy, fill: K.lab, box: 1, h: "center" });
    [
      ["Nombre", nombre],
      ["CIP N°", cip],
      ["Firma y sello", ""]
    ].forEach(([l, v], i) => {
      const rw = t + 2 + i;
      cell(ws, rw, c1, l, { size: 8, color: K.grey, box: 1, fill: K.lab });
      span(ws, rw, c1 + 1, c2, v, { box: 1 });
      ws.getRow(rw).height = i === 2 ? 42 : 18;
    });
  };
  firma(1, 4, "ELABORADO POR", c.proj.proy || "", c.proj.cip);
  firma(5, LT, "REVISADO POR", "");
}
