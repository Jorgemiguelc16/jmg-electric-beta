/* ESPACIO DE TRABAJO
   Explorador del proyecto (árbol), panel del proyecto (solo lectura, js/panel.js), cinta de opciones y sus
   acciones, deshacer y rehacer, asistente de nuevo proyecto, paneles laterales y avisos (toast). Los datos se
   ingresan en ventanas: un elemento del explorador o un botón de la cinta abre la suya (abrirNodo). */
const NODEFS = {
  proyecto: ["fs-proy", "fs-tipo"],
  suministro: { uni: ["fs-sum-uni"], multi: ["fs-sum-multi"] },
  vivienda: { uni: ["fs-viv", "fs-pisos"], multi: ["fs-tipos"] },
  salidas: ["fs-plano", "fs-sal"],
  cargas: ["fs-cargas"],
  servicios: ["fs-serv"],
  param: [
    "fs-p-car",
    "fs-p-cond",
    "fs-p-prot",
    "fs-p-dv",
    "fs-p-pat",
    "fs-p-pozo",
    "fs-p-met",
    "fs-p-alt",
    "fs-p-bm",
    "fs-p-dat"
  ],
  pat: ["fs-p-pat", "fs-p-pozo"],
  metrado: ["fs-p-met"]
};
const NODETIT = {
  proyecto: "Datos del proyecto",
  suministro: "Suministro",
  vivienda: "Vivienda",
  salidas: "Salidas",
  cargas: "Cargas especiales",
  servicios: "Servicios generales",
  param: "Parámetros de diseño",
  pat: "Puesta a tierra",
  metrado: "Metrado"
};
let NODE = "proyecto",
  WSF = [],
  RIB = "proyecto";
try {
  const x = localStorage.getItem("jmg-electric-node");
  if (x) NODE = x;
} catch (e) {}
const fsDe = n => {
  const v = NODEFS[n];
  return Array.isArray(v) ? v : v ? v[MODE] : null;
};
function abrirWS(n) {
  document.body.classList.add("ws-on");
  $("ws").hidden = false;
  try {
    localStorage.setItem("jmg-electric-tab", "calculo");
  } catch (e) {}
  if (n) selNode(n);
  else selNode(NODE);
}
function cerrarWS(silencioso) {
  document.body.classList.remove("ws-on");
  $("ws").hidden = true;
  if (!silencioso) setTab("inicio");
}
// compatibilidad con llamadas anteriores
function irSec(sec) {
  const map = {
    proyecto: "proyecto",
    suministro: "suministro",
    vivienda: "vivienda",
    cargas: MODE === "multi" ? "servicios" : "salidas",
    param: "param",
    resultados: null,
    exportar: null
  };
  if (!document.body.classList.contains("ws-on")) {
    try {
      localStorage.setItem("jmg-electric-tab", "calculo");
    } catch (e) {}
  }
  abrirWS(map[sec] === undefined ? null : map[sec]);
  if (sec === "resultados" || sec === "exportar") verVista(VIEW || "resumen");
}
function selNode(n) {
  if (n === "servicios" && MODE !== "multi") n = "cargas";
  if ((n === "cargas" || n === "salidas") && MODE === "multi") n = n === "cargas" ? "cargas" : "vivienda";
  NODE = n;
  try {
    localStorage.setItem("jmg-electric-node", n);
  } catch (e) {}
  $("propSub").textContent = "";
  panelProyecto();
  exTree();
}
function verVista(v) {
  VIEW = v;
  try {
    localStorage.setItem("jmg-electric-view", v);
  } catch (e) {}
  if (LAST) update();
}
// Abre la ventana del dato y lo enfoca (js/panel.js)
function focoCampo(id) {
  abrirCampo(id);
}
const pendDe = n => {
  const fl = fsDe(n) || [];
  return (
    WSF.filter(f => {
      const el = $(f.id);
      const fs = el && el.closest("fieldset[id]");
      return fs && fl.includes(fs.id);
    }).length + (n === "proyecto" && !$("p_nombre").value.trim() ? 1 : 0)
  );
};
function exTree() {
  const r = LAST,
    multi = MODE === "multi",
    N = [];
  const add = (lv, txt, node, st, extra = "") =>
    N.push(
      `<button type="button" class="tn ${st || ""}${NODE === node ? " sel" : ""}" style="padding-left:${10 + lv * 16}px" data-node="${node}"><i class="dot"></i><span>${txt}</span>${extra}</button>`
    );
  const pst = n => (pendDe(n) ? "pend" : "ok"),
    pc = n => {
      const k = pendDe(n);
      return k ? `<em>${k}</em>` : "";
    };
  const sk = multi ? radio("sistG") : radio("sist"),
    sis = SIST[sk]?.nom || "";
  add(0, esc($("p_nombre").value.trim() || "Proyecto sin nombre"), "proyecto", pst("proyecto"), pc("proyecto"));
  add(1, `Suministro · ${sis}`, "suministro", pst("suministro"), pc("suministro"));
  if (!multi) {
    const a = (parseFloat($("area").value) || 0) + pisos.reduce((s, p) => s + (p.area || 0), 0);
    add(
      1,
      `${usoAct() === "viv" ? "Vivienda" : "Edificación"}${a > 0 ? ` · ${fmt(a, 0)} m²` : ""}${pisos.length ? ` · ${pisos.length + 1} pisos` : ""}`,
      "vivienda",
      pst("vivienda"),
      pc("vivienda")
    );
    add(
      1,
      pisos.length ? "Salidas del 1er piso" : "Salidas de alumbrado y tomacorrientes",
      "salidas",
      pst("salidas"),
      pc("salidas")
    );
    add(1, `Cargas especiales · ${cargas.length}`, "cargas", pst("cargas"), pc("cargas"));
  } else {
    add(
      1,
      `Departamentos · ${tipos.reduce((s, t) => s + (t.cant > 0 ? Math.round(t.cant) : 0), 0)} departamentos`,
      "vivienda",
      pst("vivienda"),
      pc("vivienda")
    );
    add(1, `Servicios generales · ${serv.length}`, "servicios", pst("servicios"), pc("servicios"));
  }
  if (r) {
    r.tabs.forEach(tb => {
      add(1, `Tablero ${tb.tab}`, "tab:" + tb.tab, "tabk");
      r.circ
        .filter(q => q.tab === tb.tab)
        .forEach(q => add(2, `${q.id} &nbsp;${esc(q.desc)}`, "circ:" + q.key, q.ok ? "ok" : "bad"));
      const pre = tb.tab === "TSG" ? "S-" : "C-",
        n0 = r.circ.filter(q => q.tab === tb.tab).length;
      // Los espacios de reserva en una sola línea, para que el árbol muestre solo lo que se revisa
      const nr = r.c.reserva;
      if (nr)
        N.push(
          `<div class="tn res" style="padding-left:42px"><i class="dot"></i><span>${nr > 1 ? `${pre}${n0 + 1} a ${pre}${n0 + nr}` : `${pre}${n0 + 1}`} &nbsp;${nr} reserva${nr > 1 ? "s" : ""}</span></div>`
        );
    });
    add(1, `Puesta a tierra · ${fmt(r.pat.Rn ?? r.pat.Rt, 1)} Ω`, "pat", r.pat.Rn <= 25 || r.pat.ok ? "ok" : "bad");
  } else
    N.push(
      `<div class="tn lock" style="padding-left:26px"><i class="dot"></i><span>Tableros y circuitos · complete los datos</span></div>`
    );
  add(
    1,
    "Parámetros de diseño",
    "param",
    document.querySelector("#fs-p-car .inv,#fs-p-cond .inv,#fs-p-prot .inv,#fs-p-pat .inv") ? "bad" : "ok"
  );
  if (r) add(1, "Metrado", "metrado", "ok");
  $("exTree").innerHTML = N.join("");
  const cuenta = $("exCount");
  cuenta.textContent = r ? r.circ.length : WSF.length;
  cuenta.title = r ? `${r.circ.length} circuitos` : `${WSF.length} datos pendientes`;
  cuenta.classList.toggle("falta", !r);
  // Contador de recomendaciones de diseño pendientes en el botón de la cinta
  const k = r ? recomendaciones(r).filter(x => !(ACEP[r.mode] || {})[x.id]).length : 0;
  document.querySelectorAll(".rbadge").forEach(b => {
    b.textContent = k;
    b.hidden = !k;
  });
}
function toast(t) {
  const x = $("toast");
  x.textContent = t;
  x.hidden = false;
  clearTimeout(toast.k);
  toast.k = setTimeout(() => (x.hidden = true), 2200);
}
/* Deshacer / rehacer */
const HIST = [],
  REDO = [];
let histT = null,
  histBlock = false;
const snap = () => {
  const o = estado();
  delete o.savedAt;
  return JSON.stringify(o);
};
function histPush() {
  if (histBlock) return;
  clearTimeout(histT);
  histT = setTimeout(() => {
    histT = null;
    const s = snap();
    if (HIST[HIST.length - 1] !== s) {
      HIST.push(s);
      if (HIST.length > 60) HIST.shift();
      REDO.length = 0;
    }
    qaHist();
  }, 500);
}
function qaHist() {
  $("qaUndo").disabled = HIST.length < 2;
  $("qaRedo").disabled = !REDO.length;
}
function histGo(dir) {
  if (histT) {
    clearTimeout(histT);
    histT = null;
    const s = snap();
    if (HIST[HIST.length - 1] !== s) {
      HIST.push(s);
      REDO.length = 0;
    }
  }
  if (dir < 0 && HIST.length < 2) return;
  if (dir > 0 && !REDO.length) return;
  if (dir < 0) REDO.push(HIST.pop());
  else HIST.push(REDO.pop());
  histBlock = true;
  const n = NODE;
  aplicar(JSON.parse(HIST[HIST.length - 1]));
  selNode(n);
  histBlock = false;
  qaHist();
  toast(dir < 0 ? "Cambio deshecho" : "Cambio rehecho");
}
addEventListener("keydown", e => {
  // Con el editor de diseño abierto, Ctrl+Z deshace en el editor (js/plano.js)
  if ($("ws").hidden || !(e.ctrlKey || e.metaKey) || document.body.classList.contains("ed-on")) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) {
    e.preventDefault();
    histGo(-1);
  } else if (k === "y" || (k === "z" && e.shiftKey)) {
    e.preventDefault();
    histGo(1);
  }
});
function wsRefresh(F) {
  WSF = F || [];
  histPush();
  const n = $("p_nombre").value.trim();
  $("wsName").textContent = n || "Proyecto sin nombre";
  $("wsModo").textContent = $("wsModoTxt").textContent = nomEdif();
  $("ws").dataset.mode = MODE;
  const r = LAST;
  panelProyecto();
  const ok = r && r.alims.every(a => a.ok) && r.circ.every(q => q.ok),
    hh = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  $("wsStatus").innerHTML =
    `<div>Modo edición</div><div>${AUTO ? `<span class="g">●</span> Cálculo automático` : `<span class="w">●</span> Cálculo manual · F9`}</div>` +
    (r
      ? `<div>MD ${fmt((r.mode === "multi" ? r.MD : r.md.MD) / 1000, 2)} kW</div><div>Alimentador ${r.alims[0].s.n}-1×${r.alims[0].S} mm² · ITM ${r.alims[0].s.tri ? 3 : 2}×${r.alims[0].itm} A</div><div>ΔV máx ${fmt(Math.max(...r.alims.map(a => a.dvAc), ...r.circ.map(c => c.dVt)), 2)} %</div><div class="${ok ? "g" : "b"}">${ok ? "CONFORME" : "REVISAR"}</div>`
      : `<div class="w">${WSF.length} dato${WSF.length === 1 ? "" : "s"} pendiente${WSF.length === 1 ? "" : "s"}</div>`) +
    `<div class="r">${n && !/^EJEMPLO\b/.test(n) ? `Guardado ${hh}` : /^EJEMPLO\b/.test(n) ? "Ejemplo · no se guarda" : "Sin nombre · no se guarda"} · ${VERSION}</div>`;
  if (!$("ws").hidden) exTree();
  if (FC_KEY && !FC_APL) renderFicha();
  if (TC_PEND) tcSync();
  if (FT_TAB) renderTablero();
}
/* Cinta de opciones y acciones */
$("ws").addEventListener("click", e => {
  const tr = e.target.closest("[data-tab-r]");
  if (tr) {
    RIB = tr.dataset.tabR;
    // Solo la cinta del espacio de trabajo (el editor de diseño tiene la suya, js/plano.js)
    document.querySelectorAll("#ws > .ap-tabs .tb").forEach(b => b.classList.toggle("on", b === tr));
    document.querySelectorAll("#ws > .ap-ribbon > .rib").forEach(x => (x.hidden = x.dataset.rib !== RIB));
    return;
  }
  const nd = e.target.closest("[data-node]");
  if (nd && !e.target.closest("[data-act]")) {
    if (nd.closest("#exTree")) selNode(nd.dataset.node);
    else abrirNodo(nd.dataset.node, nd.dataset.fs);
    return;
  }
  const vw = e.target.closest("[data-view]");
  if (vw && !e.target.closest("#results")) {
    if (!LAST) {
      toast("Complete los datos para ver los resultados");
      return;
    }
    verVista(vw.dataset.view);
    return;
  }
  const ac = e.target.closest("[data-act]");
  if (!ac) return;
  const a = ac.dataset.act;
  if (a === "nuevo") asistente(true, MODE);
  else if (a === "json") $("btnSave").click();
  else if (a === "guardar") {
    saveDraft();
    hdrEstado();
    toast(
      $("p_nombre").value.trim() ? "Proyecto guardado en este navegador" : "Asigne un nombre al proyecto para guardarlo"
    );
  } else if (a === "salir") cerrarWS(false);
  else if (a === "modo") {
    // Abre Datos del proyecto con el tipo de edificación enfocado: el cambio, que es grande, se confirma al aplicar
    abrirDatos("proy");
    enfocar('#dpBody [data-dp="_tipo"]');
  } else if (a === "datosplano") edVerEnPlano([], dcAbrir);
  else if (a === "calc") {
    calcularAhora();
    toast(LAST ? "Cálculo actualizado" : "Complete los datos para calcular");
  } else if (a === "xlsx") {
    if (DESACT) calcularAhora();
    if (!LAST) return toast("Complete los datos para exportar");
    $("btnXlsx").click();
    toast("Generando memoria de cálculo…");
  } else if (a === "print") {
    if (DESACT) calcularAhora();
    if (!LAST) return toast("Complete los datos para imprimir");
    $("btnPrint").click();
  } else if (a === "undo") histGo(-1);
  else if (a === "redo") histGo(1);
  else if (a === "cond") cuadroCond(true);
  else if (a === "tcargas") tablaCargas(ac.dataset.tct);
  else if (a === "params") parametros(true);
  else if (a === "dproy") datosProyecto(true, "proy");
  else if (a === "fichatab") {
    // El tablero seleccionado en el explorador (o el de su circuito) o, si no hay, el primero
    if (DESACT) calcularAhora();
    if (!LAST) return toast("Complete los datos para ver los tableros");
    const k = NODE.startsWith("tab:")
      ? NODE.slice(4)
      : NODE.startsWith("circ:")
        ? LAST.circ.find(q => q.key === NODE.slice(5))?.tab
        : "";
    fichaTablero(LAST.tabs.some(t => t.tab === k) ? k : LAST.tabs[0].tab);
  } else if (a === "ficha") {
    // El circuito seleccionado en el explorador o, si no hay, el primero
    if (DESACT) calcularAhora();
    if (!LAST || !LAST.circ.length) return toast("Complete los datos para ver los circuitos");
    const k = NODE.startsWith("circ:") ? NODE.slice(5) : "";
    fichaCirc(LAST.circ.some(q => q.key === k) ? k : LAST.circ[0].key);
  } else if (a === "rec") {
    if (!LAST) return toast("Complete los datos para ver los resultados");
    verVista("verif");
    setTimeout(
      () => document.querySelector("#results .rec-card")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80
    );
  } else if (a === "add:cctv" || a === "add:cctvS") {
    // Videovigilancia: carga especial (vivienda u otros usos) o carga común del edificio, con su circuito propio
    const nm = a === "add:cctv" ? "cargas" : "serv";
    readList(nm);
    LISTS[nm].arr.push({ ...LISTS[nm].nuevo(), nombre: "Sistema de videovigilancia (CCTV)", tipo: "otra" });
    renderList(nm);
    update();
    histPush();
    abrirLista(nm);
    toast("CCTV agregado: su potencia es la suma de cámaras, grabador (NVR/DVR) y switch PoE");
  } else if (a === "add:lumsP" || a === "add:tomsP") {
    const nm = a === "add:lumsP" ? "lums" : "toms";
    readList(nm);
    LISTS[nm].arr.push({ ...LISTS[nm].nuevo(), piso: pisos.length + 1 });
    renderList(nm);
    update();
    histPush();
    abrirLista(nm);
    toast(`Elemento agregado en el ${ORD(pisos.length + 1)} piso: complete sus datos`);
  } else if (a.startsWith("add:")) {
    const nm = a.slice(4);
    $("add_" + nm).click();
    histPush();
    abrirLista(nm);
    toast("Elemento agregado: complete sus datos");
  } else if (a.startsWith("web:")) {
    cerrarWS(true);
    setTab(a.slice(4));
  }
});
document.addEventListener(
  "click",
  e => {
    if (!e.target.closest("[data-dl]")) return;
    if (DESACT) calcularAhora();
    if (e.target.closest("#ws [data-dl]") && !LAST) toast("Complete los datos para descargar el unifilar");
  },
  true
);
$("expMsg").textContent = "";
new MutationObserver(() => {
  const t = $("expMsg").textContent;
  if (t && !$("ws").hidden) toast(t);
}).observe($("expMsg"), { childList: true, characterData: true, subtree: true });

/* Asistente de nuevo proyecto */
function asistente(abrir, m) {
  const w = $("wizard");
  w.hidden = !abrir;
  document.body.classList.toggle("wl-open", abrir);
  if (!abrir) return;
  ["wz_nombre", "wz_prop", "wz_ubic", "wz_proy", "wz_cip"].forEach(k => ($(k).value = ""));
  $("wzErr").hidden = true;
  $("wz_nombre").classList.remove("falta");
  const r = document.querySelector(`input[name="wz_mode"][value="${["multi", "com"].includes(m) ? m : "uni"}"]`);
  if (r) r.checked = true;
  $("wz_sist").value = m === "uni" ? "mono220" : "tri380";
  $("wzUsoBox").hidden = m !== "com";
  setTimeout(() => {
    if (!$("wizard").contains(document.activeElement) || document.activeElement === document.body)
      $("wz_nombre").focus();
  }, 50);
}
document.querySelectorAll('input[name="wz_mode"]').forEach(r =>
  r.addEventListener("change", () => {
    $("wz_sist").value = r.value === "uni" ? "mono220" : "tri380";
    $("wzUsoBox").hidden = r.value !== "com";
  })
);
$("wizard").addEventListener("click", e => {
  const b = e.target.closest("[data-wz]");
  if (e.target.id === "wizard" || (b && b.dataset.wz === "close")) return asistente(false);
  if (!b || b.dataset.wz !== "ok") return;
  const nom = $("wz_nombre").value.trim();
  if (!nom) {
    $("wzErr").hidden = false;
    $("wz_nombre").classList.add("falta");
    $("wz_nombre").focus();
    return;
  }
  // «Comercial y otros usos» es el modo unifamiliar con un uso de la Tabla 14 o de las Reglas 050-204 a 050-208
  const md0 = radio("wz_mode") || "uni",
    com = md0 === "com",
    m = com ? "uni" : md0,
    o = proyectoVacio(m),
    sist = $("wz_sist").value;
  if (com) {
    o.uso = $("wz_uso").value;
    o.tg_p = o.tc_p = String(VA_TOMA_COM);
  }
  o.p_nombre = nom.replace(/[<>]/g, "");
  o.p_prop = $("wz_prop").value.replace(/[<>]/g, "");
  o.p_ubic = $("wz_ubic").value.replace(/[<>]/g, "");
  o.p_proy = $("wz_proy").value.replace(/[<>]/g, "");
  o.p_cip = $("wz_cip").value.replace(/[<>]/g, "");
  if (m === "multi") o.sistG = sist;
  else o.sist = sist;
  asistente(false);
  aplicar(o);
  VIEW = "unifilar";
  HIST.length = 0;
  REDO.length = 0;
  abrirWS("vivienda");
  calcularAhora();
  toast("Proyecto creado: complete los datos marcados en ámbar");
});
$("wizard").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.tagName === "INPUT") {
    e.preventDefault();
    $("wizard").querySelector('[data-wz="ok"]').click();
  }
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("wizard").hidden) asistente(false);
});

/* Efectos de cambiar un dato del proyecto, además de recalcular (el recálculo lo pide quien lo cambia):
   - esqPisos (circuitos del 1er piso en el TG o en un TD-1): cambia la lista de tableros de las cargas especiales;
   - uso: 250 VA por tomacorriente en usos comerciales (criterio de diseño) y 180 W en vivienda, salvo que el usuario
     haya puesto otro valor, y la pantalla del uso elegido. */
function efectosDato(k) {
  if (k === "esqPisos") renderList("cargas");
  else if (k === "uso") {
    const com = usoAct() !== "viv";
    ["tg_p", "tc_p"].forEach(c => {
      const v = PROY[c];
      if (com && v === "180") ponerDato(c, String(VA_TOMA_COM));
      else if (!com && v === String(VA_TOMA_COM)) ponerDato(c, "180");
    });
    uiUso();
  }
}
// Cambia un dato del proyecto desde el código (ventanas, cinta): PROY, el campo y sus efectos
function cambiarDato(k, v) {
  const a = PROY[k];
  ponerDato(k, v);
  if (PROY[k] !== a) efectosDato(k);
}
// Cambia el sistema eléctrico (sist en la vivienda, sistG en el edificio): PROY y el botón de opción
function cambiarSistema(nm, v) {
  const r = document.querySelector(`input[name="${nm}"][value="${v}"]`);
  if (!r) return;
  r.checked = true;
  PROY[nm] = v;
}
$("esqPisos").addEventListener("change", () => efectosDato("esqPisos"));
$("uso").addEventListener("change", () => {
  efectosDato("uso");
  calcularAhora();
});

/* Diálogo de advertencia antes de desactivar una opción */
function confirmar(tit, html, si, fn) {
  const d = $("cfmDlg");
  $("cfmT").textContent = tit;
  $("cfmTxt").innerHTML = html;
  $("cfmSi").textContent = si;
  confirmar.fn = fn;
  d.hidden = false;
  document.body.classList.add("wl-open");
  setTimeout(() => d.querySelector(".btn.sec").focus(), 30);
}
function cerrarCfm(ok) {
  const d = $("cfmDlg");
  if (d.hidden) return;
  d.hidden = true;
  document.body.classList.remove("wl-open");
  const fn = confirmar.fn;
  confirmar.fn = null;
  if (fn) fn(ok);
}
$("cfmDlg").addEventListener("click", e => {
  if (e.target.id === "cfmDlg") return cerrarCfm(false);
  const b = e.target.closest("[data-cf]");
  if (b) cerrarCfm(b.dataset.cf === "si");
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("cfmDlg").hidden) cerrarCfm(false);
});

/* Opciones de la cinta: cálculo automático y resaltar pendientes */
const OPKEY = { auto: "jmg-electric-auto", falta: "jmg-electric-resaltar" };
const opGuardar = (k, v) => {
  try {
    localStorage.setItem(OPKEY[k], v ? "1" : "0");
  } catch (e) {}
};
function setAuto(v) {
  AUTO = v;
  $("optAuto").checked = v;
  opGuardar("auto", v);
  calcularAhora();
  toast(v ? "Cálculo automático activado" : "Cálculo manual: use Calcular ahora o F9");
}
function setFalta(v) {
  $("optFalta").checked = v;
  document.body.classList.toggle("sin-falta", !v);
  opGuardar("falta", v);
}
$("optAuto").addEventListener("click", e => {
  if (e.target.checked) return setAuto(true);
  e.preventDefault();
  confirmar(
    "¿Desactivar el cálculo automático?",
    `<p>Mientras esté desactivado, <b>los resultados, el cuadro de cargas, el diagrama unifilar y las verificaciones no se actualizarán</b> al cambiar los datos. Lo que vea en pantalla podría no corresponder a lo ingresado; por ejemplo, un conductor o un interruptor calculado con una longitud anterior.</p><p>Para actualizar use <b>Calcular ahora</b> o la tecla <b>F9</b>. Al exportar la memoria Excel, imprimir el PDF o descargar el unifilar se recalcula automáticamente.</p>`,
    "Desactivar",
    ok => {
      if (ok) setAuto(false);
    }
  );
});
$("optFalta").addEventListener("click", e => {
  if (e.target.checked) return setFalta(true);
  e.preventDefault();
  confirmar(
    "¿Dejar de resaltar los datos pendientes?",
    `<p>Los datos obligatorios que faltan <b>ya no se marcarán en ámbar</b> en los formularios, y será más fácil pasar alguno por alto.</p><p>Los resultados seguirán sin calcularse hasta completar todos los datos. La lista de pendientes continuará visible en el panel central, en el explorador y en la barra de estado.</p>`,
    "Dejar de resaltar",
    ok => {
      if (ok) setFalta(false);
    }
  );
});
document.addEventListener("click", e => {
  if (e.target.closest("[data-calcnow]")) {
    calcularAhora();
    toast("Cálculo actualizado");
  }
});
addEventListener("keydown", e => {
  if (e.key === "F9" && !$("ws").hidden && !document.body.classList.contains("ed-on")) {
    e.preventDefault();
    calcularAhora();
    toast(LAST ? "Cálculo actualizado" : "Complete los datos para calcular");
  }
});
try {
  if (localStorage.getItem(OPKEY.auto) === "0") {
    AUTO = false;
    $("optAuto").checked = false;
  }
  if (localStorage.getItem(OPKEY.falta) === "0") setFalta(false);
} catch (e) {}

/* Paneles laterales: cerrar, volver a abrir y cambiar el ancho arrastrando el borde */
const PANE = {
  left: { cls: ".ap-left", v: "--wl", key: "jmg-electric-panel-izq", on: true, w: null },
  // Cerrado por defecto desde la v2.9.1: todo se edita en ventanas; se respeta la elección que guardó el usuario
  right: { cls: ".ap-right", v: "--wr", key: "jmg-electric-panel-der", on: false, w: null }
};
const apMain = document.querySelector("#ws .ap-main");
function panes(guardar) {
  Object.entries(PANE).forEach(([k, p]) => {
    document.querySelector("#ws " + p.cls).hidden = !p.on;
    if (!p.on) apMain.style.setProperty(p.v, "0px");
    else if (p.w) apMain.style.setProperty(p.v, p.w + "px");
    else apMain.style.removeProperty(p.v);
    document.querySelectorAll(`.pane-tg[data-pane="${k}"]`).forEach(b => b.setAttribute("aria-pressed", p.on));
    if (guardar)
      try {
        localStorage.setItem(p.key, JSON.stringify({ on: p.on, w: p.w }));
      } catch (e) {}
  });
}
try {
  Object.values(PANE).forEach(p => {
    const o = JSON.parse(localStorage.getItem(p.key) || "null");
    if (o) {
      p.on = o.on !== false;
      p.w = +o.w > 0 ? +o.w : null;
    }
  });
} catch (e) {}
panes(false);
document.addEventListener("click", e => {
  const b = e.target.closest(".pane-tg,.ph-x");
  if (!b) return;
  const p = PANE[b.dataset.pane];
  p.on = b.classList.contains("ph-x") ? false : !p.on;
  panes(true);
  toast(p.on ? "Panel visible" : "Panel oculto: vuelva a abrirlo con los botones de la barra superior");
});
document.querySelectorAll("#ws .sp").forEach(sp => {
  const k = sp.dataset.sp,
    p = PANE[k];
  sp.addEventListener("pointerdown", e => {
    e.preventDefault();
    try {
      sp.setPointerCapture(e.pointerId);
    } catch (_) {}
    sp.classList.add("drag");
    document.body.classList.add("arrastrando");
    const mv = ev => {
      const r = apMain.getBoundingClientRect(),
        otro = PANE[k === "left" ? "right" : "left"],
        wo = otro.on ? document.querySelector("#ws " + otro.cls).offsetWidth : 0;
      // Las coordenadas del mouse están en píxeles de pantalla; se dividen por la escala del espacio de trabajo
      const S = parseFloat(getComputedStyle($("ws")).zoom) || 1,
        w = (k === "left" ? ev.clientX - r.left : r.right - ev.clientX) / S;
      p.w = Math.round(Math.max(170, Math.min(640, r.width / S - wo - 360, w)));
      panes(false);
    };
    const up = () => {
      sp.classList.remove("drag");
      document.body.classList.remove("arrastrando");
      removeEventListener("pointermove", mv);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      panes(true);
    };
    addEventListener("pointermove", mv);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  });
  sp.addEventListener("dblclick", () => {
    p.w = null;
    panes(true);
    toast("Ancho restablecido");
  });
});
// Rueda del mouse sobre la cinta: desplaza los grupos hacia los lados cuando no caben en la pantalla
document.querySelector(".ap-ribbon").addEventListener(
  "wheel",
  e => {
    const el = e.currentTarget;
    if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  },
  { passive: false }
);
