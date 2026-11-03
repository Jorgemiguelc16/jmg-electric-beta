/* EDITOR DE CARGAS ESPECIALES
   Ventana (cinta: Cargas › Editor de cargas) al estilo de la ficha del circuito: a la izquierda la lista de cargas
   (agregar, duplicar, quitar) y a la derecha los datos de la carga elegida en dos columnas, botones rápidos con
   las cargas típicas y una franja con el resultado de su circuito. Vivienda y otros usos: lista «cargas».
   Edificio: pestañas Departamentos (lista «cargasT») y Servicios generales (lista «serv»).
   Se trabaja sobre una copia (TC_PEND) hasta «Aplicar» o «Aceptar»; entonces la copia reemplaza a la lista del
   proyecto, se recalcula y se guarda en el historial, igual que al editar en el panel Propiedades. Mientras haya
   cambios, la franja muestra una vista previa: el mismo cálculo (calcUni/calcMulti) hecho con la copia, sin
   cambiar el proyecto (las listas se restauran enseguida). Cada fila recuerda su posición original (_o).
   Fase: por defecto la asigna el balance de fases (js/calculo-tierra-fases.js, balancear); si se elige R, S o T queda fijada
   en FIX, el mismo dato que se fija en Resultados › Balance de fases. Se guarda en la fila como _fase
   ("" = automática) hasta aplicar. */
let TC_PEND = null,
  TC_TAB = "cargas",
  TC_SEL = 0,
  TC_T = null;
const TC_VW = ventanaMovil(document.querySelector("#tcDlg .vw"), "jmg-electric-editor-cargas-v2", {
  w: 660,
  h: 430,
  minW: 520,
  minH: 340
});
const tcListas = () => (MODE === "multi" ? ["cargasT", "serv"] : ["cargas"]);
const tcCorto = o => Object.entries(o).map(([k, v]) => [k, v.split(" (")[0]]);
const tcCopia = () => Object.fromEntries(tcListas().map(nm => [nm, LISTS[nm].arr.map((x, i) => ({ ...x, _o: i }))]));
// Fila sin sus datos de trabajo, tal como se guarda en la lista del proyecto
const tcLimpia = x => {
  const y = { ...x };
  delete y._o;
  delete y._fase;
  return y;
};
// Fila de la copia convertida al formato de la lista, con la misma limpieza de datos que el panel
function tcFila(nm, x) {
  const L = LISTS[nm],
    y = { ...L.nuevo(), ...tcLimpia(x) };
  L.f.forEach(f => {
    const v = y[f.k];
    if (f.t === "number") y[f.k] = v === "" || v == null ? null : parseFloat(v) || 0;
    else if (f.n || f.k === "fases") y[f.k] = +v || 0;
    else if (f.t === "text") y[f.k] = String(v ?? "").replace(/[<>]/g, "");
  });
  return y;
}
// Sistema que alimenta la lista: el de la vivienda o, en el edificio, el general (servicios generales)
const tcSist = () => SIST[MODE === "multi" ? radio("sistG") : radio("sist")] || SIST.mono220;
// Circuito calculado de una fila sin cambios (por su posición original en la lista)
const tcCirc = (nm, x) =>
  x._o != null && LAST ? LAST.circ.find(c => c.src && c.src.t === nm && c.src.i === x._o) || null : null;
const tcFijada = (nm, x) => {
  const q = tcCirc(nm, x);
  return (q && (FIX[MODE] || {})[q.key]) || "";
};
const tcModDatos = (nm, x) => x._o == null || JSON.stringify(tcLimpia(x)) !== JSON.stringify(LISTS[nm].arr[x._o]);
const tcMod = (nm, x) => tcModDatos(nm, x) || (x._fase !== undefined && x._fase !== tcFijada(nm, x));
// Número de cambios sin aplicar en todas las listas (cargas nuevas, modificadas o quitadas)
function tcCambios() {
  if (!TC_PEND) return 0;
  return tcListas().reduce((s, nm) => {
    const P = TC_PEND[nm],
      quit = LISTS[nm].arr.filter((_, i) => !P.some(x => x._o === i)).length;
    return s + P.filter(x => tcMod(nm, x)).length + quit;
  }, 0);
}
/* Vista previa: el proyecto calculado con la copia pendiente. Las listas del proyecto se reemplazan solo durante
   el cálculo y se restauran siempre; si el proyecto tiene datos pendientes (no hay resultado), no hay vista previa. */
function tcPrevia() {
  if (!tcCambios()) return LAST;
  if (!LAST) return null;
  const p = copiaProyecto();
  tcListas().forEach(nm => (p[nm] = TC_PEND[nm].map(x => tcFila(nm, x))));
  return calcularCopia(p);
}
function tablaCargas(tab) {
  if (!$("tcDlg").hidden) return;
  tcListas().forEach(nm => readList(nm));
  TC_PEND = tcCopia();
  TC_TAB = tcListas().includes(tab) ? tab : tcListas()[0];
  TC_SEL = 0;
  $("tcDlg").hidden = false;
  vwFondo();
  TC_VW.abrir();
  renderTabla();
}
function cerrarTabla() {
  TC_PEND = null;
  $("tcDlg").hidden = true;
  vwFondo();
}
// Después de cada cálculo (por ejemplo, al aplicar la ficha de un circuito): si el editor no tiene cambios propios,
// vuelve a copiar las listas para mostrar los datos y resultados actuales (lo llama update() en js/app.js)
function tcSync() {
  if (!TC_PEND) return;
  if (!tcCambios()) TC_PEND = tcCopia();
  if (!$("tcDlg").contains(document.activeElement) || document.activeElement.tagName === "BUTTON") renderTabla();
}
// Datos de la carga elegida, en el orden de la grilla de dos columnas (descripción y tipo a todo lo ancho)
function tcCampos(nm, x) {
  const s = tcSist(),
    C = [
      { k: "nombre", l: "Descripción", t: "text", ancho: 1 },
      { k: "tipo", l: "Tipo", t: "sel", o: tcCorto(nm === "serv" ? TSERV : TIPOS), ancho: 1 },
      { k: "p", l: "Potencia", t: "num", u: "W" },
      { k: "L", l: "Longitud", t: "num", u: "m" }
    ];
  if (nm === "cargasT")
    C.push({ k: "dep", l: "Dpto.", t: "sel", o: tipos.map((t, i) => [i, t.nombre || `Tipo ${i + 1}`]), n: 1 });
  else C.push({ k: "fases", l: "Fases", t: "sel", o: FASES, n: 1 });
  // La fase solo se elige en cargas monofásicas con suministro trifásico (no en los departamentos)
  if (nm !== "cargasT" && s.tri && +x.fases !== 3) {
    const q = tcModDatos(nm, x) ? null : tcCirc(nm, x),
      auto = q && q.fase && q.fase !== "—" ? `Automática (${q.fase})` : "Automática";
    C.push({ k: "_fase", l: "Fase", t: "sel", o: [["", auto], ...s.fases.map(f => [f, f])] });
  }
  if (nm === "cargas" && pisos.length) C.push({ k: "piso", l: "Tablero", t: "sel", o: opcPiso(), n: 1 });
  C.push({ k: "elec", l: "Electrónica", t: "sel", o: ELEC, n: 1, ancho: 1 });
  return C;
}
const tcCampo = (x, d) => {
  const v = d.k === "_fase" ? (x._fase !== undefined ? x._fase : tcFijada(TC_TAB, x)) : x[d.k],
    a = `data-tce="${d.k}" aria-label="${esc(d.l)}"`,
    falta = d.t === "num" && !(parseFloat(v) > 0) ? " tc-falta" : "",
    c =
      d.t === "sel"
        ? `<select ${a}>${d.o.map(([ov, ol]) => `<option value="${esc(ov)}"${String(ov) === String(v ?? "") ? " selected" : ""}>${esc(ol)}</option>`).join("")}</select>`
        : d.t === "num"
          ? `<span class="tc-u"><input ${a} type="number" min="0" step="any" value="${v == null ? "" : esc(v)}"><em>${d.u}</em></span>`
          : `<input ${a} type="text" value="${v == null ? "" : esc(v)}" placeholder="${TC_TAB === "serv" ? "ej. Electrobomba de agua" : "ej. Terma eléctrica"}">`;
  return `<label class="tc-c fc-e${falta}${d.ancho ? " tc-ancho" : ""}"><span>${d.l}</span>${c}</label>`;
};
// Cargas típicas de los botones rápidos: [texto, tipo, nombre]
const TC_RAPIDAS = {
  cargas: [
    ["Terma", "calentador", "Terma eléctrica"],
    ["Ducha", "calentador", "Ducha eléctrica"],
    ["Cocina", "cocina", "Cocina eléctrica"],
    ["Aire", "aire", "Aire acondicionado"],
    ["Horno", "otra", "Horno eléctrico"],
    ["Bomba", "motor", "Electrobomba"],
    ["CCTV", "otra", "Sistema de videovigilancia (CCTV)"]
  ],
  serv: [
    ["Áreas comunes", "alum", "Alumbrado de áreas comunes"],
    ["Emergencia", "alum", "Iluminación de emergencia"],
    ["Bomba", "motor", "Electrobomba de agua"],
    ["Ascensor", "motor", "Ascensor"],
    ["Portón", "motor", "Portón eléctrico"],
    ["CCTV", "otra", "Sistema de videovigilancia (CCTV)"]
  ]
};
TC_RAPIDAS.cargasT = TC_RAPIDAS.cargas.filter(([t]) => t !== "Bomba");
// Lista de la izquierda: número, descripción, potencia y estado de cada carga
function tcItem(nm, x, j) {
  const q = tcMod(nm, x) ? null : tcCirc(nm, x),
    est = tcMod(nm, x) ? "mod" : q ? (q.ok ? "ok" : "bad") : "warn",
    tit = { mod: "Sin aplicar", ok: "Cumple", bad: "No cumple", warn: "Faltan datos" }[est];
  return `<button type="button" role="option" class="tc-it${j === TC_SEL ? " sel" : ""}${est === "mod" ? " mod" : ""}" data-sel="${j}" aria-selected="${j === TC_SEL}"><b>${j + 1}</b><span>${esc(x.nombre || "Sin descripción")}</span><em>${x.p > 0 ? fmt(x.p, 0) + " W" : ""}</em><i class="cd-est ${est}" title="${tit}"></i></button>`;
}
function renderLista() {
  const nm = TC_TAB,
    P = TC_PEND[nm];
  $("tcLista").innerHTML = P.length
    ? P.map((x, j) => tcItem(nm, x, j)).join("")
    : `<p class="tc-vacio">Aún no hay cargas.<br>Use + o un botón rápido.</p>`;
  tcPie();
}
// Franja del resultado: el circuito calculado o, con cambios, la vista previa
function tcRes() {
  const nm = TC_TAB,
    x = TC_PEND && TC_PEND[nm][TC_SEL],
    el = $("tcRes");
  if (!el) return;
  if (!x) return (el.innerHTML = "");
  if (!(x.p > 0) || !(x.L > 0)) {
    el.className = "tc-res";
    el.innerHTML = `<span class="tc-rt">Escriba la potencia y la longitud para calcular su circuito.</span>`;
    return;
  }
  const prev = tcMod(nm, x),
    r = prev ? tcPrevia() : LAST,
    q = r ? r.circ.find(c => c.src && c.src.t === nm && c.src.i === (prev ? TC_SEL : x._o)) : null;
  if (!q) {
    el.className = "tc-res";
    el.innerHTML = `<span class="tc-rt">${LAST ? "Se calcula al aplicar." : "Complete los demás datos del proyecto para calcular."}</span>`;
    return;
  }
  const tb = r.tabs.length > 1 ? q.tab + " · " : "";
  el.className = "tc-res" + (prev ? " previa" : " ir");
  el.dataset.key = prev ? "" : q.key;
  el.title = prev ? "Vista previa con los datos sin aplicar" : "Clic: ficha del circuito";
  el.innerHTML = `<i class="cd-est ${q.ok ? "ok" : "bad"}"></i><b>${esc(tb + q.id)}</b><span>ITM ${q.f3 ? 3 : 2}×${q.itm ?? "—"} A</span><span>${q.f3 ? 4 : 2}-1×${q.S} mm²</span><span>ΔV ${fmt(q.dVt, 2)} %</span><span class="tc-ok">${q.ok ? "Conforme" : "Revisar"}</span>${prev ? `<em>Vista previa</em>` : ""}`;
}
function renderTabla() {
  if (!TC_PEND) return;
  const nm = TC_TAB,
    P = TC_PEND[nm],
    multi = MODE === "multi";
  if (TC_SEL >= P.length) TC_SEL = P.length - 1;
  $("tcTabs").hidden = !multi;
  document
    .querySelectorAll("#tcTabs [data-tct]")
    .forEach(b => b.setAttribute("aria-selected", b.dataset.tct === nm ? "true" : "false"));
  $("tcT").textContent =
    nm === "cargas"
      ? "Editor de cargas especiales"
      : nm === "cargasT"
        ? "Editor de cargas · Departamentos"
        : "Editor de cargas · Servicios generales";
  renderLista();
  const x = P[TC_SEL],
    rap = `<div class="tc-rap"><span>Rápido</span>${TC_RAPIDAS[nm].map(([t, tp, n]) => `<button type="button" class="vw-btn" data-rap="${esc(tp)}|${esc(n)}" title="${esc(n)}">${esc(t)}</button>`).join("")}</div>`;
  $("tcForm").innerHTML =
    (nm === "cargas" ? planoNota("carPlanoN") : "") +
    (x
      ? `<fieldset class="fc-g tc-g"><legend>Carga ${TC_SEL + 1}</legend><div class="tc-grid">${tcCampos(nm, x)
          .map(d => tcCampo(x, d))
          .join("")}</div></fieldset>${rap}<div class="tc-res" id="tcRes"></div>`
      : `<p class="fc-nota">Agregue la primera carga con + o con un botón rápido.</p>${rap}`);
  tcRes();
}
function tcPie() {
  const n = tcCambios(),
    hay = !!(TC_PEND && TC_PEND[TC_TAB][TC_SEL]);
  $("tcApply").disabled = !n;
  $("tcNota").textContent = n ? `${n} cambio${n > 1 ? "s" : ""} sin aplicar` : "";
  $("tcDup").disabled = $("tcDel").disabled = !hay;
}
/* Escribe las copias en las listas del proyecto y recalcula. Luego fija (o libera) la fase elegida en cada
   carga, ya con la clave de su circuito, y vuelve a calcular. */
function aplicarTabla() {
  if (!tcCambios()) return;
  const fases = [];
  tcListas().forEach(nm => {
    const L = LISTS[nm];
    L.arr.length = 0;
    TC_PEND[nm].forEach(x => {
      if (x._fase !== undefined) fases.push([nm, L.arr.length, x._fase]);
      L.arr.push(tcFila(nm, x));
    });
    renderList(nm);
  });
  calcularAhora();
  if (fases.length && LAST) {
    const fx = (FIX[MODE] = FIX[MODE] || {});
    fases.forEach(([nm, i, f]) => {
      const q = LAST.circ.find(c => c.src && c.src.t === nm && c.src.i === i);
      if (!q) return;
      if (f) fx[q.key] = f;
      else delete fx[q.key];
    });
    calcularAhora();
  }
  histPush();
  TC_PEND = tcCopia();
  toast("Cargas aplicadas");
  renderTabla();
}
$("tcDlg").addEventListener("input", e => {
  const el = e.target.closest("[data-tce]");
  if (!el || !TC_PEND) return;
  const nm = TC_TAB,
    x = TC_PEND[nm][TC_SEL],
    k = el.dataset.tce;
  if (!x) return;
  const d = tcCampos(nm, x).find(c => c.k === k);
  x[k] =
    k === "_fase"
      ? el.value
      : d.t === "num"
        ? el.value === ""
          ? null
          : parseFloat(el.value)
        : d.n
          ? +el.value
          : el.value;
  el.closest(".tc-c").classList.toggle("tc-falta", d.t === "num" && !(parseFloat(el.value) > 0));
  el.closest(".tc-c").classList.add("mod");
  // Al cambiar a trifásica (o volver a monofásica) aparece o desaparece la fase: se vuelve a dibujar
  if (k === "fases") return renderTabla();
  const it = $("tcLista").querySelector(`[data-sel="${TC_SEL}"]`);
  if (it) it.outerHTML = tcItem(nm, x, TC_SEL);
  tcPie();
  // Vista previa del resultado un momento después de dejar de escribir
  clearTimeout(TC_T);
  TC_T = setTimeout(tcRes, 180);
});
$("tcDlg").addEventListener("change", e => {
  if (e.target.matches("select[data-tce]")) e.target.dispatchEvent(new Event("input", { bubbles: true }));
});
function tcElegir(j) {
  if (!TC_PEND[TC_TAB][j]) return;
  TC_SEL = j;
  renderTabla();
  $("tcLista").querySelector(`[data-sel="${j}"]`)?.focus();
}
$("tcDlg").addEventListener("click", e => {
  const t = e.target.closest("[data-tct]");
  if (t) {
    TC_TAB = t.dataset.tct;
    TC_SEL = 0;
    return renderTabla();
  }
  const it = e.target.closest("[data-sel]");
  if (it) return tcElegir(+it.dataset.sel);
  const P = TC_PEND && TC_PEND[TC_TAB];
  // Botón rápido: completa la carga elegida si está vacía; si no, agrega una nueva con ese nombre y tipo
  const rp = e.target.closest("[data-rap]");
  if (rp && P) {
    const [tipo, nombre] = rp.dataset.rap.split("|"),
      x = P[TC_SEL];
    if (x && !x.nombre && !(x.p > 0)) Object.assign(x, { tipo, nombre });
    else {
      P.push({
        ...LISTS[TC_TAB].nuevo(),
        ...(TC_TAB === "cargasT" && x ? { dep: x.dep } : {}),
        tipo,
        nombre,
        _o: null
      });
      TC_SEL = P.length - 1;
    }
    renderTabla();
    return document.querySelector('#tcForm [data-tce="p"]')?.focus();
  }
  const r = e.target.closest(".tc-res.ir");
  if (r && r.dataset.key) {
    if (tcCambios()) return toast("Aplique o cancele primero los cambios del editor");
    return fichaCirc(r.dataset.key);
  }
  const b = e.target.closest("[data-tca]");
  if (!b || !P) return;
  const a = b.dataset.tca;
  if (a === "add" || a === "dup") {
    const base =
      a === "dup" && P[TC_SEL]
        ? { ...P[TC_SEL], _o: null }
        : {
            ...LISTS[TC_TAB].nuevo(),
            ...(TC_TAB === "cargasT" && P.length ? { dep: P[P.length - 1].dep } : {}),
            _o: null
          };
    const pos = a === "dup" ? TC_SEL + 1 : P.length;
    P.splice(pos, 0, base);
    TC_SEL = pos;
    renderTabla();
    document.querySelector(`#tcForm [data-tce="${a === "dup" ? "p" : "nombre"}"]`)?.focus();
  } else if (a === "del" && P[TC_SEL]) {
    P.splice(TC_SEL, 1);
    renderTabla();
  } else if (a === "ok") {
    aplicarTabla();
    cerrarTabla();
  } else if (a === "apply") aplicarTabla();
  else if (a === "cancel") cerrarTabla();
  else if (a === "max") TC_VW.maximizar();
  else if (a === "help") {
    const p = $("tcAyuda");
    p.hidden = !p.hidden;
    b.setAttribute("aria-expanded", !p.hidden);
  }
});
// Teclado: ↑ ↓ en la lista cambian de carga; Enter en un dato aplica, como en la ficha del circuito
$("tcDlg").addEventListener("keydown", e => {
  if (e.target.matches("[data-sel]") && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault();
    tcElegir(TC_SEL + (e.key === "ArrowDown" ? 1 : -1));
  } else if (e.target.matches("[data-tce]") && e.key === "Enter") {
    e.preventDefault();
    e.target.dispatchEvent(new Event("input", { bubbles: true }));
    aplicarTabla();
  }
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("tcDlg").hidden && $("fichaDlg").hidden) cerrarTabla();
});
