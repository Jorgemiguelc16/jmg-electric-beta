/* DISEÑO AVANZADO · REPARTIR, LIENZO Y PASOS DEL DISEÑO
   Repartir artefactos en un ambiente o a lo largo de un muro, bloque que se va a colocar y comparación con una
   versión, y pasos del diseño con el cálculo en vivo.
   Antes era parte de js/diseno-avanzado.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Repartir en un ambiente y a lo largo de un muro ----------
   Repartir: dos esquinas del ambiente y filas × columnas (se propone una cantidad con unos 2.5 m entre artefactos,
   criterio editable al escribir); cada artefacto queda en el centro de su parte del ambiente.
   A lo largo del muro: inicio y fin sobre el muro, un clic del lado del ambiente y la cantidad (o «c/3» para cada
   3 m); los de pared se encajan y giran contra el muro. El símbolo: el elegido o el último usado (B cambia). */
function dpIniciarRep(h, k) {
  plHerr(h);
  PLH.repK =
    k ||
    (dsSel()[0] && dsSel()[0].t === "sim" ? dsSel()[0].k : null) ||
    biRecientes()[0] ||
    (h === "rep" ? "luz" : "toma");
  DS_SEL.clear();
  plOrden();
}
function dpOrdenRep(h, n) {
  const c = DS_CAT[PLH.repK] || DS_CAT.luz,
    t =
      h === "rep"
        ? n
          ? "Esquina opuesta del ambiente"
          : "Una esquina del ambiente"
        : n === 0
          ? "Inicio sobre el muro"
          : n === 1
            ? "Fin sobre el muro"
            : "Clic del lado del ambiente";
  return `<b>${h === "rep" ? "Repartir en ambiente" : "A lo largo del muro"}</b> · ${esc(c.n)} · ${t} · <span class="pl-k">B</span> cambia el símbolo · <span class="pl-k">Esc</span> salir`;
}
// Posiciones (y giros) de los artefactos que se van a colocar
function dpPosRep(nf, nc) {
  const P = PLH.pts,
    k = PLH.repK,
    out = [];
  if (PLH.h === "rep") {
    const [a, b] = P,
      x0 = Math.min(a[0], b[0]),
      y0 = Math.min(a[1], b[1]),
      w = Math.abs(b[0] - a[0]),
      hh = Math.abs(b[1] - a[1]);
    for (let i = 0; i < nf; i++)
      for (let j = 0; j < nc; j++)
        out.push({ x: x0 + ((j + 0.5) * w) / nc, y: y0 + hh - ((i + 0.5) * hh) / nf, r: PLH.rot || 0 });
    return out;
  }
  const [a, b, lado] = P,
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    // Del muro hacia el ambiente: el lado del tercer clic
    s = Math.sign((lado[1] - a[1]) * dx - (lado[0] - a[0]) * dy) || 1,
    nx = (-dy / L) * s,
    ny = (dx / L) * s,
    vA = DSU.alinear;
  DSU.alinear = true;
  for (let i = 0; i < nf; i++) {
    const t = (i + 0.5) / nf,
      p = [a[0] + dx * t + (nx * 0.05) / EPL.f, a[1] + dy * t + (ny * 0.05) / EPL.f],
      al = DS_CAT[k] && DS_CAT[k].m ? dsAlinear(k, p) : null;
    out.push(
      al
        ? { x: al.x, y: al.y, r: al.r }
        : { x: p[0], y: p[1], r: Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360) }
    );
  }
  DSU.alinear = vA;
  return out;
}
function dpPuntoRep(p) {
  PLH.pts.push(p);
  const h = PLH.h,
    n = PLH.pts.length;
  if (h === "rep" && n === 2) {
    const [a, b] = PLH.pts,
      w = Math.abs(b[0] - a[0]) * EPL.f,
      hh = Math.abs(b[1] - a[1]) * EPL.f;
    if (w * PLV.s < 0.01 || hh * PLV.s < 0.01) {
      PLH.pts = [];
      return plOrden();
    }
    const nc = Math.max(1, Math.round(w / 2.5)),
      nf = Math.max(1, Math.round(hh / 2.5));
    PLH.repN = [nf, nc];
    plOrden(`<b>Repartir en ambiente</b> · ${fmt(w, 2)} × ${fmt(hh, 2)} m`);
    return plPedir("Filas × columnas (criterio: cada 2.5 m)", `${nf}x${nc}`, v => {
      const m = /^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i.exec(String(v)) || /^\s*(\d+)\s*$/.exec(String(v));
      plPedir(null);
      if (!m) return toast("Escriba filas × columnas, por ejemplo 2x3");
      const f = Math.min(30, Math.max(1, +m[1])),
        c = Math.min(30, Math.max(1, m[2] ? +m[2] : 1));
      dpColocarRep(dpPosRep(f, c));
    });
  }
  if (h === "rmur" && n === 3) {
    const [a, b] = PLH.pts,
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) * EPL.f;
    if (L < 0.05) {
      PLH.pts = [];
      return plOrden();
    }
    const nd = Math.max(1, Math.round(L / 3));
    PLH.repN = [nd, 1];
    plOrden(`<b>A lo largo del muro</b> · ${fmt(L, 2)} m`);
    return plPedir("Cantidad (o c/3 para uno cada 3 m)", String(nd), v => {
      const s = String(v).trim().replace(",", "."),
        m = /^c\s*\/\s*([\d.]+)$/i.exec(s),
        q = m ? Math.max(1, Math.round(L / Math.max(0.2, parseFloat(m[1])))) : parseInt(s, 10);
      plPedir(null);
      if (!(q >= 1)) return toast("Escriba la cantidad (por ejemplo 4) o la separación (por ejemplo c/3)");
      dpColocarRep(dpPosRep(Math.min(100, q), 1));
    });
  }
  plOrden();
  plSobreDibujar();
}
function dpColocarRep(pos) {
  const k = PLH.repK,
    c = DS_CAT[k];
  if (!c) return;
  const capa = DS_SIS[c.s].capa;
  dsCapa(capa);
  DS_SEL.clear();
  pos.forEach(p => DS_SEL.add(dsAgregar({ t: "sim", k, x: p.x, y: p.y, r: p.r || 0, capa }).id));
  PLH.pts = [];
  PLH.repN = null;
  edCambio();
  plOrden();
  toast(`${pos.length} × ${c.n.toLowerCase()} colocados · siga con otro ambiente o Esc para terminar`);
}
// Vista previa: el rectángulo o la línea del muro, y los artefactos donde quedarían
function dpSobreRep(g, q, d) {
  const h = PLH.h;
  if ((h !== "rep" && h !== "rmur") || !q || !PLH.pts.length || !DS_CAT[PLH.repK]) return;
  const gv = PL_OSCURO ? "#8fc1f0" : "#1f6fd6",
    P = PLH.pts;
  g.save();
  g.strokeStyle = gv;
  g.lineWidth = 1.2 * d;
  g.setLineDash([6 * d, 4 * d]);
  const pts = [...P, ...(P.length < (h === "rep" ? 2 : 3) ? [q] : [])],
    [a, b] = [plAPant(...pts[0]), pts[1] ? plAPant(...pts[1]) : null];
  if (h === "rep" && b) g.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  if (h === "rmur" && b) {
    g.beginPath();
    g.moveTo(...a);
    g.lineTo(...b);
    g.stroke();
  }
  g.setLineDash([]);
  // Fantasmas con la cantidad propuesta (o la que se está escribiendo)
  const tmp = PLH.pts;
  if (pts.length >= (h === "rep" ? 2 : 3)) {
    PLH.pts = pts;
    let nf, nc;
    if (h === "rep") {
      const w = Math.abs(pts[1][0] - pts[0][0]) * EPL.f,
        hh = Math.abs(pts[1][1] - pts[0][1]) * EPL.f;
      [nf, nc] = PLH.repN || [Math.max(1, Math.round(hh / 2.5)), Math.max(1, Math.round(w / 2.5))];
      const m = !$("plCmdIn").hidden && /^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i.exec($("plCmdV").value);
      if (m) [nf, nc] = [Math.min(30, +m[1]), Math.min(30, +m[2])];
    } else {
      const L = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) * EPL.f,
        v = !$("plCmdIn").hidden ? $("plCmdV").value.trim() : "",
        m = /^c\s*\/\s*([\d.]+)$/i.exec(v.replace(",", "."));
      nf = m
        ? Math.max(1, Math.round(L / Math.max(0.2, parseFloat(m[1]))))
        : parseInt(v, 10) || (PLH.repN ? PLH.repN[0] : Math.max(1, Math.round(L / 3)));
      nc = 1;
    }
    g.globalAlpha = 0.5;
    dpPosRep(Math.min(100, nf), nc).forEach(p => {
      const [X, Y] = plAPant(p.x, p.y);
      dsDibSim(g, PLH.repK, X, Y, ((p.r || 0) * Math.PI) / 180, dsUk(PLH.repK) * PLV.s, gv, null, plDpr());
    });
  }
  PLH.pts = tmp;
  g.restore();
}

/* ---------- Lienzo superior: bloque que se va a colocar y comparación con una versión ---------- */
function dpSobre(g, q, d) {
  dpSobreRep(g, q, d);
  const gv = PL_OSCURO ? "#8fc1f0" : "#1f6fd6";
  if (PLH.h === "blq" && PLH.blq && q) {
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = gv;
    g.lineWidth = 1.2 * d;
    PLH.blq.els.forEach(el =>
      dsFantasma(
        g,
        el,
        o => {
          dpEscalar(o, 1 / EPL.f);
          dsTrasladar(o, q[0], q[1]);
        },
        gv
      )
    );
    g.restore();
  }
  if (!DP_COMP || !dsD()) return;
  g.save();
  g.lineWidth = 6 * d;
  g.lineCap = g.lineJoin = "round";
  const halo = (el, col) => {
    g.strokeStyle = col;
    if (el.t === "sim")
      dsDibSim(
        g,
        el.k,
        ...plAPant(el.x, el.y),
        ((el.r || 0) * Math.PI) / 180,
        dsUk(el.k) * PLV.s,
        col,
        null,
        6 * d,
        el.dt
      );
    else {
      const b = dsBBox(el),
        [x0, y0] = plAPant(b[0], b[3]),
        [x1, y1] = plAPant(b[2], b[1]);
      if (el.t === "txt" || el.t === "ley") g.strokeRect(x0 - 3 * d, y0 - 3 * d, x1 - x0 + 6 * d, y1 - y0 + 6 * d);
      else {
        g.beginPath();
        dsLineas(el).forEach(p => plRuta(g, p, false));
        g.stroke();
      }
    }
  };
  g.globalAlpha = 0.4;
  dsD().els.forEach(el => {
    if (DP_COMP.add.has(el.id)) halo(el, "#2e9e4f");
    else if (DP_COMP.cam.has(el.id)) halo(el, "#e8890c");
  });
  g.globalAlpha = 0.75;
  g.setLineDash([6 * d, 4 * d]);
  g.lineWidth = 1.5 * d;
  g.strokeStyle = "#d32f2f";
  DP_COMP.quit.forEach(el => dsFantasma(g, el, () => {}, "#d32f2f"));
  g.restore();
  g.font = `600 ${11 * d}px "IBM Plex Sans", Arial, sans-serif`;
  plEtiqueta(
    g,
    `Comparando con «${DP_COMP.n}» · ${DP_COMP.add.size} agregados · ${DP_COMP.cam.size} cambiados · ${DP_COMP.quit.length} quitados · Esc para salir`,
    12 * d,
    plH() - 34 * d,
    "#14304f",
    "left",
    "top"
  );
}

/* ---------- Pasos del diseño y cálculo en vivo ----------
   Barra de pasos bajo la cinta del editor (el orden de trabajo con el plano: plano, ambientes, tableros, artefactos,
   tuberías, revisión y resultados), cada uno con su estado y un clic que lleva a su herramienta; y, en el panel
   izquierdo, el resultado del cálculo del proyecto, que se actualiza con el autoguardado del diseño. */
const ED_PASOS = [
  ["plano", "Plano y escala"],
  ["amb", "Ambientes"],
  ["tab", "Tableros"],
  ["art", "Artefactos"],
  ["tub", "Tuberías"],
  ["rev", "Revisión"],
  ["res", "Resultados"]
];
// Estado de cada paso: ok (hecho), av (con algo por resolver), opc (opcional, sin hacer), no (por hacer)
function edPasosEstado() {
  const D = dsD(),
    els = D ? D.els : [],
    E = {};
  const hayPlano = !!(EPL && PL_MOD);
  E.plano = hayPlano
    ? {
        st: "ok",
        d: `${plNomUnidad(EPL.f)}${EPL.plantas.length ? ` · ${EPL.plantas.length} planta${EPL.plantas.length > 1 ? "s" : ""}` : ""}`
      }
    : { st: "no", d: "Abra el DXF" };
  const amb = els.filter(e => e.ar && e.ar.amb).length;
  E.amb = amb ? { st: "ok", d: `${amb} marcados` } : { st: "opc", d: "Opcional" };
  const tabs = els.filter(e => e.k === "tab"),
    conC = tabs.filter(e => e.nc > 0 || e.gen);
  E.tab = !tabs.length
    ? { st: "no", d: "Coloque el TG" }
    : conC.length < tabs.length
      ? { st: "av", d: `${tabs.length - conC.length} sin circuitos` }
      : { st: "ok", d: `${tabs.length} tablero${tabs.length > 1 ? "s" : ""}` };
  const arts = els.filter(e => e.t === "sim" && e.k !== "tab" && plArt(e.k)[0]),
    sinCir = arts.filter(e => !e.cir);
  E.art = !arts.length
    ? { st: "no", d: "Salidas y cargas" }
    : sinCir.length
      ? { st: "av", d: `${sinCir.length} sin circuito` }
      : { st: "ok", d: `${arts.length} salidas` };
  const tubs = els.filter(e => e.t === "tub"),
    sl = D ? dsSueltos() : { sims: [] };
  E.tub = !tubs.length
    ? { st: "no", d: "Una los circuitos" }
    : sl.sims.length
      ? { st: "av", d: `${sl.sims.length} sin tubería` }
      : { st: "ok", d: `${tubs.length} tuberías` };
  const R = D && els.length ? dsVerificar() : [],
    sg = R.filter(o => o.nivel === "seg").length,
    av = R.filter(o => o.nivel === "aviso").length;
  E.rev = !els.length
    ? { st: "no", d: "Sin diseño" }
    : sg
      ? { st: "av", d: `${sg} de seguridad` }
      : av
        ? { st: "av", d: `${av} aviso${av > 1 ? "s" : ""}` }
        : { st: "ok", d: "Sin avisos" };
  E.rev.n = { sg, av, nt: R.length - sg - av };
  const r = LAST,
    ok = r && r.alims.every(a => a.ok) && r.circ.every(q => q.ok);
  E.res =
    PROY.calPlano !== "1"
      ? { st: "no", d: "Con datos escritos" }
      : !r
        ? { st: "no", d: "Faltan datos" }
        : ok
          ? { st: "ok", d: "Conforme" }
          : { st: "av", d: "Revisar" };
  return E;
}
// Íconos de los pasos (como los de la cinta: trazo azul y detalle cobre)
const ED_PASO_ICO = {
  plano:
    '<rect x="3" y="4" width="18" height="16"/><path d="M3 12h8v8M11 8h10"/><path d="M15 16h3" stroke="#c77d2e" stroke-width="2"/>',
  amb: '<path d="M3 4h18v16H3zM12 4v7M12 15v5M3 11h5"/><path d="M14 13h5v5h-5z" stroke="#c77d2e" stroke-dasharray="2 1.5"/>',
  tab: '<rect x="4" y="5" width="16" height="14"/><path d="M4 19 20 5v14z" fill="#14304f"/><path d="M8 19v2M12 19v2M16 19v2" stroke="#c77d2e"/>',
  art: '<circle cx="12" cy="10" r="5"/><path d="M12 2v3M12 15v6M4 10h3M17 10h3"/><path d="M9 21h6" stroke="#c77d2e" stroke-width="2"/>',
  tub: '<path d="M4 18V9a3 3 0 0 1 3-3h10"/><circle cx="4" cy="19" r="1.8" fill="#c77d2e" stroke="#c77d2e"/><circle cx="19" cy="6" r="1.8" fill="#c77d2e" stroke="#c77d2e"/><path d="m7 11 2-2M7 14l2-2"/>',
  rev: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5" stroke="#c77d2e" stroke-width="2"/>',
  res: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6" stroke="#c77d2e" stroke-width="2.4"/>'
};
// Pestaña Revisión de la cinta: el avance del diseño por pasos, la revisión y el cálculo; y su resumen abajo
function edRevCinta(E) {
  const ic = { ok: "✓", av: "!", opc: "" },
    r = LAST,
    hechos = ED_PASOS.filter(([k]) => E[k].st === "ok").length,
    pend = ED_PASOS.filter(([k]) => E[k].st === "av").length,
    svg = k =>
      `<svg viewBox="0 0 24 24" fill="none" stroke="#14304f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ED_PASO_ICO[k]}</svg>`;
  const pasos = ED_PASOS.map(
    ([k, t], i) =>
      `<button type="button" class="rb rb-paso ${E[k].st}" data-paso="${k}" title="${esc(`${i + 1}. ${t}: ${E[k].d || ""}`)}"><span class="rb-ico">${svg(k)}<i>${ic[E[k].st] || i + 1}</i></span><span>${t}</span><small>${esc(E[k].d || "")}</small></button>`
  ).join("");
  const n = E.rev.n || { sg: 0, av: 0, nt: 0 },
    fila = (cl, t, v) =>
      `<button type="button" class="rs rev-c ${cl}${v ? "" : " cero"}" data-paso="rev"><b>${v}</b>${t}</button>`;
  let calc;
  if (PROY.calPlano !== "1")
    calc = `<div class="col rev-calc"><span class="rev-dato">Se calcula con los <b>datos escritos</b></span><button type="button" class="rs" data-vivo="calplano">Calcular con el diseño</button></div>`;
  else if (!r)
    calc = `<div class="col rev-calc"><span class="rev-dato pend">Faltan datos para calcular</span><button type="button" class="rs" data-vivo="datos">Escribir los datos que faltan</button></div>`;
  else {
    const ok = r.alims.every(a => a.ok) && r.circ.every(q => q.ok),
      { md, dv } = vivoDatos(r);
    calc = `<div class="col rev-calc"><span class="rev-dato">Máxima demanda ${md === null ? '<b class="w">pendiente</b>' : `<b>${fmt(md / 1000, 2)} kW</b>`}</span><span class="rev-dato">ΔV máxima ${dv === null ? '<b class="w">pendiente</b>' : `<b${dv > DV_TOT ? ' class="bad"' : ""}>${fmt(dv, 2)} %</b>`}</span><span class="rev-dato">Estado ${r.prelim ? `<b class="w" title="Calculado con lo que el diseño tiene; faltan ${r.prelim.length} datos">Preliminar</b>` : `<b class="${ok ? "ok" : "bad"}">${ok ? "Conforme" : "Revisar"}</b>`}</span></div>`;
  }
  $("edRevRib").innerHTML =
    `<div class="rgrp"><div class="gi">${pasos}</div><div class="gl">Avance del diseño · ${hechos} de ${ED_PASOS.length}</div></div>` +
    `<div class="rgrp"><div class="gi"><button type="button" class="rb" data-paso="rev" title="Lista de observaciones del diseño, con «Ver» para cada una">${svg("rev")}<span>Revisar<br>diseño</span></button><div class="col">${fila("seg", "de seguridad", n.sg)}${fila("av", n.av === 1 ? "aviso" : "avisos", n.av)}${fila("nt", n.nt === 1 ? "nota" : "notas", n.nt)}</div></div><div class="gl">Revisión</div></div>` +
    `<div class="rgrp last"><div class="gi"><button type="button" class="rb" data-paso="res" title="Guarda el diseño y muestra los resultados del proyecto">${svg("res")}<span>Ver<br>resultados</span></button>${calc}</div><div class="gl">Cálculo</div></div>`;
  // Número en la pestaña y resumen en la barra de estado
  const obs = n.sg + n.av;
  $("edRevN").textContent = obs ? String(obs) : "";
  $("edRevN").className = "tb-n" + (n.sg ? " seg" : "");
  const av = $("edAvance");
  av.hidden = false;
  av.className = "ed-avance" + (n.sg ? " seg" : pend || obs ? " av" : hechos === ED_PASOS.length ? " ok" : "");
  av.textContent = `Diseño ${hechos}/${ED_PASOS.length}${n.sg ? ` · ${n.sg} de seguridad` : ""}${n.av ? ` · ${n.av} aviso${n.av > 1 ? "s" : ""}` : ""}`;
}
// Cómo sale del plano cada dato que falta (si no, se escribe en el proyecto)
const ED_PISTA = {
  area: "márquela con las áreas del plano (Dibujo › Área) o escríbala",
  Lalim: "dibuje el medidor y la tubería alimentador hasta el TG",
  Lgen: "dibuje el medidor y la tubería alimentador hasta el TG",
  Lbm: "dibuje la tubería alimentador del TG al banco"
};
const edPistaLi = x => `<li>${esc(x.l)}${ED_PISTA[x.id] ? `<small>${ED_PISTA[x.id]}</small>` : ""}</li>`;
function edVivo() {
  if (!ED.abierto) return;
  edRevCinta(edPasosEstado());
  // Cálculo en vivo
  const r = LAST,
    v = $("edVivo");
  if (PROY.calPlano !== "1") {
    $("edVivoE").textContent = "";
    v.innerHTML = `<p>El proyecto se calcula con los <b>datos escritos</b>; el diseño no cambia el cálculo.</p><button type="button" class="vw-btn def" data-vivo="calplano">Calcular con el diseño</button>`;
    return;
  }
  if (!r) {
    const F = faltantes(estado());
    $("edVivoE").textContent = F.length ? `${F.length} pendiente${F.length > 1 ? "s" : ""}` : "";
    v.innerHTML = `<p class="pend">Para calcular falta:</p><ul>${F.slice(0, 5)
      .map(edPistaLi)
      .join(
        ""
      )}${F.length > 5 ? `<li>y ${F.length - 5} más</li>` : ""}</ul><p class="nota">Dibuje los tableros con sus circuitos, las salidas y las tuberías: el cálculo los toma del plano.</p><button type="button" class="vw-btn" data-vivo="datos">Escribir los datos que faltan</button>`;
    return;
  }
  const ok = r.alims.every(a => a.ok) && r.circ.every(q => q.ok),
    { md, a0, dv } = vivoDatos(r),
    PD = r.pend,
    pend = '<span class="w">pendiente</span>',
    // Circuitos: los ya calculados y, de ellos, los que no cumplen
    cs = r.circ.filter(q => !(PD && PD.circ.has(q.key))),
    malos = cs.filter(q => !q.ok && !(PD && PD.cdv.has(q.key))).length;
  // Preliminar: calculado con lo que hay; debajo, lo que falta
  const F = r.prelim || [];
  $("edVivoE").innerHTML = F.length
    ? `<b class="w">Preliminar · ${F.length} pendiente${F.length > 1 ? "s" : ""}</b>`
    : `<b class="${ok ? "ok" : "bad"}">${ok ? "Conforme" : "Revisar"}</b>`;
  v.innerHTML =
    (F.length
      ? `<p class="nota">Calculado con lo que el diseño tiene hasta ahora; los valores cambian al completar:</p><ul>${F.slice(
          0,
          4
        )
          .map(edPistaLi)
          .join("")}${F.length > 4 ? `<li>y ${F.length - 4} más</li>` : ""}</ul>`
      : "") +
    `<dl><dt>Máxima demanda</dt><dd>${md === null ? pend : `${fmt(md / 1000, 2)} kW`}</dd>` +
    `<dt>Alimentador</dt><dd>${a0 ? `${a0.s.n}-1×${a0.S} mm² · ${a0.s.tri ? 3 : 2}×${a0.itm} A` : pend}</dd>` +
    `<dt>ΔV máxima</dt><dd${dv > DV_TOT ? ' class="bad"' : ""}>${dv === null ? pend : `${fmt(dv, 2)} %`}</dd>` +
    `<dt>Circuitos</dt><dd>${cs.length}${cs.length < r.circ.length ? ` de ${r.circ.length}` : ""}${malos ? ` · ${malos} por revisar` : ""}</dd></dl>` +
    `<button type="button" class="vw-btn" data-vivo="res">Ver resultados completos</button>` +
    (F.length ? `<button type="button" class="vw-btn" data-vivo="datos">Escribir los datos que faltan</button>` : "");
}
$("edRevRib").addEventListener("click", e => {
  const vv = e.target.closest("[data-vivo]");
  if (vv) return edVivoAccion(vv.dataset.vivo);
  const b = e.target.closest("[data-paso]");
  if (!b) return;
  const k = b.dataset.paso,
    pest = t => document.querySelector(`#editor [data-tab-e="${t}"]`)?.click(),
    herr = h => document.querySelector(`#editor [data-pl="${h}"]`)?.click();
  if (k === "plano") {
    if (!(EPL && PL_MOD)) return $("plArchivo").click();
    pest("inicio");
    herr("planta");
    return toast(
      "Encuadre cada planta del plano (dos clics en sus esquinas); la escala se comprueba en Inicio › Comprobar escala"
    );
  }
  if (!(EPL && PL_MOD)) return toast("Primero abra el plano de arquitectura en DXF");
  if (k === "amb") return ambAbrir();
  if (k === "tab") {
    pest("insertar");
    herr("col:tab");
    return toast("Coloque el tablero en el plano; luego doble clic en él para darle sus circuitos");
  }
  if (k === "art") {
    pest("insertar");
    return bibAbrir();
  }
  if (k === "tub") {
    pest("insertar");
    herr("tubT");
    return toast("Tubería por el techo: empiece en una salida del tablero (C-1, C-2…) y una los artefactos");
  }
  if (k === "rev") return revAbrir();
  if (k === "res") edIrResultados();
});
$("edVivo").addEventListener("click", e => {
  const b = e.target.closest("[data-vivo]");
  if (b) edVivoAccion(b.dataset.vivo);
});
$("edAvance").addEventListener("click", () => document.querySelector('#editor [data-tab-e="revision"]')?.click());
// Secciones del panel izquierdo: cada una se muestra u oculta con su título (se recuerda en este navegador)
const ED_SECK = "jmg-electric-editor-secciones";
function edSecciones() {
  let o = {};
  try {
    o = JSON.parse(localStorage.getItem(ED_SECK) || "{}") || {};
  } catch (e) {}
  document.querySelectorAll("#plLado [data-sec]").forEach(s => {
    const cerrada = !!o[s.dataset.sec];
    s.classList.toggle("cerrada", cerrada);
    s.querySelector("[data-sectg]").setAttribute("aria-expanded", String(!cerrada));
  });
}
$("plLado").addEventListener("click", e => {
  const b = e.target.closest("[data-sectg]");
  if (!b) return;
  let o = {};
  try {
    o = JSON.parse(localStorage.getItem(ED_SECK) || "{}") || {};
  } catch (er) {}
  o[b.dataset.sectg] = !o[b.dataset.sectg];
  try {
    localStorage.setItem(ED_SECK, JSON.stringify(o));
  } catch (er) {}
  edSecciones();
});
edSecciones();
function edVivoAccion(a) {
  const b = { dataset: { vivo: a } };
  if (b.dataset.vivo === "calplano") {
    ponerDato("calPlano", "1");
    $("calPlano").dispatchEvent(new Event("change", { bubbles: true }));
    calcularAhora();
    edVivo();
    return toast("El proyecto se calcula con el diseño del plano");
  }
  if (b.dataset.vivo === "res") edIrResultados();
  // Los datos que el plano no da: el proyecto, con el primero que falta resaltado
  if (b.dataset.vivo === "datos") {
    edAplicar();
    edCerrar();
    const F = faltantes();
    if (F.length) document.querySelector(`[data-foco="${F[0].id}"]`)?.click();
  }
}
// Guarda el diseño, cierra el editor y muestra los resultados del proyecto
function edIrResultados() {
  edAplicar();
  edCerrar();
  document.querySelector('#ws [data-tab-r="resultados"]')?.click();
}
