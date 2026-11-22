/* EDITOR DE DISEÑO · PLANO DE ARQUITECTURA (etapa 1 del diseño en planta)
   El editor ocupa toda la pantalla (se abre desde la pestaña Diseño de la cinta, o solo al crear o abrir un proyecto
   que se trabaja con el plano) y trabaja sobre una copia del plano del proyecto, que se guarda sola en el proyecto
   medio segundo después de cada cambio (autoguardado); «Descartar cambios» lo vuelve a como estaba al abrir.
   Tiene su propio deshacer (Ctrl+Z / Ctrl+Y) mientras está abierto.
   - Plano de arquitectura en DXF (js/editor/dxf.js): zoom con la rueda del mouse (centrado en el cursor), desplazamiento
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
    const ant = PL_MOD,
      antE = EPL,
      act = PLH.actArq && EPL && ant && EPL.sha !== sha;
    PLH.actArq = false;
    PL_MOD = m;
    PL_SHA = sha;
    const nombre = file.name.replace(/[<>]/g, "").slice(0, 120),
      // El mismo archivo (o una versión nueva con el mismo nombre, o «Actualizar arquitectura») conserva la escala,
      // las capas y las plantas
      sigue = EPL && (EPL.sha === sha || EPL.nombre === nombre || act);
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
      dis: EPL && EPL.dis ? EPL.dis : dsNuevo(),
      ...(sigue && EPL.mur ? { mur: EPL.mur } : {}),
      // Versiones de la arquitectura usadas en el proyecto (la actual al final)
      arqV: [
        ...((EPL && EPL.arqV) || (EPL ? [{ n: EPL.nombre, sha: EPL.sha, f: "" }] : [])).filter(v => v.sha !== sha),
        { n: nombre, sha, f: new Date().toISOString().slice(0, 16).replace("T", " ") }
      ].slice(-20)
    };
    PLH.obj = -1;
    PL_ASEL.clear();
    plPreparar();
    if (!(sigue && plVistaGuardada())) plAjustar();
    edCambio();
    if (act) return dpCompararArq(ant, m, antE);
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
  // Las puntas conectadas, justo en el dibujo de su artefacto (diseños guardados antes de que llegaran exactas); el
  // tablero de los circuitos escritos a mano y los conductores de las tuberías que aún no los tienen
  if (EPL && EPL.dis) {
    dsReconectar();
    dsPropagarCircuitos();
    dsCondAuto();
    dsNombrarCajas();
    dcRotulosAuto();
  }
  ED.base = edSnap();
  ED.hist = [ED.base];
  ED.redo = [];
  // Cómo estaba el proyecto al abrir el editor: «Descartar cambios» vuelve a esto
  ED.ini = ED.base;
  ED.iniPlano = PLANO ? clon(PLANO) : null;
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
    dsCondAuto();
    // Cajas de paso numeradas (CP-1, CP-2…) y rótulos de los alimentadores al día
    dsNombrarCajas();
    dcRotulosAuto();
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
  edGuardarLuego();
}
/* Autoguardado: los cambios del editor pasan solos al proyecto medio segundo después del último (con «Calcular con el
   diseño», el proyecto se recalcula); el deshacer del editor sigue disponible y «Descartar cambios» vuelve a como
   estaba al abrir el editor */
function edGuardarLuego() {
  clearTimeout(ED.tAuto);
  ED.tAuto = setTimeout(edGuardarYa, 600);
  edEstado();
}
function edGuardarYa() {
  clearTimeout(ED.tAuto);
  ED.tAuto = null;
  if (ED.abierto && edSnap() !== ED.base) {
    PLANO = EPL ? clon(EPL) : null;
    ED.base = edSnap();
    saveDraft();
    if (PROY.calPlano === "1") calcularAhora();
    edAutoguardar(true);
  }
  edEstado();
  if (typeof edVivo === "function") edVivo();
}
function edHist(dir) {
  if (dir < 0 && ED.hist.length < 2) return;
  if (dir > 0 && !ED.redo.length) return;
  if (dir < 0) ED.redo.push(ED.hist.pop());
  else ED.hist.push(ED.redo.pop());
  EPL = JSON.parse(ED.hist[ED.hist.length - 1]);
  dsAsegurar();
  DS_N = 0;
  edGuardarLuego();
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
// Barra del editor: deshacer y rehacer, y si el diseño ya está guardado en el proyecto
function edEstado() {
  const pend = !!ED.tAuto || edSnap() !== ED.base,
    cambio = pend || ED.base !== ED.ini;
  $("edUndo").disabled = ED.hist.length < 2;
  $("edRedo").disabled = !ED.redo.length;
  $("edSucio").hidden = !cambio;
  $("edSucio").textContent = pend ? "Guardando…" : "✓ Guardado en el proyecto";
  $("edSucio").classList.toggle("ok", !pend);
  $("edDescartar").disabled = !cambio;
}
/* Guarda ya el diseño en el proyecto (al volver al proyecto): entra al historial de deshacer del proyecto y, la
   primera vez que el diseño tiene datos para el cálculo, ofrece calcular con él */
function edAplicar() {
  edGuardarYa();
  if (ED.base === ED.ini) return;
  ED.ini = ED.base;
  ED.iniPlano = PLANO ? clon(PLANO) : null;
  histPush();
  plLimpiarArchivos();
  edEstado();
  edInfo();
  const D = EPL && EPL.dis;
  if (
    PROY.calPlano !== "1" &&
    !ED.ofrecio &&
    D &&
    D.els.some(e => (e.k === "tab" && e.nc) || e.ar || PL_MED.has(e.k))
  ) {
    ED.ofrecio = true;
    confirmar(
      "¿Calcular con el diseño?",
      "<p>El diseño tiene datos para el cálculo (tableros con circuitos, áreas o medidores), pero el proyecto todavía se calcula con los datos escritos. Con <b>Calcular con el diseño</b>, el área, las salidas, las longitudes y los alimentadores salen del plano.</p>",
      "Calcular con el diseño",
      ok => {
        if (!ok) return;
        const s = $("calPlano");
        s.value = "1";
        s.dispatchEvent(new Event("input", { bubbles: true }));
        s.dispatchEvent(new Event("change", { bubbles: true }));
        toast("El proyecto se calcula con el diseño del plano");
      }
    );
  }
}
// Descartar cambios: el proyecto vuelve a como estaba al abrir el editor (o a lo último que se llevó al proyecto)
function edCancelar() {
  clearTimeout(ED.tAuto);
  ED.tAuto = null;
  if (edSnap() === ED.ini) return edCerrar();
  confirmar(
    "¿Descartar los cambios del diseño?",
    "<p>El diseño se guarda solo en el proyecto mientras trabaja. <b>Descartar cambios</b> lo vuelve a como estaba al abrir el editor: se pierden el plano, la escala, las capas, las plantas y los elementos que agregó o cambió desde entonces.</p>",
    "Descartar cambios",
    ok => {
      if (!ok) return edEstado();
      try {
        localStorage.removeItem(ED_REC);
      } catch (e) {}
      PLANO = ED.iniPlano ? clon(ED.iniPlano) : null;
      saveDraft();
      if (PROY.calPlano === "1") calcularAhora();
      edCerrar();
      toast("Cambios del diseño descartados");
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
  // Textos: todo su recuadro dentro de la ventana, o alguna esquina en captura
  const en = ([x, y]) => x >= xa && x <= xb && y >= ya && y <= yb;
  (PL_TX || []).forEach(t => {
    const P = plCajaTexto(t);
    if (captura ? P.some(en) || en([t.x, t.y]) : P.every(en)) PL_ASEL.add(t.e);
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
