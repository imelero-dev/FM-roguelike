/* ============================================================
   FORMATIONS — formaciones con slots espaciales (roles) y
   tácticas de equipo. Las posiciones de los slots son la base
   defensiva del bloque: el motor las desplaza según posesión,
   zona del balón, mentalidad y amplitud, así que el choque de
   formaciones (superioridades por zona) emerge de la geometría
   y además se refuerza con modificadores explícitos por zona.

   slot: { pos, rol, x (profundidad 0-1 hacia la portería rival),
           y (0-1 de banda a banda) }
   Roles: GK, CB (central), FB (lateral), WB (carrilero),
          DM (pivote), CM (interior), WM (medio banda),
          AM (mediapunta), W (extremo), ST (delantero)
   ============================================================ */

var Formations = (function () {

  function s(pos, rol, x, y) { return { pos: pos, rol: rol, x: x, y: y }; }

  var DEFS = {
    '4-3-3': {
      nombre: '4-3-3',
      desc: 'Extremos abiertos y tridente arriba. Domina las bandas en ataque; el centro del campo puede quedar justo.',
      slots: [
        s('POR', 'GK', 0.045, 0.5),
        s('DEF', 'FB', 0.175, 0.11), s('DEF', 'CB', 0.15, 0.36), s('DEF', 'CB', 0.15, 0.64), s('DEF', 'FB', 0.175, 0.89),
        s('MED', 'CM', 0.36, 0.28), s('MED', 'DM', 0.30, 0.5), s('MED', 'CM', 0.36, 0.72),
        s('DEL', 'W', 0.60, 0.13), s('DEL', 'ST', 0.65, 0.5), s('DEL', 'W', 0.60, 0.87)
      ]
    },
    '4-4-2': {
      nombre: '4-4-2',
      desc: 'Dos líneas de cuatro: sólido, directo y fácil de mantener. Puede verse superado en el centro contra tres medios.',
      slots: [
        s('POR', 'GK', 0.045, 0.5),
        s('DEF', 'FB', 0.175, 0.11), s('DEF', 'CB', 0.15, 0.36), s('DEF', 'CB', 0.15, 0.64), s('DEF', 'FB', 0.175, 0.89),
        s('MED', 'WM', 0.40, 0.10), s('MED', 'CM', 0.37, 0.37), s('MED', 'CM', 0.37, 0.63), s('MED', 'WM', 0.40, 0.90),
        s('DEL', 'ST', 0.63, 0.38), s('DEL', 'ST', 0.63, 0.62)
      ]
    },
    '4-2-3-1': {
      nombre: '4-2-3-1',
      desc: 'Doble pivote y mediapunta entre líneas. Control del centro y equilibrio; el delantero puede quedarse solo.',
      slots: [
        s('POR', 'GK', 0.045, 0.5),
        s('DEF', 'FB', 0.175, 0.11), s('DEF', 'CB', 0.15, 0.36), s('DEF', 'CB', 0.15, 0.64), s('DEF', 'FB', 0.175, 0.89),
        s('MED', 'DM', 0.29, 0.38), s('MED', 'DM', 0.29, 0.62),
        s('MED', 'W', 0.47, 0.13), s('MED', 'AM', 0.46, 0.5), s('MED', 'W', 0.47, 0.87),
        s('DEL', 'ST', 0.65, 0.5)
      ]
    },
    '3-5-2': {
      nombre: '3-5-2',
      desc: 'Cinco en el medio: superioridad interior y carrileros que dan amplitud. Sufre contra extremos rápidos.',
      slots: [
        s('POR', 'GK', 0.045, 0.5),
        s('DEF', 'CB', 0.155, 0.25), s('DEF', 'CB', 0.14, 0.5), s('DEF', 'CB', 0.155, 0.75),
        s('MED', 'WB', 0.33, 0.07), s('MED', 'CM', 0.37, 0.32), s('MED', 'DM', 0.30, 0.5), s('MED', 'CM', 0.37, 0.68), s('MED', 'WB', 0.33, 0.93),
        s('DEL', 'ST', 0.63, 0.40), s('DEL', 'ST', 0.63, 0.60)
      ]
    },
    '3-4-3': {
      nombre: '3-4-3',
      desc: 'Muy ofensivo: tres arriba y medios abiertos. Genera muchísimo, pero deja espacios a la espalda.',
      slots: [
        s('POR', 'GK', 0.045, 0.5),
        s('DEF', 'CB', 0.155, 0.25), s('DEF', 'CB', 0.14, 0.5), s('DEF', 'CB', 0.155, 0.75),
        s('MED', 'WM', 0.37, 0.09), s('MED', 'CM', 0.35, 0.37), s('MED', 'CM', 0.35, 0.63), s('MED', 'WM', 0.37, 0.91),
        s('DEL', 'W', 0.61, 0.15), s('DEL', 'ST', 0.65, 0.5), s('DEL', 'W', 0.61, 0.85)
      ]
    },
    '5-3-2': {
      nombre: '5-3-2',
      desc: 'Cerrojo con cinco atrás y dos puntas al contragolpe. Muy difícil de batir, poca producción ofensiva.',
      slots: [
        s('POR', 'GK', 0.045, 0.5),
        s('DEF', 'WB', 0.19, 0.07), s('DEF', 'CB', 0.145, 0.28), s('DEF', 'CB', 0.13, 0.5), s('DEF', 'CB', 0.145, 0.72), s('DEF', 'WB', 0.19, 0.93),
        s('MED', 'CM', 0.35, 0.30), s('MED', 'DM', 0.32, 0.5), s('MED', 'CM', 0.35, 0.70),
        s('DEL', 'ST', 0.60, 0.40), s('DEL', 'ST', 0.60, 0.60)
      ]
    },
    '4-1-4-1': {
      nombre: '4-1-4-1',
      desc: 'Bloque medio compacto con pivote posicional. Equilibrado y pesado de atacar; necesita un punta que aguante solo.',
      slots: [
        s('POR', 'GK', 0.045, 0.5),
        s('DEF', 'FB', 0.175, 0.11), s('DEF', 'CB', 0.15, 0.36), s('DEF', 'CB', 0.15, 0.64), s('DEF', 'FB', 0.175, 0.89),
        s('MED', 'DM', 0.27, 0.5),
        s('MED', 'WM', 0.42, 0.10), s('MED', 'CM', 0.40, 0.37), s('MED', 'CM', 0.40, 0.63), s('MED', 'WM', 0.42, 0.90),
        s('DEL', 'ST', 0.65, 0.5)
      ]
    }
  };

  var LISTA = Object.keys(DEFS);

  function req(key) {
    var r = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    DEFS[key].slots.forEach(function (sl) { r[sl.pos]++; });
    return r;
  }

  // ---------- tácticas ----------
  var MENTALIDADES = [
    { v: -1, nombre: 'Defensiva', desc: 'Bloque bajo, pocos riesgos. Cede el balón y cierra espacios.' },
    { v: 0, nombre: 'Equilibrada', desc: 'Bloque medio, riesgo moderado.' },
    { v: 1, nombre: 'Ofensiva', desc: 'Líneas altas y más hombres al ataque. Deja espacios atrás.' }
  ];
  var PRESIONES = [
    { v: 0, nombre: 'Baja', desc: 'Repliegue: solo presiona cerca del área. Ahorra energía.' },
    { v: 1, nombre: 'Media', desc: 'Presión en campo propio.' },
    { v: 2, nombre: 'Alta', desc: 'Asfixia al portador en todo el campo. Roba arriba, agota a los tuyos.' }
  ];
  var ESTILOS = [
    { v: 'corto', nombre: 'Combinativo', desc: 'Pases cortos y control. Necesita buen Pase/Técnica; vulnerable a la presión alta.' },
    { v: 'directo', nombre: 'Directo', desc: 'Balones largos a los puntas. Salta la presión, pierde posesión.' }
  ];
  var AMPLITUDES = [
    { v: 'estrecha', nombre: 'Estrecha', desc: 'Junta a los tuyos por dentro: más apoyo, menos banda.' },
    { v: 'normal', nombre: 'Normal', desc: 'Ocupación estándar del campo.' },
    { v: 'ancha', nombre: 'Ancha', desc: 'Estira el campo: abre huecos por dentro, aísla a los extremos.' }
  ];

  function tacticaBase() {
    return { formacion: '4-3-3', mentalidad: 0, presion: 1, estilo: 'corto', amplitud: 'normal' };
  }

  // Preset coherente para un equipo IA según su nivel
  function tacticaIA(rating) {
    var t;
    if (rating >= 72) {
      t = { formacion: RNG.pick(['4-3-3', '4-2-3-1', '3-5-2', '3-4-3']), mentalidad: RNG.pick([0, 1]), presion: RNG.pick([1, 2]), estilo: RNG.pick(['corto', 'corto', 'directo']), amplitud: RNG.pick(['normal', 'ancha']) };
    } else if (rating >= 63) {
      t = { formacion: RNG.pick(['4-4-2', '4-3-3', '4-1-4-1', '4-2-3-1']), mentalidad: 0, presion: 1, estilo: RNG.pick(['corto', 'directo']), amplitud: 'normal' };
    } else {
      t = { formacion: RNG.pick(['5-3-2', '4-4-2', '4-1-4-1']), mentalidad: RNG.pick([-1, 0]), presion: RNG.pick([0, 1]), estilo: 'directo', amplitud: RNG.pick(['estrecha', 'normal']) };
    }
    return t;
  }

  // ---------- análisis de enfrentamiento ----------
  // Presencia por zonas de una formación (sin contar al portero)
  function presencia(key) {
    var p = { centro: 0, banda: 0, medios: 0, atras: 0, arriba: 0 };
    DEFS[key].slots.forEach(function (sl) {
      if (sl.rol === 'GK') return;
      var ancho = sl.y < 0.24 || sl.y > 0.76;
      if (ancho) p.banda++; else p.centro++;
      if (sl.x >= 0.25 && sl.x <= 0.52) p.medios++;
      if (sl.pos === 'DEF') p.atras++;
      if (sl.pos === 'DEL') p.arriba++;
    });
    return p;
  }

  // Ventajas numéricas de A sobre B (positivo = ventaja de A).
  // El motor las usa como modificadores suaves por zona.
  function ventajas(formA, formB) {
    var a = presencia(formA), b = presencia(formB);
    return {
      centro: Math.max(-3, Math.min(3, a.medios - b.medios)),
      banda: Math.max(-3, Math.min(3, a.banda - b.banda))
    };
  }

  // Consejos de scouting legibles para el jugador
  function consejos(miForm, rival) {
    var v = ventajas(miForm, rival.formacion);
    var out = [];
    if (v.centro > 0) out.push('✅ Tu ' + miForm + ' tiene superioridad en el centro contra su ' + rival.formacion + ': dominarás la posesión interior.');
    if (v.centro < 0) out.push('⚠️ Su ' + rival.formacion + ' te supera en el medio: te costará circular por dentro.');
    if (v.banda > 0) out.push('✅ Llegas con más gente a las bandas: los centros y extremos harán daño.');
    if (v.banda < 0) out.push('⚠️ Te doblarán por fuera: vigila los centros laterales.');
    if (rival.presion === 2) out.push('🔥 Presionan muy arriba: el estilo Directo salta su presión (o castígales con Técnica alta).');
    if (rival.presion === 0) out.push('💤 Presionan poco: el juego Combinativo te dará el balón sin riesgo.');
    if (rival.mentalidad === 1) out.push('⚔️ Salen a por el partido: dejarán espacios a la espalda para tus rápidos.');
    if (rival.mentalidad === -1) out.push('🧱 Se encierran atrás: necesitarás paciencia y tiro lejano.');
    if (!out.length) out.push('Enfrentamiento parejo: decidirán los jugadores.');
    return out;
  }

  function etiquetaTactica(t) {
    var m = MENTALIDADES.filter(function (x) { return x.v === t.mentalidad; })[0];
    var p = PRESIONES.filter(function (x) { return x.v === t.presion; })[0];
    var e = ESTILOS.filter(function (x) { return x.v === t.estilo; })[0];
    return t.formacion + ' · ' + m.nombre + ' · Presión ' + p.nombre.toLowerCase() + ' · ' + e.nombre;
  }

  return {
    DEFS: DEFS,
    LISTA: LISTA,
    MENTALIDADES: MENTALIDADES,
    PRESIONES: PRESIONES,
    ESTILOS: ESTILOS,
    AMPLITUDES: AMPLITUDES,
    req: req,
    tacticaBase: tacticaBase,
    tacticaIA: tacticaIA,
    presencia: presencia,
    ventajas: ventajas,
    consejos: consejos,
    etiquetaTactica: etiquetaTactica
  };
})();

if (typeof module !== 'undefined') module.exports = Formations;
