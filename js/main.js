/* ============================================================
   MAIN — arranque y flujo de la run:
   menú → gestión/táctica → partido → post-partido → (fin | siguiente)
   ============================================================ */

(function () {

  function nuevaRun() {
    State.nuevaRun();
    UI.resetSeleccion();
    UI.renderManage();
    UI.toast('¡Nueva temporada! Revisa tu once y tu táctica.');
  }

  function jugarPartido() {
    var run = State.run;
    if (!State.onceCompleto()) {
      UI.toast('Necesitas 11 jugadores alineados', 'error');
      AudioFX.error();
      return;
    }
    var esJefe = State.esJefe(run.jornada);
    var rival = State.rivalActual();
    var ctxJugador = Engine.contextoJugador(State.onceActual(), run.staff, {
      esJefe: esJefe,
      debuff: run.debuffProxPartido,
      nombre: run.equipos[0].nombre,
      tactica: run.tactica,
      cohesion: State.cohesionActual(),
      moral: run.moral
    });
    var ctxRival = Engine.contextoIA(rival, esJefe);

    if (run.debuffProxPartido > 0) {
      UI.toast('⚠️ Vestuario desmotivado por el impago: -' + run.debuffProxPartido + ' a todos los atributos', 'error');
    }

    Match.start(ctxJugador, ctxRival, {
      esJefe: esJefe,
      colores: [run.equipos[0].color, rival.color]
    }, function (resultado) {
      postPartido(resultado, rival, esJefe);
    });
  }

  function postPartido(resultado, rival, esJefe) {
    var run = State.run;
    var gf = resultado.gf, gc = resultado.gc;
    var res = gf > gc ? 'V' : gf < gc ? 'D' : 'E';

    // estadísticas de la run
    var s = run.stats;
    s.gf += gf; s.gc += gc;
    if (res === 'V') { s.pg++; run.derrotasSeguidas = 0; if (esJefe) s.jefesGanados++; }
    else if (res === 'E') { s.pe++; run.derrotasSeguidas = 0; }
    else { s.pp++; run.derrotasSeguidas++; }
    resultado.goleadores.forEach(function (g) {
      if (g.team === 0) s.mejorGoleador[g.nombre] = (s.mejorGoleador[g.nombre] || 0) + 1;
    });
    run.debuffProxPartido = 0;

    // actualización por jugador: temporada, forma, condición, sanciones
    var mvp = null;
    resultado.jugadores[0].forEach(function (j) {
      var c = State.cartaPorId(j.cardId);
      if (!c) return;
      c.temporada.pj++;
      c.temporada.goles += j.goles;
      c.temporada.asistencias += j.asis;
      c.temporada.ratingTotal += j.nota;
      c.forma = Math.max(-3, Math.min(3, Math.round((c.forma + (j.nota - 6.4) * 0.5) * 10) / 10));
      c.condicion = Math.max(20, Math.round(c.condicion - (100 - j.stamina) * 0.42 - 6));
      if (j.roja) c.sancion = 1;
      if (!mvp || j.nota > mvp.nota) mvp = j;
    });

    // moral y cohesión táctica
    run.moral = Math.max(25, Math.min(95,
      run.moral + (res === 'V' ? (esJefe ? 12 : 8) : res === 'E' ? 1 : -9)));
    var f = run.tactica.formacion;
    var gainCoh = State.tieneStaff('pizarra') ? 36 : 18;
    run.cohesion[f] = Math.min(100, (run.cohesion[f] || 0) + gainCoh);

    // oro
    var rec = Economy.recompensaOro(res, rival, esJefe);
    var obj = Economy.bonusObjetivos(gf, gc, res, mvp ? mvp.nota : 0);
    var oroTotal = rec.oro + obj.oro;
    run.oro += oroTotal;
    s.oroGanado += oroTotal;

    // lesión post-partido
    var lesion = Economy.quizasLesion();

    // cierra la jornada (el resto se juega con el motor real)
    var p = State.partidoDelJugador(run.jornada);
    var resJornada = League.cerrarJornada({
      gh: p.esLocal ? gf : gc,
      ga: p.esLocal ? gc : gf,
      goleadores: resultado.goleadores
    });
    var otros = resJornada.filter(function (r) { return !r.jugador; });

    var drop = Economy.generarDrop(rival, esJefe, res === 'V');

    UI.renderPost({
      gf: gf, gc: gc, resultado: res, rival: rival, esJefe: esJefe,
      oroTotal: oroTotal,
      detalles: rec.detalles.concat(obj.detalles),
      otros: otros,
      lesion: lesion,
      drop: drop,
      statsPartido: resultado.stats,
      ratings: resultado.jugadores[0],
      goleadores: resultado.goleadores,
      mvp: mvp
    }, continuarTrasPartido);

    if (res === 'V') AudioFX.victoria();
    else if (res === 'D') AudioFX.derrota();
  }

  function continuarTrasPartido() {
    var run = State.run;
    var fin = League.comprobarFin();
    if (fin) {
      run.terminada = true;
      State.guardarMeta({ victoria: fin.victoria, puesto: fin.puesto, pg: run.stats.pg });
      UI.renderEnd(fin);
      return;
    }

    run.jornada++;
    Economy.avanzarLesiones();
    Economy.recuperarJornada();
    var pago = Economy.pagarSalarios();
    if (pago.extra) UI.toast('💎 Mecenas aporta +' + pago.extra + ' 💰');
    if (pago.impago) {
      UI.toast('🚨 ¡No pudiste pagar los ' + pago.total + ' 💰 de salarios! El vestuario está desmotivado.', 'error');
    } else {
      UI.toast('Salarios pagados: -' + pago.total + ' 💰');
    }
    if (run.derrotasSeguidas === 2) {
      UI.toast('☠️ Una derrota más y la directiva te despide', 'error');
    }
    UI.resetSeleccion();
    UI.renderManage();
  }

  function init() {
    UI.init();

    document.getElementById('btn-new-run').onclick = function () {
      AudioFX.click();
      nuevaRun();
    };
    document.getElementById('btn-how').onclick = function () {
      AudioFX.click();
      document.getElementById('how-panel').classList.toggle('hidden');
    };
    document.getElementById('btn-how-close').onclick = function () {
      AudioFX.click();
      document.getElementById('how-panel').classList.add('hidden');
    };
    document.getElementById('btn-mute').onclick = function () {
      var m = AudioFX.toggleMute();
      document.getElementById('btn-mute').textContent = m ? '🔇 Sonido' : '🔊 Sonido';
      if (!m) AudioFX.click();
    };
    document.getElementById('btn-play-match').onclick = function () {
      AudioFX.click();
      jugarPartido();
    };
    document.getElementById('btn-reroll').onclick = function () {
      var r = Economy.reroll();
      if (!r.ok) { UI.toast(r.msg, 'error'); AudioFX.error(); return; }
      AudioFX.buy();
      if (r.gratis) UI.toast('🧮 El Economista consigue un reroll gratis');
      UI.renderManage();
      document.querySelector('.tab[data-tab="tab-shop"]').click();
    };
    document.getElementById('btn-auto-lineup').onclick = function () {
      AudioFX.click();
      State.autoAlinear();
      UI.resetSeleccion();
      UI.renderManage();
      UI.toast('🪄 Once colocado automáticamente');
    };
    document.getElementById('btn-end-menu').onclick = function () {
      AudioFX.click();
      UI.renderMenu();
    };

    UI.renderMenu();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
