/* Revisión de un DXF R12 (AC1009) con las reglas que AutoCAD exige al abrirlo, solo para desarrollo (la usan
   herramientas/pruebas-dxf.js y herramientas/pruebas-ui.mjs). Un archivo que no las cumple no abre en AutoCAD
   («Pulse INTRO para continuar» con la lista de errores):
   - pares código/valor completos, con códigos enteros;
   - números de los códigos 10 a 59 finitos y enteros los de 60 a 79;
   - nombres de capa (código 8 y tabla LAYER) solo con A-Z, 0-9, $, - y _, de 1 a 31 caracteres;
   - textos (código 1) sin caracteres de control y de 255 caracteres como máximo;
   - TEXT con altura mayor que 0 y POLYLINE con al menos dos vértices.
   Devuelve la lista de problemas (vacía si el archivo está bien), los primeros 10. */
function dxfR12Problemas(txt) {
  const ln = String(txt).split(/\r?\n/);
  if (ln[ln.length - 1] === "") ln.pop();
  const P = [],
    mal = m => P.length < 10 && P.push(m);
  if (ln.length % 2) mal("número impar de líneas: un par código/valor incompleto");
  const capaOk = n => /^[A-Za-z0-9_$-]{1,31}$/.test(n);
  let ent = null,
    nv = 0,
    enLayer = false;
  for (let i = 0; i + 1 < ln.length; i += 2) {
    const c = ln[i].trim(),
      v = ln[i + 1],
      k = +c;
    if (!/^-?\d+$/.test(c)) {
      mal(`línea ${i + 1}: código no entero «${c}»`);
      continue;
    }
    if (k >= 10 && k <= 59 && !Number.isFinite(+v)) mal(`línea ${i + 2}: número inválido «${v}» (código ${k})`);
    if (k >= 60 && k <= 79 && !/^\s*-?\d+\s*$/.test(v)) mal(`línea ${i + 2}: entero inválido «${v}» (código ${k})`);
    if (k === 1 && (/[\u0000-\u001f\u007f]/.test(v) || v.length > 255))
      mal(`línea ${i + 2}: texto con caracteres de control o de más de 255 caracteres`);
    if (k === 8 && !capaOk(v)) mal(`línea ${i + 2}: nombre de capa inválido en R12 «${v}»`);
    if (k === 0) {
      // Cierre de la entidad anterior
      if (ent === "POLYLINE" && v !== "VERTEX") {
        if (nv < 2) mal(`línea ${i + 1}: POLYLINE con ${nv} vértice(s)`);
        ent = null;
      }
      if (v === "VERTEX" && ent === "POLYLINE") nv++;
      else if (v === "POLYLINE") {
        ent = "POLYLINE";
        nv = 0;
      } else if (v !== "VERTEX" && v !== "SEQEND") ent = v;
      enLayer = v === "LAYER";
    }
    if (enLayer && k === 2 && !capaOk(v)) mal(`línea ${i + 2}: capa de la tabla inválida en R12 «${v}»`);
    if (ent === "TEXT" && k === 40 && !(+v > 0)) mal(`línea ${i + 2}: TEXT con altura ${v}`);
  }
  if ((ln[ln.length - 1] || "").trim() !== "EOF") mal("sin EOF al final");
  return P;
}
if (typeof module !== "undefined") module.exports = { dxfR12Problemas };
