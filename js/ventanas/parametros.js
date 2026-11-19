/* PARÁMETROS DE DISEÑO
   Ventana (cinta: Parámetros › Parámetros de diseño) con todos los criterios del proyecto en grupos con marco y
   pestañas, al estilo del cuadro de opciones de los programas de ingeniería. Se arma a partir de los mismos
   campos del formulario de parámetros (fieldsets fs-p-… de index.html): mismas opciones, mismos textos de ayuda y
   mismas normas, de modo que nunca se desincronizan. Los cambios quedan pendientes (PP_PEND) hasta «Aplicar» o
   «Aceptar»; entonces se escriben en esos campos avisando con «input» y «change», como si se hubieran escrito
   allí, y el cálculo, las validaciones y el historial (deshacer) funcionan igual. */
let PP_PEND = null,
  PP_TAB = "car";
const PP_VW = ventanaMovil(document.querySelector("#ppDlg .vw"), "jmg-electric-parametros", {
  w: 640,
  h: 520,
  minW: 460,
  minH: 340
});
// Pestañas: cada una reúne uno o más grupos del formulario de parámetros
const PP_TABS = {
  car: ["fs-p-car"],
  cond: ["fs-p-cond"],
  prot: ["fs-p-prot", "fs-p-dv"],
  pat: ["fs-p-pat", "fs-p-pozo", "fs-p-met"],
  alt: ["fs-p-alt"],
  bm: ["fs-p-bm"]
};
function parametros(abrir) {
  if (abrir) {
    PP_PEND = {};
    $("ppDlg").hidden = false;
    vwFondo();
    PP_VW.abrir();
    renderParam();
  } else {
    PP_PEND = null;
    $("ppDlg").hidden = true;
    vwFondo();
  }
}
// Texto propio de una etiqueta (sin el de su control) y su norma entre paréntesis
const ppTexto = lb =>
  [...lb.childNodes]
    .filter(n => n.nodeType === 3 || (n.nodeType === 1 && n.classList.contains("lt")))
    .map(n => n.textContent)
    .join("")
    .trim();
function ppCampo(lb) {
  const c = lb.querySelector("input,select");
  if (!c || !c.id) return "";
  const id = c.id,
    v = id in PP_PEND ? PP_PEND[id] : c.value,
    mod = id in PP_PEND ? " mod" : "",
    inv = c.classList.contains("inv") ? " tc-falta" : "",
    a = `data-pp="${id}" aria-label="${esc(ppTexto(lb))}"`;
  const ctl =
    c.tagName === "SELECT"
      ? `<select ${a}>${[...c.options].map(o => `<option value="${esc(o.value)}"${o.value === v ? " selected" : ""}>${esc(o.textContent)}</option>`).join("")}</select>`
      : `<input ${a} type="${c.type}"${["step", "min", "max", "list"].map(k => (c.getAttribute(k) ? ` ${k}="${esc(c.getAttribute(k))}"` : "")).join("")} value="${esc(v)}">`;
  const ay = lb.dataset.ayuda || c.dataset.ayuda;
  return `<label class="fc-f fc-e pp-f${mod}${inv}"${ay ? ` data-ayuda="${esc(ay)}"` : ""}><span>${esc(ppTexto(lb))}</span>${ctl}</label>`;
}
function renderParam() {
  if (!PP_PEND) return;
  document
    .querySelectorAll("#ppTabs [data-ppt]")
    .forEach(b => b.setAttribute("aria-selected", b.dataset.ppt === PP_TAB ? "true" : "false"));
  $("ppBody").innerHTML = PP_TABS[PP_TAB].map(fid => {
    const fs = $(fid);
    if (!fs) return "";
    const lg = fs.querySelector("legend"),
      tit = esc(
        [...lg.childNodes]
          .filter(n => n.nodeType === 3)
          .map(n => n.textContent)
          .join("")
          .trim()
      ),
      norma = lg.querySelector("small")?.textContent || "",
      hint = [...fs.querySelectorAll(".hint")].map(p => p.textContent.trim()).join(" ");
    return `<fieldset class="fc-g"><legend>${tit}${norma ? ` <small>${esc(norma)}</small>` : ""}${hint ? ` <i class="pp-i" data-ayuda="${esc(hint)}">i</i>` : ""}</legend>${[...fs.querySelectorAll("label")].map(ppCampo).join("")}</fieldset>`;
  }).join("");
  ppPie();
}
// Franja de resultados: con cambios pendientes, la vista previa del cálculo
let PP_T = null;
function ppRes() {
  const el = $("ppRes");
  if (!el) return;
  const hay = Object.keys(PP_PEND || {}).length,
    r = hay ? previaCampos(PP_PEND) : LAST;
  el.className = "tc-res" + (hay ? " previa" : "");
  el.innerHTML = franjaProyecto(r, hay && !!r);
}
function ppPie() {
  clearTimeout(PP_T);
  PP_T = setTimeout(ppRes, 200);
  const n = Object.keys(PP_PEND || {}).length;
  $("ppApply").disabled = !n;
  $("ppNota").textContent = n ? `${n} cambio${n > 1 ? "s" : ""} sin aplicar` : "";
}
// Escribe los valores en los datos del proyecto (PROY, con sus efectos) y recalcula
function aplicarParam() {
  const ids = Object.keys(PP_PEND || {});
  if (!ids.length) return;
  ids.forEach(id => cambiarDato(id, PP_PEND[id]));
  PP_PEND = {};
  calcularAhora();
  histPush();
  toast("Parámetros aplicados");
  renderParam();
}
$("ppDlg").addEventListener("input", e => {
  const el = e.target.closest("[data-pp]");
  if (!el || !PP_PEND) return;
  const id = el.dataset.pp;
  if (el.value === $(id).value) delete PP_PEND[id];
  else PP_PEND[id] = el.value;
  el.closest(".pp-f").classList.toggle("mod", id in PP_PEND);
  ppPie();
});
$("ppDlg").addEventListener("change", e => {
  if (e.target.matches("select[data-pp]")) e.target.dispatchEvent(new Event("input", { bubbles: true }));
});
$("ppDlg").addEventListener("click", e => {
  const t = e.target.closest("[data-ppt]");
  if (t) {
    PP_TAB = t.dataset.ppt;
    return renderParam();
  }
  const b = e.target.closest("[data-ppa]");
  if (!b) return;
  const a = b.dataset.ppa;
  if (a === "ok") {
    aplicarParam();
    parametros(false);
  } else if (a === "apply") aplicarParam();
  else if (a === "cancel") parametros(false);
  else if (a === "max") PP_VW.maximizar();
});
// Enter en un dato aplica, como en la ficha del circuito; Esc cierra sin aplicar
$("ppDlg").addEventListener("keydown", e => {
  if (e.target.matches("[data-pp]") && e.key === "Enter") {
    e.preventDefault();
    e.target.dispatchEvent(new Event("input", { bubbles: true }));
    aplicarParam();
  }
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("ppDlg").hidden) parametros(false);
});
