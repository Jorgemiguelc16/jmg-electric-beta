/* MOTOR DE CÁLCULO (el corazón de la plataforma)
   calcular(proyecto) recibe los datos del proyecto (el mismo objeto que se guarda en el .json, estado() en
   js/proyectos/proyectos.js) y devuelve el resultado, sin leer nada de la pantalla. ctx() arma los parámetros; dimensionar() elige interruptor y sección por capacidad (Tabla 2 con 5A y 5C)
   y por caída de tensión (Regla 050-102); mdVivienda/mdUso calculan la máxima demanda (Reglas 050-200,
   050-202, 050-204 a 050-210 y Tabla 14); calcUni y calcMulti arman alimentadores y circuitos;
   balancear() reparte las fases; pozo() calcula la puesta a tierra; recomendaciones() da los avisos.
   El motor está en varios archivos, que se cargan en este orden:
   - calculo.js: ctx() (parámetros) y calcular() (entrada del motor);
   - calculo-conductores.js: interruptor, sección, tubo, conductor de protección, alimentadores y circuitos;
   - calculo-demanda.js: máxima demanda y salidas;
   - calculo-tierra-fases.js: puesta a tierra, cortocircuito y balance de fases;
   - calculo-vivienda.js (calcUni) y calculo-edificio.js (calcMulti);
   - verificaciones.js: alertas y recomendaciones.
   Cualquier cambio en el motor debe pasar «npm test» (34 casos contra pruebas/referencia.js). */
function ctx(p = estado()) {
  const g = id => (p[id] == null ? "" : String(p[id])),
    n = id => parseFloat(g(id)) || 0;
  const aisl = g("aisl"),
    temp = +g("temp"),
    nag = +g("nag"),
    met = g("met"),
    ft = FT[aisl][temp] ?? 1,
    fa = FA[nag] ?? 1;
  return {
    aisl,
    temp,
    nag,
    met,
    ft,
    fa,
    fc: ft * fa,
    fp: n("fp") || 0.9,
    maxSal: Math.max(1, Math.min(12, Math.round(n("maxSal") || 12))),
    pAl: n("pAl"),
    pTo: n("pTo"),
    reserva: +g("reserva"),
    uso: g("uso") || "viv",
    resAl: +g("resAl"),
    aLib: Math.max(0, n("aLib")),
    wLib: Math.max(0, n("wLib")),
    fdA: 1 + +g("resAl") / 100,
    sminD: parseFloat(g("sminD")),
    sminA: parseFloat(g("sminA")),
    idMode: g("idMode"),
    dvGen: parseFloat(g("dvGen")),
    iccE: n("iccE") || 10,
    // Poder de corte mínimo comercial (0 = solo según la Icc), tipo de diferencial y arranque de motores
    pdcMin: n("pdcMin"),
    idTipo: g("idTipo") === "AC" ? "AC" : "A",
    kArr: Math.min(12, Math.max(1, n("kArr") || 6)),
    proj: {
      nombre: g("p_nombre"),
      prop: g("p_prop"),
      ubic: g("p_ubic"),
      proy: g("p_proy"),
      cip: g("p_cip").replace(/[<>]/g, "").trim()
    },
    /* Puesta a tierra; cab: profundidad de la cabeza de la varilla bajo el terreno (m), bajo la caja de registro
       (criterio, 0.25 m por defecto): con la longitud de la varilla da la profundidad que alcanza (Regla 060-702(3)(d)) */
    pat: {
      rho: n("rho_s") || 100,
      fr: n("fr") || 1,
      Lv: n("Lv") || 2.4,
      dv: parseFloat(g("dv")),
      cab: g("pzCab") === "" ? 0.25 : Math.max(0, n("pzCab"))
    },
    rho: g("rhoMode") === "20" ? RHO_CU : aisl === "pvc" ? 0.0209 : 0.0223,
    rhoRef:
      g("rhoMode") === "20"
        ? "Cobre a 20 °C"
        : aisl === "pvc"
          ? "Cobre a 70 °C · ρ20 (1 + 0,00393·50)"
          : "Cobre a 90 °C · ρ20 (1 + 0,00393·70)",
    desig: g("desig").replace(/[<>]/g, "").trim(),
    // Tipo de cable (Regla 020-126): «auto» según el uso del edificio, o el que fija el proyectista (criterio)
    cableTipo: ["lsoh", "llama"].includes(g("cableTipo")) ? g("cableTipo") : "auto",
    pDesp: Math.max(0, n("pDesp")),
    // Detalle del pozo de tierra (js/planos/detalles.js) y metrado: medidas en m, materiales por pozo
    pozo: {
      d: Math.max(0, n("pzD")),
      h: Math.max(0, n("pzH")),
      tapa: Math.max(0, n("pzTapa")),
      tapaE: Math.max(0, n("pzTapaE")),
      sal: Math.max(0, n("pzSal")),
      carb: Math.max(0, n("pzCarb")),
      tierra: Math.max(0, n("pzTierra")),
      cond: Math.max(0, n("pzCond")),
      pvc: Math.max(0, n("pzPvc"))
    },
    // Banco de medidores (js/planos/medidores.js): medidas de la concesionaria en m (Luz del Sur por defecto)
    bm: {
      conc: g("bmConc").replace(/[<>]/g, "").trim() || "Luz del Sur",
      lrmA: n("bmLrmA") || 0.2,
      lrmH: n("bmLrmH") || 0.4,
      ltrA: n("bmLtrA") || 0.26,
      ltrH: n("bmLtrH") || 0.47,
      tomaA: n("bmTomaA") || 0.34,
      tomaH: n("bmTomaH") || 0.69,
      tomaF: n("bmTomaF") || 0.21,
      tomaS: g("bmTomaS") === "" ? 0.5 : n("bmTomaS"),
      sepT: g("bmSepT") === "" ? 0.2 : n("bmSepT"),
      sepF: g("bmSepF") === "" ? 0.2 : n("bmSepF"),
      base: g("bmBase") === "" ? 0.05 : n("bmBase"),
      hMax: n("bmHmax") || 1.8,
      filas: Math.max(1, Math.round(n("bmFilas") || 2)),
      dist: g("bmDist") === "" ? 1 : n("bmDist")
    },
    // Alturas de montaje desde el NPT (m), para el diagrama de alturas (js/planos/alturas.js)
    alt: {
      techo: n("hTecho") || 2.9,
      braq: Math.max(0, n("hBraq")),
      tab: Math.max(0, n("hTab")),
      terma: Math.max(0, n("hTerma")),
      int: Math.max(0, n("hInt")),
      tomaC: Math.max(0, n("hTomaC")),
      med: Math.max(0, n("hMed")),
      toma: Math.max(0, n("hToma")),
      fza: Math.max(0, n("hFza")),
      aire: Math.max(0, n("hAire"))
    }
  };
}
/* Proyecto en cálculo: calcular() lo fija mientras calcula; calcUni, calcMulti y sus auxiliares leen de él */
let P = null;
const pv = id => (P[id] == null ? "" : String(P[id])),
  pn = id => parseFloat(pv(id)) || 0;
function calcular(p) {
  const P0 = P;
  P = p;
  try {
    const c = ctx(p),
      r = p.MODE === "multi" ? calcMulti(c) : calcUni(c);
    /* Equipos adicionales y gabinete elegidos en la ficha de cada tablero (TEQ del modo): no intervienen en el
       cálculo, pero el metrado y los planos los leen de aquí, para que el resultado dependa solo del proyecto */
    r.teq = JSON.parse(JSON.stringify((p.TEQ || {})[p.MODE] || {}));
    return r;
  } finally {
    P = P0;
  }
}
