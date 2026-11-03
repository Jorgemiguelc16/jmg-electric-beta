/* Contexto aislado de Node con los archivos de la aplicación, para las pruebas sin navegador (herramientas/pruebas.js
   y herramientas/pruebas-planos.js). La página se reemplaza por un objeto vacío que acepta todo, solo para que los
   archivos puedan cargarse; el motor y los dibujos no leen la pantalla. Los valores por defecto de cada dato (DEFV)
   se leen de los campos de index.html, como hace el navegador al cargar la página. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
// Objeto que acepta cualquier uso (document.getElementById(...).addEventListener(...), etc.) y no hace nada
const nada = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => "" : k === "length" ? 0 : nada),
  apply: () => nada,
  construct: () => nada,
  set: () => true
});
// Archivos del motor, en el orden de index.html
const MOTOR = [
  "js/tablas-cne.js",
  "js/textos.js",
  "js/datos.js",
  "js/calculo.js",
  "js/calculo-conductores.js",
  "js/calculo-demanda.js",
  "js/calculo-tierra-fases.js",
  "js/calculo-plano.js",
  "js/calculo-vivienda.js",
  "js/calculo-edificio.js",
  "js/verificaciones.js",
  "js/resultados.js",
  "js/metrado.js",
  "js/proyectos.js"
];

// Crea el contexto con el motor y, después, los archivos extra (por ejemplo, los de los planos)
function crearContexto(extra = []) {
  const ctx = vm.createContext({
    console,
    document: nada,
    window: nada,
    navigator: nada,
    location: nada,
    localStorage: nada,
    sessionStorage: nada,
    addEventListener: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: () => 0,
    getComputedStyle: () => nada,
    matchMedia: () => nada,
    innerWidth: 1366,
    innerHeight: 768,
    ResizeObserver: undefined
  });
  const cargar = f => vm.runInContext(fs.readFileSync(path.join(raiz, f), "utf8"), ctx, { filename: f });
  MOTOR.forEach(cargar);
  const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8"),
    defv = {};
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const id = (m[0].match(/\bid="([^"]+)"/) || [])[1];
    if (id) defv[id] = (m[0].match(/\bvalue="([^"]*)"/) || [, ""])[1];
  }
  for (const m of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const ops = [...m[2].matchAll(/<option\b([^>]*)>([^<]*)/g)].map(o => [
      o[1],
      (o[1].match(/value="([^"]*)"/) || [, o[2]])[1]
    ]);
    defv[m[1]] = (ops.find(o => /\bselected\b/.test(o[0])) || ops[0] || [, ""])[1];
  }
  vm.runInContext("KEYS", ctx).forEach(k => (vm.runInContext("DEFV", ctx)[k] = defv[k] ?? ""));
  extra.forEach(cargar);
  return { ctx, cargar, run: code => vm.runInContext(code, ctx), raiz };
}

module.exports = { crearContexto };
