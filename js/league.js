/* ============================================================
   LEAGUE — table, matchdays (AI vs AI fixtures are played
   with the real engine), top scorers and end-of-run conditions.
   ============================================================ */

var League = (function () {

  function aplicarResultado(hIdx, aIdx, gh, ga) {
    var run = State.run;
    var h = run.equipos[hIdx], a = run.equipos[aIdx];
    h.pj++; a.pj++;
    h.gf += gh; h.gc += ga;
    a.gf += ga; a.gc += gh;
    if (gh > ga) { h.pg++; a.pp++; h.pts += 3; }
    else if (gh < ga) { a.pg++; h.pp++; a.pts += 3; }
    else { h.pe++; a.pe++; h.pts++; a.pts++; }
  }

  function anotarGoleador(nombre, equipoIdx, goles) {
    var run = State.run;
    if (!run.topScorers[nombre]) run.topScorers[nombre] = { goles: 0, equipo: equipoIdx };
    run.topScorers[nombre].goles += goles;
  }

  // Simulates the rest of the matchday with the real engine and records everything.
  // resultadoJugador: {gh, ga, goleadores: [{team, nombre}]} — team 0 = player
  function cerrarJornada(resultadoJugador) {
    var run = State.run;
    var ronda = run.calendario[run.jornada - 1];
    var p = State.partidoDelJugador(run.jornada);
    var resultados = [];

    ronda.forEach(function (par) {
      var esDelJugador = par[0] === 0 || par[1] === 0;
      var gh, ga;
      if (esDelJugador) {
        gh = resultadoJugador.gh; ga = resultadoJugador.ga;
      } else {
        var r = Engine.simRapida(run.equipos[par[0]], run.equipos[par[1]]);
        gh = r.gf; ga = r.gc;
        r.goleadores.forEach(function (g) {
          anotarGoleador(g.nombre, g.team === 0 ? par[0] : par[1], 1);
        });
      }
      aplicarResultado(par[0], par[1], gh, ga);
      resultados.push({ h: par[0], a: par[1], gh: gh, ga: ga, jugador: esDelJugador });
    });

    // scorers from the player's match (team 0 = player, 1 = opponent)
    var rivalIdx = p.esLocal ? p.away : p.home;
    (resultadoJugador.goleadores || []).forEach(function (g) {
      anotarGoleador(g.nombre, g.team === 0 ? 0 : rivalIdx, 1);
    });

    run.resultados.push(resultados);

    // opponents improve slightly as the season goes on
    run.equipos.forEach(function (e) {
      if (!e.esJugador && RNG.chance(0.35)) e.rating = Math.min(80, e.rating + 1);
    });
    return resultados;
  }

  function clasificacion() {
    var run = State.run;
    return run.equipos.slice().sort(function (a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      var dgA = a.gf - a.gc, dgB = b.gf - b.gc;
      if (dgB !== dgA) return dgB - dgA;
      return b.gf - a.gf;
    });
  }

  function topScorers(n) {
    var run = State.run;
    return Object.keys(run.topScorers).map(function (nombre) {
      return { nombre: nombre, goles: run.topScorers[nombre].goles, equipo: run.equipos[run.topScorers[nombre].equipo] };
    }).sort(function (a, b) { return b.goles - a.goles; }).slice(0, n || 6);
  }

  function puestoJugador() {
    var tabla = clasificacion();
    for (var i = 0; i < tabla.length; i++) {
      if (tabla[i].esJugador) return i + 1;
    }
    return 8;
  }

  // 1 → "1st", 2 → "2nd", ... (display only)
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function comprobarFin() {
    var run = State.run;
    var puesto = puestoJugador();
    if (run.derrotasSeguidas >= 3) {
      return { victoria: false, razon: 'Three defeats on the bounce. The board has sacked you.', puesto: puesto };
    }
    if (run.jornada >= 14) {
      if (puesto === 1) {
        return { victoria: true, razon: 'CHAMPIONS! You\'ve won the league.', puesto: 1 };
      }
      var razon = puesto <= 4
        ? 'You finished ' + ordinal(puesto) + '. Only the title would do: the run ends here.'
        : 'Outside the top 4 (' + ordinal(puesto) + '). A season to forget.';
      return { victoria: false, razon: razon, puesto: puesto };
    }
    return null;
  }

  // Season review data for the end screen (pure: reads the run, changes nothing)
  function resumenTemporada() {
    var run = State.run;
    var forma = [];
    run.resultados.forEach(function (jornada, j) {
      var r = jornada.filter(function (x) { return x.jugador; })[0];
      if (!r) return;
      var local = r.h === 0;
      var gf = local ? r.gh : r.ga, gc = local ? r.ga : r.gh;
      forma.push({
        jornada: j + 1, gf: gf, gc: gc,
        res: gf > gc ? 'V' : gf < gc ? 'D' : 'E',
        rival: run.equipos[local ? r.a : r.h].nombre,
        jefe: State.esJefe(j + 1)
      });
    });

    var plantilla = run.plantilla.map(function (c) {
      var t = c.temporada;
      return {
        id: c.id, nombre: c.nombre, pos: c.pos, pj: t.pj, goles: t.goles, asistencias: t.asistencias,
        media: t.pj ? t.ratingTotal / t.pj : 0
      };
    });
    var orden = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
    plantilla.sort(function (a, b) { return (orden[a.pos] - orden[b.pos]) || (b.pj - a.pj); });

    function mejorPor(campo, minimo) {
      var best = null;
      plantilla.forEach(function (j) {
        if (j.pj >= minimo && j[campo] > 0 && (!best || j[campo] > best[campo])) best = j;
      });
      return best;
    }
    // player of the season needs a third of the matches played to qualify
    var minPj = Math.max(1, Math.ceil(forma.length / 3));

    return {
      forma: forma,
      plantilla: plantilla,
      mejor: mejorPor('media', minPj),
      goleador: mejorPor('goles', 1),
      asistente: mejorPor('asistencias', 1),
      ligaGoleador: topScorers(1)[0] || null
    };
  }

  return {
    resumenTemporada: resumenTemporada,
    cerrarJornada: cerrarJornada,
    clasificacion: clasificacion,
    topScorers: topScorers,
    puestoJugador: puestoJugador,
    comprobarFin: comprobarFin
  };
})();

if (typeof module !== 'undefined') module.exports = League;
