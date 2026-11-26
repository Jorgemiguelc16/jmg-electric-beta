/* Pruebas de la interfaz · Etiquetas, presupuesto, normas (tipo de cable, varilla), tema gris, Guardar y protección del trabajo.
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
  prueba("Editor de diseño: etiquetas de cada tubería y salida (propiedades y clic derecho)", async ok => {
    await ejemplo("uni");
    await abrirPlano();
    const ids = await J(`(() => {
    const D = dsD();
    D.etq = "total";
    delete D.cirt;
    delete D.nsal;
    const s = dsAgregar({ t: "sim", k: "toma", x: ${OX} + 2, y: ${OY} + 4, r: 0, capa: "E-TOMACORRIENTES", cir: "C-2" }),
      t = dsAgregar({ t: "tub", pts: [${OX} + 1, ${OY} + 1, ${OX} + 5, ${OY} + 1], modo: "techo", capa: "E-TUBERIAS-TECHO", cir: "C-2", dia: 20 });
    edCambio();
    return { s: s.id, t: t.id };
  })()`);
    const el = id => J(`dsD().els.find(e => e.id === "${id}")`);
    ok(
      (
        await J(
          `[dsEtqDe(dsD().els.find(e => e.id === "${ids.t}")), dsCirtDe(dsD().els.find(e => e.id === "${ids.t}"))]`
        )
      ).join() === "total,false",
      "sin elegir, la tubería sigue al plano (longitud total, sin circuito)"
    );
    // Propiedades de la tubería: ocultar su longitud y mostrar su circuito
    await ev(`DS_SEL.clear(); DS_SEL.add("${ids.t}"); edProps(); 1`);
    ok(
      !!(await ev(`$('edPropC').querySelector('[data-dsp="etq"]')`)),
      "las propiedades de la tubería tienen «Longitud» y «Circuito y Ø»"
    );
    await poner('#edPropC [data-dsp="etq"]', "no");
    await poner('#edPropC [data-dsp="cirt"]', "1");
    let t = await el(ids.t);
    ok(t.etq === "no" && t.cirt === true, "esta tubería: sin longitud y con su circuito");
    ok(
      (
        await J(
          `[dsEtqDe(dsD().els.find(e => e.id === "${ids.t}")), dsCirtDe(dsD().els.find(e => e.id === "${ids.t}"))]`
        )
      ).join() === "no,true",
      "lo del elemento manda sobre lo del plano"
    );
    // Propiedades de la salida: su circuito junto a ella
    await ev(`DS_SEL.clear(); DS_SEL.add("${ids.s}"); edProps(); 1`);
    await poner('#edPropC [data-dsp="nsal"]', "1");
    ok((await el(ids.s)).nsal === true, "la salida muestra su circuito aunque el plano no lo haga");
    // Clic derecho con las dos elegidas: ocultar, mostrar y volver a como el plano
    await ev(`DS_SEL.clear(); DS_SEL.add("${ids.t}"); DS_SEL.add("${ids.s}"); edMenuAccion("etqocu"); 1`);
    t = await el(ids.t);
    ok(
      t.etq === "no" && t.cirt === false && (await el(ids.s)).nsal === false,
      "«Ocultar sus etiquetas»: las dos sin etiquetas"
    );
    await ev(`edMenuAccion("etqver"); 1`);
    t = await el(ids.t);
    ok(
      t.etq === "total" && t.cirt === true && (await el(ids.s)).nsal === true,
      "«Mostrar sus etiquetas»: longitud, circuito y Ø"
    );
    // Se guardan con el proyecto
    const g = await J(
      `(() => { const d = disValido(JSON.parse(JSON.stringify(dsD()))); return d.els.filter(e => e.id === "${ids.t}" || e.id === "${ids.s}").map(e => [e.etq || "", e.cirt, e.nsal]); })()`
    );
    ok(
      JSON.stringify(g).includes('["total",true,null]') && JSON.stringify(g).includes('["",null,true]'),
      "se guardan con el proyecto"
    );
    await ev(`edMenuAccion("etqpla"); 1`);
    t = await el(ids.t);
    ok(
      !("etq" in t) && !("cirt" in t) && !("nsal" in (await el(ids.s))),
      "«Etiquetas como en todo el plano» quita lo propio"
    );
    await clic('[data-ed="cancelar"]');
    await ev(
      "document.querySelector('.welcome:not([hidden]) .vw-btn.def, .welcome:not([hidden]) .btn:not(.sec)')?.click(); 1"
    );
  });

  prueba(
    "Presupuesto: ventana Precios unitarios, desperdicio, porcentajes, recordados, documento y hoja del Excel",
    async ok => {
      await ejemplo("uni");
      await ev(
        `(() => { ponerDato("p_nombre", "Casa con precios"); PRESU = presuVacio(); saveDraft(); setTab("calculo"); verVista("presupuesto"); return 1; })()`
      );
      await esperar(300);
      ok(
        await ev(
          `!!document.querySelector(".pre-doc") && (m => !!m && m[1] === m[2])(document.querySelector(".pre-aviso").textContent.match(/^([0-9]+) de ([0-9]+) partidas sin precio/))`
        ),
        "la vista Presupuesto es el documento y avisa que faltan todos los precios"
      );
      await clic('.pre-doc [data-act="precios"]');
      await esperar(200);
      ok(
        await ev("!$('puDlg').hidden && document.querySelectorAll('#puTab [data-pu]').length > 5"),
        "el botón abre la ventana Precios unitarios"
      );
      const filas = await J(
        `preCalc(LAST).filas.filter(x => !x.sec).map(x => ({ i: x.i, cod: x.cod, q: x.q, cant: x.cant, desp: x.desp }))`
      );
      const cond = filas.find(f => f.cod.startsWith("OE.5.2.3")),
        caja = filas.find(f => f.cod.startsWith("OE.5.2.1"));
      ok(
        cond && Math.abs(cond.q - Math.round(cond.cant * 1.05 * 100) / 100) < 1e-9,
        "en conductores la cantidad suma el desperdicio (5 %)"
      );
      ok(caja && caja.q === caja.cant && !caja.desp, "en las salidas la cantidad es el metrado");
      const precio = (i, v) => poner(`#puTab [data-pu="${i}"]`, v);
      await precio(cond.i, "2,5");
      await precio(caja.i, "10");
      ok(
        await ev(
          `!PRESU.p[preCalc(LAST).filas[${cond.i}].desc] && /2 cambios sin aplicar/.test($("puNota").textContent) && document.querySelectorAll("#puTab tr.cd-mod").length === 2`
        ),
        "los precios quedan pendientes (coma decimal aceptada) hasta aplicar"
      );
      // Enter pasa al precio de la partida siguiente
      await ev(
        `(() => { const l = [...document.querySelectorAll("#puTab [data-pu]")]; l[0].focus(); l[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return 1; })()`
      );
      ok(
        await ev(`document.activeElement === document.querySelectorAll("#puTab [data-pu]")[1]`),
        "Enter pasa a la partida siguiente"
      );
      await clic('#puDlg [data-pu-a="apply"]');
      await esperar(300);
      const esp = Math.round((Math.round(cond.q * 2.5 * 100) / 100 + caja.q * 10) * 100) / 100;
      const C = await J("preCalc(LAST, metrado(LAST), false)");
      ok(Math.abs(C.cd - esp) < 0.005, "al aplicar, el costo directo suma cantidad × precio");
      ok(
        Math.abs(C.gg - Math.round(esp * 10) / 100) < 0.006 && Math.abs(C.igv - Math.round(C.sub * 18) / 100) < 0.006,
        "gastos generales 10 % del CD e IGV 18 % del subtotal"
      );
      ok(
        await ev(`/^2 de/.test($("puAv").textContent) && $("puApply").disabled`),
        "cuenta las partidas con precio y no quedan cambios"
      );
      await poner('[data-pupct="gg"]', "5");
      ok(await ev("PRESU.gg === 10"), "el porcentaje también queda pendiente");
      await clic('#puDlg [data-pu-a="ok"]');
      await esperar(600);
      ok(
        await ev(`PRESU.gg === 5 && libLoad()[PID].PRESU.gg === 5 && $("puDlg").hidden`),
        "Aceptar aplica, guarda en el proyecto y cierra"
      );
      // Cancelar descarta
      await ev("preciosUnitarios(true); 1");
      await precio(caja.i, "99");
      await clic('#puDlg [data-pu-a="cancel"]');
      ok(await ev(`PRESU.p[preCalc(LAST).filas[${caja.i}].desc] === 10`), "Cancelar descarta los cambios");
      // Documento: totales y monto en letras
      await ev('verVista("presupuesto"); 1');
      ok(
        await ev(
          `/^SON: .+ CON [0-9]{2}.100 SOLES$/.test(document.querySelector(".pre-letras").textContent) && document.querySelector(".pre-doc .pre-tot").textContent.includes(soles(preCalc(LAST).tot))`
        ),
        "el documento muestra el total y el monto en letras"
      );
      ok(
        await ev(
          "solesLetras(21000.5) === 'SON: VEINTIÚN MIL CON 50/100 SOLES' && solesLetras(1e6) === 'SON: UN MILLÓN CON 00/100 SOLES'"
        ),
        "monto en letras correcto"
      );
      // Precio borrado: sin precio
      await ev("preciosUnitarios(true); 1");
      await precio(caja.i, "");
      await clic('#puDlg [data-pu-a="ok"]');
      await esperar(300);
      ok(
        await ev(`PRESU.p[preCalc(LAST).filas[${caja.i}].desc] === null && preCalc(LAST).nP === 1`),
        "un precio borrado queda sin precio"
      );
      await ev("preciosUnitarios(true); 1");
      await precio(caja.i, "10");
      await clic('#puDlg [data-pu-a="ok"]');
      await esperar(600);
      // Excel: hoja «Presupuesto» con fórmulas, después del Metrado
      const xl = JSON.parse(
        await ev(
          `(async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await exportar()); const ws = wb.getWorksheet("Presupuesto"); let f = 0, tot = null; ws.eachRow(r => r.eachCell(c => { if (c.value && c.value.formula) f++; if (c.value === "TOTAL PRESUPUESTO (S/)") tot = r.number; })); return JSON.stringify({ hojas: wb.worksheets.map(w => w.name), f, tot: tot && ws.getCell(tot, 9).value.formula }); })()`
        )
      );
      ok(
        xl.hojas.join() === "Memoria,Cálculos,Unifilar,Alturas,Detalles,Tableros,Metrado,Presupuesto,Anexos",
        "el Excel lleva la hoja Presupuesto después del Metrado"
      );
      ok(xl.f > 20 && /^I\d+\+I\d+$/.test(xl.tot), "con fórmulas: parciales, títulos y total");
      // Otro proyecto: las partidas sin precio toman el último usado («recordado»)
      await ev(
        `(() => { PID = null; PRESU = presuVacio(); ponerDato("p_nombre", "Casa nueva"); saveDraft(); preciosUnitarios(true); return 1; })()`
      );
      await esperar(300);
      ok(
        await ev(
          `document.querySelectorAll("#puTab .pu-or.rec").length === 2 && Object.values(PRESU.r).every(n => n === "Casa con precios")`
        ),
        "un proyecto nuevo propone los precios recordados"
      );
      await poner("#puFil", "rec");
      ok(
        await ev(`document.querySelectorAll("#puTab [data-pu]").length === 2`),
        "el filtro muestra solo las partidas con precio recordado"
      );
      await poner("#puFil", "");
      await precio(cond.i, "3");
      await clic('#puDlg [data-pu-a="ok"]');
      await esperar(600);
      await ev("preciosUnitarios(true); 1");
      ok(
        await ev(
          `document.querySelectorAll("#puTab .pu-or.rec").length === 1 && PRESU.p[preCalc(LAST).filas[${cond.i}].desc] === 3`
        ),
        "al cambiarlo, el precio queda como propio"
      );
      await ev("preciosUnitarios(false); 1");
      // Sin precios, el Excel no cambia
      await ev(
        `(() => { PRESU = presuVacio(); PRESU.p = Object.fromEntries(preCalc(LAST, metrado(LAST), false).filas.filter(x => !x.sec).map(x => [x.desc, null])); return 1; })()`
      );
      ok(
        !(await ev(
          `exportar().then(b => { const wb = new ExcelJS.Workbook(); return wb.xlsx.load(b).then(() => !!wb.getWorksheet("Presupuesto")); })`
        )),
        "sin precios, el Excel no lleva la hoja"
      );
      await ev(
        `(() => { const L = libLoad(); Object.keys(L).forEach(k => delete L[k]); libSave(L); PRESU = presuVacio(); return 1; })()`
      );
    }
  );
  prueba("Tipo de cable según el uso (Regla 020-126): vivienda, oficina, criterio y designación con PVC", async ok => {
    const al = () => ev("JSON.stringify(alertas(LAST).find(x => /020-126/.test(x[1])))").then(JSON.parse);
    await ejemplo("uni");
    let a = await al();
    ok(a && a[0] === true && a[1] === "020-126" && /llama/.test(a[2]), "vivienda: no propagador de la llama");
    await ejemplo("com");
    a = await al();
    ok(a && a[0] === true && a[1] === "020-126(3)" && /libres de halógenos/.test(a[2]), "oficina: libre de halógenos");
    const poner = async (id, v) =>
      ev(
        `(() => { const el = $("${id}"); el.value = "${v}"; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); return 1; })()`
      );
    await poner("cableTipo", "llama");
    await esperar(400);
    a = await al();
    ok(a && a[0] === false, "oficina con «no propagador de la llama»: incumple la 020-126(3)");
    await poner("cableTipo", "auto");
    await poner("desig", "THW-90");
    await esperar(400);
    a = await al();
    ok(a && a[0] === false && /THW-90/.test(a[2]), "designación con PVC (THW-90) en un local público: se avisa");
    ok(
      await ev("estado().cableTipo === 'auto' && estado().desig === 'THW-90'"),
      "el tipo de cable se guarda con el proyecto"
    );
  });
  prueba("Profundidad de la varilla (Regla 060-702(3)(d)): cabeza + longitud, al menos 2.5 m", async ok => {
    const al = () => ev("JSON.stringify(alertas(LAST).find(x => x[1] === '060-702(3)(d)'))").then(JSON.parse);
    const poner = async (id, v) =>
      ev(
        `(() => { const el = $("${id}"); el.value = "${v}"; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return 1; })()`
      );
    await ejemplo("uni");
    let a = await al();
    ok(a && a[0] === true && /2\.65 m/.test(a[2]), "por defecto: cabeza a 0.25 m y varilla de 2.40 m = 2.65 m");
    await poner("Lv", "2");
    await esperar(400);
    a = await al();
    ok(a && a[0] === false, "varilla de 2 m con la cabeza a 0.25 m: no llega a 2.5 m");
    await poner("pzCab", "0.6");
    await esperar(400);
    a = await al();
    ok(a && a[0] === true && /2\.60 m/.test(a[2]), "con la cabeza a 0.60 m llega a 2.60 m");
    ok(await ev("estado().pzCab === '0.6'"), "la profundidad de la cabeza se guarda con el proyecto");
  });
  prueba("Tema gris: las ventanas del editor y la hoja de cuentas sin fondos blancos", async ok => {
    await ejemplo("uni");
    const r = await J(`(() => {
    aplicarTema("gris");
    const sel = [".la-op", "#laTam", ".rev-lista", ".ca-tabla", ".bi-rejilla", ".bi-grupos", ".ta-lista", ".dc-cuerpo", ".met-cuerpo", ".si-cuerpo", ".adm-hoja-w"];
    const lum = c => { const m = /rgba?[(]([^)]+)[)]/.exec(c); if (!m) return 0; const v = m[1].split(",").map(Number); if (v.length > 3 && v[3] < 0.5) return 0; return (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255; };
    const out = sel.map(s => { const e = document.querySelector(s); return [s, e ? +lum(getComputedStyle(e).backgroundColor).toFixed(2) : -1]; });
    aplicarTema("claro");
    return out;
  })()`);
    const claros = r.filter(([, l]) => l > 0.45);
    ok(
      r.filter(([, l]) => l >= 0).length >= 8 && !claros.length,
      `fondos oscuros en el tema gris (${claros.length ? "claros: " + claros.map(([s]) => s).join(", ") : r.length + " revisados"})`
    );
  });
  prueba("Guardar: botón y Ctrl+S, estado «Guardado a las…» y una versión con fecha", async ok => {
    await ejemplo("uni");
    ok((await ev("$('gdEstado').textContent")) === "Ejemplo · no se guarda", "un ejemplo no se guarda y lo dice");
    await poner("#p_nombre", "Prueba del botón Guardar");
    await esperar(300);
    const id = await ev("PID");
    const v0 = JSON.parse(
      await ev(`(async () => JSON.stringify((await alVersiones(${JSON.stringify(id)})).length))()`)
    );
    await cdp("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "s",
      code: "KeyS",
      windowsVirtualKeyCode: 83,
      modifiers: 2
    });
    await esperar(600);
    const st = await ev("$('gdEstado').textContent");
    ok(/^Guardado a las \d{1,2}:\d{2}/.test(st), `Ctrl+S guarda y la barra lo dice («${st}»)`);
    const v1 = JSON.parse(
      await ev(`(async () => JSON.stringify((await alVersiones(${JSON.stringify(id)})).length))()`)
    );
    ok(v1 === v0 + 1, `Guardar deja una versión con fecha (${v0} → ${v1})`);
    ok(
      await ev(
        "!!document.querySelector('#editor [data-ed=\"guardar\"]') && document.querySelector('#edDescartar').classList.contains('sec')"
      ),
      "el editor tiene su botón Guardar y «Descartar cambios» queda apartado"
    );
    await ev(
      `(async () => { for (const x of await alVersiones(${JSON.stringify(id)})) await alPut(x.k); const L = libLoad(); delete L[${JSON.stringify(id)}]; libSave(L); return 1; })()`
    );
  });
  prueba("Proteger el trabajo: .json antiguo como copia, otra pestaña y versiones anteriores", async ok => {
    await ejemplo("uni");
    // Un proyecto con nombre (los ejemplos no se guardan en la biblioteca)
    await poner("#p_nombre", "Prueba de guardado");
    await ev("saveDraft(); 1");
    await esperar(400);
    const id0 = await ev("PID");
    ok(!!id0 && (await ev(`!!libLoad()[${JSON.stringify(id0)}]`)), "el proyecto está en la biblioteca");
    // 1. Un archivo .json más antiguo del mismo proyecto: se abre como copia y el del navegador no cambia
    const viejo = await J(
      `(o => ({ ...o, savedAt: "2020-01-01T00:00:00.000Z", p_prop: "DEL ARCHIVO VIEJO" }))(JSON.parse(JSON.stringify(libLoad()[${JSON.stringify(id0)}])))`
    );
    const dir = mkdtempSync(join(tmpdir(), "jmg-json-")),
      arch = join(dir, "viejo.json");
    writeFileSync(arch, JSON.stringify(viejo));
    await cdp("DOM.enable");
    const doc = await cdp("DOM.getDocument", {});
    const q = await cdp("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "#fileOpen" });
    await cdp("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [arch] });
    for (let i = 0; i < 30 && (await ev("$('cfmDlg').hidden")); i++) await esperar(100);
    ok(
      await ev("!$('cfmDlg').hidden && /más recientes en el navegador/.test($('cfmT').textContent)"),
      "al abrir el .json antiguo se avisa que el navegador tiene cambios más recientes"
    );
    await clic('#cfmDlg [data-cf="si"]');
    await esperar(500);
    const r1 = await J(
      `(() => { const L = libLoad(), o = L[${JSON.stringify(id0)}]; return { pid: PID, prop0: o.p_prop, copia: (L[PID] || {}).p_nombre || "" }; })()`
    );
    ok(
      r1.pid !== id0 && r1.prop0 !== "DEL ARCHIVO VIEJO" && /\(archivo del /.test(r1.copia),
      `se abre como copia («${r1.copia}») y el proyecto del navegador no cambia`
    );
    // 2. Otra pestaña guarda el mismo proyecto: esta deja de guardar y pide recargar
    await ev(`(() => { const L = libLoad(); aplicar(L[${JSON.stringify(id0)}]); return 1; })()`);
    const f0 = await ev(`libLoad()[${JSON.stringify(id0)}].savedAt`);
    await ev(
      `new BroadcastChannel((BETA ? "jmg-electric-beta" : "jmg-electric") + "-pestanas").postMessage({ t: "guardado", id: ${JSON.stringify(id0)}, tab: "otra" }); 1`
    );
    await esperar(300);
    ok(await ev("PESTANA_VIEJA && !$('cfmDlg').hidden"), "el aviso pide recargar esta pestaña");
    await ev("cerrarCfm(false); 1");
    await poner("#p_prop", "CAMBIO EN LA PESTAÑA VIEJA");
    await ev("saveDraft(); cerrarCfm(false); 1");
    await esperar(300);
    ok(
      (await ev(`libLoad()[${JSON.stringify(id0)}].savedAt`)) === f0 &&
        (await ev(`libLoad()[${JSON.stringify(id0)}].p_prop`)) !== "CAMBIO EN LA PESTAÑA VIEJA",
      "la pestaña vieja ya no guarda (no pisa el trabajo de la otra)"
    );
    await ev("PESTANA_VIEJA = false; 1");
    // 3. Versiones anteriores: una cada 10 minutos, se listan y se restauran como copia
    const vs = JSON.parse(
      await ev(`(async () => {
      const o = { ...JSON.parse(JSON.stringify(libLoad()[${JSON.stringify(id0)}])), id: "versiones-prueba" };
      await alVersion({ ...o, savedAt: "2026-01-01T10:00:00.000Z" });
      await alVersion({ ...o, savedAt: "2026-01-01T10:05:00.000Z" });
      await alVersion({ ...o, savedAt: "2026-01-01T10:12:00.000Z" });
      const v = await alVersiones("versiones-prueba");
      for (const x of v) await alPut(x.k);
      return JSON.stringify(v.map(x => x.f));
    })()`)
    );
    ok(
      JSON.stringify(vs) === JSON.stringify(["2026-01-01T10:12:00.000Z", "2026-01-01T10:00:00.000Z"]),
      `versiones cada 10 minutos, la más reciente primero (${vs.join(", ")})`
    );
    await ev("renderProy(); 1");
    ok(
      await ev("!!document.querySelector('#projList [data-pa=\"ver\"]')"),
      "botón «Versiones» en la lista de proyectos"
    );
    await ev(
      `(() => { const L = libLoad(); Object.keys(L).filter(k => /Prueba de guardado/.test(L[k].p_nombre)).forEach(k => delete L[k]); libSave(L); return 1; })()`
    );
  });
};
