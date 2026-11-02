/* EDITOR DE DISEÑO · PLANO DE ARQUITECTURA (etapa 1 del diseño en planta)
   El editor ocupa toda la pantalla (se abre desde la pestaña Diseño de la cinta) y trabaja sobre una copia del plano
   del proyecto: los cambios pasan al proyecto con Aplicar o Aceptar, como en las fichas, y Cancelar los descarta.
   Tiene su propio deshacer (Ctrl+Z / Ctrl+Y) mientras está abierto.
   - Plano de arquitectura en DXF (js/dxf.js): zoom con la rueda del mouse (centrado en el cursor), desplazamiento
     arrastrando, capas que se muestran u ocultan, plano atenuado, escala comprobada con una medida conocida y
     plantas encuadradas por el usuario.
   - La arquitectura es una referencia bloqueada (como una referencia externa de AutoCAD): no se mueve; un clic en
     una línea muestra sus propiedades (tipo, capa, longitud, área). Lo que se mueva será el diseño eléctrico.
   - Medición: distancia, recorrido y longitud de objetos, con enganche a extremos, puntos medios, centros e
     inserciones de bloques (F3) y modo orto (F8).
   - El archivo se lee en la computadora del usuario y no se sube a internet. Se guarda en la base de datos del
     navegador (IndexedDB), con su huella SHA-1 como nombre; el proyecto guarda solo PLANO: el nombre y la huella
     del archivo, la unidad, las capas ocultas, las plantas y el modo atenuado.
   - Se dibuja en dos lienzos: el plano (se redibuja al mover o cambiar la vista) y encima lo que sigue al cursor
     (enganche, selección, mediciones, encuadres). Las coordenadas se guardan respecto del centro del dibujo para no
     perder precisión en planos georreferenciados. */
// Objetos de la arquitectura borrados (ocultos) y elegidos, por su número de objeto en el DXF
const PL_BORR = new Set(),
  PL_ASEL = new Set();
let PL_MOD = null,
  PL_SHA = null,
  PL_GR = null,
  PL_TX = null,
  PL_IDX = null,
  // Copia de trabajo del plano en el editor (PLANO es el del proyecto)
  EPL = null;
// Editor: abierto, historial de deshacer de la copia y el plano tal como está en el proyecto (para saber si hay
// cambios sin aplicar)
const ED = { abierto: false, hist: [], redo: [], base: "null" };
// Vista: punto del dibujo en el centro del lienzo y escala en píxeles del lienzo por unidad del dibujo
const PLV = { cx: 0, cy: 0, s: 1 };
// Herramienta activa y sus puntos; el cursor (en el dibujo), el punto enganchado y el objeto seleccionado
const PLH = {
  h: null,
  pts: [],
  sel: [],
  cur: null,
  eng: null,
  med: null,
  pan: null,
  obj: -1,
  sobre: -1,
  // Diseño: elemento bajo el cursor, arrastre para mover, marco de selección, giro del símbolo a colocar,
  // encaje en el muro, pinzamiento que se arrastra o bajo el cursor, curvatura de los tramos de la tubería en curso
  // y lado de su curva, y Mayús presionada (sin enganche)
  dsSobre: null,
  arr: null,
  marco: null,
  rot: 0,
  alin: null,
  agarre: null,
  agSobre: null,
  bul: [],
  lado: 1,
  libre: false,
  // Salida del tablero donde empezó la tubería en curso (su circuito)
  cirIni: null,
  // Artefacto donde empieza la tubería en curso
  conIni: null,
  // Guía del rastreo polar
  polar: null
};
const plBase = $("plBase"),
  plSobre = $("plSobre"),
  plLienzo = $("plLienzo");
const PL_NOMH = {
  dist: "Distancia",
  rec: "Recorrido",
  obj: "Longitud de objetos",
  escala: "Comprobar escala",
  planta: "Encuadrar planta"
};

/* ---------- Archivo: base de datos del navegador y huella ---------- */
function plDb() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open("jmg-electric", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("planos");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function plGuardarArchivo(sha, o) {
  const db = await plDb();
  await new Promise((ok, mal) => {
    const t = db.transaction("planos", "readwrite");
    t.objectStore("planos").put(o, sha);
    t.oncomplete = ok;
    t.onerror = () => mal(t.error);
  });
}
async function plLeerArchivo(sha) {
  const db = await plDb();
  return new Promise((ok, mal) => {
    const r = db.transaction("planos").objectStore("planos").get(sha);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
// Borra del navegador los planos que ya no usa nadie: ni el proyecto, ni la copia del editor, ni los proyectos
// guardados, ni los historiales de deshacer
async function plLimpiarArchivos() {
  try {
    const usados = new Set([PLANO && PLANO.sha, EPL && EPL.sha].filter(Boolean));
    Object.values(libLoad()).forEach(o => {
      if (o && o.PLANO) usados.add(o.PLANO.sha);
      if (o && o.psha) usados.add(o.psha);
    });
    // Sin la base de proyectos leída no se borra nada (podría faltar algún proyecto)
    if (typeof AL_LISTO !== "undefined" && AL_HAY && !AL_LISTO) return;
    const enHist = k => [HIST, REDO, ED.hist, ED.redo].some(h => h.some(s => s.includes(k)));
    const db = await plDb(),
      claves = await new Promise((ok, mal) => {
        const r = db.transaction("planos").objectStore("planos").getAllKeys();
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      }),
      sobran = claves.filter(k => !usados.has(k) && !enHist(k));
    if (!sobran.length) return;
    const t = db.transaction("planos", "readwrite");
    sobran.forEach(k => t.objectStore("planos").delete(k));
  } catch (e) {}
}
const plHuella = async buf =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-1", buf))].map(b => b.toString(16).padStart(2, "0")).join("");

// Abre un archivo elegido por el usuario: lo lee, lo guarda en el navegador y lo asocia a la copia del editor
async function plAbrir(file) {
  if (!file) return;
  if (/\.dwg$/i.test(file.name))
    return toast("Los archivos DWG no se pueden leer: en AutoCAD use Guardar como › DXF y abra ese archivo");
  if (!/\.dxf$/i.test(file.name)) return toast("Elija un archivo DXF (.dxf)");
  plCargando(true);
  try {
    const buf = await file.arrayBuffer(),
      sha = await plHuella(buf);
    await new Promise(r => setTimeout(r, 30));
    const m = modeloDxf(buf);
    try {
      await plGuardarArchivo(sha, { nombre: file.name, buf, fecha: new Date().toISOString() });
    } catch (e) {
      toast("El navegador no permitió guardar el plano: tendrá que abrirlo de nuevo la próxima vez");
    }
    PL_MOD = m;
    PL_SHA = sha;
    const nombre = file.name.replace(/[<>]/g, "").slice(0, 120),
      // El mismo archivo (o una versión nueva con el mismo nombre) conserva la escala, las capas y las plantas
      sigue = EPL && (EPL.sha === sha || EPL.nombre === nombre);
    EPL = {
      nombre,
      sha,
      kb: Math.round(buf.byteLength / 1024),
      f: sigue ? EPL.f : m.unidad.f,
      de: sigue ? EPL.de : m.unidad.de,
      ocultas: sigue
        ? EPL.ocultas
        : Object.entries(m.capas)
            .filter(([, c]) => !c.on)
            .map(([n]) => n),
      plantas: sigue ? EPL.plantas : [],
      tenue: sigue ? EPL.tenue : false,
      ...(sigue && EPL.sha === sha && EPL.borr ? { borr: EPL.borr } : {}),
      // El diseño eléctrico se conserva aunque cambie el archivo de arquitectura
      dis: EPL && EPL.dis ? EPL.dis : dsNuevo()
    };
    PLH.obj = -1;
    PL_ASEL.clear();
    plPreparar();
    if (!(sigue && plVistaGuardada())) plAjustar();
    edCambio();
    toast(
      sigue
        ? "Plano abierto: se conservan la escala, las capas ocultas y las plantas del proyecto"
        : `Plano abierto: ${Object.keys(m.capas).length} capas · unidad: ${m.unidad.nom} (${PL_DE[m.unidad.de]})`
    );
  } catch (e) {
    toast("No se pudo leer el plano: " + e.message);
  } finally {
    plCargando(false);
  }
}
const PL_DE = {
  cotas: "según las cotas",
  cabecera: "según el archivo",
  tamaño: "según el tamaño del dibujo",
  manual: "comprobada por el usuario"
};
function plCargando(on) {
  $("plCarga").hidden = !on;
}
// Lee del navegador el archivo de la copia del editor, si aún no está leído
async function plCargarGuardado() {
  if (!EPL || (PL_MOD && PL_SHA === EPL.sha)) return;
  const sha = (PL_SHA = EPL.sha);
  PL_MOD = null;
  plPreparar();
  plMostrar();
  plCargando(true);
  try {
    const o = await plLeerArchivo(sha);
    if (o && o.buf && EPL && EPL.sha === sha) {
      await new Promise(r => setTimeout(r, 30));
      PL_MOD = modeloDxf(o.buf);
      plPreparar();
      if (!plVistaGuardada()) plAjustar();
    }
  } catch (e) {
    toast("No se pudo leer el plano guardado: " + e.message);
  } finally {
    plCargando(false);
    plMostrar();
  }
}

/* ---------- Editor: abrir, cambios, deshacer, aplicar, aceptar y cancelar ---------- */
const edSnap = () => JSON.stringify(EPL);
function edAbrir(conArchivo) {
  ED.abierto = true;
  // Inicio de esta sesión del editor: solo se ofrece recuperar lo guardado antes
  ED.t0 = Date.now();
  EPL = PLANO ? clon(PLANO) : null;
  dsAsegurar();
  DS_SEL.clear();
  DS_N = 0;
  ED.base = edSnap();
  ED.hist = [ED.base];
  ED.redo = [];
  $("editor").hidden = false;
  document.body.classList.add("ed-on");
  $("edNom").textContent = $("p_nombre").value.trim() || "Proyecto sin nombre";
  dsFondo();
  edCinta();
  plNavPoner();
  PLH.obj = -1;
  plHerr(null);
  if (!EPL) {
    PL_MOD = PL_SHA = null;
    plPreparar();
  } else if (PL_SHA !== EPL.sha || !PL_MOD) plCargarGuardado();
  else plPreparar();
  edEstado();
  plMostrar();
  requestAnimationFrame(() => {
    plTam();
    if (PL_MOD && !plVistaGuardada()) plAjustar();
    plDibujar();
  });
  // El cuadro para elegir el archivo necesita el clic del usuario: se abre en el mismo clic
  if (conArchivo) $("plArchivo").click();
  else setTimeout(edRecuperar, 400);
}
function edCerrar() {
  ED.abierto = false;
  plHerr(null);
  $("editor").hidden = true;
  document.body.classList.remove("ed-on");
  edInfo();
}
// Un cambio en la copia del editor: entra a su historial de deshacer
function edCambio() {
  dsIdxSucio();
  if (EPL && EPL.dis) {
    dsReconectar();
    dsPropagarCircuitos();
  }
  const s = edSnap();
  if (ED.hist[ED.hist.length - 1] !== s) {
    ED.hist.push(s);
    if (ED.hist.length > 80) ED.hist.shift();
    // Tope de memoria del deshacer: con proyectos grandes se guardan menos pasos (al menos 10), unos 80 MB en total
    let tot = ED.hist.reduce((a, h) => a + h.length, 0);
    while (ED.hist.length > 10 && tot > 4e7) tot -= ED.hist.shift().length;
    ED.redo = [];
  }
  edEstado();
  plMostrar();
  elRender();
  edAutoguardar();
}
function edHist(dir) {
  if (dir < 0 && ED.hist.length < 2) return;
  if (dir > 0 && !ED.redo.length) return;
  if (dir < 0) ED.redo.push(ED.hist.pop());
  else ED.hist.push(ED.redo.pop());
  EPL = JSON.parse(ED.hist[ED.hist.length - 1]);
  dsAsegurar();
  DS_N = 0;
  [...DS_SEL].forEach(id => {
    if (!dsD() || !dsD().els.some(el => el.id === id)) DS_SEL.delete(id);
  });
  plHerr(null);
  PLH.obj = -1;
  PL_COL.clear();
  if (EPL && (PL_SHA !== EPL.sha || !PL_MOD)) plCargarGuardado();
  else {
    if (!EPL) PL_MOD = PL_SHA = null;
    plPreparar();
  }
  edEstado();
  plMostrar();
  toast(dir < 0 ? "Cambio deshecho en el editor" : "Cambio rehecho en el editor");
}
// Botones del editor: deshacer y rehacer, y Aplicar solo con cambios sin aplicar
function edEstado() {
  const sucio = edSnap() !== ED.base;
  $("edUndo").disabled = ED.hist.length < 2;
  $("edRedo").disabled = !ED.redo.length;
  $("edAplicar").disabled = !sucio;
  $("edSucio").hidden = !sucio;
}
// Pasa la copia del editor al proyecto (se guarda y entra al historial de deshacer del proyecto)
function edAplicar() {
  if (edSnap() === ED.base) return;
  PLANO = EPL ? clon(EPL) : null;
  ED.base = edSnap();
  saveDraft();
  histPush();
  plLimpiarArchivos();
  edEstado();
  edInfo();
  edAutoguardar(true);
  toast("Cambios del diseño aplicados al proyecto");
}
function edCancelar() {
  if (edSnap() === ED.base) return edCerrar();
  confirmar(
    "¿Cerrar sin aplicar los cambios?",
    "<p>Los cambios del editor que no aplicó (plano, escala, capas o plantas) se pierden. El proyecto queda como estaba la última vez que pulsó <b>Aplicar</b>.</p>",
    "Cerrar sin aplicar",
    ok => {
      if (!ok) return;
      try {
        localStorage.removeItem(ED_REC);
      } catch (e) {}
      edCerrar();
    }
  );
}
// El proyecto cambió (abrir un proyecto, deshacer en el espacio de trabajo): se actualiza la pestaña Diseño
function planoAplicado() {
  if (!ED.abierto) edInfo();
}
// Pestaña Diseño del espacio de trabajo: el plano del proyecto, en dos líneas
function edInfo() {
  const P = PLANO,
    n = P ? P.plantas.length : 0;
  const ne = P && P.dis ? P.dis.els.length : 0;
  $("plInfo").innerHTML = P
    ? `<b title="${esc(P.nombre)}">${esc(P.nombre)}</b><span>${n ? `${n} planta${n > 1 ? "s" : ""}` : "Sin plantas encuadradas"} · ${ne ? `${ne} elemento${ne > 1 ? "s" : ""} del diseño` : plNomUnidad(P.f)}</span>`
    : `<b>Sin plano de arquitectura</b><span>Ábralo en el editor de diseño</span>`;
}
const plNomUnidad = f =>
  f === 1 ? "metros" : f === 0.01 ? "centímetros" : f === 0.001 ? "milímetros" : `1 u = ${fmt(f, f < 0.01 ? 4 : 3)} m`;

/* ---------- Preparación del dibujo: trazos agrupados por estilo, textos e índice de enganche ---------- */
function plPreparar() {
  PL_GR = PL_TX = PL_IDX = null;
  PLH.sobre = -1;
  if (!PL_MOD || !EPL) return;
  const m = PL_MOD,
    ocultas = new Set(EPL.ocultas),
    O = plOrigen(),
    grupos = new Map();
  PL_BORR.clear();
  (EPL.borr || []).forEach(n => PL_BORR.add(n));
  [...PL_ASEL].forEach(n => PL_BORR.has(n) && PL_ASEL.delete(n));
  for (let i = 0; i < m.trazos.length; i++) {
    const t = m.trazos[i];
    if (ocultas.has(t.capa) || PL_BORR.has(t.e)) continue;
    const k = `${t.col}|${t.lt}|${t.k}|${t.lte}`;
    let g = grupos.get(k);
    if (!g) grupos.set(k, (g = { col: t.col, lt: t.lt, lte: t.lte, k: t.k, path: new Path2D() }));
    const p = t.p;
    g.path.moveTo(p[0] - O[0], p[1] - O[1]);
    for (let j = 2; j < p.length; j += 2) g.path.lineTo(p[j] - O[0], p[j + 1] - O[1]);
    if (t.c) g.path.closePath();
  }
  // Primero los rellenos y las tramas, después las líneas
  PL_GR = [...grupos.values()].sort((a, b) => (a.k === "l") - (b.k === "l"));
  PL_TX = m.textos.filter(t => !ocultas.has(t.capa) && !PL_BORR.has(t.e));
  if (!m.idx) m.idx = plIndice(m);
  PL_IDX = m.idx;
  if (PLH.obj >= 0 && (ocultas.has(m.trazos[PLH.obj].capa) || PL_BORR.has(m.trazos[PLH.obj].e))) PLH.obj = -1;
}
// Marco de selección sobre la arquitectura: los objetos visibles que quedan dentro (o que toca, en captura)
function plMarcoArq(xa, ya, xb, yb, captura, suma) {
  if (!PL_MOD) return;
  if (!suma) PL_ASEL.clear();
  if (EPL.tenue) return;
  const oc = new Set(EPL.ocultas),
    caja = new Map(),
    toca = new Set();
  PL_MOD.trazos.forEach(t => {
    if (oc.has(t.capa) || PL_BORR.has(t.e)) return;
    const p = t.p;
    let b = caja.get(t.e);
    if (!b) caja.set(t.e, (b = [Infinity, Infinity, -Infinity, -Infinity]));
    for (let j = 0; j < p.length; j += 2) {
      b[0] = Math.min(b[0], p[j]);
      b[2] = Math.max(b[2], p[j]);
      b[1] = Math.min(b[1], p[j + 1]);
      b[3] = Math.max(b[3], p[j + 1]);
    }
    // En captura basta con que uno de sus tramos toque el marco
    if (captura && !toca.has(t.e)) {
      const n = t.c ? p.length : p.length - 2;
      for (let j = 0; j < n; j += 2)
        if (plTramoEnCaja(p[j], p[j + 1], p[(j + 2) % p.length], p[(j + 3) % p.length], xa, ya, xb, yb)) {
          toca.add(t.e);
          break;
        }
    }
  });
  caja.forEach((b, n) => {
    if (toca.has(n) || (b[0] >= xa && b[2] <= xb && b[1] >= ya && b[3] <= yb)) PL_ASEL.add(n);
  });
}
// ¿El tramo A→B toca el rectángulo? (recorte de Liang-Barsky)
function plTramoEnCaja(ax, ay, bx, by, xa, ya, xb, yb) {
  const dx = bx - ax,
    dy = by - ay;
  let t0 = 0,
    t1 = 1;
  for (const [p, q] of [
    [-dx, ax - xa],
    [dx, xb - ax],
    [-dy, ay - ya],
    [dy, yb - ay]
  ]) {
    if (!p) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}
// Trazos de un objeto de la arquitectura (un bloque insertado tiene varios)
function plTrazosDe(n) {
  const m = PL_MOD;
  if (!m.porE) {
    m.porE = new Map();
    m.trazos.forEach((t, i) => (m.porE.get(t.e) || m.porE.set(t.e, []).get(t.e)).push(i));
  }
  return m.porE.get(n) || [];
}
const plOrigen = () => {
  const e = PL_MOD.ext;
  return [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2];
};
// Índice en cuadrícula de los puntos de enganche y de los trazos (para encontrar lo que está bajo el cursor)
function plIndice(m) {
  const e = m.ext,
    tam = Math.max(e[2] - e[0], e[3] - e[1]) / 300 || 1,
    pts = new Map(),
    trz = new Map();
  const clave = (x, y) => Math.floor((x - e[0]) / tam) + "," + Math.floor((y - e[1]) / tam);
  for (let i = 0; i < m.snap.length; i += 3) {
    const k = clave(m.snap[i], m.snap[i + 1]);
    (pts.get(k) || pts.set(k, []).get(k)).push(i);
  }
  // Cada trazo se anota en las celdas por donde pasa: se recorre cada tramo a pasos de media celda (así un muro
  // largo o una diagonal ocupan solo las celdas de su recorrido, no todo el rectángulo que los contiene)
  m.trazos.forEach((t, i) => {
    if (t.k !== "l") return;
    const p = t.p,
      celdas = new Set(),
      n = t.c ? p.length : p.length - 2;
    for (let j = 0; j < n; j += 2) {
      const ax = p[j],
        ay = p[j + 1],
        bx = p[(j + 2) % p.length],
        by = p[(j + 3) % p.length],
        pasos = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (tam / 2)));
      for (let s = 0; s <= pasos; s++) celdas.add(clave(ax + ((bx - ax) * s) / pasos, ay + ((by - ay) * s) / pasos));
    }
    celdas.forEach(k => (trz.get(k) || trz.set(k, []).get(k)).push(i));
  });
  return { tam, pts, trz, x0: e[0], y0: e[1] };
}

/* ---------- Vista: conversión de coordenadas, zoom y desplazamiento ---------- */
PL_NOMH.mano = "Mano";
PL_NOMH.zventana = "Zoom ventana";
PL_NOMH.lamzona = "Zona de la lámina";
// Vistas anteriores (Vista anterior en la barra de navegación)
const PL_VHIST = [];
let PL_VHT = 0;
function plVistaPush(forzar) {
  const t = Date.now();
  if (!forzar && t - PL_VHT < 900) return;
  PL_VHT = t;
  const u = PL_VHIST[PL_VHIST.length - 1];
  if (u && u.cx === PLV.cx && u.cy === PLV.cy && u.s === PLV.s) return;
  PL_VHIST.push({ cx: PLV.cx, cy: PLV.cy, s: PLV.s });
  if (PL_VHIST.length > 40) PL_VHIST.shift();
}
function plVistaAnterior() {
  const v = PL_VHIST.pop();
  if (!v) return toast("No hay una vista anterior");
  Object.assign(PLV, v);
  PL_VHT = Date.now();
  plDibujar();
}
const plDpr = () => window.devicePixelRatio || 1;
const plW = () => plBase.width,
  plH = () => plBase.height;
// Del dibujo al lienzo (píxeles del lienzo) y del lienzo al dibujo
const plAPant = (x, y) => [(x - PLV.cx) * PLV.s + plW() / 2, plH() / 2 - (y - PLV.cy) * PLV.s];
const plADib = (X, Y) => [(X - plW() / 2) / PLV.s + PLV.cx, (plH() / 2 - Y) / PLV.s + PLV.cy];
// Posición del mouse en píxeles del lienzo (la escala del espacio de trabajo cambia el tamaño en pantalla)
function plMouse(e) {
  const r = plBase.getBoundingClientRect();
  return [((e.clientX - r.left) * plBase.width) / r.width, ((e.clientY - r.top) * plBase.height) / r.height];
}
// Extensión útil: sin los objetos sueltos muy lejos del dibujo (percentiles de los vértices)
function plExtUtil() {
  const m = PL_MOD;
  if (m.extU) return m.extU;
  const xs = [],
    ys = [];
  let n = 0;
  m.trazos.forEach(t => (n += t.p.length / 2));
  const paso = Math.max(1, Math.floor(n / 60000));
  let k = 0;
  m.trazos.forEach(t => {
    for (let j = 0; j < t.p.length; j += 2)
      if (k++ % paso === 0) {
        xs.push(t.p[j]);
        ys.push(t.p[j + 1]);
      }
  });
  if (xs.length < 10) return (m.extU = m.ext);
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const q = (a, f) => a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))];
  return (m.extU = [q(xs, 0.002), q(ys, 0.002), q(xs, 0.998), q(ys, 0.998)]);
}
function plVer(x0, y0, x1, y1) {
  if (PLV.s !== 1 || PLV.cx || PLV.cy) plVistaPush(true);
  const w = Math.max(x1 - x0, 1e-9),
    h = Math.max(y1 - y0, 1e-9);
  PLV.cx = (x0 + x1) / 2;
  PLV.cy = (y0 + y1) / 2;
  PLV.s = Math.min(plW() / w, plH() / h) * 0.92;
  plDibujar();
}
function plAjustar() {
  if (!PL_MOD) return;
  plTam();
  const e = plExtUtil();
  plVer(e[0], e[1], e[2], e[3]);
}
function plZoom(f, X = plW() / 2, Y = plH() / 2) {
  plVistaPush();
  const [x, y] = plADib(X, Y);
  PLV.s = Math.min(1e7, Math.max(1e-6, PLV.s * f));
  // El punto bajo el cursor queda en su lugar
  PLV.cx = x - (X - plW() / 2) / PLV.s;
  PLV.cy = y - (plH() / 2 - Y) / PLV.s;
  plDibujar();
}
// La última vista de este plano, para volver a ella al abrir el editor
const plClaveVista = () => "jmg-electric-plano-vista-" + PL_SHA;
function plVistaGuardada() {
  try {
    const v = JSON.parse(localStorage.getItem(plClaveVista()) || "null");
    if (v && [v.cx, v.cy, v.s, v.w].every(Number.isFinite) && v.s > 0) {
      plTam();
      Object.assign(PLV, { cx: v.cx, cy: v.cy, s: (v.s * plW()) / v.w });
      return true;
    }
  } catch (e) {}
  return false;
}
function plGuardarVista() {
  clearTimeout(plGuardarVista.t);
  plGuardarVista.t = setTimeout(() => {
    try {
      localStorage.setItem(plClaveVista(), JSON.stringify({ ...PLV, w: plW() }));
    } catch (e) {}
  }, 400);
}
// Tamaño de los lienzos: el del panel en pantalla, en píxeles del dispositivo
function plTam() {
  const r = plLienzo.getBoundingClientRect(),
    d = plDpr(),
    w = Math.max(1, Math.round(r.width * d)),
    h = Math.max(1, Math.round(r.height * d));
  if (plBase.width === w && plBase.height === h) return false;
  const k = plBase.width > 1 ? w / plBase.width : 1;
  [plBase, plSobre].forEach(c => {
    c.width = w;
    c.height = h;
  });
  // Al cambiar el ancho del panel se conserva lo que se veía
  PLV.s *= k;
  return true;
}

/* ---------- Colores: los del archivo, legibles sobre el fondo del tema; atenuados para diseñar encima ---------- */
let PL_FONDO = "#ffffff",
  PL_OSCURO = false;
const PL_COL = new Map();
const plRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const plHex = c =>
  "#" +
  c
    .map(v =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
const plLum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
function plTema() {
  const bg = getComputedStyle(plLienzo).backgroundColor.match(/\d+/g) || [255, 255, 255];
  PL_FONDO = plHex(bg.slice(0, 3).map(Number));
  PL_OSCURO = plLum(plRgb(PL_FONDO)) < 0.5;
  PL_COL.clear();
}
function plColor(h) {
  const tenue = !!(EPL && EPL.tenue),
    k = h + (tenue ? "t" : "");
  let c = PL_COL.get(k);
  if (c) return c;
  let v = plRgb(h);
  const l = plLum(v);
  // Blanco (color 7) y colores muy claros sobre fondo claro; casi negros sobre fondo oscuro
  if (!PL_OSCURO && l > 0.8) v = [38, 48, 60];
  else if (!PL_OSCURO && l > 0.55) v = v.map(x => x * 0.62);
  else if (PL_OSCURO && l < 0.18) v = v.map(x => x + (200 - x) * 0.7);
  if (tenue) {
    const f = plRgb(PL_FONDO);
    v = v.map((x, i) => x + (f[i] - x) * 0.62);
  }
  c = plHex(v);
  PL_COL.set(k, c);
  return c;
}

/* ---------- Dibujo del plano ---------- */
function plDibujar() {
  if (plDibujar.r) return;
  plDibujar.r = requestAnimationFrame(() => {
    plDibujar.r = 0;
    plPintar();
    plSobreDibujar();
    plGuardarVista();
  });
}
function plPintar() {
  const g = plBase.getContext("2d"),
    W = plW(),
    H = plH();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = PL_FONDO;
  g.fillRect(0, 0, W, H);
  if (!PL_GR) return;
  dsRejilla(g);
  const O = plOrigen(),
    s = PLV.s;
  g.setTransform(s, 0, 0, -s, W / 2 - (PLV.cx - O[0]) * s, H / 2 + (PLV.cy - O[1]) * s);
  const lw = Math.max(1, plDpr()) / s;
  g.lineJoin = "round";
  for (const gr of PL_GR) {
    const c = plColor(gr.col);
    if (gr.k === "f") {
      g.fillStyle = c;
      g.fill(gr.path, "evenodd");
    } else if (gr.k === "h") {
      g.globalAlpha = 0.14;
      g.fillStyle = c;
      g.fill(gr.path, "evenodd");
      g.globalAlpha = 1;
    } else {
      g.strokeStyle = c;
      g.lineWidth = lw;
      // Tipo de línea: solo si los guiones se distinguen en pantalla (si no, se ve como continua)
      const d = gr.lt && PL_MOD.tipos[gr.lt];
      if (d && Math.abs(d[0] || d[1]) * gr.lte * s > 2.5) {
        const total = d.reduce((a, b) => a + Math.abs(b), 0) * gr.lte;
        g.setLineDash(d.map(x => Math.max(Math.abs(x) * gr.lte, x === 0 ? total * 0.01 : 0)));
      } else g.setLineDash([]);
      g.stroke(gr.path);
    }
  }
  g.setLineDash([]);
  // Textos: solo los que se leen (más de 3 px de alto) y están a la vista
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const t of PL_TX) {
    const hp = t.h * s;
    if (hp < 3) continue;
    const [X, Y] = plAPant(t.x, t.y),
      lim = hp * (t.s.length + 2) * 1.2;
    if (X < -lim || X > W + lim || Y < -lim || Y > H + lim) continue;
    g.save();
    g.translate(X, Y);
    g.rotate(-t.rot);
    if (t.w !== 1) g.scale(t.w, 1);
    // Altura de AutoCAD = altura de las mayúsculas, ≈ 0.72 del tamaño de la letra
    g.font = `${hp / 0.72}px Arial, sans-serif`;
    g.fillStyle = plColor(t.col);
    g.textAlign = t.ha;
    const ls = t.s.split("\n"),
      lh = hp * 1.667;
    g.textBaseline = t.mt ? (t.va === "top" ? "top" : t.va === "bottom" ? "bottom" : "middle") : t.va;
    const y0 = t.va === "top" ? 0 : t.va === "bottom" ? -(ls.length - 1) * lh : (-(ls.length - 1) * lh) / 2;
    ls.forEach((l, i) => g.fillText(l, 0, y0 + i * lh));
    g.restore();
  }
  dsPintar(g);
}

/* ---------- Lienzo superior: selección, enganche, mediciones, encuadres y plantas ---------- */
const plFm = v => fmt(v * (EPL ? EPL.f : 1), 2);
function plSobreDibujar() {
  const g = plSobre.getContext("2d"),
    d = plDpr();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, plW(), plH());
  if (!PL_MOD || !EPL) return;
  const acento = PL_OSCURO ? "#f0c060" : "#c77d2e",
    azul = PL_OSCURO ? "#8fc1f0" : "#14304f",
    // Selección en azul vivo, como en los programas de dibujo, para distinguirla de las líneas del plano
    selc = PL_OSCURO ? "#5fb0ff" : "#1f6fd6";
  g.lineWidth = 1.5 * d;
  g.font = `600 ${11.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
  // Plantas encuadradas
  EPL.plantas.forEach(p => {
    const [a, b] = plAPant(p.x0, p.y1),
      [c, e] = plAPant(p.x1, p.y0);
    g.setLineDash([6 * d, 4 * d]);
    g.strokeStyle = azul;
    g.strokeRect(a, b, c - a, e - b);
    g.setLineDash([]);
    plEtiqueta(g, p.n, a + 4 * d, b + 4 * d, azul, "left", "top");
  });
  // Objeto bajo el cursor en Seleccionar: resaltado suave, para saber qué se elegiría con un clic
  if (PLH.sobre >= 0 && PLH.sobre !== PLH.obj && !PLH.h && !PLH.dsSobre) {
    const t = PL_MOD.trazos[PLH.sobre];
    g.globalAlpha = 0.6;
    g.strokeStyle = selc;
    g.lineWidth = 2.5 * d;
    plTrazo(g, t.p, t.c);
    g.globalAlpha = 1;
  }
  // Objetos elegidos de la arquitectura (para borrarlos): resaltados con trazos
  if (PL_ASEL.size && !PLH.h) {
    g.strokeStyle = selc;
    g.lineWidth = 2.5 * d;
    g.setLineDash([8 * d, 4 * d]);
    PL_ASEL.forEach(n =>
      plTrazosDe(n).forEach(i => {
        const t = PL_MOD.trazos[i];
        if (t.k === "l" && i !== PLH.obj) plTrazo(g, t.p, t.c);
      })
    );
    g.setLineDash([]);
  }
  // Objeto seleccionado: resaltado con sus vértices (no se mueve)
  if (PLH.obj >= 0 && !PLH.h) {
    const t = PL_MOD.trazos[PLH.obj];
    g.strokeStyle = selc;
    g.lineWidth = 3 * d;
    g.setLineDash([8 * d, 4 * d]);
    plTrazo(g, t.p, t.c);
    g.setLineDash([]);
    // Pinzamientos en los vértices (en las curvas, solo en los extremos)
    const curva = /ARC|CIRCLE|ELLIPSE|SPLINE/.test(t.ent),
      paso = curva ? Math.max(2, t.p.length - 2) : 2;
    g.fillStyle = selc;
    g.strokeStyle = PL_OSCURO ? "#111922" : "#fff";
    g.lineWidth = 1.2 * d;
    for (let i = 0; i < t.p.length; i += paso) {
      const [X, Y] = plAPant(t.p[i], t.p[i + 1]);
      g.fillRect(X - 4 * d, Y - 4 * d, 8 * d, 8 * d);
      g.strokeRect(X - 4 * d, Y - 4 * d, 8 * d, 8 * d);
    }
  }
  // Objetos elegidos con Longitud de objetos
  if (PLH.sel.length) {
    g.strokeStyle = acento;
    g.lineWidth = 3 * d;
    PLH.sel.forEach(i => plTrazo(g, PL_MOD.trazos[i].p, PL_MOD.trazos[i].c));
    g.lineWidth = 1.5 * d;
  }
  // Medición o encuadre en curso, con el punto actual del cursor
  const pts = PLH.pts.slice(),
    q = plPuntoActual();
  if ((PLH.h === "planta" || PLH.h === "zventana" || PLH.h === "lamzona") && pts.length === 1 && q) {
    const [a, b] = plAPant(pts[0][0], pts[0][1]),
      [c, e] = plAPant(q[0], q[1]);
    g.fillStyle = PL_OSCURO ? "rgba(143,193,240,.12)" : "rgba(20,48,79,.08)";
    g.fillRect(a, b, c - a, e - b);
    g.strokeStyle = azul;
    g.strokeRect(a, b, c - a, e - b);
  } else if (pts.length && !["planta", "zventana", "lamzona"].includes(PLH.h)) {
    const todo = PLH.med ? pts : q ? [...pts, q] : pts;
    g.strokeStyle = acento;
    g.lineWidth = 2 * d;
    plTrazo(g, todo.flat(), false);
    todo.forEach(p => {
      const [X, Y] = plAPant(p[0], p[1]);
      g.fillStyle = acento;
      g.fillRect(X - 3 * d, Y - 3 * d, 6 * d, 6 * d);
    });
    // Longitud de cada tramo y total
    let tot = 0;
    for (let i = 1; i < todo.length; i++) {
      const l = Math.hypot(todo[i][0] - todo[i - 1][0], todo[i][1] - todo[i - 1][1]);
      tot += l;
      const [X, Y] = plAPant((todo[i][0] + todo[i - 1][0]) / 2, (todo[i][1] + todo[i - 1][1]) / 2);
      plEtiqueta(g, plFm(l) + " m", X, Y - 8 * d, acento, "center", "bottom");
    }
    if (todo.length > 2) {
      const u = todo[todo.length - 1],
        [X, Y] = plAPant(u[0], u[1]);
      plEtiqueta(g, "Total " + plFm(tot) + " m", X + 10 * d, Y + 10 * d, acento, "left", "top");
    }
  }
  dsSobre(g);
  // Marca de enganche (como en AutoCAD) y su nombre: cuadrado en extremos, triángulo en puntos medios, círculo en
  // centros, dos cuadrados en inserciones, reloj de arena en cercano, escuadra en perpendicular y aspa en
  // intersección
  if (PLH.eng && (PLH.h || PLH.arr || PLH.agarre)) {
    const [X, Y] = plAPant(PLH.eng[0], PLH.eng[1]),
      r = 6 * d,
      k = PLH.eng[2],
      verde = PL_OSCURO ? "#7ee08a" : "#1f8a3a";
    g.save();
    g.globalAlpha = 0.75;
    g.strokeStyle = verde;
    g.lineWidth = 1.4 * d;
    g.beginPath();
    if (k === 2) {
      g.moveTo(X, Y - r);
      g.lineTo(X + r, Y + r * 0.8);
      g.lineTo(X - r, Y + r * 0.8);
      g.closePath();
    } else if (k === 3) g.arc(X, Y, r, 0, 2 * Math.PI);
    else if (k === 4) {
      g.rect(X - r, Y - r, r * 1.2, r * 1.2);
      g.rect(X - r * 0.2, Y - r * 0.2, r * 1.2, r * 1.2);
    } else if (k === 5) {
      g.moveTo(X - r, Y - r);
      g.lineTo(X + r, Y - r);
      g.lineTo(X - r, Y + r);
      g.lineTo(X + r, Y + r);
      g.closePath();
    } else if (k === 6) {
      g.moveTo(X - r, Y - r);
      g.lineTo(X - r, Y + r);
      g.lineTo(X + r, Y + r);
      g.moveTo(X - r, Y);
      g.lineTo(X, Y);
      g.lineTo(X, Y + r);
    } else if (k === 7) {
      g.moveTo(X - r, Y - r);
      g.lineTo(X + r, Y + r);
      g.moveTo(X + r, Y - r);
      g.lineTo(X - r, Y + r);
    } else if (k === 10) {
      g.rect(X - r * 1.3, Y - r * 0.8, r * 2.6, r * 1.6);
      g.moveTo(X - r * 1.3, Y + r * 0.8);
      g.lineTo(X + r * 1.3, Y - r * 0.8);
    } else if (k === 9) {
      g.arc(X, Y, r * 1.1, 0, 2 * Math.PI);
      g.moveTo(X + r * 0.5, Y);
      g.arc(X, Y, r * 0.5, 0, 2 * Math.PI);
      g.fillStyle = verde;
      g.fill();
    } else if (k === 8) {
      g.arc(X, Y, r, 0, 2 * Math.PI);
      g.moveTo(X + r * 0.35, Y);
      g.arc(X, Y, r * 0.35, 0, 2 * Math.PI);
    } else g.rect(X - r, Y - r, 2 * r, 2 * r);
    g.stroke();
    // Nombre del enganche: pequeño y casi transparente, para que no tape el dibujo
    g.globalAlpha = 0.6;
    g.font = `500 ${10 * d}px "IBM Plex Sans", Arial, sans-serif`;
    const sal = PLH.eng[3];
    plEtiqueta(
      g,
      k === 8 && sal
        ? `Salida ${sal.cir}${sal.nom ? " · " + sal.nom : ""}`
        : k === 9 && sal
          ? `Conectar a: ${sal.nom.toLowerCase()}`
          : k === 10 && sal
            ? `Clic: elegir la salida de ${sal.nom}`
            : PL_ENG[k] || "",
      X + 12 * d,
      Y + 10 * d,
      verde,
      "left",
      "top"
    );
    g.restore();
  }
}
function plTrazo(g, p, cerrado) {
  g.beginPath();
  for (let i = 0; i < p.length; i += 2) {
    const [X, Y] = plAPant(p[i], p[i + 1]);
    if (i) g.lineTo(X, Y);
    else g.moveTo(X, Y);
  }
  if (cerrado) g.closePath();
  g.stroke();
}
function plEtiqueta(g, t, X, Y, col, ha, va) {
  const d = plDpr(),
    w = g.measureText(t).width + 10 * d,
    h = 18 * d,
    x = ha === "center" ? X - w / 2 : ha === "right" ? X - w : X,
    y = va === "bottom" ? Y - h : Y;
  g.fillStyle = PL_OSCURO ? "rgba(17,25,34,.92)" : "rgba(255,255,255,.92)";
  g.fillRect(x, y, w, h);
  g.strokeStyle = col;
  g.lineWidth = 1 * d;
  g.strokeRect(x, y, w, h);
  g.fillStyle = col;
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText(t, x + 5 * d, y + h / 2 + 0.5 * d);
}

/* ---------- Enganche y orto ----------
   Enganches (como la referencia a objetos de AutoCAD), cada uno activable en la barra de estado: extremo, punto
   medio, centro e inserción (puntos del plano y del diseño), intersección de dos líneas, perpendicular desde el
   punto anterior y cercano (el punto de una línea más próximo al cursor). Los puntos tienen prioridad; después,
   la intersección, la perpendicular y el cercano. La sensibilidad es la distancia en píxeles alrededor del cursor.
   Con Mayús presionada no se engancha nada (para colocar en un punto cercano y no justo en él). */
const PL_ENG = {
  1: "Extremo",
  2: "Punto medio",
  3: "Centro",
  4: "Inserción",
  5: "Cercano",
  6: "Perpendicular",
  7: "Intersección",
  8: "Salida de circuito",
  9: "Conexión",
  10: "Tablero"
};
const PL_REF = { 1: "fin", 2: "med", 3: "cen", 4: "ins", 5: "cer", 6: "per", 7: "int", 9: "con", 10: "con" };
const plDistPS = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax,
    dy = by - ay,
    l2 = dx * dx + dy * dy,
    t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx - x, ay + t * dy - y);
};
// Elementos del diseño que se están moviendo (no se enganchan a sí mismos)
const plMoviendo = () => (PLH.arr ? new Set(dsSel().map(el => el.id)) : PLH.agarre ? new Set([PLH.agarre.id]) : null);
// Tramos rectos visibles a menos de r del punto: de la arquitectura (por su índice) y del diseño; con muros, solo
// las líneas continuas de la arquitectura (los ejes y las proyecciones van con tipo de línea discontinuo)
function plSegmentos(x, y, r, muros) {
  const out = [],
    I = PL_IDX,
    fuera = plMoviendo();
  if (I) {
    const oc = new Set(EPL.ocultas),
      n = Math.ceil(r / I.tam),
      ci = Math.floor((x - I.x0) / I.tam),
      cj = Math.floor((y - I.y0) / I.tam),
      vistos = new Set();
    // Hasta 40 celdas alrededor (en planos pequeños, las celdas del índice son pequeñas)
    if (n <= 40)
      for (let a = ci - n; a <= ci + n; a++)
        for (let b = cj - n; b <= cj + n; b++)
          for (const i of I.trz.get(a + "," + b) || []) {
            if (vistos.has(i)) continue;
            vistos.add(i);
            const t = PL_MOD.trazos[i];
            if (oc.has(t.capa) || PL_BORR.has(t.e) || (muros && t.lt)) continue;
            const p = t.p,
              m = t.c ? p.length : p.length - 2;
            for (let j = 0; j < m; j += 2) {
              const s = [p[j], p[j + 1], p[(j + 2) % p.length], p[(j + 3) % p.length]];
              if (plDistPS(x, y, ...s) <= r) out.push(s);
            }
          }
  }
  const D = dsD();
  if (D)
    dsCercanos(x, y, r).forEach(el => {
      if (!dsVis(el) || (fuera && fuera.has(el.id))) return;
      dsLineas(el).forEach(p => {
        for (let j = 0; j + 3 < p.length; j += 2) {
          const s = [p[j], p[j + 1], p[j + 2], p[j + 3]];
          if (plDistPS(x, y, ...s) <= r) out.push(s);
        }
      });
    });
  return out.slice(0, 800);
}
// Punto de una línea visible más cercano a (x, y), a menos de r (con muros, para encajar símbolos en el muro)
function plSegCercano(x, y, r, muros) {
  let mejor = null;
  for (const [ax, ay, bx, by] of plSegmentos(x, y, r, muros)) {
    const dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy;
    if (!l2) continue;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)),
      p = [ax + t * dx, ay + t * dy],
      d = Math.hypot(p[0] - x, p[1] - y);
    if (!mejor || d < mejor.d) mejor = { p, d, a: [ax, ay], b: [bx, by] };
  }
  return mejor;
}
// Intersección de dos tramos, o null
function plCruce(s, t) {
  const [x1, y1, x2, y2] = s,
    [x3, y3, x4, y4] = t,
    d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-12) return null;
  const a = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d,
    b = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  return a >= -1e-9 && a <= 1 + 1e-9 && b >= -1e-9 && b <= 1 + 1e-9 ? [x1 + a * (x2 - x1), y1 + a * (y2 - y1)] : null;
}
// Punto de enganche más cercano al cursor, o null: [x, y, tipo]
function plEnganche(x, y) {
  if (!PL_IDX || !$("plSnap").checked || PLH.libre) return null;
  const I = PL_IDX,
    R = DSU.ref,
    r = (DSU.sens * plDpr()) / PLV.s,
    n = Math.ceil(r / I.tam);
  if (n > 40) return null;
  const ci = Math.floor((x - I.x0) / I.tam),
    cj = Math.floor((y - I.y0) / I.tam),
    oc = new Set(EPL.ocultas),
    sn = PL_MOD.snap,
    vale = k => R[PL_REF[k]] !== false;
  // Tubería: la punta se conecta al artefacto cercano (en su borde); la salida del tablero va primero
  if (vale(9)) {
    const c = dsEngancheCon(x, y, r);
    if (c) {
      // Sobre el cuerpo del tablero: el menú de sus salidas; fuera de él, la salida más cercana
      if (c[2] === 10 && dsTableroEn(x, y, 0)) return c;
      const sal = dsPuntosEnganche(dsCercanos(x, y, r))
        .filter(q => q[2] === 8 && Math.hypot(q[0] - x, q[1] - y) < r)
        .sort((p, q) => Math.hypot(p[0] - x, p[1] - y) - Math.hypot(q[0] - x, q[1] - y))[0];
      return sal || c;
    }
  }
  let mejor = null,
    md = r;
  const fuera = plMoviendo(),
    del = dsD() ? dsCercanos(x, y, r).filter(el => !(fuera && fuera.has(el.id))) : [];
  for (const q of dsPuntosEnganche(del)) {
    const dd = Math.hypot(q[0] - x, q[1] - y);
    if (dd < md && vale(q[2])) {
      md = dd;
      mejor = q;
    }
  }
  for (let a = ci - n; a <= ci + n; a++)
    for (let b = cj - n; b <= cj + n; b++) {
      const l = I.pts.get(a + "," + b);
      if (l)
        for (const i of l) {
          const dd = Math.hypot(sn[i] - x, sn[i + 1] - y);
          // Un extremo gana a un punto medio que esté casi a la misma distancia
          if (dd < md - (sn[i + 2] === 1 ? -r * 0.15 : 0) && vale(sn[i + 2])) {
            if (oc.has(PL_MOD.snapC[i / 3]) || PL_BORR.has(PL_MOD.snapE[i / 3])) continue;
            md = dd;
            mejor = [sn[i], sn[i + 1], sn[i + 2]];
          }
        }
    }
  if (mejor || !(R.int || R.per || R.cer)) return mejor;
  const segs = plSegmentos(x, y, r);
  // Intersección de dos líneas
  if (R.int !== false && segs.length > 1) {
    const L = Math.min(segs.length, 160);
    for (let i = 0; i < L; i++)
      for (let j = i + 1; j < L; j++) {
        const c = plCruce(segs[i], segs[j]);
        if (!c) continue;
        const dd = Math.hypot(c[0] - x, c[1] - y);
        if (dd < md) {
          md = dd;
          mejor = [c[0], c[1], 7];
        }
      }
    if (mejor) return mejor;
  }
  // Perpendicular desde el punto anterior
  const u = PLH.pts[PLH.pts.length - 1];
  if (R.per !== false && u)
    for (const [ax, ay, bx, by] of segs) {
      const dx = bx - ax,
        dy = by - ay,
        l2 = dx * dx + dy * dy,
        t = l2 ? ((u[0] - ax) * dx + (u[1] - ay) * dy) / l2 : -1;
      if (t < 0 || t > 1) continue;
      const f = [ax + t * dx, ay + t * dy],
        dd = Math.hypot(f[0] - x, f[1] - y);
      if (dd < md) {
        md = dd;
        mejor = [f[0], f[1], 6];
      }
    }
  if (mejor) return mejor;
  // Cercano: el punto de la línea más próximo al cursor
  if (R.cer !== false) {
    const s = plSegCercano(x, y, r);
    if (s) return [s.p[0], s.p[1], 5];
  }
  return null;
}
function plPuntoActual() {
  if (!PLH.cur) return null;
  let p = PLH.eng ? [PLH.eng[0], PLH.eng[1]] : PLH.cur.slice();
  if (!PLH.eng && DSU.forz && !PLH.libre) p = dsAlaRejilla(p);
  const u =
    PLH.pts[PLH.pts.length - 1] ||
    (PLH.arr && PLH.arr.base) ||
    (PLH.agarre && !["m", "o", "giro", "letra"].includes(PLH.agarre.t) ? [PLH.agarre.x, PLH.agarre.y] : null);
  PLH.polar = null;
  if (u && $("plOrto").checked && !PLH.eng) {
    if (Math.abs(p[0] - u[0]) > Math.abs(p[1] - u[1])) p = [p[0], u[1]];
    else p = [u[0], p[1]];
  } else if (u && DSU.polar && !PLH.eng && !PLH.libre && (PLH.h || PLH.arr)) {
    // Rastreo polar: cerca de un múltiplo del ángulo elegido, el cursor se alinea a esa dirección
    const dx = p[0] - u[0],
      dy = p[1] - u[1],
      dist = Math.hypot(dx, dy),
      inc = (DSU.polarInc * Math.PI) / 180,
      a = Math.atan2(dy, dx),
      ak = Math.round(a / inc) * inc;
    // Imán: a menos de 14 píxeles de la dirección, o a menos de 3° de ella
    const da = Math.abs(Math.atan2(Math.sin(a - ak), Math.cos(a - ak)));
    if (dist * PLV.s > 10 * plDpr() && (Math.sin(da) * dist * PLV.s < 14 * plDpr() || da < (3 * Math.PI) / 180)) {
      const l = dist * Math.cos(a - ak);
      p = [u[0] + l * Math.cos(ak), u[1] + l * Math.sin(ak)];
      PLH.polar = { u, ang: ak };
    }
  }
  return p;
}
// Trazo visible más cercano a un punto (a menos de r en unidades del dibujo)
function plObjeto(x, y, r) {
  const I = PL_IDX;
  if (!I) return -1;
  const oc = new Set(EPL.ocultas),
    n = Math.ceil(r / I.tam),
    ci = Math.floor((x - I.x0) / I.tam),
    cj = Math.floor((y - I.y0) / I.tam),
    vistos = new Set();
  let mejor = -1,
    md = r;
  for (let a = ci - n; a <= ci + n; a++)
    for (let b = cj - n; b <= cj + n; b++)
      for (const i of I.trz.get(a + "," + b) || []) {
        if (vistos.has(i)) continue;
        vistos.add(i);
        const t = PL_MOD.trazos[i];
        if (oc.has(t.capa) || PL_BORR.has(t.e)) continue;
        const dd = plDistTrazo(t, x, y);
        if (dd < md) {
          md = dd;
          mejor = i;
        }
      }
  return mejor;
}
function plDistTrazo(t, x, y) {
  const p = t.p;
  let md = Infinity;
  const n = t.c ? p.length : p.length - 2;
  for (let j = 0; j < n; j += 2) {
    const ax = p[j],
      ay = p[j + 1],
      bx = p[(j + 2) % p.length],
      by = p[(j + 3) % p.length],
      dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy,
      u = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    md = Math.min(md, Math.hypot(ax + u * dx - x, ay + u * dy - y));
  }
  return md;
}
const plLargo = t => {
  let l = 0;
  for (let j = 2; j < t.p.length; j += 2) l += Math.hypot(t.p[j] - t.p[j - 2], t.p[j + 1] - t.p[j - 1]);
  if (t.c && t.p.length > 4) l += Math.hypot(t.p[0] - t.p[t.p.length - 2], t.p[1] - t.p[t.p.length - 1]);
  return l;
};
// Área encerrada por un trazo cerrado (fórmula del polígono), en unidades del dibujo al cuadrado
const plArea = t => {
  let a = 0;
  for (let j = 0; j < t.p.length; j += 2) {
    const k = (j + 2) % t.p.length;
    a += t.p[j] * t.p[k + 1] - t.p[k] * t.p[j + 1];
  }
  return Math.abs(a) / 2;
};

/* ---------- Herramientas: distancia, recorrido, longitud de objetos, escala y plantas ---------- */
function plHerr(h) {
  PLH.h = h;
  PLH.pts = [];
  PLH.sel = [];
  PLH.med = null;
  PLH.eng = null;
  PLH.arr = PLH.marco = PLH.alin = PLH.agarre = null;
  PLH.bul = [];
  PLH.lado = 1;
  PLH.cirIni = null;
  PLH.conIni = null;
  plPedir(null);
  // Sin herramienta, el modo es Seleccionar
  document.querySelectorAll("#editor [data-pl]").forEach(b => b.classList.toggle("on", b.dataset.pl === (h || "sel")));
  plLienzo.classList.toggle("con-herr", !!h);
  plLienzo.classList.toggle("herr-mano", h === "mano");
  plOrden();
  edProps();
  plSobreDibujar();
}
// Indicación de la herramienta, como la línea de comandos de los programas de dibujo
function plOrden(txt) {
  const c = $("plCmdT");
  if (txt !== undefined) c.innerHTML = txt;
  else if (!PLH.h) c.innerHTML = "";
  else {
    const n = PLH.pts.length,
      T = {
        dist: n ? "Designe el segundo punto" : "Designe el primer punto",
        rec: n
          ? "Designe el siguiente punto · <b>Intro</b> o doble clic para terminar"
          : "Designe el primer punto del recorrido",
        obj: "Haga clic en las líneas o curvas para sumar su longitud · clic de nuevo para quitarla",
        escala: n
          ? "Designe el segundo punto de la medida conocida"
          : "Designe el primer punto de una medida conocida (por ejemplo, los extremos de una cota)",
        planta: n ? "Designe la esquina opuesta" : "Designe una esquina de la planta",
        mano: "Arrastre para desplazar el plano · rueda para acercar o alejar",
        zventana: n ? "Designe la esquina opuesta" : "Designe una esquina del rectángulo que quiere ver",
        lamzona: n ? "Designe la esquina opuesta" : "Designe una esquina de lo que va en la lámina"
      };
    c.innerHTML = dsEsHerr(PLH.h)
      ? dsOrden(PLH.h, n)
      : `<b>${PL_NOMH[PLH.h]}</b> · ${T[PLH.h]} · <span class="pl-k">Esc</span> para salir`;
  }
  $("plCmd").hidden = !c.innerHTML;
}
// Pide un dato en la línea de comandos (medida real, nombre de la planta, longitud escrita) y llama a fn con lo
// escrito; con seguir, el texto ya escrito queda y se sigue escribiendo a continuación
function plPedir(etq, val, fn, seguir) {
  const box = $("plCmdIn");
  plPedir.fn = fn || null;
  plPedir.din = !!seguir;
  box.hidden = !etq;
  $("plCmd").hidden = !$("plCmdT").innerHTML && !etq;
  if (!etq) {
    if (document.activeElement === $("plCmdV")) $("plCmdV").blur();
    return;
  }
  $("plCmdL").textContent = etq;
  $("plCmdV").value = val;
  $("plCmdV").inputMode = /medida|longitud|radio/i.test(etq) ? "decimal" : "text";
  const foco = () => {
    $("plCmdV").focus();
    if (seguir) $("plCmdV").setSelectionRange(val.length, val.length);
    else $("plCmdV").select();
  };
  if (seguir) foco();
  else setTimeout(foco, 20);
}
function plAceptarPedido() {
  const fn = plPedir.fn;
  if (fn) fn($("plCmdV").value.trim());
}
$("plCmdOk").addEventListener("click", plAceptarPedido);
$("plCmdV").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    plAceptarPedido();
  } else if (e.key === "Escape") {
    // Una longitud escrita se descarta; con otro dato, se sale de la herramienta
    if (plPedir.din) plPedir(null);
    else plHerr(null);
  }
  e.stopPropagation();
});
function plPunto(p) {
  const h = PLH.h;
  if (h === "obj") {
    const i = plObjeto(p[0], p[1], (8 * plDpr()) / PLV.s);
    if (i < 0) return plSumaObjetos();
    const k = PLH.sel.indexOf(i);
    if (k >= 0) PLH.sel.splice(k, 1);
    else PLH.sel.push(i);
    return plSumaObjetos();
  }
  if (PLH.med) {
    PLH.pts = [];
    PLH.med = null;
  }
  PLH.pts.push(p);
  const n = PLH.pts.length;
  if (h === "lamzona") {
    if (n < 2) return plOrden();
    const [a, b] = PLH.pts;
    plHerr(null);
    return lamZonaMarcada([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
  }
  if (h === "zventana") {
    if (n < 2) return plOrden();
    const [a, b] = PLH.pts;
    plHerr(null);
    if (Math.abs(a[0] - b[0]) * PLV.s > 6 && Math.abs(a[1] - b[1]) * PLV.s > 6)
      plVer(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
    return;
  }
  if (h === "dist" && n === 2) {
    const [a, b] = PLH.pts,
      l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    PLH.med = true;
    plOrden(
      `<b>Distancia ${plFm(l)} m</b> · ΔX ${plFm(Math.abs(b[0] - a[0]))} m · ΔY ${plFm(Math.abs(b[1] - a[1]))} m · ángulo ${fmt((ang + 360) % 360, 1)}° · clic para medir otra · <span class="pl-k">Esc</span> para salir`
    );
  } else if (h === "escala" && n === 2) {
    const [a, b] = PLH.pts,
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(l > 0)) {
      PLH.pts = [];
      return plOrden();
    }
    PLH.med = true;
    plOrden(`<b>Comprobar escala</b> · en el dibujo: ${plFm(l)} m`);
    plPedir("Medida real entre los dos puntos (m)", plFm(l), v => {
      const real = parseFloat(v.replace(",", "."));
      if (!(real > 0)) return toast("Escriba la medida real en metros, mayor que cero");
      EPL.f = real / l;
      EPL.de = "manual";
      plHerr(null);
      edCambio();
      toast(`Escala comprobada: 1 unidad del dibujo = ${fmt(EPL.f, EPL.f < 0.01 ? 4 : 3)} m`);
    });
  } else if (h === "planta" && n === 2) {
    const [a, b] = PLH.pts;
    if (Math.abs(a[0] - b[0]) * PLV.s < 8 || Math.abs(a[1] - b[1]) * PLV.s < 8) {
      PLH.pts = [];
      return plOrden();
    }
    PLH.med = true;
    const k = EPL.plantas.length + 1;
    plOrden(`<b>Encuadrar planta</b> · ${plFm(Math.abs(a[0] - b[0]))} × ${plFm(Math.abs(a[1] - b[1]))} m`);
    plPedir("Nombre de la planta", `${ORD(k)} piso`, v => {
      if (!v) return toast("Escriba un nombre para la planta");
      EPL.plantas.push({
        n: v.replace(/[<>]/g, "").slice(0, 60),
        x0: Math.min(a[0], b[0]),
        y0: Math.min(a[1], b[1]),
        x1: Math.max(a[0], b[0]),
        y1: Math.max(a[1], b[1])
      });
      plHerr(null);
      edCambio();
      toast("Planta encuadrada: haga clic en su nombre, en el panel Plantas, para verla");
    });
  } else plOrden();
  plSobreDibujar();
}
function plSumaObjetos() {
  const L = PLH.sel.reduce((s, i) => s + plLargo(PL_MOD.trazos[i]), 0),
    capas = [...new Set(PLH.sel.map(i => PL_MOD.trazos[i].capa))];
  plOrden(
    PLH.sel.length
      ? `<b>${PLH.sel.length} objeto${PLH.sel.length > 1 ? "s" : ""} · ${plFm(L)} m</b> · capa${capas.length > 1 ? "s" : ""} ${esc(capas.slice(0, 3).join(", "))}${capas.length > 3 ? "…" : ""} · clic en otro para sumarlo · <span class="pl-k">Esc</span> para salir`
      : undefined
  );
  plSobreDibujar();
}
function plTerminarRecorrido() {
  if (PLH.h !== "rec" || PLH.pts.length < 2) return;
  let L = 0;
  for (let i = 1; i < PLH.pts.length; i++)
    L += Math.hypot(PLH.pts[i][0] - PLH.pts[i - 1][0], PLH.pts[i][1] - PLH.pts[i - 1][1]);
  PLH.med = true;
  plOrden(
    `<b>Recorrido ${plFm(L)} m</b> · ${PLH.pts.length - 1} tramo${PLH.pts.length > 2 ? "s" : ""} · clic para medir otro · <span class="pl-k">Esc</span> para salir`
  );
  plSobreDibujar();
}
// Seleccionar: un clic en una línea la elige y muestra sus propiedades; en un lugar vacío, la suelta
function plSeleccionar(p, suma) {
  PLH.obj = EPL.tenue ? -1 : plObjeto(p[0], p[1], (8 * plDpr()) / PLV.s);
  if (!suma) PL_ASEL.clear();
  if (PLH.obj >= 0) {
    const n = PL_MOD.trazos[PLH.obj].e;
    if (suma && PL_ASEL.has(n)) {
      PL_ASEL.delete(n);
      PLH.obj = -1;
    } else PL_ASEL.add(n);
  }
  edProps();
  plSobreDibujar();
}

/* ---------- Panel de propiedades: el objeto seleccionado o, si no hay, el plano ---------- */
const PL_ENT = {
  LINE: "Línea",
  LWPOLYLINE: "Polilínea",
  POLYLINE: "Polilínea",
  ARC: "Arco",
  CIRCLE: "Círculo",
  ELLIPSE: "Elipse",
  SPLINE: "Curva spline",
  LEADER: "Directriz"
};
const PL_VER = {
  AC1009: "R12",
  AC1012: "R13",
  AC1014: "R14",
  AC1015: "2000",
  AC1018: "2004",
  AC1021: "2007",
  AC1024: "2010",
  AC1027: "2013",
  AC1032: "2018"
};
function edProps() {
  const c = $("edPropC"),
    m = PL_MOD;
  const fila = (k, v) => `<div class="ed-pf"><span>${k}</span><b>${v}</b></div>`;
  if (!m || !EPL) {
    c.innerHTML = `<p class="pl-nota">Abra el plano de arquitectura para ver sus propiedades.</p>`;
    return;
  }
  if (DS_SEL.size && !PLH.h) return dsProps(c);
  if (PLH.obj < 0 || PLH.h) {
    const oc = new Set(EPL.ocultas),
      capas = Object.keys(m.capas).filter(n => m.capas[n].n > 0);
    c.innerHTML =
      `<div class="ed-pt">Plano de arquitectura</div>` +
      fila("Archivo", `<span title="${esc(EPL.nombre)}">${esc(EPL.nombre)}</span>`) +
      fila("Formato", `DXF · AutoCAD ${PL_VER[m.version] || m.version}`) +
      fila("Tamaño", `${fmt(EPL.kb / 1024, 1)} MB`) +
      fila("Unidad", `${plNomUnidad(EPL.f)}<small>${PL_DE[EPL.de] || ""}</small>`) +
      fila("Capas", `${capas.filter(n => !oc.has(n)).length} visibles de ${capas.length}`) +
      fila("Objetos", m.nEnt.toLocaleString("es-PE")) +
      fila("Bloques", m.nBloques) +
      fila("Plantas", EPL.plantas.length || "—") +
      (PL_BORR.size ? fila("Objetos borrados", PL_BORR.size.toLocaleString("es-PE")) : "") +
      `<p class="pl-nota">Haga clic en una línea del plano para ver sus propiedades. La arquitectura es una referencia: se consulta y se mide, pero no se mueve. Lo que sobre (muebles, textos, achurados) se puede borrar con <span class="pl-k">Supr</span> o <span class="pl-k">Ctrl</span>+<span class="pl-k">X</span>: solo se oculta en la plataforma; el archivo DXF no cambia.</p>` +
      (PL_BORR.size
        ? `<div class="ed-pb"><button type="button" class="btn sec sm" data-pl-rest>Restaurar los borrados</button></div>`
        : "");
    return;
  }
  const t = m.trazos[PLH.obj],
    L = plLargo(t),
    curva = /ARC|CIRCLE|ELLIPSE|SPLINE/.test(t.ent),
    totCapa = m.trazos.filter(x => x.capa === t.capa && x.k === "l").reduce((s, x) => s + plLargo(x), 0);
  c.innerHTML =
    `<div class="ed-pt">${PL_ENT[t.ent] || t.ent}${t.bl ? `<small>en el bloque ${esc(t.bl)}</small>` : ""}</div>` +
    fila("Capa", `<i class="ed-sw" style="background:${plColor(t.col)}"></i>${esc(t.capa)}`) +
    fila("Tipo de línea", t.lt ? esc(t.lt.toLowerCase()) : "continua") +
    fila(t.ent === "CIRCLE" ? "Perímetro" : "Longitud", `${plFm(L)} m`) +
    (t.c && t.p.length >= 6 ? fila("Área", `${fmt(plArea(t) * EPL.f * EPL.f, 2)} m²`) : "") +
    (curva ? "" : fila("Vértices", t.p.length / 2 - (t.c && t.ent !== "LINE" ? 1 : 0))) +
    fila("Cerrado", t.c ? "sí" : "no") +
    fila("Toda la capa", `${plFm(totCapa)} m`) +
    (PL_ASEL.size > 1 ? fila("Elegidos", `${PL_ASEL.size} objetos`) : "") +
    `<p class="pl-nota ed-bloq"><b>No se mueve:</b> la arquitectura es una referencia del plano del arquitecto. Se puede borrar${t.bl ? " (el bloque completo)" : ""}; el archivo DXF no cambia.</p>` +
    `<div class="ed-pb"><button type="button" class="btn sec sm" data-pl-oc="${esc(t.capa)}">Ocultar la capa</button><button type="button" class="btn sec sm ed-del" data-pl-del title="Supr o Ctrl+X">Borrar</button></div>`;
}
// Borra lo elegido, del diseño y de la arquitectura, en un solo paso de deshacer; con cortar, lo del diseño queda
// copiado para pegarlo con Ctrl+V
function edBorrar(cortar) {
  const sel = dsD() ? dsSel().filter(dsEditable) : [],
    na = PL_ASEL.size;
  if (!sel.length && !na) return toast("Elija primero lo que quiere borrar");
  if (sel.length) {
    if (cortar) DS_PORTA = sel.map(el => JSON.parse(JSON.stringify(el)));
    const ids = new Set(sel.map(el => el.id));
    dsD().els = dsD().els.filter(el => !ids.has(el.id));
    DS_SEL.clear();
  }
  if (na) {
    EPL.borr = [...new Set([...(EPL.borr || []), ...PL_ASEL])].sort((a, b) => a - b);
    PL_ASEL.clear();
    PLH.obj = -1;
    plPreparar();
  }
  edCambio();
  const s = n => (n > 1 ? "s" : ""),
    partes = [];
  if (sel.length) partes.push(`${sel.length} elemento${s(sel.length)} del diseño`);
  if (na) partes.push(`${na} objeto${s(na)} de la arquitectura`);
  toast(
    `${partes.join(" y ")}: ${cortar && sel.length ? "cortado" : "borrado"}${s(sel.length + na)} · Ctrl+Z para deshacer${cortar && sel.length ? " · Ctrl+V para pegar" : ""}`
  );
}
$("edPropC").addEventListener("click", e => {
  if (e.target.closest("[data-pl-del]")) return edBorrar(false);
  if (e.target.closest("[data-pl-rest]")) {
    const n = (EPL.borr || []).length;
    delete EPL.borr;
    plPreparar();
    edCambio();
    return toast(`${n} objeto${n > 1 ? "s" : ""} de la arquitectura restaurado${n > 1 ? "s" : ""}`);
  }
  const b = e.target.closest("[data-pl-oc]");
  if (!b) return;
  EPL.ocultas = [...new Set([...EPL.ocultas, b.dataset.plOc])];
  PLH.obj = -1;
  plPreparar();
  edCambio();
});

/* ---------- Mouse y teclado sobre el plano ----------
   Como en los programas de dibujo: la rueda acerca y aleja; la rueda presionada (o la barra espaciadora con el botón
   izquierdo) desplaza la vista; en Seleccionar, un clic elige, arrastrar un elemento del diseño lo mueve, arrastrar
   un pinzamiento edita el elemento (vértice, curvatura del tramo, radio, línea de cota) y arrastrar sobre un lugar
   vacío hace un marco de selección (de izquierda a derecha, ventana; al revés, captura). Mayús presionada coloca y
   mueve sin enganche. Con una herramienta de dibujo, escribir un número da la longitud del tramo. */
let PL_ESPACIO = false;
// El lienzo sigue al mouse aunque salga de él mientras se arrastra (si el navegador lo permite)
const plCapturar = e => {
  try {
    plLienzo.setPointerCapture(e.pointerId);
  } catch (_) {}
};
plLienzo.addEventListener(
  "wheel",
  e => {
    if (!PL_MOD) return;
    e.preventDefault();
    const [X, Y] = plMouse(e),
      f = Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 33 : 1));
    plZoom(Math.min(4, Math.max(0.25, f)), X, Y);
  },
  { passive: false }
);
plLienzo.addEventListener("pointerdown", e => {
  if (!PL_MOD || e.target.closest(".pl-cmd, .pl-nav")) return;
  $("edRefs").hidden = true;
  const [X, Y] = plMouse(e);
  if (e.button === 1 || (e.button === 0 && (PL_ESPACIO || PLH.h === "mano"))) {
    plVistaPush(true);
    e.preventDefault();
    // Doble clic con la rueda: ajustar a la pantalla
    if (e.button === 1) {
      const t = Date.now();
      if (t - (plLienzo.ultRueda || 0) < 350) {
        plLienzo.ultRueda = 0;
        return plAjustar();
      }
      plLienzo.ultRueda = t;
    }
    PLH.pan = { X, Y, cx: PLV.cx, cy: PLV.cy, mov: false };
    plCapturar(e);
    plLienzo.classList.add("moviendo");
    return;
  }
  if (e.button !== 0) return;
  plCapturar(e);
  PLH.abajo = [X, Y];
  if (PLH.h) return;
  // Seleccionar: un pinzamiento de lo seleccionado edita; un elemento del diseño se elige y se prepara para moverlo;
  // si no, marco de selección
  const ag = dsD() && DS_SEL.size ? dsAgarreEn(X, Y) : null;
  if (ag) {
    PLH.agarre = { ...ag, orig: JSON.stringify(dsD().els.find(el => el.id === ag.id)), mov: false };
    return;
  }
  const p = plADib(X, Y),
    id = dsD() ? dsHit(p[0], p[1], (6 * plDpr()) / PLV.s) : null;
  if (id) dsPresionar(id, p, e.shiftKey);
  else PLH.marco = { X0: X, Y0: Y, X1: X, Y1: Y, mov: false, shift: e.shiftKey };
});
plLienzo.addEventListener("pointermove", e => {
  if (!PL_MOD) return;
  const [X, Y] = plMouse(e);
  if (PLH.pan) {
    PLH.pan.mov = true;
    PLV.cx = PLH.pan.cx - (X - PLH.pan.X) / PLV.s;
    PLV.cy = PLH.pan.cy + (Y - PLH.pan.Y) / PLV.s;
    plDibujar();
    return;
  }
  const p = plADib(X, Y);
  PLH.cur = p;
  PLH.libre = e.shiftKey;
  const lejos = PLH.abajo && Math.hypot(X - PLH.abajo[0], Y - PLH.abajo[1]) > 4 * plDpr();
  // Pinzamiento: la curvatura y la línea de cota siguen al cursor; lo demás se engancha
  if (PLH.agarre) {
    if (!lejos && !PLH.agarre.mov) return;
    PLH.agarre.mov = true;
    // La curvatura, la línea de cota, el giro y la letra siguen al cursor; lo demás se engancha
    PLH.eng = ["m", "o", "giro", "letra"].includes(PLH.agarre.t) ? null : plEnganche(p[0], p[1]);
    const q = plPuntoActual() || p;
    $("plXY").textContent = `X ${plFm(q[0])}   Y ${plFm(q[1])} m`;
    return dsAgarreMover(PLH.agarre, q);
  }
  const arrastre = PLH.arr && lejos;
  // El enganche actúa con las herramientas y al mover elementos (no con Longitud de objetos)
  PLH.eng = (PLH.h && PLH.h !== "obj") || arrastre || (PLH.arr && PLH.arr.mov) ? plEnganche(p[0], p[1]) : null;
  // Símbolo de pared: se encaja en el muro más cercano (sin Mayús)
  PLH.alin = PLH.h && PLH.h.startsWith("col:") && !PLH.libre ? dsAlinear(PLH.h.slice(4), p) : null;
  if (PLH.alin) PLH.eng = null;
  const q = plPuntoActual() || p;
  $("plXY").textContent = `X ${plFm(q[0])}   Y ${plFm(q[1])} m`;
  if (arrastre || (PLH.arr && PLH.arr.mov)) return dsMover(q);
  if (PLH.marco) {
    Object.assign(PLH.marco, { X1: X, Y1: Y });
    if (Math.hypot(X - PLH.marco.X0, Y - PLH.marco.Y0) > 4 * plDpr()) PLH.marco.mov = true;
    return plSobreDibujar();
  }
  if (PLH.h) return plSobreDibujar();
  // Lo que está bajo el cursor en Seleccionar: un pinzamiento, el diseño y, si no, la arquitectura
  const ag = DS_SEL.size ? dsAgarreEn(X, Y) : null,
    r = (6 * plDpr()) / PLV.s,
    id = ag ? null : dsD() ? dsHit(p[0], p[1], r) : null,
    i = id || ag || EPL.tenue ? -1 : plObjeto(p[0], p[1], (8 * plDpr()) / PLV.s);
  plLienzo.classList.toggle("sobre-dis", !!id);
  plLienzo.classList.toggle("sobre-ag", !!ag);
  const agk = ag ? `${ag.id}|${ag.t}|${ag.i}` : "",
    agk0 = PLH.agSobre ? `${PLH.agSobre.id}|${PLH.agSobre.t}|${PLH.agSobre.i}` : "";
  if (id !== PLH.dsSobre || i !== PLH.sobre || agk !== agk0) {
    PLH.dsSobre = id;
    PLH.sobre = i;
    PLH.agSobre = ag;
    plSobreDibujar();
  } else if (id && DSU.info !== false) plSobreDibujar(); // los datos siguen al cursor
});
plLienzo.addEventListener("pointerup", e => {
  if (PLH.pan) {
    PLH.pan = null;
    plLienzo.classList.remove("moviendo");
    return;
  }
  if (e.button !== 0 || !PLH.abajo) return;
  const [X, Y] = plMouse(e),
    lejos = Math.hypot(X - PLH.abajo[0], Y - PLH.abajo[1]) > 6 * plDpr();
  const abajo = PLH.abajo;
  PLH.abajo = null;
  if (PLH.agarre) {
    const ag = PLH.agarre,
      eng = PLH.eng;
    PLH.agarre = null;
    PLH.eng = null;
    if (ag.mov) dsAgarreSoltar(ag, eng);
    // Un clic (sin arrastrar) en el punto de giro: escribir el ángulo exacto
    if (!ag.mov && ag.t === "giro") return edAnguloExacto(ag.id);
    if (ag.t === "giro") plOrden();
    return ag.mov ? edCambio() : plSobreDibujar();
  }
  if (PLH.arr) return dsSoltar();
  if (PLH.marco) {
    const mc = PLH.marco;
    PLH.marco = null;
    if (mc.mov) return dsMarco(mc);
    // Clic en un lugar vacío: suelta la selección del diseño y elige la línea de la arquitectura bajo el cursor
    if (!mc.shift) DS_SEL.clear();
    return plSeleccionar(plADib(abajo[0], abajo[1]), mc.shift);
  }
  if (!PLH.h || lejos) return;
  // Un clic en el mismo punto que el anterior (doble clic) termina el recorrido, la polilínea o la tubería
  const p = plPuntoActual() || plADib(X, Y),
    u = PLH.pts[PLH.pts.length - 1];
  if (u && !PLH.med && Math.hypot(p[0] - u[0], p[1] - u[1]) * PLV.s < 3) {
    if (PLH.h === "rec") return plTerminarRecorrido();
    if (dsTerminar()) return;
  }
  if (!$("plCmdIn").hidden) return;
  if (dsEsHerr(PLH.h)) dsPunto(p);
  else plPunto(p);
});
plLienzo.addEventListener("pointerleave", () => {
  PLH.cur = PLH.eng = PLH.alin = null;
  PLH.sobre = -1;
  PLH.dsSobre = null;
  $("plXY").textContent = "";
  plSobreDibujar();
});
plLienzo.addEventListener("dblclick", e => {
  if (PLH.h === "rec") {
    e.preventDefault();
    plTerminarRecorrido();
  } else if (dsTerminar()) e.preventDefault();
  else if (!PLH.h && dsD()) {
    // Doble clic en un tablero: su ventana de circuitos
    const [X, Y] = plMouse(e),
      p = plADib(X, Y),
      id = dsHit(p[0], p[1], (6 * plDpr()) / PLV.s),
      el = id && dsD().els.find(x => x.id === id);
    if (el) el.k === "tab" ? tabAbrir(id) : elAbrir(id);
  }
});
// Herramientas que aceptan una longitud escrita (desde el último punto, en la dirección del cursor)
const PL_CON_LONG = ["dist", "rec", "lin", "pol", "rect", "cir", "tubT", "tubP", "fila"];
function plLongitudEscrita(tecla) {
  plPedir(
    PLH.h === "cir" ? "Radio (m)" : "Longitud del tramo (m)",
    tecla,
    v => {
      const L = parseFloat(String(v).replace(",", ".")),
        p = dsPuntoAdistancia(L);
      plPedir(null);
      if (!p) return toast("Escriba una longitud en metros, mayor que cero");
      if (dsEsHerr(PLH.h)) dsPunto(p);
      else plPunto(p);
    },
    true
  );
}
addEventListener("keydown", e => {
  if (!ED.abierto || document.querySelector(".welcome:not([hidden])")) return;
  const k = e.key.toLowerCase(),
    ctrl = e.ctrlKey || e.metaKey,
    // Un campo de una ventana ya cerrada (oculto) no cuenta: las teclas vuelven al plano
    enCampo =
      /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.offsetParent !== null;
  // Deshacer y rehacer del editor (el del proyecto no actúa mientras el editor está abierto)
  if (ctrl && (k === "z" || k === "y")) {
    if (enCampo) return;
    e.preventDefault();
    return edHist(k === "y" || e.shiftKey ? 1 : -1);
  }
  if (enCampo) return;
  if (ctrl && k === "f" && PL_MOD) {
    e.preventDefault();
    return buAbrir();
  }
  if (ctrl && k === "x") {
    if (!PL_MOD) return;
    e.preventDefault();
    return edBorrar(true);
  }
  if (ctrl && (k === "a" || k === "c" || k === "v")) {
    if (!dsD() || !PL_MOD) return;
    e.preventDefault();
    return k === "a" ? dsTodo() : k === "c" ? dsCopiar() : dsPegar();
  }
  // Comandos escritos: una letra (sin herramienta) abre la línea de comandos; R con selección gira y B abre la
  // biblioteca, como siempre
  if (
    /^[a-zA-Z]$/.test(e.key) &&
    !ctrl &&
    !e.altKey &&
    !PLH.h &&
    PL_MOD &&
    $("plCmdIn").hidden &&
    !(k === "r" && DS_SEL.size) &&
    k !== "b"
  ) {
    e.preventDefault();
    return edComando(e.key);
  }
  if (e.key === "Enter" && !PLH.h && ED.ultCmd && PL_MOD && $("plCmdIn").hidden) {
    e.preventDefault();
    return edEjecutar(ED.ultCmd);
  }
  // Longitud escrita con el teclado mientras se dibuja o se mide
  if (
    /^[0-9.,]$/.test(e.key) &&
    !ctrl &&
    PL_CON_LONG.includes(PLH.h) &&
    PLH.pts.length &&
    !PLH.med &&
    $("plCmdIn").hidden
  ) {
    e.preventDefault();
    return plLongitudEscrita(e.key === "," ? "0." : e.key === "." ? "0." : e.key);
  }
  if (e.key === " " && !PL_ESPACIO) {
    e.preventDefault();
    PL_ESPACIO = true;
    plLienzo.classList.add("mano");
  } else if (e.key === "Escape") {
    e.preventDefault();
    $("edRefs").hidden = true;
    if ($("editor").classList.contains("ed-pres")) return edPresentar(false);
    // Con un recorrido, polilínea o tubería en curso, Esc la termina; con otra herramienta, sale de ella; si no,
    // suelta la selección
    if (PLH.h === "rec" && !PLH.med && PLH.pts.length > 1) return plTerminarRecorrido();
    if (dsTerminar()) return;
    if (DP_COMP && !PLH.h) {
      DP_COMP = null;
      return plSobreDibujar();
    }
    if (PLH.h) return plHerr(null);
    if (DS_SEL.size || PLH.obj >= 0 || PL_ASEL.size) {
      DS_SEL.clear();
      PL_ASEL.clear();
      PLH.obj = -1;
      edProps();
      plSobreDibujar();
    }
  } else if (e.key === "Enter" && (PLH.h === "rec" || dsEsHerr(PLH.h))) {
    e.preventDefault();
    if (PLH.h === "rec") plTerminarRecorrido();
    else dsTerminar();
  } else if (e.key === "Delete" || e.key === "Supr") {
    e.preventDefault();
    edBorrar(false);
  } else if (k === "b" && !ctrl && !e.altKey && PL_MOD) {
    e.preventDefault();
    bibAbrir();
  } else if (k === "r" && !ctrl && dsD()) {
    e.preventDefault();
    dsGirar();
  } else if (k === "f" && !ctrl && dsEsTub(PLH.h)) {
    // Invierte el lado de la curva del tramo siguiente
    e.preventDefault();
    PLH.lado = -(PLH.lado || 1);
    plSobreDibujar();
  } else if (k === "c" && !ctrl && dsEsTub(PLH.h)) {
    e.preventDefault();
    DSU.curva = !DSU.curva;
    dsGuardarPref();
    dsCinta();
    plOrden();
    plSobreDibujar();
    toast(DSU.curva ? "Tramos curvos" : "Tramos rectos");
  } else if (e.key.startsWith("Arrow") && !PLH.h && DS_SEL.size) {
    e.preventDefault();
    const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0,
      dy = e.key === "ArrowDown" ? -1 : e.key === "ArrowUp" ? 1 : 0;
    dsEmpujar(dx, dy, e.shiftKey);
  } else if (e.key === "F3" || e.key === "F8") {
    e.preventDefault();
    edAlternar(e.key === "F3" ? "plSnap" : "plOrto");
  } else if (e.key === "F1" && ctrl) {
    e.preventDefault();
    edCinta(true);
  } else if (e.key === "F10") {
    e.preventDefault();
    dsAlternarRejilla("polar", true);
  } else if (e.key === "F7" || e.key === "F9") {
    e.preventDefault();
    dsAlternarRejilla(e.key === "F7" ? "rej" : "forz", true);
  }
});
addEventListener("keyup", e => {
  if (e.key === " ") {
    PL_ESPACIO = false;
    plLienzo.classList.remove("mano");
  }
});
new ResizeObserver(() => {
  if (ED.abierto && plTam()) plDibujar();
}).observe(plLienzo);
// Arrastrar un archivo DXF sobre el editor
["dragover", "drop"].forEach(t =>
  $("editor").addEventListener(t, e => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    if (t === "drop") plAbrir(e.dataTransfer.files[0]);
  })
);
// Ventanita de enganches: se abre con ▾ (barra de estado), con Puntos de enganche (cinta Medir) o con clic derecho
// en ENGANCHE, junto al botón; se cierra al hacer clic fuera
function edRefsAbrir(b, abrir = true) {
  const v = $("edRefs");
  v.hidden = !abrir;
  if (!abrir) return;
  const ed = $("editor").getBoundingClientRect(),
    r = b.getBoundingClientRect(),
    S = parseFloat(getComputedStyle($("ws")).zoom) || 1;
  if (b.closest(".ed-estado")) Object.assign(v.style, { top: "", left: "", right: "", bottom: "" });
  else
    Object.assign(v.style, {
      top: (r.bottom - ed.top) / S + 4 + "px",
      left: Math.max(4, (r.left - ed.left) / S) + "px",
      right: "auto",
      bottom: "auto"
    });
}
document.querySelector('#editor [data-edtg="plSnap"]').addEventListener("contextmenu", e => {
  e.preventDefault();
  edRefsAbrir(e.currentTarget);
});
$("editor").addEventListener("click", e => {
  const br = e.target.closest("[data-edrefs]");
  if (br) {
    edRefsAbrir(br, $("edRefs").hidden);
    return;
  }
  if (!e.target.closest("#edRefs")) $("edRefs").hidden = true;
  if (!e.target.closest('#edFondo, [data-pl="fondo"]')) $("edFondo").hidden = true;
  if (!e.target.closest('#edBuscar, [data-pl="buscar"]')) $("edBuscar").hidden = true;
});
// Enganche y orto: casilla en la cinta (Medir) y botón en la barra de estado, siempre iguales
function edAlternar(id, aviso = true) {
  const c = $(id);
  c.checked = !c.checked;
  edBotonesEstado();
  if (aviso) toast(`${id === "plSnap" ? "Enganche" : "Orto"} ${c.checked ? "activado" : "desactivado"}`);
  plSobreDibujar();
}
function edBotonesEstado() {
  if (typeof dsCinta === "function") dsCinta();
}
["plSnap", "plOrto"].forEach(id =>
  $(id).addEventListener("change", () => {
    edBotonesEstado();
    plSobreDibujar();
  })
);

/* ---------- Panel izquierdo: plantas y resumen del diseño (las capas están en su ventana, js/capas.js) ---------- */
function plPanel() {
  const m = PL_MOD;
  $("plLado").hidden = plPanel.oculto;
  $("edProp").hidden = edProps.oculto;
  dsResumen();
  if (!m || !EPL) {
    $("plNPl").textContent = "";
    $("plPlantas").innerHTML = "";
    return;
  }
  const P = EPL.plantas;
  $("plNPl").textContent = P.length || "";
  $("plPlantas").innerHTML = P.length
    ? P.map(
        (p, i) =>
          `<div class="pl-fila" data-plp="${i}"><button type="button" class="pl-nom" data-plv="${i}" title="Ver la planta">${esc(p.n)}</button><span class="pl-dim">${(n => (n ? n + " elem. · " : ""))(dsD() ? dsD().els.filter(el => dpPlantaEl(el) === i).length : 0)}${plFm(p.x1 - p.x0)} × ${plFm(p.y1 - p.y0)} m</span><button type="button" class="pl-x" data-plq="${i}" title="Quitar la planta (el dibujo no cambia)" aria-label="Quitar la planta">×</button></div>`
      ).join("")
    : `<p class="pl-nota">Encuadre cada planta del edificio con <b>Encuadrar planta</b>: así se ve con un clic.</p>`;
}
$("plLado").addEventListener("click", e => {
  const v = e.target.closest("[data-plv]"),
    q = e.target.closest("[data-plq]");
  if (v) {
    const p = EPL.plantas[+v.dataset.plv];
    plVer(p.x0, p.y0, p.x1, p.y1);
  } else if (q) {
    const i = +q.dataset.plq;
    confirmar(
      "¿Quitar la planta?",
      `<p>Se quita el encuadre <b>${esc(EPL.plantas[i].n)}</b>. El plano de arquitectura no cambia y puede volver a encuadrarla.</p>`,
      "Quitar",
      ok => {
        if (!ok) return;
        EPL.plantas.splice(i, 1);
        edCambio();
      }
    );
  }
});

/* ---------- Mostrar el editor ---------- */
function plMostrar() {
  const m = PL_MOD,
    hay = !!EPL;
  $("plVacio").hidden = !!(m && hay);
  if (!(m && hay)) {
    $("plVacioT").innerHTML = hay
      ? `El plano <b>${esc(EPL.nombre)}</b> no está guardado en este navegador`
      : "Abra el plano de arquitectura en DXF";
    $("plVacioS").innerHTML = hay
      ? "Ábralo de nuevo para continuar: se conservan la escala, las capas ocultas y las plantas del proyecto."
      : "Desde AutoCAD o cualquier programa de dibujo, con sus medidas reales. También puede arrastrar el archivo aquí.";
  }
  document.querySelectorAll("#editor [data-pl-req]").forEach(b => (b.disabled = !(m && hay)));
  $("plTenue").checked = !!(EPL && EPL.tenue);
  const u = $("plUnidad");
  u.disabled = !(m && hay);
  if (EPL) {
    const o = [...u.options].find(x => Math.abs(+x.value - EPL.f) < 1e-12);
    if (o) u.value = o.value;
    else {
      u.options[3].hidden = false;
      u.options[3].textContent = `1 u = ${fmt(EPL.f, EPL.f < 0.01 ? 4 : 3)} m`;
      u.value = "x";
    }
  }
  $("plEstadoU").textContent = EPL ? `Unidad: ${plNomUnidad(EPL.f)} · ${PL_DE[EPL.de] || ""}` : "";
  $("plEstadoA").textContent =
    m && hay ? `${EPL.nombre} · ${Object.keys(m.capas).length} capas · ${m.nEnt.toLocaleString("es-PE")} objetos` : "";
  edBotonesEstado();
  dsCinta();
  plPanel();
  edProps();
  if (ED.abierto) {
    plTam();
    plDibujar();
  }
}
/* ---------- Cinta plegable: más espacio de trabajo (botón ⌃, Ctrl+F1 o doble clic en una pestaña) ---------- */
function edCinta(alternar) {
  if (alternar) {
    DSU.cintaMin = !DSU.cintaMin;
    dsGuardarPref();
  }
  $("editor").classList.toggle("ed-min", !!DSU.cintaMin);
  if (alternar) toast(DSU.cintaMin ? "Cinta oculta: clic en una pestaña para verla de nuevo" : "Cinta visible");
}
$("editor").addEventListener("dblclick", e => {
  if (e.target.closest("[data-tab-e]")) edCinta(true);
});
document.querySelector("#editor [data-edplegar]").addEventListener("click", () => edCinta(true));

/* ---------- Barra de navegación sobre el plano: visible, orientación y posición (preferencias del usuario) ---------- */
function plNavPoner() {
  const n = $("plNav"),
    p = DSU.navPos;
  n.hidden = DSU.nav === false;
  n.classList.toggle("horiz", !!DSU.navH);
  n.classList.toggle("libre", !!p);
  if (p) {
    const W = plLienzo.clientWidth,
      H = plLienzo.clientHeight,
      w = n.offsetWidth,
      h = n.offsetHeight;
    n.style.left = Math.max(2, Math.min(W - w - 2, p[0] * W)) + "px";
    n.style.top = Math.max(2, Math.min(H - h - 2, p[1] * H)) + "px";
    n.style.right = "auto";
  } else n.style.left = n.style.top = n.style.right = "";
}
$("plNav").addEventListener("click", e => {
  const b = e.target.closest("[data-navg]");
  if (!b) return;
  if (b.dataset.navg === "ocultar") {
    DSU.nav = false;
    toast("Barra de navegación oculta: se vuelve a mostrar en Vista › Barra de navegación");
  } else DSU.navH = !DSU.navH;
  dsGuardarPref();
  dsCinta();
  plNavPoner();
});
{
  const asa = document.querySelector("#plNav .pl-nav-asa");
  asa.addEventListener("pointerdown", e => {
    e.preventDefault();
    e.stopPropagation();
    const n = $("plNav"),
      S = parseFloat(getComputedStyle($("ws")).zoom) || 1,
      r0 = n.getBoundingClientRect(),
      dx = (e.clientX - r0.left) / S,
      dy = (e.clientY - r0.top) / S;
    try {
      asa.setPointerCapture(e.pointerId);
    } catch (_) {}
    n.classList.add("drag");
    const mv = ev => {
      const r = plLienzo.getBoundingClientRect();
      DSU.navPos = [
        ((ev.clientX - r.left) / S - dx) / plLienzo.clientWidth,
        ((ev.clientY - r.top) / S - dy) / plLienzo.clientHeight
      ];
      plNavPoner();
    };
    const up = () => {
      n.classList.remove("drag");
      removeEventListener("pointermove", mv);
      removeEventListener("pointerup", up);
      dsGuardarPref();
    };
    addEventListener("pointermove", mv);
    addEventListener("pointerup", up);
  });
  asa.addEventListener("dblclick", () => {
    DSU.navPos = null;
    dsGuardarPref();
    plNavPoner();
  });
}
new ResizeObserver(() => ED.abierto && plNavPoner()).observe(plLienzo);

/* ---------- Comandos por teclado ----------
   Como la línea de comandos de AutoCAD: se escribe el comando y se pulsa Intro; Intro sin herramienta repite el
   último. Los nombres van en español (y algunos como en AutoCAD). */
const ED_CMD = {
  L: ["lin", "Línea"],
  LINEA: ["lin", "Línea"],
  PL: ["pol", "Polilínea"],
  REC: ["rect", "Rectángulo"],
  CI: ["cir", "Círculo"],
  T: ["tubT", "Tubería en techo o pared"],
  TT: ["tubT", "Tubería en techo o pared"],
  TP: ["tubP", "Tubería en piso"],
  TX: ["txt", "Texto"],
  CA: ["cotA", "Cota alineada"],
  CL: ["cotL", "Cota lineal"],
  D: ["dir", "Directriz"],
  LE: ["ley", "Leyenda"],
  CO: ["duplicar", "Duplicar lo elegido"],
  GI: ["girar", "Girar lo elegido"],
  ES: ["espejo", "Espejo"],
  MI: ["espejo", "Espejo"],
  FI: ["fila", "Copiar en fila"],
  AR: ["fila", "Copiar en fila"],
  E: ["borrar", "Borrar lo elegido"],
  SU: ["borrar", "Borrar lo elegido"],
  Z: ["ajustar", "Ajustar a la pantalla"],
  ZV: ["zventana", "Zoom ventana"],
  ZA: ["zprev", "Vista anterior"],
  M: ["mano", "Mano"],
  P: ["mano", "Mano"],
  CAP: ["capas", "Capas"],
  DI: ["dist", "Distancia"],
  ME: ["rec", "Medir recorrido"],
  REV: ["revisar", "Revisar diseño"],
  RE: ["revisar", "Revisar diseño"],
  TA: ["col:tab", "Tablero"],
  LU: ["col:luz", "Salida de alumbrado"],
  TO: ["col:toma", "Tomacorriente"],
  IN: ["col:int", "Interruptor"],
  BL: ["bloque", "Guardar como bloque"],
  RU: ["ruta", "Ruta automática"],
  VE: ["versiones", "Versiones"],
  PLA: ["plantillas", "Plantillas"],
  BU: ["buscar", "Buscar en el plano"],
  MET: ["metrado", "Metrado del diseño"],
  CU: ["cua", "Cuadro de circuitos"],
  PRE: ["presentar", "Presentación"]
};
function edComando(letra) {
  plPedir(
    "Comando",
    letra,
    v => {
      plPedir(null);
      edEjecutar(String(v).trim().toUpperCase());
    },
    true
  );
  plOrden(
    `<b>Comandos</b> · L línea · T tubería · TP en piso · TX texto · CA cota · LE leyenda · CO duplicar · GI girar · ES espejo · FI en fila · E borrar · Z ajustar · ZV zoom ventana · M mano · REV revisar · Intro repite el último`
  );
}
function edEjecutar(c) {
  const u = atjUsuario()[c],
    x = u ? ED_CMD[u] || Object.values(ED_CMD).find(v => v[0] === u) : ED_CMD[c];
  if (!x) {
    plOrden();
    return toast(`Comando «${c}» desconocido · pruebe: ${Object.keys(ED_CMD).slice(0, 14).join(", ")}…`);
  }
  ED.ultCmd = c;
  const a = x[0];
  if (a === "duplicar") {
    if (!DS_SEL.size) return toast("Elija primero lo que quiere duplicar");
    dsCopiar();
    return dsPegar();
  }
  if (a === "girar") return dsGirar();
  if (a === "borrar") return edBorrar(false);
  if (a === "fila" || a === "espejo") return dsIniciarCopia(a);
  if (a === "ajustar") return plAjustar();
  if (a === "zprev") return plVistaAnterior();
  if (a === "capas") return capasAbrir();
  if (a === "revisar") return revAbrir();
  if (a === "bloque") return dpGuardarBloque();
  if (a === "ruta") return dpRuta();
  if (a === "versiones") return verAbrir();
  if (a === "plantillas") return plaAbrir();
  if (a === "buscar") return buAbrir();
  if (a === "metrado") return metAbrir();
  if (a === "presentar") return edPresentar(true);
  if (a.startsWith("col:") || DS_HERR[a]) DS_SEL.clear();
  plHerr(a);
  toast(x[1]);
}

/* ---------- Atajos de teclado: comandos de la plataforma y los del usuario (como el archivo de alias de AutoCAD) ---------- */
const ATJ_K = (BETA ? "jmg-electric-beta" : "jmg-electric") + "-atajos";
function atjUsuario() {
  try {
    const o = JSON.parse(localStorage.getItem(ATJ_K) || "{}");
    return o && typeof o === "object" ? o : {};
  } catch (e) {
    return {};
  }
}
function atjAbrir() {
  $("atjDlg").hidden = false;
  vwFondo();
  atjRender();
}
function atjCerrar() {
  $("atjDlg").hidden = true;
  vwFondo();
}
function atjRender() {
  const U = atjUsuario(),
    acciones = new Map();
  Object.entries(ED_CMD).forEach(([k, [a, n]]) => {
    if (!acciones.has(a)) acciones.set(a, { n, k: [] });
    acciones.get(a).k.push(k);
  });
  $("atjLista").innerHTML =
    `<table class="atj-t"><thead><tr><th>Comando</th><th>De la plataforma</th><th>Los suyos (separados por coma)</th></tr></thead><tbody>${[
      ...acciones
    ]
      .map(
        ([a, o]) =>
          `<tr><td>${esc(o.n)}</td><td class="atj-k">${o.k.join(", ")}</td><td><input type="text" data-atj-a="${esc(a)}" value="${esc(
            Object.keys(U)
              .filter(k => U[k] === a)
              .join(", ")
          )}" maxlength="40" spellcheck="false"></td></tr>`
      )
      .join("")}</tbody></table>` +
    `<p class="pl-nota">Teclas de siempre: <b>R</b> girar · <b>B</b> biblioteca · <b>Supr</b> borrar · <b>Ctrl+C/V/X/Z/Y</b> · <b>Ctrl+F</b> buscar · <b>F3</b> enganche · <b>F7</b> rejilla · <b>F8</b> orto · <b>F9</b> forzar · <b>F10</b> polar · <b>Ctrl+F1</b> cinta.</p>`;
}
$("atjDlg").addEventListener("change", e => {
  const i = e.target.closest("[data-atj-a]");
  if (!i) return;
  const a = i.dataset.atjA,
    U = atjUsuario();
  Object.keys(U).forEach(k => U[k] === a && delete U[k]);
  i.value
    .toUpperCase()
    .split(/[\s,;]+/)
    .map(k => k.replace(/[^A-ZÑ0-9]/g, "").slice(0, 6))
    .filter(k => k && /^[A-ZÑ]/.test(k))
    .forEach(k => (U[k] = a));
  try {
    localStorage.setItem(ATJ_K, JSON.stringify(U));
  } catch (er) {}
  atjRender();
  toast("Atajos guardados");
});
$("atjDlg").addEventListener("click", e => {
  if (e.target.id === "atjDlg") return atjCerrar();
  const b = e.target.closest("[data-atj]");
  if (!b) return;
  if (b.dataset.atj === "cerrar") atjCerrar();
  else if (b.dataset.atj === "restablecer") {
    try {
      localStorage.removeItem(ATJ_K);
    } catch (er) {}
    atjRender();
  }
});
$("atjDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    atjCerrar();
  }
  e.stopPropagation();
});

/* ---------- Buscar en el plano (Ctrl+F): circuitos, tableros, artefactos y textos del diseño y del plano ---------- */
let BU_L = [];
function buAbrir() {
  if (!EPL || !PL_MOD) return;
  $("edBuscar").hidden = false;
  $("buQ").value = "";
  buRender();
  setTimeout(() => $("buQ").focus(), 20);
}
function buCerrar() {
  $("edBuscar").hidden = true;
  $("buQ").blur();
}
function buRender() {
  const q = biNorm($("buQ").value.trim()),
    D = dsD(),
    out = [];
  if (q) {
    // Circuitos (con su tablero)
    const cirs = new Map();
    D.els.forEach(e => {
      if (!e.cir) return;
      const tb = e.tab && D.els.find(x => x.id === e.tab),
        k = e.cir + "|" + (e.tab || "");
      if (!cirs.has(k)) cirs.set(k, { n: `Circuito ${e.cir}${tb ? " · " + (tb.nom || "tablero") : ""}`, ids: [] });
      cirs.get(k).ids.push(e.id);
    });
    cirs.forEach(c => biNorm(c.n).includes(q) && out.push({ t: c.n, d: `${c.ids.length} elementos`, ids: c.ids }));
    // Tableros, artefactos y textos del diseño
    const porTipo = new Map();
    D.els.forEach(e => {
      if (e.k === "tab" && biNorm(`tablero ${e.nom || ""}`).includes(q))
        out.push({ t: `Tablero ${e.nom || ""}`, d: `${e.nc || 0} circuitos`, ids: [e.id] });
      else if (e.t === "sim" && DS_CAT[e.k] && biNorm(`${DS_CAT[e.k].n} ${DS_CAT[e.k].c}`).includes(q)) {
        const k = e.k;
        if (!porTipo.has(k)) porTipo.set(k, []);
        porTipo.get(k).push(e.id);
      } else if ((e.t === "txt" || e.t === "dir") && biNorm(e.s || "").includes(q))
        out.push({ t: e.s, d: e.t === "txt" ? "texto" : "directriz", ids: [e.id] });
    });
    porTipo.forEach((ids, k) => out.push({ t: DS_CAT[k].n, d: `${ids.length} en el diseño`, ids }));
    // Textos del plano de arquitectura (ambientes, por ejemplo)
    const oc = new Set(EPL.ocultas);
    PL_MOD.textos.forEach(t => {
      if (out.length < 60 && !oc.has(t.capa) && !PL_BORR.has(t.e) && biNorm(t.s).includes(q))
        out.push({ t: t.s.replace(/\n/g, " "), d: "plano", pt: [t.x, t.y] });
    });
  }
  BU_L = out.slice(0, 60);
  $("buRes").innerHTML = !q
    ? "<p>Escriba un circuito (C-3), un tablero, un artefacto o el nombre de un ambiente.</p>"
    : BU_L.length
      ? BU_L.map(
          (o, i) =>
            `<button type="button" data-bu="${i}"${i ? "" : ' class="on"'}><span>${esc(o.t)}</span><small>${esc(o.d)}</small></button>`
        ).join("")
      : "<p>Nada coincide.</p>";
}
function buIr(i) {
  const o = BU_L[i];
  if (!o) return;
  buCerrar();
  DS_SEL.clear();
  PL_ASEL.clear();
  if (o.pt) {
    const m = 3 / EPL.f;
    plVer(o.pt[0] - m, o.pt[1] - m, o.pt[0] + m, o.pt[1] + m);
  } else {
    o.ids.forEach(id => DS_SEL.add(id));
    const bb = dsSel().map(dsBBox),
      x0 = Math.min(...bb.map(b => b[0])),
      y0 = Math.min(...bb.map(b => b[1])),
      x1 = Math.max(...bb.map(b => b[2])),
      y1 = Math.max(...bb.map(b => b[3])),
      m = Math.max(x1 - x0, y1 - y0, 3 / EPL.f) * 0.3;
    plVer(x0 - m, y0 - m, x1 + m, y1 + m);
  }
  edProps();
  plSobreDibujar();
}
$("buQ").addEventListener("input", buRender);
$("buQ").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    buCerrar();
  } else if (e.key === "Enter") {
    e.preventDefault();
    buIr(0);
  }
  e.stopPropagation();
});
$("buRes").addEventListener("click", e => {
  const b = e.target.closest("[data-bu]");
  if (b) buIr(+b.dataset.bu);
});

/* ---------- Modo presentación: pantalla completa, solo el plano (Esc para salir) ---------- */
function edPresentar(on) {
  $("editor").classList.toggle("ed-pres", on);
  if (on) {
    toast("Presentación: Esc para salir");
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  } else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  plTam();
  plDibujar();
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && $("editor").classList.contains("ed-pres")) edPresentar(false);
});

/* ---------- Autoguardado del editor ----------
   Cada 30 s, si hay cambios sin aplicar, se guarda una copia en este navegador; al volver a abrir el editor del
   mismo proyecto (por ejemplo, después de cerrarse el navegador), se ofrece recuperarla. */
const ED_REC = (BETA ? "jmg-electric-beta" : "jmg-electric") + "-editor-recuperacion";
function edAutoguardar(forzar) {
  if (!ED.abierto || !EPL) return;
  const t = Date.now();
  if (!forzar && t - (ED.recT || 0) < 30000) return;
  ED.recT = t;
  const s = edSnap();
  try {
    if (s === ED.base) localStorage.removeItem(ED_REC);
    else localStorage.setItem(ED_REC, JSON.stringify({ f: t, p: $("p_nombre").value.trim(), s }));
  } catch (e) {}
}
setInterval(() => edAutoguardar(true), 30000);
addEventListener("pagehide", () => edAutoguardar(true));
function edRecuperar() {
  let r = null;
  try {
    r = JSON.parse(localStorage.getItem(ED_REC) || "null");
  } catch (e) {}
  if (!r || r.f >= (ED.t0 || 0) || r.p !== $("p_nombre").value.trim() || r.s === ED.base) return;
  const f = new Date(r.f);
  confirmar(
    "¿Recuperar el diseño sin aplicar?",
    `<p>Hay cambios del editor de este proyecto del <b>${f.toLocaleDateString("es-PE")} a las ${f.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</b> que no se aplicaron (por ejemplo, porque se cerró el navegador).</p><p>¿Quiere recuperarlos? Luego pulse <b>Aplicar</b> para pasarlos al proyecto.</p>`,
    "Recuperar",
    ok => {
      try {
        localStorage.removeItem(ED_REC);
      } catch (e) {}
      if (!ok) return;
      EPL = JSON.parse(r.s);
      dsAsegurar();
      if (EPL && (PL_SHA !== EPL.sha || !PL_MOD)) plCargarGuardado();
      else plPreparar();
      edCambio();
      toast("Diseño recuperado · pulse Aplicar para pasarlo al proyecto");
    }
  );
}

/* ---------- Menú del clic derecho sobre el plano ----------
   Sobre un elemento del diseño lo elige (si no estaba elegido) y muestra lo que se puede hacer con lo elegido;
   sobre la arquitectura, borrar, ocultar o aislar su capa; en un lugar vacío, pegar, seleccionar todo y la vista.
   Con una herramienta en curso: terminar o cancelar. */
const ED_MENU = $("edMenu");
function edMenuAbrir(e) {
  const [X, Y] = plMouse(e),
    p = plADib(X, Y),
    D = dsD();
  ED_MENU.p = p;
  if (!PLH.h && D) {
    const id = dsHit(p[0], p[1], (6 * plDpr()) / PLV.s);
    if (id && !DS_SEL.has(id)) {
      DS_SEL.clear();
      PL_ASEL.clear();
      DS_SEL.add(id);
    } else if (!id && !DS_SEL.size && !EPL.tenue) {
      // Sobre la arquitectura: si el objeto ya estaba elegido se conserva la selección; si no, se elige solo
      const i = plObjeto(p[0], p[1], (8 * plDpr()) / PLV.s);
      if (i < 0 || !PL_ASEL.has(PL_MOD.trazos[i].e)) plSeleccionar(p, false);
    }
    edProps();
    plSobreDibujar();
  }
  const sel = D ? dsSel().filter(dsEditable) : [],
    na = PL_ASEL.size,
    it = [];
  const b = (a, t, k, on = true) =>
      it.push(
        `<button type="button" data-edm="${a}" role="menuitem"${on ? "" : " disabled"}><span>${t}</span>${k ? `<kbd>${k}</kbd>` : ""}</button>`
      ),
    sep = () => it.length && !/<hr>$/.test(it[it.length - 1]) && it.push("<hr>"),
    tit = t => it.push(`<div class="ed-mt">${t}</div>`);
  if (PLH.h) {
    b("terminar", "Terminar", "Intro", PLH.pts.length > 1 || PLH.h === "rec");
    b("cancelar", "Cancelar la herramienta", "Esc");
    if (PLH.h.startsWith("col:")) b("girar", `Girar ${DSU.giro || 90}° a la izquierda`, "R");
  } else if (sel.length) {
    tit(sel.length > 1 ? `${sel.length} elementos del diseño` : dsNomEl(sel[0]));
    b("copiar", "Copiar", "Ctrl+C");
    b("cortar", "Cortar", "Ctrl+X");
    b("pegar", "Pegar", "Ctrl+V", DS_PORTA.length > 0);
    b("duplicar", "Duplicar");
    b("fila", "Copiar en fila…");
    b("espejo", "Espejo…");
    b("borrar", "Borrar", "Supr");
    sep();
    b("girar", `Girar ${DSU.giro || 90}° a la izquierda`, "R");
    b("g-90", "Girar 90° a la derecha");
    b("g180", "Girar 180°");
    b("gang", "Girar un ángulo…");
    if (sel.length === 1 && (sel[0].t === "sim" || sel[0].t === "txt"))
      b("gexacto", `Ángulo exacto… (ahora ${+(sel[0].r || 0).toFixed(1)}°)`);
    sep();
    if (sel.some(dsConEnc)) b("enc", "Letra de encendido (a, b, c…)…");
    if (sel.some(el => el.dt)) b("letra0", "Letra a su lugar");
    if (sel.some(el => el.col)) b("colcapa", "Quitar el color propio");
    b(
      "acapa",
      `Pasar a la capa actual (${esc(D.actual)})`,
      "",
      sel.some(el => el.capa !== D.actual)
    );
    if (sel.filter(dsConecta).length >= (sel.some(el => el.k === "tab") ? 1 : 2))
      b("ruta", "Unir con tuberías (ruta automática)");
    b("bloque", "Guardar como bloque…");
    if (EPL.plantas.length > 1) b("aplanta", "Copiar a otra planta…");
    if (sel.length === 1 && DP_PAR[sel[0].k] && EPL.plantas.length > 1) b("montante", "Crear montante a otra planta…");
    if (sel.length === 1 && sel[0].mon) b("irmon", "Ir al otro extremo del montante");
    b("similares", "Seleccionar todos los de este tipo");
    b("encuadrar", "Acercar a lo elegido");
    if (sel.length === 1 && sel[0].k === "tab") b("tablero", "Circuitos del tablero…");
    if (sel.length === 1) b("ventana", "Propiedades…", "doble clic");
    if (na) {
      sep();
      b("borrarArq", `Borrar también ${na} objeto${na > 1 ? "s" : ""} de la arquitectura`);
    }
  } else if (na) {
    const t = PLH.obj >= 0 ? PL_MOD.trazos[PLH.obj] : null;
    tit(`Arquitectura · ${na} objeto${na > 1 ? "s" : ""}`);
    b("borrar", "Borrar (se oculta; el DXF no cambia)", "Supr");
    if (t) {
      b("ocultar", `Ocultar la capa ${esc(t.capa)}`);
      b("aislar", `Aislar la capa ${esc(t.capa)}`);
    }
    b("soltar", "Soltar la selección", "Esc");
  } else {
    b("pegar", "Pegar", "Ctrl+V", DS_PORTA.length > 0);
    b("todo", "Seleccionar todo el diseño", "Ctrl+A", !!(D && D.els.length));
    b("biblio", "Biblioteca de símbolos…", "B");
    b("ley", "Insertar la leyenda aquí", "", !!(D && D.els.length));
    sep();
    b("ajustar", "Ajustar a la pantalla");
    if (EPL.ocultas.length) b("mostrar", "Mostrar todas las capas");
    if (PL_BORR.size)
      b(
        "restaurar",
        `Restaurar ${PL_BORR.size} objeto${PL_BORR.size > 1 ? "s" : ""} borrado${PL_BORR.size > 1 ? "s" : ""}`
      );
  }
  ED_MENU.innerHTML = it.join("");
  ED_MENU.hidden = false;
  // Junto al cursor y dentro del editor (la escala del espacio de trabajo cambia el tamaño en pantalla)
  const ed = $("editor").getBoundingClientRect(),
    S = parseFloat(getComputedStyle($("ws")).zoom) || 1,
    w = ED_MENU.offsetWidth,
    h = ED_MENU.offsetHeight,
    x = (e.clientX - ed.left) / S,
    y = (e.clientY - ed.top) / S;
  ED_MENU.style.left = Math.max(2, Math.min(x, ed.width / S - w - 4)) + "px";
  ED_MENU.style.top = Math.max(2, y + h > ed.height / S - 4 ? y - h : y) + "px";
}
const edMenuCerrar = () => {
  ED_MENU.hidden = true;
  ED_MENU.fn = null;
};
// Posición del menú: junto a un punto de la pantalla y dentro del editor
function edMenuPos(cx, cy) {
  const ed = $("editor").getBoundingClientRect(),
    S = parseFloat(getComputedStyle($("ws")).zoom) || 1,
    w = ED_MENU.offsetWidth,
    h = ED_MENU.offsetHeight,
    x = (cx - ed.left) / S,
    y = (cy - ed.top) / S;
  ED_MENU.style.left = Math.max(2, Math.min(x, ed.width / S - w - 4)) + "px";
  ED_MENU.style.top = Math.max(2, y + h > ed.height / S - 4 ? y - h : y) + "px";
}
// Menú con opciones propias junto a un punto del dibujo; fn recibe el número de la opción elegida (data-edm="sal:n")
function edMenuLista(p, html, fn, fnCambio) {
  ED_MENU.fnCambio = fnCambio || null;
  ED_MENU.innerHTML = html;
  ED_MENU.hidden = false;
  const [X, Y] = plAPant(p[0], p[1]),
    r = plBase.getBoundingClientRect();
  edMenuPos(r.left + (X * r.width) / plBase.width + 8, r.top + (Y * r.height) / plBase.height + 8);
  ED_MENU.fn = fn;
}
// Ángulo exacto de un símbolo o texto: se escribe en la línea de comandos (0° a 360°, antihorario)
function edAnguloExacto(id) {
  const el = dsD() && dsD().els.find(e => e.id === id);
  if (!el || (el.t !== "sim" && el.t !== "txt")) return;
  plOrden(
    '<b>Ángulo exacto</b> · escriba el ángulo y pulse Intro (positivo: antihorario) · <span class="pl-k">Esc</span> cancela'
  );
  plPedir("Ángulo de giro (°)", String(+(el.r || 0).toFixed(2)), v => {
    const g = parseFloat(String(v).replace(",", "."));
    plPedir(null);
    plOrden();
    if (!Number.isFinite(g)) return toast("Escriba el ángulo en grados, por ejemplo 45");
    el.r = Math.round((((g % 360) + 360) % 360) * 100) / 100;
    edCambio();
    toast(`Girado a ${+el.r.toFixed(2)}°`);
  });
}
// Nombre de un elemento del diseño para el título del menú
const dsNomEl = el =>
  el.t === "sim"
    ? esc(DS_CAT[el.k] ? DS_CAT[el.k].n : el.k)
    : { tub: "Tubería", lin: "Línea", txt: "Texto", cir: "Círculo", cot: "Cota", dir: "Directriz" }[el.t] || "Elemento";
function edMenuAccion(a) {
  const fn = ED_MENU.fn;
  edMenuCerrar();
  if (a.startsWith("sal:")) return fn && fn(+a.slice(4));
  if (a.startsWith("tablero:")) return tabAbrir(a.slice(8));
  const sel = dsD() ? dsSel().filter(dsEditable) : [];
  if (a === "terminar") return PLH.h === "rec" ? plTerminarRecorrido() : dsTerminar();
  if (a === "cancelar" || a === "soltar") {
    if (a === "cancelar") return plHerr(null);
    PL_ASEL.clear();
    PLH.obj = -1;
    edProps();
    return plSobreDibujar();
  }
  if (a === "copiar") return dsCopiar();
  if (a === "cortar") return edBorrar(true);
  if (a === "pegar") return dsPegar();
  if (a === "duplicar") {
    dsCopiar();
    return dsPegar();
  }
  if (a === "borrar") return edBorrar(false);
  if (a === "borrarArq") {
    DS_SEL.clear();
    return edBorrar(false);
  }
  if (a === "girar") return dsGirar();
  if (a === "g-90") return dsGirar(-90);
  if (a === "g180") return dsGirar(180);
  if (a === "gexacto") return edAnguloExacto(sel[0].id);
  if (a === "gang")
    return plPedir("Ángulo de giro (°, positivo: antihorario)", "45", v => {
      const g = parseFloat(String(v).replace(",", "."));
      plPedir(null);
      if (!Number.isFinite(g) || !g) return toast("Escriba un ángulo en grados, distinto de cero");
      dsGirar(g);
    });
  if (a === "letra0" || a === "colcapa") {
    sel.forEach(el => delete el[a === "colcapa" ? "col" : "dt"]);
    return edCambio();
  }
  if (a === "enc")
    return plPedir("Letra de encendido (vacío: quitar)", sel.find(dsConEnc).enc || "a", v => {
      plPedir(null);
      const l = String(v)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 3);
      sel.filter(dsConEnc).forEach(el => (l ? (el.enc = l) : delete el.enc));
      edCambio();
    });
  if (a === "acapa") {
    sel.forEach(el => (el.capa = dsD().actual));
    return edCambio();
  }
  if (a === "similares") return sel.length && dsSelTipo(dsTipo(sel[0]));
  if (a === "encuadrar") {
    const bb = sel.map(dsBBox),
      x0 = Math.min(...bb.map(q => q[0])),
      y0 = Math.min(...bb.map(q => q[1])),
      x1 = Math.max(...bb.map(q => q[2])),
      y1 = Math.max(...bb.map(q => q[3])),
      m = Math.max(x1 - x0, y1 - y0, 1) * 0.4;
    return plVer(x0 - m, y0 - m, x1 + m, y1 + m);
  }
  if (a === "tablero") return tabAbrir(sel[0].id);
  if (a === "ruta") return dpRuta();
  if (a === "bloque") return dpGuardarBloque();
  if (a === "aplanta") return dpCopiarAPlanta();
  if (a === "montante") return dpMontante();
  if (a === "irmon") return dpIrMontante();
  if (a === "ventana") return elAbrir(sel[0].id);
  if (a === "props") {
    edProps.oculto = false;
    edPanGuardar();
    return plPanel();
  }
  if (a === "ocultar" || a === "aislar") {
    const capa = PL_MOD.trazos[PLH.obj].capa;
    EPL.ocultas =
      a === "ocultar" ? [...new Set([...EPL.ocultas, capa])] : Object.keys(PL_MOD.capas).filter(n => n !== capa);
    PL_ASEL.clear();
    PLH.obj = -1;
    plPreparar();
    edCambio();
    return toast(
      a === "ocultar"
        ? `Capa ${capa} oculta`
        : `Solo se ve la capa ${capa}: «Mostrar todas las capas» con clic derecho en un lugar vacío`
    );
  }
  if (a === "todo") return dsTodo();
  if (a === "biblio") return bibAbrir();
  if (a === "fila" || a === "espejo") return dsIniciarCopia(a);
  if (a === "ley") {
    const q = ED_MENU.p || plPuntoActual();
    if (!q) return;
    dsCapa(DS_SIS.txt.capa);
    DS_SEL.clear();
    DS_SEL.add(dsAgregar({ t: "ley", x: q[0], y: q[1], tit: "LEYENDA", capa: DS_SIS.txt.capa }).id);
    return edCambio();
  }
  if (a === "ajustar") return plAjustar();
  if (a === "mostrar") {
    EPL.ocultas = [];
    plPreparar();
    return edCambio();
  }
  if (a === "restaurar") {
    delete EPL.borr;
    plPreparar();
    return edCambio();
  }
}
plLienzo.addEventListener("contextmenu", e => {
  e.preventDefault();
  if (!PL_MOD || !EPL || PLH.pan) return;
  $("edRefs").hidden = true;
  if (PLH.h) {
    edMenuCerrar();
    if (PLH.h === "rec" && !PLH.med && PLH.pts.length > 1) return plTerminarRecorrido();
    if (PLH.pts.length && dsTerminar()) return;
    return plHerr(null);
  }
  edMenuAbrir(e);
});
ED_MENU.addEventListener("click", e => {
  const b = e.target.closest("[data-edm]");
  if (b && !b.disabled) edMenuAccion(b.dataset.edm);
});
ED_MENU.addEventListener("contextmenu", e => e.preventDefault());
ED_MENU.addEventListener("change", e => ED_MENU.fnCambio && ED_MENU.fnCambio(e));
// Se cierra al hacer clic fuera, con Esc, con la rueda o al salir del editor
addEventListener(
  "pointerdown",
  e => {
    if (!ED_MENU.hidden && !e.target.closest("#edMenu")) edMenuCerrar();
  },
  true
);
addEventListener(
  "keydown",
  e => {
    if (!ED_MENU.hidden && e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      edMenuCerrar();
    }
  },
  true
);
plLienzo.addEventListener("wheel", edMenuCerrar, { passive: true });

/* Paneles del editor, como los del espacio de trabajo: el ancho se cambia arrastrando su borde (doble clic: el de
   siempre), se cierran con × (y se vuelven a abrir en Vista › Paneles) y se recuerdan en este navegador */
const ED_PAN = { izq: { el: "plLado", w: null }, der: { el: "edProp", w: null } },
  ED_PAN_K = "jmg-electric-editor-paneles";
function edPanGuardar() {
  try {
    localStorage.setItem(
      ED_PAN_K,
      JSON.stringify({
        izq: { oculto: !!plPanel.oculto, w: ED_PAN.izq.w },
        der: { oculto: !!edProps.oculto, w: ED_PAN.der.w }
      })
    );
  } catch (e) {}
}
const edPanAncho = () => Object.values(ED_PAN).forEach(p => ($(p.el).style.width = p.w ? p.w + "px" : ""));
try {
  const o = JSON.parse(localStorage.getItem(ED_PAN_K) || "null");
  if (o) {
    plPanel.oculto = !!(o.izq && o.izq.oculto);
    edProps.oculto = !!(o.der && o.der.oculto);
    Object.keys(ED_PAN).forEach(k => (ED_PAN[k].w = o[k] && +o[k].w > 0 ? +o[k].w : null));
  }
} catch (e) {}
edPanAncho();
document.querySelectorAll("#editor .ed-sp").forEach(sp => {
  const k = sp.dataset.esp,
    p = ED_PAN[k];
  sp.addEventListener("pointerdown", e => {
    e.preventDefault();
    try {
      sp.setPointerCapture(e.pointerId);
    } catch (_) {}
    sp.classList.add("drag");
    document.body.classList.add("arrastrando");
    const mv = ev => {
      const r = document.querySelector("#editor .ed-main").getBoundingClientRect(),
        otro = ED_PAN[k === "izq" ? "der" : "izq"],
        wo = $(otro.el).hidden ? 0 : $(otro.el).offsetWidth,
        // Las coordenadas del mouse están en píxeles de pantalla; se dividen por la escala del espacio de trabajo
        S = parseFloat(getComputedStyle($("ws")).zoom) || 1,
        w = (k === "izq" ? ev.clientX - r.left : r.right - ev.clientX) / S;
      p.w = Math.round(Math.max(170, Math.min(560, r.width / S - wo - 320, w)));
      edPanAncho();
    };
    const up = () => {
      sp.classList.remove("drag");
      document.body.classList.remove("arrastrando");
      removeEventListener("pointermove", mv);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      edPanGuardar();
    };
    addEventListener("pointermove", mv);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  });
  sp.addEventListener("dblclick", () => {
    p.w = null;
    edPanAncho();
    edPanGuardar();
    toast("Ancho del panel restablecido");
  });
});
$("editor").addEventListener("click", e => {
  const x = e.target.closest("[data-edx]");
  if (!x) return;
  if (x.dataset.edx === "izq") plPanel.oculto = true;
  else edProps.oculto = true;
  edPanGuardar();
  plPanel();
  toast("Panel cerrado: se vuelve a abrir en Vista › Paneles");
});
new MutationObserver(() => {
  if (!ED.abierto) return;
  dsFondo();
  plPanel();
  plDibujar();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-paleta"] });

/* ---------- Pestaña Diseño del espacio de trabajo: abre el editor ---------- */
$("ws").addEventListener("click", e => {
  const b = e.target.closest("#ws > .ap-ribbon [data-pl]");
  if (!b) return;
  if (b.dataset.pl === "editor") edAbrir(false);
  else if (b.dataset.pl === "abrirEd") edAbrir(true);
});

/* ---------- Editor: barra de título, pestañas y cinta ---------- */
$("editor").addEventListener("click", e => {
  const ed = e.target.closest("[data-ed]"),
    tab = e.target.closest("[data-tab-e]"),
    tg = e.target.closest("[data-edtg]");
  if (ed && !ed.disabled) {
    const a = ed.dataset.ed;
    if (a === "undo") edHist(-1);
    else if (a === "redo") edHist(1);
    else if (a === "aplicar") edAplicar();
    else if (a === "aceptar") {
      edAplicar();
      edCerrar();
    } else if (a === "cancelar") edCancelar();
    return;
  }
  if (tab) {
    if (DSU.cintaMin) edCinta(true);
    $("editor")
      .querySelectorAll("[data-tab-e]")
      .forEach(t => t.classList.toggle("on", t === tab));
    $("editor")
      .querySelectorAll("[data-rib-e]")
      .forEach(r => (r.hidden = r.dataset.ribE !== tab.dataset.tabE));
    return;
  }
  if (tg) {
    const v = tg.dataset.edtg;
    return v === "rej" || v === "forz" || v === "polar" ? dsAlternarRejilla(v, v === "polar") : edAlternar(v, false);
  }
  const b = e.target.closest("[data-pl]");
  if (!b || b.disabled) return;
  const a = b.dataset.pl;
  if (a === "abrir") return $("plArchivo").click();
  if (a === "fondo") {
    const v = $("edFondo");
    v.hidden = !v.hidden;
    if (v.hidden) return;
    dsFondoLista();
    const ed = $("editor").getBoundingClientRect(),
      r = b.getBoundingClientRect(),
      S = parseFloat(getComputedStyle($("ws")).zoom) || 1;
    Object.assign(v.style, {
      top: (r.bottom - ed.top) / S + 4 + "px",
      left: Math.max(4, Math.min((r.left - ed.left) / S, ed.width / S - 290)) + "px",
      right: "auto",
      bottom: "auto"
    });
    return;
  }
  if (a === "panel" || a === "props") {
    if (a === "panel") plPanel.oculto = !plPanel.oculto;
    else edProps.oculto = !edProps.oculto;
    edPanGuardar();
    plPanel();
    plTam();
    return plDibujar();
  }
  if (a === "sel") return plHerr(null);
  if (a === "flip") {
    // Con una tubería en curso, invierte su próxima curva; si no, las curvas de lo seleccionado
    if (dsEsTub(PLH.h)) {
      PLH.lado = -(PLH.lado || 1);
      return plSobreDibujar();
    }
    return dsCurvar("invertir");
  }
  if (a === "capas") return capasAbrir();
  if (a === "revisar") return revAbrir();
  if (a === "plantillas") return plaAbrir();
  if (a === "versiones") return verAbrir();
  if (a === "ruta") return dpRuta();
  if (a === "metrado") return metAbrir();
  if (a === "buscar") return buAbrir();
  if (a === "presentar") return edPresentar(true);
  if (a === "atajos") return atjAbrir();
  if (a === "lamina") return lamAbrir();
  if (a === "dxfdis" || a === "dxftodo") return lamDxf(a === "dxftodo");
  if (a === "biblio") return bibAbrir();
  if (a === "fila" || a === "espejo") return dsIniciarCopia(a);
  if (a === "girar") return dsGirar();
  if (a === "borrar") return edBorrar(false);
  if (a === "copiar") {
    dsCopiar();
    return dsPegar();
  }
  if (a === "quitar") {
    if (!EPL) return toast("El proyecto no tiene plano de arquitectura");
    return confirmar(
      "¿Quitar el plano de arquitectura?",
      `<p>El diseño deja de usar <b>${esc(EPL.nombre)}</b> y se pierden su escala, capas ocultas, plantas encuadradas${EPL.dis && EPL.dis.els.length ? ` y <b>los ${EPL.dis.els.length} elementos del diseño eléctrico</b>` : ""} (al aplicar los cambios). El archivo DXF de su computadora no cambia; puede volver a abrirlo.</p>`,
      "Quitar",
      ok => {
        if (!ok) return;
        EPL = null;
        PL_MOD = PL_SHA = null;
        PLH.obj = -1;
        plHerr(null);
        plPreparar();
        edCambio();
      }
    );
  }
  if (!PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  if (a === "ajustar") plAjustar();
  else if (a === "fondo0") {
    DSU.fondo = "tema";
    DSU.calido = 0;
    DSU.brillo = 100;
    dsGuardarPref();
    dsCinta();
    dsFondo();
  } else if (a === "zprev") plVistaAnterior();
  else if (a === "acercar") plZoom(1.5);
  else if (a === "alejar") plZoom(1 / 1.5);
  else if (a === "todas" || a === "ninguna") {
    EPL.ocultas = a === "todas" ? [] : Object.keys(PL_MOD.capas);
    PLH.obj = -1;
    plPreparar();
    edCambio();
  } else if (PL_NOMH[a] || a.startsWith("col:")) {
    if (a.startsWith("col:") || DS_HERR[a]) DS_SEL.clear();
    plHerr(PLH.h === a ? null : a);
  }
});
$("plArchivo").addEventListener("change", e => {
  plAbrir(e.target.files[0]);
  e.target.value = "";
});
$("plVacioB").addEventListener("click", () => $("plArchivo").click());
$("plTenue").addEventListener("change", e => {
  if (!EPL) return;
  EPL.tenue = e.target.checked;
  // Atenuado: solo se trabaja el diseño eléctrico; se suelta lo elegido de la arquitectura
  if (EPL.tenue) {
    PL_ASEL.clear();
    PLH.obj = -1;
  }
  PL_COL.clear();
  edCambio();
});
$("plUnidad").addEventListener("change", e => {
  if (!EPL || e.target.value === "x") return;
  EPL.f = +e.target.value;
  EPL.de = "manual";
  edCambio();
  toast("Unidad del dibujo cambiada: compruébela midiendo una cota conocida");
});
edInfo();
