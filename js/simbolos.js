/* SÍMBOLOS DE LA NORMA DGE «Símbolos gráficos en electricidad» (R.M. N.° 091-2002-EM/VME)
   Dibujos en SVG de los símbolos que usan las láminas (leyenda del diagrama de alturas y lámina de leyenda y
   detalles), redibujados conservando sus proporciones (024: pueden agrandarse, reducirse o girarse; 025: la
   grilla de 2.5 mm no es obligatoria). Usan solo líneas, rectángulos, círculos, triángulos y textos, para que
   svgDxf() los pase a AutoCAD. */
// Coordenadas con 2 decimales
const px2 = v => +(+v).toFixed(2);
const INK_S = PAL.INK;
// Primitivas de dibujo sobre la lista o (cadenas SVG)
function trazos(o) {
  const L = (x1, y1, x2, y2, w = 1.2, col = INK_S, dash) =>
    o.push(
      `<line x1="${px2(x1)}" y1="${px2(y1)}" x2="${px2(x2)}" y2="${px2(y2)}" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`
    );
  const T = (x, y, t, { s = 9, b = 0, a = "start", f = INK_S, it = 0 } = {}) =>
    o.push(
      `<text x="${px2(x)}" y="${px2(y)}" font-size="${px2(s)}"${b ? ' font-weight="700"' : ""}${it ? ' font-style="italic"' : ""} text-anchor="${a}" fill="${f}">${esc(t)}</text>`
    );
  const R = (x, y, w, h, { st = INK_S, fi = "none", sw = 1.2 } = {}) =>
    o.push(
      `<rect x="${px2(x)}" y="${px2(y)}" width="${px2(w)}" height="${px2(h)}" fill="${fi}"${st ? ` stroke="${st}" stroke-width="${sw}"` : ""}/>`
    );
  const C = (x, y, r, { fi = "#fff", st = INK_S, sw = 1.2 } = {}) =>
    o.push(
      `<circle cx="${px2(x)}" cy="${px2(y)}" r="${px2(r)}" fill="${fi}"${st ? ` stroke="${st}" stroke-width="${sw}"` : ""}/>`
    );
  const TRI = (x1, y1, x2, y2, x3, y3, fi = INK_S) =>
    o.push(`<path d="M${px2(x1)} ${px2(y1)}L${px2(x2)} ${px2(y2)}L${px2(x3)} ${px2(y3)}Z" fill="${fi}"/>`);
  return { L, T, R, C, TRI };
}
/* Símbolo k de tamaño z, centrado en x, y. Devuelve false si no existe. Códigos de la norma:
   tomacorrientes 09-93-13/15/17/18, interruptor 09-93-30, salidas de alumbrado 09-93-51/52, emergencia 09-93-67,
   calentador de agua 09-93-69, interfono 09-93-73, caja 09-93-08, canalizaciones 09-93-05/06, conductores
   09-93-01/02, tablero 09-91-17, contador de energía 08-80-22, interruptor automático 07-72-21, diferencial
   07-72-17, contactor 07-72-18, pararrayos 07-75-23, relé de tensión 07-73-01, reloj 08-80-40 y tierra
   03-31-44/46. Para el editor de diseño (js/diseno.js), toda la sección 093 «Instalaciones en edificaciones»
   (09-93-01 a 09-93-73: cajas, centro de distribución, tomacorrientes de potencia y de telecomunicaciones, en el
   piso, interruptores en forma gráfica y literal, pulsadores, temporizadores, salidas de iluminación, fluorescentes,
   luminarias, proyectores, emergencia, ventilador, reloj, cerradura e interfono), el panel de distribución 09-91-16
   y el timbre 08-80-49. */
function simboloDGE(o, k, x, y, z = 1) {
  const { L, T, R, C, TRI } = trazos(o);
  // Tomacorriente: círculo atravesado por n líneas que llegan desde la izquierda; letra abajo a la derecha
  const toma = (n, letra, piso) => {
    const cx = x + 2 * z,
      r = 5.5 * z,
      a = 7.5 * z;
    if (piso) R(cx - a, y - a, 2 * a, 2 * a, { fi: "#fff" });
    C(cx, y, r);
    const d = n === 3 ? 2.2 * z : 1.5 * z;
    (n === 3 ? [-d, 0, d] : [-d, d]).forEach(dy => {
      const hx = Math.sqrt(Math.max(r * r - dy * dy, 0));
      L(piso ? cx - a : x - 8 * z, y + dy, cx + hx, y + dy, 1.1);
    });
    if (letra)
      T(cx + r + 0.5 * z + (piso ? 2 * z : 0), y + 7.5 * z + (piso ? 2 * z : 0), letra, { s: 7 * z, b: 1, it: 1 });
  };
  // Salida de alumbrado: círculo con cuatro trazos radiales; en pared, la barra del muro a la izquierda
  const luz = (pared, lleno) => {
    const r = 5 * z,
      t = 3.5 * z;
    C(x, y, r, lleno ? { fi: INK_S } : undefined);
    L(x, y - r, x, y - r - t);
    L(x, y + r, x, y + r + t);
    L(x + r, y, x + r + t, y);
    L(x - r, y, x - r - t, y);
    if (pared) L(x - r - t, y - r, x - r - t, y + r, 1.4);
  };
  const intN = n => {
    C(x - 5 * z, y + 1.5 * z, 1.5 * z, { fi: INK_S, st: "" });
    T(x - 2.5 * z, y + 5 * z, "S", { s: 12 * z, b: 1, it: 1 });
    T(x + 4.6 * z, y + 7.5 * z, n, { s: 7 * z, b: 1, it: 1 });
  };
  // Arco en tramos rectos: centro, radio y ángulos en radianes (con y hacia abajo, de π a 2π es la mitad de arriba)
  const arco = (cx, cy, r, a0, a1, w = 1.2) => {
    const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 12)));
    for (let i = 0; i < n; i++) {
      const p = a0 + ((a1 - a0) * i) / n,
        q = a0 + ((a1 - a0) * (i + 1)) / n;
      L(cx + r * Math.cos(p), cy + r * Math.sin(p), cx + r * Math.cos(q), cy + r * Math.sin(q), w);
    }
  };
  // Forma literal de los interruptores (09-93-29 a 09-93-47): punto, S y su subíndice
  const intS = sub => {
    C(x - 5 * z, y + 1.5 * z, 1.5 * z, { fi: INK_S, st: "" });
    T(x - 2.5 * z, y + 5 * z, "S", { s: 12 * z, b: 1, it: 1 });
    if (sub) T(x + 4.6 * z, y + 7.5 * z, sub, { s: (sub.length > 2 ? 5.5 : 7) * z, b: 1, it: 1 });
  };
  // Interruptor en forma gráfica (09-93-28 a 09-93-38): círculo abajo y palanca inclinada 60° hacia arriba a la
  // derecha; devuelve el extremo de la palanca y la dirección, para sus remates
  const palanca = (cx = x - 2 * z, cy = y + 4 * z, ang = -Math.PI / 3, conX) => {
    const r = 2.6 * z,
      ux = Math.cos(ang),
      uy = Math.sin(ang),
      e = [cx + 12 * z * ux, cy + 12 * z * uy];
    C(cx, cy, r, { fi: "#fff" });
    if (conX) {
      const k = r * 0.7;
      L(cx - k, cy - k, cx + k, cy + k, 1);
      L(cx + k, cy - k, cx - k, cy + k, 1);
    }
    L(cx + r * ux, cy + r * uy, e[0], e[1]);
    return e;
  };
  // Remate en gancho: corto, hacia afuera y algo hacia abajo
  const gancho = (e, lado = 1) => L(e[0], e[1], e[0] + 2.6 * z * lado, e[1] + 1.3 * z, 1.1);
  // Tomacorriente de potencia en forma general (09-93-12, 09-93-20 a 09-93-26): receptáculo (∩) con su llegada
  const recept = (cx, cy, r = 3 * z) => arco(cx, cy, r, Math.PI, 2 * Math.PI);
  const llegada = () => {
    L(x - 8 * z, y - 7 * z, x, y - 7 * z);
    L(x, y - 7 * z, x, y - 1 * z);
  };
  // Tomacorriente de telecomunicaciones (09-93-27): llegada y ⊓, con la letra del tipo abajo a la derecha
  const tel = letra => {
    L(x - 8 * z, y - 7 * z, x, y - 7 * z);
    L(x, y - 7 * z, x, y - 1 * z);
    L(x - 3.5 * z, y - 1 * z, x + 3.5 * z, y - 1 * z);
    L(x - 3.5 * z, y - 1 * z, x - 3.5 * z, y + 3 * z);
    L(x + 3.5 * z, y - 1 * z, x + 3.5 * z, y + 3 * z);
    if (letra) T(x + 4.5 * z, y + 8 * z, letra, { s: 6 * z, b: 1, it: 1 });
  };
  // Flecha: segmento con punta llena en el extremo b
  const flecha = (a0, b0, a1, b1) => {
    L(a0, b0, a1, b1, 1);
    const ang = Math.atan2(b1 - b0, a1 - a0),
      l = 2 * z,
      w = 0.9 * z;
    TRI(
      a1,
      b1,
      a1 - l * Math.cos(ang) - w * Math.sin(ang),
      b1 - l * Math.sin(ang) + w * Math.cos(ang),
      a1 - l * Math.cos(ang) + w * Math.sin(ang),
      b1 - l * Math.sin(ang) - w * Math.cos(ang)
    );
  };
  // Proyector (09-93-63 a 09-93-65): lámpara (círculo con aspa) y el reflector en arco a su izquierda
  const proyector = () => {
    const cx = x - 1 * z;
    C(cx, y, 2.2 * z, { fi: "#fff" });
    L(cx - 1.5 * z, y - 1.5 * z, cx + 1.5 * z, y + 1.5 * z, 1);
    L(cx + 1.5 * z, y - 1.5 * z, cx - 1.5 * z, y + 1.5 * z, 1);
    arco(cx, y, 4.6 * z, Math.PI * 0.58, Math.PI * 1.42);
    return cx;
  };
  // Salida para fluorescente (09-93-55 a 09-93-58): rectángulo con su punto de conexión; en hilera, tres cuerpos
  const fluor = (lleno, hilera) => {
    if (hilera) {
      R(x - 12 * z, y - 2 * z, 24 * z, 4 * z, { fi: "#fff" });
      L(x - 4 * z, y - 2 * z, x - 4 * z, y + 2 * z, 1);
      L(x + 4 * z, y - 2 * z, x + 4 * z, y + 2 * z, 1);
      C(x - 8 * z, y, 1.4 * z, { fi: lleno ? INK_S : "#fff" });
    } else {
      R(x - 9 * z, y - 3 * z, 18 * z, 6 * z, { fi: "#fff" });
      C(x, y, (lleno ? 2 : 1.6) * z, { fi: lleno ? INK_S : "#fff" });
    }
  };
  const S = {
    toma: () => toma(2, "T"),
    tomaC: () => toma(2, "T"),
    toma1: () => toma(2, ""),
    toma3: () => toma(3, ""),
    coc: () => toma(3, "C"),
    aire: () => toma(2, "A"),
    aire3: () => toma(3, "A"),
    fza: () => toma(2, "F"),
    fza3: () => toma(3, "F"),
    // Interruptor unipolar (forma literal de 09-93-30): punto y letra S
    int: () => {
      C(x - 5 * z, y + 1.5 * z, 1.5 * z, { fi: INK_S, st: "" });
      T(x - 2.5 * z, y + 5 * z, "S", { s: 12 * z, b: 1, it: 1 });
    },
    tomaPA: () => toma(2, "PA"),
    // Interruptores bipolar (S2), de tres vías (S3) y de cuatro vías (S4): la forma literal con su número
    int2: () => intN("2"),
    int3: () => intN("3"),
    int4: () => intN("4"),
    luz: () => luz(false),
    braq: () => luz(true),
    // Luminaria de emergencia: aspa con un cuadrado negro al centro
    emer: () => {
      const a = 6 * z;
      L(x - a, y - a, x + a, y + a, 1.3);
      L(x + a, y - a, x - a, y + a, 1.3);
      TRI(x - 2.8 * z, y - 2.8 * z, x + 2.8 * z, y - 2.8 * z, x + 2.8 * z, y + 2.8 * z);
      TRI(x - 2.8 * z, y - 2.8 * z, x + 2.8 * z, y + 2.8 * z, x - 2.8 * z, y + 2.8 * z);
    },
    // Bloque autónomo de emergencia (09-93-68): cuadrado con aspa y punto al centro
    emerB: () => {
      const a = 6 * z;
      R(x - a, y - a, 2 * a, 2 * a, { fi: "#fff" });
      L(x - a, y - a, x + a, y + a, 1.1);
      L(x + a, y - a, x - a, y + a, 1.1);
      R(x - 1.6 * z, y - 1.6 * z, 3.2 * z, 3.2 * z, { fi: INK_S, st: "" });
    },
    // Pulsador de timbre (09-93-43): círculo dentro de otro, con punto al centro
    pul: () => {
      C(x, y, 5.5 * z);
      C(x, y, 3 * z, { fi: "none" });
      C(x, y, 1 * z, { fi: INK_S, st: "" });
    },
    // Timbre, campana (08-80-49): semicírculo con su base y dos terminales
    timbre: () => {
      const r = 6 * z;
      for (let i = 0; i < 8; i++) {
        const a1 = Math.PI + (Math.PI * i) / 8,
          a2 = Math.PI + (Math.PI * (i + 1)) / 8;
        L(x + r * Math.cos(a1), y + 2 * z + r * Math.sin(a1), x + r * Math.cos(a2), y + 2 * z + r * Math.sin(a2), 1.2);
      }
      L(x - r, y + 2 * z, x + r, y + 2 * z, 1.2);
      L(x - 3 * z, y + 2 * z, x - 3 * z, y + 6 * z, 1.1);
      L(x + 3 * z, y + 2 * z, x + 3 * z, y + 6 * z, 1.1);
    },
    // Calentador de agua: círculo con rayado vertical y la canalización desde la izquierda
    terma: () => {
      const r = 6.5 * z;
      L(x - r - 6 * z, y, x - r, y);
      C(x, y, r);
      [-4.5, -2.25, 0, 2.25, 4.5].forEach(d => {
        const dx = d * z,
          h = Math.sqrt(r * r - dx * dx);
        L(x + dx, y - h, x + dx, y + h, 0.8);
      });
    },
    // Interfono: cuadrado con un altoparlante y flecha doble
    itc: () => {
      const a = 8 * z;
      R(x - a, y - a, 2 * a, 2 * a, { fi: "#fff" });
      R(x - 5 * z, y - 2 * z, 2.5 * z, 4 * z, { sw: 0.9 });
      L(x - 2.5 * z, y - 2 * z, x + 0.5 * z, y - 5 * z, 0.9);
      L(x + 0.5 * z, y - 5 * z, x + 0.5 * z, y + 5 * z, 0.9);
      L(x + 0.5 * z, y + 5 * z, x - 2.5 * z, y + 2 * z, 0.9);
      L(x + 1.5 * z, y, x + 6 * z, y, 0.8);
      L(x + 1.5 * z, y, x + 3 * z, y - 1.4 * z, 0.8);
      L(x + 1.5 * z, y, x + 3 * z, y + 1.4 * z, 0.8);
      L(x + 6 * z, y, x + 4.5 * z, y - 1.4 * z, 0.8);
      L(x + 6 * z, y, x + 4.5 * z, y + 1.4 * z, 0.8);
    },
    // --- Cajas y distribución ---
    // Caja de conexión o derivación (09-93-09): círculo con un punto grande al centro
    cajaCon: () => {
      C(x, y, 5 * z);
      C(x, y, 1.8 * z, { fi: INK_S, st: "" });
    },
    // Terminal de consumidores (09-93-10): cuadrado con punto, con la canalización que lo atraviesa
    terminal: () => {
      L(x, y - 9 * z, x, y - 3.5 * z);
      R(x - 3.5 * z, y - 3.5 * z, 7 * z, 7 * z, { fi: "#fff" });
      C(x, y, 0.9 * z, { fi: INK_S, st: "" });
      L(x, y + 3.5 * z, x, y + 9 * z);
    },
    // Centro de distribución (09-93-11): rectángulo con cinco canalizaciones (cuatro arriba, una abajo)
    centroDist: () => {
      [-4.5, -1.5, 1.5, 4.5].forEach(d => L(x + d * z, y - 8 * z, x + d * z, y - 2.5 * z));
      R(x - 7 * z, y - 2.5 * z, 14 * z, 5 * z, { fi: "#fff" });
      L(x, y + 2.5 * z, x, y + 6 * z);
    },
    // Canalización atravesando verticalmente (09-93-07): flecha en los dos sentidos con un punto al centro
    atrav: () => {
      flecha(x, y, x + 6 * z, y - 6 * z);
      flecha(x, y, x - 6 * z, y + 6 * z);
      C(x, y, 0.9 * z, { fi: INK_S, st: "" });
    },
    // --- Tomacorrientes ---
    tomaPiso: () => toma(2, "", true),
    toma3Piso: () => toma(3, "", true),
    // Tomacorriente de potencia, símbolo general (09-93-12)
    tomaG: () => {
      L(x, y - 7 * z, x, y - 1 * z);
      recept(x, y + 2 * z);
    },
    // Tomacorriente múltiple (09-93-20): con el número de tomas
    tomaMult: () => {
      llegada();
      recept(x, y + 2 * z);
      L(x - 0.8 * z, y + 2.2 * z, x + 3.2 * z, y - 2.6 * z, 1);
      T(x + 3.6 * z, y - 2.4 * z, "3", { s: 5.5 * z, b: 1 });
    },
    // Tomacorriente con tres tomas (09-93-21)
    tomaTres: () => {
      llegada();
      [2, 4.6, 7.2].forEach(d => recept(x, y + d * z));
    },
    // Con contacto para el conductor de protección (09-93-22)
    tomaPE: () => {
      llegada();
      L(x - 3.6 * z, y - 1 * z, x + 3.6 * z, y - 1 * z);
      recept(x, y + 2 * z);
    },
    // Con obturador (09-93-23)
    tomaObt: () => {
      llegada();
      recept(x, y + 2 * z);
      L(x - 6.5 * z, y + 2 * z, x - 3 * z, y + 2 * z);
      L(x + 3 * z, y + 2 * z, x + 6.5 * z, y + 2 * z);
    },
    // Con interruptor unipolar (09-93-24) y de encerrojamiento (09-93-25)
    tomaInt: () => {
      llegada();
      recept(x, y + 2 * z);
      L(x, y - 1 * z, x + 3.5 * z, y - 6 * z);
      L(x + 3.5 * z, y - 6 * z, x + 5.5 * z, y - 5 * z, 1);
    },
    tomaEnc: () => {
      llegada();
      recept(x, y + 2 * z);
      L(x, y - 1 * z, x + 3.5 * z, y - 6 * z);
      L(x + 3.5 * z, y - 6 * z, x + 5.5 * z, y - 5 * z, 1);
      TRI(x, y - 1 * z, x + 1.8 * z, y - 3.6 * z, x + 0.4 * z, y - 3.9 * z);
    },
    // Con transformador aislante, por ejemplo para máquina de afeitar (09-93-26)
    tomaTr: () => {
      llegada();
      C(x, y + 1.6 * z, 2.6 * z, { fi: "none" });
      recept(x, y + 4.4 * z);
    },
    // Tomacorriente de telecomunicaciones (09-93-27): general y con la designación del tipo
    telG: () => tel(""),
    telTP: () => tel("TP"),
    telTV: () => tel("TV"),
    telFX: () => tel("FX"),
    telM: () => tel("M"),
    telFM: () => tel("FM"),
    telTX: () => tel("TX"),
    // --- Interruptores ---
    // Símbolo general (09-93-28), con luz piloto (09-93-29) y con tiempo de cierre limitado (09-93-30)
    intG: () => palanca(),
    intPil: () => palanca(undefined, undefined, undefined, true),
    intTemp: () => gancho(palanca()),
    // Bipolar en forma gráfica (09-93-31): dos trazos en el extremo
    int2G: () => {
      const e = palanca(),
        k = 2.2 * z;
      L(e[0], e[1], e[0] + 2.6 * z, e[1] + 0.2 * z, 1.1);
      L(e[0] - k * 0.5, e[1] + k * 0.87, e[0] - k * 0.5 + 2.6 * z, e[1] + k * 0.87 + 0.2 * z, 1.1);
    },
    // Conmutador unipolar (09-93-34): dos palancas en V con sus ganchos
    conm: () => {
      gancho(palanca(x, y + 4 * z, -Math.PI / 3), 1);
      const r = 2.6 * z,
        e = [x - 6 * z, y + 4 * z - 10.4 * z];
      L(x - r * 0.5, y + 4 * z - r * 0.87, e[0], e[1]);
      gancho(e, -1);
    },
    // Interruptor unipolar de dos vías (09-93-35): la palanca atraviesa el círculo, con un gancho en cada extremo
    int2v: () => {
      gancho(palanca(x, y + 1 * z, -Math.PI / 3), 1);
      const r = 2.6 * z,
        e = [x - 6 * z, y + 1 * z + 10.4 * z];
      L(x - r * 0.5, y + 1 * z + r * 0.87, e[0], e[1]);
      L(e[0], e[1], e[0] - 2.6 * z, e[1] - 0.3 * z, 1.1);
    },
    // Conmutador intermedio (09-93-36): aspa a través del círculo con sus cuatro ganchos
    conmInt: () => {
      const cy = y + 1 * z,
        r = 2.6 * z;
      C(x, cy, r, { fi: "#fff" });
      [
        [1, -1],
        [-1, -1],
        [1, 1],
        [-1, 1]
      ].forEach(([sx, sy]) => {
        const e = [x + sx * 5.5 * z, cy + sy * 9.5 * z];
        L(x + sx * r * 0.5, cy + sy * r * 0.87, e[0], e[1]);
        L(e[0], e[1], e[0] + sx * 2.6 * z, e[1] - sy * 0.3 * z, 1.1);
      });
    },
    // Graduador (09-93-37): palanca con un pequeño triángulo
    grad: () => {
      const e = palanca();
      L(e[0] - 1.27 * z, e[1] + 2.2 * z, e[0] + 2.6 * z, e[1] + 2.2 * z, 1);
      L(e[0] + 2.6 * z, e[1] + 2.2 * z, e[0] + 2.6 * z, e[1] - 0.4 * z, 1);
    },
    // Unipolar con jalador (09-93-38): palanca con un tirador que baja
    jal: () => {
      const e = palanca();
      L(e[0], e[1], e[0] + 1.8 * z, e[1] + 0.6 * z, 1);
      flecha(e[0] + 1.8 * z, e[1] + 0.6 * z, e[0] + 1.8 * z, e[1] + 4.6 * z);
    },
    // Forma literal: con lámpara piloto, con tirador, de puerta, a prueba de explosión o de agua, pulsador o
    // contactor y de tiempo (09-93-29, 38, 39, 40, 41, 42 y 47)
    intL: () => intS("L"),
    intT: () => intS("T"),
    intP: () => intS("P"),
    int2PE: () => intS("2/PE"),
    int3PA: () => intS("3/PA"),
    intC: () => intS("C"),
    intTi: () => intS("t"),
    // --- Pulsadores y temporizadores ---
    // Botón de presión con lámpara indicadora (09-93-44)
    pulL: () => {
      C(x, y, 5.5 * z);
      C(x, y, 3 * z, { fi: "none" });
      L(x - 2.1 * z, y - 2.1 * z, x + 2.1 * z, y + 2.1 * z, 1);
      L(x + 2.1 * z, y - 2.1 * z, x - 2.1 * z, y + 2.1 * z, 1);
    },
    // Botón protegido contra un funcionamiento involuntario (09-93-45): con la cubierta a un lado
    pulProt: () => {
      C(x, y, 5.5 * z);
      C(x, y, 3 * z, { fi: "none" });
      C(x, y, 1 * z, { fi: INK_S, st: "" });
      L(x + 6 * z, y - 8 * z, x + 6 * z, y - 6 * z, 1.1);
      L(x + 6 * z, y - 6 * z, x + 7.5 * z, y - 6 * z, 1.1);
      L(x + 7.5 * z, y - 6 * z, x + 7.5 * z, y + 6 * z, 1.1);
      L(x + 7.5 * z, y + 6 * z, x + 6 * z, y + 6 * z, 1.1);
      L(x + 6 * z, y + 6 * z, x + 6 * z, y + 8 * z, 1.1);
    },
    // Cronómetro, aparato limitador de duración (09-93-46)
    crono: () => {
      R(x - 7 * z, y - 3.5 * z, 14 * z, 7 * z, { fi: "#fff" });
      T(x, y + 2.3 * z, "t", { s: 7 * z, b: 1, it: 1, a: "middle" });
    },
    // Interruptor horario (09-93-47): reloj y contacto en un recuadro
    horario: () => {
      R(x - 11 * z, y - 5 * z, 22 * z, 10 * z, { fi: "#fff" });
      C(x - 5 * z, y, 3 * z, { fi: "none" });
      L(x - 5 * z, y, x - 5 * z, y - 2.2 * z, 1);
      L(x - 5 * z, y, x - 3.2 * z, y, 1);
      L(x + 1 * z, y, x + 3 * z, y, 1);
      L(x + 3 * z, y, x + 6.2 * z, y - 1.8 * z, 1);
      L(x + 6.4 * z, y, x + 8.5 * z, y, 1);
    },
    // Dispositivo de maniobra accionado por una tecla (09-93-48)
    tecla: () => {
      R(x - 4.5 * z, y - 6.5 * z, 9 * z, 13 * z, { fi: "#fff" });
      C(x, y - 1.6 * z, 1.6 * z, { fi: "none" });
      L(x - 0.8 * z, y - 0.2 * z, x - 2 * z, y + 3.6 * z, 1);
      L(x - 2 * z, y + 3.6 * z, x + 2 * z, y + 3.6 * z, 1);
      L(x + 2 * z, y + 3.6 * z, x + 0.8 * z, y - 0.2 * z, 1);
    },
    // --- Iluminación ---
    // Posición de la toma de iluminación (09-93-49) y en la pared (09-93-50), con la canalización
    posLuz: () => {
      L(x - 9 * z, y - 0.5 * z, x + 0.5 * z, y - 0.5 * z, 1);
      L(x - 9 * z, y + 0.5 * z, x + 0.5 * z, y + 0.5 * z, 1);
      L(x - 0.5 * z, y - 3 * z, x + 5.5 * z, y + 3 * z, 1.3);
      L(x + 5.5 * z, y - 3 * z, x - 0.5 * z, y + 3 * z, 1.3);
    },
    posLuzP: () => {
      S.posLuz();
      L(x + 6 * z, y - 4.5 * z, x + 6 * z, y + 4.5 * z, 1.4);
    },
    luzEmp: () => luz(false, true),
    braqEmp: () => luz(true, true),
    fluor: () => fluor(false),
    fluorEmp: () => fluor(true),
    fluorH: () => fluor(false, true),
    fluorHE: () => fluor(true, true),
    // Lámpara, símbolo general (09-93-59): círculo con aspa
    lamp: () => {
      C(x, y, 4.5 * z, { fi: "#fff" });
      L(x - 3.2 * z, y - 3.2 * z, x + 3.2 * z, y + 3.2 * z, 1.1);
      L(x + 3.2 * z, y - 3.2 * z, x - 3.2 * z, y + 3.2 * z, 1.1);
    },
    // Luminaria, símbolo general (09-93-60), con tres tubos (09-93-61) y con cinco (09-93-62)
    lumG: () => {
      L(x - 8 * z, y, x + 8 * z, y, 1.4);
      L(x - 8 * z, y - 2.2 * z, x - 8 * z, y + 2.2 * z, 1.4);
      L(x + 8 * z, y - 2.2 * z, x + 8 * z, y + 2.2 * z, 1.4);
    },
    lum3: () => {
      [-1.8, 0, 1.8].forEach(d => L(x - 8 * z, y + d * z, x + 8 * z, y + d * z, 1.2));
      L(x - 8 * z, y - 3 * z, x - 8 * z, y + 3 * z, 1.4);
      L(x + 8 * z, y - 3 * z, x + 8 * z, y + 3 * z, 1.4);
    },
    lum5: () => {
      S.lumG();
      L(x - 1.3 * z, y + 2.2 * z, x + 1.3 * z, y - 2.2 * z, 1.1);
      T(x + 1.6 * z, y - 3 * z, "5", { s: 5.5 * z, b: 1 });
    },
    // Proyector (09-93-63), iluminación proyectada (09-93-64) y proyector de iluminación (09-93-65)
    proy: () => proyector(),
    proyIl: () => {
      proyector();
      flecha(x + 3 * z, y - 1.6 * z, x + 9 * z, y - 1.6 * z);
      flecha(x + 3 * z, y + 1.6 * z, x + 9 * z, y + 1.6 * z);
    },
    proyDir: () => {
      proyector();
      flecha(x + 2.5 * z, y - 2.5 * z, x + 7 * z, y - 7 * z);
      flecha(x + 2.5 * z, y + 2.5 * z, x + 7 * z, y + 7 * z);
    },
    // Aparato auxiliar para la lámpara de descarga (09-93-66)
    aux: () => {
      R(x - 6 * z, y - 3.5 * z, 12 * z, 7 * z, { fi: "#fff" });
      R(x - 3.2 * z, y - 0.8 * z, 6.4 * z, 1.6 * z, { fi: INK_S, st: "" });
    },
    // --- Varios ---
    // Ventilador (09-93-70): con la canalización desde la izquierda
    vent: () => {
      L(x - 10 * z, y, x - 4.5 * z, y);
      R(x - 4.5 * z, y - 4.5 * z, 9 * z, 9 * z, { fi: "#fff" });
      C(x - 1.4 * z, y, 1.4 * z, { fi: "none" });
      C(x + 1.4 * z, y, 1.4 * z, { fi: "none" });
    },
    // Reloj, registrador horario (09-93-71)
    relojR: () => {
      R(x - 4.5 * z, y - 6 * z, 9 * z, 12 * z, { fi: "#fff" });
      L(x - 3 * z, y - 3.8 * z, x + 3 * z, y - 3.8 * z, 1);
      C(x, y + 1.4 * z, 3.2 * z, { fi: "none" });
      L(x, y + 1.4 * z, x, y - 0.6 * z, 1);
      L(x, y + 1.4 * z, x + 1.8 * z, y + 1.4 * z, 1);
    },
    // Cerradura eléctrica (09-93-72)
    cerr: () => {
      L(x - 7 * z, y - 2.5 * z, x + 2 * z, y - 2.5 * z);
      L(x + 2 * z, y - 2.5 * z, x + 6 * z, y + 2.5 * z);
      L(x + 6 * z, y + 2.5 * z, x - 7 * z, y + 2.5 * z);
      L(x - 7 * z, y + 2.5 * z, x - 7 * z, y - 2.5 * z);
      L(x + 2 * z, y - 2.5 * z, x + 2 * z, y + 2.5 * z);
      arco(x - 2.5 * z, y + 1 * z, 1.6 * z, Math.PI, 2 * Math.PI, 1);
    },
    // Panel de distribución o centro de control (09-91-16): rectángulo rayado
    tabD: () => {
      const w = 22 * z,
        h = 11 * z,
        x0 = x - w / 2,
        y0 = y - h / 2;
      R(x0, y0, w, h, { fi: "#fff" });
      // Rayado a 45° dentro del rectángulo: rectas v = u + c (u hacia la derecha y v hacia arriba desde la esquina
      // inferior izquierda), recortadas al rectángulo
      for (let c = -w + 2.4 * z; c < h; c += 2.4 * z) {
        const u0 = Math.max(0, -c),
          u1 = Math.min(w, h - c);
        L(x0 + u0, y0 + h - (u0 + c), x0 + u1, y0 + h - (u1 + c), 0.8);
      }
    },
    // Tablero empotrado: rectángulo con el triángulo inferior derecho en negro
    tab: () => {
      const w = 22 * z,
        h = 11 * z;
      R(x - w / 2, y - h / 2, w, h, { fi: "#fff" });
      TRI(x - w / 2, y + h / 2, x + w / 2, y + h / 2, x + w / 2, y - h / 2);
    },
    // Contador de energía: rectángulo dividido, con «Wh» en la parte inferior
    med: () => {
      const w = 13 * z,
        h = 17 * z;
      R(x - w / 2, y - h / 2, w, h, { fi: "#fff" });
      L(x - w / 2, y - h / 2 + 5 * z, x + w / 2, y - h / 2 + 5 * z, 1);
      T(x, y + 5.5 * z, "Wh", { s: 5.5 * z, b: 1, a: "middle" });
    },
    // Contador de energía trifásico: el mismo 08-80-22 con «3∼» (corriente alterna trifásica, IEC 60617) arriba
    med3: () => {
      const w = 13 * z,
        h = 17 * z;
      R(x - w / 2, y - h / 2, w, h, { fi: "#fff" });
      L(x - w / 2, y - h / 2 + 5 * z, x + w / 2, y - h / 2 + 5 * z, 1);
      T(x, y - h / 2 + 4 * z, "3∼", { s: 3.8 * z, b: 1, a: "middle" });
      T(x, y + 5.5 * z, "Wh", { s: 5.5 * z, b: 1, a: "middle" });
    },
    // Banco de medidores (criterio de la plataforma, no es un símbolo de la norma): una caja con cuatro contadores
    // 08-80-22 en fila y «BM» abajo, como se ve en planta
    bmed: () => {
      const w = 40 * z,
        h = 17 * z;
      R(x - w / 2, y - h / 2, w, h, { fi: "#fff" });
      for (let i = 0; i < 4; i++) {
        const cx = x - w / 2 + (i + 0.5) * (w / 4);
        R(cx - 3.5 * z, y - h / 2 + 2 * z, 7 * z, 8 * z, { fi: "#fff" });
        L(cx - 3.5 * z, y - h / 2 + 4.5 * z, cx + 3.5 * z, y - h / 2 + 4.5 * z, 0.8);
      }
      T(x, y + 6 * z, "BM", { s: 5 * z, b: 1, a: "middle" });
    },
    // Caja (09-93-08) y canalizaciones hacia arriba y hacia abajo (09-93-05/06)
    caja: () => {
      C(x, y, 5 * z);
      C(x, y, 0.6 * z, { fi: INK_S, st: "" });
    },
    subida: () => {
      L(x - 9 * z, y + 4 * z, x + 2 * z, y + 4 * z);
      L(x + 2 * z, y + 4 * z, x + 8 * z, y - 4 * z);
      TRI(x + 8 * z, y - 4 * z, x + 4.2 * z, y - 2.6 * z, x + 6.6 * z, y - 0.6 * z);
    },
    bajada: () => {
      L(x - 9 * z, y - 4 * z, x + 2 * z, y - 4 * z);
      L(x + 2 * z, y - 4 * z, x + 8 * z, y + 4 * z);
      TRI(x + 8 * z, y + 4 * z, x + 4.2 * z, y + 2.6 * z, x + 6.6 * z, y + 0.6 * z);
    },
    // Conductor neutro (09-93-01: trazo con punto) y de protección (09-93-02: trazo con tope)
    neutro: () => {
      L(x - 10 * z, y, x + 10 * z, y);
      L(x - 2 * z, y + 4 * z, x + 2 * z, y - 4 * z);
      C(x + 2 * z, y - 4 * z, 1.3 * z, { fi: INK_S, st: "" });
    },
    prot: () => {
      L(x - 10 * z, y, x + 10 * z, y);
      L(x - 2 * z, y + 4 * z, x + 2 * z, y - 4 * z);
      L(x, y - 4 * z, x + 4 * z, y - 4 * z);
    },
    // Interruptor automático (07-72-21): contacto con aspa
    itm: () => {
      L(x, y - 10 * z, x, y - 5 * z);
      L(x - 1.5 * z, y - 6.5 * z, x + 1.5 * z, y - 3.5 * z, 1);
      L(x + 1.5 * z, y - 6.5 * z, x - 1.5 * z, y - 3.5 * z, 1);
      L(x - 4 * z, y - 4 * z, x, y + 5 * z, 1.3);
      L(x, y + 5 * z, x, y + 10 * z);
    },
    // Interruptor diferencial (07-72-17): contacto con aspa y toroide
    dif: () => {
      S.itm();
      o.push(
        `<ellipse cx="${px2(x)}" cy="${px2(y + 8 * z)}" rx="${px2(4.5 * z)}" ry="${px2(1.8 * z)}" fill="none" stroke="${INK_S}" stroke-width="1"/>`
      );
      L(x - 4.5 * z, y + 8 * z, x - 7 * z, y + 8 * z, 0.8, INK_S, "2 1.5");
      L(x - 7 * z, y + 8 * z, x - 7 * z, y - 1 * z, 0.8, INK_S, "2 1.5");
      L(x - 7 * z, y - 1 * z, x - 3 * z, y - 1 * z, 0.8, INK_S, "2 1.5");
    },
    // Contactor (07-72-18): contacto con semicírculo
    ctr: () => {
      L(x, y - 10 * z, x, y - 3.5 * z);
      for (let i = 0; i < 6; i++) {
        const a1 = (Math.PI * i) / 6 - Math.PI / 2,
          a2 = (Math.PI * (i + 1)) / 6 - Math.PI / 2,
          rr = 1.8 * z;
        L(
          x - rr * Math.cos(a1),
          y - 5.3 * z + rr * Math.sin(a1),
          x - rr * Math.cos(a2),
          y - 5.3 * z + rr * Math.sin(a2),
          1
        );
      }
      L(x - 4 * z, y - 4 * z, x, y + 5 * z, 1.3);
      L(x, y + 5 * z, x, y + 10 * z);
    },
    // Pararrayos, DPS (07-75-23): rectángulo con flecha
    dps: () => {
      L(x, y - 10 * z, x, y - 6 * z);
      R(x - 3 * z, y - 6 * z, 6 * z, 12 * z, { fi: "#fff" });
      L(x, y - 6 * z, x, y + 2 * z, 1);
      TRI(x - 1.8 * z, y + 1 * z, x + 1.8 * z, y + 1 * z, x, y + 4 * z);
      L(x, y + 6 * z, x, y + 10 * z);
    },
    // Relé de medición (07-73-01) de tensión: sobretensión y subtensión (U> y U<, como en 07-73-19)
    rel: () => {
      R(x - 9 * z, y - 10 * z, 18 * z, 20 * z, { fi: "#fff" });
      T(x, y - 1.5 * z, "U>", { s: 6.5 * z, b: 1, it: 1, a: "middle" });
      T(x, y + 7 * z, "U<", { s: 6.5 * z, b: 1, it: 1, a: "middle" });
    },
    // Reloj (08-80-40): círculo con las agujas
    reloj: () => {
      C(x, y, 7 * z);
      L(x, y, x, y - 5 * z, 1.1);
      L(x, y, x + 4 * z, y, 1.1);
    },
    // Tierra (03-31-44) y protección a tierra (03-31-46)
    tierra: () => {
      L(x, y - 8 * z, x, y);
      L(x - 6 * z, y, x + 6 * z, y, 1.4);
      L(x - 4 * z, y + 2.5 * z, x + 4 * z, y + 2.5 * z, 1.4);
      L(x - 2 * z, y + 5 * z, x + 2 * z, y + 5 * z, 1.4);
    },
    pat: () => {
      L(x, y - 10 * z, x, y - 1 * z);
      C(x, y + 1 * z, 7.5 * z, { fi: "none" });
      L(x - 4.5 * z, y - 1 * z, x + 4.5 * z, y - 1 * z, 1.3);
      L(x - 3 * z, y + 1.5 * z, x + 3 * z, y + 1.5 * z, 1.3);
      L(x - 1.5 * z, y + 4 * z, x + 1.5 * z, y + 4 * z, 1.3);
    }
  };
  if (!S[k]) return false;
  S[k]();
  return true;
}
/* Señal de advertencia «¡Peligro! Riesgo eléctrico» (Norma DGE, Parte III, 141-02-02): triángulo equilátero de
   lado d con fondo amarillo, banda negra de 0.10 d y el rayo negro (Figura 134-03). Centrada en el baricentro del
   triángulo (cx, cy). Solo triángulos, para que el DXF la rellene (SOLID). */
function senalRiesgoElectrico(o, cx, cy, d, borde = "") {
  const { TRI } = trazos(o),
    tri = (s, fi) => {
      const h = s * 0.866;
      TRI(cx, cy - (2 * h) / 3, cx + s / 2, cy + h / 3, cx - s / 2, cy + h / 3, fi);
    };
  // Margen blanco de la versión con texto (3 unidades de 100, sección 133)
  if (borde) tri(d * 1.1, borde);
  // Negro de la norma (en AutoCAD, color 7: se imprime negro)
  tri(d, "#000000");
  // El fondo amarillo queda a 0.10 d de cada lado: su lado es d (r − 0.10 d) / r, con r = d / (2√3)
  tri(d * (1 - 0.1 * 2 * Math.sqrt(3)), "#ffd200");
  // Rayo: barra superior, escalón, barra inferior y punta de flecha (coordenadas en unidades de d)
  const P = [
    [
      [0.03, -0.34],
      [0.1, -0.34],
      [0.01, -0.06]
    ],
    [
      [0.03, -0.34],
      [0.01, -0.06],
      [-0.06, -0.06]
    ],
    [
      [-0.06, -0.08],
      [0.07, -0.08],
      [0.07, -0.02]
    ],
    [
      [-0.06, -0.08],
      [0.07, -0.02],
      [-0.06, -0.02]
    ],
    [
      [0.0, -0.06],
      [0.07, -0.06],
      [0.01, 0.15]
    ],
    [
      [0.0, -0.06],
      [0.01, 0.15],
      [-0.06, 0.15]
    ],
    [
      [-0.11, 0.12],
      [0.05, 0.15],
      [-0.06, 0.27]
    ]
  ];
  const e = 0.72,
    tx = ([x, y]) => [cx + (x - 0.02) * e * d, cy + (y * e - 0.02) * d];
  P.forEach(t => {
    const [a, b, c] = t.map(tx);
    TRI(a[0], a[1], b[0], b[1], c[0], c[1], "#000000");
  });
}
// Versión con texto (señal de símbolo con texto): fondo gris oscuro, señal arriba y texto blanco abajo, centrado
// (la norma pide la señal arriba y el texto abajo; no fija su alineación)
function senalRiesgoTexto(o, x, y, w) {
  const { R, T } = trazos(o),
    h = w * 1.45;
  R(x, y, w, h, { st: "", fi: "#1f2328" });
  senalRiesgoElectrico(o, x + w / 2, y + w * 0.47, w * 0.74, "#ffffff");
  ["¡Peligro!", "Riesgo", "eléctrico"].forEach((t, i) =>
    T(x + w / 2, y + w * (0.98 + i * 0.15), t, { s: w * 0.13, a: "middle", f: "#ffffff" })
  );
  return h;
}
