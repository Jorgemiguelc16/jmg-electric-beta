/* CENTRO DE INGENIERÍA (INICIO)
   Contadores y tarjetas de los proyectos guardados, con su avance y el estado del último cálculo. */
// Cada proyecto guarda al calcularse un resumen (res): datos pendientes, conforme o no y máxima demanda (ver update y estado)
const CIMG = { viv: "img/plano-vivienda.jpg", multi: "img/unifilar-edificio.jpg", otro: "img/plano-local.jpg" };
const icoSt = (c, d) =>
  `<div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg></div>`;
function tipoProy(o) {
  if (o.MODE === "multi") return { k: "multi", tag: "Edificio", n: "Edificio multifamiliar" };
  const U = USOS[o.uso];
  if (U) return { k: "otro", tag: U.n.split(/[ ,]/)[0], n: U.n };
  return { k: "viv", tag: "Vivienda", n: "Vivienda unifamiliar" };
}
function descProy(o, t) {
  const sis = { mono220: "monofásico 220 V", tri380: "trifásico 380/220 V", tri220: "trifásico 220 V" };
  if (t.k === "multi") {
    const n = (o.tipos || []).reduce((s, x) => s + (+x.cant > 0 ? Math.round(+x.cant) : 0), 0);
    return `${n} departamento${n === 1 ? "" : "s"} · ${sis[o.sistG] || ""}`;
  }
  const a = (+o.area || 0) + (o.pisos || []).reduce((s, p) => s + (+p.area || 0), 0);
  return `${a > 0 ? fmt(a, 0) + " m² · " : ""}${t.k === "otro" ? esc(t.n) : sis[o.sist] || ""}`;
}
const fechaCorta = d => {
  const x = new Date(d);
  if (isNaN(x)) return "";
  const h = new Date();
  return x.toDateString() === h.toDateString()
    ? "hoy " + x.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })
    : x.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
};
function centro() {
  if (!$("cProys")) return;
  const arr = Object.values(libLoad())
    .filter(o => o && o.id)
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const ok = arr.filter(o => o.res && !o.res.pend && o.res.ok).length,
    pe = arr.filter(o => o.res && o.res.pend > 0).length,
    u = arr[0];
  $("cStats").innerHTML =
    `<div class="c-st">${icoSt("#8a6a00", '<path d="M3 6h7l2 2h9v11H3z"/>')}<div><span>Proyectos guardados</span><b>${arr.length}</b></div></div>` +
    `<div class="c-st">${icoSt("#1f8a4c", '<path d="M5 12.5 10 17l9-10"/>')}<div><span>Completos y conformes</span><b>${ok}</b></div></div>` +
    `<div class="c-st">${icoSt("#a86b12", '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>')}<div><span>Con datos pendientes</span><b>${pe}</b></div></div>` +
    `<div class="c-st">${icoSt("#8a6a00", '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}<div><span>Último editado</span><b class="s">${u ? `${esc(u.p_nombre)} <small>${fechaCorta(u.savedAt)}</small>` : "—"}</b></div></div>`;
  if (!arr.length) {
    $("cProys").innerHTML =
      `<div class="c-vacio"><p><b>Aún no tienes proyectos guardados.</b> Crea el primero o abre un ejemplo para conocer la plataforma; los proyectos se guardan solo en este navegador.</p>
    <div class="acts-row"><button type="button" class="btn sm" data-c="nuevo">Nuevo proyecto</button><button type="button" class="btn sec sm" data-c="ej" data-v="uni">Ejemplo de vivienda</button><button type="button" class="btn sec sm" data-c="ej" data-v="multi">Ejemplo de edificio</button><button type="button" class="btn sec sm" data-c="ej" data-v="com">Ejemplo de oficina</button></div></div>`;
    return;
  }
  $("cProys").innerHTML = arr
    .slice(0, 3)
    .map(o => {
      const t = tipoProy(o),
        r = o.res;
      const av = !r
        ? null
        : r.pend > 0
          ? Math.max(5, Math.round(100 * (1 - r.pend / Math.max(r.tot || 1, r.pend))))
          : 100;
      const est = !r
        ? `<span title="Abra el proyecto una vez para ver su avance y su estado">● Ábralo para actualizar</span>`
        : r.pend > 0
          ? `<span class="pend">● ${r.pend} dato${r.pend === 1 ? "" : "s"} pendiente${r.pend === 1 ? "" : "s"}</span>`
          : r.ok
            ? `<span class="okk">● Conforme${r.MD ? ` · ${fmt(r.MD / 1000, 2)} kW` : ""}</span>`
            : `<span class="bad">● Revisar</span>`;
      return `<article class="c-card"><div class="c-thumb"><img src="${CIMG[t.k]}" alt="" loading="lazy"><span class="c-tag">${esc(t.tag)}</span></div>
      <div class="c-cb"><h3>${esc(o.p_nombre)}</h3><p class="d">${descProy(o, t)}</p>
        <div class="c-bar"><div><span style="width:${av ?? 0}%"></span></div>${av == null ? "—" : av + " %"}</div>
        <div class="c-meta"><span>${esc((o.p_ubic || "").split(",")[0] || "—")}</span>${est}</div></div>
      <div class="c-ac"><button type="button" data-c="abrir" data-id="${o.id}">${r && r.pend > 0 ? "Continuar" : "Abrir"}</button><button type="button" data-c="todos">Mis proyectos</button></div></article>`;
    })
    .join("");
}
$("tab-inicio").addEventListener("click", e => {
  const b = e.target.closest("[data-c],[data-herr]");
  if (!b) return;
  if (b.dataset.herr) {
    setTab("herr");
    const el = $(b.dataset.herr)?.closest(".card");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("resalta");
      setTimeout(() => el.classList.remove("resalta"), 1600);
    }
    return;
  }
  const a = b.dataset.c;
  if (a === "abrir") {
    const o = libLoad()[b.dataset.id];
    if (o) {
      aplicar(o);
      setTab("calculo");
    }
  } else if (a === "todos") setTab("proy");
  else if (a === "nuevo") asistente(true, "uni");
  else if (a === "diseno") {
    // Proyecto abierto: espacio de trabajo en la pestaña Diseño; si no hay, uno nuevo
    const n = $("p_nombre").value.trim();
    if (n && !/^EJEMPLO\b/.test(n)) {
      setTab("calculo");
      document.querySelector('#ws [data-tab-r="diseno"]')?.click();
    } else asistente(true, "uni");
  } else if (a === "ej") cargarEjemplo(b.dataset.v);
});
{
  const nv = NOVEDADES[0];
  if (nv) {
    $("cVer").textContent = nv[0];
  }
}
