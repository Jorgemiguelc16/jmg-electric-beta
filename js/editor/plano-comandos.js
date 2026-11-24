/* EDITOR DE DISEÑO · PANELES Y COMANDOS
   Panel izquierdo, mostrar el editor, cinta plegable, barra de navegación, comandos por teclado, atajos, buscar,
   modo presentación y autoguardado.
   Antes era parte de js/plano.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Panel izquierdo: plantas y resumen del diseño (las capas están en su ventana, js/editor/capas.js) ---------- */
function plPanel() {
  const m = PL_MOD;
  $("plLado").hidden = plPanel.oculto;
  $("edProp").hidden = edProps.oculto;
  dsResumen();
  if (!m || !EPL) {
    $("plNPl").textContent = "";
    $("plPlantas").innerHTML = "";
    return;
  }
  const P = EPL.plantas;
  $("plNPl").textContent = P.length || "";
  $("plPlantas").innerHTML = P.length
    ? P.map(
        (p, i) =>
          `<div class="pl-fila" data-plp="${i}"><button type="button" class="pl-nom" data-plv="${i}" title="Ver la planta">${esc(p.n)}</button><select class="pl-piso" data-plpi="${i}" title="Piso del cálculo al que pertenece esta planta (sus áreas, tableros y montantes)" aria-label="Piso del cálculo">${DP_PISOS.map(([v, t]) => `<option value="${v}"${v === plPisoPlanta(p, i) ? " selected" : ""}>${t}</option>`).join("")}</select><span class="pl-dim">${(n => (n ? n + " elem. · " : ""))(dsD() ? dsD().els.filter(el => dpPlantaEl(el) === i).length : 0)}${plFm(p.x1 - p.x0)} × ${plFm(p.y1 - p.y0)} m</span><button type="button" class="pl-x" data-plq="${i}" title="Quitar la planta (el dibujo no cambia)" aria-label="Quitar la planta">×</button></div>`
      ).join("")
    : `<p class="pl-nota">Encuadre cada planta del edificio con <b>Encuadrar planta</b>: así se ve con un clic.</p>`;
}
$("plLado").addEventListener("change", e => {
  const s = e.target.closest("[data-plpi]");
  if (!s) return;
  EPL.plantas[+s.dataset.plpi].piso = +s.value;
  edCambio();
});
$("plLado").addEventListener("click", e => {
  const v = e.target.closest("[data-plv]"),
    q = e.target.closest("[data-plq]");
  if (v) {
    const p = EPL.plantas[+v.dataset.plv];
    plVer(p.x0, p.y0, p.x1, p.y1);
  } else if (q) {
    const i = +q.dataset.plq;
    confirmar(
      "¿Quitar la planta?",
      `<p>Se quita el encuadre <b>${esc(EPL.plantas[i].n)}</b>. El plano de arquitectura no cambia y puede volver a encuadrarla.</p>`,
      "Quitar",
      ok => {
        if (!ok) return;
        EPL.plantas.splice(i, 1);
        edCambio();
      }
    );
  }
});

/* ---------- Mostrar el editor ---------- */
function plMostrar() {
  const m = PL_MOD,
    hay = !!EPL;
  $("plVacio").hidden = !!(m && hay);
  if (!(m && hay)) {
    $("plVacioT").innerHTML = hay
      ? `El plano <b>${esc(EPL.nombre)}</b> no está guardado en este navegador`
      : "Abra el plano de arquitectura en DXF";
    $("plVacioS").innerHTML = hay
      ? "Ábralo de nuevo para continuar: se conservan la escala, las capas ocultas y las plantas del proyecto."
      : "Desde AutoCAD o cualquier programa de dibujo, con sus medidas reales. También puede arrastrar el archivo aquí.";
  }
  document.querySelectorAll("#editor [data-pl-req]").forEach(b => (b.disabled = !(m && hay)));
  $("plTenue").checked = !!(EPL && EPL.tenue);
  const u = $("plUnidad");
  u.disabled = !(m && hay);
  if (EPL) {
    const o = [...u.options].find(x => Math.abs(+x.value - EPL.f) < 1e-12);
    if (o) u.value = o.value;
    else {
      u.options[3].hidden = false;
      u.options[3].textContent = `1 u = ${fmt(EPL.f, EPL.f < 0.01 ? 4 : 3)} m`;
      u.value = "x";
    }
  }
  $("plEstadoU").textContent = EPL ? `Unidad: ${plNomUnidad(EPL.f)} · ${PL_DE[EPL.de] || ""}` : "";
  $("plEstadoA").textContent =
    m && hay ? `${EPL.nombre} · ${Object.keys(m.capas).length} capas · ${m.nEnt.toLocaleString("es-PE")} objetos` : "";
  edBotonesEstado();
  dsCinta();
  plPanel();
  // Pasos del diseño y cálculo en vivo (con una pausa: la revisión recorre todo el diseño)
  clearTimeout(ED.tVivo);
  ED.tVivo = setTimeout(() => typeof edVivo === "function" && edVivo(), 300);
  edProps();
  if (ED.abierto) {
    plTam();
    plDibujar();
  }
}
/* ---------- Cinta plegable: más espacio de trabajo (botón ⌃, Ctrl+F1 o doble clic en una pestaña) ---------- */
function edCinta(alternar) {
  if (alternar) {
    DSU.cintaMin = !DSU.cintaMin;
    dsGuardarPref();
  }
  $("editor").classList.toggle("ed-min", !!DSU.cintaMin);
  if (alternar) toast(DSU.cintaMin ? "Cinta oculta: clic en una pestaña para verla de nuevo" : "Cinta visible");
}
$("editor").addEventListener("dblclick", e => {
  if (e.target.closest("[data-tab-e]")) edCinta(true);
});
document.querySelector("#editor [data-edplegar]").addEventListener("click", () => edCinta(true));

/* ---------- Barra de navegación sobre el plano: visible, orientación y posición (preferencias del usuario) ---------- */
function plNavPoner() {
  const n = $("plNav"),
    p = DSU.navPos;
  n.hidden = DSU.nav === false;
  n.classList.toggle("horiz", !!DSU.navH);
  n.classList.toggle("libre", !!p);
  if (p) {
    const W = plLienzo.clientWidth,
      H = plLienzo.clientHeight,
      w = n.offsetWidth,
      h = n.offsetHeight;
    n.style.left = Math.max(2, Math.min(W - w - 2, p[0] * W)) + "px";
    n.style.top = Math.max(2, Math.min(H - h - 2, p[1] * H)) + "px";
    n.style.right = "auto";
  } else n.style.left = n.style.top = n.style.right = "";
}
$("plNav").addEventListener("click", e => {
  const b = e.target.closest("[data-navg]");
  if (!b) return;
  if (b.dataset.navg === "ocultar") {
    DSU.nav = false;
    toast("Barra de navegación oculta: se vuelve a mostrar en Vista › Barra de navegación");
  } else DSU.navH = !DSU.navH;
  dsGuardarPref();
  dsCinta();
  plNavPoner();
});
{
  const asa = document.querySelector("#plNav .pl-nav-asa");
  asa.addEventListener("pointerdown", e => {
    e.preventDefault();
    e.stopPropagation();
    const n = $("plNav"),
      S = parseFloat(getComputedStyle($("ws")).zoom) || 1,
      r0 = n.getBoundingClientRect(),
      dx = (e.clientX - r0.left) / S,
      dy = (e.clientY - r0.top) / S;
    try {
      asa.setPointerCapture(e.pointerId);
    } catch (_) {}
    n.classList.add("drag");
    const mv = ev => {
      const r = plLienzo.getBoundingClientRect();
      DSU.navPos = [
        ((ev.clientX - r.left) / S - dx) / plLienzo.clientWidth,
        ((ev.clientY - r.top) / S - dy) / plLienzo.clientHeight
      ];
      plNavPoner();
    };
    const up = () => {
      n.classList.remove("drag");
      removeEventListener("pointermove", mv);
      removeEventListener("pointerup", up);
      dsGuardarPref();
    };
    addEventListener("pointermove", mv);
    addEventListener("pointerup", up);
  });
  asa.addEventListener("dblclick", () => {
    DSU.navPos = null;
    dsGuardarPref();
    plNavPoner();
  });
}
new ResizeObserver(() => ED.abierto && plNavPoner()).observe(plLienzo);

/* ---------- Comandos por teclado ----------
   Como la línea de comandos de AutoCAD: se escribe el comando y se pulsa Intro; Intro sin herramienta repite el
   último. Los nombres van en español (y algunos como en AutoCAD). */
const ED_CMD = {
  L: ["lin", "Línea"],
  LINEA: ["lin", "Línea"],
  PL: ["pol", "Polilínea"],
  REC: ["rect", "Rectángulo"],
  CI: ["cir", "Círculo"],
  T: ["tubT", "Tubería en techo o pared"],
  TT: ["tubT", "Tubería en techo o pared"],
  TP: ["tubP", "Tubería en piso"],
  TX: ["txt", "Texto"],
  CA: ["cotA", "Cota alineada"],
  CL: ["cotL", "Cota lineal"],
  D: ["dir", "Directriz"],
  LE: ["ley", "Leyenda"],
  CO: ["duplicar", "Duplicar lo elegido"],
  GI: ["girar", "Girar lo elegido"],
  ES: ["espejo", "Espejo"],
  MI: ["espejo", "Espejo"],
  FI: ["fila", "Copiar en fila"],
  AR: ["fila", "Copiar en fila"],
  E: ["borrar", "Borrar lo elegido"],
  SU: ["borrar", "Borrar lo elegido"],
  Z: ["ajustar", "Ajustar a la pantalla"],
  ZV: ["zventana", "Zoom ventana"],
  ZA: ["zprev", "Vista anterior"],
  M: ["mano", "Mano"],
  P: ["mano", "Mano"],
  CAP: ["capas", "Capas"],
  DI: ["dist", "Distancia"],
  ME: ["rec", "Medir recorrido"],
  REV: ["revisar", "Revisar diseño"],
  RE: ["revisar", "Revisar diseño"],
  TA: ["col:tab", "Tablero"],
  LU: ["col:luz", "Salida de alumbrado"],
  TO: ["col:toma", "Tomacorriente"],
  IN: ["col:int", "Interruptor"],
  BL: ["bloque", "Guardar como bloque"],
  RU: ["ruta", "Ruta automática"],
  VE: ["versiones", "Versiones"],
  PLA: ["plantillas", "Plantillas"],
  BU: ["buscar", "Buscar en el plano"],
  REP: ["rep", "Repartir en ambiente"],
  RM: ["rmur", "A lo largo del muro"],
  MET: ["metrado", "Metrado del diseño"],
  AA: ["areaC", "Área de un ambiente (clic adentro)"],
  AX: ["areaE", "Contorno exterior del piso (clic adentro)"],
  APU: ["areaP", "Área por puntos"],
  ARE: ["areaR", "Área rectangular"],
  DC: ["calc", "Datos para el cálculo"],
  LUM: ["lums", "Tipos de luminaria"],
  AMB: ["amb", "Ambientes"],
  CU: ["cua", "Cuadro de circuitos"],
  PRE: ["presentar", "Presentación"]
};
function edComando(letra) {
  plPedir(
    "Comando",
    letra,
    v => {
      plPedir(null);
      edEjecutar(String(v).trim().toUpperCase());
    },
    true
  );
  plOrden(
    `<b>Comandos</b> · L línea · T tubería · TP en piso · TX texto · CA cota · LE leyenda · CO duplicar · GI girar · ES espejo · FI en fila · E borrar · Z ajustar · ZV zoom ventana · M mano · REV revisar · Intro repite el último`
  );
}
function edEjecutar(c) {
  const u = atjUsuario()[c],
    x = u ? ED_CMD[u] || Object.values(ED_CMD).find(v => v[0] === u) : ED_CMD[c];
  if (!x) {
    plOrden();
    return toast(`Comando «${c}» desconocido · pruebe: ${Object.keys(ED_CMD).slice(0, 14).join(", ")}…`);
  }
  ED.ultCmd = c;
  const a = x[0];
  if (a === "duplicar") {
    if (!DS_SEL.size) return toast("Elija primero lo que quiere duplicar");
    dsCopiar();
    return dsPegar();
  }
  if (a === "girar") return dsGirar();
  if (a === "borrar") return edBorrar(false);
  if (a === "fila" || a === "espejo") return dsIniciarCopia(a);
  if (a === "ajustar") return plAjustar();
  if (a === "zprev") return plVistaAnterior();
  if (a === "capas") return capasAbrir();
  if (a === "revisar") return revAbrir();
  if (a === "bloque") return dpGuardarBloque();
  if (a === "ruta") return dpRuta();
  if (a === "versiones") return verAbrir();
  if (a === "plantillas") return plaAbrir();
  if (a === "buscar") return buAbrir();
  if (a === "metrado") return metAbrir();
  if (a === "calc") return dcAbrir();
  if (a === "lums") return lumAbrir();
  if (a === "presentar") return edPresentar(true);
  if (a === "rep" || a === "rmur") return dpIniciarRep(a);
  if (a.startsWith("col:") || DS_HERR[a]) DS_SEL.clear();
  plHerr(a);
  toast(x[1]);
}

/* ---------- Atajos de teclado: comandos de la plataforma y los del usuario (como el archivo de alias de AutoCAD) ---------- */
const ATJ_K = (BETA ? "jmg-electric-beta" : "jmg-electric") + "-atajos";
function atjUsuario() {
  try {
    const o = JSON.parse(localStorage.getItem(ATJ_K) || "{}");
    return o && typeof o === "object" ? o : {};
  } catch (e) {
    return {};
  }
}
function atjAbrir() {
  $("atjDlg").hidden = false;
  vwFondo();
  atjRender();
}
function atjCerrar() {
  $("atjDlg").hidden = true;
  vwFondo();
}
function atjRender() {
  const U = atjUsuario(),
    acciones = new Map();
  Object.entries(ED_CMD).forEach(([k, [a, n]]) => {
    if (!acciones.has(a)) acciones.set(a, { n, k: [] });
    acciones.get(a).k.push(k);
  });
  $("atjLista").innerHTML =
    `<table class="atj-t"><thead><tr><th>Comando</th><th>De la plataforma</th><th>Los suyos (separados por coma)</th></tr></thead><tbody>${[
      ...acciones
    ]
      .map(
        ([a, o]) =>
          `<tr><td>${esc(o.n)}</td><td class="atj-k">${o.k.join(", ")}</td><td><input type="text" data-atj-a="${esc(a)}" value="${esc(
            Object.keys(U)
              .filter(k => U[k] === a)
              .join(", ")
          )}" maxlength="40" spellcheck="false"></td></tr>`
      )
      .join("")}</tbody></table>` +
    `<p class="pl-nota">Teclas de siempre: <b>R</b> girar · <b>B</b> biblioteca · <b>Supr</b> borrar · <b>Ctrl+C/V/X/Z/Y</b> · <b>Ctrl+F</b> buscar · <b>F3</b> enganche · <b>F7</b> rejilla · <b>F8</b> orto · <b>F9</b> forzar · <b>F10</b> polar · <b>Ctrl+F1</b> cinta.</p>`;
}
$("atjDlg").addEventListener("change", e => {
  const i = e.target.closest("[data-atj-a]");
  if (!i) return;
  const a = i.dataset.atjA,
    U = atjUsuario();
  Object.keys(U).forEach(k => U[k] === a && delete U[k]);
  i.value
    .toUpperCase()
    .split(/[\s,;]+/)
    .map(k => k.replace(/[^A-ZÑ0-9]/g, "").slice(0, 6))
    .filter(k => k && /^[A-ZÑ]/.test(k))
    .forEach(k => (U[k] = a));
  try {
    localStorage.setItem(ATJ_K, JSON.stringify(U));
  } catch (er) {}
  atjRender();
  toast("Atajos guardados");
});
$("atjDlg").addEventListener("click", e => {
  if (e.target.id === "atjDlg") return atjCerrar();
  const b = e.target.closest("[data-atj]");
  if (!b) return;
  if (b.dataset.atj === "cerrar") atjCerrar();
  else if (b.dataset.atj === "restablecer") {
    try {
      localStorage.removeItem(ATJ_K);
    } catch (er) {}
    atjRender();
  }
});
$("atjDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    atjCerrar();
  }
  e.stopPropagation();
});

/* ---------- Buscar en el plano (Ctrl+F): circuitos, tableros, artefactos y textos del diseño y del plano ---------- */
let BU_L = [];
function buAbrir() {
  if (!EPL || !PL_MOD) return;
  $("edBuscar").hidden = false;
  $("buQ").value = "";
  buRender();
  setTimeout(() => $("buQ").focus(), 20);
}
function buCerrar() {
  $("edBuscar").hidden = true;
  $("buQ").blur();
}
function buRender() {
  const q = biNorm($("buQ").value.trim()),
    D = dsD(),
    out = [];
  if (q) {
    // Circuitos (con su tablero)
    const cirs = new Map();
    D.els.forEach(e => {
      if (!e.cir) return;
      const tb = e.tab && D.els.find(x => x.id === e.tab),
        k = e.cir + "|" + (e.tab || "");
      if (!cirs.has(k)) cirs.set(k, { n: `Circuito ${e.cir}${tb ? " · " + (tb.nom || "tablero") : ""}`, ids: [] });
      cirs.get(k).ids.push(e.id);
    });
    cirs.forEach(c => biNorm(c.n).includes(q) && out.push({ t: c.n, d: `${c.ids.length} elementos`, ids: c.ids }));
    // Tableros, artefactos y textos del diseño
    const porTipo = new Map();
    D.els.forEach(e => {
      if (e.k === "tab" && biNorm(`tablero ${e.nom || ""}`).includes(q))
        out.push({ t: `Tablero ${e.nom || ""}`, d: `${e.nc || 0} circuitos`, ids: [e.id] });
      else if (e.t === "sim" && DS_CAT[e.k] && biNorm(`${DS_CAT[e.k].n} ${DS_CAT[e.k].c}`).includes(q)) {
        const k = e.k;
        if (!porTipo.has(k)) porTipo.set(k, []);
        porTipo.get(k).push(e.id);
      } else if ((e.t === "txt" || e.t === "dir") && biNorm(e.s || "").includes(q))
        out.push({ t: e.s, d: e.t === "txt" ? "texto" : "directriz", ids: [e.id] });
    });
    porTipo.forEach((ids, k) => out.push({ t: DS_CAT[k].n, d: `${ids.length} en el diseño`, ids }));
    // Textos del plano de arquitectura (ambientes, por ejemplo)
    const oc = new Set(EPL.ocultas);
    PL_MOD.textos.forEach(t => {
      if (out.length < 60 && !oc.has(t.capa) && !PL_BORR.has(t.e) && biNorm(t.s).includes(q))
        out.push({ t: t.s.replace(/\n/g, " "), d: "plano", pt: [t.x, t.y] });
    });
  }
  BU_L = out.slice(0, 60);
  $("buRes").innerHTML = !q
    ? "<p>Escriba un circuito (C-3), un tablero, un artefacto o el nombre de un ambiente.</p>"
    : BU_L.length
      ? BU_L.map(
          (o, i) =>
            `<button type="button" data-bu="${i}"${i ? "" : ' class="on"'}><span>${esc(o.t)}</span><small>${esc(o.d)}</small></button>`
        ).join("")
      : "<p>Nada coincide.</p>";
}
function buIr(i) {
  const o = BU_L[i];
  if (!o) return;
  buCerrar();
  DS_SEL.clear();
  PL_ASEL.clear();
  if (o.pt) {
    const m = 3 / EPL.f;
    plVer(o.pt[0] - m, o.pt[1] - m, o.pt[0] + m, o.pt[1] + m);
  } else {
    o.ids.forEach(id => DS_SEL.add(id));
    const bb = dsSel().map(dsBBox),
      x0 = Math.min(...bb.map(b => b[0])),
      y0 = Math.min(...bb.map(b => b[1])),
      x1 = Math.max(...bb.map(b => b[2])),
      y1 = Math.max(...bb.map(b => b[3])),
      m = Math.max(x1 - x0, y1 - y0, 3 / EPL.f) * 0.3;
    plVer(x0 - m, y0 - m, x1 + m, y1 + m);
  }
  edProps();
  plSobreDibujar();
}
$("buQ").addEventListener("input", buRender);
$("buQ").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    buCerrar();
  } else if (e.key === "Enter") {
    e.preventDefault();
    buIr(0);
  }
  e.stopPropagation();
});
$("buRes").addEventListener("click", e => {
  const b = e.target.closest("[data-bu]");
  if (b) buIr(+b.dataset.bu);
});

/* ---------- Modo presentación: pantalla completa, solo el plano (Esc para salir) ---------- */
function edPresentar(on) {
  $("editor").classList.toggle("ed-pres", on);
  if (on) {
    toast("Presentación: Esc para salir");
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  } else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  plTam();
  plDibujar();
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && $("editor").classList.contains("ed-pres")) edPresentar(false);
});

/* ---------- Autoguardado del editor ----------
   Cada 30 s, si hay cambios sin aplicar, se guarda una copia en este navegador; al volver a abrir el editor del
   mismo proyecto (por ejemplo, después de cerrarse el navegador), se ofrece recuperarla. */
const ED_REC = (BETA ? "jmg-electric-beta" : "jmg-electric") + "-editor-recuperacion";
function edAutoguardar(forzar) {
  if (!ED.abierto || !EPL) return;
  const t = Date.now();
  if (!forzar && t - (ED.recT || 0) < 30000) return;
  ED.recT = t;
  const s = edSnap();
  try {
    if (s === ED.base) {
      localStorage.removeItem(ED_REC);
      if (typeof alPut === "function" && AL_HAY) alPut(ED_REC).catch(() => {});
    } else localStorage.setItem(ED_REC, JSON.stringify({ f: t, p: $("p_nombre").value.trim(), s }));
  } catch (e) {
    /* Un diseño grande no cabe en el almacenamiento pequeño (unos 5 MB): la copia va a la base del navegador y aquí
       queda una marca con su fecha */
    if (typeof alPut === "function" && AL_HAY) {
      const r = { f: t, p: $("p_nombre").value.trim(), s };
      alPut(ED_REC, r).catch(() => {});
      try {
        localStorage.setItem(ED_REC, JSON.stringify({ f: t, p: r.p, idb: true }));
      } catch (e2) {}
    }
  }
}
setInterval(() => edAutoguardar(true), 30000);
addEventListener("pagehide", () => edAutoguardar(true));
async function edRecuperar() {
  let r = null;
  try {
    r = JSON.parse(localStorage.getItem(ED_REC) || "null");
    // La copia grande está en la base del navegador
    if (r && r.idb && typeof alLeer === "function") r = (await alLeer(ED_REC)) || null;
  } catch (e) {}
  if (!r || r.f >= (ED.t0 || 0) || r.p !== $("p_nombre").value.trim() || r.s === ED.base) return;
  const f = new Date(r.f);
  confirmar(
    "¿Recuperar el diseño sin guardar?",
    `<p>Hay cambios del editor de este proyecto del <b>${f.toLocaleDateString("es-PE")} a las ${f.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</b> que no llegaron a guardarse (por ejemplo, porque se cerró el navegador).</p><p>¿Quiere recuperarlos? Se guardan en el proyecto al instante.</p>`,
    "Recuperar",
    ok => {
      try {
        localStorage.removeItem(ED_REC);
        if (typeof alPut === "function" && AL_HAY) alPut(ED_REC).catch(() => {});
      } catch (e) {}
      if (!ok) return;
      EPL = JSON.parse(r.s);
      dsAsegurar();
      if (EPL && (PL_SHA !== EPL.sha || !PL_MOD)) plCargarGuardado();
      else plPreparar();
      edCambio();
      toast("Diseño recuperado y guardado en el proyecto");
    }
  );
}
