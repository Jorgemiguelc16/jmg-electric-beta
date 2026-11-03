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
process.exit(mal ? 1 : 0);
