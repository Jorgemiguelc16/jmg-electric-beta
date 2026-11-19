/* PIEZAS COMUNES DE LOS PLANOS
   La paleta de las láminas, los colores de los conductores y las piezas que se repiten en varios planos: los
   conductores en sus colores, el recuadro de notas y la puerta metálica de un tablero. Las primitivas de dibujo
   (L, T, R, C, TRI) están en js/planos/simbolos.js (trazos). */
// Paleta: tinta, azul de títulos, cobre, gris de textos secundarios, gris de líneas finas y verde de tierra
const PAL = { INK: "#14212e", NAVY: "#14304f", CU: "#9a5a23", GR: "#5a6775", LN: "#bfc8d2", VE: "#2f7a4b" };
/* Colores de los conductores como se ven en obra: fases R rojo (y F en monofásico), S negro y T azul; neutro
   blanco, dibujado con borde gris para que se vea sobre la lámina; tierra verde con franjas amarillas. El orden de
   las fases es criterio de diseño. */
const COND = { R: "#c62828", S: "#000000", T: "#1565c0", F: "#c62828", N: "#ffffff" };
// Color del texto de un conductor: el neutro en gris y el negro en tinta, para que se lean
const colTxtCond = b => (b === "N" ? PAL.GR : COND[b] === "#000000" ? PAL.INK : COND[b] || PAL.INK);
/* Dibujante de conductores rectos sobre la lista o (capa E-CABLEADO): devuelve cable(x1, y1, x2, y2, b, w), con b
   la fase, N o PE y w el grosor (wDef por defecto); con «redondo», los extremos van redondeados */
const conductorSvg =
  (o, wDef = 1.2, redondo = false) =>
  (x1, y1, x2, y2, b, w = wDef) => {
    const ln = (col, ww, dash) =>
      o.push(
        `<line x1="${px2(x1)}" y1="${px2(y1)}" x2="${px2(x2)}" y2="${px2(y2)}" stroke="${col}" stroke-width="${ww}"${redondo ? ' stroke-linecap="round"' : ""}${dash ? ` stroke-dasharray="${dash}"` : ""} data-capa="E-CABLEADO"/>`
      );
    if (b === "PE") {
      ln(PAL.VE, w + 0.4);
      ln("#ffd200", w * 0.6, "3 3");
    } else if (b === "N") {
      ln("#8a9199", w + 0.8);
      ln("#ffffff", w * 0.55);
    } else ln(COND[b] || PAL.INK, w);
  };
// Recuadro de notas numeradas (capa E-NOTAS) en x, y, de ancho w y alto h; cada nota se parte en líneas de hasta 150
// caracteres
function notasSvg(o, x, y, w, h, notas) {
  const { T, R } = trazos(o);
  o.push(`<g data-capa="E-NOTAS">`);
  R(x, y, w, h, { st: PAL.NAVY, sw: 1 });
  T(x + 10, y + 16, "NOTAS", { s: 9, b: 1, f: PAL.NAVY });
  let ny = y + 32;
  notas.forEach((t, i) => {
    const ln = [];
    let u = "";
    t.split(" ").forEach(p => {
      if ((u + " " + p).trim().length > 150 && u) {
        ln.push(u);
        u = p;
      } else u = (u + " " + p).trim();
    });
    ln.push(u);
    ln.forEach((l, j) => {
      if (!j) T(x + 10, ny, `${i + 1}.`, { s: 7.6, b: 1, f: PAL.NAVY });
      T(x + 22, ny, l, { s: 7.6 });
      ny += 10;
    });
    ny += 1.5;
  });
  o.push(`</g>`);
}
/* Puerta metálica de un tablero en x, y, de ancho w y alto h: bisagras a la izquierda, chapa con manija a la derecha,
   la señal de riesgo eléctrico de ancho s con su borde superior en ys, la placa con el nombre del tablero (tab) y su
   descripción (nom, de tamaño sNom) y, si caben, rejillas de ventilación abajo */
function puertaMetalica(o, x, y, w, h, { s, ys, tab, nom, sNom = 7 }) {
  const { T, R, C } = trazos(o),
    xc = x + w / 2;
  R(x, y, w, h, { fi: "#e6e9ed", sw: 1.4 });
  R(x + 9, y + 9, w - 18, h - 18, { fi: "#f3f6f9", sw: 0.9 });
  [0.16, 0.84].forEach(p => R(x + 2, y + h * p - 14, 7, 28, { fi: "#c9ced5", st: PAL.GR, sw: 0.6 }));
  R(x + w - 30, y + h / 2 - 26, 12, 52, { fi: "#c9ced5", st: PAL.GR, sw: 0.7 });
  R(x + w - 27, y + h / 2 - 18, 6, 26, { fi: PAL.INK, st: "", sw: 0 });
  C(x + w - 24, y + h / 2 + 16, 2.4, { fi: "#fff", st: PAL.GR, sw: 0.6 });
  const yS = ys + senalRiesgoTexto(o, xc - s / 2, ys, s) + 12,
    pl = Math.min(Math.max(104, s * 1.1), w - 70),
    rj = Math.min(100, w - 70);
  R(xc - pl / 2, yS, pl, 26, { fi: "#fff", sw: 0.9 });
  T(xc, yS + 17, tab, { s: 10, b: 1, a: "middle", f: PAL.NAVY });
  T(xc, yS + 40, nom, { s: sNom, b: 1, a: "middle", f: PAL.GR });
  if (yS + 50 < y + h - 70)
    for (let k = 0; k < 6; k++) R(xc - rj / 2, y + h - 70 + k * 8, rj, 3.5, { fi: "#c9ced5", st: "", sw: 0 });
}
