/* MEMORIA DE CÁLCULO EN EXCEL
   Genera el libro .xlsx (con la librería ExcelJS) con fórmulas vinculadas: parámetros, máxima demanda,
   alimentadores, circuitos, puesta a tierra, metrado y verificaciones. */
async function exportar() {
  const r = LAST,
    c = r.c,
    multi = r.mode === "multi",
    a0 = r.alims[0];
  const wb = new ExcelJS.Workbook();
  wb.creator = "JMG - ELECTRIC";
  wb.company = "JMG - ELECTRIC";
  wb.created = new Date();
  const K = {
    navy: "FF14304F",
    soft: "FFEAF0F6",
    lab: "FFF3F6F9",
    inp: "FFEEF5FC",
    blue: "FF1F4FB4",
    grey: "FF5A6775",
    line: "FFBFC8D2",
    copper: "FF9A5A23",
    tot: "FFFBEFE3",
    ink: "FF14212E"
  };
  const thin = { style: "thin", color: { argb: K.line } },
    BOX = { top: thin, left: thin, bottom: thin, right: thin };
  const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const F = (f, v) => ({ formula: f, result: v });
  const logoId = typeof LOGO_JPG === "string" ? wb.addImage({ base64: LOGO_JPG, extension: "jpeg" }) : null;
  const proyCip = (c.proj.proy || "—") + (c.proj.cip ? ` · CIP ${c.proj.cip}` : "");
  const wsM = wb.addWorksheet("Memoria", { properties: { tabColor: { argb: K.navy } } });
  const wsC = wb.addWorksheet("Cálculos", { properties: { tabColor: { argb: K.copper } } });
  const wsU = wb.addWorksheet("Unifilar", { properties: { tabColor: { argb: "FF2F7A4B" } } });
  const wsA = wb.addWorksheet("Alturas", { properties: { tabColor: { argb: "FF9A5A23" } } });
  const wsD = wb.addWorksheet("Detalles", { properties: { tabColor: { argb: "FF14304F" } } });
  const wsB = wb.addWorksheet("Tableros", { properties: { tabColor: { argb: "FFFFD200" } } });
  // Banco de medidores: solo en edificios (una hoja más)
  // Presupuesto: solo si el proyecto tiene precios unitarios (js/resultados/presupuesto.js; una hoja más)
  const PRE = typeof preCalc === "function" ? preCalc(r) : null,
    conPre = !!(PRE && PRE.nP);
  const wsTG = multi ? wb.addWorksheet("TG", { properties: { tabColor: { argb: "FFC62828" } } }) : null,
    wsBM = multi ? wb.addWorksheet("Medidores", { properties: { tabColor: { argb: "FF2F7A4B" } } }) : null,
    NH = (multi ? 10 : 8) + (conPre ? 1 : 0);
  const wsT = wb.addWorksheet("Metrado", { properties: { tabColor: { argb: "FF22507C" } } });
  const wsP = conPre ? wb.addWorksheet("Presupuesto", { properties: { tabColor: { argb: "FF9A5A23" } } }) : null;
  const wsX = wb.addWorksheet("Anexos", { properties: { tabColor: { argb: "FF5A6775" } } });
  const setup = (ws, orient, widths) => {
    ws.columns = widths.map(w => ({ width: w }));
    ws.views = [{ showGridLines: false }];
    ws.pageSetup = {
      paperSize: 9,
      orientation: orient,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.45, right: 0.45, top: 0.55, bottom: 0.6, header: 0.25, footer: 0.3 }
    };
    ws.headerFooter = {
      oddFooter:
        '&L&"Arial,Bold"&8JMG - ELECTRIC&"Arial,Regular" · Memoria de cálculo&C&"Arial,Regular"&8&A&R&"Arial,Regular"&8Página &P de &N'
    };
  };
  const cell = (ws, r_, c_, v, st = {}) => {
    const x = ws.getCell(r_, c_);
    if (v !== undefined) x.value = v;
    x.font = {
      name: "Arial",
      size: st.size || 9,
      bold: !!st.bold,
      italic: !!st.it,
      color: { argb: st.color || K.ink }
    };
    if (st.fill) x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: st.fill } };
    x.alignment = {
      vertical: "middle",
      horizontal: st.h || "left",
      wrapText: !!st.wrap,
      indent: st.ind || 0,
      shrinkToFit: !!st.shrink
    };
    if (st.box) x.border = BOX;
    if (st.fmt) x.numFmt = st.fmt;
    return x;
  };
  const span = (ws, r_, c1, c2, v, st = {}) => {
    if (c2 > c1) ws.mergeCells(r_, c1, r_, c2);
    const x = cell(ws, r_, c1, v, st);
    for (let k = c1 + 1; k <= c2; k++) {
      const y = ws.getCell(r_, k);
      if (st.box) y.border = BOX;
      if (st.fill) y.fill = { type: "pattern", pattern: "solid", fgColor: { argb: st.fill } };
    }
    return x;
  };
  const inp = { box: 1, fill: K.inp, color: K.blue, bold: 1, h: "center" };
  const val = { box: 1, h: "center" };
  const cabecera = (ws, last, sub, hoja) => {
    ws.getRow(1).height = 30;
    span(ws, 1, 1, 2, "JMG - ELECTRIC", {
      bold: 1,
      size: 11,
      color: "FFFFD200",
      fill: "FF1F2328",
      h: logoId === null ? "center" : "right",
      shrink: 1
    });
    if (logoId !== null) ws.addImage(logoId, { tl: { col: 0.06, row: 0.06 }, ext: { width: 36, height: 36 } });
    span(ws, 1, 3, last, "MEMORIA DE CÁLCULO DE INSTALACIONES ELÉCTRICAS INTERIORES", {
      bold: 1,
      size: 11,
      color: "FFFFFFFF",
      fill: K.navy,
      h: "center"
    });
    ws.getRow(2).height = 19;
    span(ws, 2, 1, last, sub, { bold: 1, size: 10, color: K.navy, fill: K.soft, h: "center" });
    const half = Math.floor(last / 2);
    [
      ["Proyecto", c.proj.nombre || "—"],
      ["Propietario", c.proj.prop || "—"],
      ["Ubicación", c.proj.ubic || "—"],
      ["Proyectista", proyCip],
      ["Normativa", "CNE-Utilización · RNE EM.010 · Norma DGE"],
      ["Fecha · Hoja", `${fecha} · ${hoja}`]
    ].forEach(([k, v], i) => {
      const rw = 3 + Math.floor(i / 2),
        left = i % 2 === 0,
        c1 = left ? 1 : half + 1,
        c2 = left ? half : last;
      span(ws, rw, c1, c1 + 1, k.toUpperCase(), { bold: 1, size: 7.5, color: K.grey, fill: K.lab, box: 1 });
      span(ws, rw, c1 + 2, c2, v, { box: 1, size: 9, shrink: 1 });
      ws.getRow(rw).height = 17;
    });
    return 7;
  };
  const seccion = (ws, rw, last, txt) => {
    ws.getRow(rw).height = 22;
    span(ws, rw, 1, last, txt, { bold: 1, size: 10.5, color: K.navy });
    for (let k = 1; k <= last; k++) ws.getCell(rw, k).border = { bottom: { style: "medium", color: { argb: K.navy } } };
    return rw + 2;
  };
  const sub = (ws, rw, last, txt) => {
    span(ws, rw, 1, last, txt, { bold: 1, size: 9, color: K.copper });
    return rw + 1;
  };
  const thead = (ws, rw, specs) => {
    ws.getRow(rw).height = 30;
    specs.forEach(([c1, c2, t]) =>
      span(ws, rw, c1, c2, t, { bold: 1, size: 8, color: "FFFFFFFF", fill: K.navy, h: "center", wrap: 1, box: 1 })
    );
    return rw + 1;
  };
  const nota = (ws, rw, last, txt) => {
    span(ws, rw, 1, last, txt, { it: 1, size: 8, color: K.grey, wrap: 1 });
    ws.getRow(rw).height = Math.max(15, Math.ceil(txt.length / 120) * 13);
    return rw + 1;
  };
  const tot = (ws, rw, c1, c2) => {
    for (let k = c1; k <= c2; k++) {
      const x = ws.getCell(rw, k);
      x.font = { ...x.font, bold: true };
      x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: K.tot } };
      x.border = { ...BOX, top: { style: "medium", color: { argb: K.navy } } };
    }
  };
  const okF = { type: "pattern", pattern: "solid", bgColor: { argb: "FFDDF0E2" } },
    badF = { type: "pattern", pattern: "solid", bgColor: { argb: "FFF8D9D5" } };
  const obsF = { type: "pattern", pattern: "solid", bgColor: { argb: "FFFBF0D9" } };
  const cfmt = (ws, ref) =>
    ws.addConditionalFormatting({
      ref,
      rules: [
        {
          type: "containsText",
          operator: "containsText",
          text: "REVISAR",
          style: { fill: badF, font: { color: { argb: "FFA3302A" }, bold: true } }
        },
        {
          type: "containsText",
          operator: "containsText",
          text: "CONFORME",
          style: { fill: okF, font: { color: { argb: "FF22693F" }, bold: true } }
        },
        {
          type: "containsText",
          operator: "containsText",
          text: "OBSERVACIÓN",
          style: { fill: obsF, font: { color: { argb: "FF8A5A00" }, bold: true } }
        }
      ]
    });
  // Lo que comparten las hojas (las partes están en js/excel-*.js)
  const X = {
    r,
    c,
    multi,
    a0,
    wb,
    K,
    F,
    wsM,
    wsC,
    wsU,
    wsA,
    wsD,
    wsB,
    wsTG,
    wsBM,
    NH,
    wsT,
    wsP,
    PRE,
    wsX,
    setup,
    cell,
    span,
    inp,
    val,
    cabecera,
    seccion,
    sub,
    thead,
    nota,
    tot,
    cfmt
  };
  Object.assign(X, excelAnexos(X));
  Object.assign(X, excelMemoria(X));
  Object.assign(X, excelCalculos(X));
  excelResumen(X);
  await excelPlanos(X);
  excelMetrado(X);
  excelPresupuesto(X);

  wb.calcProperties.fullCalcOnLoad = true;
  return await wb.xlsx.writeBuffer();
}
