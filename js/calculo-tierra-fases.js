/* CÁLCULO · PUESTA A TIERRA, CORTOCIRCUITO Y BALANCE DE FASES
   pozo(): resistencia de la puesta a tierra y número de varillas (Reglas 060-702 y 060-712) con el factor de
   agrupamiento; iccAbajo(): cortocircuito aguas abajo de un conductor; balancear(): reparto de las cargas
   monofásicas entre fases, con las fases fijadas por el usuario. Parte del motor de js/calculo.js. */
// Factor de agrupamiento de varillas en paralelo (separación ≥ longitud de varilla), con interpolación lineal
const FAGR = [
  [1, 1],
  [2, 1.16],
  [3, 1.29],
  [4, 1.36],
  [8, 1.68],
  [12, 1.8],
  [16, 1.92],
  [20, 2],
  [24, 2.16]
];
function fAgr(n) {
  if (n <= 1) return 1;
  for (let i = 1; i < FAGR.length; i++) {
    if (n <= FAGR[i][0]) {
      const [n0, f0] = FAGR[i - 1],
        [n1, f1] = FAGR[i];
      return f0 + ((f1 - f0) * (n - n0)) / (n1 - n0);
    }
  }
  return FAGR[FAGR.length - 1][1];
}
function pozo(p) {
  const a = p.dv / 2,
    Rv = (p.rho / (2 * Math.PI * p.Lv)) * (Math.log((4 * p.Lv) / a) - 1),
    Rt = Rv * p.fr;
  let nVar = 1;
  while ((Rt * fAgr(nVar)) / nVar > 25 && nVar < 60) nVar++;
  const F = fAgr(nVar),
    Rn = (Rt * F) / nVar;
  return { ...p, Rv, Rt, ok: Rt <= 25, nVar, F, Rn, okL: p.Lv >= 2, okD: p.dv * 1000 >= 13 };
}
// Cortocircuito aguas abajo de un conductor (estimación conservadora: impedancia de la fuente inductiva + resistencia del cable)
function iccAbajo(iccUp, s, L, S) {
  const k = s.tri ? SQ3 : 1,
    Zup = s.V / (k * iccUp * 1000),
    Rc = ((s.tri ? 1 : 2) * RHO_CU * L) / S;
  return s.V / (k * Math.hypot(Zup, Rc)) / 1000;
}
// Reparto óptimo de cargas monofásicas entre tres fases (búsqueda exhaustiva o mejora local)
function optimo(P, base) {
  const n = P.length,
    idx = P.map((_, i) => i).sort((a, b) => P[b] - P[a]),
    ph = base.slice(),
    asg = new Array(n).fill(0);
  const sc = v => {
    const mx = Math.max(...v);
    return mx + (mx - Math.min(...v)) * 1e-6;
  };
  let best = null;
  if (n <= 10) {
    let bestS = Infinity;
    const rec = d => {
      if (Math.max(...ph) >= bestS) return;
      if (d === n) {
        const v = sc(ph);
        if (v < bestS) {
          bestS = v;
          best = asg.slice();
        }
        return;
      }
      const i = idx[d],
        seen = [];
      for (let k = 0; k < 3; k++) {
        if (seen.includes(ph[k])) continue;
        seen.push(ph[k]);
        ph[k] += P[i];
        asg[i] = k;
        rec(d + 1);
        ph[k] -= P[i];
      }
    };
    rec(0);
  } else {
    idx.forEach(i => {
      const k = ph.indexOf(Math.min(...ph));
      ph[k] += P[i];
      asg[i] = k;
    });
    let mejora = true,
      it = 0;
    while (mejora && it++ < 400) {
      mejora = false;
      const s0 = sc(ph);
      for (let i = 0; i < n && !mejora; i++)
        for (let k = 0; k < 3 && !mejora; k++) {
          const a = asg[i];
          if (k === a) continue;
          ph[a] -= P[i];
          ph[k] += P[i];
          if (sc(ph) < s0 - 1e-9) {
            asg[i] = k;
            mejora = true;
          } else {
            ph[k] -= P[i];
            ph[a] += P[i];
          }
        }
      for (let i = 0; i < n && !mejora; i++)
        for (let j = i + 1; j < n && !mejora; j++) {
          const a = asg[i],
            b = asg[j];
          if (a === b) continue;
          const d = P[j] - P[i];
          ph[a] += d;
          ph[b] -= d;
          if (sc(ph) < s0 - 1e-9) {
            asg[i] = b;
            asg[j] = a;
            mejora = true;
          } else {
            ph[a] -= d;
            ph[b] += d;
          }
        }
    }
    best = asg.slice();
  }
  best = best || [];
  const out = base.slice();
  best.forEach((k, i) => (out[k] += P[i]));
  return { asg: best, ph: out };
}
const desbal = ph => {
  const avg = (ph[0] + ph[1] + ph[2]) / 3;
  return avg > 0 ? ((Math.max(...ph) - avg) / avg) * 100 : 0;
};
/* Reparto en dos niveles. Cada tablero alimenta su barra con un alimentador trifásico, que se dimensiona como si su
   carga estuviera repartida por igual: por eso primero se reparte cada tablero por sí solo, con el menor desbalance
   posible (optimo). Luego se elige, para cada tablero, qué grupo de sus circuitos va a cada fase (una rotación de
   R-S-T, que no cambia su propio desbalance) para que el total, en el tablero general y la acometida, quede también
   lo más parejo posible. Los circuitos propios del tablero general (TG) y las cargas sin tablero (las unidades de
   un edificio, cada una con su medidor) se reparten una por una en el total: la barra del TG lleva todo, así que su
   balance es el del total. Un tablero con alguna fase fijada por el proyectista no se rota. */
const PERM3 = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
  [0, 2, 1],
  [2, 1, 0],
  [1, 0, 2]
];
const puntaje = v => {
  const mx = Math.max(...v);
  return mx + (mx - Math.min(...v)) * 1e-6;
};
function repartir(items, nm, fix) {
  const mono = items.filter(i => !i.f3),
    tabs = new Map(),
    sueltas = [],
    base = [0, 0, 0];
  items
    .filter(i => i.f3)
    .forEach(i => {
      for (let k = 0; k < 3; k++) base[k] += i.P / 3;
    });
  mono.forEach(i => {
    const k = nm.indexOf(fix ? fix[i.key] : undefined);
    if (i.tab && i.tab !== "TG") {
      if (!tabs.has(i.tab)) tabs.set(i.tab, { fijas: [], libres: [], fijo: false });
      const t = tabs.get(i.tab);
      if (k >= 0) {
        t.fijas.push([i, k]);
        t.fijo = true;
      } else t.libres.push(i);
    } else if (k >= 0) {
      base[k] += i.P;
      sueltas.push([i, k, true]);
    } else sueltas.push([i, -1, false]);
  });
  // 1) Cada tablero, por sí solo
  const T = [...tabs.values()].map(t => {
    const b = [0, 0, 0];
    t.fijas.forEach(([i, k]) => (b[k] += i.P));
    const o = optimo(
      t.libres.map(i => i.P),
      b
    );
    return { ...t, asg: o.asg, ph: o.ph, rot: 0 };
  });
  // 2) Rotación de cada tablero para el total (las cargas sueltas, repartidas en cada prueba)
  const libres = sueltas.filter(x => !x[2]).map(x => x[0]),
    rotables = T.filter(t => !t.fijo),
    total = () => {
      const v = base.slice();
      T.forEach(t => PERM3[t.rot].forEach((d, k) => (v[d] += t.ph[k])));
      const o = optimo(
        libres.map(i => i.P),
        v
      );
      return { v: o.ph, asg: o.asg };
    };
  let mejor = total(),
    mejorRot = rotables.map(t => t.rot);
  const probar = () => {
    const r = total();
    if (puntaje(r.v) < puntaje(mejor.v) - 1e-9) {
      mejor = r;
      mejorRot = rotables.map(t => t.rot);
    }
  };
  // Todas las combinaciones si son pocas (6^n, con las cargas sueltas repartidas en cada una); si no, una a una
  if (rotables.length && Math.pow(6, rotables.length) * (libres.length > 10 ? 4 : 1) <= 50000) {
    const rec = d => {
      if (d === rotables.length) return probar();
      for (let r = 0; r < 6; r++) {
        rotables[d].rot = r;
        rec(d + 1);
      }
    };
    rec(0);
  } else
    for (let vuelta = 0; vuelta < 3; vuelta++)
      rotables.forEach((t, j) => {
        rotables.forEach((u, k) => (u.rot = mejorRot[k]));
        for (let r = 0; r < 6; r++) {
          t.rot = r;
          probar();
        }
        t.rot = mejorRot[j];
      });
  rotables.forEach((t, j) => (t.rot = mejorRot[j]));
  // Fases de cada carga y de cada tablero
  const fase = new Map();
  T.forEach(t => {
    t.fijas.forEach(([i, k]) => fase.set(i, k));
    t.libres.forEach((i, j) => fase.set(i, PERM3[t.rot][t.asg[j]]));
  });
  sueltas.filter(x => x[2]).forEach(([i, k]) => fase.set(i, k));
  libres.forEach((i, j) => fase.set(i, mejor.asg[j]));
  // Carga trifásica de cada tablero, por fase (con ella ninguna de sus fases queda vacía)
  const tri = new Map();
  items.filter(i => i.f3 && i.tab).forEach(i => tri.set(i.tab, (tri.get(i.tab) || 0) + i.P / 3));
  const nomT = [...tabs.keys()],
    b3 = T.map((t, b) => tri.get(nomT[b]) || 0);
  /* 3) Afinado: un tablero suele tener varios repartos igual de buenos para él; se mueve o intercambia un circuito
     dentro de su tablero solo si la fase más cargada del tablero no sube, no deja vacía una de sus fases y el total
     mejora (y las cargas sueltas se vuelven a repartir) */
  const tot = mejor.v.slice(),
    vTab = T.map(t => {
      const v = [0, 0, 0];
      t.fijas.forEach(([i, k]) => (v[k] += i.P));
      t.libres.forEach(i => (v[fase.get(i)] += i.P));
      return v;
    }),
    tope = T.map(t => Math.max(...t.ph) + 1e-6);
  for (let vuelta = 0, mejora = true; mejora && vuelta < 60; vuelta++) {
    mejora = false;
    T.forEach((t, b) => {
      const v = vTab[b],
        L = t.libres,
        prueba = (cambios, nv) => {
          // cambios: [carga, fase nueva]; nv: fases del tablero después
          // Ni deja vacía una fase del tablero que tenía carga (su neutro llevaría más corriente)
          if (Math.max(...nv) > tope[b] || (Math.min(...v) + b3[b] > 1e-9 && Math.min(...nv) + b3[b] <= 1e-9))
            return false;
          const nt = tot.slice();
          cambios.forEach(([i, k]) => {
            nt[fase.get(i)] -= i.P;
            nt[k] += i.P;
          });
          if (puntaje(nt) >= puntaje(tot) - 1e-9) return false;
          cambios.forEach(([i, k]) => fase.set(i, k));
          nt.forEach((x, k) => (tot[k] = x));
          nv.forEach((x, k) => (v[k] = x));
          return true;
        };
      for (let a = 0; a < L.length; a++)
        for (let k = 0; k < 3; k++) {
          const f = fase.get(L[a]);
          if (k === f) continue;
          const nv = v.slice();
          nv[f] -= L[a].P;
          nv[k] += L[a].P;
          if (prueba([[L[a], k]], nv)) mejora = true;
        }
      for (let a = 0; a < L.length; a++)
        for (let c = a + 1; c < L.length; c++) {
          const fa = fase.get(L[a]),
            fc = fase.get(L[c]);
          if (fa === fc) continue;
          const nv = v.slice();
          nv[fa] += L[c].P - L[a].P;
          nv[fc] += L[a].P - L[c].P;
          if (
            prueba(
              [
                [L[a], fc],
                [L[c], fa]
              ],
              nv
            )
          )
            mejora = true;
        }
    });
    // Las cargas sueltas, otra vez con los tableros como quedaron
    if (libres.length) {
      const b0 = tot.slice();
      libres.forEach(i => (b0[fase.get(i)] -= i.P));
      const o = optimo(
        libres.map(i => i.P),
        b0
      );
      if (puntaje(o.ph) < puntaje(tot) - 1e-9) {
        libres.forEach((i, j) => fase.set(i, o.asg[j]));
        o.ph.forEach((x, k) => (tot[k] = x));
        mejora = true;
      }
    }
  }
  return { fase, ph: tot };
}
function balancear(items, sk, fix) {
  const s = SIST[sk];
  if (!s.tri) return null;
  const nm = s.fases,
    mono = items.filter(i => !i.f3),
    nFix = fix ? mono.filter(i => nm.includes(fix[i.key])).length : 0,
    r = repartir(items, nm, fix),
    ph = r.ph;
  items.forEach(i => {
    i.fase = i.f3 ? "3φ" : nm[r.fase.get(i)];
    i.fijo = !i.f3 && nm.includes(fix ? fix[i.key] : undefined);
  });
  // Desbalance de cada tablero (con sus cargas trifásicas); el del TG es el del total, porque su barra lo lleva todo
  const porTab = new Map();
  if (items.some(i => i.tab === "TG")) porTab.set("TG", ph);
  items.forEach(i => {
    if (!i.tab || i.tab === "TG") return;
    if (!porTab.has(i.tab)) porTab.set(i.tab, [0, 0, 0]);
    const v = porTab.get(i.tab);
    if (i.f3) for (let k = 0; k < 3; k++) v[k] += i.P / 3;
    else v[nm.indexOf(i.fase)] += i.P;
  });
  // El menor desbalance que da el reparto automático (sin fases fijadas): del total y de cada tablero por sí solo,
  // con su circuito monofásico de mayor potencia (el que conviene dividir si no se llega al 10 %)
  const desbMin = desbal(nFix ? repartir(items, nm, null).ph : ph),
    tabs = [...porTab].map(([tab, v]) => {
      const de = items.filter(i => i.tab === tab),
        m = de.filter(i => !i.f3),
        b3 = de.filter(i => i.f3).reduce((s, i) => s + i.P / 3, 0);
      return {
        tab,
        ph: v,
        desb: desbal(v),
        desbMin:
          tab === "TG"
            ? desbMin
            : desbal(
                optimo(
                  m.map(i => i.P),
                  [b3, b3, b3]
                ).ph
              ),
        mayor: (([q]) => (q ? { id: q.id, desc: q.desc || q.ref || "", P: q.P } : null))(
          m.slice().sort((a, b) => b.P - a.P)
        )
      };
    });
  return {
    nm,
    ph,
    avg: (ph[0] + ph[1] + ph[2]) / 3,
    desb: desbal(ph),
    desbMin,
    tabs,
    nFix,
    items,
    mayor: mono.slice().sort((a, b) => b.P - a.P)[0] || null
  };
}
