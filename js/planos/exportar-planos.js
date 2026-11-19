/* EXPORTAR LOS PLANOS
   Tamaños de lámina (LAMINAS), svgDxf(): el SVG de cualquier plano a DXF para AutoCAD, con sus capas y colores, y
   svgPng(): el SVG a imagen PNG. Los usan la cinta Planos, la ventana DXF, el Excel y el expediente. */
/* SVG del unifilar → DXF para AutoCAD (formato R12, en mm sobre la lámina elegida) */
const LAMINAS = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594] };
function svgDxf(svgTxt, op = {}) {
  const lam = LAMINAS[op.lamina] || LAMINAS.A3,
    esq = op.colores || "jmg";
  const doc = new DOMParser().parseFromString(svgTxt, "image/svg+xml"),
    root = doc.documentElement;
  const W = parseFloat(root.getAttribute("width")) || 1,
    H = parseFloat(root.getAttribute("height")) || 1;
  const k = Math.min((lam[0] - 20) / W, (lam[1] - 20) / H),
    ox = (lam[0] - W * k) / 2,
    oy = (lam[1] - H * k) / 2;
  const n = v => parseFloat(v) || 0,
    f = v => (+v).toFixed(3),
    X = x => f(ox + x * k),
    Y = y => f(oy + (H - y) * k);
  const hex = c => {
    c = (c || "").toLowerCase();
    return c === "#fff" ? "#ffffff" : c;
  };
  // Colores: JMG (azul y cobre) · monocromo (impresión) · por capa (estilo AutoCAD)
  // Esquema JMG en colores vivos: azul, naranja cobre, cian, verde, rojo y amarillo
  const ACI = {
    "#14212e": 7,
    "#000000": 7,
    "#14304f": 150,
    "#9a5a23": 30,
    "#5a6775": 8,
    "#2f7a4b": 3,
    "#bfc8d2": 8,
    "#ffffff": 255,
    "#ffd200": 2,
    "#1f2328": 250,
    "#b42318": 1,
    "#c62828": 1,
    "#1565c0": 150,
    "#8a9199": 8,
    "#c98a4b": 32
  };
  // Rellenos sólidos: los oscuros de las láminas y los colores de las fases (barras del balance, LED)
  const OSCURO = [
    "#14304f",
    "#9a5a23",
    "#1f2328",
    "#000000",
    "#c62828",
    "#1565c0",
    "#b42318",
    "#2f7a4b",
    "#c98a4b",
    "#ffd200",
    "#5a6775"
  ];
  // Rellenos claros del dibujo de los tableros (gabinete, módulos, riel, canaletas), en grises de AutoCAD para que se
  // vean con volumen como en pantalla; lo que va encima se dibuja en tonos oscuros (esquema JMG)
  const CLARO = {
    "#ffffff": 254,
    "#f3f6f9": 255,
    "#eaf2fb": 255,
    "#e3e9f0": 254,
    "#d9eedf": 254,
    "#e6e9ed": 253,
    "#d5dae0": 253,
    "#c9ced5": 252,
    // Tapa ahumada del tablero de PVC y su brillo
    "#8f98a3": 8,
    "#a9b1ba": 9,
    // Barra de tierra, en verde como en pantalla
    "#2f7a4b": 3
  };
  const SOBRE_CLARO = { "#14212e": 250, "#000000": 250, "#1f2328": 250, "#5a6775": 8, "#bfc8d2": 8, "#8a9199": 8 };
  const claros = [],
    sobreClaro = (x, y) => claros.some(([a, b, w, h]) => x >= a && x <= a + w && y >= b && y <= b + h);
  const col = (c, esTexto, claro) => {
    c = hex(c);
    if (esq === "capas") return 256;
    if (esq === "mono") return 7;
    if (claro && SOBRE_CLARO[c] !== undefined) return SOBRE_CLARO[c];
    // Los textos secundarios (gris en pantalla) van en cian para que se lean bien
    if (esTexto && c === "#5a6775") return 4;
    // El azul de los textos, más claro para que se lea sobre el fondo oscuro de AutoCAD
    if (esTexto && c === "#14304f") return 140;
    return ACI[c] ?? 7;
  };
  const E = [],
    add = (...kv) => {
      for (let i = 0; i < kv.length; i += 2) E.push(kv[i], kv[i + 1]);
    };
  const linea = (x1, y1, x2, y2, ly, c) => add(0, "LINE", 8, ly, 62, c, 10, X(x1), 20, Y(y1), 11, X(x2), 21, Y(y2));
  const pline = (pts, ly, c, w, cerrada) => {
    add(0, "POLYLINE", 8, ly, 62, c, 66, 1, 10, "0.0", 20, "0.0", 70, cerrada ? 1 : 0, 40, f(w), 41, f(w));
    pts.forEach(([x, y]) => add(0, "VERTEX", 8, ly, 10, X(x), 20, Y(y)));
    add(0, "SEQEND", 8, ly);
  };
  const solido = (x, y, w, h, ly, c) =>
    add(
      0,
      "SOLID",
      8,
      ly,
      62,
      c,
      10,
      X(x),
      20,
      Y(y),
      11,
      X(x + w),
      21,
      Y(y),
      12,
      X(x),
      22,
      Y(y + h),
      13,
      X(x + w),
      23,
      Y(y + h)
    );
  const enc = t =>
    Array.from(String(t))
      .map(ch => {
        const c = ch.codePointAt(0);
        return c < 128 ? ch : "\\U+" + c.toString(16).toUpperCase().padStart(4, "0");
      })
      .join("");
  const fondos = [];
  // Capa: la del propio elemento o la de su grupo (data-capa), o la que corresponde a su tipo
  const capaDe = (el, d) => {
    const g = el.closest ? el.closest("[data-capa]") : null;
    return (g && g.getAttribute("data-capa")) || d;
  };
  root.querySelectorAll("*").forEach(el => {
    const t = el.tagName.toLowerCase(),
      st = hex(el.getAttribute("stroke")),
      fi = hex(el.getAttribute("fill")),
      sw = n(el.getAttribute("stroke-width")) || 1;
    if (t === "line") {
      const dash = el.getAttribute("stroke-dasharray"),
        x1 = n(el.getAttribute("x1")),
        y1 = n(el.getAttribute("y1")),
        x2 = n(el.getAttribute("x2")),
        y2 = n(el.getAttribute("y2"));
      const capa = capaDe(el, ""),
        cl = sobreClaro((x1 + x2) / 2, (y1 + y2) / 2);
      // Punteadas: la de tierra (verde) en E-TIERRA; las demás (reservas, niveles) en su capa
      if (dash)
        return linea(
          x1,
          y1,
          x2,
          y2,
          capa || (st === "#2f7a4b" ? "E-TIERRA" : "E-RESERVA"),
          esq === "capas" ? 256 : esq === "mono" ? 7 : col(st, false, cl)
        );
      if (sw >= 3)
        return pline(
          [
            [x1, y1],
            [x2, y2]
          ],
          "E-BARRAS",
          // Cada barra en su color: cobre en el unifilar; R, S, T, N y tierra en el banco de medidores
          esq === "capas" ? 256 : esq === "mono" ? 7 : col(st),
          sw * k
        );
      const ly = capa || (st === "#2f7a4b" ? "E-TIERRA" : "E-UNIFILAR");
      if (sw >= 1.5)
        return pline(
          [
            [x1, y1],
            [x2, y2]
          ],
          ly,
          col(st, false, cl),
          0.35
        );
      return linea(x1, y1, x2, y2, ly, col(st, false, cl));
    }
    if (t === "rect") {
      const x = n(el.getAttribute("x")),
        y = n(el.getAttribute("y")),
        w = n(el.getAttribute("width")),
        h = n(el.getAttribute("height"));
      if (!st && x === 0 && y === 0) return;
      const cl = sobreClaro(x + w / 2, y + h / 2);
      if (esq === "jmg" && CLARO[fi] && capaDe(el, "") === "E-TABLEROS") {
        solido(x, y, w, h, "E-RELLENOS", CLARO[fi]);
        claros.push([x, y, w, h]);
      } else if (fi && OSCURO.includes(fi)) {
        solido(x, y, w, h, capaDe(el, "E-RELLENOS"), esq === "capas" ? 256 : esq === "mono" ? 9 : col(fi));
        fondos.push([x, y, w, h]);
      }
      if (st) {
        const marco = x === 6 && y === 4;
        pline(
          [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h]
          ],
          marco ? "E-MARCO" : capaDe(el, "E-CUADROS"),
          col(st, false, cl),
          marco ? 0.5 : sw >= 1.2 ? 0.25 : 0,
          true
        );
      }
      return;
    }
    if (t === "circle") {
      add(
        0,
        "CIRCLE",
        8,
        capaDe(el, "E-SIMBOLOS"),
        62,
        col(st || fi, false, sobreClaro(n(el.getAttribute("cx")), n(el.getAttribute("cy")))),
        10,
        X(n(el.getAttribute("cx"))),
        20,
        Y(n(el.getAttribute("cy"))),
        40,
        f(n(el.getAttribute("r")) * k)
      );
      if (fi && fi !== "#ffffff" && fi !== "none" && n(el.getAttribute("r")) < 4) {
        const cx = n(el.getAttribute("cx")),
          cy = n(el.getAttribute("cy")),
          r = n(el.getAttribute("r"));
        pline(
          [
            [cx - r / 2, cy],
            [cx + r / 2, cy]
          ],
          capaDe(el, "E-SIMBOLOS"),
          col(fi),
          r * k * 1.6
        );
      }
      return;
    }
    if (t === "ellipse") {
      const cx = n(el.getAttribute("cx")),
        cy = n(el.getAttribute("cy")),
        rx = n(el.getAttribute("rx")),
        ry = n(el.getAttribute("ry")),
        P = [];
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * 2 * Math.PI;
        P.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
      return pline(P, capaDe(el, "E-SIMBOLOS"), col(st), 0, true);
    }
    if (t === "path") {
      const P = [];
      (el.getAttribute("d") || "").replace(/([MLZ])\s*([-\d.]+)?[\s,]*([-\d.]+)?/gi, (m, c, a, b) => {
        if (!/z/i.test(c)) P.push([n(a), n(b)]);
        return m;
      });
      if (P.length >= 3) {
        const c = col(fi || st, false, sobreClaro(P[0][0], P[0][1])),
          q = P.length === 4 ? P[3] : P[2];
        add(
          0,
          "SOLID",
          8,
          capaDe(el, "E-SIMBOLOS"),
          62,
          c,
          10,
          X(P[0][0]),
          20,
          Y(P[0][1]),
          11,
          X(P[1][0]),
          21,
          Y(P[1][1]),
          12,
          X(q[0]),
          22,
          Y(q[1]),
          13,
          X(P[2][0]),
          23,
          Y(P[2][1])
        );
      }
      return;
    }
    if (t === "text") {
      const x = n(el.getAttribute("x")),
        y = n(el.getAttribute("y")),
        fs = n(el.getAttribute("font-size")) || 9,
        an = el.getAttribute("text-anchor"),
        b = el.getAttribute("font-weight") === "700";
      const tr = (el.getAttribute("transform") || "").match(/rotate\(([-\d.]+)/),
        rot = tr ? -n(tr[1]) : 0,
        j = an === "middle" ? 1 : an === "end" ? 2 : 0;
      let c = col(fi, true, sobreClaro(x, y));
      if (esq === "mono" && fi === "#ffffff") c = 7;
      if (esq === "capas") c = 256;
      add(
        0,
        "TEXT",
        8,
        capaDe(el, "E-TEXTOS"),
        62,
        c,
        7,
        b ? "JMG_ARIAL_N" : "JMG_ARIAL",
        10,
        X(x),
        20,
        Y(y),
        40,
        f(fs * 0.72 * k),
        1,
        enc(el.textContent)
      );
      if (rot) add(50, rot.toFixed(2));
      if (j) add(72, j, 11, X(x), 21, Y(y));
    }
  });
  // Lámina: borde del papel (no se imprime en capa DEFPOINTS)
  add(0, "POLYLINE", 8, "Defpoints", 62, 8, 66, 1, 10, "0.0", 20, "0.0", 70, 1);
  [
    [0, 0],
    [lam[0], 0],
    [lam[0], lam[1]],
    [0, lam[1]]
  ].forEach(([x, y]) => add(0, "VERTEX", 8, "Defpoints", 10, f(x), 20, f(y)));
  add(0, "SEQEND", 8, "Defpoints");
  const CAPAS = {
    "E-UNIFILAR": [7, "CONTINUOUS"],
    "E-BARRAS": [30, "CONTINUOUS"],
    "E-RESERVA": [8, "DASHED"],
    "E-TIERRA": [3, "CONTINUOUS"],
    "E-SIMBOLOS": [4, "CONTINUOUS"],
    "E-CUADROS": [5, "CONTINUOUS"],
    "E-MARCO": [5, "CONTINUOUS"],
    "E-RELLENOS": [9, "CONTINUOUS"],
    "E-TEXTOS": [7, "CONTINUOUS"],
    "E-ROTULO": [5, "CONTINUOUS"],
    "E-LEYENDA": [4, "CONTINUOUS"],
    "E-ELEVACION": [7, "CONTINUOUS"],
    "E-NIVELES": [8, "DASHED"],
    "E-TUBERIA": [30, "CONTINUOUS"],
    "E-DETALLE": [7, "CONTINUOUS"],
    "E-TABLEROS": [7, "CONTINUOUS"],
    "E-CABLEADO": [7, "CONTINUOUS"],
    "E-NOTAS": [7, "CONTINUOUS"],
    Defpoints: [8, "CONTINUOUS"]
  };
  // Solo las capas que el dibujo usa (código 8 de cada entidad), en el orden de la lista
  const usadas = new Set();
  for (let i = 0; i < E.length; i += 2) if (E[i] === 8) usadas.add(E[i + 1]);
  const capas = Object.keys(CAPAS)
    .filter(k => usadas.has(k))
    .concat([...usadas].filter(k => !CAPAS[k]))
    .map(k => [k, ...(CAPAS[k] || [7, "CONTINUOUS"])]);
  const head = [
    0,
    "SECTION",
    2,
    "HEADER",
    9,
    "$ACADVER",
    1,
    "AC1009",
    9,
    "$DWGCODEPAGE",
    3,
    "ANSI_1252",
    9,
    "$INSBASE",
    10,
    "0.0",
    20,
    "0.0",
    30,
    "0.0",
    9,
    "$EXTMIN",
    10,
    "0.0",
    20,
    "0.0",
    30,
    "0.0",
    9,
    "$EXTMAX",
    10,
    f(lam[0]),
    20,
    f(lam[1]),
    30,
    "0.0",
    9,
    "$LIMMIN",
    10,
    "0.0",
    20,
    "0.0",
    9,
    "$LIMMAX",
    10,
    f(lam[0]),
    20,
    f(lam[1]),
    9,
    "$LTSCALE",
    40,
    "1.0",
    // Vista al abrir: centrada en la lámina y con su altura más un margen (como «Zoom extensión»)
    9,
    "$VIEWCTR",
    10,
    f(lam[0] / 2),
    20,
    f(lam[1] / 2),
    9,
    "$VIEWSIZE",
    40,
    f(lam[1] * 1.04),
    0,
    "ENDSEC",
    0,
    "SECTION",
    2,
    "TABLES",
    0,
    "TABLE",
    2,
    "VPORT",
    70,
    1,
    0,
    "VPORT",
    2,
    "*ACTIVE",
    70,
    0,
    10,
    "0.0",
    20,
    "0.0",
    11,
    "1.0",
    21,
    "1.0",
    12,
    f(lam[0] / 2),
    22,
    f(lam[1] / 2),
    13,
    "0.0",
    23,
    "0.0",
    14,
    "10.0",
    24,
    "10.0",
    15,
    "10.0",
    25,
    "10.0",
    16,
    "0.0",
    26,
    "0.0",
    36,
    "1.0",
    17,
    "0.0",
    27,
    "0.0",
    37,
    "0.0",
    40,
    f(lam[1] * 1.04),
    41,
    f(lam[0] / lam[1]),
    42,
    "50.0",
    43,
    "0.0",
    44,
    "0.0",
    50,
    "0.0",
    51,
    "0.0",
    71,
    0,
    72,
    100,
    73,
    1,
    74,
    3,
    75,
    0,
    76,
    0,
    77,
    0,
    78,
    0,
    0,
    "ENDTAB",
    0,
    "TABLE",
    2,
    "LTYPE",
    70,
    2,
    0,
    "LTYPE",
    2,
    "CONTINUOUS",
    70,
    0,
    3,
    "Solid line",
    72,
    65,
    73,
    0,
    40,
    "0.0",
    0,
    "LTYPE",
    2,
    "DASHED",
    70,
    0,
    3,
    "__  __  __",
    72,
    65,
    73,
    2,
    40,
    f(Math.max(3, 6 * k)),
    49,
    f(Math.max(2, 4 * k)),
    49,
    f(-Math.max(1, 2 * k)),
    0,
    "ENDTAB",
    0,
    "TABLE",
    2,
    "LAYER",
    70,
    capas.length,
    ...capas.flatMap(([nm, c, lt]) => [0, "LAYER", 2, nm, 70, 0, 62, c, 6, lt]),
    0,
    "ENDTAB",
    0,
    "TABLE",
    2,
    "STYLE",
    70,
    2,
    0,
    "STYLE",
    2,
    "JMG_ARIAL",
    70,
    0,
    40,
    "0.0",
    41,
    "1.0",
    50,
    "0.0",
    71,
    0,
    42,
    "2.5",
    3,
    "arial.ttf",
    4,
    "",
    0,
    "STYLE",
    2,
    "JMG_ARIAL_N",
    70,
    0,
    40,
    "0.0",
    41,
    "1.0",
    50,
    "0.0",
    71,
    0,
    42,
    "2.5",
    3,
    "arialbd.ttf",
    4,
    "",
    0,
    "ENDTAB",
    0,
    "ENDSEC",
    0,
    "SECTION",
    2,
    "ENTITIES"
  ];
  const all = [...head, ...E, 0, "ENDSEC", 0, "EOF"];
  let out = "";
  for (let i = 0; i < all.length; i += 2) out += String(all[i]).padStart(3, " ") + "\r\n" + all[i + 1] + "\r\n";
  return out;
}
function svgPng(svg, scale = 2) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = img.width * scale;
        cv.height = img.height * scale;
        const g = cv.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0, cv.width, cv.height);
        ok(cv.toDataURL("image/png"));
      } catch (e) {
        ko(e);
      }
    };
    img.onerror = () => ko(new Error("No se pudo dibujar el diagrama"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
