/* HERRAMIENTAS RÁPIDAS
   Calculadoras independientes: caída de tensión, conductor e interruptor, motor, puesta a tierra con
   varias varillas y conversión de potencia. */
function herr() {
  const g = id => parseFloat($(id).value),
    out = (id, rows) => {
      $(id).innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    };
  const sist = id => SIST[$(id).value] || SIST.mono220,
    ok = (b, y, n) => pill(b, y, n);
  // 1. Caída de tensión
  {
    const s = sist("h1_sis"),
      I = g("h1_I") || 0,
      L = g("h1_L") || 0,
      S = g("h1_S"),
      rho = g("h1_rho");
    const dV = (s.K * rho * L * I) / S,
      p = (dV / s.V) * 100,
      smin = SECC.find(x => ((s.K * rho * L * I) / x / s.V) * 100 <= 2.5);
    out("h1_out", [
      ["Caída de tensión", `${fmt(dV, 2)} V`],
      ["Caída porcentual", `${fmt(p, 2)} % ${ok(p <= 2.5, "≤ 2.5 %", "> 2.5 %")}`],
      ["Sección mínima para ΔV ≤ 2.5 %", smin ? `${smin} mm²` : "Mayor de 120 mm²"],
      ["Fórmula", `ΔV = ${s.tri ? "√3" : "2"} · ρ · L · I / S`]
    ]);
  }
  // 2. Conductor e ITM
  {
    const I = g("h2_I") || 0,
      nc = +$("h2_nc").value,
      ais = $("h2_ais").value,
      tab = T2[$("h2_met").value][ais + (nc === 3 ? "3" : "2")],
      ft = FT[ais][+$("h2_t").value] ?? 1,
      fa = FA[+$("h2_ag").value] ?? 1;
    const Id = I * FD,
      it = ITM.find(x => x >= Id - 1e-9),
      k = SECC.findIndex((S, i) => it && tab[i] * ft * fa >= it);
    out("h2_out", [
      ["Corriente de diseño (1.25 × I)", `${fmt(Id, 2)} A`],
      ["Interruptor termomagnético", it ? `${nc}×${it} A` : "—"],
      ["Sección mínima de cobre", k >= 0 ? `${SECC[k]} mm²` : "Mayor de 120 mm²"],
      ["Ampacidad corregida", k >= 0 ? `${fmt(tab[k] * ft * fa, 1)} A (factor ${fmt(ft * fa, 2)})` : "—"],
      ["Conductor de protección (Tabla 16)", it ? `${tierraPara(it)} mm²` : "—"]
    ]);
  }
  // 3. Motor
  {
    const c = ctx(),
      s = sist("h3_sis"),
      P = (g("h3_P") || 0) * ($("h3_u").value === "hp" ? 0.746 : 1),
      eta = g("h3_eta") || 0.85,
      fp = g("h3_fp") || 0.85,
      L = g("h3_L") || 0;
    const In = (P * 1000) / eta / (s.kI * s.V * fp),
      it = ITM.find(x => x >= 1.25 * In - 1e-9),
      nc = s.tri ? 3 : 2,
      tab = T2[c.met][c.aisl + (nc === 3 ? "3" : "2")];
    const k = SECC.findIndex(
      (S, i) => S >= c.sminD && it && tab[i] * c.fc >= it && ((s.K * c.rho * L * In) / S / s.V) * 100 <= 2.5
    );
    out("h3_out", [
      ["Potencia de entrada", `${fmt(P / eta, 2)} kW`],
      ["Corriente nominal", `${fmt(In, 2)} A`],
      ["Capacidad mínima del conductor (125 %, Regla 160-106)", `${fmt(1.25 * In, 2)} A`],
      ["Interruptor termomagnético", it ? `${nc}×${it} A · curva D` : "—"],
      [
        "Conductor de cobre",
        k >= 0
          ? `${nc}-1×${SECC[k]} mm²${c.desig ? " " + c.desig : ""} + ${tierraPara(it)} mm² (T)`
          : "Mayor de 120 mm²"
      ],
      ["Caída de tensión", k >= 0 ? `${fmt(((s.K * c.rho * L * In) / SECC[k] / s.V) * 100, 2)} %` : "—"]
    ]);
  }
  // 4. Puesta a tierra
  {
    const rho = g("h4_rho") || 0,
      L = g("h4_L") || 0.5,
      d = g("h4_d"),
      n = Math.max(1, Math.round(g("h4_n") || 1)),
      fr = g("h4_fr") || 1;
    const R1 = (rho / (2 * Math.PI * L)) * (Math.log((8 * L) / d) - 1),
      F = fAgr(n);
    const Rn = ((R1 * F) / n) * fr;
    out("h4_out", [
      ["Resistencia de una varilla", `${fmt(R1, 2)} Ω`],
      ["Factor de agrupamiento", `${fmt(F, 2)}`],
      ["Resistencia del conjunto", `${fmt(Rn, 2)} Ω ${ok(Rn <= 25, "≤ 25 Ω", "> 25 Ω")}`],
      ["Separación mínima entre varillas", `${fmt(Math.max(2, L), 1)} m`]
    ]);
  }
  // 5. Conversión
  {
    const v = g("h5_v") || 0,
      u = $("h5_u").value,
      fp = g("h5_fp") || 1,
      s = sist("h5_sis");
    const kW = u === "kw" ? v : u === "w" ? v / 1000 : u === "hp" ? v * 0.746 : v * fp,
      kVA = kW / fp,
      I = (kW * 1000) / (s.kI * s.V * fp);
    out("h5_out", [
      ["Potencia activa", `${fmt(kW, 3)} kW · ${fmt(kW * 1000, 0)} W`],
      ["Potencia en HP", `${fmt(kW / 0.746, 2)} HP`],
      ["Potencia aparente", `${fmt(kVA, 3)} kVA`],
      [`Corriente (${s.txt})`, `${fmt(I, 2)} A`]
    ]);
  }
}
document.querySelectorAll(".h-sis").forEach(el => {
  el.innerHTML = SYS_OPC.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
});
document.querySelectorAll(".h-secc").forEach(el => {
  el.innerHTML = SECC.map(S => `<option value="${S}"${S === 6 ? " selected" : ""}>${S} mm²</option>`).join("");
});
$("tools").addEventListener("input", herr);
$("tools").addEventListener("change", herr);
