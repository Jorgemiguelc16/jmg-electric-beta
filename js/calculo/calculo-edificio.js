/* CÁLCULO · EDIFICIO MULTIFAMILIAR
   calcMulti(): máxima demanda del edificio (Regla 050-202), alimentador general, de servicios generales y de cada
   departamento, circuitos, balance de los suministros entre fases, cortocircuito y puesta a tierra. Parte del motor
   de js/calculo/calculo.js. Con «Calcular con el diseño» (dato calPlano), el plano da la longitud del alimentador general
   (del medidor o banco de medidores al TG), la del tablero de servicios generales (del TG al TSG) y, por cada tipo de
   departamento (el elegido en la ventana de sus tableros), la del alimentador desde el banco de medidores, las salidas
   de alumbrado y tomacorrientes y la longitud de sus circuitos (planoCalc, js/calculo/calculo-plano.js). */
/* Diámetro máximo de cada tubería entre el TG y el banco de medidores: criterio del proyectista (dato tgbmMax), por
   defecto 2" (50 mm) */
const TGBM_MAX = 50;
/* Uso de un tipo de unidad del edificio: vivienda (Regla 050-202) o un local de otro uso de la Tabla 14 (Regla
   050-210), por ejemplo un local comercial o una discoteca con su propio medidor en el banco. Devuelve la clave del
   uso de la Tabla 14 o null (vivienda). Escuelas, hospitales y hoteles (Reglas 050-204 a 050-208) no son unidades. */
const usoTipo = t => (t && t.uso && USOS[t.uso] && !USOS[t.uso].regla ? t.uso : null);
/* Conductores del TG al banco de medidores (banco junto al TG): por cada suministro, sus fases y su neutro con la
   sección de su alimentador, sin tierra (el medidor no la lleva). Se reparten en tuberías de hasta TGBM_MAX mm con el
   40 % de ocupación, los más grandes primero; cada tubería toma el menor diámetro que le alcanza. */
function tuberiasTGBanco(units, T, alims, aSG, sk, max = TGBM_MAX) {
  const area = S => (Math.PI * OD[S] ** 2) / 4,
    cap = di => (0.4 * Math.PI * di * di) / 4,
    sup = [];
  units.forEach(u => {
    const a = alims.find(x => x.pKey === "tipo" && x.ti === u.ti);
    if (!a) return;
    // Fases y neutros: trifásico, las tres y su neutro; monofásico, fase y neutro (380/220 V) o dos fases (220 V)
    const nf = a.s.tri ? 3 : sk === "tri380" ? 1 : 2,
      nn = a.s.tri ? a.s.n - 3 : sk === "tri380" ? 1 : 0;
    sup.push({ nom: u.ref, n: nf + nn, nf, nn, S: a.S, A: (nf + nn) * area(a.S) });
  });
  if (aSG) sup.push({ nom: "TSG", n: aSG.s.n, nf: 3, nn: aSG.s.n - 3, S: aSG.S, A: aSG.s.n * area(aSG.S) });
  if (!sup.length) return null;
  const tope = cap((TUBOS.find(t => t[0] === max) || TUBOS[TUBOS.length - 1])[2]),
    tubos = [];
  [...sup]
    .sort((a, b) => b.A - a.A)
    .forEach(s => {
      const t = tubos.find(x => x.A + s.A <= tope);
      if (t) {
        t.A += s.A;
        t.sup.push(s);
      } else tubos.push({ A: s.A, sup: [s] });
    });
  return {
    max,
    n: sup.reduce((x, s) => x + s.n, 0),
    nf: sup.reduce((x, s) => x + s.nf, 0),
    nn: sup.reduce((x, s) => x + s.nn, 0),
    tubos: tubos.map(t => {
      const tb = TUBOS.find(x => t.A <= cap(x[2]));
      return {
        mm: tb ? tb[0] : null,
        pul: tb ? tb[1] : '> 3"',
        n: t.sup.reduce((x, s) => x + s.n, 0),
        secc: [...new Set(t.sup.map(s => s.S))].sort((a, b) => a - b),
        ocup: tb ? (100 * t.A) / ((Math.PI * tb[2] * tb[2]) / 4) : null,
        sum: t.sup.length
      };
    })
  };
}
function calcMulti(c) {
  SFX = (P.SECF || {}).multi || {};
  const sk = pv("sistG") || "tri380",
    PLD =
      pv("calPlano") === "1" && P.PLANO
        ? planoCalc(P.PLANO, c, {
            al_p: c.pAl,
            tg_p: c.pTo,
            tc_p: c.pTo,
            hEnt: pn("hEnt") || 3.1,
            nTipos: P.tipos.length,
            tipo0: (P.tipos[0] || {}).nombre
          })
        : null,
    /* Esquema del edificio (criterio del proyectista): el banco de medidores junto al TG (por defecto: sin tramo
       entre ellos) o en otro lugar, con su alimentador TG → banco; y el TSG con su propio medidor en el banco (por
       defecto) o directo desde el TG */
    bmLejos = pv("bmJunto") === "0",
    tsgTG = pv("tsgDe") === "tg",
    rG = PLD && PLD.rutas.TG,
    rB = PLD && PLD.rutas.BM,
    // El TSG con medidor en el banco lejos del TG: su alimentador se mide desde el banco
    rS = PLD && (bmLejos && !tsgTG ? PLD.rutasBM.TSG : PLD.rutas.TSG),
    Lgen = rG ? Math.max(rG.L, 0.5) : pn("Lgen") || 1,
    Lbm = rB ? Math.max(rB.L, 0.5) : pn("Lbm") || 1,
    Lms = rS ? Math.max(rS.L, 0.5) : pn("Lms") || 1,
    // Tableros del plano de cada tipo de departamento: su alimentador más largo desde los medidores y sus salidas
    // (las del tablero con más salidas: los departamentos de un tipo son iguales) y su circuito más largo
    dPlano = i => {
      const tbs = PLD ? PLD.tabs.filter(t => t.dep === i && t.circs.length) : [];
      if (!tbs.length) return null;
      const n = (t, ks) => t.circs.filter(q => ks.includes(q.tipo)).reduce((s, q) => s + q.n, 0),
        Ls = tbs.map(t => PLD.desdeMed[t.id]).filter(Boolean),
        m = tbs.reduce((a, t) => (n(t, ["al", "tg", "tc"]) > n(a, ["al", "tg", "tc"]) ? t : a));
      const ce = PLD.cargas.filter(x => x.tabId === m.id);
      return {
        tb: m,
        ce,
        Pno: m.circs.reduce((s, q) => s + q.sal.reduce((u, o) => u + (o.cl === "esp" ? 0 : o.p), 0), 0),
        nAl: n(m, ["al"]),
        nTo: n(m, ["tg", "tc"]),
        Lc: Math.max(0.5, ...tbs.flatMap(t => t.circs.filter(q => q.tipo !== "esp").map(q => q.L))),
        ...(Ls.length ? { Ld: Math.max(0.5, ...Ls.map(r => r.L)) } : {}),
        n: tbs.length
      };
    };
  // Cargas especiales de cada tipo de departamento (lista cargasT): sumadas por tipo para la máxima demanda,
  // su potencia total (Pesp) para la carga instalada y su número (nEsp) para el metrado
  const espT = i => P.cargasT.filter(x => Math.round(+x.dep || 0) === i && x.p > 0);
  /* Número de unidades de cada tipo: el escrito; si no lo tiene, el de sus tableros dibujados en el plano */
  const T = P.tipos
    .map((t, i) => {
      const dp = dPlano(i);
      return { ...t, _i: i, ...(!(t.cant > 0) && dp ? { cant: dp.n, cantPlano: true } : {}) };
    })
    .filter(t => t.cant > 0)
    .map(t => {
      const dp = dPlano(t._i),
        // Con el tablero del tipo en el plano, sus cargas especiales son las dibujadas
        ce = dp ? dp.ce : espT(t._i),
        // Áreas marcadas de un departamento de este tipo (Regla 050-110: dimensiones interiores; en un local de
        // otro uso, el contorno exterior, Regla 050-210)
        aD = PLD && PLD.areaDep[t._i],
        uso = usoTipo(t),
        u = {
          ...t,
          ...(dp ? { nAl: dp.nAl, nTo: dp.nTo, Lc: dp.Lc, ...(dp.Ld ? { Ld: dp.Ld } : {}), plano: dp } : {}),
          ...(aD && aD.m2 > 0 ? { area: aD.m2, areaPlano: true } : {}),
          ...cargasMD(ce),
          Pesp: ce.reduce((s, x) => s + x.p, 0),
          nEsp: ce.length
        };
      /* Local de otro uso: su máxima demanda por la Regla 050-210 y la Tabla 14 (carga por área con sus factores y
         las cargas especiales a su potencia nominal) */
      return uso
        ? { ...u, uso, com: true, cant: Math.round(t.cant), md: mdUso(uso, u.area || 0, ce) }
        : (({ uso: _, ...v }) => ({ ...v, cant: Math.round(t.cant), md: mdVivienda(u, true) }))(u);
    })
    // Las viviendas primero, de mayor a menor carga (orden de los factores de la Regla 050-202(3)(a)); luego los locales
    .sort((a, b) => !!a.com - !!b.com || b.md.sinAire - a.md.sinAire);
  // Luminarias de otra potencia de cada tipo de departamento
  const exT = t =>
      lumsExtra(
        P.lumsT.filter(x => Math.round(+x.tipo || 0) === t._i),
        t.nAl || 0,
        c.pAl
      ),
    alT = t => {
      const e = exT(t);
      return e ? { n: (t.nAl || 0) + e.n, mix: e.mix } : {};
    };
  const exTt = t =>
      lumsExtra(
        P.tomsT.filter(x => Math.round(+x.tipo || 0) === t._i),
        t.nTo || 0,
        c.pTo
      ),
    toT = t => {
      const e = exTt(t);
      return e ? { n: (t.nTo || 0) + e.n, mix: e.mix } : {};
    };
  const units = [];
  T.forEach((t, ti) => {
    for (let k = 0; k < t.cant; k++)
      units.push({
        ti,
        nombre: t.nombre,
        md: t.md.sinAire,
        P: t.md.MD,
        ...(t.com ? { com: true } : {}),
        // Departamento con medidor trifásico: su carga se reparte en las tres fases
        f3: t.fases === "3" && SIST[sk].tri,
        ref: `${t.nombre} · Nº ${k + 1}`
      });
  });
  const fac = i => (i < 1 ? 1 : i < 3 ? 0.65 : i < 5 ? 0.4 : i < 20 ? 0.3 : 0.25);
  // Factores de la Regla 050-202(3)(a): solo para las unidades de vivienda; los locales van aparte
  const viv = units.filter(u => !u.com);
  units.forEach((u, i) => {
    u.ord = i + 1;
    if (u.com) {
      u.f = null;
      u.dem = 0;
      return;
    }
    u.f = fac(viv.indexOf(u));
    u.dem = u.md * u.f;
  });
  let pos = 1;
  T.forEach((t, ti) => {
    t.dem = units.filter(u => u.ti === ti).reduce((s, u) => s + u.dem, 0);
    if (t.com) return;
    t.desde = pos;
    t.hasta = pos + t.cant - 1;
    pos += t.cant;
  });
  const tramosDef = [
    ["Unidad de mayor carga", 1, 1],
    ["Siguientes 2 unidades", 2, 0.65],
    ["Siguientes 2 unidades", 2, 0.4],
    ["Siguientes 15 unidades", 15, 0.3],
    ["Unidades restantes", 1e9, 0.25]
  ];
  const tramos = [];
  let i0 = 0;
  for (const [lab, n, f] of tramosDef) {
    const sl = viv.slice(i0, i0 + n);
    if (!sl.length) break;
    tramos.push({
      lab,
      n: sl.length,
      f,
      sum: sl.reduce((s, u) => s + u.md, 0),
      dem: sl.reduce((s, u) => s + u.dem, 0)
    });
    i0 += sl.length;
  }
  const mdDeptos = units.reduce((s, u) => s + u.dem, 0),
    aireTot = T.reduce((s, t) => s + (t.com ? 0 : t.aire * t.cant), 0),
    /* Locales de otro uso (cargas que no están en las unidades de vivienda): su máxima demanda por la Regla 050-210,
       en el alimentador general al 75 % (Regla 050-202(3)(d), por defecto) o al 100 % (dato fLoc, criterio del
       proyectista) */
    TC = T.filter(t => t.com),
    fLoc = pv("fLoc") === "100" ? 1 : 0.75,
    Pcom = TC.reduce((s, t) => s + t.md.MD * t.cant, 0),
    mdCom = fLoc * Pcom;
  if (PLD)
    Object.entries(PLD.areaDep).forEach(([i, o]) => {
      // Áreas de un tipo junto a dos o más de sus tableros: se marcó más de un departamento (se sumarían)
      if (o.junto)
        PLD.avisos.push({
          t: "aviso",
          m: `Las áreas del ${(P.tipos[i] || {}).nombre || "tipo"} están junto a ${o.junto.length} de sus tableros (${o.junto.map(j => j.nom).join(", ")}): el área de un tipo es la de un solo departamento y se están sumando. Marque solo las de un departamento, o cree un tipo para cada uno si son distintos`,
          ids: o.junto.flatMap(j => j.ids),
          k: "area"
        });
      if (o.plantas.size > 1)
        PLD.avisos.push({
          t: "aviso",
          m: `Las áreas del ${(P.tipos[i] || {}).nombre || "tipo"} están en ${o.plantas.size} plantas: marque las de un solo departamento`,
          ids: [],
          k: "area"
        });
    });
  // Servicios generales: los circuitos del TSG dibujado (si lo hay); si no, los escritos
  const tsg = PLD && PLD.tabs.find(t => t.nom === "TSG" && t.circs.length),
    SV = tsg
      ? tsg.circs.map((q0, i) => {
          const mot = PLD.cargas.some(x => x.tabId === tsg.id && x.cir === q0.cir && x.tipo === "motor");
          return {
            nombre: q0.desc || (q0.tipo === "al" ? "Alumbrado de áreas comunes" : PL_DESC[q0.tipo] || "Carga común"),
            tipo: mot ? "motor" : q0.tipo === "al" ? "alum" : "otra",
            fases: q0.f3 ? 3 : 1,
            p: q0.P,
            L: q0.L,
            elec: q0.elec ? 1 : 0,
            _i: i,
            plano: { tab: tsg.id, cir: q0.cir, q0 }
          };
        })
      : P.serv.map((s, i) => ({ ...s, _i: i })).filter(s => s.p > 0);
  const Pserv = SV.reduce((s, x) => s + x.p, 0),
    maxMot = Math.max(0, ...SV.filter(x => x.tipo === "motor").map(x => x.p)),
    mdServ = 0.75 * Pserv;
  const MD = mdDeptos + aireTot + mdServ + mdCom;
  const gen = alimentador("Alimentador general: acometida → tablero general TG", MD, sk, Lgen, 0, c.dvGen, c, {
    pKey: "MD",
    fd: c.fdA,
    viv: true
  });
  const rP = PLD && PLD.rutas.PAT;
  if (rP) c.pozo = { ...c.pozo, cond: Math.max(rP.L, 0.5), pvc: Math.max(rP.L, 0.5) };
  gen.iccO = c.iccE;
  gen.pdc = pdcPara(c.iccE, c.pdcMin);
  if (rG) gen.plano = { Lh: rG.Lh, de: rG.de };
  const iccTG = iccAbajo(c.iccE, gen.s, gen.L, gen.S);
  const alims = [gen],
    tabs = [];
  /* Banco de medidores lejos del TG: alimentador TG → banco con la demanda de los departamentos (y la de los servicios
     generales si su medidor está en el banco). Los departamentos (y ese TSG) siguen su caída de tensión y su
     corriente de cortocircuito. Junto al TG, el banco es la barra del TG (sin tramo). */
  let bm = null,
    iccBM = iccTG;
  if (bmLejos) {
    bm = alimentador(
      "Alimentador TG → banco de medidores",
      mdDeptos + aireTot + mdCom + (tsgTG ? 0 : mdServ),
      sk,
      Lbm,
      gen.dVp,
      DV_ALIM - gen.dVp,
      c,
      { pKey: "bm", fd: c.fdA, viv: true }
    );
    bm.iccO = iccTG;
    bm.pdc = pdcPara(iccTG, c.pdcMin);
    if (rB) bm.plano = { Lh: rB.Lh, de: rB.de };
    alims.push(bm);
    iccBM = iccAbajo(iccTG, bm.s, bm.L, bm.S);
  }
  // Desde el banco de medidores: caída de tensión acumulada y cortocircuito
  const dvBM = bm ? bm.dvAc : gen.dVp;
  if (SV.length) {
    const deBM = bm && !tsgTG,
      i0 = deBM ? iccBM : iccTG,
      f = alimentador(
        deBM
          ? "Alimentador banco de medidores → tablero de servicios generales TSG"
          : "Alimentador TG → tablero de servicios generales TSG",
        Pserv + 0.25 * maxMot,
        sk,
        Lms,
        deBM ? dvBM : gen.dVp,
        DV_ALIM - (deBM ? dvBM : gen.dVp),
        c,
        { pKey: "servP" }
      );
    f.iccO = i0;
    f.pdc = pdcPara(i0, c.pdcMin);
    if (rS) f.plano = { Lh: rS.Lh, de: rS.de };
    alims.push(f);
    const icc = iccAbajo(i0, f.s, f.L, f.S);
    tabs.push({
      tab: "TSG",
      desc: "Tablero de servicios generales",
      feeder: alims.length - 1,
      gen: itmGeneral(f, false),
      icc,
      pdc: pdcPara(icc, c.pdcMin)
    });
  }
  /* Nombre del tablero de cada tipo: el del plano si el tipo tiene un solo tablero dibujado (por ejemplo, TD-01);
     si no, TD- y el nombre del tipo. Dos tipos nunca comparten nombre ni toman el de TG o TSG. */
  const nomTipo = t => "TD-" + t.nombre.replace(/^Tipo\s*/i, "");
  T.forEach(t => {
    const pn = t.plano && t.plano.n === 1 ? String(t.plano.tb.nom || "").trim() : "";
    t.tab = pn && !["TG", "TSG"].includes(pn.toUpperCase()) ? pn : nomTipo(t);
  });
  T.forEach(t => {
    if (T.filter(x => x.tab === t.tab).length > 1) t.tab = nomTipo(t);
  });
  /* Orden de los tableros en los resultados, el unifilar y las láminas: por su nombre (TD-01, TD-02…). Los factores
     de la Regla 050-202(3)(a) siguen el orden de T (de mayor a menor carga): esto solo cambia cómo se muestran. */
  const porNombre = [...T.keys()].sort((i, j) => T[i].tab.localeCompare(T[j].tab, "es", { numeric: true }));
  porNombre.forEach(ti => {
    const t = T[ti],
      tab = t.tab;
    const f = alimentador(
      `Alimentador medidor → ${tab} (${t.nombre})`,
      t.md.MD,
      // Medidor trifásico (por ejemplo, un local comercial): alimentador en el sistema del edificio
      t.fases === "3" && SIST[sk].tri ? sk : "mono220",
      t.Ld || 1,
      dvBM,
      DV_ALIM - dvBM,
      c,
      /* Local de otro uso: sin la corriente mínima de 25 A (propia de las viviendas) y con su carga continua
         (Regla 050-104(3)), como en la Regla 050-210 */
      t.com
        ? { pKey: "tipo", ti, cant: t.cant, fd: FD, viv: false }
        : { pKey: "tipo", ti, cant: t.cant, Imin: IMIN_DPTO, fd: c.fdA, viv: true }
    );
    f.iccO = iccBM;
    f.pdc = pdcPara(iccBM, c.pdcMin);
    if (t.plano && t.plano.Ld) f.plano = { n: t.plano.n };
    alims.push(f);
    const icc = iccAbajo(iccBM, f.s, f.L, f.S);
    tabs.push({
      tab,
      desc: t.com
        ? `Tablero de ${t.nombre} (${USOS[t.uso].n}) · ${t.cant} unidad(es)`
        : `Tablero de departamento ${t.nombre} · ${t.cant} unidad(es)`,
      feeder: alims.length - 1,
      gen: itmGeneral(f, !t.com),
      icc,
      pdc: pdcPara(icc, c.pdcMin)
    });
  });
  const circ = [];
  if (SV.length) {
    const f = alims.find(a => a.pKey === "servP");
    const l = SV.map((x, i) => {
      const q = circuito(
        {
          tab: "TSG",
          id: x.plano ? x.plano.cir : "S-" + (i + 1),
          desc: x.nombre || "Carga común",
          tipo: TSERV[x.tipo],
          n: 1,
          P: x.p,
          L: x.L || 1,
          fases: x.fases,
          skTri: sk
        },
        c,
        f.dvAc,
        1
      );
      q.src = x.plano ? { t: "plano", tab: x.plano.tab, cir: x.plano.cir } : { t: "serv", i: x._i };
      if (x.plano) q.plano = { lej: x.plano.q0.lej, Lh: x.plano.q0.Lh, Lv: x.plano.q0.Lv, est: x.plano.q0.est };
      q.elec = !!+x.elec;
      return q;
    });
    circ.push(...l);
  }
  porNombre.forEach(ti => {
    const t = T[ti],
      fi = alims.findIndex(a => a.pKey === "tipo" && a.ti === ti),
      up = alims[fi].dvAc;
    if (t.plano) {
      const L2 = t.plano.tb.circs.map(q0 => {
        const esp = q0.tipo === "esp",
          cg = t.plano.ce.filter(x => x.cir === q0.cir),
          m = cg.reduce((a, x) => (!a || x.p > a.p ? x : a), null),
          q = circuito(
            {
              tab: t.tab,
              id: q0.cir,
              desc: q0.desc || (esp ? (cg.length === 1 ? m.nombre : "Cargas especiales") : PL_DESC[q0.tipo]),
              tipo: esp ? TIPOS[m ? m.tipo : "otra"].split(" (")[0] : PL_TIPO[q0.tipo],
              n: q0.n,
              P: q0.P,
              L: q0.L,
              fases: 1
            },
            { ...c, fa: fa5C(q0.ng), fc: c.ft * fa5C(q0.ng) },
            up,
            fi
          );
        q.src = { t: "plano", tab: t.plano.tb.id, cir: q0.cir };
        q.grp = { n: q0.ng, fa: fa5C(q0.ng) };
        q.elec = q0.elec;
        q.plano = { lej: q0.lej, Lh: q0.Lh, Lv: q0.Lv, est: q0.est, Lmet: q0.Lmet, auto: q0.auto, ct: q0.tipo };
        return q;
      });
      asignarID(L2, c, alims[fi].itm || 0);
      circ.push(...L2);
      return;
    }
    const list = grupos(
      [
        { n: t.nAl, p: c.pAl, ...alT(t), L: t.Lc || 1, desc: "Alumbrado", tipo: "Alumbrado" },
        { n: t.nTo, p: c.pTo, ...toT(t), L: t.Lc || 1, desc: "Tomacorrientes", tipo: "Tomacorriente" }
      ],
      c,
      t.tab,
      up,
      fi
    );
    list.forEach(q => {
      q.src = { t: "tipo", i: t._i };
    });
    P.cargasT.forEach((x, ix) => {
      if (Math.round(+x.dep || 0) !== t._i || !(x.p > 0)) return;
      const q = circuito(
        {
          tab: t.tab,
          id: "C-" + (list.length + 1),
          desc: x.nombre || "Carga especial",
          tipo: TIPOS[x.tipo].split(" (")[0],
          n: 1,
          P: x.p,
          L: x.L || 1,
          fases: 1
        },
        c,
        up,
        fi
      );
      q.src = { t: "cargasT", i: ix };
      q.elec = !!+x.elec;
      list.push(q);
    });
    asignarID(list, c, alims[fi].itm || 0);
    circ.push(...list);
  });
  circ
    .filter(q => q.tab === "TSG")
    .forEach(q => {
      q.ref = `${q.id} · ${q.desc}`;
    });
  const balItems = [...units.map(u => ({ ...u, key: u.ref })), ...circ.filter(q => q.tab === "TSG")];
  const bal = balancear(balItems, sk, (P.FIX || {}).multi);
  // Diferenciales del tablero de servicios generales, ya con la fase de cada circuito
  asignarID(
    circ.filter(q => q.tab === "TSG"),
    c,
    (alims.find(a => a.pKey === "servP") || {}).itm || 0
  );
  /* Banco junto al TG: de las barras del TG sale hacia el banco la fase (o las tres) y el neutro de cada suministro,
     con la sección de su alimentador (lámina IE-05), todos por la tubería entre el TG y el banco. Se dimensionan con
     el 40 % de ocupación, como las demás; si no entran en una de hasta TGBM_MAX mm (criterio), van en varias. */
  const tgbm = bm
    ? null
    : tuberiasTGBanco(
        units,
        T,
        alims,
        SV.length && !tsgTG ? alims.find(a => a.pKey === "servP") : null,
        sk,
        TUBOS.some(t => t[0] === +pv("tgbmMax")) ? +pv("tgbmMax") : TGBM_MAX
      );
  const emerg = SV.some(s => /emergencia/i.test(s.nombre));
  const CI =
    T.reduce(
      (s, t) =>
        s +
        t.cant *
          (t.plano
            ? t.plano.Pno + t.Pesp
            : t.nAl * c.pAl + (exT(t)?.P || 0) + t.nTo * c.pTo + (exTt(t)?.P || 0) + t.Pesp),
      0
    ) + Pserv;
  return plConDiseno(
    {
      mode: "multi",
      iccTG,
      // Esquema elegido, solo si no es el de por defecto (banco junto al TG y TSG con medidor en el banco)
      ...(bmLejos || tsgTG ? { topo: { bm: bmLejos, tsgTG, iccBM } } : {}),
      ...(tgbm ? { tgbm } : {}),
      c,
      sk,
      T,
      units,
      tramos,
      mdDeptos,
      aireTot,
      SV,
      Pserv,
      mdServ,
      // Locales de otro uso (solo si los hay)
      ...(TC.length ? { TC, Pcom, mdCom, fLoc } : {}),
      maxMot,
      MD,
      CI,
      alims,
      circ,
      tabs,
      bal,
      emerg,
      pat: pozo(c.pat),
      contratada: Math.ceil(MD / 500) / 2,
      conexion: "Conexión en derivación con banco de medidores (Norma DGE, 301.C)",
      ...(PLD
        ? {
            plano: {
              tabs: [...new Set(PLD.tabs.filter(t => Number.isInteger(t.dep) && t.circs.length).map(t => t.dep))].map(
                i =>
                  (T.find(t => t._i === i) || {}).tab ||
                  "TD-" + ((P.tipos[i] || {}).nombre || "").replace(/^Tipo\s*/i, "")
              ),
              ali: !!rG,
              avisos: PLD.avisos,
              campos: Object.fromEntries(
                [
                  rG ? ["Lgen", Lgen] : null,
                  bmLejos && rB ? ["Lbm", Lbm] : null,
                  rS ? ["Lms", Lms] : null,
                  rP ? ["pzCond", c.pozo.cond] : null,
                  rP ? ["pzPvc", c.pozo.pvc] : null,
                  ...T.filter(t => t.areaPlano).map(t => [`tipos_area_${t._i}`, t.area]),
                  ...T.flatMap(t =>
                    t.plano
                      ? [
                          [`tipos_nAl_${t._i}`, t.nAl],
                          [`tipos_nTo_${t._i}`, t.nTo],
                          [`tipos_Lc_${t._i}`, t.Lc],
                          t.plano.Ld ? [`tipos_Ld_${t._i}`, t.Ld] : null
                        ]
                      : []
                  )
                ].filter(Boolean)
              )
            }
          }
        : {}),
      Selec: tierraElectrodo(gen.Izc)
    },
    PLD,
    P.PLANO
  );
}
