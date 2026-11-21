# JMG - ELECTRIC · notas para Claude

Plataforma web de diseño y cálculo de instalaciones eléctricas interiores (CNE-Utilización, EM.010, símbolos DGE).
Página estática (HTML/CSS/JS sin framework ni compilación) en GitHub Pages; cuentas y nube con Firebase (compat 10.12).
El detalle de la arquitectura está en **`GUIA-DEL-CODIGO.md`** → leer la sección que haga falta, no todo el código.

## Reglas que no se rompen

- **La norma no se toca.** Valores del CNE/EM.010/DGE solo se cambian contra el documento. Lo que no es norma se
  rotula «criterio» y es editable. Ningún cambio de diseño/interfaz debe mover el cálculo (`js/calculo/`, `base/tablas-cne.js`).
- **Nada se publica sin aprobación explícita de Jorge** para esa publicación (ni merge a `main`, ni push al beta).
- Una pregunta se responde; no se edita ni se hace commit sin que lo pida.
- `pruebas/` es solo de desarrollo: nunca se enlaza desde la app.
- Solo escritorio (densidad compacta); el móvil no es prioridad.
- Responder en español.

## Código: dónde está cada cosa

| Carpeta `js/` | Contenido |
| --- | --- |
| `base/` | datos y ayudas (`HLP` en `datos.js`), tablas del CNE, textos y `NOVEDADES` (`textos.js`) |
| `calculo/` | motor: demanda, conductores, vivienda, edificio (`calculo-edificio.js`), cálculo desde el plano (`calculo-plano.js`) |
| `editor/` | editor del plano: dibujo (`diseno-*`), plantas/áreas/montantes (`plantas-areas.js`), DXF, menús, propiedades (`diseno-propiedades.js`, `datos-calculo.js`) |
| `planos/` | láminas SVG: unifilar, tableros, medidores, rótulo; piezas comunes en `dibujo.js` |
| `exportar/` | Excel (ExcelJS), expediente, descargas |
| `ventanas/` | ventanas modales (`ventana.js` es la base) |
| `interfaz/`, `resultados/`, `proyectos/`, `cuenta/` | UI general, resultados/metrado/presupuesto, guardar/respaldo, Firebase (acceso, admin, nube) |

Todo se carga con `<script>` en `index.html` (orden importa; `npm run revisar` lo controla). Estilos en `css/` (10 archivos, tokens en `temas.css`/`paletas.css`).

### Vocabulario del editor (nombres en el código)

- Elementos del plano: `dsD().els`, cada uno con `k` (tipo de símbolo, catálogo `DS_CAT`, texto del código con `dsCodTxt`).
- Tablero `k:"tab"` (`dep` = índice del tipo de departamento en `tipos[]`); tubería con `cir` (circuito), `cx` (circuitos juntados), `ali` (alimentador).
- `PL_PASO`: cajas/canalizaciones de paso; `DP_MON`: elementos de montante (`subida`, `bajada`, `atrav`, cajas) enlazados con `mon`/`mon2`.
- Plantas: marcos por piso con punto base (`bx`,`by`); áreas con `dep` y `tp` (`PL_TAREA`: tech, ext, sot, libre, aulas, no).
- Orden de presentación de tableros por nombre (`porNombre`); el orden de demanda 050-202(3)(a) es por carga y no se cambia.

## Pruebas (antes de cada publicación)

`npm run verificar` = ESLint + orden de carga + Prettier + cálculo (34 casos) + cálculo desde plano + planos (huellas) + DXF + Excel + interfaz (Chrome).
- Cambio intencional de planos/Excel: revisar y `npm run pruebas-planos -- --actualizar` / `npm run pruebas-excel -- --actualizar`.
- Prueba de UI nueva para cada función nueva (`herramientas/pruebas-ui.mjs`); del cálculo desde plano en `herramientas/pruebas-calc-plano.js`.

## Publicar

- **Sitio de pruebas** (rama `diseno` → remoto `beta`, carpeta `/jmg-electric-beta/`): subir `?v=3.3.0-bN` en `index.html`
  (todas las apariciones), commit, `git checkout diseno && git merge --ff-only orden`, volver a `orden`, `git push beta diseno:main`.
- **Oficial** (`origin/main`, tags `vX.Y.Z`): solo con aprobación; antes actualizar manual (`manual/`), PDF, `NOVEDADES`
  y ayudas de cada criterio nuevo; versión en `?v=` y `package.json`.
- Trabajo diario en la rama `orden`.

## Seguridad (pendiente)

La `apiKey` de Firebase en `js/cuenta/acceso.js` es pública por diseño. Lo que falta: reglas de Firestore en el repo
(`usuarios`, `config`, `proyectos`, `proyectos-beta`) con pruebas, y restringir la clave por dominio.
