/* PROYECTOS · LISTA DE PROYECTOS
   La lista de la pestaña Proyectos (renderProy) y sus acciones: abrir, duplicar, exportar, versiones anteriores
   (restaurar como copia) y eliminar. */
let DELQ = null,
  // Proyecto con su lista de versiones abierta y las versiones leídas ({ id, vs })
  VERQ = null;
function renderProy() {
  const L = libLoad(),
    arr = Object.values(L)
      .filter(o => o && o.id)
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const f = d => {
    const x = new Date(d);
    return isNaN(x)
      ? "—"
      : x.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) +
          " · " +
          x.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  };
  if (!arr.length) {
    $("projList").innerHTML =
      `<div class="body"><p class="hint" style="font-size:13px">Aún no hay proyectos guardados. Cree uno nuevo o escriba un nombre en «Datos del proyecto»: se guardará automáticamente.</p></div>`;
    return;
  }
  $("projList").innerHTML =
    `<table><thead><tr><th class="t">Proyecto</th><th class="t">Tipo</th><th class="t">Proyectista</th><th class="t">Modificado</th><th class="t">Acciones</th></tr></thead><tbody>${arr
      .map(
        o => `<tr${o.id === PID ? ' class="fix"' : ""}>
    <td class="t" style="white-space:normal"><strong>${esc(o.p_nombre)}</strong>${o.id === PID ? ' <span class="pill ok">En edición</span>' : ""}<br><span class="hint">${esc(o.p_ubic || "")}</span></td>
    <td class="t">${o.MODE === "multi" ? "Multifamiliar" : USOS[o.uso] ? esc(USOS[o.uso].n) : "Unifamiliar"}</td><td class="t">${esc(o.p_proy || "—")}</td><td class="t">${f(o.savedAt)}</td>
    <td class="t"><div class="acts-row">${
      DELQ === o.id
        ? `<span class="hint">¿Eliminar?</span><button type="button" class="btn sm" data-pa="del-ok" data-id="${o.id}">Sí, eliminar</button><button type="button" class="btn sec sm" data-pa="del-no">Cancelar</button>`
        : `<button type="button" class="btn sm" data-pa="open" data-id="${o.id}">Abrir</button><button type="button" class="btn sec sm" data-pa="dup" data-id="${o.id}">Duplicar</button><button type="button" class="btn sec sm" data-pa="exp" data-id="${o.id}">Exportar</button><button type="button" class="btn sec sm" data-pa="ver" data-id="${o.id}" title="Copias guardadas mientras trabajaba (una cada 10 minutos, las 20 más recientes)">Versiones</button><button type="button" class="btn sec sm" data-pa="del" data-id="${o.id}">Eliminar</button>`
    }</div></td></tr>${
      VERQ && VERQ.id === o.id
        ? `<tr class="ver-fila"><td class="t" colspan="5"><div class="ver-lista"><b>Versiones anteriores de «${esc(o.p_nombre)}»</b> <span class="hint">· se restauran como una copia; el proyecto actual no cambia</span>${
            !VERQ.vs
              ? '<p class="hint">Leyendo…</p>'
              : !VERQ.vs.length
                ? '<p class="hint">Aún no hay versiones guardadas de este proyecto (se guarda una cada 10 minutos mientras trabaja).</p>'
                : `<ul>${VERQ.vs.map(v => `<li><span>${f(v.f)}</span><button type="button" class="btn sec sm" data-pa="ver-rest" data-id="${o.id}" data-k="${esc(v.k)}">Restaurar como copia</button></li>`).join("")}</ul>`
          }<button type="button" class="btn sec sm" data-pa="ver-no">Cerrar</button></div></td></tr>`
        : ""
    }`
      )
      .join("")}</tbody></table><p class="hint al-uso" id="alUso"></p>`;
  alUso();
  if (typeof respEstado === "function") respEstado();
}
$("projList").addEventListener("click", async e => {
  const b = e.target.closest("[data-pa]");
  if (!b) return;
  const L = libLoad(),
    o = L[b.dataset.id],
    a = b.dataset.pa;
  if (a === "open" && o) {
    aplicar(o);
    setTab("calculo");
    abrirSegunFlujo();
    msg.textContent = `Proyecto «${o.p_nombre}» abierto.`;
    return;
  }
  if (a === "dup" && o) {
    const id = nuevoId();
    L[id] = {
      ...JSON.parse(JSON.stringify(o)),
      id,
      p_nombre: `${o.p_nombre} (copia)`,
      savedAt: new Date().toISOString()
    };
    libSave(L);
  }
  if (a === "exp" && o) {
    const nm =
        o.p_nombre
          .replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]/g, "")
          .trim()
          .slice(0, 60) || "proyecto",
      blob = new Blob([JSON.stringify(await proyectoConPlano(o), null, 1)], { type: "application/json" });
    try {
      if (downloads) await downloads.save({ filename: `JMG-ELECTRIC - ${nm}.json`, data: blob });
      else descargarLocal(blob, `JMG-ELECTRIC - ${nm}.json`);
    } catch (err) {}
  }
  if (a === "ver" && o) {
    VERQ = { id: o.id, vs: null };
    renderProy();
    try {
      VERQ.vs = await alVersiones(o.id);
    } catch (err) {
      VERQ.vs = [];
    }
  }
  if (a === "ver-no") VERQ = null;
  if (a === "ver-rest" && o) {
    try {
      const v = await alLeer(b.dataset.k);
      if (v && v.app === "JMG-ELECTRIC") {
        const id = nuevoId(),
          fv = new Date(v.savedAt);
        L[id] = {
          ...v,
          id,
          p_nombre: `${v.p_nombre} (versión del ${fv.toLocaleDateString("es-PE")} ${fv.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })})`,
          savedAt: new Date().toISOString()
        };
        libSave(L);
        VERQ = null;
        toast(`Versión restaurada como «${L[id].p_nombre}»: ábrala desde la lista`);
      } else toast("Esa versión ya no está en el navegador");
    } catch (err) {
      toast("No se pudo leer la versión: " + (err && err.message ? err.message : err));
    }
  }
  if (a === "del") DELQ = b.dataset.id;
  if (a === "del-no") DELQ = null;
  if (a === "del-ok") {
    delete L[b.dataset.id];
    if (typeof nubeMarcarBorrado === "function") nubeMarcarBorrado(b.dataset.id);
    libSave(L);
    if (b.dataset.id === PID) PID = null;
    DELQ = null;
  }
  renderProy();
});
