/* ============================================================
   MAIN — arranque y flujo de la run:
   menú → gestión → partido → post-partido → (fin | siguiente jornada)
   ============================================================ */

(function () {

  function nuevaRun() {
    State.nuevaRun();
    UI.resetSeleccion();
    UI.renderManage();
    UI.toast('¡Nueva temporada! Revisa tu once y sal a ganar.');
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
      nombre: run.equipos[0].nombre
    });
    var ctxRival = Engine.contextoIA(rival, esJefe);

    if (run.debuffProxPartido > 0) {
      UI.toast('⚠️ Vestuario desmotivado por el impago: -' + run.debuffProxPartido + ' a todos los stats', 'error');
    }

    Match.start(ctxJugador, ctxRival, {
      esJefe: esJefe,
      colores: [run.equipos[0].color, rival.color],
      lineupIds: run.alineacion.slice()
    }, function (resultado) {
      postPartido(resultado, rival, esJefe);
    });
  }

  function postPartido(resultado, rival, esJefe) {
    var run = State.run;
    var gf = resultado.gf, gc = resultado.gc;
    var res = gf > gc ? 'V' : gf < gc ? 'D' : 'E';

    // estadísticas
    var s = run.stats;
    s.gf += gf; s.gc += gc;
    if (res === 'V') { s.pg++; run.derrotasSeguidas = 0; if (esJefe) s.jefesGanados++; }
    else if (res === 'E') { s.pe++; run.derrotasSeguidas = 0; }
    else { s.pp++; run.derrotasSeguidas++; }
    resultado.goleadores.forEach(function (g) {
      if (g.team === 0) s.mejorGoleador[g.nombre] = (s.mejorGoleador[g.nombre] || 0) + 1;
    });
    run.debuffProxPartido = 0;

    // oro
    var rec = Economy.recompensaOro(res, rival, esJefe);
    var obj = Economy.bonusObjetivos(gf, gc, res);
    var oroTotal = rec.oro + obj.oro;
    run.oro += oroTotal;
    s.oroGanado += oroTotal;

    // lesión aleatoria
    var lesion = Economy.quizasLesion();

    // cierra la jornada en la liga
    var p = State.partidoDelJugador(run.jornada);
    var resJornada = League.cerrarJornada({
      gh: p.esLocal ? gf : gc,
      ga: p.esLocal ? gc : gf
    });
    var otros = resJornada.filter(function (r) { return !r.jugador; });

    // drop de cartas
    var drop = Economy.generarDrop(rival, esJefe, res === 'V');

    UI.renderPost({
      gf: gf, gc: gc, resultado: res, rival: rival, esJefe: esJefe,
      oroTotal: oroTotal,
      detalles: rec.detalles.concat(obj.detalles),
      otros: otros,
      lesion: lesion,
      drop: drop
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

    // nueva jornada: lesiones avanzan y se pagan salarios
    run.jornada++;
    Economy.avanzarLesiones();
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
