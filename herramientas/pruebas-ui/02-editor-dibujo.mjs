/* Pruebas de la interfaz · Editor de diseño: plano, selección, símbolos, tuberías, tableros, biblioteca, menús, vértices, artefactos y navegación.
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
  prueba("Editor de diseño: plano, capas, plantas, deshacer, autoguardado, descartar y guardado", async ok => {
    await ejemplo("uni");
    await abrirPlano();
    ok(await ev("!$('editor').hidden && document.body.classList.contains('ed-on')"), "el editor ocupa la pantalla");
    ok(await ev("EPL.f === 1 && EPL.de === 'cotas'"), "unidad: metros según las cotas (la cabecera dice mm)");
    // Autoguardado: el plano pasa solo al proyecto medio segundo después del último cambio
    await esperar(800);
    ok(
      await ev("!!PLANO && PLANO.nombre === 'plano-prueba.dxf' && /Guardado/.test($('edSucio').textContent)"),
      "el plano se guarda solo en el proyecto («✓ Guardado en el proyecto»)"
    );
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
    await esperar(800);
    ok(
      (await ev("HIST.length")) === hist0 && (await ev("!PLANO.ocultas.includes('EJES')")),
      "el deshacer del proyecto no se toca y el proyecto sigue al editor"
    );
    await clic('#editor [data-pl="planta"]');
    await clicPlano(OX - 0.5, OY - 0.5, 0);
    await clicPlano(OX + 10.5, OY + 8.5, 0);
    ok((await ev("$('plCmdV').value")) === "1er piso", "nombre propuesto para la planta");
    await clic("#plCmdOk");
    ok(await ev("EPL.plantas.length === 1 && EPL.plantas[0].n === '1er piso'"), "planta encuadrada");
    await esperar(800);
    ok(await ev("PLANO && PLANO.plantas.length === 1"), "la planta se guarda sola en el proyecto");
    // Volver al proyecto y abrir de nuevo: lo de esta sesión queda; un cambio y «Descartar cambios» lo deshace
    await clic('[data-ed="aceptar"]');
    await ev("edAbrir(false); 1");
    for (let i = 0; i < 40 && !(await ev("!!PL_MOD")); i++) await esperar(100);
    await clic('#editor [data-pl="capas"]');
    await clic('#caTabla tr[data-caa="EJES"] input[data-caf="vis"]');
    await clic('[data-ca="cerrar"]');
    await esperar(800);
    ok(await ev("PLANO.ocultas.includes('EJES')"), "el cambio llega solo al proyecto");
    await clic('[data-ed="cancelar"]');
    ok(await ev("!$('cfmDlg').hidden"), "Descartar cambios pide confirmación");
    await clic("#cfmSi");
    ok(
      await ev("$('editor').hidden && !PLANO.ocultas.includes('EJES') && PLANO.plantas.length === 1"),
      "descartar: el proyecto vuelve a como estaba al abrir el editor"
    );
    ok(
      /plano-prueba\.dxf/.test(await ev("$('plInfo').textContent")),
      "la pestaña Diseño muestra el plano del proyecto"
    );
    // El proyecto guardado vuelve a abrir el plano desde la base de datos del navegador
    await ev(
      "(() => { const o = JSON.parse(JSON.stringify(estado())); PL_MOD = null; PL_SHA = null; aplicar(o); edAbrir(false); })()"
    );
    for (let i = 0; i < 40 && !(await ev("!!PL_MOD")); i++) await esperar(100);
    ok(await ev("!!PL_MOD && EPL.plantas.length === 1"), "el plano se vuelve a leer del navegador con sus plantas");
    await clic('[data-ed="aceptar"]');
    ok(await ev("$('editor').hidden"), "«Volver al proyecto» cierra el editor");
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
    ok(
      (await ev("EPL.dis.els.length")) === 1 && (await ev("EPL.dis.els[0].k")) === "toma",
      "Supr borra lo seleccionado"
    );
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
    ok(
      l && Math.abs(l.pts[2] - l.pts[0] - 3) < 1e-9 && Math.abs(l.pts[3] - l.pts[1]) < 1e-9,
      "línea de 3.00 m exactos"
    );
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
      await ev(
        "PLANO.dis.els.find(e => e.k === 'tab').nc === 8 && PLANO.dis.els.find(e => e.t === 'tub').cir === 'C-3'"
      ),
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
      ok(
        await ev("$('bibDlg').hidden && PLH.h === 'col:toma'"),
        "Enter elige el primero: el tomacorriente queda listo"
      );
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
      await esperar(800);
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
    // Plano atenuado: la ventana de selección toma solo el diseño; un clic donde no hay diseño elige la arquitectura
    await teclaE("Escape", "Escape", 27);
    await clic("#plTenue");
    await ev(`plMarcoArq(${OX} - 1, ${OY} - 1, ${OX} + 11, ${OY} + 9, false, false); 1`);
    ok((await ev("PL_ASEL.size")) === 0, "con el plano atenuado, la ventana de selección no toma la arquitectura");
    await clicPlano(OX + 10, OY + 3, 0);
    ok((await ev("PL_ASEL.size")) === 1, "con el plano atenuado, un clic en el muro lo elige (para borrarlo)");
    await teclaE("Escape", "Escape", 27);
    await clic("#plTenue");
    await clicPlano(OX + 10, OY + 3, 0);
    ok((await ev("PL_ASEL.size")) === 1, "sin atenuar, también se elige");
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
      // Interruptor doble: una letra por tecla; la revisión cuenta cada una y su tubería lleva la fase y dos retornos
      const dob = await J(
        `(() => { const I = { t: 'sim', k: 'int' }, L = { t: 'sim', k: 'luz' };
      const r = { ab: dsEncLimpio('AB', I), sep: dsEncLimpio('a1, b', I), luz: dsEncLimpio('ab', L), txt: dsEncTxt({ enc: 'a,b' }) };
      const n0 = dsD().els.length, tb = dsD().els.find(e => e.k === 'tab');
      const la = dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 8, y: ${OY} + 2, r: 0, capa: 'E-ALUMBRADO', enc: 'x' });
      const sw = dsAgregar({ t: 'sim', k: 'int', x: ${OX} + 8, y: ${OY} + 3, r: 0, capa: 'E-ALUMBRADO', enc: 'x,y' });
      const lb = dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 9, y: ${OY} + 2, r: 0, capa: 'E-ALUMBRADO', enc: 'y' });
      // Recorrido: tablero → luminaria «x» → luminaria «y», y de la «x» al interruptor «x,y»
      const o = dsSalidasTab(tb)[0], d = { cir: o.n, tab: tb.id };
      [la, sw, lb].forEach(e => Object.assign(e, d));
      const tub = (p, c0, c1) => dsAgregar({ t: 'tub', pts: p, modo: 'techo', capa: 'E-TUBERIAS-TECHO', c0, c1, ...d });
      const t0 = tub([...o.p, ${OX} + 8, ${OY} + 2], tb.id, la.id),
        tu = tub([${OX} + 8, ${OY} + 2, ${OX} + 8, ${OY} + 3], la.id, sw.id),
        t2 = tub([${OX} + 8, ${OY} + 2, ${OX} + 9, ${OY} + 2], la.id, lb.id);
      dsIdxSucio(); dsCondAuto();
      const k = c => (c.f || 0) + dsNeutros(c);
      r.v = dsVerificar().map(o => o.t).filter(t => /«[xy]»/.test(t));
      r.int = dpCond(tu.cond); r.col = [dsTubInt(tu), dsTubInt(t0)].join();
      r.t0 = !t0.cond.r && k(t0.cond) === 2 && t0.cond.t; r.t2 = t2.cond.r === 1 && k(t2.cond) === 1 && t2.cond.t;
      dsD().els.splice(n0); dsIdxSucio(); return r; })()`
      );
      ok(
        dob.ab === "a,b" &&
          dob.sep === "a1,b" &&
          dob.luz === "ab" &&
          dob.txt === "ab" &&
          dob.int === "1F+2R" &&
          dob.t0 &&
          dob.t2 &&
          dob.col === "true,false" &&
          !dob.v.length,
        `interruptor doble «a,b»: fase al interruptor y un retorno por tecla hasta sus luminarias; su tubería en color (${JSON.stringify(dob)})`
      );
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
      ok(
        (await ev("PLH.h")) === null && Math.abs((await ev("PLV.cx")) - (OX + 2)) < 1e-6,
        "zoom ventana al rectángulo"
      );
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
      await ev(
        `dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 6, y: ${OY} + 5, r: 0, capa: 'E-ALUMBRADO' }); edCambio(); 1`
      );
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
};
