/* TEXTOS INFORMATIVOS
   Alcance, normas aplicadas, criterios, glosario, preguntas frecuentes, novedades por versión y
   documentos del expediente. Solo texto; lo muestran sitio.js, el manual y el expediente. */
const ALCANCE = [
  "Máxima demanda · Reglas 050-200 y 050-202",
  "Otros usos · Regla 050-210 y Tabla 14; escuelas, hospitales y hoteles (050-204 a 050-208)",
  "Circuitos derivados · máx. 12 salidas (070-3000)",
  "Conductores según Tabla 2 y factores 5A / 5C",
  "Interruptores termomagnéticos y diferenciales (150-400)",
  "Caída de tensión en alimentadores y derivados (050-102)",
  "Cortocircuito y poder de corte requerido",
  "Balance de cargas por fase",
  "Puesta a tierra · Reglas 060-702 y 060-712"
];
const NORMAS = [
  [
    "RM 037-2006-MEM/DM",
    "Código Nacional de Electricidad – Utilización",
    "Norma obligatoria para las instalaciones eléctricas en edificaciones desde la acometida hasta los puntos de utilización.",
    "Base de los cálculos de cargas, conductores, protección, caída de tensión y puesta a tierra."
  ],
  [
    "CNE-U · 050-110 · 050-200",
    "Áreas y viviendas unifamiliares",
    "Área de vivienda con 75 % del sótano; carga básica de 2 500 W hasta 90 m² más 1 000 W por cada 90 m² adicionales; corriente mínima de 40 A.",
    "Máxima demanda y alimentador en el modo unifamiliar."
  ],
  [
    "CNE-U · 050-210 · Tabla 14",
    "Otros tipos de uso",
    "Oficinas, locales comerciales, bancos, restaurantes, hospedajes, iglesias, garajes, almacenes y otros: carga en W/m² según la actividad y factor de demanda de la Tabla 14, más las cargas especiales.",
    "Máxima demanda en el modo comercial y otros usos."
  ],
  [
    "CNE-U · 050-204 · 050-206 · 050-208",
    "Escuelas, hospitales y hoteles",
    "Escuelas: 50 W/m² de aulas más 10 W/m² del resto. Hospitales: 20 W/m² más 100 W/m² en áreas de alta intensidad. Hoteles y dormitorios: 20 W/m². Factores de demanda sobre la carga total hasta y sobre 900 m².",
    "Máxima demanda en escuelas, hospitales y hoteles."
  ],
  [
    "CNE-U · 050-202",
    "Edificios de departamentos",
    "Carga básica de 1 500 W hasta 45 m², 1 000 W por los segundos 45 m² y 1 000 W por cada 90 m² adicionales; mínimo 25 A. Factores del edificio 100 / 65 / 40 / 30 / 25 % y 75 % para cargas comunes.",
    "Máxima demanda por departamento y del edificio."
  ],
  [
    "CNE-U · 050-102 · 050-108",
    "Caída de tensión y espacios en tablero",
    "Caída máxima de 2.5 % en alimentadores y en derivados, y 4 % total. Espacio para dos dispositivos de reserva.",
    "Selección de secciones y espacios de reserva."
  ],
  [
    "CNE-U · Tabla 2 · 5A · 5C",
    "Capacidad de corriente de conductores",
    "Ampacidad de conductores de cobre según método de instalación de la NTP 370.301, con correcciones por temperatura y agrupamiento.",
    "Selección de conductores en alimentadores y circuitos derivados."
  ],
  [
    "CNE-U · 150-400 · 070-3000",
    "Tableros en vivienda y salidas por circuito",
    "Interruptor general, diferencial de 30 mA (por grupos de tres circuitos o por circuito) y máximo 12 salidas por circuito.",
    "Esquema de protección y distribución de circuitos."
  ],
  [
    "CNE-U · 060-702 · 060-712 · Tablas 16 y 17",
    "Puesta a tierra",
    "Varilla de longitud mínima 2 m; resistencia no mayor de 25 Ω; conductores de protección y de puesta a tierra.",
    "Resistencia del electrodo y secciones de tierra."
  ],
  [
    "RNE · Norma EM.010 (2019)",
    "Instalaciones eléctricas interiores",
    "Evaluación de la demanda, documentación del proyecto, circuitos de reserva e iluminación de emergencia en edificios multifamiliares.",
    "Contenido del expediente y verificaciones del modo multifamiliar."
  ],
  [
    "Norma DGE (2004)",
    "Conexiones eléctricas en BT en zonas de concesión",
    "Sistemas 220 V y 380/220 V, tipos de conexión, diferenciales de 30 mA y poder de corte de los interruptores.",
    "Tipo de conexión, tensiones normalizadas y poder de corte."
  ],
  [
    "IEC 60898-1 · IEC 61008-1",
    "Interruptores para uso doméstico",
    "Interruptores termomagnéticos y diferenciales para instalaciones domésticas y análogas.",
    "Corrientes nominales y poderes de corte normalizados."
  ]
];
const CRITERIOS = [
  "La corriente de diseño es 1.25 veces la corriente nominal en circuitos derivados y en el alimentador de servicios generales (carga continua, Regla 050-104). En los alimentadores de vivienda y departamentos se aplica la reserva elegida en los parámetros: 25 % para ampliaciones (práctica usual) o 0 %, el mínimo de la norma, porque su carga calculada no es continua (Reglas 050-200(3) y 050-202(2)); en ambos casos no menor que la mínima del código (40 A en vivienda unifamiliar, 25 A por departamento).",
  "El interruptor se elige igual o mayor que la corriente de diseño y menor o igual que la ampacidad corregida del conductor.",
  "La ampacidad se toma de la Tabla 2 según el método de instalación y se corrige por temperatura (Tabla 5A) y por agrupamiento (Tabla 5C).",
  "La sección se incrementa hasta cumplir la ampacidad y la caída de tensión: 2.5 % en alimentadores, 2.5 % en derivados y 4 % total.",
  "La caída de tensión se calcula con la resistividad del cobre a la temperatura de operación del conductor (70 °C en PVC, 90 °C en XLPE); el cortocircuito, con la resistividad a 20 °C, que da la corriente más alta.",
  "Los circuitos de motores tienen conductores de capacidad no menor al 125 % de la corriente a plena carga (Regla 160-106) y se protegen con interruptores de curva D por la corriente de arranque (Regla 160-200, Tabla 29).",
  "En edificios, las unidades se ordenan de mayor a menor carga para aplicar los factores 100 / 65 / 40 / 30 / 25 %; el aire acondicionado se suma al 100 % y las cargas comunes al 75 %.",
  "En «otras cargas mayores de 1 500 W» de la Regla 050-202, sin cocina, se adopta el mismo criterio de la Regla 050-200: 100 % hasta 6 kW y 25 % del exceso.",
  "El cortocircuito se estima desde la corriente del punto de entrega sumando la resistencia de los conductores; el poder de corte se elige igual o mayor, y no menor que el mínimo comercial elegido (4.5 kA por defecto, IEC 60898-1).",
  "Los interruptores diferenciales son de 30 mA y tipo A por defecto; si se elige el tipo AC, se usa tipo A en los diferenciales que protegen cargas con electrónica (inverter, variador, inducción, cargador), cuyas fugas con componente continua puede no detectar un tipo AC (IEC 60364-5-53, IEC 62423).",
  "En los circuitos de motores se verifica que la corriente de arranque directo (6 veces la nominal por defecto) no alcance el disparo magnético mínimo de la curva del interruptor (IEC 60898-1); la caída de tensión en el arranque se informa como referencia.",
  "Las alturas de montaje se miden desde el piso terminado hasta el eje de la caja (el tablero, hasta su borde superior). Interruptores y timbres hasta 1.35 m (A.120, Art. 11 d) y alcance frontal de 0.40 a 1.20 m (A.120, Art. 10); las demás alturas son criterio del proyectista.",
  "El metrado sigue las partidas de la Norma Técnica de Metrados (R.D. N.° 073-2010-VIVIENDA, título OE.5) con cantidades netas; la tubería de cada circuito suma la distancia a la salida más alejada y los tramos verticales según las alturas de montaje.",
  "Los diferenciales protegen grupos de hasta tres circuitos (Regla 150-400(8)). Con suministro trifásico, los grupos se forman después del balance de fases y con circuitos de una misma fase, para que cada diferencial bipolar quede en una sola fase; los circuitos trifásicos se agrupan aparte.",
  "Los planos usan los símbolos de la Norma DGE «Símbolos gráficos en electricidad» (R.M. N.° 091-2002-EM/VME) y la señal de riesgo eléctrico 141-02-02 de la Norma DGE de señalización. Son criterio de diseño las medidas y los materiales del pozo de tierra, el orden de los colores de las fases en los tableros peinados (R rojo, S negro, T azul; neutro blanco y protección verde-amarillo) y la altura mínima del texto impreso, 1.8 mm (ISO 3098), con la que el unifilar se divide en varias láminas.",
  "El balance de fases busca el reparto de cargas monofásicas con el menor desbalance posible; el proyectista puede fijar la fase de cualquier carga. Se recomienda un desbalance no mayor de 10 % como criterio de diseño."
];
const GLOSARIO = [
  ["MD", "Máxima demanda: potencia que se espera usar simultáneamente, calculada con las Reglas 050-200 y 050-202."],
  [
    "ITM",
    "Interruptor termomagnético: protege el conductor contra sobrecargas y cortocircuitos. Curva C para usos generales, D para motores."
  ],
  ["ID", "Interruptor diferencial de 30 mA: protege a las personas contra contactos indirectos (Regla 150-400)."],
  ["PdC", "Poder de corte: máxima corriente de cortocircuito que el interruptor puede interrumpir sin dañarse."],
  [
    "Icc",
    "Corriente de cortocircuito disponible en un punto de la instalación. En el punto de entrega la proporciona la concesionaria."
  ],
  ["ΔV", "Caída de tensión: máximo 2.5 % en alimentadores, 2.5 % en derivados y 4 % total (Regla 050-102)."],
  ["Iz", "Capacidad de corriente del conductor (Tabla 2), corregida por temperatura (5A) y agrupamiento (5C)."],
  ["Id", "Corriente de diseño: 1.25 veces la corriente nominal del circuito."],
  [
    "PAT",
    "Puesta a tierra: electrodo y conductores que conectan la instalación a tierra; resistencia máxima 25 Ω (Regla 060-712)."
  ],
  ["TG · TD · TSG", "Tablero general, tablero de departamento y tablero de servicios generales."],
  ["Metrado", "Cuantificación de materiales por partidas, base para el presupuesto de la obra."]
];
const FAQ = [
  [
    "¿Qué edificaciones puedo calcular?",
    "Viviendas unifamiliares de uno o varios pisos, edificios multifamiliares y, en «Comercial y otros usos», oficinas, locales comerciales y demás usos de la Tabla 14 del CNE-U, además de escuelas, hospitales y hoteles (Reglas 050-204 a 050-208). El uso se elige al crear el proyecto o en Proyecto › Uso de la edificación."
  ],
  [
    "¿Por qué el balance de fases aparece en ámbar?",
    "Porque el desbalance supera el 10 %, criterio de diseño recomendado. Si el mensaje indica que es el mínimo alcanzable, ningún reparto de las cargas lo mejora: divida el circuito más grande o use una carga trifásica."
  ],
  [
    "¿Qué valor de Icc uso si no lo conozco?",
    "Solicítelo a la concesionaria (Norma DGE, 110.F). Mientras tanto, 10 kA es un valor conservador para zonas urbanas."
  ],
  [
    "¿El metrado es exacto?",
    "Las protecciones, tableros, cajas y aparatos salen del cálculo. Las longitudes de conductores y tubos son referenciales y deben verificarse con los planos de distribución."
  ],
  [
    "¿Dónde se guardan mis proyectos?",
    "En este navegador. Para respaldarlos o usarlos en otra computadora, expórtelos desde la pestaña Proyectos e impórtelos en el otro equipo."
  ],
  [
    "¿Puedo modificar el Excel?",
    "Sí. Las celdas en azul son datos de entrada: al cambiarlas, el libro recalcula los resultados con fórmulas vinculadas."
  ],
  [
    "¿La memoria reemplaza la firma del ingeniero?",
    "No. Los resultados son de referencia; la responsabilidad del diseño corresponde al ingeniero colegiado que suscribe el expediente (EM.010, Art. 8)."
  ]
];
const NOVEDADES = [
  [
    "v3.0",
    "Editor de diseño: el proyecto se diseña sobre el plano de arquitectura en DXF (símbolos de la Norma DGE, tableros con sus salidas, tuberías por techo, pared o piso, montantes, leyenda, cuadro de circuitos, láminas PDF y DXF del diseño) y se calcula con lo dibujado. Con «Calcular con el diseño», los circuitos son los del plano, con su carga conectada y la longitud hasta la salida más alejada por las tuberías y los tramos verticales (Regla 050-102); el agrupamiento sale de los circuitos de cada tubería (Tabla 5C); las áreas se marcan en el plano con un clic (dimensiones interiores en vivienda, Regla 050-110, y exteriores en otros usos, Regla 050-210); los alimentadores, las cargas especiales y el conductor de tierra se miden en el plano; el edificio multifamiliar toma de cada tipo de departamento su alimentador desde el banco de medidores, sus circuitos y su área. Tipos de luminaria con biblioteca, medidor trifásico y banco de medidores, escribir en el plano los conductores y diámetros del cálculo, y «Actualizar arquitectura» para la versión nueva del arquitecto sin perder el diseño. La memoria y el expediente explican el origen de los datos. Los proyectos sin plano se calculan igual que antes."
  ],
  [
    "v2.9.9",
    "Por dentro, la plataforma está ordenada para seguir creciendo: el motor de cálculo, la memoria en Excel, los planos y los estilos están divididos por tema en archivos más pequeños, y cada parte tiene pruebas automáticas que comprueban que el cálculo, cada plano, cada hoja del Excel y cada pantalla quedan iguales. El cálculo, los planos y la memoria no cambian."
  ],
  [
    "v2.9.8",
    "Edificios: nuevas láminas IE-05 Tablero general (interruptor general en caja moldeada y barras de cobre N, R, S y T de las que sale la fase de cada suministro según el balance) e IE-06 Banco de medidores (cajas de la concesionaria a escala, con sus medidas, alturas y el balance de fases). En el detalle de tableros, la puerta y el interior tienen el mismo tamaño, con la medida de catálogo del gabinete y sus polos por fila; los tableros de vivienda y de departamento de hasta 24 polos son de PVC empotrable con tapa transparente (se cambia en la ficha del tablero, pestaña Equipos). Las notas incluyen el espacio de trabajo de 1 m (Regla 020-308) y la reserva de 450 mm de conductor en cada medidor (Regla 040-402), y el metrado indica la medida y el tipo de cada tablero."
  ],
  [
    "v2.9.7",
    "Expediente técnico con diseño profesional: portada con firma y sello y número de revisión, control del documento con tabla de revisiones, índice general, índice de tablas y lista de láminas en páginas propias, tablas técnicas numeradas con su fuente (líneas horizontales finas y encabezado gris suave), ecuaciones numeradas, tablas anchas en página horizontal y margen para encuadernar. El expediente incluye ahora todos los planos (IE-01 a IE-04), reducidos a A4. El detalle de tableros se divide en láminas IE-04A… cuando no entra a lo ancho de la lámina."
  ],
  [
    "v2.9.6",
    "Planos en AutoCAD: en el detalle de tableros, los equipos, el riel, las canaletas y la puerta llevan rellenos grises y la barra de tierra va en verde, como en pantalla. El logo del rótulo se dibuja con figuras, así se ve igual en cualquier AutoCAD, y el rótulo tiene siempre la misma altura, con el logo llenando su caja y el borde del mismo grosor en todo el contorno."
  ],
  [
    "v2.9.5",
    "Planos nuevos: Leyenda y detalles (lámina IE-03), con los símbolos de la Norma DGE que usa el proyecto y el detalle del pozo de puesta a tierra, cuyas medidas y materiales se editan en Parámetros › Tierra y metrado; y Detalle de tableros (IE-04), con la vista de la puerta y su señal «¡Peligro! Riesgo eléctrico» (Norma DGE 141-02-02), la vista interior con sus dispositivos y, como opción, el tablero peinado con los conductores en colores y el cuadro de conexiones. El unifilar usa los símbolos de la Norma DGE, muestra los equipos del tablero (DPS, relé, medidor y contactor) en su leyenda, puede dibujarse en vertical y se divide en varias láminas (IE-01, IE-01A…) cuando el texto impreso quedaría menor de 1.8 mm en la lámina elegida en Planos. Con suministro trifásico, cada diferencial agrupa circuitos de una sola fase. DXF en colores vivos, con capas por parte y vista inicial de toda la lámina; la memoria Excel tiene ocho hojas."
  ],
  [
    "v2.9.4",
    "Diagrama de alturas de montaje (lámina IE-02): elevación con las salidas del proyecto a su altura, aparatos dibujados como se instalan, leyenda con los símbolos de la Norma DGE y verificación de interruptores y tomacorrientes con la Norma A.120 del RNE. Alturas editables en Parámetros › Alturas. Metrado ordenado por las partidas de la Norma Técnica de Metrados (R.D. N.° 073-2010-VIVIENDA), con cantidades netas y tramos verticales según las alturas. La pestaña Unifilar pasa a llamarse Planos; la descarga DXF permite elegir el unifilar, el de alturas o los dos, y la memoria Excel incluye la hoja Alturas."
  ],
  [
    "v2.9.3",
    "Protección: poder de corte mínimo comercial de 4.5 kA por defecto (elegible en Parámetros; los tableros con Icc baja pasan de 3 a 4.5 kA), interruptor diferencial tipo A o AC con tipo A donde haya cargas con electrónica, y verificación del arranque de motores frente al disparo magnético de la curva del ITM, con la caída de tensión en el arranque como dato informativo. Forma de trabajo: los datos se ingresan solo en ventanas, que se abren con doble clic en cualquier elemento del explorador o desde la cinta; el panel derecho es ahora el Panel del proyecto, de solo lectura, con Resumen, Elemento seleccionado y Por revisar, que se muestran u ocultan en Proyecto › Panel del proyecto. Las vistas de resultados se eligen solo en Resultados › Vistas, con los avisos en sus botones, y las descargas del unifilar en Unifilar › Descargar. Casillas de las ventanas más compactas."
  ],
  [
    "v2.9.2",
    "Corrección: al abrir un proyecto guardado con una versión anterior, los datos que esa versión no tenía (por ejemplo, el área libre no techada) toman su valor por defecto; antes conservaban el valor del proyecto abierto previamente. Por dentro, el motor de cálculo es independiente de la pantalla y calcula los datos del proyecto, las vistas previas de las ventanas calculan una copia del proyecto sin tocarlo, y los datos del proyecto tienen una sola fuente. El cálculo no cambia."
  ],
  [
    "v2.9.1",
    "Editor de departamentos en Datos del proyecto: tipos de departamento con sus salidas de otra potencia y sus cargas especiales, y el resultado de cada uno con vista previa. Datos del proyecto más compacto y con el tipo de edificación editable. Vista previa del cálculo también en el cuadro de conductores, Parámetros de diseño y Datos del proyecto. En los cuadros de resultados, valores al 90 % o más de su límite en ámbar y doble clic para abrir la ficha del circuito o del tablero. Circuitos de departamentos y de pisos editables en su ficha y longitud del alimentador en la ficha del tablero. Reservas agrupadas en el explorador y panel Propiedades cerrado por defecto. El cálculo no cambia."
  ],
  [
    "v2.9",
    "Trabajo en ventanas: Datos del proyecto (proyecto, suministro, vivienda o edificio, salidas y pisos o departamentos), Parámetros de diseño (todos los criterios en pestañas, con su norma), Editor de cargas (lista de cargas, botones rápidos con las cargas típicas y vista previa del circuito mientras se escribe), Ficha del tablero (alimentador, barras, circuitos y equipos adicionales) y una Ficha del circuito más compacta, con vista previa en todas sus pestañas. Edificio multifamiliar: las cargas especiales de cada departamento se ingresan una por equipo, como en la vivienda, y cada una tiene su circuito (dos duchas son dos circuitos); los proyectos guardados se convierten solos y la máxima demanda usa el mismo criterio de la Regla 050-202. La fase de cada circuito monofásico se puede fijar (R, S o T) desde el panel, la ficha o el editor; por defecto la asigna el balance de fases. Iluminación de emergencia entre las cargas comunes típicas. Cinta ordenada: un botón principal por grupo, menús ▾ solo donde ahorran pasos e íconos en azul marino y cobre. Globo de ayuda más discreto y cuadro de conductores sin «Auto» repetido."
  ],
  [
    "v2.8",
    "Cuadro de conductores (Resultados › Cuadro de conductores): todos los alimentadores y circuitos en una tabla, con la sección automática (la menor que cumple capacidad y caída de tensión) y la opción de elegir una de las tres siguientes; el cálculo nunca acepta una menor y avisa las secciones mayores como recomendación. Ficha del circuito (doble clic en un circuito o Resultados › Ficha del circuito): pestañas Carga, Conductor, Protección y Caída de tensión, con ▲▼ para recorrer los circuitos y los datos de la carga editables con Aceptar, Cancelar y Aplicar. Las dos son ventanas de escritorio que se mueven, se redimensionan y recuerdan su tamaño. Equipos adicionales del tablero (DPS, relé de tensión, medidor y contactor con reloj) en el unifilar, el metrado y la memoria, y botón de videovigilancia (CCTV). Menús desplegables en la cinta para elegir datos y agregar cargas, DXF para AutoCAD en Proyecto › Exportar y calculadoras en Herramientas. Ayuda del aislamiento según la temperatura del fabricante. Globo de ayuda más discreto, que solo aparece cuando aporta. Sin elecciones en el cuadro de conductores, el cálculo no cambia."
  ],
  [
    "v2.7",
    "Acceso con cuenta: pantalla de ingreso con Google o con correo y contraseña, recuperación de contraseña, solicitud de cuenta con aprobación del administrador y sección Administración para aprobar, rechazar o desactivar cuentas. Menú de la cuenta con cierre de sesión en la barra superior, con la foto de la cuenta de Google o la inicial del nombre. Al iniciar sesión, la plataforma se abre en Inicio y muestra la bienvenida, con «Continuar» y el último proyecto del usuario. La ayuda de datos y botones aparece en un globo con la letra y la escala de la plataforma. Ajustes queda solo con el tema y el espacio de trabajo. El cálculo no cambia."
  ],
  [
    "v2.6",
    "Mano de arrastre: sobre el diagrama unifilar o con zoom, un clic sostenido desplaza el contenido en cualquier dirección. El Resumen del proyecto del panel Propiedades se pliega con un clic en su título para dar todo el espacio al formulario. Nuevo diseño de la plataforma: barra superior negra con el logotipo, menú lateral y el Centro de ingeniería como Inicio, con contadores y tarjetas de los proyectos guardados (dibujo según el tipo, avance según los datos pendientes, estado del último cálculo y máxima demanda), base normativa, accesos rápidos a las herramientas y la frase de Nikola Tesla. Nueva sección Acerca de con el propósito de la plataforma, el creador, cómo funciona y el alcance. El cálculo no cambia."
  ],
  [
    "v2.5",
    "Observaciones de las pruebas en obra. Zoom en el panel central de resultados (botones − / 100 % / +, Ctrl + rueda del mouse y arrastre), para revisar el diagrama unifilar en detalle. Tomacorrientes de otra potencia para casos excepcionales, por piso o por tipo de departamento, y botones en Pisos y tableros para agregar luminarias y tomacorrientes de otra potencia en los pisos superiores. Área libre no techada con carga unitaria editable (5 W/m² por defecto, criterio del proyectista), que se suma a la máxima demanda. Las luminarias de menos de 100 W (LED) ya no se marcan como observación. La ayuda de cada dato aparece al pasar el cursor, sin el círculo (i). Íconos de Exportar iguales en todas las pestañas de la cinta. El manual explica con más detalle la fórmula de caída de tensión, la corriente que usa y cómo se elige la sección."
  ],
  [
    "v2.4",
    "Luminarias de distintas potencias: en Salidas (y en Departamentos para edificios) se agregan con «+ Luminarias de otra potencia». Los circuitos de alumbrado se arman con la potencia real de cada salida, con un máximo de 12 salidas por circuito. Oficinas, locales comerciales y otros usos de la Tabla 14 (Regla 050-210): se eligen en Proyecto → Tipo de edificación → Uso, con máxima demanda por W/m² y factor de demanda, área según dimensiones exteriores y 250 VA por tomacorriente como criterio de diseño. También escuelas (Regla 050-204, con área de aulas), hospitales (050-206, con área de alta intensidad) y hoteles (050-208). Opción «Comercial y otros usos» al crear un proyecto y ejemplo de oficina. Cinta de opciones con más accesos directos en todas sus pestañas (edificación, cargas, cada parámetro, resultados con recomendaciones pendientes, rótulo, ejemplos, ajustes y atajos); la cinta queda siempre visible.",
    "Tamaño del espacio de trabajo: por defecto se muestra al 80 % para ver más datos a la vez; se cambia a 90 % o 100 % en Ajustes. Si el navegador se aleja (Ctrl + −), las páginas de inicio se compensan para no quedar diminutas en el centro."
  ],
  [
    "v2.3",
    "Dimensionamiento más ajustado: el método de instalación por defecto pasa a B1, tubo empotrado en ladrillo o concreto (CNE-U, Tabla 4, ítem 59), y la reserva de los alimentadores de vivienda se elige en Parámetros → Protección: 25 % para ampliaciones (por defecto) o 0 %, el mínimo de la norma (Reglas 050-200(3) y 050-202(2)). En la vivienda de ejemplo el alimentador pasa de 2-1×25 mm² a 2-1×16 mm² con ITM de 63 A (o 2-1×10 mm² con 50 A sin reserva). Nuevas recomendaciones de diseño: avisan de posibles sobredimensionamientos o criterios ajustados, se aceptan con un clic y las aceptadas constan en el expediente. Índices con enlaces en el manual y en el expediente técnico. Los proyectos guardados conservan el método que tenían."
  ],
  [
    "v2.2",
    "Nueva imagen grafito y oro con tema Claro o Gris, elegible en la nueva pestaña Ajustes. Pestaña Novedades, cabecera más compacta con accesos a nuevo proyecto y ejemplo, cinta de opciones más compacta y plegable (Ctrl + F1), manual de usuario y referencia técnica en PDF, y calculadora de caída de tensión con 6 mm² por defecto."
  ],
  [
    "v2.1",
    "Vivienda unifamiliar por pisos: un tablero de distribución por piso con su alimentador calculado según la Regla 050-200 y cargas especiales asignables a cada tablero. Expediente técnico completo en PDF (memoria descriptiva, memoria de cálculo con desarrollo paso a paso, especificaciones, metrado, plano y pruebas) en estilo formal o a color. Campo N.° CIP, logo en el Excel, el unifilar y el DXF, paneles laterales ajustables y cálculo automático o manual (F9)."
  ],
  [
    "v2.0",
    "Nueva aplicación de proyecto estilo software de ingeniería: cinta de opciones, explorador del proyecto, propiedades editables por circuito, resultados y unifilar en vivo, barra de estado, deshacer/rehacer, potencias típicas por defecto y ayudas (i) en cada dato."
  ],
  [
    "v1.7",
    "Proyectos nuevos en blanco con aviso de datos pendientes y ejemplos en gris; portada con diagrama de muestra fijo, cabecera compacta y expediente en una sola sección."
  ],
  [
    "v1.6",
    "Nueva portada de Inicio con diagrama de muestra, bienvenida en la primera visita y proyectos reunidos en su pestaña. Puesta a tierra con varias varillas unificada en web, Excel y herramientas. Unifilar DXF en milímetros por lámina (A4 a A1), con capas, estilos de texto y tres esquemas de color."
  ],
  [
    "v1.5",
    "Proyectos de ejemplo, impresión de resultados en PDF, unifilar en DXF para AutoCAD y vista previa al compartir. Excel con decimales con punto y textos completos; aviso normativo; Ajustes y Herramientas ordenados."
  ],
  ["v1.4", "Pestañas Guía y Soporte, estado del proyecto en la cabecera y marca JMG Projects & Energy."],
  ["v1.3", "Vistas de resultados, metrado en web y Excel, pestañas Proyectos y Herramientas, ícono de la plataforma."],
  [
    "v1.2",
    "Balance de fases óptimo con fijación manual, guardar y abrir proyectos, circuitos de motores, resistividad a temperatura de operación."
  ],
  ["v1.1", "Diagrama unifilar automático en la web y en el Excel."],
  ["v1.0", "Cálculo según CNE-Utilización, EM.010 y Norma DGE con memoria de cálculo en Excel."]
];
const DOCS = [
  "Certificado de factibilidad de suministro (multifamiliar u otros usos).",
  "Memoria descriptiva: ubicación, áreas libre y techada, proyectista, normativa y criterios técnicos.",
  "Memoria de cálculo: circuitos, iluminación, protecciones, puesta a tierra y otras cargas.",
  "Especificaciones técnicas de materiales y equipos (NTP, IEC).",
  "Planos: esquema unifilar con potencia instalada, demanda máxima, potencia contratada, tensión, capacidad de ruptura y número de fases.",
  "Cuadro de cargas, plano de puesta a tierra y detalles del banco de medidores.",
  "Rótulo con nombre, registro CIP, firma y sello del ingeniero responsable.",
  "Pruebas técnicas al finalizar la obra."
];
