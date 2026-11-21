/* DISEÑO ELÉCTRICO · DIBUJO
   Rejilla, dibujo de cada elemento del diseño en el lienzo, pinzamientos (vértices, curvatura, centro, radio y
   cota) y encaje de los símbolos de pared en el muro.
   Antes era parte de js/diseno.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Rejilla ---------- */
// Paso de la rejilla en unidades del dibujo
const dsPasoU = () => DSU.paso / (EPL ? EPL.f : 1);
function dsRejilla(g) {
  if (!DSU.rej || !EPL) return;
  const W = plW(),
    H = plH(),
    s = PLV.s;
  let p = dsPasoU(),
    k = 1;
  while (p * k * s < 9) k *= 5;
  const paso = p * k,
    [x0, y1] = plADib(0, 0),
    [x1, y0] = plADib(W, H),
    i0 = Math.floor(x0 / paso),
    i1 = Math.ceil(x1 / paso),
    j0 = Math.floor(y0 / paso),
    j1 = Math.ceil(y1 / paso);
  if ((i1 - i0) * (j1 - j0) > 400000) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineWidth = 1;
  const linea = (mayor, vert, v) => {
    g.strokeStyle = PL_OSCURO
      ? mayor
        ? "rgba(255,255,255,.10)"
        : "rgba(255,255,255,.045)"
      : mayor
        ? "rgba(20,48,79,.13)"
        : "rgba(20,48,79,.055)";
    g.beginPath();
    if (vert) {
      const X = Math.round(plAPant(v, 0)[0]) + 0.5;
      g.moveTo(X, 0);
      g.lineTo(X, H);
    } else {
      const Y = Math.round(plAPant(0, v)[1]) + 0.5;
      g.moveTo(0, Y);
      g.lineTo(W, Y);
    }
    g.stroke();
  };
  for (let i = i0; i <= i1; i++) linea(i % 5 === 0, true, i * paso);
  for (let j = j0; j <= j1; j++) linea(j % 5 === 0, false, j * paso);
  g.restore();
}
const dsAlaRejilla = p => {
  const q = dsPasoU();
  return [Math.round(p[0] / q) * q, Math.round(p[1] / q) * q];
};

/* ---------- Dibujo de los elementos ---------- */
function dsPintar(g) {
  const D = dsD();
  if (!D || !PL_MOD) return;
  const s = PLV.s,
    u = dsU() * s,
    W = plW(),
    H = plH();
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  let vista = null;
  if (!DS_EXPORT) {
    const a = plADib(0, H),
      b = plADib(W, 0),
      m = dsMm(12);
    vista = new Set(dsEnZona(a[0] - m, a[1] - m, b[0] + m, b[1] + m));
  }
  for (const el of D.els) {
    if (!dsVis(el) || (vista && !vista.has(el)) || (el.ar && DS_EXPORT)) continue;
    // Capa del elemento para la lámina y el DXF (el lienzo de grabación la anota)
    g.capa = el.capa;
    // Color propio del elemento o, si no tiene, el de su capa
    const cap = dsCapaDe(el),
      col = plColorDis(dsColorEl(el, cap));
    if (el.t === "sim") {
      const [X, Y] = plAPant(el.x, el.y),
        uk = u * dsTam(el.k);
      if (!DS_EXPORT && (X < -40 * uk || X > W + 40 * uk || Y < -40 * uk || Y > H + 40 * uk)) continue;
      if (uk * 17 < 2.5) {
        g.fillStyle = col;
        g.fillRect(X - 1, Y - 1, 2, 2);
        continue;
      }
      dsDibSim(g, dsKVis(el), X, Y, ((el.r || 0) * Math.PI) / 180, uk, col, PL_FONDO, dsGrosor(cap), el.dt);
      if (el.k === "tab" && dsTabTri(el)) dsDib3f(g, el, col, s);
      if (el.enc) dsDibEnc(g, el, col, s);
      if (dsNsalDe(el) && el.cir && el.k !== "tab") dsDibNum(g, el, col, s);
      if (el.k === "tab") dsDibSalidas(g, el, col, uk, dsGrosor(cap));
      // Banco de medidores: su lista numerada junto a él, solo si el proyectista la pide
      if (el.k === "bmed" && el.num === true) dsDibBanco(g, el, col, uk);
      if (DS_CAJAS.has(el.k) && el.nom) dsDibNomCaja(g, el, col, uk);
    } else if (el.t === "txt") {
      const hp = el.ht * s;
      if (hp < 2) continue;
      const [X, Y] = plAPant(el.x, el.y);
      g.save();
      g.translate(X, Y);
      g.rotate((-(el.r || 0) * Math.PI) / 180);
      g.font = `${hp / 0.72}px Arial, sans-serif`;
      g.fillStyle = col;
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.fillText(el.s, 0, 0);
      g.restore();
    } else if (el.t === "ley") dsDibLeyenda(g, el, col, s, dsGrosor(cap));
    else if (el.t === "cua") dsDibCuadro(g, el, col, s, dsGrosor(cap));
    else if (el.t === "cot") dsDibCota(g, el, col, s, dsGrosor(cap));
    else if (el.t === "dir") dsDibDir(g, el, col, s, dsGrosor(cap));
    else {
      g.strokeStyle = col;
      g.lineWidth = dsGrosor(cap);
      g.setLineDash(dsGuiones(el, cap).map(v => v * s));
      g.beginPath();
      if (el.t === "cir") {
        const [X, Y] = plAPant(el.x, el.y);
        g.arc(X, Y, el.rad * s, 0, 2 * Math.PI);
      } else plRuta(g, dsCurva(el), false);
      g.stroke();
      g.setLineDash([]);
      if (el.t === "tub" && (dsEtqDe(el) !== "no" || dsCirtDe(el))) dsEtiquetasTub(g, el, col, s);
      if (el.t === "tub" && el.cond && DSU.marcas) dsMarcas(g, el, col, s, dsGrosor(cap));
      if (el.ar) dsDibArea(g, el, col, s);
    }
  }
  g.restore();
  dsDibSueltos(g);
}
// Área marcada: relleno suave, nombre, m² y tipo en su centro
const dsM2 = el => plAreaPol(dsCurva(el).slice(0, -2)) * EPL.f * EPL.f;
function dsDibArea(g, el, col, s) {
  g.save();
  g.fillStyle = col;
  g.globalAlpha = 0.08;
  g.beginPath();
  plRuta(g, dsCurva(el), false);
  g.closePath();
  g.fill();
  g.restore();
  const hp = dsMm(2.5) * s;
  if (hp < 5) return;
  const b = dsBBox(el),
    [X, Y] = plAPant((b[0] + b[2]) / 2, (b[1] + b[3]) / 2),
    L = [
      el.ar.n || ((el.ar.amb && ambTipo(el.ar.amb)) || { n: "" }).n,
      `${fmt(dsM2(el), 2)} m²`,
      el.ar.tp !== "tech" ? PL_TAREA[el.ar.tp].toLowerCase() : ""
    ].filter(Boolean);
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  L.forEach((t, i) => {
    g.font = `${i === 0 && el.ar.n ? 600 : 400} ${(i === 2 ? 0.8 : 1) * (hp / 0.72)}px Arial, sans-serif`;
    const y = Y + (i - (L.length - 1) / 2) * hp * 1.5;
    g.lineWidth = 3 * plDpr();
    g.strokeStyle = PL_FONDO;
    g.strokeText(t, X, y);
    g.fillStyle = col;
    g.fillText(t, X, y);
  });
  g.restore();
}
/* Etiquetas de cada elemento: lo elegido en el elemento (Propiedades › Etiquetas o clic derecho) manda sobre lo de
   todo el plano (cinta Diseño › Tuberías); sin elegir, sigue al plano */
const dsEtqDe = el => (["no", "total", "tramo"].includes(el.etq) ? el.etq : (dsD() && dsD().etq) || "total");
const dsCirtDe = el => (typeof el.cirt === "boolean" ? el.cirt : !!(dsD() && dsD().cirt));
const dsNsalDe = el => (typeof el.nsal === "boolean" ? el.nsal : !!(dsD() && dsD().nsal));
// Elementos con etiquetas propias: tuberías (longitud, circuito y diámetro) y salidas con circuito (su circuito)
const dsConEtq = el => el.t === "tub" || (el.t === "sim" && el.k !== "tab" && DS_CAT[el.k]);
/* Campo «Etiquetas» de las propiedades (uno o varios elementos): cada uno como en todo el plano, o mostrar u ocultar */
function dsCampoEtq(campo, els) {
  const tubs = els.filter(e => e.t === "tub"),
    sims = els.filter(e => e.t === "sim"),
    igual = (L, k) => (L.every(e => e[k] === L[0][k]) ? L[0][k] : "~"),
    sel = (dsp, v, ops) =>
      `<select data-dsp="${dsp}">${v === "~" ? '<option value="~" selected>(varios)</option>' : ""}${ops
        .map(
          ([k, t]) =>
            `<option value="${k}"${(v ?? "") === k || (v === true && k === "1") || (v === false && k === "0") ? " selected" : ""}>${t}</option>`
        )
        .join("")}</select>`,
    D = dsD(),
    plano = t => `Como el plano (${t})`;
  if (!tubs.length && !sims.length) return "";
  return (
    dsSec("Rótulos en el plano") +
    (tubs.length
      ? campo(
          "Longitud",
          sel("etq", igual(tubs, "etq"), [
            ["", plano({ no: "no", total: "total", tramo: "por tramo" }[D.etq || "total"])],
            ["total", "Total"],
            ["tramo", "Por tramo"],
            ["no", "Ocultar"]
          ])
        ) +
        campo(
          "Circuito y Ø",
          sel("cirt", igual(tubs, "cirt"), [
            ["", plano(D.cirt ? "sí" : "no")],
            ["1", "Mostrar"],
            ["0", "Ocultar"]
          ])
        )
      : "") +
    (sims.length
      ? campo(
          "Circuito",
          sel("nsal", igual(sims, "nsal"), [
            ["", plano(D.nsal ? "sí" : "no")],
            ["1", "Mostrar junto a la salida"],
            ["0", "Ocultar"]
          ])
        )
      : "") +
    `<p class="ds-crit">En el plano y en las láminas. «Como el plano» sigue a la cinta (Diseño › Tuberías).</p>`
  );
}
// Longitudes de una tubería: la total en su tramo central o la de cada tramo; texto de 2 mm impreso, a lo largo del
// tramo y del lado de afuera de la curva (en un tramo recto, a su izquierda), sin tocar la línea
function dsEtiquetasTub(g, el, col, s) {
  const ht = dsMm(2),
    hp = ht * s;
  if (hp < 5) return;
  const T = dsTramos(el),
    etq = (t, txt) => {
      // Normal hacia afuera del arco: la curva positiva va a la derecha del sentido del tramo
      const nx = t.k > 0 ? Math.sin(t.ang) : -Math.sin(t.ang),
        ny = t.k > 0 ? -Math.cos(t.ang) : Math.cos(t.ang),
        sep = ht * 0.5 + dsMm(el.cond && DSU.marcas ? 2 : 0.8),
        [X, Y] = plAPant(t.m[0] + nx * sep, t.m[1] + ny * sep);
      g.save();
      g.translate(X, Y);
      g.rotate(-dsLegible(t.ang));
      g.font = `${hp / 0.72}px Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = 3 * plDpr();
      g.strokeStyle = PL_FONDO;
      g.strokeText(txt, 0, 0);
      g.fillStyle = col;
      g.fillText(txt, 0, 0);
      g.restore();
    };
  const modo = dsEtqDe(el);
  if (modo === "tramo") T.forEach(t => etq(t, `${fmt(t.L * EPL.f, 2)} m`));
  else if (T.length && modo !== "no") etq(T[Math.floor((T.length - 1) / 2)], `${fmt(dsLargo(el) * EPL.f, 2)} m`);
  // Circuito y diámetro, al otro lado de la tubería, en el medio de su recorrido
  if (dsCirtDe(el) && (el.cir || el.dia) && T.length) {
    const t = T[Math.floor((T.length - 1) / 2)];
    etq(
      { ...t, k: -(t.k || -1e-9) },
      [[el.cir, ...(el.cx || [])].filter(Boolean).join(", "), el.sec || "", el.dia ? `Ø${el.dia} mm` : ""]
        .filter(Boolean)
        .join(" · ")
    );
  }
}
/* Marcas de conductores sobre la tubería (Norma DGE): una raya oblicua por fase; el neutro con un punto en su
   extremo (09-93-01) y la tierra con un tope (09-93-02). Van juntas, a un tercio del recorrido (en el medio está
   la longitud). Medidas en el papel (mm), como los textos. */
// Punto a una fracción del largo de la línea y la dirección allí
function dsPuntoA(el, frac) {
  const P = dsCurva(el);
  let tot = 0;
  for (let i = 2; i < P.length; i += 2) tot += Math.hypot(P[i] - P[i - 2], P[i + 1] - P[i - 1]);
  let falta = tot * frac,
    pt = [P[0], P[1]],
    ang = 0;
  for (let i = 2; i < P.length; i += 2) {
    const l = Math.hypot(P[i] - P[i - 2], P[i + 1] - P[i - 1]);
    ang = Math.atan2(P[i + 1] - P[i - 1], P[i] - P[i - 2]);
    if (l >= falta) {
      pt = [P[i - 2] + ((P[i] - P[i - 2]) * falta) / l, P[i - 1] + ((P[i + 1] - P[i - 1]) * falta) / l];
      break;
    }
    falta -= l;
  }
  return { pt, ang };
}
// Neutros de una tubería (antes, sí o no)
const dsNeutros = c => (c.n === true ? 1 : c.n || 0);
function dsMarcas(g, el, col, s, lw, frac = 0.5) {
  const c = el.cond,
    // Fases, retornos (raya con una «r» encima, criterio), neutros y tierra
    tipos = [
      ...Array(c.f || 0).fill("f"),
      ...Array(c.r || 0).fill("r"),
      ...Array(dsNeutros(c)).fill("n"),
      ...(c.t ? ["t"] : [])
    ];
  if (!tipos.length || dsMm(1) * s < 1.2) return;
  const { pt, ang } = dsPuntoA(el, frac),
    recta = DSU.marcaEst === "recta",
    m = dsMm(1),
    ux = Math.cos(ang),
    uy = Math.sin(ang),
    // Del papel (a lo largo, a través) al lienzo
    aP = (a, b) => plAPant(pt[0] + (a * ux - b * uy) * m, pt[1] + (a * uy + b * ux) * m),
    sep = 1.1;
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = lw;
  g.setLineDash([]);
  tipos.forEach((t, k) => {
    const a = (k - (tipos.length - 1) / 2) * sep,
      i = recta ? 0 : 0.5,
      [x0, y0] = aP(a - i, -1.3),
      [x1, y1] = aP(a + i, 1.3);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    if (t === "t") {
      const [x2, y2] = aP(a + i + 0.8, 1.3);
      g.lineTo(x2, y2);
    }
    g.stroke();
    if (t === "n") {
      g.beginPath();
      g.arc(x1, y1, 0.38 * m * s, 0, 2 * Math.PI);
      g.fill();
    }
  });
  // «r» junto a las rayas de los retornos, del lado opuesto a la longitud escrita, siempre derecha
  const ir = tipos.map((t, k) => (t === "r" ? k : -1)).filter(k => k >= 0);
  if (ir.length) {
    const a = ((ir[0] + ir[ir.length - 1]) / 2 - (tipos.length - 1) / 2) * sep,
      [X, Y] = aP(a, -2.9),
      hp = 1.6 * m * s;
    g.font = `italic 600 ${hp}px Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("r", X, Y);
  }
  g.restore();
}
// Tubería cuyas marcas (o el medio de su recorrido, si aún no tiene) están bajo el punto
function dsMarcasEn(x, y) {
  const r = dsMm(2.5);
  return (
    (dsD() ? dsD().els : []).find(el => {
      if (el.t !== "tub" || !dsEditable(el)) return false;
      const { pt } = dsPuntoA(el, 0.5);
      return Math.hypot(pt[0] - x, pt[1] - y) < r;
    }) || null
  );
}
// Ventanita con los conductores de la tubería, junto a sus marcas
function dsVentanaCond(el) {
  const c = el.cond || {},
    { pt } = dsPuntoA(el, 0.5),
    op = (k, n, v, suf) =>
      `<select data-edc="${k}">${Array.from({ length: n + 1 }, (x, i) => `<option value="${i}"${i === v ? " selected" : ""}>${i} ${suf}</option>`).join("")}</select>`;
  edMenuLista(
    pt,
    `<div class="ed-mt">Conductores de la tubería${el.cir ? " · " + esc(el.cir) : ""}</div>` +
      `<div class="ed-mc">${op("f", 6, c.f || 0, "F")}${op("r", 6, c.r || 0, "R")}${op("n", 2, dsNeutros(c), "N")}<label><input type="checkbox" data-edc="t"${c.t ? " checked" : ""}>T</label></div>` +
      `<div class="ed-mc"><select data-edc="dia"><option value="">Diámetro —</option>${DS_DIAS.map(d => `<option value="${d}"${d === el.dia ? " selected" : ""}>Ø ${d} mm</option>`).join("")}</select></div>` +
      (el.cir
        ? `<hr><button type="button" data-edm="sal:1" role="menuitem"><span>Igual en todo el circuito ${esc(el.cir)}</span></button>`
        : ""),
    () => {
      DS_SEL.clear();
      DS_SEL.add(el.id);
      edProps();
      $("edPropC").querySelector('[data-dsa="condcir"]')?.click();
    },
    e => {
      const k = e.target.dataset.edc,
        v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      if (k === "dia") el.dia = DS_DIAS.includes(+v) ? +v : undefined;
      else {
        const n = { f: 0, n: 0, t: false, ...(el.cond || {}) };
        n.n = dsNeutros(n);
        if (k === "t") n.t = !!v;
        else n[k] = parseInt(v, 10) || 0;
        if (!n.r) delete n.r;
        // Elegidos por el proyectista (aunque sean cero): ya no se cambian solos
        delete el.condA;
        el.cond = n;
      }
      edCambio();
    }
  );
}
// Transportador: círculo con rayitas cada «paso» grados, la del ángulo actual resaltada, y el arco desde 0° hasta él
// (rastreo polar y giro de símbolos). libre: el ángulo no está enganchado a una rayita
function dsTransportador(g, X, Y, ang, paso, col, d, libre, radio = 34) {
  const R = radio * d,
    p = Math.max(1, paso || 15),
    // Con pasos muy finos, las rayitas cada 15° (si no, no se distinguen)
    pr = p < 5 ? 15 : p;
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.globalAlpha = 0.35;
  g.lineWidth = 1 * d;
  g.beginPath();
  g.arc(X, Y, R, 0, 2 * Math.PI);
  g.stroke();
  for (let a = 0; a < 360; a += pr) {
    const t = (a * Math.PI) / 180,
      l = a % 90 === 0 ? 9 * d : a % 45 === 0 ? 7 * d : 4 * d;
    g.beginPath();
    g.moveTo(X + R * Math.cos(t), Y - R * Math.sin(t));
    g.lineTo(X + (R + l) * Math.cos(t), Y - (R + l) * Math.sin(t));
    g.stroke();
  }
  // Arco de 0° al ángulo actual y la rayita actual, resaltados
  const n = ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  g.globalAlpha = 0.85;
  g.lineWidth = 2 * d;
  g.beginPath();
  g.arc(X, Y, R * 0.55, 0, -n, true);
  g.stroke();
  g.beginPath();
  g.moveTo(X + (R - 6 * d) * Math.cos(n), Y - (R - 6 * d) * Math.sin(n));
  g.lineTo(X + (R + 12 * d) * Math.cos(n), Y - (R + 12 * d) * Math.sin(n));
  g.stroke();
  if (!libre) {
    g.beginPath();
    g.arc(X + R * Math.cos(n), Y - R * Math.sin(n), 3 * d, 0, 2 * Math.PI);
    g.fill();
  }
  g.restore();
}
// Texto breve con los datos de un elemento (información al pasar el cursor)
function dsInfoEl(el) {
  const f = EPL.f;
  if (el.t === "sim") {
    const c = DS_CAT[el.k];
    if (!c) return "";
    const pot = dsPotEl(el),
      tb = el.tab && dsD().els.find(e => e.id === el.tab);
    return [
      el.k === "tab" ? `${el.nom || "Tablero"} · ${el.nc || 0} circuitos` : c.n,
      el.cir ? `${el.cir}${tb ? " " + (tb.nom || "") : ""}` : "",
      c.u && pot != null ? `${pot} ${c.u}` : "",
      el.lt ? `tipo ${el.lt}` : "",
      el.cn || "",
      el.enc ? `encendido «${dsEncTxt(el)}»` : ""
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (el.t === "tub")
    return [
      `Tubería en ${el.modo === "piso" ? "piso" : el.modo === "pared" ? "pared" : "techo"}`,
      el.ali ? "alimentador" : [el.cir, ...(el.cx || [])].filter(Boolean).join(", "),
      el.sec || "",
      `${fmt(dsLargo(el) * f, 2)} m`,
      el.cond ? dpCond(el.cond) : "",
      el.dia ? `Ø ${el.dia} mm` : ""
    ]
      .filter(Boolean)
      .join(" · ");
  if (el.t === "lin" && el.ar)
    return [el.ar.n, `${fmt(dsM2(el), 2)} m²`, PL_TAREA[el.ar.tp].toLowerCase()].filter(Boolean).join(" · ");
  if (el.t === "lin") return `Línea · ${fmt(dsLargo(el) * f, 2)} m`;
  return "";
}
// Letra de encendido (a, b, c…) junto al artefacto, arriba a la izquierda, siempre derecha
function dsDibEnc(g, el, col, s) {
  const hp = dsMm(2.2) * s;
  if (hp < 4) return;
  const b = dsBBox(el),
    [X, Y] = plAPant(b[0], b[3]);
  g.save();
  g.font = `italic 600 ${hp / 0.72}px Arial, sans-serif`;
  g.textAlign = "right";
  g.textBaseline = "bottom";
  g.lineJoin = "round";
  g.lineWidth = 3 * plDpr();
  g.strokeStyle = PL_FONDO;
  g.strokeText(dsEncTxt(el), X, Y + hp * 0.2);
  g.fillStyle = col;
  g.fillText(dsEncTxt(el), X, Y + hp * 0.2);
  g.restore();
}
// Circuito del artefacto (C-1, C-2…) abajo a la derecha, pequeño y derecho (Dibujo › Circuito en las salidas)
/* Tablero general del edificio: se dibuja con el símbolo DGE 09-91-16 (panel de distribución, rectángulo rayado),
   porque solo distribuye a los suministros; los demás tableros, con el 09-91-17. Mismo tamaño: las salidas, las
   conexiones y la selección no cambian (elección del proyectista, 2026-11-17). */
const dsKVis = el =>
  el.k === "tab" && MODE === "multi" && (el.nom || "TG").trim().toUpperCase() === "TG" ? "tabD" : el.k;
// ¿Tablero trifásico? El sistema elegido en su ventana o, si no, el del proyecto (el de su medidor si es de un tipo)
function dsTabTri(el) {
  if (el.k !== "tab") return false;
  const multi = MODE === "multi",
    skP = (multi ? PROY.sistG : PROY.sist) || (multi ? "tri380" : "mono220"),
    triP = !!(SIST[skP] || {}).tri;
  if (String(el.fs) === "3") return true;
  if (String(el.fs) === "1") return false;
  if (multi && Number.isInteger(el.dep)) {
    const t = tipos[el.dep];
    return !!(t && t.fases === "3" && triP);
  }
  return triP;
}
// «3φ» junto al tablero trifásico, arriba a la derecha del símbolo (anotación de criterio, no parte del símbolo DGE)
function dsDib3f(g, el, col, s) {
  const hp = dsMm(1.8) * s;
  if (hp < 4) return;
  const b = dsBBox(el),
    [X, Y] = plAPant(b[2], b[1]);
  g.save();
  g.font = `700 ${hp / 0.72}px Arial, sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "top";
  g.fillStyle = col;
  g.fillText("3φ", X + hp * 0.2, Y + hp * 0.1);
  g.restore();
}
function dsDibNum(g, el, col, s) {
  const hp = dsMm(1.8) * s;
  if (hp < 4) return;
  const b = dsBBox(el),
    [X, Y] = plAPant(b[2], b[1]);
  g.save();
  g.font = `600 ${hp / 0.72}px Arial, sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "top";
  g.fillStyle = col;
  g.fillText(el.cir, X + hp * 0.2, Y + hp * 0.1);
  g.restore();
}
// Grupos con letra de encendido
const dsConEnc = el => el.t === "sim" && DS_CAT[el.k] && ["Iluminación", "Interruptores"].includes(DS_CAT[el.k].g);
const dsEsInt = el => el.t === "sim" && DS_CAT[el.k] && DS_CAT[el.k].g === "Interruptores";
/* Letras de encendido de un elemento: la luminaria tiene una; el interruptor, una por tecla (doble «a,b», triple
   «a,b,c»), guardadas con coma */
const dsLetras = el => (el.enc ? String(el.enc).split(",") : []);
// Lo escrito en Encendido, limpio: en un interruptor, «ab», «a,b» o «a b» son dos teclas (hasta 4); «a1» es una
function dsEncLimpio(v, el) {
  const s = String(v || "").toLowerCase();
  if (!dsEsInt(el)) return s.replace(/[^a-z0-9]/g, "").slice(0, 3) || undefined;
  const L = s
    .split(/[^a-z0-9]+/)
    .flatMap(x => (/^[a-z]+$/.test(x) ? x.split("") : [x.slice(0, 3)]))
    .filter(Boolean);
  return [...new Set(L)].slice(0, 4).join(",") || undefined;
}
// Texto de la letra en el plano: las teclas de una letra, juntas («ab»); si alguna es más larga, con coma
const dsEncTxt = el => {
  const L = dsLetras(el);
  return L.every(x => x.length === 1) ? L.join("") : L.join(",");
};
/* Salidas de circuito del tablero (ventana Tablero, doble clic): un trazo corto desde el frente del tablero (el lado
   opuesto al muro) hasta el punto de conexión, con su nombre (C-1, C-2…). Hasta 10 por fila; desde la 11, otra fila
   más adelante y corrida medio paso, para que los trazos no se crucen. En unidades del símbolo y en el dibujo. */
function dsSalidasTab(el) {
  const n = el.k === "tab" ? el.nc || 0 : 0,
    out = [];
  if (!n) return out;
  dsPrims("tab");
  const frente = DS_BB.tab[1],
    sep = 6,
    porFila = 10,
    // C-1 a la izquierda (o arriba, en un muro lateral), como se lee el plano, gire como gire el tablero
    r = ((el.r || 0) * Math.PI) / 180,
    lado = Math.cos(r) < -0.5 || (Math.abs(Math.cos(r)) <= 0.5 && Math.sin(r) > 0) ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const fila = Math.floor(i / porFila),
      enFila = Math.min(porFila, n - fila * porFila),
      a = lado * (((i % porFila) - (enFila - 1) / 2) * sep + (fila % 2 ? sep / 2 : 0)),
      b = frente - 5 - fila * 9;
    out.push({ i, n: "C-" + (i + 1), d: (el.cd || [])[i] || "", a, b0: frente, b, p: dsAMundo(el, a, b) });
  }
  return out;
}
/* Medidores del banco de un edificio, numerados M-1, M-2…: uno por departamento (en el orden de los tipos y de su
   número: A-1, A-2, B-1…) y, si los servicios generales tienen su medidor en el banco, el del TSG al final. Es la
   misma numeración de las láminas del banco y del tablero general (suministrosBanco). */
function dsMedidoresBanco(el) {
  if (typeof MODE === "undefined") return [];
  /* Escritos por el proyectista en el banco (a qué tablero va cada uno y si es monofásico o trifásico): fuera de un
     edificio multifamiliar (por ejemplo, locales de un comercio), o en el edificio si los elige así o si aún no hay
     departamentos con su cantidad */
  const auto = dsMedidoresAuto();
  if (dsBancoManual(el, auto))
    return ((el && el.meds) || []).map((m, i) => ({
      n: `M-${i + 1}`,
      dep: m.d || "",
      tab: m.d || "",
      tri: m.f === 3,
      man: true
    }));
  return auto;
}
// Los medidores del banco se escriben a mano (y no salen de los departamentos)
const dsBancoManual = (el, auto) => MODE !== "multi" || !!(el && el.mman) || !auto.some(m => m.dep !== "TSG");
// Medidores del edificio según sus departamentos (en el orden de los tipos y de su número) y el de servicios generales
function dsMedidoresAuto() {
  if (MODE !== "multi") return [];
  const out = [];
  tipos.forEach((t, i) => {
    // Unidades y tablero: los del cálculo (con el diseño, el nombre del tablero del plano) o los escritos
    const tc = LAST && LAST.mode === "multi" ? LAST.T.find(x => x._i === i) : null,
      l = (t.nombre || "").replace(/^Tipo\s*/i, ""),
      n = Math.max(0, Math.round(t.cant > 0 ? +t.cant : tc && tc.cantPlano ? tc.cant : 0));
    for (let k = 1; k <= n; k++) out.push({ dep: `${l}-${k}`, tri: t.fases === "3", tab: (tc && tc.tab) || "TD-" + l });
  });
  const D = dsD();
  if (PROY.tsgDe !== "tg" && (serv.some(x => x.p > 0) || (D && D.els.some(e => e.k === "tab" && e.nom === "TSG"))))
    out.push({ dep: "TSG", tri: !!(SIST[PROY.sistG || "tri380"] || {}).tri, tab: "TSG" });
  return out.map((m, i) => ({ ...m, n: `M-${i + 1}` }));
}
// Lista numerada de los medidores junto al banco (a su derecha, en columnas de 10), en el plano y en las láminas
function dsDibBanco(g, el, col, u) {
  const M = dsMedidoresBanco(el);
  if (!M.length || 3 * u < 3) return;
  const b = dsBBox(el),
    [x0, y0] = plAPant(b[2], b[3]),
    h = 4 * u,
    ancho = 19 * u;
  g.save();
  g.font = `600 ${(3 * u) / 0.72}px Arial, sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "top";
  g.lineJoin = "round";
  g.lineWidth = 3 * plDpr();
  g.strokeStyle = PL_FONDO;
  g.fillStyle = col;
  M.forEach((m, i) => {
    const x = x0 + 2 * u + Math.floor(i / 10) * ancho,
      y = y0 + (i % 10) * h,
      t = `${m.n}${m.dep ? " " + m.dep : ""}${m.tri ? " 3φ" : ""}`;
    g.strokeText(t, x, y);
    g.fillText(t, x, y);
  });
  g.restore();
}
// Dibuja las salidas del tablero y su nombre
function dsDibSalidas(g, el, col, u, lw) {
  const S = dsSalidasTab(el),
    rot = ((el.r || 0) * Math.PI) / 180,
    [X, Y] = plAPant(el.x, el.y),
    // Del símbolo (unidades, y hacia abajo) al lienzo
    aPant = (a, b) => {
      const c = Math.cos(rot),
        s = Math.sin(rot);
      return [X + u * (a * c + b * s), Y - u * (a * s - b * c)];
    },
    ht = 3 * u;
  g.strokeStyle = col;
  g.lineWidth = lw;
  /* Salidas juntadas: los circuitos que van en «Lleva también» de una tubería salen por la salida donde ella se
     conecta; un trazo por el frente une sus puntos (se dibuja antes, los círculos quedan encima) */
  dsD()
    .els.filter(t => t.t === "tub" && !t.ali && t.cx && (t.c0 === el.id || t.c1 === el.id))
    .forEach(t => {
      const h = S.find(o => o.n === t.cir);
      if (!h) return;
      const [xh, yh] = aPant(h.a, h.b);
      t.cx.forEach(c => {
        const o = S.find(q => q.n === c);
        if (!o) return;
        const [xo, yo] = aPant(o.a, o.b);
        g.strokeStyle = DSU.color === "cir" && !el.col ? plColorDis(dsColCir(t.cir, el.id)) : col;
        g.beginPath();
        g.moveTo(xo, yo);
        g.lineTo(xh, yh);
        g.stroke();
      });
    });
  S.forEach(o => {
    const co = DSU.color === "cir" && !el.col ? plColorDis(dsColCir(o.n, el.id)) : col;
    g.strokeStyle = co;
    const [x0, y0] = aPant(o.a, o.b0),
      [x1, y1] = aPant(o.a, o.b + 1),
      [xc, yc] = aPant(o.a, o.b);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.beginPath();
    g.arc(xc, yc, Math.max(1.5 * plDpr(), u), 0, 2 * Math.PI);
    g.fillStyle = PL_FONDO;
    g.fill();
    g.stroke();
    if (ht < 5) return;
    // Nombre más allá del punto, en la dirección de la salida, siempre legible
    const [xt, yt] = aPant(o.a, o.b - 2.2),
      ang = Math.atan2(yt - yc, xt - xc),
      // Legible: hacia la derecha o, si es vertical, de abajo hacia arriba
      der = Math.cos(ang) > 1e-6 || (Math.abs(Math.cos(ang)) <= 1e-6 && Math.sin(ang) < 0);
    g.save();
    g.translate(xt, yt);
    g.rotate(der ? ang : ang + Math.PI);
    g.font = `600 ${ht / 0.72}px Arial, sans-serif`;
    g.textAlign = der ? "left" : "right";
    g.textBaseline = "middle";
    g.fillStyle = co;
    g.fillText(o.n, 0, 0);
    g.restore();
  });
  // Nombre del tablero encima, centrado y derecho; debajo si sus salidas van hacia arriba
  if (el.nom && 4 * u >= 5) {
    const b = dsBBox(el),
      sal = dsAMundo(el, 0, -1),
      arriba = sal[1] - el.y > 0.5 * dsU(),
      [xn, yn] = plAPant((b[0] + b[2]) / 2, arriba ? b[1] : b[3]);
    g.save();
    g.font = `700 ${(4 * u) / 0.72}px Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = arriba ? "top" : "bottom";
    g.lineJoin = "round";
    g.lineWidth = 3 * plDpr();
    g.strokeStyle = PL_FONDO;
    const yy = yn + (arriba ? 1 : -1) * 1.5 * u,
      nom = el.nom + (el.fs === 3 ? " 3φ" : "");
    g.strokeText(nom, xn, yy);
    g.fillStyle = col;
    g.fillText(nom, xn, yy);
    g.restore();
  }
}
// Número de la caja de paso (CP-1, CP-2…) a su derecha, en el plano y en las láminas
function dsDibNomCaja(g, el, col, u) {
  if (3 * u < 4) return;
  const b = dsBBox(el),
    [xn, yn] = plAPant(b[2], (b[1] + b[3]) / 2),
    x = xn + 1.2 * u;
  g.save();
  g.font = `700 ${(3 * u) / 0.72}px Arial, sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = 3 * plDpr();
  g.strokeStyle = PL_FONDO;
  g.strokeText(el.nom, x, yn);
  g.fillStyle = col;
  g.fillText(el.nom, x, yn);
  g.restore();
}
// Guiones del elemento en unidades del dibujo: la tubería por piso, discontinua; las demás, según su capa
function dsGuiones(el, cap) {
  if (el.t === "tub") return el.modo === "piso" ? [dsMm(3), dsMm(1.5)] : [];
  if (cap.lt === "trazos") return [dsMm(3), dsMm(1.5)];
  if (cap.lt === "punto") return [dsMm(5), dsMm(1), dsMm(0.5), dsMm(1)];
  return [];
}
function plRuta(g, p, cerrado) {
  for (let i = 0; i < p.length; i += 2) {
    const [X, Y] = plAPant(p[i], p[i + 1]);
    if (i) g.lineTo(X, Y);
    else g.moveTo(X, Y);
  }
  if (cerrado) g.closePath();
}
// Color de una capa del diseño, legible sobre el fondo (sin el modo atenuado, que es solo para la arquitectura)
function plColorDis(h) {
  let v = plRgb(h);
  const l = plLum(v);
  if (!PL_OSCURO && l > 0.8) v = [38, 48, 60];
  // Sobre un fondo oscuro, los colores oscuros del diseño se aclaran para leerse bien
  else if (PL_OSCURO && l < 0.55) v = v.map(x => x + (235 - x) * (l < 0.25 ? 0.6 : 0.42));
  return plHex(v);
}

/* ---------- Pinzamientos: vértices, curvatura de cada tramo, centro, radio y línea de cota ---------- */
// Posición de la letra del tipo de un símbolo (su primer texto movible, con el corrimiento dt)
function dsPosLetra(el) {
  const p = dsPrims(el.k).find(q => dsEsLetra(el.k, q));
  if (!p) return null;
  const dt = el.dt || [0, 0];
  return dsAMundo(el, p.a[0] + dt[0], p.a[1] + dt[1] - p.a[2] * 0.35);
}
// Pinzamiento de giro: por encima del símbolo (o al final del texto), a la vista
function dsPosGiro(el) {
  if (el.t === "txt") {
    const r = ((el.r || 0) * Math.PI) / 180,
      l = el.ht * 0.62 * el.s.length + dsMm(3);
    return [el.x + l * Math.cos(r), el.y + l * Math.sin(r)];
  }
  dsPrims(el.k);
  return dsAMundo(el, 0, DS_BB[el.k][1] - 7);
}
function dsAgarres(el) {
  if (dsEsTabla(el)) return [{ t: "ins", x: el.x, y: el.y }];
  if (el.t === "sim" || el.t === "txt") {
    const out = [{ t: "ins", x: el.x, y: el.y }],
      [gx, gy] = dsPosGiro(el);
    out.push({ t: "giro", x: gx, y: gy });
    const pl = el.t === "sim" && dsPosLetra(el);
    if (pl) out.push({ t: "letra", x: pl[0], y: pl[1] });
    return out;
  }
  if (el.t === "cir")
    return [
      { t: "ins", x: el.x, y: el.y },
      { t: "rad", x: el.x + el.rad, y: el.y }
    ];
  if (el.t === "cot") {
    const G = dsCotaGeo(el);
    return [
      { t: "a", x: el.a[0], y: el.a[1] },
      { t: "b", x: el.b[0], y: el.b[1] },
      { t: "o", x: (G.pa[0] + G.pb[0]) / 2, y: (G.pa[1] + G.pb[1]) / 2 }
    ];
  }
  if (el.t === "dir")
    return [
      { t: "v", i: 0, x: el.pts[0], y: el.pts[1] },
      { t: "v", i: 1, x: el.pts[2], y: el.pts[3] }
    ];
  const g = [];
  for (let i = 0; i < el.pts.length; i += 2) g.push({ t: "v", i: i / 2, x: el.pts[i], y: el.pts[i + 1] });
  dsTramos(el).forEach(t => g.push({ t: "m", i: t.i, x: t.m[0], y: t.m[1] }));
  return g;
}
// Pinzamiento de un elemento seleccionado bajo el cursor (en píxeles), o null
function dsAgarreEn(X, Y) {
  if (DS_SEL.size > 30) return null;
  const r = 7 * plDpr();
  for (const el of dsSel()) {
    if (!dsEditable(el)) continue;
    for (const a of dsAgarres(el)) {
      const [x, y] = plAPant(a.x, a.y);
      if (Math.abs(x - X) <= r && Math.abs(y - Y) <= r) return { id: el.id, ...a };
    }
  }
  return null;
}
// Arrastre de un pinzamiento hasta q (orig: el elemento antes de empezar)
function dsAgarreMover(ag, q) {
  dsAgarreMover1(ag, q);
  const el = dsD().els.find(e => e.id === ag.id);
  // Un artefacto que se mueve o gira arrastra las puntas de sus tuberías
  if (el && el.t === "sim") dsReconectar();
}
function dsAgarreMover1(ag, q) {
  dsIdxSucio();
  const el = dsD().els.find(e => e.id === ag.id);
  if (!el) return;
  const o = JSON.parse(ag.orig);
  if (ag.t === "ins") {
    const dx = q[0] - ag.x,
      dy = q[1] - ag.y;
    if (o.pts) el.pts = o.pts.map((v, i) => v + (i % 2 ? dy : dx));
    else if (o.a) {
      el.a = [o.a[0] + dx, o.a[1] + dy];
      el.b = [o.b[0] + dx, o.b[1] + dy];
    } else {
      el.x = o.x + dx;
      el.y = o.y + dy;
    }
  } else if (ag.t === "giro") {
    // El pinzamiento está arriba del símbolo (a 90° de su eje) o al final del texto (sobre su eje)
    let a = (Math.atan2(q[1] - el.y, q[0] - el.x) * 180) / Math.PI - (el.t === "sim" ? 90 : 0);
    const paso = PLH.libre ? (DSU.giro ? 0 : 15) : DSU.giro;
    if (paso) a = Math.round(a / paso) * paso;
    else if (DSU.polar && !PLH.libre) {
      // Imán: cerca (a menos de 4°) de un múltiplo del ángulo de enganche, se pega a él
      const inc = DSU.polarInc || 15,
        ak = Math.round(a / inc) * inc;
      if (Math.abs(a - ak) < 4) a = ak;
    }
    el.r = Math.round((((a % 360) + 360) % 360) * 100) / 100;
  } else if (ag.t === "letra") {
    // Corrimiento de la letra en unidades del símbolo: el punto q llevado a las coordenadas del símbolo
    const p = dsPrims(el.k).find(x => dsEsLetra(el.k, x)),
      u = dsUk(el.k),
      r = ((el.r || 0) * Math.PI) / 180,
      wx = (q[0] - el.x) / u,
      wy = (q[1] - el.y) / u,
      a = wx * Math.cos(r) + wy * Math.sin(r),
      b = wx * Math.sin(r) - wy * Math.cos(r);
    el.dt = [+(a - p.a[0]).toFixed(2), +(b - (p.a[1] - p.a[2] * 0.35)).toFixed(2)];
  } else if (ag.t === "v") {
    el.pts[2 * ag.i] = q[0];
    el.pts[2 * ag.i + 1] = q[1];
  } else if (ag.t === "m") {
    const t = dsTramos(o)[ag.i],
      b = (el.b || []).slice();
    while (b.length < dsTramos(el).length) b.push(0);
    b[ag.i] = dsCurvDe(t.a, t.b, q);
    el.b = b;
  } else if (ag.t === "rad") el.rad = Math.max(1e-6, Math.hypot(q[0] - el.x, q[1] - el.y));
  else if (ag.t === "a" || ag.t === "b") el[ag.t] = [q[0], q[1]];
  else if (ag.t === "o") el.o = dsCotaO(el, q);
  plDibujar();
}

/* ---------- Encaje en el muro: los símbolos de pared se apoyan en la línea más cercana y giran con ella ---------- */
function dsAlinear(k, q) {
  const c = DS_CAT[k];
  if (!c || !c.m || !DSU.alinear) return null;
  const s = plSegCercano(q[0], q[1], (26 * plDpr()) / PLV.s, true);
  if (!s) return null;
  let vx = s.p[0] - q[0],
    vy = s.p[1] - q[1],
    d = Math.hypot(vx, vy);
  // Con el cursor justo sobre la línea, el símbolo queda a su izquierda
  if (d < 1e-9) {
    const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1;
    vx = -(s.b[1] - s.a[1]) / L;
    vy = (s.b[0] - s.a[0]) / L;
    d = 1;
  }
  // n: del símbolo hacia el muro; el lado del símbolo que se apoya mira en esa dirección
  dsPrims(k);
  const nx = vx / d,
    ny = vy / d,
    b = DS_BB[k],
    u = dsUk(k),
    // Lado del símbolo que mira al muro: izquierdo, de abajo o de arriba (unidades del símbolo, y hacia abajo)
    th = c.m === "izq" ? Math.atan2(-ny, -nx) : c.m === "arriba" ? Math.atan2(-nx, ny) : Math.atan2(nx, -ny),
    ext = c.m === "izq" ? -b[0] : c.m === "arriba" ? -b[1] : b[3],
    r = Math.round((((((th * 180) / Math.PI) % 360) + 360) % 360) * 100) / 100;
  return { x: s.p[0] - nx * ext * u, y: s.p[1] - ny * ext * u, r, seg: s };
}
