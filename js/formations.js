/* ============================================================
   FORMATIONS — formations with spatial slots (roles) and team
   tactics. Slot positions are the team's defensive shape: the
   engine shifts them by possession, ball zone, mentality and
   width, so the formation clash (overloads per zone) emerges
   from the geometry and is reinforced by explicit zone modifiers.

   slot: { pos, rol, x (depth 0-1 towards the opponent's goal),
           y (0-1 touchline to touchline) }
   Roles: GK, CB (centre-back), FB (full-back), WB (wing-back),
          DM (defensive mid), CM (central mid), WM (wide mid),
          AM (attacking mid), W (winger), ST (striker)
   ============================================================ */

var Formations = (function () {

  function s(pos, rol, x, y) { return { pos: pos, rol: rol, x: x, y: y }; }

  var DEFS = {
    '4-3-3': {
      nombre: '4-3-3',
      desc: 'Wide wingers and a front three. Dominates the flanks in attack; midfield can get stretched.',
      slots: [
        s('GK', 'GK', 0.045, 0.5),
        s('DEF', 'FB', 0.175, 0.11), s('DEF', 'CB', 0.15, 0.36), s('DEF', 'CB', 0.15, 0.64), s('DEF', 'FB', 0.175, 0.89),
        s('MID', 'CM', 0.36, 0.28), s('MID', 'DM', 0.30, 0.5), s('MID', 'CM', 0.36, 0.72),
        s('FWD', 'W', 0.60, 0.13), s('FWD', 'ST', 0.65, 0.5), s('FWD', 'W', 0.60, 0.87)
      ]
    },
    '4-4-2': {
      nombre: '4-4-2',
      desc: 'Two banks of four: solid, direct and easy to hold. Can be overrun centrally by a midfield three.',
      slots: [
        s('GK', 'GK', 0.045, 0.5),
        s('DEF', 'FB', 0.175, 0.11), s('DEF', 'CB', 0.15, 0.36), s('DEF', 'CB', 0.15, 0.64), s('DEF', 'FB', 0.175, 0.89),
        s('MID', 'WM', 0.40, 0.10), s('MID', 'CM', 0.37, 0.37), s('MID', 'CM', 0.37, 0.63), s('MID', 'WM', 0.40, 0.90),
        s('FWD', 'ST', 0.63, 0.38), s('FWD', 'ST', 0.63, 0.62)
      ]
    },
    '4-2-3-1': {
      nombre: '4-2-3-1',
      desc: 'Double pivot and a No. 10 between the lines. Central control and balance; the striker can get isolated.',
      slots: [
        s('GK', 'GK', 0.045, 0.5),
        s('DEF', 'FB', 0.175, 0.11), s('DEF', 'CB', 0.15, 0.36), s('DEF', 'CB', 0.15, 0.64), s('DEF', 'FB', 0.175, 0.89),
        s('MID', 'DM', 0.29, 0.38), s('MID', 'DM', 0.29, 0.62),
        s('MID', 'W', 0.47, 0.13), s('MID', 'AM', 0.46, 0.5), s('MID', 'W', 0.47, 0.87),
        s('FWD', 'ST', 0.65, 0.5)
      ]
    },
    '3-5-2': {
      nombre: '3-5-2',
      desc: 'Five in midfield: central overload and wing-backs for width. Struggles against quick wingers.',
      slots: [
        s('GK', 'GK', 0.045, 0.5),
        s('DEF', 'CB', 0.155, 0.25), s('DEF', 'CB', 0.14, 0.5), s('DEF', 'CB', 0.155, 0.75),
        s('MID', 'WB', 0.33, 0.07), s('MID', 'CM', 0.37, 0.32), s('MID', 'DM', 0.30, 0.5), s('MID', 'CM', 0.37, 0.68), s('MID', 'WB', 0.33, 0.93),
        s('FWD', 'ST', 0.63, 0.40), s('FWD', 'ST', 0.63, 0.60)
      ]
    },
    '3-4-3': {
      nombre: '3-4-3',
      desc: 'All-out attack: three up top and wide mids. Creates loads, but leaves space in behind.',
      slots: [
        s('GK', 'GK', 0.045, 0.5),
        s('DEF', 'CB', 0.155, 0.25), s('DEF', 'CB', 0.14, 0.5), s('DEF', 'CB', 0.155, 0.75),
        s('MID', 'WM', 0.37, 0.09), s('MID', 'CM', 0.35, 0.37), s('MID', 'CM', 0.35, 0.63), s('MID', 'WM', 0.37, 0.91),
        s('FWD', 'W', 0.61, 0.15), s('FWD', 'ST', 0.65, 0.5), s('FWD', 'W', 0.61, 0.85)
      ]
    },
    '5-3-2': {
      nombre: '5-3-2',
      desc: 'Park the bus with five at the back and two strikers on the break. Very hard to beat, little going forward.',
      slots: [
        s('GK', 'GK', 0.045, 0.5),
        s('DEF', 'WB', 0.19, 0.07), s('DEF', 'CB', 0.145, 0.28), s('DEF', 'CB', 0.13, 0.5), s('DEF', 'CB', 0.145, 0.72), s('DEF', 'WB', 0.19, 0.93),
        s('MID', 'CM', 0.35, 0.30), s('MID', 'DM', 0.32, 0.5), s('MID', 'CM', 0.35, 0.70),
        s('FWD', 'ST', 0.60, 0.40), s('FWD', 'ST', 0.60, 0.60)
      ]
    },
    '4-1-4-1': {
      nombre: '4-1-4-1',
      desc: 'Compact mid-block with a holding midfielder. Balanced and hard to break down; needs a lone striker who can hold it up.',
      slots: [
        s('GK', 'GK', 0.045, 0.5),
        s('DEF', 'FB', 0.175, 0.11), s('DEF', 'CB', 0.15, 0.36), s('DEF', 'CB', 0.15, 0.64), s('DEF', 'FB', 0.175, 0.89),
        s('MID', 'DM', 0.27, 0.5),
        s('MID', 'WM', 0.42, 0.10), s('MID', 'CM', 0.40, 0.37), s('MID', 'CM', 0.40, 0.63), s('MID', 'WM', 0.42, 0.90),
        s('FWD', 'ST', 0.65, 0.5)
      ]
    }
  };

  var LISTA = Object.keys(DEFS);

  function req(key) {
    var r = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    DEFS[key].slots.forEach(function (sl) { r[sl.pos]++; });
    return r;
  }

  // ---------- tactics ----------
  var MENTALIDADES = [
    { v: -1, nombre: 'Defensive', desc: 'Low block, few risks. Concede the ball and close the gaps.' },
    { v: 0, nombre: 'Balanced', desc: 'Mid-block, moderate risk.' },
    { v: 1, nombre: 'Attacking', desc: 'High line and more bodies forward. Leaves space at the back.' }
  ];
  var PRESIONES = [
    { v: 0, nombre: 'Low', desc: 'Drop off: only press near your own box. Saves energy.' },
    { v: 1, nombre: 'Medium', desc: 'Press in your own half.' },
    { v: 2, nombre: 'High', desc: 'Hound the ball carrier all over the pitch. Wins it high, tires your players.' }
  ];
  var ESTILOS = [
    { v: 'corto', nombre: 'Short passing', desc: 'Short passes and control. Needs good Passing/Technique; vulnerable to a high press.' },
    { v: 'directo', nombre: 'Direct', desc: 'Long balls to the strikers. Bypasses the press, gives away possession.' }
  ];
  var AMPLITUDES = [
    { v: 'estrecha', nombre: 'Narrow', desc: 'Packs your players centrally: more support, less width.' },
    { v: 'normal', nombre: 'Normal', desc: 'Standard use of the pitch.' },
    { v: 'ancha', nombre: 'Wide', desc: 'Stretches the pitch: opens gaps centrally, isolates the wingers.' }
  ];

  function tacticaBase() {
    return { formacion: '4-3-3', mentalidad: 0, presion: 1, estilo: 'corto', amplitud: 'normal' };
  }

  // Sensible preset for an AI team based on its rating
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

  // ---------- matchup analysis ----------
  // Zone presence of a formation (excluding the goalkeeper)
  function presencia(key) {
    var p = { centro: 0, banda: 0, medios: 0, atras: 0, arriba: 0 };
    DEFS[key].slots.forEach(function (sl) {
      if (sl.rol === 'GK') return;
      var ancho = sl.y < 0.24 || sl.y > 0.76;
      if (ancho) p.banda++; else p.centro++;
      if (sl.x >= 0.25 && sl.x <= 0.52) p.medios++;
      if (sl.pos === 'DEF') p.atras++;
      if (sl.pos === 'FWD') p.arriba++;
    });
    return p;
  }

  // Numerical advantages of A over B (positive = A's advantage).
  // The engine uses them as soft per-zone modifiers.
  function ventajas(formA, formB) {
    var a = presencia(formA), b = presencia(formB);
    return {
      centro: Math.max(-3, Math.min(3, a.medios - b.medios)),
      banda: Math.max(-3, Math.min(3, a.banda - b.banda))
    };
  }

  // Human-readable scouting tips for the player
  function consejos(miForm, rival) {
    var v = ventajas(miForm, rival.formacion);
    var out = [];
    if (v.centro > 0) out.push('✅ Your ' + miForm + ' outnumbers their ' + rival.formacion + ' in midfield: you\'ll control possession through the middle.');
    if (v.centro < 0) out.push('⚠️ Their ' + rival.formacion + ' outnumbers you in midfield: you\'ll struggle to play through the middle.');
    if (v.banda > 0) out.push('✅ You get more bodies out wide: crosses and wingers will hurt them.');
    if (v.banda < 0) out.push('⚠️ They\'ll overload you out wide: watch out for crosses.');
    if (rival.presion === 2) out.push('🔥 They press very high: a Direct style bypasses it (or punish them with high Technique).');
    if (rival.presion === 0) out.push('💤 They barely press: Short passing will give you the ball risk-free.');
    if (rival.mentalidad === 1) out.push('⚔️ They\'ll go for it: expect space in behind for your quick players.');
    if (rival.mentalidad === -1) out.push('🧱 They\'ll sit deep: you\'ll need patience and long shots.');
    if (!out.length) out.push('Even matchup: the players will decide it.');
    return out;
  }

  function etiquetaTactica(t) {
    var m = MENTALIDADES.filter(function (x) { return x.v === t.mentalidad; })[0];
    var p = PRESIONES.filter(function (x) { return x.v === t.presion; })[0];
    var e = ESTILOS.filter(function (x) { return x.v === t.estilo; })[0];
    return t.formacion + ' · ' + m.nombre + ' · ' + p.nombre + ' press · ' + e.nombre;
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
