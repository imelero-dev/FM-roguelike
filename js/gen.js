/* ============================================================
   GEN — procedural generation: names, teams (each with its own
   squad, formation and tactics), player cards with full
   attributes, staff and drops.
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

  var TAGS = ['Academy', 'Superstar', 'Physical', 'Technical'];
  var POSICIONES = ['GK', 'DEF', 'MID', 'FWD'];

  var RAREZAS = {
    comun:      { nombre: 'Common',    color: '#8a919e', habMax: 1, precio: 60,  salario: 4 },
    rara:       { nombre: 'Rare',      color: '#3b82f6', habMax: 1, precio: 130, salario: 8 },
    epica:      { nombre: 'Epic',      color: '#a855f7', habMax: 2, precio: 280, salario: 15 },
    legendaria: { nombre: 'Legendary', color: '#f59e0b', habMax: 2, precio: 520, salario: 25 }
  };

  // Passive skills: roguelike perks layered on the attribute system.
  // The engine applies clutch/killer/francotirador/motor at the right moment;
  // the rest are attribute bonuses applied when building the match context.
  var HABILIDADES = {
    clutch:        { nombre: 'Clutch',        icono: '⏱', desc: '+2 to all attributes from the 75th minute' },
    muro:          { nombre: 'Brick Wall',    icono: '🧱', desc: '+2 Marking, Positioning and Heading', pos: ['DEF'] },
    killer:        { nombre: 'Killer',        icono: '🎯', desc: '+3 Finishing inside the box', pos: ['FWD', 'MID'] },
    motor:         { nombre: 'Engine',        icono: '⚙️', desc: 'Uses 30% less energy during the match' },
    capitan:       { nombre: 'Captain',       icono: '🎖', desc: '+1 Composure and Decisions to the whole team' },
    velocista:     { nombre: 'Speedster',     icono: '💨', desc: '+2 Pace and Acceleration' },
    cerrojo:       { nombre: 'Shot Stopper',  icono: '🔒', desc: '+2 Reflexes and One on Ones', pos: ['GK'] },
    francotirador: { nombre: 'Sniper',        icono: '🏹', desc: '+3 Long Shots and shoots from distance more', pos: ['FWD', 'MID'] },
    fajador:       { nombre: 'Battler',       icono: '🛡', desc: '+2 Strength and Aggression; +1 to all in boss matches' },
    estrella:      { nombre: 'Star',          icono: '⭐', desc: '+1 to all attacking attributes', pos: ['FWD', 'MID'] }
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
      return RNG.weighted([{ v: 'Superstar', w: 4 }, { v: 'Technical', w: 2 }, { v: 'Physical', w: 2 }, { v: 'Academy', w: 1 }]);
    }
    return RNG.weighted([{ v: 'Academy', w: 4 }, { v: 'Physical', w: 3 }, { v: 'Technical', w: 3 }, { v: 'Superstar', w: 1 }]);
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
    { key: 'ojeador',     nombre: 'Scout',        icono: '🔭', desc: '+1 option in every post-match card drop', salario: 10, precio: 150 },
    { key: 'preparador',  nombre: 'Physio',       icono: '⛑', desc: '+10 condition recovered per matchday and injuries halved', salario: 8,  precio: 120 },
    { key: 'agente',      nombre: 'Agent',        icono: '🕶', desc: '+30% gold on all sales', salario: 12, precio: 180 },
    { key: 'mecenas',     nombre: 'Benefactor',   icono: '💎', desc: '+40 extra gold every matchday', salario: 0,  precio: 260 },
    { key: 'pizarra',     nombre: 'Tactician',    icono: '📋', desc: 'Formation cohesion grows twice as fast and +1 Positioning for the XI', salario: 14, precio: 220 },
    { key: 'motivador',   nombre: 'Motivator',    icono: '📣', desc: '+1 Composure and Concentration for the XI (double in boss matches)', salario: 10, precio: 170 },
    { key: 'cazatalentos',nombre: 'Talent Spotter', icono: '🧲', desc: 'The shop offers higher-rarity cards', salario: 12, precio: 200 },
    { key: 'economista',  nombre: 'Economist',    icono: '🧮', desc: '-25% on wages and one free reroll per matchday', salario: 0,  precio: 190 }
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

  // ---------- AI teams with real squads ----------
  // base attribute level (1-20) equivalent to a 1-99 rating
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
    // one star per team: boosts a random attacker
    var atacantes = jugadores.filter(function (j) { return j.pos === 'FWD' || j.pos === 'MID'; });
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
    // one guaranteed strong rival: the league's natural "boss"
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

  // Starting squad: 15 cards — covers any of the 7 formations
  function plantillaInicial() {
    var plan = [
      ['GK', 'comun'], ['GK', 'comun'],
      ['DEF', 'comun'], ['DEF', 'comun'], ['DEF', 'comun'], ['DEF', 'comun'], ['DEF', 'rara'],
      ['MID', 'comun'], ['MID', 'comun'], ['MID', 'comun'], ['MID', 'rara'], ['MID', 'comun'],
      ['FWD', 'comun'], ['FWD', 'rara'], ['FWD', 'comun']
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
    nombreJugador: nombreJugador,
    // id counter, persisted with the save so resumed runs never reuse card ids
    getIdSeq: function () { return idSeq; },
    setIdSeq: function (n) { idSeq = Math.max(idSeq, n | 0); }
  };
})();

if (typeof module !== 'undefined') module.exports = Gen;
