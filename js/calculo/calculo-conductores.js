/* CÁLCULO · PROTECCIÓN Y CONDUCTORES
   Conductor de protección (Tabla 16) y de puesta a tierra (Tabla 17), poder de corte, tubo, y dimensionar(): el
   interruptor y la sección por capacidad de corriente (Tabla 2 con los factores 5A y 5C) y por caída de tensión
   (Regla 050-102), con la sección elegida en el cuadro de conductores. alimentador() y circuito() arman cada tramo;
   asignarID() agrupa los diferenciales (Regla 150-400). Parte del motor de js/calculo/calculo.js. */
const tierraPara = itm => (T16.find(([a]) => itm <= a) || [0, 25])[1];
const tierraElectrodo = amp => T17.find(([a]) => amp <= a)[1];
/* Poder de corte: el menor nivel de la lista que cubre la Icc, y no menor que el mínimo comercial elegido (criterio
   del proyectista: en el mercado peruano los ITM usuales son de 4.5, 6 o 10 kA) */
const pdcPara = (kA, min = 0) => {
  const p = PDC.find(x => x >= kA) ?? null;
  return p === null ? null : Math.max(p, min || 0);
};
// Disparo magnético mínimo de cada curva, en veces la corriente nominal del ITM (IEC 60898-1)
const CURVA_MAG = { B: 3, C: 5, D: 10 };
function tuboPara(S, St, ncond) {
  const a = ((ncond * OD[S] ** 2 + OD[St] ** 2) * Math.PI) / 4;
  for (const [mm, pul, di] of TUBOS) if (a <= (0.4 * Math.PI * di * di) / 4) return { mm, pul };
  return { mm: null, pul: '> 3"' };
}
/* Secciones elegidas en el cuadro de conductores (SECF del modo en cálculo), por tramo: «A·descripción» en
   alimentadores y «tablero·circuito» en derivados. dimensionar() calcula el tramo con la sección elegida, mayor o
   menor que la automática (la mínima que cumple capacidad y caída de tensión), y guarda la automática en Sauto: una
   menor no cumple y se marca así, para que el proyectista vea cuánto excede. Igual a la automática, no cuenta. */
let SFX = {};
function dimensionar({ I, K, L, V, cargados, c, fc, dvMax, Smin, Imin = 0, fd = FD, Sfix = 0 }) {
  const Id = Math.max(I * fd, Imin),
    itm = ITM.find(x => x >= Id - 1e-9) ?? null;
  const key = c.aisl + (cargados === 3 ? "3" : "2"),
    tabla = T2[c.met][key],
    col = (c.aisl === "pvc" ? 0 : 2) + (cargados === 3 ? 1 : 0);
  for (let k = 0; k < SECC.length; k++) {
    const S = SECC[k];
    if (S < Smin) continue;
    const Iz = tabla[k],
      Izc = Iz * fc,
      dV = (K * c.rho * L * I) / S,
      dVp = (dV / V) * 100;
    if (itm !== null && Izc >= itm && dVp <= dvMax + 1e-9) {
      const j = Sfix && Sfix !== S ? SECC.indexOf(Sfix) : -1;
      if (j >= 0) {
        const dVf = (K * c.rho * L * I) / Sfix;
        return {
          Id,
          fd,
          itm,
          col,
          S: Sfix,
          Iz: tabla[j],
          Izc: tabla[j] * fc,
          dV: dVf,
          dVp: (dVf / V) * 100,
          Imin,
          Sauto: S,
          bajoMin: Sfix < Smin
        };
      }
      return { Id, fd, itm, col, S, Iz, Izc, dV, dVp, Imin };
    }
  }
  const k = SECC.length - 1,
    S = SECC[k],
    dV = (K * c.rho * L * I) / S;
  return { Id, fd, itm, col, S, Iz: tabla[k], Izc: tabla[k] * fc, dV, dVp: (dV / V) * 100, Imin, fail: true };
}
function alimentador(desc, P, sk, L, dvUp, dvSel, c, extra = {}) {
  const s = SIST[sk],
    I = P / (s.kI * s.V * c.fp);
  const r = dimensionar({
    I,
    K: s.K,
    L,
    V: s.V,
    cargados: s.tri ? 3 : 2,
    c,
    fc: c.ft,
    dvMax: dvSel,
    Smin: c.sminA,
    Imin: extra.Imin || 0,
    fd: extra.fd ?? FD,
    Sfix: SFX["A·" + desc]
  });
  Object.assign(r, { desc, P, sk, s, I, L, dvUp, dvAc: dvUp + r.dVp }, extra);
  r.St = tierraPara(r.itm || 400);
  r.tubo = tuboPara(r.S, r.St, s.n);
  r.ok = !r.fail && !r.bajoMin && r.itm !== null && r.Izc >= r.itm && r.dvAc <= DV_ALIM + 1e-9;
  return r;
}
function circuito({ tab, id, desc, tipo, n, P, L, fases, skTri }, c, dvUp, feeder) {
  const s = fases === 3 && skTri && SIST[skTri].tri ? SIST[skTri] : SIST.mono220,
    f3 = s.tri;
  const I = P / (s.kI * s.V * c.fp);
  const r = dimensionar({
    I,
    K: s.K,
    L,
    V: s.V,
    cargados: f3 ? 3 : 2,
    c,
    fc: c.fc,
    dvMax: Math.min(DV_DER, DV_TOT - dvUp),
    Smin: c.sminD,
    Sfix: SFX[`${tab}·${id}`]
  });
  const motor = /^motor/i.test(tipo || "");
  Object.assign(r, {
    tab,
    id,
    desc,
    tipo,
    n,
    P,
    L,
    s,
    I,
    dvUp,
    dVt: dvUp + r.dVp,
    feeder,
    f3,
    fase: f3 ? "3φ" : "—",
    motor,
    curva: motor ? "D" : "C",
    key: `${tab}·${id}`
  });
  r.St = tierraPara(r.itm || 400);
  r.tubo = tuboPara(r.S, r.St, f3 ? 3 : 2);
  /* Arranque de motores: la corriente de arranque (kArr veces la nominal, arranque directo) no debe alcanzar el
     disparo magnético mínimo de la curva del ITM (IEC 60898-1). La caída de tensión en el arranque se estima con
     la misma fórmula y kArr veces la corriente (estimación conservadora, sin reactancia); se informa sin límite,
     porque las normas cargadas no lo fijan. */
  if (motor) {
    r.Iarr = c.kArr * I;
    r.magMin = r.itm === null ? null : CURVA_MAG[r.curva] * r.itm;
    r.arrOk = r.magMin !== null && r.Iarr < r.magMin;
    r.dVarr = r.dVp * c.kArr;
  }
  r.ok =
    !r.fail &&
    !r.bajoMin &&
    r.itm !== null &&
    r.Izc >= r.itm &&
    r.dVp <= DV_DER + 1e-9 &&
    r.dVt <= DV_TOT + 1e-9 &&
    (!motor || r.arrOk);
  return r;
}
/* Interruptor general de cada tablero (Regla 150-400(4)): termomagnético, en la cabecera del tablero y aguas arriba de
   los diferenciales, con la misma corriente nominal que el interruptor de su alimentador. Es obligatorio en el tablero
   de cada unidad de vivienda; en los demás tableros (locales, servicios generales) se pone por criterio, como medio de
   desconexión del tablero. Devuelve {itm, pol, viv} o null. */
function itmGeneral(f, viv) {
  if (!f || !(f.itm > 0)) return null;
  return { itm: f.itm, pol: f.s.tri ? 3 : 2, viv: !!viv };
}
/* Interruptores diferenciales (Regla 150-400): uno por cada grupo de tres circuitos o uno por circuito. Tipo A en
   todos o, con el parámetro «AC», tipo A solo si el diferencial protege alguna carga marcada «con electrónica»
   (inverter, variador, inducción, cargador): criterio de ingeniería según IEC 60364-5-53 e IEC 62423, porque esas
   cargas producen corrientes de fuga con componente continua que un tipo AC puede no detectar. */
const tipoID = (grp, c) => (c.idTipo === "A" || grp.some(q => q.elec) ? "A" : "AC");
function asignarID(cs, c, gen = 0) {
  if (c.idMode === "circuito") {
    cs.forEach(q => {
      q.idName = "ID";
      q.idRat = ID_RAT.find(x => x >= (q.itm || 0)) ?? 100;
      q.idTipo = tipoID([q], c);
    });
    return;
  }
  /* Grupos por fase: un diferencial de 2 polos solo protege circuitos de una misma fase con su neutro (o del mismo
     par de fases, sin neutro), y los circuitos trifásicos van en diferenciales propios de 4 polos. Por eso se asigna
     después del balance de fases; en sistemas monofásicos todos los circuitos forman un solo grupo. */
  const fk = q => (q.f3 ? "3φ" : q.fase && q.fase !== "—" ? q.fase : ""),
    orden = [],
    por = {};
  cs.forEach(q => {
    const k = fk(q);
    if (!por[k]) {
      por[k] = [];
      orden.push(k);
    }
    por[k].push(q);
  });
  const grupos = [];
  orden.forEach(k => {
    for (let i = 0; i < por[k].length; i += 3) grupos.push(por[k].slice(i, i + 3));
  });
  // Numerados en el orden de su primer circuito, para que se lean ID-1, ID-2… de izquierda a derecha
  grupos.sort((p, q) => cs.indexOf(p[0]) - cs.indexOf(q[0]));
  /* Corriente nominal de cada diferencial (Regla 150-400, Nota): con los mismos criterios que un interruptor en esa
     posición, es decir, no menor que la suma de las corrientes de diseño del grupo ni que el mayor ITM del grupo. Si un
     solo diferencial encabeza todo el tablero (hasta tres circuitos, Regla 150-400(7)), no menor que el interruptor
     general. */
  let g = 0;
  const unico = grupos.length === 1;
  for (const grp of grupos) {
    g++;
    const need = Math.max(
        ...grp.map(q => q.itm || 0),
        grp.reduce((s, q) => s + (q.Id || q.I), 0),
        unico ? gen || 0 : 0
      ),
      rat = ID_RAT.find(x => x >= need) ?? 100;
    const tp = tipoID(grp, c);
    grp.forEach(q => {
      q.idName = "ID-" + g;
      q.idRat = rat;
      q.idTipo = tp;
    });
  }
}
