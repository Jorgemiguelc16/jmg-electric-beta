/* PROYECTOS EN LA NUBE (Firestore, plan gratuito de Firebase)
   Con la cuenta aprobada, cada proyecto guardado se copia a la cuenta y se trae de ella: al ingresar desde otra
   computadora aparecen los mismos proyectos, con sus planos DXF. El navegador sigue siendo el almacén de trabajo
   (js/proyectos/almacen.js); la nube es su copia.
   · proyectos/{uid}/p/{id}: resumen del proyecto (nombre, fecha savedAt, partes n) y, en su colección «partes», el
     proyecto en texto, en trozos de hasta NUBE_PARTE caracteres (un documento de Firestore admite hasta 1 MB).
     Las partes llevan la fecha del proyecto: si no coinciden con el resumen (se está subiendo), se espera.
   · proyectos/{uid}/planos/{huella}: el plano DXF en base64, en trozos; se sube una sola vez por huella.
   · Un proyecto eliminado queda en la nube como «borrado» (con su fecha), para que se borre en los demás equipos.
   Gana la fecha más reciente (savedAt). Un proyecto del navegador que otra cuenta subió no pasa a esta cuenta.
   Reglas de Firestore: cada cuenta solo lee y escribe su carpeta proyectos/{uid}.
   Sitio de pruebas: su propia carpeta (proyectos-beta) y sus propios registros en el navegador (los dos sitios están
   en el mismo dominio y comparten el almacenamiento), para que nada de lo que se pruebe toque los proyectos reales. */
const NUBE_PARTE = 300000,
  NUBE_PARTE_DXF = 900000,
  NUBE_DXF_MAX = 60e6,
  NUBE_CARPETA = BETA ? "proyectos-beta" : "proyectos",
  NUBE_PRE = BETA ? "jmg-electric-beta-nube" : "jmg-electric-nube",
  NUBE_DUENOS = NUBE_PRE + "-duenos",
  NUBE_BORRADOS = NUBE_PRE + "-borrados";
const NUBE = {
  uid: null,
  des: null,
  listo: false,
  ocupado: false,
  otra: false,
  ult: null,
  T: null,
  est: "",
  cls: "",
  remoto: {},
  subidos: {},
  planos: new Set(),
  avisoDxf: false
};
const nubeCol = () => firebase.firestore().collection(NUBE_CARPETA).doc(NUBE.uid);
const nubeLS = (k, v) => {
  try {
    if (v === undefined) return JSON.parse(localStorage.getItem(k) || "{}") || {};
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    return {};
  }
};
// Estado de la nube en la barra de abajo (y en la lista de proyectos)
function nubeEstado(t, cls = "") {
  NUBE.est = t;
  NUBE.cls = cls;
  const el = $("nubeSt");
  if (el) {
    el.textContent = t ? "Nube: " + t : "";
    el.className = cls;
    el.hidden = !t;
  }
}
const nubeTxt = () => `<span id="nubeSt" class="${NUBE.cls}"${NUBE.est ? "" : " hidden"}>Nube: ${esc(NUBE.est)}</span>`;

// Al entrar con la cuenta aprobada: escucha sus proyectos en la nube
function nubeIniciar(u) {
  if (!u || typeof firebase === "undefined" || !firebase.firestore) return;
  if (NUBE.uid === u.uid && NUBE.des) return;
  nubeDetener();
  NUBE.uid = u.uid;
  const r = nubeLS(NUBE_PRE + "-" + u.uid);
  NUBE.subidos = r.s || {};
  NUBE.planos = new Set(r.pl || []);
  NUBE.listo = false;
  nubeEstado("conectando…");
  NUBE.des = nubeCol()
    .collection("p")
    .onSnapshot(
      qs => {
        NUBE.ult = qs;
        nubeTrabajar();
      },
      e => nubeError(e)
    );
}
function nubeDetener() {
  if (NUBE.des) NUBE.des();
  clearTimeout(NUBE.T);
  Object.assign(NUBE, { uid: null, des: null, T: null, listo: false, ult: null, remoto: {} });
  nubeEstado("");
}
function nubeError(e) {
  console.warn("Nube:", e);
  if (e && e.code === "permission-denied") nubeEstado("sin permiso (falta activar sus reglas en Firebase)", "w");
  else {
    nubeEstado("sin conexión · se reintentará", "w");
    nubeProgramar(30000);
  }
}
/* Cada vez que la biblioteca cambia (js/proyectos/almacen.js, libSave): sube lo nuevo 30 s después (el plan gratuito admite
   unas 20 000 escrituras al día entre todas las cuentas) y, sin esperar, al cerrar o dejar la pestaña */
function nubeProgramar(ms = 30000) {
  if (!NUBE.uid) return;
  // Si ya hay una subida programada antes, se respeta (no se aplaza)
  const t = Date.now() + ms;
  if (NUBE.T && NUBE.Tt <= t) return;
  clearTimeout(NUBE.T);
  NUBE.Tt = t;
  NUBE.T = setTimeout(() => {
    NUBE.T = null;
    nubeTrabajar();
  }, ms);
}
// Un proyecto eliminado en este equipo: se borrará también en la nube
function nubeMarcarBorrado(id) {
  const B = nubeLS(NUBE_BORRADOS);
  B[id] = new Date().toISOString();
  nubeLS(NUBE_BORRADOS, B);
  nubeProgramar(500);
}
// Un trabajo a la vez: primero lo que llegó de la nube, luego lo que hay que subir
async function nubeTrabajar() {
  if (!NUBE.uid) return;
  if (NUBE.ocupado) {
    NUBE.otra = true;
    return;
  }
  NUBE.ocupado = true;
  try {
    do {
      NUBE.otra = false;
      if (NUBE.ult) {
        const q = NUBE.ult;
        NUBE.ult = null;
        await nubeFusionar(q);
        NUBE.listo = true;
      }
      if (NUBE.listo) await nubeSubirCambios();
    } while (NUBE.otra || NUBE.ult);
    if (NUBE.listo) nubeEstado("al día", "g");
  } catch (e) {
    nubeError(e);
  } finally {
    NUBE.ocupado = false;
  }
}
// Espera a que la base del navegador esté leída (si no, faltarían proyectos para comparar)
async function nubeBase() {
  for (let i = 0; i < 100 && typeof AL_HAY !== "undefined" && AL_HAY && !AL_LISTO; i++)
    await new Promise(r => setTimeout(r, 100));
}
// Lo que hay en la nube: trae los proyectos más recientes que los del navegador y borra los que se eliminaron
async function nubeFusionar(qs) {
  await nubeBase();
  const L = libLoad(),
    D = nubeLS(NUBE_DUENOS),
    B = nubeLS(NUBE_BORRADOS),
    R = {};
  let cambio = false,
    abierto = null;
  for (const d of qs.docs) {
    const m = d.data();
    if (!m || !m.id) continue;
    R[m.id] = m;
    NUBE.subidos[m.id] = m.savedAt;
    const l = L[m.id];
    if (m.borrado) {
      if (l && String(l.savedAt) <= String(m.savedAt)) {
        delete L[m.id];
        cambio = true;
        if (m.id === PID) PID = null;
      }
      delete B[m.id];
      continue;
    }
    // Eliminado aquí después de su última copia en la nube: no se trae (se borrará allá)
    if (B[m.id] && String(B[m.id]) >= String(m.savedAt)) continue;
    if (!l || String(m.savedAt) > String(l.savedAt)) {
      nubeEstado(`trayendo «${m.nombre || "proyecto"}»…`);
      const o = await nubeBajar(m);
      if (!o) continue;
      L[m.id] = o;
      D[m.id] = NUBE.uid;
      cambio = true;
      if (m.id === PID) abierto = o;
    } else if (!D[m.id]) D[m.id] = NUBE.uid;
  }
  NUBE.remoto = R;
  nubeLS(NUBE_DUENOS, D);
  nubeLS(NUBE_BORRADOS, B);
  nubeGuardarReg();
  if (cambio) {
    libSave(L);
    if ($("projList") && typeof renderProy === "function") renderProy();
    if (typeof centro === "function") centro();
  }
  if (abierto)
    toast(
      `«${abierto.p_nombre}» cambió en otro equipo: ábralo de nuevo desde Proyectos para ver esos cambios (si sigue aquí, se guarda lo de esta pantalla)`
    );
}
// Sube los proyectos que cambiaron en este navegador y marca los eliminados
async function nubeSubirCambios() {
  const L = libLoad(),
    D = nubeLS(NUBE_DUENOS),
    B = nubeLS(NUBE_BORRADOS);
  for (const o of Object.values(L)) {
    if (!o || !o.id || o._idb || !o.savedAt) continue;
    if (D[o.id] && D[o.id] !== NUBE.uid) continue;
    const r = NUBE.subidos[o.id];
    if (r && String(r) >= String(o.savedAt)) continue;
    nubeEstado(`guardando «${o.p_nombre || "proyecto"}»…`);
    await nubeSubir(o);
    D[o.id] = NUBE.uid;
    NUBE.subidos[o.id] = o.savedAt;
    nubeLS(NUBE_DUENOS, D);
    nubeGuardarReg();
  }
  for (const id of Object.keys(B)) {
    if (L[id]) {
      delete B[id];
      continue;
    }
    if (D[id] && D[id] !== NUBE.uid) continue;
    if (NUBE.remoto[id] && !NUBE.remoto[id].borrado) await nubeBorrar(id, B[id]);
    delete B[id];
  }
  nubeLS(NUBE_BORRADOS, B);
}
function nubeGuardarReg() {
  if (NUBE.uid) nubeLS(NUBE_PRE + "-" + NUBE.uid, { s: NUBE.subidos, pl: [...NUBE.planos] });
}
async function nubeSubir(o) {
  const ref = nubeCol().collection("p").doc(o.id),
    s = JSON.stringify(o),
    n = Math.max(1, Math.ceil(s.length / NUBE_PARTE)),
    antes = (NUBE.remoto[o.id] || {}).n || 0;
  if (o.PLANO && o.PLANO.sha) await nubeSubirPlano(o.PLANO.sha);
  for (let i = 0; i < n; i++)
    await ref
      .collection("partes")
      .doc(String(i))
      .set({ v: o.savedAt, d: s.slice(i * NUBE_PARTE, (i + 1) * NUBE_PARTE) });
  for (let i = n; i < antes; i++) await ref.collection("partes").doc(String(i)).delete();
  // El resumen al final: quien lo lea encuentra ya todas sus partes
  await ref.set({
    id: o.id,
    nombre: String(o.p_nombre || "").slice(0, 200),
    savedAt: o.savedAt,
    n,
    tam: s.length,
    psha: (o.PLANO && o.PLANO.sha) || null,
    version: typeof VERSION === "string" ? VERSION : ""
  });
  NUBE.remoto[o.id] = { id: o.id, savedAt: o.savedAt, n };
}
async function nubeBorrar(id, fecha) {
  const ref = nubeCol().collection("p").doc(id),
    n = (NUBE.remoto[id] || {}).n || 0;
  for (let i = 0; i < n; i++) await ref.collection("partes").doc(String(i)).delete();
  await ref.set({ id, borrado: true, savedAt: fecha || new Date().toISOString(), n: 0 });
  NUBE.remoto[id] = { id, borrado: true };
}
// Partes de un documento, en orden: [datos de la parte 0, 1, …]
async function nubePartes(ref) {
  const qs = await ref.collection("partes").get(),
    P = [];
  qs.forEach(d => (P[+d.id] = d.data()));
  return P;
}
async function nubeBajar(m) {
  const P = await nubePartes(nubeCol().collection("p").doc(m.id));
  let s = "";
  for (let i = 0; i < m.n; i++) {
    if (!P[i] || P[i].v !== m.savedAt) return null;
    s += P[i].d;
  }
  let o;
  try {
    o = JSON.parse(s);
  } catch (e) {
    return null;
  }
  if (!o || o.app !== "JMG-ELECTRIC") return null;
  if (o.PLANO && o.PLANO.sha) await nubeBajarPlano(o.PLANO.sha);
  return o;
}
async function nubeB64(buf) {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => mal(r.error);
    r.readAsDataURL(new Blob([buf]));
  });
}
async function nubeSubirPlano(sha) {
  if (NUBE.planos.has(sha) || typeof plLeerArchivo !== "function") return;
  const ref = nubeCol().collection("planos").doc(sha),
    ya = await ref.get();
  if (ya.exists && ya.data().ok) {
    NUBE.planos.add(sha);
    return;
  }
  const a = await plLeerArchivo(sha);
  if (!a || !a.buf) return;
  if (a.buf.byteLength > NUBE_DXF_MAX) {
    if (!NUBE.avisoDxf) toast("El plano DXF pasa de 60 MB: el proyecto se guarda en la nube sin su plano");
    NUBE.avisoDxf = true;
    return;
  }
  nubeEstado(`subiendo el plano ${a.nombre || "DXF"}…`);
  const b = await nubeB64(a.buf),
    n = Math.max(1, Math.ceil(b.length / NUBE_PARTE_DXF));
  for (let i = 0; i < n; i++)
    await ref
      .collection("partes")
      .doc(String(i))
      .set({ d: b.slice(i * NUBE_PARTE_DXF, (i + 1) * NUBE_PARTE_DXF) });
  await ref.set({ nombre: String(a.nombre || "plano.dxf").slice(0, 120), n, tam: a.buf.byteLength, ok: true });
  NUBE.planos.add(sha);
}
async function nubeBajarPlano(sha) {
  if (typeof plLeerArchivo !== "function") return;
  try {
    if (await plLeerArchivo(sha)) return;
  } catch (e) {}
  const ref = nubeCol().collection("planos").doc(sha),
    m = await ref.get();
  if (!m.exists || !m.data().ok) return;
  const { n, nombre } = m.data(),
    P = await nubePartes(ref);
  let b = "";
  for (let i = 0; i < n; i++) {
    if (!P[i]) return;
    b += P[i].d;
  }
  nubeEstado(`trayendo el plano ${nombre || "DXF"}…`);
  const bin = atob(b),
    buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  await plGuardarArchivo(sha, { nombre: nombre || "plano.dxf", buf: buf.buffer, fecha: new Date().toISOString() });
  NUBE.planos.add(sha);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && NUBE.uid) nubeTrabajar();
});
