/* MEMORIA EN EXCEL · MEMORIA: datos del proyecto, parámetros de diseño (celdas que usan las fórmulas) y máxima demanda.
   Parte de exportar() (js/excel.js): recibe en X el libro, los estilos, las ayudas y lo que dejaron las hojas
   anteriores, y devuelve lo que usan las siguientes. */
function excelMemoria(X) {
  const { r, c, multi, K, F, wsM, NH, setup, cell, span, inp, val, cabecera, seccion, sub, thead, nota, tot } = X;
  /* ---------- MEMORIA ---------- */
  const LM = 10;
  setup(wsM, "portrait", [12, 11, 11, 11, 11, 11, 11, 11, 12, 13]);
  let m = cabecera(
    wsM,
    LM,
    multi ? "VIVIENDA MULTIFAMILIAR · EDIFICIO DE DEPARTAMENTOS" : "VIVIENDA UNIFAMILIAR",
    `Hoja 1 de ${NH}`
  );
  m = seccion(wsM, m, LM, "1.  PARÁMETROS DE DISEÑO");
  m = thead(wsM, m, [
    [1, 5, "Parámetro"],
    [6, 6, "Valor"],
    [7, 7, "Unidad"],
    [8, 10, "Referencia"]
  ]);
  const R = {};
  const par = (k, lab, v, u, ref, isInp, f = "0.00") => {
    R[k] = `'Memoria'!$F$${m}`;
    span(wsM, m, 1, 5, lab, { box: 1, ind: 1 });
    if (f === "@") span(wsM, m, 6, 7, v, { ...val, bold: 1 });
    else {
      cell(wsM, m, 6, v, isInp ? { ...inp, fmt: f } : { ...val, fmt: f });
      cell(wsM, m, 7, u, { ...val, color: K.grey });
    }
    span(wsM, m, 8, 10, ref, { box: 1, size: 8, color: K.grey });
    m++;
  };
  par("tipo", "Tipo de edificación", multi ? "Multifamiliar" : "Unifamiliar", "", "", false, "@");
  par("sist", "Sistema de suministro", SIST[r.sk].nom, "", "Norma DGE, Tabla 201-01", false, "@");
  par("met", "Método de instalación", MET[c.met].split(" · ")[0] + " · Tabla 3", "", "CNE-U, Tabla 3", false, "@");
  par(
    "ais",
    "Aislamiento del conductor",
    c.aisl === "pvc" ? "PVC 70 °C" : "XLPE / EPR 90 °C",
    "",
    "CNE-U, Tabla 2",
    false,
    "@"
  );
  par("fp", "Factor de potencia", c.fp, "—", "Cargas de vivienda", true);
  par("rho", "Resistividad del cobre (caída de tensión)", c.rho, "Ω·mm²/m", c.rhoRef, false, "0.0000");
  par("ft", "Factor de corrección por temperatura", c.ft, "—", `${c.temp} °C · Tabla 5A`, true);
  par("fa", "Factor de corrección por agrupamiento", c.fa, "—", `${c.nag} circuito(s) por tubería · Tabla 5C`, true);
  {
    const rr = m;
    R.fc = `'Memoria'!$F$${rr}`;
    span(wsM, m, 1, 5, "Factor de corrección total en circuitos derivados", { box: 1, ind: 1 });
    cell(wsM, m, 6, F(`F${rr - 2}*F${rr - 1}`, c.fc), { ...val, fmt: "0.00" });
    cell(wsM, m, 7, "—", { ...val, color: K.grey });
    span(wsM, m, 8, 10, "Temperatura × agrupamiento", { box: 1, size: 8, color: K.grey });
    m++;
  }
  par("fd", "Factor de corriente de diseño en circuitos derivados", FD, "—", "Carga continua · Regla 050-104", false);
  par(
    "fdV",
    "Factor de corriente de diseño en alimentadores de vivienda",
    c.fdA,
    "—",
    c.resAl > 0
      ? `Reserva del ${c.resAl} % para ampliaciones (la carga no es continua: Reglas 050-200(3) y 050-202(2))`
      : "Carga no continua · Reglas 050-200(3) y 050-202(2)",
    false
  );
  par("dvA", "Caída de tensión máxima en alimentadores", DV_ALIM, "%", "Regla 050-102(1)", false, "0.0");
  par("dvD", "Caída de tensión máxima en circuitos derivados", DV_DER, "%", "Regla 050-102(2)", false, "0.0");
  par("dvT", "Caída de tensión máxima total", DV_TOT, "%", "Regla 050-102", false, "0.0");
  par(
    "icc",
    "Corriente de cortocircuito en el punto de entrega",
    c.iccE,
    "kA",
    "Dato de la concesionaria (Norma DGE, 110.F)",
    true,
    "0.0"
  );
  par(
    "idm",
    "Esquema de interruptores diferenciales",
    c.idMode === "grupo" ? "Por grupos de 3 circuitos" : "Uno por circuito",
    "",
    c.idMode === "grupo" ? "Regla 150-400(8)" : "Regla 150-400(9)",
    false,
    "@"
  );
  if (!multi) {
    const vX = r.viv !== false;
    par(
      "aT",
      vX
        ? r.varios
          ? `Área techada de vivienda (${r.PS.length} pisos)`
          : "Área techada de vivienda"
        : r.varios
          ? `Área según dimensiones exteriores (${r.PS.length} pisos)`
          : "Área según dimensiones exteriores",
      r.areaT,
      "m²",
      vX ? "Regla 050-110(1)" : "Regla 050-210",
      true,
      "0.0"
    );
    par(
      "aS",
      "Área de sótano",
      r.sot,
      "m²",
      vX ? "Se computa al 75 %" : "Se computa al 100 % (área servida)",
      true,
      "0.0"
    );
    {
      const rr = m;
      R.area = `'Memoria'!$F$${rr}`;
      span(wsM, m, 1, 5, vX ? "Área de vivienda computable" : "Área servida computable", { box: 1, ind: 1 });
      cell(wsM, m, 6, F(`F${rr - 2}+${vX ? 0.75 : 1}*F${rr - 1}`, r.area), { ...val, fmt: "0.0", bold: 1 });
      cell(wsM, m, 7, "m²", { ...val, color: K.grey });
      span(wsM, m, 8, 10, "Regla 050-110(1)", { box: 1, size: 8, color: K.grey });
      m++;
    }
  }
  m =
    nota(
      wsM,
      m,
      LM,
      "Las celdas sombreadas en azul son datos de entrada: al modificarlas, el libro recalcula los resultados."
    ) + 1;
  // Con el diseño en el plano: el origen de los datos
  const fuente = planoFuente(r);
  fuente.forEach((t, i) => (m = nota(wsM, m, LM, (i ? "" : "Origen de los datos (diseño en el plano): ") + t)));
  if (fuente.length) m++;

  m = seccion(wsM, m, LM, "2.  CÁLCULO DE LA MÁXIMA DEMANDA");
  let MDREF,
    servPRef = null,
    tipoRow = {},
    pisoRow = {};
  if (!multi) {
    m = sub(wsM, m, LM, "2.1  Cargas especiales");
    m = thead(wsM, m, [
      [1, 4, "Descripción"],
      [5, 6, "Tipo de carga"],
      [7, 7, "Fases"],
      [8, 8, "Potencia (W)"],
      [9, 9, "Longitud (m)"],
      [10, 10, "Circuito"]
    ]);
    const c0 = m,
      n = Math.max(r.cs.length, 1);
    for (let i = 0; i < n; i++) {
      const it = r.cs[i];
      span(wsM, m, 1, 4, it ? it.nombre : "(sin cargas especiales)", { box: 1, ind: 1 });
      span(wsM, m, 5, 6, it ? TIPOS[it.tipo].split(" (")[0] : "—", { box: 1 });
      cell(wsM, m, 7, it ? (it.fases === 3 && SIST[r.sk].tri ? "3φ" : "1φ") : "—", val);
      cell(wsM, m, 8, it ? it.p : 0, { ...inp, fmt: "0" });
      cell(wsM, m, 9, it ? it.L : 0, { ...val, fmt: "0.0" });
      const ci = it ? r.circ.find(q => q.desc === it.nombre) : null;
      cell(wsM, m, 10, ci ? (r.varios ? `${ci.tab} · ${ci.id}` : ci.id) : "—", val);
      m++;
    }
    const T = `$E$${c0}:$E$${m - 1}`,
      P = `$H$${c0}:$H$${m - 1}`;
    m++;
    if (r.viv === false) {
      // Otros usos: Regla 050-210 y Tabla 14
      const md = r.md,
        U = md.U,
        d0 = m;
      m = sub(
        wsM,
        m,
        LM,
        `2.2  Determinación de la máxima demanda · ${U.regla ? `Regla ${U.regla}` : "Regla 050-210 y Tabla 14"} · ${U.n}`
      );
      m = thead(wsM, m, [
        [1, 4, "Concepto"],
        [5, 8, "Criterio"],
        [9, 9, "Instalada (W)"],
        [10, 10, "Demanda (W)"]
      ]);
      const mr = (a, b, ci, de) => {
        span(wsM, m, 1, 4, a, { box: 1, ind: 1 });
        span(wsM, m, 5, 8, b, { box: 1, size: 8, color: K.grey, wrap: 1 });
        cell(wsM, m, 9, ci, { ...val, fmt: "0" });
        cell(wsM, m, 10, de, { ...val, fmt: "0" });
        wsM.getRow(m).height = 24;
        return m++;
      };
      if (U.regla) {
        // Escuelas, hospitales y hoteles: el factor de demanda se aplica a la carga por área más las cargas especiales
        const fa = U.wE
          ? U.resta
            ? [
                [`Aulas · ${fmt(md.aE, 1)} m² × ${U.wE} W/m²`, md.aE * U.wE],
                [`Resto · ${fmt(md.area - md.aE, 1)} m² × ${U.w} W/m²`, (md.area - md.aE) * U.w]
              ]
            : [
                [`Edificio · ${fmt(md.area, 1)} m² × ${U.w} W/m²`, md.area * U.w],
                [`Alta intensidad · ${fmt(md.aE, 1)} m² × ${U.wE} W/m²`, md.aE * U.wE]
              ]
          : [[`Edificio · ${fmt(md.area, 1)} m² × ${U.w} W/m²`, md.area * U.w]];
        fa.forEach(([a, v]) => mr(a, `Regla ${U.regla}(1) · dimensiones exteriores`, v, "—"));
        mr(
          "Cargas especiales",
          `Potencia nominal del equipo instalado · Regla ${U.regla}(1)`,
          F(`SUM(${P})`, md.esp),
          "—"
        );
        md.tramos.forEach((t, i) =>
          mr(
            `Factor de demanda · ${fmt(t.a, 1)} m²`,
            `${t.fal} % ${md.tramos.length === 1 ? "(hasta 900 m²)" : i === 0 ? "(primeros 900 m², según la carga por m²)" : "(exceso sobre 900 m²)"} · Regla ${U.regla}(2)`,
            t.inst,
            F(`I${m}*${t.fal}/100`, t.d)
          )
        );
      } else {
        md.tramos.forEach(t =>
          mr(
            `Carga por área · ${fmt(t.a, 1)} m² × ${U.w} W/m²`,
            `Tabla 14: factor de demanda de alimentadores ${t.fal} % (acometida ${t.fac} %)`,
            t.a * U.w,
            F(`I${m}*${t.fal}/100`, t.d)
          )
        );
        mr(
          "Cargas especiales",
          "Potencia nominal del equipo instalado · Regla 050-210(b)",
          F(`SUM(${P})`, md.esp),
          F(`I${m}`, md.esp)
        );
      }
      if (md.libre > 0)
        mr(
          "Áreas libres no techadas",
          `${fmt(r.c.aLib, 1)} m² × ${fmt(r.c.wLib, 1)} W/m² al 100 % · criterio del proyectista (no indicado en el CNE)`,
          md.libre,
          F(`I${m}`, md.libre)
        );
      span(wsM, m, 1, 9, `MÁXIMA DEMANDA · ${U.n.toUpperCase()} (W)`, { box: 1, ind: 1 });
      cell(wsM, m, 10, F(`SUM(J${d0 + 1}:J${m - 1})`, md.MD), { ...val, fmt: "0" });
      tot(wsM, m, 1, 10);
      MDREF = `'Memoria'!$J$${m}`;
      m += 1;
      m =
        nota(
          wsM,
          m,
          LM,
          `Área servida según las dimensiones exteriores${r.sot > 0 ? ", incluido el sótano" : ""}. No se aplica la corriente mínima de 40 A (propia de viviendas); la carga de los alimentadores es continua (Regla 050-104(3)) y su corriente de diseño es 1.25 × I.${U.regla ? ` En la Regla ${U.regla} el factor de demanda se aplica a toda la carga, incluidas las cargas especiales.` : ""}`
        ) + 1;
      const PT = r.PS.filter(p => p.md);
      if (PT.length) {
        m = sub(
          wsM,
          m,
          LM,
          `2.3  Máxima demanda por piso · alimentadores a tableros de distribución · ${U.regla ? "Regla " + U.regla : "Regla 050-210"}`
        );
        m = thead(wsM, m, [
          [1, 1, "Piso"],
          [2, 2, "Tablero"],
          [3, 3, "Área (m²)"],
          [4, 5, "Carga por área (W)"],
          [6, 7, U.regla ? "Carga total (W)" : "Demanda por área (W)"],
          [8, 9, "Cargas especiales (W)"],
          [10, 10, "MD piso (W)"]
        ]);
        PT.forEach(p => {
          pisoRow[p.n] = m;
          cell(wsM, m, 1, `${ORD(p.n)} piso`, { box: 1, bold: 1, h: "center" });
          cell(wsM, m, 2, p.tab, val);
          cell(wsM, m, 3, p.areaC, { ...inp, fmt: "0.0" });
          span(wsM, m, 4, 5, p.md.carga, { ...val, fmt: "0" });
          span(wsM, m, 6, 7, U.regla ? p.md.total : p.md.dem, { ...val, fmt: "0" });
          span(wsM, m, 8, 9, p.md.esp, { ...val, fmt: "0" });
          cell(wsM, m, 10, p.md.MD, { ...val, fmt: "0", bold: 1 });
          m++;
        });
        m =
          nota(
            wsM,
            m,
            LM,
            `Cada tablero de piso se alimenta desde el tablero general TG; su máxima demanda se obtiene con ${U.regla ? "la Regla " + U.regla : "la Tabla 14"} aplicada al área del piso y a las cargas especiales conectadas a ese tablero.`
          ) + 1;
      }
    } else {
      m = sub(wsM, m, LM, "2.2  Determinación de la máxima demanda · Regla 050-200(1)");
      m = thead(wsM, m, [
        [1, 4, "Concepto"],
        [5, 8, "Criterio"],
        [9, 9, "Instalada (W)"],
        [10, 10, "Demanda (W)"]
      ]);
      const md = r.md,
        d0 = m;
      const mr = (a, b, ci, de, fi = "0") => {
        span(wsM, m, 1, 4, a, { box: 1, ind: 1 });
        span(wsM, m, 5, 8, b, { box: 1, size: 8, color: K.grey, wrap: 1 });
        cell(wsM, m, 9, ci, { ...val, fmt: fi });
        cell(wsM, m, 10, de, { ...val, fmt: "0" });
        wsM.getRow(m).height = 24;
        return m++;
      };
      mr(
        "Carga básica",
        "2 500 W por los primeros 90 m² + 1 000 W por cada 90 m² o fracción adicional",
        F(R.area, r.area),
        F(`2500+1000*MAX(0,ROUNDUP((${R.area}-90)/90,0))`, md.basica),
        '0.0" m²"'
      );
      const rC = mr(
        "Cocina eléctrica",
        "6 000 W + 40 % del exceso sobre 12 kW",
        F(`SUMIFS(${P},${T},"Cocina eléctrica")`, md.coc),
        F(`IF(I${m}>0,6000+0.4*MAX(0,I${m}-12000),0)`, md.mdCoc)
      );
      mr(
        "Calentadores de agua y duchas",
        "100 %",
        F(`SUMIFS(${P},${T},"Calentador de agua / ducha")`, md.cal),
        F(`I${m}`, md.cal)
      );
      mr("Aire acondicionado", "100 %", F(`SUMIFS(${P},${T},"Aire acondicionado")`, md.aire), F(`I${m}`, md.aire));
      mr(
        "Otras cargas mayores de 1 500 W",
        "25 % si existe cocina; si no, 100 % hasta 6 kW + 25 % del exceso",
        F(`SUMIFS(${P},${T},"Otra carga",${P},">1500")+SUMIFS(${P},${T},"Motor",${P},">1500")`, md.otras),
        F(`IF($I$${rC}>0,0.25*I${m},MIN(I${m},6000)+0.25*MAX(0,I${m}-6000))`, md.mdOtras)
      );
      if (md.libre > 0)
        mr(
          "Áreas libres no techadas",
          `${fmt(r.c.aLib, 1)} m² × ${fmt(r.c.wLib, 1)} W/m² al 100 % · criterio del proyectista (no indicado en el CNE)`,
          md.libre,
          F(`I${m}`, md.libre)
        );
      span(wsM, m, 1, 9, "MÁXIMA DEMANDA DE LA VIVIENDA (W)", { box: 1, ind: 1 });
      cell(wsM, m, 10, F(`SUM(J${d0}:J${m - 1})`, md.MD), { ...val, fmt: "0" });
      tot(wsM, m, 1, 10);
      MDREF = `'Memoria'!$J$${m}`;
      m += 2;
      const PT = r.PS.filter(p => p.md);
      if (PT.length) {
        m = sub(wsM, m, LM, "2.3  Máxima demanda por piso · alimentadores a tableros de distribución · Regla 050-200");
        m = thead(wsM, m, [
          [1, 1, "Piso"],
          [2, 2, "Tablero"],
          [3, 3, "Área (m²)"],
          [4, 4, "Carga básica (W)"],
          [5, 5, "Cocina (W)"],
          [6, 6, "Calentador (W)"],
          [7, 7, "Aire acond. (W)"],
          [8, 8, "Otras > 1.5 kW (W)"],
          [9, 9, "Cocina y otras, demanda (W)"],
          [10, 10, "MD piso (W)"]
        ]);
        PT.forEach(p => {
          pisoRow[p.n] = m;
          cell(wsM, m, 1, `${ORD(p.n)} piso`, { box: 1, bold: 1, h: "center" });
          cell(wsM, m, 2, p.tab, val);
          cell(wsM, m, 3, p.areaC, { ...inp, fmt: "0.0" });
          cell(wsM, m, 4, F(`2500+1000*MAX(0,ROUNDUP((C${m}-90)/90,0))`, p.md.basica), { ...val, fmt: "0" });
          [p.md.coc, p.md.cal, p.md.aire, p.md.otras].forEach((v, j) => cell(wsM, m, 5 + j, v, { ...inp, fmt: "0" }));
          cell(
            wsM,
            m,
            9,
            F(
              `IF(E${m}>0,6000+0.4*MAX(0,E${m}-12000),0)+IF(E${m}>0,0.25*H${m},MIN(H${m},6000)+0.25*MAX(0,H${m}-6000))`,
              p.md.mdCoc + p.md.mdOtras
            ),
            { ...val, fmt: "0" }
          );
          cell(wsM, m, 10, F(`D${m}+F${m}+G${m}+I${m}`, p.md.MD), { ...val, fmt: "0", bold: 1 });
          m++;
        });
        m =
          nota(
            wsM,
            m,
            LM,
            `Cada tablero de piso se alimenta desde el tablero general TG; su máxima demanda se obtiene con la Regla 050-200 aplicada al área del piso y a las cargas especiales conectadas a ese tablero${r.sot > 0 && r.esq === "td" ? " (el sótano, al 75 %, se asigna al 1er piso)" : ""}. El alimentador general conserva la máxima demanda de toda la vivienda.${r.esq === "tg" ? " Los circuitos del 1er piso salen directamente del tablero general TG." : ""}`
          ) + 1;
      }
    }
  } else {
    m = sub(wsM, m, LM, "2.1  Carga por unidad de vivienda · Regla 050-202(1)");
    m = thead(wsM, m, [
      [1, 1, "Tipo"],
      [2, 2, "Unidades"],
      [3, 3, "Área (m²)"],
      [4, 4, "Carga básica (W)"],
      [5, 5, "Cocina (W)"],
      [6, 6, "Calentador (W)"],
      [7, 7, "Aire acond. (W)"],
      [8, 8, "Otras > 1.5 kW (W)"],
      [9, 9, "MD sin aire (W)"],
      [10, 10, "MD unidad (W)"]
    ]);
    const u0 = m;
    r.T.forEach(t => {
      tipoRow[t.nombre] = m;
      cell(wsM, m, 1, t.nombre, { box: 1, bold: 1, h: "center" });
      cell(wsM, m, 2, t.cant, { ...inp, fmt: "0" });
      cell(wsM, m, 3, t.area, { ...inp, fmt: "0.0" });
      cell(wsM, m, 4, F(`1500+IF(C${m}>45,1000,0)+1000*MAX(0,ROUNDUP((C${m}-90)/90,0))`, t.md.basica), {
        ...val,
        fmt: "0"
      });
      [t.coc, t.cal, t.aire, t.otras].forEach((v, j) => cell(wsM, m, 5 + j, v, { ...inp, fmt: "0" }));
      cell(
        wsM,
        m,
        9,
        F(
          `D${m}+IF(E${m}>0,6000+0.4*MAX(0,E${m}-12000),0)+F${m}+IF(E${m}>0,0.25*H${m},MIN(H${m},6000)+0.25*MAX(0,H${m}-6000))`,
          t.md.sinAire
        ),
        { ...val, fmt: "0" }
      );
      cell(wsM, m, 10, F(`I${m}+G${m}`, t.md.MD), { ...val, fmt: "0", bold: 1 });
      m++;
    });
    const u1 = m - 1;
    span(wsM, m, 1, 1, "TOTAL", { box: 1, h: "center" });
    cell(wsM, m, 2, F(`SUM(B${u0}:B${u1})`, r.units.length), { ...val, fmt: "0" });
    for (let k = 3; k <= 10; k++) cell(wsM, m, k, "", { box: 1 });
    tot(wsM, m, 1, 10);
    m++;
    m =
      nota(
        wsM,
        m,
        LM,
        "Carga básica: 1 500 W por los primeros 45 m², 1 000 W por los segundos 45 m² y 1 000 W por cada 90 m² o fracción adicional. Cocina: 6 000 W más 40 % del exceso sobre 12 kW. Otras cargas mayores de 1 500 W: 25 % si existe cocina; si no, 100 % hasta 6 kW más 25 % del exceso. Corriente mínima del alimentador de cada departamento: 25 A."
      ) + 1;
    m = sub(
      wsM,
      m,
      LM,
      "2.2  Máxima demanda del edificio · Regla 050-202(3) · factores 100 % · 65 % · 40 % · 30 % · 25 %"
    );
    m = thead(wsM, m, [
      [1, 2, "Tipo"],
      [3, 3, "Unidades"],
      [4, 4, "Orden desde"],
      [5, 5, "Orden hasta"],
      [6, 6, "MD unidad sin aire (W)"],
      [7, 7, "Carga (W)"],
      [8, 8, "Factor medio"],
      [9, 10, "Demanda (W)"]
    ]);
    const e0 = m;
    r.T.forEach((t, i) => {
      const tr = tipoRow[t.nombre];
      span(wsM, m, 1, 2, t.nombre, { box: 1, bold: 1, h: "center" });
      cell(wsM, m, 3, F(`B${tr}`, t.cant), { ...val, fmt: "0" });
      cell(wsM, m, 4, i === 0 ? 1 : F(`E${m - 1}+1`, t.desde), { ...val, fmt: "0" });
      cell(wsM, m, 5, F(`D${m}+C${m}-1`, t.hasta), { ...val, fmt: "0" });
      cell(wsM, m, 6, F(`I${tr}`, t.md.sinAire), { ...val, fmt: "0" });
      cell(wsM, m, 7, F(`C${m}*F${m}`, t.cant * t.md.sinAire), { ...val, fmt: "0" });
      const s = `(D${m}-1)`,
        e = `E${m}`;
      span(
        wsM,
        m,
        9,
        10,
        F(
          `F${m}*(MAX(0,MIN(${e},1)-MAX(${s},0))+0.65*MAX(0,MIN(${e},3)-MAX(${s},1))+0.4*MAX(0,MIN(${e},5)-MAX(${s},3))+0.3*MAX(0,MIN(${e},20)-MAX(${s},5))+0.25*MAX(0,${e}-MAX(${s},20)))`,
          t.dem
        ),
        { ...val, fmt: "0" }
      );
      cell(wsM, m, 8, F(`IF(G${m}>0,I${m}/G${m},0)`, t.cant * t.md.sinAire > 0 ? t.dem / (t.cant * t.md.sinAire) : 0), {
        ...val,
        fmt: "0.0%"
      });
      m++;
    });
    const e1 = m - 1;
    const er = (lab, f, v, bold) => {
      span(wsM, m, 1, 8, lab, { box: 1, ind: 1 });
      span(wsM, m, 9, 10, F(f, v), { ...val, fmt: "0" });
      if (bold) tot(wsM, m, 1, 10);
      return m++;
    };
    er("Demanda de departamentos · 050-202(3)(a)", `SUM(I${e0}:I${e1})`, r.mdDeptos);
    er(
      "Aire acondicionado de departamentos (100 %) · 050-202(3)(c)",
      `SUMPRODUCT(B${u0}:B${u1},G${u0}:G${u1})`,
      r.aireTot
    );
    const rS = er("Cargas comunes fuera de las unidades (75 %) · 050-202(3)(d)", "0", r.mdServ);
    const rMD = er("MÁXIMA DEMANDA DEL EDIFICIO (W)", `SUM(I${e1 + 1}:I${m - 1})`, r.MD, true);
    MDREF = `'Memoria'!$I$${rMD}`;
    m =
      nota(
        wsM,
        m,
        LM,
        "Los tipos se ordenan de mayor a menor carga por unidad. Si se modifican las cargas en este libro, verifique que el orden se mantenga."
      ) + 1;
    m = sub(wsM, m, LM, "2.3  Servicios generales · Tablero TSG");
    m = thead(wsM, m, [
      [1, 4, "Descripción"],
      [5, 6, "Tipo"],
      [7, 7, "Fases"],
      [8, 8, "Potencia (W)"],
      [9, 9, "Longitud (m)"],
      [10, 10, "Circuito"]
    ]);
    const s0 = m,
      ns = Math.max(r.SV.length, 1);
    for (let i = 0; i < ns; i++) {
      const it = r.SV[i];
      span(wsM, m, 1, 4, it ? it.nombre : "(sin cargas comunes)", { box: 1, ind: 1 });
      span(wsM, m, 5, 6, it ? TSERV[it.tipo] : "—", { box: 1 });
      cell(wsM, m, 7, it ? (it.fases === 3 && SIST[r.sk].tri ? "3φ" : "1φ") : "—", val);
      cell(wsM, m, 8, it ? it.p : 0, { ...inp, fmt: "0" });
      cell(wsM, m, 9, it ? it.L : 0, { ...val, fmt: "0.0" });
      cell(wsM, m, 10, it ? `S-${i + 1}` : "—", val);
      m++;
    }
    const s1 = m - 1;
    const sr = (lab, f, v, bold) => {
      span(wsM, m, 1, 7, lab, { box: 1, ind: 1 });
      cell(wsM, m, 8, F(f, v), { ...val, fmt: "0" });
      span(wsM, m, 9, 10, "", { box: 1 });
      if (bold) tot(wsM, m, 1, 10);
      return m++;
    };
    const sT = sr("Potencia instalada de servicios generales", `SUM(H${s0}:H${s1})`, r.Pserv);
    const sM = sr("Motor de mayor potencia", `SUMPRODUCT(MAX((E${s0}:E${s1}="Motor")*H${s0}:H${s1}))`, r.maxMot);
    const sD = sr(
      "Potencia de diseño del alimentador TSG (+25 % del mayor motor)",
      `H${sT}+0.25*H${sM}`,
      r.Pserv + 0.25 * r.maxMot,
      true
    );
    wsM.getCell(rS, 9).value = F(`0.75*H${sT}`, r.mdServ);
    servPRef = `'Memoria'!$H$${sD}`;
    m++;
  }
  return { LM, m, R, MDREF, servPRef, tipoRow, pisoRow };
}
