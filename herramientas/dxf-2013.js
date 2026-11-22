/* Revisión de un DXF de AutoCAD 2000 en adelante (los planos de la plataforma salen en AutoCAD 2013, AC1027), solo para
   desarrollo (la usan herramientas/pruebas-dxf.js y herramientas/pruebas-ui.mjs). Comprueba lo que AutoCAD exige al
   abrirlo y que un error al escribir el archivo rompería:
   - pares código/valor completos, con códigos enteros;
   - identificadores (5 y 105) únicos y menores que $HANDSEED;
   - cada entidad del espacio modelo con su identificador, su dueño (el registro *Model_Space) y AcDbEntity;
   - capas (8), estilos de texto (7) y tipos de línea (6) que existen en sus tablas;
   - TEXT con altura mayor que 0 y LWPOLYLINE con tantos vértices como dice su código 90.
   Devuelve la lista de problemas (vacía si el archivo está bien), los primeros 10. */
function dxf2013Problemas(txt) {
  const ln = String(txt).split(/\r?\n/);
  if (ln[ln.length - 1] === "") ln.pop();
  const P = [],
    mal = m => P.length < 10 && P.push(m);
  if (ln.length % 2) mal("número impar de líneas: un par código/valor incompleto");
  const par = [];
  for (let i = 0; i + 1 < ln.length; i += 2) {
    const c = ln[i].trim();
    if (!/^-?\d+$/.test(c)) mal(`línea ${i + 1}: código no entero «${c}»`);
    par.push([+c, ln[i + 1], i + 1]);
  }
  // Encabezado
  const hv = n => {
    const i = par.findIndex(([c, v]) => c === 9 && v.trim() === n);
    return i < 0 ? null : par[i + 1][1].trim();
  };
  const seed = parseInt(hv("$HANDSEED") || "0", 16);
  if (!/^AC10(1[5-9]|2\d|3\d)$/.test(hv("$ACADVER") || ""))
    mal(`versión ${hv("$ACADVER")}: no es AutoCAD 2000 o posterior`);
  // Secciones, tablas y registros
  const nombres = { LAYER: new Set(), STYLE: new Set(), LTYPE: new Set() },
    handles = new Map();
  let sec = "",
    tabla = "",
    rec = null,
    ms = "";
  // Dueños válidos en ENTITIES: el espacio modelo y los espacios papel (las presentaciones)
  const ps = new Set();
  const ents = [];
  let ent = null;
  let conId = false;
  par.forEach(([c, v, l], i) => {
    v = v.trim();
    if (c === 0) conId = false;
    if (c === 0) {
      if (rec && rec.t === "BLOCK_RECORD" && /^\*model_space$/i.test(rec.n || "")) ms = rec.h;
      if (rec && rec.t === "BLOCK_RECORD" && /^\*paper_space/i.test(rec.n || "")) ps.add(rec.h);
      rec = null;
      if (ent) ents.push(ent);
      ent = null;
      if (v === "SECTION") sec = "?";
      else if (v === "ENDSEC") sec = "";
      else if (v === "TABLE") tabla = "?";
      else if (v === "ENDTAB") tabla = "";
      else if (sec === "TABLES" && tabla) rec = { t: v };
      else if (sec === "ENTITIES") ent = { t: v, g: [], l };
      return;
    }
    if (sec === "?" && c === 2) sec = v;
    else if (tabla === "?" && c === 2) tabla = v;
    // Solo el identificador propio de cada objeto (el primer 5 o 105 después de su 0): otros objetos usan el código 5
    // para otros datos (SORTENTSTABLE, el orden de dibujo)
    if ((c === 5 || c === 105) && sec && sec !== "HEADER" && !conId) {
      conId = true;
      const h = parseInt(v, 16);
      if (handles.has(h)) mal(`línea ${l}: identificador repetido ${v}`);
      handles.set(h, l);
      if (!(h < seed)) mal(`línea ${l}: identificador ${v} no menor que $HANDSEED`);
    }
    if (rec) {
      if (c === 2 && rec.n === undefined) {
        rec.n = v;
        if (nombres[rec.t]) nombres[rec.t].add(v.toUpperCase());
      }
      if (c === 5 && rec.h === undefined) rec.h = v;
    }
    // Lo que va entre «102 {…}» y «102 }» (reactores, diccionarios) no son datos de la entidad
    if (ent && c === 102) ent.llave = v.startsWith("{");
    else if (ent && !ent.llave) ent.g.push([c, v]);
    if (i === par.length - 1 && ent) ents.push(ent);
  });
  if (!ms) mal("sin registro *Model_Space");
  ents.forEach(({ t, g, l }) => {
    const val = c => (g.find(p => p[0] === c) || [])[1];
    if (!val(5)) mal(`línea ${l}: ${t} sin identificador`);
    if (val(330) !== ms && !ps.has(val(330))) mal(`línea ${l}: ${t} sin dueño en el espacio modelo ni en el papel`);
    if (!g.some(([c, v]) => c === 100 && v === "AcDbEntity")) mal(`línea ${l}: ${t} sin AcDbEntity`);
    const ly = val(8);
    if (ly === undefined || !nombres.LAYER.has(ly.toUpperCase()))
      mal(`línea ${l}: ${t} en la capa «${ly}», que no está en la tabla`);
    const st = val(7);
    if (t === "TEXT" && st !== undefined && !nombres.STYLE.has(st.toUpperCase()))
      mal(`línea ${l}: estilo de texto «${st}» que no está en la tabla`);
    const lt = val(6);
    if (lt !== undefined && !/^by(layer|block)$/i.test(lt) && !nombres.LTYPE.has(lt.toUpperCase()))
      mal(`línea ${l}: tipo de línea «${lt}» que no está en la tabla`);
    if (t === "TEXT" && !(+val(40) > 0)) mal(`línea ${l}: TEXT con altura ${val(40)}`);
    if (t === "LWPOLYLINE" && +val(90) !== g.filter(([c]) => c === 10).length)
      mal(`línea ${l}: LWPOLYLINE con ${val(90)} vértices declarados y ${g.filter(([c]) => c === 10).length} escritos`);
  });
  if ((ln[ln.length - 1] || "").trim() !== "EOF") mal("sin EOF al final");
  return P;
}
if (typeof module !== "undefined") module.exports = { dxf2013Problemas };
