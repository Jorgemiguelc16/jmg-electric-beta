/* Estilos sin uso («npm run estilos-sin-uso», o con --quitar para eliminarlos).
   Busca en los estilos (css/) las clases e ids que no aparecen en index.html, js/ ni el manual.
   Con --quitar borra solo esos selectores: si una regla tiene varios selectores, conserva los que sí se usan.
   Las clases que se arman con código (por ejemplo ex-${estilo}) van en CONSERVAR. */
const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const { raiz, archivosCss } = require("./estilos");

const CONSERVAR = new Set(["ex-f", "ex-formal", "ex-color"]);
const leer = f => fs.readFileSync(path.join(raiz, f), "utf8");
const textos =
  leer("index.html") +
  leer("manual/manual.html") +
  fs
    .readdirSync(path.join(raiz, "js"), { recursive: true })
    .filter(f => f.endsWith(".js"))
    .map(f => leer(path.join("js", f)))
    .join("");
const usado = n => CONSERVAR.has(n) || new RegExp(`(^|[^\\w-])${n.replace(/[-]/g, "\\-")}([^\\w-]|$)`).test(textos);

const hojas = archivosCss().map(f => ({ f, raiz: postcss.parse(leer(f)) }));
const muertos = new Set();
const selMuerto = s => {
  const nombres = [...s.matchAll(/[.#]([A-Za-z_][\w-]*)/g)].map(m => m[1]).filter(n => !/^[0-9a-f]{3,8}$/i.test(n));
  const m = nombres.filter(n => !usado(n));
  m.forEach(n => muertos.add(n));
  return m.length > 0;
};
let quitados = 0;
for (const { f, raiz: raizCss } of hojas) {
  raizCss.walkRules(r => {
    if (r.parent && r.parent.type === "atrule" && /keyframes/.test(r.parent.name)) return;
    const vivos = r.selectors.filter(s => !selMuerto(s));
    if (vivos.length === r.selectors.length) return;
    quitados += r.selectors.length - vivos.length;
    if (process.argv.includes("--quitar")) {
      if (vivos.length) r.selectors = vivos;
      else r.remove();
    }
  });
  if (process.argv.includes("--quitar")) {
    raizCss.walkAtRules(a => {
      if (a.nodes && !a.nodes.length) a.remove();
    });
    fs.writeFileSync(path.join(raiz, f), raizCss.toString());
  }
}
console.log(`${muertos.size} clases o ids sin uso: ${[...muertos].sort().join(" ")}`);
console.log(`${quitados} selectores ${process.argv.includes("--quitar") ? "quitados" : "por quitar (use --quitar)"}.`);
