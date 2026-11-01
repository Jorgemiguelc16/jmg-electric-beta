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
   03-31-44/46. Para el editor de diseño (js/diseno.js) también: interruptores bipolar, de tres y de cuatro vías
   09-93-31/32/33, tomacorriente a prueba de agua 09-93-19, bloque autónomo de emergencia 09-93-68, pulsador de
   timbre 09-93-43 y timbre 08-80-49. */
function simboloDGE(o, k, x, y, z = 1) {
  const { L, T, R, C, TRI } = trazos(o);
  // Tomacorriente: círculo atravesado por n líneas que llegan desde la izquierda; letra abajo a la derecha
  const toma = (n, letra) => {
    const cx = x + 2 * z,
      r = 5.5 * z;
    C(cx, y, r);
    const d = n === 3 ? 2.2 * z : 1.5 * z;
    (n === 3 ? [-d, 0, d] : [-d, d]).forEach(dy => {
      const hx = Math.sqrt(Math.max(r * r - dy * dy, 0));
      L(x - 8 * z, y + dy, cx + hx, y + dy, 1.1);
    });
    if (letra) T(cx + r + 0.5 * z, y + 7.5 * z, letra, { s: 7 * z, b: 1, it: 1 });
  };
  // Salida de alumbrado: círculo con cuatro trazos radiales; en pared, la barra del muro a la izquierda
  const luz = pared => {
    const r = 5 * z,
      t = 3.5 * z;
    C(x, y, r);
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
      C(x, y, 1.5 * z, { fi: INK_S, st: "" });
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
    // Caja (09-93-08) y canalizaciones hacia arriba y hacia abajo (09-93-05/06)
    caja: () => C(x, y, 5 * z),
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
