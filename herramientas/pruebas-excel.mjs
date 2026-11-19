/* Pruebas de la memoria en Excel («npm run pruebas-excel»), solo para desarrollo.
   En Chrome sin ventana (herramientas/chrome.mjs), para cada caso de pruebas/casos.js calcula el proyecto, genera el
   libro con exportar() (js/exportar/excel.js), lo vuelve a abrir con ExcelJS y saca la «huella» (resumen SHA-1) de cada hoja:
   valor, fórmula y formato de cada celda, alturas de fila, anchos de columna, celdas combinadas, configuración de
   página y cantidad de imágenes. La compara con pruebas/huellas-excel.js: si un cambio en el código altera una hoja
   sin querer, la prueba lo dice. La fecha se fija en el 1 de enero de 2026 para que la huella no cambie con el día.
   - «--actualizar» guarda las huellas actuales como referencia (después de revisar que el cambio es el buscado). */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { abrirApp, raiz } from "./chrome.mjs";

const ARCHIVO = join(raiz, "pruebas", "huellas-excel.js"),
  ACTUALIZAR = process.argv.includes("--actualizar");
const previas = existsSync(ARCHIVO)
  ? JSON.parse(
      readFileSync(ARCHIVO, "utf8")
        .replace(/^[^{]*/, "")
        .replace(/;\s*$/, "")
    )
  : { casos: {} };

const { ev, cerrar } = await abrirApp();
await ev(`new Promise((ok, mal) => {
  const s = document.createElement("script");
  s.src = "pruebas/casos.js";
  s.onload = ok;
  s.onerror = mal;
  document.head.appendChild(s);
})`);
await ev(`Date = class extends Date {
  constructor(...a) { super(...(a.length ? a : [2026, 0, 1])); }
  static now() { return new Date(2026, 0, 1).getTime(); }
}; true`);
const ids = await ev("JSON.stringify(CASOS_PRUEBA.map(c => c.id))").then(JSON.parse);

const t0 = Date.now(),
  nuevas = {};
let mal = 0,
  total = 0;
for (const id of ids) {
  let h;
  try {
    h = JSON.parse(
      await ev(`(async () => {
        const cp = CASOS_PRUEBA.find(c => c.id === ${JSON.stringify(id)});
        LAST = calcular(proyectoDe(JSON.parse(JSON.stringify(cp.p))));
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await exportar());
        const sha = async t =>
          [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(t)))]
            .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
        const out = {};
        for (const ws of wb.worksheets) {
          const d = { cols: (ws.columns || []).map(c => c.width), merges: ws.model.merges, img: ws.getImages().length,
            setup: ws.pageSetup, vistas: ws.views, filas: [] };
          ws.eachRow({ includeEmpty: true }, (row, n) => {
            const celdas = [];
            row.eachCell({ includeEmpty: true }, (cell, k) => celdas.push([k, cell.value, cell.style]));
            d.filas.push([n, row.height, celdas]);
          });
          out[ws.name] = await sha(JSON.stringify(d));
        }
        return JSON.stringify(out);
      })()`)
    );
  } catch (e) {
    mal++;
    console.log(`✘ ${id}: ${e.message}`);
    continue;
  }
  nuevas[id] = h;
  const antes = previas.casos[id] || {};
  for (const [hoja, v] of Object.entries(h)) {
    total++;
    if (!ACTUALIZAR && antes[hoja] !== v) {
      mal++;
      console.log(`✘ ${id} · hoja ${hoja}: ${antes[hoja] ? "cambió" : "hoja nueva, sin huella"}`);
    }
  }
  if (!ACTUALIZAR)
    Object.keys(antes)
      .filter(hoja => !(hoja in h))
      .forEach(hoja => {
        mal++;
        console.log(`✘ ${id} · hoja ${hoja}: ya no se genera`);
      });
}
cerrar();
const s = ((Date.now() - t0) / 1000).toFixed(1);
if (ACTUALIZAR) {
  writeFileSync(
    ARCHIVO,
    `// Huellas de las hojas del Excel de cada caso de pruebas (herramientas/pruebas-excel.mjs). No editar a mano:\n// se regeneran con «npm run pruebas-excel -- --actualizar» después de revisar el libro.\nconst HUELLAS_EXCEL = ${JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), casos: nuevas }, null, 1)};\n`
  );
  console.log(`✔ Huellas del Excel guardadas: ${total} hojas de ${Object.keys(nuevas).length} casos (${s} s)`);
} else
  console.log(
    mal
      ? `\n✘ ${mal} hoja(s) del Excel distintas de su huella (${s} s)`
      : `✔ Todas las hojas del Excel coinciden con su huella (${total} hojas) en ${s} s · huellas del ${previas.fecha}`
  );
process.exit(mal ? 1 : 0);
