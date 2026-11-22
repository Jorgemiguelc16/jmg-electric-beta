/* DESCARGAS
   Guardar archivos (Excel, PDF, DXF, JSON), diálogos de exportación y acciones del panel de resultados. */
const msg = $("expMsg"),
  btn = $("btnXlsx");
let downloads = null;
(async () => {
  try {
    downloads = window.claude?.use ? await window.claude.use("downloads") : null;
  } catch (e) {
    downloads = null;
  }
})();
function descargarLocal(blob, nombre) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
btn.addEventListener("click", async () => {
  if (!entregable()) return;
  if (typeof ExcelJS === "undefined") {
    msg.textContent = "No se cargó la librería de Excel. Verifique la conexión a internet.";
    return;
  }
  btn.disabled = true;
  msg.textContent = "Generando memoria…";
  try {
    const buf = await exportar();
    const nm =
      (LAST.c.proj.nombre || "proyecto")
        .replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]/g, "")
        .trim()
        .slice(0, 60) || "proyecto";
    const nombre = `JMG-ELECTRIC - Memoria de calculo - ${nm}.xlsx`;
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    if (downloads) await downloads.save({ filename: nombre, data: blob });
    else descargarLocal(blob, nombre);
    msg.textContent = "Memoria generada.";
  } catch (e) {
    msg.textContent =
      e && e.code === "declined" ? "Descarga cancelada." : "No se pudo guardar: " + ((e && e.message) || e);
  } finally {
    btn.disabled = false;
  }
});

$("results").addEventListener("change", e => {
  const sel = e.target.closest("select[data-fase]");
  if (!sel) return;
  const fx = FIX[MODE];
  if (sel.value) fx[sel.dataset.fase] = sel.value;
  else delete fx[sel.dataset.fase];
  update();
});
$("results").addEventListener("click", e => {
  if (e.target.closest("[data-balreset]")) {
    FIX[MODE] = {};
    update();
  }
});
// Recomendaciones de diseño: aceptar (queda registrada la fecha en el proyecto) o deshacer
$("results").addEventListener("click", e => {
  const a = e.target.closest("[data-recacep]"),
    u = e.target.closest("[data-recundo]");
  if (a) {
    ACEP[MODE] = { ...ACEP[MODE], [a.dataset.recacep]: new Date().toISOString() };
    calcularAhora();
  } else if (u) {
    const o = { ...ACEP[MODE] };
    delete o[u.dataset.recundo];
    ACEP[MODE] = o;
    calcularAhora();
  }
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-foco]");
  if (b) focoCampo(b.dataset.foco);
  const ej = e.target.closest("[data-ej2]");
  if (ej) cargarEjemplo(ej.dataset.ej2);
});
$("results").addEventListener("click", e => {
  const b = e.target.closest("[data-view]");
  if (!b) return;
  VIEW = b.dataset.view;
  try {
    localStorage.setItem("jmg-electric-view", VIEW);
  } catch (e) {}
  update();
});
// Expediente PDF: primero se elige el estilo (formal o JMG a color)
const PDFKEY = "jmg-electric-estilo-pdf";
function pdfDialogo(abrir) {
  const d = $("pdfDlg");
  d.hidden = !abrir;
  document.body.classList.toggle("wl-open", abrir);
  if (abrir) {
    let e = "formal";
    try {
      e = localStorage.getItem(PDFKEY) || "formal";
    } catch (_) {}
    const r = document.querySelector(`input[name="pdf_est"][value="${e}"]`);
    if (r) r.checked = true;
    d.querySelector('[data-pd="ok"]').focus();
  }
}
$("btnPrint").addEventListener("click", () => {
  if (PRINT && LAST && entregable()) pdfDialogo(true);
});
$("pdfDlg").addEventListener("click", e => {
  const b = e.target.closest("[data-pd]");
  if (e.target.id === "pdfDlg" || (b && b.dataset.pd === "close")) return pdfDialogo(false);
  if (!b || b.dataset.pd !== "ok") return;
  const est = radio("pdf_est") || "formal";
  try {
    localStorage.setItem(PDFKEY, est);
  } catch (_) {}
  pdfDialogo(false);
  guiaPdf(() => imprimirExpediente(est));
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("pdfDlg").hidden) pdfDialogo(false);
});
/* Antes de la ventana de impresión: que el destino sea «Guardar como PDF». Con una impresora (o «Microsoft Print to
   PDF») el navegador usa el papel de ella: el PDF pierde los enlaces del índice y el texto seleccionable, y las
   láminas salen giradas y reducidas. Se puede dejar de mostrar (en este navegador). */
function guiaPdf(fn) {
  let no = false;
  try {
    no = localStorage.getItem("jmg-electric-guia-pdf") === "1";
  } catch (e) {}
  if (no || typeof confirmar !== "function") return fn();
  confirmar(
    "Guardar como PDF",
    `<p>En la ventana de impresión, en <b>Destino</b>, elija <b>Guardar como PDF</b>.</p>
    <ul><li>Así el PDF conserva el <b>índice con enlaces</b> a cada capítulo, el <b>texto seleccionable</b> y cada lámina en <b>su papel</b>.</li>
    <li>Con una impresora o con «Microsoft Print to PDF», el PDF pierde los enlaces y la selección del texto, y las láminas salen giradas y reducidas.</li></ul>
    <label class="cfm-no"><input type="checkbox" id="guiaPdfNo"> No volver a mostrar</label>`,
    "Continuar",
    ok => {
      try {
        if ($("guiaPdfNo") && $("guiaPdfNo").checked) localStorage.setItem("jmg-electric-guia-pdf", "1");
      } catch (e) {}
      if (ok) fn();
    },
    "PDF"
  );
}
async function imprimirExpediente(estilo) {
  if (!LAST || LAST.prelim) return;
  // Láminas de planta del diseño (si el proyecto tiene plano con diseño): van primero en el capítulo de planos
  const lamsDis = typeof laminasExpediente === "function" ? await laminasExpediente() : [];
  let pa = $("printArea");
  if (!pa) {
    pa = document.createElement("div");
    pa.id = "printArea";
    document.body.appendChild(pa);
  }
  // Encabezado y pie de cada página (la portada va sin ellos)
  const P = LAST.c.proj,
    cs = t =>
      String(t)
        .replace(/[\\"]/g, "\\$&")
        .replace(/[\r\n]+/g, " "),
    nom = P.nombre || "Proyecto sin nombre",
    f = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const formal = estilo === "formal",
    ing = (P.proy || "") + (P.cip ? ` · CIP N.° ${P.cip}` : "");
  const mb = (pos, txt) => `@${pos}{content:${txt};font:7.5pt Arial,sans-serif;color:${formal ? "#000" : "#5a6775"}}`;
  const cab = formal
    ? [`"${cs(nom.slice(0, 80))}"`, `"Expediente técnico · Rev. 0"`, `"${cs(ing || f)}"`]
    : [`"JMG - ELECTRIC · Expediente técnico · Rev. 0"`, `"${cs(nom.slice(0, 70))}"`, `"${cs(f)}"`];
  pa.innerHTML =
    `<style>@page{margin:20mm 16mm 17mm 22mm;${mb("top-left", cab[0])}${mb("top-right", cab[1])}${mb("bottom-left", cab[2])}${mb("bottom-right", `"Página " counter(page) " de " counter(pages)`)}}
    @page:first{@top-left{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-right{content:none}} @page ancho{size:A4 landscape;page-orientation:rotate-left}</style>` +
    expediente(LAST, estilo, lamsDis);
  pa.querySelectorAll("button,select").forEach(x => {
    if (x.tagName === "SELECT") {
      const sp = document.createElement("span");
      sp.textContent = x.options[x.selectedIndex]?.text || "";
      x.replaceWith(sp);
    } else x.remove();
  });
  document.body.classList.add("printing");
  // El nombre del PDF lo toma el navegador del título de la página
  printTitulo = document.title;
  document.title = `Expediente técnico - ${nom.replace(/[\\/:*?"<>|]/g, "").slice(0, 80)}`;
  try {
    await Promise.race([
      Promise.all(
        [...pa.querySelectorAll("img")].map(i =>
          i.complete
            ? 0
            : new Promise(ok => {
                i.onload = i.onerror = ok;
              })
        )
      ).then(() => document.fonts && document.fonts.ready),
      new Promise(ok => setTimeout(ok, 3000))
    ]);
  } catch (e) {}
  setTimeout(() => window.print(), 60);
}
let printTitulo = null;
addEventListener("afterprint", () => {
  document.body.classList.remove("printing");
  const pa = $("printArea");
  if (pa) pa.innerHTML = "";
  if (printTitulo !== null) {
    document.title = printTitulo;
    printTitulo = null;
  }
});
$("btnMode").addEventListener("click", () => setMode(MODE === "uni" ? "multi" : "uni"));
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-dl]");
  if (!b || !LAST) return;
  if (LAST.prelim) return entregable();
  const nm =
    (LAST.c.proj.nombre || "proyecto")
      .replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]/g, "")
      .trim()
      .slice(0, 60) || "proyecto";
  if (b.dataset.dl === "dxf") return dxfDialogo(true);
  // Se descarga el plano abierto (o, en cualquier otra vista, el unifilar): un archivo por lámina
  b.disabled = true;
  try {
    for (const u of planoActual()) {
      const nombre = `JMG-ELECTRIC - ${u.nom} - ${nm}.${b.dataset.dl}`,
        blob =
          b.dataset.dl === "svg"
            ? new Blob([u.svg], { type: "image/svg+xml" })
            : await (await fetch(await svgPng(u.svg, 2))).blob();
      if (downloads) await downloads.save({ filename: nombre, data: blob });
      else descargarLocal(blob, nombre);
    }
  } catch (err) {
    if (!(err && err.code === "declined")) console.warn(err);
  } finally {
    b.disabled = false;
  }
});

const PLANOS = {
  // El unifilar puede ocupar varias láminas (IE-01, IE-01A…) según el tamaño de lámina
  unifilar: lam =>
    unifilarHojas(LAST, lam).map((h, i, a) => ({
      ...h,
      nom: "Diagrama unifilar" + (a.length > 1 ? " " + h.hoja : ""),
      corto: "Unifilar" + (a.length > 1 ? " " + h.hoja : "")
    })),
  alturas: () => [{ ...alturas(LAST), nom: "Diagrama de alturas", corto: "Alturas" }],
  detalles: () => [{ ...detalles(LAST), nom: "Leyenda y detalles", corto: "Detalles" }],
  tableros: lam =>
    tablerosHojas(LAST, lam).map((h, i, a) => ({
      ...h,
      nom: "Detalle de tableros" + (a.length > 1 ? " " + h.hoja : ""),
      corto: "Tableros" + (a.length > 1 ? " " + h.hoja : "")
    }))
};
// El banco de medidores solo existe en edificios
PLANOS.tgeneral = () => (b => (b ? [{ ...b, nom: "Tablero general", corto: "TG" }] : []))(tableroGeneral(LAST));
PLANOS.medidores = () =>
  (b => (b ? [{ ...b, nom: "Banco de medidores", corto: "Medidores" }] : []))(bancoMedidores(LAST));
const planoActual = () => PLANOS[PLANOS[VIEW] ? VIEW : "unifilar"]();
/* Ventana «Planos para AutoCAD»: las láminas a descargar (las de planta del diseño, si hay, y las de la plataforma),
   en un solo DXF ordenado o un archivo por lámina, el papel de los diagramas y los colores. Recuerda lo elegido. */
// La ventana móvil se crea al abrirla por primera vez (js/ventanas/ventana.js se carga después de este archivo)
let DX_VW = null;
const dxVw = () =>
  DX_VW ||
  (DX_VW = ventanaMovil(document.querySelector("#dxfDlg .vw"), "jmg-electric-dxf-vw2", {
    w: 860,
    h: 560,
    minW: 560,
    minH: 420
  }));
const DX_NOM = {
  unifilar: ["Diagrama unifilar", "IE-01"],
  alturas: ["Diagrama de alturas de montaje", "IE-02"],
  detalles: ["Leyenda y detalles", "IE-03"],
  tableros: ["Detalle de tableros", "IE-04"],
  tgeneral: ["Tablero general del edificio", "IE-05"],
  medidores: ["Banco de medidores y balance de fases", "IE-06"]
};
const dxConDis = () =>
  typeof PLANO !== "undefined" && PLANO && PLANO.dis && (PLANO.dis.els || []).some(e => e.t === "sim");
// Lista de láminas con su casilla y cuántas tiene cada plano
function dxLista() {
  let op = {};
  try {
    op = JSON.parse(localStorage.getItem("jmg-electric-dxf") || "{}");
  } catch (e) {}
  const lam = $("dx_lam").value,
    fuera = new Set(op.fuera || []),
    filas = [];
  if (dxConDis()) filas.push(["plantas", "Plano con el diseño eléctrico", "Tu DXF original, con sus capas y láminas"]);
  Object.keys(PLANOS).forEach(k => {
    let n = 0;
    try {
      n = PLANOS[k](lam).length;
    } catch (e) {}
    if (n) filas.push([k, DX_NOM[k][0], `${DX_NOM[k][1]}${n > 1 ? ` · ${n} láminas` : ""}`, n]);
  });
  $("dxLista").innerHTML = filas
    .map(
      ([k, t, d, n]) =>
        `<label class="dx-it"><input type="checkbox" data-dxk="${k}" data-n="${n || 0}"${fuera.has(k) ? "" : " checked"}><span><b>${esc(t)}</b><small>${esc(d)}</small></span></label>`
    )
    .join("");
  dxCuenta();
}
// Cuántos elegidos y qué se va a descargar (al pie de la ventana)
const dxCuenta = () => {
  const c = [...$("dxLista").querySelectorAll("[data-dxk]")],
    sel = c.filter(x => x.checked),
    plano = sel.some(x => x.dataset.dxk === "plantas"),
    n = sel.reduce((s, x) => s + (+x.dataset.n || 0), 0),
    lam = `${n} lámina${n === 1 ? "" : "s"}`;
  $("dxN").textContent = `${sel.length} de ${c.length}`;
  $("dxRes").textContent = !sel.length
    ? "Elija al menos una lámina"
    : radio("dx_modo") === "varios"
      ? `${n + (plano ? 1 : 0)} archivos DXF${plano ? ": tu plano con el diseño y uno por lámina" : ", uno por lámina"}`
      : plano
        ? `1 archivo DXF: tu plano con el diseño${n ? ` y ${lam} al costado` : ""}`
        : `1 archivo DXF con ${lam} ordenadas`;
};
function dxfDialogo(abrir) {
  const d = $("dxfDlg");
  d.hidden = !abrir;
  vwFondo();
  if (!abrir) return;
  dxVw().abrir();
  try {
    const o = JSON.parse(localStorage.getItem("jmg-electric-dxf") || "{}");
    if (LAMINAS[o.lamina]) $("dx_lam").value = o.lamina;
    const r = document.querySelector(`input[name="dx_col"][value="${o.colores}"]`);
    if (r) r.checked = true;
    const m = document.querySelector(`input[name="dx_modo"][value="${o.modo}"]`);
    if (m) m.checked = true;
  } catch (e) {}
  dxLista();
  d.querySelector('[data-dx="ok"]').focus();
}
$("dxfDlg").addEventListener("change", e => {
  if (e.target.id === "dx_lam") dxLista();
  else dxCuenta();
});
$("dxfDlg").addEventListener("click", async e => {
  const b = e.target.closest("[data-dx]");
  if (e.target.id === "dxfDlg" || (b && b.dataset.dx === "close")) return dxfDialogo(false);
  if (b && (b.dataset.dx === "todas" || b.dataset.dx === "ninguna")) {
    $("dxLista")
      .querySelectorAll("[data-dxk]")
      .forEach(c => (c.checked = b.dataset.dx === "todas"));
    return dxCuenta();
  }
  if (!b || b.dataset.dx !== "ok" || !LAST || !entregable()) return;
  const marc = [...$("dxLista").querySelectorAll("[data-dxk]")],
    sel = marc.filter(c => c.checked).map(c => c.dataset.dxk);
  if (!sel.length) return toast("Elija al menos una lámina");
  const op = {
    lamina: $("dx_lam").value,
    colores: radio("dx_col") || "jmg",
    modo: radio("dx_modo") || "uno",
    fuera: marc.filter(c => !c.checked).map(c => c.dataset.dxk)
  };
  try {
    localStorage.setItem("jmg-electric-dxf", JSON.stringify(op));
  } catch (err) {}
  // La lámina es la misma de Planos › Lámina: si cambió, el unifilar en pantalla se vuelve a dividir
  const sl = $("optLamina");
  if (sl && sl.value !== op.lamina) {
    sl.value = op.lamina;
    render(LAST);
  }
  const nm =
    (LAST.c.proj.nombre || "proyecto")
      .replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]/g, "")
      .trim()
      .slice(0, 60) || "proyecto";
  dxfDialogo(false);
  /* Con el plano del diseño: el DXF original del arquitecto con el diseño eléctrico en sus coordenadas y los diagramas
     a la misma escala, al costado de la arquitectura; los diagramas se numeran después de las láminas de planta (como en
     el expediente). Sin plano (o si su archivo no se puede usar), las láminas en un archivo de láminas. */
  const conPlano = sel.includes("plantas") && typeof laDxfProyecto === "function",
    nDis = conPlano ? (await laNumPlantas()) || 0 : 0,
    hojas = [];
  ROT_DESP = nDis;
  try {
    sel
      .filter(k => PLANOS[k])
      .forEach(k =>
        PLANOS[k](op.lamina).forEach((u, i, a) => {
          const hoja = ieNum(u.hoja || DX_NOM[k][1]);
          hojas.push({
            svg: u.svg,
            tit: `${hoja} · ${DX_NOM[k][0]}${a.length > 1 && !u.hoja ? ` (${i + 1})` : ""} · ${op.lamina}`,
            corto: `${hoja} ${u.corto}`,
            grupo: "planos"
          });
        })
      );
  } finally {
    ROT_DESP = 0;
  }
  let archivos = [],
    plano = null;
  if (conPlano) {
    try {
      plano = await laDxfProyecto(op.modo === "varios" ? [] : hojas, op);
    } catch (err) {
      console.warn(err);
    }
    if (plano)
      archivos.push([plano, `JMG-ELECTRIC - Plano con diseño${op.modo === "varios" ? "" : " y láminas"} - ${nm}.dxf`]);
  }
  // Sin el plano original: las láminas de planta dibujadas, junto con las demás
  if (conPlano && !plano && typeof laminasExpediente === "function")
    (await laminasExpediente()).reverse().forEach(h =>
      hojas.unshift({
        svg: h.svg,
        tit: `${h.hoja} · ${h.tit} · ${h.tam} 1:${h.esc}`,
        corto: `${h.hoja} ${h.vista || ""}`.trim(),
        papel: h.tam,
        grupo: "plantas"
      })
    );
  if (op.modo === "varios")
    hojas.forEach(h =>
      archivos.push([svgDxf(h.svg, op), `JMG-ELECTRIC - ${h.corto} ${h.papel || op.lamina} - ${nm}.dxf`])
    );
  else if (!plano && hojas.length)
    archivos.push([svgDxfVarias(hojas, op), `JMG-ELECTRIC - Planos (${hojas.length} láminas) - ${nm}.dxf`]);
  for (const [txt, nombre] of archivos) {
    const blob = new Blob([txt], { type: "application/dxf" });
    try {
      if (downloads) await downloads.save({ filename: nombre, data: blob });
      else descargarLocal(blob, nombre);
    } catch (err) {
      if (!(err && err.code === "declined")) console.warn(err);
      if (err && err.code === "declined") break;
    }
  }
  toast(
    plano && op.modo !== "varios"
      ? `El DXF del arquitecto con el diseño eléctrico y ${hojas.length} lámina${hojas.length === 1 ? "" : "s"} al costado`
      : op.modo === "varios"
        ? `${archivos.length} archivos DXF${plano ? ": el plano con el diseño y uno por lámina" : ", uno por lámina"}`
        : `Un DXF con ${hojas.length} lámina${hojas.length > 1 ? "s" : ""} ordenadas, cada una con su título`
  );
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("dxfDlg").hidden) dxfDialogo(false);
});
