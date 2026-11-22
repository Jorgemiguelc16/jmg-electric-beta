/* EXPORTAR LOS PLANOS
   Tamaños de lámina (LAMINAS), svgDxf(): el SVG de cualquier plano a DXF de AutoCAD 2013, como se ve en la plataforma, y
   svgPng(): el SVG a imagen PNG. Los usan la cinta Planos, la ventana DXF, el Excel y el expediente. */
/* SVG de cualquier plano → DXF de AutoCAD 2013 (AC1027), en milímetros, con el dibujo de la plataforma:
   - colores: «Colores claros» (los de la plataforma, aclarados para el fondo oscuro de AutoCAD: azul, cobre, cian,
     verde y amarillo, con sus rellenos); «Monocromático» (7, sin rellenos, para imprimir); «Por capas» (256, sin
     rellenos);
   - letras Arial (normal, negrita, cursiva) con la altura de las mayúsculas de Arial (0.716 del tamaño de la letra) y
     la alineación del SVG (izquierda, centro o derecha; línea base, centro, arriba o abajo); tildes y eñes tal cual;
   - rellenos como sombreado sólido (HATCH) y en el mismo orden de dibujo, esquinas redondeadas, elipses, el grosor de
     cada línea (370; desde 0.5 mm, polilínea con ancho) y un tipo de línea por cada patrón de guiones;
   - lo recortado (clip-path de un rectángulo, como el área de dibujo de las láminas) queda recortado.
   Capas: la del grupo (data-capa) o la de su tipo (E-UNIFILAR, E-CUADROS, E-TEXTOS…). Un plano con medidas en
   milímetros (width="841mm", las láminas del diseño) va a su tamaño real; los demás se centran en la lámina elegida.
   op = { lamina, colores: "jmg" (colores claros) | "mono" | "capas" }. svgDxfPiezas() da las entidades de una lámina
   desplazada (dx, dy) para juntar varias en un solo archivo (svgDxfVarias); svgDxf(), el archivo de una. */
const LAMINAS = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594] };
function svgDxfPiezas(svgTxt, op = {}, dx = 0, dy = 0) {
  const esq = op.colores || "jmg",
    doc = new DOMParser().parseFromString(svgTxt, "image/svg+xml"),
    root = doc.documentElement,
    n = v => parseFloat(v) || 0,
    vb = String(root.getAttribute("viewBox") || "")
      .split(/[\s,]+/)
      .map(Number),
    W = vb.length === 4 && vb[2] ? vb[2] : n(root.getAttribute("width")) || 1,
    H = vb.length === 4 && vb[3] ? vb[3] : n(root.getAttribute("height")) || 1,
    real = /mm$/.test(root.getAttribute("width") || ""),
    lam = real ? [n(root.getAttribute("width")), n(root.getAttribute("height"))] : LAMINAS[op.lamina] || LAMINAS.A3,
    k = real ? lam[0] / W : Math.min((lam[0] - 20) / W, (lam[1] - 20) / H),
    ox = real ? 0 : (lam[0] - W * k) / 2,
    oy = real ? 0 : (lam[1] - H * k) / 2,
    // M: unidades del dibujo por mm de papel (1 en una lámina; en el plano del arquitecto, la escala: 1:50 en metros = 0.05)
    M = op.m || 1,
    f = v => (Number.isFinite(+v) ? (+v).toFixed(M < 1 ? 6 : 4) : "0.0"),
    X = x => dx + M * (ox + x * k),
    Y = y => dy + M * (oy + (H - y) * k);
  const hex = c => {
    c = String(c || "")
      .trim()
      .toLowerCase();
    if (!c || c === "none" || c.startsWith("url")) return "";
    if (/^#[0-9a-f]{3}$/.test(c)) return "#" + [...c.slice(1)].map(x => x + x).join("");
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (m)
      return (
        "#" +
        m[1]
          .split(",")
          .slice(0, 3)
          .map(v => Math.round(+v).toString(16).padStart(2, "0"))
          .join("")
      );
    return /^#[0-9a-f]{6}$/.test(c) ? c : c === "white" ? "#ffffff" : c === "black" ? "#000000" : "";
  };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  // Color de AutoCAD más cercano (para los programas que no leen el color verdadero)
  const aciDe = h => {
    if (typeof ACI === "undefined") return 7;
    const v = rgb(h);
    if (v.every(x => x < 40) || v.every(x => x > 235)) return 7;
    let mejor = 7,
      md = Infinity;
    for (let i = 1; i < 256; i++) {
      const c = rgb(ACI[i] || "#000000"),
        d = (c[0] - v[0]) ** 2 + (c[1] - v[1]) ** 2 + (c[2] - v[2]) ** 2;
      if (d < md) {
        md = d;
        mejor = i;
      }
    }
    return mejor;
  };
  /* Colores claros para el fondo oscuro de AutoCAD: los de la plataforma en azul, cobre, cian, verde y amarillo (los
     textos grises en cian y el azul de los textos más claro, para que se lean); los demás, el color de AutoCAD más
     cercano, y si es muy oscuro, blanco. Sobre un relleno claro (los gabinetes de los tableros), en oscuro. */
  const CLARO_ACI = {
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
  const SOBRE_CLARO = { "#14212e": 250, "#000000": 250, "#1f2328": 250, "#5a6775": 8, "#bfc8d2": 8, "#8a9199": 8 };
  // Rellenos claros del dibujo de los tableros (gabinete, módulos, riel), en grises de AutoCAD con volumen
  const RELL_CLARO = {
    "#ffffff": 254,
    "#f3f6f9": 255,
    "#eaf2fb": 255,
    "#e3e9f0": 254,
    "#d9eedf": 254,
    "#e6e9ed": 253,
    "#d5dae0": 253,
    "#c9ced5": 252,
    "#8f98a3": 8,
    "#a9b1ba": 9,
    "#2f7a4b": 3
  };
  const claros = [],
    sobreClaro = (x, y) => claros.some(([a, b, w, h]) => x >= a && x <= a + w && y >= b && y <= b + h),
    luz = h => {
      const v = rgb(h);
      return (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255;
    };
  const color = (h, { texto = false, claro = false } = {}) => {
    if (esq === "capas") return [62, 256];
    if (esq === "mono") return [62, 7];
    if (claro && SOBRE_CLARO[h] !== undefined) return [62, SOBRE_CLARO[h]];
    if (texto && h === "#5a6775") return [62, 4];
    if (texto && h === "#14304f") return [62, 140];
    if (CLARO_ACI[h] !== undefined) return [62, CLARO_ACI[h]];
    return [62, luz(h) < 0.22 ? 7 : aciDe(h)];
  };
  // Grosor: el estándar de AutoCAD más cercano (centésimas de mm)
  const GROS = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
  const grosor = mm => GROS.reduce((a, b) => (Math.abs(b - mm * 100) < Math.abs(a - mm * 100) ? b : a));
  // Recortes (clipPath con un rectángulo), por su id
  const clips = {};
  root.querySelectorAll("*").forEach(el => {
    if (el.tagName.toLowerCase() !== "clippath") return;
    const r = [...el.querySelectorAll("*")].find(e => e.tagName.toLowerCase() === "rect");
    if (r)
      clips[el.getAttribute("id")] = [
        n(r.getAttribute("x")),
        n(r.getAttribute("y")),
        n(r.getAttribute("x")) + n(r.getAttribute("width")),
        n(r.getAttribute("y")) + n(r.getAttribute("height"))
      ];
  });
  // Atributos heredados de los grupos: capa, recorte, fuera de la vista (display none, salvo el logo para el DXF)
  const subir = el => {
    const o = { capa: "", clip: null, oculto: false, dxf: false };
    for (let e = el; e && e.getAttribute; e = e.parentNode) {
      if (!o.capa && e.getAttribute("data-capa")) o.capa = e.getAttribute("data-capa");
      const cp = /url\(#([^)]+)\)/.exec(e.getAttribute("clip-path") || "");
      if (cp && !o.clip && clips[cp[1]]) o.clip = clips[cp[1]];
      if (e.getAttribute("display") === "none") o.oculto = true;
      if (e.getAttribute("data-dxf")) o.dxf = true;
    }
    return o;
  };
  // Recorte de polilíneas (Liang–Barsky por tramo) y de polígonos (Sutherland–Hodgman)
  const cortarLinea = (P, c) => {
    if (!c) return [P];
    const out = [];
    let act = [];
    for (let i = 0; i + 1 < P.length; i++) {
      const [x0, y0] = P[i],
        [x1, y1] = P[i + 1],
        dx = x1 - x0,
        dy = y1 - y0;
      let t0 = 0,
        t1 = 1,
        ok = true;
      [
        [-dx, x0 - c[0]],
        [dx, c[2] - x0],
        [-dy, y0 - c[1]],
        [dy, c[3] - y0]
      ].forEach(([p, q]) => {
        if (!ok) return;
        if (p === 0) {
          if (q < 0) ok = false;
        } else {
          const t = q / p;
          if (p < 0) t0 = Math.max(t0, t);
          else t1 = Math.min(t1, t);
          if (t0 > t1) ok = false;
        }
      });
      if (!ok) {
        if (act.length > 1) out.push(act);
        act = [];
        continue;
      }
      const a = [x0 + t0 * dx, y0 + t0 * dy],
        b = [x0 + t1 * dx, y0 + t1 * dy];
      if (!act.length || t0 > 0) {
        if (act.length > 1) out.push(act);
        act = [a];
      }
      act.push(b);
      if (t1 < 1) {
        out.push(act);
        act = [];
      }
    }
    if (act.length > 1) out.push(act);
    return out;
  };
  const cortarPoligono = (P, c) => {
    if (!c) return P;
    let out = P;
    [
      [p => p[0] >= c[0], (a, b) => [c[0], a[1] + ((b[1] - a[1]) * (c[0] - a[0])) / (b[0] - a[0])]],
      [p => p[0] <= c[2], (a, b) => [c[2], a[1] + ((b[1] - a[1]) * (c[2] - a[0])) / (b[0] - a[0])]],
      [p => p[1] >= c[1], (a, b) => [a[0] + ((b[0] - a[0]) * (c[1] - a[1])) / (b[1] - a[1]), c[1]]],
      [p => p[1] <= c[3], (a, b) => [a[0] + ((b[0] - a[0]) * (c[3] - a[1])) / (b[1] - a[1]), c[3]]]
    ].forEach(([dentro, corte]) => {
      const inp = out;
      out = [];
      inp.forEach((b, i) => {
        const a = inp[(i + inp.length - 1) % inp.length];
        if (dentro(b)) {
          if (!dentro(a)) out.push(corte(a, b));
          out.push(b);
        } else if (dentro(a)) out.push(corte(a, b));
      });
    });
    return out;
  };
  const dentro = (x, y, c) => !c || (x >= c[0] && x <= c[2] && y >= c[1] && y <= c[3]);
  // Entidades (sin identificador: se pone al escribir), capas y tipos de línea usados
  const ents = [],
    usadas = new Map(),
    tipos = new Map();
  const capaDe = (o, d) => {
    const c =
      String(o.capa || d)
        .replace(/[<>/\\":;?*|=`,]/g, "_")
        .slice(0, 200) || "0";
    if (!usadas.has(c)) usadas.set(c, true);
    return c;
  };
  const tipoDe = dash => {
    if (!dash) return null;
    const v = String(dash)
      .split(/[\s,]+/)
      .map(n)
      .filter(x => x > 0)
      .map(x => +(x * k * M).toFixed(M < 1 ? 6 : 3));
    if (!v.length) return null;
    const nom = "JMG_T" + v.map(x => String(x).replace(".", "_")).join("-");
    if (!tipos.has(nom)) tipos.set(nom, v.length % 2 ? [...v, ...v] : v);
    return nom;
  };
  const comun = (ly, col, lt, lw) => [8, ly, ...(lt ? [6, lt] : []), ...col, ...(lw !== undefined ? [370, lw] : [])];
  // Trazo de una polilínea (abierta o cerrada) en coordenadas del SVG
  const trazo = (P, cerrada, st, sw, dash, o, d) => {
    if (!st || P.length < 2) return;
    const ly = capaDe(o, d),
      col = color(st),
      lt = tipoDe(dash),
      mm = sw * k,
      col2 =
        esq === "jmg" && sobreClaro((P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2)
          ? color(st, { claro: true })
          : col,
      partes = o.clip && cerrada ? cortarLinea([...P, P[0]], o.clip) : cortarLinea(P, o.clip),
      cerr = cerrada && !o.clip;
    partes.forEach(Q => {
      if (Q.length === 2 && mm < 0.5)
        return ents.push([
          "LINE",
          ...comun(ly, col2, lt, grosor(mm)),
          100,
          "AcDbLine",
          10,
          f(X(Q[0][0])),
          20,
          f(Y(Q[0][1])),
          30,
          "0.0",
          11,
          f(X(Q[1][0])),
          21,
          f(Y(Q[1][1])),
          31,
          "0.0"
        ]);
      ents.push([
        "LWPOLYLINE",
        ...comun(ly, col2, lt, mm >= 0.5 ? undefined : grosor(mm)),
        100,
        "AcDbPolyline",
        90,
        Q.length,
        70,
        cerr ? 1 : 0,
        43,
        mm >= 0.5 ? f(mm * M) : "0.0",
        ...Q.flatMap(([x, y]) => [10, f(X(x)), 20, f(Y(y))])
      ]);
    });
  };
  // Relleno sólido: uno o varios contornos (huecos por paridad, como fill-rule evenodd)
  const relleno = (lazos, fi, o, d, circ) => {
    if (!fi || esq !== "jmg") return;
    // Claros: solo los del dibujo de los tableros, en gris; el resto (fondos blancos de cuadros y lámina), sin relleno
    let col = color(fi);
    if (luz(fi) > 0.8) {
      if (capaDe(o, d) !== "E-TABLEROS" || RELL_CLARO[fi] === undefined) return;
      col = [62, RELL_CLARO[fi]];
      if (!circ)
        lazos.forEach(P => {
          const xs = P.map(p => p[0]),
            ys = P.map(p => p[1]);
          claros.push([
            Math.min(...xs),
            Math.min(...ys),
            Math.max(...xs) - Math.min(...xs),
            Math.max(...ys) - Math.min(...ys)
          ]);
        });
    }
    const L = circ ? lazos : lazos.map(P => cortarPoligono(P, o.clip)).filter(P => P.length >= 3);
    if (!L.length) return;
    ents.push([
      "HATCH",
      ...comun(capaDe(o, d), col),
      100,
      "AcDbHatch",
      10,
      "0.0",
      20,
      "0.0",
      30,
      "0.0",
      210,
      "0.0",
      220,
      "0.0",
      230,
      "1.0",
      2,
      "SOLID",
      70,
      1,
      71,
      0,
      91,
      L.length,
      ...L.flatMap((P, i) => [
        92,
        i ? 2 : 3,
        72,
        circ ? 1 : 0,
        73,
        1,
        93,
        P.length,
        ...P.flatMap(p => [10, f(X(p[0])), 20, f(Y(p[1])), ...(circ ? [42, "1.0"] : [])]),
        97,
        0
      ]),
      75,
      0,
      76,
      1,
      98,
      0
    ]);
  };
  // Contorno de un rectángulo, con sus esquinas redondeadas si las tiene
  const rectPts = (x, y, w, h, rx, ry) => {
    rx = Math.min(rx, w / 2);
    ry = Math.min(ry || rx, h / 2);
    if (!(rx > 0))
      return [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h]
      ];
    const P = [],
      arco = (cx, cy, a0) => {
        for (let i = 0; i <= 6; i++) {
          const a = ((a0 + i * 15) * Math.PI) / 180;
          P.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
        }
      };
    arco(x + w - rx, y + ry, 270);
    arco(x + w - rx, y + h - ry, 0);
    arco(x + rx, y + h - ry, 90);
    arco(x + rx, y + ry, 180);
    return P;
  };
  // Trazados: M, L, H, V y Z (absolutos y relativos) en contornos
  const lazosDe = d => {
    const L = [];
    let P = null,
      x = 0,
      y = 0,
      x0 = 0,
      y0 = 0,
      cmd = "M";
    const toks = String(d || "").match(/[MLHVZmlhvz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
    for (let i = 0; i < toks.length; ) {
      if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
      const rel = cmd === cmd.toLowerCase(),
        C = cmd.toUpperCase();
      if (C === "Z") {
        if (P) {
          P.c = true;
          x = x0;
          y = y0;
        }
        P = null;
        continue;
      }
      const a = +toks[i++];
      if (C === "H") x = rel ? x + a : a;
      else if (C === "V") y = rel ? y + a : a;
      else {
        const b = +toks[i++];
        x = rel ? x + a : a;
        y = rel ? y + b : b;
      }
      if (C === "M") {
        P = [[x, y]];
        L.push(P);
        x0 = x;
        y0 = y;
        cmd = rel ? "l" : "L";
      } else (P || (L.push((P = [[x0, y0]])), P)).push([x, y]);
    }
    return L;
  };
  const sw0 = el => (el.getAttribute("stroke-width") === null ? 1 : n(el.getAttribute("stroke-width")));
  root.querySelectorAll("*").forEach(el => {
    const t = el.tagName.toLowerCase();
    if (!["line", "rect", "circle", "ellipse", "path", "polyline", "polygon", "text"].includes(t)) return;
    const o = subir(el);
    if (o.oculto && !o.dxf) return;
    // Lo que está dentro de un recorte (clipPath) no se dibuja: son sus definiciones
    for (let e = el.parentNode; e && e.tagName; e = e.parentNode) if (e.tagName.toLowerCase() === "clippath") return;
    const st = hex(el.getAttribute("stroke")),
      fi =
        el.getAttribute("fill") === null
          ? t === "text"
            ? "#000000"
            : t === "line"
              ? ""
              : "#000000"
          : hex(el.getAttribute("fill")),
      sw = sw0(el),
      dash = el.getAttribute("stroke-dasharray");
    if (t === "line") {
      const P = [
        [n(el.getAttribute("x1")), n(el.getAttribute("y1"))],
        [n(el.getAttribute("x2")), n(el.getAttribute("y2"))]
      ];
      return trazo(
        P,
        false,
        st,
        sw,
        dash,
        o,
        dash
          ? st === "#2f7a4b"
            ? "E-TIERRA"
            : "E-RESERVA"
          : sw >= 3
            ? "E-BARRAS"
            : st === "#2f7a4b"
              ? "E-TIERRA"
              : "E-UNIFILAR"
      );
    }
    if (t === "rect") {
      const x = n(el.getAttribute("x")),
        y = n(el.getAttribute("y")),
        w = n(el.getAttribute("width")),
        h = n(el.getAttribute("height"));
      // El fondo blanco de toda la lámina ya es el papel
      if (x === 0 && y === 0 && Math.abs(w - W) < 1 && Math.abs(h - H) < 1 && fi === "#ffffff" && !st) return;
      const P = rectPts(x, y, w, h, n(el.getAttribute("rx")), n(el.getAttribute("ry")));
      relleno([P], fi, o, "E-RELLENOS");
      trazo(P, true, st, sw, dash, o, x === 6 && y === 4 ? "E-MARCO" : "E-CUADROS");
      return;
    }
    if (t === "circle" || t === "ellipse") {
      const cx = n(el.getAttribute("cx")),
        cy = n(el.getAttribute("cy")),
        rx = t === "circle" ? n(el.getAttribute("r")) : n(el.getAttribute("rx")),
        ry = t === "circle" ? rx : n(el.getAttribute("ry"));
      if (!dentro(cx, cy, o.clip) || !(rx > 0)) return;
      if (t === "circle") {
        relleno(
          [
            [
              [cx - rx, cy],
              [cx + rx, cy]
            ]
          ],
          fi,
          o,
          "E-SIMBOLOS",
          true
        );
        if (st)
          ents.push([
            "CIRCLE",
            ...comun(capaDe(o, "E-SIMBOLOS"), color(st, { claro: sobreClaro(cx, cy) }), tipoDe(dash), grosor(sw * k)),
            100,
            "AcDbCircle",
            10,
            f(X(cx)),
            20,
            f(Y(cy)),
            30,
            "0.0",
            40,
            f(rx * k * M)
          ]);
        return;
      }
      const P = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * 2 * Math.PI;
        P.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
      relleno([P], fi, o, "E-SIMBOLOS");
      trazo(P, true, st, sw, dash, o, "E-SIMBOLOS");
      return;
    }
    if (t === "path" || t === "polyline" || t === "polygon") {
      const L =
        t === "path"
          ? lazosDe(el.getAttribute("d"))
          : [
              (el.getAttribute("points") || "")
                .trim()
                .split(/[\s,]+/)
                .map(Number)
                .reduce((a, v, i, s) => (i % 2 ? a : (a.push([v, s[i + 1]]), a)), [])
            ];
      if (t === "polygon") L[0].c = true;
      if (t !== "polyline")
        relleno(
          L.filter(P => P.length >= 3),
          fi,
          o,
          "E-SIMBOLOS"
        );
      L.forEach(P => trazo(P, !!P.c, st, sw, dash, o, "E-SIMBOLOS"));
      return;
    }
    if (t === "text") {
      const x = n(el.getAttribute("x")),
        y = n(el.getAttribute("y"));
      if (!dentro(x, y, o.clip)) return;
      const txt = String(el.textContent || "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 250);
      if (!txt) return;
      const fs = n(el.getAttribute("font-size")) || 9,
        an = el.getAttribute("text-anchor"),
        db = el.getAttribute("dominant-baseline") || "",
        neg = /^(700|bold|600|800|900)$/.test(el.getAttribute("font-weight") || ""),
        cur = el.getAttribute("font-style") === "italic",
        tr = (el.getAttribute("transform") || "").match(/rotate\(([-\d.e]+)/),
        rot = tr ? -n(tr[1]) : 0,
        j = an === "middle" ? 1 : an === "end" ? 2 : 0,
        v = /central|middle/.test(db)
          ? 2
          : /hanging|text-before-edge|^top/.test(db)
            ? 3
            : /text-after-edge|ideographic|bottom/.test(db)
              ? 1
              : 0,
        estilo = neg ? (cur ? "JMG_ARIAL_NK" : "JMG_ARIAL_N") : cur ? "JMG_ARIAL_K" : "JMG_ARIAL";
      ents.push([
        "TEXT",
        ...comun(capaDe(o, "E-TEXTOS"), color(fi || "#000000", { texto: true, claro: sobreClaro(x, y) })),
        100,
        "AcDbText",
        10,
        f(X(x)),
        20,
        f(Y(y)),
        30,
        "0.0",
        40,
        f(fs * 0.716 * k * M),
        1,
        dxfTexto(txt, op),
        ...(rot ? [50, rot.toFixed(3)] : []),
        7,
        estilo,
        ...(j ? [72, j] : []),
        ...(j || v ? [11, f(X(x)), 21, f(Y(y)), 31, "0.0"] : []),
        100,
        "AcDbText",
        ...(v ? [73, v] : [])
      ]);
    }
  });
  // Borde del papel (no se imprime: capa Defpoints)
  ents.push([
    "LWPOLYLINE",
    8,
    capaDe({}, "Defpoints"),
    62,
    8,
    100,
    "AcDbPolyline",
    90,
    4,
    70,
    1,
    43,
    "0.0",
    ...[
      [0, 0],
      [lam[0], 0],
      [lam[0], lam[1]],
      [0, lam[1]]
    ].flatMap(([a, b]) => [10, f(dx + a * M), 20, f(dy + b * M)])
  ]);
  const CAPAS = {
    "E-UNIFILAR": 7,
    "E-BARRAS": 30,
    "E-RESERVA": 8,
    "E-TIERRA": 3,
    "E-SIMBOLOS": 4,
    "E-CUADROS": 5,
    "E-MARCO": 5,
    "E-RELLENOS": 9,
    "E-TEXTOS": 7,
    "E-ROTULO": 5,
    "E-LEYENDA": 4,
    "E-ELEVACION": 7,
    "E-NIVELES": 8,
    "E-TUBERIA": 30,
    "E-DETALLE": 7,
    "E-TABLEROS": 7,
    "E-CABLEADO": 7,
    "E-NOTAS": 7,
    Defpoints: 8
  };
  return { ents, capas: [...usadas.keys()].map(c => [c, CAPAS[c] ?? 7]), tipos, lam };
}
// Texto con lo que no es ASCII como \U+XXXX (lo lee cualquier versión de AutoCAD, sea cual sea la codificación del archivo)
const dxfAscii = t =>
  Array.from(String(t))
    .map(ch => (ch.codePointAt(0) < 128 ? ch : "\\U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")))
    .join("");
/* Texto para el archivo: tal cual (un DXF nuevo); en el DXF del arquitecto, leído byte a byte, en bytes UTF-8 (AutoCAD
   2007 en adelante, op.cod = "utf8") o con \U+XXXX (versiones anteriores, op.cod = "ascii") */
const dxfTexto = (t, op = {}) =>
  op.cod === "ascii"
    ? dxfAscii(t)
    : op.cod === "utf8"
      ? Array.from(new TextEncoder().encode(String(t)), b => String.fromCharCode(b)).join("")
      : t;
const DXF_ESTILOS = [
  ["JMG_ARIAL", "arial.ttf"],
  ["JMG_ARIAL_N", "arialbd.ttf"],
  ["JMG_ARIAL_K", "ariali.ttf"],
  ["JMG_ARIAL_NK", "arialbi.ttf"]
];
// El DXF de una lámina
function svgDxf(svgTxt, op = {}) {
  const p = svgDxfPiezas(svgTxt, op);
  return dxfEnBase(p.ents, {
    capas: p.capas,
    tipos: [...p.tipos],
    estilos: DXF_ESTILOS,
    ext: [0, 0, p.lam[0], p.lam[1]]
  });
}
/* Varias láminas en un solo DXF, ordenadas como en una mesa de trabajo: de izquierda a derecha, con 40 mm entre ellas,
   hasta cuatro por fila (una fila nueva para las de otro grupo, como las plantas), cada una con su título encima
   (capa E-INDICE). hojas: [{ svg, tit, grupo }] en el orden en que van */
function svgDxfVarias(hojas, op = {}) {
  const p = svgDxfJuntar(hojas, op);
  return dxfEnBase(p.ents, { capas: p.capas, tipos: p.tipos, estilos: DXF_ESTILOS, ext: p.ext });
}
/* Las entidades de varias láminas en filas, desde la esquina superior izquierda (x0, y0) y a la escala m (unidades del
   dibujo por mm de papel: 1 en un archivo de láminas; en el plano del arquitecto, la de su escala). */
function svgDxfJuntar(hojas, op = {}, { x0 = 0, y0 = 0, m = 1 } = {}) {
  const ents = [],
    capas = new Map(),
    tipos = new Map(),
    G = 40 * m,
    opm = { ...op, m };
  let x = x0,
    y = y0,
    altoFila = 0,
    nFila = 0,
    grupo = null,
    xMax = x0,
    yMin = y0;
  hojas.forEach(h => {
    // Tamaño de la lámina antes de ubicarla
    const [w0, h0] = svgDxfPiezas(h.svg, op).lam,
      w = w0 * m,
      hh = h0 * m;
    if (nFila && (nFila >= 4 || h.grupo !== grupo)) {
      x = x0;
      y -= altoFila + G * 1.5;
      altoFila = 0;
      nFila = 0;
    }
    grupo = h.grupo;
    const p = svgDxfPiezas(h.svg, opm, x, y - hh);
    for (const e of p.ents) ents.push(e);
    p.capas.forEach(([c, v]) => capas.set(c, v));
    p.tipos.forEach((v, kk) => tipos.set(kk, v));
    if (h.tit)
      ents.push([
        "TEXT",
        8,
        "E-INDICE",
        62,
        op.colores === "capas" ? 256 : op.colores === "mono" ? 7 : 2,
        100,
        "AcDbText",
        10,
        x.toFixed(6),
        20,
        (y + 8 * m).toFixed(6),
        30,
        "0.0",
        40,
        (10 * m).toFixed(6),
        1,
        dxfTexto(String(h.tit).slice(0, 200), op),
        7,
        "JMG_ARIAL_N",
        100,
        "AcDbText"
      ]);
    xMax = Math.max(xMax, x + w);
    yMin = Math.min(yMin, y - hh);
    altoFila = Math.max(altoFila, hh);
    x += w + G;
    nFila++;
  });
  capas.set("E-INDICE", 2);
  return { ents, capas: [...capas], tipos: [...tipos], ext: [x0, yMin, xMax, y0 + 24 * m] };
}
/* Escribe las entidades en la base de AutoCAD 2013 (DXF_BASE_2013, js/planos/dxf-base.js): sus capas, tipos de línea y
   estilos de texto en las tablas, las entidades en el espacio modelo con identificadores desde $HANDSEED, la extensión
   del dibujo y la vista al abrir (toda la lámina). Devuelve el texto del archivo (UTF-8, como AutoCAD 2007 en adelante). */
function dxfEnBase(ents, { capas, tipos, estilos, ext }, base = DXF_BASE_2013) {
  /* base: la base vacía o el DXF del arquitecto (leído byte a byte; lo agregado es ASCII y el resto queda igual).
     Sin $HANDSEED o sin el registro del espacio modelo (R12, o un archivo sin identificadores), null */
  const nl = /\r\n/.test(base.slice(0, 2000)) ? "\r\n" : "\n",
    L = base.split(/\r?\n/),
    c = i => (L[i] || "").trim();
  let sec = "",
    tabla = "",
    reg = null,
    iSeed = -1,
    iEnt = -1,
    ms = "",
    vp = null;
  const T = {},
    regs = [],
    hdr = {};
  for (let i = 0; i + 1 < L.length; i += 2) {
    const kk = c(i),
      v = c(i + 1);
    if (kk === "0") {
      if (reg) regs.push(reg);
      reg = null;
      if (v === "SECTION") sec = "?";
      else if (v === "ENDSEC") {
        if (sec === "ENTITIES") iEnt = i;
        sec = "";
      } else if (v === "TABLE") tabla = "?";
      else if (v === "ENDTAB") {
        if (T[tabla]) T[tabla].fin = i;
        tabla = "";
      } else if (sec === "TABLES" && tabla) reg = { tabla, i, g: {} };
      continue;
    }
    if (sec === "?" && kk === "2") sec = v;
    else if (tabla === "?" && kk === "2") {
      tabla = v;
      T[v] = { h: "", fin: -1, n: new Set() };
    } else if (tabla && !reg && kk === "5" && T[tabla]) T[tabla].h = v;
    else if (reg) {
      if (!(kk in reg.g)) reg.g[kk] = v;
      (reg.pos = reg.pos || {})[kk] = reg.pos[kk] ?? i + 1;
    }
    if (sec === "HEADER" && kk === "9") hdr[v] = i + 2;
  }
  if (reg) regs.push(reg);
  regs.forEach(r => {
    if (T[r.tabla] && r.g[2] !== undefined) T[r.tabla].n.add(r.g[2].toUpperCase());
    if (r.tabla === "BLOCK_RECORD" && /^\*model_space$/i.test(r.g[2] || "")) ms = r.g[5];
    if (r.tabla === "VPORT" && /^\*active$/i.test(r.g[2] || "")) vp = r;
  });
  iSeed = hdr.$HANDSEED;
  if (iSeed === undefined || !ms || !T.LAYER || T.LAYER.fin < 0 || iEnt < 0) return null;
  let h = parseInt(c(iSeed + 1), 16);
  const id = () => (h++).toString(16).toUpperCase(),
    rec = (tb, tipo, sub, campos) => [
      0,
      tipo,
      5,
      id(),
      330,
      T[tb].h,
      100,
      "AcDbSymbolTableRecord",
      100,
      sub,
      ...campos
    ],
    ins = {},
    poner = (i, a) => (ins[i] = (ins[i] || []).concat(a)),
    lay0 = regs.find(r => r.tabla === "LAYER" && r.g[2] === "0");
  // Cada nombre una sola vez (varias láminas pueden traer la misma capa o el mismo tipo de línea)
  const nuevo = (tb, nom) => !T[tb].n.has(String(nom).toUpperCase()) && (T[tb].n.add(String(nom).toUpperCase()), true);
  (T.LTYPE && T.LTYPE.fin >= 0 ? tipos : [])
    .filter(([nom]) => nuevo("LTYPE", nom))
    .forEach(([nom, pat]) =>
      poner(
        T.LTYPE.fin,
        rec("LTYPE", "LTYPE", "AcDbLinetypeTableRecord", [
          2,
          nom,
          70,
          0,
          3,
          "Trazos",
          72,
          65,
          73,
          pat.length,
          40,
          pat.reduce((a, b) => a + b, 0).toFixed(4),
          ...pat.flatMap((v, i) => [49, (i % 2 ? -v : v).toFixed(4), 74, 0])
        ])
      )
    );
  (T.STYLE && T.STYLE.fin >= 0 ? estilos : [])
    .filter(([nom]) => nuevo("STYLE", nom))
    .forEach(([nom, fuente]) =>
      poner(
        T.STYLE.fin,
        rec("STYLE", "STYLE", "AcDbTextStyleTableRecord", [
          2,
          nom,
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
          fuente,
          4,
          ""
        ])
      )
    );
  capas
    .filter(([nom]) => nuevo("LAYER", nom))
    .forEach(([nom, col]) =>
      poner(
        T.LAYER.fin,
        rec("LAYER", "LAYER", "AcDbLayerTableRecord", [
          2,
          nom,
          70,
          0,
          62,
          col,
          6,
          "Continuous",
          ...(nom === "Defpoints" ? [290, 0] : []),
          370,
          -3,
          ...(lay0 && lay0.g[390] ? [390, lay0.g[390]] : [])
        ])
      )
    );
  poner(
    iEnt,
    ents.flatMap(([tipo, ...g]) => [0, tipo, 5, id(), 330, ms, 100, "AcDbEntity", ...g])
  );
  // Extensión y vista al abrir: toda la lámina con un margen
  const cx = (ext[0] + ext[2]) / 2,
    cy = (ext[1] + ext[3]) / 2,
    alto = (ext[3] - ext[1]) * 1.05,
    pon = (i, v) => i !== undefined && (L[i] = String(v));
  if (hdr.$EXTMIN !== undefined) {
    pon(hdr.$EXTMIN + 1, ext[0].toFixed(4));
    pon(hdr.$EXTMIN + 3, ext[1].toFixed(4));
  }
  if (hdr.$EXTMAX !== undefined) {
    pon(hdr.$EXTMAX + 1, ext[2].toFixed(4));
    pon(hdr.$EXTMAX + 3, ext[3].toFixed(4));
  }
  if (vp && vp.pos) {
    pon(vp.pos[12], cx.toFixed(4));
    pon(vp.pos[22], cy.toFixed(4));
    pon(vp.pos[40], alto.toFixed(4));
    pon(vp.pos[41], ((ext[2] - ext[0]) / (ext[3] - ext[1])).toFixed(4));
  }
  L[iSeed + 1] = h.toString(16).toUpperCase();
  return dxfUnir(L, ins, nl);
}
// Líneas del archivo con lo agregado antes de cada posición (sin «...»: con muchas entidades desbordaría la pila)
function dxfUnir(L, ins, nl) {
  const out = [];
  for (let i = 0; i < L.length; i++) {
    const a = ins[i];
    if (a) for (let j = 0; j < a.length; j++) out.push(String(a[j]));
    out.push(L[i]);
  }
  return out.join(nl);
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
