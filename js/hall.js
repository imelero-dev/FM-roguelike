/* ============================================================
   HALL — the Hall of Fame: a persistent, ranked record of every
   finished run, plus the "new record" checks for the end screen.
   Entries are small self-contained snapshots, so any past season
   card can be redrawn from its entry alone.
   ============================================================ */

var Hall = (function () {

  var KEY = 'relegation-run:hall';
  var VERSION = 1;
  var MAX_ENTRIES = 20; // RR-4 spec: up to 20 season summaries

  // ---- storage ----
  function leer() {
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!data || data.version !== VERSION || !Array.isArray(data.entries)) return [];
      return data.entries.filter(valida);
    } catch (e) { return []; }
  }

  function escribir(entries) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, entries: entries }));
      return true;
    } catch (e) { return false; /* storage full or disabled */ }
  }

  function valida(e) {
    return !!e && typeof e.id === 'string' && typeof e.puesto === 'number' &&
      typeof e.pts === 'number' && Array.isArray(e.forma) && !!e.equipo;
  }

  // ---- ranking ----
  // Football order: titles first, then final position, points, goal
  // difference, goals scored. Ties go to whoever got there first.
  function comparar(a, b) {
    return (b.victoria - a.victoria) ||
      (a.puesto - b.puesto) ||
      (b.pts - a.pts) ||
      ((b.gf - b.gc) - (a.gf - a.gc)) ||
      (b.gf - a.gf) ||
      (a.fecha - b.fecha);
  }

  function ranking(entries) { return (entries || leer()).slice().sort(comparar); }
  function recientes(entries) { return (entries || leer()).slice().sort(function (a, b) { return b.fecha - a.fecha; }); }

  function rachaVictorias(forma) {
    var best = 0, cur = 0;
    forma.forEach(function (f) { cur = f.res === 'V' ? cur + 1 : 0; best = Math.max(best, cur); });
    return best;
  }

  // ---- building an entry from the finished run ----
  // review = League.resumenTemporada(), fin = League.comprobarFin()
  function crearEntrada(run, fin, review, numero) {
    var yo = run.equipos[0];
    var s = run.stats;
    function persona(j, campo) {
      if (!j) return null;
      var o = { nombre: j.nombre, id: j.id, pos: j.pos };
      o[campo] = campo === 'media' ? Math.round(j.media * 100) / 100 : j[campo];
      return o;
    }
    return {
      id: run.id || ('r' + Date.now().toString(36)),
      numero: numero || null,
      fecha: Date.now(),
      equipo: { nombre: yo.nombre, color: yo.color },
      victoria: !!fin.victoria,
      despedido: run.derrotasSeguidas >= 3,
      puesto: fin.puesto,
      razon: fin.razon,
      pg: s.pg, pe: s.pe, pp: s.pp, gf: s.gf, gc: s.gc,
      pts: s.pg * 3 + s.pe,
      jornadas: run.calendario.length,
      forma: review.forma.map(function (f) {
        return { res: f.res, gf: f.gf, gc: f.gc, jefe: !!f.jefe, rival: f.rival };
      }),
      formacion: run.tactica.formacion,
      jefes: s.jefesGanados,
      oro: s.oroGanado,
      mvp: persona(review.mejor, 'media'),
      goleador: persona(review.goleador, 'goles'),
      asistente: persona(review.asistente, 'asistencias'),
      xi: rarezasXI(run)
    };
  }

  // how many of each rarity were in the last starting XI
  function rarezasXI(run) {
    var n = { legendaria: 0, epica: 0, rara: 0, comun: 0 }, hay = false;
    (run.alineacion || []).forEach(function (id) {
      var c = id && run.plantilla.filter(function (p) { return p.id === id; })[0];
      if (c && n[c.rareza] !== undefined) { n[c.rareza]++; hay = true; }
    });
    return hay ? n : null;
  }

  // ---- records: what does this entry beat? ----
  function records(entry, previas) {
    var out = [];
    var titulos = previas.filter(function (e) { return e.victoria; }).length;
    if (entry.victoria && titulos === 0) out.push({ key: 'first-title', label: 'First title' });
    if (!previas.length) return out;

    function max(fn) { return previas.reduce(function (m, e) { return Math.max(m, fn(e)); }, -Infinity); }
    var mejorPuesto = previas.reduce(function (m, e) { return Math.min(m, e.puesto); }, Infinity);
    if (entry.puesto < mejorPuesto) out.push({ key: 'best-finish', label: 'Best finish' });
    if (entry.pts > max(function (e) { return e.pts; })) out.push({ key: 'most-points', label: 'Most points' });
    if (entry.gf > max(function (e) { return e.gf; })) out.push({ key: 'most-goals', label: 'Most goals' });
    var racha = rachaVictorias(entry.forma);
    if (racha >= 3 && racha > max(function (e) { return rachaVictorias(e.forma); })) {
      out.push({ key: 'win-streak', label: 'Longest win streak (' + racha + ')' });
    }
    return out;
  }

  // Where would this entry land, and what records does it set? (changes nothing)
  function evaluar(entry) {
    var previas = leer().filter(function (e) { return e.id !== entry.id; });
    var todas = ranking(previas.concat([entry]));
    return {
      entry: entry,
      rank: todas.indexOf(entry) + 1,
      total: todas.length,
      records: records(entry, previas)
    };
  }

  // Store the entry (idempotent per run id) and report its rank and records.
  function registrar(entry) {
    var info = evaluar(entry);
    var entries = leer().filter(function (e) { return e.id !== entry.id; });
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      // trim from the bottom of the ranking, never the newest entry
      var orden = ranking(entries).filter(function (e) { return e !== entry; });
      var fuera = orden.slice(MAX_ENTRIES - 1);
      entries = entries.filter(function (e) { return fuera.indexOf(e) < 0; });
    }
    info.guardado = escribir(entries);
    return info;
  }

  // Career totals for the Hall of Fame header
  function resumen(entries) {
    entries = entries || leer();
    var r = { runs: entries.length, titulos: 0, mejorPuesto: null, mejorPts: 0, goles: 0, mejorRacha: 0 };
    entries.forEach(function (e) {
      if (e.victoria) r.titulos++;
      if (r.mejorPuesto === null || e.puesto < r.mejorPuesto) r.mejorPuesto = e.puesto;
      r.mejorPts = Math.max(r.mejorPts, e.pts);
      r.goles += e.gf;
      r.mejorRacha = Math.max(r.mejorRacha, rachaVictorias(e.forma));
    });
    return r;
  }

  function buscar(id) {
    return leer().filter(function (e) { return e.id === id; })[0] || null;
  }

  // Rank of a stored entry within the current Hall of Fame
  function posicion(id) {
    var orden = ranking();
    for (var i = 0; i < orden.length; i++) if (orden[i].id === id) return { rank: i + 1, total: orden.length };
    return null;
  }

  return {
    KEY: KEY,
    MAX_ENTRIES: MAX_ENTRIES,
    leer: leer,
    comparar: comparar,
    ranking: ranking,
    recientes: recientes,
    rachaVictorias: rachaVictorias,
    crearEntrada: crearEntrada,
    evaluar: evaluar,
    registrar: registrar,
    resumen: resumen,
    buscar: buscar,
    posicion: posicion
  };
})();

if (typeof module !== 'undefined') module.exports = Hall;
