/* MEMORIA EN EXCEL · CÁLCULOS: alimentadores, cuadro de cargas, balance de fases y cortocircuito, con fórmulas vinculadas.
   Parte de exportar() (js/excel.js): recibe en X el libro, los estilos, las ayudas y lo que dejaron las hojas
   anteriores, y devuelve lo que usan las siguientes. */
function excelCalculos(X) {
  const {
    r,
    c,
    multi,
    a0,
    K,
    F,
    wsC,
    NH,
    setup,
    cell,
    span,
    inp,
    val,
    cabecera,
    seccion,
    thead,
    nota,
    tot,
    cfmt,
    AMPR,
    SECR,
    R,
    MDREF,
    servPRef,
    tipoRow,
    pisoRow
  } = X;
  /* ---------- CÁLCULOS ---------- */
  const LC = 20;
  setup(wsC, "landscape", [8, 7, 30, 7, 9, 7, 6, 8, 8, 7, 8, 9, 7, 7, 8, 12, 7, 17, 7, 9]);
  let k = cabecera(
    wsC,
    LC,
    "CÁLCULO DE ALIMENTADORES, CIRCUITOS DERIVADOS, BALANCE DE FASES Y CORTOCIRCUITO",
    `Hoja 2 de ${NH}`
  );
  const HDR = first => [
    [1, first ? 3 : 1, first ? "Alimentador" : "Tablero"],
    ...(first
      ? []
      : [
          [2, 2, "Nº"],
          [3, 3, "Descripción"]
        ]),
    [4, 4, first ? "Cant." : "Salidas"],
    [5, 5, "Potencia (W)"],
    [6, 6, first ? "Fases" : "Fases · fase"],
    [7, 7, "Tensión (V)"],
    [8, 8, "I nominal (A)"],
    [9, 9, "I diseño (A)"],
    [10, 10, first ? "ITM (A)" : "ITM (A · curva)"],
    [11, 11, "Sección (mm²)"],
    [12, 12, "Iz corregida (A)"],
    [13, 13, "Longitud (m)"],
    [14, 14, "ΔV (%)"],
    [15, 15, first ? "ΔV acum. (%)" : "ΔV total (%)"],
    [16, 16, "Verificación"],
    [17, 17, "Tierra (mm²)"],
    [18, 18, first ? "Conductores" : "Diferencial 30 mA"],
    [19, 19, "PdC (kA)"],
    [20, 20, "Tubo PVC"]
  ];
  const fI = rw => `E${rw}/(IF(LEFT(F${rw},2)="3φ",SQRT(3),1)*G${rw}*${R.fp})`;
  const AB = c.aisl === "pvc" ? 0 : 2;
  const fIz = (rw, col, fac, tri) =>
    `INDEX(${AMPR},MATCH(K${rw},${SECR},0),${col === AB + (tri ? 1 : 0) ? `${AB + 1}+IF(LEFT(F${rw},2)="3φ",1,0)` : col + 1})*${fac}`;
  const fDV = rw => `IF(LEFT(F${rw},2)="3φ",SQRT(3),2)*${R.rho}*M${rw}*H${rw}/K${rw}/G${rw}*100`;
  k = seccion(wsC, k, LC, "1.  ALIMENTADORES");
  k = thead(wsC, k, HDR(true));
  const genRow = k;
  r.alims.forEach((a, i) => {
    const pf =
      a.pKey === "MD"
        ? F(MDREF, a.P)
        : a.pKey === "servP"
          ? F(servPRef, a.P)
          : a.pKey === "piso"
            ? F(`'Memoria'!$J$${pisoRow[a.piso]}`, a.P)
            : F(`'Memoria'!$J$${tipoRow[r.T[a.ti].nombre]}`, a.P);
    span(wsC, k, 1, 3, a.desc, { box: 1, ind: 1, size: 8.5 });
    cell(wsC, k, 4, a.cant ?? 1, { ...val, fmt: "0" });
    cell(wsC, k, 5, pf, { ...val, fmt: "0" });
    cell(wsC, k, 6, a.s.tri ? "3φ" : "1φ", val);
    cell(wsC, k, 7, a.s.V, val);
    cell(wsC, k, 8, F(fI(k), a.I), { ...val, fmt: "0.00" });
    cell(wsC, k, 9, F(`MAX(H${k}*${a.viv ? R.fdV : R.fd},${a.Imin || 0})`, a.Id), { ...val, fmt: "0.00" });
    cell(wsC, k, 10, a.itm, { ...inp, fmt: "0" });
    cell(wsC, k, 11, a.S, { ...inp, fmt: "0.0" });
    cell(wsC, k, 12, F(fIz(k, a.col, R.ft, a.s.tri), a.Izc), { ...val, fmt: "0.0" });
    cell(wsC, k, 13, a.L, { ...inp, fmt: "0.0" });
    cell(wsC, k, 14, F(fDV(k), a.dVp), { ...val, fmt: "0.00" });
    cell(wsC, k, 15, F(i === 0 ? `N${k}` : `N${k}+$O$${genRow}`, a.dvAc), { ...val, fmt: "0.00", bold: 1 });
    cell(
      wsC,
      k,
      16,
      F(`IF(AND(I${k}<=J${k},J${k}<=L${k},O${k}<=${R.dvA}),"CONFORME","REVISAR")`, a.ok ? "CONFORME" : "REVISAR"),
      { ...val, bold: 1, size: 8 }
    );
    cell(wsC, k, 17, a.St, { ...val, fmt: "0.0" });
    cell(wsC, k, 18, `${a.s.n}-1×${a.S} + 1×${a.St}(T)${c.desig ? " " + c.desig : ""}`, { ...val, size: 8, wrap: 1 });
    cell(wsC, k, 19, a.pdc, { ...val, fmt: "0.0" });
    cell(wsC, k, 20, a.tubo.mm ? `${a.tubo.mm} mm` : a.tubo.pul, { ...val, size: 8 });
    a._row = k;
    k++;
  });
  k = nota(
    wsC,
    k,
    LC,
    `Verificación: corriente de diseño ≤ ITM ≤ ampacidad corregida por temperatura, y caída de tensión acumulada ≤ 2.5 %. Corriente de diseño no menor que la mínima del código (${multi ? "25 A por departamento, Regla 050-202(1)(b)" : "40 A, Regla 050-200(1)(b)"}). Celdas en azul: valores seleccionados, modificables.`
  );
  +1;
  k = seccion(wsC, k, LC, "2.  CUADRO DE CARGAS · CIRCUITOS DERIVADOS");
  k = thead(wsC, k, HDR(false));
  const cStart = k,
    subRows = [],
    subMul = [];
  r.tabs.forEach(tb => {
    const f = r.alims[tb.feeder];
    span(
      wsC,
      k,
      1,
      LC,
      `TABLERO ${tb.tab}  ·  ${tb.desc}  ·  alimentado por: ${f.desc}  ·  Icc ≈ ${fmt(tb.icc, 2)} kA`,
      { bold: 1, size: 8.5, color: K.navy, fill: K.soft, box: 1, ind: 1 }
    );
    k++;
    const t0 = k,
      cs = r.circ.filter(q => q.tab === tb.tab);
    cs.forEach(q => {
      cell(wsC, k, 1, tb.tab, { ...val, size: 8 });
      cell(wsC, k, 2, q.id, { ...val, bold: 1 });
      cell(wsC, k, 3, q.motor ? `${q.desc} (motor)` : q.desc, { box: 1, ind: 1, size: 8.5 });
      cell(wsC, k, 4, q.n, { ...val, fmt: "0" });
      cell(wsC, k, 5, q.P, { ...inp, fmt: "0" });
      cell(wsC, k, 6, q.f3 ? "3φ" : r.bal && q.fase && q.fase !== "—" ? `1φ · ${q.fase}` : "1φ", { ...val, size: 8 });
      cell(wsC, k, 7, q.s.V, val);
      cell(wsC, k, 8, F(fI(k), q.I), { ...val, fmt: "0.00" });
      cell(wsC, k, 9, F(`H${k}*${R.fd}`, q.Id), { ...val, fmt: "0.00" });
      cell(wsC, k, 10, q.itm, { ...inp, fmt: `0" · ${q.curva}"` });
      cell(wsC, k, 11, q.S, { ...inp, fmt: "0.0" });
      // Circuito del plano: su propio agrupamiento (Tabla 5C con los circuitos de sus tuberías)
      cell(wsC, k, 12, F(fIz(k, q.col, q.grp ? `${R.ft}*${q.grp.fa}` : R.fc, q.f3), q.Izc), { ...val, fmt: "0.0" });
      cell(wsC, k, 13, q.L, { ...inp, fmt: "0.0" });
      cell(wsC, k, 14, F(fDV(k), q.dVp), { ...val, fmt: "0.00" });
      cell(wsC, k, 15, F(`N${k}+$O$${f._row}`, q.dVt), { ...val, fmt: "0.00", bold: 1 });
      cell(
        wsC,
        k,
        16,
        F(
          `IF(AND(I${k}<=J${k},J${k}<=L${k},N${k}<=${R.dvD},O${k}<=${R.dvT}),"CONFORME","REVISAR")`,
          q.ok ? "CONFORME" : "REVISAR"
        ),
        { ...val, bold: 1, size: 8 }
      );
      cell(wsC, k, 17, q.St, { ...val, fmt: "0.0" });
      cell(wsC, k, 18, `${q.idName} · ${q.f3 ? 4 : 2}×${q.idRat} A · tipo ${q.idTipo || "A"}`, { ...val, size: 8 });
      cell(wsC, k, 19, tb.pdc, { ...val, fmt: "0.0" });
      cell(wsC, k, 20, q.tubo.mm ? `${q.tubo.mm} mm` : q.tubo.pul, { ...val, size: 8 });
      k++;
    });
    const pre = tb.tab === "TSG" ? "S-" : "C-";
    for (let i = 1; i <= c.reserva; i++) {
      cell(wsC, k, 1, tb.tab, { ...val, size: 8 });
      cell(wsC, k, 2, `${pre}${cs.length + i}`, { ...val, bold: 1 });
      cell(wsC, k, 3, "Reserva", { box: 1, ind: 1, it: 1, color: K.grey });
      for (let j = 4; j <= LC; j++) cell(wsC, k, j, "—", { ...val, color: K.grey });
      k++;
    }
    span(wsC, k, 1, 4, `Subtotal ${tb.tab}`, { box: 1, ind: 1 });
    cell(
      wsC,
      k,
      5,
      F(
        `SUM(E${t0}:E${k - 1})`,
        cs.reduce((s, q) => s + q.P, 0)
      ),
      { ...val, fmt: "0" }
    );
    for (let j = 6; j <= LC; j++) cell(wsC, k, j, "", { box: 1 });
    tot(wsC, k, 1, LC);
    subRows.push(k);
    subMul.push(f.cant || 1);
    k++;
  });
  const cEnd = k - 1;
  k =
    nota(
      wsC,
      k,
      LC,
      `Verificación: corriente de diseño ≤ ITM ≤ ampacidad corregida (Tabla 2, método ${c.met}, Tablas 5A y 5C); ΔV del circuito ≤ 2.5 % y total ≤ 4 % (Regla 050-102). Máximo 12 salidas por circuito (Regla 070-3000). Diferenciales de 30 mA ${c.idMode === "grupo" ? "por grupos de tres circuitos (Regla 150-400(8))" : "en cada circuito (Regla 150-400(9))"}. Espacios de reserva: ${c.reserva} por tablero (Regla 050-108(2)).`
    ) + 1;
  cfmt(wsC, `P${genRow}:P${cEnd}`);
  wsC.pageSetup.printTitlesRow = `${cStart - 1}:${cStart - 1}`;
  let balRow = null;
  if (r.bal) {
    k = seccion(wsC, k, LC, "3.  BALANCE DE CARGAS POR FASE");
    k = thead(wsC, k, [
      [1, 2, "Fase"],
      [3, 3, "Cargas asignadas"],
      [4, 5, "Potencia (W)"],
      [6, 7, "Participación"]
    ]);
    const b0 = k,
      items = r.bal.items;
    r.bal.nm.forEach((nm, i) => {
      const its = items.filter(q => q.fase === nm).map(q => (q.ref || q.id) + (q.fijo ? " (fijada)" : ""));
      span(wsC, k, 1, 2, nm, { ...val, bold: 1 });
      const txt = (its.join(", ") || "—") + (items.some(q => q.fase === "3φ") ? " · más 1/3 de cargas trifásicas" : "");
      cell(wsC, k, 3, txt, { box: 1, wrap: 1, size: 8 });
      span(wsC, k, 4, 5, r.bal.ph[i], { ...val, fmt: "0" });
      span(
        wsC,
        k,
        6,
        7,
        F(`D${k}/SUM($D$${b0}:$D$${b0 + 2})`, r.bal.ph[i] / (r.bal.ph.reduce((s, v) => s + v, 0) || 1)),
        { ...val, fmt: "0.0%" }
      );
      wsC.getRow(k).height = Math.max(18, Math.ceil(txt.length / 42) * 11 + 8);
      k++;
    });
    span(wsC, k, 1, 3, "Desbalance = (fase más cargada − promedio) / promedio", { box: 1, ind: 1, wrap: 1 });
    wsC.getRow(k).height = 26;
    span(
      wsC,
      k,
      4,
      5,
      F(`(MAX(D${b0}:D${b0 + 2})-AVERAGE(D${b0}:D${b0 + 2}))/AVERAGE(D${b0}:D${b0 + 2})`, r.bal.desb / 100),
      { ...val, fmt: "0.0%", bold: 1 }
    );
    span(wsC, k, 6, 7, F(`IF(D${k}<=0.1,"CONFORME","OBSERVACIÓN")`, r.bal.desb <= 10 ? "CONFORME" : "OBSERVACIÓN"), {
      ...val,
      bold: 1,
      size: 8
    });
    cfmt(wsC, `F${k}:G${k}`);
    tot(wsC, k, 1, 7);
    balRow = k;
    k++;
    span(wsC, k, 1, 3, "Desbalance mínimo alcanzable con estas cargas", { box: 1, ind: 1 });
    span(wsC, k, 4, 5, r.bal.desbMin / 100, { ...val, fmt: "0.0%" });
    span(wsC, k, 6, 7, "", { box: 1 });
    k++;
    k =
      nota(
        wsC,
        k,
        LC,
        `Reparto de cargas monofásicas con el menor desbalance posible${r.bal.nFix ? `; ${r.bal.nFix} carga(s) con fase fijada por el proyectista` : ""}. Criterio de diseño: desbalance no mayor de 10 %. ${r.bal.desb > 10 ? sugerencia(r) : ""}`
      ) + 1;
  }
  k = seccion(wsC, k, LC, `${r.bal ? "4" : "3"}.  CORRIENTE DE CORTOCIRCUITO Y PODER DE CORTE`);
  k = thead(wsC, k, [
    [1, 3, "Punto de la instalación"],
    [4, 5, "Sistema"],
    [6, 7, "Icc estimada (kA)"],
    [8, 9, "PdC mínimo (kA)"],
    [10, 13, "Dispositivos"]
  ]);
  [
    ["Punto de entrega (acometida)", a0.s.txt, c.iccE, a0.pdc, "Interruptor general"],
    ...r.tabs.map(tb => [
      `Tablero ${tb.tab}`,
      r.alims[tb.feeder].s.txt,
      tb.icc,
      tb.pdc,
      "Interruptores de circuitos derivados"
    ])
  ].forEach(([p, s, i, pd, d]) => {
    span(wsC, k, 1, 3, p, { box: 1, ind: 1 });
    span(wsC, k, 4, 5, s, val);
    span(wsC, k, 6, 7, i, { ...val, fmt: "0.00" });
    span(wsC, k, 8, 9, pd, { ...val, bold: 1, fmt: "0.0" });
    span(wsC, k, 10, 13, d, { box: 1, size: 8 });
    k++;
  });
  k = nota(
    wsC,
    k,
    LC,
    "Estimación: impedancia de la fuente a partir de la corriente de cortocircuito del punto de entrega, más la resistencia de los conductores (ρ a 20 °C). El poder de corte se elige igual o mayor que la corriente calculada (Norma DGE, 303.B.2; IEC 60898-1)."
  );
  return { genRow, cStart, subRows, subMul, cEnd, balRow };
}
