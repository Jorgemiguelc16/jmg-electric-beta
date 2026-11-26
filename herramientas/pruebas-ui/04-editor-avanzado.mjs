/* Pruebas de la interfaz · Editor de diseño: base del navegador, fondo, cuadro y metrado, giro, salidas, repartir, calcular con el diseño, arquitectura, ambientes, revisión y circuitos.
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
      // Dos tuberías entre los mismos puntos (C-1 y C-2 del tablero a la misma luminaria): la revisión las junta
      await ev(
        `(() => { const t = dsD().els.find(e => e.t === 'tub' && e.c0 === dsD().els.find(x => x.k === 'tab').id); dsAgregar({ ...JSON.parse(JSON.stringify(t)), id: undefined, cir: 'C-2', cond: undefined }); t.cx = ['C-1']; edCambio(); return 1; })()`
      );
      await clic('#editor [data-pl="revisar"]');
      ok(
        /C-1 y C-2 de TG: 2 tuberías entre los mismos puntos/.test(await ev("$('revLista').textContent")) &&
          (await ev("!!$('revLista').querySelector('[data-revj]')")),
        "la revisión avisa de dos tuberías entre los mismos puntos y ofrece juntarlas"
      );
      await clic("#revLista [data-revj]");
      const jt = await J(
        "(() => { const tb = dsD().els.find(x => x.k === 'tab'), l = dsD().els.filter(e => e.t === 'tub' && e.c0 === tb.id); return { n: l.length, cir: l[0].cir, cx: l[0].cx, cond: l[0].cond, auto: !!l[0].condA }; })()"
      );
      ok(
        jt.n === 1 && jt.cir === "C-1" && JSON.stringify(jt.cx) === '["C-2"]' && jt.cond.f === 4 && jt.auto,
        `juntadas: una tubería con C-1 y C-2 y sus conductores automáticos (${JSON.stringify(jt)})`
      );
      await clic('[data-rev="cerrar"]');
      // Vuelve a la tubería de antes (solo C-1, 1F+1N+T) para lo que sigue
      await ev(
        "(() => { const t = dsD().els.find(e => e.t === 'tub' && e.cx); delete t.cx; delete t.condA; t.cond = { f: 1, n: 1, t: true }; edCambio(); return 1; })()"
      );
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
    ok(
      (await ev("!$('edAng').hidden && $('edAngB').textContent")) === "0°",
      "el ángulo aparece junto al punto de giro"
    );
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
      // Las esquinas del marco pueden engancharse al muro (según el zoom): x ≈ 1.13 m o 1.0 m
      l.length === 6 && l.some(p => p[0] > 0.95 && p[0] < 1.2 && p[1] > 5.8 && p[1] < 6.05),
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
    // Verificar longitudes (cuadro de conductores): los tramos del recorrido suman la longitud del cuadro
    await ev("cuadroCond(true); 1");
    await clic(`#cdBody tr[data-circ="${key}"]`);
    await clic('#condDlg [data-cd="lg"]');
    const lg = await J(
      `(() => { const q = LAST.circ.find(x => x.key === LG_KEY), f = [...$('lgC').querySelectorAll('tbody tr:not(.lg-tot):not(.grp)')];
      const s = f.reduce((a, tr) => a + (+tr.cells[4].textContent || 0) + (+tr.cells[5].textContent || 0), 0), tot = $('lgC').querySelector('.lg-tot').cells[4].textContent;
      document.querySelector('#lgTabs [data-lgt="sal"]').click();
      const sal = $('lgC').querySelectorAll('tbody tr:not(.grp)').length;
      document.querySelector('#lgTabs [data-lgt="rec"]').click();
      return { k: LG_KEY, n: f.length, s, L: q.L, tot, sal }; })()`
    );
    ok(
      lg.k === key &&
        lg.n >= 3 &&
        Math.abs(lg.s - lg.L) < 0.02 &&
        +lg.tot === Math.round(lg.L * 100) / 100 &&
        lg.sal === 2,
      `verificar longitudes: los tramos del C-1 suman su longitud del cuadro (${JSON.stringify(lg)})`
    );
    await clic('#lgDlg [data-lg="plano"]');
    for (let i = 0; i < 40 && !(await ev("!!PL_MOD && !!dsD() && DS_SEL.size > 0")); i++) await esperar(100);
    ok(
      await ev("$('lgDlg').hidden && $('condDlg').hidden && DS_SEL.size >= 3"),
      "«Ver el recorrido en el plano»: cierra las ventanas y elige el recorrido en el editor"
    );
    await clic('[data-ed="aceptar"]');
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
          if (["10", "11"].includes(v1[j].trim()) && Math.abs(+v1[j + 1] - (OX + 6)) < 1e-6)
            v1[j + 1] = String(OX + 6.5);
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
    ok(
      k.join() === "sala,bano,bano,lav,coc,dorm,,,,",
      `tipo por el nombre escrito: ${k.map(x => x || "—").join(", ")}`
    );
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
    // Cambiar el tipo en la ventana: el botón del tipo abre la ventana para elegirlo
    await ev(`(() => { const id = dsD().els.find(e => e.ar && e.ar.amb === "bano").id;
    $('amLista').querySelector('[data-am-tipo="' + id + '"]').click(); return 1; })()`);
    ok(
      await ev("!$('ambDlg').hidden && AM_TAB === 'lux' && !!LX_PICK && LX_G === 'viv'"),
      "el botón del tipo abre la ventana para elegirlo, en los de vivienda"
    );
    await ev(`document.querySelector('#lxLista [data-lx-pick="dorm"]').click(); 1`);
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
      await ev("!!document.querySelector('[data-dsa=\"ambtipo\"]')"),
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
    const dif =
      await J(`(() => { const L0 = LAST; LAST = { circ: [{ src: { t: "plano", tab: "${R.tb}", cir: "C-1" } }] };
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

  prueba("Editor de diseño: la tubería llega justo al dibujo de cada artefacto (sin espacio)", async ok => {
    await ejemplo("uni");
    await abrirPlano();
    // Para cada símbolo (y girado), una tubería que llega desde lejos: su punta debe quedar sobre el dibujo
    const R = await J(`(() => {
    const dSeg = (x, y, a, b, c, d) => { const ex = c - a, ey = d - b, L = ex * ex + ey * ey || 1, s = Math.max(0, Math.min(1, ((x - a) * ex + (y - b) * ey) / L)); return Math.hypot(x - a - s * ex, y - b - s * ey); };
    const dist = (k, x, y) => { let m = Infinity; dsPrims(k).forEach(p => { const a = p.a;
      if (p.t === "l") m = Math.min(m, dSeg(x, y, ...a));
      else if (p.t === "c") m = Math.min(m, Math.abs(Math.hypot(x - a[0], y - a[1]) - a[2]));
      else if (p.t === "e") for (let i = 0; i < 720; i++) { const q = i * Math.PI / 360; m = Math.min(m, Math.hypot(x - a[0] - a[2] * Math.cos(q), y - a[1] - a[3] * Math.sin(q))); }
      else if (p.t === "r") { const [x0, y0, w, h] = a; m = Math.min(m, dSeg(x, y, x0, y0, x0 + w, y0), dSeg(x, y, x0 + w, y0, x0 + w, y0 + h), dSeg(x, y, x0 + w, y0 + h, x0, y0 + h), dSeg(x, y, x0, y0 + h, x0, y0)); }
      else if (p.t === "p") for (let i = 0; i + 1 < a.length; i += 2) { const j = i + 2 < a.length - 1 ? i + 2 : 0; m = Math.min(m, dSeg(x, y, a[i], a[i + 1], a[j], a[j + 1])); }
      else if (p.t === "t" && !dsEsLetra(k, p)) { const w = a[2] * 0.6 * p.tx.length, h = a[2] * 0.8, x0 = p.an === "middle" ? a[0] - w / 2 : a[0], y0 = a[1] - h; m = Math.min(m, dSeg(x, y, x0, y0, x0 + w, y0), dSeg(x, y, x0 + w, y0, x0 + w, y0 + h), dSeg(x, y, x0 + w, y0 + h, x0, y0 + h), dSeg(x, y, x0, y0 + h, x0, y0)); } }); return m; };
    const out = [];
    ["int", "int3", "conm", "toma", "luz", "braq", "aire", "tomaMult", "telTV", "posLuz", "subida"].forEach((k, i) => [0, 37].forEach(r => {
      const s = dsAgregar({ t: "sim", k, x: ${OX} + 1 + (i % 6) * 1.5, y: ${OY} + 2 + Math.floor(i / 6) * 2 + (r ? 1 : 0), r, capa: "E-DIBUJO" }),
        t = dsAgregar({ t: "tub", pts: [s.x - 0.8, s.y + 0.6, s.x, s.y], c: false, modo: "techo", capa: "E-TUBERIAS-TECHO", c1: s.id });
      edCambio();
      const [a, b] = dsALocal(s, t.pts[2], t.pts[3]);
      out.push([k, r, +dist(k, a, b).toFixed(4)]);
    }));
    return out; })()`);
    const mal = R.filter(x => x[2] > 0.01);
    ok(
      !mal.length,
      `${R.length} llegadas, todas sobre el dibujo del símbolo${mal.length ? " · con espacio: " + JSON.stringify(mal) : ""}`
    );
    ok(
      R.some(x => x[0] === "int") && R.some(x => x[1] === 37),
      "incluye el interruptor (antes quedaba a 4 unidades) y símbolos girados"
    );
    await clic('[data-ed="cancelar"]');
    await ev(
      "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
    );
  });

  prueba("Editor de diseño: presentación y paneles ocultos sin perder el plano ni el zoom", async ok => {
    await ejemplo("uni");
    await abrirPlano();
    const vista = () => J("({ w: plLienzo.clientWidth, h: plLienzo.clientHeight, s: PLV.s, cx: PLV.cx, cy: PLV.cy })");
    const v0 = await vista();
    await ev("edPresentar(true); 1");
    await esperar(400);
    const v1 = await vista();
    ok(
      v1.w > v0.w && v1.h >= v0.h,
      `en la presentación el plano ocupa la pantalla (${v0.w}×${v0.h} → ${v1.w}×${v1.h})`
    );
    await ev("edPresentar(false); 1");
    await esperar(400);
    const v2 = await vista();
    ok(
      v2.w === v0.w && Math.abs(v2.s / v0.s - 1) < 1e-6 && Math.abs(v2.cx - v0.cx) < 1e-6,
      `al salir vuelve el mismo tamaño y el mismo zoom (${v0.s.toFixed(3)} → ${v2.s.toFixed(3)})`
    );
    await ev("plPanel.oculto = true; plPanel(); 1");
    await esperar(400);
    const v3 = await vista(),
      der = await J("$('edProp').clientWidth");
    ok(
      v3.w > v0.w && der > 100,
      `sin el panel izquierdo, el plano se agranda y las propiedades siguen a la derecha (${v3.w}, ${der})`
    );
    await ev("plPanel.oculto = false; plPanel(); 1");
    await clic('[data-ed="cancelar"]');
    await ev(
      "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
    );
  });

  prueba(
    "Editor de diseño: circuito desplegable, asignar circuito, tablero del circuito y conductores automáticos",
    async ok => {
      await ejemplo("uni");
      await abrirPlano();
      // Un tablero TD-1 (el proyecto solo tiene TG) con dos luminarias; la segunda tubería, con su circuito escrito a mano
      // (sin tablero), como pasaba al escribir «C-1» en Propiedades
      const ids = await J(`(() => {
    const D = dsD(), a = o => dsAgregar(o).id;
    const tb = a({ t: "sim", k: "tab", x: ${OX} + 3, y: ${OY} + 7.9, r: 180, capa: "E-TABLEROS", nom: "TD-1", nc: 3 }),
      l1 = a({ t: "sim", k: "luz", x: ${OX} + 3, y: ${OY} + 5, r: 0, capa: "E-ALUMBRADO", cir: "C-1", tab: tb }),
      l2 = a({ t: "sim", k: "luz", x: ${OX} + 3, y: ${OY} + 2, r: 0, capa: "E-ALUMBRADO", cir: "C-1" }),
      l3 = a({ t: "sim", k: "luz", x: ${OX} + 5, y: ${OY} + 2, r: 0, capa: "E-ALUMBRADO" });
    const t1 = a({ t: "tub", pts: [${OX} + 3, ${OY} + 7.6, ${OX} + 3, ${OY} + 5], c: false, modo: "techo", capa: "E-TUBERIAS-TECHO", c0: tb, c1: l1, cir: "C-1", tab: tb }),
      t2 = a({ t: "tub", pts: [${OX} + 3, ${OY} + 5, ${OX} + 3, ${OY} + 2], c: false, modo: "techo", capa: "E-TUBERIAS-TECHO", c0: l1, c1: l2, cir: "C-1" });
    edCambio();
    return { tb, l1, l2, l3, t1, t2 };
  })()`);
      const el = id => J(`dsD().els.find(e => e.id === "${id}")`);
      // El circuito escrito a mano toma el tablero de lo conectado: el cálculo ya encuentra su recorrido
      ok(
        (await el(ids.t2)).tab === ids.tb && (await el(ids.l2)).tab === ids.tb,
        "la tubería y la luminaria con el circuito escrito a mano toman el tablero de lo conectado"
      );
      // Conductores automáticos: monofásico 220 V, dos fases y tierra
      const c1 = (await el(ids.t1)).cond;
      ok(
        c1 && c1.f === 2 && !c1.n && c1.t && (await el(ids.t1)).condA,
        `conductores automáticos en 220 V: 2 fases y tierra (${JSON.stringify(c1)})`
      );
      // Con 380/220 V: fase y neutro
      const sist0 = await ev("PROY.sist");
      await ev(`PROY.sist = "tri380"; edCambio(); 1`);
      const c2 = (await el(ids.t1)).cond;
      ok(c2.f === 1 && c2.n === 1 && c2.t, `con 380/220 V: fase, neutro y tierra (${JSON.stringify(c2)})`);
      await ev(`PROY.sist = ${JSON.stringify(sist0)}; edCambio(); 1`);
      // Si el proyectista los cambia, se respetan
      await ev(`DS_SEL.clear(); DS_SEL.add("${ids.t1}"); edProps(); 1`);
      await poner('#edPropC [data-dsp="condF"]', 3);
      ok((await el(ids.t1)).cond.f === 3 && !(await el(ids.t1)).condA, "elegidos a mano: ya no cambian solos");
      ok(await ev(`!!$('edPropC').querySelector('[data-dsa="condauto"]')`), "botón para volver a los automáticos");
      await clic('#edPropC [data-dsa="condauto"]');
      ok((await el(ids.t1)).condA && (await el(ids.t1)).cond.f === 2, "«Conductores automáticos» los vuelve a marcar");
      // Circuito: desplegable con las salidas de cada tablero, agrupadas
      await ev(`DS_SEL.clear(); DS_SEL.add("${ids.l3}"); edProps(); 1`);
      const op = await J(
        `[...$('edPropC').querySelectorAll('select[data-dsp="cir"] option')].map(o => o.value + "/" + (o.parentElement.label || ""))`
      );
      ok(
        op.includes(`${ids.tb}|C-1/TD-1`) && op.includes(`${ids.tb}|C-3/TD-1`) && op[0] === "/",
        `desplegable de circuitos agrupado por tablero (${op.length} opciones)`
      );
      await poner('#edPropC select[data-dsp="cir"]', `${ids.tb}|C-2`);
      const l3 = await el(ids.l3);
      ok(l3.cir === "C-2" && l3.tab === ids.tb, "al elegir un circuito se guarda también su tablero");
      // Varias a la vez: clic derecho › Asignar circuito › C-3
      await ev(`DS_SEL.clear(); ["${ids.l2}", "${ids.l3}"].forEach(i => DS_SEL.add(i)); edProps(); 1`);
      ok(
        (await ev(`$('edPropC').querySelector('select[data-dsp="cir"]').value`)) === "~",
        "con circuitos distintos, el desplegable dice «(varios)»"
      );
      await ev(`edMenuAccion("asigcir"); 1`);
      ok(
        await ev(`!!$('edMenu').querySelector('[data-edm="asig:${ids.tb}|C-3"]')`),
        "menú «Asignar circuito» con las salidas del tablero"
      );
      await clic(`#edMenu [data-edm="asig:${ids.tb}|C-3"]`);
      ok(
        (await el(ids.l2)).cir === "C-3" && (await el(ids.l3)).cir === "C-3" && (await el(ids.l3)).tab === ids.tb,
        "las dos luminarias pasan a C-3 de una vez"
      );
      await ev(
        `["${ids.l2}"].forEach(i => { const e = dsD().els.find(x => x.id === i); e.cir = "C-1"; }); edCambio(); 1`
      );
      // TD-1 no está en el cálculo: aviso (no nota) con el botón «Renombrar a TG»
      await ev("revAbrir(); 1");
      const it = await J(`REV_L.findIndex(o => /TD-1 no está en el cálculo/.test(o.t))`);
      ok(
        it >= 0 &&
          (await J(`REV_L[${it}].nivel`)) === "aviso" &&
          (await ev(`!!document.querySelector('[data-revr="${it}"]')`)),
        "«TD-1 no está en el cálculo» como aviso, con botón «Renombrar a TG»"
      );
      await clic(`[data-revr="${it}"]`);
      ok((await el(ids.tb)).nom === "TG", "el botón renombra el tablero a TG");
      ok(!(await J(`REV_L.some(o => /no está en el cálculo/.test(o.t))`)), "y el aviso desaparece de la revisión");
      await ev("revCerrar(); 1");
      await clic('[data-ed="cancelar"]');
      await ev(
        "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
      );
    }
  );
};
