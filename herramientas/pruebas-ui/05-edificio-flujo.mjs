/* Pruebas de la interfaz · Edificio y flujo: banco de medidores, TSG, flujo con el plano y tablero general.
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
  prueba(
    "Edificio: banco de medidores junto o lejos del TG, TSG, medidor trifásico y esquema del tablero",
    async ok => {
      await ejemplo("multi");
      ok(await ev("$('LbmBox').hidden"), "con el banco junto al TG no se pide la longitud TG → banco");
      await poner("#bmJunto", "0");
      await ev("update(); 1");
      ok(!(await ev("$('LbmBox').hidden")), "con el banco en otro lugar aparece la longitud TG → banco");
      ok(
        await ev("$('tgbmBox').hidden"),
        "y se oculta el Ø máximo de la tubería TG → banco (solo con el banco junto al TG)"
      );
      await poner("#Lbm", "30");
      await ev("update(); 1");
      ok(
        await ev("LAST.alims.some(a => a.pKey === 'bm' && a.L === 30)"),
        "el cálculo agrega el alimentador TG → banco de medidores (30 m)"
      );
      await poner("#tsgDe", "tg");
      await ev("update(); 1");
      ok(
        await ev("/TG → tablero de servicios/.test(LAST.alims.find(a => a.pKey === 'servP').desc) && LAST.topo.tsgTG"),
        "TSG directo desde el TG"
      );
      ok(
        await ev(
          "!suministrosBanco(LAST).some(m => m.tab === 'TSG') && suministrosBanco(LAST, true).some(m => m.tab === 'TSG')"
        ),
        "el TSG desde el TG no tiene medidor en el banco (sí su salida en el TG)"
      );
      const svg = await ev("unifilar(LAST).svg || ''");
      ok(
        /TG → banco de medidores/.test(svg) && /desde el TG \(sin medidor\)/.test(svg),
        "el unifilar muestra el tramo y el TSG desde el TG"
      );
      ok(
        await ev("!!bancoMedidores(LAST) && !!tableroGeneral(LAST)"),
        "láminas del banco y del tablero general sin errores"
      );
      // Medidor trifásico en el tipo B, desde el editor de departamentos
      await ev("tipos[1].fases = '3'; update(); 1");
      ok(
        await ev("LAST.alims.find(a => a.pKey === 'tipo' && LAST.T[a.ti]._i === 1).s.tri"),
        "departamento con medidor trifásico: alimentador trifásico"
      );
      // Esquema en la ventana del tablero
      await abrirPlano();
      const id = await J(
        `dsAgregar({ t: "sim", k: "tab", x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: "E-TABLEROS", nom: "TG", nc: 2 }).id`
      );
      await ev(`edCambio(); tabAbrir("${id}"); 1`);
      const esq = await ev("$('taEsq').textContent");
      ok(
        /IG 3P/.test(esq) && /→ Banco/.test(esq) && /→ TSG/.test(esq) && /R-S-T-N-PE/.test(esq),
        `TG del edificio: interruptor tripolar, barras R-S-T-N-PE y salidas al banco y al TSG (${esq.slice(0, 80)}…)`
      );
      await poner("#taDep", "0");
      await poner("#taNom", "TD-A");
      ok(/IG 2P/.test(await ev("$('taEsq').textContent")), "tablero de departamento monofásico: interruptor bipolar");
      await ev("tabCerrar(); 1");
      // Banco de medidores: sus medidores numerados (uno por departamento y, con el TSG en el banco, el suyo)
      await ev("ponerDato('tsgDe', 'bm'); 1");
      const M = await J("dsMedidoresBanco()"),
        nDep = await ev("tipos.reduce((s, t) => s + Math.round(+t.cant || 0), 0)");
      ok(
        M.length === nDep + 1 && M[0].n === "M-1" && M[M.length - 1].dep === "TSG" && M.some(m => m.tri),
        `medidores del banco numerados: ${M.length} (${M.map(m => m.n + " " + m.dep)
          .slice(0, 3)
          .join(", ")}…)`
      );
      const bm = await J(
        `dsAgregar({ t: "sim", k: "bmed", x: ${OX} + 6, y: ${OY} + 7.5, r: 0, capa: "E-TABLEROS" }).id`
      );
      await ev(`edCambio(); DS_SEL.clear(); DS_SEL.add("${bm}"); edProps(); 1`);
      ok(
        (await ev("$('edPropC').querySelectorAll('.ds-bm tbody tr').length")) === M.length &&
          !(await ev(`!!$('edPropC').querySelector('[data-dsp="cir"]')`)),
        "propiedades del banco: la lista de sus medidores y sin campo de circuito"
      );
      // Igual que en la lámina del banco (IE-06)
      await ev("update(); 1");
      const L6 = await J("suministrosBanco(LAST).map(m => m.med + ' ' + m.nom)");
      ok(
        JSON.stringify(L6) === JSON.stringify(M.map(m => m.n + " " + m.dep)),
        `la misma numeración en la lámina del banco (${L6.slice(0, 2).join(", ")}…)`
      );
      await poner('#edPropC [data-dsp="num"]', "1");
      ok(
        (await J(`dsD().els.find(e => e.id === "${bm}").num`)) === true,
        "se puede escribir también la lista en el plano"
      );
      // Datos para el cálculo en el edificio: áreas por tipo, un área dentro de otra del mismo tipo y un área sin tipo
      await ev(
        `(() => { const X = ${OX}, Y = ${OY}, ar = (x0, y0, x1, y1, n, dep) => dsAgregar({ t: "lin", c: true, capa: "E-AREAS", pts: [X + x0, Y + y0, X + x1, Y + y0, X + x1, Y + y1, X + x0, Y + y1], ar: { tp: "tech", n, ...(dep !== undefined ? { dep } : {}) } });
      ar(0, 0, 8, 6, "DEPARTAMENTO", 0); ar(1, 1, 3, 3, "SALA", 0); ar(9, 0, 10, 2, "PASADIZO"); edCambio(); dcAbrir(); })()`
      );
      const dct = await ev("$('dcC').textContent");
      ok(
        /Áreas por tipo/.test(dct) &&
          /«SALA»[\s\S]*?dentro de «DEPARTAMENTO»[\s\S]*?se suman dos veces/.test(dct) &&
          /«PASADIZO»[\s\S]*?no es de ningún tipo/.test(dct) &&
          !/TG → TD-/.test(dct) &&
          !/falta el contorno exterior/.test(dct),
        `ventana de datos del edificio: áreas por tipo, área contada dos veces y área sin tipo (${dct.slice(dct.indexOf("Áreas por tipo"), dct.indexOf("Áreas por tipo") + 400)})`
      );
      await ev("dcCerrar(); 1");
      await clic('[data-ed="cancelar"]');
      await ev(
        "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
      );
    }
  );

  prueba("Flujo con el plano: asistente, editor primero, pasos del diseño y cálculo en vivo", async ok => {
    // Nuevo proyecto «Diseño con plano»: se calcula con el diseño y el editor se abre enseguida
    await ev("asistente(true, 'uni'); 1");
    ok(await ev("radio('wz_flujo') === 'plano'"), "el asistente propone «Diseño con plano»");
    await poner("#wz_nombre", "Casa con plano primero");
    await clic('[data-wz="ok"]');
    await esperar(300);
    ok(
      await ev("PROY.calPlano === '1' && !$('editor').hidden && document.body.classList.contains('ed-on')"),
      "el proyecto se calcula con el diseño y el editor se abre solo"
    );
    ok(
      /Abra el DXF/.test(await ev("$('edRevRib').textContent")) &&
        /Para calcular falta/.test(await ev("$('edVivo').textContent")),
      "pasos del diseño (abra el DXF) y lo que falta para calcular"
    );
    // El plano y un diseño mínimo: TG con un circuito de alumbrado y otro de tomacorrientes
    await cdp("DOM.enable");
    const doc = await cdp("DOM.getDocument", {});
    const q = await cdp("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "#plArchivo" });
    await cdp("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [join(raiz, "pruebas", "plano-prueba.dxf")] });
    for (let i = 0; i < 60 && !(await ev("!!PL_MOD && $('plCarga').hidden")); i++) await esperar(100);
    await J(`(() => {
    const a = o => dsAgregar(o).id;
    const tb = a({ t: "sim", k: "tab", x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: "E-TABLEROS", nom: "TG", nc: 2 }),
      l1 = a({ t: "sim", k: "luz", x: ${OX} + 3, y: ${OY} + 5, r: 0, capa: "E-ALUMBRADO", cir: "C-1", tab: tb }),
      t1 = a({ t: "sim", k: "toma", x: ${OX} + 5, y: ${OY} + 7.5, r: 0, capa: "E-TOMACORRIENTES", cir: "C-2", tab: tb });
    a({ t: "tub", pts: [${OX} + 3, ${OY} + 7.6, ${OX} + 3, ${OY} + 5], c: false, modo: "techo", capa: "E-TUBERIAS-TECHO", c0: tb, c1: l1, cir: "C-1", tab: tb });
    a({ t: "tub", pts: [${OX} + 3, ${OY} + 7.6, ${OX} + 5, ${OY} + 7.6, ${OX} + 5, ${OY} + 7.5], c: false, modo: "piso", capa: "E-TUBERIAS-PISO", c0: tb, c1: t1, cir: "C-2", tab: tb });
    edCambio();
    return 1;
  })()`);
    await esperar(1000);
    ok(/alimentador hasta el TG/.test(await ev("$('edVivo').textContent")), "lo que falta dice cómo sacarlo del plano");
    // Con tableros en el plano, el cálculo sale aunque falten datos: preliminar, sin Excel
    ok(
      /Preliminar/.test(await ev("$('edVivoE').textContent")) &&
        !!(await ev("!!(LAST && LAST.prelim) && $('btnXlsx').disabled")),
      "cálculo preliminar con lo que tiene el diseño, sin Excel"
    );
    // Por partes: el área y el alimentador general faltan, así que la máxima demanda y el alimentador dicen «pendiente»
    ok(
      /MD pendiente/.test(await ev("$('wsStatus').textContent")) &&
        /PRELIMINAR/.test(await ev("$('wsStatus').textContent")) &&
        /pendiente/.test(await ev("$('edVivo').textContent")),
      "lo que depende de un dato que falta dice «pendiente», sin números de relleno"
    );
    // El área y el alimentador escritos (en un proyecto real, se marcan en el plano)
    await ev("ponerDato('area', '100'); ponerDato('Lalim', '12'); calcularAhora(); edVivo(); 1");
    const pasos = await J(
      "[...document.querySelectorAll('#edRevRib .rb-paso')].map(b => b.dataset.paso + ':' + b.className.split(' ')[2])"
    );
    ok(
      ["plano:ok", "tab:ok", "art:ok", "tub:ok"].every(x => pasos.includes(x)),
      `pasos hechos: plano, tableros, artefactos y tuberías (${pasos.join(", ")})`
    );
    ok(await ev("!!PLANO && PLANO.dis.els.length === 5"), "el diseño ya está guardado en el proyecto, sin Aplicar");
    const vivo = await ev("$('edVivo').textContent");
    ok(
      /Máxima demanda/.test(vivo) && /ΔV máxima/.test(vivo) && !!(await ev("LAST && LAST.plano")),
      `cálculo en vivo con el diseño (${vivo.slice(0, 70)}…)`
    );
    // Un clic en «Tableros» lleva a la herramienta del tablero
    await clic('#editor [data-tab-e="revision"]');
    ok(/Diseño \d\/7/.test(await ev("$('edAvance').textContent")), "avance del diseño en la barra de estado");
    // Secciones del panel izquierdo: se ocultan y se muestran con su título
    await clic('[data-sectg="dis"]');
    ok(
      await ev(
        "document.querySelector('[data-sec=\"dis\"]').classList.contains('cerrada') && $('dsResumen').offsetHeight === 0"
      ),
      "la sección Diseño eléctrico se oculta con su título"
    );
    await clic('[data-sectg="dis"]');
    ok((await ev("$('dsResumen').offsetHeight")) > 0, "y se vuelve a mostrar");
    await clic('#edRevRib [data-paso="tab"]');
    ok((await ev("PLH.h")) === "col:tab", "el paso Tableros activa la herramienta del tablero");
    await teclaE("Escape", "Escape", 27);
    // «Resultados»: guarda, cierra el editor y muestra los resultados
    await clic('#edRevRib .rb-paso[data-paso="res"]');
    ok(await ev("$('editor').hidden && HIST.length > 0"), "«Resultados» vuelve al proyecto");
    // Al abrir el proyecto otra vez, se abre en el editor
    await ev(
      "(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); setTab('calculo'); abrirSegunFlujo(); })()"
    );
    ok(await ev("!$('editor').hidden"), "un proyecto con el plano se abre en el editor de diseño");
    await clic('[data-ed="aceptar"]');
    // Cálculo rápido: como siempre
    await ev("asistente(true, 'uni'); 1");
    await poner("#wz_nombre", "Casa rápida");
    await clic('.wz-flujo input[value="rapido"]');
    await clic('[data-wz="ok"]');
    ok(
      await ev("PROY.calPlano !== '1' && $('editor').hidden"),
      "«Cálculo rápido»: sin editor y con los datos escritos"
    );
  });

  prueba("Tablero general solo con alimentadores, banco con sus medidores y tuberías del TG al banco", async ok => {
    await ejemplo("uni");
    await abrirPlano();
    const ids = await J(`(() => {
    const a = o => dsAgregar(o).id;
    return {
      tg: a({ t: "sim", k: "tab", x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: "E-TABLEROS", nom: "TG", nc: 5, fs: 3 }),
      td: a({ t: "sim", k: "tab", x: ${OX} + 8, y: ${OY} + 7.9, r: 180, capa: "E-TABLEROS", nom: "TD-1", nc: 3 }),
      bm: a({ t: "sim", k: "bmed", x: ${OX} + 5, y: ${OY} + 7.5, r: 0, capa: "E-TABLEROS" })
    };
  })()`);
    await ev("ponerDato('sist', 'tri380'); edCambio(); 1");
    // Tablero general: sin circuitos derivados; el esquema muestra sus alimentadores, cada uno con todas las fases
    await ev(`tabAbrir("${ids.tg}"); 1`);
    await poner("#taGen", "1");
    ok(await ev("$('taNL').hidden && $('taLista').hidden"), "tablero general: sin número ni lista de circuitos");
    const esq = await ev("$('taEsq').textContent");
    ok(
      /→ Banco/.test(esq) && /→ TD-1/.test(esq) && !/C-1/.test(esq),
      `alimentadores al banco y al TD-1 (${esq.slice(0, 60)}…)`
    );
    ok(
      (await ev("$('taEsq').querySelectorAll('circle').length")) >= 8,
      "cada alimentador se conecta a las barras R, S, T y N (puntos de conexión)"
    );
    await clic('[data-ta="ok"]');
    const tg = await J(`dsD().els.find(e => e.id === "${ids.tg}")`);
    ok(
      tg.gen === true &&
        tg.nc === 0 &&
        (await ev(`dsSalidasTab(dsD().els.find(e => e.id === "${ids.tg}")).length`)) === 0,
      "el TG ya no tiene salidas C-1, C-2…"
    );
    ok(
      !(await J("dsVerificar().some(o => /TG sin circuitos/.test(o.t))")),
      "la revisión no pide circuitos al tablero general"
    );
    // Del tablero general sale el alimentador al banco: el menú lo ofrece y la tubería se dibuja conectada a los dos
    await clic('#editor [data-pl="tubT"]');
    await ev(`dsPuntoTub([${tg.x}, ${tg.y}], [${tg.x}, ${tg.y}, 10, { tabla: "${ids.tg}", nom: "TG" }]); 1`);
    ok(
      /Alimentador → Banco de medidores/.test(await ev("$('edMenu').textContent")),
      "menú del TG: «Alimentador → Banco de medidores»"
    );
    await clic('#edMenu [data-edm="sal:-100"]');
    const ali = await J(`dsD().els.find(e => e.t === "tub" && e.ali && e.c0 === "${ids.tg}")`);
    ok(ali && ali.c1 === ids.bm, "alimentador del TG al banco, conectado a los dos");
    await teclaE("Escape", "Escape", 27);
    // Circuitos de distribución: cada circuito toma su fase (R, S, T en turno) y el neutro
    await ev(`tabAbrir("${ids.td}"); 1`);
    ok(
      (await ev("$('taEsq').querySelectorAll('circle').length")) === 6,
      "tablero de distribución trifásico: cada circuito con su fase y el neutro"
    );
    await ev("tabCerrar(); 1");
    // Banco de medidores fuera de un edificio: sus medidores se escriben en el banco
    await ev(`DS_SEL.clear(); DS_SEL.add("${ids.bm}"); edProps(); 1`);
    await poner('#edPropC [data-dsp="bmn"]', "3");
    ok(
      (await ev("$('edPropC').querySelectorAll('.ds-bm tbody tr').length")) === 3,
      "3 medidores en la tabla del banco"
    );
    await poner('#edPropC [data-dsp="bmd0"]', "TD-1");
    await poner('#edPropC [data-dsp="bmf1"]', "3");
    const M = await J(`dsMedidoresBanco(dsD().els.find(e => e.id === "${ids.bm}"))`);
    ok(
      M.length === 3 && M[0].n === "M-1" && M[0].dep === "TD-1" && M[1].tri && !M[2].dep,
      `medidores escritos: ${M.map(m => m.n + " " + (m.dep || "—") + (m.tri ? " 3φ" : "")).join(", ")}`
    );
    // El símbolo del banco dibuja sus medidores: un contador numerado por medidor
    ok(
      /M-3/.test(await ev("$('edPropC').querySelector('.ds-bprev svg')?.textContent || ''")) &&
        (await J("dsPrims('bmed#9').filter(p => p.t === 't').map(p => p.tx).join(',')")) === "1,2,3,4,5,6,7,8,9,BM",
      "las propiedades del banco dibujan sus medidores (M-1, M-2, M-3)"
    );
    await esperar(800);
    ok(
      (await J(`PLANO.dis.els.find(e => e.id === "${ids.bm}").meds.length`)) === 3,
      "los medidores se guardan con el proyecto"
    );
    await clic('[data-ed="cancelar"]');
    await ev(
      "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
    );
    // Edificio con el banco junto al TG: tuberías del TG al banco con todos sus conductores
    await ejemplo("multi");
    ok(
      await ev(
        "!!LAST.tgbm && LAST.tgbm.tubos.length >= 1 && LAST.tgbm.n > 0 && /Del TG al banco de medidores/.test(tablaAlims(LAST, 1))"
      ),
      "tuberías del TG al banco dimensionadas y en los resultados"
    );
    // Edificio: los medidores salen de los departamentos o se escriben en el banco; sin departamentos, se escriben
    await abrirPlano();
    const bm2 = await J(
      `dsAgregar({ t: "sim", k: "bmed", x: ${OX} + 5, y: ${OY} + 7.5, r: 0, capa: "E-TABLEROS" }).id`
    );
    await ev(`edCambio(); DS_SEL.clear(); DS_SEL.add("${bm2}"); edProps(); 1`);
    ok(
      (await ev("$('edPropC').querySelector('[data-dsp=\"mman\"]').value")) === "" &&
        (await ev("$('edPropC').querySelectorAll('.ds-bm tbody tr').length")) > 0,
      "edificio: los medidores según los departamentos"
    );
    await poner('#edPropC [data-dsp="mman"]', "1");
    ok(!!(await ev("$('edPropC').querySelector('[data-dsp=\"bmn\"]')")), "o escritos en el banco («Escritos aquí»)");
    await ev("tipos.forEach(t => (t.cant = 0)); edProps(); 1");
    await ev(`dsD().els.find(e => e.id === "${bm2}").mman = undefined; edProps(); 1`);
    ok(
      !!(await ev("$('edPropC').querySelector('[data-dsp=\"bmn\"]')")),
      "edificio sin departamentos con su cantidad: los medidores se escriben en el banco"
    );
    await clic('[data-ed="cancelar"]');
    await ev(
      "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
    );
  });
};
