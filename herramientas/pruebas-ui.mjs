/* Pruebas de la interfaz («npm run pruebas-ui»), solo para desarrollo.
   Abre index.html en Chrome sin ventana (protocolo DevTools), entra sin cuenta y recorre las ventanas como lo
   haría un usuario: abrir, editar, vista previa, aplicar, cancelar, deshacer, doble clic. Cada prueba verifica
   el resultado esperado; al final muestra cuáles pasaron. Las pruebas del cálculo son «npm test».
   Chrome lo abre herramientas/chrome.mjs. */
import { join } from "node:path";
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
  ok(await ev("EPL.dis && EPL.dis.capas.length === 13 && !EPL.dis.els.length"), "diseño nuevo con sus 13 capas");
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

// Ejecución
let mal = 0;
const t0 = Date.now();
for (const [nombre, fn] of PRUEBAS) {
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
const n = PRUEBAS.length;
console.log(
  mal
    ? `\n✘ ${mal} de ${n} pruebas de la interfaz fallaron (${((Date.now() - t0) / 1000).toFixed(1)} s)`
    : `\n✔ Todas las pruebas de la interfaz pasaron (${n} de ${n}) en ${((Date.now() - t0) / 1000).toFixed(1)} s`
);
cerrar();
process.exit(mal ? 1 : 0);
