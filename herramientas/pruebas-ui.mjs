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
  ok((await ev("document.querySelectorAll('.ap-ribbon > .rib').length")) === 9, "9 pestañas");
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

// Ejecución
/* Diseño: plano de arquitectura (pruebas/plano-prueba.dxf: vivienda de 10 × 8 m en coordenadas UTM, generada por
   herramientas/plano-prueba.js) */
const OX = 230000,
  OY = 8180000;
async function abrirPlano() {
  await ev("abrirWS(); document.querySelector('[data-tab-r=\"diseno\"]').click()");
  await cdp("DOM.enable");
  const doc = await cdp("DOM.getDocument", {});
  const q = await cdp("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "#plArchivo" });
  await cdp("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [join(raiz, "pruebas", "plano-prueba.dxf")] });
  for (let i = 0; i < 60 && !(await ev("!!PL_MOD && $('plCarga').hidden")); i++) await esperar(100);
  await ev("plAjustar()");
  // El historial agrupa los cambios de medio segundo: abrir el plano queda como un cambio aparte
  await esperar(700);
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

prueba("Diseño: abrir un plano DXF, capas, plantas, pestañas y guardado", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  ok(
    await ev("!$('plano').hidden && getComputedStyle($('apDoc')).display === 'none'"),
    "el plano reemplaza a los resultados"
  );
  ok(await ev("PLANO.f === 1 && PLANO.de === 'cotas'"), "unidad: metros según las cotas (la cabecera dice mm)");
  ok(await ev("['OCULTA', 'CONGELADA'].every(c => PLANO.ocultas.includes(c))"), "capas apagada y congelada ocultas");
  ok(
    (await ev("document.querySelectorAll('#plCapas .pl-capa').length")) === 8,
    "8 capas con algo dibujado en el panel"
  );
  await clic('#plCapas input[data-plc="EJES"]');
  ok(await ev("PLANO.ocultas.includes('EJES')"), "ocultar la capa EJES");
  await deshacer();
  ok(
    await ev("!PLANO.ocultas.includes('EJES') && document.querySelector('#plCapas input[data-plc=\"EJES\"]').checked"),
    "deshacer vuelve a mostrar la capa"
  );
  await clic('[data-pl="planta"]');
  await clicPlano(OX - 0.5, OY - 0.5, 0);
  await clicPlano(OX + 10.5, OY + 8.5, 0);
  ok((await ev("$('plCmdV').value")) === "1er piso", "nombre propuesto para la planta");
  await clic("#plCmdOk");
  ok(await ev("PLANO.plantas.length === 1 && PLANO.plantas[0].n === '1er piso'"), "planta encuadrada y guardada");
  ok((await ev("document.querySelectorAll('#plPlantas [data-plv]').length")) === 1, "la planta aparece en el panel");
  await clic('[data-tab-r="proyecto"]');
  ok(
    await ev("$('plano').hidden && getComputedStyle($('apDoc')).display !== 'none'"),
    "otra pestaña vuelve a los resultados"
  );
  await clic('[data-tab-r="diseno"]');
  // El proyecto guardado vuelve a abrir el plano desde la base de datos del navegador
  await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); PL_MOD = null; PL_SHA = null; aplicar(o); })()");
  for (let i = 0; i < 40 && !(await ev("!!PL_MOD")); i++) await esperar(100);
  ok(await ev("!!PL_MOD && PLANO.plantas.length === 1"), "el plano se vuelve a leer del navegador con sus plantas");
  await clic('[data-tab-r="proyecto"]');
});

prueba("Diseño: distancia con enganche, recorrido, longitud de objetos y escala", async ok => {
  await ejemplo("uni");
  await abrirPlano();
  await clic('[data-pl="dist"]');
  await clicPlano(OX, OY);
  await clicPlano(OX + 10, OY);
  ok(/^Distancia 10.00 m/.test(await orden()), `distancia entre esquinas enganchadas: 10.00 m (${await orden()})`);
  await clic('[data-pl="rec"]');
  await clicPlano(OX, OY);
  await clicPlano(OX + 10, OY);
  await clicPlano(OX + 10, OY + 8);
  await tecla("Enter", "Enter", 13);
  await esperar(80);
  ok(/^Recorrido 18.00 m · 2 tramos/.test(await orden()), `recorrido de dos tramos: 18.00 m (${await orden()})`);
  await clic('[data-pl="obj"]');
  await clicPlano(OX + 2, OY + 1, 0);
  ok(/^1 objeto · 5.14 m/.test(await orden()), `tubería con curva: 5.14 m (${await orden()})`);
  await clic('[data-pl="escala"]');
  await clicPlano(OX, OY);
  await clicPlano(OX + 10, OY);
  ok((await ev("$('plCmdV').value")) === "10.00", "la medida en el dibujo se propone como medida real");
  await poner("#plCmdV", "20");
  await clic("#plCmdOk");
  ok(await ev("PLANO.f === 2 && PLANO.de === 'manual'"), "escala comprobada: 1 unidad = 2 m");
  await deshacer();
  ok(await ev("PLANO.f === 1"), "deshacer vuelve a la escala anterior");
  await tecla("Escape", "Escape", 27);
  await clic('[data-tab-r="proyecto"]');
});

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
