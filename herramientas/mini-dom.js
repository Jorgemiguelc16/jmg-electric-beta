/* DOMParser mínimo para las pruebas sin navegador: lee el SVG que generan los planos (bien formado, sin CDATA ni
   comentarios) con lo justo que usa svgDxf() de js/planos/exportar-planos.js: documentElement, tagName, getAttribute,
   textContent, querySelectorAll("*") y closest("[atributo]"). */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodificar = t =>
  t.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1))
      : (ENT[e] ?? m)
  );

class Elemento {
  constructor(tagName, attrs, parent) {
    this.tagName = tagName;
    this.attrs = attrs;
    this.parentNode = parent;
    this.hijos = [];
  }
  getAttribute(k) {
    return k in this.attrs ? this.attrs[k] : null;
  }
  get textContent() {
    return this.hijos.map(h => (typeof h === "string" ? h : h.textContent)).join("");
  }
  // Todos los descendientes en el orden del documento
  querySelectorAll(sel) {
    if (sel !== "*") throw new Error("mini-dom: solo querySelectorAll('*')");
    const out = [];
    const rec = e => e.hijos.forEach(h => typeof h !== "string" && (out.push(h), rec(h)));
    rec(this);
    return out;
  }
  // Solo selectores de atributo: «[nombre]»
  closest(sel) {
    const m = sel.match(/^\[([\w-]+)\]$/);
    if (!m) throw new Error("mini-dom: closest solo admite [atributo]");
    for (let e = this; e; e = e.parentNode) if (m[1] in e.attrs) return e;
    return null;
  }
}

class DOMParser {
  parseFromString(txt) {
    const raiz = new Elemento("#documento", {}, null);
    let act = raiz;
    const re = /<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
    for (let m; (m = re.exec(txt)); ) {
      if (m[1]) act = act.parentNode;
      else if (m[2]) {
        const attrs = {};
        for (const a of m[3].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = decodificar(a[2]);
        const e = new Elemento(m[2], attrs, act);
        act.hijos.push(e);
        if (!m[4]) act = e;
      } else if (m[5] && act !== raiz) act.hijos.push(decodificar(m[5]));
    }
    return { documentElement: raiz.hijos[0] };
  }
}

module.exports = { DOMParser };
