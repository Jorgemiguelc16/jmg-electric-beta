/* PRECIOS UNITARIOS
   Ventana de escritorio (Resultados › Precios unitarios, o el botón de la vista Presupuesto) para escribir el precio
   unitario de cada partida del metrado y los porcentajes del presupuesto, como en una hoja de cálculo:
   - rejilla con las partidas agrupadas por título, su cantidad (con el desperdicio), el precio, el parcial y el
     origen del precio (propio, recordado de otro proyecto o sin precio); buscador y filtros;
   - Enter o ↓ pasan al precio de la partida siguiente y ↑ al anterior;
   - resumen al costado: costo directo, gastos generales, utilidad, subtotal, IGV y total, con su avance;
   - los cambios quedan pendientes (en celeste) hasta Aplicar o Aceptar; mientras tanto, los totales son la vista
     previa con esos cambios (preCalc con los precios pendientes, sin tocar los del proyecto). Cancelar los descarta.
   Los precios se guardan en el proyecto (PRESU, js/resultados/presupuesto.js). */
let PU_PEND = null,
  PU_FIL = "",
  PU_BUS = "";
const PU_VW = ventanaMovil(document.querySelector("#puDlg .vw"), "jmg-electric-precios-unitarios", {
  w: 1080,
  h: 600,
  minW: 760,
  minH: 360
});
// Precios del proyecto con los cambios pendientes
function puPrecios() {
  const p = { ...PRESU.p, ...PU_PEND.p },
    r = { ...PRESU.r };
  Object.keys(PU_PEND.p).forEach(k => delete r[k]);
  return { p, r, gg: PU_PEND.gg ?? PRESU.gg, ut: PU_PEND.ut ?? PRESU.ut, igv: PU_PEND.igv ?? PRESU.igv };
}
const puCambios = () =>
  !PU_PEND
    ? 0
    : Object.entries(PU_PEND.p).filter(([k, v]) => (PRESU.p[k] ?? null) !== v).length +
      ["gg", "ut", "igv"].filter(k => PU_PEND[k] !== undefined && PU_PEND[k] !== PRESU[k]).length;
function preciosUnitarios(abrir) {
  if (!abrir) {
    PU_PEND = null;
    $("puDlg").hidden = true;
    vwFondo();
    return;
  }
  if (DESACT) calcularAhora();
  if (!LAST) return toast("Complete los datos para escribir los precios unitarios");
  // Las partidas sin precio toman el recordado de otro proyecto antes de abrir
  preCalc(LAST);
  PU_PEND = { p: {} };
  $("puDlg").hidden = false;
  vwFondo();
  PU_VW.abrir();
  $("puBus").value = PU_BUS;
  $("puFil").value = PU_FIL;
  puRender();
}
// Origen del precio de una fila: pendiente, propio, recordado o sin precio
const puOrigen = x =>
  PU_PEND.p[x.desc] !== undefined && (PRESU.p[x.desc] ?? null) !== PU_PEND.p[x.desc]
    ? ["mod", "Por aplicar", ""]
    : x.pu === null
      ? ["sin", "Sin precio", "La partida no suma al costo directo"]
      : x.rec
        ? ["rec", "Recordado", `Precio de su proyecto «${x.rec}». Al cambiarlo queda como propio de este proyecto.`]
        : ["pro", "Propio", ""];
function puRender() {
  if (!PU_PEND || !LAST) return;
  const C = preCalc(LAST, metrado(LAST), false, puPrecios()),
    bus = PU_BUS.trim().toLowerCase(),
    ve = x =>
      (!bus || (x.cod + " " + x.desc).toLowerCase().includes(bus)) &&
      (!PU_FIL ||
        (PU_FIL === "sin" && x.pu === null) ||
        (PU_FIL === "con" && x.pu !== null) ||
        (PU_FIL === "rec" && !!x.rec && PU_PEND.p[x.desc] === undefined));
  let h = "",
    sec = null,
    n = 0;
  C.filas.forEach(x => {
    if (x.sec) return (sec = x);
    if (!ve(x)) return;
    if (sec) {
      h += `<tr class="grp"><td class="t">${sec.cod}</td><td class="t" colspan="5">${esc(sec.sec)}</td><td class="pu-sub" data-pusub="${sec.i}">${sec.sub ? soles(r2(sec.sub)) : ""}</td></tr>`;
      sec = null;
    }
    const [k, t, tit] = puOrigen(x);
    n++;
    h += `<tr data-pui="${x.i}"${k === "mod" ? ' class="cd-mod"' : ""}><td class="t">${x.cod}</td><td class="t" title="${esc(x.desc)}">${esc(x.desc)}</td><td>${x.und}</td><td title="${x.desp ? `Metrado ${fmt(x.cant, 2)} + ${fmt(x.desp * 100, 0)} % de desperdicio` : "Metrado"}">${fmt(x.q, x.q % 1 ? 2 : 0)}${x.desp ? "<sup>+d</sup>" : ""}</td><td class="pu-in"><input type="text" inputmode="decimal" data-pu="${x.i}" value="${x.pu ?? ""}" placeholder="—" autocomplete="off" aria-label="Precio unitario de ${esc(x.desc)}"></td><td data-pupar="${x.i}">${soles(x.par)}</td><td class="t"><span class="pu-or ${k}" data-puor="${x.i}" title="${esc(tit)}">${t}</span></td></tr>`;
  });
  $("puTab").innerHTML =
    `<table><thead><tr><th class="t pu-c-it">Ítem</th><th class="t">Descripción</th><th class="pu-c-un">Und.</th><th class="pu-c-q" title="Cantidad a presupuestar: el metrado y, en tuberías y conductores, su desperdicio (+d)">Cantidad</th><th class="pu-c-pu">P. U. (S/)</th><th class="pu-c-par">Parcial (S/)</th><th class="t pu-c-or">Origen</th></tr></thead><tbody>` +
    (n
      ? h
      : `<tr><td class="t" colspan="7">Ninguna partida ${PU_FIL === "sin" ? "sin precio" : PU_FIL === "rec" ? "con precio recordado" : PU_FIL === "con" ? "con precio" : ""}${bus ? ` con «${esc(PU_BUS)}»` : ""}.</td></tr>`) +
    "</tbody></table>";
  puResumen(C);
}
// Resumen al costado, avance y nota del pie (sin redibujar la tabla: el cursor sigue en su casilla)
function puResumen(C) {
  const P = C.P,
    pct = (k, t, ref) =>
      `<div class="pu-r"><span>${t}<small>${ref}</small></span><span class="pu-pct"><input type="text" inputmode="decimal" data-pupct="${k}" value="${P[k]}" aria-label="${t} (%)">%</span><b data-purt="${k}">${soles(C[k])}</b></div>`;
  if (!$("puRes").firstChild || !$("puRes").querySelector("[data-purt]"))
    $("puRes").innerHTML = `<h4>Resumen del presupuesto</h4>
      <div class="pu-av"><div class="pu-bar"><i id="puBar"></i></div><span id="puAv"></span></div>
      <div class="pu-r"><span>Costo directo</span><b data-purt="cd"></b></div>
      ${pct("gg", "Gastos generales", "% del costo directo · criterio")}
      ${pct("ut", "Utilidad", "% del costo directo · criterio")}
      <div class="pu-r sub"><span>Subtotal</span><b data-purt="sub"></b></div>
      ${pct("igv", "IGV", "16 % IGV + 2 % IPM, vigente")}
      <div class="pu-r tot"><span>Total</span><b data-purt="tot"></b></div>
      <p class="pu-letras" id="puLetras"></p>
      <p class="pu-nota">Desperdicio en tuberías y conductores: <b id="puDesp"></b> (Parámetros de diseño). Precios en soles, con materiales y mano de obra.</p>`;
  ["cd", "gg", "ut", "sub", "igv"].forEach(
    k => ($("puRes").querySelector(`[data-purt="${k}"]`).textContent = soles(C[k]))
  );
  $("puRes").querySelector('[data-purt="tot"]').textContent = "S/ " + soles(C.tot);
  ["gg", "ut", "igv"].forEach(k => {
    const i = $("puRes").querySelector(`[data-pupct="${k}"]`);
    if (document.activeElement !== i) i.value = P[k];
    i.closest(".pu-r").classList.toggle("mod", PU_PEND[k] !== undefined && PU_PEND[k] !== PRESU[k]);
  });
  $("puLetras").textContent = solesLetras(C.tot);
  $("puDesp").textContent = fmt(C.d * 100, 0) + " %";
  $("puBar").style.width = `${C.nT ? (100 * C.nP) / C.nT : 0}%`;
  $("puAv").textContent = `${C.nP} de ${C.nT} partidas con precio`;
  $("puEst").innerHTML =
    `Costo directo <b>S/ ${soles(C.cd)}</b><span class="ca-sep"></span>Total <b>S/ ${soles(C.tot)}</b>`;
  const n = puCambios();
  $("puApply").disabled = !n;
  $("puNota").textContent = n ? `${n} cambio${n > 1 ? "s" : ""} sin aplicar · vista previa del presupuesto` : "";
}
// Parciales, subtotales y origen de las filas visibles, con los precios pendientes
function puRefrescar() {
  const C = preCalc(LAST, metrado(LAST), false, puPrecios());
  C.filas.forEach(x => {
    const q = s => $("puTab").querySelector(s);
    if (x.sec) {
      const s = q(`[data-pusub="${x.i}"]`);
      if (s) s.textContent = x.sub ? soles(r2(x.sub)) : "";
      return;
    }
    const par = q(`[data-pupar="${x.i}"]`);
    if (!par) return;
    par.textContent = soles(x.par);
    const [k, t, tit] = puOrigen(x),
      o = q(`[data-puor="${x.i}"]`);
    o.className = "pu-or " + k;
    o.textContent = t;
    o.title = tit;
    par.closest("tr").classList.toggle("cd-mod", k === "mod");
  });
  puResumen(C);
}
// Número escrito en una casilla: acepta coma o punto decimal; vacío = sin precio
function puNum(s) {
  const t = String(s).trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : NaN;
}
function puAplicar() {
  if (!puCambios()) return;
  Object.entries(PU_PEND.p).forEach(([k, v]) => {
    PRESU.p[k] = v;
    // Escrito por el proyectista: ya no es «recordado»
    delete PRESU.r[k];
  });
  ["gg", "ut", "igv"].forEach(k => PU_PEND[k] !== undefined && (PRESU[k] = PU_PEND[k]));
  PU_PEND = { p: {} };
  saveDraft();
  if (typeof histPush === "function") histPush();
  update();
  toast("Precios aplicados al presupuesto");
  puRender();
}
$("puDlg").addEventListener("input", e => {
  const t = e.target;
  if (!PU_PEND) return;
  if (t.id === "puBus") {
    PU_BUS = t.value;
    return puRender();
  }
  const v = puNum(t.value);
  if (t.dataset.pu !== undefined) {
    const x = preCalc(LAST, metrado(LAST), false, puPrecios()).filas[+t.dataset.pu];
    if (!x || x.sec) return;
    t.classList.toggle("mal", Number.isNaN(v));
    if (Number.isNaN(v)) return;
    PU_PEND.p[x.desc] = v === null ? null : Math.min(v, 1e9);
  } else if (t.dataset.pupct) {
    t.classList.toggle("mal", Number.isNaN(v) || v > 100);
    if (Number.isNaN(v) || v > 100) return;
    PU_PEND[t.dataset.pupct] = v ?? 0;
  } else return;
  puRefrescar();
});
$("puDlg").addEventListener("change", e => {
  if (e.target.id !== "puFil") return;
  PU_FIL = e.target.value;
  puRender();
});
// Como en una hoja de cálculo: Enter o ↓ al precio siguiente, ↑ al anterior
$("puDlg").addEventListener("keydown", e => {
  const t = e.target;
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    return preciosUnitarios(false);
  }
  if (t.dataset.pu === undefined || !["Enter", "ArrowDown", "ArrowUp"].includes(e.key)) return;
  e.preventDefault();
  const l = [...$("puTab").querySelectorAll("[data-pu]")],
    i = l.indexOf(t) + (e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey) ? -1 : 1);
  if (l[i]) {
    l[i].focus();
    l[i].select();
  }
});
$("puDlg").addEventListener("focusin", e => {
  if (e.target.dataset.pu !== undefined || e.target.dataset.pupct) e.target.select();
});
$("puDlg").addEventListener("click", e => {
  const b = e.target.closest("[data-pu-a]");
  if (!b) return;
  const a = b.dataset.puA;
  if (a === "cancel") preciosUnitarios(false);
  else if (a === "ok") {
    puAplicar();
    preciosUnitarios(false);
  } else if (a === "apply") puAplicar();
  else if (a === "max") PU_VW.maximizar();
  else if (a === "help") {
    const p = $("puAyuda");
    p.hidden = !p.hidden;
    b.setAttribute("aria-expanded", !p.hidden);
  }
});
