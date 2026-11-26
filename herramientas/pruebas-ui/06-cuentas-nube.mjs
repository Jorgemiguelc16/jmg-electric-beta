/* Pruebas de la interfaz · Cuentas y nube: proyectos en la nube, contraseñas, administración y cuentas vencidas.
   Se cargan desde herramientas/pruebas-ui.mjs, en el orden del nombre del archivo; reciben los ayudantes comunes. */
export default ({
  prueba,
  ev,
  J,
  cdp,
  esperar,
  raiz,
  join,
  readFileSync,
  writeFileSync,
  mkdtempSync,
  tmpdir,
  dxfR12Problemas,
  dxf2013Problemas,
  poner,
  clic,
  raton,
  dobleClic,
  tecla,
  deshacer,
  ejemplo,
  OX,
  OY,
  abrirPlano,
  clicPlano,
  orden,
  ctrlZ,
  teclaE,
  moverPlano,
  arrastrarPlano
}) => {
  prueba("Proyectos en la nube: se suben, se traen con su plano DXF y se borran en los demás equipos", async ok => {
    // Firestore simulado en memoria (la prueba no toca la nube real)
    await ev(`(() => {
    const S = (window.FSM = new Map()), O = [];
    const cp = v => JSON.parse(JSON.stringify(v));
    const avisar = () => setTimeout(() => O.slice().forEach(f => f()), 0);
    const snapCol = p => {
      const docs = [...S.keys()]
        .filter(k => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/"))
        .map(k => ({ id: k.slice(p.length + 1), exists: true, data: () => cp(S.get(k)) }));
      return { docs, forEach: f => docs.forEach(f) };
    };
    const doc = p => ({
      collection: n => col(p + "/" + n),
      get: async () => ({ id: p.split("/").pop(), exists: S.has(p), data: () => (S.has(p) ? cp(S.get(p)) : undefined) }),
      set: async v => (S.set(p, cp(v)), avisar()),
      delete: async () => (S.delete(p), avisar())
    });
    const col = p => ({
      doc: id => doc(p + "/" + id),
      get: async () => snapCol(p),
      onSnapshot: cb => {
        const f = () => cb(snapCol(p));
        O.push(f);
        f();
        return () => O.splice(O.indexOf(f), 1);
      }
    });
    window.firebase = window.firebase || {};
    window.FS_ORIG = firebase.firestore;
    firebase.firestore = () => ({ collection: n => col(n) });
    ["jmg-electric-nube-duenos", "jmg-electric-nube-borrados", "jmg-electric-nube-u1", "jmg-electric-nube-u2"].forEach(k => localStorage.removeItem(k));
    return 1;
  })()`);
    const hasta = async (expr, ms = 8000) => {
      for (let t = 0; t < ms; t += 100) {
        if (await ev(expr)) return true;
        await esperar(100);
      }
      return false;
    };
    const alDia = () => hasta("!NUBE.ocupado && NUBE.est === 'al día'");
    await ejemplo("uni");
    await abrirPlano();
    await clic('[data-ed="aceptar"]');
    await ev("ponerDato('p_nombre', 'Casa en la nube'); saveDraft(); 1");
    const id = await ev("PID"),
      sha = await ev("PLANO.sha");
    await esperar(400);
    await ev("nubeIniciar({ uid: 'u1' }); 1");
    ok(await alDia(), "con la cuenta, la nube queda «al día»");
    const m = await J(`FSM.get("proyectos/u1/p/${id}")`);
    ok(m && m.nombre === "Casa en la nube" && m.n >= 1, "el proyecto se sube a la cuenta");
    ok(
      await ev(
        `(() => { const m = FSM.get("proyectos/u1/planos/${sha}"); return !!(m && m.ok && FSM.get("proyectos/u1/planos/${sha}/partes/0").d.length > 100); })()`
      ),
      "y su plano DXF, en partes"
    );
    ok(/Nube: al día/.test(await ev("$('wsStatus').textContent")), "la barra de abajo dice «Nube: al día»");
    // Otro equipo cambia el proyecto: este equipo trae la versión más reciente
    await ev(
      `(() => { const o = JSON.parse(JSON.stringify(libLoad()["${id}"])); o.p_nombre = "Casa editada en otra PC"; o.savedAt = new Date(Date.now() + 60000).toISOString(); return nubeSubir(o).then(() => 1); })()`
    );
    ok(
      await hasta(`libLoad()["${id}"] && libLoad()["${id}"].p_nombre === "Casa editada en otra PC"`),
      "trae el cambio hecho en otro equipo"
    );
    // Una computadora nueva (sin el proyecto ni su plano): al ingresar, aparecen los dos
    await ev(`(async () => {
    nubeDetener();
    const L = libLoad(); delete L["${id}"]; libSave(L);
    const db = await plDb();
    await new Promise(r => { const t = db.transaction("planos", "readwrite"); t.objectStore("planos").delete("${sha}"); t.oncomplete = r; });
    ["jmg-electric-nube-duenos", "jmg-electric-nube-u1"].forEach(k => localStorage.removeItem(k));
    return 1;
  })()`);
    ok(!(await ev(`plLeerArchivo("${sha}").then(a => !!a)`)), "(equipo nuevo: sin el plano)");
    await ev("nubeIniciar({ uid: 'u1' }); 1");
    ok(await hasta(`!!libLoad()["${id}"]`), "en otro equipo, el proyecto aparece desde la nube");
    ok(await ev(`plLeerArchivo("${sha}").then(a => !!(a && a.buf && a.buf.byteLength > 100))`), "con su plano DXF");
    await alDia();
    // Eliminado en un equipo: queda «borrado» en la nube (los demás equipos lo quitan)
    await ev(`(() => { const L = libLoad(); delete L["${id}"]; nubeMarcarBorrado("${id}"); libSave(L); return 1; })()`);
    ok(
      await hasta(`!!(FSM.get("proyectos/u1/p/${id}") || {}).borrado`),
      "al eliminarlo, queda marcado como borrado en la nube"
    );
    ok(!(await ev(`FSM.has("proyectos/u1/p/${id}/partes/0")`)), "y sin sus datos");
    // Los proyectos que otra cuenta subió en este navegador no pasan a la nueva cuenta
    await ev(
      `(() => { nubeDetener(); const L = libLoad(); L["pz"] = { app: "JMG-ELECTRIC", id: "pz", p_nombre: "De u1", savedAt: new Date().toISOString() }; const D = JSON.parse(localStorage.getItem("jmg-electric-nube-duenos") || "{}"); D.pz = "u1"; localStorage.setItem("jmg-electric-nube-duenos", JSON.stringify(D)); libSave(L); nubeIniciar({ uid: "u2" }); return 1; })()`
    );
    await alDia();
    ok(!(await ev(`FSM.has("proyectos/u2/p/pz")`)), "un proyecto de otra cuenta no se sube a esta");
    await ev(
      `(() => { nubeDetener(); const L = libLoad(); delete L.pz; libSave(L); if (window.FS_ORIG) firebase.firestore = FS_ORIG; ["jmg-electric-nube-duenos", "jmg-electric-nube-borrados", "jmg-electric-nube-u1", "jmg-electric-nube-u2"].forEach(k => localStorage.removeItem(k)); return 1; })()`
    );
  });

  prueba("Cuenta: ojo en las contraseñas y crear contraseña para una cuenta de Google", async ok => {
    await ev(`(() => { $("accClave").value = "secreta123"; return 1; })()`);
    ok(
      (await ev(`ACC.querySelectorAll(".acc-ojo").length`)) === 3,
      "las tres contraseñas del ingreso y la solicitud tienen su ojo"
    );
    await ev(`ACC.querySelector("#accClave + .acc-ojo").click(); 1`);
    ok((await ev(`$("accClave").type`)) === "text", "el ojo muestra la contraseña");
    await ev(`ACC.querySelector("#accClave + .acc-ojo").click(); 1`);
    ok((await ev(`$("accClave").type`)) === "password", "y la vuelve a ocultar");
    await ev(`(() => { accError({ code: "auth/invalid-credential" }); return 1; })()`);
    ok(
      /Continuar con Google/.test(await ev(`$("accMsg").textContent`)),
      "el error explica el caso de la cuenta de Google"
    );
    // Cuenta solo con Google (simulada): se le agrega el ingreso con correo y contraseña
    await ev(`(() => {
    window.USU0 = USUARIO;
    window.ENLACE = null;
    window.firebase = window.firebase || {};
    firebase.auth = firebase.auth || {};
    window.EAP0 = firebase.auth.EmailAuthProvider;
    firebase.auth.EmailAuthProvider = { credential: (e, c) => ({ e, c }) };
    USUARIO = {
      email: "prueba@ejemplo.com",
      providerData: [{ providerId: "google.com" }],
      linkWithCredential: async cr => { ENLACE = cr; USUARIO.providerData.push({ providerId: "password" }); }
    };
    cuentaUI();
    return 1;
  })()`);
    ok(
      (await ev(`$("cuClaveTxt").textContent`)) === "Crear contraseña",
      "el menú de la cuenta ofrece «Crear contraseña»"
    );
    await ev("cuClave(); 1");
    await esperar(100);
    ok(
      (await ev(`$("cfmTxt").querySelectorAll(".acc-ojo").length`)) === 2,
      "la ventana tiene sus dos contraseñas con ojo"
    );
    await ev(
      `$("cuClave1").value = "clave123"; $("cuClave2").value = "otra123"; document.querySelector('#cfmDlg [data-cf="si"]').click(); 1`
    );
    await esperar(100);
    ok(
      /no coinciden/.test(await ev(`$("cfmTxt").textContent`)) && !(await ev("ENLACE")),
      "si no coinciden, avisa y no guarda"
    );
    await ev(
      `$("cuClave1").value = "clave123"; $("cuClave2").value = "clave123"; document.querySelector('#cfmDlg [data-cf="si"]').click(); 1`
    );
    await esperar(150);
    ok(
      (await J("ENLACE")).c === "clave123" && (await J("ENLACE")).e === "prueba@ejemplo.com",
      "la contraseña se agrega a la misma cuenta"
    );
    ok((await ev(`$("cuClaveTxt").textContent`)) === "Cambiar contraseña", "luego el menú dice «Cambiar contraseña»");
    await ev(
      `(() => { USUARIO = USU0; firebase.auth.EmailAuthProvider = EAP0; cuentaUI(); $("accClave").value = ""; return 1; })()`
    );
  });

  prueba(
    "Cuenta del administrador con su correo sin verificar: pide verificarlo, no queda como solicitud",
    async ok => {
      const r = await J(`(() => {
    const u0 = USUARIO, d0 = desFicha;
    accSesion({ email: ADMIN_CORREO, emailVerified: false, providerData: [{ providerId: "password" }] });
    const out = { ver: !document.querySelector('[data-av="verificar"]').hidden, pend: !document.querySelector('[data-av="pendiente"]').hidden, adm: esAdminCuenta, plat: !ACC.hidden };
    USUARIO = u0;
    desFicha = d0;
    ACC.hidden = true;
    document.body.classList.remove("sin-acceso");
    cuentaUI();
    return out;
  })()`);
      ok(r.ver && !r.pend, "muestra «Verifique su correo de administrador», no «Solicitud en revisión»");
      ok(!r.adm && r.plat, "no entra como administrador hasta verificarlo");
    }
  );

  prueba("Administración: PIN, panel con agenda, hoja de cuentas en su ventana, vigencia y nueva cuenta", async ok => {
    // Firebase simulado: Firestore en memoria y una segunda instancia para crear cuentas
    await ev(`(() => {
    const S = (window.FSA = new Map()), cp = v => JSON.parse(JSON.stringify(v));
    const doc = p => ({
      get: async () => ({ exists: S.has(p), data: () => (S.has(p) ? cp(S.get(p)) : undefined) }),
      set: async v => S.set(p, cp(v)),
      update: async v => {
        if (!S.has(p)) throw { code: "not-found" };
        S.set(p, { ...S.get(p), ...cp(v) });
      }
    });
    const ts = d => ({ ms: +d, toMillis() { return this.ms; } });
    window.FA0 = { fs: firebase.firestore, ini: firebase.initializeApp, adm: esAdminCuenta, u: USUARIO };
    const fs = () => ({ collection: c => ({ doc: id => doc(c + "/" + id) }) });
    fs.Timestamp = { fromDate: d => ({ ms: +d, toMillis() { return this.ms; } }) };
    fs.FieldValue = { serverTimestamp: () => ({ ms: Date.now() }) };
    firebase.firestore = fs;
    window.ALTAS = [];
    firebase.initializeApp = (cfg, nom) => ({
      name: nom,
      auth: () => ({
        setPersistence: async () => {},
        createUserWithEmailAndPassword: async (c, k) => (ALTAS.push([c, k]), { user: { uid: "nuevo1" } }),
        signOut: async () => {}
      })
    });
    if (!firebase.auth.Auth) firebase.auth.Auth = { Persistence: { NONE: "none" } };
    esAdminCuenta = true;
    USUARIO = { uid: "adm", email: ADMIN_CORREO, providerData: [{ providerId: "google.com" }] };
    Object.assign(ADM, { pin: undefined, abierto: false, f: "todos", q: "", ord: "estado", dir: 1 });
    const dia = 86400000, now = Date.now();
    admLista([
      { id: "adm", nombre: "Jorge", correo: ADMIN_CORREO, uso: "Otro", estado: "aprobado", creado: ts(now - 40 * dia) },
      { id: "u1", nombre: "Ana Pérez", correo: "ana@x.com", uso: "Docente", estado: "pendiente", creado: ts(now - dia) },
      { id: "u2", nombre: "Luis Ramos", correo: "luis@x.com", uso: "Ingeniero proyectista", estado: "aprobado", vigencia: "1m", vence: ts(now + 3 * dia), creado: ts(now - 27 * dia), ultimo: ts(now - 3600000) },
      { id: "u3", nombre: "Rosa Díaz", correo: "rosa@x.com", uso: "Estudiante de ingeniería", estado: "aprobado", vigencia: "3m", vence: ts(now - 2 * dia), creado: ts(now - 95 * dia) }
    ]);
    ["u1", "u2", "u3"].forEach(id => FSA.set("usuarios/" + id, { estado: "x" }));
    setTab("admin");
    return 1;
  })()`);
    await esperar(300);
    ok(!!(await ev("$('admPin1')")), "sin PIN: pide crearlo");
    ok(
      !(await ev("$('admCuerpo').querySelector('.ap-kpis')")) && (await ev("$('admDlg').hidden")),
      "y no muestra nada antes del PIN"
    );
    await ev(
      `$("admPin1").value = "12"; $("admPin2").value = "12"; $("admCuerpo").querySelector("form").requestSubmit(); 1`
    );
    await esperar(100);
    ok(/4 a 8 dígitos/.test(await ev("$('admMsg').textContent")), "PIN de menos de 4 dígitos: no");
    await ev(
      `$("admPin1").value = "2468"; $("admPin2").value = "2468"; $("admCuerpo").querySelector("form").requestSubmit(); 1`
    );
    await esperar(300);
    const cfg = await J(`FSA.get("config/admin")`);
    ok(
      cfg && cfg.pin && cfg.pin.length === 64 && !JSON.stringify(cfg).includes("2468"),
      "el PIN se guarda cifrado (no el número)"
    );
    ok(
      !!(await ev("$('admCuerpo').querySelector('.ap-kpis')")) &&
        !!(await ev("$('admCuerpo').querySelector('.ap-cal .ap-mes')")),
      "con el PIN: el panel con el resumen y el calendario"
    );
    ok(
      /^1\s*Por vencer/.test(await ev(`$('admCuerpo').querySelector('[data-adk="porvencer"]').textContent`)),
      "el resumen cuenta 1 por vencer"
    );
    // Agenda: los vencimientos aparecen solos; un evento nuevo se guarda en config/agenda
    ok(
      /Vence la cuenta de Luis Ramos/.test(await ev("$('agLista').textContent")),
      "el vencimiento de una cuenta aparece en la agenda"
    );
    await ev(`$('admCuerpo').querySelector('[data-apf="ev"]').click(); 1`);
    const f2 = await ev(
      `(() => { const d = new Date(Date.now() + 2 * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })()`
    );
    await ev(
      `$("agT").value = "Entrega del expediente"; $("agR").value = "3"; $("agF").value = "${f2}"; $('admCuerpo').querySelector('[data-agf="ev"]').requestSubmit(); 1`
    );
    await esperar(200);
    const ag = await J(`FSA.get("config/agenda")`);
    ok(
      ag && ag.items.length === 1 && ag.items[0].t === "Entrega del expediente" && ag.items[0].r === 3,
      "el evento se guarda con su aviso (3 días antes)"
    );
    ok(
      (await J("agTocan().length")) === 1 &&
        !!(await ev(`$('admCuerpo').querySelector('.ap-d[data-agd="${f2}"] u.ev')`)),
      "su aviso ya toca (faltan 2 días) y el calendario marca el día"
    );
    // Pendientes: uno urgente cuenta como aviso
    await ev(
      `$("taT").value = "Llamar al ingeniero"; $("taP").value = "u"; $('admCuerpo').querySelector('[data-agf="ta"]').requestSubmit(); 1`
    );
    await esperar(200);
    ok(
      (await J(`FSA.get("config/agenda")`)).tareas[0].p === "u" && (await J("agAvisos()")) === 2,
      "un pendiente urgente se guarda y cuenta como aviso"
    );
    ok(
      (await ev("document.querySelector('.adm-badge').textContent")) === "3",
      "la insignia del menú suma la solicitud pendiente y los dos avisos"
    );
    await ev(`$('admCuerpo').querySelector("[data-ath]").click(); 1`);
    await esperar(150);
    ok((await J(`FSA.get("config/agenda")`)).tareas[0].hecho === true, "el pendiente se marca como hecho");
    // Notas de colores
    await ev(`$('admCuerpo').querySelector("[data-anu]").click(); 1`);
    await esperar(150);
    await ev(
      `const t = $('admCuerpo').querySelector(".ap-papel textarea"); t.value = "Cliente: Sra. Flores, 3 pisos"; t.dispatchEvent(new Event("input", { bubbles: true })); $('admCuerpo').querySelector('.ap-papel [data-anc="verde"]').click(); 1`
    );
    await esperar(1000);
    const nt = (await J(`FSA.get("config/agenda")`)).notas[0];
    ok(nt && nt.t === "Cliente: Sra. Flores, 3 pisos" && nt.c === "verde", "la nota se guarda con su texto y color");
    await ev(`$('admCuerpo').querySelector("[data-agh]").click(); 1`);
    await esperar(150);
    ok(
      (await J(`FSA.get("config/agenda")`)).items[0].hecho === true && (await J("agTocan().length")) === 0,
      "el evento marcado como hecho deja de recordar"
    );
    // La hoja de cuentas se abre en una ventana
    await ev(`$('admCuerpo').querySelector('[data-adk="todos"]').click(); 1`);
    await esperar(150);
    ok(
      !(await ev("$('admDlg').hidden")) && (await ev("$('admHoja').querySelectorAll('tbody tr').length")) === 4,
      "la hoja se abre en su ventana con las 4 cuentas"
    );
    ok(
      /Por vencer \(7 días\) 1/.test(await ev("$('admFiltros').textContent")) &&
        /Vencidas 1/.test(await ev("$('admFiltros').textContent")),
      "filtros con su cantidad: 1 por vencer y 1 vencida"
    );
    ok(
      /Su cuenta/.test(await ev(`$("admHoja").querySelector('tr[data-id="adm"]').textContent`)),
      "la fila del administrador, sin acciones"
    );
    // Bloquear y volver a entrar con el PIN
    await ev(`document.querySelector('[data-adb="bloquear"]').click(); 1`);
    ok(
      !!(await ev("$('admPin')")) && (await ev("$('admDlg').hidden")),
      "bloquear cierra la hoja y vuelve a pedir el PIN"
    );
    await ev(`$("admPin").value = "1111"; $("admCuerpo").querySelector("form").requestSubmit(); 1`);
    await esperar(100);
    ok(/incorrecto/.test(await ev("$('admMsg').textContent")), "PIN incorrecto: no entra");
    await ev(`$("admPin").value = "2468"; $("admCuerpo").querySelector("form").requestSubmit(); 1`);
    await esperar(150);
    ok(!!(await ev("$('admCuerpo').querySelector('.ap-kpis')")), "PIN correcto: entra al panel");
    await ev(`$('admCuerpo').querySelector('[data-adk="todos"]').click(); 1`);
    await esperar(100);
    // Buscar y filtrar
    await ev(`$("admBuscar").value = "rosa"; $("admBuscar").dispatchEvent(new Event("input")); 1`);
    ok((await ev("$('admHoja').querySelectorAll('tbody tr').length")) === 1, "el buscador filtra");
    await ev(
      `$("admBuscar").value = ""; $("admBuscar").dispatchEvent(new Event("input")); document.querySelector('[data-adfil="vencido"]').click(); 1`
    );
    ok(/Vencido/.test(await ev("$('admHoja').querySelector('tbody').textContent")), "filtro «Vencidas»");
    // Renovar la vencida: desde hoy, por su vigencia (3 meses)
    await ev(`$("admHoja").querySelector('[data-ada="renovar"][data-id="u3"]').click(); 1`);
    await esperar(150);
    const u3 = await J(`FSA.get("usuarios/u3")`),
      d3 = (u3.vence.ms - Date.now()) / 86400000;
    ok(u3.estado === "aprobado" && d3 > 85 && d3 < 95, "renovar la vencida: aprobada por 3 meses desde hoy");
    // Vigencia editada en la celda: 1 año desde hoy
    await ev(
      `document.querySelector('[data-adfil="todos"]').click(); const s = $("admHoja").querySelector('tr[data-id="u1"] select[data-k="vigencia"]'); s.value = "1a"; s.dispatchEvent(new Event("change", { bubbles: true })); 1`
    );
    await esperar(150);
    const u1 = await J(`FSA.get("usuarios/u1")`),
      d1 = (u1.vence.ms - Date.now()) / 86400000;
    ok(u1.vigencia === "1a" && d1 > 360 && d1 < 370, "vigencia en la celda: 1 año");
    // Notas en la celda
    await ev(
      `const i = $("admHoja").querySelector('tr[data-id="u2"] [data-k="notas"]'); i.value = "Pagó hasta marzo"; i.dispatchEvent(new Event("change", { bubbles: true })); 1`
    );
    await esperar(100);
    ok((await J(`FSA.get("usuarios/u2")`)).notas === "Pagó hasta marzo", "las notas se guardan solas");
    // Nueva cuenta
    await ev(`document.querySelector('[data-adb="nueva"]').click(); 1`);
    await esperar(100);
    await ev(
      `$("anNom").value = "Carla Soto"; $("anCor").value = "Carla@X.com"; document.querySelector("[data-angen]").click(); $("anVig").value = "6m"; document.querySelector('#cfmDlg [data-cf="si"]').click(); 1`
    );
    await esperar(300);
    const alta = await J("ALTAS[0]"),
      nu = await J(`FSA.get("usuarios/nuevo1")`);
    ok(
      alta && alta[0] === "carla@x.com" && alta[1].length === 10,
      "la cuenta se crea con el correo y una contraseña generada"
    );
    ok(
      nu && nu.estado === "aprobado" && nu.vigencia === "6m" && nu.creadoPor === "admin",
      "su ficha queda aprobada, con 6 meses"
    );
    ok(
      /Cuenta creada/.test(await ev("$('cfmT').textContent")) &&
        (await ev("$('cfmTxt').textContent")).includes(alta[1]),
      "muestra los datos para entregarlos"
    );
    await ev(`document.querySelector('#cfmDlg [data-cf="no"]').click(); 1`);
    await ev(
      `(() => { admCerrarVentana(); firebase.firestore = FA0.fs; firebase.initializeApp = FA0.ini; esAdminCuenta = FA0.adm; USUARIO = FA0.u; Object.assign(ADM, { pin: undefined, abierto: false }); Object.assign(AG, { items: [], tareas: [], notas: [], cargada: false, sel: null, form: "" }); admLista([]); setTab("inicio"); return 1; })()`
    );
  });

  prueba("Cuenta vencida: no entra y ve «Su acceso venció»", async ok => {
    const r = await J(`(() => {
    const F = { estado: "aprobado", vence: { toMillis: () => Date.now() - 86400000 } };
    return { v: fichaVencida(F), n: fichaVencida({ estado: "aprobado", vence: null }), f: fichaVencida({ estado: "aprobado", vence: { toMillis: () => Date.now() + 86400000 } }) };
  })()`);
    ok(r.v && !r.n && !r.f, "vencida solo si la fecha ya pasó (sin fecha: indefinida)");
    ok(
      !!(await ev(`document.querySelector('[data-av="vencido"] #vencFecha')`)),
      "existe la pantalla «Su acceso venció»"
    );
  });
};
