/* DISEÑO ELÉCTRICO · LIENZO SUPERIOR Y HERRAMIENTAS
   Lo que sigue al cursor (selección, pinzamientos, fantasma del símbolo, trazo en curso y marco) y las
   herramientas para colocar símbolos y dibujar.
   Antes era parte de js/diseno.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Lienzo superior: selección, pinzamientos, fantasma del símbolo, trazo en curso y marco ---------- */
function dsSobre(g) {
  const D = dsD();
  if (!D) return;
  const d = plDpr(),
    selc = PL_OSCURO ? "#5fb0ff" : "#1f6fd6",
    caliente = "#e5484d";
  D.els.forEach(el => {
    if (!DS_SEL.has(el.id) && el.id !== PLH.dsSobre) return;
    // Resaltado suave: el contorno del propio elemento, como un halo, sin rectángulos (más tenue bajo el cursor)
    const sel = DS_SEL.has(el.id);
    g.globalAlpha = sel ? 0.32 : 0.18;
    if (el.t === "sim") {
      const [X, Y] = plAPant(el.x, el.y);
      dsDibSim(g, dsKVis(el), X, Y, ((el.r || 0) * Math.PI) / 180, dsUk(el.k) * PLV.s, selc, null, 5 * d, el.dt);
    } else if (el.t === "txt") {
      const b = dsBBox(el),
        [a, c] = plAPant(b[0], b[3]),
        [e, f] = plAPant(b[2], b[1]);
      g.fillStyle = selc;
      g.fillRect(a - 2 * d, c - 2 * d, e - a + 4 * d, f - c + 4 * d);
    } else {
      g.strokeStyle = selc;
      g.lineWidth = 6 * d;
      g.lineCap = g.lineJoin = "round";
      g.beginPath();
      dsLineas(el).forEach(p => plRuta(g, p, false));
      g.stroke();
    }
    g.globalAlpha = 1;
    if (!sel || DS_SEL.size > 30) return;
    // Pinzamientos: cuadrados en vértices e inserción; rombos en el medio de los tramos (curvan) y en la cota
    g.strokeStyle = PL_OSCURO ? "#111922" : "#fff";
    g.lineWidth = 1.2 * d;
    dsAgarres(el).forEach(a => {
      const [X, Y] = plAPant(a.x, a.y),
        cal = PLH.agSobre && PLH.agSobre.id === el.id && PLH.agSobre.t === a.t && PLH.agSobre.i === a.i;
      g.fillStyle = cal ? caliente : selc;
      // Giro: círculo unido al punto de inserción; letra: cuadrado hueco
      if (a.t === "giro") {
        const [Xi, Yi] = plAPant(el.x, el.y);
        g.save();
        g.strokeStyle = selc;
        g.globalAlpha = 0.5;
        g.setLineDash([3 * d, 2 * d]);
        g.beginPath();
        g.moveTo(Xi, Yi);
        g.lineTo(X, Y);
        g.stroke();
        g.restore();
        g.beginPath();
        g.arc(X, Y, 5 * d, 0, 2 * Math.PI);
        g.fill();
        g.stroke();
        return;
      }
      if (a.t === "letra") {
        g.save();
        g.strokeStyle = cal ? caliente : selc;
        g.lineWidth = 1.6 * d;
        g.strokeRect(X - 4 * d, Y - 4 * d, 8 * d, 8 * d);
        g.restore();
        return;
      }
      g.beginPath();
      if (a.t === "m" || a.t === "o") {
        const r = 5 * d;
        g.moveTo(X, Y - r);
        g.lineTo(X + r, Y);
        g.lineTo(X, Y + r);
        g.lineTo(X - r, Y);
        g.closePath();
      } else g.rect(X - 4 * d, Y - 4 * d, 8 * d, 8 * d);
      g.fill();
      g.stroke();
    });
  });
  const q = plPuntoActual();
  // Símbolo que se va a colocar, siguiendo al cursor (encajado en el muro si corresponde)
  if (PLH.h && PLH.h.startsWith("col:") && q) {
    const k = PLH.h.slice(4),
      al = PLH.alin,
      [X, Y] = plAPant(al ? al.x : q[0], al ? al.y : q[1]);
    if (al) {
      const s = al.seg,
        [a, b] = plAPant(s.a[0], s.a[1]),
        [c, e] = plAPant(s.b[0], s.b[1]);
      g.strokeStyle = PL_OSCURO ? "#7ee08a" : "#1f8a3a";
      g.lineWidth = 3 * d;
      g.globalAlpha = 0.45;
      g.beginPath();
      g.moveTo(a, b);
      g.lineTo(c, e);
      g.stroke();
      g.globalAlpha = 1;
    }
    g.globalAlpha = 0.65;
    dsDibSim(
      g,
      k,
      X,
      Y,
      (((al ? al.r : PLH.rot) || 0) * Math.PI) / 180,
      dsUk(k) * PLV.s,
      plColorDis(dsColorEl({ t: "sim", k }, dsCapa(DS_SIS[DS_CAT[k].s].capa))),
      PL_FONDO
    );
    g.globalAlpha = 1;
  }
  // Trazo en curso
  const h = PLH.h;
  if (DS_HERR[h] && PLH.pts.length && q) {
    let pts = PLH.pts;
    const ini = dsEsTub(h) && PLH.conIni && dsD().els.find(e => e.id === PLH.conIni);
    if (ini && ini.k !== "tab") {
      const sg = pts[1] || q;
      pts = [dsBorde(ini, sg[0], sg[1]), ...pts.slice(1)];
    }
    const capa = dsCapaPara(h),
      col = plColorDis(dsCapa(capa).col);
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = dsGrosor(dsCapa(capa));
    g.setLineDash(h === "tubP" ? [dsMm(3) * PLV.s, dsMm(1.5) * PLV.s] : []);
    g.beginPath();
    if (h === "rect" || h === "areaR") {
      const [a, b] = plAPant(pts[0][0], pts[0][1]),
        [c, e] = plAPant(q[0], q[1]);
      g.rect(a, b, c - a, e - b);
      g.stroke();
    } else if (h === "cir") {
      const [X, Y] = plAPant(pts[0][0], pts[0][1]);
      g.arc(X, Y, Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) * PLV.s, 0, 2 * Math.PI);
      g.stroke();
    } else if (h === "cotA" || h === "cotL") {
      g.setLineDash([]);
      const el = dsCotaNueva(q);
      if (el) dsDibCota(g, el, col, PLV.s);
      else {
        plRuta(g, [...pts[0], ...q], false);
        g.stroke();
      }
    } else if (h === "dir") {
      dsDibDir(g, { pts: [...pts[0], ...q], s: "…", ht: dsMm(2.5) }, col, PLV.s);
    } else {
      const el = { pts: [...pts.flat(), ...q], b: [...(PLH.bul || []), dsEsTub(h) ? dsBulNuevo() : 0] };
      plRuta(g, dsCurva(el), false);
      g.stroke();
    }
    g.setLineDash([]);
    // Longitud del tramo en curso (la del arco, si es curvo)
    if (h !== "cotA" && h !== "cotL" && h !== "dir") {
      const u = pts[pts.length - 1],
        t = dsTramos({ pts: [...u, ...q], b: [dsEsTub(h) ? dsBulNuevo() : 0] })[0],
        L = h === "cir" ? Math.hypot(q[0] - u[0], q[1] - u[1]) : t ? t.L : 0,
        m = t ? t.m : q,
        [X, Y] = plAPant(m[0], m[1]);
      g.font = `600 ${11.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
      plEtiqueta(g, (h === "cir" ? "R " : "") + plFm(L) + " m", X, Y - 8 * d, col, "center", "bottom");
    }
  }
  // Copiar en fila o espejo: fantasma de las copias y la línea de los dos puntos
  if ((h === "fila" || h === "espejo") && PLH.copia && PLH.pts.length && q) {
    const a = PLH.pts[0],
      lista = dsD().els.filter(el => PLH.copia.ids.includes(el.id)),
      gv = PL_OSCURO ? "#8fc1f0" : "#1f6fd6",
      [Xa, Ya] = plAPant(a[0], a[1]),
      [Xq, Yq] = plAPant(q[0], q[1]);
    g.save();
    g.strokeStyle = gv;
    g.lineWidth = 1 * d;
    g.setLineDash([6 * d, 4 * d]);
    g.beginPath();
    if (h === "espejo") {
      const L = Math.hypot(Xq - Xa, Yq - Ya) || 1,
        ex = ((Xq - Xa) / L) * 4000 * d,
        ey = ((Yq - Ya) / L) * 4000 * d;
      g.moveTo(Xa - ex, Ya - ey);
      g.lineTo(Xa + ex, Ya + ey);
    } else {
      g.moveTo(Xa, Ya);
      g.lineTo(Xq, Yq);
    }
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 0.45;
    const dx = q[0] - a[0],
      dy = q[1] - a[1],
      L = Math.hypot(dx, dy);
    if (L > 1e-9)
      lista.forEach(el => {
        if (h === "fila")
          for (let k = 1; k <= Math.min(PLH.copia.n, 60); k++)
            dsFantasma(g, el, o => dsTrasladar(o, dx * k, dy * k), gv);
        else dsFantasma(g, el, o => dsReflejar(o, a, dx / L, dy / L), gv);
      });
    g.restore();
  }
  // Leyenda que se va a colocar
  if ((h === "ley" || h === "cua") && q) {
    g.save();
    g.globalAlpha = 0.5;
    (h === "ley" ? dsDibLeyenda : dsDibCuadro)(
      g,
      { t: h, x: q[0], y: q[1] },
      PL_OSCURO ? "#8fc1f0" : "#1f6fd6",
      PLV.s,
      plDpr()
    );
    g.restore();
  }
  // Bloque que se va a colocar y comparación con una versión
  dpSobre(g, q, d);
  // Datos del elemento bajo el cursor (en Seleccionar, sin arrastrar)
  if (DSU.info !== false && !h && PLH.dsSobre && !PLH.arr && !PLH.agarre && !PLH.marco && PLH.cur) {
    const el = dsD().els.find(e => e.id === PLH.dsSobre),
      t = el && dsInfoEl(el);
    if (t) {
      const [X, Y] = plAPant(PLH.cur[0], PLH.cur[1]);
      g.save();
      g.globalAlpha = 0.88;
      g.font = `500 ${10.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
      plEtiqueta(g, t, X + 14 * d, Y + 14 * d, PL_OSCURO ? "#9fb4c8" : "#14304f", "left", "top");
      g.restore();
    }
  }
  // Rastreo polar: transportador en el punto anterior, la guía en la dirección exacta y el imán en el cursor
  if (PLH.polar && q) {
    const { u, ang } = PLH.polar,
      [X0, Y0] = plAPant(u[0], u[1]),
      [Xq, Yq] = plAPant(q[0], q[1]),
      L = 4000 * d,
      gv = PL_OSCURO ? "#7ee08a" : "#1f8a3a",
      deg = Math.round(((((ang * 180) / Math.PI) % 360) + 360) % 360);
    dsTransportador(g, X0, Y0, ang, DSU.polarInc, gv, d);
    g.save();
    g.strokeStyle = gv;
    // Guía: firme hasta el cursor, a trazos más allá
    g.globalAlpha = 0.85;
    g.lineWidth = 1.2 * d;
    g.beginPath();
    g.moveTo(X0, Y0);
    g.lineTo(Xq, Yq);
    g.stroke();
    g.globalAlpha = 0.45;
    g.lineWidth = 1 * d;
    g.setLineDash([6 * d, 4 * d]);
    g.beginPath();
    g.moveTo(Xq, Yq);
    g.lineTo(X0 + L * Math.cos(ang), Y0 - L * Math.sin(ang));
    g.stroke();
    g.setLineDash([]);
    // Imán: rombo en el punto que toma el cursor
    g.globalAlpha = 0.9;
    g.lineWidth = 1.5 * d;
    const r = 5 * d;
    g.beginPath();
    g.moveTo(Xq, Yq - r);
    g.lineTo(Xq + r, Yq);
    g.lineTo(Xq, Yq + r);
    g.lineTo(Xq - r, Yq);
    g.closePath();
    g.stroke();
    g.restore();
    g.save();
    g.globalAlpha = 0.75;
    g.font = `600 ${10.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
    plEtiqueta(
      g,
      `${deg}° · ${plFm(Math.hypot(q[0] - u[0], q[1] - u[1]))} m`,
      Xq + 12 * d,
      Yq + 10 * d,
      gv,
      "left",
      "top"
    );
    g.restore();
  }
  // Marco de selección: de izquierda a derecha, ventana (lo que queda dentro); al revés, captura (lo que toca)
  const mc = PLH.marco;
  if (mc && mc.mov) {
    const cap = mc.X1 < mc.X0;
    g.fillStyle = cap ? "rgba(46,160,67,.10)" : "rgba(31,111,214,.10)";
    g.strokeStyle = cap ? "#2ea043" : selc;
    g.lineWidth = 1 * d;
    g.setLineDash(cap ? [5 * d, 3 * d] : []);
    g.fillRect(mc.X0, mc.Y0, mc.X1 - mc.X0, mc.Y1 - mc.Y0);
    g.strokeRect(mc.X0, mc.Y0, mc.X1 - mc.X0, mc.Y1 - mc.Y0);
    g.setLineDash([]);
  }
}
// Curvatura del tramo nuevo de una tubería: la del trazo elegido (curvo o recto) y del lado elegido (F invierte)
const dsBulNuevo = () => (DSU.curva ? DS_BUL * (PLH.lado || 1) : 0);
// Capa a la que va lo que se dibuja con cada herramienta: tuberías, cotas, textos y directrices a la suya; las
// líneas, rectángulos y círculos a la capa actual
const dsCapaPara = h =>
  h === "tubT"
    ? DS_SIS.tubT.capa
    : h === "tubP"
      ? DS_SIS.tubP.capa
      : h === "cotA" || h === "cotL"
        ? DS_SIS.cot.capa
        : h === "txt"
          ? DS_SIS.txt.capa
          : h === "dir"
            ? DS_SIS.cto.capa
            : /^area/.test(h)
              ? DS_SIS.are.capa
              : dsD().actual;
// Cota en curso con los dos puntos tomados y el cursor como posición de la línea de cota
function dsCotaNueva(q) {
  if (PLH.pts.length < 2) return null;
  const [a, b] = PLH.pts,
    el = { a, b, modo: PLH.h === "cotL" ? dsModoLineal(a, b, q) : "alin", o: 0 };
  el.o = dsCotaO(el, q);
  return el;
}

/* ---------- Herramientas: colocar símbolos y dibujar ---------- */
const dsEsHerr = h =>
  !!h && (h.startsWith("col:") || !!DS_HERR[h] || ["fila", "espejo", "blq", "rep", "rmur"].includes(h));
function dsOrden(h, n) {
  const libre = ` · <span class="pl-k">Mayús</span> sin enganche`;
  if (h === "fila")
    return `<b>Copiar en fila</b> (${PLH.copia ? PLH.copia.n : 0} copias) · ${n ? "Punto de la primera copia: la separación (escriba la distancia o haga clic)" : "Punto base"}${libre} · <span class="pl-k">Esc</span> salir`;
  if (h === "rep" || h === "rmur") return dpOrdenRep(h, n);
  if (h === "blq")
    return `<b>Bloque «${esc(PLH.blq ? PLH.blq.n : "")}»</b> · clic para colocarlo (su centro va en el cursor) · puede colocar varios${libre} · <span class="pl-k">Esc</span> terminar`;
  if (h === "espejo")
    return `<b>Espejo</b> · ${n ? "Segundo punto de la línea de reflexión" : "Primer punto de la línea de reflexión"}${libre} · <span class="pl-k">Esc</span> salir`;
  if (h.startsWith("col:")) {
    const c = DS_CAT[h.slice(4)];
    return `<b>${c.n}</b> <span class="pl-cod">DGE ${c.c}</span> · clic para colocar${c.m && DSU.alinear ? " (se encaja en el muro)" : ""} · <span class="pl-k">R</span> girar${libre} · <span class="pl-k">Esc</span> terminar`;
  }
  const sig = "Siguiente punto · escriba una longitud o haga clic · <b>Intro</b> o doble clic para terminar";
  const T = {
    lin: n ? "Punto final · escriba la longitud o haga clic" : "Primer punto",
    pol: n ? sig : "Primer punto",
    rect: n ? "Esquina opuesta" : "Una esquina",
    cir: n ? "Un punto del borde (radio)" : "Centro",
    txt: "Dónde va el texto",
    tubT: n
      ? `${sig} · <span class="pl-k">F</span> invierte la curva · <span class="pl-k">C</span> ${DSU.curva ? "tramo recto" : "tramo curvo"}`
      : "Inicio de la tubería (por ejemplo, el tablero)",
    tubP: n
      ? `${sig} · <span class="pl-k">F</span> invierte la curva · <span class="pl-k">C</span> ${DSU.curva ? "tramo recto" : "tramo curvo"}`
      : "Inicio de la tubería (por ejemplo, el tablero)",
    cotA: n === 0 ? "Primer punto que se mide" : n === 1 ? "Segundo punto" : "Posición de la línea de cota",
    cotL:
      n === 0
        ? "Primer punto que se mide"
        : n === 1
          ? "Segundo punto"
          : "Posición de la línea de cota (arriba o abajo: horizontal; a un lado: vertical)",
    dir: n ? "Dónde va el texto" : "Punta de la flecha",
    ley: "Esquina superior izquierda de la leyenda",
    cua: "Esquina superior izquierda del cuadro de circuitos"
  };
  return `<b>${DS_HERR[h]}</b> · ${T[h]}${libre} · <span class="pl-k">Esc</span> salir`;
}
function dsAgregar(el) {
  el.id = dsId();
  dsD().els.push(el);
  return el;
}
function dsPunto(p) {
  const h = PLH.h;
  if (h === "fila" || h === "espejo") return dsPuntoCopia(p);
  if (h === "blq") return dpColocarBloque(p);
  if (h === "rep" || h === "rmur") return dpPuntoRep(p);
  if (h === "ley" || h === "cua") {
    if (h === "cua" && !dsD().els.some(e => e.k === "tab" && e.nc)) {
      plHerr(null);
      return toast("Primero coloque un tablero y defina sus circuitos (doble clic en el tablero)");
    }
    dsCapa(DS_SIS.txt.capa);
    DS_SEL.clear();
    DS_SEL.add(
      dsAgregar({ t: h, x: p[0], y: p[1], tit: h === "ley" ? "LEYENDA" : "CUADRO DE CIRCUITOS", capa: DS_SIS.txt.capa })
        .id
    );
    edCambio();
    return plHerr(null);
  }
  if (h.startsWith("col:")) {
    const k = h.slice(4),
      c = DS_CAT[k],
      al = PLH.alin;
    dsCapa(DS_SIS[c.s].capa);
    const el = dsAgregar({
      t: "sim",
      k,
      x: al ? al.x : p[0],
      y: al ? al.y : p[1],
      r: al ? al.r : PLH.rot,
      capa: DS_SIS[c.s].capa
    });
    if (k === "tab") {
      // TG el primero; TD-1, TD-2… los siguientes
      const n = dsD().els.filter(e => e.k === "tab").length;
      el.nom = n === 1 ? "TG" : "TD-" + (n - 1);
      toast(`Tablero ${el.nom}: doble clic en él para darle sus circuitos (C-1, C-2…)`);
    }
    DS_SEL.clear();
    DS_SEL.add(el.id);
    edCambio();
    return;
  }
  if (h === "txt") {
    PLH.pts = [p];
    plPedir("Texto", "", v => {
      if (!v) return toast("Escriba el texto");
      dsCapa(DS_SIS.txt.capa);
      dsAgregar({
        t: "txt",
        x: p[0],
        y: p[1],
        s: v.replace(/[<>]/g, "").slice(0, 200),
        ht: dsMm(2.5),
        r: 0,
        capa: DS_SIS.txt.capa
      });
      PLH.pts = [];
      plPedir(null);
      edCambio();
      plOrden();
    });
    return;
  }
  if (dsEsTub(h)) return dsPuntoTub(p);
  if (h === "areaC" || h === "areaE") return dpAreaClic(p, h === "areaE");
  PLH.pts.push(p);
  const n = PLH.pts.length,
    capa = dsCapaPara(h);
  if (dsEsTub(h) && n > 1) (PLH.bul = PLH.bul || []).push(dsBulNuevo());
  if (dsEsTub(h) && PLH.eng && PLH.eng[2] === 8 && (n === 1 || !PLH.cirIni)) {
    PLH.cirIni = PLH.eng[3];
    toast(`Tubería del circuito ${PLH.cirIni.cir}${PLH.cirIni.nom ? " del tablero " + PLH.cirIni.nom : ""}`);
  }
  if ((h === "lin" || h === "rect" || h === "cir" || h === "areaR") && n === 2) {
    const [a, b] = PLH.pts;
    PLH.pts = [];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) * PLV.s < 2) return plOrden();
    dsCapa(capa);
    if (h === "lin") dsAgregar({ t: "lin", pts: [a[0], a[1], b[0], b[1]], c: false, capa });
    else if (h === "rect")
      dsAgregar({ t: "lin", pts: [a[0], a[1], b[0], a[1], b[0], b[1], a[0], b[1]], c: true, capa });
    else if (h === "areaR")
      return dpAreaNueva(
        dsAgregar({
          t: "lin",
          pts: [a[0], a[1], b[0], a[1], b[0], b[1], a[0], b[1]],
          c: true,
          capa,
          ar: { tp: dpAreaTipo(false) }
        })
      );
    else dsAgregar({ t: "cir", x: a[0], y: a[1], rad: Math.hypot(b[0] - a[0], b[1] - a[1]), capa });
    edCambio();
  } else if ((h === "cotA" || h === "cotL") && n === 3) {
    const el = dsCotaNueva(p);
    PLH.pts = [];
    if (el.a[0] === el.b[0] && el.a[1] === el.b[1]) return plOrden();
    dsCapa(capa);
    dsAgregar({ t: "cot", ...el, capa });
    edCambio();
  } else if (h === "dir" && n === 2) {
    const [a, b] = PLH.pts;
    plPedir("Texto de la directriz", "", v => {
      if (!v) return toast("Escriba el texto");
      dsCapa(capa);
      dsAgregar({
        t: "dir",
        pts: [a[0], a[1], b[0], b[1]],
        s: v.replace(/[<>]/g, "").slice(0, 120),
        ht: dsMm(2.5),
        capa
      });
      PLH.pts = [];
      plPedir(null);
      edCambio();
      plOrden();
    });
    return;
  }
  plOrden();
  plSobreDibujar();
}
// Punto de una tubería: si empieza en un artefacto queda conectada a él; si llega a otro, esa tubería termina en
// su borde y empieza otra desde él (con el mismo circuito), como se cablea de una salida a la siguiente
function dsPuntoTub(p, engX) {
  const eng = engX || PLH.eng;
  // Clic sobre el tablero: se elige la salida en un menú y la tubería empieza o termina en ella
  if (eng && eng[2] === 10) {
    const tb = dsD().els.find(e => e.id === eng[3].tabla);
    if (tb && PLH.ali && PLH.pts.length) return dsPuntoAli(tb, p);
    return (
      tb &&
      dsElegirSalida(
        tb,
        p,
        o => {
          if (o.dest) return dsAliDirecto(tb, o.dest);
          if (o.ali) return dsPuntoAli(tb, p);
          dsPuntoTub(o.p, [o.p[0], o.p[1], 8, { cir: o.n, tab: tb.id, nom: tb.nom || "" }]);
          plSobreDibujar();
        },
        true
      )
    );
  }
  const con = eng && eng[2] === 9 ? eng[3].con : null,
    D = dsD();
  if (!PLH.pts.length) {
    PLH.pts.push(p);
    PLH.conIni = con;
    if (eng && eng[2] === 8) {
      PLH.cirIni = eng[3];
      PLH.conIni = eng[3].tab;
    } else if (con) {
      // Empieza en un artefacto que ya tiene circuito: la tubería lo toma
      const s = D.els.find(e => e.id === con),
        tb = s && s.tab && D.els.find(e => e.id === s.tab);
      if (s && s.cir) PLH.cirIni = { cir: s.cir, tab: s.tab || "", nom: tb ? tb.nom || "" : "" };
    }
    if (PLH.cirIni)
      toast(`Tubería del circuito ${PLH.cirIni.cir}${PLH.cirIni.nom ? " del tablero " + PLH.cirIni.nom : ""}`);
    plOrden();
    return plSobreDibujar();
  }
  // Un clic en el mismo artefacto del inicio no hace un tramo
  if (con && con === PLH.conIni && PLH.pts.length === 1) return;
  // El inicio en un artefacto (o el alimentador en un tablero): a su borde, hacia este punto
  if (PLH.pts.length === 1 && PLH.conIni) {
    const s = D.els.find(e => e.id === PLH.conIni);
    if (s && (s.k !== "tab" || PLH.ali)) PLH.pts[0] = dsBorde(s, p[0], p[1]);
  }
  PLH.pts.push(p);
  (PLH.bul = PLH.bul || []).push(dsBulNuevo());
  // Llega a una salida del tablero: la tubería termina allí y queda saliendo del tablero (se invierte)
  if (eng && eng[2] === 8 && PLH.conIni !== eng[3].tab) {
    PLH.cirIni = eng[3];
    const t = dsTerminar(null, eng[3].tab);
    if (t) toast(`Tubería conectada a la salida ${t.cir}${eng[3].nom ? " del tablero " + eng[3].nom : ""}`);
    return plOrden();
  }
  if (con) {
    const t = dsTerminar(con),
      s = D.els.find(e => e.id === con);
    if (t && s) {
      // Sigue desde el artefacto, con el mismo circuito (o como alimentador)
      PLH.pts = [dsCentroCon(s)];
      PLH.conIni = con;
      PLH.cirIni = t.cir ? { cir: t.cir, tab: t.tab || "", nom: "" } : null;
      PLH.ali = !!t.ali;
      toast(`Conectada a ${DS_CAT[s.k].n.toLowerCase()} · siga a la próxima salida o Esc para terminar`);
    }
  }
  plOrden();
  plSobreDibujar();
}
/* Tubería de alimentador en un tablero (del medidor al TG, o del TG a un montante o a otro tablero): empieza en el
   borde del tablero o termina en él, sin circuito */
function dsPuntoAli(tb, p) {
  if (!PLH.pts.length) {
    PLH.pts.push([tb.x, tb.y]);
    PLH.conIni = tb.id;
    PLH.cirIni = null;
    PLH.ali = true;
    toast(
      `Alimentador desde ${tb.nom || "el tablero"}: haga clic en cada punto hasta el medidor, el montante o el otro tablero`
    );
    plOrden();
    return plSobreDibujar();
  }
  if (PLH.conIni === tb.id) return;
  const u = PLH.pts[PLH.pts.length - 1];
  PLH.pts.push(dsBorde(tb, u[0], u[1]));
  (PLH.bul = PLH.bul || []).push(dsBulNuevo());
  PLH.cirIni = null;
  PLH.ali = true;
  dsTerminar(tb.id);
  toast(`Alimentador conectado a ${tb.nom || "el tablero"}`);
  plSobreDibujar();
}
// Menú con las salidas del tablero, junto al punto p (cada una con su descripción y si ya tiene tubería); conAli:
// también la opción de un alimentador
function dsElegirSalida(tb, p, fn, conAli) {
  const S = dsSalidasTab(tb);
  if (!S.length && !conAli) {
    toast(`${tb.nom || "El tablero"} aún no tiene circuitos: defínalos en su ventana`);
    return tabAbrir(tb.id);
  }
  const usada = new Set(
    dsD()
      .els.filter(e => e.t === "tub" && e.c0 === tb.id)
      .map(e => e.cir)
  );
  /* Alimentadores directos: al banco de medidores, a un medidor o a otro tablero del plano (los que aún no tienen un
     alimentador desde este tablero); al elegir uno, la tubería se dibuja sola, conectada a los dos */
  const conAliYa = new Set(
      dsD()
        .els.filter(e => e.t === "tub" && e.ali && (e.c0 === tb.id || e.c1 === tb.id))
        .map(e => (e.c0 === tb.id ? e.c1 : e.c0))
    ),
    dest = conAli
      ? dsD().els.filter(
          e =>
            e.t === "sim" &&
            dsVis(e) &&
            e.id !== tb.id &&
            !conAliYa.has(e.id) &&
            (e.k === "bmed" || PL_MED.has(e.k) || e.k === "tab")
        )
      : [],
    nomDest = e => (e.k === "bmed" ? "Banco de medidores" : e.k === "tab" ? e.nom || "Tablero" : DS_CAT[e.k].n);
  // Primero el banco, luego los medidores y los tableros
  dest.sort((a, b) => (a.k === "bmed" ? 0 : a.k === "tab" ? 2 : 1) - (b.k === "bmed" ? 0 : b.k === "tab" ? 2 : 1));
  edMenuLista(
    p,
    `<div class="ed-mt">Salidas de ${esc(tb.nom || "tablero")}</div>` +
      S.map(
        o =>
          `<button type="button" data-edm="sal:${o.i}" role="menuitem"><span><b style="color:${plColorDis(dsColCir(o.n, tb.id))}">${o.n}</b>${o.d ? " · " + esc(o.d) : ""}</span>${usada.has(o.n) ? "<kbd>en uso</kbd>" : ""}</button>`
      ).join("") +
      (conAli
        ? `${S.length ? "<hr>" : ""}${dest
            .slice(0, 12)
            .map(
              (e, j) =>
                `<button type="button" data-edm="sal:${-100 - j}" role="menuitem" title="Dibuja el alimentador conectado a los dos; luego puede mover sus vértices"><span>Alimentador → <b>${esc(nomDest(e))}</b></span></button>`
            )
            .join(
              ""
            )}<button type="button" data-edm="sal:-1" role="menuitem" title="Tubería del alimentador punto por punto: del medidor al tablero, o del tablero general a un montante, al banco o a otro tablero"><span>Alimentador punto por punto…</span></button>`
        : "") +
      `<hr><button type="button" data-edm="tablero:${tb.id}" role="menuitem"><span>${tb.gen ? "Tablero general…" : "Circuitos del tablero…"}</span></button>`,
    i => fn(i <= -100 ? { ali: true, dest: dest[-100 - i] } : i < 0 ? { ali: true } : S[i])
  );
}
/* Alimentador directo del tablero tb al artefacto o tablero d: una tubería recta de borde a borde (en ángulo recto si
   no están alineados), conectada a los dos; por el piso con la herramienta del piso, si no por el techo */
function dsAliDirecto(tb, d) {
  const a = dsBorde(tb, d.x, d.y),
    b = dsBorde(d, tb.x, tb.y),
    recto = Math.abs(a[0] - b[0]) < 1e-9 || Math.abs(a[1] - b[1]) < 1e-9,
    pts = recto ? [...a, ...b] : [...a, b[0], a[1], ...b],
    piso = PLH.h === "tubP",
    capa = piso ? DS_SIS.tubP.capa : DS_SIS.tubT.capa;
  dsCapa(capa);
  const el = dsAgregar({
    t: "tub",
    pts,
    c: false,
    capa,
    modo: piso ? "piso" : "techo",
    ali: true,
    c0: tb.id,
    c1: d.id
  });
  PLH.pts = [];
  PLH.bul = [];
  PLH.cirIni = PLH.conIni = null;
  PLH.ali = false;
  edCambio();
  plSobreDibujar();
  toast(
    `Alimentador ${tb.nom || "del tablero"} → ${d.k === "bmed" ? "banco de medidores" : d.nom || DS_CAT[d.k].n} (${plFm(dsLargo(el))} m): mueva sus vértices para ajustar el recorrido`
  );
  return el;
}
