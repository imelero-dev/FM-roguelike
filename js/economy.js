/* ============================================================
   ECONOMY — oro, tienda, salarios, recompensas, lesiones,
   condición física y forma entre jornadas.
   ============================================================ */

var Economy = (function () {

  // ---- tienda ----
  function generarTienda() {
    var run = State.run;
    var boost = State.tieneStaff('cazatalentos');
    var cartas = [];
    for (var i = 0; i < 4; i++) {
      var rareza = Gen.rarezaDrop(47 + run.jornada * 2, false, boost);
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
    run.debuffProxPartido = impago ? 2 : 0; // -2 a todos los atributos
    return { total: total, extra: extra, impago: impago };
  }

  function avanzarLesiones() {
    State.run.plantilla.forEach(function (c) {
      if (c.lesion > 0) c.lesion--;
      if (c.sancion > 0) c.sancion--;
    });
  }

  // recuperación de condición y decaimiento de forma entre jornadas
  function recuperarJornada() {
    var prep = State.tieneStaff('preparador') ? 10 : 0;
    State.run.plantilla.forEach(function (c) {
      c.condicion = Math.min(100, Math.round(c.condicion + 15 + c.attrs.resistencia * 0.55 + prep));
      c.forma = Math.round(c.forma * 0.75 * 10) / 10;
    });
  }

  function quizasLesion() {
    // tras el partido: prob. de lesión, mayor si el once acabó fundido
    var run = State.run;
    var once = State.onceActual().filter(Boolean);
    if (!once.length) return null;
    var media = once.reduce(function (s, c) { return s + c.condicion; }, 0) / once.length;
    var p = 0.10 + (media < 65 ? 0.10 : media < 80 ? 0.04 : 0);
    if (!RNG.chance(p)) return null;
    // víctima ponderada por cansancio
    var victima = RNG.weighted(once.map(function (c) {
      return { v: c, w: Math.max(5, 115 - c.condicion) };
    }));
    // no lesiona si dejaría la formación actual sin efectivos
    var REQ = State.reqActual();
    var sanos = run.plantilla.filter(function (c) {
      return c.pos === victima.pos && State.disponible(c);
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
    var oro = 0;
    var detalles = [];
    if (resultado === 'V') {
      var base = 100;
      var dif = Math.max(0, rival.rating - 50) * 3;
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

  function bonusObjetivos(gf, gc, resultado, mvpNota) {
    var detalles = [];
    var oro = 0;
    if (resultado === 'V' && gc === 0) { oro += 30; detalles.push({ txt: 'Portería a cero', oro: 30 }); }
    if (gf >= 3) { oro += 30; detalles.push({ txt: 'Goleada (3+ goles)', oro: 30 }); }
    if (mvpNota >= 8.5) { oro += 25; detalles.push({ txt: 'Actuación estelar (nota ' + mvpNota + ')', oro: 25 }); }
    return { oro: oro, detalles: detalles };
  }

  // Drop de cartas ponderado por dificultad; el jugador elige 1
  function generarDrop(rival, esJefe, gano) {
    var n = 3 + (State.tieneStaff('ojeador') ? 1 : 0);
    if (!gano && !esJefe && !RNG.chance(0.5)) n = Math.max(2, n - 1);
    var cartas = [];
    var boost = State.tieneStaff('cazatalentos');
    var garantiaAlta = esJefe;
    for (var i = 0; i < n; i++) {
      var rareza = Gen.rarezaDrop(rival.rating, esJefe, boost);
      if (garantiaAlta && i === 0 && rareza !== 'epica' && rareza !== 'legendaria') {
        rareza = RNG.chance(0.8) ? 'epica' : 'legendaria';
      }
      cartas.push(Gen.cartaJugador(null, rareza));
    }
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
    recuperarJornada: recuperarJornada,
    quizasLesion: quizasLesion,
    recompensaOro: recompensaOro,
    bonusObjetivos: bonusObjetivos,
    generarDrop: generarDrop,
    precioVenta: precioVenta
  };
})();

if (typeof module !== 'undefined') module.exports = Economy;
