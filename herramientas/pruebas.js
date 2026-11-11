/* Pruebas del cálculo sin navegador («npm test»).
   Carga en un contexto aislado de Node los archivos del motor (tablas del CNE, datos, cálculo, metrado y la
   preparación de proyectos) y, para cada caso de pruebas/casos.js, calcula el proyecto con proyectoDe() y
   calcular(), y compara el resultado completo con la referencia guardada (pruebas/referencia.js), con el mismo
   criterio que pruebas/index.html. El contexto (motor y valores por defecto) lo prepara herramientas/contexto.js. */
const vm = require("vm");
const { crearContexto } = require("./contexto.js");

const { ctx, cargar } = crearContexto();
cargar("pruebas/casos.js");
cargar("pruebas/referencia.js");

// Resultado completo de un caso, igual que resumen() de pruebas/index.html
const resumen = r =>
  vm.runInContext(
    `(r => {
      const red = (k, v) => (typeof v === "number" ? +v.toFixed(6) : v);
      const o = JSON.parse(JSON.stringify(r, red));
      delete o.PS; delete o.varios; delete o.esq; if (o.c) delete o.c.proj;
      o.metrado = JSON.parse(JSON.stringify(metrado(r), red));
      o.alertas = alertas(r);
      o.recomendaciones = recomendaciones(r).map(x => [x.tipo, x.id, x.txt]);
      return o;
    })`,
    ctx
  )(r);
/* Diferencias con la misma tolerancia que pruebas/index.html. Con --ignorar=campo1,campo2 no se cuentan esos
   campos (por ejemplo, datos nuevos agregados a propósito), para ver si cambió algún valor del cálculo. */
const IGN = new Set(
    ((process.argv.find(a => a.startsWith("--ignorar=")) || "").slice(10) || "").split(",").filter(Boolean)
  ),
  TODO = process.argv.includes("--todo");
function diferencias(a, b, ruta = "", out = []) {
  if (!TODO && out.length >= 10) return out;
  if (IGN.has(ruta.split(/[.[]/).pop().replace("]", ""))) return out;
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a))) out.push([ruta, a, b]);
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    [...new Set([...Object.keys(a), ...Object.keys(b)])].forEach(k =>
      diferencias(a[k], b[k], ruta + (Array.isArray(a) ? `[${k}]` : (ruta ? "." : "") + k), out)
    );
    return out;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push([ruta, a, b]);
  return out;
}

const casos = vm.runInContext("CASOS_PRUEBA", ctx),
  ref = vm.runInContext("REFERENCIA", ctx),
  t0 = Date.now();
let mal = 0;
casos.forEach(cp => {
  let d;
  try {
    const p = vm.runInContext("proyectoDe", ctx)(JSON.parse(JSON.stringify(cp.p))),
      r = vm.runInContext("calcular", ctx)(p);
    d = ref.casos[cp.id] ? diferencias(ref.casos[cp.id], resumen(r)) : [["sin referencia"]];
  } catch (e) {
    d = [["error", e.message]];
  }
  if (d.length) {
    mal++;
    console.log(`✘ ${cp.id} ${cp.tit}`);
    d.forEach(([r, a, b]) =>
      console.log(`    ${r || "(todo)"}: antes ${JSON.stringify(a)} → ahora ${JSON.stringify(b)}`)
    );
  }
});
const n = casos.length,
  s = ((Date.now() - t0) / 1000).toFixed(2);
console.log(
  mal
    ? `\n✘ ${mal} de ${n} casos con diferencias contra la referencia (${s} s)`
    : `✔ Todas las pruebas pasaron (${n} de ${n}) en ${s} s · referencia ${ref.version} del ${ref.fecha}`
);
// Cálculo con el diseño del plano (casos con las medidas calculadas a mano)
mal += require("./pruebas-calc-plano.js")(ctx);
/* Balance de fases en dos niveles: en cada caso trifásico, cada tablero secundario queda con el menor desbalance
   posible para sus circuitos (sin fases fijadas), el TG lleva el total y una fase fijada se respeta */
{
  const fallas = [],
    calc = p => vm.runInContext("calcular", ctx)(vm.runInContext("proyectoDe", ctx)(JSON.parse(JSON.stringify(p))));
  let n = 0;
  casos.forEach(cp => {
    const r = calc(cp.p);
    if (!r.bal) return;
    r.bal.tabs.forEach(t => {
      n++;
      if (t.tab === "TG" && Math.abs(t.desb - r.bal.desb) > 1e-9) fallas.push(`${cp.id} TG: no es el total`);
      if (t.tab !== "TG" && t.desb > t.desbMin + 1e-6)
        fallas.push(`${cp.id} ${t.tab}: ${t.desb.toFixed(1)} % y podría ser ${t.desbMin.toFixed(1)} %`);
    });
  });
  // Vivienda de 3 pisos con TD-1 (C6): antes TD-1 102 %, TD-2 103 % y TD-3 155 % (con una fase vacía) y el total en
  // 1.2 %; ahora cada tablero en su mínimo, con sus tres fases usadas, y el total dentro del 10 %
  const c6 = calc(casos.find(c => c.id === "C6").p),
    tb = k => c6.bal.tabs.find(t => t.tab === k);
  if (
    !(
      tb("TD-1").desb < 5 &&
      tb("TD-2").desb < 51 &&
      tb("TD-3").desb < 81 &&
      Math.min(...tb("TD-3").ph) > 0 &&
      c6.bal.desb <= 10
    )
  )
    fallas.push(
      `C6: ${c6.bal.tabs.map(t => `${t.tab} ${t.desb.toFixed(1)} %`).join(", ")} · total ${c6.bal.desb.toFixed(1)} %`
    );
  // Una fase fijada por el proyectista se respeta (y su tablero no se rota)
  const p6 = JSON.parse(JSON.stringify(casos.find(c => c.id === "C6").p)),
    q = c6.circ.find(x => x.tab === "TD-2" && !x.f3);
  p6.FIX = { uni: { [q.key]: "T" }, multi: {} };
  const f6 = calc(p6);
  if (f6.bal.items.find(x => x.key === q.key).fase !== "T") fallas.push("C6: la fase fijada no se respetó");
  if (fallas.length) {
    mal++;
    console.log("✘ Balance por tablero\n" + fallas.map(x => "    " + x).join("\n"));
  } else console.log(`✔ Balance por tablero: ${n} tableros en el menor desbalance posible; fase fijada respetada`);
}
process.exit(mal ? 1 : 0);
