/* LÁMINAS Y EXPORTAR A DXF (editor de diseño)
   El dibujo del editor (arquitectura y diseño eléctrico) se «graba» con un lienzo de mentira (laGrabador): el mismo
   código que pinta la pantalla deja sus trazos, rellenos y textos en una lista. Con esa lista se arma:
   - la lámina en PDF (laSvg): papel A4 a A1, marco, la zona elegida a la escala del diseño, leyenda, escala gráfica,
     notas y el rótulo de la plataforma; se imprime con la ventana del navegador (Guardar como PDF);
   - el DXF del diseño en coordenadas reales (laDxf): mismas coordenadas que el plano del arquitecto, para
     superponerlo en AutoCAD; con sus capas, colores y textos (formato R12). Opcionalmente, con la arquitectura. */
const LA_PX = 96 / 25.4; // unidades del SVG por milímetro de papel (como los demás planos)
const LA_K = 8; // píxeles de grabación por milímetro de papel (para que los textos pequeños se graben)
let DS_EXPORT = false;

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
// Zona del dibujo que va en la lámina: una planta encuadrada, lo que se ve en pantalla o todo el diseño
function laZona(op) {
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
/* Papel y escala automáticos (criterio de la plataforma): las plantas de instalaciones se presentan a 1:50; se elige
   el papel más chico donde entra la zona con su columna de leyenda, cuadro, notas y rótulo. Si no entra en A1, la
   escala siguiente. Con el papel o la escala elegidos a mano, solo se ajusta lo otro. */
const LA_ESC_AUTO = [50, 75, 100, 125, 150, 200, 250, 500];
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
      if (d.entra) return d;
    }
  return laDisp(op, tams[tams.length - 1], op.esc > 0 ? op.esc : 50, z, c);
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
  const z = op.zona || (EPL.plantas.length ? "planta:0" : "todo");
  if (z.startsWith("planta:") && EPL.plantas[+z.slice(7)]) return "PLANTA " + EPL.plantas[+z.slice(7)].n.toUpperCase();
  return (op.tit || "Instalaciones eléctricas").toUpperCase();
}
// Arma la lámina: devuelve { svg, aviso, W, H, tam, esc } (aviso si la zona no entra en el papel a esa escala)
function laSvg(op = laOp()) {
  const D = dsD(),
    z = laZona(op),
    P = {
      nombre: $("p_nombre").value,
      prop: $("p_prop").value,
      ubic: $("p_ubic").value,
      proy: $("p_proy").value,
      cip: $("p_cip").value
    },
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
  const c = {
      conLey,
      conCua,
      leyW: DS_LEY.w.reduce((a, b) => a + b, 0),
      leyH: DS_LEY.tit + DS_LEY.cab + Math.max(1, filasLey) * LA_LEY_FILA,
      bloques
    },
    d = laElegir(op, z, c),
    { W, H, k, escD, mmU, a, mx0, my0, mx1, my1 } = d,
    acx = (a.x0 + a.x1) / 2,
    acy = (a.y0 + a.y1) / 2,
    cx = (z[0] + z[2]) / 2,
    cy = (z[1] + z[3]) / 2,
    s = mmU * LA_K,
    aDib = (px, py) => [cx + (px - acx) / mmU, cy - (py - acy) / mmU];
  const aviso = d.entra
    ? escD > 75 && String(op.zona || "planta:").startsWith("planta:")
      ? `A 1:${escD} los símbolos quedan juntos (miden lo mismo en el papel a cualquier escala): para las plantas se recomienda 1:50, con el papel automático.`
      : ""
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
    NAVY = "#14304f";
  o.push(
    `<defs><clipPath id="laArea"><rect x="${q(a.x0)}" y="${q(a.y0)}" width="${q(a.x1 - a.x0)}" height="${q(a.y1 - a.y0)}"/></clipPath></defs>`
  );
  const cuerpo = [],
    leyO = [];
  items.forEach(it => {
    const dst = it.capa === "E-LEYENDA" ? leyO : cuerpo;
    if (it.t === "l") {
      const p = it.p.map((pp, i) => `${i ? "L" : "M"}${X(pp[0])} ${Y(pp[1])}`).join("") + (it.c ? "Z" : "");
      dst.push(
        `<path d="${p}" fill="none" stroke="${C(it.col)}" stroke-width="${Math.max(0.1, it.w / LA_K) * LA_PX}"${it.dash ? ` stroke-dasharray="${it.dash.map(v => +((v / LA_K) * LA_PX).toFixed(2)).join(" ")}"` : ""} stroke-linecap="round" stroke-linejoin="round"/>`
      );
    } else if (it.t === "f") {
      const p = it.pol.map(u => u.p.map((pp, i) => `${i ? "L" : "M"}${X(pp[0])} ${Y(pp[1])}`).join("") + "Z").join("");
      dst.push(`<path d="${p}" fill="${C(it.col)}" stroke="none" fill-rule="evenodd"/>`);
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
        `<text x="${x}" y="${y}" font-size="${fs}"${it.b ? ' font-weight="700"' : ""}${it.it ? ' font-style="italic"' : ""} text-anchor="${an}" dominant-baseline="${db}" fill="${C(it.col)}"${ang ? ` transform="rotate(${ang} ${x} ${y})"` : ""}>${esc(it.s)}</text>`
      );
    }
  });
  o.push(`<g clip-path="url(#laArea)">${cuerpo.join("")}</g>`, leyO.join(""));
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

/* ---------- DXF del diseño en coordenadas reales (R12) ---------- */
// Color ACI más cercano a un color
const LA_ACI = new Map();
function laAci(hex) {
  const h = laHex(hex);
  if (!LA_ACI.has(h)) LA_ACI.set(h, laAci0(h));
  return LA_ACI.get(h);
}
function laAci0(hex) {
  const v = plRgb(laHex(hex));
  if (v.every(x => x < 60)) return 7;
  let mejor = 7,
    md = Infinity;
  for (let i = 1; i < 250; i++) {
    if (i === 7) continue;
    const c = plRgb(ACI[i]),
      d = (c[0] - v[0]) ** 2 + (c[1] - v[1]) ** 2 + (c[2] - v[2]) ** 2;
    if (d < md) {
      md = d;
      mejor = i;
    }
  }
  return mejor;
}
function laDxf(conArq) {
  const D = dsD(),
    mmU = (EPL.f * 1000) / D.escala,
    s = mmU * LA_K,
    z = laZona({ zona: "todo" }),
    cx = (z[0] + z[2]) / 2,
    cy = (z[1] + z[3]) / 2,
    items = laGrabar({ cx, cy, s, zona: plExtUtil(), arq: conArq, colorArq: "color" }),
    Wc = plW() / 2,
    Hc = plH() / 2,
    // Del lienzo de grabación a las coordenadas del dibujo
    X = v => cx + (v - Wc) / s,
    Y = v => cy - (v - Hc) / s,
    // Número con 4 decimales; null si no es un número (la entidad no se escribe: AutoCAD no abriría el archivo)
    f = v => (Number.isFinite(+v) ? (+v).toFixed(4) : null),
    E = [],
    ent = a => {
      if (!a.includes(null)) E.push(...a);
    },
    capas = new Map(),
    nomCapa = new Map(),
    // Texto para R12: sin caracteres de control y a lo más 250 caracteres ya codificados; fuera del ASCII, \U+XXXX
    enc = t => {
      let o = "";
      for (const ch of String(t).replace(/[\u0000-\u001f\u007f]/g, " ")) {
        const c = ch.codePointAt(0),
          u = c < 128 ? ch : "\\U+" + c.toString(16).toUpperCase().padStart(4, "0");
        if (o.length + u.length > 250) break;
        o += u;
      }
      return o.trim();
    },
    /* Nombre de capa válido en R12 (AutoCAD no abre el archivo si no): solo A-Z, 0-9, $, - y _, hasta 31 caracteres.
       Las capas del arquitecto con espacios, tildes o nombres largos se adaptan; si dos quedan iguales, se numeran */
    capa = c => {
      const k = String(c || "0");
      if (nomCapa.has(k)) return nomCapa.get(k);
      const b =
        k
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toUpperCase()
          .replace(/[^A-Z0-9_$-]/g, "_")
          .slice(0, 31) || "0";
      let n = b;
      for (let i = 2; capas.has(n); i++) n = b.slice(0, 31 - String(i).length - 1) + "_" + i;
      const dc = D.capas.find(x => x.n === k);
      capas.set(n, dc ? laAci(dc.col) : 8);
      nomCapa.set(k, n);
      return n;
    };
  items.forEach(it => {
    const ly = capa(it.capa);
    if (it.t === "l") {
      const lt = it.dash ? "JMG_TRAZOS" : "CONTINUOUS",
        col = laAci(it.col);
      if (it.circ && it.p.length > 20) {
        const r = f(it.circ[2] / s);
        if (+r > 0) ent([0, "CIRCLE", 8, ly, 6, lt, 62, col, 10, f(X(it.circ[0])), 20, f(Y(it.circ[1])), 40, r]);
        return;
      }
      const P = it.p.map(p => [f(X(p[0])), f(Y(p[1]))]).filter(p => p[0] !== null && p[1] !== null);
      if (P.length < 2) return;
      if (P.length === 2 && !it.c) {
        ent([0, "LINE", 8, ly, 6, lt, 62, col, 10, P[0][0], 20, P[0][1], 11, P[1][0], 21, P[1][1]]);
        return;
      }
      E.push(0, "POLYLINE", 8, ly, 6, lt, 62, col, 66, 1, 10, "0.0", 20, "0.0", 70, it.c ? 1 : 0);
      P.forEach(p => E.push(0, "VERTEX", 8, ly, 10, p[0], 20, p[1]));
      E.push(0, "SEQEND", 8, ly);
    } else if (it.t === "f") {
      const col = laAci(it.col);
      if (laHex(it.col) === "#ffffff") return;
      it.pol.forEach(pp => {
        // Círculo lleno: polilínea de dos arcos con ancho (disco); triángulo o cuadrilátero: SOLID
        if (pp.circ && pp.p.length > 20) {
          const r = pp.circ[2] / s,
            x = X(pp.circ[0]),
            y = Y(pp.circ[1]);
          if (!(r > 0) || f(x) === null || f(y) === null) return;
          E.push(0, "POLYLINE", 8, ly, 62, col, 66, 1, 10, "0.0", 20, "0.0", 70, 1, 40, f(r), 41, f(r));
          E.push(0, "VERTEX", 8, ly, 10, f(x - r / 2), 20, f(y), 42, "1.0");
          E.push(0, "VERTEX", 8, ly, 10, f(x + r / 2), 20, f(y), 42, "1.0");
          E.push(0, "SEQEND", 8, ly);
        } else if (pp.p.length >= 3 && pp.p.length <= 5) {
          const p = pp.p.slice(0, 4),
            q = p.length === 4 ? p[3] : p[2];
          ent([
            0,
            "SOLID",
            8,
            ly,
            62,
            col,
            10,
            f(X(p[0][0])),
            20,
            f(Y(p[0][1])),
            11,
            f(X(p[1][0])),
            21,
            f(Y(p[1][1])),
            12,
            f(X(q[0])),
            22,
            f(Y(q[1])),
            13,
            f(X(p[2][0])),
            23,
            f(Y(p[2][1]))
          ]);
        }
      });
    } else if (it.t === "t") {
      const h = (it.h * 0.72) / s,
        rot = (-it.ang * 180) / Math.PI,
        j = it.al === "center" ? 1 : it.al === "right" || it.al === "end" ? 2 : 0,
        v = it.bl === "middle" ? 2 : it.bl === "top" || it.bl === "hanging" ? 3 : it.bl === "bottom" ? 1 : 0,
        x = f(X(it.p[0])),
        y = f(Y(it.p[1])),
        t = enc(it.s);
      if (!t || !(h > 0) || f(h) === null) return;
      ent([
        0,
        "TEXT",
        8,
        ly,
        62,
        laAci(it.col),
        7,
        "JMG_ARIAL",
        10,
        x,
        20,
        y,
        40,
        f(h),
        1,
        t,
        ...(Number.isFinite(rot) && Math.abs(rot) > 0.01 ? [50, rot.toFixed(2)] : []),
        ...(j || v ? [72, j, 73, v, 11, x, 21, y] : [])
      ]);
    }
  });
  // Encabezado y tablas: tipo de línea a trazos (3 mm y 1.5 mm en el papel), estilo de texto Arial y capas
  const lts = 1 / mmU,
    ex = conArq ? plExtUtil() : z,
    vc = [(ex[0] + ex[2]) / 2, (ex[1] + ex[3]) / 2],
    vh = Math.max(1e-6, (ex[3] - ex[1]) * 1.05),
    tablas = [
      0,
      "SECTION",
      2,
      "HEADER",
      9,
      "$ACADVER",
      1,
      "AC1009",
      9,
      "$DWGCODEPAGE",
      3,
      "ANSI_1252",
      9,
      "$LTSCALE",
      40,
      f(lts),
      // Extensión del dibujo y vista al abrir centrada en él (las coordenadas son las reales del plano, lejos del 0,0)
      9,
      "$EXTMIN",
      10,
      f(ex[0]),
      20,
      f(ex[1]),
      30,
      "0.0",
      9,
      "$EXTMAX",
      10,
      f(ex[2]),
      20,
      f(ex[3]),
      30,
      "0.0",
      9,
      "$VIEWCTR",
      10,
      f(vc[0]),
      20,
      f(vc[1]),
      9,
      "$VIEWSIZE",
      40,
      f(vh),
      0,
      "ENDSEC",
      0,
      "SECTION",
      2,
      "TABLES",
      0,
      "TABLE",
      2,
      "VPORT",
      70,
      1,
      0,
      "VPORT",
      2,
      "*ACTIVE",
      70,
      0,
      10,
      "0.0",
      20,
      "0.0",
      11,
      "1.0",
      21,
      "1.0",
      12,
      f(vc[0]),
      22,
      f(vc[1]),
      13,
      "0.0",
      23,
      "0.0",
      14,
      "1.0",
      24,
      "1.0",
      15,
      "1.0",
      25,
      "1.0",
      16,
      "0.0",
      26,
      "0.0",
      36,
      "1.0",
      17,
      "0.0",
      27,
      "0.0",
      37,
      "0.0",
      40,
      f(vh),
      41,
      f(Math.max(0.2, Math.min(5, (ex[2] - ex[0]) / Math.max(1e-9, ex[3] - ex[1])))),
      42,
      "50.0",
      43,
      "0.0",
      44,
      "0.0",
      50,
      "0.0",
      51,
      "0.0",
      71,
      0,
      72,
      100,
      73,
      1,
      74,
      3,
      75,
      0,
      76,
      0,
      77,
      0,
      78,
      0,
      0,
      "ENDTAB",
      0,
      "TABLE",
      2,
      "LTYPE",
      70,
      2,
      0,
      "LTYPE",
      2,
      "CONTINUOUS",
      70,
      0,
      3,
      "Continua",
      72,
      65,
      73,
      0,
      40,
      "0.0",
      0,
      "LTYPE",
      2,
      "JMG_TRAZOS",
      70,
      0,
      3,
      "Trazos (tuberia en piso)",
      72,
      65,
      73,
      2,
      40,
      "4.5",
      49,
      "3.0",
      49,
      "-1.5",
      0,
      "ENDTAB",
      0,
      "TABLE",
      2,
      "STYLE",
      70,
      1,
      0,
      "STYLE",
      2,
      "JMG_ARIAL",
      70,
      0,
      40,
      "0.0",
      41,
      "1.0",
      50,
      "0.0",
      71,
      0,
      42,
      "2.5",
      3,
      "arial.ttf",
      4,
      "",
      0,
      "ENDTAB",
      0,
      "TABLE",
      2,
      "LAYER",
      70,
      capas.size,
      ...[...capas].flatMap(([n, c]) => [0, "LAYER", 2, n, 70, 0, 62, c, 6, "CONTINUOUS"]),
      0,
      "ENDTAB",
      0,
      "ENDSEC",
      0,
      "SECTION",
      2,
      "ENTITIES"
    ];
  const out = [...tablas, ...E, 0, "ENDSEC", 0, "EOF"];
  // El texto del archivo se arma de una vez (sumar cadenas una por una es muy lento con proyectos grandes)
  const ln = new Array(out.length);
  for (let i = 0; i < out.length; i++) ln[i] = out[i];
  return ln.join("\r\n") + "\r\n";
}

/* ---------- Ventana Lámina ---------- */
const LA_VW = ventanaMovil(document.querySelector("#lamDlg .vw"), "jmg-electric-lamina", {
  w: 1040,
  h: 660,
  minW: 720,
  minH: 420
});
function lamAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  laLista();
  $("lamDlg").hidden = false;
  vwFondo();
  LA_VW.abrir();
  lamCargar();
}
function lamCerrar() {
  $("lamDlg").hidden = true;
  vwFondo();
}
// Pone en la ventana los datos de la lámina elegida
function lamCargar() {
  const D = dsD(),
    L = laLista(),
    op = laOp();
  $("laSel").innerHTML = L.map(
    (l, i) =>
      `<option value="${i}">${esc(l.num || "IE-0" + (i + 1))} · ${esc((l.tit || LA_DEF.tit).slice(0, 40))}</option>`
  ).join("");
  $("laSel").value = String(D.lamI || 0);
  $("laZona").innerHTML =
    EPL.plantas.map((p, i) => `<option value="planta:${i}">Planta: ${esc(p.n)}</option>`).join("") +
    `<option value="todo">Todo el diseño eléctrico</option><option value="vista">Lo que se ve en la pantalla</option>` +
    (op.rect ? `<option value="rect">La zona marcada en el plano</option>` : "");
  // Sin zona elegida: la primera planta encuadrada o, si no hay, todo el diseño
  let z = op.zona;
  if (!z || (z.startsWith("planta:") && !EPL.plantas[+z.slice(7)]) || (z === "rect" && !op.rect))
    z = EPL.plantas.length ? "planta:0" : "todo";
  $("laZona").value = z;
  $("laTam").value = LAMINAS[op.tam] ? op.tam : "auto";
  $("laEsc").value = op.esc > 0 ? String(op.esc) : "auto";
  $("laArq").value = op.arq;
  $("laColor").value = op.color;
  $("laLey").checked = op.ley;
  $("laCua").checked = op.cua !== false;
  $("laTit").value = op.tit;
  $("laNum").value = op.num;
  $("laNotas").value = op.notas;
  const ocl = new Set(op.ocl || []);
  $("laCapas").innerHTML = D.capas
    .map(
      c =>
        `<label><input type="checkbox" data-lac="${esc(c.n)}"${ocl.has(c.n) ? "" : " checked"}><i class="ca-sw" style="background:${c.col}"></i>${esc(c.n)}</label>`
    )
    .join("");
  $("laNotas").closest("label").hidden = false;
  lamVista();
}
// Datos de la ventana a la lámina elegida (con deshacer) y vista previa
function lamLeer() {
  const D = dsD(),
    L = laLista(),
    i = D.lamI || 0,
    e = +$("laEsc").value,
    ocl = [...$("laCapas").querySelectorAll("[data-lac]")].filter(c => !c.checked).map(c => c.dataset.lac);
  L[i] = {
    ...L[i],
    tam: LAMINAS[$("laTam").value] ? $("laTam").value : "auto",
    zona: $("laZona").value || "",
    arq: ["gris", "negro", "color"].includes($("laArq").value) ? $("laArq").value : "gris",
    color: $("laColor").value === "bn" ? "bn" : "color",
    ley: $("laLey").checked,
    cua: $("laCua").checked,
    tit: $("laTit").value.replace(/[<>]/g, "").slice(0, 120) || LA_DEF.tit,
    num: $("laNum").value.replace(/[<>]/g, "").slice(0, 20) || "IE-0" + (i + 1),
    notas: $("laNotas").value.replace(/[<>]/g, "").slice(0, 2000)
  };
  // La escala de la lámina es suya (no cambia la del diseño); sin elegir, la automática
  if (DS_ESCALAS.includes(e)) L[i].esc = e;
  else delete L[i].esc;
  if (ocl.length) L[i].ocl = ocl;
  else delete L[i].ocl;
  edCambio();
}
function lamVista() {
  if ($("lamDlg").hidden) return;
  const r = laSvg();
  $("laPrev").innerHTML = r.svg;
  // Lo que eligió el ajuste automático, en la misma opción
  $("laTam").querySelector('[value="auto"]').textContent = `Automático: ${r.tam} (recomendado)`;
  $("laEsc").querySelector('[value="auto"]').textContent = `Automática: 1:${r.esc} (recomendada)`;
  // Si la zona no entra: pasar al papel y la escala automáticos o, con varias plantas, una lámina por planta
  const op = laOp(),
    noEntra = /no entra|no cabe|no queda sitio/.test(r.aviso),
    fijo = !!LAMINAS[op.tam] || op.esc > 0,
    variasPl = /^(todo|vista)$/.test(op.zona || "") && EPL.plantas.length > 1;
  $("laAviso").innerHTML =
    esc(r.aviso) +
    (noEntra && (fijo || variasPl)
      ? `<span class="la-av-b">${fijo ? '<button type="button" class="vw-btn" data-la="auto">Usar papel y escala automáticos</button>' : ""}${variasPl ? '<button type="button" class="vw-btn" data-la="porplanta">Una lámina por planta</button>' : ""}</span>`
      : "");
  $("laAviso").hidden = !r.aviso;
}
// La zona marcada en el plano (herramienta Zona de la lámina): vuelve a la ventana con esa zona
function lamZonaMarcada(z) {
  const D = dsD(),
    L = laLista(),
    i = D.lamI || 0;
  if (Math.abs(z[2] - z[0]) * PLV.s < 8 || Math.abs(z[3] - z[1]) * PLV.s < 8) return lamAbrir();
  L[i] = { ...L[i], zona: "rect", rect: z };
  edCambio();
  lamAbrir();
  toast("Zona marcada: la lámina muestra ese rectángulo");
}
/* Plantas con diseño eléctrico que ninguna de las láminas (ops) muestra, con el número que les toca (después del mayor
   IE-NN). Las usan «Una lámina por planta» y el expediente, para que vayan todas las plantas. */
function laPlantasSin(ops) {
  const D = dsD(),
    usadas = new Set(ops.map(o => o.zona || (EPL.plantas.length ? "planta:0" : "todo"))),
    conDis = p =>
      D.els.some(e => {
        if (e.t !== "sim" && e.t !== "tub") return false;
        const b = dsBBox(e);
        return b[2] >= p.x0 && b[0] <= p.x1 && b[3] >= p.y0 && b[1] <= p.y1;
      }),
    n0 = ops.reduce((m, o) => Math.max(m, +(/^IE-(\d+)/.exec(o.num) || [0, 0])[1]), 0);
  return EPL.plantas
    .map((p, i) => ({ p, z: "planta:" + i }))
    .filter(({ p, z }) => !usadas.has(z) && conDis(p))
    .map((o, j) => ({ ...o, num: "IE-" + String(n0 + j + 1).padStart(2, "0") }));
}
/* «Una lámina por planta»: cada planta con diseño queda con su lámina (papel y escala automáticos, las demás opciones
   de la primera). Una lámina de «todo el diseño» o «lo que se ve en la pantalla» pasa a la primera planta que falta. */
function lamPorPlanta() {
  if (!EPL || !EPL.plantas.length) return toast("Primero encuadre las plantas (Inicio › Plantas)");
  const D = dsD(),
    L = laLista(),
    ops = L.map((l, i) => laOp(i)),
    falta = laPlantasSin(ops.filter(o => !/^(todo|vista)$/.test(o.zona || "")));
  if (!falta.length) return toast("Cada planta con diseño ya tiene su lámina");
  const limpia = o => {
    const c = { ...o, tam: "auto" };
    ["esc", "rect", "_i", "_n"].forEach(k => delete c[k]);
    return c;
  };
  let n = 0;
  L.forEach((l, i) => {
    if (n < falta.length && /^(todo|vista)$/.test(ops[i].zona || "")) {
      L[i] = { ...limpia(ops[i]), zona: falta[n].z, num: ops[i].num };
      n++;
    }
  });
  // Los números siguen al mayor de las láminas que quedan
  const resto = falta.slice(n),
    n0 = L.reduce((m, o) => Math.max(m, +(/^IE-(\d+)/.exec(o.num || "") || [0, 0])[1]), 0);
  resto.forEach((f, j) => L.push({ ...limpia(laOp(0)), zona: f.z, num: "IE-" + String(n0 + j + 1).padStart(2, "0") }));
  D.lamI = Math.min(D.lamI || 0, L.length - 1);
  edCambio();
  if (!$("lamDlg").hidden) lamCargar();
  toast(`${falta.length} lámina${falta.length > 1 ? "s" : ""} por planta: ${L.map(l => l.num).join(", ")}`);
}
/* Láminas del diseño para el expediente (js/exportar/descargas.js): las del plano aplicado al proyecto (PLANO), con
   su arquitectura leída del navegador. No necesita el editor abierto: usa una copia y deja todo como estaba. Sin
   diseño o sin su archivo DXF, ninguna. */
async function laminasExpediente() {
  if (typeof PLANO === "undefined" || !PLANO || !PLANO.sha || !PLANO.dis) return [];
  if (!(PLANO.dis.els || []).some(e => e.t === "sim")) return [];
  const vE = EPL,
    vM = PL_MOD,
    vS = PL_SHA,
    vB = [...PL_BORR];
  try {
    EPL = clon(PLANO);
    dsAsegurar();
    if (!PL_MOD || PL_SHA !== EPL.sha) {
      const o = await plLeerArchivo(EPL.sha);
      if (!o || !o.buf) return [];
      PL_MOD = modeloDxf(o.buf);
      PL_SHA = EPL.sha;
    }
    PL_BORR.clear();
    (EPL.borr || []).forEach(n => PL_BORR.add(n));
    dsIdxSucio();
    /* Todas las plantas: las láminas del proyecto y, para cada planta con diseño que ninguna muestra, una más con
       las mismas opciones que la primera (papel y escala automáticos), numerada después de la última */
    const ops = laLista().map((l, i) => laOp(i));
    laPlantasSin(ops).forEach(({ z, num }) =>
      ops.push({ ...ops[0], tam: "auto", esc: undefined, rect: undefined, zona: z, num })
    );
    return ops.map((op, i) => {
      const r = laSvg({ ...op, _i: i, _n: ops.length });
      return { svg: r.svg, W: r.W, H: r.H, hoja: op.num, tit: op.tit, tam: r.tam, esc: r.esc, vista: laVistaTit(op) };
    });
  } catch (e) {
    toast("Las láminas del diseño no se pudieron preparar: " + e.message);
    return [];
  } finally {
    EPL = vE;
    // Con el editor cerrado, el plano leído queda para la próxima vez (el editor lo reconoce por su huella)
    if (vE) {
      PL_MOD = vM;
      PL_SHA = vS;
    }
    PL_BORR.clear();
    vB.forEach(n => PL_BORR.add(n));
    dsIdxSucio();
  }
}
function lamImprimir(todas) {
  const L = laLista(),
    idx = todas ? L.map((l, i) => i) : [dsD().lamI || 0],
    hojas = idx.map(i => ({ i, ...laSvg(laOp(i)) }));
  let pa = $("printArea");
  if (!pa) {
    pa = document.createElement("div");
    pa.id = "printArea";
    document.body.appendChild(pa);
  }
  // Cada lámina en su página, con el tamaño de su papel
  pa.innerHTML =
    `<style>${hojas.map((h, j) => `@page la${j}{size:${h.W}mm ${h.H}mm;margin:0}#printArea .la-h${j}{page:la${j};width:${h.W - 0.5}mm;height:${h.H - 0.5}mm}`).join("")}#printArea{margin:0;padding:0}#printArea .la-hoja{overflow:hidden;break-after:page;break-inside:avoid;margin:0}#printArea .la-hoja:last-child{break-after:auto}#printArea .la-hoja svg{display:block;width:100%;height:100%}@page{margin:0}</style>` +
    hojas.map((h, j) => `<div class="la-hoja la-h${j}">${h.svg}</div>`).join("");
  document.body.classList.add("printing");
  printTitulo = document.title;
  const nom = ($("p_nombre").value.trim() || "Proyecto").replace(/[\\/:*?"<>|]/g, "").slice(0, 70);
  document.title = todas ? `Láminas - ${nom}` : `${laOp().num} - ${nom}`;
  setTimeout(() => window.print(), 80);
}
function lamDxf(conArq) {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  if (!dsD().els.length) return toast("El diseño eléctrico aún no tiene elementos");
  const nom = ($("p_nombre").value.trim() || "Proyecto").replace(/[\\/:*?"<>|]/g, "").slice(0, 60);
  descargarLocal(
    new Blob([laDxf(conArq)], { type: "application/dxf" }),
    `${nom} - diseño eléctrico${conArq ? " con arquitectura" : ""}.dxf`
  );
  toast(
    conArq
      ? "DXF con la arquitectura y el diseño eléctrico, en sus coordenadas reales"
      : "DXF del diseño eléctrico en coordenadas reales: insértelo en el plano del arquitecto en 0,0"
  );
}
$("laEsc").innerHTML =
  '<option value="auto">Automática (recomendada)</option>' +
  DS_ESCALAS.map(e => `<option value="${e}">1:${e}</option>`).join("");
$("lamDlg").addEventListener("change", e => {
  if (e.target.id === "laSel") {
    dsD().lamI = +e.target.value || 0;
    edCambio();
    return lamCargar();
  }
  lamLeer();
  lamCargar();
});
$("lamDlg").addEventListener("click", e => {
  if (e.target.id === "lamDlg") return lamCerrar();
  const b = e.target.closest("[data-la]");
  if (!b) return;
  const a = b.dataset.la;
  if (a === "cerrar") lamCerrar();
  else if (a === "max") {
    LA_VW.maximizar();
    lamVista();
  } else if (a === "pdf") lamImprimir(false);
  else if (a === "pdftodas") lamImprimir(true);
  else if (a === "porplanta") lamPorPlanta();
  else if (a === "auto") {
    $("laTam").value = "auto";
    $("laEsc").value = "auto";
    lamLeer();
    lamCargar();
  } else if (a === "dxf") lamDxf(false);
  else if (a === "nueva") {
    const D = dsD(),
      L = laLista(),
      u = L[D.lamI || 0];
    L.push({ ...u, num: "IE-" + String(L.length + 1).padStart(2, "0"), tit: LA_DEF.tit });
    D.lamI = L.length - 1;
    edCambio();
    lamCargar();
    toast(`Lámina ${L[D.lamI].num} creada: elija su zona, sus capas y su título`);
  } else if (a === "quitar") {
    const D = dsD(),
      L = laLista();
    if (L.length < 2) return toast("El proyecto necesita al menos una lámina");
    L.splice(D.lamI || 0, 1);
    D.lamI = Math.max(0, (D.lamI || 0) - 1);
    edCambio();
    lamCargar();
  } else if (a === "marcar") {
    lamCerrar();
    plHerr("lamzona");
    toast("Designe en el plano las dos esquinas de lo que va en la lámina");
  }
});
$("lamDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    lamCerrar();
  }
  e.stopPropagation();
});
