/* MEMORIA EN EXCEL · METRADO: partidas de la Norma Técnica de Metrados con sus cantidades.
   Parte de exportar() (js/exportar/excel.js): recibe en X el libro, los estilos, las ayudas y lo que dejaron las hojas
   anteriores. */
function excelMetrado(X) {
  const { r, c, multi, K, NH, wsT, setup, cell, span, val, cabecera, thead, nota } = X;
  /* ---------- METRADO ---------- */
  {
    const LT = 8;
    setup(wsT, "portrait", [9, 13, 13, 13, 13, 7, 10, 22]);
    let t = cabecera(wsT, LT, "METRADO DE INSTALACIONES ELÉCTRICAS", `Hoja ${multi ? 9 : 7} de ${NH}`);
    t = thead(wsT, t, [
      [1, 1, "Ítem"],
      [2, 5, "Descripción"],
      [6, 6, "Und."],
      [7, 7, "Cantidad"],
      [8, 8, "Observación"]
    ]);
    const t0 = t;
    metrado(r).forEach(x => {
      if (x.sec) {
        cell(wsT, t, 1, x.cod, { bold: 1, color: K.navy, fill: K.soft, box: 1, h: "center" });
        span(wsT, t, 2, LT, x.sec, { bold: 1, size: 9, color: K.navy, fill: K.soft, box: 1, ind: 1 });
        wsT.getRow(t).height = 18;
        t++;
        return;
      }
      cell(wsT, t, 1, x.cod, { ...val, size: 8.5 });
      span(wsT, t, 2, 5, x.desc, { box: 1, ind: 1, wrap: 1, size: 8.5 });
      cell(wsT, t, 6, x.und, val);
      cell(wsT, t, 7, x.cant, { ...val, bold: 1, fmt: "0" });
      cell(wsT, t, 8, x.obs, { box: 1, size: 7.5, color: K.grey, wrap: 1 });
      wsT.getRow(t).height = Math.max(16, Math.ceil(Math.max(x.desc.length / 58, x.obs.length / 26)) * 12);
      t++;
    });
    wsT.pageSetup.printTitlesRow = `${t0 - 1}:${t0 - 1}`;
    t =
      nota(
        wsT,
        t + 1,
        LT,
        `Metrado referencial generado con JMG - ELECTRIC ${VERSION}, ordenado por las partidas de la Norma Técnica de Metrados (R.D. N.° 073-2010-VIVIENDA, título OE.5). Protecciones, tableros y salidas resultan del cálculo; las longitudes de conductores y tubos suman la distancia a la salida más alejada y los tramos verticales según las alturas de montaje. Cantidades netas: el desperdicio (${fmt(c.pDesp, 0)} %) se aplica en el análisis de precios. Verificar con los planos de distribución.`
      ) + 1;
    const firmaT = (c1, c2, tit, nombre, cip = "") => {
      span(wsT, t, c1, c2, tit, { bold: 1, size: 8.5, color: K.navy, fill: K.lab, box: 1, h: "center" });
      [
        ["Nombre", nombre],
        ["CIP N°", cip],
        ["Firma y sello", ""]
      ].forEach(([l, v], i) => {
        const rw = t + 1 + i;
        cell(wsT, rw, c1, l, { size: 8, color: K.grey, box: 1, fill: K.lab });
        span(wsT, rw, c1 + 1, c2, v, { box: 1 });
        wsT.getRow(rw).height = i === 2 ? 42 : 18;
      });
    };
    firmaT(1, 4, "ELABORADO POR", c.proj.proy || "", c.proj.cip);
    firmaT(5, 8, "REVISADO POR", "");
  }
}
