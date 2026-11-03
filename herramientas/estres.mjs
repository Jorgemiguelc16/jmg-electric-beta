/* PRUEBA DE ESTRÉS DEL EDITOR DE DISEÑO (solo para desarrollo)
   Arma un diseño grande sobre un plano DXF y mide cuánto tarda cada acción del editor: un cambio, dibujar, mover el
   cursor, la lámina, el DXF y el deshacer. Uso: npm run estres -- [grupos] [plano.dxf]
   (cada grupo: luminaria, tomacorriente, interruptor y sus tuberías; 5000 grupos ≈ 25 000 elementos). */
import { join } from "node:path";
import { abrirApp, esperar, raiz } from "./chrome.mjs";
const N = +(process.argv[2] || 1500),
  DXF = process.argv[3] || join(raiz, "pruebas", "plano-prueba.dxf");
const { cdp, ev, cerrar } = await abrirApp();
await esperar(800);
await ev(
  `(() => { cargarEjemplo("uni"); document.querySelectorAll(".welcome, #acceso").forEach(x => (x.hidden = true)); abrirWS(); edAbrir(false); })()`
);
await cdp("DOM.enable");
const doc = await cdp("DOM.getDocument", {});
const q = await cdp("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "#plArchivo" });
const t0 = Date.now();
await cdp("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [DXF] });
for (let i = 0; i < 300 && !(await ev("!!PL_MOD && $('plCarga').hidden")); i++) await esperar(100);
console.log("abrir DXF:", Date.now() - t0, "ms");
// Diseño grande: N grupos de (luminaria, tomacorriente, interruptor) + tuberías que los unen en cadena
console.log(
  await ev(`(() => { const e = plExtUtil(), D = dsD(), tb = dsAgregar({ t: 'sim', k: 'tab', x: e[0], y: e[1], r: 0, capa: 'E-TABLEROS', nom: 'TG', nc: 40 });
  const cols = Math.ceil(Math.sqrt(${N})), dx = (e[2] - e[0]) / cols, dy = (e[3] - e[1]) / cols; let prev = null;
  for (let i = 0; i < ${N}; i++) { const x = e[0] + (i % cols) * dx, y = e[1] + Math.floor(i / cols) * dy;
    const l = dsAgregar({ t: 'sim', k: 'luz', x, y, r: 0, capa: 'E-ALUMBRADO' }), t = dsAgregar({ t: 'sim', k: 'toma', x: x + dx * 0.4, y, r: 0, capa: 'E-TOMACORRIENTES' }), s = dsAgregar({ t: 'sim', k: 'int', x, y: y + dy * 0.3, r: 0, capa: 'E-ALUMBRADO', enc: 'a' });
    const c = 'C-' + (1 + (i % 40));
    if (prev && i % cols) { dsAgregar({ t: 'tub', pts: [prev.x, prev.y, x, y], b: [0.2], modo: 'techo', capa: 'E-TUBERIAS-TECHO', c0: prev.id, c1: l.id, cir: c, cond: { f: 1, n: 1, t: true } }); }
    dsAgregar({ t: 'tub', pts: [x, y, x + dx * 0.4, y], modo: 'piso', capa: 'E-TUBERIAS-PISO', c0: l.id, c1: t.id, cir: c });
    prev = l; }
  dsAgregar({ t: 'cua', x: e[2], y: e[3], tit: 'CUADRO', capa: 'E-TEXTOS' }); return D.els.length + ' elementos'; })()`)
);
const med = async (nom, js, n = 3) => {
  const r = await ev(
    `(async () => { const ts = []; for (let i = 0; i < ${n}; i++) { const a = performance.now(); await (async () => { ${js} })(); ts.push(performance.now() - a); } return Math.round(Math.min(...ts)) + ' ms (mín de ${n})'; })()`
  );
  console.log(nom.padEnd(42), r);
};
await med("cuadro: dsBBox", "dsBBox(dsD().els.find(e => e.t === 'cua'))");
await med("edCambio (un cambio cualquiera)", "edCambio()");
await med("  · dsReconectar", "dsReconectar()");
await med("  · dsPropagarCircuitos", "dsPropagarCircuitos()");
await med("  · copia para deshacer (JSON)", "edSnap()");
await med("  · dsResumen (panel izquierdo)", "dsResumen()");
await med("  · dsVerificar (revisión)", "dsVerificar()");
await med("  · dsSueltos", "dsSueltos()");
await med("  · dcAvisos (datos para el cálculo)", "dcAvisos()");
await ev("plAjustar(); 1");
await med("dibujar todo (vista total)", "plPintar()");
await med("  · solo el diseño (dsPintar)", "dsPintar(plBase.getContext('2d'))");
await ev(
  "plVer(...(() => { const e = plExtUtil(); return [e[0], e[1], e[0] + (e[2]-e[0]) / 8, e[1] + (e[3]-e[1]) / 8]; })()); 1"
);
await med("dibujar todo (acercado)", "plPintar()");
await med("lienzo superior (plSobreDibujar)", "plSobreDibujar()");
await med("mover el cursor: dsHit", "const e = plExtUtil(); dsHit((e[0]+e[2])/2, (e[1]+e[3])/2, 0.1)", 5);
await med(
  "mover el cursor: plEnganche",
  "PLH.h = 'tubT'; const e = plExtUtil(); plEnganche((e[0]+e[2])/2, (e[1]+e[3])/2); PLH.h = null",
  5
);
await med("mover el cursor: dsPuntosEnganche", "dsPuntosEnganche()", 3);
await med("seleccionar todo + propiedades", "dsTodo()", 2);
await ev("DS_SEL.clear(); 1");
await med("lámina (laSvg)", "laSvg()", 1);
await med("DXF del diseño (laDxf)", "laDxf(false)", 1);
await med("guardar el proyecto (saveDraft)", "PLANO = clon(EPL); saveDraft()", 1);
console.log(
  "tamaño del diseño:",
  await ev("(JSON.stringify(EPL).length / 1e6).toFixed(2) + ' MB'"),
  "· historial deshacer:",
  await ev("ED.hist.length + ' copias = ' + (ED.hist.reduce((s, h) => s + h.length, 0) / 1e6).toFixed(1) + ' MB'")
);
for (let i = 0; i < 40; i++) await ev(`dsD().els[0].x += 0.001; edCambio(); 1`);
console.log(
  "deshacer tras 40 cambios:",
  await ev("ED.hist.length + ' pasos = ' + (ED.hist.reduce((s, h) => s + h.length, 0) / 1e6).toFixed(0) + ' MB'"),
  "· deshacer funciona:",
  await ev("(() => { const x = dsD().els[0].x; edHist(-1); return dsD().els[0].x < x; })()")
);
cerrar();
