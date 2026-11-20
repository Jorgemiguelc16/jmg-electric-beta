/* DISEÑO AVANZADO · ACTUALIZAR ARQUITECTURA Y VER ELEMENTOS
   Comparar una versión nueva del plano del arquitecto sin perder el diseño, y elegir y mostrar elementos.
   Antes era parte de js/diseno-avanzado.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Actualizar arquitectura ----------
   Cuando el arquitecto entrega una versión nueva: se compara con la anterior línea por línea (lo quitado en rojo y
   lo agregado en verde sobre el plano), se detecta si el dibujo se movió (y se mueve el diseño con él), se vuelven
   a medir las áreas marcadas con un clic y se listan los elementos del diseño que quedaron cerca de un cambio o que
   cruzan un muro nuevo. La arquitectura no se edita: el diseño se adapta a ella. */
let PL_CMP = null;
// Clave de una línea de la arquitectura: su capa y sus puntos redondeados a 5 mm (con un desplazamiento)
function dpClaveTr(t, dx, dy, q) {
  let s = t.capa + "|" + t.k + "|";
  for (let j = 0; j < t.p.length; j += 2)
    s += Math.round((t.p[j] + dx) / q) + "," + Math.round((t.p[j + 1] + dy) / q) + ";";
  return s;
}
// Rectángulo de las capas de muros de un modelo (para saber si el dibujo se movió)
function dpCajaMuros(m) {
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity,
    n = 0;
  m.trazos.forEach(t => {
    if (!DP_MURO.test(t.capa) || DP_NO_MURO.test(t.capa)) return;
    const [x0, y0, x1, y1] = dpCaja(t);
    a = Math.min(a, x0);
    b = Math.min(b, y0);
    c = Math.max(c, x1);
    d = Math.max(d, y1);
    n++;
  });
  return n ? [a, b, c, d] : null;
}
function dpCompararArq(ant, nue, antE) {
  const f = EPL.f,
    q = 0.005 / f;
  // ¿Se movió el dibujo? Las capas de muros miden lo mismo pero están en otro lugar
  let dx = 0,
    dy = 0;
  const A = dpCajaMuros(ant),
    B = dpCajaMuros(nue);
  if (A && B) {
    const w0 = A[2] - A[0],
      h0 = A[3] - A[1],
      ddx = B[0] - A[0],
      ddy = B[1] - A[1];
    if (
      Math.abs(B[2] - B[0] - w0) < 0.005 * w0 + q &&
      Math.abs(B[3] - B[1] - h0) < 0.005 * h0 + q &&
      Math.hypot(ddx, ddy) * f > 0.05
    ) {
      // Se confirma si, desplazadas, coinciden más líneas que sin desplazar
      const cuenta = (ex, ey) => {
        const s = new Set(nue.trazos.map(t => dpClaveTr(t, 0, 0, q)));
        return ant.trazos.reduce((k, t) => k + (s.has(dpClaveTr(t, ex, ey, q)) ? 1 : 0), 0);
      };
      if (cuenta(ddx, ddy) > cuenta(0, 0)) {
        dx = ddx;
        dy = ddy;
      }
    }
  }
  if (dx || dy) {
    dsD().els.forEach(el => dsTrasladar(el, dx, dy));
    EPL.plantas.forEach(p => {
      p.x0 += dx;
      p.x1 += dx;
      p.y0 += dy;
      p.y1 += dy;
      // El punto base va con su planta
      if (dpTieneBase(p)) {
        p.bx += dx;
        p.by += dy;
      }
    });
  }
  // Líneas quitadas y agregadas (comparadas con el desplazamiento)
  const cN = new Map(),
    cA = new Map();
  nue.trazos.forEach(t => {
    const k = dpClaveTr(t, 0, 0, q);
    cN.set(k, (cN.get(k) || 0) + 1);
  });
  const quit = [];
  ant.trazos.forEach(t => {
    const k = dpClaveTr(t, dx, dy, q);
    cA.set(k, (cA.get(k) || 0) + 1);
    if (!cN.get(k)) quit.push({ capa: t.capa, p: t.p.map((v, i) => v + (i % 2 ? dy : dx)), c: t.c });
    else cN.set(k, cN.get(k) - 1);
  });
  const vistos = new Map();
  ant.trazos.forEach(t => {
    const k = dpClaveTr(t, dx, dy, q);
    vistos.set(k, (vistos.get(k) || 0) + 1);
  });
  const agr = nue.trazos.filter(t => {
    const k = dpClaveTr(t, 0, 0, q),
      v = vistos.get(k) || 0;
    if (v > 0) {
      vistos.set(k, v - 1);
      return false;
    }
    return true;
  });
  // Elementos del diseño cerca de un cambio de los muros (30 cm) o tuberías que cruzan un muro nuevo
  const mur = dpCapasMuro(),
    esMuro = t => (mur ? mur.has(t.capa) : !DP_NO_MURO.test(t.capa)) && !t.lt,
    cambios = [...quit.filter(esMuro), ...agr.filter(esMuro)],
    cerca = 0.3 / f,
    segs = cambios.flatMap(t => {
      const s = [];
      for (let j = 0; j + 3 < t.p.length; j += 2) s.push([t.p[j], t.p[j + 1], t.p[j + 2], t.p[j + 3]]);
      if (t.c && t.p.length > 4) s.push([t.p[t.p.length - 2], t.p[t.p.length - 1], t.p[0], t.p[1]]);
      return s;
    }),
    dSeg = (x, y, [a, b, c, d]) => {
      const L = (c - a) ** 2 + (d - b) ** 2,
        u = L ? Math.max(0, Math.min(1, ((x - a) * (c - a) + (y - b) * (d - b)) / L)) : 0;
      return Math.hypot(x - a - u * (c - a), y - b - u * (d - b));
    },
    cruza = ([a, b, c, d], [e, g, h, k]) => {
      const o = (p, q2, r) => Math.sign((q2[0] - p[0]) * (r[1] - p[1]) - (q2[1] - p[1]) * (r[0] - p[0]));
      return (
        o([a, b], [c, d], [e, g]) * o([a, b], [c, d], [h, k]) < 0 &&
        o([e, g], [h, k], [a, b]) * o([e, g], [h, k], [c, d]) < 0
      );
    },
    nuevos = agr.filter(esMuro).flatMap(t => {
      const s = [];
      for (let j = 0; j + 3 < t.p.length; j += 2) s.push([t.p[j], t.p[j + 1], t.p[j + 2], t.p[j + 3]]);
      return s;
    }),
    afect = [];
  dsD().els.forEach(el => {
    if (el.t === "sim") {
      if (segs.some(s => dSeg(el.x, el.y, s) < cerca))
        afect.push({ id: el.id, m: `${DS_CAT[el.k] ? DS_CAT[el.k].n : "Artefacto"} junto a un muro que cambió` });
    } else if (el.t === "tub") {
      const P = dsCurva(el);
      for (let j = 0; j + 3 < P.length; j += 2)
        if (nuevos.some(s => cruza([P[j], P[j + 1], P[j + 2], P[j + 3]], s))) {
          afect.push({ id: el.id, m: `Tubería${el.cir ? " de " + el.cir : ""} que cruza un muro nuevo` });
          break;
        }
    }
  });
  // Áreas: las detectadas con un clic se vuelven a medir; las demás, si un cambio las toca, se avisan
  const areas = [];
  dsD().els.forEach(el => {
    if (!el.ar) return;
    const b = dsBBox(el),
      toca = segs.some(
        ([a, c, e, g]) =>
          Math.max(a, e) >= b[0] - cerca &&
          Math.min(a, e) <= b[2] + cerca &&
          Math.max(c, g) >= b[1] - cerca &&
          Math.min(c, g) <= b[3] + cerca
      );
    if (!toca) return;
    const m0 = dsM2(el);
    if (el.ar.p) {
      // Zona: el área anterior con 3 m de margen (cuadrícula fina, como al marcarla)
      const z = 3 / f,
        r = dpAreaDetectar(el.ar.p, el.ar.tp === "ext", [b[0] - z, b[1] - z, b[2] + z, b[3] + z]);
      if (!r.err && plAreaPol(r.pts) * f * f >= 0.5) {
        el.pts = r.pts;
        delete el.b;
        const m1 = dsM2(el);
        areas.push({ id: el.id, n: el.ar.n || "Área", m0, m1, ok: true });
        return;
      }
      return areas.push({
        id: el.id,
        n: el.ar.n || "Área",
        m0,
        m1: null,
        ok: false,
        m: r.err || "contorno muy pequeño"
      });
    }
    areas.push({ id: el.id, n: el.ar.n || "Área", m0, m1: null, ok: false, m: "dibujada a mano: revise su contorno" });
  });
  PL_CMP = {
    quit,
    agr,
    dx: dx * f,
    dy: dy * f,
    afect,
    areas,
    ver: true,
    ant: antE ? antE.nombre : "",
    nue: EPL.nombre
  };
  dsIdxSucio();
  edCambio();
  plDibujar();
  dpCambiosAbrir();
}
// Dibujo de los cambios sobre el plano (capa superior)
function dpDibCambios(g, d) {
  if (!PL_CMP || !PL_CMP.ver) return;
  const dib = (L, col) => {
    g.strokeStyle = col;
    g.lineWidth = 2 * d;
    g.beginPath();
    L.forEach(t => {
      const [a, b] = plAPant(t.p[0], t.p[1]);
      g.moveTo(a, b);
      for (let j = 2; j < t.p.length; j += 2) {
        const [x, y] = plAPant(t.p[j], t.p[j + 1]);
        g.lineTo(x, y);
      }
      if (t.c) g.closePath();
    });
    g.stroke();
  };
  g.save();
  g.globalAlpha = 0.85;
  dib(PL_CMP.quit, "#d32f2f");
  dib(PL_CMP.agr, "#2e7d32");
  g.restore();
}
const CM_VW = ventanaMovil(document.querySelector("#cmpDlg .vw"), "jmg-electric-cambios-arq", {
  w: 640,
  h: 520,
  minW: 420,
  minH: 300
});
function dpCambiosAbrir() {
  if (!PL_CMP) return toast("Use «Actualizar arquitectura» para abrir la versión nueva del plano y compararla");
  const C = PL_CMP,
    ver = (ids, t = "Ver") => `<button type="button" class="vw-btn" data-cmv="${ids.join(",")}">${t}</button>`,
    v = EPL.arqV || [];
  let h = `<p class="dc-nota">De <b>${esc(C.ant)}</b> a <b>${esc(C.nue)}</b>: ${C.quit.length} línea${C.quit.length === 1 ? "" : "s"} quitada${C.quit.length === 1 ? "" : "s"} (en rojo) y ${C.agr.length} agregada${C.agr.length === 1 ? "" : "s"} (en verde).${C.dx || C.dy ? ` El dibujo nuevo está movido ${fmt(C.dx, 2)} m en X y ${fmt(C.dy, 2)} m en Y: el diseño y las plantas se movieron con él.` : ""} El diseño eléctrico se conservó.</p>`;
  h +=
    `<h4>Áreas<small>las marcadas con un clic se vuelven a medir</small></h4>` +
    (C.areas.length
      ? `<table class="dc-t"><tbody>${C.areas
          .map(
            a =>
              `<tr><td>${esc(a.n)}</td><td class="n">${fmt(a.m0, 2)} m²</td><td class="n ${a.ok ? "ok" : "bad"}">${a.ok ? `${fmt(a.m1, 2)} m²` : esc(a.m)}</td><td>${ver([a.id])}</td></tr>`
          )
          .join("")}</tbody></table>`
      : '<p class="dc-nota">Ningún área quedó cerca de un cambio.</p>');
  h +=
    `<h4>Diseño cerca de un cambio<small>${C.afect.length}</small>${
      C.afect.length
        ? " " +
          ver(
            C.afect.map(a => a.id),
            "Ver todos"
          )
        : ""
    }</h4>` +
    (C.afect.length
      ? C.afect
          .map(
            (a, i) =>
              `<div class="rev-it aviso"><i>⚠</i><span>${esc(a.m)}</span><span class="pla-b"><button type="button" class="vw-btn" data-cmi="${i}">Ver</button></span></div>`
          )
          .join("")
      : '<p class="dc-nota">Ningún artefacto ni tubería quedó junto a un muro que cambió.</p>');
  if (v.length > 1)
    h += `<h4>Versiones de la arquitectura</h4><ol class="dc-nota">${v.map(x => `<li>${esc(x.n)}${x.f ? ` · ${esc(x.f)}` : ""}</li>`).join("")}</ol>`;
  $("cmC").innerHTML = h;
  $("cmVer").checked = C.ver;
  $("cmpDlg").hidden = false;
  vwFondo();
  CM_VW.abrir();
}
function dpCambiosCerrar() {
  $("cmpDlg").hidden = true;
  vwFondo();
}
$("cmpDlg").addEventListener("click", e => {
  if (e.target.id === "cmpDlg") return dpCambiosCerrar();
  const b = e.target.closest("[data-cm]"),
    v = e.target.closest("[data-cmv]"),
    i = e.target.closest("[data-cmi]");
  if (b && b.dataset.cm === "cerrar") return dpCambiosCerrar();
  if (b && b.dataset.cm === "max") return CM_VW.maximizar();
  if (v || i) {
    dpCambiosCerrar();
    dsVerIds(v ? v.dataset.cmv.split(",") : [PL_CMP.afect[+i.dataset.cmi].id]);
  }
});
$("cmpDlg").addEventListener("change", e => {
  if (e.target.id !== "cmVer" || !PL_CMP) return;
  PL_CMP.ver = e.target.checked;
  plSobreDibujar();
});
$("cmpDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    dpCambiosCerrar();
  }
  e.stopPropagation();
});

/* ---------- Ver elementos: los elige y los muestra en pantalla ---------- */
function dsVerIds(ids) {
  DS_SEL.clear();
  PL_ASEL.clear();
  const D = dsD();
  if (!D) return;
  const has = new Set(ids);
  D.els.forEach(e => has.has(e.id) && DS_SEL.add(e.id));
  const bb = dsSel().map(dsBBox);
  if (bb.length) {
    const x0 = Math.min(...bb.map(q => q[0])),
      y0 = Math.min(...bb.map(q => q[1])),
      x1 = Math.max(...bb.map(q => q[2])),
      y1 = Math.max(...bb.map(q => q[3])),
      m = Math.max(x1 - x0, y1 - y0, 2 / EPL.f) * 0.35;
    plVer(x0 - m, y0 - m, x1 + m, y1 + m);
  }
  edProps();
  plSobreDibujar();
}
// Desde el cálculo: abre el editor (si hace falta, con el plano) y muestra los elementos; o la ventana «Datos
// para el cálculo» (fn)
function edVerEnPlano(ids, fn) {
  if (!PLANO) return toast("El proyecto aún no tiene plano: ábralo en Planos › Editor de diseño");
  if (!ED.abierto) edAbrir();
  let n = 0;
  const ir = () => {
    if (PL_MOD && EPL && dsD()) return fn ? fn() : dsVerIds(ids);
    if (++n < 80) setTimeout(ir, 100);
  };
  setTimeout(ir, 60);
}
