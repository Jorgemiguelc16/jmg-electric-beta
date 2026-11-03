/* Pruebas del cálculo con el diseño del plano (parte de «npm test»).
   Un diseño pequeño, con las medidas calculadas a mano, para comprobar planoCalc() (js/calculo-plano.js) y calcUni
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
  const s = ((Date.now() - t0) / 1000).toFixed(2);
  if (fallas.length) {
    console.log("✘ Cálculo con el diseño:");
    fallas.forEach(f => console.log("    " + f));
  } else console.log(`✔ Cálculo con el diseño: ${nv} comprobaciones en ${s} s`);
  return fallas.length;
};
