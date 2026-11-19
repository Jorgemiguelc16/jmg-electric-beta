/* DISEÑO ELÉCTRICO · REVISIÓN, BIBLIOTECA Y TABLERO
   Revisión del diseño, biblioteca de símbolos de la Norma DGE y ventana Tablero (nombre y circuitos).
   Antes era parte de js/diseno.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Revisión del diseño ----------
   Avisos para un diseño profesional: lo que no está conectado, artefactos y tuberías sin circuito, circuitos con
   más salidas que el criterio, tuberías con más curvas que el criterio entre dos cajas o artefactos, tomacorrientes
   sin conductor de protección marcado, letras de encendido sin interruptor (o sin luminarias) y tableros sin
   circuitos. Los límites son criterios de la plataforma, editables en la ventana; verifíquelos con el CNE. */
// duc: alcance desde la ducha o tina para los interruptores (CNE-U 170-326(3) no da la distancia; criterio: 0.6 m,
// la zona 2 de los baños de la IEC 60364-7-701)
const dsCrit = () => ({ sal: 12, cur: 360, duc: 0.6, ...((dsD() && dsD().crit) || {}) });
// Curvas de una tubería: suma de los cambios de dirección (en los vértices y en los arcos), en grados
function dsGiroTotal(el) {
  const P = dsCurva(el);
  let tot = 0,
    a0 = null;
  for (let i = 2; i < P.length; i += 2) {
    const dx = P[i] - P[i - 2],
      dy = P[i + 1] - P[i - 1];
    if (Math.hypot(dx, dy) < 1e-9) continue;
    const a = Math.atan2(dy, dx);
    if (a0 !== null) {
      let d = Math.abs(a - a0);
      if (d > Math.PI) d = 2 * Math.PI - d;
      tot += d;
    }
    a0 = a;
  }
  return (tot * 180) / Math.PI;
}
function dsVerificar() {
  const D = dsD(),
    out = [];
  if (!D) return out;
  const C = dsCrit(),
    por = new Map(D.els.map(e => [e.id, e])),
    sims = D.els.filter(dsConecta),
    tubs = D.els.filter(e => e.t === "tub" && dsVis(e)),
    s = (n, a, b) => `${n} ${n === 1 ? a : b}`,
    add = (nivel, t, ids, d) => ids.length && out.push({ nivel, t, ids, d });
  const sl = dsSueltos();
  add(
    "aviso",
    s(sl.sims.length, "artefacto sin tubería", "artefactos sin tubería"),
    sl.sims.map(e => e.id),
    "Conéctelos con una tubería a su circuito."
  );
  add(
    "aviso",
    s(sl.puntas.length, "punta de tubería suelta", "puntas de tubería sueltas"),
    [...new Set(sl.puntas.map(o => o.el.id))],
    "Llévelas a un artefacto, a una caja o a la salida del tablero."
  );
  const sinCir = [
    ...sims.filter(e => !e.cir && !["can", "tie"].includes(DS_CAT[e.k].s) && !PL_MED.has(e.k)),
    ...tubs.filter(
      e =>
        !e.cir &&
        !e.ali &&
        ![e.c0, e.c1].some(id => por.get(id) && (PL_MED.has(por.get(id).k) || por.get(id).k === "pat"))
    )
  ];
  add(
    "aviso",
    s(sinCir.length, "elemento sin circuito", "elementos sin circuito"),
    sinCir.map(e => e.id),
    "Empiece las tuberías en una salida del tablero: el circuito pasa solo a lo conectado."
  );
  // Salidas por circuito
  const grupos = new Map();
  sims.forEach(e => {
    if (!e.cir || ["can", "tie"].includes(DS_CAT[e.k].s)) return;
    const k = (e.tab || "") + "|" + e.cir;
    (grupos.get(k) || grupos.set(k, []).get(k)).push(e);
  });
  grupos.forEach((l, k) => {
    if (l.length <= C.sal) return;
    const tb = por.get(k.split("|")[0]);
    add(
      "aviso",
      `${l[0].cir}${tb && tb.nom ? " de " + tb.nom : ""}: ${l.length} salidas`,
      l.map(e => e.id),
      `Más de ${C.sal} salidas en un circuito (criterio): considere dividirlo.`
    );
  });
  // Curvas entre cajas
  tubs.forEach(t => {
    const g = dsGiroTotal(t);
    if (g > C.cur + 0.5)
      add(
        "aviso",
        `Tubería${t.cir ? " de " + t.cir : ""} con ${Math.round(g)}° de curvas`,
        [t.id],
        `Más de ${C.cur}° entre dos cajas o artefactos (criterio; verifique la regla del CNE): ponga una caja de paso.`
      ) && (out[out.length - 1].caja = t.id);
  });
  // Tuberías repetidas entre los mismos dos puntos: se juntan en una que lleva todos los circuitos
  dsTubRepetidas().forEach(g => {
    const tb = por.get(g[0].tab);
    add(
      "aviso",
      `${[...new Set(g.flatMap(t => [t.cir, ...(t.cx || [])]))].join(" y ")}${tb && tb.nom ? " de " + tb.nom : ""}: ${g.length} tuberías entre los mismos puntos`,
      g.map(t => t.id),
      "Júntelas en una sola tubería que lleve todos los circuitos (Lleva también): el cálculo aplica la Tabla 5C."
    ) && (out[out.length - 1].juntar = g.map(t => t.id).join(","));
  });
  // Tomacorrientes sin conductor de protección marcado
  const sinT = tubs.filter(
    t =>
      t.cond &&
      !t.cond.t &&
      [t.c0, t.c1].some(id => por.get(id) && DS_CAT[por.get(id).k] && DS_CAT[por.get(id).k].g === "Tomacorrientes")
  );
  add(
    "aviso",
    s(
      sinT.length,
      "tubería de tomacorrientes sin conductor de protección",
      "tuberías de tomacorrientes sin conductor de protección"
    ),
    sinT.map(e => e.id),
    "Marque la tierra (T) en sus conductores."
  );
  // Encendidos
  const luz = new Map(),
    intr = new Map();
  D.els.forEach(e => {
    if (!e.enc || !dsConEnc(e)) return;
    const m = dsEsInt(e) ? intr : luz;
    // Un interruptor doble o triple enciende cada letra de sus teclas
    dsLetras(e).forEach(l => (m.get(l) || m.set(l, []).get(l)).push(e));
  });
  luz.forEach((l, k) => {
    if (!intr.has(k))
      add(
        "aviso",
        `Encendido «${k}» sin interruptor`,
        l.map(e => e.id),
        `Ponga la letra «${k}» al interruptor que enciende estas luminarias.`
      );
  });
  intr.forEach((l, k) => {
    if (!luz.has(k))
      add(
        "info",
        `Interruptor «${k}» sin luminarias`,
        l.map(e => e.id),
        `Ninguna luminaria tiene la letra «${k}».`
      );
  });
  // Tableros
  D.els.forEach(tb => {
    if (tb.k !== "tab" || !dsVis(tb) || tb.gen) return;
    if (!tb.nc)
      return add(
        "aviso",
        `${tb.nom || "Tablero"} sin circuitos`,
        [tb.id],
        "Doble clic en el tablero para definir sus circuitos."
      );
    const usados = new Set(tubs.filter(t => t.c0 === tb.id).map(t => t.cir)),
      libres = dsSalidasTab(tb)
        .filter(o => !usados.has(o.n))
        .map(o => o.n);
    if (libres.length)
      add(
        "info",
        `${tb.nom || "Tablero"}: ${libres.join(", ")} sin tubería`,
        [tb.id],
        "Salidas del tablero que aún no tienen tubería (o reservas)."
      );
  });
  // Tuberías sin conductores indicados
  const sinCond = tubs.filter(t => !t.cond);
  add(
    "info",
    s(sinCond.length, "tubería sin conductores indicados", "tuberías sin conductores indicados"),
    sinCond.map(e => e.id),
    "Clic en el medio de la tubería para elegir sus conductores."
  );
  dpVerificar(add);
  // Reglas de seguridad del CNE-Utilización por ambiente (baños, lavandería, escaleras, circuitos independientes)
  dpVerifNorma(add);
  // Datos para el cálculo: salidas sin potencia o sin recorrido, circuitos mezclados, tableros que no coinciden
  dcAvisos().forEach(a => {
    if (a.t === "info") return;
    // Un tablero que no está en el cálculo deja sus salidas sin calcular: es un aviso, con su botón «Renombrar»
    add(a.t === "error" || a.k === "nom" ? "aviso" : "info", a.m, a.ids.length ? a.ids : ["-"], DC_AYUDA[a.k] || "") &&
      a.ren &&
      (out[out.length - 1].ren = { id: a.ids[0], nom: a.ren });
  });
  // Primero lo de seguridad, luego los avisos y al final las notas
  const ord = { seg: 0, aviso: 1, info: 2 };
  return out.sort((a, b) => ord[a.nivel] - ord[b.nivel]);
}
const REV_VW = ventanaMovil(document.querySelector("#revDlg .vw"), "jmg-electric-revision", {
  w: 620,
  h: 520,
  minW: 420,
  minH: 280
});
let REV_L = [];
function revAbrir() {
  if (!dsD()) return;
  $("revDlg").hidden = false;
  vwFondo();
  REV_VW.abrir();
  revRender();
}
function revCerrar() {
  $("revDlg").hidden = true;
  vwFondo();
}
function revRender() {
  if ($("revDlg").hidden) return;
  const C = dsCrit();
  $("revSal").value = C.sal;
  $("revCur").value = C.cur;
  $("revDuc").value = C.duc;
  REV_L = dsVerificar();
  const av = REV_L.filter(o => o.nivel === "aviso").length,
    sg = REV_L.filter(o => o.nivel === "seg").length;
  $("revLista").innerHTML = REV_L.length
    ? REV_L.map(
        (o, i) =>
          `<div class="rev-it ${o.nivel}"><i>${o.nivel === "seg" ? "⛔" : o.nivel === "aviso" ? "⚠" : "ℹ"}</i><span>${o.nivel === "seg" ? '<em class="rev-seg">Seguridad</em>' : ""}${esc(o.t)}<small>${esc(o.d)}</small></span><span class="pla-b">${o.ren ? `<button type="button" class="vw-btn" data-revr="${i}" title="Le pone al tablero el nombre que tiene en el cálculo">Renombrar a ${esc(o.ren.nom)}</button>` : ""}${o.caja ? `<button type="button" class="vw-btn" data-revc="${o.caja}" title="Parte la tubería en el medio de su recorrido con una caja de paso">Poner caja</button>` : ""}${o.juntar ? `<button type="button" class="vw-btn" data-revj="${o.juntar}" title="Deja una sola tubería con todos los circuitos y sus conductores">Juntar</button>` : ""}<button type="button" class="vw-btn" data-revi="${i}" title="Elige y muestra estos elementos">Ver</button></span></div>`
      ).join("")
    : '<p class="rev-ok">✓ Sin observaciones: el diseño está conectado y completo.</p>';
  $("revNota").textContent = REV_L.length
    ? `${sg ? `${sg} de seguridad · ` : ""}${av} aviso${av === 1 ? "" : "s"} · ${REV_L.length - av - sg} nota${REV_L.length - av - sg === 1 ? "" : "s"}`
    : "";
}
$("revDlg").addEventListener("click", e => {
  if (e.target.id === "revDlg") return revCerrar();
  const b = e.target.closest("[data-rev]"),
    v = e.target.closest("[data-revi]");
  if (b && b.dataset.rev === "cerrar") return revCerrar();
  const rn = e.target.closest("[data-revr]");
  if (rn) {
    const o = REV_L[+rn.dataset.revr],
      tb = dsD().els.find(x => x.id === o.ren.id);
    if (tb) {
      tb.nom = o.ren.nom;
      edCambio();
      toast(`Tablero renombrado a ${o.ren.nom}: sus circuitos entran al cálculo`);
    }
    return revRender();
  }
  const pj = e.target.closest("[data-revj]");
  if (pj) {
    dsJuntarTubs(pj.dataset.revj.split(","));
    return revRender();
  }
  const pc = e.target.closest("[data-revc]");
  if (pc) {
    dpPonerCaja(pc.dataset.revc);
    return revRender();
  }
  if (b && b.dataset.rev === "max") return REV_VW.maximizar();
  if (v) {
    const o = REV_L[+v.dataset.revi];
    revCerrar();
    DS_SEL.clear();
    PL_ASEL.clear();
    o.ids.forEach(id => DS_SEL.add(id));
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
});
$("revDlg").addEventListener("change", e => {
  if (!["revSal", "revCur", "revDuc"].includes(e.target.id)) return;
  const D = dsD(),
    C = dsCrit();
  D.crit = {
    sal: Math.max(1, Math.min(100, Math.round(+$("revSal").value) || C.sal)),
    cur: Math.max(90, Math.min(720, +$("revCur").value || C.cur)),
    duc: Math.max(0, Math.min(3, parseFloat(String($("revDuc").value).replace(",", ".")) || C.duc))
  };
  edCambio();
  revRender();
});
$("revDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    revCerrar();
  }
  e.stopPropagation();
});

/* ---------- Biblioteca de símbolos: todos los de la Norma DGE, por grupos, con buscador y los usados hace poco ---------- */
const BI_VW = ventanaMovil(document.querySelector("#bibDlg .vw"), "jmg-electric-biblioteca", {
  w: 860,
  h: 600,
  minW: 520,
  minH: 340
});
const BI_REC = "jmg-electric-simbolos-recientes";
let BI_GRUPO = "";
const biRecientes = () => {
  try {
    return (JSON.parse(localStorage.getItem(BI_REC) || "[]") || []).filter(k => DS_CAT[k]).slice(0, 12);
  } catch (e) {
    return [];
  }
};
function biUsado(k) {
  if (!DS_CAT[k]) return;
  try {
    localStorage.setItem(BI_REC, JSON.stringify([k, ...biRecientes().filter(x => x !== k)].slice(0, 12)));
  } catch (e) {}
}
// Texto para buscar sin tildes ni mayúsculas
const biNorm = s =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const BI_SIS = {
  alu: "alumbrado",
  tom: "tomacorrientes",
  fza: "fuerza",
  tab: "tableros",
  com: "comunicaciones telecomunicaciones",
  can: "canalizacion",
  tie: "tierra"
};
function bibAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("bibDlg").hidden = false;
  vwFondo();
  BI_VW.abrir();
  $("biBusca").value = "";
  bibRender();
  setTimeout(() => $("biBusca").focus(), 30);
}
function bibCerrar() {
  $("bibDlg").hidden = true;
  vwFondo();
}
// Claves que cumplen la búsqueda (todas las palabras, en el nombre, el código, el grupo o el sistema)
function biBuscar(q) {
  const pal = biNorm(q).split(/\s+/).filter(Boolean);
  return Object.keys(DS_CAT).filter(k => {
    const c = DS_CAT[k],
      t = biNorm(`${c.n} ${c.c} ${c.g} ${BI_SIS[c.s] || ""} ${k}`);
    return pal.every(p => t.includes(p));
  });
}
function bibRender() {
  if ($("bibDlg").hidden) return;
  const q = $("biBusca").value.trim(),
    todas = biBuscar(q),
    rec = q ? [] : biRecientes(),
    cuenta = g => todas.filter(k => DS_CAT[k].g === g).length;
  if (BI_GRUPO && BI_GRUPO !== "rec" && !cuenta(BI_GRUPO)) BI_GRUPO = "";
  if (BI_GRUPO === "rec" && !rec.length) BI_GRUPO = "";
  $("biGrupos").innerHTML =
    `<button type="button" data-big=""${BI_GRUPO ? "" : ' class="on"'}>Todos<i>${todas.length}</i></button>` +
    (rec.length
      ? `<button type="button" data-big="rec"${BI_GRUPO === "rec" ? ' class="on"' : ""}>Usados hace poco<i>${rec.length}</i></button>`
      : "") +
    (dpBloques().length
      ? `<button type="button" data-big="blq"${BI_GRUPO === "blq" ? ' class="on"' : ""}>Mis bloques<i>${dpBloques().length}</i></button>`
      : "") +
    DS_GRUPOS.map(g => {
      const n = cuenta(g);
      return n
        ? `<button type="button" data-big="${esc(g)}"${BI_GRUPO === g ? ' class="on"' : ""}>${esc(g)}<i>${n}</i></button>`
        : "";
    }).join("");
  const tarjeta = k =>
      `<div class="bi-s" role="button" tabindex="0" data-bik="${k}" title="${esc(DS_CAT[k].n)} · Norma DGE ${DS_CAT[k].c}">${dsSimb(k) ? '<i class="bi-crit">criterio</i>' : ""}<button type="button" class="bi-ed" data-bie="${k}" title="Editar este símbolo (criterio del proyectista)" aria-label="Editar este símbolo">✎</button>${dsIcono(k)}<b>${esc(DS_CAT[k].n)}</b><small>${DS_CAT[k].c}</small></div>`,
    bloque = (tit, ks) =>
      ks.length ? `<h4>${esc(tit)}</h4><div class="bi-lista">${ks.map(tarjeta).join("")}</div>` : "";
  let h;
  if (BI_GRUPO === "blq") h = dpTarjetasBloques("");
  else if (BI_GRUPO === "rec") h = bloque("Usados hace poco", rec);
  else if (BI_GRUPO)
    h = bloque(
      BI_GRUPO,
      todas.filter(k => DS_CAT[k].g === BI_GRUPO)
    );
  else
    h =
      bloque("Usados hace poco", rec) +
      dpTarjetasBloques(q) +
      DS_GRUPOS.map(g =>
        bloque(
          g,
          todas.filter(k => DS_CAT[k].g === g)
        )
      ).join("");
  $("biRejilla").innerHTML =
    h ||
    `<p class="bi-vacio">Ningún símbolo coincide con «${esc(q)}». Pruebe con otra palabra o con el código de la norma.</p>`;
  $("biN").textContent = q ? `${todas.length} de ${Object.keys(DS_CAT).length} símbolos` : `${todas.length} símbolos`;
}
// Elige un símbolo: se cierra la ventana y queda listo para colocarlo
function bibElegir(k) {
  if (!DS_CAT[k]) return;
  biUsado(k);
  bibCerrar();
  if (PLH.h === "rep" || PLH.h === "rmur") {
    PLH.repK = k;
    return plOrden();
  }
  DS_SEL.clear();
  plHerr("col:" + k);
}
$("biBusca").addEventListener("input", () => {
  BI_GRUPO = "";
  bibRender();
  $("biRejilla").scrollTop = 0;
});
$("bibDlg").addEventListener("click", e => {
  if (e.target.id === "bibDlg") return bibCerrar();
  const s = e.target.closest("[data-bik]"),
    g = e.target.closest("[data-big]"),
    b = e.target.closest("[data-bi]"),
    ed = e.target.closest("[data-bie]"),
    bx = e.target.closest("[data-blqx]"),
    bq = e.target.closest("[data-blq]");
  if (ed) return siAbrir(ed.dataset.bie);
  if (bx) {
    const L = dpBloques(),
      n = L[+bx.dataset.blqx] && L[+bx.dataset.blqx].n;
    L.splice(+bx.dataset.blqx, 1);
    dpGuardarBloques(L);
    toast(`Bloque «${n}» eliminado`);
    return bibRender();
  }
  if (bq) return dpUsarBloque(+bq.dataset.blq);
  if (s) return bibElegir(s.dataset.bik);
  if (g) {
    BI_GRUPO = g.dataset.big;
    bibRender();
    $("biRejilla").scrollTop = 0;
  } else if (b && b.dataset.bi === "cerrar") bibCerrar();
  else if (b && b.dataset.bi === "max") BI_VW.maximizar();
});
$("bibDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    bibCerrar();
  } else if (e.key === "Enter" && e.target.id === "biBusca") {
    e.preventDefault();
    const p = $("biRejilla").querySelector("[data-bik]");
    if (p) bibElegir(p.dataset.bik);
  } else if (e.key === "Enter" && e.target.dataset && e.target.dataset.bik) {
    e.preventDefault();
    bibElegir(e.target.dataset.bik);
  } else if (e.key === "ArrowDown" && e.target.id === "biBusca") {
    e.preventDefault();
    const p = $("biRejilla").querySelector("[data-bik]");
    if (p) p.focus();
  }
  e.stopPropagation();
});

/* ---------- Ventana Tablero (doble clic en un tablero): nombre y circuitos, que salen del tablero como C-1, C-2… ---------- */
const TA_VW = ventanaMovil(document.querySelector("#tabDlg .vw"), "jmg-electric-tablero", {
  w: 540,
  h: 620,
  minW: 380,
  minH: 300
});
let TA_ID = null;
function tabAbrir(id) {
  const el = dsD() && dsD().els.find(e => e.id === id);
  if (!el || el.k !== "tab") return;
  TA_ID = id;
  $("taNom").value = el.nom || "";
  $("taN").value = el.nc || 6;
  $("taFs").value = el.fs === 3 ? "3" : el.fs === 1 ? "1" : "";
  // Tablero general (solo alimentadores): el TG de un edificio lo es por defecto mientras no tenga circuitos
  $("taGen").value =
    el.gen || (el.gen === undefined && !el.nc && MODE === "multi" && (el.nom || "TG") === "TG") ? "1" : "";
  // Edificio: a qué tipo de departamento pertenece (el cálculo toma de él sus salidas y su alimentador)
  $("taDepL").hidden = MODE !== "multi";
  $("taDep").innerHTML =
    '<option value="">— TG, servicios generales u otro —</option>' +
    tipos
      .map(
        (t, i) =>
          `<option value="${i}"${el.dep === i ? " selected" : ""}>${esc(t.nombre || "Tipo " + (i + 1))}</option>`
      )
      .join("");
  tabLista(el.cd || [], el.ct || []);
  tabTipo();
  tabEsquema();
  $("tabDlg").hidden = false;
  vwFondo();
  TA_VW.abrir();
  setTimeout(() => {
    $("taN").focus();
    $("taN").select();
  }, 30);
}
function tabCerrar() {
  $("tabDlg").hidden = true;
  TA_ID = null;
  vwFondo();
}
// Lista de circuitos con su descripción (opcional), según el número elegido
function tabLista(cd, ct) {
  const n = Math.max(1, Math.min(60, Math.round(+$("taN").value) || 1)),
    prev = [...$("taLista").querySelectorAll("input")].map(i => i.value),
    prevT = [...$("taLista").querySelectorAll("select")].map(i => i.value),
    d = cd || prev,
    tt = ct || prevT,
    // Tipo automático: el de las salidas conectadas a cada circuito
    auto = i => {
      const c = { al: 0, to: 0, esp: 0 };
      dsD().els.forEach(e => {
        const k = e.tab === TA_ID && e.cir === "C-" + (i + 1) && dsClase(e);
        if (k) c[k]++;
      });
      return c.esp && !c.al && !c.to ? "esp" : c.al > c.to ? "al" : c.to ? "tg" : "";
    };
  $("taLista").innerHTML = Array.from({ length: n }, (v, i) => {
    const a = auto(i);
    return `<div class="ta-fila"><b>C-${i + 1}</b><select aria-label="Tipo del circuito C-${i + 1}" title="Tipo del circuito, para el cálculo"><option value="">${a ? "Auto: " + PL_TCIR[a].toLowerCase() : "Automático"}</option>${Object.entries(
      PL_TCIR
    )
      .map(([k, t]) => `<option value="${k}"${tt[i] === k ? " selected" : ""}>${t}</option>`)
      .join(
        ""
      )}</select><input type="text" maxlength="60" value="${esc(d[i] || "")}" placeholder="Descripción (opcional): sala y comedor, cocina…" aria-label="Descripción del circuito C-${i + 1}"></div>`;
  }).join("");
  const el = dsD().els.find(e => e.id === TA_ID),
    usados = dsD()
      .els.filter(e => e.t === "tub" && e.tab === TA_ID && e.cir && parseInt(e.cir.slice(2), 10) > n)
      .map(e => e.cir);
  $("taNota").textContent = usados.length
    ? `Atención: hay tuberías conectadas a ${[...new Set(usados)].join(", ")}, que dejarían de existir.`
    : el && el.nc
      ? "Las salidas aparecen al frente del tablero; las tuberías que empiezan en una salida toman su circuito."
      : "Al aceptar, el tablero muestra sus salidas C-1, C-2…: empiece cada tubería en la suya.";
}
function tabAceptar() {
  const el = dsD() && dsD().els.find(e => e.id === TA_ID);
  if (!el) return tabCerrar();
  const n = Math.max(1, Math.min(60, Math.round(+$("taN").value) || 1)),
    cd = [...$("taLista").querySelectorAll("input")]
      .slice(0, n)
      .map(i => i.value.replace(/[<>]/g, "").trim().slice(0, 60));
  while (cd.length && !cd[cd.length - 1]) cd.pop();
  const ct = [...$("taLista").querySelectorAll("select")].slice(0, n).map(s => (PL_TCIR[s.value] ? s.value : ""));
  while (ct.length && !ct[ct.length - 1]) ct.pop();
  el.nom = $("taNom").value.replace(/[<>]/g, "").trim().slice(0, 20) || el.nom || "TG";
  // Tablero general: sin salidas de circuitos (las tuberías de alimentador llegan a su borde)
  if ($("taGen").value === "1") {
    el.gen = true;
    el.nc = 0;
    if ($("taFs").value) el.fs = +$("taFs").value;
    else delete el.fs;
    tabCerrar();
    edCambio();
    return toast(`${el.nom}: tablero general, solo alimentadores (dibújelos con la tubería «Alimentador»)`);
  }
  delete el.gen;
  el.nc = n;
  if ($("taFs").value) el.fs = +$("taFs").value;
  else delete el.fs;
  if (MODE === "multi") {
    if ($("taDep").value !== "") el.dep = +$("taDep").value;
    else delete el.dep;
  }
  if (cd.length) el.cd = cd;
  else delete el.cd;
  if (ct.length) el.ct = ct;
  else delete el.ct;
  tabCerrar();
  edCambio();
  toast(`${el.nom}: ${n} circuito${n > 1 ? "s" : ""} (C-1 a C-${n}). Empiece cada tubería en su salida`);
}
$("taN").addEventListener("input", () => {
  tabLista();
  tabEsquema();
});
["taFs", "taDep", "taNom"].forEach(id => $(id).addEventListener("input", tabEsquema));
["taFs", "taDep"].forEach(id => $(id).addEventListener("change", tabEsquema));
$("taGen").addEventListener("change", () => {
  tabTipo();
  tabEsquema();
});
// Tablero general: sin número de circuitos ni lista de circuitos
function tabTipo() {
  const g = $("taGen").value === "1";
  $("taNL").hidden = g;
  $("taLista").hidden = g;
  if (g)
    $("taNota").textContent =
      "Tablero general: sin circuitos derivados; sus alimentadores se dibujan con la tubería «Alimentador» hasta su borde.";
  else tabLista();
}
/* Esquema del tablero en su ventana (ilustrativo, no es un plano): de dónde llega, su interruptor general, sus barras
   según el sistema (trifásico 380/220 V: R, S, T, N y tierra; 220 V: dos o tres fases y tierra, sin neutro) y sus
   salidas. El TG de un edificio muestra también su salida al banco de medidores y, si es el caso, al TSG. El sistema
   «del proyecto» es el del suministro o, en un tablero de departamento, el de su medidor. */
function tabEsquema() {
  const box = $("taEsq");
  if (!box) return;
  const nom = ($("taNom").value.trim() || "TG").toUpperCase(),
    multi = MODE === "multi",
    dep = multi && $("taDep").value !== "" ? tipos[+$("taDep").value] : null,
    skP = (multi ? PROY.sistG : PROY.sist) || (multi ? "tri380" : "mono220"),
    // Sistema del proyecto para este tablero: un departamento con medidor monofásico va en 220 V
    skDef = dep && !(dep.fases === "3" && SIST[skP].tri) ? "mono220" : skP,
    fs = $("taFs").value,
    sk = fs === "3" ? (SIST[skP].tri ? skP : "tri380") : fs === "1" ? "mono220" : skDef,
    S = SIST[sk] || SIST.mono220,
    tri = S.tri,
    // Con 380/220 V hay neutro: un tablero monofásico lleva fase y neutro; en 220 V, dos fases
    conN = sk === "tri380" || (!tri && skP === "tri380"),
    esTG = nom === "TG",
    n = Math.max(1, Math.min(60, Math.round(+$("taN").value) || 1)),
    llega = esTG
      ? multi
        ? "del medidor de la concesionaria"
        : "del medidor"
      : dep
        ? "de su medidor en el banco"
        : nom === "TSG"
          ? PROY.tsgDe === "tg"
            ? "directo del TG"
            : "de su medidor en el banco"
          : "del TG",
    barras = [...(tri ? ["R", "S", "T"] : conN ? ["F"] : ["L1", "L2"]), ...(conN ? ["N"] : []), "PE"],
    col = {
      R: "#c62828",
      F: "#c62828",
      S: "#1b1b1b",
      T: "#1565c0",
      L1: "#c62828",
      L2: "#1b1b1b",
      N: "#8a9199",
      PE: "#2f7a4b"
    },
    gen = $("taGen").value === "1",
    D = dsD(),
    // Alimentadores: en el edificio, al banco (y al TSG si sale del TG); en un tablero general, también a los demás
    // tableros del plano
    otros = gen
      ? [
          ...new Set(D.els.filter(e => e.k === "tab" && e.id !== TA_ID && e.nom && e.nom !== "TSG").map(e => e.nom))
        ].filter(x => !multi || x === "TSG")
      : [],
    hayBM = multi ? esTG || gen : gen && D.els.some(e => e.k === "bmed"),
    extra = [
      ...(hayBM ? ["Banco"] : []),
      ...(multi && (esTG || gen) && PROY.tsgDe === "tg" ? ["TSG"] : []),
      ...otros
    ].slice(0, 8),
    circs = gen ? 0 : n,
    salidas = [...extra, ...Array.from({ length: Math.min(circs, 8 - extra.length) }, (v, i) => `C-${i + 1}`)],
    mas = circs - (salidas.length - extra.length),
    W = 460,
    x0 = 120,
    y0 = 34,
    dy = 13,
    yb = i => y0 + i * dy,
    yf = yb(barras.length - 1),
    paso = Math.min(40, (W - x0 - 40) / Math.max(1, salidas.length + (mas > 0 ? 1 : 0))),
    o = [];
  // Llegada e interruptor general
  o.push(`<text x="8" y="14" class="t">Llega ${esc(llega)}</text>`);
  o.push(`<line x1="24" y1="18" x2="24" y2="${yb(0) - 12}" class="c"/>`);
  o.push(
    `<rect x="12" y="${yb(0) - 12}" width="24" height="${yf - yb(0) + 24}" rx="3" class="ig"/><text x="24" y="${yf + 26}" class="t m">IG ${tri ? 3 : 2}P</text>`
  );
  // Barras con su nombre y color
  barras.forEach((b, i) => {
    const y = yb(i);
    o.push(
      // Las fases y el neutro salen del interruptor general; la tierra va directa a su barra
      `<line x1="${b === "PE" ? 70 : 36}" y1="${y}" x2="${W - 18}" y2="${y}" stroke="${col[b]}" stroke-width="${b === "PE" ? 2 : 3}"${b === "N" ? ' stroke-dasharray="6 3"' : ""}/>`,
      `<rect x="44" y="${y - 6}" width="22" height="12" rx="2" fill="#fbfaf7"/><text x="55" y="${y + 3.5}" class="b" text-anchor="middle" fill="${col[b]}">${b}</text>`
    );
  });
  /* Salidas: los alimentadores (al banco, al TSG o a otros tableros) toman todas las fases y el neutro; cada circuito,
     su fase (R, S y T en turno; en 220 V, las dos fases) y el neutro. Un punto marca la barra a la que se conecta; la
     salida sale desde la primera de ellas */
  const fases = barras.filter(b => b !== "N" && b !== "PE");
  let k = 0;
  salidas.forEach((s, i) => {
    const x = x0 + i * paso + paso / 2,
      ext = i < extra.length,
      con = ext || !tri ? [...fases, ...(conN ? ["N"] : [])] : [fases[k++ % 3], ...(conN ? ["N"] : [])],
      y1 = Math.min(...con.map(b => yb(barras.indexOf(b))));
    o.push(
      `<line x1="${x}" y1="${y1}" x2="${x}" y2="${yf + 16}" class="c${ext ? " ext" : ""}"/>`,
      ...con.map(
        b =>
          `<circle cx="${x}" cy="${yb(barras.indexOf(b))}" r="2.6" fill="${col[b]}" stroke="#fff" stroke-width="0.8"/>`
      ),
      `<rect x="${x - 4}" y="${yf + 16}" width="8" height="10" class="itm${ext ? " ext" : ""}"/>`,
      `<line x1="${x}" y1="${yf + 26}" x2="${x}" y2="${yf + 36}" class="c${ext ? " ext" : ""}"/>`,
      ext
        ? `<text x="${x}" y="${yf + 47}" class="t m e">→ ${esc(s)}</text>`
        : `<text x="${x}" y="${yf + 47}" class="t m">${s}</text>`
    );
  });
  if (mas > 0) o.push(`<text x="${x0 + salidas.length * paso + paso / 2}" y="${yf + 30}" class="t m">+${mas}</text>`);
  const H = yf + 54,
    txt = `${esTG ? (multi ? "Tablero general del edificio" : "Tablero general") : nom === "TSG" ? "Tablero de servicios generales" : dep ? `Tablero del ${esc(dep.nombre || "departamento")}` : "Tablero de distribución"} · ${conN && !tri ? "Monofásico 220 V (fase y neutro)" : S.nom}${fs ? "" : ", del proyecto"} · interruptor general ${tri ? "tripolar" : "bipolar"} · barras ${barras.join("-")}${gen ? " · solo alimentadores" : ""}${extra.length ? ` · alimentadores a: ${extra.map(x => (x === "Banco" ? "banco de medidores" : x)).join(", ")}` : ""}`;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${txt}">${o.join("")}</svg><p>${txt}. Esquema ilustrativo.</p>`;
}
$("tabDlg").addEventListener("click", e => {
  if (e.target.id === "tabDlg") return tabCerrar();
  const b = e.target.closest("[data-ta]");
  if (!b) return;
  const a = b.dataset.ta;
  if (a === "ok") tabAceptar();
  else if (a === "cerrar") tabCerrar();
  else if (a === "max") TA_VW.maximizar();
  else if (a === "mas" || a === "menos") {
    $("taN").value = Math.max(1, Math.min(60, (+$("taN").value || 0) + (a === "mas" ? 1 : -1)));
    tabLista();
  }
});
$("tabDlg").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    tabAceptar();
  } else if (e.key === "Escape") {
    e.preventDefault();
    tabCerrar();
  }
  e.stopPropagation();
});
