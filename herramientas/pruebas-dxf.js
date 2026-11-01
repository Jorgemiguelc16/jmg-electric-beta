/* Pruebas del lector DXF sin navegador («npm run pruebas-dxf»), solo para desarrollo.
   1. Lee pruebas/plano-prueba.dxf (lo genera herramientas/plano-prueba.js: una vivienda de 10 × 8 m con medidas
      conocidas y los casos difíciles) y comprueba la unidad, las capas, las longitudes, los bloques girados y en
      espejo, los textos con eñe, el tipo de línea, el sombreado y los puntos de enganche.
   2. Vuelve a leer los DXF que exporta la propia plataforma (todos los planos de tres casos de pruebas/casos.js):
      la plataforma debe poder abrir sus propios archivos. */
const fs = require("fs");
const path = require("path");
const { crearContexto } = require("./contexto.js");
const { DOMParser } = require("./mini-dom.js");

const { ctx, cargar, run, raiz } = crearContexto([
  "js/logo.js",
  "js/dibujo.js",
  "js/unifilar.js",
  "js/rotulo.js",
  "js/exportar-planos.js",
  "js/simbolos.js",
  "js/alturas.js",
  "js/detalles.js",
  "js/tableros.js",
  "js/medidores.js",
  "js/tablerogeneral.js",
  "js/descargas.js",
  "js/dxf.js"
]);
ctx.DOMParser = DOMParser;
ctx.TextDecoder = TextDecoder;
cargar("pruebas/casos.js");
const modeloDxf = run("modeloDxf");

const t0 = Date.now();
let bien = 0,
  mal = 0;
const ok = (c, txt) => {
  if (c) bien++;
  else {
    mal++;
    console.log("✘ " + txt);
  }
};
const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const largo = t => {
  let l = 0;
  for (let j = 2; j < t.p.length; j += 2) l += Math.hypot(t.p[j] - t.p[j - 2], t.p[j + 1] - t.p[j - 1]);
  if (t.c) l += Math.hypot(t.p[0] - t.p[t.p.length - 2], t.p[1] - t.p[t.p.length - 1]);
  return l;
};
const tienePunto = (t, x, y) => {
  for (let j = 0; j < t.p.length; j += 2) if (cerca(t.p[j], x, 1e-6) && cerca(t.p[j + 1], y, 1e-6)) return true;
  return false;
};

/* 1. Plano de prueba */
const OX = 230000,
  OY = 8180000;
const m = modeloDxf(new Uint8Array(fs.readFileSync(path.join(raiz, "pruebas", "plano-prueba.dxf"))));
ok(m.version === "AC1027", `versión AC1027 (dio ${m.version})`);
ok(m.unidad.f === 1 && m.unidad.de === "cotas", `unidad: metros según las cotas (dio ${JSON.stringify(m.unidad)})`);
ok(!m.capas.OCULTA.on && !m.capas.CONGELADA.on && m.capas.MUROS.on, "capa apagada y congelada se reconocen");
const n = c => m.trazos.filter(t => t.capa === c).length + m.textos.filter(t => t.capa === c).length;
ok(
  n("MUROS") === 4,
  `MUROS: muro, muro interior, columna y relleno, sin el objeto del espacio papel (dio ${n("MUROS")})`
);
ok(n("PUERTAS") === 4, `PUERTAS: hoja y arco de cada una de las dos puertas (dio ${n("PUERTAS")})`);
ok(n("COTAS") === 6, `COTAS: línea y texto de cada cota (dio ${n("COTAS")})`);
// Rectángulo cerrado: cuatro vértices y el regreso al primero
const muro = m.trazos.find(t => t.capa === "MUROS" && t.c && t.k === "l" && t.p.length === 10);
ok(muro && cerca(largo(muro), 36), `perímetro del muro 36 m (dio ${muro && largo(muro)})`);
ok(muro && tienePunto(muro, OX + 10, OY + 8), "esquina del muro exacta en coordenadas UTM");
const tub = m.trazos.find(t => t.capa === "TUBERIAS");
ok(
  tub && cerca(largo(tub), 2 + Math.PI, 0.003),
  `tubería con curva: 2 + π = 5.142 m (dio ${tub && largo(tub).toFixed(4)})`
);
const puertas = m.trazos.filter(t => t.capa === "PUERTAS");
ok(
  puertas.some(t => tienePunto(t, OX + 5.1, OY + 2)) && puertas.some(t => tienePunto(t, OX + 6, OY + 2.9)),
  "puerta girada 90°: hoja y arco en su lugar"
);
ok(
  puertas.some(t => tienePunto(t, OX + 2, OY + 8.9)) && puertas.some(t => tienePunto(t, OX + 1.1, OY + 8)),
  "puerta en espejo: el arco abre hacia el otro lado"
);
const textos = m.textos.map(t => t.s);
ok(textos.includes("SALA"), "texto SALA");
ok(textos.includes("COCINA\nBAÑO"), `MTEXT sin formato y con salto de línea (dio ${JSON.stringify(textos)})`);
ok(textos.includes("DORMITORIO NIÑOS"), "eñe escrita como \\U+00D1");
ok(
  m.trazos.some(t => t.capa === "EJES" && t.lt === "DASHED"),
  "eje con línea de trazos"
);
ok(
  m.trazos.some(t => t.capa === "MUROS" && t.k === "f"),
  "sombreado sólido como relleno"
);
ok(!m.trazos.some(t => t.p.some(v => Math.abs(v) < 1000)), "el espacio papel no se dibuja");
const sn = [];
for (let i = 0; i < m.snap.length; i += 3) sn.push([m.snap[i], m.snap[i + 1], m.snap[i + 2], m.snapC[i / 3]]);
const hay = (x, y, k) => sn.some(s => cerca(s[0], x, 1e-6) && cerca(s[1], y, 1e-6) && s[2] === k);
ok(hay(OX + 10, OY + 8, 1), "enganche: extremo en la esquina del muro");
ok(hay(OX + 5, OY, 2), "enganche: punto medio del muro");
ok(hay(OX + 3, OY + 4, 3), "enganche: centro de la columna");
ok(hay(OX + 6, OY + 2, 4), "enganche: inserción de la puerta");
ok(
  sn.every(s => typeof s[3] === "string"),
  "cada punto de enganche sabe su capa"
);

/* 2. Los DXF que exporta la plataforma se vuelven a leer */
const proyectoDe = run("proyectoDe"),
  calcular = run("calcular"),
  ponerLast = run("(r => { LAST = r; })"),
  planos = run("PLANOS"),
  svgDxf = run("svgDxf");
let nDxf = 0;
for (const cp of run("CASOS_PRUEBA").slice(0, 3)) {
  ponerLast(calcular(proyectoDe(JSON.parse(JSON.stringify(cp.p)))));
  for (const k of Object.keys(planos))
    for (const u of planos[k]("A3")) {
      nDxf++;
      try {
        const d = modeloDxf(svgDxf(u.svg, { lamina: "A3", colores: "jmg" }));
        ok(d.trazos.length > 20 && d.textos.length > 5, `${cp.id} · ${u.corto}: se lee con trazos y textos`);
      } catch (e) {
        ok(false, `${cp.id} · ${u.corto}: ${e.message}`);
      }
    }
}

const s = ((Date.now() - t0) / 1000).toFixed(2);
console.log(
  mal
    ? `\n✘ ${mal} comprobación(es) del lector DXF fallaron (${s} s)`
    : `✔ Lector DXF: ${bien} comprobaciones, incluidos ${nDxf} DXF exportados por la plataforma (${s} s)`
);
process.exit(mal ? 1 : 0);
