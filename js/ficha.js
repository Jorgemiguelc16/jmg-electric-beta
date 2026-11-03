/* FICHA DEL CIRCUITO
   Ventana de propiedades de un circuito derivado, al estilo de los diálogos de los programas de ingeniería:
   identificación arriba (con ▲▼ para pasar al circuito anterior o siguiente), pestañas Carga, Conductor,
   Protección y Caída de tensión, y los datos en grupos. Los resultados son los que ya calculó js/calculo.js
   (los mismos de la memoria y del expediente). En la pestaña Carga se editan los mismos datos que en el panel
   Propiedades, en dos columnas, y la fase (cuadros blancos; los grises son de solo lectura): los cambios quedan
   pendientes (FC_PEND) hasta «Aplicar» o «Aceptar», y entonces se escriben en el mismo lugar que usa el panel, de
   modo que el cálculo, el historial (deshacer) y el guardado funcionan igual. Mientras haya cambios, todas las
   pestañas muestran una vista previa calculada con ellos, sin cambiar el proyecto (fcPrevia). Se abre con doble clic en un circuito del explorador o
   del cuadro de conductores, desde el panel Propiedades o desde la cinta (Resultados › Ficha del circuito). */
let FC_KEY = null,
  FC_TAB = "carga",
  FC_PEND = {},
  FC_APL = false; // mientras se aplican los cambios, el cálculo no vuelve a dibujar la ficha (js/app.js)
const FC_VW = ventanaMovil(document.querySelector("#fichaDlg .vw"), "jmg-electric-ficha-circuito", {
  w: 560,
  h: 530,
  minW: 420,
  minH: 320
});
const fcCirc = () => (LAST ? LAST.circ.find(x => x.key === FC_KEY) : null);
const fcHay = () => Object.keys(FC_PEND).length > 0;
function fichaCirc(key) {
  if (DESACT) calcularAhora();
  if (!LAST || !LAST.circ.some(q => q.key === key)) return toast("Complete los datos para ver el circuito");
  const nuevo = $("fichaDlg").hidden;
  if (!nuevo && key !== FC_KEY && fcHay()) return toast("Aplique o cancele primero los cambios de la ficha");
  if (key !== FC_KEY) FC_PEND = {};
  FC_KEY = key;
  $("fichaDlg").hidden = false;
  vwFondo();
  if (nuevo) FC_VW.abrir();
  renderFicha();
}
function cerrarFicha() {
  FC_KEY = null;
  FC_PEND = {};
  $("fichaDlg").hidden = true;
  vwFondo();
}
/* Datos editables del circuito según su origen, los mismos que ofrece el panel Propiedades (propCircuito en
   js/app.js). Cada uno indica dónde se escribe: en la lista de cargas o servicios (lista), en un campo del
   formulario (campo) o, la fase, en FIX (el dato de Resultados › Balance de fases). */
function fcEditables(q) {
  const t = q.src && q.src.t,
    E = [];
  if (t === "cargas" || t === "serv" || t === "cargasT") {
    const it = LISTS[t].arr[q.src.i];
    if (!it) return [];
    E.push(
      { id: "nombre", l: "Descripción", tipo: "text", v: it.nombre, lista: t, ancho: 1 },
      {
        id: "tipo",
        l: "Tipo",
        tipo: "select",
        v: it.tipo,
        o: Object.entries(t === "serv" ? TSERV : TIPOS),
        lista: t,
        ancho: 1
      },
      { id: "p", l: "Potencia", tipo: "number", v: it.p, u: "W", lista: t },
      { id: "L", l: "Longitud", tipo: "number", v: it.L, u: "m", lista: t },
      {
        id: "elec",
        l: "Electrónica",
        tipo: "select",
        v: it.elec ?? 0,
        o: [
          [0, "No"],
          [1, "Sí (inverter, variador, inducción…)"]
        ],
        lista: t,
        ancho: 1
      },
      // Las cargas de los departamentos son monofásicas; en su lugar se elige el tipo de departamento
      t === "cargasT"
        ? {
            id: "dep",
            l: "Dpto.",
            tipo: "select",
            v: it.dep,
            o: tipos.map((x, i) => [i, x.nombre || `Tipo ${i + 1}`]),
            lista: t
          }
        : { id: "fases", l: "Fases", tipo: "select", v: it.fases, o: FASES, lista: t }
    );
    if (t === "cargas" && pisos.length)
      E.push({ id: "piso", l: "Tablero", tipo: "select", v: it.piso, o: opcPiso(), lista: t });
  } else if (t === "tipo") {
    // Circuito de un tipo de departamento: sus salidas y su longitud son del tipo; la potencia por salida es la
    // general de Parámetros (W por salida de alumbrado o por tomacorriente), común a todos los departamentos
    const it = tipos[q.src.i];
    if (!it) return [];
    const al = q.tipo === "Alumbrado";
    E.push(
      { id: al ? "nAl" : "nTo", l: "Salidas", tipo: "number", v: it[al ? "nAl" : "nTo"], lista: "tipos" },
      { id: al ? "pAl" : "pTo", l: "Por salida", tipo: "number", v: $(al ? "pAl" : "pTo").value, u: "W", campo: true },
      { id: "Lc", l: "Longitud", tipo: "number", v: it.Lc, u: "m", lista: "tipos" }
    );
  } else if (t === "piso") {
    // Circuito de un piso superior: salidas y longitud del piso; potencia por salida, la de Salidas
    const it = pisos[q.src.i],
      k = q.src.k;
    if (!it) return [];
    E.push(
      { id: k + "_n", l: "Salidas", tipo: "number", v: it[k + "_n"], lista: "pisos" },
      { id: k + "_p", l: "Por salida", tipo: "number", v: $(k + "_p").value, u: "W", campo: true },
      { id: k + "_L", l: "Longitud", tipo: "number", v: it[k + "_L"], u: "m", lista: "pisos" }
    );
  } else if (t === "grp") {
    const k = q.src.k;
    E.push(
      { id: k + "_n", l: "Salidas", tipo: "number", v: $(k + "_n").value, campo: true },
      { id: k + "_p", l: "Por salida", tipo: "number", v: $(k + "_p").value, u: "W", campo: true },
      { id: k + "_L", l: "Longitud", tipo: "number", v: $(k + "_L").value, u: "m", campo: true }
    );
  }
  // Fase: en circuitos monofásicos con suministro trifásico (los departamentos van completos a una fase)
  const r = LAST;
  if (r && r.bal && !q.f3 && q.fase && q.fase !== "—" && q.fase !== "3φ") {
    const fx = (FIX[MODE] || {})[q.key] || "";
    E.push({
      id: "_fase",
      l: "Fase",
      tipo: "select",
      v: fx,
      o: [["", fx ? "Automática" : `Automática (${q.fase})`], ...r.bal.nm.map(f => [f, f])]
    });
  }
  return E;
}
// Campo de solo lectura con su unidad, como los cuadros grises de los diálogos de ingeniería
const fcCampo = (lbl, val, uni = "", ayuda = "") =>
  `<div class="fc-f"${ayuda ? ` data-ayuda="${esc(ayuda)}"` : ""}><span>${lbl}</span><output>${val}</output><em>${uni}</em></div>`;
// Campo editable (cuadro blanco) en la grilla de dos columnas, con la unidad dentro; muestra el valor pendiente
function fcEdit(d) {
  const v = d.id in FC_PEND ? FC_PEND[d.id] : (d.v ?? ""),
    mod = d.id in FC_PEND ? " mod" : "",
    falta = d.tipo === "number" && !(parseFloat(v) > 0) ? " tc-falta" : "",
    a = `data-fce="${esc(d.id)}" aria-label="${esc(d.l)}"`;
  const c =
    d.tipo === "select"
      ? `<select ${a}>${d.o.map(([ov, ol]) => `<option value="${esc(ov)}"${String(ov) === String(v) ? " selected" : ""}>${esc(ol)}</option>`).join("")}</select>`
      : d.tipo === "number"
        ? `<span class="tc-u"><input ${a} type="number" min="0" step="any" value="${esc(v)}"><em>${d.u || ""}</em></span>`
        : `<input ${a} type="text" value="${esc(v)}">`;
  return `<label class="tc-c fc-e${mod}${falta}${d.ancho ? " tc-ancho" : ""}"><span>${d.l}</span>${c}</label>`;
}
const fcGrupo = (tit, campos) => `<fieldset class="fc-g"><legend>${tit}</legend>${campos}</fieldset>`;
const fcCheck = (ok, txt) => `<div class="fc-chk ${ok ? "ok" : "bad"}"><i></i>${txt}</div>`;
// Qué se edita y dónde, según el origen del circuito
function fcNota(q) {
  const t = q.src && q.src.t,
    nm = { al: "alumbrado", tg: "tomacorrientes", tc: "tomacorrientes de cocina / lavandería" };
  if (t === "grp")
    return `Datos de todas las salidas de ${nm[q.src.k]} (máximo ${ctx().maxSal} por circuito): al cambiarlos se recalculan todos los circuitos del grupo.`;
  if (t === "piso")
    return `Datos de ${nm[q.src.k]} del ${ORD(q.src.i + 2)} piso: al cambiarlos se recalculan todos sus circuitos. La potencia por salida es la de Salidas, común a todos los pisos.`;
  if (t === "plano") {
    const p = q.plano;
    return `<b>Circuito del diseño en el plano:</b> ${q.n} salida${q.n === 1 ? "" : "s"} con carga conectada${q.n === 1 ? "" : "s"}, ${fmt(q.P, 0)} W, y ${fmt(q.L, 2)} m hasta la salida más alejada (${p.est ? "estimada en línea quebrada: hay salidas sin tubería" : `${fmt(p.Lh, 2)} m por la tubería y ${fmt(p.Lv, 2)} m de tramos verticales`}). La caída de tensión se calcula con esa carga y esa longitud (Regla 050-102). Para cambiarlos, edite el diseño. ${p.lej ? `<button type="button" class="linkbtn" data-fcpl="${p.lej}">Ver la salida más alejada en el plano</button>` : ""}`;
  }
  if (t === "tipo") {
    const d = tipos[q.src.i];
    return `Datos de ${q.tipo === "Alumbrado" ? "alumbrado" : "tomacorrientes"} del departamento ${esc(d?.nombre || "")}: se repiten en sus ${d?.cant ?? ""} unidades y al cambiarlos se recalculan todos sus circuitos. La potencia por salida es la de Parámetros, común a todos los departamentos.`;
  }
  return "";
}
// Valor de un dato de lista con la misma conversión que el panel Propiedades
function fcConv(d, v) {
  const f = LISTS[d.lista].f.find(x => x.k === d.id);
  return f && f.t === "number"
    ? String(v).trim() === ""
      ? null
      : parseFloat(v) || 0
    : d.id === "fases" || d.id === "piso" || d.id === "dep" || d.id === "elec"
      ? +v
      : String(v).replace(/[<>]/g, "");
}
// El mismo circuito en otro resultado: por su clave o, si cambió de número, por su origen
const fcMismo = (r, key, src) =>
  r.circ.find(x => x.key === key) ||
  (src ? r.circ.find(x => x.src && x.src.t === src.t && x.src.i === src.i && x.src.k === src.k) : null);
/* Vista previa: el circuito calculado con los cambios pendientes (calcUni/calcMulti), sin cambiar el proyecto.
   Los datos se ponen solo durante el cálculo y se restauran siempre, aunque el cálculo falle. */
function fcPrevia(q) {
  if (!fcHay() || !LAST || !q) return null;
  const p = copiaProyecto();
  fcEditables(q).forEach(d => {
    if (!(d.id in FC_PEND)) return;
    const v = FC_PEND[d.id];
    if (d.id === "_fase") {
      if (v) p.FIX[MODE][q.key] = v;
      else delete p.FIX[MODE][q.key];
    } else if (d.campo) p[d.id] = v;
    else p[d.lista][q.src.i][d.id] = fcConv(d, v);
  });
  const r = calcularCopia(p);
  return r ? fcMismo(r, q.key, q.src) : null;
}
// Franja del resultado en la pestaña Carga (con cambios pendientes, la vista previa)
function fcFranja(q, prev) {
  return `<i class="cd-est ${q.ok ? "ok" : "bad"}"></i><b>${q.n > 1 ? `${q.n} salidas · ` : ""}${fmt(q.P, 0)} W</b><span>${esc(q.s.nom)}${q.fase && q.fase !== "—" ? ` · fase ${esc(q.fase)}` : ""}</span><span>ITM ${q.f3 ? 3 : 2}×${q.itm ?? "—"} A</span><span>${q.f3 ? 4 : 2}-1×${q.S} mm²</span><span>ΔV ${fmt(q.dVt, 2)} %</span><span class="tc-ok">${q.ok ? "Conforme" : "Revisar"}</span>${prev ? `<em>Vista previa: así quedaría al aplicar</em>` : ""}`;
}
function fcCabecera(q, qv, prev) {
  const r = LAST,
    lista = r.circ,
    i = lista.findIndex(x => x.key === q.key),
    tb = r.tabs.find(t => t.tab === q.tab);
  $("fcCab").innerHTML =
    `<div class="fc-f fc-id"><span>Circuito</span><output>${esc(q.id)}</output><span class="fc-nav"><button type="button" data-fc="prev" aria-label="Circuito anterior"${i ? "" : " disabled"}>▲</button><button type="button" data-fc="next" aria-label="Circuito siguiente"${i < lista.length - 1 ? "" : " disabled"}>▼</button></span></div>` +
    fcCampo("Descripción", esc(q.desc)) +
    fcCampo("Tablero", esc(q.tab + (tb ? " · " + tb.desc : ""))) +
    `<fieldset class="fc-g fc-est${prev ? " previa" : ""}"><legend>${prev ? "Vista previa" : "Verificación"}</legend>${fcCheck(qv.ok, qv.ok ? "Conforme" : "Revisar")}</fieldset>`;
}
function renderFicha() {
  const r = LAST,
    q = fcCirc();
  if (!q) return cerrarFicha();
  // Con cambios pendientes, todas las pestañas muestran la vista previa
  const pv = fcHay() ? fcPrevia(q) : null,
    prev = !!pv,
    qv = pv || q,
    c = r.c,
    pol = qv.f3 ? 3 : 2;
  $("fcT").textContent = `Propiedades del circuito · ${q.id} ${q.desc}`;
  fcCabecera(q, qv, prev);
  document
    .querySelectorAll("#fcTabs [data-fct]")
    .forEach(b => b.setAttribute("aria-selected", b.dataset.fct === FC_TAB ? "true" : "false"));
  let h = "";
  if (FC_TAB === "carga") {
    const ed = fcEditables(q),
      nota = fcNota(q);
    h =
      (ed.length
        ? `<fieldset class="fc-g tc-g"><legend>Datos de la carga</legend><div class="tc-grid">${ed.map(fcEdit).join("")}</div></fieldset>`
        : "") +
      (nota ? `<p class="fc-nota">${nota}</p>` : "") +
      `<div class="tc-res${prev ? " previa" : ""}" id="fcRes">${fcFranja(qv, prev)}</div>`;
  } else if (FC_TAB === "cond") {
    h =
      fcGrupo(
        "Conductor",
        fcCampo("Fase y neutro", `${qv.f3 ? 4 : 2}-1×${qv.S}`, "mm²") +
          fcCampo("Protección (tierra)", `1×${qv.St}`, "mm²") +
          (c.desig ? fcCampo("Designación", esc(c.desig)) : "") +
          fcCampo("Tubo", qv.tubo.mm ? `${qv.tubo.mm} mm (${qv.tubo.pul})` : qv.tubo.pul) +
          (qv.Sauto
            ? fcCampo("Sección elegida", "Mayor que la automática", "", "Elegida en el cuadro de conductores")
            : "")
      ) +
      fcGrupo(
        "Capacidad de corriente",
        fcCampo("Corriente nominal", fmt(qv.I, 2), "A") +
          fcCampo("Corriente de diseño", fmt(qv.Id, 2), "A", `Corriente nominal × ${fmt(qv.fd ?? FD, 2)}`) +
          fcCampo("Iz de la Tabla 2", fmt(qv.Iz, 1), "A", MET[c.met] || c.met) +
          fcCampo("Factor de corrección", fmt(c.fc, 2), "", "Temperatura (Tabla 5A) × agrupamiento (Tabla 5C)") +
          fcCampo("Iz corregida", fmt(qv.Izc, 1), "A")
      );
  } else if (FC_TAB === "prot") {
    h =
      fcGrupo(
        "Interruptor termomagnético",
        fcCampo("Polos × In", `${pol}×${qv.itm ?? "—"}`, "A") + fcCampo("Curva", esc(qv.curva || "—"))
      ) +
      fcGrupo(
        "Interruptor diferencial",
        fcCampo("Designación", esc(qv.idName || "—")) +
          fcCampo("Polos × In", `${qv.f3 ? 4 : 2}×${qv.idRat ?? "—"}`, "A") +
          fcCampo(
            "Tipo",
            `${qv.idTipo || "A"} · 30 mA`,
            "",
            qv.idTipo === "A" && c.idTipo === "AC"
              ? "Tipo A porque protege una carga con electrónica (IEC 60364-5-53)"
              : "Elegido en Parámetros › Protección"
          )
      ) +
      (qv.motor
        ? fcGrupo(
            "Arranque del motor",
            fcCampo(
              "Corriente de arranque",
              fmt(qv.Iarr, 1),
              "A",
              `${fmt(c.kArr, 1)} × corriente nominal (arranque directo)`
            ) +
              fcCampo(
                "Disparo magnético",
                qv.magMin ? `≥ ${fmt(qv.magMin, 0)}` : "—",
                "A",
                `Curva ${qv.curva}: ${CURVA_MAG[qv.curva]} × In del ITM (IEC 60898-1)`
              ) +
              fcCheck(
                qv.arrOk,
                qv.arrOk
                  ? "El arranque no hace disparar el interruptor"
                  : "El arranque puede hacer disparar el interruptor"
              ) +
              fcCampo(
                "ΔV en el arranque",
                `≈ ${fmt(qv.dVarr, 1)} %`,
                "",
                "Estimación conservadora (sin reactancia); las normas cargadas no fijan su límite"
              )
          )
        : "") +
      fcGrupo(
        "Coordinación",
        fcCheck(
          qv.itm !== null && qv.Id <= qv.itm + 1e-9,
          `Corriente de diseño ${fmt(qv.Id, 1)} A ≤ ITM ${qv.itm ?? "—"} A`
        ) + fcCheck(qv.itm !== null && qv.Izc >= qv.itm, `ITM ${qv.itm ?? "—"} A ≤ Iz corregida ${fmt(qv.Izc, 1)} A`)
      );
  } else {
    const uso = usoDV(qv, qv.S);
    h =
      fcGrupo(
        "Caída de tensión",
        fcCampo("En el circuito", `${fmt(qv.dVp, 2)} %`, `${fmt(qv.dV, 2)} V`) +
          fcCampo("Aguas arriba", `${fmt(qv.dvUp, 2)} %`, "", "Alimentadores desde el suministro hasta el tablero") +
          fcCampo("Total", `${fmt(qv.dVt, 2)} %`) +
          `<div class="fc-f"><span>Uso del límite</span><output><span class="cd-uso"><i style="width:${Math.min(100, uso * 100).toFixed(0)}%"${uso >= DV_MARGEN ? ' class="w"' : ""}></i></span>${fmt(uso * 100, 0)} %</output><em></em></div>`
      ) +
      fcGrupo(
        "Límites · Regla 050-102",
        fcCheck(qv.dVp <= DV_DER + 1e-9, `Circuito ${fmt(qv.dVp, 2)} % ≤ ${fmt(DV_DER, 1)} %`) +
          fcCheck(qv.dVt <= DV_TOT + 1e-9, `Total ${fmt(qv.dVt, 2)} % ≤ ${fmt(DV_TOT, 1)} %`)
      );
  }
  $("fcBody").innerHTML =
    (prev && FC_TAB !== "carga" ? `<p class="fc-prev">Vista previa con los cambios sin aplicar</p>` : "") + h;
  fcPie();
}
// Mientras se escribe: actualiza la franja y la verificación con la vista previa, sin tocar los campos
function fcVivo() {
  const q = fcCirc();
  if (!q) return;
  const pv = fcHay() ? fcPrevia(q) : null,
    qv = pv || q,
    f = $("fcRes");
  fcCabecera(q, qv, !!pv);
  if (f) {
    f.className = "tc-res" + (pv ? " previa" : "");
    f.innerHTML = fcFranja(qv, !!pv);
  }
}
// Botones y aviso del pie según haya o no cambios pendientes
function fcPie() {
  const n = Object.keys(FC_PEND).length;
  $("fcApply").disabled = !n;
  $("fcNota").textContent = n ? `${n} cambio${n > 1 ? "s" : ""} sin aplicar` : "";
}
/* Escribe los cambios pendientes en el mismo lugar que el panel Propiedades: en la lista de cargas o servicios
   (con la misma conversión que el panel) o en el campo del formulario, avisando con un evento «input» como si se
   hubiera escrito allí. Luego recalcula, guarda en el historial y sigue al mismo circuito aunque cambie de
   número (por ejemplo, al pasarlo a otro tablero). La fase se fija al final, con la clave definitiva. */
function aplicarFicha() {
  const q = fcCirc();
  if (!q || !fcHay()) return;
  const ed = fcEditables(q),
    src = q.src ? { ...q.src } : null,
    fase = "_fase" in FC_PEND ? FC_PEND._fase : undefined;
  let lista = null;
  FC_APL = true;
  ed.forEach(d => {
    if (!(d.id in FC_PEND) || d.id === "_fase") return;
    const v = FC_PEND[d.id];
    if (d.campo) cambiarDato(d.id, v);
    else {
      LISTS[d.lista].arr[src.i][d.id] = fcConv(d, v);
      lista = d.lista;
    }
  });
  FC_PEND = {};
  if (lista) renderList(lista);
  // Aplicar es una orden explícita: recalcula aunque el cálculo automático esté desactivado
  calcularAhora();
  const r = LAST,
    n = r ? fcMismo(r, FC_KEY, src) : null;
  if (n) FC_KEY = n.key;
  if (fase !== undefined && n) {
    const fx = (FIX[MODE] = FIX[MODE] || {});
    if (fase) fx[n.key] = fase;
    else delete fx[n.key];
    calcularAhora();
  }
  histPush();
  FC_APL = false;
  if (NODE.startsWith("circ:") && !$("propBody").contains(document.activeElement)) {
    if (LAST && LAST.circ.some(x => x.key === FC_KEY)) selNode("circ:" + FC_KEY);
  }
  toast("Cambios aplicados");
  renderFicha();
}
let FC_T = null;
$("fichaDlg").addEventListener("input", e => {
  const el = e.target.closest("[data-fce]");
  if (!el) return;
  const q = fcCirc(),
    d = q && fcEditables(q).find(x => x.id === el.dataset.fce);
  if (!d) return;
  // Si vuelve al valor que ya tenía, deja de ser un cambio pendiente
  if (String(el.value) === String(d.v ?? "")) delete FC_PEND[d.id];
  else FC_PEND[d.id] = el.value;
  const cel = el.closest(".fc-e");
  cel.classList.toggle("mod", d.id in FC_PEND);
  cel.classList.toggle("tc-falta", d.tipo === "number" && !(parseFloat(el.value) > 0));
  fcPie();
  // Vista previa un momento después de dejar de escribir
  clearTimeout(FC_T);
  FC_T = setTimeout(fcVivo, 180);
});
$("fichaDlg").addEventListener("change", e => {
  if (e.target.matches("select[data-fce]")) e.target.dispatchEvent(new Event("input", { bubbles: true }));
});
$("fichaDlg").addEventListener("click", e => {
  const pl = e.target.closest("[data-fcpl]");
  if (pl) {
    cerrarFicha();
    return edVerEnPlano([pl.dataset.fcpl]);
  }
  const t = e.target.closest("[data-fct]");
  if (t) {
    FC_TAB = t.dataset.fct;
    return renderFicha();
  }
  const b = e.target.closest("[data-fc]");
  if (!b) return;
  const a = b.dataset.fc,
    lista = LAST ? LAST.circ : [],
    i = lista.findIndex(x => x.key === FC_KEY);
  if (a === "close") cerrarFicha();
  else if (a === "ok") {
    aplicarFicha();
    cerrarFicha();
  } else if (a === "apply") aplicarFicha();
  else if (a === "max") FC_VW.maximizar();
  else if ((a === "prev" || a === "next") && lista[i + (a === "prev" ? -1 : 1)]) {
    if (fcHay()) return toast("Aplique o cancele primero los cambios de este circuito");
    FC_KEY = lista[i + (a === "prev" ? -1 : 1)].key;
    renderFicha();
  } else if (a === "panel") {
    if (fcHay()) return toast("Aplique o cancele primero los cambios de la ficha");
    const k = FC_KEY;
    // El cuadro de conductores se cierra solo si no tiene cambios sin aplicar
    if (!$("condDlg").hidden) {
      if (cdCambios()) return toast("Aplique o cancele primero los cambios del cuadro de conductores");
      cuadroCond(false);
    }
    cerrarFicha();
    selNode("circ:" + k);
  }
});
// Teclado: Enter en un dato aplica; ← → cambian de pestaña y ↑ ↓ de circuito fuera de los campos
$("fichaDlg").addEventListener("keydown", e => {
  if (e.target.matches("[data-fce]")) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.dispatchEvent(new Event("input", { bubbles: true }));
      aplicarFicha();
    }
    return;
  }
  if (e.target.matches("input,select,textarea")) return;
  const T = ["carga", "cond", "prot", "dv"],
    k = { ArrowLeft: -1, ArrowRight: 1 }[e.key],
    v = { ArrowUp: "prev", ArrowDown: "next" }[e.key];
  if (k) {
    FC_TAB = T[(T.indexOf(FC_TAB) + k + T.length) % T.length];
    renderFicha();
  } else if (v) document.querySelector(`#fichaDlg [data-fc="${v}"]`)?.click();
  else return;
  e.preventDefault();
});
// Esc cierra sin aplicar, como «Cancelar»
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("fichaDlg").hidden) cerrarFicha();
});
// Doble clic en un circuito del explorador. El primer clic vuelve a dibujar el árbol y el navegador ya no
// emite «dblclick», así que se usa el número de clics seguidos que trae el propio clic (e.detail).
$("exTree").addEventListener("click", e => {
  const n = e.target.closest('[data-node^="circ:"]');
  if (n && e.detail === 2) setTimeout(() => fichaCirc(n.dataset.node.slice(5)));
});
// Botón «Ver ficha del circuito» del panel Propiedades
$("propBody").addEventListener("click", e => {
  const b = e.target.closest("[data-ficha]");
  if (b) fichaCirc(b.dataset.ficha);
});
