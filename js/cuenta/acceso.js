/* ACCESO CON CUENTA (Firebase Authentication + Firestore)
   Pantalla de ingreso, solicitud de cuenta, aprobación por el administrador (sección Administración),
   menú de la cuenta con su foto y saludo personal del administrador. La solicitud queda «pendiente» en
   usuarios/{uid}; las reglas de seguridad (consola de Firebase › Firestore › Reglas) impiden que un usuario
   se apruebe a sí mismo y solo dejan aprobar al correo del administrador. */
const FB_CONFIG = {
  apiKey: "AIzaSyCMH5sUD_-NXUv3WYfPGVgS2rE07prOenM",
  authDomain: "jmg-electric-c3904.firebaseapp.com",
  projectId: "jmg-electric-c3904",
  storageBucket: "jmg-electric-c3904.firebasestorage.app",
  messagingSenderId: "603207915758",
  appId: "1:603207915758:web:7e3f53efd5a6041a81fbff"
};
const ADMIN_CORREO = "jorgemiguel16621@gmail.com";
const USOS_CUENTA = ["Estudiante de ingeniería", "Ingeniero proyectista", "Docente", "Técnico electricista", "Otro"];
let USUARIO = null,
  FICHA = null,
  esAdminCuenta = false,
  desFicha = null,
  desAdmin = null,
  SALUDADO = false,
  BIENVENIDO = false,
  INGRESO = false;

const ACC = $("acceso"),
  accVista = v => {
    ACC.querySelectorAll("[data-av]").forEach(x => (x.hidden = x.dataset.av !== v));
    const m = $("accMsg");
    m.textContent = "";
    m.className = "acc-msg";
  };
const accMsg = (t, ok) => {
  const m = $("accMsg");
  m.textContent = t;
  m.className = "acc-msg " + (ok ? "ok" : "bad");
};
const accOcupado = b => ACC.querySelectorAll("button").forEach(x => (x.disabled = b));
/* Una cuenta creada con «Continuar con Google» no tiene contraseña propia (la de Gmail no sirve aquí): se crea en
   Mi cuenta › Crear contraseña, o con «¿Olvidó su contraseña?» */
const CLAVE_MAL =
  "Correo o contraseña incorrectos. Si su cuenta la creó con «Continuar con Google», ingrese con ese botón: la contraseña de Gmail no sirve aquí. Para ingresar también con su correo, cree una contraseña en el menú de su cuenta (arriba a la derecha) › Crear contraseña, o pulse «¿Olvidó su contraseña?».";
function accError(e) {
  const c = (e && e.code) || "",
    T = {
      "auth/invalid-credential": CLAVE_MAL,
      "auth/wrong-password": CLAVE_MAL,
      "auth/user-not-found": "No existe una cuenta con ese correo.",
      "auth/invalid-email": "El correo no es válido.",
      "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Ingrese con él o recupere su contraseña.",
      "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
      "auth/too-many-requests": "Demasiados intentos. Espere unos minutos e intente de nuevo.",
      "auth/network-request-failed": "Sin conexión a internet. Revise su conexión e intente de nuevo.",
      "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de terminar.",
      "auth/cancelled-popup-request": "Se cerró la ventana de Google antes de terminar.",
      "auth/popup-blocked":
        "El navegador bloqueó la ventana de Google. Permita las ventanas emergentes para esta página.",
      "auth/unauthorized-domain": "Este sitio no está autorizado para ingresar. Avise al administrador.",
      "permission-denied": "No tiene permiso para esta acción."
    };
  accMsg(T[c] || "No se pudo completar la acción" + (c ? ` (${c})` : "") + ".");
}
let ENTRO = false;
function abrirPlataforma(v) {
  document.body.classList.toggle("sin-acceso", !v);
  ACC.hidden = !!v;
  if (v && !ENTRO) {
    ENTRO = true;
    setTab("inicio");
  }
  if (!v) ENTRO = false;
}
function cuentaUI() {
  const u = USUARIO,
    nom = (FICHA && FICHA.nombre) || (u && u.displayName) || "";
  $("cuNombre").textContent = nom || "Mi cuenta";
  $("cuCorreo").textContent = u ? u.email : "";
  // Foto de la cuenta de Google; si no hay (correo y contraseña) o no carga, la inicial del nombre
  const av = $("cuAvatar"),
    ini = (nom || (u && u.email) || "?").trim().charAt(0).toUpperCase();
  av.hidden = !u;
  av.textContent = ini;
  av.classList.remove("foto");
  if (u && u.photoURL) {
    const im = new Image();
    im.alt = "";
    im.referrerPolicy = "no-referrer";
    im.onload = () => {
      av.textContent = "";
      av.appendChild(im);
      av.classList.add("foto");
    };
    im.src = u.photoURL;
  }
  $("cuBtn").classList.toggle("con-av", !!u);
  // Crear contraseña (cuenta solo con Google) o cambiarla
  $("cuClaveBtn").hidden = !u;
  $("cuClaveTxt").textContent = u && !cuTieneClave(u) ? "Crear contraseña" : "Cambiar contraseña";
  document.querySelectorAll(".solo-admin").forEach(x => (x.hidden = !esAdminCuenta));
}

let ULTIMO_ESCRITO = false;
const fichaVencida = F => !!(F && F.vence && typeof F.vence.toMillis === "function" && F.vence.toMillis() < Date.now());
// Una sesión abierta cuya vigencia vence mientras se usa la plataforma: se revisa cada 10 minutos
setInterval(() => {
  if (USUARIO && !esAdminCuenta && FICHA && FICHA.estado === "aprobado" && fichaVencida(FICHA)) {
    if (typeof nubeDetener === "function") nubeDetener();
    $("vencFecha").textContent = new Date(FICHA.vence.toMillis()).toLocaleDateString("es-PE");
    accVista("vencido");
    abrirPlataforma(false);
  }
}, 600000);
/* Estado de la cuenta: se escucha en vivo para que la aprobación abra la plataforma sin recargar */
function seguirFicha(u) {
  if (desFicha) {
    desFicha();
    desFicha = null;
  }
  desFicha = firebase
    .firestore()
    .collection("usuarios")
    .doc(u.uid)
    .onSnapshot(
      s => {
        FICHA = s.exists ? s.data() : null;
        cuentaUI();
        if (esAdminCuenta) {
          abrirPlataforma(true);
          if (typeof nubeIniciar === "function") nubeIniciar(u);
          return;
        }
        if (!FICHA) {
          $("solNombre").value = u.displayName || "";
          accVista("completar");
          abrirPlataforma(false);
          return;
        }
        // Aprobada, pero con su vigencia vencida: no entra (el administrador la renueva)
        if (FICHA.estado === "aprobado" && fichaVencida(FICHA)) {
          if (typeof nubeDetener === "function") nubeDetener();
          $("vencFecha").textContent = new Date(FICHA.vence.toMillis()).toLocaleDateString("es-PE", {
            day: "numeric",
            month: "long",
            year: "numeric"
          });
          accVista("vencido");
          abrirPlataforma(false);
          return;
        }
        if (FICHA.estado === "aprobado") {
          abrirPlataforma(true);
          // Último ingreso (una vez por visita), para la hoja del administrador
          if (!ULTIMO_ESCRITO) {
            ULTIMO_ESCRITO = true;
            firebase
              .firestore()
              .collection("usuarios")
              .doc(u.uid)
              .update({ ultimo: firebase.firestore.FieldValue.serverTimestamp() })
              .catch(() => {});
          }
          // Sus proyectos en la nube (js/cuenta/nube.js)
          if (typeof nubeIniciar === "function") nubeIniciar(u);
          // Bienvenida formal cada vez que la persona inicia sesión (y la primera vez en este navegador);
          // al recargar con la sesión guardada no se repite. El administrador recibe su saludo personal.
          const clave = "jmg-electric-bienvenida-" + u.uid;
          let vista = false;
          try {
            vista = !!localStorage.getItem(clave);
          } catch (_) {}
          if (!BIENVENIDO && (INGRESO || !vista)) {
            BIENVENIDO = true;
            try {
              localStorage.setItem(clave, "1");
            } catch (_) {}
            setTimeout(() => bienvenida(true), 300);
          }
          return;
        }
        if (typeof nubeDetener === "function") nubeDetener();
        $("pendCorreo").textContent = u.email;
        accVista(FICHA.estado === "pendiente" ? "pendiente" : "denegado");
        abrirPlataforma(false);
      },
      e => {
        accVista("ingreso");
        accError(e);
        abrirPlataforma(false);
      }
    );
}
function iniciarAcceso() {
  if (typeof firebase === "undefined") {
    accVista("ingreso");
    accMsg("No se pudo cargar el servicio de acceso. Revise su conexión a internet y recargue la página.");
    return;
  }
  firebase.initializeApp(FB_CONFIG);
  firebase.auth().languageCode = "es";
  firebase.auth().onAuthStateChanged(accSesion);
}
/* La cuenta del administrador se reconoce por su correo verificado (como en las reglas de Firestore): con Google
   suele estarlo; con correo y contraseña, solo después de abrir el enlace de verificación. Mientras no lo esté, se
   le pide verificarlo (y no se la trata como una solicitud nueva). */
function accSesion(u) {
  USUARIO = u;
  esAdminCuenta = !!(u && u.email === ADMIN_CORREO && u.emailVerified);
  cuentaUI();
  if (u && u.email === ADMIN_CORREO && !esAdminCuenta) {
    if (desFicha) {
      desFicha();
      desFicha = null;
    }
    $("verCorreo").textContent = u.email;
    accVista("verificar");
    abrirPlataforma(false);
    return;
  }
  if (!u) {
    if (desFicha) {
      desFicha();
      desFicha = null;
    }
    if (desAdmin) {
      desAdmin();
      desAdmin = null;
    }
    FICHA = null;
    if (typeof nubeDetener === "function") nubeDetener();
    accVista("ingreso");
    abrirPlataforma(false);
    return;
  }
  seguirFicha(u);
  if (esAdminCuenta) adminLista();
}

/* Formularios de la pantalla de ingreso */
ACC.addEventListener("click", async e => {
  const b = e.target.closest("[data-aa]");
  if (!b) return;
  const a = b.dataset.aa;
  if (a === "ver-registro") {
    accVista("registro");
    return;
  }
  if (a === "ver-ingreso") {
    accVista("ingreso");
    return;
  }
  if (a === "salir") {
    firebase.auth().signOut();
    return;
  }
  // Correo del administrador sin verificar: enviar el enlace y, ya abierto, volver a leer la cuenta
  if (a === "verificar" && USUARIO) {
    accOcupado(true);
    try {
      await USUARIO.sendEmailVerification();
      accMsg(`Le enviamos el enlace a ${USUARIO.email}. Ábralo y luego pulse «Ya lo verifiqué».`, true);
    } catch (err) {
      accError(err);
    }
    accOcupado(false);
    return;
  }
  if (a === "verificado" && USUARIO) {
    accOcupado(true);
    try {
      await USUARIO.reload();
      const u = firebase.auth().currentUser;
      if (u && u.emailVerified) {
        // Credencial nueva, con el correo verificado, para las reglas de Firestore
        await u.getIdToken(true);
        accSesion(u);
      } else accMsg("Todavía figura sin verificar. Abra el enlace del correo y vuelva a pulsar «Ya lo verifiqué».");
    } catch (err) {
      accError(err);
    }
    accOcupado(false);
    return;
  }
  if (a === "google") {
    accOcupado(true);
    try {
      INGRESO = true;
      await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (err) {
      accError(err);
    }
    accOcupado(false);
    return;
  }
  if (a === "olvido") {
    const c = $("accCorreo").value.trim();
    if (!c) {
      accMsg("Escriba su correo arriba y vuelva a pulsar «¿Olvidó su contraseña?».");
      return;
    }
    try {
      await firebase.auth().sendPasswordResetEmail(c);
      accMsg(`Le enviamos un correo a ${c} para cambiar su contraseña. Revise también la carpeta de spam.`, true);
    } catch (err) {
      accError(err);
    }
    return;
  }
});
$("accFormIngreso").addEventListener("submit", async e => {
  e.preventDefault();
  accOcupado(true);
  try {
    INGRESO = true;
    await firebase.auth().signInWithEmailAndPassword($("accCorreo").value.trim(), $("accClave").value);
  } catch (err) {
    accError(err);
  }
  accOcupado(false);
});
const fichaNueva = (u, nombre, uso) =>
  firebase.firestore().collection("usuarios").doc(u.uid).set({
    nombre,
    correo: u.email,
    uso,
    estado: "pendiente",
    creado: firebase.firestore.FieldValue.serverTimestamp()
  });
$("accFormRegistro").addEventListener("submit", async e => {
  e.preventDefault();
  const nombre = $("regNombre").value.trim(),
    correo = $("regCorreo").value.trim(),
    c1 = $("regClave").value,
    c2 = $("regClave2").value,
    uso = $("regUso").value;
  if (nombre.length < 3) {
    accMsg("Escriba su nombre completo.");
    return;
  }
  if (c1 !== c2) {
    accMsg("Las contraseñas no coinciden.");
    return;
  }
  accOcupado(true);
  try {
    INGRESO = true;
    const cr = await firebase.auth().createUserWithEmailAndPassword(correo, c1);
    await cr.user.updateProfile({ displayName: nombre });
    await fichaNueva(cr.user, nombre, uso);
    cr.user.sendEmailVerification().catch(() => {});
  } catch (err) {
    accError(err);
  }
  accOcupado(false);
});
$("accFormCompletar").addEventListener("submit", async e => {
  e.preventDefault();
  const nombre = $("solNombre").value.trim();
  if (nombre.length < 3) {
    accMsg("Escriba su nombre completo.");
    return;
  }
  accOcupado(true);
  try {
    await fichaNueva(USUARIO, nombre, $("solUso").value);
  } catch (err) {
    accError(err);
  }
  accOcupado(false);
});
["regUso", "solUso"].forEach(id => ($(id).innerHTML = USOS_CUENTA.map(t => `<option>${t}</option>`).join("")));

/* Menú de la cuenta (barra superior) */
$("cuBtn").addEventListener("click", e => {
  e.stopPropagation();
  $("cuMenu").hidden = !$("cuMenu").hidden;
});
addEventListener("click", e => {
  if (!e.target.closest("#cuMenu")) $("cuMenu").hidden = true;
});
$("cuMenu").addEventListener("click", e => {
  const b = e.target.closest("[data-cu]");
  if (!b) return;
  $("cuMenu").hidden = true;
  if (b.dataset.cu === "clave") return cuClave();
  if (b.dataset.cu === "salir") {
    if (document.body.classList.contains("ws-on")) cerrarWS(true);
    firebase.auth().signOut();
  }
});

const cuTieneClave = u => !!(u && u.providerData.some(p => p && p.providerId === "password"));
/* Crear o cambiar la contraseña de la cuenta. Sin contraseña (cuenta de Google), se le agrega el ingreso con correo y
   contraseña a la misma cuenta (linkWithCredential): sigue siendo una sola cuenta, con sus proyectos */
function cuClave(aviso) {
  const u = USUARIO;
  if (!u) return;
  const tiene = cuTieneClave(u);
  confirmar(
    tiene ? "Cambiar contraseña" : "Crear contraseña",
    `<p>${tiene ? "Escriba su nueva contraseña." : `Su cuenta ingresa con Google. Cree una contraseña para ingresar también con su correo <b>${esc(u.email)}</b>; es una sola cuenta, con los mismos proyectos.`}</p>` +
      (aviso ? `<p class="acc-msg bad">${esc(aviso)}</p>` : "") +
      `<div class="acc-form cu-clave"><label>Nueva contraseña<input type="password" id="cuClave1" autocomplete="new-password" minlength="6"></label><label>Repita la contraseña<input type="password" id="cuClave2" autocomplete="new-password" minlength="6"></label></div>`,
    "Guardar",
    async ok => {
      if (!ok) return;
      const a = $("cuClave1").value,
        b = $("cuClave2").value;
      if (a.length < 6) return cuClave("La contraseña debe tener al menos 6 caracteres.");
      if (a !== b) return cuClave("Las dos contraseñas no coinciden.");
      try {
        if (tiene) await u.updatePassword(a);
        else await u.linkWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, a));
        cuentaUI();
        toast(tiene ? "Contraseña cambiada." : `Listo: ya puede ingresar también con ${u.email} y su contraseña.`);
      } catch (e) {
        const c = (e && e.code) || "";
        cuClave(
          c === "auth/requires-recent-login"
            ? "Por seguridad, cierre sesión, vuelva a ingresar y cree la contraseña enseguida."
            : c === "auth/weak-password"
              ? "La contraseña debe tener al menos 6 caracteres."
              : c === "auth/network-request-failed"
                ? "Sin conexión a internet. Intente de nuevo."
                : "No se pudo guardar la contraseña" + (c ? ` (${c})` : "") + "."
        );
      }
    },
    "Mi cuenta"
  );
  setTimeout(() => {
    ponerOjos($("cfmTxt"));
    $("cuClave1").focus();
  }, 40);
}
/* Ojo en las contraseñas: muestra u oculta lo escrito */
const OJO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  OJO_NO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/></svg>';
function ponerOjos(raiz) {
  raiz.querySelectorAll('input[type="password"]:not([data-ojo])').forEach(inp => {
    inp.dataset.ojo = "1";
    const w = document.createElement("span"),
      b = document.createElement("button");
    w.className = "acc-clave";
    inp.parentNode.insertBefore(w, inp);
    w.appendChild(inp);
    b.type = "button";
    b.className = "acc-ojo";
    b.innerHTML = OJO;
    b.setAttribute("aria-label", "Mostrar la contraseña");
    b.addEventListener("click", e => {
      e.preventDefault();
      const ver = inp.type === "password";
      inp.type = ver ? "text" : "password";
      b.innerHTML = ver ? OJO_NO : OJO;
      b.setAttribute("aria-label", ver ? "Ocultar la contraseña" : "Mostrar la contraseña");
      inp.focus();
    });
    w.appendChild(b);
  });
}
ponerOjos(ACC);
// Al ingresar o enviar la solicitud, las contraseñas vuelven a ocultarse
ACC.addEventListener("submit", () =>
  ACC.querySelectorAll("input[data-ojo]").forEach(i => {
    if (i.type === "text") i.nextSibling.click();
  })
);

/* Administración: solicitudes de cuenta en vivo, con aprobar, rechazar, desactivar y reactivar */
function adminLista() {
  if (desAdmin) desAdmin();
  desAdmin = firebase
    .firestore()
    .collection("usuarios")
    .onSnapshot(
      q => {
        const L = q.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) =>
              (a.estado === "pendiente" ? 0 : 1) - (b.estado === "pendiente" ? 0 : 1) ||
              (b.creado?.seconds || 0) - (a.creado?.seconds || 0)
          );
        const np = L.filter(x => x.estado === "pendiente").length;
        if (!SALUDADO) {
          SALUDADO = true;
          // Con los recordatorios de su agenda que tocan hoy (js/cuenta/admin.js); solo la cantidad, sin el detalle
          (typeof admRecordatorios === "function" ? admRecordatorios() : Promise.resolve([])).then(R =>
            saludoJorge(np, R.length)
          );
        }
        document.querySelectorAll(".adm-badge").forEach(x => {
          x.textContent = np;
          x.hidden = !np;
        });
        // La hoja de cuentas (js/cuenta/admin.js)
        if (typeof admLista === "function") admLista(L);
      },
      e => {
        if (typeof admLista === "function") admLista([]);
        console.warn("Administración:", e);
      }
    );
}

/* Bienvenida personal del administrador: aparece cada vez que entra, con un saludo según la hora,
   las solicitudes y los proyectos pendientes, y de vez en cuando una frase de ánimo */
function saludoJorge(np, nr = 0) {
  const h = new Date().getHours(),
    azar = a => a[Math.floor(Math.random() * a.length)];
  const [tit, txt] =
    h < 5
      ? ["¡Jorge! 😅🦉", "Ya es tarde… guarda tu avance y a dormir 😴💤 Mañana seguimos con todo 🌟"]
      : h < 12
        ? ["¡Buenos días, Jorge! ☀️😄", "Un cafecito ☕ y a calcular, que hoy sale algo bueno 🤩✨"]
        : h < 19
          ? ["¡Buenas tardes, Jorge! 😎💪", "Vamos con todo 🔥, que el proyecto no se calcula solo 😉⚡"]
          : ["¡Buenas noches, Jorge! 🌙😊", "No te desveles mucho, ¿eh? 🥱 Descansar también es parte del trabajo 💛"];
  let pp = 0;
  try {
    pp = Object.values(libLoad()).filter(o => o && o.res && o.res.pend > 0).length;
  } catch (_) {}
  const avisos = [];
  if (np)
    avisos.push(
      `Por cierto, <b>${np} persona${np === 1 ? "" : "s"}</b> quiere${np === 1 ? "" : "n"} unirse a JMG-ELECTRIC 👀🎉 <button type="button" class="linkbtn" data-sj="admin">Revisar</button>`
    );
  if (nr)
    avisos.push(
      `Tienes <b>${nr} aviso${nr === 1 ? "" : "s"}</b> en tu agenda y pendientes 📅⏰ <button type="button" class="linkbtn" data-sj="admin">Ver</button>`
    );
  if (pp)
    avisos.push(
      `Tienes <b>${pp} proyecto${pp === 1 ? "" : "s"}</b> con datos por completar 📝✍️ <button type="button" class="linkbtn" data-sj="proy">Ver</button>`
    );
  if (!avisos.length) avisos.push("Todo al día ✅😌 Tu plataforma te espera 🏗️⚡");
  const extra =
    Math.random() < 0.7
      ? azar([
          "Recuerda: cada cálculo bien hecho es una instalación segura 🔌🛡️😊",
          "Paso a paso, JMG-ELECTRIC sigue creciendo 📈 ¡Estoy orgulloso de lo que estás logrando! 🚀🥳",
          "Hoy es un buen día para aprender una regla nueva del CNE 📘🤓",
          "«El desarrollo progresivo del hombre depende vitalmente de la invención.» — Nikola Tesla ⚡🧠",
          "Tú puedes con esto y con mucho más 💪😄🌟",
          "¡A darle, ingeniero en camino! 👷‍♂️⚡🎓"
        ])
      : "";
  const c = document.createElement("div");
  c.className = "saludo";
  c.setAttribute("role", "status");
  c.innerHTML = `<button type="button" class="saludo-x" data-sj="x" aria-label="Cerrar">×</button><b class="saludo-t">${tit}</b><p>Qué bueno verte de vuelta 🤗 ¿Qué construimos hoy? 🛠️ ${txt}</p>${avisos.map(a => `<p class="saludo-a">${a}</p>`).join("")}${extra ? `<p class="saludo-e">${extra}</p>` : ""}<button type="button" class="btn saludo-ok" data-sj="x">¡Vamos! 💪😄</button>`;
  document.body.appendChild(c);
  requestAnimationFrame(() => c.classList.add("on"));
  const cerrar = () => {
    c.classList.remove("on");
    setTimeout(() => c.remove(), 300);
  };
  let t = setTimeout(cerrar, 20000);
  c.addEventListener("mouseenter", () => clearTimeout(t));
  c.addEventListener("mouseleave", () => {
    t = setTimeout(cerrar, 8000);
  });
  c.addEventListener("click", e => {
    const b = e.target.closest("[data-sj]");
    if (!b) return;
    if (b.dataset.sj !== "x") setTab(b.dataset.sj);
    cerrar();
  });
}

iniciarAcceso();
