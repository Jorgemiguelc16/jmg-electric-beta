/* DISEÑO AVANZADO · DATOS DEL DISEÑO PARA EL CÁLCULO
   Ventana «Datos para el cálculo» (planoCalc, js/calculo/calculo-plano.js) y escribir el cálculo en el plano.
   Antes era parte de js/diseno-avanzado.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Datos del diseño para el cálculo (planoCalc, js/calculo/calculo-plano.js) ---------- */
const DC_VW = ventanaMovil(document.querySelector("#dcDlg .vw"), "jmg-electric-datos-calculo", {
  w: 1000,
  h: 600,
  minW: 520,
  minH: 320
});
// Qué hacer con cada aviso
const DC_AYUDA = {
  pot: "Escriba su potencia en Propiedades (o la de su tipo de luminaria).",
  ruta: "Únalas con tuberías desde la salida del tablero: la longitud se mide por el recorrido.",
  tipo: "Doble clic en el tablero y elija el tipo de cada circuito.",
  nom: "Los tableros del plano se llaman como en el cálculo: TG, TD-1, TD-2… Cámbiele el nombre (doble clic en el tablero) o agregue su piso en Vivienda › Pisos y tableros.",
  ali: "Dibuje una tubería desde el medidor hasta el TG (clic en el TG › Alimentador).",
  sis: "Elija el sistema del tablero (doble clic) o cambie el suministro del proyecto.",
  area: "Encuadre la planta que contiene el área, o márquela dentro de ella."
};
// Nombres de los tableros del cálculo (vivienda y otros usos): TG y, con pisos, el TD de cada uno
function dcNomsCalc() {
  if (MODE === "multi") return ["TG", "TSG", ...tipos.map(t => "TD-" + (t.nombre || "").replace(/^Tipo\s*/i, ""))];
  const td = pisos.length && PROY.esqPisos === "td";
  return ["TG", ...(td ? ["TD-1"] : []), ...pisos.map((_, i) => tabPiso(i + 2))];
}
// Datos del diseño que está en el editor (con los cambios aún sin aplicar)
function dcDatos() {
  const c = ctx(estado()),
    n = k => parseFloat(PROY[k]) || 0,
    R = planoCalc({ f: EPL.f, plantas: EPL.plantas, dis: dsD() }, c, {
      al_p: n("al_p"),
      tg_p: n("tg_p"),
      tc_p: n("tc_p"),
      hEnt: n("hEnt") || 3.1,
      ...(MODE === "multi" ? { nTipos: tipos.length, tipo0: (tipos[0] || {}).nombre } : {})
    }),
    noms = dcNomsCalc();
  // En el edificio, los tableros de departamento se reconocen por su tipo (ventana Tablero), no por el nombre
  if (R && MODE === "uni") {
    // Nombre que le corresponde: el primero del cálculo que ningún tablero del plano usa (botón «Renombrar»)
    const usados = new Set(R.tabs.map(t => t.nom)),
      libres = noms.filter(n => !usados.has(n));
    R.tabs
      .filter(t => t.circs.length && !noms.includes(t.nom))
      .forEach(t =>
        R.avisos.push({
          t: "aviso",
          m: `El tablero ${t.nom} no está en el cálculo (${noms.join(", ")}): sus ${t.circs.reduce((s, q) => s + q.n, 0)} salidas no se calculan`,
          ids: [t.id],
          k: "nom",
          ...(libres.length ? { ren: libres.shift() } : {})
        })
      );
  }
  return { R, noms, c };
}
/* Revisión cruzada: cada dato del cálculo, si sale del plano (verde) o de lo escrito (gris), para que se vea de
   un vistazo qué falta dibujar */
function dcCruce(R, noms) {
  const filas = [],
    f = (dato, pl, txt) => filas.push([dato, pl, txt]),
    m2 = v => `${fmt(v, 2)} m²`,
    m = v => `${fmt(v, 2)} m`,
    con = new Map(R.tabs.filter(t => t.circs.length).map(t => [t.nom, t]));
  if (MODE === "multi") {
    f(
      "Alimentador general (medidor de la concesionaria → TG)",
      !!R.rutas.TG,
      R.rutas.TG ? m(R.rutas.TG.L) : `escrito: ${PROY.Lgen || "—"} m`
    );
    // Tramo TG → banco de medidores: solo cuenta si el banco no está junto al TG (Edificio)
    if (PROY.bmJunto === "0")
      f(
        "Alimentador TG → banco de medidores",
        !!R.rutas.BM,
        R.rutas.BM ? m(R.rutas.BM.L) : `escrito: ${PROY.Lbm || "—"} m`
      );
    else if (R.rutas.BM)
      f(
        "Tramo TG → banco de medidores",
        false,
        `${m(R.rutas.BM.L)} en el plano; no se calcula: el banco está «junto al TG» (Proyecto › Suministro)`
      );
    if (serv.length || con.has("TSG"))
      f(
        "Tablero de servicios generales TSG",
        con.has("TSG"),
        con.has("TSG") ? `${con.get("TSG").circs.length} circuitos del plano` : "servicios escritos"
      );
    tipos.forEach((t, i) => {
      const tb = R.tabs.filter(x => x.dep === i && x.circs.length),
        a = R.areaDep[i],
        dm = tb.map(x => R.desdeMed[x.id]).filter(Boolean);
      f(
        `${t.nombre || "Tipo"}: número de unidades`,
        !(t.cant > 0) && tb.length > 0,
        t.cant > 0
          ? `escrito: ${t.cant}`
          : tb.length
            ? `${tb.length} tablero${tb.length > 1 ? "s" : ""} en el plano`
            : "—"
      );
      f(`${t.nombre || "Tipo"}: área`, !!(a && a.m2), a && a.m2 ? m2(a.m2) : `escrita: ${t.area || "—"} m²`);
      f(
        `${t.nombre || "Tipo"}: circuitos`,
        tb.length > 0,
        tb.length ? `del tablero ${tb[0].nom}${tb.length > 1 ? ` (${tb.length} tableros)` : ""}` : "escritos"
      );
      f(
        `${t.nombre || "Tipo"}: alimentador desde el banco`,
        dm.length > 0,
        dm.length ? m(Math.max(...dm.map(r => r.L))) : `escrito: ${t.Ld || "—"} m`
      );
    });
  } else {
    const viv = usoAct() === "viv";
    [1, ...pisos.map((p, i) => i + 2)].forEach(n => {
      const o = R.pisos[n],
        v = o ? (viv ? o.tech : o.ext || o.tech) : 0,
        esc0 = n === 1 ? PROY.area : pisos[n - 2].area;
      f(`Área del ${ORD(n)} piso`, v > 0, v > 0 ? m2(v) : `escrita: ${esc0 || "—"} m²`);
    });
    const so = R.pisos[0];
    if (so || +PROY.sot)
      f("Área del sótano", !!(so && so.sot), so && so.sot ? m2(so.sot) : `escrita: ${PROY.sot || 0} m²`);
    f("Alimentador medidor → TG", !!R.rutas.TG, R.rutas.TG ? m(R.rutas.TG.L) : `escrito: ${PROY.Lalim || "—"} m`);
    noms.forEach(n =>
      f(
        `Tablero ${n}: circuitos y salidas`,
        con.has(n),
        con.has(n) ? `${con.get(n).circs.length} circuitos del plano` : "escritos (Salidas)"
      )
    );
    if (noms.length > 1)
      noms
        .filter(n => n !== "TG")
        .forEach(n => f(`Alimentador TG → ${n}`, !!R.rutas[n], R.rutas[n] ? m(R.rutas[n].L) : "escrito"));
    const ce = R.cargas.filter(x => noms.includes(x.tab));
    f("Cargas especiales", ce.length > 0, ce.length ? `${ce.length} del plano` : `escritas: ${cargas.length}`);
  }
  f(
    "Conductor de tierra (TG → pozo)",
    !!R.rutas.PAT,
    R.rutas.PAT ? m(R.rutas.PAT.L) : `escrito: ${PROY.pzCond || "—"} m`
  );
  const np = filas.filter(x => x[1]).length;
  return (
    `<h4>Qué toma el cálculo del plano<small>${np} de ${filas.length} datos del plano · los grises se dibujan o se escriben</small></h4><table class="dc-t dc-cruce"><tbody>` +
    filas
      .map(
        ([d, pl, t]) =>
          `<tr><td><i class="dc-dot${pl ? " ok" : ""}"></i>${esc(d)}</td><td>${pl ? "del plano" : "escrito"}</td><td class="n">${esc(t)}</td></tr>`
      )
      .join("") +
    "</tbody></table>"
  );
}
// Avisos para la revisión del diseño (solo si el diseño tiene tableros con circuitos)
function dcAvisos() {
  if (!EPL || !dsD() || !dsD().els.some(e => (e.k === "tab" && e.nc) || e.ar)) return [];
  return dcDatos().R.avisos;
}
function dcAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("dcDlg").hidden = false;
  vwFondo();
  DC_VW.abrir();
  dcRender();
}
function dcCerrar() {
  $("dcDlg").hidden = true;
  vwFondo();
}
let DC_AV = [];
function dcRender() {
  if ($("dcDlg").hidden) return;
  const { R, noms } = dcDatos(),
    usa = PROY.calPlano === "1",
    sucio = edSnap() !== ED.base,
    // ΔV del último cálculo (solo si el cálculo ya usa este diseño)
    L = usa && !sucio && LAST && LAST.plano ? LAST : null,
    m = v => fmt(v, 2),
    ver = (ids, t = "Ver") =>
      ids && ids.length ? `<button type="button" class="vw-btn" data-dcv="${ids.join(",")}">${t}</button>` : "";
  $("dcUsar").value = usa ? "1" : "";
  $("dcEst").innerHTML = !usa
    ? "El cálculo usa los datos escritos: elija «Sí» para calcular con este diseño."
    : sucio
      ? `El cálculo usa el diseño aplicado: <button type="button" class="linkbtn" data-dc="aplicar">aplique los cambios</button> para actualizarlo.`
      : "El cálculo usa este diseño.";
  let h = "";
  const tabs = R ? R.tabs : [];
  if (R) h += dcCruce(R, noms);
  if (!tabs.length)
    h +=
      '<p class="rev-ok">El diseño aún no tiene tableros. Ponga el tablero (Biblioteca › Tableros y medición), defina sus circuitos con doble clic y saque las tuberías desde sus salidas.</p>';
  tabs.forEach(tb => {
    const dep = MODE === "multi" && Number.isInteger(tb.dep) ? tipos[tb.dep] : null,
      en = dep || noms.includes(tb.nom),
      dm = R.desdeMed[tb.id];
    h += `<h4>${esc(tb.nom)}${tb.fs ? ` <small>${tb.fs === 3 ? "trifásico" : "monofásico"}</small>` : ""}<small class="${en ? "" : "bad"}">${dep ? `departamento ${esc(dep.nombre || "")}${tb.depAuto ? " (el único tipo)" : ""}` : en ? "en el cálculo" : MODE === "multi" ? "elija su tipo de departamento con doble clic" : `no está en el cálculo (${noms.join(", ")})`}</small>${dm && tb.nom !== "TG" ? `<small>desde el medidor: ${m(dm.L)} m</small>` : ""} ${ver([tb.id])}</h4>`;
    if (!tb.circs.length) {
      h += '<p class="dc-nota">Sin circuitos con carga: defina sus circuitos con doble clic y conecte las salidas.</p>';
      return;
    }
    h +=
      `<table class="dc-t"><thead><tr><th>Circuito</th><th>Tipo</th><th>Salidas</th><th>Carga conectada</th><th>Hasta la salida más alejada</th><th>Agrupados</th>${L ? "<th>ΔV total</th>" : ""}</tr></thead><tbody>` +
      tb.circs
        .map(q => {
          const qq = L && L.circ.find(x => x.src && x.src.t === "plano" && x.src.tab === tb.id && x.src.cir === q.cir),
            pd = q.sal.filter(o => o.de === "Parámetros").length,
            tp = [...new Set(q.sal.filter(o => o.de.startsWith("tipo")).map(o => o.de.slice(5)))];
          return `<tr><td><b>${q.cir}</b>${q.desc ? `<small>${esc(q.desc)}</small>` : ""}</td><td>${PL_TCIR[q.tipo]}${q.auto ? "<small>automático</small>" : ""}</td><td class="n"><button type="button" class="linkbtn" data-dcv="${q.sal.map(o => o.id).join(",")}" title="Elige y muestra sus salidas">${q.n}</button></td><td class="n">${fmt(q.P, 0)} W<small>${[pd ? `${pd} con la de Parámetros` : "", tp.length ? `tipo ${tp.join(", ")}` : ""].filter(Boolean).join(" · ")}</small></td><td class="n${q.est ? " bad" : ""}">${q.lej ? `<button type="button" class="linkbtn" data-dcv="${q.lej}" title="Ver la salida más alejada">${m(q.L)} m</button>` : `${m(q.L)} m`}<small>${q.est ? "estimada: hay salidas sin tubería" : `${m(q.Lh)} tubería + ${m(q.Lv)} vertical`}</small></td><td class="n">${q.ng}<small>Tabla 5C: ${fmt(fa5C(q.ng), 2)}</small></td>${L ? `<td class="n ${qq && qq.ok ? "ok" : "bad"}">${qq ? m(qq.dVt) + " %" : "—"}</td>` : ""}</tr>`;
        })
        .join("") +
      "</tbody></table>";
  });
  // Alimentadores
  if (tabs.length) {
    const ali = R.rutas,
      fila = (n, r, alt) =>
        `<tr><td>${n}</td><td class="n">${r ? `${m(r.L)} m<small>${m(r.Lh)} tubería + ${m(r.L - r.Lh)} vertical</small>` : "—"}</td><td>${r ? "del plano" : esc(alt)}</td></tr>`;
    h +=
      `<h4>Alimentadores<small>tuberías marcadas como alimentador, por los montantes</small></h4><table class="dc-t"><thead><tr><th>Tramo</th><th>Longitud</th><th>Origen</th></tr></thead><tbody>` +
      fila(
        MODE === "multi" ? "Medidor o banco → TG (general)" : "Medidor → TG",
        ali.TG,
        `sin tubería del medidor al TG: se usa la escrita (${(MODE === "multi" ? PROY.Lgen : PROY.Lalim) || "—"} m)`
      ) +
      noms
        .filter(n => n !== "TG")
        .map(n => fila(`TG → ${n}`, ali[n], "sin recorrido en el plano: se usa la escrita en Pisos y tableros"))
        .join("") +
      "</tbody></table>";
  }
  // Áreas por piso
  if (R && R.areas.length) {
    const viv = usoAct() === "viv",
      P = Object.keys(R.pisos)
        .map(Number)
        .sort((a, b) => a - b),
      cel = v => (v ? `${fmt(v, 2)} m²` : "—");
    h +=
      `<h4>Áreas<small>${viv ? "vivienda: techadas por dimensiones interiores (Regla 050-110)" : "otros usos: contorno exterior (Regla 050-210)"}</small> ${ver(
        R.areas.map(a => a.id),
        "Ver todas"
      )}</h4><table class="dc-t"><thead><tr><th>Piso</th><th>Techada (interior)</th><th>Contorno exterior</th><th>Aulas o alta intensidad</th><th>Libre no techada</th><th>Para el cálculo</th></tr></thead><tbody>` +
      P.map(n => {
        const o = R.pisos[n],
          usa = n === 0 ? o.sot * 0.75 : viv ? o.tech : o.ext || o.tech;
        return `<tr><td>${dpNomPiso(n)}</td><td class="n">${cel(n === 0 ? o.sot : o.tech)}</td><td class="n">${cel(o.ext)}</td><td class="n">${cel(o.aulas)}</td><td class="n">${cel(o.libre)}</td><td class="n"><b>${n === 0 ? (viv ? `${fmt(o.sot, 2)} × 75 %` : cel(o.sot)) : cel(usa)}</b>${!viv && n > 0 && !o.ext && o.tech ? '<small class="bad">falta el contorno exterior</small>' : ""}</td></tr>`;
      }).join("") +
      "</tbody></table>";
    // Pisos del plano que el cálculo aún no tiene
    const max = Math.max(...P),
      faltan = max - 1 - pisos.length;
    if (faltan > 0 && MODE === "uni")
      h += `<p class="dc-nota">El plano tiene áreas hasta el ${dpNomPiso(max)}; el cálculo tiene ${pisos.length + 1} piso${pisos.length ? "s" : ""}. <button type="button" class="linkbtn" data-dc="pisos">Agregar ${faltan} piso${faltan > 1 ? "s" : ""} al cálculo</button></p>`;
  }
  // Cargas especiales
  if (R && R.cargas.length)
    h +=
      `<h4>Cargas especiales<small>para la máxima demanda (Regla 050-200) y su circuito</small></h4><table class="dc-t"><thead><tr><th>Descripción</th><th>Tipo de carga</th><th>Potencia</th><th>Fases</th><th>Circuito</th><th></th></tr></thead><tbody>` +
      R.cargas
        .map(
          x =>
            `<tr><td>${esc(x.nombre)}</td><td>${esc(TIPOS[x.tipo])}</td><td class="n">${fmt(x.p, 0)} W</td><td>${x.fases === 3 ? "Trifásica" : "Monofásica"}${x.elec ? "<small>con electrónica</small>" : ""}</td><td>${esc(x.tab)} ${x.cir}</td><td>${ver([x.id])}</td></tr>`
        )
        .join("") +
      "</tbody></table>";
  // Avisos
  DC_AV = R ? R.avisos : [];
  if (DC_AV.length)
    h +=
      `<h4>Avisos<small>${DC_AV.length}</small></h4>` +
      DC_AV.map(
        (a, i) =>
          `<div class="rev-it ${a.t === "error" ? "aviso" : "info"}"><i>${a.t === "info" ? "ℹ" : "⚠"}</i><span>${esc(a.m)}<small>${esc(DC_AYUDA[a.k] || "")}</small></span><span class="pla-b"><button type="button" class="vw-btn" data-dca="${i}">Ver</button></span></div>`
      ).join("");
  h += `<p class="dc-nota"><b>Cómo se mide (criterio de la plataforma):</b> el recorrido es el camino más corto por las tuberías del circuito, desde el tablero hasta cada salida, con las derivaciones. Se suman los tramos verticales: la tubería por el techo va a la altura del techo (${m(+PROY.hTecho || 2.9)} m) y la del piso a 0 m; en cada artefacto se sube o se baja hasta su altura de montaje (la suya o la de Parámetros › Alturas) y en el tablero desde su borde superior; la tubería por la pared va a la altura del artefacto donde empieza. Cada montante suma la altura de entrepiso (${m(+PROY.hEnt || 3.1)} m) por piso. La potencia de cada salida es la suya o, si no tiene, la de su tipo de luminaria o la de Parámetros (W por salida). La caída de tensión se calcula con la carga conectada del circuito hasta la salida más alejada (Regla 050-102); la sección es la menor que cumple la capacidad y esa caída. Agrupamiento: cada circuito usa el factor de la Tabla 5C (ítem 1) según el mayor número de circuitos que van juntos en alguna de sus tuberías (entre dos columnas de la tabla, la del número mayor). Áreas: en vivienda se suman las techadas por dimensiones interiores (Regla 050-110) y el sótano al 75 %; en otros usos, el contorno exterior (Regla 050-210); el piso de cada área es el de su planta. Los tableros y pisos que no están dibujados se calculan con los datos escritos.</p>`;
  if (L)
    h += `<p class="dc-nota"><button type="button" class="vw-btn" data-dc="escribir">Escribir en el plano los conductores y diámetros del cálculo</button> Pone en cada tubería sus conductores (fases, neutros y tierra), sus secciones y el diámetro de la tubería según todos los circuitos que lleva (40 % de ocupación). En el tramo que comparten varios alimentadores (del banco a una caja de paso, un montante), los de todos ellos, cada uno con su conductor de protección (criterio del proyectista). En las tuberías de los interruptores, sus retornos (criterio: unipolar 2, doble o de tres vías 3, de cuatro vías 4 conductores, sin tierra).</p>`;
  $("dcC").innerHTML = h;
}
/* Conductores de la tubería de un interruptor (retornos; criterio de la plataforma, editable en la tubería): el
   unipolar lleva la fase y su retorno (2), el bipolar o doble la fase y dos retornos (3), el de tres vías tres
   conductores (3) y el de cuatro vías cuatro (4); sin conductor de protección */
const DC_RET = {
  int2: 3,
  int2G: 3,
  int2PE: 3,
  int3: 3,
  int3PA: 3,
  conm: 3,
  int2v: 3,
  int4: 4,
  conmInt: 4
};
/* Conductores y diámetro de cada tubería según el último cálculo con el diseño: suma los de todos los circuitos que
   lleva; en monofásico 220 V los dos conductores son fases, con 380/220 V fase y neutro; una tierra, la mayor */
function dcEscribir() {
  if (!LAST || !LAST.plano) return toast("Primero calcule con el diseño");
  const D = dsD(),
    por = new Map(D.els.map(e => [e.id, e])),
    Q = new Map(LAST.circ.filter(q => q.src && q.src.t === "plano").map(q => [q.src.tab + "|" + q.id, q])),
    n380 = LAST.sk === "tri380",
    tri = dsCirTri(D),
    red = dsRedCond(D, tri),
    AL = dcAlimentadores();
  let n = 0,
    ret = 0,
    comp = 0;
  D.els.forEach(t => {
    // Alimentadores y conductor de tierra: los del cálculo, según el tablero o el pozo al que llegan
    const fin = [t.c0, t.c1].map(id => por.get(id)).filter(Boolean),
      pozo = fin.some(s => s.k === "pat"),
      tbF = fin.find(s => s.k === "tab");
    if (
      t.t === "tub" &&
      !t.cir &&
      (pozo || tbF) &&
      fin.some(s => s.k === "pat" || PL_MED.has(s.k) || s.k === "tab") &&
      (t.ali || pozo || fin.some(s => PL_MED.has(s.k)))
    ) {
      if (pozo) {
        const S = LAST.Selec;
        t.cond = { f: 0, n: 0, t: true };
        delete t.condA;
        t.sec = `1×${S} mm² (tierra)`;
        n++;
        return;
      }
      // Edificio con el banco lejos del TG: la tubería entre el TG y el banco es la del alimentador TG → banco
      const aBM =
          LAST.mode === "multi" && (tbF.nom || "TG") === "TG" && fin.some(s => s.k === "bmed")
            ? LAST.alims.find(x => x.pKey === "bm")
            : null,
        a = aBM || dcAliDe(tbF);
      // Banco junto al TG: la tubería del TG al banco lleva las fases y neutros de todos los suministros
      if (!aBM && LAST.tgbm && LAST.mode === "multi" && (tbF.nom || "TG") === "TG" && fin.some(s => s.k === "bmed")) {
        const g = LAST.tgbm;
        t.cond = { f: Math.min(12, g.nf), n: Math.min(6, g.nn), t: false };
        delete t.condA;
        if (g.tubos[0].mm && DS_DIAS.includes(g.tubos[0].mm)) t.dia = g.tubos[0].mm;
        t.sec = `${g.n} conductores (${g.tubos.length > 1 ? g.tubos.length + " tuberías" : "1 tubería"}; ver resultados)`;
        n++;
        return;
      }
      if (!a) return;
      dcEscribirAli(t, [a]);
      n++;
      return;
    }
    /* Tramo de alimentadores que no llega a un tablero (del banco a una caja de paso, el montante, de una caja a
       otra): los conductores de todos los alimentadores que pasan por él */
    if (t.t === "tub" && !t.cir && AL.length) {
      const pas = AL.filter(x => x.a && x.ids.has(t.id));
      if (pas.length) {
        dcEscribirAli(
          t,
          pas.map(x => x.a),
          pas.map(x => x.nom)
        );
        n++;
        if (pas.length > 1) comp++;
        return;
      }
    }
    if (t.t !== "tub" || t.ali || !t.cir || !t.tab) return;
    if (![t.cir, ...(t.cx || [])].some(c => Q.has(t.tab + "|" + c))) return;
    // Conductores por el recorrido del circuito (fase, retornos, neutro y tierra), cada uno con la sección de su circuito
    const { c, act } = dsCondTub(t, red, tri, n380, por);
    let St = 0,
      a = 0;
    const sec = new Map();
    act.forEach(({ cir, k }) => {
      const q = Q.get(t.tab + "|" + cir);
      if (!q || !k) return;
      if (c.t) St = Math.max(St, q.St);
      a += k * OD[q.S] ** 2;
      // Conductores de la misma sección, juntos: «4-1×2.5»
      sec.set(q.S, (sec.get(q.S) || 0) + k);
    });
    if (!sec.size) return;
    a = ((a + (St ? OD[St] ** 2 : 0)) * Math.PI) / 4;
    const tb = TUBOS.find(([, , di]) => a <= (0.4 * Math.PI * di * di) / 4);
    if (!c.r) delete c.r;
    t.cond = c;
    delete t.condA;
    if (tb && DS_DIAS.includes(tb[0])) t.dia = tb[0];
    t.sec =
      `${[...sec].map(([S, k]) => `${k}-1×${S}`).join(" + ")}${St ? ` + 1×${St} T` : ""} mm²` +
      (c.r ? ` (${c.f + dsNeutros(c)} + ${c.r} retorno${c.r > 1 ? "s" : ""})` : "");
    if (c.r) ret++;
    else n++;
  });
  D.cirt = true;
  edCambio();
  toast(
    `Conductores y diámetros del cálculo en ${n + ret} tubería${n + ret === 1 ? "" : "s"}${ret ? ` (${ret} de interruptores, con sus retornos)` : ""}${comp ? `; ${comp} con varios alimentadores juntos` : ""}`
  );
}
$("dcDlg").addEventListener("click", e => {
  if (e.target.id === "dcDlg") return dcCerrar();
  const b = e.target.closest("[data-dc]"),
    v = e.target.closest("[data-dcv]"),
    a = e.target.closest("[data-dca]");
  if (b && b.dataset.dc === "cerrar") return dcCerrar();
  if (b && b.dataset.dc === "max") return DC_VW.maximizar();
  if (b && b.dataset.dc === "aplicar") {
    edAplicar();
    return dcRender();
  }
  if (b && b.dataset.dc === "escribir") {
    dcEscribir();
    return dcRender();
  }
  if (b && b.dataset.dc === "pisos") {
    // Se agregan con el mismo botón del formulario (el cálculo, el historial y las listas funcionan igual)
    const R = dcDatos().R,
      falta = Math.max(...Object.keys(R.pisos).map(Number)) - 1 - pisos.length;
    for (let i = 0; i < falta; i++) $("add_pisos").click();
    toast(
      `${falta} piso${falta > 1 ? "s" : ""} agregado${falta > 1 ? "s" : ""} al cálculo (Vivienda › Pisos y tableros)`
    );
    return dcRender();
  }
  if (v || a) {
    dcCerrar();
    dsVerIds(v ? v.dataset.dcv.split(",") : DC_AV[+a.dataset.dca].ids);
  }
});
$("dcDlg").addEventListener("change", e => {
  if (e.target.id !== "dcUsar") return;
  // Se escribe en el dato del proyecto como si se eligiera allí: el cálculo y el historial lo toman
  const s = $("calPlano");
  s.value = e.target.value;
  s.dispatchEvent(new Event("input", { bubbles: true }));
  s.dispatchEvent(new Event("change", { bubbles: true }));
  toast(
    e.target.value ? "El proyecto se calcula con el diseño del plano" : "El proyecto se calcula con los datos escritos"
  );
  setTimeout(dcRender, 50);
});
$("dcDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    dcCerrar();
  }
  e.stopPropagation();
});

/* ---------- Alimentadores que pasan por las cajas de paso y los montantes ----------
   Con el recorrido de cada alimentador (planoCalc: ids de rutas y desdeMed), qué alimentadores pasan por cada caja
   de paso o montante, sus conductores del cálculo, el número de cada caja (CP-1, CP-2…) y el rótulo automático
   («Sube por muro para TD-02, TD-03 y TD-04»). El número, el rótulo y el conductor de protección de cada
   alimentador en el tramo compartido son criterio del proyectista. */
// Alimentador del cálculo (LAST.alims) que llega a un tablero del plano
function dcAliDe(tbF) {
  if (!LAST || !LAST.alims) return null;
  const nom = tbF.nom || "TG";
  return (
    LAST.alims.find(x =>
      tbF.dep != null && LAST.mode === "multi"
        ? x.pKey === "tipo" && LAST.T[x.ti] && LAST.T[x.ti]._i === tbF.dep
        : nom === "TG"
          ? x === LAST.alims[0]
          : x.desc.endsWith("→ " + nom) || x.desc.includes("→ " + nom + " ") || (nom === "TSG" && x.pKey === "servP")
    ) || null
  );
}
// Conductores de un alimentador: «2-1×10 + 1×10 T mm²»
const dcTxtAli = a => `${a.s.n}-1×${a.S} + 1×${a.St} T mm²`;
/* Alimentadores del plano: cada tablero con el recorrido de su alimentador (ids de tuberías y artefactos), el
   medidor del banco del que sale (M-1, M-2…) y sus conductores del cálculo (si se calculó con el diseño). El
   recorrido es desde su medidor del banco si lo tiene; si no, desde el TG. */
function dcAlimentadores(R) {
  if (R === undefined) R = dcDatos().R;
  if (!R) return [];
  const D = dsD(),
    meds = D.els.filter(e => e.k === "bmed").flatMap(b => dsMedidoresBanco(b)),
    conPlano = !!(LAST && LAST.plano);
  return D.els
    .filter(e => e.k === "tab")
    .map(tb => {
      const nom = tb.nom || "TG",
        ms = meds.filter(m => m.tab && m.tab === nom),
        desdeBanco = ms.length > 0 || (MODE === "multi" && tb.dep != null),
        r =
          nom === "TG"
            ? R.rutas.TG
            : desdeBanco
              ? R.desdeMed[tb.id] || R.rutas[nom]
              : R.rutas[nom] || R.desdeMed[tb.id];
      if (!r || !r.ids) return null;
      return {
        tb,
        nom,
        med: ms.length === 1 ? ms[0].n : "",
        ids: new Set(r.ids),
        a: conPlano ? dcAliDe(tb) : null
      };
    })
    .filter(Boolean);
}
// Conductores de uno o varios alimentadores en una tubería, y su diámetro (40 % de ocupación, como los circuitos)
function dcEscribirAli(t, A, noms) {
  if (A.length === 1) {
    const a = A[0],
      fa = a.s.tri ? 3 : 2;
    t.cond = { f: fa, n: Math.max(0, a.s.n - fa), t: true };
    delete t.condA;
    if (a.tubo && DS_DIAS.includes(a.tubo.mm)) t.dia = a.tubo.mm;
    t.sec = `${dcTxtAli(a)} (alimentador${noms ? " " + noms[0] : ""})`;
    return;
  }
  let F = 0,
    N = 0,
    area = 0;
  const grupos = new Map();
  A.forEach(a => {
    const fa = a.s.tri ? 3 : 2;
    F += fa;
    N += Math.max(0, a.s.n - fa);
    area += a.s.n * (OD[a.S] || 0) ** 2 + (OD[a.St] || 0) ** 2;
    const k = `${a.s.n}-1×${a.S} + 1×${a.St} T`;
    grupos.set(k, (grupos.get(k) || 0) + 1);
  });
  area = (area * Math.PI) / 4;
  const tb = TUBOS.find(([, , di]) => area <= (0.4 * Math.PI * di * di) / 4);
  t.cond = { f: Math.min(12, F), n: Math.min(6, N), t: true };
  delete t.condA;
  if (tb && DS_DIAS.includes(tb[0])) t.dia = tb[0];
  const sec = [...grupos].map(([k, c]) => (c > 1 ? `${c}×(${k})` : k)).join(" + ") + " mm²",
    a = ` (alimentadores ${noms.join(", ")})`;
  t.sec = (sec + (sec.length + a.length <= 160 ? a : "")).slice(0, 160);
}
// Alimentadores que pasan por un elemento (caja de paso o canalización vertical)
const dcAliPor = (el, AL) => AL.filter(x => x.ids.has(el.id));
// «TD-02, TD-03 y TD-04»
const dcLista = l => (l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " y " + l[l.length - 1]);
/* Texto del rótulo de una caja o un montante: hacia dónde va cada alimentador que pasa. Con montante: sube a los
   tableros de los pisos de arriba, baja a los de abajo y llega a los de su piso; sin él, pasa. */
function dcRotuloTexto(el, AL) {
  const pas = dcAliPor(el, AL);
  if (!pas.length) return "";
  const D = dsD(),
    por = new Map(D.els.map(e => [e.id, e])),
    cad = plMontanteTodo(el, por),
    nom = l => dcLista(l.map(x => x.nom)),
    piso = e => {
      const i = dpPlantaEl(e);
      return i >= 0 ? dpPisoDe(i) : null;
    },
    p0 = piso(el),
    G = { sube: [], baja: [], llega: [], pasa: [] };
  pas.forEach(x => {
    const p = piso(x.tb);
    if (!cad.some(id => x.ids.has(id)) || p0 === null || p === null) G.pasa.push(x);
    else G[p > p0 ? "sube" : p < p0 ? "baja" : "llega"].push(x);
  });
  return [
    G.sube.length && `Sube por muro para ${nom(G.sube)}`,
    G.baja.length && `Baja por muro para ${nom(G.baja)}`,
    G.llega.length && `Llega para ${nom(G.llega)}`,
    G.pasa.length && `${G.pasa.length > 1 ? "Pasan los alimentadores" : "Pasa el alimentador"} de ${nom(G.pasa)}`
  ]
    .filter(Boolean)
    .join(" · ");
}
// Rótulos automáticos (aut: el elemento que rotulan): su texto sigue a los alimentadores que pasan
function dcRotulosAuto() {
  const D = dsD(),
    R = D.els.filter(e => e.aut && (e.t === "txt" || e.t === "dir"));
  if (!R.length) return;
  let AL;
  try {
    AL = dcAlimentadores();
  } catch (e) {
    return;
  }
  const por = new Map(D.els.map(e => [e.id, e]));
  R.forEach(t => {
    const el = por.get(t.aut);
    // Sin la caja o el montante que rotulaba: queda como texto propio
    if (!el) return delete t.aut;
    const s = dcRotuloTexto(el, AL);
    if (s) t.s = s.slice(0, t.t === "dir" ? 120 : 200);
  });
}
// Rótulo de la caja o el montante elegido: una directriz desde él (o se elige la que ya tiene)
function dcPonerRotulo() {
  const el = dsSel()[0];
  if (!el) return;
  const D = dsD(),
    ya = D.els.find(e => e.aut === el.id);
  if (ya) {
    DS_SEL.clear();
    DS_SEL.add(ya.id);
    edProps();
    plMostrar();
    return toast("Esta caja ya tiene su rótulo: quedó elegido");
  }
  const s = dcRotuloTexto(el, dcAlimentadores());
  if (!s)
    return toast(
      "Por aquí no pasa ningún alimentador: únalo con tuberías del banco de medidores (o del TG) hasta los tableros"
    );
  const capa = dsCapaPara("dir"),
    d = 1.2 / EPL.f;
  dsCapa(capa);
  const r = dsAgregar({
    t: "dir",
    pts: [el.x, el.y, el.x + d, el.y + d],
    s: s.slice(0, 120),
    ht: dsMm(2.5),
    capa,
    aut: el.id
  });
  DS_SEL.clear();
  DS_SEL.add(r.id);
  edCambio();
  edProps();
  toast("Rótulo puesto: se actualiza solo con los tableros a los que va. Si cambia su texto, deja de actualizarse");
}
// Cajas de paso numeradas (CP-1, CP-2…): la nueva o la copiada toma el número siguiente (criterio del proyectista)
function dsNombrarCajas() {
  const cj = dsD().els.filter(e => e.t === "sim" && DS_CAJAS.has(e.k));
  if (!cj.length) return;
  const num = n => +(/^CP-(\d+)$/.exec(n || "") || [])[1] || 0,
    ya = new Set();
  let max = Math.max(0, ...cj.map(e => num(e.nom)));
  cj.forEach(e => {
    if (!e.nom || ya.has(e.nom)) e.nom = "CP-" + ++max;
    ya.add(e.nom);
  });
}
// Propiedades de una caja de paso o una canalización vertical: su número y los alimentadores que pasan
function dsPropsPaso(el, campo) {
  let AL = [];
  try {
    AL = dcAlimentadores();
  } catch (e) {
    AL = [];
  }
  const pas = dcAliPor(el, AL),
    conRot = dsD().els.some(e => e.aut === el.id);
  let h = DS_CAJAS.has(el.k)
    ? campo("Número", `<input type="text" data-dsp="nom" value="${esc(el.nom || "")}" maxlength="20">`)
    : "";
  h += `<div class="ed-pt">Alimentadores que pasan${pas.length ? ` (${pas.length})` : ""}</div>`;
  if (!pas.length) return h + dsPasosPaso(el);
  return (
    h +
    `<table class="ds-ali"><tbody>${pas
      .map(
        x =>
          `<tr><td>${x.med ? `${esc(x.med)} → ` : ""}<b>${esc(x.nom)}</b></td><td>${x.a ? esc(dcTxtAli(x.a)) : "—"}</td></tr>`
      )
      .join("")}</tbody></table>` +
    (pas.some(x => !x.a)
      ? `<p class="ds-ali-n">Los conductores salen del cálculo: calcule el proyecto con el diseño (Datos para el cálculo).</p>`
      : "") +
    `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="rotulo" title="Directriz con el texto «Sube por muro para…», que se actualiza sola">${
      conRot ? "Ver su rótulo" : "Poner rótulo en el plano"
    }</button></div>`
  );
}
/* Sin alimentadores que pasen: qué tiene y qué le falta a la caja o al montante, paso a paso (llega del banco o del
   TG, sube a otra planta, sale hacia un tablero) */
function dsPasosPaso(el) {
  const D = dsD(),
    por = new Map(D.els.map(e => [e.id, e])),
    cad = [el, ...plMontanteTodo(el, por).map(id => por.get(id))],
    tubs = e => D.els.filter(t => t.t === "tub" && (t.c0 === e.id || t.c1 === e.id)),
    otro = (t, e) => por.get(t.c0 === e.id ? t.c1 : t.c0),
    nomC = e => esc(e.nom || (DS_CAT[e.k] ? DS_CAT[e.k].n.toLowerCase() : "canalización")),
    planta = e => {
      const i = dpPlantaEl(e);
      return i >= 0 ? EPL.plantas[i].n : "fuera de las plantas";
    };
  // Llega: una tubería de la cadena viene del banco, de un medidor o de un tablero
  let llega = null;
  cad.forEach(e =>
    tubs(e).forEach(t => {
      const o = otro(t, e);
      if (!llega && o && (PL_MED.has(o.k) || o.k === "tab")) llega = { e, o };
    })
  );
  const ok = (b, txt) => `<li class="${b ? "si" : "no"}"><span>${b ? "✔" : "✘"}</span> ${txt}</li>`,
    filas = [
      llega
        ? ok(
            true,
            `Llega del ${llega.o.k === "tab" ? esc(llega.o.nom || "tablero") : "banco de medidores"} a ${nomC(llega.e)} (${esc(planta(llega.e))})`
          )
        : ok(false, "No llega ninguna tubería del banco de medidores ni del TG")
    ];
  if (cad.length > 1) filas.push(ok(true, `Montante: ${cad.map(e => `${nomC(e)} (${esc(planta(e))})`).join(" → ")}`));
  else
    filas.push(
      `<li class="op"><span>·</span> Sin montante: si sube a otro piso, clic derecho › Crear montante a otra planta…</li>`
    );
  // Sale hacia el tablero: una tubería de la cadena llega a otro tablero, pero sin ser alimentador
  const aTab = cad.find(e =>
    tubs(e).some(t => {
      const o = otro(t, e);
      return o && o.k === "tab" && (!llega || o !== llega.o);
    })
  );
  const ult = cad[cad.length - 1];
  filas.push(
    aTab
      ? ok(false, `La tubería de ${nomC(aTab)} al tablero no es alimentador: elíjala y márquela como Alimentador`)
      : ok(
          false,
          `Falta la tubería de ${nomC(ult)} (${esc(planta(ult))}) al tablero: dibújela desde el tablero con su opción Alimentador`
        )
  );
  return `<ul class="ds-pasos">${filas.join("")}</ul>`;
}
