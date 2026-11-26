/* LÁMINAS Y EXPORTAR A DXF (editor de diseño)
   El dibujo del editor (arquitectura y diseño eléctrico) se «graba» con un lienzo de mentira (laGrabador): el mismo
   código que pinta la pantalla deja sus trazos, rellenos y textos en una lista. Con esa lista se arma:
   - la lámina en PDF (laSvg): papel A4 a A1, marco, la zona elegida a la escala del diseño, leyenda, escala gráfica,
     notas y el rótulo de la plataforma; se imprime con la ventana del navegador (Guardar como PDF);
   - el DXF del diseño en coordenadas reales (laDxf): mismas coordenadas que el plano del arquitecto, para
     superponerlo en AutoCAD; con sus capas, colores y textos (formato R12). Opcionalmente, con la arquitectura.
   Este archivo tiene el grabador y el armado de la lámina; el DXF está en js/editor/laminas-dxf.js y la ventana
   Lámina en js/editor/laminas-ventana.js. */
const LA_PX = 96 / 25.4; // unidades del SVG por milímetro de papel (como los demás planos)
const LA_K = 8; // píxeles de grabación por milímetro de papel (para que los textos pequeños se graben)
let DS_EXPORT = false;
let LA_CLIP = 0;

/* ---------- Grabador: un contexto 2D que guarda lo que se dibuja ---------- */
function laGrabador() {
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
  const g = {
    m: [1, 0, 0, 1, 0, 0],
    pila: [],
    items: [],
    camino: [],
    sub: null,
    strokeStyle: "#000",
    fillStyle: "#000",
    lineWidth: 1,
    font: "10px Arial",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    lineCap: "butt",
    lineJoin: "miter",
    guiones: [],
    capa: "0",
    T(x, y) {
      const m = this.m;
      return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    },
    esc() {
      const m = this.m;
      return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    },
    save() {
      this.pila.push({
        m: this.m,
        strokeStyle: this.strokeStyle,
        fillStyle: this.fillStyle,
        lineWidth: this.lineWidth,
        font: this.font,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
        globalAlpha: this.globalAlpha,
        guiones: this.guiones
      });
    },
    restore() {
      const s = this.pila.pop();
      if (s) Object.assign(this, s);
    },
    setTransform(a, b, c, d, e, f) {
      this.m = [a, b, c, d, e, f];
    },
    translate(x, y) {
      this.m = mul(this.m, [1, 0, 0, 1, x, y]);
    },
    rotate(t) {
      this.m = mul(this.m, [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0]);
    },
    scale(x, y) {
      this.m = mul(this.m, [x, 0, 0, y, 0, 0]);
    },
    setLineDash(a) {
      this.guiones = a || [];
    },
    getLineDash() {
      return this.guiones;
    },
    beginPath() {
      this.camino = [];
      this.sub = null;
    },
    moveTo(x, y) {
      this.sub = { p: [this.T(x, y)] };
      this.camino.push(this.sub);
    },
    lineTo(x, y) {
      if (!this.sub) return this.moveTo(x, y);
      this.sub.p.push(this.T(x, y));
    },
    closePath() {
      if (this.sub) this.sub.c = true;
    },
    arc(x, y, r, a0, a1, ccw) {
      let d = a1 - a0;
      if (ccw) d = d > 0 ? d - 2 * Math.PI * Math.ceil(d / (2 * Math.PI)) : d;
      else if (d < 0) d += 2 * Math.PI * Math.ceil(-d / (2 * Math.PI));
      const llena = Math.abs(d) >= 2 * Math.PI - 1e-6,
        n = Math.max(8, Math.ceil((Math.abs(d) / (2 * Math.PI)) * 48));
      for (let i = 0; i <= n; i++) {
        const a = a0 + (d * i) / n,
          px = x + r * Math.cos(a),
          py = y + r * Math.sin(a);
        if (i === 0 && (!this.sub || llena)) this.moveTo(px, py);
        else this.lineTo(px, py);
      }
      // Círculo completo: se guarda también como círculo (CIRCLE en el DXF)
      if (llena) {
        this.sub.c = true;
        this.sub.circ = [...this.T(x, y), r * this.esc()];
      }
    },
    ellipse(x, y, rx, ry, rot, a0, a1) {
      const n = 48;
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n,
          u = rx * Math.cos(a),
          v = ry * Math.sin(a),
          px = x + u * Math.cos(rot) - v * Math.sin(rot),
          py = y + u * Math.sin(rot) + v * Math.cos(rot);
        if (i === 0) this.moveTo(px, py);
        else this.lineTo(px, py);
      }
      this.sub.c = true;
    },
    rect(x, y, w, h) {
      this.moveTo(x, y);
      this.lineTo(x + w, y);
      this.lineTo(x + w, y + h);
      this.lineTo(x, y + h);
      this.closePath();
    },
    stroke() {
      const w = this.lineWidth * this.esc(),
        dash = this.guiones.length ? this.guiones.map(v => v * this.esc()) : null;
      this.camino.forEach(s => {
        if (s.p.length > 1 || s.circ)
          this.items.push({ t: "l", p: s.p, c: !!s.c, circ: s.circ, col: this.strokeStyle, w, dash, capa: this.capa });
      });
    },
    fill() {
      const pol = this.camino.filter(s => s.p.length > 2);
      if (pol.length && this.fillStyle && this.fillStyle !== "transparent")
        this.items.push({
          t: "f",
          pol: pol.map(s => ({ p: s.p, circ: s.circ })),
          col: this.fillStyle,
          capa: this.capa
        });
    },
    strokeRect(x, y, w, h) {
      this.beginPath();
      this.rect(x, y, w, h);
      this.stroke();
    },
    fillRect(x, y, w, h) {
      this.beginPath();
      this.rect(x, y, w, h);
      this.fill();
    },
    clearRect() {},
    measureText(t) {
      const px = parseFloat((/([\d.]+)px/.exec(this.font) || [0, 10])[1]);
      return { width: String(t).length * px * 0.55 };
    },
    fillText(s, x, y) {
      const px = parseFloat((/([\d.]+)px/.exec(this.font) || [0, 10])[1]),
        m = this.m;
      this.items.push({
        t: "t",
        s: String(s),
        p: this.T(x, y),
        h: px * this.esc(),
        ang: Math.atan2(m[1], m[0]),
        al: this.textAlign,
        bl: this.textBaseline,
        b: /700|bold/.test(this.font),
        it: /italic/.test(this.font),
        col: this.fillStyle,
        capa: this.capa
      });
    },
    strokeText() {}
  };
  return g;
}
// Color de un estilo del lienzo («#rrggbb», «#rgb» o «rgba(…)») en #rrggbb
function laHex(c) {
  c = String(c || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c))
    return (
      "#" +
      [...c.slice(1)]
        .map(x => x + x)
        .join("")
        .toLowerCase()
    );
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const v = m[1].split(",").map(Number);
    return (
      "#" +
      v
        .slice(0, 3)
        .map(x => Math.round(x).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  return "#000000";
}

/* ---------- Grabar el plano: arquitectura de la zona y diseño eléctrico ---------- */
// Dibuja con el grabador y devuelve sus elementos. cx, cy: centro de la zona; s: píxeles por unidad del dibujo
function laGrabar({ cx, cy, s, zona, arq, colorArq, leyenda, cuadro, cuadros, ocl, sinDis }) {
  // Capas del diseño que esta lámina no muestra
  const vis = dsD().capas.map(c => [c, c.vis]);
  (ocl || []).forEach(n => {
    const c = dsD().capas.find(x => x.n === n);
    if (c) c.vis = false;
  });
  const g = laGrabador(),
    vPLV = { ...PLV },
    vSuel = DSU.sueltos,
    vOsc = PL_OSCURO,
    vFondo = PL_FONDO,
    vCol = new Map(PL_COL);
  Object.assign(PLV, { cx, cy, s });
  DSU.sueltos = false;
  PL_OSCURO = false;
  PL_FONDO = "#ffffff";
  PL_COL.clear();
  DS_EXPORT = true;
  try {
    if (arq) laArq(g, zona, colorArq);
    if (!sinDis) dsPintar(g);
    if (leyenda) {
      g.capa = "E-LEYENDA";
      dsDibLeyenda(g, leyenda, "#14212e", s, 1.2);
    }
    [...(cuadro ? [cuadro] : []), ...(cuadros || [])].forEach(cu => {
      g.capa = "E-LEYENDA";
      dsDibCuadro(g, cu, "#14212e", s, 1.2);
    });
  } finally {
    Object.assign(PLV, vPLV);
    DSU.sueltos = vSuel;
    PL_OSCURO = vOsc;
    PL_FONDO = vFondo;
    PL_COL.clear();
    vCol.forEach((v, k) => PL_COL.set(k, v));
    DS_EXPORT = false;
    vis.forEach(([c, v]) => (c.vis = v));
  }
  return g.items;
}
// Arquitectura visible dentro de la zona: líneas, rellenos y textos, en gris, negro o sus colores
function laArq(g, z, modo) {
  const m = PL_MOD,
    oc = new Set(EPL.ocultas),
    dentro = p => {
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (let i = 0; i < p.length; i += 2) {
        x0 = Math.min(x0, p[i]);
        x1 = Math.max(x1, p[i]);
        y0 = Math.min(y0, p[i + 1]);
        y1 = Math.max(y1, p[i + 1]);
      }
      return x1 >= z[0] && x0 <= z[2] && y1 >= z[1] && y0 <= z[3];
    },
    color = c => (modo === "negro" ? "#000000" : modo === "gris" ? "#8a939d" : plColor(c));
  m.trazos.forEach(t => {
    if (oc.has(t.capa) || PL_BORR.has(t.e) || !dentro(t.p)) return;
    g.capa = "ARQ-" + t.capa;
    g.beginPath();
    for (let i = 0; i < t.p.length; i += 2) {
      const [X, Y] = plAPant(t.p[i], t.p[i + 1]);
      if (i) g.lineTo(X, Y);
      else g.moveTo(X, Y);
    }
    if (t.c) g.closePath();
    if (t.k === "l") {
      g.strokeStyle = color(t.col);
      g.lineWidth = 0.13 * LA_K;
      g.setLineDash([]);
      g.stroke();
    } else {
      g.fillStyle = modo === "color" ? plColor(t.col) : "#e4e7eb";
      g.fill();
    }
  });
  const s = PLV.s;
  m.textos.forEach(t => {
    if (oc.has(t.capa) || PL_BORR.has(t.e) || t.x < z[0] || t.x > z[2] || t.y < z[1] || t.y > z[3]) return;
    const hp = t.h * s,
      [X, Y] = plAPant(t.x, t.y);
    g.capa = "ARQ-" + t.capa;
    g.save();
    g.translate(X, Y);
    g.rotate(-t.rot);
    g.font = `${hp / 0.72}px Arial, sans-serif`;
    g.fillStyle = color(t.col);
    g.textAlign = t.ha;
    const ls = t.s.split("\n"),
      lh = hp * 1.667;
    g.textBaseline = t.mt ? (t.va === "top" ? "top" : t.va === "bottom" ? "bottom" : "middle") : t.va;
    const y0 = t.va === "top" ? 0 : t.va === "bottom" ? -(ls.length - 1) * lh : (-(ls.length - 1) * lh) / 2;
    ls.forEach((l, i) => g.fillText(l, 0, y0 + i * lh));
    g.restore();
  });
}

/* ---------- Lámina en SVG ---------- */
// Opciones de la lámina (con el proyecto: título, número y notas; en el navegador: papel, zona y colores)
const LA_DEF = {
  tam: "auto",
  zona: "",
  arq: "gris",
  color: "color",
  ley: true,
  tit: "Instalaciones eléctricas · Alumbrado y tomacorrientes",
  num: "IE-01",
  notas:
    "Diseño según el Código Nacional de Electricidad – Utilización y los símbolos de la Norma DGE.\nTuberías de PVC empotradas; las medidas se verifican en obra."
};
// Láminas del proyecto (la v3.0.0-b10 guardaba una sola en lam) y la elegida en la ventana
function laLista() {
  const D = dsD();
  if (!D.lams) D.lams = D.lam ? [D.lam] : [{}];
  delete D.lam;
  if (!D.lams.length) D.lams.push({});
  if (!(D.lamI >= 0 && D.lamI < D.lams.length)) D.lamI = 0;
  return D.lams;
}
const laOp = (i = dsD().lamI || 0) => ({ ...LA_DEF, ...(laLista()[i] || {}), _i: i, _n: laLista().length });
/* Zona del dibujo que va en la lámina: una planta encuadrada, lo que se ve en pantalla o todo el diseño. Una lámina con
   parte [ix, iy, nx, ny] muestra un rectángulo de esa zona dividida en nx columnas y ny filas (la fila 0 arriba): una
   planta que no entra en A1 a 1:75 se presenta en varias láminas (EM.010, Art. 8.5) */
function laZona(op) {
  const z = laZonaBase(op),
    pt = op.parte;
  if (!Array.isArray(pt) || pt.length !== 4 || op.zona === "vista") return z;
  const [ix, iy, nx, ny] = pt,
    w = (z[2] - z[0]) / nx,
    h = (z[3] - z[1]) / ny;
  return [z[0] + ix * w, z[3] - (iy + 1) * h, z[0] + (ix + 1) * w, z[3] - iy * h];
}
function laZonaBase(op) {
  // Sin zona elegida: la primera planta encuadrada
  const zona = op.zona || (EPL.plantas.length ? "planta:0" : "todo");
  if (zona === "rect" && op.rect) return op.rect.slice();
  if (zona.startsWith("planta:")) {
    const p = EPL.plantas[+zona.slice(7)];
    if (p) return [p.x0, p.y0, p.x1, p.y1];
  }
  if (zona === "vista") {
    const a = plADib(0, plH()),
      b = plADib(plW(), 0);
    return [a[0], a[1], b[0], b[1]];
  }
  const els = dsD().els;
  if (!els.length) return plExtUtil();
  const bb = els.map(dsBBox),
    m = 1 / EPL.f;
  return [
    Math.min(...bb.map(b => b[0])) - m,
    Math.min(...bb.map(b => b[1])) - m,
    Math.max(...bb.map(b => b[2])) + m,
    Math.max(...bb.map(b => b[3])) + m
  ];
}
/* Papel y escala automáticos: se elige el papel más chico donde entra la zona con su columna de leyenda, cuadro, notas
   y rótulo, primero a 1:50 y luego a 1:75, las escalas de los planos generales (Norma EM.010, Art. 8.5). Si no entra
   en A1 a 1:75, la escala siguiente, para que la lámina siga mostrando todo lo diseñado; se avisa la norma y el
   proyectista puede dividir la planta en varias láminas (laPartes), que nunca se hace solo. Con el papel o la escala
   elegidos a mano, solo se ajusta lo otro. */
const LA_ESC_AUTO = [50, 75, 100, 125, 150, 200, 250, 500];
const LA_ESC_NORMA = 75;
const LA_TAM_AUTO = ["A3", "A2", "A1"];
// Alto de cada fila de la leyenda en la lámina (mm; criterio: más compacta que la del editor)
const LA_LEY_FILA = 7;
// Tamaño del rótulo y de las notas según el papel (en A3 y A4, más chicos)
const laK = tam => ({ A4: 0.7, A3: 0.82 })[tam] || 1;
// Tamaño del rótulo según el papel (en A1 y A2, más grande, como los rótulos de los planos de obra)
const laKR = tam => ({ A4: 0.7, A3: 0.85, A2: 1.1, A1: 1.3 })[tam] || 1;
// Notas en líneas de un ancho dado (mm), con su número
function laNotas(notas, ancho, fs) {
  const max = Math.max(10, Math.floor(ancho / (fs * 0.53))),
    out = [];
  String(notas || "")
    .split("\n")
    .map(t => t.trim())
    .filter(Boolean)
    .forEach((t, i) => {
      let u = "";
      const ls = [];
      t.split(" ").forEach(p => {
        if ((u + " " + p).trim().length > max && u) {
          ls.push(u);
          u = p;
        } else u = (u + " " + p).trim();
      });
      ls.push(u);
      ls.forEach((l, j) => out.push([j ? "" : `${i + 1}.`, l]));
    });
  return out;
}
/* Disposición de la lámina en un papel y una escala (mm de papel): marco (25 mm a la izquierda para anillar, 10 mm en
   los demás lados), columna a la derecha con la leyenda, el cuadro de circuitos, las notas y el rótulo al pie; si el
   cuadro no cabe, sigue en otra columna a su izquierda, por tableros. El resto es el área de dibujo. */
function laDisp(op, tam, escD, z, c) {
  const [W, H] = LAMINAS[tam],
    k = laK(tam),
    g = 4,
    mx0 = 25,
    my0 = 10,
    mx1 = W - 10,
    my1 = H - 10,
    // Leyenda y cuadro: sus medidas en mm (DS_LEY, DS_CUA) por el factor del papel
    CU = { tit: DS_CUA.tit * k, fila: DS_CUA.fila * k, cab: DS_CUA.cab * k },
    cuaW = DS_CUA.w.reduce((a, b) => a + b, 0) * k,
    kr = laKR(tam),
    RW = Math.max(c.conLey ? c.leyW * k : 0, c.conCua ? cuaW : 0, 150 * kr),
    RH = 72 * kr,
    nfs = 2.1 * k,
    notas = laNotas(op.notas, RW - 9 * k, nfs),
    NH = notas.length ? 8 * k + notas.length * nfs * 1.55 + 2 : 0,
    x1 = mx1 - g,
    x0 = x1 - RW;
  let y = my0 + g;
  const ley = c.conLey ? { x: x0, y } : null;
  if (ley) y += c.leyH * k + g;
  // Cuadro: bloques por tablero (nombre, encabezado, circuitos y total), en la columna y luego en columnas a la izquierda
  const cuas = [];
  let col = { x: x0, y, fin: my1 - g - RH - (NH ? NH + g : 0) },
    act = null,
    sobra = false;
  if (c.conCua)
    c.bloques.forEach(b => {
      const bh = b.length * CU.fila + CU.cab;
      if (act && act.y + act.h + bh > col.fin) act = null;
      if (!act) {
        // Una columna más como máximo (en papel chico el cuadro no debe quitarle el sitio al dibujo)
        if (col.y + CU.tit + bh > col.fin) {
          if (col.x < x0) sobra = true;
          else {
            col = { x: x0 - g - cuaW, y: my0 + g, fin: my1 - g };
            if (col.y + CU.tit + bh > col.fin) sobra = true;
          }
        }
        act = { x: col.x, y: col.y, h: CU.tit, filas: [], cont: cuas.length > 0 };
        cuas.push(act);
      }
      act.filas.push(...b);
      act.h += bh;
      col.y = act.y + act.h + g;
    });
  const izq = Math.min(x0, ...cuas.map(u => u.x)),
    a = { x0: mx0 + g, y0: my0 + g, x1: izq - 2 * g, y1: my1 - g },
    mmU = (EPL.f * 1000) / escD,
    zw = (z[2] - z[0]) * mmU,
    zh = (z[3] - z[1]) * mmU;
  return {
    tam,
    escD,
    W,
    H,
    k,
    kr,
    mx0,
    my0,
    mx1,
    my1,
    g,
    RW,
    RH,
    NH,
    nfs,
    notas,
    x0,
    ley,
    cuas,
    sobra,
    a,
    sep: izq - g,
    mmU,
    zw,
    zh,
    entra: zw <= a.x1 - a.x0 + 0.5 && zh <= a.y1 - a.y0 + 0.5 && !sobra
  };
}
// Elige papel y escala (los que son automáticos) para la zona; si nada entra, el papel y la escala mayores
function laElegir(op, z, c) {
  const tams = LAMINAS[op.tam] ? [op.tam] : LA_TAM_AUTO,
    escs = op.esc > 0 ? [op.esc] : LA_ESC_AUTO;
  for (const e of escs)
    for (const t of tams) {
      const d = laDisp(op, t, e, z, c);
      if (!d.entra) continue;
      /* Papel fijo y escala automática que no llega a 1:75 (las láminas de versiones anteriores guardaban A3, que era
         el papel por defecto): va en el papel automático; para ese papel a otra escala, se fija también la escala */
      if (LAMINAS[op.tam] && !(op.esc > 0) && e > 75) {
        const a = laElegir({ ...op, tam: "auto" }, z, c);
        if (a.entra && a.escD < e) return { ...a, papelFijo: op.tam, escFijo: e };
      }
      return d;
    }
  return laDisp(op, tams[tams.length - 1], op.esc > 0 ? op.esc : LA_ESC_NORMA, z, c);
}
// Con la escala de la lámina y sus capas: los símbolos, textos, leyenda y cuadro miden lo mismo en el papel a
// cualquier escala (como los objetos anotativos de AutoCAD); la arquitectura sí cambia con la escala
function laCon(esc, ocl, fn) {
  const D = dsD(),
    e0 = D.escala,
    vis = D.capas.map(c => [c, c.vis]);
  D.escala = esc;
  (ocl || []).forEach(n => {
    const c = D.capas.find(x => x.n === n);
    if (c) c.vis = false;
  });
  try {
    return fn();
  } finally {
    D.escala = e0;
    vis.forEach(([c, v]) => (c.vis = v));
  }
}
// Nombre de la vista bajo el dibujo
function laVistaTit(op) {
  const z = op.zona || (EPL.plantas.length ? "planta:0" : "todo"),
    pt = Array.isArray(op.parte) ? op.parte : null,
    p = pt && pt[2] * pt[3] > 1 ? ` · PARTE ${pt[1] * pt[2] + pt[0] + 1} DE ${pt[2] * pt[3]}` : "";
  if (z.startsWith("planta:") && EPL.plantas[+z.slice(7)])
    return "PLANTA " + EPL.plantas[+z.slice(7)].n.toUpperCase() + p;
  return (op.tit || "Instalaciones eléctricas").toUpperCase() + p;
}
/* Contenido de la columna de la lámina para la zona z: leyenda, cuadro de circuitos por tablero y sus medidas. Una
   parte de una planta lleva la leyenda y el cuadro de toda la planta. */
function laContenido(op, z0) {
  const D = dsD(),
    z = Array.isArray(op.parte) ? laZonaBase(op) : z0,
    dentro = t =>
      D.els.some(
        e => e.t === t && dsBBox(e)[0] < z[2] && dsBBox(e)[2] > z[0] && dsBBox(e)[1] < z[3] && dsBBox(e)[3] > z[1]
      ),
    conLey = op.ley && !dentro("ley") && D.els.some(e => e.t !== "ley"),
    conCua = op.cua !== false && !dentro("cua") && D.els.some(e => e.k === "tab" && e.nc),
    filasLey = conLey ? laCon(D.escala, op.ocl, () => dsFilasLey().length) : 0,
    // Bloques del cuadro: cada tablero con sus circuitos y su total
    bloques = [];
  if (conCua) {
    dsFilasCua().forEach(f => {
      if (f.tit || !bloques.length) bloques.push([]);
      bloques[bloques.length - 1].push(f);
    });
    // Solo los tableros que están en la zona (si alguno lo está): cada planta con los suyos
    const enZ = new Set(
      D.els
        .filter(e => e.k === "tab" && e.nc && e.x >= z[0] && e.x <= z[2] && e.y >= z[1] && e.y <= z[3])
        .map(e => e.nom || "Tablero")
    );
    if (enZ.size) {
      const sel = bloques.filter(b => b[0].tit && enZ.has(b[0].tit));
      bloques.splice(0, bloques.length, ...sel);
    }
  }
  return {
    conLey,
    conCua,
    leyW: DS_LEY.w.reduce((a, b) => a + b, 0),
    leyH: DS_LEY.tit + DS_LEY.cab + Math.max(1, filasLey) * LA_LEY_FILA,
    bloques
  };
}
/* Partes en que se divide una lámina cuya zona no entra en A1 a 1:75 (EM.010, Art. 8.5): la menor cantidad de
   columnas y filas iguales con las que cada parte entra en A1 a 1:75; todas en A1 y a 1:75, numeradas como el
   unifilar (IE-01, IE-01A, IE-01B…). Devuelve [op] si entra, o la lista de láminas. */
function laPartes(op) {
  const base = { ...op };
  delete base.parte;
  const z = laZona(base),
    entraEn = o => {
      const zz = laZona(o);
      return laDisp(o, "A1", LA_ESC_NORMA, zz, laContenido(o, zz)).entra;
    };
  const e0 = laElegir(base, z, laContenido(base, z));
  if (e0.entra && e0.escD <= LA_ESC_NORMA) return [op];
  const d = laDisp(base, "A1", LA_ESC_NORMA, z, laContenido(base, z)),
    aw = Math.max(1, d.a.x1 - d.a.x0),
    ah = Math.max(1, d.a.y1 - d.a.y0);
  let nx = Math.max(1, Math.ceil(d.zw / aw)),
    ny = Math.max(1, Math.ceil(d.zh / ah));
  for (let k = 0; k < 12; k++) {
    const ps = [];
    for (let iy = 0; iy < ny; iy++)
      for (let ix = 0; ix < nx; ix++) ps.push({ ...base, tam: "A1", esc: LA_ESC_NORMA, parte: [ix, iy, nx, ny] });
    if (ps.every(entraEn)) {
      const num0 = base.num || "IE-01";
      return ps.map((p, i) => ({ ...p, num: i ? num0 + String.fromCharCode(64 + i) : num0 }));
    }
    // La dimensión que más sobra se divide una vez más
    if (d.zw / nx / aw >= d.zh / ny / ah) nx++;
    else ny++;
  }
  return [op];
}
// Arma la lámina: devuelve { svg, aviso, W, H, tam, esc } (aviso si la zona no entra en el papel a esa escala)
function laSvg(op = laOp(), lista) {
  const z = laZona(op),
    P = {
      nombre: $("p_nombre").value,
      prop: $("p_prop").value,
      ubic: $("p_ubic").value,
      proy: $("p_proy").value,
      cip: $("p_cip").value
    },
    c = laContenido(op, z),
    d = laElegir(op, z, c),
    { W, H, k, escD, mmU, a, mx0, my0, mx1, my1 } = d,
    acx = (a.x0 + a.x1) / 2,
    acy = (a.y0 + a.y1) / 2,
    cx = (z[0] + z[2]) / 2,
    cy = (z[1] + z[3]) / 2,
    s = mmU * LA_K,
    aDib = (px, py) => [cx + (px - acx) / mmU, cy - (py - acy) / mmU];
  // Otra lámina con la misma zona y las mismas capas (se imprimiría dos veces lo mismo)
  const zk = o =>
      (o.zona || (EPL.plantas.length ? "planta:0" : "todo")) +
      "|" +
      (o.parte || []).join(",") +
      "|" +
      (o.ocl || []).slice().sort().join(","),
    igual = Number.isInteger(op._i)
      ? laLista()
          .map((l, i) => laOp(i))
          .find((o, i) => i !== op._i && zk(o) === zk(op))
      : null;
  const aviso = d.papelFijo
    ? `En ${d.papelFijo} la planta quedaba a 1:${d.escFijo}: va en ${d.tam} a 1:${escD}. Para usar ${d.papelFijo}, elija también la escala.`
    : igual
      ? `Esta lámina muestra lo mismo que la ${igual.num} (la misma zona y las mismas capas): elija otra zona u oculte otras capas, o elimínela.`
      : d.entra
        ? escD > LA_ESC_NORMA
          ? !LAMINAS[op.tam] && !(op.esc > 0) && op.zona !== "vista"
            ? `La zona entra en A1 recién a 1:${escD} y los símbolos quedan juntos (miden lo mismo en el papel a cualquier escala). La Norma EM.010 (Art. 8.5) pide los planos generales a 1:50 o 1:75: si lo prefiere, divídala en ${laPartes(op).length} láminas.`
            : `A 1:${escD} los símbolos quedan juntos (miden lo mismo en el papel a cualquier escala)${LAMINAS[op.tam] ? `: el papel está fijo en ${op.tam}` : ""}. La Norma EM.010 (Art. 8.5) pide los planos generales a 1:50 o 1:75: use el papel y la escala automáticos o divida la planta en varias láminas.`
          : ""
        : !LAMINAS[op.tam] && !(op.esc > 0) && !d.sobra && a.x1 - a.x0 >= 60
          ? `La zona no entra en A1 a 1:75 (${fmt(d.zw, 0)} × ${fmt(d.zh, 0)} mm en un área de ${fmt(a.x1 - a.x0, 0)} × ${fmt(a.y1 - a.y0, 0)} mm). La Norma EM.010 (Art. 8.5) pide los planos generales a 1:50 o 1:75: divídala en ${laPartes(op).length} láminas.`
          : a.x1 - a.x0 < 60
            ? `En ${d.tam} no queda sitio para el dibujo junto a la leyenda, el cuadro y el rótulo: elija un papel más grande o el automático.`
            : d.sobra
              ? `El cuadro de circuitos no cabe en ${d.tam}: elija un papel más grande o quite el cuadro de esta lámina.`
              : `La zona (${fmt(d.zw, 0)} × ${fmt(d.zh, 0)} mm a 1:${escD}) no entra en el área de dibujo de ${d.tam} (${fmt(a.x1 - a.x0, 0)} × ${fmt(a.y1 - a.y0, 0)} mm): elija un papel más grande, otra escala o marque una zona menor.`;
  const ley = d.ley ? (([x, y]) => ({ t: "ley", tit: "LEYENDA", x, y }))(aDib(d.ley.x, d.ley.y)) : null,
    cuadros = d.cuas.map(u =>
      (([x, y]) => ({
        t: "cua",
        tit: u.cont ? "CUADRO DE CIRCUITOS (continuación)" : "CUADRO DE CIRCUITOS",
        x,
        y,
        filas: u.filas
      }))(aDib(u.x, u.y))
    );
  /* El plano a la escala de la lámina; la leyenda y el cuadro, aparte, con el factor del papel (la escala del dibujo
     dividida por él) y la leyenda con el ancho de la columna (más ancha la descripción) */
  const lw0 = DS_LEY.w[1],
    lf0 = DS_LEY.fila,
    base = { cx, cy, s, zona: [z[0], z[1], z[2], z[3]], ocl: op.ocl };
  let items;
  try {
    DS_LEY.w[1] += Math.max(0, d.RW / k - c.leyW);
    DS_LEY.fila = LA_LEY_FILA;
    items = [
      ...laCon(escD, op.ocl, () => laGrabar({ ...base, arq: true, colorArq: op.arq })),
      ...laCon(escD * k, op.ocl, () => laGrabar({ ...base, sinDis: true, leyenda: ley, cuadros }))
    ];
  } finally {
    DS_LEY.w[1] = lw0;
    DS_LEY.fila = lf0;
  }
  // Del lienzo de grabación al papel (mm), con el centro de la zona en el centro del área
  const Wc = plW() / 2,
    Hc = plH() / 2,
    X = v => +((acx + (v - Wc) / LA_K) * LA_PX).toFixed(2),
    Y = v => +((acy + (v - Hc) / LA_K) * LA_PX).toFixed(2),
    bn = op.color === "bn",
    C = col => (bn ? (laHex(col) === "#ffffff" ? "#ffffff" : "#000000") : laHex(col));
  const o = [],
    q = n => +(n * LA_PX).toFixed(2),
    INK = "#14212e",
    NAVY = "#14304f",
    // Recorte: la zona (la planta) dentro del área de dibujo; si el área es más grande, no se ve lo de al lado
    cl = [
      Math.max(a.x0, acx - d.zw / 2),
      Math.max(a.y0, acy - d.zh / 2),
      Math.min(a.x1, acx + d.zw / 2),
      Math.min(a.y1, acy + d.zh / 2)
    ],
    // Recorte propio de cada lámina: con varias en la misma página (PDF de todas, expediente) un id repetido
    // haría que todas usen el recorte de la primera
    cid = "laArea" + ++LA_CLIP;
  o.push(
    `<defs><clipPath id="${cid}"><rect x="${q(cl[0])}" y="${q(cl[1])}" width="${q(cl[2] - cl[0])}" height="${q(cl[3] - cl[1])}"/></clipPath></defs>`
  );
  const cuerpo = [],
    leyO = [];
  items.forEach(it => {
    const dst = it.capa === "E-LEYENDA" ? leyO : cuerpo,
      // Su capa (la de la arquitectura o la del diseño): el DXF de la lámina la conserva
      dc = it.capa ? ` data-capa="${esc(it.capa)}"` : "";
    if (it.t === "l") {
      const p = it.p.map((pp, i) => `${i ? "L" : "M"}${X(pp[0])} ${Y(pp[1])}`).join("") + (it.c ? "Z" : "");
      dst.push(
        `<path${dc} d="${p}" fill="none" stroke="${C(it.col)}" stroke-width="${Math.max(0.1, it.w / LA_K) * LA_PX}"${it.dash ? ` stroke-dasharray="${it.dash.map(v => +((v / LA_K) * LA_PX).toFixed(2)).join(" ")}"` : ""} stroke-linecap="round" stroke-linejoin="round"/>`
      );
    } else if (it.t === "f") {
      const p = it.pol.map(u => u.p.map((pp, i) => `${i ? "L" : "M"}${X(pp[0])} ${Y(pp[1])}`).join("") + "Z").join("");
      dst.push(`<path${dc} d="${p}" fill="${C(it.col)}" stroke="none" fill-rule="evenodd"/>`);
    } else if (it.t === "t") {
      const fs = +((it.h / LA_K) * LA_PX).toFixed(2),
        an = it.al === "center" ? "middle" : it.al === "right" || it.al === "end" ? "end" : "start",
        db =
          it.bl === "middle"
            ? "central"
            : it.bl === "top" || it.bl === "hanging"
              ? "hanging"
              : it.bl === "bottom"
                ? "text-after-edge"
                : "alphabetic",
        x = X(it.p[0]),
        y = Y(it.p[1]),
        ang = +((it.ang * 180) / Math.PI).toFixed(2);
      dst.push(
        `<text${dc} x="${x}" y="${y}" font-size="${fs}"${it.b ? ' font-weight="700"' : ""}${it.it ? ' font-style="italic"' : ""} text-anchor="${an}" dominant-baseline="${db}" fill="${C(it.col)}"${ang ? ` transform="rotate(${ang} ${x} ${y})"` : ""}>${esc(it.s)}</text>`
      );
    }
  });
  o.push(`<g clip-path="url(#${cid})">${cuerpo.join("")}</g>`, leyO.join(""));
  /* Planta en varias láminas: línea de corte en cada borde que sigue en otra lámina, con su número */
  if (Array.isArray(op.parte)) {
    const [ix, iy, nx, ny] = op.parte,
      L2 = lista || laLista().map((l, i) => laOp(i)),
      vec = (dx, dy) =>
        L2.find(
          o =>
            Array.isArray(o.parte) &&
            (o.zona || "") === (op.zona || "") &&
            o.parte[0] === ix + dx &&
            o.parte[1] === iy + dy &&
            o.parte[2] === nx &&
            o.parte[3] === ny
        ),
      fsC = 2.6 * k,
      lc = (x1, y1, x2, y2) =>
        o.push(
          `<line x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}" stroke="${NAVY}" stroke-width="${q(0.5)}" stroke-dasharray="${q(6)} ${q(2)} ${q(1)} ${q(2)}"/>`
        ),
      tc = (x, y, t, rot) =>
        o.push(
          `<text x="${q(x)}" y="${q(y)}" font-size="${q(fsC)}" font-weight="700" text-anchor="middle" fill="${NAVY}"${rot ? ` transform="rotate(${rot} ${q(x)} ${q(y)})"` : ""}>${esc(t)}</text>`
        );
    [
      [1, 0, () => (lc(cl[2], cl[1], cl[2], cl[3]), t => tc(cl[2] - 1.5 * k, (cl[1] + cl[3]) / 2, t, -90))],
      [-1, 0, () => (lc(cl[0], cl[1], cl[0], cl[3]), t => tc(cl[0] + 1.5 * k + fsC, (cl[1] + cl[3]) / 2, t, -90))],
      [0, 1, () => (lc(cl[0], cl[3], cl[2], cl[3]), t => tc((cl[0] + cl[2]) / 2, cl[3] - 1.5 * k, t))],
      [0, -1, () => (lc(cl[0], cl[1], cl[2], cl[1]), t => tc((cl[0] + cl[2]) / 2, cl[1] + 1.5 * k + fsC, t))]
    ].forEach(([dx, dy, f]) => {
      const v = vec(dx, dy);
      if (v) f()(`LÍNEA DE CORTE · CONTINÚA EN LA LÁMINA ${v.num}`);
    });
  }
  // Separación entre el área de dibujo y la columna
  o.push(
    `<line x1="${q(d.sep)}" y1="${q(my0)}" x2="${q(d.sep)}" y2="${q(my1)}" stroke="${NAVY}" stroke-width="${q(0.35)}"/>`
  );
  // Título de la vista, su escala y la escala gráfica: debajo del dibujo si hay sitio; si no, abajo a la izquierda
  const paso = [0.5, 1, 2, 5, 10].find(v => v * (1000 / escD) * 5 <= 70 * k) || 0.5,
    lm = paso * (1000 / escD),
    tit = laVistaTit(op),
    tfs = 4.2 * k,
    tw = Math.max(tit.length * tfs * 0.62, 5 * lm + 30 * k),
    abajo = a.y1 - (acy + d.zh / 2) >= 17 * k,
    tx = abajo ? acx - tw / 2 : a.x0 + 3,
    ty = abajo ? acy + d.zh / 2 + 4 * k : a.y1 - 15 * k;
  if (!abajo)
    o.push(
      `<rect x="${q(tx - 2)}" y="${q(ty - 2)}" width="${q(tw + 4)}" height="${q(15 * k)}" fill="#fff" fill-opacity="0.92"/>`
    );
  o.push(
    `<text x="${q(tx)}" y="${q(ty + tfs * 0.85)}" font-size="${q(tfs)}" font-weight="700" fill="${NAVY}">${esc(tit)}</text>`,
    `<line x1="${q(tx)}" y1="${q(ty + tfs * 1.25)}" x2="${q(tx + tw)}" y2="${q(ty + tfs * 1.25)}" stroke="${NAVY}" stroke-width="${q(0.5)}"/>`
  );
  const ex = tx,
    ey = ty + tfs * 1.25 + 4.2 * k;
  for (let i = 0; i < 5; i++)
    o.push(
      `<rect x="${q(ex + i * lm)}" y="${q(ey)}" width="${q(lm)}" height="${q(1.4 * k)}" fill="${i % 2 ? "#ffffff" : INK}" stroke="${INK}" stroke-width="${q(0.15)}"/>`
    );
  for (let i = 0; i <= 5; i++)
    o.push(
      `<text x="${q(ex + i * lm)}" y="${q(ey - 0.9 * k)}" font-size="${q(1.8 * k)}" text-anchor="middle" fill="${INK}">${fmt(i * paso, paso < 1 ? 1 : 0)}</text>`
    );
  o.push(
    `<text x="${q(ex + 5 * lm + 3 * k)}" y="${q(ey + 1.4 * k)}" font-size="${q(2.4 * k)}" font-weight="700" fill="${INK}">m · ESCALA 1:${escD}</text>`
  );
  // Notas sobre el rótulo
  const ry = my1 - d.g - d.RH;
  if (d.NH) {
    const ny = ry - d.g - d.NH,
      nfs = d.nfs;
    o.push(
      `<rect x="${q(d.x0)}" y="${q(ny)}" width="${q(d.RW)}" height="${q(d.NH)}" fill="none" stroke="${NAVY}" stroke-width="${q(0.3)}"/>`,
      `<text x="${q(d.x0 + 2.5 * k)}" y="${q(ny + 5 * k)}" font-size="${q(2.6 * k)}" font-weight="700" fill="${NAVY}">NOTAS</text>`
    );
    d.notas.forEach(([n, l], i) => {
      const yy = ny + 8 * k + nfs + i * nfs * 1.55;
      if (n)
        o.push(
          `<text x="${q(d.x0 + 2.5 * k)}" y="${q(yy)}" font-size="${q(nfs)}" font-weight="700" fill="${NAVY}">${n}</text>`
        );
      o.push(`<text x="${q(d.x0 + 7 * k)}" y="${q(yy)}" font-size="${q(nfs)}" fill="${INK}">${esc(l)}</text>`);
    });
  }
  // Rótulo al pie de la columna
  rotuloLamina(o, q, d.x0, ry, d.RW, d.RH, P, {
    plano: op.tit,
    esc: `1:${escD}`,
    num: op.num,
    de: op._n > 1 ? `${op._i + 1} de ${op._n}` : "",
    k: d.kr
  });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${q(W)} ${q(H)}" font-family="Arial, Helvetica, sans-serif">` +
    `<rect width="${q(W)}" height="${q(H)}" fill="#fff"/><rect x="${q(mx0)}" y="${q(my0)}" width="${q(mx1 - mx0)}" height="${q(my1 - my0)}" fill="none" stroke="${NAVY}" stroke-width="${q(0.7)}"/>` +
    o.join("") +
    `</svg>`;
  return { svg, aviso, W, H, tam: d.tam, esc: escD };
}
