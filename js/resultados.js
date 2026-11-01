/* PRESENTACIÓN DE RESULTADOS
   Estado global (MODE, LAST, VIEW…) y las tarjetas del panel central: tablas de alimentadores y
   circuitos, máxima demanda, balance de fases, suministro, puesta a tierra, alertas y recomendaciones. */
const pill = (ok, yes = "Cumple", no = "No cumple") =>
  `<span class="pill ${ok ? "ok" : "bad"}">${ok ? yes : no}</span>`;
const pillS = (st, t) => `<span class="pill ${st}">${t}</span>`;
const condTxt = (n, S, c) => `${n}-1×${S} mm²${c && c.desig ? " " + c.desig : ""}`;
const sugerencia = r => {
  const m = r.bal && r.bal.mayor;
  if (!m || r.bal.desbMin <= 10) return "";
  return r.mode === "uni"
    ? `Sugerencia: divida el circuito ${m.id} (${m.desc}, ${fmt(m.P, 0)} W) en dos circuitos o aliméntelo como carga trifásica.`
    : `Sugerencia: el reparto está limitado por unidades de gran carga (${m.ref || m.desc}, ${fmt(m.P, 0)} W); evalúe un suministro trifásico para ellas o redistribuya las cargas comunes.`;
};
let MODE = "uni",
  LAST = null,
  FIX = { uni: {}, multi: {} },
  ACEP = { uni: {}, multi: {} },
  TEQ = { uni: {}, multi: {} },
  SECF = { uni: {}, multi: {} },
  VIEW = "resumen",
  PID = null,
  // Plano de arquitectura del proyecto (js/plano.js): archivo, unidad, capas ocultas y plantas; null si no tiene
  PLANO = null;
try {
  VIEW = localStorage.getItem("jmg-electric-view") || "resumen";
} catch (e) {}
const VORDEN = [
  "resumen",
  "demanda",
  "alims",
  "cuadro",
  "balance",
  "unifilar",
  "alturas",
  "detalles",
  "tableros",
  "tgeneral",
  "medidores",
  "metrado",
  "verif"
];
const VLBL = {
  resumen: "Resumen",
  demanda: "Máxima demanda",
  alims: "Alimentadores",
  cuadro: "Cuadro de cargas",
  balance: "Balance de fases",
  unifilar: "Diagrama unifilar",
  alturas: "Diagrama de alturas",
  detalles: "Leyenda y detalles",
  tableros: "Detalle de tableros",
  tgeneral: "Tablero general",
  medidores: "Banco de medidores",
  metrado: "Metrado",
  verif: "Verificaciones"
};

// Celda en ámbar si el valor usa el 90 % o más de su límite (mismo umbral que «Poco margen», DV_MARGEN)
const cerca = (v, lim) =>
  v >= DV_MARGEN * lim ? ` class="cerca" title="Al ${fmt((v / lim) * 100, 0)} % de su límite"` : "";
function tablaAlims(r, nro) {
  return `<section class="card"><h2><span><span class="num">${nro}</span>Alimentadores</span><span class="ref">050-102 · 050-104 · Tabla 2</span></h2>
  <div class="tbl-wrap"><table><thead><tr><th class="t">Alimentador</th>${r.mode === "multi" ? "<th>Cant.</th>" : ""}<th>P (kW)</th><th>Sistema</th><th>I (A)</th><th>Id (A)</th><th>ITM</th><th>PdC</th><th>Conductor Cu</th><th>Iz corr. (A)</th><th>L (m)</th><th>ΔV %</th><th>ΔV acum. %</th><th>Tierra</th><th>Tubo</th><th class="t">Estado</th></tr></thead><tbody>
  ${r.alims.map((a, i) => `<tr${(t => (t ? ` data-fichatab="${t.tab}" title="Doble clic: ficha del tablero ${t.tab}"` : ""))(r.tabs.find(t => t.feeder === i))}><td class="t">${a.desc}</td>${r.mode === "multi" ? `<td>${a.cant ?? 1}</td>` : ""}<td>${fmt(a.P / 1000, 2)}</td><td>${a.s.txt}</td><td>${fmt(a.I, 2)}</td><td>${fmt(a.Id, 2)}${a.Imin && a.Id === a.Imin ? "*" : ""}</td><td>${a.s.tri ? 3 : 2}×${a.itm ?? "—"} A</td><td>${a.pdc ?? "—"} kA</td><td>${condTxt(a.s.n, a.S, r.c)}</td><td>${fmt(a.Izc, 1)}</td><td>${fmt(a.L, 1)}</td><td>${fmt(a.dVp, 2)}</td><td${cerca(a.dvAc, DV_ALIM)}>${fmt(a.dvAc, 2)}</td><td>${a.St} mm²</td><td>${a.tubo.mm ? a.tubo.mm + " mm" : a.tubo.pul}</td><td class="t">${pill(a.ok, "Cumple", "Revisar")}</td></tr>`).join("")}
  </tbody></table></div><div class="body"><p class="hint">* Corriente mínima del código: ${r.mode === "uni" ? "40 A (050-200(1)(b))" : "25 A por departamento (050-202(1)(b))"}. PdC: poder de corte mínimo del interruptor. En ámbar: valores al 90 % o más de su límite. Doble clic en una fila: ficha del tablero.</p></div></section>`;
}
function tablaCircuitos(r, nro) {
  let rows = "";
  const tri = !!r.bal && r.mode === "uni";
  r.tabs.forEach(tb => {
    const f = r.alims[tb.feeder],
      cs = r.circ.filter(c => c.tab === tb.tab);
    rows += `<tr class="grp" data-fichatab="${tb.tab}" title="Doble clic: ficha del tablero ${tb.tab}"><td colspan="${tri ? 17 : 16}">Tablero ${tb.tab} — ${tb.desc} · ΔV aguas arriba ${fmt(f.dvAc, 2)} % · Icc ${fmt(tb.icc, 2)} kA · PdC mínimo ${tb.pdc} kA</td></tr>`;
    cs.forEach(c => {
      rows += `<tr data-ficha="${esc(c.key)}" title="Doble clic: ficha del circuito"><td class="t"><strong>${c.id}</strong></td><td class="t">${esc(c.desc)}</td><td>${c.n}</td><td>${fmt(c.P, 0)}</td><td>${c.f3 ? "3φ" : "1φ"}</td>${tri ? `<td>${c.fase}</td>` : ""}<td>${fmt(c.I, 2)}</td><td>${fmt(c.Id, 2)}</td><td>${c.f3 ? 3 : 2}×${c.itm ?? "—"} A · ${c.curva}</td><td>${condTxt(c.f3 ? 3 : 2, c.S, r.c)}</td><td${cerca(c.I, c.Izc)}>${fmt(c.Izc, 1)}</td><td>${fmt(c.L, 0)}</td><td${cerca(c.dVp, DV_DER)}>${fmt(c.dVp, 2)}</td><td${cerca(c.dVt, DV_TOT)}>${fmt(c.dVt, 2)}</td><td>${c.St} mm²</td><td class="t">${c.idName} · ${c.f3 ? 4 : 2}×${c.idRat} A · 30 mA · ${c.idTipo || "A"}</td><td class="t">${pill(c.ok, "OK", "Revisar")}</td></tr>`;
    });
    const pre = tb.tab === "TSG" ? "S-" : "C-";
    for (let i = 1; i <= r.c.reserva; i++)
      rows += `<tr class="res"><td class="t">${pre}${cs.length + i}</td><td class="t">Reserva</td><td colspan="${tri ? 15 : 14}"></td></tr>`;
  });
  const allOk = r.circ.every(c => c.ok);
  return `<section class="card"><h2><span><span class="num">${nro}</span>Cuadro de cargas — circuitos derivados</span><span class="ref">${allOk ? pill(true, "Todos cumplen") : pill(false, "", "Revisar observaciones")}</span></h2>
  <div class="tbl-wrap"><table><thead><tr><th class="t">Circ.</th><th class="t">Descripción</th><th>Salidas</th><th>P (W)</th><th>Fases</th>${tri ? "<th>Fase</th>" : ""}<th>I (A)</th><th>Id (A)</th><th>ITM</th><th>Conductor Cu</th><th>Iz corr. (A)</th><th>L (m)</th><th>ΔV %</th><th>ΔV total %</th><th>Tierra</th><th class="t">Diferencial</th><th class="t">Estado</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="body"><p class="hint">Conductores según Tabla 2, método ${r.c.met}; corrección ${fmt(r.c.ft, 2)} (temperatura) × ${fmt(r.c.fa, 2)} (agrupamiento) = ${fmt(r.c.fc, 2)}. Diferenciales: ${r.c.idMode === "grupo" ? "uno por cada grupo de tres circuitos (150-400(8))" : "uno por circuito (150-400(9))"}. En ámbar: valores al 90 % o más de su límite (ΔV del circuito 2.5 %, ΔV total 4 %, o corriente frente a Iz corregida). Doble clic en un circuito o en la franja de un tablero: su ficha. ITM curva C en circuitos generales${r.circ.some(q => q.motor) ? "; curva D en circuitos de motores, con conductor al 125 % de la corriente a plena carga (Reglas 160-106 y 160-200)" : ""}.</p></div></section>`;
}
function cardBalance(r, nro) {
  if (!r.bal) return "";
  const b = r.bal,
    tot = b.ph[0] + b.ph[1] + b.ph[2] || 1,
    mx = Math.max(...b.ph) || 1,
    st = b.desb <= 10 ? "ok" : "warn";
  const lab = i => i.ref || `${r.tabs.length > 1 ? i.tab + " · " : ""}${i.id} · ${i.desc}`,
    fx = FIX[r.mode] || {};
  const bars = b.nm
    .map(
      (n, k) =>
        `<div class="ph"><b>${n}</b><span class="bar"><i style="width:${((b.ph[k] / mx) * 100).toFixed(1)}%"></i></span><span>${fmt(b.ph[k], 0)} W · ${fmt((b.ph[k] / tot) * 100, 1)} %</span></div>`
    )
    .join("");
  const msg =
    b.desb <= 10
      ? `Desbalance de ${fmt(b.desb, 1)} %: dentro del criterio de diseño (≤ 10 %).`
      : b.desb <= b.desbMin + 0.05
        ? `Con estas cargas el menor desbalance posible es ${fmt(b.desbMin, 1)} %. ${sugerencia(r)}`
        : `El reparto manual da ${fmt(b.desb, 1)} %; el reparto automático lograría ${fmt(b.desbMin, 1)} %. ${sugerencia(r)}`;
  const rows = b.items
    .map(i => {
      if (i.f3)
        return `<tr><td class="t">${esc(lab(i))}</td><td>${fmt(i.P, 0)}</td><td>3φ</td><td class="t"><span class="hint">Repartida en las tres fases</span></td></tr>`;
      const f = fx[i.key] || "";
      return `<tr${i.fijo ? ' class="fix"' : ""}><td class="t">${esc(lab(i))}</td><td>${fmt(i.P, 0)}</td><td><strong>${i.fase}</strong></td><td class="t"><select class="fsel" data-fase="${esc(i.key)}" aria-label="Fase de ${esc(lab(i))}"><option value="">Automático</option>${b.nm.map(n => `<option value="${n}"${f === n ? " selected" : ""}>Fijar en ${n}</option>`).join("")}</select></td></tr>`;
    })
    .join("");
  return `<section class="card"><h2><span><span class="num">${nro}</span>Balance de cargas por fase</span><span class="ref">${pillS(st, `Desbalance ${fmt(b.desb, 1)} %`)}</span></h2>
  <div class="body"><div class="phases">${bars}</div><p class="balmsg ${st}">${msg}</p>${b.nFix ? `<button type="button" class="btn sec sm" data-balreset>Restablecer automático</button>` : ""}</div>
  <div class="tbl-wrap"><table><thead><tr><th class="t">Carga</th><th>Potencia (W)</th><th>Fase</th><th class="t">Asignación</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="body"><p class="hint">«Automático» busca el reparto con el menor desbalance posible. Fije la fase de una carga y el resto se reacomoda alrededor. Desbalance = (fase más cargada − promedio) / promedio.</p></div></section>`;
}
function cardSuministro(r, nro) {
  const a0 = r.alims[0],
    md = r.mode === "uni" ? r.md.MD : r.MD;
  return `<section class="card"><h2><span><span class="num">${nro}</span>Suministro y conexión</span><span class="ref">EM.010 · Norma DGE</span></h2><div class="body"><dl class="spec">
    <dt>Potencia instalada</dt><dd>${fmt(r.CI / 1000, 2)} kW</dd><dt>Máxima demanda</dt><dd>${fmt(md / 1000, 2)} kW</dd><dt>Factor de demanda</dt><dd>${fmt(md / (r.CI || 1), 2)}</dd>
    <dt>Potencia a contratar sugerida</dt><dd>${fmt(r.contratada, 1)} kW</dd><dt>Sistema de suministro</dt><dd>${a0.s.nom}</dd><dt>Tipo de conexión</dt><dd style="white-space:normal">${r.conexion}</dd>
    <dt>Interruptor general</dt><dd>${a0.s.tri ? 3 : 2}×${a0.itm} A · ${a0.pdc} kA</dd><dt>Icc punto de entrega / TG</dt><dd>${fmt(r.c.iccE, 1)} / ${fmt(r.iccTG, 2)} kA</dd></dl></div></section>`;
}
function cardPozo(r, nro) {
  const p = r.pat;
  return `<section class="card"><h2><span><span class="num">${nro}</span>Sistema de puesta a tierra</span><span class="ref">060-702 · 060-712 · Tabla 17</span></h2><div class="body">
  <dl class="spec"><dt>Resistividad del suelo</dt><dd>${fmt(p.rho, 0)} Ω·m</dd><dt>Varilla de cobre</dt><dd>${fmt(p.Lv, 2)} m · Ø ${fmt(p.dv * 1000, 1)} mm</dd>
  <dt>Resistencia sin tratamiento</dt><dd>${fmt(p.Rv, 2)} Ω</dd><dt>Resistencia con tratamiento</dt><dd>${fmt(p.Rt, 2)} Ω ${pill(p.ok, "≤ 25 Ω", "> 25 Ω")}</dd>
  ${p.nVar > 1 ? `<dt>Electrodos requeridos</dt><dd>${p.nVar} varillas · ≈ ${fmt(p.Rn, 2)} Ω</dd>` : ""}
  <dt>Conductor de puesta a tierra</dt><dd>${r.Selec} mm² Cu</dd></dl></div></section>`;
}
function cardAlertas(r, nro) {
  return `<section class="card"><h2><span><span class="num">${nro}</span>Verificaciones normativas</span></h2><div class="body"><ul class="alerts">${alertas(
    r
  )
    .map(
      ([ok, ref, t]) =>
        `<li class="${ok === true ? "ok" : ok === "warn" ? "warn" : "bad"}"><b>${ref}</b><span>${t}</span></li>`
    )
    .join("")}</ul></div></section>`;
}
// Recomendaciones de diseño: avisos que el proyectista revisa y acepta; no detienen el cálculo
function cardRecom(r) {
  const R = recomendaciones(r),
    ac = ACEP[r.mode] || {},
    pend = R.filter(x => !ac[x.id]).length;
  const f = d => {
    const x = new Date(d);
    return isNaN(x) ? "" : x.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  };
  const li = x => {
    const a = ac[x.id];
    return `<li class="${x.tipo}${a ? " acep" : ""}"><div class="rec-h"><span class="rec-t">${x.tipo === "sobre" ? "Posible sobredimensionamiento" : "Criterio ajustado"}</span><b>${esc(x.tit)}</b></div>
    <p>${esc(x.txt)}</p><p class="rec-s"><b>Sugerencia:</b> ${esc(x.sug)}</p>
    <div class="rec-a">${x.ir ? `<button type="button" class="btn sm" ${x.ir.act ? `data-act="${x.ir.act}"` : x.ir.foco ? `data-foco="${x.ir.foco}"` : x.ir.node ? `data-node="${esc(x.ir.node)}"` : `data-view="${x.ir.view}"`}>${esc(x.ir.lab)} →</button>` : ""}${
      a
        ? `<span class="pill ok">Aceptada${f(a) ? " · " + f(a) : ""}</span><button type="button" class="linkbtn" data-recundo="${esc(x.id)}">Deshacer</button>`
        : `<button type="button" class="btn sm sec" data-recacep="${esc(x.id)}">Entendido, lo acepto</button>`
    }</div></li>`;
  };
  return `<section class="card rec-card"><h2><span>Recomendaciones de diseño</span><span class="ref">${R.length ? `${pend} pendiente${pend !== 1 ? "s" : ""} · ${R.length - pend} aceptada${R.length - pend !== 1 ? "s" : ""}` : "Sin observaciones"}</span></h2><div class="body">
    <p class="hint">No son incumplimientos de la norma (esos aparecen en Verificaciones normativas). Señalan decisiones que pueden llevar a conductores mayores de lo necesario o dejar poco margen. Revise cada una y acéptela si la decisión es intencional; el cálculo no cambia.</p>
    ${R.length ? `<ul class="recs">${R.map(li).join("")}</ul>` : `<p class="hint">Los criterios del proyecto están dentro de los valores usuales de diseño.</p>`}</div></section>`;
}
function cardDemanda(r) {
  let html = "";
  // Otros usos (Regla 050-210 y Tabla 14): carga por área con factor de demanda más cargas especiales a potencia nominal
  if (r.mode === "uni" && r.viv === false) {
    const m = r.md,
      U = m.U,
      PT = r.PS.filter(p => p.md);
    const ext = `dimensiones exteriores${r.sot > 0 ? " (incluye sótano)" : ""}`;
    if (U.regla) {
      // Escuelas, hospitales y hoteles: el factor de demanda se aplica a la carga por área más las cargas especiales
      const filasA = U.wE
        ? U.resta
          ? [
              [`Aulas · ${fmt(m.aE, 1)} m² × ${U.wE} W/m²`, m.aE * U.wE],
              [`Resto del edificio · ${fmt(m.area - m.aE, 1)} m² × ${U.w} W/m²`, (m.area - m.aE) * U.w]
            ]
          : [
              [`Edificio · ${fmt(m.area, 1)} m² × ${U.w} W/m²`, m.area * U.w],
              [`Alta intensidad · ${fmt(m.aE, 1)} m² × ${U.wE} W/m²`, m.aE * U.wE]
            ]
        : [[`Edificio · ${fmt(m.area, 1)} m² × ${U.w} W/m²`, m.area * U.w]];
      html += `<section class="card"><h2><span><span class="num"></span>Máxima demanda · ${esc(U.n)}</span><span class="ref">Regla ${U.regla}</span></h2><div class="tbl-wrap"><table>
        <thead><tr><th class="t">Concepto</th><th class="t">Criterio</th><th>Instalada (W)</th><th>Demanda (W)</th></tr></thead><tbody>
        ${filasA.map(([a, v]) => `<tr><td class="t">${a}</td><td class="t">Regla ${U.regla}(1) · ${ext}</td><td>${fmt(v, 0)}</td><td>—</td></tr>`).join("")}
        <tr><td class="t">Cargas especiales</td><td class="t">Potencia nominal del equipo · Regla ${U.regla}(1)</td><td>${fmt(m.esp, 0)}</td><td>—</td></tr>
        <tr><td class="t"><b>Carga total</b></td><td class="t">Carga por área + cargas especiales</td><td><b>${fmt(m.total, 0)}</b></td><td>—</td></tr>
        ${m.tramos.map((t, i) => `<tr><td class="t">Factor de demanda · ${fmt(t.a, 1)} m²</td><td class="t">${t.fal} % ${m.tramos.length === 1 ? "(edificación hasta 900 m²)" : i === 0 ? "(primeros 900 m², según la carga por m²)" : "(exceso sobre 900 m²)"} · Regla ${U.regla}(2)</td><td>${fmt(t.inst, 0)}</td><td>${fmt(t.d, 0)}</td></tr>`).join("")}
        ${r.md.libre > 0 ? `<tr><td class="t">Áreas libres no techadas · ${fmt(r.c.aLib, 1)} m² × ${fmt(r.c.wLib, 1)} W/m²</td><td class="t">Criterio del proyectista (no indicado en el CNE) · al 100 %</td><td>${fmt(r.md.libre, 0)}</td><td>${fmt(r.md.libre, 0)}</td></tr>` : ""}<tr class="total"><td class="t" colspan="3">Máxima demanda</td><td>${fmt(m.MD, 0)}</td></tr></tbody></table></div>
        <div class="body"><p class="hint">A diferencia de la Tabla 14, en esta regla el factor de demanda se aplica a toda la carga, incluidas las cargas especiales (aire acondicionado, equipos, alumbrado especial); solo la calefacción se rige por la Sección 270. No se aplica la corriente mínima de 40 A, propia de viviendas; la carga de los alimentadores se considera continua (Regla 050-104(3)) y su corriente de diseño es 1.25 × I.</p></div></section>`;
    } else
      html += `<section class="card"><h2><span><span class="num"></span>Máxima demanda · ${esc(U.n)}</span><span class="ref">050-210 · Tabla 14</span></h2><div class="tbl-wrap"><table>
      <thead><tr><th class="t">Concepto</th><th class="t">Criterio</th><th>Instalada (W)</th><th>Demanda (W)</th></tr></thead><tbody>
      <tr><td class="t">Carga por área · ${fmt(r.area, 1)} m² × ${U.w} W/m²</td><td class="t">Tabla 14 · ${ext}</td><td>${fmt(m.carga, 0)}</td><td>—</td></tr>
      ${m.tramos.map(t => `<tr><td class="t">Factor de demanda · ${fmt(t.a, 1)} m²</td><td class="t">${t.fal} % (alimentadores; acometida ${t.fac} %)</td><td>${fmt(t.inst, 0)}</td><td>${fmt(t.d, 0)}</td></tr>`).join("")}
      <tr><td class="t">Cargas especiales</td><td class="t">Potencia nominal del equipo · 050-210(b)</td><td>${fmt(m.esp, 0)}</td><td>${fmt(m.esp, 0)}</td></tr>
      ${r.md.libre > 0 ? `<tr><td class="t">Áreas libres no techadas · ${fmt(r.c.aLib, 1)} m² × ${fmt(r.c.wLib, 1)} W/m²</td><td class="t">Criterio del proyectista (no indicado en el CNE) · al 100 %</td><td>${fmt(r.md.libre, 0)}</td><td>${fmt(r.md.libre, 0)}</td></tr>` : ""}<tr class="total"><td class="t" colspan="3">Máxima demanda</td><td>${fmt(m.MD, 0)}</td></tr></tbody></table></div>
      <div class="body"><p class="hint">Los factores de la Tabla 14 se aplican a la carga por área; las cargas especiales (equipos, aire acondicionado, vitrinas, cómputo) se suman a su potencia nominal. No se aplica la corriente mínima de 40 A de la Regla 050-200(1)(b), propia de viviendas; la carga de los alimentadores se considera continua (Regla 050-104(3)) y su corriente de diseño es 1.25 × I.</p></div></section>`;
    if (PT.length)
      html += `<section class="card"><h2><span><span class="num"></span>Máxima demanda por piso · tableros de distribución</span><span class="ref">${U.regla ? "Regla " + U.regla : "050-210"} por piso</span></h2><div class="tbl-wrap"><table>
      <thead><tr><th class="t">Piso</th><th class="t">Tablero</th><th>Área (m²)</th><th>Carga por área (W)</th><th>Cargas especiales (W)</th><th>MD piso (W)</th><th>I (A)</th></tr></thead><tbody>
      ${PT.map(p => `<tr><td class="t"><strong>${ORD(p.n)} piso</strong></td><td class="t">${p.tab}</td><td>${fmt(p.areaC, 1)}</td><td>${fmt(p.md.carga, 0)}</td><td>${fmt(p.md.esp, 0)}</td><td><strong>${fmt(p.md.MD, 0)}</strong></td><td>${fmt(r.alims[p.feeder].I, 2)}</td></tr>`).join("")}
      </tbody></table></div></section>`;
    return html;
  }
  if (r.mode === "uni") {
    const m = r.md;
    html += `<section class="card"><h2><span><span class="num"></span>Máxima demanda de la vivienda</span><span class="ref">050-110 · 050-200</span></h2><div class="tbl-wrap"><table>
      <thead><tr><th class="t">Concepto</th><th class="t">Criterio</th><th>Instalada (W)</th><th>Demanda (W)</th></tr></thead><tbody>
      <tr><td class="t">Carga básica · ${fmt(r.area, 1)} m² de vivienda</td><td class="t">Primeros 90 m² y cada 90 m² adicionales</td><td>—</td><td>${fmt(m.basica, 0)}</td></tr>
      <tr><td class="t">Cocina eléctrica</td><td class="t">Valor fijo y exceso sobre 12 kW</td><td>${fmt(m.coc, 0)}</td><td>${fmt(m.mdCoc, 0)}</td></tr>
      <tr><td class="t">Calentadores de agua / duchas</td><td class="t">Al 100 %</td><td>${fmt(m.cal, 0)}</td><td>${fmt(m.cal, 0)}</td></tr>
      <tr><td class="t">Aire acondicionado</td><td class="t">Al 100 %</td><td>${fmt(m.aire, 0)}</td><td>${fmt(m.aire, 0)}</td></tr>
      <tr><td class="t">Otras cargas mayores de 1 500 W</td><td class="t">${m.coc > 0 ? "Al 25 % (existe cocina)" : "Al 100 % hasta 6 kW y 25 % del exceso"}</td><td>${fmt(m.otras, 0)}</td><td>${fmt(m.mdOtras, 0)}</td></tr>
      ${r.md.libre > 0 ? `<tr><td class="t">Áreas libres no techadas · ${fmt(r.c.aLib, 1)} m² × ${fmt(r.c.wLib, 1)} W/m²</td><td class="t">Criterio del proyectista (no indicado en el CNE) · al 100 %</td><td>${fmt(r.md.libre, 0)}</td><td>${fmt(r.md.libre, 0)}</td></tr>` : ""}<tr class="total"><td class="t" colspan="3">Máxima demanda</td><td>${fmt(m.MD, 0)}</td></tr></tbody></table></div></section>`;
    const PT = r.PS.filter(p => p.md);
    if (PT.length)
      html += `<section class="card"><h2><span><span class="num"></span>Máxima demanda por piso · tableros de distribución</span><span class="ref">050-200 por piso</span></h2><div class="tbl-wrap"><table>
      <thead><tr><th class="t">Piso</th><th class="t">Tablero</th><th>Área (m²)</th><th>Carga básica</th><th>Cocina</th><th>Calentador</th><th>Aire acond.</th><th>Otras &gt;1,5 kW</th><th>MD piso (W)</th><th>I (A)</th></tr></thead><tbody>
      ${PT.map(p => `<tr><td class="t"><strong>${ORD(p.n)} piso</strong></td><td class="t">${p.tab}</td><td>${fmt(p.areaC, 1)}</td><td>${fmt(p.md.basica, 0)}</td><td>${fmt(p.md.mdCoc, 0)}</td><td>${fmt(p.md.cal, 0)}</td><td>${fmt(p.md.aire, 0)}</td><td>${fmt(p.md.mdOtras, 0)}</td><td><strong>${fmt(p.md.MD, 0)}</strong></td><td>${fmt(r.alims[p.feeder].I, 2)}</td></tr>`).join("")}
      </tbody></table></div><div class="body"><p class="hint">Cada alimentador TG → TD se dimensiona con la Regla 050-200 aplicada al área del piso y a las cargas especiales conectadas a su tablero${r.sot > 0 && r.esq === "td" ? "; el sótano, al 75 %, se asigna al 1er piso" : ""}. El alimentador general mantiene la máxima demanda de toda la vivienda.${r.esq === "tg" ? " Los circuitos del 1er piso salen directamente del tablero general TG." : ""}</p></div></section>`;
  } else {
    html += `<section class="card"><h2><span><span class="num"></span>Carga por unidad de vivienda</span><span class="ref">050-202(1)</span></h2><div class="tbl-wrap"><table>
      <thead><tr><th class="t">Tipo</th><th>Unid.</th><th>Área (m²)</th><th>Carga básica</th><th>Cocina</th><th>Calentador</th><th>Aire acond.</th><th>Otras &gt;1,5 kW</th><th>MD unidad (W)</th><th>I (A)</th></tr></thead><tbody>
      ${r.T.map(t => `<tr><td class="t"><strong>${esc(t.nombre)}</strong></td><td>${t.cant}</td><td>${fmt(t.area, 0)}</td><td>${fmt(t.md.basica, 0)}</td><td>${fmt(t.md.mdCoc, 0)}</td><td>${fmt(t.md.cal, 0)}</td><td>${fmt(t.md.aire, 0)}</td><td>${fmt(t.md.mdOtras, 0)}</td><td><strong>${fmt(t.md.MD, 0)}</strong></td><td>${fmt(t.md.MD / (220 * r.c.fp), 2)}</td></tr>`).join("")}
      </tbody></table></div></section>`;
    html += `<div class="two"><section class="card"><h2><span><span class="num"></span>Máxima demanda del edificio</span><span class="ref">050-202(3)</span></h2><div class="tbl-wrap"><table>
      <thead><tr><th class="t">Tramo</th><th>Unid.</th><th>Carga (W)</th><th>Factor</th><th>Demanda (W)</th></tr></thead><tbody>
      ${r.tramos.map(t => `<tr><td class="t">${t.lab}</td><td>${t.n}</td><td>${fmt(t.sum, 0)}</td><td>${fmt(t.f * 100, 0)} %</td><td>${fmt(t.dem, 0)}</td></tr>`).join("")}
      <tr><td class="t">Aire acondicionado</td><td></td><td>${fmt(r.aireTot, 0)}</td><td>100 %</td><td>${fmt(r.aireTot, 0)}</td></tr>
      <tr><td class="t">Cargas comunes (servicios generales)</td><td></td><td>${fmt(r.Pserv, 0)}</td><td>75 %</td><td>${fmt(r.mdServ, 0)}</td></tr>
      <tr class="total"><td class="t" colspan="4">Máxima demanda del edificio</td><td>${fmt(r.MD, 0)}</td></tr></tbody></table></div></section>
      <section class="card"><h2><span><span class="num"></span>Servicios generales</span><span class="ref">Tablero TSG</span></h2><div class="tbl-wrap"><table>
      <thead><tr><th class="t">Carga común</th><th>Fases</th><th>P (W)</th></tr></thead><tbody>
      ${r.SV.map(s => `<tr><td class="t">${esc(s.nombre)}</td><td>${s.fases === 3 && SIST[r.sk].tri ? "3φ" : "1φ"}</td><td>${fmt(s.p, 0)}</td></tr>`).join("") || `<tr><td class="t" colspan="3">Sin cargas comunes</td></tr>`}
      <tr class="total"><td class="t" colspan="2">Potencia total</td><td>${fmt(r.Pserv, 0)}</td></tr>
      ${r.maxMot > 0 ? `<tr><td class="t" colspan="2">Diseño del alimentador TSG (+25 % del mayor motor)</td><td>${fmt(r.Pserv + 0.25 * r.maxMot, 0)}</td></tr>` : ""}</tbody></table></div></section></div>`;
  }
  return html;
}
