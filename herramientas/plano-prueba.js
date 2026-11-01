/* Genera pruebas/plano-prueba.dxf, el plano de arquitectura de las pruebas del lector DXF (herramientas/pruebas-dxf.js)
   y de la pestaña Diseño (herramientas/pruebas-ui.mjs): «node herramientas/plano-prueba.js».
   Una vivienda de 10 × 8 m con medidas conocidas y los casos difíciles de un DXF real:
   - coordenadas UTM (x ≈ 230 000, y ≈ 8 180 000), para comprobar que no se pierde precisión;
   - cabecera que dice milímetros aunque está dibujado en metros: la unidad debe salir de las cotas;
   - bloques girados y en espejo, cotas con su bloque, sombreado sólido, tipo de línea de trazos, polilínea con
     curva (una tubería en semicírculo de 1 m de radio), textos con eñe (UTF-8 y \U+00D1), una capa apagada, una
     congelada y un objeto del espacio papel, que no deben verse. */
const fs = require("fs");
const path = require("path");

const OX = 230000,
  OY = 8180000;
const L = [];
const g = (c, v) => L.push(String(c), String(v));
const ent = (t, capa, pares) => {
  g(0, t);
  g(8, capa);
  pares.forEach(([c, v]) => g(c, v));
};
// Cabecera: AutoCAD 2013 (UTF-8), unidad «milímetros» (equivocada a propósito)
g(999, "Plano de prueba de JMG-ELECTRIC: vivienda de 10 x 8 m (herramientas/plano-prueba.js)");
g(0, "SECTION");
g(2, "HEADER");
[
  ["$ACADVER", 1, "AC1027"],
  ["$INSUNITS", 70, 4],
  ["$LTSCALE", 40, 1]
].forEach(([n, c, v]) => {
  g(9, n);
  g(c, v);
});
g(0, "ENDSEC");
// Tablas: tipos de línea y capas
g(0, "SECTION");
g(2, "TABLES");
g(0, "TABLE");
g(2, "LTYPE");
[
  ["CONTINUOUS", []],
  ["DASHED", [0.5, -0.25]]
].forEach(([n, d]) => {
  g(0, "LTYPE");
  g(2, n);
  g(70, 0);
  g(73, d.length);
  g(
    40,
    d.reduce((a, b) => a + Math.abs(b), 0)
  );
  d.forEach(x => g(49, x));
});
g(0, "ENDTAB");
g(0, "TABLE");
g(2, "LAYER");
[
  ["0", 7, 0, "CONTINUOUS"],
  ["MUROS", 7, 0, "CONTINUOUS"],
  ["PUERTAS", 3, 0, "CONTINUOUS"],
  ["EJES", 1, 0, "DASHED"],
  ["TEXTOS", 2, 0, "CONTINUOUS"],
  ["COTAS", 4, 0, "CONTINUOUS"],
  ["TUBERIAS", 30, 0, "CONTINUOUS"],
  ["OCULTA", -5, 0, "CONTINUOUS"],
  ["CONGELADA", 6, 1, "CONTINUOUS"]
].forEach(([n, col, fl, lt]) => {
  g(0, "LAYER");
  g(2, n);
  g(70, fl);
  g(62, col);
  g(6, lt);
});
g(0, "ENDTAB");
g(0, "ENDSEC");
// Bloques: puerta de 0.90 m (hoja y arco de giro) y las cotas
g(0, "SECTION");
g(2, "BLOCKS");
const bloque = (n, x, y, fn) => {
  g(0, "BLOCK");
  g(8, "0");
  g(2, n);
  g(70, n.startsWith("*") ? 1 : 0);
  g(10, x);
  g(20, y);
  g(30, 0);
  fn();
  g(0, "ENDBLK");
  g(8, "0");
};
bloque("PUERTA", 0, 0, () => {
  ent("LINE", "0", [
    [10, 0],
    [20, 0],
    [11, 0],
    [21, 0.9]
  ]);
  ent("ARC", "0", [
    [10, 0],
    [20, 0],
    [40, 0.9],
    [50, 0],
    [51, 90]
  ]);
});
// Cotas horizontal (10.00), vertical (8.00) y del ambiente (6.00), con el texto de la medida
const cotas = [
  ["*D1", [OX, OY - 1, OX + 10, OY - 1], "10.00", 10],
  ["*D2", [OX - 1, OY, OX - 1, OY + 8], "8.00", 8],
  ["*D3", [OX, OY + 9, OX + 6, OY + 9], "6.00", 6]
];
cotas.forEach(([n, [a, b, c, d], t]) =>
  bloque(n, 0, 0, () => {
    ent("LINE", "0", [
      [10, a],
      [20, b],
      [11, c],
      [21, d]
    ]);
    ent("MTEXT", "0", [
      [10, (a + c) / 2],
      [20, (b + d) / 2 + 0.15],
      [40, 0.18],
      [71, 8],
      [1, t]
    ]);
  })
);
g(0, "ENDSEC");
// Dibujo
g(0, "SECTION");
g(2, "ENTITIES");
// Muros: rectángulo cerrado de 10 × 8 (perímetro 36 m) y un muro interior de 8 m en x = 6
ent("LWPOLYLINE", "MUROS", [
  [90, 4],
  [70, 1],
  [10, OX],
  [20, OY],
  [10, OX + 10],
  [20, OY],
  [10, OX + 10],
  [20, OY + 8],
  [10, OX],
  [20, OY + 8]
]);
ent("LINE", "MUROS", [
  [10, OX + 6],
  [20, OY],
  [11, OX + 6],
  [21, OY + 8]
]);
// Columna (círculo de 0.15 m) y su relleno sólido
ent("CIRCLE", "MUROS", [
  [10, OX + 3],
  [20, OY + 4],
  [40, 0.15]
]);
ent("HATCH", "MUROS", [
  [10, 0],
  [20, 0],
  [30, 0],
  [2, "SOLID"],
  [70, 1],
  [71, 0],
  [91, 1],
  [92, 2],
  [72, 0],
  [73, 1],
  [93, 4],
  [10, OX + 8.8],
  [20, OY + 3.8],
  [10, OX + 9.2],
  [20, OY + 3.8],
  [10, OX + 9.2],
  [20, OY + 4.2],
  [10, OX + 8.8],
  [20, OY + 4.2],
  [97, 0],
  [75, 0],
  [76, 1],
  [98, 0]
]);
// Puertas: una girada 90° y otra en espejo (escala X = −1)
ent("INSERT", "PUERTAS", [
  [2, "PUERTA"],
  [10, OX + 6],
  [20, OY + 2],
  [50, 90]
]);
ent("INSERT", "PUERTAS", [
  [2, "PUERTA"],
  [10, OX + 2],
  [20, OY + 8],
  [41, -1],
  [42, 1],
  [50, 0]
]);
// Eje con línea de trazos
ent("LINE", "EJES", [
  [10, OX - 0.5],
  [20, OY + 4],
  [11, OX + 10.5],
  [21, OY + 4]
]);
// Tubería: polilínea con un tramo recto de 2 m y un semicírculo de radio 1 (largo 2 + π)
ent("LWPOLYLINE", "TUBERIAS", [
  [90, 3],
  [70, 0],
  [10, OX + 1],
  [20, OY + 1],
  [42, 0],
  [10, OX + 3],
  [20, OY + 1],
  [42, 1],
  [10, OX + 5],
  [20, OY + 1]
]);
// Textos
ent("TEXT", "TEXTOS", [
  [10, OX + 2],
  [20, OY + 6],
  [40, 0.25],
  [1, "SALA"]
]);
ent("MTEXT", "TEXTOS", [
  [10, OX + 7],
  [20, OY + 7],
  [40, 0.2],
  [71, 1],
  [1, "{\\fArial|b1;COCINA}\\PBAÑO"]
]);
ent("TEXT", "TEXTOS", [
  [10, OX + 7],
  [20, OY + 1],
  [40, 0.2],
  [1, "DORMITORIO NI\\U+00D1OS"]
]);
// Cotas
cotas.forEach(([n, , , m]) =>
  ent("DIMENSION", "COTAS", [
    [2, n],
    [10, 0],
    [20, 0],
    [70, 0],
    [42, m]
  ])
);
// Lo que no debe verse: capa apagada, capa congelada y espacio papel
ent("LINE", "OCULTA", [
  [10, OX],
  [20, OY],
  [11, OX + 10],
  [21, OY + 8]
]);
ent("LINE", "CONGELADA", [
  [10, OX],
  [20, OY + 8],
  [11, OX + 10],
  [21, OY]
]);
ent("LINE", "MUROS", [
  [67, 1],
  [10, 0],
  [20, 0],
  [11, 297],
  [21, 210]
]);
g(0, "ENDSEC");
g(0, "EOF");
fs.writeFileSync(path.join(__dirname, "..", "pruebas", "plano-prueba.dxf"), L.join("\r\n") + "\r\n");
console.log("pruebas/plano-prueba.dxf:", L.length / 2, "pares");
