/* PÁGINAS DE LA WEB
   Fondo animado, alcance, glosario, preguntas frecuentes, novedades y formulario de soporte. */
(function () {
  const NS = "http://www.w3.org/2000/svg",
    g = $("feeders"),
    o = $("ondas");
  const mk = (t, a, p) => {
    const e = document.createElementNS(NS, t);
    for (const k in a) e.setAttribute(k, a[k]);
    (p || g).appendChild(e);
    return e;
  };
  [130, 215, 300, 385, 470].forEach((x, i) => {
    mk("line", { x1: x, y1: 400, x2: x, y2: 450 });
    mk("line", { x1: x - 6, y1: 444, x2: x + 6, y2: 456 });
    mk("line", { x1: x + 6, y1: 444, x2: x - 6, y2: 456 });
    mk("line", { x1: x, y1: 458, x2: x + 16, y2: 488 });
    mk("line", { x1: x, y1: 490, x2: x, y2: 560 });
    if (i > 0) mk("rect", { x: x - 9, y: 512, width: 18, height: 22 });
    mk("circle", { cx: x, cy: 578, r: 14 });
    const t = mk("text", { x: x, y: 618, "text-anchor": "middle", fill: "#14304f", stroke: "none" });
    t.textContent = "C-" + (i + 1);
  });
  [0, 120, 240].forEach(ph => {
    let d = "";
    for (let x = 0; x <= 520; x += 4) {
      const y = 850 - 46 * Math.sin((x / 520) * 4 * Math.PI - (ph * Math.PI) / 180);
      d += (x ? "L" : "M") + (40 + x) + " " + y.toFixed(1) + " ";
    }
    mk("path", { d }, o);
  });
  mk("line", { x1: 40, y1: 850, x2: 560, y2: 850, "stroke-dasharray": "4 6" }, o);
})();

/* ================= Contenido estático ================= */
{
  const li = t =>
    `<li><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1.5" y="1.5" width="15" height="15"/><path d="M5 9.5l2.5 2.5L13 6.5"/></svg>${t}</li>`;
  $("scope").innerHTML =
    `<li class="sc-t">Diseño sobre el plano</li>` +
    ALCANCE_DIS.map(li).join("") +
    `<li class="sc-t">Cálculo según el CNE-Utilización</li>` +
    ALCANCE.map(li).join("");
}
$("normsList").innerHTML = NORMAS.map(
  ([cod, tit, desc, uso]) =>
    `<article class="norm"><span class="code">${cod}</span><h3>${tit}</h3><p>${desc}</p><p class="uso"><strong>Aplicación:</strong> ${uso}</p></article>`
).join("");
$("critList").innerHTML = CRITERIOS.map(t => `<li>${t}</li>`).join("");
$("docList").innerHTML = DOCS.map(t => `<li>${t}</li>`).join("");
$("glossList").innerHTML = GLOSARIO.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
$("faqList").innerHTML = FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("");
$("changeList").innerHTML = NOVEDADES.map(([v, t]) => `<li><b>${v}</b><span>${t}</span></li>`).join("");

/* ================= Soporte ================= */
function msgSoporte() {
  const t = $("sp_tipo").value,
    n = $("sp_nom").value.trim(),
    a = $("sp_asu").value.trim(),
    m = $("sp_msg").value.trim();
  let body = `Tipo: ${t}\nNombre: ${n || "—"}\n\n${m || "(sin mensaje)"}\n\n— JMG - ELECTRIC ${VERSION}`;
  if ($("sp_datos").checked && LAST) {
    const r = LAST,
      a0 = r.alims[0];
    body += `\n\nResumen del proyecto\nProyecto: ${r.c.proj.nombre || "—"}\nTipo: ${r.mode === "multi" ? "Multifamiliar" : "Unifamiliar"} · ${a0.s.nom}\nMáxima demanda: ${fmt((r.mode === "multi" ? r.MD : r.md.MD) / 1000, 2)} kW\nAlimentador: ${a0.s.n}-1×${a0.S} mm² · ITM ${a0.s.tri ? 3 : 2}×${a0.itm} A\nCircuitos: ${r.circ.length} · Verificación: ${r.alims.every(x => x.ok) && r.circ.every(q => q.ok) ? "conforme" : "con observaciones"}`;
  }
  return { asunto: `[JMG - ELECTRIC] ${t}${a ? ": " + a : ""}`, body };
}
function refrSoporte() {
  const { asunto, body } = msgSoporte();
  $("sp_mail").href =
    `mailto:jorgemiguel16621@gmail.com?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(body)}`;
}
$("tab-soporte").addEventListener("input", refrSoporte);
$("tab-soporte").addEventListener("change", refrSoporte);
$("sp_mail").addEventListener("click", () => {
  refrSoporte();
  $("sp_info").textContent = "Abriendo su aplicación de correo…";
});
$("sp_copy").addEventListener("click", async () => {
  const { asunto, body } = msgSoporte();
  try {
    await navigator.clipboard.writeText(`${asunto}\n\n${body}`);
    $("sp_info").textContent = "Mensaje copiado.";
  } catch (e) {
    $("sp_info").textContent = "No se pudo copiar: seleccione el texto manualmente.";
  }
});
