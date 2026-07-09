/* ============================================================
   GEN — generación procedural: nombres, equipos (con plantilla,
   formación y táctica propias), cartas de jugador con atributos
   completos estilo FM, staff y drops.
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
    comun:      { nombre: 'Común',      color: '#8a919e', habMax: 1, precio: 60,  salario: 4 },
    rara:       { nombre: 'Rara',       color: '#3b82f6', habMax: 1, precio: 130, salario: 8 },
    epica:      { nombre: 'Épica',      color: '#a855f7', habMax: 2, precio: 280, salario: 15 },
    legendaria: { nombre: 'Legendaria', color: '#f59e0b', habMax: 2, precio: 520, salario: 25 }
  };

  // Habilidades pasivas: perks del roguelike sobre el sistema de atributos.
  // El motor aplica clutch/killer/francotirador/motor en el momento adecuado;
  // el resto son bonos de atributo al construir el contexto del partido.
  var HABILIDADES = {
    clutch:        { nombre: 'Clutch',        icono: '⏱', desc: '+2 a todos sus atributos a partir del minuto 75' },
    muro:          { nombre: 'Muro',          icono: '🧱', desc: '+2 Marcaje, Colocación y Cabeza', pos: ['DEF'] },
    killer:        { nombre: 'Killer',        icono: '🎯', desc: '+3 Remate dentro del área', pos: ['DEL', 'MED'] },
    motor:         { nombre: 'Motor',         icono: '⚙️', desc: 'Gasta un 30% menos de energía durante el partido' },
    capitan:       { nombre: 'Capitán',       icono: '🎖', desc: '+1 Compostura y Decisiones a todo el equipo' },
    velocista:     { nombre: 'Velocista',     icono: '💨', desc: '+2 Velocidad y Aceleración' },
    cerrojo:       { nombre: 'Cerrojo',       icono: '🔒', desc: '+2 Reflejos y 1 contra 1', pos: ['POR'] },
    francotirador: { nombre: 'Francotirador', icono: '🏹', desc: '+3 Tiros lejanos y busca el disparo desde fuera', pos: ['DEL', 'MED'] },
    fajador:       { nombre: 'Fajador',       icono: '🛡', desc: '+2 Fuerza y Agresividad; +1 a todo en partidos jefe' },
    estrella:      { nombre: 'Estrella',      icono: '⭐', desc: '+1 a todos sus atributos ofensivos', pos: ['DEL', 'MED'] }
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

  function tagPara(rareza) {
    if (rareza === 'legendaria' || rareza === 'epica') {
      return RNG.weighted([{ v: 'Galáctico', w: 4 }, { v: 'Técnico', w: 2 }, { v: 'Físico', w: 2 }, { v: 'Cantera', w: 1 }]);
    }
    return RNG.weighted([{ v: 'Cantera', w: 4 }, { v: 'Físico', w: 3 }, { v: 'Técnico', w: 3 }, { v: 'Galáctico', w: 1 }]);
  }

  function cartaJugador(pos, rareza) {
    pos = pos || RNG.pick(POSICIONES);
    rareza = rareza || 'comun';
    var attrs = Attrs.generar(pos, rareza);
    var media = Attrs.media(pos, attrs);
    return {
      id: nextId(),
      type: 'player',
      nombre: nombreJugador(),
      pos: pos,
      rareza: rareza,
      tag: tagPara(rareza),
      edad: RNG.int(18, 34),
      attrs: attrs,
      media: media,
      habilidades: habilidadesPara(pos, rareza),
      salario: RAREZAS[rareza].salario,
      valorBase: Math.max(30, Math.round(RAREZAS[rareza].precio * (0.7 + (media - 42) / 55))),
      lesion: 0,
      sancion: 0,
      condicion: 100,
      forma: 0,
      temporada: { pj: 0, goles: 0, asistencias: 0, ratingTotal: 0 }
    };
  }

  var STAFF_DEFS = [
    { key: 'ojeador',     nombre: 'Ojeador',      icono: '🔭', desc: '+1 opción en cada drop de cartas post-partido', salario: 10, precio: 150 },
    { key: 'preparador',  nombre: 'Preparador',   icono: '⛑', desc: '+10 de condición recuperada por jornada y lesiones a la mitad', salario: 8,  precio: 120 },
    { key: 'agente',      nombre: 'Agente',       icono: '🕶', desc: '+30% oro en todas las ventas', salario: 12, precio: 180 },
    { key: 'mecenas',     nombre: 'Mecenas',      icono: '💎', desc: '+40 de oro extra cada jornada', salario: 0,  precio: 260 },
    { key: 'pizarra',     nombre: 'Táctico',      icono: '📋', desc: 'La cohesión con cada formación sube el doble y +1 Colocación al once', salario: 14, precio: 220 },
    { key: 'motivador',   nombre: 'Motivador',    icono: '📣', desc: '+1 Compostura y Concentración al once (doble en partidos jefe)', salario: 10, precio: 170 },
    { key: 'cazatalentos',nombre: 'Cazatalentos', icono: '🧲', desc: 'La tienda ofrece cartas de mayor rareza', salario: 12, precio: 200 },
    { key: 'economista',  nombre: 'Economista',   icono: '🧮', desc: '-25% en el pago de salarios y un reroll gratis por jornada', salario: 0,  precio: 190 }
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

  // ---------- equipos IA con plantilla real ----------
  // nivel base de atributos (1-20) equivalente a un rating 1-99
  function nivelDeRating(rating) {
    return Math.max(4, Math.min(18.5, (rating - 8) / 4.9));
  }

  function plantillaIA(rating, formacion) {
    var jugadores = [];
    Formations.DEFS[formacion].slots.forEach(function (sl) {
      var nivel = nivelDeRating(rating) + (Math.random() * 2 - 1);
      jugadores.push({
        id: 'ia' + (idSeq++),
        nombre: nombreJugador(),
        pos: sl.pos,
        rol: sl.rol,
        attrs: Attrs.generarNivel(sl.pos, nivel),
        habilidades: []
      });
    });
    // una estrella por equipo: mejora al mejor atacante
    var atacantes = jugadores.filter(function (j) { return j.pos === 'DEL' || j.pos === 'MED'; });
    if (atacantes.length) {
      var estrella = RNG.pick(atacantes);
      Object.keys(estrella.attrs).forEach(function (a) {
        estrella.attrs[a] = Math.min(20, estrella.attrs[a] + 2);
      });
      estrella.esEstrella = true;
    }
    jugadores.forEach(function (j) { j.media = Attrs.media(j.pos, j.attrs); });
    return jugadores;
  }

  function generarLiga() {
    var ciudades = RNG.shuffle(CIUDADES);
    var colores = RNG.shuffle(COLORES);
    var equipos = [];
    for (var i = 0; i < 8; i++) {
      equipos.push({
        idx: i,
        nombre: RNG.pick(PREFIJOS_EQUIPO) + ' ' + ciudades[i],
        color: colores[i],
        esJugador: i === 0,
        rating: i === 0 ? 0 : RNG.int(47, 66),
        pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0
      });
    }
    // un rival fuerte garantizado: el "jefe" natural de la liga
    var fuerte = RNG.int(1, 7);
    equipos[fuerte].rating = Math.max(equipos[fuerte].rating, RNG.int(68, 74));
    equipos.forEach(function (e) {
      if (e.esJugador) return;
      e.tactica = Formations.tacticaIA(e.rating);
      e.plantilla = plantillaIA(e.rating, e.tactica.formacion);
      e.ratingBase = e.rating;
      var estrella = e.plantilla.filter(function (j) { return j.esEstrella; })[0];
      e.estrella = estrella ? estrella.nombre : null;
    });
    return equipos;
  }

  // Plantilla inicial: 15 cartas — cubre cualquiera de las 7 formaciones
  function plantillaInicial() {
    var plan = [
      ['POR', 'comun'], ['POR', 'comun'],
      ['DEF', 'comun'], ['DEF', 'comun'], ['DEF', 'comun'], ['DEF', 'comun'], ['DEF', 'rara'],
      ['MED', 'comun'], ['MED', 'comun'], ['MED', 'comun'], ['MED', 'rara'], ['MED', 'comun'],
      ['DEL', 'comun'], ['DEL', 'rara'], ['DEL', 'comun']
    ];
    return plan.map(function (p) { return cartaJugador(p[0], p[1]); });
  }

  function rarezaDrop(dificultad, esJefe, bonusCazatalentos) {
    var d = Math.max(0, dificultad - 47);
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
    plantillaIA: plantillaIA,
    nivelDeRating: nivelDeRating,
    rarezaDrop: rarezaDrop,
    nombreJugador: nombreJugador
  };
})();

if (typeof module !== 'undefined') module.exports = Gen;
