/* ============================================================
   ECONOMY — oro, tienda, salarios, recompensas y lesiones
   ============================================================ */

var Economy = (function () {

  // ---- tienda ----
  function generarTienda() {
    var run = State.run;
    var boost = State.tieneStaff('cazatalentos');
    var cartas = [];
    for (var i = 0; i < 4; i++) {
      var rareza = Gen.rarezaDrop(56 + run.jornada * 2, false, boost);
      cartas.push(Gen.cartaJugador(null, rareza));
    }
    var staffDisponible = Gen.STAFF_DEFS.filter(function (d) {
      return !State.tieneStaff(d.key);
    });
    var staff = staffDisponible.length ? Gen.cartaStaff(RNG.pick(staffDisponible).key) : null;
    run.shopStock = { cartas: cartas, staff: staff, vendidos: {} };
    run.shopJornada = run.jornada;
  }

  function tiendaActual() {
    var run = State.run;
    if (!run.shopStock || run.shopJornada !== run.jornada) {
      run.rerollCost = 25;
      run.economistaUsado = false;
      generarTienda();
    }
    return run.shopStock;
  }

  function reroll() {
    var run = State.run;
    var gratis = State.tieneStaff('economista') && !run.economistaUsado;
    if (!gratis && run.oro < run.rerollCost) return { ok: false, msg: 'Oro insuficiente' };
    if (gratis) {
      run.economistaUsado = true;
    } else {
      run.oro -= run.rerollCost;
      run.stats.oroGastado += run.rerollCost;
      run.rerollCost += 15;
    }
    generarTienda();
    return { ok: true, gratis: gratis };
  }

  // ---- salarios y jornada ----
  function pagarSalarios() {
    var run = State.run;
    var total = State.salarioTotal();
    var extra = State.tieneStaff('mecenas') ? 40 : 0;
    run.oro += extra;
    if (extra) run.stats.oroGanado += extra;
    var impago = run.oro < total;
    run.stats.oroGastado += Math.min(total, run.oro);
    run.oro = Math.max(0, run.oro - total);
    run.debuffProxPartido = impago ? 5 : 0;
    return { total: total, extra: extra, impago: impago };
  }

  function avanzarLesiones() {
    State.run.plantilla.forEach(function (c) {
      if (c.lesion > 0) c.lesion--;
    });
  }

  function quizasLesion() {
    // tras el partido: pequeña prob. de lesión de un titular
    var run = State.run;
    if (!RNG.chance(0.12)) return null;
    var once = State.onceActual().filter(Boolean);
    if (!once.length) return null;
    var victima = RNG.pick(once);
    // no lesiona si dejaría al equipo sin efectivos para cubrir esa posición
    var REQ = { POR: 1, DEF: 4, MED: 3, DEL: 3 };
    var sanos = run.plantilla.filter(function (c) {
      return c.pos === victima.pos && c.lesion === 0;
    }).length;
    if (sanos <= REQ[victima.pos]) return null;
    var dur = RNG.int(1, 2);
    if (State.tieneStaff('preparador')) dur = Math.max(1, Math.ceil(dur / 2));
    victima.lesion = dur;
    var idx = run.alineacion.indexOf(victima.id);
    if (idx >= 0) run.alineacion[idx] = null;
    return { carta: victima, dur: dur };
  }

  // ---- recompensas post-partido ----
  function recompensaOro(resultado, rival, esJefe) {
    // resultado: 'V' | 'E' | 'D'
    var oro = 0;
    var detalles = [];
    if (resultado === 'V') {
      var base = 100;
      var dif = Math.max(0, rival.rating - 60) * 3;
      oro += base + dif;
      detalles.push({ txt: 'Victoria', oro: base });
      if (dif > 0) detalles.push({ txt: 'Bonus dificultad (rival ' + rival.rating + ')', oro: dif });
      if (esJefe) { oro += 120; detalles.push({ txt: 'Partido jefe superado', oro: 120 }); }
    } else if (resultado === 'E') {
      oro += 40;
      detalles.push({ txt: 'Empate', oro: 40 });
    } else {
      oro += 15;
      detalles.push({ txt: 'Taquilla', oro: 15 });
    }
    return { oro: oro, detalles: detalles };
  }

  function bonusObjetivos(gf, gc, resultado) {
    var detalles = [];
    var oro = 0;
    if (resultado === 'V' && gc === 0) { oro += 30; detalles.push({ txt: 'Portería a cero', oro: 30 }); }
    if (gf >= 3) { oro += 30; detalles.push({ txt: 'Goleada (3+ goles)', oro: 30 }); }
    return { oro: oro, detalles: detalles };
  }

  // Drop de cartas ponderado por dificultad; el jugador elige 1
  function generarDrop(rival, esJefe, gano) {
    var n = 3 + (State.tieneStaff('ojeador') ? 1 : 0);
    if (!gano && !esJefe && !RNG.chance(0.5)) n = Math.max(2, n - 1);
    var cartas = [];
    var boost = State.tieneStaff('cazatalentos');
    var garantiaAlta = esJefe; // jefe: al menos una épica+
    for (var i = 0; i < n; i++) {
      var rareza = Gen.rarezaDrop(rival.rating, esJefe, boost);
      if (garantiaAlta && i === 0 && rareza !== 'epica' && rareza !== 'legendaria') {
        rareza = RNG.chance(0.8) ? 'epica' : 'legendaria';
      }
      cartas.push(Gen.cartaJugador(null, rareza));
    }
    // a veces cae staff en lugar de la última carta
    if (RNG.chance(0.15) && !esJefe) {
      var libres = Gen.STAFF_DEFS.filter(function (d) { return !State.tieneStaff(d.key); });
      if (libres.length) cartas[cartas.length - 1] = Gen.cartaStaff(RNG.pick(libres).key);
    }
    return cartas;
  }

  function precioVenta(carta) {
    var base = Math.round(carta.valorBase * 0.6);
    if (State.tieneStaff('agente')) base = Math.round(base * 1.3);
    return base;
  }

  return {
    tiendaActual: tiendaActual,
    generarTienda: generarTienda,
    reroll: reroll,
    pagarSalarios: pagarSalarios,
    avanzarLesiones: avanzarLesiones,
    quizasLesion: quizasLesion,
    recompensaOro: recompensaOro,
    bonusObjetivos: bonusObjetivos,
    generarDrop: generarDrop,
    precioVenta: precioVenta
  };
})();
