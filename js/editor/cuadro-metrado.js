/* DISEÑO AVANZADO · CUADRO DE CIRCUITOS, CAJA DE PASO Y METRADO
   Cuadro de circuitos de la lámina, caja de paso automática y metrado del diseño.
   Antes era parte de js/diseno-avanzado.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Cuadro de circuitos ----------
   Una tabla por tablero, armada con lo conectado: cada circuito con su descripción, sus salidas (luminarias,
   tomacorrientes y otras), los metros de tubería en techo y en piso, los conductores marcados y el diámetro (los
   más frecuentes en el circuito) y una fila de totales. Medidas en el papel (mm), como la leyenda. */
const DS_CUA = { w: [14, 44, 30, 28, 24, 12], tit: 7, cab: 5, fila: 5.5, txt: 2 };
const dpCond = c =>
  c
    ? [c.f ? c.f + "F" : "", c.r ? c.r + "R" : "", dsNeutros(c) ? dsNeutros(c) + "N" : "", c.t ? "T" : ""]
        .filter(Boolean)
        .join("+")
    : "";
const dpModa = a => {
  const m = new Map();
  a.filter(Boolean).forEach(v => m.set(v, (m.get(v) || 0) + 1));
  return [...m].sort((x, y) => y[1] - x[1])[0]?.[0] || "";
};
// Filas: { tit } (nombre del tablero), { c, d, sal, tub, cond, dia } por circuito y { tot } por tablero
// Se guarda hasta el próximo cambio del diseño (se dibuja en cada cuadro de la pantalla)
const dsFilasCua = () => dpCache("cua", dsFilasCua0);
function dpCache(k, fn) {
  const D = dsD(),
    c = (dpCache.c = dpCache.c || {}),
    v = DS_IDXV + ":" + D.els.length;
  if (!c[k] || c[k].D !== D || c[k].v !== v) c[k] = { D, v, r: fn() };
  return c[k].r;
}
function dsFilasCua0() {
  const D = dsD(),
    out = [],
    f = EPL ? EPL.f : 1,
    // Lo conectado, agrupado por tablero y circuito, en una sola pasada
    grupo = new Map(),
    de = (tab, cir) => {
      const k = tab + "|" + cir;
      if (!grupo.has(k)) grupo.set(k, { arts: [], tubs: [] });
      return grupo.get(k);
    };
  D.els.forEach(e => {
    if (!e.tab || !e.cir) return;
    if (e.t === "tub") de(e.tab, e.cir).tubs.push(e);
    else if (dsConecta(e)) de(e.tab, e.cir).arts.push(e);
  });
  D.els
    .filter(e => e.k === "tab" && e.nc)
    .sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), "es", { numeric: true }))
    .forEach(tb => {
      out.push({ tit: tb.nom || "Tablero" });
      let ts = 0,
        tt = 0,
        tp = 0;
      dsSalidasTab(tb).forEach(o => {
        const { arts, tubs } = grupo.get(tb.id + "|" + o.n) || { arts: [], tubs: [] },
          g = n => arts.filter(e => DS_CAT[e.k].g === n).length,
          l = g("Iluminación"),
          tm = g("Tomacorrientes"),
          ot = arts.length - l - tm,
          mt = tubs.filter(t => t.modo !== "piso").reduce((s, t) => s + dsLargo(t), 0) * f,
          mp = tubs.filter(t => t.modo === "piso").reduce((s, t) => s + dsLargo(t), 0) * f;
        ts += arts.length;
        tt += mt;
        tp += mp;
        out.push({
          c: o.n,
          d: o.d || "",
          sal:
            [l ? l + " alum." : "", tm ? tm + " toma." : "", ot ? ot + " otras" : ""].filter(Boolean).join(" · ") ||
            "—",
          tub: [mt ? fmt(mt, 1) + " T" : "", mp ? fmt(mp, 1) + " P" : ""].filter(Boolean).join(" · ") || "—",
          cond: dpModa(tubs.map(t => dpCond(t.cond))) || "—",
          dia: dpModa(tubs.map(t => t.dia)) || "—"
        });
      });
      out.push({ tot: true, sal: ts + " salidas", tub: fmt(tt + tp, 1) + " m" });
    });
  return out;
}
// Tamaño del cuadro en el dibujo; con filas, el de esa parte (la lámina lo reparte en columnas por tablero)
function dsTamCua(filas = dsFilasCua()) {
  const m = dsMm(1),
    C = DS_CUA;
  return [
    C.w.reduce((a, b) => a + b, 0) * m,
    (C.tit + filas.length * C.fila + C.cab * Math.max(1, filas.filter(f => f.tit).length)) * m
  ];
}
function dsDibCuadro(g, el, col, s, lw) {
  const m = dsMm(1),
    C = DS_CUA,
    filas = el.filas || dsFilasCua(),
    W = C.w.reduce((a, b) => a + b, 0),
    P = (a, b) => plAPant(el.x + a * m, el.y - b * m),
    hp = C.txt * m * s,
    xs = C.w.reduce((a, w, i) => (a.push((a[i] || 0) + w), a), [0]);
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = lw;
  g.setLineDash([]);
  const linea = (a, b, c, d) => {
    const [X0, Y0] = P(a, b),
      [X1, Y1] = P(c, d);
    g.beginPath();
    g.moveTo(X0, Y0);
    g.lineTo(X1, Y1);
    g.stroke();
  };
  const texto = (t, a, b, al, peso = "", ancho = 0) => {
    if (hp < 3 || !t) return;
    const [X, Y] = P(a, b);
    g.font = `${peso}${hp / 0.72}px Arial, sans-serif`;
    const w = g.measureText(t).width,
      max = ancho * m * s;
    if (ancho && w > max) g.font = `${peso}${((hp / 0.72) * max) / w}px Arial, sans-serif`;
    g.textAlign = al;
    g.textBaseline = "middle";
    g.fillStyle = col;
    g.fillText(t, X, Y);
  };
  let y = C.tit;
  texto(el.tit || "CUADRO DE CIRCUITOS", W / 2, C.tit / 2, "center", "700 ", W - 4);
  linea(0, C.tit, W, C.tit);
  const cab = ["CIRC.", "DESCRIPCIÓN", "SALIDAS", "TUBERÍA (m)", "CONDUCTORES", "Ø (mm)"];
  filas.forEach(f => {
    if (f.tit) {
      // Encabezado de cada tablero
      texto(`TABLERO ${f.tit}`, 2, y + C.fila / 2, "left", "700 ", W - 4);
      y += C.fila;
      linea(0, y, W, y);
      cab.forEach((t, i) => texto(t, xs[i] + C.w[i] / 2, y + C.cab / 2, "center", "600 ", C.w[i] - 1));
      y += C.cab;
      linea(0, y, W, y);
      return;
    }
    const v = f.tot ? ["", "Total", f.sal, f.tub, "", ""] : [f.c, f.d, f.sal, f.tub, f.cond, String(f.dia)];
    v.forEach((t, i) =>
      texto(
        t,
        i === 1 ? xs[i] + 1.5 : xs[i] + C.w[i] / 2,
        y + C.fila / 2,
        i === 1 ? "left" : "center",
        f.tot ? "600 " : "",
        C.w[i] - 2
      )
    );
    y += C.fila;
    linea(0, y, W, y);
  });
  const H = y;
  const [X0, Y0] = P(0, 0);
  g.strokeRect(X0, Y0, W * m * s, H * m * s);
  // Columnas (desde el primer encabezado)
  for (let i = 1; i < xs.length - 1; i++) linea(xs[i], C.tit + C.fila, xs[i], H);
  g.restore();
}

/* ---------- Caja de paso automática ----------
   Parte la tubería en el medio de su tramo central con una caja (símbolo general, 09-93-08): quedan dos tuberías
   unidas a la caja, con el mismo circuito, conductores y diámetro. Un tramo curvo se parte en dos arcos. */
function dpPonerCaja(id) {
  const D = dsD(),
    t = D.els.find(e => e.id === id);
  if (!t || t.t !== "tub") return;
  const T = dsTramos(t),
    i = Math.floor((T.length - 1) / 2),
    tr = T[i],
    k = tr.k ? Math.tan(Math.atan(tr.k) / 2) : 0,
    n = t.pts.length / 2,
    b = t.b || [],
    comun = {};
  ["t", "modo", "capa", "cir", "tab", "cond", "dia", "col"].forEach(c => t[c] !== undefined && (comun[c] = t[c]));
  const caja = dsAgregar({
    t: "sim",
    k: "caja",
    x: tr.m[0],
    y: tr.m[1],
    r: 0,
    capa: DS_SIS[DS_CAT.caja.s].capa,
    ...(t.cir ? { cir: t.cir } : {}),
    ...(t.tab ? { tab: t.tab } : {})
  });
  dsCapa(caja.capa);
  const a = {
      ...comun,
      pts: [...t.pts.slice(0, 2 * (i + 1)), ...tr.m],
      ...(b.some(Boolean) ? { b: [...b.slice(0, i), k] } : {}),
      ...(t.c0 ? { c0: t.c0 } : {}),
      c1: caja.id
    },
    z = {
      ...comun,
      pts: [...tr.m, ...t.pts.slice(2 * (i + 1), 2 * n)],
      ...(b.some(Boolean) ? { b: [k, ...b.slice(i + 1, n - 1)] } : {}),
      c0: caja.id,
      ...(t.c1 ? { c1: t.c1 } : {})
    };
  if (a.t === "tub" && !a.c0) delete a.tab;
  D.els = D.els.filter(e => e !== t);
  dsAgregar(a);
  dsAgregar(z);
  DS_SEL.clear();
  DS_SEL.add(caja.id);
  edCambio();
  toast("Caja de paso colocada: la tubería quedó en dos, unidas a la caja");
}

/* ---------- Metrado del diseño ----------
   Cantidades leídas del plano (de una planta o de todas): tuberías por recorrido y diámetro, conductores (metros de
   activos —fases y neutros— y de protección, según las marcas de cada tubería), artefactos por tipo, cajas y curvas.
   Sin desperdicios ni empalmes; la sección de los conductores la dará el cálculo. */
const MET_VW = ventanaMovil(document.querySelector("#metDlg .vw"), "jmg-electric-metrado", {
  w: 760,
  h: 600,
  minW: 520,
  minH: 340
});
let MET_PL = -1;
function metAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("metPl").innerHTML =
    `<option value="-1">Todas</option>` +
    EPL.plantas.map((p, i) => `<option value="${i}">${esc(p.n)}</option>`).join("");
  if (MET_PL >= EPL.plantas.length) MET_PL = -1;
  $("metPl").value = String(MET_PL);
  $("metDlg").hidden = false;
  vwFondo();
  MET_VW.abrir();
  metRender();
}
function metCerrar() {
  $("metDlg").hidden = true;
  vwFondo();
}
// Datos del metrado: secciones con filas [descripción, unidad, cantidad]
function metDatos() {
  const D = dsD(),
    f = EPL.f,
    els = MET_PL >= 0 ? D.els.filter(el => dpPlantaEl(el) === MET_PL) : D.els,
    tubs = els.filter(e => e.t === "tub"),
    sec = [];
  // Tuberías por recorrido y diámetro
  const tub = new Map();
  tubs.forEach(t => {
    const k = `Tubería PVC empotrada en ${t.modo === "piso" ? "piso" : t.modo === "pared" ? "pared" : "techo"}${t.dia ? ` · Ø ${t.dia} mm` : " · diámetro sin indicar"}`;
    tub.set(k, (tub.get(k) || 0) + dsLargo(t) * f);
  });
  sec.push(["Tuberías", [...tub].sort().map(([k, v]) => [k, "m", v])]);
  // Conductores
  let act = 0,
    pro = 0,
    sinC = 0;
  tubs.forEach(t => {
    const L = dsLargo(t) * f;
    if (!t.cond) return (sinC += L);
    act += L * ((t.cond.f || 0) + (t.cond.r || 0) + dsNeutros(t.cond));
    if (t.cond.t) pro += L;
  });
  sec.push([
    "Conductores (según las marcas de cada tubería)",
    [
      ["Conductor activo (fases y neutros)", "m", act],
      ["Conductor de protección (tierra)", "m", pro],
      ...(sinC ? [["Tubería sin conductores indicados", "m", sinC]] : [])
    ]
  ]);
  // Artefactos y cajas
  const art = new Map();
  els.forEach(e => {
    if (e.t !== "sim" || !DS_CAT[e.k]) return;
    const k = `${DS_CAT[e.k].n} (${DS_CAT[e.k].c})`;
    art.set(k, (art.get(k) || 0) + 1);
  });
  sec.push(["Artefactos, tableros y cajas", [...art].sort().map(([k, v]) => [k, "und", v])]);
  // Curvas: tramos curvos y quiebres de más de 30°
  let cur = 0;
  tubs.forEach(t => {
    const T = dsTramos(t);
    cur += T.filter(x => x.k).length;
    for (let i = 1; i < T.length; i++) {
      let d = Math.abs(T[i].ang - T[i - 1].ang);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (!T[i].k && !T[i - 1].k && d > Math.PI / 6) cur++;
    }
  });
  sec.push(["Accesorios", [["Curvas en las tuberías (tramos curvos y quiebres de más de 30°)", "und", cur]]]);
  return sec;
}
function metRender() {
  const sec = metDatos(),
    q = (u, v) => (u === "m" ? fmt(v, 2) : String(Math.round(v)));
  $("metC").innerHTML = sec
    .map(
      ([t, filas]) =>
        `<h4>${esc(t)}</h4><table><thead><tr><th>Descripción</th><th>Und.</th><th class="n">Cantidad</th></tr></thead><tbody>${
          filas.length
            ? filas.map(([d, u, v]) => `<tr><td>${esc(d)}</td><td>${u}</td><td class="n">${q(u, v)}</td></tr>`).join("")
            : '<tr><td colspan="3">—</td></tr>'
        }</tbody></table>`
    )
    .join("");
}
function metCsv() {
  const sec = metDatos(),
    c = v => `"${String(v).replace(/"/g, '""')}"`,
    ln = [["Sección", "Descripción", "Und.", "Cantidad"].map(c).join(";")];
  sec.forEach(([t, filas]) =>
    filas.forEach(([d, u, v]) =>
      ln.push([t, d, u, u === "m" ? v.toFixed(2).replace(".", ",") : Math.round(v)].map(c).join(";"))
    )
  );
  const nom = ($("p_nombre").value.trim() || "Proyecto").replace(/[\\/:*?"<>|]/g, "").slice(0, 60);
  descargarLocal(new Blob(["\ufeff" + ln.join("\r\n")], { type: "text/csv" }), `${nom} - metrado del diseño.csv`);
}
$("metDlg").addEventListener("change", e => {
  if (e.target.id === "metPl") {
    MET_PL = +e.target.value;
    metRender();
  }
});
$("metDlg").addEventListener("click", e => {
  if (e.target.id === "metDlg") return metCerrar();
  const b = e.target.closest("[data-met]");
  if (!b) return;
  if (b.dataset.met === "cerrar") metCerrar();
  else if (b.dataset.met === "max") MET_VW.maximizar();
  else if (b.dataset.met === "csv") metCsv();
});
$("metDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    metCerrar();
  }
  e.stopPropagation();
});
