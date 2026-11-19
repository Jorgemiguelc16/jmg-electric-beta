/* ADMINISTRADOR DE CAPAS del editor de diseño (botón Capas de la cinta)
   Ventana con todas las capas: las del diseño eléctrico (nombre, color, tipo de línea, visible, bloqueada y capa
   actual, que se pueden cambiar; nuevas capas y eliminar las vacías) y las del plano de arquitectura (solo se
   muestran u ocultan: son una referencia). Los cambios van a la copia del editor, con su deshacer, como todo lo
   del editor; pasan al proyecto con Aplicar. */
const CA_VW = ventanaMovil(document.querySelector("#capasDlg .vw"), "jmg-electric-capas", {
  w: 900,
  h: 540,
  minW: 640,
  minH: 320
});
let CA_FILA = null;
function capasAbrir() {
  if (!EPL || !PL_MOD) return toast("Primero abra el plano de arquitectura en DXF");
  dsAsegurar();
  $("capasDlg").hidden = false;
  vwFondo();
  CA_VW.abrir();
  capasRender();
}
function capasCerrar() {
  $("capasDlg").hidden = true;
  vwFondo();
}
// Elementos del diseño por capa
const caCuenta = () => {
  const n = {};
  dsD().els.forEach(el => (n[el.capa] = (n[el.capa] || 0) + 1));
  return n;
};
function capasRender() {
  if ($("capasDlg").hidden || !EPL || !PL_MOD) return;
  const D = dsD(),
    m = PL_MOD,
    oc = new Set(EPL.ocultas),
    cnt = caCuenta(),
    f = $("caFiltro").value,
    b = ($("caBusca").value || "").trim().toLowerCase(),
    ve = n => !b || n.toLowerCase().includes(b),
    lt = v =>
      `<select data-caf="lt">${Object.entries(DS_LT)
        .map(([k, t]) => `<option value="${k}"${k === v ? " selected" : ""}>${t}</option>`)
        .join("")}</select>`;
  // Grosor de línea: fino (una línea normal, el de siempre) o en milímetros
  const gr = v =>
    `<select data-caf="gr">${DS_GROSORES.map(
      g => `<option value="${g}"${g === v ? " selected" : ""}>${g ? fmt(g, 2) + " mm" : "Fino"}</option>`
    ).join("")}</select>`;
  const filasDis = D.capas
    .filter(c => f !== "arq" && ve(c.n))
    .map(
      c =>
        `<tr data-cad="${esc(c.n)}"${CA_FILA === "d:" + c.n ? ' class="sel"' : ""}><td class="ca-act">${c.n === D.actual ? '<b title="Capa actual: las líneas y textos nuevos van aquí">✓</b>' : ""}</td>` +
        `<td><input type="text" data-caf="n" value="${esc(c.n)}" maxlength="60" aria-label="Nombre de la capa"></td>` +
        `<td class="ca-c"><input type="checkbox" data-caf="vis"${c.vis ? " checked" : ""} aria-label="Visible"></td>` +
        `<td class="ca-c"><input type="checkbox" data-caf="bloq"${c.bloq ? " checked" : ""} aria-label="Bloqueada"></td>` +
        `<td><input type="color" data-caf="col" value="${c.col}" aria-label="Color"></td>` +
        `<td>${lt(c.lt)}</td><td>${gr(c.gr || 0)}</td><td class="ca-or">Diseño eléctrico</td><td class="ca-n">${cnt[c.n] || 0}</td></tr>`
    )
    .join("");
  const filasArq = Object.keys(m.capas)
    .filter(n => m.capas[n].n > 0 && f !== "dis" && ve(n))
    .sort((x, y) => x.localeCompare(y, "es", { numeric: true }))
    .map(n => {
      const c = m.capas[n];
      return (
        `<tr data-caa="${esc(n)}" class="ca-arq${CA_FILA === "a:" + n ? " sel" : ""}"><td></td><td><span class="ca-nom">${esc(n)}</span></td>` +
        `<td class="ca-c"><input type="checkbox" data-caf="vis"${oc.has(n) ? "" : " checked"} aria-label="Visible"></td>` +
        `<td class="ca-c" title="La arquitectura es una referencia: no se mueve"><input type="checkbox" checked disabled aria-label="Bloqueada"></td>` +
        `<td><i class="ca-sw" style="background:${plColor(c.col)}"></i></td><td class="ca-lt">${c.lt === "CONTINUOUS" ? "Continua" : esc(c.lt.toLowerCase())}</td>` +
        `<td class="ca-lt">Fino</td><td class="ca-or"${c.on ? "" : ' title="Esta capa está apagada o congelada en el archivo DXF: el autor del plano la dejó oculta"'}>Arquitectura (DXF)${c.on ? "" : " · <b>apagada en el archivo</b>"}</td><td class="ca-n">${c.n}</td></tr>`
      );
    })
    .join("");
  $("caTabla").innerHTML =
    `<table class="ca-t"><thead><tr><th>Actual</th><th>Nombre</th><th>Visible</th><th>Bloqueada</th><th>Color</th><th>Tipo de línea</th><th>Grosor</th><th>Origen</th><th>Elementos</th></tr></thead><tbody>` +
    (filasDis && f !== "arq"
      ? `<tr class="ca-g"><td colspan="9">Diseño eléctrico · ${D.capas.length} capas</td></tr>` + filasDis
      : "") +
    (filasArq ? `<tr class="ca-g"><td colspan="9">Plano de arquitectura · ${EPL.nombre}</td></tr>` + filasArq : "") +
    `</tbody></table>`;
  const nd = D.capas.length,
    na = Object.keys(m.capas).filter(n => m.capas[n].n > 0).length;
  $("caNota").textContent =
    `${nd} capas del diseño · ${na} del plano de arquitectura (${na - Object.keys(m.capas).filter(n => m.capas[n].n > 0 && oc.has(n)).length} visibles) · capa actual: ${D.actual}`;
  $("caDel").disabled = !CA_FILA || !CA_FILA.startsWith("d:");
  $("caAct").disabled = !CA_FILA || !CA_FILA.startsWith("d:");
}
// Un cambio de capas: a la copia del editor (con deshacer) y se vuelve a dibujar
function caCambio() {
  plPreparar();
  edCambio();
  capasRender();
}
$("caTabla").addEventListener("click", e => {
  const tr = e.target.closest("tr[data-cad], tr[data-caa]");
  if (!tr) return;
  const id = tr.dataset.cad != null ? "d:" + tr.dataset.cad : "a:" + tr.dataset.caa;
  if (CA_FILA === id) return;
  CA_FILA = id;
  if (!e.target.closest("input, select")) capasRender();
  else {
    $("caTabla")
      .querySelectorAll("tr.sel")
      .forEach(x => x.classList.remove("sel"));
    tr.classList.add("sel");
    $("caDel").disabled = $("caAct").disabled = !id.startsWith("d:");
  }
});
// Doble clic en una capa del diseño: pasa a ser la capa actual
$("caTabla").addEventListener("dblclick", e => {
  const tr = e.target.closest("tr[data-cad]");
  if (!tr || e.target.closest("input, select")) return;
  dsD().actual = tr.dataset.cad;
  caCambio();
});
$("caTabla").addEventListener("change", e => {
  const f = e.target.closest("[data-caf]"),
    tr = e.target.closest("tr");
  if (!f || !tr) return;
  const k = f.dataset.caf;
  if (tr.dataset.caa != null) {
    const n = tr.dataset.caa,
      oc = new Set(EPL.ocultas);
    if (f.checked) oc.delete(n);
    else oc.add(n);
    EPL.ocultas = [...oc];
    return caCambio();
  }
  const D = dsD(),
    c = D.capas.find(x => x.n === tr.dataset.cad);
  if (!c) return;
  if (k === "n") {
    const v = f.value.replace(/[<>]/g, "").trim().slice(0, 60);
    if (!v || (v !== c.n && D.capas.some(x => x.n === v))) {
      f.value = c.n;
      return toast(v ? "Ya hay una capa con ese nombre" : "Escriba el nombre de la capa");
    }
    // Los elementos y la capa actual siguen a la capa con su nombre nuevo
    D.els.forEach(el => el.capa === c.n && (el.capa = v));
    if (D.actual === c.n) D.actual = v;
    CA_FILA = "d:" + v;
    c.n = v;
  } else if (k === "vis" || k === "bloq") {
    c[k] = f.checked;
    if (!c.vis || c.bloq) D.els.forEach(el => el.capa === c.n && DS_SEL.delete(el.id));
  } else if (k === "col") c.col = /^#[0-9a-f]{6}$/i.test(f.value) ? f.value.toLowerCase() : c.col;
  else if (k === "lt") c.lt = DS_LT[f.value] ? f.value : "cont";
  else if (k === "gr") {
    const g = +f.value;
    if (DS_GROSORES.includes(g) && g) c.gr = g;
    else delete c.gr;
  }
  caCambio();
});
$("capasDlg").addEventListener("click", e => {
  const b = e.target.closest("[data-ca]");
  if (e.target.id === "capasDlg") return capasCerrar();
  if (!b || b.disabled) return;
  const a = b.dataset.ca,
    D = dsD();
  if (a === "cerrar") capasCerrar();
  else if (a === "max") CA_VW.maximizar();
  else if (a === "nueva") {
    let i = 1;
    while (D.capas.some(c => c.n === "E-CAPA " + i)) i++;
    D.capas.push({ n: "E-CAPA " + i, col: "#37474f", lt: "cont", vis: true, bloq: false });
    CA_FILA = "d:E-CAPA " + i;
    caCambio();
    const inp = $("caTabla").querySelector("tr.sel input[data-caf='n']");
    if (inp) {
      inp.focus();
      inp.select();
    }
  } else if (a === "actual" && CA_FILA && CA_FILA.startsWith("d:")) {
    D.actual = CA_FILA.slice(2);
    caCambio();
  } else if (a === "borrar" && CA_FILA && CA_FILA.startsWith("d:")) {
    const n = CA_FILA.slice(2),
      k = caCuenta()[n] || 0;
    // Como en AutoCAD: no se elimina una capa con elementos ni la capa actual
    if (k) return toast(`La capa tiene ${k} elemento${k > 1 ? "s" : ""}: muévalos a otra capa o bórrelos antes`);
    if (n === D.actual) return toast("No se puede eliminar la capa actual: elija otra como actual");
    D.capas = D.capas.filter(c => c.n !== n);
    CA_FILA = null;
    caCambio();
  } else if (a === "todas" || a === "ninguna") {
    const f = $("caFiltro").value,
      on = a === "todas";
    if (f !== "arq") D.capas.forEach(c => (c.vis = on));
    if (f !== "dis") EPL.ocultas = on ? [] : Object.keys(PL_MOD.capas);
    caCambio();
  }
});
["caFiltro", "caBusca"].forEach(id => $(id).addEventListener("input", capasRender));
addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("capasDlg").hidden && !/INPUT|SELECT/.test(document.activeElement.tagName)) {
    e.preventDefault();
    capasCerrar();
  }
});
