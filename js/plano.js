/* DISEÑO · PLANO DE ARQUITECTURA (etapa 1 del diseño en planta)
   Pestaña Diseño de la cinta: abre el plano de arquitectura en DXF (js/dxf.js) y lo muestra en el panel central
   con zoom (rueda del mouse, centrado en el cursor), desplazamiento (arrastrar), capas que se muestran u ocultan,
   escala del dibujo comprobada con una medida conocida, plantas encuadradas por el usuario y herramientas de
   medición (distancia, recorrido y longitud de objetos) con enganche a extremos, puntos medios, centros e
   inserciones de bloques, y modo orto.
   - El archivo se lee en la computadora del usuario y no se sube a internet. Se guarda en la base de datos del
     navegador (IndexedDB), con su huella SHA-1 como nombre; el proyecto guarda solo PLANO: el nombre y la huella
     del archivo, la unidad, las capas ocultas, las plantas y el modo atenuado.
   - Se dibuja en dos lienzos: el plano (se redibuja al mover o cambiar la vista) y encima lo que sigue al cursor
     (enganche, mediciones, encuadres). Las coordenadas se guardan respecto del centro del dibujo para no perder
     precisión en planos georreferenciados. */
let PL_MOD = null,
  PL_SHA = null,
  PL_VIS = false,
  PL_GR = null,
  PL_TX = null,
  PL_IDX = null;
// Vista: punto del dibujo en el centro del lienzo y escala en píxeles del lienzo por unidad del dibujo
const PLV = { cx: 0, cy: 0, s: 1 };
// Herramienta activa y sus puntos; el cursor (en el dibujo) y el punto enganchado
const PLH = { h: null, pts: [], sel: [], cur: null, eng: null, med: null, pan: null };
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
// Borra del navegador los planos que ya no usa ningún proyecto (ni el abierto, ni los guardados, ni el historial
// de deshacer)
async function plLimpiarArchivos() {
  try {
    const usados = new Set(PLANO ? [PLANO.sha] : []);
    Object.values(libLoad()).forEach(o => o && o.PLANO && usados.add(o.PLANO.sha));
    const db = await plDb(),
      claves = await new Promise((ok, mal) => {
        const r = db.transaction("planos").objectStore("planos").getAllKeys();
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      }),
      sobran = claves.filter(k => !usados.has(k) && !HIST.some(s => s.includes(k)) && !REDO.some(s => s.includes(k)));
    if (!sobran.length) return;
    const t = db.transaction("planos", "readwrite");
    sobran.forEach(k => t.objectStore("planos").delete(k));
  } catch (e) {}
}
const plHuella = async buf =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-1", buf))].map(b => b.toString(16).padStart(2, "0")).join("");

// Abre un archivo elegido por el usuario: lo lee, lo guarda en el navegador y lo asocia al proyecto
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
      sigue = PLANO && (PLANO.sha === sha || PLANO.nombre === nombre);
    PLANO = {
      nombre,
      sha,
      kb: Math.round(buf.byteLength / 1024),
      f: sigue ? PLANO.f : m.unidad.f,
      de: sigue ? PLANO.de : m.unidad.de,
      ocultas: sigue
        ? PLANO.ocultas
        : Object.entries(m.capas)
            .filter(([, c]) => !c.on)
            .map(([n]) => n),
      plantas: sigue ? PLANO.plantas : [],
      tenue: sigue ? PLANO.tenue : false
    };
    plPreparar();
    if (!(sigue && plVistaGuardada())) plAjustar();
    plCambio();
    plLimpiarArchivos();
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
// El proyecto cambió de plano (abrir un proyecto, deshacer): carga el archivo del navegador si hace falta
async function planoAplicado() {
  plHerr(null);
  if (!PLANO) {
    PL_MOD = PL_SHA = null;
    plPreparar();
    return plMostrar();
  }
  if (PLANO.sha !== PL_SHA) {
    PL_MOD = null;
    PL_SHA = PLANO.sha;
    if (PL_VIS) await plCargarGuardado();
  }
  plPreparar();
  plMostrar();
}
async function plCargarGuardado() {
  if (!PLANO || PL_MOD) return;
  plCargando(true);
  try {
    const o = await plLeerArchivo(PLANO.sha);
    if (o && PLANO && o.buf) {
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
// Un cambio en PLANO: se guarda con el proyecto y entra al historial de deshacer
function plCambio() {
  saveDraft();
  histPush();
  plMostrar();
}

/* ---------- Preparación del dibujo: trazos agrupados por estilo, textos e índice de enganche ---------- */
function plPreparar() {
  PL_GR = PL_TX = PL_IDX = null;
  if (!PL_MOD) return;
  const m = PL_MOD,
    ocultas = new Set(PLANO.ocultas),
    O = plOrigen(),
    grupos = new Map();
  for (let i = 0; i < m.trazos.length; i++) {
    const t = m.trazos[i];
    if (ocultas.has(t.capa)) continue;
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
  PL_TX = m.textos.filter(t => !ocultas.has(t.capa));
  if (!m.idx) m.idx = plIndice(m);
  PL_IDX = m.idx;
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
  m.trazos.forEach((t, i) => {
    if (t.k !== "l") return;
    let a = Infinity,
      b = Infinity,
      c = -Infinity,
      d = -Infinity;
    for (let j = 0; j < t.p.length; j += 2) {
      a = Math.min(a, t.p[j]);
      c = Math.max(c, t.p[j]);
      b = Math.min(b, t.p[j + 1]);
      d = Math.max(d, t.p[j + 1]);
    }
    const i0 = Math.floor((a - e[0]) / tam),
      i1 = Math.floor((c - e[0]) / tam),
      j0 = Math.floor((b - e[1]) / tam),
      j1 = Math.floor((d - e[1]) / tam);
    // Los trazos muy grandes (marcos, ejes) se indexan en sus celdas hasta un límite
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4000) return;
    for (let x = i0; x <= i1; x++)
      for (let y = j0; y <= j1; y++) {
        const k = x + "," + y;
        (trz.get(k) || trz.set(k, []).get(k)).push(i);
      }
  });
  return { tam, pts, trz, x0: e[0], y0: e[1] };
}

/* ---------- Vista: conversión de coordenadas, zoom y desplazamiento ---------- */
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
  const [x, y] = plADib(X, Y);
  PLV.s = Math.min(1e7, Math.max(1e-6, PLV.s * f));
  // El punto bajo el cursor queda en su lugar
  PLV.cx = x - (X - plW() / 2) / PLV.s;
  PLV.cy = y - (plH() / 2 - Y) / PLV.s;
  plDibujar();
}
// La última vista de este plano, para volver a ella al abrir el proyecto
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
  const k = h + (PLANO && PLANO.tenue ? "t" : "");
  let c = PL_COL.get(k);
  if (c) return c;
  let v = plRgb(h);
  const l = plLum(v);
  // Blanco (color 7) y colores muy claros sobre fondo claro; casi negros sobre fondo oscuro
  if (!PL_OSCURO && l > 0.8) v = [38, 48, 60];
  else if (!PL_OSCURO && l > 0.55) v = v.map(x => x * 0.62);
  else if (PL_OSCURO && l < 0.18) v = v.map(x => x + (200 - x) * 0.7);
  if (PLANO && PLANO.tenue) {
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
}

/* ---------- Lienzo superior: enganche, mediciones, encuadres y plantas ---------- */
const plFm = v => fmt(v * (PLANO ? PLANO.f : 1), 2);
function plSobreDibujar() {
  const g = plSobre.getContext("2d"),
    d = plDpr();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, plW(), plH());
  if (!PL_MOD) return;
  const acento = PL_OSCURO ? "#f0c060" : "#c77d2e",
    azul = PL_OSCURO ? "#8fc1f0" : "#14304f";
  g.lineWidth = 1.5 * d;
  g.font = `600 ${11.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
  // Plantas encuadradas
  (PLANO.plantas || []).forEach(p => {
    const [a, b] = plAPant(p.x0, p.y1),
      [c, e] = plAPant(p.x1, p.y0);
    g.setLineDash([6 * d, 4 * d]);
    g.strokeStyle = azul;
    g.strokeRect(a, b, c - a, e - b);
    g.setLineDash([]);
    plEtiqueta(g, p.n, a + 4 * d, b + 4 * d, azul, "left", "top");
  });
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
  if (PLH.h === "planta" && pts.length === 1 && q) {
    const [a, b] = plAPant(pts[0][0], pts[0][1]),
      [c, e] = plAPant(q[0], q[1]);
    g.fillStyle = PL_OSCURO ? "rgba(143,193,240,.12)" : "rgba(20,48,79,.08)";
    g.fillRect(a, b, c - a, e - b);
    g.strokeStyle = azul;
    g.strokeRect(a, b, c - a, e - b);
  } else if (pts.length && PLH.h !== "planta") {
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
  // Marca de enganche: cuadrado en extremos, triángulo en puntos medios, círculo en centros, cruz en bloques
  if (PLH.eng && PLH.h) {
    const [X, Y] = plAPant(PLH.eng[0], PLH.eng[1]),
      r = 6 * d;
    g.strokeStyle = PL_OSCURO ? "#7ee08a" : "#1f8a3a";
    g.lineWidth = 2 * d;
    g.beginPath();
    if (PLH.eng[2] === 2) {
      g.moveTo(X, Y - r);
      g.lineTo(X + r, Y + r * 0.8);
      g.lineTo(X - r, Y + r * 0.8);
      g.closePath();
    } else if (PLH.eng[2] === 3) g.arc(X, Y, r, 0, 2 * Math.PI);
    else if (PLH.eng[2] === 4) {
      g.moveTo(X - r, Y - r);
      g.lineTo(X + r, Y + r);
      g.moveTo(X + r, Y - r);
      g.lineTo(X - r, Y + r);
    } else g.rect(X - r, Y - r, 2 * r, 2 * r);
    g.stroke();
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
    x = ha === "center" ? X - w / 2 : X,
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

/* ---------- Enganche y orto ---------- */
// Punto de enganche más cercano al cursor (a menos de 12 px), o null
function plEnganche(x, y) {
  if (!PL_IDX || !$("plSnap").checked) return null;
  const I = PL_IDX,
    r = (12 * plDpr()) / PLV.s,
    n = Math.ceil(r / I.tam);
  if (n > 8) return null;
  const ci = Math.floor((x - I.x0) / I.tam),
    cj = Math.floor((y - I.y0) / I.tam),
    oc = new Set(PLANO.ocultas),
    sn = PL_MOD.snap;
  let mejor = null,
    md = r;
  for (let a = ci - n; a <= ci + n; a++)
    for (let b = cj - n; b <= cj + n; b++) {
      const l = I.pts.get(a + "," + b);
      if (l)
        for (const i of l) {
          const dd = Math.hypot(sn[i] - x, sn[i + 1] - y);
          // Un extremo gana a un punto medio que esté casi a la misma distancia
          if (dd < md - (sn[i + 2] === 1 ? -r * 0.15 : 0)) {
            if (oc.has(PL_MOD.snapC[i / 3])) continue;
            md = dd;
            mejor = [sn[i], sn[i + 1], sn[i + 2]];
          }
        }
    }
  return mejor;
}
function plPuntoActual() {
  if (!PLH.cur) return null;
  let p = PLH.eng ? [PLH.eng[0], PLH.eng[1]] : PLH.cur.slice();
  const u = PLH.pts[PLH.pts.length - 1];
  if (u && $("plOrto").checked && !PLH.eng) {
    if (Math.abs(p[0] - u[0]) > Math.abs(p[1] - u[1])) p = [p[0], u[1]];
    else p = [u[0], p[1]];
  }
  return p;
}
// Trazo visible más cercano a un punto (a menos de r en unidades del dibujo)
function plObjeto(x, y, r) {
  const I = PL_IDX;
  if (!I) return -1;
  const oc = new Set(PLANO.ocultas),
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
        if (oc.has(t.capa)) continue;
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

/* ---------- Herramientas: distancia, recorrido, longitud de objetos, escala y plantas ---------- */
function plHerr(h) {
  PLH.h = h;
  PLH.pts = [];
  PLH.sel = [];
  PLH.med = null;
  PLH.eng = null;
  plPedir(null);
  document.querySelectorAll("[data-pl]").forEach(b => b.classList.toggle("on", !!h && b.dataset.pl === h));
  plLienzo.classList.toggle("con-herr", !!h);
  plOrden();
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
        planta: n ? "Designe la esquina opuesta" : "Designe una esquina de la planta"
      };
    c.innerHTML = `<b>${PL_NOMH[PLH.h]}</b> · ${T[PLH.h]} · <span class="pl-k">Esc</span> para salir`;
  }
  $("plCmd").hidden = !c.innerHTML;
}
// Pide un dato en la línea de comandos (medida real, nombre de la planta) y llama a fn con lo escrito
function plPedir(etq, val, fn) {
  const box = $("plCmdIn");
  plPedir.fn = fn || null;
  box.hidden = !etq;
  if (!etq) return;
  $("plCmdL").textContent = etq;
  $("plCmdV").value = val;
  $("plCmdV").inputMode = /medida/i.test(etq) ? "decimal" : "text";
  setTimeout(() => {
    $("plCmdV").focus();
    $("plCmdV").select();
  }, 20);
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
  } else if (e.key === "Escape") plHerr(null);
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
      PLANO.f = real / l;
      PLANO.de = "manual";
      plHerr(null);
      plCambio();
      toast(`Escala comprobada: 1 unidad del dibujo = ${fmt(PLANO.f, PLANO.f < 0.01 ? 4 : 3)} m`);
    });
  } else if (h === "planta" && n === 2) {
    const [a, b] = PLH.pts;
    if (Math.abs(a[0] - b[0]) * PLV.s < 8 || Math.abs(a[1] - b[1]) * PLV.s < 8) {
      PLH.pts = [];
      return plOrden();
    }
    PLH.med = true;
    const k = (PLANO.plantas || []).length + 1;
    plOrden(`<b>Encuadrar planta</b> · ${plFm(Math.abs(a[0] - b[0]))} × ${plFm(Math.abs(a[1] - b[1]))} m`);
    plPedir("Nombre de la planta", `${ORD(k)} piso`, v => {
      if (!v) return toast("Escriba un nombre para la planta");
      PLANO.plantas.push({
        n: v.replace(/[<>]/g, "").slice(0, 60),
        x0: Math.min(a[0], b[0]),
        y0: Math.min(a[1], b[1]),
        x1: Math.max(a[0], b[0]),
        y1: Math.max(a[1], b[1])
      });
      plHerr(null);
      plCambio();
      toast("Planta guardada: haga clic en su nombre, en el panel Plantas, para verla");
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

/* ---------- Mouse y teclado sobre el plano ---------- */
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
  if (!PL_MOD || e.target.closest(".pl-cmd")) return;
  const [X, Y] = plMouse(e);
  // Rueda presionada: desplazar (doble clic con la rueda: ajustar a la pantalla); izquierdo sin herramienta, también
  if (e.button === 1 || (e.button === 0 && !PLH.h)) {
    e.preventDefault();
    if (e.button === 1) {
      const t = Date.now();
      if (t - (plLienzo.ultRueda || 0) < 350) {
        plLienzo.ultRueda = 0;
        return plAjustar();
      }
      plLienzo.ultRueda = t;
    }
    PLH.pan = { X, Y, cx: PLV.cx, cy: PLV.cy, mov: false };
    plLienzo.setPointerCapture(e.pointerId);
    plLienzo.classList.add("moviendo");
  } else if (e.button === 0 && PLH.h) {
    PLH.abajo = [X, Y];
  }
});
plLienzo.addEventListener("pointermove", e => {
  if (!PL_MOD) return;
  const [X, Y] = plMouse(e);
  if (PLH.pan) {
    if (Math.hypot(X - PLH.pan.X, Y - PLH.pan.Y) > 3) PLH.pan.mov = true;
    PLV.cx = PLH.pan.cx - (X - PLH.pan.X) / PLV.s;
    PLV.cy = PLH.pan.cy + (Y - PLH.pan.Y) / PLV.s;
    plDibujar();
    return;
  }
  const p = plADib(X, Y);
  PLH.cur = p;
  PLH.eng = PLH.h && PLH.h !== "obj" ? plEnganche(p[0], p[1]) : null;
  const q = plPuntoActual() || p;
  $("plXY").textContent = `X ${plFm(q[0])}   Y ${plFm(q[1])} m`;
  if (PLH.h) plSobreDibujar();
});
plLienzo.addEventListener("pointerup", e => {
  if (PLH.pan) {
    PLH.pan = null;
    plLienzo.classList.remove("moviendo");
    return;
  }
  if (e.button !== 0 || !PLH.h || !PLH.abajo) return;
  const [X, Y] = plMouse(e);
  if (Math.hypot(X - PLH.abajo[0], Y - PLH.abajo[1]) > 6 * plDpr()) return (PLH.abajo = null);
  PLH.abajo = null;
  // Un clic en el mismo punto que el anterior (doble clic) termina el recorrido
  const p = plPuntoActual() || plADib(X, Y),
    u = PLH.pts[PLH.pts.length - 1];
  if (PLH.h === "rec" && u && !PLH.med && Math.hypot(p[0] - u[0], p[1] - u[1]) * PLV.s < 3)
    return plTerminarRecorrido();
  if (!$("plCmdIn").hidden) return;
  plPunto(p);
});
plLienzo.addEventListener("pointerleave", () => {
  PLH.cur = PLH.eng = null;
  $("plXY").textContent = "";
  plSobreDibujar();
});
plLienzo.addEventListener("dblclick", e => {
  if (PLH.h === "rec") {
    e.preventDefault();
    plTerminarRecorrido();
  }
});
addEventListener("keydown", e => {
  if (!PL_VIS || $("ws").hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.key === "Escape" && PLH.h) {
    e.preventDefault();
    // En un recorrido sin terminar, Esc lo termina; si no, sale de la herramienta
    if (PLH.h === "rec" && !PLH.med && PLH.pts.length > 1) return plTerminarRecorrido();
    plHerr(null);
  } else if (e.key === "Enter" && PLH.h === "rec") {
    e.preventDefault();
    plTerminarRecorrido();
  } else if (e.key === "F3" || e.key === "F8") {
    e.preventDefault();
    const c = $(e.key === "F3" ? "plSnap" : "plOrto");
    c.checked = !c.checked;
    toast(`${e.key === "F3" ? "Enganche" : "Orto"} ${c.checked ? "activado" : "desactivado"}`);
    plSobreDibujar();
  }
});
new ResizeObserver(() => {
  if (PL_VIS && plTam()) plDibujar();
}).observe(plLienzo);
// Arrastrar un archivo DXF sobre el panel
["dragover", "drop"].forEach(t =>
  $("plano").addEventListener(t, e => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    if (t === "drop") plAbrir(e.dataTransfer.files[0]);
  })
);

/* ---------- Panel lateral: plantas y capas ---------- */
function plPanel() {
  const m = PL_MOD;
  $("plLado").hidden = !m || plPanel.oculto;
  if (!m) return;
  const P = PLANO.plantas || [];
  $("plNPl").textContent = P.length || "";
  $("plPlantas").innerHTML = P.length
    ? P.map(
        (p, i) =>
          `<div class="pl-fila" data-plp="${i}"><button type="button" class="pl-nom" data-plv="${i}" title="Ver la planta">${esc(p.n)}</button><span class="pl-dim">${plFm(p.x1 - p.x0)} × ${plFm(p.y1 - p.y0)} m</span><button type="button" class="pl-x" data-plq="${i}" title="Quitar la planta (el dibujo no cambia)" aria-label="Quitar la planta">×</button></div>`
      ).join("")
    : `<p class="pl-nota">Encuadre cada planta del edificio con <b>Encuadrar planta</b>: así se ve con un clic y, en la etapa de diseño, cada piso tendrá la suya.</p>`;
  const oc = new Set(PLANO.ocultas),
    b = ($("plBusca").value || "").trim().toLowerCase(),
    // Solo las capas que dibujan algo
    nombres = Object.keys(m.capas)
      .filter(n => m.capas[n].n > 0)
      .sort((x, y) => x.localeCompare(y, "es", { numeric: true }));
  $("plNCap").textContent = `${nombres.length - nombres.filter(n => oc.has(n)).length} de ${nombres.length}`;
  $("plCapas").innerHTML = nombres
    .filter(n => !b || n.toLowerCase().includes(b))
    .map(n => {
      const c = m.capas[n];
      return `<label class="pl-capa${oc.has(n) ? " off" : ""}" title="${esc(n)} · ${c.n} elemento${c.n === 1 ? "" : "s"} dibujado${c.n === 1 ? "" : "s"}"><input type="checkbox" data-plc="${esc(n)}"${oc.has(n) ? "" : " checked"}><i style="background:${plColor(c.col)}"></i><span>${esc(n)}</span><em>${c.n}</em></label>`;
    })
    .join("");
}
$("plLado").addEventListener("change", e => {
  const c = e.target.closest("[data-plc]");
  if (!c) return;
  const n = c.dataset.plc,
    oc = new Set(PLANO.ocultas);
  if (c.checked) oc.delete(n);
  else oc.add(n);
  PLANO.ocultas = [...oc];
  plPreparar();
  plCambio();
});
$("plLado").addEventListener("click", e => {
  const v = e.target.closest("[data-plv]"),
    q = e.target.closest("[data-plq]");
  if (v) {
    const p = PLANO.plantas[+v.dataset.plv];
    plVer(p.x0, p.y0, p.x1, p.y1);
  } else if (q) {
    const i = +q.dataset.plq;
    confirmar(
      "¿Quitar la planta?",
      `<p>Se quita el encuadre <b>${esc(PLANO.plantas[i].n)}</b>. El plano de arquitectura no cambia y puede volver a encuadrarla.</p>`,
      "Quitar",
      ok => {
        if (!ok) return;
        PLANO.plantas.splice(i, 1);
        plCambio();
      }
    );
  }
});
$("plBusca").addEventListener("input", plPanel);

/* ---------- Mostrar la pestaña Diseño ---------- */
function plMostrar() {
  const m = PL_MOD,
    hay = !!PLANO;
  $("plVacio").hidden = !!m;
  if (!m) {
    $("plVacioT").innerHTML = hay
      ? `El plano <b>${esc(PLANO.nombre)}</b> no está guardado en este navegador`
      : "Abra el plano de arquitectura en DXF";
    $("plVacioS").innerHTML = hay
      ? "Ábralo de nuevo para continuar: se conservan la escala, las capas ocultas y las plantas del proyecto."
      : "Desde AutoCAD o cualquier programa de dibujo, con sus medidas reales. También puede arrastrar el archivo aquí.";
  }
  document.querySelectorAll("[data-pl-req]").forEach(b => (b.disabled = !m));
  $("plTenue").checked = !!(PLANO && PLANO.tenue);
  const u = $("plUnidad");
  u.disabled = !m;
  if (PLANO) {
    const o = [...u.options].find(x => Math.abs(+x.value - PLANO.f) < 1e-12);
    if (o) u.value = o.value;
    else {
      u.options[3].hidden = false;
      u.options[3].textContent = `1 u = ${fmt(PLANO.f, PLANO.f < 0.01 ? 4 : 3)} m`;
      u.value = "x";
    }
  }
  $("plEstadoU").textContent = PLANO
    ? `Unidad: ${PLANO.f === 1 ? "metros" : PLANO.f === 0.01 ? "centímetros" : PLANO.f === 0.001 ? "milímetros" : `1 u = ${fmt(PLANO.f, 4)} m`} · ${PL_DE[PLANO.de] || ""}`
    : "";
  $("plEstadoA").textContent = m
    ? `${PLANO.nombre} · ${Object.keys(m.capas).length} capas · ${m.nEnt.toLocaleString("es-PE")} objetos`
    : "";
  plPanel();
  if (PL_VIS) {
    plTam();
    plDibujar();
  }
}
// La pestaña Diseño de la cinta muestra el plano en el panel central; las demás, los resultados
function plPestana(on) {
  PL_VIS = on;
  $("ws").classList.toggle("en-diseno", on);
  $("plano").hidden = !on;
  if (!on) return plHerr(null);
  plTema();
  if (PLANO && !PL_MOD) plCargarGuardado();
  plMostrar();
}
document.querySelector("#ws .ap-tabs").addEventListener("click", e => {
  const t = e.target.closest("[data-tab-r]");
  if (t) plPestana(t.dataset.tabR === "diseno");
});
new MutationObserver(() => {
  if (!PL_VIS) return;
  plTema();
  plPanel();
  plDibujar();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-paleta"] });

/* ---------- Cinta: acciones de la pestaña Diseño ---------- */
$("ws").addEventListener("click", e => {
  const b = e.target.closest("[data-pl]");
  if (!b || b.disabled) return;
  const a = b.dataset.pl;
  if (a === "abrir") return $("plArchivo").click();
  if (!PL_MOD && a !== "quitar") return toast("Primero abra el plano de arquitectura en DXF");
  if (a === "quitar") {
    if (!PLANO) return toast("El proyecto no tiene plano de arquitectura");
    confirmar(
      "¿Quitar el plano de arquitectura?",
      `<p>El proyecto deja de usar <b>${esc(PLANO.nombre)}</b> y se pierden su escala, capas ocultas y plantas encuadradas. El archivo DXF de su computadora no cambia; puede volver a abrirlo.</p>`,
      "Quitar",
      ok => {
        if (!ok) return;
        PLANO = null;
        PL_MOD = PL_SHA = null;
        plHerr(null);
        plPreparar();
        plCambio();
      }
    );
  } else if (a === "ajustar") plAjustar();
  else if (a === "acercar") plZoom(1.5);
  else if (a === "alejar") plZoom(1 / 1.5);
  else if (a === "panel") {
    plPanel.oculto = !plPanel.oculto;
    plPanel();
    plTam();
    plDibujar();
  } else if (a === "todas" || a === "ninguna") {
    PLANO.ocultas = a === "todas" ? [] : Object.keys(PL_MOD.capas);
    plPreparar();
    plCambio();
  } else if (PL_NOMH[a]) plHerr(PLH.h === a ? null : a);
});
$("plArchivo").addEventListener("change", e => {
  plAbrir(e.target.files[0]);
  e.target.value = "";
});
$("plVacioB").addEventListener("click", () => $("plArchivo").click());
$("plTenue").addEventListener("change", e => {
  if (!PLANO) return;
  PLANO.tenue = e.target.checked;
  PL_COL.clear();
  plCambio();
});
$("plUnidad").addEventListener("change", e => {
  if (!PLANO || e.target.value === "x") return;
  PLANO.f = +e.target.value;
  PLANO.de = "manual";
  plCambio();
  toast("Unidad del dibujo cambiada: compruébela midiendo una cota conocida");
});
["plSnap", "plOrto"].forEach(id => $(id).addEventListener("change", () => plSobreDibujar()));
