/* Servidor local para trabajar y revisar la plataforma antes de publicarla («npm run local»), solo para desarrollo.
   Sirve esta carpeta en http://localhost:8080/jmg-electric-beta/ (con esa ruta la plataforma se comporta como el sitio
   de pruebas: nube proyectos-beta). Siempre el mismo puerto y la misma dirección: el navegador guarda los proyectos por
   dirección, y otra (127.0.0.1, otro puerto, el sitio beta) tiene su propio almacén, separado. Para detenerlo: Ctrl+C. */
const http = require("http"),
  fs = require("fs"),
  path = require("path");
const RAIZ = path.join(__dirname, ".."),
  PRE = "/jmg-electric-beta/",
  PUERTO = 8080;
const T = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".dxf": "application/dxf"
};
http
  .createServer((q, s) => {
    const u = decodeURIComponent(q.url.split("?")[0]);
    if (u === "/" || u === "/jmg-electric-beta") {
      s.writeHead(302, { Location: PRE });
      return s.end();
    }
    if (!u.startsWith(PRE)) {
      s.writeHead(404);
      return s.end("No encontrado");
    }
    let f = path.join(RAIZ, u.slice(PRE.length) || "index.html");
    if (!f.startsWith(path.normalize(RAIZ))) {
      s.writeHead(403);
      return s.end();
    }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    fs.readFile(f, (e, d) => {
      if (e) {
        s.writeHead(404);
        return s.end("No encontrado");
      }
      s.writeHead(200, {
        "Content-Type": T[path.extname(f).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      s.end(d);
    });
  })
  .listen(PUERTO, "127.0.0.1", () =>
    console.log(
      `Plataforma en http://localhost:${PUERTO}/jmg-electric-beta/ (abra siempre esta misma dirección; Ctrl+C para detener)`
    )
  )
  .on("error", e =>
    console.log(
      e.code === "EADDRINUSE"
        ? `El puerto ${PUERTO} ya está en uso: el servidor ya está abierto. Abra http://localhost:${PUERTO}/jmg-electric-beta/`
        : "Error: " + e.message
    )
  );
