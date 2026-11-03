/* DISEÑO AVANZADO (editor de diseño)
   - Plantas: cada elemento pertenece a la planta encuadrada donde está; se copia lo elegido a otra planta (misma
     posición respecto de la esquina de cada planta) y se crean montantes (subida en un piso, bajada en el otro).
   - Bloques propios: un grupo de elementos guardado en este navegador (en metros), para insertarlo en cualquier
     proyecto desde la Biblioteca › Mis bloques.
   - Plantillas: estilo del proyecto (capas, símbolos con criterio, criterios de revisión, láminas, escala y textos):
     tres de partida (vivienda, oficina, local comercial) y las que guarde el proyectista.
   - Ruta automática: une con tuberías los artefactos elegidos, del tablero al más cercano y así sucesivamente.
   - Versiones: fotos del diseño guardadas con el proyecto, para compararlas (lo agregado, quitado y cambiado) o
     restaurarlas. */
const DP_PRE = BETA ? "jmg-electric-beta" : "jmg-electric";

/* ---------- Plantas y montantes ---------- */
const dpPlantaDe = (x, y) => (EPL ? EPL.plantas.findIndex(p => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) : -1);
const dpCentro = el => {
  const b = dsBBox(el);
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
};
const dpPlantaEl = el => dpPlantaDe(...dpCentro(el));
// Filtro del resumen del panel izquierdo: todas las plantas (−1) o una
let DP_F = -1;
const dpFiltrar = els => (DP_F >= 0 && EPL && EPL.plantas[DP_F] ? els.filter(el => dpPlantaEl(el) === DP_F) : els);
// Desplazamiento de la planta i a la j (esquina inferior izquierda de cada encuadre)
function dpDesp(i, j) {
  const a = EPL.plantas[i],
    b = EPL.plantas[j];
  return [b.x0 - a.x0, b.y0 - a.y0];
}
// Menú con las otras plantas, junto a lo elegido
function dpElegirPlanta(titulo, desde, fn) {
  const P = EPL.plantas,
    otras = P.map((p, j) => j).filter(j => j !== desde);
  if (!otras.length) return toast("Encuadre al menos dos plantas (Inicio › Encuadrar planta)");
  const c = dpCentro(dsSel()[0]);
  edMenuLista(
    c,
    `<div class="ed-mt">${esc(titulo)}</div>` +
      otras
        .map(j => `<button type="button" data-edm="sal:${j}" role="menuitem"><span>${esc(P[j].n)}</span></button>`)
        .join(""),
    fn
  );
}
function dpCopiarAPlanta() {
  const sel = dsSel().filter(dsEditable);
  if (!sel.length) return toast("Elija primero lo que quiere copiar");
  const i = dpPlantaEl(sel[0]);
  if (i < 0) return toast("Lo elegido no está dentro de una planta encuadrada");
  dpElegirPlanta("Copiar a la planta", i, j => {
    const [dx, dy] = dpDesp(i, j),
      nuevos = dsClonar(sel, el => {
        dsTrasladar(el, dx, dy);
        delete el.mon;
      });
    DS_SEL.clear();
    nuevos.forEach(el => DS_SEL.add(el.id));
    edCambio();
    const b = EPL.plantas[j];
    plVer(b.x0, b.y0, b.x1, b.y1);
    toast(`${nuevos.length} elemento${nuevos.length > 1 ? "s" : ""} copiado${nuevos.length > 1 ? "s" : ""} a ${b.n}`);
  });
}
// Montante: la canalización vertical y su par en otra planta (hacia arriba ↔ hacia abajo), enlazadas
const DP_PAR = { subida: "bajada", bajada: "subida", atrav: "atrav" };
function dpMontante() {
  const el = dsSel()[0];
  if (!el || !DP_PAR[el.k])
    return toast("Elija una canalización hacia arriba, hacia abajo o atravesando (Biblioteca › Cajas y canalización)");
  const i = dpPlantaEl(el);
  if (i < 0) return toast("La canalización no está dentro de una planta encuadrada");
  dpElegirPlanta("Montante hacia la planta", i, j => {
    const [dx, dy] = dpDesp(i, j),
      par = dsAgregar({
        t: "sim",
        k: DP_PAR[el.k],
        x: el.x + dx,
        y: el.y + dy,
        r: el.r || 0,
        capa: el.capa,
        ...(el.cir ? { cir: el.cir } : {}),
        ...(el.tab ? { tab: el.tab } : {})
      });
    el.mon = par.id;
    par.mon = el.id;
    edCambio();
    toast(`Montante de ${EPL.plantas[i].n} a ${EPL.plantas[j].n}: ${DS_CAT[par.k].n.toLowerCase()} en la otra planta`);
  });
}
// Va al otro extremo del montante
function dpIrMontante() {
  const el = dsSel()[0],
    o = el && el.mon && dsD().els.find(e => e.id === el.mon);
  if (!o) return toast("Esta canalización no tiene su par en otra planta");
  DS_SEL.clear();
  DS_SEL.add(o.id);
  const m = 3 / EPL.f;
  plVer(o.x - m, o.y - m, o.x + m, o.y + m);
  edProps();
}
// Revisión: canalizaciones verticales sin su par
function dpVerificar(add) {
  const D = dsD(),
    ids = new Set(D.els.map(e => e.id)),
    sin = D.els.filter(e => DP_PAR[e.k] && dsVis(e) && !(e.mon && ids.has(e.mon)));
  if (EPL.plantas.length > 1)
    add(
      "info",
      `${sin.length} canalización${sin.length > 1 ? "es" : ""} vertical${sin.length > 1 ? "es" : ""} sin su par en otra planta`,
      sin.map(e => e.id),
      "Clic derecho › Crear montante: pone la bajada (o la subida) en la otra planta y las une."
    );
}

/* ---------- Áreas para el cálculo ----------
   Cuatro formas de marcarlas: clic dentro de un ambiente (se detecta su contorno), clic dentro del edificio (su
   contorno exterior), por puntos o con un rectángulo. Cada área es una polilínea cerrada en la capa E-AREAS con su
   tipo (techada, contorno exterior, sótano, libre, aulas) y el nombre del ambiente; su piso es el de la planta
   encuadrada donde está. No se imprime en las láminas. */
const DP_PISOS = [
  [0, "Sótano"],
  ...Array.from({ length: 12 }, (v, i) => [i + 1, `${ORD(i + 1)} piso`]),
  [-1, "No se cuenta"]
];
const dpNomPiso = n => (DP_PISOS.find(([v]) => v === n) || [0, n + "° piso"])[1];
// Tipo de un área nueva: el contorno exterior en otros usos (Regla 050-210); si no, techada (Regla 050-110)
const dpAreaTipo = ext => (ext ? "ext" : "tech");
// Nombre del ambiente al terminar un área; luego queda elegida para ver o cambiar su tipo
function dpAreaNueva(el) {
  DS_SEL.clear();
  DS_SEL.add(el.id);
  edCambio();
  plPedir(el.ar.tp === "ext" ? "Nombre (opcional)" : "Ambiente", el.ar.tp === "ext" ? "Contorno exterior" : "", v => {
    plPedir(null);
    if (v) el.ar.n = String(v).replace(/[<>]/g, "").slice(0, 60);
    edCambio();
    plOrden();
    toast(`${el.ar.n || "Área"}: ${fmt(dsM2(el), 2)} m² · ${PL_TAREA[el.ar.tp].toLowerCase()}`);
  });
}
// Capas que no son muros al buscar un contorno: cotas, ejes, muebles y textos
const DP_NO_MURO = /cota|dimens|^ejes?$|^a-?anno|mobil|muebl|texto|^text/i;
// Huecos (puertas y vanos) que se cierran al buscar el contorno, en m (criterio, se puede cambiar)
let DP_HUECO = 1.0;
/* Contorno de un ambiente (o del edificio, ext) alrededor del punto p, sobre las líneas visibles de la
   arquitectura: se dibujan en una cuadrícula fina, se cierran los huecos de hasta DP_HUECO m, se rellena desde el
   punto y se saca el borde. Devuelve { pts } (polígono en el dibujo) o { err }. */
function dpAreaDetectar(p, ext) {
  const f = EPL.f,
    ip = dpPlantaDe(p[0], p[1]),
    mg = 1 / f;
  let [x0, y0, x1, y1] =
    ip >= 0
      ? [EPL.plantas[ip].x0, EPL.plantas[ip].y0, EPL.plantas[ip].x1, EPL.plantas[ip].y1]
      : [...plADib(0, plH()), ...plADib(plW(), 0)];
  x0 -= mg;
  y0 -= mg;
  x1 += mg;
  y1 += mg;
  const cel = Math.max(0.01 / f, Math.sqrt(((x1 - x0) * (y1 - y0)) / 4e6), (x1 - x0) / 4000, (y1 - y0) / 4000),
    W = Math.ceil((x1 - x0) / cel),
    H = Math.ceil((y1 - y0) / cel),
    N = W * H;
  // Líneas visibles de la arquitectura (solo sus bordes: las tramas de piso no tapan el ambiente)
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d", { willReadFrequently: true }),
    oc = new Set(EPL.ocultas);
  g.lineWidth = 1;
  g.strokeStyle = "#000";
  g.beginPath();
  PL_MOD.trazos.forEach(t => {
    // Como al encajar en el muro: solo las líneas continuas (los ejes y las líneas ocultas no cierran ambientes);
    // tampoco las cotas ni los muebles (por su tipo de objeto o el nombre de su capa)
    if (oc.has(t.capa) || PL_BORR.has(t.e) || t.lt || t.ent === "DIMENSION" || DP_NO_MURO.test(t.capa)) return;
    const q = t.p;
    let fuera = true;
    for (let j = 0; j < q.length && fuera; j += 2)
      if (q[j] >= x0 && q[j] <= x1 && q[j + 1] >= y0 && q[j + 1] <= y1) fuera = false;
    if (fuera && q.length < 8) return;
    g.moveTo((q[0] - x0) / cel, H - (q[1] - y0) / cel);
    for (let j = 2; j < q.length; j += 2) g.lineTo((q[j] - x0) / cel, H - (q[j + 1] - y0) / cel);
    if (t.c) g.closePath();
  });
  g.stroke();
  const img = g.getImageData(0, 0, W, H).data,
    muro = new Uint8Array(N);
  for (let i = 0; i < N; i++) muro[i] = img[4 * i + 3] > 40 ? 1 : 0;
  // Dilatación cuadrada de r celdas (por filas y por columnas)
  const dilatar = (src, r) => {
    const a = new Uint8Array(N),
      b = new Uint8Array(N);
    for (let y = 0; y < H; y++) {
      let c = 0;
      const o = y * W;
      for (let x = 0; x < Math.min(r, W); x++) c += src[o + x];
      for (let x = 0; x < W; x++) {
        if (x + r < W) c += src[o + x + r];
        if (x - r - 1 >= 0) c -= src[o + x - r - 1];
        a[o + x] = c > 0 ? 1 : 0;
      }
    }
    for (let x = 0; x < W; x++) {
      let c = 0;
      for (let y = 0; y < Math.min(r, H); y++) c += a[y * W + x];
      for (let y = 0; y < H; y++) {
        if (y + r < H) c += a[(y + r) * W + x];
        if (y - r - 1 >= 0) c -= a[(y - r - 1) * W + x];
        b[y * W + x] = c > 0 ? 1 : 0;
      }
    }
    return b;
  };
  // Relleno desde unas celdas por las celdas libres; borde: si llegó al borde de la zona
  const rellenar = (libre, semillas) => {
    const out = new Uint8Array(N),
      cola = new Int32Array(N);
    let a = 0,
      b = 0,
      borde = false;
    semillas.forEach(i => {
      if (libre[i] && !out[i]) {
        out[i] = 1;
        cola[b++] = i;
      }
    });
    while (a < b) {
      const i = cola[a++],
        x = i % W,
        y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) borde = true;
      if (x > 0 && libre[i - 1] && !out[i - 1]) (out[i - 1] = 1), (cola[b++] = i - 1);
      if (x < W - 1 && libre[i + 1] && !out[i + 1]) (out[i + 1] = 1), (cola[b++] = i + 1);
      if (y > 0 && libre[i - W] && !out[i - W]) (out[i - W] = 1), (cola[b++] = i - W);
      if (y < H - 1 && libre[i + W] && !out[i + W]) (out[i + W] = 1), (cola[b++] = i + W);
    }
    return { out, borde };
  };
  const cx = Math.floor((p[0] - x0) / cel),
    cy = Math.floor(H - (p[1] - y0) / cel),
    ic = cy * W + cx,
    r0 = Math.max(1, Math.ceil(DP_HUECO / 2 / f / cel));
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return { err: "El punto está fuera de la zona" };
  if (muro[ic]) return { err: "Haga clic dentro del ambiente, no sobre una línea" };
  let R = null;
  // Con huecos grandes, un pasillo angosto queda cerrado: se prueba con huecos menores
  for (const r of [r0, Math.ceil(r0 / 2), Math.ceil(r0 / 4), 1]) {
    const tapado = dilatar(muro, r),
      libre = tapado.map(v => 1 - v);
    if (ext) {
      // Afuera: lo que se alcanza desde el borde de la zona; el edificio es lo demás
      const sem = [];
      for (let x = 0; x < W; x++) sem.push(x, (H - 1) * W + x);
      for (let y = 0; y < H; y++) sem.push(y * W, y * W + W - 1);
      const afuera = dilatar(rellenar(libre, sem).out, r),
        edif = new Uint8Array(N);
      for (let i = 0; i < N; i++) edif[i] = afuera[i] && !muro[i] ? 0 : 1;
      if (!edif[ic]) return { err: "Haga clic dentro del edificio" };
      const q = rellenar(edif, [ic]);
      if (q.borde) return { err: "El edificio llega al borde de la planta encuadrada: agrande el encuadre" };
      R = q.out;
      break;
    }
    if (tapado[ic]) continue;
    const q = rellenar(libre, [ic]);
    if (q.borde) return { err: "abierto" };
    const d = dilatar(q.out, r);
    R = new Uint8Array(N);
    for (let i = 0; i < N; i++) R[i] = d[i] && !muro[i] ? 1 : 0;
    break;
  }
  if (!R) return { err: "El ambiente es muy angosto para detectarlo: dibuje su contorno por puntos" };
  // Borde de la región: aristas de las celdas, encadenadas en lazos; se toma el mayor
  const V = W + 1,
    sig = new Map(),
    add = (a, b) => {
      if (!sig.has(a)) sig.set(a, []);
      sig.get(a).push(b);
    };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!R[y * W + x]) continue;
      if (y === 0 || !R[(y - 1) * W + x]) add(y * V + x + 1, y * V + x);
      if (y === H - 1 || !R[(y + 1) * W + x]) add((y + 1) * V + x, (y + 1) * V + x + 1);
      if (x === 0 || !R[y * W + x - 1]) add(y * V + x, (y + 1) * V + x);
      if (x === W - 1 || !R[y * W + x + 1]) add((y + 1) * V + x + 1, y * V + x + 1);
    }
  let mejor = null,
    mA = 0;
  sig.forEach((l, ini) => {
    while (l.length) {
      const lazo = [ini];
      let v = l.pop();
      for (let k = 0; v !== ini && k < 4 * N; k++) {
        lazo.push(v);
        const s = sig.get(v);
        if (!s || !s.length) break;
        v = s.pop();
      }
      const P = lazo.flatMap(u => [u % V, (u / V) | 0]),
        A = plAreaPol(P);
      if (A > mA) {
        mA = A;
        mejor = P;
      }
    }
  });
  if (!mejor) return { err: "No se encontró el contorno" };
  // Sin puntos alineados y simplificado (Douglas-Peucker, 1 celda)
  const P = [];
  for (let i = 0; i < mejor.length; i += 2) P.push([mejor[i], mejor[i + 1]]);
  const dp = (pts, tol) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let im = 0,
      dm = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L;
      if (d > dm) (dm = d), (im = i);
    }
    return dm > tol ? [...dp(pts.slice(0, im + 1), tol).slice(0, -1), ...dp(pts.slice(im), tol)] : [a, b];
  };
  // El lazo cerrado se parte en su punto más lejano al primero
  let lej = 0;
  P.forEach((q, i) => {
    if (Math.hypot(q[0] - P[0][0], q[1] - P[0][1]) > Math.hypot(P[lej][0] - P[0][0], P[lej][1] - P[0][1])) lej = i;
  });
  const S = [...dp(P.slice(0, lej + 1), 1.01).slice(0, -1), ...dp([...P.slice(lej), P[0]], 1.01).slice(0, -1)];
  if (S.length < 3) return { err: "No se encontró el contorno" };
  return { pts: S.flatMap(([x, y]) => [x0 + x * cel, y0 + (H - y) * cel]), cel: cel * f };
}
function dpAreaClic(p, ext) {
  if (!PL_MOD) return;
  const t0 = performance.now(),
    r = dpAreaDetectar(p, ext);
  if (r.err === "abierto")
    return plPedir(
      "El ambiente no está cerrado. Cerrar huecos de hasta (m)",
      String(+(DP_HUECO + 0.5).toFixed(2)),
      v => {
        plPedir(null);
        const h = parseFloat(String(v).replace(",", "."));
        if (!(h > 0 && h <= 6)) return toast("Escriba un ancho entre 0.1 y 6 m");
        DP_HUECO = h;
        dpAreaClic(p, ext);
      }
    );
  if (r.err) return toast(r.err);
  if (plAreaPol(r.pts) * EPL.f * EPL.f < 0.5)
    return toast(
      "El contorno encontrado es muy pequeño: ¿hizo clic dentro de un mueble, una columna o un símbolo? Haga clic en una parte libre del ambiente u oculte esa capa"
    );
  const capa = DS_SIS.are.capa;
  dsCapa(capa);
  const el = dsAgregar({ t: "lin", pts: r.pts, c: true, capa, ar: { tp: dpAreaTipo(ext) } });
  dpAreaNueva(el);
  console.debug(`Área detectada en ${Math.round(performance.now() - t0)} ms (celda ${fmt(r.cel * 100, 1)} cm)`);
}

/* ---------- Ver elementos: los elige y los muestra en pantalla ---------- */
function dsVerIds(ids) {
  DS_SEL.clear();
  PL_ASEL.clear();
  const D = dsD();
  if (!D) return;
  const has = new Set(ids);
  D.els.forEach(e => has.has(e.id) && DS_SEL.add(e.id));
  const bb = dsSel().map(dsBBox);
  if (bb.length) {
    const x0 = Math.min(...bb.map(q => q[0])),
      y0 = Math.min(...bb.map(q => q[1])),
      x1 = Math.max(...bb.map(q => q[2])),
      y1 = Math.max(...bb.map(q => q[3])),
      m = Math.max(x1 - x0, y1 - y0, 2 / EPL.f) * 0.35;
    plVer(x0 - m, y0 - m, x1 + m, y1 + m);
  }
  edProps();
  plSobreDibujar();
}
// Desde el cálculo: abre el editor (si hace falta, con el plano) y muestra los elementos; o la ventana «Datos
// para el cálculo» (fn)
function edVerEnPlano(ids, fn) {
  if (!PLANO) return toast("El proyecto aún no tiene plano: ábralo en Planos › Editor de diseño");
  if (!ED.abierto) edAbrir();
  let n = 0;
  const ir = () => {
    if (PL_MOD && EPL && dsD()) return fn ? fn() : dsVerIds(ids);
    if (++n < 80) setTimeout(ir, 100);
  };
  setTimeout(ir, 60);
}

/* ---------- Tipos de luminaria del proyecto: L1, L2… con su descripción, potencia, control y uso ---------- */
const LU_VW = ventanaMovil(document.querySelector("#lumDlg .vw"), "jmg-electric-luminarias", {
  w: 880,
  h: 420,
  minW: 560,
  minH: 260
});
function lumAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("lumDlg").hidden = false;
  vwFondo();
  LU_VW.abrir();
  lumRender();
}
function lumCerrar() {
  $("lumDlg").hidden = true;
  vwFondo();
}
/* Biblioteca de luminarias de uso común hoy, con potencias típicas del mercado (criterio de la plataforma: se
   reemplazan con las de la ficha técnica del fabricante): [descripción, W, control, uso] */
const LU_BIB = [
  [
    "Vivienda",
    [
      ["Foco LED A60", 9],
      ["Foco LED A60", 12],
      ["Foco LED A70", 15],
      ["Dicroico LED GU10", 5],
      ["Dicroico LED MR16", 7],
      ["Spot LED empotrado", 7],
      ["Spot LED empotrado orientable", 12],
      ["Panel LED redondo empotrado", 12],
      ["Panel LED redondo empotrado", 18],
      ["Panel LED cuadrado adosado", 18],
      ["Plafón LED", 24],
      ["Lámpara colgante decorativa (3 × 9 W)", 27],
      ["Lámpara de pie o de mesa (tomacorriente)", 9],
      ["Aplique o braquete de pared LED", 10],
      ["Luminaria para gradas o escalón LED", 3],
      ["Luminaria LED con sensor de presencia", 12, "sensor"],
      ["Espejo de baño con luz LED", 15],
      ["Tira LED (5 m × 10 W/m)", 50],
      ["Ventilador de techo con luz LED", 20]
    ]
  ],
  [
    "Oficinas y comercio",
    [
      ["Panel LED 60 × 60 cm", 40],
      ["Panel LED 30 × 120 cm", 40],
      ["Downlight LED comercial", 18],
      ["Downlight LED comercial", 24],
      ["Luminaria lineal LED suspendida", 40],
      ["Luminaria lineal LED de sobreponer", 36],
      ["Proyector LED en riel", 30],
      ["Tubo LED T8 de 1.20 m", 18],
      ["Luminaria hermética IP65 (2 × 18 W)", 36],
      ["Panel LED con sensor de presencia (pasillos)", 18, "sensor"],
      ["Luminaria de vitrina LED", 10],
      ["Panel LED regulable (atenuador)", 40, "dimmer"]
    ]
  ],
  [
    "Industrial y almacenes",
    [
      ["Campana LED (high bay)", 100],
      ["Campana LED (high bay)", 150],
      ["Campana LED (high bay)", 200],
      ["Luminaria lineal industrial LED", 60],
      ["Luminaria hermética IP65 de 1.50 m", 50],
      ["Luminaria a prueba de explosión LED", 60]
    ]
  ],
  [
    "Exteriores",
    [
      ["Reflector LED", 30],
      ["Reflector LED", 50],
      ["Reflector LED", 100],
      ["Reflector LED con sensor de movimiento", 30, "sensor"],
      ["Braquete de exterior LED IP65", 12],
      ["Braquete de exterior con fotocelda", 12, "foto"],
      ["Poste de jardín LED", 10],
      ["Estaca de jardín LED", 7],
      ["Empotrado de piso LED", 5],
      ["Luminaria de piscina LED (12 V)", 18],
      ["Alumbrado de vía LED", 60, "foto"],
      ["Alumbrado de vía LED", 100, "foto"],
      ["Luminaria de fachada LED (wall washer)", 24]
    ]
  ],
  [
    "Emergencia y señalización",
    [
      ["Equipo de alumbrado de emergencia LED (2 faros)", 4, "", "emer"],
      ["Luminaria de emergencia LED empotrada", 3, "", "emer"],
      ["Luminaria de emergencia LED adosada", 3, "", "emer"],
      ["Señalización «Salida» LED", 3, "", "senal"],
      ["Señalización «Salida» con flecha LED", 3, "", "senal"],
      ["Señalización de ruta de evacuación LED", 3, "", "senal"]
    ]
  ],
  [
    "Control",
    [
      ["Luminaria con temporizador (pasillos, escaleras)", 12, "temp"],
      ["Luminaria con fotocelda (cocheras)", 18, "foto"]
    ]
  ]
];
let LU_VERBIB = false;
function luBibHTML() {
  const q = ($("luBusca") && $("luBusca").value.trim().toLowerCase()) || "";
  return LU_BIB.map(([g, L]) => {
    const it = L.map((x, i) => [x, i]).filter(([x]) => !q || x[0].toLowerCase().includes(q));
    return it.length
      ? `<div class="lu-bg"><b>${g}</b>${it
          .map(
            ([x, i]) =>
              `<button type="button" class="lu-bi" data-lu-bib="${LU_BIB.findIndex(([gg]) => gg === g)}|${i}" title="Agregar como tipo nuevo">${esc(x[0])}<em>${x[1]} W${x[2] ? " · " + DS_CTRL[x[2]].toLowerCase() : ""}</em></button>`
          )
          .join("")}</div>`
      : "";
  }).join("");
}
function lumRender() {
  const D = dsD(),
    L = D.lums || [],
    uso = {};
  D.els.forEach(e => e.lt && (uso[e.lt] = (uso[e.lt] || 0) + 1));
  const sel = dsSel().filter(e => dsClase(e) === "al").length,
    op = (o, v) =>
      Object.entries(o)
        .map(([k, n]) => `<option value="${k}"${k === (v || "") ? " selected" : ""}>${esc(n)}</option>`)
        .join("");
  $("luBib").hidden = !LU_VERBIB;
  if (LU_VERBIB) $("luBibL").innerHTML = luBibHTML();
  $("luLista").innerHTML = L.length
    ? `<div class="lu-fila lu-cab"><span>Tipo</span><span>Descripción</span><span>Potencia</span><span>Control</span><span>Uso</span><span>En el plano</span><span></span></div>` +
      L.map(
        (t, i) =>
          `<div class="lu-fila"><b>${t.id}</b><input type="text" data-lu-k="n" data-i="${i}" value="${esc(t.n)}" list="luSug" maxlength="60" placeholder="Descripción: panel LED, dicroico…" aria-label="Descripción del tipo ${t.id}"><span class="tc-u"><input type="number" data-lu-k="w" data-i="${i}" value="${t.w || ""}" min="0" step="1" placeholder="0" aria-label="Potencia del tipo ${t.id}"><em>W</em></span><select data-lu-k="ctrl" data-i="${i}" aria-label="Control">${op(DS_CTRL, t.ctrl)}</select><select data-lu-k="emer" data-i="${i}" aria-label="Uso">${op(DS_EMER, t.emer)}</select><span class="lu-uso">${uso[t.id] || 0} luminaria${uso[t.id] === 1 ? "" : "s"}${sel ? ` · <button type="button" class="linkbtn" data-lu-asig="${i}" title="Pone este tipo a las ${sel} luminarias elegidas">asignar</button>` : ""}</span><button type="button" class="vw-btn" data-lu-x="${i}" title="Quitar el tipo (las luminarias quedan sin tipo)" aria-label="Quitar el tipo ${t.id}">×</button></div>`
      ).join("")
    : '<p class="rev-ok">Aún no hay tipos. Agregue uno por cada luminaria distinta del proyecto: dicroico, panel, gradas, con sensor, emergencia…</p>';
}
$("lumDlg").addEventListener("click", e => {
  if (e.target.id === "lumDlg") return lumCerrar();
  const b = e.target.closest("[data-lu]"),
    x = e.target.closest("[data-lu-x]"),
    a = e.target.closest("[data-lu-asig]"),
    D = dsD();
  if (b && b.dataset.lu === "cerrar") return lumCerrar();
  if (b && b.dataset.lu === "max") return LU_VW.maximizar();
  if (b && b.dataset.lu === "bib") {
    LU_VERBIB = !LU_VERBIB;
    lumRender();
    if (LU_VERBIB) $("luBusca").focus();
    return;
  }
  const bi = e.target.closest("[data-lu-bib]");
  if (bi) {
    const [gi, ii] = bi.dataset.luBib.split("|").map(Number),
      [n, w, ctrl, emer] = LU_BIB[gi][1][ii],
      L = (D.lums = D.lums || []);
    let k = 1;
    while (L.some(t => t.id === "L" + k)) k++;
    L.push({ id: "L" + k, n, w, ...(ctrl ? { ctrl } : {}), ...(emer ? { emer } : {}) });
    edCambio();
    lumRender();
    return toast(`L${k} · ${n} · ${w} W (potencia típica: verifique la del fabricante)`);
  }
  if (b && b.dataset.lu === "nuevo") {
    const L = (D.lums = D.lums || []);
    let k = 1;
    while (L.some(t => t.id === "L" + k)) k++;
    L.push({ id: "L" + k, n: "", w: 0 });
    edCambio();
    lumRender();
    const i = $("luLista").querySelector(`[data-lu-k="n"][data-i="${L.length - 1}"]`);
    if (i) i.focus();
    return;
  }
  if (x) {
    const t = D.lums[+x.dataset.luX];
    D.els.forEach(el => el.lt === t.id && delete el.lt);
    D.lums.splice(+x.dataset.luX, 1);
    if (!D.lums.length) delete D.lums;
    edCambio();
    lumRender();
    return toast(`Tipo ${t.id} quitado`);
  }
  if (a) {
    const t = D.lums[+a.dataset.luAsig],
      s = dsSel().filter(el => dsClase(el) === "al");
    s.forEach(el => (el.lt = t.id));
    edCambio();
    lumRender();
    toast(`Tipo ${t.id} en ${s.length} luminaria${s.length > 1 ? "s" : ""}`);
  }
});
$("lumDlg").addEventListener("input", e => {
  if (e.target.id === "luBusca") $("luBibL").innerHTML = luBibHTML();
});
$("lumDlg").addEventListener("change", e => {
  const c = e.target.closest("[data-lu-k]");
  if (!c) return;
  const t = dsD().lums[+c.dataset.i],
    k = c.dataset.luK,
    v = c.value;
  if (k === "n") t.n = v.replace(/[<>]/g, "").trim().slice(0, 60);
  else if (k === "w") t.w = Math.max(0, Math.min(100000, parseFloat(v) || 0));
  else if (v) t[k] = v;
  else delete t[k];
  edCambio();
});
$("lumDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    lumCerrar();
  }
  e.stopPropagation();
});

/* ---------- Datos del diseño para el cálculo (planoCalc, js/calculo-plano.js) ---------- */
const DC_VW = ventanaMovil(document.querySelector("#dcDlg .vw"), "jmg-electric-datos-calculo", {
  w: 1000,
  h: 600,
  minW: 520,
  minH: 320
});
// Qué hacer con cada aviso
const DC_AYUDA = {
  pot: "Escriba su potencia en Propiedades (o la de su tipo de luminaria).",
  ruta: "Únalas con tuberías desde la salida del tablero: la longitud se mide por el recorrido.",
  tipo: "Doble clic en el tablero y elija el tipo de cada circuito.",
  nom: "Los tableros del plano se llaman como en el cálculo: TG, TD-1, TD-2…",
  ali: "Dibuje una tubería desde el medidor hasta el TG (clic en el TG › Alimentador).",
  sis: "Elija el sistema del tablero (doble clic) o cambie el suministro del proyecto.",
  area: "Encuadre la planta que contiene el área, o márquela dentro de ella."
};
// Nombres de los tableros del cálculo (vivienda y otros usos): TG y, con pisos, el TD de cada uno
function dcNomsCalc() {
  if (MODE === "multi") return ["TG", "TSG", ...tipos.map(t => "TD-" + (t.nombre || "").replace(/^Tipo\s*/i, ""))];
  const td = pisos.length && PROY.esqPisos === "td";
  return ["TG", ...(td ? ["TD-1"] : []), ...pisos.map((_, i) => tabPiso(i + 2))];
}
// Datos del diseño que está en el editor (con los cambios aún sin aplicar)
function dcDatos() {
  const c = ctx(estado()),
    n = k => parseFloat(PROY[k]) || 0,
    R = planoCalc({ f: EPL.f, plantas: EPL.plantas, dis: dsD() }, c, {
      al_p: n("al_p"),
      tg_p: n("tg_p"),
      tc_p: n("tc_p"),
      hEnt: n("hEnt") || 3.1
    }),
    noms = dcNomsCalc();
  // En el edificio, los tableros de departamento se reconocen por su tipo (ventana Tablero), no por el nombre
  if (R && MODE === "uni")
    R.tabs
      .filter(t => t.circs.length && !noms.includes(t.nom))
      .forEach(t =>
        R.avisos.push({
          t: "aviso",
          m: `El tablero ${t.nom} no está en el cálculo (${noms.join(", ")})`,
          ids: [t.id],
          k: "nom"
        })
      );
  return { R, noms, c };
}
// Avisos para la revisión del diseño (solo si el diseño tiene tableros con circuitos)
function dcAvisos() {
  if (!EPL || !dsD() || !dsD().els.some(e => (e.k === "tab" && e.nc) || e.ar)) return [];
  return dcDatos().R.avisos;
}
function dcAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("dcDlg").hidden = false;
  vwFondo();
  DC_VW.abrir();
  dcRender();
}
function dcCerrar() {
  $("dcDlg").hidden = true;
  vwFondo();
}
let DC_AV = [];
function dcRender() {
  if ($("dcDlg").hidden) return;
  const { R, noms } = dcDatos(),
    usa = PROY.calPlano === "1",
    sucio = edSnap() !== ED.base,
    // ΔV del último cálculo (solo si el cálculo ya usa este diseño)
    L = usa && !sucio && LAST && LAST.plano ? LAST : null,
    m = v => fmt(v, 2),
    ver = (ids, t = "Ver") =>
      ids && ids.length ? `<button type="button" class="vw-btn" data-dcv="${ids.join(",")}">${t}</button>` : "";
  $("dcUsar").value = usa ? "1" : "";
  $("dcEst").innerHTML = !usa
    ? "El cálculo usa los datos escritos: elija «Sí» para calcular con este diseño."
    : sucio
      ? `El cálculo usa el diseño aplicado: <button type="button" class="linkbtn" data-dc="aplicar">aplique los cambios</button> para actualizarlo.`
      : "El cálculo usa este diseño.";
  let h = "";
  const tabs = R ? R.tabs : [];
  if (!tabs.length)
    h +=
      '<p class="rev-ok">El diseño aún no tiene tableros. Ponga el tablero (Biblioteca › Tableros y medición), defina sus circuitos con doble clic y saque las tuberías desde sus salidas.</p>';
  tabs.forEach(tb => {
    const dep = MODE === "multi" && Number.isInteger(tb.dep) ? tipos[tb.dep] : null,
      en = dep || noms.includes(tb.nom),
      dm = R.desdeMed[tb.id];
    h += `<h4>${esc(tb.nom)}${tb.fs ? ` <small>${tb.fs === 3 ? "trifásico" : "monofásico"}</small>` : ""}<small class="${en ? "" : "bad"}">${dep ? `departamento ${esc(dep.nombre || "")}` : en ? "en el cálculo" : MODE === "multi" ? "elija su tipo de departamento con doble clic" : `no está en el cálculo (${noms.join(", ")})`}</small>${dm && tb.nom !== "TG" ? `<small>desde el medidor: ${m(dm.L)} m</small>` : ""} ${ver([tb.id])}</h4>`;
    if (!tb.circs.length) {
      h += '<p class="dc-nota">Sin circuitos con carga: defina sus circuitos con doble clic y conecte las salidas.</p>';
      return;
    }
    h +=
      `<table class="dc-t"><thead><tr><th>Circuito</th><th>Tipo</th><th>Salidas</th><th>Carga conectada</th><th>Hasta la salida más alejada</th><th>Agrupados</th>${L ? "<th>ΔV total</th>" : ""}</tr></thead><tbody>` +
      tb.circs
        .map(q => {
          const qq = L && L.circ.find(x => x.src && x.src.t === "plano" && x.src.tab === tb.id && x.src.cir === q.cir),
            pd = q.sal.filter(o => o.de === "Parámetros").length,
            tp = [...new Set(q.sal.filter(o => o.de.startsWith("tipo")).map(o => o.de.slice(5)))];
          return `<tr><td><b>${q.cir}</b>${q.desc ? `<small>${esc(q.desc)}</small>` : ""}</td><td>${PL_TCIR[q.tipo]}${q.auto ? "<small>automático</small>" : ""}</td><td class="n"><button type="button" class="linkbtn" data-dcv="${q.sal.map(o => o.id).join(",")}" title="Elige y muestra sus salidas">${q.n}</button></td><td class="n">${fmt(q.P, 0)} W<small>${[pd ? `${pd} con la de Parámetros` : "", tp.length ? `tipo ${tp.join(", ")}` : ""].filter(Boolean).join(" · ")}</small></td><td class="n${q.est ? " bad" : ""}">${q.lej ? `<button type="button" class="linkbtn" data-dcv="${q.lej}" title="Ver la salida más alejada">${m(q.L)} m</button>` : `${m(q.L)} m`}<small>${q.est ? "estimada: hay salidas sin tubería" : `${m(q.Lh)} tubería + ${m(q.Lv)} vertical`}</small></td><td class="n">${q.ng}<small>Tabla 5C: ${fmt(fa5C(q.ng), 2)}</small></td>${L ? `<td class="n ${qq && qq.ok ? "ok" : "bad"}">${qq ? m(qq.dVt) + " %" : "—"}</td>` : ""}</tr>`;
        })
        .join("") +
      "</tbody></table>";
  });
  // Alimentadores
  if (tabs.length) {
    const ali = R.rutas,
      fila = (n, r, alt) =>
        `<tr><td>${n}</td><td class="n">${r ? `${m(r.L)} m<small>${m(r.Lh)} tubería + ${m(r.L - r.Lh)} vertical</small>` : "—"}</td><td>${r ? "del plano" : esc(alt)}</td></tr>`;
    h +=
      `<h4>Alimentadores<small>tuberías marcadas como alimentador, por los montantes</small></h4><table class="dc-t"><thead><tr><th>Tramo</th><th>Longitud</th><th>Origen</th></tr></thead><tbody>` +
      fila(
        MODE === "multi" ? "Medidor o banco → TG (general)" : "Medidor → TG",
        ali.TG,
        `sin tubería del medidor al TG: se usa la escrita (${(MODE === "multi" ? PROY.Lgen : PROY.Lalim) || "—"} m)`
      ) +
      noms
        .filter(n => n !== "TG")
        .map(n => fila(`TG → ${n}`, ali[n], "sin recorrido en el plano: se usa la escrita en Pisos y tableros"))
        .join("") +
      "</tbody></table>";
  }
  // Áreas por piso
  if (R && R.areas.length) {
    const viv = usoAct() === "viv",
      P = Object.keys(R.pisos)
        .map(Number)
        .sort((a, b) => a - b),
      cel = v => (v ? `${fmt(v, 2)} m²` : "—");
    h +=
      `<h4>Áreas<small>${viv ? "vivienda: techadas por dimensiones interiores (Regla 050-110)" : "otros usos: contorno exterior (Regla 050-210)"}</small> ${ver(
        R.areas.map(a => a.id),
        "Ver todas"
      )}</h4><table class="dc-t"><thead><tr><th>Piso</th><th>Techada (interior)</th><th>Contorno exterior</th><th>Aulas o alta intensidad</th><th>Libre no techada</th><th>Para el cálculo</th></tr></thead><tbody>` +
      P.map(n => {
        const o = R.pisos[n],
          usa = n === 0 ? o.sot * 0.75 : viv ? o.tech : o.ext || o.tech;
        return `<tr><td>${dpNomPiso(n)}</td><td class="n">${cel(n === 0 ? o.sot : o.tech)}</td><td class="n">${cel(o.ext)}</td><td class="n">${cel(o.aulas)}</td><td class="n">${cel(o.libre)}</td><td class="n"><b>${n === 0 ? (viv ? `${fmt(o.sot, 2)} × 75 %` : cel(o.sot)) : cel(usa)}</b>${!viv && n > 0 && !o.ext && o.tech ? '<small class="bad">falta el contorno exterior</small>' : ""}</td></tr>`;
      }).join("") +
      "</tbody></table>";
    // Pisos del plano que el cálculo aún no tiene
    const max = Math.max(...P),
      faltan = max - 1 - pisos.length;
    if (faltan > 0 && MODE === "uni")
      h += `<p class="dc-nota">El plano tiene áreas hasta el ${dpNomPiso(max)}; el cálculo tiene ${pisos.length + 1} piso${pisos.length ? "s" : ""}. <button type="button" class="linkbtn" data-dc="pisos">Agregar ${faltan} piso${faltan > 1 ? "s" : ""} al cálculo</button></p>`;
  }
  // Cargas especiales
  if (R && R.cargas.length)
    h +=
      `<h4>Cargas especiales<small>para la máxima demanda (Regla 050-200) y su circuito</small></h4><table class="dc-t"><thead><tr><th>Descripción</th><th>Tipo de carga</th><th>Potencia</th><th>Fases</th><th>Circuito</th><th></th></tr></thead><tbody>` +
      R.cargas
        .map(
          x =>
            `<tr><td>${esc(x.nombre)}</td><td>${esc(TIPOS[x.tipo])}</td><td class="n">${fmt(x.p, 0)} W</td><td>${x.fases === 3 ? "Trifásica" : "Monofásica"}${x.elec ? "<small>con electrónica</small>" : ""}</td><td>${esc(x.tab)} ${x.cir}</td><td>${ver([x.id])}</td></tr>`
        )
        .join("") +
      "</tbody></table>";
  // Avisos
  DC_AV = R ? R.avisos : [];
  if (DC_AV.length)
    h +=
      `<h4>Avisos<small>${DC_AV.length}</small></h4>` +
      DC_AV.map(
        (a, i) =>
          `<div class="rev-it ${a.t === "error" ? "aviso" : "info"}"><i>${a.t === "info" ? "ℹ" : "⚠"}</i><span>${esc(a.m)}<small>${esc(DC_AYUDA[a.k] || "")}</small></span><span class="pla-b"><button type="button" class="vw-btn" data-dca="${i}">Ver</button></span></div>`
      ).join("");
  h += `<p class="dc-nota"><b>Cómo se mide (criterio de la plataforma):</b> el recorrido es el camino más corto por las tuberías del circuito, desde el tablero hasta cada salida, con las derivaciones. Se suman los tramos verticales: la tubería por el techo va a la altura del techo (${m(+PROY.hTecho || 2.9)} m) y la del piso a 0 m; en cada artefacto se sube o se baja hasta su altura de montaje (la suya o la de Parámetros › Alturas) y en el tablero desde su borde superior; la tubería por la pared va a la altura del artefacto donde empieza. Cada montante suma la altura de entrepiso (${m(+PROY.hEnt || 3.1)} m) por piso. La potencia de cada salida es la suya o, si no tiene, la de su tipo de luminaria o la de Parámetros (W por salida). La caída de tensión se calcula con la carga conectada del circuito hasta la salida más alejada (Regla 050-102); la sección es la menor que cumple la capacidad y esa caída. Agrupamiento: cada circuito usa el factor de la Tabla 5C (ítem 1) según el mayor número de circuitos que van juntos en alguna de sus tuberías (entre dos columnas de la tabla, la del número mayor). Áreas: en vivienda se suman las techadas por dimensiones interiores (Regla 050-110) y el sótano al 75 %; en otros usos, el contorno exterior (Regla 050-210); el piso de cada área es el de su planta. Los tableros y pisos que no están dibujados se calculan con los datos escritos.</p>`;
  if (L)
    h += `<p class="dc-nota"><button type="button" class="vw-btn" data-dc="escribir">Escribir en el plano los conductores y diámetros del cálculo</button> Pone en cada tubería sus conductores (fases, neutros y tierra), sus secciones y el diámetro de la tubería según todos los circuitos que lleva (40 % de ocupación). Las tuberías de los interruptores (retornos) quedan como están.</p>`;
  $("dcC").innerHTML = h;
}
/* Conductores y diámetro de cada tubería según el último cálculo con el diseño: suma los de todos los circuitos que
   lleva; en monofásico 220 V los dos conductores son fases, con 380/220 V fase y neutro; una tierra, la mayor */
function dcEscribir() {
  if (!LAST || !LAST.plano) return toast("Primero calcule con el diseño");
  const D = dsD(),
    por = new Map(D.els.map(e => [e.id, e])),
    Q = new Map(LAST.circ.filter(q => q.src && q.src.t === "plano").map(q => [q.src.tab + "|" + q.id, q])),
    n380 = LAST.sk === "tri380";
  let n = 0,
    ret = 0;
  D.els.forEach(t => {
    if (t.t !== "tub" || t.ali || !t.cir || !t.tab) return;
    if ([t.c0, t.c1].some(id => por.get(id) && DS_CAT[por.get(id).k] && DS_CAT[por.get(id).k].g === "Interruptores")) {
      ret++;
      return;
    }
    const qs = [t.cir, ...(t.cx || [])].map(c => Q.get(t.tab + "|" + c)).filter(Boolean);
    if (!qs.length) return;
    let fa = 0,
      ne = 0,
      St = 0,
      a = 0;
    const sec = new Map();
    qs.forEach(q => {
      const f = q.f3 ? 3 : n380 ? 1 : 2,
        nn = n380 ? 1 : 0;
      fa += f;
      ne += nn;
      St = Math.max(St, q.St);
      a += (f + nn) * OD[q.S] ** 2;
      // Conductores de la misma sección, juntos: «4-1×2.5»
      sec.set(q.S, (sec.get(q.S) || 0) + f + nn);
    });
    a = ((a + OD[St] ** 2) * Math.PI) / 4;
    const tb = TUBOS.find(([, , di]) => a <= (0.4 * Math.PI * di * di) / 4);
    t.cond = { f: Math.min(12, fa), n: Math.min(6, ne), t: true };
    if (tb && DS_DIAS.includes(tb[0])) t.dia = tb[0];
    t.sec = `${[...sec].map(([S, k]) => `${k}-1×${S}`).join(" + ")} + 1×${St} T mm²`;
    n++;
  });
  D.cirt = true;
  edCambio();
  toast(
    `Conductores y diámetros del cálculo en ${n} tubería${n === 1 ? "" : "s"}${ret ? `; ${ret} de interruptores (retornos) quedan como estaban` : ""}`
  );
}
$("dcDlg").addEventListener("click", e => {
  if (e.target.id === "dcDlg") return dcCerrar();
  const b = e.target.closest("[data-dc]"),
    v = e.target.closest("[data-dcv]"),
    a = e.target.closest("[data-dca]");
  if (b && b.dataset.dc === "cerrar") return dcCerrar();
  if (b && b.dataset.dc === "max") return DC_VW.maximizar();
  if (b && b.dataset.dc === "aplicar") {
    edAplicar();
    return dcRender();
  }
  if (b && b.dataset.dc === "escribir") {
    dcEscribir();
    return dcRender();
  }
  if (b && b.dataset.dc === "pisos") {
    // Se agregan con el mismo botón del formulario (el cálculo, el historial y las listas funcionan igual)
    const R = dcDatos().R,
      falta = Math.max(...Object.keys(R.pisos).map(Number)) - 1 - pisos.length;
    for (let i = 0; i < falta; i++) $("add_pisos").click();
    toast(
      `${falta} piso${falta > 1 ? "s" : ""} agregado${falta > 1 ? "s" : ""} al cálculo (Vivienda › Pisos y tableros)`
    );
    return dcRender();
  }
  if (v || a) {
    dcCerrar();
    dsVerIds(v ? v.dataset.dcv.split(",") : DC_AV[+a.dataset.dca].ids);
  }
});
$("dcDlg").addEventListener("change", e => {
  if (e.target.id !== "dcUsar") return;
  // Se escribe en el dato del proyecto como si se eligiera allí: el cálculo y el historial lo toman
  const s = $("calPlano");
  s.value = e.target.value;
  s.dispatchEvent(new Event("input", { bubbles: true }));
  s.dispatchEvent(new Event("change", { bubbles: true }));
  toast(
    e.target.value ? "El proyecto se calcula con el diseño del plano" : "El proyecto se calcula con los datos escritos"
  );
  setTimeout(dcRender, 50);
});
$("dcDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    dcCerrar();
  }
  e.stopPropagation();
});

/* ---------- Bloques propios ---------- */
const DP_BLQ = DP_PRE + "-bloques";
function dpBloques() {
  try {
    return (JSON.parse(localStorage.getItem(DP_BLQ) || "[]") || []).filter(b => b && b.n && Array.isArray(b.els));
  } catch (e) {
    return [];
  }
}
function dpGuardarBloques(L) {
  try {
    localStorage.setItem(DP_BLQ, JSON.stringify(L.slice(0, 100)));
    return true;
  } catch (e) {
    toast("No se pudo guardar: el navegador no tiene espacio");
    return false;
  }
}
// Escala las medidas de un elemento respecto del origen (de unidades del dibujo a metros y al revés)
function dpEscalar(el, k) {
  if (el.pts) el.pts = el.pts.map(v => v * k);
  if (el.a) {
    el.a = el.a.map(v => v * k);
    el.b = el.b.map(v => v * k);
    el.o *= k;
  }
  if (Number.isFinite(el.x)) {
    el.x *= k;
    el.y *= k;
  }
  if (el.ht) el.ht *= k;
  if (el.rad) el.rad *= k;
}
function dpGuardarBloque() {
  const sel = dsSel().filter(dsEditable);
  if (!sel.length) return toast("Elija primero lo que quiere guardar como bloque");
  const bb = sel.map(dsBBox),
    cx = (Math.min(...bb.map(b => b[0])) + Math.max(...bb.map(b => b[2]))) / 2,
    cy = (Math.min(...bb.map(b => b[1])) + Math.max(...bb.map(b => b[3]))) / 2,
    ids = new Set(sel.map(e => e.id));
  plPedir("Nombre del bloque", `Bloque ${dpBloques().length + 1}`, v => {
    plPedir(null);
    const n = String(v).replace(/[<>]/g, "").trim().slice(0, 60);
    if (!n) return toast("Escriba un nombre para el bloque");
    // En metros y con el centro en el origen; sin conexiones hacia fuera del bloque ni montantes
    const els = sel.map(o => {
      const el = JSON.parse(JSON.stringify(o));
      dsTrasladar(el, -cx, -cy);
      dpEscalar(el, EPL.f);
      ["c0", "c1"].forEach(c => {
        if (el[c] && !ids.has(el[c])) delete el[c];
      });
      delete el.mon;
      if (el.t === "tub" && el.c0 !== el.tab) delete el.tab;
      return el;
    });
    const L = dpBloques().filter(b => b.n !== n);
    L.unshift({ n, f: new Date().toISOString(), els });
    if (dpGuardarBloques(L)) toast(`Bloque «${n}» guardado: está en la Biblioteca › Mis bloques`);
  });
}
function dpUsarBloque(i) {
  const b = dpBloques()[i];
  if (!b) return;
  bibCerrar();
  DS_SEL.clear();
  plHerr("blq");
  PLH.blq = b;
  plOrden();
}
// Coloca el bloque con su centro en p (sigue la herramienta para colocar más; Esc termina)
function dpColocarBloque(p) {
  const b = PLH.blq;
  if (!b) return;
  const nuevos = dsClonar(b.els, el => {
    dpEscalar(el, 1 / EPL.f);
    dsTrasladar(el, p[0], p[1]);
    dsCapa(el.capa);
  });
  DS_SEL.clear();
  nuevos.forEach(el => DS_SEL.add(el.id));
  edCambio();
}
// Tarjetas de la Biblioteca › Mis bloques
function dpTarjetasBloques(q) {
  const L = dpBloques(),
    w = biNorm(q || "");
  const ks = L.map((b, i) => [b, i]).filter(([b]) => !w || biNorm(b.n).includes(w));
  if (!ks.length) return "";
  return (
    `<h4>Mis bloques</h4><div class="bi-lista">` +
    ks
      .map(
        ([b, i]) =>
          `<div class="bi-s" role="button" tabindex="0" data-blq="${i}" title="Insertar «${esc(b.n)}»"><button type="button" class="bi-ed" data-blqx="${i}" title="Eliminar el bloque" aria-label="Eliminar el bloque">×</button><svg viewBox="0 0 24 24" class="ds-ico" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="8" height="8"/><circle cx="17" cy="7" r="4"/><path d="M3 15h18v6H3z"/></svg><b>${esc(b.n)}</b><small>${b.els.length} elemento${b.els.length > 1 ? "s" : ""}</small></div>`
      )
      .join("") +
    `</div>`
  );
}

/* ---------- Plantillas ---------- */
const DP_PLA = DP_PRE + "-plantillas";
const DP_NOTAS = "Diseño según el Código Nacional de Electricidad – Utilización y los símbolos de la Norma DGE.";
// Plantillas de partida: juego de láminas y notas por tipo de proyecto (criterio de la plataforma, editable)
const DP_BASE = [
  {
    n: "Vivienda",
    d: "IE-01 alumbrado (tuberías en techo) e IE-02 tomacorrientes (tuberías en piso)",
    lams: [
      {
        num: "IE-01",
        tit: "Instalaciones eléctricas · Alumbrado",
        ocl: ["E-TOMACORRIENTES", "E-TUBERIAS-PISO", "E-FUERZA"]
      },
      {
        num: "IE-02",
        tit: "Instalaciones eléctricas · Tomacorrientes y fuerza",
        ocl: ["E-ALUMBRADO", "E-TUBERIAS-TECHO"]
      }
    ],
    notas: `${DP_NOTAS}\nTuberías de PVC empotradas: alumbrado por techo y tomacorrientes por piso.\nTomacorrientes con conductor de protección (tierra).`
  },
  {
    n: "Oficina",
    d: "IE-01 alumbrado, IE-02 tomacorrientes, IE-03 comunicaciones",
    lams: [
      {
        num: "IE-01",
        tit: "Instalaciones eléctricas · Alumbrado",
        ocl: ["E-TOMACORRIENTES", "E-TUBERIAS-PISO", "E-COMUNICACIONES"]
      },
      {
        num: "IE-02",
        tit: "Instalaciones eléctricas · Tomacorrientes",
        ocl: ["E-ALUMBRADO", "E-TUBERIAS-TECHO", "E-COMUNICACIONES"]
      },
      { num: "IE-03", tit: "Comunicaciones · Datos y telefonía", ocl: ["E-ALUMBRADO", "E-TOMACORRIENTES", "E-FUERZA"] }
    ],
    notas: `${DP_NOTAS}\nCircuitos de tomacorrientes de cómputo independientes de los de uso general.`
  },
  {
    n: "Local comercial",
    d: "IE-01 alumbrado y emergencia, IE-02 tomacorrientes y fuerza",
    lams: [
      {
        num: "IE-01",
        tit: "Instalaciones eléctricas · Alumbrado y emergencia",
        ocl: ["E-TOMACORRIENTES", "E-TUBERIAS-PISO", "E-FUERZA"]
      },
      {
        num: "IE-02",
        tit: "Instalaciones eléctricas · Tomacorrientes y fuerza",
        ocl: ["E-ALUMBRADO", "E-TUBERIAS-TECHO"]
      }
    ],
    notas: `${DP_NOTAS}\nAlumbrado de emergencia en las rutas de evacuación.`
  }
];
function dpPlantillas() {
  try {
    return (JSON.parse(localStorage.getItem(DP_PLA) || "[]") || []).filter(p => p && p.n);
  } catch (e) {
    return [];
  }
}
// Estilo del proyecto actual (para guardarlo como plantilla)
function dpEstilo(n) {
  const D = dsD();
  return {
    n,
    f: new Date().toISOString(),
    capas: D.capas.map(c => ({ n: c.n, col: c.col, lt: c.lt, gr: c.gr || 0 })),
    ...(D.simb ? { simb: JSON.parse(JSON.stringify(D.simb)) } : {}),
    ...(D.crit ? { crit: { ...D.crit } } : {}),
    lams: laLista().map(l => {
      const o = { ...l };
      delete o.rect;
      delete o.zona;
      return o;
    }),
    escala: D.escala,
    etq: D.etq,
    cirt: !!D.cirt,
    nsal: !!D.nsal
  };
}
// Aplica una plantilla al diseño (con deshacer): capas, símbolos, criterios, láminas y textos
function dpAplicar(p) {
  const D = dsD();
  (p.capas || []).forEach(c => {
    const d = dsCapa(c.n);
    d.col = c.col || d.col;
    d.lt = c.lt || d.lt;
    if (c.gr) d.gr = c.gr;
    else delete d.gr;
  });
  if (p.simb) D.simb = JSON.parse(JSON.stringify(p.simb));
  else if (p.capas) delete D.simb;
  if (p.crit) D.crit = { ...p.crit };
  if (p.lams) D.lams = p.lams.map(l => ({ ...l, ...(p.notas && !l.notas ? { notas: p.notas } : {}) }));
  D.lamI = 0;
  if (p.escala) D.escala = p.escala;
  if (p.etq) D.etq = p.etq;
  if ("cirt" in p) p.cirt ? (D.cirt = true) : delete D.cirt;
  if ("nsal" in p) p.nsal ? (D.nsal = true) : delete D.nsal;
  edCambio();
  toast(`Plantilla «${p.n}» aplicada · Ctrl+Z para deshacer`);
}
const PLA_VW = ventanaMovil(document.querySelector("#plaDlg .vw"), "jmg-electric-plantillas", {
  w: 620,
  h: 520,
  minW: 460,
  minH: 320
});
function plaAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("plaDlg").hidden = false;
  vwFondo();
  PLA_VW.abrir();
  plaRender();
}
function plaCerrar() {
  $("plaDlg").hidden = true;
  vwFondo();
}
function plaRender() {
  const U = dpPlantillas(),
    fila = (p, a, x) =>
      `<div class="rev-it info"><i>▤</i><span>${esc(p.n)}<small>${esc(p.d || `Guardada el ${new Date(p.f).toLocaleDateString("es-PE")} · ${(p.lams || []).length} lámina(s)${p.simb ? " · símbolos con criterio" : ""}`)}</small></span><span class="pla-b"><button type="button" class="vw-btn" data-pla="${a}">Aplicar</button>${x ? `<button type="button" class="vw-btn" data-plax="${x}" title="Eliminar">×</button>` : ""}</span></div>`;
  $("plaLista").innerHTML =
    `<h4 class="pla-h">De partida (criterio de la plataforma)</h4>` +
    DP_BASE.map((p, i) => fila(p, "b" + i)).join("") +
    `<h4 class="pla-h">Mis plantillas</h4>` +
    (U.length
      ? U.map((p, i) => fila(p, "u" + i, String(i))).join("")
      : `<p class="bi-vacio">Aún no guardó plantillas. Configure capas, símbolos y láminas a su gusto y guárdelas aquí para sus próximos proyectos.</p>`);
}
$("plaDlg").addEventListener("click", e => {
  if (e.target.id === "plaDlg") return plaCerrar();
  const a = e.target.closest("[data-pla]"),
    x = e.target.closest("[data-plax]"),
    b = e.target.closest("[data-plg]");
  if (e.target.closest('[data-plc="cerrar"]')) return plaCerrar();
  if (a) {
    const v = a.dataset.pla,
      p = v[0] === "b" ? DP_BASE[+v.slice(1)] : dpPlantillas()[+v.slice(1)];
    if (p) dpAplicar(p);
    return plaCerrar();
  }
  if (x) {
    const L = dpPlantillas();
    L.splice(+x.dataset.plax, 1);
    try {
      localStorage.setItem(DP_PLA, JSON.stringify(L));
    } catch (er) {}
    return plaRender();
  }
  if (b) {
    const n = $("plaNom").value.replace(/[<>]/g, "").trim().slice(0, 60);
    if (!n) return toast("Escriba un nombre para la plantilla");
    const L = dpPlantillas().filter(p => p.n !== n);
    L.unshift(dpEstilo(n));
    try {
      localStorage.setItem(DP_PLA, JSON.stringify(L.slice(0, 30)));
      toast(`Plantilla «${n}» guardada`);
    } catch (er) {
      toast("No se pudo guardar: el navegador no tiene espacio");
    }
    $("plaNom").value = "";
    plaRender();
  }
});
$("plaDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    plaCerrar();
  }
  e.stopPropagation();
});

/* ---------- Ruta automática de tuberías ---------- */
// Une con tuberías los artefactos elegidos: desde la salida del tablero (si está elegido) o desde el primero, cada vez
// al artefacto más cercano. Tomacorrientes: por el piso; lo demás: por el techo. No esquiva muros: se ajusta después.
function dpRuta() {
  const sel = dsSel().filter(dsEditable),
    tb = sel.find(e => e.k === "tab"),
    arts = sel.filter(dsConecta);
  if (arts.length < (tb ? 1 : 2)) return toast("Elija los artefactos (y, si quiere, el tablero) que va a unir");
  const piso = arts.every(e => DS_CAT[e.k].g === "Tomacorrientes"),
    h = piso ? "tubP" : "tubT",
    capa = dsCapaPara(h),
    dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const crear = ini => {
    let prev = ini,
      rest = arts.filter(e => e !== ini.el);
    const tubs = [];
    dsCapa(capa);
    while (rest.length) {
      const desde = prev.el ? dsCentroCon(prev.el) : prev.p;
      rest.sort((a, b) => dist(dsCentroCon(a), desde) - dist(dsCentroCon(b), desde));
      const s = rest.shift(),
        p0 = prev.el ? dsBorde(prev.el, ...dsCentroCon(s)) : prev.p,
        p1 = dsBorde(s, p0[0], p0[1]);
      tubs.push(
        dsAgregar({
          t: "tub",
          pts: [...p0, ...p1],
          ...(DSU.curva ? { b: [DS_BUL * (tubs.length % 2 ? -1 : 1)] } : {}),
          modo: piso ? "piso" : "techo",
          capa,
          ...(prev.el ? { c0: prev.el.id } : { c0: ini.tab, tab: ini.tab, cir: ini.cir }),
          c1: s.id
        })
      );
      prev = { el: s };
    }
    DS_SEL.clear();
    tubs.forEach(t => DS_SEL.add(t.id));
    edCambio();
    toast(
      `${tubs.length} tubería${tubs.length > 1 ? "s" : ""} en ${piso ? "piso" : "techo"}: revise el recorrido y curve o mueva los tramos que crucen muros`
    );
  };
  if (tb) {
    if (!tb.nc) return tabAbrir(tb.id);
    return dsElegirSalida(tb, [tb.x, tb.y], o => crear({ p: o.p, tab: tb.id, cir: o.n }));
  }
  crear({ el: arts[0] });
}

/* ---------- Versiones del diseño ---------- */
let DP_COMP = null; // versión con la que se compara: { i, add: Set, cam: Set, quit: [elementos] }
const VER_VW = ventanaMovil(document.querySelector("#verDlg .vw"), "jmg-electric-versiones", {
  w: 620,
  h: 480,
  minW: 460,
  minH: 300
});
function verAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("verDlg").hidden = false;
  vwFondo();
  VER_VW.abrir();
  verRender();
}
function verCerrar() {
  $("verDlg").hidden = true;
  vwFondo();
}
function dpComparar(i) {
  const v = (EPL.vers || [])[i];
  if (!v) return (DP_COMP = null);
  const ant = new Map(v.dis.els.map(e => [e.id, e])),
    act = new Map(dsD().els.map(e => [e.id, e]));
  DP_COMP = {
    i,
    n: v.n,
    add: new Set([...act.keys()].filter(id => !ant.has(id))),
    cam: new Set(
      [...act.keys()].filter(id => ant.has(id) && JSON.stringify(ant.get(id)) !== JSON.stringify(act.get(id)))
    ),
    quit: [...ant.values()].filter(e => !act.has(e.id))
  };
  return DP_COMP;
}
function verRender() {
  const V = EPL.vers || [];
  $("verLista").innerHTML = V.length
    ? V.map((v, i) => {
        const c = dpComparar(i),
          r = `${c.add.size} agregado${c.add.size === 1 ? "" : "s"} · ${c.cam.size} cambiado${c.cam.size === 1 ? "" : "s"} · ${c.quit.length} quitado${c.quit.length === 1 ? "" : "s"} desde entonces`;
        return `<div class="rev-it info"><i>◷</i><span>${esc(v.n)}<small>${new Date(v.f).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })} · ${v.dis.els.length} elementos · ${r}</small></span><span class="pla-b"><button type="button" class="vw-btn" data-ver="c${i}">Comparar</button><button type="button" class="vw-btn" data-ver="r${i}">Restaurar</button><button type="button" class="vw-btn" data-ver="x${i}" title="Eliminar">×</button></span></div>`;
      })
        .reverse()
        .join("")
    : `<p class="bi-vacio">Aún no hay versiones. Guarde una antes de entregar o de hacer cambios grandes: luego podrá ver qué cambió.</p>`;
  DP_COMP = null;
}
$("verDlg").addEventListener("click", e => {
  if (e.target.id === "verDlg") return verCerrar();
  if (e.target.closest('[data-vc="cerrar"]')) return verCerrar();
  if (e.target.closest("[data-vg]")) {
    const n = $("verNom").value.replace(/[<>]/g, "").trim().slice(0, 60) || `Versión ${(EPL.vers || []).length + 1}`;
    EPL.vers = [...(EPL.vers || []), { n, f: new Date().toISOString(), dis: JSON.parse(JSON.stringify(dsD())) }].slice(
      -15
    );
    $("verNom").value = "";
    edCambio();
    toast(`Versión «${n}» guardada con el proyecto`);
    return verRender();
  }
  const b = e.target.closest("[data-ver]");
  if (!b) return;
  const a = b.dataset.ver[0],
    i = +b.dataset.ver.slice(1),
    v = EPL.vers[i];
  if (a === "c") {
    dpComparar(i);
    verCerrar();
    plSobreDibujar();
    toast(`Comparando con «${v.n}»: verde agregado, naranja cambiado, rojo quitado · Esc para dejar de comparar`);
  } else if (a === "r")
    confirmar(
      "¿Restaurar esta versión?",
      `<p>El diseño eléctrico vuelve a como estaba en <b>${esc(v.n)}</b>. Puede deshacerlo con Ctrl+Z.</p>`,
      "Restaurar",
      ok => {
        if (!ok) return;
        EPL.dis = JSON.parse(JSON.stringify(v.dis));
        DS_SEL.clear();
        dsAsegurar();
        edCambio();
        verRender();
        toast(`Diseño restaurado a «${v.n}»`);
      }
    );
  else if (a === "x") {
    EPL.vers.splice(i, 1);
    if (!EPL.vers.length) delete EPL.vers;
    edCambio();
    verRender();
  }
});
$("verDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    verCerrar();
  }
  e.stopPropagation();
});

/* ---------- Cuadro de circuitos ----------
   Una tabla por tablero, armada con lo conectado: cada circuito con su descripción, sus salidas (luminarias,
   tomacorrientes y otras), los metros de tubería en techo y en piso, los conductores marcados y el diámetro (los
   más frecuentes en el circuito) y una fila de totales. Medidas en el papel (mm), como la leyenda. */
const DS_CUA = { w: [14, 44, 30, 28, 24, 12], tit: 7, cab: 5, fila: 5.5, txt: 2 };
const dpCond = c => (c ? `${c.f || 0}F${dsNeutros(c) ? "+" + dsNeutros(c) + "N" : ""}${c.t ? "+T" : ""}` : "");
const dpModa = a => {
  const m = new Map();
  a.filter(Boolean).forEach(v => m.set(v, (m.get(v) || 0) + 1));
  return [...m].sort((x, y) => y[1] - x[1])[0]?.[0] || "";
};
// Filas: { tit } (nombre del tablero), { c, d, sal, tub, cond, dia } por circuito y { tot } por tablero
// Se guarda hasta el próximo cambio del diseño (se dibuja en cada cuadro de la pantalla)
const dsFilasCua = () => dpCache("cua", dsFilasCua0);
function dpCache(k, fn) {
  const D = dsD(),
    c = (dpCache.c = dpCache.c || {}),
    v = DS_IDXV + ":" + D.els.length;
  if (!c[k] || c[k].D !== D || c[k].v !== v) c[k] = { D, v, r: fn() };
  return c[k].r;
}
function dsFilasCua0() {
  const D = dsD(),
    out = [],
    f = EPL ? EPL.f : 1,
    // Lo conectado, agrupado por tablero y circuito, en una sola pasada
    grupo = new Map(),
    de = (tab, cir) => {
      const k = tab + "|" + cir;
      if (!grupo.has(k)) grupo.set(k, { arts: [], tubs: [] });
      return grupo.get(k);
    };
  D.els.forEach(e => {
    if (!e.tab || !e.cir) return;
    if (e.t === "tub") de(e.tab, e.cir).tubs.push(e);
    else if (dsConecta(e)) de(e.tab, e.cir).arts.push(e);
  });
  D.els
    .filter(e => e.k === "tab" && e.nc)
    .sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), "es", { numeric: true }))
    .forEach(tb => {
      out.push({ tit: tb.nom || "Tablero" });
      let ts = 0,
        tt = 0,
        tp = 0;
      dsSalidasTab(tb).forEach(o => {
        const { arts, tubs } = grupo.get(tb.id + "|" + o.n) || { arts: [], tubs: [] },
          g = n => arts.filter(e => DS_CAT[e.k].g === n).length,
          l = g("Iluminación"),
          tm = g("Tomacorrientes"),
          ot = arts.length - l - tm,
          mt = tubs.filter(t => t.modo !== "piso").reduce((s, t) => s + dsLargo(t), 0) * f,
          mp = tubs.filter(t => t.modo === "piso").reduce((s, t) => s + dsLargo(t), 0) * f;
        ts += arts.length;
        tt += mt;
        tp += mp;
        out.push({
          c: o.n,
          d: o.d || "",
          sal:
            [l ? l + " alum." : "", tm ? tm + " toma." : "", ot ? ot + " otras" : ""].filter(Boolean).join(" · ") ||
            "—",
          tub: [mt ? fmt(mt, 1) + " T" : "", mp ? fmt(mp, 1) + " P" : ""].filter(Boolean).join(" · ") || "—",
          cond: dpModa(tubs.map(t => dpCond(t.cond))) || "—",
          dia: dpModa(tubs.map(t => t.dia)) || "—"
        });
      });
      out.push({ tot: true, sal: ts + " salidas", tub: fmt(tt + tp, 1) + " m" });
    });
  return out;
}
function dsTamCua() {
  const m = dsMm(1),
    C = DS_CUA,
    n = dsFilasCua().length;
  return [
    C.w.reduce((a, b) => a + b, 0) * m,
    (C.tit + n * C.fila + C.cab * Math.max(1, dsFilasCua().filter(f => f.tit).length)) * m
  ];
}
function dsDibCuadro(g, el, col, s, lw) {
  const m = dsMm(1),
    C = DS_CUA,
    filas = dsFilasCua(),
    W = C.w.reduce((a, b) => a + b, 0),
    P = (a, b) => plAPant(el.x + a * m, el.y - b * m),
    hp = C.txt * m * s,
    xs = C.w.reduce((a, w, i) => (a.push((a[i] || 0) + w), a), [0]);
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
  const texto = (t, a, b, al, peso = "", ancho = 0) => {
    if (hp < 3 || !t) return;
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
  let y = C.tit;
  texto(el.tit || "CUADRO DE CIRCUITOS", W / 2, C.tit / 2, "center", "700 ", W - 4);
  linea(0, C.tit, W, C.tit);
  const cab = ["CIRC.", "DESCRIPCIÓN", "SALIDAS", "TUBERÍA (m)", "CONDUCTORES", "Ø (mm)"];
  filas.forEach(f => {
    if (f.tit) {
      // Encabezado de cada tablero
      texto(`TABLERO ${f.tit}`, 2, y + C.fila / 2, "left", "700 ", W - 4);
      y += C.fila;
      linea(0, y, W, y);
      cab.forEach((t, i) => texto(t, xs[i] + C.w[i] / 2, y + C.cab / 2, "center", "600 ", C.w[i] - 1));
      y += C.cab;
      linea(0, y, W, y);
      return;
    }
    const v = f.tot ? ["", "Total", f.sal, f.tub, "", ""] : [f.c, f.d, f.sal, f.tub, f.cond, String(f.dia)];
    v.forEach((t, i) =>
      texto(
        t,
        i === 1 ? xs[i] + 1.5 : xs[i] + C.w[i] / 2,
        y + C.fila / 2,
        i === 1 ? "left" : "center",
        f.tot ? "600 " : "",
        C.w[i] - 2
      )
    );
    y += C.fila;
    linea(0, y, W, y);
  });
  const H = y;
  const [X0, Y0] = P(0, 0);
  g.strokeRect(X0, Y0, W * m * s, H * m * s);
  // Columnas (desde el primer encabezado)
  for (let i = 1; i < xs.length - 1; i++) linea(xs[i], C.tit + C.fila, xs[i], H);
  g.restore();
}

/* ---------- Caja de paso automática ----------
   Parte la tubería en el medio de su tramo central con una caja (símbolo general, 09-93-08): quedan dos tuberías
   unidas a la caja, con el mismo circuito, conductores y diámetro. Un tramo curvo se parte en dos arcos. */
function dpPonerCaja(id) {
  const D = dsD(),
    t = D.els.find(e => e.id === id);
  if (!t || t.t !== "tub") return;
  const T = dsTramos(t),
    i = Math.floor((T.length - 1) / 2),
    tr = T[i],
    k = tr.k ? Math.tan(Math.atan(tr.k) / 2) : 0,
    n = t.pts.length / 2,
    b = t.b || [],
    comun = {};
  ["t", "modo", "capa", "cir", "tab", "cond", "dia", "col"].forEach(c => t[c] !== undefined && (comun[c] = t[c]));
  const caja = dsAgregar({
    t: "sim",
    k: "caja",
    x: tr.m[0],
    y: tr.m[1],
    r: 0,
    capa: DS_SIS[DS_CAT.caja.s].capa,
    ...(t.cir ? { cir: t.cir } : {}),
    ...(t.tab ? { tab: t.tab } : {})
  });
  dsCapa(caja.capa);
  const a = {
      ...comun,
      pts: [...t.pts.slice(0, 2 * (i + 1)), ...tr.m],
      ...(b.some(Boolean) ? { b: [...b.slice(0, i), k] } : {}),
      ...(t.c0 ? { c0: t.c0 } : {}),
      c1: caja.id
    },
    z = {
      ...comun,
      pts: [...tr.m, ...t.pts.slice(2 * (i + 1), 2 * n)],
      ...(b.some(Boolean) ? { b: [k, ...b.slice(i + 1, n - 1)] } : {}),
      c0: caja.id,
      ...(t.c1 ? { c1: t.c1 } : {})
    };
  if (a.t === "tub" && !a.c0) delete a.tab;
  D.els = D.els.filter(e => e !== t);
  dsAgregar(a);
  dsAgregar(z);
  DS_SEL.clear();
  DS_SEL.add(caja.id);
  edCambio();
  toast("Caja de paso colocada: la tubería quedó en dos, unidas a la caja");
}

/* ---------- Metrado del diseño ----------
   Cantidades leídas del plano (de una planta o de todas): tuberías por recorrido y diámetro, conductores (metros de
   activos —fases y neutros— y de protección, según las marcas de cada tubería), artefactos por tipo, cajas y curvas.
   Sin desperdicios ni empalmes; la sección de los conductores la dará el cálculo. */
const MET_VW = ventanaMovil(document.querySelector("#metDlg .vw"), "jmg-electric-metrado", {
  w: 760,
  h: 600,
  minW: 520,
  minH: 340
});
let MET_PL = -1;
function metAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("metPl").innerHTML =
    `<option value="-1">Todas</option>` +
    EPL.plantas.map((p, i) => `<option value="${i}">${esc(p.n)}</option>`).join("");
  if (MET_PL >= EPL.plantas.length) MET_PL = -1;
  $("metPl").value = String(MET_PL);
  $("metDlg").hidden = false;
  vwFondo();
  MET_VW.abrir();
  metRender();
}
function metCerrar() {
  $("metDlg").hidden = true;
  vwFondo();
}
// Datos del metrado: secciones con filas [descripción, unidad, cantidad]
function metDatos() {
  const D = dsD(),
    f = EPL.f,
    els = MET_PL >= 0 ? D.els.filter(el => dpPlantaEl(el) === MET_PL) : D.els,
    tubs = els.filter(e => e.t === "tub"),
    sec = [];
  // Tuberías por recorrido y diámetro
  const tub = new Map();
  tubs.forEach(t => {
    const k = `Tubería PVC empotrada en ${t.modo === "piso" ? "piso" : t.modo === "pared" ? "pared" : "techo"}${t.dia ? ` · Ø ${t.dia} mm` : " · diámetro sin indicar"}`;
    tub.set(k, (tub.get(k) || 0) + dsLargo(t) * f);
  });
  sec.push(["Tuberías", [...tub].sort().map(([k, v]) => [k, "m", v])]);
  // Conductores
  let act = 0,
    pro = 0,
    sinC = 0;
  tubs.forEach(t => {
    const L = dsLargo(t) * f;
    if (!t.cond) return (sinC += L);
    act += L * ((t.cond.f || 0) + dsNeutros(t.cond));
    if (t.cond.t) pro += L;
  });
  sec.push([
    "Conductores (según las marcas de cada tubería)",
    [
      ["Conductor activo (fases y neutros)", "m", act],
      ["Conductor de protección (tierra)", "m", pro],
      ...(sinC ? [["Tubería sin conductores indicados", "m", sinC]] : [])
    ]
  ]);
  // Artefactos y cajas
  const art = new Map();
  els.forEach(e => {
    if (e.t !== "sim" || !DS_CAT[e.k]) return;
    const k = `${DS_CAT[e.k].n} (${DS_CAT[e.k].c})`;
    art.set(k, (art.get(k) || 0) + 1);
  });
  sec.push(["Artefactos, tableros y cajas", [...art].sort().map(([k, v]) => [k, "und", v])]);
  // Curvas: tramos curvos y quiebres de más de 30°
  let cur = 0;
  tubs.forEach(t => {
    const T = dsTramos(t);
    cur += T.filter(x => x.k).length;
    for (let i = 1; i < T.length; i++) {
      let d = Math.abs(T[i].ang - T[i - 1].ang);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (!T[i].k && !T[i - 1].k && d > Math.PI / 6) cur++;
    }
  });
  sec.push(["Accesorios", [["Curvas en las tuberías (tramos curvos y quiebres de más de 30°)", "und", cur]]]);
  return sec;
}
function metRender() {
  const sec = metDatos(),
    q = (u, v) => (u === "m" ? fmt(v, 2) : String(Math.round(v)));
  $("metC").innerHTML = sec
    .map(
      ([t, filas]) =>
        `<h4>${esc(t)}</h4><table><thead><tr><th>Descripción</th><th>Und.</th><th class="n">Cantidad</th></tr></thead><tbody>${
          filas.length
            ? filas.map(([d, u, v]) => `<tr><td>${esc(d)}</td><td>${u}</td><td class="n">${q(u, v)}</td></tr>`).join("")
            : '<tr><td colspan="3">—</td></tr>'
        }</tbody></table>`
    )
    .join("");
}
function metCsv() {
  const sec = metDatos(),
    c = v => `"${String(v).replace(/"/g, '""')}"`,
    ln = [["Sección", "Descripción", "Und.", "Cantidad"].map(c).join(";")];
  sec.forEach(([t, filas]) =>
    filas.forEach(([d, u, v]) =>
      ln.push([t, d, u, u === "m" ? v.toFixed(2).replace(".", ",") : Math.round(v)].map(c).join(";"))
    )
  );
  const nom = ($("p_nombre").value.trim() || "Proyecto").replace(/[\\/:*?"<>|]/g, "").slice(0, 60);
  descargarLocal(new Blob(["\ufeff" + ln.join("\r\n")], { type: "text/csv" }), `${nom} - metrado del diseño.csv`);
}
$("metDlg").addEventListener("change", e => {
  if (e.target.id === "metPl") {
    MET_PL = +e.target.value;
    metRender();
  }
});
$("metDlg").addEventListener("click", e => {
  if (e.target.id === "metDlg") return metCerrar();
  const b = e.target.closest("[data-met]");
  if (!b) return;
  if (b.dataset.met === "cerrar") metCerrar();
  else if (b.dataset.met === "max") MET_VW.maximizar();
  else if (b.dataset.met === "csv") metCsv();
});
$("metDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    metCerrar();
  }
  e.stopPropagation();
});

/* ---------- Repartir en un ambiente y a lo largo de un muro ----------
   Repartir: dos esquinas del ambiente y filas × columnas (se propone una cantidad con unos 2.5 m entre artefactos,
   criterio editable al escribir); cada artefacto queda en el centro de su parte del ambiente.
   A lo largo del muro: inicio y fin sobre el muro, un clic del lado del ambiente y la cantidad (o «c/3» para cada
   3 m); los de pared se encajan y giran contra el muro. El símbolo: el elegido o el último usado (B cambia). */
function dpIniciarRep(h, k) {
  plHerr(h);
  PLH.repK =
    k ||
    (dsSel()[0] && dsSel()[0].t === "sim" ? dsSel()[0].k : null) ||
    biRecientes()[0] ||
    (h === "rep" ? "luz" : "toma");
  DS_SEL.clear();
  plOrden();
}
function dpOrdenRep(h, n) {
  const c = DS_CAT[PLH.repK] || DS_CAT.luz,
    t =
      h === "rep"
        ? n
          ? "Esquina opuesta del ambiente"
          : "Una esquina del ambiente"
        : n === 0
          ? "Inicio sobre el muro"
          : n === 1
            ? "Fin sobre el muro"
            : "Clic del lado del ambiente";
  return `<b>${h === "rep" ? "Repartir en ambiente" : "A lo largo del muro"}</b> · ${esc(c.n)} · ${t} · <span class="pl-k">B</span> cambia el símbolo · <span class="pl-k">Esc</span> salir`;
}
// Posiciones (y giros) de los artefactos que se van a colocar
function dpPosRep(nf, nc) {
  const P = PLH.pts,
    k = PLH.repK,
    out = [];
  if (PLH.h === "rep") {
    const [a, b] = P,
      x0 = Math.min(a[0], b[0]),
      y0 = Math.min(a[1], b[1]),
      w = Math.abs(b[0] - a[0]),
      hh = Math.abs(b[1] - a[1]);
    for (let i = 0; i < nf; i++)
      for (let j = 0; j < nc; j++)
        out.push({ x: x0 + ((j + 0.5) * w) / nc, y: y0 + hh - ((i + 0.5) * hh) / nf, r: PLH.rot || 0 });
    return out;
  }
  const [a, b, lado] = P,
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    // Del muro hacia el ambiente: el lado del tercer clic
    s = Math.sign((lado[1] - a[1]) * dx - (lado[0] - a[0]) * dy) || 1,
    nx = (-dy / L) * s,
    ny = (dx / L) * s,
    vA = DSU.alinear;
  DSU.alinear = true;
  for (let i = 0; i < nf; i++) {
    const t = (i + 0.5) / nf,
      p = [a[0] + dx * t + (nx * 0.05) / EPL.f, a[1] + dy * t + (ny * 0.05) / EPL.f],
      al = DS_CAT[k] && DS_CAT[k].m ? dsAlinear(k, p) : null;
    out.push(
      al
        ? { x: al.x, y: al.y, r: al.r }
        : { x: p[0], y: p[1], r: Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360) }
    );
  }
  DSU.alinear = vA;
  return out;
}
function dpPuntoRep(p) {
  PLH.pts.push(p);
  const h = PLH.h,
    n = PLH.pts.length;
  if (h === "rep" && n === 2) {
    const [a, b] = PLH.pts,
      w = Math.abs(b[0] - a[0]) * EPL.f,
      hh = Math.abs(b[1] - a[1]) * EPL.f;
    if (w * PLV.s < 0.01 || hh * PLV.s < 0.01) {
      PLH.pts = [];
      return plOrden();
    }
    const nc = Math.max(1, Math.round(w / 2.5)),
      nf = Math.max(1, Math.round(hh / 2.5));
    PLH.repN = [nf, nc];
    plOrden(`<b>Repartir en ambiente</b> · ${fmt(w, 2)} × ${fmt(hh, 2)} m`);
    return plPedir("Filas × columnas (criterio: cada 2.5 m)", `${nf}x${nc}`, v => {
      const m = /^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i.exec(String(v)) || /^\s*(\d+)\s*$/.exec(String(v));
      plPedir(null);
      if (!m) return toast("Escriba filas × columnas, por ejemplo 2x3");
      const f = Math.min(30, Math.max(1, +m[1])),
        c = Math.min(30, Math.max(1, m[2] ? +m[2] : 1));
      dpColocarRep(dpPosRep(f, c));
    });
  }
  if (h === "rmur" && n === 3) {
    const [a, b] = PLH.pts,
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) * EPL.f;
    if (L < 0.05) {
      PLH.pts = [];
      return plOrden();
    }
    const nd = Math.max(1, Math.round(L / 3));
    PLH.repN = [nd, 1];
    plOrden(`<b>A lo largo del muro</b> · ${fmt(L, 2)} m`);
    return plPedir("Cantidad (o c/3 para uno cada 3 m)", String(nd), v => {
      const s = String(v).trim().replace(",", "."),
        m = /^c\s*\/\s*([\d.]+)$/i.exec(s),
        q = m ? Math.max(1, Math.round(L / Math.max(0.2, parseFloat(m[1])))) : parseInt(s, 10);
      plPedir(null);
      if (!(q >= 1)) return toast("Escriba la cantidad (por ejemplo 4) o la separación (por ejemplo c/3)");
      dpColocarRep(dpPosRep(Math.min(100, q), 1));
    });
  }
  plOrden();
  plSobreDibujar();
}
function dpColocarRep(pos) {
  const k = PLH.repK,
    c = DS_CAT[k];
  if (!c) return;
  const capa = DS_SIS[c.s].capa;
  dsCapa(capa);
  DS_SEL.clear();
  pos.forEach(p => DS_SEL.add(dsAgregar({ t: "sim", k, x: p.x, y: p.y, r: p.r || 0, capa }).id));
  PLH.pts = [];
  PLH.repN = null;
  edCambio();
  plOrden();
  toast(`${pos.length} × ${c.n.toLowerCase()} colocados · siga con otro ambiente o Esc para terminar`);
}
// Vista previa: el rectángulo o la línea del muro, y los artefactos donde quedarían
function dpSobreRep(g, q, d) {
  const h = PLH.h;
  if ((h !== "rep" && h !== "rmur") || !q || !PLH.pts.length || !DS_CAT[PLH.repK]) return;
  const gv = PL_OSCURO ? "#8fc1f0" : "#1f6fd6",
    P = PLH.pts;
  g.save();
  g.strokeStyle = gv;
  g.lineWidth = 1.2 * d;
  g.setLineDash([6 * d, 4 * d]);
  const pts = [...P, ...(P.length < (h === "rep" ? 2 : 3) ? [q] : [])],
    [a, b] = [plAPant(...pts[0]), pts[1] ? plAPant(...pts[1]) : null];
  if (h === "rep" && b) g.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  if (h === "rmur" && b) {
    g.beginPath();
    g.moveTo(...a);
    g.lineTo(...b);
    g.stroke();
  }
  g.setLineDash([]);
  // Fantasmas con la cantidad propuesta (o la que se está escribiendo)
  const tmp = PLH.pts;
  if (pts.length >= (h === "rep" ? 2 : 3)) {
    PLH.pts = pts;
    let nf, nc;
    if (h === "rep") {
      const w = Math.abs(pts[1][0] - pts[0][0]) * EPL.f,
        hh = Math.abs(pts[1][1] - pts[0][1]) * EPL.f;
      [nf, nc] = PLH.repN || [Math.max(1, Math.round(hh / 2.5)), Math.max(1, Math.round(w / 2.5))];
      const m = !$("plCmdIn").hidden && /^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i.exec($("plCmdV").value);
      if (m) [nf, nc] = [Math.min(30, +m[1]), Math.min(30, +m[2])];
    } else {
      const L = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) * EPL.f,
        v = !$("plCmdIn").hidden ? $("plCmdV").value.trim() : "",
        m = /^c\s*\/\s*([\d.]+)$/i.exec(v.replace(",", "."));
      nf = m
        ? Math.max(1, Math.round(L / Math.max(0.2, parseFloat(m[1]))))
        : parseInt(v, 10) || (PLH.repN ? PLH.repN[0] : Math.max(1, Math.round(L / 3)));
      nc = 1;
    }
    g.globalAlpha = 0.5;
    dpPosRep(Math.min(100, nf), nc).forEach(p => {
      const [X, Y] = plAPant(p.x, p.y);
      dsDibSim(g, PLH.repK, X, Y, ((p.r || 0) * Math.PI) / 180, dsUk(PLH.repK) * PLV.s, gv, null, plDpr());
    });
  }
  PLH.pts = tmp;
  g.restore();
}

/* ---------- Lienzo superior: bloque que se va a colocar y comparación con una versión ---------- */
function dpSobre(g, q, d) {
  dpSobreRep(g, q, d);
  const gv = PL_OSCURO ? "#8fc1f0" : "#1f6fd6";
  if (PLH.h === "blq" && PLH.blq && q) {
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = gv;
    g.lineWidth = 1.2 * d;
    PLH.blq.els.forEach(el =>
      dsFantasma(
        g,
        el,
        o => {
          dpEscalar(o, 1 / EPL.f);
          dsTrasladar(o, q[0], q[1]);
        },
        gv
      )
    );
    g.restore();
  }
  if (!DP_COMP || !dsD()) return;
  g.save();
  g.lineWidth = 6 * d;
  g.lineCap = g.lineJoin = "round";
  const halo = (el, col) => {
    g.strokeStyle = col;
    if (el.t === "sim")
      dsDibSim(
        g,
        el.k,
        ...plAPant(el.x, el.y),
        ((el.r || 0) * Math.PI) / 180,
        dsUk(el.k) * PLV.s,
        col,
        null,
        6 * d,
        el.dt
      );
    else {
      const b = dsBBox(el),
        [x0, y0] = plAPant(b[0], b[3]),
        [x1, y1] = plAPant(b[2], b[1]);
      if (el.t === "txt" || el.t === "ley") g.strokeRect(x0 - 3 * d, y0 - 3 * d, x1 - x0 + 6 * d, y1 - y0 + 6 * d);
      else {
        g.beginPath();
        dsLineas(el).forEach(p => plRuta(g, p, false));
        g.stroke();
      }
    }
  };
  g.globalAlpha = 0.4;
  dsD().els.forEach(el => {
    if (DP_COMP.add.has(el.id)) halo(el, "#2e9e4f");
    else if (DP_COMP.cam.has(el.id)) halo(el, "#e8890c");
  });
  g.globalAlpha = 0.75;
  g.setLineDash([6 * d, 4 * d]);
  g.lineWidth = 1.5 * d;
  g.strokeStyle = "#d32f2f";
  DP_COMP.quit.forEach(el => dsFantasma(g, el, () => {}, "#d32f2f"));
  g.restore();
  g.font = `600 ${11 * d}px "IBM Plex Sans", Arial, sans-serif`;
  plEtiqueta(
    g,
    `Comparando con «${DP_COMP.n}» · ${DP_COMP.add.size} agregados · ${DP_COMP.cam.size} cambiados · ${DP_COMP.quit.length} quitados · Esc para salir`,
    12 * d,
    plH() - 34 * d,
    "#14304f",
    "left",
    "top"
  );
}
