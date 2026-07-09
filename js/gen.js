/* ============================================================
   GEN — generación procedural: nombres, equipos, cartas, staff
   ============================================================ */

var RNG = {
  f: function () { return Math.random(); },
  int: function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
  pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance: function (p) { return Math.random() < p; },
  shuffle: function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  },
  weighted: function (entries) {
    // entries: [{v: valor, w: peso}]
    var total = entries.reduce(function (s, e) { return s + e.w; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < entries.length; i++) {
      r -= entries[i].w;
      if (r <= 0) return entries[i].v;
    }
    return entries[entries.length - 1].v;
  }
};

var Gen = (function () {
  var NOMBRES = ['Iker', 'Unai', 'Mateo', 'Hugo', 'Leo', 'Dani', 'Pau', 'Marc', 'Álex', 'Bruno',
    'Adri', 'Nico', 'Iván', 'Rubén', 'Sergi', 'Joel', 'Aitor', 'Gorka', 'Txema', 'Biel',
    'Yeray', 'Isco', 'Keko', 'Rafinha', 'Edu', 'Fran', 'Curro', 'Chema', 'Lucho', 'Pipo'];
  var APELLIDOS = ['Valverde', 'Sarabia', 'Mendieta', 'Otxoa', 'Ferrán', 'Cazorla', 'Bermejo', 'Duarte',
    'Escudero', 'Fontán', 'Guridi', 'Herrezuelo', 'Ibarra', 'Juarros', 'Lasarte', 'Malagón',
    'Novoa', 'Ordóñez', 'Pelegrín', 'Quintanilla', 'Recuenco', 'Salvatierra', 'Trigueros',
    'Urdiales', 'Vallecas', 'Zubiaur', 'Baltanás', 'Carmona', 'Deusto', 'Espinar'];
  var PREFIJOS_EQUIPO = ['Atlético', 'Real', 'CD', 'UD', 'Racing', 'Sporting', 'Deportivo', 'CF'];
  var CIUDADES = ['Valdemora', 'Montefrío', 'Peñablanca', 'Riofrío', 'Torrealta', 'Salinas del Rey',
    'Castrovivo', 'Miraluna', 'Fuentelsol', 'Bahía Norte', 'Cerro Verde', 'Puertolargo',
    'Vega Real', 'Lagunilla', 'Roquedal', 'Altosierra'];
  var COLORES = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xecf0f1, 0xd35400, 0x34495e];

  var TAGS = ['Cantera', 'Galáctico', 'Físico', 'Técnico'];
  var POSICIONES = ['POR', 'DEF', 'MED', 'DEL'];

  var RAREZAS = {
    comun:      { nombre: 'Común',      color: '#8a919e', statMin: 45, statMax: 66, habMax: 1, precio: 60,  salario: 4 },
    rara:       { nombre: 'Rara',       color: '#3b82f6', statMin: 58, statMax: 76, habMax: 1, precio: 130, salario: 8 },
    epica:      { nombre: 'Épica',      color: '#a855f7', statMin: 68, statMax: 88, habMax: 2, precio: 280, salario: 15 },
    legendaria: { nombre: 'Legendaria', color: '#f59e0b', statMin: 80, statMax: 99, habMax: 2, precio: 520, salario: 25 }
  };

  var HABILIDADES = {
    clutch:        { nombre: 'Clutch',        icono: '⏱', desc: '+20% a sus stats a partir del minuto 75' },
    muro:          { nombre: 'Muro',          icono: '🧱', desc: '-15% prob. de gol rival en su zona (DEF/POR)', pos: ['DEF', 'POR'] },
    killer:        { nombre: 'Killer',        icono: '🎯', desc: '+25% conversión cuando remata', pos: ['DEL', 'MED'] },
    motor:         { nombre: 'Motor',         icono: '⚙️', desc: '+10% pase a todo el equipo si juega de MED', pos: ['MED'] },
    capitan:       { nombre: 'Capitán',       icono: '🎖', desc: '+4 a todos los stats del equipo si está alineado' },
    velocista:     { nombre: 'Velocista',     icono: '💨', desc: '+8% prob. de avance del equipo' },
    cerrojo:       { nombre: 'Cerrojo',       icono: '🔒', desc: '-12% prob. de gol rival si juega de POR', pos: ['POR'] },
    francotirador: { nombre: 'Francotirador', icono: '🏹', desc: '+15% prob. de generar ocasión', pos: ['DEL', 'MED'] },
    fajador:       { nombre: 'Fajador',       icono: '🛡', desc: '+12 a todos sus stats en partidos jefe' },
    estrella:      { nombre: 'Estrella',      icono: '⭐', desc: '+10 ataque si es el máximo atacante del once', pos: ['DEL', 'MED'] }
  };

  var idSeq = 1;
  function nextId() { return 'c' + (idSeq++); }

  function nombreJugador() {
    return RNG.pick(NOMBRES) + ' ' + RNG.pick(APELLIDOS);
  }

  function habilidadesPara(pos, rareza) {
    var max = RAREZAS[rareza].habMax;
    var probs = { comun: 0.3, rara: 0.65, epica: 0.9, legendaria: 1 };
    var result = [];
    var pool = Object.keys(HABILIDADES).filter(function (k) {
      var h = HABILIDADES[k];
      return !h.pos || h.pos.indexOf(pos) >= 0;
    });
    var n = 0;
    if (RNG.chance(probs[rareza])) n = 1;
    if (max >= 2 && RNG.chance(rareza === 'legendaria' ? 0.6 : 0.35)) n = 2;
    pool = RNG.shuffle(pool);
    for (var i = 0; i < n && i < pool.length; i++) result.push(pool[i]);
    return result;
  }

  // stat sesgado según posición: la stat principal es más alta
  function statsPara(pos, rareza) {
    var r = RAREZAS[rareza];
    function roll(bias) {
      var v = RNG.int(r.statMin, r.statMax) + (bias || 0);
      return Math.max(30, Math.min(99, v));
    }
    var s = { atq: roll(-8), def: roll(-8), pas: roll(-4), vel: roll(0) };
    if (pos === 'POR') { s.def = roll(8); s.atq = Math.max(20, roll(-25)); }
    if (pos === 'DEF') { s.def = roll(8); s.atq = roll(-12); }
    if (pos === 'MED') { s.pas = roll(8); }
    if (pos === 'DEL') { s.atq = roll(8); s.def = roll(-14); }
    return s;
  }

  function tagPara(rareza) {
    if (rareza === 'legendaria' || rareza === 'epica') {
      return RNG.weighted([{ v: 'Galáctico', w: 4 }, { v: 'Técnico', w: 2 }, { v: 'Físico', w: 2 }, { v: 'Cantera', w: 1 }]);
    }
    return RNG.weighted([{ v: 'Cantera', w: 4 }, { v: 'Físico', w: 3 }, { v: 'Técnico', w: 3 }, { v: 'Galáctico', w: 1 }]);
  }

  function cartaJugador(pos, rareza) {
    pos = pos || RNG.pick(POSICIONES);
    rareza = rareza || 'comun';
    var stats = statsPara(pos, rareza);
    var media = Math.round((stats.atq + stats.def + stats.pas + stats.vel) / 4);
    return {
      id: nextId(),
      type: 'player',
      nombre: nombreJugador(),
      pos: pos,
      rareza: rareza,
      tag: tagPara(rareza),
      stats: stats,
      media: media,
      habilidades: habilidadesPara(pos, rareza),
      salario: RAREZAS[rareza].salario,
      valorBase: Math.round(RAREZAS[rareza].precio * (0.8 + (media - RAREZAS[rareza].statMin) / 60)),
      lesion: 0
    };
  }

  var STAFF_DEFS = [
    { key: 'ojeador',     nombre: 'Ojeador',      icono: '🔭', desc: '+1 opción en cada drop de cartas post-partido', salario: 10, precio: 150 },
    { key: 'preparador',  nombre: 'Preparador',   icono: '⛑', desc: '-50% duración de las lesiones', salario: 8,  precio: 120 },
    { key: 'agente',      nombre: 'Agente',       icono: '🕶', desc: '+30% oro en todas las ventas', salario: 12, precio: 180 },
    { key: 'mecenas',     nombre: 'Mecenas',      icono: '💎', desc: '+40 de oro extra cada jornada', salario: 0,  precio: 260 },
    { key: 'pizarra',     nombre: 'Táctico',      icono: '📋', desc: '+6 pase y +6 defensa a todo el equipo', salario: 14, precio: 220 },
    { key: 'motivador',   nombre: 'Motivador',    icono: '📣', desc: '+8 a todos los stats en partidos jefe', salario: 10, precio: 170 },
    { key: 'cazatalentos',nombre: 'Cazatalentos', icono: '🧲', desc: 'La tienda ofrece cartas de mayor rareza', salario: 12, precio: 200 },
    { key: 'economista',  nombre: 'Economista',   icono: '🧮', desc: '-25% en el pago de salarios', salario: 0,  precio: 190 }
  ];

  function cartaStaff(key) {
    var def = key ? STAFF_DEFS.filter(function (d) { return d.key === key; })[0] : RNG.pick(STAFF_DEFS);
    return {
      id: nextId(),
      type: 'staff',
      key: def.key,
      nombre: def.nombre,
      icono: def.icono,
      desc: def.desc,
      rareza: 'epica',
      salario: def.salario,
      valorBase: def.precio
    };
  }

  // Liga: 8 equipos, el índice 0 es el del jugador. Cada ciudad es única.
  function generarLiga() {
    var ciudades = RNG.shuffle(CIUDADES);
    var colores = RNG.shuffle(COLORES);
    var equipos = [];
    for (var i = 0; i < 8; i++) {
      var nombre = RNG.pick(PREFIJOS_EQUIPO) + ' ' + ciudades[i];
      equipos.push({
        idx: i,
        nombre: nombre,
        color: colores[i],
        esJugador: i === 0,
        rating: i === 0 ? 0 : RNG.int(56, 78),
        pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0
      });
    }
    // Un rival fuerte garantizado para que la liga tenga un "jefe" natural
    var fuerte = RNG.int(1, 7);
    equipos[fuerte].rating = Math.max(equipos[fuerte].rating, RNG.int(76, 82));
    return equipos;
  }

  // Plantilla inicial: 13 cartas equilibradas, mayoría comunes
  function plantillaInicial() {
    var plan = [
      ['POR', 'comun'], ['POR', 'comun'],
      ['DEF', 'comun'], ['DEF', 'comun'], ['DEF', 'comun'], ['DEF', 'rara'],
      ['MED', 'comun'], ['MED', 'comun'], ['MED', 'rara'], ['MED', 'comun'],
      ['DEL', 'comun'], ['DEL', 'rara'], ['DEL', 'comun']
    ];
    return plan.map(function (p) { return cartaJugador(p[0], p[1]); });
  }

  function rarezaDrop(dificultad, esJefe, bonusCazatalentos) {
    // dificultad: rating del rival (56..90)
    var d = Math.max(0, dificultad - 56);
    var boost = bonusCazatalentos ? 12 : 0;
    if (esJefe) {
      return RNG.weighted([
        { v: 'rara', w: 35 }, { v: 'epica', w: 50 + boost }, { v: 'legendaria', w: 12 + boost }
      ]);
    }
    return RNG.weighted([
      { v: 'comun', w: Math.max(10, 58 - d * 1.6) },
      { v: 'rara', w: 30 + d * 0.8 },
      { v: 'epica', w: 8 + d * 0.9 + boost },
      { v: 'legendaria', w: 1 + d * 0.25 + boost * 0.3 }
    ]);
  }

  return {
    TAGS: TAGS,
    POSICIONES: POSICIONES,
    RAREZAS: RAREZAS,
    HABILIDADES: HABILIDADES,
    STAFF_DEFS: STAFF_DEFS,
    cartaJugador: cartaJugador,
    cartaStaff: cartaStaff,
    generarLiga: generarLiga,
    plantillaInicial: plantillaInicial,
    rarezaDrop: rarezaDrop,
    nombreJugador: nombreJugador
  };
})();
