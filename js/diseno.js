/* DISEÑO ELÉCTRICO EN EL EDITOR (etapa 2 del diseño en planta)
   Los elementos que el proyectista dibuja sobre el plano de arquitectura, guardados en la copia del editor como
   EPL.dis = { capas, actual, els, escala, etq } (pasan al proyecto con Aplicar, en PLANO.dis):
   - símbolos de la Norma DGE «Símbolos gráficos en electricidad» (R.M. N.° 091-2002-EM/VME), los mismos de las
     láminas (simboloDGE() en js/simbolos.js), cada uno con su código, en la capa de su sistema, con rotación,
     altura de montaje, potencia y circuito; los que van en la pared se encajan solos en el muro más cercano;
   - tuberías por techo o pared (línea continua) o por piso (línea discontinua), con tramos rectos o curvos (como
     se dibujan en los planos) y su longitud real, la del arco; se muestran sus longitudes si se pide;
   - líneas, polilíneas, rectángulos y círculos en la capa actual; textos, cotas (alineadas y lineales) y
     directrices en sus capas;
   - capas propias del diseño con color, tipo de línea, visibilidad y bloqueo (Administrador de capas, js/capas.js).
   Cada tramo es una recta o un arco: «b» guarda la curvatura de cada tramo como en las polilíneas de AutoCAD
   (tangente de un cuarto del ángulo del arco; positiva, el arco va a la derecha del sentido del tramo).
   Todo se edita con pinzamientos: los vértices se mueven y el del medio de cada tramo lo curva.
   El tamaño de los símbolos, textos y cotas sale de la escala de impresión prevista (criterio: la Norma DGE, 024,
   permite agrandarlos o reducirlos conservando sus proporciones). Las coordenadas están en unidades del dibujo, las
   mismas del plano de arquitectura. La rejilla, los enganches y el encaje al muro son preferencias de esta
   computadora. */

// Sistemas: capa por defecto de lo que se coloca, su color y su tipo de línea
const DS_SIS = {
  alu: { capa: "E-ALUMBRADO", col: "#d08700", n: "Alumbrado" },
  tom: { capa: "E-TOMACORRIENTES", col: "#c62828", n: "Tomacorrientes" },
  fza: { capa: "E-FUERZA", col: "#7b1fa2", n: "Cargas especiales" },
  com: { capa: "E-COMUNICACIONES", col: "#00838f", n: "Comunicaciones" },
  can: { capa: "E-CANALIZACION", col: "#546e7a", n: "Canalización" },
  tab: { capa: "E-TABLEROS", col: "#14304f", n: "Tableros" },
  tie: { capa: "E-TIERRA", col: "#2e7d32", n: "Puesta a tierra" },
  tubT: { capa: "E-TUBERIAS-TECHO", col: "#1565c0", n: "Tuberías en techo o pared" },
  tubP: { capa: "E-TUBERIAS-PISO", col: "#0277bd", n: "Tuberías en piso" },
  cto: { capa: "E-CIRCUITOS", col: "#6a1b9a", n: "Circuitos y directrices" },
  cot: { capa: "E-COTAS", col: "#00796b", n: "Cotas" },
  txt: { capa: "E-TEXTOS", col: "#263238", n: "Textos" },
  dib: { capa: "E-DIBUJO", col: "#37474f", n: "Dibujo" }
};
/* Símbolos que se pueden colocar (toda la sección 093 de la Norma DGE «Instalaciones en edificaciones» y los tableros
   de la sección 091): nombre y código de la norma, sistema (capa), grupo de la biblioteca, altura de montaje por
   defecto (dato de Parámetros › Alturas; null si va en el techo o no corresponde), potencia por defecto (dato del
   proyecto) y cómo se apoya en el muro al encajarlo (m: «izq», su lado izquierdo toca el muro, como las líneas de
   llegada del tomacorriente o la barra del braquete; «abajo», el lado largo del tablero; «arriba», la llegada de los
   tomacorrientes en forma general). let: la letra o el número del tipo (abajo a la derecha, 09-93-13) se puede
   mover. Las letras A y F de las salidas de aire acondicionado y de fuerza son de las que la norma deja definir en
   la leyenda del plano. */
const DS_GRUPOS = [
  "Iluminación",
  "Interruptores",
  "Tomacorrientes",
  "Telecomunicaciones",
  "Pulsadores y control",
  "Tableros y medición",
  "Cajas y canalización",
  "Otros equipos"
];
const DS_CAT = Object.fromEntries(
  [
    // [clave, nombre, código, sistema, grupo, altura, potencia, unidad, apoyo, letra móvil]
    ["luz", "Salida de alumbrado en techo", "09-93-51", "alu", 0, null, "al_p", "W"],
    ["braq", "Salida de alumbrado en pared (braquete)", "09-93-52", "alu", 0, "hBraq", "al_p", "W", "izq"],
    ["luzEmp", "Salida de alumbrado empotrada en techo", "09-93-53", "alu", 0, null, "al_p", "W"],
    ["braqEmp", "Salida de alumbrado empotrada en pared", "09-93-54", "alu", 0, "hBraq", "al_p", "W", "izq"],
    ["fluor", "Salida para artefacto fluorescente en techo", "09-93-55", "alu", 0, null, "al_p", "W"],
    ["fluorEmp", "Salida para artefacto fluorescente empotrado", "09-93-56", "alu", 0, null, "al_p", "W"],
    ["fluorH", "Salida para fluorescentes en hilera", "09-93-57", "alu", 0, null, "al_p", "W"],
    ["fluorHE", "Salida para fluorescentes en hilera, empotrados", "09-93-58", "alu", 0, null, "al_p", "W"],
    ["posLuz", "Posición de la toma de iluminación", "09-93-49", "alu", 0, null, "al_p", "W"],
    ["posLuzP", "Toma de iluminación en la pared", "09-93-50", "alu", 0, "hBraq", "al_p", "W"],
    ["lamp", "Lámpara, símbolo general", "09-93-59", "alu", 0, null, "al_p", "W"],
    ["lumG", "Luminaria, símbolo general", "09-93-60", "alu", 0, null, "al_p", "W"],
    ["lum3", "Luminaria con tres tubos fluorescentes", "09-93-61", "alu", 0, null, "al_p", "W"],
    ["lum5", "Luminaria con cinco tubos fluorescentes", "09-93-62", "alu", 0, null, "al_p", "W", null, true],
    ["proy", "Proyector, símbolo general", "09-93-63", "alu", 0, null, "al_p", "W"],
    ["proyIl", "Iluminación proyectada", "09-93-64", "alu", 0, null, "al_p", "W"],
    ["proyDir", "Proyector de iluminación", "09-93-65", "alu", 0, null, "al_p", "W"],
    ["aux", "Aparato auxiliar para lámpara de descarga", "09-93-66", "alu", 0, null],
    ["emer", "Luminaria de alumbrado de emergencia", "09-93-67", "alu", 0, "hBraq", null, "W"],
    ["emerB", "Bloque autónomo de alumbrado de emergencia", "09-93-68", "alu", 0, "hBraq", null, "W", "abajo"],
    ["int", "Interruptor unipolar", "09-93-30", "alu", 1, "hInt", null, null, "izq"],
    ["int2", "Interruptor bipolar", "09-93-31", "alu", 1, "hInt", null, null, "izq", true],
    ["int3", "Interruptor de tres vías", "09-93-32", "alu", 1, "hInt", null, null, "izq", true],
    ["int4", "Interruptor de cuatro vías", "09-93-33", "alu", 1, "hInt", null, null, "izq", true],
    ["intL", "Interruptor con lámpara piloto", "09-93-29", "alu", 1, "hInt", null, null, "izq", true],
    ["intT", "Interruptor unipolar con tirador", "09-93-38", "alu", 1, "hInt", null, null, "izq", true],
    ["intP", "Interruptor de puerta", "09-93-39", "alu", 1, "hInt", null, null, "izq", true],
    ["int2PE", "Interruptor bipolar a prueba de explosión", "09-93-40", "alu", 1, "hInt", null, null, "izq", true],
    ["int3PA", "Interruptor de tres vías a prueba de agua", "09-93-41", "alu", 1, "hInt", null, null, "izq", true],
    ["intTi", "Interruptor de tiempo", "09-93-47", "alu", 1, "hInt", null, null, "izq", true],
    ["intG", "Interruptor, símbolo general", "09-93-28", "alu", 1, "hInt"],
    ["intPil", "Interruptor con luz piloto", "09-93-29", "alu", 1, "hInt"],
    ["intTemp", "Interruptor con tiempo de cierre limitado, unipolar", "09-93-30", "alu", 1, "hInt"],
    ["int2G", "Interruptor bipolar (forma gráfica)", "09-93-31", "alu", 1, "hInt"],
    ["conm", "Conmutador unipolar", "09-93-34", "alu", 1, "hInt"],
    ["int2v", "Interruptor unipolar de dos vías", "09-93-35", "alu", 1, "hInt"],
    ["conmInt", "Conmutador intermedio", "09-93-36", "alu", 1, "hInt"],
    ["grad", "Interruptor graduador", "09-93-37", "alu", 1, "hInt"],
    ["jal", "Interruptor unipolar con jalador", "09-93-38", "alu", 1, "hInt"],
    ["toma", "Tomacorriente monofásico puesto a tierra", "09-93-17", "tom", 2, "hToma", "tg_p", "VA", "izq", true],
    ["toma1", "Tomacorriente monofásico", "09-93-13", "tom", 2, "hToma", "tg_p", "VA", "izq"],
    ["toma3", "Tomacorriente trifásico", "09-93-15", "tom", 2, "hToma", null, "VA", "izq"],
    ["tomaPA", "Tomacorriente monofásico a prueba de agua", "09-93-19", "tom", 2, "hToma", "tg_p", "VA", "izq", true],
    ["tomaPiso", "Tomacorriente monofásico en el piso", "09-93-14", "tom", 2, null, "tg_p", "VA"],
    ["toma3Piso", "Tomacorriente trifásico en el piso", "09-93-16", "tom", 2, null, null, "VA"],
    ["coc", "Salida trifásica para cocina", "09-93-18", "fza", 2, "hFza", null, "W", "izq", true],
    ["aire", "Salida para aire acondicionado", "09-93-13 · letra A", "fza", 2, "hAire", null, "W", "izq", true],
    ["fza", "Salida de fuerza", "09-93-13 · letra F", "fza", 2, "hFza", null, "W", "izq", true],
    ["tomaG", "Tomacorriente (potencia), símbolo general", "09-93-12", "tom", 2, "hToma", "tg_p", "VA", "arriba"],
    ["tomaMult", "Tomacorriente múltiple", "09-93-20", "tom", 2, "hToma", "tg_p", "VA", "arriba", true],
    ["tomaTres", "Tomacorriente con tres tomas", "09-93-21", "tom", 2, "hToma", "tg_p", "VA", "arriba"],
    [
      "tomaPE",
      "Tomacorriente con contacto para el conductor de protección",
      "09-93-22",
      "tom",
      2,
      "hToma",
      "tg_p",
      "VA",
      "arriba"
    ],
    ["tomaObt", "Tomacorriente con obturador", "09-93-23", "tom", 2, "hToma", "tg_p", "VA", "arriba"],
    ["tomaInt", "Tomacorriente con interruptor unipolar", "09-93-24", "tom", 2, "hToma", "tg_p", "VA", "arriba"],
    [
      "tomaEnc",
      "Tomacorriente con interruptor de encerrojamiento",
      "09-93-25",
      "tom",
      2,
      "hToma",
      "tg_p",
      "VA",
      "arriba"
    ],
    [
      "tomaTr",
      "Tomacorriente con transformador aislante (máquina de afeitar)",
      "09-93-26",
      "tom",
      2,
      "hToma",
      null,
      "VA",
      "arriba"
    ],
    [
      "telG",
      "Tomacorriente de telecomunicaciones, símbolo general",
      "09-93-27",
      "com",
      3,
      "hToma",
      null,
      null,
      "arriba"
    ],
    ["telTP", "Tomacorriente de teléfono (TP)", "09-93-27", "com", 3, "hToma", null, null, "arriba", true],
    ["telTV", "Tomacorriente de televisión (TV)", "09-93-27", "com", 3, "hToma", null, null, "arriba", true],
    ["telFX", "Tomacorriente de telefax (FX)", "09-93-27", "com", 3, "hToma", null, null, "arriba", true],
    ["telM", "Tomacorriente de micrófono (M)", "09-93-27", "com", 3, "hToma", null, null, "arriba", true],
    [
      "telFM",
      "Tomacorriente de modulación de frecuencia (FM)",
      "09-93-27",
      "com",
      3,
      "hToma",
      null,
      null,
      "arriba",
      true
    ],
    ["telTX", "Tomacorriente de télex (TX)", "09-93-27", "com", 3, "hToma", null, null, "arriba", true],
    ["itc", "Interfono, intercomunicador", "09-93-73", "com", 3, "hInt", null, null, "abajo"],
    ["pul", "Botón de presión (pulsador de timbre)", "09-93-43", "com", 4, "hInt"],
    ["pulL", "Botón de presión con lámpara indicadora", "09-93-44", "com", 4, "hInt"],
    ["pulProt", "Botón de presión protegido contra un funcionamiento involuntario", "09-93-45", "com", 4, "hInt"],
    [
      "intC",
      "Pulsador o contactor (propósitos diferentes a la señalización)",
      "09-93-42",
      "com",
      4,
      "hInt",
      null,
      null,
      "izq",
      true
    ],
    ["timbre", "Timbre (campana)", "08-80-49", "com", 4, "hBraq", null, null, "abajo"],
    ["crono", "Cronómetro, aparato limitador de duración", "09-93-46", "com", 4, "hInt", null, null, "abajo"],
    ["horario", "Interruptor horario", "09-93-47", "com", 4, "hInt", null, null, "abajo"],
    ["tecla", "Dispositivo de maniobra accionado por una tecla", "09-93-48", "com", 4, "hInt", null, null, "abajo"],
    ["relojR", "Reloj, registrador horario", "09-93-71", "com", 4, "hInt", null, null, "abajo"],
    ["cerr", "Cerradura eléctrica", "09-93-72", "com", 4, "hInt"],
    ["tab", "Tablero de distribución empotrado", "09-91-17", "tab", 5, "hTab", null, null, "abajo"],
    ["tabD", "Panel de distribución o centro de control", "09-91-16", "tab", 5, "hTab", null, null, "abajo"],
    ["centroDist", "Centro de distribución", "09-93-11", "tab", 5, "hTab"],
    ["med", "Medidor de energía", "08-80-22", "tab", 5, "hMed", null, null, "abajo"],
    ["caja", "Caja, símbolo general (caja de paso)", "09-93-08", "can", 6, null],
    ["cajaCon", "Caja de conexión o de derivación", "09-93-09", "can", 6, null],
    ["terminal", "Terminal de consumidores", "09-93-10", "can", 6, null],
    ["subida", "Canalización hacia arriba", "09-93-05", "can", 6, null],
    ["bajada", "Canalización hacia abajo", "09-93-06", "can", 6, null],
    ["atrav", "Canalización atravesando verticalmente", "09-93-07", "can", 6, null],
    ["terma", "Calentador de agua (terma)", "09-93-69", "fza", 7, "hTerma", null, "W", "izq"],
    ["vent", "Ventilador", "09-93-70", "fza", 7, null, null, "W", "izq"],
    ["pat", "Pozo de puesta a tierra", "03-31-46", "tie", 7, null]
  ].map(([k, n, c, s, g, h, p, u, m, l]) => [
    k,
    {
      n,
      c,
      s,
      g: DS_GRUPOS[g],
      h: h || null,
      ...(p ? { p } : {}),
      ...(u ? { u } : {}),
      ...(m ? { m } : {}),
      ...(l ? { let: true } : {})
    }
  ])
);
// Color por tipo de símbolo (opción de la vista, criterio de la plataforma; la norma no fija colores): dentro de
// cada grupo, un color distinto para cada tipo, en el orden del catálogo
const DS_PAL = [
  "#c62828",
  "#ef6c00",
  "#6a1b9a",
  "#0277bd",
  "#2e7d32",
  "#00838f",
  "#ad1457",
  "#6d4c41",
  "#9e9d24",
  "#283593",
  "#d84315",
  "#00695c"
];
const DS_COLT = {};
DS_GRUPOS.forEach(g =>
  Object.keys(DS_CAT)
    .filter(k => DS_CAT[k].g === g)
    .forEach((k, i) => (DS_COLT[k] = DS_PAL[i % DS_PAL.length]))
);
// Color con que se dibuja un elemento: el suyo, el de su tipo (si está activado) o el de su capa
// Colores de los circuitos (vista de trabajo, criterio de la plataforma): sobrios y bien distintos entre sí
const DS_PALC = [
  "#1565c0",
  "#c62828",
  "#2e7d32",
  "#ef6c00",
  "#6a1b9a",
  "#00838f",
  "#ad1457",
  "#5d4037",
  "#283593",
  "#827717",
  "#00695c",
  "#d84315"
];
// Aclara (f > 0) u oscurece (f < 0) un color
const dsTono = (hex, f) => {
  const n = parseInt(hex.slice(1), 16),
    c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
};
// Color de un circuito: C-1, C-2… con la paleta en orden; desde el C-13, en otro tono; cada tablero (el segundo, el
// tercero…) con su propio tono, para no confundir el C-1 del TG con el C-1 de un TD
const DS_TONOS = [0, -0.32, 0.3, -0.5, 0.48];
function dsColCir(cir, tab) {
  const m = /(\d+)/.exec(cir || "");
  let i = m ? +m[1] - 1 : 0;
  if (!m) for (const ch of String(cir)) i += ch.charCodeAt(0);
  const tbs = dsD() ? dsD().els.filter(e => e.k === "tab") : [],
    it = Math.max(
      0,
      tbs.findIndex(e => e.id === tab)
    ),
    v = (Math.floor(Math.max(0, i) / DS_PALC.length) + it) % DS_TONOS.length;
  return dsTono(DS_PALC[((i % DS_PALC.length) + DS_PALC.length) % DS_PALC.length], DS_TONOS[v]);
}
const dsColorEl = (el, cap) =>
  el.col ||
  (DSU.color === "tipo" && el.t === "sim" && DS_COLT[el.k]) ||
  (DSU.color === "cir" && el.cir && (el.t === "sim" || el.t === "tub") && dsColCir(el.cir, el.tab)) ||
  cap.col;
const DS_LT = { cont: "Continua", trazos: "Trazos", punto: "Trazo y punto" };
// Grosores de línea de las capas (mm); 0 es el fino de siempre (una línea normal, sin grosor), como en AutoCAD
const DS_GROSORES = [0, 0.25, 0.35, 0.5, 0.7, 1];
// Ancho en pantalla (píxeles del lienzo): no cambia con el zoom
const dsGrosor = cap => Math.max(1, cap && cap.gr ? cap.gr * 4.5 : 1) * plDpr();
const DS_ESCALAS = [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500];
const DS_PASOS = [0.01, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 5];
// Curvatura de los tramos curvos nuevos: un arco de unos 45° (tangente de 45°/4)
const DS_BUL = Math.tan(Math.PI / 16);
// Herramientas de dibujo: nombre de cada una
const DS_HERR = {
  lin: "Línea",
  pol: "Polilínea",
  rect: "Rectángulo",
  cir: "Círculo",
  txt: "Texto",
  tubT: "Tubería en techo o pared",
  tubP: "Tubería en piso",
  cotA: "Cota alineada",
  cotL: "Cota lineal",
  dir: "Directriz",
  ley: "Leyenda",
  cua: "Cuadro de circuitos"
};
Object.keys(DS_HERR).forEach(k => (PL_NOMH[k] = DS_HERR[k]));
const dsEsTub = h => h === "tubT" || h === "tubP";

/* ---------- Datos del diseño ---------- */
function dsNuevo() {
  return {
    capas: Object.values(DS_SIS).map(s => ({ n: s.capa, col: s.col, lt: s.lt || "cont", vis: true, bloq: false })),
    actual: DS_SIS.dib.capa,
    els: [],
    escala: 50,
    etq: "total"
  };
}
// La copia del editor siempre tiene su diseño (los proyectos de la etapa 1 no lo traen)
function dsAsegurar() {
  if (!EPL) return;
  if (!EPL.dis) EPL.dis = dsNuevo();
  // Un símbolo que esta versión no conoce no se puede dibujar ni editar: se deja fuera
  EPL.dis.els = EPL.dis.els.filter(el => el.t !== "sim" || DS_CAT[el.k]);
  if (!EPL.dis.etq) EPL.dis.etq = "total";
}
const dsD = () => (EPL && EPL.dis) || null;
// Capa del diseño por nombre; si no existe (por ejemplo, la borró el usuario) se crea con su color de sistema
function dsCapa(n) {
  const D = dsD();
  let c = D.capas.find(x => x.n === n);
  if (!c) {
    const s = Object.values(DS_SIS).find(x => x.capa === n);
    c = { n, col: s ? s.col : "#37474f", lt: (s && s.lt) || "cont", vis: true, bloq: false };
    D.capas.push(c);
  }
  return c;
}
const dsCapaDe = el => dsD().capas.find(x => x.n === el.capa) || { col: "#37474f", lt: "cont", vis: true, bloq: false };
const dsVis = el => dsCapaDe(el).vis;
const dsEditable = el => dsCapaDe(el).vis && !dsCapaDe(el).bloq;
// Unidades del dibujo por unidad de símbolo: un símbolo de 17 unidades mide unos 7 mm impreso a la escala elegida
const dsU = () => ((dsD() ? dsD().escala : 50) * 0.0004) / (EPL ? EPL.f : 1);
// Milímetros impresos a escala → unidades del dibujo (alto de texto, guiones, flechas de las cotas)
const dsMm = mm => ((dsD() ? dsD().escala : 50) * mm) / 1000 / (EPL ? EPL.f : 1);
let DS_N = 0;
const dsId = () => {
  const D = dsD();
  if (!DS_N) DS_N = D.els.reduce((m, e) => Math.max(m, parseInt(String(e.id).slice(1), 10) || 0), 0);
  return "d" + ++DS_N;
};
// Selección del diseño (ids) y portapapeles
const DS_SEL = new Set();
let DS_PORTA = [];

/* ---------- Preferencias de esta computadora: rejilla, enganches, encaje al muro y trazo de las tuberías ---------- */
const DSU = {
  rej: false,
  forz: false,
  paso: 0.5,
  // Enganches activos y sensibilidad (píxeles alrededor del cursor)
  ref: { fin: true, med: true, cen: true, ins: true, cer: true, per: true, int: true, con: true },
  sens: 12,
  alinear: true,
  curva: true,
  // Cada tipo de símbolo con su color; paso del giro (0: libre)
  color: "tipo",
  giro: 0,
  // Marcar lo que no está conectado
  sueltos: true,
  // Marcas de conductores en las tuberías; rastreo polar y su ángulo
  marcas: true,
  marcaEst: "incl",
  polar: true,
  polarInc: 45,
  // Fondo del plano: base (según el tema, blanco, papel, gris, grafito o negro), temperatura (−50 fría a 100 cálida)
  // y brillo (%); cinta plegada; barra de navegación (visible, horizontal y posición en % del plano)
  fondo: "tema",
  calido: 0,
  brillo: 100,
  cintaMin: false,
  nav: true,
  navH: false,
  // Datos del elemento al pasar el cursor
  info: true,
  navPos: null
};
try {
  const g = JSON.parse(localStorage.getItem("jmg-electric-editor-rejilla") || "{}");
  Object.assign(DSU, g, { ref: { ...DSU.ref, ...(g.ref || {}) } });
  // Antes: casilla «Color por tipo de símbolo»
  if (g.colTipo === false && !g.color) DSU.color = "capa";
  delete DSU.colTipo;
  if (!["capa", "tipo", "cir"].includes(DSU.color)) DSU.color = "tipo";
  if (![15, 30, 45, 90].includes(DSU.polarInc)) DSU.polarInc = 45;
} catch (e) {}
function dsGuardarPref() {
  try {
    localStorage.setItem("jmg-electric-editor-rejilla", JSON.stringify(DSU));
  } catch (e) {}
}

/* ---------- Símbolos: primitivas a partir del SVG de simboloDGE() ---------- */
const DS_PRIM = {},
  DS_BB = {};
function dsPrims(k) {
  if (DS_PRIM[k]) return DS_PRIM[k];
  const o = [];
  if (!simboloDGE(o, k, 0, 0, 1)) return (DS_PRIM[k] = []);
  const at = (s, n) => {
      const m = s.match(new RegExp(`\\s${n}="([^"]*)"`));
      return m ? m[1] : null;
    },
    nu = (s, n, d = 0) => {
      const v = at(s, n);
      return v == null ? d : parseFloat(v);
    };
  DS_PRIM[k] = o
    .map(s => {
      const tag = (s.match(/^<(\w+)/) || [])[1],
        b = { st: at(s, "stroke"), fi: at(s, "fill"), w: nu(s, "stroke-width", 1), dash: at(s, "stroke-dasharray") };
      if (tag === "line") return { ...b, t: "l", a: ["x1", "y1", "x2", "y2"].map(n => nu(s, n)) };
      if (tag === "circle") return { ...b, t: "c", a: ["cx", "cy", "r"].map(n => nu(s, n)) };
      if (tag === "ellipse") return { ...b, t: "e", a: ["cx", "cy", "rx", "ry"].map(n => nu(s, n)) };
      if (tag === "rect") return { ...b, t: "r", a: ["x", "y", "width", "height"].map(n => nu(s, n)) };
      if (tag === "path") return { ...b, t: "p", a: (at(s, "d").match(/-?[\d.]+/g) || []).map(Number) };
      if (tag === "text")
        return {
          ...b,
          t: "t",
          a: [nu(s, "x"), nu(s, "y"), nu(s, "font-size", 9)],
          tx: s
            .replace(/<[^>]*>/g, "")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, "&"),
          b: / font-weight="700"/.test(s),
          it: / font-style="italic"/.test(s),
          an: at(s, "text-anchor") || "start"
        };
      return null;
    })
    .filter(Boolean);
  // Rectángulo que ocupa el símbolo (unidades del símbolo, y hacia abajo)
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const ex = (x, y) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  };
  DS_PRIM[k].forEach(p => {
    const a = p.a;
    if (p.t === "l") {
      ex(a[0], a[1]);
      ex(a[2], a[3]);
    } else if (p.t === "c") {
      ex(a[0] - a[2], a[1] - a[2]);
      ex(a[0] + a[2], a[1] + a[2]);
    } else if (p.t === "e") {
      ex(a[0] - a[2], a[1] - a[3]);
      ex(a[0] + a[2], a[1] + a[3]);
    } else if (p.t === "r") {
      ex(a[0], a[1]);
      ex(a[0] + a[2], a[1] + a[3]);
    } else if (p.t === "p") for (let i = 0; i + 1 < a.length; i += 2) ex(a[i], a[i + 1]);
    else if (p.t === "t") {
      const w = a[2] * 0.6 * p.tx.length,
        xa = p.an === "middle" ? a[0] - w / 2 : a[0];
      ex(xa, a[1] - a[2] * 0.8);
      ex(xa + w, a[1]);
    }
  });
  // Exacto (para apoyar el símbolo en el muro) y con un margen de una unidad (para tocarlo con el cursor)
  DS_BB[k] = x0 <= x1 ? [x0, y0, x1, y1] : [-8, -8, 8, 8];
  return DS_PRIM[k];
}
const dsBBs = k => {
  dsPrims(k);
  const b = DS_BB[k];
  return [b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1];
};
// Dibuja el símbolo k en el lienzo: X, Y en píxeles, giro en radianes (antihorario), u píxeles por unidad
// La letra o el número del tipo (no la S de los interruptores, que es el símbolo) se puede correr con dt, en
// unidades del símbolo; los textos se dibujan siempre legibles, aunque el símbolo esté girado
const dsEsLetra = (k, p) => DS_CAT[k] && DS_CAT[k].let && p.t === "t" && p.tx !== "S";
function dsDibSim(g, k, X, Y, rot, u, col, fondo, lw = plDpr(), dt) {
  const cr = dsSimb(k);
  if (cr && cr.gr) lw *= cr.gr;
  g.save();
  g.translate(X, Y);
  g.rotate(-rot);
  g.scale(u, u);
  g.lineCap = "round";
  // Relleno del cuerpo de criterio: primero, para que las líneas del símbolo queden encima
  if (cr && cr.rel && cr.rel !== "ninguno" && fondo !== null) {
    g.lineWidth = Math.max(lw, 0.9 * plDpr()) / u;
    dsRellenoCuerpo(g, k, cr.rel, col);
  }
  for (const p of dsPrims(k)) {
    const a = p.a,
      fi =
        !p.fi || p.fi === "none" || (cr && cr.rel === "ninguno" && p === dsCuerpo(k) && p.fi === INK_S)
          ? null
          : /^#fff(fff)?$/i.test(p.fi)
            ? cr && cr.rel && cr.rel !== "ninguno" && p === dsCuerpo(k)
              ? null
              : fondo
            : p.fi === INK_S
              ? col
              : p.fi,
      st = p.st && p.st !== "none" ? col : null;
    // Líneas del ancho de la capa en pantalla, sin engrosarse con el zoom (las más finas del símbolo, algo menos)
    g.lineWidth = Math.max((lw * p.w) / 1.2, 0.9 * plDpr()) / u;
    g.setLineDash(p.dash ? p.dash.split(/[\s,]+/).map(Number) : []);
    g.beginPath();
    if (p.t === "l") {
      g.moveTo(a[0], a[1]);
      g.lineTo(a[2], a[3]);
    } else if (p.t === "c") g.arc(a[0], a[1], a[2], 0, 2 * Math.PI);
    else if (p.t === "e") g.ellipse(a[0], a[1], a[2], a[3], 0, 0, 2 * Math.PI);
    else if (p.t === "r") g.rect(a[0], a[1], a[2], a[3]);
    else if (p.t === "p") {
      g.moveTo(a[0], a[1]);
      for (let i = 2; i + 1 < a.length; i += 2) g.lineTo(a[i], a[i + 1]);
      g.closePath();
    } else if (p.t === "t") {
      // Letra del tipo cambiada por el proyectista (vacía: sin letra)
      if (cr && typeof cr.let === "string" && dsEsLetra(k, p) && !cr.let) continue;
      const txt = cr && typeof cr.let === "string" && dsEsLetra(k, p) ? cr.let : p.tx,
        mov = dt && dsEsLetra(k, p) ? dt : [0, 0],
        w = a[2] * 0.6 * txt.length,
        // Centro aproximado del texto: se gira sobre él para dejarlo derecho
        cx = a[0] + mov[0] + (p.an === "middle" ? 0 : p.an === "end" ? -w / 2 : w / 2),
        cy = a[1] + mov[1] - a[2] * 0.35;
      g.save();
      g.translate(cx, cy);
      // La letra del tipo queda siempre horizontal; los demás textos del símbolo giran con él, sin quedar de cabeza
      g.rotate(dsEsLetra(k, p) ? rot : rot - dsLegible(rot));
      g.font = `${p.it ? "italic " : ""}${p.b ? "700 " : ""}${a[2]}px Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = p.fi && p.fi !== "none" && !/^#fff(fff)?$/i.test(p.fi) && p.fi !== INK_S ? p.fi : col;
      g.fillText(txt, 0, 0);
      g.restore();
      continue;
    }
    if (fi) {
      g.fillStyle = fi;
      g.fill();
    }
    if (st && p.t !== "p") {
      g.strokeStyle = st;
      g.stroke();
    }
  }
  g.setLineDash([]);
  g.restore();
}
// Ícono del símbolo para la cinta y las propiedades (SVG en el color del texto)
function dsIcono(k) {
  const o = [];
  simboloDGE(o, k, 0, 0, 1);
  const b = dsBBs(k),
    m = Math.max(b[2] - b[0], b[3] - b[1]) / 2 + 1,
    cx = (b[0] + b[2]) / 2,
    cy = (b[1] + b[3]) / 2;
  return `<svg viewBox="${cx - m} ${cy - m} ${2 * m} ${2 * m}" class="ds-ico" aria-hidden="true">${o
    .join("")
    .split(INK_S)
    .join("currentColor")
    .replace(/fill="#fff(fff)?"/gi, 'fill="var(--ws-pane, #fff)"')}</svg>`;
}

/* ---------- Tramos rectos y curvos ---------- */
// Curvatura de un tramo A→B que pasa por el punto q (la flecha del arco, con su signo)
function dsCurvDe(a, b, q) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    c = Math.hypot(dx, dy);
  if (!c) return 0;
  const izq = (dx * (q[1] - a[1]) - dy * (q[0] - a[0])) / c,
    k = Math.max(-1, Math.min(1, (-2 * izq) / c));
  // Casi recto: queda recto
  return Math.abs(k) < 0.03 ? 0 : k;
}
// Tramos de una línea o tubería: extremos, curvatura, cuerda, longitud real (la del arco), punto medio y ángulo
function dsTramos(el) {
  const p = el.pts,
    n = p.length / 2,
    b = el.b || [],
    out = [];
  for (let i = 0; i < (el.c ? n : n - 1); i++) {
    const j = (i + 1) % n,
      ax = p[2 * i],
      ay = p[2 * i + 1],
      bx = p[2 * j],
      by = p[2 * j + 1],
      k = b[i] || 0,
      c = Math.hypot(bx - ax, by - ay);
    let L = c,
      mx = (ax + bx) / 2,
      my = (ay + by) / 2;
    if (k && c) {
      const th = 4 * Math.atan(Math.abs(k)),
        f = (k * c) / 2;
      L = (c / (2 * Math.sin(th / 2))) * th;
      mx += ((by - ay) / c) * f;
      my -= ((bx - ax) / c) * f;
    }
    out.push({ i, a: [ax, ay], b: [bx, by], k, c, L, m: [mx, my], ang: Math.atan2(by - ay, bx - ax) });
  }
  return out;
}
// Puntos de la línea con sus curvas, en tramos rectos cortos (para dibujar, tocar y medir)
function dsCurva(el) {
  const p = el.pts;
  if (!el.b || !el.b.some(Boolean)) return el.c ? [...p, p[0], p[1]] : p;
  const out = [p[0], p[1]];
  dsTramos(el).forEach(t => out.push(...puntosBulge(t.a[0], t.a[1], t.b[0], t.b[1], t.k)));
  return out;
}
const dsLargo = el => dsTramos(el).reduce((s, t) => s + t.L, 0);

/* ---------- Cotas y directrices ---------- */
// Geometría de la cota: dirección de medida (alineada, horizontal o vertical), puntos de la línea de cota y medida
function dsCotaGeo(el) {
  const [ax, ay] = el.a,
    [bx, by] = el.b;
  let ux = 1,
    uy = 0;
  if (el.modo === "v") [ux, uy] = [0, 1];
  else if (el.modo !== "h") {
    const c = Math.hypot(bx - ax, by - ay) || 1;
    [ux, uy] = [(bx - ax) / c, (by - ay) / c];
  }
  const nx = -uy,
    ny = ux,
    db = (bx - ax) * nx + (by - ay) * ny;
  return {
    pa: [ax + nx * el.o, ay + ny * el.o],
    pb: [bx + nx * (el.o - db), by + ny * (el.o - db)],
    med: Math.abs((bx - ax) * ux + (by - ay) * uy),
    ux,
    uy,
    nx,
    ny
  };
}
// Dirección de una cota lineal según dónde está el cursor: arriba o abajo de los puntos, horizontal; a un lado,
// vertical (como en AutoCAD)
function dsModoLineal(a, b, q) {
  const fx = Math.abs(q[0] - (a[0] + b[0]) / 2) - Math.abs(b[0] - a[0]) / 2,
    fy = Math.abs(q[1] - (a[1] + b[1]) / 2) - Math.abs(b[1] - a[1]) / 2;
  return fy >= fx ? "h" : "v";
}
// Desplazamiento de la línea de cota hasta el punto q
function dsCotaO(el, q) {
  const g = dsCotaGeo({ ...el, o: 0 });
  return (q[0] - el.a[0]) * g.nx + (q[1] - el.a[1]) * g.ny;
}
// Ángulo legible (el texto nunca queda de cabeza)
const dsLegible = a => {
  let r = a;
  while (r > Math.PI / 2 + 1e-6) r -= Math.PI;
  while (r <= -Math.PI / 2 + 1e-6) r += Math.PI;
  return r;
};
// Dibuja una cota en el lienzo (líneas de referencia, línea de cota con trazos oblicuos y la medida)
function dsDibCota(g, el, col, s, lw = plDpr()) {
  const G = dsCotaGeo(el),
    sep = dsMm(1),
    sob = dsMm(1.5),
    tic = dsMm(1.4),
    lin = (a, b) => {
      const [X1, Y1] = plAPant(a[0], a[1]),
        [X2, Y2] = plAPant(b[0], b[1]);
      g.moveTo(X1, Y1);
      g.lineTo(X2, Y2);
    };
  g.strokeStyle = col;
  g.lineWidth = lw;
  g.beginPath();
  [
    [el.a, G.pa],
    [el.b, G.pb]
  ].forEach(([p, q]) => {
    const vx = q[0] - p[0],
      vy = q[1] - p[1],
      d = Math.hypot(vx, vy);
    if (d < sep) return;
    lin([p[0] + (vx / d) * sep, p[1] + (vy / d) * sep], [q[0] + (vx / d) * sob, q[1] + (vy / d) * sob]);
  });
  lin(G.pa, G.pb);
  // Trazos oblicuos a 45° en los extremos (cota de arquitectura)
  const ox = ((G.ux + G.nx) * tic) / Math.SQRT2,
    oy = ((G.uy + G.ny) * tic) / Math.SQRT2;
  [G.pa, G.pb].forEach(p => lin([p[0] - ox, p[1] - oy], [p[0] + ox, p[1] + oy]));
  g.stroke();
  const hp = dsMm(2.5) * s;
  if (hp < 4) return;
  const m = [(G.pa[0] + G.pb[0]) / 2 + G.nx * dsMm(1), (G.pa[1] + G.pb[1]) / 2 + G.ny * dsMm(1)],
    [X, Y] = plAPant(m[0], m[1]),
    ang = dsLegible(Math.atan2(G.uy, G.ux));
  g.save();
  g.translate(X, Y);
  g.rotate(-ang);
  g.font = `${hp / 0.72}px Arial, sans-serif`;
  g.fillStyle = col;
  g.textAlign = "center";
  // Encima de la línea de cota, del lado del desplazamiento
  g.textBaseline = Math.cos(Math.atan2(G.uy, G.ux) - ang) > 0 ? "bottom" : "top";
  g.fillText(fmt(G.med * EPL.f, 2), 0, 0);
  g.restore();
}
// Directriz: flecha en la punta, quiebre y texto a continuación del rellano
function dsDirGeo(el) {
  const [tx, ty, ex, ey] = el.pts,
    lado = ex >= tx ? 1 : -1;
  return { tip: [tx, ty], codo: [ex, ey], fin: [ex + lado * dsMm(3), ey], lado };
}
function dsDibDir(g, el, col, s, lw = plDpr()) {
  const G = dsDirGeo(el),
    [X0, Y0] = plAPant(G.tip[0], G.tip[1]),
    [X1, Y1] = plAPant(G.codo[0], G.codo[1]),
    [X2, Y2] = plAPant(G.fin[0], G.fin[1]);
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = lw;
  g.beginPath();
  g.moveTo(X0, Y0);
  g.lineTo(X1, Y1);
  g.lineTo(X2, Y2);
  g.stroke();
  // Punta de flecha
  const a = Math.atan2(Y1 - Y0, X1 - X0),
    lf = dsMm(2.5) * s,
    af = dsMm(0.8) * s;
  g.beginPath();
  g.moveTo(X0, Y0);
  g.lineTo(X0 + lf * Math.cos(a) - af * Math.sin(a), Y0 + lf * Math.sin(a) + af * Math.cos(a));
  g.lineTo(X0 + lf * Math.cos(a) + af * Math.sin(a), Y0 + lf * Math.sin(a) - af * Math.cos(a));
  g.closePath();
  g.fill();
  const hp = el.ht * s;
  if (hp < 3) return;
  g.font = `${hp / 0.72}px Arial, sans-serif`;
  g.textAlign = G.lado > 0 ? "left" : "right";
  g.textBaseline = "middle";
  g.fillText(el.s, X2 + G.lado * dsMm(0.8) * s, Y2);
}

/* ---------- Símbolos con criterio del proyectista (editor de símbolos) ---------- */
const dsSimb = k => (dsD() && dsD().simb && dsD().simb[k]) || null;
const dsTam = k => (dsSimb(k) && dsSimb(k).tam) || 1;
// Unidades del dibujo por unidad de un símbolo de tipo k (con su tamaño de criterio)
const dsUk = k => dsU() * dsTam(k);
// Cuerpo del símbolo (la figura de mayor área: círculo, rectángulo, elipse o polígono), para su relleno
const DS_CUERPO = {};
function dsCuerpo(k) {
  if (k in DS_CUERPO) return DS_CUERPO[k];
  let mejor = null,
    am = 0;
  dsPrims(k).forEach(p => {
    const a = p.a;
    let ar = 0;
    if (p.t === "c") ar = Math.PI * a[2] * a[2];
    else if (p.t === "e") ar = Math.PI * a[2] * a[3];
    else if (p.t === "r") ar = Math.abs(a[2] * a[3]);
    else if (p.t === "p") {
      for (let i = 0; i + 1 < a.length; i += 2) {
        const j = (i + 2) % a.length;
        ar += a[i] * a[j + 1] - a[j] * a[i + 1];
      }
      ar = Math.abs(ar / 2);
    }
    if (ar > am) {
      am = ar;
      mejor = p;
    }
  });
  return (DS_CUERPO[k] = mejor);
}
// Camino del cuerpo en el lienzo (en unidades del símbolo, con la transformación ya puesta)
function dsCaminoCuerpo(g, p) {
  const a = p.a;
  g.beginPath();
  if (p.t === "c") g.arc(a[0], a[1], a[2], 0, 2 * Math.PI);
  else if (p.t === "e") g.ellipse(a[0], a[1], a[2], a[3], 0, 0, 2 * Math.PI);
  else if (p.t === "r") g.rect(a[0], a[1], a[2], a[3]);
  else {
    g.moveTo(a[0], a[1]);
    for (let i = 2; i + 1 < a.length; i += 2) g.lineTo(a[i], a[i + 1]);
    g.closePath();
  }
}
// Contorno del cuerpo como polígono (los círculos y elipses, con 48 lados), en unidades del símbolo
function dsPoliCuerpo(p) {
  const a = p.a,
    out = [];
  if (p.t === "c" || p.t === "e")
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * 2 * Math.PI;
      out.push([a[0] + a[2] * Math.cos(t), a[1] + (p.t === "c" ? a[2] : a[3]) * Math.sin(t)]);
    }
  else if (p.t === "r") out.push([a[0], a[1]], [a[0] + a[2], a[1]], [a[0] + a[2], a[1] + a[3]], [a[0], a[1] + a[3]]);
  else for (let i = 0; i + 1 < a.length; i += 2) out.push([a[i], a[i + 1]]);
  return out;
}
// Relleno de criterio del cuerpo: sólido, achurado a 45° o mitad llena. Se recorta con cálculo (sin el recorte del
// lienzo), así sale igual en la pantalla, en la lámina y en el DXF
function dsRellenoCuerpo(g, k, rel, col) {
  const p = dsCuerpo(k);
  if (!p) return;
  let P = dsPoliCuerpo(p);
  const xs = P.map(q => q[0]),
    ys = P.map(q => q[1]),
    bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const poli = Q => {
    g.beginPath();
    Q.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
    g.closePath();
  };
  g.save();
  g.fillStyle = col;
  g.strokeStyle = col;
  if (rel === "solido") {
    if (p.t === "c" || p.t === "e") dsCaminoCuerpo(g, p);
    else poli(P);
    g.fill();
  } else if (rel === "mitad") {
    // La mitad del lado contrario a la llegada (derecha del símbolo): el polígono recortado en x ≥ centro
    const cx = (bb[0] + bb[2]) / 2,
      Q = [];
    P.forEach((a, i) => {
      const b = P[(i + 1) % P.length],
        da = a[0] >= cx,
        db = b[0] >= cx;
      if (da) Q.push(a);
      if (da !== db) Q.push([cx, a[1] + ((b[1] - a[1]) * (cx - a[0])) / (b[0] - a[0])]);
    });
    if (Q.length > 2) {
      poli(Q);
      g.fill();
    }
  } else if (rel === "achurado") {
    // Rectas a 45° (x − y = c) cortadas por el contorno
    const paso = Math.max(1.2, (bb[2] - bb[0]) / 7);
    g.beginPath();
    for (let c = bb[0] - bb[3]; c <= bb[2] - bb[1]; c += paso) {
      const xs2 = [];
      P.forEach((a, i) => {
        const b = P[(i + 1) % P.length],
          fa = a[0] - a[1] - c,
          fb = b[0] - b[1] - c;
        if ((fa <= 0 && fb > 0) || (fa > 0 && fb <= 0)) {
          const t = fa / (fa - fb);
          xs2.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      });
      xs2.sort((u, v) => u[0] - v[0]);
      for (let i = 0; i + 1 < xs2.length; i += 2) {
        g.moveTo(xs2[i][0], xs2[i][1]);
        g.lineTo(xs2[i + 1][0], xs2[i + 1][1]);
      }
    }
    g.stroke();
  }
  P = null;
  g.restore();
}

/* ---------- Geometría: rectángulo, toque y puntos de enganche de cada elemento ---------- */
// De unidades del símbolo (y hacia abajo) al dibujo, con el giro del elemento
function dsAMundo(el, a, b) {
  const u = el.k ? dsUk(el.k) : dsU(),
    r = ((el.r || 0) * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return [el.x + u * (a * c + b * s), el.y + u * (a * s - b * c)];
}
const dsCaja = pts => {
  const xs = pts.filter((v, i) => i % 2 === 0),
    ys = pts.filter((v, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
/* ---------- Leyenda automática ----------
   Tabla con lo que usa el diseño: cada símbolo (con su dibujo, nombre y código de la Norma DGE), las tuberías en
   techo y en piso y los conductores con marca. Se arma sola con los elementos del diseño; medidas en el papel (mm). */
const DS_LEY = { w: [16, 84, 20], tit: 7, cab: 5, fila: 9, txt: 2.2 };
// Se guarda hasta el próximo cambio del diseño
const dsFilasLey = () => dpCache("ley", dsFilasLey0);
function dsFilasLey0() {
  const D = dsD(),
    usados = new Set(),
    tubs = { techo: false, piso: false },
    cond = { f: false, n: false, t: false };
  D.els.forEach(el => {
    if (el.t === "sim" && DS_CAT[el.k]) usados.add(el.k);
    if (el.t === "tub") {
      tubs[el.modo === "piso" ? "piso" : "techo"] = true;
      if (el.cond) {
        if (el.cond.f) cond.f = true;
        if (el.cond.n) cond.n = true;
        if (el.cond.t) cond.t = true;
      }
    }
  });
  const out = Object.keys(DS_CAT)
    .filter(k => usados.has(k))
    .map(k => ({ k, n: DS_CAT[k].n, c: DS_CAT[k].c + (dsSimb(k) ? " *" : "") }));
  if (tubs.techo) out.push({ tub: "techo", n: "Tubería empotrada en techo o pared", c: "" });
  if (tubs.piso) out.push({ tub: "piso", n: "Tubería empotrada en piso", c: "" });
  if (cond.f) out.push({ cond: { f: 1 }, n: "Conductor de fase", c: "" });
  if (cond.n) out.push({ cond: { n: true }, n: "Conductor neutro", c: "09-93-01" });
  if (cond.t) out.push({ cond: { t: true }, n: "Conductor de protección (tierra)", c: "09-93-02" });
  if (out.some(f => f.k && dsSimb(f.k))) out.push({ nota: true, n: "(*) Símbolo con criterio del proyectista", c: "" });
  return out;
}
// Tamaño de la leyenda en el dibujo
function dsTamLey() {
  const m = dsMm(1),
    L = DS_LEY,
    n = Math.max(1, dsFilasLey().length);
  return [(L.w[0] + L.w[1] + L.w[2]) * m, (L.tit + L.cab + n * L.fila) * m];
}
function dsDibLeyenda(g, el, col, s, lw) {
  const m = dsMm(1),
    L = DS_LEY,
    filas = dsFilasLey(),
    [W, H] = dsTamLey(),
    P = (a, b) => plAPant(el.x + a * m, el.y - b * m),
    hp = L.txt * m * s,
    x1 = L.w[0],
    x2 = L.w[0] + L.w[1],
    xw = W / m;
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = lw;
  g.setLineDash([]);
  const linea = (a, b, c, d) => {
    const [X0, Y0] = P(a, b),
      [X1, Y1] = P(c, d);
    g.beginPath();
    g.moveTo(X0, Y0);
    g.lineTo(X1, Y1);
    g.stroke();
  };
  // Texto que se achica si no cabe en su columna (ancho en mm)
  const texto = (t, a, b, al, peso = "", ancho = 0) => {
    if (hp < 3) return;
    const [X, Y] = P(a, b);
    g.font = `${peso}${hp / 0.72}px Arial, sans-serif`;
    const w = g.measureText(t).width,
      max = ancho * m * s;
    if (ancho && w > max) g.font = `${peso}${((hp / 0.72) * max) / w}px Arial, sans-serif`;
    g.textAlign = al;
    g.textBaseline = "middle";
    g.fillStyle = col;
    g.fillText(t, X, Y);
  };
  const [X0, Y0] = P(0, 0);
  g.strokeRect(X0, Y0, W * s, H * s);
  linea(0, L.tit, xw, L.tit);
  linea(0, L.tit + L.cab, xw, L.tit + L.cab);
  linea(x1, L.tit, x1, H / m);
  linea(x2, L.tit, x2, H / m);
  texto(el.tit || "LEYENDA", xw / 2, L.tit / 2, "center", "700 ");
  texto("SÍMBOLO", x1 / 2, L.tit + L.cab / 2, "center", "600 ");
  texto("DESCRIPCIÓN", x1 + 2, L.tit + L.cab / 2, "left", "600 ");
  texto("CÓDIGO DGE", (x2 + xw) / 2, L.tit + L.cab / 2, "center", "600 ", L.w[2] - 2);
  filas.forEach((f, i) => {
    const y = L.tit + L.cab + i * L.fila,
      yc = y + L.fila / 2;
    if (i) linea(0, y, xw, y);
    texto(f.n, x1 + 2, yc, "left", "", L.w[1] - 4);
    if (f.c) texto(f.c, (x2 + xw) / 2, yc, "center", "", L.w[2] - 2);
    const [Xc, Yc] = P(x1 / 2, yc);
    if (f.nota) return;
    if (f.k) {
      const c = plColorDis(dsColorEl({ t: "sim", k: f.k }, dsCapa(DS_SIS[DS_CAT[f.k].s].capa)));
      dsDibSim(g, f.k, Xc, Yc, 0, Math.min(dsUk(f.k) * s, ((L.fila - 2) * m * s) / 20), c, PL_FONDO, lw);
    } else {
      // Muestra de tubería (continua o a trazos) o de conductor con su marca
      const a = el.x + 2 * m,
        b = el.x + (x1 - 2) * m,
        yy = el.y - yc * m,
        mt = { pts: [a, yy, b, yy], cond: f.cond };
      g.save();
      g.strokeStyle = col;
      if (f.tub === "piso") g.setLineDash([dsMm(3) * s, dsMm(1.5) * s]);
      g.beginPath();
      plRuta(g, mt.pts, false);
      g.stroke();
      g.restore();
      if (f.cond) dsMarcas(g, mt, col, s, lw, 0.5);
    }
  });
  g.restore();
}
const dsEsTabla = el => el.t === "ley" || el.t === "cua";
function dsBBox(el) {
  if (dsEsTabla(el)) {
    const [W, H] = el.t === "cua" ? dsTamCua() : dsTamLey();
    return [el.x, el.y - H, el.x + W, el.y];
  }
  if (el.t === "sim") {
    const b = dsBBs(el.k);
    return dsCaja(
      [
        [b[0], b[1]],
        [b[2], b[1]],
        [b[2], b[3]],
        [b[0], b[3]]
      ].flatMap(([a, c]) => dsAMundo(el, a, c))
    );
  }
  if (el.t === "cir") return [el.x - el.rad, el.y - el.rad, el.x + el.rad, el.y + el.rad];
  if (el.t === "txt") {
    const w = el.ht * 0.62 * el.s.length;
    return [el.x, el.y - el.ht * 0.2, el.x + w, el.y + el.ht];
  }
  if (el.t === "cot") {
    const G = dsCotaGeo(el);
    return dsCaja([...el.a, ...el.b, ...G.pa, ...G.pb]);
  }
  if (el.t === "dir") {
    const G = dsDirGeo(el),
      w = el.ht * 0.62 * el.s.length;
    return dsCaja([...G.tip, ...G.codo, G.fin[0] + G.lado * w, G.fin[1] - el.ht / 2, G.fin[0], G.fin[1] + el.ht / 2]);
  }
  return dsCaja(dsCurva(el));
}
function dsDistSeg(p, x, y) {
  let md = Infinity;
  for (let j = 0; j + 3 < p.length; j += 2) {
    const ax = p[j],
      ay = p[j + 1],
      dx = p[j + 2] - ax,
      dy = p[j + 3] - ay,
      l2 = dx * dx + dy * dy,
      t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    md = Math.min(md, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return md;
}
// Líneas que forman un elemento (para tocarlo, engancharse y encajar símbolos en él)
function dsLineas(el) {
  if (el.t === "lin" || el.t === "tub") return [dsCurva(el)];
  if (dsEsTabla(el)) {
    const b = dsBBox(el);
    return [[b[0], b[1], b[2], b[1], b[2], b[3], b[0], b[3], b[0], b[1]]];
  }
  if (el.t === "cot") {
    const G = dsCotaGeo(el);
    return [[...G.pa, ...G.pb]];
  }
  if (el.t === "dir") {
    const G = dsDirGeo(el);
    return [[...G.tip, ...G.codo, ...G.fin]];
  }
  if (el.t === "cir") {
    const p = [];
    for (let i = 0; i <= 48; i++)
      p.push(el.x + el.rad * Math.cos((i * Math.PI) / 24), el.y + el.rad * Math.sin((i * Math.PI) / 24));
    return [p];
  }
  return [];
}
// Elemento editable bajo el punto, o null: primero los símbolos y textos (aunque una tubería pase por encima) y
// después las líneas; entre iguales, el último dibujado
/* ---------- Índice espacial del diseño ----------
   Para que el cursor responda al instante en proyectos grandes: el rectángulo de cada elemento se anota en las
   celdas de una cuadrícula que tapa; al mover el cursor (tocar, enganchar, conectar) y al dibujar, solo se revisan
   los elementos de las celdas cercanas o visibles. El índice se rehace cuando el diseño cambia (DS_IDXV). */
let DS_IDX = null,
  DS_IDXV = 0;
const dsIdxSucio = () => DS_IDXV++;
function dsIdx() {
  const D = dsD();
  if (DS_IDX && DS_IDX.D === D && DS_IDX.v === DS_IDXV && DS_IDX.n === D.els.length) return DS_IDX;
  const bb = new Map(),
    pos = new Map();
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  D.els.forEach((el, i) => {
    let b;
    try {
      b = dsBBox(el);
    } catch (e) {
      b = null;
    }
    if (!b || !b.every(Number.isFinite)) return;
    bb.set(el, b);
    pos.set(el, i);
    x0 = Math.min(x0, b[0]);
    y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]);
    y1 = Math.max(y1, b[3]);
  });
  // Sin elementos: un índice vacío (con números finitos)
  if (!bb.size) x0 = y0 = x1 = y1 = 0;
  // Celdas de alrededor de 1/150 del diseño (al menos 0.25 m)
  const tam = Math.max((x1 - x0) / 150, (y1 - y0) / 150, 0.25 / (EPL ? EPL.f : 1)) || 1,
    cel = new Map(),
    grandes = [];
  bb.forEach((b, el) => {
    const i0 = Math.floor((b[0] - x0) / tam),
      i1 = Math.floor((b[2] - x0) / tam),
      j0 = Math.floor((b[1] - y0) / tam),
      j1 = Math.floor((b[3] - y0) / tam);
    // Los elementos que tapan muchas celdas (una leyenda, una tubería muy larga) van aparte y se revisan siempre
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) return grandes.push(el);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = i + "," + j;
        (cel.get(k) || cel.set(k, []).get(k)).push(el);
      }
  });
  return (DS_IDX = { D, v: DS_IDXV, n: D.els.length, bb, pos, cel, grandes, tam, x0, y0 });
}
// Elementos cuyo rectángulo toca el rectángulo [xa, ya, xb, yb] (sin repetir)
function dsEnZona(xa, ya, xb, yb) {
  if (!dsD() || ![xa, ya, xb, yb].every(Number.isFinite)) return [];
  const I = dsIdx();
  if (!I.bb.size) return [];
  const out = new Set(),
    i0 = Math.floor((xa - I.x0) / I.tam),
    i1 = Math.floor((xb - I.x0) / I.tam),
    j0 = Math.floor((ya - I.y0) / I.tam),
    j1 = Math.floor((yb - I.y0) / I.tam),
    toca = el => {
      const b = I.bb.get(el);
      return b && b[0] <= xb && b[2] >= xa && b[1] <= yb && b[3] >= ya;
    };
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 40000) return I.D.els.filter(toca);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) for (const el of I.cel.get(i + "," + j) || []) if (toca(el)) out.add(el);
  I.grandes.forEach(el => toca(el) && out.add(el));
  return [...out];
}
const dsCercanos = (x, y, r) => dsEnZona(x - r, y - r, x + r, y + r);
function dsHit(x, y, r) {
  const D = dsD();
  if (!D) return null;
  // Solo los cercanos, en el orden del dibujo; se recorre desde el final: los símbolos y textos van al final para
  // revisarse primero
  const I = dsIdx(),
    cand = dsCercanos(x, y, r).sort((a, b) => I.pos.get(a) - I.pos.get(b)),
    orden = [
      ...cand.filter(el => el.t !== "sim" && el.t !== "txt"),
      ...cand.filter(el => el.t === "sim" || el.t === "txt")
    ];
  for (let i = orden.length - 1; i >= 0; i--) {
    const el = orden[i];
    if (!dsEditable(el)) continue;
    if (el.t === "sim") {
      const u = dsUk(el.k),
        rr = ((el.r || 0) * Math.PI) / 180,
        wx = (x - el.x) / u,
        wy = (y - el.y) / u,
        a = wx * Math.cos(rr) + wy * Math.sin(rr),
        b = wx * Math.sin(rr) - wy * Math.cos(rr),
        bb = dsBBs(el.k),
        t = r / u;
      if (a >= bb[0] - t && a <= bb[2] + t && b >= bb[1] - t && b <= bb[3] + t) return el.id;
    } else if (el.t === "txt" || dsEsTabla(el)) {
      const b = dsBBox(el);
      if (x >= b[0] - r && x <= b[2] + r && y >= b[1] - r && y <= b[3] + r) return el.id;
    } else {
      if (dsLineas(el).some(p => dsDistSeg(p, x, y) <= r)) return el.id;
      // El texto de la cota o de la directriz también la toca
      if (el.t === "cot" || el.t === "dir") {
        const b = dsBBox(el);
        if (el.t === "dir" && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return el.id;
      }
    }
  }
  return null;
}
// Puntos de enganche del diseño (o de los elementos dados): inserciones (4), extremos y vértices (1), puntos
// medios (2) y centros (3)
function dsPuntosEnganche(lista) {
  const D = dsD(),
    out = [];
  if (!D) return out;
  for (const el of lista || D.els) {
    if (!dsVis(el)) continue;
    if (dsEsTabla(el)) out.push([el.x, el.y, 4]);
    else if (el.t === "sim" || el.t === "txt") {
      out.push([el.x, el.y, 4]);
      // Salidas de circuito del tablero (tipo 8), con su circuito
      if (el.k === "tab")
        dsSalidasTab(el).forEach(o => out.push([o.p[0], o.p[1], 8, { cir: o.n, tab: el.id, nom: el.nom || "" }]));
    } else if (el.t === "cir") out.push([el.x, el.y, 3]);
    else if (el.t === "cot") out.push([...el.a, 1], [...el.b, 1]);
    else if (el.t === "dir") out.push([el.pts[0], el.pts[1], 1], [el.pts[2], el.pts[3], 1]);
    else {
      for (let i = 0; i < el.pts.length; i += 2) out.push([el.pts[i], el.pts[i + 1], 1]);
      dsTramos(el).forEach(t => out.push([...t.m, 2]));
    }
  }
  return out;
}

/* ---------- Conexiones: tuberías que llegan a los artefactos ----------
   Cada artefacto (luminaria, tomacorriente, interruptor, caja…) recibe tuberías: la punta de la tubería se atrae a
   él cuando queda cerca (imán) y termina en su borde, hacia el tramo que llega. La tubería guarda el artefacto de
   su inicio (c0) y de su final (c1): si el artefacto se mueve o gira, la tubería lo sigue; el circuito de la
   tubería pasa al artefacto. El tablero se conecta por sus salidas C-1, C-2… */
const DS_CON = {};
// Forma de llegada de cada símbolo, en sus unidades: su círculo principal o, si no tiene, su rectángulo
function dsFormaCon(k) {
  if (DS_CON[k]) return DS_CON[k];
  const b = dsBBs(k),
    w = b[2] - b[0],
    h = b[3] - b[1];
  let c = null;
  dsPrims(k).forEach(p => {
    if (p.t === "c" && (!c || p.a[2] > c.a[2])) c = p;
  });
  return (DS_CON[k] =
    c && c.a[2] >= 0.2 * Math.min(w, h)
      ? { c: [c.a[0], c.a[1]], r: c.a[2] }
      : { c: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], w: w / 2, h: h / 2 });
}
// Del dibujo a las unidades del símbolo (lo inverso de dsAMundo)
function dsALocal(el, x, y) {
  const u = dsUk(el.k),
    r = ((el.r || 0) * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    wx = (x - el.x) / u,
    wy = (y - el.y) / u;
  return [wx * c + wy * s, wx * s - wy * c];
}
const dsCentroCon = el => {
  const f = dsFormaCon(el.k);
  return dsAMundo(el, f.c[0], f.c[1]);
};
// Punto del borde del artefacto en la dirección de (x, y): allí termina la tubería
function dsBorde(el, x, y) {
  const f = dsFormaCon(el.k),
    [a, b] = dsALocal(el, x, y);
  let dx = a - f.c[0],
    dy = b - f.c[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return dsCentroCon(el);
  dx /= d;
  dy /= d;
  const t = f.r || Math.min(dx ? f.w / Math.abs(dx) : Infinity, dy ? f.h / Math.abs(dy) : Infinity);
  return dsAMundo(el, f.c[0] + dx * t, f.c[1] + dy * t);
}
// Radio en que el artefacto atrae la punta de la tubería (en el dibujo)
const dsRadioCon = el => {
  const f = dsFormaCon(el.k);
  return (f.r || Math.max(f.w, f.h)) * dsUk(el.k);
};
const dsConecta = el => !!(el && el.t === "sim" && el.k !== "tab" && DS_CAT[el.k] && dsVis(el));
// Tablero bajo el punto (dentro de su rectángulo, con r de tolerancia)
function dsTableroEn(x, y, r) {
  return (
    dsCercanos(x, y, r).find(el => {
      if (el.t !== "sim" || el.k !== "tab" || !dsVis(el)) return false;
      const [a, b] = dsALocal(el, x, y),
        bb = dsBBs("tab"),
        t = r / dsUk("tab");
      return a >= bb[0] - t && a <= bb[2] + t && b >= bb[1] - t && b <= bb[3] + t;
    }) || null
  );
}
// Invierte el sentido de una tubería (para que empiece en el tablero)
function dsInvertirTub(el) {
  const q = [];
  for (let i = el.pts.length - 2; i >= 0; i -= 2) q.push(el.pts[i], el.pts[i + 1]);
  el.pts = q;
  if (el.b)
    el.b = el.b
      .slice(0, el.pts.length / 2 - 1)
      .reverse()
      .map(k => -k);
  const c0 = el.c0;
  if (el.c1) el.c0 = el.c1;
  else delete el.c0;
  if (c0) el.c1 = c0;
  else delete el.c1;
}
// Artefacto que atrae un punto (x, y), con r de tolerancia
function dsArtefactoEn(x, y, r) {
  let mejor = null,
    md = Infinity;
  dsCercanos(x, y, r).forEach(el => {
    if (!dsConecta(el)) return;
    const c = dsCentroCon(el),
      dd = Math.hypot(c[0] - x, c[1] - y);
    if (dd <= dsRadioCon(el) + r && dd < md) {
      md = dd;
      mejor = el;
    }
  });
  return mejor;
}
// Punto anterior a la punta que se está colocando: al dibujar una tubería o al arrastrar la punta de una
function dsContextoCon() {
  if (dsEsTub(PLH.h)) return { ref: PLH.pts[PLH.pts.length - 1] || null };
  const ag = PLH.agarre,
    el = ag && ag.t === "v" && dsD() ? dsD().els.find(e => e.id === ag.id) : null;
  if (!el || el.t !== "tub") return null;
  const n = el.pts.length / 2;
  if (ag.i === 0) return { ref: [el.pts[2], el.pts[3]] };
  if (ag.i === n - 1) return { ref: [el.pts[2 * n - 4], el.pts[2 * n - 3]] };
  return null;
}
// Enganche de conexión (tipo 9): el borde del artefacto cercano, hacia el punto anterior
function dsEngancheCon(x, y, r) {
  const cx = dsContextoCon();
  if (!cx) return null;
  const el = dsArtefactoEn(x, y, r);
  if (!el) {
    // Sobre el tablero (al dibujar una tubería): un clic muestra sus salidas para elegir una
    const tb = dsEsTub(PLH.h) && dsTableroEn(x, y, r);
    return tb ? [tb.x, tb.y, 10, { tabla: tb.id, nom: tb.nom || "el tablero" }] : null;
  }
  const p = cx.ref ? dsBorde(el, cx.ref[0], cx.ref[1]) : dsCentroCon(el);
  return [p[0], p[1], 9, { con: el.id, nom: DS_CAT[el.k].n }];
}
// El circuito (y su tablero) de la tubería pasa a los artefactos que aún no tienen
function dsHeredar(t) {
  if (!t.cir) return;
  ["c0", "c1"].forEach(c => {
    const s = t[c] && dsD().els.find(e => e.id === t[c]);
    if (s && s.k !== "tab" && !s.cir) {
      s.cir = t.cir;
      if (t.tab) s.tab = t.tab;
    }
  });
}
// Las puntas conectadas siguen a su artefacto (al moverlo, girarlo o editarlo)
function dsReconectar() {
  const D = dsD();
  if (!D) return;
  const por = new Map(D.els.filter(e => e.t === "sim").map(e => [e.id, e]));
  D.els.forEach(t => {
    if (t.t !== "tub" || !(t.c0 || t.c1)) return;
    const n = t.pts.length / 2;
    for (let vuelta = 0; vuelta < (n === 2 ? 2 : 1); vuelta++)
      ["c0", "c1"].forEach(c => {
        if (!t[c]) return;
        const s = por.get(t[c]);
        if (!s) return delete t[c];
        // Una tubería que se arrastra sola (sin su artefacto) se desconecta al soltarla
        if (PLH.arr && DS_SEL.has(t.id) && !DS_SEL.has(s.id)) return;
        const i = c === "c0" ? 0 : n - 1,
          j = c === "c0" ? 1 : n - 2;
        let p;
        if (s.k === "tab") {
          // En el tablero: la salida de su circuito (si el tablero ya no la tiene, se suelta)
          const o = dsSalidasTab(s).find(q => q.n === t.cir);
          if (!o) return delete t[c];
          p = o.p;
        } else p = dsBorde(s, t.pts[2 * j], t.pts[2 * j + 1]);
        t.pts[2 * i] = p[0];
        t.pts[2 * i + 1] = p[1];
      });
  });
}
// El circuito se propaga por lo conectado: de la tubería a sus artefactos y de ellos a las tuberías sin circuito
function dsPropagarCircuitos() {
  const D = dsD();
  if (!D) return;
  const por = new Map(D.els.map(e => [e.id, e])),
    tubs = D.els.filter(e => e.t === "tub" && (e.c0 || e.c1));
  for (let vuelta = 0, cambio = true; cambio && vuelta < 50; vuelta++) {
    cambio = false;
    tubs.forEach(t => {
      const ss = [t.c0, t.c1].map(id => por.get(id)).filter(s => s && s.k !== "tab");
      if (t.cir)
        ss.forEach(s => {
          if (!s.cir) {
            s.cir = t.cir;
            if (t.tab) s.tab = t.tab;
            cambio = true;
          }
        });
      else {
        const s = ss.find(x => x.cir);
        if (s) {
          t.cir = s.cir;
          if (s.tab) t.tab = s.tab;
          cambio = true;
        }
      }
    });
  }
}
// Tuberías que se mueven o giran sin su artefacto: dejan de estar conectadas a él
function dsDesligar(sel) {
  const ids = new Set(sel.map(el => el.id));
  sel.forEach(t => {
    if (t.t !== "tub") return;
    ["c0", "c1"].forEach(c => {
      if (t[c] && !ids.has(t[c])) delete t[c];
    });
  });
}
// Al soltar la punta de una tubería: queda conectada al artefacto donde cayó, o suelta
function dsAgarreSoltar(ag, eng) {
  const el = dsD() && dsD().els.find(e => e.id === ag.id);
  if (!el || el.t !== "tub") return;
  if (ag.t === "ins") return dsDesligar([el]);
  if (ag.t !== "v") return;
  const n = el.pts.length / 2,
    c = ag.i === 0 ? "c0" : ag.i === n - 1 ? "c1" : null;
  if (!c) return;
  if (eng && eng[2] === 9) {
    el[c] = eng[3].con;
    dsHeredar(el);
  } else delete el[c];
}
// Lo que no está conectado: artefactos sin tubería y puntas de tubería que no llegan a nada
function dsSueltos() {
  const D = dsD(),
    out = { sims: [], puntas: [] };
  if (!D) return out;
  const tubs = D.els.filter(e => e.t === "tub" && dsVis(e)),
    con = new Set(),
    tol = 0.01 / (EPL ? EPL.f : 1);
  tubs.forEach(t => [t.c0, t.c1].forEach(c => c && con.add(c)));
  D.els.forEach(el => {
    if (dsConecta(el) && !con.has(el.id)) out.sims.push(el);
  });
  // Una punta que toca un vértice de otra tubería (derivación) también cuenta como conectada
  const toca = (t, x, y) =>
    tubs.some(o => {
      if (o === t) return false;
      for (let i = 0; i < o.pts.length; i += 2) if (Math.hypot(o.pts[i] - x, o.pts[i + 1] - y) < tol) return true;
      return false;
    });
  tubs.forEach(t => {
    const n = t.pts.length;
    if (!t.c0 && !t.tab && !toca(t, t.pts[0], t.pts[1])) out.puntas.push({ el: t, p: [t.pts[0], t.pts[1]] });
    if (!t.c1 && !toca(t, t.pts[n - 2], t.pts[n - 1])) out.puntas.push({ el: t, p: [t.pts[n - 2], t.pts[n - 1]] });
  });
  return out;
}
// Conecta las puntas sueltas que ya están sobre un artefacto (por ejemplo, las dibujadas antes de esta versión)
function dsConectarAuto() {
  const D = dsD();
  if (!D) return 0;
  let k = 0;
  const tol = dsMm(1);
  // Puntas sobre una salida de tablero: la tubería queda saliendo de ella
  const sal = D.els.filter(e => e.k === "tab").flatMap(tb => dsSalidasTab(tb).map(o => ({ ...o, tb })));
  const salEn = (x, y) => sal.find(o => Math.hypot(o.p[0] - x, o.p[1] - y) < tol * 3);
  D.els.forEach(t => {
    if (t.t !== "tub") return;
    const n = t.pts.length;
    if (!t.c0 || !t.c1) {
      const a = !t.c0 && salEn(t.pts[0], t.pts[1]),
        b = !a && !t.c1 && salEn(t.pts[n - 2], t.pts[n - 1]);
      if (b) dsInvertirTub(t);
      const o = a || b;
      if (o) {
        t.c0 = o.tb.id;
        t.tab = o.tb.id;
        t.cir = o.n;
        k++;
      }
    }
    if (!t.c0 && !t.tab) {
      const s = dsArtefactoEn(t.pts[0], t.pts[1], tol);
      if (s && s.id !== t.c1) {
        t.c0 = s.id;
        k++;
      }
    }
    if (!t.c1) {
      const s = dsArtefactoEn(t.pts[n - 2], t.pts[n - 1], tol);
      if (s && s.id !== t.c0) {
        t.c1 = s.id;
        k++;
      }
    }
    dsHeredar(t);
  });
  return k;
}
// Marcas naranjas de lo no conectado (solo en el editor)
function dsDibSueltos(g) {
  if (!DSU.sueltos || dsU() * PLV.s * 17 < 6) return;
  const s = dsSueltos(),
    d = plDpr(),
    nar = PL_OSCURO ? "#ff9b4a" : "#e8590c";
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineWidth = 1.4 * d;
  const punto = (X, Y, r) => {
    g.beginPath();
    g.arc(X, Y, r, 0, 2 * Math.PI);
    g.fillStyle = nar;
    g.fill();
    g.strokeStyle = PL_OSCURO ? "#111922" : "#fff";
    g.stroke();
  };
  s.puntas.forEach(o => punto(...plAPant(o.p[0], o.p[1]), 3.5 * d));
  s.sims.forEach(el => {
    const b = dsBBox(el),
      [X, Y] = plAPant(b[2], b[3]);
    punto(X + 2 * d, Y - 2 * d, 3 * d);
  });
  g.restore();
}

/* ---------- Rejilla ---------- */
// Paso de la rejilla en unidades del dibujo
const dsPasoU = () => DSU.paso / (EPL ? EPL.f : 1);
function dsRejilla(g) {
  if (!DSU.rej || !EPL) return;
  const W = plW(),
    H = plH(),
    s = PLV.s;
  let p = dsPasoU(),
    k = 1;
  while (p * k * s < 9) k *= 5;
  const paso = p * k,
    [x0, y1] = plADib(0, 0),
    [x1, y0] = plADib(W, H),
    i0 = Math.floor(x0 / paso),
    i1 = Math.ceil(x1 / paso),
    j0 = Math.floor(y0 / paso),
    j1 = Math.ceil(y1 / paso);
  if ((i1 - i0) * (j1 - j0) > 400000) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineWidth = 1;
  const linea = (mayor, vert, v) => {
    g.strokeStyle = PL_OSCURO
      ? mayor
        ? "rgba(255,255,255,.10)"
        : "rgba(255,255,255,.045)"
      : mayor
        ? "rgba(20,48,79,.13)"
        : "rgba(20,48,79,.055)";
    g.beginPath();
    if (vert) {
      const X = Math.round(plAPant(v, 0)[0]) + 0.5;
      g.moveTo(X, 0);
      g.lineTo(X, H);
    } else {
      const Y = Math.round(plAPant(0, v)[1]) + 0.5;
      g.moveTo(0, Y);
      g.lineTo(W, Y);
    }
    g.stroke();
  };
  for (let i = i0; i <= i1; i++) linea(i % 5 === 0, true, i * paso);
  for (let j = j0; j <= j1; j++) linea(j % 5 === 0, false, j * paso);
  g.restore();
}
const dsAlaRejilla = p => {
  const q = dsPasoU();
  return [Math.round(p[0] / q) * q, Math.round(p[1] / q) * q];
};

/* ---------- Dibujo de los elementos ---------- */
function dsPintar(g) {
  const D = dsD();
  if (!D || !PL_MOD) return;
  const s = PLV.s,
    u = dsU() * s,
    W = plW(),
    H = plH();
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  let vista = null;
  if (!DS_EXPORT) {
    const a = plADib(0, H),
      b = plADib(W, 0),
      m = dsMm(12);
    vista = new Set(dsEnZona(a[0] - m, a[1] - m, b[0] + m, b[1] + m));
  }
  for (const el of D.els) {
    if (!dsVis(el) || (vista && !vista.has(el))) continue;
    // Capa del elemento para la lámina y el DXF (el lienzo de grabación la anota)
    g.capa = el.capa;
    // Color propio del elemento o, si no tiene, el de su capa
    const cap = dsCapaDe(el),
      col = plColorDis(dsColorEl(el, cap));
    if (el.t === "sim") {
      const [X, Y] = plAPant(el.x, el.y),
        uk = u * dsTam(el.k);
      if (!DS_EXPORT && (X < -40 * uk || X > W + 40 * uk || Y < -40 * uk || Y > H + 40 * uk)) continue;
      if (uk * 17 < 2.5) {
        g.fillStyle = col;
        g.fillRect(X - 1, Y - 1, 2, 2);
        continue;
      }
      dsDibSim(g, el.k, X, Y, ((el.r || 0) * Math.PI) / 180, uk, col, PL_FONDO, dsGrosor(cap), el.dt);
      if (el.enc) dsDibEnc(g, el, col, s);
      if (D.nsal && el.cir && el.k !== "tab") dsDibNum(g, el, col, s);
      if (el.k === "tab") dsDibSalidas(g, el, col, uk, dsGrosor(cap));
    } else if (el.t === "txt") {
      const hp = el.ht * s;
      if (hp < 2) continue;
      const [X, Y] = plAPant(el.x, el.y);
      g.save();
      g.translate(X, Y);
      g.rotate((-(el.r || 0) * Math.PI) / 180);
      g.font = `${hp / 0.72}px Arial, sans-serif`;
      g.fillStyle = col;
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.fillText(el.s, 0, 0);
      g.restore();
    } else if (el.t === "ley") dsDibLeyenda(g, el, col, s, dsGrosor(cap));
    else if (el.t === "cua") dsDibCuadro(g, el, col, s, dsGrosor(cap));
    else if (el.t === "cot") dsDibCota(g, el, col, s, dsGrosor(cap));
    else if (el.t === "dir") dsDibDir(g, el, col, s, dsGrosor(cap));
    else {
      g.strokeStyle = col;
      g.lineWidth = dsGrosor(cap);
      g.setLineDash(dsGuiones(el, cap).map(v => v * s));
      g.beginPath();
      if (el.t === "cir") {
        const [X, Y] = plAPant(el.x, el.y);
        g.arc(X, Y, el.rad * s, 0, 2 * Math.PI);
      } else plRuta(g, dsCurva(el), false);
      g.stroke();
      g.setLineDash([]);
      if (el.t === "tub" && (D.etq !== "no" || D.cirt)) dsEtiquetasTub(g, el, col, s);
      if (el.t === "tub" && el.cond && DSU.marcas) dsMarcas(g, el, col, s, dsGrosor(cap));
    }
  }
  g.restore();
  dsDibSueltos(g);
}
// Longitudes de una tubería: la total en su tramo central o la de cada tramo; texto de 2 mm impreso, a lo largo del
// tramo y del lado de afuera de la curva (en un tramo recto, a su izquierda), sin tocar la línea
function dsEtiquetasTub(g, el, col, s) {
  const ht = dsMm(2),
    hp = ht * s;
  if (hp < 5) return;
  const T = dsTramos(el),
    etq = (t, txt) => {
      // Normal hacia afuera del arco: la curva positiva va a la derecha del sentido del tramo
      const nx = t.k > 0 ? Math.sin(t.ang) : -Math.sin(t.ang),
        ny = t.k > 0 ? -Math.cos(t.ang) : Math.cos(t.ang),
        sep = ht * 0.5 + dsMm(el.cond && DSU.marcas ? 2 : 0.8),
        [X, Y] = plAPant(t.m[0] + nx * sep, t.m[1] + ny * sep);
      g.save();
      g.translate(X, Y);
      g.rotate(-dsLegible(t.ang));
      g.font = `${hp / 0.72}px Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = 3 * plDpr();
      g.strokeStyle = PL_FONDO;
      g.strokeText(txt, 0, 0);
      g.fillStyle = col;
      g.fillText(txt, 0, 0);
      g.restore();
    };
  if (dsD().etq === "tramo") T.forEach(t => etq(t, `${fmt(t.L * EPL.f, 2)} m`));
  else if (T.length && dsD().etq !== "no") etq(T[Math.floor((T.length - 1) / 2)], `${fmt(dsLargo(el) * EPL.f, 2)} m`);
  // Circuito y diámetro, al otro lado de la tubería, en el medio de su recorrido
  if (dsD().cirt && (el.cir || el.dia) && T.length) {
    const t = T[Math.floor((T.length - 1) / 2)];
    etq({ ...t, k: -(t.k || -1e-9) }, [el.cir, el.dia ? `Ø${el.dia} mm` : ""].filter(Boolean).join(" · "));
  }
}
/* Marcas de conductores sobre la tubería (Norma DGE): una raya oblicua por fase; el neutro con un punto en su
   extremo (09-93-01) y la tierra con un tope (09-93-02). Van juntas, a un tercio del recorrido (en el medio está
   la longitud). Medidas en el papel (mm), como los textos. */
// Punto a una fracción del largo de la línea y la dirección allí
function dsPuntoA(el, frac) {
  const P = dsCurva(el);
  let tot = 0;
  for (let i = 2; i < P.length; i += 2) tot += Math.hypot(P[i] - P[i - 2], P[i + 1] - P[i - 1]);
  let falta = tot * frac,
    pt = [P[0], P[1]],
    ang = 0;
  for (let i = 2; i < P.length; i += 2) {
    const l = Math.hypot(P[i] - P[i - 2], P[i + 1] - P[i - 1]);
    ang = Math.atan2(P[i + 1] - P[i - 1], P[i] - P[i - 2]);
    if (l >= falta) {
      pt = [P[i - 2] + ((P[i] - P[i - 2]) * falta) / l, P[i - 1] + ((P[i + 1] - P[i - 1]) * falta) / l];
      break;
    }
    falta -= l;
  }
  return { pt, ang };
}
// Neutros de una tubería (antes, sí o no)
const dsNeutros = c => (c.n === true ? 1 : c.n || 0);
function dsMarcas(g, el, col, s, lw, frac = 0.5) {
  const c = el.cond,
    tipos = [...Array(c.f || 0).fill("f"), ...Array(dsNeutros(c)).fill("n"), ...(c.t ? ["t"] : [])];
  if (!tipos.length || dsMm(1) * s < 1.2) return;
  const { pt, ang } = dsPuntoA(el, frac),
    recta = DSU.marcaEst === "recta",
    m = dsMm(1),
    ux = Math.cos(ang),
    uy = Math.sin(ang),
    // Del papel (a lo largo, a través) al lienzo
    aP = (a, b) => plAPant(pt[0] + (a * ux - b * uy) * m, pt[1] + (a * uy + b * ux) * m),
    sep = 1.1;
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = lw;
  g.setLineDash([]);
  tipos.forEach((t, k) => {
    const a = (k - (tipos.length - 1) / 2) * sep,
      i = recta ? 0 : 0.5,
      [x0, y0] = aP(a - i, -1.3),
      [x1, y1] = aP(a + i, 1.3);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    if (t === "t") {
      const [x2, y2] = aP(a + i + 0.8, 1.3);
      g.lineTo(x2, y2);
    }
    g.stroke();
    if (t === "n") {
      g.beginPath();
      g.arc(x1, y1, 0.38 * m * s, 0, 2 * Math.PI);
      g.fill();
    }
  });
  g.restore();
}
// Tubería cuyas marcas (o el medio de su recorrido, si aún no tiene) están bajo el punto
function dsMarcasEn(x, y) {
  const r = dsMm(2.5);
  return (
    (dsD() ? dsD().els : []).find(el => {
      if (el.t !== "tub" || !dsEditable(el)) return false;
      const { pt } = dsPuntoA(el, 0.5);
      return Math.hypot(pt[0] - x, pt[1] - y) < r;
    }) || null
  );
}
// Ventanita con los conductores de la tubería, junto a sus marcas
function dsVentanaCond(el) {
  const c = el.cond || {},
    { pt } = dsPuntoA(el, 0.5),
    op = (k, n, v, suf) =>
      `<select data-edc="${k}">${Array.from({ length: n + 1 }, (x, i) => `<option value="${i}"${i === v ? " selected" : ""}>${i} ${suf}</option>`).join("")}</select>`;
  edMenuLista(
    pt,
    `<div class="ed-mt">Conductores de la tubería${el.cir ? " · " + esc(el.cir) : ""}</div>` +
      `<div class="ed-mc">${op("f", 6, c.f || 0, "F")}${op("n", 2, dsNeutros(c), "N")}<label><input type="checkbox" data-edc="t"${c.t ? " checked" : ""}>T</label></div>` +
      `<div class="ed-mc"><select data-edc="dia"><option value="">Diámetro —</option>${DS_DIAS.map(d => `<option value="${d}"${d === el.dia ? " selected" : ""}>Ø ${d} mm</option>`).join("")}</select></div>` +
      (el.cir
        ? `<hr><button type="button" data-edm="sal:1" role="menuitem"><span>Igual en todo el circuito ${esc(el.cir)}</span></button>`
        : ""),
    () => {
      DS_SEL.clear();
      DS_SEL.add(el.id);
      edProps();
      $("edPropC").querySelector('[data-dsa="condcir"]')?.click();
    },
    e => {
      const k = e.target.dataset.edc,
        v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      if (k === "dia") el.dia = DS_DIAS.includes(+v) ? +v : undefined;
      else {
        const n = { f: 0, n: 0, t: false, ...(el.cond || {}) };
        n.n = dsNeutros(n);
        if (k === "t") n.t = !!v;
        else n[k] = parseInt(v, 10) || 0;
        if (n.f || n.n || n.t) el.cond = n;
        else delete el.cond;
      }
      edCambio();
    }
  );
}
// Transportador: círculo con rayitas cada «paso» grados, la del ángulo actual resaltada, y el arco desde 0° hasta él
// (rastreo polar y giro de símbolos). libre: el ángulo no está enganchado a una rayita
function dsTransportador(g, X, Y, ang, paso, col, d, libre, radio = 34) {
  const R = radio * d,
    p = Math.max(1, paso || 15),
    // Con pasos muy finos, las rayitas cada 15° (si no, no se distinguen)
    pr = p < 5 ? 15 : p;
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.globalAlpha = 0.35;
  g.lineWidth = 1 * d;
  g.beginPath();
  g.arc(X, Y, R, 0, 2 * Math.PI);
  g.stroke();
  for (let a = 0; a < 360; a += pr) {
    const t = (a * Math.PI) / 180,
      l = a % 90 === 0 ? 9 * d : a % 45 === 0 ? 7 * d : 4 * d;
    g.beginPath();
    g.moveTo(X + R * Math.cos(t), Y - R * Math.sin(t));
    g.lineTo(X + (R + l) * Math.cos(t), Y - (R + l) * Math.sin(t));
    g.stroke();
  }
  // Arco de 0° al ángulo actual y la rayita actual, resaltados
  const n = ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  g.globalAlpha = 0.85;
  g.lineWidth = 2 * d;
  g.beginPath();
  g.arc(X, Y, R * 0.55, 0, -n, true);
  g.stroke();
  g.beginPath();
  g.moveTo(X + (R - 6 * d) * Math.cos(n), Y - (R - 6 * d) * Math.sin(n));
  g.lineTo(X + (R + 12 * d) * Math.cos(n), Y - (R + 12 * d) * Math.sin(n));
  g.stroke();
  if (!libre) {
    g.beginPath();
    g.arc(X + R * Math.cos(n), Y - R * Math.sin(n), 3 * d, 0, 2 * Math.PI);
    g.fill();
  }
  g.restore();
}
// Texto breve con los datos de un elemento (información al pasar el cursor)
function dsInfoEl(el) {
  const f = EPL.f;
  if (el.t === "sim") {
    const c = DS_CAT[el.k];
    if (!c) return "";
    const pot = el.p ?? dsPotDef(el.k),
      tb = el.tab && dsD().els.find(e => e.id === el.tab);
    return [
      el.k === "tab" ? `${el.nom || "Tablero"} · ${el.nc || 0} circuitos` : c.n,
      el.cir ? `${el.cir}${tb ? " " + (tb.nom || "") : ""}` : "",
      c.u && pot != null ? `${pot} ${c.u}` : "",
      el.enc ? `encendido «${el.enc}»` : ""
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (el.t === "tub")
    return [
      `Tubería en ${el.modo === "piso" ? "piso" : "techo"}`,
      el.cir || "",
      `${fmt(dsLargo(el) * f, 2)} m`,
      el.cond ? dpCond(el.cond) : "",
      el.dia ? `Ø ${el.dia} mm` : ""
    ]
      .filter(Boolean)
      .join(" · ");
  if (el.t === "lin") return `Línea · ${fmt(dsLargo(el) * f, 2)} m`;
  return "";
}
// Letra de encendido (a, b, c…) junto al artefacto, arriba a la izquierda, siempre derecha
function dsDibEnc(g, el, col, s) {
  const hp = dsMm(2.2) * s;
  if (hp < 4) return;
  const b = dsBBox(el),
    [X, Y] = plAPant(b[0], b[3]);
  g.save();
  g.font = `italic 600 ${hp / 0.72}px Arial, sans-serif`;
  g.textAlign = "right";
  g.textBaseline = "bottom";
  g.lineJoin = "round";
  g.lineWidth = 3 * plDpr();
  g.strokeStyle = PL_FONDO;
  g.strokeText(el.enc, X, Y + hp * 0.2);
  g.fillStyle = col;
  g.fillText(el.enc, X, Y + hp * 0.2);
  g.restore();
}
// Circuito del artefacto (C-1, C-2…) abajo a la derecha, pequeño y derecho (Dibujo › Circuito en las salidas)
function dsDibNum(g, el, col, s) {
  const hp = dsMm(1.8) * s;
  if (hp < 4) return;
  const b = dsBBox(el),
    [X, Y] = plAPant(b[2], b[1]);
  g.save();
  g.font = `600 ${hp / 0.72}px Arial, sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "top";
  g.fillStyle = col;
  g.fillText(el.cir, X + hp * 0.2, Y + hp * 0.1);
  g.restore();
}
// Grupos con letra de encendido
const dsConEnc = el => el.t === "sim" && DS_CAT[el.k] && ["Iluminación", "Interruptores"].includes(DS_CAT[el.k].g);
/* Salidas de circuito del tablero (ventana Tablero, doble clic): un trazo corto desde el frente del tablero (el lado
   opuesto al muro) hasta el punto de conexión, con su nombre (C-1, C-2…). Hasta 10 por fila; desde la 11, otra fila
   más adelante y corrida medio paso, para que los trazos no se crucen. En unidades del símbolo y en el dibujo. */
function dsSalidasTab(el) {
  const n = el.k === "tab" ? el.nc || 0 : 0,
    out = [];
  if (!n) return out;
  dsPrims("tab");
  const frente = DS_BB.tab[1],
    sep = 6,
    porFila = 10,
    // C-1 a la izquierda (o arriba, en un muro lateral), como se lee el plano, gire como gire el tablero
    r = ((el.r || 0) * Math.PI) / 180,
    lado = Math.cos(r) < -0.5 || (Math.abs(Math.cos(r)) <= 0.5 && Math.sin(r) > 0) ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const fila = Math.floor(i / porFila),
      enFila = Math.min(porFila, n - fila * porFila),
      a = lado * (((i % porFila) - (enFila - 1) / 2) * sep + (fila % 2 ? sep / 2 : 0)),
      b = frente - 5 - fila * 9;
    out.push({ i, n: "C-" + (i + 1), d: (el.cd || [])[i] || "", a, b0: frente, b, p: dsAMundo(el, a, b) });
  }
  return out;
}
// Dibuja las salidas del tablero y su nombre
function dsDibSalidas(g, el, col, u, lw) {
  const S = dsSalidasTab(el),
    rot = ((el.r || 0) * Math.PI) / 180,
    [X, Y] = plAPant(el.x, el.y),
    // Del símbolo (unidades, y hacia abajo) al lienzo
    aPant = (a, b) => {
      const c = Math.cos(rot),
        s = Math.sin(rot);
      return [X + u * (a * c + b * s), Y - u * (a * s - b * c)];
    },
    ht = 3 * u;
  g.strokeStyle = col;
  g.lineWidth = lw;
  S.forEach(o => {
    const co = DSU.color === "cir" && !el.col ? plColorDis(dsColCir(o.n, el.id)) : col;
    g.strokeStyle = co;
    const [x0, y0] = aPant(o.a, o.b0),
      [x1, y1] = aPant(o.a, o.b + 1),
      [xc, yc] = aPant(o.a, o.b);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.beginPath();
    g.arc(xc, yc, Math.max(1.5 * plDpr(), u), 0, 2 * Math.PI);
    g.fillStyle = PL_FONDO;
    g.fill();
    g.stroke();
    if (ht < 5) return;
    // Nombre más allá del punto, en la dirección de la salida, siempre legible
    const [xt, yt] = aPant(o.a, o.b - 2.2),
      ang = Math.atan2(yt - yc, xt - xc),
      // Legible: hacia la derecha o, si es vertical, de abajo hacia arriba
      der = Math.cos(ang) > 1e-6 || (Math.abs(Math.cos(ang)) <= 1e-6 && Math.sin(ang) < 0);
    g.save();
    g.translate(xt, yt);
    g.rotate(der ? ang : ang + Math.PI);
    g.font = `600 ${ht / 0.72}px Arial, sans-serif`;
    g.textAlign = der ? "left" : "right";
    g.textBaseline = "middle";
    g.fillStyle = co;
    g.fillText(o.n, 0, 0);
    g.restore();
  });
  // Nombre del tablero encima, centrado y derecho; debajo si sus salidas van hacia arriba
  if (el.nom && 4 * u >= 5) {
    const b = dsBBox(el),
      sal = dsAMundo(el, 0, -1),
      arriba = sal[1] - el.y > 0.5 * dsU(),
      [xn, yn] = plAPant((b[0] + b[2]) / 2, arriba ? b[1] : b[3]);
    g.save();
    g.font = `700 ${(4 * u) / 0.72}px Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = arriba ? "top" : "bottom";
    g.lineJoin = "round";
    g.lineWidth = 3 * plDpr();
    g.strokeStyle = PL_FONDO;
    const yy = yn + (arriba ? 1 : -1) * 1.5 * u;
    g.strokeText(el.nom, xn, yy);
    g.fillStyle = col;
    g.fillText(el.nom, xn, yy);
    g.restore();
  }
}
// Guiones del elemento en unidades del dibujo: la tubería por piso, discontinua; las demás, según su capa
function dsGuiones(el, cap) {
  if (el.t === "tub") return el.modo === "piso" ? [dsMm(3), dsMm(1.5)] : [];
  if (cap.lt === "trazos") return [dsMm(3), dsMm(1.5)];
  if (cap.lt === "punto") return [dsMm(5), dsMm(1), dsMm(0.5), dsMm(1)];
  return [];
}
function plRuta(g, p, cerrado) {
  for (let i = 0; i < p.length; i += 2) {
    const [X, Y] = plAPant(p[i], p[i + 1]);
    if (i) g.lineTo(X, Y);
    else g.moveTo(X, Y);
  }
  if (cerrado) g.closePath();
}
// Color de una capa del diseño, legible sobre el fondo (sin el modo atenuado, que es solo para la arquitectura)
function plColorDis(h) {
  let v = plRgb(h);
  const l = plLum(v);
  if (!PL_OSCURO && l > 0.8) v = [38, 48, 60];
  // Sobre un fondo oscuro, los colores oscuros del diseño se aclaran para leerse bien
  else if (PL_OSCURO && l < 0.55) v = v.map(x => x + (235 - x) * (l < 0.25 ? 0.6 : 0.42));
  return plHex(v);
}

/* ---------- Pinzamientos: vértices, curvatura de cada tramo, centro, radio y línea de cota ---------- */
// Posición de la letra del tipo de un símbolo (su primer texto movible, con el corrimiento dt)
function dsPosLetra(el) {
  const p = dsPrims(el.k).find(q => dsEsLetra(el.k, q));
  if (!p) return null;
  const dt = el.dt || [0, 0];
  return dsAMundo(el, p.a[0] + dt[0], p.a[1] + dt[1] - p.a[2] * 0.35);
}
// Pinzamiento de giro: por encima del símbolo (o al final del texto), a la vista
function dsPosGiro(el) {
  if (el.t === "txt") {
    const r = ((el.r || 0) * Math.PI) / 180,
      l = el.ht * 0.62 * el.s.length + dsMm(3);
    return [el.x + l * Math.cos(r), el.y + l * Math.sin(r)];
  }
  dsPrims(el.k);
  return dsAMundo(el, 0, DS_BB[el.k][1] - 7);
}
function dsAgarres(el) {
  if (dsEsTabla(el)) return [{ t: "ins", x: el.x, y: el.y }];
  if (el.t === "sim" || el.t === "txt") {
    const out = [{ t: "ins", x: el.x, y: el.y }],
      [gx, gy] = dsPosGiro(el);
    out.push({ t: "giro", x: gx, y: gy });
    const pl = el.t === "sim" && dsPosLetra(el);
    if (pl) out.push({ t: "letra", x: pl[0], y: pl[1] });
    return out;
  }
  if (el.t === "cir")
    return [
      { t: "ins", x: el.x, y: el.y },
      { t: "rad", x: el.x + el.rad, y: el.y }
    ];
  if (el.t === "cot") {
    const G = dsCotaGeo(el);
    return [
      { t: "a", x: el.a[0], y: el.a[1] },
      { t: "b", x: el.b[0], y: el.b[1] },
      { t: "o", x: (G.pa[0] + G.pb[0]) / 2, y: (G.pa[1] + G.pb[1]) / 2 }
    ];
  }
  if (el.t === "dir")
    return [
      { t: "v", i: 0, x: el.pts[0], y: el.pts[1] },
      { t: "v", i: 1, x: el.pts[2], y: el.pts[3] }
    ];
  const g = [];
  for (let i = 0; i < el.pts.length; i += 2) g.push({ t: "v", i: i / 2, x: el.pts[i], y: el.pts[i + 1] });
  dsTramos(el).forEach(t => g.push({ t: "m", i: t.i, x: t.m[0], y: t.m[1] }));
  return g;
}
// Pinzamiento de un elemento seleccionado bajo el cursor (en píxeles), o null
function dsAgarreEn(X, Y) {
  if (DS_SEL.size > 30) return null;
  const r = 7 * plDpr();
  for (const el of dsSel()) {
    if (!dsEditable(el)) continue;
    for (const a of dsAgarres(el)) {
      const [x, y] = plAPant(a.x, a.y);
      if (Math.abs(x - X) <= r && Math.abs(y - Y) <= r) return { id: el.id, ...a };
    }
  }
  return null;
}
// Arrastre de un pinzamiento hasta q (orig: el elemento antes de empezar)
function dsAgarreMover(ag, q) {
  dsAgarreMover1(ag, q);
  const el = dsD().els.find(e => e.id === ag.id);
  // Un artefacto que se mueve o gira arrastra las puntas de sus tuberías
  if (el && el.t === "sim") dsReconectar();
}
function dsAgarreMover1(ag, q) {
  dsIdxSucio();
  const el = dsD().els.find(e => e.id === ag.id);
  if (!el) return;
  const o = JSON.parse(ag.orig);
  if (ag.t === "ins") {
    const dx = q[0] - ag.x,
      dy = q[1] - ag.y;
    if (o.pts) el.pts = o.pts.map((v, i) => v + (i % 2 ? dy : dx));
    else if (o.a) {
      el.a = [o.a[0] + dx, o.a[1] + dy];
      el.b = [o.b[0] + dx, o.b[1] + dy];
    } else {
      el.x = o.x + dx;
      el.y = o.y + dy;
    }
  } else if (ag.t === "giro") {
    // El pinzamiento está arriba del símbolo (a 90° de su eje) o al final del texto (sobre su eje)
    let a = (Math.atan2(q[1] - el.y, q[0] - el.x) * 180) / Math.PI - (el.t === "sim" ? 90 : 0);
    const paso = PLH.libre ? (DSU.giro ? 0 : 15) : DSU.giro;
    if (paso) a = Math.round(a / paso) * paso;
    el.r = Math.round((((a % 360) + 360) % 360) * 100) / 100;
  } else if (ag.t === "letra") {
    // Corrimiento de la letra en unidades del símbolo: el punto q llevado a las coordenadas del símbolo
    const p = dsPrims(el.k).find(x => dsEsLetra(el.k, x)),
      u = dsUk(el.k),
      r = ((el.r || 0) * Math.PI) / 180,
      wx = (q[0] - el.x) / u,
      wy = (q[1] - el.y) / u,
      a = wx * Math.cos(r) + wy * Math.sin(r),
      b = wx * Math.sin(r) - wy * Math.cos(r);
    el.dt = [+(a - p.a[0]).toFixed(2), +(b - (p.a[1] - p.a[2] * 0.35)).toFixed(2)];
  } else if (ag.t === "v") {
    el.pts[2 * ag.i] = q[0];
    el.pts[2 * ag.i + 1] = q[1];
  } else if (ag.t === "m") {
    const t = dsTramos(o)[ag.i],
      b = (el.b || []).slice();
    while (b.length < dsTramos(el).length) b.push(0);
    b[ag.i] = dsCurvDe(t.a, t.b, q);
    el.b = b;
  } else if (ag.t === "rad") el.rad = Math.max(1e-6, Math.hypot(q[0] - el.x, q[1] - el.y));
  else if (ag.t === "a" || ag.t === "b") el[ag.t] = [q[0], q[1]];
  else if (ag.t === "o") el.o = dsCotaO(el, q);
  plDibujar();
}

/* ---------- Encaje en el muro: los símbolos de pared se apoyan en la línea más cercana y giran con ella ---------- */
function dsAlinear(k, q) {
  const c = DS_CAT[k];
  if (!c || !c.m || !DSU.alinear) return null;
  const s = plSegCercano(q[0], q[1], (26 * plDpr()) / PLV.s, true);
  if (!s) return null;
  let vx = s.p[0] - q[0],
    vy = s.p[1] - q[1],
    d = Math.hypot(vx, vy);
  // Con el cursor justo sobre la línea, el símbolo queda a su izquierda
  if (d < 1e-9) {
    const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1;
    vx = -(s.b[1] - s.a[1]) / L;
    vy = (s.b[0] - s.a[0]) / L;
    d = 1;
  }
  // n: del símbolo hacia el muro; el lado del símbolo que se apoya mira en esa dirección
  dsPrims(k);
  const nx = vx / d,
    ny = vy / d,
    b = DS_BB[k],
    u = dsUk(k),
    // Lado del símbolo que mira al muro: izquierdo, de abajo o de arriba (unidades del símbolo, y hacia abajo)
    th = c.m === "izq" ? Math.atan2(-ny, -nx) : c.m === "arriba" ? Math.atan2(-nx, ny) : Math.atan2(nx, -ny),
    ext = c.m === "izq" ? -b[0] : c.m === "arriba" ? -b[1] : b[3],
    r = Math.round((((((th * 180) / Math.PI) % 360) + 360) % 360) * 100) / 100;
  return { x: s.p[0] - nx * ext * u, y: s.p[1] - ny * ext * u, r, seg: s };
}

/* ---------- Lienzo superior: selección, pinzamientos, fantasma del símbolo, trazo en curso y marco ---------- */
function dsSobre(g) {
  const D = dsD();
  if (!D) return;
  const d = plDpr(),
    selc = PL_OSCURO ? "#5fb0ff" : "#1f6fd6",
    caliente = "#e5484d";
  D.els.forEach(el => {
    if (!DS_SEL.has(el.id) && el.id !== PLH.dsSobre) return;
    // Resaltado suave: el contorno del propio elemento, como un halo, sin rectángulos (más tenue bajo el cursor)
    const sel = DS_SEL.has(el.id);
    g.globalAlpha = sel ? 0.32 : 0.18;
    if (el.t === "sim") {
      const [X, Y] = plAPant(el.x, el.y);
      dsDibSim(g, el.k, X, Y, ((el.r || 0) * Math.PI) / 180, dsUk(el.k) * PLV.s, selc, null, 5 * d, el.dt);
    } else if (el.t === "txt") {
      const b = dsBBox(el),
        [a, c] = plAPant(b[0], b[3]),
        [e, f] = plAPant(b[2], b[1]);
      g.fillStyle = selc;
      g.fillRect(a - 2 * d, c - 2 * d, e - a + 4 * d, f - c + 4 * d);
    } else {
      g.strokeStyle = selc;
      g.lineWidth = 6 * d;
      g.lineCap = g.lineJoin = "round";
      g.beginPath();
      dsLineas(el).forEach(p => plRuta(g, p, false));
      g.stroke();
    }
    g.globalAlpha = 1;
    if (!sel || DS_SEL.size > 30) return;
    // Pinzamientos: cuadrados en vértices e inserción; rombos en el medio de los tramos (curvan) y en la cota
    g.strokeStyle = PL_OSCURO ? "#111922" : "#fff";
    g.lineWidth = 1.2 * d;
    dsAgarres(el).forEach(a => {
      const [X, Y] = plAPant(a.x, a.y),
        cal = PLH.agSobre && PLH.agSobre.id === el.id && PLH.agSobre.t === a.t && PLH.agSobre.i === a.i;
      g.fillStyle = cal ? caliente : selc;
      // Giro: círculo unido al punto de inserción; letra: cuadrado hueco
      if (a.t === "giro") {
        const [Xi, Yi] = plAPant(el.x, el.y);
        g.save();
        g.strokeStyle = selc;
        g.globalAlpha = 0.5;
        g.setLineDash([3 * d, 2 * d]);
        g.beginPath();
        g.moveTo(Xi, Yi);
        g.lineTo(X, Y);
        g.stroke();
        g.restore();
        g.beginPath();
        g.arc(X, Y, 5 * d, 0, 2 * Math.PI);
        g.fill();
        g.stroke();
        return;
      }
      if (a.t === "letra") {
        g.save();
        g.strokeStyle = cal ? caliente : selc;
        g.lineWidth = 1.6 * d;
        g.strokeRect(X - 4 * d, Y - 4 * d, 8 * d, 8 * d);
        g.restore();
        return;
      }
      g.beginPath();
      if (a.t === "m" || a.t === "o") {
        const r = 5 * d;
        g.moveTo(X, Y - r);
        g.lineTo(X + r, Y);
        g.lineTo(X, Y + r);
        g.lineTo(X - r, Y);
        g.closePath();
      } else g.rect(X - 4 * d, Y - 4 * d, 8 * d, 8 * d);
      g.fill();
      g.stroke();
    });
  });
  const q = plPuntoActual();
  // Símbolo que se va a colocar, siguiendo al cursor (encajado en el muro si corresponde)
  if (PLH.h && PLH.h.startsWith("col:") && q) {
    const k = PLH.h.slice(4),
      al = PLH.alin,
      [X, Y] = plAPant(al ? al.x : q[0], al ? al.y : q[1]);
    if (al) {
      const s = al.seg,
        [a, b] = plAPant(s.a[0], s.a[1]),
        [c, e] = plAPant(s.b[0], s.b[1]);
      g.strokeStyle = PL_OSCURO ? "#7ee08a" : "#1f8a3a";
      g.lineWidth = 3 * d;
      g.globalAlpha = 0.45;
      g.beginPath();
      g.moveTo(a, b);
      g.lineTo(c, e);
      g.stroke();
      g.globalAlpha = 1;
    }
    g.globalAlpha = 0.65;
    dsDibSim(
      g,
      k,
      X,
      Y,
      (((al ? al.r : PLH.rot) || 0) * Math.PI) / 180,
      dsUk(k) * PLV.s,
      plColorDis(dsColorEl({ t: "sim", k }, dsCapa(DS_SIS[DS_CAT[k].s].capa))),
      PL_FONDO
    );
    g.globalAlpha = 1;
  }
  // Trazo en curso
  const h = PLH.h;
  if (DS_HERR[h] && PLH.pts.length && q) {
    let pts = PLH.pts;
    const ini = dsEsTub(h) && PLH.conIni && dsD().els.find(e => e.id === PLH.conIni);
    if (ini && ini.k !== "tab") {
      const sg = pts[1] || q;
      pts = [dsBorde(ini, sg[0], sg[1]), ...pts.slice(1)];
    }
    const capa = dsCapaPara(h),
      col = plColorDis(dsCapa(capa).col);
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = dsGrosor(dsCapa(capa));
    g.setLineDash(h === "tubP" ? [dsMm(3) * PLV.s, dsMm(1.5) * PLV.s] : []);
    g.beginPath();
    if (h === "rect") {
      const [a, b] = plAPant(pts[0][0], pts[0][1]),
        [c, e] = plAPant(q[0], q[1]);
      g.rect(a, b, c - a, e - b);
      g.stroke();
    } else if (h === "cir") {
      const [X, Y] = plAPant(pts[0][0], pts[0][1]);
      g.arc(X, Y, Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) * PLV.s, 0, 2 * Math.PI);
      g.stroke();
    } else if (h === "cotA" || h === "cotL") {
      g.setLineDash([]);
      const el = dsCotaNueva(q);
      if (el) dsDibCota(g, el, col, PLV.s);
      else {
        plRuta(g, [...pts[0], ...q], false);
        g.stroke();
      }
    } else if (h === "dir") {
      dsDibDir(g, { pts: [...pts[0], ...q], s: "…", ht: dsMm(2.5) }, col, PLV.s);
    } else {
      const el = { pts: [...pts.flat(), ...q], b: [...(PLH.bul || []), dsEsTub(h) ? dsBulNuevo() : 0] };
      plRuta(g, dsCurva(el), false);
      g.stroke();
    }
    g.setLineDash([]);
    // Longitud del tramo en curso (la del arco, si es curvo)
    if (h !== "cotA" && h !== "cotL" && h !== "dir") {
      const u = pts[pts.length - 1],
        t = dsTramos({ pts: [...u, ...q], b: [dsEsTub(h) ? dsBulNuevo() : 0] })[0],
        L = h === "cir" ? Math.hypot(q[0] - u[0], q[1] - u[1]) : t ? t.L : 0,
        m = t ? t.m : q,
        [X, Y] = plAPant(m[0], m[1]);
      g.font = `600 ${11.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
      plEtiqueta(g, (h === "cir" ? "R " : "") + plFm(L) + " m", X, Y - 8 * d, col, "center", "bottom");
    }
  }
  // Copiar en fila o espejo: fantasma de las copias y la línea de los dos puntos
  if ((h === "fila" || h === "espejo") && PLH.copia && PLH.pts.length && q) {
    const a = PLH.pts[0],
      lista = dsD().els.filter(el => PLH.copia.ids.includes(el.id)),
      gv = PL_OSCURO ? "#8fc1f0" : "#1f6fd6",
      [Xa, Ya] = plAPant(a[0], a[1]),
      [Xq, Yq] = plAPant(q[0], q[1]);
    g.save();
    g.strokeStyle = gv;
    g.lineWidth = 1 * d;
    g.setLineDash([6 * d, 4 * d]);
    g.beginPath();
    if (h === "espejo") {
      const L = Math.hypot(Xq - Xa, Yq - Ya) || 1,
        ex = ((Xq - Xa) / L) * 4000 * d,
        ey = ((Yq - Ya) / L) * 4000 * d;
      g.moveTo(Xa - ex, Ya - ey);
      g.lineTo(Xa + ex, Ya + ey);
    } else {
      g.moveTo(Xa, Ya);
      g.lineTo(Xq, Yq);
    }
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 0.45;
    const dx = q[0] - a[0],
      dy = q[1] - a[1],
      L = Math.hypot(dx, dy);
    if (L > 1e-9)
      lista.forEach(el => {
        if (h === "fila")
          for (let k = 1; k <= Math.min(PLH.copia.n, 60); k++)
            dsFantasma(g, el, o => dsTrasladar(o, dx * k, dy * k), gv);
        else dsFantasma(g, el, o => dsReflejar(o, a, dx / L, dy / L), gv);
      });
    g.restore();
  }
  // Leyenda que se va a colocar
  if ((h === "ley" || h === "cua") && q) {
    g.save();
    g.globalAlpha = 0.5;
    (h === "ley" ? dsDibLeyenda : dsDibCuadro)(
      g,
      { t: h, x: q[0], y: q[1] },
      PL_OSCURO ? "#8fc1f0" : "#1f6fd6",
      PLV.s,
      plDpr()
    );
    g.restore();
  }
  // Bloque que se va a colocar y comparación con una versión
  dpSobre(g, q, d);
  // Datos del elemento bajo el cursor (en Seleccionar, sin arrastrar)
  if (DSU.info !== false && !h && PLH.dsSobre && !PLH.arr && !PLH.agarre && !PLH.marco && PLH.cur) {
    const el = dsD().els.find(e => e.id === PLH.dsSobre),
      t = el && dsInfoEl(el);
    if (t) {
      const [X, Y] = plAPant(PLH.cur[0], PLH.cur[1]);
      g.save();
      g.globalAlpha = 0.88;
      g.font = `500 ${10.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
      plEtiqueta(g, t, X + 14 * d, Y + 14 * d, PL_OSCURO ? "#9fb4c8" : "#14304f", "left", "top");
      g.restore();
    }
  }
  // Rastreo polar: transportador en el punto anterior, la guía en la dirección exacta y el imán en el cursor
  if (PLH.polar && q) {
    const { u, ang } = PLH.polar,
      [X0, Y0] = plAPant(u[0], u[1]),
      [Xq, Yq] = plAPant(q[0], q[1]),
      L = 4000 * d,
      gv = PL_OSCURO ? "#7ee08a" : "#1f8a3a",
      deg = Math.round(((((ang * 180) / Math.PI) % 360) + 360) % 360);
    dsTransportador(g, X0, Y0, ang, DSU.polarInc, gv, d);
    g.save();
    g.strokeStyle = gv;
    // Guía: firme hasta el cursor, a trazos más allá
    g.globalAlpha = 0.85;
    g.lineWidth = 1.2 * d;
    g.beginPath();
    g.moveTo(X0, Y0);
    g.lineTo(Xq, Yq);
    g.stroke();
    g.globalAlpha = 0.45;
    g.lineWidth = 1 * d;
    g.setLineDash([6 * d, 4 * d]);
    g.beginPath();
    g.moveTo(Xq, Yq);
    g.lineTo(X0 + L * Math.cos(ang), Y0 - L * Math.sin(ang));
    g.stroke();
    g.setLineDash([]);
    // Imán: rombo en el punto que toma el cursor
    g.globalAlpha = 0.9;
    g.lineWidth = 1.5 * d;
    const r = 5 * d;
    g.beginPath();
    g.moveTo(Xq, Yq - r);
    g.lineTo(Xq + r, Yq);
    g.lineTo(Xq, Yq + r);
    g.lineTo(Xq - r, Yq);
    g.closePath();
    g.stroke();
    g.restore();
    g.save();
    g.globalAlpha = 0.75;
    g.font = `600 ${10.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
    plEtiqueta(
      g,
      `${deg}° · ${plFm(Math.hypot(q[0] - u[0], q[1] - u[1]))} m`,
      Xq + 12 * d,
      Yq + 10 * d,
      gv,
      "left",
      "top"
    );
    g.restore();
  }
  // Girar un símbolo con su pinzamiento: transportador alrededor del símbolo con el ángulo exacto
  const ag = PLH.agarre;
  if (ag && ag.t === "giro" && ag.mov) {
    const el = dsD().els.find(e => e.id === ag.id);
    if (el) {
      const [X, Y] = plAPant(el.x, el.y),
        paso = PLH.libre ? (DSU.giro ? 0 : 15) : DSU.giro,
        // El ángulo del símbolo (el mismo de la etiqueta)
        a = ((el.r || 0) * Math.PI) / 180,
        gv = PL_OSCURO ? "#7ee08a" : "#1f8a3a";
      // Transportador grande (más que el símbolo), referencia en 0° y la línea del ángulo exacto
      const Rg = Math.max(70, (dsUk(el.k) * PLV.s * 22) / d),
        L = (Rg + 40) * d;
      dsTransportador(g, X, Y, a, paso || 15, gv, d, !paso, Rg);
      g.save();
      g.strokeStyle = gv;
      g.fillStyle = gv;
      g.globalAlpha = 0.5;
      g.lineWidth = 1 * d;
      g.setLineDash([5 * d, 4 * d]);
      g.beginPath();
      g.moveTo(X, Y);
      g.lineTo(X + L, Y);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 0.95;
      g.lineWidth = 2 * d;
      g.beginPath();
      g.moveTo(X, Y);
      g.lineTo(X + L * Math.cos(a), Y - L * Math.sin(a));
      g.stroke();
      g.beginPath();
      g.arc(X + L * Math.cos(a), Y - L * Math.sin(a), 3.5 * d, 0, 2 * Math.PI);
      g.fill();
      g.restore();
      g.save();
      g.globalAlpha = 0.85;
      g.font = `600 ${10.5 * d}px "IBM Plex Sans", Arial, sans-serif`;
      plEtiqueta(
        g,
        `${+(el.r || 0).toFixed(1)}°${paso ? ` · de ${paso}° en ${paso}°` : " · libre"}`,
        X + (L + 8 * d) * Math.cos(a),
        Y - (L + 8 * d) * Math.sin(a),
        gv,
        Math.cos(a) < -0.3 ? "right" : "left",
        "bottom"
      );
      g.restore();
    }
  }
  // Marco de selección: de izquierda a derecha, ventana (lo que queda dentro); al revés, captura (lo que toca)
  const mc = PLH.marco;
  if (mc && mc.mov) {
    const cap = mc.X1 < mc.X0;
    g.fillStyle = cap ? "rgba(46,160,67,.10)" : "rgba(31,111,214,.10)";
    g.strokeStyle = cap ? "#2ea043" : selc;
    g.lineWidth = 1 * d;
    g.setLineDash(cap ? [5 * d, 3 * d] : []);
    g.fillRect(mc.X0, mc.Y0, mc.X1 - mc.X0, mc.Y1 - mc.Y0);
    g.strokeRect(mc.X0, mc.Y0, mc.X1 - mc.X0, mc.Y1 - mc.Y0);
    g.setLineDash([]);
  }
}
// Curvatura del tramo nuevo de una tubería: la del trazo elegido (curvo o recto) y del lado elegido (F invierte)
const dsBulNuevo = () => (DSU.curva ? DS_BUL * (PLH.lado || 1) : 0);
// Capa a la que va lo que se dibuja con cada herramienta: tuberías, cotas, textos y directrices a la suya; las
// líneas, rectángulos y círculos a la capa actual
const dsCapaPara = h =>
  h === "tubT"
    ? DS_SIS.tubT.capa
    : h === "tubP"
      ? DS_SIS.tubP.capa
      : h === "cotA" || h === "cotL"
        ? DS_SIS.cot.capa
        : h === "txt"
          ? DS_SIS.txt.capa
          : h === "dir"
            ? DS_SIS.cto.capa
            : dsD().actual;
// Cota en curso con los dos puntos tomados y el cursor como posición de la línea de cota
function dsCotaNueva(q) {
  if (PLH.pts.length < 2) return null;
  const [a, b] = PLH.pts,
    el = { a, b, modo: PLH.h === "cotL" ? dsModoLineal(a, b, q) : "alin", o: 0 };
  el.o = dsCotaO(el, q);
  return el;
}

/* ---------- Herramientas: colocar símbolos y dibujar ---------- */
const dsEsHerr = h => !!h && (h.startsWith("col:") || !!DS_HERR[h] || h === "fila" || h === "espejo" || h === "blq");
function dsOrden(h, n) {
  const libre = ` · <span class="pl-k">Mayús</span> sin enganche`;
  if (h === "fila")
    return `<b>Copiar en fila</b> (${PLH.copia ? PLH.copia.n : 0} copias) · ${n ? "Punto de la primera copia: la separación (escriba la distancia o haga clic)" : "Punto base"}${libre} · <span class="pl-k">Esc</span> salir`;
  if (h === "blq")
    return `<b>Bloque «${esc(PLH.blq ? PLH.blq.n : "")}»</b> · clic para colocarlo (su centro va en el cursor) · puede colocar varios${libre} · <span class="pl-k">Esc</span> terminar`;
  if (h === "espejo")
    return `<b>Espejo</b> · ${n ? "Segundo punto de la línea de reflexión" : "Primer punto de la línea de reflexión"}${libre} · <span class="pl-k">Esc</span> salir`;
  if (h.startsWith("col:")) {
    const c = DS_CAT[h.slice(4)];
    return `<b>${c.n}</b> <span class="pl-cod">DGE ${c.c}</span> · clic para colocar${c.m && DSU.alinear ? " (se encaja en el muro)" : ""} · <span class="pl-k">R</span> girar${libre} · <span class="pl-k">Esc</span> terminar`;
  }
  const sig = "Siguiente punto · escriba una longitud o haga clic · <b>Intro</b> o doble clic para terminar";
  const T = {
    lin: n ? "Punto final · escriba la longitud o haga clic" : "Primer punto",
    pol: n ? sig : "Primer punto",
    rect: n ? "Esquina opuesta" : "Una esquina",
    cir: n ? "Un punto del borde (radio)" : "Centro",
    txt: "Dónde va el texto",
    tubT: n
      ? `${sig} · <span class="pl-k">F</span> invierte la curva · <span class="pl-k">C</span> ${DSU.curva ? "tramo recto" : "tramo curvo"}`
      : "Inicio de la tubería (por ejemplo, el tablero)",
    tubP: n
      ? `${sig} · <span class="pl-k">F</span> invierte la curva · <span class="pl-k">C</span> ${DSU.curva ? "tramo recto" : "tramo curvo"}`
      : "Inicio de la tubería (por ejemplo, el tablero)",
    cotA: n === 0 ? "Primer punto que se mide" : n === 1 ? "Segundo punto" : "Posición de la línea de cota",
    cotL:
      n === 0
        ? "Primer punto que se mide"
        : n === 1
          ? "Segundo punto"
          : "Posición de la línea de cota (arriba o abajo: horizontal; a un lado: vertical)",
    dir: n ? "Dónde va el texto" : "Punta de la flecha",
    ley: "Esquina superior izquierda de la leyenda",
    cua: "Esquina superior izquierda del cuadro de circuitos"
  };
  return `<b>${DS_HERR[h]}</b> · ${T[h]}${libre} · <span class="pl-k">Esc</span> salir`;
}
function dsAgregar(el) {
  el.id = dsId();
  dsD().els.push(el);
  return el;
}
function dsPunto(p) {
  const h = PLH.h;
  if (h === "fila" || h === "espejo") return dsPuntoCopia(p);
  if (h === "blq") return dpColocarBloque(p);
  if (h === "ley" || h === "cua") {
    if (h === "cua" && !dsD().els.some(e => e.k === "tab" && e.nc)) {
      plHerr(null);
      return toast("Primero coloque un tablero y defina sus circuitos (doble clic en el tablero)");
    }
    dsCapa(DS_SIS.txt.capa);
    DS_SEL.clear();
    DS_SEL.add(
      dsAgregar({ t: h, x: p[0], y: p[1], tit: h === "ley" ? "LEYENDA" : "CUADRO DE CIRCUITOS", capa: DS_SIS.txt.capa })
        .id
    );
    edCambio();
    return plHerr(null);
  }
  if (h.startsWith("col:")) {
    const k = h.slice(4),
      c = DS_CAT[k],
      al = PLH.alin;
    dsCapa(DS_SIS[c.s].capa);
    const el = dsAgregar({
      t: "sim",
      k,
      x: al ? al.x : p[0],
      y: al ? al.y : p[1],
      r: al ? al.r : PLH.rot,
      capa: DS_SIS[c.s].capa
    });
    if (k === "tab") {
      // TG el primero; TD-1, TD-2… los siguientes
      const n = dsD().els.filter(e => e.k === "tab").length;
      el.nom = n === 1 ? "TG" : "TD-" + (n - 1);
      toast(`Tablero ${el.nom}: doble clic en él para darle sus circuitos (C-1, C-2…)`);
    }
    DS_SEL.clear();
    DS_SEL.add(el.id);
    edCambio();
    return;
  }
  if (h === "txt") {
    PLH.pts = [p];
    plPedir("Texto", "", v => {
      if (!v) return toast("Escriba el texto");
      dsCapa(DS_SIS.txt.capa);
      dsAgregar({
        t: "txt",
        x: p[0],
        y: p[1],
        s: v.replace(/[<>]/g, "").slice(0, 200),
        ht: dsMm(2.5),
        r: 0,
        capa: DS_SIS.txt.capa
      });
      PLH.pts = [];
      plPedir(null);
      edCambio();
      plOrden();
    });
    return;
  }
  if (dsEsTub(h)) return dsPuntoTub(p);
  PLH.pts.push(p);
  const n = PLH.pts.length,
    capa = dsCapaPara(h);
  if (dsEsTub(h) && n > 1) (PLH.bul = PLH.bul || []).push(dsBulNuevo());
  if (dsEsTub(h) && PLH.eng && PLH.eng[2] === 8 && (n === 1 || !PLH.cirIni)) {
    PLH.cirIni = PLH.eng[3];
    toast(`Tubería del circuito ${PLH.cirIni.cir}${PLH.cirIni.nom ? " del tablero " + PLH.cirIni.nom : ""}`);
  }
  if ((h === "lin" || h === "rect" || h === "cir") && n === 2) {
    const [a, b] = PLH.pts;
    PLH.pts = [];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) * PLV.s < 2) return plOrden();
    dsCapa(capa);
    if (h === "lin") dsAgregar({ t: "lin", pts: [a[0], a[1], b[0], b[1]], c: false, capa });
    else if (h === "rect")
      dsAgregar({ t: "lin", pts: [a[0], a[1], b[0], a[1], b[0], b[1], a[0], b[1]], c: true, capa });
    else dsAgregar({ t: "cir", x: a[0], y: a[1], rad: Math.hypot(b[0] - a[0], b[1] - a[1]), capa });
    edCambio();
  } else if ((h === "cotA" || h === "cotL") && n === 3) {
    const el = dsCotaNueva(p);
    PLH.pts = [];
    if (el.a[0] === el.b[0] && el.a[1] === el.b[1]) return plOrden();
    dsCapa(capa);
    dsAgregar({ t: "cot", ...el, capa });
    edCambio();
  } else if (h === "dir" && n === 2) {
    const [a, b] = PLH.pts;
    plPedir("Texto de la directriz", "", v => {
      if (!v) return toast("Escriba el texto");
      dsCapa(capa);
      dsAgregar({
        t: "dir",
        pts: [a[0], a[1], b[0], b[1]],
        s: v.replace(/[<>]/g, "").slice(0, 120),
        ht: dsMm(2.5),
        capa
      });
      PLH.pts = [];
      plPedir(null);
      edCambio();
      plOrden();
    });
    return;
  }
  plOrden();
  plSobreDibujar();
}
// Punto de una tubería: si empieza en un artefacto queda conectada a él; si llega a otro, esa tubería termina en
// su borde y empieza otra desde él (con el mismo circuito), como se cablea de una salida a la siguiente
function dsPuntoTub(p, engX) {
  const eng = engX || PLH.eng;
  // Clic sobre el tablero: se elige la salida en un menú y la tubería empieza o termina en ella
  if (eng && eng[2] === 10) {
    const tb = dsD().els.find(e => e.id === eng[3].tabla);
    return (
      tb &&
      dsElegirSalida(tb, p, o => {
        dsPuntoTub(o.p, [o.p[0], o.p[1], 8, { cir: o.n, tab: tb.id, nom: tb.nom || "" }]);
        plSobreDibujar();
      })
    );
  }
  const con = eng && eng[2] === 9 ? eng[3].con : null,
    D = dsD();
  if (!PLH.pts.length) {
    PLH.pts.push(p);
    PLH.conIni = con;
    if (eng && eng[2] === 8) {
      PLH.cirIni = eng[3];
      PLH.conIni = eng[3].tab;
    } else if (con) {
      // Empieza en un artefacto que ya tiene circuito: la tubería lo toma
      const s = D.els.find(e => e.id === con),
        tb = s && s.tab && D.els.find(e => e.id === s.tab);
      if (s && s.cir) PLH.cirIni = { cir: s.cir, tab: s.tab || "", nom: tb ? tb.nom || "" : "" };
    }
    if (PLH.cirIni)
      toast(`Tubería del circuito ${PLH.cirIni.cir}${PLH.cirIni.nom ? " del tablero " + PLH.cirIni.nom : ""}`);
    plOrden();
    return plSobreDibujar();
  }
  // Un clic en el mismo artefacto del inicio no hace un tramo
  if (con && con === PLH.conIni && PLH.pts.length === 1) return;
  // El inicio en un artefacto: a su borde, hacia este punto
  if (PLH.pts.length === 1 && PLH.conIni) {
    const s = D.els.find(e => e.id === PLH.conIni);
    if (s && s.k !== "tab") PLH.pts[0] = dsBorde(s, p[0], p[1]);
  }
  PLH.pts.push(p);
  (PLH.bul = PLH.bul || []).push(dsBulNuevo());
  // Llega a una salida del tablero: la tubería termina allí y queda saliendo del tablero (se invierte)
  if (eng && eng[2] === 8 && PLH.conIni !== eng[3].tab) {
    PLH.cirIni = eng[3];
    const t = dsTerminar(null, eng[3].tab);
    if (t) toast(`Tubería conectada a la salida ${t.cir}${eng[3].nom ? " del tablero " + eng[3].nom : ""}`);
    return plOrden();
  }
  if (con) {
    const t = dsTerminar(con),
      s = D.els.find(e => e.id === con);
    if (t && s) {
      // Sigue desde el artefacto, con el mismo circuito
      PLH.pts = [dsCentroCon(s)];
      PLH.conIni = con;
      PLH.cirIni = t.cir ? { cir: t.cir, tab: t.tab || "", nom: "" } : null;
      toast(`Conectada a ${DS_CAT[s.k].n.toLowerCase()} · siga a la próxima salida o Esc para terminar`);
    }
  }
  plOrden();
  plSobreDibujar();
}
// Menú con las salidas del tablero, junto al punto p (cada una con su descripción y si ya tiene tubería)
function dsElegirSalida(tb, p, fn) {
  const S = dsSalidasTab(tb);
  if (!S.length) {
    toast(`${tb.nom || "El tablero"} aún no tiene circuitos: defínalos en su ventana`);
    return tabAbrir(tb.id);
  }
  const usada = new Set(
    dsD()
      .els.filter(e => e.t === "tub" && e.c0 === tb.id)
      .map(e => e.cir)
  );
  edMenuLista(
    p,
    `<div class="ed-mt">Salidas de ${esc(tb.nom || "tablero")}</div>` +
      S.map(
        o =>
          `<button type="button" data-edm="sal:${o.i}" role="menuitem"><span><b style="color:${plColorDis(dsColCir(o.n, tb.id))}">${o.n}</b>${o.d ? " · " + esc(o.d) : ""}</span>${usada.has(o.n) ? "<kbd>en uso</kbd>" : ""}</button>`
      ).join("") +
      `<hr><button type="button" data-edm="tablero:${tb.id}" role="menuitem"><span>Circuitos del tablero…</span></button>`,
    i => fn(S[i])
  );
}
/* ---------- Copiar en fila y espejo ---------- */
// Copia los elementos con una transformación; las conexiones entre los copiados se conservan, las demás se quitan
function dsClonar(lista, tr) {
  const nuevo = new Map(),
    out = [];
  lista.forEach(o => {
    const el = JSON.parse(JSON.stringify(o));
    tr(el);
    dsAgregar(el);
    nuevo.set(o.id, el.id);
    out.push(el);
  });
  out.forEach(t =>
    ["c0", "c1"].forEach(c => {
      if (t[c] && nuevo.has(t[c])) t[c] = nuevo.get(t[c]);
      else delete t[c];
    })
  );
  return out;
}
// Refleja un elemento respecto de la línea por a con dirección unitaria (ux, uy)
function dsReflejar(el, a, ux, uy) {
  const R = (x, y) => {
      const dx = x - a[0],
        dy = y - a[1],
        k = dx * ux + dy * uy;
      return [a[0] + 2 * k * ux - dx, a[1] + 2 * k * uy - dy];
    },
    th = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (el.pts) {
    const q = [];
    for (let i = 0; i < el.pts.length; i += 2) q.push(...R(el.pts[i], el.pts[i + 1]));
    el.pts = q;
    if (el.b) el.b = el.b.map(k => -k);
  } else if (el.a) {
    el.a = R(...el.a);
    el.b = R(...el.b);
    el.o = -el.o;
    if (Math.abs(Math.sin((th * Math.PI) / 90)) > 1e-6) el.modo = "alin";
  } else {
    [el.x, el.y] = R(el.x, el.y);
    if (el.t === "sim" || el.t === "txt") el.r = Math.round(((((2 * th - (el.r || 0)) % 360) + 360) % 360) * 100) / 100;
    delete el.dt;
  }
}
// Inicia Copiar en fila (pide el número de copias) o Espejo, con lo seleccionado
function dsIniciarCopia(h) {
  const sel = dsSel().filter(dsEditable);
  if (!sel.length) return toast("Elija primero lo que quiere copiar");
  const ids = sel.map(el => el.id);
  if (h === "espejo") {
    plHerr("espejo");
    PLH.copia = { ids };
    return plOrden();
  }
  plPedir("Número de copias", "3", v => {
    const n = Math.round(parseFloat(v));
    plPedir(null);
    if (!(n >= 1 && n <= 200)) return toast("Escriba un número de copias entre 1 y 200");
    plHerr("fila");
    PLH.copia = { ids, n };
    plOrden();
  });
}
function dsPuntoCopia(p) {
  const h = PLH.h;
  PLH.pts.push(p);
  if (PLH.pts.length < 2) return plOrden();
  const [a, b] = PLH.pts,
    c = PLH.copia,
    lista = c ? dsD().els.filter(el => c.ids.includes(el.id)) : [];
  if (!lista.length || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9) {
    PLH.pts = [];
    return plOrden();
  }
  let nuevos = [];
  if (h === "fila") {
    for (let k = 1; k <= c.n; k++)
      nuevos = nuevos.concat(dsClonar(lista, el => dsTrasladar(el, (b[0] - a[0]) * k, (b[1] - a[1]) * k)));
    toast(`${c.n} copia${c.n > 1 ? "s" : ""} en fila, a ${plFm(Math.hypot(b[0] - a[0], b[1] - a[1]))} m`);
  } else {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    nuevos = dsClonar(lista, el => dsReflejar(el, a, (b[0] - a[0]) / L, (b[1] - a[1]) / L));
    toast("Copia en espejo creada · si solo quería reflejar, presione Supr: borra los originales, que siguen elegidos");
  }
  PLH.copia = null;
  plHerr(null);
  DS_SEL.clear();
  (h === "fila" ? nuevos : lista).forEach(el => DS_SEL.add(el.id));
  if (!nuevos.length) return;
  edCambio();
  edProps();
}
// Fantasma de lo que se va a copiar: el elemento transformado, tenue
function dsFantasma(g, el, tr, col) {
  const o = JSON.parse(JSON.stringify(el));
  tr(o);
  if (o.t === "sim")
    dsDibSim(g, o.k, ...plAPant(o.x, o.y), ((o.r || 0) * Math.PI) / 180, dsUk(o.k) * PLV.s, col, null, plDpr());
  else if (o.t === "txt" || dsEsTabla(o)) {
    const b = dsBBox(o),
      [x0, y0] = plAPant(b[0], b[3]),
      [x1, y1] = plAPant(b[2], b[1]);
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  } else {
    g.beginPath();
    dsLineas(o).forEach(p => plRuta(g, p, false));
    g.stroke();
  }
}
// Termina la polilínea o la tubería en curso (Intro, doble clic o Esc); conFin: artefacto al que llega
function dsTerminar(conFin, tabFin) {
  const h = PLH.h;
  if (!(h === "pol" || dsEsTub(h)) || PLH.pts.length < 2) {
    if (h === "pol" || dsEsTub(h)) {
      // Una tubería que solo tenía su inicio en un artefacto: se descarta y se sigue en la herramienta
      const habia = dsEsTub(h) && PLH.pts.length === 1 && PLH.conIni;
      PLH.pts = [];
      PLH.bul = [];
      PLH.cirIni = null;
      PLH.conIni = null;
      if (habia) {
        plOrden();
        plSobreDibujar();
        return true;
      }
    }
    return false;
  }
  const capa = dsCapaPara(h);
  dsCapa(capa);
  const el = { t: h === "pol" ? "lin" : "tub", pts: PLH.pts.flat(), c: false, capa };
  if (dsEsTub(h)) {
    el.modo = h === "tubP" ? "piso" : "techo";
    if ((PLH.bul || []).some(Boolean)) el.b = PLH.bul.slice(0, PLH.pts.length - 1);
    if (PLH.cirIni) {
      el.cir = PLH.cirIni.cir;
      if (PLH.cirIni.tab) el.tab = PLH.cirIni.tab;
    }
    if (PLH.conIni) el.c0 = PLH.conIni;
    if (conFin && conFin !== PLH.conIni) el.c1 = conFin;
    // Llega al tablero: se invierte para que salga de él
    if (tabFin) {
      el.c1 = tabFin;
      dsInvertirTub(el);
    }
  }
  dsAgregar(el);
  if (el.t === "tub") dsHeredar(el);
  PLH.pts = [];
  PLH.bul = [];
  PLH.cirIni = null;
  PLH.conIni = null;
  edCambio();
  plOrden();
  return el;
}
// Punto a la distancia escrita desde el último punto, en la dirección del cursor (entrada de longitud)
function dsPuntoAdistancia(L) {
  const u = PLH.pts[PLH.pts.length - 1];
  if (!u || !(L > 0)) return null;
  const q = plPuntoActual() || [u[0] + 1, u[1]];
  let dx = q[0] - u[0],
    dy = q[1] - u[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-12) [dx, dy] = [1, 0];
  else [dx, dy] = [dx / d, dy / d];
  const l = L / EPL.f;
  return [u[0] + dx * l, u[1] + dy * l];
}

/* ---------- Selección, mover, girar, copiar, pegar y borrar ---------- */
const dsSel = () => (dsD() ? dsD().els.filter(el => DS_SEL.has(el.id)) : []);
// Clic sobre un elemento: lo selecciona (con Mayús se suma o se quita) y prepara el arrastre para moverlo
function dsPresionar(id, p, suma) {
  if (suma) {
    if (DS_SEL.has(id)) DS_SEL.delete(id);
    else DS_SEL.add(id);
  } else if (!DS_SEL.has(id)) {
    DS_SEL.clear();
    PL_ASEL.clear();
    DS_SEL.add(id);
  }
  PLH.obj = -1;
  PLH.arr = DS_SEL.has(id) ? { base: p, orig: dsSel().map(el => JSON.stringify(el)), mov: false, id, suma } : null;
  edProps();
  plSobreDibujar();
}
function dsTrasladar(el, dx, dy) {
  if (el.pts) el.pts = el.pts.map((v, i) => v + (i % 2 ? dy : dx));
  else if (el.a) {
    el.a = [el.a[0] + dx, el.a[1] + dy];
    el.b = [el.b[0] + dx, el.b[1] + dy];
  } else {
    el.x += dx;
    el.y += dy;
  }
}
function dsMover(q) {
  dsIdxSucio();
  const a = PLH.arr,
    dx = q[0] - a.base[0],
    dy = q[1] - a.base[1],
    D = dsD();
  a.mov = true;
  a.orig
    .map(s => JSON.parse(s))
    .forEach(o => {
      const i = D.els.findIndex(e => e.id === o.id);
      if (i < 0) return;
      dsTrasladar(o, dx, dy);
      D.els[i] = o;
    });
  dsReconectar();
  plDibujar();
}
function dsSoltar() {
  const a = PLH.arr;
  PLH.arr = null;
  if (a.mov) {
    dsDesligar(dsSel());
    return edCambio();
  }
  // Clic sin mover sobre un elemento de una selección múltiple: queda solo ese
  if (!a.suma && DS_SEL.size > 1) {
    DS_SEL.clear();
    DS_SEL.add(a.id);
  }
  edProps();
  plSobreDibujar();
  const t = !a.suma && dsMarcasEn(a.base[0], a.base[1]);
  if (t && t.id === a.id) dsVentanaCond(t);
}
// Mueve lo seleccionado con las flechas del teclado: 1 cm, o 10 cm con Mayús
function dsEmpujar(dx, dy, grande) {
  const sel = dsSel().filter(dsEditable);
  if (!sel.length) return false;
  const l = (grande ? 0.1 : 0.01) / EPL.f;
  sel.forEach(el => dsTrasladar(el, dx * l, dy * l));
  dsDesligar(sel);
  edCambio();
  return true;
}
function dsMarco(mc) {
  const [xa, ya] = plADib(Math.min(mc.X0, mc.X1), Math.max(mc.Y0, mc.Y1)),
    [xb, yb] = plADib(Math.max(mc.X0, mc.X1), Math.min(mc.Y0, mc.Y1)),
    captura = mc.X1 < mc.X0;
  if (!mc.shift) DS_SEL.clear();
  dsD().els.forEach(el => {
    if (!dsEditable(el)) return;
    const b = dsBBox(el),
      dentro = b[0] >= xa && b[2] <= xb && b[1] >= ya && b[3] <= yb,
      toca = b[0] <= xb && b[2] >= xa && b[1] <= yb && b[3] >= ya;
    if (captura ? toca : dentro) DS_SEL.add(el.id);
  });
  plMarcoArq(xa, ya, xb, yb, captura, mc.shift);
  PLH.obj = -1;
  edProps();
  plSobreDibujar();
}
function dsGirar(ang = DSU.giro || 90) {
  if (PLH.h && PLH.h.startsWith("col:")) {
    PLH.rot = (((PLH.rot + ang) % 360) + 360) % 360;
    return plSobreDibujar();
  }
  const sel = dsSel().filter(el => dsEditable(el) && !dsEsTabla(el));
  if (!sel.length) return;
  dsDesligar(sel);
  // Los símbolos y textos giran sobre su punto; lo demás, sobre el centro de la selección
  const b = sel.map(dsBBox),
    cx = (Math.min(...b.map(x => x[0])) + Math.max(...b.map(x => x[2]))) / 2,
    cy = (Math.min(...b.map(x => x[1])) + Math.max(...b.map(x => x[3]))) / 2,
    co = Math.cos((ang * Math.PI) / 180),
    si = Math.sin((ang * Math.PI) / 180),
    rot = (x, y) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co],
    recto = ang % 90 === 0,
    cuarto = Math.abs(ang % 180) === 90;
  sel.forEach(el => {
    if (el.t === "sim" || el.t === "txt") el.r = Math.round((((((el.r || 0) + ang) % 360) + 360) % 360) * 100) / 100;
    else if (el.t === "cir") [el.x, el.y] = sel.length > 1 ? rot(el.x, el.y) : [el.x, el.y];
    else if (el.t === "cot") {
      el.a = rot(...el.a);
      el.b = rot(...el.b);
      // A 90° la cota horizontal pasa a vertical; a otros ángulos queda alineada con sus puntos
      if (!recto) el.modo = "alin";
      else if (cuarto && el.modo !== "alin") el.modo = el.modo === "h" ? "v" : "h";
    } else {
      const q = [];
      for (let i = 0; i < el.pts.length; i += 2) q.push(...rot(el.pts[i], el.pts[i + 1]));
      el.pts = q;
    }
  });
  edCambio();
}
function dsCopiar() {
  DS_PORTA = dsSel().map(el => JSON.parse(JSON.stringify(el)));
  if (DS_PORTA.length)
    toast(`${DS_PORTA.length} elemento${DS_PORTA.length > 1 ? "s" : ""} copiado${DS_PORTA.length > 1 ? "s" : ""}`);
}
// Pega lo copiado con el centro en el cursor (o, sin cursor sobre el plano, desplazado un poco)
function dsPegar() {
  if (!DS_PORTA.length || !dsD()) return;
  const b = DS_PORTA.map(dsBBox),
    cx = (Math.min(...b.map(x => x[0])) + Math.max(...b.map(x => x[2]))) / 2,
    cy = (Math.min(...b.map(x => x[1])) + Math.max(...b.map(x => x[3]))) / 2,
    q = plPuntoActual() || [cx + 20 * dsU(), cy - 20 * dsU()];
  DS_SEL.clear();
  const nuevo = new Map(),
    pegados = [];
  DS_PORTA.forEach(o => {
    const el = JSON.parse(JSON.stringify(o));
    dsTrasladar(el, q[0] - cx, q[1] - cy);
    dsCapa(el.capa);
    dsAgregar(el);
    nuevo.set(o.id, el.id);
    pegados.push(el);
    DS_SEL.add(el.id);
  });
  pegados.forEach(t =>
    ["c0", "c1"].forEach(c => {
      if (t[c] && nuevo.has(t[c])) t[c] = nuevo.get(t[c]);
      else delete t[c];
    })
  );
  edCambio();
}
function dsTodo() {
  DS_SEL.clear();
  dsD().els.forEach(el => {
    if (dsEditable(el)) DS_SEL.add(el.id);
  });
  PLH.obj = -1;
  edProps();
  plSobreDibujar();
}
// Selecciona todos los elementos de un tipo (desde el resumen del panel izquierdo)
function dsSelTipo(tipo) {
  DS_SEL.clear();
  dsD().els.forEach(el => {
    if (dsEditable(el) && dsTipo(el) === tipo) DS_SEL.add(el.id);
  });
  PLH.obj = -1;
  edProps();
  plSobreDibujar();
}
const dsTipo = el => (el.t === "sim" ? el.k : el.t === "tub" ? "tub-" + (el.modo === "piso" ? "piso" : "techo") : el.t);
// Curvatura de las líneas y tuberías seleccionadas: curvar, enderezar o invertir todos sus tramos
function dsCurvar(modo) {
  const sel = dsSel().filter(el => (el.t === "lin" || el.t === "tub") && dsEditable(el));
  if (!sel.length) return;
  sel.forEach(el => {
    const n = dsTramos({ ...el, b: [] }).length;
    if (modo === "recto") delete el.b;
    else if (modo === "curvo") el.b = Array.from({ length: n }, (v, i) => (el.b && el.b[i]) || DS_BUL);
    else if (el.b) el.b = el.b.map(k => -k);
  });
  edCambio();
}

/* ---------- Propiedades de lo seleccionado ---------- */
// Altura de montaje por defecto: la de Parámetros › Alturas del proyecto (criterio del proyectista)
const dsAlturaDef = k => {
  const c = DS_CAT[k];
  return c && c.h ? parseFloat(PROY[c.h]) || null : null;
};
const dsPotDef = k => {
  const c = DS_CAT[k];
  return c && c.p ? parseFloat(PROY[c.p]) || null : null;
};
function dsProps(c) {
  const sel = dsSel(),
    D = dsD();
  const fila = (k, v) => `<div class="ed-pf"><span>${k}</span><b>${v}</b></div>`,
    campo = (k, html) => `<label class="ed-pf ed-pc"><span>${k}</span>${html}</label>`,
    capas = v =>
      `<select data-dsp="capa">${v === "" ? '<option value="" selected>(varias)</option>' : ""}${D.capas.map(x => `<option${x.n === v ? " selected" : ""}>${esc(x.n)}</option>`).join("")}</select>`,
    circ = v =>
      `<input type="text" data-dsp="cir" value="${esc(v || "")}" placeholder="ej. C-1" list="dsCircs" maxlength="12">`,
    lista = `<datalist id="dsCircs">${D.els
      .filter(e => e.k === "tab")
      .flatMap(e =>
        dsSalidasTab(e).map(
          o => `<option value="${o.n}">${esc(e.nom || "Tablero")}${o.d ? " · " + esc(o.d) : ""}</option>`
        )
      )
      .join("")}</datalist>`,
    acciones = `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="girar">Girar ${DSU.giro || 90}°</button><button type="button" class="btn sec sm" data-dsa="copiar">Copiar</button><button type="button" class="btn sec sm ed-del" data-dsa="borrar">Borrar</button></div>`,
    curvas = `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="curvo" title="Todos los tramos en arco">Curvar</button><button type="button" class="btn sec sm" data-dsa="recto" title="Todos los tramos rectos">Enderezar</button><button type="button" class="btn sec sm" data-dsa="invertir" title="Los arcos al otro lado">Invertir curvas</button></div>`;
  if (sel.length > 1) {
    const cuenta = {};
    sel.forEach(el => (cuenta[dsTipo(el)] = (cuenta[dsTipo(el)] || 0) + 1));
    const capa0 = sel.every(el => el.capa === sel[0].capa) ? sel[0].capa : "",
      cir0 = sel.every(el => (el.cir || "") === (sel[0].cir || "")) ? sel[0].cir || "" : "",
      tubs = sel.filter(el => el.t === "tub");
    c.innerHTML =
      `<div class="ed-pt">${sel.length} elementos seleccionados</div>` +
      Object.entries(cuenta)
        .map(([t, n]) => fila(dsNomTipo(t), n))
        .join("") +
      (tubs.length ? fila("Tuberías", `${plFm(tubs.reduce((s, el) => s + dsLargo(el), 0))} m`) : "") +
      campo("Capa", capas(capa0)) +
      (sel.every(el => el.t === "sim" || el.t === "tub") ? campo("Circuito", circ(cir0)) + lista : "") +
      (tubs.length === sel.length ? dsCampoCond(campo, tubs) : "") +
      dsCamposVarios(campo, sel) +
      (sel.every(dsConEnc)
        ? campo(
            "Encendido",
            `<input type="text" data-dsp="enc" value="${sel.every(e => (e.enc || "") === (sel[0].enc || "")) ? esc(sel[0].enc || "") : ""}" placeholder="a, b…" maxlength="3">`
          )
        : "") +
      (sel.some(el => el.t === "lin" || el.t === "tub") ? curvas : "") +
      acciones;
    return;
  }
  const el = sel[0],
    cap = dsCapaDe(el);
  let h = "";
  if (el.t === "sim") {
    const cat = DS_CAT[el.k],
      hd = dsAlturaDef(el.k),
      pd = dsPotDef(el.k);
    h =
      `<div class="ed-pt">${cat.n}<small>Norma DGE ${cat.c}</small></div>` +
      `<div class="ds-prev">${dsIcono(el.k)}</div>` +
      `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="simbolo" title="Relleno, tamaño, letra y grosor de este tipo de símbolo (criterio del proyectista)">Editar símbolo…</button>${dsSimb(el.k) ? '<span class="ds-crit">Con criterio del proyectista</span>' : ""}</div>` +
      campo("Capa", capas(el.capa)) +
      campo("Rotación", `<input type="number" data-dsp="r" value="${+(el.r || 0).toFixed(2)}" step="1"><i>°</i>`) +
      (cat.h
        ? campo(
            "Altura",
            `<input type="number" data-dsp="h" value="${el.h ?? ""}" placeholder="${hd != null ? fmt(hd, 2) : ""}" step="0.05" min="0" max="10"><i>m</i>`
          ) +
          `<p class="ds-crit">Criterio: si la deja vacía, usa la de Parámetros › Alturas (${hd != null ? fmt(hd, 2) + " m" : "—"}).</p>`
        : fila("Altura", el.k === "luz" ? "en el techo" : "—")) +
      (cat.u
        ? campo(
            "Potencia",
            `<input type="number" data-dsp="p" value="${el.p ?? ""}" placeholder="${pd != null ? pd : ""}" step="10" min="0" max="100000"><i>${cat.u}</i>`
          )
        : "") +
      (el.k === "tab"
        ? fila("Nombre", esc(el.nom || "—")) +
          fila("Circuitos", el.nc ? `${el.nc} (C-1 a C-${el.nc})` : "sin definir") +
          `<div class="ed-pb"><button type="button" class="btn sm" data-dsa="tablero">Circuitos del tablero…</button></div>`
        : cat.s !== "can" && cat.s !== "tie"
          ? campo("Circuito", circ(el.cir)) + lista
          : "") +
      (dsConEnc(el)
        ? campo(
            "Encendido",
            `<input type="text" data-dsp="enc" value="${esc(el.enc || "")}" placeholder="a, b…" maxlength="3" title="Letra que une el interruptor con las luminarias que enciende">`
          )
        : "") +
      fila("Posición X", `${plFm(el.x)} m`) +
      fila("Posición Y", `${plFm(el.y)} m`);
  } else if (el.t === "txt") {
    h =
      `<div class="ed-pt">Texto</div>` +
      campo("Texto", `<input type="text" data-dsp="s" value="${esc(el.s)}" maxlength="200">`) +
      campo(
        "Altura",
        `<input type="number" data-dsp="ht" value="${+(el.ht * EPL.f).toFixed(3)}" step="0.01" min="0.01"><i>m</i>`
      ) +
      campo("Rotación", `<input type="number" data-dsp="r" value="${+(el.r || 0).toFixed(2)}" step="1"><i>°</i>`) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "dir") {
    h =
      `<div class="ed-pt">Directriz</div>` +
      campo("Texto", `<input type="text" data-dsp="s" value="${esc(el.s)}" maxlength="120">`) +
      campo(
        "Altura",
        `<input type="number" data-dsp="ht" value="${+(el.ht * EPL.f).toFixed(3)}" step="0.01" min="0.01"><i>m</i>`
      ) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "cot") {
    const G = dsCotaGeo(el);
    h =
      `<div class="ed-pt">Cota</div>` +
      fila("Medida", `${plFm(G.med)} m`) +
      campo(
        "Dirección",
        `<select data-dsp="modo"><option value="alin"${el.modo === "alin" ? " selected" : ""}>Alineada</option><option value="h"${el.modo === "h" ? " selected" : ""}>Horizontal</option><option value="v"${el.modo === "v" ? " selected" : ""}>Vertical</option></select>`
      ) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "cua") {
    h =
      `<div class="ed-pt">Cuadro de circuitos<small>Se arma solo con los tableros y lo conectado a cada circuito</small></div>` +
      campo(
        "Título",
        `<input type="text" data-dsp="tit" value="${esc(el.tit || "CUADRO DE CIRCUITOS")}" maxlength="60">`
      ) +
      fila("Circuitos", dsFilasCua().filter(f => f.c).length) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "ley") {
    h =
      `<div class="ed-pt">Leyenda<small>Se arma sola con lo que usa el diseño</small></div>` +
      campo("Título", `<input type="text" data-dsp="tit" value="${esc(el.tit || "LEYENDA")}" maxlength="60">`) +
      fila("Filas", dsFilasLey().length) +
      campo("Capa", capas(el.capa));
  } else if (el.t === "cir") {
    h =
      `<div class="ed-pt">Círculo</div>` +
      campo(
        "Radio",
        `<input type="number" data-dsp="rad" value="${+(el.rad * EPL.f).toFixed(3)}" step="0.05" min="0.01"><i>m</i>`
      ) +
      campo("Capa", capas(el.capa)) +
      fila("Centro", `X ${plFm(el.x)} · Y ${plFm(el.y)} m`);
  } else {
    const tub = el.t === "tub",
      T = dsTramos(el),
      nc = T.filter(t => t.k).length;
    h =
      `<div class="ed-pt">${tub ? "Tubería" : el.c ? "Polilínea cerrada" : el.pts.length > 4 ? "Polilínea" : "Línea"}</div>` +
      (tub
        ? campo(
            "Recorrido",
            `<select data-dsp="modo"><option value="techo"${el.modo !== "piso" ? " selected" : ""}>Techo o pared (línea continua)</option><option value="piso"${el.modo === "piso" ? " selected" : ""}>Piso (línea discontinua)</option></select>`
          )
        : "") +
      fila(
        "Longitud",
        `${plFm(dsLargo(el))} m${nc ? `<small>con ${nc} tramo${nc > 1 ? "s" : ""} en arco (longitud del arco)</small>` : ""}`
      ) +
      (T.length > 1
        ? `<div class="ds-tramos">${T.map((t, i) => `<span>Tramo ${i + 1}${t.k ? " ◠" : ""}</span><b>${plFm(t.L)} m</b>`).join("")}</div>`
        : "") +
      campo("Capa", capas(el.capa)) +
      (tub ? campo("Circuito", circ(el.cir)) + lista + dsCampoCond(campo, [el]) : "") +
      `<p class="ds-crit ds-crit0">Arrastre el rombo del medio de un tramo para curvarlo; los cuadrados mueven los vértices.</p>` +
      curvas;
  }
  const color = `<label class="ed-pf ed-pc"><span>Color</span><span class="ds-colr"><input type="color" data-dsp="col" value="${dsColorEl(el, cap)}" title="Color propio de este elemento"><button type="button" class="btn sec sm" data-dsa="colcapa"${el.col ? "" : " disabled"} title="Quita el color propio: vuelve al color de su tipo (si está activado en Vista) o al de su capa">Quitar color propio</button></span></label>`,
    letra = el.dt
      ? `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="letra0">Letra a su lugar</button></div>`
      : "";
  c.innerHTML = h + color + letra + (cap.bloq ? `<p class="pl-nota">La capa está bloqueada.</p>` : "") + acciones;
  if (c.id === "edPropC") elRender();
}
// Campos comunes a varios símbolos: rotación y, si todos tienen, altura de montaje y potencia (vacío = cada uno el suyo)
function dsCamposVarios(campo, sel) {
  if (!sel.every(el => el.t === "sim" && DS_CAT[el.k])) return "";
  const igual = k => sel.every(el => el[k] === sel[0][k]),
    u = DS_CAT[sel[0].k].u,
    mismaU = sel.every(el => DS_CAT[el.k].u === u);
  return (
    campo(
      "Rotación",
      `<input type="number" data-dsp="r" value="${igual("r") ? +(sel[0].r || 0).toFixed(2) : ""}" placeholder="(varias)" step="1"><i>°</i>`
    ) +
    (sel.every(el => DS_CAT[el.k].h)
      ? campo(
          "Altura",
          `<input type="number" data-dsp="h" value="${igual("h") && sel[0].h != null ? sel[0].h : ""}" placeholder="${igual("h") ? "la de Parámetros" : "(varias)"}" step="0.05" min="0" max="10"><i>m</i>`
        )
      : "") +
    (u && mismaU
      ? campo(
          "Potencia",
          `<input type="number" data-dsp="p" value="${igual("p") && sel[0].p != null ? sel[0].p : ""}" placeholder="${igual("p") ? "la de Parámetros" : "(varias)"}" step="10" min="0" max="100000"><i>${u}</i>`
        )
      : "")
  );
}
// Diámetros nominales de las tuberías (mm)
const DS_DIAS = [15, 20, 25, 35, 40, 50, 65, 80];
// Campo de conductores de las tuberías (fases, neutro, tierra), su diámetro y botón para todo el circuito
function dsCampoCond(campo, ts) {
  const d0 = ts.every(t => (t.dia || 0) === (ts[0].dia || 0)) ? ts[0].dia || 0 : -1;
  return (
    campo(
      "Diámetro",
      `<select data-dsp="dia">${d0 < 0 ? '<option value="" selected>(varios)</option>' : ""}<option value=""${d0 === 0 ? " selected" : ""}>—</option>${DS_DIAS.map(d => `<option value="${d}"${d === d0 ? " selected" : ""}>Ø ${d} mm</option>`).join("")}</select>`
    ) + dsCampoCond1(campo, ts)
  );
}
function dsCampoCond1(campo, ts) {
  const c0 = JSON.stringify(ts[0].cond || {}),
    igual = ts.every(t => JSON.stringify(t.cond || {}) === c0),
    c = igual ? ts[0].cond || {} : {},
    cir = ts.length === 1 && ts[0].cir;
  return (
    campo(
      "Conductores",
      `<span class="ds-cond"><select data-dsp="condF" title="Fases o conductores activos (también los retornos)">${[
        0, 1, 2, 3, 4, 5, 6
      ]
        .map(n => `<option value="${n}"${igual && (c.f || 0) === n ? " selected" : ""}>${n} F</option>`)
        .join("")}</select><select data-dsp="condN" title="Neutros">${[0, 1, 2]
        .map(n => `<option value="${n}"${igual && dsNeutros(c) === n ? " selected" : ""}>${n} N</option>`)
        .join("")}</select><label><input type="checkbox" data-dsp="condT"${c.t ? " checked" : ""}>T</label></span>`
    ) +
    `<p class="ds-crit">Marcas de la norma sobre la tubería: una raya por fase, el neutro (N) con punto y la tierra (T) con tope.</p>` +
    (cir
      ? `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="condcir">Igual en todo el circuito ${esc(cir)}</button></div>`
      : "")
  );
}
const dsNomTipo = t =>
  DS_CAT[t]
    ? DS_CAT[t].n
    : {
        "tub-techo": "Tubería en techo o pared",
        "tub-piso": "Tubería en piso",
        lin: "Línea o polilínea",
        cir: "Círculo",
        txt: "Texto",
        cot: "Cota",
        dir: "Directriz",
        ley: "Leyenda",
        cua: "Cuadro de circuitos"
      }[t] || t;
function dsPropCambio(e) {
  const f = e.target.closest("[data-dsp]");
  if (!f || !DS_SEL.size) return;
  const k = f.dataset.dsp,
    v = f.type === "checkbox" ? (f.checked ? "1" : "") : f.value.trim();
  dsSel().forEach(el => {
    if (k === "condF" || k === "condN" || k === "condT") {
      if (el.t !== "tub") return;
      const c = { f: 0, n: false, t: false, ...(el.cond || {}) };
      if (k === "condF") c.f = Math.max(0, Math.min(6, parseInt(v, 10) || 0));
      else if (k === "condN") c.n = Math.max(0, Math.min(2, parseInt(v, 10) || 0));
      else c.t = !!v;
      c.n = dsNeutros(c);
      if (c.f || c.n || c.t) el.cond = c;
      else delete el.cond;
      return;
    }
    if (k === "dia") {
      if (el.t === "tub") el.dia = DS_DIAS.includes(+v) ? +v : undefined;
      return;
    }
    if (k === "enc") {
      if (dsConEnc(el))
        el.enc =
          v
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 3) || undefined;
      return;
    }
    if (k === "capa") {
      if (v) el.capa = v;
    } else if (k === "r") el.r = Math.round(((((parseFloat(v) || 0) % 360) + 360) % 360) * 100) / 100;
    else if (k === "col") el.col = /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : el.col;
    else if (k === "h") el.h = v === "" ? undefined : Math.max(0, parseFloat(v) || 0);
    else if (k === "p") el.p = v === "" ? undefined : Math.max(0, parseFloat(v) || 0);
    else if (k === "cir") el.cir = v.replace(/[<>]/g, "").slice(0, 12) || undefined;
    else if (k === "s") el.s = v.replace(/[<>]/g, "").slice(0, 200) || el.s;
    else if (k === "tit")
      el.tit = v.replace(/[<>]/g, "").slice(0, 60) || (el.t === "cua" ? "CUADRO DE CIRCUITOS" : "LEYENDA");
    else if (k === "ht") el.ht = Math.max(0.01, parseFloat(v) || 0.1) / EPL.f;
    else if (k === "rad") el.rad = Math.max(0.01, parseFloat(v) || 0.1) / EPL.f;
    else if (k === "modo") {
      if (el.t === "tub") {
        el.modo = v === "piso" ? "piso" : "techo";
        // La tubería pasa a la capa de su recorrido si estaba en la del otro
        if (el.capa === DS_SIS.tubT.capa || el.capa === DS_SIS.tubP.capa)
          el.capa = el.modo === "piso" ? DS_SIS.tubP.capa : DS_SIS.tubT.capa;
      } else if (el.t === "cot") el.modo = ["alin", "h", "v"].includes(v) ? v : "alin";
    }
  });
  edCambio();
}
function dsPropClic(e) {
  const b = e.target.closest("[data-dsa]");
  if (!b) return;
  const a = b.dataset.dsa;
  if (a === "girar") dsGirar();
  else if (a === "simbolo") siAbrir(dsSel()[0].k);
  else if (a === "condcir") {
    const t = dsSel()[0];
    let n = 0;
    dsD().els.forEach(o => {
      if (o.t === "tub" && o !== t && o.cir === t.cir && (o.tab || "") === (t.tab || "")) {
        if (t.cond) o.cond = { ...t.cond };
        else delete o.cond;
        if (t.dia) o.dia = t.dia;
        n++;
      }
    });
    edCambio();
    toast(`Conductores iguales en ${n + 1} tubería${n ? "s" : ""} del circuito ${t.cir}`);
  } else if (a === "colcapa" || a === "letra0") {
    dsSel().forEach(el => delete el[a === "colcapa" ? "col" : "dt"]);
    edCambio();
  } else if (a === "borrar") edBorrar(false);
  else if (a === "copiar") {
    dsCopiar();
    dsPegar();
  } else if (a === "tablero") tabAbrir(dsSel()[0].id);
  else dsCurvar(a);
}
["edPropC", "elC"].forEach(id => {
  $(id).addEventListener("change", dsPropCambio);
  $(id).addEventListener("click", dsPropClic);
});

/* ---------- Resumen del diseño (panel izquierdo): cuántos hay de cada cosa; un clic los selecciona ---------- */
function dsResumen(ya) {
  const D = dsD();
  if (!ya && D && D.els.length > 3000) {
    clearTimeout(dsResumen.t);
    dsResumen.t = setTimeout(() => dsResumen(true), 300);
    return;
  }
  dsResumen0();
}
function dsResumen0() {
  const D = dsD(),
    box = $("dsResumen");
  if (!D || !PL_MOD) {
    box.innerHTML = "";
    $("dsN").textContent = "";
    return;
  }
  const cuenta = {},
    largo = {};
  // Filtro por planta (con dos o más plantas encuadradas)
  const P = EPL.plantas,
    f = $("dsPlF");
  if (DP_F >= P.length) DP_F = -1;
  f.hidden = P.length < 2;
  f.innerHTML =
    `<option value="-1">Todas</option>` + P.map((p, i) => `<option value="${i}">${esc(p.n)}</option>`).join("");
  f.value = String(DP_F);
  dpFiltrar(D.els).forEach(el => {
    const t = dsTipo(el);
    cuenta[t] = (cuenta[t] || 0) + 1;
    if (el.t === "tub") largo[t] = (largo[t] || 0) + dsLargo(el);
  });
  $("dsN").textContent = D.els.length || "";
  const sl = dsSueltos(),
    hayTub = D.els.some(e => e.t === "tub"),
    s = (n, a, b) => `${n} ${n === 1 ? a : b}`,
    aviso =
      sl.sims.length || sl.puntas.length
        ? `<div class="ds-aviso"><b>Sin conectar:</b> ${[sl.sims.length ? s(sl.sims.length, "artefacto sin tubería", "artefactos sin tubería") : "", sl.puntas.length ? s(sl.puntas.length, "punta de tubería suelta", "puntas de tubería sueltas") : ""].filter(Boolean).join(" · ")}<div><button type="button" data-dsx="elegir">Elegirlos</button>${hayTub ? '<button type="button" data-dsx="auto" title="Conecta las puntas que ya están sobre un artefacto">Conectar automáticamente</button>' : ""}</div></div>`
        : hayTub
          ? '<div class="ds-aviso ok">✓ Todas las tuberías y artefactos están conectados</div>'
          : "";
  const rv = D.els.length ? dsVerificar().filter(o => o.nivel === "aviso").length : 0;
  const revision = D.els.length
    ? `<div class="ds-aviso${rv ? "" : " ok"}"><b>Revisión:</b> ${rv ? `${rv} aviso${rv > 1 ? "s" : ""}` : "sin avisos"}<div><button type="button" data-dsx="rev">Revisar diseño</button></div></div>`
    : "";
  const orden = [
    ...Object.keys(DS_CAT),
    "tub-techo",
    "tub-piso",
    "lin",
    "cir",
    "txt",
    "cot",
    "dir",
    "ley",
    "cua"
  ].filter(t => cuenta[t]);
  box.innerHTML = orden.length
    ? aviso +
      revision +
      orden
        .map(
          t =>
            `<button type="button" class="ds-fila" data-dst="${t}" title="Seleccionar todos">${DS_CAT[t] ? (DSU.color === "tipo" ? dsIcono(t).replace('class="ds-ico"', `class="ds-ico" style="color:${plColorDis(DS_COLT[t])}"`) : dsIcono(t)) : `<i class="ds-ico ds-lin${t === "tub-piso" ? " piso" : ""}"></i>`}<span>${dsNomTipo(t)}</span><em>${largo[t] ? plFm(largo[t]) + " m" : cuenta[t]}</em></button>`
        )
        .join("")
    : `<p class="pl-nota">Coloque luminarias, interruptores, tomacorrientes, tableros y tuberías desde las pestañas <b>Insertar</b> y <b>Dibujo</b>. Aquí verá cuántos hay de cada uno y los metros de tubería.</p>`;
}
$("dsPlF").addEventListener("change", e => {
  DP_F = +e.target.value;
  e.target.blur();
  dsResumen();
});
$("dsResumen").addEventListener("click", e => {
  const b = e.target.closest("[data-dst]"),
    x = e.target.closest("[data-dsx]");
  if (b) dsSelTipo(b.dataset.dst);
  else if (x && x.dataset.dsx === "rev") revAbrir();
  else if (x && x.dataset.dsx === "auto") {
    const k = dsConectarAuto();
    if (k) edCambio();
    toast(
      k
        ? `${k} punta${k > 1 ? "s" : ""} conectada${k > 1 ? "s" : ""}`
        : "No hay puntas sobre un artefacto: arrastre cada punta suelta hasta su artefacto"
    );
  } else if (x) {
    const sl = dsSueltos();
    DS_SEL.clear();
    PL_ASEL.clear();
    sl.sims.forEach(el => DS_SEL.add(el.id));
    sl.puntas.forEach(o => DS_SEL.add(o.el.id));
    PLH.obj = -1;
    edProps();
    plSobreDibujar();
  }
});

/* ---------- Cinta del editor: íconos de los símbolos, capa actual, escalas, rejilla, enganches y trazo ---------- */
document.querySelectorAll("#editor [data-ds-ico]").forEach(i => (i.outerHTML = dsIcono(i.dataset.dsIco)));
$("dsEscala").innerHTML = DS_ESCALAS.map(e => `<option value="${e}">1:${e}</option>`).join("");
$("dsPaso").innerHTML = DS_PASOS.map(p => `<option value="${p}">${fmt(p, 2)} m</option>`).join("");
function dsCinta() {
  const D = dsD(),
    s = $("dsActual"),
    sin = !D || !PL_MOD;
  s.innerHTML = D
    ? D.capas.map(c => `<option${c.n === D.actual ? " selected" : ""}>${esc(c.n)}</option>`).join("")
    : "";
  s.disabled = sin;
  $("dsEscala").value = D ? String(D.escala) : "50";
  $("dsEscala").disabled = sin;
  $("dsEtq").value = D ? D.etq || "total" : "total";
  $("dsEtq").disabled = sin;
  $("dsRej").checked = DSU.rej;
  $("dsForz").checked = DSU.forz;
  $("dsPaso").value = String(DSU.paso);
  $("dsAlinear").checked = DSU.alinear;
  $("dsGiro").value = String(DSU.giro || 0);
  $("dsColor").value = DSU.color;
  $("dsMarcas").checked = DSU.marcas;
  $("dsMarcaEst").value = DSU.marcaEst === "recta" ? "recta" : "incl";
  $("dsCalido").value = String(DSU.calido || 0);
  $("dsNav").checked = DSU.nav !== false;
  $("dsInfo").checked = DSU.info !== false;
  $("dsBrillo").value = String(DSU.brillo || 100);
  $("dsCirT").checked = !!(D && D.cirt);
  $("dsNSal").checked = !!(D && D.nsal);
  $("dsNSal").disabled = sin;
  $("dsCirT").disabled = sin;
  $("edPolar").value = String(DSU.polarInc);
  $("dsSueltos").checked = DSU.sueltos;
  $("dsTrazo").value = DSU.curva ? "curvo" : "recto";
  document.querySelectorAll("[data-edtg]").forEach(b => {
    const v = b.dataset.edtg;
    b.setAttribute("aria-pressed", v === "rej" || v === "forz" || v === "polar" ? DSU[v] : $(v).checked);
  });
  // Enganches activos
  document.querySelectorAll("#edRefs [data-ref]").forEach(c => (c.checked = DSU.ref[c.dataset.ref] !== false));
  $("edSens").value = String(DSU.sens);
}
$("dsActual").addEventListener("change", e => {
  if (!dsD()) return;
  dsD().actual = e.target.value;
  edCambio();
});
$("dsEscala").addEventListener("change", e => {
  if (!dsD()) return;
  dsD().escala = DS_ESCALAS.includes(+e.target.value) ? +e.target.value : 50;
  edCambio();
  toast(`Símbolos, textos y cotas para imprimir a 1:${dsD().escala}`);
});
$("dsEtq").addEventListener("change", e => {
  if (!dsD()) return;
  dsD().etq = ["no", "total", "tramo"].includes(e.target.value) ? e.target.value : "total";
  edCambio();
});
function dsAlternarRejilla(cual, aviso) {
  DSU[cual] = !DSU[cual];
  dsGuardarPref();
  dsCinta();
  if (aviso)
    toast(
      `${cual === "rej" ? "Rejilla" : cual === "polar" ? `Rastreo polar (cada ${DSU.polarInc}°)` : "Forzar cursor a la rejilla"} ${DSU[cual] ? "activado" : "desactivado"}`
    );
  plDibujar();
}
$("dsRej").addEventListener("change", () => dsAlternarRejilla("rej"));
$("dsForz").addEventListener("change", () => dsAlternarRejilla("forz"));
$("dsPaso").addEventListener("change", e => {
  DSU.paso = DS_PASOS.includes(+e.target.value) ? +e.target.value : 0.5;
  dsGuardarPref();
  plDibujar();
});
$("dsGiro").addEventListener("change", e => {
  DSU.giro = [0, 1, 5, 15, 30, 45, 90].includes(+e.target.value) ? +e.target.value : 0;
  // Suelta el foco: así la tecla R actúa enseguida sobre el plano
  e.target.blur();
  dsGuardarPref();
  toast(
    DSU.giro
      ? `Giro de ${DSU.giro}° en ${DSU.giro}° (tecla R y pinzamiento redondo)`
      : "Giro libre: el pinzamiento redondo gira a cualquier ángulo; R gira 90°"
  );
});
$("dsSueltos").addEventListener("change", e => {
  DSU.sueltos = e.target.checked;
  dsGuardarPref();
  plDibujar();
});
$("dsColor").addEventListener("change", e => {
  DSU.color = ["capa", "tipo", "cir"].includes(e.target.value) ? e.target.value : "tipo";
  e.target.blur();
  dsGuardarPref();
  dsResumen();
  plDibujar();
});
$("dsInfo").addEventListener("change", e => {
  DSU.info = e.target.checked;
  dsGuardarPref();
  plSobreDibujar();
});
$("dsNav").addEventListener("change", e => {
  DSU.nav = e.target.checked;
  dsGuardarPref();
  plNavPoner();
});
["dsCalido", "dsBrillo"].forEach(id =>
  $(id).addEventListener("input", e => {
    DSU[id === "dsCalido" ? "calido" : "brillo"] = +e.target.value;
    dsGuardarPref();
    dsFondo();
  })
);
$("dsMarcaEst").addEventListener("change", e => {
  DSU.marcaEst = e.target.value === "recta" ? "recta" : "incl";
  e.target.blur();
  dsGuardarPref();
  plDibujar();
});
$("dsNSal").addEventListener("change", e => {
  if (!dsD()) return;
  if (e.target.checked) dsD().nsal = true;
  else delete dsD().nsal;
  edCambio();
});
$("dsCirT").addEventListener("change", e => {
  if (!dsD()) return;
  if (e.target.checked) dsD().cirt = true;
  else delete dsD().cirt;
  edCambio();
});
$("dsMarcas").addEventListener("change", e => {
  DSU.marcas = e.target.checked;
  dsGuardarPref();
  plDibujar();
});
$("edPolar").addEventListener("change", e => {
  DSU.polarInc = [15, 30, 45, 90].includes(+e.target.value) ? +e.target.value : 45;
  dsGuardarPref();
});
$("dsAlinear").addEventListener("change", e => {
  DSU.alinear = e.target.checked;
  dsGuardarPref();
  plOrden();
});
$("dsTrazo").addEventListener("change", e => {
  DSU.curva = e.target.value !== "recto";
  dsGuardarPref();
  plOrden();
  plSobreDibujar();
});
// Ventanita de enganches (desde la barra de estado): cuáles están activos y su sensibilidad
$("edRefs").addEventListener("change", e => {
  const c = e.target.closest("[data-ref]");
  if (c) DSU.ref[c.dataset.ref] = c.checked;
  if (e.target.id === "edSens") DSU.sens = [6, 12, 20].includes(+e.target.value) ? +e.target.value : 12;
  dsGuardarPref();
});

/* ---------- Editor de símbolos: relleno, tamaño, letra y grosor por tipo (criterio del proyectista) ---------- */
const SI_VW = ventanaMovil(document.querySelector("#simDlg .vw"), "jmg-electric-simbolo", {
  w: 600,
  h: 420,
  minW: 520,
  minH: 360
});
let SI_K = null;
function siAbrir(k) {
  if (!DS_CAT[k] || !dsD()) return;
  SI_K = k;
  const o = dsSimb(k) || {},
    letra = (dsPrims(k).find(p => dsEsLetra(k, p)) || {}).tx;
  $("siT").textContent = "Editar símbolo · " + DS_CAT[k].n;
  $("siCod").textContent = `Norma DGE ${DS_CAT[k].c}${letra ? " · letra de la norma: " + letra : ""}`;
  $("siRel").value = o.rel || "";
  $("siTam").value = Math.round((o.tam || 1) * 100);
  $("siTamV").textContent = Math.round((o.tam || 1) * 100) + " %";
  $("siLet").value = typeof o.let === "string" ? o.let : "";
  $("siLet").placeholder = letra ? `${letra} (como la norma)` : "sin letra en la norma";
  $("siLet").disabled = !letra;
  $("siGr").value = String(o.gr || 1);
  $("simDlg").hidden = false;
  vwFondo();
  SI_VW.abrir();
  siVista();
}
function siCerrar() {
  $("simDlg").hidden = true;
  vwFondo();
  if (!$("bibDlg").hidden) bibRender();
}
function siVista() {
  const c = $("siPrev"),
    g = c.getContext("2d"),
    k = SI_K,
    b = dsBBs(k),
    t = dsTam(k),
    u = (Math.min(c.width / (b[2] - b[0]), c.height / (b[3] - b[1])) * 0.7 * t) / Math.max(1, t),
    col = dsColorEl({ t: "sim", k }, dsCapa(DS_SIS[DS_CAT[k].s].capa));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  dsDibSim(
    g,
    k,
    c.width / 2 - ((b[0] + b[2]) / 2) * u,
    c.height / 2 - ((b[1] + b[3]) / 2) * u,
    0,
    u,
    col,
    "#ffffff",
    2
  );
}
function siLeer() {
  const D = dsD(),
    k = SI_K,
    o = {},
    rel = $("siRel").value,
    tam = Math.max(0.6, Math.min(1.6, (+$("siTam").value || 100) / 100)),
    let_ = $("siLet").value.replace(/[<>]/g, "").trim().slice(0, 4),
    gr = +$("siGr").value === 1.6 ? 1.6 : 1;
  if (rel) o.rel = rel;
  if (tam !== 1) o.tam = tam;
  if ($("siLet").value !== "" && !$("siLet").disabled) o.let = let_;
  if (gr !== 1) o.gr = gr;
  D.simb = D.simb || {};
  if (Object.keys(o).length) D.simb[k] = o;
  else delete D.simb[k];
  if (!Object.keys(D.simb).length) delete D.simb;
  $("siTamV").textContent = Math.round(tam * 100) + " %";
  edCambio();
  siVista();
}
$("simDlg").addEventListener("input", e => {
  if (e.target.id === "siTam") $("siTamV").textContent = e.target.value + " %";
});
$("simDlg").addEventListener("change", siLeer);
$("simDlg").addEventListener("click", e => {
  if (e.target.id === "simDlg") return siCerrar();
  const b = e.target.closest("[data-si]");
  if (!b) return;
  if (b.dataset.si === "cerrar") siCerrar();
  else if (b.dataset.si === "norma") {
    const D = dsD();
    if (D.simb) delete D.simb[SI_K];
    if (D.simb && !Object.keys(D.simb).length) delete D.simb;
    edCambio();
    siAbrir(SI_K);
    toast("Símbolo como la Norma DGE");
  }
});
$("simDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    siCerrar();
  }
  e.stopPropagation();
});

/* ---------- Fondo del plano: base, temperatura y brillo (Vista › Fondo del plano) ----------
   Solo la vista del plano en la pantalla de cada usuario (las láminas y el DXF no cambian). Sobre un fondo oscuro,
   la arquitectura y el diseño se aclaran solos para leerse bien. */
const DS_FONDOS = {
  tema: ["Según el tema", null],
  blanco: ["Blanco", [255, 255, 255]],
  papel: ["Papel", [246, 238, 220]],
  gris: ["Gris claro", [228, 231, 235]],
  gris2: ["Gris medio", [178, 184, 191]],
  azul: ["Azul noche", [24, 34, 52]],
  grafito: ["Grafito", [42, 46, 52]],
  negro: ["Negro", [12, 13, 16]]
};
function dsFondoColor(base) {
  const t = Math.max(-50, Math.min(100, DSU.calido || 0)) / 100,
    b = Math.max(60, Math.min(130, DSU.brillo || 100)) / 100;
  // Cálida: menos azul y algo menos verde; fría: menos rojo
  const f = t >= 0 ? [1, 1 - 0.05 * t, 1 - 0.16 * t] : [1 + 0.12 * t, 1 + 0.03 * t, 1];
  return base.map((x, i) => {
    const v = x * f[i];
    // Brillo: oscurece hacia el negro o aclara hacia el blanco
    return Math.max(0, Math.min(255, b <= 1 ? v * b : v + (255 - v) * (b - 1) * 1.4));
  });
}
function dsFondo() {
  const L = plLienzo;
  L.style.backgroundColor = "";
  const p = DS_FONDOS[DSU.fondo] || DS_FONDOS.tema,
    base = p[1] || (getComputedStyle(L).backgroundColor.match(/\d+/g) || [255, 255, 255]).slice(0, 3).map(Number);
  if (p[1] || DSU.calido || DSU.brillo !== 100) L.style.backgroundColor = plHex(dsFondoColor(base));
  plTema();
  plDibujar();
  dsFondoLista();
}
// Muestras de la ventanita del fondo
function dsFondoLista() {
  const L = $("fonLista");
  if (!L) return;
  const tema = (getComputedStyle(document.documentElement).getPropertyValue("--ws-doc") || "#ffffff").trim();
  L.innerHTML = Object.entries(DS_FONDOS)
    .map(
      ([k, [n, c]]) =>
        `<button type="button" data-fon="${k}"${DSU.fondo === k ? ' class="on"' : ""}><i style="background:${c ? plHex(c) : tema}"></i>${n}</button>`
    )
    .join("");
}
$("edFondo").addEventListener("click", e => {
  const b = e.target.closest("[data-fon]");
  if (!b) return;
  if (b.dataset.fon === "cerrar") return ($("edFondo").hidden = true);
  DSU.fondo = b.dataset.fon;
  dsGuardarPref();
  dsFondo();
});

/* ---------- Ventana de propiedades (doble clic en un elemento) ---------- */
const EL_VW = ventanaMovil(document.querySelector("#elDlg .vw"), "jmg-electric-propiedades", {
  w: 380,
  h: 560,
  minW: 320,
  minH: 260
});
let EL_ID = null;
function elAbrir(id) {
  const el = dsD() && dsD().els.find(e => e.id === id);
  if (!el) return;
  EL_ID = id;
  DS_SEL.clear();
  PL_ASEL.clear();
  DS_SEL.add(id);
  $("elDlg").hidden = false;
  vwFondo();
  EL_VW.abrir();
  edProps();
  plSobreDibujar();
  elRender();
}
function elCerrar() {
  $("elDlg").hidden = true;
  EL_ID = null;
  vwFondo();
}
function elRender() {
  if ($("elDlg").hidden) return;
  const sel = dsSel();
  if (sel.length !== 1 || sel[0].id !== EL_ID) return elCerrar();
  $("elT").textContent = dsNomEl(sel[0]);
  dsProps($("elC"));
}
$("elDlg").addEventListener("click", e => {
  if (e.target.id === "elDlg") return elCerrar();
  const b = e.target.closest("[data-el]");
  if (b && b.dataset.el === "cerrar") elCerrar();
  else if (b && b.dataset.el === "max") EL_VW.maximizar();
});
$("elDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    elCerrar();
  }
  e.stopPropagation();
});

/* ---------- Revisión del diseño ----------
   Avisos para un diseño profesional: lo que no está conectado, artefactos y tuberías sin circuito, circuitos con
   más salidas que el criterio, tuberías con más curvas que el criterio entre dos cajas o artefactos, tomacorrientes
   sin conductor de protección marcado, letras de encendido sin interruptor (o sin luminarias) y tableros sin
   circuitos. Los límites son criterios de la plataforma, editables en la ventana; verifíquelos con el CNE. */
const dsCrit = () => ({ sal: 12, cur: 360, ...((dsD() && dsD().crit) || {}) });
// Curvas de una tubería: suma de los cambios de dirección (en los vértices y en los arcos), en grados
function dsGiroTotal(el) {
  const P = dsCurva(el);
  let tot = 0,
    a0 = null;
  for (let i = 2; i < P.length; i += 2) {
    const dx = P[i] - P[i - 2],
      dy = P[i + 1] - P[i - 1];
    if (Math.hypot(dx, dy) < 1e-9) continue;
    const a = Math.atan2(dy, dx);
    if (a0 !== null) {
      let d = Math.abs(a - a0);
      if (d > Math.PI) d = 2 * Math.PI - d;
      tot += d;
    }
    a0 = a;
  }
  return (tot * 180) / Math.PI;
}
function dsVerificar() {
  const D = dsD(),
    out = [];
  if (!D) return out;
  const C = dsCrit(),
    por = new Map(D.els.map(e => [e.id, e])),
    sims = D.els.filter(dsConecta),
    tubs = D.els.filter(e => e.t === "tub" && dsVis(e)),
    s = (n, a, b) => `${n} ${n === 1 ? a : b}`,
    add = (nivel, t, ids, d) => ids.length && out.push({ nivel, t, ids, d });
  const sl = dsSueltos();
  add(
    "aviso",
    s(sl.sims.length, "artefacto sin tubería", "artefactos sin tubería"),
    sl.sims.map(e => e.id),
    "Conéctelos con una tubería a su circuito."
  );
  add(
    "aviso",
    s(sl.puntas.length, "punta de tubería suelta", "puntas de tubería sueltas"),
    [...new Set(sl.puntas.map(o => o.el.id))],
    "Llévelas a un artefacto, a una caja o a la salida del tablero."
  );
  const sinCir = [...sims.filter(e => !e.cir && !["can", "tie"].includes(DS_CAT[e.k].s)), ...tubs.filter(e => !e.cir)];
  add(
    "aviso",
    s(sinCir.length, "elemento sin circuito", "elementos sin circuito"),
    sinCir.map(e => e.id),
    "Empiece las tuberías en una salida del tablero: el circuito pasa solo a lo conectado."
  );
  // Salidas por circuito
  const grupos = new Map();
  sims.forEach(e => {
    if (!e.cir || ["can", "tie"].includes(DS_CAT[e.k].s)) return;
    const k = (e.tab || "") + "|" + e.cir;
    (grupos.get(k) || grupos.set(k, []).get(k)).push(e);
  });
  grupos.forEach((l, k) => {
    if (l.length <= C.sal) return;
    const tb = por.get(k.split("|")[0]);
    add(
      "aviso",
      `${l[0].cir}${tb && tb.nom ? " de " + tb.nom : ""}: ${l.length} salidas`,
      l.map(e => e.id),
      `Más de ${C.sal} salidas en un circuito (criterio): considere dividirlo.`
    );
  });
  // Curvas entre cajas
  tubs.forEach(t => {
    const g = dsGiroTotal(t);
    if (g > C.cur + 0.5)
      add(
        "aviso",
        `Tubería${t.cir ? " de " + t.cir : ""} con ${Math.round(g)}° de curvas`,
        [t.id],
        `Más de ${C.cur}° entre dos cajas o artefactos (criterio; verifique la regla del CNE): ponga una caja de paso.`
      ) && (out[out.length - 1].caja = t.id);
  });
  // Tomacorrientes sin conductor de protección marcado
  const sinT = tubs.filter(
    t =>
      t.cond &&
      !t.cond.t &&
      [t.c0, t.c1].some(id => por.get(id) && DS_CAT[por.get(id).k] && DS_CAT[por.get(id).k].g === "Tomacorrientes")
  );
  add(
    "aviso",
    s(
      sinT.length,
      "tubería de tomacorrientes sin conductor de protección",
      "tuberías de tomacorrientes sin conductor de protección"
    ),
    sinT.map(e => e.id),
    "Marque la tierra (T) en sus conductores."
  );
  // Encendidos
  const luz = new Map(),
    intr = new Map();
  D.els.forEach(e => {
    if (!e.enc || !dsConEnc(e)) return;
    const m = DS_CAT[e.k].g === "Interruptores" ? intr : luz;
    (m.get(e.enc) || m.set(e.enc, []).get(e.enc)).push(e);
  });
  luz.forEach((l, k) => {
    if (!intr.has(k))
      add(
        "aviso",
        `Encendido «${k}» sin interruptor`,
        l.map(e => e.id),
        `Ponga la letra «${k}» al interruptor que enciende estas luminarias.`
      );
  });
  intr.forEach((l, k) => {
    if (!luz.has(k))
      add(
        "info",
        `Interruptor «${k}» sin luminarias`,
        l.map(e => e.id),
        `Ninguna luminaria tiene la letra «${k}».`
      );
  });
  // Tableros
  D.els.forEach(tb => {
    if (tb.k !== "tab" || !dsVis(tb)) return;
    if (!tb.nc)
      return add(
        "aviso",
        `${tb.nom || "Tablero"} sin circuitos`,
        [tb.id],
        "Doble clic en el tablero para definir sus circuitos."
      );
    const usados = new Set(tubs.filter(t => t.c0 === tb.id).map(t => t.cir)),
      libres = dsSalidasTab(tb)
        .filter(o => !usados.has(o.n))
        .map(o => o.n);
    if (libres.length)
      add(
        "info",
        `${tb.nom || "Tablero"}: ${libres.join(", ")} sin tubería`,
        [tb.id],
        "Salidas del tablero que aún no tienen tubería (o reservas)."
      );
  });
  // Tuberías sin conductores indicados
  const sinCond = tubs.filter(t => !t.cond);
  add(
    "info",
    s(sinCond.length, "tubería sin conductores indicados", "tuberías sin conductores indicados"),
    sinCond.map(e => e.id),
    "Clic en el medio de la tubería para elegir sus conductores."
  );
  dpVerificar(add);
  return out;
}
const REV_VW = ventanaMovil(document.querySelector("#revDlg .vw"), "jmg-electric-revision", {
  w: 620,
  h: 520,
  minW: 420,
  minH: 280
});
let REV_L = [];
function revAbrir() {
  if (!dsD()) return;
  $("revDlg").hidden = false;
  vwFondo();
  REV_VW.abrir();
  revRender();
}
function revCerrar() {
  $("revDlg").hidden = true;
  vwFondo();
}
function revRender() {
  if ($("revDlg").hidden) return;
  const C = dsCrit();
  $("revSal").value = C.sal;
  $("revCur").value = C.cur;
  REV_L = dsVerificar();
  const av = REV_L.filter(o => o.nivel === "aviso").length;
  $("revLista").innerHTML = REV_L.length
    ? REV_L.map(
        (o, i) =>
          `<div class="rev-it ${o.nivel}"><i>${o.nivel === "aviso" ? "⚠" : "ℹ"}</i><span>${esc(o.t)}<small>${esc(o.d)}</small></span><span class="pla-b">${o.caja ? `<button type="button" class="vw-btn" data-revc="${o.caja}" title="Parte la tubería en el medio de su recorrido con una caja de paso">Poner caja</button>` : ""}<button type="button" class="vw-btn" data-revi="${i}" title="Elige y muestra estos elementos">Ver</button></span></div>`
      ).join("")
    : '<p class="rev-ok">✓ Sin observaciones: el diseño está conectado y completo.</p>';
  $("revNota").textContent = REV_L.length
    ? `${av} aviso${av === 1 ? "" : "s"} · ${REV_L.length - av} nota${REV_L.length - av === 1 ? "" : "s"}`
    : "";
}
$("revDlg").addEventListener("click", e => {
  if (e.target.id === "revDlg") return revCerrar();
  const b = e.target.closest("[data-rev]"),
    v = e.target.closest("[data-revi]");
  if (b && b.dataset.rev === "cerrar") return revCerrar();
  const pc = e.target.closest("[data-revc]");
  if (pc) {
    dpPonerCaja(pc.dataset.revc);
    return revRender();
  }
  if (b && b.dataset.rev === "max") return REV_VW.maximizar();
  if (v) {
    const o = REV_L[+v.dataset.revi];
    revCerrar();
    DS_SEL.clear();
    PL_ASEL.clear();
    o.ids.forEach(id => DS_SEL.add(id));
    const bb = dsSel().map(dsBBox);
    if (bb.length) {
      const x0 = Math.min(...bb.map(q => q[0])),
        y0 = Math.min(...bb.map(q => q[1])),
        x1 = Math.max(...bb.map(q => q[2])),
        y1 = Math.max(...bb.map(q => q[3])),
        m = Math.max(x1 - x0, y1 - y0, 2 / EPL.f) * 0.35;
      plVer(x0 - m, y0 - m, x1 + m, y1 + m);
    }
    edProps();
    plSobreDibujar();
  }
});
$("revDlg").addEventListener("change", e => {
  if (e.target.id !== "revSal" && e.target.id !== "revCur") return;
  const D = dsD(),
    C = dsCrit();
  D.crit = {
    sal: Math.max(1, Math.min(100, Math.round(+$("revSal").value) || C.sal)),
    cur: Math.max(90, Math.min(720, +$("revCur").value || C.cur))
  };
  edCambio();
  revRender();
});
$("revDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    revCerrar();
  }
  e.stopPropagation();
});

/* ---------- Biblioteca de símbolos: todos los de la Norma DGE, por grupos, con buscador y los usados hace poco ---------- */
const BI_VW = ventanaMovil(document.querySelector("#bibDlg .vw"), "jmg-electric-biblioteca", {
  w: 860,
  h: 600,
  minW: 520,
  minH: 340
});
const BI_REC = "jmg-electric-simbolos-recientes";
let BI_GRUPO = "";
const biRecientes = () => {
  try {
    return (JSON.parse(localStorage.getItem(BI_REC) || "[]") || []).filter(k => DS_CAT[k]).slice(0, 12);
  } catch (e) {
    return [];
  }
};
function biUsado(k) {
  if (!DS_CAT[k]) return;
  try {
    localStorage.setItem(BI_REC, JSON.stringify([k, ...biRecientes().filter(x => x !== k)].slice(0, 12)));
  } catch (e) {}
}
// Texto para buscar sin tildes ni mayúsculas
const biNorm = s =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const BI_SIS = {
  alu: "alumbrado",
  tom: "tomacorrientes",
  fza: "fuerza",
  tab: "tableros",
  com: "comunicaciones telecomunicaciones",
  can: "canalizacion",
  tie: "tierra"
};
function bibAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("bibDlg").hidden = false;
  vwFondo();
  BI_VW.abrir();
  $("biBusca").value = "";
  bibRender();
  setTimeout(() => $("biBusca").focus(), 30);
}
function bibCerrar() {
  $("bibDlg").hidden = true;
  vwFondo();
}
// Claves que cumplen la búsqueda (todas las palabras, en el nombre, el código, el grupo o el sistema)
function biBuscar(q) {
  const pal = biNorm(q).split(/\s+/).filter(Boolean);
  return Object.keys(DS_CAT).filter(k => {
    const c = DS_CAT[k],
      t = biNorm(`${c.n} ${c.c} ${c.g} ${BI_SIS[c.s] || ""} ${k}`);
    return pal.every(p => t.includes(p));
  });
}
function bibRender() {
  if ($("bibDlg").hidden) return;
  const q = $("biBusca").value.trim(),
    todas = biBuscar(q),
    rec = q ? [] : biRecientes(),
    cuenta = g => todas.filter(k => DS_CAT[k].g === g).length;
  if (BI_GRUPO && BI_GRUPO !== "rec" && !cuenta(BI_GRUPO)) BI_GRUPO = "";
  if (BI_GRUPO === "rec" && !rec.length) BI_GRUPO = "";
  $("biGrupos").innerHTML =
    `<button type="button" data-big=""${BI_GRUPO ? "" : ' class="on"'}>Todos<i>${todas.length}</i></button>` +
    (rec.length
      ? `<button type="button" data-big="rec"${BI_GRUPO === "rec" ? ' class="on"' : ""}>Usados hace poco<i>${rec.length}</i></button>`
      : "") +
    (dpBloques().length
      ? `<button type="button" data-big="blq"${BI_GRUPO === "blq" ? ' class="on"' : ""}>Mis bloques<i>${dpBloques().length}</i></button>`
      : "") +
    DS_GRUPOS.map(g => {
      const n = cuenta(g);
      return n
        ? `<button type="button" data-big="${esc(g)}"${BI_GRUPO === g ? ' class="on"' : ""}>${esc(g)}<i>${n}</i></button>`
        : "";
    }).join("");
  const tarjeta = k =>
      `<div class="bi-s" role="button" tabindex="0" data-bik="${k}" title="${esc(DS_CAT[k].n)} · Norma DGE ${DS_CAT[k].c}">${dsSimb(k) ? '<i class="bi-crit">criterio</i>' : ""}<button type="button" class="bi-ed" data-bie="${k}" title="Editar este símbolo (criterio del proyectista)" aria-label="Editar este símbolo">✎</button>${dsIcono(k)}<b>${esc(DS_CAT[k].n)}</b><small>${DS_CAT[k].c}</small></div>`,
    bloque = (tit, ks) =>
      ks.length ? `<h4>${esc(tit)}</h4><div class="bi-lista">${ks.map(tarjeta).join("")}</div>` : "";
  let h;
  if (BI_GRUPO === "blq") h = dpTarjetasBloques("");
  else if (BI_GRUPO === "rec") h = bloque("Usados hace poco", rec);
  else if (BI_GRUPO)
    h = bloque(
      BI_GRUPO,
      todas.filter(k => DS_CAT[k].g === BI_GRUPO)
    );
  else
    h =
      bloque("Usados hace poco", rec) +
      dpTarjetasBloques(q) +
      DS_GRUPOS.map(g =>
        bloque(
          g,
          todas.filter(k => DS_CAT[k].g === g)
        )
      ).join("");
  $("biRejilla").innerHTML =
    h ||
    `<p class="bi-vacio">Ningún símbolo coincide con «${esc(q)}». Pruebe con otra palabra o con el código de la norma.</p>`;
  $("biN").textContent = q ? `${todas.length} de ${Object.keys(DS_CAT).length} símbolos` : `${todas.length} símbolos`;
}
// Elige un símbolo: se cierra la ventana y queda listo para colocarlo
function bibElegir(k) {
  if (!DS_CAT[k]) return;
  biUsado(k);
  bibCerrar();
  DS_SEL.clear();
  plHerr("col:" + k);
}
$("biBusca").addEventListener("input", () => {
  BI_GRUPO = "";
  bibRender();
  $("biRejilla").scrollTop = 0;
});
$("bibDlg").addEventListener("click", e => {
  if (e.target.id === "bibDlg") return bibCerrar();
  const s = e.target.closest("[data-bik]"),
    g = e.target.closest("[data-big]"),
    b = e.target.closest("[data-bi]"),
    ed = e.target.closest("[data-bie]"),
    bx = e.target.closest("[data-blqx]"),
    bq = e.target.closest("[data-blq]");
  if (ed) return siAbrir(ed.dataset.bie);
  if (bx) {
    const L = dpBloques(),
      n = L[+bx.dataset.blqx] && L[+bx.dataset.blqx].n;
    L.splice(+bx.dataset.blqx, 1);
    dpGuardarBloques(L);
    toast(`Bloque «${n}» eliminado`);
    return bibRender();
  }
  if (bq) return dpUsarBloque(+bq.dataset.blq);
  if (s) return bibElegir(s.dataset.bik);
  if (g) {
    BI_GRUPO = g.dataset.big;
    bibRender();
    $("biRejilla").scrollTop = 0;
  } else if (b && b.dataset.bi === "cerrar") bibCerrar();
  else if (b && b.dataset.bi === "max") BI_VW.maximizar();
});
$("bibDlg").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    bibCerrar();
  } else if (e.key === "Enter" && e.target.id === "biBusca") {
    e.preventDefault();
    const p = $("biRejilla").querySelector("[data-bik]");
    if (p) bibElegir(p.dataset.bik);
  } else if (e.key === "Enter" && e.target.dataset && e.target.dataset.bik) {
    e.preventDefault();
    bibElegir(e.target.dataset.bik);
  } else if (e.key === "ArrowDown" && e.target.id === "biBusca") {
    e.preventDefault();
    const p = $("biRejilla").querySelector("[data-bik]");
    if (p) p.focus();
  }
  e.stopPropagation();
});

/* ---------- Ventana Tablero (doble clic en un tablero): nombre y circuitos, que salen del tablero como C-1, C-2… ---------- */
const TA_VW = ventanaMovil(document.querySelector("#tabDlg .vw"), "jmg-electric-tablero", {
  w: 460,
  h: 520,
  minW: 380,
  minH: 300
});
let TA_ID = null;
function tabAbrir(id) {
  const el = dsD() && dsD().els.find(e => e.id === id);
  if (!el || el.k !== "tab") return;
  TA_ID = id;
  $("taNom").value = el.nom || "";
  $("taN").value = el.nc || 6;
  tabLista(el.cd || []);
  $("tabDlg").hidden = false;
  vwFondo();
  TA_VW.abrir();
  setTimeout(() => {
    $("taN").focus();
    $("taN").select();
  }, 30);
}
function tabCerrar() {
  $("tabDlg").hidden = true;
  TA_ID = null;
  vwFondo();
}
// Lista de circuitos con su descripción (opcional), según el número elegido
function tabLista(cd) {
  const n = Math.max(1, Math.min(60, Math.round(+$("taN").value) || 1)),
    prev = [...$("taLista").querySelectorAll("input")].map(i => i.value),
    d = cd || prev;
  $("taLista").innerHTML = Array.from(
    { length: n },
    (v, i) =>
      `<label class="ta-fila"><b>C-${i + 1}</b><input type="text" maxlength="60" value="${esc(d[i] || "")}" placeholder="Descripción (opcional): alumbrado, tomacorrientes…"></label>`
  ).join("");
  const el = dsD().els.find(e => e.id === TA_ID),
    usados = dsD()
      .els.filter(e => e.t === "tub" && e.tab === TA_ID && e.cir && parseInt(e.cir.slice(2), 10) > n)
      .map(e => e.cir);
  $("taNota").textContent = usados.length
    ? `Atención: hay tuberías conectadas a ${[...new Set(usados)].join(", ")}, que dejarían de existir.`
    : el && el.nc
      ? "Las salidas aparecen al frente del tablero; las tuberías que empiezan en una salida toman su circuito."
      : "Al aceptar, el tablero muestra sus salidas C-1, C-2…: empiece cada tubería en la suya.";
}
function tabAceptar() {
  const el = dsD() && dsD().els.find(e => e.id === TA_ID);
  if (!el) return tabCerrar();
  const n = Math.max(1, Math.min(60, Math.round(+$("taN").value) || 1)),
    cd = [...$("taLista").querySelectorAll("input")]
      .slice(0, n)
      .map(i => i.value.replace(/[<>]/g, "").trim().slice(0, 60));
  while (cd.length && !cd[cd.length - 1]) cd.pop();
  el.nom = $("taNom").value.replace(/[<>]/g, "").trim().slice(0, 20) || el.nom || "TG";
  el.nc = n;
  if (cd.length) el.cd = cd;
  else delete el.cd;
  tabCerrar();
  edCambio();
  toast(`${el.nom}: ${n} circuito${n > 1 ? "s" : ""} (C-1 a C-${n}). Empiece cada tubería en su salida`);
}
$("taN").addEventListener("input", () => tabLista());
$("tabDlg").addEventListener("click", e => {
  if (e.target.id === "tabDlg") return tabCerrar();
  const b = e.target.closest("[data-ta]");
  if (!b) return;
  const a = b.dataset.ta;
  if (a === "ok") tabAceptar();
  else if (a === "cerrar") tabCerrar();
  else if (a === "max") TA_VW.maximizar();
  else if (a === "mas" || a === "menos") {
    $("taN").value = Math.max(1, Math.min(60, (+$("taN").value || 0) + (a === "mas" ? 1 : -1)));
    tabLista();
  }
});
$("tabDlg").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    tabAceptar();
  } else if (e.key === "Escape") {
    e.preventDefault();
    tabCerrar();
  }
  e.stopPropagation();
});
