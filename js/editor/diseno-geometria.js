/* DISEÑO ELÉCTRICO · GEOMETRÍA Y LEYENDA
   Símbolos como primitivas (a partir de simboloDGE()), tramos rectos y curvos, cotas y directrices, símbolos con
   criterio del proyectista, rectángulo y puntos de enganche de cada elemento, y leyenda automática.
   Antes era parte de js/diseno.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
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
  // Exacto (para apoyar el símbolo en el muro) y con un margen de una unidad (para tocarlo con el cursor)
  DS_BB[k] = x0 <= x1 ? [x0, y0, x1, y1] : [-8, -8, 8, 8];
  return DS_PRIM[k];
}
const dsBBs = k => {
  dsPrims(k);
  const b = DS_BB[k];
  return [b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1];
};
// Dibuja el símbolo k en el lienzo: X, Y en píxeles, giro en radianes (antihorario), u píxeles por unidad
// La letra o el número del tipo (no la S de los interruptores, que es el símbolo) se puede correr con dt, en
// unidades del símbolo; los textos se dibujan siempre legibles, aunque el símbolo esté girado
const dsEsLetra = (k, p) => DS_CAT[k] && DS_CAT[k].let && p.t === "t" && p.tx !== "S";
function dsDibSim(g, k, X, Y, rot, u, col, fondo, lw = plDpr(), dt) {
  const cr = dsSimb(k);
  if (cr && cr.gr) lw *= cr.gr;
  g.save();
  g.translate(X, Y);
  g.rotate(-rot);
  g.scale(u, u);
  g.lineCap = "round";
  // Relleno del cuerpo de criterio: primero, para que las líneas del símbolo queden encima
  if (cr && cr.rel && cr.rel !== "ninguno" && fondo !== null) {
    g.lineWidth = Math.max(lw, 0.9 * plDpr()) / u;
    dsRellenoCuerpo(g, k, cr.rel, col);
  }
  for (const p of dsPrims(k)) {
    const a = p.a,
      fi =
        !p.fi || p.fi === "none" || (cr && cr.rel === "ninguno" && p === dsCuerpo(k) && p.fi === INK_S)
          ? null
          : /^#fff(fff)?$/i.test(p.fi)
            ? cr && cr.rel && cr.rel !== "ninguno" && p === dsCuerpo(k)
              ? null
              : fondo
            : p.fi === INK_S
              ? col
              : p.fi,
      st = p.st && p.st !== "none" ? col : null;
    // Líneas del ancho de la capa en pantalla, sin engrosarse con el zoom (las más finas del símbolo, algo menos)
    g.lineWidth = Math.max((lw * p.w) / 1.2, 0.9 * plDpr()) / u;
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
      // Letra del tipo cambiada por el proyectista (vacía: sin letra)
      if (cr && typeof cr.let === "string" && dsEsLetra(k, p) && !cr.let) continue;
      const txt = cr && typeof cr.let === "string" && dsEsLetra(k, p) ? cr.let : p.tx,
        mov = dt && dsEsLetra(k, p) ? dt : [0, 0],
        w = a[2] * 0.6 * txt.length,
        // Centro aproximado del texto: se gira sobre él para dejarlo derecho
        cx = a[0] + mov[0] + (p.an === "middle" ? 0 : p.an === "end" ? -w / 2 : w / 2),
        cy = a[1] + mov[1] - a[2] * 0.35;
      g.save();
      g.translate(cx, cy);
      // La letra del tipo queda siempre horizontal; los demás textos del símbolo giran con él, sin quedar de cabeza
      g.rotate(dsEsLetra(k, p) ? rot : rot - dsLegible(rot));
      g.font = `${p.it ? "italic " : ""}${p.b ? "700 " : ""}${a[2]}px Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = p.fi && p.fi !== "none" && !/^#fff(fff)?$/i.test(p.fi) && p.fi !== INK_S ? p.fi : col;
      g.fillText(txt, 0, 0);
      g.restore();
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
// Ícono del símbolo para la cinta y las propiedades (SVG en el color del texto)
function dsIcono(k) {
  const o = [];
  simboloDGE(o, k, 0, 0, 1);
  const b = dsBBs(k),
    m = Math.max(b[2] - b[0], b[3] - b[1]) / 2 + 1,
    cx = (b[0] + b[2]) / 2,
    cy = (b[1] + b[3]) / 2;
  return `<svg viewBox="${cx - m} ${cy - m} ${2 * m} ${2 * m}" class="ds-ico" aria-hidden="true">${o
    .join("")
    .split(INK_S)
    .join("currentColor")
    .replace(/fill="#fff(fff)?"/gi, 'fill="var(--ws-pane, #fff)"')}</svg>`;
}

/* ---------- Tramos rectos y curvos ---------- */
// Curvatura de un tramo A→B que pasa por el punto q (la flecha del arco, con su signo)
function dsCurvDe(a, b, q) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    c = Math.hypot(dx, dy);
  if (!c) return 0;
  const izq = (dx * (q[1] - a[1]) - dy * (q[0] - a[0])) / c,
    k = Math.max(-1, Math.min(1, (-2 * izq) / c));
  // Casi recto: queda recto
  return Math.abs(k) < 0.03 ? 0 : k;
}
// Tramos de una línea o tubería: extremos, curvatura, cuerda, longitud real (la del arco), punto medio y ángulo
function dsTramos(el) {
  const p = el.pts,
    n = p.length / 2,
    b = el.b || [],
    out = [];
  for (let i = 0; i < (el.c ? n : n - 1); i++) {
    const j = (i + 1) % n,
      ax = p[2 * i],
      ay = p[2 * i + 1],
      bx = p[2 * j],
      by = p[2 * j + 1],
      k = b[i] || 0,
      c = Math.hypot(bx - ax, by - ay);
    let L = c,
      mx = (ax + bx) / 2,
      my = (ay + by) / 2;
    if (k && c) {
      const th = 4 * Math.atan(Math.abs(k)),
        f = (k * c) / 2;
      L = (c / (2 * Math.sin(th / 2))) * th;
      mx += ((by - ay) / c) * f;
      my -= ((bx - ax) / c) * f;
    }
    out.push({ i, a: [ax, ay], b: [bx, by], k, c, L, m: [mx, my], ang: Math.atan2(by - ay, bx - ax) });
  }
  return out;
}
// Puntos de la línea con sus curvas, en tramos rectos cortos (para dibujar, tocar y medir)
function dsCurva(el) {
  const p = el.pts;
  if (!el.b || !el.b.some(Boolean)) return el.c ? [...p, p[0], p[1]] : p;
  const out = [p[0], p[1]];
  dsTramos(el).forEach(t => out.push(...puntosBulge(t.a[0], t.a[1], t.b[0], t.b[1], t.k)));
  return out;
}
const dsLargo = el => dsTramos(el).reduce((s, t) => s + t.L, 0);

/* ---------- Cotas y directrices ---------- */
// Geometría de la cota: dirección de medida (alineada, horizontal o vertical), puntos de la línea de cota y medida
function dsCotaGeo(el) {
  const [ax, ay] = el.a,
    [bx, by] = el.b;
  let ux = 1,
    uy = 0;
  if (el.modo === "v") [ux, uy] = [0, 1];
  else if (el.modo !== "h") {
    const c = Math.hypot(bx - ax, by - ay) || 1;
    [ux, uy] = [(bx - ax) / c, (by - ay) / c];
  }
  const nx = -uy,
    ny = ux,
    db = (bx - ax) * nx + (by - ay) * ny;
  return {
    pa: [ax + nx * el.o, ay + ny * el.o],
    pb: [bx + nx * (el.o - db), by + ny * (el.o - db)],
    med: Math.abs((bx - ax) * ux + (by - ay) * uy),
    ux,
    uy,
    nx,
    ny
  };
}
// Dirección de una cota lineal según dónde está el cursor: arriba o abajo de los puntos, horizontal; a un lado,
// vertical (como en AutoCAD)
function dsModoLineal(a, b, q) {
  const fx = Math.abs(q[0] - (a[0] + b[0]) / 2) - Math.abs(b[0] - a[0]) / 2,
    fy = Math.abs(q[1] - (a[1] + b[1]) / 2) - Math.abs(b[1] - a[1]) / 2;
  return fy >= fx ? "h" : "v";
}
// Desplazamiento de la línea de cota hasta el punto q
function dsCotaO(el, q) {
  const g = dsCotaGeo({ ...el, o: 0 });
  return (q[0] - el.a[0]) * g.nx + (q[1] - el.a[1]) * g.ny;
}
// Ángulo legible (el texto nunca queda de cabeza)
const dsLegible = a => {
  let r = a;
  while (r > Math.PI / 2 + 1e-6) r -= Math.PI;
  while (r <= -Math.PI / 2 + 1e-6) r += Math.PI;
  return r;
};
// Dibuja una cota en el lienzo (líneas de referencia, línea de cota con trazos oblicuos y la medida)
function dsDibCota(g, el, col, s, lw = plDpr()) {
  const G = dsCotaGeo(el),
    sep = dsMm(1),
    sob = dsMm(1.5),
    tic = dsMm(1.4),
    lin = (a, b) => {
      const [X1, Y1] = plAPant(a[0], a[1]),
        [X2, Y2] = plAPant(b[0], b[1]);
      g.moveTo(X1, Y1);
      g.lineTo(X2, Y2);
    };
  g.strokeStyle = col;
  g.lineWidth = lw;
  g.beginPath();
  [
    [el.a, G.pa],
    [el.b, G.pb]
  ].forEach(([p, q]) => {
    const vx = q[0] - p[0],
      vy = q[1] - p[1],
      d = Math.hypot(vx, vy);
    if (d < sep) return;
    lin([p[0] + (vx / d) * sep, p[1] + (vy / d) * sep], [q[0] + (vx / d) * sob, q[1] + (vy / d) * sob]);
  });
  lin(G.pa, G.pb);
  // Trazos oblicuos a 45° en los extremos (cota de arquitectura)
  const ox = ((G.ux + G.nx) * tic) / Math.SQRT2,
    oy = ((G.uy + G.ny) * tic) / Math.SQRT2;
  [G.pa, G.pb].forEach(p => lin([p[0] - ox, p[1] - oy], [p[0] + ox, p[1] + oy]));
  g.stroke();
  const hp = dsMm(2.5) * s;
  if (hp < 4) return;
  const m = [(G.pa[0] + G.pb[0]) / 2 + G.nx * dsMm(1), (G.pa[1] + G.pb[1]) / 2 + G.ny * dsMm(1)],
    [X, Y] = plAPant(m[0], m[1]),
    ang = dsLegible(Math.atan2(G.uy, G.ux));
  g.save();
  g.translate(X, Y);
  g.rotate(-ang);
  g.font = `${hp / 0.72}px Arial, sans-serif`;
  g.fillStyle = col;
  g.textAlign = "center";
  // Encima de la línea de cota, del lado del desplazamiento
  g.textBaseline = Math.cos(Math.atan2(G.uy, G.ux) - ang) > 0 ? "bottom" : "top";
  g.fillText(fmt(G.med * EPL.f, 2), 0, 0);
  g.restore();
}
// Directriz: flecha en la punta, quiebre y texto a continuación del rellano
function dsDirGeo(el) {
  const [tx, ty, ex, ey] = el.pts,
    lado = ex >= tx ? 1 : -1;
  return { tip: [tx, ty], codo: [ex, ey], fin: [ex + lado * dsMm(3), ey], lado };
}
function dsDibDir(g, el, col, s, lw = plDpr()) {
  const G = dsDirGeo(el),
    [X0, Y0] = plAPant(G.tip[0], G.tip[1]),
    [X1, Y1] = plAPant(G.codo[0], G.codo[1]),
    [X2, Y2] = plAPant(G.fin[0], G.fin[1]);
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = lw;
  g.beginPath();
  g.moveTo(X0, Y0);
  g.lineTo(X1, Y1);
  g.lineTo(X2, Y2);
  g.stroke();
  // Punta de flecha
  const a = Math.atan2(Y1 - Y0, X1 - X0),
    lf = dsMm(2.5) * s,
    af = dsMm(0.8) * s;
  g.beginPath();
  g.moveTo(X0, Y0);
  g.lineTo(X0 + lf * Math.cos(a) - af * Math.sin(a), Y0 + lf * Math.sin(a) + af * Math.cos(a));
  g.lineTo(X0 + lf * Math.cos(a) + af * Math.sin(a), Y0 + lf * Math.sin(a) - af * Math.cos(a));
  g.closePath();
  g.fill();
  const hp = el.ht * s;
  if (hp < 3) return;
  g.font = `${hp / 0.72}px Arial, sans-serif`;
  g.textAlign = G.lado > 0 ? "left" : "right";
  g.textBaseline = "middle";
  g.fillText(el.s, X2 + G.lado * dsMm(0.8) * s, Y2);
}

/* ---------- Símbolos con criterio del proyectista (editor de símbolos) ---------- */
const dsSimb = k => (dsD() && dsD().simb && dsD().simb[k]) || null;
const dsTam = k => (dsSimb(k) && dsSimb(k).tam) || 1;
// Unidades del dibujo por unidad de un símbolo de tipo k (con su tamaño de criterio)
const dsUk = k => dsU() * dsTam(k);
// Cuerpo del símbolo (la figura de mayor área: círculo, rectángulo, elipse o polígono), para su relleno
const DS_CUERPO = {};
function dsCuerpo(k) {
  if (k in DS_CUERPO) return DS_CUERPO[k];
  let mejor = null,
    am = 0;
  dsPrims(k).forEach(p => {
    const a = p.a;
    let ar = 0;
    if (p.t === "c") ar = Math.PI * a[2] * a[2];
    else if (p.t === "e") ar = Math.PI * a[2] * a[3];
    else if (p.t === "r") ar = Math.abs(a[2] * a[3]);
    else if (p.t === "p") {
      for (let i = 0; i + 1 < a.length; i += 2) {
        const j = (i + 2) % a.length;
        ar += a[i] * a[j + 1] - a[j] * a[i + 1];
      }
      ar = Math.abs(ar / 2);
    }
    if (ar > am) {
      am = ar;
      mejor = p;
    }
  });
  return (DS_CUERPO[k] = mejor);
}
// Camino del cuerpo en el lienzo (en unidades del símbolo, con la transformación ya puesta)
function dsCaminoCuerpo(g, p) {
  const a = p.a;
  g.beginPath();
  if (p.t === "c") g.arc(a[0], a[1], a[2], 0, 2 * Math.PI);
  else if (p.t === "e") g.ellipse(a[0], a[1], a[2], a[3], 0, 0, 2 * Math.PI);
  else if (p.t === "r") g.rect(a[0], a[1], a[2], a[3]);
  else {
    g.moveTo(a[0], a[1]);
    for (let i = 2; i + 1 < a.length; i += 2) g.lineTo(a[i], a[i + 1]);
    g.closePath();
  }
}
// Contorno del cuerpo como polígono (los círculos y elipses, con 48 lados), en unidades del símbolo
function dsPoliCuerpo(p) {
  const a = p.a,
    out = [];
  if (p.t === "c" || p.t === "e")
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * 2 * Math.PI;
      out.push([a[0] + a[2] * Math.cos(t), a[1] + (p.t === "c" ? a[2] : a[3]) * Math.sin(t)]);
    }
  else if (p.t === "r") out.push([a[0], a[1]], [a[0] + a[2], a[1]], [a[0] + a[2], a[1] + a[3]], [a[0], a[1] + a[3]]);
  else for (let i = 0; i + 1 < a.length; i += 2) out.push([a[i], a[i + 1]]);
  return out;
}
// Relleno de criterio del cuerpo: sólido, achurado a 45° o mitad llena. Se recorta con cálculo (sin el recorte del
// lienzo), así sale igual en la pantalla, en la lámina y en el DXF
function dsRellenoCuerpo(g, k, rel, col) {
  const p = dsCuerpo(k);
  if (!p) return;
  let P = dsPoliCuerpo(p);
  const xs = P.map(q => q[0]),
    ys = P.map(q => q[1]),
    bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const poli = Q => {
    g.beginPath();
    Q.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
    g.closePath();
  };
  g.save();
  g.fillStyle = col;
  g.strokeStyle = col;
  if (rel === "solido") {
    if (p.t === "c" || p.t === "e") dsCaminoCuerpo(g, p);
    else poli(P);
    g.fill();
  } else if (rel === "mitad") {
    // La mitad del lado contrario a la llegada (derecha del símbolo): el polígono recortado en x ≥ centro
    const cx = (bb[0] + bb[2]) / 2,
      Q = [];
    P.forEach((a, i) => {
      const b = P[(i + 1) % P.length],
        da = a[0] >= cx,
        db = b[0] >= cx;
      if (da) Q.push(a);
      if (da !== db) Q.push([cx, a[1] + ((b[1] - a[1]) * (cx - a[0])) / (b[0] - a[0])]);
    });
    if (Q.length > 2) {
      poli(Q);
      g.fill();
    }
  } else if (rel === "achurado") {
    // Rectas a 45° (x − y = c) cortadas por el contorno
    const paso = Math.max(1.2, (bb[2] - bb[0]) / 7);
    g.beginPath();
    for (let c = bb[0] - bb[3]; c <= bb[2] - bb[1]; c += paso) {
      const xs2 = [];
      P.forEach((a, i) => {
        const b = P[(i + 1) % P.length],
          fa = a[0] - a[1] - c,
          fb = b[0] - b[1] - c;
        if ((fa <= 0 && fb > 0) || (fa > 0 && fb <= 0)) {
          const t = fa / (fa - fb);
          xs2.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      });
      xs2.sort((u, v) => u[0] - v[0]);
      for (let i = 0; i + 1 < xs2.length; i += 2) {
        g.moveTo(xs2[i][0], xs2[i][1]);
        g.lineTo(xs2[i + 1][0], xs2[i + 1][1]);
      }
    }
    g.stroke();
  }
  P = null;
  g.restore();
}

/* ---------- Geometría: rectángulo, toque y puntos de enganche de cada elemento ---------- */
// De unidades del símbolo (y hacia abajo) al dibujo, con el giro del elemento
function dsAMundo(el, a, b) {
  const u = el.k ? dsUk(el.k) : dsU(),
    r = ((el.r || 0) * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return [el.x + u * (a * c + b * s), el.y + u * (a * s - b * c)];
}
const dsCaja = pts => {
  const xs = pts.filter((v, i) => i % 2 === 0),
    ys = pts.filter((v, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
/* ---------- Leyenda automática ----------
   Tabla con lo que usa el diseño: cada símbolo (con su dibujo, nombre y código de la Norma DGE), las tuberías en
   techo y en piso y los conductores con marca. Se arma sola con los elementos del diseño; medidas en el papel (mm). */
const DS_LEY = { w: [16, 84, 20], tit: 7, cab: 5, fila: 9, txt: 2.2 };
// Se guarda hasta el próximo cambio del diseño
const dsFilasLey = () => dpCache("ley", dsFilasLey0);
function dsFilasLey0() {
  const D = dsD(),
    usados = new Set(),
    tubs = { techo: false, piso: false },
    cond = { f: false, n: false, r: false, t: false };
  D.els.forEach(el => {
    if (el.t === "sim" && DS_CAT[el.k]) usados.add(dsKVis(el));
    if (el.t === "tub") {
      tubs[el.modo === "piso" ? "piso" : "techo"] = true;
      if (dsTubInt(el)) tubs.int = true;
      if (el.cond) {
        if (el.cond.f) cond.f = true;
        if (el.cond.n) cond.n = true;
        if (el.cond.r) cond.r = true;
        if (el.cond.t) cond.t = true;
      }
    }
  });
  const out = Object.keys(DS_CAT)
    .filter(k => usados.has(k))
    .map(k => ({ k, n: DS_CAT[k].n, c: DS_CAT[k].c + (dsSimb(k) ? " *" : "") }));
  if (tubs.techo) out.push({ tub: "techo", n: "Tubería empotrada en techo o pared", c: "" });
  if (tubs.piso) out.push({ tub: "piso", n: "Tubería empotrada en piso", c: "" });
  if (tubs.int) out.push({ tub: "int", n: "Tubería a interruptor (fase y retornos) *", c: "" });
  if (cond.f) out.push({ cond: { f: 1 }, n: "Conductor de fase", c: "" });
  if (cond.r) out.push({ cond: { r: 1 }, n: "Conductor de retorno (r) *", c: "" });
  if (cond.n) out.push({ cond: { n: true }, n: "Conductor neutro", c: "09-93-01" });
  if (cond.t) out.push({ cond: { t: true }, n: "Conductor de protección (tierra)", c: "09-93-02" });
  const critTub = tubs.int || cond.r;
  if (critTub || out.some(f => f.k && dsSimb(f.k)))
    out.push({
      nota: true,
      n: critTub ? "(*) Criterio del proyectista" : "(*) Símbolo con criterio del proyectista",
      c: ""
    });
  if (D.els.some(e => dsVis(e) && dsTabTri(e)))
    out.push({ nota: true, n: "3φ junto a un tablero: tablero trifásico", c: "" });
  // Tipos de luminaria usados en el plano
  const lt = new Set(D.els.filter(e => e.lt).map(e => e.lt));
  (D.lums || []).filter(t => lt.has(t.id)).forEach(t => out.push({ nota: true, n: "Luminaria " + dsLumTxt(t), c: "" }));
  return out;
}
// Tamaño de la leyenda en el dibujo
function dsTamLey() {
  const m = dsMm(1),
    L = DS_LEY,
    n = Math.max(1, dsFilasLey().length);
  return [(L.w[0] + L.w[1] + L.w[2]) * m, (L.tit + L.cab + n * L.fila) * m];
}
function dsDibLeyenda(g, el, col, s, lw) {
  const m = dsMm(1),
    L = DS_LEY,
    filas = dsFilasLey(),
    [W, H] = dsTamLey(),
    P = (a, b) => plAPant(el.x + a * m, el.y - b * m),
    hp = L.txt * m * s,
    x1 = L.w[0],
    x2 = L.w[0] + L.w[1],
    xw = W / m;
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = lw;
  g.setLineDash([]);
  const linea = (a, b, c, d) => {
    const [X0, Y0] = P(a, b),
      [X1, Y1] = P(c, d);
    g.beginPath();
    g.moveTo(X0, Y0);
    g.lineTo(X1, Y1);
    g.stroke();
  };
  // Texto que se achica si no cabe en su columna (ancho en mm)
  const texto = (t, a, b, al, peso = "", ancho = 0) => {
    if (hp < 3) return;
    const [X, Y] = P(a, b);
    g.font = `${peso}${hp / 0.72}px Arial, sans-serif`;
    const w = g.measureText(t).width,
      max = ancho * m * s;
    if (ancho && w > max) g.font = `${peso}${((hp / 0.72) * max) / w}px Arial, sans-serif`;
    g.textAlign = al;
    g.textBaseline = "middle";
    g.fillStyle = col;
    g.fillText(t, X, Y);
  };
  const [X0, Y0] = P(0, 0);
  g.strokeRect(X0, Y0, W * s, H * s);
  linea(0, L.tit, xw, L.tit);
  linea(0, L.tit + L.cab, xw, L.tit + L.cab);
  linea(x1, L.tit, x1, H / m);
  linea(x2, L.tit, x2, H / m);
  texto(el.tit || "LEYENDA", xw / 2, L.tit / 2, "center", "700 ");
  texto("SÍMBOLO", x1 / 2, L.tit + L.cab / 2, "center", "600 ");
  texto("DESCRIPCIÓN", x1 + 2, L.tit + L.cab / 2, "left", "600 ");
  texto("CÓDIGO DGE", (x2 + xw) / 2, L.tit + L.cab / 2, "center", "600 ", L.w[2] - 2);
  filas.forEach((f, i) => {
    const y = L.tit + L.cab + i * L.fila,
      yc = y + L.fila / 2;
    if (i) linea(0, y, xw, y);
    texto(f.n, x1 + 2, yc, "left", "", L.w[1] - 4);
    if (f.c) texto(f.c, (x2 + xw) / 2, yc, "center", "", L.w[2] - 2);
    const [Xc, Yc] = P(x1 / 2, yc);
    if (f.nota) return;
    if (f.k) {
      const c = plColorDis(dsColorEl({ t: "sim", k: f.k }, dsCapa(DS_SIS[DS_CAT[f.k].s].capa)));
      dsDibSim(g, f.k, Xc, Yc, 0, Math.min(dsUk(f.k) * s, ((L.fila - 2) * m * s) / 20), c, PL_FONDO, lw);
    } else {
      // Muestra de tubería (continua o a trazos) o de conductor con su marca
      const a = el.x + 2 * m,
        b = el.x + (x1 - 2) * m,
        yy = el.y - yc * m,
        mt = { pts: [a, yy, b, yy], cond: f.cond };
      g.save();
      g.strokeStyle = f.tub === "int" ? plColorDis(DS_COL_INT) : col;
      if (f.tub === "piso") g.setLineDash([dsMm(3) * s, dsMm(1.5) * s]);
      g.beginPath();
      plRuta(g, mt.pts, false);
      g.stroke();
      g.restore();
      if (f.cond) dsMarcas(g, mt, col, s, lw, 0.5);
    }
  });
  g.restore();
}
const dsEsTabla = el => el.t === "ley" || el.t === "cua";
function dsBBox(el) {
  if (dsEsTabla(el)) {
    const [W, H] = el.t === "cua" ? dsTamCua() : dsTamLey();
    return [el.x, el.y - H, el.x + W, el.y];
  }
  if (el.t === "sim") {
    const b = dsBBs(el.k);
    return dsCaja(
      [
        [b[0], b[1]],
        [b[2], b[1]],
        [b[2], b[3]],
        [b[0], b[3]]
      ].flatMap(([a, c]) => dsAMundo(el, a, c))
    );
  }
  if (el.t === "cir") return [el.x - el.rad, el.y - el.rad, el.x + el.rad, el.y + el.rad];
  if (el.t === "txt") {
    const w = el.ht * 0.62 * el.s.length;
    return [el.x, el.y - el.ht * 0.2, el.x + w, el.y + el.ht];
  }
  if (el.t === "cot") {
    const G = dsCotaGeo(el);
    return dsCaja([...el.a, ...el.b, ...G.pa, ...G.pb]);
  }
  if (el.t === "dir") {
    const G = dsDirGeo(el),
      w = el.ht * 0.62 * el.s.length;
    return dsCaja([...G.tip, ...G.codo, G.fin[0] + G.lado * w, G.fin[1] - el.ht / 2, G.fin[0], G.fin[1] + el.ht / 2]);
  }
  return dsCaja(dsCurva(el));
}
function dsDistSeg(p, x, y) {
  let md = Infinity;
  for (let j = 0; j + 3 < p.length; j += 2) {
    const ax = p[j],
      ay = p[j + 1],
      dx = p[j + 2] - ax,
      dy = p[j + 3] - ay,
      l2 = dx * dx + dy * dy,
      t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    md = Math.min(md, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return md;
}
// Líneas que forman un elemento (para tocarlo, engancharse y encajar símbolos en él)
function dsLineas(el) {
  if (el.t === "lin" || el.t === "tub") return [dsCurva(el)];
  if (dsEsTabla(el)) {
    const b = dsBBox(el);
    return [[b[0], b[1], b[2], b[1], b[2], b[3], b[0], b[3], b[0], b[1]]];
  }
  if (el.t === "cot") {
    const G = dsCotaGeo(el);
    return [[...G.pa, ...G.pb]];
  }
  if (el.t === "dir") {
    const G = dsDirGeo(el);
    return [[...G.tip, ...G.codo, ...G.fin]];
  }
  if (el.t === "cir") {
    const p = [];
    for (let i = 0; i <= 48; i++)
      p.push(el.x + el.rad * Math.cos((i * Math.PI) / 24), el.y + el.rad * Math.sin((i * Math.PI) / 24));
    return [p];
  }
  return [];
}
// Elemento editable bajo el punto, o null: primero los símbolos y textos (aunque una tubería pase por encima) y
// después las líneas; entre iguales, el último dibujado
