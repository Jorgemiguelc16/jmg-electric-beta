/* CÁLCULO · MÁXIMA DEMANDA Y SALIDAS
   Cargas especiales para la máxima demanda, mdVivienda() (Reglas 050-200 y 050-202) y mdUso() (Reglas 050-204 a
   050-210 y Tabla 14), luminarias de distintas potencias, grupos() de salidas en circuitos y pisosUni() (pisos de
   la vivienda). Parte del motor de js/calculo/calculo.js. */
// Cargas especiales sumadas por tipo para la máxima demanda (Reglas 050-200(1)(a) y 050-202(1)(a)): cocinas,
// calentadores y aire acondicionado; en «otras» solo las cargas y motores mayores de 1500 W
function cargasMD(list) {
  const sum = t => list.filter(x => x.tipo === t).reduce((s, x) => s + x.p, 0);
  return {
    coc: sum("cocina"),
    cal: sum("calentador"),
    aire: sum("aire"),
    otras: list.filter(x => (x.tipo === "otra" || x.tipo === "motor") && x.p > 1500).reduce((s, x) => s + x.p, 0)
  };
}
// 050-200(1)(a) y 050-202(1)(a)
function mdVivienda({ area, coc, cal, aire, otras }, multi) {
  const basica = multi
    ? 1500 + (area > 45 ? 1000 : 0) + 1000 * Math.max(0, Math.ceil((area - 90) / 90))
    : 2500 + 1000 * Math.max(0, Math.ceil((area - 90) / 90));
  const mdCoc = coc > 0 ? 6000 + 0.4 * Math.max(0, coc - 12000) : 0;
  const mdOtras = coc > 0 ? 0.25 * otras : Math.min(otras, 6000) + 0.25 * Math.max(0, otras - 6000);
  const sinAire = basica + mdCoc + cal + mdOtras;
  return { basica, coc, mdCoc, cal, aire, otras, mdOtras, sinAire, MD: sinAire + aire };
}
// Potencia de las salidas ini..ini+n-1 de una lista mixta [[cantidad, W por salida], ...] (luminarias de distintas potencias)
const potMix = (mix, ini, n) => {
  let P = 0,
    pos = 0;
  for (const [m, p] of mix) {
    const a = Math.max(ini, pos),
      b = Math.min(ini + n, pos + m);
    if (b > a) P += (b - a) * p;
    pos += m;
  }
  return P;
};
// Luminarias de otra potencia que se suman a una salida de alumbrado: {n, mix} o null
const lumsExtra = (L, n0, p0) => {
  const v = L.map(x => [Math.max(0, Math.round(+x.n || 0)), +x.p || 0]).filter(([m, p]) => m > 0 && p > 0);
  if (!v.length) return null;
  return { n: v.reduce((s, [m]) => s + m, 0), P: v.reduce((s, [m, p]) => s + m * p, 0), mix: [[n0, p0], ...v] };
};
function grupos(list, c, tab, dvUp, feeder) {
  const out = [];
  let k = 0;
  list.forEach(g => {
    if (g.n <= 0) return;
    const nc = Math.ceil(g.n / c.maxSal);
    let rest = g.n,
      ini = 0;
    for (let i = 0; i < nc; i++) {
      const n = Math.ceil(rest / (nc - i));
      rest -= n;
      const P = g.mix ? potMix(g.mix, ini, n) : n * g.p;
      ini += n;
      const q = circuito(
        { tab, id: "C-" + ++k, desc: g.desc + (nc > 1 ? ` ${i + 1}` : ""), tipo: g.tipo, n, P, L: g.L, fases: 1 },
        c,
        dvUp,
        feeder
      );
      q.src = g.src || null;
      if (g.mix) q.mix = true;
      out.push(q);
    }
  });
  return out;
}
// Pisos de la vivienda: el 1er piso con los datos de Vivienda y Salidas, los siguientes desde la lista «pisos»
function pisosUni() {
  const sal = (n, L) => ({ n, L: L || 1 });
  return [
    {
      n: 1,
      area: pn("area"),
      aE: pn("aE"),
      Ld: pn("Ltd1") || 1,
      al: sal(pn("al_n"), pn("al_L")),
      tg: sal(pn("tg_n"), pn("tg_L")),
      tc: sal(pn("tc_n"), pn("tc_L"))
    },
    ...P.pisos.map((p, i) => ({
      n: i + 2,
      i,
      area: p.area || 0,
      aE: p.aE || 0,
      Ld: p.Ld || 1,
      al: sal(p.al_n || 0, p.al_L),
      tg: sal(p.tg_n || 0, p.tg_L),
      tc: sal(p.tc_n || 0, p.tc_L)
    }))
  ];
}
// Regla 050-210 y Tabla 14: carga por área (dimensiones exteriores) con el factor de demanda de alimentadores,
// más las cargas especiales a su potencia nominal (050-210(b)). Devuelve los mismos campos que mdVivienda.
function mdUso(uso, area, cs, aE = 0) {
  const U = USOS[uso];
  // Escuelas, hospitales y hoteles (050-204/206/208): el factor de demanda afecta a la carga por área más las cargas especiales
  if (U.regla) {
    const e = U.wE ? Math.min(Math.max(0, aE), area) : 0,
      carga = U.wE ? (U.resta ? U.wE * e + U.w * (area - e) : U.w * area + U.wE * e) : U.w * area;
    const esp = cs.reduce((s, x) => s + (x.p > 0 ? x.p : 0), 0),
      total = carga + esp,
      dens = area > 0 ? total / area : 0,
      tramos = [];
    if (area <= 900) tramos.push({ a: area, fal: U.f1, inst: total, d: (total * U.f1) / 100 });
    else
      tramos.push(
        { a: 900, fal: U.f1, inst: dens * 900, d: (dens * 900 * U.f1) / 100 },
        { a: area - 900, fal: U.f2, inst: dens * (area - 900), d: (dens * (area - 900) * U.f2) / 100 }
      );
    const dem = tramos.reduce((s, t) => s + t.d, 0);
    return {
      uso,
      U,
      area,
      aE: e,
      carga,
      dem,
      tramos,
      esp,
      total,
      basica: dem,
      coc: 0,
      mdCoc: 0,
      cal: 0,
      aire: 0,
      otras: esp,
      mdOtras: 0,
      sinAire: dem,
      MD: dem
    };
  }
  const carga = area * U.w,
    tramos = [];
  let ini = 0,
    dem = 0;
  U.fd.forEach(([lim, fac, fal]) => {
    const a = Math.max(0, Math.min(area, lim) - ini);
    if (a > 0) {
      const d = (a * U.w * fal) / 100;
      dem += d;
      tramos.push({ a, fac, fal, inst: a * U.w, d });
    }
    ini = lim;
  });
  const esp = cs.reduce((s, x) => s + (x.p > 0 ? x.p : 0), 0);
  return {
    uso,
    U,
    area,
    carga,
    dem,
    tramos,
    esp,
    basica: dem,
    coc: 0,
    mdCoc: 0,
    cal: 0,
    aire: 0,
    otras: esp,
    mdOtras: esp,
    sinAire: dem + esp,
    MD: dem + esp
  };
}
