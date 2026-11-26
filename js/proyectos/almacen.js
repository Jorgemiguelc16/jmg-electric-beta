/* PROYECTOS · ALMACÉN Y GUARDADO
   Dónde y cómo se guardan los proyectos en el navegador: la base de datos (IndexedDB) con su copia en el
   almacenamiento pequeño, la biblioteca (LIB), las versiones anteriores, el proyecto abierto (saveDraft, guardado
   automático), el botón Guardar (guardarAhora), el aviso de otra pestaña con el mismo proyecto, el aviso al cerrar
   y el respaldo con el plano DXF. */
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
// Claves (sin leer los valores) de los registros cuya clave empieza con el prefijo
async function alClaves(pre) {
  const db = await alDb();
  return new Promise((ok, mal) => {
    const out = [],
      r = db
        .transaction("p")
        .objectStore("p")
        .openKeyCursor(IDBKeyRange.bound(pre, pre + "￿"));
    r.onsuccess = () => {
      const c = r.result;
      if (!c) return ok(out);
      out.push(c.key);
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
  // Y su copia en la nube (js/cuenta/nube.js), con la cuenta aprobada
  if (typeof nubeProgramar === "function") nubeProgramar();
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
/* Versiones anteriores de cada proyecto (en la misma base): una copia cada AL_V_PASO como máximo mientras se trabaja,
   las AL_V_MAX más recientes. Si algo pisa el trabajo (un archivo .json antiguo, otra pestaña, otro equipo), la versión
   se recupera desde Proyectos › Versiones. Claves «…#v/id/fecha», fuera del rango de la biblioteca («…/id»). */
const AL_VPRE = LKEY + "#v/",
  AL_V_MAX = 20,
  AL_V_PASO = 10 * 60 * 1000,
  AL_VULT = new Map();
async function alVersion(o, forzar = false) {
  if (!AL_HAY || !o || !o.id || o._idb || !o.savedAt) return;
  const pre = AL_VPRE + o.id + "/";
  if (!AL_VULT.has(o.id)) {
    const ks = await alClaves(pre);
    AL_VULT.set(o.id, ks.length ? Date.parse(ks[ks.length - 1].slice(pre.length)) || 0 : 0);
  }
  const t = Date.parse(o.savedAt) || Date.now();
  if (!forzar && t - AL_VULT.get(o.id) < AL_V_PASO) return;
  await alPut(pre + o.savedAt, o);
  AL_VULT.set(o.id, t);
  const ks = await alClaves(pre);
  for (const k of ks.slice(0, Math.max(0, ks.length - AL_V_MAX))) await alPut(k);
}
// Versiones guardadas de un proyecto, de la más reciente a la más antigua: [{ k, f }]
async function alVersiones(id) {
  if (!AL_HAY) return [];
  const pre = AL_VPRE + id + "/";
  return (await alClaves(pre)).map(k => ({ k, f: k.slice(pre.length) })).reverse();
}
async function alEscribir() {
  if (!AL_LISTO) return alProgramar();
  try {
    for (const o of Object.values(LIB))
      if (o && o.id && !o._idb && AL_ESCRITO.get(o.id) !== o.savedAt) {
        await alPut(LKEY + "/" + o.id, o);
        AL_ESCRITO.set(o.id, o.savedAt);
        await alVersion(o);
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
  AL_PEND = true;
  AL_BT = setTimeout(
    () =>
      alPut(SKEY, AL_BORR)
        .then(() => (AL_PEND = false))
        .catch(e =>
          toast(
            "No se pudo guardar el proyecto en el navegador: " +
              (e && e.message ? e.message : e) +
              ". Descargue una copia .json ahora."
          )
        ),
    250
  );
}
let AL_PEND = false;
/* Al cerrar o recargar la pestaña con algo por guardar (el diseño del editor en su medio segundo de espera, o la
   escritura a la base aún en curso): se guarda en el momento y el navegador pregunta antes de cerrar */
addEventListener("beforeunload", e => {
  const ed = typeof ED !== "undefined" && ED.tAuto;
  if (ed && typeof edGuardarYa === "function") edGuardarYa();
  if (
    ed ||
    AL_PEND ||
    (typeof AL_T !== "undefined" &&
      AL_T &&
      LIB &&
      Object.values(LIB).some(o => o && o.id && !o._idb && AL_ESCRITO.get(o.id) !== o.savedAt))
  ) {
    if (AL_HAY && AL_BORR) alPut(SKEY, AL_BORR).catch(() => {});
    if (AL_HAY) alEscribir();
    e.preventDefault();
    e.returnValue = "";
  }
});
/* El mismo proyecto abierto en dos pestañas: cada una tiene su copia en memoria, y la que quedó atrás, al guardar,
   pisaría el trabajo de la otra. Cada guardado se anuncia a las demás pestañas (BroadcastChannel); la que tiene el
   mismo proyecto deja de guardar y pide recargarse, para seguir con lo último. */
const PESTANA = Math.random().toString(36).slice(2),
  AL_CANAL =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel((BETA ? "jmg-electric-beta" : "jmg-electric") + "-pestanas")
      : null;
let PESTANA_VIEJA = false,
  PESTANA_AV = 0;
function avisoPestana() {
  if (Date.now() - PESTANA_AV < 20000) return;
  PESTANA_AV = Date.now();
  confirmar(
    "Este proyecto se guardó en otra pestaña",
    `<p>«${esc($("p_nombre").value.trim() || "Proyecto")}» está abierto también en otra pestaña o ventana, y allí se guardaron cambios más recientes.</p><p>Para no pisar ese trabajo, <b>esta pestaña ya no guarda</b>. Recárguela para seguir con lo último (o siga trabajando en la otra).</p>`,
    "Recargar esta pestaña",
    ok => {
      if (ok) location.reload();
    },
    "Proteger su trabajo"
  );
}
if (AL_CANAL)
  AL_CANAL.onmessage = e => {
    const m = e.data || {};
    if (m.t === "guardado" && m.id && m.id === PID && m.tab !== PESTANA && !PESTANA_VIEJA) {
      PESTANA_VIEJA = true;
      avisoPestana();
      guardadoEstado();
      if (typeof edEstado === "function" && typeof ED !== "undefined" && ED.abierto) edEstado();
    }
  };
/* Último guardado del proyecto (hora) para el estado de la barra: «Guardado a las 10:42» */
let GUARDADO_T = 0;
const hhmm = t => new Date(t).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
// Texto del estado del guardado (barra de título y barra de estado)
function guardadoTxt() {
  const n = $("p_nombre").value.trim();
  if (PESTANA_VIEJA) return "⚠ No guarda: abierto en otra pestaña";
  if (!n) return "Sin nombre · no se guarda";
  if (/^EJEMPLO\b/.test(n)) return "Ejemplo · no se guarda";
  return GUARDADO_T ? `Guardado a las ${hhmm(GUARDADO_T)}` : "Se guarda solo";
}
function guardadoEstado() {
  const el = $("gdEstado");
  if (el) {
    el.textContent = guardadoTxt();
    el.classList.toggle("mal", PESTANA_VIEJA);
  }
}
/* Guardar (botón de la barra y Ctrl+S): el guardado es automático, y además este botón guarda en el momento y deja
   una versión con fecha (Proyectos › Versiones), un punto al que se puede volver */
async function guardarAhora() {
  const n = $("p_nombre").value.trim();
  if (!n || /^EJEMPLO\b/.test(n)) {
    guardadoEstado();
    return toast(
      n ? "Los ejemplos no se guardan: póngale otro nombre al proyecto" : "Asigne un nombre al proyecto para guardarlo"
    );
  }
  if (PESTANA_VIEJA) return avisoPestana();
  saveDraft();
  try {
    await alEscribir();
    const o = libLoad()[PID];
    if (o) await alVersion(o, true);
    toast(`Proyecto guardado a las ${hhmm(GUARDADO_T || Date.now())} · versión creada (Proyectos › Versiones)`);
  } catch (e) {
    toast("No se pudo guardar en el navegador: " + (e && e.message ? e.message : e) + ". Descargue una copia .json.");
  }
  if (typeof hdrEstado === "function") hdrEstado();
}
function saveDraft() {
  if (PESTANA_VIEJA) return avisoPestana();
  if (esEjemplo()) {
    PID = null;
    const s = JSON.stringify(estado());
    guardarBorrador(s, JSON.parse(s));
    return guardadoEstado();
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
    if (AL_CANAL) AL_CANAL.postMessage({ t: "guardado", id: PID, tab: PESTANA });
    GUARDADO_T = Date.now();
  }
  guardadoEstado();
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
    el.innerHTML = `Espacio usado en este navegador: <b>${mb(e.usage || 0)} MB</b> de unos ${mb(e.quota || 0)} MB disponibles${p ? " · protegido: el navegador no lo borra por falta de espacio" : ""}. ${
      typeof NUBE !== "undefined" && NUBE.uid
        ? " Sus proyectos, con sus planos DXF, se guardan también en su cuenta (nube): los encuentra al ingresar desde otra computadora."
        : " Para no perder su trabajo, descargue un respaldo de vez en cuando (recuadro «Respaldo»): lleva también los planos DXF."
    }`;
  } catch (e) {}
}
// Borra el proyecto abierto (Restablecer valores iniciales)
async function alBorrarBorrador() {
  try {
    localStorage.removeItem(SKEY);
  } catch (e) {}
  if (AL_HAY) await alPut(SKEY).catch(() => {});
}
