/* Pruebas de la interfaz («npm run pruebas-ui»), solo para desarrollo.
   Abre index.html en Chrome sin ventana (protocolo DevTools), entra sin cuenta y recorre las ventanas como lo
   haría un usuario: abrir, editar, vista previa, aplicar, cancelar, deshacer, doble clic. Cada prueba verifica
   el resultado esperado; al final muestra cuáles pasaron. Las pruebas del cálculo son «npm test».
   Chrome lo abre herramientas/chrome.mjs. */
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { abrirApp, esperar, raiz } from "./chrome.mjs";

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

prueba("La cinta tiene sus 9 pestañas y solo 6 menús ▾", async ok => {
  await ejemplo("uni");
  ok((await ev("document.querySelectorAll('#ws > .ap-ribbon > .rib').length")) === 9, "9 pestañas");
  ok((await ev("document.querySelectorAll('.ap-ribbon .mc-caret').length")) === 6, "6 menús ▾");
  ok(await ev("document.querySelector('#ws .ap-right').hidden"), "panel derecho cerrado por defecto");
});

prueba("Cuadro de conductores: vista previa, cancelar y aplicar", async ok => {
  await ejemplo("uni");
  await ev("cuadroCond(true)");
  const dv0 = await ev("LAST.circ.find(q => /Ducha/.test(q.desc)).dVt");
  await ev(
    "(s => { s.value = s.options[2].value; s.dispatchEvent(new Event('change', {bubbles:true})); })(document.querySelector('#cdBody select'))"
  );
  const fila = await ev("document.querySelector('#cdBody tr:nth-child(2)').cells[6].textContent");
  ok(fila === "0.37", `ΔV del alimentador en la vista previa 0.37 % (dio ${fila})`);
  ok((await ev("LAST.alims[0].S")) === 16, "el proyecto sigue con 16 mm²");
  await clic('#condDlg [data-cd="cancel"].vw-btn');
  ok((await J("SECF.uni")) && !Object.keys(await J("SECF.uni")).length, "cancelar no cambia las secciones");
  await ev("cuadroCond(true)");
  await ev(
    "(s => { s.value = s.options[2].value; s.dispatchEvent(new Event('change', {bubbles:true})); })(document.querySelector('#cdBody select'))"
  );
  await clic('#condDlg [data-cd="ok"]');
  ok((await ev("LAST.alims[0].S")) === 35, "aplicado: alimentador de 35 mm²");
  ok((await ev("LAST.circ.find(q => /Ducha/.test(q.desc)).dVt")) < dv0, "baja la ΔV de los circuitos aguas abajo");
});

prueba("Ficha del circuito: vista previa, fase, aplicar y deshacer", async ok => {
  await ejemplo("uni");
  await ev(
    "document.querySelector('input[name=sist][value=tri380]').checked = true; document.querySelector('input[name=sist][value=tri380]').dispatchEvent(new Event('change', {bubbles:true})); calcularAhora(); fichaCirc('TG·C-6')"
  );
  await poner('[data-fce="L"]', 60);
  await esperar(400);
  ok(/2-1×10 mm²/.test(await ev("$('fcRes').textContent")), "vista previa con 10 mm² a 60 m");
  ok((await J("[cargas[0].L, LAST.circ.find(q => q.key === 'TG·C-6').S]")).join() === "12,4", "el proyecto no cambia");
  await poner('[data-fce="_fase"]', "T");
  await clic("#fichaDlg [data-fc=apply]");
  const q = await J("LAST.circ.find(q => q.key === FC_KEY)");
  ok(q.L === 60 && q.S === 10 && q.fase === "T", "aplicado: 60 m, 10 mm² y fase T");
  await ev("cerrarFicha()");
  await deshacer();
  const u = await J("({L: cargas[0].L, fix: FIX.uni, hist: HIST.length, sist: radio('sist')})");
  ok(u.L === 12 && !Object.keys(u.fix).length, "deshacer vuelve a 12 m y fase automática " + JSON.stringify(u));
});

prueba("Doble clic abre las fichas (explorador y cuadro de cargas)", async ok => {
  await ejemplo("uni");
  await ev("verVista('cuadro')");
  await dobleClic('#exTree [data-node="circ:TG·C-7"]');
  ok(/C-7/.test(await ev("$('fichaDlg').hidden ? '' : $('fcT').textContent")), "explorador → ficha del circuito");
  await ev("cerrarFicha()");
  await dobleClic("#results tr[data-ficha]");
  ok(!(await ev("$('fichaDlg').hidden")), "fila del cuadro → ficha del circuito");
  await ev("cerrarFicha()");
  await dobleClic("#results tr[data-fichatab]");
  ok(/TG/.test(await ev("$('ftDlg').hidden ? '' : $('ftT').textContent")), "franja del tablero → ficha del tablero");
  await tecla("Escape", "Escape", 27);
  ok(await ev("$('ftDlg').hidden"), "Esc cierra la ficha del tablero");
});

prueba("Ficha del tablero: longitud con vista previa y equipos", async ok => {
  await ejemplo("multi");
  const tA = await ev("LAST.circ.find(q => q.src && q.src.t === 'tipo' && q.src.i === 0).tab");
  await ev(`fichaTablero('${tA}')`);
  await poner("[data-ftl]", 80);
  await esperar(500);
  ok(/2-1×16/.test(await ev("$('ftBody').textContent")), "vista previa: alimentador de 16 mm² a 80 m");
  ok((await ev("tipos[0].Ld")) === 25, "el proyecto sigue en 25 m");
  await clic("#ftDlg [data-ft=apply]");
  ok((await ev("tipos[0].Ld")) === 80, "aplicado: 80 m");
  await clic("[data-ftp=eq]");
  await ev(
    "(c => { c.checked = true; c.dispatchEvent(new Event('change', {bubbles:true})); })(document.querySelector('[data-fteq=dps]'))"
  );
  await clic("#ftDlg [data-ft=ok]");
  ok((await J("TEQ.multi"))[tA]?.dps === true, "DPS guardado en el tablero");
});

prueba("Editor de cargas: botón rápido, vista previa y aplicar", async ok => {
  await ejemplo("multi");
  await ev("tablaCargas('cargasT')");
  await poner('[data-tce="L"]', 50);
  await esperar(400);
  ok(/2-1×4 mm²/.test(await ev("$('tcRes').textContent")), "vista previa: terma a 50 m necesita 4 mm²");
  ok((await ev("cargasT[0].L")) === 15, "el proyecto sigue en 15 m");
  await clic('#tcDlg [data-tca="cancel"].vw-btn');
  await ev("tablaCargas('cargasT')");
  await clic('[data-rap^="calentador|Ducha"]');
  await poner('[data-tce="p"]', 3500);
  await poner('[data-tce="L"]', 14);
  await clic("#tcDlg [data-tca=ok]");
  ok((await ev("cargasT.length")) === 4, "cuatro cargas tras aplicar");
  ok((await ev("LAST.circ.filter(q => q.src && q.src.t === 'cargasT').length")) === 4, "cada carga con su circuito");
});

prueba("Parámetros de diseño: vista previa y aplicar", async ok => {
  await ejemplo("uni");
  await ev("parametros(true); document.querySelector('[data-ppt=cond]').click()");
  await poner("[data-pp=temp]", 45);
  await esperar(500);
  ok(/Vista previa/.test(await ev("$('ppRes').textContent")), "franja con vista previa");
  ok((await ev("$('temp').value")) === "30", "el proyecto sigue a 30 °C");
  await poner("[data-pp=met]", "A1");
  await clic("#ppDlg [data-ppa=ok]");
  ok((await ev("$('met').value")) === "A1" && (await ev("$('temp').value")) === "45", "aplicado: A1 y 45 °C");
  ok(await ev("recomendaciones(LAST).some(x => /A1/.test(x.tit))"), "aparece la recomendación del método A1");
});

prueba("Datos del proyecto: vista previa, tipo de edificación y deshacer", async ok => {
  await ejemplo("uni");
  await ev("datosProyecto(true, 'viv')");
  await poner('[data-dp="area"]', 300);
  await esperar(500);
  ok(/MD 11.00 kW/.test(await ev("$('dpRes').textContent")), "vista previa: 11 kW con 300 m²");
  ok((await ev("LAST.md.MD")) === 9000, "el proyecto sigue en 9 kW");
  await clic("#dpDlg [data-dpa=cancel].vw-btn");
  await ev("datosProyecto(true, 'proy')");
  await poner('[data-dp="_tipo"]', "multi");
  await clic("#dpDlg [data-dpa=apply]");
  ok((await ev("MODE")) === "multi", "cambia a edificio multifamiliar");
  await ev("datosProyecto(false)");
  await deshacer();
  ok((await ev("MODE")) === "uni", "deshacer vuelve a vivienda");
});

prueba("Editor de departamentos: salidas, cargas, duplicar y quitar", async ok => {
  await ejemplo("multi");
  await ev("datosProyecto(true, 'dep')");
  await clic('[data-ddsel="1"]');
  await clic('[data-ddadd="lumsT"]');
  await poner('[data-dd="lumsT|0|n"]', 4);
  await poner('[data-dd="lumsT|0|p"]', 20);
  await clic('[data-ddrap^="cocina"]');
  const i = await ev("DPD.cargasT.length - 1");
  await poner(`[data-dd="cargasT|${i}|p"]`, 8000);
  await poner(`[data-dd="cargasT|${i}|L"]`, 10);
  await esperar(400);
  ok(/MD 13.50 kW por dpto/.test(await ev("$('ddRes').textContent")), "vista previa: 13.5 kW por departamento");
  ok(!(await ev("lumsT.length")), "el proyecto no cambia antes de aplicar");
  await clic('[data-dda="dup"]');
  await clic("#dpDlg [data-dpa=apply]");
  const r = await J("({t: tipos.length, l: lumsT.length, c: cargasT.filter(x => x.tipo === 'cocina').length})");
  ok(r.t === 3 && r.l === 2 && r.c === 2, "el duplicado lleva sus salidas y cargas");
  await clic('[data-ddsel="2"]');
  await clic('[data-dda="del"]');
  await clic("#dpDlg [data-dpa=ok]");
  ok((await ev("tipos.length")) === 2 && (await ev("lumsT.length")) === 1, "quitar el tipo quita también lo suyo");
});

prueba("Panel del proyecto: resumen, elemento elegido y por revisar", async ok => {
  await ejemplo("uni");
  ok(
    !(await ev("document.querySelector('#propBody input, #propBody select, #propBody fieldset')")),
    "el panel no tiene campos para editar"
  );
  ok(
    /MD|Máxima demanda/.test(await ev("$('propBody').textContent")) &&
      /Conforme/.test(await ev("$('propBody').textContent")),
    "resumen con la máxima demanda y el estado"
  );
  await ev("selNode('circ:TG·C-6')");
  ok(/C-6 · Ducha eléctrica/.test(await ev("$('propBody').textContent")), "muestra el circuito elegido");
  await clic('#propBody .pp-abrir[data-node="circ:TG·C-6"]');
  ok(!(await ev("$('fichaDlg').hidden")), "«Abrir ficha del circuito» abre la ficha");
  await ev("cerrarFicha()");
  // Un dato que falta: aparece en Por revisar y abre su ventana con el dato enfocado
  await ev("cambiarDato('Lalim', ''); calcularAhora()");
  ok(
    await ev("!!document.querySelector('#propBody .pp-it.falta[data-foco=Lalim]')"),
    "el dato que falta aparece en Por revisar"
  );
  await clic("#propBody .pp-it.falta[data-foco=Lalim]");
  await esperar(250);
  ok(
    !(await ev("$('dpDlg').hidden")) && (await ev("document.activeElement.dataset.dp")) === "Lalim",
    "abre Datos del proyecto con la longitud enfocada"
  );
  // Las secciones se ocultan y muestran desde la cinta; al activar una con el panel cerrado, el panel se abre
  await ev(
    "document.querySelectorAll('.vw-ov').forEach(x => x.hidden = true); cambiarDato('Lalim', '15'); calcularAhora(); PANE.right.on = false; panes(false)"
  );
  await clic("[data-ppv=sel]");
  await clic("[data-ppv=rev]");
  ok((await ev("document.querySelectorAll('#propBody .pp-sec').length")) === 1, "solo queda el resumen");
  await clic("[data-ppv=sel]");
  ok(await ev("PANE.right.on"), "al activar una sección se abre el panel");
  await clic("[data-ppv=rev]");
  ok((await ev("document.querySelectorAll('#propBody .pp-sec').length")) === 3, "vuelven las tres secciones");
});

prueba("La cinta y los «Ir a…» abren la ventana del dato", async ok => {
  await ejemplo("uni");
  await ev(
    "document.querySelector('[data-tab-r=param]').click(); document.querySelector('.ap-ribbon [data-foco=met]').click()"
  );
  await esperar(250);
  ok(
    !(await ev("$('ppDlg').hidden")) && (await ev("document.activeElement.dataset.pp")) === "met",
    "Método de instalación → Parámetros con el dato enfocado"
  );
  await ev(
    "parametros(false); document.querySelector('[data-tab-r=proyecto]').click(); document.querySelector('.ap-ribbon [data-act=modo]').click()"
  );
  await esperar(250);
  ok(
    (await ev("document.activeElement.dataset.dp")) === "_tipo",
    "Tipo de edificación → Datos del proyecto con el tipo enfocado"
  );
  await ev("datosProyecto(false); document.querySelector('.ap-ribbon .rb[data-fs=fs-pisos]').click()");
  ok((await ev("DP_TAB")) === "pis" && !(await ev("$('dpDlg').hidden")), "Pisos y tableros → pestaña Pisos");
  await ev(
    "datosProyecto(false); document.querySelector('[data-tab-r=cargas]').click(); document.querySelector('.ap-ribbon [data-act=\"add:cctv\"]').click()"
  );
  ok(
    !(await ev("$('tcDlg').hidden")) && /CCTV/.test(await ev("$('tcForm').textContent")),
    "Videovigilancia agrega la carga y abre el editor en ella"
  );
  await ev(
    "cerrarTabla(); cargas[cargas.length - 1].p = 300; cargas[cargas.length - 1].L = 15; renderList('cargas'); cambiarDato('met', 'A1'); calcularAhora(); verVista('verif')"
  );
  const b = "document.querySelector('#results .rec-card [data-foco=met], #propBody .pp-it[data-foco=met]')";
  ok(await ev(`!!${b}`), "la recomendación del método A1 tiene su «Ir a…»");
  await ev(`${b}.click()`);
  await esperar(250);
  ok((await ev("document.activeElement.dataset.pp")) === "met", "«Ir a…» abre Parámetros con el método enfocado");
});

prueba("Las ventanas se mueven y no salen de la pantalla", async ok => {
  await ejemplo("uni");
  await ev("cuadroCond(true)");
  const g = await J("CD_VW.leer()");
  await raton("mousePressed", g.x + 200, g.y + 15);
  await raton("mouseMoved", g.x + 100, g.y + 75);
  await raton("mouseReleased", g.x + 100, g.y + 75);
  const g2 = await J("CD_VW.leer()");
  ok(g2.x === g.x - 100 && g2.y === g.y + 60, "arrastrar la barra mueve la ventana");
  await ev("CD_VW.poner({x: -500, y: -500, w: 5000, h: 5000})");
  const g3 = await J("CD_VW.leer()");
  ok(g3.x >= 8 && g3.y >= 8 && g3.x + g3.w <= 1366 && g3.y + g3.h <= 768, "la ventana queda dentro de la pantalla");
});

prueba("Datos del proyecto: pisos (lista) y circuitos del 1er piso en un TD-1", async ok => {
  await ejemplo("uni");
  await ev(
    "pisos.push({area: 80, Ld: 9, al_n: 10, al_L: 16, tg_n: 12, tg_L: 18, tc_n: 0, tc_L: null, aE: 0}); renderList('pisos'); calcularAhora(); datosProyecto(true, 'pis')"
  );
  await poner('[data-dp="pisos_area_0"]', 95);
  await poner('[data-dp="esqPisos"]', "td");
  // La longitud TG → TD-1 aparece al aplicar la elección del TD-1
  await clic("#dpDlg [data-dpa=apply]");
  ok(await ev("!!document.querySelector('[data-dp=Ltd1]')"), "al aplicar aparece la longitud al TD-1");
  await poner('[data-dp="Ltd1"]', 6);
  await clic("#dpDlg [data-dpa=ok]");
  ok((await ev("pisos[0].area")) === 95, "el área del 2do piso pasa a su lista (95 m²)");
  ok(
    (await ev("PROY.esqPisos")) === "td" && (await ev("LAST.tabs.some(t => t.tab === 'TD-1')")),
    "aparece el tablero TD-1"
  );
  ok(
    await ev(
      "[...document.querySelectorAll('#L_cargas select')].some(s => [...s.options].some(o => /TD-1/.test(o.textContent)))"
    ),
    "las cargas especiales ya pueden ir al TD-1 (efecto de cambiar el dato)"
  );
});

prueba("Doble clic en cada elemento del explorador abre su ventana", async ok => {
  // Ventana (o vista) que debe quedar abierta tras el doble clic en cada elemento
  const abierta = async () =>
    ev(
      "['dpDlg','ppDlg','tcDlg','fichaDlg','ftDlg','condDlg'].find(d => !$(d).hidden) || (VIEW === 'metrado' ? 'metrado' : '')"
    );
  const cerrar = () =>
    ev(
      "cerrarFicha(); cerrarTablero(); cerrarTabla(); cuadroCond(false); parametros(false); datosProyecto(false); verVista('resumen')"
    );
  for (const m of ["uni", "multi"]) {
    await ejemplo(m);
    const nodos = await J("[...document.querySelectorAll('#exTree [data-node]')].map(x => x.dataset.node)");
    for (const nd of nodos) {
      await dobleClic(`#exTree [data-node="${nd}"]`);
      await esperar(150);
      const v = await abierta();
      ok(!!v, `${m}: «${nd}» abre una ventana`);
      await cerrar();
    }
  }
});

prueba("Lo que se escribe en el panel pasa a los datos del proyecto (PROY)", async ok => {
  await ejemplo("uni");
  await ev("selNode('vivienda')");
  await poner("#area", 200);
  ok(
    (await ev("PROY.area")) === "200" && (await ev("estado().area")) === "200",
    "área escrita en el panel → PROY y estado()"
  );
  ok((await ev("LAST.md.MD")) === 10000, "el cálculo usa el área nueva: 200 m² → 10 kW (Regla 050-200)");
  await ev(
    "(r => { r.checked = true; r.dispatchEvent(new Event('change', {bubbles:true})); })(document.querySelector('input[name=sist][value=tri380]'))"
  );
  ok(
    (await ev("PROY.sist")) === "tri380" && (await ev("LAST.alims[0].s.tri")),
    "sistema elegido → PROY y cálculo trifásico"
  );
  await poner("#uso", "oficina");
  ok((await ev("PROY.tg_p")) === "250", "al pasar a oficina, 250 VA por tomacorriente también en PROY");
});

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

prueba("Editor de diseño: plano, capas, plantas, deshacer, aplicar, cancelar y guardado", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  ok(await ev("!$('editor').hidden && document.body.classList.contains('ed-on')"), "el editor ocupa la pantalla");
  ok(await ev("EPL.f === 1 && EPL.de === 'cotas'"), "unidad: metros según las cotas (la cabecera dice mm)");
  ok(await ev("PLANO === null && !$('edSucio').hidden"), "el proyecto no cambia hasta aplicar");
  ok(await ev("['OCULTA', 'CONGELADA'].every(c => EPL.ocultas.includes(c))"), "capas apagada y congelada ocultas");
  // Capas en su ventana (Administrador de capas)
  await clic('#editor [data-pl="capas"]');
  ok(
    (await ev("document.querySelectorAll('#caTabla tr[data-caa]').length")) === 8,
    "8 capas de la arquitectura en la ventana"
  );
  const hist0 = await ev("HIST.length");
  await clic('#caTabla tr[data-caa="EJES"] input[data-caf="vis"]');
  ok(await ev("EPL.ocultas.includes('EJES')"), "ocultar la capa EJES");
  await clic('[data-ca="cerrar"]');
  await ctrlZ();
  ok(await ev("!EPL.ocultas.includes('EJES')"), "Ctrl+Z deshace en el editor");
  ok((await ev("HIST.length")) === hist0 && (await ev("PLANO === null")), "el deshacer del proyecto no se toca");
  await clic('#editor [data-pl="planta"]');
  await clicPlano(OX - 0.5, OY - 0.5, 0);
  await clicPlano(OX + 10.5, OY + 8.5, 0);
  ok((await ev("$('plCmdV').value")) === "1er piso", "nombre propuesto para la planta");
  await clic("#plCmdOk");
  ok(await ev("EPL.plantas.length === 1 && EPL.plantas[0].n === '1er piso'"), "planta encuadrada");
  await clic('[data-ed="aplicar"]');
  ok(
    await ev("PLANO && PLANO.plantas.length === 1 && $('edSucio').hidden && $('edAplicar').disabled"),
    "Aplicar pasa el plano y la planta al proyecto"
  );
  // Un cambio sin aplicar y Cancelar: pide confirmación y no llega al proyecto
  await clic('#editor [data-pl="capas"]');
  await clic('#caTabla tr[data-caa="EJES"] input[data-caf="vis"]');
  await clic('[data-ca="cerrar"]');
  await clic('[data-ed="cancelar"]');
  ok(await ev("!$('cfmDlg').hidden"), "Cancelar con cambios pide confirmación");
  await clic("#cfmSi");
  ok(
    await ev("$('editor').hidden && !PLANO.ocultas.includes('EJES')"),
    "cerrar sin aplicar: el proyecto queda como estaba"
  );
  ok(/plano-prueba\.dxf/.test(await ev("$('plInfo').textContent")), "la pestaña Diseño muestra el plano del proyecto");
  // El proyecto guardado vuelve a abrir el plano desde la base de datos del navegador
  await ev(
    "(() => { const o = JSON.parse(JSON.stringify(estado())); PL_MOD = null; PL_SHA = null; aplicar(o); edAbrir(false); })()"
  );
  for (let i = 0; i < 40 && !(await ev("!!PL_MOD")); i++) await esperar(100);
  ok(await ev("!!PL_MOD && EPL.plantas.length === 1"), "el plano se vuelve a leer del navegador con sus plantas");
  await clic('[data-ed="aceptar"]');
  ok(await ev("$('editor').hidden"), "Aceptar cierra el editor");
});

prueba("Editor de diseño: selección, distancia con enganche, recorrido, objetos y escala", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Un clic en el muro (sin herramienta) lo selecciona y muestra sus propiedades
  await clicPlano(OX + 10, OY + 3, 0);
  const pr = await ev("$('edPropC').textContent");
  ok(
    /Polilínea/.test(pr) && /36\.00 m/.test(pr) && /80\.00 m²/.test(pr),
    `muro: polilínea de 36.00 m y 80.00 m² (${pr.slice(0, 90)})`
  );
  await tecla("Escape", "Escape", 27);
  ok(/Plano de arquitectura/.test(await ev("$('edPropC').textContent")), "Esc suelta la selección");
  await clic('#editor [data-pl="dist"]');
  await clicPlano(OX, OY);
  await clicPlano(OX + 10, OY);
  ok(/^Distancia 10\.00 m/.test(await orden()), `distancia entre esquinas enganchadas: 10.00 m (${await orden()})`);
  await clic('#editor [data-pl="rec"]');
  await clicPlano(OX, OY);
  await clicPlano(OX + 10, OY);
  await clicPlano(OX + 10, OY + 8);
  await tecla("Enter", "Enter", 13);
  await esperar(80);
  ok(/^Recorrido 18\.00 m · 2 tramos/.test(await orden()), `recorrido de dos tramos: 18.00 m (${await orden()})`);
  await clic('#editor [data-pl="obj"]');
  await clicPlano(OX + 2, OY + 1, 0);
  ok(/^1 objeto · 5\.14 m/.test(await orden()), `tubería con curva: 5.14 m (${await orden()})`);
  await clic('#editor [data-pl="escala"]');
  await clicPlano(OX, OY);
  await clicPlano(OX + 10, OY);
  ok((await ev("$('plCmdV').value")) === "10.00", "la medida en el dibujo se propone como medida real");
  await poner("#plCmdV", "20");
  await clic("#plCmdOk");
  ok(await ev("EPL.f === 2 && EPL.de === 'manual'"), "escala comprobada: 1 unidad = 2 m");
  await ctrlZ();
  ok(await ev("EPL.f === 1"), "Ctrl+Z vuelve a la escala anterior");
  await clic('[data-ed="aceptar"]');
  ok(await ev("$('editor').hidden && PLANO.f === 1"), "Aceptar pasa el plano al proyecto");
});

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

prueba("Editor de diseño: símbolos DGE, enganche, mover, girar, borrar, tuberías, capas y guardado", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  ok(
    await ev("EPL.dis && EPL.dis.capas.length === 14 && !EPL.dis.els.length"),
    "diseño nuevo con sus 14 capas (con la de áreas)"
  );
  // Una luminaria en el centro de la sala y un tomacorriente que se encaja en el muro
  await clic('#editor [data-pl="col:luz"]');
  await clicPlano(OX + 1.5, OY + 6, 0);
  await clic('#editor [data-pl="col:toma"]');
  await clicPlano(OX + 0.06, OY + 4.06, 0);
  await teclaE("Escape", "Escape", 27);
  const els = await J("EPL.dis.els.map(e => [e.k, e.x, e.y, e.capa])");
  ok(
    els.length === 2 && els[0][0] === "luz" && Math.abs(els[0][1] - OX - 1.5) < 0.03 && els[0][3] === "E-ALUMBRADO",
    `luminaria (DGE 09-93-51) en la capa E-ALUMBRADO (${JSON.stringify(els[0])})`
  );
  // Encajado en el muro: sus líneas de llegada tocan el muro (x = 0) y queda mirando hacia la sala
  const ext = await ev("-DS_BB.toma[0] * dsU()");
  ok(
    els[1] &&
      Math.abs(els[1][1] - OX - ext) < 1e-6 &&
      Math.abs(els[1][2] - OY - 4.06) < 0.02 &&
      els[1][3] === "E-TOMACORRIENTES",
    `tomacorriente encajado en el muro (${JSON.stringify(els[1] && [els[1][1] - OX, els[1][2] - OY])})`
  );
  ok((await ev("EPL.dis.els[1].r")) === 0, "girado según el muro");
  ok(/Salida de alumbrado en techo/.test(await ev("$('dsResumen').textContent")), "el resumen cuenta lo colocado");
  // Mover la luminaria arrastrándola, girarla con R, deshacer y borrarla con Supr
  await arrastrarPlano([OX + 1.5, OY + 6], [OX + 2.5, OY + 6.5]);
  const lum = await J("EPL.dis.els[0]");
  ok(
    Math.abs(lum.x - OX - 2.5) < 0.05 && Math.abs(lum.y - OY - 6.5) < 0.05,
    `arrastrar mueve la luminaria (${lum.x - OX}, ${lum.y - OY})`
  );
  await teclaE("r", "KeyR", 82);
  ok((await ev("EPL.dis.els[0].r")) === 90, "R la gira 90°");
  await ctrlZ();
  ok((await ev("EPL.dis.els[0].r")) === 0, "Ctrl+Z deshace el giro");
  await teclaE("Delete", "Delete", 46);
  ok((await ev("EPL.dis.els.length")) === 1 && (await ev("EPL.dis.els[0].k")) === "toma", "Supr borra lo seleccionado");
  // Tubería por piso de dos tramos rectos
  await poner("#dsTrazo", "recto");
  await clic('#editor [data-pl="tubP"]');
  await clicPlano(OX, OY);
  await clicPlano(OX + 10, OY);
  await clicPlano(OX + 10, OY + 8);
  await teclaE("Enter", "Enter", 13);
  const tub = await J("EPL.dis.els.find(e => e.t === 'tub')");
  ok(
    tub && tub.modo === "piso" && tub.pts.length === 6 && tub.capa === "E-TUBERIAS-PISO",
    "tubería por piso de dos tramos"
  );
  ok(/Tubería en piso\s*18\.00 m/.test(await ev("$('dsResumen').textContent")), "el resumen suma 18.00 m de tubería");
  await teclaE("Escape", "Escape", 27);
  // Marco de selección de derecha a izquierda (captura) sobre todo el dibujo
  await arrastrarPlano([OX + 9, OY + 5], [OX - 0.3, OY + 3]);
  ok((await ev("DS_SEL.size")) === 2, "el marco de captura selecciona los dos elementos");
  await teclaE("Escape", "Escape", 27);
  // Administrador de capas: capa nueva, actual y una línea en ella; capa oculta no se selecciona
  await clic('#editor [data-pl="capas"]');
  ok(await ev("!$('capasDlg').hidden"), "el botón Capas abre su ventana");
  await clic('[data-ca="nueva"]');
  await poner("#caTabla tr.sel input[data-caf='n']", "E-PRUEBA");
  await clic('[data-ca="actual"]');
  ok(await ev("EPL.dis.actual === 'E-PRUEBA'"), "capa nueva renombrada y actual");
  await clic('#caTabla tr[data-cad="E-TOMACORRIENTES"] input[data-caf="vis"]');
  ok(await ev("dsCapa('E-TOMACORRIENTES').vis === false"), "ocultar la capa E-TOMACORRIENTES");
  await clic('[data-ca="cerrar"]');
  ok((await ev(`dsHit(${OX}, ${OY + 4}, 0.1)`)) === null, "lo de una capa oculta no se selecciona");
  await clic('#editor [data-pl="lin"]');
  await clicPlano(OX + 1, OY + 1, 0);
  await clicPlano(OX + 4, OY + 1, 0);
  ok(await ev("EPL.dis.els.some(e => e.t === 'lin' && e.capa === 'E-PRUEBA')"), "la línea va a la capa actual");
  // Aplicar: el diseño pasa al proyecto y vuelve igual al abrirlo de nuevo
  await clic('[data-ed="aceptar"]');
  const n = await ev("PLANO.dis.els.length");
  await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
  ok(n === 3 && (await ev("PLANO.dis.els.length")) === 3, "el diseño se guarda y se vuelve a abrir con el proyecto");
  ok(/3 elementos del diseño/.test(await ev("$('plInfo').textContent")), "la pestaña Diseño cuenta los elementos");
});

prueba("Editor de diseño: tuberías curvas, pinzamientos, cotas, directriz y longitud escrita", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Tubería curva de 2 m de cuerda: arco de 45°, longitud 2 / (2 sen 22.5°) × π/4 = 2.052 m
  await poner("#dsTrazo", "curvo");
  await clic('#editor [data-pl="tubT"]');
  await clicPlano(OX + 1.2, OY + 6, 0);
  await clicPlano(OX + 3.2, OY + 6, 0);
  await teclaE("Enter", "Enter", 13);
  const L = await ev("dsLargo(EPL.dis.els[0])");
  ok(Math.abs(L - 2.0523) < 0.002, `tramo curvo: longitud del arco 2.052 m (${L.toFixed(4)})`);
  ok((await ev("EPL.dis.els[0].capa")) === "E-TUBERIAS-TECHO", "en la capa E-TUBERIAS-TECHO");
  ok(/2\.05 m/.test(await ev("$('dsResumen').textContent")), "el resumen suma la longitud del arco");
  await teclaE("Escape", "Escape", 27);
  // Pinzamiento: mover el vértice final 1 m hacia arriba
  await clicPlano(OX + 2.2, OY + 6 + (await ev("dsTramos(EPL.dis.els[0])[0].m[1] - " + (OY + 6))), 0);
  ok((await ev("DS_SEL.size")) === 1, "clic en la tubería la selecciona");
  await arrastrarPlano([OX + 3.2, OY + 6], [OX + 3.2, OY + 7]);
  const p = await J("EPL.dis.els[0].pts");
  ok(
    Math.abs(p[3] - OY - 7) < 0.05 && Math.abs(p[1] - OY - 6) < 1e-6,
    "arrastrar el vértice lo mueve sin mover el otro"
  );
  await poner('#edPropC [data-dsp="modo"]', "piso");
  ok(
    await ev("EPL.dis.els[0].modo === 'piso' && EPL.dis.els[0].capa === 'E-TUBERIAS-PISO'"),
    "pasar a piso cambia su capa"
  );
  await clic('#edPropC [data-dsa="recto"]');
  ok(await ev("!EPL.dis.els[0].b"), "Enderezar deja los tramos rectos");
  await teclaE("Escape", "Escape", 27);
  // Cota alineada del muro inferior: 10.00 m
  await clic('#editor [data-pl="cotA"]');
  await clicPlano(OX, OY);
  await clicPlano(OX + 10, OY);
  await clicPlano(OX + 5, OY - 0.7, 0);
  const c = await J("EPL.dis.els.find(e => e.t === 'cot')");
  ok(
    c &&
      c.capa === "E-COTAS" &&
      Math.abs((await ev("dsCotaGeo(EPL.dis.els.find(e => e.t === 'cot')).med")) - 10) < 1e-9,
    "cota de 10.00 m en E-COTAS"
  );
  ok(c && Math.abs(c.o + 0.7) < 0.05, "línea de cota desplazada 0.70 m");
  // Directriz con texto
  await clic('#editor [data-pl="dir"]');
  await clicPlano(OX + 2, OY + 2, 0);
  await clicPlano(OX + 3, OY + 3, 0);
  await poner("#plCmdV", "C-1");
  await clic("#plCmdOk");
  ok(
    await ev("EPL.dis.els.some(e => e.t === 'dir' && e.s === 'C-1' && e.capa === 'E-CIRCUITOS')"),
    "directriz con texto en E-CIRCUITOS"
  );
  await teclaE("Escape", "Escape", 27);
  // Línea con longitud escrita: 3 m hacia la derecha
  await clic('#editor [data-pl="lin"]');
  await clicPlano(OX + 1, OY + 1.5, 0);
  await moverPlano(OX + 2.5, OY + 1.5);
  await cdp("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "3",
    code: "Digit3",
    windowsVirtualKeyCode: 51,
    text: "3"
  });
  await esperar(60);
  ok(
    !(await ev("$('plCmdIn').hidden")) && (await ev("$('plCmdV').value")) === "3",
    "escribir un número pide la longitud"
  );
  await teclaE("Enter", "Enter", 13);
  const l = await J("EPL.dis.els.filter(e => e.t === 'lin').pop()");
  ok(l && Math.abs(l.pts[2] - l.pts[0] - 3) < 1e-9 && Math.abs(l.pts[3] - l.pts[1]) < 1e-9, "línea de 3.00 m exactos");
  await teclaE("Escape", "Escape", 27);
  // Aplicar y volver a abrir: se conservan las curvas, la cota y la directriz
  await clic('[data-ed="aceptar"]');
  await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
  ok(
    await ev(
      "PLANO.dis.els.some(e => e.t === 'cot') && PLANO.dis.els.some(e => e.t === 'dir') && PLANO.dis.etq === 'total'"
    ),
    "cota, directriz y longitudes se guardan"
  );
});

prueba("Editor de diseño: tablero con circuitos (doble clic) y tubería desde su salida", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Tablero encajado en el muro superior: se llama TG
  await clic('#editor [data-pl="col:tab"]');
  await clicPlano(OX + 3, OY + 7.9, 0);
  await teclaE("Escape", "Escape", 27);
  const tab = await J("EPL.dis.els.find(e => e.k === 'tab')");
  ok(tab && tab.nom === "TG" && tab.r === 180, `tablero TG encajado en el muro (${tab && tab.r}°)`);
  // Doble clic: ventana con nombre y número de circuitos
  const [X, Y] = await J(
    `(() => { const [X, Y] = plAPant(${tab.x}, ${tab.y}), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
  );
  for (const n of [1, 2]) {
    await cdp("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: X,
      y: Y,
      button: "left",
      buttons: 1,
      clickCount: n
    });
    await cdp("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: X,
      y: Y,
      button: "left",
      buttons: 0,
      clickCount: n
    });
  }
  await esperar(150);
  ok(await ev("!$('tabDlg').hidden"), "doble clic en el tablero abre su ventana");
  await poner("#taN", "8");
  ok((await ev("$('taLista').querySelectorAll('input').length")) === 8, "la lista muestra C-1 a C-8");
  await poner("#taLista input", "Alumbrado sala");
  await clic('[data-ta="ok"]');
  ok(
    await ev(
      "EPL.dis.els.find(e => e.k === 'tab').nc === 8 && EPL.dis.els.find(e => e.k === 'tab').cd[0] === 'Alumbrado sala'"
    ),
    "8 circuitos y su descripción"
  );
  const sal = await J("dsSalidasTab(EPL.dis.els.find(e => e.k === 'tab')).map(o => [o.n, o.p[0], o.p[1]])");
  ok(sal.length === 8 && sal[0][1] < sal[7][1], "salidas C-1 a C-8 de izquierda a derecha");
  // Tubería que empieza en la salida C-3: toma ese circuito
  await clic('#editor [data-pl="tubT"]');
  await clicPlano(sal[2][1], sal[2][2], 0);
  await clicPlano(OX + 1.5, OY + 6, 0);
  await teclaE("Enter", "Enter", 13);
  const tub = await J("EPL.dis.els.find(e => e.t === 'tub')");
  ok(tub && tub.cir === "C-3" && tub.tab === tab.id, `la tubería es del circuito C-3 del TG (${tub && tub.cir})`);
  await clic('[data-ed="aceptar"]');
  await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
  ok(
    await ev("PLANO.dis.els.find(e => e.k === 'tab').nc === 8 && PLANO.dis.els.find(e => e.t === 'tub').cir === 'C-3'"),
    "se guarda con el proyecto"
  );
});

prueba(
  "Editor de diseño: biblioteca, giro libre, letra movible, color y Ctrl+X en el diseño y la arquitectura",
  async ok => {
    await ejemplo("uni");
    await abrirPlano();
    // Biblioteca de símbolos (tecla B): buscador por nombre o código de la norma
    await teclaE("b", "KeyB", 66);
    await esperar(80);
    ok(await ev("!$('bibDlg').hidden"), "la tecla B abre la biblioteca de símbolos");
    ok(
      await ev("$('biRejilla').querySelectorAll('[data-bik]').length === Object.keys(DS_CAT).length"),
      "la biblioteca muestra todos los símbolos"
    );
    await poner("#biBusca", "caja de paso");
    ok(
      (await ev("$('biRejilla').querySelector('[data-bik]').dataset.bik")) === "caja",
      "buscar «caja de paso» encuentra la caja (09-93-08)"
    );
    await poner("#biBusca", "09-93-17");
    await ev("$('biBusca').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))");
    ok(await ev("$('bibDlg').hidden && PLH.h === 'col:toma'"), "Enter elige el primero: el tomacorriente queda listo");
    ok(await ev("biRecientes()[0] === 'toma'"), "queda entre los usados hace poco");
    // Sin encajar en el muro: el tomacorriente se coloca suelto en el ambiente
    await ev("DSU.alinear = false; 1");
    await clicPlano(OX + 3.3, OY + 4.1, 0);
    await teclaE("Escape", "Escape", 27);
    await ev("DSU.alinear = true; 1");
    const t = await J("EPL.dis.els.find(e => e.k === 'toma')");
    ok(t && !t.r, "tomacorriente colocado");
    // Giro libre con su pinzamiento redondo
    await clicPlano(t.x, t.y, 0);
    const g = await J(`dsAgarres(EPL.dis.els.find(e => e.id === '${t.id}')).find(a => a.t === 'giro')`);
    ok(!!g, "el símbolo seleccionado tiene pinzamiento de giro");
    const a = ((37 + 90) * Math.PI) / 180;
    await arrastrarPlano([g.x, g.y], [t.x + 0.6 * Math.cos(a), t.y + 0.6 * Math.sin(a)]);
    const r1 = await ev(`EPL.dis.els.find(e => e.id === '${t.id}').r`);
    ok(Math.abs(r1 - 37) < 0.6, `giro libre a 37° (${r1}°)`);
    await poner('#edPropC [data-dsp="r"]', "12.5");
    ok((await ev(`EPL.dis.els.find(e => e.id === '${t.id}').r`)) === 12.5, "rotación escrita con decimales: 12.5°");
    // La letra T se mueve con su pinzamiento y vuelve a su lugar
    const l = await J(`dsAgarres(EPL.dis.els.find(e => e.id === '${t.id}')).find(a => a.t === 'letra')`);
    ok(!!l, "la letra del tipo tiene pinzamiento");
    await arrastrarPlano([l.x, l.y], [l.x + 0.25, l.y + 0.1]);
    ok(await ev(`!!EPL.dis.els.find(e => e.id === '${t.id}').dt`), "la letra se corrió");
    await clic('#edPropC [data-dsa="letra0"]');
    ok(await ev(`!EPL.dis.els.find(e => e.id === '${t.id}').dt`), "«Letra a su lugar» la devuelve");
    // Color propio y «Por capa»
    await poner('#edPropC [data-dsp="col"]', "#ff0000");
    ok((await ev(`EPL.dis.els.find(e => e.id === '${t.id}').col`)) === "#ff0000", "color propio del elemento");
    await clic('#edPropC [data-dsa="colcapa"]');
    ok(await ev(`!EPL.dis.els.find(e => e.id === '${t.id}').col`), "«Por capa» vuelve al color de la capa");
    // Ctrl+X corta lo del diseño y Ctrl+V lo pega
    await teclaE("x", "KeyX", 88, 2);
    ok(
      await ev(`!EPL.dis.els.some(e => e.id === '${t.id}') && DS_PORTA.length === 1`),
      "Ctrl+X corta el tomacorriente"
    );
    await teclaE("v", "KeyV", 86, 2);
    ok(await ev("EPL.dis.els.some(e => e.k === 'toma')"), "Ctrl+V lo pega");
    await teclaE("Escape", "Escape", 27);
    // Arquitectura: un clic elige el muro y Supr lo borra (se oculta: el archivo no cambia)
    await clicPlano(OX + 10, OY + 3, 0);
    ok((await ev("PL_ASEL.size")) === 1, "clic en el muro: elegido");
    await teclaE("Delete", "Delete", 46);
    ok(
      await ev("EPL.borr && EPL.borr.length === 1 && plObjeto(" + (OX + 10) + ", " + (OY + 3) + ", 0.05) < 0"),
      "Supr borra el muro de la vista"
    );
    await ctrlZ();
    ok(
      await ev("!(EPL.borr && EPL.borr.length) && plObjeto(" + (OX + 10) + ", " + (OY + 3) + ", 0.05) >= 0"),
      "Ctrl+Z lo devuelve"
    );
    // Marco sobre todo el plano y Ctrl+X: borra la arquitectura y el diseño juntos, en un solo paso
    await arrastrarPlano([OX - 1, OY - 1], [OX + 11, OY + 9]);
    const na = await ev("PL_ASEL.size");
    ok(na > 3 && (await ev("DS_SEL.size")) > 0, `el marco elige objetos de la arquitectura (${na}) y del diseño`);
    await teclaE("x", "KeyX", 88, 2);
    ok((await ev("EPL.borr.length")) === na && (await ev("PL_ASEL.size")) === 0, "Ctrl+X los borra");
    await clic('[data-ed="aplicar"]');
    ok((await ev("PLANO.borr.length")) === na, "los borrados se guardan con el proyecto");
    await clic("#edPropC [data-pl-rest]");
    ok(await ev("!EPL.borr && plObjeto(" + (OX + 10) + ", " + (OY + 3) + ", 0.05) >= 0"), "«Restaurar los borrados»");
    // Paneles: ancho con el borde (doble clic: el de siempre), cerrar con × y volver a abrir
    const w0 = await ev("$('plLado').offsetWidth"),
      sp = await J(
        "(() => { const r = document.querySelector('[data-esp=\"izq\"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + 200]; })()"
      );
    await raton("mousePressed", sp[0], sp[1]);
    for (let i = 1; i <= 5; i++) await raton("mouseMoved", sp[0] + i * 20, sp[1]);
    await raton("mouseReleased", sp[0] + 100, sp[1]);
    await esperar(80);
    const w1 = await ev("$('plLado').offsetWidth");
    ok(w1 > w0 + 40, `el panel izquierdo se ensancha arrastrando su borde (${w0} → ${w1} px)`);
    ok(/"w":\d+/.test(await ev("localStorage.getItem('jmg-electric-editor-paneles')")), "el ancho se recuerda");
    await clic('[data-edx="der"]');
    ok(await ev("$('edProp').hidden"), "× cierra el panel de propiedades");
    await clic('#editor [data-pl="props"]');
    ok(await ev("!$('edProp').hidden"), "Vista › Propiedades lo vuelve a abrir");
    await dobleClic('[data-esp="izq"]');
    ok((await ev("$('plLado').style.width")) === "", "doble clic en el borde: el ancho de siempre");
    await ev("localStorage.removeItem('jmg-electric-editor-paneles'); 1");
    await clic('[data-ed="aceptar"]');
  }
);

prueba("Editor de diseño: menú del clic derecho, paso de giro, color por tipo y plano atenuado", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  await ev(
    `(() => { ['toma', 'toma1'].forEach((k, i) => dsAgregar({ t: 'sim', k, x: ${OX} + 2 + i * 1.5, y: ${OY} + 4, r: 0, capa: DS_SIS[DS_CAT[k].s].capa })); edCambio(); })()`
  );
  ok(
    await ev("dsColorEl(dsD().els[0], dsCapaDe(dsD().els[0])) !== dsColorEl(dsD().els[1], dsCapaDe(dsD().els[1]))"),
    "con color por tipo, dos tomacorrientes distintos tienen colores distintos"
  );
  // Clic derecho sobre el tomacorriente: lo elige y abre el menú
  const [X, Y] = await J(
    `(() => { const [X, Y] = plAPant(${OX + 2}, ${OY + 4}), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
  );
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: X,
    y: Y,
    button: "right",
    buttons: 2,
    clickCount: 1
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: X,
    y: Y,
    button: "right",
    buttons: 0,
    clickCount: 1
  });
  await esperar(80);
  ok(await ev("!$('edMenu').hidden && DS_SEL.size === 1"), "el clic derecho elige el símbolo y abre el menú");
  await clic('#edMenu [data-edm="g180"]');
  ok((await ev("dsSel()[0].r")) === 180 && (await ev("$('edMenu').hidden")), "Girar 180° desde el menú");
  // Paso de giro de 45°: la tecla R gira 45°
  await poner("#dsGiro", "45");
  await teclaE("r", "KeyR", 82);
  ok((await ev("dsSel()[0].r")) === 225, "con paso de 45°, R gira 45°");
  await poner("#dsGiro", "0");
  // Plano atenuado: la arquitectura no se elige
  await teclaE("Escape", "Escape", 27);
  await clic("#plTenue");
  await clicPlano(OX + 10, OY + 3, 0);
  ok((await ev("PL_ASEL.size")) === 0 && (await ev("PLH.obj")) === -1, "con el plano atenuado, el muro no se elige");
  await clic("#plTenue");
  await clicPlano(OX + 10, OY + 3, 0);
  ok((await ev("PL_ASEL.size")) === 1, "sin atenuar, sí se elige");
  await clic('[data-ed="aceptar"]');
});

prueba("Editor de diseño: quitar y agregar vértices, partir, unir y tramos rectos o en arco", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Clic derecho en un punto del dibujo (coordenadas relativas al plano de prueba)
  const derecho = async (x, y) => {
    const [X, Y] = await J(
      `(() => { const [X, Y] = plAPant(${OX} + ${x}, ${OY} + ${y}), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
    );
    // La pantalla de ingreso puede aparecer tarde cuando esta prueba corre sola: no debe tapar el plano
    await ev("document.body.classList.remove('sin-acceso'); $('acceso').hidden = true; 1");
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: X, y: Y, buttons: 0 });
    for (const type of ["mousePressed", "mouseReleased"])
      await cdp("Input.dispatchMouseEvent", {
        type,
        x: X,
        y: Y,
        button: "right",
        buttons: type === "mousePressed" ? 2 : 0,
        clickCount: 1
      });
    for (let i = 0; i < 20 && (await ev("$('edMenu').hidden")); i++) await esperar(50);
  };
  const menu = () =>
    J("[...document.querySelectorAll('#edMenu [data-edm]')].filter(b => !b.disabled).map(b => b.dataset.edm)");
  // Línea de tres tramos: recto, en arco (semicírculo de radio 1) y recto
  const nueva = (pts, extra = "") =>
    ev(`(() => { const el = dsAgregar({ t: "lin", pts: [${pts.map((v, i) => (i % 2 ? `${OY} + ${v}` : `${OX} + ${v}`)).join(",")}], c: false, capa: "E-DIBUJO"${extra} });
      DS_SEL.clear(); DS_SEL.add(el.id); edCambio(); edProps(); return el.id; })()`);
  const L = id =>
    J(
      `(() => { const el = dsD().els.find(e => e.id === "${id}"); return el ? { n: el.pts.length / 2, b: el.b || [], L: +dsLargo(el).toFixed(4), c: el.c, c0: el.c0, c1: el.c1, cir: el.cir } : null; })()`
    );
  let id = await nueva([1, 1, 3, 1, 5, 1, 7, 1], ", b: [0, 1, 0]");
  await derecho(3, 1);
  let m = await menu();
  ok(
    m.includes("vquitar") && m.includes("vpartir"),
    `clic derecho en un vértice: quitar y partir (${m.slice(0, 3).join(", ")})`
  );
  await clic('#edMenu [data-edm="vquitar"]');
  let e = await L(id);
  ok(
    e.n === 3 && Math.abs(e.L - 6) < 1e-6,
    `vértice quitado: sus dos tramos quedan en uno recto (${e.n} vértices, ${e.L} m)`
  );
  // Supr con el cursor sobre un vértice quita el vértice, no la línea
  await derecho(5, 1);
  await teclaE("Escape", "Escape", 27);
  await ev(`(() => { DS_SEL.clear(); DS_SEL.add("${id}"); plSobreDibujar(); return 1; })()`);
  await teclaE("Delete", "Delete", 46);
  e = await L(id);
  ok(e && e.n === 2, `Supr sobre un vértice lo quita y la línea sigue (${e && e.n} vértices)`);
  // Clic derecho en un tramo: agregar vértice, volver arco
  await derecho(3, 1);
  m = await menu();
  ok(
    m.includes("tvert") && m.includes("tarco") && m.includes("tpartir"),
    "clic derecho en un tramo: agregar vértice, arco y partir"
  );
  await clic('#edMenu [data-edm="tarco"]');
  e = await L(id);
  ok(e.b[0] && e.L > 6, `tramo vuelto arco (curvatura ${e.b[0] && e.b[0].toFixed(3)})`);
  await ev(`(() => { DS_SEL.clear(); DS_SEL.add("${id}"); return 1; })()`);
  await derecho(
    4,
    await J(`(() => { const t = dsTramos(dsD().els.find(e => e.id === "${id}"))[0]; return t.m[1] - ${OY}; })()`)
  );
  await clic('#edMenu [data-edm="trecto"]');
  e = await L(id);
  ok(!e.b.some(Boolean) && Math.abs(e.L - 6) < 1e-6, "y vuelto recto otra vez");
  // Partir un semicírculo en su punto medio: dos cuartos de circunferencia del mismo radio
  id = await nueva([0, 6, 2, 6], ", b: [1]");
  const r = await J(
    `(() => { const el = dsD().els.find(e => e.id === "${id}"), p = dsPartirEn(el, 0, [${OX} + 1, ${OY} + 4.5]); edCambio(); return p.map(x => ({ id: x.id, L: dsLargo(x), b: x.b, pts: x.pts.map((v, i) => +(v - (i % 2 ? ${OY} : ${OX})).toFixed(6)) })); })()`
  );
  ok(
    r.length === 2 && Math.abs(r[0].L + r[1].L - Math.PI) < 1e-6,
    `partido en dos: ${r.map(x => x.L.toFixed(4)).join(" + ")} = π`
  );
  ok(
    r.every(x => Math.abs(Math.abs(x.b[0]) - Math.tan(Math.PI / 8)) < 1e-6) && r[0].pts[2] === 1 && r[0].pts[3] === 5,
    "cada parte es un cuarto de circunferencia y se parten en el punto del arco (1, 5)"
  );
  // Unirlas de nuevo
  await ev(`(() => { DS_SEL.clear(); DS_SEL.add("${r[0].id}"); DS_SEL.add("${r[1].id}"); return 1; })()`);
  await derecho(0, 6);
  m = await menu();
  ok(m.includes("unir"), "con dos líneas elegidas, el menú ofrece unirlas");
  await clic('#edMenu [data-edm="unir"]');
  {
    const e0 = await L(r[0].id),
      e1 = await L(r[1].id);
    e = e0 || e1;
    ok(!(e0 && e1) && e.n === 3 && Math.abs(e.L - Math.PI) < 1e-3, `unidas en una sola (${e.n} vértices, ${e.L} m)`);
  }
  // Unir dos líneas separadas: un tramo recto las conecta (la segunda está al revés)
  const a1 = await nueva([0, 7, 1, 7]),
    a2 = await nueva([3, 7, 1.5, 7]);
  const u = await J(
    `(() => { const D = dsD(), x = dsUnir(D.els.find(e => e.id === "${a1}"), D.els.find(e => e.id === "${a2}")); return { gap: x.gap }; })()`
  );
  e = await L(a1);
  ok(
    Math.abs(u.gap - 0.5) < 1e-6 && e.n === 4 && Math.abs(e.L - 3) < 1e-6,
    `unidas con un tramo recto de ${u.gap} m (largo ${e.L} m)`
  );
  // Tubería: al partirla, cada parte conserva su circuito y su conexión a su artefacto
  const t = await J(`(() => {
    const s1 = dsAgregar({ t: "sim", k: "toma", x: ${OX} + 1, y: ${OY} + 2, r: 0, capa: "E-TOMACORRIENTES" }),
      s2 = dsAgregar({ t: "sim", k: "toma", x: ${OX} + 5, y: ${OY} + 2, r: 0, capa: "E-TOMACORRIENTES" }),
      tb = dsAgregar({ t: "tub", pts: [${OX} + 1, ${OY} + 2, ${OX} + 3, ${OY} + 2, ${OX} + 5, ${OY} + 2], c: false, modo: "techo", cir: "C-2", c0: s1.id, c1: s2.id, capa: "E-TUBERIAS-TECHO" });
    edCambio();
    const p = dsPartir(tb, 1);
    edCambio();
    return p.map(x => ({ id: x.id, c0: x.c0 || "", c1: x.c1 || "", cir: x.cir, s1: s1.id, s2: s2.id }));
  })()`);
  ok(
    t.length === 2 && t[0].c0 === t[0].s1 && !t[0].c1 && t[1].c1 === t[1].s2 && !t[1].c0,
    "tubería partida: cada parte sigue conectada a su tomacorriente"
  );
  ok(
    t.every(x => x.cir === "C-2"),
    "las dos partes conservan el circuito C-2"
  );
  const tu = await J(
    `(() => { const D = dsD(), x = dsUnir(D.els.find(e => e.id === "${t[1].id}"), D.els.find(e => e.id === "${t[0].id}")); edCambio(); const el = x.el; return { c0: el.c0, c1: el.c1, n: el.pts.length / 2 }; })()`
  );
  ok(
    tu.n === 3 && [tu.c0, tu.c1].sort().join() === [t[0].s1, t[1].s2].sort().join(),
    "unida otra vez, conectada a los dos tomacorrientes"
  );
  // No se unen tuberías de distinto circuito; un área no se parte ni pierde un tramo
  ok(
    /distinto circuito/.test(
      await J(`dsUniblesMotivo({ t: "tub", pts: [0,0,1,0], cir: "C-1" }, { t: "tub", pts: [1,0,2,0], cir: "C-2" })`)
    ),
    "tuberías de distinto circuito: no se unen"
  );
  const ar =
    await J(`(() => { const el = dsAgregar({ t: "lin", pts: [${OX} + 1, ${OY} + 1, ${OX} + 4, ${OY} + 1, ${OX} + 4, ${OY} + 3, ${OX} + 1, ${OY} + 3], c: true, capa: "E-AREAS", ar: { tp: "tech", n: "x", p: [${OX} + 2, ${OY} + 2] } });
    const a = dsPartir(el, 1), b = dsQuitarTramo(el, 0), v = dsAgregarVertice(el, 0, [${OX} + 2, ${OY} + 1]);
    return { a: typeof a, b: typeof b, v, n: el.pts.length / 2, p: !!el.ar.p, m2: +dsM2(el).toFixed(4) }; })()`);
  ok(ar.a === "string" && ar.b === "string", "un área para el cálculo no se parte ni pierde un tramo");
  ok(
    ar.v === 1 && ar.n === 5 && Math.abs(ar.m2 - 6) < 1e-6 && !ar.p,
    "a un área se le agrega un vértice (misma área, ya no se vuelve a detectar sola)"
  );
  await clic('[data-ed="cancelar"]');
  await ev(
    "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
  );
});

prueba("Editor de diseño: tuberías conectadas a los artefactos (imán, borde, circuito y mover)", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Tablero con 4 circuitos y dos luminarias en el techo
  await ev(
    `(() => { dsAgregar({ t: 'sim', k: 'tab', x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: 'E-TABLEROS', nom: 'TG', nc: 4 });
      dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 2, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' });
      dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 4.5, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' }); edCambio(); })()`
  );
  const [l1, l2] = await J("dsD().els.filter(e => e.k === 'luz').map(e => e.id)");
  const sal = await J("dsSalidasTab(dsD().els.find(e => e.k === 'tab')).map(o => o.p)");
  await clic('#editor [data-pl="tubT"]');
  await clicPlano(sal[0][0], sal[0][1], 0);
  // Clics cerca (no en el centro) de cada luminaria: el imán los conecta
  await clicPlano(OX + 2.06, OY + 5.04, 0);
  await clicPlano(OX + 4.45, OY + 4.97, 0);
  await teclaE("Escape", "Escape", 27);
  const t = await J("dsD().els.filter(e => e.t === 'tub')");
  ok(t.length === 2, `dos tuberías: tablero → luminaria y luminaria → luminaria (${t.length})`);
  ok(
    t[0] && t[0].cir === "C-1" && t[0].c1 === l1 && t[0].c0 === t[0].tab,
    "la primera sale de C-1 y llega a la luminaria 1"
  );
  ok(
    t[1] && t[1].c0 === l1 && t[1].c1 === l2 && t[1].cir === "C-1",
    "la segunda une las luminarias, con el mismo circuito"
  );
  ok(
    await ev(`dsD().els.filter(e => e.k === 'luz').every(e => e.cir === 'C-1')`),
    "las luminarias toman el circuito C-1"
  );
  const r = await ev(
    `(() => { const l = dsD().els.find(e => e.id === '${l1}'), tb = dsD().els.find(e => e.t === 'tub'); const c = dsCentroCon(l); return Math.hypot(tb.pts[tb.pts.length - 2] - c[0], tb.pts[tb.pts.length - 1] - c[1]) / dsRadioCon(l); })()`
  );
  ok(Math.abs(r - 1) < 0.02, `la tubería termina en el borde de la luminaria (${r.toFixed(3)} × radio)`);
  ok(await ev("dsSueltos().puntas.length === 0 && dsSueltos().sims.length === 0"), "nada queda suelto");
  // Mover la luminaria 2: la punta de la tubería la sigue
  await ev(`(() => { const l = dsD().els.find(e => e.id === '${l2}'); l.y -= 1.2; edCambio(); })()`);
  const d = await ev(
    `(() => { const l = dsD().els.find(e => e.id === '${l2}'), tb = dsD().els.filter(e => e.t === 'tub')[1], c = dsCentroCon(l); return Math.hypot(tb.pts[tb.pts.length - 2] - c[0], tb.pts[tb.pts.length - 1] - c[1]) / dsRadioCon(l); })()`
  );
  ok(Math.abs(d - 1) < 0.02, "al mover la luminaria, la tubería la sigue");
  // Borrar la luminaria 2: la tubería queda con su punta suelta (aviso)
  await ev(`DS_SEL.clear(); DS_SEL.add('${l2}'); 1`);
  await teclaE("Delete", "Delete", 46);
  ok(
    await ev("dsSueltos().puntas.length === 1 && /Sin conectar/.test($('dsResumen').textContent)"),
    "punta suelta avisada en el panel"
  );
  await ctrlZ();
  ok(await ev("dsSueltos().puntas.length === 0"), "Ctrl+Z la vuelve a conectar");
  await clic('[data-ed="aceptar"]');
  await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
  ok(
    await ev(`PLANO.dis.els.filter(e => e.t === 'tub')[1].c1 === '${l2}'`),
    "las conexiones se guardan con el proyecto"
  );
});

prueba(
  "Editor de diseño: salidas del tablero, color por circuito, conductores, encendido, polar, fila, espejo y leyenda",
  async ok => {
    await ejemplo("uni");
    await abrirPlano();
    await ev(
      `(() => { dsAgregar({ t: 'sim', k: 'tab', x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: 'E-TABLEROS', nom: 'TG', nc: 4 });
      dsAgregar({ t: 'sim', k: 'toma', x: ${OX} + 2, y: ${OY} + 4, r: 0, capa: 'E-TOMACORRIENTES' }); edCambio(); })()`
    );
    const tb = await J("dsD().els.find(e => e.k === 'tab')"),
      to = await J("dsD().els.find(e => e.k === 'toma')");
    // Tubería dibujada desde el tomacorriente hasta el tablero: clic en el tablero muestra sus salidas
    await clic('#editor [data-pl="tubT"]');
    await clicPlano(to.x + 0.02, to.y + 0.02, 0);
    await clicPlano(tb.x, tb.y - 0.05, 0);
    await esperar(80);
    ok(
      await ev(
        "!$('edMenu').hidden && $('edMenu').querySelectorAll('[data-edm^=\"sal:\"]:not([data-edm=\"sal:-1\"])').length === 4 && !!$('edMenu').querySelector('[data-edm=\"sal:-1\"]')"
      ),
      "clic en el tablero: menú con sus 4 salidas y la opción de alimentador"
    );
    await clic('#edMenu [data-edm="sal:2"]');
    const t = await J("dsD().els.find(e => e.t === 'tub')");
    ok(
      t && t.cir === "C-3" && t.c0 === tb.id && t.c1 === to.id,
      `la tubería sale de C-3 del TG y llega al tomacorriente (${t && t.cir})`
    );
    ok(await ev(`dsD().els.find(e => e.k === 'toma').cir === 'C-3'`), "el tomacorriente toma el circuito C-3");
    // Al mover el tablero, la tubería sigue a su salida
    await ev(`(() => { const b = dsD().els.find(e => e.k === 'tab'); b.x += 0.5; edCambio(); })()`);
    ok(
      await ev(
        `(() => { const b = dsD().els.find(e => e.k === 'tab'), o = dsSalidasTab(b).find(q => q.n === 'C-3'), t = dsD().els.find(e => e.t === 'tub'); return Math.hypot(t.pts[0] - o.p[0], t.pts[1] - o.p[1]) < 1e-9; })()`
      ),
      "al mover el tablero, la tubería sigue a su salida"
    );
    await teclaE("Escape", "Escape", 27);
    // Color por circuito
    await poner("#dsColor", "cir");
    ok(
      await ev(
        "dsColorEl(dsD().els.find(e => e.t === 'tub'), dsCapaDe(dsD().els.find(e => e.t === 'tub'))) === dsColCir('C-3')"
      ),
      "color por circuito"
    );
    await poner("#dsColor", "tipo");
    // Conductores de la tubería
    await ev(`DS_SEL.clear(); DS_SEL.add(dsD().els.find(e => e.t === 'tub').id); edProps(); 1`);
    await poner('#edPropC [data-dsp="condF"]', "2");
    await ev(
      "(c => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })(document.querySelector('#edPropC [data-dsp=\"condT\"]'))"
    );
    ok(
      await ev("JSON.stringify(dsD().els.find(e => e.t === 'tub').cond) === JSON.stringify({ f: 2, n: 0, t: true })"),
      "conductores: 2 fases y tierra"
    );
    // Encendido
    await ev(
      `DS_SEL.clear(); dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 4, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' }); DS_SEL.add(dsD().els[dsD().els.length - 1].id); edProps(); 1`
    );
    await poner('#edPropC [data-dsp="enc"]', "B");
    ok((await ev("dsSel()[0].enc")) === "b", "letra de encendido «b»");
    // Copiar en fila: 3 copias a 1.5 m
    await clic('#editor [data-pl="fila"]');
    await poner("#plCmdV", "3");
    await clic("#plCmdOk");
    ok((await ev("PLH.h")) === "fila", "Copiar en fila listo para designar la separación");
    await clicPlano(OX + 4, OY + 5, 0);
    await ev(`dsPunto([${OX} + 5.5, ${OY} + 5]); 1`);
    ok((await ev("dsD().els.filter(e => e.k === 'luz').length")) === 4, "3 copias en fila de la luminaria");
    ok(
      await ev(`dsD().els.filter(e => e.k === 'luz').some(e => Math.abs(e.x - (${OX} + 8.5)) < 1e-6)`),
      "la última a 4.50 m"
    );
    // Espejo del tomacorriente respecto de una línea vertical en x = 5
    await ev(`DS_SEL.clear(); DS_SEL.add(dsD().els.find(e => e.k === 'toma').id); 1`);
    await clic('#editor [data-pl="espejo"]');
    await ev(`dsPunto([${OX} + 5, ${OY}]); dsPunto([${OX} + 5, ${OY} + 1]); 1`);
    const tm = await J("dsD().els.filter(e => e.k === 'toma')");
    ok(
      tm.length === 2 && Math.abs(tm[1].x - (OX + 8)) < 1e-6 && tm[1].r === 180,
      `espejo: copia en x = 8 y girada 180° (${tm[1] && tm[1].r}°)`
    );
    // Polar: con 45°, un punto cerca de la diagonal se alinea a ella
    await ev(
      `PLH.h = 'lin'; PLH.pts = [[${OX}, ${OY}]]; PLH.cur = [${OX} + 2, ${OY} + 2.04]; PLH.eng = null; PLH.libre = false; DSU.polar = true; DSU.polarInc = 45; 1`
    );
    const pp = await J("plPuntoActual()");
    ok(Math.abs(pp[0] - pp[1] - (OX - OY)) < 1e-6, "rastreo polar a 45°");
    await ev("plHerr(null); 1");
    // Leyenda
    await clic('#editor [data-pl="ley"]');
    await clicPlano(OX + 11, OY + 8, 0);
    const ley = await J("dsFilasLey().map(f => f.k || f.tub || Object.keys(f.cond || {})[0])");
    ok(
      (await ev("dsD().els.some(e => e.t === 'ley')")) &&
        ["luz", "toma", "tab", "techo", "f", "t"].every(k => ley.includes(k)),
      `leyenda con lo usado (${ley.join(", ")})`
    );
    await clic('[data-ed="aceptar"]');
    await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
    ok(
      await ev(
        "PLANO.dis.els.some(e => e.t === 'ley') && PLANO.dis.els.find(e => e.t === 'tub').cond.f === 2 && PLANO.dis.els.some(e => e.enc === 'b')"
      ),
      "leyenda, conductores y encendido se guardan"
    );
  }
);

prueba(
  "Editor de diseño: mano, zoom ventana, doble clic, clic derecho, comandos, marcas, revisión y autoguardado",
  async ok => {
    await ejemplo("uni");
    await abrirPlano();
    // Mano: arrastrar desplaza la vista
    await clic('#plNav [data-pl="mano"]');
    ok((await ev("PLH.h")) === "mano", "la mano queda activa");
    const cx0 = await ev("PLV.cx");
    await arrastrarPlano([OX + 3, OY + 3], [OX + 5, OY + 3]);
    ok((await ev("PLV.cx")) < cx0 - 1, "arrastrar con la mano desplaza el plano");
    await clic('#plNav [data-pl="zprev"]');
    ok(Math.abs((await ev("PLV.cx")) - cx0) < 1e-6, "Vista anterior vuelve a la vista de antes");
    // Zoom ventana
    await clic('#plNav [data-pl="zventana"]');
    await clicPlano(OX + 1, OY + 1, 0);
    await clicPlano(OX + 3, OY + 2, 0);
    ok((await ev("PLH.h")) === null && Math.abs((await ev("PLV.cx")) - (OX + 2)) < 1e-6, "zoom ventana al rectángulo");
    await ev("plAjustar(); 1");
    // Comando por teclado: T + Intro = tubería; clic derecho la termina
    await teclaE("t", "KeyT", 84);
    await teclaE("Enter", "Enter", 13);
    await ev("plAceptarPedido(); 1");
    ok((await ev("PLH.h")) === "tubT", "comando T: tubería en techo");
    await clicPlano(OX + 1, OY + 2, 0);
    await clicPlano(OX + 4, OY + 2, 0);
    const [X, Y] = await J(
      `(() => { const [X, Y] = plAPant(${OX + 4}, ${OY + 2}), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
    );
    await cdp("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: X,
      y: Y,
      button: "right",
      buttons: 2,
      clickCount: 1
    });
    await cdp("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: X,
      y: Y,
      button: "right",
      buttons: 0,
      clickCount: 1
    });
    await esperar(80);
    ok(
      (await ev("dsD().els.filter(e => e.t === 'tub').length")) === 1 && (await ev("$('edMenu').hidden")),
      "clic derecho termina la tubería, sin menú"
    );
    await teclaE("Escape", "Escape", 27);
    // Intro sin herramienta repite el último comando
    await teclaE("Enter", "Enter", 13);
    ok((await ev("PLH.h")) === "tubT", "Intro repite el último comando");
    await teclaE("Escape", "Escape", 27);
    // Clic en el medio de la tubería: ventanita de conductores
    const pm = await J("dsPuntoA(dsD().els.find(e => e.t === 'tub'), 0.5).pt");
    await clicPlano(pm[0], pm[1], 0);
    await esperar(60);
    ok(
      await ev("!$('edMenu').hidden && !!$('edMenu').querySelector('[data-edc=\"f\"]')"),
      "clic en el medio de la tubería: sus conductores"
    );
    await poner('#edMenu [data-edc="f"]', "4");
    ok((await ev("dsD().els.find(e => e.t === 'tub').cond.f")) === 4, "4 fases desde la ventanita");
    await ev("edMenuCerrar(); 1");
    // Doble clic en un artefacto: su ventana de propiedades
    await ev(`dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 6, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' }); edCambio(); 1`);
    const [Xl, Yl] = await J(
      `(() => { const [X, Y] = plAPant(${OX + 6}, ${OY + 5}), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
    );
    for (const n of [1, 2]) {
      await cdp("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: Xl,
        y: Yl,
        button: "left",
        buttons: 1,
        clickCount: n
      });
      await cdp("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: Xl,
        y: Yl,
        button: "left",
        buttons: 0,
        clickCount: n
      });
    }
    await esperar(120);
    ok(
      await ev("!$('elDlg').hidden && /alumbrado/i.test($('elT').textContent)"),
      "doble clic abre la ventana de la luminaria"
    );
    await poner('#elC [data-dsp="enc"]', "c");
    ok((await ev("dsD().els.find(e => e.k === 'luz').enc")) === "c", "la ventana cambia sus datos");
    await clic('[data-el="cerrar"]');
    // Revisión del diseño
    await clic('#editor [data-pl="revisar"]');
    ok(
      await ev("!$('revDlg').hidden && /sin tubería/.test($('revLista').textContent)"),
      "la revisión avisa del artefacto sin tubería"
    );
    await poner("#revSal", "5");
    ok((await ev("dsD().crit.sal")) === 5, "criterio editable de salidas por circuito");
    await clic('[data-rev="cerrar"]');
    // Autoguardado: se guarda la copia de lo no aplicado
    await ev("edAutoguardar(true); 1");
    ok(/"s"/.test(await ev("localStorage.getItem(ED_REC) || ''")), "autoguardado de los cambios sin aplicar");
    await clic('[data-ed="aceptar"]');
    ok((await ev("localStorage.getItem(ED_REC)")) === null, "al aplicar, la copia de recuperación se borra");
  }
);

prueba("Editor de diseño: lámina PDF, DXF del diseño en coordenadas reales y circuito en las salidas", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  await ev(
    `(() => { dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 3, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO', cir: 'C-1' });
      dsAgregar({ t: 'sim', k: 'toma', x: ${OX} + 2, y: ${OY} + 4, r: 0, capa: 'E-TOMACORRIENTES', cir: 'C-2' });
      dsAgregar({ t: 'tub', pts: [${OX} + 1, ${OY} + 1, ${OX} + 5, ${OY} + 1], modo: 'techo', capa: 'E-TUBERIAS-TECHO', cond: { f: 1, n: 1, t: true } });
      EPL.plantas = [{ n: '1er piso', x0: ${OX} - 0.5, y0: ${OY} - 0.5, x1: ${OX} + 10.5, y1: ${OY} + 8.5 }]; edCambio(); })()`
  );
  await clic('#editor [data-tab-e="salida"]');
  await clic('#editor [data-pl="lamina"]');
  await esperar(150);
  ok(await ev("!$('lamDlg').hidden && $('laZona').value === 'planta:0'"), "la lámina se abre con la planta encuadrada");
  const svg = await ev("$('laPrev').innerHTML");
  ok(
    /LEYENDA/.test(svg) && /ESCALA 1:50/.test(svg) && /NOTAS/.test(svg) && /IE-01/.test(svg),
    "lámina con leyenda, escala, notas y rótulo"
  );
  ok((await ev("$('laAviso').hidden")) === true, "la planta entra en A3 a 1:50");
  await poner("#laTam", "A4");
  await poner("#laEsc", "25");
  ok(
    /no entra/.test(await ev("$('laAviso').textContent")) &&
      (await ev("dsD().escala")) === 50 &&
      (await ev("dsD().lams[0].esc")) === 25,
    "en A4 a 1:25 avisa que no entra"
  );
  await poner("#laEsc", "50");
  await poner("#laNum", "IE-04");
  ok(
    (await ev("dsD().lams[0].num")) === "IE-04" && /IE-04/.test(await ev("$('laPrev').innerHTML")),
    "número de lámina"
  );
  await clic('[data-la="cerrar"]');
  // DXF: se vuelve a leer con el lector de la plataforma, en las mismas coordenadas
  const r = await J(
    `(() => { const m = modeloDxf(new TextEncoder().encode(laDxf(false)).buffer); return { capas: Object.keys(m.capas), ext: m.ext, n: m.trazos.length }; })()`
  );
  ok(
    ["E-ALUMBRADO", "E-TOMACORRIENTES", "E-TUBERIAS-TECHO"].every(c => r.capas.includes(c)) &&
      Math.abs(r.ext[0] - (OX + 1)) < 0.1 &&
      Math.abs(r.ext[1] - (OY + 1)) < 0.1,
    `DXF con sus capas y coordenadas reales (${r.ext.map(v => v.toFixed(2)).join(", ")})`
  );
  const r2 = await J(
    `(() => { const m = modeloDxf(new TextEncoder().encode(laDxf(true)).buffer); return m.trazos.length; })()`
  );
  ok(r2 > r.n, "DXF con la arquitectura: más trazos");
  // Circuito en las salidas
  await ev("(c => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })($('dsNSal'))");
  ok((await ev("dsD().nsal")) === true, "circuito en las salidas");
  await clic('[data-ed="aceptar"]');
  await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
  ok(
    await ev("PLANO.dis.lams[0].num === 'IE-04' && PLANO.dis.nsal === true"),
    "la lámina y la opción se guardan con el proyecto"
  );
});

prueba(
  "Editor de diseño: cinta fija y plegable, fondo, varias láminas, zona marcada y editor de símbolos",
  async ok => {
    await ejemplo("uni");
    await abrirPlano();
    // La cinta mide lo mismo en todas las pestañas
    const altos = await J(
      "[...document.querySelectorAll('#editor [data-tab-e]')].map(t => { t.click(); return document.querySelector('#editor .ed-ribbon').offsetHeight; })"
    );
    ok(new Set(altos).size === 1, `la cinta mide igual en todas las pestañas (${altos.join(", ")})`);
    await clic('#editor [data-tab-e="inicio"]');
    const h0 = await ev("plLienzo.offsetHeight");
    await clic("#editor [data-edplegar]");
    ok((await ev("plLienzo.offsetHeight")) > h0 + 50, "plegar la cinta da más espacio al plano");
    await clic('#editor [data-tab-e="vista"]');
    ok(!(await ev("DSU.cintaMin")), "un clic en una pestaña vuelve a mostrar la cinta");
    // Fondo cálido
    await poner("#dsCalido", "60");
    ok((await ev("PL_FONDO")) !== "#ffffff" && (await ev("DSU.calido")) === 60, "fondo cálido regulable");
    await clic('#editor [data-pl="fondo0"]');
    ok((await ev("PL_FONDO")) === "#ffffff", "Fondo blanco lo devuelve");
    // Varias láminas, zona marcada y capas por lámina
    await ev(
      `(() => { dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 3, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' }); dsAgregar({ t: 'sim', k: 'toma', x: ${OX} + 2, y: ${OY} + 4, r: 0, capa: 'E-TOMACORRIENTES' }); edCambio(); })()`
    );
    await ev("lamAbrir(); 1");
    await clic('[data-la="nueva"]');
    ok((await ev("dsD().lams.length")) === 2 && (await ev("$('laNum').value")) === "IE-02", "nueva lámina IE-02");
    await ev(
      "(c => { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); })(document.querySelector('#laCapas [data-lac=\"E-TOMACORRIENTES\"]'))"
    );
    ok(JSON.stringify(await J("dsD().lams[1].ocl")) === '["E-TOMACORRIENTES"]', "la IE-02 oculta los tomacorrientes");
    await clic('[data-la="marcar"]');
    ok((await ev("PLH.h")) === "lamzona" && (await ev("$('lamDlg').hidden")), "marcar la zona en el plano");
    await clicPlano(OX + 1, OY + 1, 0);
    await clicPlano(OX + 6, OY + 7, 0);
    await esperar(100);
    ok(
      (await ev("!$('lamDlg').hidden && $('laZona').value === 'rect'")) &&
        (await ev("dsD().lams[1].rect.length")) === 4,
      "la lámina vuelve con la zona marcada"
    );
    await clic('[data-la="cerrar"]');
    // Editor de símbolos: tomacorriente achurado y más grande (criterio del proyectista)
    await ev("siAbrir('toma'); 1");
    await poner("#siRel", "achurado");
    await poner("#siTam", "130");
    ok(
      JSON.stringify(await J("dsD().simb.toma")) === JSON.stringify({ rel: "achurado", tam: 1.3 }),
      "criterio: achurado al 130 %"
    );
    ok(/09-93-17 \*/.test(JSON.stringify(await J("dsFilasLey()"))), "la leyenda marca el símbolo con asterisco");
    await clic('[data-si="norma"]');
    ok(!(await ev("dsD().simb && dsD().simb.toma")), "Volver a la Norma DGE");
    await poner("#siRel", "solido");
    await clic('[data-si="cerrar"]');
    await clic('[data-ed="aceptar"]');
    await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
    ok(
      await ev("PLANO.dis.simb.toma.rel === 'solido' && PLANO.dis.lams.length === 2"),
      "criterio y láminas se guardan"
    );
  }
);

prueba("Editor de diseño: plantas y montantes, bloques, plantillas, ruta automática y versiones", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  await ev(
    `(() => { EPL.plantas = [{ n: '1er piso', x0: ${OX}, y0: ${OY}, x1: ${OX} + 10, y1: ${OY} + 8 }, { n: '2do piso', x0: ${OX} + 20, y0: ${OY}, x1: ${OX} + 30, y1: ${OY} + 8 }];
      dsAgregar({ t: 'sim', k: 'tab', x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: 'E-TABLEROS', nom: 'TG', nc: 4 });
      ['luz', 'luz', 'luz'].forEach((k, i) => dsAgregar({ t: 'sim', k, x: ${OX} + 2 + i * 2.5, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' }));
      dsAgregar({ t: 'sim', k: 'subida', x: ${OX} + 9, y: ${OY} + 1, r: 0, capa: 'E-CANALIZACION' }); edCambio(); })()`
  );
  // Ruta automática: tablero y tres luminarias
  await ev("DS_SEL.clear(); dsD().els.filter(e => e.k === 'tab' || e.k === 'luz').forEach(e => DS_SEL.add(e.id)); 1");
  await clic('#editor [data-pl="ruta"]');
  await esperar(80);
  await clic('#edMenu [data-edm="sal:0"]');
  const t = await J("dsD().els.filter(e => e.t === 'tub')");
  ok(
    t.length === 3 && t.every(x => x.cir === "C-1" && x.modo === "techo"),
    `ruta: 3 tuberías del C-1 en techo (${t.length})`
  );
  ok(await ev("dsSueltos().sims.filter(e => e.k === 'luz').length === 0"), "todas las luminarias quedan conectadas");
  // Plantas: copiar la primera luminaria al 2do piso; montante de la subida
  await ev("DS_SEL.clear(); DS_SEL.add(dsD().els.find(e => e.k === 'luz').id); dpCopiarAPlanta(); 1");
  await clic('#edMenu [data-edm="sal:1"]');
  ok(
    await ev(`dsD().els.some(e => e.k === 'luz' && Math.abs(e.x - (${OX} + 22)) < 1e-6)`),
    "copiada a la misma posición del 2do piso"
  );
  await ev("DS_SEL.clear(); DS_SEL.add(dsD().els.find(e => e.k === 'subida').id); dpMontante(); 1");
  await clic('#edMenu [data-edm="sal:1"]');
  const mb = await J("dsD().els.find(e => e.k === 'bajada')"),
    ms = await J("dsD().els.find(e => e.k === 'subida')");
  ok(
    mb && mb.mon === ms.id && ms.mon === mb.id && Math.abs(mb.x - (OX + 29)) < 1e-6,
    "montante: bajada en el 2do piso, enlazada"
  );
  await ev("DP_F = 1; dsResumen(); 1");
  ok(
    /Salida de alumbrado/.test(await ev("$('dsResumen').textContent")) &&
      !/Tablero/.test(await ev("$('dsResumen').textContent")),
    "resumen del 2do piso"
  );
  await ev("DP_F = -1; dsResumen(); 1");
  // Bloques: guardar dos luminarias y colocarlas
  await ev(
    "localStorage.removeItem(DP_BLQ); DS_SEL.clear(); dsD().els.filter(e => e.k === 'luz').slice(0, 2).forEach(e => DS_SEL.add(e.id)); dpGuardarBloque(); 1"
  );
  await poner("#plCmdV", "Dos luces");
  await clic("#plCmdOk");
  ok(
    (await ev("dpBloques()[0].n")) === "Dos luces" && (await ev("dpBloques()[0].els.length")) === 2,
    "bloque guardado en metros"
  );
  await ev("bibAbrir(); BI_GRUPO = 'blq'; bibRender(); 1");
  ok(/Dos luces/.test(await ev("$('biRejilla').textContent")), "aparece en Mis bloques");
  await clic('#biRejilla [data-blq="0"]');
  ok((await ev("PLH.h")) === "blq", "herramienta para colocar el bloque");
  await ev("plAjustar(); 1");
  const n0 = await ev("dsD().els.length");
  await clicPlano(OX + 5, OY + 2, 0);
  ok((await ev("dsD().els.length")) === n0 + 2, "el bloque se coloca");
  await teclaE("Escape", "Escape", 27);
  // Versiones: guardar, cambiar y comparar
  await ev("verAbrir(); 1");
  await poner("#verNom", "Entrega 1");
  await clic("#verDlg [data-vg]");
  ok((await ev("EPL.vers.length")) === 1, "versión guardada");
  await ev(`dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 8, y: ${OY} + 3, r: 0, capa: 'E-ALUMBRADO' }); edCambio(); 1`);
  await clic('#verDlg [data-ver="c0"]');
  ok((await ev("DP_COMP && DP_COMP.add.size")) === 1, "comparar: 1 elemento agregado");
  await teclaE("Escape", "Escape", 27);
  ok((await ev("DP_COMP")) === null, "Esc deja de comparar");
  // Plantillas: aplicar la de vivienda y guardar una propia
  await ev("plaAbrir(); 1");
  await clic('#plaLista [data-pla="b0"]');
  ok(
    (await ev("dsD().lams.length")) === 2 && (await ev("dsD().lams[1].num")) === "IE-02",
    "plantilla Vivienda: IE-01 e IE-02"
  );
  await ev("localStorage.removeItem(DP_PLA); plaAbrir(); 1");
  await poner("#plaNom", "Mi estilo");
  await clic("#plaDlg [data-plg]");
  ok((await ev("dpPlantillas()[0].n")) === "Mi estilo", "plantilla propia guardada");
  await clic('[data-plc="cerrar"]');
  await clic('[data-ed="aceptar"]');
  await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
  ok(
    await ev("PLANO.vers.length === 1 && PLANO.dis.els.some(e => e.mon)"),
    "versiones y montantes se guardan con el proyecto"
  );
});

prueba("Proyectos en la base de datos del navegador y respaldo con el plano DXF", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  await clic('[data-ed="aceptar"]');
  await ev("ponerDato('p_nombre', 'Casa con plano'); saveDraft(); 1");
  await esperar(600);
  ok(
    await ev("alLeer(LKEY + '/' + PID).then(o => !!(o && o.p_nombre === 'Casa con plano' && o.PLANO))"),
    "el proyecto se guarda en la base"
  );
  ok(await ev("alLeer(SKEY).then(o => !!(o && o.p_nombre === 'Casa con plano'))"), "el proyecto abierto también");
  // Respaldo: el archivo lleva el plano DXF
  const n = await ev("proyectoConPlano(estado()).then(o => o.PLANO_DXF ? o.PLANO_DXF.b64.length : 0)");
  ok(n > 1000, `el respaldo lleva el plano DXF (${Math.round((n * 0.75) / 1024)} KB)`);
  // Otra computadora: sin el plano en el navegador; al abrir el respaldo, el plano vuelve
  await ev(
    "(async () => { const o = await proyectoConPlano(estado()), db = await plDb(); await new Promise(ok => { const t = db.transaction('planos', 'readwrite'); t.objectStore('planos').delete(PLANO.sha); t.oncomplete = ok; }); window._resp = o; return 1; })()"
  );
  ok(!(await ev("plLeerArchivo(PLANO.sha).then(a => !!a)")), "plano borrado del navegador (simulación)");
  ok(
    await ev(
      "guardarPlanoDeArchivo(window._resp).then(p => !p.PLANO_DXF && plLeerArchivo(p.PLANO.sha)).then(a => !!(a && a.buf && a.buf.byteLength > 1000))"
    ),
    "al abrir el respaldo, el plano vuelve al navegador"
  );
  ok(
    /Espacio usado/.test(await ev("(async () => { renderProy(); await alUso(); return $('alUso').textContent; })()")),
    "la lista de proyectos muestra el espacio usado"
  );
});

prueba("Editor de diseño: fondo del plano, barra de navegación y nombres de la cinta", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Los nombres de los grupos de la cinta caben dentro de la cinta
  const corte = await J(
    "(() => { const r = document.querySelector('#editor .ed-ribbon').getBoundingClientRect(); return [...document.querySelectorAll('#editor [data-rib-e=\"inicio\"] .gl')].filter(g => g.getBoundingClientRect().bottom > r.bottom + 0.5).length; })()"
  );
  ok(corte === 0, `los nombres de los grupos se ven completos (${corte} cortados)`);
  // Fondo del plano: ventanita, fondo grafito (oscuro) y restablecer
  await clic('#editor [data-tab-e="vista"]');
  await clic('#editor [data-pl="fondo"]');
  ok(
    await ev("!$('edFondo').hidden && $('fonLista').querySelectorAll('[data-fon]').length === 8"),
    "ventanita con 8 fondos"
  );
  await clic('#fonLista [data-fon="grafito"]');
  ok(
    (await ev("PL_OSCURO")) === true && (await ev("DSU.fondo")) === "grafito",
    "fondo grafito: el plano pasa a oscuro"
  );
  await poner("#dsCalido", "-40");
  ok((await ev("DSU.calido")) === -40, "temperatura fría");
  await clic('#edFondo [data-pl="fondo0"]');
  ok((await ev("PL_OSCURO")) === false && (await ev("DSU.fondo")) === "tema", "Restablecer: según el tema");
  // Barra de navegación: horizontal, ocultar y volver a mostrar
  await clic('#plNav [data-navg="girar"]');
  ok(await ev("$('plNav').classList.contains('horiz')"), "barra horizontal");
  await clic('#plNav [data-navg="ocultar"]');
  ok(await ev("$('plNav').hidden && !$('dsNav').checked"), "barra oculta");
  await ev("(c => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })($('dsNav'))");
  ok(await ev("!$('plNav').hidden"), "Vista › Barra de navegación la vuelve a mostrar");
  await ev("DSU.navH = false; DSU.navPos = null; dsGuardarPref(); plNavPoner(); 1");
  await clic('[data-ed="aceptar"]');
});

prueba(
  "Editor de diseño: cuadro de circuitos, metrado, caja automática, buscar, datos al pasar, varios, atajos y presentación",
  async ok => {
    await ejemplo("uni");
    await abrirPlano();
    await ev(
      `(() => { const tb = dsAgregar({ t: 'sim', k: 'tab', x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: 'E-TABLEROS', nom: 'TG', nc: 2, cd: ['Alumbrado'] });
      const l1 = dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 2, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' }), l2 = dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 5, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' });
      const o = dsSalidasTab(tb)[0];
      dsAgregar({ t: 'tub', pts: [...o.p, ${OX} + 2, ${OY} + 5.2], modo: 'techo', capa: 'E-TUBERIAS-TECHO', c0: tb.id, c1: l1.id, tab: tb.id, cir: 'C-1', cond: { f: 1, n: 1, t: true }, dia: 20 });
      dsAgregar({ t: 'tub', pts: [${OX} + 2.2, ${OY} + 5, ${OX} + 3, ${OY} + 4, ${OX} + 3.5, ${OY} + 6, ${OX} + 4.2, ${OY} + 4, ${OX} + 4.8, ${OY} + 5], b: [0.4, 0.4, 0.4, 0.4], modo: 'techo', capa: 'E-TUBERIAS-TECHO', c0: l1.id, c1: l2.id, tab: tb.id, cir: 'C-1', cond: { f: 1, n: 1, t: true }, dia: 20 });
      edCambio(); })()`
    );
    // Cuadro de circuitos
    const f = await J("dsFilasCua()");
    ok(
      f[0].tit === "TG" && f[1].c === "C-1" && /2 alum/.test(f[1].sal) && f[1].cond === "1F+1N+T" && f[1].dia === 20,
      `cuadro: C-1 con 2 luminarias, 1F+1N+T, Ø20 (${f[1] && f[1].sal})`
    );
    await clic('#editor [data-pl="cua"]');
    await clicPlano(OX + 11, OY + 8, 0);
    ok(await ev("dsD().els.some(e => e.t === 'cua')"), "cuadro insertado en el plano");
    // Metrado del diseño
    await clic('#editor [data-pl="metrado"]');
    const met = await ev("$('metC').textContent");
    ok(
      /techo · Ø 20 mm/.test(met) && /Salida de alumbrado en techo/.test(met) && /Conductor de protección/.test(met),
      "metrado: tuberías, artefactos y conductores"
    );
    await clic('[data-met="cerrar"]');
    // Caja automática desde la revisión (la tubería con muchas curvas)
    await clic('#editor [data-pl="revisar"]');
    ok(await ev("!!$('revLista').querySelector('[data-revc]')"), "la revisión ofrece poner una caja de paso");
    await clic("#revLista [data-revc]");
    ok(
      await ev(
        "dsD().els.filter(e => e.k === 'caja').length === 1 && dsD().els.filter(e => e.t === 'tub').length === 3 && dsSueltos().puntas.length === 0"
      ),
      "caja puesta: la tubería quedó en dos, conectadas a la caja"
    );
    await clic('[data-rev="cerrar"]');
    // Buscar
    await teclaE("f", "KeyF", 70, 2);
    ok(await ev("!$('edBuscar').hidden"), "Ctrl+F abre el buscador");
    await poner("#buQ", "C-1");
    ok(/Circuito C-1 · TG/.test(await ev("$('buRes').textContent")), "encuentra el circuito C-1 del TG");
    await ev("buIr(0); 1");
    ok((await ev("DS_SEL.size")) >= 4 && (await ev("$('edBuscar').hidden")), "lo elige y va a él");
    // Datos al pasar el cursor
    ok(
      /Tubería en techo · C-1 · .* m · 1F\+1N\+T · Ø 20 mm/.test(
        await ev("dsInfoEl(dsD().els.find(e => e.t === 'tub'))")
      ),
      "datos de la tubería al pasar el cursor"
    );
    // Propiedades de varios: rotación de las dos luminarias a la vez
    await ev("DS_SEL.clear(); dsD().els.filter(e => e.k === 'luz').forEach(e => DS_SEL.add(e.id)); edProps(); 1");
    await poner('#edPropC [data-dsp="r"]', "45");
    ok(
      await ev("dsD().els.filter(e => e.k === 'luz').every(e => e.r === 45)"),
      "rotación de varias luminarias a la vez"
    );
    // Atajos del usuario: «LL» para luminaria
    await ev("localStorage.removeItem(ATJ_K); atjAbrir(); 1");
    await poner('#atjLista [data-atj-a="col:luz"]', "ll");
    await clic('[data-atj="cerrar"]');
    await teclaE("Escape", "Escape", 27);
    await ev("edEjecutar('LL'); 1");
    ok((await ev("PLH.h")) === "col:luz", "atajo propio LL: luminaria");
    await teclaE("Escape", "Escape", 27);
    // Presentación
    await clic('#editor [data-pl="presentar"]');
    ok(
      await ev(
        "$('editor').classList.contains('ed-pres') && document.querySelector('#editor .ed-ribbon').offsetHeight === 0"
      ),
      "presentación: solo el plano"
    );
    await teclaE("Escape", "Escape", 27);
    ok(!(await ev("$('editor').classList.contains('ed-pres')")), "Esc sale de la presentación");
    await ev("localStorage.removeItem(ATJ_K); 1");
    await clic('[data-ed="aceptar"]');
  }
);

prueba("Editor de diseño: ángulo junto al punto de giro (clic para escribirlo) e imán del giro", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  await ev(
    `dsAgregar({ t: "sim", k: "toma", x: ${OX} + 5, y: ${OY} + 4, r: 0, capa: "E-TOMACORRIENTES" }); edCambio(); 1`
  );
  const t = await J("dsD().els.find(e => e.k === 'toma')");
  await clicPlano(t.x, t.y, 0);
  ok((await ev("!$('edAng').hidden && $('edAngB').textContent")) === "0°", "el ángulo aparece junto al punto de giro");
  await clic("#edAngB");
  ok(await ev("!$('edAngI').hidden"), "clic en el ángulo: se puede escribir");
  await ev(
    "edAngEditar(); $('edAngI').value = '45'; $('edAngI').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); 1"
  );
  ok(
    (await ev("dsD().els.find(e => e.k === 'toma').r")) === 45 && (await ev("$('edAngB').textContent")) === "45°",
    "girado a 45° exactos"
  );
  // Imán: con giro libre y enganche cada 15°, cerca de 59° queda en 60°
  await ev("DSU.giro = 0; DSU.polar = true; DSU.polarInc = 15; 1");
  const el = await J("dsD().els.find(e => e.k === 'toma')"),
    a = ((59 + 90) * Math.PI) / 180,
    g = await J(`dsAgarres(dsD().els.find(e => e.k === "toma")).find(a => a.t === "giro")`);
  await arrastrarPlano([g.x, g.y], [el.x + 0.6 * Math.cos(a), el.y + 0.6 * Math.sin(a)]);
  ok(
    (await ev("dsD().els.find(e => e.k === 'toma').r")) === 60,
    `imán: cerca de 59° queda en 60° (${await ev("dsD().els.find(e => e.k === 'toma').r")}°)`
  );
  await clic('[data-ed="aceptar"]');
});

prueba("Editor de diseño: salidas del tablero precisas y clic derecho para sacar tuberías", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Tablero pegado al muro superior (sus salidas quedan junto a las líneas del muro)
  await ev(
    `(() => { dsAgregar({ t: 'sim', k: 'tab', x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: 'E-TABLEROS', nom: 'TG', nc: 4 });
      dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 5, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' }); edCambio(); plVer(${OX} + 1.5, ${OY} + 6.5, ${OX} + 4.5, ${OY} + 8.5); })()`
  );
  await esperar(150);
  const sal = await J("dsSalidasTab(dsD().els.find(e => e.k === 'tab')).map(o => o.p)");
  // Con la tubería, el cursor 5 px al lado de la salida C-2: engancha la salida, no el muro
  await clic('#editor [data-pl="tubT"]');
  await moverPlano(sal[1][0] + (5 * (await ev("plDpr()"))) / (await ev("PLV.s")), sal[1][1]);
  const eng = await J("PLH.eng");
  ok(eng && eng[2] === 8 && eng[3].cir === "C-2", `engancha la salida C-2 (${eng && eng[2]})`);
  await teclaE("Escape", "Escape", 27);
  // Clic derecho en la salida C-3 › Salida del circuito › Por la pared
  const [X, Y] = await J(
    `(() => { const [X, Y] = plAPant(${sal[2][0]}, ${sal[2][1]}), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
  );
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: X,
    y: Y,
    button: "right",
    buttons: 2,
    clickCount: 1
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: X,
    y: Y,
    button: "right",
    buttons: 0,
    clickCount: 1
  });
  await esperar(80);
  ok(
    /C-3/.test(await ev("$('edMenu').textContent")) &&
      (await ev("!!$('edMenu').querySelector('[data-edm=\"salmenu\"]')")),
    "clic derecho en la salida: «Salida del circuito C-3»"
  );
  await clic('#edMenu [data-edm="salmenu"]');
  ok(await ev("!!$('edMenu').querySelector('[data-edm=\"tub:pared\"]')"), "submenú: techo, pared o piso");
  await clic('#edMenu [data-edm="tub:pared"]');
  ok((await ev("PLH.h")) === "tubT" && (await ev("PLH.pts.length")) === 1, "la tubería empieza en la salida");
  await ev(`plVer(${OX} + 1, ${OY} + 3, ${OX} + 7, ${OY} + 8.5); 1`);
  await clicPlano(OX + 5, OY + 5, 0);
  await teclaE("Escape", "Escape", 27);
  const t = await J("dsD().els.find(e => e.t === 'tub')");
  ok(
    t && t.modo === "pared" && t.cir === "C-3" && t.c0 === t.tab && !!t.c1,
    `tubería por la pared, del C-3 hasta la luminaria (${t && t.modo})`
  );
  // En un artefacto: Sacar tubería (sin herramienta activa)
  await ev("plHerr(null); 1");
  await ev("DS_SEL.clear(); DS_SEL.add(dsD().els.find(e => e.k === 'luz').id); 1");
  const [Xl, Yl] = await J(
    `(() => { const [X, Y] = plAPant(${OX} + 5, ${OY} + 5), r = plBase.getBoundingClientRect(); return [r.left + (X * r.width) / plBase.width, r.top + (Y * r.height) / plBase.height]; })()`
  );
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: Xl,
    y: Yl,
    button: "right",
    buttons: 2,
    clickCount: 1
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: Xl,
    y: Yl,
    button: "right",
    buttons: 0,
    clickCount: 1
  });
  await esperar(80);
  ok(
    await ev("!!$('edMenu').querySelector('[data-edm=\"salmenu\"]')"),
    "en un artefacto: «Sacar tubería ▸» " + (await ev("$('edMenu').textContent.slice(0, 80)"))
  );
  await ev("edMenuCerrar(); 1");
  await clic('[data-ed="aceptar"]');
});

prueba("Editor de diseño: repartir en un ambiente y a lo largo de un muro", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Repartir luminarias en la sala (de 0 a 6 m en x, de 0 a 8 m en y): 2 × 3
  await ev("biUsado('luz'); 1");
  await clic('#editor [data-pl="rep"]');
  ok((await ev("PLH.h")) === "rep" && (await ev("PLH.repK")) === "luz", "Repartir con la luminaria");
  await clicPlano(OX + 0.2, OY + 0.2, 0);
  await clicPlano(OX + 5.8, OY + 7.8, 0);
  ok(!(await ev("$('plCmdIn').hidden")), `propone filas × columnas (${await ev("$('plCmdV').value")})`);
  await poner("#plCmdV", "2x3");
  await clic("#plCmdOk");
  const l = await J(
    "dsD().els.filter(e => e.k === 'luz').map(e => [+(e.x - " + OX + ").toFixed(2), +(e.y - " + OY + ").toFixed(2)])"
  );
  ok(
    l.length === 6 && l.some(p => Math.abs(p[0] - 1.13) < 0.05 && Math.abs(p[1] - 5.85) < 0.05),
    `6 luminarias repartidas (${JSON.stringify(l.slice(0, 2))})`
  );
  await teclaE("Escape", "Escape", 27);
  // Tomacorrientes a lo largo del muro inferior (y = 0), del lado de adentro, cada 3 m
  await ev("dpIniciarRep('rmur', 'toma'); 1");
  await clicPlano(OX + 0, OY + 0, 0);
  await clicPlano(OX + 6, OY + 0, 0);
  await clicPlano(OX + 3, OY + 2, 0);
  await poner("#plCmdV", "c/3");
  await clic("#plCmdOk");
  const t = await J("dsD().els.filter(e => e.k === 'toma')");
  ok(
    t.length === 2 && t.every(e => e.y > OY && e.y - OY < 0.4),
    `2 tomacorrientes encajados en el muro, adentro (${t.map(e => (e.y - OY).toFixed(2)).join(", ")})`
  );
  await teclaE("Escape", "Escape", 27);
  await clic('[data-ed="aceptar"]');
});

prueba("Calcular con el diseño: tipo de circuito, luminarias, carga especial, alimentador y cálculo", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Tablero con 3 circuitos, dos luminarias (una del tipo L1), un tomacorriente, una terma y el medidor
  const ids = await J(`(() => {
    const D = dsD(), a = o => dsAgregar(o).id;
    D.lums = [{ id: "L1", n: "Panel LED", w: 18 }];
    const tb = a({ t: "sim", k: "tab", x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: "E-TABLEROS", nom: "TG", nc: 3, ct: ["al", "tg"] }),
      l1 = a({ t: "sim", k: "luz", x: ${OX} + 3, y: ${OY} + 5, r: 0, capa: "E-ALUMBRADO", cir: "C-1", tab: tb }),
      l2 = a({ t: "sim", k: "luz", x: ${OX} + 3, y: ${OY} + 2, r: 0, capa: "E-ALUMBRADO", cir: "C-1", tab: tb, lt: "L1" }),
      to = a({ t: "sim", k: "toma", x: ${OX} + 5, y: ${OY} + 7.5, r: 0, capa: "E-TOMACORRIENTES", cir: "C-2", tab: tb }),
      te = a({ t: "sim", k: "terma", x: ${OX} + 1, y: ${OY} + 7.5, r: 0, capa: "E-FUERZA", cir: "C-3", tab: tb, p: 1500 }),
      me = a({ t: "sim", k: "med", x: ${OX} + 0.5, y: ${OY} + 4, r: 0, capa: "E-TABLEROS" });
    const tub = (c0, c1, pts, o = {}) => a({ t: "tub", pts, c: false, modo: "techo", capa: "E-TUBERIAS-TECHO", c0, c1, tab: tb, ...o });
    tub(tb, l1, [${OX} + 3, ${OY} + 7.6, ${OX} + 3, ${OY} + 5], { cir: "C-1" });
    tub(l1, l2, [${OX} + 3, ${OY} + 5, ${OX} + 3, ${OY} + 2], { cir: "C-1" });
    tub(tb, to, [${OX} + 3, ${OY} + 7.6, ${OX} + 5, ${OY} + 7.6, ${OX} + 5, ${OY} + 7.5], { cir: "C-2", modo: "piso" });
    tub(tb, te, [${OX} + 3, ${OY} + 7.6, ${OX} + 1, ${OY} + 7.6, ${OX} + 1, ${OY} + 7.5], { cir: "C-3", modo: "pared" });
    edCambio();
    return { tb, l1, l2, to, te, me };
  })()`);
  // El cálculo conoce cada artefacto con la misma altura de montaje y la misma clase que el catálogo de símbolos
  const dif = await J(
    'Object.keys(DS_CAT).filter(k => { const c = DS_CAT[k], [cl, a] = plArt(k); return (c.h ? a !== c.h.slice(1).toLowerCase() : !(a === "T" || a === 0 || a === null)) || (c.p === "al_p" && cl !== "al") || (c.p === "tg_p" && cl !== "to"); })'
  );
  ok(!dif.length, `alturas y clases del cálculo iguales a las del catálogo (${dif.join(", ") || "todas"})`);
  // Ventana del tablero: el tipo de cada circuito (el C-3, automático: carga especial)
  await ev(`tabAbrir("${ids.tb}"); 1`);
  ok(
    (await J("[...$('taLista').querySelectorAll('select')].map(s => s.value)")).join() === "al,tg," &&
      /carga especial/i.test(await ev("$('taLista').querySelectorAll('select')[2].options[0].textContent")),
    "ventana del tablero: tipo de cada circuito (el C-3, automático: carga especial)"
  );
  await ev("$('taLista').querySelectorAll('select')[2].value = 'esp'; tabAceptar(); 1");
  ok((await J(`dsD().els.find(e => e.id === "${ids.tb}").ct`)).join() === "al,tg,esp", "tipo guardado en el tablero");
  // Propiedades: tipo de luminaria y datos de la carga especial
  await ev(`DS_SEL.clear(); DS_SEL.add("${ids.l2}"); edProps(); 1`);
  ok(
    (await ev("$('edPropC').querySelector('[data-dsp=\"lt\"]').value")) === "L1" &&
      (await ev("$('edPropC').querySelector('[data-dsp=\"p\"]').placeholder")) === "18",
    "luminaria del tipo L1: su potencia (18 W) por defecto"
  );
  await ev(`DS_SEL.clear(); DS_SEL.add("${ids.te}"); edProps(); 1`);
  ok(
    (await ev("$('edPropC').querySelector('[data-dsp=\"ctp\"]').value")) === "calentador",
    "terma: carga especial de tipo calentador"
  );
  // Tipos de luminaria
  await ev("lumAbrir(); 1");
  ok((await ev("$('luLista').querySelectorAll('.lu-fila').length")) === 2, "ventana de tipos de luminaria con L1");
  await ev("lumCerrar(); 1");
  // Alimentador dibujado: clic en el tablero › Alimentador, y luego en el medidor
  await ev("DS_SEL.clear(); 1");
  const tb = await J(`dsD().els.find(e => e.id === "${ids.tb}")`);
  await clic('#editor [data-pl="tubP"]');
  // Clic sobre el tablero con la herramienta de tubería (el mismo punto y enganche que da el mouse)
  await ev(`dsPuntoTub([${tb.x}, ${tb.y}], [${tb.x}, ${tb.y}, 10, { tabla: "${ids.tb}", nom: "TG" }]); 1`);
  for (let i = 0; i < 20 && !(await ev("!$('edMenu').hidden")); i++) await esperar(50);
  ok(
    await ev("!!$('edMenu').querySelector('[data-edm=\"sal:-1\"]')"),
    `menú del tablero con «Alimentador» (${await ev("JSON.stringify([PLH.h, PLH.eng && PLH.eng[2], $('edMenu').hidden])")})`
  );
  await clic('#edMenu [data-edm="sal:-1"]');
  ok((await ev("PLH.ali")) === true, "tubería de alimentador en curso");
  await ev(`dsPuntoTub([${OX} + 0.5, ${OY} + 7.6], [${OX} + 0.5, ${OY} + 7.6, 0]); 1`);
  await ev(`dsPuntoTub([${OX} + 0.5, ${OY} + 4.1], [${OX} + 0.5, ${OY} + 4.1, 9, { con: "${ids.me}" }]); 1`);
  const ali = await J("dsD().els.find(e => e.t === 'tub' && e.ali)");
  ok(
    ali && !ali.cir && [ali.c0, ali.c1].includes(ids.tb) && [ali.c0, ali.c1].includes(ids.me),
    `alimentador del tablero al medidor, sin circuito (${ali ? [ali.c0, ali.c1, ali.cir] : "—"})`
  );
  await teclaE("Escape", "Escape", 27);
  ok(
    !(await J("dsVerificar().some(o => /sin circuito/.test(o.t))")),
    "la revisión no pide circuito al medidor ni al alimentador"
  );
  // Datos para el cálculo: tabla de circuitos y alimentador; se activa el modo y se aplica
  await ev("dcAbrir(); 1");
  ok(
    /C-1[\s\S]*C-2[\s\S]*C-3/.test(await ev("$('dcC').textContent")) &&
      /Medidor → TG[\s\S]*del plano/.test(await ev("$('dcC').textContent")),
    "ventana de datos: los tres circuitos y el alimentador del plano"
  );
  await ev("$('dcUsar').value = '1'; $('dcUsar').dispatchEvent(new Event('change', { bubbles: true })); 1");
  await esperar(120);
  ok((await ev("PROY.calPlano")) === "1", "«Calcular con el diseño» activado en el proyecto");
  await ev("edAplicar(); 1");
  await esperar(150);
  const r = await J(
    "LAST && { c: LAST.circ.filter(q => q.plano).map(q => [q.id, q.n, q.P]), ali: LAST.plano && LAST.plano.ali }"
  );
  ok(
    r &&
      JSON.stringify(r.c) ===
        JSON.stringify([
          ["C-1", 2, 118],
          ["C-2", 1, 180],
          ["C-3", 1, 1500]
        ]) &&
      r.ali,
    `el cálculo usa los circuitos del plano (${JSON.stringify(r)})`
  );
  ok(
    /ΔV total/.test(await ev("dcRender(), $('dcC').textContent")),
    "con el diseño aplicado, la caída de tensión de cada circuito"
  );
  await ev("dcCerrar(); 1");
  await clic('[data-ed="aceptar"]');
  // Pantalla del cálculo: resumen, avisos en Salidas y la ficha del circuito
  ok(/Del plano/.test(await ev("$('plCalRes').textContent")), "resumen «Del plano» en Salidas");
  ok(!(await ev("$('salPlanoN').hidden")), "aviso en Salidas: salen del plano");
  const key = await ev("LAST.circ.find(q => q.plano && q.id === 'C-1').key");
  await ev(`fichaCirc(${JSON.stringify(key)}); 1`);
  ok(
    /Circuito del diseño en el plano/.test(await ev("$('fichaDlg').textContent")),
    "ficha del circuito: datos del plano"
  );
  await ev("cerrarFicha(); 1");
  // Áreas: clic dentro de un ambiente del plano de prueba (cocina y dormitorio, de 4 × 8 m entre muros de una línea)
  await ev("edAbrir(); 1");
  for (let i = 0; i < 40 && !(await ev("!!PL_MOD && !!dsD()")); i++) await esperar(100);
  const ar = await J(
    `(() => { const r = dpAreaDetectar([${OX} + 8, ${OY} + 6], false); if (r.err) return r; return { m2: plAreaPol(r.pts) * EPL.f * EPL.f }; })()`
  );
  ok(ar.m2 > 31 && ar.m2 < 32, `área de un ambiente con un clic (${JSON.stringify(ar)})`);
  // Una tubería con dos circuitos: agrupamiento de la Tabla 5C y conductores escritos en el plano
  await ev(
    `(() => { const t = dsD().els.find(e => e.t === "tub" && e.cir === "C-1" && e.c0 === "${ids.tb}"); t.cx = ["C-2"]; edCambio(); edAplicar(); return 1; })()`
  );
  await esperar(200);
  ok(
    (await J("LAST.circ.find(q => q.plano && q.id === 'C-1').grp")).fa === 0.8,
    "C-1 con el C-2 en su tubería: factor 0.80 de la Tabla 5C"
  );
  await ev(`dcAbrir(); $('dcC').querySelector('[data-dc="escribir"]').click(); dcCerrar(); 1`);
  ok(
    (await J("dsD().els.find(e => e.t === 'tub' && e.cx).sec")) === "4-1×2.5 + 1×2.5 T mm²",
    "conductores del cálculo escritos en la tubería compartida"
  );
  await clic('[data-ed="aceptar"]');
  // Se vuelve a los datos escritos
  await ev(
    "$('calPlano').value = ''; $('calPlano').dispatchEvent(new Event('input', { bubbles: true })); $('calPlano').dispatchEvent(new Event('change', { bubbles: true })); 1"
  );
  await esperar(120);
  ok(!(await J("LAST.circ.some(q => q.plano)")), "sin el modo, los circuitos escritos");
});

prueba("Actualizar arquitectura: comparar versiones, mover el diseño y volver a medir las áreas", async ok => {
  // Versiones del arquitecto: el muro interior (x = 6 m) movido a 6.5 m, y todo el dibujo desplazado 5 m y 3 m
  const src = readFileSync(join(raiz, "pruebas", "plano-prueba.dxf"), "utf8"),
    nl = src.includes("\r\n") ? "\r\n" : "\n",
    L = src.split(nl),
    dir = mkdtempSync(join(tmpdir(), "jmg-arq-")),
    v1 = L.slice();
  for (let i = 0; i + 2 < v1.length; i++)
    if (v1[i].trim() === "LINE" && v1[i + 2].trim() === "MUROS") {
      for (let j = i; j < i + 20; j++)
        if (["10", "11"].includes(v1[j].trim()) && Math.abs(+v1[j + 1] - (OX + 6)) < 1e-6) v1[j + 1] = String(OX + 6.5);
      break;
    }
  writeFileSync(join(dir, "plano-v2.dxf"), v1.join(nl));
  const v2 = L.slice();
  let en = false;
  for (let i = 0; i + 1 < v2.length; i += 2) {
    const c = v2[i].trim();
    if (c === "2" && v2[i + 1].trim() === "ENTITIES") en = true;
    else if (c === "0" && v2[i + 1].trim() === "ENDSEC") en = false;
    if (en && /^1[0-8]$/.test(c)) v2[i + 1] = String(+v2[i + 1] + 5);
    if (en && /^2[0-8]$/.test(c)) v2[i + 1] = String(+v2[i + 1] + 3);
  }
  writeFileSync(join(dir, "plano-v3.dxf"), v2.join(nl));
  await ejemplo("uni");
  await abrirPlano();
  await ev(`(() => { dsAgregar({ t: "sim", k: "toma", x: ${OX} + 6.1, y: ${OY} + 3, r: 0, capa: "E-TOMACORRIENTES" });
    dsAgregar({ t: "sim", k: "luz", x: ${OX} + 3, y: ${OY} + 5, r: 0, capa: "E-ALUMBRADO" });
    dsAgregar({ t: "tub", pts: [${OX} + 5, ${OY} + 2, ${OX} + 7, ${OY} + 2], c: false, modo: "techo", capa: "E-TUBERIAS-TECHO" });
    dpAreaClic([${OX} + 8, ${OY} + 6], false); plPedir(null); return 1; })()`);
  const abrir = async f => {
    await clic('#editor [data-pl="actarq"]');
    const doc = await cdp("DOM.getDocument", {});
    const q = await cdp("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "#plArchivo" });
    await cdp("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [join(dir, f)] });
    for (let i = 0; i < 100 && (await ev("$('cmpDlg').hidden")); i++) await esperar(100);
  };
  await abrir("plano-v2.dxf");
  const c1 = await J(
    "({ q: PL_CMP.quit.length, a: PL_CMP.agr.length, af: PL_CMP.afect.length, m: PL_CMP.areas.map(x => +x.m1.toFixed(2)), v: EPL.arqV.length })"
  );
  ok(c1.q === 1 && c1.a === 1, `una línea quitada y una agregada (${c1.q}, ${c1.a})`);
  ok(c1.m[0] === 27.27, `área vuelta a medir: 31.27 → ${c1.m[0]} m² (el muro se movió 0.50 m)`);
  ok(c1.af === 2, `tomacorriente junto al muro y tubería que lo cruza (${c1.af})`);
  ok(c1.v === 2, "dos versiones de la arquitectura en el historial");
  await ev("dpCambiosCerrar(); 1");
  const x0 = await J("dsD().els.find(e => e.k === 'luz').x");
  await abrir("plano-v3.dxf");
  const c2 = await J("({ dx: PL_CMP.dx, dy: PL_CMP.dy, m: PL_CMP.areas.map(x => +x.m1.toFixed(2)) })");
  ok(c2.dx === 5 && c2.dy === 3, `dibujo desplazado detectado (${c2.dx}, ${c2.dy})`);
  ok(Math.abs((await J("dsD().els.find(e => e.k === 'luz').x")) - x0 - 5) < 1e-6, "el diseño se movió con el dibujo");
  ok(c2.m[0] === 31.27, `área de nuevo con el muro en su lugar (${c2.m[0]} m²)`);
  await ev("dpCambiosCerrar(); 1");
  await clic('[data-ed="cancelar"]');
  await ev(
    "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
  );
});

prueba("Ambientes: nombres del plano, tipo de ambiente, detección y ventana", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  // Reconocimiento del nombre: debe empezar con el ambiente (no notas ni leyendas)
  const k = await J(
    `["SALA", "SS.HH.", "BAÑOS MUJERES", "PATIO DE SERVICIO", "COMEDOR - COCINA", "Dorm. 1", "ASENTAMIENTO URBANO", "TOMACORRIENTE - COCINA", "en baños", "Jardinera"].map(plAmbDe)`
  );
  ok(k.join() === "sala,bano,bano,lav,coc,dorm,,,,", `tipo por el nombre escrito: ${k.map(x => x || "—").join(", ")}`);
  const R = await J("dpRotulos().map(r => [r.amb, r.n]).sort()");
  ok(R.length === 3, `tres nombres de ambientes en el plano de prueba (${R.length})`);
  ok(
    R.some(([a, n]) => a === "bano" && n === "BAÑO - COCINA"),
    "texto de dos líneas (COCINA / BAÑO): gana el baño, por prioridad"
  );
  // Detección desde la ventana (sin plantas encuadradas: lo visible en pantalla)
  await clic('#editor [data-pl="amb"]');
  ok(!(await ev("$('ambDlg').hidden")), "la cinta abre la ventana Ambientes");
  await clic('#ambDlg [data-am="detectar"]');
  for (let i = 0; i < 100 && (await ev("AM_OCUP || !AM_RES")); i++) await esperar(100);
  const A = await J(
    "dsD().els.filter(e => e.ar).map(e => ({ n: e.ar.n, amb: e.ar.amb, tp: e.ar.tp, m2: +dsM2(e).toFixed(2), p: !!e.ar.p }))"
  );
  ok(A.length === 2, `dos ambientes detectados (${A.length})`);
  const sala = A.find(a => a.amb === "sala"),
    der = A.find(a => a.amb === "bano");
  ok(sala && sala.n === "SALA" && sala.tp === "tech", "la sala: su nombre, su tipo y techada");
  ok(sala && Math.abs(sala.m2 - 48) < 0.6, `la sala mide unos 48 m² (${sala && sala.m2})`);
  ok(der && /DORMITORIO NIÑOS/.test(der.n), `dos nombres en un mismo ambiente se juntan (${der && der.n})`);
  ok(
    A.every(a => a.p),
    "cada ambiente guarda su punto (para volver a medirlo si cambia la arquitectura)"
  );
  ok(
    (await ev("$('amLista').querySelectorAll('.am-fila:not(.am-cab)').length")) === 2,
    "la ventana lista los dos ambientes"
  );
  ok(
    /50 lx|100 lx/.test(await ev("$('amLista').textContent")) &&
      /150-702\(3\)/.test(await ev("$('amLista').textContent")),
    "muestra la iluminancia de la EM.010 y la regla del CNE"
  );
  // Cambiar el tipo en la ventana
  await ev(`(() => { const s = [...$('amLista').querySelectorAll('select[data-am-k="amb"]')].find(x => x.value === "bano");
    s.value = "dorm"; s.dispatchEvent(new Event("change", { bubbles: true })); return 1; })()`);
  ok(
    (await J("dsD().els.filter(e => e.ar && e.ar.amb === 'dorm').length")) === 1,
    "el tipo cambiado en la ventana queda en el ambiente"
  );
  // Detectar otra vez no duplica
  await clic('#ambDlg [data-am="detectar"]');
  for (let i = 0; i < 100 && (await ev("AM_OCUP")); i++) await esperar(100);
  ok((await J("dsD().els.filter(e => e.ar).length")) === 2, "detectar otra vez no duplica los ambientes");
  await ev("ambCerrar(); 1");
  // Propiedades del área y validación al guardar
  await ev("dsVerIds([dsD().els.find(e => e.ar && e.ar.amb === 'sala').id]); 1");
  ok(
    await ev("!!document.querySelector('[data-dsp=\"aramb\"]')"),
    "las propiedades del área tienen el tipo de ambiente"
  );
  ok(
    (await J("disValido(JSON.parse(JSON.stringify(EPL.dis))).els.filter(e => e.ar && e.ar.amb).length")) === 2 &&
      !(await J(
        "!!(disValido({ els: [{ id: 'd1', t: 'lin', pts: [0,0,1,0,1,1], c: true, capa: 'E-AREAS', ar: { tp: 'tech', n: 'x', amb: 'constructor' } }] }).els[0].ar.amb)"
      )),
    "el tipo de ambiente se guarda y se valida"
  );
  ok(
    (await J("dpRotuloEn(dsD().els.find(e => e.ar && e.ar.amb === 'sala').pts).n")) === "SALA",
    "al marcar un área con un clic se propone el nombre escrito adentro"
  );
  await clic('[data-ed="cancelar"]');
  await ev(
    "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
  );
});

prueba("Revisión: reglas de seguridad del CNE por ambiente (baño, lavandería, circuitos y escalera)", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  await ev("document.body.classList.remove('sin-acceso'); $('acceso').hidden = true; 1");
  // Ambientes: baño (x 0–6), lavandería (x 6–10) y una escalera dentro del baño; la columna (círculo en 3, 4) es
  // la ducha, marcada a mano desde la arquitectura
  const R = await J(`(() => {
    const X = ${OX}, Y = ${OY}, ar = (x0, y0, x1, y1, amb) => dsAgregar({ t: "lin", c: true, capa: "E-AREAS", pts: [X + x0, Y + y0, X + x1, Y + y0, X + x1, Y + y1, X + x0, Y + y1], ar: { tp: "tech", n: "", amb } });
    ar(0, 0, 6, 8, "bano"); ar(6, 0, 10, 8, "lav"); ar(4.5, 6.5, 5.5, 7.5, "esc");
    const tb = dsAgregar({ t: "sim", k: "tab", x: X + 0.5, y: Y + 0.5, r: 0, capa: "E-TABLEROS", nom: "TG", nc: 6 }),
      s = (k, x, y, cir, o = {}) => dsAgregar({ t: "sim", k, x: X + x, y: Y + y, r: 0, capa: "E-DIBUJO", cir, tab: tb.id, ...o });
    s("toma", 3.3, 4, "C-1"); s("toma", 3.8, 4, "C-1"); s("int", 3, 4.5, "C-1");
    s("toma", 8, 6, "C-2"); s("luz", 2, 7, "C-2");
    s("aire", 8, 2, "C-3", { p: 1500 }); s("toma", 1, 1, "C-3");
    s("fza", 1, 3, "C-4", { p: 4000 }); s("toma", 1, 2, "C-4");
    s("luz", 5, 7, "C-5", { enc: "a" }); s("int3", 4.6, 6.6, "C-5", { enc: "a" });
    const col = PL_MOD.trazos.find(t => t.ent === "CIRCLE");
    PL_ASEL.clear(); PL_ASEL.add(col.e);
    return { tb: tb.id };
  })()`);
  await ev("edMenuAccion('ducha'); 1");
  ok(
    (await J("EPL.duchas.length")) === 1,
    "la ducha se marca desde la arquitectura (clic derecho › Es una ducha o tina)"
  );
  ok((await J("dpDuchas().length")) === 1, "la ducha marcada se reconoce");
  const V = await J("dsVerificar().map(o => [o.nivel, o.t])"),
    hay = (nv, re) => V.some(([n, t]) => n === nv && re.test(t));
  ok(hay("seg", /tomacorriente a 0\.15 m de la ducha/), "150-702(14): tomacorriente a menos de 500 mm de la ducha");
  ok(hay("aviso", /tomacorriente a 0\.65 m de la ducha/), "150-702(14): a menos de 1 m, aviso");
  ok(
    hay("seg", /interruptor a 0\.35 m de la ducha/),
    "170-326(3): interruptor al alcance desde la ducha (criterio 0.6 m)"
  );
  ok(hay("seg", /C-2.*lavandería comparten el circuito/), "150-704(7): la lavandería sin circuito independiente");
  ok(hay("seg", /C-3.*aire acondicionado comparte/), "150-704(12): el aire acondicionado sin circuito independiente");
  ok(hay("seg", /C-4.*20\.20 A comparte/), "150-702(2): carga de más de 15 A sin circuito independiente");
  ok(hay("seg", /tres vías/), "170-328: escalera con un solo interruptor de tres vías");
  ok(V[0][0] === "seg", "lo de seguridad va primero en la lista");
  // Con el segundo interruptor de tres vías, la escalera cumple
  await ev(
    `(() => { dsAgregar({ t: "sim", k: "int3", x: ${OX} + 5.4, y: ${OY} + 7.4, r: 0, capa: "E-DIBUJO", cir: "C-5", tab: "${R.tb}", enc: "a" }); return 1; })()`
  );
  ok(
    !(await J("dsVerificar().some(o => /tres vías/.test(o.t))")),
    "con interruptores de tres vías arriba y abajo, la escalera cumple"
  );
  // Diferencial: el circuito del cálculo (con el diseño) sin diferencial
  const dif = await J(`(() => { const L0 = LAST; LAST = { circ: [{ src: { t: "plano", tab: "${R.tb}", cir: "C-1" } }] };
    const v = dsVerificar().some(o => o.nivel === "seg" && /sin interruptor diferencial/.test(o.t));
    LAST = { circ: [{ src: { t: "plano", tab: "${R.tb}", cir: "C-1" }, idName: "ID-1" }] };
    const w = dsVerificar().some(o => /sin interruptor diferencial/.test(o.t));
    LAST = L0; return [v, w]; })()`);
  ok(dif[0] && !dif[1], "150-700(13): tomacorriente del baño sin diferencial (y con ID-1, cumple)");
  // Criterio editable del alcance desde la ducha
  await ev(
    "revAbrir(); $('revDuc').value = '0.3'; $('revDuc').dispatchEvent(new Event('change', { bubbles: true })); 1"
  );
  ok(
    (await J("dsCrit().duc")) === 0.3 && !(await J("dsVerificar().some(o => /interruptor a 0.35 m/.test(o.t))")),
    "el alcance desde la ducha es un criterio editable"
  );
  ok(
    /de seguridad/.test(await ev("$('revNota').textContent")) &&
      (await ev("!!document.querySelector('#revLista .rev-it.seg .rev-seg')")),
    "la ventana marca lo de seguridad"
  );
  await ev("revCerrar(); 1");
  ok(
    (await J("planoValido({ ...EPL, duchas: [EPL.duchas[0], -1, 'x'] }).duchas.length")) === 1,
    "la ducha marcada se guarda y se valida"
  );
  await clic('[data-ed="cancelar"]');
  await ev(
    "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
  );
});

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
