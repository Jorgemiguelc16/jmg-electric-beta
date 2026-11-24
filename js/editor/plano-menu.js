/* EDITOR DE DISEÑO · MENÚ DEL CLIC DERECHO Y CINTA
   Menú del clic derecho sobre el plano, pestaña Diseño del espacio de trabajo y barra de título, pestañas y cinta
   del editor.
   Antes era parte de js/plano.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Menú del clic derecho sobre el plano ----------
   Sobre un elemento del diseño lo elige (si no estaba elegido) y muestra lo que se puede hacer con lo elegido;
   sobre la arquitectura, borrar, ocultar o aislar su capa; en un lugar vacío, pegar, seleccionar todo y la vista.
   Con una herramienta en curso: terminar o cancelar. */
const ED_MENU = $("edMenu");
function edMenuAbrir(e) {
  const [X, Y] = plMouse(e),
    p = plADib(X, Y),
    D = dsD();
  ED_MENU.p = p;
  ED_MENU.ctx = null;
  // Sobre el circulito de una salida del tablero: sus opciones
  const sal = !PLH.h && D && dsSalidaEn(p[0], p[1], (9 * plDpr()) / PLV.s);
  if (sal) {
    ED_MENU.ctx = sal;
    DS_SEL.clear();
    PL_ASEL.clear();
    DS_SEL.add(sal.tb.id);
    edProps();
    plSobreDibujar();
    ED_MENU.innerHTML =
      `<div class="ed-mt">${esc(sal.o.n)}${sal.o.d ? " · " + esc(sal.o.d) : ""} · ${esc(sal.tb.nom || "Tablero")}</div>` +
      `<button type="button" data-edm="salmenu" role="menuitem"><span>Salida del circuito ${esc(sal.o.n)}</span><kbd>▸</kbd></button>` +
      `<hr><button type="button" data-edm="tablero" role="menuitem"><span>Circuitos del tablero…</span></button>`;
    ED_MENU.hidden = false;
    return edMenuPos(e.clientX, e.clientY);
  }
  if (!PLH.h && D) {
    const id = dsHit(p[0], p[1], (6 * plDpr()) / PLV.s);
    if (id && !DS_SEL.has(id)) {
      DS_SEL.clear();
      PL_ASEL.clear();
      DS_SEL.add(id);
    } else if (!id && !DS_SEL.size) {
      // Sobre la arquitectura (una línea o un texto): si ya estaba elegido se conserva la selección; si no, se elige solo
      const r = (8 * plDpr()) / PLV.s,
        tx = plTextoEn(p[0], p[1], 0),
        i = tx ? -1 : plObjeto(p[0], p[1], r),
        n = i >= 0 ? PL_MOD.trazos[i].e : tx ? tx.e : null;
      if (n === null || !PL_ASEL.has(n)) plSeleccionar(p, false);
    }
    edProps();
    plSobreDibujar();
  }
  const sel = D ? dsSel().filter(dsEditable) : [],
    na = PL_ASEL.size,
    it = [];
  /* Sobre una línea, un área o una tubería elegida: su vértice (el cuadradito) o su tramo (la línea o el rombo del
     medio), para quitar o agregar vértices, partir, quitar el tramo o volverlo recto o en arco */
  let pc = null;
  if (!PLH.h && D) {
    const ag = dsAgarreEn(X, Y),
      el = ag ? D.els.find(x => x.id === ag.id) : sel.length === 1 ? sel[0] : null;
    if (dsEsPoli(el) && dsEditable(el)) {
      if (ag && ag.t === "v") pc = { el, v: ag.i };
      else if (ag && ag.t === "m") pc = { el, s: ag.i };
      else {
        const t = dsTramoEn(el, p, (8 * plDpr()) / PLV.s);
        if (t) pc = { el, s: t.i };
      }
    }
  }
  ED_MENU.poli = pc;
  const b = (a, t, k, on = true) =>
      it.push(
        `<button type="button" data-edm="${a}" role="menuitem"${on ? "" : " disabled"}><span>${t}</span>${k ? `<kbd>${k}</kbd>` : ""}</button>`
      ),
    sep = () => it.length && !/<hr>$/.test(it[it.length - 1]) && it.push("<hr>"),
    tit = t => it.push(`<div class="ed-mt">${t}</div>`);
  if (PLH.h) {
    b("terminar", "Terminar", "Intro", PLH.pts.length > 1 || PLH.h === "rec");
    b("cancelar", "Cancelar la herramienta", "Esc");
    if (PLH.h.startsWith("col:")) b("girar", `Girar ${DSU.giro || 90}° a la izquierda`, "R");
  } else if (sel.length) {
    tit(sel.length > 1 ? `${sel.length} elementos del diseño` : dsNomEl(sel[0]));
    const n0 = it.length;
    if (pc) {
      const el = pc.el,
        n = el.pts.length / 2,
        abre = el.c ? (el.ar ? "" : "Abrir aquí") : "Partir aquí";
      if (pc.v != null) {
        b("vquitar", "Quitar este vértice", "Supr", n > (el.c ? 3 : 2));
        if (abre) b("vpartir", abre, "", el.c || (pc.v > 0 && pc.v < n - 1));
      } else {
        const k = (el.b || [])[pc.s] || 0;
        b("tvert", "Agregar un vértice aquí");
        if (abre) b("tpartir", abre);
        if (k) {
          b("trecto", "Volver recto este tramo");
          b("tinv", "Invertir la curva de este tramo");
        } else b("tarco", "Volver arco este tramo");
        b("tquitar", "Quitar este tramo", "", !el.ar);
      }
    }
    if (sel.length === 2 && !dsUniblesMotivo(sel[0], sel[1]))
      b("unir", `Unir en una sola ${sel[0].t === "tub" ? "tubería" : "línea"}`);
    if (sel.some(el => dsEsPoli(el) && el.b && el.b.some(Boolean))) b("todorecto", "Volver rectos todos sus tramos");
    if (it.length > n0) sep();
    // Sacar una tubería: del tablero, por una de sus salidas; de un artefacto, desde él
    if (sel.length === 1 && sel[0].k === "tab" && sel[0].nc) {
      ED_MENU.ctx = { tb: sel[0] };
      b("saltab", "Salida de circuito ▸");
      sep();
    } else if (sel.length === 1 && sel[0].k === "tab" && sel[0].gen) {
      // Tablero general: sus alimentadores (al banco, a un medidor o a otro tablero)
      ED_MENU.ctx = { tb: sel[0] };
      b("alitab", "Alimentador ▸");
      sep();
    } else if (sel.length === 1 && dsConecta(sel[0])) {
      ED_MENU.ctx = { el: sel[0] };
      b("salmenu", "Sacar tubería ▸");
      b("reprep", "Repartir este en un ambiente…");
      b("repmur", "Este a lo largo de un muro…");
      sep();
    }
    // Circuito de lo elegido (artefactos y tuberías), elegido de las salidas de los tableros
    if (sel.some(edAsignable) && D.els.some(e => e.k === "tab" && e.nc > 0)) {
      b("asigcir", `Asignar circuito${sel.length > 1 ? ` a ${sel.filter(edAsignable).length}` : ""} ▸`);
      sep();
    }
    b("copiar", "Copiar", "Ctrl+C");
    b("cortar", "Cortar", "Ctrl+X");
    b("pegar", "Pegar", "Ctrl+V", DS_PORTA.length > 0);
    b("duplicar", "Duplicar");
    b("fila", "Copiar en fila…");
    b("espejo", "Espejo…");
    b("borrar", "Borrar", "Supr");
    sep();
    b("girar", `Girar ${DSU.giro || 90}° a la izquierda`, "R");
    b("g-90", "Girar 90° a la derecha");
    b("g180", "Girar 180°");
    b("gang", "Girar un ángulo…");
    if (sel.length === 1 && (sel[0].t === "sim" || sel[0].t === "txt"))
      b("gexacto", `Ángulo exacto… (ahora ${+(sel[0].r || 0).toFixed(1)}°)`);
    sep();
    // Etiquetas de lo elegido (longitud y circuito de las tuberías, circuito de las salidas)
    if (sel.some(dsConEtq)) {
      b("etqver", "Mostrar sus etiquetas");
      b("etqocu", "Ocultar sus etiquetas");
      if (sel.some(el => el.etq || typeof el.cirt === "boolean" || typeof el.nsal === "boolean"))
        b("etqpla", "Etiquetas como en todo el plano");
      sep();
    }
    if (sel.some(dsConEnc)) b("enc", "Letra de encendido (a, b, c…)…");
    if (sel.some(el => el.dt)) b("letra0", "Letra a su lugar");
    if (sel.some(el => el.col)) b("colcapa", "Quitar el color propio");
    b(
      "acapa",
      `Pasar a la capa actual (${esc(D.actual)})`,
      "",
      sel.some(el => el.capa !== D.actual)
    );
    if (sel.filter(dsConecta).length >= (sel.some(el => el.k === "tab") ? 1 : 2))
      b("ruta", "Unir con tuberías (ruta automática)");
    b("bloque", "Guardar como bloque…");
    if (EPL.plantas.length > 1) b("aplanta", "Copiar a otra planta…");
    if (sel.length === 1 && DP_MON.has(sel[0].k) && EPL.plantas.length > 1 && !(sel[0].mon && sel[0].mon2))
      b("montante", sel[0].mon ? "Prolongar el montante a otra planta…" : "Crear montante a otra planta…");
    if (sel.length === 1 && sel[0].mon) b("irmon", "Ir al otro extremo del montante");
    if (sel.length === 1 && DP_MON.has(sel[0].k)) b("rotulo", "Rótulo de los alimentadores que pasan");
    b("similares", "Seleccionar todos los de este tipo");
    b("encuadrar", "Acercar a lo elegido");
    if (sel.length === 1 && sel[0].k === "tab") b("tablero", "Circuitos del tablero…");
    if (sel.length === 1) b("ventana", "Propiedades…", "doble clic");
    if (na) {
      sep();
      b("borrarArq", `Borrar también ${na} objeto${na > 1 ? "s" : ""} de la arquitectura`);
    }
  } else if (na) {
    const t = PLH.obj >= 0 ? PL_MOD.trazos[PLH.obj] : null;
    tit(`Arquitectura · ${na} objeto${na > 1 ? "s" : ""}`);
    b("borrar", "Borrar (se oculta; el DXF no cambia)", "Supr");
    // Ducha o tina para la verificación del baño (CNE-U 150-702(14), 150-700(13) y 170-326)
    const duc = new Set(EPL.duchas || []);
    if ([...PL_ASEL].some(e => !duc.has(e))) b("ducha", "Es una ducha o tina");
    if ([...PL_ASEL].some(e => duc.has(e))) b("noducha", "No es una ducha o tina");
    if (t) {
      b("ocultar", `Ocultar la capa ${esc(t.capa)}`);
      b("aislar", `Aislar la capa ${esc(t.capa)}`);
    }
    b("soltar", "Soltar la selección", "Esc");
  } else {
    b("pegar", "Pegar", "Ctrl+V", DS_PORTA.length > 0);
    b("todo", "Seleccionar todo el diseño", "Ctrl+A", !!(D && D.els.length));
    b("biblio", "Biblioteca de símbolos…", "B");
    b("ley", "Insertar la leyenda aquí", "", !!(D && D.els.length));
    sep();
    b("ajustar", "Ajustar a la pantalla");
    if (EPL.ocultas.length) b("mostrar", "Mostrar todas las capas");
    if (PL_BORR.size)
      b(
        "restaurar",
        `Restaurar ${PL_BORR.size} objeto${PL_BORR.size > 1 ? "s" : ""} borrado${PL_BORR.size > 1 ? "s" : ""}`
      );
  }
  // Punto base de la planta: con dos o más plantas, sin nada del diseño elegido
  const pb = PLH.eng ? [PLH.eng[0], PLH.eng[1]] : p,
    ip = EPL.plantas.length > 1 && !sel.length ? dpPlantaDe(pb[0], pb[1]) : -1;
  ED_MENU.pb = pb;
  if (ip >= 0) {
    sep();
    b(
      "pbase",
      `${dpTieneBase(EPL.plantas[ip]) ? "Mover el" : "Poner el"} punto base de ${esc(EPL.plantas[ip].n)} aquí`
    );
  }
  ED_MENU.innerHTML = it.join("");
  ED_MENU.hidden = false;
  // Junto al cursor y dentro del editor (la escala del espacio de trabajo cambia el tamaño en pantalla)
  const ed = $("editor").getBoundingClientRect(),
    S = parseFloat(getComputedStyle($("ws")).zoom) || 1,
    w = ED_MENU.offsetWidth,
    h = ED_MENU.offsetHeight,
    x = (e.clientX - ed.left) / S,
    y = (e.clientY - ed.top) / S;
  ED_MENU.style.left = Math.max(2, Math.min(x, ed.width / S - w - 4)) + "px";
  ED_MENU.style.top = Math.max(2, y + h > ed.height / S - 4 ? y - h : y) + "px";
}
const edMenuCerrar = () => {
  ED_MENU.hidden = true;
  ED_MENU.fn = null;
};
// Posición del menú: junto a un punto de la pantalla y dentro del editor
function edMenuPos(cx, cy) {
  const ed = $("editor").getBoundingClientRect(),
    S = parseFloat(getComputedStyle($("ws")).zoom) || 1,
    w = ED_MENU.offsetWidth,
    h = ED_MENU.offsetHeight,
    x = (cx - ed.left) / S,
    y = (cy - ed.top) / S;
  ED_MENU.style.left = Math.max(2, Math.min(x, ed.width / S - w - 4)) + "px";
  ED_MENU.style.top = Math.max(2, y + h > ed.height / S - 4 ? y - h : y) + "px";
}
// Menú con opciones propias junto a un punto del dibujo; fn recibe el número de la opción elegida (data-edm="sal:n")
function edMenuLista(p, html, fn, fnCambio) {
  ED_MENU.fnCambio = fnCambio || null;
  ED_MENU.innerHTML = html;
  ED_MENU.hidden = false;
  const [X, Y] = plAPant(p[0], p[1]),
    r = plBase.getBoundingClientRect();
  edMenuPos(r.left + (X * r.width) / plBase.width + 8, r.top + (Y * r.height) / plBase.height + 8);
  ED_MENU.fn = fn;
}
/* Edición de una línea, un área o una tubería en su vértice (pc.v) o en su tramo (pc.s), con el punto q del clic */
function edPoli(a, pc, q) {
  if (!pc || !pc.el || !dsD().els.includes(pc.el)) return;
  const el = pc.el;
  let r = null,
    msg = "";
  if (a === "vquitar") {
    if (!dsQuitarVertice(el, pc.v)) return toast(`Debe quedar al menos ${el.c ? 3 : 2} vértices`);
    msg = "Vértice quitado";
  } else if (a === "vpartir") r = dsPartir(el, pc.v);
  else if (a === "tpartir") r = dsPartirEn(el, pc.s, q);
  else if (a === "tquitar") r = dsQuitarTramo(el, pc.s);
  else if (a === "tvert") {
    if (dsAgregarVertice(el, pc.s, q) < 0) return toast("Haga clic derecho más lejos de los extremos del tramo");
    msg = "Vértice agregado: arrástrelo para moverlo";
  } else {
    dsTramoForma(el, pc.s, a === "trecto" ? "recto" : a === "tarco" ? "arco" : "inv");
    msg = a === "tarco" ? "Tramo en arco: arrastre el rombo del medio para dar la curva" : "";
  }
  if (typeof r === "string") return toast(r);
  if (r) {
    DS_SEL.clear();
    r.forEach(x => DS_SEL.add(x.id));
    msg =
      r.length === 2
        ? `Partida en dos ${el.t === "tub" ? "tuberías" : "líneas"} (quedan elegidas)`
        : a === "tquitar"
          ? "Tramo quitado"
          : "Abierta en ese punto";
  }
  edCambio();
  edProps();
  if (msg) toast(msg);
}
// Supr con el cursor sobre un vértice de una línea elegida: quita ese vértice (y no la línea)
function edQuitarVerticeBajoCursor() {
  if (PLH.h || !PLH.cur || !dsD()) return false;
  const [X, Y] = plAPant(PLH.cur[0], PLH.cur[1]),
    ag = dsAgarreEn(X, Y),
    el = ag && ag.t === "v" ? dsD().els.find(x => x.id === ag.id) : null;
  if (!dsEsPoli(el)) return false;
  edPoli("vquitar", { el, v: ag.i });
  return true;
}
// Ángulo exacto de un símbolo o texto: se escribe en la línea de comandos (0° a 360°, antihorario)
function edAnguloExacto(id) {
  const el = dsD() && dsD().els.find(e => e.id === id);
  if (!el || (el.t !== "sim" && el.t !== "txt")) return;
  plOrden(
    '<b>Ángulo exacto</b> · escriba el ángulo y pulse Intro (positivo: antihorario) · <span class="pl-k">Esc</span> cancela'
  );
  plPedir("Ángulo de giro (°)", String(+(el.r || 0).toFixed(2)), v => {
    const g = parseFloat(String(v).replace(",", "."));
    plPedir(null);
    plOrden();
    if (!Number.isFinite(g)) return toast("Escriba el ángulo en grados, por ejemplo 45");
    el.r = Math.round((((g % 360) + 360) % 360) * 100) / 100;
    edCambio();
    toast(`Girado a ${+el.r.toFixed(2)}°`);
  });
}
/* Ángulo del símbolo (o texto) elegido, junto a su punto de giro: se ve mientras está elegido y mientras se gira;
   un clic lo convierte en un campo para escribir el ángulo exacto (Intro aplica, Esc cancela) */
function edAngSel() {
  if (PLH.h || DS_SEL.size !== 1 || !dsD()) return null;
  const el = dsSel()[0];
  return el && (el.t === "sim" || el.t === "txt") && dsEditable(el) ? el : null;
}
function edAngPoner() {
  const c = $("edAng"),
    el = edAngSel();
  if (!el) {
    c.hidden = true;
    $("edAngI").hidden = true;
    $("edAngB").hidden = false;
    return;
  }
  const [gx, gy] = dsPosGiro(el),
    [X, Y] = plAPant(gx, gy),
    k = plLienzo.clientWidth / plBase.width;
  c.hidden = false;
  c.style.left = X * k + "px";
  c.style.top = Y * k + "px";
  c.dataset.id = el.id;
  if ($("edAngI").hidden) $("edAngB").textContent = `${+(el.r || 0).toFixed(1)}°`;
}
function edAngEditar() {
  const el = edAngSel();
  if (!el) return;
  const i = $("edAngI");
  $("edAngB").hidden = true;
  i.hidden = false;
  i.value = String(+(el.r || 0).toFixed(2));
  i.focus();
  i.select();
}
function edAngFin(aplicar) {
  const i = $("edAngI");
  if (i.hidden) return;
  const el = dsD() && dsD().els.find(e => e.id === $("edAng").dataset.id),
    g = parseFloat(i.value.replace(",", "."));
  i.hidden = true;
  $("edAngB").hidden = false;
  i.blur();
  if (aplicar && el && Number.isFinite(g)) {
    el.r = Math.round((((g % 360) + 360) % 360) * 100) / 100;
    edCambio();
  }
  // Al instante (el dibujo del plano puede esperar al próximo cuadro de la pantalla)
  edAngPoner();
}
$("edAngB").addEventListener("click", edAngEditar);
$("edAngI").addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === "Escape") {
    e.preventDefault();
    edAngFin(e.key === "Enter");
  }
  e.stopPropagation();
});
$("edAngI").addEventListener("blur", () => edAngFin(true));
["pointerdown", "wheel"].forEach(t => $("edAng").addEventListener(t, e => e.stopPropagation()));
// Nombre de un elemento del diseño para el título del menú
const dsNomEl = el =>
  el.t === "sim"
    ? esc(DS_CAT[el.k] ? DS_CAT[el.k].n : el.k)
    : { tub: "Tubería", lin: "Línea", txt: "Texto", cir: "Círculo", cot: "Cota", dir: "Directriz" }[el.t] || "Elemento";
// Submenú del recorrido de la tubería que se saca (techo, pared o piso), en el mismo lugar del menú
function edMenuRecorrido(ctx) {
  const t = ctx.o ? `Salida ${ctx.o.n} · sacar tubería` : `${DS_CAT[ctx.el.k].n} · sacar tubería`;
  ED_MENU.ctx = ctx;
  ED_MENU.innerHTML =
    `<div class="ed-mt">${esc(t)}</div>` +
    [
      ["techo", "Por el techo", "línea continua"],
      ["pared", "Por la pared", "línea continua"],
      ["piso", "Por el piso", "línea discontinua"]
    ]
      .map(
        ([m, n, k]) =>
          `<button type="button" data-edm="tub:${m}" role="menuitem"><span>${n}</span><kbd>${k}</kbd></button>`
      )
      .join("");
  ED_MENU.hidden = false;
}
// Elementos a los que se les puede asignar un circuito: artefactos (no tableros ni medidores) y tuberías de circuito
const edAsignable = el =>
  (el.t === "sim" && el.k !== "tab" && !PL_MED.has(el.k) && el.k !== "pat") || (el.t === "tub" && !el.ali);
// Submenú «Asignar circuito»: los tableros y, al elegir uno, sus salidas
function edMenuCircuitos(tb) {
  // Solo los tableros de la planta de lo elegido, si esa planta los tiene (como el desplegable de Propiedades)
  const todos = dsD().els.filter(e => e.k === "tab" && e.nc > 0),
    P = new Set(
      dsD()
        .els.filter(e => DS_SEL.has(e.id))
        .map(dpPlantaEl)
    ),
    pl = P.size === 1 ? [...P][0] : -1,
    dePl = pl >= 0 ? todos.filter(t => dpPlantaEl(t) === pl) : [],
    tabs = dePl.length ? dePl : todos;
  if (!tb && tabs.length === 1) tb = tabs[0];
  ED_MENU.innerHTML = tb
    ? `<div class="ed-mt">Circuitos de ${esc(tb.nom || "tablero")}</div>` +
      dsSalidasTab(tb)
        .map(
          o =>
            `<button type="button" data-edm="asig:${tb.id}|${o.n}" role="menuitem"><span><b style="color:${plColorDis(dsColCir(o.n, tb.id))}">${o.n}</b>${o.d ? " · " + esc(o.d) : ""}</span></button>`
        )
        .join("") +
      '<hr><button type="button" data-edm="asig:|" role="menuitem"><span>Sin circuito</span></button>'
    : `<div class="ed-mt">Asignar circuito · tablero</div>` +
      tabs
        .map(
          t =>
            `<button type="button" data-edm="asigtab:${t.id}" role="menuitem"><span>${esc(t.nom || "Tablero")}</span><kbd>${t.nc} ▸</kbd></button>`
        )
        .join("");
  ED_MENU.hidden = false;
}
function edMenuAccion(a) {
  const fn = ED_MENU.fn,
    ctx = ED_MENU.ctx,
    q = ED_MENU.hidden ? null : ED_MENU.getBoundingClientRect();
  // Dónde estaba el menú: la lista que abre una opción (elegir la planta…) sale en el mismo lugar
  ED_MENU.ult = q ? { x: q.left, y: q.top, t: Date.now() } : null;
  if (a === "asigcir") return edMenuCircuitos(null);
  if (a.startsWith("asigtab:")) return edMenuCircuitos(dsD().els.find(e => e.id === a.slice(8)));
  if (a.startsWith("asig:")) {
    edMenuCerrar();
    const [tb, cir] = a.slice(5).split("|"),
      l = dsSel().filter(el => dsEditable(el) && edAsignable(el));
    l.forEach(el => {
      if (cir) {
        el.cir = cir;
        el.tab = tb;
      } else {
        delete el.cir;
        delete el.tab;
      }
    });
    edCambio();
    edProps();
    plDibujar();
    const t = dsD().els.find(e => e.id === tb);
    return toast(
      cir
        ? `${l.length} elemento${l.length === 1 ? "" : "s"} en ${cir} de ${t ? t.nom || "Tablero" : "tablero"}`
        : `${l.length} elemento${l.length === 1 ? "" : "s"} sin circuito`
    );
  }
  if (a === "salmenu" && ctx) return edMenuRecorrido(ctx);
  if (a === "etqver" || a === "etqocu" || a === "etqpla") {
    edMenuCerrar();
    const D = dsD(),
      l = dsSel().filter(el => dsEditable(el) && dsConEtq(el));
    l.forEach(el => {
      if (a === "etqpla") {
        delete el.etq;
        delete el.cirt;
        delete el.nsal;
      } else if (el.t === "tub") {
        // Mostrar: la longitud como la del plano (total si el plano no la muestra) y el circuito con su diámetro
        el.etq = a === "etqver" ? (D.etq === "tramo" ? "tramo" : "total") : "no";
        el.cirt = a === "etqver";
      } else el.nsal = a === "etqver";
    });
    edCambio();
    edProps();
    plDibujar();
    return toast(
      `${a === "etqver" ? "Etiquetas visibles en" : a === "etqocu" ? "Etiquetas ocultas en" : "Etiquetas como el plano en"} ${l.length} elemento${l.length === 1 ? "" : "s"}`
    );
  }
  if (a === "alitab" && ctx && ctx.tb) {
    const tb = ctx.tb;
    return dsElegirSalida(
      tb,
      [tb.x, tb.y],
      o => {
        if (o.dest) return dsAliDirecto(tb, o.dest);
        plHerr("tubT");
        dsPuntoAli(tb, [tb.x, tb.y]);
      },
      true
    );
  }
  if (a === "saltab" && ctx && ctx.tb) {
    // Lista de salidas del tablero; al elegir una, el recorrido
    const S = dsSalidasTab(ctx.tb);
    ED_MENU.innerHTML =
      `<div class="ed-mt">Salidas de ${esc(ctx.tb.nom || "tablero")}</div>` +
      S.map(
        o =>
          `<button type="button" data-edm="salsel:${o.i}" role="menuitem"><span><b style="color:${plColorDis(dsColCir(o.n, ctx.tb.id))}">${o.n}</b>${o.d ? " · " + esc(o.d) : ""}</span><kbd>▸</kbd></button>`
      ).join("");
    return;
  }
  if (a.startsWith("salsel:") && ctx && ctx.tb)
    return edMenuRecorrido({ tb: ctx.tb, o: dsSalidasTab(ctx.tb)[+a.slice(7)] });
  if ((a === "reprep" || a === "repmur") && ctx && ctx.el) {
    edMenuCerrar();
    return dpIniciarRep(a === "reprep" ? "rep" : "rmur", ctx.el.k);
  }
  if (a.startsWith("tub:") && ctx) {
    edMenuCerrar();
    return dsSacarTub(ctx, a.slice(4));
  }
  edMenuCerrar();
  if (a.startsWith("sal:")) return fn && fn(+a.slice(4));
  if (a.startsWith("tablero:")) return tabAbrir(a.slice(8));
  if (a === "tablero" && ctx && ctx.tb) return tabAbrir(ctx.tb.id);
  const sel = dsD() ? dsSel().filter(dsEditable) : [];
  if (a === "terminar") return PLH.h === "rec" ? plTerminarRecorrido() : dsTerminar();
  if (a === "cancelar" || a === "soltar") {
    if (a === "cancelar") return plHerr(null);
    PL_ASEL.clear();
    PLH.obj = -1;
    edProps();
    return plSobreDibujar();
  }
  if (a === "copiar") return dsCopiar();
  if (a === "cortar") return edBorrar(true);
  if (a === "pegar") return dsPegar();
  if (a === "duplicar") {
    dsCopiar();
    return dsPegar();
  }
  if (a === "borrar") return edBorrar(false);
  if (/^(vquitar|vpartir|tvert|tpartir|trecto|tarco|tinv|tquitar)$/.test(a)) return edPoli(a, ED_MENU.poli, ED_MENU.p);
  if (a === "unir") {
    const r = dsUnir(sel[0], sel[1]);
    if (typeof r === "string") return toast(r);
    edCambio();
    edProps();
    return toast(r.gap ? `Unidas con un tramo recto de ${plFm(r.gap)} m` : "Unidas en una sola");
  }
  if (a === "todorecto") return dsCurvar("recto");
  if (a === "ducha" || a === "noducha") {
    const s = new Set(EPL.duchas || []);
    PL_ASEL.forEach(e => (a === "ducha" ? s.add(e) : s.delete(e)));
    if (s.size) EPL.duchas = [...s];
    else delete EPL.duchas;
    edCambio();
    if (!$("revDlg").hidden) revRender();
    return toast(
      a === "ducha"
        ? "Ducha o tina marcada: la revisión mide desde ella los tomacorrientes e interruptores del baño"
        : "Ya no se toma como ducha o tina"
    );
  }
  if (a === "borrarArq") {
    DS_SEL.clear();
    return edBorrar(false);
  }
  if (a === "girar") return dsGirar();
  if (a === "g-90") return dsGirar(-90);
  if (a === "g180") return dsGirar(180);
  if (a === "gexacto") return edAnguloExacto(sel[0].id);
  if (a === "gang")
    return plPedir("Ángulo de giro (°, positivo: antihorario)", "45", v => {
      const g = parseFloat(String(v).replace(",", "."));
      plPedir(null);
      if (!Number.isFinite(g) || !g) return toast("Escriba un ángulo en grados, distinto de cero");
      dsGirar(g);
    });
  if (a === "letra0" || a === "colcapa") {
    sel.forEach(el => delete el[a === "colcapa" ? "col" : "dt"]);
    return edCambio();
  }
  if (a === "enc")
    return plPedir("Letra de encendido (vacío: quitar)", sel.find(dsConEnc).enc || "a", v => {
      plPedir(null);
      sel.filter(dsConEnc).forEach(el => {
        const l = dsEncLimpio(v, el);
        if (l) el.enc = l;
        else delete el.enc;
      });
      edCambio();
    });
  if (a === "acapa") {
    sel.forEach(el => (el.capa = dsD().actual));
    return edCambio();
  }
  if (a === "similares") return sel.length && dsSelTipo(dsTipo(sel[0]));
  if (a === "encuadrar") {
    const bb = sel.map(dsBBox),
      x0 = Math.min(...bb.map(q => q[0])),
      y0 = Math.min(...bb.map(q => q[1])),
      x1 = Math.max(...bb.map(q => q[2])),
      y1 = Math.max(...bb.map(q => q[3])),
      m = Math.max(x1 - x0, y1 - y0, 1) * 0.4;
    return plVer(x0 - m, y0 - m, x1 + m, y1 + m);
  }
  if (a === "tablero") return tabAbrir(sel[0].id);
  if (a === "ruta") return dpRuta();
  if (a === "bloque") return dpGuardarBloque();
  if (a === "aplanta") return dpCopiarAPlanta();
  if (a === "pbase") return dpPuntoBase(ED_MENU.pb);
  if (a === "montante") return dpMontante();
  if (a === "irmon") return dpIrMontante();
  if (a === "rotulo") return dcPonerRotulo();
  if (a === "ventana") return elAbrir(sel[0].id);
  if (a === "props") {
    edProps.oculto = false;
    edPanGuardar();
    return plPanel();
  }
  if (a === "ocultar" || a === "aislar") {
    const capa = PL_MOD.trazos[PLH.obj].capa;
    EPL.ocultas =
      a === "ocultar" ? [...new Set([...EPL.ocultas, capa])] : Object.keys(PL_MOD.capas).filter(n => n !== capa);
    PL_ASEL.clear();
    PLH.obj = -1;
    plPreparar();
    edCambio();
    return toast(
      a === "ocultar"
        ? `Capa ${capa} oculta`
        : `Solo se ve la capa ${capa}: «Mostrar todas las capas» con clic derecho en un lugar vacío`
    );
  }
  if (a === "todo") return dsTodo();
  if (a === "biblio") return bibAbrir();
  if (a === "fila" || a === "espejo") return dsIniciarCopia(a);
  if (a === "ley") {
    const q = ED_MENU.p || plPuntoActual();
    if (!q) return;
    dsCapa(DS_SIS.txt.capa);
    DS_SEL.clear();
    DS_SEL.add(dsAgregar({ t: "ley", x: q[0], y: q[1], tit: "LEYENDA", capa: DS_SIS.txt.capa }).id);
    return edCambio();
  }
  if (a === "ajustar") return plAjustar();
  if (a === "mostrar") {
    EPL.ocultas = [];
    plPreparar();
    return edCambio();
  }
  if (a === "restaurar") {
    delete EPL.borr;
    plPreparar();
    return edCambio();
  }
}
plLienzo.addEventListener("contextmenu", e => {
  e.preventDefault();
  if (!PL_MOD || !EPL || PLH.pan) return;
  $("edRefs").hidden = true;
  if (PLH.h) {
    edMenuCerrar();
    if (PLH.h === "rec" && !PLH.med && PLH.pts.length > 1) return plTerminarRecorrido();
    if (PLH.pts.length && dsTerminar()) return;
    return plHerr(null);
  }
  edMenuAbrir(e);
});
ED_MENU.addEventListener("click", e => {
  const b = e.target.closest("[data-edm]");
  if (b && !b.disabled) edMenuAccion(b.dataset.edm);
});
ED_MENU.addEventListener("contextmenu", e => e.preventDefault());
ED_MENU.addEventListener("change", e => ED_MENU.fnCambio && ED_MENU.fnCambio(e));
// Se cierra al hacer clic fuera, con Esc, con la rueda o al salir del editor
addEventListener(
  "pointerdown",
  e => {
    if (!ED_MENU.hidden && !e.target.closest("#edMenu")) edMenuCerrar();
  },
  true
);
addEventListener(
  "keydown",
  e => {
    if (!ED_MENU.hidden && e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      edMenuCerrar();
    }
  },
  true
);
plLienzo.addEventListener("wheel", edMenuCerrar, { passive: true });

/* Paneles del editor, como los del espacio de trabajo: el ancho se cambia arrastrando su borde (doble clic: el de
   siempre), se cierran con × (y se vuelven a abrir en Vista › Paneles) y se recuerdan en este navegador */
const ED_PAN = { izq: { el: "plLado", w: null }, der: { el: "edProp", w: null } },
  ED_PAN_K = "jmg-electric-editor-paneles";
function edPanGuardar() {
  try {
    localStorage.setItem(
      ED_PAN_K,
      JSON.stringify({
        izq: { oculto: !!plPanel.oculto, w: ED_PAN.izq.w },
        der: { oculto: !!edProps.oculto, w: ED_PAN.der.w }
      })
    );
  } catch (e) {}
}
const edPanAncho = () => Object.values(ED_PAN).forEach(p => ($(p.el).style.width = p.w ? p.w + "px" : ""));
try {
  const o = JSON.parse(localStorage.getItem(ED_PAN_K) || "null");
  if (o) {
    plPanel.oculto = !!(o.izq && o.izq.oculto);
    edProps.oculto = !!(o.der && o.der.oculto);
    Object.keys(ED_PAN).forEach(k => (ED_PAN[k].w = o[k] && +o[k].w > 0 ? +o[k].w : null));
  }
} catch (e) {}
edPanAncho();
document.querySelectorAll("#editor .ed-sp").forEach(sp => {
  const k = sp.dataset.esp,
    p = ED_PAN[k];
  sp.addEventListener("pointerdown", e => {
    e.preventDefault();
    try {
      sp.setPointerCapture(e.pointerId);
    } catch (_) {}
    sp.classList.add("drag");
    document.body.classList.add("arrastrando");
    const mv = ev => {
      const r = document.querySelector("#editor .ed-main").getBoundingClientRect(),
        otro = ED_PAN[k === "izq" ? "der" : "izq"],
        wo = $(otro.el).hidden ? 0 : $(otro.el).offsetWidth,
        // Las coordenadas del mouse están en píxeles de pantalla; se dividen por la escala del espacio de trabajo
        S = parseFloat(getComputedStyle($("ws")).zoom) || 1,
        w = (k === "izq" ? ev.clientX - r.left : r.right - ev.clientX) / S;
      p.w = Math.round(Math.max(170, Math.min(560, r.width / S - wo - 320, w)));
      edPanAncho();
    };
    const up = () => {
      sp.classList.remove("drag");
      document.body.classList.remove("arrastrando");
      removeEventListener("pointermove", mv);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      edPanGuardar();
    };
    addEventListener("pointermove", mv);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  });
  sp.addEventListener("dblclick", () => {
    p.w = null;
    edPanAncho();
    edPanGuardar();
    toast("Ancho del panel restablecido");
  });
});
$("editor").addEventListener("click", e => {
  const x = e.target.closest("[data-edx]");
  if (!x) return;
  if (x.dataset.edx === "izq") plPanel.oculto = true;
  else edProps.oculto = true;
  edPanGuardar();
  plPanel();
  toast("Panel cerrado: se vuelve a abrir en Vista › Paneles");
});
new MutationObserver(() => {
  if (!ED.abierto) return;
  dsFondo();
  plPanel();
  plDibujar();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-paleta"] });

/* ---------- Pestaña Diseño del espacio de trabajo: abre el editor ---------- */
$("ws").addEventListener("click", e => {
  const b = e.target.closest("#ws > .ap-ribbon [data-pl]");
  if (!b) return;
  if (b.dataset.pl === "editor") edAbrir(false);
  else if (b.dataset.pl === "abrirEd") edAbrir(true);
});

/* ---------- Editor: barra de título, pestañas y cinta ---------- */
$("editor").addEventListener("click", e => {
  const ed = e.target.closest("[data-ed]"),
    tab = e.target.closest("[data-tab-e]"),
    tg = e.target.closest("[data-edtg]");
  if (ed && !ed.disabled) {
    const a = ed.dataset.ed;
    if (a === "undo") edHist(-1);
    else if (a === "redo") edHist(1);
    else if (a === "aplicar") edAplicar();
    else if (a === "guardar") {
      edAplicar();
      guardarAhora();
    } else if (a === "aceptar") {
      edAplicar();
      edCerrar();
    } else if (a === "cancelar") edCancelar();
    return;
  }
  if (tab) {
    if (DSU.cintaMin) edCinta(true);
    $("editor")
      .querySelectorAll("[data-tab-e]")
      .forEach(t => t.classList.toggle("on", t === tab));
    $("editor")
      .querySelectorAll("[data-rib-e]")
      .forEach(r => (r.hidden = r.dataset.ribE !== tab.dataset.tabE));
    return;
  }
  if (tg) {
    const v = tg.dataset.edtg;
    return v === "rej" || v === "forz" || v === "polar" ? dsAlternarRejilla(v, v === "polar") : edAlternar(v, false);
  }
  const b = e.target.closest("[data-pl]");
  if (!b || b.disabled) return;
  const a = b.dataset.pl;
  if (a === "abrir") return $("plArchivo").click();
  if (a === "actarq") {
    if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
    PLH.actArq = true;
    toast("Elija la versión nueva del plano de arquitectura (DXF): se compara con la actual y el diseño se conserva");
    return $("plArchivo").click();
  }
  if (a === "cambios") return dpCambiosAbrir();
  if (a === "fondo") {
    const v = $("edFondo");
    v.hidden = !v.hidden;
    if (v.hidden) return;
    dsFondoLista();
    const ed = $("editor").getBoundingClientRect(),
      r = b.getBoundingClientRect(),
      S = parseFloat(getComputedStyle($("ws")).zoom) || 1;
    Object.assign(v.style, {
      top: (r.bottom - ed.top) / S + 4 + "px",
      left: Math.max(4, Math.min((r.left - ed.left) / S, ed.width / S - 290)) + "px",
      right: "auto",
      bottom: "auto"
    });
    return;
  }
  if (a === "panel" || a === "props") {
    if (a === "panel") plPanel.oculto = !plPanel.oculto;
    else edProps.oculto = !edProps.oculto;
    edPanGuardar();
    plPanel();
    plTam();
    return plDibujar();
  }
  if (a === "sel") return plHerr(null);
  if (a === "flip") {
    // Con una tubería en curso, invierte su próxima curva; si no, las curvas de lo seleccionado
    if (dsEsTub(PLH.h)) {
      PLH.lado = -(PLH.lado || 1);
      return plSobreDibujar();
    }
    return dsCurvar("invertir");
  }
  if (a === "capas") return capasAbrir();
  if (a === "revisar") return revAbrir();
  if (a === "plantillas") return plaAbrir();
  if (a === "versiones") return verAbrir();
  if (a === "ruta") return dpRuta();
  if (a === "rep" || a === "rmur") return dpIniciarRep(a);
  if (a === "metrado") return metAbrir();
  if (a === "calc") return dcAbrir();
  if (a === "lums") return lumAbrir();
  if (a === "muros") return murAbrir();
  if (a === "amb") return ambAbrir();
  if (a === "lux") return luxAbrir();
  if (a === "buscar") return buAbrir();
  if (a === "presentar") return edPresentar(true);
  if (a === "atajos") return atjAbrir();
  if (a === "lamina") return lamAbrir();
  if (a === "lamplanta") {
    dsAsegurar();
    return lamPorPlanta();
  }
  if (a === "lamtodas") {
    dsAsegurar();
    return lamImprimir(true);
  }
  // Expediente con el diseño tal como está en el editor (se guarda solo en el proyecto): el mismo diálogo del cálculo
  if (a === "expediente") {
    edGuardarYa();
    if (PRINT && entregable()) pdfDialogo(true);
    else if (!LAST) toast("Complete los datos del cálculo para generar el expediente");
    return;
  }
  if (a === "dxfdis" || a === "dxftodo") return lamDxf(a === "dxftodo");
  if (a === "biblio") return bibAbrir();
  if (a === "fila" || a === "espejo") return dsIniciarCopia(a);
  if (a === "girar") return dsGirar();
  if (a === "borrar") return edBorrar(false);
  if (a === "copiar") {
    dsCopiar();
    return dsPegar();
  }
  if (a === "quitar") {
    if (!EPL) return toast("El proyecto no tiene plano de arquitectura");
    return confirmar(
      "¿Quitar el plano de arquitectura?",
      `<p>El diseño deja de usar <b>${esc(EPL.nombre)}</b> y se pierden su escala, capas ocultas, plantas encuadradas${EPL.dis && EPL.dis.els.length ? ` y <b>los ${EPL.dis.els.length} elementos del diseño eléctrico</b>` : ""} (al aplicar los cambios). El archivo DXF de su computadora no cambia; puede volver a abrirlo.</p>`,
      "Quitar",
      ok => {
        if (!ok) return;
        EPL = null;
        PL_MOD = PL_SHA = null;
        PLH.obj = -1;
        plHerr(null);
        plPreparar();
        edCambio();
      }
    );
  }
  if (!PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  if (a === "ajustar") plAjustar();
  else if (a === "fondo0") {
    DSU.fondo = "tema";
    DSU.calido = 0;
    DSU.brillo = 100;
    dsGuardarPref();
    dsCinta();
    dsFondo();
  } else if (a === "zprev") plVistaAnterior();
  else if (a === "acercar") plZoom(1.5);
  else if (a === "alejar") plZoom(1 / 1.5);
  else if (a === "todas" || a === "ninguna") {
    EPL.ocultas = a === "todas" ? [] : Object.keys(PL_MOD.capas);
    PLH.obj = -1;
    plPreparar();
    edCambio();
  } else if (PL_NOMH[a] || a.startsWith("col:")) {
    if (a.startsWith("col:") || DS_HERR[a]) DS_SEL.clear();
    plHerr(PLH.h === a ? null : a);
  }
});
$("plArchivo").addEventListener("change", e => {
  plAbrir(e.target.files[0]);
  e.target.value = "";
});
$("plVacioB").addEventListener("click", () => $("plArchivo").click());
$("plTenue").addEventListener("change", e => {
  if (!EPL) return;
  EPL.tenue = e.target.checked;
  // Atenuado: la ventana de selección toma solo el diseño (un clic aún elige la arquitectura); se suelta lo elegido
  if (EPL.tenue) {
    PL_ASEL.clear();
    PLH.obj = -1;
  }
  PL_COL.clear();
  edCambio();
});
$("plUnidad").addEventListener("change", e => {
  if (!EPL || e.target.value === "x") return;
  EPL.f = +e.target.value;
  EPL.de = "manual";
  edCambio();
  toast("Unidad del dibujo cambiada: compruébela midiendo una cota conocida");
});
edInfo();
