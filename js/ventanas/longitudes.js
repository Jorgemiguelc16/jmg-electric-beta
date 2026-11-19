/* VERIFICAR LONGITUDES
   Ventana (cuadro de conductores › «Verificar longitudes») que muestra, para cada circuito que sale del plano, los
   tramos que suma su longitud, en una tabla en rejilla como la del cuadro:
   - «Recorrido»: las tuberías hasta la salida más alejada y los tramos verticales (en el tablero, en cada artefacto
     y en los montantes), desde dónde y hasta dónde, con el acumulado y el total;
   - «Salidas»: todas las salidas del circuito (S-1, S-2… de la más cercana a la más alejada) con su recorrido.
   Así el proyectista comprueba a mano el resultado del cuadro. Lee el diseño que usó el cálculo (LAST.pld,
   plConDiseno) y los pasos de cada recorrido (plCamino, en js/calculo/calculo-plano.js). La forma de medir es criterio de la
   plataforma; esta ventana no cambia ningún resultado. */
let LG_KEY = null,
  LG_TAB = "rec";
const LG_VW = ventanaMovil(document.querySelector("#lgDlg .vw"), "jmg-electric-verificar-longitudes", {
  w: 980,
  h: 560,
  minW: 640,
  minH: 320
});
const LG_NIVEL = { techo: "techo", piso: "piso", pared: "pared" };
const lgM = x => fmt(x, 2);
// Circuitos del último cálculo y, para los del plano, su circuito en el diseño
function lgCircs() {
  if (!LAST) return [];
  const pld = LAST.pld;
  return LAST.circ.map(q => {
    const s = q.src && q.src.t === "plano" ? q.src : null,
      tb = s && pld ? pld.tabs.find(t => t.id === s.tab) : null,
      q0 = tb ? tb.circs.find(c => c.cir === s.cir) : null;
    return { q, q0 };
  });
}
function verificarLongitudes(abrir, key) {
  if (!abrir) {
    $("lgDlg").hidden = true;
    vwFondo();
    return;
  }
  if (DESACT) calcularAhora();
  const L = lgCircs();
  if (!L.length) return toast("Complete los datos para verificar las longitudes");
  // El circuito pedido; si no, el último visto o el primero que sale del plano
  const ok = k => L.some(x => x.q.key === k);
  LG_KEY = ok(key) ? key : ok(LG_KEY) ? LG_KEY : (L.find(x => x.q0) || L[0]).q.key;
  const nuevo = $("lgDlg").hidden;
  $("lgDlg").hidden = false;
  vwFondo();
  if (nuevo) LG_VW.abrir();
  lgRender();
}
const lgVerBtn = ids =>
  `<button type="button" class="lg-ver" data-lgv="${ids.join(",")}" title="Ver en el plano" aria-label="Ver en el plano"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.4 10.4 3.6 3.6"/></svg></button>`;
// Celda de texto: se corta con «…» si no cabe y muestra el texto completo al pasar el cursor
const lgTxt = (s, sub, tit) =>
  `<td class="t" title="${esc((tit ? tit + " · " : "") + s + (sub ? " · " + sub : ""))}">${esc(s)}${sub ? ` <span class="lg-sub">${esc(sub)}</span>` : ""}</td>`;
function lgRender() {
  const L = lgCircs(),
    x = L.find(o => o.q.key === LG_KEY);
  if (!x) return verificarLongitudes(false);
  // Lista de circuitos, agrupados por tablero
  const grupos = new Map();
  L.forEach(o => {
    if (!grupos.has(o.q.tab)) grupos.set(o.q.tab, []);
    grupos.get(o.q.tab).push(o);
  });
  $("lgCir").innerHTML = [...grupos]
    .map(
      ([tab, l]) =>
        `<optgroup label="${esc(tab)}">${l
          .map(
            o =>
              `<option value="${esc(o.q.key)}"${o.q.key === LG_KEY ? " selected" : ""}>${esc(o.q.id)}${o.q.desc ? " · " + esc(o.q.desc) : ""}${o.q0 ? "" : " (datos escritos)"}</option>`
          )
          .join("")}</optgroup>`
    )
    .join("");
  document
    .querySelectorAll("#lgTabs [data-lgt]")
    .forEach(b => b.setAttribute("aria-selected", b.dataset.lgt === LG_TAB));
  const { q, q0 } = x;
  $("lgPlano").disabled = !q0;
  $("lgTabs").hidden = !q0;
  if (!q0) {
    $("lgRes").innerHTML = `Longitud escrita: <b>${lgM(q.L)} m</b>`;
    $("lgC").innerHTML =
      `<p class="lg-msg">Este circuito no sale del plano: se calcula con la longitud escrita en los datos del proyecto (${lgM(q.L)} m). Para que su longitud salga del recorrido de las tuberías, dibújelo en el editor de diseño y elija «Calcular con el diseño» (Planos › Datos del diseño para el cálculo).</p>`;
    return;
  }
  const els = new Map(((LAST.pld && LAST.pld.els) || []).map(e => [e.id, e])),
    // Salidas del circuito numeradas de la más cercana a la más alejada (las que no tienen recorrido, al final)
    sal = [...q0.sal].sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity)),
    num = new Map(sal.map((o, i) => [o.id, `S-${i + 1}`])),
    nom = id => {
      const e = els.get(id);
      if (!e) return "Elemento";
      if (/^tab/.test(e.k)) return e.nom ? `Tablero ${e.nom}` : "Tablero";
      // Nombre corto: «Salida de alumbrado en techo» → «Alumbrado en techo»
      const n0 = e.cn || (typeof DS_CAT !== "undefined" && DS_CAT[e.k] ? DS_CAT[e.k].n : "Artefacto"),
        n = e.cn ? n0 : n0.replace(/^Salida de (\p{L})/iu, (_, c) => c.toUpperCase());
      return num.has(id) ? `${num.get(id)} · ${n}` : n;
    },
    // Nombre corto para las columnas: TD-01, S-3 o «Tomacorriente (C-6)»; el completo, al pasar el cursor
    corto = id => {
      const e = els.get(id);
      if (!e) return "Elemento";
      if (/^tab/.test(e.k)) return e.nom || "Tablero";
      if (num.has(id)) return num.get(id);
      const w = nom(id).split(" ")[0];
      return e.cir ? `${w} (${e.cir})` : w;
    },
    esTab = id => /^tab/.test((els.get(id) || {}).k || ""),
    tubo = id => els.get(id) || {},
    nivel = t => LG_NIVEL[t.modo] || LG_NIVEL.techo,
    cirs = t => [...new Set([t.cir, ...(t.cx || [])].filter(Boolean))],
    // Altura del artefacto y de la tubería en una vertical
    hArt = v => `${lgM(v.sale ? v.de : v.a)} m (${esTab(v.id) ? "borde superior" : "montaje"})`,
    hTub = v => `${lgM(v.sale ? v.a : v.de)} m (${nivel(tubo(v.t))})`;
  const total = q0.Lh + q0.Lv;
  $("lgRes").innerHTML =
    `Tubería <b>${lgM(q0.Lh)}</b> m + vertical <b>${lgM(q0.Lv)}</b> m = <b>${lgM(total)} m</b><span class="ca-sep"></span>En el cuadro: <b>${fmt(q.L, 1)} m</b>` +
    (total < 0.5 ? " (mínimo de 0.50 m, criterio)" : "");
  let h = "";
  if (LG_TAB === "rec") {
    // Filas: tubería, vertical (las dos de una salida de paso, juntas), derivación y montante
    const filas = [],
      R = q0.ruta || [];
    // Último artefacto por el que pasa el recorrido (para el «desde» y el «hasta» de cada tubería)
    let prev = q.src.tab;
    for (let i = 0; i < R.length; i++) {
      const p = R[i];
      if (p.k === "h") {
        const t = tubo(p.t),
          c = cirs(t),
          a = t.c0 === prev ? t.c1 : t.c1 === prev ? t.c0 : t.c1,
          de = t.c0 === prev || t.c1 === prev ? prev : t.c0;
        filas.push({
          tr: `Tubería por el ${nivel(t)}`,
          sub: c.length > 1 ? c.join(", ") : "",
          de: de ? corto(de) : "Derivación",
          a: a ? corto(a) : "Derivación",
          tit: `${de ? nom(de) : "Derivación"} → ${a ? nom(a) : "Derivación"}`,
          h: p.L,
          v: 0,
          ids: [p.t]
        });
      } else if (p.k === "v") {
        prev = p.id;
        if (!(p.L > 0) || p.de == null || p.a == null) continue;
        const n = R[i + 1];
        if (n && n.k === "v" && n.id === p.id && !p.sale && n.sale) {
          filas.push({
            tr: `Paso por ${corto(p.id)}`,
            tit: nom(p.id),
            sub: "",
            de: hTub(p),
            a: `${hArt(p)} y vuelve`,
            h: 0,
            v: p.L + n.L,
            ids: [p.id]
          });
          i++;
        } else
          filas.push({
            tr: `Vertical en ${corto(p.id)}`,
            tit: nom(p.id),
            sub: p.a > p.de ? "sube" : "baja",
            de: p.sale ? hArt(p) : hTub(p),
            a: p.sale ? hTub(p) : hArt(p),
            h: 0,
            v: p.L,
            ids: [p.id]
          });
      } else if (p.k === "d") {
        if (!(p.L > 0)) continue;
        filas.push({
          tr: "Derivación entre tuberías",
          sub: p.a > p.de ? "sube" : "baja",
          de: `${lgM(p.de)} m (${nivel(tubo(p.t))})`,
          a: `${lgM(p.a)} m (${nivel(tubo(p.o))})`,
          h: 0,
          v: p.L,
          ids: [p.t, p.o]
        });
      } else if (p.k === "m") {
        filas.push({
          tr: "Montante a otra planta",
          sub: `${p.pisos} piso${p.pisos > 1 ? "s" : ""} × ${lgM(p.L / p.pisos)} m de entrepiso`,
          de: corto(p.id),
          a: corto(p.o),
          tit: `${nom(p.id)} → ${nom(p.o)}`,
          h: 0,
          v: p.L,
          ids: [p.id, p.o]
        });
        prev = p.o;
      }
    }
    let acu = 0;
    const sH = filas.reduce((s, f) => s + f.h, 0),
      sV = filas.reduce((s, f) => s + f.v, 0);
    h =
      `<table><thead><tr><th class="lg-c-n">N°</th><th class="t">Tramo</th><th class="t lg-c-p">Desde</th><th class="t lg-c-p">Hasta</th><th class="lg-c-l">Tubería (m)</th><th class="lg-c-l">Vertical (m)</th><th class="lg-c-a">Acumulado (m)</th><th class="lg-c-v"></th></tr></thead><tbody>` +
      `<tr class="grp"><td></td><td class="t" colspan="7">Recorrido desde el tablero hasta la salida más alejada: ${esc(nom(q0.lej))}</td></tr>` +
      (q0.est
        ? `<tr><td></td><td class="t bad" colspan="7">Hay salidas sin tubería desde el tablero: la longitud se estima en línea quebrada (${lgM(q0.L)} m). Una todas las salidas con tuberías para verificarla tramo por tramo.</td></tr>`
        : filas
            .map((f, i) => {
              acu += f.h + f.v;
              return `<tr><td class="c">${i + 1}</td>${lgTxt(f.tr, f.sub, f.tit)}${lgTxt(f.de, "", f.tit)}${lgTxt(f.a, "", f.tit)}<td>${f.h ? lgM(f.h) : ""}</td><td>${f.v ? lgM(f.v) : ""}</td><td>${lgM(acu)}</td><td class="c">${lgVerBtn(f.ids)}</td></tr>`;
            })
            .join("") +
          `<tr class="lg-tot"><td></td><td class="t" colspan="3">Total del recorrido</td><td>${lgM(sH)}</td><td>${lgM(sV)}</td><td>${lgM(sH + sV)}</td><td></td></tr>`) +
      "</tbody></table>";
  } else
    h =
      `<table><thead><tr><th class="lg-c-n">N°</th><th class="t">Salida</th><th class="lg-c-l">Tubería (m)</th><th class="lg-c-l">Vertical (m)</th><th class="lg-c-a">Recorrido (m)</th><th class="lg-c-v"></th></tr></thead><tbody>` +
      `<tr class="grp"><td></td><td class="t" colspan="5">${sal.length} salida${sal.length > 1 ? "s" : ""} del circuito, de la más cercana a la más alejada · la longitud del circuito es la de la más alejada</td></tr>` +
      sal
        .map(o => {
          const lej = o.id === q0.lej,
            e = els.get(o.id) || {},
            n = e.cn || (typeof DS_CAT !== "undefined" && DS_CAT[e.k] ? DS_CAT[e.k].n : "Salida");
          return `<tr${lej ? ' class="lg-lej"' : ""}><td class="c">${num.get(o.id)}</td>${lgTxt(n, lej ? "la más alejada" : "")}${
            o.d == null
              ? '<td class="t bad" colspan="3">Sin tubería desde el tablero</td>'
              : `<td>${lgM(o.h)}</td><td>${lgM(o.d - o.h)}</td><td>${lgM(o.d)}</td>`
          }<td class="c">${lgVerBtn([o.id])}</td></tr>`;
        })
        .join("") +
      "</tbody></table>";
  $("lgC").innerHTML = h;
  // Ayuda: cómo se mide, con las alturas del proyecto
  const A = (LAST.c && LAST.c.alt) || {};
  $("lgAyuda").textContent =
    `Cómo se mide (criterio de la plataforma): el camino más corto por las tuberías del circuito, desde el tablero hasta cada salida. La tubería por el techo va a ${lgM(A.techo ?? 2.9)} m, la del piso a 0 m y la de la pared a la altura del artefacto donde empieza. En cada artefacto se sube o se baja hasta su altura de montaje (la suya o la de Parámetros › Alturas); en el tablero, desde su borde superior. Una salida de paso suma la subida y la bajada. Con la longitud hasta la salida más alejada y la carga conectada del circuito se calcula la caída de tensión (Regla 050-102).`;
}
// Muestra elementos en el plano: cierra esta ventana y el cuadro (si no tiene cambios sin aplicar)
function lgVer(ids) {
  if (!$("condDlg").hidden && cdCambios())
    return toast("Aplique o cancele primero los cambios del cuadro de conductores");
  verificarLongitudes(false);
  if (!$("condDlg").hidden) cuadroCond(false);
  edVerEnPlano(ids);
}
$("lgDlg").addEventListener("click", e => {
  const b = e.target.closest("[data-lg]"),
    v = e.target.closest("[data-lgv]"),
    t = e.target.closest("[data-lgt]");
  if (v) return lgVer(v.dataset.lgv.split(","));
  if (t) {
    LG_TAB = t.dataset.lgt;
    return lgRender();
  }
  if (!b) return;
  const a = b.dataset.lg;
  if (a === "cerrar") verificarLongitudes(false);
  else if (a === "max") LG_VW.maximizar();
  else if (a === "help") {
    const p = $("lgAyuda");
    p.hidden = !p.hidden;
    b.setAttribute("aria-expanded", !p.hidden);
  } else if (a === "plano") {
    const x = lgCircs().find(o => o.q.key === LG_KEY);
    if (!x || !x.q0) return;
    // Todo el recorrido hasta la más alejada y las salidas del circuito
    const ids = new Set(x.q0.sal.map(o => o.id));
    (x.q0.ruta || []).forEach(p => [p.t, p.o, p.id].forEach(id => id && ids.add(id)));
    lgVer([...ids]);
  }
});
$("lgCir").addEventListener("change", e => {
  LG_KEY = e.target.value;
  lgRender();
});
$("lgDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    verificarLongitudes(false);
  }
});
