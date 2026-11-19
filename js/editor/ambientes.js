/* DISEÑO AVANZADO · AMBIENTES Y VERIFICACIÓN NORMATIVA
   El área de cada ambiente con su tipo y la verificación de las reglas de seguridad del CNE-Utilización por
   ambiente.
   Antes era parte de js/diseno-avanzado.js (hasta la v3.2); se dividió por tema sin cambiar el código. Los archivos del editor comparten variables y se
   cargan en orden desde index.html (ver GUIA-DEL-CODIGO.md). */
/* ---------- Ambientes: el área de cada ambiente con su tipo (dormitorio, cocina, baño…) ----------
   El tipo se reconoce por el nombre que el arquitecto escribió en el plano (PL_AMB, js/calculo/calculo-plano.js) y el
   proyectista lo confirma o lo cambia en la ventana «Ambientes». Cada tipo muestra la iluminancia mínima de la
   EM.010 y lo que exige el CNE-Utilización para ese ambiente. */
const dpOrdAmb = k => {
  const i = Object.keys(PL_AMB).indexOf(k);
  return i < 0 ? 99 : i;
};
// Textos visibles del plano, cada uno con su centro aproximado (según su alineación) y su punto de inserción
function dpTextosPlano() {
  if (!PL_MOD) return [];
  const oc = new Set(EPL.ocultas || []),
    R = [];
  PL_MOD.textos.forEach(t => {
    if (oc.has(t.capa) || PL_BORR.has(t.e)) return;
    const lin = String(t.s || "")
      .split(/\n/)
      .map(x => x.trim())
      .filter(Boolean);
    if (!lin.length) return;
    const h = t.h || 0,
      W = Math.max(...lin.map(x => x.length)) * h * 0.6 * (t.w || 1),
      Hh = t.mt ? lin.length * h * 1.6 : h,
      dx = t.ha === "left" ? W / 2 : t.ha === "right" ? -W / 2 : 0,
      dy = t.va === "top" ? -Hh / 2 : t.va === "middle" ? 0 : Hh / 2,
      c = Math.cos(t.rot || 0),
      s = Math.sin(t.rot || 0);
    R.push({ t, lin, h, c: [t.x + dx * c - dy * s, t.y + dx * s + dy * c], ins: [t.x, t.y] });
  });
  return R;
}
/* Nombres de ambientes escritos en el plano: textos cuya línea empieza con «SALA», «DORMITORIO», «SS.HH.»… Un
   nombre escrito en dos textos («PATIO DE» y debajo «SERVICIO»; «HALL» y «RECEPCION») se junta: el texto de debajo,
   de la misma altura y giro, a menos de 2.6 alturas y alineado, es su segunda línea (o.sig). */
function dpRotulos(T) {
  const R = [],
    L = T || dpTextosPlano();
  L.forEach(o => {
    const sig = L.find(
      u =>
        u !== o &&
        u.t.capa === o.t.capa &&
        Math.abs(u.h - o.h) <= 0.15 * o.h &&
        Math.abs((u.t.rot || 0) - (o.t.rot || 0)) < 0.02 &&
        (() => {
          const dx = u.c[0] - o.c[0],
            dy = u.c[1] - o.c[1],
            c = Math.cos(o.t.rot || 0),
            s = Math.sin(o.t.rot || 0),
            a = dx * c + dy * s,
            b = -dx * s + dy * c;
          return b < -0.5 * o.h && b > -2.6 * o.h && Math.abs(a) < 4 * o.h;
        })()
    );
    if (sig && !plAmbDe(sig.lin[0])) {
      o = { ...o, lin: [o.lin.join(" ") + " " + sig.lin.join(" ")], sig: sig.t };
    }
    const tipos = o.lin.map(x => [plAmbDe(x), x]).filter(([k]) => k);
    if (!tipos.length) return;
    tipos.sort((a, b) => dpOrdAmb(a[0]) - dpOrdAmb(b[0]));
    R.push({
      ...o,
      amb: tipos[0][0],
      n: tipos
        .map(x => x[1])
        .join(" - ")
        .replace(/[<>]/g, "")
        .slice(0, 60)
    });
  });
  return R;
}
// Nombre escrito dentro de un contorno (el de mayor prioridad), para proponerlo al marcar un área con un clic
function dpRotuloEn(pts) {
  const r = dpRotulos().filter(q => plDentro(q.c[0], q.c[1], pts));
  r.sort((a, b) => dpOrdAmb(a.amb) - dpOrdAmb(b.amb));
  return r[0] || null;
}
// Tipo de cálculo de un ambiente nuevo: patios y terrazas son área libre no techada; los demás, techada
const dpTpAmb = k => (k === "patio" || k === "terr" ? "libre" : "tech");
/* Detecta los ambientes de una planta (ip) o de todas (ip < 0): un área por cada nombre escrito en el plano. El
   nombre que cae dentro de un área ya marcada le da su tipo (si no lo tenía); dos nombres en un mismo ambiente se
   juntan («Cocina - Comedor») y queda el tipo de mayor prioridad. Si el contorno abarca el nombre de otro ambiente
   (aunque no sea de vivienda, como «PISTA DE BAILE»: un texto de tamaño parecido), se escapó por un vano ancho y se
   vuelve a detectar cerrando vanos mayores; si no se separa, no se crea y queda en la lista para marcarlo a mano.
   avance(i, n): para mostrar el progreso. Devuelve el resumen. */
async function dpAmbDetectar(ip, avance) {
  const D = dsD(),
    capa = DS_SIS.are.capa,
    nuevas = new Set(),
    tocadas = new Map(),
    sin = [],
    caches = new Map(),
    pl = EPL.plantas,
    T = dpTextosPlano(),
    rot = dpRotulos(T).sort((a, b) => dpOrdAmb(a.amb) - dpOrdAmb(b.amb)),
    // Textos que pueden ser el nombre de otro ambiente: con letras, sin cotas ni niveles (NPT, +0.15)
    otros = T.filter(o => /[a-zñ]{4}/i.test(o.lin.join(" ")) && !/^(?:n\.?\s?p\.?\s?t|[+±-]?\s?\d)/i.test(o.lin[0])),
    // Texto → su nombre de ambiente (también la segunda línea de un nombre en dos textos)
    esRot = new Map();
  rot.forEach(q => {
    esRot.set(q.t, q);
    if (q.sig) esRot.set(q.sig, q);
  });
  let fuera = 0,
    asig = 0;
  // Sin plantas encuadradas: solo lo visible en pantalla (el DXF suele tener cortes y copias con los mismos nombres)
  const [vx0, vy0] = plADib(0, plH()),
    [vx1, vy1] = plADib(plW(), 0),
    areas = () => D.els.filter(e => e.t === "lin" && e.ar && e.ar.tp !== "ext" && e.pts.length >= 6),
    h0 = DP_HUECO;
  for (let i = 0; i < rot.length; i++) {
    const q = rot[i];
    if (avance && i % 4 === 0) {
      avance(i, rot.length);
      await new Promise(r => setTimeout(r, 0));
    }
    const jp = dpPlantaDe(q.c[0], q.c[1]);
    if (pl.length ? jp < 0 : q.c[0] < vx0 || q.c[0] > vx1 || q.c[1] < vy0 || q.c[1] > vy1) {
      fuera++;
      continue;
    }
    if (ip >= 0 && jp !== ip) continue;
    const ya = areas().find(a => plDentro(q.c[0], q.c[1], a.pts));
    if (ya) {
      if (nuevas.has(ya.id)) {
        // Otro nombre en el mismo ambiente: se suma al nombre; queda el tipo de mayor prioridad
        if (!ya.ar.n.toLowerCase().includes(q.n.toLowerCase())) ya.ar.n = `${ya.ar.n} - ${q.n}`.slice(0, 60);
        if (dpOrdAmb(q.amb) < dpOrdAmb(ya.ar.amb)) ya.ar.amb = q.amb;
        continue;
      }
      const L = tocadas.get(ya.id) || [];
      L.push(q);
      tocadas.set(ya.id, L);
      continue;
    }
    // Nombres ajenos dentro de un contorno: textos de tamaño parecido que no son este (ni su segunda línea, cerca)
    const ajenos = pts =>
      otros.filter(o => o.t !== q.t && o.t !== q.sig && o.h >= 0.7 * q.h && plDentro(o.c[0], o.c[1], pts));
    let r = { err: "sin contorno" },
      mej = null;
    for (const h of [h0, 1.6, 2.2, 3.0].filter((v, k) => k === 0 || v > h0)) {
      DP_HUECO = h;
      const k = `${jp}|${h}`;
      if (!caches.has(k)) caches.set(k, {});
      let t = dpAreaDetectar(q.c, false, null, caches.get(k));
      if (t.err) t = dpAreaDetectar(q.ins, false, null, caches.get(k));
      if (t.err) {
        if (!mej) r = t;
        continue;
      }
      const aj = ajenos(t.pts);
      if (!mej || aj.length < mej.aj.length) mej = { t, aj };
      if (!aj.length) break;
    }
    DP_HUECO = h0;
    if (mej && mej.aj.length) {
      const yaAreas = areas(),
        malo = mej.aj.find(o => {
          const rq = esRot.get(o.t);
          return !rq || yaAreas.some(a => plDentro(rq.c[0], rq.c[1], a.pts));
        });
      if (malo) {
        sin.push({
          ...q,
          err: `se une con «${malo.lin.join(" ").slice(0, 40)}»: márquelo con «Área de ambiente» o por puntos`
        });
        continue;
      }
    }
    if (mej) r = mej.t;
    const m2 = r.pts ? plAreaPol(r.pts) * EPL.f * EPL.f : 0;
    if (r.err || m2 < 0.5) {
      sin.push({ ...q, err: r.err === "abierto" ? "el ambiente no está cerrado" : r.err || "contorno muy pequeño" });
      continue;
    }
    dsCapa(capa);
    const el = dsAgregar({
      t: "lin",
      pts: r.pts,
      c: true,
      capa,
      ar: { tp: dpTpAmb(q.amb), n: q.n, amb: q.amb, p: [q.c[0], q.c[1]] }
    });
    nuevas.add(el.id);
  }
  // Áreas que ya estaban: con un solo nombre adentro toman su tipo (y su nombre, si no tenían); con varios, el área
  // abarca varios ambientes y no se le pone tipo
  const varias = [];
  tocadas.forEach((L, id) => {
    const a = D.els.find(e => e.id === id),
      tipos = new Set(L.map(q => q.amb));
    if (L.length > 1 && tipos.size > 1) return varias.push(a);
    if (!a.ar.amb) {
      a.ar.amb = L[0].amb;
      asig++;
    }
    if (!a.ar.n) a.ar.n = L[0].n;
  });
  if (nuevas.size || asig) edCambio();
  return { nuevas: nuevas.size, asig, sin, varias, fuera, total: rot.length };
}

// Reglas citadas en un texto, en corto: «150-702(13) · 150-700(13) · 170-326»
const dpRefs = t => [...new Set(String(t).match(/\d{3}-\d{3}(?:\(\d+\))?/g) || [])].join(" · ");
// Tipo de área para el cálculo, en corto (la lista completa está en PL_TAREA)
const AM_TP = {
  tech: "Techada",
  sot: "Sótano",
  libre: "Libre no techada",
  aulas: "Aulas o alta int.",
  no: "No se cuenta"
};
/* Ventana «Ambientes e iluminación»: una sola ventana con dos pestañas, «Ambientes del diseño» (aquí) y «Niveles de
   iluminación» (js/editor/iluminacion-ventana.js), que también elige el tipo de un ambiente */
const AM_VW = ventanaMovil(document.querySelector("#ambDlg .vw"), "jmg-electric-ambientes", {
  w: 1100,
  h: 620,
  minW: 680,
  minH: 320
});
let AM_PL = -1,
  AM_RES = null,
  // Pestaña a la vista: «amb» (ambientes del diseño) o «lux» (niveles de iluminación)
  AM_TAB = "amb";
const AM_PIE = {
  amb: "El tipo se reconoce por el nombre escrito en el plano (criterio): confírmelo o cámbielo con su botón. Iluminancia: Norma EM.010, Anexo, o la del proyecto. Reglas: CNE-Utilización, Reglas 150-700 a 150-708 y Sección 170.",
  lux: "Iluminancia mantenida mínima Em de la Norma EM.010 (2019), Anexo (la Sección 4, Industria, aún no está). Distinta de la norma: criterio del proyectista; menor que el mínimo: se avisa en la revisión."
};
const amHayPlano = () => !!(EPL && PL_MOD);
// Abre la ventana en una pestaña
function amVentana(tab) {
  if (tab === "amb" && amHayPlano()) dsAsegurar();
  AM_TAB = tab;
  const abierta = !$("ambDlg").hidden;
  $("ambDlg").hidden = false;
  if (!abierta) {
    vwFondo();
    AM_VW.abrir();
  }
  amTabs();
}
// Muestra la pestaña elegida, con su título y su nota al pie
function amTabs() {
  $("amPaneAmb").hidden = AM_TAB !== "amb";
  $("amPaneLux").hidden = AM_TAB !== "lux";
  document.querySelectorAll("#ambDlg [data-am-tab]").forEach(b => {
    b.classList.toggle("on", b.dataset.amTab === AM_TAB);
    b.setAttribute("aria-selected", b.dataset.amTab === AM_TAB);
  });
  $("amT").textContent =
    AM_TAB === "lux" && typeof LX_PICK !== "undefined" && LX_PICK
      ? `Tipo de ambiente · ${LX_PICK.n}`
      : "Ambientes e iluminación";
  $("amPie").textContent = AM_PIE[AM_TAB];
  $("amPie").title = AM_PIE[AM_TAB];
  if (AM_TAB === "amb") ambRender();
  else luxRender();
}
function ambAbrir() {
  if (!amHayPlano()) return toast("Primero abra el plano de arquitectura en DXF");
  amVentana("amb");
}
function ambCerrar() {
  if (typeof LX_PICK !== "undefined" && LX_PICK) LX_G = LX_PICK.g0;
  if (typeof LX_PICK !== "undefined") LX_PICK = null;
  $("ambDlg").hidden = true;
  vwFondo();
}
function ambRender() {
  if ($("ambDlg").hidden || AM_TAB !== "amb") return;
  // Sin plano (ventana abierta desde Parámetros): los ambientes se marcan en el editor
  if (!amHayPlano()) {
    $("amLista").innerHTML =
      '<p class="rev-ok">Los ambientes se marcan sobre el plano de arquitectura: abra el editor de diseño con su plano DXF y use «Detectar ambientes» o «Área de ambiente». Los niveles de iluminación se pueden revisar en la otra pestaña.</p>';
    $("amCuenta").textContent = "";
    $("amPlanta").hidden = true;
    document.querySelector('#ambDlg [data-am="detectar"]').disabled = true;
    $("amTabN").textContent = "";
    return;
  }
  document.querySelector('#ambDlg [data-am="detectar"]').disabled = AM_OCUP;
  const D = dsD(),
    pl = EPL.plantas,
    L = D.els.filter(
      e => e.t === "lin" && e.ar && e.ar.tp !== "ext" && (AM_PL < 0 || dpPlantaEl(e) === AM_PL) && e.pts.length >= 6
    );
  $("amPlanta").innerHTML =
    `<option value="-1">${pl.length ? "Todas las plantas" : "Lo visible en pantalla"}</option>` +
    pl.map((p, i) => `<option value="${i}"${i === AM_PL ? " selected" : ""}>${esc(p.n)}</option>`).join("");
  $("amPlanta").hidden = !pl.length;
  L.sort(
    (a, b) =>
      dpPlantaEl(a) - dpPlantaEl(b) ||
      dpOrdAmb(a.ar.amb) - dpOrdAmb(b.ar.amb) ||
      String(a.ar.n).localeCompare(String(b.ar.n))
  );
  const sinTipo = L.filter(e => !e.ar.amb).length;
  let h = "";
  if (AM_RES) {
    const r = AM_RES,
      partes = [];
    partes.push(
      `${r.nuevas} ambiente${r.nuevas === 1 ? "" : "s"} detectado${r.nuevas === 1 ? "" : "s"} de ${r.total} nombre${r.total === 1 ? "" : "s"} escrito${r.total === 1 ? "" : "s"} en el plano`
    );
    if (r.asig)
      partes.push(
        `${r.asig} área${r.asig === 1 ? "" : "s"} que ya estaba${r.asig === 1 ? "" : "n"} marcada${r.asig === 1 ? "" : "s"} tomó su tipo`
      );
    if (r.fuera)
      partes.push(
        `${r.fuera} fuera de ${EPL.plantas.length ? "las plantas encuadradas" : "la pantalla"} (no se usan: cortes, leyendas u otras láminas)`
      );
    h += `<div class="am-res"><b>${partes.join(" · ")}</b>`;
    if (r.sin.length)
      h += `<p>Sin contorno cerrado (márquelos con «Área de ambiente» o revise las capas de muros): ${r.sin
        .map(
          q =>
            `<button type="button" class="linkbtn" data-am-pt="${q.c[0]},${q.c[1]}" title="${esc(q.err)}">${esc(q.n)}</button>`
        )
        .join(", ")}</p>`;
    if (r.varias.length)
      h += `<p>Estas áreas abarcan varios ambientes y no se les puso tipo: ${r.varias
        .map(a => `<button type="button" class="linkbtn" data-am-ver="${a.id}">${esc(a.ar.n || "Área")}</button>`)
        .join(", ")}. Si quiere el detalle por ambiente, bórrelas y detecte otra vez.</p>`;
    h += `</div>`;
  }
  h += L.length
    ? `<div class="am-fila am-cab"><span>Ambiente</span><span>Tipo de ambiente</span><span>Piso</span><span>Área</span><span>Para el cálculo</span><span title="Iluminancia mantenida mínima, Norma EM.010, Anexo">Iluminancia mín.</span><span>Qué exige el CNE-Utilización</span><span></span></div>` +
      L.map(e => {
        const t = ambTipo(e.ar.amb),
          jp = dpPlantaEl(e),
          piso = pl.length ? (jp >= 0 ? dpNomPiso(plPisoPlanta(pl[jp], jp)) : "fuera") : "1er piso";
        return `<div class="am-fila${e.ar.amb ? "" : " am-sin"}"><input type="text" data-am-k="n" data-id="${e.id}" value="${esc(e.ar.n || "")}" maxlength="60" placeholder="Nombre del ambiente" aria-label="Nombre del ambiente"><button type="button" class="ds-amb" data-am-tipo="${e.id}" title="Elegir el tipo de ambiente (Norma EM.010 o propio)">${esc(t ? t.n : "Elegir el tipo…")}<span class="ds-amb-f">▸</span></button><span>${esc(piso)}</span><span class="am-n">${fmt(dsM2(e), 2)} m²</span><select data-am-k="tp" data-id="${e.id}" aria-label="Tipo de área para el cálculo">${Object.entries(
          AM_TP
        )
          .map(([k, n]) => `<option value="${k}"${k === e.ar.tp ? " selected" : ""}>${esc(n)}</option>`)
          .join(
            ""
          )}</select><span class="am-n">${luxCelda(t)}</span><span class="am-cne" title="${t && t.cne ? esc(t.cne) : ""}">${t ? (t.cne ? dpRefs(t.cne) : "—") : "<em>Elija el tipo</em>"}</span><button type="button" class="vw-btn" data-am-ver="${e.id}" title="Ver en el plano">Ver</button></div>`;
      }).join("")
    : `<p class="rev-ok">Aún no hay ambientes${AM_PL >= 0 ? " en esta planta" : ""}. «Detectar ambientes» busca los nombres escritos en el plano (SALA, DORMITORIO, COCINA, SS.HH.…) y marca el contorno de cada uno; también puede marcarlos uno por uno con «Área de ambiente».</p>`;
  $("amLista").innerHTML = h;
  $("amCuenta").textContent =
    (pl.length ? "" : "Sin plantas encuadradas: se detecta lo visible en pantalla · ") +
    (L.length ? `${L.length} ambiente${L.length === 1 ? "" : "s"}${sinTipo ? ` · ${sinTipo} sin tipo` : ""}` : "");
  $("amTabN").textContent = L.length ? String(L.length) : "";
}
let AM_OCUP = false;
async function ambDetectar() {
  if (AM_OCUP) return;
  if (!dpRotulos().length)
    return toast("No se encontraron nombres de ambientes en el plano: márquelos con «Área de ambiente»");
  AM_OCUP = true;
  const bt = $("ambDlg").querySelector('[data-am="detectar"]'),
    t0 = performance.now();
  bt.disabled = true;
  try {
    AM_RES = await dpAmbDetectar(AM_PL, (i, n) => ($("amCuenta").textContent = `Detectando ambientes… ${i} de ${n}`));
  } finally {
    AM_OCUP = false;
    bt.disabled = false;
  }
  console.debug(`Ambientes detectados en ${Math.round(performance.now() - t0)} ms`);
  plSobreDibujar();
  ambRender();
  toast(
    AM_RES.nuevas || AM_RES.asig
      ? `${AM_RES.nuevas} ambiente${AM_RES.nuevas === 1 ? "" : "s"} detectado${AM_RES.nuevas === 1 ? "" : "s"}: revise su tipo`
      : "No se detectaron ambientes nuevos"
  );
}
$("ambDlg").addEventListener("click", e => {
  if (e.target.id === "ambDlg") return ambCerrar();
  const b = e.target.closest("[data-am]");
  if (b && b.dataset.am === "cerrar") return ambCerrar();
  if (b && b.dataset.am === "max") return AM_VW.maximizar();
  if (b && b.dataset.am === "detectar") return ambDetectar();
  const tb = e.target.closest("[data-am-tab]");
  if (tb) {
    // Otra pestaña: se deja de elegir el tipo
    if (LX_PICK) {
      LX_G = LX_PICK.g0;
      LX_PICK = null;
    }
    AM_TAB = tb.dataset.amTab;
    return amTabs();
  }
  const v = e.target.closest("[data-am-ver]");
  if (v) return dsVerIds([v.dataset.amVer]);
  const tp = e.target.closest("[data-am-tipo]");
  if (tp) return luxElegir([tp.dataset.amTipo]);
  const pt = e.target.closest("[data-am-pt]");
  if (pt) {
    const [x, y] = pt.dataset.amPt.split(",").map(Number),
      m = 3 / EPL.f;
    plVer(x - m, y - m, x + m, y + m);
    return plSobreDibujar();
  }
});
$("ambDlg").addEventListener("change", e => {
  if (e.target.id === "amPlanta") {
    AM_PL = +e.target.value;
    AM_RES = null;
    return ambRender();
  }
  const c = e.target.closest("[data-am-k]");
  if (!c) return;
  const el = dsD().els.find(x => String(x.id) === c.dataset.id);
  if (!el || !el.ar) return;
  const k = c.dataset.amK,
    v = c.value;
  if (k === "n") el.ar.n = v.replace(/[<>]/g, "").trim().slice(0, 60);
  else if (k === "amb") {
    if (ambValido(v)) el.ar.amb = v;
    else delete el.ar.amb;
  } else if (k === "tp") el.ar.tp = PL_TAREA[v] ? v : "tech";
  edCambio();
  plSobreDibujar();
  ambRender();
});
$("ambDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    ambCerrar();
  }
  e.stopPropagation();
});

/* ---------- Verificación normativa del diseño: reglas de seguridad del CNE-Utilización por ambiente ----------
   Se revisan con los ambientes marcados (tipo de ambiente, ar.amb) y las duchas o tinas del plano:
   - 150-702(14): tomacorriente del baño a 1 m de la ducha o tina «en la medida de lo posible» y nunca a menos de 500 mm;
   - 150-700(13): tomacorrientes de baños y lavanderías a menos de 3 m de la ducha o tina, con diferencial;
   - 170-326(3): interruptores fuera del alcance de una persona en la ducha o tina (la distancia es criterio);
   - 150-704(7): circuito independiente para los tomacorrientes de la lavandería;
   - 150-704(12): circuitos independientes para el aire acondicionado;
   - 150-702(2): electrodoméstico de más de 15 A en un circuito independiente;
   - 170-328: escaleras de vivienda iluminadas y, con cuatro o más peldaños, con interruptores de tres vías en la
     cabecera y en la base.
   Las distancias se miden en planta, del centro del símbolo al borde de la ducha o tina. */
// Duchas y tinas por el nombre de su bloque o de su capa
const DP_DUCHA = /duch|shower|\btinas?\b|ba[ñn]era|bathtub|jacuzzi|acqua.?jet|hidromasaj/i;
// Interruptores de tres vías (o su equivalente: conmutadores)
const DP_3V = new Set(["int3", "int3PA", "conm", "int2v", "conmInt", "int4"]);
/* Duchas y tinas del plano: las que marcó el proyectista (EPL.duchas: objetos de la arquitectura) y las que se
   reconocen por su bloque o su capa; cada una con su rectángulo [x0, y0, x1, y1] */
function dpDuchas() {
  if (!PL_MOD || !EPL) return [];
  const marc = new Set(EPL.duchas || []),
    g = new Map();
  PL_MOD.trazos.forEach(t => {
    if (PL_BORR.has(t.e)) return;
    const m = marc.has(t.e);
    if (!m && !DP_DUCHA.test(t.bl || "") && !DP_DUCHA.test(t.capa)) return;
    const [a, b, c, d] = dpCaja(t),
      o = g.get(t.e);
    if (!o) g.set(t.e, { e: t.e, m, caja: [a, b, c, d] });
    else o.caja = [Math.min(o.caja[0], a), Math.min(o.caja[1], b), Math.max(o.caja[2], c), Math.max(o.caja[3], d)];
  });
  return [...g.values()];
}
// Distancia de un punto al rectángulo (0 si está dentro), en unidades del dibujo
const dpDistCaja = (x, y, [a, b, c, d]) => Math.hypot(Math.max(a - x, 0, x - c), Math.max(b - y, 0, y - d));
// Corriente de una carga especial (A): monofásica a 220 V; trifásica a la tensión del sistema
function dpCorriente(el) {
  const p = dsPotEl(el) || 0,
    fp = parseFloat(PROY.fp) || 0.9,
    f3 = (el.fs || (PL_ESP[el.k] || [])[1]) === 3,
    s = SIST[MODE === "multi" ? PROY.sistG : PROY.sist] || SIST.mono220;
  return f3 ? p / (SQ3 * (s.tri ? s.V : 380) * fp) : p / (220 * fp);
}
function dpVerifNorma(add) {
  const D = dsD();
  if (!D) return;
  const f = EPL.f || 1,
    C = dsCrit(),
    sims = D.els.filter(e => e.t === "sim" && dsVis(e)),
    amb = D.els.filter(e => e.t === "lin" && e.ar && e.ar.amb && e.pts.length >= 6),
    // Ambiente de un punto: el más pequeño que lo contiene
    ambDe = (x, y) =>
      amb.filter(a => plDentro(x, y, a.pts)).sort((a, b) => plAreaPol(a.pts) - plAreaPol(b.pts))[0] || null,
    nom = a => a.ar.n || (ambTipo(a.ar.amb) || { n: "Ambiente" }).n,
    m = v => fmt(v, 2),
    clase = e => dsClase(e),
    esToma = e => clase(e) === "to",
    esInt = e => DS_CAT[e.k] && DS_CAT[e.k].g === "Interruptores";
  if (!amb.length) {
    if (sims.length)
      add(
        "info",
        "Sin ambientes: no se verifican las reglas del CNE por ambiente",
        ["-"],
        "Marque los ambientes (Inicio › Ambientes › Detectar ambientes) para verificar baños, lavandería, escaleras y circuitos independientes (CNE-U 150-700, 150-702, 150-704 y 170-328)."
      );
    return;
  }
  // Iluminancia del proyecto por debajo del mínimo de la EM.010 (ventana «Niveles de iluminación»)
  const bajos = amb.filter(a => (ambTipo(a.ar.amb) || {}).est === "bajo");
  if (bajos.length)
    add(
      "aviso",
      `${bajos.length} ambiente${bajos.length > 1 ? "s" : ""} con iluminancia por debajo del mínimo de la EM.010`,
      bajos.map(a => a.id),
      bajos
        .slice(0, 6)
        .map(a => {
          const t = ambTipo(a.ar.amb);
          return `${nom(a)}: ${t.lux} lx, mínimo ${t.luxN} lx (EM.010, Anexo ${t.em})`;
        })
        .join("; ") + ". Cámbielo en «Niveles de iluminación» o justifíquelo en la memoria."
    );
  const lugar = new Map(sims.map(e => [e.id, ambDe(e.x, e.y)])),
    duchas = dpDuchas(),
    // Duchas o tinas de un ambiente: las que tienen su centro adentro
    duchasDe = a => duchas.filter(u => plDentro((u.caja[0] + u.caja[2]) / 2, (u.caja[1] + u.caja[3]) / 2, a.pts)),
    banos = amb.filter(a => a.ar.amb === "bano");
  // Baños sin ducha o tina reconocida: las distancias no se pueden medir
  const sinDucha = banos.filter(a => !duchasDe(a).length);
  if (sinDucha.length)
    add(
      "info",
      `${sinDucha.length} baño${sinDucha.length > 1 ? "s" : ""} sin ducha o tina reconocida en el plano`,
      sinDucha.map(a => a.id),
      "Elija las líneas de la ducha o tina en la arquitectura y, con clic derecho, «Es una ducha o tina»: así se miden las distancias de los tomacorrientes e interruptores (CNE-U 150-702(14) y 170-326)."
    );
  // Circuito del cálculo (con el diseño) de una salida: para saber si tiene diferencial
  const circ =
      typeof LAST !== "undefined" && LAST && Array.isArray(LAST.circ)
        ? LAST.circ.filter(q => q.src && q.src.t === "plano")
        : [],
    circDe = e => circ.find(q => q.src.tab === e.tab && q.src.cir === e.cir) || null;
  sims.forEach(e => {
    const a = lugar.get(e.id);
    if (!a || (a.ar.amb !== "bano" && a.ar.amb !== "lav")) return;
    const du = duchasDe(a),
      d = du.length ? Math.min(...du.map(u => dpDistCaja(e.x, e.y, u.caja))) * f : null;
    if (esToma(e)) {
      if (a.ar.amb === "bano" && d !== null) {
        if (d < 0.5)
          add(
            "seg",
            `${nom(a)}: tomacorriente a ${m(d)} m de la ducha o tina`,
            [e.id],
            "CNE-U 150-702(14): nunca a menos de 500 mm de la tina o del compartimiento de ducha (medido en horizontal, sin atravesar paredes)."
          );
        else if (d < 1)
          add(
            "aviso",
            `${nom(a)}: tomacorriente a ${m(d)} m de la ducha o tina`,
            [e.id],
            "CNE-U 150-702(14): en la medida de lo posible, a por lo menos 1 m de la tina o de la ducha."
          );
      }
      // Diferencial: en el baño (sin ducha reconocida se supone cerca) y en la lavandería a menos de 3 m de una ducha
      const cerca = d !== null ? d < 3 : a.ar.amb === "bano",
        q = cerca && e.cir ? circDe(e) : null;
      if (q && !q.idName)
        add(
          "seg",
          `${nom(a)}: tomacorriente del ${e.cir} sin interruptor diferencial`,
          [e.id],
          "CNE-U 150-700(13): los tomacorrientes de baños y lavanderías a menos de 3 m de la tina o ducha deben estar protegidos por un interruptor diferencial para la protección de personas."
        );
    } else if (esInt(e) && d !== null && d < C.duc)
      add(
        "seg",
        `${nom(a)}: interruptor a ${m(d)} m de la ducha o tina`,
        [e.id],
        `CNE-U 170-326(3): los interruptores no deben estar al alcance de una persona en la ducha o la tina. Alcance: ${m(C.duc)} m (criterio de la plataforma, editable arriba).`
      );
  });
  // Circuitos: salidas de cada circuito (tablero y circuito)
  const grupos = new Map();
  sims.forEach(e => {
    if (!e.cir || !clase(e)) return;
    const k = (e.tab || "") + "|" + e.cir;
    (grupos.get(k) || grupos.set(k, []).get(k)).push(e);
  });
  const nomCir = l => {
    const tb = D.els.find(x => x.id === l[0].tab);
    return `${l[0].cir}${tb && tb.nom ? " de " + tb.nom : ""}`;
  };
  grupos.forEach(l => {
    // Lavandería: sus tomacorrientes en un circuito que no alimenta nada más
    const enLav = l.filter(e => esToma(e) && lugar.get(e.id) && lugar.get(e.id).ar.amb === "lav");
    if (enLav.length) {
      const otras = l.filter(e => !enLav.includes(e));
      if (otras.length)
        add(
          "seg",
          `${nomCir(l)}: los tomacorrientes de la lavandería comparten el circuito con ${otras.length} salida${otras.length > 1 ? "s" : ""} más`,
          [...enLav, ...otras].map(e => e.id),
          "CNE-U 150-704(7): debe preverse un circuito derivado independiente para los tomacorrientes de la lavandería."
        );
    }
    // Aire acondicionado: circuitos que no alimentan otros electrodomésticos
    const aire = l.filter(e => e.k === "aire" || (clase(e) === "esp" && (e.ctp || (PL_ESP[e.k] || [])[0]) === "aire"));
    if (aire.length && aire.length < l.length)
      add(
        "seg",
        `${nomCir(l)}: el aire acondicionado comparte el circuito con otras salidas`,
        l.map(e => e.id),
        "CNE-U 150-704(12): uno o más circuitos derivados independientes para el aire acondicionado, que no alimenten a otro tipo de electrodomésticos."
      );
    // Electrodomésticos de más de 15 A: circuito independiente
    l.filter(e => clase(e) === "esp" && !aire.includes(e)).forEach(e => {
      const I = dpCorriente(e);
      if (I > 15 && l.length > 1)
        add(
          "seg",
          `${nomCir(l)}: ${e.cn || DS_CAT[e.k].n} de ${m(I)} A comparte el circuito`,
          l.map(x => x.id),
          "CNE-U 150-702(2): todo electrodoméstico de más de 15 A es una instalación fija, con su medio de desconexión y protección, alimentado desde un circuito derivado independiente."
        );
    });
  });
  // Escaleras: iluminadas y con interruptores de tres vías (los de la otra planta cuentan por su letra de encendido)
  amb
    .filter(a => a.ar.amb === "esc")
    .forEach(a => {
      const luces = sims.filter(e => clase(e) === "al" && lugar.get(e.id) === a);
      if (!luces.length)
        return add(
          "seg",
          `${nom(a)}: sin alumbrado`,
          [a.id],
          "CNE-U 170-328(1): todas las escaleras de una unidad de vivienda deben ser iluminadas."
        );
      const letras = new Set(luces.map(e => e.enc).filter(Boolean)),
        tres = sims.filter(e => DP_3V.has(e.k) && dsLetras(e).some(l => letras.has(l)));
      if (tres.length < 2)
        add(
          "seg",
          `${nom(a)}: su alumbrado no tiene interruptores de tres vías arriba y abajo`,
          [a.id, ...luces.map(e => e.id), ...tres.map(e => e.id)],
          "CNE-U 170-328(1): con cuatro o más peldaños, el alumbrado se controla con interruptores de tres vías (o su equivalente) en la cabecera y en la base; ponga a los dos la letra de encendido de estas luminarias. 170-328(2): las que van a un sótano o azotea sin áreas terminadas pueden tener un solo interruptor al inicio."
        );
    });
}
// Duchas y tinas reconocidas: un rectángulo celeste (las marcadas a mano, con línea continua)
function dpDibDuchas(g, d) {
  if (!PL_MOD || !EPL || (!(EPL.duchas || []).length && $("revDlg").hidden)) return;
  g.save();
  g.strokeStyle = "#0288d1";
  g.fillStyle = "rgba(2, 136, 209, 0.08)";
  g.lineWidth = 1.5 * d;
  dpDuchas().forEach(u => {
    const [x0, y0] = plAPant(u.caja[0], u.caja[3]),
      [x1, y1] = plAPant(u.caja[2], u.caja[1]);
    g.setLineDash(u.m ? [] : [4 * d, 3 * d]);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  });
  g.restore();
}
