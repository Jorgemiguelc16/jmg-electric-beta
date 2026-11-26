/* LÁMINAS · VENTANA
   La ventana Lámina del editor (papel, escala, zona, capas, avisos), una lámina por planta, dividir una planta en
   varias láminas, las láminas para el expediente, imprimir y descargar. El armado de la lámina está en
   js/editor/laminas.js y su DXF en js/editor/laminas-dxf.js. */
/* ---------- Ventana Lámina ---------- */
const LA_VW = ventanaMovil(document.querySelector("#lamDlg .vw"), "jmg-electric-lamina", {
  w: 1040,
  h: 660,
  minW: 720,
  minH: 420
});
function lamAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  laLista();
  $("lamDlg").hidden = false;
  vwFondo();
  LA_VW.abrir();
  lamCargar();
}
function lamCerrar() {
  $("lamDlg").hidden = true;
  vwFondo();
}
// Pone en la ventana los datos de la lámina elegida
function lamCargar() {
  const D = dsD(),
    L = laLista(),
    op = laOp();
  $("laSel").innerHTML = L.map(
    (l, i) =>
      `<option value="${i}">${esc(l.num || "IE-0" + (i + 1))} · ${esc((l.tit || LA_DEF.tit).slice(0, 40))}</option>`
  ).join("");
  $("laSel").value = String(D.lamI || 0);
  $("laZona").innerHTML =
    EPL.plantas.map((p, i) => `<option value="planta:${i}">Planta: ${esc(p.n)}</option>`).join("") +
    `<option value="todo">Todo el diseño eléctrico</option><option value="vista">Lo que se ve en la pantalla</option>` +
    (op.rect ? `<option value="rect">La zona marcada en el plano</option>` : "");
  // Sin zona elegida: la primera planta encuadrada o, si no hay, todo el diseño
  let z = op.zona;
  if (!z || (z.startsWith("planta:") && !EPL.plantas[+z.slice(7)]) || (z === "rect" && !op.rect))
    z = EPL.plantas.length ? "planta:0" : "todo";
  $("laZona").value = z;
  $("laTam").value = LAMINAS[op.tam] ? op.tam : "auto";
  $("laEsc").value = op.esc > 0 ? String(op.esc) : "auto";
  $("laArq").value = op.arq;
  $("laColor").value = op.color;
  $("laLey").checked = op.ley;
  $("laCua").checked = op.cua !== false;
  $("laTit").value = op.tit;
  $("laNum").value = op.num;
  $("laNotas").value = op.notas;
  const ocl = new Set(op.ocl || []);
  $("laCapas").innerHTML = D.capas
    .map(
      c =>
        `<label><input type="checkbox" data-lac="${esc(c.n)}"${ocl.has(c.n) ? "" : " checked"}><i class="ca-sw" style="background:${c.col}"></i>${esc(c.n)}</label>`
    )
    .join("");
  $("laNotas").closest("label").hidden = false;
  lamVista();
}
// Datos de la ventana a la lámina elegida (con deshacer) y vista previa
function lamLeer() {
  const D = dsD(),
    L = laLista(),
    i = D.lamI || 0,
    e = +$("laEsc").value,
    ocl = [...$("laCapas").querySelectorAll("[data-lac]")].filter(c => !c.checked).map(c => c.dataset.lac);
  L[i] = {
    ...L[i],
    tam: LAMINAS[$("laTam").value] ? $("laTam").value : "auto",
    zona: $("laZona").value || "",
    arq: ["gris", "negro", "color"].includes($("laArq").value) ? $("laArq").value : "gris",
    color: $("laColor").value === "bn" ? "bn" : "color",
    ley: $("laLey").checked,
    cua: $("laCua").checked,
    tit: $("laTit").value.replace(/[<>]/g, "").slice(0, 120) || LA_DEF.tit,
    num: $("laNum").value.replace(/[<>]/g, "").slice(0, 20) || "IE-0" + (i + 1),
    notas: $("laNotas").value.replace(/[<>]/g, "").slice(0, 2000)
  };
  // La escala de la lámina es suya (no cambia la del diseño); sin elegir, la automática
  if (DS_ESCALAS.includes(e)) L[i].esc = e;
  else delete L[i].esc;
  if (ocl.length) L[i].ocl = ocl;
  else delete L[i].ocl;
  edCambio();
}
function lamVista() {
  if ($("lamDlg").hidden) return;
  const r = laSvg();
  $("laPrev").innerHTML = r.svg;
  // Lo que eligió el ajuste automático, en la misma opción
  $("laTam").querySelector('[value="auto"]').textContent = `Automático: ${r.tam} (recomendado)`;
  $("laEsc").querySelector('[value="auto"]').textContent = `Automática: 1:${r.esc} (recomendada)`;
  // Si la zona no entra: pasar al papel y la escala automáticos o, con varias plantas, una lámina por planta
  const op = laOp(),
    // También cuando todo entra, pero a una escala menor que 1:75 porque el papel está fijo
    noEntra = /no entra|no cabe|no queda sitio|quedan juntos|elija también la escala/.test(r.aviso),
    fijo = !!LAMINAS[op.tam] || op.esc > 0,
    variasPl = /^(todo|vista)$/.test(op.zona || "") && EPL.plantas.length > 1,
    // Con el papel y la escala automáticos, una zona que no entra en A1 a 1:75 se divide en varias láminas
    partir = /divídala en \d+ láminas/.test(r.aviso) && op.zona !== "vista";
  $("laAviso").innerHTML =
    esc(r.aviso) +
    (noEntra && (fijo || variasPl || partir)
      ? `<span class="la-av-b">${fijo ? '<button type="button" class="vw-btn" data-la="auto">Usar papel y escala automáticos</button>' : ""}${variasPl ? '<button type="button" class="vw-btn" data-la="porplanta">Una lámina por planta</button>' : ""}${partir ? '<button type="button" class="vw-btn" data-la="partir">Dividir en varias láminas</button>' : ""}</span>`
      : "");
  $("laAviso").hidden = !r.aviso;
}
// La zona marcada en el plano (herramienta Zona de la lámina): vuelve a la ventana con esa zona
function lamZonaMarcada(z) {
  const D = dsD(),
    L = laLista(),
    i = D.lamI || 0;
  if (Math.abs(z[2] - z[0]) * PLV.s < 8 || Math.abs(z[3] - z[1]) * PLV.s < 8) return lamAbrir();
  L[i] = { ...L[i], zona: "rect", rect: z };
  edCambio();
  lamAbrir();
  toast("Zona marcada: la lámina muestra ese rectángulo");
}
/* Plantas con diseño eléctrico que ninguna de las láminas (ops) muestra, con el número que les toca (después del mayor
   IE-NN). Las usan «Una lámina por planta» y el expediente, para que vayan todas las plantas. */
function laPlantasSin(ops) {
  const D = dsD(),
    usadas = new Set(ops.map(o => o.zona || (EPL.plantas.length ? "planta:0" : "todo"))),
    conDis = p =>
      D.els.some(e => {
        if (e.t !== "sim" && e.t !== "tub") return false;
        const b = dsBBox(e);
        return b[2] >= p.x0 && b[0] <= p.x1 && b[3] >= p.y0 && b[1] <= p.y1;
      }),
    n0 = ops.reduce((m, o) => Math.max(m, +(/^IE-(\d+)/.exec(o.num) || [0, 0])[1]), 0);
  return EPL.plantas
    .map((p, i) => ({ p, z: "planta:" + i }))
    .filter(({ p, z }) => !usadas.has(z) && conDis(p))
    .map((o, j) => ({ ...o, num: "IE-" + String(n0 + j + 1).padStart(2, "0") }));
}
/* «Una lámina por planta»: cada planta con diseño queda con su lámina (papel y escala automáticos, las demás opciones
   de la primera). Una lámina de «todo el diseño» o «lo que se ve en la pantalla» pasa a la primera planta que falta. */
function lamPorPlanta() {
  if (!EPL || !EPL.plantas.length) return toast("Primero encuadre las plantas (Inicio › Plantas)");
  const D = dsD(),
    L = laLista(),
    ops = L.map((l, i) => laOp(i)),
    falta = laPlantasSin(ops.filter(o => !/^(todo|vista)$/.test(o.zona || "")));
  if (!falta.length) return toast("Cada planta con diseño ya tiene su lámina");
  const limpia = o => {
    const c = { ...o, tam: "auto" };
    ["esc", "rect", "parte", "_i", "_n"].forEach(k => delete c[k]);
    return c;
  };
  let n = 0;
  L.forEach((l, i) => {
    if (n < falta.length && /^(todo|vista)$/.test(ops[i].zona || "")) {
      L[i] = { ...limpia(ops[i]), zona: falta[n].z, num: ops[i].num };
      n++;
    }
  });
  // Los números siguen al mayor de las láminas que quedan
  const resto = falta.slice(n),
    n0 = L.reduce((m, o, i) => Math.max(m, +(/^IE-(\d+)/.exec(laOp(i).num || "") || [0, 0])[1]), 0);
  resto.forEach((f, j) => L.push({ ...limpia(laOp(0)), zona: f.z, num: "IE-" + String(n0 + j + 1).padStart(2, "0") }));
  D.lamI = Math.min(D.lamI || 0, L.length - 1);
  edCambio();
  if (!$("lamDlg").hidden) lamCargar();
  toast(`${falta.length} lámina${falta.length > 1 ? "s" : ""} por planta: ${L.map(l => l.num).join(", ")}`);
}
/* «Dividir en varias láminas»: la lámina elegida, si su zona no entra en A1 a 1:75 (EM.010, Art. 8.5), pasa a ser
   varias, una por parte de la zona, con sus líneas de corte (laPartes) */
function lamPartir() {
  const D = dsD(),
    L = laLista(),
    i = D.lamI || 0,
    ps = laPartes(laOp(i));
  if (ps.length < 2) return toast("Esta lámina ya entra en su papel a 1:50 o 1:75");
  const limpia = o => {
    const c = { ...o };
    ["_i", "_n", "aviso"].forEach(k => delete c[k]);
    return c;
  };
  L.splice(i, 1, ...ps.map(limpia));
  edCambio();
  lamCargar();
  toast(`La planta va en ${ps.length} láminas a 1:${LA_ESC_NORMA}: ${ps.map(p => p.num).join(", ")}`);
}
/* Láminas del diseño para el expediente (js/exportar/descargas.js): las del plano aplicado al proyecto (PLANO), con
   su arquitectura leída del navegador. No necesita el editor abierto: usa una copia y deja todo como estaba. Sin
   diseño o sin su archivo DXF, ninguna. */
async function laminasExpediente() {
  if (typeof PLANO === "undefined" || !PLANO || !PLANO.sha || !PLANO.dis) return [];
  if (!(PLANO.dis.els || []).some(e => e.t === "sim")) return [];
  try {
    const r = await laConPlano(() => {
      /* Todas las plantas: las láminas del proyecto y, para cada planta con diseño que ninguna muestra, una más con
         las mismas opciones que la primera (papel y escala automáticos), numerada después de la última */
      const ops = laLista().map((l, i) => laOp(i));
      laPlantasSin(ops).forEach(({ z, num }) =>
        ops.push({ ...ops[0], tam: "auto", esc: undefined, rect: undefined, parte: undefined, zona: z, num })
      );
      // Las láminas tal como las dejó el proyectista (una planta se divide solo si él lo decide)
      const todas = ops;
      return todas.map((op, i) => {
        const r = laSvg({ ...op, _i: i, _n: todas.length }, todas);
        return { svg: r.svg, W: r.W, H: r.H, hoja: op.num, tit: op.tit, tam: r.tam, esc: r.esc, vista: laVistaTit(op) };
      });
    });
    return r || [];
  } catch (e) {
    toast("Las láminas del diseño no se pudieron preparar: " + e.message);
    return [];
  }
}
// Imprimir con la guía de «Guardar como PDF» (js/exportar/descargas.js)
const lamImprimir = todas => guiaPdf(() => laImprimirYa(todas));
function laImprimirYa(todas) {
  const L = laLista(),
    idx = todas ? L.map((l, i) => i) : [dsD().lamI || 0],
    hojas = idx.map(i => ({ i, ...laSvg(laOp(i)) }));
  let pa = $("printArea");
  if (!pa) {
    pa = document.createElement("div");
    pa.id = "printArea";
    document.body.appendChild(pa);
  }
  // Cada lámina en su página, con el tamaño de su papel
  pa.innerHTML =
    `<style>${hojas.map((h, j) => `@page la${j}{size:${h.W}mm ${h.H}mm;margin:0}#printArea .la-h${j}{page:la${j};width:${h.W - 0.5}mm;height:${h.H - 0.5}mm}`).join("")}html,body.printing{margin:0!important;padding:0!important;height:auto!important;min-height:0!important}#printArea{margin:0;padding:0}#printArea .la-hoja{overflow:hidden;break-after:page;break-inside:avoid;margin:0}#printArea .la-hoja:last-of-type{break-after:avoid}#printArea .la-hoja:last-child{break-after:auto}#printArea .la-hoja svg{display:block;width:100%;height:100%}@page{margin:0}</style>` +
    hojas.map((h, j) => `<div class="la-hoja la-h${j}">${h.svg}</div>`).join("");
  document.body.classList.add("printing");
  printTitulo = document.title;
  const nom = ($("p_nombre").value.trim() || "Proyecto").replace(/[\\/:*?"<>|]/g, "").slice(0, 70);
  document.title = todas ? `Láminas - ${nom}` : `${laOp().num} - ${nom}`;
  setTimeout(() => window.print(), 80);
}
async function lamDxf(conArq) {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  if (!dsD().els.length) return toast("El diseño eléctrico aún no tiene elementos");
  const nom = ($("p_nombre").value.trim() || "Proyecto").replace(/[\\/:*?"<>|]/g, "").slice(0, 60);
  // Con la arquitectura: el archivo original del arquitecto con el diseño agregado; si no se puede, dibujado de nuevo
  let datos = null;
  if (conArq)
    try {
      const a = await plLeerArchivo(EPL.sha);
      if (a && a.buf) datos = laDxfOriginal(a.buf);
    } catch (e) {
      datos = null;
    }
  descargarLocal(
    new Blob([datos || laDxf(conArq)], { type: "application/dxf" }),
    `${nom} - diseño eléctrico${conArq ? " con arquitectura" : ""}.dxf`
  );
  toast(
    conArq
      ? datos
        ? "DXF del arquitecto tal cual (capas, bloques y sombreados), con el diseño eléctrico agregado en sus capas"
        : "DXF con la arquitectura dibujada de nuevo (el archivo original no se pudo usar) y el diseño eléctrico"
      : "DXF del diseño eléctrico en coordenadas reales: insértelo en el plano del arquitecto en 0,0"
  );
}
$("laEsc").innerHTML =
  '<option value="auto">Automática (recomendada)</option>' +
  DS_ESCALAS.map(e => `<option value="${e}">1:${e}</option>`).join("");
$("lamDlg").addEventListener("change", e => {
  if (e.target.id === "laSel") {
    dsD().lamI = +e.target.value || 0;
    edCambio();
    return lamCargar();
  }
  lamLeer();
  lamCargar();
});
$("lamDlg").addEventListener("click", e => {
  if (e.target.id === "lamDlg") return lamCerrar();
  const b = e.target.closest("[data-la]");
  if (!b) return;
  const a = b.dataset.la;
  if (a === "cerrar") lamCerrar();
  else if (a === "max") {
    LA_VW.maximizar();
    lamVista();
  } else if (a === "pdf") lamImprimir(false);
  else if (a === "pdftodas") lamImprimir(true);
  else if (a === "porplanta") lamPorPlanta();
  else if (a === "partir") lamPartir();
  else if (a === "auto") {
    $("laTam").value = "auto";
    $("laEsc").value = "auto";
    lamLeer();
    lamCargar();
  } else if (a === "dxf") lamDxf(false);
  else if (a === "nueva") {
    const D = dsD(),
      L = laLista(),
      u = L[D.lamI || 0];
    L.push({ ...u, num: "IE-" + String(L.length + 1).padStart(2, "0"), tit: LA_DEF.tit });
    D.lamI = L.length - 1;
    edCambio();
    lamCargar();
    toast(`Lámina ${L[D.lamI].num} creada: elija su zona, sus capas y su título`);
  } else if (a === "quitar") {
    const D = dsD(),
      L = laLista();
    if (L.length < 2) return toast("El proyecto necesita al menos una lámina");
    L.splice(D.lamI || 0, 1);
    D.lamI = Math.max(0, (D.lamI || 0) - 1);
    edCambio();
    lamCargar();
  } else if (a === "marcar") {
    lamCerrar();
    plHerr("lamzona");
    toast("Designe en el plano las dos esquinas de lo que va en la lámina");
  }
});
$("lamDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    lamCerrar();
  }
  e.stopPropagation();
});
