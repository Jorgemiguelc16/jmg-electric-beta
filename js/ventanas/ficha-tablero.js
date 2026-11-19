/* FICHA DEL TABLERO
   Ventana de propiedades de un tablero, con el estilo de la ficha del circuito: identificación arriba (▲▼ para
   pasar al tablero anterior o siguiente) y pestañas Alimentador, Tablero y Equipos. Muestra lo que ya calculó
   js/calculo/calculo.js para el tablero y su alimentador (los mismos valores de la memoria). En la pestaña Equipos se
   marcan los equipos adicionales (DPS, relé de tensión, medidor, contactor con reloj): quedan pendientes hasta
   «Aplicar» o «Aceptar» y se guardan en TEQ, el mismo dato del panel Propiedades. No intervienen en el cálculo.
   La longitud del alimentador también se edita aquí (en el mismo dato del formulario que le corresponde), con
   vista previa del cálculo mientras está pendiente.
   Se abre con doble clic en un tablero del explorador, desde el panel Propiedades o desde la cinta
   (Resultados › Ficha del tablero). */
let FT_TAB = null,
  FT_PEST = "alim",
  FT_PEND = null,
  FT_LONG = undefined,
  FT_T = null;
const FT_VW = ventanaMovil(document.querySelector("#ftDlg .vw"), "jmg-electric-ficha-tablero", {
  w: 560,
  h: 480,
  minW: 420,
  minH: 320
});
// Equipos marcados del tablero (pendientes si los hay)
const ftEquipos = tab => FT_PEND || { ...((TEQ[MODE] || {})[tab] || {}) };
/* Dónde está la longitud de cada alimentador: un campo del formulario (alimentador general, de servicios
   generales o al TD-1) o un dato de la lista de departamentos o de pisos */
function ftLongitud(a) {
  if (!a) return null;
  if (a.pKey === "MD") return { id: MODE === "multi" ? "Lgen" : "Lalim" };
  if (a.pKey === "servP") return { id: "Lms" };
  if (a.pKey === "bm") return { id: "Lbm" };
  if (a.pKey === "tipo") {
    const t = LAST && LAST.T && LAST.T[a.ti];
    return t ? { id: "Ld", lista: "tipos", i: t._i } : null;
  }
  if (a.pKey === "piso") return a.piso === 1 ? { id: "Ltd1" } : { id: "Ld", lista: "pisos", i: a.piso - 2 };
  return null;
}
const ftLongActual = d => (d.lista ? (LISTS[d.lista].arr[d.i] || {})[d.id] : $(d.id).value);
const ftAlim = () => {
  const tb = LAST && LAST.tabs.find(t => t.tab === FT_TAB);
  return tb ? LAST.alims[tb.feeder] : null;
};
const ftLongCambio = () => {
  const d = ftLongitud(ftAlim());
  return !!d && FT_LONG !== undefined && String(FT_LONG) !== String(ftLongActual(d) ?? "");
};
const ftCambios = () => {
  const a = (TEQ[MODE] || {})[FT_TAB] || {},
    eq = FT_PEND
      ? Object.keys(EQT).filter(k => !!FT_PEND[k] !== !!a[k]).length + ((FT_PEND.gab || "") !== (a.gab || "") ? 1 : 0)
      : 0;
  return eq + (ftLongCambio() ? 1 : 0);
};
// Escribe la longitud en su lugar (temporalmente para la vista previa, o al aplicar)
function ftPonerLong(d, v) {
  if (d.lista) {
    const it = LISTS[d.lista].arr[d.i];
    if (it) it[d.id] = String(v).trim() === "" ? null : parseFloat(v) || 0;
  } else cambiarDato(d.id, v);
}
// Vista previa: el proyecto calculado con la longitud pendiente, sin cambiarlo (se restaura siempre)
function ftPrevia() {
  if (!ftLongCambio() || !LAST) return null;
  const d = ftLongitud(ftAlim()),
    p = copiaProyecto();
  if (d.lista) p[d.lista][d.i][d.id] = String(FT_LONG).trim() === "" ? null : parseFloat(FT_LONG) || 0;
  else p[d.id] = FT_LONG;
  return calcularCopia(p);
}
function fichaTablero(tab) {
  if (DESACT) calcularAhora();
  if (!LAST || !LAST.tabs.some(t => t.tab === tab)) return toast("Complete los datos para ver el tablero");
  const nuevo = $("ftDlg").hidden;
  if (!nuevo && tab !== FT_TAB && ftCambios()) return toast("Aplique o cancele primero los cambios del tablero");
  FT_TAB = tab;
  FT_PEND = null;
  FT_LONG = undefined;
  $("ftDlg").hidden = false;
  vwFondo();
  if (nuevo) FT_VW.abrir();
  renderTablero();
}
function cerrarTablero() {
  FT_TAB = null;
  FT_PEND = null;
  FT_LONG = undefined;
  $("ftDlg").hidden = true;
  vwFondo();
}
function renderTablero() {
  const r = LAST,
    lista = r ? r.tabs : [],
    i = lista.findIndex(t => t.tab === FT_TAB),
    tb = lista[i];
  if (!tb) return cerrarTablero();
  // Con la longitud pendiente, los resultados son la vista previa
  const dL = ftLongitud(r.alims[tb.feeder]),
    rp = ftPrevia(),
    rv = rp || r,
    tv = rv.tabs.find(t => t.tab === tb.tab) || tb,
    a = rv.alims[tv.feeder],
    cs = rv.circ.filter(q => q.tab === tb.tab),
    ok = cs.every(q => q.ok) && a.ok,
    pol = a.s.tri ? 3 : 2,
    vL = FT_LONG !== undefined ? FT_LONG : dL ? (ftLongActual(dL) ?? "") : a.L;
  $("ftT").textContent = `Propiedades del tablero · ${tb.tab}`;
  $("ftCab").innerHTML =
    `<div class="fc-f fc-id"><span>Tablero</span><output>${esc(tb.tab)}</output><span class="fc-nav"><button type="button" data-ft="prev" aria-label="Tablero anterior"${i ? "" : " disabled"}>▲</button><button type="button" data-ft="next" aria-label="Tablero siguiente"${i < lista.length - 1 ? "" : " disabled"}>▼</button></span></div>` +
    fcCampo("Descripción", esc(tb.desc)) +
    fcCampo("Circuitos", `${cs.length} + ${r.c.reserva} de reserva`) +
    `<fieldset class="fc-g fc-est${rp ? " previa" : ""}"><legend>${rp ? "Vista previa" : "Verificación"}</legend>${fcCheck(ok, ok ? "Conforme" : "Revisar")}</fieldset>`;
  document
    .querySelectorAll("#ftTabs [data-ftp]")
    .forEach(b => b.setAttribute("aria-selected", b.dataset.ftp === FT_PEST ? "true" : "false"));
  let h = "";
  if (FT_PEST === "alim") {
    h =
      fcGrupo(
        "Alimentador",
        fcCampo("Recorrido", esc(a.desc)) +
          fcCampo("Sistema", esc(a.s.nom)) +
          (dL
            ? `<label class="fc-f fc-e${ftLongCambio() ? " mod" : ""}${!(parseFloat(vL) > 0) ? " tc-falta" : ""}"><span>Longitud</span><input data-ftl type="number" min="0" step="0.5" value="${esc(vL)}" aria-label="Longitud del alimentador"><em>m</em></label>`
            : fcCampo("Longitud", fmt(a.L, 1), "m")) +
          fcCampo("Potencia", fmt(a.P, 0), "W")
      ) +
      fcGrupo(
        "Corriente y protección",
        fcCampo("Corriente", fmt(a.I, 2), "A") +
          fcCampo(
            "Corriente de diseño",
            fmt(a.Id, 2),
            "A",
            a.Imin && a.Id === a.Imin ? "Corriente mínima que exige el código" : `Corriente × ${fmt(a.fd ?? FD, 2)}`
          ) +
          fcCampo("Interruptor", `${pol}×${a.itm ?? "—"}`, "A") +
          fcCampo("Iz corregida", fmt(a.Izc, 1), "A")
      ) +
      fcGrupo(
        "Conductor",
        fcCampo("Fases y neutro", `${a.s.n}-1×${a.S}`, "mm²") +
          fcCampo("Protección (tierra)", `1×${a.St}`, "mm²") +
          fcCampo("Tubo", a.tubo.mm ? `${a.tubo.mm} mm (${a.tubo.pul})` : a.tubo.pul) +
          fcCampo("ΔV del tramo", `${fmt(a.dVp, 2)} %`) +
          fcCampo("ΔV acumulada", `${fmt(a.dvAc, 2)} %`, "", "Desde el suministro hasta este tablero")
      );
  } else if (FT_PEST === "tab") {
    // Circuitos del tablero en una rejilla; doble clic abre su ficha
    h =
      fcGrupo(
        "Barras",
        fcCampo("Cortocircuito en barras", fmt(tb.icc, 2), "kA") +
          fcCampo("Poder de corte mínimo", tb.pdc, "kA", "De los interruptores del tablero")
      ) +
      `<fieldset class="fc-g"><legend>Circuitos</legend><div class="cd-tabla ft-circ"><table><thead><tr><th class="t">Circuito</th><th>P (W)</th><th>ITM</th><th>Sección</th><th>ΔV (%)</th><th class="t">Estado</th></tr></thead><tbody>${cs
        .map(
          q =>
            `<tr data-ftc="${esc(q.key)}" title="Doble clic: ficha del circuito"><td class="t">${esc(q.id + " " + q.desc)}</td><td>${fmt(q.P, 0)}</td><td>${q.f3 ? 3 : 2}×${q.itm ?? "—"}</td><td>${q.S}</td><td>${fmt(q.dVt, 2)}</td><td class="t"><span class="cd-est ${q.ok ? "ok" : "bad"}">${q.ok ? "Cumple" : "No cumple"}</span></td></tr>`
        )
        .join("")}</tbody></table></div></fieldset>`;
  } else {
    const eq = ftEquipos(tb.tab),
      act = (TEQ[MODE] || {})[tb.tab] || {};
    h =
      `<fieldset class="fc-g"><legend>Equipos adicionales</legend>${Object.entries(EQT)
        .map(
          ([k, d]) =>
            `<label class="ft-eq${!!eq[k] !== !!act[k] ? " mod" : ""}" data-ayuda="${esc(d.a)}"><input type="checkbox" data-fteq="${k}"${eq[k] ? " checked" : ""}><span><b>${esc(d.n)}</b><small>${esc(d.d(a.s.tri))}</small></span></label>`
        )
        .join("")}</fieldset>` +
      `<p class="fc-nota">Aparecen en el unifilar, el metrado y la memoria. No cambian el cálculo; su uso es criterio del proyectista.</p>` +
      (pt => {
        // Gabinete: por defecto según el tablero y sus polos (criterio), o el elegido
        const sel = eq.gab || "",
          porDef = pt.m <= 24 && tb.tab !== "TSG",
          usaPvc = pt.m <= 24 && (sel === "pvc" || (!sel && porDef)),
          defe = { ...medidaGabinete(pt.m, false, porDef), tipo: porDef ? "pvc" : "metal" },
          g = { ...medidaGabinete(pt.m, false, usaPvc), tipo: usaPvc ? "pvc" : "metal" },
          op = (v, t, d, dis) =>
            `<label class="ft-eq${sel !== (act.gab || "") && sel === v ? " mod" : ""}"><input type="radio" name="ftgab" data-ftgab="${v}"${sel === v ? " checked" : ""}${dis ? " disabled" : ""}><span><b>${t}</b><small>${d}</small></span></label>`;
        return (
          `<fieldset class="fc-g"><legend>Gabinete</legend>` +
          op(
            "",
            "Por defecto",
            `${defe.tipo === "pvc" ? "PVC empotrable con tapa transparente" : "Metálico empotrado"}, ${defe.a} × ${defe.h} mm`
          ) +
          op(
            "pvc",
            "PVC empotrable con tapa transparente",
            pt.m > 24
              ? `Este tablero tiene ${pt.m} polos; el PVC de catálogo llega hasta 24`
              : "Viviendas y departamentos; de catálogo hasta 24 polos",
            pt.m > 24
          ) +
          op("metal", "Metálico empotrado", "Tableros generales, de servicios generales o de más de 24 polos") +
          `</fieldset><p class="fc-nota">Usado: ${g.tipo === "pvc" ? "PVC empotrable" : "metálico"}, ${g.a} × ${g.h} mm (referencial, de catálogo).${pt.m > 24 && sel === "pvc" ? " Con más de 24 polos va metálico: no hay medida de catálogo de PVC." : ""}</p>`
        );
      })(polosTablero(LAST, tb));
  }
  $("ftBody").innerHTML =
    (rp && FT_PEST !== "eq" ? `<p class="fc-prev">Vista previa con la longitud sin aplicar</p>` : "") + h;
  ftPie();
}
function ftPie() {
  const n = ftCambios();
  $("ftApply").disabled = !n;
  $("ftNota").textContent = n ? `${n} cambio${n > 1 ? "s" : ""} sin aplicar` : "";
}
// Guarda los equipos en TEQ (como el panel Propiedades), recalcula y guarda en el historial
function aplicarTablero() {
  if (!ftCambios()) return;
  // Longitud: en su campo del formulario (avisando con «input», como si se hubiera escrito allí) o en su lista
  if (ftLongCambio()) {
    const d = ftLongitud(ftAlim());
    ftPonerLong(d, FT_LONG);
    if (d.lista) renderList(d.lista);
  }
  FT_LONG = undefined;
  if (FT_PEND) {
    const m = (TEQ[MODE] = TEQ[MODE] || {}),
      t = Object.fromEntries(
        Object.keys(EQT)
          .filter(k => FT_PEND[k])
          .map(k => [k, true])
      );
    if (FT_PEND.gab) t.gab = FT_PEND.gab;
    if (Object.keys(t).length) m[FT_TAB] = t;
    else delete m[FT_TAB];
  }
  FT_PEND = null;
  calcularAhora();
  histPush();
  toast(`Tablero ${FT_TAB}: cambios aplicados`);
  renderTablero();
}
$("ftDlg").addEventListener("input", e => {
  if (!e.target.matches("[data-ftl]")) return;
  FT_LONG = e.target.value;
  e.target.closest(".fc-e").classList.toggle("mod", ftLongCambio());
  ftPie();
  clearTimeout(FT_T);
  FT_T = setTimeout(() => {
    renderTablero();
    const f = document.querySelector("#ftBody [data-ftl]");
    if (f) f.focus();
  }, 250);
});
$("ftDlg").addEventListener("change", e => {
  const gb = e.target.closest("[data-ftgab]");
  if (gb && FT_TAB) {
    FT_PEND = { ...ftEquipos(FT_TAB), gab: gb.dataset.ftgab };
    return renderTablero();
  }
  const c = e.target.closest("[data-fteq]");
  if (!c || !FT_TAB) return;
  FT_PEND = { ...ftEquipos(FT_TAB), [c.dataset.fteq]: c.checked };
  renderTablero();
});
$("ftDlg").addEventListener("click", e => {
  const t = e.target.closest("[data-ftp]");
  if (t) {
    FT_PEST = t.dataset.ftp;
    return renderTablero();
  }
  const b = e.target.closest("[data-ft]");
  if (!b) return;
  const a = b.dataset.ft,
    lista = LAST ? LAST.tabs : [],
    i = lista.findIndex(x => x.tab === FT_TAB);
  if (a === "close") cerrarTablero();
  else if (a === "ok") {
    aplicarTablero();
    cerrarTablero();
  } else if (a === "apply") aplicarTablero();
  else if (a === "max") FT_VW.maximizar();
  else if ((a === "prev" || a === "next") && lista[i + (a === "prev" ? -1 : 1)]) {
    if (ftCambios()) return toast("Aplique o cancele primero los cambios de este tablero");
    FT_TAB = lista[i + (a === "prev" ? -1 : 1)].tab;
    FT_PEND = null;
    FT_LONG = undefined;
    renderTablero();
  } else if (a === "panel") {
    if (ftCambios()) return toast("Aplique o cancele primero los cambios del tablero");
    const k = FT_TAB;
    cerrarTablero();
    selNode("tab:" + k);
  }
});
// Doble clic en un circuito de la pestaña Tablero: su ficha
$("ftBody").addEventListener("dblclick", e => {
  const tr = e.target.closest("[data-ftc]");
  if (tr) fichaCirc(tr.dataset.ftc);
});
// Teclado: ← → cambian de pestaña y ↑ ↓ de tablero fuera de los campos; Esc cierra sin aplicar
$("ftDlg").addEventListener("keydown", e => {
  if (e.target.matches("[data-ftl]") && e.key === "Enter") {
    e.preventDefault();
    FT_LONG = e.target.value;
    return aplicarTablero();
  }
  if (e.target.matches("input,select,textarea")) return;
  const T = ["alim", "tab", "eq"],
    k = { ArrowLeft: -1, ArrowRight: 1 }[e.key],
    v = { ArrowUp: "prev", ArrowDown: "next" }[e.key];
  if (k) {
    FT_PEST = T[(T.indexOf(FT_PEST) + k + T.length) % T.length];
    renderTablero();
  } else if (v) document.querySelector(`#ftDlg [data-ft="${v}"]`)?.click();
  else return;
  e.preventDefault();
});
// En fase de captura, antes de que la ficha del circuito (si está abierta encima) se cierre con la misma tecla
addEventListener(
  "keydown",
  e => {
    if (e.key === "Escape" && !$("ftDlg").hidden && $("fichaDlg").hidden) cerrarTablero();
  },
  true
);
// Doble clic en un tablero del explorador (el primer clic vuelve a dibujar el árbol: se usa e.detail)
$("exTree").addEventListener("click", e => {
  const n = e.target.closest('[data-node^="tab:"]');
  if (n && e.detail === 2) setTimeout(() => fichaTablero(n.dataset.node.slice(4)));
});
// Botón «Ver ficha del tablero» del panel Propiedades
$("propBody").addEventListener("click", e => {
  const b = e.target.closest("[data-fichatab]");
  if (b) fichaTablero(b.dataset.fichatab);
});
// Doble clic en las tablas de resultados: un circuito abre su ficha; la franja de un tablero o un alimentador, la
// ficha del tablero
$("results").addEventListener("dblclick", e => {
  const c = e.target.closest("tr[data-ficha]"),
    t = e.target.closest("tr[data-fichatab]");
  if (c) fichaCirc(c.dataset.ficha);
  else if (t) fichaTablero(t.dataset.fichatab);
});
