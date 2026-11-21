/* DISEÑO ELÉCTRICO · PROPIEDADES Y RESUMEN
   Panel de propiedades de lo seleccionado y resumen del diseño en el panel izquierdo (un clic los selecciona).
   Antes era parte de js/diseno.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Propiedades de lo seleccionado ---------- */
// Altura de montaje por defecto: la de Parámetros › Alturas del proyecto (criterio del proyectista)
const dsAlturaDef = k => {
  const c = DS_CAT[k];
  return c && c.h ? parseFloat(PROY[c.h]) || null : null;
};
const dsPotDef = k => {
  const c = DS_CAT[k];
  return c && c.p ? parseFloat(PROY[c.p]) || null : null;
};
// Tipo de luminaria del catálogo del proyecto (L1, L2…)
const dsLumT = id => (id && dsD() && (dsD().lums || []).find(x => x.id === id)) || null;
// Potencia por defecto de un artefacto (sin la suya): la de su tipo de luminaria o la de Parámetros
const dsPotBase = el => {
  const t = dsLumT(el.lt);
  return t && t.w > 0 ? t.w : dsPotDef(el.k);
};
const dsPotEl = el => el.p ?? dsPotBase(el);
// Clase del artefacto para el cálculo (js/calculo/calculo-plano.js): alumbrado, tomacorriente, carga especial o sin carga
const dsClase = el => (el && el.t === "sim" ? plArt(el.k)[0] : "");
const DS_CTRL = {
  "": "—",
  sensor: "Sensor de presencia",
  foto: "Fotocelda",
  temp: "Temporizador",
  dimmer: "Atenuador"
};
const DS_EMER = { "": "Alumbrado normal", emer: "Alumbrado de emergencia", senal: "Señalización de salida" };
// Texto de un tipo de luminaria: «L1 · Panel LED · 18 W · sensor de presencia»
const dsLumTxt = t =>
  [
    t.id,
    t.n,
    t.w > 0 ? `${fmt(t.w, 0)} W` : "",
    t.ctrl ? DS_CTRL[t.ctrl].toLowerCase() : "",
    t.emer ? DS_EMER[t.emer].toLowerCase() : ""
  ]
    .filter(Boolean)
    .join(" · ");
/* Desplegable de circuito: las salidas de cada tablero del diseño (C-1, C-2… con su descripción), agrupadas por
   tablero. v/tb: circuito y tablero actuales; v === null: la selección tiene circuitos distintos. pl: la planta de
   lo elegido; si tiene tableros, solo los suyos (y el del circuito actual), no los de los otros pisos. */
function dsCircSelect(D, v, tb, pl = -1) {
  const todos = D.els.filter(e => e.k === "tab" && e.nc > 0),
    dePl = pl >= 0 ? todos.filter(t => dpPlantaEl(t) === pl) : [],
    tabs = dePl.length ? todos.filter(t => dePl.includes(t) || t.id === tb) : todos,
    actual = v ? `${tb || ""}|${v}` : "";
  let hay = v === null || !v;
  const grupos = tabs
    .map(t => {
      const ops = dsSalidasTab(t)
        .map(o => {
          const val = `${t.id}|${o.n}`;
          if (val === actual) hay = true;
          return `<option value="${val}"${val === actual ? " selected" : ""}>${esc(o.n)}${o.d ? " · " + esc(o.d) : ""}</option>`;
        })
        .join("");
      return `<optgroup label="${esc(t.nom || "Tablero")}">${ops}</optgroup>`;
    })
    .join("");
  const tbA = tb && D.els.find(e => e.id === tb);
  return (
    `<select data-dsp="cir" class="ds-cir">` +
    (v === null ? '<option value="~" selected>(varios)</option>' : "") +
    `<option value=""${v === "" || v === undefined ? " selected" : ""}>— Sin circuito —</option>` +
    // Un circuito escrito que ya no es una salida de su tablero (o sin tablero): se conserva para no perderlo
    (!hay
      ? `<option value="${esc(actual)}" selected>${esc(v)}${tbA ? " · " + esc(tbA.nom || "Tablero") : " (sin tablero)"}</option>`
      : "") +
    grupos +
    "</select>"
  );
}
/* Vista del banco en sus propiedades: un contador por medidor, en filas de hasta cinco, con su número, el tablero al
   que va y sus fases (solo en la ventana; en el plano el banco conserva su símbolo) */
function dsBancoPrev(M) {
  const cols = Math.min(5, M.length),
    filas = Math.ceil(M.length / 5),
    cw = 52,
    ch = 66,
    W = cols * cw + 12,
    H = filas * ch + 26,
    o = [`<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="3" class="bp-caja"/>`];
  M.forEach((m, i) => {
    const x = 6 + (i % 5) * cw,
      y = 6 + Math.floor(i / 5) * ch;
    o.push(
      `<rect x="${x + 4}" y="${y}" width="${cw - 8}" height="${ch - 8}" rx="2" class="bp-med${m.tri ? " tri" : ""}"/>`,
      `<rect x="${x + 10}" y="${y + 6}" width="${cw - 20}" height="12" class="bp-vis"/>`,
      `<text x="${x + cw / 2}" y="${y + 15}" class="bp-k">kWh</text>`,
      `<text x="${x + cw / 2}" y="${y + 33}" class="bp-n">${m.n}</text>`,
      `<text x="${x + cw / 2}" y="${y + 45}" class="bp-d">${esc((m.dep || "—").slice(0, 9))}</text>`,
      `<text x="${x + cw / 2}" y="${y + 55}" class="bp-f">${m.tri ? "3φ" : "1φ"}</text>`
    );
  });
  o.push(`<text x="${W / 2}" y="${H - 8}" class="bp-bm">BANCO DE MEDIDORES · ${M.length}</text>`);
  return `<div class="ds-prev ds-bprev"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Banco de medidores con ${M.length} medidores">${o.join("")}</svg></div>`;
}
// Propiedades del banco de medidores: la lista numerada de sus medidores y si se escribe en el plano
function dsPropsBanco(el, campo) {
  const auto = dsMedidoresAuto(),
    // Edificio con departamentos: los medidores salen de ellos o se escriben aquí (a elección)
    modo =
      MODE === "multi" && auto.some(m => m.dep !== "TSG")
        ? campo(
            "Medidores",
            `<select data-dsp="mman" title="De dónde salen los medidores del banco"><option value="">Según los departamentos (${auto.length})</option><option value="1"${el.mman ? " selected" : ""}>Escritos aquí</option></select>`
          )
        : "";
  // Escritos aquí: cuántos, a qué tablero va cada uno y sus fases
  if (dsBancoManual(el, auto)) {
    const meds = el.meds || [],
      tabs = [
        ...new Set(
          dsD()
            .els.filter(e => e.k === "tab" && e.nom)
            .map(e => e.nom)
        )
      ];
    return (
      modo +
      campo(
        modo ? "Cantidad" : "Medidores",
        `<input type="number" data-dsp="bmn" value="${meds.length}" min="0" max="40" step="1" title="Cuántos medidores tiene el banco">`
      ) +
      (meds.length
        ? campo(
            "Lista en el plano",
            `<select data-dsp="num" title="Escribir también la lista numerada junto al banco en el plano"><option value="">No</option><option value="1"${el.num === true ? " selected" : ""}>Sí</option></select>`
          ) +
          `<table class="ds-bm"><thead><tr><th>Medidor</th><th>Va al tablero</th><th>Fases</th></tr></thead><tbody>${meds
            .map(
              (m, i) =>
                `<tr><td>M-${i + 1}</td><td><input type="text" data-dsp="bmd${i}" value="${esc(m.d || "")}" maxlength="20" list="dsBmTabs" placeholder="ej. TD-1" aria-label="Tablero del medidor M-${i + 1}"></td><td><select data-dsp="bmf${i}" aria-label="Fases del medidor M-${i + 1}"><option value="1">1φ</option><option value="3"${m.f === 3 ? " selected" : ""}>3φ</option></select></td></tr>`
            )
            .join(
              ""
            )}</tbody></table><datalist id="dsBmTabs">${tabs.map(t => `<option value="${esc(t)}">`).join("")}</datalist>`
        : "") +
      `<p class="ds-crit">Escriba cuántos medidores tiene el banco y a qué tablero va cada uno (M-1, M-2…): arriba se ven en el banco; en el plano el banco conserva su símbolo (con «Lista en el plano», también la lista).${MODE === "multi" ? (auto.length ? " Las láminas del banco y del tablero general siguen a los departamentos del proyecto." : " Si indica los departamentos de cada tipo (Proyecto › Departamentos), también pueden numerarse solos, uno por departamento.") : ""}</p>`
    );
  }
  const M = auto;
  return (
    modo +
    campo(
      "Lista en el plano",
      `<select data-dsp="num" title="Escribir también la lista numerada junto al banco en el plano"><option value="">No</option><option value="1"${el.num === true ? " selected" : ""}>Sí</option></select>`
    ) +
    `<table class="ds-bm"><thead><tr><th>Medidor</th><th>Suministro</th><th>Fases</th></tr></thead><tbody>${M.map(m => `<tr><td>${m.n}</td><td>${esc(m.dep === "TSG" ? "Servicios generales" : `Dpto. ${m.dep} · ${m.tab}`)}</td><td>${m.tri ? "3φ" : "1φ"}</td></tr>`).join("")}</tbody></table>` +
    `<p class="ds-crit">Uno por departamento (según los tipos y su número) y el de servicios generales si su medidor está en el banco (Proyecto › Suministro). La misma numeración de las láminas del banco y del tablero general.</p>`
  );
}
// Encabezado de una sección del panel de propiedades
const dsSec = t => `<div class="ed-ps">${t}</div>`;
function dsProps(c) {
  const sel = dsSel(),
    D = dsD();
  const fila = (k, v) => `<div class="ed-pf"><span>${k}</span><b>${v}</b></div>`,
    campo = (k, html) => `<label class="ed-pf ed-pc"><span>${k}</span>${html}</label>`,
    capas = v =>
      `<select data-dsp="capa">${v === "" ? '<option value="" selected>(varias)</option>' : ""}${D.capas.map(x => `<option${x.n === v ? " selected" : ""}>${esc(x.n)}</option>`).join("")}</select>`,
    // Circuito: desplegable con las salidas de todos los tableros, agrupadas por tablero (guarda circuito y tablero)
    plSel = (() => {
      const P = new Set(sel.map(dpPlantaEl));
      return P.size === 1 ? [...P][0] : -1;
    })(),
    circ = (v, tb) => dsCircSelect(D, v, tb, plSel),
    lista = "",
    acciones = `<div class="ed-pb ed-pacc"><button type="button" class="btn sec sm" data-dsa="girar">Girar ${DSU.giro || 90}°</button><button type="button" class="btn sec sm" data-dsa="copiar">Copiar</button><button type="button" class="btn sec sm ed-del" data-dsa="borrar">Borrar</button></div>`,
    curvas = `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="curvo" title="Todos los tramos en arco">Curvar</button><button type="button" class="btn sec sm" data-dsa="recto" title="Todos los tramos rectos">Enderezar</button><button type="button" class="btn sec sm" data-dsa="invertir" title="Los arcos al otro lado">Invertir curvas</button></div>`;
  if (sel.length > 1) {
    const cuenta = {};
    sel.forEach(el => (cuenta[dsTipo(el)] = (cuenta[dsTipo(el)] || 0) + 1));
    const capa0 = sel.every(el => el.capa === sel[0].capa) ? sel[0].capa : "",
      igualCir = sel.every(el => (el.cir || "") === (sel[0].cir || "") && (el.tab || "") === (sel[0].tab || "")),
      tubs = sel.filter(el => el.t === "tub");
    c.innerHTML =
      `<div class="ed-pt">${sel.length} elementos seleccionados</div>` +
      Object.entries(cuenta)
        .map(([t, n]) => fila(dsNomTipo(t), n))
        .join("") +
      (tubs.length ? fila("Tuberías", `${plFm(tubs.reduce((s, el) => s + dsLargo(el), 0))} m`) : "") +
      campo("Capa", capas(capa0)) +
      (sel.every(el => el.t === "sim" || el.t === "tub")
        ? campo("Circuito", igualCir ? circ(sel[0].cir, sel[0].tab) : circ(null)) + lista
        : "") +
      (tubs.length === sel.length ? dsCampoCond(campo, tubs) : "") +
      (sel.every(dsConEtq) ? dsCampoEtq(campo, sel) : "") +
      dsCamposVarios(campo, sel) +
      (sel.every(dsConEnc)
        ? campo(
            "Encendido",
            `<input type="text" data-dsp="enc" value="${sel.every(e => (e.enc || "") === (sel[0].enc || "")) ? esc(sel[0].enc || "") : ""}" placeholder="a, b…" maxlength="${sel.every(dsEsInt) ? 15 : 3}">`
          )
        : "") +
      (sel.some(el => el.t === "lin" || el.t === "tub") ? curvas : "") +
      acciones;
    return;
  }
  const el = sel[0],
    cap = dsCapaDe(el);
  let h = "";
  if (el.t === "sim") {
    const cat = DS_CAT[el.k],
      hd = dsAlturaDef(el.k),
      pd = dsPotBase(el),
      cl = dsClase(el),
      esp = PL_ESP[el.k] || ["otra", 1, "Carga especial"];
    const montaje =
      dsSec("Montaje") +
      (cat.h
        ? campo(
            "Altura",
            `<input type="number" data-dsp="h" value="${el.h ?? ""}" placeholder="${hd != null ? fmt(hd, 2) : ""}" step="0.05" min="0" max="10"><i>m</i>`
          ) +
          `<p class="ds-crit">Criterio: si la deja vacía, usa la de Parámetros › Alturas (${hd != null ? fmt(hd, 2) + " m" : "—"}).</p>`
        : el.k === "luz"
          ? fila("Altura", "En el techo")
          : "") +
      campo("Rotación", `<input type="number" data-dsp="r" value="${+(el.r || 0).toFixed(2)}" step="1"><i>°</i>`) +
      fila("Posición", `X ${plFm(el.x)} · Y ${plFm(el.y)} m`);
    h =
      `<div class="ed-pt">${cat.n}<small>${dsCodTxt(el.k)}</small></div>` +
      (el.k === "bmed" && dsMedidoresBanco(el).length
        ? dsBancoPrev(dsMedidoresBanco(el))
        : `<div class="ds-prev">${dsIcono(el.k)}</div>`) +
      `<div class="ed-pb ed-pb0"><button type="button" class="btn sec sm" data-dsa="simbolo" title="Relleno, tamaño, letra y grosor de este tipo de símbolo (criterio del proyectista)">Editar símbolo…</button>${dsSimb(el.k) ? '<span class="ds-crit">Con criterio del proyectista</span>' : ""}</div>` +
      dsSec("Datos eléctricos") +
      (cat.u
        ? campo(
            "Potencia",
            `<input type="number" data-dsp="p" value="${el.p ?? ""}" placeholder="${pd != null ? pd : ""}" step="10" min="0" max="100000"><i>${cat.u}</i>`
          ) +
          (cl === "esp" && el.p == null
            ? `<p class="ds-crit ds-falta">Escriba la potencia: el cálculo la necesita.</p>`
            : cl === "al" || cl === "to"
              ? `<p class="ds-crit">Vacía: ${dsLumT(el.lt) && dsLumT(el.lt).w > 0 ? `la del tipo ${el.lt}` : "la de Parámetros (W por salida)"}.</p>`
              : "")
        : "") +
      (cl === "al"
        ? campo(
            "Luminaria",
            `<select data-dsp="lt"><option value="">— Sin tipo —</option>${(dsD().lums || []).map(t => `<option value="${t.id}"${t.id === el.lt ? " selected" : ""}>${esc(dsLumTxt(t))}</option>`).join("")}</select>`
          ) +
          `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="lums" title="Dicroicos, paneles, luminarias de gradas, con sensor, de emergencia…: cada tipo con su potencia">Tipos de luminaria…</button></div>`
        : "") +
      (cl === "esp"
        ? campo(
            "Descripción",
            `<input type="text" data-dsp="cn" value="${esc(el.cn || "")}" placeholder="${esc(esp[2])}" maxlength="60">`
          ) +
          campo(
            "Tipo de carga",
            `<select data-dsp="ctp">${Object.entries(TIPOS)
              .map(([k, n]) => `<option value="${k}"${k === (el.ctp || esp[0]) ? " selected" : ""}>${esc(n)}</option>`)
              .join("")}</select>`
          ) +
          campo(
            "Fases",
            `<select data-dsp="fs"><option value="1"${(el.fs || esp[1]) === 1 ? " selected" : ""}>Monofásica</option><option value="3"${(el.fs || esp[1]) === 3 ? " selected" : ""}>Trifásica</option></select>`
          ) +
          campo(
            "Electrónica",
            `<select data-dsp="elc" title="Inverter, variador, cocina de inducción, cargador: su diferencial se sugiere tipo A"><option value="">No</option><option value="1"${el.elc ? " selected" : ""}>Sí (inverter, variador…)</option></select>`
          ) +
          `<p class="ds-crit">El tipo de carga decide cómo entra en la máxima demanda (Regla 050-200).</p>`
        : "") +
      (el.k === "tab"
        ? fila("Nombre", esc(el.nom || "—")) +
          fila("Circuitos", el.gen ? "Solo alimentadores" : el.nc ? `${el.nc} (C-1 a C-${el.nc})` : "sin definir") +
          `<div class="ed-pb"><button type="button" class="btn sm" data-dsa="tablero">Circuitos del tablero…</button></div>`
        : el.k === "bmed"
          ? dsPropsBanco(el, campo)
          : cat.s !== "can" && cat.s !== "tie" && !PL_MED.has(el.k)
            ? campo("Circuito", circ(el.cir, el.tab)) + lista
            : "") +
      (PL_PASO.has(el.k) ? dsPropsPaso(el, campo, circ) : "") +
      (dsConEnc(el)
        ? campo(
            "Encendido",
            `<input type="text" data-dsp="enc" value="${esc(el.enc || "")}" placeholder="${dsEsInt(el) ? "a  ·  doble: a,b" : "a, b…"}" maxlength="${dsEsInt(el) ? 15 : 3}" title="Letra que une el interruptor con las luminarias que enciende">`
          ) +
          (dsEsInt(el)
            ? `<p class="ds-crit">Una letra por tecla: interruptor doble «a,b» (o «ab»), triple «a,b,c». Cada letra enciende las luminarias que la tienen; la tubería lleva la fase y un retorno por tecla.</p>`
            : "")
        : "") +
      (el.cir && dsConEtq(el) ? dsCampoEtq(campo, [el]) : "") +
      montaje +
      dsSec("Dibujo") +
      campo("Capa", capas(el.capa));
    // Sin datos eléctricos (puesta a tierra, medidor…): sin su encabezado vacío
    h = h.replace(dsSec("Datos eléctricos") + dsSec("Montaje"), dsSec("Montaje"));
  } else if (el.t === "txt") {
    h =
      `<div class="ed-pt">Texto</div>` +
      campo("Texto", `<input type="text" data-dsp="s" value="${esc(el.s)}" maxlength="200">`) +
      campo(
        "Altura",
        `<input type="number" data-dsp="ht" value="${+(el.ht * EPL.f).toFixed(3)}" step="0.01" min="0.01"><i>m</i>`
      ) +
      campo("Rotación", `<input type="number" data-dsp="r" value="${+(el.r || 0).toFixed(2)}" step="1"><i>°</i>`) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "dir") {
    h =
      `<div class="ed-pt">Directriz</div>` +
      campo("Texto", `<input type="text" data-dsp="s" value="${esc(el.s)}" maxlength="120">`) +
      (el.aut
        ? `<p class="ds-crit">Rótulo automático: el texto sigue a los alimentadores que pasan por la caja o el montante. Si lo cambia, queda como lo escriba.</p>`
        : "") +
      campo(
        "Altura",
        `<input type="number" data-dsp="ht" value="${+(el.ht * EPL.f).toFixed(3)}" step="0.01" min="0.01"><i>m</i>`
      ) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "cot") {
    const G = dsCotaGeo(el);
    h =
      `<div class="ed-pt">Cota</div>` +
      fila("Medida", `${plFm(G.med)} m`) +
      campo(
        "Dirección",
        `<select data-dsp="modo"><option value="alin"${el.modo === "alin" ? " selected" : ""}>Alineada</option><option value="h"${el.modo === "h" ? " selected" : ""}>Horizontal</option><option value="v"${el.modo === "v" ? " selected" : ""}>Vertical</option></select>`
      ) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "cua") {
    h =
      `<div class="ed-pt">Cuadro de circuitos<small>Se arma solo con los tableros y lo conectado a cada circuito</small></div>` +
      campo(
        "Título",
        `<input type="text" data-dsp="tit" value="${esc(el.tit || "CUADRO DE CIRCUITOS")}" maxlength="60">`
      ) +
      fila("Circuitos", dsFilasCua().filter(f => f.c).length) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "ley") {
    h =
      `<div class="ed-pt">Leyenda<small>Se arma sola con lo que usa el diseño</small></div>` +
      campo("Título", `<input type="text" data-dsp="tit" value="${esc(el.tit || "LEYENDA")}" maxlength="60">`) +
      fila("Filas", dsFilasLey().length) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "lin" && el.ar) {
    const ip = dpPlantaEl(el),
      pl = ip >= 0 ? EPL.plantas[ip] : null;
    h =
      `<div class="ed-pt">Área para el cálculo<small>${pl ? `${esc(pl.n)} · ${dpNomPiso(plPisoPlanta(pl, ip))}` : EPL.plantas.length ? "fuera de las plantas encuadradas" : "1er piso"}</small></div>` +
      campo(
        "Ambiente",
        `<input type="text" data-dsp="arn" value="${esc(el.ar.n || "")}" maxlength="60" placeholder="Sala, cocina, pasillo…">`
      ) +
      (el.ar.tp !== "ext"
        ? campo(
            "Tipo de ambiente",
            `<button type="button" class="ds-amb" data-dsa="ambtipo" title="Elegir el tipo de ambiente (Norma EM.010 o propio)">${esc(el.ar.amb && ambTipo(el.ar.amb) ? ambTipo(el.ar.amb).n : "Elegir el tipo…")}<span class="ds-amb-f">▸</span></button>`
          ) + (el.ar.amb && ambTipo(el.ar.amb) ? fila("Iluminancia", luxCelda(ambTipo(el.ar.amb))) : "")
        : "") +
      campo(
        "Tipo",
        `<select data-dsp="artp">${Object.entries(PL_TAREA)
          .map(([k, t]) => `<option value="${k}"${k === el.ar.tp ? " selected" : ""}>${t}</option>`)
          .join("")}</select>`
      ) +
      (MODE === "multi"
        ? campo(
            "Departamento",
            `<select data-dsp="ardep"><option value="">— Áreas comunes o del piso —</option>${tipos.map((t, i) => `<option value="${i}"${el.ar.dep === i ? " selected" : ""}>${esc(t.nombre || "Tipo " + (i + 1))}</option>`).join("")}</select>`
          )
        : "") +
      fila("Área", `${fmt(dsM2(el), 2)} m²`) +
      fila("Perímetro", `${plFm(dsLargo(el))} m`) +
      `<p class="ds-crit">Vivienda: suma las áreas techadas por dimensiones interiores (Regla 050-110). Otros usos: el contorno exterior del piso (Regla 050-210). El área no se imprime en la lámina.</p>` +
      campo("Capa", capas(el.capa));
  } else if (el.t === "cir") {
    h =
      `<div class="ed-pt">Círculo</div>` +
      campo(
        "Radio",
        `<input type="number" data-dsp="rad" value="${+(el.rad * EPL.f).toFixed(3)}" step="0.05" min="0.01"><i>m</i>`
      ) +
      campo("Capa", capas(el.capa)) +
      fila("Centro", `X ${plFm(el.x)} · Y ${plFm(el.y)} m`);
  } else {
    const tub = el.t === "tub",
      T = dsTramos(el),
      nc = T.filter(t => t.k).length;
    h =
      `<div class="ed-pt">${tub ? "Tubería" : el.c ? "Polilínea cerrada" : el.pts.length > 4 ? "Polilínea" : "Línea"}</div>` +
      (tub
        ? campo(
            "Recorrido",
            `<select data-dsp="modo"><option value="techo"${!el.modo || el.modo === "techo" ? " selected" : ""}>Techo (línea continua)</option><option value="pared"${el.modo === "pared" ? " selected" : ""}>Pared (línea continua)</option><option value="piso"${el.modo === "piso" ? " selected" : ""}>Piso (línea discontinua)</option></select>`
          )
        : "") +
      fila(
        "Longitud",
        `${plFm(dsLargo(el))} m${nc ? `<small>con ${nc} tramo${nc > 1 ? "s" : ""} en arco (longitud del arco)</small>` : ""}`
      ) +
      (T.length > 1
        ? `<div class="ds-tramos">${T.map((t, i) => `<span>Tramo ${i + 1}${t.k ? " ◠" : ""}</span><b>${plFm(t.L)} m</b>`).join("")}</div>`
        : "") +
      campo("Capa", capas(el.capa)) +
      (tub
        ? campo(
            "Uso",
            `<select data-dsp="ali"><option value="">Circuito</option><option value="1"${el.ali ? " selected" : ""}>Alimentador (sin circuito)</option></select>`
          ) +
          (el.ali ? "" : campo("Circuito", circ(el.cir, el.tab)) + lista + dsCampoCx(campo, el)) +
          (el.sec ? fila("Del cálculo", esc(el.sec)) : "") +
          dsCampoCond(campo, [el]) +
          dsCampoEtq(campo, [el])
        : "") +
      `<p class="ds-crit ds-crit0">Arrastre el rombo del medio de un tramo para curvarlo; los cuadrados mueven los vértices. Clic derecho en un vértice o en un tramo: quitar o agregar vértices, partir, volver recto o en arco; con dos elegidas, unirlas. Supr sobre un vértice lo quita.</p>` +
      curvas;
  }
  const color = `<label class="ed-pf ed-pc"><span>Color</span><span class="ds-colr"><input type="color" data-dsp="col" value="${dsColorEl(el, cap)}" title="Color propio de este elemento"><button type="button" class="btn sec sm" data-dsa="colcapa"${el.col ? "" : " disabled"} title="Quita el color propio: vuelve al color de su tipo (si está activado en Vista) o al de su capa">Restablecer</button></span></label>`,
    letra = el.dt
      ? `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="letra0">Letra a su lugar</button></div>`
      : "";
  c.innerHTML = h + color + letra + (cap.bloq ? `<p class="pl-nota">La capa está bloqueada.</p>` : "") + acciones;
  if (c.id === "edPropC") elRender();
}
// Campos comunes a varios símbolos: rotación y, si todos tienen, altura de montaje y potencia (vacío = cada uno el suyo)
function dsCamposVarios(campo, sel) {
  if (!sel.every(el => el.t === "sim" && DS_CAT[el.k])) return "";
  const igual = k => sel.every(el => el[k] === sel[0][k]),
    u = DS_CAT[sel[0].k].u,
    mismaU = sel.every(el => DS_CAT[el.k].u === u);
  return (
    campo(
      "Rotación",
      `<input type="number" data-dsp="r" value="${igual("r") ? +(sel[0].r || 0).toFixed(2) : ""}" placeholder="(varias)" step="1"><i>°</i>`
    ) +
    (sel.every(el => DS_CAT[el.k].h)
      ? campo(
          "Altura",
          `<input type="number" data-dsp="h" value="${igual("h") && sel[0].h != null ? sel[0].h : ""}" placeholder="${igual("h") ? "la de Parámetros" : "(varias)"}" step="0.05" min="0" max="10"><i>m</i>`
        )
      : "") +
    (u && mismaU
      ? campo(
          "Potencia",
          `<input type="number" data-dsp="p" value="${igual("p") && sel[0].p != null ? sel[0].p : ""}" placeholder="${igual("p") ? "la de Parámetros" : "(varias)"}" step="10" min="0" max="100000"><i>${u}</i>`
        )
      : "") +
    (sel.every(el => dsClase(el) === "al")
      ? campo(
          "Luminaria",
          `<select data-dsp="lt">${igual("lt") ? "" : '<option value="-" selected>(varias)</option>'}<option value=""${igual("lt") && !sel[0].lt ? " selected" : ""}>— Sin tipo —</option>${(dsD().lums || []).map(t => `<option value="${t.id}"${igual("lt") && t.id === sel[0].lt ? " selected" : ""}>${esc(dsLumTxt(t))}</option>`).join("")}</select>`
        )
      : "")
  );
}
/* Otros circuitos del mismo tablero que van en la tubería (cuentan para el agrupamiento de la Tabla 5C y para el
   recorrido de esos circuitos) */
function dsCampoCx(campo, el) {
  const tb = el.tab && dsD().els.find(e => e.id === el.tab);
  if (!tb || !el.cir) return "";
  const S = dsSalidasTab(tb).filter(o => o.n !== el.cir);
  if (!S.length) return "";
  return (
    campo(
      "Lleva también",
      `<span class="ds-cx">${S.map(o => `<label title="${esc(o.d || "")}"><input type="checkbox" data-dsp="cx" value="${o.n}"${(el.cx || []).includes(o.n) ? " checked" : ""}>${o.n}</label>`).join("")}</span>`
    ) +
    `<p class="ds-crit">Circuitos de ${esc(tb.nom || "este tablero")} que van juntos en esta tubería: el cálculo aplica la Tabla 5C con ellos.</p>` +
    (dsTubRepetidas(el).length
      ? `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="juntar" title="Deja una sola tubería entre estos dos puntos, con todos los circuitos y sus conductores">Juntar con ${esc(
          dsTubRepetidas(el)[0]
            .filter(o => o !== el)
            .map(o => o.cir)
            .join(", ")
        )} (mismos extremos)</button></div>`
      : "")
  );
}
/* Tuberías repetidas: dos o más tuberías de circuito del mismo tablero entre los mismos dos artefactos (por ejemplo, una
   por circuito desde el tablero hasta la misma salida). Devuelve los grupos (cada uno, sus tuberías). */
function dsTubRepetidas(t) {
  const D = dsD();
  if (!D) return [];
  const G = new Map();
  D.els.forEach(o => {
    if (o.t !== "tub" || o.ali || !o.cir || !o.c0 || !o.c1 || o.c0 === o.c1 || !dsVis(o)) return;
    const k = [o.tab || "", ...[o.c0, o.c1].sort()].join("|");
    (G.get(k) || G.set(k, []).get(k)).push(o);
  });
  const L = [...G.values()].filter(g => g.length > 1);
  return t ? L.filter(g => g.includes(t)) : L;
}
/* Junta las tuberías repetidas en una: queda la que lleva más circuitos, con todos los circuitos en «Lleva también»
   (Tabla 5C) y los conductores automáticos de todos ellos. */
function dsJuntarTubs(ids) {
  const D = dsD(),
    g = ids.map(id => D.els.find(e => e.id === id)).filter(e => e && e.t === "tub");
  if (g.length < 2) return;
  const cirs = t => [t.cir, ...(t.cx || [])].filter(Boolean),
    q = g.reduce((a, b) => (cirs(b).length > cirs(a).length ? b : a)),
    todos = new Set(g.flatMap(cirs));
  todos.delete(q.cir);
  if (todos.size) q.cx = [...todos].sort((a, b) => parseInt(a.slice(2), 10) - parseInt(b.slice(2), 10));
  else delete q.cx;
  delete q.cond;
  delete q.condA;
  const fuera = new Set(g.filter(t => t !== q).map(t => t.id));
  D.els = D.els.filter(e => !fuera.has(e.id));
  DS_SEL.clear();
  DS_SEL.add(q.id);
  edCambio();
  toast(`Tuberías juntadas: una sola lleva ${[q.cir, ...(q.cx || [])].join(", ")} con sus conductores`);
}
// Diámetros nominales de las tuberías (mm)
const DS_DIAS = [15, 20, 25, 35, 40, 50, 65, 80];
// Campo de conductores de las tuberías (fases, neutro, tierra), su diámetro y botón para todo el circuito
function dsCampoCond(campo, ts) {
  const d0 = ts.every(t => (t.dia || 0) === (ts[0].dia || 0)) ? ts[0].dia || 0 : -1;
  return (
    campo(
      "Diámetro",
      `<select data-dsp="dia">${d0 < 0 ? '<option value="" selected>(varios)</option>' : ""}<option value=""${d0 === 0 ? " selected" : ""}>—</option>${DS_DIAS.map(d => `<option value="${d}"${d === d0 ? " selected" : ""}>Ø ${d} mm</option>`).join("")}</select>`
    ) + dsCampoCond1(campo, ts)
  );
}
function dsCampoCond1(campo, ts) {
  const c0 = JSON.stringify(ts[0].cond || {}),
    igual = ts.every(t => JSON.stringify(t.cond || {}) === c0),
    c = igual ? ts[0].cond || {} : {},
    cir = ts.length === 1 && ts[0].cir;
  return (
    campo(
      "Conductores",
      `<span class="ds-cond"><select data-dsp="condF" title="Fases (en 220 V monofásico, los dos conductores del circuito)">${[
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
      ]
        .map(n => `<option value="${n}"${igual && (c.f || 0) === n ? " selected" : ""}>${n} F</option>`)
        .join(
          ""
        )}</select><select data-dsp="condR" title="Retornos: la fase que vuelve del interruptor a sus luminarias (y los viajeros de los de tres vías)">${[
        0, 1, 2, 3, 4, 5, 6
      ]
        .map(n => `<option value="${n}"${igual && (c.r || 0) === n ? " selected" : ""}>${n} R</option>`)
        .join("")}</select><select data-dsp="condN" title="Neutros">${[0, 1, 2, 3, 4, 5, 6]
        .map(n => `<option value="${n}"${igual && dsNeutros(c) === n ? " selected" : ""}>${n} N</option>`)
        .join("")}</select><label><input type="checkbox" data-dsp="condT"${c.t ? " checked" : ""}>T</label></span>`
    ) +
    `<p class="ds-crit">Marcas de la norma sobre la tubería: una raya por fase, el neutro (N) con punto y la tierra (T) con tope; los retornos (R), una raya con una «r» encima (criterio). ${ts.every(t => t.condA) ? "Automáticos según el sistema del proyecto y el recorrido del circuito: la fase llega a cada interruptor y cada tecla devuelve un retorno a sus luminarias (cambian solos si cambia el circuito)." : ts.some(t => t.cir && !t.ali) ? "Elegidos a mano." : ""}</p>` +
    (ts.some(t => t.cir && !t.ali && !t.condA)
      ? `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="condauto" title="Vuelve a marcar los conductores según el sistema y el circuito">Conductores automáticos</button></div>`
      : "") +
    (cir
      ? `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="condcir">Igual en todo el circuito ${esc(cir)}</button></div>`
      : "")
  );
}
const dsNomTipo = t =>
  DS_CAT[t]
    ? DS_CAT[t].n
    : {
        "tub-techo": "Tubería en techo o pared",
        "tub-piso": "Tubería en piso",
        lin: "Línea o polilínea",
        area: "Área para el cálculo",
        cir: "Círculo",
        txt: "Texto",
        cot: "Cota",
        dir: "Directriz",
        ley: "Leyenda",
        cua: "Cuadro de circuitos"
      }[t] || t;
function dsPropCambio(e) {
  const f = e.target.closest("[data-dsp]");
  if (!f || !DS_SEL.size) return;
  const k = f.dataset.dsp,
    v = f.type === "checkbox" ? (f.checked ? "1" : "") : f.value.trim();
  dsSel().forEach(el => {
    if (k === "condF" || k === "condN" || k === "condT" || k === "condR") {
      if (el.t !== "tub") return;
      const c = { f: 0, n: false, t: false, ...(el.cond || {}) };
      if (k === "condF") c.f = Math.max(0, Math.min(12, parseInt(v, 10) || 0));
      else if (k === "condN") c.n = Math.max(0, Math.min(6, parseInt(v, 10) || 0));
      else if (k === "condR") c.r = Math.max(0, Math.min(12, parseInt(v, 10) || 0));
      else c.t = !!v;
      c.n = dsNeutros(c);
      if (!c.r) delete c.r;
      // Elegidos por el proyectista: ya no se cambian solos
      delete el.condA;
      el.cond = c;
      return;
    }
    if (k === "dia") {
      if (el.t === "tub") el.dia = DS_DIAS.includes(+v) ? +v : undefined;
      return;
    }
    if (k === "enc") {
      if (dsConEnc(el)) el.enc = dsEncLimpio(v, el);
      return;
    }
    if (k === "capa") {
      if (v) el.capa = v;
    } else if (k === "r") el.r = Math.round(((((parseFloat(v) || 0) % 360) + 360) % 360) * 100) / 100;
    else if (k === "col") el.col = /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : el.col;
    else if (k === "h") el.h = v === "" ? undefined : Math.max(0, parseFloat(v) || 0);
    else if (k === "p") el.p = v === "" ? undefined : Math.max(0, parseFloat(v) || 0);
    else if (k === "arn" && el.ar) {
      el.ar.n = v.replace(/[<>]/g, "").slice(0, 60);
      // Sin tipo de ambiente: se toma del nombre
      if (!el.ar.amb && el.ar.tp !== "ext" && plAmbDe(el.ar.n)) el.ar.amb = plAmbDe(el.ar.n);
    } else if (k === "aramb" && el.ar) {
      if (ambValido(v)) el.ar.amb = v;
      else delete el.ar.amb;
    } else if (k === "artp" && el.ar) el.ar.tp = PL_TAREA[v] ? v : "tech";
    else if (k === "ardep" && el.ar) {
      if (v === "") delete el.ar.dep;
      else el.ar.dep = +v;
    } else if (k === "cx" && el.t === "tub") {
      const s = new Set(el.cx || []);
      if (f.checked) s.add(f.value);
      else s.delete(f.value);
      s.delete(el.cir);
      el.cx = [...s].sort((a, b) => parseInt(a.slice(2), 10) - parseInt(b.slice(2), 10));
      if (!el.cx.length) delete el.cx;
    } else if (k === "lt") {
      if (v !== "-") el.lt = /^L[0-9]{1,3}$/.test(v) ? v : undefined;
    } else if (k === "cn") el.cn = v.replace(/[<>]/g, "").trim().slice(0, 60) || undefined;
    else if (k === "ctp") el.ctp = TIPOS[v] ? v : undefined;
    else if (k === "fs") el.fs = v === "3" ? 3 : 1;
    else if (k === "mman" && el.k === "bmed") {
      if (v === "1") el.mman = true;
      else delete el.mman;
    } else if (k === "bmn" && el.k === "bmed") {
      const n = Math.max(0, Math.min(40, Math.round(+v) || 0)),
        m = (el.meds || []).slice(0, n);
      while (m.length < n) m.push({ d: "", f: 1 });
      if (m.length) el.meds = m;
      else delete el.meds;
    } else if (/^bm[df]\d+$/.test(k) && el.k === "bmed" && el.meds) {
      const i = +k.slice(3),
        m = el.meds[i];
      if (m && k[2] === "d") m.d = v.replace(/[<>]/g, "").slice(0, 20);
      else if (m) m.f = v === "3" ? 3 : 1;
    } else if ((k === "etq" || k === "cirt" || k === "nsal") && v !== "~" && dsConEtq(el)) {
      // Etiquetas propias del elemento; vacío: como en todo el plano
      if (k === "etq" && el.t === "tub") ["no", "total", "tramo"].includes(v) ? (el.etq = v) : delete el.etq;
      else if (k === "cirt" && el.t === "tub") v ? (el.cirt = v === "1") : delete el.cirt;
      else if (k === "nsal" && el.t === "sim") v ? (el.nsal = v === "1") : delete el.nsal;
    } else if (k === "num" && el.k === "bmed") {
      if (v === "1") el.num = true;
      else delete el.num;
    } else if (k === "elc") el.elc = v === "1" || undefined;
    else if (k === "ali") {
      // Alimentador: sin circuito (no lo hereda ni lo pasa a lo conectado)
      el.ali = v === "1" || undefined;
      if (el.ali) {
        delete el.cir;
        delete el.tab;
      }
    } else if (k === "cir") {
      // «tablero|circuito»; «~»: varios distintos (no se cambia); vacío: sin circuito
      if (v === "~" || el.k === "tab") return;
      const [tb, cir] = v.split("|");
      if (!cir) {
        delete el.cir;
        delete el.tab;
      } else {
        el.cir = cir.replace(/[<>]/g, "").slice(0, 12);
        if (tb) el.tab = tb;
      }
    } else if (k === "s") {
      el.s = v.replace(/[<>]/g, "").slice(0, 200) || el.s;
      // Escrito a mano: deja de ser rótulo automático
      delete el.aut;
    } else if (k === "uso" && PL_PASO.has(el.k)) {
      // Alimentador: sin circuito (no lo toma de lo conectado); circuito: se elige debajo o lo toma de su tubería
      if (v === "ali") {
        el.ali = true;
        delete el.cir;
        delete el.tab;
      } else el.ali = false;
    } else if (k === "kmon" && dpSimbolosMon(el).includes(v)) {
      el.k = v;
      // Una caja toma su número (CP-n) al guardar el cambio; otro símbolo no lo lleva
      if (!DS_CAJAS.has(v)) delete el.nom;
    } else if (k === "nom" && DS_CAJAS.has(el.k)) {
      const n = v.replace(/[<>]/g, "").slice(0, 20);
      if (n && dsD().els.some(o => o !== el && DS_CAJAS.has(o.k) && o.nom === n)) toast(`Ya hay una caja ${n}`);
      else if (n) el.nom = n;
    } else if (k === "tit")
      el.tit = v.replace(/[<>]/g, "").slice(0, 60) || (el.t === "cua" ? "CUADRO DE CIRCUITOS" : "LEYENDA");
    else if (k === "ht") el.ht = Math.max(0.01, parseFloat(v) || 0.1) / EPL.f;
    else if (k === "rad") el.rad = Math.max(0.01, parseFloat(v) || 0.1) / EPL.f;
    else if (k === "modo") {
      if (el.t === "tub") {
        el.modo = ["piso", "pared"].includes(v) ? v : "techo";
        // La tubería pasa a la capa de su recorrido si estaba en la del otro
        if (el.capa === DS_SIS.tubT.capa || el.capa === DS_SIS.tubP.capa)
          el.capa = el.modo === "piso" ? DS_SIS.tubP.capa : DS_SIS.tubT.capa;
      } else if (el.t === "cot") el.modo = ["alin", "h", "v"].includes(v) ? v : "alin";
    }
  });
  edCambio();
  // Otro número de medidores del banco (o de dónde salen): su tabla cambia
  if (k === "bmn" || k === "mman" || k === "kmon" || k === "uso" || k === "cir") edProps();
}
function dsPropClic(e) {
  const b = e.target.closest("[data-dsa]");
  if (!b) return;
  const a = b.dataset.dsa;
  if (a === "girar") dsGirar();
  else if (a === "rotulo") dcPonerRotulo();
  else if (a === "ambtipo")
    luxElegir(
      dsSel()
        .filter(o => o.ar)
        .map(o => o.id)
    );
  else if (a === "simbolo") siAbrir(dsSel()[0].k);
  else if (a === "condcir") {
    const t = dsSel()[0];
    let n = 0;
    dsD().els.forEach(o => {
      if (o.t === "tub" && o !== t && o.cir === t.cir && (o.tab || "") === (t.tab || "")) {
        if (t.cond) o.cond = { ...t.cond };
        else delete o.cond;
        if (t.condA) o.condA = true;
        else delete o.condA;
        if (t.dia) o.dia = t.dia;
        n++;
      }
    });
    edCambio();
    toast(`Conductores iguales en ${n + 1} tubería${n ? "s" : ""} del circuito ${t.cir}`);
  } else if (a === "juntar") {
    const g = dsTubRepetidas(dsSel()[0])[0];
    if (g) dsJuntarTubs(g.map(o => o.id));
    edProps();
  } else if (a === "condauto") {
    dsSel().forEach(t => {
      if (t.t === "tub" && t.cir && !t.ali) {
        delete t.cond;
        delete t.condA;
      }
    });
    edCambio();
    edProps();
  } else if (a === "colcapa" || a === "letra0") {
    dsSel().forEach(el => delete el[a === "colcapa" ? "col" : "dt"]);
    edCambio();
  } else if (a === "borrar") edBorrar(false);
  else if (a === "copiar") {
    dsCopiar();
    dsPegar();
  } else if (a === "tablero") tabAbrir(dsSel()[0].id);
  else if (a === "lums") lumAbrir();
  else dsCurvar(a);
}
["edPropC", "elC"].forEach(id => {
  $(id).addEventListener("change", dsPropCambio);
  $(id).addEventListener("click", dsPropClic);
});

/* ---------- Resumen del diseño (panel izquierdo): cuántos hay de cada cosa; un clic los selecciona ---------- */
function dsResumen(ya) {
  const D = dsD();
  if (!ya && D && D.els.length > 3000) {
    clearTimeout(dsResumen.t);
    dsResumen.t = setTimeout(() => dsResumen(true), 300);
    return;
  }
  dsResumen0();
}
function dsResumen0() {
  const D = dsD(),
    box = $("dsResumen");
  if (!D || !PL_MOD) {
    box.innerHTML = "";
    $("dsN").textContent = "";
    return;
  }
  const cuenta = {},
    largo = {};
  // Filtro por planta (con dos o más plantas encuadradas)
  const P = EPL.plantas,
    f = $("dsPlF");
  if (DP_F >= P.length) DP_F = -1;
  f.hidden = P.length < 2;
  f.innerHTML =
    `<option value="-1">Todas</option>` + P.map((p, i) => `<option value="${i}">${esc(p.n)}</option>`).join("");
  f.value = String(DP_F);
  dpFiltrar(D.els).forEach(el => {
    const t = dsTipo(el);
    cuenta[t] = (cuenta[t] || 0) + 1;
    if (el.t === "tub") largo[t] = (largo[t] || 0) + dsLargo(el);
  });
  $("dsN").textContent = D.els.length || "";
  const sl = dsSueltos(),
    hayTub = D.els.some(e => e.t === "tub"),
    s = (n, a, b) => `${n} ${n === 1 ? a : b}`,
    aviso =
      sl.sims.length || sl.puntas.length
        ? `<div class="ds-aviso"><b>Sin conectar:</b> ${[sl.sims.length ? s(sl.sims.length, "artefacto sin tubería", "artefactos sin tubería") : "", sl.puntas.length ? s(sl.puntas.length, "punta de tubería suelta", "puntas de tubería sueltas") : ""].filter(Boolean).join(" · ")}<div><button type="button" data-dsx="elegir">Elegirlos</button>${hayTub ? '<button type="button" data-dsx="auto" title="Conecta las puntas que ya están sobre un artefacto">Conectar automáticamente</button>' : ""}</div></div>`
        : hayTub
          ? '<div class="ds-aviso ok">✓ Todas las tuberías y artefactos están conectados</div>'
          : "";
  const vf = D.els.length ? dsVerificar() : [],
    rv = vf.filter(o => o.nivel === "aviso").length,
    rs = vf.filter(o => o.nivel === "seg").length;
  const revision = D.els.length
    ? `<div class="ds-aviso${rv || rs ? "" : " ok"}${rs ? " seg" : ""}"><b>Revisión:</b> ${[rs ? `${rs} de seguridad` : "", rv ? `${rv} aviso${rv > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ") || "sin avisos"}<div><button type="button" data-dsx="rev">Revisar diseño</button></div></div>`
    : "";
  const orden = [
    ...Object.keys(DS_CAT),
    "tub-techo",
    "tub-piso",
    "area",
    "lin",
    "cir",
    "txt",
    "cot",
    "dir",
    "ley",
    "cua"
  ].filter(t => cuenta[t]);
  box.innerHTML = orden.length
    ? aviso +
      revision +
      orden
        .map(
          t =>
            `<button type="button" class="ds-fila" data-dst="${t}" title="Seleccionar todos">${DS_CAT[t] ? (DSU.color === "tipo" ? dsIcono(t).replace('class="ds-ico"', `class="ds-ico" style="color:${plColorDis(DS_COLT[t])}"`) : dsIcono(t)) : `<i class="ds-ico ds-lin${t === "tub-piso" ? " piso" : ""}"></i>`}<span>${dsNomTipo(t)}</span><em>${largo[t] ? plFm(largo[t]) + " m" : cuenta[t]}</em></button>`
        )
        .join("")
    : `<p class="pl-nota">Coloque luminarias, interruptores, tomacorrientes, tableros y tuberías desde las pestañas <b>Insertar</b> y <b>Dibujo</b>. Aquí verá cuántos hay de cada uno y los metros de tubería.</p>`;
}
$("dsPlF").addEventListener("change", e => {
  DP_F = +e.target.value;
  e.target.blur();
  dsResumen();
});
$("dsResumen").addEventListener("click", e => {
  const b = e.target.closest("[data-dst]"),
    x = e.target.closest("[data-dsx]");
  if (b) dsSelTipo(b.dataset.dst);
  else if (x && x.dataset.dsx === "rev") revAbrir();
  else if (x && x.dataset.dsx === "auto") {
    const k = dsConectarAuto();
    if (k) edCambio();
    toast(
      k
        ? `${k} punta${k > 1 ? "s" : ""} conectada${k > 1 ? "s" : ""}`
        : "No hay puntas sobre un artefacto: arrastre cada punta suelta hasta su artefacto"
    );
  } else if (x) {
    const sl = dsSueltos();
    DS_SEL.clear();
    PL_ASEL.clear();
    sl.sims.forEach(el => DS_SEL.add(el.id));
    sl.puntas.forEach(o => DS_SEL.add(o.el.id));
    PLH.obj = -1;
    edProps();
    plSobreDibujar();
  }
});
