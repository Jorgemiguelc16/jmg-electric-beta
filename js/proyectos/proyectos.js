/* PROYECTOS · DATOS DEL PROYECTO
   Datos del proyecto (KEYS, PROY, ponerDato), su estado para guardar (estado), la preparación para el cálculo
   (proyectoDe), abrirlo en la pantalla (aplicar), proyectos nuevos y de ejemplo. El proyecto se guarda en
   js/proyectos/almacen.js; se valida al abrirlo en js/proyectos/validar.js; la lista de proyectos está en
   js/proyectos/biblioteca.js. */
const KEYS = [
  "p_nombre",
  "p_prop",
  "p_ubic",
  "p_proy",
  "p_cip",
  "uso",
  "aE",
  "fp",
  "maxSal",
  "pAl",
  "pTo",
  "reserva",
  "resAl",
  "met",
  "aisl",
  "temp",
  "nag",
  "sminD",
  "sminA",
  "rhoMode",
  "desig",
  "cableTipo",
  "idMode",
  "iccE",
  "pdcMin",
  "idTipo",
  "kArr",
  "dvGen",
  "pDesp",
  "pzD",
  "pzH",
  "pzCab",
  "pzTapa",
  "pzTapaE",
  "pzSal",
  "pzCarb",
  "pzTierra",
  "pzCond",
  "pzPvc",
  "bmConc",
  "bmLrmA",
  "bmLrmH",
  "bmLtrA",
  "bmLtrH",
  "bmTomaA",
  "bmTomaH",
  "bmTomaF",
  "bmTomaS",
  "bmSepT",
  "bmSepF",
  "bmBase",
  "bmHmax",
  "bmFilas",
  "bmDist",
  "hTecho",
  "hBraq",
  "hTab",
  "hTerma",
  "hInt",
  "hTomaC",
  "hMed",
  "hToma",
  "hFza",
  "hAire",
  "area",
  "sot",
  "aLib",
  "wLib",
  "Lalim",
  "al_n",
  "al_p",
  "al_L",
  "tg_n",
  "tg_p",
  "tg_L",
  "tc_n",
  "tc_p",
  "tc_L",
  "Lgen",
  "Lms",
  "bmJunto",
  "Lbm",
  "tgbmMax",
  "tsgDe",
  "fLoc",
  "rho_s",
  "fr",
  "Lv",
  "dv",
  "esqPisos",
  "Ltd1",
  "calPlano",
  "hEnt"
];
const SKEY = BETA ? "jmg-electric-beta-v1" : "jmg-electric-v1",
  DEFV = {};
KEYS.forEach(k => (DEFV[k] = $(k).value));
/* DATOS DEL PROYECTO: fuente única desde la etapa 1 (paso 3). PROY guarda los datos del proyecto (los de KEYS y
   el sistema eléctrico); los campos de la pantalla solo los muestran. Lo que el usuario escribe pasa a PROY al
   instante (escucha en fase de captura, antes que cualquier otro manejador); el código cambia un dato con
   ponerDato(), que actualiza PROY y el campo a la vez. estado() lee de PROY. */
const PROY = { ...DEFV, sist: null, sistG: null };
const ES_DATO = new Set(KEYS);
// Pone un dato del proyecto; guarda el valor que el campo acepta (una lista no admite un valor que no tiene)
function ponerDato(k, v) {
  const el = $(k);
  if (el) {
    el.value = v;
    PROY[k] = el.value;
  } else PROY[k] = String(v ?? "");
}
["input", "change"].forEach(t =>
  document.addEventListener(
    t,
    e => {
      const el = e.target;
      if (el.type === "radio" && (el.name === "sist" || el.name === "sistG")) {
        if (el.checked) PROY[el.name] = el.value;
      } else if (el.id && ES_DATO.has(el.id)) PROY[el.id] = el.value;
    },
    true
  )
);
["area", "Lalim", "al_n", "al_p", "al_L", "tg_n", "tg_p", "tg_L", "tc_n", "tc_p", "tc_L", "Lgen", "Lms", "Lbm"].forEach(
  k => {
    if ($(k) && !$(k).placeholder) $(k).placeholder = "ej. " + DEFV[k];
  }
);
if ($("sot")) $("sot").placeholder = "0 si no hay";
[["p_nombre", "Nombre del proyecto"]].forEach(([k, t]) => {
  if ($(k) && !$(k).placeholder) $(k).placeholder = t;
});
const clon = o => JSON.parse(JSON.stringify(o));
const LKEY = BETA ? "jmg-electric-beta-proyectos" : "jmg-electric-proyectos";
// La primera vez, el sitio de pruebas empieza con una copia de los proyectos del oficial (que no cambian)
if (BETA)
  try {
    if (localStorage.getItem(LKEY) === null) {
      localStorage.setItem(LKEY, localStorage.getItem("jmg-electric-proyectos") || "{}");
      const d = localStorage.getItem("jmg-electric-v1");
      if (d && localStorage.getItem(SKEY) === null) localStorage.setItem(SKEY, d);
    }
  } catch (e) {}
const nuevoId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function estado() {
  const o = {
    app: "JMG-ELECTRIC",
    version: VERSION,
    id: PID,
    savedAt: new Date().toISOString(),
    MODE,
    cargas,
    tipos,
    cargasT,
    serv,
    pisos,
    lums,
    lumsT,
    toms,
    tomsT,
    FIX,
    ACEP,
    TEQ,
    SECF,
    PLANO,
    // Precios unitarios del presupuesto (js/resultados/presupuesto.js)
    PRESU,
    // Niveles de iluminación del proyecto (js/calculo/iluminacion.js)
    LUX,
    res: RESUMEN,
    sist: PROY.sist || radio("sist"),
    sistG: PROY.sistG || radio("sistG")
  };
  KEYS.forEach(k => (o[k] = PROY[k]));
  return o;
}
const esEjemplo = () => /^EJEMPLO\b/.test($("p_nombre").value.trim());
/* Proyecto listo para calcular(), con el mismo formato que estado(), a partir de un proyecto guardado o de un
   caso de prueba (lo usan las pruebas sin navegador, herramientas/pruebas.js). Los datos que falten toman el
   valor por defecto. */
// eslint-disable-next-line no-unused-vars -- la usa herramientas/pruebas.js (pruebas sin navegador)
function proyectoDe(o) {
  const n = normalizar(o),
    p = {
      MODE: n.MODE,
      sist: n.sist,
      sistG: n.sistG,
      FIX: n.FIX,
      ACEP: n.ACEP,
      TEQ: n.TEQ,
      SECF: n.SECF,
      PLANO: n.PLANO
    };
  KEYS.forEach(k => (p[k] = n.campos[k] !== undefined ? n.campos[k] : String(DEFV[k] ?? "")));
  LISTAS_PROY.forEach(k => (p[k] = n.listas[k] || []));
  return p;
}
function aplicar(o) {
  if (o && o._idb) {
    const c = LIB && LIB[o.id];
    if (c && !c._idb) o = c;
    else return toast("El proyecto se está leyendo de la base de datos del navegador: inténtelo en un momento");
  }
  const n = normalizar(o);
  PID = n.id;
  // El estado del guardado muestra la hora del proyecto abierto
  GUARDADO_T = Date.parse(o && o.savedAt) || 0;
  KEYS.forEach(k => {
    if (n.campos[k] !== undefined) ponerDato(k, n.campos[k]);
  });
  LISTAS_PROY.forEach(k => {
    const a = LISTS[k].arr;
    if (n.listas[k]) {
      a.length = 0;
      a.push(...n.listas[k]);
    }
  });
  FIX = n.FIX;
  ACEP = n.ACEP;
  TEQ = n.TEQ;
  SECF = n.SECF;
  PLANO = n.PLANO;
  PRESU = n.PRESU;
  LUX = n.LUX;
  renderSys("sys_uni", "sist", n.sist);
  renderSys("sys_multi", "sistG", n.sistG);
  PROY.sist = n.sist;
  PROY.sistG = n.sistG;
  Object.keys(LISTS).forEach(renderList);
  const f0 = FORZAR;
  FORZAR = true;
  try {
    setMode(n.MODE);
  } finally {
    FORZAR = f0;
  }
  if (typeof planoAplicado === "function") planoAplicado();
}
const PKEYS = [
  "p_nombre",
  "p_prop",
  "p_ubic",
  "p_proy",
  "p_cip",
  "area",
  "sot",
  "aLib",
  "Lalim",
  "Ltd1",
  "al_n",
  "al_p",
  "al_L",
  "tg_n",
  "tg_p",
  "tg_L",
  "tc_n",
  "tc_p",
  "tc_L",
  "Lgen",
  "Lms"
];
function proyectoVacio(m) {
  const o = {
    id: null,
    ...DEFV,
    MODE: m,
    cargas: [],
    tipos: [LISTS.tipos.nuevo()],
    cargasT: [],
    serv: [],
    pisos: [],
    lums: [],
    lumsT: [],
    toms: [],
    tomsT: [],
    FIX: null,
    sist: "mono220",
    sistG: "tri380"
  };
  PKEYS.forEach(k => (o[k] = ""));
  ["al_p", "tg_p", "tc_p"].forEach(k => (o[k] = DEFV[k]));
  o.tipos[0].nombre = "Tipo A";
  return o;
}
// Ejemplo de oficina (Tabla 14): 250 m², trifásico, tomacorrientes de 250 VA, aire acondicionado y equipos de cómputo
const EJ_OFICINA = {
  uso: "oficina",
  sist: "tri380",
  area: "250",
  sot: "0",
  Lalim: "20",
  al_n: "32",
  al_p: "100",
  al_L: "28",
  tg_n: "30",
  tg_p: String(VA_TOMA_COM),
  tg_L: "30",
  tc_n: "0",
  tc_p: String(VA_TOMA_COM),
  tc_L: "12",
  cargas: [
    { nombre: "Aire acondicionado sala de reuniones", tipo: "aire", fases: 3, p: 3500, L: 18, piso: 0 },
    { nombre: "Aire acondicionado oficinas", tipo: "aire", fases: 3, p: 5000, L: 24, piso: 0 },
    { nombre: "Rack de servidores y red", tipo: "otra", fases: 1, p: 1500, L: 15, piso: 0 },
    { nombre: "Fotocopiadora", tipo: "otra", fases: 1, p: 1800, L: 20, piso: 0 }
  ]
};
function cargarEjemplo(m) {
  const com = m === "com",
    md = com ? "uni" : m;
  aplicar({
    id: null,
    ...DEFV,
    MODE: md,
    cargas: clon(DEF.cargas),
    tipos: clon(DEF.tipos),
    cargasT: clon(DEF.cargasT),
    serv: clon(DEF.serv),
    pisos: [],
    lums: [],
    lumsT: [],
    toms: [],
    tomsT: [],
    FIX: null,
    sist: "mono220",
    sistG: "tri380",
    ...(com ? clon(EJ_OFICINA) : {})
  });
  setTab("calculo");
  const v = {
    p_nombre: com
      ? "EJEMPLO · Oficinas de 250 m²"
      : m === "multi"
        ? "EJEMPLO · Edificio multifamiliar de 8 departamentos"
        : "EJEMPLO · Vivienda unifamiliar",
    p_prop: "Propietario de ejemplo",
    p_ubic: "Arequipa, Perú",
    p_proy: "Ing. responsable"
  };
  Object.entries(v).forEach(([k, x]) => ponerDato(k, x));
  VIEW = "unifilar";
  calcularAhora();
  irSec("resultados");
}
