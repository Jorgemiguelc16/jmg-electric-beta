/* CUADRO DE CONDUCTORES
   Ventana (cinta: Resultados › Cuadro de conductores) con la sección de cada alimentador y circuito derivado.
   Cada tramo usa por defecto la sección automática: la menor que cumple la capacidad de corriente (Tabla 2 con
   5A y 5C) y la caída de tensión (Regla 050-102). La lista ofrece esa sección y las tres siguientes, que también
   cumplen. Las elecciones quedan pendientes (CD_PEND) hasta «Aplicar» o «Aceptar»: entonces pasan a SECF y
   dimensionar() las aplica (js/calculo/calculo-conductores.js). Un clic elige un circuito para «Verificar longitudes» (js/ventanas/longitudes.js). La ventana se mueve y redimensiona como las demás ventanas de
   escritorio (js/ventanas/ventana.js). Si se angosta, la tabla oculta primero las columnas secundarias (container
   queries en css/ventanas.css) en lugar de desplazarse hacia el costado. Doble clic en un circuito abre su ficha. */
let CD_PEND = null;
const CD_VW = ventanaMovil(document.querySelector("#condDlg .vw"), "jmg-electric-cuadro-conductores", {
  w: 940,
  h: 520
});
function cuadroCond(abrir) {
  if (abrir) {
    if (DESACT) calcularAhora();
    if (!LAST) return toast("Complete los datos para ver los conductores");
    CD_PEND = { ...(SECF[MODE] || {}) };
  } else CD_PEND = null;
  $("condDlg").hidden = !abrir;
  vwFondo();
  if (abrir) {
    CD_VW.abrir();
    renderCond();
  }
}
// Número de elecciones pendientes distintas de las aplicadas
const cdCambios = () => {
  const a = SECF[MODE] || {},
    p = CD_PEND || {};
  return [...new Set([...Object.keys(a), ...Object.keys(p)])].filter(k => a[k] !== p[k]).length;
};
/* Vista previa: el proyecto calculado con las secciones pendientes (SECF temporal), sin cambiarlo. Así las
   columnas (ΔV, uso del límite, estado, y la ΔV de los circuitos aguas abajo de un alimentador) muestran el
   resultado actualizado antes de aplicar. SECF se restaura siempre. */
function cdPrevia() {
  if (!cdCambios() || !LAST) return null;
  const p = copiaProyecto();
  p.SECF[MODE] = { ...CD_PEND };
  return calcularCopia(p);
}
function renderCond() {
  if (!LAST || !CD_PEND) return;
  const pv = cdPrevia(),
    r = pv || LAST;
  const c = r.c,
    sf = SECF[r.mode] || (SECF[r.mode] = {}),
    varios = r.tabs.length > 1;
  const fila = (x, alim) => {
    const key = alim ? "A·" + x.desc : x.key,
      y = alim ? { ...x, alim: true } : x,
      Sa = x.Sauto ?? x.S,
      ia = SECC.indexOf(Sa),
      kc = idxPorCorriente(y, c),
      porDV = kc !== null && SECC[kc] !== Sa,
      ops = x.fail ? [] : SECC.slice(ia, ia + 4),
      uso = usoDV(y, x.S),
      nombre = alim ? x.desc : `${varios ? x.tab + " · " : ""}${x.id} ${x.desc}`;
    // Una elección que ya no es mayor que la automática (por ejemplo, tras alargar el tramo) deja de valer
    if (!pv && sf[key] && !x.Sauto) {
      if (CD_PEND[key] === sf[key]) delete CD_PEND[key];
      delete sf[key];
    }
    if (CD_PEND[key] && !(CD_PEND[key] > Sa && ops.includes(CD_PEND[key]))) delete CD_PEND[key];
    const pend = CD_PEND[key] || 0,
      mod = pend !== (sf[key] || 0);
    const sel = ops.length
      ? `<select data-secf="${esc(key)}" aria-label="Sección de ${esc(nombre)}">${ops
          .map(
            (S, i) => `<option value="${i ? S : ""}"${(i ? pend === S : !pend) ? " selected" : ""}>${S} mm²</option>`
          )
          .join("")}</select>`
      : `<b>${x.S} mm²</b>`;
    const [ec, et] = !x.ok
      ? ["bad", "No cumple"]
      : x.Sauto
        ? ["warn", "Sección mayor"]
        : pocoMargen(y)
          ? ["warn", "Poco margen"]
          : ["ok", "Cumple"];
    return `<tr${mod ? ' class="cd-mod"' : x.Sauto ? ' class="cd-elegida"' : !alim && x.key === CD_SELK ? ' class="cd-sel"' : ""}${alim ? "" : ` data-circ="${esc(key)}"`}><td class="t" title="${esc(nombre)}">${esc(nombre)}</td><td class="c-l">${fmt(x.L, 1)}</td><td>${fmt(x.I, 1)}</td><td class="c-itm">${x.itm ?? "—"}</td><td class="c-min" title="${porDV ? `Definida por la caída de tensión; por corriente bastaría ${SECC[kc]} mm²` : "Definida por la capacidad de corriente"}">${Sa}${porDV ? "<sup>ΔV</sup>" : ""}</td><td class="t c-sec">${sel}</td><td>${fmt(alim ? x.dvAc : x.dVt, 2)}</td><td class="c-uso"><span class="cd-uso"><i style="width:${Math.min(100, uso * 100).toFixed(0)}%"${uso >= DV_MARGEN ? ' class="w"' : ""}></i></span>${fmt(uso * 100, 0)}</td><td class="t"><span class="cd-est ${ec}" title="${et}">${et}</span></td></tr>`;
  };
  // Fila de grupo con una celda por columna (no colspan) para que las columnas ocultas no dejen espacio vacío
  const sub = t =>
    `<tr class="grp"><td class="t">${esc(t)}</td><td class="c-l"></td><td></td><td class="c-itm"></td><td class="c-min"></td><td class="c-sec"></td><td></td><td class="c-uso"></td><td></td></tr>`;
  const circ = r.tabs
    .map(tb => {
      const cs = r.circ.filter(q => q.tab === tb.tab);
      return cs.length ? sub(`Circuitos derivados · ${tb.tab} ${tb.desc}`) + cs.map(q => fila(q, false)).join("") : "";
    })
    .join("");
  $("cdBody").innerHTML =
    `<table><thead><tr><th class="t">Tramo</th><th class="c-l" title="Longitud">L (m)</th><th class="c-n" title="Corriente">I (A)</th><th class="c-itm" title="Interruptor termomagnético">ITM (A)</th><th class="c-min" title="Sección mínima que cumple capacidad y caída de tensión; «ΔV» si la define la caída de tensión">Mín. (mm²)</th><th class="t c-sec">Sección</th><th class="c-n" title="Caída de tensión acumulada desde el suministro">ΔV (%)</th><th class="c-uso" title="Caída de tensión respecto del límite que le corresponde (Regla 050-102)">Uso ΔV (%)</th><th class="t c-est">Estado</th></tr></thead><tbody>
    ${sub("Alimentadores")}${r.alims.map(a => fila(a, true)).join("")}${circ}</tbody></table>`;
  const n = cdCambios();
  $("cdApply").disabled = !n;
  $("cdAuto").disabled = !Object.keys(CD_PEND).length;
  $("cdNota").textContent = n ? `${n} cambio${n > 1 ? "s" : ""} sin aplicar · vista previa del cálculo` : "";
}
function aplicarCond() {
  if (!cdCambios()) return;
  SECF[MODE] = { ...CD_PEND };
  calcularAhora();
  histPush();
  toast("Secciones aplicadas");
  renderCond();
}
/* Clic en un circuito derivado: queda elegido para «Verificar longitudes» (js/ventanas/longitudes.js); doble clic: abre su
   ficha (js/ventanas/ficha.js) sobre el cuadro */
let CD_SELK = null;
$("cdBody").addEventListener("click", e => {
  const tr = e.target.closest("tr[data-circ]");
  if (!tr || e.target.closest("select")) return;
  CD_SELK = tr.dataset.circ;
  $("cdBody")
    .querySelectorAll("tr.cd-sel")
    .forEach(x => x.classList.remove("cd-sel"));
  tr.classList.add("cd-sel");
});
$("cdBody").addEventListener("dblclick", e => {
  const tr = e.target.closest("tr[data-circ]");
  if (tr && !e.target.closest("select")) fichaCirc(tr.dataset.circ);
});
$("condDlg").addEventListener("change", e => {
  const s = e.target.closest("[data-secf]");
  if (!s || !CD_PEND) return;
  if (s.value) CD_PEND[s.dataset.secf] = +s.value;
  else delete CD_PEND[s.dataset.secf];
  renderCond();
});
$("condDlg").addEventListener("click", e => {
  const b = e.target.closest("[data-cd]");
  if (!b) return;
  const a = b.dataset.cd;
  if (a === "cancel") cuadroCond(false);
  else if (a === "ok") {
    aplicarCond();
    cuadroCond(false);
  } else if (a === "apply") aplicarCond();
  else if (a === "lg") verificarLongitudes(true, CD_SELK);
  else if (a === "auto") {
    CD_PEND = {};
    renderCond();
  } else if (a === "max") CD_VW.maximizar();
  else if (a === "help") {
    const p = $("cdAyuda");
    p.hidden = !p.hidden;
    b.setAttribute("aria-expanded", !p.hidden);
  }
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("condDlg").hidden && $("fichaDlg").hidden && $("lgDlg").hidden) cuadroCond(false);
});
