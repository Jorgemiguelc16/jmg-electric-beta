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
  dir: "Directriz"
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
  ref: { fin: true, med: true, cen: true, ins: true, cer: true, per: true, int: true },
  sens: 12,
  alinear: true,
  curva: true
};
try {
  const g = JSON.parse(localStorage.getItem("jmg-electric-editor-rejilla") || "{}");
  Object.assign(DSU, g, { ref: { ...DSU.ref, ...(g.ref || {}) } });
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
  g.save();
  g.translate(X, Y);
  g.rotate(-rot);
  g.scale(u, u);
  g.lineCap = "round";
  for (const p of dsPrims(k)) {
    const a = p.a,
      fi = !p.fi || p.fi === "none" ? null : /^#fff(fff)?$/i.test(p.fi) ? fondo : p.fi === INK_S ? col : p.fi,
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
      const mov = dt && dsEsLetra(k, p) ? dt : [0, 0],
        w = a[2] * 0.6 * p.tx.length,
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
      g.fillText(p.tx, 0, 0);
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

/* ---------- Geometría: rectángulo, toque y puntos de enganche de cada elemento ---------- */
// De unidades del símbolo (y hacia abajo) al dibujo, con el giro del elemento
function dsAMundo(el, a, b) {
  const u = dsU(),
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
function dsBBox(el) {
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
function dsHit(x, y, r) {
  const D = dsD();
  if (!D) return null;
  // Se recorre desde el final: los símbolos y textos van al final para revisarse primero
  const orden = [
    ...D.els.filter(el => el.t !== "sim" && el.t !== "txt"),
    ...D.els.filter(el => el.t === "sim" || el.t === "txt")
  ];
  for (let i = orden.length - 1; i >= 0; i--) {
    const el = orden[i];
    if (!dsEditable(el)) continue;
    if (el.t === "sim") {
      const u = dsU(),
        rr = ((el.r || 0) * Math.PI) / 180,
        wx = (x - el.x) / u,
        wy = (y - el.y) / u,
        a = wx * Math.cos(rr) + wy * Math.sin(rr),
        b = wx * Math.sin(rr) - wy * Math.cos(rr),
        bb = dsBBs(el.k),
        t = r / u;
      if (a >= bb[0] - t && a <= bb[2] + t && b >= bb[1] - t && b <= bb[3] + t) return el.id;
    } else if (el.t === "txt") {
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
    if (el.t === "sim" || el.t === "txt") {
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
  for (const el of D.els) {
    if (!dsVis(el)) continue;
    // Color propio del elemento o, si no tiene, el de su capa
    const cap = dsCapaDe(el),
      col = plColorDis(el.col || cap.col);
    if (el.t === "sim") {
      const [X, Y] = plAPant(el.x, el.y);
      if (X < -40 * u || X > W + 40 * u || Y < -40 * u || Y > H + 40 * u) continue;
      if (u * 17 < 2.5) {
        g.fillStyle = col;
        g.fillRect(X - 1, Y - 1, 2, 2);
        continue;
      }
      dsDibSim(g, el.k, X, Y, ((el.r || 0) * Math.PI) / 180, u, col, PL_FONDO, dsGrosor(cap), el.dt);
      if (el.k === "tab") dsDibSalidas(g, el, col, u, dsGrosor(cap));
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
    } else if (el.t === "cot") dsDibCota(g, el, col, s, dsGrosor(cap));
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
      if (el.t === "tub" && D.etq !== "no") dsEtiquetasTub(g, el, col, s);
    }
  }
  g.restore();
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
        sep = ht * 0.5 + dsMm(0.8),
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
  else if (T.length) etq(T[Math.floor((T.length - 1) / 2)], `${fmt(dsLargo(el) * EPL.f, 2)} m`);
}
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
    g.fillStyle = col;
    g.fillText(o.n, 0, 0);
    g.restore();
  });
  // Nombre del tablero a un costado
  if (el.nom && 4 * u >= 5) {
    dsPrims("tab");
    const [xn, yn] = aPant(DS_BB.tab[2] + 2.5, 0);
    g.save();
    g.translate(xn, yn);
    g.rotate(dsLegible(-rot));
    g.font = `700 ${(4 * u) / 0.72}px Arial, sans-serif`;
    g.textAlign = Math.cos(rot) >= 0 ? "left" : "right";
    g.textBaseline = "middle";
    g.fillStyle = col;
    g.fillText(el.nom, 0, 0);
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
  else if (PL_OSCURO && l < 0.25) v = v.map(x => x + (210 - x) * 0.6);
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
    if (PLH.libre) a = Math.round(a / 15) * 15;
    el.r = Math.round((((a % 360) + 360) % 360) * 100) / 100;
  } else if (ag.t === "letra") {
    // Corrimiento de la letra en unidades del símbolo: el punto q llevado a las coordenadas del símbolo
    const p = dsPrims(el.k).find(x => dsEsLetra(el.k, x)),
      u = dsU(),
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
    u = dsU(),
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
    const sel = DS_SEL.has(el.id);
    g.strokeStyle = selc;
    g.globalAlpha = sel ? 1 : 0.55;
    g.lineWidth = (sel ? 1.5 : 1.2) * d;
    g.setLineDash([5 * d, 3 * d]);
    if (el.t === "sim" || el.t === "txt") {
      const b = dsBBox(el),
        [a, c] = plAPant(b[0], b[3]),
        [e, f] = plAPant(b[2], b[1]),
        m = 3 * d;
      g.strokeRect(a - m, c - m, e - a + 2 * m, f - c + 2 * m);
    } else {
      g.beginPath();
      dsLineas(el).forEach(p => plRuta(g, p, false));
      g.stroke();
    }
    g.setLineDash([]);
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
      dsU() * PLV.s,
      plColorDis(dsCapa(DS_SIS[DS_CAT[k].s].capa).col),
      PL_FONDO
    );
    g.globalAlpha = 1;
  }
  // Trazo en curso
  const h = PLH.h;
  if (DS_HERR[h] && PLH.pts.length && q) {
    const pts = PLH.pts,
      capa = dsCapaPara(h),
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
const dsEsHerr = h => !!h && (h.startsWith("col:") || !!DS_HERR[h]);
function dsOrden(h, n) {
  const libre = ` · <span class="pl-k">Mayús</span> sin enganche`;
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
    dir: n ? "Dónde va el texto" : "Punta de la flecha"
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
// Termina la polilínea o la tubería en curso (Intro, doble clic o Esc)
function dsTerminar() {
  const h = PLH.h;
  if (!(h === "pol" || dsEsTub(h)) || PLH.pts.length < 2) {
    if (h === "pol" || dsEsTub(h)) {
      PLH.pts = [];
      PLH.bul = [];
      PLH.cirIni = null;
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
      el.tab = PLH.cirIni.tab;
    }
  }
  dsAgregar(el);
  PLH.pts = [];
  PLH.bul = [];
  PLH.cirIni = null;
  edCambio();
  plOrden();
  return true;
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
  plDibujar();
}
function dsSoltar() {
  const a = PLH.arr;
  PLH.arr = null;
  if (a.mov) return edCambio();
  // Clic sin mover sobre un elemento de una selección múltiple: queda solo ese
  if (!a.suma && DS_SEL.size > 1) {
    DS_SEL.clear();
    DS_SEL.add(a.id);
  }
  edProps();
  plSobreDibujar();
}
// Mueve lo seleccionado con las flechas del teclado: 1 cm, o 10 cm con Mayús
function dsEmpujar(dx, dy, grande) {
  const sel = dsSel().filter(dsEditable);
  if (!sel.length) return false;
  const l = (grande ? 0.1 : 0.01) / EPL.f;
  sel.forEach(el => dsTrasladar(el, dx * l, dy * l));
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
function dsGirar() {
  if (PLH.h && PLH.h.startsWith("col:")) {
    PLH.rot = (PLH.rot + 90) % 360;
    return plSobreDibujar();
  }
  const sel = dsSel().filter(dsEditable);
  if (!sel.length) return;
  // Los símbolos y textos giran sobre su punto; lo demás, sobre el centro de la selección
  const b = sel.map(dsBBox),
    cx = (Math.min(...b.map(x => x[0])) + Math.max(...b.map(x => x[2]))) / 2,
    cy = (Math.min(...b.map(x => x[1])) + Math.max(...b.map(x => x[3]))) / 2,
    rot = (x, y) => [cx - (y - cy), cy + (x - cx)];
  sel.forEach(el => {
    if (el.t === "sim" || el.t === "txt") el.r = ((el.r || 0) + 90) % 360;
    else if (el.t === "cir") [el.x, el.y] = sel.length > 1 ? rot(el.x, el.y) : [el.x, el.y];
    else if (el.t === "cot") {
      el.a = rot(...el.a);
      el.b = rot(...el.b);
      if (el.modo !== "alin") el.modo = el.modo === "h" ? "v" : "h";
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
  DS_PORTA.forEach(o => {
    const el = JSON.parse(JSON.stringify(o));
    dsTrasladar(el, q[0] - cx, q[1] - cy);
    dsCapa(el.capa);
    DS_SEL.add(dsAgregar(el).id);
  });
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
    acciones = `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="girar">Girar 90°</button><button type="button" class="btn sec sm" data-dsa="copiar">Copiar</button><button type="button" class="btn sec sm ed-del" data-dsa="borrar">Borrar</button></div>`,
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
      (tub ? campo("Circuito", circ(el.cir)) + lista : "") +
      `<p class="ds-crit ds-crit0">Arrastre el rombo del medio de un tramo para curvarlo; los cuadrados mueven los vértices.</p>` +
      curvas;
  }
  const color = `<label class="ed-pf ed-pc"><span>Color</span><span class="ds-colr"><input type="color" data-dsp="col" value="${el.col || cap.col}" title="Color propio de este elemento"><button type="button" class="btn sec sm" data-dsa="colcapa"${el.col ? "" : " disabled"} title="Vuelve al color de su capa">Por capa</button></span></label>`,
    letra = el.dt
      ? `<div class="ed-pb"><button type="button" class="btn sec sm" data-dsa="letra0">Letra a su lugar</button></div>`
      : "";
  c.innerHTML = h + color + letra + (cap.bloq ? `<p class="pl-nota">La capa está bloqueada.</p>` : "") + acciones;
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
        dir: "Directriz"
      }[t] || t;
$("edPropC").addEventListener("change", e => {
  const f = e.target.closest("[data-dsp]");
  if (!f || !DS_SEL.size) return;
  const k = f.dataset.dsp,
    v = f.value.trim();
  dsSel().forEach(el => {
    if (k === "capa") {
      if (v) el.capa = v;
    } else if (k === "r") el.r = Math.round(((((parseFloat(v) || 0) % 360) + 360) % 360) * 100) / 100;
    else if (k === "col") el.col = /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : el.col;
    else if (k === "h") el.h = v === "" ? undefined : Math.max(0, parseFloat(v) || 0);
    else if (k === "p") el.p = v === "" ? undefined : Math.max(0, parseFloat(v) || 0);
    else if (k === "cir") el.cir = v.replace(/[<>]/g, "").slice(0, 12) || undefined;
    else if (k === "s") el.s = v.replace(/[<>]/g, "").slice(0, 200) || el.s;
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
});
$("edPropC").addEventListener("click", e => {
  const b = e.target.closest("[data-dsa]");
  if (!b) return;
  const a = b.dataset.dsa;
  if (a === "girar") dsGirar();
  else if (a === "colcapa" || a === "letra0") {
    dsSel().forEach(el => delete el[a === "colcapa" ? "col" : "dt"]);
    edCambio();
  } else if (a === "borrar") edBorrar(false);
  else if (a === "copiar") {
    dsCopiar();
    dsPegar();
  } else if (a === "tablero") tabAbrir(dsSel()[0].id);
  else dsCurvar(a);
});

/* ---------- Resumen del diseño (panel izquierdo): cuántos hay de cada cosa; un clic los selecciona ---------- */
function dsResumen() {
  const D = dsD(),
    box = $("dsResumen");
  if (!D || !PL_MOD) {
    box.innerHTML = "";
    $("dsN").textContent = "";
    return;
  }
  const cuenta = {},
    largo = {};
  D.els.forEach(el => {
    const t = dsTipo(el);
    cuenta[t] = (cuenta[t] || 0) + 1;
    if (el.t === "tub") largo[t] = (largo[t] || 0) + dsLargo(el);
  });
  $("dsN").textContent = D.els.length || "";
  const orden = [...Object.keys(DS_CAT), "tub-techo", "tub-piso", "lin", "cir", "txt", "cot", "dir"].filter(
    t => cuenta[t]
  );
  box.innerHTML = orden.length
    ? orden
        .map(
          t =>
            `<button type="button" class="ds-fila" data-dst="${t}" title="Seleccionar todos">${DS_CAT[t] ? dsIcono(t) : `<i class="ds-ico ds-lin${t === "tub-piso" ? " piso" : ""}"></i>`}<span>${dsNomTipo(t)}</span><em>${largo[t] ? plFm(largo[t]) + " m" : cuenta[t]}</em></button>`
        )
        .join("")
    : `<p class="pl-nota">Coloque luminarias, interruptores, tomacorrientes, tableros y tuberías desde las pestañas <b>Insertar</b> y <b>Dibujo</b>. Aquí verá cuántos hay de cada uno y los metros de tubería.</p>`;
}
$("dsResumen").addEventListener("click", e => {
  const b = e.target.closest("[data-dst]");
  if (b) dsSelTipo(b.dataset.dst);
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
  $("dsTrazo").value = DSU.curva ? "curvo" : "recto";
  document.querySelectorAll("[data-edtg]").forEach(b => {
    const v = b.dataset.edtg;
    b.setAttribute("aria-pressed", v === "rej" ? DSU.rej : v === "forz" ? DSU.forz : $(v).checked);
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
    toast(`${cual === "rej" ? "Rejilla" : "Forzar cursor a la rejilla"} ${DSU[cual] ? "activado" : "desactivado"}`);
  plDibujar();
}
$("dsRej").addEventListener("change", () => dsAlternarRejilla("rej"));
$("dsForz").addEventListener("change", () => dsAlternarRejilla("forz"));
$("dsPaso").addEventListener("change", e => {
  DSU.paso = DS_PASOS.includes(+e.target.value) ? +e.target.value : 0.5;
  dsGuardarPref();
  plDibujar();
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
    DS_GRUPOS.map(g => {
      const n = cuenta(g);
      return n
        ? `<button type="button" data-big="${esc(g)}"${BI_GRUPO === g ? ' class="on"' : ""}>${esc(g)}<i>${n}</i></button>`
        : "";
    }).join("");
  const tarjeta = k =>
      `<button type="button" class="bi-s" data-bik="${k}" title="${esc(DS_CAT[k].n)} · Norma DGE ${DS_CAT[k].c}">${dsIcono(k)}<b>${esc(DS_CAT[k].n)}</b><small>${DS_CAT[k].c}</small></button>`,
    bloque = (tit, ks) =>
      ks.length ? `<h4>${esc(tit)}</h4><div class="bi-lista">${ks.map(tarjeta).join("")}</div>` : "";
  let h;
  if (BI_GRUPO === "rec") h = bloque("Usados hace poco", rec);
  else if (BI_GRUPO)
    h = bloque(
      BI_GRUPO,
      todas.filter(k => DS_CAT[k].g === BI_GRUPO)
    );
  else
    h =
      bloque("Usados hace poco", rec) +
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
    b = e.target.closest("[data-bi]");
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
