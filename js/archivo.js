/* ARCHIVO
   Guardar y abrir proyectos .json, versión en pantalla y botones de nuevo proyecto y ejemplos. */
$("btnSave").addEventListener("click", async () => {
  const nm =
    ($("p_nombre").value || "proyecto")
      .replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]/g, "")
      .trim()
      .slice(0, 60) || "proyecto";
  const nombre = `JMG-ELECTRIC - ${nm}.json`,
    blob = new Blob([JSON.stringify(await proyectoConPlano(estado()), null, 1)], { type: "application/json" });
  try {
    if (downloads) await downloads.save({ filename: nombre, data: blob });
    else descargarLocal(blob, nombre);
    msg.textContent = "Proyecto guardado.";
  } catch (e) {
    msg.textContent = e && e.code === "declined" ? "Guardado cancelado." : "No se pudo guardar el proyecto.";
  }
});
document.querySelectorAll("[data-open]").forEach(b =>
  b.addEventListener("click", () => {
    $("fileOpen").value = "";
    $("fileOpen").click();
  })
);
$("fileOpen").addEventListener("change", () => {
  const f = $("fileOpen").files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = async () => {
    let o = null;
    try {
      o = JSON.parse(rd.result);
    } catch (e) {}
    if (!o || o.app !== "JMG-ELECTRIC") {
      $("openMsg").textContent = "El archivo no es un proyecto de JMG - ELECTRIC.";
      setTab("inicio");
      return;
    }
    // Con su plano DXF (respaldo completo): el plano vuelve a la base del navegador
    o = await guardarPlanoDeArchivo(o);
    aplicar(o);
    $("openMsg").textContent = "";
    msg.textContent = `Proyecto «${o.p_nombre || "sin nombre"}» abierto.`;
    setTab("calculo");
  };
  rd.readAsText(f);
});
document.querySelectorAll("[data-new]").forEach(b => b.addEventListener("click", () => asistente(true, b.dataset.new)));
document.querySelectorAll("[data-start]").forEach(b =>
  b.addEventListener("click", () => {
    const d = loadDraft();
    if (d && d.p_nombre && !/^EJEMPLO\b/.test(d.p_nombre)) setTab("calculo");
    else asistente(true, "uni");
  })
);
document.querySelectorAll("[data-ej]").forEach(b => b.addEventListener("click", () => cargarEjemplo(b.dataset.ej)));
if ($("ver")) $("ver").textContent = VERSION;
if ($("verBadge")) $("verBadge").textContent = " · " + VERSION;
if ($("wsVer")) $("wsVer").textContent = BETA ? "SITIO DE PRUEBAS" : VERSION;
if ($("wlVer")) $("wlVer").textContent = "Versión " + VERSION.replace(/^v/, "");
// Sitio de pruebas: marcado en la barra, en el título de la pestaña y fuera de los buscadores
if (BETA) {
  document.body.classList.add("sitio-beta");
  document.title = "PRUEBAS · " + document.title;
  document.head.insertAdjacentHTML("beforeend", '<meta name="robots" content="noindex, nofollow">');
  const marca = '<em class="beta-marca" title="Versión de pruebas: no es la oficial">PRUEBAS</em>';
  document.querySelector(".jtop-tit b")?.insertAdjacentHTML("afterend", marca);
  document.querySelector("#accT small")?.insertAdjacentHTML("beforebegin", marca);
}

const draft = loadDraft();
if (draft && draft.p_nombre === "Vivienda unifamiliar — Urb. Los Álamos") {
  draft.p_nombre = "";
  if (draft.p_prop === "—") draft.p_prop = "";
  if (draft.p_ubic === "Arequipa, Perú") draft.p_ubic = "";
}
renderSys("sys_uni", "sist", "mono220");
renderSys("sys_multi", "sistG", "tri380");
Object.keys(LISTS).forEach(renderList);

function resetUI(confirmar) {
  const box = $("resetBox");
  if (!confirmar) {
    box.innerHTML = `<button type="button" class="btn sec" id="rsAsk">Restablecer valores iniciales</button>`;
    $("rsAsk").addEventListener("click", () => resetUI(true));
    return;
  }
  box.innerHTML = `<span>Se borrarán los datos ingresados.</span><button type="button" class="btn" id="rsYes">Restablecer</button><button type="button" class="btn sec" id="rsNo">Cancelar</button>`;
  $("rsYes").addEventListener("click", () => {
    try {
      localStorage.removeItem("jmg-electric-tab");
    } catch (e) {}
    alBorrarBorrador().finally(() => location.reload());
  });
  $("rsNo").addEventListener("click", () => resetUI(false));
}
resetUI(false);
