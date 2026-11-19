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
   · En la vista «Presupuesto» (Resultados › Vistas) los precios y porcentajes se escriben en la tabla y los totales
     cambian al instante; el Excel lleva la hoja «Presupuesto» (js/exportar/excel-presupuesto.js) cuando hay precios. */
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
   subtotal de cada título, CD, GG, utilidad, subtotal, IGV y total; nP de nT partidas tienen precio */
function preCalc(r, M = metrado(r), completar = true) {
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
      pu = PRESU.p[x.desc] ?? null,
      par = pu === null ? null : r2(q * pu);
    nT++;
    if (par !== null) {
      nP++;
      cd += par;
      if (sec) sec.sub += par;
    }
    filas.push({ ...x, desp, q, pu, par, rec: PRESU.r[x.desc] || "", i: filas.length });
  });
  cd = r2(cd);
  const gg = r2((cd * PRESU.gg) / 100),
    ut = r2((cd * PRESU.ut) / 100),
    sub = r2(cd + gg + ut),
    igv = r2((sub * PRESU.igv) / 100);
  return { filas, d, cd, gg, ut, sub, igv, tot: r2(sub + igv), nP, nT };
}
// El proyecto tiene precios (para el Excel y la impresión)
const presuHay = r => preCalc(r).nP > 0;

/* ---------- Vista «Presupuesto» ---------- */
let PRE_F = [];
function preEstadoTxt(C) {
  return `${C.nP} de ${C.nT} partidas con precio unitario${C.nT > C.nP ? ` · faltan ${C.nT - C.nP}: no suman al costo directo` : ""}`;
}
function cardPresupuesto(r) {
  const C = preCalc(r);
  PRE_F = C.filas;
  const pct = (k, t, ref) =>
    `<tr><td class="t">${t} <input type="number" class="pre-pct" min="0" max="100" step="0.5" data-prepct="${k}" value="${PRESU[k]}"> %<small>${ref}</small></td><td id="pre_${k}">${soles(C[k])}</td></tr>`;
  return `<section class="card pre-card"><h2><span>Presupuesto de instalaciones eléctricas</span><span class="ref">Referencial · S/</span></h2>
  <div class="body pre-cab"><p class="pre-st${C.nT > C.nP ? " w" : ""}" id="preSt">${preEstadoTxt(C)}</p><p class="hint">Escriba el precio unitario de cada partida (materiales y mano de obra). Desperdicio en tuberías y conductores: <b>${fmt(C.d * 100, 0)} %</b> (Parámetros › Tierra y metrado).</p></div>
  <div class="tbl-wrap"><table class="pre-tab"><thead><tr><th class="t">Ítem</th><th class="t">Descripción</th><th>Und.</th><th>Metrado</th><th>Desp.</th><th>Cantidad</th><th>P. U. (S/)</th><th>Parcial (S/)</th></tr></thead><tbody>
  ${C.filas
    .map(x =>
      x.sec
        ? `<tr class="grp"><td colspan="7">${x.cod}  ${x.sec}</td><td class="n" data-psub="${x.i}">${x.sub ? soles(r2(x.sub)) : ""}</td></tr>`
        : `<tr><td class="t">${x.cod}</td><td class="t" style="white-space:normal">${esc(x.desc)}</td><td>${x.und}</td><td>${fmt(x.cant, 0)}</td><td>${x.desp ? `${fmt(x.desp * 100, 0)} %` : "—"}</td><td>${fmt(x.q, x.q % 1 ? 2 : 0)}</td><td class="pre-pu"><input type="number" min="0" step="0.01" data-pre="${x.i}" value="${x.pu ?? ""}" placeholder="—" aria-label="Precio unitario de ${esc(x.desc)}">${x.rec ? `<i class="pre-rec" data-prec="${x.i}" title="Precio recordado de su proyecto «${esc(x.rec)}». Al cambiarlo queda como propio de este proyecto.">recordado</i>` : ""}</td><td class="n" data-ppar="${x.i}">${soles(x.par)}</td></tr>`
    )
    .join("")}
  </tbody></table></div>
  <div class="body pre-pie"><table class="pre-tot"><tbody>
  <tr><td class="t"><b>Costo directo</b></td><td id="pre_cd"><b>${soles(C.cd)}</b></td></tr>
  ${pct("gg", "Gastos generales", "criterio del proyectista")}
  ${pct("ut", "Utilidad", "criterio del proyectista")}
  <tr class="sub"><td class="t">Subtotal</td><td id="pre_sub">${soles(C.sub)}</td></tr>
  ${pct("igv", "IGV", "16 % IGV + 2 % IPM, vigente")}
  <tr class="tot"><td class="t">Total presupuesto (S/)</td><td id="pre_tot">${soles(C.tot)}</td></tr>
  </tbody></table>
  <p class="hint">Presupuesto referencial: las cantidades salen del metrado (partidas de la Norma Técnica de Metrados, R.D. N.° 073-2010-VIVIENDA) y los precios unitarios los pone el proyectista; se guardan en el proyecto. Una partida sin precio toma el último que usted le puso en otro proyecto (marcado «recordado») hasta que lo cambie. En tuberías y conductores, la cantidad suma el desperdicio al metrado neto. Gastos generales y utilidad son porcentajes del costo directo (criterio del proyectista); el IGV se aplica al subtotal. Con precios, se incluye en la hoja «Presupuesto» del Excel.</p></div></section>`;
}
// Totales en pantalla sin volver a dibujar la tabla (el cursor sigue en el campo)
function preRefrescar() {
  if (!LAST || !$("preSt")) return;
  const C = preCalc(LAST, metrado(LAST), false);
  PRE_F = C.filas;
  C.filas.forEach(x => {
    const el = document.querySelector(x.sec ? `[data-psub="${x.i}"]` : `[data-ppar="${x.i}"]`);
    if (el) el.textContent = x.sec ? (x.sub ? soles(r2(x.sub)) : "") : soles(x.par);
  });
  ["gg", "ut", "igv"].forEach(k => ($("pre_" + k).textContent = soles(C[k])));
  $("pre_cd").innerHTML = `<b>${soles(C.cd)}</b>`;
  $("pre_sub").textContent = soles(C.sub);
  $("pre_tot").textContent = soles(C.tot);
  $("preSt").textContent = preEstadoTxt(C);
  $("preSt").classList.toggle("w", C.nT > C.nP);
}
let PRE_T = null;
document.addEventListener("input", e => {
  const t = e.target;
  if (!t.closest || !t.closest(".pre-card")) return;
  const v = t.value.trim() === "" ? null : Number(t.value);
  if (t.dataset.pre !== undefined) {
    const x = PRE_F[+t.dataset.pre];
    if (!x || x.sec) return;
    if (v === null || !Number.isFinite(v) || v < 0) PRESU.p[x.desc] = null;
    else PRESU.p[x.desc] = Math.min(v, 1e9);
    // Escrito por el proyectista: ya no es «recordado»
    delete PRESU.r[x.desc];
    const m = document.querySelector(`[data-prec="${t.dataset.pre}"]`);
    if (m) m.remove();
  } else if (t.dataset.prepct) {
    PRESU[t.dataset.prepct] = v === null || !Number.isFinite(v) ? 0 : Math.max(0, Math.min(100, v));
  } else return;
  preRefrescar();
  clearTimeout(PRE_T);
  PRE_T = setTimeout(() => {
    saveDraft();
    if (typeof histPush === "function") histPush();
  }, 500);
});
