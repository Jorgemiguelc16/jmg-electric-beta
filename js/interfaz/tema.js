/* APARIENCIA
   Tema claro o gris, tamaño del espacio de trabajo, zoom y mano de arrastre del panel central y
   resumen del proyecto plegable. */
const TEMAKEY = "jmg-electric-tema";
function aplicarTema(t) {
  if (t === "oscuro") t = "gris";
  if (t !== "gris") t = "claro";
  const h = document.documentElement;
  h.setAttribute("data-theme", t === "gris" ? "dark" : "light");
  h.setAttribute("data-tema", t);
  h.setAttribute("data-paleta", "grafito");
  document.querySelectorAll('input[name="tema"]').forEach(r => {
    r.checked = r.value === t;
  });
}
document.querySelectorAll('input[name="tema"]').forEach(r =>
  r.addEventListener("change", () => {
    if (!r.checked) return;
    try {
      localStorage.setItem(TEMAKEY, r.value);
    } catch (_) {}
    aplicarTema(r.value);
    if (typeof toast === "function" && !$("ws").hidden) toast(r.value === "gris" ? "Tema gris" : "Tema claro");
  })
);
aplicarTema(document.documentElement.getAttribute("data-tema") || "claro");

/* Cinta de opciones: siempre visible (desde la v2.4 ya no se puede ocultar); se descarta la preferencia antigua */
$("ws").classList.remove("cinta-oculta");
try {
  localStorage.removeItem("jmg-electric-cinta");
} catch (_) {}

/* Pestaña Ajustes: paneles laterales y versión */
// La versión y los datos de la plataforma se muestran en Acerca de (ya no en Ajustes)
$("aj_paneles").addEventListener("click", () => {
  Object.values(PANE).forEach(p => {
    p.on = true;
    p.w = null;
  });
  panes(true);
  $("aj_paneles").textContent = "Paneles restablecidos ✓";
  setTimeout(() => ($("aj_paneles").textContent = "Restablecer paneles"), 1800);
});

/* Tamaño del espacio de trabajo (80 % por defecto) */
const ESCKEY = "jmg-electric-escala";
function escalaWS(v) {
  v = ["0.8", "0.9", "1"].includes(String(v)) ? String(v) : "0.8";
  document.documentElement.style.setProperty("--zws", v);
  $("aj_escala").value = v;
}
try {
  escalaWS(localStorage.getItem(ESCKEY) || "0.8");
} catch (_) {
  escalaWS("0.8");
}
$("aj_escala").addEventListener("change", e => {
  escalaWS(e.target.value);
  try {
    localStorage.setItem(ESCKEY, e.target.value);
  } catch (_) {}
});
// Páginas de la web: si el navegador está alejado (zoom menor de 90 %), se compensa para que no queden diminutas en el centro
function zoomSitio() {
  const k = window.outerWidth > 0 ? window.innerWidth / window.outerWidth : 1;
  document.documentElement.style.setProperty("--zsite", k > 1.1 ? Math.min(k, 3).toFixed(3) : "1");
}
zoomSitio();
addEventListener("resize", zoomSitio);

/* Zoom del panel central (resultados y diagrama unifilar): botones − / 100 % / +, Ctrl + rueda del mouse y arrastre para desplazarse */
let ZC = 1;
function zoomCentro(z) {
  ZC = Math.round(Math.min(3, Math.max(0.5, z)) * 10) / 10;
  document.documentElement.style.setProperty("--zc", ZC);
  $("zoomV").textContent = Math.round(ZC * 100) + " %";
  $("apDoc").classList.toggle("zoom-on", ZC > 1);
}
$("zoomC").addEventListener("click", e => {
  const b = e.target.closest("[data-z]");
  if (!b) return;
  const d = b.dataset.z;
  zoomCentro(d === "0" ? 1 : ZC + (d === "+" ? 0.1 : -0.1));
});
$("apDoc").addEventListener(
  "wheel",
  e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomCentro(ZC + (e.deltaY < 0 ? 0.1 : -0.1));
  },
  { passive: false }
);
// Mano de arrastre: con zoom, o sobre el diagrama unifilar, un clic sostenido desplaza el contenido en cualquier dirección.
// El unifilar tiene su propia barra horizontal (.unif); el panel central se desplaza en vertical. El desplazamiento se divide
// por el zoom de cada contenedor para que el dibujo siga exactamente al mouse.
(function () {
  const d = $("apDoc");
  let p = null;
  const zm = el => el.currentCSSZoom || 1;
  d.addEventListener("mousedown", e => {
    if (e.button !== 0 || e.target.closest("input,select,textarea,button,a,label")) return;
    const u = e.target.closest(".unif"),
      h = u && u.scrollWidth > u.clientWidth ? u : d.scrollWidth > d.clientWidth ? d : null;
    if (ZC <= 1 && !u) return;
    p = { x: e.clientX, y: e.clientY, h, hl: h ? h.scrollLeft : 0, hz: h ? zm(h) : 1, t: d.scrollTop, vz: zm(d) };
    d.classList.add("arrastre");
    e.preventDefault();
  });
  addEventListener("mousemove", e => {
    if (!p) return;
    if (p.h) p.h.scrollLeft = p.hl - (e.clientX - p.x) / p.hz;
    d.scrollTop = p.t - (e.clientY - p.y) / p.vz;
  });
  addEventListener("mouseup", () => {
    if (p) {
      p = null;
      d.classList.remove("arrastre");
    }
  });
})();
/* Resumen del proyecto (panel Propiedades): se pliega con su encabezado y el formulario de arriba ocupa todo el panel */
const SUMKEY = "jmg-electric-resumen";
function plegarResumen(v) {
  $("wsSum").classList.toggle("plegado", v);
  try {
    localStorage.setItem(SUMKEY, v ? "1" : "0");
  } catch (_) {}
}
try {
  if (localStorage.getItem(SUMKEY) === "1") $("wsSum").classList.add("plegado");
} catch (_) {}
$("wsSum").addEventListener("click", e => {
  if (e.target.closest(".st")) plegarResumen(!$("wsSum").classList.contains("plegado"));
});
