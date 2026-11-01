/* LECTOR DXF
   Lee un plano de AutoCAD en formato DXF (texto, de cualquier versión) y lo convierte en lo que dibuja la vista del
   plano (js/plano.js): trazos (líneas y curvas como polilíneas en coordenadas del dibujo), rellenos, textos, las
   capas con su color y los puntos de enganche (extremos, puntos medios, centros e inserciones de bloques).
   - Solo el espacio modelo: lo de las presentaciones (espacio papel) no se dibuja.
   - Los bloques se expanden con su escala, giro, espejo y arreglo (MINSERT); las cotas y tablas, con su bloque.
   - Los colores siguen el índice de AutoCAD (ACI) o el color verdadero; «PorCapa» y «PorBloque» se resuelven aquí.
   - Los arcos, círculos, elipses y splines se dibujan con tramos rectos cortos (el error de cuerda es despreciable).
   No usa la pantalla: lo prueban las pruebas sin navegador (herramientas/pruebas-dxf.js). */

// Colores del índice de AutoCAD: 1 a 9 fijos, 10 a 249 por tono (24 tonos de 15°, cinco brillos, pleno o claro) y
// 250 a 255 grises
const ACI = (() => {
  const hex = (r, g, b) => "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const t = [null, "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffffff", "#808080", "#c0c0c0"];
  const V = [1, 0.65, 0.5, 0.3, 0.15];
  for (let i = 10; i < 250; i++) {
    const h = Math.floor((i - 10) / 10) * 15,
      k = (i - 10) % 10,
      v = V[k >> 1] * 255,
      s = k % 2 ? 0.5 : 1;
    // HSV a RGB
    const f = c => {
      const x = (c + h / 60) % 6;
      return v - v * s * Math.max(0, Math.min(x, 4 - x, 1));
    };
    t[i] = hex(f(5), f(3), f(1));
  }
  [0x33, 0x50, 0x69, 0x82, 0xbe, 0xff].forEach((g, j) => (t[250 + j] = hex(g, g, g)));
  return t;
})();
const DXF_UNIDAD = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1, 14: 0.1 };

// Texto del archivo con la codificación correcta: UTF-8 desde AutoCAD 2007 (AC1021); antes, la página de códigos
// del dibujo (casi siempre Windows-1252)
function textoDxf(buf) {
  if (typeof buf === "string") return buf;
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const cab = new TextDecoder("windows-1252").decode(u8.subarray(0, 4000)),
    ver = (cab.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d{4})/) || [])[1] || "AC1009";
  return new TextDecoder(ver >= "AC1021" ? "utf-8" : "windows-1252").decode(u8);
}

// Separa el texto en pares (código, valor) y los agrupa en secciones y entidades
function leerDxf(txt) {
  const L = txt.split(/\r?\n/);
  if (/^AutoCAD Binary DXF/.test(L[0])) throw new Error("DXF binario: guárdelo como DXF de texto (ASCII)");
  const C = [],
    V = [];
  for (let i = 0; i + 1 < L.length; i += 2) {
    const c = parseInt(L[i], 10);
    if (Number.isNaN(c)) throw new Error(`El archivo no es un DXF válido (línea ${i + 1})`);
    C.push(c);
    V.push(L[i + 1].trim());
  }
  // Secciones: cada una es una lista de entidades { t, g: [[código, valor]…] }
  const sec = {};
  let nom = null,
    cur = null;
  for (let k = 0; k < C.length; k++) {
    if (C[k] === 0 && V[k] === "SECTION") {
      nom = C[k + 1] === 2 ? V[k + 1] : null;
      sec[nom] = [];
      cur = null;
      k++;
    } else if (C[k] === 0 && V[k] === "ENDSEC") nom = cur = null;
    else if (nom) {
      if (C[k] === 0) sec[nom].push((cur = { t: V[k], g: [] }));
      else if (cur) cur.g.push([C[k], V[k]]);
    }
  }
  if (!sec.ENTITIES) throw new Error("El archivo no tiene dibujo (falta la sección ENTITIES)");
  return { sec, C, V };
}

// Variables de la cabecera (la sección HEADER no tiene códigos 0 entre variables, por eso se lee de los pares):
// nombre de variable → lista de valores
function cabeceraDxf(C, V) {
  const out = {};
  let en = false,
    nom = null;
  for (let k = 0; k < C.length; k++) {
    if (C[k] === 2 && V[k] === "HEADER") en = true;
    else if (en && C[k] === 0) break;
    else if (en && C[k] === 9) out[(nom = V[k])] = [];
    else if (en && nom) out[nom].push(V[k]);
  }
  return out;
}

const dxNum = (g, c, d = 0) => {
  for (const [k, v] of g) if (k === c) return parseFloat(v);
  return d;
};
const dxStr = (g, c, d = "") => {
  for (const [k, v] of g) if (k === c) return v;
  return d;
};
const dxTodos = (g, c) => g.filter(x => x[0] === c).map(x => parseFloat(x[1]));

// Texto de MTEXT sin códigos de formato: \P es salto de línea, \S a^b es una fracción, {…} agrupa formato
function limpiarMtext(s) {
  return s
    .replace(/\\U\+([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\\/g, "\u0001")
    .replace(/\\P/g, "\n")
    .replace(/\\S([^;]*?)[\^#/]([^;]*?);/g, "$1/$2")
    .replace(/\\[fFcCHhTtQqWwAaPp][^;]*;/g, "")
    .replace(/\\pi?[^;]*;/g, "")
    .replace(/\\[LlOoKkNX]/g, "")
    .replace(/\\~/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\u0001/g, "\\");
}
// Códigos de control de TEXT: %%c diámetro, %%d grados, %%p más/menos; %%u y %%o (subrayado) se quitan
const limpiarTexto = s =>
  s
    .replace(/\\U\+([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/%%[cC]/g, "Ø")
    .replace(/%%[dD]/g, "°")
    .replace(/%%[pP]/g, "±")
    .replace(/%%[uUoOkK]/g, "")
    .replace(/%%%/g, "%");

// Matrices 2D afines [a, b, c, d, e, f]: x' = a·x + b·y + e, y' = c·x + d·y + f
const M_ID = [1, 0, 0, 1, 0, 0];
const mMul = (p, q) => [
  p[0] * q[0] + p[1] * q[2],
  p[0] * q[1] + p[1] * q[3],
  p[2] * q[0] + p[3] * q[2],
  p[2] * q[1] + p[3] * q[3],
  p[0] * q[4] + p[1] * q[5] + p[4],
  p[2] * q[4] + p[3] * q[5] + p[5]
];
const mPt = (m, x, y) => [m[0] * x + m[1] * y + m[4], m[2] * x + m[3] * y + m[5]];
const mEsc = m => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
// Sistema de coordenadas del objeto: con la extrusión hacia abajo (Z = −1) el objeto está en espejo respecto de X
const mOcs = g => (dxNum(g, 230, 1) < 0 ? [-1, 0, 0, 1, 0, 0] : M_ID);

// Puntos de un arco (centro, radio, ángulos en radianes, siempre en sentido antihorario de a0 a a1)
function puntosArco(cx, cy, r, a0, a1) {
  let d = a1 - a0;
  while (d <= 0) d += 2 * Math.PI;
  const n = Math.max(4, Math.min(256, Math.ceil(d / (Math.PI / 60)))),
    out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (d * i) / n;
    out.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return out;
}
// Tramo de polilínea con curvatura (bulge = tangente de un cuarto del ángulo del arco), sin el punto inicial
function puntosBulge(x0, y0, x1, y1, b) {
  const th = 4 * Math.atan(b),
    c = Math.hypot(x1 - x0, y1 - y0);
  if (!c || Math.abs(b) < 1e-9) return [x1, y1];
  const r = c / (2 * Math.sin(th / 2)),
    mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2,
    h = r * Math.cos(th / 2),
    ux = -(y1 - y0) / c,
    uy = (x1 - x0) / c,
    cx = mx + h * ux,
    cy = my + h * uy,
    a0 = Math.atan2(y0 - cy, x0 - cx);
  const n = Math.max(2, Math.min(128, Math.ceil(Math.abs(th) / (Math.PI / 60)))),
    out = [];
  for (let i = 1; i <= n; i++) {
    const a = a0 + (th * i) / n;
    out.push(cx + Math.abs(r) * Math.cos(a), cy + Math.abs(r) * Math.sin(a));
  }
  out[out.length - 2] = x1;
  out[out.length - 1] = y1;
  return out;
}
// Spline B (de Boor) con sus nudos y pesos; sin nudos, la curva pasa por los puntos de ajuste
function puntosSpline(gr, kn, cp, w, fit) {
  if (cp.length < 2 || kn.length < cp.length + gr + 1) return fit.length >= 2 ? fit.flat() : cp.flat();
  const n = Math.max(16, Math.min(400, cp.length * 8)),
    t0 = kn[gr],
    t1 = kn[kn.length - gr - 1],
    out = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.min(t1 - 1e-12, t0 + ((t1 - t0) * i) / n);
    let s = gr;
    while (s < kn.length - gr - 2 && t >= kn[s + 1]) s++;
    const d = [];
    for (let j = 0; j <= gr; j++) {
      const p = cp[s - gr + j] || cp[cp.length - 1],
        ww = w[s - gr + j] || 1;
      d.push([p[0] * ww, p[1] * ww, ww]);
    }
    for (let r = 1; r <= gr; r++)
      for (let j = gr; j >= r; j--) {
        const k = s - gr + j,
          den = kn[k + gr - r + 1] - kn[k],
          a = den ? (t - kn[k]) / den : 0;
        d[j] = [0, 1, 2].map(q => (1 - a) * d[j - 1][q] + a * d[j][q]);
      }
    out.push(d[gr][0] / d[gr][2], d[gr][1] / d[gr][2]);
  }
  return out;
}

/* Modelo del plano: capas, tipos de línea y bloques, y la lista de trazos del espacio modelo con los bloques ya
   expandidos. Cada trazo: { capa, col (#rrggbb), lt (tipo de línea o ""), lte (escala del tipo de línea), k ("l"
   línea, "f" relleno, "h" sombreado de trama), p: [x0, y0, x1, y1…], c (cerrado) }. Textos: { capa, col, x, y, h,
   rot (rad), s, ha (left|center|right), va (alphabetic|bottom|middle|top) }. */
function modeloDxf(entrada) {
  const { sec, C, V } = leerDxf(textoDxf(entrada));
  const cab = cabeceraDxf(C, V),
    c1 = k => (cab[k] ? cab[k][0] : undefined);
  // Capas: color (negativo = apagada), congelada (bit 1 de 70), tipo de línea
  const capas = {};
  const tabla = (nombre, fn) => {
    for (const e of sec.TABLES || []) if (e.t === nombre) fn(e.g);
  };
  tabla("LAYER", g => {
    const n = dxStr(g, 2),
      ci = dxNum(g, 62, 7),
      tc = dxStr(g, 420, "");
    if (!n) return;
    capas[n] = {
      col: tc ? "#" + (+tc & 0xffffff).toString(16).padStart(6, "0") : ACI[Math.abs(ci)] || "#ffffff",
      on: ci >= 0 && !(dxNum(g, 70) & 1),
      lt: dxStr(g, 6, "CONTINUOUS").toUpperCase(),
      n: 0
    };
  });
  if (!capas["0"]) capas["0"] = { col: "#ffffff", on: true, lt: "CONTINUOUS", n: 0 };
  // Tipos de línea: guiones (positivo), espacios (negativo) y puntos (0), en unidades del dibujo
  const tipos = {};
  tabla("LTYPE", g => {
    const n = dxStr(g, 2).toUpperCase(),
      d = dxTodos(g, 49);
    if (n && d.length && d.some(x => x < 0)) tipos[n] = d;
  });
  const LTS = parseFloat(c1("$LTSCALE")) || 1;
  // Bloques
  const bloques = {};
  let b = null;
  for (const e of sec.BLOCKS || []) {
    if (e.t === "BLOCK") {
      b = {
        n: dxStr(e.g, 2),
        x: dxNum(e.g, 10),
        y: dxNum(e.g, 20),
        ents: [],
        papel: /^\*paper_space/i.test(dxStr(e.g, 2))
      };
      bloques[b.n] = b;
    } else if (e.t === "ENDBLK") b = null;
    else if (b) b.ents.push(e);
  }
  const trazos = [],
    textos = [],
    snap = [],
    snapC = [],
    insertos = [];
  let nEnt = 0;
  // Punto de enganche: x, y y tipo (1 extremo, 2 punto medio, 3 centro, 4 inserción de bloque), con su capa aparte
  const pS = (x, y, k, capa) => {
    snap.push(x, y, k);
    snapC.push(capa);
  };
  const color = (g, capa, colPadre) => {
    const tc = dxStr(g, 420, "");
    if (tc) return "#" + (+tc & 0xffffff).toString(16).padStart(6, "0");
    const ci = dxNum(g, 62, 256);
    if (ci === 0) return colPadre || "#ffffff";
    if (ci === 256 || ci < 0) return (capas[capa] || capas["0"]).col;
    return ACI[ci] || "#ffffff";
  };
  const tipoLinea = (g, capa, ltPadre) => {
    let lt = dxStr(g, 6, "BYLAYER").toUpperCase();
    if (lt === "BYBLOCK") lt = ltPadre || "CONTINUOUS";
    if (lt === "BYLAYER") lt = (capas[capa] || capas["0"]).lt;
    return tipos[lt] ? lt : "";
  };
  // Agrega un trazo transformado por m; los vértices son puntos de enganche (s = 1) y los puntos medios de cada
  // tramo recto también (s = 2), salvo en las curvas, donde solo los extremos
  const agregar = (o, pts, m, k, cerrado, curva) => {
    if (pts.length < 4 && k !== "f") return;
    const p = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) {
      const q = mPt(m, pts[i], pts[i + 1]);
      p[i] = q[0];
      p[i + 1] = q[1];
    }
    trazos.push({ capa: o.capa, col: o.col, lt: o.lt, lte: o.lte * mEsc(m), k, p, c: !!cerrado });
    if (k !== "l") return;
    if (curva) {
      pS(p[0], p[1], 1, o.capa);
      pS(p[p.length - 2], p[p.length - 1], 1, o.capa);
      return;
    }
    for (let i = 0; i < p.length; i += 2) {
      pS(p[i], p[i + 1], 1, o.capa);
      if (i + 3 < p.length) pS((p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2, 2, o.capa);
    }
    if (cerrado && p.length >= 6) pS((p[0] + p[p.length - 2]) / 2, (p[1] + p[p.length - 1]) / 2, 2, o.capa);
  };
  // Dibuja una lista de entidades con la transformación m; capa, color y tipo de línea del bloque que las contiene
  // (para las que están en la capa 0 o son «PorBloque»)
  function dibujar(ents, m, padre, prof) {
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i],
        g = e.g;
      if (dxNum(g, 67) === 1) continue;
      let capa = dxStr(g, 8, "0");
      if (capa === "0" && padre) capa = padre.capa;
      if (!capas[capa]) capas[capa] = { col: "#ffffff", on: true, lt: "CONTINUOUS", n: 0 };
      const o = {
        capa,
        col: color(g, capa, padre && padre.col),
        lt: tipoLinea(g, capa, padre && padre.lt),
        lte: dxNum(g, 48, 1) * LTS
      };
      if (!prof) nEnt++;
      const ocs = mMul(m, mOcs(g));
      switch (e.t) {
        case "LINE":
          agregar(o, [dxNum(g, 10), dxNum(g, 20), dxNum(g, 11), dxNum(g, 21)], m, "l");
          break;
        case "LWPOLYLINE": {
          // Vértices con su curvatura (42) en orden
          const vs = [];
          for (const [c, v] of g) {
            if (c === 10) vs.push([parseFloat(v), 0, 0]);
            else if (c === 20 && vs.length) vs[vs.length - 1][1] = parseFloat(v);
            else if (c === 42 && vs.length) vs[vs.length - 1][2] = parseFloat(v);
          }
          const cerr = dxNum(g, 70) & 1;
          if (vs.length < 2) break;
          const pts = [vs[0][0], vs[0][1]];
          const nv = cerr ? vs.length : vs.length - 1,
            curva = vs.some(v => v[2]);
          for (let j = 0; j < nv; j++) {
            const a = vs[j],
              q = vs[(j + 1) % vs.length];
            pts.push(...puntosBulge(a[0], a[1], q[0], q[1], a[2]));
          }
          // Con tramos curvos, el enganche va solo a los vértices (no a los puntos intermedios de las curvas)
          agregar(o, pts, ocs, "l", cerr, curva);
          if (curva) vs.forEach(v => pS(...mPt(ocs, v[0], v[1]), 1, o.capa));
          break;
        }
        case "POLYLINE": {
          // Polilínea antigua: los vértices vienen como entidades VERTEX hasta SEQEND
          const vs = [];
          let j = i + 1;
          for (; j < ents.length && ents[j].t !== "SEQEND"; j++)
            if (ents[j].t === "VERTEX") vs.push([dxNum(ents[j].g, 10), dxNum(ents[j].g, 20), dxNum(ents[j].g, 42)]);
          i = j;
          if (dxNum(g, 70) & (16 | 64) || vs.length < 2) break;
          const cerr = dxNum(g, 70) & 1,
            pts = [vs[0][0], vs[0][1]];
          const nv = cerr ? vs.length : vs.length - 1;
          for (let k = 0; k < nv; k++) {
            const a = vs[k],
              q = vs[(k + 1) % vs.length];
            pts.push(...puntosBulge(a[0], a[1], q[0], q[1], a[2]));
          }
          agregar(o, pts, ocs, "l", cerr);
          break;
        }
        case "ARC":
        case "CIRCLE": {
          const cx = dxNum(g, 10),
            cy = dxNum(g, 20),
            r = dxNum(g, 40),
            a0 = e.t === "ARC" ? (dxNum(g, 50) * Math.PI) / 180 : 0,
            a1 = e.t === "ARC" ? (dxNum(g, 51) * Math.PI) / 180 : 2 * Math.PI;
          if (!(r > 0)) break;
          agregar(o, puntosArco(cx, cy, r, a0, a1), ocs, "l", e.t === "CIRCLE", true);
          pS(...mPt(ocs, cx, cy), 3, o.capa);
          break;
        }
        case "ELLIPSE": {
          const cx = dxNum(g, 10),
            cy = dxNum(g, 20),
            ax = dxNum(g, 11),
            ay = dxNum(g, 21),
            k = dxNum(g, 40, 1),
            t0 = dxNum(g, 41, 0),
            t1 = dxNum(g, 42, 2 * Math.PI);
          let d = t1 - t0;
          while (d <= 0) d += 2 * Math.PI;
          const n = Math.max(8, Math.ceil(d / (Math.PI / 60))),
            pts = [];
          // Eje menor: el mayor girado 90° y escalado por la razón; con extrusión hacia abajo, en espejo
          const s = dxNum(g, 230, 1) < 0 ? -1 : 1;
          for (let j = 0; j <= n; j++) {
            const t = t0 + (d * j) / n,
              c = Math.cos(t),
              sn = Math.sin(t) * s;
            pts.push(cx + ax * c - ay * k * sn, cy + ay * c + ax * k * sn);
          }
          agregar(o, pts, m, "l", d >= 2 * Math.PI - 1e-9, true);
          pS(...mPt(m, cx, cy), 3, o.capa);
          break;
        }
        case "SPLINE": {
          const cp = [],
            fit = [];
          for (const [c, v] of g) {
            if (c === 10) cp.push([parseFloat(v), 0]);
            else if (c === 20 && cp.length) cp[cp.length - 1][1] = parseFloat(v);
            else if (c === 11) fit.push([parseFloat(v), 0]);
            else if (c === 21 && fit.length) fit[fit.length - 1][1] = parseFloat(v);
          }
          agregar(
            o,
            puntosSpline(dxNum(g, 71, 3), dxTodos(g, 40), cp, dxTodos(g, 41), fit),
            m,
            "l",
            dxNum(g, 70) & 1,
            true
          );
          break;
        }
        case "SOLID":
        case "TRACE": {
          const q = [10, 11, 13, 12].map(c => [dxNum(g, c), dxNum(g, c + 10)]);
          agregar(o, q.flat(), ocs, "f", true);
          break;
        }
        case "LEADER": {
          const xs = dxTodos(g, 10),
            ys = dxTodos(g, 20);
          agregar(
            o,
            xs.flatMap((x, j) => [x, ys[j]]),
            m,
            "l"
          );
          break;
        }
        case "HATCH":
          hatch(e, o, ocs);
          break;
        case "TEXT":
        case "ATTRIB": {
          if (e.t === "ATTRIB" && dxNum(g, 70) & 1) break;
          const s = limpiarTexto(dxStr(g, 1));
          if (!s.trim()) break;
          const h = dxNum(g, 40, 1),
            hj = dxNum(g, 72),
            vj = dxNum(g, e.t === "ATTRIB" ? 74 : 73),
            usa2 = hj || vj,
            x = usa2 ? dxNum(g, 11, dxNum(g, 10)) : dxNum(g, 10),
            y = usa2 ? dxNum(g, 21, dxNum(g, 20)) : dxNum(g, 20);
          texto(
            o,
            ocs,
            x,
            y,
            h,
            (dxNum(g, 50) * Math.PI) / 180,
            s,
            ["left", "center", "right", "left", "center", "left"][hj] || "left",
            ["alphabetic", "bottom", "middle", "top"][vj] || "alphabetic",
            dxNum(g, 41, 1)
          );
          break;
        }
        case "MTEXT": {
          let s = "";
          for (const [c, v] of g) if (c === 3) s += v;
          s += dxStr(g, 1);
          s = limpiarMtext(s);
          if (!s.trim()) break;
          const ap = dxNum(g, 71, 1),
            dx = dxNum(g, 11, NaN),
            dy = dxNum(g, 21, NaN),
            rot = Number.isNaN(dx) ? dxNum(g, 50) : Math.atan2(dy || 0, dx);
          // El ángulo 50 del MTEXT está en radianes (a diferencia del TEXT)
          texto(
            o,
            ocs,
            dxNum(g, 10),
            dxNum(g, 20),
            dxNum(g, 40, 1),
            rot,
            s,
            ["left", "center", "right"][(ap - 1) % 3],
            ["top", "middle", "bottom"][Math.floor((ap - 1) / 3)],
            1,
            true
          );
          break;
        }
        case "INSERT":
        case "DIMENSION":
        case "ACAD_TABLE": {
          const bl = bloques[dxStr(g, 2)];
          // Atributos del bloque: vienen después del INSERT hasta SEQEND
          const attrs = [];
          if (e.t === "INSERT" && dxNum(g, 66) === 1) {
            let j = i + 1;
            for (; j < ents.length && ents[j].t !== "SEQEND"; j++) if (ents[j].t === "ATTRIB") attrs.push(ents[j]);
            i = j;
          }
          if (attrs.length) dibujar(attrs, m, null, prof + 1);
          if (!bl || bl.papel || prof > 12) break;
          if (e.t !== "INSERT") {
            // Cota o tabla: su bloque anónimo ya está en coordenadas del dibujo
            dibujar(bl.ents, m, o, prof + 1);
            break;
          }
          const sx = dxNum(g, 41, 1),
            sy = dxNum(g, 42, 1),
            r = (dxNum(g, 50) * Math.PI) / 180,
            nc = Math.max(1, dxNum(g, 70, 1)),
            nf = Math.max(1, dxNum(g, 71, 1)),
            ec = dxNum(g, 44),
            ef = dxNum(g, 45);
          const base = mMul(ocs, [Math.cos(r), -Math.sin(r), Math.sin(r), Math.cos(r), dxNum(g, 10), dxNum(g, 20)]);
          for (let f = 0; f < nf; f++)
            for (let c = 0; c < nc; c++) {
              const mi = mMul(base, [sx, 0, 0, sy, c * ec, f * ef]),
                mb = mMul(mi, [1, 0, 0, 1, -bl.x, -bl.y]);
              insertos.push({ n: bl.n, capa: o.capa, x: mi[4], y: mi[5], prof });
              pS(mi[4], mi[5], 4, o.capa);
              dibujar(bl.ents, mb, o, prof + 1);
            }
          break;
        }
        default:
          break;
      }
    }
  }
  function texto(o, m, x, y, h, rot, s, ha, va, ancho, mt) {
    const q = mPt(m, x, y),
      // Dirección del texto transformada (giro y espejo del bloque)
      d = [m[0] * Math.cos(rot) + m[1] * Math.sin(rot), m[2] * Math.cos(rot) + m[3] * Math.sin(rot)],
      e = mEsc(m);
    const espejo = m[0] * m[3] - m[1] * m[2] < 0;
    textos.push({
      capa: o.capa,
      col: o.col,
      x: q[0],
      y: q[1],
      h: h * e,
      rot: Math.atan2(d[1], d[0]) + (espejo ? Math.PI : 0),
      s,
      ha,
      va,
      w: ancho,
      mt: !!mt
    });
  }
  // Sombreado: el contorno de cada camino (polilínea o aristas: línea, arco, elipse, spline); relleno sólido o de
  // trama (la trama se muestra como un tono suave del color)
  function hatch(e, o, m) {
    const g = e.g,
      solido = dxNum(g, 70) === 1;
    let k = g.findIndex(x => x[0] === 91);
    if (k < 0) return;
    const nCam = parseInt(g[k][1], 10),
      caminos = [];
    k++;
    const sig = c => {
      while (k < g.length && g[k][0] !== c) k++;
      return k < g.length ? parseFloat(g[k++][1]) : 0;
    };
    for (let cIdx = 0; cIdx < nCam && k < g.length; cIdx++) {
      const tipo = sig(92),
        pts = [];
      if (tipo & 2) {
        const conB = sig(72),
          n = sig(93);
        const vs = [];
        for (let j = 0; j < n; j++) {
          const x = sig(10),
            y = sig(20),
            bb = conB && g[k] && g[k][0] === 42 ? parseFloat(g[k++][1]) : 0;
          vs.push([x, y, bb]);
        }
        if (vs.length) {
          pts.push(vs[0][0], vs[0][1]);
          for (let j = 0; j < vs.length; j++) {
            const a = vs[j],
              q = vs[(j + 1) % vs.length];
            pts.push(...puntosBulge(a[0], a[1], q[0], q[1], a[2]));
          }
        }
      } else {
        const n = sig(93);
        for (let j = 0; j < n; j++) {
          const t = sig(72);
          if (t === 1) {
            const x0 = sig(10),
              y0 = sig(20),
              x1 = sig(11),
              y1 = sig(21);
            if (!pts.length) pts.push(x0, y0);
            pts.push(x1, y1);
          } else if (t === 2 || t === 3) {
            const cx = sig(10),
              cy = sig(20);
            let r, ax, ay, kk;
            if (t === 2) r = sig(40);
            else {
              ax = sig(11);
              ay = sig(21);
              kk = sig(40);
            }
            let a0 = (sig(50) * Math.PI) / 180,
              a1 = (sig(51) * Math.PI) / 180;
            const ccw = sig(73);
            if (!ccw) [a0, a1] = [2 * Math.PI - a0, 2 * Math.PI - a1];
            let d = a1 - a0;
            if (ccw) while (d <= 0) d += 2 * Math.PI;
            else while (d >= 0) d -= 2 * Math.PI;
            const nn = Math.max(4, Math.ceil(Math.abs(d) / (Math.PI / 30)));
            for (let q = 0; q <= nn; q++) {
              const a = a0 + (d * q) / nn;
              if (t === 2) pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
              else {
                const c = Math.cos(a),
                  s = Math.sin(a);
                pts.push(cx + ax * c - ay * kk * s, cy + ay * c + ax * kk * s);
              }
            }
          } else if (t === 4) {
            const gr = sig(94);
            sig(73);
            sig(74);
            const nk = sig(95),
              nc = sig(96),
              kn = [],
              cp = [];
            for (let q = 0; q < nk; q++) kn.push(sig(40));
            for (let q = 0; q < nc; q++) cp.push([sig(10), sig(20)]);
            pts.push(...puntosSpline(gr, kn, cp, [], []));
          }
        }
      }
      if (pts.length >= 6) caminos.push(pts);
    }
    caminos.forEach(p => agregar(o, p, m, solido ? "f" : "h", true));
  }
  dibujar(sec.ENTITIES, M_ID, null, 0);
  // Elementos dibujados de cada capa, también los que están dentro de bloques
  trazos.forEach(t => capas[t.capa].n++);
  textos.forEach(t => capas[t.capa].n++);
  // Extensión del dibujo
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const ext = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  trazos.forEach(t => {
    for (let i = 0; i < t.p.length; i += 2) ext(t.p[i], t.p[i + 1]);
  });
  textos.forEach(t => ext(t.x, t.y));
  // Unidad del dibujo (metros por unidad): la que confirman las cotas; si no hay cotas, la de la cabecera
  const cotas = [];
  const juntarCotas = ents =>
    ents.forEach(e => {
      if (e.t === "DIMENSION") {
        const v = dxNum(e.g, 42, 0);
        if (v > 0) cotas.push(v);
      }
    });
  juntarCotas(sec.ENTITIES);
  return {
    version: c1("$ACADVER") || "",
    capas,
    trazos,
    textos,
    insertos,
    snap,
    snapC,
    nEnt,
    ext: x0 <= x1 ? [x0, y0, x1, y1] : [0, 0, 1, 1],
    unidad: unidadDxf(cotas, parseInt(c1("$INSUNITS"), 10) || 0, x1 - x0),
    tipos,
    nBloques: Object.keys(bloques).filter(n => !n.startsWith("*")).length
  };
}

/* Unidad del dibujo en metros por unidad y de dónde sale. Las cotas mandan: en arquitectura la mediana de las cotas
   está entre 0.3 m y 30 m, así que la unidad es la que la deja en ese rango (la de la cabecera si la cumple; si
   no, la más cercana a 2.5 m). La cabecera puede estar mal: hay planos dibujados en metros que dicen milímetros. */
function unidadDxf(cotas, insunits, ancho) {
  const NOM = { 1: "metros", 0.01: "centímetros", 0.001: "milímetros" };
  const cab = DXF_UNIDAD[insunits];
  if (cotas.length >= 3) {
    const s = cotas.slice().sort((a, b) => a - b),
      med = s[Math.floor(s.length / 2)],
      ok = f => med * f >= 0.3 && med * f <= 30;
    if (cab && ok(cab)) return { f: cab, de: "cotas", nom: NOM[cab] || "unidades" };
    const cand = [1, 0.01, 0.001].filter(ok);
    if (cand.length) {
      const f = cand.sort((a, b) => Math.abs(Math.log((med * a) / 2.5)) - Math.abs(Math.log((med * b) / 2.5)))[0];
      return { f, de: "cotas", nom: NOM[f] };
    }
  }
  if (cab) return { f: cab, de: "cabecera", nom: NOM[cab] || "unidades" };
  // Sin cotas ni unidad: por el tamaño del dibujo (un edificio en milímetros mide decenas de miles)
  const f = ancho > 2000 ? 0.001 : 1;
  return { f, de: "tamaño", nom: NOM[f] };
}
