/* ============================================================
   LEAGUE — clasificación, resultados de jornada y condiciones de fin
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

  // Simula el resto de partidos de la jornada (instantáneo) y registra todo.
  // resultadoJugador: {gh, ga} del partido del jugador ya disputado.
  function cerrarJornada(resultadoJugador) {
    var run = State.run;
    var ronda = run.calendario[run.jornada - 1];
    var resultados = [];
    ronda.forEach(function (p) {
      var esDelJugador = p[0] === 0 || p[1] === 0;
      var gh, ga;
      if (esDelJugador) {
        gh = resultadoJugador.gh; ga = resultadoJugador.ga;
      } else {
        var r = Engine.simInstantanea(run.equipos[p[0]].rating, run.equipos[p[1]].rating);
        gh = r[0]; ga = r[1];
      }
      aplicarResultado(p[0], p[1], gh, ga);
      resultados.push({ h: p[0], a: p[1], gh: gh, ga: ga, jugador: esDelJugador });
    });
    run.resultados.push(resultados);

    // Los rivales mejoran ligeramente con la temporada (presión creciente)
    run.equipos.forEach(function (e) {
      if (!e.esJugador && RNG.chance(0.35)) e.rating = Math.min(88, e.rating + 1);
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

  function puestoJugador() {
    var tabla = clasificacion();
    for (var i = 0; i < tabla.length; i++) {
      if (tabla[i].esJugador) return i + 1;
    }
    return 8;
  }

  // Comprueba fin de run tras cerrar una jornada.
  // Devuelve null si continúa, o {victoria, razon, puesto}
  function comprobarFin() {
    var run = State.run;
    var puesto = puestoJugador();
    if (run.derrotasSeguidas >= 3) {
      return { victoria: false, razon: 'Tres derrotas consecutivas. La directiva te ha despedido.', puesto: puesto };
    }
    if (run.jornada >= 14) {
      if (puesto === 1) {
        return { victoria: true, razon: '¡CAMPEONES! Has conquistado la liga.', puesto: 1 };
      }
      var razon = puesto <= 4
        ? 'Terminaste ' + puesto + 'º. Solo el título valía: la run acaba aquí.'
        : 'Fuera del top 4 (' + puesto + 'º). Temporada para olvidar.';
      return { victoria: false, razon: razon, puesto: puesto };
    }
    return null;
  }

  return {
    cerrarJornada: cerrarJornada,
    clasificacion: clasificacion,
    puestoJugador: puestoJugador,
    comprobarFin: comprobarFin
  };
})();
