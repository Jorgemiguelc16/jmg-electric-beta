/* ADMINISTRACIÓN (solo el administrador)
   · La página es el panel del administrador: resumen de las cuentas y su agenda personal (fechas importantes con
     recordatorio; los vencimientos de las cuentas aparecen solos). La hoja de cuentas se abre en una ventana.
   · PIN propio (4 a 8 dígitos) para abrir esta página: se guarda cifrado (SHA-256 con sal) en config/admin, que solo
     el administrador lee; tras 15 minutos sin usar la página se vuelve a pedir. Protege la página de quien use la
     computadora con la sesión abierta; la seguridad de fondo es la cuenta de Gmail y las reglas de Firestore.
   · La lista de cuentas como una hoja: buscar, filtrar, ordenar por columna y editar en la misma celda (nombre, uso,
     notas, vigencia), con exportación a Excel.
   · Vigencia: indefinida, 1, 3 o 6 meses o 1 año (mínimo un mes); al vencer, la cuenta no entra (pantalla «Su acceso
     venció») y las reglas le cierran sus proyectos en la nube. Renovar extiende desde la fecha de vencimiento (o
     desde hoy, si ya venció).
   · Nueva cuenta: el administrador escribe el correo y la contraseña inicial; la cuenta se crea con una segunda
     instancia de Firebase (así no se cierra la sesión del administrador) y queda aprobada al instante. */
const ADM = {
  L: [],
  q: "",
  f: "todos",
  ord: "estado",
  dir: 1,
  modo: "",
  abierto: false,
  ultAct: 0,
  pin: undefined,
  sal: null,
  intentos: 0,
  bloqHasta: 0
};
const ADM_INACT = 15 * 60000,
  ADM_DIA = 86400000;
const VIGENCIAS = [
  ["", "Indefinida"],
  ["1m", "1 mes"],
  ["3m", "3 meses"],
  ["6m", "6 meses"],
  ["1a", "1 año"]
];
const ADM_ESTADOS = {
  pendiente: ["Pendiente", "warn"],
  aprobado: ["Aprobado", "ok"],
  vencido: ["Vencido", "bad"],
  rechazado: ["Rechazado", "bad"],
  desactivado: ["Desactivado", "bad"],
  admin: ["Administrador", "ok"]
};
const admDb = () => firebase.firestore();
const admMs = t => (!t ? null : typeof t.toMillis === "function" ? t.toMillis() : t.seconds ? t.seconds * 1000 : +t);
const admFecha = ms =>
  ms ? new Date(ms).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const admHora = ms => (ms ? new Date(ms).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "");
const admYo = x => x.correo === ADMIN_CORREO || (USUARIO && x.id === USUARIO.uid);
// Fecha de vencimiento: desde la fecha dada, más el plazo de la vigencia
function admVence(desde, v) {
  const d = new Date(desde);
  if (v === "1a") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + ({ "1m": 1, "3m": 3, "6m": 6 }[v] || 0));
  return d;
}
// Estado que se muestra: el administrador; aprobado pero vencido, «vencido»
const admEstado = x =>
  admYo(x) ? "admin" : x.estado === "aprobado" && admMs(x.vence) && admMs(x.vence) < Date.now() ? "vencido" : x.estado;
// Días que faltan para el vencimiento (negativos: ya venció)
const admDias = x => (admMs(x.vence) ? Math.ceil((admMs(x.vence) - Date.now()) / ADM_DIA) : null);
const admPorVencer = x => admEstado(x) === "aprobado" && admDias(x) != null && admDias(x) <= 7;

/* ---------- PIN ---------- */
async function admHash(pin, sal) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sal + ":" + pin));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function admLeerPin() {
  if (ADM.pin !== undefined) return;
  const d = await admDb().collection("config").doc("admin").get(),
    v = d.exists ? d.data() : {};
  ADM.pin = v.pin || null;
  ADM.sal = v.sal || null;
}
const admAbierto = () => ADM.abierto && Date.now() - ADM.ultAct < ADM_INACT;
// Al entrar a la página Administración (setTab)
async function admAbrir() {
  if (!esAdminCuenta) return;
  if (ADM.pin === undefined) admPantalla("cargando");
  try {
    await admLeerPin();
  } catch (e) {
    return admPantalla("error", e);
  }
  if (!ADM.pin) return admPantalla("crear");
  if (!admAbierto()) {
    ADM.abierto = false;
    return admPantalla("pin");
  }
  admPantalla("panel");
}
function admBloquear() {
  ADM.abierto = false;
  admCerrarVentana();
  if (!$("tab-admin").hidden) admPantalla("pin");
}
// Actividad en la página: mantiene abierta la sesión de Administración; sin actividad, se bloquea
["click", "keydown", "input"].forEach(t =>
  ["tab-admin", "admDlg"].forEach(id =>
    $(id).addEventListener(t, () => {
      if (ADM.abierto) ADM.ultAct = Date.now();
    })
  )
);
setInterval(() => {
  if (ADM.abierto && !admAbierto()) admBloquear();
}, 30000);

/* ---------- Pantallas de la página ---------- */
const admCampoPin = (id, ph) =>
  `<label>${ph}<input type="password" id="${id}" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]*"></label>`;
function admPantalla(modo, extra) {
  ADM.modo = modo;
  const C = $("admCuerpo"),
    caja = (tit, txt, cuerpo) =>
      `<div class="adm-pin card"><div class="adm-pin-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div><h3>${tit}</h3><p class="hint">${txt}</p><p class="acc-msg bad" id="admMsg"></p>${cuerpo}</div>`;
  if (modo === "cargando") C.innerHTML = `<p class="hint" style="padding:16px">Cargando…</p>`;
  else if (modo === "error")
    C.innerHTML = caja(
      "No se pudo abrir la administración",
      extra && extra.code === "permission-denied"
        ? "Firebase no da permiso para leer la configuración del administrador: falta pegar las reglas nuevas de Firestore (consola de Firebase › Firestore › Reglas)."
        : "Revise su conexión a internet y vuelva a intentarlo." + (extra && extra.code ? ` (${esc(extra.code)})` : ""),
      `<button type="button" class="btn" data-adp="reintentar">Reintentar</button>`
    );
  else if (modo === "crear")
    C.innerHTML = caja(
      ADM.pin ? "Cambiar el PIN de administrador" : "Cree su PIN de administrador",
      "Solo números, de 4 a 8 dígitos. Se pedirá al abrir esta página y otra vez tras 15 minutos sin usarla. Se guarda cifrado: nadie puede leerlo, ni siquiera desde Firebase.",
      `<form class="acc-form" data-adf="crear">${admCampoPin("admPin1", "Nuevo PIN")}${admCampoPin("admPin2", "Repita el PIN")}<button type="submit" class="btn acc-prim">Guardar PIN</button>${ADM.pin ? `<button type="button" class="btn sec" data-adp="cancelar">Cancelar</button>` : ""}</form>`
    );
  else if (modo === "pin")
    C.innerHTML = caja(
      "Administración protegida",
      "Ingrese su PIN de administrador para ver y administrar las cuentas.",
      `<form class="acc-form" data-adf="pin">${admCampoPin("admPin", "PIN")}<button type="submit" class="btn acc-prim">Entrar</button></form><p class="acc-alt"><button type="button" class="linkbtn" data-adp="olvido">¿Olvidó su PIN?</button></p>`
    );
  else if (modo === "olvido") {
    const g = USUARIO && USUARIO.providerData.some(p => p && p.providerId === "google.com");
    C.innerHTML = caja(
      "Restablecer el PIN",
      g
        ? "Confirme que es usted con su cuenta de Google; luego podrá crear un PIN nuevo."
        : "Escriba la contraseña de su cuenta; luego podrá crear un PIN nuevo.",
      g
        ? `<button type="button" class="btn acc-prim" data-adp="reauth-g">Confirmar con Google</button><button type="button" class="btn sec" data-adp="volver">Volver</button>`
        : `<form class="acc-form" data-adf="reauth"><label>Contraseña de su cuenta<input type="password" id="admReClave" autocomplete="current-password"></label><button type="submit" class="btn acc-prim">Confirmar</button><button type="button" class="btn sec" data-adp="volver">Volver</button></form>`
    );
  } else if (modo === "panel") return admPanel();
  if (typeof ponerOjos === "function") ponerOjos(C);
  const f = C.querySelector("input");
  if (f) setTimeout(() => f.focus(), 30);
}
const admMsg = t => {
  const m = $("admMsg");
  if (m) m.textContent = t;
};
$("admCuerpo").addEventListener("submit", async e => {
  const f = e.target.closest("[data-adf]");
  if (!f) return;
  e.preventDefault();
  const k = f.dataset.adf;
  if (k === "crear") {
    const a = $("admPin1").value.trim(),
      b = $("admPin2").value.trim();
    if (!/^\d{4,8}$/.test(a)) return admMsg("El PIN debe tener de 4 a 8 dígitos, solo números.");
    if (a !== b) return admMsg("Los dos PIN no coinciden.");
    try {
      const sal = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, "0")).join(""),
        pin = await admHash(a, sal);
      await admDb()
        .collection("config")
        .doc("admin")
        .set({ pin, sal, cambiado: firebase.firestore.FieldValue.serverTimestamp() });
      Object.assign(ADM, { pin, sal, abierto: true, ultAct: Date.now(), intentos: 0 });
      toast("PIN de administrador guardado.");
      admPantalla("panel");
    } catch (err) {
      admMsg("No se pudo guardar el PIN" + (err.code ? ` (${err.code})` : "") + ".");
    }
  }
  if (k === "pin") {
    if (Date.now() < ADM.bloqHasta)
      return admMsg(`Demasiados intentos. Espere ${Math.ceil((ADM.bloqHasta - Date.now()) / 60000)} min.`);
    const p = $("admPin").value.trim();
    if ((await admHash(p, ADM.sal)) === ADM.pin) {
      Object.assign(ADM, { abierto: true, ultAct: Date.now(), intentos: 0 });
      admPantalla("panel");
    } else {
      ADM.intentos++;
      $("admPin").value = "";
      if (ADM.intentos >= 5) {
        ADM.bloqHasta = Date.now() + 5 * 60000;
        ADM.intentos = 0;
        admMsg("PIN incorrecto. Por seguridad, espere 5 minutos para volver a intentar.");
      } else admMsg(`PIN incorrecto (${ADM.intentos} de 5 intentos).`);
    }
  }
  if (k === "reauth") {
    try {
      await USUARIO.reauthenticateWithCredential(
        firebase.auth.EmailAuthProvider.credential(USUARIO.email, $("admReClave").value)
      );
      ADM.abierto = true;
      ADM.ultAct = Date.now();
      admPantalla("crear");
    } catch (err) {
      admMsg("No se pudo confirmar: revise la contraseña.");
    }
  }
});
$("admCuerpo").addEventListener("click", async e => {
  const b = e.target.closest("[data-adp]");
  if (!b) return;
  const a = b.dataset.adp;
  if (a === "reintentar") {
    ADM.pin = undefined;
    admAbrir();
  }
  if (a === "cancelar") admPantalla("panel");
  if (a === "cambiarpin") admPantalla("crear");
  if (a === "bloquear") admBloquear();
  if (a === "olvido") admPantalla("olvido");
  if (a === "volver") admPantalla("pin");
  if (a === "reauth-g")
    try {
      await USUARIO.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
      ADM.abierto = true;
      ADM.ultAct = Date.now();
      admPantalla("crear");
    } catch (err) {
      admMsg("No se pudo confirmar con Google" + (err.code ? ` (${err.code})` : "") + ".");
    }
});

/* ---------- La hoja de cuentas ---------- */
// Lista en vivo (js/cuenta/acceso.js, adminLista): se vuelve a dibujar si la página está abierta
function admLista(L) {
  ADM.L = L;
  admBadge();
  if (!admAbierto()) return;
  if (!$("admDlg").hidden) admRender();
  // El panel se redibuja, salvo mientras se escribe en él (una nota, un evento)
  const foco = document.activeElement;
  if (
    ADM.modo === "panel" &&
    !$("tab-admin").hidden &&
    !(foco && $("admCuerpo").contains(foco) && foco.matches("input, textarea, select"))
  )
    admPanel();
}
// Insignia de Administración en el menú: solicitudes pendientes y recordatorios de la agenda que tocan hoy
function admBadge() {
  const n = ADM.L.filter(x => x.estado === "pendiente").length + (AG.cargada ? agAvisos() : 0);
  document.querySelectorAll(".adm-badge").forEach(x => {
    x.textContent = n;
    x.hidden = !n;
  });
}
const ADM_COLS = [
  ["nombre", "Nombre"],
  ["correo", "Correo"],
  ["uso", "Uso"],
  ["creado", "Solicitud"],
  ["estado", "Estado"],
  ["vig", "Vigencia"],
  ["vence", "Vence"],
  ["ultimo", "Último ingreso"],
  ["notas", "Notas"],
  ["", "Acciones"]
];
const ADM_FILTROS = [
  ["todos", "Todas", () => true],
  ["pendiente", "Pendientes", x => admEstado(x) === "pendiente"],
  ["aprobado", "Activas", x => admEstado(x) === "aprobado" || admEstado(x) === "admin"],
  ["porvencer", "Por vencer (7 días)", admPorVencer],
  ["vencido", "Vencidas", x => admEstado(x) === "vencido"],
  ["baja", "Desactivadas o rechazadas", x => ["desactivado", "rechazado"].includes(admEstado(x))]
];
const ADM_ORDEN_EST = { pendiente: 0, vencido: 1, aprobado: 2, admin: 3, desactivado: 4, rechazado: 5 };
function admValorOrden(x, k) {
  if (k === "estado") return ADM_ORDEN_EST[admEstado(x)] ?? 9;
  if (k === "creado" || k === "vence" || k === "ultimo") return admMs(x[k]) || 0;
  if (k === "vig") return VIGENCIAS.findIndex(v => v[0] === (x.vigencia || ""));
  return String(x[k] || "").toLowerCase();
}
function admFilas() {
  const q = ADM.q.trim().toLowerCase(),
    fil = (ADM_FILTROS.find(f => f[0] === ADM.f) || ADM_FILTROS[0])[2];
  return ADM.L.filter(
    x =>
      fil(x) &&
      (!q ||
        [x.nombre, x.correo, x.uso, x.notas].some(v =>
          String(v || "")
            .toLowerCase()
            .includes(q)
        ))
  ).sort((a, b) => {
    const va = admValorOrden(a, ADM.ord),
      vb = admValorOrden(b, ADM.ord);
    return (va < vb ? -1 : va > vb ? 1 : 0) * ADM.dir || (admMs(b.creado) || 0) - (admMs(a.creado) || 0);
  });
}
function admRender() {
  // Filtros con su cantidad
  $("admFiltros").innerHTML = ADM_FILTROS.map(
    ([k, t, f]) =>
      `<button type="button" class="adm-chip${ADM.f === k ? " on" : ""}" data-adfil="${k}">${t} <b>${ADM.L.filter(f).length}</b></button>`
  ).join("");
  const F = admFilas(),
    usos = v => [...new Set([...USOS_CUENTA, v].filter(Boolean))];
  $("admPie").textContent =
    `${F.length} de ${ADM.L.length} cuenta${ADM.L.length === 1 ? "" : "s"} · Nombre, uso, vigencia y notas se editan en la celda y se guardan solos · ✉ envía el correo para restablecer la contraseña (Firebase no deja ver contraseñas)`;
  $("admHoja").innerHTML = !ADM.L.length
    ? `<p class="hint" style="padding:16px">Aún no hay cuentas.</p>`
    : `<div class="adm-hoja"><table><thead><tr>${ADM_COLS.map(([k, t]) =>
        k
          ? `<th class="t"><button type="button" class="adm-ord${ADM.ord === k ? " on" : ""}" data-adord="${k}">${t}${ADM.ord === k ? (ADM.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`
          : `<th class="t">${t}</th>`
      ).join("")}</tr></thead><tbody>${
        F.length
          ? F.map(admFila).join("")
          : `<tr><td class="t" colspan="${ADM_COLS.length}"><span class="hint">Ninguna cuenta coincide con la búsqueda.</span></td></tr>`
      }</tbody></table></div>`;
  function admFila(x) {
    const st = admEstado(x),
      [et, ec] = ADM_ESTADOS[st] || [st, "warn"],
      yo = admYo(x),
      d = admDias(x),
      bt = (k, t, s = "", tit = "") =>
        `<button type="button" class="btn sm ${s}" data-ada="${k}" data-id="${x.id}"${tit ? ` title="${tit}"` : ""}>${t}</button>`,
      acc = yo
        ? `<span class="hint">Su cuenta</span>`
        : (st === "pendiente"
            ? bt("aprobar", "Aprobar") + bt("rechazar", "Rechazar", "sec")
            : st === "aprobado"
              ? (admPorVencer(x) ? bt("renovar", "Renovar") : "") + bt("desactivar", "Desactivar", "sec")
              : st === "vencido"
                ? bt("renovar", "Renovar") + bt("desactivar", "Desactivar", "sec")
                : bt("aprobar", "Reactivar")) +
          bt("clave", "✉", "sec", "Enviar un correo para restablecer su contraseña"),
      vence = admMs(x.vence)
        ? `${admFecha(admMs(x.vence))}<small class="${d < 0 ? "bad" : d <= 7 ? "w" : ""}">${d < 0 ? `venció hace ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "vence hoy" : `quedan ${d} día${d === 1 ? "" : "s"}`}</small>`
        : `<span class="hint">—</span>`;
    return `<tr class="${st === "pendiente" ? "adm-pend" : ""}" data-id="${x.id}">
      <td class="t"><input class="adm-in" data-k="nombre" value="${esc(x.nombre || "")}" placeholder="—"${yo ? " disabled" : ""}></td>
      <td class="t adm-correo">${esc(x.correo || "")}</td>
      <td class="t"><select class="adm-in" data-k="uso"${yo ? " disabled" : ""}>${usos(x.uso)
        .map(u => `<option${u === x.uso ? " selected" : ""}>${esc(u)}</option>`)
        .join("")}</select></td>
      <td class="t">${admFecha(admMs(x.creado))}</td>
      <td class="t"><span class="pill ${ec}">${et}</span></td>
      <td class="t"><select class="adm-in" data-k="vigencia"${yo ? " disabled" : ""}>${VIGENCIAS.map(
        ([k, t]) => `<option value="${k}"${k === (x.vigencia || "") ? " selected" : ""}>${t}</option>`
      ).join("")}</select></td>
      <td class="t adm-vence">${yo ? `<span class="hint">—</span>` : vence}</td>
      <td class="t">${admMs(x.ultimo) ? `${admFecha(admMs(x.ultimo))}<small>${admHora(admMs(x.ultimo))}</small>` : `<span class="hint">—</span>`}</td>
      <td class="t"><input class="adm-in adm-notas" data-k="notas" value="${esc(x.notas || "")}" placeholder="Agregar nota…" maxlength="300"></td>
      <td class="t"><div class="acts-row">${acc}</div></td></tr>`;
  }
}
const admRef = id => admDb().collection("usuarios").doc(id);
async function admGuardar(id, datos, ok) {
  try {
    await admRef(id).update(datos);
    if (ok) toast(ok);
  } catch (err) {
    toast("No se pudo guardar: " + (err.code || err.message));
    admRender();
  }
}
// Barra: buscar, filtros, nueva cuenta, exportar, PIN y bloquear
$("admBuscar").addEventListener("input", e => {
  ADM.q = e.target.value;
  admRender();
  const i = $("admBuscar");
  i.focus();
});
$("admBarra").addEventListener("click", e => {
  const f = e.target.closest("[data-adfil]");
  if (f) {
    ADM.f = f.dataset.adfil;
    return admRender();
  }
  const b = e.target.closest("[data-adb]");
  if (!b) return;
  const a = b.dataset.adb;
  if (a === "nueva") admNueva();
  if (a === "excel") admExcel();
  if (a === "bloquear") admBloquear();
});
$("admHoja").addEventListener("click", e => {
  const o = e.target.closest("[data-adord]");
  if (o) {
    const k = o.dataset.adord;
    ADM.dir = ADM.ord === k ? -ADM.dir : 1;
    ADM.ord = k;
    return admRender();
  }
  const b = e.target.closest("[data-ada]");
  if (!b) return;
  const x = ADM.L.find(u => u.id === b.dataset.id);
  if (!x) return;
  const a = b.dataset.ada,
    ts = d => firebase.firestore.Timestamp.fromDate(d),
    rev = { revisado: firebase.firestore.FieldValue.serverTimestamp() };
  b.disabled = true;
  if (a === "aprobar") {
    // Con vigencia elegida, el plazo corre desde hoy
    const v = x.vigencia || "";
    admGuardar(
      x.id,
      { estado: "aprobado", vence: v ? ts(admVence(Date.now(), v)) : null, ...rev },
      `${x.nombre || x.correo}: aprobada`
    );
  }
  if (a === "rechazar") admGuardar(x.id, { estado: "rechazado", ...rev });
  if (a === "desactivar")
    confirmar(
      "Desactivar la cuenta",
      `<p><b>${esc(x.nombre || x.correo)}</b> no podrá ingresar hasta que la reactive. Sus proyectos se conservan.</p>`,
      "Desactivar",
      ok => (ok ? admGuardar(x.id, { estado: "desactivado", ...rev }) : admRender()),
      "Administración"
    );
  if (a === "renovar") {
    const v = x.vigencia || "1m",
      base = Math.max(Date.now(), admMs(x.vence) || 0),
      d = admVence(base, v);
    admGuardar(
      x.id,
      { estado: "aprobado", vigencia: v, vence: ts(d), ...rev },
      `${x.nombre || x.correo}: renovada hasta el ${admFecha(+d)}`
    );
  }
  if (a === "clave")
    firebase
      .auth()
      .sendPasswordResetEmail(x.correo)
      .then(() => toast(`Se envió a ${x.correo} el correo para restablecer su contraseña.`))
      .catch(err => toast("No se pudo enviar: " + (err.code || err.message)))
      .finally(() => (b.disabled = false));
});
// Edición en la celda: se guarda al cambiar
$("admHoja").addEventListener("change", e => {
  const i = e.target.closest(".adm-in");
  if (!i) return;
  const id = i.closest("tr").dataset.id,
    x = ADM.L.find(u => u.id === id),
    k = i.dataset.k,
    v = i.value.trim();
  if (!x) return;
  if (k === "vigencia") {
    // El nuevo plazo corre desde hoy; indefinida, sin vencimiento
    const d = v ? admVence(Date.now(), v) : null;
    return admGuardar(
      id,
      { vigencia: v, vence: d ? firebase.firestore.Timestamp.fromDate(d) : null },
      d ? `${x.nombre || x.correo}: vence el ${admFecha(+d)}` : `${x.nombre || x.correo}: vigencia indefinida`
    );
  }
  if (k === "nombre" && !v) {
    i.value = x.nombre || "";
    return;
  }
  admGuardar(id, { [k]: v.slice(0, 300) });
});
$("admHoja").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.matches("input.adm-in")) e.target.blur();
});

/* ---------- La ventana de la hoja ---------- */
const ADM_VW = ventanaMovil(document.querySelector("#admDlg .vw"), "jmg-electric-cuentas", {
  w: 1240,
  h: 640,
  minW: 640,
  minH: 320
});
// Abre la hoja, con un filtro o una búsqueda si se dan (desde el panel)
function admVentana(filtro, buscar) {
  if (!admAbierto()) return admAbrir();
  ADM.f = filtro || "todos";
  ADM.q = buscar || "";
  $("admBuscar").value = ADM.q;
  $("admDlg").hidden = false;
  vwFondo();
  ADM_VW.abrir();
  admRender();
}
function admCerrarVentana() {
  if ($("admDlg").hidden) return;
  $("admDlg").hidden = true;
  vwFondo();
}
$("admDlg").addEventListener("click", e => {
  const b = e.target.closest("[data-adw]");
  if (!b) return;
  if (b.dataset.adw === "cerrar") admCerrarVentana();
  if (b.dataset.adw === "max") ADM_VW.maximizar();
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("admDlg").hidden && $("cfmDlg").hidden) admCerrarVentana();
});

/* ---------- Panel del administrador ----------
   Franja superior (saludo, resumen de cuentas y la hoja) y cinco tarjetas: mini calendario, agenda agrupada (atrasado,
   hoy, mañana, esta semana, próximamente), pendientes con prioridad y fecha límite, notas de colores y la actividad de
   las cuentas. Agenda, pendientes y notas se guardan juntos en config/agenda (solo el administrador). */
const AG = { items: [], tareas: [], notas: [], cargada: false, mes: null, sel: null, form: "", hechas: false };
const AG_MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];
const AG_REC = [
  [0, "El mismo día"],
  [1, "1 día antes"],
  [3, "3 días antes"],
  [7, "1 semana antes"]
];
const AG_PRI = { u: ["Urgente", 0], a: ["Alta", 1], n: ["Normal", 2] };
const AG_COLORES = ["amarillo", "verde", "azul", "rosa"];
const agStr = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const agHoy = () => agStr(new Date());
const agFecha = s => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
// Días desde hoy hasta la fecha (negativos: ya pasó)
const agDias = s => Math.round((agFecha(s) - agFecha(agHoy())) / ADM_DIA);
const agCuando = s => {
  const d = agDias(s);
  return d === 0 ? "hoy" : d === 1 ? "mañana" : d === -1 ? "ayer" : d > 1 ? `en ${d} días` : `hace ${-d} días`;
};
const agLarga = s => agFecha(s).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
const agId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// Hace cuánto (para la actividad de las cuentas)
const agHace = ms => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1
    ? "ahora"
    : m < 60
      ? `hace ${m} min`
      : m < 1440
        ? `hace ${Math.round(m / 60)} h`
        : `hace ${Math.round(m / 1440)} día${Math.round(m / 1440) === 1 ? "" : "s"}`;
};
async function agLeer() {
  const d = await admDb().collection("config").doc("agenda").get(),
    v = d.exists ? d.data() : {};
  AG.items = Array.isArray(v.items) ? v.items : [];
  AG.tareas = Array.isArray(v.tareas) ? v.tareas : [];
  AG.notas = Array.isArray(v.notas) ? v.notas : [];
  AG.cargada = true;
}
async function agGuardar(redibujar = true) {
  AG.items.sort((a, b) => (a.f + (a.h || "")).localeCompare(b.f + (b.h || "")));
  try {
    await admDb().collection("config").doc("agenda").set({ items: AG.items, tareas: AG.tareas, notas: AG.notas });
  } catch (err) {
    toast("No se pudo guardar: " + (err.code || err.message));
  }
  admBadge();
  if (redibujar) agRender();
}
// Lo que toca hoy: fechas de la agenda cuyo aviso ya empezó (también las pasadas sin marcar como hechas) y
// pendientes urgentes o con su fecha límite cumplida
const agTocan = () => AG.items.filter(x => !x.hecho && agDias(x.f) <= (x.r || 0));
const agUrgen = () => AG.tareas.filter(x => !x.hecho && (x.p === "u" || (x.lim && agDias(x.lim) <= 0)));
const agAvisos = () => agTocan().length + agUrgen().length;
// Para el saludo al entrar: cuántos avisos hay (la agenda se lee una vez)
async function admRecordatorios() {
  try {
    if (!AG.cargada) await agLeer();
  } catch (e) {
    return [];
  }
  admBadge();
  return [...agTocan(), ...agUrgen()];
}
// Los vencimientos de las cuentas, como fechas automáticas de la agenda
const agVenc = () =>
  ADM.L.filter(x => !admYo(x) && x.estado === "aprobado" && admMs(x.vence)).map(x => ({
    auto: true,
    id: "v-" + x.id,
    uid: x.id,
    f: agStr(new Date(admMs(x.vence))),
    t: `Vence la cuenta de ${x.nombre || x.correo}`
  }));

const AG_ICO = {
  cal: '<path d="M4 6.5h16v13H4z"/><path d="M4 10h16M8.5 4v4M15.5 4v4"/>',
  lista: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="m4 7 1 1 2-2M4 12l1 1 2-2M4 17l1 1 2-2"/>',
  nota: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
  act: '<path d="M3 12h4l2.5-6 5 12 2.5-6H21"/>',
  ag: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  hoja: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/>'
};
const agIco = k =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AG_ICO[k]}</svg>`;
const agTarjeta = (cls, ico, tit, extra, cuerpo) =>
  `<section class="ap-card ${cls}"><header class="ap-h">${agIco(ico)}<h3>${tit}</h3>${extra || ""}</header>${cuerpo}</section>`;

async function admPanel() {
  ADM.modo = "panel";
  if (!AG.cargada)
    try {
      await agLeer();
      admBadge();
    } catch (e) {}
  if (!AG.mes) {
    const h = new Date();
    AG.mes = new Date(h.getFullYear(), h.getMonth(), 1);
  }
  agRender();
}
function agRender() {
  if (ADM.modo !== "panel" || !admAbierto()) return;
  const h = new Date().getHours(),
    hola = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches",
    nom = ((FICHA && FICHA.nombre) || (USUARIO && USUARIO.displayName) || "").split(" ")[0],
    n = f => ADM.L.filter((ADM_FILTROS.find(x => x[0] === f) || ADM_FILTROS[0])[2]).length,
    kpi = (f, t, cls) =>
      `<button type="button" class="ap-kpi ${cls}${n(f) ? "" : " cero"}" data-adk="${f}" title="Abrir la hoja: ${t.toLowerCase()}"><b>${n(f)}</b>${t}</button>`,
    av = agAvisos();
  // Conserva lo que se está escribiendo en el formulario abierto
  const borr = {};
  $("admCuerpo")
    .querySelectorAll(".ap-form [id]")
    .forEach(i => (borr[i.id] = i.value));
  $("admCuerpo").innerHTML =
    `<div class="ap-top"><div class="ap-hola"><b>${hola}${nom ? ", " + esc(nom) : ""}</b><span>${esc(agLarga(agHoy()))}${av ? ` · <em>${av} aviso${av === 1 ? "" : "s"} para hoy</em>` : " · todo al día"}</span></div>` +
    `<div class="ap-kpis">${kpi("pendiente", "Pendientes", "pe")}${kpi("aprobado", "Activas", "ok")}${kpi("porvencer", "Por vencer", "w")}${kpi("vencido", "Vencidas", "bad")}</div>` +
    `<button type="button" class="ap-hoja" data-adk="todos">${agIco("hoja")}Hoja de cuentas</button></div>` +
    `<div class="ap-grid"><div class="ap-colu">${agCal()}${agActividad()}</div>${agAgenda()}<div class="ap-colu">${agTareas()}${agNotas()}</div></div>` +
    `<p class="adm-pie-panel hint">Este panel solo lo ve usted. <button type="button" class="linkbtn" data-adp="cambiarpin">Cambiar PIN</button> · <button type="button" class="linkbtn" data-adp="bloquear">Bloquear</button></p>`;
  Object.entries(borr).forEach(([id, v]) => {
    if ($(id)) $(id).value = v;
  });
}
// Mini calendario: puntos por día (evento, vencimiento de cuenta, pendiente con fecha límite)
function agCal() {
  const m = AG.mes,
    y = m.getFullYear(),
    mo = m.getMonth(),
    hoy = agHoy(),
    marcas = {},
    pon = (f, c) => (marcas[f] = marcas[f] || new Set()).add(c);
  AG.items.forEach(x => pon(x.f, x.hecho ? "hecho" : "ev"));
  agVenc().forEach(x => pon(x.f, "venc"));
  AG.tareas.forEach(x => x.lim && !x.hecho && pon(x.lim, "ta"));
  const ini = (new Date(y, mo, 1).getDay() + 6) % 7,
    nd = new Date(y, mo + 1, 0).getDate();
  let c = "";
  for (let i = 0; i < ini; i++) c += `<span></span>`;
  for (let d = 1; d <= nd; d++) {
    const s = agStr(new Date(y, mo, d)),
      M = [...(marcas[s] || [])],
      fin = (ini + d - 1) % 7 >= 5;
    c += `<button type="button" class="ap-d${s === hoy ? " hoy" : ""}${s === AG.sel ? " sel" : ""}${fin ? " fin" : ""}${M.length ? " con" : ""}${s < hoy ? " pas" : ""}" data-agd="${s}" title="${esc(agLarga(s))}">${d}<i>${M.map(k => `<u class="${k}"></u>`).join("")}</i></button>`;
  }
  return agTarjeta(
    "ap-cal",
    "cal",
    `${AG_MESES[mo]} ${y}`,
    `<span class="ap-nav"><button type="button" data-agm="-1" aria-label="Mes anterior">‹</button><button type="button" data-agm="0">Hoy</button><button type="button" data-agm="1" aria-label="Mes siguiente">›</button></span>`,
    `<div class="ap-sem">${["L", "M", "M", "J", "V", "S", "D"].map(x => `<span>${x}</span>`).join("")}</div><div class="ap-mes">${c}</div><div class="ap-ley"><span><u class="ev"></u>Evento</span><span><u class="ta"></u>Pendiente</span><span><u class="venc"></u>Vence cuenta</span></div>`
  );
}
// Agenda: el día elegido o agrupada (atrasado, hoy, mañana, esta semana, próximamente)
function agAgenda() {
  const toca = new Set(agTocan().map(x => x.id)),
    todos = [...AG.items, ...agVenc()],
    item = x =>
      `<div class="ap-ev${x.auto ? " auto" : ""}${x.hecho ? " hecho" : ""}${toca.has(x.id) ? " toca" : ""}"><span class="ap-hr">${x.h ? esc(x.h) : AG.sel ? "" : `${agFecha(x.f).getDate()} ${AG_MESES[agFecha(x.f).getMonth()].slice(0, 3)}`}</span><div class="ap-tx"><b>${esc(x.t)}</b><small>${[
        AG.sel || !x.h ? "" : `${agFecha(x.f).getDate()} ${AG_MESES[agFecha(x.f).getMonth()].slice(0, 3)}`,
        x.n ? esc(x.n) : "",
        x.auto ? "" : toca.has(x.id) ? "⏰ aviso activo" : ""
      ]
        .filter(Boolean)
        .join(" · ")}</small></div><span class="ap-acc">${
        x.auto
          ? `<button type="button" data-agv="${x.uid}" title="Ver la cuenta">Ver</button>`
          : `<button type="button" data-agh="${x.id}" title="${x.hecho ? "Marcar como pendiente" : "Marcar como hecho"}">${x.hecho ? "↺" : "✓"}</button><button type="button" data-agx="${x.id}" title="Eliminar">×</button>`
      }</span></div>`;
  let cuerpo = "";
  if (AG.sel) {
    const L = todos.filter(x => x.f === AG.sel).sort((a, b) => (a.h || "").localeCompare(b.h || ""));
    cuerpo = `<div class="ap-grupo"><h4>${esc(agLarga(AG.sel))} <button type="button" class="linkbtn" data-agd="${AG.sel}">ver todo</button></h4>${L.map(item).join("") || `<p class="ap-vacio">Nada anotado para este día.</p>`}</div>`;
  } else {
    const G = [
      ["Atrasado", x => !x.auto && !x.hecho && agDias(x.f) < 0, "bad"],
      ["Hoy", x => agDias(x.f) === 0, "hoy"],
      ["Mañana", x => agDias(x.f) === 1, ""],
      ["Esta semana", x => agDias(x.f) >= 2 && agDias(x.f) <= 7, ""],
      ["Próximamente", x => agDias(x.f) >= 8 && agDias(x.f) <= 60, ""]
    ];
    cuerpo = G.map(([t, f, cls]) => {
      const L = todos
        .filter(x => f(x) && !(x.hecho && agDias(x.f) < 0))
        .sort((a, b) => (a.f + (a.h || "")).localeCompare(b.f + (b.h || "")));
      return L.length
        ? `<div class="ap-grupo ${cls}"><h4>${t} <span>${L.length}</span></h4>${L.slice(0, 8).map(item).join("")}</div>`
        : "";
    }).join("");
    if (!cuerpo)
      cuerpo = `<p class="ap-vacio">Sin fechas próximas. Pulse «+ Evento» o elija un día del calendario.</p>`;
  }
  const form =
    AG.form === "ev"
      ? `<form class="ap-form" data-agf="ev"><input id="agT" maxlength="120" placeholder="Qué: entrega del expediente, reunión…" required><div class="ap-f3"><input type="date" id="agF" value="${AG.sel || agHoy()}" required title="Fecha"><input type="time" id="agH" title="Hora (opcional)"><select id="agR" title="Cuándo avisarme">${AG_REC.map(([k, t]) => `<option value="${k}"${k === 1 ? " selected" : ""}>Avisar: ${t.toLowerCase()}</option>`).join("")}</select></div><input id="agN" maxlength="300" placeholder="Nota (opcional)"><div class="ap-fb"><button type="button" class="linkbtn" data-apf="">Cancelar</button><button type="submit" class="btn sm">Guardar</button></div></form>`
      : "";
  return agTarjeta(
    "ap-agenda",
    "ag",
    "Agenda",
    `<button type="button" class="ap-mas" data-apf="ev">+ Evento</button>`,
    form + `<div class="ap-lista" id="agLista">${cuerpo}</div>`
  );
}
// Pendientes: urgentes primero, luego por fecha límite
function agTareas() {
  const hechas = AG.tareas.filter(x => x.hecho),
    L = AG.tareas
      .filter(x => AG.hechas || !x.hecho)
      .sort(
        (a, b) =>
          (a.hecho ? 1 : 0) - (b.hecho ? 1 : 0) ||
          AG_PRI[a.p || "n"][1] - AG_PRI[b.p || "n"][1] ||
          (a.lim || "9999").localeCompare(b.lim || "9999")
      ),
    item = x => {
      const d = x.lim ? agDias(x.lim) : null;
      return `<div class="ap-ta p-${x.p || "n"}${x.hecho ? " hecho" : ""}"><button type="button" class="ap-chk" data-ath="${x.id}" aria-label="${x.hecho ? "Marcar como pendiente" : "Marcar como hecho"}">${x.hecho ? "✓" : ""}</button><div class="ap-tx"><b>${esc(x.t)}</b><small><span class="ap-pri">${AG_PRI[x.p || "n"][0]}</span>${x.lim ? `<span class="${!x.hecho && d < 0 ? "bad" : !x.hecho && d <= 1 ? "w" : ""}">${d < 0 ? `atrasado ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "límite hoy" : `límite ${agCuando(x.lim)}`}</span>` : ""}</small></div><span class="ap-acc"><button type="button" data-atx="${x.id}" title="Eliminar">×</button></span></div>`;
    };
  return agTarjeta(
    "ap-tareas",
    "lista",
    "Pendientes",
    `<span class="ap-cnt">${AG.tareas.length - hechas.length}</span>`,
    `<form class="ap-form ap-rap" data-agf="ta"><input id="taT" maxlength="160" placeholder="Nueva tarea y Enter…" required><select id="taP" title="Prioridad"><option value="u">Urgente</option><option value="a">Alta</option><option value="n" selected>Normal</option></select><input type="date" id="taL" title="Fecha límite (opcional)"><button type="submit" class="btn sm" aria-label="Agregar">+</button></form>` +
      `<div class="ap-lista">${L.map(item).join("") || `<p class="ap-vacio">Sin pendientes. ¡Bien hecho! 🎉</p>`}</div>` +
      (hechas.length
        ? `<button type="button" class="linkbtn ap-ver" data-ahe>${AG.hechas ? "Ocultar" : "Mostrar"} hechas (${hechas.length})</button>${AG.hechas ? ` · <button type="button" class="linkbtn ap-ver" data-ahl>Borrar las hechas</button>` : ""}`
        : "")
  );
}
// Notas de colores: las fijadas primero; se editan en el mismo papel
function agNotas() {
  const L = [...AG.notas].sort((a, b) => (b.fij ? 1 : 0) - (a.fij ? 1 : 0) || (b.ts || 0) - (a.ts || 0));
  return agTarjeta(
    "ap-notas",
    "nota",
    "Notas",
    `<button type="button" class="ap-mas" data-anu>+ Nota</button>`,
    `<div class="ap-papeles">${
      L.map(
        x =>
          `<div class="ap-papel ${x.c || "amarillo"}${x.fij ? " fij" : ""}" data-nid="${x.id}"><div class="ap-pb">${AG_COLORES.map(c => `<button type="button" class="ap-col ${c}${c === (x.c || "amarillo") ? " on" : ""}" data-anc="${c}" aria-label="Color ${c}"></button>`).join("")}<span></span><button type="button" data-anf title="${x.fij ? "Desfijar" : "Fijar arriba"}">${x.fij ? "📌" : "📍"}</button><button type="button" data-anx title="Eliminar">×</button></div><textarea data-ant maxlength="1000" placeholder="Escriba aquí…" rows="4">${esc(x.t || "")}</textarea></div>`
      ).join("") || `<p class="ap-vacio">Ideas, datos de clientes, recordatorios sueltos… Pulse «+ Nota».</p>`
    }</div>`
  );
}
// Actividad de las cuentas: solicitudes por revisar, ingresos recientes y los próximos vencimientos
function agActividad() {
  const A = [
    ...ADM.L.filter(x => x.estado === "pendiente").map(x => ({
      t: admMs(x.creado) || 0,
      x,
      ico: "pe",
      txt: `<b>${esc(x.nombre || x.correo)}</b> pidió una cuenta`
    })),
    ...ADM.L.filter(x => admMs(x.ultimo) && !admYo(x)).map(x => ({
      t: admMs(x.ultimo),
      x,
      ico: "ok",
      txt: `<b>${esc(x.nombre || x.correo)}</b> ingresó`
    }))
  ]
    .sort((a, b) => b.t - a.t)
    .slice(0, 7);
  return agTarjeta(
    "ap-activ",
    "act",
    "Actividad de las cuentas",
    "",
    `<div class="ap-lista">${
      A.map(
        a =>
          `<button type="button" class="ap-act ${a.ico}" data-agv="${a.x.id}"><u></u><span>${a.txt}</span><small>${a.t ? agHace(a.t) : ""}</small></button>`
      ).join("") || `<p class="ap-vacio">Aún sin actividad registrada. Los ingresos se anotan desde esta versión.</p>`
    }</div>`
  );
}
// Clics del panel
$("admCuerpo").addEventListener("click", e => {
  const t = e.target,
    q = s => t.closest(s);
  if (q("[data-adk]")) return admVentana(q("[data-adk]").dataset.adk);
  if (q("[data-agm]")) {
    const d = +q("[data-agm]").dataset.agm,
      h = new Date();
    AG.mes = d ? new Date(AG.mes.getFullYear(), AG.mes.getMonth() + d, 1) : new Date(h.getFullYear(), h.getMonth(), 1);
    if (!d) AG.sel = agHoy();
    return agRender();
  }
  if (q("[data-agd]")) {
    const s = q("[data-agd]").dataset.agd;
    AG.sel = AG.sel === s ? null : s;
    return agRender();
  }
  if (q("[data-apf]")) {
    AG.form = q("[data-apf]").dataset.apf;
    agRender();
    if ($("agT")) $("agT").focus();
    return;
  }
  if (q("[data-agh]")) {
    const x = AG.items.find(i => i.id === q("[data-agh]").dataset.agh);
    if (x) x.hecho = !x.hecho;
    return agGuardar();
  }
  if (q("[data-agx]")) {
    const x = AG.items.find(i => i.id === q("[data-agx]").dataset.agx);
    if (!x) return;
    return confirmar(
      "Eliminar evento",
      `<p>¿Eliminar «${esc(x.t)}» del ${esc(agLarga(x.f))}?</p>`,
      "Eliminar",
      ok => {
        if (!ok) return;
        AG.items = AG.items.filter(i => i !== x);
        agGuardar();
      },
      "Agenda"
    );
  }
  if (q("[data-agv]")) {
    const u = ADM.L.find(x => x.id === q("[data-agv]").dataset.agv);
    return admVentana("todos", u ? u.correo : "");
  }
  if (q("[data-ath]")) {
    const x = AG.tareas.find(i => i.id === q("[data-ath]").dataset.ath);
    if (x) x.hecho = !x.hecho;
    return agGuardar();
  }
  if (q("[data-atx]")) {
    AG.tareas = AG.tareas.filter(i => i.id !== q("[data-atx]").dataset.atx);
    return agGuardar();
  }
  if (q("[data-ahe]")) {
    AG.hechas = !AG.hechas;
    return agRender();
  }
  if (q("[data-ahl]")) {
    AG.tareas = AG.tareas.filter(i => !i.hecho);
    AG.hechas = false;
    return agGuardar();
  }
  if (q("[data-anu]")) {
    const x = { id: "n" + agId(), t: "", c: "amarillo", fij: false, ts: Date.now() };
    AG.notas.unshift(x);
    agRender();
    agGuardar(false);
    const ta = $("admCuerpo").querySelector(`[data-nid="${x.id}"] textarea`);
    if (ta) ta.focus();
    return;
  }
  const papel = q("[data-nid]");
  if (papel) {
    const x = AG.notas.find(i => i.id === papel.dataset.nid);
    if (!x) return;
    if (q("[data-anc]")) {
      x.c = q("[data-anc]").dataset.anc;
      return agGuardar();
    }
    if (q("[data-anf]")) {
      x.fij = !x.fij;
      return agGuardar();
    }
    if (q("[data-anx]")) {
      if (!x.t.trim()) {
        AG.notas = AG.notas.filter(i => i !== x);
        return agGuardar();
      }
      return confirmar(
        "Eliminar nota",
        `<p>¿Eliminar esta nota?</p><p class="hint">${esc(x.t.slice(0, 140))}${x.t.length > 140 ? "…" : ""}</p>`,
        "Eliminar",
        ok => {
          if (!ok) return;
          AG.notas = AG.notas.filter(i => i !== x);
          agGuardar();
        },
        "Notas"
      );
    }
  }
});
// Formularios: evento y tarea
$("admCuerpo").addEventListener("submit", e => {
  const f = e.target.closest("[data-agf]");
  if (!f) return;
  e.preventDefault();
  if (f.dataset.agf === "ev") {
    const t = $("agT").value.trim(),
      fe = $("agF").value;
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(fe)) return;
    AG.items.push({
      id: "a" + agId(),
      f: fe,
      h: $("agH").value || "",
      t: t.slice(0, 120),
      n: $("agN").value.trim().slice(0, 300),
      r: +$("agR").value || 0,
      hecho: false
    });
    AG.form = "";
    AG.sel = fe;
    AG.mes = new Date(agFecha(fe).getFullYear(), agFecha(fe).getMonth(), 1);
    toast(`Evento guardado: ${t} (${agCuando(fe)})`);
    $("agT").value = "";
    return agGuardar();
  }
  if (f.dataset.agf === "ta") {
    const t = $("taT").value.trim();
    if (!t) return;
    AG.tareas.push({
      id: "t" + agId(),
      t: t.slice(0, 160),
      p: $("taP").value,
      lim: $("taL").value || "",
      hecho: false
    });
    $("taT").value = "";
    $("taL").value = "";
    agGuardar();
    if ($("taT")) $("taT").focus();
  }
});
// Notas: el texto se guarda al dejar de escribir (sin redibujar, para no perder el cursor)
let AG_NT = null;
$("admCuerpo").addEventListener("input", e => {
  const ta = e.target.closest("[data-ant]");
  if (!ta) return;
  const x = AG.notas.find(i => i.id === ta.closest("[data-nid]").dataset.nid);
  if (!x) return;
  x.t = ta.value;
  x.ts = Date.now();
  clearTimeout(AG_NT);
  AG_NT = setTimeout(() => agGuardar(false), 800);
});

/* ---------- Nueva cuenta ---------- */
const admClaveAzar = () => {
  const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    r = crypto.getRandomValues(new Uint8Array(10));
  return [...r].map(n => a[n % a.length]).join("");
};
function admNueva(aviso, prev = {}) {
  confirmar(
    "Nueva cuenta",
    (aviso ? `<p class="acc-msg bad">${esc(aviso)}</p>` : "") +
      `<p>La cuenta queda aprobada al instante. Entregue a la persona su correo y la contraseña; luego ella puede cambiarla en el menú de su cuenta.</p><div class="acc-form adm-nueva"><label>Nombre completo<input id="anNom" value="${esc(prev.nom || "")}" autocomplete="off"></label><label>Correo electrónico<input type="email" id="anCor" value="${esc(prev.cor || "")}" autocomplete="off"></label><label>Contraseña inicial<span class="adm-gen"><input type="password" id="anCla" value="${esc(prev.cla || "")}" autocomplete="new-password" minlength="6"><button type="button" class="btn sm sec" data-angen>Generar</button></span></label><div class="acc-2"><label>Uso<select id="anUso">${USOS_CUENTA.map(u => `<option${u === prev.uso ? " selected" : ""}>${esc(u)}</option>`).join("")}</select></label><label>Vigencia<select id="anVig">${VIGENCIAS.map(([k, t]) => `<option value="${k}"${k === (prev.vig ?? "") ? " selected" : ""}>${t}</option>`).join("")}</select></label></div></div>`,
    "Crear cuenta",
    ok => {
      if (!ok) return;
      const d = {
        nom: $("anNom").value.trim(),
        cor: $("anCor").value.trim().toLowerCase(),
        cla: $("anCla").value,
        uso: $("anUso").value,
        vig: $("anVig").value
      };
      if (!d.nom) return admNueva("Escriba el nombre.", d);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.cor)) return admNueva("Escriba un correo válido.", d);
      if (d.cla.length < 6) return admNueva("La contraseña debe tener al menos 6 caracteres.", d);
      admCrear(d);
    },
    "Administración"
  );
  setTimeout(() => {
    ponerOjos($("cfmTxt"));
    $("anNom").focus();
  }, 40);
}
$("cfmTxt").addEventListener("click", e => {
  if (!e.target.closest("[data-angen]")) return;
  const i = $("anCla");
  i.value = admClaveAzar();
  if (i.type === "password") i.nextSibling.click();
});
async function admCrear(d) {
  toast("Creando la cuenta…");
  let app2;
  try {
    // Segunda instancia: crear la cuenta no cambia la sesión del administrador
    app2 = firebase.apps.find(a => a.name === "altas") || firebase.initializeApp(FB_CONFIG, "altas");
    await app2.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
    const cr = await app2.auth().createUserWithEmailAndPassword(d.cor, d.cla),
      uid = cr.user.uid;
    await app2.auth().signOut();
    const v = d.vig;
    await admRef(uid).set({
      nombre: d.nom,
      correo: d.cor,
      uso: d.uso,
      estado: "aprobado",
      vigencia: v,
      vence: v ? firebase.firestore.Timestamp.fromDate(admVence(Date.now(), v)) : null,
      creado: firebase.firestore.FieldValue.serverTimestamp(),
      revisado: firebase.firestore.FieldValue.serverTimestamp(),
      creadoPor: "admin"
    });
    confirmar(
      "Cuenta creada",
      `<p>Entregue estos datos a <b>${esc(d.nom)}</b>. Por seguridad, la contraseña no se vuelve a mostrar.</p><div class="adm-datos"><div><span>Página</span><b>${esc(location.origin + location.pathname)}</b></div><div><span>Correo</span><b>${esc(d.cor)}</b></div><div><span>Contraseña</span><b>${esc(d.cla)}</b></div></div>`,
      "Copiar los datos",
      ok => {
        if (ok && navigator.clipboard)
          navigator.clipboard
            .writeText(
              `JMG-ELECTRIC\nPágina: ${location.origin + location.pathname}\nCorreo: ${d.cor}\nContraseña: ${d.cla}\n(Puede cambiar la contraseña en el menú de su cuenta.)`
            )
            .then(() => toast("Datos copiados."));
      },
      "Administración"
    );
  } catch (err) {
    if (app2)
      try {
        await app2.auth().signOut();
      } catch (_) {}
    const c = (err && err.code) || "";
    admNueva(
      c === "auth/email-already-in-use"
        ? "Ya existe una cuenta con ese correo: búsquela en la lista (si no figura, la persona puede solicitarla desde la pantalla de ingreso)."
        : c === "auth/invalid-email"
          ? "El correo no es válido."
          : c === "auth/weak-password"
            ? "La contraseña debe tener al menos 6 caracteres."
            : c === "permission-denied"
              ? "La cuenta se creó, pero Firebase no dejó guardar su ficha: falta pegar las reglas nuevas de Firestore."
              : "No se pudo crear la cuenta" + (c ? ` (${c})` : "") + ".",
      d
    );
  }
}

/* ---------- Exportar a Excel ---------- */
async function admExcel() {
  const F = admFilas(),
    fila = x => [
      x.nombre || "",
      x.correo || "",
      x.uso || "",
      admMs(x.creado) ? new Date(admMs(x.creado)) : "",
      (ADM_ESTADOS[admEstado(x)] || [admEstado(x)])[0],
      (VIGENCIAS.find(v => v[0] === (x.vigencia || "")) || ["", ""])[1],
      admMs(x.vence) ? new Date(admMs(x.vence)) : "",
      admMs(x.ultimo) ? new Date(admMs(x.ultimo)) : "",
      x.notas || ""
    ],
    cab = ["Nombre", "Correo", "Uso", "Solicitud", "Estado", "Vigencia", "Vence", "Último ingreso", "Notas"],
    nombre = `JMG-ELECTRIC - Cuentas - ${new Date().toISOString().slice(0, 10)}.xlsx`;
  if (typeof ExcelJS === "undefined") return toast("No se cargó la librería de Excel. Verifique la conexión.");
  const wb = new ExcelJS.Workbook(),
    ws = wb.addWorksheet("Cuentas", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(cab);
  F.forEach(x => ws.addRow(fila(x)));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14304F" } };
  [26, 32, 24, 13, 14, 12, 13, 16, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  [4, 7, 8].forEach(c => (ws.getColumn(c).numFmt = "dd/mm/yyyy"));
  ws.autoFilter = { from: "A1", to: "I1" };
  const blob = new Blob([await wb.xlsx.writeBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  try {
    if (typeof downloads !== "undefined" && downloads) await downloads.save({ filename: nombre, data: blob });
    else descargarLocal(blob, nombre);
  } catch (e) {}
}
