/* Revisión del código con ESLint («npm run revisar»).
   Los archivos de js/ son scripts que comparten variables globales: se cargan en orden desde index.html.
   Por eso se unen en un solo texto, en ese mismo orden, y ESLint los analiza juntos: así detecta lo que
   se usa sin estar definido y lo que se define y nunca se usa, aunque esté en otro archivo.
   Cada aviso indica el archivo y la línea originales. */
const fs = require("fs");
const path = require("path");
const { Linter } = require("eslint");
const globals = require("globals");

const raiz = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const archivos = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]).filter(f => f !== "js/base/logo.js");

// Unión de los archivos, guardando dónde empieza cada uno para traducir los números de línea
let texto = "const LOGO_JPG = '';\n";
const tramos = [];
for (const f of archivos) {
  const t = fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");
  tramos.push({ f, desde: texto.split("\n").length, lineas: t.split("\n").length });
  texto += t + "\n";
}
const ubicar = n => {
  const t = tramos.find(x => n >= x.desde && n < x.desde + x.lineas);
  return t ? `${t.f}:${n - t.desde + 1}` : `?:${n}`;
};

const linter = new Linter({ configType: "flat" });
const avisos = linter.verify(texto, [
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: { ...globals.browser, firebase: "readonly", ExcelJS: "readonly" }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { vars: "all", args: "none", caughtErrors: "none" }],
      "no-redeclare": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "warn",
      "no-self-assign": "warn"
    }
  }
]);

/* Orden del código: cada archivo de js/ está cargado en index.html (y no dos veces), aparece en la guía del código y
   lleva la misma versión de caché (?v=) que los demás, para que el navegador no use una copia vieja al publicar */
const orden = [];
const enDisco = fs
  .readdirSync(path.join(raiz, "js"), { recursive: true })
  .filter(f => f.endsWith(".js"))
  .map(f => "js/" + f.replace(/\\/g, "/"));
const cargados = [...html.matchAll(/<script src="(js\/[^"?]+)(\?v=([^"]+))?"/g)];
const guia = fs.readFileSync(path.join(raiz, "GUIA-DEL-CODIGO.md"), "utf8");
enDisco.forEach(f => {
  const n = cargados.filter(m => m[1] === f).length;
  if (!n) orden.push(`${f}: no se carga en index.html`);
  if (n > 1) orden.push(`${f}: se carga ${n} veces en index.html`);
  if (!guia.includes("`" + f.slice(3) + "`")) orden.push(`${f}: falta en GUIA-DEL-CODIGO.md`);
});
cargados.forEach(m => !enDisco.includes(m[1]) && orden.push(`index.html carga ${m[1]}, que no existe`));
const versiones = [...new Set([...html.matchAll(/\.(?:js|css)\?v=([^"]+)"/g)].map(m => m[1]))];
if (versiones.length > 1) orden.push(`index.html usa varias versiones de caché: ${versiones.join(", ")}`);
const sinV = cargados.filter(m => !m[2]).map(m => m[1]);
if (sinV.length) orden.push(`sin versión de caché (?v=): ${sinV.join(", ")}`);
orden.forEach(t => avisos.push({ line: 0, severity: 2, message: t, orden: true }));

if (!avisos.length) {
  console.log(`Sin observaciones en ${archivos.length} archivos.`);
  process.exit(0);
}
for (const a of avisos)
  console.log(`${a.orden ? "orden" : ubicar(a.line)}  ${a.severity === 2 ? "ERROR" : "aviso"}  ${a.message}`);
const errores = avisos.filter(a => a.severity === 2).length;
console.log(`\n${errores} error(es) y ${avisos.length - errores} aviso(s) en ${archivos.length} archivos.`);
process.exit(errores ? 1 : 0);
