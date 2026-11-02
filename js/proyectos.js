/* PROYECTOS
   Guardado automático en el navegador (localStorage), biblioteca de proyectos, abrir/duplicar/exportar,
   proyectos nuevos y de ejemplo (vivienda, edificio y oficina). */
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
  "idMode",
  "iccE",
  "pdcMin",
  "idTipo",
  "kArr",
  "dvGen",
  "pDesp",
  "pzD",
  "pzH",
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
  "rho_s",
  "fr",
  "Lv",
  "dv",
  "esqPisos",
  "Ltd1"
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
["area", "Lalim", "al_n", "al_p", "al_L", "tg_n", "tg_p", "tg_L", "tc_n", "tc_p", "tc_L", "Lgen", "Lms"].forEach(k => {
  if ($(k) && !$(k).placeholder) $(k).placeholder = "ej. " + DEFV[k];
});
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
/* ALMACÉN DE PROYECTOS (v3.0)
   Los proyectos se guardan en la base de datos del navegador (IndexedDB «jmg-electric-proyectos»), que admite
   cientos de megas: la biblioteca, un registro por proyecto («<LKEY>/<id>»), y el proyecto abierto («<SKEY>»).
   El almacenamiento pequeño (localStorage, unos 5 MB para todo) queda como copia de respaldo y para arrancar al
   instante: cada proyecto completo si cabe y, si no, solo su resumen (con _idb: está completo en la base). La
   primera vez, los proyectos que solo estaban en el almacenamiento pequeño pasan a la base. La biblioteca se usa
   en memoria (LIB); las escrituras a la base van en segundo plano, solo de los proyectos que cambiaron. */
const AL_NOM = "jmg-electric-proyectos",
  AL_HAY = typeof indexedDB !== "undefined",
  // Copia en el almacenamiento pequeño: proyectos completos hasta unos 3.5 MB entre todos (el resto, resumen)
  AL_LS_MAX = 3.5e6;
let AL_DBP = null,
  LIB = null,
  AL_LISTO = false,
  AL_BORR = null;
const AL_ESCRITO = new Map();
function alDb() {
  if (!AL_DBP)
    AL_DBP = new Promise((ok, mal) => {
      const r = indexedDB.open(AL_NOM, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("p");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  return AL_DBP;
}
// Guarda (o borra, con v undefined) un registro de la base
async function alPut(k, v) {
  const db = await alDb();
  return new Promise((ok, mal) => {
    const t = db.transaction("p", "readwrite");
    if (v === undefined) t.objectStore("p").delete(k);
    else t.objectStore("p").put(v, k);
    t.oncomplete = ok;
    t.onerror = () => mal(t.error);
  });
}
// Todos los registros de la base cuya clave empieza con el prefijo: [[clave, valor], …]
async function alTodo(pre) {
  const db = await alDb();
  return new Promise((ok, mal) => {
    const out = [],
      r = db
        .transaction("p")
        .objectStore("p")
        .openCursor(IDBKeyRange.bound(pre, pre + "\uffff"));
    r.onsuccess = () => {
      const c = r.result;
      if (!c) return ok(out);
      out.push([c.key, c.value]);
      c.continue();
    };
    r.onerror = () => mal(r.error);
  });
}
async function alLeer(k) {
  const db = await alDb();
  return new Promise((ok, mal) => {
    const r = db.transaction("p").objectStore("p").get(k);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
// Resumen de un proyecto (lo que necesitan las tarjetas y la lista) para la copia en el almacenamiento pequeño
const alResumen = o => ({
  _idb: true,
  app: o.app,
  id: o.id,
  p_nombre: o.p_nombre,
  p_ubic: o.p_ubic,
  p_proy: o.p_proy,
  uso: o.uso,
  MODE: o.MODE,
  savedAt: o.savedAt,
  res: o.res,
  psha: o.PLANO && o.PLANO.sha
});
function libLocal() {
  try {
    const o = JSON.parse(localStorage.getItem(LKEY) || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch (e) {
    return {};
  }
}
function libLoad() {
  if (!LIB) LIB = libLocal();
  return LIB;
}
function libSave(L) {
  LIB = L;
  libEspejo();
  alProgramar();
  return true;
}
// Copia en el almacenamiento pequeño: completos los que caben (los más recientes primero); los demás, su resumen
function libEspejo() {
  const arr = Object.values(LIB)
    .filter(o => o && o.id)
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  let tam = 0;
  const C = {};
  arr.forEach(o => {
    if (o._idb) return (C[o.id] = o);
    const n = JSON.stringify(o).length;
    if (tam + n < AL_LS_MAX || !AL_HAY) {
      tam += n;
      C[o.id] = o;
    } else C[o.id] = alResumen(o);
  });
  try {
    localStorage.setItem(LKEY, JSON.stringify(C));
  } catch (e) {
    try {
      localStorage.setItem(LKEY, JSON.stringify(Object.fromEntries(arr.map(o => [o.id, o._idb ? o : alResumen(o)]))));
    } catch (e2) {}
  }
}
// Escritura a la base en segundo plano: los proyectos que cambiaron (por su fecha) y los que se eliminaron
let AL_T = null;
function alProgramar() {
  if (!AL_HAY) return;
  clearTimeout(AL_T);
  AL_T = setTimeout(alEscribir, 250);
}
async function alEscribir() {
  if (!AL_LISTO) return alProgramar();
  try {
    for (const o of Object.values(LIB))
      if (o && o.id && !o._idb && AL_ESCRITO.get(o.id) !== o.savedAt) {
        await alPut(LKEY + "/" + o.id, o);
        AL_ESCRITO.set(o.id, o.savedAt);
      }
    for (const id of [...AL_ESCRITO.keys()])
      if (!LIB[id]) {
        await alPut(LKEY + "/" + id);
        AL_ESCRITO.delete(id);
      }
  } catch (e) {
    toast("No se pudo guardar en la base de datos del navegador: " + (e && e.message ? e.message : e));
  }
}
// Al arrancar: la biblioteca y el proyecto abierto desde la base; lo que solo estaba en el almacenamiento pequeño
// pasa a la base (la primera vez); se pide que el navegador no borre estos datos cuando le falta espacio
async function alCargar() {
  if (!AL_HAY) return;
  try {
    const L = libLoad(),
      base = await alTodo(LKEY + "/");
    base.forEach(([, p]) => {
      if (!p || !p.id) return;
      AL_ESCRITO.set(p.id, p.savedAt);
      const l = L[p.id];
      if (!l || l._idb || String(p.savedAt) >= String(l.savedAt)) L[p.id] = p;
    });
    AL_LISTO = true;
    // Migración: lo que la base no tiene (o tiene más antiguo)
    for (const o of Object.values(L))
      if (o && o.id && !o._idb && AL_ESCRITO.get(o.id) !== o.savedAt) {
        await alPut(LKEY + "/" + o.id, o);
        AL_ESCRITO.set(o.id, o.savedAt);
      }
    // Proyectos que figuran solo por su resumen y que la base no tiene: se quitan de la lista (no hay datos)
    Object.keys(L).forEach(id => {
      if (L[id] && L[id]._idb && !AL_ESCRITO.has(id)) delete L[id];
    });
    libEspejo();
    // Proyecto abierto: el de la base si es más reciente que el del almacenamiento pequeño (o este no lo tiene)
    const b = await alLeer(SKEY);
    if (b && typeof b === "object" && b.app === "JMG-ELECTRIC") {
      AL_BORR = b;
      const l = loadDraftLocal();
      if (AL_MARCA0 || !l || l._idb || String(b.savedAt) > String(l.savedAt || "")) {
        aplicar(b);
        if (typeof calcularAhora === "function") calcularAhora();
      }
    } else {
      const l = loadDraftLocal();
      if (l && !l._idb) await alPut(SKEY, l);
    }
    if (typeof centro === "function") centro();
    if ($("projList")) renderProy();
    if (navigator.storage && navigator.storage.persist)
      navigator.storage
        .persisted()
        .then(p => p || navigator.storage.persist())
        .catch(() => {});
  } catch (e) {
    AL_LISTO = false;
    console.warn("Base de datos de proyectos no disponible:", e);
  }
}
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
    res: RESUMEN,
    sist: PROY.sist || radio("sist"),
    sistG: PROY.sistG || radio("sistG")
  };
  KEYS.forEach(k => (o[k] = PROY[k]));
  return o;
}
const esEjemplo = () => /^EJEMPLO\b/.test($("p_nombre").value.trim());
// Proyecto abierto: en la base (en segundo plano) y en el almacenamiento pequeño si cabe (si no, una marca)
let AL_BT = null;
function guardarBorrador(s, o) {
  try {
    localStorage.setItem(
      SKEY,
      s.length < 2.5e6 ? s : JSON.stringify({ _idb: true, savedAt: o.savedAt, p_nombre: o.p_nombre })
    );
  } catch (e) {
    try {
      localStorage.setItem(SKEY, JSON.stringify({ _idb: true, savedAt: o.savedAt, p_nombre: o.p_nombre }));
    } catch (e2) {}
  }
  if (!AL_HAY) return;
  AL_BORR = o;
  clearTimeout(AL_BT);
  AL_BT = setTimeout(() => alPut(SKEY, AL_BORR).catch(() => {}), 250);
}
function saveDraft() {
  if (esEjemplo()) {
    PID = null;
    const s = JSON.stringify(estado());
    return guardarBorrador(s, JSON.parse(s));
  }
  if ($("p_nombre").value.trim() && !PID) PID = nuevoId();
  // Una copia (no los mismos arreglos de la pantalla, que siguen cambiando)
  const s = JSON.stringify(estado()),
    o = JSON.parse(s);
  guardarBorrador(s, o);
  if (PID && o.p_nombre.trim()) {
    const L = libLoad();
    L[PID] = o;
    libSave(L);
  }
}
function loadDraftLocal() {
  let o = null;
  try {
    o = JSON.parse(localStorage.getItem(SKEY) || "null");
  } catch (e) {}
  return o && typeof o === "object" ? o : null;
}
// El proyecto abierto: el del almacenamiento pequeño o, si allí solo hay la marca, el de la base (ya leído)
function loadDraft() {
  const o = loadDraftLocal();
  return o && o._idb ? AL_BORR : o;
}
// Al arrancar: ¿el proyecto abierto estaba solo en la base (demasiado grande para el almacenamiento pequeño)?
const AL_MARCA0 = !!(loadDraftLocal() || {})._idb;
/* Respaldo completo: el archivo .json del proyecto lleva también su plano DXF (que en el navegador se guarda aparte,
   por su huella), en base64; al abrir el archivo en otra computadora, el plano vuelve a la base. */
async function proyectoConPlano(o) {
  if (!o || !o.PLANO || !o.PLANO.sha || typeof plLeerArchivo !== "function") return o;
  try {
    const a = await plLeerArchivo(o.PLANO.sha);
    if (!a || !a.buf) return o;
    const b64 = await new Promise((ok, mal) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1] || "");
      r.onerror = () => mal(r.error);
      r.readAsDataURL(new Blob([a.buf]));
    });
    return { ...o, PLANO_DXF: { nombre: a.nombre || o.PLANO.nombre, b64 } };
  } catch (e) {
    return o;
  }
}
// Al abrir un archivo con su plano: el plano pasa a la base del navegador y se quita del proyecto
async function guardarPlanoDeArchivo(o) {
  const d = o && o.PLANO_DXF;
  if (!d) return o;
  const p = { ...o };
  delete p.PLANO_DXF;
  try {
    if (p.PLANO && p.PLANO.sha && typeof d.b64 === "string") {
      const bin = atob(d.b64),
        buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      await plGuardarArchivo(p.PLANO.sha, {
        nombre: String(d.nombre || p.PLANO.nombre || "plano.dxf").slice(0, 120),
        buf: buf.buffer,
        fecha: new Date().toISOString()
      });
    }
  } catch (e) {
    toast("El proyecto se abrió, pero su plano DXF no se pudo guardar en el navegador");
  }
  return p;
}
// Espacio que usan los proyectos y planos en este navegador (para la lista de proyectos)
async function alUso() {
  const el = $("alUso");
  if (!el || !navigator.storage || !navigator.storage.estimate) return;
  try {
    const e = await navigator.storage.estimate(),
      p = navigator.storage.persisted ? await navigator.storage.persisted() : false,
      mb = v => fmt(v / 1048576, v < 1048576 * 10 ? 1 : 0);
    el.innerHTML = `Espacio usado en este navegador: <b>${mb(e.usage || 0)} MB</b> de unos ${mb(e.quota || 0)} MB disponibles${p ? " · protegido: el navegador no lo borra por falta de espacio" : ""}. Para no perder su trabajo, exporte sus proyectos de vez en cuando: el archivo lleva también el plano DXF.`;
  } catch (e) {}
}
// Borra el proyecto abierto (Restablecer valores iniciales)
async function alBorrarBorrador() {
  try {
    localStorage.removeItem(SKEY);
  } catch (e) {}
  if (AL_HAY) await alPut(SKEY).catch(() => {});
}
function limpiarLista(a, plantilla, nums = []) {
  return Array.isArray(a)
    ? a
        .filter(x => x && typeof x === "object")
        .map(x => {
          const y = { ...plantilla };
          Object.keys(plantilla).forEach(k => {
            if (x[k] == null || x[k] === "") {
              if (nums.includes(k)) y[k] = null;
              return;
            }
            y[k] =
              nums.includes(k) || typeof plantilla[k] === "number"
                ? parseFloat(x[k]) || 0
                : String(x[k]).replace(/[<>]/g, "").slice(0, 120);
          });
          return y;
        })
    : null;
}
/* Proyectos anteriores a la v2.8: las cargas especiales de cada tipo de departamento eran cuatro totales en W
   (cocina, calentador, aire acondicionado y otras > 1500 W). Cada total con valor pasa a ser una fila de la lista
   cargasT, con la longitud de los circuitos del departamento; la máxima demanda y los circuitos quedan iguales. */
function migrarCargasT(o) {
  if (Array.isArray(o.cargasT) || !Array.isArray(o.tipos)) return o;
  const L = [];
  o.tipos.forEach((t, i) => {
    if (!t || typeof t !== "object") return;
    [
      ["coc", "cocina", "Cocina eléctrica"],
      ["cal", "calentador", "Calentador de agua / ducha"],
      ["aire", "aire", "Aire acondicionado"],
      ["otras", "otra", "Otras cargas mayores de 1500 W"]
    ].forEach(([k, tipo, nombre]) => {
      const p = parseFloat(t[k]) || 0;
      if (p > 0) L.push({ nombre, tipo, p, L: parseFloat(t.Lc) || null, dep: i });
    });
  });
  return { ...o, cargasT: L };
}
/* Preparación de un proyecto al abrirlo (o al cargar un caso de prueba), sin tocar la pantalla: convierte los
   proyectos anteriores, limpia las listas y los datos con las mismas reglas de siempre y completa valores por
   defecto. Devuelve los datos en campos, listas (null = dejar la actual) y
   el estado de las elecciones del usuario (FIX, ACEP, TEQ, SECF), el sistema y el modo. */
const LISTAS_PROY = ["cargas", "tipos", "cargasT", "serv", "pisos", "lums", "lumsT", "toms", "tomsT"];
function normalizar(o) {
  o = migrarCargasT(o);
  const campos = {};
  // Un dato que el proyecto no trae (por ejemplo, de una versión anterior) toma su valor por defecto, nunca el del
  // proyecto que estaba abierto antes (corrección de la v2.9.2: así ningún proyecto hereda datos de otro)
  KEYS.forEach(k => (campos[k] = o[k] != null ? String(o[k]).replace(/[<>]/g, "") : DEFV[k]));
  const listas = Object.fromEntries(
    LISTAS_PROY.map(k => [
      k,
      limpiarLista(
        o[k],
        LISTS[k].nuevo(),
        LISTS[k].f
          .filter(f => f.t === "number" || f.k === "fases")
          .map(f => f.k)
          .filter(x => x !== "fases")
      ) || (["pisos", "lums", "lumsT", "toms", "tomsT", "cargasT"].includes(k) ? [] : null)
    ])
  );
  const ok = v =>
    v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string")) : {};
  const fx = o.FIX && typeof o.FIX === "object" ? o.FIX : {},
    ac = o.ACEP && typeof o.ACEP === "object" ? o.ACEP : {};
  // Equipos adicionales por tablero: solo claves conocidas y valores verdaderos
  const te = o.TEQ && typeof o.TEQ === "object" ? o.TEQ : {},
    okq = v =>
      v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, x]) => x && typeof x === "object")
              .map(([t, x]) => [
                t,
                Object.fromEntries([
                  ...Object.keys(EQT)
                    .filter(k => x[k] === true)
                    .map(k => [k, true]),
                  // Gabinete elegido en la ficha (PVC o metálico); sin él, el de por defecto
                  ...(x.gab === "pvc" || x.gab === "metal" ? [["gab", x.gab]] : [])
                ])
              ])
          )
        : {};
  // Secciones elegidas en el cuadro de conductores: solo secciones normalizadas (el cálculo verifica que cumplan)
  const sf = o.SECF && typeof o.SECF === "object" ? o.SECF : {},
    oks = v =>
      v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, S]) => SECC.includes(S))) : {};
  const sv = v => (["mono220", "tri220", "tri380"].includes(v) ? v : null);
  return {
    PLANO: planoValido(o.PLANO),
    id: typeof o.id === "string" && /^[\w-]{1,40}$/.test(o.id) ? o.id : null,
    campos,
    listas,
    FIX: { uni: ok(fx.uni), multi: ok(fx.multi) },
    ACEP: { uni: ok(ac.uni), multi: ok(ac.multi) },
    TEQ: { uni: okq(te.uni), multi: okq(te.multi) },
    SECF: { uni: oks(sf.uni), multi: oks(sf.multi) },
    sist: sv(o.sist) || "mono220",
    sistG: sv(o.sistG) || "tri380",
    MODE: o.MODE === "multi" ? "multi" : "uni"
  };
}
/* Plano de arquitectura guardado con el proyecto (js/plano.js), solo con datos válidos: el nombre y la huella del
   archivo DXF (que está en el navegador), metros por unidad del dibujo y de dónde sale, capas ocultas, plantas
   encuadradas (rectángulos en coordenadas del dibujo) y modo atenuado. */
function planoValido(v) {
  if (!v || typeof v !== "object" || typeof v.sha !== "string" || !/^[0-9a-f]{40}$/.test(v.sha)) return null;
  const n = x => typeof x === "number" && Number.isFinite(x),
    txt = (x, m) =>
      String(x ?? "")
        .replace(/[<>]/g, "")
        .slice(0, m);
  return {
    nombre: txt(v.nombre, 120) || "plano.dxf",
    sha: v.sha,
    kb: n(v.kb) ? Math.round(v.kb) : 0,
    f: n(v.f) && v.f > 0 ? v.f : 1,
    de: ["cotas", "cabecera", "tamaño", "manual"].includes(v.de) ? v.de : "manual",
    ocultas: Array.isArray(v.ocultas) ? v.ocultas.filter(x => typeof x === "string").slice(0, 5000) : [],
    plantas: Array.isArray(v.plantas)
      ? v.plantas
          .filter(p => p && ["x0", "y0", "x1", "y1"].every(k => n(p[k])) && p.x1 > p.x0 && p.y1 > p.y0)
          .slice(0, 60)
          .map(p => ({ n: txt(p.n, 60) || "Planta", x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 }))
      : [],
    tenue: v.tenue === true,
    // Objetos de la arquitectura borrados de la vista (su número de objeto en el DXF; el archivo no cambia)
    ...(Array.isArray(v.borr) && v.borr.length
      ? { borr: [...new Set(v.borr.filter(i => Number.isInteger(i) && i >= 0 && i < 1e7))].slice(0, 500000) }
      : {}),
    dis: disValido(v.dis),
    // Versiones guardadas del diseño (para comparar o restaurar)
    ...(Array.isArray(v.vers) && v.vers.length
      ? {
          vers: v.vers
            .filter(x => x && typeof x === "object" && x.dis)
            .slice(-15)
            .map(x => ({
              n: txt(x.n, 60) || "Versión",
              f: typeof x.f === "string" ? x.f.slice(0, 40) : "",
              dis: disValido(x.dis)
            }))
        }
      : {})
  };
}
/* Diseño eléctrico dibujado sobre el plano (js/diseno.js): capas, capa actual, elementos y escala de impresión,
   solo con datos válidos. Los elementos sin datos completos se descartan; los de una capa que no existe la crean. */
function disValido(v) {
  if (!v || typeof v !== "object") return undefined;
  const n = x => typeof x === "number" && Number.isFinite(x),
    txt = (x, m) =>
      String(x ?? "")
        .replace(/[<>]/g, "")
        .slice(0, m),
    color = x => (typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x) ? x.toLowerCase() : "#37474f"),
    capa = c => ({
      n: txt(c.n, 60).trim() || "E-CAPA",
      col: color(c.col),
      lt: ["cont", "trazos", "punto"].includes(c.lt) ? c.lt : "cont",
      vis: c.vis !== false,
      bloq: c.bloq === true,
      ...([0.25, 0.35, 0.5, 0.7, 1].includes(c.gr) ? { gr: c.gr } : {})
    });
  const capas = [];
  (Array.isArray(v.capas) ? v.capas : []).slice(0, 200).forEach(c => {
    if (c && typeof c === "object" && !capas.some(x => x.n === capa(c).n)) capas.push(capa(c));
  });
  // Hasta 200 000 elementos: con los proyectos en la base de datos del navegador cabe un edificio grande (antes,
  // con el almacenamiento pequeño, el tope era 20 000)
  const els = (Array.isArray(v.els) ? v.els : [])
    .slice(0, 200000)
    .map(e => {
      if (!e || typeof e !== "object") return null;
      const b = {
          // Color propio del elemento (si no, el de su capa)
          ...(typeof e.col === "string" && /^#[0-9a-f]{6}$/i.test(e.col) ? { col: e.col.toLowerCase() } : {}),
          id: typeof e.id === "string" && /^d[0-9]{1,7}$/.test(e.id) ? e.id : "",
          capa: txt(e.capa, 60).trim() || "E-DIBUJO"
        },
        cir = e.cir ? { cir: txt(e.cir, 12) } : {};
      if (e.t === "sim" && typeof e.k === "string" && /^[a-zA-Z0-9]{1,12}$/.test(e.k) && n(e.x) && n(e.y))
        return {
          ...b,
          t: "sim",
          k: e.k,
          x: e.x,
          y: e.y,
          r: n(e.r) ? e.r : 0,
          ...(n(e.h) && e.h >= 0 ? { h: e.h } : {}),
          ...(n(e.p) && e.p >= 0 ? { p: e.p } : {}),
          // Letra del tipo corrida (unidades del símbolo)
          ...(Array.isArray(e.dt) && e.dt.length === 2 && e.dt.every(v => n(v) && Math.abs(v) < 200)
            ? { dt: e.dt.slice() }
            : {}),
          ...cir,
          // Letra de encendido (qué interruptor enciende qué luminaria: a, b, c…)
          ...(typeof e.enc === "string" && /^[a-z0-9]{1,3}$/.test(e.enc) ? { enc: e.enc } : {}),
          // Montante: la canalización vertical par en otra planta
          ...(typeof e.mon === "string" && /^d[0-9]{1,7}$/.test(e.mon) ? { mon: e.mon } : {}),
          // Tablero del circuito del artefacto (lo hereda de la tubería que llega a él)
          ...(e.k !== "tab" && typeof e.tab === "string" && /^d[0-9]{1,7}$/.test(e.tab) ? { tab: e.tab } : {}),
          // Tablero: nombre, número de circuitos y descripción de cada uno
          ...(e.k === "tab" && e.nom ? { nom: txt(e.nom, 20) } : {}),
          ...(e.k === "tab" && n(e.nc) && e.nc >= 1 ? { nc: Math.min(60, Math.round(e.nc)) } : {}),
          ...(e.k === "tab" && Array.isArray(e.cd) ? { cd: e.cd.slice(0, 60).map(d => txt(d, 60)) } : {})
        };
      if (e.t === "txt" && n(e.x) && n(e.y) && n(e.ht) && e.ht > 0)
        return { ...b, t: "txt", x: e.x, y: e.y, ht: e.ht, r: n(e.r) ? e.r : 0, s: txt(e.s, 200) || "Texto" };
      // Leyenda automática: esquina superior izquierda y título
      if (e.t === "ley" && n(e.x) && n(e.y))
        return { ...b, t: "ley", x: e.x, y: e.y, tit: txt(e.tit, 60) || "LEYENDA" };
      if (e.t === "cir" && n(e.x) && n(e.y) && n(e.rad) && e.rad > 0)
        return { ...b, t: "cir", x: e.x, y: e.y, rad: e.rad };
      // Cota: dos puntos medidos, desplazamiento de la línea de cota y dirección (alineada, horizontal o vertical)
      if (e.t === "cot" && [e.a, e.b].every(p => Array.isArray(p) && p.length === 2 && p.every(n)) && n(e.o))
        return {
          ...b,
          t: "cot",
          a: e.a.slice(),
          b: e.b.slice(),
          o: e.o,
          modo: ["alin", "h", "v"].includes(e.modo) ? e.modo : "alin"
        };
      // Directriz: punta y quiebre, con su texto
      if (e.t === "dir" && Array.isArray(e.pts) && e.pts.length === 4 && e.pts.every(n) && n(e.ht) && e.ht > 0)
        return { ...b, t: "dir", pts: e.pts.slice(), ht: e.ht, s: txt(e.s, 120) || "Texto" };
      if (
        (e.t === "lin" || e.t === "tub") &&
        Array.isArray(e.pts) &&
        e.pts.length >= 4 &&
        e.pts.length % 2 === 0 &&
        e.pts.length <= 20000 &&
        e.pts.every(n)
      )
        return {
          ...b,
          t: e.t,
          pts: e.pts.slice(),
          c: e.c === true,
          // Curvatura de cada tramo (como en las polilíneas de AutoCAD), entre −1 y 1 (media circunferencia)
          ...(Array.isArray(e.b) && e.b.some(k => n(k) && k)
            ? { b: e.b.slice(0, e.pts.length / 2).map(k => (n(k) ? Math.max(-1, Math.min(1, k)) : 0)) }
            : {}),
          ...(e.t === "tub"
            ? {
                modo: e.modo === "piso" ? "piso" : "techo",
                ...cir,
                ...(typeof e.tab === "string" && /^d[0-9]{1,7}$/.test(e.tab) ? { tab: e.tab } : {}),
                // Artefactos a los que está conectada en su inicio (c0) y en su final (c1)
                ...(typeof e.c0 === "string" && /^d[0-9]{1,7}$/.test(e.c0) ? { c0: e.c0 } : {}),
                ...(typeof e.c1 === "string" && /^d[0-9]{1,7}$/.test(e.c1) ? { c1: e.c1 } : {}),
                // Diámetro nominal de la tubería (mm)
                ...([15, 20, 25, 35, 40, 50, 65, 80].includes(e.dia) ? { dia: e.dia } : {}),
                // Conductores que lleva (marcas de la norma): fases, neutro y tierra
                ...(e.cond && typeof e.cond === "object"
                  ? {
                      cond: {
                        f: Number.isInteger(e.cond.f) ? Math.max(0, Math.min(6, e.cond.f)) : 0,
                        // Neutros: 0 a 2 (antes era sí o no)
                        n: Number.isInteger(e.cond.n) ? Math.max(0, Math.min(2, e.cond.n)) : e.cond.n === true ? 1 : 0,
                        t: e.cond.t === true
                      }
                    }
                  : {})
              }
            : {})
        };
      return null;
    })
    .filter(Boolean);
  // Identificadores únicos; capas para todos los elementos
  const ids = new Set();
  let k = els.reduce((m, e) => Math.max(m, parseInt(e.id.slice(1), 10) || 0), 0);
  els.forEach(e => {
    if (!e.id || ids.has(e.id)) e.id = "d" + ++k;
    ids.add(e.id);
    if (!capas.some(c => c.n === e.capa)) capas.push(capa({ n: e.capa }));
  });
  const actual = capas.some(c => c.n === v.actual) ? v.actual : "E-DIBUJO";
  return {
    capas,
    actual,
    els,
    escala: [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500].includes(v.escala) ? v.escala : 50,
    etq: ["no", "total", "tramo"].includes(v.etq) ? v.etq : "total",
    // Circuito y diámetro escritos sobre cada tubería
    ...(v.cirt === true ? { cirt: true } : {}),
    // Circuito escrito junto a cada salida
    ...(v.nsal === true ? { nsal: true } : {}),
    // Láminas: papel, escala, zona (planta, todo, la pantalla o un rectángulo), capas, colores, leyenda, título,
    // número y notas (la v3.0.0-b10 guardaba una sola, en lam)
    ...(() => {
      const L = (Array.isArray(v.lams) ? v.lams : v.lam && typeof v.lam === "object" ? [v.lam] : [])
        .filter(l => l && typeof l === "object")
        .slice(0, 40)
        .map(l => ({
          tam: ["A4", "A3", "A2", "A1"].includes(l.tam) ? l.tam : "A3",
          ...([10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500].includes(l.esc) ? { esc: l.esc } : {}),
          zona: typeof l.zona === "string" && /^(|todo|vista|rect|planta:\d{1,3})$/.test(l.zona) ? l.zona : "",
          ...(Array.isArray(l.rect) && l.rect.length === 4 && l.rect.every(n) ? { rect: l.rect.slice() } : {}),
          ...(Array.isArray(l.ocl)
            ? {
                ocl: l.ocl
                  .filter(x => typeof x === "string")
                  .slice(0, 200)
                  .map(x => txt(x, 60))
              }
            : {}),
          arq: ["gris", "negro", "color"].includes(l.arq) ? l.arq : "gris",
          color: l.color === "bn" ? "bn" : "color",
          ley: l.ley !== false,
          tit: txt(l.tit, 120),
          num: txt(l.num, 20),
          notas: txt(l.notas, 2000)
        }));
      return L.length
        ? { lams: L, lamI: Number.isInteger(v.lamI) && v.lamI >= 0 && v.lamI < L.length ? v.lamI : 0 }
        : {};
    })(),
    // Símbolos con criterio del proyectista: relleno, tamaño, letra y grosor por tipo
    ...(v.simb && typeof v.simb === "object"
      ? {
          simb: Object.fromEntries(
            Object.entries(v.simb)
              .filter(([k, o]) => /^[a-zA-Z0-9]{1,12}$/.test(k) && o && typeof o === "object")
              .slice(0, 200)
              .map(([k, o]) => [
                k,
                {
                  ...(["solido", "achurado", "mitad", "ninguno"].includes(o.rel) ? { rel: o.rel } : {}),
                  ...(n(o.tam) && o.tam >= 0.5 && o.tam <= 2 && o.tam !== 1 ? { tam: o.tam } : {}),
                  ...(typeof o.let === "string" ? { let: txt(o.let, 4) } : {}),
                  ...(o.gr === 1.6 ? { gr: 1.6 } : {})
                }
              ])
              .filter(([, o]) => Object.keys(o).length)
          )
        }
      : {}),
    // Criterios de la revisión del diseño (editables)
    ...(v.crit && typeof v.crit === "object"
      ? {
          crit: {
            sal: Number.isInteger(v.crit.sal) ? Math.max(1, Math.min(100, v.crit.sal)) : 12,
            cur: Number.isFinite(v.crit.cur) ? Math.max(90, Math.min(720, v.crit.cur)) : 360
          }
        }
      : {})
  };
}
/* Proyecto listo para calcular(), con el mismo formato que estado(), a partir de un proyecto guardado o de un
   caso de prueba (lo usan las pruebas sin navegador, herramientas/pruebas.js). Los datos que falten toman el
   valor por defecto. */
// eslint-disable-next-line no-unused-vars -- la usa herramientas/pruebas.js (pruebas sin navegador)
function proyectoDe(o) {
  const n = normalizar(o),
    p = { MODE: n.MODE, sist: n.sist, sistG: n.sistG, FIX: n.FIX, ACEP: n.ACEP, TEQ: n.TEQ, SECF: n.SECF };
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
let DELQ = null;
function renderProy() {
  const L = libLoad(),
    arr = Object.values(L)
      .filter(o => o && o.id)
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const f = d => {
    const x = new Date(d);
    return isNaN(x)
      ? "—"
      : x.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) +
          " · " +
          x.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  };
  if (!arr.length) {
    $("projList").innerHTML =
      `<div class="body"><p class="hint" style="font-size:13px">Aún no hay proyectos guardados. Cree uno nuevo o escriba un nombre en «Datos del proyecto»: se guardará automáticamente.</p></div>`;
    return;
  }
  $("projList").innerHTML =
    `<table><thead><tr><th class="t">Proyecto</th><th class="t">Tipo</th><th class="t">Proyectista</th><th class="t">Modificado</th><th class="t">Acciones</th></tr></thead><tbody>${arr
      .map(
        o => `<tr${o.id === PID ? ' class="fix"' : ""}>
    <td class="t" style="white-space:normal"><strong>${esc(o.p_nombre)}</strong>${o.id === PID ? ' <span class="pill ok">En edición</span>' : ""}<br><span class="hint">${esc(o.p_ubic || "")}</span></td>
    <td class="t">${o.MODE === "multi" ? "Multifamiliar" : USOS[o.uso] ? esc(USOS[o.uso].n) : "Unifamiliar"}</td><td class="t">${esc(o.p_proy || "—")}</td><td class="t">${f(o.savedAt)}</td>
    <td class="t"><div class="acts-row">${
      DELQ === o.id
        ? `<span class="hint">¿Eliminar?</span><button type="button" class="btn sm" data-pa="del-ok" data-id="${o.id}">Sí, eliminar</button><button type="button" class="btn sec sm" data-pa="del-no">Cancelar</button>`
        : `<button type="button" class="btn sm" data-pa="open" data-id="${o.id}">Abrir</button><button type="button" class="btn sec sm" data-pa="dup" data-id="${o.id}">Duplicar</button><button type="button" class="btn sec sm" data-pa="exp" data-id="${o.id}">Exportar</button><button type="button" class="btn sec sm" data-pa="del" data-id="${o.id}">Eliminar</button>`
    }</div></td></tr>`
      )
      .join("")}</tbody></table><p class="hint al-uso" id="alUso"></p>`;
  alUso();
}
$("projList").addEventListener("click", async e => {
  const b = e.target.closest("[data-pa]");
  if (!b) return;
  const L = libLoad(),
    o = L[b.dataset.id],
    a = b.dataset.pa;
  if (a === "open" && o) {
    aplicar(o);
    setTab("calculo");
    msg.textContent = `Proyecto «${o.p_nombre}» abierto.`;
    return;
  }
  if (a === "dup" && o) {
    const id = nuevoId();
    L[id] = {
      ...JSON.parse(JSON.stringify(o)),
      id,
      p_nombre: `${o.p_nombre} (copia)`,
      savedAt: new Date().toISOString()
    };
    libSave(L);
  }
  if (a === "exp" && o) {
    const nm =
        o.p_nombre
          .replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]/g, "")
          .trim()
          .slice(0, 60) || "proyecto",
      blob = new Blob([JSON.stringify(await proyectoConPlano(o), null, 1)], { type: "application/json" });
    try {
      if (downloads) await downloads.save({ filename: `JMG-ELECTRIC - ${nm}.json`, data: blob });
      else descargarLocal(blob, `JMG-ELECTRIC - ${nm}.json`);
    } catch (err) {}
  }
  if (a === "del") DELQ = b.dataset.id;
  if (a === "del-no") DELQ = null;
  if (a === "del-ok") {
    delete L[b.dataset.id];
    libSave(L);
    if (b.dataset.id === PID) PID = null;
    DELQ = null;
  }
  renderProy();
});
