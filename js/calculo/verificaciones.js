/* VERIFICACIONES DEL RESULTADO
   alertas(): incumplimientos y comprobaciones normativas con su regla; recomendaciones(): decisiones que cumplen la
   norma pero conviene revisar (conductores mayores de lo necesario o con poco margen). Solo leen el resultado del
   cálculo; no lo cambian. */
/* Tipo de cable según el uso (Regla 020-126, modificada por la R.M. N.° 175-2008-MEM/DM): en los locales de pública
   concurrencia de la Regla 010-010(4) (comercios, restaurantes, bares, discotecas, teatros, templos, hoteles,
   hospitales, colegios, oficinas y similares) los conductores deben ser no propagadores del incendio, de baja emisión
   de humos y libres de halógenos y ácidos corrosivos (020-126(3)); en los demás, no propagadores de la llama
   (020-126(2)). Usos de la Tabla 14 que el código trata como pública concurrencia; garajes y almacenaje quedan fuera
   (el proyectista puede elegir el tipo en Parámetros). */
const USOS_PUBLICOS = new Set([
  "oficina",
  "comercial",
  "bodegas",
  "bancos",
  "barberias",
  "clubes",
  "hospedajes",
  "teatros",
  "auditorios",
  "iglesias",
  "cortes",
  "escuela",
  "hospital",
  "hotel"
]);
// Designaciones comerciales conocidas: libres de halógenos (NH, LSOH, N2XOH…) y con PVC (TW, THW, NYY…)
const CABLE_LSOH = /^(nh|lsoh|ls0h|n2xoh|nhx|afumex|libre)/i,
  CABLE_HALOG = /^(tw|thw|thhn|nyy|nlt|cpt|ttrf|gpt|vinanel)/i;
function cableNorma(r) {
  const c = r.c,
    usos = r.mode === "uni" ? (r.viv ? [] : [c.uso]) : (r.T || []).filter(t => t.com).map(t => t.uso),
    pub = [...new Set(usos.filter(u => USOS_PUBLICOS.has(u)))],
    lsohNorma = pub.length > 0,
    tipo = c.cableTipo === "lsoh" || c.cableTipo === "llama" ? c.cableTipo : lsohNorma ? "lsoh" : "llama",
    d = c.desig || "";
  return {
    tipo,
    lsohNorma,
    auto: c.cableTipo === "auto",
    usos: pub.map(u => USOS[u].n),
    desigLsoh: CABLE_LSOH.test(d),
    desigHalog: CABLE_HALOG.test(d)
  };
}
function alertas(r) {
  const A = [],
    PD = r.pend;
  /* Resultado preliminar (faltan datos; js/interfaz/interfaz.js): se verifica lo ya calculado y se dice cuánto falta; el
     balance de fases, con cargas pendientes, no se verifica aún */
  if (PD) {
    const al = r.alims.filter((a, i) => !PD.al.has(i)),
      cs = r.circ.filter(q => !PD.circ.has(q.key)),
      dvs = [
        ...r.alims.filter((a, i) => !PD.al.has(i) && !PD.dv.has(i)).map(a => a.dvAc),
        ...cs.filter(q => !PD.cdv.has(q.key)).map(q => q.dVt)
      ],
      ok = al.every(a => a.ok) && cs.every(q => q.ok),
      np = r.alims.length - al.length + r.circ.length - cs.length;
    A.push([
      "warn",
      "Preliminar",
      `Faltan ${r.prelim.length} dato${r.prelim.length === 1 ? "" : "s"} del proyecto: ${np ? `${np} alimentador${np === 1 ? "" : "es"} o circuito${np === 1 ? "" : "s"} y ` : ""}lo que depende de ellos queda pendiente.`
    ]);
    A.push([
      ok,
      "050-102 · 050-104",
      ok
        ? `De lo ya calculado, alimentadores y circuitos conformes${dvs.length ? `; caída de tensión máxima total ${fmt(Math.max(...dvs), 2)} %` : "; la caída de tensión total queda pendiente"}.`
        : "De lo ya calculado, hay alimentadores o circuitos que no cumplen ampacidad o caída de tensión: revise longitudes o secciones."
    ]);
  }
  const maxDV = Math.max(...r.alims.map(a => a.dvAc), ...r.circ.map(q => q.dVt));
  if (!PD)
    A.push([
      r.alims.every(a => a.ok) && r.circ.every(q => q.ok),
      "050-102 · 050-104",
      r.alims.every(a => a.ok) && r.circ.every(q => q.ok)
        ? `Alimentadores y circuitos conformes. Caída de tensión máxima total ${fmt(maxDV, 2)} %.`
        : "Existen alimentadores o circuitos que no cumplen ampacidad o caída de tensión: revise longitudes o secciones."
    ]);
  A.push([
    r.pat.ok,
    "060-712",
    r.pat.ok
      ? `Resistencia de puesta a tierra estimada ${fmt(r.pat.Rt, 1)} Ω ≤ 25 Ω.`
      : `Resistencia estimada ${fmt(r.pat.Rt, 1)} Ω > 25 Ω: se requieren ${r.pat.nVar} electrodos separados al menos 2 m (≈ ${fmt(r.pat.Rn, 1)} Ω).`
  ]);
  if (!r.pat.okL || !r.pat.okD)
    A.push([
      false,
      "060-702",
      `La varilla debe tener al menos 2 m de longitud y 13 mm de diámetro (cobre) o 16 mm (acero-cobre).`
    ]);
  A.push(
    r.pat.okP
      ? [
          true,
          "060-702(3)(d)",
          `La varilla alcanza ${fmt(r.pat.prof, 2)} m de profundidad (cabeza a ${fmt(r.pat.cab, 2)} m y ${fmt(r.pat.Lv, 2)} m de varilla), no menos de 2.5 m.`
        ]
      : [
          false,
          "060-702(3)(d)",
          `La varilla alcanza solo ${fmt(r.pat.prof, 2)} m de profundidad: debe llegar a 2.5 m como mínimo (con roca a 1.2 m o más, hasta la roca; con roca a menos de 1.2 m, enterrada en horizontal a 0.6 m). Aumente la longitud de la varilla o la profundidad de su cabeza.`
        ]
  );
  if (r.bal && !(PD && (PD.md || PD.circ.size))) {
    const b = r.bal;
    A.push([
      b.desb <= 10 ? true : "warn",
      "Balance de fases",
      b.desb <= 10
        ? `Desbalance de cargas ${fmt(b.desb, 1)} % (≤ 10 %, criterio de diseño).`
        : b.desb <= b.desbMin + 0.05
          ? `Desbalance de cargas ${fmt(b.desb, 1)} %: es el mínimo alcanzable con estas cargas (criterio de diseño ≤ 10 %). ${sugerencia(r)}`
          : `Desbalance de cargas ${fmt(b.desb, 1)} % con el reparto manual; el reparto automático lograría ${fmt(b.desbMin, 1)} %.`
    ]);
  } else if (r.mode === "uni" && r.md.MD > 8000)
    A.push([
      true,
      "050-106(9)",
      `Máxima demanda de ${fmt(r.md.MD / 1000, 2)} kW en suministro monofásico: evalúe un suministro trifásico 380/220 V con la concesionaria.`
    ]);
  if (r.mode === "multi")
    A.push([
      r.emerg,
      "EM.010 · Art. 11.1",
      r.emerg
        ? "Incluye iluminación de emergencia en rutas de evacuación."
        : "Los edificios multifamiliares deben contar con iluminación de emergencia en rutas de evacuación: agréguela en servicios generales."
    ]);
  {
    const k = cableNorma(r),
      d = r.c.desig ? ` (${r.c.desig})` : "";
    if (k.lsohNorma)
      A.push(
        k.tipo !== "lsoh"
          ? [
              false,
              "020-126(3)",
              `Local de pública concurrencia (${k.usos.join(", ")}, Regla 010-010(4)): los conductores deben ser no propagadores del incendio, de baja emisión de humos y libres de halógenos; elija ese tipo de cable en Parámetros.`
            ]
          : k.desigHalog
            ? [
                false,
                "020-126(3)",
                `La designación ${r.c.desig} no es libre de halógenos: en un local de pública concurrencia (Regla 010-010(4)) use un cable no propagador del incendio, de baja emisión de humos y libre de halógenos (por ejemplo, NH-80).`
              ]
            : [
                true,
                "020-126(3)",
                `Local de pública concurrencia (${k.usos.join(", ")}): conductores no propagadores del incendio, de baja emisión de humos y libres de halógenos${d}, protegidos contra daños mecánicos.`
              ]
      );
    else
      A.push([
        true,
        "020-126",
        k.tipo === "lsoh"
          ? `Conductores no propagadores del incendio, de baja emisión de humos y libres de halógenos${d} (criterio del proyectista; la norma pide no propagadores de la llama).`
          : `Conductores no propagadores de la llama${d} (Regla 020-126(2)).`
      ]);
  }
  A.push([true, "050-108(2)", `Se prevén ${r.c.reserva} espacio(s) de reserva por tablero para ampliaciones.`]);
  return A;
}

// Recomendaciones de diseño: no son incumplimientos (esos van en alertas), sino decisiones que cumplen la norma pero
// conviene revisar porque llevan a conductores mayores de lo necesario (sobre) o dejan poco margen (ajustado).
// Solo leen el resultado; el proyectista puede aceptarlas y el cálculo continúa igual. Umbrales explicados en el manual.
// Índice en SECC de la sección mínima solo por capacidad de corriente (sin caída de tensión); x.alim marca un alimentador
function idxPorCorriente(x, c) {
  const n3 = x.alim ? x.s.tri : x.f3,
    tabla = T2[c.met][c.aisl + (n3 ? "3" : "2")],
    fc = x.alim ? c.ft : c.fc,
    Smin = x.alim ? c.sminA : c.sminD;
  const k = SECC.findIndex((S, i) => S >= Smin && x.itm !== null && tabla[i] * fc >= x.itm);
  return k < 0 ? null : k;
}
/* Fracción de la caída de tensión permitida que usa un tramo con la sección S (1 = en el límite). La caída del
   tramo es inversamente proporcional a la sección. Alimentadores: acumulada ≤ 2.5 %; derivados: ≤ 2.5 % y total ≤ 4 % */
function usoDV(x, S) {
  const d = (x.dVp * x.S) / S;
  return x.alim ? (x.dvUp + d) / DV_ALIM : Math.max(d / DV_DER, (x.dvUp + d) / DV_TOT);
}
// Poco margen: el tramo usa el 90 % o más del límite de caída de tensión o de la capacidad del conductor (umbral de revisión)
const DV_MARGEN = 0.9;
const pocoMargen = x =>
  x.alim
    ? x.dvAc >= DV_MARGEN * DV_ALIM
    : x.dVp >= DV_MARGEN * DV_DER || x.dVt >= DV_MARGEN * DV_TOT || x.I >= DV_MARGEN * x.Izc;
function recomendaciones(r) {
  const c = r.c,
    R = [],
    nom = x => (x.tab ? `${r.tabs.length > 1 ? x.tab + " · " : ""}${x.id} ${x.desc}` : x.desc);
  const items = [...r.alims.map(a => ({ ...a, alim: true })), ...r.circ];
  // Destino del botón «Ir a»: el campo que define el dato o el circuito en el explorador
  const irItem = x =>
    x.alim
      ? x.pKey === "MD"
        ? { foco: r.mode === "multi" ? "Lgen" : "Lalim", lab: "Ir a la longitud del alimentador" }
        : x.pKey === "servP"
          ? { foco: "Lms", lab: "Ir a la longitud del alimentador" }
          : x.pKey === "bm"
            ? { foco: "Lbm", lab: "Ir a la longitud del alimentador" }
            : x.pKey === "piso" && x.piso === 1
              ? { foco: "Ltd1", lab: "Ir a la longitud del alimentador" }
              : { node: "vivienda", lab: "Ir a los datos del tablero" }
      : { node: "circ:" + x.key, lab: `Ir al circuito ${x.id}` };
  // Sección que bastaría solo por capacidad de corriente (sin caída de tensión)
  const porCorriente = x => idxPorCorriente(x, c);
  // Sección automática (la mínima que cumple): la elegida en el cuadro de conductores no cuenta aquí
  const dv = items.filter(x => {
    const k = porCorriente(x);
    return k !== null && SECC.indexOf(x.Sauto ?? x.S) - k >= 2;
  });
  if (dv.length)
    R.push({
      id: "dv|" + dv.map(nom).join(","),
      tipo: "sobre",
      tit: "Secciones definidas por la caída de tensión",
      txt: `${dv
        .slice(0, 4)
        .map(
          x =>
            `${nom(x)}: ${x.Sauto ?? x.S} mm² (por corriente bastaría ${SECC[porCorriente(x)]} mm², L = ${fmt(x.L, 1)} m)`
        )
        .join("; ")}${dv.length > 4 ? ` y ${dv.length - 4} más` : ""}.`,
      sug: "Si la longitud es correcta, la sección es la que exige la Regla 050-102. Para reducirla, acerque el tablero a las cargas, divida el circuito o use un tablero de distribución intermedio.",
      ir: irItem(dv[0])
    });
  // Secciones elegidas en el cuadro de conductores, mayores que la mínima que cumple
  const ma = items.filter(x => x.Sauto && x.S > x.Sauto);
  if (ma.length)
    R.push({
      id: "secf|" + ma.map(x => `${nom(x)}:${x.S}`).join(","),
      tipo: "sobre",
      tit: "Secciones mayores que la mínima que cumple",
      txt: `${ma
        .slice(0, 4)
        .map(x => `${nom(x)}: ${x.S} mm² elegido; cumple desde ${x.Sauto} mm²`)
        .join("; ")}${ma.length > 4 ? ` y ${ma.length - 4} más` : ""}.`,
      sug: "El conductor mayor también cumple la norma, pero cuesta más. Si no hay un motivo para usarlo, vuelva a la sección automática (la primera de la lista) en el cuadro de conductores.",
      ir: { act: "cond", lab: "Abrir el cuadro de conductores" }
    });
  const im = r.alims.filter(a => a.Imin && a.Id === a.Imin && a.Imin >= 2 * a.I);
  if (im.length)
    R.push({
      id: "imin|" + im.map(a => a.desc).join(","),
      tipo: "sobre",
      tit: "Interruptor fijado por la corriente mínima del código",
      txt:
        im
          .map(a => `${a.desc}: carga de ${fmt(a.I, 1)} A, pero el código exige al menos ${a.Imin} A (ITM ${a.itm} A)`)
          .join("; ") + ".",
      sug: "Es una exigencia de las Reglas 050-200(1)(b) y 050-202(1)(b), no un error de cálculo. Basta con conocerla al revisar el expediente.",
      ir: { view: "alims", lab: "Ver alimentadores" }
    });
  if (c.met === "A1")
    R.push({
      id: "a1",
      tipo: "sobre",
      tit: "Método A1: pared térmicamente aislante",
      txt: "El método A1 corresponde a tubos en paredes con revestimiento aislante y reduce la capacidad de los conductores (por ejemplo, 10 mm²: 46 A en A1 y 57 A en B1).",
      sug: "Si los tubos van empotrados en ladrillo o concreto, corresponde el método B1 (CNE-U, Tabla 4, ítem 59).",
      ir: { foco: "met", lab: "Ir a Método de instalación" }
    });
  if (c.resAl === 0)
    R.push({
      id: "res0",
      tipo: "sub",
      tit: "Alimentadores sin reserva para ampliaciones",
      txt: "Los alimentadores de vivienda se dimensionan con la corriente de la máxima demanda, sin el 25 % de reserva usual.",
      sug: "Es el mínimo que admite la norma (Reglas 050-200(3) y 050-202(2)). Úselo si no se prevén ampliaciones; en caso contrario, elija 25 %.",
      ir: { foco: "resAl", lab: "Ir a Reserva en alimentadores" }
    });
  const mg = items.filter(x => x.ok && pocoMargen(x));
  if (mg.length)
    R.push({
      id: "margen|" + mg.map(nom).join(","),
      tipo: "sub",
      tit: "Poco margen de caída de tensión o de capacidad",
      txt: `${mg.slice(0, 4).map(nom).join("; ")}${mg.length > 4 ? ` y ${mg.length - 4} más` : ""}: ${mg.length > 1 ? "usan" : "usa"} el 90 % o más del límite de caída de tensión o de la capacidad del conductor.`,
      sug: "Cumplen, pero cualquier carga o longitud adicional los dejaría fuera de norma. Si se prevén ampliaciones o el recorrido en obra puede ser más largo, elija la sección siguiente en el cuadro de conductores.",
      ir: { act: "cond", lab: "Abrir el cuadro de conductores" }
    });
  // Umbral de tomacorrientes: 180 W en vivienda (CNE tomo V: 180 VA) y 250 VA en usos comerciales (criterio de diseño).
  // El alumbrado no se evalúa: con luminarias LED es normal usar menos de 100 W por salida (se usa la potencia real del equipo)
  const tTo = r.viv === false ? VA_TOMA_COM : 180;
  const pw = r.circ.filter(q => q.n > 0 && q.tipo === "Tomacorriente" && !q.mix && q.P / q.n < tTo);
  if (pw.length)
    R.push({
      id: "pot",
      tipo: "sub",
      tit: "Potencia por tomacorriente menor que la usual",
      txt: `Se usan menos de ${tTo} W por tomacorriente.`,
      sug:
        r.viv === false
          ? `En oficinas y usos comerciales se adopta ${VA_TOMA_COM} VA por tomacorriente como criterio de diseño, por la conexión de varios equipos por punto (impresoras, fotocopiadoras, computadoras). Use valores menores solo si están justificados.`
          : "El valor usual de diseño es 180 W por tomacorriente (el CNE tomo V indica 180 VA por salida). Use valores menores solo si están justificados.",
      ir: { foco: r.mode === "multi" ? "pTo" : "tg_p", lab: "Ir a Potencia por tomacorriente" }
    });
  if (c.temp < 30)
    R.push({
      id: "temp",
      tipo: "sub",
      tit: "Temperatura ambiente menor de 30 °C",
      txt: `Con ${c.temp} °C la Tabla 5A aumenta la capacidad de los conductores (factor ${fmt(c.ft, 2)}).`,
      sug: "Use la temperatura del lugar más caluroso por donde pasan los conductores (techos, muros expuestos al sol).",
      ir: { foco: "temp", lab: "Ir a Temperatura ambiente" }
    });
  if (c.met === "C")
    R.push({
      id: "metc",
      tipo: "sub",
      tit: "Método C: cable a la vista sobre pared",
      txt: "El método C supone cables sin tubo, fijados sobre la pared, y da la mayor capacidad de la Tabla 2.",
      sug: "Si los conductores van dentro de tubos empotrados, corresponde el método B1.",
      ir: { foco: "met", lab: "Ir a Método de instalación" }
    });
  // Avisos del diseño en el plano (con «Calcular con el diseño»)
  const pa = r.plano ? r.plano.avisos.filter(a => a.t !== "info") : [];
  if (pa.length)
    R.push({
      id: "plano|" + pa.map(a => a.m).join(","),
      tipo: "sub",
      tit: "Avisos del diseño en el plano",
      txt: `${pa
        .slice(0, 4)
        .map(a => a.m)
        .join("; ")}${pa.length > 4 ? ` y ${pa.length - 4} más` : ""}.`,
      sug: "Corríjalos en el editor de diseño: mientras tanto, esas salidas se calculan sin potencia o con la longitud estimada en línea quebrada.",
      ir: { act: "datosplano", lab: "Abrir los datos del plano" }
    });
  // Las longitudes del plano son medidas: no se avisan
  const l1 = items.filter(x => x.L <= 1 && !x.plano);
  if (l1.length)
    R.push({
      id: "l1|" + l1.map(nom).join(","),
      tipo: "sub",
      tit: "Longitudes de 1 m o menos",
      txt: `${l1.slice(0, 4).map(nom).join("; ")}${l1.length > 4 ? ` y ${l1.length - 4} más` : ""}: ${l1.length > 1 ? "las longitudes son" : "la longitud es"} de 1 m o menos, valor que se adopta cuando falta el dato.`,
      sug: "Ingrese la longitud real hasta la salida más alejada; con 1 m la caída de tensión resulta casi nula.",
      ir: irItem(l1[0])
    });
  return R;
}
