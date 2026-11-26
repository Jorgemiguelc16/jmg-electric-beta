/* Pruebas de la interfaz · Proyecto: cinta, ventanas y fichas, datos del proyecto, departamentos, panel y explorador.
   Se cargan desde herramientas/pruebas-ui.mjs, en el orden del nombre del archivo; reciben los ayudantes comunes. */
export default ({
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
}) => {
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
      "(s => { s.value = '35'; s.dispatchEvent(new Event('change', {bubbles:true})); })(document.querySelector('#cdBody select'))"
    );
    const fila = await ev("document.querySelector('#cdBody tr:nth-child(2)').cells[6].textContent");
    ok(fila === "0.37", `ΔV del alimentador en la vista previa 0.37 % (dio ${fila})`);
    ok((await ev("LAST.alims[0].S")) === 16, "el proyecto sigue con 16 mm²");
    await clic('#condDlg [data-cd="cancel"].vw-btn');
    ok((await J("SECF.uni")) && !Object.keys(await J("SECF.uni")).length, "cancelar no cambia las secciones");
    await ev("cuadroCond(true)");
    await ev(
      "(s => { s.value = '35'; s.dispatchEvent(new Event('change', {bubbles:true})); })(document.querySelector('#cdBody select'))"
    );
    await clic('#condDlg [data-cd="ok"]');
    ok((await ev("LAST.alims[0].S")) === 35, "aplicado: alimentador de 35 mm²");
    ok((await ev("LAST.circ.find(q => /Ducha/.test(q.desc)).dVt")) < dv0, "baja la ΔV de los circuitos aguas abajo");
    // También las secciones menores que la automática: el cálculo la usa y la marca «No cumple» (se ve cuánto excede)
    await ev("cuadroCond(true)");
    const ops = await J(
      "(s => ({ grupos: [...s.querySelectorAll('optgroup')].map(g => g.label + ':' + g.children.length), no: [...s.querySelectorAll('option.cd-no')].map(o => o.textContent), auto: s.querySelector('option.cd-auto').textContent, n: s.options.length }))(document.querySelector('#cdBody select'))"
    );
    ok(
      ops.n === 12 &&
        ops.auto === "16 mm²" &&
        ops.no.includes("10 mm²") &&
        ops.grupos.join("|") === "Automática · cumple:1|Mayores · cumplen:6|Menores · no cumplen:5",
      `la lista tiene todas las secciones en tres grupos (${ops.grupos.join(", ")}), las menores en rojo`
    );
    await ev(
      "(s => { s.value = '10'; s.dispatchEvent(new Event('change', {bubbles:true})); })(document.querySelector('#cdBody select'))"
    );
    await clic('#condDlg [data-cd="ok"]');
    ok(
      await ev(
        "LAST.alims[0].S === 10 && LAST.alims[0].Sauto === 16 && !LAST.alims[0].ok && LAST.alims[0].Izc < LAST.alims[0].itm"
      ),
      "10 mm² elegido: el alimentador queda con 10 mm², no cumple y se ve que Iz corregida es menor que el ITM"
    );
    ok(await ev("alertas(LAST)[0][0] === false"), "y la verificación normativa lo marca como incumplimiento");
    await ev("SECF.uni = {}; calcularAhora(); 1");
  });

  prueba("Ficha del circuito: vista previa, fase, aplicar y deshacer", async ok => {
    await ejemplo("uni");
    await ev(
      "document.querySelector('input[name=sist][value=tri380]').checked = true; document.querySelector('input[name=sist][value=tri380]').dispatchEvent(new Event('change', {bubbles:true})); calcularAhora(); fichaCirc('TG·C-6')"
    );
    await poner('[data-fce="L"]', 60);
    await esperar(400);
    ok(/2-1×10 mm²/.test(await ev("$('fcRes').textContent")), "vista previa con 10 mm² a 60 m");
    ok(
      (await J("[cargas[0].L, LAST.circ.find(q => q.key === 'TG·C-6').S]")).join() === "12,4",
      "el proyecto no cambia"
    );
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
        "['dpDlg','ppDlg','tcDlg','fichaDlg','ftDlg','condDlg'].find(d => !$(d).hidden) || (VIEW === 'metrado' || VIEW === 'presupuesto' ? VIEW : '')"
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
};
