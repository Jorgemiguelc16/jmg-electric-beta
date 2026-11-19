/* DISEÑO AVANZADO · TIPOS DE LUMINARIA
   Catálogo del proyecto (L1, L2…) con descripción, potencia, control y uso, y la biblioteca de luminarias.
   Antes era parte de js/diseno-avanzado.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
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
