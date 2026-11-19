/* EDITOR DE DISEÑO · VISTA Y ENGANCHE
   Conversión de coordenadas, zoom y desplazamiento, colores, dibujo del plano de arquitectura, lienzo superior
   (selección, mediciones, encuadres y plantas), enganche y orto.
   Antes era parte de js/plano.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
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
  const r = plLienzo.getBoundingClientRect();
  // Mientras el lienzo no tiene un tamaño real (oculto o acomodándose) no se toca la vista: el zoom se ajustaría a
  // ese tamaño casi nulo y el plano quedaría diminuto al volver
  if (r.width < 40 || r.height < 40) return false;
  const d = plDpr(),
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
  edAngPoner();
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
  if (typeof dpDibCambios === "function") dpDibCambios(g, d);
  if (typeof dpDibDuchas === "function") dpDibDuchas(g, d);
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
  } else if (pts.length && !["planta", "zventana", "lamzona", "rep", "rmur"].includes(PLH.h)) {
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
  if (!PLH.ali && (dsEsTub(PLH.h) || (PLH.agarre && PLH.agarre.t === "v"))) {
    const s = dsSalidaEn(x, y, r * 1.6);
    // (sobre el cuerpo del tablero manda el menú de sus salidas)
    if (s && !dsTableroEn(x, y, 0)) return [s.o.p[0], s.o.p[1], 8, { cir: s.o.n, tab: s.tb.id, nom: s.tb.nom || "" }];
  }
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
  } else if (
    u &&
    DSU.polar &&
    !PLH.eng &&
    !PLH.libre &&
    (PLH.h || PLH.arr) &&
    PLH.h !== "rep" &&
    !(PLH.h === "rmur" && PLH.pts.length > 1)
  ) {
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
