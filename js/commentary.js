/* ============================================================
   COMMENTARY — match feed phrasing and the half-time summary.
   Pure functions over engine events/state (no DOM), so the
   Node tests can drive them directly. Randomness here is
   cosmetic only and never touches the match result.
   ============================================================ */

var Commentary = (function () {

  // a shot this good (engine xG) gets a "big chance" call before it lands
  var BIG_CHANCE_XG = 0.4;

  // {p} player, {k} keeper, {v} fouled player, {team} team in the event
  var LINES = {
    inicio: [
      'Kick-off! We are under way.',
      'And we are off!',
      'The referee blows and the ball is rolling.',
      'Kick-off. Ninety minutes to make a name for yourselves.'
    ],
    gol: [
      'GOAL! {p} finds the net!',
      'GOAL! {p} buries it!',
      'It is in! {p} scores!',
      'Back of the net! {p}!',
      'GOAL! {p} makes no mistake!'
    ],
    gol_pen: [
      'GOAL! {p} sends the keeper the wrong way!',
      'GOAL! {p} tucks the penalty away!',
      'Cool as you like: {p} converts from the spot!',
      'GOAL! {p} smashes the penalty home!'
    ],
    chance: [
      'Big chance! {p} is through on goal…',
      '{p} has only the keeper to beat…',
      'Huge opening for {team}! {p} shoots…',
      'This has to be a goal… {p}!'
    ],
    chance_cabeza: [
      '{p} rises highest… big chance!',
      'Free header for {p}…',
      'The cross is perfect for {p}…',
      '{p} meets it with a header…'
    ],
    parada: [
      '{k} saves from {p}!',
      'Great stop! {k} denies {p}.',
      '{p} forces a save out of {k}.',
      '{k} gets down well to keep out {p}.',
      'Strong hands from {k} against {p}.'
    ],
    parada_pen: [
      'PENALTY SAVED! {k} guesses right against {p}!',
      '{k} stops the penalty! {p} cannot believe it.',
      'Saved! {k} the hero from the spot.'
    ],
    palo: [
      '{p} hits the post!',
      'Off the woodwork! {p} so close.',
      '{p} rattles the bar!',
      'Denied by the frame of the goal: {p}!'
    ],
    fuera: [
      '{p} fires wide.',
      '{p} drags it past the post.',
      'Over the bar from {p}.',
      '{p} shoots, but it is off target.',
      'Wasteful from {p}: well wide.'
    ],
    fuera_pen: [
      '{p} misses the penalty!',
      'Wide from the spot! {p} has blown it.',
      '{p} skies the penalty!'
    ],
    atrapa: [
      '{p} claims the cross.',
      '{p} comes out and collects.',
      'Commanding from {p}, who plucks it out of the air.',
      '{p} rises above everyone to gather.'
    ],
    falta: [
      'Foul by {p} on {v}.',
      '{p} brings down {v}.',
      '{p} clips {v}. Free kick.',
      'The whistle goes: {p} on {v}.',
      '{v} is sent tumbling by {p}.'
    ],
    amarilla: [
      'Yellow card for {p}.',
      '{p} goes into the book.',
      'The referee shows {p} a yellow.',
      '{p} is booked.'
    ],
    roja: [
      'RED CARD! {p} is sent off!',
      'Marching orders! Red card for {p}!',
      '{p} sees red!',
      'The referee reaches for the red: {p} is gone!'
    ],
    penalti: [
      'PENALTY to {team}! {p} steps up.',
      'The referee points to the spot! {p} will take it for {team}.',
      'PENALTY! Huge moment for {team}. {p} grabs the ball.',
      'Spot kick for {team}! {p} places the ball.'
    ],
    corner: [
      'Corner to {team}.',
      '{team} win a corner.',
      'Behind for a corner. {team} pile forward.',
      'Corner kick, {team}.'
    ],
    descanso: [
      'Half-time.',
      'The referee blows for half-time.',
      'That is the break.',
      'Half-time whistle.'
    ],
    final: [
      'Full-time.',
      'The final whistle goes.',
      'It is all over.',
      'Full-time whistle.'
    ]
  };

  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
  }

  // commentator: never repeats the same phrasing for two consecutive events of one kind
  function create(rng) {
    rng = rng || Math.random;
    var last = {};
    return {
      line: function (key, vars) {
        var pool = LINES[key];
        if (!pool) return '';
        var i = Math.floor(rng() * pool.length);
        if (pool.length > 1 && i === last[key]) {
          i = (i + 1 + Math.floor(rng() * (pool.length - 1))) % pool.length;
        }
        last[key] = i;
        return fill(pool[i], vars || {});
      },
      lastIndex: function (key) { return last[key]; }
    };
  }

  // which pool an engine event uses (null = no feed line)
  function keyFor(ev) {
    switch (ev.t) {
      case 'gol': return ev.penalti ? 'gol_pen' : 'gol';
      case 'tiro':
        if (ev.resultado === 'atrapa') return 'atrapa';
        if (ev.resultado === 'palo') return 'palo';
        if (ev.penalti) return ev.resultado === 'parada' ? 'parada_pen' : 'fuera_pen';
        return ev.resultado === 'parada' ? 'parada' : 'fuera';
      case 'tiro_va': return esOcasionClara(ev) ? (ev.cabeza ? 'chance_cabeza' : 'chance') : null;
      default: return LINES[ev.t] ? ev.t : null;
    }
  }

  function esOcasionClara(ev) {
    return !ev.penalti && (ev.xg || 0) >= BIG_CHANCE_XG;
  }

  // ---------- half-time card ----------

  // turns an event into a "key moment" candidate (weight decides which make the card)
  function momento(ev) {
    var grande = (ev.xg || 0) >= BIG_CHANCE_XG;
    var m = null;
    if (ev.t === 'gol') {
      m = { peso: 100, icon: '⚽', texto: ev.jugador + (ev.penalti ? ' scores from the spot' : ' scores') + ' (' + ev.marcador[0] + '-' + ev.marcador[1] + ')' };
    } else if (ev.t === 'roja') {
      m = { peso: 90, icon: '🟥', texto: ev.jugador + ' sent off' };
    } else if (ev.t === 'tiro' && ev.penalti) {
      m = { peso: 80, icon: '🎯', texto: ev.jugador + (ev.resultado === 'parada' ? ' has a penalty saved' : ' misses a penalty') };
    } else if (ev.t === 'tiro' && ev.resultado === 'palo') {
      m = { peso: 60, icon: '🥅', texto: ev.jugador + ' hits the woodwork' };
    } else if (ev.t === 'tiro' && ev.resultado === 'parada' && grande) {
      m = { peso: 50, icon: '🧤', texto: ev.portero + ' denies ' + ev.jugador };
    } else if (ev.t === 'tiro' && ev.resultado === 'fuera' && grande) {
      m = { peso: 40, icon: '💨', texto: ev.jugador + ' misses a big chance' };
    }
    if (m) { m.min = ev.min; m.team = ev.team; }
    return m;
  }

  // the n heaviest moments, shown in match order
  function momentosClave(lista, n) {
    return lista.slice()
      .sort(function (a, b) { return b.peso - a.peso || a.min - b.min; })
      .slice(0, n || 2)
      .sort(function (a, b) { return a.min - b.min; });
  }

  function mejorJugador(engine) {
    var best = null;
    engine.players.forEach(function (arr) {
      arr.forEach(function (p) {
        var v = p.nota + (p.st.goles + p.st.asis) * 0.01;
        if (!best || v > best.v) best = { v: v, p: p };
      });
    });
    var p = best.p;
    return {
      nombre: p.nombre, team: p.team, pos: p.pos,
      nota: Math.round(Math.min(10, Math.max(3, p.nota)) * 10) / 10,
      goles: p.st.goles, asis: p.st.asis, paradas: p.st.paradas
    };
  }

  // everything the half-time card shows, from the live engine state
  function resumenDescanso(engine, momentos) {
    var s = engine.stats;
    var total = s[0].posesion + s[1].posesion || 1;
    var p0 = Math.round(s[0].posesion / total * 100);
    return {
      marcador: engine.marcador.slice(),
      posesion: [p0, 100 - p0],
      tiros: [s[0].tiros, s[1].tiros],
      aPuerta: [s[0].aPuerta, s[1].aPuerta],
      xg: [Math.round(s[0].xg * 100) / 100, Math.round(s[1].xg * 100) / 100],
      faltas: [s[0].faltas, s[1].faltas],
      mejor: mejorJugador(engine),
      momentos: momentosClave(momentos || [], 2)
    };
  }

  return {
    LINES: LINES,
    BIG_CHANCE_XG: BIG_CHANCE_XG,
    create: create,
    keyFor: keyFor,
    momento: momento,
    momentosClave: momentosClave,
    mejorJugador: mejorJugador,
    resumenDescanso: resumenDescanso
  };
})();

if (typeof module !== 'undefined') module.exports = Commentary;
