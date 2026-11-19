/* MEMORIA EN EXCEL · ANEXOS: tablas del CNE-Utilización (2, 5A, 5C, 16, 17…) y normativa aplicada, que las fórmulas consultan.
   Parte de exportar() (js/exportar/excel.js): recibe en X el libro, los estilos, las ayudas y lo que dejaron las hojas
   anteriores, y devuelve lo que usan las siguientes. */
function excelAnexos(X) {
  const { c, K, NH, wsX, setup, cell, span, val, cabecera, seccion, thead, nota } = X;
  /* ---------- ANEXOS ---------- */
  setup(wsX, "portrait", [13, 13, 13, 13, 13, 13, 13, 13]);
  let x = cabecera(wsX, 8, "ANEXOS · TABLAS DEL CNE-UTILIZACIÓN Y NORMATIVA APLICADA", `Hoja ${NH} de ${NH}`);
  x = seccion(wsX, x, 8, `A.1  TABLA 2 CNE-U · CAPACIDAD DE CORRIENTE (A) · MÉTODO ${c.met}`);
  x = thead(wsX, x, [
    [1, 1, "Sección (mm²)"],
    [2, 2, "PVC 70 °C\n2 conductores"],
    [3, 3, "PVC 70 °C\n3 conductores"],
    [4, 4, "XLPE 90 °C\n2 conductores"],
    [5, 5, "XLPE 90 °C\n3 conductores"],
    [6, 6, "Ø exterior aprox. (mm)"],
    [7, 8, "Observación"]
  ]);
  const a0r = x,
    TM = T2[c.met];
  SECC.forEach((s, i) => {
    cell(wsX, x, 1, s, { ...val, bold: 1, fmt: "0.0" });
    [TM.pvc2, TM.pvc3, TM.xl2, TM.xl3].forEach((t, j) => cell(wsX, x, 2 + j, t[i], { ...val, fmt: "0.0" }));
    cell(wsX, x, 6, OD[s], { ...val, fmt: "0.0" });
    span(wsX, x, 7, 8, i === 0 ? "Ambiente 30 °C" : "", { box: 1, size: 8, color: K.grey });
    x++;
  });
  const n2 = SECC.length - 1,
    AMPR = `'Anexos'!$B$${a0r}:$E$${a0r + n2}`,
    SECR = `'Anexos'!$A$${a0r}:$A$${a0r + n2}`;
  x =
    nota(
      wsX,
      x,
      8,
      `${MET[c.met]}. Valores de la Tabla 2 del CNE-Utilización (método de instalación según NTP 370.301 / IEC 60364-5-523).`
    ) + 1;
  x = seccion(wsX, x, 8, "A.2  FACTORES DE CORRECCIÓN · TABLAS 5A Y 5C");
  x = thead(wsX, x, [
    [1, 2, "Temperatura ambiente"],
    [3, 3, "PVC 70 °C"],
    [4, 4, "XLPE 90 °C"],
    [6, 7, "Circuitos agrupados"],
    [8, 8, "Factor"]
  ]);
  [20, 25, 30, 35, 40, 45].forEach((t, i) => {
    span(wsX, x, 1, 2, `${t} °C`, { ...val, bold: t === c.temp });
    cell(wsX, x, 3, FT.pvc[t], { ...val, fmt: "0.00" });
    cell(wsX, x, 4, FT.xl[t], { ...val, fmt: "0.00" });
    span(wsX, x, 6, 7, `${i + 1}`, { ...val, bold: i + 1 === c.nag });
    cell(wsX, x, 8, FA[i + 1], { ...val, fmt: "0.00" });
    x++;
  });
  x++;
  x = seccion(wsX, x, 8, "A.3  CONDUCTORES DE PROTECCIÓN Y DE PUESTA A TIERRA · TABLAS 16 Y 17");
  x = thead(wsX, x, [
    [1, 2, "ITM máximo (A)"],
    [3, 4, "Conductor de protección (mm²)"],
    [5, 6, "Ampacidad del alimentador (A)"],
    [7, 8, "Conductor de puesta a tierra (mm²)"]
  ]);
  const t17 = [
    ["≤ 100", 10],
    ["101 – 125", 16],
    ["126 – 200", 25],
    ["201 – 260", 35],
    ["261 – 355", 50],
    ["356 – 475", 70]
  ];
  T16.forEach(([a, s], i) => {
    span(wsX, x, 1, 2, `≤ ${a}`, val);
    span(wsX, x, 3, 4, s, { ...val, fmt: "0.0" });
    span(wsX, x, 5, 6, t17[i][0], val);
    span(wsX, x, 7, 8, t17[i][1], { ...val, fmt: "0" });
    x++;
  });
  x++;
  x = seccion(wsX, x, 8, "A.4  CORRIENTES NOMINALES Y PODERES DE CORTE NORMALIZADOS");
  span(wsX, x, 1, 8, "Interruptores termomagnéticos (A)", { bold: 1, size: 8.5, color: K.navy });
  x++;
  for (let i = 0; i < ITM.length; i += 8) {
    ITM.slice(i, i + 8).forEach((v, j) => cell(wsX, x, 1 + j, v, { ...val, bold: 1 }));
    x++;
  }
  span(wsX, x, 1, 8, "Poder de corte (kA)", { bold: 1, size: 8.5, color: K.navy });
  x++;
  PDC.slice(0, 8).forEach((v, j) => cell(wsX, x, 1 + j, v, { ...val, bold: 1 }));
  x += 2;
  x = seccion(wsX, x, 8, "A.5  ILUMINANCIA MANTENIDA EN VIVIENDA · RNE EM.010 (ANEXO)");
  x = thead(wsX, x, [
    [1, 5, "Ambiente"],
    [6, 6, "Em (lux)"],
    [7, 8, "Observación"]
  ]);
  [
    ["Dormitorio", 50],
    ["Baño", 100],
    ["Baño (zona de espejo)", 500],
    ["Cocina", 300],
    ["Sala, sala de estar", 100],
    ["Comedor", 100],
    ["Estudio, almacén, lavandería y planchado", 500],
    ["Patios y zonas abiertas", 20],
    ["Estacionamiento bajo techo", 50],
    ["Vestíbulo de entrada (zona común)", 100],
    ["Áreas de circulación y pasillos (zona común)", 100],
    ["Escaleras (zona común)", 150]
  ].forEach(([a, e]) => {
    span(wsX, x, 1, 5, a, { box: 1, ind: 1 });
    cell(wsX, x, 6, e, { ...val, bold: 1 });
    span(wsX, x, 7, 8, "", { box: 1 });
    x++;
  });
  x++;
  x = seccion(wsX, x, 8, "A.6  NORMAS APLICADAS");
  NORMAS.forEach(([cod, tit, desc]) => {
    span(wsX, x, 1, 2, cod, { bold: 1, size: 8, color: K.navy, box: 1, wrap: 1, fill: K.lab });
    span(wsX, x, 3, 8, `${tit}. ${desc}`, { box: 1, wrap: 1, size: 8.5 });
    wsX.getRow(x).height = 34;
    x++;
  });
  x++;
  x = seccion(wsX, x, 8, "A.7  CRITERIOS DE CÁLCULO");
  CRITERIOS.forEach((t, i) => {
    cell(wsX, x, 1, `${i + 1}.`, { h: "right", bold: 1, color: K.navy });
    span(wsX, x, 2, 8, t, { wrap: 1, size: 8.5 });
    wsX.getRow(x).height = 28;
    x++;
  });
  x++;
  x = seccion(wsX, x, 8, "A.8  CONTENIDO DEL EXPEDIENTE · RNE EM.010, ARTÍCULO 8");
  DOCS.forEach((t, i) => {
    cell(wsX, x, 1, "☐", { h: "right", color: K.navy });
    span(wsX, x, 2, 8, t, { wrap: 1, size: 8.5 });
    wsX.getRow(x).height = 20;
    x++;
  });
  return { AMPR, SECR };
}
