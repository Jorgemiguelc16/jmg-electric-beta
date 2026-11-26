/* Pruebas de la interfaz · Niveles de iluminación y respaldo de todos los proyectos.
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
    "Niveles de iluminación: EM.010 por defecto, criterio del proyectista, bajo norma y ambientes propios",
    async ok => {
      await ev(
        `(() => { document.querySelectorAll(".welcome").forEach(x => (x.hidden = true)); cargarEjemplo("com"); document.body.classList.remove("sin-acceso", "wl-open"); document.querySelectorAll(".welcome, #acceso").forEach(x => (x.hidden = true)); return 1; })()`
      );
      await esperar(300);
      ok(
        await ev("ambTipo('com15').lux === 200 && ambTipo('com15').em === '5.3' && ambTipo('com10').lux === null"),
        "catálogo del Anexo: «Cantinas, tabernas» 200 lx (5.3) y el salón multiuso sin valor"
      );
      await ev("document.querySelector('[data-act=\"lux\"]').click(); 1");
      await esperar(200);
      ok(
        await ev(
          "!$('ambDlg').hidden && AM_TAB === 'lux' && document.querySelectorAll('#lxLista .lx-fila').length > 150"
        ),
        "ventana con todos los ambientes"
      );
      const poner = async (k, v) =>
        ev(
          `(() => { const el = document.querySelector('[data-lx="${k}"]'); el.value = "${v}"; el.dispatchEvent(new Event("input", { bubbles: true })); return 1; })()`
        );
      await poner("com15", 300);
      await poner("com14", 80);
      await poner("com9", 500);
      ok(
        (await ev("ambTipo('com15').est + ',' + ambTipo('com14').est + ',' + Object.hasOwn(LUX.v, 'com9')")) ===
          "criterio,bajo,false",
        "mayor: criterio; menor: bajo norma; igual a la norma: no se guarda"
      );
      await ev("document.querySelector('[data-lxb=\"nuevo\"]').click(); 1");
      await ev(
        `(() => { const n = document.querySelector('[data-lx-n="u1"]'); n.value = "Pista de baile"; n.dispatchEvent(new Event("input", { bubbles: true })); return 1; })()`
      );
      await poner("u1", 150);
      ok(
        await ev(
          "(() => { const o = estado(); LUX = luxVacio(); aplicar(o); return LUX.v.com15 === 300 && LUX.prop[0].n === 'Pista de baile' && LUX.prop[0].lux === 150; })()"
        ),
        "los niveles y el ambiente propio se guardan con el proyecto"
      );
      ok(await ev("luxRecordado().prop.length === 1"), "y se recuerdan para los proyectos nuevos");
      ok(
        (await ev("(luxRender(), document.querySelector('[data-lx-n=\"u1\"]').value)")) === "Pista de baile" &&
          /Propios del proyecto/.test(await ev("$('lxLista').textContent")),
        "el ambiente propio aparece en la ventana"
      );
      await ev("ambCerrar(); LUX = luxVacio(); luxRecordar(); 1");
    }
  );

  prueba("Respaldo: descargar todos los proyectos con sus planos y restaurarlos", async ok => {
    await ejemplo("uni");
    await ev(
      `(() => { const L = libLoad(); Object.keys(L).forEach(k => delete L[k]); libSave(L); ponerDato("p_nombre", "Casa respaldada"); PRESU = presuVacio(); saveDraft(); setTab("proy"); return 1; })()`
    );
    await esperar(300);
    const id = await ev("PID");
    ok(
      /Aún no ha descargado un respaldo/.test(await ev(`$("respSt").textContent`)),
      "el recuadro Respaldo avisa que no hay uno"
    );
    await ev(
      `window.__desc = window.descargarLocal; window.descargarLocal = (b, n) => { window.__blob = b; window.__nom = n; }; 1`
    );
    await ev(`respDescargar().then(() => 1)`);
    const R = JSON.parse(await ev(`__blob.text()`));
    ok(
      R.app === "JMG-ELECTRIC" &&
        R.tipo === "respaldo" &&
        R.proyectos.length === 1 &&
        /Respaldo \d{4}-\d\d-\d\d\.json$/.test(await ev("__nom")),
      "el respaldo lleva los proyectos en un archivo"
    );
    ok(/Último respaldo:/.test(await ev(`$("respSt").textContent`)), "y recuerda la fecha del último");
    // Eliminado por error: vuelve con el respaldo
    await ev(`(() => { const L = libLoad(); delete L["${id}"]; libSave(L); renderProy(); return 1; })()`);
    await ev(`__blob.text().then(t => { respLeer(new File([t], "r.json")); return 1; })`);
    await esperar(400);
    ok(
      await ev(
        `!$("cfmDlg").hidden && /Se agregarán/.test($("cfmTxt").textContent) && /Casa respaldada/.test($("cfmTxt").textContent)`
      ),
      "antes de restaurar, muestra qué se agrega"
    );
    await ev("cerrarCfm(true); 1");
    await esperar(400);
    ok(
      await ev(`!!libLoad()["${id}"] && libLoad()["${id}"].p_nombre === "Casa respaldada"`),
      "el proyecto eliminado vuelve"
    );
    await ev(`__blob.text().then(t => { respLeer(new File([t], "r.json")); return 1; })`);
    await esperar(300);
    ok(
      await ev(`$("cfmDlg").hidden && /al día/.test($("toast").textContent)`),
      "si ya está al día, no pregunta ni cambia nada"
    );
    ok(
      (await ev("NUBE_CARPETA")) === "proyectos" && (await ev("NUBE_PRE")) === "jmg-electric-nube",
      "el sitio oficial usa su carpeta de la nube (el de pruebas, proyectos-beta)"
    );
    await ev(
      `(() => { window.descargarLocal = __desc; const L = libLoad(); Object.keys(L).forEach(k => delete L[k]); libSave(L); return 1; })()`
    );
  });
};
