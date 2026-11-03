/* PANEL DEL PROYECTO Y APERTURA DE VENTANAS
   Desde la v2.9.3 los datos se ingresan solo en ventanas, como en los programas de ingeniería: el explorador,
   la cinta, las recomendaciones y la lista de datos que faltan abren la ventana que corresponde (abrirNodo) o la
   ventana del dato, con el dato enfocado (abrirCampo). Los formularios de index.html siguen existiendo, ocultos:
   las ventanas Datos del proyecto y Parámetros de diseño se arman con ellos.
   El panel derecho es de revisión, de solo lectura (panelProyecto): el resumen del proyecto, el elemento
   elegido en el explorador y lo que hay por revisar, cada cosa con un clic que abre la ventana donde se corrige.
   Cada sección se muestra u oculta desde la cinta (PP_VER). */

// Ventana de cada elemento del explorador (o de un botón de la cinta con data-node)
function abrirNodo(n, fs) {
  const multi = MODE === "multi",
    dp = { proyecto: "proy", suministro: "sum", vivienda: multi ? "dep" : "viv", salidas: multi ? "dep" : "sal" };
  if (n.startsWith("circ:")) return fichaCirc(n.slice(5));
  if (n.startsWith("tab:")) return fichaTablero(n.slice(4));
  if (n in dp) return abrirDatos(fs === "fs-pisos" ? "pis" : fs === "fs-viv" ? "viv" : dp[n]);
  if (n === "cargas") return abrirTabla(multi ? "cargasT" : "cargas");
  if (n === "servicios") return abrirTabla(multi ? "serv" : "cargas");
  if (n === "param" || n === "pat" || n === "metrado") {
    if (n === "metrado") return verVista("metrado");
    return abrirParametros(n === "pat" ? "pat" : "car");
  }
}
// Abren la ventana en una pestaña; si ya está abierta, solo cambian de pestaña (sin perder lo pendiente)
function abrirDatos(tab) {
  if ($("dpDlg").hidden) datosProyecto(true, tab);
  else {
    DP_TAB = tab;
    renderDatos();
  }
}
function abrirParametros(tab) {
  PP_TAB = tab;
  if ($("ppDlg").hidden) parametros(true);
  else renderParam();
}
function abrirTabla(tab, sel) {
  if ($("tcDlg").hidden) tablaCargas(tab);
  else TC_TAB = tab;
  if (sel != null) TC_SEL = sel;
  renderTabla();
}
// Enfoca un dato dentro de la ventana recién abierta y lo resalta un momento
function enfocar(sel) {
  setTimeout(() => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
    const c = el.closest("label,td,.dp-c,.tc-c");
    if (c) {
      c.classList.add("resalta");
      setTimeout(() => c.classList.remove("resalta"), 1600);
    }
  }, 80);
}
// Pestaña de cada formulario en las ventanas de datos
const FS_DATOS = {
  "fs-proy": "proy",
  "fs-tipo": "proy",
  "fs-sum-uni": "sum",
  "fs-sum-multi": "sum",
  "fs-viv": "viv",
  "fs-plano": "sal",
  "fs-sal": "sal",
  "fs-pisos": "pis",
  "fs-tipos": "dep"
};
const FS_PARAM = {
  "fs-p-car": "car",
  "fs-p-cond": "cond",
  "fs-p-prot": "prot",
  "fs-p-dv": "prot",
  "fs-p-pat": "pat",
  "fs-p-met": "pat",
  "fs-p-pozo": "pat",
  "fs-p-alt": "alt",
  "fs-p-bm": "bm"
};
/* Abre la ventana de un dato del proyecto y lo enfoca. id es el del campo del formulario (por ejemplo «met» o
   «area») o, en una lista, «lista_campo_i» (por ejemplo «cargas_p_0» o «tipos_cant_1»). */
function abrirCampo(id) {
  if (id === "add_tipos") return abrirDatos("dep");
  const m = id.match(/^([a-zA-Z]+)_([a-zA-Z_]+?)_(\d+)$/),
    L = m && LISTS[m[1]] ? m[1] : null,
    i = m ? +m[3] : 0;
  if (L === "cargas" || L === "serv" || L === "cargasT") {
    abrirTabla(L, i);
    return enfocar(`#tcForm [data-tce="${m[2]}"]`);
  }
  if (L === "tipos" || L === "lumsT" || L === "tomsT") {
    DPD_SEL = L === "tipos" ? i : Math.round(+(LISTS[L].arr[i] || {}).tipo || 0);
    abrirDatos("dep");
    if (DPD) depRedibujar();
    return enfocar(`#dpBody [data-dd="${L}|${i}|${m[2]}"]`);
  }
  const el = $(id),
    fs = el ? el.closest("fieldset[id]")?.id || "" : "";
  if (FS_PARAM[fs]) {
    abrirParametros(FS_PARAM[fs]);
    return enfocar(`#ppBody [data-pp="${id}"]`);
  }
  if (FS_DATOS[fs]) {
    abrirDatos(MODE === "multi" && FS_DATOS[fs] === "viv" ? "dep" : FS_DATOS[fs]);
    return enfocar(`#dpBody [data-dp="${id}"]`);
  }
}
// Abre la ventana donde se completa un elemento recién agregado a una lista (desde la cinta)
function abrirLista(nm) {
  const a = LISTS[nm].arr,
    i = a.length - 1;
  if (nm === "cargas" || nm === "serv" || nm === "cargasT") return abrirTabla(nm, i);
  if (nm === "tipos") {
    DPD_SEL = i;
    return abrirDatos("dep");
  }
  if (nm === "lumsT" || nm === "tomsT") {
    DPD_SEL = Math.round(+(a[i] || {}).tipo || 0);
    return abrirDatos("dep");
  }
  if (nm === "pisos") return abrirDatos("pis");
  if (nm === "lums" || nm === "toms") return abrirDatos("sal");
}

/* PANEL DEL PROYECTO (solo lectura) */
const ppSec = (t, h, n) => `<section class="pp-sec"><h3>${t}${n ? `<em>${n}</em>` : ""}</h3>${h}</section>`;
const ppFila = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
const ppBoton = (n, t) => `<button type="button" class="vw-btn pp-abrir" data-node="${esc(n)}">${t}</button>`;
function ppResumen(r) {
  if (!r)
    return ppSec(
      "Resumen",
      `<p class="pp-nota">Para calcular faltan <b>${WSF.length}</b> dato${WSF.length === 1 ? "" : "s"}: están en «Por revisar».</p>`
    );
  const a0 = r.alims[0],
    md = r.mode === "multi" ? r.MD : r.md.MD,
    dv = Math.max(...r.alims.map(a => a.dvAc), ...r.circ.map(c => c.dVt)),
    ok = r.alims.every(a => a.ok) && r.circ.every(q => q.ok);
  return ppSec(
    "Resumen",
    `<div class="pp-big"><small>Máxima demanda</small><b>${fmt(md / 1000, 2)} <small>kW</small></b></div><table class="rt">${ppFila("Potencia a contratar", `${fmt(r.contratada, 1)} kW`)}${ppFila("Alimentador", `${a0.s.n}-1×${a0.S} mm²`)}${ppFila("Interruptor general", `${a0.s.tri ? 3 : 2}×${a0.itm ?? "—"} A`)}${ppFila("ΔV máxima total", `${fmt(dv, 2)} %`)}${ppFila("Puesta a tierra", `${fmt(r.pat.Rn ?? r.pat.Rt, 1)} Ω`)}</table><div class="pp-estado ${ok ? "ok" : "bad"}"><i></i>${ok ? "Conforme" : "Revisar"}</div>`
  );
}
// Elemento elegido en el explorador: su resumen y el botón que abre su ventana
function ppSeleccion(r, n) {
  if (r && n.startsWith("circ:")) {
    const q = r.circ.find(x => x.key === n.slice(5));
    if (q)
      return ppSec(
        `${esc(q.id)} · ${esc(q.desc)}`,
        `<table class="rt">${ppFila("Potencia", `${fmt(q.P, 0)} W · ${esc(q.s.txt)}${q.fase && q.fase !== "—" ? ` · ${esc(q.fase)}` : ""}`)}${ppFila("Interruptor", `${q.f3 ? 3 : 2}×${q.itm ?? "—"} A · ${q.curva}`)}${ppFila("Conductor", `${q.f3 ? 4 : 2}-1×${q.S} mm²`)}${ppFila("Diferencial", `${esc(q.idName)} · ${q.idTipo || "A"}`)}${ppFila("ΔV total", `${fmt(q.dVt, 2)} %`)}</table>${ppBoton(n, "Abrir ficha del circuito")}`
      );
  }
  if (r && n.startsWith("tab:")) {
    const tb = r.tabs.find(t => t.tab === n.slice(4));
    if (tb) {
      const a = r.alims[tb.feeder],
        cs = r.circ.filter(q => q.tab === tb.tab);
      return ppSec(
        `Tablero ${esc(tb.tab)}`,
        `<table class="rt">${ppFila("Alimentador", `${a.s.n}-1×${a.S} mm² · ${a.s.tri ? 3 : 2}×${a.itm ?? "—"} A`)}${ppFila("ΔV acumulada", `${fmt(a.dvAc, 2)} %`)}${ppFila("Icc en barras", `${fmt(tb.icc, 2)} kA · PdC ${tb.pdc} kA`)}${ppFila("Circuitos", `${cs.length} + ${r.c.reserva} de reserva`)}</table>${ppBoton(n, "Abrir ficha del tablero")}`
      );
    }
  }
  const t = n === "vivienda" && MODE === "multi" ? "Departamentos" : NODETIT[n];
  if (!t) return "";
  const txt = {
    proyecto: esc(PROY.p_nombre || "Proyecto sin nombre") + " · " + esc(nomEdif()),
    suministro: esc((SIST[MODE === "multi" ? PROY.sistG : PROY.sist] || {}).nom || ""),
    vivienda:
      MODE === "multi"
        ? `${tipos.length} tipo${tipos.length === 1 ? "" : "s"} de departamento`
        : `${esc(PROY.area || "—")} m² · alimentador de ${esc(PROY.Lalim || "—")} m`,
    salidas: `${esc(PROY.al_n || 0)} salidas de alumbrado · ${esc(PROY.tg_n || 0)} tomacorrientes`,
    cargas: `${(MODE === "multi" ? cargasT : cargas).length} cargas especiales`,
    servicios: `${serv.length} cargas comunes`,
    param: "Criterios del proyecto: conductores, protección, caída de tensión y tierra",
    pat: r ? `${fmt(r.pat.Rn ?? r.pat.Rt, 1)} Ω` : "",
    metrado: "Cuantificación referencial de materiales"
  }[n];
  return ppSec(
    esc(t),
    `<p class="pp-nota">${txt || ""}</p>${ppBoton(n, n === "metrado" ? "Ver el metrado" : "Abrir")}`
  );
}
// Lo que hay por revisar: datos que faltan, tramos que no cumplen o con poco margen, y recomendaciones pendientes
function ppRevisar(r) {
  const it = [];
  WSF.forEach(f => it.push(["falta", esc(f.l), `data-foco="${esc(f.id)}"`]));
  if (r) {
    const nom = q => `${r.tabs.length > 1 ? q.tab + " · " : ""}${q.id} ${q.desc}`;
    r.alims.forEach((a, i) => {
      const tb = r.tabs.find(t => t.feeder === i),
        d = tb ? `data-node="tab:${esc(tb.tab)}"` : "";
      if (!a.ok) it.push(["bad", `${esc(a.desc)}: no cumple`, d]);
      else if (pocoMargen({ ...a, alim: true }))
        it.push([
          "warn",
          `${esc(a.desc)}: ΔV ${fmt(a.dvAc, 2)} %, al ${fmt((a.dvAc / DV_ALIM) * 100, 0)} % del límite`,
          d
        ]);
    });
    r.circ.forEach(q => {
      const d = `data-node="circ:${esc(q.key)}"`;
      if (!q.ok) it.push(["bad", `${esc(nom(q))}: no cumple`, d]);
      else if (pocoMargen(q)) it.push(["warn", `${esc(nom(q))}: poco margen (ΔV total ${fmt(q.dVt, 2)} %)`, d]);
    });
    recomendaciones(r)
      .filter(x => !(ACEP[r.mode] || {})[x.id])
      .forEach(x => {
        const d = x.ir
          ? x.ir.act
            ? `data-act="${x.ir.act}"`
            : x.ir.foco
              ? `data-foco="${x.ir.foco}"`
              : x.ir.node
                ? `data-node="${esc(x.ir.node)}"`
                : `data-view="${x.ir.view}"`
          : `data-view="verif"`;
        it.push(["info", esc(x.tit), d]);
      });
  }
  const max = 12,
    li = it
      .slice(0, max)
      .map(
        ([c, t, d]) =>
          `<li><button type="button" class="pp-it ${c}" ${d}><i></i><span>${t}</span><b>→</b></button></li>`
      )
      .join("");
  return ppSec(
    "Por revisar",
    it.length
      ? `<ul class="pp-lista">${li}</ul>${it.length > max ? `<button type="button" class="linkbtn pp-mas" data-view="verif">y ${it.length - max} más: ver Verificaciones</button>` : ""}`
      : `<p class="pp-nota pp-ok">Nada pendiente: el proyecto está completo y conforme.</p>`,
    it.length || ""
  );
}
// Secciones visibles del panel; se eligen en la cinta (Proyecto › Panel del proyecto) y se recuerdan
const PP_VER = { res: true, sel: true, rev: true };
try {
  Object.assign(PP_VER, JSON.parse(localStorage.getItem("jmg-electric-panel-secc") || "{}"));
} catch (e) {}
document.querySelectorAll("[data-ppv]").forEach(c => (c.checked = PP_VER[c.dataset.ppv] !== false));
document.addEventListener("change", e => {
  const c = e.target.closest("[data-ppv]");
  if (!c) return;
  PP_VER[c.dataset.ppv] = c.checked;
  try {
    localStorage.setItem("jmg-electric-panel-secc", JSON.stringify(PP_VER));
  } catch (e) {}
  // Al activar una sección con el panel cerrado, el panel se abre para mostrarla
  if (c.checked && !PANE.right.on) {
    PANE.right.on = true;
    panes(true);
  }
  panelProyecto();
});
function panelProyecto() {
  const pb = $("propBody");
  if (!pb) return;
  const r = LAST,
    top = pb.scrollTop,
    h = (PP_VER.res ? ppResumen(r) : "") + (PP_VER.sel ? ppSeleccion(r, NODE) : "") + (PP_VER.rev ? ppRevisar(r) : "");
  pb.innerHTML =
    h ||
    `<p class="pp-nota pp-vacio">Todas las secciones están ocultas. Actívelas en la cinta: Proyecto › Panel del proyecto.</p>`;
  pb.scrollTop = top;
}
