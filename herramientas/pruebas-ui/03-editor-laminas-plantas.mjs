/* Pruebas de la interfaz · Editor de diseño: láminas, cinta, plantas, montantes, bloques y cajas de paso.
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
    ok(
      await ev("!$('lamDlg').hidden && $('laZona').value === 'planta:0'"),
      "la lámina se abre con la planta encuadrada"
    );
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
    // Papel y escala automáticos: 1:50 en el papel más chico donde entra; rótulo con firma, especialidad y escala
    await poner("#laTam", "auto");
    await poner("#laEsc", "auto");
    const au = await J("(r => ({ tam: r.tam, esc: r.esc, svg: r.svg }))(laSvg())");
    ok(
      au.esc === 50 &&
        ["A3", "A2", "A1"].includes(au.tam) &&
        (await ev("$('laTam').selectedOptions[0].textContent")).includes(`Automático: ${au.tam}`) &&
        (await ev("$('laEsc').selectedOptions[0].textContent")).includes("1:50") &&
        (await ev("dsD().lams[0].tam === 'auto' && dsD().lams[0].esc === undefined")),
      `papel y escala automáticos (${au.tam} a 1:${au.esc})`
    );
    ok(
      /FIRMA Y SELLO/.test(au.svg) && /ESPECIALIDAD/.test(au.svg) && /PLANTA 1ER PISO/.test(au.svg),
      "rótulo con firma y sello, especialidad, y el nombre de la planta bajo el dibujo"
    );
    // Los símbolos miden lo mismo en el papel a otra escala (la leyenda también)
    const tx = await J(
      "(dsD().nsal = true, [50, 100].map(e => Math.max(0, ...[...new DOMParser().parseFromString(laSvg({ ...laOp(), esc: e }).svg, 'image/svg+xml').querySelectorAll('text')].filter(t => t.textContent === 'C-1').map(t => +t.getAttribute('font-size')))).concat(dsD().nsal = false).slice(0, 2))"
    );
    ok(
      tx[0] > 0 && Math.abs(tx[0] - tx[1]) < 0.05,
      `el rótulo del circuito mide lo mismo a 1:50 y a 1:100 (${tx.join(" y ")})`
    );
    // Una lámina por planta: la planta con diseño que ninguna muestra recibe la suya (IE-05, automática)
    const pp = await J(
      `(() => { EPL.plantas.push({ n: '2do piso', x0: ${OX} + 11.5, y0: ${OY} - 0.5, x1: ${OX} + 22.5, y1: ${OY} + 8.5 });
      const e = dsAgregar({ t: 'sim', k: 'luz', x: ${OX} + 15, y: ${OY} + 4, r: 0, capa: 'E-ALUMBRADO' });
      lamPorPlanta(); const r = dsD().lams.map(l => [l.num, l.zona, l.tam]); const n2 = (lamPorPlanta(), dsD().lams.length);
      dsD().lams.pop(); dsD().els = dsD().els.filter(x => x !== e); EPL.plantas.pop(); dsD().lamI = 0; edCambio(); lamCargar(); return { r, n2 }; })()`
    );
    ok(
      JSON.stringify(pp.r[1]) === JSON.stringify(["IE-05", "planta:1", "auto"]) && pp.r.length === 2 && pp.n2 === 2,
      `una lámina por planta (${JSON.stringify(pp.r)}), sin repetirla la segunda vez`
    );
    // Papel fijo que obliga a una escala menor que 1:75 (láminas de versiones anteriores): va en el papel automático
    const pf = await J(
      "(r => ({ tam: r.tam, esc: r.esc, aviso: r.aviso, auto: LA_ESC_AUTO.join() }))(laSvg({ ...laOp(0), tam: 'A4', esc: undefined }))"
    );
    ok(
      pf.tam !== "A4" && pf.esc === 50 && /elija también la escala/.test(pf.aviso) && /^50,75,100/.test(pf.auto),
      `papel fijo que obliga a una escala chica: va en el automático (${pf.tam} 1:${pf.esc})`
    );
    // Una zona que no entra en A1 a 1:75 sigue completa (a la escala que entra) y se puede dividir en láminas iguales (IE-01, IE-01A…), en A1 a 1:75, con su
    // línea de corte y el número de la que sigue; a 1:100 elegida a mano, el aviso de la EM.010
    const pt = await J(
      `(() => { const op = { ...laOp(0), zona: 'rect', rect: [${OX}, ${OY}, ${OX} + 120 / EPL.f, ${OY} + 12 / EPL.f], num: 'IE-01' },
      ps = laPartes(op), r0 = laSvg(op), a = r0.aviso, entero = r0.esc > 75 && !/no entra/.test(a), s0 = laSvg({ ...ps[0], _i: 0, _n: ps.length }, ps),
      a100 = laSvg({ ...laOp(0), esc: 100 }).aviso;
      return { entero, n: ps.length, nums: ps.map(p => p.num), esc: [...new Set(ps.map(p => laSvg(p, ps).esc))], tam: [...new Set(ps.map(p => laSvg(p, ps).tam))],
        corte: s0.svg.includes('CONTINÚA EN LA LÁMINA IE-01A'), parte: laVistaTit(ps[1]), aviso: /divídala en [0-9]+ láminas/.test(a), a100: /EM[.]010/.test(a100) }; })()`
    );
    ok(
      pt.entero &&
        pt.n >= 2 &&
        pt.nums[0] === "IE-01" &&
        pt.nums[1] === "IE-01A" &&
        pt.esc.join() === "75" &&
        pt.tam.join() === "A1" &&
        pt.corte &&
        / · PARTE 2 DE /.test(pt.parte) &&
        pt.aviso &&
        pt.a100,
      `planta que no entra en A1 a 1:75: ${pt.n} láminas (${pt.nums.join(", ")}), línea de corte y aviso EM.010 (${JSON.stringify(pt)})`
    );
    // El recorte es la planta, no toda el área de dibujo (a escala chica no se ve lo de al lado)
    const rc = await J(
      `(() => { const op = { ...laOp(0), esc: 100 }, r = laSvg(op), m = /<clipPath[^>]*><rect x="[^"]*" y="[^"]*" width="([^"]*)"/.exec(r.svg), z = laZona(op); return [m[1] / LA_PX, (z[2] - z[0]) * EPL.f * 10]; })()`
    );
    ok(
      Math.abs(rc[0] - rc[1]) < 0.5,
      `el recorte de la lámina es la planta (${rc.map(v => v.toFixed(1)).join(" y ")} mm)`
    );
    // Impresión: la hoja cabe en su papel (medio milímetro menos), así no sale una página en blanco
    ok(
      await ev(
        "(() => { const p = window.print; window.print = () => {}; laImprimirYa(false); const h = $('printArea').innerHTML; setTimeout(() => { window.print = p; $('printArea').innerHTML = ''; document.body.classList.remove('printing'); if (typeof printTitulo === 'string' && printTitulo) document.title = printTitulo; }, 400); return /width:\\d+(\\.5)?mm;height:\\d+\\.5mm/.test(h); })()"
      ),
      "la lámina impresa cabe en una página"
    );
    await esperar(500);
    // Antes de imprimir, la guía «Guardar como PDF»; con «No volver a mostrar» y Continuar, imprime y no vuelve
    const gp =
      await J(`(() => { try { localStorage.removeItem("jmg-electric-guia-pdf"); } catch (e) {} let n = 0; const f = () => n++;
      guiaPdf(f); const vis = !$("cfmDlg").hidden; $("guiaPdfNo").checked = true; $("cfmDlg").querySelector('[data-cf="si"]').click();
      guiaPdf(f); const r = { vis, n, cerrado: $("cfmDlg").hidden, guardado: localStorage.getItem("jmg-electric-guia-pdf") };
      localStorage.removeItem("jmg-electric-guia-pdf"); return r; })()`);
    ok(
      gp.vis && gp.n === 2 && gp.cerrado && gp.guardado === "1",
      `guía «Guardar como PDF» antes de imprimir, con «No volver a mostrar» (${JSON.stringify(gp)})`
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
    // Reglas de R12 que exige AutoCAD, también con una capa de nombre largo, con espacios y tildes, y un texto con salto
    const dx = await ev(
      `(() => { const D = dsD(); D.capas.push({ n: 'Capa del arquitecto ñandú con espacios y más de 31', col: '#336699', lt: 'cont', vis: true, bloq: false });
      const e = dsAgregar({ t: 'txt', x: ${OX} + 2, y: ${OY} + 2, ht: 0.2, s: 'Línea 1\\nLínea 2', capa: 'Capa del arquitecto ñandú con espacios y más de 31' });
      const t = laDxf(true); D.els = D.els.filter(x => x !== e); D.capas.pop(); dsIdxSucio(); return t; })()`
    );
    const pr = dxfR12Problemas(dx);
    ok(
      !pr.length && /\nCAPA_DEL_ARQUITECTO_NANDU_CON_E\r?\n/.test(dx) && /\$EXTMIN/.test(dx),
      `DXF del diseño con arquitectura válido para AutoCAD (R12) ${pr.join("; ")}`
    );
    // Con la arquitectura original: el archivo del arquitecto tal cual, con el diseño agregado en sus capas
    const og = JSON.parse(
      await ev(
        `plLeerArchivo(EPL.sha).then(a => { const o = laDxfOriginal(a.buf), d = b => Array.from(b, c => String.fromCharCode(c)).join(''), t0 = d(new Uint8Array(a.buf)), t1 = d(o), m0 = modeloDxf(a.buf), m1 = modeloDxf(o.buffer);
      const L0 = t0.split(/\\r?\\n/), L1 = t1.split(/\\r?\\n/); let j = 0; L1.forEach(l => { if (l === L0[j]) j++; });
      return JSON.stringify({ todo: j === L0.length, mas: m1.trazos.length > m0.trazos.length, capas: Object.keys(m1.capas).filter(c => c.startsWith('E-')).length, mismas: Object.keys(m0.capas).every(c => c in m1.capas) }); })`
      )
    );
    ok(
      og.todo && og.mas && og.capas >= 2 && og.mismas,
      `DXF con la arquitectura original: el archivo del arquitecto completo y en orden, más el diseño en sus capas (${JSON.stringify(og)})`
    );
    // Planos para AutoCAD con el plano: un DXF de AutoCAD 2013 «del arquitecto» (hecho con la base) con el diseño y un
    // unifilar al costado, a 1:50; con identificadores, la capa del arquitecto intacta y las letras en UTF-8
    const cpl = await ev(
      `(() => { const arq = dxfEnBase([["LINE", 8, "Muros 1er piso", 100, "AcDbLine", 10, "${OX}", 20, "${OY}", 30, "0.0", 11, "${OX + 10}", 21, "${OY}", 31, "0.0"]], { capas: [["Muros 1er piso", 7]], tipos: [], estilos: [], ext: [${OX}, ${OY}, ${OX + 10}, ${OY + 8}] });
      const o = laDxfCompleto(Array.from(new TextEncoder().encode(arq), b => String.fromCharCode(b)).join(""), { esc: 50, hojas: [{ svg: unifilar(LAST).svg, tit: "IE-02 · Diagrama unifilar · Señal", grupo: "planos" }], op: { colores: "jmg", lamina: "A3" } });
      return o ? laTextoDe(o.buffer) : ""; })()`
    );
    const cpr = dxf2013Problemas(cpl);
    ok(
      cpl &&
        !cpr.length &&
        /\nMuros 1er piso\r?\n/.test(cpl) &&
        /\nE-ALUMBRADO\r?\n/.test(cpl) &&
        /\nE-INDICE\r?\n/.test(cpl) &&
        /SeÃ±al/.test(cpl),
      `plano del arquitecto con el diseño y los diagramas a 1:50 en un solo DXF ${cpr.join("; ")}`
    );
    // Lo borrado de la arquitectura en la plataforma va a la capa JMG-ARQ-BORRADO (apagada y congelada), por su handle
    const ocu = await ev(
      `(() => { const arq = dxfEnBase([["LINE", 8, "Muros", 100, "AcDbLine", 10, "${OX}", 20, "${OY}", 30, "0.0", 11, "${OX + 10}", 21, "${OY}", 31, "0.0"]], { capas: [["Muros", 7]], tipos: [], estilos: [], ext: [${OX}, ${OY}, ${OX + 10}, ${OY + 8}] }),
        h = /ENTITIES[\\s\\S]*?\\n0\\r?\\nLINE\\r?\\n5\\r?\\n([0-9A-F]+)/.exec(arq)[1], b0 = EPL.borr, h0 = PL_MOD.hnd;
      EPL.borr = [999999]; PL_MOD.hnd = { 999999: h };
      const o = laDxfCompleto(arq, { esc: 50 }); EPL.borr = b0; PL_MOD.hnd = h0;
      return o ? laTextoDe(o.buffer) : ""; })()`
    );
    ok(
      !dxf2013Problemas(ocu).length &&
        /\n0\r?\nLINE\r?\n5\r?\n[0-9A-F]+\r?\n330\r?\n[0-9A-F]+\r?\n100\r?\nAcDbEntity\r?\n8\r?\nJMG-ARQ-BORRADO\r?\n/.test(
          ocu
        ) &&
        /\n2\r?\nJMG-ARQ-BORRADO\r?\n70\r?\n1\r?\n62\r?\n-8\r?\n/.test(ocu),
      "lo borrado de la arquitectura queda en la capa JMG-ARQ-BORRADO, apagada y congelada"
    );
    // Textos de la arquitectura: un clic en sus letras los elige (también con el plano atenuado) y se borran
    const btx = await J(
      `(() => { const t = PL_TX.find(x => x.s && x.h * PLV.s > 2); if (!t) return null; const ten = EPL.tenue, b0 = (EPL.borr || []).slice();
      EPL.tenue = true; const c = plCajaTexto(t); plSeleccionar([(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2], false);
      const elegido = PL_ASEL.has(t.e); edBorrar(false); const fuera = !PL_TX.some(x => x.e === t.e);
      EPL.borr = b0; EPL.tenue = ten; plPreparar(); edCambio(); return { s: t.s, elegido, fuera, vuelve: PL_TX.some(x => x.e === t.e) }; })()`
    );
    ok(
      btx && btx.elegido && btx.fuera && btx.vuelve,
      `un clic en un texto de la arquitectura lo elige y se borra (${JSON.stringify(btx)})`
    );
    // Circuito en las salidas
    await ev("(c => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })($('dsNSal'))");
    ok((await ev("dsD().nsal")) === true, "circuito en las salidas");
    await clic('[data-ed="aceptar"]');
    await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
    ok(
      await ev("PLANO.dis.lams[0].num === 'IE-04' && PLANO.dis.nsal === true"),
      "la lámina y la opción se guardan con el proyecto"
    );
    // Expediente: la lámina de planta va primero y las de la plataforma se numeran después de ella
    const ex = JSON.parse(
      await ev(
        "laminasExpediente().then(L => JSON.stringify({ n: L.length, h: L.map(x => x.hoja), ex: expediente(LAST, 'formal', L), d: ROT_DESP, e: EPL }))"
      )
    );
    ok(
      ex.n === 1 &&
        ex.h[0] === "IE-04" &&
        /Lámina IE-04 · Escala 1:\d+ en A\d/.test(ex.ex) &&
        /Lámina IE-05 · Escala S\/E/.test(ex.ex) &&
        !/Los adjunta el proyectista/.test(ex.ex) &&
        ex.d === 0,
      "el expediente lleva la lámina de planta (IE-04) y el unifilar pasa a IE-05"
    );
    ok(
      /Metrado y presupuesto/.test(ex.ex) &&
        /Presupuesto referencial/.test(ex.ex) &&
        /Anexo A · Desarrollo del cálculo de cada circuito/.test(ex.ex) &&
        /Factores de corrección/.test(ex.ex) &&
        /Anexo C · Protocolo de pruebas/.test(ex.ex) &&
        /Anexo D · Documentos complementarios/.test(ex.ex),
      "el expediente lleva metrado y presupuesto, y los anexos (cálculo de cada circuito, protocolo y documentos)"
    );
    // Una planta con diseño que ninguna lámina muestra: el expediente le pone su lámina (IE-05) y el unifilar pasa a IE-06
    const ex2 = JSON.parse(
      await ev(
        `(() => { PLANO.plantas.push({ n: '2do piso', x0: ${OX} + 11.5, y0: ${OY} - 0.5, x1: ${OX} + 22.5, y1: ${OY} + 8.5 }); PLANO.dis.els.push({ id: 'dzz', t: 'sim', k: 'luz', x: ${OX} + 15, y: ${OY} + 4, r: 0, capa: 'E-ALUMBRADO' });
        return laminasExpediente().then(L => { const ex = expediente(LAST, 'formal', L); PLANO.plantas.pop(); PLANO.dis.els.pop(); return JSON.stringify({ h: L.map(x => x.hoja + ' ' + x.vista), ex }); }); })()`
      )
    );
    ok(
      JSON.stringify(ex2.h) === JSON.stringify(["IE-04 PLANTA 1ER PISO", "IE-05 PLANTA 2DO PISO"]) &&
        /Lámina IE-06 · Escala S\/E/.test(ex2.ex),
      `todas las plantas en el expediente: ${ex2.h.join(", ")}`
    );
    // Planos › AutoCAD: la lámina de planta en DXF de AutoCAD 2013, a su papel, con su rótulo, colores y letra Arial
    const pd = await ev("laminasExpediente().then(L => svgDxf(L[0].svg, { colores: 'jmg' }))"),
      ppr = dxf2013Problemas(pd);
    ok(
      !ppr.length && /\nAC1027\r?\n/.test(pd) && /\narial\.ttf\r?\n/.test(pd) && /\nE-ROTULO\r?\n/.test(pd),
      `lámina de planta en DXF de AutoCAD 2013 con letra Arial y rótulo ${ppr.join("; ")}`
    );
    ok(
      await ev(
        "dxfDialogo(true), (r => (dxfDialogo(false), r))(!!$('dxLista').querySelector('[data-dxk=\"plantas\"]'))"
      ),
      "Planos › AutoCAD ofrece las láminas de planta del diseño"
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

  prueba("Editor de diseño: montante a varios pisos, prolongarlo y caja de paso cuadrada", async ok => {
    await ejemplo("uni");
    await abrirPlano();
    await ev(
      `(() => { EPL.plantas = [1, 2, 3].map(n => ({ n: n + (n === 2 ? 'do' : n === 1 ? 'er' : 'er') + ' piso', x0: ${OX} + 20 * (n - 1), y0: ${OY}, x1: ${OX} + 20 * (n - 1) + 10, y1: ${OY} + 8 }));
      dsAgregar({ t: 'sim', k: 'cajaCuad', x: ${OX} + 8, y: ${OY} + 1, r: 0, capa: 'E-CANALIZACION' });
      dsAgregar({ t: 'sim', k: 'subida', x: ${OX} + 9, y: ${OY} + 1, r: 0, capa: 'E-CANALIZACION' });
      dsAgregar({ t: 'sim', k: 'subida', x: ${OX} + 9, y: ${OY} + 3, r: 0, capa: 'E-CANALIZACION' }); edCambio(); return 1; })()`
    );
    ok(
      await ev("DS_CAT.cajaCuad && DS_CAT.cajaCuad.c === 'criterio' && plArt('cajaCuad')[1] === 'T'"),
      "caja de paso cuadrada en la biblioteca, como criterio del proyectista"
    );
    // Del 1er al 3er piso de una vez: atraviesa el 2do y baja en el 3ro
    await ev("DS_SEL.clear(); DS_SEL.add(dsD().els.filter(e => e.k === 'subida')[0].id); dpMontante(); 1");
    await clic('#edMenu [data-edm="sal:2"]');
    const m = await J(
      `(() => { const D = dsD().els, s = D.filter(e => e.k === 'subida')[0], a = D.find(e => e.id === s.mon), b = a && D.find(e => e.id === a.mon2); return { a: a && [a.k, dpPlantaEl(a), a.mon === s.id], b: b && [b.k, dpPlantaEl(b), b.mon === a.id] }; })()`
    );
    ok(
      JSON.stringify(m) === JSON.stringify({ a: ["atrav", 1, true], b: ["bajada", 2, true] }),
      `montante del 1er al 3er piso: atraviesa el 2do y baja en el 3ro (${JSON.stringify(m)})`
    );
    // Prolongar: un montante al 2do piso que después sigue al 3ro
    await ev("DS_SEL.clear(); DS_SEL.add(dsD().els.filter(e => e.k === 'subida')[1].id); dpMontante(); 1");
    await clic('#edMenu [data-edm="sal:1"]');
    const b2 = await ev("(() => { const s = dsD().els.filter(e => e.k === 'subida')[1]; return s.mon; })()");
    await ev(`DS_SEL.clear(); DS_SEL.add(${JSON.stringify(b2)}); 1`);
    await ev("dpMontante(); 1");
    await clic('#edMenu [data-edm="sal:2"]');
    const p = await J(
      `(() => { const D = dsD().els, a = D.find(e => e.id === ${JSON.stringify(b2)}), c = D.find(e => e.id === a.mon2); return { a: a.k, c: c && [c.k, dpPlantaEl(c), c.mon === a.id] }; })()`
    );
    ok(
      JSON.stringify(p) === JSON.stringify({ a: "atrav", c: ["bajada", 2, true] }),
      `prolongado: la bajada del 2do pasa a atravesar y baja en el 3ro (${JSON.stringify(p)})`
    );
    await clic('[data-ed="aceptar"]');
    await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
    ok(
      await ev("PLANO.dis.els.filter(e => e.mon2).length === 2"),
      "los enlaces del montante se guardan con el proyecto"
    );
  });

  prueba(
    "Editor de diseño: cajas de paso numeradas, montante desde la caja, alimentadores que pasan y rótulo",
    async ok => {
      await ejemplo("uni");
      await abrirPlano();
      // Banco con el medidor M-1 del TD-2; caja en el 1er piso; TD-2 en el 2do
      await ev(
        `(() => { EPL.plantas = [1, 2].map(n => ({ n: n + (n === 2 ? 'do' : 'er') + ' piso', x0: ${OX} + 20 * (n - 1), y0: ${OY}, x1: ${OX} + 20 * (n - 1) + 10, y1: ${OY} + 8 }));
      const C = 'E-CANALIZACION';
      window._b = dsAgregar({ t: 'sim', k: 'bmed', x: ${OX} + 2, y: ${OY} + 2, r: 0, capa: C, meds: [{ d: 'TD-2', f: 1 }] });
      window._c = dsAgregar({ t: 'sim', k: 'cajaCuad', x: ${OX} + 6, y: ${OY} + 2, r: 0, capa: C });
      window._c2 = dsAgregar({ t: 'sim', k: 'caja', x: ${OX} + 6, y: ${OY} + 6, r: 0, capa: C });
      edCambio(); return 1; })()`
      );
      ok(
        JSON.stringify(await J("[_c.nom, _c2.nom]")) === JSON.stringify(["CP-1", "CP-2"]),
        "las cajas de paso se numeran solas: CP-1, CP-2"
      );
      await ev(
        "(() => { const o = JSON.parse(JSON.stringify(_c2)); dsAgregar(o); edCambio(); window._c3 = o; return 1; })()"
      );
      ok((await ev("_c3.nom")) === "CP-3", "la caja copiada toma el número siguiente");
      // Por el menú del clic derecho: la lista de plantas sale donde estaba el menú (no lejos, junto a la caja)
      const pos = await J(
        "(() => { DS_SEL.clear(); DS_SEL.add(_c.id); edMenuLista([_c.x, _c.y], '<button type=\"button\" data-edm=\"montante\">m</button>', null); edMenuPos(300, 200); const a = ED_MENU.getBoundingClientRect(); edMenuAccion('montante'); const b = ED_MENU.getBoundingClientRect(); return [ED_MENU.hidden, Math.round(a.left - b.left), Math.round(a.top - b.top), ED_MENU.textContent]; })()"
      );
      ok(
        JSON.stringify(pos) === JSON.stringify([false, 0, 0, "Montante hasta la planta2do piso"]),
        `la lista de plantas sale donde estaba el menú (${JSON.stringify(pos)})`
      );
      // Montante desde la caja: en el 2do piso va otra caja igual
      await clic('#edMenu [data-edm="sal:1"]');
      const par = await J(
        "(() => { const o = dsD().els.find(e => e.id === _c.mon); window._p = o; return o && [o.k, dpPlantaEl(o), o.mon === _c.id, o.nom]; })()"
      );
      ok(
        JSON.stringify(par) === JSON.stringify(["cajaCuad", 1, true, "CP-4"]),
        `montante desde la caja: otra caja cuadrada en el 2do piso (${JSON.stringify(par)})`
      );
      // Sin alimentador que pase todavía: la caja dice qué tiene y qué le falta
      const pasos = await ev(
        "(() => { DS_SEL.clear(); DS_SEL.add(_c.id); edProps(); const u = document.querySelector('.ds-pasos'); return u ? u.textContent : ''; })()"
      );
      ok(
        /No llega ninguna tubería/.test(pasos) &&
          /Montante: CP-1 \(1er piso\) → CP-4 \(2do piso\)/.test(pasos) &&
          /Falta la tubería de CP-4/.test(pasos),
        `la caja sin alimentador dice qué le falta (${pasos})`
      );
      await ev(
        `(() => { const C = 'E-TUB-TECHO';
      window._t = dsAgregar({ t: 'sim', k: 'tab', x: _p.x + 3, y: _p.y, r: 0, capa: 'E-TABLEROS', nom: 'TD-2', nc: 1, ct: ['al'] });
      window._u1 = dsAgregar({ t: 'tub', pts: [_b.x, _b.y, _c.x, _c.y], modo: 'techo', capa: C, c0: _b.id, c1: _c.id });
      window._u2 = dsAgregar({ t: 'tub', pts: [_p.x, _p.y, ...dsBorde(_t, _p.x, _p.y)], modo: 'techo', capa: C, c0: _p.id, c1: _t.id, ali: true });
      edCambio(); return 1; })()`
      );
      const al = await J(
        "(() => { const A = dcAlimentadores().find(x => x.nom === 'TD-2'); if (!A) { const R = dcDatos().R; return { noms: dcAlimentadores().map(x => x.nom), dm: Object.keys(R.desdeMed), ru: Object.keys(R.rutas), u1: [_u1.c0, _u1.c1, _u1.cir], u2: [_u2.c0, _u2.c1, _u2.cir], t: _t.id }; } return [A.med, A.ids.has(_c.id), A.ids.has(_p.id), A.ids.has(_u2.id)]; })()"
      );
      ok(
        JSON.stringify(al) === JSON.stringify(["M-1", true, true, true]),
        `el alimentador M-1 → TD-2 pasa por la caja, el montante y su tubería (${JSON.stringify(al)})`
      );
      ok(
        (await ev("dcRotuloTexto(_c, dcAlimentadores())")) === "Sube por muro para TD-2",
        "rótulo de la caja del 1er piso: «Sube por muro para TD-2»"
      );
      ok((await ev("dcRotuloTexto(_p, dcAlimentadores())")) === "Llega para TD-2", "en la caja del 2do piso: llega");
      // Propiedades de la caja: su número y el alimentador que pasa
      await ev("DS_SEL.clear(); DS_SEL.add(_c.id); edProps(); 1");
      ok(
        await ev(
          "(() => { const t = document.querySelector('.ds-ali'); return !!t && /M-1 → TD-2/.test(t.textContent) && !!document.querySelector('[data-dsp=\"nom\"]'); })()"
        ),
        "propiedades de la caja: su número y «M-1 → TD-2»"
      );
      // Rótulo automático: sigue al nombre del tablero; escrito a mano, deja de seguirlo
      await ev("dcPonerRotulo(); 1");
      ok(
        await ev(
          "(() => { const r = dsD().els.find(e => e.aut === _c.id); window._r = r; return !!r && r.t === 'dir'; })()"
        ),
        "rótulo puesto como directriz desde la caja"
      );
      await ev("_t.nom = 'TD-02'; _b.meds[0].d = 'TD-02'; edCambio(); 1");
      ok((await ev("_r.s")) === "Sube por muro para TD-02", "el rótulo se actualiza al cambiar el nombre del tablero");
      await ev("DS_SEL.clear(); DS_SEL.add(_r.id); edProps(); 1");
      await ev(
        "(() => { const i = document.querySelector('[data-dsp=\"s\"]'); i.value = 'Sube por ducto'; i.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()"
      );
      ok(
        (await ev("_r.s + '|' + (_r.aut || '')")) === "Sube por ducto|",
        "escrito a mano: queda como lo escribió el proyectista"
      );
      // Circuito de una salida del 2do piso: solo los tableros de su piso
      const grupos = await J(
        "(() => { const tb1 = dsAgregar({ t: 'sim', k: 'tab', x: _c.x - 2, y: _c.y, r: 0, capa: 'E-TABLEROS', nom: 'TD-01', nc: 2, ct: ['al', 'tg'] }); _t.nc = 2; const lz = dsAgregar({ t: 'sim', k: 'luz', x: _t.x + 1, y: _t.y + 2, r: 0, capa: DS_SIS[DS_CAT.luz.s].capa }); edCambio(); DS_SEL.clear(); DS_SEL.add(lz.id); edProps(); const g = [...document.querySelectorAll('.ds-cir optgroup')].map(o => o.label); edMenuCircuitos(null); g.push(ED_MENU.querySelector('.ed-mt').textContent); ED_MENU.hidden = true; DS_SEL.clear(); dsD().els.splice(dsD().els.indexOf(tb1), 1); dsD().els.splice(dsD().els.indexOf(lz), 1); edCambio(); return g; })()"
      );
      ok(
        JSON.stringify(grupos) === JSON.stringify(["TD-02", "Circuitos de TD-02"]),
        `circuitos de una salida del 2do piso: solo su tablero (${JSON.stringify(grupos)})`
      );
      // Revisión: una tubería juntada (C-1 con C-2 en «Lleva también») cuenta para las dos salidas del tablero,
      // también si llega al tablero por su otra punta
      const juntas = await J(
        "(() => { const lz = dsAgregar({ t: 'sim', k: 'luz', x: _t.x + 1, y: _t.y + 3, r: 0, capa: DS_SIS[DS_CAT.luz.s].capa }), o = dsSalidasTab(_t)[0].p, u = dsAgregar({ t: 'tub', pts: [lz.x, lz.y, o[0], o[1]], modo: 'techo', capa: 'E-TUB-TECHO', c0: lz.id, c1: _t.id, cir: 'C-1', tab: _t.id, cx: ['C-2'] }); edCambio(); const de = () => dsVerificar().filter(x => /^TD-02:/.test(x.t)).map(x => x.t), a = de(); delete u.cx; edCambio(); const b = de(); [u, lz].forEach(e => dsD().els.splice(dsD().els.indexOf(e), 1)); edCambio(); return [a, b]; })()"
      );
      ok(
        JSON.stringify(juntas) === JSON.stringify([[], ["TD-02: C-2 sin tubería"]]),
        `revisión: la tubería juntada cuenta para C-1 y C-2 (${JSON.stringify(juntas)})`
      );
      // Montante que pasa por un piso: sin marca de «sin conectar» ahí; su símbolo se elige (canalización o caja)
      const pasa = await J(
        `(() => { EPL.plantas.push({ n: '3er piso', x0: ${OX} + 40, y0: ${OY}, x1: ${OX} + 50, y1: ${OY} + 8 }); const C = 'E-CANALIZACION', a = dsAgregar({ t: 'sim', k: 'subida', x: ${OX} + 3, y: ${OY} + 5, r: 0, capa: C }), b = dsAgregar({ t: 'sim', k: 'atrav', x: ${OX} + 23, y: ${OY} + 5, r: 0, capa: C }), c = dsAgregar({ t: 'sim', k: 'bajada', x: ${OX} + 43, y: ${OY} + 5, r: 0, capa: C });
      a.mon = b.id; b.mon = a.id; b.mon2 = c.id; c.mon = b.id; edCambio();
      const sl = dsSueltos().sims.map(e => e.id), out = [sl.includes(a.id), sl.includes(b.id), dpSimbolosMon(a), dpSimbolosMon(b), dpSimbolosMon(c)];
      DS_SEL.clear(); DS_SEL.add(b.id); edProps();
      const cambia = v => { const s = document.querySelector('[data-dsp="kmon"]'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); };
      cambia('cajaCuad'); out.push(b.k, /^CP-\\d+$/.test(b.nom || ''), b.mon === a.id && b.mon2 === c.id, !!document.querySelector('[data-dsp="kmon"]'));
      cambia('atrav'); out.push(b.k, b.nom === undefined);
      const uso = v => { const s = document.querySelector('[data-dsp="uso"]'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); };
      const u0 = document.querySelector('[data-dsp="uso"]').value; uso('cir'); out.push(u0, b.ali, document.querySelector('[data-dsp="uso"]').value, !!document.querySelector('.ds-cir, [data-dsp="cir"]'), [...document.querySelectorAll('.ed-ps')].some(x => /Alimentadores que pasan/.test(x.textContent))); uso('ali'); out.push(b.ali, document.querySelector('[data-dsp="uso"]').value);
      PLH.pts = []; dsPuntoTub([c.x, c.y], [c.x, c.y, 9, { con: c.id }]); out.push(PLH.ali); PLH.pts = []; PLH.ali = false; PLH.conIni = null;
      DS_SEL.clear(); [a, b, c].forEach(e => dsD().els.splice(dsD().els.indexOf(e), 1)); EPL.plantas.pop(); edCambio(); return out; })()`
      );
      ok(
        JSON.stringify(pasa) ===
          JSON.stringify([
            true,
            false,
            ["subida", "cajaCuad", "caja"],
            ["atrav", "cajaCuad", "caja"],
            ["bajada", "cajaCuad", "caja"],
            "cajaCuad",
            true,
            true,
            true,
            "atrav",
            true,
            "ali",
            false,
            "cir",
            true,
            false,
            true,
            "ali",
            true
          ]),
        `montante que pasa por un piso: sin marca, símbolo elegible y alimentador desde su extremo (${JSON.stringify(pasa)})`
      );
      // Punto base: el montante cae en el mismo lugar del edificio aunque las plantas se encuadren distinto
      const pb = await J(
        `(() => { const [a, b] = EPL.plantas; a.x0 -= 3; dpPuntoBase([${OX} + 1, ${OY} + 1]); dpPuntoBase([${OX} + 21, ${OY} + 1]); const d = dpDesp(0, 1); a.x0 += 3; return [d, !!edMenuAccion]; })()`
      );
      ok(
        JSON.stringify(pb[0]) === JSON.stringify([20, 0]),
        `con punto base: desplazamiento entre los puntos base (${JSON.stringify(pb[0])})`
      );
      // Arquitectura nueva desplazada: el punto base se mueve con su planta (y el desplazamiento entre plantas no cambia)
      const pbArq = await J(
        `(() => { const s = JSON.stringify(EPL), p = EPL.plantas[0], b0 = [p.bx, p.by, p.x0], d0 = dpDesp(0, 1); const mu = dx => [[0, 0, 10, 0], [10, 0, 10, 8], [10, 8, 0, 8], [0, 8, 0, 0], [3, 0, 3, 8]].map(q => ({ capa: 'MUROS', k: 'L', p: q.map((v, i) => v + (i % 2 ? ${OY} : ${OX} + dx)) })); try { dpCompararArq({ trazos: mu(0) }, { trazos: mu(2) }, []); } catch (e) { return String(e); } const r = [p.bx - b0[0], p.by - b0[1], p.x0 - b0[2], JSON.stringify(dpDesp(0, 1)) === JSON.stringify(d0)]; EPL = JSON.parse(s); PL_CMP = null; edCambio(); return r; })()`
      );
      ok(
        JSON.stringify(pbArq) === JSON.stringify([2, 0, 2, true]),
        `arquitectura desplazada: el punto base va con su planta (${JSON.stringify(pbArq)})`
      );
      // Tramo compartido: los conductores de los tres alimentadores, cada uno con su tierra, y la tubería que los contiene
      const tc = await J(
        "(() => { const a = { s: { n: 2, tri: false }, S: 10, St: 10 }, b = { s: { n: 2, tri: false }, S: 6, St: 6 }, t = {}; dcEscribirAli(t, [a, a, b], ['TD-02', 'TD-03', 'TD-04']); return [t.cond, t.sec, t.dia]; })()"
      );
      ok(
        JSON.stringify(tc) ===
          JSON.stringify([
            { f: 6, n: 0, t: true },
            "2×(2-1×10 + 1×10 T) + 2-1×6 + 1×6 T mm² (alimentadores TD-02, TD-03, TD-04)",
            35
          ]),
        `tramo con tres alimentadores juntos (${JSON.stringify(tc)})`
      );
      await clic('[data-ed="aceptar"]');
      await ev("(() => { const o = JSON.parse(JSON.stringify(estado())); aplicar(o); })()");
      ok(
        await ev("PLANO.dis.els.some(e => e.k === 'cajaCuad' && e.nom === 'CP-1')"),
        "el número de la caja se guarda con el proyecto"
      );
    }
  );
};
