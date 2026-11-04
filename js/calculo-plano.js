/* CÁLCULO · DATOS DEL DISEÑO EN EL PLANO
   planoCalc() lee el diseño eléctrico dibujado sobre el plano (PLANO.dis, js/diseno.js) y devuelve lo que el cálculo
   necesita, sin leer la pantalla: por cada tablero, sus circuitos con las salidas conectadas, la carga conectada
   (Regla 050-102(3)) y la longitud hasta la salida más alejada (Regla 050-102(1) y (2)), medida por las tuberías
   más los tramos verticales según las alturas de montaje; las cargas especiales dibujadas, y los recorridos de los
   alimentadores (del medidor al TG y del TG a cada TD, por los montantes). Parte del motor de js/calculo.js: lo usa
   calcUni (js/calculo-vivienda.js) cuando el proyecto se calcula con el diseño, y la ventana «Datos para el
   cálculo» del editor.
   Criterios de la plataforma (no los fija el CNE), explicados en la ventana y en el manual:
   - recorrido: el camino más corto por las tuberías del circuito, desde el tablero hasta cada salida;
   - tramos verticales: la tubería por el techo va a la altura del techo y la del piso a 0 m; en cada artefacto se
     suma lo que sube o baja hasta su altura de montaje (la suya o la de Parámetros › Alturas), y en el tablero
     desde su borde superior; la tubería por la pared va a la altura del artefacto donde empieza;
   - montantes: cada par subida–bajada suma la altura de entrepiso por cada piso que atraviesa;
   - potencia de cada salida: la suya; si no tiene, la de su tipo de luminaria o la de Parámetros (W por salida);
   - agrupamiento (Tabla 5C, ítem 1): el mayor número de circuitos que van juntos en alguna tubería del circuito;
   - áreas: las marcadas en el plano, por piso (Regla 050-110: dimensiones interiores en vivienda; Regla 050-210:
     exteriores en otros usos; esa elección la hace calcUni). */
// Piso del cálculo de una planta encuadrada: el elegido o, si no, el de su nombre («Sótano» 0, «2do piso» 2…) o su orden
function plPisoPlanta(p, i) {
  if (Number.isInteger(p.piso)) return p.piso;
  const n = String(p.n || "");
  if (/s[oó]tano/i.test(n)) return 0;
  if (/azotea|techo/i.test(n)) return -1;
  const m = /(\d+)/.exec(n);
  return m ? +m[1] : i + 1;
}
// ¿El punto está dentro del polígono [x0, y0, x1, y1…]?
function plDentro(x, y, p) {
  let d = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2)
    if (p[i + 1] > y !== p[j + 1] > y && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) d = !d;
  return d;
}
// Ambientes de cocina y lavandería (por el nombre del área): sus tomacorrientes son del circuito de cocina
const PL_COCINA = /cocina|lavander|kitchen/i;
// Área de un polígono (unidades del dibujo al cuadrado)
function plAreaPol(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i += 2) {
    const j = (i + 2) % n;
    a += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return Math.abs(a) / 2;
}
// Tipos de área (para el cálculo): techada, sótano, libre no techada, de aulas o alta intensidad, contorno exterior
const PL_TAREA = {
  tech: "Techada (dimensiones interiores)",
  ext: "Contorno exterior del piso",
  sot: "Sótano",
  libre: "Libre no techada",
  aulas: "Aulas o alta intensidad",
  no: "No se cuenta"
};

// Tipos de circuito del tablero (ventana Tablero del editor)
const PL_TCIR = {
  al: "Alumbrado",
  tg: "Tomacorrientes",
  tc: "Tomacorrientes cocina / lavandería",
  esp: "Carga especial",
  res: "Reserva"
};
/* Artefactos del diseño para el cálculo: [clase, altura de montaje por defecto]. Clase: «al» salida de alumbrado,
   «to» tomacorriente, «esp» carga especial, «» sin carga (interruptores, cajas, comunicaciones). Altura: «T» en el
   techo, un número fijo (0 en el piso), una clave de las alturas de Parámetros (ctx().alt) o null (sigue a la
   tubería, como las canalizaciones verticales). Las alturas son las mismas de DS_CAT (js/diseno.js); la prueba de la
   interfaz comprueba que coincidan. */
const PL_ART = {
  ...Object.fromEntries(
    ["luz", "luzEmp", "fluor", "fluorEmp", "fluorH", "fluorHE", "posLuz", "lamp", "lumG", "lum3", "lum5"]
      .concat(["proy", "proyIl", "proyDir"])
      .map(k => [k, ["al", "T"]])
  ),
  ...Object.fromEntries(["braq", "braqEmp", "posLuzP", "emer", "emerB"].map(k => [k, ["al", "braq"]])),
  ...Object.fromEntries(
    ["toma", "toma1", "toma3", "tomaPA", "tomaG", "tomaMult", "tomaTres", "tomaPE", "tomaObt", "tomaInt"]
      .concat(["tomaEnc", "tomaTr"])
      .map(k => [k, ["to", "toma"]])
  ),
  tomaPiso: ["to", 0],
  toma3Piso: ["to", 0],
  coc: ["esp", "fza"],
  aire: ["esp", "aire"],
  fza: ["esp", "fza"],
  terma: ["esp", "terma"],
  vent: ["esp", "T"],
  aux: ["", "T"],
  caja: ["", "T"],
  cajaCon: ["", "T"],
  terminal: ["", "T"],
  subida: ["", null],
  bajada: ["", null],
  atrav: ["", null],
  tab: ["", "tab"],
  tabD: ["", "tab"],
  centroDist: ["", "tab"],
  med: ["", "med"],
  med3: ["", "med"],
  bmed: ["", "med"],
  pat: ["", 0],
  timbre: ["", "braq"],
  ...Object.fromEntries(["telG", "telTP", "telTV", "telFX", "telM", "telFM", "telTX"].map(k => [k, ["", "toma"]]))
};
// Los demás (interruptores, pulsadores, interfono, relojes…) van a la altura de los interruptores
const plArt = k => PL_ART[k] || ["", "int"];
// Cargas especiales: tipo de carga para la máxima demanda (TIPOS), fases y descripción por defecto
const PL_ESP = {
  coc: ["cocina", 3, "Cocina eléctrica"],
  aire: ["aire", 1, "Aire acondicionado"],
  fza: ["otra", 1, "Carga de fuerza"],
  terma: ["calentador", 1, "Terma eléctrica"],
  vent: ["otra", 1, "Ventilador"]
};
// Tomacorrientes trifásicos
const PL_TRI = new Set(["toma3", "toma3Piso"]);
// Medidores de la concesionaria (monofásico, trifásico y banco de medidores): de ellos salen los alimentadores
const PL_MED = new Set(["med", "med3", "bmed"]);
// Descripción por defecto de cada tipo de circuito y su «tipo» en el resultado (el que leen el metrado y los avisos)
const PL_DESC = { al: "Alumbrado", tg: "Tomacorrientes", tc: "Tomacorrientes cocina / lavandería" };
const PL_TIPO = { al: "Alumbrado", tg: "Tomacorriente", tc: "Tomacorriente" };

/* Origen de los datos de un resultado calculado con el diseño (para la memoria y el expediente): frases que dicen
   qué se midió en el plano y con qué criterio. Sin el diseño, ninguna. */
function planoFuente(r) {
  const P = r && r.plano;
  if (!P) return [];
  const L = [],
    nc = r.circ.filter(q => q.plano).length,
    multi = r.mode === "multi",
    areas = multi ? r.T.some(t => t.areaPlano) : P.areas && P.areas.length;
  if (areas)
    L.push(
      multi || r.viv
        ? "Las áreas de vivienda se midieron sobre el plano de arquitectura por las dimensiones interiores de los ambientes techados (Regla 050-110)."
        : "Las áreas se midieron sobre el plano de arquitectura por el contorno exterior de cada piso (Regla 050-210)."
    );
  if (nc)
    L.push(
      `Los ${nc} circuitos derivados de ${P.tabs.join(", ")} son los del plano de distribución: sus salidas y su carga conectada se contaron en el plano; la potencia de cada salida es la indicada en el diseño o, si no la tiene, la de los parámetros de diseño (W por salida).`,
      "La longitud de cada circuito es el recorrido de sus tuberías desde el tablero hasta la salida más alejada, más los tramos verticales según las alturas de montaje (criterio de medición del proyectista); la caída de tensión se calcula con la carga conectada a esa distancia (Regla 050-102).",
      "El factor de corrección por agrupamiento de cada circuito (Tabla 5C) corresponde al mayor número de circuitos que van juntos en una tubería de su recorrido."
    );
  if (P.ali || (P.Ld && P.Ld.length) || r.alims.some((a, i) => i && a.plano))
    L.push(
      "Las longitudes de los alimentadores se midieron por el recorrido de sus tuberías en el plano, desde el medidor o el tablero de origen, incluidos los montantes y los tramos verticales."
    );
  if ((r.cs || []).some(x => x.plano) || (multi && r.T.some(t => t.plano && t.plano.ce.length)))
    L.push("Las cargas especiales son las dibujadas en el plano, con su potencia, su tipo y su número de fases.");
  if (P.campos && P.campos.pzCond)
    L.push("La longitud del conductor de puesta a tierra se midió en el plano, del tablero general al pozo de tierra.");
  return L;
}
// Longitud de cada tramo de una tubería (recta o arco, con la curvatura «b» como en js/diseno.js), en unidades
function plTramosL(t) {
  const p = t.pts,
    b = t.b || [],
    out = [];
  for (let i = 0; i + 3 < p.length; i += 2) {
    const c = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]),
      k = b[i / 2] || 0;
    if (k && c) {
      const th = 4 * Math.atan(Math.abs(k));
      out.push((c / (2 * Math.sin(th / 2))) * th);
    } else out.push(c);
  }
  return out;
}
// Camino más corto desde un nodo: distancias totales y su parte horizontal, y el nodo anterior
function plDijkstra(G, ini) {
  const D = new Map([[ini, 0]]),
    H = new Map([[ini, 0]]),
    hecho = new Set();
  // Montículo binario simple de [distancia, nodo]
  const M = [[0, ini]],
    sube = i => {
      while (i) {
        const p = (i - 1) >> 1;
        if (M[p][0] <= M[i][0]) break;
        [M[p], M[i]] = [M[i], M[p]];
        i = p;
      }
    },
    baja = i => {
      for (;;) {
        const a = 2 * i + 1,
          b = a + 1;
        let m = i;
        if (a < M.length && M[a][0] < M[m][0]) m = a;
        if (b < M.length && M[b][0] < M[m][0]) m = b;
        if (m === i) break;
        [M[m], M[i]] = [M[i], M[m]];
        i = m;
      }
    };
  while (M.length) {
    const [d, u] = M[0],
      ult = M.pop();
    if (M.length) {
      M[0] = ult;
      baja(0);
    }
    if (hecho.has(u)) continue;
    hecho.add(u);
    (G.get(u) || []).forEach(([v, w, h]) => {
      const nd = d + w;
      if (nd < (D.has(v) ? D.get(v) : Infinity) - 1e-12) {
        D.set(v, nd);
        H.set(v, H.get(u) + h);
        M.push([nd, v]);
        sube(M.length - 1);
      }
    });
  }
  return { D, H };
}

/* Datos del diseño para el cálculo. PL: el plano del proyecto ({ f, plantas, dis }); c: ctx() del proyecto;
   v: { al_p, tg_p, tc_p, hEnt } (W por salida y altura de entrepiso). Devuelve null si no hay diseño. */
function planoCalc(PL, c, v) {
  const dis = PL && PL.dis;
  if (!dis || !Array.isArray(dis.els)) return null;
  const f = PL.f > 0 ? PL.f : 1,
    A = c.alt,
    T = A.techo,
    els = dis.els,
    por = new Map(els.map(e => [e.id, e])),
    tubs0 = els.filter(e => e.t === "tub" && Array.isArray(e.pts) && e.pts.length >= 4),
    sims = els.filter(e => e.t === "sim"),
    // La tubería que llega a un medidor es de un alimentador, aunque no esté marcada
    medIds = new Set(sims.filter(s => PL_MED.has(s.k)).map(s => s.id)),
    patIds = new Set(sims.filter(s => s.k === "pat").map(s => s.id)),
    esAli = t => t.ali || [t.c0, t.c1].some(id => medIds.has(id) || patIds.has(id)),
    // Ambientes de cocina o lavandería marcados como áreas
    cocinas = els.filter(e => e.ar && e.t === "lin" && PL_COCINA.test(e.ar.n || "") && e.pts.length >= 6),
    enCocina = s => cocinas.some(a => plDentro(s.x, s.y, a.pts)),
    tubs = tubs0,
    tabs = sims.filter(e => e.k === "tab"),
    lums = new Map((dis.lums || []).map(x => [x.id, x])),
    avisos = [],
    aviso = (t, m, ids = [], k = "") => avisos.push({ t, m, ids, k }),
    plantas = PL.plantas || [],
    plantaDe = (x, y) => plantas.findIndex(p => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1),
    tol = 0.01 / f;
  // Altura de montaje de un artefacto (m desde el NPT); null: sigue a la tubería
  const altura = (el, tc) => {
    if (Number.isFinite(el.h)) return el.h;
    const a = plArt(el.k)[1];
    if (a === null) return null;
    if (a === "T") return T;
    if (typeof a === "number") return a;
    if (a === "toma" && tc) return A.tomaC;
    return A[a] ?? 0;
  };
  /* Grafo de un grupo de tuberías: nodos «D:id» (artefactos y tableros) y «V:tubería:i» (vértices). Cada arista
     lleva [nodo, longitud total, parte horizontal] en metros. tc: el circuito es de cocina (altura de tomas). */
  function grafo(lista, tc) {
    const G = new Map(),
      arista = (a, b, w, h) => {
        if (!G.has(a)) G.set(a, []);
        if (!G.has(b)) G.set(b, []);
        G.get(a).push([b, w, h]);
        G.get(b).push([a, w, h]);
      },
      nivel = new Map(),
      puntas = [];
    lista.forEach(t => {
      const L = plTramosL(t),
        n = t.pts.length / 2,
        s0 = t.c0 && por.get(t.c0),
        s1 = t.c1 && por.get(t.c1),
        h0 = s0 ? altura(s0, tc) : null,
        h1 = s1 ? altura(s1, tc) : null,
        lv = t.modo === "piso" ? 0 : t.modo === "pared" ? (h0 ?? h1 ?? T) : T;
      nivel.set(t.id, lv);
      for (let i = 0; i < n - 1; i++) arista(`V:${t.id}:${i}`, `V:${t.id}:${i + 1}`, L[i] * f, L[i] * f);
      [
        [s0, h0, 0],
        [s1, h1, n - 1]
      ].forEach(([s, h, i]) => {
        if (s) arista(`D:${s.id}`, `V:${t.id}:${i}`, h === null ? 0 : Math.abs(lv - h), 0);
        else puntas.push({ t, i, x: t.pts[2 * i], y: t.pts[2 * i + 1] });
      });
    });
    // Derivaciones: la punta suelta de una tubería sobre un vértice de otra
    puntas.forEach(q =>
      lista.forEach(o => {
        if (o === q.t) return;
        for (let j = 0; j < o.pts.length; j += 2)
          if (Math.abs(o.pts[j] - q.x) < tol && Math.abs(o.pts[j + 1] - q.y) < tol)
            arista(`V:${q.t.id}:${q.i}`, `V:${o.id}:${j / 2}`, Math.abs(nivel.get(q.t.id) - nivel.get(o.id)), 0);
      })
    );
    // Montantes: la subida de un piso y la bajada del otro, unidas por la altura de entrepiso
    sims.forEach(s => {
      const o = s.mon && por.get(s.mon);
      if (!o || s.id > o.id || !G.has(`D:${s.id}`) || !G.has(`D:${o.id}`)) return;
      const pi = plantaDe(s.x, s.y),
        pj = plantaDe(o.x, o.y),
        k = Math.max(
          1,
          pi >= 0 && pj >= 0 ? Math.abs(plPisoPlanta(plantas[pi], pi) - plPisoPlanta(plantas[pj], pj)) : 1
        );
      arista(`D:${s.id}`, `D:${o.id}`, k * v.hEnt, 0);
    });
    return G;
  }
  // Tuberías y artefactos de cada circuito («tablero·circuito»)
  const tubC = new Map(),
    simC = new Map(),
    clave = (tb, cir) => `${tb}·${cir}`;
  const cirsDe = t => [...new Set([t.cir, ...(t.cx || [])].filter(Boolean))];
  tubs.forEach(t => {
    if (!t.cir || !t.tab || esAli(t)) return;
    cirsDe(t).forEach(cir => {
      const k = clave(t.tab, cir);
      if (!tubC.has(k)) tubC.set(k, []);
      tubC.get(k).push(t);
    });
  });
  sims.forEach(s => {
    if (!s.cir || !s.tab || s.k === "tab") return;
    const k = clave(s.tab, s.cir);
    if (!simC.has(k)) simC.set(k, []);
    simC.get(k).push(s);
  });
  // Nombres repetidos
  const vistos = {};
  tabs.forEach(tb => {
    const n = tb.nom || "TG";
    if (vistos[n])
      aviso("error", `Hay dos tableros con el nombre ${n}: cada tablero necesita un nombre propio`, [tb.id, vistos[n]]);
    else vistos[n] = tb.id;
  });
  const cargas = [];
  const R = tabs.map(tb => {
    const nom = tb.nom || "TG",
      circs = [];
    for (let i = 0; i < (tb.nc || 0); i++) {
      const cir = "C-" + (i + 1),
        k = clave(tb.id, cir),
        ss = simC.get(k) || [],
        tt = tubC.get(k) || [],
        cargo = ss.filter(s => plArt(s.k)[0]),
        cnt = { al: 0, to: 0, esp: 0 };
      cargo.forEach(s => cnt[plArt(s.k)[0]]++);
      // Tipo del circuito: el elegido en la ventana Tablero o, si no, el de sus salidas
      const ct = (tb.ct || [])[i],
        tomas = cargo.filter(s => plArt(s.k)[0] === "to"),
        // Tomacorrientes, todos dentro de la cocina o la lavandería: circuito de cocina
        auto =
          cnt.esp && !cnt.al && !cnt.to
            ? "esp"
            : cnt.al > cnt.to
              ? "al"
              : cnt.to
                ? tomas.every(enCocina)
                  ? "tc"
                  : "tg"
                : "",
        tipo = PL_TCIR[ct] ? ct : auto;
      if (tipo === "res") continue;
      if (!cargo.length) {
        if (tt.length || ss.length)
          aviso(
            "aviso",
            `${nom} ${cir}: no tiene salidas con carga conectadas (no se calcula)`,
            [...ss, ...tt].map(e => e.id)
          );
        continue;
      }
      if (!PL_TCIR[ct] && cnt.al && cnt.to)
        aviso(
          "aviso",
          `${nom} ${cir}: mezcla salidas de alumbrado y tomacorrientes; elija su tipo en la ventana del tablero`,
          [tb.id],
          "tipo"
        );
      // Recorridos desde el tablero
      const G = grafo(tt, tipo === "tc"),
        { D, H } = plDijkstra(G, `D:${tb.id}`),
        sal = [];
      let P = 0,
        tri = false,
        elec = false;
      cargo.forEach(s => {
        const cl = plArt(s.k)[0],
          d = D.get(`D:${s.id}`),
          lt = s.lt && lums.get(s.lt);
        let p = Number.isFinite(s.p) ? s.p : null,
          de = "propia";
        if (p === null && cl === "al" && lt && lt.w > 0) {
          p = lt.w;
          de = `tipo ${lt.id}`;
        }
        if (p === null && cl === "al") {
          p = v.al_p;
          de = "Parámetros";
        }
        if (p === null && cl === "to" && !PL_TRI.has(s.k)) {
          p = tipo === "tc" ? v.tc_p : v.tg_p;
          de = "Parámetros";
        }
        if (p === null) {
          p = 0;
          de = "falta";
          aviso("error", `${nom} ${cir}: una salida no tiene potencia`, [s.id], "pot");
        }
        P += p;
        const f3 = cl === "esp" ? (s.fs || (PL_ESP[s.k] || [])[1]) === 3 : PL_TRI.has(s.k) || s.fs === 3;
        if (f3) tri = true;
        if (s.elc) elec = true;
        sal.push({ id: s.id, k: s.k, cl, p, de, d: d ?? null, h: d != null ? H.get(`D:${s.id}`) : null, f3 });
        if (cl === "esp" && p > 0) {
          const e = PL_ESP[s.k] || ["otra", 1, "Carga especial"];
          cargas.push({
            nombre: s.cn || e[2],
            tipo: TIPOS[s.ctp] ? s.ctp : e[0],
            p,
            fases: f3 ? 3 : 1,
            elec: s.elc ? 1 : 0,
            tab: nom,
            tabId: tb.id,
            cir,
            id: s.id
          });
        }
      });
      const sin = sal.filter(o => o.d === null);
      if (sin.length)
        aviso(
          "error",
          `${nom} ${cir}: ${sin.length} salida${sin.length > 1 ? "s" : ""} sin recorrido de tubería desde el tablero`,
          sin.map(o => o.id),
          "ruta"
        );
      if (cargo.length > c.maxSal && tipo !== "esp")
        aviso(
          "info",
          `${nom} ${cir}: ${cargo.length} salidas, más que el máximo de ${c.maxSal} por circuito elegido en Parámetros (criterio)`,
          [tb.id]
        );
      // Salida más alejada: la de mayor recorrido; sin recorrido, la distancia en línea quebrada (estimada)
      let lej = null;
      sal.forEach(o => {
        if (o.d !== null && (!lej || o.d > lej.d)) lej = o;
      });
      let L = lej ? lej.d : 0,
        Lh = lej ? lej.h : 0,
        est = false;
      if (sin.length) {
        sin.forEach(o => {
          const s = por.get(o.id),
            e = (Math.abs(s.x - tb.x) + Math.abs(s.y - tb.y)) * f;
          if (e > L) {
            L = e;
            Lh = e;
            lej = o;
            est = true;
          }
        });
      }
      // Agrupamiento: el mayor número de circuitos que van juntos en una de sus tuberías (Tabla 5C)
      const ng = tt.reduce((m, t) => Math.max(m, cirsDe(t).length), 1);
      if (ng > 20)
        aviso(
          "aviso",
          `${nom} ${cir}: va en una tubería con ${ng} circuitos; la Tabla 5C llega a 20 (se usa su factor)`,
          [tb.id]
        );
      // Metrado: todas las tuberías del circuito y sus tramos verticales
      let Lmet = 0;
      G.forEach(a => a.forEach(([, w]) => (Lmet += w / 2)));
      circs.push({
        cir,
        tipo,
        auto: !PL_TCIR[ct],
        desc: (tb.cd || [])[i] || "",
        sal,
        n: cargo.length,
        cnt,
        P,
        L: Math.max(L, 0.5),
        Lh,
        Lv: L - Lh,
        est,
        lej: lej ? lej.id : null,
        f3: tri,
        elec,
        ng,
        Lmet: Math.max(Lmet, L)
      });
    }
    return {
      id: tb.id,
      nom,
      circs,
      // Tablero trifásico (ventana Tablero) y tipo de departamento al que pertenece (edificio multifamiliar)
      ...(tb.fs ? { fs: tb.fs } : {}),
      ...(Number.isInteger(tb.dep) ? { dep: tb.dep } : {})
    };
  });
  // Alimentadores: tuberías marcadas como alimentador, del medidor al TG y del TG a cada tablero
  const ali = tubs.filter(esAli),
    GA = grafo(ali, false),
    TG = tabs.find(t => (t.nom || "TG") === "TG"),
    rutas = {},
    // Desde el medidor más cercano (o el banco de medidores) hasta cada tablero: alimentadores de los departamentos
    desdeMed = {};
  if (ali.length && medIds.size) {
    medIds.forEach(id => {
      if (!GA.has(`D:${id}`)) return;
      GA.get(`D:${id}`).push(["S", 0, 0]);
      if (!GA.has("S")) GA.set("S", []);
      GA.get("S").push([`D:${id}`, 0, 0]);
    });
    if (GA.has("S")) {
      const dm = plDijkstra(GA, "S");
      tabs.forEach(tb => {
        const d = dm.D.get(`D:${tb.id}`);
        if (d != null) desdeMed[tb.id] = { L: d, Lh: dm.H.get(`D:${tb.id}`) };
      });
    }
    // El nodo auxiliar no debe quedar en el grafo (no es un camino real)
    GA.delete("S");
    medIds.forEach(
      id =>
        GA.has(`D:${id}`) &&
        GA.set(
          `D:${id}`,
          GA.get(`D:${id}`).filter(([v]) => v !== "S")
        )
    );
  }
  if (TG && ali.length) {
    const desde = plDijkstra(GA, `D:${TG.id}`);
    sims
      .filter(s => PL_MED.has(s.k))
      .forEach(m => {
        const d = desde.D.get(`D:${m.id}`);
        if (d != null && (!rutas.TG || d < rutas.TG.L)) rutas.TG = { L: d, Lh: desde.H.get(`D:${m.id}`), de: m.id };
      });
    patIds.forEach(id => {
      const d = desde.D.get(`D:${id}`);
      if (d != null && (!rutas.PAT || d < rutas.PAT.L)) rutas.PAT = { L: d, Lh: desde.H.get(`D:${id}`), de: id };
    });
    tabs.forEach(tb => {
      if (tb === TG) return;
      const d = desde.D.get(`D:${tb.id}`);
      if (d != null) rutas[tb.nom || "TG"] = { L: d, Lh: desde.H.get(`D:${tb.id}`), de: TG.id };
    });
  }
  // Áreas: polilíneas cerradas con datos de área (ar), sumadas por piso y por tipo (m²)
  const areas = [],
    areaDep = {},
    pisos = {},
    sumar = (n, k, m2) => {
      const o = (pisos[n] = pisos[n] || { tech: 0, ext: 0, aulas: 0, sot: 0, libre: 0 });
      o[k] += m2;
    };
  els.forEach(e => {
    if (!e.ar || e.t !== "lin" || !Array.isArray(e.pts) || e.pts.length < 6) return;
    let cx = 0,
      cy = 0;
    for (let i = 0; i < e.pts.length; i += 2) {
      cx += e.pts[i];
      cy += e.pts[i + 1];
    }
    const k = e.pts.length / 2,
      ip = plantaDe(cx / k, cy / k),
      piso = plantas.length ? (ip >= 0 ? plPisoPlanta(plantas[ip], ip) : null) : 1,
      m2 = plAreaPol(e.pts) * f * f,
      tp = PL_TAREA[e.ar.tp] ? e.ar.tp : "tech";
    areas.push({ id: e.id, n: e.ar.n || "", tp, piso, m2, ...(Number.isInteger(e.ar.dep) ? { dep: e.ar.dep } : {}) });
    if (tp === "no") return;
    // Edificio: las áreas de un departamento (su tipo) van a ese tipo, no al piso
    if (Number.isInteger(e.ar.dep) && (tp === "tech" || tp === "ext")) {
      const o = (areaDep[e.ar.dep] = areaDep[e.ar.dep] || { m2: 0, plantas: new Set() });
      o.m2 += m2;
      o.plantas.add(ip);
      return;
    }
    if (piso === null)
      return aviso(
        "aviso",
        `El área ${e.ar.n || ""} está fuera de las plantas encuadradas (no se cuenta)`,
        [e.id],
        "area"
      );
    if (piso < 0) return;
    // El sótano: el área marcada como tal o la techada de una planta declarada sótano
    if (tp === "sot" || (piso === 0 && tp === "tech")) return sumar(0, "sot", m2);
    if (tp === "libre") return sumar(piso, "libre", m2);
    sumar(piso, tp, m2);
  });
  if (TG && medIds.size && !rutas.TG)
    aviso(
      "aviso",
      "El medidor no está unido al TG por una tubería: el alimentador se calcula con la longitud escrita",
      [...medIds],
      "ali"
    );
  return { tabs: R, cargas, rutas, desdeMed, avisos, areas, pisos, areaDep };
}
