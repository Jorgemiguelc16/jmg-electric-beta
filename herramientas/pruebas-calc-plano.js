/* Pruebas del cálculo con el diseño del plano (parte de «npm test»).
   Un diseño pequeño, con las medidas calculadas a mano, para comprobar planoCalc() (js/calculo/calculo-plano.js) y calcUni
   con «Calcular con el diseño»: recorridos por las tuberías con sus tramos verticales, derivaciones, potencia de
   cada salida (propia, del tipo de luminaria o de Parámetros), cargas especiales y alimentador del medidor al TG.
   Alturas por defecto: techo 2.9 m, tablero 1.8 m (borde superior), tomacorriente 0.4 m, terma 1.5 m, medidor 1.1 m. */
const vm = require("vm");

// Diseño en metros (1 unidad = 1 m), con el tablero TG en (0, 0)
const sim = (id, k, x, y, o = {}) => ({ id, t: "sim", k, x, y, r: 0, capa: "E-ALUMBRADO", ...o });
const tub = (id, pts, o = {}) => ({ id, t: "tub", pts, modo: "techo", capa: "E-TUBERIAS-TECHO", ...o });
const DIS = {
  capas: [],
  els: [
    sim("d1", "tab", 0, 0, { nom: "TG", nc: 4, ct: ["al", "tg", "esp", "res"] }),
    // C-1 alumbrado: 100 W (Parámetros) a 4 m y 18 W (tipo L1) a 7 m, por el techo
    sim("d2", "luz", 4, 0, { cir: "C-1", tab: "d1" }),
    sim("d3", "luz", 4, 3, { cir: "C-1", tab: "d1", lt: "L1" }),
    sim("d4", "int", 6, 0, { cir: "C-1", tab: "d1" }),
    tub("d10", [0, 0, 4, 0], { cir: "C-1", tab: "d1", c0: "d1", c1: "d2" }),
    tub("d11", [4, 0, 4, 3], { cir: "C-1", tab: "d1", c0: "d2", c1: "d3" }),
    tub("d12", [4, 0, 6, 0], { cir: "C-1", tab: "d1", c0: "d2", c1: "d4" }),
    // C-2 tomacorrientes por el piso: uno a 5 + 3 m y otro en una derivación desde el quiebre, a 5 + 2 m
    sim("d5", "toma", 3, -5, { cir: "C-2", tab: "d1" }),
    sim("d6", "toma", -2, -5, { cir: "C-2", tab: "d1" }),
    tub("d13", [0, 0, 0, -5, 3, -5], { modo: "piso", cir: "C-2", tab: "d1", c0: "d1", c1: "d5" }),
    tub("d14", [0, -5, -2, -5], { modo: "piso", cir: "C-2", tab: "d1", c1: "d6" }),
    // C-3 terma de 1500 W por la pared, a 3 m
    sim("d7", "terma", -3, 0, { cir: "C-3", tab: "d1", p: 1500 }),
    tub("d15", [0, 0, -3, 0], { modo: "pared", cir: "C-3", tab: "d1", c0: "d1", c1: "d7" }),
    // Alimentador: medidor a 10 m del TG, por el piso
    sim("d8", "med", 10, 0),
    tub("d16", [10, 0, 0, 0], { modo: "piso", ali: true, c0: "d8", c1: "d1" })
  ],
  lums: [{ id: "L1", n: "Panel LED", w: 18 }]
};
const PROY = {
  MODE: "uni",
  sist: "mono220",
  area: "100",
  Lalim: "15",
  al_n: "18",
  al_p: "100",
  al_L: "20",
  tg_n: "22",
  tg_p: "180",
  tg_L: "22",
  tc_n: "0",
  cargas: [{ nombre: "Ducha escrita a mano", tipo: "calentador", fases: 1, p: 3500, L: 12 }],
  PLANO: { nombre: "prueba.dxf", sha: "0".repeat(40), f: 1, plantas: [], dis: DIS }
};

module.exports = function probarPlano(ctx) {
  let nv = 0;
  const t0 = Date.now(),
    fallas = [],
    cerca = (a, b) => Math.abs(a - b) < 1e-6,
    ver = (nom, a, b) => {
      nv++;
      if (typeof b === "number" ? !(typeof a === "number" && cerca(a, b)) : JSON.stringify(a) !== JSON.stringify(b))
        fallas.push(`${nom}: se esperaba ${JSON.stringify(b)} y salió ${JSON.stringify(a)}`);
    };
  const calc = o => {
    const p = vm.runInContext("proyectoDe", ctx)(JSON.parse(JSON.stringify(o)));
    return vm.runInContext("calcular", ctx)(p);
  };
  // Sin el modo: el diseño no cambia nada
  const r0 = calc(PROY);
  ver("sin el modo, circuitos escritos (2 de alumbrado, 2 de tomacorrientes y la ducha)", r0.circ.length, 5);
  ver("sin el modo, sin datos del plano", r0.plano, undefined);
  // Con el modo
  const r = calc({ ...PROY, calPlano: "1" }),
    q = id => r.circ.find(x => x.id === id) || {};
  ver(
    "circuitos del plano (la reserva no se calcula)",
    r.circ.map(x => x.id),
    ["C-1", "C-2", "C-3"]
  );
  // C-1: techo 2.9 − tablero 1.8 = 1.1 m de subida, 4 + 3 m por el techo
  ver("C-1 potencia (100 W de Parámetros + 18 W del tipo L1)", q("C-1").P, 118);
  ver("C-1 salidas con carga", q("C-1").n, 2);
  ver("C-1 longitud a la salida más alejada", q("C-1").L, 8.1);
  ver("C-1 parte horizontal", q("C-1").plano.Lh, 7);
  ver("C-1 salida más alejada", q("C-1").plano.lej, "d3");
  ver("C-1 tipo", q("C-1").tipo, "Alumbrado");
  // C-2: 1.8 m del tablero al piso, 5 + 3 m, 0.4 m de subida a la toma
  ver("C-2 potencia (2 × 180 W)", q("C-2").P, 360);
  ver("C-2 longitud", q("C-2").L, 10.2);
  ver("C-2 salida más alejada", q("C-2").plano.lej, "d5");
  // C-3: por la pared desde el tablero (1.8 m), 3 m, y 0.3 m de bajada a la terma (1.5 m)
  ver("C-3 longitud", q("C-3").L, 3.3);
  ver("C-3 potencia", q("C-3").P, 1500);
  ver("C-3 tipo", q("C-3").tipo, "Calentador de agua / ducha");
  // Alimentador: 1.1 m del medidor al piso, 10 m, 1.8 m al tablero
  ver("alimentador del plano", r.alims[0].L, 12.9);
  // Cargas especiales: solo la del plano (la escrita es del TG, que sale del plano)
  ver(
    "cargas especiales",
    r.cs.map(x => [x.nombre, x.tipo, x.p, x.L]),
    [["Terma eléctrica", "calentador", 1500, 3.3]]
  );
  // Máxima demanda (Regla 050-200): 2500 + 1000 por los 10 m² sobre 90 m², más la terma al 100 %
  ver("máxima demanda", r.md.MD, 5000);
  ver("carga instalada (118 + 360 + 1500)", r.CI, 1978);
  ver("sin avisos", r.plano.avisos, []);
  // La memoria y el expediente dicen de dónde salen los datos (solo con el diseño)
  const fuente = vm.runInContext("planoFuente", ctx);
  ver("origen de los datos: circuitos, longitudes, agrupamiento, alimentador y cargas", fuente(r).length, 5);
  ver("sin el diseño, sin origen de los datos", fuente(r0).length, 0);
  ver(
    "caída de tensión del C-2 con la carga conectada",
    q("C-2").dVp,
    ((2 * r.c.rho * 10.2 * (360 / (220 * r.c.fp))) / q("C-2").S / 220) * 100
  );
  // Una salida sin tubería: aviso y longitud estimada en línea quebrada desde el tablero
  const d2 = JSON.parse(JSON.stringify(PROY));
  d2.PLANO.dis.els.push(sim("d9", "toma", 6, 6, { cir: "C-2", tab: "d1" }));
  const r2 = calc({ ...d2, calPlano: "1" }),
    q2 = r2.circ.find(x => x.id === "C-2");
  ver("salida sin recorrido: estimada", q2.L, 12);
  ver(
    "salida sin recorrido: aviso",
    r2.plano.avisos.map(a => a.k),
    ["ruta"]
  );
  // Áreas marcadas (vivienda: dimensiones interiores, Regla 050-110) y una tubería con dos circuitos (Tabla 5C)
  const d3 = JSON.parse(JSON.stringify(PROY)),
    rect = (id, x0, y0, x1, y1, tp) => ({
      id,
      t: "lin",
      c: true,
      capa: "E-AREAS",
      pts: [x0, y0, x1, y0, x1, y1, x0, y1],
      ar: { tp, n: id }
    });
  d3.PLANO.dis.els.push(
    rect("d20", 0, 0, 5, 4, "tech"),
    rect("d21", 5, 0, 11, 5, "tech"),
    rect("d22", 0, 10, 5, 12, "libre")
  );
  d3.PLANO.dis.els.find(e => e.id === "d10").cx = ["C-2"];
  const r3 = calc({ ...d3, calPlano: "1", wLib: "5" }),
    q3 = id => r3.circ.find(x => x.id === id);
  ver("área techada del plano (20 + 30 m²)", r3.areaT, 50);
  ver("área libre del plano: 10 m² × 5 W/m²", r3.md.libre, 50);
  ver("máxima demanda con las áreas del plano (2500 + 1500 + 50)", r3.md.MD, 4050);
  // Un área con tipo de departamento (de cuando el proyecto era edificio) en vivienda u otros usos: es del piso
  const d3b = JSON.parse(JSON.stringify(d3));
  d3b.PLANO.dis.els.forEach(e => e.ar && (e.ar.dep = 0));
  ver(
    "área con tipo de departamento fuera de un edificio: cuenta en el piso",
    calc({ ...d3b, calPlano: "1" }).areaT,
    50
  );
  ver("C-1 agrupado con el C-2 en una tubería: Tabla 5C, 2 circuitos", q3("C-1").grp, { n: 2, fa: 0.8 });
  ver("C-2 también agrupado", q3("C-2").grp.fa, 0.8);
  ver("C-3 solo en sus tuberías", q3("C-3").grp.fa, 1);
  ver("capacidad corregida del C-1 con su agrupamiento", q3("C-1").Izc, q3("C-1").Iz * r3.c.ft * 0.8);
  ver("la tubería compartida no cambia el recorrido del C-2", q3("C-2").L, 10.2);
  // Otros usos: el área por el contorno exterior (Regla 050-210)
  const d4 = JSON.parse(JSON.stringify(d3));
  d4.PLANO.dis.els.push(rect("d23", -0.15, -0.15, 11.15, 5.15, "ext"));
  const r4 = calc({ ...d4, calPlano: "1", uso: "oficina" });
  ver("otros usos: área exterior (11.3 × 5.3 m²)", r4.areaT, 11.3 * 5.3);
  const r5 = calc({ ...d3, calPlano: "1", uso: "oficina" });
  ver(
    "otros usos sin contorno exterior: aviso",
    r5.plano.avisos.some(x => x.k === "area"),
    true
  );
  // Pozo de tierra unido al TG: el conductor de tierra mide 3 m por el piso y 1.8 m hasta el tablero
  const d7 = JSON.parse(JSON.stringify(PROY));
  d7.PLANO.dis.els.push(
    sim("d40", "pat", 0, -3),
    tub("d41", [0, -3, 0, 0], { modo: "piso", ali: true, c0: "d40", c1: "d1" })
  );
  ver("conductor de tierra del pozo dibujado", calc({ ...d7, calPlano: "1" }).c.pozo.cond, 4.8);
  // Tomacorrientes dentro de la cocina: el circuito automático es de cocina
  const d8 = JSON.parse(JSON.stringify(PROY));
  d8.PLANO.dis.els.find(e => e.id === "d1").ct = ["al", "", "esp", "res"];
  d8.PLANO.dis.els.push({
    id: "d42",
    t: "lin",
    c: true,
    capa: "E-AREAS",
    pts: [-3, -6, 4, -6, 4, -4, -3, -4],
    ar: { tp: "tech", n: "Cocina" }
  });
  ver(
    "tomacorrientes en la cocina: circuito de cocina",
    calc({ ...d8, calPlano: "1" }).circ.find(q => q.id === "C-2").plano.ct,
    "tc"
  );
  // El tipo de ambiente manda sobre el nombre: «Ambiente 1» de tipo cocina sí; «Cocina» de tipo depósito no
  const ar8 = d8.PLANO.dis.els.find(e => e.id === "d42").ar;
  Object.assign(ar8, { n: "Ambiente 1", amb: "coc" });
  ver(
    "ambiente de tipo cocina (sin la palabra en el nombre): circuito de cocina",
    calc({ ...d8, calPlano: "1" }).circ.find(q => q.id === "C-2").plano.ct,
    "tc"
  );
  Object.assign(ar8, { n: "Cocina", amb: "dep" });
  ver(
    "ambiente llamado cocina pero de tipo depósito: tomacorrientes generales",
    calc({ ...d8, calPlano: "1" }).circ.find(q => q.id === "C-2").plano.ct,
    "tg"
  );
  // Alimentador por una tubería que llega al medidor, sin marcarla como alimentador
  const d6 = JSON.parse(JSON.stringify(PROY));
  delete d6.PLANO.dis.els.find(e => e.id === "d16").ali;
  ver("alimentador sin marcar, por llegar al medidor", calc({ ...d6, calPlano: "1" }).alims[0].L, 12.9);
  // Edificio multifamiliar: banco de medidores, TG y el tablero de un departamento del tipo A
  const M = {
    MODE: "multi",
    sistG: "tri380",
    tipos: [{ nombre: "Tipo A", cant: 2, area: 80, Ld: 30, nAl: 10, nTo: 12, Lc: 15 }],
    PLANO: {
      nombre: "edificio.dxf",
      sha: "1".repeat(40),
      f: 1,
      plantas: [],
      dis: {
        capas: [],
        els: [
          sim("d1", "bmed", 0, 0),
          sim("d2", "tab", 5, 0, { nom: "TG", nc: 1, fs: 3 }),
          sim("d3", "tab", 20, 0, { nom: "TD-A1", nc: 2, ct: ["al", "tg"], dep: 0 }),
          sim("d4", "luz", 20, 3, { cir: "C-1", tab: "d3" }),
          sim("d5", "luz", 20, 6, { cir: "C-1", tab: "d3" }),
          sim("d6", "toma", 23, 0, { cir: "C-2", tab: "d3" }),
          tub("d10", [0, 0, 5, 0], { modo: "piso", c0: "d1", c1: "d2" }),
          tub("d11", [0, 0, 20, 0], { modo: "piso", c0: "d1", c1: "d3" }),
          tub("d12", [20, 0, 20, 3], { cir: "C-1", tab: "d3", c0: "d3", c1: "d4" }),
          tub("d13", [20, 3, 20, 6], { cir: "C-1", tab: "d3", c0: "d4", c1: "d5" }),
          tub("d14", [20, 0, 23, 0], { modo: "piso", cir: "C-2", tab: "d3", c0: "d3", c1: "d6" })
        ]
      }
    }
  };
  const rm = calc({ ...M, calPlano: "1" });
  ver("edificio: alimentador general del banco al TG (1.1 + 5 + 1.8)", rm.alims[0].L, 7.9);
  ver("edificio: alimentador del departamento A desde el banco (1.1 + 20 + 1.8)", rm.T[0].Ld, 22.9);
  ver("edificio: salidas del tipo A del plano", [rm.T[0].nAl, rm.T[0].nTo], [2, 1]);
  ver("edificio: circuito más largo del tipo A (1.1 + 6)", rm.T[0].Lc, 7.1);
  ver("edificio sin el modo: datos escritos", calc(M).T[0].Ld, 30);
  ver(
    "edificio: circuitos del departamento A, los del plano (su tablero con el nombre del plano)",
    rm.circ.filter(q => q.tab === "TD-A1").map(q => [q.id, q.n, !!q.plano]),
    [
      ["C-1", 2, true],
      ["C-2", 1, true]
    ]
  );
  /* Medidor trifásico de la concesionaria → TG → banco de medidores: el alimentador general se mide desde el medidor
     (antes tomaba el banco, el más cercano) y el tramo TG → banco aparte; con el banco «en otro lugar», se calcula */
  const M3 = JSON.parse(JSON.stringify(M));
  M3.PLANO.dis.els.push(
    sim("d40", "med3", -10, 0),
    tub("d41", [-10, 0, -10, -2, 5, -2, 5, 0], { modo: "piso", c0: "d40", c1: "d2" })
  );
  const rm3 = calc({ ...M3, calPlano: "1" });
  ver("edificio: alimentador general desde el medidor de la concesionaria (1.1 + 19 + 1.8)", rm3.alims[0].L, 21.9);
  ver(
    "edificio: banco junto al TG, sin tramo TG → banco",
    rm3.alims.some(a => a.pKey === "bm"),
    false
  );
  ver("edificio: departamento A, desde el banco (1.1 + 20 + 1.8)", rm3.T[0].Ld, 22.9);
  const rm4 = calc({ ...M3, calPlano: "1", bmJunto: "0", Lbm: "40" }),
    bm4 = rm4.alims.find(a => a.pKey === "bm");
  ver("edificio: tramo TG → banco del plano (1.8 + 5 + 1.1)", bm4 && bm4.L, 7.9);
  ver("edificio: el plano reemplaza la longitud escrita del tramo", rm4.plano.campos.Lbm, 7.9);
  // Servicios generales dibujados (TSG con una electrobomba) y área de un departamento del tipo A
  const M2 = JSON.parse(JSON.stringify(M));
  M2.PLANO.dis.els.push(
    sim("d30", "tab", 5, -6, { nom: "TSG", nc: 1, ct: ["esp"] }),
    sim("d31", "fza", 9, -6, { cir: "C-1", tab: "d30", p: 1500, ctp: "motor", cn: "Electrobomba" }),
    tub("d32", [5, 0, 5, -6], { modo: "piso", ali: true, c0: "d2", c1: "d30" }),
    tub("d33", [5, -6, 9, -6], { modo: "piso", cir: "C-1", tab: "d30", c0: "d30", c1: "d31" }),
    {
      id: "d34",
      t: "lin",
      c: true,
      capa: "E-AREAS",
      pts: [0, 10, 8, 10, 8, 20, 0, 20],
      ar: { tp: "tech", n: "Dpto A", dep: 0 }
    }
  );
  const rm2 = calc({ ...M2, calPlano: "1" }),
    s1 = rm2.circ.find(q => q.tab === "TSG");
  ver("TSG del plano: la electrobomba como motor", [s1 && s1.id, s1 && s1.P, rm2.SV[0].tipo], ["C-1", 1500, "motor"]);
  ver("alimentador TG → TSG del plano (1.8 + 6 + 1.8)", rm2.alims[1].L, 9.6);
  ver("área del tipo A, marcada en el plano", rm2.T[0].area, 80);
  ver(
    "área de un solo departamento del tipo: sin aviso de áreas sumadas",
    rm2.plano.avisos.filter(a => /se están sumando/.test(a.m)).length,
    0
  );
  // Dos departamentos del mismo tipo con su área cada uno: se sumarían; se avisa con los dos tableros
  const M8 = JSON.parse(JSON.stringify(M2));
  M8.PLANO.dis.els.push(sim("d35", "tab", -20, 15, { nom: "TD-A2", nc: 2, ct: ["al", "tg"], dep: 0 }), {
    id: "d36",
    t: "lin",
    c: true,
    capa: "E-AREAS",
    pts: [-24, 10, -16, 10, -16, 20, -24, 20],
    ar: { tp: "tech", n: "Dpto A2", dep: 0 }
  });
  const av8 = calc({ ...M8, calPlano: "1" }).plano.avisos.find(a => /se están sumando/.test(a.m));
  ver(
    "dos departamentos del mismo tipo con su área: aviso con sus dos tableros",
    av8 && [av8.t, /TD-A1, TD-A2|TD-A2, TD-A1/.test(av8.m), [...av8.ids].sort()],
    ["aviso", true, ["d34", "d36"]]
  );
  // Tablero de departamento sin tipo elegido: con un solo tipo, pasa a ese tipo (con una nota); con varios, se avisa
  const M5 = JSON.parse(JSON.stringify(M));
  delete M5.PLANO.dis.els.find(e => e.id === "d3").dep;
  const rm5 = calc({ ...M5, calPlano: "1" });
  ver("tablero sin tipo y un solo tipo: sus salidas son del tipo A", [rm5.T[0].nAl, rm5.T[0].nTo], [2, 1]);
  ver(
    "tablero sin tipo y un solo tipo: nota en la revisión",
    rm5.plano.avisos.filter(a => a.k === "dep").map(a => a.t),
    ["info"]
  );
  const rm6 = calc({
    ...M5,
    calPlano: "1",
    tipos: [...M5.tipos, { nombre: "Tipo B", cant: 1, area: 60, Ld: 20, nAl: 6, nTo: 8, Lc: 12 }]
  });
  ver(
    "tablero sin tipo y dos tipos: aviso y datos escritos",
    [rm6.plano.avisos.filter(a => a.k === "dep").map(a => a.t), rm6.T.find(t => t.nombre === "Tipo A").nAl],
    [["aviso"], 10]
  );
  // Sin número de unidades escrito: el de los tableros del tipo dibujados
  const rm7 = calc({ ...M, calPlano: "1", tipos: [{ ...M.tipos[0], cant: "" }] });
  ver("unidades del tipo A: una por tablero dibujado", [rm7.T[0].cant, rm7.T[0].cantPlano], [1, true]);

  /* Montante a varios pisos: del banco de medidores a una caja de paso, que sube (09-93-05), atraviesa el 2do piso
     (09-93-07) y baja en el 3ro (09-93-06). Las tuberías de la caja al montante y del montante a cada tablero no están
     marcadas como alimentador: lo siguen siendo por continuar el del banco (criterio). Todo por el techo (2.90 m):
     banco 1.10 → techo 1.80; tablero (borde superior 1.80) → techo 1.10; entrepiso 3.10 m por piso. */
  const plantas3 = [1, 2, 3].map(n => ({
    n: `${n}${n === 1 ? "er" : n === 2 ? "do" : "er"} piso`,
    x0: 100 * (n - 1) - 10,
    y0: -10,
    x1: 100 * (n - 1) + 50,
    y1: 50
  }));
  const MV = {
    MODE: "multi",
    sistG: "tri380",
    tipos: [{ nombre: "Tipo A", cant: "", area: 80, Ld: 30, nAl: 10, nTo: 12, Lc: 15 }],
    PLANO: {
      nombre: "montante.dxf",
      sha: "2".repeat(40),
      f: 1,
      plantas: plantas3,
      dis: {
        capas: [],
        els: [
          sim("d1", "bmed", 0, 0),
          sim("d2", "tab", 0, 10, { nom: "TG", nc: 0, gen: true, fs: 3 }),
          tub("d9", [0, 0, 0, 10], { modo: "techo", c0: "d1", c1: "d2" }),
          sim("d50", "cajaCuad", 2, 0),
          sim("d51", "subida", 2, 1, { mon: "d54" }),
          tub("d52", [0, 0, 2, 0], { modo: "techo", c0: "d1", c1: "d50" }),
          tub("d53", [2, 0, 2, 1], { modo: "techo", c0: "d50", c1: "d51" }),
          sim("d54", "atrav", 102, 1, { mon: "d51", mon2: "d57" }),
          sim("d55", "tab", 106, 1, { nom: "TD-02", nc: 1, ct: ["al"], dep: 0 }),
          tub("d56", [102, 1, 106, 1], { modo: "techo", c0: "d54", c1: "d55" }),
          sim("d57", "bajada", 202, 1, { mon: "d54" }),
          sim("d58", "tab", 205, 1, { nom: "TD-03", nc: 1, ct: ["al"], dep: 0 }),
          tub("d59", [202, 1, 205, 1], { modo: "techo", c0: "d57", c1: "d58" }),
          sim("d60", "luz", 106, 4, { cir: "C-1", tab: "d55" }),
          tub("d61", [106, 1, 106, 4], { cir: "C-1", tab: "d55", c0: "d55", c1: "d60" }),
          sim("d62", "luz", 205, 4, { cir: "C-1", tab: "d58" }),
          tub("d63", [205, 1, 205, 4], { cir: "C-1", tab: "d58", c0: "d58", c1: "d62" })
        ]
      }
    }
  };
  const rv = calc({ ...MV, calPlano: "1" });
  // TD-03: 1.8 + 2 + 1 + 3.1 + 3.1 + 3 + 1.1 = 15.1 (el más largo del tipo); TD-02: 1.8 + 2 + 1 + 3.1 + 4 + 1.1 = 13
  ver("montante a dos pisos: alimentador más largo del tipo, al 3er piso (dos entrepisos)", rv.T[0].Ld, 15.1);
  ver("montante a dos pisos: dos tableros del tipo, dos unidades", rv.T[0].cant, 2);
  const MV2 = JSON.parse(JSON.stringify(MV));
  MV2.PLANO.dis.els = MV2.PLANO.dis.els.filter(e => !["d55", "d56", "d60", "d61"].includes(e.id));
  ver(
    "montante que atraviesa un piso sin tuberías propias: sigue hasta el 3er piso",
    calc({ ...MV2, calPlano: "1" }).T[0].Ld,
    15.1
  );
  // Recorrido del alimentador (ids, sin enumerar): qué cajas, montantes y tuberías pasa (ventana de la caja de paso)
  const idsTD3 = rv.pld.desdeMed.d58.ids;
  ver(
    "recorrido del alimentador al TD-03: banco, caja, montante de tres pisos y sus tuberías",
    ["d1", "d52", "d50", "d53", "d51", "d54", "d57", "d59", "d58"].every(id => idsTD3.includes(id)) &&
      !idsTD3.includes("d56") &&
      !Object.keys(rv.pld.desdeMed.d58).includes("ids"),
    true
  );
  // El montante sale de la caja de paso cuadrada (sin la canalización hacia arriba): 1.8 + 2 + 3.1 + 3.1 + 3 + 1.1
  const MV3 = JSON.parse(JSON.stringify(MV));
  MV3.PLANO.dis.els = MV3.PLANO.dis.els.filter(e => !["d51", "d53"].includes(e.id));
  MV3.PLANO.dis.els.find(e => e.id === "d50").mon = "d54";
  MV3.PLANO.dis.els.find(e => e.id === "d54").mon = "d50";
  ver("montante desde la caja de paso: sube sin canalización aparte", calc({ ...MV3, calPlano: "1" }).T[0].Ld, 14.1);

  const s = ((Date.now() - t0) / 1000).toFixed(2);
  if (fallas.length) {
    console.log("✘ Cálculo con el diseño:");
    fallas.forEach(f => console.log("    " + f));
  } else console.log(`✔ Cálculo con el diseño: ${nv} comprobaciones en ${s} s`);
  return fallas.length;
};
