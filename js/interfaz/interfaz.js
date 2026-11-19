/* CICLO DE CÁLCULO Y PANTALLA
   update() es el ciclo principal: revisa los datos que faltan, calcula, muestra los resultados y guarda.
   También: cambio de modo (vivienda/edificio), navegación entre secciones (setTab), validación de datos
   y textos que cambian según el uso de la edificación. */
let PRINT = null;
function render(r) {
  const k = [],
    PD = r.pend;
  // ΔV máxima: en un resultado preliminar, solo la de lo que ya es definitivo
  const maxDV = vivoDatos(r).dv,
    a0 = r.alims[0];
  if (r.mode === "uni")
    k.push(
      ["Potencia instalada", fmt(r.CI / 1000, 2), "kW", "Salidas y equipos"],
      [
        "Máxima demanda",
        fmt(r.md.MD / 1000, 2),
        "kW",
        r.viv === false
          ? USOS[r.uso]?.regla
            ? `Regla ${USOS[r.uso].regla}`
            : "Regla 050-210 · Tabla 14"
          : "Regla 050-200"
      ],
      ["Alimentador", a0.S, "mm²", `${fmt(a0.I, 1)} A · ${a0.s.txt}`],
      ["ITM general", a0.itm ?? "—", "A", `${a0.s.tri ? 3 : 2} polos · ${a0.pdc} kA`]
    );
  else
    k.push(
      r.TC
        ? ["Unidades", r.units.length, "", `${r.units.filter(u => u.com).length} local(es) de otro uso`]
        : ["Departamentos", r.units.length, "", `${r.T.length} tipo(s)`],
      [
        "Máxima demanda",
        fmt(r.MD / 1000, 2),
        "kW",
        r.TC ? "Edificio · Reglas 050-202 y 050-210" : "Edificio · Regla 050-202"
      ],
      ["Alimentador general", a0.S, "mm²", `${fmt(a0.I, 1)} A · ${a0.s.txt}`],
      ["ITM general", a0.itm ?? "—", "A", `${a0.s.tri ? 3 : 2} polos · ${a0.pdc} kA`]
    );
  k.push(
    ["Potencia a contratar", fmt(r.contratada, 1), "kW", "Sugerida"],
    maxDV === null
      ? ["ΔV máx. total", "—", "", "Pendiente"]
      : [
          "ΔV máx. total",
          fmt(maxDV, 2),
          "%",
          PD ? "De lo ya calculado" : pill(maxDV <= DV_TOT, "Dentro del límite", "Excede 4 %")
        ],
    ["Puesta a tierra", fmt(r.pat.Rt, 1), "Ω", pill(r.pat.ok, "Cumple", "Excede 25 Ω")]
  );
  if (r.bal)
    k.push([
      "Desbalance",
      fmt(r.bal.desb, 1),
      "%",
      r.bal.desb <= 10
        ? pillS("ok", "≤ 10 %")
        : pillS("warn", r.bal.desb <= r.bal.desbMin + 0.05 ? "Mínimo posible" : "Revisar reparto")
    ]);
  // Resultado preliminar: lo que depende de un dato que falta, «pendiente»
  if (PD) {
    const pend = {
      "Potencia instalada": PD.md && "md",
      "Máxima demanda": PD.md && "md",
      "Potencia a contratar": PD.md && "md",
      Alimentador: PD.al.has(0) && "a0",
      "Alimentador general": PD.al.has(0) && "a0",
      "ITM general": PD.al.has(0) && "a0",
      Desbalance: (PD.md || PD.circ.size > 0) && "md"
    };
    k.forEach((x, i) => {
      if (pend[x[0]]) k[i] = [x[0], pendTxt(PD, pend[x[0]] === "md" && !PD.md ? "a0" : pend[x[0]]), "", "Faltan datos"];
    });
  }
  let html = `<div class="kpis">${k.map(([a, b, u, n]) => `<div class="kpi"><div class="k">${a}</div><div class="v">${b}${u ? `<small>${u}</small>` : ""}</div><div class="n">${n}</div></div>`).join("")}</div>`;
  const S = {},
    A = alertas(r);
  S.resumen = () =>
    `<div class="two">${cardSuministro(r, "")}${cardPozo(r, "")}</div>${cardAlertas(r, "")}${cardRecom(r)}`;
  S.demanda = () =>
    (PD && PD.md
      ? `<p class="falta-plano"><b>Máxima demanda pendiente:</b> falta ${esc([...new Set(PD.por.md)].join("; "))}. Los valores de abajo son provisionales.</p>`
      : "") + cardDemanda(r);
  S.alims = () => tablaAlims(r, "");
  S.cuadro = () => tablaCircuitos(r, "");
  if (r.bal) S.balance = () => cardBalance(r, "");
  S.unifilar = () => cardUnifilar(r, "");
  S.alturas = () => cardAlturas(r, "");
  S.detalles = () => cardDetalles(r, "");
  S.tableros = () => cardTableros(r, "");
  if (r.mode === "multi") {
    S.tgeneral = () => cardTableroGeneral(r, "");
    S.medidores = () => cardMedidores(r, "");
  }
  S.metrado = () => cardMetrado(r);
  S.presupuesto = () => cardPresupuesto(r);
  S.verif = () => cardAlertas(r, "") + cardRecom(r);
  const st = {
    alims: r.alims.every(a => a.ok) ? "" : "bad",
    cuadro: r.circ.every(q => q.ok) ? "" : "bad",
    balance: r.bal && r.bal.desb > 10 ? "warn" : "",
    verif: A.some(x => x[0] === false)
      ? "bad"
      : A.some(x => x[0] === "warn") || recomendaciones(r).some(x => !(ACEP[r.mode] || {})[x.id])
        ? "warn"
        : ""
  };
  if (!S[VIEW]) VIEW = "resumen";
  const kp = html;
  PRINT = () => {
    const P = r.c.proj,
      f = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
    return `<header class="pr-head"><div class="pr-brand"><b>JMG - ELECTRIC</b><span>Resultados de cálculo · ${nomRes(r)}</span></div>
    <dl class="pr-info"><dt>Proyecto</dt><dd>${esc(P.nombre || "—")}</dd><dt>Propietario</dt><dd>${esc(P.prop || "—")}</dd><dt>Ubicación</dt><dd>${esc(P.ubic || "—")}</dd><dt>Proyectista</dt><dd>${esc(P.proy || "—")}</dd><dt>Normativa</dt><dd>CNE-Utilización · RNE EM.010 · Norma DGE</dd><dt>Fecha</dt><dd>${f} · ${VERSION}</dd></dl></header>
    ${kp}${VORDEN.filter(k => S[k] && k !== "verif" && (k !== "presupuesto" || presuHay(r)))
      .map(k => `<div class="pr-sec"><h2 class="pr-h">${VLBL[k]}</h2>${S[k]()}</div>`)
      .join("")}
    <p class="aviso-norma">Cálculos conforme al CNE-Utilización, RNE EM.010 y Normas DGE vigentes. Como en todo proyecto eléctrico, los resultados deben ser verificados por el profesional responsable antes de su ejecución.</p>`;
  };
  html += `<div class="vpanel">${S[VIEW]()}</div>`;
  html += `<p class="aviso-norma">Cálculos conforme al CNE-Utilización, RNE EM.010 y Normas DGE vigentes. Como en todo proyecto eléctrico, los resultados deben ser verificados por el profesional responsable antes de su ejecución.</p>`;
  $("results").innerHTML = html;
  vistasCinta(S, st);
}
// La vista se elige en la cinta (Resultados › Vistas): se marca la vista abierta, se ocultan las que el proyecto
// no tiene y un punto avisa lo que no cumple (rojo) o hay por revisar (ámbar)
function vistasCinta(S, st) {
  document.querySelectorAll(".rb[data-view]").forEach(b => {
    const k = b.dataset.view;
    b.hidden = !!S && !S[k];
    b.classList.toggle("on", !!S && k === VIEW);
    b.classList.toggle("bad", st[k] === "bad");
    b.classList.toggle("warn", st[k] === "warn");
  });
}
function setMode(m) {
  MODE = m;
  $("btnMode").textContent = m === "uni" ? "Cambiar a multifamiliar" : "Cambiar a unifamiliar";
  $("ws").dataset.mode = m;
  $("modeTxt").textContent = $("wsModoTxt").textContent = nomEdif();
  $("usoBox").hidden = m !== "uni";
  uiUso();
  if (!$("ws").hidden && fsDe(NODE)) selNode(NODE);
  update();
}
function setTab(t) {
  if (t === "calculo") {
    abrirWS(null);
    try {
      localStorage.setItem("jmg-electric-tab", "calculo");
    } catch (e) {}
    return;
  }
  if (document.body.classList.contains("ws-on")) cerrarWS(true);
  document.body.classList.toggle("en-inicio", t === "inicio");
  document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  document.querySelectorAll(".tabpanel").forEach(p => (p.hidden = p.id !== "tab-" + t));
  try {
    localStorage.setItem("jmg-electric-tab", t);
  } catch (e) {}
  if (t === "inicio") centro();
  if (t === "proy") renderProy();
  if (t === "herr") herr();
  if (t === "soporte") refrSoporte();
  if (t === "admin" && typeof admAbrir === "function") admAbrir();
  try {
    window.scrollTo({ top: 0 });
  } catch (e) {}
}
// Cuadro «Comenzar» de la cabecera: muestra el acceso al proyecto guardado, si existe
function hdrEstado() {
  const n = $("p_nombre").value.trim(),
    b = $("hdrCont");
  if (!b) return;
  b.hidden = !(n && !/^EJEMPLO\b/.test(n));
  b.querySelector("b").textContent = n;
  b.dataset.ayuda = n ? `Abrir «${n}» en el espacio de trabajo` : "";
}
/* Datos que salen del plano con «Calcular con el diseño» (ids de los campos): no se revisan ni se piden */
function planoOmitidos(D) {
  const PD = planoDatos(D),
    S = new Set();
  if (D.MODE === "multi") {
    if (PD.ali) S.add("Lgen");
    if (PD.rutas.BM) S.add("Lbm");
    if (PD.rutas.TSG) S.add("Lms");
    // El número de unidades del tipo, si no se escribe, es el de sus tableros dibujados
    PD.deps.forEach(i => ["cant", "nAl", "nTo", "Lc"].forEach(k => S.add(`tipos_${k}_${i}`)));
    PD.depsLd.forEach(i => S.add(`tipos_Ld_${i}`));
    PD.depsArea.forEach(i => S.add(`tipos_area_${i}`));
    return S;
  }
  const P = D.pisos || [],
    tabDe = n => (!P.length || (n === 1 && D.esqPisos === "tg") ? "TG" : tabPiso(n)),
    sal = (n, pre) =>
      PD.tabs.has(tabDe(n)) && ["al", "tg", "tc"].forEach(k => ["_n", "_L"].forEach(s => S.add(pre + k + s)));
  if (PD.ali) S.add("Lalim");
  if (PD.areas.has(1)) S.add("area");
  if (PD.rutas["TD-1"]) S.add("Ltd1");
  sal(1, "");
  P.forEach((p, i) => {
    if (PD.areas.has(i + 2)) S.add(`pisos_area_${i}`);
    if (PD.rutas[tabPiso(i + 2)]) S.add(`pisos_Ld_${i}`);
    if (PD.tabs.has(tabPiso(i + 2)))
      ["al", "tg", "tc"].forEach(k => ["_n", "_L"].forEach(s => S.add(`pisos_${k}${s}_${i}`)));
  });
  (D.cargas || []).forEach((x, i) => {
    const k = Math.round(+x.piso || 0);
    if (PD.tabs.has(P.length && k >= 1 ? tabDe(k) : "TG")) ["p", "L"].forEach(c => S.add(`cargas_${c}_${i}`));
  });
  return S;
}
function validar() {
  const OM = planoOmitidos(estado()),
    E = [],
    v = id => {
      const x = $(id).value.trim();
      return x === "" ? 0 : parseFloat(x);
    };
  document.querySelectorAll(".inv").forEach(e => e.classList.remove("inv"));
  const chk = (id, ok, msg) => {
    if (ok || OM.has(id)) return;
    const el = $(id);
    if (el) el.classList.add("inv");
    E.push(msg);
  };
  chk("fp", v("fp") >= 0.5 && v("fp") <= 1, "El factor de potencia debe estar entre 0.5 y 1.");
  chk("iccE", v("iccE") > 0, "Ingrese la corriente de cortocircuito del punto de entrega (Ajustes).");
  chk("rho_s", v("rho_s") > 0, "Ingrese la resistividad del suelo (Ajustes).");
  chk("Lv", v("Lv") >= 0.5, "Ingrese la longitud de la varilla de puesta a tierra (Ajustes).");
  chk(
    "maxSal",
    v("maxSal") >= 1 && v("maxSal") <= 12,
    "Las salidas por circuito deben estar entre 1 y 12 (Regla 070-3000)."
  );
  if (MODE === "uni") {
    chk("area", v("area") > 0, "Ingrese el área techada de la vivienda.");
    chk("sot", !(v("sot") < 0), "El área de sótano no puede ser negativa.");
    chk("Lalim", v("Lalim") > 0, "Ingrese la longitud del alimentador.");
    [
      ["al", "alumbrado"],
      ["tg", "tomacorrientes generales"],
      ["tc", "tomacorrientes de cocina"]
    ].forEach(([k, t]) => {
      chk(k + "_n", v(k + "_n") >= 0, `Ingrese la cantidad de salidas de ${t} (0 si no hay).`);
      chk(k + "_p", v(k + "_p") >= 0, `Ingrese la potencia por salida de ${t}.`);
      if (v(k + "_n") > 0) chk(k + "_L", v(k + "_L") > 0, `Ingrese la longitud de los circuitos de ${t}.`);
    });
    cargas.forEach((x, i) => {
      chk(`cargas_p_${i}`, x.p >= 0, `Carga especial ${i + 1}: la potencia no puede ser negativa.`);
      if (x.p > 0) chk(`cargas_L_${i}`, x.L > 0, `Carga especial ${i + 1} (${x.nombre}): ingrese la longitud.`);
    });
    if (pisos.length && $("esqPisos").value === "td")
      chk("Ltd1", v("Ltd1") > 0, "Ingrese la longitud del alimentador al tablero del 1er piso.");
    pisos.forEach((p, i) => {
      const n = `${ORD(i + 2)} piso`;
      chk(`pisos_area_${i}`, p.area > 0, `${n}: ingrese el área techada.`);
      chk(`pisos_Ld_${i}`, p.Ld > 0, `${n}: ingrese la longitud del alimentador.`);
      [
        ["al", "alumbrado"],
        ["tg", "tomacorrientes"],
        ["tc", "tomacorrientes de cocina"]
      ].forEach(([k, t]) => {
        chk(`pisos_${k}_n_${i}`, !(p[k + "_n"] < 0), `${n}: la cantidad de salidas de ${t} no puede ser negativa.`);
        if (p[k + "_n"] > 0)
          chk(`pisos_${k}_L_${i}`, p[k + "_L"] > 0, `${n}: ingrese la longitud de los circuitos de ${t}.`);
      });
    });
  } else {
    chk("Lgen", v("Lgen") > 0, "Ingrese la longitud del alimentador general.");
    if (PROY.bmJunto === "0") chk("Lbm", v("Lbm") > 0, "Ingrese la longitud del TG al banco de medidores.");
    if (serv.length) chk("Lms", v("Lms") > 0, "Ingrese la longitud al tablero de servicios generales.");
    // Unidades del tipo: las escritas o, con el diseño, las de sus tableros en el plano
    const conUnid = (t, i) => t.cant > 0 || (!(t.cant > 0) && OM.has(`tipos_cant_${i}`));
    if (!tipos.some(conUnid)) E.push("Agregue al menos un tipo de departamento con una o más unidades.");
    tipos.forEach((t, i) => {
      const n = t.nombre || `Tipo ${i + 1}`;
      chk(
        `tipos_cant_${i}`,
        t.cant >= 0 && Number.isInteger(t.cant),
        `${n}: el número de unidades debe ser un entero.`
      );
      if (conUnid(t, i)) {
        chk(`tipos_area_${i}`, t.area > 0, `${n}: ingrese el área${t.uso && t.uso !== "viv" ? "" : " de vivienda"}.`);
        chk(`tipos_Ld_${i}`, t.Ld > 0, `${n}: ingrese la longitud del alimentador.`);
        chk(`tipos_Lc_${i}`, t.Lc > 0, `${n}: ingrese la longitud de los circuitos.`);
      }
    });
    serv.forEach((x, i) => {
      if (x.p > 0) chk(`serv_L_${i}`, x.L > 0, `Carga común ${i + 1} (${x.nombre}): ingrese la longitud.`);
    });
  }
  return E;
}
// Resumen del último cálculo que se guarda con el proyecto (Centro de ingeniería): datos pendientes, conforme y máxima demanda
let RESUMEN = null;
/* Datos obligatorios que faltan. Sin argumento revisa el proyecto en pantalla y los marca en ámbar; con un
   proyecto (vista previa de una ventana) solo revisa sus datos, sin marcar nada. */
/* Con «Calcular con el diseño»: los tableros del plano que tienen circuitos y los alimentadores medidos en él (para
   no pedir los datos que salen del plano). Sin el modo, o sin diseño, nada. */
function planoDatos(D) {
  const vacio = {
    tabs: new Set(),
    fuera: [],
    noms: [],
    rutas: {},
    ali: false,
    areas: new Set(),
    deps: new Set(),
    depsLd: new Set(),
    depsArea: new Set(),
    libres: []
  };
  if (D.calPlano !== "1" || !D.PLANO || !D.PLANO.dis) return vacio;
  const n = k => parseFloat(D[k]) || 0,
    R = planoCalc(D.PLANO, ctx(D), {
      al_p: n("al_p"),
      tg_p: n("tg_p"),
      tc_p: n("tc_p"),
      hEnt: n("hEnt") || 3.1,
      ...(D.MODE === "multi" ? { nTipos: (D.tipos || []).length, tipo0: ((D.tipos || [])[0] || {}).nombre } : {})
    });
  if (!R) return vacio;
  const tabs = new Set(R.tabs.filter(t => t.circs.length).map(t => t.nom));
  // Pisos con áreas marcadas en el plano (su área no se pide)
  const areas = new Set(
    Object.entries(R.pisos)
      .filter(([n, o]) => +n > 0 && (o.tech || o.ext || o.aulas))
      .map(([n]) => +n)
  );
  // Edificio: tipos de departamento con tableros en el plano y los que tienen su alimentador desde el banco
  const deps = new Set(R.tabs.filter(t => Number.isInteger(t.dep) && t.circs.length).map(t => t.dep)),
    depsLd = new Set(R.tabs.filter(t => Number.isInteger(t.dep) && R.desdeMed[t.id]).map(t => t.dep)),
    depsArea = new Set(
      Object.entries(R.areaDep)
        .filter(([, o]) => o.m2 > 0)
        .map(([i]) => +i)
    );
  // Vivienda y otros usos: tableros del plano con salidas cuyo nombre no está en el cálculo (no se calculan)
  const P = D.pisos || [],
    noms =
      D.MODE === "multi"
        ? null
        : new Set(["TG", ...(P.length && D.esqPisos === "td" ? ["TD-1"] : []), ...P.map((_, i) => tabPiso(i + 2))]),
    fuera = noms
      ? R.tabs
          .filter(t => t.circs.length && !noms.has(t.nom))
          .map(t => ({ id: t.id, nom: t.nom, n: t.circs.reduce((s, q) => s + q.n, 0) }))
      : [],
    // Nombres del cálculo que ningún tablero del plano usa (para renombrar uno con un clic)
    libres = noms ? [...noms].filter(n => !R.tabs.some(t => t.nom === n)) : [];
  return {
    tabs,
    rutas: R.rutas,
    ali: !!R.rutas.TG,
    areas,
    deps,
    depsLd,
    depsArea,
    fuera,
    libres,
    noms: noms ? [...noms] : []
  };
}
// Resumen del diseño en Salidas (Diseño en el plano) y avisos en los datos que salen del plano
function planoResumen(r) {
  const usa = PROY.calPlano === "1",
    hay = !!(PLANO && PLANO.dis && PLANO.dis.els.some(e => (e.k === "tab" && e.nc) || e.ar)),
    P = r && r.plano,
    nc = P ? r.circ.filter(q => q.plano).length : 0,
    av = P ? P.avisos.filter(a => a.t !== "info").length : 0,
    btn = `<button type="button" class="linkbtn" data-act="datosplano">Ver los datos del plano</button>`;
  let h = "";
  if (!usa)
    h = hay ? `El plano tiene tableros con circuitos o áreas: elija «Del diseño» para calcular con ellos. ${btn}` : "";
  else if (!hay)
    h =
      "<b>El plano aún no tiene tableros con circuitos ni áreas</b>: se calcula con los datos escritos. Dibuje el diseño en Planos › Editor de diseño.";
  else if (P)
    h = `<b>Del plano:</b> ${P.tabs.length ? `${P.tabs.join(", ")} · ${nc} circuito${nc === 1 ? "" : "s"}` : "ningún tablero del cálculo"}${P.areas && P.areas.length ? ` · áreas de ${P.areas.length} piso${P.areas.length > 1 ? "s" : ""}` : ""}${P.ali ? " · alimentador medido en el plano" : ""}${av ? ` · <b class="w">${av} aviso${av === 1 ? "" : "s"}</b>` : ""}. ${btn}`;
  $("plCalRes").innerHTML = h;
  $("plCalRes").hidden = !h;
  PLANO_CAMPOS = (P && P.campos) || {};
  document.querySelectorAll(".del-plano").forEach(e => {
    e.classList.remove("del-plano");
    e.readOnly = false;
    const c = e.parentElement && e.parentElement.querySelector(".pl-chip");
    if (c) c.remove();
  });
  Object.entries(PLANO_CAMPOS).forEach(([k, v]) => {
    const e = $(k);
    if (!e) return;
    e.classList.add("del-plano");
    e.readOnly = true;
    e.insertAdjacentHTML(
      "afterend",
      `<span class="pl-chip" title="Sale del diseño en el plano (Calcular con el diseño)">del plano: ${fmt(v, 2)}</span>`
    );
  });
  const T = P ? P.tabs : [],
    nota = (id, t) => {
      $(id).innerHTML = t;
      $(id).hidden = !t;
    };
  nota(
    "salPlanoN",
    T.length
      ? `<b>Calcular con el diseño:</b> ${T.join(", ")} toma${T.length > 1 ? "n" : ""} sus salidas y longitudes del plano; las escritas aquí solo se usan en los tableros que no están dibujados. La potencia por salida sí se usa: es la de las salidas sin potencia propia ni tipo de luminaria.`
      : ""
  );
  nota(
    "carPlanoN",
    T.length
      ? `<b>Calcular con el diseño:</b> las cargas especiales de ${T.join(", ")} salen del plano; las de esos tableros escritas aquí no se usan.`
      : ""
  );
  // Vivienda: áreas y alimentador del plano
  const va = [
    P && P.areas && P.areas.length
      ? `el área de ${P.areas.map(n => ORD(n) + " piso").join(", ")} sale de las áreas marcadas (${r.viv ? "dimensiones interiores, Regla 050-110" : "contorno exterior, Regla 050-210"})${P.sot ? ", también la del sótano" : ""}${P.libre ? " y la libre no techada" : ""}`
      : "",
    P && P.ali ? `el alimentador del medidor al TG mide ${fmt(r.alims[0].L, 2)} m en el plano` : ""
  ].filter(Boolean);
  nota(
    "aliPlanoN",
    va.length ? `<b>Calcular con el diseño:</b> ${va.join("; ")}. Esos datos escritos no se usan.` : ""
  );
}
// Datos que salen del plano en el último cálculo (clave del campo → valor), para mostrarlos en las ventanas
let PLANO_CAMPOS = {};
// El aviso «del plano» de un formulario, para las ventanas de datos (sin sus botones)
const planoNota = id => {
  const e = $(id);
  return e && !e.hidden && e.innerHTML
    ? `<p class="fc-nota">${e.innerHTML.replace(/<button[\s\S]*?<\/button>/g, "")}</p>`
    : "";
};
function faltantes(p = null) {
  let tot = 0;
  const D = p || estado(),
    marcar = !p,
    { cargas, pisos, tipos, cargasT, serv } = D,
    F = [],
    vacio = v => v == null || v === "" || !(parseFloat(v) > 0),
    val = id => (D[id] == null ? "" : String(D[id]));
  if (marcar) document.querySelectorAll(".falta").forEach(e => e.classList.remove("falta"));
  const req = (id, l, cond) => {
    tot++;
    if (cond === undefined ? vacio(val(id)) : cond) {
      F.push({ id, l });
      const el = marcar && $(id);
      if (el) el.classList.add("falta");
    }
  };
  if (D.MODE === "uni") {
    const PD = planoDatos(D),
      tabDe = n => (!pisos.length || (n === 1 && val("esqPisos") === "tg") ? "TG" : tabPiso(n)),
      delPlano = n => PD.tabs.has(tabDe(n));
    if (!PD.areas.has(1))
      req("area", D.uso && D.uso !== "viv" ? "Área de la edificación (Regla 050-210)" : "Área techada de la vivienda");
    if (!PD.ali) req("Lalim", "Longitud del alimentador");
    [
      ["al", "alumbrado"],
      ["tg", "tomacorrientes"]
    ].forEach(([k, t]) => {
      if (!delPlano(1)) req(k + "_n", `Número de salidas de ${t}`);
      req(k + "_p", `Potencia por salida de ${t}`);
      if (!delPlano(1)) req(k + "_L", `Longitud de los circuitos de ${t}`);
    });
    if (parseFloat(val("tc_n")) > 0 && !delPlano(1)) {
      req("tc_p", "Potencia por salida de tomacorrientes de cocina");
      req("tc_L", "Longitud de los circuitos de cocina");
    }
    cargas.forEach((x, i) => {
      const k = Math.round(+x.piso || 0);
      if (PD.tabs.has(pisos.length && k >= 1 ? tabDe(k) : "TG")) return;
      const n = x.nombre || `Carga especial ${i + 1}`;
      req(`cargas_p_${i}`, `${n}: potencia`, vacio(x.p));
      req(`cargas_L_${i}`, `${n}: longitud`, vacio(x.L));
    });
    if (pisos.length && val("esqPisos") === "td" && !PD.rutas["TD-1"])
      req("Ltd1", "Longitud del alimentador al tablero del 1er piso");
    pisos.forEach((p, i) => {
      const n = `${ORD(i + 2)} piso`,
        pl = delPlano(i + 2);
      [
        ["area", "área techada"],
        ["Ld", "longitud del alimentador"],
        ["al_n", "salidas de alumbrado"],
        ["al_L", "longitud de alumbrado"],
        ["tg_n", "tomacorrientes"],
        ["tg_L", "longitud de tomacorrientes"]
      ].forEach(([k, l]) => {
        if (k === "area" ? !PD.areas.has(i + 2) : k === "Ld" ? !PD.rutas[tabPiso(i + 2)] : !pl)
          req(`pisos_${k}_${i}`, `${n}: ${l}`, vacio(p[k]));
      });
      if (p.tc_n > 0 && !pl) req(`pisos_tc_L_${i}`, `${n}: longitud de cocina`, vacio(p.tc_L));
    });
  } else {
    const PD = planoDatos(D);
    if (!PD.ali) req("Lgen", "Longitud del alimentador general");
    if (D.bmJunto === "0" && !PD.rutas.BM) req("Lbm", "Longitud del TG al banco de medidores");
    if (!tipos.length) F.push({ id: "add_tipos", l: "Agregue al menos un tipo de departamento" });
    tipos.forEach((t, i) => {
      const n = t.nombre || `Tipo ${i + 1}`;
      [
        ["cant", "número de unidades"],
        ["area", USOS[t.uso] ? "área de la edificación (Regla 050-210)" : "área de vivienda"],
        ["Ld", "longitud del alimentador"],
        ["nAl", "salidas de alumbrado"],
        ["nTo", "tomacorrientes"],
        ["Lc", "longitud de los circuitos"]
      ].forEach(([k, l]) => {
        // Con el diseño: las salidas y la longitud de los circuitos del tipo salen de sus tableros del plano
        // (el número de unidades, de cuántos tableros del tipo hay dibujados)
        if (
          (["cant", "nAl", "nTo", "Lc"].includes(k) && PD.deps.has(i)) ||
          (k === "Ld" && PD.depsLd.has(i)) ||
          (k === "area" && PD.depsArea.has(i))
        )
          return;
        req(`tipos_${k}_${i}`, `${n}: ${l}`, vacio(t[k]));
      });
    });
    cargasT.forEach((x, i) => {
      const n = x.nombre || `Carga especial ${i + 1}`;
      req(`cargasT_p_${i}`, `${n}: potencia`, vacio(x.p));
      req(`cargasT_L_${i}`, `${n}: longitud`, vacio(x.L));
    });
    if (serv.length && !PD.rutas.TSG) req("Lms", "Longitud al tablero de servicios generales");
    serv.forEach((x, i) => {
      const n = x.nombre || `Carga común ${i + 1}`;
      req(`serv_p_${i}`, `${n}: potencia`, vacio(x.p));
      req(`serv_L_${i}`, `${n}: longitud`, vacio(x.L));
    });
  }
  F.total = tot;
  return F;
}
// Textos de Vivienda y Salidas según la vivienda tenga uno o varios pisos
function uiPisos() {
  const varios = pisos.length > 0,
    td = $("esqPisos").value === "td",
    lt = id => {
      const s = $(id).closest("label").querySelector(".lt");
      return s && s.firstChild && s.firstChild.nodeType === 3 ? s.firstChild : null;
    };
  const ta = lt("area");
  if (ta) ta.nodeValue = varios ? "Área techada del 1er piso (m²)" : "Área techada (m²)";
  $("fs-sal").querySelector("legend").textContent = varios ? "Salidas · 1er piso" : "Salidas";
  $("salPisos").hidden = varios;
  document.querySelector("#fs-pisos .pisos-esq").hidden = !varios;
  $("lblLtd1").hidden = !(varios && td);
  const uU = USOS[usoAct()],
    edif = uU ? "Edificación" : "Vivienda",
    regP = uU ? (uU.regla ? `la Regla ${uU.regla}` : "la Tabla 14 (Regla 050-210)") : "la Regla 050-200";
  $("pisosLeg").innerHTML = `Pisos y tableros <small>${uU ? uU.regla || "050-210" : "050-200"}</small>`;
  $("pisosHint").textContent = varios
    ? `${edif} de ${pisos.length + 1} pisos: el alimentador general se calcula con el área total; cada tablero de piso, con ${regP} aplicada al área de su piso.`
    : `${edif} de un piso: todos los circuitos salen del tablero general TG. Agregue los pisos superiores para que cada uno tenga su tablero de distribución.`;
}
// Cálculo automático (AUTO) o manual: en manual los cambios se guardan, pero se recalcula solo con calcularAhora()
let AUTO = true,
  FORZAR = false,
  DESACT = false;
function calcularAhora() {
  const f0 = FORZAR;
  FORZAR = true;
  try {
    update();
  } finally {
    FORZAR = f0;
  }
}
function marcarDesact() {
  if (!$("desactBox"))
    $("results").insertAdjacentHTML(
      "afterbegin",
      `<div class="desact" id="desactBox"><span><b>Cálculo automático desactivado.</b> Los resultados no reflejan los últimos cambios en los datos.</span><button type="button" class="btn sm" data-calcnow>Calcular ahora (F9)</button></div>`
    );
  const st = $("wsStatus").children[1];
  if (st) st.innerHTML = `<span class="w">●</span> Resultados desactualizados · F9`;
}
/* Tableros dibujados en el plano que el cálculo no reconoce por su nombre: sus salidas no cuentan y por eso el cálculo
   pide los datos escritos. Se avisa la causa en «Para calcular, complete». */
function planoFueraAviso() {
  let PD;
  try {
    PD = planoDatos(estado());
  } catch {
    return "";
  }
  // Proyecto que se calcula con el diseño: lo que falta se dibuja en el editor
  const ir = `<button type="button" class="btn sm" data-abred>Abrir el editor de diseño</button>`;
  if (!PD.fuera.length)
    return PROY.calPlano === "1"
      ? `<p class="falta-plano"><b>Este proyecto se calcula con el diseño del plano.</b> Las salidas, las longitudes y las áreas salen del dibujo: coloque los tableros con sus circuitos, las salidas y las tuberías; lo que el plano aún no tiene se pide abajo. ${ir}</p>`
      : "";
  const s = PD.fuera.map(t => `<b>${esc(t.nom)}</b> (${t.n} salida${t.n === 1 ? "" : "s"})`).join(", ");
  // Un tablero fuera y un nombre libre del cálculo: se renombra con un clic
  const ren =
    PD.fuera.length === 1 && PD.libres.length
      ? `<button type="button" class="btn sm" data-renplano="${esc(String(PD.fuera[0].id))}" data-nom="${esc(PD.libres[0])}">Llamarlo ${esc(PD.libres[0])}</button> `
      : "";
  return `<p class="falta-plano"><b>El plano tiene ${PD.fuera.length === 1 ? "el tablero" : "los tableros"} ${s}, pero el cálculo solo tiene ${esc(PD.noms.join(", "))}.</b> Sus salidas no se cuentan y por eso se piden escritas. ${ren ? `Si es el tablero general, llámelo ${esc(PD.libres[0])}: ` : ""}${ren}También puede cambiarle el nombre en el Editor de diseño (doble clic en el tablero o «Renombrar» en Revisar diseño), o agregar su piso en Vivienda › Pisos y tableros. ${ir}</p>`;
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-abred]")) edAbrir(!PLANO);
  const rn = e.target.closest("[data-renplano]");
  if (rn) planoRenombrar(rn.dataset.renplano, rn.dataset.nom);
});
// Cambia el nombre de un tablero del plano (en el editor, si está abierto; si no, en el diseño guardado del proyecto)
function planoRenombrar(id, nom) {
  const D = ED.abierto && typeof dsD === "function" ? dsD() : PLANO && PLANO.dis,
    el = D && D.els.find(x => String(x.id) === String(id));
  if (!el) return;
  const ant = el.nom || "TG";
  el.nom = nom;
  if (ED.abierto) edCambio();
  else {
    saveDraft();
    histPush();
  }
  calcularAhora();
  toast(`El tablero ${ant} ahora se llama ${nom}: sus salidas entran al cálculo`);
}
/* Cálculo preliminar: con datos pendientes, el proyecto que se calcula con el diseño se calcula igual con lo que ya
   tiene (el plano y lo escrito), para ver cómo va mientras se dibuja. Lo que falta cuenta como 0 (salidas, potencias, áreas), 1 m (longitudes) o 1
   unidad (departamentos de un tipo). El resultado lleva la marca «preliminar» y la lista de pendientes; el Excel,
   el expediente y los planos se habilitan solo con el proyecto completo. Sin tipos de departamento no hay cálculo. */
// Solo con «Calcular con el diseño» y un plano que ya tiene tableros con circuitos o áreas (un proyecto vacío no)
const prelimPosible = () =>
  PROY.calPlano === "1" && !!(PLANO && PLANO.dis && PLANO.dis.els.some(e => (e.k === "tab" && e.nc) || e.ar));
function estadoParcial(D, F) {
  if (F.some(x => x.id === "add_tipos")) return null;
  const P = JSON.parse(JSON.stringify(D));
  for (const x of F) {
    const m = /^(tipos|cargasT|cargas|pisos|serv)_(.+)_(\d+)$/.exec(x.id),
      k = m ? m[2] : x.id,
      v = k === "cant" ? 1 : /^L|_L$/.test(k) ? 1 : 0;
    if (m) {
      const o = (P[m[1]] || [])[+m[3]];
      if (o) o[k] = v;
    } else P[k] = String(v);
  }
  return P;
}
/* Cálculo por partes: qué del resultado preliminar depende de un dato que falta (y se muestra «pendiente» en vez de
   un número de relleno) y qué ya es definitivo.
   · md: falta un dato de la carga (área, salidas, potencias, unidades): la máxima demanda y todos los alimentadores.
   · al: alimentadores pendientes (por la máxima demanda o por su longitud); dv: alimentadores cuya ΔV acumulada
     depende de una longitud que falta (la suya o la de uno aguas arriba).
   · circ: circuitos con un dato propio pendiente; cdv: circuitos cuya ΔV total depende de un alimentador pendiente.
   Cada parte guarda los datos que faltan (por: clave → textos), para el «title». */
function prelimPartes(F, r) {
  const P = { md: false, al: new Set(), dv: new Set(), circ: new Set(), cdv: new Set(), por: {} },
    motivo = (k, l) => (P.por[k] = [...(P.por[k] || []), l]),
    alim = (j, l, dv) => {
      if (j < 0) return;
      P.al.add(j);
      motivo("a" + j, l);
      if (dv) {
        // Su ΔV acumulada y la de lo que alimenta: el general, todo
        r.alims.forEach((a, i) => {
          if (i !== j && j !== 0) return;
          P.dv.add(i);
          motivo("v" + i, l);
        });
        r.circ.forEach(q => {
          if (j !== 0 && q.feeder !== j) return;
          P.cdv.add(q.key);
          motivo("w" + q.key, l);
        });
      }
    },
    circ = (f, l) =>
      r.circ.forEach(q => {
        if (q.src && f(q.src)) {
          P.circ.add(q.key);
          motivo("c" + q.key, l);
        }
      }),
    alimDe = tab => r.alims.findIndex(a => new RegExp(`→ (tablero )?${tab}\\b`).test(a.desc));
  F.forEach(x => {
    const m = /^(tipos|cargasT|cargas|pisos|serv)_(.+)_(\d+)$/.exec(x.id),
      k = m ? m[2] : x.id,
      i = m ? +m[3] : -1,
      L = /^L|_L$/.test(k);
    if (!L) {
      P.md = true;
      motivo("md", x.l);
    }
    if (!m) {
      if (k === "Lalim" || k === "Lgen") alim(0, x.l, true);
      else if (k === "Lbm")
        alim(
          r.alims.findIndex(a => a.pKey === "bm"),
          x.l,
          true
        );
      else if (k === "Lms")
        alim(
          r.alims.findIndex(a => a.pKey === "servP"),
          x.l,
          true
        );
      else if (k === "Ltd1") alim(alimDe("TD-1"), x.l, true);
      else {
        // Salidas del 1er piso (o de la vivienda de un piso): sus grupos de circuitos
        const g = k.split("_")[0];
        if (["al", "tg", "tc"].includes(g)) circ(s => s.t === "grp" && s.k === g, x.l);
      }
      return;
    }
    const lista = m[1];
    if (lista === "pisos") {
      if (k === "Ld") alim(alimDe(tabPiso(i + 2)), x.l, true);
      else if (k !== "area") circ(s => s.t === "piso" && s.i === i && s.k === k.split("_")[0], x.l);
    } else if (lista === "tipos") {
      if (k === "Ld")
        alim(
          r.alims.findIndex(a => a.pKey === "tipo" && r.T[a.ti] && r.T[a.ti]._i === i),
          x.l,
          true
        );
      else if (["nAl", "nTo", "Lc"].includes(k)) circ(s => s.t === "tipo" && s.i === i, x.l);
    } else circ(s => s.t === lista && s.i === i, x.l);
  });
  // Sin la máxima demanda, ningún alimentador es definitivo
  if (P.md) r.alims.forEach((a, j) => (P.al.add(j), motivo("a" + j, "la máxima demanda")));
  return P;
}
// Celda o texto «pendiente», con los datos que faltan en el title
const pendTxt = (P, k, t = "pendiente") => {
  const m = [...new Set(P.por[k] || [])];
  return `<span class="pend-v" title="${esc(m.length ? "Falta: " + m.join("; ") : "Faltan datos del proyecto")}">${t}</span>`;
};
/* Máxima demanda, alimentador general y ΔV máxima de un resultado (resumen y cálculo en vivo del editor); en uno
   preliminar, null lo que está pendiente, y la ΔV solo de lo que ya es definitivo */
function vivoDatos(r) {
  const PD = r.pend,
    dvs = [
      ...r.alims.filter((a, i) => !(PD && (PD.al.has(i) || PD.dv.has(i)))).map(a => a.dvAc),
      ...r.circ.filter(c => !(PD && (PD.circ.has(c.key) || PD.cdv.has(c.key)))).map(c => c.dVt)
    ];
  return {
    md: PD && PD.md ? null : r.mode === "multi" ? r.MD : r.md.MD,
    a0: PD && PD.al.has(0) ? null : r.alims[0],
    dv: dvs.length ? Math.max(...dvs) : null
  };
}
// Aviso del resultado preliminar, con los datos que faltan (clic: ir al dato)
function prelimCard(F) {
  return `<section class="card falta-card prelim"><h2><span>Resultado preliminar</span><span class="ref">${F.length} dato${F.length > 1 ? "s" : ""} pendiente${F.length > 1 ? "s" : ""}</span></h2><div class="body">
      <p class="hint">Se calculó por partes con lo que el proyecto tiene hasta ahora: lo que ya tiene sus datos es definitivo; lo que depende de un dato que falta dice <i>pendiente</i> (pase el mouse para ver cuál). Los diagramas, los tableros y el metrado son provisionales. El Excel, el expediente y los planos se habilitan con el proyecto completo.</p>
      ${planoFueraAviso()}
      <ul class="faltan">${F.map(x => `<li><button type="button" class="linkbtn" data-foco="${x.id}">${esc(x.l)}</button></li>`).join("")}</ul></div></section>`;
}
// Resultado listo para entregar (Excel, expediente, planos): calculado y sin datos pendientes; si no, lo avisa
function entregable() {
  if (LAST && !LAST.prelim) return true;
  toast(
    LAST
      ? `Resultado preliminar: complete ${LAST.prelim.length === 1 ? "el dato pendiente" : `los ${LAST.prelim.length} datos pendientes`} para exportar`
      : "Complete los datos para exportar"
  );
  return false;
}
function update() {
  if (!AUTO && !FORZAR) {
    DESACT = true;
    saveDraft();
    hdrEstado();
    histPush();
    marcarDesact();
    return;
  }
  DESACT = false;
  uiPisos();
  // Edificio: la longitud TG → banco de medidores solo si el banco no está junto al TG
  if ($("LbmBox")) $("LbmBox").hidden = PROY.bmJunto !== "0";
  // y el diámetro máximo de la tubería TG → banco, solo si el banco está junto al TG
  if ($("tgbmBox")) $("tgbmBox").hidden = PROY.bmJunto === "0";
  // y el porcentaje de los locales de otro uso en el alimentador general, solo si hay locales
  if ($("fLocBox")) $("fLocBox").hidden = !LISTS.tipos.arr.some(t => t.uso && t.uso !== "viv");
  const F = faltantes();
  // Con datos pendientes: cálculo preliminar con lo que el proyecto tiene (si se puede); si no, la lista de lo que falta
  let r = null;
  if (F.length && prelimPosible()) {
    const D = estadoParcial(estado(), F);
    try {
      r = D ? calcular(D) : null;
      if (!r || !r.alims || !r.alims.length) r = null;
    } catch (e) {
      r = null;
    }
    if (r) {
      r.prelim = F;
      r.pend = prelimPartes(F, r);
    }
  }
  if (F.length && !r) {
    LAST = null;
    PRINT = null;
    $("btnXlsx").disabled = true;
    $("btnPrint").disabled = true;
    document.querySelectorAll(".inv").forEach(e => e.classList.remove("inv"));
    const c = ctx();
    $("projline").innerHTML =
      `<span>Proyecto: <b>${esc(c.proj.nombre || "—")}</b></span><span>Propietario: <b>${esc(c.proj.prop || "—")}</b></span><span>Ubicación: <b>${esc(c.proj.ubic || "—")}</b></span><span>Proyectista: <b>${esc(c.proj.proy || "—")}</b></span>`;
    $("results").innerHTML =
      `<section class="card falta-card"><h2><span>Para calcular, complete</span><span class="ref">${F.length} dato${F.length > 1 ? "s" : ""} pendiente${F.length > 1 ? "s" : ""}</span></h2><div class="body">
      <p class="hint">Los resultados aparecen automáticamente al completar los datos marcados en ámbar. Haga clic en un dato para ir a él.</p>
      ${planoFueraAviso()}
      <ul class="faltan">${F.map(x => `<li><button type="button" class="linkbtn" data-foco="${x.id}">${esc(x.l)}</button></li>`).join("")}</ul>
      <p class="hint">¿Prefiere explorar primero? <button type="button" class="linkbtn" data-ej2="${MODE === "uni" && usoAct() !== "viv" ? "com" : MODE}">Cargue un proyecto de ejemplo</button>.</p></div></section>`;
    vistasCinta(null, {});
    RESUMEN = { pend: F.length, tot: F.total };
    planoResumen(null);
    saveDraft();
    hdrEstado();
    wsRefresh(F);
    return;
  }
  const errs = F.length ? [] : validar();
  if (!r && MODE === "multi" && !tipos.some(t => t.cant > 0) && !planoDatos(estado()).deps.size) {
    LAST = null;
    $("btnXlsx").disabled = true;
    $("results").innerHTML =
      `<section class="card"><h2>Revise los datos de entrada</h2><div class="body"><ul class="alerts">${errs.map(t => `<li class="bad"><span>${esc(t)}</span></li>`).join("")}</ul></div></section>`;
    saveDraft();
    return;
  }
  // El Excel y el expediente, solo con el proyecto completo
  $("btnXlsx").disabled = $("btnPrint").disabled = !!F.length;
  // El motor recibe los datos del proyecto (el mismo objeto que se guarda en el .json) y no lee la pantalla
  if (!r) r = calcular(estado());
  const c = r.c;
  LAST = r;
  RESUMEN = {
    pend: F.length,
    tot: F.total,
    ok: !F.length && r.alims.every(a => a.ok) && r.circ.every(q => q.ok),
    MD: Math.round(r.mode === "multi" ? r.MD : r.md.MD)
  };
  $("projline").innerHTML =
    `<span>Proyecto: <b>${esc(c.proj.nombre || "—")}</b></span><span>Propietario: <b>${esc(c.proj.prop || "—")}</b></span><span>Ubicación: <b>${esc(c.proj.ubic || "—")}</b></span><span>Proyectista: <b>${esc(c.proj.proy || "—")}</b></span>`;
  render(r);
  if (F.length) PRINT = null;
  planoResumen(r);
  saveDraft();
  hdrEstado();
  wsRefresh(F);
  if (F.length) $("results").insertAdjacentHTML("afterbegin", prelimCard(F));
  if (errs.length)
    $("results").insertAdjacentHTML(
      "afterbegin",
      `<section class="card"><h2>Revise los datos de entrada</h2><div class="body"><ul class="alerts">${errs.map(t => `<li class="bad"><span>${esc(t)}</span></li>`).join("")}</ul></div></section>`
    );
}

// Textos que cambian con el uso de la edificación (vivienda o un uso de la Tabla 14)
function uiUso() {
  const u = usoAct(),
    U = USOS[u],
    viv = u === "viv";
  $("wsModoTxt").textContent = $("modeTxt").textContent = nomEdif();
  if ($("wsModo")) $("wsModo").textContent = nomEdif();
  $("vivLeg").innerHTML = viv
    ? "Vivienda <small>050-110 · 050-200</small>"
    : "Edificación <small>050-210 · Tabla 14</small>";
  $("areaLbl").textContent = viv ? "Área techada (m²)" : "Área según dimensiones exteriores (m²)";
  $("vivHint").textContent = viv
    ? "Área de vivienda: 100 % de pisos dedicados a vivienda más 75 % del sótano. Alimentador: del medidor al tablero general."
    : `Área servida según las dimensiones exteriores, incluido el sótano (Regla ${U.regla || "050-210"}). Alimentador: del medidor al tablero general.`;
  NODETIT.vivienda = viv ? "Vivienda" : "Edificación";
  if (NODE === "vivienda" && $("propSub")) $("propSub").textContent = NODETIT.vivienda;
  const comun = ` Sin corriente mínima de 40 A; alimentadores con 1.25 × I por ser carga continua (Regla 050-104(3)). Tomacorrientes: ${VA_TOMA_COM} VA por salida como criterio de diseño.`;
  $("usoHint").textContent = viv
    ? ""
    : U.regla
      ? `${U.n} (Regla ${U.regla}): ${U.wE ? (U.resta ? `${U.wE} W/m² en ${U.lblE.toLowerCase()} y ${U.w} W/m² en el resto` : `${U.w} W/m² en todo el edificio más ${U.wE} W/m² en ${U.lblE.toLowerCase()}`) : `${U.w} W/m²`}, más las cargas especiales a su potencia nominal; a toda esa carga se aplica ${U.f1} % hasta 900 m² y, en edificaciones mayores, ${U.f1} % a los primeros 900 m² y ${U.f2} % al exceso.` +
        comun
      : `${U.n}: ${U.w} W/m² con factor de demanda del ${U.fd.map(([l, , f]) => `${f} %${l < Infinity ? ` en los primeros ${l} m²` : U.fd.length > 1 ? " en el exceso" : ""}`).join(" y ")} (Tabla 14), más las cargas especiales a su potencia nominal.` +
        comun;
  // Área especial (aulas o alta intensidad): solo en escuelas y hospitales
  $("aEBox").hidden = !U?.wE;
  if (U?.wE) $("aELbl").textContent = `${U.lblE} (m²)`;
  $("vivLeg").innerHTML = viv
    ? "Vivienda <small>050-110 · 050-200</small>"
    : `Edificación <small>${U.regla ? U.regla : "050-210 · Tabla 14"}</small>`;
  if (typeof renderList === "function" && pisos.length) renderList("pisos");
}
