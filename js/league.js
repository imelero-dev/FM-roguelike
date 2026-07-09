/* ============================================================
   LEAGUE — clasificación, jornadas (los partidos IA vs IA se
   juegan con el motor real), pichichi y condiciones de fin.
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
    if (!run.pichichi[nombre]) run.pichichi[nombre] = { goles: 0, equipo: equipoIdx };
    run.pichichi[nombre].goles += goles;
  }

  // Simula el resto de la jornada con el motor real y registra todo.
  // resultadoJugador: {gh, ga, goleadores: [{team, nombre}]} — team 0 = jugador
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

    // goleadores del partido del jugador (team 0 = jugador, 1 = rival)
    var rivalIdx = p.esLocal ? p.away : p.home;
    (resultadoJugador.goleadores || []).forEach(function (g) {
      anotarGoleador(g.nombre, g.team === 0 ? 0 : rivalIdx, 1);
    });

    run.resultados.push(resultados);

    // los rivales mejoran ligeramente con la temporada
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

  function pichichi(n) {
    var run = State.run;
    return Object.keys(run.pichichi).map(function (nombre) {
      return { nombre: nombre, goles: run.pichichi[nombre].goles, equipo: run.equipos[run.pichichi[nombre].equipo] };
    }).sort(function (a, b) { return b.goles - a.goles; }).slice(0, n || 6);
  }

  function puestoJugador() {
    var tabla = clasificacion();
    for (var i = 0; i < tabla.length; i++) {
      if (tabla[i].esJugador) return i + 1;
    }
    return 8;
  }

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
    pichichi: pichichi,
    puestoJugador: puestoJugador,
    comprobarFin: comprobarFin
  };
})();

if (typeof module !== 'undefined') module.exports = League;
