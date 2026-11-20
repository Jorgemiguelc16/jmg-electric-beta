/* DISEÑO ELÉCTRICO · ÍNDICE ESPACIAL Y CONEXIONES
   Índice espacial (cuadrícula) para que el cursor responda en proyectos grandes; conexiones de las tuberías con
   los artefactos, circuitos que pasan a lo conectado y conductores automáticos contados por el recorrido.
   Antes era parte de js/diseno.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Índice espacial del diseño ----------
   Para que el cursor responda al instante en proyectos grandes: el rectángulo de cada elemento se anota en las
   celdas de una cuadrícula que tapa; al mover el cursor (tocar, enganchar, conectar) y al dibujar, solo se revisan
   los elementos de las celdas cercanas o visibles. El índice se rehace cuando el diseño cambia (DS_IDXV). */
let DS_IDX = null,
  DS_IDXV = 0;
const dsIdxSucio = () => DS_IDXV++;
function dsIdx() {
  const D = dsD();
  if (DS_IDX && DS_IDX.D === D && DS_IDX.v === DS_IDXV && DS_IDX.n === D.els.length) return DS_IDX;
  const bb = new Map(),
    pos = new Map();
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  D.els.forEach((el, i) => {
    let b;
    try {
      b = dsBBox(el);
    } catch (e) {
      b = null;
    }
    if (!b || !b.every(Number.isFinite)) return;
    bb.set(el, b);
    pos.set(el, i);
    x0 = Math.min(x0, b[0]);
    y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]);
    y1 = Math.max(y1, b[3]);
  });
  // Sin elementos: un índice vacío (con números finitos)
  if (!bb.size) x0 = y0 = x1 = y1 = 0;
  // Celdas de alrededor de 1/150 del diseño (al menos 0.25 m)
  const tam = Math.max((x1 - x0) / 150, (y1 - y0) / 150, 0.25 / (EPL ? EPL.f : 1)) || 1,
    cel = new Map(),
    grandes = [];
  bb.forEach((b, el) => {
    const i0 = Math.floor((b[0] - x0) / tam),
      i1 = Math.floor((b[2] - x0) / tam),
      j0 = Math.floor((b[1] - y0) / tam),
      j1 = Math.floor((b[3] - y0) / tam);
    // Los elementos que tapan muchas celdas (una leyenda, una tubería muy larga) van aparte y se revisan siempre
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) return grandes.push(el);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = i + "," + j;
        (cel.get(k) || cel.set(k, []).get(k)).push(el);
      }
  });
  return (DS_IDX = { D, v: DS_IDXV, n: D.els.length, bb, pos, cel, grandes, tam, x0, y0 });
}
// Elementos cuyo rectángulo toca el rectángulo [xa, ya, xb, yb] (sin repetir)
function dsEnZona(xa, ya, xb, yb) {
  if (!dsD() || ![xa, ya, xb, yb].every(Number.isFinite)) return [];
  const I = dsIdx();
  if (!I.bb.size) return [];
  const out = new Set(),
    i0 = Math.floor((xa - I.x0) / I.tam),
    i1 = Math.floor((xb - I.x0) / I.tam),
    j0 = Math.floor((ya - I.y0) / I.tam),
    j1 = Math.floor((yb - I.y0) / I.tam),
    toca = el => {
      const b = I.bb.get(el);
      return b && b[0] <= xb && b[2] >= xa && b[1] <= yb && b[3] >= ya;
    };
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 40000) return I.D.els.filter(toca);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) for (const el of I.cel.get(i + "," + j) || []) if (toca(el)) out.add(el);
  I.grandes.forEach(el => toca(el) && out.add(el));
  return [...out];
}
const dsCercanos = (x, y, r) => dsEnZona(x - r, y - r, x + r, y + r);
function dsHit(x, y, r) {
  const D = dsD();
  if (!D) return null;
  // Solo los cercanos, en el orden del dibujo; se recorre desde el final: los símbolos y textos van al final para
  // revisarse primero
  const I = dsIdx(),
    cand = dsCercanos(x, y, r).sort((a, b) => I.pos.get(a) - I.pos.get(b)),
    orden = [
      ...cand.filter(el => el.t !== "sim" && el.t !== "txt"),
      ...cand.filter(el => el.t === "sim" || el.t === "txt")
    ];
  for (let i = orden.length - 1; i >= 0; i--) {
    const el = orden[i];
    if (!dsEditable(el)) continue;
    if (el.t === "sim") {
      const u = dsUk(el.k),
        rr = ((el.r || 0) * Math.PI) / 180,
        wx = (x - el.x) / u,
        wy = (y - el.y) / u,
        a = wx * Math.cos(rr) + wy * Math.sin(rr),
        b = wx * Math.sin(rr) - wy * Math.cos(rr),
        bb = dsBBs(el.k),
        t = r / u;
      if (a >= bb[0] - t && a <= bb[2] + t && b >= bb[1] - t && b <= bb[3] + t) return el.id;
    } else if (el.t === "txt" || dsEsTabla(el)) {
      const b = dsBBox(el);
      if (x >= b[0] - r && x <= b[2] + r && y >= b[1] - r && y <= b[3] + r) return el.id;
    } else {
      if (dsLineas(el).some(p => dsDistSeg(p, x, y) <= r)) return el.id;
      // El texto de la cota o de la directriz también la toca
      if (el.t === "cot" || el.t === "dir") {
        const b = dsBBox(el);
        if (el.t === "dir" && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return el.id;
      }
    }
  }
  return null;
}
// Puntos de enganche del diseño (o de los elementos dados): inserciones (4), extremos y vértices (1), puntos
// medios (2) y centros (3)
function dsPuntosEnganche(lista) {
  const D = dsD(),
    out = [];
  if (!D) return out;
  for (const el of lista || D.els) {
    if (!dsVis(el)) continue;
    if (dsEsTabla(el)) out.push([el.x, el.y, 4]);
    else if (el.t === "sim" || el.t === "txt") {
      out.push([el.x, el.y, 4]);
      // Salidas de circuito del tablero (tipo 8), con su circuito
      if (el.k === "tab")
        dsSalidasTab(el).forEach(o => out.push([o.p[0], o.p[1], 8, { cir: o.n, tab: el.id, nom: el.nom || "" }]));
    } else if (el.t === "cir") out.push([el.x, el.y, 3]);
    else if (el.t === "cot") out.push([...el.a, 1], [...el.b, 1]);
    else if (el.t === "dir") out.push([el.pts[0], el.pts[1], 1], [el.pts[2], el.pts[3], 1]);
    else {
      for (let i = 0; i < el.pts.length; i += 2) out.push([el.pts[i], el.pts[i + 1], 1]);
      dsTramos(el).forEach(t => out.push([...t.m, 2]));
    }
  }
  return out;
}

/* ---------- Conexiones: tuberías que llegan a los artefactos ----------
   Cada artefacto (luminaria, tomacorriente, interruptor, caja…) recibe tuberías: la punta de la tubería se atrae a
   él cuando queda cerca (imán) y termina en su borde, hacia el tramo que llega. La tubería guarda el artefacto de
   su inicio (c0) y de su final (c1): si el artefacto se mueve o gira, la tubería lo sigue; el circuito de la
   tubería pasa al artefacto. El tablero se conecta por sus salidas C-1, C-2… */
const DS_CON = {};
// Forma de llegada de cada símbolo, en sus unidades: su círculo principal o, si no tiene, su rectángulo
function dsFormaCon(k) {
  if (DS_CON[k]) return DS_CON[k];
  const b = dsBBs(k),
    w = b[2] - b[0],
    h = b[3] - b[1];
  let c = null;
  dsPrims(k).forEach(p => {
    if (p.t === "c" && (!c || p.a[2] > c.a[2])) c = p;
  });
  return (DS_CON[k] =
    c && c.a[2] >= 0.2 * Math.min(w, h)
      ? { c: [c.a[0], c.a[1]], r: c.a[2] }
      : { c: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], w: w / 2, h: h / 2 });
}
// Del dibujo a las unidades del símbolo (lo inverso de dsAMundo)
function dsALocal(el, x, y) {
  const u = dsUk(el.k),
    r = ((el.r || 0) * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    wx = (x - el.x) / u,
    wy = (y - el.y) / u;
  return [wx * c + wy * s, wx * s - wy * c];
}
const dsCentroCon = el => {
  const f = dsFormaCon(el.k);
  return dsAMundo(el, f.c[0], f.c[1]);
};
/* Hasta dónde llega el dibujo del símbolo k desde el punto c en la dirección (dx, dy), en sus unidades: el punto más
   lejano donde esa recta toca una de sus líneas, círculos, elipses, rectángulos o triángulos (o la «S» del
   interruptor; no las letras del tipo, que se pueden mover). Así la tubería llega justo al dibujo, sin dejar un
   espacio. null si la recta no toca nada. */
function dsAlcanceSim(k, c, dx, dy) {
  let t = -1;
  const [ox, oy] = c,
    seg = (ax, ay, bx, by) => {
      const ex = bx - ax,
        ey = by - ay,
        den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) return;
      const s = ((ax - ox) * ey - (ay - oy) * ex) / den,
        u = ((ax - ox) * dy - (ay - oy) * dx) / den;
      if (s >= 0 && u >= -1e-9 && u <= 1 + 1e-9 && s > t) t = s;
    },
    // Elipse (o círculo) de centro (ex, ey) y semiejes rx, ry
    eli = (ex, ey, rx, ry) => {
      const px = (ox - ex) / rx,
        py = (oy - ey) / ry,
        vx = dx / rx,
        vy = dy / ry,
        A = vx * vx + vy * vy,
        B = 2 * (px * vx + py * vy),
        C = px * px + py * py - 1,
        D = B * B - 4 * A * C;
      if (D < 0 || !A) return;
      const s = (-B + Math.sqrt(D)) / (2 * A);
      if (s >= 0 && s > t) t = s;
    };
  dsPrims(k).forEach(p => {
    const a = p.a;
    if (p.t === "l") seg(a[0], a[1], a[2], a[3]);
    else if (p.t === "c") eli(a[0], a[1], a[2], a[2]);
    else if (p.t === "e") eli(a[0], a[1], a[2], a[3]);
    else if (p.t === "r" || p.t === "t") {
      if (p.t === "t" && dsEsLetra(k, p)) return;
      let [x0, y0, w, h] = a;
      if (p.t === "t") {
        w = a[2] * 0.6 * p.tx.length;
        h = a[2] * 0.8;
        x0 = p.an === "middle" ? a[0] - w / 2 : a[0];
        y0 = a[1] - h;
      }
      seg(x0, y0, x0 + w, y0);
      seg(x0 + w, y0, x0 + w, y0 + h);
      seg(x0 + w, y0 + h, x0, y0 + h);
      seg(x0, y0 + h, x0, y0);
    } else if (p.t === "p")
      for (let i = 0; i + 1 < a.length; i += 2) {
        const j = i + 2 < a.length - 1 ? i + 2 : 0;
        seg(a[i], a[i + 1], a[j], a[j + 1]);
      }
  });
  return t >= 0 ? t : null;
}
// Punto del borde del artefacto en la dirección de (x, y): allí termina la tubería, tocando el dibujo del símbolo
function dsBorde(el, x, y) {
  const f = dsFormaCon(el.k),
    [a, b] = dsALocal(el, x, y);
  let dx = a - f.c[0],
    dy = b - f.c[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return dsCentroCon(el);
  dx /= d;
  dy /= d;
  const t = dsAlcanceSim(el.k, f.c, dx, dy);
  if (t !== null) return dsAMundo(el, f.c[0] + dx * t, f.c[1] + dy * t);
  // Sin dibujo en esa dirección (un símbolo que no rodea su centro): el punto del dibujo más cercano a la tubería
  const q = dsCercaSim(el.k, a, b);
  return q ? dsAMundo(el, q[0], q[1]) : dsCentroCon(el);
}
// Punto del dibujo del símbolo k más cercano a (x, y), en sus unidades (sin las letras del tipo)
function dsCercaSim(k, x, y) {
  let m = Infinity,
    r = null;
  const prueba = (px, py) => {
      const d = Math.hypot(px - x, py - y);
      if (d < m) {
        m = d;
        r = [px, py];
      }
    },
    seg = (ax, ay, bx, by) => {
      const ex = bx - ax,
        ey = by - ay,
        L = ex * ex + ey * ey || 1,
        s = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / L));
      prueba(ax + s * ex, ay + s * ey);
    },
    caja = (x0, y0, w, h) => {
      seg(x0, y0, x0 + w, y0);
      seg(x0 + w, y0, x0 + w, y0 + h);
      seg(x0 + w, y0 + h, x0, y0 + h);
      seg(x0, y0 + h, x0, y0);
    };
  dsPrims(k).forEach(p => {
    const a = p.a;
    if (p.t === "l") seg(a[0], a[1], a[2], a[3]);
    else if (p.t === "c") {
      const d = Math.hypot(x - a[0], y - a[1]) || 1;
      prueba(a[0] + ((x - a[0]) / d) * a[2], a[1] + ((y - a[1]) / d) * a[2]);
    } else if (p.t === "e")
      for (let i = 0; i < 72; i++) {
        const q = (i * Math.PI) / 36;
        prueba(a[0] + a[2] * Math.cos(q), a[1] + a[3] * Math.sin(q));
      }
    else if (p.t === "r") caja(a[0], a[1], a[2], a[3]);
    else if (p.t === "t" && !dsEsLetra(k, p)) {
      const w = a[2] * 0.6 * p.tx.length,
        h = a[2] * 0.8;
      caja(p.an === "middle" ? a[0] - w / 2 : a[0], a[1] - h, w, h);
    } else if (p.t === "p")
      for (let i = 0; i + 1 < a.length; i += 2) {
        const j = i + 2 < a.length - 1 ? i + 2 : 0;
        seg(a[i], a[i + 1], a[j], a[j + 1]);
      }
  });
  return r;
}
// Radio en que el artefacto atrae la punta de la tubería (en el dibujo)
const dsRadioCon = el => {
  const f = dsFormaCon(el.k);
  return (f.r || Math.max(f.w, f.h)) * dsUk(el.k);
};
const dsConecta = el => !!(el && el.t === "sim" && el.k !== "tab" && DS_CAT[el.k] && dsVis(el));
// Tablero bajo el punto (dentro de su rectángulo, con r de tolerancia)
function dsTableroEn(x, y, r) {
  return (
    dsCercanos(x, y, r).find(el => {
      if (el.t !== "sim" || el.k !== "tab" || !dsVis(el)) return false;
      const [a, b] = dsALocal(el, x, y),
        bb = dsBBs("tab"),
        t = r / dsUk("tab");
      return a >= bb[0] - t && a <= bb[2] + t && b >= bb[1] - t && b <= bb[3] + t;
    }) || null
  );
}
// Salida de tablero más cercana a (x, y), a menos de r: { tb, o } o null
function dsSalidaEn(x, y, r) {
  let mejor = null,
    md = r;
  dsCercanos(x, y, r + dsMm(20)).forEach(tb => {
    if (tb.k !== "tab" || !dsVis(tb)) return;
    dsSalidasTab(tb).forEach(o => {
      const d = Math.hypot(o.p[0] - x, o.p[1] - y);
      if (d < md) {
        md = d;
        mejor = { tb, o };
      }
    });
  });
  return mejor;
}
// Empieza una tubería desde una salida del tablero o desde un artefacto, por el techo, la pared o el piso
function dsSacarTub(desde, modo) {
  DS_SEL.clear();
  plHerr(modo === "piso" ? "tubP" : "tubT");
  PLH.modoT = modo;
  if (desde.o)
    dsPuntoTub(desde.o.p, [
      desde.o.p[0],
      desde.o.p[1],
      8,
      { cir: desde.o.n, tab: desde.tb.id, nom: desde.tb.nom || "" }
    ]);
  else {
    const c = dsCentroCon(desde.el);
    dsPuntoTub(c, [c[0], c[1], 9, { con: desde.el.id, nom: DS_CAT[desde.el.k].n }]);
  }
  toast(
    `Tubería por ${modo === "piso" ? "el piso" : modo === "pared" ? "la pared" : "el techo"}: haga clic en cada punto; clic derecho o Intro para terminar`
  );
}
// Invierte el sentido de una tubería (para que empiece en el tablero)
function dsInvertirTub(el) {
  const q = [];
  for (let i = el.pts.length - 2; i >= 0; i -= 2) q.push(el.pts[i], el.pts[i + 1]);
  el.pts = q;
  if (el.b)
    el.b = el.b
      .slice(0, el.pts.length / 2 - 1)
      .reverse()
      .map(k => -k);
  const c0 = el.c0;
  if (el.c1) el.c0 = el.c1;
  else delete el.c0;
  if (c0) el.c1 = c0;
  else delete el.c1;
}
// Artefacto que atrae un punto (x, y), con r de tolerancia
function dsArtefactoEn(x, y, r) {
  let mejor = null,
    md = Infinity;
  dsCercanos(x, y, r).forEach(el => {
    if (!dsConecta(el)) return;
    const c = dsCentroCon(el),
      dd = Math.hypot(c[0] - x, c[1] - y);
    if (dd <= dsRadioCon(el) + r && dd < md) {
      md = dd;
      mejor = el;
    }
  });
  return mejor;
}
// Punto anterior a la punta que se está colocando: al dibujar una tubería o al arrastrar la punta de una
function dsContextoCon() {
  if (dsEsTub(PLH.h)) return { ref: PLH.pts[PLH.pts.length - 1] || null };
  const ag = PLH.agarre,
    el = ag && ag.t === "v" && dsD() ? dsD().els.find(e => e.id === ag.id) : null;
  if (!el || el.t !== "tub") return null;
  const n = el.pts.length / 2;
  if (ag.i === 0) return { ref: [el.pts[2], el.pts[3]] };
  if (ag.i === n - 1) return { ref: [el.pts[2 * n - 4], el.pts[2 * n - 3]] };
  return null;
}
// Enganche de conexión (tipo 9): el borde del artefacto cercano, hacia el punto anterior
function dsEngancheCon(x, y, r) {
  const cx = dsContextoCon();
  if (!cx) return null;
  const el = dsArtefactoEn(x, y, r);
  if (!el) {
    // Sobre el tablero (al dibujar una tubería): un clic muestra sus salidas para elegir una
    const tb = dsEsTub(PLH.h) && dsTableroEn(x, y, r);
    return tb ? [tb.x, tb.y, 10, { tabla: tb.id, nom: tb.nom || "el tablero" }] : null;
  }
  const p = cx.ref ? dsBorde(el, cx.ref[0], cx.ref[1]) : dsCentroCon(el);
  return [p[0], p[1], 9, { con: el.id, nom: DS_CAT[el.k].n }];
}
// El circuito (y su tablero) de la tubería pasa a los artefactos que aún no tienen
function dsHeredar(t) {
  if (!t.cir) return;
  ["c0", "c1"].forEach(c => {
    const s = t[c] && dsD().els.find(e => e.id === t[c]);
    if (s && s.k !== "tab" && !s.cir) {
      s.cir = t.cir;
      if (t.tab) s.tab = t.tab;
    }
  });
}
// Las puntas conectadas siguen a su artefacto (al moverlo, girarlo o editarlo)
function dsReconectar() {
  const D = dsD();
  if (!D) return;
  const por = new Map(D.els.filter(e => e.t === "sim").map(e => [e.id, e]));
  D.els.forEach(t => {
    if (t.t !== "tub" || !(t.c0 || t.c1)) return;
    const n = t.pts.length / 2;
    for (let vuelta = 0; vuelta < (n === 2 ? 2 : 1); vuelta++)
      ["c0", "c1"].forEach(c => {
        if (!t[c]) return;
        const s = por.get(t[c]);
        if (!s) return delete t[c];
        // Una tubería que se arrastra sola (sin su artefacto) se desconecta al soltarla
        if (PLH.arr && DS_SEL.has(t.id) && !DS_SEL.has(s.id)) return;
        const i = c === "c0" ? 0 : n - 1,
          j = c === "c0" ? 1 : n - 2;
        let p;
        if (s.k === "tab" && t.ali) p = dsBorde(s, t.pts[2 * j], t.pts[2 * j + 1]);
        else if (s.k === "tab") {
          // En el tablero: la salida de su circuito (si el tablero ya no la tiene, se suelta)
          const o = dsSalidasTab(s).find(q => q.n === t.cir);
          if (!o) return delete t[c];
          p = o.p;
        } else p = dsBorde(s, t.pts[2 * j], t.pts[2 * j + 1]);
        t.pts[2 * i] = p[0];
        t.pts[2 * i + 1] = p[1];
      });
  });
}
// El circuito se propaga por lo conectado: de la tubería a sus artefactos y de ellos a las tuberías sin circuito
function dsPropagarCircuitos() {
  const D = dsD();
  if (!D) return;
  const por = new Map(D.els.map(e => [e.id, e])),
    tubs = D.els.filter(e => e.t === "tub" && !e.ali && (e.c0 || e.c1));
  // «Lleva también» no repite el circuito propio (queda así si se cambia el circuito de la tubería)
  tubs.forEach(t => {
    if (t.cx && t.cx.includes(t.cir)) {
      t.cx = t.cx.filter(c => c !== t.cir);
      if (!t.cx.length) delete t.cx;
    }
  });
  for (let vuelta = 0, cambio = true; cambio && vuelta < 50; vuelta++) {
    cambio = false;
    tubs.forEach(t => {
      // Una caja o canalización de alimentador (elegido así) no toma ni pasa circuitos
      const ss = [t.c0, t.c1].map(id => por.get(id)).filter(s => s && s.k !== "tab" && s.ali !== true);
      if (t.cir)
        ss.forEach(s => {
          if (!s.cir) {
            s.cir = t.cir;
            if (t.tab) s.tab = t.tab;
            cambio = true;
          }
        });
      else {
        const s = ss.find(x => x.cir);
        if (s) {
          t.cir = s.cir;
          if (s.tab) t.tab = s.tab;
          cambio = true;
        }
      }
    });
  }
  /* El tablero del circuito: una tubería o un artefacto con su circuito escrito a mano (sin tablero) lo toma de lo
     conectado con el mismo circuito, o del tablero de donde sale. Sin tablero, el cálculo no lo encuentra y la salida
     queda «sin recorrido de tubería» aunque se vea conectada. */
  for (let vuelta = 0, cambio = true; cambio && vuelta < 50; vuelta++) {
    cambio = false;
    tubs.forEach(t => {
      if (!t.cir) return;
      const ext = [t.c0, t.c1].map(id => por.get(id)).filter(Boolean);
      if (!t.tab) {
        const tb = ext.find(s => s.k === "tab"),
          s = ext.find(x => x.k !== "tab" && x.cir === t.cir && x.tab);
        if (tb || s) {
          t.tab = tb ? tb.id : s.tab;
          cambio = true;
        }
      }
      if (t.tab)
        ext.forEach(s => {
          if (s.k !== "tab" && s.cir === t.cir && !s.tab) {
            s.tab = t.tab;
            cambio = true;
          }
        });
    });
  }
}
/* Conductores de cada tubería por el recorrido de su circuito (criterio de la plataforma): desde el tablero, la fase
   llega a cada interruptor y a las salidas que no se encienden con uno; cada tecla (letra) devuelve un retorno por el
   camino de las tuberías hasta sus luminarias; entre dos interruptores de tres vías van los dos viajeros; el neutro (o
   la segunda fase en 220 V) y la tierra llegan a cada salida con carga. Devuelve, por tubería, los de cada circuito:
   { f: fase, v: neutro o segunda fase, r: retornos y viajeros, t: tierra }. Los circuitos trifásicos, los que no salen
   de su tablero y las tuberías junto a un interruptor sin letra se quedan con el conteo simple (dsCondTub). */
function dsRedCond(D, tri) {
  const por = new Map(D.els.map(e => [e.id, e])),
    tol = 0.01 / (EPL && EPL.f > 0 ? EPL.f : 1),
    tres = typeof DP_3V !== "undefined" ? DP_3V : new Set(),
    grupos = new Map(),
    out = new Map();
  D.els.forEach(t => {
    if (t.t !== "tub" || t.ali || !t.cir || !t.tab || !Array.isArray(t.pts) || t.pts.length < 4) return;
    new Set([t.cir, ...(t.cx || [])]).forEach(c => {
      const k = t.tab + "|" + c;
      (grupos.get(k) || grupos.set(k, []).get(k)).push(t);
    });
  });
  grupos.forEach((lista, k) => {
    const i0 = k.indexOf("|"),
      tab = k.slice(0, i0),
      cir = k.slice(i0 + 1),
      tb = por.get(tab);
    if (!tb || tb.k !== "tab" || tri.has(k)) return;
    // Nodos: los artefactos («D:id») y los vértices de las tuberías; la punta suelta sobre otra tubería, unida a ella
    const alias = new Map(),
      nodo = (t, i) => {
        const n = t.pts.length / 2;
        let id =
          i === 0 && t.c0 && por.get(t.c0)
            ? "D:" + t.c0
            : i === n - 1 && t.c1 && por.get(t.c1)
              ? "D:" + t.c1
              : `V:${t.id}:${i}`;
        for (let g = 0; alias.has(id) && g < 50; g++) id = alias.get(id);
        return id;
      };
    lista.forEach(t => {
      const n = t.pts.length / 2;
      [
        [0, t.c0],
        [n - 1, t.c1]
      ].forEach(([i, c]) => {
        if (c && por.get(c)) return;
        const x = t.pts[2 * i],
          y = t.pts[2 * i + 1],
          yo = `V:${t.id}:${i}`;
        for (const o of lista) {
          if (o === t) continue;
          for (let j = 0; j < o.pts.length; j += 2)
            if (Math.abs(o.pts[j] - x) < tol && Math.abs(o.pts[j + 1] - y) < tol) {
              const a = nodo(o, j / 2);
              if (a !== yo) alias.set(yo, a);
              return;
            }
        }
      });
    });
    const ady = new Map(),
      une = (a, b, t) => {
        if (a === b) return;
        (ady.get(a) || ady.set(a, []).get(a)).push([b, t]);
        (ady.get(b) || ady.set(b, []).get(b)).push([a, t]);
      };
    lista.forEach(t => {
      for (let i = 0; i + 1 < t.pts.length / 2; i++) une(nodo(t, i), nodo(t, i + 1), t);
    });
    // Árbol desde el tablero (por número de tramos)
    const raiz = "D:" + tab;
    if (!ady.has(raiz)) return;
    const par = new Map([[raiz, null]]),
      prof = new Map([[raiz, 0]]),
      cola = [raiz];
    for (let q = 0; q < cola.length; q++) {
      const u = cola[q];
      ady.get(u).forEach(([w, t]) => {
        if (par.has(w)) return;
        par.set(w, { p: u, t });
        prof.set(w, prof.get(u) + 1);
        cola.push(w);
      });
    }
    // Artefactos del circuito unidos al tablero: interruptores por letra, luminarias encendidas por ellos y cargas
    const N = s => "D:" + s.id,
      sims = D.els.filter(s => s.t === "sim" && s.tab === tab && s.cir === cir && par.has(N(s))),
      ints = sims.filter(dsEsInt),
      sinLetra = ints.filter(s => !s.enc),
      porL = new Map(),
      lumL = new Map(),
      fase = new Set(),
      carga = [],
      steiner = [];
    ints.forEach(s => dsLetras(s).forEach(l => (porL.get(l) || porL.set(l, []).get(l)).push(s)));
    sims.forEach(s => {
      const cl = plArt(s.k)[0];
      if (!cl || dsEsInt(s)) return;
      carga.push(N(s));
      const l = cl === "al" && s.enc;
      if (l && porL.has(l)) (lumL.get(l) || lumL.set(l, []).get(l)).push(N(s));
      else fase.add(N(s));
    });
    sinLetra.forEach(s => fase.add(N(s)));
    porL.forEach((sw, l) => {
      const lu = lumL.get(l) || [];
      if (sw.length >= 2 && sw.every(s => tres.has(s.k))) {
        // Tres vías: la fase al más cercano al tablero, los viajeros entre ellos y el retorno desde el último
        const o = [...sw].sort((a, b) => prof.get(N(a)) - prof.get(N(b)));
        fase.add(N(o[0]));
        steiner.push([o.map(N), 2]);
        steiner.push([[N(o[o.length - 1]), ...lu], 1]);
      } else
        sw.forEach(s => {
          fase.add(N(s));
          steiner.push([[N(s), ...lu], 1]);
        });
    });
    // Cuántos de un conjunto quedan aguas abajo de cada tramo (el tramo se nombra por su nodo hijo)
    const contar = L => {
      const c = new Map();
      new Set(L).forEach(x => {
        for (let y = x, g = 0; y !== raiz && par.get(y) && g < 1e5; y = par.get(y).p, g++)
          c.set(y, (c.get(y) || 0) + 1);
      });
      return c;
    };
    const cF = contar(fase),
      cV = contar(carga),
      R = new Map();
    // Un tramo une a un grupo (interruptor y sus luminarias) si deja a unos de un lado y a otros del otro
    steiner.forEach(([L, m]) => {
      const S = new Set(L);
      if (S.size < 2) return;
      contar(S).forEach((n, y) => n < S.size && R.set(y, (R.get(y) || 0) + m));
    });
    const res = new Map();
    par.forEach((e, y) => {
      if (!e) return;
      const o = res.get(e.t) || res.set(e.t, { f: 0, v: 0, r: 0, t: 0 }).get(e.t);
      if (cF.get(y)) o.f = 1;
      if (cV.get(y)) o.v = o.t = 1;
      o.r = Math.max(o.r, R.get(y) || 0);
    });
    const junto = new Set(sinLetra.map(s => s.id));
    res.forEach((o, t) => {
      if (junto.has(t.c0) || junto.has(t.c1) || !(o.f + o.v + o.r)) return;
      (out.get(t.id) || out.set(t.id, new Map()).get(t.id)).set(cir, o);
    });
  });
  return out;
}
/* Conductores de una tubería: los del recorrido de cada circuito (dsRedCond) o, si no se pudo seguir, el conteo
   simple (fase y neutro o dos fases, tres fases en un trifásico; la del interruptor, la fase y un retorno por tecla o
   los de su tipo, sin tierra: DC_RET, criterio). Devuelve el total { f, n, r, t } y los conductores activos de cada
   circuito (act: [{ cir, k }], para la sección). */
function dsCondTub(t, red, tri, n380, por) {
  const cirs = [...new Set([t.cir, ...(t.cx || [])])],
    rc = red.get(t.id),
    sw = [t.c0, t.c1].map(id => por.get(id)).filter(s => s && dsEsInt(s)),
    c = { f: 0, n: 0, r: 0, t: false },
    act = [];
  if (sw.length && !(rc && cirs.some(x => rc.has(x)))) {
    const k = Math.max(
      ...sw.map(s => Math.max((typeof DC_RET !== "undefined" && DC_RET[s.k]) || 2, 1 + dsLetras(s).length))
    );
    c.f = 1;
    c.r = Math.min(12, k - 1);
    act.push({ cir: t.cir, k });
    return { c, act };
  }
  cirs.forEach(cir => {
    const o = rc && rc.get(cir);
    if (o) {
      c.f += o.f + (n380 ? 0 : o.v);
      c.n += n380 ? o.v : 0;
      c.r += o.r;
      if (o.t) c.t = true;
      act.push({ cir, k: o.f + o.v + o.r });
      return;
    }
    const f3 = tri.has((t.tab || "") + "|" + cir),
      f = f3 ? 3 : n380 ? 1 : 2,
      n = !f3 && n380 ? 1 : 0;
    c.f += f;
    c.n += n;
    c.t = true;
    act.push({ cir, k: f + n });
  });
  c.f = Math.min(12, c.f);
  c.n = Math.min(6, c.n);
  c.r = Math.min(12, c.r);
  return { c, act };
}
// Circuitos trifásicos del diseño («tablero|circuito»): los que tienen alguna salida trifásica (como en el cálculo)
function dsCirTri(D) {
  const tri = new Set();
  D.els.forEach(s => {
    if (s.t !== "sim" || !s.cir) return;
    const cl = plArt(s.k)[0],
      f3 = cl === "esp" ? (s.fs || (PL_ESP[s.k] || [])[1]) === 3 : PL_TRI.has(s.k) || s.fs === 3;
    if (f3) tri.add((s.tab || "") + "|" + s.cir);
  });
  return tri;
}
/* Conductores por defecto de cada tubería de circuito (marcas de la norma), según el sistema del proyecto y el
   recorrido del circuito (dsRedCond): la fase, el neutro (con 380/220 V; en monofásico 220 V los dos conductores son
   fases), los retornos (R) de los interruptores y la tierra (T). Solo en las tuberías sin conductores o con los
   automáticos (condA): si el proyectista los cambia, se respetan. Las secciones y el diámetro los escribe el cálculo
   («Datos para el cálculo»). */
function dsCondAuto() {
  const D = dsD();
  if (!D) return;
  const sk = (typeof MODE !== "undefined" && MODE === "multi" ? PROY.sistG : PROY.sist) || "mono220",
    por = new Map(D.els.map(e => [e.id, e])),
    tri = dsCirTri(D),
    red = dsRedCond(D, tri);
  D.els.forEach(t => {
    if (t.t !== "tub" || t.ali || !t.cir || (t.cond && !t.condA)) return;
    const { c } = dsCondTub(t, red, tri, sk === "tri380", por);
    if (!c.r) delete c.r;
    t.cond = c;
    t.condA = true;
  });
}
// Tuberías que se mueven o giran sin su artefacto: dejan de estar conectadas a él
function dsDesligar(sel) {
  const ids = new Set(sel.map(el => el.id));
  sel.forEach(t => {
    if (t.t !== "tub") return;
    ["c0", "c1"].forEach(c => {
      if (t[c] && !ids.has(t[c])) delete t[c];
    });
  });
}
// Al soltar la punta de una tubería: queda conectada al artefacto donde cayó, o suelta
function dsAgarreSoltar(ag, eng) {
  const el = dsD() && dsD().els.find(e => e.id === ag.id);
  if (!el || el.t !== "tub") return;
  if (ag.t === "ins") return dsDesligar([el]);
  if (ag.t !== "v") return;
  const n = el.pts.length / 2,
    c = ag.i === 0 ? "c0" : ag.i === n - 1 ? "c1" : null;
  if (!c) return;
  if (eng && eng[2] === 9) {
    el[c] = eng[3].con;
    dsHeredar(el);
  } else delete el[c];
}
// Lo que no está conectado: artefactos sin tubería y puntas de tubería que no llegan a nada
function dsSueltos() {
  const D = dsD(),
    out = { sims: [], puntas: [] };
  if (!D) return out;
  const tubs = D.els.filter(e => e.t === "tub" && dsVis(e)),
    con = new Set(),
    tol = 0.01 / (EPL ? EPL.f : 1);
  tubs.forEach(t => [t.c0, t.c1].forEach(c => c && con.add(c)));
  D.els.forEach(el => {
    // Un piso por el que el montante solo pasa (enlazado abajo y arriba) no necesita tubería en ese piso
    if (dsConecta(el) && !con.has(el.id) && !(el.mon && el.mon2)) out.sims.push(el);
  });
  // Una punta que toca un vértice de otra tubería (derivación) también cuenta como conectada
  const toca = (t, x, y) =>
    tubs.some(o => {
      if (o === t) return false;
      for (let i = 0; i < o.pts.length; i += 2) if (Math.hypot(o.pts[i] - x, o.pts[i + 1] - y) < tol) return true;
      return false;
    });
  tubs.forEach(t => {
    const n = t.pts.length;
    if (!t.c0 && !t.tab && !toca(t, t.pts[0], t.pts[1])) out.puntas.push({ el: t, p: [t.pts[0], t.pts[1]] });
    if (!t.c1 && !toca(t, t.pts[n - 2], t.pts[n - 1])) out.puntas.push({ el: t, p: [t.pts[n - 2], t.pts[n - 1]] });
  });
  return out;
}
// Conecta las puntas sueltas que ya están sobre un artefacto (por ejemplo, las dibujadas antes de esta versión)
function dsConectarAuto() {
  const D = dsD();
  if (!D) return 0;
  let k = 0;
  const tol = dsMm(1);
  // Puntas sobre una salida de tablero: la tubería queda saliendo de ella
  const sal = D.els.filter(e => e.k === "tab").flatMap(tb => dsSalidasTab(tb).map(o => ({ ...o, tb })));
  const salEn = (x, y) => sal.find(o => Math.hypot(o.p[0] - x, o.p[1] - y) < tol * 3);
  D.els.forEach(t => {
    if (t.t !== "tub") return;
    const n = t.pts.length;
    if (!t.c0 || !t.c1) {
      const a = !t.c0 && salEn(t.pts[0], t.pts[1]),
        b = !a && !t.c1 && salEn(t.pts[n - 2], t.pts[n - 1]);
      if (b) dsInvertirTub(t);
      const o = a || b;
      if (o) {
        t.c0 = o.tb.id;
        t.tab = o.tb.id;
        t.cir = o.n;
        k++;
      }
    }
    if (!t.c0 && !t.tab) {
      const s = dsArtefactoEn(t.pts[0], t.pts[1], tol);
      if (s && s.id !== t.c1) {
        t.c0 = s.id;
        k++;
      }
    }
    if (!t.c1) {
      const s = dsArtefactoEn(t.pts[n - 2], t.pts[n - 1], tol);
      if (s && s.id !== t.c0) {
        t.c1 = s.id;
        k++;
      }
    }
    dsHeredar(t);
  });
  return k;
}
// Marcas naranjas de lo no conectado (solo en el editor)
function dsDibSueltos(g) {
  if (!DSU.sueltos || dsU() * PLV.s * 17 < 6) return;
  const s = dsSueltos(),
    d = plDpr(),
    nar = PL_OSCURO ? "#ff9b4a" : "#e8590c";
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineWidth = 1.4 * d;
  const punto = (X, Y, r) => {
    g.beginPath();
    g.arc(X, Y, r, 0, 2 * Math.PI);
    g.fillStyle = nar;
    g.fill();
    g.strokeStyle = PL_OSCURO ? "#111922" : "#fff";
    g.stroke();
  };
  s.puntas.forEach(o => punto(...plAPant(o.p[0], o.p[1]), 3.5 * d));
  s.sims.forEach(el => {
    const b = dsBBox(el),
      [X, Y] = plAPant(b[2], b[3]);
    punto(X + 2 * d, Y - 2 * d, 3 * d);
  });
  g.restore();
}
