/* Pruebas de la interfaz («npm run pruebas-ui»), solo para desarrollo.
   Abre index.html en Chrome sin ventana (protocolo DevTools), entra sin cuenta y recorre las ventanas como lo
   haría un usuario: abrir, editar, vista previa, aplicar, cancelar, deshacer, doble clic. Cada prueba verifica
   el resultado esperado; al final muestra cuáles pasaron. Las pruebas del cálculo son «npm test».
   Chrome lo abre herramientas/chrome.mjs. */
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { abrirApp, esperar, raiz } from "./chrome.mjs";
import { createRequire } from "node:module";
const { dxfR12Problemas } = createRequire(import.meta.url)("./dxf-r12.js");
const { dxf2013Problemas } = createRequire(import.meta.url)("./dxf-2013.js");

const { cdp, ev, J, cerrar } = await abrirApp();
const poner = (sel, v) =>
  ev(
    `(el => { el.focus(); el.value = ${JSON.stringify(String(v))}; el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true})); })(document.querySelector(${JSON.stringify(sel)}))`
  );
const clic = sel => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const raton = (type, x, y, n = 1) =>
  cdp("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    buttons: type === "mouseReleased" ? 0 : 1,
    clickCount: n
  });
async function dobleClic(sel) {
  const r = await J(`document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect()`);
  const x = r.x + Math.min(30, r.width / 2),
    y = r.y + r.height / 2;
  for (const n of [1, 2]) {
    await raton("mousePressed", x, y, n);
    await raton("mouseReleased", x, y, n);
  }
  await esperar(250);
}
const tecla = (key, code, k) => cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: k });
// El historial (deshacer) agrupa los cambios de medio segundo: se espera antes de deshacer
const deshacer = async (n = 1) => {
  await esperar(700);
  for (let i = 0; i < n; i++) await ev("histGo(-1)");
};

// Carga un ejemplo y espera a que el historial lo registre (agrupa los cambios de medio segundo)
const ejemplo = async m => {
  const r = await ev(`(() => {
    document.querySelectorAll(".welcome").forEach(x => (x.hidden = true));
    try { Object.keys(localStorage).filter(k => k.startsWith("jmg-electric-")).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    cargarEjemplo(${JSON.stringify(m)});
    document.body.classList.remove("sin-acceso", "wl-open");
    document.querySelectorAll(".welcome, #acceso").forEach(x => (x.hidden = true));
    return !!LAST;
  })()`);
  await esperar(700);
  return r;
};
// Pruebas: cada una recibe ok(condición, descripción)
const PRUEBAS = [];
const prueba = (nombre, fn) => PRUEBAS.push([nombre, fn]);

/* Editor de diseño: plano de arquitectura (pruebas/plano-prueba.dxf: vivienda de 10 × 8 m en coordenadas UTM,
   generada por herramientas/plano-prueba.js) */
const OX = 230000,
  OY = 8180000;
// Abre el editor desde la pestaña Diseño y elige el plano de prueba, como si el usuario lo eligiera
async function abrirPlano() {
  await ev("abrirWS(); document.querySelector('[data-tab-r=\"diseno\"]').click()");
  await clic('#ws > .ap-ribbon [data-pl="editor"]');
  await cdp("DOM.enable");
  const doc = await cdp("DOM.getDocument", {});
  const q = await cdp("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "#plArchivo" });
  await cdp("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [join(raiz, "pruebas", "plano-prueba.dxf")] });
  for (let i = 0; i < 60 && !(await ev("!!PL_MOD && $('plCarga').hidden")); i++) await esperar(100);
  await ev("plAjustar()");
  await esperar(150);
}
// Clic sobre un punto del dibujo (desplazado unos píxeles, para que actúe el enganche)
async function clicPlano(x, y, d = 4) {
  const [X, Y] = await J(
    `(() => { const [X, Y] = plAPant(${x}, ${y}), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
  );
  const p = { x: X + d, y: Y - d };
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...p });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...p, button: "left", buttons: 1, clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...p, button: "left", buttons: 0, clickCount: 1 });
  await esperar(60);
}
const orden = () => ev("$('plCmdT').textContent");
const ctrlZ = () =>
  cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, modifiers: 2 });

// Teclas para el editor
const teclaE = (key, code, vk, mod = 0) =>
  cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, modifiers: mod });
async function moverPlano(x, y) {
  const [X, Y] = await J(
    `(() => { const [X, Y] = plAPant(${x}, ${y}), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
  );
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: X, y: Y });
  await esperar(40);
}
// Arrastra con el botón izquierdo entre dos puntos del dibujo
async function arrastrarPlano(a, b) {
  const pant = ([x, y]) =>
    J(
      `(() => { const [X, Y] = plAPant(${x}, ${y}), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
    );
  const [X0, Y0] = await pant(a),
    [X1, Y1] = await pant(b);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: X0, y: Y0 });
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: X0,
    y: Y0,
    button: "left",
    buttons: 1,
    clickCount: 1
  });
  for (let i = 1; i <= 6; i++)
    await cdp("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: X0 + ((X1 - X0) * i) / 6,
      y: Y0 + ((Y1 - Y0) * i) / 6,
      button: "left",
      buttons: 1
    });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: X1,
    y: Y1,
    button: "left",
    buttons: 0,
    clickCount: 1
  });
  await esperar(80);
}

/* Las pruebas, por tema, en herramientas/pruebas-ui/ (en el orden del nombre del archivo: el estado de una prueba
   puede seguir en la siguiente). Cada archivo recibe estos ayudantes y registra sus pruebas con prueba(). */
const ayudantes = {
  prueba,
  ev,
  J,
  cdp,
  esperar,
  raiz,
  join,
  readFileSync,
  writeFileSync,
  mkdtempSync,
  tmpdir,
  dxfR12Problemas,
  dxf2013Problemas,
  poner,
  clic,
  raton,
  dobleClic,
  tecla,
  deshacer,
  ejemplo,
  OX,
  OY,
  abrirPlano,
  clicPlano,
  orden,
  ctrlZ,
  teclaE,
  moverPlano,
  arrastrarPlano
};
const dirPruebas = join(raiz, "herramientas", "pruebas-ui");
for (const f of readdirSync(dirPruebas)
  .filter(x => x.endsWith(".mjs"))
  .sort())
  (await import(pathToFileURL(join(dirPruebas, f)).href)).default(ayudantes);

// Ejecución
let mal = 0;
const t0 = Date.now();
// Con un texto (npm run pruebas-ui -- "Calcular"), solo las pruebas cuyo nombre lo contiene
const SOLO = process.argv[2] || "";
for (const [nombre, fn] of PRUEBAS.filter(([n]) => n.includes(SOLO))) {
  const fallas = [];
  try {
    await fn((c, d) => {
      if (!c) fallas.push(d);
    });
  } catch (e) {
    fallas.push(e.message);
  }
  await ev(
    "['cerrarFicha','cerrarTablero','cerrarTabla'].forEach(f => { try { window[f] && window[f](); } catch (e) {} }); try { cuadroCond(false); parametros(false); datosProyecto(false); } catch (e) {}"
  ).catch(() => {});
  // En todas las pruebas: los datos del proyecto (PROY) y los campos de la pantalla deben coincidir
  try {
    const dif = await J(
      "KEYS.filter(k => PROY[k] !== $(k).value).concat(['sist', 'sistG'].filter(n => PROY[n] !== radio(n)))"
    );
    if (dif.length) fallas.push("PROY y la pantalla no coinciden en: " + dif.join(", "));
  } catch (e) {
    fallas.push(e.message);
  }
  if (fallas.length) mal++;
  console.log(`${fallas.length ? "✘" : "✔"} ${nombre}`);
  fallas.forEach(f => console.log(`    ✘ ${f}`));
}
const n = PRUEBAS.filter(([x]) => x.includes(SOLO)).length;
console.log(
  mal
    ? `\n✘ ${mal} de ${n} pruebas de la interfaz fallaron (${((Date.now() - t0) / 1000).toFixed(1)} s)`
    : `\n✔ Todas las pruebas de la interfaz pasaron (${n} de ${n}) en ${((Date.now() - t0) / 1000).toFixed(1)} s`
);
cerrar();
process.exit(mal ? 1 : 0);
