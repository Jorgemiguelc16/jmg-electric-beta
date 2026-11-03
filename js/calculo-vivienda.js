/* CÁLCULO · VIVIENDA Y OTROS USOS
   calcUni(): vivienda unifamiliar (con sus pisos y tableros) y otros usos (oficinas, comercios, escuelas, hospitales,
   hoteles): máxima demanda, alimentadores, circuitos, balance, cortocircuito y puesta a tierra. Parte del motor de
   js/calculo.js. Con «Calcular con el diseño» (dato calPlano), los tableros dibujados en el plano dan sus circuitos,
   sus cargas especiales y la longitud de sus alimentadores (planoCalc, js/calculo-plano.js); los tableros que no están
   en el plano se calculan con los datos escritos, como siempre. */
function calcUni(c) {
  SFX = (P.SECF || {}).uni || {};
  const PS = pisosUni(),
    varios = PS.length > 1,
    esq = varios ? pv("esqPisos") : "tg";
  // Uso: vivienda (Regla 050-200) u otro uso de la Tabla 14 (Regla 050-210). En otros usos el área es la servida (sótano al 100 %),
  // no hay corriente mínima de 40 A y la carga del alimentador es continua (Regla 050-104(3)): corriente de diseño 1.25 × I.
  const viv = !USOS[c.uso],
    fSot = viv ? 0.75 : 1,
    ImV = viv ? IMIN_UNI : 0,
    fdV = viv ? c.fdA : FD;
  // Tablero de cada piso: TG si el piso se conecta al tablero general, TD-n si tiene tablero propio
  const tabDe = n => (!varios || (n === 1 && esq === "tg") ? "TG" : tabPiso(n));
  const pisoCarga = x => {
    const k = Math.round(+x.piso || 0);
    return varios && k >= 1 && k <= PS.length ? k : 0;
  };
  const tabCarga = x => {
    const k = pisoCarga(x);
    return k ? tabDe(k) : "TG";
  };
  // Diseño del plano: los tableros del cálculo que están dibujados (con circuitos) toman sus datos de allí
  const PLD =
      pv("calPlano") === "1" && P.PLANO
        ? planoCalc(P.PLANO, c, { al_p: pn("al_p"), tg_p: pn("tg_p"), tc_p: pn("tc_p"), hEnt: pn("hEnt") || 3.1 })
        : null,
    nomsCalc = new Set(["TG", ...PS.map(p => tabDe(p.n))]),
    PT_ = new Map(PLD ? PLD.tabs.filter(t => nomsCalc.has(t.nom) && t.circs.length).map(t => [t.nom, t]) : []);
  if (PLD)
    PLD.tabs
      .filter(t => !nomsCalc.has(t.nom))
      .forEach(t =>
        PLD.avisos.push({
          t: "aviso",
          m: `El tablero ${t.nom} del plano no está en el cálculo (${[...nomsCalc].join(", ")}): cambie su nombre o agregue su piso en Vivienda › Pisos y tableros`,
          ids: [t.id],
          k: "nom"
        })
      );
  const pisoDe = nom => (nom === "TG" ? 0 : (PS.find(p => tabDe(p.n) === nom) || { n: 0 }).n);
  if (PT_.size)
    PS.forEach(p => {
      const t = PT_.get(tabDe(p.n));
      if (!t || (p.n !== 1 && tabDe(p.n) === "TG")) return;
      // Salidas del piso según el plano (para la memoria): cantidad y la mayor longitud de cada tipo
      const de = k => {
        const q = t.circs.filter(x => x.tipo === k);
        return { n: q.reduce((s, x) => s + x.n, 0), L: q.reduce((m, x) => Math.max(m, x.L), 0) || 1 };
      };
      p.al = de("al");
      p.tg = de("tg");
      p.tc = de("tc");
      p.plano = true;
      const ru = PLD.rutas[tabDe(p.n)];
      if (ru && tabDe(p.n) !== "TG") {
        p.Ld = Math.max(ru.L, 0.5);
        p.LdPlano = true;
      }
    });
  // Áreas del plano (si están marcadas): vivienda, las techadas por dimensiones interiores (Regla 050-110); otros
  // usos, el contorno exterior (Regla 050-210). Cada piso con áreas toma la suya; los demás, las escritas.
  const AP = PLD && PLD.areas.length ? PLD.pisos : null,
    sumaA = k => Object.values(AP || {}).reduce((s, o) => s + o[k], 0);
  if (AP)
    PS.forEach(p => {
      const a = AP[p.n];
      if (!a || !(a.tech || a.ext || a.aulas)) return;
      if (viv) p.area = a.tech;
      else {
        p.area = a.ext || a.tech;
        if (!a.ext)
          PLD.avisos.push({
            t: "aviso",
            m: `${ORD(p.n)} piso: la Regla 050-210 pide el área por las dimensiones exteriores; marque el contorno exterior del piso (se usan las áreas interiores)`,
            ids: [],
            k: "area"
          });
      }
      if (a.aulas) p.aE = a.aulas;
      p.areaPlano = true;
    });
  const areaT = PS.reduce((s, p) => s + p.area, 0),
    sot = AP && sumaA("sot") > 0 ? sumaA("sot") : pn("sot"),
    area = areaT + fSot * sot,
    sk = pv("sist") || "mono220",
    rTG = PT_.size && PLD.rutas.TG,
    Lalim = rTG ? Math.max(rTG.L, 0.5) : pn("Lalim") || 1;
  // Cargas especiales: las escritas y, en los tableros del plano, las dibujadas (con la longitud de su circuito)
  const cs = P.cargas.filter(x => !PT_.has(tabCarga(x))).map(x => ({ ...x }));
  if (PT_.size)
    PLD.cargas
      .filter(x => PT_.has(x.tab))
      .forEach(x => {
        const q = PT_.get(x.tab).circs.find(k => k.cir === x.cir);
        cs.push({
          nombre: x.nombre,
          tipo: x.tipo,
          fases: x.fases,
          p: x.p,
          L: q ? q.L : 1,
          piso: pisoDe(x.tab),
          elec: x.elec,
          plano: { tab: x.tab, cir: x.cir, id: x.id }
        });
      });
  const mdDe = (a, list, aE = 0) =>
    viv ? mdVivienda({ area: a, ...cargasMD(list) }, false) : mdUso(c.uso, a, list, aE);
  // Áreas libres no techadas (patios, jardines, cocheras abiertas): carga unitaria elegida por el proyectista (p. ej. 5 W/m²), al 100 %;
  // no figura en el CNE, se suma a la máxima demanda general y a la del 1er piso cuando este tiene tablero propio
  const libre = (AP && sumaA("libre") > 0 ? sumaA("libre") : c.aLib) * c.wLib,
    conLib = m => (libre > 0 ? { ...m, libre, sinAire: m.sinAire + libre, MD: m.MD + libre } : { ...m, libre: 0 });
  const md = conLib(
    mdDe(
      area,
      cs,
      PS.reduce((s, p) => s + (p.aE || 0), 0)
    )
  );
  const pw = { al: pn("al_p"), tg: pn("tg_p"), tc: pn("tc_p") };
  // Luminarias de otra potencia de cada piso (con un solo piso, todas van al 1er piso)
  const exP = p =>
      lumsExtra(
        P.lums.filter(x => (varios ? Math.round(+x.piso || 1) : 1) === p.n),
        p.al.n,
        pw.al
      ),
    alX = p => {
      const e = exP(p);
      return e ? { n: p.al.n + e.n, mix: e.mix } : {};
    };
  const exPt = p =>
      lumsExtra(
        P.toms.filter(x => (varios ? Math.round(+x.piso || 1) : 1) === p.n),
        p.tg.n,
        pw.tg
      ),
    tgX = p => {
      const e = exPt(p);
      return e ? { n: p.tg.n + e.n, mix: e.mix } : {};
    };
  // Carga instalada: en los pisos del plano, la potencia de sus salidas (las cargas especiales están en cs)
  const CI =
    PS.reduce(
      (s, p) =>
        s +
        (p.plano
          ? PT_.get(tabDe(p.n)).circs.reduce((t, q) => t + q.sal.reduce((u, o) => u + (o.cl === "esp" ? 0 : o.p), 0), 0)
          : p.al.n * pw.al + (exP(p)?.P || 0) + p.tg.n * pw.tg + (exPt(p)?.P || 0) + p.tc.n * pw.tc),
      0
    ) +
    cs.reduce((s, x) => s + x.p, 0) +
    libre;
  const al = alimentador("Alimentador medidor → tablero general TG", md.MD, sk, Lalim, 0, DV_ALIM, c, {
    pKey: "MD",
    Imin: ImV,
    fd: fdV,
    viv
  });
  al.iccO = c.iccE;
  al.pdc = pdcPara(c.iccE, c.pdcMin);
  if (rTG) al.plano = { Lh: rTG.Lh, de: rTG.de };
  const iccTG = iccAbajo(c.iccE, al.s, al.L, al.S);
  const alims = [al],
    tabs = [
      {
        tab: "TG",
        desc: viv ? "Tablero general de la vivienda" : "Tablero general",
        feeder: 0,
        icc: iccTG,
        pdc: pdcPara(iccTG, c.pdcMin)
      }
    ];
  // Alimentadores TG → TD de cada piso: máxima demanda por la Regla 050-200 con el área del piso (el sótano, al 75 %, en el 1er piso)
  PS.forEach(p => {
    const tab = tabDe(p.n);
    if (tab === "TG") return;
    const aP = p.area + (p.n === 1 ? fSot * sot : 0),
      mdP0 = mdDe(
        aP,
        cs.filter(x => tabCarga(x) === tab),
        p.aE
      ),
      mdP = p.n === 1 ? conLib(mdP0) : mdP0;
    const f = alimentador(`Alimentador TG → ${tab} (${ORD(p.n)} piso)`, mdP.MD, sk, p.Ld, al.dVp, DV_ALIM - al.dVp, c, {
      pKey: "piso",
      piso: p.n,
      mdP,
      areaP: aP,
      fd: fdV,
      viv
    });
    f.iccO = iccTG;
    f.pdc = pdcPara(iccTG, c.pdcMin);
    if (p.LdPlano) f.plano = { Lh: PLD.rutas[tab].Lh, de: PLD.rutas[tab].de };
    alims.push(f);
    p.tab = tab;
    p.feeder = alims.length - 1;
    p.md = mdP;
    p.areaC = aP;
    const icc = iccAbajo(iccTG, f.s, f.L, f.S);
    tabs.push({
      tab,
      desc: `Tablero de distribución del ${ORD(p.n)} piso`,
      feeder: p.feeder,
      icc,
      pdc: pdcPara(icc, c.pdcMin),
      piso: p.n
    });
  });
  const circ = [];
  tabs.forEach(tb => {
    const f = alims[tb.feeder],
      up = tb.feeder ? f.dvAc : al.dVp;
    // Tablero del plano: sus circuitos, con el mismo nombre (C-1, C-2…), sus salidas y su recorrido
    const pt = PT_.get(tb.tab);
    if (pt) {
      pt.circs.forEach(q0 => {
        const esp = q0.tipo === "esp",
          cg = esp ? cs.filter(x => x.plano && x.plano.tab === tb.tab && x.plano.cir === q0.cir) : [],
          m = cg.reduce((a, x) => (!a || x.p > a.p ? x : a), null),
          q = circuito(
            {
              tab: tb.tab,
              id: q0.cir,
              desc: q0.desc || (esp ? (cg.length === 1 ? m.nombre : "Cargas especiales") : PL_DESC[q0.tipo]),
              tipo: esp ? TIPOS[m ? m.tipo : "otra"].split(" (")[0] : PL_TIPO[q0.tipo],
              n: q0.n,
              P: q0.P,
              L: q0.L,
              fases: q0.f3 ? 3 : 1,
              skTri: sk
            },
            { ...c, fa: fa5C(q0.ng), fc: c.ft * fa5C(q0.ng) },
            up,
            tb.feeder
          );
        q.src = { t: "plano", tab: pt.id, cir: q0.cir };
        q.grp = { n: q0.ng, fa: fa5C(q0.ng) };
        q.elec = q0.elec;
        q.plano = { lej: q0.lej, Lh: q0.Lh, Lv: q0.Lv, est: q0.est, Lmet: q0.Lmet, auto: q0.auto, ct: q0.tipo };
        circ.push(q);
      });
      return;
    }
    const PT = PS.filter(p => tabDe(p.n) === tb.tab);
    const src = (p, k) => (p.n === 1 ? { t: "grp", k } : { t: "piso", i: p.i, k });
    const list = grupos(
      PT.flatMap(p => [
        { ...p.al, p: pw.al, ...alX(p), desc: "Alumbrado", tipo: "Alumbrado", src: src(p, "al") },
        { ...p.tg, p: pw.tg, ...tgX(p), desc: "Tomacorrientes", tipo: "Tomacorriente", src: src(p, "tg") },
        { ...p.tc, p: pw.tc, desc: "Tomacorrientes cocina / lavandería", tipo: "Tomacorriente", src: src(p, "tc") }
      ]),
      c,
      tb.tab,
      up,
      tb.feeder
    );
    cs.forEach((x, ix) => {
      if (!(x.p > 0) || x.plano || tabCarga(x) !== tb.tab) return;
      const q = circuito(
        {
          tab: tb.tab,
          id: "C-" + (list.length + 1),
          desc: x.nombre || "Carga especial",
          tipo: TIPOS[x.tipo].split(" (")[0],
          n: 1,
          P: x.p,
          L: x.L || 1,
          fases: x.fases,
          skTri: sk
        },
        c,
        up,
        tb.feeder
      );
      q.src = { t: "cargas", i: ix };
      q.elec = !!+x.elec;
      list.push(q);
    });
    circ.push(...list);
  });
  const bal = balancear(circ, sk, (P.FIX || {}).uni);
  // Diferenciales de cada tablero, ya con la fase de cada circuito
  tabs.forEach(tb =>
    asignarID(
      circ.filter(q => q.tab === tb.tab),
      c
    )
  );
  return {
    mode: "uni",
    uso: viv ? "viv" : c.uso,
    viv,
    iccTG,
    c,
    sk,
    area,
    areaT,
    sot,
    cs,
    md,
    CI,
    alims,
    circ,
    tabs,
    bal,
    pat: pozo(c.pat),
    PS,
    varios,
    esq,
    contratada: Math.ceil(md.MD / 500) / 2,
    conexion: "Conexión simple (Norma DGE, 301.A)",
    // Con el diseño: los tableros que salen del plano, los alimentadores medidos en él y los avisos
    ...(PLD
      ? {
          plano: {
            tabs: [...PT_.keys()],
            ali: !!rTG,
            Ld: PS.filter(p => p.LdPlano).map(p => tabDe(p.n)),
            areas: PS.filter(p => p.areaPlano).map(p => p.n),
            sot: !!(AP && sumaA("sot") > 0),
            libre: !!(AP && sumaA("libre") > 0),
            avisos: PLD.avisos
          }
        }
      : {}),
    Selec: tierraElectrodo(al.Izc)
  };
}
