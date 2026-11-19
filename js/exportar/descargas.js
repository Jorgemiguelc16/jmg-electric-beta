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
  imprimirExpediente(est);
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("pdfDlg").hidden) pdfDialogo(false);
});
async function imprimirExpediente(estilo) {
  if (!LAST || LAST.prelim) return;
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
    expediente(LAST, estilo);
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
/* Diálogo de descarga DXF */
function dxfDialogo(abrir) {
  const d = $("dxfDlg");
  d.hidden = !abrir;
  document.body.classList.toggle("wl-open", abrir);
  if (abrir) {
    // Por defecto, el plano que está abierto
    $("dx_plano").value = PLANOS[VIEW] ? VIEW : "unifilar";
    try {
      const o = JSON.parse(localStorage.getItem("jmg-electric-dxf") || "{}");
      if (LAMINAS[o.lamina]) $("dx_lam").value = o.lamina;
      const r = document.querySelector(`input[name="dx_col"][value="${o.colores}"]`);
      if (r) r.checked = true;
    } catch (e) {}
    d.querySelector('[data-dx="ok"]').focus();
  }
}
$("dxfDlg").addEventListener("click", async e => {
  const b = e.target.closest("[data-dx]");
  if (e.target.id === "dxfDlg" || (b && b.dataset.dx === "close")) return dxfDialogo(false);
  if (!b || b.dataset.dx !== "ok" || !LAST || !entregable()) return;
  const op = { lamina: $("dx_lam").value, colores: radio("dx_col") || "jmg" };
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
  const pl = $("dx_plano").value;
  dxfDialogo(false);
  for (const u of (pl === "todos" ? Object.keys(PLANOS) : [pl]).flatMap(k => PLANOS[k](op.lamina))) {
    const blob = new Blob([svgDxf(u.svg, op)], { type: "application/dxf" }),
      nombre = `JMG-ELECTRIC - ${u.corto} ${op.lamina} - ${nm}.dxf`;
    try {
      if (downloads) await downloads.save({ filename: nombre, data: blob });
      else descargarLocal(blob, nombre);
    } catch (err) {
      if (!(err && err.code === "declined")) console.warn(err);
      if (err && err.code === "declined") break;
    }
  }
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("dxfDlg").hidden) dxfDialogo(false);
});
