/* EXPEDIENTE TÉCNICO EN PDF (RNE EM.010, Art. 8)
   Arma el documento para imprimir: portada, memoria descriptiva y de cálculo, tablas, unifilar y anexos,
   en estilo formal o a color. */
// Estilos: "formal" (blanco y negro, para presentar a la entidad) o "jmg" (con los colores de la plataforma)
function expediente(r, estilo = "formal", lamsDis = []) {
  const c = r.c,
    P = c.proj,
    multi = r.mode === "multi",
    a0 = r.alims[0],
    s0 = a0.s,
    md = multi ? r.MD : r.md.MD;
  // Notación matemática: variables en cursiva, subíndices, fracciones y raíces
  const mi = s => `<i>${s}</i>`,
    sb = (v, s) => `<i>${v}</i><sub>${s}</sub>`,
    fr = (a, b) => `<span class="mf"><span>${a}</span><span>${b}</span></span>`,
    sq = x => `√<span class="ms">${x}</span>`,
    mx = x => `<span class="mx">${x}</span>`;
  const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const nom = P.nombre || "Proyecto sin nombre",
    tipoEd = nomRes(r);
  const ok = r.alims.every(a => a.ok) && r.circ.every(q => q.ok),
    maxDV = Math.max(...r.alims.map(a => a.dvAc), ...r.circ.map(q => q.dVt));
  const tub = t => (t.mm ? `${t.mm} mm (${t.pul})` : t.pul),
    cond = (n, S, St) => `${n}-1×${S} mm² + 1×${St} mm² (T)${c.desig ? " " + esc(c.desig) : ""}`;
  // Tablas numeradas por capítulo («Tabla 2.3») con su título y su fuente debajo; el índice de tablas las lista
  const TABLAS = [];
  let nt = 0,
    ne = 0;
  const tabla = (tit, html, fuente = "") => {
    const n = `${n1}.${++nt}`,
      id = "ex-t" + n.replace(".", "-"),
      // Las tablas cortas no se parten entre páginas; las largas sí, repitiendo su encabezado
      corta = (html.match(/<tr/g) || []).length <= 16;
    TABLAS.push([n, tit, id]);
    return `<figure class="ex-fig${corta ? " ex-corta" : ""}" id="${id}"><figcaption><b>Tabla ${n}.</b> ${tit}</figcaption>${html}${fuente ? `<p class="ex-fuente">${fuente}</p>` : ""}</figure>`;
  };
  // Columnas numéricas (números con o sin unidad): alineadas a la derecha
  const esNum = x =>
    /^[−+-]?\d[\d\s.,×]*\s?(%|W|kW|A|kA|V|m|m²|mm²|Ω|°C)?$/.test(
      String(x)
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim()
    );
  const tbl = (head, rows, cls = "", tit = "", fuente = "") => {
    const der = head.map(
      (_, i) => rows.some(rw => esNum(rw[i])) && rows.every(rw => rw[i] === "—" || rw[i] === "" || esNum(rw[i]))
    );
    const t = `<table class="ex-tbl ${cls}"><thead><tr>${head.map((h, i) => `<th${der[i] ? ' class="r"' : ""}>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map((x, i) => `<td${der[i] ? ' class="r"' : ""}>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    return tit ? tabla(tit, t, fuente) : t;
  };
  const kv = (rows, tit = "", fuente = "") => {
    const t = `<table class="ex-tbl ex-kv"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>`;
    return tit ? tabla(tit, t, fuente) : t;
  };
  // Los cuadros de resultados de la plataforma pasan al formato del expediente: su título como «Tabla n.m», la
  // referencia normativa debajo de la tabla y sus notas a continuación
  const deCard = html =>
    html.replace(/<section class="card([^"]*)">([\s\S]*?)<\/section>/g, (m, cl, t) => {
      const h2 = (t.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1] || "",
        ref = ((h2.match(/<span class="ref">([\s\S]*?)<\/span>/) || [])[1] || "").replace(/<[^>]+>/g, "").trim(),
        tit = h2
          .replace(/<span class="ref">[\s\S]*?<\/span>/, "")
          .replace(/<[^>]+>/g, "")
          .trim(),
        cuerpo = t.replace(/<h2>[\s\S]*?<\/h2>/, "");
      if (!/<table/.test(cuerpo)) return `<div class="ex-bloque${cl}">${cuerpo}</div>`;
      const k = cuerpo.indexOf('<div class="body">'),
        tabl = k < 0 ? cuerpo : cuerpo.slice(0, k),
        // Sin las indicaciones propias de la pantalla (doble clic, colores ámbar)
        nota = (k < 0 ? "" : cuerpo.slice(k))
          .replace(/\s*Doble clic[^.<]*\./g, "")
          .replace(/\s*En ámbar: valores al 90 % o más de su límite( \([^)]*\))?\./g, ""),
        reglas = (ref.match(/\d{3}-\d{3}/g) || []).length,
        norma = reglas > 0 || /Tabla \d/.test(ref);
      const fuente = norma
        ? `Referencia: CNE-Utilización, ${/^(Regla|Tabla)/.test(ref) ? "" : reglas > 1 ? "Reglas " : "Regla "}${ref}.`
        : "";
      return tabla(tit + (ref && !norma ? ` · ${ref}` : ""), `<div class="ex-card${cl}">${tabl}</div>`, fuente) + nota;
    });
  // Numeración de capítulos y subcapítulos con índice automático
  const TOC = [];
  let n1 = 0,
    n2 = 0;
  // Cada título lleva un id para que el índice enlace a él (el PDF conserva los enlaces)
  const tid = n => "ex-s" + n.replace(/\./g, "-");
  const cap = (t, cls = "") => {
    n1++;
    n2 = 0;
    nt = 0;
    ne = 0;
    TOC.push([`${n1}`, t, 0]);
    return `<section class="ex-sec ${cls}"><h1 class="ex-h1" id="${tid(`${n1}`)}"><span>${n1}.</span>${t}</h1>`;
  };
  const sub = t => {
    n2++;
    TOC.push([`${n1}.${n2}`, t, 1]);
    return `<h2 class="ex-h2" id="${tid(`${n1}.${n2}`)}"><span>${n1}.${n2}</span>${t}</h2>`;
  };
  const fin = "</section>";
  let B = "";

  /* ---------- 1. MEMORIA DESCRIPTIVA ---------- */
  B += cap("Memoria descriptiva");
  B += sub("Generalidades");
  const objeto = multi
    ? r.TC
      ? `un edificio de ${r.units.length} unidades con su medidor en el banco: ${r.units.length - r.units.filter(u => u.com).length} departamentos y ${r.units.filter(u => u.com).length} local${r.units.filter(u => u.com).length > 1 ? "es" : ""} de otro uso (${[...new Set(r.TC.map(t => t.md.U.n.toLowerCase()))].join(", ")})${r.SV.length ? ", con servicios generales" : ""}`
      : `un edificio multifamiliar de ${r.units.length} departamentos (${r.T.length} tipo${r.T.length > 1 ? "s" : ""})${r.SV.length ? " con servicios generales" : ""}`
    : `una vivienda unifamiliar${r.varios ? ` de ${r.PS.length} pisos` : ""}`;
  B += `<p>La presente memoria corresponde al proyecto de instalaciones eléctricas interiores de ${objeto}, denominado <b>«${esc(nom)}»</b>${P.ubic ? `, ubicado en ${esc(P.ubic)}` : ""}${P.prop ? `, de propiedad de ${esc(P.prop)}` : ""}.</p>
    <p>El proyecto comprende el diseño de las instalaciones desde el punto de entrega de la empresa concesionaria hasta los puntos de utilización: alimentadores, tableros, circuitos derivados, sistemas de protección y sistema de puesta a tierra, conforme al Código Nacional de Electricidad – Utilización, al Reglamento Nacional de Edificaciones (Norma EM.010) y a la Norma DGE de conexiones en baja tensión.</p>`;
  B += sub("Alcance del proyecto");
  B += `<ul class="ex-list">${[...ALCANCE, "Especificaciones técnicas de materiales y equipos", "Metrado y presupuesto referencial", "Diagrama unifilar con cuadro de cargas (EM.010, Art. 8)", ...(lamsDis.length ? ["Planos de planta con la distribución de salidas, tuberías y circuitos"] : []), "Anexos: cálculo de cada circuito derivado, niveles de iluminación, protocolo de pruebas y documentos complementarios"].map(t => `<li>${t}</li>`).join("")}</ul>`;
  B += sub(multi ? "Descripción del edificio" : "Descripción de la vivienda");
  if (!multi) {
    B += kv(
      [
        ["Área techada" + (r.varios ? " (suma de pisos)" : ""), `${fmt(r.areaT, 1)} m²`],
        ["Área de sótano", `${fmt(r.sot, 1)} m²`],
        ["Área de vivienda computable (050-110)", `${fmt(r.area, 1)} m² · 100 % de pisos más 75 % del sótano`],
        ["Número de pisos", r.PS.length],
        [
          "Cargas especiales",
          r.cs.filter(x => x.p > 0).length
            ? r.cs
                .filter(x => x.p > 0)
                .map(x => `${esc(x.nombre || "Carga especial")} (${fmt(x.p, 0)} W)`)
                .join(", ")
            : "Ninguna"
        ]
      ],
      "Datos de la vivienda",
      r.plano && r.plano.areas && r.plano.areas.length
        ? "Fuente: áreas medidas en el diseño sobre el plano (ver Origen de los datos); área computable según la Regla 050-110 del CNE-Utilización."
        : "Fuente: datos del proyecto; área computable según la Regla 050-110 del CNE-Utilización."
    );
    const pw = { al: num("al_p"), tg: num("tg_p"), tc: num("tc_p") };
    B += tbl(
      ["Piso", "Tablero", "Área (m²)", "Alumbrado", "Tomacorrientes", "Tomac. cocina / lavandería"],
      r.PS.map(p => [
        `${ORD(p.n)} piso`,
        p.tab || "TG",
        fmt(p.area, 1),
        `${p.al.n} × ${fmt(pw.al, 0)} W`,
        `${p.tg.n} × ${fmt(pw.tg, 0)} W`,
        `${p.tc.n} × ${fmt(pw.tc, 0)} W`
      ]),
      "",
      "Salidas por piso",
      r.PS.some(p => p.plano)
        ? "Fuente: salidas contadas en el diseño sobre el plano (ver Origen de los datos)."
        : "Fuente: datos del proyecto."
    );
  } else {
    B += tbl(
      [
        "Tipo",
        "Uso",
        "Unidades",
        "Área (m²)",
        "Alumbrado",
        "Tomacorrientes",
        "Cocina (W)",
        "Calentador (W)",
        "Aire (W)",
        "Otras (W)"
      ],
      r.T.map(t => [
        esc(t.nombre),
        t.com ? esc(t.md.U.n) : "Vivienda",
        t.cant,
        fmt(t.area, 1),
        t.nAl,
        t.nTo,
        fmt(t.coc, 0),
        fmt(t.cal, 0),
        fmt(t.aire, 0),
        fmt(t.otras, 0)
      ]),
      "",
      r.TC ? "Unidades del edificio" : "Departamentos del edificio",
      "Fuente: datos del proyecto."
    );
    if (r.SV.length)
      B += tbl(
        ["Carga común", "Tipo", "Fases", "Potencia (W)"],
        r.SV.map(s => [esc(s.nombre), TSERV[s.tipo], s.fases === 3 && SIST[r.sk].tri ? "3φ" : "1φ", fmt(s.p, 0)]),
        "",
        "Cargas de servicios generales (tablero TSG)",
        "Fuente: datos del proyecto."
      );
  }
  // Con el diseño en el plano: qué datos se midieron en él y con qué criterio
  const fuente = planoFuente(r);
  if (fuente.length) {
    B += sub("Origen de los datos");
    B += `<p>Los datos de cálculo se obtuvieron del diseño de las instalaciones dibujado sobre el plano de arquitectura del proyecto:</p><ul class="ex-list">${fuente.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
  }
  B += sub("Suministro de energía");
  B += kv(
    [
      ["Sistema", `${s0.nom} · 60 Hz`],
      ["Número de fases", s0.tri ? (s0.n === 4 ? "3 (3F + N + PE)" : "3 (3F + PE)") : "1 (F + N + PE)"],
      ["Tipo de conexión", r.conexion],
      ["Potencia instalada", `${fmt(r.CI / 1000, 2)} kW`],
      ["Máxima demanda", `${fmt(md / 1000, 2)} kW`],
      ["Potencia a contratar sugerida", `${fmt(r.contratada, 1)} kW`],
      [
        "Corriente de cortocircuito en el punto de entrega",
        `${fmt(c.iccE, 1)} kA (dato de la concesionaria, Norma DGE 110.F)`
      ]
    ],
    "Datos del suministro",
    "Fuente: datos del proyecto y cálculo de la máxima demanda."
  );
  B += sub("Descripción de la instalación");
  B += `<p>Desde el ${multi ? "banco de medidores" : "medidor de energía"} parte el alimentador ${multi ? "general" : "principal"} <b>${cond(s0.n, a0.S, a0.St)}</b> de cobre, en tubería ${tub(a0.tubo)}, protegido con un interruptor termomagnético de <b>${s0.tri ? 3 : 2}×${a0.itm} A</b> y ${a0.pdc} kA de poder de corte, hasta el ${multi ? "tablero general (barra general)" : "tablero general TG"}.</p>`;
  B += tbl(
    ["Tablero", "Descripción", "Alimentado por", "Conductor", "ITM", "Circuitos", "Icc (kA)"],
    r.tabs.map(tb => {
      const f = r.alims[tb.feeder];
      return [
        `<b>${tb.tab}</b>`,
        esc(tb.desc),
        esc(f.desc),
        cond(f.s.n, f.S, f.St),
        `${f.s.tri ? 3 : 2}×${f.itm} A`,
        `${r.circ.filter(q => q.tab === tb.tab).length} + ${c.reserva} reserva`,
        fmt(tb.icc, 2)
      ];
    }),
    "",
    "Tableros y sus alimentadores",
    "Fuente: cálculo del proyecto."
  );
  B += `<p>Los circuitos derivados de alumbrado y tomacorrientes se agrupan con un máximo de ${c.maxSal} salidas por circuito (Regla 070-3000). Las cargas especiales tienen circuito independiente. Cada tablero tiene un interruptor general termomagnético en su cabecera, aguas arriba de los diferenciales (Regla 150-400(4)). Los circuitos se protegen con interruptores termomagnéticos de curva C${r.circ.some(q => q.motor) ? " (curva D en circuitos de motores)" : ""} y con interruptores diferenciales de 30 mA ${c.idMode === "grupo" ? "agrupados cada tres circuitos (Regla 150-400(8))" : "en cada circuito (Regla 150-400(9))"}. Cada tablero cuenta con ${c.reserva} espacio(s) de reserva equipados (Regla 050-108).</p>
    <p>El sistema de puesta a tierra está formado por ${r.pat.nVar > 1 ? `${r.pat.nVar} electrodos (varillas) de cobre en paralelo` : "un electrodo (varilla) de cobre"} de ${fmt(c.pat.Lv, 2)} m, conectados a la barra de tierra del tablero general con conductor de cobre de ${r.Selec} mm² (Tabla 17). Todos los circuitos llevan conductor de protección.</p>`;
  B += sub("Normas aplicables");
  B += tbl(
    ["Norma", "Título", "Aplicación en el proyecto"],
    NORMAS.map(([cod, tit, , uso]) => [`<b>${cod}</b>`, tit, uso]),
    "",
    "Normas aplicables"
  );
  // Reserva en alimentadores de vivienda: la norma admite 0 % (carga no continua); 25 % es la reserva usual para ampliaciones
  const resTxt =
    c.resAl > 0
      ? `reserva del ${c.resAl} % para ampliaciones; la norma no la exige porque su carga calculada no es continua, Reglas 050-200(3) y 050-202(2)`
      : "carga no continua, Reglas 050-200(3) y 050-202(2)";
  B += sub("Parámetros de diseño");
  B += kv(
    [
      ["Factor de potencia", fmt(c.fp, 2)],
      ["Método de instalación", MET[c.met]],
      ["Aislamiento del conductor", c.aisl === "pvc" ? "PVC 70 °C" : "XLPE / EPR 90 °C"],
      ["Temperatura ambiente · factor (Tabla 5A)", `${c.temp} °C · ${fmt(c.ft, 2)}`],
      ["Circuitos por tubería · factor (Tabla 5C)", `${c.nag} · ${fmt(c.fa, 2)}`],
      ["Factor total en circuitos derivados", fmt(c.fc, 2)],
      ["Resistividad del cobre (caída de tensión)", `${c.rho} Ω·mm²/m · ${c.rhoRef}`],
      [
        "Corriente de diseño",
        `${FD} × I en circuitos derivados y servicios generales (Regla 050-104) · ${fmt(c.fdA, 2)} × I en alimentadores de vivienda (${resTxt})`
      ],
      [
        "Caída de tensión máxima",
        `${DV_ALIM} % alimentadores · ${DV_DER} % derivados · ${DV_TOT} % total (Regla 050-102)`
      ],
      ["Sección mínima", `${c.sminA} mm² alimentadores · ${c.sminD} mm² derivados`],
      ["Salidas máximas por circuito", c.maxSal],
      ["Espacios de reserva por tablero", c.reserva]
    ],
    "Parámetros de diseño",
    "Fuente: parámetros elegidos por el proyectista, con las reglas del CNE-Utilización indicadas."
  );
  B += fin;

  /* ---------- 2. MEMORIA DE CÁLCULO ---------- */
  B += cap("Memoria de cálculo");
  B += sub("Criterios y fórmulas de cálculo");
  B += `<ol class="ex-list">${CRITERIOS.map(t => `<li>${t}</li>`).join("")}</ol>
    <div class="ex-calc ex-form"><dl>
      <dt>Corriente nominal</dt><dd>${mx(`${mi("I")} = ${fr(mi("P"), `${mi("k")} · ${mi("V")} · cos ${mi("φ")}`)}`)}<span class="ex-dn">${mi("k")} = 1 en monofásico; ${mi("k")} = √3 en trifásico</span></dd>
      <dt>Corriente de diseño</dt><dd>${mx(`${sb("I", "d")} = ${mi("f")} · ${mi("I")}`)}<span class="ex-dn">${mi("f")} = ${FD} en circuitos derivados (carga continua, Regla 050-104); ${mi("f")} = ${fmt(c.fdA, 2)} en alimentadores de vivienda (${resTxt}); no menor que la corriente mínima del código</span></dd>
      <dt>Selección</dt><dd>${mx(`${sb("I", "d")} ≤ ${sb("I", "n")} ≤ ${sb("I", "z")} · ${sb("F", "t")} · ${sb("F", "a")}`)}<span class="ex-dn">${sb("I", "n")}: interruptor · ${sb("I", "z")}: Tabla 2 · ${sb("F", "t")}, ${sb("F", "a")}: Tablas 5A y 5C</span></dd>
      <dt>Caída de tensión</dt><dd>${mx(`Δ${mi("V")} = ${fr(`${mi("K")} · ${mi("ρ")} · ${mi("L")} · ${mi("I")}`, mi("S"))}`)} &nbsp; ${mx(`Δ${mi("V")}% = ${fr(`Δ${mi("V")}`, mi("V"))} · 100`)}<span class="ex-dn">${mi("K")} = 2 en monofásico; ${mi("K")} = √3 en trifásico</span></dd>
      <dt>Cortocircuito</dt><dd>${mx(`${sb("I", "cc")} = ${fr(mi("V"), `${mi("k")} · ${sq(`${sb("Z", "f")}² + ${sb("R", "c")}²`)}`)}`)} &nbsp; ${mx(`${sb("Z", "f")} = ${fr(mi("V"), `${mi("k")} · ${sb("I", "cc,e")}`)}`)} &nbsp; ${mx(`${sb("R", "c")} = ${fr(`${mi("n")} · ${sb("ρ", "20")} · ${mi("L")}`, mi("S"))}`)}</dd>
      <dt>Puesta a tierra</dt><dd>${mx(`${mi("R")} = ${fr(mi("ρ"), `2π · ${mi("L")}`)} · (ln ${fr(`4 ${mi("L")}`, mi("a"))} − 1)`)}<span class="ex-dn">${mi("a")}: radio de la varilla (fórmula de Dwight)</span></dd></dl></div>`.replace(
    /<[/]dd>/g,
    () => `<em class="ex-eq">(${n1}.${++ne})</em></dd>`
  );
  B += sub("Cálculo de la máxima demanda");
  B += deCard(cardDemanda(r));
  B += fin + `<section class="ex-sec ex-ancho">` + sub("Alimentadores");
  B += deCard(tablaAlims(r, "")) + fin + `<section class="ex-sec ex-cont">`;
  B +=
    `<p class="ex-cap">Desarrollo del cálculo de cada alimentador</p>` +
    r.alims.map(a => detalleCalc(a, true)).join("");
  B += fin;
  B +=
    `<section class="ex-sec ex-ancho">` + sub("Circuitos derivados · cuadro de cargas") + deCard(tablaCircuitos(r, ""));
  const peor = r.circ.reduce((m, q) => (!m || q.dVt > m.dVt ? q : m), null);
  if (peor)
    B +=
      `<p class="ex-cap">Desarrollo del cálculo del circuito más desfavorable (mayor caída de tensión total)</p>` +
      detalleCalc(peor, false);
  B += fin + `<section class="ex-sec ex-cont">`;
  if (r.bal) {
    B += sub("Balance de cargas por fase");
    B += deCard(cardBalance(r, ""));
  }
  B += sub("Corriente de cortocircuito y poder de corte");
  B += tbl(
    ["Punto de la instalación", "Icc aguas arriba (kA)", "Conductor", "L (m)", "Icc estimada (kA)", "PdC mínimo (kA)"],
    [
      ["Punto de entrega (acometida)", "—", "—", "—", fmt(c.iccE, 2), a0.pdc],
      ...r.tabs.map(tb => {
        const f = r.alims[tb.feeder];
        return [
          `Tablero ${tb.tab}`,
          fmt(f.iccO, 2),
          `${f.s.tri ? 3 : 2}-1×${f.S} mm²`,
          fmt(f.L, 1),
          `<b>${fmt(tb.icc, 2)}</b>`,
          `<b>${tb.pdc}</b>`
        ];
      })
    ],
    "",
    "Corriente de cortocircuito y poder de corte",
    "Fuente: cálculo del proyecto (estimación conservadora, ver nota)."
  );
  B += `<p class="ex-nota">Estimación conservadora: impedancia de la fuente a partir de la corriente de cortocircuito del punto de entrega, más la resistencia de los conductores con ρ a 20 °C (${RHO_CU} Ω·mm²/m). El poder de corte de cada interruptor se elige igual o mayor que la corriente calculada en su tablero.</p>`;
  B += sub("Sistema de puesta a tierra");
  {
    const p = r.pat,
      a = p.dv / 2;
    B +=
      deCard(cardPozo(r, "")) +
      `<div class="ex-calc"><h4>Resistencia del electrodo vertical (fórmula de Dwight)</h4><dl>
      <dt>Electrodo</dt><dd>L = ${fmt(p.Lv, 2)} m · d = ${fmt(p.dv * 1000, 1)} mm · a = ${fmt(a, 5)} m · ρ = ${fmt(p.rho, 0)} Ω·m</dd>
      <dt>Sin tratamiento</dt><dd>${mx(`${mi("R")} = ${fr(fmt(p.rho, 0), `2π × ${fmt(p.Lv, 2)}`)} × (ln ${fr(`4 × ${fmt(p.Lv, 2)}`, fmt(a, 5))} − 1) = <b>${fmt(p.Rv, 2)} Ω</b>`)}</dd>
      <dt>Con tratamiento</dt><dd>${mx(`${sb("R", "t")} = ${mi("R")} · ${sb("f", "r")} = ${fmt(p.Rv, 2)} × ${fmt(p.fr, 2)} = <b>${fmt(p.Rt, 2)} Ω</b>`)}</dd>
      ${p.nVar > 1 ? `<dt>Electrodos en paralelo</dt><dd>${mx(`${sb("R", "n")} = ${fr(`${sb("R", "t")} · ${mi("F")}`, mi("n"))} = ${fr(`${fmt(p.Rt, 2)} × ${fmt(p.F, 2)}`, p.nVar)} = <b>${fmt(p.Rn, 2)} Ω</b>`)}<span class="ex-dn">separación ≥ longitud de la varilla</span></dd>` : ""}
      <dt>Verificación</dt><dd>${fmt(p.nVar > 1 ? p.Rn : p.Rt, 2)} Ω ${(p.nVar > 1 ? p.Rn : p.Rt) <= 25 ? "≤" : ">"} 25 Ω (Regla 060-712) ${pill((p.nVar > 1 ? p.Rn : p.Rt) <= 25)}</dd></dl></div>`;
  }
  B += sub("Verificaciones normativas");
  B += deCard(cardAlertas(r, ""));
  // Recomendaciones de diseño que el proyectista revisó y aceptó (las pendientes no se imprimen)
  const ac = ACEP[r.mode] || {},
    RA = recomendaciones(r).filter(x => ac[x.id]);
  if (RA.length)
    B += `<h3 class="ex-h3">Criterios de diseño revisados y aceptados por el proyectista</h3>
    <p>Las siguientes decisiones cumplen la normativa y fueron revisadas y aceptadas expresamente por el proyectista:</p>
    <ul class="ex-list">${RA.map(x => `<li><b>${esc(x.tit)}.</b> ${esc(x.txt)}</li>`).join("")}</ul>`;
  B += fin;

  /* ---------- 3. ESPECIFICACIONES TÉCNICAS ---------- */
  B += cap("Especificaciones técnicas de materiales");
  {
    const uniq = a => [...new Set(a)];
    const secc = uniq([...r.alims.map(a => a.S), ...r.circ.map(q => q.S)]).sort((a, b) => a - b),
      st = uniq([...r.alims.map(a => a.St), ...r.circ.map(q => q.St), r.Selec]).sort((a, b) => a - b);
    const tubos = uniq([...r.alims, ...r.circ].map(x => tub(x.tubo)));
    const itms = uniq([
      ...r.alims.map(a => `${a.s.tri ? 3 : 2}×${a.itm} A C`),
      ...r.circ.map(q => `${q.f3 ? 3 : 2}×${q.itm} A ${q.curva}`)
    ]);
    const pdcs = uniq([a0.pdc, ...r.tabs.map(t => t.pdc)]).sort((a, b) => a - b),
      ids = uniq(
        r.circ.map(
          q => `${r.circ.filter(x => x.tab === q.tab && x.idName === q.idName).some(x => x.f3) ? 4 : 2}×${q.idRat} A`
        )
      );
    const M = metrado(r),
      tabs = M.filter(x => /^Tablero /.test(x.desc || ""));
    const et = (t, items) =>
      `<div class="ex-et"><h3>${t}</h3><ul class="ex-list">${items.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
    B += sub("Conductores");
    B += et("Conductores de cobre", [
      (() => {
        const k = cableNorma(r);
        return `Cobre electrolítico recocido, cableado, ${k.tipo === "lsoh" ? "no propagador del incendio, de baja emisión de humos y libre de halógenos y ácidos corrosivos" : "no propagador de la llama"}${c.desig ? `, designación comercial ${esc(c.desig)}` : ""} (Regla 020-126${k.tipo === "lsoh" && k.lsohNorma ? "(3), por ser un local de pública concurrencia según la Regla 010-010(4)" : k.tipo === "lsoh" ? "; libre de halógenos por criterio del proyectista" : "(2)"}).`;
      })(),
      `Capacidad de corriente de la Tabla 2 del CNE-U para aislamiento ${c.aisl === "pvc" ? "de PVC a 70 °C" : "de XLPE o EPR a 90 °C"}${c.aisl === "pvc" ? "; con un cable de mayor temperatura de operación, el valor queda del lado seguro" : ""}.`,
      ...(cableNorma(r).tipo === "lsoh"
        ? [
            "Instalados de modo que no estén expuestos a daños mecánicos y cubiertos con material incombustible: dentro de tuberías o canalizaciones cerradas (Regla 020-126(3) y (4))."
          ]
        : []),
      `Secciones de fase y neutro utilizadas: ${secc.map(s => s + " mm²").join(", ")}. Conductores de protección y de puesta a tierra: ${st.map(s => s + " mm²").join(", ")}.`,
      "Conductor de protección con aislamiento de color verde o verde/amarillo, en todos los circuitos.",
      "Sin empalmes dentro de las tuberías; las uniones se ejecutan solo en cajas.",
      "Secciones mínimas: " + `${c.sminA} mm² en alimentadores y ${c.sminD} mm² en circuitos derivados.`
    ]);
    B += sub("Tuberías y cajas");
    B += et("Tuberías", [
      `PVC-SAP (pesado), ${c.met === "A1" ? "empotrado en muros y losas" : "según el método de instalación " + c.met}. Diámetros utilizados: ${tubos.join(", ")}.`,
      "Curvas de fábrica o ejecutadas en frío sin reducir la sección; uniones y conectores del mismo material, con pegamento para PVC.",
      "Ocupación máxima del 40 % de la sección interior del tubo."
    ]);
    B += et("Cajas", [
      "Octogonales de fierro galvanizado de 100 × 40 mm para salidas de alumbrado.",
      "Rectangulares de fierro galvanizado de 100 × 55 × 50 mm para tomacorrientes, interruptores y salidas de fuerza.",
      "Cuadradas de pase de 100 × 100 × 50 mm donde lo requiera el recorrido."
    ]);
    B += sub("Tableros y protecciones");
    B += et("Tableros de distribución", [
      "Gabinete según se indica para cada tablero: metálico, con puerta, chapa y mandil, o de PVC con tapa transparente; barras o borneras de cobre para fases, neutro y tierra; directorio de circuitos en la puerta.",
      "Interruptor general termomagnético en la cabecera de cada tablero, aguas arriba de los diferenciales (Regla 150-400(4)).",
      ...tabs.map(x => `${x.desc}${x.cant > 1 ? ` · ${x.cant} unidades` : ""}.`),
      `Espacio para ${c.reserva} interruptor${c.reserva === 1 ? "" : "es"} de reserva por tablero (Regla 050-108).`
    ]);
    B += et("Interruptores termomagnéticos", [
      "Norma IEC 60898-1, montaje en riel DIN; curva C para circuitos generales" +
        (r.circ.some(q => q.motor) ? " y curva D para circuitos de motores" : "") +
        ".",
      `Capacidades utilizadas: ${itms.join(", ")}.`,
      `Poder de corte no menor que ${pdcs.join(" / ")} kA, según el tablero (ver cálculo de cortocircuito).`
    ]);
    if (ids.length)
      B += et("Interruptores diferenciales", [
        `Norma IEC 61008-1, sensibilidad de 30 mA (Regla 150-400), ${r.circ.every(q => q.idTipo === "A") ? "tipo A" : r.circ.some(q => q.idTipo === "A") ? "tipo AC y tipo A en los circuitos con cargas electrónicas" : "tipo AC"} (IEC 60364-5-53).`,
        `Capacidades utilizadas: ${ids.join(", ")}.`
      ]);
    B += sub("Aparatos y puesta a tierra");
    B += et("Aparatos", [
      "Tomacorrientes dobles con toma de tierra, 16 A, 250 V.",
      "Interruptores unipolares simples de 10 A, 250 V.",
      "Salidas de fuerza para cargas especiales con caja y conductor de protección."
    ]);
    B += et("Puesta a tierra", [
      `Varilla de cobre de ${fmt(c.pat.Lv, 2)} m × ${PULG[c.pat.dv] || fmt(c.pat.dv * 1000, 1) + " mm"} (Regla 060-702), hincada con la cabeza a ${fmt(r.pat.cab, 2)} m bajo el terreno hasta ${fmt(r.pat.prof, 2)} m de profundidad (al menos 2.5 m, Regla 060-702(3)(d))${r.pat.nVar > 1 ? `, ${r.pat.nVar} unidades separadas al menos la longitud de la varilla` : ""}.`,
      "Conector de bronce para varilla y caja de registro de concreto con tapa.",
      ...(c.pat.fr < 1 ? ["Tratamiento del suelo con bentonita, gel u otro compuesto, una dosis por electrodo."] : []),
      `Conductor de cobre de ${r.Selec} mm² desde el electrodo hasta la barra de tierra del tablero general (Tabla 17).`,
      "Resistencia no mayor de 25 Ω (Regla 060-712)."
    ]);
  }
  B += fin;

  /* ---------- 4. METRADO ---------- */
  B += cap("Metrado y presupuesto");
  B += sub("Metrado de materiales") + deCard(cardMetrado(r));
  B += sub("Presupuesto referencial");
  {
    const C = preCalc(r);
    if (!C.nP)
      B += `<p>El presupuesto se obtiene del metrado anterior con los precios unitarios del proyectista (Resultados › Presupuesto › Precios unitarios). Este proyecto aún no tiene precios: las partidas y cantidades son las del metrado${C.d ? `, más ${fmt(C.d * 100, 0)} % de desperdicio en conductores y tuberías` : ""}.</p>`;
    else {
      const so = v => (v === null ? "—" : soles(v));
      B += tbl(
        ["Ítem", "Descripción", "Und.", "Cantidad", "P. unitario (S/)", "Parcial (S/)"],
        C.filas.map(x =>
          x.sec
            ? [`<b>${x.cod}</b>`, `<b>${esc(x.sec)}</b>`, "", "", "", `<b>${x.sub ? soles(r2(x.sub)) : ""}</b>`]
            : [x.cod, esc(x.desc), x.und, fmt(x.q, x.q % 1 ? 2 : 0), so(x.pu), so(x.par)]
        ),
        "",
        "Presupuesto referencial de las instalaciones eléctricas",
        `Fuente: metrado del proyecto${C.d ? ` (conductores y tuberías con ${fmt(C.d * 100, 0)} % de desperdicio)` : ""} y precios unitarios del proyectista${C.nP < C.nT ? `; ${C.nT - C.nP} partidas sin precio no suman al costo directo` : ""}.`
      );
      B += kv(
        [
          ["Costo directo", `S/ ${soles(C.cd)}`],
          [`Gastos generales (${fmt(C.P.gg, 1)} %)`, `S/ ${soles(C.gg)}`],
          [`Utilidad (${fmt(C.P.ut, 1)} %)`, `S/ ${soles(C.ut)}`],
          ["Subtotal", `S/ ${soles(C.sub)}`],
          [`IGV (${fmt(C.P.igv, 1)} %)`, `S/ ${soles(C.igv)}`],
          ["<b>Total presupuesto</b>", `<b>S/ ${soles(C.tot)}</b>`]
        ],
        "Resumen del presupuesto",
        "Gastos generales y utilidad: criterio del proyectista; IGV de 16 % más 2 % de IPM."
      );
      B += `<p><b>Son:</b> ${esc(solesLetras(C.tot))}.</p><p class="ex-nota">Presupuesto referencial a la fecha del documento; no incluye obras civiles, trámites ante la concesionaria ni el costo de la conexión.</p>`;
    }
  }
  B += fin;

  /* ---------- 5. PLANOS ---------- */
  // Las mismas láminas que se descargan en DXF (la lámina elegida en Planos), cada una reducida a una página A4;
  // horizontal o vertical: la que imprime el dibujo más grande (área útil A4 ≈ 269 × 163 mm o 182 × 245 mm)
  // Con láminas de planta del diseño, esas van primero y las que genera la plataforma se numeran después de ellas
  // Una planta dividida en varias láminas (IE-01, IE-01A…) cuenta como un solo número
  const nDis = lamsDis.reduce(
    (m, h) => Math.max(m, +(/^IE-(\d+)/.exec(h.hoja) || [0, 0])[1]),
    new Set(lamsDis.map(h => (/^IE-(\d+)/.exec(h.hoja) || [h.hoja])[0])).size
  );
  const lam = laminaPlano();
  let LAMS;
  ROT_DESP = nDis;
  try {
    LAMS = [
      ...lamsDis.map(h => ({
        ...h,
        dis: true,
        tit:
          h.vista && !h.tit.toUpperCase().includes(h.vista)
            ? `${h.tit} · ${h.vista[0] + h.vista.slice(1).toLowerCase()}`
            : h.tit
      })),
      ...[
        ...unifilarHojas(r, lam).map(h => ({ ...h, tit: "Diagrama unifilar" })),
        { ...alturas(r), hoja: "IE-02", tit: "Diagrama de alturas de montaje" },
        { ...detalles(r), hoja: "IE-03", tit: "Leyenda de símbolos y detalle del pozo de puesta a tierra" },
        ...tablerosHojas(r, lam).map(h => ({ ...h, tit: "Detalle de tableros y señal de seguridad" })),
        ...(b => (b ? [{ ...b, hoja: "IE-05", tit: "Tablero general del edificio" }] : []))(tableroGeneral(r)),
        ...(b => (b ? [{ ...b, hoja: "IE-06", tit: "Banco de medidores y balance de fases" }] : []))(bancoMedidores(r))
      ].map(h => ({ ...h, hoja: ieNum(h.hoja) }))
    ];
  } finally {
    ROT_DESP = 0;
  }
  // Continuaciones: «(continuación)» en el título cuando el plano sigue de la lámina anterior
  LAMS.forEach((h, k) => (h.cont = k > 0 && LAMS[k - 1].tit === h.tit));
  B += cap("Planos");
  B += sub("Lista de láminas");
  B += tbl(
    ["Lámina", "Contenido", "Formato"],
    [
      ...LAMS.map(h => [
        `<b>${esc(h.hoja)}</b>`,
        esc(h.tit) + (h.cont ? " (continuación)" : ""),
        h.dis ? `${h.tam} · escala 1:${h.esc}` : lam
      ]),
      ...(lamsDis.length
        ? []
        : [["—", "Planos de planta: distribución de alumbrado, tomacorrientes y fuerza", "Los adjunta el proyectista"]])
    ],
    "",
    "Lista de láminas"
  );
  B += `<p>Las láminas se generan a partir de los resultados del cálculo, con los símbolos de la Norma DGE «Símbolos gráficos en electricidad» (R.M. N.° 091-2002-EM/VME). En este expediente se presentan reducidas a A4; los planos se imprimen en ${lam} desde los archivos DXF. ${lamsDis.length ? `Los planos de planta (${lamsDis.map(h => esc(h.hoja)).join(", ")}) muestran la distribución de las salidas, tuberías y circuitos sobre la arquitectura, con su leyenda y su cuadro de circuitos; se imprimen en su papel y a su escala desde la ventana Lámina del editor de diseño.` : "Los planos de planta, con la distribución de las salidas sobre la arquitectura, los adjunta el proyectista (o se dibujan en el editor de diseño de la plataforma)."}</p>`;
  B += fin;
  LAMS.forEach(h => {
    const horiz = Math.min(259 / h.W, 156 / h.H) >= Math.min(172 / h.W, 238 / h.H),
      // Área útil de la página (A4 con sus márgenes, menos el título): la lámina tan grande como entre, centrada
      e = horiz ? Math.min(259 / h.W, 156 / h.H) : Math.min(172 / h.W, 238 / h.H),
      svg = h.svg.replace(
        /^<svg\b/,
        `<svg style="width:${(h.W * e).toFixed(1)}mm;height:${(h.H * e).toFixed(1)}mm;max-height:none"`
      );
    n2++;
    TOC.push([`${n1}.${n2}`, `Lámina ${esc(h.hoja)} · ${esc(h.tit)}${h.cont ? " (continuación)" : ""}`, 1]);
    B +=
      `<section class="ex-sec ex-plano ${horiz ? "ex-ancho" : "ex-alto"}">` +
      `<h2 class="ex-h2" id="${tid(`${n1}.${n2}`)}"><span>${n1}.${n2}</span>${esc(h.tit)}${h.cont ? " (continuación)" : ""} <small>Lámina ${esc(h.hoja)} · ${h.dis ? `Escala 1:${h.esc} en ${h.tam}` : `Escala S/E`} · reducida de ${h.dis ? h.tam : lam} a A4</small></h2>` +
      `<div class="ex-unif">${svg}</div>` +
      fin;
  });

  /* ---------- 6. PRUEBAS ---------- */
  B += cap("Pruebas técnicas y puesta en servicio");
  B += `<p>Al concluir la obra, y antes de la conexión definitiva, se ejecutan las siguientes pruebas y se registran en un protocolo firmado por el ingeniero responsable (EM.010, Art. 8):</p><ol class="ex-list">${[
    "Continuidad de los conductores activos y de los conductores de protección en todos los circuitos.",
    "Resistencia de aislamiento entre conductores y respecto a tierra, con megóhmetro, con los equipos desconectados.",
    `Resistencia del sistema de puesta a tierra: el valor medido no debe superar 25 Ω (Regla 060-712); valor de diseño ${fmt(r.pat.nVar > 1 ? r.pat.Rn : r.pat.Rt, 1)} Ω.`,
    "Funcionamiento de los interruptores diferenciales de 30 mA, con su botón de prueba y con instrumento.",
    "Polaridad y conexión a tierra en cada tomacorriente.",
    `Tensión en el tablero general y en la salida más alejada; caída de tensión total no mayor de ${DV_TOT} % (Regla 050-102).`,
    ...(SIST[r.sk].tri ? ["Medición de corrientes por fase con carga, para verificar el balance."] : []),
    "Identificación de circuitos en el directorio de cada tablero y señalización de los tableros."
  ]
    .map(t => `<li>${t}</li>`)
    .join("")}</ol>`;
  B += fin;

  /* ---------- 7. CONCLUSIONES Y FIRMA ---------- */
  B += cap("Conclusiones y conformidad", "ex-seguido");
  B += `<ul class="ex-list">${[
    `La máxima demanda es de <b>${fmt(md / 1000, 2)} kW</b> y se sugiere contratar <b>${fmt(r.contratada, 1)} kW</b> en ${s0.nom}.`,
    `El alimentador ${multi ? "general" : "principal"} es <b>${cond(s0.n, a0.S, a0.St)}</b> con interruptor general de <b>${s0.tri ? 3 : 2}×${a0.itm} A</b> y ${a0.pdc} kA.`,
    `La caída de tensión máxima total es de <b>${fmt(maxDV, 2)} %</b> (límite ${DV_TOT} %).`,
    `La resistencia de puesta a tierra estimada es de <b>${fmt(r.pat.nVar > 1 ? r.pat.Rn : r.pat.Rt, 1)} Ω</b> con ${r.pat.nVar} electrodo(s).`,
    ok
      ? "Todos los alimentadores y circuitos derivados cumplen la capacidad de corriente y la caída de tensión del código."
      : "<b>Existen alimentadores o circuitos que deben revisarse</b> (ver verificaciones normativas)."
  ]
    .map(t => `<li>${t}</li>`)
    .join("")}</ul>
    <p class="ex-nota">Cálculos conforme al CNE-Utilización, RNE EM.010 y Normas DGE vigentes, elaborados con JMG - ELECTRIC ${VERSION}. Los resultados constituyen una herramienta de apoyo al diseño; su validación, adecuación a las condiciones reales de obra y firma corresponden al ingeniero proyectista responsable.</p>
    <div class="ex-firmas">${[
      ["Elaborado por", P.proy || "", P.cip || ""],
      ["Revisado y aprobado por", "", ""]
    ]
      .map(
        ([t, n, cip]) =>
          `<div class="ex-firma"><div class="ex-firma-t">${t}</div><div class="ex-firma-l"></div><dl><dt>Nombre</dt><dd>${esc(n)}</dd><dt>CIP N.°</dt><dd>${esc(cip)}</dd><dt>Fecha</dt><dd></dd></dl></div>`
      )
      .join("")}</div>`;
  B += fin;

  /* ---------- 8. ANEXOS ---------- */
  B += cap("Anexos");
  // A. Cálculo de cada circuito derivado, por tablero (las mismas fórmulas del capítulo 2)
  B += sub("Anexo A · Desarrollo del cálculo de cada circuito derivado");
  B += `<p>Cálculo paso a paso de cada circuito derivado con las fórmulas de la memoria de cálculo: corriente nominal, corriente de diseño, interruptor, conductor por capacidad de corriente con sus factores de corrección y caída de tensión hasta la salida más alejada.</p>`;
  [...new Set(r.circ.map(q => q.tab))].forEach(t => {
    B +=
      `<h3 class="ex-h3">Tablero ${esc(t)}</h3>` +
      r.circ
        .filter(q => q.tab === t)
        .map(q => detalleCalc(q, false))
        .join("");
  });
  // B. Niveles de iluminación de los ambientes del diseño (EM.010, Anexo)
  const ambs =
    typeof PLANO !== "undefined" && PLANO && PLANO.dis && typeof ambTipo === "function"
      ? PLANO.dis.els.filter(e => e.ar && e.ar.amb && Array.isArray(e.pts) && ambTipo(e.ar.amb))
      : [];
  B += sub("Anexo B · Niveles de iluminación");
  if (ambs.length) {
    const f2 = (PLANO.f || 1) ** 2;
    B += tbl(
      ["Ambiente", "Tipo de ambiente", "Área (m²)", "Iluminancia (lx)", "Referencia", "Origen"],
      ambs.map(e => {
        const t = ambTipo(e.ar.amb);
        return [
          esc(e.ar.n || t.n),
          esc(t.n),
          fmt(plAreaPol(e.pts) * f2, 1),
          t.lux == null ? "—" : fmt(t.lux, 0),
          t.em ? `EM.010, Anexo ${esc(t.em)}` : "—",
          LUX_EST[t.est]
        ];
      }),
      "",
      "Iluminancia mantenida de diseño por ambiente",
      "Fuente: RNE EM.010, Anexo «Requisitos mínimos de iluminación»; los valores marcados «Criterio» los fija el proyectista."
    );
    B += `<p class="ex-nota">La iluminancia indicada es el valor mínimo que debe alcanzar el alumbrado de cada ambiente; la verificación con las luminarias elegidas se hace con su fotometría (cálculo de iluminación del fabricante).</p>`;
  } else
    B += `<p>Los niveles de iluminación por ambiente se toman del Anexo de la Norma EM.010 («Requisitos mínimos de iluminación»). Para listarlos aquí, marque los ambientes en el diseño sobre el plano (ventana Ambientes e iluminación).</p>`;
  // C. Protocolo de pruebas para llenar en obra
  B += sub("Anexo C · Protocolo de pruebas");
  B += `<p>Formato para registrar en obra las pruebas del capítulo 6. Se llena con los valores medidos y lo firman el ingeniero responsable y el propietario.</p>`;
  B += tbl(
    ["Tablero", "Circuito", "Descripción", "Aislamiento (MΩ)", "Continuidad PE", "Diferencial (ms)", "Conforme"],
    r.circ.map(q => [`<b>${esc(q.tab)}</b>`, q.id, esc(q.desc), "", "", "", ""]),
    "ex-prot",
    "Registro de pruebas por circuito"
  );
  B += kv(
    [
      ["Resistencia de puesta a tierra medida", "__________ Ω (máximo 25 Ω, Regla 060-712)"],
      ["Tensión en el tablero general", "__________ V"],
      ["Tensión en la salida más alejada", "__________ V"],
      ["Instrumentos (marca, modelo, calibración)", ""],
      ["Fecha de las pruebas", ""],
      ["Ingeniero responsable (nombre, CIP y firma)", ""],
      ["Propietario (nombre y firma)", ""]
    ],
    "Mediciones generales y conformidad"
  );
  // D. Documentos que completan el expediente (los adjunta el proyectista)
  B += sub("Anexo D · Documentos complementarios");
  B += `<p>Documentos que el proyectista adjunta al expediente para su presentación:</p>`;
  B += tbl(
    ["", "Documento", "Emite"],
    [
      ["☐", "Factibilidad de suministro y fijación del punto de diseño", "Empresa concesionaria"],
      ["☐", "Certificado de habilidad del ingeniero proyectista", "Colegio de Ingenieros del Perú"],
      ["☐", "Plano de ubicación y planos de arquitectura de referencia", "Proyectista de arquitectura"],
      ["☐", "Fichas técnicas de conductores, tableros, interruptores y luminarias", "Fabricantes"],
      ["☐", "Archivos DXF de las láminas", "Proyectista (JMG - ELECTRIC)"]
    ],
    "",
    "Documentos complementarios"
  );
  B += fin;

  /* ---------- PORTADA, CONTROL DEL DOCUMENTO E ÍNDICES ---------- */
  const mes = new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" }),
    hoy = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }),
    cip = P.cip ? `CIP N.° ${esc(P.cip)}` : "CIP N.° ______";
  const portada = `<section class="ex-portada">
    <div class="pt-cab"><span class="jmg-sello"><svg viewBox="140 265 1640 795" role="img" aria-label="JMG Projects &amp; Energy"><use href="#jmg-logo"/></svg></span><div><b>Expediente técnico</b><span>Instalaciones eléctricas interiores</span></div></div>
    <div class="pt-tit"><p class="pt-eye">Proyecto</p><h1>${esc(nom)}</h1><p class="pt-sub">${tipoEd} · suministro ${s0.nom[0].toLowerCase() + s0.nom.slice(1)}</p></div>
    <table class="pt-datos"><tbody>${[
      ["Propietario", esc(P.prop || "—")],
      ["Ubicación", esc(P.ubic || "—")],
      ["Proyectista", `${esc(P.proy || "—")} · ${cip}`],
      ["Máxima demanda", `${fmt(md / 1000, 2)} kW`],
      ["Potencia a contratar", `${fmt(r.contratada, 1)} kW`],
      ["Normas", "CNE-Utilización · RNE EM.010 · Normas DGE"]
    ]
      .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
      .join("")}</tbody></table>
    <div class="pt-pie"><div class="pt-firma"><div class="ln"></div><b>${esc(P.proy || "")}</b><span>Ingeniero proyectista · ${cip}</span><span>Firma y sello</span></div>
      <div class="pt-rev"><span>Revisión</span><b>0</b><span>${mes[0].toUpperCase() + mes.slice(1)}</span></div></div></section>`;
  // Control del documento: sus datos y las revisiones (tablas 0.1 y 0.2, al inicio del índice de tablas)
  TABLAS.unshift(["0.1", "Datos del documento", "ex-t0-1"], ["0.2", "Control de revisiones", "ex-t0-2"]);
  const control = `<section class="ex-sec"><h1 class="ex-h1">Control del documento</h1>
    <figure class="ex-fig ex-corta" id="ex-t0-1"><figcaption><b>Tabla 0.1.</b> Datos del documento</figcaption>${kv([
      ["Documento", "Expediente técnico de instalaciones eléctricas interiores"],
      ["Proyecto", esc(nom)],
      ["Tipo de edificación", tipoEd],
      ["Propietario", esc(P.prop || "—")],
      ["Ubicación", esc(P.ubic || "—")],
      ["Proyectista", `${esc(P.proy || "—")} · ${cip}`],
      ["Normativa", "CNE-Utilización · RNE EM.010 · Normas DGE"],
      ["Contenido", "Según la Norma EM.010 del RNE, artículo 8"],
      ["Fecha", fecha]
    ])}</figure>
    <figure class="ex-fig ex-corta" id="ex-t0-2"><figcaption><b>Tabla 0.2.</b> Control de revisiones</figcaption>${tbl(
      ["Rev.", "Fecha", "Descripción", "Elaboró", "Revisó"],
      [
        ["0", hoy, "Emisión para revisión", esc(P.proy || "—"), "—"],
        ["&nbsp;", "", "", "", ""],
        ["&nbsp;", "", "", "", ""]
      ],
      "ex-rev"
    )}</figure>
    <p class="ex-nota">Cada revisión reemplaza a la anterior. Las láminas llevan el mismo número de revisión que este documento.</p></section>`;
  // Índice general; debajo, en dos columnas, el índice de tablas y la lista de láminas
  const li = (href, n, t, l = "") => `<li class="${l}"><a href="#${href}"><span>${n}</span>${t}</a></li>`;
  const indice = `<section class="ex-sec ex-toc"><h1 class="ex-h1">Índice</h1><ol>${TOC.map(([n, t, l]) =>
    li(tid(n), n, t, `l${l}`)
  ).join("")}</ol>
    </section>
    <section class="ex-sec ex-toc"><h1 class="ex-h1">Índice de tablas</h1><ol class="chico">${TABLAS.map(([n, t, id]) =>
      li(id, `Tabla ${n}`, t)
    ).join("")}</ol></section>
    <section class="ex-sec ex-toc"><h1 class="ex-h1">Lista de láminas</h1><ol class="chico">${LAMS.map(h => {
      // Cada lámina enlaza a su página en el capítulo de planos
      const e = TOC.find(x => x[1].startsWith(`Lámina ${h.hoja} ·`));
      return li(e ? tid(e[0]) : "", h.hoja, h.tit + (h.cont ? " (continuación)" : ""));
    }).join(
      ""
    )}</ol>${lamsDis.length ? "" : '<p class="ex-nota">Los planos de planta (distribución de alumbrado, tomacorrientes y fuerza) los adjunta el proyectista.</p>'}</section>`;
  return `<div class="ex ex-${estilo === "formal" ? "formal" : "jmg"}">${portada}${control}${indice}${B}</div>`;

  // Desarrollo paso a paso del cálculo de un alimentador o circuito
  function detalleCalc(x, alim) {
    const s = x.s,
      fc = alim ? c.ft : c.fc,
      k = s.tri ? "√3" : "1",
      K = s.tri ? "√3" : "2",
      lim = alim ? DV_ALIM : DV_DER,
      acum = alim ? x.dvAc : x.dVt,
      limT = alim ? DV_ALIM : DV_TOT;
    // Factor total del conductor (el que usó el cálculo: Izc / Iz) y su parte de agrupamiento
    const fcx = x.Iz > 0 && x.Izc > 0 ? x.Izc / x.Iz : fc,
      fa = c.ft > 0 ? fcx / c.ft : 1;
    const tit = alim ? esc(x.desc) : `${x.tab} · ${x.id} · ${esc(x.desc)}`,
      Imin = x.Imin && x.Id === x.Imin;
    return `<div class="ex-calc"><h4>${tit} <span>${fmt(x.P, 0)} W · ${s.txt} · L = ${fmt(x.L, 1)} m</span></h4><dl>
      <dt>Corriente nominal</dt><dd>${mx(`${mi("I")} = ${fr(fmt(x.P, 0), `${k} × ${s.V} × ${fmt(c.fp, 2)}`)} = <b>${fmt(x.I, 2)} A</b>`)}</dd>
      <dt>Corriente de diseño</dt><dd>${mx(`${sb("I", "d")} = ${fmt(x.fd ?? FD, 2)} × ${fmt(x.I, 2)} = ${fmt((x.fd ?? FD) * x.I, 2)} A`)}${x.viv && c.resAl > 0 ? ` <span class="ex-dn">reserva del ${c.resAl} % para ampliaciones</span>` : ""}${Imin ? ` → se adopta la mínima del código: <b>${fmt(x.Imin, 0)} A</b>` : ""}</dd>
      <dt>Interruptor</dt><dd>${mx(`${sb("I", "n")} = <b>${x.itm ?? "—"} A</b> ≥ ${sb("I", "d")} = ${fmt(x.Id, 2)} A`)} · ${s.tri || x.f3 ? 3 : 2} polos${alim ? "" : " · curva " + x.curva}</dd>
      <dt>Factores de corrección</dt><dd>${mx(`${sb("F", "c")} = ${sb("F", "t")} × ${sb("F", "a")} = ${fmt(c.ft, 2)} × ${fmt(fa, 2)} = ${fmt(fcx, 2)}`)} <span class="ex-dn">${sb("F", "t")}: temperatura ${c.temp} °C, Tabla 5A · ${sb("F", "a")}: ${alim ? "un circuito en su tubería" : "circuitos agrupados en la tubería, Tabla 5C"}</span></dd>
      <dt>Conductor</dt><dd>${mi("S")} = <b>${x.S} mm²</b> · ${mx(`${sb("I", "z")} · ${sb("F", "c")} = ${fmt(x.Iz, 1)} × ${fmt(fcx, 2)} = ${fmt(x.Izc, 1)} A ≥ ${sb("I", "n")} = ${x.itm ?? "—"} A`)} <span class="ex-dn">${sb("I", "z")}: Tabla 2, método ${c.met}, ${c.aisl === "pvc" ? "PVC 70 °C" : "XLPE 90 °C"}</span></dd>
      <dt>Caída de tensión</dt><dd>${mx(`Δ${mi("V")} = ${fr(`${K} × ${c.rho} × ${fmt(x.L, 1)} × ${fmt(x.I, 2)}`, x.S)} = ${fmt(x.dV, 2)} V`)} → <b>${fmt(x.dVp, 2)} %</b> ≤ ${lim} % · acumulada <b>${fmt(acum, 2)} %</b> ≤ ${limT} %</dd>
      <dt>Protección y tubo</dt><dd>Conductor de protección ${x.St} mm² (Tabla 16) · tubería ${tub(x.tubo)}</dd>
      <dt>Resultado</dt><dd>${pill(x.ok, "Cumple", "Revisar")}</dd></dl></div>`;
  }
}
