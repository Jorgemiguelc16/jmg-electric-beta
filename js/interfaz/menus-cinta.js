/* MENÚS DESPLEGABLES DE LA CINTA
   Agrega ▾ solo a los botones de la cinta donde elegir desde un menú ahorra pasos (regla de la v2.9):
   - Sistema eléctrico: las opciones de suministro, con la actual marcada ✓;
   - Agregar carga, Agregar carga común y Salidas de otra potencia: cargas típicas y salidas de otra potencia por
     piso o por tipo de departamento; en el edificio, las cargas típicas se agregan al tipo de departamento elegido.
   Los parámetros y el tipo de edificación no llevan menú: sus botones abren el dato en su formulario.
   Los cambios usan los mismos formularios y listas del proyecto, recalculan y se pueden deshacer. */
(function () {
  const ws = document.getElementById("ws");

  // Desplegable de datos: el sistema eléctrico (botones de opción del formulario)
  const DD = { sistema: { tipo: "radio", t: "Sistema eléctrico", n: "Norma DGE" } };
  // Cargas típicas: [lista, tipo de carga, nombre]
  const CARGAS = {
    cocina: ["cargas", "cocina", "Cocina eléctrica"],
    terma: ["cargas", "calentador", "Terma / ducha eléctrica"],
    aire: ["cargas", "aire", "Aire acondicionado"],
    horno: ["cargas", "otra", "Horno eléctrico"],
    motor: ["cargas", "motor", "Motor"],
    bomba: ["cargas", "motor", "Electrobomba"],
    cctv: ["cargas", "otra", "Sistema de videovigilancia (CCTV)"],
    otra: ["cargas", "otra", ""],
    s_alum: ["serv", "alum", "Alumbrado de áreas comunes"],
    s_emerg: ["serv", "alum", "Iluminación de emergencia"],
    s_bomba: ["serv", "motor", "Electrobomba de agua"],
    s_asc: ["serv", "motor", "Ascensor"],
    s_cctv: ["serv", "otra", "Sistema de videovigilancia (CCTV)"],
    s_porton: ["serv", "motor", "Portón eléctrico"],
    s_otra: ["serv", "otra", ""]
  };
  const MENUS = {
    cargas: () => [
      "Agregar carga especial · CNE-U 050-200",
      [
        ["Cocina eléctrica", { ccarga: "cocina" }, "6 kW + 40 % del exceso sobre 12 kW"],
        ["Terma o ducha eléctrica", { ccarga: "terma" }, "100 %"],
        ["Aire acondicionado", { ccarga: "aire" }, "100 %"],
        ["Horno eléctrico", { ccarga: "horno" }, ""],
        ["Motor", { ccarga: "motor" }, ""],
        ["Electrobomba", { ccarga: "bomba" }, ""],
        ["Videovigilancia (CCTV)", { ccarga: "cctv" }, "Cámaras + grabador + switch PoE"],
        null,
        ["Otra carga", { ccarga: "otra" }, ""]
      ]
    ],
    // Cargas especiales de los departamentos: las típicas, agrupadas por tipo de departamento
    cargasT: () => {
      const it = [];
      tipos.forEach((t, i) => {
        const d = t.nombre || `Tipo ${i + 1}`;
        if (i) it.push(null);
        [
          ["Terma o ducha eléctrica", "terma", "100 %"],
          ["Cocina eléctrica", "cocina", "6 kW + 40 % del exceso sobre 12 kW"],
          ["Aire acondicionado", "aire", "100 %"],
          ["Horno eléctrico", "horno", ""],
          ["Videovigilancia (CCTV)", "cctv", ""],
          ["Otra carga", "otra", ""]
        ].forEach(([l, k, n]) => it.push([`${d} · ${l}`, { ccarga: k, cdep: i }, n]));
      });
      return ["Agregar carga especial del departamento · CNE-U 050-202", it];
    },
    serv: () => [
      "Agregar carga común · CNE-U 050-202 (75 %)",
      [
        ["Alumbrado de áreas comunes", { ccarga: "s_alum" }, ""],
        ["Iluminación de emergencia", { ccarga: "s_emerg" }, "Rutas de evacuación"],
        ["Electrobomba de agua", { ccarga: "s_bomba" }, ""],
        ["Ascensor", { ccarga: "s_asc" }, ""],
        ["Portón eléctrico", { ccarga: "s_porton" }, ""],
        ["Videovigilancia (CCTV)", { ccarga: "s_cctv" }, ""],
        null,
        ["Otra carga común", { ccarga: "s_otra" }, ""]
      ]
    ],
    // Luminarias y tomacorrientes de otra potencia: por piso (vivienda) o por tipo de departamento (edificio)
    otras: () => {
      const it = [];
      if (MODE === "multi") {
        tipos.forEach((t, i) =>
          it.push([`Luminarias · ${t.nombre || "Tipo " + (i + 1)}`, { cotra: `lumsT|${i}` }, ""])
        );
        it.push(null);
        tipos.forEach((t, i) =>
          it.push([`Tomacorrientes · ${t.nombre || "Tipo " + (i + 1)}`, { cotra: `tomsT|${i}` }, "Casos excepcionales"])
        );
      } else {
        const n = pisos.length + 1;
        for (let p = 1; p <= n; p++) it.push([`Luminarias · ${ORD(p)} piso`, { cotra: `lums|${p}` }, ""]);
        it.push(null);
        for (let p = 1; p <= n; p++)
          it.push([`Tomacorrientes · ${ORD(p)} piso`, { cotra: `toms|${p}` }, "Casos excepcionales"]);
      }
      return ["Salidas de otra potencia", it];
    }
  };

  /* Botones de la cinta que reciben ▾ */
  const caret = b => {
    if (b.querySelector(".mc-caret")) return;
    const s = document.createElement("span");
    s.className = "mc-caret";
    s.textContent = "▾";
    (b.querySelector("span") || b).appendChild(s);
    b.setAttribute("aria-haspopup", "menu");
  };
  ws.querySelectorAll(".ap-ribbon [data-msist]").forEach(b => {
    b.dataset.mdd = "sistema";
    caret(b);
  });
  ws.querySelectorAll('.ap-ribbon [data-act="add:cargas"]').forEach(b => {
    b.dataset.mmenu = "cargas";
    caret(b);
  });
  ws.querySelectorAll('.ap-ribbon [data-act="add:cargasT"]').forEach(b => {
    b.dataset.mmenu = "cargasT";
    caret(b);
  });
  ws.querySelectorAll('.ap-ribbon [data-act="add:serv"]').forEach(b => {
    b.dataset.mmenu = "serv";
    caret(b);
  });
  ws.querySelectorAll('.ap-ribbon [data-act="add:lums"], .ap-ribbon [data-act="add:lumsT"]').forEach(b => {
    b.dataset.mmenu = "otras";
    caret(b);
  });

  /* Menú */
  const cerrar = () => {
    document.querySelectorAll(".mc-menu").forEach(m => m.remove());
    document.querySelectorAll(".mc-open").forEach(x => x.classList.remove("mc-open"));
  };
  function abrir(boton, html) {
    cerrar();
    const m = document.createElement("div");
    m.className = "mc-menu";
    m.setAttribute("role", "menu");
    m.innerHTML = html;
    ws.appendChild(m);
    const k = parseFloat(getComputedStyle(ws).zoom) || 1,
      r = boton.getBoundingClientRect();
    let x = r.left / k;
    if (x + m.offsetWidth > innerWidth / k - 6) x = innerWidth / k - m.offsetWidth - 6;
    m.style.left = Math.max(6, x) + "px";
    m.style.top = r.bottom / k + 2 + "px";
    boton.classList.add("mc-open");
    (m.querySelector(".mc-mi.sel") || m.querySelector(".mc-mi"))?.focus();
  }
  const atr = a =>
    Object.entries(a)
      .map(([k, v]) => ` data-${k}="${v}"`)
      .join("");
  const item = (l, a, s, sel) =>
    `<button type="button" class="mc-mi${sel ? " sel" : ""}" role="menuitem"${atr(a)}><span class="mc-ck">${sel ? "✓" : ""}</span><span>${esc(l)}${s ? `<small>${esc(s)}</small>` : ""}</span></button>`;
  const sep = '<div class="mc-sep"></div>';

  // Opciones del desplegable del sistema eléctrico: [texto, valor, elegida]
  function opciones() {
    const nm = MODE === "multi" ? "sistG" : "sist";
    return [...document.querySelectorAll(`input[name="${nm}"]`)].map(r => [
      r.closest("label").querySelector(".t").firstChild.textContent.trim(),
      r.value,
      r.checked
    ]);
  }
  function elegir(k, v) {
    cambiarSistema(MODE === "multi" ? "sistG" : "sist", v);
    update();
    histPush();
    const o = opciones().find(x => x[2]);
    toast(`${DD[k].t}: ${o ? o[0] : v}`);
  }
  // Agrega un elemento a una lista del proyecto, recalcula y abre la ventana donde se completa
  function agregar(nm, extra, nodo, msg) {
    readList(nm);
    LISTS[nm].arr.push({ ...LISTS[nm].nuevo(), ...extra });
    renderList(nm);
    update();
    histPush();
    abrirLista(nm);
    toast(msg);
  }

  ws.addEventListener(
    "click",
    e => {
      const op = e.target.closest(".mc-menu [data-mop]");
      if (op) {
        const [k, v] = op.dataset.mop.split("|");
        cerrar();
        elegir(k, v);
        return;
      }
      const cg = e.target.closest(".mc-menu [data-ccarga]");
      if (cg) {
        const [nm0, tipo, nombre] = CARGAS[cg.dataset.ccarga],
          dep = cg.dataset.cdep,
          nm = dep != null ? "cargasT" : nm0;
        cerrar();
        agregar(
          nm,
          dep != null ? { tipo, nombre, dep: +dep } : { tipo, nombre },
          nm === "cargas" ? "cargas" : nm === "cargasT" ? "vivienda" : "servicios",
          `${nombre || "Carga"} agregada: escriba su potencia y longitud`
        );
        return;
      }
      const ot = e.target.closest(".mc-menu [data-cotra]");
      if (ot) {
        const [nm, n] = ot.dataset.cotra.split("|"),
          multi = nm.endsWith("T");
        cerrar();
        agregar(
          nm,
          multi ? { tipo: +n } : { piso: +n },
          multi ? "vivienda" : "salidas",
          `${nm.startsWith("lums") ? "Luminarias" : "Tomacorrientes"} de otra potencia agregados: escriba la cantidad y los W`
        );
        return;
      }
      const dd = e.target.closest(".ap-ribbon [data-mdd]");
      if (dd) {
        e.stopPropagation();
        if (dd.classList.contains("mc-open")) return cerrar();
        const k = dd.dataset.mdd,
          d = DD[k],
          ir = sep + item("Ver suministro…", { node: "suministro" }, "", false);
        abrir(
          dd,
          `<h4>${d.t} · ${d.n}</h4>` +
            opciones()
              .map(([t, v, s]) => item(t, { mop: `${k}|${v}` }, "", s))
              .join("") +
            ir
        );
        return;
      }
      const mn = e.target.closest(".ap-ribbon [data-mmenu]");
      if (mn) {
        e.stopPropagation();
        if (mn.classList.contains("mc-open")) return cerrar();
        const [h, its] = MENUS[mn.dataset.mmenu]();
        abrir(mn, `<h4>${h}</h4>` + its.map(x => (x ? item(x[0], x[1], x[2], false) : sep)).join(""));
        return;
      }
      // Calculadoras (pestaña Herramientas): app.js abre la página Herramientas; aquí se lleva a la elegida
      const hr = e.target.closest(".ap-ribbon [data-herr]");
      if (hr)
        setTimeout(() => {
          const c = $(hr.dataset.herr)?.closest(".card");
          if (!c) return;
          c.scrollIntoView({ behavior: "smooth", block: "start" });
          c.classList.add("resalta");
          setTimeout(() => c.classList.remove("resalta"), 1600);
        }, 80);
      // «Ir al dato» y demás opciones usan las acciones normales; el menú se cierra después
      if (e.target.closest(".mc-menu")) setTimeout(cerrar, 0);
    },
    true
  );
  document.addEventListener("click", e => {
    if (!e.target.closest(".mc-menu,[data-mdd],[data-mmenu]")) cerrar();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") cerrar();
  });
  document.querySelector("#ws .ap-ribbon").addEventListener("scroll", cerrar);
  addEventListener("resize", cerrar);
})();
