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
