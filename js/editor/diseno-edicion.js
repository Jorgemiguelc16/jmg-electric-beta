/* DISEÑO ELÉCTRICO · EDICIÓN
   Copiar en fila y espejo; seleccionar, mover, girar, copiar, pegar y borrar; editar líneas, áreas y tuberías
   (vértices, partir, unir, tramos rectos o en arco).
   Antes era parte de js/diseno.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Copiar en fila y espejo ---------- */
// Copia los elementos con una transformación; las conexiones entre los copiados se conservan, las demás se quitan
function dsClonar(lista, tr) {
  const nuevo = new Map(),
    out = [];
  lista.forEach(o => {
    const el = JSON.parse(JSON.stringify(o));
    tr(el);
    dsAgregar(el);
    nuevo.set(o.id, el.id);
    out.push(el);
  });
  out.forEach(t =>
    ["c0", "c1"].forEach(c => {
      if (t[c] && nuevo.has(t[c])) t[c] = nuevo.get(t[c]);
      else delete t[c];
    })
  );
  return out;
}
// Refleja un elemento respecto de la línea por a con dirección unitaria (ux, uy)
function dsReflejar(el, a, ux, uy) {
  const R = (x, y) => {
      const dx = x - a[0],
        dy = y - a[1],
        k = dx * ux + dy * uy;
      return [a[0] + 2 * k * ux - dx, a[1] + 2 * k * uy - dy];
    },
    th = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (el.pts) {
    const q = [];
    for (let i = 0; i < el.pts.length; i += 2) q.push(...R(el.pts[i], el.pts[i + 1]));
    el.pts = q;
    if (el.b) el.b = el.b.map(k => -k);
  } else if (el.a) {
    el.a = R(...el.a);
    el.b = R(...el.b);
    el.o = -el.o;
    if (Math.abs(Math.sin((th * Math.PI) / 90)) > 1e-6) el.modo = "alin";
  } else {
    [el.x, el.y] = R(el.x, el.y);
    if (el.t === "sim" || el.t === "txt") el.r = Math.round(((((2 * th - (el.r || 0)) % 360) + 360) % 360) * 100) / 100;
    delete el.dt;
  }
}
// Inicia Copiar en fila (pide el número de copias) o Espejo, con lo seleccionado
function dsIniciarCopia(h) {
  const sel = dsSel().filter(dsEditable);
  if (!sel.length) return toast("Elija primero lo que quiere copiar");
  const ids = sel.map(el => el.id);
  if (h === "espejo") {
    plHerr("espejo");
    PLH.copia = { ids };
    return plOrden();
  }
  plPedir("Número de copias", "3", v => {
    const n = Math.round(parseFloat(v));
    plPedir(null);
    if (!(n >= 1 && n <= 200)) return toast("Escriba un número de copias entre 1 y 200");
    plHerr("fila");
    PLH.copia = { ids, n };
    plOrden();
  });
}
function dsPuntoCopia(p) {
  const h = PLH.h;
  PLH.pts.push(p);
  if (PLH.pts.length < 2) return plOrden();
  const [a, b] = PLH.pts,
    c = PLH.copia,
    lista = c ? dsD().els.filter(el => c.ids.includes(el.id)) : [];
  if (!lista.length || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9) {
    PLH.pts = [];
    return plOrden();
  }
  let nuevos = [];
  if (h === "fila") {
    for (let k = 1; k <= c.n; k++)
      nuevos = nuevos.concat(dsClonar(lista, el => dsTrasladar(el, (b[0] - a[0]) * k, (b[1] - a[1]) * k)));
    toast(`${c.n} copia${c.n > 1 ? "s" : ""} en fila, a ${plFm(Math.hypot(b[0] - a[0], b[1] - a[1]))} m`);
  } else {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    nuevos = dsClonar(lista, el => dsReflejar(el, a, (b[0] - a[0]) / L, (b[1] - a[1]) / L));
    toast("Copia en espejo creada · si solo quería reflejar, presione Supr: borra los originales, que siguen elegidos");
  }
  PLH.copia = null;
  plHerr(null);
  DS_SEL.clear();
  (h === "fila" ? nuevos : lista).forEach(el => DS_SEL.add(el.id));
  if (!nuevos.length) return;
  edCambio();
  edProps();
}
// Fantasma de lo que se va a copiar: el elemento transformado, tenue
function dsFantasma(g, el, tr, col) {
  const o = JSON.parse(JSON.stringify(el));
  tr(o);
  if (o.t === "sim")
    dsDibSim(g, o.k, ...plAPant(o.x, o.y), ((o.r || 0) * Math.PI) / 180, dsUk(o.k) * PLV.s, col, null, plDpr());
  else if (o.t === "txt" || dsEsTabla(o)) {
    const b = dsBBox(o),
      [x0, y0] = plAPant(b[0], b[3]),
      [x1, y1] = plAPant(b[2], b[1]);
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  } else {
    g.beginPath();
    dsLineas(o).forEach(p => plRuta(g, p, false));
    g.stroke();
  }
}
// Termina la polilínea o la tubería en curso (Intro, doble clic o Esc); conFin: artefacto al que llega
function dsTerminar(conFin, tabFin) {
  const h = PLH.h;
  if (!(h === "pol" || h === "areaP" || dsEsTub(h)) || PLH.pts.length < (h === "areaP" ? 3 : 2)) {
    if (h === "pol" || h === "areaP" || dsEsTub(h)) {
      // Una tubería que solo tenía su inicio en un artefacto: se descarta y se sigue en la herramienta
      const habia = dsEsTub(h) && PLH.pts.length === 1 && PLH.conIni;
      PLH.pts = [];
      PLH.bul = [];
      PLH.cirIni = null;
      PLH.conIni = null;
      if (habia) {
        plOrden();
        plSobreDibujar();
        return true;
      }
    }
    return false;
  }
  const capa = dsCapaPara(h);
  dsCapa(capa);
  if (h === "areaP") {
    const el = dsAgregar({ t: "lin", pts: PLH.pts.flat(), c: true, capa, ar: { tp: dpAreaTipo(false) } });
    PLH.pts = [];
    PLH.bul = [];
    plOrden();
    dpAreaNueva(el);
    return el;
  }
  const el = { t: h === "pol" ? "lin" : "tub", pts: PLH.pts.flat(), c: false, capa };
  if (dsEsTub(h)) {
    el.modo = h === "tubP" ? "piso" : PLH.modoT === "pared" ? "pared" : "techo";
    if ((PLH.bul || []).some(Boolean)) el.b = PLH.bul.slice(0, PLH.pts.length - 1);
    if (PLH.cirIni) {
      el.cir = PLH.cirIni.cir;
      if (PLH.cirIni.tab) el.tab = PLH.cirIni.tab;
    }
    if (PLH.conIni) el.c0 = PLH.conIni;
    if (conFin && conFin !== PLH.conIni) el.c1 = conFin;
    if (PLH.ali) {
      el.ali = true;
      delete el.cir;
      delete el.tab;
    }
    // Llega al tablero: se invierte para que salga de él
    if (tabFin) {
      el.c1 = tabFin;
      dsInvertirTub(el);
    }
  }
  dsAgregar(el);
  if (el.t === "tub" && !el.ali) dsHeredar(el);
  PLH.pts = [];
  PLH.bul = [];
  PLH.cirIni = null;
  PLH.conIni = null;
  PLH.ali = false;
  edCambio();
  plOrden();
  return el;
}
// Punto a la distancia escrita desde el último punto, en la dirección del cursor (entrada de longitud)
function dsPuntoAdistancia(L) {
  const u = PLH.pts[PLH.pts.length - 1];
  if (!u || !(L > 0)) return null;
  const q = plPuntoActual() || [u[0] + 1, u[1]];
  let dx = q[0] - u[0],
    dy = q[1] - u[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-12) [dx, dy] = [1, 0];
  else [dx, dy] = [dx / d, dy / d];
  const l = L / EPL.f;
  return [u[0] + dx * l, u[1] + dy * l];
}

/* ---------- Selección, mover, girar, copiar, pegar y borrar ---------- */
const dsSel = () => (dsD() ? dsD().els.filter(el => DS_SEL.has(el.id)) : []);
// Clic sobre un elemento: lo selecciona (con Mayús se suma o se quita) y prepara el arrastre para moverlo
function dsPresionar(id, p, suma) {
  if (suma) {
    if (DS_SEL.has(id)) DS_SEL.delete(id);
    else DS_SEL.add(id);
  } else if (!DS_SEL.has(id)) {
    DS_SEL.clear();
    PL_ASEL.clear();
    DS_SEL.add(id);
  }
  PLH.obj = -1;
  PLH.arr = DS_SEL.has(id) ? { base: p, orig: dsSel().map(el => JSON.stringify(el)), mov: false, id, suma } : null;
  edProps();
  plSobreDibujar();
}
function dsTrasladar(el, dx, dy) {
  if (el.ar && el.ar.p) el.ar.p = [el.ar.p[0] + dx, el.ar.p[1] + dy];
  if (el.pts) el.pts = el.pts.map((v, i) => v + (i % 2 ? dy : dx));
  else if (el.a) {
    el.a = [el.a[0] + dx, el.a[1] + dy];
    el.b = [el.b[0] + dx, el.b[1] + dy];
  } else {
    el.x += dx;
    el.y += dy;
  }
}
function dsMover(q) {
  dsIdxSucio();
  const a = PLH.arr,
    dx = q[0] - a.base[0],
    dy = q[1] - a.base[1],
    D = dsD();
  a.mov = true;
  a.orig
    .map(s => JSON.parse(s))
    .forEach(o => {
      const i = D.els.findIndex(e => e.id === o.id);
      if (i < 0) return;
      dsTrasladar(o, dx, dy);
      D.els[i] = o;
    });
  dsReconectar();
  plDibujar();
}
function dsSoltar() {
  const a = PLH.arr;
  PLH.arr = null;
  if (a.mov) {
    dsDesligar(dsSel());
    return edCambio();
  }
  // Clic sin mover sobre un elemento de una selección múltiple: queda solo ese
  if (!a.suma && DS_SEL.size > 1) {
    DS_SEL.clear();
    DS_SEL.add(a.id);
  }
  edProps();
  plSobreDibujar();
  const t = !a.suma && dsMarcasEn(a.base[0], a.base[1]);
  if (t && t.id === a.id) dsVentanaCond(t);
}
// Mueve lo seleccionado con las flechas del teclado: 1 cm, o 10 cm con Mayús
function dsEmpujar(dx, dy, grande) {
  const sel = dsSel().filter(dsEditable);
  if (!sel.length) return false;
  const l = (grande ? 0.1 : 0.01) / EPL.f;
  sel.forEach(el => dsTrasladar(el, dx * l, dy * l));
  dsDesligar(sel);
  edCambio();
  return true;
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
  plMarcoArq(xa, ya, xb, yb, captura, mc.shift);
  PLH.obj = -1;
  edProps();
  plSobreDibujar();
}
function dsGirar(ang = DSU.giro || 90) {
  if (PLH.h && PLH.h.startsWith("col:")) {
    PLH.rot = (((PLH.rot + ang) % 360) + 360) % 360;
    return plSobreDibujar();
  }
  const sel = dsSel().filter(el => dsEditable(el) && !dsEsTabla(el));
  if (!sel.length) return;
  dsDesligar(sel);
  // Los símbolos y textos giran sobre su punto; lo demás, sobre el centro de la selección
  const b = sel.map(dsBBox),
    cx = (Math.min(...b.map(x => x[0])) + Math.max(...b.map(x => x[2]))) / 2,
    cy = (Math.min(...b.map(x => x[1])) + Math.max(...b.map(x => x[3]))) / 2,
    co = Math.cos((ang * Math.PI) / 180),
    si = Math.sin((ang * Math.PI) / 180),
    rot = (x, y) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co],
    recto = ang % 90 === 0,
    cuarto = Math.abs(ang % 180) === 90;
  sel.forEach(el => {
    if (el.t === "sim" || el.t === "txt") el.r = Math.round((((((el.r || 0) + ang) % 360) + 360) % 360) * 100) / 100;
    else if (el.t === "cir") [el.x, el.y] = sel.length > 1 ? rot(el.x, el.y) : [el.x, el.y];
    else if (el.t === "cot") {
      el.a = rot(...el.a);
      el.b = rot(...el.b);
      // A 90° la cota horizontal pasa a vertical; a otros ángulos queda alineada con sus puntos
      if (!recto) el.modo = "alin";
      else if (cuarto && el.modo !== "alin") el.modo = el.modo === "h" ? "v" : "h";
    } else {
      const q = [];
      for (let i = 0; i < el.pts.length; i += 2) q.push(...rot(el.pts[i], el.pts[i + 1]));
      el.pts = q;
    }
  });
  edCambio();
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
    q = plPuntoActual() || [cx + 20 * dsU(), cy - 20 * dsU()];
  DS_SEL.clear();
  const nuevo = new Map(),
    pegados = [];
  DS_PORTA.forEach(o => {
    const el = JSON.parse(JSON.stringify(o));
    dsTrasladar(el, q[0] - cx, q[1] - cy);
    dsCapa(el.capa);
    dsAgregar(el);
    nuevo.set(o.id, el.id);
    pegados.push(el);
    DS_SEL.add(el.id);
  });
  pegados.forEach(t =>
    ["c0", "c1"].forEach(c => {
      if (t[c] && nuevo.has(t[c])) t[c] = nuevo.get(t[c]);
      else delete t[c];
    })
  );
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
const dsTipo = el =>
  el.t === "sim" ? el.k : el.t === "tub" ? "tub-" + (el.modo === "piso" ? "piso" : "techo") : el.ar ? "area" : el.t;
// Curvatura de las líneas y tuberías seleccionadas: curvar, enderezar o invertir todos sus tramos
function dsCurvar(modo) {
  const sel = dsSel().filter(el => (el.t === "lin" || el.t === "tub") && dsEditable(el));
  if (!sel.length) return;
  sel.forEach(el => {
    const n = dsTramos({ ...el, b: [] }).length;
    if (modo === "recto") delete el.b;
    else if (modo === "curvo") el.b = Array.from({ length: n }, (v, i) => (el.b && el.b[i]) || DS_BUL);
    else if (el.b) el.b = el.b.map(k => -k);
  });
  edCambio();
}

/* ---------- Edición de líneas, áreas y tuberías: vértices, partir, unir y tramos rectos o en arco ----------
   Como en las polilíneas de AutoCAD, cada vértice guarda la curvatura (k) del tramo que sale de él. Al partir un
   arco, cada parte conserva la misma circunferencia. Una tubería partida conserva su circuito y sus datos; su
   inicio sigue conectado al artefacto de antes y el final de la otra parte, al suyo. */
const dsEsPoli = el => !!el && (el.t === "lin" || el.t === "tub") && Array.isArray(el.pts) && el.pts.length >= 4;
const dsVerts = el => {
  const b = el.b || [];
  return Array.from({ length: el.pts.length / 2 }, (v, i) => ({
    x: el.pts[2 * i],
    y: el.pts[2 * i + 1],
    k: b[i] || 0
  }));
};
function dsDeVerts(el, V) {
  el.pts = V.flatMap(v => [v.x, v.y]);
  const b = V.slice(0, el.c ? V.length : V.length - 1).map(v => v.k || 0);
  if (b.some(Boolean)) el.b = b;
  else delete el.b;
  // Un área editada a mano ya no se vuelve a detectar desde su punto al actualizar la arquitectura
  if (el.ar) delete el.ar.p;
  dsIdxSucio();
}
// Mismo recorrido en sentido contrario (las curvas cambian de signo)
function dsInvertirVerts(V) {
  const n = V.length;
  return V.map((v, j) => ({ x: V[n - 1 - j].x, y: V[n - 1 - j].y, k: j < n - 1 ? -V[n - 2 - j].k : 0 }));
}
/* Punto de un tramo más cercano a q: { p, s } (s: fracción del tramo, de 0 a 1) y las curvaturas de las dos partes
   si se parte ahí (k1 del inicio al punto, k2 del punto al final) */
function dsEnTramo(t, q) {
  const [ax, ay] = t.a,
    [bx, by] = t.b;
  if (!t.k || !t.c) {
    const dx = bx - ax,
      dy = by - ay,
      L2 = dx * dx + dy * dy || 1,
      s = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / L2));
    return { p: [ax + s * dx, ay + s * dy], s, k1: 0, k2: 0 };
  }
  const th = 4 * Math.atan(Math.abs(t.k)),
    r = t.c / (2 * Math.sin(th / 2)),
    hx = (ax + bx) / 2 - t.m[0],
    hy = (ay + by) / 2 - t.m[1],
    hl = Math.hypot(hx, hy) || 1,
    cx = t.m[0] + (hx / hl) * r,
    cy = t.m[1] + (hy / hl) * r,
    ang = (x, y) => Math.atan2(y - cy, x - cx),
    // Sentido de giro del arco: del inicio hacia su punto medio
    sg = Math.sign((ax - cx) * (t.m[1] - cy) - (ay - cy) * (t.m[0] - cx)) || 1,
    a0 = ang(ax, ay),
    D = 2 * Math.PI;
  let a1 = ((((ang(q[0], q[1]) - a0) * sg) % D) + D) % D;
  if (a1 > th) a1 = a1 - th < D - a1 ? th : 0;
  const pa = a0 + sg * a1,
    sk = Math.sign(t.k);
  return {
    p: [cx + r * Math.cos(pa), cy + r * Math.sin(pa)],
    s: a1 / th,
    k1: sk * Math.tan(a1 / 4),
    k2: sk * Math.tan((th - a1) / 4)
  };
}
// Tramo de la línea más cercano a q (a menos de tol) o null
function dsTramoEn(el, q, tol) {
  let m = null;
  dsTramos(el).forEach(t => {
    const e = dsEnTramo(t, q),
      d = Math.hypot(e.p[0] - q[0], e.p[1] - q[1]);
    if (d <= tol && (!m || d < m.d)) m = { i: t.i, d };
  });
  return m;
}
// Agrega un vértice en el tramo i, en el punto más cercano a q; devuelve su número o -1 (si cae en un extremo)
function dsAgregarVertice(el, i, q) {
  const t = dsTramos(el)[i];
  if (!t) return -1;
  const e = dsEnTramo(t, q);
  if (e.s < 1e-3 || e.s > 1 - 1e-3) return -1;
  const V = dsVerts(el);
  V[i].k = e.k1;
  V.splice(i + 1, 0, { x: e.p[0], y: e.p[1], k: e.k2 });
  dsDeVerts(el, V);
  return i + 1;
}
// Quita el vértice i: sus dos tramos quedan en uno recto. Una línea abierta conserva al menos 2 vértices; una
// cerrada (o un área), 3
function dsQuitarVertice(el, i) {
  const n = el.pts.length / 2;
  if (n <= (el.c ? 3 : 2)) return false;
  const V = dsVerts(el),
    ant = i > 0 ? i - 1 : el.c ? n - 1 : -1;
  if (ant >= 0) V[ant].k = 0;
  V.splice(i, 1);
  // Una tubería que pierde su extremo deja de estar conectada por ese lado
  if (!el.c && i === 0) delete el.c0;
  if (!el.c && i === n - 1) delete el.c1;
  dsDeVerts(el, V);
  return true;
}
// Copia de un elemento con otro identificador, a continuación del original
function dsGemelo(el) {
  const c = JSON.parse(JSON.stringify(el));
  c.id = dsId();
  const L = dsD().els;
  L.splice(L.indexOf(el) + 1, 0, c);
  return c;
}
/* Parte la línea en el vértice i: una abierta queda en dos; una cerrada se abre ahí (un área no se parte). Devuelve
   las partes o un texto con el motivo */
function dsPartir(el, i) {
  const V = dsVerts(el),
    n = V.length;
  if (el.c) {
    if (el.ar) return "Un área para el cálculo no se parte: quite o agregue vértices, o vuelva a marcarla";
    el.c = false;
    dsDeVerts(el, [...V.slice(i), ...V.slice(0, i), { ...V[i], k: 0 }]);
    return [el];
  }
  if (i <= 0 || i >= n - 1) return "En un extremo no hay nada que partir: elija un vértice intermedio o un tramo";
  const otra = dsGemelo(el);
  dsDeVerts(el, V.slice(0, i + 1));
  dsDeVerts(otra, V.slice(i));
  delete el.c1;
  delete otra.c0;
  return [el, otra];
}
// Parte en un punto del tramo i (si cae en un extremo del tramo, en ese vértice)
function dsPartirEn(el, i, q) {
  let v = dsAgregarVertice(el, i, q);
  if (v < 0) {
    const t = dsTramos(el)[i];
    v = dsEnTramo(t, q).s < 0.5 ? i : (i + 1) % (el.pts.length / 2);
  }
  return dsPartir(el, v);
}
// Quita el tramo i: una línea abierta queda en dos (o más corta, si era el primero o el último); una cerrada se abre
function dsQuitarTramo(el, i) {
  const V = dsVerts(el);
  if (el.c) {
    if (el.ar) return "Un área para el cálculo debe quedar cerrada: quite un vértice en lugar del tramo";
    el.c = false;
    dsDeVerts(el, [...V.slice(i + 1), ...V.slice(0, i + 1)]);
    return [el];
  }
  const A = V.slice(0, i + 1),
    B = V.slice(i + 1);
  if (A.length < 2 && B.length < 2) return "La línea tiene un solo tramo: bórrela con Supr";
  if (A.length < 2) {
    delete el.c0;
    dsDeVerts(el, B);
    return [el];
  }
  if (B.length < 2) {
    delete el.c1;
    dsDeVerts(el, A);
    return [el];
  }
  const otra = dsGemelo(el);
  dsDeVerts(el, A);
  dsDeVerts(otra, B);
  delete el.c1;
  delete otra.c0;
  return [el, otra];
}
// Tramo i recto, en arco o con la curva invertida
function dsTramoForma(el, i, modo) {
  const V = dsVerts(el);
  if (!V[i]) return;
  V[i].k = modo === "recto" ? 0 : modo === "arco" ? V[i].k || DS_BUL : -V[i].k;
  dsDeVerts(el, V);
}
/* ¿Se pueden unir? Dos líneas abiertas o dos tuberías abiertas (del mismo recorrido y circuito); no las áreas */
function dsUniblesMotivo(a, b) {
  if (!dsEsPoli(a) || !dsEsPoli(b) || a.t !== b.t) return "Elija dos líneas o dos tuberías";
  if (a.c || b.c || a.ar || b.ar) return "Las líneas cerradas y las áreas no se unen";
  if (a.t === "tub") {
    if ((a.modo || "techo") !== (b.modo || "techo"))
      return "Las tuberías van por distinto recorrido (techo, pared o piso)";
    if (!!a.ali !== !!b.ali || (a.cir || "") !== (b.cir || ""))
      return "Las tuberías son de distinto circuito: no se unen";
  }
  return "";
}
/* Une b a la línea a por sus extremos más cercanos; si no se tocan (a más de 1 cm), las une con un tramo recto.
   Queda a, con sus datos; b se borra */
function dsUnir(a, b) {
  const m = dsUniblesMotivo(a, b);
  if (m) return m;
  let A = dsVerts(a),
    B = dsVerts(b);
  const d = (u, v) => Math.hypot(u.x - v.x, u.y - v.y),
    ea = [A[0], A[A.length - 1]],
    eb = [B[0], B[B.length - 1]],
    op = [
      [1, 0],
      [1, 1],
      [0, 0],
      [0, 1]
    ].map(([i, j]) => ({ i, j, d: d(ea[i], eb[j]) }));
  op.sort((x, y) => x.d - y.d);
  const { i, j, d: gap } = op[0],
    // Extremos que quedan libres: el que no se une de cada una (con su conexión a un artefacto)
    c0 = i === 1 ? a.c0 : a.c1,
    c1 = j === 0 ? b.c1 : b.c0;
  if (i === 0) A = dsInvertirVerts(A);
  if (j === 1) B = dsInvertirVerts(B);
  const tol = 0.01 / (EPL.f || 1);
  let V;
  if (gap <= tol) V = [...A.slice(0, -1), { ...A[A.length - 1], k: B[0].k }, ...B.slice(1)];
  else V = [...A.slice(0, -1), { ...A[A.length - 1], k: 0 }, ...B];
  dsDeVerts(a, V);
  delete a.c0;
  delete a.c1;
  if (c0) a.c0 = c0;
  if (c1) a.c1 = c1;
  const L = dsD().els;
  L.splice(L.indexOf(b), 1);
  DS_SEL.delete(b.id);
  return { el: a, gap: gap > tol ? gap * (EPL.f || 1) : 0 };
}
