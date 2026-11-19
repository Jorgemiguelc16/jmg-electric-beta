/* Pruebas de los planos sin navegador («npm run pruebas-planos»).
   Para cada caso de pruebas/casos.js calcula el proyecto y genera todos los planos (los mismos de la cinta Planos y
   del DXF: unifilar, alturas, detalles, tableros con y sin peinado, tablero general y banco de medidores) en las
   láminas A4 y A3, con su DXF en el esquema JMG. De cada uno guarda una «huella» (resumen SHA-1 del SVG y del DXF)
   y la compara con pruebas/huellas.js: si un cambio en el código altera un plano sin querer, la prueba lo dice.
   La fecha del rótulo se fija en el 1 de enero de 2026 para que la huella no cambie con el día.
   - «--actualizar» guarda las huellas actuales como referencia (después de revisar que el cambio es el buscado).
   - Los planos que cambian se guardan en la carpeta temporal del sistema (jmg-planos) para abrirlos y revisarlos. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { crearContexto } = require("./contexto.js");
const { DOMParser } = require("./mini-dom.js");

const { ctx, cargar, run, raiz } = crearContexto([
  "js/base/logo.js",
  "js/planos/dibujo.js",
  "js/planos/unifilar.js",
  "js/planos/rotulo.js",
  "js/planos/exportar-planos.js",
  "js/planos/simbolos.js",
  "js/planos/alturas.js",
  "js/planos/detalles.js",
  "js/planos/tableros.js",
  "js/planos/medidores.js",
  "js/planos/tablerogeneral.js",
  "js/exportar/descargas.js"
]);
// svgDxf() lee el SVG con DOMParser, que Node no tiene
ctx.DOMParser = DOMParser;
cargar("pruebas/casos.js");
run(`Date = class extends Date {
  constructor(...a) { super(...(a.length ? a : [2026, 0, 1])); }
  static now() { return new Date(2026, 0, 1).getTime(); }
};`);

const ARCHIVO = path.join(raiz, "pruebas", "huellas.js"),
  ACTUALIZAR = process.argv.includes("--actualizar"),
  DIF = path.join(os.tmpdir(), "jmg-planos"),
  huella = t => crypto.createHash("sha1").update(t).digest("hex").slice(0, 16);
const previas = fs.existsSync(ARCHIVO)
  ? JSON.parse(
      fs
        .readFileSync(ARCHIVO, "utf8")
        .replace(/^[^{]*/, "")
        .replace(/;\s*$/, "")
    )
  : { casos: {} };

const proyectoDe = run("proyectoDe"),
  calcular = run("calcular"),
  ponerLast = run("(r => { LAST = r; })"),
  peinado = run("(v => { TAB_PEINADO = v; })"),
  planos = run("PLANOS"),
  svgDxf = run("svgDxf");
const t0 = Date.now(),
  nuevas = {};
let mal = 0,
  total = 0;
for (const cp of run("CASOS_PRUEBA")) {
  const h = (nuevas[cp.id] = {});
  try {
    ponerLast(calcular(proyectoDe(JSON.parse(JSON.stringify(cp.p)))));
    for (const lam of ["A4", "A3"])
      for (const pein of [false, true]) {
        peinado(pein);
        for (const k of Object.keys(planos)) {
          // El peinado solo cambia el detalle de tableros
          if (pein && k !== "tableros") continue;
          for (const u of planos[k](lam)) {
            const id = `${lam} ${k}${pein ? " peinado" : ""} ${u.corto}`;
            h[id] = huella(u.svg) + " " + huella(svgDxf(u.svg, { lamina: lam, colores: "jmg" }));
            total++;
            const antes = (previas.casos[cp.id] || {})[id];
            if (!ACTUALIZAR && antes !== h[id]) {
              mal++;
              console.log(`✘ ${cp.id} · ${id}: ${antes ? "cambió" : "plano nuevo, sin huella"}`);
              fs.mkdirSync(DIF, { recursive: true });
              fs.writeFileSync(path.join(DIF, `${cp.id} ${id}.svg`.replace(/[^\w.\- ]/g, "_")), u.svg);
            }
          }
        }
      }
    peinado(false);
  } catch (e) {
    mal++;
    console.log(`✘ ${cp.id}: error ${e.message}`);
  }
  if (!ACTUALIZAR)
    Object.keys(previas.casos[cp.id] || {})
      .filter(id => !(id in h))
      .forEach(id => {
        mal++;
        console.log(`✘ ${cp.id} · ${id}: el plano ya no se genera`);
      });
}
const s = ((Date.now() - t0) / 1000).toFixed(2);
if (ACTUALIZAR) {
  const fecha = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    ARCHIVO,
    `// Huellas de los planos de cada caso de pruebas (herramientas/pruebas-planos.js). No editar a mano:\n// se regeneran con «npm run pruebas-planos -- --actualizar» después de revisar los planos.\nconst HUELLAS = ${JSON.stringify({ fecha, casos: nuevas }, null, 1)};\n`
  );
  console.log(`✔ Huellas guardadas: ${total} planos de ${Object.keys(nuevas).length} casos (${s} s)`);
} else
  console.log(
    mal
      ? `\n✘ ${mal} plano(s) distintos de su huella (${s} s). Los nuevos están en ${DIF}`
      : `✔ Todos los planos coinciden con su huella (${total} planos) en ${s} s · huellas del ${previas.fecha}`
  );
process.exit(mal ? 1 : 0);
