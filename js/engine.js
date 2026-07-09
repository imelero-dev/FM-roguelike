/* ============================================================
   ENGINE — motor de simulación de partido, tick-based (1 tick = 1 min)
   Independiente del renderizado: emite eventos que consume la UI/Phaser.
   ============================================================ */

var Engine = (function () {

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function avg(arr) { return arr.length ? arr.reduce(function (s, v) { return s + v; }, 0) / arr.length : 50; }

  // ---- Contexto de equipo a partir de un once del jugador ----
  // lineup: array de 11 cartas (0 POR, 1-4 DEF, 5-7 MED, 8-10 DEL)
  function contextoJugador(lineup, staff, opts) {
    var ap = Synergy.aplicar(lineup, staff, opts);
    var js = ap.jugadores;
    function slice(a, b) { return js.slice(a, b).filter(Boolean); }
    var por = slice(0, 1), def = slice(1, 5), med = slice(5, 8), del = slice(8, 11);
    return {
      nombre: opts && opts.nombre || 'Tu equipo',
      esIA: false,
      jugadores: js,
      hooks: ap.hooks,
      sinergias: ap.sinergias,
      grupos: { por: por, def: def, med: med, del: del },
      clutchAplicado: false
    };
  }

  // ---- Contexto sintético para un rival IA a partir de su rating ----
  function contextoIA(equipo, esJefe) {
    var r = equipo.rating + (esJefe ? 8 : 0);
    function mk(pos, n) {
      var arr = [];
      for (var i = 0; i < n; i++) {
        var base = clamp(r + RNG.int(-6, 6), 30, 99);
        var s = { atq: base, def: base, pas: base, vel: base };
        if (pos === 'POR') { s.def = clamp(base + 6, 30, 99); s.atq = 25; }
        if (pos === 'DEF') { s.def = clamp(base + 5, 30, 99); s.atq = clamp(base - 10, 20, 99); }
        if (pos === 'DEL') { s.atq = clamp(base + 5, 30, 99); s.def = clamp(base - 12, 20, 99); }
        arr.push({
          card: { id: 'ia_' + pos + i, nombre: Gen.nombreJugador(), pos: pos, habilidades: [], rareza: 'comun' },
          eff: s
        });
      }
      return arr;
    }
    var por = mk('POR', 1), def = mk('DEF', 4), med = mk('MED', 3), del = mk('DEL', 3);
    return {
      nombre: equipo.nombre,
      esIA: true,
      jugadores: por.concat(def, med, del),
      hooks: { muroZona: 0, cerrojo: 0, motorPase: 0, velocistaAvance: 0, francotirador: 0, clutchIds: [], killerIds: {}, abilityCast: [] },
      grupos: { por: por, def: def, med: med, del: del },
      clutchAplicado: false
    };
  }

  // ---- Agregados por línea (se recalculan cuando entra el clutch) ----
  function lineas(ctx, minuto) {
    function st(j, k) {
      var v = j.eff[k];
      if (minuto >= 75 && ctx.hooks.clutchIds.indexOf(j.card.id) >= 0) v *= 1.2;
      return v;
    }
    function agg(grupo, k) { return avg(grupo.map(function (j) { return st(j, k); })); }
    var g = ctx.grupos;
    return {
      porDef: agg(g.por, 'def'),
      defDef: agg(g.def, 'def'), defPas: agg(g.def, 'pas'),
      midDef: agg(g.med, 'def'), midPas: agg(g.med, 'pas') * (1 + ctx.hooks.motorPase), midVel: agg(g.med, 'vel'),
      attAtq: agg(g.del, 'atq'), attDef: agg(g.del, 'def'), attVel: agg(g.del, 'vel')
    };
  }

  function elegirTirador(ctx, minuto) {
    var pool = ctx.grupos.del.concat(ctx.grupos.med);
    var entries = pool.map(function (j) {
      var w = j.eff.atq;
      if (minuto >= 75 && ctx.hooks.clutchIds.indexOf(j.card.id) >= 0) w *= 1.2;
      return { v: j, w: Math.max(1, w) };
    });
    return RNG.weighted(entries);
  }

  // ============ MOTOR PRINCIPAL ============
  function MatchEngine(home, away, opts) {
    this.home = home;   // contexto (jugador o IA)
    this.away = away;
    this.opts = opts || {};
    this.minuto = 0;
    this.goles = [0, 0];  // [home, away]
    this.stats = { tiros: [0, 0], ocasiones: [0, 0] };
    this.posesion = RNG.chance(0.5) ? 0 : 1; // 0 = home
    this.saqueInicial = this.posesion;
    this.zona = 1; // 0 = defensa propia del poseedor, 1 = medio, 2 = ataque
    this.terminado = false;
    this.goleadores = [];
  }

  MatchEngine.prototype.ctxDe = function (i) { return i === 0 ? this.home : this.away; };

  MatchEngine.prototype.step = function () {
    if (this.terminado) return [];
    var ev = [];
    var self = this;
    function push(t, extra) {
      var e = { t: t, min: self.minuto, team: self.posesion };
      if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
      ev.push(e);
    }

    if (this.minuto === 0) {
      push('inicio');
      // habilidades pasivas al pitido inicial (feedback visual)
      [this.home, this.away].forEach(function (ctx, i) {
        ctx.hooks.abilityCast.forEach(function (ab) {
          ev.push({ t: 'habilidad', min: 0, team: i, jugador: ab.card.nombre, hab: ab.hab, cardId: ab.card.id });
        });
      });
    }

    if (this.minuto === 45) {
      push('descanso');
      this.posesion = 1 - this.saqueInicial;
      this.zona = 1;
    }

    if (this.minuto === 75) {
      // entra el modo clutch: anuncia jugadores afectados
      [this.home, this.away].forEach(function (ctx, i) {
        ctx.hooks.clutchIds.forEach(function (id) {
          var j = ctx.jugadores.filter(function (x) { return x && x.card.id === id; })[0];
          if (j) ev.push({ t: 'habilidad', min: 75, team: i, jugador: j.card.nombre, hab: 'clutch', cardId: id });
        });
      });
    }

    var att = this.ctxDe(this.posesion);
    var defTeam = this.ctxDe(1 - this.posesion);
    var LA = lineas(att, this.minuto);
    var LD = lineas(defTeam, this.minuto);

    if (this.zona < 2) {
      // intento de avance
      var aVal, dVal;
      if (this.zona === 0) {
        aVal = LA.defPas * 0.5 + LA.midPas * 0.3 + LA.midVel * 0.2;
        dVal = LD.attDef * 0.5 + LD.midDef * 0.5;
      } else {
        aVal = LA.midPas * 0.5 + LA.midVel * 0.25 + LA.attVel * 0.25;
        dVal = LD.midDef * 0.4 + LD.defDef * 0.6;
      }
      var pAv = clamp(0.52 + (aVal - dVal) / 130 + att.hooks.velocistaAvance, 0.15, 0.88);
      if (RNG.chance(pAv)) {
        this.zona++;
        push('avance', { zona: this.zona });
      } else {
        push('perdida');
        this.posesion = 1 - this.posesion;
        this.zona = this.zona === 0 ? 2 : 1;
      }
    } else {
      // zona de ataque: ¿ocasión?
      var pOc = clamp(0.34 + (LA.attAtq - LD.defDef) / 140 + att.hooks.francotirador, 0.10, 0.78);
      if (RNG.chance(pOc)) {
        this.stats.ocasiones[this.posesion]++;
        var tirador = elegirTirador(att, this.minuto);
        var atqT = tirador.eff.atq;
        if (this.minuto >= 75 && att.hooks.clutchIds.indexOf(tirador.card.id) >= 0) atqT *= 1.2;
        var pGol = clamp(0.30 + (atqT - LD.porDef) / 150, 0.06, 0.72);
        var esKiller = !!att.hooks.killerIds[tirador.card.id];
        if (esKiller) pGol *= 1.25;
        pGol *= (1 - defTeam.hooks.muroZona);
        pGol *= (1 - defTeam.hooks.cerrojo);
        this.stats.tiros[this.posesion]++;
        push('ocasion', { jugador: tirador.card.nombre, cardId: tirador.card.id });
        if (esKiller) push('habilidad', { jugador: tirador.card.nombre, hab: 'killer', cardId: tirador.card.id });
        if (RNG.chance(pGol)) {
          this.goles[this.posesion]++;
          this.goleadores.push({ team: this.posesion, min: this.minuto, nombre: tirador.card.nombre });
          push('gol', { jugador: tirador.card.nombre, cardId: tirador.card.id, marcador: this.goles.slice() });
        } else {
          var parada = RNG.chance(0.6);
          if (parada && defTeam.hooks.muroZona > 0) push('habilidad', { jugador: 'Defensa', hab: 'muro', team: 1 - this.posesion });
          push(parada ? 'parada' : 'fuera', { jugador: tirador.card.nombre });
        }
        this.posesion = 1 - this.posesion;
        this.zona = 0;
      } else {
        // pierde la ocasión de generar: 50% recicla, 50% pérdida
        if (RNG.chance(0.5)) {
          push('circula');
        } else {
          push('perdida');
          this.posesion = 1 - this.posesion;
          this.zona = 0;
        }
      }
    }

    this.minuto++;
    if (this.minuto >= 90) {
      this.terminado = true;
      ev.push({ t: 'final', min: 90, marcador: this.goles.slice() });
    }
    return ev;
  };

  MatchEngine.prototype.runAll = function () {
    var all = [];
    while (!this.terminado) all = all.concat(this.step());
    return { goles: this.goles.slice(), eventos: all, goleadores: this.goleadores, stats: this.stats };
  };

  // Resultado instantáneo entre dos IAs por rating (para el resto de la jornada)
  function simInstantanea(ratingA, ratingB) {
    var diff = (ratingA - ratingB) / 10;
    function goles(bias) {
      var esperados = clamp(1.35 + bias * 0.55, 0.2, 4);
      var g = 0;
      for (var i = 0; i < 5; i++) if (RNG.chance(esperados / 5)) g++;
      return g;
    }
    return [goles(diff), goles(-diff)];
  }

  return {
    MatchEngine: MatchEngine,
    contextoJugador: contextoJugador,
    contextoIA: contextoIA,
    simInstantanea: simInstantanea
  };
})();
