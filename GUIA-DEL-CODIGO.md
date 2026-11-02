# Guía del código de JMG - ELECTRIC

Guía para entender, mantener y hacer crecer la plataforma. Explica cómo está organizada, cómo viaja un dato
desde que se escribe hasta que aparece en el expediente y qué revisar antes de publicar.

## 1. Qué es técnicamente

Es una **página web estática**: HTML, CSS y JavaScript que se ejecutan en el navegador del usuario. No hay
servidor propio ni instalación. Se publica en GitHub Pages; el acceso con cuenta usa Firebase (Google).

| Pieza | Archivo o carpeta |
| --- | --- |
| Estructura de todas las pantallas | `index.html` |
| Apariencia (colores, tamaños, diseño) | `css/` (10 archivos) |
| Lógica, cálculo y planos | `js/` (56 archivos) |
| Imágenes de la plataforma | `img/`, `logo.png`, `foto.png`, `og.png` |
| Manual de usuario y referencia técnica | `manual/manual.html` → `manual/JMG-ELECTRIC-Manual-v2.1.pdf` |
| Pruebas automáticas: casos, referencia del cálculo y huellas de los planos | `pruebas/` |
| Herramientas de desarrollo | `herramientas/`, `package.json` |

## 2. Los archivos de `js/` y en qué orden se cargan

Los scripts **comparten variables**: lo que define un archivo lo usan los que se cargan después. El orden
está al final de `index.html` y es este:

| # | Archivo | Qué hace |
| --- | --- | --- |
| 1 | `logo.js` | Logo en imagen para Excel, unifilar y expediente |
| 2 | `tablas-cne.js` | **Tablas del CNE** y constantes del cálculo (solo datos) |
| 3 | `textos.js` | Textos: normas, glosario, preguntas, novedades |
| 4 | `datos.js` | Valores por defecto, listas editables y ayudas de cada dato |
| 5 | `calculo.js` | **Motor de cálculo**: parámetros (`ctx()`) y entrada `calcular(proyecto)` |
| 5a | `calculo-conductores.js` | Interruptor, sección, tubo, conductor de protección, alimentadores y circuitos |
| 5b | `calculo-demanda.js` | Máxima demanda (Reglas 050-200 a 050-210) y salidas |
| 5c | `calculo-tierra-fases.js` | Puesta a tierra, cortocircuito y balance de fases |
| 5d | `calculo-vivienda.js` | `calcUni()`: vivienda y otros usos |
| 5e | `calculo-edificio.js` | `calcMulti()`: edificio multifamiliar |
| 5f | `verificaciones.js` | Alertas y recomendaciones del resultado |
| 6 | `resultados.js` | Estado global y tarjetas de resultados |
| 7 | `metrado.js` | Metrado de materiales, capacidad de cada tablero en polos y medida de su gabinete |
| 8 | `dibujo.js` | **Piezas comunes de los planos**: paleta, colores de los conductores, notas, puerta metálica |
| 9 | `unifilar.js` | Diagrama unifilar (IE-01) y su división en láminas |
| 9a | `rotulo.js` | Rótulo de todas las láminas (`rotuloSvg()`) |
| 9b | `exportar-planos.js` | Tamaños de lámina y conversión de cualquier plano a DXF (`svgDxf()`) y PNG (`svgPng()`) |
| 10 | `simbolos.js` | Símbolos de la Norma DGE y primitivas de dibujo (`trazos()`: L, T, R, C, TRI) |
| 11 | `alturas.js` | Diagrama de alturas (IE-02) |
| 12 | `detalles.js` | Leyenda y detalle del pozo de tierra (IE-03) |
| 13 | `tableros.js` | Detalle de tableros (IE-04): puerta metálica o de PVC, interior, peinado |
| 14 | `medidores.js` | Banco de medidores y balance de fases (IE-06, edificios) |
| 15 | `tablerogeneral.js` | Tablero general del edificio (IE-05, edificios) |
| 16 | `expediente.js` | Expediente técnico en PDF |
| 17 | `interfaz.js` | **Ciclo principal** `update()` y navegación |
| 18 | `excel.js` | Memoria de cálculo en Excel: `exportar()` arma el libro, los estilos y las ayudas, y llama a cada hoja |
| 18a | `excel-anexos.js` | Hoja Anexos: tablas del CNE que consultan las fórmulas |
| 18b | `excel-memoria.js` | Hoja Memoria: datos, parámetros (celdas de las fórmulas) y máxima demanda |
| 18c | `excel-calculos.js` | Hoja Cálculos: alimentadores, cuadro de cargas, balance y cortocircuito |
| 18d | `excel-resumen.js` | Hoja Memoria (continuación): resumen, suministro, tierra, verificaciones y firmas |
| 18e | `excel-planos.js` | Hojas de los planos, como imagen |
| 18f | `excel-metrado.js` | Hoja Metrado |
| 19 | `descargas.js` | Guardar archivos, lista de planos (`PLANOS`) y diálogos de exportación |
| 20 | `sitio.js` | Páginas de la web (glosario, novedades, soporte) |
| 21 | `proyectos.js` | Guardar, abrir y ejemplos de proyectos |
| 22 | `herramientas.js` | Calculadoras rápidas |
| 23 | `archivo.js` | Abrir y guardar `.json` |
| 24 | `app.js` | Espacio de trabajo: árbol, propiedades, cinta |
| 25 | `ventana.js` | Comportamiento común de las ventanas (mover, redimensionar, recordar tamaño) |
| 26 | `conductores.js` | Ventana Cuadro de conductores |
| 27 | `ficha.js` | Ventana Ficha del circuito (con vista previa) |
| 28 | `ficha-tablero.js` | Ventana Ficha del tablero (alimentador, circuitos, equipos y gabinete) |
| 29 | `tabla-cargas.js` | Ventana Editor de cargas especiales (con vista previa) |
| 30 | `parametros.js` | Ventana Parámetros de diseño (se arma con el formulario de parámetros) |
| 31 | `departamentos.js` | Ventana Editor de departamentos |
| 32 | `datos-proyecto.js` | Ventana Datos del proyecto (se arma con los formularios del panel) |
| 33 | `panel.js` | Panel del proyecto (resumen, elemento elegido, por revisar) |
| 34 | `menus-cinta.js` | Menús ▾ de la cinta (sistema eléctrico y agregar cargas) |
| 34a | `dxf.js` | **Lector DXF**: lee un plano de AutoCAD y lo convierte en trazos, textos, capas y puntos de enganche (sin pantalla) |
| 34b | `plano.js` | **Editor de diseño** a pantalla completa: plano de arquitectura con zoom, escala, plantas, selección y medición; objetos de la arquitectura borrados de la vista (`EPL.borr`, número de objeto del DXF; el archivo no cambia); Ctrl+X / Supr (`edBorrar`); paneles con ancho ajustable; menú del clic derecho (`edMenuAbrir`; con una herramienta, termina); mano y barra de navegación (zoom ventana, vista anterior `PL_VHIST`); comandos por teclado (`ED_CMD`); autoguardado (`edAutoguardar`, `edRecuperar`); con el plano atenuado la arquitectura no se elige; mouse y teclado; Aplicar / Aceptar / Cancelar |
| 34c | `diseno.js` | **Diseño eléctrico** en el editor: símbolos de la Norma DGE (catálogo `DS_CAT` con su código) que se encajan en el muro, tuberías con tramos rectos o curvos (longitud del arco), cotas, directrices, líneas y textos; pinzamientos (giro libre y letra del tipo movible, `el.dt`), color propio (`el.col`) o por tipo de símbolo (`DS_COLT`, `dsColorEl`), paso de giro (`DSU.giro`), **conexiones** de las tuberías a los artefactos (`c0`/`c1`, imán `dsEngancheCon`, borde `dsBorde`, `dsReconectar`, aviso `dsSueltos`; el tablero se conecta por su salida, eligiéndola en un menú con `dsElegirSalida`), color por circuito (`dsColCir`), marcas de conductores (`el.cond`, `dsMarcas`), letra de encendido (`el.enc`), rastreo polar (`DSU.polar`), copiar en fila y espejo (`dsIniciarCopia`, `dsClonar`, `dsReflejar`), leyenda automática (`t: "ley"`, `dsDibLeyenda`), ventana de propiedades con doble clic (`elAbrir`), revisión del diseño con criterios editables (`dsVerificar`, `D.crit`), mover, girar, copiar, borrar, rejilla, propiedades la **Biblioteca de símbolos** con buscador (`bibAbrir`, tecla B), el **editor de símbolos** con criterio del proyectista (`D.simb`: relleno, tamaño, letra y grosor; `siAbrir`, `dsTam`, `dsRellenoCuerpo`) y el fondo del plano regulable (`dsFondo`) |
| 34d | `laminas.js` | **Láminas y DXF del diseño**: un lienzo que graba lo que dibuja el editor (`laGrabador`); con eso, la lámina en PDF (`laSvg`: varias láminas `D.lams`, cada una con papel A4 a A1, su escala, su zona —planta, pantalla o rectángulo marcado— y sus capas, leyenda, escala gráfica, notas y rótulo) y el DXF del diseño en coordenadas reales (`laDxf`, R12, con o sin la arquitectura) |
| 34d2 | `diseno-avanzado.js` | **Diseño avanzado**: plantas (`dpPlantaEl`, copiar a otra planta) y montantes (`el.mon`), bloques propios en el navegador (Biblioteca › Mis bloques), plantillas (de partida y propias), ruta automática de tuberías (`dpRuta`) y versiones del diseño (`EPL.vers`, comparar y restaurar) |
| 34e | `capas.js` | Ventana **Administrador de capas** del editor |
| 35 | `centro.js` | Centro de ingeniería (Inicio) |
| 36 | `inicio.js` | Arranque y bienvenida |
| 37 | `tema.js` | Tema, zoom y mano de arrastre |
| 38 | `acceso.js` | Ingreso con cuenta y Administración |

Cada archivo empieza con un comentario que explica lo mismo con más detalle.

### Cómo están hechos los planos

Cada plano es una función que recibe el resultado del cálculo `r` y devuelve `{ svg, W, H }`, por ejemplo
`tableroGeneral(r)`. Dibuja con las primitivas de `trazos(o)` (`simbolos.js`) sobre una lista de textos SVG y
termina con su recuadro de notas (`notasSvg()`, `dibujo.js`) y su rótulo (`rotuloSvg()`, `rotulo.js`). Todos los planos están en la lista
`PLANOS` de `descargas.js`, que usan la pantalla, el DXF, el Excel y el expediente.

**Para un plano nuevo o un cambio de colores:** usar la paleta `PAL`, los colores `COND` y las piezas de
`dibujo.js`, y no copiarlas. Si una pieza nueva se repite en dos planos, va a `dibujo.js`.

### Cómo funciona el editor de diseño (plano de arquitectura)

1. El usuario abre un DXF. `modeloDxf()` (`dxf.js`) lo lee **una vez**: expande los bloques (con giro, escala y
   espejo), convierte arcos y curvas en tramos cortos, resuelve colores y capas, y arma la lista de puntos de enganche.
   La unidad del dibujo sale de las cotas, porque la cabecera del archivo a veces está mal.
2. La pestaña Diseño de la cinta abre el **editor a pantalla completa** (`edAbrir()`), que trabaja sobre una copia del
   plano del proyecto (`EPL`) con su propio deshacer; `edAplicar()` la pasa al proyecto (`PLANO`) y Cancelar la descarta.
   La arquitectura es una referencia bloqueada: se selecciona para ver sus propiedades, pero no se mueve. Lo que se
   dibuja encima va en `EPL.dis` (`diseno.js`): capas propias y elementos (símbolos con el mismo dibujo de
   `simboloDGE()`, líneas, textos y tuberías) en coordenadas del dibujo; `disValido()` (`proyectos.js`) lo valida.
3. `plano.js` agrupa los trazos por color y tipo de línea (`plPreparar()`) y los dibuja en un lienzo (`canvas`); encima
   hay otro lienzo para lo que sigue al cursor (enganche, mediciones, encuadres). Así el plano se mueve con fluidez
   aunque tenga decenas de miles de objetos.
4. El archivo se guarda en la base de datos del navegador (IndexedDB) con su huella SHA-1; el proyecto guarda solo
   `PLANO`: nombre y huella del archivo, unidad, capas ocultas, plantas y modo atenuado (`planoValido()` en
   `proyectos.js` lo valida al abrir). El plano no entra al cálculo todavía: eso llega con el diseño en planta.

## 3. Los estilos de `css/`

La apariencia está en 10 archivos que `index.html` carga **en este orden**. El orden importa: si dos reglas dicen
cosas distintas sobre lo mismo, gana la de más abajo, aunque esté en otro archivo. Los colores y tamaños se
definen una sola vez como variables (`--bg`, `--panel`, `--acc`…) en `sitio.css` y en `temas.css` /
`paletas.css`, y las demás reglas las usan.

| # | Archivo | Qué contiene |
| --- | --- | --- |
| 1 | `sitio.css` | Variables, cabecera, Inicio, formularios, resultados, normas, ajustes, impresión y bienvenida |
| 2 | `aplicacion.css` | Espacio de trabajo: barra de título, cinta, explorador, documento, propiedades, barra de estado, asistente, ayudas |
| 3 | `expediente.css` | Expediente técnico (PDF) y manual en PDF: notación, tablas técnicas y ecuaciones |
| 4 | `temas.css` | Temas claro, oscuro y automático (solo en pantalla) |
| 5 | `paletas.css` | Paletas de identidad, selector de paleta, cinta compacta, Ajustes, Novedades, recomendaciones, logo y zoom |
| 6 | `barra-centro.css` | Barra superior, menú lateral y Centro de ingeniería |
| 7 | `acceso.css` | Pantalla de ingreso, menú de la cuenta y Administración |
| 8 | `ventanas.css` | Menús de la cinta, cuadro de conductores, ficha del circuito y editor de cargas especiales |
| 9 | `fichas.css` | Parámetros de diseño, ficha del tablero, datos del proyecto, departamentos y paneles laterales |
| 10 | `plano.css` | Editor de diseño: barra de título, paneles, lienzo del plano, línea de indicaciones y barra de estado |

Las rutas de imágenes dentro de `css/` empiezan con `../img/`. **Para un estilo nuevo**, va en el archivo de
su tema; si cambia algo de otro archivo, comprobar con `npm run capturas` que solo cambió lo buscado.

## 4. Cómo viaja un dato (el camino del cálculo)

1. El usuario escribe un dato, por ejemplo el área techada (`<input id="area">` en `index.html`).
2. Al cambiarlo se llama a **`update()`** (`interfaz.js`).
3. `update()` revisa con `faltantes()` si faltan datos. Si faltan, muestra la lista en ámbar y se detiene.
4. Si están completos, **`ctx()`** (`calculo.js`) reúne los parámetros: método de instalación, temperatura,
   factor de potencia, reserva, etc.
5. **`calcUni(c)`** (vivienda u otros usos) o **`calcMulti(c)`** (edificio) calculan:
   - la máxima demanda con `mdVivienda()` o `mdUso()`;
   - los alimentadores con `alimentador()` y los circuitos con `grupos()` / `circuito()`;
   - el interruptor y la sección con **`dimensionar()`**, por capacidad y por caída de tensión;
   - el balance de fases con `balancear()` y la puesta a tierra con `pozo()`.
6. El resultado `r` se guarda en `LAST` y lo dibuja **`render(r)`** con las tarjetas de `resultados.js`,
   `unifilar.js` y `metrado.js`.
7. Las exportaciones (`excel.js`, `expediente.js`, `exportar-planos.js`) leen ese mismo `r`. Por eso la pantalla,
   el Excel y el PDF siempre coinciden.

## 5. Por dónde empezar a estudiar

1. **`tablas-cne.js`**: compara cada tabla con el CNE. Es corto y te conecta el código con la norma.
2. **El motor**: `dimensionar()` (`calculo-conductores.js`), `mdVivienda()` (`calculo-demanda.js`) y `calcUni()` (`calculo-vivienda.js`). Sigue a mano el ejemplo **C1** del
   manual (vivienda de 120 m²) con el código al lado.
3. **`interfaz.js`**: la función `update()`, para ver cómo se conecta todo.
4. Después, lo que necesites tocar: `resultados.js` (pantalla), `excel.js` (memoria), `acceso.js` (cuentas).

## 6. Herramientas de desarrollo

Están instaladas con Node.js. Si se cambia de computadora, se reinstalan con `npm install`.

| Comando | Qué hace |
| --- | --- |
| `npm run formato` | Ordena el formato del código (Prettier). No cambia lo que hace el código. |
| `npm run revisar` | Busca errores y código sin usar (ESLint), analizando todos los archivos juntos. |
| `npm test` | **Pruebas del cálculo**: 34 casos contra `pruebas/referencia.js` (cálculo, metrado, alertas). |
| `npm run pruebas-planos` | **Pruebas de los planos**: la huella de cada plano (SVG y DXF) de los 34 casos contra `pruebas/huellas.js`. |
| `npm run pruebas-excel` | **Pruebas del Excel**: la huella de cada hoja de la memoria (celdas, fórmulas, formato) de los 34 casos contra `pruebas/huellas-excel.js`, en Chrome. |
| `npm run pruebas-ui` | **Pruebas de la interfaz**: 17 escenarios en Chrome (fichas, editores, vista previa, deshacer, plano de arquitectura). |
| `npm run pruebas-dxf` | **Pruebas del lector DXF**: el plano de prueba `pruebas/plano-prueba.dxf` (medidas conocidas y casos difíciles; lo genera `herramientas/plano-prueba.js`) y los DXF que exporta la propia plataforma. |
| `npm run estilos-sin-uso` | Lista estilos de `css/` que ya no usa ninguna pantalla. |
| `npm run estilos-tapados` | Lista declaraciones de `css/` que nunca se aplican porque otra más abajo las tapa. |
| `npm run capturas -- antes` y `npm run capturas -- despues antes` | **Capturas de las pantallas** (ingreso, inicio, vistas, cinta, ventanas; claro y oscuro) y su comparación píxel por píxel, para cambios de estilos. |

Las pruebas del cálculo y de los planos corren en Node sin navegador: `herramientas/contexto.js` carga los
archivos de `js/` en un contexto aislado y `herramientas/mini-dom.js` lee el SVG para el DXF. La página
`pruebas/index.html` (`pruebas/ejecutar-pruebas.bat`) repite las del cálculo en el navegador. Son solo para
desarrollo: nunca se enlazan desde la plataforma.

**Cuando un plano cambia a propósito**, `npm run pruebas-planos` lo marca y guarda el plano nuevo en la carpeta
temporal (`jmg-planos`). Se revisa y, si es el cambio buscado, se actualizan las huellas con
`npm run pruebas-planos -- --actualizar`. Al **ordenar código sin cambiar lo que hace**, las huellas no deben
cambiar: si cambian, algo se rompió.

## 7. Antes de publicar (lista de control)

1. `npm run revisar` sin errores y `npm run revisar-formato` en verde.
2. `npm test`, `npm run pruebas-planos`, `npm run pruebas-excel`, `npm run pruebas-dxf` y `npm run pruebas-ui` en verde. Si el cálculo, un
   plano o el Excel cambió a propósito, revisar cada diferencia y regenerar `pruebas/referencia.js`,
   `pruebas/huellas.js` o `pruebas/huellas-excel.js` (con `-- --actualizar`).
3. Subir el número de versión de los archivos (`?v=X.Y.Z` en `index.html`) para que los navegadores no usen
   archivos viejos guardados en su memoria, y la versión de `package.json`.
4. Con el cambio ya aprobado: actualizar el manual, regenerar el PDF y agregar la entrada en `NOVEDADES`
   (`textos.js`).
5. Publicar en `main`.

## 8. Reglas de la casa

- **El cálculo sale de la norma.** Todo valor del CNE, EM.010 o DGE se verifica contra el documento antes y
  después de cambiarlo. Lo que es criterio de ingeniería se dice así, en la plataforma y en el manual.
- **Ningún cambio de diseño toca el cálculo.** Si toca el motor (`calculo*.js`) o `tablas-cne.js`, las pruebas lo dicen.
- **Cada parámetro nuevo se explica** en su ayuda (`HLP` en `datos.js`) y en el manual.
