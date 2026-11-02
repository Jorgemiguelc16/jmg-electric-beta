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

/* ---------- Lienzo superior: bloque que se va a colocar y comparación con una versión ---------- */
function dpSobre(g, q, d) {
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
