/* EDITOR DE DISEÑO · HERRAMIENTAS, PROPIEDADES Y MOUSE
   Herramientas de medición, escala y plantas, panel de propiedades y manejo del mouse y el teclado sobre el plano.
   Antes era parte de js/plano.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Herramientas: distancia, recorrido, longitud de objetos, escala y plantas ---------- */
function plHerr(h) {
  PLH.h = h;
  PLH.pts = [];
  PLH.sel = [];
  PLH.med = null;
  PLH.eng = null;
  PLH.arr = PLH.marco = PLH.alin = PLH.agarre = null;
  PLH.bul = [];
  PLH.lado = 1;
  PLH.cirIni = null;
  PLH.conIni = null;
  PLH.modoT = null;
  PLH.ali = false;
  plPedir(null);
  // Sin herramienta, el modo es Seleccionar
  document.querySelectorAll("#editor [data-pl]").forEach(b => b.classList.toggle("on", b.dataset.pl === (h || "sel")));
  plLienzo.classList.toggle("con-herr", !!h);
  plLienzo.classList.toggle("herr-mano", h === "mano");
  plOrden();
  edProps();
  plSobreDibujar();
}
// Indicación de la herramienta, como la línea de comandos de los programas de dibujo
function plOrden(txt) {
  const c = $("plCmdT");
  if (txt !== undefined) c.innerHTML = txt;
  else if (!PLH.h) c.innerHTML = "";
  else {
    const n = PLH.pts.length,
      T = {
        dist: n ? "Designe el segundo punto" : "Designe el primer punto",
        rec: n
          ? "Designe el siguiente punto · <b>Intro</b> o doble clic para terminar"
          : "Designe el primer punto del recorrido",
        obj: "Haga clic en las líneas o curvas para sumar su longitud · clic de nuevo para quitarla",
        escala: n
          ? "Designe el segundo punto de la medida conocida"
          : "Designe el primer punto de una medida conocida (por ejemplo, los extremos de una cota)",
        planta: n ? "Designe la esquina opuesta" : "Designe una esquina de la planta",
        mano: "Arrastre para desplazar el plano · rueda para acercar o alejar",
        zventana: n ? "Designe la esquina opuesta" : "Designe una esquina del rectángulo que quiere ver",
        lamzona: n ? "Designe la esquina opuesta" : "Designe una esquina de lo que va en la lámina"
      };
    c.innerHTML = dsEsHerr(PLH.h)
      ? dsOrden(PLH.h, n)
      : `<b>${PL_NOMH[PLH.h]}</b> · ${T[PLH.h]} · <span class="pl-k">Esc</span> para salir`;
  }
  $("plCmd").hidden = !c.innerHTML;
}
// Pide un dato en la línea de comandos (medida real, nombre de la planta, longitud escrita) y llama a fn con lo
// escrito; con seguir, el texto ya escrito queda y se sigue escribiendo a continuación
function plPedir(etq, val, fn, seguir) {
  const box = $("plCmdIn");
  plPedir.fn = fn || null;
  plPedir.din = !!seguir;
  box.hidden = !etq;
  $("plCmd").hidden = !$("plCmdT").innerHTML && !etq;
  if (!etq) {
    if (document.activeElement === $("plCmdV")) $("plCmdV").blur();
    return;
  }
  $("plCmdL").textContent = etq;
  $("plCmdV").value = val;
  $("plCmdV").inputMode = /medida|longitud|radio/i.test(etq) ? "decimal" : "text";
  const foco = () => {
    $("plCmdV").focus();
    if (seguir) $("plCmdV").setSelectionRange(val.length, val.length);
    else $("plCmdV").select();
  };
  if (seguir) foco();
  else setTimeout(foco, 20);
}
function plAceptarPedido() {
  const fn = plPedir.fn;
  if (fn) fn($("plCmdV").value.trim());
}
$("plCmdOk").addEventListener("click", plAceptarPedido);
$("plCmdV").addEventListener("input", () => (PLH.h === "rep" || PLH.h === "rmur") && plSobreDibujar());
$("plCmdV").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    plAceptarPedido();
  } else if (e.key === "Escape") {
    // Una longitud escrita se descarta; con otro dato, se sale de la herramienta
    if (plPedir.din) plPedir(null);
    else plHerr(null);
  }
  e.stopPropagation();
});
function plPunto(p) {
  const h = PLH.h;
  if (h === "obj") {
    const i = plObjeto(p[0], p[1], (8 * plDpr()) / PLV.s);
    if (i < 0) return plSumaObjetos();
    const k = PLH.sel.indexOf(i);
    if (k >= 0) PLH.sel.splice(k, 1);
    else PLH.sel.push(i);
    return plSumaObjetos();
  }
  if (PLH.med) {
    PLH.pts = [];
    PLH.med = null;
  }
  PLH.pts.push(p);
  const n = PLH.pts.length;
  if (h === "lamzona") {
    if (n < 2) return plOrden();
    const [a, b] = PLH.pts;
    plHerr(null);
    return lamZonaMarcada([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
  }
  if (h === "zventana") {
    if (n < 2) return plOrden();
    const [a, b] = PLH.pts;
    plHerr(null);
    if (Math.abs(a[0] - b[0]) * PLV.s > 6 && Math.abs(a[1] - b[1]) * PLV.s > 6)
      plVer(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
    return;
  }
  if (h === "dist" && n === 2) {
    const [a, b] = PLH.pts,
      l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    PLH.med = true;
    plOrden(
      `<b>Distancia ${plFm(l)} m</b> · ΔX ${plFm(Math.abs(b[0] - a[0]))} m · ΔY ${plFm(Math.abs(b[1] - a[1]))} m · ángulo ${fmt((ang + 360) % 360, 1)}° · clic para medir otra · <span class="pl-k">Esc</span> para salir`
    );
  } else if (h === "escala" && n === 2) {
    const [a, b] = PLH.pts,
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(l > 0)) {
      PLH.pts = [];
      return plOrden();
    }
    PLH.med = true;
    plOrden(`<b>Comprobar escala</b> · en el dibujo: ${plFm(l)} m`);
    plPedir("Medida real entre los dos puntos (m)", plFm(l), v => {
      const real = parseFloat(v.replace(",", "."));
      if (!(real > 0)) return toast("Escriba la medida real en metros, mayor que cero");
      EPL.f = real / l;
      EPL.de = "manual";
      plHerr(null);
      edCambio();
      toast(`Escala comprobada: 1 unidad del dibujo = ${fmt(EPL.f, EPL.f < 0.01 ? 4 : 3)} m`);
    });
  } else if (h === "planta" && n === 2) {
    const [a, b] = PLH.pts;
    if (Math.abs(a[0] - b[0]) * PLV.s < 8 || Math.abs(a[1] - b[1]) * PLV.s < 8) {
      PLH.pts = [];
      return plOrden();
    }
    PLH.med = true;
    const k = EPL.plantas.length + 1;
    plOrden(`<b>Encuadrar planta</b> · ${plFm(Math.abs(a[0] - b[0]))} × ${plFm(Math.abs(a[1] - b[1]))} m`);
    plPedir("Nombre de la planta", `${ORD(k)} piso`, v => {
      if (!v) return toast("Escriba un nombre para la planta");
      EPL.plantas.push({
        n: v.replace(/[<>]/g, "").slice(0, 60),
        x0: Math.min(a[0], b[0]),
        y0: Math.min(a[1], b[1]),
        x1: Math.max(a[0], b[0]),
        y1: Math.max(a[1], b[1])
      });
      plHerr(null);
      edCambio();
      toast("Planta encuadrada: haga clic en su nombre, en el panel Plantas, para verla");
    });
  } else plOrden();
  plSobreDibujar();
}
function plSumaObjetos() {
  const L = PLH.sel.reduce((s, i) => s + plLargo(PL_MOD.trazos[i]), 0),
    capas = [...new Set(PLH.sel.map(i => PL_MOD.trazos[i].capa))];
  plOrden(
    PLH.sel.length
      ? `<b>${PLH.sel.length} objeto${PLH.sel.length > 1 ? "s" : ""} · ${plFm(L)} m</b> · capa${capas.length > 1 ? "s" : ""} ${esc(capas.slice(0, 3).join(", "))}${capas.length > 3 ? "…" : ""} · clic en otro para sumarlo · <span class="pl-k">Esc</span> para salir`
      : undefined
  );
  plSobreDibujar();
}
function plTerminarRecorrido() {
  if (PLH.h !== "rec" || PLH.pts.length < 2) return;
  let L = 0;
  for (let i = 1; i < PLH.pts.length; i++)
    L += Math.hypot(PLH.pts[i][0] - PLH.pts[i - 1][0], PLH.pts[i][1] - PLH.pts[i - 1][1]);
  PLH.med = true;
  plOrden(
    `<b>Recorrido ${plFm(L)} m</b> · ${PLH.pts.length - 1} tramo${PLH.pts.length > 2 ? "s" : ""} · clic para medir otro · <span class="pl-k">Esc</span> para salir`
  );
  plSobreDibujar();
}
// Seleccionar: un clic en una línea la elige y muestra sus propiedades; en un lugar vacío, la suelta
function plSeleccionar(p, suma) {
  PLH.obj = EPL.tenue ? -1 : plObjeto(p[0], p[1], (8 * plDpr()) / PLV.s);
  if (!suma) PL_ASEL.clear();
  if (PLH.obj >= 0) {
    const n = PL_MOD.trazos[PLH.obj].e;
    if (suma && PL_ASEL.has(n)) {
      PL_ASEL.delete(n);
      PLH.obj = -1;
    } else PL_ASEL.add(n);
  }
  edProps();
  plSobreDibujar();
}

/* ---------- Panel de propiedades: el objeto seleccionado o, si no hay, el plano ---------- */
const PL_ENT = {
  LINE: "Línea",
  LWPOLYLINE: "Polilínea",
  POLYLINE: "Polilínea",
  ARC: "Arco",
  CIRCLE: "Círculo",
  ELLIPSE: "Elipse",
  SPLINE: "Curva spline",
  LEADER: "Directriz"
};
const PL_VER = {
  AC1009: "R12",
  AC1012: "R13",
  AC1014: "R14",
  AC1015: "2000",
  AC1018: "2004",
  AC1021: "2007",
  AC1024: "2010",
  AC1027: "2013",
  AC1032: "2018"
};
function edProps() {
  const c = $("edPropC"),
    m = PL_MOD;
  const fila = (k, v) => `<div class="ed-pf"><span>${k}</span><b>${v}</b></div>`;
  if (!m || !EPL) {
    c.innerHTML = `<p class="pl-nota">Abra el plano de arquitectura para ver sus propiedades.</p>`;
    return;
  }
  if (DS_SEL.size && !PLH.h) return dsProps(c);
  if (PLH.obj < 0 || PLH.h) {
    const oc = new Set(EPL.ocultas),
      capas = Object.keys(m.capas).filter(n => m.capas[n].n > 0);
    c.innerHTML =
      `<div class="ed-pt">Plano de arquitectura</div>` +
      fila("Archivo", `<span title="${esc(EPL.nombre)}">${esc(EPL.nombre)}</span>`) +
      fila("Formato", `DXF · AutoCAD ${PL_VER[m.version] || m.version}`) +
      fila("Tamaño", `${fmt(EPL.kb / 1024, 1)} MB`) +
      fila("Unidad", `${plNomUnidad(EPL.f)}<small>${PL_DE[EPL.de] || ""}</small>`) +
      fila("Capas", `${capas.filter(n => !oc.has(n)).length} visibles de ${capas.length}`) +
      fila("Objetos", m.nEnt.toLocaleString("es-PE")) +
      fila("Bloques", m.nBloques) +
      fila("Plantas", EPL.plantas.length || "—") +
      (PL_BORR.size ? fila("Objetos borrados", PL_BORR.size.toLocaleString("es-PE")) : "") +
      `<p class="pl-nota">Haga clic en una línea del plano para ver sus propiedades. La arquitectura es una referencia: se consulta y se mide, pero no se mueve. Lo que sobre (muebles, textos, achurados) se puede borrar con <span class="pl-k">Supr</span> o <span class="pl-k">Ctrl</span>+<span class="pl-k">X</span>: solo se oculta en la plataforma; el archivo DXF no cambia.</p>` +
      (PL_BORR.size
        ? `<div class="ed-pb"><button type="button" class="btn sec sm" data-pl-rest>Restaurar los borrados</button></div>`
        : "");
    return;
  }
  const t = m.trazos[PLH.obj],
    L = plLargo(t),
    curva = /ARC|CIRCLE|ELLIPSE|SPLINE/.test(t.ent),
    totCapa = m.trazos.filter(x => x.capa === t.capa && x.k === "l").reduce((s, x) => s + plLargo(x), 0);
  c.innerHTML =
    `<div class="ed-pt">${PL_ENT[t.ent] || t.ent}${t.bl ? `<small>en el bloque ${esc(t.bl)}</small>` : ""}</div>` +
    fila("Capa", `<i class="ed-sw" style="background:${plColor(t.col)}"></i>${esc(t.capa)}`) +
    fila("Tipo de línea", t.lt ? esc(t.lt.toLowerCase()) : "continua") +
    fila(t.ent === "CIRCLE" ? "Perímetro" : "Longitud", `${plFm(L)} m`) +
    (t.c && t.p.length >= 6 ? fila("Área", `${fmt(plArea(t) * EPL.f * EPL.f, 2)} m²`) : "") +
    (curva ? "" : fila("Vértices", t.p.length / 2 - (t.c && t.ent !== "LINE" ? 1 : 0))) +
    fila("Cerrado", t.c ? "sí" : "no") +
    fila("Toda la capa", `${plFm(totCapa)} m`) +
    (PL_ASEL.size > 1 ? fila("Elegidos", `${PL_ASEL.size} objetos`) : "") +
    `<p class="pl-nota ed-bloq"><b>No se mueve:</b> la arquitectura es una referencia del plano del arquitecto. Se puede borrar${t.bl ? " (el bloque completo)" : ""}; el archivo DXF no cambia.</p>` +
    `<div class="ed-pb"><button type="button" class="btn sec sm" data-pl-oc="${esc(t.capa)}">Ocultar la capa</button><button type="button" class="btn sec sm ed-del" data-pl-del title="Supr o Ctrl+X">Borrar</button></div>`;
}
// Borra lo elegido, del diseño y de la arquitectura, en un solo paso de deshacer; con cortar, lo del diseño queda
// copiado para pegarlo con Ctrl+V
function edBorrar(cortar) {
  const sel = dsD() ? dsSel().filter(dsEditable) : [],
    na = PL_ASEL.size;
  if (!sel.length && !na) return toast("Elija primero lo que quiere borrar");
  if (sel.length) {
    if (cortar) DS_PORTA = sel.map(el => JSON.parse(JSON.stringify(el)));
    const ids = new Set(sel.map(el => el.id));
    dsD().els = dsD().els.filter(el => !ids.has(el.id));
    DS_SEL.clear();
  }
  if (na) {
    EPL.borr = [...new Set([...(EPL.borr || []), ...PL_ASEL])].sort((a, b) => a - b);
    PL_ASEL.clear();
    PLH.obj = -1;
    plPreparar();
  }
  edCambio();
  const s = n => (n > 1 ? "s" : ""),
    partes = [];
  if (sel.length) partes.push(`${sel.length} elemento${s(sel.length)} del diseño`);
  if (na) partes.push(`${na} objeto${s(na)} de la arquitectura`);
  toast(
    `${partes.join(" y ")}: ${cortar && sel.length ? "cortado" : "borrado"}${s(sel.length + na)} · Ctrl+Z para deshacer${cortar && sel.length ? " · Ctrl+V para pegar" : ""}`
  );
}
$("edPropC").addEventListener("click", e => {
  if (e.target.closest("[data-pl-del]")) return edBorrar(false);
  if (e.target.closest("[data-pl-rest]")) {
    const n = (EPL.borr || []).length;
    delete EPL.borr;
    plPreparar();
    edCambio();
    return toast(`${n} objeto${n > 1 ? "s" : ""} de la arquitectura restaurado${n > 1 ? "s" : ""}`);
  }
  const b = e.target.closest("[data-pl-oc]");
  if (!b) return;
  EPL.ocultas = [...new Set([...EPL.ocultas, b.dataset.plOc])];
  PLH.obj = -1;
  plPreparar();
  edCambio();
});

/* ---------- Mouse y teclado sobre el plano ----------
   Como en los programas de dibujo: la rueda acerca y aleja; la rueda presionada (o la barra espaciadora con el botón
   izquierdo) desplaza la vista; en Seleccionar, un clic elige, arrastrar un elemento del diseño lo mueve, arrastrar
   un pinzamiento edita el elemento (vértice, curvatura del tramo, radio, línea de cota) y arrastrar sobre un lugar
   vacío hace un marco de selección (de izquierda a derecha, ventana; al revés, captura). Mayús presionada coloca y
   mueve sin enganche. Con una herramienta de dibujo, escribir un número da la longitud del tramo. */
let PL_ESPACIO = false;
// El lienzo sigue al mouse aunque salga de él mientras se arrastra (si el navegador lo permite)
const plCapturar = e => {
  try {
    plLienzo.setPointerCapture(e.pointerId);
  } catch (_) {}
};
plLienzo.addEventListener(
  "wheel",
  e => {
    if (!PL_MOD) return;
    e.preventDefault();
    const [X, Y] = plMouse(e),
      f = Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 33 : 1));
    plZoom(Math.min(4, Math.max(0.25, f)), X, Y);
  },
  { passive: false }
);
plLienzo.addEventListener("pointerdown", e => {
  if (!PL_MOD || e.target.closest(".pl-cmd, .pl-nav, .ed-ang")) return;
  $("edRefs").hidden = true;
  const [X, Y] = plMouse(e);
  if (e.button === 1 || (e.button === 0 && (PL_ESPACIO || PLH.h === "mano"))) {
    plVistaPush(true);
    e.preventDefault();
    // Doble clic con la rueda: ajustar a la pantalla
    if (e.button === 1) {
      const t = Date.now();
      if (t - (plLienzo.ultRueda || 0) < 350) {
        plLienzo.ultRueda = 0;
        return plAjustar();
      }
      plLienzo.ultRueda = t;
    }
    PLH.pan = { X, Y, cx: PLV.cx, cy: PLV.cy, mov: false };
    plCapturar(e);
    plLienzo.classList.add("moviendo");
    return;
  }
  if (e.button !== 0) return;
  plCapturar(e);
  PLH.abajo = [X, Y];
  if (PLH.h) return;
  // Seleccionar: un pinzamiento de lo seleccionado edita; un elemento del diseño se elige y se prepara para moverlo;
  // si no, marco de selección
  const ag = dsD() && DS_SEL.size ? dsAgarreEn(X, Y) : null;
  if (ag) {
    PLH.agarre = { ...ag, orig: JSON.stringify(dsD().els.find(el => el.id === ag.id)), mov: false };
    return;
  }
  const p = plADib(X, Y),
    id = dsD() ? dsHit(p[0], p[1], (6 * plDpr()) / PLV.s) : null;
  if (id) dsPresionar(id, p, e.shiftKey);
  else PLH.marco = { X0: X, Y0: Y, X1: X, Y1: Y, mov: false, shift: e.shiftKey };
});
plLienzo.addEventListener("pointermove", e => {
  if (!PL_MOD) return;
  const [X, Y] = plMouse(e);
  if (PLH.pan) {
    PLH.pan.mov = true;
    PLV.cx = PLH.pan.cx - (X - PLH.pan.X) / PLV.s;
    PLV.cy = PLH.pan.cy + (Y - PLH.pan.Y) / PLV.s;
    plDibujar();
    return;
  }
  const p = plADib(X, Y);
  PLH.cur = p;
  PLH.libre = e.shiftKey;
  const lejos = PLH.abajo && Math.hypot(X - PLH.abajo[0], Y - PLH.abajo[1]) > 4 * plDpr();
  // Pinzamiento: la curvatura y la línea de cota siguen al cursor; lo demás se engancha
  if (PLH.agarre) {
    if (!lejos && !PLH.agarre.mov) return;
    PLH.agarre.mov = true;
    // La curvatura, la línea de cota, el giro y la letra siguen al cursor; lo demás se engancha
    PLH.eng = ["m", "o", "giro", "letra"].includes(PLH.agarre.t) ? null : plEnganche(p[0], p[1]);
    const q = plPuntoActual() || p;
    $("plXY").textContent = `X ${plFm(q[0])}   Y ${plFm(q[1])} m`;
    return dsAgarreMover(PLH.agarre, q);
  }
  const arrastre = PLH.arr && lejos;
  // El enganche actúa con las herramientas y al mover elementos (no con Longitud de objetos)
  PLH.eng = (PLH.h && PLH.h !== "obj") || arrastre || (PLH.arr && PLH.arr.mov) ? plEnganche(p[0], p[1]) : null;
  // Símbolo de pared: se encaja en el muro más cercano (sin Mayús)
  PLH.alin = PLH.h && PLH.h.startsWith("col:") && !PLH.libre ? dsAlinear(PLH.h.slice(4), p) : null;
  if (PLH.alin) PLH.eng = null;
  const q = plPuntoActual() || p;
  $("plXY").textContent = `X ${plFm(q[0])}   Y ${plFm(q[1])} m`;
  if (arrastre || (PLH.arr && PLH.arr.mov)) return dsMover(q);
  if (PLH.marco) {
    Object.assign(PLH.marco, { X1: X, Y1: Y });
    if (Math.hypot(X - PLH.marco.X0, Y - PLH.marco.Y0) > 4 * plDpr()) PLH.marco.mov = true;
    return plSobreDibujar();
  }
  if (PLH.h) return plSobreDibujar();
  // Lo que está bajo el cursor en Seleccionar: un pinzamiento, el diseño y, si no, la arquitectura
  const ag = DS_SEL.size ? dsAgarreEn(X, Y) : null,
    r = (6 * plDpr()) / PLV.s,
    id = ag ? null : dsD() ? dsHit(p[0], p[1], r) : null,
    i = id || ag || EPL.tenue ? -1 : plObjeto(p[0], p[1], (8 * plDpr()) / PLV.s);
  plLienzo.classList.toggle("sobre-dis", !!id);
  plLienzo.classList.toggle("sobre-ag", !!ag);
  const agk = ag ? `${ag.id}|${ag.t}|${ag.i}` : "",
    agk0 = PLH.agSobre ? `${PLH.agSobre.id}|${PLH.agSobre.t}|${PLH.agSobre.i}` : "";
  if (id !== PLH.dsSobre || i !== PLH.sobre || agk !== agk0) {
    PLH.dsSobre = id;
    PLH.sobre = i;
    PLH.agSobre = ag;
    plSobreDibujar();
  } else if (id && DSU.info !== false) plSobreDibujar(); // los datos siguen al cursor
});
plLienzo.addEventListener("pointerup", e => {
  if (PLH.pan) {
    PLH.pan = null;
    plLienzo.classList.remove("moviendo");
    return;
  }
  if (e.button !== 0 || !PLH.abajo) return;
  const [X, Y] = plMouse(e),
    lejos = Math.hypot(X - PLH.abajo[0], Y - PLH.abajo[1]) > 6 * plDpr();
  const abajo = PLH.abajo;
  PLH.abajo = null;
  if (PLH.agarre) {
    const ag = PLH.agarre,
      eng = PLH.eng;
    PLH.agarre = null;
    PLH.eng = null;
    if (ag.mov) dsAgarreSoltar(ag, eng);
    // Un clic (sin arrastrar) en el punto de giro: escribir el ángulo ahí mismo
    if (!ag.mov && ag.t === "giro") return edAngEditar();
    return ag.mov ? edCambio() : plSobreDibujar();
  }
  if (PLH.arr) return dsSoltar();
  if (PLH.marco) {
    const mc = PLH.marco;
    PLH.marco = null;
    if (mc.mov) return dsMarco(mc);
    // Clic en un lugar vacío: suelta la selección del diseño y elige la línea de la arquitectura bajo el cursor
    if (!mc.shift) DS_SEL.clear();
    return plSeleccionar(plADib(abajo[0], abajo[1]), mc.shift);
  }
  if (!PLH.h || lejos) return;
  // Un clic en el mismo punto que el anterior (doble clic) termina el recorrido, la polilínea o la tubería
  const p = plPuntoActual() || plADib(X, Y),
    u = PLH.pts[PLH.pts.length - 1];
  if (u && !PLH.med && Math.hypot(p[0] - u[0], p[1] - u[1]) * PLV.s < 3) {
    if (PLH.h === "rec") return plTerminarRecorrido();
    if (dsTerminar()) return;
  }
  if (!$("plCmdIn").hidden) return;
  if (dsEsHerr(PLH.h)) dsPunto(p);
  else plPunto(p);
});
plLienzo.addEventListener("pointerleave", () => {
  PLH.cur = PLH.eng = PLH.alin = null;
  PLH.sobre = -1;
  PLH.dsSobre = null;
  $("plXY").textContent = "";
  plSobreDibujar();
});
plLienzo.addEventListener("dblclick", e => {
  if (PLH.h === "rec") {
    e.preventDefault();
    plTerminarRecorrido();
  } else if (dsTerminar()) e.preventDefault();
  else if (!PLH.h && dsD()) {
    // Doble clic en un tablero: su ventana de circuitos
    const [X, Y] = plMouse(e),
      p = plADib(X, Y),
      id = dsHit(p[0], p[1], (6 * plDpr()) / PLV.s),
      el = id && dsD().els.find(x => x.id === id);
    if (el) el.k === "tab" ? tabAbrir(id) : elAbrir(id);
  }
});
// Herramientas que aceptan una longitud escrita (desde el último punto, en la dirección del cursor)
const PL_CON_LONG = ["dist", "rec", "lin", "pol", "rect", "cir", "tubT", "tubP", "fila", "areaP", "areaR"];
function plLongitudEscrita(tecla) {
  plPedir(
    PLH.h === "cir" ? "Radio (m)" : "Longitud del tramo (m)",
    tecla,
    v => {
      const L = parseFloat(String(v).replace(",", ".")),
        p = dsPuntoAdistancia(L);
      plPedir(null);
      if (!p) return toast("Escriba una longitud en metros, mayor que cero");
      if (dsEsHerr(PLH.h)) dsPunto(p);
      else plPunto(p);
    },
    true
  );
}
addEventListener("keydown", e => {
  if (!ED.abierto || document.querySelector(".welcome:not([hidden])")) return;
  const k = e.key.toLowerCase(),
    ctrl = e.ctrlKey || e.metaKey,
    // Un campo de una ventana ya cerrada (oculto) no cuenta: las teclas vuelven al plano
    enCampo =
      /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.offsetParent !== null;
  // Deshacer y rehacer del editor (el del proyecto no actúa mientras el editor está abierto)
  if (ctrl && (k === "z" || k === "y")) {
    if (enCampo) return;
    e.preventDefault();
    return edHist(k === "y" || e.shiftKey ? 1 : -1);
  }
  if (enCampo) return;
  if (ctrl && k === "f" && PL_MOD) {
    e.preventDefault();
    return buAbrir();
  }
  if (ctrl && k === "x") {
    if (!PL_MOD) return;
    e.preventDefault();
    return edBorrar(true);
  }
  if (ctrl && (k === "a" || k === "c" || k === "v")) {
    if (!dsD() || !PL_MOD) return;
    e.preventDefault();
    return k === "a" ? dsTodo() : k === "c" ? dsCopiar() : dsPegar();
  }
  // Comandos escritos: una letra (sin herramienta) abre la línea de comandos; R con selección gira y B abre la
  // biblioteca, como siempre
  if (
    /^[a-zA-Z]$/.test(e.key) &&
    !ctrl &&
    !e.altKey &&
    !PLH.h &&
    PL_MOD &&
    $("plCmdIn").hidden &&
    !(k === "r" && DS_SEL.size) &&
    k !== "b"
  ) {
    e.preventDefault();
    return edComando(e.key);
  }
  if (e.key === "Enter" && !PLH.h && ED.ultCmd && PL_MOD && $("plCmdIn").hidden) {
    e.preventDefault();
    return edEjecutar(ED.ultCmd);
  }
  // Longitud escrita con el teclado mientras se dibuja o se mide
  if (
    /^[0-9.,]$/.test(e.key) &&
    !ctrl &&
    PL_CON_LONG.includes(PLH.h) &&
    PLH.pts.length &&
    !PLH.med &&
    $("plCmdIn").hidden
  ) {
    e.preventDefault();
    return plLongitudEscrita(e.key === "," ? "0." : e.key === "." ? "0." : e.key);
  }
  if (e.key === " " && !PL_ESPACIO) {
    e.preventDefault();
    PL_ESPACIO = true;
    plLienzo.classList.add("mano");
  } else if (e.key === "Escape") {
    e.preventDefault();
    $("edRefs").hidden = true;
    if ($("editor").classList.contains("ed-pres")) return edPresentar(false);
    // Con un recorrido, polilínea o tubería en curso, Esc la termina; con otra herramienta, sale de ella; si no,
    // suelta la selección
    if (PLH.h === "rec" && !PLH.med && PLH.pts.length > 1) return plTerminarRecorrido();
    if (dsTerminar()) return;
    if (DP_COMP && !PLH.h) {
      DP_COMP = null;
      return plSobreDibujar();
    }
    if (PLH.h) return plHerr(null);
    if (DS_SEL.size || PLH.obj >= 0 || PL_ASEL.size) {
      DS_SEL.clear();
      PL_ASEL.clear();
      PLH.obj = -1;
      edProps();
      plSobreDibujar();
    }
  } else if (e.key === "Enter" && (PLH.h === "rec" || dsEsHerr(PLH.h))) {
    e.preventDefault();
    if (PLH.h === "rec") plTerminarRecorrido();
    else dsTerminar();
  } else if (e.key === "Delete" || e.key === "Supr") {
    e.preventDefault();
    if (!edQuitarVerticeBajoCursor()) edBorrar(false);
  } else if (k === "b" && !ctrl && !e.altKey && PL_MOD) {
    e.preventDefault();
    bibAbrir();
  } else if (k === "r" && !ctrl && dsD()) {
    e.preventDefault();
    dsGirar();
  } else if (k === "f" && !ctrl && dsEsTub(PLH.h)) {
    // Invierte el lado de la curva del tramo siguiente
    e.preventDefault();
    PLH.lado = -(PLH.lado || 1);
    plSobreDibujar();
  } else if (k === "c" && !ctrl && dsEsTub(PLH.h)) {
    e.preventDefault();
    DSU.curva = !DSU.curva;
    dsGuardarPref();
    dsCinta();
    plOrden();
    plSobreDibujar();
    toast(DSU.curva ? "Tramos curvos" : "Tramos rectos");
  } else if (e.key.startsWith("Arrow") && !PLH.h && DS_SEL.size) {
    e.preventDefault();
    const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0,
      dy = e.key === "ArrowDown" ? -1 : e.key === "ArrowUp" ? 1 : 0;
    dsEmpujar(dx, dy, e.shiftKey);
  } else if (e.key === "F3" || e.key === "F8") {
    e.preventDefault();
    edAlternar(e.key === "F3" ? "plSnap" : "plOrto");
  } else if (e.key === "F1" && ctrl) {
    e.preventDefault();
    edCinta(true);
  } else if (e.key === "F10") {
    e.preventDefault();
    dsAlternarRejilla("polar", true);
  } else if (e.key === "F7" || e.key === "F9") {
    e.preventDefault();
    dsAlternarRejilla(e.key === "F7" ? "rej" : "forz", true);
  }
});
addEventListener("keyup", e => {
  if (e.key === " ") {
    PL_ESPACIO = false;
    plLienzo.classList.remove("mano");
  }
});
new ResizeObserver(() => {
  if (ED.abierto && plTam()) plDibujar();
}).observe(plLienzo);
// Arrastrar un archivo DXF sobre el editor
["dragover", "drop"].forEach(t =>
  $("editor").addEventListener(t, e => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    if (t === "drop") plAbrir(e.dataTransfer.files[0]);
  })
);
// Ventanita de enganches: se abre con ▾ (barra de estado), con Puntos de enganche (cinta Medir) o con clic derecho
// en ENGANCHE, junto al botón; se cierra al hacer clic fuera
function edRefsAbrir(b, abrir = true) {
  const v = $("edRefs");
  v.hidden = !abrir;
  if (!abrir) return;
  const ed = $("editor").getBoundingClientRect(),
    r = b.getBoundingClientRect(),
    S = parseFloat(getComputedStyle($("ws")).zoom) || 1;
  if (b.closest(".ed-estado")) Object.assign(v.style, { top: "", left: "", right: "", bottom: "" });
  else
    Object.assign(v.style, {
      top: (r.bottom - ed.top) / S + 4 + "px",
      left: Math.max(4, (r.left - ed.left) / S) + "px",
      right: "auto",
      bottom: "auto"
    });
}
document.querySelector('#editor [data-edtg="plSnap"]').addEventListener("contextmenu", e => {
  e.preventDefault();
  edRefsAbrir(e.currentTarget);
});
$("editor").addEventListener("click", e => {
  const br = e.target.closest("[data-edrefs]");
  if (br) {
    edRefsAbrir(br, $("edRefs").hidden);
    return;
  }
  if (!e.target.closest("#edRefs")) $("edRefs").hidden = true;
  if (!e.target.closest('#edFondo, [data-pl="fondo"]')) $("edFondo").hidden = true;
  if (!e.target.closest('#edBuscar, [data-pl="buscar"]')) $("edBuscar").hidden = true;
});
// Enganche y orto: casilla en la cinta (Medir) y botón en la barra de estado, siempre iguales
function edAlternar(id, aviso = true) {
  const c = $(id);
  c.checked = !c.checked;
  edBotonesEstado();
  if (aviso) toast(`${id === "plSnap" ? "Enganche" : "Orto"} ${c.checked ? "activado" : "desactivado"}`);
  plSobreDibujar();
}
function edBotonesEstado() {
  if (typeof dsCinta === "function") dsCinta();
}
["plSnap", "plOrto"].forEach(id =>
  $(id).addEventListener("change", () => {
    edBotonesEstado();
    plSobreDibujar();
  })
);
