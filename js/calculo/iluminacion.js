/* NIVELES DE ILUMINACIÓN (Norma EM.010, 2019, Anexo «Requisitos mínimos de iluminación»)
   Catálogo de los tipos de ambiente de todos los usos del Anexo, además de los de vivienda (PL_AMB, js/calculo/calculo-plano.js),
   y los niveles del proyecto:
   · Cada fila del Anexo es un tipo de ambiente (PL_AMB[k]) con su número de referencia (em), la iluminancia mantenida
     mínima Em (lux) y, como referencia, UGR_L, Uo y Ra. Donde el Anexo no da Em (salón multiuso, museos, quirófano),
     lux es null y el proyectista escribe el suyo.
   · Por defecto, el valor de la norma. El proyectista puede cambiarlo (LUX.v[k]): un valor distinto del de la norma
     queda como «criterio del proyectista»; uno menor que el mínimo de la EM.010 se avisa («bajo norma»).
   · Ambientes propios para lo que el Anexo no tiene (pista de baile, cabina de DJ…): LUX.prop, con clave «u1», «u2»…,
     siempre «criterio del proyectista».
   · LUX se guarda en el proyecto; los valores del último cambio se recuerdan en este navegador para los proyectos
     nuevos (luxRecordado).
   La Sección 4 (Industria) del Anexo aún no está en el catálogo.
   Las claves de las filas (edu1, sal3…) no deben cambiar de orden: se guardan en los proyectos. Filas nuevas, al final
   de su grupo con una clave nueva. */
const EM010 = [
  {
    g: "viv",
    n: "1. Vivienda",
    sub: [
      {
        ref: "1.1",
        s: "Zona privada",
        f: [["v1", "Baño (zona de espejo)", 500]]
      },
      {
        ref: "1.2",
        s: "Zonas comunes",
        f: [
          ["v2", "Vestíbulos de entrada", 100, 22, null, 60],
          ["v3", "Salas de estar (pública)", 200, 22, null, 80],
          ["v4", "Ascensores, montacargas", 100, 25, 0.4, 40, "Frente al montacargas, Em = 200 lx como mínimo"],
          ["v5", "Rampas, andenes, patios de carga", 150, 25, 0.4, 40]
        ]
      }
    ]
  },
  {
    g: "edu",
    n: "2. Educación",
    sub: [
      {
        ref: "2",
        s: "",
        f: [
          ["edu1", "Sala de juegos", 300, 22, 0.4, 80],
          ["edu2", "Guarderías", 300, 22, 0.4, 80],
          ["edu3", "Sala de manualidades", 300, 19, 0.6, 80],
          ["edu4", "Aulas de profesores", 300, 19, 0.6, 80, "La iluminación debe ser controlable"],
          [
            "edu5",
            "Aulas para clases nocturnas y de educación de adultos",
            500,
            19,
            0.6,
            80,
            "La iluminación debe ser controlable"
          ],
          ["edu6", "Salas de lectura", 500, 19, 0.6, 80, "La iluminación debe ser controlable"],
          ["edu7", "Zona de pizarra", 500, 19, 0.7, 80, "Deben evitarse las reflexiones especulares"],
          ["edu8", "Mesa de demostraciones", 500, 19, 0.7, 80, "En salas de lectura 750 lx"],
          ["edu9", "Locales de artes y oficios", 500, 19, 0.6, 80],
          ["edu10", "Locales de artes (en escuelas de arte)", 750, 19, 0.7, 90],
          ["edu11", "Salas de dibujo técnico", 750, 16, 0.7, 80],
          ["edu12", "Locales de prácticas y laboratorios", 500, 19, 0.6, 80],
          ["edu13", "Aulas de manualidades", 500, 19, 0.6, 80],
          ["edu14", "Taller de enseñanza", 500, 19, 0.6, 80],
          ["edu15", "Locales de prácticas de música", 300, 19, 0.6, 80],
          ["edu16", "Locales de prácticas de computación", 300, 19, 0.6, 80],
          ["edu17", "Laboratorio de idiomas", 300, 19, 0.6, 80],
          ["edu18", "Locales y talleres de preparación", 500, 22, 0.6, 80],
          ["edu19", "Vestíbulo de entrada", 200, 22, 0.4, 80],
          ["edu20", "Áreas de circulación, pasillos", 100, 25, 0.4, 80],
          ["edu21", "Escaleras", 150, 25, 0.4, 80],
          ["edu22", "Locales comunes de estudiantes y salas de reuniones", 200, 22, 0.4, 80],
          ["edu23", "Locales de maestros", 300, 19, 0.6, 80],
          ["edu24", "Biblioteca: estanterías", 200, 19, 0.6, 80],
          ["edu25", "Biblioteca: áreas de lectura", 500, 19, 0.6, 80],
          ["edu26", "Almacenes de material de profesores", 100, 25, 0.4, 80],
          ["edu27", "Salas deportivas, gimnasios y piscinas", 300, 22, 0.6, 80],
          ["edu28", "Cocina", 500, 22, 0.6, 80]
        ]
      }
    ]
  },
  {
    g: "sal",
    n: "3. Salud",
    sub: [
      {
        ref: "3.1",
        s: "Salas de uso general",
        f: [
          ["sal1", "Salas de espera", 200, 22, 0.4, 80],
          ["sal2", "Corredores: durante el día", 100, 22, 0.4, 80, "Iluminancia a nivel del suelo"],
          ["sal3", "Corredores: durante la noche", 50, 22, 0.4, 80, "Iluminancia a nivel del suelo"],
          ["sal4", "Ambientes para curaciones", 500, 19, 0.6, 80],
          ["sal5", "Salas para consulta médica", 500, 16, 0.6, 90, "Tcp 4 000 K como mínimo"],
          ["sal6", "Ascensores para personas y visitantes", 100, 22, 0.6, 80, "Iluminancia a nivel del suelo"],
          ["sal7", "Ascensores de servicio y montacargas", 200, 22, 0.6, 80, "Iluminancia a nivel del suelo"]
        ]
      },
      { ref: "3.2", s: "Salas de personal", f: [["sal8", "Oficina del personal", 500, 19, 0.6, 80]] },
      {
        ref: "3.3",
        s: "Salas de guardia, salas de maternidad",
        f: [
          ["sal9", "Iluminación general", 100, 19, 0.4, 80, "Iluminancia a nivel del suelo"],
          ["sal10", "Iluminación para la lectura", 300, 19, 0.7, 80],
          ["sal11", "Exámenes generales", 300, 19, 0.6, 80],
          ["sal12", "Exámenes específicos y tratamiento de maternidad", 1000, 19, 0.7, 90],
          ["sal13", "Iluminación nocturna, iluminación de observación", 5, null, null, 80],
          ["sal14", "Baños y tocadores para pacientes", 200, 22, 0.4, 80]
        ]
      },
      {
        ref: "3.4",
        s: "Salas de exámenes generales",
        f: [
          ["sal15", "Alumbrado general", 500, 19, 0.6, 90, "4 000 K ≤ Tcp ≤ 5 000 K"],
          ["sal16", "Examen y tratamiento", 1000, 19, 0.7, 90]
        ]
      },
      {
        ref: "3.5",
        s: "Salas de examen ocular",
        f: [
          ["sal17", "Alumbrado general", 500, 19, 0.6, 90, "4 000 K ≤ Tcp ≤ 5 000 K"],
          ["sal18", "Exámenes ocular", 1000, null, null, 90],
          ["sal19", "Prueba de lectura y visión cromática con diagrama de visión", 500, 16, 0.7, 90]
        ]
      },
      {
        ref: "3.6",
        s: "Salas de examen auditivo",
        f: [
          ["sal20", "Alumbrado general", 300, 19, 0.6, 80],
          ["sal21", "Examen auditivo", 1000, null, null, 90]
        ]
      },
      {
        ref: "3.7",
        s: "Salas de escáner",
        f: [
          ["sal22", "Alumbrado general", 300, 19, 0.6, 80],
          ["sal23", "Escáneres con aumentadores de imágenes y sistemas de TV", 50, 19, null, 80]
        ]
      },
      {
        ref: "3.8",
        s: "Salas de parto",
        f: [
          ["sal24", "Alumbrado general", 300, 19, 0.6, 90],
          ["sal25", "Examen y tratamiento", 1000, 19, 0.7, 90]
        ]
      },
      {
        ref: "3.8",
        s: "Salas de tratamiento (general)",
        f: [
          ["sal26", "Salas de diálisis", 500, 19, 0.6, 80],
          ["sal27", "Salas de dermatología", 500, 19, 0.6, 90],
          ["sal28", "Salas de endoscopías", 300, 19, 0.6, 80],
          ["sal29", "Salas de enyesar", 500, 19, 0.6, 80],
          ["sal30", "Baños de médicos", 300, 19, 0.6, 80],
          ["sal31", "Masaje y radioterapia", 300, 19, 0.6, 80]
        ]
      },
      {
        ref: "3.9",
        s: "Áreas de operación",
        f: [
          ["sal32", "Salas pre-operatorias y de recuperación", 500, 19, 0.6, 90],
          ["sal33", "Sala de operaciones", 1000, 19, 0.6, 90],
          ["sal34", "Quirófano", null, null, null, null, "Em: 10 000 lx a 100 000 lx"]
        ]
      },
      {
        ref: "3.10",
        s: "Unidad de cuidados intensivos",
        f: [
          ["sal35", "Iluminación general", 100, 19, 0.6, 90, "Iluminancia a nivel del suelo"],
          ["sal36", "Exámenes sencillos", 300, 19, 0.6, 90, "Iluminancia a nivel del suelo"],
          ["sal37", "Exámenes y tratamiento", 1000, 19, 0.7, 90, "Iluminancia a nivel del suelo"],
          ["sal38", "Vigilancia nocturna", 20, 19, null, 90]
        ]
      },
      {
        ref: "3.10",
        s: "Dentistas",
        f: [
          [
            "sal39",
            "Iluminación general",
            500,
            19,
            0.6,
            90,
            "La iluminación debe estar libre de deslumbramiento para el paciente"
          ],
          ["sal40", "En el paciente", 1000, null, 0.7, 90],
          ["sal41", "Quirófano", null, null, null, null, "En la Norma EN ISO 9680 se dan requisitos específicos"],
          [
            "sal42",
            "Maquinado de diente blanco",
            null,
            null,
            null,
            null,
            "En la Norma EN ISO 9680 se dan requisitos específicos"
          ]
        ]
      },
      {
        ref: "3.11",
        s: "Laboratorios y farmacias",
        f: [
          ["sal43", "Alumbrado general", 500, 19, 0.6, 80],
          ["sal44", "Inspección de colores", 1000, 19, 0.7, 90, "6 000 K ≤ Tcp ≤ 6 500 K"]
        ]
      },
      {
        ref: "3.12",
        s: "Salas de descontaminación",
        f: [
          ["sal45", "Salas de esterilización", 300, 22, 0.6, 80],
          ["sal46", "Salas de desinfección", 300, 22, 0.6, 80]
        ]
      },
      {
        ref: "3.13",
        s: "Sala de autopsias y depósitos mortuorios",
        f: [
          ["sal47", "Alumbrado general", 500, 19, 0.6, 90],
          [
            "sal48",
            "Mesa de autopsias y mesa de disección",
            5000,
            null,
            null,
            90,
            "Pueden requerirse valores mayores de 5 000 lx"
          ]
        ]
      }
    ]
  },
  {
    g: "com",
    n: "5. Comercio",
    sub: [
      {
        ref: "5.1",
        s: "Tiendas",
        f: [
          ["com1", "Área de ventas", 500, 22, 0.6, 80],
          ["com2", "Área de (cajas) contadoras", 500, 19, 0.6, 80],
          ["com3", "Mostrador (mesa) de envolver", 500, 19, 0.6, 80]
        ]
      },
      {
        ref: "5.2",
        s: "Áreas comunes",
        f: [
          ["com4", "Vestíbulo de entrada", 100, 22, 0.4, 80, "UGR sólo si es aplicable"],
          ["com5", "Guardarropas", 200, 25, 0.4, 80],
          ["com6", "Salones", 200, 22, 0.4, 80],
          ["com7", "Oficinas de taquillas", 300, 22, 0.6, 80]
        ]
      },
      {
        ref: "5.3",
        s: "Restaurantes y hoteles",
        f: [
          ["com8", "Carpeta de recepción/cajero, mesa de conserje", 300, 22, 0.6, 80],
          ["com9", "Cocina", 500, 22, 0.6, 80, "Debe haber una zona de transición entre cocina y restaurante"],
          [
            "com10",
            "Restaurante, comedor, salón multiuso",
            null,
            null,
            0.6,
            80,
            "El alumbrado debe diseñarse para crear la atmósfera apropiada"
          ],
          ["com11", "Restaurante de autoservicio", 200, 22, 0.4, 80],
          ["com12", "Buffet (comidas frías)", 300, 22, 0.6, 80],
          ["com13", "Salas de conferencias", 500, 19, 0.6, 80, "El alumbrado debe ser controlable"],
          ["com14", "Corredores (pasillos)", 100, 25, 0.4, 80, "Durante la noche son aceptables niveles inferiores"],
          ["com15", "Cantinas, tabernas", 200, 22, 0.4, 80]
        ]
      },
      {
        ref: "5.4",
        s: "Teatros, salas de conciertos, salas de cines",
        f: [
          ["com16", "Teatros y salas de concierto", 300, 22, 0.6, 80],
          ["com17", "Salas multipropósito", 200, 22, 0.6, 80, "Iluminación a nivel del suelo"],
          ["com18", "Locales de ejercicios, vestidores", 200, 22, 0.5, 80],
          ["com19", "Museos (general)", 300, 25, 0.4, 80, "Iluminación a nivel del suelo"]
        ]
      },
      {
        ref: "5.5",
        s: "Ferias, pabellones de exposiciones",
        f: [["com20", "Alumbrado general", 300, 22, 0.4, 80]]
      },
      { ref: "5.6", s: "Peluquerías", f: [["com21", "Trabajo de peluquería", 500, 19, 0.6, 90]] },
      {
        ref: "5.7",
        s: "Fabricación de joyas y relojes",
        f: [
          ["com22", "Trabajo con piedras preciosas", 1500, 16, 0.7, 90, "4 000 K ≤ Tcp ≤ 6 500 K"],
          ["com23", "Manufactura de joyas", 1000, 16, 0.7, 90],
          ["com24", "Fabricación (manual) de relojes", 1500, 16, 0.7, 80],
          ["com25", "Fabricación (automática) de relojes", 500, 19, 0.6, 80]
        ]
      },
      {
        ref: "5.8",
        s: "Lavanderías y limpieza en seco",
        f: [
          ["com26", "Entrada de la ropa, marcado y clasificación", 300, 25, 0.6, 80],
          ["com27", "Lavado (normal) y en seco", 300, 25, 0.6, 80],
          ["com28", "Planchado, calandria (prensado)", 300, 25, 0.6, 80],
          ["com29", "Inspección y arreglos", 750, 19, 0.7, 80]
        ]
      }
    ]
  },
  {
    g: "ofi",
    n: "6. Oficinas",
    sub: [
      {
        ref: "6",
        s: "",
        f: [
          ["ofi1", "Archivo, copia, circulación, etc.", 300, 19, 0.4, 80],
          ["ofi2", "Escritura, mecanografía, lectura, procesamiento de datos", 500, 19, 0.6, 80],
          ["ofi3", "Estación de trabajo CAD", 500, 19, 0.6, 80],
          ["ofi4", "Salas de conferencias y reuniones", 500, 19, 0.6, 80],
          ["ofi5", "Archivos", 200, 25, 0.4, 80]
        ]
      }
    ]
  },
  {
    g: "ser",
    n: "7. Servicios comunales",
    sub: [
      {
        ref: "7.1",
        s: "Museos",
        f: [
          [
            "ser1",
            "Obras exhibidas insensibles a la luz",
            null,
            null,
            null,
            null,
            "La iluminación se debe determinar por los requisitos de presentación"
          ],
          [
            "ser2",
            "Obras exhibidas sensibles a la luz",
            null,
            null,
            null,
            null,
            "La iluminación se debe determinar por los requisitos de presentación; es imprescindible la protección contra la radiación dañina"
          ]
        ]
      },
      {
        ref: "7.2",
        s: "Bibliotecas",
        f: [
          ["ser3", "Estanterías (de libros)", 200, 19, 0.4, 80],
          ["ser4", "Áreas de lectura", 500, 19, 0.6, 80],
          ["ser5", "Mostradores", 500, 19, 0.6, 80]
        ]
      },
      {
        ref: "7.3",
        s: "Templos",
        f: [
          ["ser6", "Nave de iglesia", 100, 25, null, 80],
          ["ser7", "Asientos, altar, púlpito", 300, 22, null, 80]
        ]
      }
    ]
  },
  {
    g: "rec",
    n: "8. Recreación y deportes",
    sub: [
      {
        ref: "8",
        s: "",
        f: [
          ["rec1", "Salas para ejercicios físicos", 300, 22, 0.4, 80],
          [
            "rec2",
            "Vestuarios, salas de lavado, cuartos de baño, servicios",
            200,
            25,
            0.4,
            80,
            "En cada baño individual si está completamente cerrado"
          ]
        ]
      }
    ]
  },
  {
    g: "tra",
    n: "9. Transporte y comunicaciones",
    sub: [
      {
        ref: "9.1",
        s: "Aeropuertos",
        f: [
          ["tra1", "Salones de llegadas y partidas, áreas de recogida de equipaje", 200, 22, 0.4, 80],
          ["tra2", "Áreas de conexión, escaladores (mecánicos), cintas transportadoras", 150, 22, 0.4, 80],
          ["tra3", "Mostradores de información, carpeta de chequear", 500, 19, 0.7, 80],
          [
            "tra4",
            "Aduana y control de pasaportes",
            500,
            19,
            0.7,
            80,
            "Tiene que proporcionarse reconocimiento facial"
          ],
          ["tra5", "Áreas de espera", 200, 22, 0.4, 80],
          ["tra6", "Depósitos de equipajes", 200, 25, 0.4, 60],
          ["tra7", "Áreas de chequeo de seguridad", 300, 19, 0.6, 80],
          ["tra8", "Torre de control de tráfico", 500, 16, 0.6, 80, "La iluminación debe ser regulable"],
          ["tra9", "Hangares de pruebas y reparaciones", 500, 22, 0.6, 80],
          ["tra10", "Área de prueba de máquinas", 500, 22, 0.6, 80],
          ["tra11", "Áreas de medición en hangares", 500, 22, 0.4, 80]
        ]
      },
      {
        ref: "9.2",
        s: "Terrapuertos",
        f: [
          ["tra12", "Andenes completamente cubiertos", 100, null, null, 40, "Iluminancia a nivel del suelo"],
          ["tra13", "Pasos subterráneos de pasajeros", 50, 28, 0.5, 40, "Iluminancia a nivel del suelo"],
          ["tra14", "Sala de taquillas y vestíbulo", 200, 28, 0.5, 40],
          ["tra15", "Oficinas de billetes, de equipaje y de contadores", 300, 19, 0.5, 80],
          ["tra16", "Salas de espera", 200, 22, 0.5, 80],
          ["tra17", "Vestíbulos de entrada, vestíbulos de estación", 200, null, 0.4, 80],
          [
            "tra18",
            "Salas de contadores y máquinas",
            200,
            28,
            0.4,
            60,
            "Los colores de seguridad deben ser reconocibles"
          ],
          ["tra19", "Túneles de acceso", 50, null, 0.4, 20, "Iluminancia a nivel del suelo"],
          ["tra20", "Naves de mantenimiento y servicio", 300, 22, 0.4, 60]
        ]
      }
    ]
  },
  {
    g: "est",
    n: "10. Estacionamientos",
    sub: [
      {
        ref: "10",
        s: "",
        f: [
          ["est1", "Rampas entrada / salida (durante el día)", 300, 25, 0.4, 40, "Iluminancia a nivel del suelo"],
          ["est2", "Rampas entrada / salida (durante la noche)", 75, 25, 0.4, 40, "Iluminancia a nivel del suelo"],
          ["est3", "Calles interiores", 75, 25, 0.4, 40, "Iluminancia a nivel del suelo"],
          ["est4", "Áreas de parqueo", 75, null, 0.4, 40, "Iluminancia a nivel del suelo"],
          ["est5", "Caja", 300, 19, 0.6, 80, "Deben evitarse los reflejos en las ventanas"]
        ]
      }
    ]
  }
];
// Los tipos de vivienda de PL_AMB son del grupo «1. Vivienda»; las filas del Anexo se agregan a PL_AMB
Object.values(PL_AMB).forEach(t => (t.g = t.g || "viv"));
EM010.forEach(G =>
  G.sub.forEach(S =>
    S.f.forEach(([k, n, lux, ugr = null, uo = null, ra = null, nota = ""]) => {
      PL_AMB[k] = {
        n: S.s && G.g !== "viv" ? `${S.s} · ${n}` : n,
        re: null,
        lux,
        em: S.ref,
        cne: "",
        g: G.g,
        ugr,
        uo,
        ra,
        nota
      };
    })
  )
);
// Grupos de tipos de ambiente, en el orden del Anexo (para las listas)
const AMB_GRUPOS = EM010.map(G => [G.g, G.n]);

/* ---------- Niveles del proyecto ---------- */
const luxVacio = () => ({ v: {}, prop: [] });
let LUX = luxVacio();
const LUX_MAX = 100000;
// Niveles válidos (al abrir o importar un proyecto): números de 0 a LUX_MAX lx; hasta 100 ambientes propios
function luxValido(o) {
  const r = luxVacio(),
    num = x => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= LUX_MAX;
  if (!o || typeof o !== "object") return r;
  if (Array.isArray(o.prop))
    o.prop.slice(0, 100).forEach(p => {
      if (!p || typeof p !== "object" || !/^u\d{1,3}$/.test(p.k) || r.prop.some(q => q.k === p.k)) return;
      r.prop.push({
        k: p.k,
        n: String(p.n || "Ambiente propio")
          .replace(/[<>]/g, "")
          .trim()
          .slice(0, 60),
        lux: num(p.lux) ? p.lux : null
      });
    });
  if (o.v && typeof o.v === "object")
    Object.entries(o.v).forEach(([k, x]) => {
      if (Object.hasOwn(PL_AMB, k) && num(x)) r.v[k] = x;
    });
  return r;
}
// Clave de tipo de ambiente válida: de la norma o propia del proyecto
const ambValido = k => typeof k === "string" && (Object.hasOwn(PL_AMB, k) || LUX.prop.some(p => p.k === k));
/* Tipo de ambiente con el nivel del proyecto: n, em, cne, lux (el del proyecto), luxN (el de la norma), est:
   «norma», «criterio» (distinto de la norma o sin valor en ella), «bajo» (menor que el mínimo de la EM.010) o «sin»
   (sin valor) */
function ambTipo(k) {
  if (!k) return null;
  const p = LUX.prop.find(q => q.k === k);
  if (p)
    return {
      n: p.n,
      em: "",
      cne: "",
      g: "prop",
      luxN: null,
      lux: p.lux,
      propio: true,
      est: p.lux == null ? "sin" : "criterio"
    };
  const t = PL_AMB[k];
  if (!t) return null;
  const lux = Object.hasOwn(LUX.v, k) ? LUX.v[k] : t.lux;
  return {
    ...t,
    luxN: t.lux,
    lux,
    est: lux == null ? "sin" : t.lux == null || lux > t.lux ? "criterio" : lux < t.lux ? "bajo" : "norma"
  };
}
// Texto corto del estado de un nivel
const LUX_EST = { norma: "Norma", criterio: "Criterio", bajo: "Bajo norma", sin: "Sin valor" };

// Valores del último cambio en este navegador, para los proyectos nuevos
const LUX_KEY = BETA ? "jmg-electric-beta-lux" : "jmg-electric-lux";
function luxRecordado() {
  try {
    return luxValido(JSON.parse(localStorage.getItem(LUX_KEY) || "null"));
  } catch (e) {
    return luxVacio();
  }
}
function luxRecordar() {
  try {
    localStorage.setItem(LUX_KEY, JSON.stringify(LUX));
  } catch (e) {}
}

/* ---------- Celda del nivel (ventana Ambientes y propiedades del área) ---------- */
// Nivel de un tipo de ambiente para mostrar: lux y si es de la norma, criterio o bajo norma
function luxCelda(t) {
  if (!t) return "—";
  if (t.lux == null)
    return `<em class="lux-sin" title="${esc(t.nota || "La EM.010 no da un valor")}">sin valor: escríbalo en «Niveles de iluminación»</em>`;
  const ref = t.em ? `EM.010 ${t.em}` : "";
  return t.est === "norma"
    ? `${fmt(t.lux, 0)} lx <em>${ref}</em>`
    : t.est === "bajo"
      ? `<b class="lux-bajo" title="Por debajo del mínimo de la EM.010">${fmt(t.lux, 0)} lx</b> <em>bajo norma: mín. ${fmt(t.luxN, 0)} lx (${t.em})</em>`
      : `${fmt(t.lux, 0)} lx <em class="lux-crit">criterio${t.luxN != null ? ` · norma ${fmt(t.luxN, 0)} lx (${t.em})` : ""}</em>`;
}
