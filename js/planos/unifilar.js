/* DIAGRAMA UNIFILAR
   Dibuja el unifilar en SVG con el cuadro de cargas y el rótulo, y lo convierte a PNG y DXF (AutoCAD). Dos formas:
   horizontal (por defecto: barra horizontal y circuitos hacia abajo) y vertical (opción de la cinta Planos: cada
   tablero es una columna con su barra vertical y un circuito por fila, con sus datos en texto horizontal). */
let UNIF_VERTICAL = false;
try {
  UNIF_VERTICAL = localStorage.getItem("jmg-electric-unif-vertical") === "1";
} catch (e) {}
function unifilar(r, op = {}) {
  // Una lámina: sus tableros (todos, o los que le tocan cuando el plano se divide), si lleva la acometida con el
  // cuadro de cargas (la primera) y su número
  const TABS = op.tabs || r.tabs,
    CAB = op.cab !== false,
    HOJA = op.hoja || "IE-01";
  const c = r.c,
    o = [],
    a0 = r.alims[0],
    s0 = a0.s,
    multi = r.mode === "multi",
    // Edificio: el tramo TG → banco de medidores (si el banco no está junto al TG) y los suministros del banco
    aBM = multi ? r.alims.find(a => a.pKey === "bm") : null,
    suministros = r.alims.slice(1).filter(a => a.pKey !== "bm"),
    sinMedidor = f => f.pKey === "servP" && !!(r.topo && r.topo.tsgTG);
  const { INK, NAVY, CU, GR } = PAL,
    CW = 74;
  const L = (x1, y1, x2, y2, w = 1.3, col = INK, dash) =>
    o.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`
    );
  const T = (x, y, t, { s = 9, b = 0, a = "start", f = INK, rot = 0 } = {}) =>
    o.push(
      `<text x="${x}" y="${y}" font-size="${s}"${b ? ' font-weight="700"' : ""} text-anchor="${a}" fill="${f}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ""}>${esc(t)}</text>`
    );
  const dot = (x, y) => o.push(`<circle cx="${x}" cy="${y}" r="2.6" fill="${INK}"/>`);
  const arrow = (x, y) => o.push(`<path d="M${x - 4} ${y - 9}L${x + 4} ${y - 9}L${x} ${y}Z" fill="${INK}"/>`);
  const itm = (x, y) => {
    L(x - 3.5, y - 3.5, x + 3.5, y + 3.5);
    L(x + 3.5, y - 3.5, x - 3.5, y + 3.5);
    L(x, y + 24, x - 10, y + 3, 1.6);
  };
  const dif = (x, y) => {
    itm(x, y);
    L(x, y + 24, x, y + 40);
    o.push(`<ellipse cx="${x}" cy="${y + 32}" rx="9" ry="3.8" fill="none" stroke="${INK}" stroke-width="1.2"/>`);
  };
  // Contador de energía (Norma DGE 08-80-22): rectángulo dividido, con «Wh» en la parte inferior
  const kwh = (x, y) => {
    o.push(`<rect x="${x - 12}" y="${y}" width="24" height="28" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`);
    L(x - 12, y + 8, x + 12, y + 8, 1.2);
    T(x, y + 22.5, "Wh", { s: 8.5, b: 1, a: "middle" });
  };
  const tierra = (x, y) => {
    L(x - 11, y, x + 11, y, 1.6);
    L(x - 7, y + 4.5, x + 7, y + 4.5, 1.6);
    L(x - 3, y + 9, x + 3, y + 9, 1.6);
  };
  const wrap = (t, n) => {
    const out = [];
    let ln = "";
    String(t)
      .split(/\s+/)
      .forEach(w => {
        if ((ln + " " + w).trim().length > n && ln) {
          out.push(ln);
          ln = w;
        } else ln = (ln + " " + w).trim();
      });
    if (ln) out.push(ln);
    if (out.length > 3) {
      out.length = 3;
      out[2] = out[2].slice(0, n - 1) + "…";
    }
    return out;
  };
  const tub = t => (t.mm ? `Ø${t.mm} mm` : t.pul);
  const cond = (n, S, St) => `${n}-1×${S} + 1×${St}(T) mm²${c.desig ? " " + c.desig : ""}`;

  // Tablero con sus circuitos derivados
  function panel(X, Y, tb, { entrada = true, pat = false } = {}) {
    // Circuitos en el orden de sus diferenciales: cada grupo junto, aunque su numeración no sea seguida (los
    // diferenciales se agrupan por fase)
    const gk = q => (c.idMode === "circuito" ? q.key : q.idName),
      cs0 = r.circ.filter(q => q.tab === tb.tab),
      pos = {};
    cs0.forEach((q, i) => {
      if (!(gk(q) in pos)) pos[gk(q)] = i;
    });
    const f = r.alims[tb.feeder],
      cs = cs0.slice().sort((p, q) => pos[gk(p)] - pos[gk(q)]),
      nres = c.reserva,
      col0 = X + 96,
      eqs = equiposDe(r, tb.tab),
      // Equipos que no van entre la barra y tierra (el DPS sí): franja propia sobre la barra
      eqx = eqs.filter(([k]) => k !== "dps"),
      yb = Y + 46 + (eqx.length ? 54 : 0);
    const fd = r.mode === "uni" && tb.tab === "TG" ? r.alims.slice(1) : [];
    const ncol = cs.length + fd.length + nres,
      xe = col0 + (ncol - 1) * CW + 26;
    T(X + 60, Y + 14, `TABLERO ${tb.tab}`, { s: 11.5, b: 1, f: NAVY });
    T(
      X + 60,
      Y + 28,
      `${tb.desc} · Icc ≈ ${fmt(tb.icc, 2)} kA · PdC mín. ${tb.pdc} kA${eqs.length ? ` · Equipos: ${eqs.map(([, d]) => d.c).join(", ")}` : ""}`,
      {
        s: 8.5,
        f: GR
      }
    );

    if (entrada) {
      o.push(`<circle cx="${X + 40}" cy="${Y + 6}" r="3" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`);
      L(X + 40, Y + 9, X + 40, yb);
      T(
        X + 48,
        Y + 40,
        `Llega: ${cond(f.s.n, f.S, f.St)} Cu · ${tub(f.tubo)} · ITM ${f.s.tri ? 3 : 2}×${f.itm} A en ${r.mode === "uni" && tb.feeder > 0 ? "tablero TG" : tb.tab === "TSG" && r.topo && r.topo.tsgTG ? "tablero TG" : tb.tab === "TSG" || r.mode === "multi" ? "banco de medidores" : "medidor"}`,
        { s: 7.5, f: GR }
      );
    }
    // Equipos del tablero con su símbolo de la Norma DGE
    if (eqx.length) {
      const ye = Y + 50,
        ex = X + 76,
        wE = 158;
      o.push(
        `<rect x="${ex}" y="${ye}" width="${eqx.length * wE + 8}" height="46" fill="none" stroke="${GR}" stroke-width="0.8" stroke-dasharray="4 3"/>`
      );
      T(ex + 6, ye + 10, "EQUIPOS DEL TABLERO", { s: 6.8, b: 1, f: GR });
      const EQS = {
        rel: ["Relé de tensión", "07-73-01"],
        med: ["Medidor de energía", "08-80-22"],
        ctr: ["Contactor con reloj", "07-72-18 · 08-80-40"]
      };
      eqx.forEach(([k], i) => {
        const sx = ex + 22 + i * wE,
          sy = ye + 29,
          [nom, cod] = EQS[k] || [k, ""];
        if (k === "ctr") {
          simboloDGE(o, "ctr", sx, sy, 1);
          simboloDGE(o, "reloj", sx + 16, sy, 0.85);
        } else simboloDGE(o, k, sx, sy, 1.1);
        const tx = sx + (k === "ctr" ? 30 : 18);
        T(tx, sy - 1, nom, { s: 7.6, b: 1 });
        T(tx, sy + 9, cod, { s: 6.8, f: GR });
      });
    }
    L(X + 14, yb, xe, yb, 4, CU);
    // Barra / puesta a tierra
    L(X + 14, yb, X + 14, yb + 232, 1.2, "#2f7a4b", "5 3");
    tierra(X + 14, yb + 232);
    T(X + 8, yb + 222, pat ? `PAT · 1×${r.Selec} mm² Cu · R ≤ 25 Ω` : `Barra de tierra · 1×${f.St} mm² Cu`, {
      s: 7.5,
      f: "#2f7a4b",
      rot: -90
    });
    // DPS del tablero: entre la barra y tierra (los demás equipos se nombran bajo el título del tablero)
    if (eqs.length) {
      if (eqs.some(([k]) => k === "dps")) {
        const xd = X + 58;
        L(xd, yb, xd, yb + 18);
        o.push(
          `<rect x="${xd - 9}" y="${yb + 18}" width="18" height="26" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`
        );
        // Pararrayos (Norma DGE 07-75-23): rectángulo con flecha
        L(xd, yb + 18, xd, yb + 34, 1.2);
        o.push(`<path d="M${xd - 4} ${yb + 33}L${xd + 4} ${yb + 33}L${xd} ${yb + 40}Z" fill="${INK}"/>`);
        L(xd, yb + 44, xd, yb + 58, 1.2, "#2f7a4b", "5 3");
        tierra(xd, yb + 58);
        T(xd + 12, yb + 34, "DPS", { s: 7.5, b: 1, f: INK });
      }
    }
    // Agrupación de diferenciales
    const grp = [];
    cs.forEach((q, i) => {
      const key = c.idMode === "circuito" ? "c" + i : q.idName;
      const g = grp[grp.length - 1];
      if (g && g.key === key) g.items.push(i);
      else grp.push({ key, items: [i] });
    });
    const X_ = i => col0 + i * CW;
    grp.forEach(g => {
      const xs = g.items.map(X_),
        xc = (xs[0] + xs[xs.length - 1]) / 2,
        q0 = cs[g.items[0]];
      const pol = g.items.some(i => cs[i].f3) ? 4 : 2;
      dot(xc, yb);
      L(xc, yb, xc, yb + 14);
      dif(xc, yb + 14);
      L(xc, yb + 54, xc, yb + 66);
      T(xc + 12, yb + 30, q0.idName, { s: 8, b: 1 });
      T(xc + 12, yb + 40, `${pol}×${q0.idRat} A`, { s: 7.5 });
      T(xc + 12, yb + 50, `30 mA · tipo ${q0.idTipo || "A"}`, { s: 7.5, f: GR });
      if (xs.length > 1) {
        L(xs[0], yb + 66, xs[xs.length - 1], yb + 66, 2);
        xs.forEach(x => dot(x, yb + 66));
      }
      xs.forEach(x => L(x, yb + 66, x, yb + 76));
    });
    for (let j = 0; j < ncol; j++) {
      const x = X_(j),
        q = cs[j],
        a = j >= cs.length ? fd[j - cs.length] : null,
        res = !q && !a;
      if (res || a) {
        dot(x, yb);
        L(x, yb, x, yb + 76);
      }
      itm(x, yb + 76);
      L(x, yb + 100, x, yb + 282, 1.3, res ? GR : INK, res ? "4 3" : null);
      arrow(x, yb + 292);
      if (res) {
        T(x + 12, yb + 92, "ITM", { s: 8, f: GR });
        T(x - 5, yb + 276, "Reserva equipada", { s: 8, f: GR, rot: -90 });
        T(x, yb + 308, `${tb.tab === "TSG" ? "S-" : "C-"}${j - fd.length + 1}`, { s: 9.5, b: 1, a: "middle", f: GR });
        T(x, yb + 322, "Reserva", { s: 8, a: "middle", f: GR });
        continue;
      }
      if (a) {
        const td = r.tabs.find(t => t.feeder === r.alims.indexOf(a));
        T(x + 12, yb + 92, `${a.s.tri ? 3 : 2}×${a.itm ?? "—"} A`, { s: 8, b: 1 });
        T(x - 5, yb + 276, `${cond(a.s.n, a.S, a.St)} · ${tub(a.tubo)}`, { s: 7.5, rot: -90 });
        T(x + 12, yb + 276, `I ${fmt(a.I, 1)} A · ΔV ${fmt(a.dVp, 2)} % · L ${fmt(a.L, 0)} m`, {
          s: 7.5,
          f: GR,
          rot: -90
        });
        T(x, yb + 308, td.tab, { s: 9.5, b: 1, a: "middle", f: CU });
        T(x, yb + 321, "Alimentador", { s: 7.8, a: "middle" });
        T(x, yb + 331.5, `${ORD(td.piso)} piso`, { s: 7.8, a: "middle" });
        T(x, yb + 344, `${fmt(a.P, 0)} W`, { s: 7.5, a: "middle", f: GR });
        continue;
      }
      T(x + 12, yb + 92, `${q.f3 ? 3 : 2}×${q.itm ?? "—"} A ${q.curva}`, { s: 8, b: 1 });
      T(x - 5, yb + 276, `${cond(q.f3 ? 3 : 2, q.S, q.St)} · ${tub(q.tubo)}`, { s: 7.5, rot: -90 });
      T(x + 12, yb + 276, `I ${fmt(q.I, 1)} A · ΔV ${fmt(q.dVp, 2)} %`, { s: 7.5, f: GR, rot: -90 });
      T(x, yb + 308, q.id, { s: 9.5, b: 1, a: "middle", f: NAVY });
      const ls = wrap(q.desc, 13);
      ls.forEach((t, i) => T(x, yb + 321 + i * 10.5, t, { s: 7.8, a: "middle" }));
      T(
        x,
        yb + 321 + ls.length * 10.5 + 2,
        `${fmt(q.P, 0)} W${r.bal && q.fase && q.fase !== "—" && q.fase !== "3φ" ? " · " + q.fase : ""}`,
        { s: 7.5, a: "middle", f: GR }
      );
    }
    return { w: Math.max(xe - X + 20, 560), h: yb - Y + 372 };
  }

  let W = 0,
    y = 0;
  const X = 20,
    x = X + 40;
  // Detalle de tableros en filas (tableros de departamento o de piso)
  function detalle(tabs) {
    if (!tabs.length) return;
    L(X, y, X + 10, y, 1, GR);
    T(X + 16, y + 4, "DETALLE DE TABLEROS", { s: 9, b: 1, f: GR });
    y += 24;
    const pw = tb => Math.max(96 + (r.circ.filter(q => q.tab === tb.tab).length + c.reserva - 1) * CW + 46, 560);
    const maxW = Math.max(W, 1400);
    let px = X,
      rowH = 0;
    tabs.forEach(tb => {
      const w = pw(tb);
      if (px > X && px + w > maxW) {
        y += rowH + 8;
        px = X;
        rowH = 0;
      }
      const p = panel(px, y, tb);
      W = Math.max(W, px + p.w);
      px += p.w + 16;
      rowH = Math.max(rowH, p.h);
    });
    y += rowH + 8;
  }
  /* ---------- Unifilar vertical ---------- */
  const CWV = 460,
    RHV = 30;
  // Interruptor automático y diferencial en horizontal (la corriente va de izquierda a derecha): contacto fijo con
  // aspa en x, pivote de la cuchilla en x + 24
  const itmH = (x, y) => {
    L(x - 3.5, y - 3.5, x + 3.5, y + 3.5);
    L(x + 3.5, y - 3.5, x - 3.5, y + 3.5);
    L(x + 24, y, x + 3, y - 10, 1.6);
  };
  const difH = (x, y) => {
    itmH(x, y);
    L(x + 24, y, x + 40, y);
    o.push(`<ellipse cx="${x + 32}" cy="${y}" rx="3.8" ry="9" fill="none" stroke="${INK}" stroke-width="1.2"/>`);
  };
  const flecha = (x, y) => o.push(`<path d="M${x - 9} ${y - 4}L${x - 9} ${y + 4}L${x} ${y}Z" fill="${INK}"/>`);
  // Alto de una columna (para ordenarlas antes de dibujar)
  const altoCol = tb => {
    const cs = r.circ.filter(q => q.tab === tb.tab),
      eqs = equiposDe(r, tb.tab),
      fd = r.mode === "uni" && tb.tab === "TG" ? r.alims.slice(1) : [];
    return (
      60 +
      (eqs.some(([k]) => k !== "dps") ? 54 : 0) +
      (eqs.some(([k]) => k === "dps") ? 52 : 0) +
      (fd.length + cs.length + c.reserva) * RHV +
      new Set(cs.map(q => (c.idMode === "circuito" ? q.key : q.idName))).size * 10 +
      70
    );
  };
  // Columna de un tablero: barra vertical en X0 + 40; diferenciales con su barra secundaria; un circuito por fila
  function columna(X0, Y0, tb, { entrada = true, pat = false } = {}) {
    const f = r.alims[tb.feeder],
      gk = q => (c.idMode === "circuito" ? q.key : q.idName),
      cs0 = r.circ.filter(q => q.tab === tb.tab),
      pos = {};
    cs0.forEach((q, i) => {
      if (!(gk(q) in pos)) pos[gk(q)] = i;
    });
    const cs = cs0.slice().sort((p, q) => pos[gk(p)] - pos[gk(q)]),
      eqs = equiposDe(r, tb.tab),
      eqx = eqs.filter(([k]) => k !== "dps"),
      fd = r.mode === "uni" && tb.tab === "TG" ? r.alims.slice(1) : [],
      xb = X0 + 40;
    T(X0 + 56, Y0 + 14, `TABLERO ${tb.tab}`, { s: 11.5, b: 1, f: NAVY });
    T(X0 + 56, Y0 + 27, `${tb.desc} · Icc ≈ ${fmt(tb.icc, 2)} kA · PdC mín. ${tb.pdc} kA`, { s: 7.8, f: GR });
    if (entrada)
      T(
        X0 + 56,
        Y0 + 39,
        `Llega: ${cond(f.s.n, f.S, f.St)} Cu · ${tub(f.tubo)} · ITM ${f.s.tri ? 3 : 2}×${f.itm} A en ${r.mode === "uni" && tb.feeder > 0 ? "tablero TG" : tb.tab === "TSG" && r.topo && r.topo.tsgTG ? "tablero TG" : tb.tab === "TSG" || r.mode === "multi" ? "banco de medidores" : "medidor"}`,
        { s: 7.2, f: GR }
      );
    let y = Y0 + 48;
    // Equipos del tablero con su símbolo de la Norma DGE
    if (eqx.length) {
      const wE = 140;
      o.push(
        `<rect x="${X0 + 56}" y="${y}" width="${Math.min(eqx.length * wE + 8, CWV - 70)}" height="46" fill="none" stroke="${GR}" stroke-width="0.8" stroke-dasharray="4 3"/>`
      );
      T(X0 + 62, y + 10, "EQUIPOS DEL TABLERO", { s: 6.8, b: 1, f: GR });
      const EQS = {
        rel: ["Relé de tensión", "07-73-01"],
        med: ["Medidor de energía", "08-80-22"],
        ctr: ["Contactor con reloj", "07-72-18 · 08-80-40"]
      };
      eqx.forEach(([k], i) => {
        const sx = X0 + 76 + i * wE,
          sy = y + 29,
          [nom, cd] = EQS[k] || [k, ""];
        if (k === "ctr") {
          simboloDGE(o, "ctr", sx, sy, 1);
          simboloDGE(o, "reloj", sx + 16, sy, 0.85);
        } else simboloDGE(o, k, sx, sy, 1.1);
        const tx = sx + (k === "ctr" ? 30 : 18);
        T(tx, sy - 1, nom, { s: 7.4, b: 1 });
        T(tx, sy + 9, cd, { s: 6.6, f: GR });
      });
      y += 54;
    }
    const yb0 = y;
    y += 16;
    // DPS: entre la barra y tierra
    if (eqs.some(([k]) => k === "dps")) {
      dot(xb, y);
      L(xb, y, xb + 50, y);
      L(xb + 50, y, xb + 50, y + 6);
      simboloDGE(o, "dps", xb + 50, y + 16, 1);
      L(xb + 50, y + 26, xb + 50, y + 32, 1.2, "#2f7a4b", "5 3");
      tierra(xb + 50, y + 32);
      T(xb + 64, y + 19, "DPS · protector contra sobretensiones", { s: 7.5, b: 1 });
      y += 52;
    }
    // Alimentadores de los demás tableros (TG de una vivienda)
    fd.forEach(a => {
      const td = r.tabs.find(t => t.feeder === r.alims.indexOf(a));
      dot(xb, y);
      L(xb, y, xb + 60, y);
      itmH(xb + 60, y);
      L(xb + 84, y, xb + 118, y);
      flecha(xb + 126, y);
      T(xb + 134, y - 2, `${td.tab} · alimentador del ${ORD(td.piso)} piso · ${a.s.tri ? 3 : 2}×${a.itm} A`, {
        s: 8,
        b: 1,
        f: CU
      });
      T(
        xb + 134,
        y + 9,
        `${cond(a.s.n, a.S, a.St)} · ${tub(a.tubo)} · I ${fmt(a.I, 1)} A · ΔV ${fmt(a.dVp, 2)} % · L ${fmt(a.L, 0)} m`,
        { s: 7, f: GR }
      );
      y += RHV;
    });
    // Diferenciales con sus circuitos
    const grupos = [];
    cs.forEach(q => {
      const g = grupos[grupos.length - 1];
      if (g && g.k === gk(q)) g.qs.push(q);
      else grupos.push({ k: gk(q), qs: [q] });
    });
    grupos.forEach(g => {
      const q0 = g.qs[0],
        pol = g.qs.some(q => q.f3) ? 4 : 2,
        xs = xb + 66;
      y += 10;
      T(xb + 8, y - 12, `${q0.idName} · ${pol}×${q0.idRat} A · 30 mA · tipo ${q0.idTipo || "A"}`, {
        s: 7,
        b: 1,
        f: NAVY
      });
      dot(xb, y);
      L(xb, y, xb + 12, y);
      difH(xb + 12, y);
      L(xb + 52, y, xs, y);
      if (g.qs.length > 1) L(xs, y, xs, y + (g.qs.length - 1) * RHV, 1.3);
      g.qs.forEach((q, i) => {
        const yq = y + i * RHV;
        if (i) dot(xs, yq);
        L(xs, yq, xs + 10, yq);
        itmH(xs + 10, yq);
        L(xs + 34, yq, xs + 58, yq);
        flecha(xs + 66, yq);
        T(xs + 74, yq - 2, `${q.id}  ${q.desc} · ${q.f3 ? 3 : 2}×${q.itm ?? "—"} A ${q.curva}`, {
          s: 8,
          b: 1,
          f: NAVY
        });
        T(
          xs + 74,
          yq + 9,
          `${cond(q.f3 ? 3 : 2, q.S, q.St)} · ${tub(q.tubo)} · I ${fmt(q.I, 1)} A · ΔV ${fmt(q.dVp, 2)} % · ${fmt(q.P, 0)} W${r.bal && q.fase && q.fase !== "—" && q.fase !== "3φ" ? " · " + q.fase : ""}`,
          { s: 7, f: GR }
        );
      });
      y += g.qs.length * RHV;
    });
    // Reservas equipadas
    for (let j = 0; j < c.reserva; j++) {
      dot(xb, y);
      L(xb, y, xb + 76, y, 1.3, GR, "4 3");
      itmH(xb + 76, y);
      L(xb + 100, y, xb + 124, y, 1.3, GR, "4 3");
      T(xb + 140, y + 3, `${tb.tab === "TSG" ? "S-" : "C-"}${cs.length + j + 1} · Reserva equipada · ITM 2×16 A C`, {
        s: 7.8,
        f: GR
      });
      y += RHV;
    }
    // Barra vertical del tablero y su puesta a tierra
    L(xb, yb0, xb, y, 4, CU);
    if (!entrada) L(xb, Y0 - 6, xb, yb0);
    L(xb, y, xb, y + 26, 1.2, "#2f7a4b", "5 3");
    tierra(xb, y + 26);
    T(xb + 16, y + 30, pat ? `PAT · 1×${r.Selec} mm² Cu · R ≤ 25 Ω` : `Barra de tierra · 1×${f.St} mm² Cu`, {
      s: 7.5,
      f: "#2f7a4b"
    });
    return { w: CWV, h: y + 44 - Y0 };
  }
  // Ordena bloques (ancho, alto) en filas: prueba de 1 a n bloques por fila y elige la proporción más cercana a la
  // de una lámina apaisada (1.41 : 1), contando el espacio del cuadro de cargas, la leyenda y el rótulo
  function ordenar(bloques, x0, y0) {
    const pone = n => {
      let px = x0,
        py = y0,
        fila = 0;
      bloques.forEach((b, i) => {
        if (i && i % n === 0) {
          py += fila + 16;
          px = x0;
          fila = 0;
        }
        b.x = px;
        b.y = py;
        px += b.w + 16;
        fila = Math.max(fila, b.h);
      });
      return { w: Math.max(780, ...bloques.map(b => b.x + b.w)), h: py + fila };
    };
    let mejor = 1,
      dif = Infinity;
    for (let n = 1; n <= bloques.length; n++) {
      const d = pone(n),
        e = Math.abs(Math.log((d.w + 20) / (d.h + 170) / 1.41));
      if (e < dif) {
        dif = e;
        mejor = n;
      }
    }
    return pone(mejor);
  }
  function cuerpoVertical() {
    if (!multi || !CAB) {
      // En la primera lámina de una vivienda, la columna del TG sigue a la acometida; las demás se ordenan a su lado
      const bl = TABS.map(tb => ({ tb, w: CWV, h: altoCol(tb) + 10, tg: CAB && !multi && tb === r.tabs[0] }));
      const dim = ordenar(bl, X, CAB ? 200 : 46);
      bl.forEach(b => columna(b.x, b.y, b.tb, b.tg ? { entrada: false, pat: true } : {}));
      W = dim.w + 20;
      y = dim.h + 8;
      return;
    }
    // Edificio: banco de medidores vertical (una fila por suministro) y luego las columnas de los tableros
    const feeders = suministros,
      RB = 46,
      hb = 70 + feeders.length * RB;
    const bl = [{ banco: 1, w: CWV, h: hb + 10 }, ...TABS.map(tb => ({ tb, w: CWV, h: altoCol(tb) + 10 }))];
    const dim = ordenar(bl, X, 200);
    const b0 = bl[0],
      xb = x;
    T(xb + 20, b0.y + 14, "BANCO DE MEDIDORES · BARRA GENERAL", { s: 11.5, b: 1, f: NAVY });
    T(xb + 20, b0.y + 28, `Icc ≈ ${fmt(r.iccTG, 2)} kA · PdC mín. ${pdcPara(r.iccTG, r.c.pdcMin)} kA`, {
      s: 8.5,
      f: GR
    });
    const yb = b0.y + 46;
    L(xb, 246, xb, yb, 1.3);
    L(xb, yb, xb, yb + feeders.length * RB, 4, CU);
    feeders.forEach((f, i) => {
      const yf = yb + 22 + i * RB,
        tb = r.tabs.find(t => t.feeder === r.alims.indexOf(f)),
        cant = f.cant || 1;
      dot(xb, yf);
      L(xb, yf, xb + 28, yf);
      // El TSG directo desde el TG no tiene medidor en el banco
      if (sinMedidor(f)) L(xb + 28, yf, xb + 56, yf);
      else {
        o.push(
          `<rect x="${xb + 28}" y="${yf - 12}" width="28" height="24" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`
        );
        L(xb + 34, yf - 12, xb + 34, yf + 12, 1.2);
        T(xb + 45, yf + 3.5, "Wh", { s: 7.5, b: 1, a: "middle" });
      }
      L(xb + 56, yf, xb + 70, yf);
      itmH(xb + 70, yf);
      L(xb + 94, yf, xb + 126, yf);
      flecha(xb + 134, yf);
      T(
        xb + 142,
        yf - 2,
        `${tb ? tb.tab : ""} · ${f.pKey === "servP" ? `Servicios generales${sinMedidor(f) ? " (desde el TG)" : ""}` : `${r.T[f.ti].nombre} · ${cant} unidad${cant > 1 ? "es" : ""}`}`,
        { s: 8.5, b: 1, f: NAVY }
      );
      T(
        xb + 142,
        yf + 10,
        `${cant > 1 ? `Wh × ${cant} · ` : ""}${f.s.tri ? 3 : 2}×${f.itm} A · ${cond(f.s.n, f.S, f.St)} · L ${fmt(f.L, 0)} m · ΔV ${fmt(f.dVp, 2)} %`,
        { s: 7.2, f: GR }
      );
    });
    L(xb, yb + feeders.length * RB, xb, yb + feeders.length * RB + 22, 1.2, "#2f7a4b", "5 3");
    tierra(xb, yb + feeders.length * RB + 22);
    T(xb + 16, yb + feeders.length * RB + 26, `PAT · 1×${r.Selec} mm² Cu · R ≤ 25 Ω`, { s: 7.5, f: "#2f7a4b" });
    bl.slice(1).forEach(b => columna(b.x, b.y, b.tb));
    W = dim.w + 20;
    y = dim.h + 8;
  }
  // Acometida y alimentador principal (primera lámina); en las demás, el título de continuación
  if (!CAB) {
    T(X, 26, `DIAGRAMA UNIFILAR · DETALLE DE TABLEROS (continuación de la lámina IE-01)`, { s: 11, b: 1, f: NAVY });
  } else {
    L(x - 12, 14, x + 12, 14, 3);
    L(x, 14, x, 64);
    T(x + 16, 22, "RED DE DISTRIBUCIÓN SECUNDARIA", { s: 10, b: 1, f: NAVY });
    T(x + 16, 35, `${s0.nom} · 60 Hz · Icc en el punto de entrega ${fmt(c.iccE, 1)} kA`, { s: 8.5, f: GR });
    T(x + 16, 56, `Acometida · ${r.conexion}`, { s: 8.5 });
    if (!multi) {
      kwh(x, 64);
      T(x + 20, 82, "Medidor de energía activa", { s: 8.5 });
      L(x, 92, x, 110);
    } else L(x, 64, x, 110);
    itm(x, 110);
    L(x, 134, x, 246);
    T(x + 20, 126, `Interruptor general ${s0.tri ? 3 : 2}×${a0.itm} A · PdC ${a0.pdc} kA`, { s: 9, b: 1 });
    T(x + 16, 162, `Alimentador ${multi ? "general" : "principal"}: ${cond(s0.n, a0.S, a0.St)} Cu · ${tub(a0.tubo)}`, {
      s: 8.5,
      b: 1
    });
    T(x + 16, 175, `L = ${fmt(a0.L, 1)} m · I = ${fmt(a0.I, 2)} A · ΔV = ${fmt(a0.dVp, 2)} %`, { s: 8.5, f: GR });
    // Banco de medidores lejos del TG: el tramo TG → banco
    if (aBM) {
      T(
        x + 16,
        187,
        `TG → banco de medidores: ${cond(aBM.s.n, aBM.S, aBM.St)} Cu · ${tub(aBM.tubo)} · ITM ${aBM.s.tri ? 3 : 2}×${aBM.itm} A`,
        {
          s: 8.5,
          b: 1
        }
      );
      T(x + 16, 198, `L = ${fmt(aBM.L, 1)} m · I = ${fmt(aBM.I, 2)} A · ΔV = ${fmt(aBM.dVp, 2)} %`, { s: 8.5, f: GR });
    }
  }

  if (UNIF_VERTICAL) cuerpoVertical();
  else if (!CAB) {
    y = 46;
    detalle(TABS);
  } else if (!multi) {
    const p = panel(X, 200, r.tabs[0], { entrada: false, pat: true });
    W = p.w + X;
    y = 200 + p.h;
    if (TABS.length > 1) {
      y += 8;
      detalle(TABS.slice(1));
    }
  } else {
    const yb = 246,
      feeders = suministros,
      CF = 200;
    T(x + 20, 214, "BANCO DE MEDIDORES · BARRA GENERAL", { s: 11.5, b: 1, f: NAVY });
    T(
      x + 20,
      228,
      `Icc ≈ ${fmt(r.iccTG, 2)} kA · PdC mín. ${pdcPara(r.iccTG, r.c.pdcMin)} kA${r.tgbm ? ` · del TG al banco: ${r.tgbm.tubos.length > 1 ? r.tgbm.tubos.length + " tuberías " : ""}${[...new Set(r.tgbm.tubos.map(t => `Ø${t.mm || t.pul} mm`))].join(" y ")} con ${r.tgbm.n} conductores` : ""}`,
      { s: 8.5, f: GR }
    );
    const xe = X + 170 + (feeders.length - 1) * CF + 40;
    L(X + 14, yb, xe, yb, 4, CU);
    L(X + 14, yb, X + 14, yb + 180, 1.2, "#2f7a4b", "5 3");
    tierra(X + 14, yb + 180);
    T(X + 8, yb + 172, `PAT · 1×${r.Selec} mm² Cu · R ≤ 25 Ω`, { s: 7.5, f: "#2f7a4b", rot: -90 });
    feeders.forEach((f, i) => {
      const fx = X + 170 + i * CF,
        tb = r.tabs.find(t => t.feeder === r.alims.indexOf(f)),
        cant = f.cant || 1;
      dot(fx, yb);
      L(fx, yb, fx, yb + 16);
      if (sinMedidor(f)) {
        L(fx, yb + 16, fx, yb + 44);
        T(fx + 20, yb + 34, "desde el TG (sin medidor)", { s: 8, f: GR });
      } else {
        kwh(fx, yb + 16);
        T(fx + 20, yb + 34, cant > 1 ? `kWh × ${cant}` : "kWh", { s: 8.5 });
      }
      L(fx, yb + 44, fx, yb + 60);
      itm(fx, yb + 60);
      T(fx + 12, yb + 76, `${f.s.tri ? 3 : 2}×${f.itm} A`, { s: 8.5, b: 1 });
      L(fx, yb + 84, fx, yb + 196);
      arrow(fx, yb + 206);
      T(fx + 8, yb + 116, cond(f.s.n, f.S, f.St), { s: 8, b: 1 });
      T(fx + 8, yb + 128, `Cu · ${tub(f.tubo)} · L ${fmt(f.L, 0)} m`, { s: 8, f: GR });
      T(fx + 8, yb + 140, `I ${fmt(f.I, 1)} A · ΔV ${fmt(f.dVp, 2)} %`, { s: 8, f: GR });
      o.push(
        `<rect x="${fx - 72}" y="${yb + 208}" width="144" height="40" fill="#f3f6f9" stroke="${NAVY}" stroke-width="1.3"/>`
      );
      T(fx, yb + 225, tb ? tb.tab : "", { s: 11, b: 1, a: "middle", f: NAVY });
      T(
        fx,
        yb + 240,
        f.pKey === "servP" ? "Servicios generales" : `${r.T[f.ti].nombre} · ${cant} unidad${cant > 1 ? "es" : ""}`,
        { s: 8, a: "middle", f: GR }
      );
    });
    W = xe + 40;
    y = yb + 270;
    detalle(TABS);
  }
  W = Math.max(W, 780);
  // Cuadro de datos (EM.010, Art. 8)
  const md = multi ? r.MD : r.md.MD;
  const datos = [
    ["Potencia instalada", `${fmt(r.CI / 1000, 2)} kW`],
    ["Máxima demanda", `${fmt(md / 1000, 2)} kW`],
    ["Potencia a contratar", `${fmt(r.contratada, 1)} kW`],
    ["Tensión / sistema", `${s0.txt} · 60 Hz`],
    ["Número de fases", s0.tri ? (s0.n === 4 ? "3 (3F + N + PE)" : "3 (3F + PE)") : "1 (F + N + PE)"],
    ["Capacidad de ruptura general", `${a0.pdc} kA`],
    ...(multi ? [["Suministros", `${r.units.length} dptos. + servicios generales`]] : [])
  ];
  const bx = W - 300,
    bw = 280,
    rh = 17;
  if (CAB) o.push(`<rect x="${bx}" y="10" width="${bw}" height="${rh}" fill="${NAVY}"/>`);
  if (CAB) T(bx + bw / 2, 22, "CUADRO DE CARGAS · EM.010, ART. 8", { s: 8.5, b: 1, a: "middle", f: "#fff" });
  (CAB ? datos : []).forEach(([k, v], i) => {
    const yy = 10 + rh * (i + 1);
    o.push(
      `<rect x="${bx}" y="${yy}" width="${bw}" height="${rh}" fill="${i % 2 ? "#fff" : "#f3f6f9"}" stroke="#bfc8d2" stroke-width=".8"/>`
    );
    T(bx + 8, yy + 12, k, { s: 8.2, f: GR });
    T(bx + bw - 8, yy + 12, v, { s: 8.5, b: 1, a: "end" });
  });
  // Leyenda y rótulo
  // Equipos marcados en algún tablero: se agregan a la leyenda con su símbolo y código DGE
  const conEq = new Set(TABS.flatMap(t => equiposDe(r, t.tab).map(([k]) => k))),
    ext = [
      conEq.has("dps") && ["dps", "Protector contra sobretensiones (DPS)", "07-75-23"],
      conEq.has("rel") && ["rel", "Relé de tensión (U> U<)", "07-73-01"],
      conEq.has("ctr") && ["ctr", "Contactor", "07-72-18"],
      conEq.has("ctr") && ["reloj", "Reloj horario", "08-80-40"]
    ].filter(Boolean);
  const yr = y + 10,
    hr = 124 + Math.ceil(ext.length / 2) * 32;
  o.push(`<rect x="${X}" y="${yr}" width="330" height="${hr}" fill="none" stroke="${NAVY}" stroke-width="1"/>`);
  T(X + 10, yr + 16, "LEYENDA", { s: 9, b: 1, f: NAVY });
  {
    const lx = X + 24;
    let ly = yr + 30;
    L(lx, ly - 4, lx, ly);
    itm(lx, ly);
    L(lx, ly + 24, lx, ly + 28);
    T(lx + 22, ly + 13, "Interruptor termomagnético (ITM)", { s: 8 });
    T(lx + 22, ly + 23, "07-72-21", { s: 6.8, f: GR });
    const lx2 = X + 180;
    L(lx2, ly - 4, lx2, ly);
    dif(lx2, ly);
    T(lx2 + 22, ly + 13, "Interruptor diferencial 30 mA", { s: 8 });
    T(lx2 + 22, ly + 23, "07-72-17", { s: 6.8, f: GR });
    ly += 46;
    kwh(lx, ly - 4);
    T(lx + 22, ly + 9, "Medidor de energía", { s: 8 });
    T(lx + 22, ly + 19, "08-80-22", { s: 6.8, f: GR });
    tierra(lx2, ly + 4);
    T(lx2 + 22, ly + 9, "Puesta a tierra", { s: 8 });
    T(lx2 + 22, ly + 19, "03-31-44", { s: 6.8, f: GR });
    L(lx - 12, ly + 34, lx + 12, ly + 34, 4, CU);
    T(lx + 22, ly + 37, "Barra de tablero", { s: 8 });
    L(lx2 - 12, ly + 34, lx2 + 12, ly + 34, 1.3, GR, "4 3");
    T(lx2 + 22, ly + 37, "Circuito de reserva", { s: 8 });
    // Equipos del tablero, en dos columnas
    ext.forEach(([k, d, cd], i) => {
      const ex = i % 2 ? lx2 : lx,
        ey = yr + 140 + Math.floor(i / 2) * 32;
      simboloDGE(o, k, ex, ey, k === "rel" || k === "reloj" ? 1 : 1.1);
      T(ex + 22, ey - 1, d.length > 30 ? d.slice(0, d.indexOf(" (")) || d : d, { s: 8 });
      T(ex + 22, ey + 9, cd, { s: 6.8, f: GR });
    });
  }
  const rx = Math.max(X + 350, W - 480),
    rw = W - 20 - rx;
  rotuloSvg(
    o,
    rx,
    yr + hr - 124,
    rw,
    124,
    c.proj,
    `Unifilar ${multi ? "multifamiliar" : "unifamiliar"} · Escala S/E`,
    HOJA + (op.parte ? " · " + op.parte : "")
  );
  if (op.sigue) T(X, yr - 6, `Continúa en la lámina ${op.sigue}`, { s: 8, b: 1, f: CU });
  const H = yr + hr + 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/><rect x="6" y="4" width="${W - 12}" height="${H - 10}" fill="none" stroke="${NAVY}" stroke-width="1.5"/>${o.join("")}</svg>`;
  return { svg, W, H };
}
/* Láminas del unifilar: la primera (IE-01) lleva la acometida, el medidor o el banco de medidores, el alimentador
   general y, en una vivienda, el tablero general; los demás tableros entran mientras el texto más pequeño del dibujo
   (7 px) siga midiendo al menos 1.8 mm impreso en la lámina elegida (la menor altura de la norma ISO 3098 de
   rotulado técnico, adoptada como criterio); los que no caben pasan a IE-01A, IE-01B… */
const TXT_MIN_MM = 1.8;
const laminaPlano = () => {
  try {
    const l = JSON.parse(localStorage.getItem("jmg-electric-dxf") || "{}").lamina;
    if (LAMINAS[l]) return l;
  } catch (e) {}
  return "A3";
};
function unifilarHojas(r, lam = laminaPlano()) {
  const [lw, lh] = LAMINAS[lam] || LAMINAS.A3,
    cabe = u => Math.min((lw - 20) / u.W, (lh - 20) / u.H) * 7 * 0.72 >= TXT_MIN_MM - 1e-9,
    hojas = [];
  let act = r.mode === "uni" ? [r.tabs[0]] : [],
    cab = true;
  (r.mode === "uni" ? r.tabs.slice(1) : r.tabs).forEach(tb => {
    const prueba = [...act, tb];
    if (cabe(unifilar(r, { tabs: prueba, cab })) || (!act.length && !cab)) act = prueba;
    else {
      hojas.push({ tabs: act, cab });
      act = [tb];
      cab = false;
    }
  });
  hojas.push({ tabs: act, cab });
  const n = hojas.length,
    nom = i => (i ? "IE-01" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i - 1] : "IE-01");
  return hojas
    .map((h, i) => ({
      ...unifilar(r, {
        tabs: h.tabs,
        cab: h.cab,
        hoja: nom(i),
        parte: n > 1 ? `${i + 1}/${n}` : "",
        sigue: i < n - 1 ? nom(i + 1) : ""
      }),
      hoja: nom(i),
      lam
    }))
    .map(h => ({ ...h, mm: Math.min((lw - 20) / h.W, (lh - 20) / h.H) * 7 * 0.72 }));
}
function cardUnifilar(r, nro) {
  const hs = unifilarHojas(r),
    chicas = hs.filter(h => h.mm < TXT_MIN_MM - 1e-9),
    u = { svg: hs.map(h => h.svg).join('</div><div class="unif">') };
  return `<section class="card"><h2><span><span class="num">${nro}</span>Diagrama unifilar</span></h2>
  <div class="unif">${u.svg}</div><div class="body"><p class="hint">Generado automáticamente a partir del cálculo: protecciones, conductores, diferenciales, puesta a tierra y cuadro de cargas exigido por la EM.010 (Art. 8). Se incluye también en la memoria de Excel.${hs.length > 1 ? ` Dividido en ${hs.length} láminas (${hs.map(h => h.hoja).join(", ")})${chicas.length ? "." : " "}${chicas.length ? "" : `para que, impreso en ${hs[0].lam}, ningún texto quede menor de 1.8 mm; la lámina se elige en Planos.`}` : ""}${chicas.length ? ` <strong>Impreso en ${hs[0].lam}, el texto quedaría menor de 1.8 mm (${chicas.map(h => `${h.hoja}: ${fmt(h.mm, 1)} mm`).join(", ")}): elija una lámina más grande en Planos.</strong>` : ""}</p></div></section>`;
}

// Casilla de la cinta (Planos › Unifilar vertical): cambia el dibujo en pantalla y en las descargas
{
  const ck = typeof document !== "undefined" && document.getElementById("optUnifV");
  if (ck && ck.addEventListener) {
    ck.checked = UNIF_VERTICAL;
    ck.addEventListener("change", () => {
      UNIF_VERTICAL = ck.checked;
      try {
        localStorage.setItem("jmg-electric-unif-vertical", UNIF_VERTICAL ? "1" : "0");
      } catch (e) {}
      if (LAST) render(LAST);
    });
  }
}

// Lámina del plano (Planos › Lámina): divide el unifilar en pantalla y en las descargas; es la misma de la ventana DXF
{
  const sl = typeof document !== "undefined" && document.getElementById("optLamina");
  if (sl && sl.addEventListener) {
    sl.value = laminaPlano();
    sl.addEventListener("change", () => {
      try {
        const o = JSON.parse(localStorage.getItem("jmg-electric-dxf") || "{}");
        o.lamina = sl.value;
        localStorage.setItem("jmg-electric-dxf", JSON.stringify(o));
      } catch (e) {}
      if (LAST) render(LAST);
    });
  }
}
