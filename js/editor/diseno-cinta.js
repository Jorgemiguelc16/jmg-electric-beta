/* DISEÑO ELÉCTRICO · CINTA, SÍMBOLOS Y FONDO
   Cinta del editor (íconos, capa actual, escalas, rejilla, enganches y trazo), editor de símbolos (criterio del
   proyectista), fondo del plano y ventana de propiedades (doble clic).
   Antes era parte de js/diseno.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Cinta del editor: íconos de los símbolos, capa actual, escalas, rejilla, enganches y trazo ---------- */
document.querySelectorAll("#editor [data-ds-ico]").forEach(i => (i.outerHTML = dsIcono(i.dataset.dsIco)));
$("dsEscala").innerHTML = DS_ESCALAS.map(e => `<option value="${e}">1:${e}</option>`).join("");
$("dsPaso").innerHTML = DS_PASOS.map(p => `<option value="${p}">${fmt(p, 2)} m</option>`).join("");
function dsCinta() {
  const D = dsD(),
    s = $("dsActual"),
    sin = !D || !PL_MOD;
  s.innerHTML = D
    ? D.capas.map(c => `<option${c.n === D.actual ? " selected" : ""}>${esc(c.n)}</option>`).join("")
    : "";
  s.disabled = sin;
  $("dsEscala").value = D ? String(D.escala) : "50";
  $("dsEscala").disabled = sin;
  $("dsEtq").value = D ? D.etq || "total" : "total";
  $("dsEtq").disabled = sin;
  $("dsRej").checked = DSU.rej;
  $("dsForz").checked = DSU.forz;
  $("dsPaso").value = String(DSU.paso);
  $("dsAlinear").checked = DSU.alinear;
  $("dsGiro").value = String(DSU.giro || 0);
  $("dsColor").value = DSU.color;
  $("dsMarcas").checked = DSU.marcas;
  $("dsMarcaEst").value = DSU.marcaEst === "recta" ? "recta" : "incl";
  $("dsCalido").value = String(DSU.calido || 0);
  $("dsNav").checked = DSU.nav !== false;
  $("dsInfo").checked = DSU.info !== false;
  $("dsBrillo").value = String(DSU.brillo || 100);
  $("dsCirT").checked = !!(D && D.cirt);
  $("dsNSal").checked = !!(D && D.nsal);
  $("dsNSal").disabled = sin;
  $("dsIntCol").checked = !!D && D.intCol !== false;
  $("dsIntCol").disabled = sin;
  $("dsCirT").disabled = sin;
  $("edPolar").value = String(DSU.polarInc);
  $("dsSueltos").checked = DSU.sueltos;
  $("dsTrazo").value = DSU.curva ? "curvo" : "recto";
  document.querySelectorAll("[data-edtg]").forEach(b => {
    const v = b.dataset.edtg;
    b.setAttribute("aria-pressed", v === "rej" || v === "forz" || v === "polar" ? DSU[v] : $(v).checked);
  });
  // Enganches activos
  document.querySelectorAll("#edRefs [data-ref]").forEach(c => (c.checked = DSU.ref[c.dataset.ref] !== false));
  $("edSens").value = String(DSU.sens);
}
$("dsActual").addEventListener("change", e => {
  if (!dsD()) return;
  dsD().actual = e.target.value;
  edCambio();
});
$("dsEscala").addEventListener("change", e => {
  if (!dsD()) return;
  dsD().escala = DS_ESCALAS.includes(+e.target.value) ? +e.target.value : 50;
  edCambio();
  toast(`Símbolos, textos y cotas para imprimir a 1:${dsD().escala}`);
});
$("dsEtq").addEventListener("change", e => {
  if (!dsD()) return;
  dsD().etq = ["no", "total", "tramo"].includes(e.target.value) ? e.target.value : "total";
  edCambio();
});
function dsAlternarRejilla(cual, aviso) {
  DSU[cual] = !DSU[cual];
  dsGuardarPref();
  dsCinta();
  if (aviso)
    toast(
      `${cual === "rej" ? "Rejilla" : cual === "polar" ? `Rastreo polar (cada ${DSU.polarInc}°)` : "Forzar cursor a la rejilla"} ${DSU[cual] ? "activado" : "desactivado"}`
    );
  plDibujar();
}
$("dsRej").addEventListener("change", () => dsAlternarRejilla("rej"));
$("dsForz").addEventListener("change", () => dsAlternarRejilla("forz"));
$("dsPaso").addEventListener("change", e => {
  DSU.paso = DS_PASOS.includes(+e.target.value) ? +e.target.value : 0.5;
  dsGuardarPref();
  plDibujar();
});
$("dsGiro").addEventListener("change", e => {
  DSU.giro = [0, 1, 5, 15, 30, 45, 90].includes(+e.target.value) ? +e.target.value : 0;
  // Suelta el foco: así la tecla R actúa enseguida sobre el plano
  e.target.blur();
  dsGuardarPref();
  toast(
    DSU.giro
      ? `Giro de ${DSU.giro}° en ${DSU.giro}° (tecla R y pinzamiento redondo)`
      : "Giro libre: el pinzamiento redondo gira a cualquier ángulo; R gira 90°"
  );
});
$("dsSueltos").addEventListener("change", e => {
  DSU.sueltos = e.target.checked;
  dsGuardarPref();
  plDibujar();
});
$("dsColor").addEventListener("change", e => {
  DSU.color = ["capa", "tipo", "cir"].includes(e.target.value) ? e.target.value : "tipo";
  e.target.blur();
  dsGuardarPref();
  dsResumen();
  plDibujar();
});
$("dsInfo").addEventListener("change", e => {
  DSU.info = e.target.checked;
  dsGuardarPref();
  plSobreDibujar();
});
$("dsNav").addEventListener("change", e => {
  DSU.nav = e.target.checked;
  dsGuardarPref();
  plNavPoner();
});
["dsCalido", "dsBrillo"].forEach(id =>
  $(id).addEventListener("input", e => {
    DSU[id === "dsCalido" ? "calido" : "brillo"] = +e.target.value;
    dsGuardarPref();
    dsFondo();
  })
);
$("dsMarcaEst").addEventListener("change", e => {
  DSU.marcaEst = e.target.value === "recta" ? "recta" : "incl";
  e.target.blur();
  dsGuardarPref();
  plDibujar();
});
$("dsIntCol").addEventListener("change", e => {
  if (!dsD()) return;
  if (e.target.checked) delete dsD().intCol;
  else dsD().intCol = false;
  edCambio();
});
$("dsNSal").addEventListener("change", e => {
  if (!dsD()) return;
  if (e.target.checked) dsD().nsal = true;
  else delete dsD().nsal;
  edCambio();
});
$("dsCirT").addEventListener("change", e => {
  if (!dsD()) return;
  if (e.target.checked) dsD().cirt = true;
  else delete dsD().cirt;
  edCambio();
});
$("dsMarcas").addEventListener("change", e => {
  DSU.marcas = e.target.checked;
  dsGuardarPref();
  plDibujar();
});
$("edPolar").addEventListener("change", e => {
  DSU.polarInc = [15, 30, 45, 90].includes(+e.target.value) ? +e.target.value : 45;
  dsGuardarPref();
});
$("dsAlinear").addEventListener("change", e => {
  DSU.alinear = e.target.checked;
  dsGuardarPref();
  plOrden();
});
$("dsTrazo").addEventListener("change", e => {
  DSU.curva = e.target.value !== "recto";
  dsGuardarPref();
  plOrden();
  plSobreDibujar();
});
// Ventanita de enganches (desde la barra de estado): cuáles están activos y su sensibilidad
$("edRefs").addEventListener("change", e => {
  const c = e.target.closest("[data-ref]");
  if (c) DSU.ref[c.dataset.ref] = c.checked;
  if (e.target.id === "edSens") DSU.sens = [6, 12, 20].includes(+e.target.value) ? +e.target.value : 12;
  dsGuardarPref();
});

/* ---------- Editor de símbolos: relleno, tamaño, letra y grosor por tipo (criterio del proyectista) ---------- */
const SI_VW = ventanaMovil(document.querySelector("#simDlg .vw"), "jmg-electric-simbolo", {
  w: 600,
  h: 420,
  minW: 520,
  minH: 360
});
let SI_K = null;
function siAbrir(k) {
  if (!DS_CAT[k] || !dsD()) return;
  SI_K = k;
  const o = dsSimb(k) || {},
    letra = (dsPrims(k).find(p => dsEsLetra(k, p)) || {}).tx;
  $("siT").textContent = "Editar símbolo · " + DS_CAT[k].n;
  $("siCod").textContent = `${dsCodTxt(k)}${letra ? " · letra de la norma: " + letra : ""}`;
  $("siRel").value = o.rel || "";
  $("siTam").value = Math.round((o.tam || 1) * 100);
  $("siTamV").textContent = Math.round((o.tam || 1) * 100) + " %";
  $("siLet").value = typeof o.let === "string" ? o.let : "";
  $("siLet").placeholder = letra ? `${letra} (como la norma)` : "sin letra en la norma";
  $("siLet").disabled = !letra;
  $("siGr").value = String(o.gr || 1);
  $("simDlg").hidden = false;
  vwFondo();
  SI_VW.abrir();
  siVista();
}
function siCerrar() {
  $("simDlg").hidden = true;
  vwFondo();
  if (!$("bibDlg").hidden) bibRender();
}
function siVista() {
  const c = $("siPrev"),
    g = c.getContext("2d"),
    k = SI_K,
    b = dsBBs(k),
    t = dsTam(k),
    u = (Math.min(c.width / (b[2] - b[0]), c.height / (b[3] - b[1])) * 0.7 * t) / Math.max(1, t),
    col = dsColorEl({ t: "sim", k }, dsCapa(DS_SIS[DS_CAT[k].s].capa));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  dsDibSim(
    g,
    k,
    c.width / 2 - ((b[0] + b[2]) / 2) * u,
    c.height / 2 - ((b[1] + b[3]) / 2) * u,
    0,
    u,
    col,
    "#ffffff",
    2
  );
}
function siLeer() {
  const D = dsD(),
    k = SI_K,
    o = {},
    rel = $("siRel").value,
    tam = Math.max(0.6, Math.min(1.6, (+$("siTam").value || 100) / 100)),
    let_ = $("siLet").value.replace(/[<>]/g, "").trim().slice(0, 4),
    gr = +$("siGr").value === 1.6 ? 1.6 : 1;
  if (rel) o.rel = rel;
  if (tam !== 1) o.tam = tam;
  if ($("siLet").value !== "" && !$("siLet").disabled) o.let = let_;
  if (gr !== 1) o.gr = gr;
  D.simb = D.simb || {};
  if (Object.keys(o).length) D.simb[k] = o;
  else delete D.simb[k];
  if (!Object.keys(D.simb).length) delete D.simb;
  $("siTamV").textContent = Math.round(tam * 100) + " %";
  edCambio();
  siVista();
}
$("simDlg").addEventListener("input", e => {
  if (e.target.id === "siTam") $("siTamV").textContent = e.target.value + " %";
});
$("simDlg").addEventListener("change", siLeer);
$("simDlg").addEventListener("click", e => {
  if (e.target.id === "simDlg") return siCerrar();
  const b = e.target.closest("[data-si]");
  if (!b) return;
  if (b.dataset.si === "cerrar") siCerrar();
  else if (b.dataset.si === "norma") {
    const D = dsD();
    if (D.simb) delete D.simb[SI_K];
    if (D.simb && !Object.keys(D.simb).length) delete D.simb;
    edCambio();
    siAbrir(SI_K);
    toast("Símbolo como la Norma DGE");
  }
});
$("simDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    siCerrar();
  }
  e.stopPropagation();
});

/* ---------- Fondo del plano: base, temperatura y brillo (Vista › Fondo del plano) ----------
   Solo la vista del plano en la pantalla de cada usuario (las láminas y el DXF no cambian). Sobre un fondo oscuro,
   la arquitectura y el diseño se aclaran solos para leerse bien. */
const DS_FONDOS = {
  tema: ["Según el tema", null],
  blanco: ["Blanco", [255, 255, 255]],
  papel: ["Papel", [246, 238, 220]],
  gris: ["Gris claro", [228, 231, 235]],
  gris2: ["Gris medio", [178, 184, 191]],
  azul: ["Azul noche", [24, 34, 52]],
  grafito: ["Grafito", [42, 46, 52]],
  negro: ["Negro", [12, 13, 16]]
};
function dsFondoColor(base) {
  const t = Math.max(-50, Math.min(100, DSU.calido || 0)) / 100,
    b = Math.max(60, Math.min(130, DSU.brillo || 100)) / 100;
  // Cálida: menos azul y algo menos verde; fría: menos rojo
  const f = t >= 0 ? [1, 1 - 0.05 * t, 1 - 0.16 * t] : [1 + 0.12 * t, 1 + 0.03 * t, 1];
  return base.map((x, i) => {
    const v = x * f[i];
    // Brillo: oscurece hacia el negro o aclara hacia el blanco
    return Math.max(0, Math.min(255, b <= 1 ? v * b : v + (255 - v) * (b - 1) * 1.4));
  });
}
function dsFondo() {
  const L = plLienzo;
  L.style.backgroundColor = "";
  const p = DS_FONDOS[DSU.fondo] || DS_FONDOS.tema,
    base = p[1] || (getComputedStyle(L).backgroundColor.match(/\d+/g) || [255, 255, 255]).slice(0, 3).map(Number);
  if (p[1] || DSU.calido || DSU.brillo !== 100) L.style.backgroundColor = plHex(dsFondoColor(base));
  plTema();
  plDibujar();
  dsFondoLista();
}
// Muestras de la ventanita del fondo
function dsFondoLista() {
  const L = $("fonLista");
  if (!L) return;
  const tema = (getComputedStyle(document.documentElement).getPropertyValue("--ws-doc") || "#ffffff").trim();
  L.innerHTML = Object.entries(DS_FONDOS)
    .map(
      ([k, [n, c]]) =>
        `<button type="button" data-fon="${k}"${DSU.fondo === k ? ' class="on"' : ""}><i style="background:${c ? plHex(c) : tema}"></i>${n}</button>`
    )
    .join("");
}
$("edFondo").addEventListener("click", e => {
  const b = e.target.closest("[data-fon]");
  if (!b) return;
  if (b.dataset.fon === "cerrar") return ($("edFondo").hidden = true);
  DSU.fondo = b.dataset.fon;
  dsGuardarPref();
  dsFondo();
});

/* ---------- Ventana de propiedades (doble clic en un elemento) ---------- */
const EL_VW = ventanaMovil(document.querySelector("#elDlg .vw"), "jmg-electric-propiedades", {
  w: 380,
  h: 560,
  minW: 320,
  minH: 260
});
let EL_ID = null;
function elAbrir(id) {
  const el = dsD() && dsD().els.find(e => e.id === id);
  if (!el) return;
  EL_ID = id;
  DS_SEL.clear();
  PL_ASEL.clear();
  DS_SEL.add(id);
  $("elDlg").hidden = false;
  vwFondo();
  EL_VW.abrir();
  edProps();
  plSobreDibujar();
  elRender();
}
function elCerrar() {
  $("elDlg").hidden = true;
  EL_ID = null;
  vwFondo();
}
function elRender() {
  if ($("elDlg").hidden) return;
  const sel = dsSel();
  if (sel.length !== 1 || sel[0].id !== EL_ID) return elCerrar();
  $("elT").textContent = dsNomEl(sel[0]);
  dsProps($("elC"));
}
$("elDlg").addEventListener("click", e => {
  if (e.target.id === "elDlg") return elCerrar();
  const b = e.target.closest("[data-el]");
  if (b && b.dataset.el === "cerrar") elCerrar();
  else if (b && b.dataset.el === "max") EL_VW.maximizar();
});
$("elDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    elCerrar();
  }
  e.stopPropagation();
});
