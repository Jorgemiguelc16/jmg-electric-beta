/* ARRANQUE Y NAVEGACIÓN
   Conecta el menú, carga el último proyecto y abre la sección inicial. Ventana de bienvenida. */
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => setTab(b.dataset.go)));
document.querySelectorAll("[data-calc]").forEach(el => {
  el.addEventListener("input", update);
  el.addEventListener("change", update);
});
let tab0 = "inicio";
try {
  tab0 = localStorage.getItem("jmg-electric-tab") || "inicio";
} catch (e) {}
ayudas();
if (draft) aplicar(draft);
else aplicar(proyectoVacio("uni"));
// La biblioteca y el proyecto abierto desde la base de datos del navegador (js/proyectos.js)
alCargar();

/* Bienvenida (se abre al iniciar sesión, desde js/acceso.js). Si la persona ya tiene proyectos guardados,
   el botón principal continúa el último en lugar de abrir un ejemplo. */
const WKEY = "jmg-electric-bienvenida";
function bienvenida(abrir) {
  const w = $("welcome");
  w.hidden = !abrir;
  document.body.classList.toggle("wl-open", abrir);
  if (abrir) {
    const b = w.querySelector(".wl-acts .btn"),
      u = Object.values(libLoad())
        .filter(o => o && o.id && o.p_nombre && !/^EJEMPLO\b/.test(o.p_nombre))
        .sort((a, c) => String(c.savedAt).localeCompare(String(a.savedAt)))[0];
    b.dataset.wl = u ? "continuar" : "ejemplo";
    b.dataset.id = u ? u.id : "";
    b.innerHTML = u ? `Continuar: <b>${esc(u.p_nombre)}</b>` : "Ver un ejemplo";
    b.focus();
  } else
    try {
      localStorage.setItem(WKEY, "1");
    } catch (e) {}
}
$("welcome").addEventListener("click", e => {
  const b = e.target.closest("[data-wl]");
  if (e.target.id === "welcome" || b) {
    bienvenida(false);
    if (b && b.dataset.wl === "ejemplo") cargarEjemplo("uni");
    if (b && b.dataset.wl === "continuar") {
      const o = libLoad()[b.dataset.id];
      if (o) {
        aplicar(o);
        setTab("calculo");
      }
    }
  }
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("welcome").hidden) bienvenida(false);
});
document.querySelectorAll("[data-welcome]").forEach(b => b.addEventListener("click", () => bienvenida(true)));
/* Inicio: la columna derecha acompaña el desplazamiento */
function fijarLado() {
  const el = document.querySelector(".home>:nth-child(2)");
  if (!el) return;
  el.style.top = Math.min(12, innerHeight - el.offsetHeight - 12) + "px";
}
addEventListener("resize", fijarLado);
addEventListener("load", fijarLado);
// La bienvenida se muestra al entrar con una cuenta aprobada (js/acceso.js); el administrador recibe su saludo personal
setTab(
  ["inicio", "calculo", "proy", "herr", "normas", "guia", "novedades", "soporte", "acerca", "ajustes"].includes(tab0)
    ? tab0
    : "inicio"
);
