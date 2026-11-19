/* PRESUPUESTO
   Presupuesto referencial de las instalaciones eléctricas: cada partida del metrado (js/resultados/metrado.js) por su precio
   unitario en soles, que pone el proyectista. Costo directo (CD) = suma de parciales; gastos generales y utilidad,
   en % del CD (criterio del proyectista, editables); subtotal; IGV sobre el subtotal (18 % vigente: 16 % de IGV
   más 2 % del Impuesto de Promoción Municipal; editable); total.
   · El metrado es neto: en conductores y tuberías el desperdicio de Parámetros (pDesp) se suma a la cantidad que
     se presupuesta (cantidad = metrado × (1 + desperdicio)); el resto de partidas va tal cual.
   · Los precios se guardan en el proyecto (PRESU.p, por la descripción de la partida). Una partida sin precio toma
     el último que el proyectista le puso en otro de sus proyectos (el guardado más reciente que la tenga) y queda
     marcada como «recordado» (PRESU.r) hasta que se cambie. Un precio borrado queda como null: «sin precio» a
     propósito, y ya no toma el recordado.
   · La vista «Presupuesto» (Resultados) es el documento: encabezado del proyecto, partidas con sus subtotales,
     resumen y el total en letras. Los precios y porcentajes se escriben en la ventana Precios unitarios
     (js/ventanas/precios.js), con vista previa hasta aplicar; el Excel lleva la hoja «Presupuesto» (js/exportar/excel-presupuesto.js) cuando hay precios. */
const PRE_DEF = { gg: 10, ut: 10, igv: 18 };
const presuVacio = () => ({ p: {}, r: {}, ...PRE_DEF });
let PRESU = presuVacio();
// Precios válidos del proyecto (al abrir o importar): números de 0 a mil millones, porcentajes de 0 a 100
function presuValido(v) {
  const o = presuVacio(),
    num = (x, a, b) => typeof x === "number" && Number.isFinite(x) && x >= a && x <= b,
    clave = k => k.length <= 400 && k !== "__proto__";
  if (!v || typeof v !== "object") return o;
  if (v.p && typeof v.p === "object")
    Object.entries(v.p).forEach(([k, x]) => {
      if (clave(k) && (x === null || num(x, 0, 1e9))) o.p[k] = x;
    });
  if (v.r && typeof v.r === "object")
    Object.entries(v.r).forEach(([k, x]) => {
      if (clave(k) && typeof o.p[k] === "number" && typeof x === "string")
        o.r[k] = x.replace(/[<>]/g, "").slice(0, 120);
    });
  ["gg", "ut", "igv"].forEach(k => {
    if (num(v[k], 0, 100)) o[k] = v[k];
  });
  return o;
}
const r2 = v => Math.round(v * 100) / 100;
const soles = v =>
  v == null || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Partidas a las que se suma el desperdicio: tuberías (OE.5.2.2) y conductores (OE.5.2.3)
const preConDesp = x => /^OE\.5\.2\.[23]\./.test(x.cod);
// Precios que el proyectista ya usó: de sus otros proyectos, el más reciente que tenga cada partida
function preMemoria() {
  const m = new Map();
  Object.values(typeof libLoad === "function" ? libLoad() : {})
    .filter(o => o && o.id && o.id !== PID && o.PRESU && o.PRESU.p && typeof o.PRESU.p === "object")
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
    .forEach(o =>
      Object.entries(o.PRESU.p).forEach(([k, v]) => {
        if (!m.has(k) && typeof v === "number" && v > 0) m.set(k, { v, n: o.p_nombre || "sin nombre" });
      })
    );
  return m;
}
// Partidas sin precio: toman el recordado; si alguna lo tomó, el proyecto se guarda
function preCompletar(M) {
  const falta = M.filter(x => !x.sec && PRESU.p[x.desc] === undefined);
  if (!falta.length) return false;
  const mem = preMemoria();
  let cambio = false;
  falta.forEach(x => {
    const y = mem.get(x.desc);
    if (!y) return;
    PRESU.p[x.desc] = y.v;
    PRESU.r[x.desc] = y.n;
    cambio = true;
  });
  if (cambio && typeof saveDraft === "function") setTimeout(saveDraft, 0);
  return cambio;
}
/* Cálculo del presupuesto de un resultado: filas (las del metrado con cantidad a presupuestar, precio y parcial),
   subtotal de cada título, CD, GG, utilidad, subtotal, IGV y total; nP de nT partidas tienen precio. P: los precios
   (los del proyecto o, en la ventana Precios unitarios, los del proyecto con los cambios aún sin aplicar). */
function preCalc(r, M = metrado(r), completar = true, P = PRESU) {
  if (completar) preCompletar(M);
  const d = Math.max(0, +r.c.pDesp || 0) / 100,
    filas = [];
  let sec = null,
    cd = 0,
    nP = 0,
    nT = 0;
  M.forEach(x => {
    if (x.sec) {
      sec = { ...x, sub: 0, i: filas.length };
      return filas.push(sec);
    }
    const desp = preConDesp(x) ? d : 0,
      q = r2(x.cant * (1 + desp)),
      pu = P.p[x.desc] ?? null,
      par = pu === null ? null : r2(q * pu);
    nT++;
    if (par !== null) {
      nP++;
      cd += par;
      if (sec) sec.sub += par;
    }
    filas.push({ ...x, desp, q, pu, par, rec: P.r[x.desc] || "", i: filas.length });
  });
  cd = r2(cd);
  const gg = r2((cd * P.gg) / 100),
    ut = r2((cd * P.ut) / 100),
    sub = r2(cd + gg + ut),
    igv = r2((sub * P.igv) / 100);
  return { filas, d, cd, gg, ut, sub, igv, tot: r2(sub + igv), nP, nT, P };
}
// El proyecto tiene precios (para el Excel y la impresión)
const presuHay = r => preCalc(r).nP > 0;

/* Monto en letras, como se escribe al pie de un presupuesto: «SON: DOCE MIL TRESCIENTOS CUATRO CON 50/100 SOLES» */
function solesLetras(v) {
  const U = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE"]
      .concat(["TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE"])
      .concat(["VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE"])
      .concat(["VEINTIOCHO", "VEINTINUEVE"]),
    D = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"],
    C = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS"].concat(
      ["OCHOCIENTOS", "NOVECIENTOS"]
    );
  const cien = n => {
    if (n === 100) return "CIEN";
    const c = Math.floor(n / 100),
      r = n % 100,
      dd = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " Y " + U[r % 10] : "");
    return [C[c], dd].filter(Boolean).join(" ");
  };
  // «UNO» delante de mil o millones se dice «UN» (veintiún mil, un millón)
  const apoc = s => s.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");
  const entero = n => {
    if (n === 0) return "CERO";
    const mill = Math.floor(n / 1e6),
      miles = Math.floor((n % 1e6) / 1000),
      resto = n % 1000,
      p = [];
    if (mill) p.push(mill === 1 ? "UN MILLÓN" : apoc(entero(mill)) + " MILLONES");
    if (miles) p.push(miles === 1 ? "MIL" : apoc(cien(miles)) + " MIL");
    if (resto) p.push(cien(resto));
    return p.join(" ");
  };
  const t = Math.round(Math.max(0, v) * 100),
    e = Math.floor(t / 100),
    c = t % 100;
  return `SON: ${entero(e)} CON ${String(c).padStart(2, "0")}/100 SOLES`;
}

/* ---------- Vista «Presupuesto»: el documento, como se presenta en un expediente ----------
   Los precios unitarios y los porcentajes se escriben en la ventana Precios unitarios (js/ventanas/precios.js). */
function cardPresupuesto(r) {
  const C = preCalc(r),
    j = r.c.proj || {},
    hoy = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" }),
    falta = C.nT - C.nP,
    dato = (k, v) => `<div><dt>${k}</dt><dd>${v ? esc(v) : "—"}</dd></div>`,
    pct = (t, v, ref) =>
      `${t} <span class="pre-p">(${fmt(v, v % 1 ? 1 : 0)} %)</span>${ref ? `<small>${ref}</small>` : ""}`;
  const filas = C.filas
    .map(x =>
      x.sec
        ? `<tr class="pre-sec"><td class="t">${x.cod}</td><td class="t" colspan="4">${esc(x.sec)}</td><td class="n">${x.sub ? soles(r2(x.sub)) : ""}</td></tr>`
        : `<tr${x.pu === null ? ' class="pre-sin"' : ""}><td class="t">${x.cod}</td><td class="t pre-d">${esc(x.desc)}${x.desp ? `<small>Metrado ${fmt(x.cant, x.cant % 1 ? 2 : 0)} ${x.und} + ${fmt(x.desp * 100, 0)} % de desperdicio</small>` : ""}</td><td>${x.und}</td><td class="n">${fmt(x.q, x.q % 1 ? 2 : 0)}</td><td class="n">${x.pu === null ? '<span class="pre-falta">sin precio</span>' : soles(x.pu)}</td><td class="n">${soles(x.par)}</td></tr>`
    )
    .join("");
  return `<section class="card pre-doc"><h2><span>Presupuesto referencial de instalaciones eléctricas</span><span class="ref"><button type="button" class="btn sm" data-act="precios" title="Escribir los precios unitarios y los porcentajes">Precios unitarios…</button></span></h2>
  <div class="body pre-cab"><dl class="pre-datos">${dato("Proyecto", j.nombre)}${dato("Propietario", j.prop)}${dato("Ubicación", j.ubic)}${dato("Fecha", hoy)}${dato("Moneda", "Soles (S/)")}</dl>
  ${falta ? `<div class="pre-aviso"><span><b>${falta} de ${C.nT} partidas sin precio unitario:</b> no suman al costo directo.</span><button type="button" class="btn sm" data-act="precios">Completar precios</button></div>` : ""}</div>
  <div class="tbl-wrap"><table class="pre-tab"><thead><tr><th class="t">Ítem</th><th class="t">Descripción</th><th>Und.</th><th>Cantidad</th><th>Precio (S/)</th><th>Parcial (S/)</th></tr></thead><tbody>${filas}</tbody></table></div>
  <div class="body pre-pie"><table class="pre-tot"><tbody>
  <tr><td class="t">Costo directo</td><td>${soles(C.cd)}</td></tr>
  <tr><td class="t">${pct("Gastos generales", PRESU.gg, "criterio del proyectista")}</td><td>${soles(C.gg)}</td></tr>
  <tr><td class="t">${pct("Utilidad", PRESU.ut, "criterio del proyectista")}</td><td>${soles(C.ut)}</td></tr>
  <tr class="sub"><td class="t">Subtotal</td><td>${soles(C.sub)}</td></tr>
  <tr><td class="t">${pct("IGV", PRESU.igv, "16 % IGV + 2 % IPM")}</td><td>${soles(C.igv)}</td></tr>
  <tr class="tot"><td class="t">Total presupuesto</td><td>S/ ${soles(C.tot)}</td></tr>
  </tbody></table>
  <p class="pre-letras">${solesLetras(C.tot)}</p>
  <p class="hint">Presupuesto referencial. Las cantidades salen del metrado (partidas de la Norma Técnica de Metrados, R.D. N.° 073-2010-VIVIENDA); en tuberías y conductores suman el desperdicio de Parámetros (${fmt(C.d * 100, 0)} %). Los precios unitarios (materiales y mano de obra) los pone el proyectista en <b>Precios unitarios</b> y se guardan en el proyecto; una partida sin precio toma el último que usted le puso en otro proyecto («recordado»). Gastos generales y utilidad son porcentajes del costo directo (criterio del proyectista); el IGV se aplica al subtotal. Con precios, se incluye en la hoja «Presupuesto» del Excel.</p></div></section>`;
}
