/* MEMORIA EN EXCEL · PLANOS: un plano por hoja como imagen; el unifilar, con todas sus láminas, una por página.
   Parte de exportar() (js/exportar/excel.js): recibe en X el libro, los estilos, las ayudas y lo que dejaron las hojas
   anteriores. */
async function excelPlanos(X) {
  const { r, c, multi, wb, K, wsU, wsA, wsD, wsB, wsTG, wsBM, NH, setup, span, cabecera, nota } = X;
  /* ---------- PLANOS (un plano por hoja; el unifilar, con todas sus láminas, una por página) ---------- */
  for (const [ws, us, tit, hoja, txt] of [
    [
      wsU,
      unifilarHojas(r),
      "DIAGRAMA UNIFILAR · ESQUEMA DE DISTRIBUCIÓN Y PROTECCIÓN",
      `Hoja 3 de ${NH}`,
      "Diagrama generado a partir de los resultados del cálculo. Incluye potencia instalada, máxima demanda, potencia a contratar, tensión, número de fases y capacidad de ruptura (RNE EM.010, Art. 8)."
    ],
    [
      wsA,
      [alturas(r)],
      "DIAGRAMA DE ALTURAS DE MONTAJE",
      `Hoja 4 de ${NH}`,
      "Alturas desde el nivel de piso terminado según Parámetros › Alturas; interruptores y tomacorrientes verificados con la Norma A.120 del RNE. Símbolos de la Norma DGE (R.M. N.° 091-2002-EM/VME)."
    ],
    [
      wsD,
      [detalles(r)],
      "LEYENDA DE SÍMBOLOS Y DETALLE DEL POZO DE PUESTA A TIERRA",
      `Hoja 5 de ${NH}`,
      "Símbolos de la Norma DGE (R.M. N.° 091-2002-EM/VME) usados en los planos. Varilla, conductor y resistencia del pozo según el cálculo (Reglas 060-702 y 060-712, Tabla 17); medidas y materiales: criterio de diseño."
    ],
    [
      wsB,
      tablerosHojas(r),
      "DETALLE DE TABLEROS Y SEÑAL DE SEGURIDAD",
      `Hoja 6 de ${NH}`,
      "Vista de la puerta con la señal «¡Peligro! Riesgo eléctrico» (Norma DGE 141-02-02) y vista interior de cada tablero con sus dispositivos según el cálculo; capacidad mínima en polos igual a la del metrado."
    ],
    ...(multi
      ? [
          [
            wsTG,
            [tableroGeneral(r)],
            "TABLERO GENERAL DEL EDIFICIO",
            `Hoja 7 de ${NH}`,
            "Interruptor general del alimentador general en caja moldeada y barras de cobre N, R, S y T, de las que sale la fase de cada suministro, según el balance, hacia su medidor. Dimensiones del gabinete y de las barras según el fabricante."
          ],
          [
            wsBM,
            [bancoMedidores(r)],
            "BANCO DE MEDIDORES Y BALANCE DE FASES",
            `Hoja 8 de ${NH}`,
            `Vista frontal con las medidas de la concesionaria (${c.bm.conc}), conexión de cada suministro a su fase según el balance y verificación del calibre de la instalación interna con la tabla de la concesionaria.`
          ]
        ]
      : [])
  ]) {
    const LU = 20;
    setup(ws, "landscape", [12, 12, ...Array(LU - 2).fill(6.5)]);
    let q = cabecera(ws, LU, tit, hoja);
    try {
      for (const [i, u] of us.entries()) {
        if (i) {
          // Cada lámina siguiente empieza en página nueva, con su número
          ws.getRow(q - 1).addPageBreak();
          span(ws, q, 1, LU, `Lámina ${u.hoja}`, { bold: 1, color: K.navy });
          q += 2;
        }
        const png = await svgPng(u.svg, 2),
          wpx = 1040,
          hpx = Math.round((wpx * u.H) / u.W);
        ws.addImage(wb.addImage({ base64: png, extension: "png" }), {
          tl: { col: 0, row: q },
          ext: { width: wpx, height: hpx }
        });
        const nr = Math.ceil(hpx / 20) + 1;
        for (let k = 0; k < nr; k++) ws.getRow(q + 1 + k).height = 15;
        q += nr + 1;
      }
      ws.pageSetup.orientation = us[0].H / us[0].W > 0.9 ? "portrait" : "landscape";
      ws.pageSetup.fitToHeight = us.length;
      if (multi) ws.pageSetup.paperSize = 8;
    } catch (e) {
      span(
        ws,
        q + 1,
        1,
        LU,
        "No se pudo insertar el diagrama en este navegador. Descárguelo desde la plataforma (SVG o PNG).",
        { it: 1, color: K.grey }
      );
      q += 3;
    }
    nota(ws, q, LU, txt);
    ws.pageSetup.printArea = `A1:T${q}`;
  }
}
