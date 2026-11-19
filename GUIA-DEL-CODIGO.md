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
| Lógica, cálculo y planos | `js/` (87 archivos en 10 carpetas) |
| Imágenes de la plataforma | `img/`, `logo.png`, `foto.png`, `og.png` |
| Manual de usuario y referencia técnica | `manual/manual.html` → `manual/JMG-ELECTRIC-Manual-v3.2.pdf` |
| Pruebas automáticas: casos, referencia del cálculo y huellas de los planos | `pruebas/` |
| Herramientas de desarrollo | `herramientas/`, `package.json` |

## 2. Los archivos de `js/`: carpetas y orden de carga

Los archivos están en **carpetas por tema**. Son scripts que **comparten variables**: lo que define un archivo lo
usan los que se cargan después, y el orden está al final de `index.html`. Las carpetas solo ordenan: no cambian ese
orden ni lo que hace el código. `npm run revisar` comprueba que cada archivo esté cargado en `index.html`, que
aparezca en esta guía y que todos lleven la misma versión de caché (`?v=`).

| Carpeta | Qué contiene |
| --- | --- |
| `js/base/` | Datos que usa todo lo demás: logo, tablas del CNE, textos y valores por defecto |
| `js/calculo/` | **Motor de cálculo**: no lee la pantalla; recibe el proyecto y devuelve el resultado `r` |
| `js/resultados/` | Tarjetas de resultados, metrado y presupuesto |
| `js/planos/` | Los planos (láminas IE-01 a IE-06), sus piezas comunes y su paso a DXF y PNG |
| `js/exportar/` | Expediente en PDF, memoria en Excel (una hoja por archivo) y descargas |
| `js/interfaz/` | Ciclo principal, espacio de trabajo, cinta, panel, inicio y tema |
| `js/proyectos/` | Guardar, abrir, archivos .json y respaldo |
| `js/ventanas/` | Las ventanas de escritorio (cuadro de conductores, fichas, editores, datos) |
| `js/editor/` | **Editor de diseño**: lector DXF, plano de arquitectura, diseño eléctrico, láminas y diseño avanzado |
| `js/cuenta/` | Proyectos en la nube, ingreso con cuenta y administración |

Los tres archivos más grandes del editor (`plano.js`, `diseno.js` y `diseno-avanzado.js`, de hasta 6 000 líneas)
se dividieron por tema en la v3.2, sin cambiar el código: cada parte dice en su cabecera de qué archivo viene.

### Orden de carga

| # | Archivo | Qué hace |
| --- | --- | --- |
| | **`base/`** | |
| 1 | `base/logo.js` | Logo en imagen para Excel, unifilar y expediente |
| 2 | `base/tablas-cne.js` | **Tablas del CNE** y constantes del cálculo (solo datos) |
| 3 | `base/textos.js` | Textos: normas, glosario, preguntas, novedades |
| 4 | `base/datos.js` | Valores por defecto, listas editables y ayudas de cada dato |
| | **`calculo/`** | |
| 5 | `calculo/calculo.js` | **Motor de cálculo**: parámetros (`ctx()`) y entrada `calcular(proyecto)` |
| 6 | `calculo/calculo-conductores.js` | Interruptor, sección, tubo, conductor de protección, alimentadores y circuitos |
| 7 | `calculo/calculo-demanda.js` | Máxima demanda (Reglas 050-200 a 050-210) y salidas |
| 8 | `calculo/calculo-tierra-fases.js` | Puesta a tierra, cortocircuito y balance de fases |
| 9 | `calculo/calculo-plano.js` | `planoCalc()`: lee el diseño del plano (circuitos, salidas, recorridos hasta la salida más alejada, áreas, alimentadores) para «Calcular con el diseño»; `planoFuente()`: origen de los datos para la memoria |
| 10 | `calculo/iluminacion.js` | **Niveles de iluminación**: catálogo del Anexo de la EM.010 (2019) por uso (`EM010`, agregado a `PL_AMB`), niveles del proyecto (`LUX`: cambios y ambientes propios, `luxValido`), `ambTipo()` con el estado norma / criterio / bajo norma, recordados para los proyectos nuevos |
| 11 | `calculo/calculo-vivienda.js` | `calcUni()`: vivienda y otros usos |
| 12 | `calculo/calculo-edificio.js` | `calcMulti()`: edificio multifamiliar |
| 13 | `calculo/verificaciones.js` | Alertas y recomendaciones del resultado |
| | **`resultados/`** | |
| 14 | `resultados/resultados.js` | Estado global y tarjetas de resultados |
| 15 | `resultados/metrado.js` | Metrado de materiales, capacidad de cada tablero en polos y medida de su gabinete |
| 16 | `resultados/presupuesto.js` | **Presupuesto**: precios unitarios del proyecto (`PRESU`, `presuValido`), precios recordados de otros proyectos (`preMemoria`, `preCompletar`), cálculo (`preCalc`: desperdicio en tuberías y conductores, CD, GG, utilidad, IGV) y vista «Presupuesto» editable (`cardPresupuesto`, `preRefrescar`) |
| | **`planos/`** | |
| 17 | `planos/dibujo.js` | **Piezas comunes de los planos**: paleta, colores de los conductores, notas, puerta metálica |
| 18 | `planos/unifilar.js` | Diagrama unifilar (IE-01) y su división en láminas |
| 19 | `planos/rotulo.js` | Rótulo de todas las láminas (`rotuloSvg()`) |
| 20 | `planos/exportar-planos.js` | Tamaños de lámina y conversión de cualquier plano a DXF (`svgDxf()`) y PNG (`svgPng()`) |
| 21 | `planos/simbolos.js` | Símbolos de la Norma DGE y primitivas de dibujo (`trazos()`: L, T, R, C, TRI) |
| 22 | `planos/alturas.js` | Diagrama de alturas (IE-02) |
| 23 | `planos/detalles.js` | Leyenda y detalle del pozo de tierra (IE-03) |
| 24 | `planos/tableros.js` | Detalle de tableros (IE-04): puerta metálica o de PVC, interior, peinado |
| 25 | `planos/medidores.js` | Banco de medidores y balance de fases (IE-06, edificios) |
| 26 | `planos/tablerogeneral.js` | Tablero general del edificio (IE-05, edificios) |
| | **`exportar/`** | |
| 27 | `exportar/expediente.js` | Expediente técnico en PDF |
| | **`interfaz/`** | |
| 28 | `interfaz/interfaz.js` | **Ciclo principal** `update()` y navegación |
| | **`exportar/`** | |
| 29 | `exportar/excel.js` | Memoria de cálculo en Excel: `exportar()` arma el libro, los estilos y las ayudas, y llama a cada hoja |
| 30 | `exportar/excel-anexos.js` | Hoja Anexos: tablas del CNE que consultan las fórmulas |
| 31 | `exportar/excel-memoria.js` | Hoja Memoria: datos, parámetros (celdas de las fórmulas) y máxima demanda |
| 32 | `exportar/excel-calculos.js` | Hoja Cálculos: alimentadores, cuadro de cargas, balance y cortocircuito |
| 33 | `exportar/excel-resumen.js` | Hoja Memoria (continuación): resumen, suministro, tierra, verificaciones y firmas |
| 34 | `exportar/excel-planos.js` | Hojas de los planos, como imagen |
| 35 | `exportar/excel-metrado.js` | Hoja Metrado |
| 36 | `exportar/excel-presupuesto.js` | Hoja Presupuesto, con fórmulas (solo si el proyecto tiene precios) |
| 37 | `exportar/descargas.js` | Guardar archivos, lista de planos (`PLANOS`) y diálogos de exportación |
| | **`interfaz/`** | |
| 38 | `interfaz/sitio.js` | Páginas de la web (glosario, novedades, soporte) |
| | **`proyectos/`** | |
| 39 | `proyectos/proyectos.js` | Guardar, abrir y ejemplos de proyectos. **Almacén** (v3.0): biblioteca y proyecto abierto en IndexedDB (`jmg-electric-proyectos`, `alCargar`, `alEscribir`), con copia de respaldo en localStorage (completos si caben, si no su resumen `_idb`); almacenamiento persistente; respaldo .json con el plano DXF (`proyectoConPlano`, `guardarPlanoDeArchivo`) |
| | **`interfaz/`** | |
| 40 | `interfaz/herramientas.js` | Calculadoras rápidas |
| | **`proyectos/`** | |
| 41 | `proyectos/archivo.js` | Abrir y guardar `.json` |
| 42 | `proyectos/respaldo.js` | **Respaldo**: todos los proyectos con sus planos en un archivo (`respDescargar`) y su restauración sin borrar nada (`respLeer`, `respAplicar`); fecha del último respaldo |
| | **`interfaz/`** | |
| 43 | `interfaz/app.js` | Espacio de trabajo: árbol, propiedades, cinta |
| | **`ventanas/`** | |
| 44 | `ventanas/ventana.js` | Comportamiento común de las ventanas (mover, redimensionar, recordar tamaño) |
| 45 | `ventanas/conductores.js` | Ventana Cuadro de conductores |
| 46 | `ventanas/ficha.js` | Ventana Ficha del circuito (con vista previa) |
| 47 | `ventanas/longitudes.js` | Ventana **Verificar longitudes** (cuadro de conductores): los tramos que suma la longitud de cada circuito del plano (`plCamino`), con el acumulado, el total y el recorrido de cada salida |
| 48 | `ventanas/precios.js` | Ventana **Precios unitarios**: rejilla editable con las partidas del metrado (buscar, filtros sin precio / recordados), origen de cada precio, porcentajes y resumen con el total en letras; cambios pendientes con vista previa (`preCalc` con los precios pendientes) hasta Aplicar |
| 49 | `ventanas/ficha-tablero.js` | Ventana Ficha del tablero (alimentador, circuitos, equipos y gabinete) |
| 50 | `ventanas/tabla-cargas.js` | Ventana Editor de cargas especiales (con vista previa) |
| 51 | `ventanas/parametros.js` | Ventana Parámetros de diseño (se arma con el formulario de parámetros) |
| 52 | `ventanas/departamentos.js` | Ventana Editor de departamentos |
| 53 | `ventanas/datos-proyecto.js` | Ventana Datos del proyecto (se arma con los formularios del panel) |
| | **`interfaz/`** | |
| 54 | `interfaz/panel.js` | Panel del proyecto (resumen, elemento elegido, por revisar) |
| 55 | `interfaz/menus-cinta.js` | Menús ▾ de la cinta (sistema eléctrico y agregar cargas) |
| | **`editor/`** | |
| 56 | `editor/dxf.js` | **Lector DXF**: lee un plano de AutoCAD y lo convierte en trazos, textos, capas y puntos de enganche (sin pantalla) |
| 57 | `editor/plano-archivo.js` | **Editor de diseño** (1/5): a pantalla completa. plano de arquitectura con zoom, escala, plantas, selección y medición; objetos de la arquitectura borrados de la vista (`EPL.borr`, número de objeto del DXF; el archivo no cambia); Ctrl+X / Supr (`edBorrar`); paneles con ancho ajustable; menú del clic derecho (`edMenuAbrir`; con una herramienta, termina); mano y barra de navegación (zoom ventana, vista anterior `PL_VHIST`); comandos por teclado (`ED_CMD`) y atajos del usuario (`atjAbrir`); buscar en el plano (`buAbrir`, Ctrl+F); modo presentación (`edPresentar`); autoguardado (`edAutoguardar`, `edRecuperar`); con el plano atenuado la arquitectura no se elige; deshacer con tope de memoria (unos 80 MB, al menos 10 pasos); mouse y teclado; Aplicar / Aceptar / Cancelar Aquí: el archivo DXF en la base de datos del navegador, abrir, deshacer y aplicar, y la preparación del dibujo. |
| 58 | `editor/plano-vista.js` | Editor (2/5): coordenadas, zoom y desplazamiento, colores, dibujo del plano, lienzo superior (selección, mediciones, encuadres y plantas), enganche y orto |
| 59 | `editor/plano-herramientas.js` | Editor (3/5): herramientas de medición, escala y plantas, panel de propiedades, mouse y teclado sobre el plano |
| 60 | `editor/plano-comandos.js` | Editor (4/5): panel izquierdo, mostrar el editor, cinta plegable, barra de navegación, comandos por teclado, atajos, buscar (Ctrl+F), modo presentación y autoguardado |
| 61 | `editor/plano-menu.js` | Editor (5/5): menú del clic derecho, pestaña Diseño del espacio de trabajo y barra de título, pestañas y cinta del editor |
| 62 | `editor/diseno-catalogo.js` | **Diseño eléctrico** (1/9): **Diseño eléctrico** en el editor: símbolos de la Norma DGE (catálogo `DS_CAT` con su código) que se encajan en el muro, tuberías con tramos rectos o curvos (longitud del arco), cotas, directrices, líneas y textos; pinzamientos (giro libre y letra del tipo movible, `el.dt`), color propio (`el.col`) o por tipo de símbolo (`DS_COLT`, `dsColorEl`), paso de giro (`DSU.giro`), **conexiones** de las tuberías a los artefactos (`c0`/`c1`, imán `dsEngancheCon`, borde `dsBorde`, `dsReconectar`, aviso `dsSueltos`; el tablero se conecta por su salida, eligiéndola en un menú con `dsElegirSalida`), color por circuito (`dsColCir`), marcas de conductores (`el.cond`, `dsMarcas`), letra de encendido (`el.enc`), rastreo polar (`DSU.polar`), copiar en fila y espejo (`dsIniciarCopia`, `dsClonar`, `dsReflejar`), leyenda automática (`t: "ley"`, `dsDibLeyenda`), ventana de propiedades con doble clic (`elAbrir`), revisión del diseño con criterios editables (`dsVerificar`, `D.crit`), mover, girar, copiar, borrar, rejilla, propiedades la **Biblioteca de símbolos** con buscador (`bibAbrir`, tecla B), el **editor de símbolos** con criterio del proyectista (`D.simb`: relleno, tamaño, letra y grosor; `siAbrir`, `dsTam`, `dsRellenoCuerpo`) y el fondo del plano regulable (`dsFondo`). **Rapidez**: índice espacial del diseño (`dsIdx`, `dsEnZona`, `dsCercanos`; se rehace con `dsIdxSucio`), se dibuja solo lo visible y el panel izquierdo se difiere en proyectos grandes Aquí: el catálogo `DS_CAT`, los sistemas y capas, los datos del diseño (`dsD()`) y las preferencias de esta computadora. |
| 63 | `editor/diseno-geometria.js` | Diseño (2/9): símbolos como primitivas, tramos rectos y curvos, cotas y directrices, símbolos con criterio, geometría de cada elemento y leyenda automática |
| 64 | `editor/diseno-conexiones.js` | Diseño (3/9): índice espacial (cuadrícula) y **conexiones** de las tuberías con los artefactos; circuitos que pasan a lo conectado y conductores automáticos contados por el recorrido (fase, retornos, neutro y tierra) |
| 65 | `editor/diseno-dibujo.js` | Diseño (4/9): rejilla, dibujo de cada elemento, pinzamientos y encaje de los símbolos de pared en el muro |
| 66 | `editor/diseno-herramientas.js` | Diseño (5/9): lienzo superior (selección, fantasma del símbolo, trazo en curso) y herramientas para colocar y dibujar |
| 67 | `editor/diseno-edicion.js` | Diseño (6/9): copiar en fila y espejo; seleccionar, mover, girar, copiar, pegar y borrar; editar vértices, partir y unir |
| 68 | `editor/diseno-propiedades.js` | Diseño (7/9): panel de propiedades de lo seleccionado (circuito, conductores F, R, N y T, etiquetas…) y resumen del diseño |
| 69 | `editor/diseno-cinta.js` | Diseño (8/9): cinta del editor, editor de símbolos (criterio), fondo del plano y ventana de propiedades (doble clic) |
| 70 | `editor/diseno-revision.js` | Diseño (9/9): revisión del diseño (avisos y «Juntar tuberías»), biblioteca de símbolos de la Norma DGE y ventana Tablero |
| 71 | `editor/laminas.js` | **Láminas y DXF del diseño**: un lienzo que graba lo que dibuja el editor (`laGrabador`); con eso, la lámina en PDF (`laSvg`: varias láminas `D.lams`, cada una con papel A4 a A1, su escala, su zona —planta, pantalla o rectángulo marcado— y sus capas, leyenda, escala gráfica, notas y rótulo) y el DXF del diseño en coordenadas reales (`laDxf`, R12, con o sin la arquitectura) |
| 72 | `editor/plantas-areas.js` | **Diseño avanzado** (1/8): **Diseño avanzado**: plantas (`dpPlantaEl`, copiar a otra planta) y montantes (`el.mon`), bloques propios en el navegador (Biblioteca › Mis bloques), plantillas (de partida y propias), ruta automática de tuberías (`dpRuta`), versiones del diseño (`EPL.vers`, comparar y restaurar), **cuadro de circuitos** (`t: "cua"`, `dsFilasCua`), **metrado del diseño** (`metAbrir`, CSV) y caja de paso automática (`dpPonerCaja`); tablas guardadas hasta el próximo cambio (`dpCache`) Aquí: plantas y montantes, y áreas para el cálculo. |
| 73 | `editor/ambientes.js` | Diseño avanzado (2/8): ambientes con su tipo y verificación de las reglas de seguridad del CNE-Utilización por ambiente |
| 74 | `editor/arquitectura.js` | Diseño avanzado (3/8): actualizar arquitectura (comparar versiones del DXF sin perder el diseño) y ver elementos (`dsVerIds`, `edVerEnPlano`) |
| 75 | `editor/luminarias.js` | Diseño avanzado (4/8): tipos de luminaria del proyecto (L1, L2…) y su biblioteca |
| 76 | `editor/datos-calculo.js` | Diseño avanzado (5/8): ventana «Datos del diseño para el cálculo» (`dcDatos`, `dcRender`) y escribir el cálculo en el plano |
| 77 | `editor/bloques-plantillas.js` | Diseño avanzado (6/8): bloques propios, plantillas, ruta automática de tuberías y versiones del diseño |
| 78 | `editor/cuadro-metrado.js` | Diseño avanzado (7/8): cuadro de circuitos de la lámina, caja de paso automática y metrado del diseño |
| 79 | `editor/repartir-pasos.js` | Diseño avanzado (8/8): repartir en un ambiente o a lo largo de un muro, bloque por colocar, comparación con una versión y pasos del diseño con el cálculo en vivo |
| 80 | `editor/iluminacion-ventana.js` | Pestaña **Niveles de iluminación** de la ventana «Ambientes e iluminación» (`luxAbrir`, `amVentana` en diseno-avanzado.js): por uso, buscar, solo los cambiados, volver a la norma, ambientes propios y elegir el tipo de un ambiente (`luxElegir`) |
| 81 | `editor/capas.js` | Ventana **Administrador de capas** del editor |
| | **`interfaz/`** | |
| 82 | `interfaz/centro.js` | Centro de ingeniería (Inicio) |
| 83 | `interfaz/inicio.js` | Arranque y bienvenida |
| 84 | `interfaz/tema.js` | Tema, zoom y mano de arrastre |
| | **`cuenta/`** | |
| 85 | `cuenta/nube.js` | **Proyectos en la nube** (Firestore): copia de cada proyecto y su plano en `proyectos/{uid}` (el sitio de pruebas, en `proyectos-beta/{uid}`), gana la fecha más reciente, eliminados como «borrado» |
| 86 | `cuenta/acceso.js` | Ingreso con cuenta y Administración |
| 87 | `cuenta/admin.js` | **Administración** (solo el administrador): PIN, panel con agenda, calendario, pendientes y notas, hoja de cuentas con vigencia y nueva cuenta |

Cada archivo empieza con un comentario que explica lo mismo con más detalle.

### Cómo están hechos los planos

Cada plano es una función que recibe el resultado del cálculo `r` y devuelve `{ svg, W, H }`, por ejemplo
`tableroGeneral(r)`. Dibuja con las primitivas de `trazos(o)` (`planos/simbolos.js`) sobre una lista de textos SVG y
termina con su recuadro de notas (`notasSvg()`, `planos/dibujo.js`) y su rótulo (`rotuloSvg()`, `planos/rotulo.js`). Todos los planos están en la lista
`PLANOS` de `exportar/descargas.js`, que usan la pantalla, el DXF, el Excel y el expediente.

**Para un plano nuevo o un cambio de colores:** usar la paleta `PAL`, los colores `COND` y las piezas de
`planos/dibujo.js`, y no copiarlas. Si una pieza nueva se repite en dos planos, va a `planos/dibujo.js`.

### Cómo funciona el editor de diseño (plano de arquitectura)

1. El usuario abre un DXF. `modeloDxf()` (`editor/dxf.js`) lo lee **una vez**: expande los bloques (con giro, escala y
   espejo), convierte arcos y curvas en tramos cortos, resuelve colores y capas, y arma la lista de puntos de enganche.
   La unidad del dibujo sale de las cotas, porque la cabecera del archivo a veces está mal.
2. La pestaña Diseño de la cinta abre el **editor a pantalla completa** (`edAbrir()`), que trabaja sobre una copia del
   plano del proyecto (`EPL`) con su propio deshacer; `edAplicar()` la pasa al proyecto (`PLANO`) y Cancelar la descarta.
   La arquitectura es una referencia bloqueada: se selecciona para ver sus propiedades, pero no se mueve. Lo que se
   dibuja encima va en `EPL.dis` (`editor/diseno-*.js`): capas propias y elementos (símbolos con el mismo dibujo de
   `simboloDGE()`, líneas, textos y tuberías) en coordenadas del dibujo; `disValido()` (`proyectos/proyectos.js`) lo valida.
3. `editor/plano-*.js` agrupa los trazos por color y tipo de línea (`plPreparar()`) y los dibuja en un lienzo (`canvas`); encima
   hay otro lienzo para lo que sigue al cursor (enganche, mediciones, encuadres). Así el plano se mueve con fluidez
   aunque tenga decenas de miles de objetos.
4. El archivo se guarda en la base de datos del navegador (IndexedDB) con su huella SHA-1; el proyecto guarda solo
   `PLANO`: nombre y huella del archivo, unidad, capas ocultas, plantas y modo atenuado (`planoValido()` en
   `proyectos/proyectos.js` lo valida al abrir). El plano no entra al cálculo todavía: eso llega con el diseño en planta.

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
2. Al cambiarlo se llama a **`update()`** (`interfaz/interfaz.js`).
3. `update()` revisa con `faltantes()` si faltan datos. Si faltan, muestra la lista en ámbar y se detiene.
4. Si están completos, **`ctx()`** (`calculo/calculo.js`) reúne los parámetros: método de instalación, temperatura,
   factor de potencia, reserva, etc.
5. **`calcUni(c)`** (vivienda u otros usos) o **`calcMulti(c)`** (edificio) calculan:
   - la máxima demanda con `mdVivienda()` o `mdUso()`;
   - los alimentadores con `alimentador()` y los circuitos con `grupos()` / `circuito()`;
   - el interruptor y la sección con **`dimensionar()`**, por capacidad y por caída de tensión;
   - el balance de fases con `balancear()` y la puesta a tierra con `pozo()`.
6. El resultado `r` se guarda en `LAST` y lo dibuja **`render(r)`** con las tarjetas de `resultados/resultados.js`,
   `planos/unifilar.js` y `resultados/metrado.js`.
7. Las exportaciones (`exportar/excel.js`, `exportar/expediente.js`, `planos/exportar-planos.js`) leen ese mismo `r`. Por eso la pantalla,
   el Excel y el PDF siempre coinciden.

## 5. Por dónde empezar a estudiar

1. **`base/tablas-cne.js`**: compara cada tabla con el CNE. Es corto y te conecta el código con la norma.
2. **El motor**: `dimensionar()` (`calculo/calculo-conductores.js`), `mdVivienda()` (`calculo/calculo-demanda.js`) y `calcUni()` (`calculo/calculo-vivienda.js`). Sigue a mano el ejemplo **C1** del
   manual (vivienda de 120 m²) con el código al lado.
3. **`interfaz/interfaz.js`**: la función `update()`, para ver cómo se conecta todo.
4. Después, lo que necesites tocar: `resultados/resultados.js` (pantalla), `exportar/excel.js` (memoria), `cuenta/acceso.js` (cuentas).

## 6. Herramientas de desarrollo

Están instaladas con Node.js. Si se cambia de computadora, se reinstalan con `npm install`.

| Comando | Qué hace |
| --- | --- |
| `npm run verificar` | **Todo de una vez**, en este orden: revisar, formato, cálculo, planos, DXF, Excel e interfaz. Se detiene en la primera prueba que falla. Es lo que se corre antes de publicar. |
| `npm run formato` | Ordena el formato del código (Prettier). No cambia lo que hace el código. En VS Code se hace solo al guardar (extensión Prettier y `.vscode/settings.json`). |
| `npm run revisar` | Busca errores y código sin usar (ESLint), analizando todos los archivos juntos, y el **orden del código**: cada archivo de `js/` cargado en `index.html` y en esta guía, y la misma versión de caché (`?v=`) en todos. |
| `npm test` | **Pruebas del cálculo**: 34 casos contra `pruebas/referencia.js` (cálculo, metrado, alertas). |
| `npm run pruebas-planos` | **Pruebas de los planos**: la huella de cada plano (SVG y DXF) de los 34 casos contra `pruebas/huellas.js`. |
| `npm run pruebas-excel` | **Pruebas del Excel**: la huella de cada hoja de la memoria (celdas, fórmulas, formato) de los 34 casos contra `pruebas/huellas-excel.js`, en Chrome. |
| `npm run pruebas-ui` | **Pruebas de la interfaz**: 54 escenarios en Chrome (fichas, editores, vista previa, deshacer, plano de arquitectura). |
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

1. `npm run verificar` en verde (revisar, formato y todas las pruebas).
2. Si el cálculo, un plano o el Excel cambió a propósito, revisar cada diferencia y regenerar `pruebas/referencia.js`,
   `pruebas/huellas.js` o `pruebas/huellas-excel.js` (con `-- --actualizar`).
3. Subir el número de versión de los archivos (`?v=X.Y.Z` en `index.html`) para que los navegadores no usen
   archivos viejos guardados en su memoria, y la versión de `package.json`.
4. Con el cambio ya aprobado: actualizar el manual, regenerar el PDF y agregar la entrada en `NOVEDADES`
   (`base/textos.js`).
5. Publicar en `main`.

## 8. Reglas de la casa

- **El cálculo sale de la norma.** Todo valor del CNE, EM.010 o DGE se verifica contra el documento antes y
  después de cambiarlo. Lo que es criterio de ingeniería se dice así, en la plataforma y en el manual.
- **Ningún cambio de diseño toca el cálculo.** Si toca el motor (`js/calculo/`) o `base/tablas-cne.js`, las pruebas lo dicen.
- **Cada parámetro nuevo se explica** en su ayuda (`HLP` en `base/datos.js`) y en el manual.
