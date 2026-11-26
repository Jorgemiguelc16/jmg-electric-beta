/* PROYECTOS · VALIDAR AL ABRIR
   Un proyecto guardado (de este navegador, de un archivo .json, de la nube o de un caso de prueba) se revisa antes de
   usarlo: listas con sus campos (limpiarLista), proyectos de versiones anteriores (migrarCargasT), la normalización
   de todos sus datos (normalizar) y la del plano de arquitectura y del diseño eléctrico (planoValido, disValido).
   Nada de lo que trae un archivo pasa a la plataforma sin pasar por aquí. */
function limpiarLista(a, plantilla, nums = []) {
  return Array.isArray(a)
    ? a
        .filter(x => x && typeof x === "object")
        .map(x => {
          const y = { ...plantilla };
          Object.keys(plantilla).forEach(k => {
            if (x[k] == null || x[k] === "") {
              if (nums.includes(k)) y[k] = null;
              return;
            }
            y[k] =
              nums.includes(k) || typeof plantilla[k] === "number"
                ? parseFloat(x[k]) || 0
                : String(x[k]).replace(/[<>]/g, "").slice(0, 120);
          });
          return y;
        })
    : null;
}
/* Proyectos anteriores a la v2.8: las cargas especiales de cada tipo de departamento eran cuatro totales en W
   (cocina, calentador, aire acondicionado y otras > 1500 W). Cada total con valor pasa a ser una fila de la lista
   cargasT, con la longitud de los circuitos del departamento; la máxima demanda y los circuitos quedan iguales. */
function migrarCargasT(o) {
  if (Array.isArray(o.cargasT) || !Array.isArray(o.tipos)) return o;
  const L = [];
  o.tipos.forEach((t, i) => {
    if (!t || typeof t !== "object") return;
    [
      ["coc", "cocina", "Cocina eléctrica"],
      ["cal", "calentador", "Calentador de agua / ducha"],
      ["aire", "aire", "Aire acondicionado"],
      ["otras", "otra", "Otras cargas mayores de 1500 W"]
    ].forEach(([k, tipo, nombre]) => {
      const p = parseFloat(t[k]) || 0;
      if (p > 0) L.push({ nombre, tipo, p, L: parseFloat(t.Lc) || null, dep: i });
    });
  });
  return { ...o, cargasT: L };
}
/* Preparación de un proyecto al abrirlo (o al cargar un caso de prueba), sin tocar la pantalla: convierte los
   proyectos anteriores, limpia las listas y los datos con las mismas reglas de siempre y completa valores por
   defecto. Devuelve los datos en campos, listas (null = dejar la actual) y
   el estado de las elecciones del usuario (FIX, ACEP, TEQ, SECF), el sistema y el modo. */
const LISTAS_PROY = ["cargas", "tipos", "cargasT", "serv", "pisos", "lums", "lumsT", "toms", "tomsT"];
function normalizar(o) {
  o = migrarCargasT(o);
  const campos = {};
  // Un dato que el proyecto no trae (por ejemplo, de una versión anterior) toma su valor por defecto, nunca el del
  // proyecto que estaba abierto antes (corrección de la v2.9.2: así ningún proyecto hereda datos de otro)
  KEYS.forEach(k => (campos[k] = o[k] != null ? String(o[k]).replace(/[<>]/g, "") : DEFV[k]));
  const listas = Object.fromEntries(
    LISTAS_PROY.map(k => [
      k,
      limpiarLista(
        o[k],
        LISTS[k].nuevo(),
        LISTS[k].f
          .filter(f => f.t === "number" || f.k === "fases")
          .map(f => f.k)
          .filter(x => x !== "fases")
      ) || (["pisos", "lums", "lumsT", "toms", "tomsT", "cargasT"].includes(k) ? [] : null)
    ])
  );
  const ok = v =>
    v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string")) : {};
  const fx = o.FIX && typeof o.FIX === "object" ? o.FIX : {},
    ac = o.ACEP && typeof o.ACEP === "object" ? o.ACEP : {};
  // Equipos adicionales por tablero: solo claves conocidas y valores verdaderos
  const te = o.TEQ && typeof o.TEQ === "object" ? o.TEQ : {},
    okq = v =>
      v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, x]) => x && typeof x === "object")
              .map(([t, x]) => [
                t,
                Object.fromEntries([
                  ...Object.keys(EQT)
                    .filter(k => x[k] === true)
                    .map(k => [k, true]),
                  // Gabinete elegido en la ficha (PVC o metálico); sin él, el de por defecto
                  ...(x.gab === "pvc" || x.gab === "metal" ? [["gab", x.gab]] : [])
                ])
              ])
          )
        : {};
  // Secciones elegidas en el cuadro de conductores: solo secciones normalizadas (el cálculo verifica que cumplan)
  const sf = o.SECF && typeof o.SECF === "object" ? o.SECF : {},
    oks = v =>
      v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, S]) => SECC.includes(S))) : {};
  const sv = v => (["mono220", "tri220", "tri380"].includes(v) ? v : null);
  return {
    PLANO: planoValido(o.PLANO),
    PRESU: presuValido(o.PRESU),
    LUX: luxValido(o.LUX),
    id: typeof o.id === "string" && /^[\w-]{1,40}$/.test(o.id) ? o.id : null,
    campos,
    listas,
    FIX: { uni: ok(fx.uni), multi: ok(fx.multi) },
    ACEP: { uni: ok(ac.uni), multi: ok(ac.multi) },
    TEQ: { uni: okq(te.uni), multi: okq(te.multi) },
    SECF: { uni: oks(sf.uni), multi: oks(sf.multi) },
    sist: sv(o.sist) || "mono220",
    sistG: sv(o.sistG) || "tri380",
    MODE: o.MODE === "multi" ? "multi" : "uni"
  };
}
/* Plano de arquitectura guardado con el proyecto (js/editor/plano-*.js), solo con datos válidos: el nombre y la huella del
   archivo DXF (que está en el navegador), metros por unidad del dibujo y de dónde sale, capas ocultas, plantas
   encuadradas (rectángulos en coordenadas del dibujo) y modo atenuado. */
function planoValido(v) {
  if (!v || typeof v !== "object" || typeof v.sha !== "string" || !/^[0-9a-f]{40}$/.test(v.sha)) return null;
  const n = x => typeof x === "number" && Number.isFinite(x),
    txt = (x, m) =>
      String(x ?? "")
        .replace(/[<>]/g, "")
        .slice(0, m);
  return {
    nombre: txt(v.nombre, 120) || "plano.dxf",
    sha: v.sha,
    kb: n(v.kb) ? Math.round(v.kb) : 0,
    f: n(v.f) && v.f > 0 ? v.f : 1,
    de: ["cotas", "cabecera", "tamaño", "manual"].includes(v.de) ? v.de : "manual",
    ocultas: Array.isArray(v.ocultas) ? v.ocultas.filter(x => typeof x === "string").slice(0, 5000) : [],
    plantas: Array.isArray(v.plantas)
      ? v.plantas
          .filter(p => p && ["x0", "y0", "x1", "y1"].every(k => n(p[k])) && p.x1 > p.x0 && p.y1 > p.y0)
          .slice(0, 60)
          .map(p => ({
            n: txt(p.n, 60) || "Planta",
            x0: p.x0,
            y0: p.y0,
            x1: p.x1,
            y1: p.y1,
            // Piso del cálculo de la planta: 1, 2… (0 sótano, −1 no se cuenta)
            ...(Number.isInteger(p.piso) && p.piso >= -1 && p.piso <= 60 ? { piso: p.piso } : {}),
            // Punto base: el mismo punto del edificio en cada planta (montantes y copiar a otra planta)
            ...(n(p.bx) && n(p.by) ? { bx: p.bx, by: p.by } : {})
          }))
      : [],
    tenue: v.tenue === true,
    // Versiones de la arquitectura usadas (nombre, huella y fecha)
    ...(Array.isArray(v.arqV) && v.arqV.length
      ? {
          arqV: v.arqV
            .filter(x => x && typeof x.sha === "string" && /^[0-9a-f]{40}$/.test(x.sha))
            .slice(-20)
            .map(x => ({ n: txt(x.n, 120), sha: x.sha, f: txt(x.f, 20) }))
        }
      : {}),
    // Capas de la arquitectura que cierran los ambientes (detección de áreas); sin ellas, por su nombre
    ...(Array.isArray(v.mur) && v.mur.length
      ? {
          mur: v.mur
            .filter(x => typeof x === "string")
            .slice(0, 300)
            .map(x => txt(x, 120))
        }
      : {}),
    // Objetos de la arquitectura marcados como ducha o tina (su número de objeto en el DXF)
    ...(Array.isArray(v.duchas) && v.duchas.length
      ? { duchas: [...new Set(v.duchas.filter(i => Number.isInteger(i) && i >= 0 && i < 1e7))].slice(0, 5000) }
      : {}),
    // Objetos de la arquitectura borrados de la vista (su número de objeto en el DXF; el archivo no cambia)
    ...(Array.isArray(v.borr) && v.borr.length
      ? { borr: [...new Set(v.borr.filter(i => Number.isInteger(i) && i >= 0 && i < 1e7))].slice(0, 500000) }
      : {}),
    dis: disValido(v.dis),
    // Versiones guardadas del diseño (para comparar o restaurar)
    ...(Array.isArray(v.vers) && v.vers.length
      ? {
          vers: v.vers
            .filter(x => x && typeof x === "object" && x.dis)
            .slice(-15)
            .map(x => ({
              n: txt(x.n, 60) || "Versión",
              f: typeof x.f === "string" ? x.f.slice(0, 40) : "",
              dis: disValido(x.dis)
            }))
        }
      : {})
  };
}
/* Diseño eléctrico dibujado sobre el plano (js/editor/diseno-*.js): capas, capa actual, elementos y escala de impresión,
   solo con datos válidos. Los elementos sin datos completos se descartan; los de una capa que no existe la crean. */
function disValido(v) {
  if (!v || typeof v !== "object") return undefined;
  const n = x => typeof x === "number" && Number.isFinite(x),
    txt = (x, m) =>
      String(x ?? "")
        .replace(/[<>]/g, "")
        .slice(0, m),
    color = x => (typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x) ? x.toLowerCase() : "#37474f"),
    capa = c => ({
      n: txt(c.n, 60).trim() || "E-CAPA",
      col: color(c.col),
      lt: ["cont", "trazos", "punto"].includes(c.lt) ? c.lt : "cont",
      vis: c.vis !== false,
      bloq: c.bloq === true,
      ...([0.25, 0.35, 0.5, 0.7, 1].includes(c.gr) ? { gr: c.gr } : {})
    });
  const capas = [];
  (Array.isArray(v.capas) ? v.capas : []).slice(0, 200).forEach(c => {
    if (c && typeof c === "object" && !capas.some(x => x.n === capa(c).n)) capas.push(capa(c));
  });
  // Hasta 200 000 elementos: con los proyectos en la base de datos del navegador cabe un edificio grande (antes,
  // con el almacenamiento pequeño, el tope era 20 000)
  const els = (Array.isArray(v.els) ? v.els : [])
    .slice(0, 200000)
    .map(e => {
      if (!e || typeof e !== "object") return null;
      const b = {
          // Color propio del elemento (si no, el de su capa)
          ...(typeof e.col === "string" && /^#[0-9a-f]{6}$/i.test(e.col) ? { col: e.col.toLowerCase() } : {}),
          id: typeof e.id === "string" && /^d[0-9]{1,7}$/.test(e.id) ? e.id : "",
          capa: txt(e.capa, 60).trim() || "E-DIBUJO"
        },
        cir = e.cir ? { cir: txt(e.cir, 12) } : {},
        // Rótulo automático: el texto lo escribe la plataforma con los alimentadores que pasan por esa caja o montante
        aut = typeof e.aut === "string" && /^d[0-9]{1,7}$/.test(e.aut) ? { aut: e.aut } : {};
      if (e.t === "sim" && typeof e.k === "string" && /^[a-zA-Z0-9]{1,12}$/.test(e.k) && n(e.x) && n(e.y))
        return {
          ...b,
          t: "sim",
          k: e.k,
          x: e.x,
          y: e.y,
          r: n(e.r) ? e.r : 0,
          ...(n(e.h) && e.h >= 0 ? { h: e.h } : {}),
          ...(n(e.p) && e.p >= 0 ? { p: e.p } : {}),
          // Letra del tipo corrida (unidades del símbolo)
          ...(Array.isArray(e.dt) && e.dt.length === 2 && e.dt.every(v => n(v) && Math.abs(v) < 200)
            ? { dt: e.dt.slice() }
            : {}),
          ...cir,
          // Letra de encendido (qué interruptor enciende qué luminaria: a, b, c…)
          ...(typeof e.enc === "string" && /^[a-z0-9]{1,3}(,[a-z0-9]{1,3}){0,3}$/.test(e.enc) ? { enc: e.enc } : {}),
          // Montante: la canalización vertical par en otra planta
          ...(typeof e.mon === "string" && /^d[0-9]{1,7}$/.test(e.mon) ? { mon: e.mon } : {}),
          // Uso de una caja o canalización elegido por el proyectista: alimentador (true) o circuito (false)
          ...(typeof e.ali === "boolean" &&
          ["caja", "cajaCuad", "cajaCon", "terminal", "subida", "bajada", "atrav"].includes(e.k)
            ? { ali: e.ali }
            : {}),
          // Montante que atraviesa un piso: su enlace con el piso siguiente
          ...(typeof e.mon2 === "string" && /^d[0-9]{1,7}$/.test(e.mon2) ? { mon2: e.mon2 } : {}),
          // Tablero del circuito del artefacto (lo hereda de la tubería que llega a él)
          ...(e.k !== "tab" && typeof e.tab === "string" && /^d[0-9]{1,7}$/.test(e.tab) ? { tab: e.tab } : {}),
          // Tablero: nombre, número de circuitos y descripción de cada uno
          ...((e.k === "tab" || e.k === "caja" || e.k === "cajaCuad") && e.nom ? { nom: txt(e.nom, 20) } : {}),
          ...(e.k === "tab" && n(e.nc) && e.nc >= 1 ? { nc: Math.min(60, Math.round(e.nc)) } : {}),
          ...(e.k === "tab" && Array.isArray(e.cd) ? { cd: e.cd.slice(0, 60).map(d => txt(d, 60)) } : {}),
          // Tablero de un departamento: índice de su tipo (edificio multifamiliar)
          ...(e.k === "tab" && Number.isInteger(e.dep) && e.dep >= 0 && e.dep < 100 ? { dep: e.dep } : {}),
          // Tipo de cada circuito del tablero (alumbrado, tomacorrientes, cocina, carga especial o reserva)
          ...(e.k === "tab" && Array.isArray(e.ct)
            ? { ct: e.ct.slice(0, 60).map(x => (["al", "tg", "tc", "esp", "res"].includes(x) ? x : "")) }
            : {}),
          // Tipo de luminaria del catálogo del proyecto (L1, L2…)
          ...(typeof e.lt === "string" && /^L[0-9]{1,3}$/.test(e.lt) ? { lt: e.lt } : {}),
          // Carga especial: descripción, tipo para la máxima demanda, trifásica y con electrónica
          ...(e.cn ? { cn: txt(e.cn, 60) } : {}),
          ...(["calentador", "cocina", "aire", "motor", "otra"].includes(e.ctp) ? { ctp: e.ctp } : {}),
          ...(e.fs === 1 || e.fs === 3 ? { fs: e.fs } : {}),
          // Circuito escrito junto a la salida: propio del elemento (sin él, como en todo el plano)
          ...(typeof e.nsal === "boolean" && e.k !== "tab" ? { nsal: e.nsal } : {}),
          // Tablero general: solo alimentadores, sin circuitos derivados
          ...(e.k === "tab" && e.gen === true ? { gen: true } : {}),
          // Banco de medidores sin su lista numerada en el plano
          ...(e.k === "bmed" && e.num === true ? { num: true } : {}),
          // Edificio: los medidores del banco escritos a mano en lugar de los de los departamentos
          ...(e.k === "bmed" && e.mman === true ? { mman: true } : {}),
          // Medidores del banco escritos por el proyectista (fuera de un edificio): a qué tablero va cada uno y sus fases
          ...(e.k === "bmed" && Array.isArray(e.meds) && e.meds.length
            ? {
                meds: e.meds.slice(0, 40).map(m => ({
                  d: String((m && m.d) || "")
                    .replace(/[<>]/g, "")
                    .slice(0, 20),
                  f: m && m.f === 3 ? 3 : 1
                }))
              }
            : {}),
          ...(e.elc === true ? { elc: true } : {})
        };
      if (e.t === "txt" && n(e.x) && n(e.y) && n(e.ht) && e.ht > 0)
        return {
          ...b,
          t: "txt",
          x: e.x,
          y: e.y,
          ht: e.ht,
          r: n(e.r) ? e.r : 0,
          s: txt(e.s, 200) || "Texto",
          ...aut
        };
      // Leyenda automática: esquina superior izquierda y título
      // Cuadro de circuitos: esquina superior izquierda
      if (e.t === "cua" && n(e.x) && n(e.y))
        return { ...b, t: "cua", x: e.x, y: e.y, tit: txt(e.tit, 60) || "CUADRO DE CIRCUITOS" };
      if (e.t === "ley" && n(e.x) && n(e.y))
        return { ...b, t: "ley", x: e.x, y: e.y, tit: txt(e.tit, 60) || "LEYENDA" };
      if (e.t === "cir" && n(e.x) && n(e.y) && n(e.rad) && e.rad > 0)
        return { ...b, t: "cir", x: e.x, y: e.y, rad: e.rad };
      // Cota: dos puntos medidos, desplazamiento de la línea de cota y dirección (alineada, horizontal o vertical)
      if (e.t === "cot" && [e.a, e.b].every(p => Array.isArray(p) && p.length === 2 && p.every(n)) && n(e.o))
        return {
          ...b,
          t: "cot",
          a: e.a.slice(),
          b: e.b.slice(),
          o: e.o,
          modo: ["alin", "h", "v"].includes(e.modo) ? e.modo : "alin"
        };
      // Directriz: punta y quiebre, con su texto
      if (e.t === "dir" && Array.isArray(e.pts) && e.pts.length === 4 && e.pts.every(n) && n(e.ht) && e.ht > 0)
        return { ...b, t: "dir", pts: e.pts.slice(), ht: e.ht, s: txt(e.s, 120) || "Texto", ...aut };
      if (
        (e.t === "lin" || e.t === "tub") &&
        Array.isArray(e.pts) &&
        e.pts.length >= 4 &&
        e.pts.length % 2 === 0 &&
        e.pts.length <= 20000 &&
        e.pts.every(n)
      )
        return {
          ...b,
          t: e.t,
          pts: e.pts.slice(),
          c: e.c === true,
          // Área marcada (polilínea cerrada): tipo para el cálculo y nombre del ambiente
          ...(e.t === "lin" && e.c === true && e.ar && typeof e.ar === "object"
            ? {
                ar: {
                  tp: ["tech", "ext", "sot", "libre", "aulas", "no"].includes(e.ar.tp) ? e.ar.tp : "tech",
                  n: txt(e.ar.n, 60),
                  // Tipo de ambiente (PL_AMB, js/calculo/calculo-plano.js)
                  ...(typeof e.ar.amb === "string" && (Object.hasOwn(PL_AMB, e.ar.amb) || /^u\d{1,3}$/.test(e.ar.amb))
                    ? { amb: e.ar.amb }
                    : {}),
                  ...(Array.isArray(e.ar.p) && e.ar.p.length === 2 && e.ar.p.every(n) ? { p: e.ar.p.slice() } : {}),
                  // Edificio: tipo de departamento del área
                  ...(Number.isInteger(e.ar.dep) && e.ar.dep >= 0 && e.ar.dep < 100 ? { dep: e.ar.dep } : {})
                }
              }
            : {}),
          // Curvatura de cada tramo (como en las polilíneas de AutoCAD), entre −1 y 1 (media circunferencia)
          ...(Array.isArray(e.b) && e.b.some(k => n(k) && k)
            ? { b: e.b.slice(0, e.pts.length / 2).map(k => (n(k) ? Math.max(-1, Math.min(1, k)) : 0)) }
            : {}),
          ...(e.t === "tub"
            ? {
                // Recorrido: techo, pared (las dos con línea continua) o piso (discontinua)
                modo: ["piso", "pared"].includes(e.modo) ? e.modo : "techo",
                ...cir,
                ...(typeof e.tab === "string" && /^d[0-9]{1,7}$/.test(e.tab) ? { tab: e.tab } : {}),
                // Artefactos a los que está conectada en su inicio (c0) y en su final (c1)
                ...(typeof e.c0 === "string" && /^d[0-9]{1,7}$/.test(e.c0) ? { c0: e.c0 } : {}),
                ...(typeof e.c1 === "string" && /^d[0-9]{1,7}$/.test(e.c1) ? { c1: e.c1 } : {}),
                // Otros circuitos del mismo tablero que van en la tubería (para el agrupamiento, Tabla 5C)
                ...(Array.isArray(e.cx) && e.cx.length
                  ? {
                      cx: [...new Set(e.cx.filter(x => typeof x === "string" && /^C-[0-9]{1,2}$/.test(x)))].slice(0, 30)
                    }
                  : {}),
                // Conductores que le dio el cálculo (texto: «2-1×2.5 + 1×2.5 T mm²»)
                ...(e.sec ? { sec: txt(e.sec, 160) } : {}),
                // Tubería de un alimentador (del medidor al tablero o entre tableros), sin circuito
                ...(e.ali === true ? { ali: true } : {}),
                // Etiquetas propias: longitud (total, por tramo u oculta) y circuito con diámetro (sin ellas, como el plano)
                ...(["no", "total", "tramo"].includes(e.etq) ? { etq: e.etq } : {}),
                ...(typeof e.cirt === "boolean" ? { cirt: e.cirt } : {}),
                // Diámetro nominal de la tubería (mm)
                ...([15, 20, 25, 35, 40, 50, 65, 80].includes(e.dia) ? { dia: e.dia } : {}),
                // Conductores que lleva (marcas de la norma): fases, neutro y tierra
                ...(e.cond && typeof e.cond === "object"
                  ? {
                      cond: {
                        // Hasta 12 fases y 6 neutros: una tubería puede llevar varios circuitos
                        f: Number.isInteger(e.cond.f) ? Math.max(0, Math.min(12, e.cond.f)) : 0,
                        // Neutros (antes era sí o no)
                        n: Number.isInteger(e.cond.n) ? Math.max(0, Math.min(6, e.cond.n)) : e.cond.n === true ? 1 : 0,
                        t: e.cond.t === true,
                        // Retornos de los interruptores (y viajeros de los de tres vías)
                        ...(Number.isInteger(e.cond.r) && e.cond.r > 0 ? { r: Math.min(12, e.cond.r) } : {})
                      },
                      // Marcados solos según el sistema (se actualizan); sin esta marca, los eligió el proyectista
                      ...(e.condA === true ? { condA: true } : {})
                    }
                  : {})
              }
            : {})
        };
      return null;
    })
    .filter(Boolean);
  // Identificadores únicos; capas para todos los elementos
  const ids = new Set();
  let k = els.reduce((m, e) => Math.max(m, parseInt(e.id.slice(1), 10) || 0), 0);
  els.forEach(e => {
    if (!e.id || ids.has(e.id)) e.id = "d" + ++k;
    ids.add(e.id);
    if (!capas.some(c => c.n === e.capa)) capas.push(capa({ n: e.capa }));
  });
  const actual = capas.some(c => c.n === v.actual) ? v.actual : "E-DIBUJO";
  return {
    capas,
    actual,
    els,
    escala: [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500].includes(v.escala) ? v.escala : 50,
    etq: ["no", "total", "tramo"].includes(v.etq) ? v.etq : "total",
    // Circuito y diámetro escritos sobre cada tubería
    ...(v.cirt === true ? { cirt: true } : {}),
    // Circuito escrito junto a cada salida
    ...(v.nsal === true ? { nsal: true } : {}),
    // Tuberías a interruptor con el color de siempre (por defecto, con su color propio)
    ...(v.intCol === false ? { intCol: false } : {}),
    // Catálogo de luminarias del proyecto: tipo (L1, L2…), descripción, potencia, control y si es de emergencia
    ...(Array.isArray(v.lums) && v.lums.length
      ? {
          lums: v.lums
            .filter(x => x && typeof x === "object" && typeof x.id === "string" && /^L[0-9]{1,3}$/.test(x.id))
            .slice(0, 60)
            .map(x => ({
              id: x.id,
              n: txt(x.n, 60),
              w: n(x.w) && x.w >= 0 ? Math.min(100000, x.w) : 0,
              ...(["sensor", "foto", "temp", "dimmer"].includes(x.ctrl) ? { ctrl: x.ctrl } : {}),
              ...(["emer", "senal"].includes(x.emer) ? { emer: x.emer } : {})
            }))
        }
      : {}),
    // Láminas: papel, escala, zona (planta, todo, la pantalla o un rectángulo), capas, colores, leyenda, título,
    // número y notas (la v3.0.0-b10 guardaba una sola, en lam)
    ...(() => {
      const L = (Array.isArray(v.lams) ? v.lams : v.lam && typeof v.lam === "object" ? [v.lam] : [])
        .filter(l => l && typeof l === "object")
        .slice(0, 40)
        .map(l => ({
          tam: ["A4", "A3", "A2", "A1"].includes(l.tam) ? l.tam : "A3",
          ...([10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500].includes(l.esc) ? { esc: l.esc } : {}),
          zona: typeof l.zona === "string" && /^(|todo|vista|rect|planta:\d{1,3})$/.test(l.zona) ? l.zona : "",
          ...(Array.isArray(l.rect) && l.rect.length === 4 && l.rect.every(n) ? { rect: l.rect.slice() } : {}),
          ...(Array.isArray(l.ocl)
            ? {
                ocl: l.ocl
                  .filter(x => typeof x === "string")
                  .slice(0, 200)
                  .map(x => txt(x, 60))
              }
            : {}),
          arq: ["gris", "negro", "color"].includes(l.arq) ? l.arq : "gris",
          color: l.color === "bn" ? "bn" : "color",
          ley: l.ley !== false,
          cua: l.cua !== false,
          tit: txt(l.tit, 120),
          num: txt(l.num, 20),
          notas: txt(l.notas, 2000)
        }));
      return L.length
        ? { lams: L, lamI: Number.isInteger(v.lamI) && v.lamI >= 0 && v.lamI < L.length ? v.lamI : 0 }
        : {};
    })(),
    // Símbolos con criterio del proyectista: relleno, tamaño, letra y grosor por tipo
    ...(v.simb && typeof v.simb === "object"
      ? {
          simb: Object.fromEntries(
            Object.entries(v.simb)
              .filter(([k, o]) => /^[a-zA-Z0-9]{1,12}$/.test(k) && o && typeof o === "object")
              .slice(0, 200)
              .map(([k, o]) => [
                k,
                {
                  ...(["solido", "achurado", "mitad", "ninguno"].includes(o.rel) ? { rel: o.rel } : {}),
                  ...(n(o.tam) && o.tam >= 0.5 && o.tam <= 2 && o.tam !== 1 ? { tam: o.tam } : {}),
                  ...(typeof o.let === "string" ? { let: txt(o.let, 4) } : {}),
                  ...(o.gr === 1.6 ? { gr: 1.6 } : {})
                }
              ])
              .filter(([, o]) => Object.keys(o).length)
          )
        }
      : {}),
    // Criterios de la revisión del diseño (editables)
    ...(v.crit && typeof v.crit === "object"
      ? {
          crit: {
            sal: Number.isInteger(v.crit.sal) ? Math.max(1, Math.min(100, v.crit.sal)) : 12,
            cur: Number.isFinite(v.crit.cur) ? Math.max(90, Math.min(720, v.crit.cur)) : 360
          }
        }
      : {})
  };
}
