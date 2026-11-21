/* DISEÑO ELÉCTRICO EN EL EDITOR (etapa 2 del diseño en planta)
   Los elementos que el proyectista dibuja sobre el plano de arquitectura, guardados en la copia del editor como
   EPL.dis = { capas, actual, els, escala, etq } (se guardan solos en el proyecto, en PLANO.dis):
   - símbolos de la Norma DGE «Símbolos gráficos en electricidad» (R.M. N.° 091-2002-EM/VME), los mismos de las
     láminas (simboloDGE() en js/planos/simbolos.js), cada uno con su código, en la capa de su sistema, con rotación,
     altura de montaje, potencia y circuito; los que van en la pared se encajan solos en el muro más cercano;
   - tuberías por techo o pared (línea continua) o por piso (línea discontinua), con tramos rectos o curvos (como
     se dibujan en los planos) y su longitud real, la del arco; se muestran sus longitudes si se pide;
   - líneas, polilíneas, rectángulos y círculos en la capa actual; textos, cotas (alineadas y lineales) y
     directrices en sus capas;
   - capas propias del diseño con color, tipo de línea, visibilidad y bloqueo (Administrador de capas, js/editor/capas.js).
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
  dib: { capa: "E-DIBUJO", col: "#37474f", n: "Dibujo" },
  are: { capa: "E-AREAS", col: "#8d6e63", n: "Áreas para el cálculo" }
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
    ["emer", "Luminaria de alumbrado de emergencia", "09-93-67", "alu", 0, "hBraq", "al_p", "W"],
    ["emerB", "Bloque autónomo de alumbrado de emergencia", "09-93-68", "alu", 0, "hBraq", "al_p", "W", "abajo"],
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
    ["med3", "Medidor de energía trifásico", "08-80-22 · 3∼", "tab", 5, "hMed", null, null, "abajo"],
    ["bmed", "Banco de medidores", "criterio", "tab", 5, "hMed", null, null, "abajo"],
    ["caja", "Caja, símbolo general (caja de paso)", "09-93-08", "can", 6, null],
    ["cajaCuad", "Caja de paso cuadrada", "criterio", "can", 6, null],
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
// Cajas de paso: llevan su número (CP-1, CP-2…) y pueden ser el arranque de un montante
const DS_CAJAS = new Set(["caja", "cajaCuad"]);
// Referencia del símbolo: su código de la Norma DGE o, si la norma no lo tiene, que es criterio del proyectista
const dsCodTxt = k =>
  DS_CAT[k] && DS_CAT[k].c !== "criterio" ? `Norma DGE ${DS_CAT[k].c}` : "Sin símbolo en la Norma DGE · criterio";
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
/* Tubería a interruptor (uno de sus extremos es un interruptor): con su color propio, para distinguirla (criterio del
   proyectista, se quita en Vista; se guarda en el diseño: D.intCol === false la deja con el color de siempre) */
const DS_COL_INT = "#e8730c";
let DS_TINT = null;
function dsTubInt(el) {
  const D = dsD();
  if (!D || el.t !== "tub" || D.intCol === false || (!el.c0 && !el.c1)) return false;
  if (!DS_TINT || DS_TINT.D !== D || DS_TINT.v !== DS_IDXV || DS_TINT.n !== D.els.length) {
    const ints = new Set(D.els.filter(dsEsInt).map(s => s.id));
    DS_TINT = {
      D,
      v: DS_IDXV,
      n: D.els.length,
      s: new Set(D.els.filter(t => t.t === "tub" && (ints.has(t.c0) || ints.has(t.c1))).map(t => t.id))
    };
  }
  return DS_TINT.s.has(el.id);
}
const dsColorEl = (el, cap) =>
  el.col ||
  (el.t === "tub" && dsTubInt(el) && DS_COL_INT) ||
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
  cua: "Cuadro de circuitos",
  areaC: "Área de un ambiente (clic adentro)",
  areaE: "Contorno exterior del piso (clic adentro)",
  areaP: "Área por puntos",
  areaR: "Área rectangular"
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
