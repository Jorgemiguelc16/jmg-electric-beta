/* DISEÑO ELÉCTRICO EN EL EDITOR (etapa 2 del diseño en planta)
   Los elementos que el proyectista dibuja sobre el plano de arquitectura, guardados en la copia del editor como
   EPL.dis = { capas, actual, els, escala } (pasan al proyecto con Aplicar, en PLANO.dis):
   - símbolos de la Norma DGE «Símbolos gráficos en electricidad» (R.M. N.° 091-2002-EM/VME), los mismos de las
     láminas (simboloDGE() en js/simbolos.js), cada uno con su código, en la capa de su sistema (alumbrado,
     tomacorrientes, fuerza, comunicaciones, canalización, tableros, tierra), con rotación, altura de montaje,
     potencia y circuito;
   - líneas, polilíneas, rectángulos, círculos y textos en la capa actual, y tuberías por techo o pared (línea
     continua) o por piso (línea discontinua);
   - capas propias del diseño con color, tipo de línea, visibilidad y bloqueo (Administrador de capas, js/capas.js).
   El tamaño de los símbolos y textos sale de la escala de impresión prevista (criterio: la Norma DGE, 024, permite
   agrandarlos o reducirlos conservando sus proporciones). Las coordenadas están en unidades del dibujo, las mismas
   del plano de arquitectura. La rejilla y el forzado del cursor a la rejilla son preferencias de esta computadora. */

// Sistemas: capa por defecto de sus símbolos y su color
const DS_SIS = {
  alu: { capa: "E-ALUMBRADO", col: "#d08700", n: "Alumbrado" },
  tom: { capa: "E-TOMACORRIENTES", col: "#c62828", n: "Tomacorrientes" },
  fza: { capa: "E-FUERZA", col: "#7b1fa2", n: "Cargas especiales" },
  com: { capa: "E-COMUNICACIONES", col: "#00838f", n: "Comunicaciones" },
  can: { capa: "E-CANALIZACION", col: "#546e7a", n: "Canalización" },
  tab: { capa: "E-TABLEROS", col: "#14304f", n: "Tableros" },
  tie: { capa: "E-TIERRA", col: "#2e7d32", n: "Puesta a tierra" },
  tub: { capa: "E-TUBERIAS", col: "#1565c0", n: "Tuberías" },
  dib: { capa: "E-DIBUJO", col: "#37474f", n: "Dibujo y textos" }
};
/* Símbolos que se pueden colocar: nombre, código de la Norma DGE, sistema, altura de montaje por defecto (dato de
   Parámetros › Alturas; null si va en el techo o no corresponde) y potencia por defecto (dato del proyecto). Las
   letras A y F de las salidas de aire acondicionado y de fuerza son las que la norma deja definir en la leyenda
   del plano (09-93-13: letra del tipo abajo a la derecha). */
const DS_CAT = {
  luz: { n: "Salida de alumbrado en techo", c: "09-93-51", s: "alu", h: null, p: "al_p", u: "W" },
  braq: { n: "Salida de alumbrado en pared (braquete)", c: "09-93-52", s: "alu", h: "hBraq", p: "al_p", u: "W" },
  emer: { n: "Luminaria de emergencia", c: "09-93-67", s: "alu", h: "hBraq", u: "W" },
  emerB: { n: "Bloque autónomo de emergencia", c: "09-93-68", s: "alu", h: "hBraq", u: "W" },
  int: { n: "Interruptor unipolar", c: "09-93-30", s: "alu", h: "hInt" },
  int2: { n: "Interruptor bipolar", c: "09-93-31", s: "alu", h: "hInt" },
  int3: { n: "Interruptor de tres vías (conmutación)", c: "09-93-32", s: "alu", h: "hInt" },
  int4: { n: "Interruptor de cuatro vías", c: "09-93-33", s: "alu", h: "hInt" },
  toma: { n: "Tomacorriente monofásico con puesta a tierra", c: "09-93-17", s: "tom", h: "hToma", p: "tg_p", u: "VA" },
  toma1: { n: "Tomacorriente monofásico", c: "09-93-13", s: "tom", h: "hToma", p: "tg_p", u: "VA" },
  toma3: { n: "Tomacorriente trifásico", c: "09-93-15", s: "tom", h: "hToma", u: "VA" },
  tomaPA: { n: "Tomacorriente a prueba de agua", c: "09-93-19", s: "tom", h: "hToma", p: "tg_p", u: "VA" },
  coc: { n: "Salida trifásica para cocina", c: "09-93-18", s: "fza", h: "hFza", u: "W" },
  terma: { n: "Calentador de agua (terma)", c: "09-93-69", s: "fza", h: "hTerma", u: "W" },
  aire: { n: "Salida para aire acondicionado", c: "09-93-13 · letra A", s: "fza", h: "hAire", u: "W" },
  fza: { n: "Salida de fuerza", c: "09-93-13 · letra F", s: "fza", h: "hFza", u: "W" },
  itc: { n: "Intercomunicador", c: "09-93-73", s: "com", h: "hInt" },
  pul: { n: "Pulsador de timbre", c: "09-93-43", s: "com", h: "hInt" },
  timbre: { n: "Timbre (campana)", c: "08-80-49", s: "com", h: "hBraq" },
  caja: { n: "Caja de paso", c: "09-93-08", s: "can", h: null },
  subida: { n: "Canalización que sube", c: "09-93-05", s: "can", h: null },
  bajada: { n: "Canalización que baja", c: "09-93-06", s: "can", h: null },
  tab: { n: "Tablero de distribución empotrado", c: "09-91-17", s: "tab", h: "hTab" },
  med: { n: "Medidor de energía", c: "08-80-22", s: "tab", h: "hMed" },
  pat: { n: "Pozo de puesta a tierra", c: "03-31-46", s: "tie", h: null }
};
const DS_LT = { cont: "Continua", trazos: "Trazos", punto: "Trazo y punto" };
const DS_ESCALAS = [50, 75, 100];
// Herramientas de dibujo: nombre e indicación de cada paso
const DS_HERR = {
  lin: "Línea",
  pol: "Polilínea",
  rect: "Rectángulo",
  cir: "Círculo",
  txt: "Texto",
  tubT: "Tubería en techo o pared",
  tubP: "Tubería en piso"
};
Object.keys(DS_HERR).forEach(k => (PL_NOMH[k] = DS_HERR[k]));

/* ---------- Datos del diseño ---------- */
function dsNuevo() {
  return {
    capas: Object.values(DS_SIS).map(s => ({ n: s.capa, col: s.col, lt: "cont", vis: true, bloq: false })),
    actual: DS_SIS.dib.capa,
    els: [],
    escala: 50
  };
}
// La copia del editor siempre tiene su diseño (los proyectos de la etapa 1 no lo traen)
function dsAsegurar() {
  if (!EPL) return;
  if (!EPL.dis) EPL.dis = dsNuevo();
  // Un símbolo que esta versión no conoce no se puede dibujar ni editar: se deja fuera
  EPL.dis.els = EPL.dis.els.filter(el => el.t !== "sim" || DS_CAT[el.k]);
}
const dsD = () => (EPL && EPL.dis) || null;
// Capa del diseño por nombre; si no existe (por ejemplo, la borró el usuario) se crea con su color de sistema
function dsCapa(n) {
  const D = dsD();
  let c = D.capas.find(x => x.n === n);
  if (!c) {
    const s = Object.values(DS_SIS).find(x => x.capa === n);
    c = { n, col: s ? s.col : "#37474f", lt: "cont", vis: true, bloq: false };
    D.capas.push(c);
  }
  return c;
}
const dsCapaDe = el => dsD().capas.find(x => x.n === el.capa) || { col: "#37474f", lt: "cont", vis: true, bloq: false };
const dsVis = el => dsCapaDe(el).vis;
const dsEditable = el => dsCapaDe(el).vis && !dsCapaDe(el).bloq;
// Unidades del dibujo por unidad de símbolo: un símbolo de 17 unidades mide unos 7 mm impreso a la escala elegida
const dsU = () => ((dsD() ? dsD().escala : 50) * 0.0004) / (EPL ? EPL.f : 1);
// Metros impresos a escala → unidades del dibujo (alto de texto, guiones de las tuberías)
const dsMm = mm => ((dsD() ? dsD().escala : 50) * mm) / 1000 / (EPL ? EPL.f : 1);
let DS_N = 0;
const dsId = () => {
  const D = dsD();
  if (!DS_N) DS_N = D.els.reduce((m, e) => Math.max(m, parseInt(String(e.id).slice(1), 10) || 0), 0);
  return "d" + ++DS_N;
};
// Selección del diseño (ids) y portapapeles
const DS_SEL = new Set();
let DS_PORTA = [];

/* ---------- Símbolos: primitivas a partir del SVG de simboloDGE() ---------- */
const DS_PRIM = {},
  DS_BB = {};
function dsPrims(k) {
  if (DS_PRIM[k]) return DS_PRIM[k];
  const o = [];
  if (!simboloDGE(o, k, 0, 0, 1)) return (DS_PRIM[k] = []);
  const at = (s, n) => {
      const m = s.match(new RegExp(`\\s${n}="([^"]*)"`));
      return m ? m[1] : null;
    },
    nu = (s, n, d = 0) => {
      const v = at(s, n);
      return v == null ? d : parseFloat(v);
    };
  DS_PRIM[k] = o
    .map(s => {
      const tag = (s.match(/^<(\w+)/) || [])[1],
        b = { st: at(s, "stroke"), fi: at(s, "fill"), w: nu(s, "stroke-width", 1), dash: at(s, "stroke-dasharray") };
      if (tag === "line") return { ...b, t: "l", a: ["x1", "y1", "x2", "y2"].map(n => nu(s, n)) };
      if (tag === "circle") return { ...b, t: "c", a: ["cx", "cy", "r"].map(n => nu(s, n)) };
      if (tag === "ellipse") return { ...b, t: "e", a: ["cx", "cy", "rx", "ry"].map(n => nu(s, n)) };
      if (tag === "rect") return { ...b, t: "r", a: ["x", "y", "width", "height"].map(n => nu(s, n)) };
      if (tag === "path") return { ...b, t: "p", a: (at(s, "d").match(/-?[\d.]+/g) || []).map(Number) };
      if (tag === "text")
        return {
          ...b,
          t: "t",
          a: [nu(s, "x"), nu(s, "y"), nu(s, "font-size", 9)],
          tx: s
            .replace(/<[^>]*>/g, "")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, "&"),
          b: / font-weight="700"/.test(s),
          it: / font-style="italic"/.test(s),
          an: at(s, "text-anchor") || "start"
        };
      return null;
    })
    .filter(Boolean);
  // Rectángulo que ocupa el símbolo (unidades del símbolo, y hacia abajo)
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const ex = (x, y) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  };
  DS_PRIM[k].forEach(p => {
    const a = p.a;
    if (p.t === "l") {
      ex(a[0], a[1]);
      ex(a[2], a[3]);
    } else if (p.t === "c") {
      ex(a[0] - a[2], a[1] - a[2]);
      ex(a[0] + a[2], a[1] + a[2]);
    } else if (p.t === "e") {
      ex(a[0] - a[2], a[1] - a[3]);
      ex(a[0] + a[2], a[1] + a[3]);
    } else if (p.t === "r") {
      ex(a[0], a[1]);
      ex(a[0] + a[2], a[1] + a[3]);
    } else if (p.t === "p") for (let i = 0; i + 1 < a.length; i += 2) ex(a[i], a[i + 1]);
    else if (p.t === "t") {
      const w = a[2] * 0.6 * p.tx.length,
        xa = p.an === "middle" ? a[0] - w / 2 : a[0];
      ex(xa, a[1] - a[2] * 0.8);
      ex(xa + w, a[1]);
    }
  });
  DS_BB[k] = x0 <= x1 ? [x0 - 1, y0 - 1, x1 + 1, y1 + 1] : [-8, -8, 8, 8];
  return DS_PRIM[k];
}
// Dibuja el símbolo k en el lienzo: X, Y en píxeles, giro en radianes (antihorario), u píxeles por unidad
function dsDibSim(g, k, X, Y, rot, u, col, fondo) {
  g.save();
  g.translate(X, Y);
  g.rotate(-rot);
  g.scale(u, u);
  g.lineCap = "round";
  for (const p of dsPrims(k)) {
    const a = p.a,
      fi = !p.fi || p.fi === "none" ? null : /^#fff(fff)?$/i.test(p.fi) ? fondo : p.fi === INK_S ? col : p.fi,
      st = p.st && p.st !== "none" ? col : null;
    g.lineWidth = Math.max(p.w, 1.1 / u);
    g.setLineDash(p.dash ? p.dash.split(/[\s,]+/).map(Number) : []);
    g.beginPath();
    if (p.t === "l") {
      g.moveTo(a[0], a[1]);
      g.lineTo(a[2], a[3]);
    } else if (p.t === "c") g.arc(a[0], a[1], a[2], 0, 2 * Math.PI);
    else if (p.t === "e") g.ellipse(a[0], a[1], a[2], a[3], 0, 0, 2 * Math.PI);
    else if (p.t === "r") g.rect(a[0], a[1], a[2], a[3]);
    else if (p.t === "p") {
      g.moveTo(a[0], a[1]);
      for (let i = 2; i + 1 < a.length; i += 2) g.lineTo(a[i], a[i + 1]);
      g.closePath();
    } else if (p.t === "t") {
      g.font = `${p.it ? "italic " : ""}${p.b ? "700 " : ""}${a[2]}px Arial, sans-serif`;
      g.textAlign = p.an === "middle" ? "center" : p.an === "end" ? "right" : "left";
      g.textBaseline = "alphabetic";
      g.fillStyle = p.fi && p.fi !== "none" && !/^#fff(fff)?$/i.test(p.fi) && p.fi !== INK_S ? p.fi : col;
      g.fillText(p.tx, a[0], a[1]);
      continue;
    }
    if (fi) {
      g.fillStyle = fi;
      g.fill();
    }
    if (st && p.t !== "p") {
      g.strokeStyle = st;
      g.stroke();
    }
  }
  g.setLineDash([]);
  g.restore();
}
// Ícono del símbolo para la cinta (SVG en el color del texto)
function dsIcono(k) {
  const o = [];
  simboloDGE(o, k, 0, 0, 1);
  dsPrims(k);
  const b = DS_BB[k],
    m = Math.max(b[2] - b[0], b[3] - b[1]) / 2 + 1,
    cx = (b[0] + b[2]) / 2,
    cy = (b[1] + b[3]) / 2;
  return `<svg viewBox="${cx - m} ${cy - m} ${2 * m} ${2 * m}" class="ds-ico" aria-hidden="true">${o
    .join("")
    .split(INK_S)
    .join("currentColor")
    .replace(/fill="#fff(fff)?"/gi, 'fill="var(--ws-pane, #fff)"')}</svg>`;
}

/* ---------- Geometría: rectángulo, toque y puntos de enganche de cada elemento ---------- */
// De unidades del símbolo (y hacia abajo) al dibujo, con el giro del elemento
function dsAMundo(el, a, b) {
  const u = dsU(),
    r = ((el.r || 0) * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return [el.x + u * (a * c + b * s), el.y + u * (a * s - b * c)];
}
function dsBBox(el) {
  if (el.t === "sim") {
    dsPrims(el.k);
    const b = DS_BB[el.k],
      q = [
        [b[0], b[1]],
        [b[2], b[1]],
        [b[2], b[3]],
        [b[0], b[3]]
      ].map(([a, c]) => dsAMundo(el, a, c));
    return [
      Math.min(...q.map(p => p[0])),
      Math.min(...q.map(p => p[1])),
      Math.max(...q.map(p => p[0])),
      Math.max(...q.map(p => p[1]))
    ];
  }
  if (el.t === "cir") return [el.x - el.rad, el.y - el.rad, el.x + el.rad, el.y + el.rad];
  if (el.t === "txt") {
    const w = el.ht * 0.62 * el.s.length;
    return [el.x, el.y - el.ht * 0.2, el.x + w, el.y + el.ht];
  }
  const xs = el.pts.filter((v, i) => i % 2 === 0),
    ys = el.pts.filter((v, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
const dsLargo = el => {
  let l = 0;
  for (let j = 2; j < el.pts.length; j += 2) l += Math.hypot(el.pts[j] - el.pts[j - 2], el.pts[j + 1] - el.pts[j - 1]);
  if (el.c) l += Math.hypot(el.pts[0] - el.pts[el.pts.length - 2], el.pts[1] - el.pts[el.pts.length - 1]);
  return l;
};
function dsDistSeg(p, x, y, cerrado) {
  let md = Infinity;
  const n = cerrado ? p.length : p.length - 2;
  for (let j = 0; j < n; j += 2) {
    const ax = p[j],
      ay = p[j + 1],
      bx = p[(j + 2) % p.length],
      by = p[(j + 3) % p.length],
      dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy,
      t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    md = Math.min(md, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return md;
}
// Elemento editable bajo el punto, o null: primero los símbolos y textos (aunque una tubería pase por encima) y
// después las líneas; entre iguales, el último dibujado
function dsHit(x, y, r) {
  const D = dsD();
  if (!D) return null;
  // Se recorre desde el final: los símbolos y textos van al final para revisarse primero
  const orden = [
    ...D.els.filter(el => el.t !== "sim" && el.t !== "txt"),
    ...D.els.filter(el => el.t === "sim" || el.t === "txt")
  ];
  for (let i = orden.length - 1; i >= 0; i--) {
    const el = orden[i];
    if (!dsEditable(el)) continue;
    if (el.t === "sim") {
      dsPrims(el.k);
      const u = dsU(),
        rr = ((el.r || 0) * Math.PI) / 180,
        wx = (x - el.x) / u,
        wy = (y - el.y) / u,
        a = wx * Math.cos(rr) + wy * Math.sin(rr),
        b = wx * Math.sin(rr) - wy * Math.cos(rr),
        bb = DS_BB[el.k],
        t = r / u;
      if (a >= bb[0] - t && a <= bb[2] + t && b >= bb[1] - t && b <= bb[3] + t) return el.id;
    } else if (el.t === "cir") {
      if (Math.abs(Math.hypot(x - el.x, y - el.y) - el.rad) <= r) return el.id;
    } else if (el.t === "txt") {
      const b = dsBBox(el);
      if (x >= b[0] - r && x <= b[2] + r && y >= b[1] - r && y <= b[3] + r) return el.id;
    } else if (dsDistSeg(el.pts, x, y, el.c) <= r) return el.id;
  }
  return null;
}
// Puntos de enganche del diseño (o de los elementos dados): inserciones (4), vértices (1), puntos medios (2) y
// centros (3)
function dsPuntosEnganche(lista) {
  const D = dsD(),
    out = [];
  if (!D) return out;
  for (const el of lista || D.els) {
    if (!dsVis(el)) continue;
    if (el.t === "sim" || el.t === "txt") out.push([el.x, el.y, 4]);
    else if (el.t === "cir") out.push([el.x, el.y, 3]);
    else {
      const p = el.pts;
      for (let i = 0; i < p.length; i += 2) {
        out.push([p[i], p[i + 1], 1]);
        if (i + 3 < p.length) out.push([(p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2, 2]);
      }
    }
  }
  return out;
}

/* ---------- Rejilla (preferencia de esta computadora) ---------- */
const DSU = { rej: false, forz: false, paso: 0.5 };
try {
  Object.assign(DSU, JSON.parse(localStorage.getItem("jmg-electric-editor-rejilla") || "{}"));
} catch (e) {}
function dsGuardarRejilla() {
  try {
    localStorage.setItem("jmg-electric-editor-rejilla", JSON.stringify(DSU));
  } catch (e) {}
}
// Paso de la rejilla en unidades del dibujo
const dsPasoU = () => DSU.paso / (EPL ? EPL.f : 1);
function dsRejilla(g) {
  if (!DSU.rej || !EPL) return;
  const W = plW(),
    H = plH(),
    s = PLV.s;
  let p = dsPasoU(),
    k = 1;
  while (p * k * s < 9) k *= 5;
  const paso = p * k,
    [x0, y1] = plADib(0, 0),
    [x1, y0] = plADib(W, H),
    i0 = Math.floor(x0 / paso),
    i1 = Math.ceil(x1 / paso),
    j0 = Math.floor(y0 / paso),
    j1 = Math.ceil(y1 / paso);
  if ((i1 - i0) * (j1 - j0) > 400000) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineWidth = 1;
  const linea = (mayor, vert, v) => {
    g.strokeStyle = PL_OSCURO
      ? mayor
        ? "rgba(255,255,255,.10)"
        : "rgba(255,255,255,.045)"
      : mayor
        ? "rgba(20,48,79,.13)"
        : "rgba(20,48,79,.055)";
    g.beginPath();
    if (vert) {
      const X = Math.round(plAPant(v, 0)[0]) + 0.5;
      g.moveTo(X, 0);
      g.lineTo(X, H);
    } else {
      const Y = Math.round(plAPant(0, v)[1]) + 0.5;
      g.moveTo(0, Y);
      g.lineTo(W, Y);
    }
    g.stroke();
  };
  for (let i = i0; i <= i1; i++) linea(i % 5 === 0, true, i * paso);
  for (let j = j0; j <= j1; j++) linea(j % 5 === 0, false, j * paso);
  g.restore();
}
const dsAlaRejilla = p => {
  const q = dsPasoU();
  return [Math.round(p[0] / q) * q, Math.round(p[1] / q) * q];
};

/* ---------- Dibujo de los elementos ---------- */
function dsPintar(g) {
  const D = dsD();
  if (!D || !PL_MOD) return;
  const s = PLV.s,
    u = dsU() * s,
    W = plW(),
    H = plH(),
    d = plDpr();
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const el of D.els) {
    if (!dsVis(el)) continue;
    const cap = dsCapaDe(el),
      col = plColorDis(cap.col);
    if (el.t === "sim") {
      const [X, Y] = plAPant(el.x, el.y);
      if (X < -40 * u || X > W + 40 * u || Y < -40 * u || Y > H + 40 * u) continue;
      if (u * 17 < 2.5) {
        g.fillStyle = col;
        g.fillRect(X - 1, Y - 1, 2, 2);
        continue;
      }
      dsDibSim(g, el.k, X, Y, ((el.r || 0) * Math.PI) / 180, u, col, PL_FONDO);
    } else if (el.t === "txt") {
      const hp = el.ht * s;
      if (hp < 2) continue;
      const [X, Y] = plAPant(el.x, el.y);
      g.save();
      g.translate(X, Y);
      g.rotate((-(el.r || 0) * Math.PI) / 180);
      g.font = `${hp / 0.72}px Arial, sans-serif`;
      g.fillStyle = col;
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.fillText(el.s, 0, 0);
      g.restore();
    } else {
      g.strokeStyle = col;
      g.lineWidth = (el.t === "tub" ? 2 : 1.4) * d;
      g.setLineDash(dsGuiones(el, cap).map(v => v * s));
      g.beginPath();
      if (el.t === "cir") {
        const [X, Y] = plAPant(el.x, el.y);
        g.arc(X, Y, el.rad * s, 0, 2 * Math.PI);
      } else plRuta(g, el.pts, el.c);
      g.stroke();
      g.setLineDash([]);
    }
  }
  g.restore();
}
// Guiones del elemento en unidades del dibujo: la tubería por piso, discontinua; las demás, según su capa
function dsGuiones(el, cap) {
  if (el.t === "tub") return el.modo === "piso" ? [dsMm(3), dsMm(1.5)] : [];
  if (cap.lt === "trazos") return [dsMm(3), dsMm(1.5)];
  if (cap.lt === "punto") return [dsMm(5), dsMm(1), dsMm(0.5), dsMm(1)];
  return [];
}
function plRuta(g, p, cerrado) {
  for (let i = 0; i < p.length; i += 2) {
    const [X, Y] = plAPant(p[i], p[i + 1]);
    if (i) g.lineTo(X, Y);
    else g.moveTo(X, Y);
  }
  if (cerrado) g.closePath();
}
// Color de una capa del diseño, legible sobre el fondo (sin el modo atenuado, que es solo para la arquitectura)
function plColorDis(h) {
  let v = plRgb(h);
  const l = plLum(v);
  if (!PL_OSCURO && l > 0.8) v = [38, 48, 60];
  else if (PL_OSCURO && l < 0.25) v = v.map(x => x + (210 - x) * 0.6);
  return plHex(v);
}

/* ---------- Lienzo superior: selección, fantasma del símbolo, trazo en curso y marco de selección ---------- */
function dsSobre(g) {
  const D = dsD();
  if (!D) return;
  const d = plDpr(),
    selc = PL_OSCURO ? "#5fb0ff" : "#1f6fd6";
  // Seleccionados: rectángulo discontinuo y pinzamiento en el punto de inserción o en los vértices
  D.els.forEach(el => {
    if (!DS_SEL.has(el.id) && el.id !== PLH.dsSobre) return;
    const sel = DS_SEL.has(el.id);
    g.strokeStyle = selc;
    g.globalAlpha = sel ? 1 : 0.55;
    g.lineWidth = (sel ? 1.5 : 1.2) * d;
    g.setLineDash([5 * d, 3 * d]);
    const b = dsBBox(el),
      [a, c] = plAPant(b[0], b[3]),
      [e, f] = plAPant(b[2], b[1]),
      m = 3 * d;
    if (el.t === "sim" || el.t === "txt") g.strokeRect(a - m, c - m, e - a + 2 * m, f - c + 2 * m);
    else {
      g.beginPath();
      if (el.t === "cir") {
        const [X, Y] = plAPant(el.x, el.y);
        g.arc(X, Y, el.rad * PLV.s, 0, 2 * Math.PI);
      } else plRuta(g, el.pts, el.c);
      g.stroke();
    }
    g.setLineDash([]);
    g.globalAlpha = 1;
    if (!sel) return;
    g.fillStyle = selc;
    g.strokeStyle = PL_OSCURO ? "#111922" : "#fff";
    g.lineWidth = 1.2 * d;
    const pin = (x, y) => {
      const [X, Y] = plAPant(x, y);
      g.fillRect(X - 4 * d, Y - 4 * d, 8 * d, 8 * d);
      g.strokeRect(X - 4 * d, Y - 4 * d, 8 * d, 8 * d);
    };
    if (el.t === "sim" || el.t === "txt" || el.t === "cir") pin(el.x, el.y);
    else for (let i = 0; i < el.pts.length; i += 2) pin(el.pts[i], el.pts[i + 1]);
  });
  // Símbolo que se va a colocar, siguiendo al cursor
  const q = plPuntoActual();
  if (PLH.h && PLH.h.startsWith("col:") && q) {
    const k = PLH.h.slice(4),
      [X, Y] = plAPant(q[0], q[1]);
    g.globalAlpha = 0.6;
    dsDibSim(
      g,
      k,
      X,
      Y,
      (PLH.rot * Math.PI) / 180,
      dsU() * PLV.s,
      plColorDis(dsCapa(DS_SIS[DS_CAT[k].s].capa).col),
      PL_FONDO
    );
    g.globalAlpha = 1;
  }
  // Trazo en curso (línea, polilínea, rectángulo, círculo, tubería)
  if (DS_HERR[PLH.h] && PLH.pts.length && q) {
    const pts = PLH.pts,
      tub = PLH.h === "tubT" || PLH.h === "tubP",
      col = plColorDis(dsCapa(tub ? DS_SIS.tub.capa : D.actual).col);
    g.strokeStyle = col;
    g.lineWidth = (tub ? 2 : 1.4) * d;
    g.setLineDash(PLH.h === "tubP" ? [dsMm(3) * PLV.s, dsMm(1.5) * PLV.s] : []);
    g.beginPath();
    if (PLH.h === "rect") {
      const [a, b] = plAPant(pts[0][0], pts[0][1]),
        [c, e] = plAPant(q[0], q[1]);
      g.rect(a, b, c - a, e - b);
    } else if (PLH.h === "cir") {
      const [X, Y] = plAPant(pts[0][0], pts[0][1]);
      g.arc(X, Y, Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) * PLV.s, 0, 2 * Math.PI);
    } else plRuta(g, [...pts.flat(), ...q], false);
    g.stroke();
    g.setLineDash([]);
    const u = pts[pts.length - 1],
      l = Math.hypot(q[0] - u[0], q[1] - u[1]),
      [X, Y] = plAPant((q[0] + u[0]) / 2, (q[1] + u[1]) / 2);
    g.font = `600 ${11.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
    plEtiqueta(g, (PLH.h === "cir" ? "R " : "") + plFm(l) + " m", X, Y - 8 * d, col, "center", "bottom");
  }
  // Marco de selección: de izquierda a derecha, ventana (lo que queda dentro); al revés, captura (lo que toca)
  const mc = PLH.marco;
  if (mc && mc.mov) {
    const cap = mc.X1 < mc.X0;
    g.fillStyle = cap ? "rgba(46,160,67,.10)" : "rgba(31,111,214,.10)";
    g.strokeStyle = cap ? "#2ea043" : selc;
    g.lineWidth = 1 * d;
    g.setLineDash(cap ? [5 * d, 3 * d] : []);
    g.fillRect(mc.X0, mc.Y0, mc.X1 - mc.X0, mc.Y1 - mc.Y0);
    g.strokeRect(mc.X0, mc.Y0, mc.X1 - mc.X0, mc.Y1 - mc.Y0);
    g.setLineDash([]);
  }
}

/* ---------- Herramientas: colocar símbolos y dibujar ---------- */
const dsEsHerr = h => !!h && (h.startsWith("col:") || !!DS_HERR[h]);
function dsOrden(h, n) {
  if (h.startsWith("col:")) {
    const c = DS_CAT[h.slice(4)];
    return `<b>${c.n}</b> <span class="pl-cod">DGE ${c.c}</span> · clic para colocar · <span class="pl-k">R</span> girar 90° · <span class="pl-k">Esc</span> para terminar`;
  }
  const T = {
    lin: n ? "Designe el punto final" : "Designe el primer punto",
    pol: n ? "Siguiente punto · <b>Intro</b> o doble clic para terminar" : "Designe el primer punto",
    rect: n ? "Designe la esquina opuesta" : "Designe una esquina",
    cir: n ? "Designe un punto del borde (radio)" : "Designe el centro",
    txt: "Designe dónde va el texto",
    tubT: n ? "Siguiente punto · <b>Intro</b> o doble clic para terminar" : "Designe el inicio de la tubería",
    tubP: n ? "Siguiente punto · <b>Intro</b> o doble clic para terminar" : "Designe el inicio de la tubería"
  };
  return `<b>${DS_HERR[h]}</b> · ${T[h]} · <span class="pl-k">Esc</span> para salir`;
}
function dsAgregar(el) {
  el.id = dsId();
  dsD().els.push(el);
  return el;
}
function dsPunto(p) {
  const h = PLH.h,
    D = dsD();
  if (h.startsWith("col:")) {
    const k = h.slice(4),
      c = DS_CAT[k];
    dsCapa(DS_SIS[c.s].capa);
    const el = dsAgregar({ t: "sim", k, x: p[0], y: p[1], r: PLH.rot, capa: DS_SIS[c.s].capa });
    DS_SEL.clear();
    DS_SEL.add(el.id);
    edCambio();
    return;
  }
  if (h === "txt") {
    PLH.pts = [p];
    plPedir("Texto", "", v => {
      if (!v) return toast("Escriba el texto");
      dsCapa(D.actual);
      dsAgregar({
        t: "txt",
        x: p[0],
        y: p[1],
        s: v.replace(/[<>]/g, "").slice(0, 200),
        ht: dsMm(2.5),
        r: 0,
        capa: D.actual
      });
      PLH.pts = [];
      plPedir(null);
      edCambio();
      plOrden();
    });
    return;
  }
  PLH.pts.push(p);
  const n = PLH.pts.length,
    capa = h === "tubT" || h === "tubP" ? DS_SIS.tub.capa : D.actual;
  if ((h === "lin" || h === "rect" || h === "cir") && n === 2) {
    const [a, b] = PLH.pts;
    PLH.pts = [];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) * PLV.s < 2) return plOrden();
    dsCapa(capa);
    if (h === "lin") dsAgregar({ t: "lin", pts: [a[0], a[1], b[0], b[1]], c: false, capa });
    else if (h === "rect")
      dsAgregar({ t: "lin", pts: [a[0], a[1], b[0], a[1], b[0], b[1], a[0], b[1]], c: true, capa });
    else dsAgregar({ t: "cir", x: a[0], y: a[1], rad: Math.hypot(b[0] - a[0], b[1] - a[1]), capa });
    edCambio();
  }
  plOrden();
  plSobreDibujar();
}
// Termina la polilínea o la tubería en curso (Intro, doble clic o Esc)
function dsTerminar() {
  const h = PLH.h;
  if (!(h === "pol" || h === "tubT" || h === "tubP") || PLH.pts.length < 2) {
    PLH.pts = [];
    return false;
  }
  const capa = h === "pol" ? dsD().actual : DS_SIS.tub.capa;
  dsCapa(capa);
  const el = { t: h === "pol" ? "lin" : "tub", pts: PLH.pts.flat(), c: false, capa };
  if (h !== "pol") el.modo = h === "tubP" ? "piso" : "techo";
  dsAgregar(el);
  PLH.pts = [];
  edCambio();
  plOrden();
  return true;
}

/* ---------- Selección, mover, girar, copiar, pegar y borrar ---------- */
const dsSel = () => dsD().els.filter(el => DS_SEL.has(el.id));
// Clic sobre un elemento: lo selecciona (con Mayús se suma o se quita) y prepara el arrastre para moverlo
function dsPresionar(id, p, suma) {
  if (suma) {
    if (DS_SEL.has(id)) DS_SEL.delete(id);
    else DS_SEL.add(id);
  } else if (!DS_SEL.has(id)) {
    DS_SEL.clear();
    DS_SEL.add(id);
  }
  PLH.obj = -1;
  PLH.arr = DS_SEL.has(id) ? { base: p, orig: dsSel().map(el => JSON.stringify(el)), mov: false, id, suma } : null;
  edProps();
  plSobreDibujar();
}
function dsMover(q) {
  const a = PLH.arr,
    dx = q[0] - a.base[0],
    dy = q[1] - a.base[1];
  a.mov = true;
  const orig = a.orig.map(s => JSON.parse(s)),
    D = dsD();
  orig.forEach(o => {
    const el = D.els.find(e => e.id === o.id);
    if (!el) return;
    if (o.pts) el.pts = o.pts.map((v, i) => v + (i % 2 ? dy : dx));
    else {
      el.x = o.x + dx;
      el.y = o.y + dy;
    }
  });
  plDibujar();
}
function dsSoltar() {
  const a = PLH.arr;
  PLH.arr = null;
  if (a.mov) return edCambio();
  // Clic sin mover sobre un elemento de una selección múltiple: queda solo ese
  if (!a.suma && DS_SEL.size > 1) {
    DS_SEL.clear();
    DS_SEL.add(a.id);
  }
  edProps();
  plSobreDibujar();
}
function dsMarco(mc) {
  const [xa, ya] = plADib(Math.min(mc.X0, mc.X1), Math.max(mc.Y0, mc.Y1)),
    [xb, yb] = plADib(Math.max(mc.X0, mc.X1), Math.min(mc.Y0, mc.Y1)),
    captura = mc.X1 < mc.X0;
  if (!mc.shift) DS_SEL.clear();
  dsD().els.forEach(el => {
    if (!dsEditable(el)) return;
    const b = dsBBox(el),
      dentro = b[0] >= xa && b[2] <= xb && b[1] >= ya && b[3] <= yb,
      toca = b[0] <= xb && b[2] >= xa && b[1] <= yb && b[3] >= ya;
    if (captura ? toca : dentro) DS_SEL.add(el.id);
  });
  PLH.obj = -1;
  edProps();
  plSobreDibujar();
}
function dsGirar() {
  if (PLH.h && PLH.h.startsWith("col:")) {
    PLH.rot = (PLH.rot + 90) % 360;
    return plSobreDibujar();
  }
  const sel = dsSel();
  if (!sel.length) return;
  // Los símbolos y textos giran sobre su punto; las líneas, sobre el centro de la selección
  const b = sel.map(dsBBox),
    cx = (Math.min(...b.map(x => x[0])) + Math.max(...b.map(x => x[2]))) / 2,
    cy = (Math.min(...b.map(x => x[1])) + Math.max(...b.map(x => x[3]))) / 2,
    rot = (x, y) => [cx - (y - cy), cy + (x - cx)];
  sel.forEach(el => {
    if (el.t === "sim" || el.t === "txt") el.r = ((el.r || 0) + 90) % 360;
    else if (el.t === "cir") [el.x, el.y] = sel.length > 1 ? rot(el.x, el.y) : [el.x, el.y];
    else {
      const q = [];
      for (let i = 0; i < el.pts.length; i += 2) q.push(...rot(el.pts[i], el.pts[i + 1]));
      el.pts = q;
    }
  });
  edCambio();
}
function dsBorrar() {
  if (!DS_SEL.size) return;
  const n = DS_SEL.size;
  dsD().els = dsD().els.filter(el => !DS_SEL.has(el.id));
  DS_SEL.clear();
  edCambio();
  toast(`${n} elemento${n > 1 ? "s" : ""} borrado${n > 1 ? "s" : ""} · Ctrl+Z para deshacer`);
}
function dsCopiar() {
  DS_PORTA = dsSel().map(el => JSON.parse(JSON.stringify(el)));
  if (DS_PORTA.length)
    toast(`${DS_PORTA.length} elemento${DS_PORTA.length > 1 ? "s" : ""} copiado${DS_PORTA.length > 1 ? "s" : ""}`);
}
// Pega lo copiado con el centro en el cursor (o, sin cursor sobre el plano, desplazado un poco)
function dsPegar() {
  if (!DS_PORTA.length || !dsD()) return;
  const b = DS_PORTA.map(dsBBox),
    cx = (Math.min(...b.map(x => x[0])) + Math.max(...b.map(x => x[2]))) / 2,
    cy = (Math.min(...b.map(x => x[1])) + Math.max(...b.map(x => x[3]))) / 2,
    q = plPuntoActual() || [cx + 20 * dsU(), cy - 20 * dsU()],
    dx = q[0] - cx,
    dy = q[1] - cy;
  DS_SEL.clear();
  DS_PORTA.forEach(o => {
    const el = JSON.parse(JSON.stringify(o));
    if (el.pts) el.pts = el.pts.map((v, i) => v + (i % 2 ? dy : dx));
    else {
      el.x += dx;
      el.y += dy;
    }
    dsCapa(el.capa);
    DS_SEL.add(dsAgregar(el).id);
  });
  edCambio();
}
function dsTodo() {
  DS_SEL.clear();
  dsD().els.forEach(el => {
    if (dsEditable(el)) DS_SEL.add(el.id);
  });
  PLH.obj = -1;
  edProps();
  plSobreDibujar();
}
// Selecciona todos los elementos de un tipo (desde el resumen del panel izquierdo)
function dsSelTipo(tipo) {
  DS_SEL.clear();
  dsD().els.forEach(el => {
    if (dsEditable(el) && dsTipo(el) === tipo) DS_SEL.add(el.id);
  });
  PLH.obj = -1;
  edProps();
  plSobreDibujar();
}
const dsTipo = el => (el.t === "sim" ? el.k : el.t === "tub" ? "tub-" + (el.modo === "piso" ? "piso" : "techo") : el.t);

/* ---------- Propiedades de lo seleccionado ---------- */
// Altura de montaje por defecto: la de Parámetros › Alturas del proyecto (criterio del proyectista)
const dsAlturaDef = k => {
  const c = DS_CAT[k];
  return c && c.h ? parseFloat(PROY[c.h]) || null : null;
};
const dsPotDef = k => {
  const c = DS_CAT[k];
  return c && c.p ? parseFloat(PROY[c.p]) || null : null;
};
function dsProps(c) {
  const sel = dsSel(),
    D = dsD();
  const fila = (k, v) => `<div class="ed-pf"><span>${k}</span><b>${v}</b></div>`,
    campo = (k, html) => `<label class="ed-pf ed-pc"><span>${k}</span>${html}</label>`,
    capas = v =>
      `<select data-dsp="capa">${v === "" ? '<option value="" selected>(varias)</option>' : ""}${D.capas.map(x => `<option${x.n === v ? " selected" : ""}>${esc(x.n)}</option>`).join("")}</select>`,
    circ = v =>
      `<input type="text" data-dsp="cir" value="${esc(v || "")}" placeholder="ej. C-1" list="dsCircs" maxlength="12">`,
    lista = LAST
      ? `<datalist id="dsCircs">${LAST.circ.map(q => `<option value="${esc(q.id)}">${esc(q.desc)}</option>`).join("")}</datalist>`
      : "",
    acciones = `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="girar">Girar 90°</button><button type="button" class="btn sec sm" data-dsa="copiar">Copiar</button><button type="button" class="btn sec sm ed-del" data-dsa="borrar">Borrar</button></div>`;
  if (sel.length > 1) {
    const cuenta = {};
    sel.forEach(el => (cuenta[dsTipo(el)] = (cuenta[dsTipo(el)] || 0) + 1));
    const capa0 = sel.every(el => el.capa === sel[0].capa) ? sel[0].capa : "",
      cir0 = sel.every(el => (el.cir || "") === (sel[0].cir || "")) ? sel[0].cir || "" : "";
    c.innerHTML =
      `<div class="ed-pt">${sel.length} elementos seleccionados</div>` +
      Object.entries(cuenta)
        .map(([t, n]) => fila(dsNomTipo(t), n))
        .join("") +
      campo("Capa", capas(capa0)) +
      (sel.every(el => el.t === "sim" || el.t === "tub") ? campo("Circuito", circ(cir0)) + lista : "") +
      acciones;
    return;
  }
  const el = sel[0],
    cap = dsCapaDe(el);
  let h = "";
  if (el.t === "sim") {
    const cat = DS_CAT[el.k],
      hd = dsAlturaDef(el.k),
      pd = dsPotDef(el.k);
    h =
      `<div class="ed-pt">${cat.n}<small>Norma DGE ${cat.c}</small></div>` +
      `<div class="ds-prev">${dsIcono(el.k)}</div>` +
      campo("Capa", capas(el.capa)) +
      campo(
        "Rotación",
        `<input type="number" data-dsp="r" value="${el.r || 0}" step="90" min="-360" max="360"><i>°</i>`
      ) +
      (cat.h
        ? campo(
            "Altura",
            `<input type="number" data-dsp="h" value="${el.h ?? ""}" placeholder="${hd != null ? fmt(hd, 2) : ""}" step="0.05" min="0" max="10"><i>m</i>`
          ) +
          `<p class="ds-crit">Criterio: si la deja vacía, usa la de Parámetros › Alturas (${hd != null ? fmt(hd, 2) + " m" : "—"}).</p>`
        : fila("Altura", el.k === "luz" ? "en el techo" : "—")) +
      (cat.u
        ? campo(
            "Potencia",
            `<input type="number" data-dsp="p" value="${el.p ?? ""}" placeholder="${pd != null ? pd : ""}" step="10" min="0" max="100000"><i>${cat.u}</i>`
          )
        : "") +
      (cat.s !== "can" && cat.s !== "tie" ? campo("Circuito", circ(el.cir)) + lista : "") +
      fila("Posición X", `${plFm(el.x)} m`) +
      fila("Posición Y", `${plFm(el.y)} m`);
  } else if (el.t === "txt") {
    h =
      `<div class="ed-pt">Texto</div>` +
      campo("Texto", `<input type="text" data-dsp="s" value="${esc(el.s)}" maxlength="200">`) +
      campo(
        "Altura",
        `<input type="number" data-dsp="ht" value="${+(el.ht * EPL.f).toFixed(3)}" step="0.01" min="0.01"><i>m</i>`
      ) +
      campo("Rotación", `<input type="number" data-dsp="r" value="${el.r || 0}" step="90"><i>°</i>`) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "cir") {
    h =
      `<div class="ed-pt">Círculo</div>` +
      campo(
        "Radio",
        `<input type="number" data-dsp="rad" value="${+(el.rad * EPL.f).toFixed(3)}" step="0.05" min="0.01"><i>m</i>`
      ) +
      campo("Capa", capas(el.capa)) +
      fila("Centro", `X ${plFm(el.x)} · Y ${plFm(el.y)} m`);
  } else {
    const tub = el.t === "tub";
    h =
      `<div class="ed-pt">${tub ? "Tubería" : el.c ? "Polilínea cerrada" : el.pts.length > 4 ? "Polilínea" : "Línea"}</div>` +
      (tub
        ? campo(
            "Recorrido",
            `<select data-dsp="modo"><option value="techo"${el.modo !== "piso" ? " selected" : ""}>Techo o pared (línea continua)</option><option value="piso"${el.modo === "piso" ? " selected" : ""}>Piso (línea discontinua)</option></select>`
          )
        : "") +
      fila("Longitud", `${plFm(dsLargo(el))} m`) +
      campo("Capa", capas(el.capa)) +
      (tub ? campo("Circuito", circ(el.cir)) + lista : "") +
      fila("Vértices", el.pts.length / 2);
  }
  c.innerHTML = h + (cap.bloq ? `<p class="pl-nota">La capa está bloqueada.</p>` : "") + acciones;
}
const dsNomTipo = t =>
  DS_CAT[t]
    ? DS_CAT[t].n
    : {
        "tub-techo": "Tubería en techo o pared",
        "tub-piso": "Tubería en piso",
        lin: "Línea o polilínea",
        cir: "Círculo",
        txt: "Texto"
      }[t] || t;
$("edPropC").addEventListener("change", e => {
  const f = e.target.closest("[data-dsp]");
  if (!f || !DS_SEL.size) return;
  const k = f.dataset.dsp,
    v = f.value.trim();
  dsSel().forEach(el => {
    if (k === "capa") {
      if (v) el.capa = v;
    } else if (k === "r") el.r = (((parseFloat(v) || 0) % 360) + 360) % 360;
    else if (k === "h") el.h = v === "" ? undefined : Math.max(0, parseFloat(v) || 0);
    else if (k === "p") el.p = v === "" ? undefined : Math.max(0, parseFloat(v) || 0);
    else if (k === "cir") el.cir = v.replace(/[<>]/g, "").slice(0, 12) || undefined;
    else if (k === "s") el.s = v.replace(/[<>]/g, "").slice(0, 200) || el.s;
    else if (k === "ht") el.ht = Math.max(0.01, parseFloat(v) || 0.1) / EPL.f;
    else if (k === "rad") el.rad = Math.max(0.01, parseFloat(v) || 0.1) / EPL.f;
    else if (k === "modo") el.modo = v === "piso" ? "piso" : "techo";
  });
  edCambio();
});
$("edPropC").addEventListener("click", e => {
  const b = e.target.closest("[data-dsa]");
  if (!b) return;
  const a = b.dataset.dsa;
  if (a === "girar") dsGirar();
  else if (a === "borrar") dsBorrar();
  else if (a === "copiar") {
    dsCopiar();
    dsPegar();
  }
});

/* ---------- Resumen del diseño (panel izquierdo): cuántos hay de cada cosa; un clic los selecciona ---------- */
function dsResumen() {
  const D = dsD(),
    box = $("dsResumen");
  if (!D || !PL_MOD) {
    box.innerHTML = "";
    $("dsN").textContent = "";
    return;
  }
  const cuenta = {},
    largo = {};
  D.els.forEach(el => {
    const t = dsTipo(el);
    cuenta[t] = (cuenta[t] || 0) + 1;
    if (el.t === "tub") largo[t] = (largo[t] || 0) + dsLargo(el);
  });
  $("dsN").textContent = D.els.length || "";
  const orden = [...Object.keys(DS_CAT), "tub-techo", "tub-piso", "lin", "cir", "txt"].filter(t => cuenta[t]);
  box.innerHTML = orden.length
    ? orden
        .map(
          t =>
            `<button type="button" class="ds-fila" data-dst="${t}" title="Seleccionar todos">${DS_CAT[t] ? dsIcono(t) : '<i class="ds-ico ds-lin"></i>'}<span>${dsNomTipo(t)}</span><em>${largo[t] ? plFm(largo[t]) + " m" : cuenta[t]}</em></button>`
        )
        .join("")
    : `<p class="pl-nota">Coloque luminarias, interruptores, tomacorrientes, tableros y tuberías desde la pestaña <b>Insertar</b> y <b>Dibujo</b>. Aquí verá cuántos hay de cada uno.</p>`;
}
$("dsResumen").addEventListener("click", e => {
  const b = e.target.closest("[data-dst]");
  if (b) dsSelTipo(b.dataset.dst);
});

/* ---------- Cinta del editor: íconos de los símbolos, capa actual, escala de símbolos y rejilla ---------- */
document.querySelectorAll("#editor [data-ds-ico]").forEach(i => (i.outerHTML = dsIcono(i.dataset.dsIco)));
function dsCinta() {
  const D = dsD(),
    s = $("dsActual");
  s.innerHTML = D
    ? D.capas.map(c => `<option${c.n === D.actual ? " selected" : ""}>${esc(c.n)}</option>`).join("")
    : "";
  s.disabled = !D || !PL_MOD;
  $("dsEscala").value = D ? String(D.escala) : "50";
  $("dsEscala").disabled = !D || !PL_MOD;
  $("dsRej").checked = DSU.rej;
  $("dsForz").checked = DSU.forz;
  $("dsPaso").value = String(DSU.paso);
  document.querySelectorAll("[data-edtg]").forEach(b => {
    const v = b.dataset.edtg;
    b.setAttribute("aria-pressed", v === "rej" ? DSU.rej : v === "forz" ? DSU.forz : $(v).checked);
  });
}
$("dsActual").addEventListener("change", e => {
  if (!dsD()) return;
  dsD().actual = e.target.value;
  edCambio();
});
$("dsEscala").addEventListener("change", e => {
  if (!dsD()) return;
  dsD().escala = DS_ESCALAS.includes(+e.target.value) ? +e.target.value : 50;
  edCambio();
  toast(`Símbolos y textos nuevos para imprimir a 1:${dsD().escala}`);
});
function dsAlternarRejilla(cual, aviso) {
  DSU[cual] = !DSU[cual];
  dsGuardarRejilla();
  dsCinta();
  if (aviso)
    toast(`${cual === "rej" ? "Rejilla" : "Forzar cursor a la rejilla"} ${DSU[cual] ? "activado" : "desactivado"}`);
  plDibujar();
}
$("dsRej").addEventListener("change", () => dsAlternarRejilla("rej"));
$("dsForz").addEventListener("change", () => dsAlternarRejilla("forz"));
$("dsPaso").addEventListener("change", e => {
  DSU.paso = [0.1, 0.25, 0.5, 1].includes(+e.target.value) ? +e.target.value : 0.5;
  dsGuardarRejilla();
  plDibujar();
});
