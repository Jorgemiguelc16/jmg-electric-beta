/* LÁMINAS · DXF
   El diseño en DXF para AutoCAD: en coordenadas reales, en R12 (laDxf), y dentro del DXF original del arquitecto con
   sus capas (laDxfCompleto, laOcultarBorrados: lo borrado de la arquitectura en una capa apagada), más el archivo
   único con las plantas y las láminas (laDxfProyecto). Usa el grabador y las láminas de js/editor/laminas.js. */
/* ---------- DXF del diseño en coordenadas reales (R12) ---------- */
// Color ACI más cercano a un color
const LA_ACI = new Map();
function laAci(hex) {
  const h = laHex(hex);
  if (!LA_ACI.has(h)) LA_ACI.set(h, laAci0(h));
  return LA_ACI.get(h);
}
function laAci0(hex) {
  const v = plRgb(laHex(hex));
  if (v.every(x => x < 60)) return 7;
  let mejor = 7,
    md = Infinity;
  for (let i = 1; i < 250; i++) {
    if (i === 7) continue;
    const c = plRgb(ACI[i]),
      d = (c[0] - v[0]) ** 2 + (c[1] - v[1]) ** 2 + (c[2] - v[2]) ** 2;
    if (d < md) {
      md = d;
      mejor = i;
    }
  }
  return mejor;
}
function laDxf(conArq, partes) {
  const D = dsD(),
    mmU = (EPL.f * 1000) / D.escala,
    s = mmU * LA_K,
    z = laZona({ zona: "todo" }),
    cx = (z[0] + z[2]) / 2,
    cy = (z[1] + z[3]) / 2,
    items = laGrabar({ cx, cy, s, zona: plExtUtil(), arq: conArq, colorArq: "color" }),
    Wc = plW() / 2,
    Hc = plH() / 2,
    // Del lienzo de grabación a las coordenadas del dibujo
    X = v => cx + (v - Wc) / s,
    Y = v => cy - (v - Hc) / s,
    // Número con 4 decimales; null si no es un número (la entidad no se escribe: AutoCAD no abriría el archivo)
    f = v => (Number.isFinite(+v) ? (+v).toFixed(4) : null),
    E = [],
    ent = a => {
      if (!a.includes(null)) E.push(...a);
    },
    capas = new Map(),
    nomCapa = new Map(),
    // Texto para R12: sin caracteres de control y a lo más 250 caracteres ya codificados; fuera del ASCII, \U+XXXX
    enc = t => {
      let o = "";
      for (const ch of String(t).replace(/[\u0000-\u001f\u007f]/g, " ")) {
        const c = ch.codePointAt(0),
          u = c < 128 ? ch : "\\U+" + c.toString(16).toUpperCase().padStart(4, "0");
        if (o.length + u.length > 250) break;
        o += u;
      }
      return o.trim();
    },
    /* Nombre de capa válido en R12 (AutoCAD no abre el archivo si no): solo A-Z, 0-9, $, - y _, hasta 31 caracteres.
       Las capas del arquitecto con espacios, tildes o nombres largos se adaptan; si dos quedan iguales, se numeran */
    capa = c => {
      const k = String(c || "0");
      if (nomCapa.has(k)) return nomCapa.get(k);
      const b =
        k
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toUpperCase()
          .replace(/[^A-Z0-9_$-]/g, "_")
          .slice(0, 31) || "0";
      let n = b;
      for (let i = 2; capas.has(n); i++) n = b.slice(0, 31 - String(i).length - 1) + "_" + i;
      const dc = D.capas.find(x => x.n === k);
      capas.set(n, dc ? laAci(dc.col) : 8);
      nomCapa.set(k, n);
      return n;
    };
  items.forEach(it => {
    const ly = capa(it.capa);
    if (it.t === "l") {
      const lt = it.dash ? "JMG_TRAZOS" : "CONTINUOUS",
        col = laAci(it.col);
      if (it.circ && it.p.length > 20) {
        const r = f(it.circ[2] / s);
        if (+r > 0) ent([0, "CIRCLE", 8, ly, 6, lt, 62, col, 10, f(X(it.circ[0])), 20, f(Y(it.circ[1])), 40, r]);
        return;
      }
      const P = it.p.map(p => [f(X(p[0])), f(Y(p[1]))]).filter(p => p[0] !== null && p[1] !== null);
      if (P.length < 2) return;
      if (P.length === 2 && !it.c) {
        ent([0, "LINE", 8, ly, 6, lt, 62, col, 10, P[0][0], 20, P[0][1], 11, P[1][0], 21, P[1][1]]);
        return;
      }
      E.push(0, "POLYLINE", 8, ly, 6, lt, 62, col, 66, 1, 10, "0.0", 20, "0.0", 70, it.c ? 1 : 0);
      P.forEach(p => E.push(0, "VERTEX", 8, ly, 10, p[0], 20, p[1]));
      E.push(0, "SEQEND", 8, ly);
    } else if (it.t === "f") {
      const col = laAci(it.col);
      if (laHex(it.col) === "#ffffff") return;
      it.pol.forEach(pp => {
        // Círculo lleno: polilínea de dos arcos con ancho (disco); triángulo o cuadrilátero: SOLID
        if (pp.circ && pp.p.length > 20) {
          const r = pp.circ[2] / s,
            x = X(pp.circ[0]),
            y = Y(pp.circ[1]);
          if (!(r > 0) || f(x) === null || f(y) === null) return;
          E.push(0, "POLYLINE", 8, ly, 62, col, 66, 1, 10, "0.0", 20, "0.0", 70, 1, 40, f(r), 41, f(r));
          E.push(0, "VERTEX", 8, ly, 10, f(x - r / 2), 20, f(y), 42, "1.0");
          E.push(0, "VERTEX", 8, ly, 10, f(x + r / 2), 20, f(y), 42, "1.0");
          E.push(0, "SEQEND", 8, ly);
        } else if (pp.p.length >= 3 && pp.p.length <= 5) {
          const p = pp.p.slice(0, 4),
            q = p.length === 4 ? p[3] : p[2];
          ent([
            0,
            "SOLID",
            8,
            ly,
            62,
            col,
            10,
            f(X(p[0][0])),
            20,
            f(Y(p[0][1])),
            11,
            f(X(p[1][0])),
            21,
            f(Y(p[1][1])),
            12,
            f(X(q[0])),
            22,
            f(Y(q[1])),
            13,
            f(X(p[2][0])),
            23,
            f(Y(p[2][1]))
          ]);
        }
      });
    } else if (it.t === "t") {
      const h = (it.h * 0.72) / s,
        rot = (-it.ang * 180) / Math.PI,
        j = it.al === "center" ? 1 : it.al === "right" || it.al === "end" ? 2 : 0,
        v = it.bl === "middle" ? 2 : it.bl === "top" || it.bl === "hanging" ? 3 : it.bl === "bottom" ? 1 : 0,
        x = f(X(it.p[0])),
        y = f(Y(it.p[1])),
        t = enc(it.s);
      if (!t || !(h > 0) || f(h) === null) return;
      ent([
        0,
        "TEXT",
        8,
        ly,
        62,
        laAci(it.col),
        7,
        "JMG_ARIAL",
        10,
        x,
        20,
        y,
        40,
        f(h),
        1,
        t,
        ...(Number.isFinite(rot) && Math.abs(rot) > 0.01 ? [50, rot.toFixed(2)] : []),
        ...(j || v ? [72, j, 73, v, 11, x, 21, y] : [])
      ]);
    }
  });
  // Solo las piezas (para agregarlas al DXF original del arquitecto)
  if (partes) return { E, capas, lts: 1 / mmU };
  // Encabezado y tablas: tipo de línea a trazos (3 mm y 1.5 mm en el papel), estilo de texto Arial y capas
  const lts = 1 / mmU,
    ex = conArq ? plExtUtil() : z,
    vc = [(ex[0] + ex[2]) / 2, (ex[1] + ex[3]) / 2],
    vh = Math.max(1e-6, (ex[3] - ex[1]) * 1.05),
    tablas = [
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
      "$LTSCALE",
      40,
      f(lts),
      // Extensión del dibujo y vista al abrir centrada en él (las coordenadas son las reales del plano, lejos del 0,0)
      9,
      "$EXTMIN",
      10,
      f(ex[0]),
      20,
      f(ex[1]),
      30,
      "0.0",
      9,
      "$EXTMAX",
      10,
      f(ex[2]),
      20,
      f(ex[3]),
      30,
      "0.0",
      9,
      "$VIEWCTR",
      10,
      f(vc[0]),
      20,
      f(vc[1]),
      9,
      "$VIEWSIZE",
      40,
      f(vh),
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
      f(vc[0]),
      22,
      f(vc[1]),
      13,
      "0.0",
      23,
      "0.0",
      14,
      "1.0",
      24,
      "1.0",
      15,
      "1.0",
      25,
      "1.0",
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
      f(vh),
      41,
      f(Math.max(0.2, Math.min(5, (ex[2] - ex[0]) / Math.max(1e-9, ex[3] - ex[1])))),
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
      "Continua",
      72,
      65,
      73,
      0,
      40,
      "0.0",
      0,
      "LTYPE",
      2,
      "JMG_TRAZOS",
      70,
      0,
      3,
      "Trazos (tuberia en piso)",
      72,
      65,
      73,
      2,
      40,
      "4.5",
      49,
      "3.0",
      49,
      "-1.5",
      0,
      "ENDTAB",
      0,
      "TABLE",
      2,
      "STYLE",
      70,
      1,
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
      "ENDTAB",
      0,
      "TABLE",
      2,
      "LAYER",
      70,
      capas.size,
      ...[...capas].flatMap(([n, c]) => [0, "LAYER", 2, n, 70, 0, 62, c, 6, "CONTINUOUS"]),
      0,
      "ENDTAB",
      0,
      "ENDSEC",
      0,
      "SECTION",
      2,
      "ENTITIES"
    ];
  const out = [...tablas, ...E, 0, "ENDSEC", 0, "EOF"];
  // El texto del archivo se arma de una vez (sumar cadenas una por una es muy lento con proyectos grandes)
  const ln = new Array(out.length);
  for (let i = 0; i < out.length; i++) ln[i] = out[i];
  return ln.join("\r\n") + "\r\n";
}

/* ---------- DXF con la arquitectura original ----------
   El archivo DXF del arquitecto tal cual (sus capas, bloques, sombreados, cotas, textos y presentaciones) con el
   diseño eléctrico agregado en sus capas: no se vuelve a dibujar la arquitectura. Las entidades del diseño se
   escriben en la versión del archivo: en R12 como están; desde AutoCAD 2000 (AC1015), con su identificador
   (handle, desde $HANDSEED), su dueño (el espacio modelo) y sus marcas de clase, como AutoCAD las exige. Las
   capas, el tipo de línea a trazos y el estilo de texto del diseño se agregan a sus tablas si el archivo no los
   tiene. Si el archivo es DXF binario o no se reconoce, devuelve null (se usa el DXF dibujado de nuevo). */
/* Entidades R12 del diseño (pares código/valor de laDxf) → entidades de AutoCAD 2000 en adelante, sin identificador
   ([tipo, 8, capa, …]): dxfEnBase (js/planos/exportar-planos.js) les pone su identificador y su dueño */
function laEntsModernos(E) {
  const ents = [];
  let cur = null;
  for (let i = 0; i < E.length; i += 2) {
    if (E[i] === 0) ents.push((cur = { t: E[i + 1], g: [] }));
    else if (cur) cur.g.push([E[i], E[i + 1]]);
  }
  const out = [],
    val = (g, c) => (g.find(p => p[0] === c) || [])[1],
    pick = (g, cs) =>
      cs.flatMap(c => {
        const v = val(g, c);
        return v === undefined ? [] : [c, v];
      }),
    cab = (t, g) => [t, 8, val(g, 8), ...pick(g, [6, 62])];
  for (let k = 0; k < ents.length; k++) {
    const { t, g } = ents[k];
    if (t === "LINE")
      out.push([...cab(t, g), 100, "AcDbLine", ...pick(g, [10, 20]), 30, "0.0", ...pick(g, [11, 21]), 31, "0.0"]);
    else if (t === "CIRCLE")
      out.push([...cab(t, g), 100, "AcDbCircle", ...pick(g, [10, 20]), 30, "0.0", ...pick(g, [40])]);
    else if (t === "SOLID")
      out.push([
        ...cab(t, g),
        100,
        "AcDbTrace",
        ...[10, 11, 12, 13].flatMap(c => [c, val(g, c), c + 10, val(g, c + 10), c + 20, "0.0"])
      ]);
    else if (t === "TEXT") {
      const x2 = val(g, 11);
      out.push([
        ...cab(t, g),
        100,
        "AcDbText",
        ...pick(g, [10, 20]),
        30,
        "0.0",
        ...pick(g, [40, 1, 50, 7, 72]),
        ...(x2 !== undefined ? [11, x2, 21, val(g, 21), 31, "0.0"] : []),
        100,
        "AcDbText",
        ...pick(g, [73])
      ]);
    } else if (t === "POLYLINE") {
      const vs = [];
      while (ents[k + 1] && ents[k + 1].t === "VERTEX") vs.push(ents[++k].g);
      if (ents[k + 1] && ents[k + 1].t === "SEQEND") k++;
      if (vs.length < 2) continue;
      const w = val(g, 40);
      out.push([
        ...cab("LWPOLYLINE", g),
        100,
        "AcDbPolyline",
        90,
        vs.length,
        70,
        val(g, 70) || 0,
        ...(w !== undefined ? [43, w] : []),
        ...vs.flatMap(v => [10, val(v, 10), 20, val(v, 20), ...pick(v, [42])])
      ]);
    }
  }
  return out;
}
// Bytes del archivo ↔ texto, uno a uno (sin decodificar): lo agregado es ASCII y el resto del archivo queda igual
function laTextoDe(buf) {
  const by = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < by.length; i += 0x8000) s += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000));
  return s;
}
function laBytesDe(t) {
  const o = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i) & 255;
  return o;
}
/* El DXF del arquitecto (desde AutoCAD 2000) con el diseño eléctrico en sus coordenadas, con los símbolos y textos a
   la escala esc, y las láminas hojas (unifilar, tableros…; [{ svg, tit, grupo }]) a esa misma escala, en filas a la
   derecha de la arquitectura, como las láminas que el arquitecto arma en el espacio modelo. Devuelve los bytes o null
   (archivo R12, sin identificadores o no reconocido). */
/* Lo borrado de la arquitectura en la plataforma (EPL.borr) pasa a la capa JMG-ARQ-BORRADO, apagada y congelada: no
   se ve ni se imprime, y no se quita del archivo (otros objetos pueden referirse a él); se recupera encendiendo la capa.
   Cada objeto se ubica por su identificador (PL_MOD.hnd); sus vértices, atributos y fin de secuencia, con él. */
function laOcultarBorrados(s) {
  const H = new Set((EPL.borr || []).map(n => String((PL_MOD.hnd || [])[n] || "").toUpperCase()).filter(Boolean));
  if (!H.size) return { s, n: 0 };
  const nl = s.includes("\r\n") ? "\r\n" : "\n",
    L = s.split(/\r?\n/);
  let sec = "",
    en = false,
    marcar = false,
    hijo = false,
    h = null,
    iCapa = -1,
    n = 0;
  for (let i = 0; i + 1 < L.length; i += 2) {
    const c = L[i].trim(),
      v = L[i + 1].trim();
    if (c === "0") {
      if (en && marcar && iCapa >= 0) {
        L[iCapa] = "JMG-ARQ-BORRADO";
        n++;
      }
      en = false;
      iCapa = -1;
      h = null;
      if (v === "SECTION") sec = "?";
      else if (v === "ENDSEC") sec = "";
      else if (sec === "ENTITIES") {
        en = true;
        hijo = v === "VERTEX" || v === "ATTRIB" || v === "SEQEND";
        if (!hijo) marcar = false;
      }
      continue;
    }
    if (sec === "?" && c === "2") sec = v;
    else if (en) {
      if (c === "5" && h === null) {
        h = v;
        if (!hijo) marcar = H.has(v.toUpperCase());
      } else if (c === "8" && iCapa < 0) iCapa = i + 1;
    }
  }
  return { s: L.join(nl), n };
}
function laDxfCompleto(s, { esc = dsD().escala, hojas = [], op = {} } = {}) {
  if (s.startsWith("AutoCAD Binary DXF")) return null;
  const ob = laOcultarBorrados(s);
  s = ob.s;
  const ltsA = +(/\$LTSCALE\s*\r?\n\s*40\s*\r?\n\s*([-\d.eE]+)/.exec(s) || [])[1] || 1,
    { E, capas } = laCon(esc, null, () => laDxf(false, true)),
    u = esc / 1000 / EPL.f,
    ents = laEntsModernos(E),
    cps = [...capas, ...(ob.n ? [["JMG-ARQ-BORRADO", -8, 1]] : [])];
  // Trazos de la tubería en piso: 3 mm y 1.5 mm en el papel (el $LTSCALE del archivo multiplica)
  let tipos = [["JMG_TRAZOS", [(3 * u) / ltsA, (1.5 * u) / ltsA]]],
    ext = plExtUtil().slice();
  if (hojas.length) {
    const w = ext[2] - ext[0],
      ver = (/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/.exec(s) || [])[1] || "",
      j = svgDxfJuntar(
        hojas,
        { ...op, cod: ver >= "AC1021" ? "utf8" : "ascii" },
        { x0: ext[2] + Math.max(0.08 * w, 40 * u), y0: ext[3], m: u }
      );
    for (const e of j.ents) ents.push(e);
    j.capas.forEach(c => cps.push(c));
    tipos = tipos.concat(j.tipos);
    ext = [
      Math.min(ext[0], j.ext[0]),
      Math.min(ext[1], j.ext[1]),
      Math.max(ext[2], j.ext[2]),
      Math.max(ext[3], j.ext[3])
    ];
  }
  const t = dxfEnBase(ents, { capas: cps, tipos, estilos: DXF_ESTILOS, ext }, s);
  return t === null ? null : laBytesDe(t);
}
/* Con el plano aplicado al proyecto (PLANO) y su arquitectura leída del navegador, sin el editor abierto: una copia,
   y al terminar todo queda como estaba. fn recibe el archivo DXF ({ nombre, buf }). Sin plano o sin su archivo, null */
async function laConPlano(fn) {
  if (typeof PLANO === "undefined" || !PLANO || !PLANO.sha || !PLANO.dis) return null;
  const vE = EPL,
    vM = PL_MOD,
    vS = PL_SHA,
    vB = [...PL_BORR];
  try {
    EPL = clon(PLANO);
    dsAsegurar();
    const a = await plLeerArchivo(EPL.sha);
    if (!a || !a.buf) return null;
    if (!PL_MOD || PL_SHA !== EPL.sha) {
      PL_MOD = modeloDxf(a.buf);
      PL_SHA = EPL.sha;
    }
    PL_BORR.clear();
    (EPL.borr || []).forEach(n => PL_BORR.add(n));
    dsIdxSucio();
    return await fn(a);
  } finally {
    EPL = vE;
    // Con el editor cerrado, el plano leído queda para la próxima vez (el editor lo reconoce por su huella)
    if (vE) {
      PL_MOD = vM;
      PL_SHA = vS;
    }
    PL_BORR.clear();
    vB.forEach(n => PL_BORR.add(n));
    dsIdxSucio();
  }
}
// Cuántas láminas de planta tiene el proyecto (con las que «Una lámina por planta» agregaría): las demás van después
const laNumPlantas = () =>
  laConPlano(() => {
    const ops = laLista().map((l, i) => laOp(i));
    laPlantasSin(ops).forEach(o => ops.push(o));
    return ops.reduce((m, o) => Math.max(m, +(/^IE-(\d+)/.exec(o.num || "") || [0, 0])[1]), 0);
  });
// Planos para AutoCAD: el DXF del arquitecto con el diseño y las láminas (a la escala de la primera lámina, o 1:50)
const laDxfProyecto = (hojas, op) =>
  laConPlano(a => {
    const e0 = laOp(0).esc;
    return laDxfCompleto(laTextoDe(a.buf), { esc: e0 > 0 ? e0 : 50, hojas, op });
  });
/* «Con la arquitectura»: el DXF del arquitecto con el diseño (a su escala de diseño). Desde AutoCAD 2000, con
   laDxfCompleto; un archivo R12 o sin identificadores, con el diseño en R12 al final del espacio modelo y sus capas,
   tipo de línea y estilo en las tablas. Binario o no reconocido: null (se usa el DXF dibujado de nuevo). */
function laDxfOriginal(buf) {
  const s = laTextoDe(buf);
  if (s.startsWith("AutoCAD Binary DXF")) return null;
  const moderno = laDxfCompleto(s);
  if (moderno) return moderno;
  const nl = s.includes("\r\n") ? "\r\n" : "\n",
    L = s.split(/\r?\n/),
    c = i => (L[i] || "").trim();
  // Recorrido por pares: secciones, tablas y registros
  let sec = "",
    tabla = "",
    reg = null,
    ltsA = 1,
    iEntFin = -1;
  const T = {},
    regs = [];
  for (let i = 0; i + 1 < L.length; i += 2) {
    const k = c(i),
      v = c(i + 1);
    if (k === "0") {
      if (reg) regs.push(reg);
      reg = null;
      if (v === "SECTION") sec = "?";
      else if (v === "ENDSEC") {
        if (sec === "ENTITIES") iEntFin = i;
        sec = "";
      } else if (v === "TABLE") tabla = "?";
      else if (v === "ENDTAB") {
        if (T[tabla]) T[tabla].fin = i;
        tabla = "";
      } else if (sec === "TABLES" && tabla) reg = { tabla, g: {} };
      continue;
    }
    if (sec === "?" && k === "2") sec = v;
    else if (tabla === "?" && k === "2") {
      tabla = v;
      T[v] = { fin: -1, n: new Set() };
    } else if (reg && !(k in reg.g)) reg.g[k] = v;
    if (sec === "HEADER" && k === "9" && v === "$LTSCALE") ltsA = +c(i + 3) || 1;
  }
  if (reg) regs.push(reg);
  regs.forEach(r => T[r.tabla] && r.g[2] !== undefined && T[r.tabla].n.add(r.g[2].toUpperCase()));
  if (iEntFin < 0 || !T.LAYER || T.LAYER.fin < 0) return null;
  // El diseño eléctrico, solo (sin arquitectura), en pares R12
  const { E, capas, lts } = laDxf(false, true),
    ins = {},
    poner = (i, a) => (ins[i] = (ins[i] || []).concat(a));
  // Tipo de línea a trazos (tubería en piso), con el $LTSCALE del archivo, y estilo de texto
  if (T.LTYPE && T.LTYPE.fin >= 0 && !T.LTYPE.n.has("JMG_TRAZOS")) {
    const e = lts / ltsA;
    poner(T.LTYPE.fin, [
      0,
      "LTYPE",
      2,
      "JMG_TRAZOS",
      70,
      0,
      3,
      "Trazos (tuberia en piso)",
      72,
      65,
      73,
      2,
      40,
      (4.5 * e).toFixed(6),
      49,
      (3 * e).toFixed(6),
      49,
      (-1.5 * e).toFixed(6)
    ]);
  }
  if (T.STYLE && T.STYLE.fin >= 0 && !T.STYLE.n.has("JMG_ARIAL"))
    poner(T.STYLE.fin, [
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
      ""
    ]);
  // Capas del diseño que el archivo no tiene
  [...capas]
    .filter(([n]) => !T.LAYER.n.has(n.toUpperCase()))
    .forEach(([n, col]) => poner(T.LAYER.fin, [0, "LAYER", 2, n, 70, 0, 62, col, 6, "CONTINUOUS"]));
  // Entidades del diseño al final del espacio modelo
  poner(iEntFin, E);
  return laBytesDe(dxfUnir(L, ins, nl));
}
