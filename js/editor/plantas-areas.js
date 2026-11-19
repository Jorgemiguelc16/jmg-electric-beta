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
  // Ambiente: se propone el nombre escrito en el plano dentro del contorno
  const rot = el.ar.tp === "ext" ? null : dpRotuloEn(el.pts);
  plPedir(
    el.ar.tp === "ext" ? "Nombre (opcional)" : "Ambiente",
    el.ar.tp === "ext" ? "Contorno exterior" : rot ? rot.n : "",
    v => {
      plPedir(null);
      if (v) el.ar.n = String(v).replace(/[<>]/g, "").slice(0, 60);
      // Tipo de ambiente por el nombre (se confirma o cambia en Ambientes o en las propiedades)
      if (el.ar.tp !== "ext" && !el.ar.amb) {
        const k = plAmbDe(el.ar.n) || (rot && !v ? rot.amb : "");
        if (k) el.ar.amb = k;
      }
      edCambio();
      plOrden();
      toast(`${el.ar.n || "Área"}: ${fmt(dsM2(el), 2)} m² · ${PL_TAREA[el.ar.tp].toLowerCase()}`);
    }
  );
}
// Capas que no son muros al buscar un contorno: cotas, ejes, muebles y textos
const DP_NO_MURO = /cota|dimens|^ejes?$|^a-?anno|mobil|muebl|texto|^text/i;
// Capas que parecen de muros, columnas, puertas y ventanas (por su nombre, en español o en las normas de capas usuales)
const DP_MURO = /muro|wall|pared|tabiq|column|placa|estruct|divis|puert|door|ventan|window|vidri|glaz|vano|alba[ñn]/i;
/* Capas que cierran los ambientes: las elegidas por el proyectista (EPL.mur) o, si no eligió, las que parecen de
   muros; si ninguna lo parece, null (todas las continuas menos cotas, ejes, muebles y textos) */
function dpCapasMuro() {
  if (Array.isArray(EPL.mur) && EPL.mur.length) return new Set(EPL.mur);
  const c = new Set(PL_MOD.trazos.map(t => t.capa).filter(n => DP_MURO.test(n) && !DP_NO_MURO.test(n)));
  return c.size ? c : null;
}
/* Barrido de las puertas: el arco de la hoja (en una capa o un bloque de puertas) no se usa al buscar el contorno,
   para que el área no pierda ese cuarto de círculo; en su lugar va la puerta cerrada: los dos radios, de la bisagra
   (centro del arco) a cada extremo, y uno de ellos cierra el vano sobre la línea del muro */
const DP_PUERTA = /puert|door|\bptas?\b/i;
const dpEsBarrido = t => t.ent === "ARC" && (DP_PUERTA.test(t.capa) || DP_PUERTA.test(t.bl || ""));
function dpRadiosPuerta(t) {
  const p = t.p,
    n = p.length / 2;
  if (n < 3) return null;
  const m = 2 * Math.floor(n / 2),
    [ax, ay, bx, by, cx, cy] = [p[0], p[1], p[m], p[m + 1], p[p.length - 2], p[p.length - 1]],
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = ax * ax + ay * ay,
    b2 = bx * bx + by * by,
    c2 = cx * cx + cy * cy;
  return [
    (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d,
    (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d,
    ax,
    ay,
    cx,
    cy
  ];
}
// Rectángulo que ocupa cada línea de la arquitectura (se calcula una vez y queda en la línea)
function dpCaja(t) {
  if (t._bb) return t._bb;
  const p = t.p;
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity;
  for (let j = 0; j < p.length; j += 2) {
    if (p[j] < a) a = p[j];
    if (p[j] > c) c = p[j];
    if (p[j + 1] < b) b = p[j + 1];
    if (p[j + 1] > d) d = p[j + 1];
  }
  return (t._bb = [a, b, c, d]);
}
// Huecos (puertas y vanos) que se cierran al buscar el contorno, en m (criterio, se puede cambiar)
let DP_HUECO = 1.0;
/* Contorno de un ambiente (o del edificio, ext) alrededor del punto p, sobre las líneas visibles de la
   arquitectura: se dibujan en una cuadrícula fina, se cierran los huecos de hasta DP_HUECO m, se rellena desde el
   punto y se saca el borde. Devuelve { pts } (polígono en el dibujo) o { err }. cache: objeto que se reusa al
   detectar varios ambientes de la misma zona (guarda la cuadrícula de los muros y sus dilataciones). */
function dpAreaDetectar(p, ext, zona, cache) {
  const f = EPL.f,
    ip = dpPlantaDe(p[0], p[1]),
    mg = 1 / f;
  let [x0, y0, x1, y1] =
    ip >= 0
      ? [EPL.plantas[ip].x0, EPL.plantas[ip].y0, EPL.plantas[ip].x1, EPL.plantas[ip].y1]
      : zona || [...plADib(0, plH()), ...plADib(plW(), 0)];
  x0 -= mg;
  y0 -= mg;
  x1 += mg;
  y1 += mg;
  const cel = Math.max(0.01 / f, Math.sqrt(((x1 - x0) * (y1 - y0)) / 4e6), (x1 - x0) / 4000, (y1 - y0) / 4000),
    W = Math.ceil((x1 - x0) / cel),
    H = Math.ceil((y1 - y0) / cel),
    N = W * H,
    clave = [x0, y0, x1, y1, cel, DP_HUECO].join();
  let muro;
  if (cache && cache.k === clave) muro = cache.muro;
  else {
    // Líneas visibles de la arquitectura (solo sus bordes: las tramas de piso no tapan el ambiente)
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d", { willReadFrequently: true }),
      oc = new Set(EPL.ocultas);
    g.lineWidth = 1;
    g.strokeStyle = "#000";
    g.beginPath();
    const mur = dpCapasMuro();
    PL_MOD.trazos.forEach(t => {
      // Solo las capas de muros (o, sin ellas, las continuas que no son cotas, ejes, muebles ni textos), y solo las
      // líneas que tocan la zona
      if (oc.has(t.capa) || PL_BORR.has(t.e) || t.lt || t.ent === "DIMENSION") return;
      if (mur ? !mur.has(t.capa) : DP_NO_MURO.test(t.capa)) return;
      const [a, b, c, d] = dpCaja(t);
      if (c < x0 || a > x1 || d < y0 || b > y1) return;
      if (dpEsBarrido(t)) {
        const r = dpRadiosPuerta(t);
        if (!r) return;
        g.moveTo((r[2] - x0) / cel, H - (r[3] - y0) / cel);
        g.lineTo((r[0] - x0) / cel, H - (r[1] - y0) / cel);
        g.lineTo((r[4] - x0) / cel, H - (r[5] - y0) / cel);
        return;
      }
      const q = t.p;
      g.moveTo((q[0] - x0) / cel, H - (q[1] - y0) / cel);
      for (let j = 2; j < q.length; j += 2) g.lineTo((q[j] - x0) / cel, H - (q[j + 1] - y0) / cel);
      if (t.c) g.closePath();
    });
    g.stroke();
    const img = g.getImageData(0, 0, W, H).data;
    muro = new Uint8Array(N);
    for (let i = 0; i < N; i++) muro[i] = img[4 * i + 3] > 40 ? 1 : 0;
    if (cache) Object.assign(cache, { k: clave, muro, dil: new Map() });
  }
  // Dilatación cuadrada de r celdas; w = [x0, y0, x1, y1]: solo en esa ventana de celdas (afuera queda en 0)
  const dilatar = (src, r, w) => {
    const a = new Uint8Array(N),
      b = new Uint8Array(N),
      [wx0, wy0, wx1, wy1] = w || [0, 0, W - 1, H - 1];
    for (let y = Math.max(0, wy0 - r); y <= Math.min(H - 1, wy1 + r); y++) {
      let c = 0;
      const o = y * W;
      for (let x = Math.max(0, wx0 - r); x < Math.min(wx0 + r, W); x++) c += src[o + x];
      for (let x = wx0; x <= wx1; x++) {
        if (x + r < W) c += src[o + x + r];
        if (x - r - 1 >= 0) c -= src[o + x - r - 1];
        a[o + x] = c > 0 ? 1 : 0;
      }
    }
    for (let x = wx0; x <= wx1; x++) {
      let c = 0;
      for (let y = Math.max(0, wy0 - r); y < Math.min(wy0 + r, H); y++) c += a[y * W + x];
      for (let y = wy0; y <= wy1; y++) {
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
      borde = false,
      mx0 = W,
      my0 = H,
      mx1 = 0,
      my1 = 0;
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
      if (x < mx0) mx0 = x;
      if (x > mx1) mx1 = x;
      if (y < my0) my0 = y;
      if (y > my1) my1 = y;
      if (x > 0 && libre[i - 1] && !out[i - 1]) (out[i - 1] = 1), (cola[b++] = i - 1);
      if (x < W - 1 && libre[i + 1] && !out[i + 1]) (out[i + 1] = 1), (cola[b++] = i + 1);
      if (y > 0 && libre[i - W] && !out[i - W]) (out[i - W] = 1), (cola[b++] = i - W);
      if (y < H - 1 && libre[i + W] && !out[i + W]) (out[i + W] = 1), (cola[b++] = i + W);
    }
    return { out, borde, caja: [mx0, my0, mx1, my1] };
  };
  const cx = Math.floor((p[0] - x0) / cel),
    cy = Math.floor(H - (p[1] - y0) / cel),
    ic = cy * W + cx,
    r0 = Math.max(1, Math.ceil(DP_HUECO / 2 / f / cel));
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return { err: "El punto está fuera de la zona" };
  if (muro[ic]) return { err: "Haga clic dentro del ambiente, no sobre una línea" };
  let R = null,
    // Ventana de celdas del ambiente (el borde se busca solo ahí)
    V0 = [0, 0, W - 1, H - 1];
  // Con huecos grandes, un pasillo angosto queda cerrado: se prueba con huecos menores
  for (const r of [r0, Math.ceil(r0 / 2), Math.ceil(r0 / 4), 1]) {
    let tapado = cache && cache.dil.get(r);
    if (!tapado) {
      tapado = dilatar(muro, r);
      if (cache) cache.dil.set(r, tapado);
    }
    let libre = cache && cache.lib && cache.lib.get(r);
    if (!libre) {
      libre = tapado.map(v => 1 - v);
      if (cache) (cache.lib = cache.lib || new Map()).set(r, libre);
    }
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
    const [a0, b0, a1, b1] = q.caja;
    V0 = [Math.max(0, a0 - r - 1), Math.max(0, b0 - r - 1), Math.min(W - 1, a1 + r + 1), Math.min(H - 1, b1 + r + 1)];
    const d = dilatar(q.out, r, V0);
    R = new Uint8Array(N);
    for (let y = V0[1]; y <= V0[3]; y++)
      for (let x = V0[0], i = y * W + x; x <= V0[2]; x++, i++) R[i] = d[i] && !muro[i] ? 1 : 0;
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
  for (let y = V0[1]; y <= V0[3]; y++)
    for (let x = V0[0]; x <= V0[2]; x++) {
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
const MU_VW = ventanaMovil(document.querySelector("#murDlg .vw"), "jmg-electric-capas-muros", {
  w: 520,
  h: 520,
  minW: 380,
  minH: 300
});
function murAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  const sel = dpCapasMuro() || new Set(),
    cnt = {};
  PL_MOD.trazos.forEach(t => (cnt[t.capa] = (cnt[t.capa] || 0) + 1));
  $("muLista").innerHTML = Object.keys(cnt)
    .sort((a, b) => sel.has(b) - sel.has(a) || a.localeCompare(b))
    .map(
      n =>
        `<label class="mu-fila"><input type="checkbox" value="${esc(n)}"${sel.has(n) ? " checked" : ""}><span>${esc(n)}</span><em>${cnt[n]} línea${cnt[n] === 1 ? "" : "s"}</em></label>`
    )
    .join("");
  $("muNota").textContent =
    Array.isArray(EPL.mur) && EPL.mur.length ? "Elegidas por usted" : "Elegidas por su nombre (automático)";
  $("murDlg").hidden = false;
  vwFondo();
  MU_VW.abrir();
}
function murCerrar() {
  $("murDlg").hidden = true;
  vwFondo();
}
$("murDlg").addEventListener("click", e => {
  if (e.target.id === "murDlg") return murCerrar();
  const b = e.target.closest("[data-mu]");
  if (!b) return;
  const a = b.dataset.mu;
  if (a === "cerrar") return murCerrar();
  if (a === "auto") {
    delete EPL.mur;
    edCambio();
    murAbrir();
    return toast("Capas de muros: automáticas, por su nombre");
  }
  if (a === "ok") {
    const v = [...$("muLista").querySelectorAll("input:checked")].map(i => i.value);
    if (v.length) EPL.mur = v;
    else delete EPL.mur;
    edCambio();
    murCerrar();
    toast(
      v.length
        ? `${v.length} capa${v.length > 1 ? "s" : ""} de muros para detectar los ambientes`
        : "Capas de muros: automáticas"
    );
  }
});
$("murDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    murCerrar();
  }
  e.stopPropagation();
});
function dpAreaClic(p, ext) {
  if (!PL_MOD) return;
  const t0 = performance.now(),
    r = dpAreaDetectar(p, ext);
  if (r.err === "abierto")
    return plPedir(
      "El ambiente no está cerrado (¿falta la capa de puertas o ventanas en las capas de muros?). Cerrar huecos de hasta (m)",
      String(+(DP_HUECO + 0.5).toFixed(2)),
      v => {
        plPedir(null);
        const h = parseFloat(String(v).replace(",", "."));
        if (!(h > 0 && h <= 6)) return toast("Escriba un ancho entre 0.1 y 6 m");
        DP_HUECO = h;
        dpAreaClic(p, ext);
      }
    );
  if (r.err) return toast(r.err + " · Revise las capas de muros (Áreas › Capas de muros)");
  if (plAreaPol(r.pts) * EPL.f * EPL.f < 0.5)
    return toast(
      "El contorno encontrado es muy pequeño: alguna capa que no es muro corta el ambiente. Revise las capas de muros (Áreas › Capas de muros)"
    );
  const capa = DS_SIS.are.capa;
  dsCapa(capa);
  // Se guarda el punto del clic: si la arquitectura cambia, el área se vuelve a medir desde él
  const el = dsAgregar({ t: "lin", pts: r.pts, c: true, capa, ar: { tp: dpAreaTipo(ext), p: [p[0], p[1]] } });
  dpAreaNueva(el);
  console.debug(`Área detectada en ${Math.round(performance.now() - t0)} ms (celda ${fmt(r.cel * 100, 1)} cm)`);
}
