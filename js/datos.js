/* DATOS EDITABLES Y AYUDAS
   Valores por defecto, listas editables (cargas especiales de la vivienda y de los departamentos, pisos,
   departamentos, servicios, luminarias y tomacorrientes de otra potencia), sus formularios (renderList/readList) y los textos de ayuda (HLP)
   que aparecen al pasar el cursor sobre cada dato. */
const DEF = {
  cargas: [
    { nombre: "Ducha eléctrica", tipo: "calentador", fases: 1, p: 3500, L: 12 },
    { nombre: "Electrobomba 1 HP", tipo: "motor", fases: 1, p: 750, L: 18 },
    { nombre: "Horno eléctrico", tipo: "otra", fases: 1, p: 2000, L: 10 }
  ],
  tipos: [
    { nombre: "Tipo A", cant: 6, area: 85, nAl: 12, nTo: 14, Ld: 25, Lc: 15 },
    { nombre: "Tipo B", cant: 2, area: 120, nAl: 16, nTo: 20, Ld: 32, Lc: 18 }
  ],
  // Cargas especiales de los departamentos: dep = índice del tipo de departamento
  cargasT: [
    { nombre: "Terma eléctrica", tipo: "calentador", p: 1500, L: 15, dep: 0 },
    { nombre: "Ducha eléctrica", tipo: "calentador", p: 3500, L: 18, dep: 1 },
    { nombre: "Horno eléctrico", tipo: "otra", p: 2000, L: 18, dep: 1 }
  ],
  serv: [
    { nombre: "Alumbrado de áreas comunes", tipo: "alum", fases: 1, p: 800, L: 30 },
    { nombre: "Iluminación de emergencia", tipo: "alum", fases: 1, p: 150, L: 30 },
    { nombre: "Electrobomba de agua 2 HP", tipo: "motor", fases: 3, p: 1492, L: 20 },
    { nombre: "Intercomunicador y portero", tipo: "otra", fases: 1, p: 200, L: 10 }
  ]
};
const cargas = JSON.parse(JSON.stringify(DEF.cargas)),
  tipos = JSON.parse(JSON.stringify(DEF.tipos)),
  cargasT = JSON.parse(JSON.stringify(DEF.cargasT)),
  serv = JSON.parse(JSON.stringify(DEF.serv)),
  pisos = [];
// Luminarias de otra potencia: se suman a las salidas de alumbrado de un piso (lums) o de un tipo de departamento (lumsT)
// Tomacorrientes de otra potencia (casos excepcionales): se suman a los tomacorrientes generales de un piso (toms) o de un tipo (tomsT)
const lums = [],
  lumsT = [],
  toms = [],
  tomsT = [];
// Carga con electrónica (inverter, variador, inducción, cargador): su diferencial se sugiere tipo A
const ELEC = [
  ["0", "No"],
  ["1", "Sí (inverter, variador, inducción…)"]
];
const FASES = [
  ["1", "Monofásica"],
  ["3", "Trifásica"]
];
// Pisos de la vivienda unifamiliar: el 1er piso usa los datos de Vivienda y Salidas; la lista «pisos» guarda del 2do piso en adelante
const ORD = n => ["", "1er", "2do", "3er", "4to", "5to", "6to", "7mo", "8vo", "9no", "10mo"][n] || n + "°";
const tabPiso = n => "TD-" + n;
const opcPiso = () => {
  const tg = $("esqPisos").value === "tg";
  return [
    ["0", "Tablero general (TG)"],
    ...[1, ...pisos.map((_, i) => i + 2)].map(n => [String(n), `${ORD(n)} piso · ${n === 1 && tg ? "TG" : tabPiso(n)}`])
  ];
};
const LISTS = {
  cargas: {
    arr: cargas,
    lab: "Carga",
    f: [
      { k: "nombre", l: "Descripción", t: "text", full: 1 },
      { k: "tipo", l: "Tipo de carga", t: "select", o: Object.entries(TIPOS) },
      { k: "fases", l: "Fases", t: "select", o: FASES },
      { k: "p", l: "Potencia (W)", t: "number" },
      { k: "L", l: "Longitud (m)", t: "number" },
      { k: "piso", l: "Tablero", t: "select", o: opcPiso, full: 1, n: 1, show: () => pisos.length > 0 },
      { k: "elec", l: "Con electrónica", t: "select", o: ELEC, n: 1 }
    ],
    nuevo: () => ({ nombre: "", tipo: "otra", fases: 1, p: null, L: null, piso: 0, elec: 0 })
  },
  pisos: {
    arr: pisos,
    lab: "Piso",
    labF: i => `${ORD(i + 2)} piso · tablero ${tabPiso(i + 2)}`,
    f: [
      { k: "area", l: "Área techada (m²)", t: "number" },
      { k: "Ld", l: "Long. TG → TD (m)", t: "number" },
      { k: "al_n", l: "Salidas de alumbrado", t: "number" },
      { k: "al_L", l: "Long. alumbrado (m)", t: "number" },
      { k: "tg_n", l: "Tomacorrientes", t: "number" },
      { k: "tg_L", l: "Long. tomacorrientes (m)", t: "number" },
      { k: "tc_n", l: "Tomac. cocina / lavandería", t: "number" },
      { k: "tc_L", l: "Long. cocina (m)", t: "number" },
      { k: "aE", l: "Área de aulas o de alta intensidad (m²)", t: "number", full: 1, show: () => !!USOS[usoAct()]?.wE }
    ],
    nuevo: () => ({ area: null, Ld: null, al_n: null, al_L: null, tg_n: null, tg_L: null, tc_n: 0, tc_L: null, aE: 0 }),
    // al quitar un piso, sus cargas especiales pasan al TG y las de pisos superiores bajan un número
    quitar: i => {
      const n = i + 2;
      cargas.forEach(x => {
        if (x.piso === n) x.piso = 0;
        else if (x.piso > n) x.piso--;
      });
      [lums, toms].forEach(L => {
        for (let k = L.length - 1; k >= 0; k--) {
          if (L[k].piso === n) L.splice(k, 1);
          else if (L[k].piso > n) L[k].piso--;
        }
      });
    },
    luego: () => {
      renderList("cargas");
      renderList("lums");
      renderList("toms");
    }
  },
  tipos: {
    arr: tipos,
    lab: "Departamento",
    f: [
      { k: "nombre", l: "Denominación", t: "text" },
      { k: "cant", l: "Nº de dptos. de este tipo", t: "number" },
      { k: "area", l: "Área de vivienda (m²)", t: "number" },
      { k: "Ld", l: "Long. alimentador (m)", t: "number" },
      { k: "nAl", l: "Salidas de alumbrado", t: "number" },
      { k: "nTo", l: "Tomacorrientes", t: "number" },
      { k: "Lc", l: "Long. de circuitos (m)", t: "number" }
    ],
    nuevo: () => ({
      nombre: "Tipo " + String.fromCharCode(65 + tipos.length),
      cant: null,
      area: null,
      nAl: null,
      nTo: null,
      Ld: null,
      Lc: null
    }),
    // al quitar un tipo, se quitan sus luminarias y cargas especiales, y las de los tipos siguientes bajan un número
    quitar: i => {
      [
        [lumsT, "tipo"],
        [tomsT, "tipo"],
        [cargasT, "dep"]
      ].forEach(([L, k]) => {
        for (let j = L.length - 1; j >= 0; j--) {
          if (L[j][k] === i) L.splice(j, 1);
          else if (L[j][k] > i) L[j][k]--;
        }
      });
    },
    luego: () => {
      renderList("lumsT");
      renderList("tomsT");
      renderList("cargasT");
    }
  },
  /* Cargas especiales de los departamentos, una fila por equipo, igual que en la vivienda unifamiliar. Cada una
     tiene su circuito; para la máxima demanda (Regla 050-202(1)(a)) se suman por tipo como en la Regla 050-200.
     Son monofásicas: cada departamento se calcula con suministro monofásico. */
  cargasT: {
    arr: cargasT,
    lab: "Carga especial",
    f: [
      { k: "nombre", l: "Descripción", t: "text", full: 1 },
      { k: "tipo", l: "Tipo de carga", t: "select", o: Object.entries(TIPOS) },
      {
        k: "dep",
        l: "Departamento",
        t: "select",
        o: () => tipos.map((t, i) => [String(i), t.nombre || `Tipo ${i + 1}`]),
        n: 1
      },
      { k: "p", l: "Potencia (W)", t: "number" },
      { k: "L", l: "Longitud (m)", t: "number" },
      { k: "elec", l: "Con electrónica", t: "select", o: ELEC, n: 1 }
    ],
    nuevo: () => ({ nombre: "", tipo: "otra", p: null, L: null, dep: 0, elec: 0 })
  },
  serv: {
    arr: serv,
    lab: "Carga común",
    f: [
      { k: "nombre", l: "Descripción", t: "text", full: 1 },
      { k: "tipo", l: "Tipo", t: "select", o: Object.entries(TSERV) },
      { k: "fases", l: "Fases", t: "select", o: FASES },
      { k: "p", l: "Potencia (W)", t: "number" },
      { k: "L", l: "Longitud (m)", t: "number" },
      { k: "elec", l: "Con electrónica", t: "select", o: ELEC, n: 1 }
    ],
    nuevo: () => ({ nombre: "", tipo: "otra", fases: 1, p: null, L: null, elec: 0 })
  },
  lums: {
    arr: lums,
    lab: "Luminarias",
    f: [
      { k: "n", l: "Cantidad de salidas", t: "number" },
      { k: "p", l: "W por salida", t: "number" },
      {
        k: "piso",
        l: "Piso",
        t: "select",
        o: () => [1, ...pisos.map((_, i) => i + 2)].map(n => [String(n), `${ORD(n)} piso`]),
        n: 1,
        show: () => pisos.length > 0
      }
    ],
    nuevo: () => ({ n: null, p: null, piso: 1 })
  },
  lumsT: {
    arr: lumsT,
    lab: "Luminarias",
    f: [
      { k: "n", l: "Cantidad por departamento", t: "number" },
      { k: "p", l: "W por salida", t: "number" },
      {
        k: "tipo",
        l: "Departamento",
        t: "select",
        o: () => tipos.map((t, i) => [String(i), t.nombre || `Tipo ${i + 1}`]),
        n: 1
      }
    ],
    nuevo: () => ({ n: null, p: null, tipo: 0 })
  },
  toms: {
    arr: toms,
    lab: "Tomacorrientes",
    f: [
      { k: "n", l: "Cantidad de tomacorrientes", t: "number" },
      { k: "p", l: "W por tomacorriente", t: "number" },
      {
        k: "piso",
        l: "Piso",
        t: "select",
        o: () => [1, ...pisos.map((_, i) => i + 2)].map(n => [String(n), `${ORD(n)} piso`]),
        n: 1,
        show: () => pisos.length > 0
      }
    ],
    nuevo: () => ({ n: null, p: null, piso: 1 })
  },
  tomsT: {
    arr: tomsT,
    lab: "Tomacorrientes",
    f: [
      { k: "n", l: "Cantidad por departamento", t: "number" },
      { k: "p", l: "W por tomacorriente", t: "number" },
      {
        k: "tipo",
        l: "Departamento",
        t: "select",
        o: () => tipos.map((t, i) => [String(i), t.nombre || `Tipo ${i + 1}`]),
        n: 1
      }
    ],
    nuevo: () => ({ n: null, p: null, tipo: 0 })
  }
};
const HLP = {
  aLib: "Área no techada (patios, jardines, cocheras abiertas) que se iluminará o tendrá tomacorrientes. 0 si no se considera.",
  wLib: "Carga por m² del área libre; 5 W/m² es un valor de referencia. No figura en el CNE: es criterio del proyectista. Se suma al 100 % a la máxima demanda.",
  aE: "Escuelas: área de aulas (50 W/m²; el resto del edificio, 10 W/m²). Hospitales: área de alta intensidad como salas de operación (100 W/m² adicionales a los 20 W/m² del edificio). Reglas 050-204 y 050-206.",
  uso: "Vivienda: máxima demanda por la Regla 050-200. Otros usos (oficinas, comercios, etc.): Regla 050-210 y Tabla 14, con W/m² por actividad, área según dimensiones exteriores y tomacorrientes de 250 VA como criterio de diseño. Escuelas, hospitales y hoteles: Reglas 050-204, 050-206 y 050-208.",
  p_nombre: "Aparece en la memoria, el unifilar y el rótulo del plano.",
  p_prop: "Titular de la vivienda o del edificio.",
  p_ubic: "Distrito, provincia y región de la obra.",
  p_proy: "Ingeniero responsable que firma el expediente.",
  p_cip:
    "Número de colegiatura del ingeniero; aparece en la firma del expediente, en el Excel y en el rótulo del unifilar.",
  area: "Área techada dedicada a vivienda, al 100 % (Regla 050-110).",
  sot: "Área de sótano; se computa al 75 %. Deje 0 si no hay.",
  Lalim: "Recorrido del alimentador desde el medidor hasta el tablero general.",
  al_n: "Cantidad de puntos de luz.",
  al_p: "Potencia por salida de alumbrado; típico 100 W.",
  al_L: "Recorrido desde el tablero hasta la salida más alejada.",
  tg_n: "Cantidad de tomacorrientes generales.",
  tg_p: "Potencia por tomacorriente; típico 180 W.",
  tg_L: "Recorrido desde el tablero hasta el tomacorriente más alejado.",
  tc_n: "Tomacorrientes de cocina y lavandería; deje vacío si no hay.",
  tc_p: "Potencia por tomacorriente; típico 180 W.",
  tc_L: "Recorrido hasta el tomacorriente más alejado de la cocina.",
  Lgen: "Desde el banco de medidores (acometida) hasta el tablero general TG.",
  Lms: "Desde el tablero general TG hasta el tablero de servicios generales TSG.",
  fp: "Factor de potencia de las cargas; típico 0.9 en viviendas.",
  maxSal: "Máximo de salidas por circuito; 12 según la Regla 070-3000.",
  pAl: "Potencia por salida de alumbrado en departamentos (modo multifamiliar).",
  pTo: "Potencia por tomacorriente en departamentos (modo multifamiliar).",
  reserva: "Espacios libres por tablero para ampliaciones (Regla 050-108, EM.010).",
  met: "Forma de instalación del conductor (CNE-U, Tablas 3 y 4). B1 = tubo empotrado en ladrillo o concreto (mampostería) o sobre pared; A1 = tubo en pared térmicamente aislante.",
  aisl: "Temperatura máxima de servicio del aislamiento indicada por el fabricante; define la columna de la Tabla 2 del CNE: PVC 70 °C o XLPE / EPR 90 °C. Si el conductor tiene una temperatura intermedia, use la columna de 70 °C, del lado seguro (criterio del proyectista).",
  temp: "Temperatura ambiente del recorrido; corrige la ampacidad (Tabla 5A).",
  nag: "Circuitos que comparten la misma tubería; corrige la ampacidad (Tabla 5C).",
  rhoMode: "Resistividad del cobre usada para la caída de tensión.",
  desig: "Designación comercial que aparece en tablas y en el unifilar (por ejemplo, NH-80).",
  sminD: "Sección mínima en circuitos derivados, aunque el cálculo permita menos.",
  sminA: "Sección mínima en alimentadores, aunque el cálculo permita menos.",
  resAl:
    "Reserva de la corriente de diseño en los alimentadores de vivienda y departamentos. 25 %: reserva para ampliaciones, práctica usual de diseño. 0 %: mínimo de la norma, porque su carga calculada no es continua (Reglas 050-200(3) y 050-202(2)).",
  idMode: "Un diferencial de 30 mA cada tres circuitos o uno por circuito (Regla 150-400).",
  iccE: "Corriente de cortocircuito en el punto de entrega; la informa la concesionaria.",
  dvGen:
    "Parte del 2.5 % de caída de los alimentadores (Regla 050-102) que usa el alimentador general del edificio; el resto queda para el alimentador de cada departamento (1.5 %, 1.0 % o 0.5 %). Por eso no se ofrece 2.5 %.",
  rho_s: "Resistividad del suelo medida en campo (método de Wenner).",
  fr: "Reducción por tratamiento: 1 sin tratamiento; 0.3 a 0.6 con bentonita o gel.",
  Lv: "Longitud de la varilla de puesta a tierra; mínimo 2 m (Regla 060-702).",
  dv: "Diámetro de la varilla; mínimo 13 mm en cobre.",
  pDesp:
    "Desperdicio de conductores y tubos. No se suma al metrado, que es neto (Norma Técnica de Metrados, R.D. N.° 073-2010-VIVIENDA): se informa para el análisis de precios.",
  pzD: "Diámetro del hoyo del pozo. Opcional: vacío, el detalle no lo acota. El CNE no lo fija; use el de su proyecto o el de la concesionaria.",
  pzH: "Profundidad del hoyo del pozo. Opcional: vacío, el detalle no la acota. La varilla debe tener al menos 2 m (Regla 060-702).",
  pzTapa: "Lado de la tapa de concreto de la caja de registro.",
  pzTapaE: "Espesor de la tapa de concreto de la caja de registro.",
  pzSal:
    "Sal industrial del tratamiento del suelo, por pozo. Se incluye solo si hay tratamiento (factor menor que 1). Con 0 no se incluye.",
  pzCarb:
    "Carbón vegetal del tratamiento del suelo, por pozo. Se incluye solo si hay tratamiento (factor menor que 1). Con 0 no se incluye.",
  pzTierra: "Tierra negra cernida para el relleno compactado, por pozo.",
  pzCond: "Conductor desnudo de cobre del primer pozo al tablero; cada varilla adicional suma 3 m para unirla.",
  pzPvc: "Tubo PVC que protege el conductor de puesta a tierra entre el pozo y el tablero.",
  bmConc:
    "Concesionaria cuyas medidas se usan en el banco de medidores (lámina IE-05). Se rotula como fuente de las medidas.",
  bmLrmA: "Ancho de la caja de medidor monofásico (LRM) de la concesionaria.",
  bmLrmH: "Alto de la caja de medidor monofásico (LRM) de la concesionaria.",
  bmLtrA: "Ancho de la caja de medidor trifásico (LTR) de la concesionaria.",
  bmLtrH: "Alto de la caja de medidor trifásico (LTR) de la concesionaria.",
  bmTomaA: "Ancho de la caja toma (F1) de la concesionaria, donde llega la acometida.",
  bmTomaH: "Alto de la caja toma (F1) de la concesionaria.",
  bmTomaF: "Fondo de la caja toma (F1) de la concesionaria.",
  bmTomaS: "Altura del borde inferior de la caja toma sobre el nivel del suelo.",
  bmSepT: "Separación horizontal entre la caja toma y la primera caja de medidor.",
  bmSepF: "Separación vertical entre las filas de cajas de medidores.",
  bmBase: "Altura del borde inferior de la fila más baja de medidores sobre el borde inferior de la caja toma.",
  bmHmax: "Altura máxima del borde superior de la fila más alta sobre el suelo. La lámina verifica que no se supere.",
  bmFilas: "Filas de cajas de medidores. Cada fila tiene un largo D = número de conexiones × ancho de caja.",
  bmDist: "Distancia mínima de la cajuela a las instalaciones de gas, agua y desagüe, según la concesionaria.",
  hTecho: "Altura del piso terminado (NPT) al fondo de la losa, según la arquitectura. Ahí va el centro de luz.",
  hEnt: "Altura de piso terminado a piso terminado (techo más la losa). Con el diseño, cada montante suma esta altura por cada piso que atraviesa (criterio).",
  calPlano:
    "Con el diseño, los tableros dibujados en el plano dan sus circuitos, la carga conectada y la longitud hasta la salida más alejada (Regla 050-102); las áreas, las cargas especiales y los alimentadores también salen del plano. Los tableros que no están dibujados se calculan con los datos escritos.",
  hBraq: "Criterio del proyectista (valor usual 2.00 m). También se usa para la luminaria de emergencia.",
  hTab: "Hasta el borde superior del tablero. Criterio del proyectista (valor usual 1.80 m): que se opere de pie sin obstáculos.",
  hTerma: "Salida para terma o ducha eléctrica. Criterio del proyectista (valor usual 1.50 m), según el equipo.",
  hInt: "Interruptores, pulsadores e intercomunicador. La Norma A.120 del RNE fija un máximo de 1.35 m (Art. 11 d) y un alcance frontal de 0.40 a 1.20 m (Art. 10); rige en edificaciones con atención al público y en áreas comunes de edificios con ascensor.",
  hTomaC:
    "Tomacorrientes sobre el tablero de cocina y lavandería. Dentro del alcance frontal de la Norma A.120 (0.40 a 1.20 m, Art. 10).",
  hMed: "Eje de la caja del medidor. Criterio del proyectista: confirme la altura que pide la concesionaria.",
  hToma: "Tomacorrientes de uso general. La Norma A.120 pide el alcance frontal de 0.40 a 1.20 m (Art. 10).",
  hFza: "Salidas de fuerza: cocina eléctrica, motores y otras cargas. Criterio del proyectista, según el equipo.",
  hAire: "Salida para aire acondicionado. Criterio del proyectista, según la ubicación del equipo.",
  esqPisos:
    "Dónde se conectan los circuitos del 1er piso: en el mismo tablero general o en un tablero propio TD-1; en ese caso el TG solo alimenta los tableros de piso y las cargas asignadas a él.",
  Ltd1: "Recorrido del alimentador desde el tablero general TG hasta el tablero del 1er piso."
};
const HLPL = {
  lums: {
    n: "Salidas de alumbrado con otra potencia; se suman a las del piso.",
    p: "Potencia de cada una de estas luminarias.",
    piso: "Piso cuyas salidas de alumbrado reciben estas luminarias."
  },
  lumsT: {
    n: "Salidas con otra potencia en cada departamento de este tipo; se suman a sus salidas de alumbrado.",
    p: "Potencia de cada una de estas luminarias.",
    tipo: "Tipo de departamento al que pertenecen."
  },
  toms: {
    n: "Tomacorrientes con otra potencia (casos excepcionales); se suman a los tomacorrientes generales del piso.",
    p: "Potencia asignada a cada uno de estos tomacorrientes.",
    piso: "Piso cuyos tomacorrientes generales reciben estas salidas."
  },
  tomsT: {
    n: "Tomacorrientes con otra potencia en cada departamento de este tipo; se suman a sus tomacorrientes.",
    p: "Potencia asignada a cada uno de estos tomacorrientes.",
    tipo: "Tipo de departamento al que pertenecen."
  },
  cargas: {
    tipo: "Define el factor de demanda que se aplica a la carga.",
    p: "Potencia nominal del equipo.",
    L: "Recorrido desde el tablero hasta el equipo.",
    fases: "Las trifásicas solo se aplican si el suministro es trifásico."
  },
  tipos: {
    cant: "Cuántos departamentos iguales hay de este tipo.",
    area: "Área techada de un departamento de este tipo.",
    Ld: "Desde el medidor del departamento hasta su tablero.",
    nAl: "Puntos de luz de un departamento.",
    nTo: "Tomacorrientes de un departamento.",
    Lc: "Hasta la salida más alejada del departamento."
  },
  cargasT: {
    tipo: "Define cómo entra en la máxima demanda del departamento (Regla 050-202(1)(a)): cocina, 6 kW + 40 % del exceso sobre 12 kW; calentador y aire acondicionado, 100 %; otras cargas y motores mayores de 1500 W, 25 % si hay cocina eléctrica o, si no la hay, 100 % hasta 6 kW y 25 % del exceso. Las de 1500 W o menos tienen su circuito, pero ya están cubiertas por la carga básica.",
    dep: "Tipo de departamento que tiene este equipo; se repite en cada departamento de ese tipo.",
    p: "Potencia nominal del equipo.",
    L: "Recorrido desde el tablero del departamento hasta el equipo."
  },
  serv: {
    tipo: "Motor aplica curva D y conductor al 125 %.",
    p: "Potencia nominal de la carga común.",
    L: "Recorrido desde el tablero TSG hasta la carga."
  },
  pisos: {
    area: "Área techada de este piso; su máxima demanda se calcula con la Regla 050-200.",
    Ld: "Desde el tablero general TG hasta el tablero de este piso.",
    al_n: "Puntos de luz de este piso.",
    al_L: "Hasta la salida de alumbrado más alejada del piso.",
    tg_n: "Tomacorrientes generales de este piso.",
    tg_L: "Hasta el tomacorriente más alejado del piso.",
    tc_n: "Tomacorrientes de cocina y lavandería del piso; 0 si no hay.",
    tc_L: "Hasta el tomacorriente de cocina más alejado."
  }
};
/* Equipos adicionales del tablero: se marcan en cada tablero (panel Propiedades) y aparecen en el diagrama
   unifilar, el metrado, la memoria Excel y el expediente. No intervienen en el cálculo de la instalación.
   c = abreviatura en el unifilar; d = descripción para el metrado (tri = tablero trifásico) */
const EQT = {
  dps: {
    n: "Protector contra sobretensiones (DPS)",
    c: "DPS",
    d: tri =>
      `Protector contra sobretensiones transitorias (DPS) tipo 2, ${tri ? "4P (3F+N)" : "2P (F+N)"}, In 20 kA, Up ≤ 1.5 kV`,
    a: "Protege los equipos contra sobretensiones transitorias de origen atmosférico o de maniobra. Se conecta entre las barras del tablero y la barra de tierra."
  },
  rel: {
    n: "Protector de sobretensión y subtensión",
    c: "Relé de tensión",
    d: tri =>
      `Relé de protección de sobretensión y subtensión ${tri ? "trifásico" : "monofásico"}, con rearme automático`,
    a: "Desconecta la instalación si la tensión de la red sube o baja fuera de los límites ajustados y la reconecta al normalizarse."
  },
  med: {
    n: "Medidor de energía",
    c: "Medidor",
    d: tri => `Medidor de energía ${tri ? "trifásico" : "monofásico"} para riel DIN`,
    a: "Registra el consumo del tablero; útil en tableros de servicios generales o de áreas que se facturan aparte."
  },
  ctr: {
    n: "Contactor con reloj horario",
    c: "Contactor + reloj",
    d: tri => `Contactor ${tri ? "tripolar" : "bipolar"} con reloj horario para riel DIN`,
    a: "Enciende y apaga circuitos por horario, por ejemplo el alumbrado de áreas comunes o exteriores."
  }
};
// Equipos marcados en un tablero del proyecto calculado r (r.teq): [[clave, definición], ...]
const equiposDe = (r, tab) => Object.entries(EQT).filter(([k]) => ((r.teq || {})[tab] || {})[k]);
function ayudas() {
  Object.entries(HLP).forEach(([id, t]) => {
    const el = $(id);
    if (!el) return;
    el.dataset.ayuda = t;
    const lb = el.closest("label");
    if (lb) lb.dataset.ayuda = t;
  });
}
/* Globo de ayuda propio (con la letra y el tamaño de la plataforma) en lugar del globo nativo del navegador.
   Muestra el texto de data-ayuda; los atributos title de botones y elementos se pasan a data-ayuda al pasar
   el cursor, para que todo use el mismo globo. No lo recortan los paneles porque cuelga de body. */
(function () {
  const tip = document.createElement("div");
  tip.className = "tipbox";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.appendChild(tip);
  let actual = null,
    espera = null;
  const objetivo = e => {
    const t = e.target.closest && e.target.closest("[data-ayuda],[title]");
    if (!t || t.closest(".tipbox")) return null;
    if (t.hasAttribute("title")) {
      const tx = t.getAttribute("title");
      t.removeAttribute("title");
      if (!tx) return null;
      t.dataset.ayuda = tx;
      if (!t.getAttribute("aria-label") && !t.textContent.trim()) t.setAttribute("aria-label", tx);
    }
    if (!t.dataset.ayuda) return null;
    // Si el globo solo repite el texto que ya se lee completo en pantalla, no aporta nada
    const vis = t.textContent.trim();
    if (vis && vis === t.dataset.ayuda.trim() && t.scrollWidth <= t.clientWidth) return null;
    return t;
  };
  const mostrar = t => {
    tip.textContent = t.dataset.ayuda;
    // En el espacio de trabajo la pantalla está a escala (80 % por defecto): el globo usa la misma escala
    const ws = t.closest("#ws"),
      k = ws ? parseFloat(getComputedStyle(ws).zoom) || 1 : 1;
    tip.style.fontSize = (11 * k).toFixed(1) + "px";
    tip.style.padding = `${(4 * k).toFixed(1)}px ${(8 * k).toFixed(1)}px`;
    tip.style.maxWidth = Math.round(260 * k) + "px";
    tip.hidden = false;
    const r = t.getBoundingClientRect(),
      w = tip.offsetWidth,
      h = tip.offsetHeight;
    let x = Math.min(Math.max(8, r.left), innerWidth - w - 8),
      y = r.bottom + 6;
    if (y + h > innerHeight - 8) y = r.top - h - 6;
    const z = parseFloat(getComputedStyle(document.body).zoom) || 1;
    tip.style.left = x / z + "px";
    tip.style.top = y / z + "px";
  };
  const ocultar = () => {
    clearTimeout(espera);
    actual = null;
    tip.hidden = true;
  };
  document.addEventListener("mouseover", e => {
    const t = objetivo(e);
    if (t === actual) return;
    ocultar();
    if (!t) return;
    actual = t;
    espera = setTimeout(() => actual === t && mostrar(t), 600);
  });
  // Con el teclado (Tab) el globo aparece al llegar al control; con un clic, no
  document.addEventListener("focusin", e => {
    const t = objetivo(e);
    ocultar();
    if (t && e.target.matches(":focus-visible")) {
      actual = t;
      mostrar(t);
    }
  });
  document.addEventListener("focusout", ocultar);
  document.addEventListener("mousedown", ocultar);
  document.addEventListener("scroll", ocultar, true);
})();
const PHL = {
  lums: { n: "ej. 8", p: "ej. 36" },
  lumsT: { n: "ej. 4", p: "ej. 20" },
  cargas: { nombre: "ej. Ducha eléctrica", p: "ej. 3500", L: "ej. 12" },
  tipos: {
    cant: "ej. 6",
    area: "ej. 85",
    Ld: "ej. 25",
    nAl: "ej. 12",
    nTo: "ej. 14",
    Lc: "ej. 15"
  },
  cargasT: { nombre: "ej. Terma eléctrica", p: "ej. 1500", L: "ej. 15" },
  serv: { nombre: "ej. Electrobomba de agua", p: "ej. 800", L: "ej. 30" },
  pisos: {
    area: "ej. 90",
    Ld: "ej. 8",
    al_n: "ej. 10",
    al_L: "ej. 18",
    tg_n: "ej. 12",
    tg_L: "ej. 20",
    tc_n: "0 si no hay",
    tc_L: "ej. 12"
  }
};

const $ = id => document.getElementById(id);
const num = id => parseFloat($(id).value) || 0;
const esc = s =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
const fmt = (x, d = 2) =>
  Number.isFinite(x)
    ? x.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false })
    : "—";
const radio = n => document.querySelector(`input[name="${n}"]:checked`)?.value;

const selNum = f => f.k === "fases" || f.n;
function readList(name) {
  const L = LISTS[name];
  L.arr.forEach((it, i) =>
    L.f.forEach(f => {
      const el = $(`${name}_${f.k}_${i}`);
      if (!el) return;
      it[f.k] =
        f.t === "number"
          ? el.value.trim() === ""
            ? null
            : parseFloat(el.value) || 0
          : selNum(f)
            ? +el.value
            : el.value.replace(/[<>]/g, "");
    })
  );
}
function renderList(name) {
  const L = LISTS[name],
    box = $("L_" + name);
  box.innerHTML = "";
  L.arr.forEach((it, i) => {
    const d = document.createElement("div");
    d.className = "item";
    d.innerHTML =
      `<div class="item-h"><span>${L.labF ? L.labF(i) : `${L.lab} ${i + 1}`}</span><button type="button" class="link-del" data-i="${i}">Quitar</button></div><div class="item-g">` +
      L.f
        .filter(f => !f.show || f.show())
        .map(f => {
          const id = `${name}_${f.k}_${i}`,
            v = it[f.k];
          const c =
            f.t === "select"
              ? `<select id="${id}">${(typeof f.o === "function" ? f.o() : f.o).map(([ov, ol]) => `<option value="${ov}"${String(ov) === String(v) ? " selected" : ""}>${ol}</option>`).join("")}</select>`
              : `<input id="${id}" type="${f.t}"${f.t === "number" ? ' min="0" step="any"' : ""} value="${v == null ? "" : esc(v)}"${PHL[name]?.[f.k] ? ` placeholder="${PHL[name][f.k]}"` : ""}>`;
          return `<label class="${f.full ? "full" : ""}"${HLPL[name]?.[f.k] ? ` data-ayuda="${esc(HLPL[name][f.k])}"` : ""}><span class="lt">${f.l}</span>${c}</label>`;
        })
        .join("") +
      `</div>`;
    box.appendChild(d);
  });
  box.querySelectorAll("input,select").forEach(el =>
    el.addEventListener("input", () => {
      readList(name);
      update();
    })
  );
  box.querySelectorAll(".link-del").forEach(b =>
    b.addEventListener("click", () => {
      readList(name);
      L.arr.splice(+b.dataset.i, 1);
      if (L.quitar) L.quitar(+b.dataset.i);
      renderList(name);
      if (L.luego) L.luego();
      update();
    })
  );
}
Object.keys(LISTS).forEach(n =>
  $("add_" + n).addEventListener("click", () => {
    readList(n);
    LISTS[n].arr.push(LISTS[n].nuevo());
    renderList(n);
    if (LISTS[n].luego) LISTS[n].luego();
    update();
  })
);
function renderSys(boxId, name, def) {
  $(boxId).innerHTML = SYS_OPC.map(
    ([v, t, w, d]) =>
      `<label><input type="radio" name="${name}" value="${v}"${v === def ? " checked" : ""}><span><span class="t">${t}<span class="w">${w}</span></span><span class="d">${d}</span></span></label>`
  ).join("");
}

// Usos de la Tabla 14 (Regla 050-210) en el selector «Uso de la edificación» del modo unifamiliar
$("uso").insertAdjacentHTML(
  "beforeend",
  `<optgroup label="Otros usos · Regla 050-210 y Tabla 14">${Object.entries(USOS)
    .filter(([, u]) => !u.regla)
    .map(([k, u]) => `<option value="${k}">${u.n} · ${u.w} W/m²</option>`)
    .join("")}</optgroup><optgroup label="Reglas propias · 050-204, 050-206, 050-208">${Object.entries(USOS)
    .filter(([, u]) => u.regla)
    .map(([k, u]) => `<option value="${k}">${u.n} · Regla ${u.regla}</option>`)
    .join("")}</optgroup>`
);
const usoAct = () => (USOS[$("uso").value] ? $("uso").value : "viv");
// Nombre del tipo de edificación para títulos, cabecera y documentos
const nomEdif = () =>
  MODE === "multi" ? "Edificio multifamiliar" : usoAct() === "viv" ? "Vivienda unifamiliar" : USOS[usoAct()].n;
const nomRes = r =>
  r.mode === "multi"
    ? "Edificio multifamiliar"
    : r.viv === false && USOS[r.uso]
      ? USOS[r.uso].n
      : "Vivienda unifamiliar";
// Mismas opciones de uso en el asistente de nuevo proyecto (opción «Comercial y otros usos»)
$("wz_uso").innerHTML = `<optgroup label="Regla 050-210 y Tabla 14">${Object.entries(USOS)
  .filter(([, u]) => !u.regla)
  .map(([k, u]) => `<option value="${k}">${u.n} · ${u.w} W/m²</option>`)
  .join("")}</optgroup><optgroup label="Reglas propias">${Object.entries(USOS)
  .filter(([, u]) => u.regla)
  .map(([k, u]) => `<option value="${k}">${u.n} · Regla ${u.regla}</option>`)
  .join("")}</optgroup>`;
