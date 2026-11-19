/* EDITOR DE DEPARTAMENTOS
   Contenido de la pestaña Departamentos de la ventana Datos del proyecto (js/ventanas/datos-proyecto.js): a la izquierda
   la lista de tipos de departamento (agregar, duplicar, quitar) y a la derecha todo lo del tipo elegido: sus
   datos, sus salidas de otra potencia (listas lumsT y tomsT) y sus cargas especiales (lista cargasT), cada una
   en una tabla pequeña. Debajo, el resultado de ese departamento con vista previa.
   Se trabaja sobre una copia (DPD) de las cuatro listas; las filas de salidas y cargas apuntan al tipo por su
   posición en la copia (campo tipo o dep), y al quitar o duplicar un tipo se ajustan igual que en el panel
   (LISTS.tipos.quitar). Al aplicar la ventana, la copia reemplaza a las listas del proyecto. */
let DPD = null,
  DPD_SEL = 0;
const DPD_L = ["tipos", "lumsT", "tomsT", "cargasT"];
const dpdCopia = () => Object.fromEntries(DPD_L.map(k => [k, LISTS[k].arr.map(x => ({ ...x }))]));
// Cantidad de un tipo en la lista: departamentos o, si es un local de otro uso, locales
const dpdUnid = x => {
  const n = Math.round(x.cant),
    loc = x.uso && x.uso !== "viv";
  return `${n} ${loc ? (n > 1 ? "locales" : "local") : n > 1 ? "dptos" : "dpto"}`;
};
function depAbrir() {
  DPD = dpdCopia();
  DPD_SEL = Math.min(DPD_SEL, Math.max(0, DPD.tipos.length - 1));
}
function depCerrar() {
  DPD = null;
}
// Copia con la misma limpieza de datos que el panel (números vacíos como null, selecciones como número)
function dpdLimpia(nm, x) {
  const L = LISTS[nm],
    y = { ...L.nuevo(), ...x };
  L.f.forEach(f => {
    const v = y[f.k];
    if (f.t === "number") y[f.k] = v === "" || v == null ? null : parseFloat(v) || 0;
    else if (f.n) y[f.k] = +v || 0;
    else if (f.t === "text") y[f.k] = String(v ?? "").replace(/[<>]/g, "");
  });
  return y;
}
const dpdListas = () => (DPD ? Object.fromEntries(DPD_L.map(k => [k, DPD[k].map(x => dpdLimpia(k, x))])) : {});
const depCambios = () =>
  DPD ? DPD_L.filter(k => JSON.stringify(dpdListas()[k]) !== JSON.stringify(LISTS[k].arr)).length : 0;
// Al aplicar: las copias pasan a las listas del proyecto (el recálculo lo hace la ventana)
function depAplicar() {
  if (!depCambios()) return;
  const N = dpdListas();
  DPD_L.forEach(k => {
    LISTS[k].arr.length = 0;
    LISTS[k].arr.push(...N[k]);
    renderList(k);
  });
}
// Filas de una lista que pertenecen al tipo j (con su posición en la copia)
const dpdDe = (nm, j) =>
  DPD[nm].map((x, i) => [x, i]).filter(([x]) => Math.round(+(nm === "cargasT" ? x.dep : x.tipo) || 0) === j);
const dpdNum = (nm, i, k, v, u = "", ph = "") =>
  `<span class="tc-u"><input data-dd="${nm}|${i}|${k}" type="number" min="0" step="any" value="${v == null ? "" : esc(v)}"${ph ? ` placeholder="${ph}"` : ""} aria-label="${k}"><em>${u}</em></span>`;
function depHTML() {
  if (!DPD) return "";
  const T = DPD.tipos,
    j = DPD_SEL,
    t = T[j];
  const lista = T.map(
    (x, i) =>
      `<button type="button" class="tc-it${i === j ? " sel" : ""}" data-ddsel="${i}"><b>${i + 1}</b><span>${esc(x.nombre || `Tipo ${i + 1}`)}</span><em>${x.cant > 0 ? dpdUnid(x) : ""}</em><i></i></button>`
  ).join("");
  let der = `<p class="fc-nota">Agregue el primer tipo de departamento con +.</p>`;
  if (t) {
    const campo = (k, l, u = "", ancho = "") =>
      `<label class="dp-c fc-e${ancho}${k !== "nombre" && !(parseFloat(t[k]) > 0) ? " tc-falta" : ""}"><span>${l}</span>${
        k === "nombre"
          ? `<input data-dd="tipos|${j}|nombre" type="text" value="${esc(t.nombre ?? "")}" aria-label="${l}">`
          : dpdNum("tipos", j, k, t[k], u)
      }</label>`;
    // Salidas de otra potencia: luminarias (lumsT) y tomacorrientes (tomsT) de este tipo
    const otras = [
      ...dpdDe("lumsT", j).map(([x, i]) => ["lumsT", "Luminarias", x, i]),
      ...dpdDe("tomsT", j).map(([x, i]) => ["tomsT", "Tomacorrientes", x, i])
    ];
    const tOtras = otras.length
      ? `<table class="dd-t"><thead><tr><th class="t">Salida</th><th class="dd-n">Cantidad</th><th class="dd-n">W por salida</th><th></th></tr></thead><tbody>${otras
          .map(
            ([nm, l, x, i]) =>
              `<tr><td class="t">${l}</td><td>${dpdNum(nm, i, "n", x.n, "", "ej. 4")}</td><td>${dpdNum(nm, i, "p", x.p, "W", "ej. 20")}</td><td><button type="button" class="dd-x" data-ddquitar="${nm}|${i}" title="Quitar" aria-label="Quitar">✕</button></td></tr>`
          )
          .join("")}</tbody></table>`
      : `<p class="fc-nota">Todas las salidas usan la potencia general de Parámetros (${$("pAl").value} W por salida de alumbrado, ${$("pTo").value} W por tomacorriente).</p>`;
    // Cargas especiales de este tipo (cargasT)
    const cs = dpdDe("cargasT", j),
      tipoSel = (i, v) =>
        `<select data-dd="cargasT|${i}|tipo" aria-label="Tipo">${tcCorto(TIPOS)
          .map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(l)}</option>`)
          .join("")}</select>`;
    const tCargas = cs.length
      ? `<table class="dd-t"><thead><tr><th class="t">Descripción</th><th class="t dd-tipo">Tipo</th><th class="dd-n">Potencia</th><th class="dd-n">Longitud</th><th class="dd-e" title="Con electrónica (inverter, variador, inducción): su diferencial se sugiere tipo A">Electr.</th><th></th></tr></thead><tbody>${cs
          .map(
            ([x, i]) =>
              `<tr><td class="t"><input data-dd="cargasT|${i}|nombre" type="text" value="${esc(x.nombre ?? "")}" placeholder="ej. Terma eléctrica" aria-label="Descripción"></td><td class="t">${tipoSel(i, x.tipo)}</td><td${x.p > 0 ? "" : ' class="tc-falta"'}>${dpdNum("cargasT", i, "p", x.p, "W")}</td><td${x.L > 0 ? "" : ' class="tc-falta"'}>${dpdNum("cargasT", i, "L", x.L, "m")}</td><td><select data-dd="cargasT|${i}|elec" aria-label="Con electrónica">${ELEC.map(([v]) => `<option value="${v}"${String(+x.elec || 0) === v ? " selected" : ""}>${v === "1" ? "Sí" : "No"}</option>`).join("")}</select></td><td><button type="button" class="dd-x" data-ddquitar="cargasT|${i}" title="Quitar" aria-label="Quitar">✕</button></td></tr>`
          )
          .join("")}</tbody></table>`
      : `<p class="fc-nota">Sin cargas especiales: agregue una con los botones de abajo.</p>`;
    const rap = TC_RAPIDAS.cargasT
      .map(
        ([l, tp, n]) =>
          `<button type="button" class="vw-btn" data-ddrap="${tp}|${esc(n)}" title="${esc(n)}">${l}</button>`
      )
      .join("");
    der =
      `<fieldset class="fc-g"><legend>${t.uso && t.uso !== "viv" ? "Local de otro uso" : "Departamento"} ${j + 1}</legend><div class="dp-grid">${campo("nombre", "Denominación", "", " ancho")}${campo("cant", t.uso && t.uso !== "viv" ? "Nº de locales" : "Nº de dptos.")}${campo("area", "Área", "m²")}${campo("Ld", "Long. alimentador", "m")}${campo("Lc", "Long. de circuitos", "m")}<label class="dp-c fc-e" title="Vivienda: máxima demanda por la Regla 050-202. Un local de otro uso (comercio, discoteca, oficina…) con su medidor en el banco: Regla 050-210 y Tabla 14, por el área exterior; entra al alimentador general al 75 % (Regla 050-202(3)(d))"><span>Uso</span><select data-dd="tipos|${j}|uso" aria-label="Uso">${USOS_TIPO.map(([v, l]) => `<option value="${v}"${String(t.uso || "viv") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label><label class="dp-c fc-e" title="Medidor del departamento en el banco de medidores: trifásico, por ejemplo, para un local comercial"><span>Medidor</span><select data-dd="tipos|${j}|fases" aria-label="Medidor">${FASES_MED.map(([v, l]) => `<option value="${v}"${String(t.fases || "1") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label></div></fieldset>` +
      `<fieldset class="fc-g"><legend>Salidas</legend><div class="dp-grid">${campo("nAl", "Salidas de alumbrado")}${campo("nTo", "Tomacorrientes")}</div>` +
      `<div class="dd-sub"><span>Salidas de otra potencia</span><button type="button" class="vw-btn" data-ddadd="lumsT">+ Luminarias</button><button type="button" class="vw-btn" data-ddadd="tomsT">+ Tomacorrientes</button></div>${tOtras}</fieldset>` +
      `<fieldset class="fc-g"><legend>Cargas especiales</legend>${tCargas}<div class="tc-rap"><span>Agregar</span>${rap}</div></fieldset>`;
  }
  return `<div class="dd-main"><div class="tc-izq"><div class="tc-lista">${lista}</div><div class="tc-acc"><button class="vw-btn" type="button" data-dda="add" title="Agregar un tipo de departamento" aria-label="Agregar">+</button><button class="vw-btn" type="button" data-dda="dup" title="Duplicar el tipo elegido, con sus salidas y cargas" aria-label="Duplicar"${t ? "" : " disabled"}>⧉</button><button class="vw-btn" type="button" data-dda="del" title="Quitar el tipo elegido" aria-label="Quitar"${t ? "" : " disabled"}>✕</button></div></div><div class="dd-der"><div class="tc-res" id="ddRes"></div>${der}</div></div>`;
}
// Resultado del departamento elegido: con cambios, la vista previa; sin cambios, el cálculo del proyecto
function depRes() {
  const el = $("ddRes");
  if (!el || !DPD) return;
  const pend = typeof DP_PEND === "object" && DP_PEND ? DP_PEND : {},
    hay = depCambios() || Object.keys(pend).filter(k => k !== "_tipo").length,
    r = hay ? previaCampos(pend, dpdListas()) : LAST,
    t = r && r.T ? r.T.find(x => x._i === DPD_SEL) : null;
  if (!t) {
    el.className = "tc-res";
    el.innerHTML = `<span class="tc-rt">${r ? "Indique el número de departamentos de este tipo para calcularlo." : "Complete los datos marcados en ámbar para calcular."}</span>`;
    return;
  }
  const a = r.alims.find(x => x.pKey === "tipo" && r.T[x.ti] === t),
    cs = r.circ.filter(q => q.tab === t.tab),
    ok = cs.every(q => q.ok) && (!a || a.ok);
  el.className = "tc-res" + (hay ? " previa" : "");
  el.innerHTML = `<i class="cd-est ${ok ? "ok" : "bad"}"></i><b>MD ${fmt(t.md.MD / 1000, 2)} kW por ${t.com ? "unidad · 050-210" : "dpto."}</b>${a ? `<span>Alimentador ${a.s.n}-1×${a.S} mm² · ITM ${a.s.tri ? 3 : 2}×${a.itm ?? "—"} A</span><span>ΔV ${fmt(a.dvAc, 2)} %</span>` : ""}<span>${cs.length} circuitos</span><span class="tc-ok">${ok ? "Conforme" : "Revisar"}</span>${hay ? `<em>Vista previa: así quedaría al aplicar</em>` : ""}`;
}
// Redibuja el contenido conservando el foco en el mismo dato
function depRedibujar() {
  const f = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.dd : null,
    box = $("dpBody").querySelector(".dd-main");
  if (!box) return;
  box.outerHTML = depHTML();
  if (f) document.querySelector(`#dpBody [data-dd="${f}"]`)?.focus();
  depRes();
  dpPie();
}
let DPD_T = null;
$("dpDlg").addEventListener("input", e => {
  const el = e.target.closest("[data-dd]");
  if (!el || !DPD) return;
  const [nm, i, k] = el.dataset.dd.split("|"),
    x = DPD[nm][+i];
  if (!x) return;
  x[k] = el.type === "number" ? (el.value === "" ? null : parseFloat(el.value)) : el.value;
  const cel = el.closest(".dp-c,td");
  if (cel && el.type === "number") cel.classList.toggle("tc-falta", !(parseFloat(el.value) > 0));
  // El nombre y la cantidad se ven en la lista de la izquierda
  if (nm === "tipos" && (k === "nombre" || k === "cant" || k === "uso")) {
    const it = $("dpBody").querySelector(`[data-ddsel="${i}"]`);
    if (it) {
      it.querySelector("span").textContent = x.nombre || `Tipo ${+i + 1}`;
      it.querySelector("em").textContent = x.cant > 0 ? dpdUnid(x) : "";
    }
  }
  dpPie();
  clearTimeout(DPD_T);
  DPD_T = setTimeout(depRes, 200);
});
$("dpDlg").addEventListener("change", e => {
  if (e.target.matches("select[data-dd]")) e.target.dispatchEvent(new Event("input", { bubbles: true }));
  // Al cambiar el uso, los textos del tipo (departamento o local) cambian
  if (e.target.matches('[data-dd$="|uso"]')) depRedibujar();
});
$("dpDlg").addEventListener("click", e => {
  if (!DPD) return;
  const s = e.target.closest("[data-ddsel]");
  if (s) {
    DPD_SEL = +s.dataset.ddsel;
    return depRedibujar();
  }
  const j = DPD_SEL,
    ad = e.target.closest("[data-ddadd]"),
    rp = e.target.closest("[data-ddrap]"),
    qt = e.target.closest("[data-ddquitar]"),
    a = e.target.closest("[data-dda]");
  if (ad) {
    DPD[ad.dataset.ddadd].push({ ...LISTS[ad.dataset.ddadd].nuevo(), tipo: j });
    depRedibujar();
    const ins = $("dpBody").querySelectorAll(`[data-dd^="${ad.dataset.ddadd}|"][data-dd$="|n"]`);
    ins[ins.length - 1]?.focus();
  } else if (rp) {
    const [tipo, nombre] = rp.dataset.ddrap.split("|");
    DPD.cargasT.push({ ...LISTS.cargasT.nuevo(), tipo, nombre, dep: j });
    depRedibujar();
    const ins = $("dpBody").querySelectorAll('[data-dd^="cargasT|"][data-dd$="|p"]');
    ins[ins.length - 1]?.focus();
  } else if (qt) {
    const [nm, i] = qt.dataset.ddquitar.split("|");
    DPD[nm].splice(+i, 1);
    depRedibujar();
  } else if (a) {
    const T = DPD.tipos;
    if (a.dataset.dda === "add") {
      T.push(LISTS.tipos.nuevo());
      T[T.length - 1].nombre = "Tipo " + String.fromCharCode(65 + T.length - 1);
      DPD_SEL = T.length - 1;
    } else if (a.dataset.dda === "dup" && T[j]) {
      // El duplicado lleva también sus salidas de otra potencia y sus cargas especiales
      const n = T.length;
      T.push({ ...T[j], nombre: (T[j].nombre || "Tipo") + " (copia)" });
      ["lumsT", "tomsT"].forEach(k => dpdDe(k, j).forEach(([x]) => DPD[k].push({ ...x, tipo: n })));
      dpdDe("cargasT", j).forEach(([x]) => DPD.cargasT.push({ ...x, dep: n }));
      DPD_SEL = n;
    } else if (a.dataset.dda === "del" && T[j]) {
      T.splice(j, 1);
      [
        ["lumsT", "tipo"],
        ["tomsT", "tipo"],
        ["cargasT", "dep"]
      ].forEach(([k, c]) => {
        for (let i = DPD[k].length - 1; i >= 0; i--) {
          if (+DPD[k][i][c] === j) DPD[k].splice(i, 1);
          else if (+DPD[k][i][c] > j) DPD[k][i][c]--;
        }
      });
      DPD_SEL = Math.max(0, j - 1);
    }
    depRedibujar();
  }
});
