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

  return {
    cerrarJornada: cerrarJornada,
    clasificacion: clasificacion,
    topScorers: topScorers,
    puestoJugador: puestoJugador,
    comprobarFin: comprobarFin
  };
})();

if (typeof module !== 'undefined') module.exports = League;
