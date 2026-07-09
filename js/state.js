/* ============================================================
   STATE — estado de la run: plantilla, alineación por formación,
   táctica, cohesión, moral, calendario y meta-progresión.
   ============================================================ */

var State = (function () {

  var run = null;

  var JORNADAS_JEFE = { 5: '🔥 DERBI', 10: '⚡ DUELO EN LA CIMA', 14: '👑 FINAL DE INFARTO' };
  var MAX_PLANTILLA = 18;
  var MAX_STAFF = 3;

  // ---- calendario: round-robin doble (8 equipos, 14 jornadas) ----
  function generarCalendario() {
    var n = 8;
    var ids = [0, 1, 2, 3, 4, 5, 6, 7];
    var rondas = [];
    for (var r = 0; r < n - 1; r++) {
      var partidos = [];
      for (var i = 0; i < n / 2; i++) {
        var a = ids[i], b = ids[n - 1 - i];
        partidos.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
      rondas.push(partidos);
      ids.splice(1, 0, ids.pop());
    }
    var vuelta = rondas.map(function (ronda) {
      return ronda.map(function (p) { return [p[1], p[0]]; });
    });
    return rondas.concat(vuelta);
  }

  function nuevaRun() {
    var equipos = Gen.generarLiga();
    run = {
      jornada: 1,
      oro: 300,
      plantilla: Gen.plantillaInicial(),
      alineacion: new Array(11).fill(null),
      staff: [],
      equipos: equipos,
      calendario: generarCalendario(),
      resultados: [],
      derrotasSeguidas: 0,
      shopStock: null,
      shopJornada: 0,
      rerollCost: 25,
      economistaUsado: false,
      debuffProxPartido: 0,
      terminada: false,
      tactica: Formations.tacticaBase(),
      cohesion: { '4-3-3': 40 },
      moral: 60,
      pichichi: {},
      stats: {
        pg: 0, pe: 0, pp: 0, gf: 0, gc: 0,
        oroGanado: 0, oroGastado: 0, cartasCompradas: 0, cartasVendidas: 0,
        mejorGoleador: {}, jefesGanados: 0
      }
    };
    autoAlinear();
    return run;
  }

  // ---- formación / táctica ----
  function slotsActuales() {
    return Formations.DEFS[run.tactica.formacion].slots;
  }

  function slotPos(i) {
    return slotsActuales()[i].pos;
  }

  function reqActual() {
    return Formations.req(run.tactica.formacion);
  }

  function cohesionActual() {
    return run.cohesion[run.tactica.formacion] || 0;
  }

  // ¿la plantilla puede cubrir esta formación? (jugadores sanos por posición)
  function puedeFormacion(key) {
    var req = Formations.req(key);
    var disp = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    run.plantilla.forEach(function (c) {
      if (c.lesion === 0 && c.sancion === 0) disp[c.pos]++;
    });
    return Object.keys(req).every(function (p) { return disp[p] >= req[p]; });
  }

  function cambiarFormacion(key) {
    if (!Formations.DEFS[key] || key === run.tactica.formacion) return false;
    // conserva a los alineados reasignándolos por posición
    var previos = { POR: [], DEF: [], MED: [], DEL: [] };
    slotsActuales().forEach(function (sl, i) {
      var c = cartaPorId(run.alineacion[i]);
      if (c) previos[sl.pos].push(c.id);
    });
    run.tactica.formacion = key;
    if (run.cohesion[key] === undefined) run.cohesion[key] = 0;
    run.alineacion = new Array(11).fill(null);
    slotsActuales().forEach(function (sl, i) {
      var id = previos[sl.pos].shift();
      if (id) run.alineacion[i] = id;
    });
    return true;
  }

  // ---- alineación ----
  function cartaPorId(id) {
    if (!id) return null;
    return run.plantilla.filter(function (c) { return c.id === id; })[0] || null;
  }

  function onceActual() {
    return run.alineacion.map(cartaPorId);
  }

  function enOnce(cardId) {
    return run.alineacion.indexOf(cardId) >= 0;
  }

  function disponible(c) {
    return c.lesion === 0 && c.sancion === 0;
  }

  function autoAlinear() {
    run.alineacion = new Array(11).fill(null);
    var libres = run.plantilla.filter(disponible);
    // media + condición: rota de forma natural a los fundidos
    libres.sort(function (a, b) {
      return (b.media + b.condicion * 0.15) - (a.media + a.condicion * 0.15);
    });
    slotsActuales().forEach(function (sl, slot) {
      var candidato = libres.filter(function (c) {
        return c.pos === sl.pos && run.alineacion.indexOf(c.id) < 0;
      })[0];
      if (candidato) run.alineacion[slot] = candidato.id;
    });
  }

  function asignarSlot(slot, cardId) {
    var carta = cartaPorId(cardId);
    if (!carta || carta.pos !== slotPos(slot) || !disponible(carta)) return false;
    var prev = run.alineacion.indexOf(cardId);
    if (prev >= 0) run.alineacion[prev] = run.alineacion[slot];
    run.alineacion[slot] = cardId;
    return true;
  }

  function quitarSlot(slot) {
    run.alineacion[slot] = null;
  }

  function onceCompleto() {
    return run.alineacion.every(function (id) { return !!cartaPorId(id); });
  }

  // ---- plantilla ----
  function agregarCarta(carta) {
    if (carta.type === 'staff') {
      if (run.staff.length >= MAX_STAFF) return false;
      run.staff.push(carta);
      return true;
    }
    if (run.plantilla.length >= MAX_PLANTILLA) return false;
    run.plantilla.push(carta);
    return true;
  }

  function quitarCarta(cardId) {
    var idx = run.alineacion.indexOf(cardId);
    if (idx >= 0) run.alineacion[idx] = null;
    run.plantilla = run.plantilla.filter(function (c) { return c.id !== cardId; });
  }

  function quitarStaff(id) {
    run.staff = run.staff.filter(function (s) { return s.id !== id; });
  }

  function tieneStaff(key) {
    return run.staff.some(function (s) { return s.key === key; });
  }

  // ---- partidos / jornadas ----
  function esJefe(jornada) { return !!JORNADAS_JEFE[jornada]; }
  function etiquetaJefe(jornada) { return JORNADAS_JEFE[jornada] || null; }

  function partidoDelJugador(jornada) {
    var ronda = run.calendario[jornada - 1];
    for (var i = 0; i < ronda.length; i++) {
      if (ronda[i][0] === 0 || ronda[i][1] === 0) {
        return { home: ronda[i][0], away: ronda[i][1], esLocal: ronda[i][0] === 0 };
      }
    }
    return null;
  }

  function rivalActual() {
    var p = partidoDelJugador(run.jornada);
    return run.equipos[p.esLocal ? p.away : p.home];
  }

  function salarioTotal() {
    var total = 0;
    run.plantilla.forEach(function (c) { total += c.salario; });
    run.staff.forEach(function (s) { total += s.salario; });
    if (tieneStaff('economista')) total = Math.round(total * 0.75);
    return total;
  }

  // ---- meta-progresión ----
  function meta() {
    try {
      return JSON.parse(localStorage.getItem('rm_meta') || '{"runs":0,"victorias":0,"mejorPuesto":null,"mejorRacha":0}');
    } catch (e) { return { runs: 0, victorias: 0, mejorPuesto: null, mejorRacha: 0 }; }
  }

  function guardarMeta(resultado) {
    var m = meta();
    m.runs++;
    if (resultado.victoria) m.victorias++;
    if (m.mejorPuesto === null || resultado.puesto < m.mejorPuesto) m.mejorPuesto = resultado.puesto;
    if (resultado.pg > m.mejorRacha) m.mejorRacha = resultado.pg;
    try { localStorage.setItem('rm_meta', JSON.stringify(m)); } catch (e) { /* sin storage */ }
  }

  return {
    get run() { return run; },
    MAX_PLANTILLA: MAX_PLANTILLA,
    MAX_STAFF: MAX_STAFF,
    nuevaRun: nuevaRun,
    slotsActuales: slotsActuales,
    slotPos: slotPos,
    reqActual: reqActual,
    cohesionActual: cohesionActual,
    puedeFormacion: puedeFormacion,
    cambiarFormacion: cambiarFormacion,
    cartaPorId: cartaPorId,
    onceActual: onceActual,
    enOnce: enOnce,
    disponible: disponible,
    autoAlinear: autoAlinear,
    asignarSlot: asignarSlot,
    quitarSlot: quitarSlot,
    onceCompleto: onceCompleto,
    agregarCarta: agregarCarta,
    quitarCarta: quitarCarta,
    quitarStaff: quitarStaff,
    tieneStaff: tieneStaff,
    esJefe: esJefe,
    etiquetaJefe: etiquetaJefe,
    partidoDelJugador: partidoDelJugador,
    rivalActual: rivalActual,
    salarioTotal: salarioTotal,
    meta: meta,
    guardarMeta: guardarMeta
  };
})();

if (typeof module !== 'undefined') module.exports = State;
