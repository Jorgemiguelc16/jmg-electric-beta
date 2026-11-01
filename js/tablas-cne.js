/* TABLAS DEL CNE-UTILIZACIÓN Y CONSTANTES DEL CÁLCULO
   Secciones normalizadas, capacidad de corriente (Tabla 2), métodos de instalación (Tabla 4), factores
   de temperatura y agrupamiento (Tablas 5A y 5C), tierra (Tablas 16 y 17), interruptores, tubos, usos de
   la Tabla 14 y sistemas de suministro. Solo datos: cualquier valor aquí cambia los resultados.
   Se usa en: el motor de cálculo (calculo*.js), resultados.js, excel.js, expediente.js, el manual y las pruebas. */
const SECC = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
// Tabla 2 CNE-U: capacidad de corriente (A), cobre, 30 °C. [PVC 2 cond, PVC 3 cond, XLPE 2 cond, XLPE 3 cond] por método
const T2 = {
  A1: {
    pvc2: [14.5, 19.5, 26, 34, 46, 61, 80, 99, 119, 151, 182, 210],
    pvc3: [13.5, 18, 24, 31, 42, 56, 73, 89, 108, 136, 164, 188],
    xl2: [19, 26, 35, 45, 61, 81, 106, 131, 158, 200, 241, 278],
    xl3: [17, 23, 31, 40, 54, 73, 95, 117, 141, 179, 216, 249]
  },
  B1: {
    pvc2: [17.5, 24, 32, 41, 57, 76, 101, 125, 151, 192, 232, 269],
    pvc3: [15.5, 21, 28, 36, 50, 68, 89, 110, 134, 171, 207, 239],
    xl2: [23, 31, 42, 54, 75, 100, 133, 164, 198, 253, 306, 354],
    xl3: [20, 28, 37, 48, 68, 88, 117, 144, 175, 222, 269, 312]
  },
  B2: {
    pvc2: [16.5, 23, 30, 38, 52, 69, 90, 111, 133, 168, 201, 232],
    pvc3: [15, 20, 27, 34, 46, 62, 80, 99, 118, 149, 179, 206],
    xl2: [22, 30, 40, 51, 69, 91, 119, 146, 175, 221, 265, 305],
    xl3: [19.5, 26, 35, 44, 60, 80, 105, 128, 154, 194, 233, 268]
  },
  C: {
    pvc2: [19.5, 27, 36, 46, 63, 85, 112, 138, 168, 213, 258, 299],
    pvc3: [17.5, 24, 32, 41, 57, 76, 96, 119, 144, 184, 223, 259],
    xl2: [24, 33, 45, 58, 80, 107, 138, 171, 209, 269, 328, 382],
    xl3: [22, 30, 40, 52, 71, 96, 119, 147, 179, 229, 278, 322]
  }
};
const MET = {
  A1: "A1 · Conductores aislados en tubo empotrado en pared térmicamente aislante",
  B1: "B1 · Conductores aislados en tubo empotrado en mampostería o sobre pared (Tabla 4, ítems 4 y 59)",
  B2: "B2 · Cable multipolar en tubo sobre pared",
  C: "C · Cable unipolar o multipolar sobre pared"
};
const FT = {
  pvc: { 20: 1.12, 25: 1.06, 30: 1, 35: 0.94, 40: 0.87, 45: 0.79 },
  xl: { 20: 1.08, 25: 1.04, 30: 1, 35: 0.96, 40: 0.91, 45: 0.87 }
}; // Tabla 5A
const FA = { 1: 1, 2: 0.8, 3: 0.7, 4: 0.65, 5: 0.6, 6: 0.57 }; // Tabla 5C, ítem 1
const T16 = [
  [20, 2.5],
  [30, 4],
  [60, 6],
  [100, 10],
  [200, 16],
  [400, 25]
]; // conductor de protección según ITM
const T17 = [
  [100, 10],
  [125, 16],
  [200, 25],
  [260, 35],
  [355, 50],
  [475, 70],
  [1e9, 95]
]; // conductor de puesta a tierra según ampacidad del alimentador principal
const ITM = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400];
const ID_RAT = [25, 40, 63, 80, 100];
const PDC = [3, 4.5, 6, 10, 15, 20, 25, 36, 50];
const OD = {
  1.5: 3.0,
  2.5: 3.6,
  4: 4.2,
  6: 4.8,
  10: 6.6,
  16: 7.8,
  25: 9.7,
  35: 11.0,
  50: 12.8,
  70: 14.6,
  95: 16.8,
  120: 18.6
};
const TUBOS = [
  [20, '3/4"', 19],
  [25, '1"', 24],
  [35, '1 1/4"', 32],
  [40, '1 1/2"', 38],
  [50, '2"', 49],
  [65, '2 1/2"', 61],
  [80, '3"', 74]
];
const TIPOS = {
  calentador: "Calentador de agua / ducha (100 %)",
  cocina: "Cocina eléctrica",
  aire: "Aire acondicionado (100 %)",
  motor: "Motor (bomba, etc.)",
  otra: "Otra carga"
};
const TSERV = { alum: "Alumbrado / tomacorrientes", motor: "Motor", otra: "Otra carga" };
// FD: corriente de diseño de circuitos derivados y del alimentador de servicios generales (carga continua, Regla 050-104).
// Los alimentadores de vivienda y departamentos usan 1 + reserva (parámetro resAl): su carga calculada no es continua
// (Reglas 050-200(3) y 050-202(2)), por lo que la norma admite 0 %; 25 % es la reserva para ampliaciones usual en la práctica.
// Tabla 14 (Regla 050-210): W/m² y factores de demanda según el tipo de actividad.
// fd: tramos [hasta m², % acometida, % alimentador]; solo las oficinas tienen dos tramos (primeros 930 m² y exceso).
const USOS = {
  oficina: {
    n: "Oficinas",
    w: 50,
    fd: [
      [930, 90, 100],
      [Infinity, 70, 90]
    ]
  },
  comercial: { n: "Industrial, comercial", w: 25, fd: [[Infinity, 100, 100]] },
  bodegas: { n: "Bodegas, restaurantes", w: 30, fd: [[Infinity, 100, 100]] },
  bancos: { n: "Bancos", w: 25, fd: [[Infinity, 100, 100]] },
  barberias: { n: "Barberías y salones de belleza", w: 30, fd: [[Infinity, 90, 100]] },
  clubes: { n: "Clubes", w: 20, fd: [[Infinity, 80, 100]] },
  hospedajes: { n: "Hospedajes", w: 15, fd: [[Infinity, 80, 100]] },
  teatros: { n: "Teatros", w: 30, fd: [[Infinity, 75, 95]] },
  auditorios: { n: "Auditorios", w: 10, fd: [[Infinity, 80, 100]] },
  iglesias: { n: "Iglesias", w: 10, fd: [[Infinity, 100, 100]] },
  cortes: { n: "Cortes de justicia", w: 20, fd: [[Infinity, 100, 100]] },
  garajes: { n: "Garajes", w: 10, fd: [[Infinity, 100, 100]] },
  almacenaje: { n: "Edificios de almacenaje", w: 5, fd: [[Infinity, 70, 90]] },
  // Reglas propias (050-204, 050-206, 050-208): carga por área más cargas especiales; el factor de demanda se aplica a toda la carga
  // (salvo calefacción, Sección 270): f1 hasta 900 m² y, sobre 900 m², f1 a los primeros 900 m² y f2 al exceso, según la carga por m².
  // wE: W/m² del área especial (aulas o alta intensidad); resta: el área especial se descuenta del resto (escuelas) o se suma (hospitales).
  escuela: { n: "Escuelas", regla: "050-204", w: 10, wE: 50, resta: true, lblE: "Área de aulas", f1: 75, f2: 50 },
  hospital: {
    n: "Hospitales",
    regla: "050-206",
    w: 20,
    wE: 100,
    resta: false,
    lblE: "Área de alta intensidad (salas de operación)",
    f1: 80,
    f2: 65
  },
  hotel: { n: "Hoteles, moteles y dormitorios", regla: "050-208", w: 20, f1: 80, f2: 65 }
};
// Potencia por tomacorriente en usos comerciales: criterio de ingeniería (no lo fija el CNE-U); margen para varios equipos por punto
const VA_TOMA_COM = 250;
const RHO_CU = 0.0175,
  FD = 1.25,
  DV_ALIM = 2.5,
  DV_DER = 2.5,
  DV_TOT = 4,
  IMIN_UNI = 40,
  IMIN_DPTO = 25;
const SQ3 = Math.sqrt(3),
  VERSION = "v2.9";
// Sitio de pruebas (jorgemiguelc16.github.io/jmg-electric-beta/): el mismo código que el oficial, pero guarda sus
// proyectos aparte (los dos sitios comparten el almacenamiento del navegador porque están en el mismo dominio)
const BETA = typeof location !== "undefined" && location.pathname.includes("/jmg-electric-beta/");
const SIST = {
  mono220: { tri: false, V: 220, kI: 1, K: 2, n: 2, txt: "1φ 220 V", nom: "Monofásico 220 V", fases: ["—"] },
  tri220: {
    tri: true,
    V: 220,
    kI: SQ3,
    K: SQ3,
    n: 3,
    txt: "3φ 220 V",
    nom: "Trifásico 220 V",
    fases: ["R-S", "S-T", "T-R"]
  },
  tri380: {
    tri: true,
    V: 380,
    kI: SQ3,
    K: SQ3,
    n: 4,
    txt: "3φ 380/220 V",
    nom: "Trifásico 380/220 V",
    fases: ["R", "S", "T"]
  }
};
const SYS_OPC = [
  ["mono220", "Monofásico 220 V", "2 conductores + tierra", "Viviendas de demanda moderada sin motores trifásicos."],
  [
    "tri380",
    "Trifásico 380/220 V",
    "4 conductores (3F + N) + tierra",
    "Red con neutro a tierra múltiple. Edificios y viviendas de mayor demanda."
  ],
  [
    "tri220",
    "Trifásico 220 V",
    "3 conductores + tierra",
    "Red con neutro aislado. Cargas monofásicas entre fases y motores en 220 V."
  ]
];
