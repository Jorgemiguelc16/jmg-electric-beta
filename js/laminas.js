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
function laGrabar({ cx, cy, s, zona, arq, colorArq, leyenda }) {
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
    dsPintar(g);
    if (leyenda) {
      g.capa = "E-LEYENDA";
      dsDibLeyenda(g, leyenda, "#14212e", s, 1.2);
    }
  } finally {
    Object.assign(PLV, vPLV);
    DSU.sueltos = vSuel;
    PL_OSCURO = vOsc;
    PL_FONDO = vFondo;
    PL_COL.clear();
    vCol.forEach((v, k) => PL_COL.set(k, v));
    DS_EXPORT = false;
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
  tam: "A3",
  zona: "",
  arq: "gris",
  color: "color",
  ley: true,
  tit: "Instalaciones eléctricas · Alumbrado y tomacorrientes",
  num: "IE-01",
  notas:
    "Diseño según el Código Nacional de Electricidad – Utilización y los símbolos de la Norma DGE.\nTuberías de PVC empotradas; las medidas se verifican en obra."
};
const laOp = () => ({ ...LA_DEF, ...((dsD() && dsD().lam) || {}) });
// Zona del dibujo que va en la lámina: una planta encuadrada, lo que se ve en pantalla o todo el diseño
function laZona(op) {
  // Sin zona elegida: la primera planta encuadrada
  const zona = op.zona || (EPL.plantas.length ? "planta:0" : "todo");
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
// Arma la lámina: devuelve { svg, aviso } (aviso si la zona no entra en el papel a esa escala)
function laSvg(op = laOp()) {
  const [W, H] = LAMINAS[op.tam] || LAMINAS.A3,
    D = dsD(),
    escD = D.escala,
    mmU = (EPL.f * 1000) / escD,
    P = {
      nombre: $("p_nombre").value,
      prop: $("p_prop").value,
      ubic: $("p_ubic").value,
      proy: $("p_proy").value,
      cip: $("p_cip").value
    },
    hr = 124 / LA_PX,
    rw = 460 / LA_PX,
    // Marco: 25 mm a la izquierda (para anillar), 10 mm en los demás lados
    mx0 = 25,
    my0 = 10,
    mx1 = W - 10,
    my1 = H - 10,
    banda = my1 - hr,
    z = laZona(op),
    hayLey = D.els.some(
      e => e.t === "ley" && dsBBox(e)[0] < z[2] && dsBBox(e)[2] > z[0] && dsBBox(e)[1] < z[3] && dsBBox(e)[3] > z[1]
    ),
    conLey = op.ley && !hayLey && D.els.some(e => e.t !== "ley"),
    lw = conLey ? dsTamLey()[0] * mmU : 0,
    // Zona de dibujo (sobre la banda del rótulo y, con leyenda, a su izquierda)
    ax0 = mx0 + 4,
    ay0 = my0 + 4,
    ax1 = mx1 - 4 - (conLey ? lw + 6 : 0),
    ay1 = banda - 4,
    acx = (ax0 + ax1) / 2,
    acy = (ay0 + ay1) / 2,
    zw = (z[2] - z[0]) * mmU,
    zh = (z[3] - z[1]) * mmU,
    cx = (z[0] + z[2]) / 2,
    cy = (z[1] + z[3]) / 2,
    s = mmU * LA_K;
  const aviso =
    zw > ax1 - ax0 + 0.5 || zh > ay1 - ay0 + 0.5
      ? `La zona (${fmt(zw, 0)} × ${fmt(zh, 0)} mm a 1:${escD}) no entra en el área de dibujo de ${op.tam} (${fmt(ax1 - ax0, 0)} × ${fmt(ay1 - ay0, 0)} mm): elija un papel más grande, una escala menor o encuadre una planta.`
      : "";
  // Leyenda arriba a la derecha (en coordenadas del dibujo, para dibujarla con el mismo código)
  const ley = conLey
    ? { t: "ley", tit: "LEYENDA", x: cx + (mx1 - 4 - lw - acx) / mmU, y: cy - (ay0 - acy) / mmU }
    : null;
  const items = laGrabar({ cx, cy, s, zona: [z[0], z[1], z[2], z[3]], arq: true, colorArq: op.arq, leyenda: ley });
  // Del lienzo de grabación al papel (mm), con el centro de la zona en el centro del área
  const Wc = plW() / 2,
    Hc = plH() / 2,
    X = v => +((acx + (v - Wc) / LA_K) * LA_PX).toFixed(2),
    Y = v => +((acy + (v - Hc) / LA_K) * LA_PX).toFixed(2),
    bn = op.color === "bn",
    C = c => (bn ? (laHex(c) === "#ffffff" ? "#ffffff" : "#000000") : laHex(c));
  const o = [],
    q = n => +(n * LA_PX).toFixed(2);
  o.push(
    `<defs><clipPath id="laArea"><rect x="${q(ax0)}" y="${q(ay0)}" width="${q(ax1 - ax0)}" height="${q(ay1 - ay0)}"/></clipPath></defs>`
  );
  const cuerpo = [],
    leyO = [];
  items.forEach(it => {
    const dst = it.capa === "E-LEYENDA" ? leyO : cuerpo;
    if (it.t === "l") {
      const d = it.p.map((p, i) => `${i ? "L" : "M"}${X(p[0])} ${Y(p[1])}`).join("") + (it.c ? "Z" : "");
      dst.push(
        `<path d="${d}" fill="none" stroke="${C(it.col)}" stroke-width="${Math.max(0.1, it.w / LA_K) * LA_PX}"${it.dash ? ` stroke-dasharray="${it.dash.map(v => +((v / LA_K) * LA_PX).toFixed(2)).join(" ")}"` : ""} stroke-linecap="round" stroke-linejoin="round"/>`
      );
    } else if (it.t === "f") {
      const d = it.pol.map(s => s.p.map((p, i) => `${i ? "L" : "M"}${X(p[0])} ${Y(p[1])}`).join("") + "Z").join("");
      dst.push(`<path d="${d}" fill="${C(it.col)}" stroke="none" fill-rule="evenodd"/>`);
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
  // Escala gráfica abajo a la izquierda del área: 0 a 5 m (o lo que entre)
  const paso = [0.5, 1, 2, 5, 10].find(v => v * (1000 / escD) * 5 <= 90) || 0.5,
    lm = paso * (1000 / escD),
    ex = ax0 + 2,
    ey = ay1 - 6;
  for (let i = 0; i < 5; i++)
    o.push(
      `<rect x="${q(ex + i * lm)}" y="${q(ey)}" width="${q(lm)}" height="${q(1.6)}" fill="${i % 2 ? "#ffffff" : "#14212e"}" stroke="#14212e" stroke-width="0.6"/>`
    );
  for (let i = 0; i <= 5; i++)
    o.push(
      `<text x="${q(ex + i * lm)}" y="${q(ey - 1)}" font-size="${q(2)}" text-anchor="middle" fill="#14212e">${fmt(i * paso, paso < 1 ? 1 : 0)}</text>`
    );
  o.push(
    `<text x="${q(ex + 5 * lm + 2)}" y="${q(ey + 1.6)}" font-size="${q(2.2)}" fill="#14212e">m · ESCALA 1:${escD}</text>`
  );
  // Notas a la izquierda del rótulo
  const nx = mx0,
    nw = mx1 - rw - mx0,
    lineas = [];
  String(op.notas || "")
    .split("\n")
    .map(t => t.trim())
    .filter(Boolean)
    .forEach((t, i) => {
      const max = Math.floor((nw - 10) / 1.45);
      let u = "";
      const ls = [];
      t.split(" ").forEach(p => {
        if ((u + " " + p).trim().length > max && u) {
          ls.push(u);
          u = p;
        } else u = (u + " " + p).trim();
      });
      ls.push(u);
      ls.forEach((l, j) => lineas.push([j ? "" : `${i + 1}.`, l]));
    });
  o.push(
    `<rect x="${q(nx)}" y="${q(banda)}" width="${q(nw)}" height="${q(hr)}" fill="none" stroke="#14304f" stroke-width="1"/>`
  );
  o.push(`<text x="${q(nx + 3)}" y="${q(banda + 5)}" font-size="9" font-weight="700" fill="#14304f">NOTAS</text>`);
  lineas.slice(0, Math.floor((hr - 8) / 3.4)).forEach(([n, l], i) => {
    const y = banda + 9.5 + i * 3.4;
    if (n) o.push(`<text x="${q(nx + 3)}" y="${q(y)}" font-size="7.6" font-weight="700" fill="#14304f">${n}</text>`);
    o.push(`<text x="${q(nx + 7)}" y="${q(y)}" font-size="7.6" fill="#14212e">${esc(l)}</text>`);
  });
  // Rótulo de la plataforma
  rotuloSvg(o, q(mx1 - rw), q(banda), q(rw), 124, P, `${op.tit} · Escala 1:${escD}`, op.num);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${q(W)} ${q(H)}" font-family="Arial, Helvetica, sans-serif">` +
    `<rect width="${q(W)}" height="${q(H)}" fill="#fff"/><rect x="${q(mx0)}" y="${q(my0)}" width="${q(mx1 - mx0)}" height="${q(my1 - my0)}" fill="none" stroke="#14304f" stroke-width="1.5"/>` +
    o.join("") +
    `</svg>`;
  return { svg, aviso, W, H };
}

/* ---------- DXF del diseño en coordenadas reales (R12) ---------- */
// Color ACI más cercano a un color
function laAci(hex) {
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
    f = v => (+v).toFixed(4),
    E = [],
    add = (...a) => E.push(...a),
    capas = new Map(),
    enc = t =>
      Array.from(String(t))
        .map(ch => {
          const c = ch.codePointAt(0);
          return c < 128 ? ch : "\\U+" + c.toString(16).toUpperCase().padStart(4, "0");
        })
        .join(""),
    capa = c => {
      const n =
        String(c || "0")
          .replace(/[<>/\\":;?*|=,]/g, "_")
          .slice(0, 60) || "0";
      if (!capas.has(n)) {
        const dc = D.capas.find(x => x.n === c);
        capas.set(n, dc ? laAci(dc.col) : 8);
      }
      return n;
    };
  items.forEach(it => {
    const ly = capa(it.capa);
    if (it.t === "l") {
      const lt = it.dash ? "JMG_TRAZOS" : "CONTINUOUS",
        col = laAci(it.col);
      if (it.circ && it.p.length > 20) {
        add(0, "CIRCLE", 8, ly, 6, lt, 62, col, 10, f(X(it.circ[0])), 20, f(Y(it.circ[1])), 40, f(it.circ[2] / s));
        return;
      }
      if (it.p.length === 2 && !it.c) {
        const [a, b] = it.p;
        add(0, "LINE", 8, ly, 6, lt, 62, col, 10, f(X(a[0])), 20, f(Y(a[1])), 11, f(X(b[0])), 21, f(Y(b[1])));
        return;
      }
      add(0, "POLYLINE", 8, ly, 6, lt, 62, col, 66, 1, 10, "0.0", 20, "0.0", 70, it.c ? 1 : 0);
      it.p.forEach(p => add(0, "VERTEX", 8, ly, 10, f(X(p[0])), 20, f(Y(p[1]))));
      add(0, "SEQEND", 8, ly);
    } else if (it.t === "f") {
      const col = laAci(it.col);
      if (laHex(it.col) === "#ffffff") return;
      it.pol.forEach(pp => {
        // Círculo lleno: polilínea de dos arcos con ancho (disco); triángulo o cuadrilátero: SOLID
        if (pp.circ && pp.p.length > 20) {
          const r = pp.circ[2] / s,
            x = X(pp.circ[0]),
            y = Y(pp.circ[1]);
          add(0, "POLYLINE", 8, ly, 62, col, 66, 1, 10, "0.0", 20, "0.0", 70, 1, 40, f(r), 41, f(r));
          add(0, "VERTEX", 8, ly, 10, f(x - r / 2), 20, f(y), 42, "1.0");
          add(0, "VERTEX", 8, ly, 10, f(x + r / 2), 20, f(y), 42, "1.0");
          add(0, "SEQEND", 8, ly);
        } else if (pp.p.length <= 5) {
          const p = pp.p.slice(0, 4),
            q = p.length === 4 ? p[3] : p[2];
          add(0, "SOLID", 8, ly, 62, col, 10, f(X(p[0][0])), 20, f(Y(p[0][1])), 11, f(X(p[1][0])), 21, f(Y(p[1][1])));
          add(12, f(X(q[0])), 22, f(Y(q[1])), 13, f(X(p[2][0])), 23, f(Y(p[2][1])));
        }
      });
    } else if (it.t === "t") {
      const h = (it.h * 0.72) / s,
        rot = (-it.ang * 180) / Math.PI,
        j = it.al === "center" ? 1 : it.al === "right" || it.al === "end" ? 2 : 0,
        v = it.bl === "middle" ? 2 : it.bl === "top" || it.bl === "hanging" ? 3 : it.bl === "bottom" ? 1 : 0,
        x = f(X(it.p[0])),
        y = f(Y(it.p[1]));
      add(0, "TEXT", 8, ly, 62, laAci(it.col), 7, "JMG_ARIAL", 10, x, 20, y, 40, f(h), 1, enc(it.s));
      if (Math.abs(rot) > 0.01) add(50, rot.toFixed(2));
      if (j || v) add(72, j, 73, v, 11, x, 21, y);
    }
  });
  // Encabezado y tablas: tipo de línea a trazos (3 mm y 1.5 mm en el papel), estilo de texto Arial y capas
  const lts = 1 / mmU,
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
      9,
      "$INSUNITS",
      70,
      EPL.f === 1 ? 6 : EPL.f === 0.01 ? 5 : 4,
      0,
      "ENDSEC",
      0,
      "SECTION",
      2,
      "TABLES",
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
  let txt = "";
  for (let i = 0; i < out.length; i += 2) txt += `${out[i]}\r\n${out[i + 1]}\r\n`;
  return txt;
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
  const op = laOp();
  $("laZona").innerHTML =
    EPL.plantas.map((p, i) => `<option value="planta:${i}">Planta: ${esc(p.n)}</option>`).join("") +
    `<option value="todo">Todo el diseño eléctrico</option><option value="vista">Lo que se ve en la pantalla</option>`;
  // Sin zona elegida: la primera planta encuadrada o, si no hay, todo el diseño
  if (!op.zona || (op.zona.startsWith("planta:") && !EPL.plantas[+op.zona.slice(7)]))
    op.zona = EPL.plantas.length ? "planta:0" : "todo";
  $("laTam").value = op.tam;
  $("laZona").value = op.zona;
  if (!$("laZona").value) $("laZona").value = EPL.plantas.length ? "planta:0" : "todo";
  $("laArq").value = op.arq;
  $("laColor").value = op.color;
  $("laLey").checked = op.ley;
  $("laTit").value = op.tit;
  $("laNum").value = op.num;
  $("laNotas").value = op.notas;
  $("laEsc").value = String(dsD().escala);
  $("lamDlg").hidden = false;
  vwFondo();
  LA_VW.abrir();
  lamVista();
}
function lamCerrar() {
  $("lamDlg").hidden = true;
  vwFondo();
}
// Opciones de la ventana al diseño (con deshacer) y vista previa
function lamLeer() {
  const D = dsD();
  D.lam = {
    tam: LAMINAS[$("laTam").value] ? $("laTam").value : "A3",
    zona: $("laZona").value || "todo",
    arq: ["gris", "negro", "color"].includes($("laArq").value) ? $("laArq").value : "gris",
    color: $("laColor").value === "bn" ? "bn" : "color",
    ley: $("laLey").checked,
    tit: $("laTit").value.replace(/[<>]/g, "").slice(0, 120) || LA_DEF.tit,
    num: $("laNum").value.replace(/[<>]/g, "").slice(0, 20) || "IE-01",
    notas: $("laNotas").value.replace(/[<>]/g, "").slice(0, 2000)
  };
  const e = +$("laEsc").value;
  if (DS_ESCALAS.includes(e) && e !== D.escala) D.escala = e;
  edCambio();
}
function lamVista() {
  if ($("lamDlg").hidden) return;
  const r = laSvg();
  $("laPrev").innerHTML = r.svg;
  $("laAviso").textContent = r.aviso;
  $("laAviso").hidden = !r.aviso;
}
function lamImprimir() {
  const r = laSvg();
  let pa = $("printArea");
  if (!pa) {
    pa = document.createElement("div");
    pa.id = "printArea";
    document.body.appendChild(pa);
  }
  pa.innerHTML =
    `<style>@page{size:${r.W}mm ${r.H}mm;margin:0}#printArea .la-hoja{width:${r.W}mm;height:${r.H}mm;overflow:hidden}#printArea .la-hoja svg{display:block;width:${r.W}mm;height:${r.H}mm}</style>` +
    `<div class="la-hoja">${r.svg}</div>`;
  document.body.classList.add("printing");
  printTitulo = document.title;
  const op = laOp();
  document.title = `${op.num} - ${($("p_nombre").value.trim() || "Proyecto").replace(/[\\/:*?"<>|]/g, "").slice(0, 70)}`;
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
$("laEsc").innerHTML = DS_ESCALAS.map(e => `<option value="${e}">1:${e}</option>`).join("");
$("lamDlg").addEventListener("change", () => {
  lamLeer();
  lamVista();
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
  } else if (a === "pdf") lamImprimir();
  else if (a === "dxf") lamDxf(false);
});
$("lamDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    lamCerrar();
  }
  e.stopPropagation();
});
