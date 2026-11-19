/* RESPALDO
   Todos los proyectos guardados en este navegador, con sus planos DXF, en un solo archivo .json, y su restauración.
   · Descargar respaldo: { app, tipo: "respaldo", version, fecha, proyectos: [...], planos: { huella: {nombre, b64} } }.
     Cada plano va una sola vez aunque lo usen varios proyectos.
   · Restaurar respaldo: agrega los proyectos que no están y actualiza los que en el respaldo son más recientes; no
     borra ninguno. Un proyecto que vuelve (no estaba en la lista) toma la fecha de hoy, para que la nube no lo
     vuelva a borrar si se había eliminado en otro equipo. También acepta el archivo de un solo proyecto.
   · La fecha del último respaldo se recuerda en este navegador; pasados RESP_DIAS días se sugiere uno nuevo. */
const RESP_KEY = BETA ? "jmg-electric-beta-respaldo" : "jmg-electric-respaldo",
  // Días tras los que se sugiere un respaldo nuevo (criterio)
  RESP_DIAS = 30;
const respFecha = () => {
  try {
    return localStorage.getItem(RESP_KEY) || "";
  } catch (e) {
    return "";
  }
};
const respDia = d => new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
// Texto del recuadro «Respaldo» (Proyectos): cuándo fue el último y si conviene uno nuevo
function respEstado() {
  const el = $("respSt");
  if (!el) return;
  const f = respFecha(),
    n = Object.values(libLoad()).filter(o => o && o.id).length,
    dias = f ? Math.floor((Date.now() - new Date(f)) / 864e5) : null;
  el.className = "resp-st" + (n && (dias === null || dias > RESP_DIAS) ? " w" : "");
  el.textContent = !n
    ? "Aún no hay proyectos guardados."
    : dias === null
      ? "Aún no ha descargado un respaldo."
      : `Último respaldo: ${respDia(f)}${dias > RESP_DIAS ? ` (hace ${dias} días): conviene descargar uno nuevo.` : "."}`;
}
// Archivo en base64 (para el plano DXF)
const respB64 = buf =>
  new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => mal(r.error);
    r.readAsDataURL(new Blob([buf]));
  });
// Proyecto completo: los que en la lista solo tienen su resumen se leen de la base del navegador
async function respCompleto(o) {
  if (!o._idb) return o;
  try {
    const b = await alLeer(LKEY + "/" + o.id);
    return b && b.app === "JMG-ELECTRIC" ? b : null;
  } catch (e) {
    return null;
  }
}
async function respDescargar() {
  const lista = Object.values(libLoad()).filter(o => o && o.id);
  if (!lista.length) return toast("Aún no hay proyectos guardados para respaldar");
  const b = $("respBajar");
  if (b) b.disabled = true;
  try {
    const proyectos = [],
      planos = {};
    let faltan = 0;
    for (const o0 of lista) {
      const o = await respCompleto(o0);
      if (!o) {
        faltan++;
        continue;
      }
      proyectos.push(o);
      const sha = o.PLANO && o.PLANO.sha;
      if (sha && !planos[sha] && typeof plLeerArchivo === "function") {
        const a = await plLeerArchivo(sha).catch(() => null);
        if (a && a.buf) planos[sha] = { nombre: a.nombre || o.PLANO.nombre || "plano.dxf", b64: await respB64(a.buf) };
      }
    }
    const fecha = new Date().toISOString(),
      // Por partes: con planos grandes, un solo texto enorme puede agotar la memoria
      partes = [
        `{"app":"JMG-ELECTRIC","tipo":"respaldo","version":${JSON.stringify(VERSION)},"fecha":"${fecha}","proyectos":[`,
        ...proyectos.map((o, i) => (i ? "," : "") + JSON.stringify(o)),
        '],"planos":{',
        ...Object.entries(planos).map(([k, v], i) => (i ? "," : "") + JSON.stringify(k) + ":" + JSON.stringify(v)),
        "}}"
      ],
      blob = new Blob(partes, { type: "application/json" }),
      nombre = `JMG-ELECTRIC - Respaldo ${fecha.slice(0, 10)}.json`;
    if (downloads) await downloads.save({ filename: nombre, data: blob });
    else descargarLocal(blob, nombre);
    try {
      localStorage.setItem(RESP_KEY, fecha);
    } catch (e) {}
    respEstado();
    const np = Object.keys(planos).length;
    toast(
      `Respaldo descargado: ${proyectos.length} proyecto${proyectos.length === 1 ? "" : "s"}${np ? ` y ${np} plano${np === 1 ? "" : "s"} DXF` : ""}${faltan ? ` (${faltan} no se pudieron leer)` : ""}`
    );
  } catch (e) {
    toast(
      e && e.code === "declined" ? "Respaldo cancelado" : "No se pudo descargar el respaldo: " + ((e && e.message) || e)
    );
  } finally {
    if (b) b.disabled = false;
  }
}
// Qué hará la restauración con cada proyecto del archivo: agregar, actualizar o nada (ya está al día)
function respPlan(R) {
  const L = libLoad(),
    P = { nuevos: [], act: [], igual: 0 };
  R.proyectos.forEach(o => {
    const l = o.id && L[o.id];
    if (!l) P.nuevos.push(o);
    else if (String(o.savedAt || "") > String(l.savedAt || "")) P.act.push(o);
    else P.igual++;
  });
  return P;
}
async function respAplicar(R, P) {
  const L = libLoad(),
    hoy = new Date().toISOString();
  let np = 0;
  for (const [sha, d] of Object.entries(R.planos || {})) {
    if (!/^[0-9a-f]{40}$/.test(sha) || !d || typeof d.b64 !== "string") continue;
    try {
      if (await plLeerArchivo(sha)) continue;
      const bin = atob(d.b64),
        buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      await plGuardarArchivo(sha, {
        nombre: String(d.nombre || "plano.dxf").slice(0, 120),
        buf: buf.buffer,
        fecha: hoy
      });
      np++;
    } catch (e) {}
  }
  P.nuevos.forEach(o => {
    const id = o.id || nuevoId();
    L[id] = { ...o, id, savedAt: hoy };
  });
  P.act.forEach(o => (L[o.id] = o));
  // Ya no están eliminados en este equipo
  if (typeof NUBE_BORRADOS === "string" && typeof nubeLS === "function") {
    const B = nubeLS(NUBE_BORRADOS);
    P.nuevos.forEach(o => delete B[o.id]);
    nubeLS(NUBE_BORRADOS, B);
  }
  libSave(L);
  renderProy();
  if (typeof centro === "function") centro();
  respEstado();
  toast(
    `Respaldo restaurado: ${P.nuevos.length} agregado${P.nuevos.length === 1 ? "" : "s"}, ${P.act.length} actualizado${P.act.length === 1 ? "" : "s"}${np ? ` y ${np} plano${np === 1 ? "" : "s"} DXF` : ""}`
  );
}
// Lee el archivo elegido: un respaldo o el archivo de un solo proyecto
function respLeer(f) {
  const rd = new FileReader();
  rd.onload = () => {
    let o = null;
    try {
      o = JSON.parse(rd.result);
    } catch (e) {}
    if (!o || o.app !== "JMG-ELECTRIC") return toast("El archivo no es un respaldo ni un proyecto de JMG - ELECTRIC");
    const R =
      o.tipo === "respaldo" && Array.isArray(o.proyectos)
        ? { fecha: o.fecha, proyectos: o.proyectos, planos: o.planos || {} }
        : { fecha: o.savedAt, proyectos: [o], planos: {} };
    // El archivo de un solo proyecto puede traer su plano
    R.proyectos = R.proyectos
      .filter(p => p && p.app === "JMG-ELECTRIC")
      .map(p => {
        if (!p.PLANO_DXF) return p;
        const q = { ...p };
        if (q.PLANO && q.PLANO.sha) R.planos[q.PLANO.sha] = q.PLANO_DXF;
        delete q.PLANO_DXF;
        return q;
      })
      .map(p => (typeof p.id === "string" && /^[\w-]{1,40}$/.test(p.id) ? p : { ...p, id: null }));
    if (!R.proyectos.length) return toast("El respaldo no tiene proyectos");
    const P = respPlan(R),
      n = R.proyectos.length,
      np = Object.keys(R.planos).length;
    if (!P.nuevos.length && !P.act.length)
      return toast(
        `Los ${n === 1 ? "" : n + " "}proyecto${n === 1 ? "" : "s"} del respaldo ya ${n === 1 ? "está" : "están"} al día en este navegador`
      );
    const li = (t, L) =>
      L.length
        ? `<p style="margin:8px 0 2px"><b>${t}:</b></p><ul style="margin:0;padding-left:18px">${L.slice(0, 8)
            .map(o => `<li>${esc(o.p_nombre || "Proyecto sin nombre")}</li>`)
            .join("")}${L.length > 8 ? `<li>y ${L.length - 8} más</li>` : ""}</ul>`
        : "";
    confirmar(
      "Restaurar respaldo",
      `<p style="margin:0">Respaldo${R.fecha ? ` del ${esc(respDia(R.fecha))}` : ""}: ${n} proyecto${n === 1 ? "" : "s"}${np ? ` y ${np} plano${np === 1 ? "" : "s"} DXF` : ""}.</p>${li("Se agregarán", P.nuevos)}${li("Se actualizarán (en el respaldo son más recientes)", P.act)}${P.igual ? `<p style="margin:8px 0 0">${P.igual} ya ${P.igual === 1 ? "está" : "están"} al día y no cambia${P.igual === 1 ? "" : "n"}.</p>` : ""}<p style="margin:8px 0 0">No se elimina ningún proyecto de la lista.</p>`,
      "Restaurar",
      si => si && respAplicar(R, P),
      "Respaldo"
    );
  };
  rd.readAsText(f);
}
$("respBajar").addEventListener("click", respDescargar);
$("respSubir").addEventListener("click", () => {
  $("respFile").value = "";
  $("respFile").click();
});
$("respFile").addEventListener("change", () => {
  const f = $("respFile").files[0];
  if (f) respLeer(f);
});
respEstado();
