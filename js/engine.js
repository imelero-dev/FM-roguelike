/* ============================================================
   ENGINE — motor de partido continuo y espacial.
   Campo de 105×68 unidades. 22 agentes con ancla de formación
   que se desplaza con el balón, la posesión, la mentalidad y
   la amplitud. El balón es una entidad física: los pases se
   planifican (receptor, error por atributos, intercepciones),
   los tiros se resuelven contra el portero, hay regates,
   entradas, faltas, tarjetas, penaltis, córners, saques de
   banda/puerta, remates de cabeza a los centros, fatiga,
   ratings por jugador y xG.

   El tiempo del motor son "segundos de visualización": un
   partido dura 94 s a velocidad x1 (2 partes de 47 s = 90').
   El mismo step(dt) sirve para el render en Phaser y para la
   simulación headless (skip y partidos IA vs IA).
   ============================================================ */

var Engine = (function () {

  var CAMPO = { w: 105, h: 68 };
  var MEDIA_PARTE = 47;      // segundos de visualización por parte
  var GOL_Y = 3.66;          // semiancho de la portería
  var AREA_X = 16.5, AREA_Y = 20.15; // caja: x<16.5, |y-34|<20.15

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function gauss() { return (Math.random() + Math.random() + Math.random()) / 1.5 - 1; }

  // coordenadas locales de ataque: ax = profundidad hacia la portería rival
  function axOf(team, x) { return team === 0 ? x : CAMPO.w - x; }
  function fxOf(team, ax) { return team === 0 ? ax : CAMPO.w - ax; }
  function ayOf(team, y) { return team === 0 ? y : CAMPO.h - y; }
  function fyOf(team, ay) { return team === 0 ? ay : CAMPO.h - ay; }

  var AMP_SCALE = { estrecha: 0.82, normal: 1, ancha: 1.15 };
  var KX_ROL = { GK: 0.03, CB: 0.26, FB: 0.30, WB: 0.34, DM: 0.30, CM: 0.34, WM: 0.36, AM: 0.38, W: 0.40, ST: 0.42 };
  var KY_ROL = { GK: 0.10, CB: 0.22, FB: 0.26, WB: 0.30, DM: 0.30, CM: 0.32, WM: 0.30, AM: 0.32, W: 0.24, ST: 0.22 };

  // ---------- construcción de contextos de equipo ----------

  // Once del jugador → equipo del motor.
  // lineup: 11 cartas alineadas en el ORDEN de los slots de la formación.
  function contextoJugador(lineup, staff, opts) {
    opts = opts || {};
    var tactica = opts.tactica || Formations.tacticaBase();
    var ap = Synergy.aplicar(lineup, staff, {
      esJefe: opts.esJefe, debuff: opts.debuff, moral: opts.moral
    });
    var slots = Formations.DEFS[tactica.formacion].slots;
    var jugadores = ap.jugadores.map(function (j, i) {
      var sl = slots[i];
      return {
        cardId: j.card.id,
        nombre: j.card.nombre,
        pos: sl.pos,
        rol: sl.rol,
        slotX: sl.x,
        slotY: sl.y,
        a: j.attrs,
        habs: j.habs,
        condF: 0.75 + 0.25 * ((j.card.condicion === undefined ? 100 : j.card.condicion) / 100)
      };
    });
    return {
      nombre: opts.nombre || 'Tu equipo',
      esIA: false,
      tactica: tactica,
      cohesion: opts.cohesion === undefined ? 60 : opts.cohesion,
      jugadores: jugadores,
      castList: ap.castList,
      sinergias: ap.sinergias
    };
  }

  // Equipo IA → equipo del motor (usa su plantilla generada por formación)
  function contextoIA(equipo, esJefe) {
    var crecimiento = (equipo.rating - (equipo.ratingBase || equipo.rating)) * 0.18;
    var extra = crecimiento + (esJefe ? 1.2 : 0);
    var slots = Formations.DEFS[equipo.tactica.formacion].slots;
    var jugadores = equipo.plantilla.map(function (j, i) {
      var sl = slots[i];
      var a = {};
      Object.keys(j.attrs).forEach(function (k) { a[k] = clamp(j.attrs[k] + extra, 1, 22); });
      return {
        cardId: j.id, nombre: j.nombre, pos: sl.pos, rol: sl.rol,
        slotX: sl.x, slotY: sl.y, a: a,
        habs: { clutch: false, killer: false, motor: false, franco: false },
        condF: 1
      };
    });
    return {
      nombre: equipo.nombre,
      esIA: true,
      tactica: equipo.tactica,
      cohesion: 78,
      jugadores: jugadores,
      castList: [],
      sinergias: []
    };
  }

  // ============ MOTOR ============

  function MatchEngine(home, away, opts) {
    this.opts = opts || {};
    this.teams = [home, away];
    this.marcador = [0, 0];
    this.t = 0;
    this.half = 1;
    this.minuto = 0;
    this.terminado = false;
    this.eventos = [];
    this.goleadores = [];
    this.fase = null;
    this.taskTimer = 0;
    this.clutchAvisado = false;
    this.pausado = false; // descanso en modo visual

    var vent = Formations.ventajas(home.tactica.formacion, away.tactica.formacion);
    this.mod = [
      { centro: vent.centro, banda: vent.banda },
      { centro: -vent.centro, banda: -vent.banda }
    ];

    this.stats = [this._statsVacias(), this._statsVacias()];
    this.players = [[], []];
    var self = this;
    this.teams.forEach(function (T, team) {
      T.jugadores.forEach(function (j, i) {
        var ampS = AMP_SCALE[T.tactica.amplitud] || 1;
        var ayl = 34 + (j.slotY * CAMPO.h - 34) * ampS;
        var p = {
          team: team, i: i,
          cardId: j.cardId, nombre: j.nombre, pos: j.pos, rol: j.rol,
          slotAx: j.slotX * CAMPO.w, slotAy: ayl,
          a: j.a, habs: j.habs, condF: j.condF,
          x: fxOf(team, j.slotX * CAMPO.w), y: fyOf(team, ayl),
          vx: 0, vy: 0,
          stamina: 100,
          task: null, decCd: Math.random() * 0.4, tackleCd: 0, runCd: 2 + Math.random() * 4,
          stunned: 0,
          amarilla: false, roja: false, off: false,
          wPhase: Math.random() * 6.28, wPhase2: Math.random() * 6.28,
          wAmp: (1 - (T.cohesion || 60) / 100) * 4.5 + Math.max(0, 15 - j.a.colocacion) * 0.18,
          nota: 6.0,
          st: { goles: 0, asis: 0, tiros: 0, aPuerta: 0, pases: 0, pasesOk: 0, entradas: 0, faltas: 0, paradas: 0, toques: 0 }
        };
        self.players[team].push(p);
      });
    });

    this.ball = { x: 52.5, y: 34, z: 0, vx: 0, vy: 0, plan: null, owner: null, lastTouch: 0 };
    this.lastPass = [null, null]; // {i, t} para asistencias

    this.saqueInicial = Math.random() < 0.5 ? 0 : 1;
    this._kickoff(this.saqueInicial, true);

    // casts visuales al pitido inicial
    this.teams.forEach(function (T, team) {
      (T.castList || []).forEach(function (c) {
        self._ev('habilidad', { team: team, jugador: c.card.nombre, cardId: c.card.id, hab: c.hab });
      });
    });
    this._ev('inicio', { team: this.saqueInicial });
  }

  MatchEngine.prototype._statsVacias = function () {
    return { tiros: 0, aPuerta: 0, xg: 0, pases: 0, pasesOk: 0, faltas: 0, amarillas: 0, rojas: 0, corners: 0, posesion: 0 };
  };

  MatchEngine.prototype._ev = function (t, extra) {
    var e = { t: t, min: this.minuto };
    if (extra) for (var k in extra) e[k] = extra[k];
    this.eventos.push(e);
  };

  MatchEngine.prototype.drenarEventos = function () {
    var e = this.eventos;
    this.eventos = [];
    return e;
  };

  // atributo con clutch dinámico
  MatchEngine.prototype.A = function (p, attr) {
    var v = p.a[attr];
    if (p.habs.clutch && this.minuto >= 75) v += 2;
    return v;
  };
  MatchEngine.prototype.sf = function (p) { // factor de habilidad por cansancio/condición
    return (0.86 + 0.14 * p.stamina / 100) * (0.88 + 0.12 * p.condF);
  };
  MatchEngine.prototype.vmax = function (p) {
    return (12.5 + this.A(p, 'velocidad') * 0.62) * (0.72 + 0.28 * p.stamina / 100) * p.condF;
  };

  MatchEngine.prototype.posesionTeam = function () {
    return this.ball.owner ? this.ball.owner.team : this.ball.lastTouch;
  };

  MatchEngine.prototype.jugadorBalon = function () {
    if (!this.ball.owner) return null;
    return this.players[this.ball.owner.team][this.ball.owner.i];
  };

  MatchEngine.prototype.presionSobre = function (p) {
    var best = 99;
    var opp = this.players[1 - p.team];
    for (var i = 0; i < opp.length; i++) {
      if (opp[i].off || opp[i].rol === 'GK') continue;
      var d = dist(p.x, p.y, opp[i].x, opp[i].y);
      if (d < best) best = d;
    }
    return clamp(1 - best / 7, 0, 1);
  };

  MatchEngine.prototype.masCercano = function (team, x, y, filtro) {
    var best = null, bd = 1e9;
    this.players[team].forEach(function (p) {
      if (p.off) return;
      if (filtro && !filtro(p)) return;
      var d = dist(p.x, p.y, x, y);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  };

  // línea del último defensor rival en MI eje de ataque
  MatchEngine.prototype.lineaDefRival = function (team) {
    var max = 55;
    this.players[1 - team].forEach(function (p) {
      if (p.off || p.pos !== 'DEF') return;
      var ax = axOf(team, p.x);
      if (ax > max) max = ax;
    });
    return max;
  };

  // ---------- fases / saques ----------

  MatchEngine.prototype._kickoff = function (team, inicial) {
    var taker = this.masCercano(team, 52.5, 34, function (p) { return p.rol !== 'GK'; });
    this.ball.plan = null; this.ball.owner = null;
    this.ball.x = 52.5; this.ball.y = 34; this.ball.z = 0; this.ball.vx = 0; this.ball.vy = 0;
    this.ball.lastTouch = team;
    this.fase = { tipo: 'saque', clase: 'kickoff', team: team, x: 52.5, y: 34, timer: inicial ? 0.8 : 1.4, taker: taker };
    this._limpiarTareas();
  };

  MatchEngine.prototype._limpiarTareas = function () {
    this.players.forEach(function (arr) { arr.forEach(function (p) { p.task = null; }); });
  };

  MatchEngine.prototype._saque = function (clase, team, x, y) {
    var taker;
    if (clase === 'puerta') taker = this.players[team][0];
    else if (clase === 'corner') {
      taker = this.masCercano(team, x, y, function (p) { return p.rol !== 'GK'; });
      var best = null, bv = -1, self = this;
      this.players[team].forEach(function (p) {
        if (p.off || p.rol === 'GK') return;
        var v = self.A(p, 'centros');
        if (v > bv) { bv = v; best = p; }
      });
      if (best) taker = best;
      this.stats[team].corners++;
      this._ev('corner', { team: team });
    } else {
      taker = this.masCercano(team, x, y, function (p) { return p.rol !== 'GK'; });
    }
    this.ball.plan = null; this.ball.owner = null;
    this.ball.x = x; this.ball.y = y; this.ball.z = 0; this.ball.vx = 0; this.ball.vy = 0;
    this.ball.lastTouch = team;
    this.fase = { tipo: 'saque', clase: clase, team: team, x: x, y: y, timer: clase === 'corner' ? 1.6 : 1.0, taker: taker };
    this._limpiarTareas();
  };

  MatchEngine.prototype._ejecutarSaque = function () {
    var f = this.fase;
    var taker = f.taker;
    this.fase = { tipo: 'jugando' };
    if (!taker || taker.off) { this.ball.lastTouch = f.team; return; }
    this.ball.owner = { team: taker.team, i: taker.i };
    this.ball.lastTouch = taker.team;

    if (f.clase === 'kickoff') {
      var atras = this.masCercano(f.team, taker.x, taker.y, function (p) {
        return p !== taker && (p.rol === 'DM' || p.rol === 'CM' || p.pos === 'DEF');
      });
      if (atras) this._pase(taker, atras, {});
    } else if (f.clase === 'corner') {
      this._centro(taker, true);
    } else if (f.clase === 'puerta') {
      var T = this.teams[f.team];
      if (T.tactica.estilo === 'directo' || this.A(taker, 'pase') < 8) {
        this._despeje(taker, 55 + Math.random() * 20);
      } else {
        var corto = this.masCercano(f.team, taker.x, taker.y, function (p) { return p !== taker && p.pos === 'DEF'; });
        if (corto) this._pase(taker, corto, {});
      }
    } else if (f.clase === 'falta') {
      var axFalta = axOf(f.team, f.x);
      var dGol = dist(f.x, f.y, fxOf(f.team, 105), 34);
      if (dGol < 26 && Math.random() < 0.6) {
        // falta directa: el mejor lanzador
        var best = null, bv = -1, self = this;
        this.players[f.team].forEach(function (p) {
          if (p.off || p.rol === 'GK') return;
          var v = self.A(p, 'tirosLejanos') + self.A(p, 'tecnica') * 0.5;
          if (v > bv) { bv = v; best = p; }
        });
        if (best) {
          this.ball.owner = { team: f.team, i: best.i };
          best.x = f.x - (f.team === 0 ? 2 : -2); best.y = f.y;
          this._tiro(best, { faltaDirecta: true });
          return;
        }
      }
      if (axFalta > 58) this._centro(taker, true);
      else {
        var libre = this.masCercano(f.team, taker.x, taker.y, function (p) { return p !== taker; });
        if (libre) this._pase(taker, libre, {});
      }
    } else { // banda
      var cerca = this.masCercano(f.team, taker.x, taker.y, function (p) { return p !== taker; });
      if (cerca) this._pase(taker, cerca, {});
    }
  };

  MatchEngine.prototype._penalti = function (team) {
    var best = null, bv = -1, self = this;
    this.players[team].forEach(function (p) {
      if (p.off || p.rol === 'GK') return;
      var v = self.A(p, 'remate') + self.A(p, 'compostura') * 0.6;
      if (v > bv) { bv = v; best = p; }
    });
    var spotX = fxOf(team, 94), spotY = 34;
    this.ball.plan = null; this.ball.owner = null;
    this.ball.x = spotX; this.ball.y = spotY; this.ball.vx = 0; this.ball.vy = 0; this.ball.z = 0;
    this.fase = { tipo: 'penalti', team: team, taker: best, timer: 2.2 };
    this._ev('penalti', { team: team, jugador: best.nombre });
    this._limpiarTareas();
  };

  MatchEngine.prototype._resolverPenalti = function (f) {
    var p = f.taker;
    var gk = this.players[1 - f.team][0];
    var gkQ = (this.A(gk, 'reflejos') * 0.6 + this.A(gk, 'unoContraUno') * 0.4) * this.sf(gk);
    var pGol = clamp(0.80 + ((this.A(p, 'remate') * 0.5 + this.A(p, 'compostura') * 0.5) - gkQ) * 0.012, 0.55, 0.93);
    var r = Math.random();
    var resultado = r < pGol ? 'gol' : (r < pGol + (1 - pGol) * 0.75 ? 'parada' : 'fuera');
    this.stats[f.team].tiros++; this.stats[f.team].xg += 0.78;
    p.st.tiros++;
    this.ball.owner = { team: f.team, i: p.i };
    this._lanzarTiro(p, resultado, 0.78, false);
  };

  // ---------- pases / centros / despejes ----------

  MatchEngine.prototype._pase = function (p, receptor, opts) {
    opts = opts || {};
    var b = this.ball;
    var presion = this.presionSobre(p);
    // punto de destino: posición prevista del receptor
    var tx = receptor.x + receptor.vx * 0.5;
    var ty = receptor.y + receptor.vy * 0.5;
    if (receptor.task && receptor.task.tipo === 'desmarque') {
      tx = receptor.x + (receptor.task.tx - receptor.x) * 0.55;
      ty = receptor.y + (receptor.task.ty - receptor.y) * 0.55;
    }
    var d = dist(p.x, p.y, tx, ty);
    // error por atributos y presión
    var sd = clamp(0.15 - this.A(p, 'pase') * 0.0055 - this.A(p, 'tecnica') * 0.0015 + presion * 0.075, 0.015, 0.24);
    var ang = Math.atan2(ty - p.y, tx - p.x) + gauss() * sd;
    d *= 1 + gauss() * clamp(0.11 - this.A(p, 'pase') * 0.003, 0.02, 0.1);
    tx = p.x + Math.cos(ang) * d;
    ty = p.y + Math.sin(ang) * d;

    var lofted = opts.lofted || d > 34;
    var speed = lofted ? clamp(15 + d * 1.05, 20, 52) : clamp(14 + d * 1.4, 18, 58);

    b.owner = null;
    b.plan = {
      tipo: 'pase',
      origenX: p.x, origenY: p.y,
      destX: tx, destY: ty,
      d: Math.max(1, d), s: 0, speed: speed,
      lofted: lofted, h: lofted ? clamp(d * 0.16, 1.5, 7) : 0,
      team: p.team, pasadorI: p.i,
      receptorI: receptor.i,
      contested: !!opts.contested,
      intercept: null
    };
    b.lastTouch = p.team;
    p.st.pases++;
    this.stats[p.team].pases++;
    receptor.task = { tipo: 'recibir', tx: tx, ty: ty };
    if (!lofted) this._planificarIntercepcion(b.plan);
  };

  MatchEngine.prototype._centro = function (p, esSaque) {
    // balón colgado al área: se disputa de cabeza al caer
    var team = p.team;
    var goalX = fxOf(team, 105);
    var tx = fxOf(team, 96 - Math.random() * 6);
    var ty = 34 + (Math.random() * 2 - 1) * 9;
    var d = dist(p.x, p.y, tx, ty);
    var sd = clamp(0.14 - this.A(p, 'centros') * 0.005, 0.02, 0.14);
    var ang = Math.atan2(ty - p.y, tx - p.x) + gauss() * sd;
    tx = p.x + Math.cos(ang) * d;
    ty = p.y + Math.sin(ang) * d;
    var calidad = this.A(p, 'centros') * (1 + this.mod[team].banda * 0.05);
    this.ball.owner = null;
    this.ball.plan = {
      tipo: 'centro',
      origenX: p.x, origenY: p.y, destX: tx, destY: ty,
      d: Math.max(1, d), s: 0, speed: clamp(16 + d * 0.95, 20, 44),
      lofted: true, h: clamp(d * 0.2, 3, 8),
      team: team, pasadorI: p.i, calidad: calidad
    };
    this.ball.lastTouch = team;
    p.st.pases++;
    this.stats[team].pases++;
  };

  MatchEngine.prototype._despeje = function (p, distancia) {
    var team = p.team;
    var tx = fxOf(team, Math.min(100, axOf(team, p.x) + distancia));
    var ty = clamp(p.y + (Math.random() * 2 - 1) * 22, 4, 64);
    var d = dist(p.x, p.y, tx, ty);
    this.ball.owner = null;
    this.ball.plan = {
      tipo: 'despeje',
      origenX: p.x, origenY: p.y, destX: tx, destY: ty,
      d: Math.max(1, d), s: 0, speed: clamp(18 + d * 0.9, 22, 46),
      lofted: true, h: clamp(d * 0.18, 2, 8),
      team: team, pasadorI: p.i
    };
    this.ball.lastTouch = team;
  };

  MatchEngine.prototype._planificarIntercepcion = function (plan) {
    // muestrea la línea de pase: el primer rival que llega, corta
    var self = this;
    var pasos = Math.max(3, Math.floor(plan.d / 3));
    var dx = (plan.destX - plan.origenX) / pasos;
    var dy = (plan.destY - plan.origenY) / pasos;
    var opp = this.players[1 - plan.team];
    for (var s = 1; s < pasos; s++) {
      var px = plan.origenX + dx * s, py = plan.origenY + dy * s;
      var tBall = (plan.d * s / pasos) / (plan.speed * 0.82);
      for (var j = 0; j < opp.length; j++) {
        var o = opp[j];
        if (o.off || o.rol === 'GK') continue;
        var reach = 1.0 + self.A(o, 'anticipacion') * 0.075;
        var dO = dist(o.x, o.y, px, py);
        if (dO > 6 || dO - reach > tBall * self.vmax(o) * 0.9) continue;
        var pInt = clamp(0.26 + (self.A(o, 'anticipacion') - 10) * 0.03 - dO * 0.04, 0.04, 0.55);
        if (Math.random() < pInt) {
          plan.intercept = { i: o.i, sFrac: s / pasos };
          o.task = { tipo: 'cortar', tx: px, ty: py };
          return;
        }
      }
    }
  };

  // ---------- tiros ----------

  MatchEngine.prototype._xg = function (p, x, y, cabeza) {
    var team = p.team;
    var goalX = fxOf(team, 105);
    var d = dist(x, y, goalX, 34);
    var angulo = Math.abs(Math.atan2(y - 34, Math.abs(goalX - x) + 0.5));
    var angleF = clamp(1.2 * Math.cos(angulo), 0.12, 1);
    var base = 1.05 * Math.exp(-d / 11.5) * angleF;
    return clamp(base, 0.01, 0.85);
  };

  MatchEngine.prototype._tiro = function (p, opts) {
    opts = opts || {};
    var team = p.team;
    var b = this.ball;
    var goalX = fxOf(team, 105);
    var d = dist(p.x, p.y, goalX, 34);
    var presion = opts.faltaDirecta ? 0 : this.presionSobre(p);
    var enArea = axOf(team, p.x) > CAMPO.w - AREA_X && Math.abs(p.y - 34) < AREA_Y;

    var attr = opts.cabeza ? this.A(p, 'cabeza') : this.A(p, 'remate');
    if (p.habs.killer && enArea && !opts.cabeza) attr += 3;

    var xg0 = this._xg(p, p.x, p.y, opts.cabeza);
    var q = xg0 * (0.5 + attr * 0.033) * (1 - presion * 0.20) * this.sf(p);
    if (d > 20) q *= clamp(0.5 + this.A(p, 'tirosLejanos') * 0.033, 0.3, 1.1);
    if (opts.faltaDirecta) q *= 0.5;
    if (opts.cabeza) q *= 0.8;
    q = clamp(q, 0.008, 0.8);

    var pOn = clamp(0.64 - d * 0.012 - presion * 0.18 + attr * 0.010 - (opts.cabeza ? 0.08 : 0), 0.15, 0.88);

    var resultado;
    if (Math.random() > pOn) {
      resultado = Math.random() < 0.10 ? 'palo' : 'fuera';
    } else {
      var gk = this.players[1 - team][0];
      var gkQ = (this.A(gk, 'reflejos') * 0.55 + this.A(gk, 'paradas') * 0.45) * this.sf(gk);
      var unoVsUno = d < 11 && presion < 0.3;
      if (unoVsUno) gkQ = (this.A(gk, 'unoContraUno') * 0.7 + this.A(gk, 'reflejos') * 0.3) * this.sf(gk);
      var pGol = clamp(q * (1.65 - gkQ * 0.045), 0.03, 0.85);
      resultado = Math.random() < pGol ? 'gol' : 'parada';
    }

    this.stats[team].tiros++;
    this.stats[team].xg += q;
    p.st.tiros++;
    if (resultado !== 'fuera' && resultado !== 'palo') { this.stats[team].aPuerta++; p.st.aPuerta++; }

    this._lanzarTiro(p, resultado, q, opts.cabeza);
  };

  MatchEngine.prototype._lanzarTiro = function (p, resultado, q, cabeza) {
    var team = p.team;
    var b = this.ball;
    var goalX = fxOf(team, 105);
    var ty;
    if (resultado === 'gol') ty = 34 + (Math.random() * 2 - 1) * (GOL_Y - 0.6);
    else if (resultado === 'parada') ty = 34 + (Math.random() * 2 - 1) * GOL_Y * 1.1;
    else if (resultado === 'palo') ty = (Math.random() < 0.5 ? -1 : 1) * GOL_Y + 34;
    else ty = 34 + (Math.random() < 0.5 ? -1 : 1) * (GOL_Y + 1.5 + Math.random() * 4);

    var d = dist(p.x, p.y, goalX, ty);
    b.owner = null;
    b.plan = {
      tipo: 'tiro', resultado: resultado, q: q,
      origenX: p.x, origenY: p.y, destX: goalX, destY: ty,
      d: Math.max(1, d), s: 0, speed: cabeza ? 34 : clamp(40 + this.A(p, 'remate') * 2.2, 45, 88),
      lofted: false, h: cabeza ? 1.5 : 0,
      team: team, pasadorI: p.i, tirador: p
    };
    b.lastTouch = team;
    // el portero se lanza
    var gk = this.players[1 - team][0];
    gk.task = { tipo: 'estirada', tx: goalX + (team === 0 ? -1.2 : 1.2), ty: clamp(ty, 34 - GOL_Y - 1, 34 + GOL_Y + 1) };
    this._ev('tiro_va', { team: team, jugador: p.nombre });
  };

  MatchEngine.prototype._resolverLlegadaTiro = function () {
    var b = this.ball;
    var plan = b.plan;
    var p = plan.tirador;
    var team = plan.team;
    var gk = this.players[1 - team][0];
    b.plan = null;

    if (plan.resultado === 'gol') {
      this.marcador[team]++;
      p.st.goles++;
      p.nota += 1.1;
      var asis = null;
      var lp = this.lastPass[team];
      if (lp && this.t - lp.t < 9 && lp.i !== p.i) {
        var pasador = this.players[team][lp.i];
        pasador.st.asis++;
        pasador.nota += 0.75;
        asis = pasador.nombre;
      }
      this.goleadores.push({ team: team, min: this.minuto, nombre: p.nombre, cardId: p.cardId, asistente: asis });
      this._ev('gol', { team: team, jugador: p.nombre, cardId: p.cardId, asistente: asis, marcador: this.marcador.slice() });
      this.fase = { tipo: 'celebracion', timer: 2.4, kickoffTeam: 1 - team };
      this._limpiarTareas();
    } else if (plan.resultado === 'parada') {
      gk.st.paradas++;
      gk.nota += 0.28;
      p.nota += 0.10;
      this._ev('tiro', { team: team, jugador: p.nombre, resultado: 'parada', portero: gk.nombre });
      var atrapa = Math.random() < clamp(this.A(gk, 'paradas') * 0.045, 0.2, 0.8);
      if (atrapa) {
        b.owner = { team: gk.team, i: gk.i };
        b.x = gk.x; b.y = gk.y; b.z = 0;
      } else if (Math.random() < 0.35) {
        // la manda a córner
        var cy = plan.destY < 34 ? 0.8 : CAMPO.h - 0.8;
        this._saque('corner', team, plan.destX < 52.5 ? 0.8 : CAMPO.w - 0.8, cy);
      } else {
        // rechace: balón suelto en el área
        b.x = gk.x + (team === 0 ? -1 : 1) * (2 + Math.random() * 5);
        b.y = gk.y + (Math.random() * 2 - 1) * 8;
        b.vx = (team === 0 ? -1 : 1) * (4 + Math.random() * 7);
        b.vy = (Math.random() * 2 - 1) * 6;
        b.z = 0;
      }
    } else if (plan.resultado === 'palo') {
      p.nota += 0.05;
      this._ev('tiro', { team: team, jugador: p.nombre, resultado: 'palo' });
      b.x = plan.destX + (team === 0 ? -2 : 2);
      b.y = plan.destY;
      b.vx = (team === 0 ? -1 : 1) * (8 + Math.random() * 8);
      b.vy = (Math.random() * 2 - 1) * 10;
    } else {
      p.nota -= 0.04;
      this._ev('tiro', { team: team, jugador: p.nombre, resultado: 'fuera' });
      this._saque('puerta', 1 - team, fxOf(1 - team, 5.5), 34 + (Math.random() < 0.5 ? -8 : 8));
    }
  };

  // llegada de un balón colgado (centro/córner/despeje largo): duelo aéreo
  MatchEngine.prototype._resolverLlegadaAerea = function () {
    var b = this.ball;
    var plan = b.plan;
    b.plan = null;
    b.x = plan.destX; b.y = plan.destY; b.z = 0;

    var self = this;
    var team = plan.team;
    var esCentro = plan.tipo === 'centro';

    // candidatos al duelo: los más cercanos de cada equipo
    function mejor(t, esDef) {
      var best = null, bv = -1;
      self.players[t].forEach(function (p) {
        if (p.off || p.rol === 'GK') return;
        var d = dist(p.x, p.y, b.x, b.y);
        if (d > 6) return;
        var v = self.A(p, 'cabeza') + self.A(p, 'salto') + (esDef ? self.A(p, 'marcaje') : self.A(p, 'desmarque')) * 0.5
          + (6 - d) * 1.2 + gauss() * 3;
        if (v > bv) { bv = v; best = p; }
      });
      return { p: best, v: bv };
    }
    var atacante = mejor(team, false);
    var defensor = mejor(1 - team, true);

    // el portero puede salir a por el balón colgado
    var gk = this.players[1 - team][0];
    var dGk = dist(gk.x, gk.y, b.x, b.y);
    if (esCentro && dGk < 6.5 && Math.random() < clamp(this.A(gk, 'juegoAereo') * 0.042 - dGk * 0.03, 0.05, 0.6)) {
      b.owner = { team: gk.team, i: gk.i };
      gk.st.paradas++;
      gk.nota += 0.15;
      this._ev('tiro', { team: team, jugador: gk.nombre, resultado: 'atrapa' });
      return;
    }

    if (esCentro && atacante.p && atacante.v > defensor.v + (plan.calidad !== undefined ? clamp(8 - plan.calidad * 0.45, 0, 5) : 3)) {
      // remate de cabeza
      atacante.p.x = b.x; atacante.p.y = b.y;
      b.owner = { team: team, i: atacante.p.i };
      this._tiro(atacante.p, { cabeza: true });
      return;
    }
    if (defensor.p && (!atacante.p || defensor.v >= atacante.v)) {
      // despeje defensivo; a veces la manda a córner
      defensor.p.nota += 0.08;
      var axDef = axOf(team, defensor.p.x);
      if (esCentro && axDef > 88 && Math.random() < 0.22) {
        var cy2 = defensor.p.y < 34 ? 0.8 : CAMPO.h - 0.8;
        this._saque('corner', team, fxOf(team, CAMPO.w - 0.8), cy2);
        return;
      }
      b.owner = { team: defensor.p.team, i: defensor.p.i };
      this._despeje(defensor.p, 30 + Math.random() * 25);
      return;
    }
    if (atacante.p) {
      // la baja y controla
      b.owner = { team: team, i: atacante.p.i };
      b.x = atacante.p.x; b.y = atacante.p.y;
      return;
    }
    // nadie: balón suelto
    b.vx = (Math.random() * 2 - 1) * 6;
    b.vy = (Math.random() * 2 - 1) * 6;
  };

  // ---------- decisiones del portador ----------

  MatchEngine.prototype._decidir = function (p) {
    var self = this;
    var b = this.ball;
    var team = p.team;
    var T = this.teams[team];
    var tac = T.tactica;
    var ax = axOf(team, p.x);
    var goalX = fxOf(team, 105);
    var dGol = dist(p.x, p.y, goalX, 34);
    var presion = this.presionSobre(p);
    var ruido = 0.04 * (1.4 - this.A(p, 'decisiones') / 15);

    var mejor = { u: -1, accion: null };
    function considerar(u, accion) {
      u += gauss() * ruido;
      if (u > mejor.u) { mejor = { u: u, accion: accion }; }
    }

    // 1) tiro
    if (dGol < 33) {
      var xg0 = this._xg(p, p.x, p.y, false);
      var q = xg0 * (0.5 + this.A(p, 'remate') * 0.033) * (1 - presion * 0.2);
      var u = q * 2.3;
      if (dGol < 13) u += 0.10;
      if (p.habs.franco && dGol > 17 && dGol < 30) u += 0.12;
      if (dGol > 20) u *= clamp(0.45 + this.A(p, 'tirosLejanos') * 0.035, 0.3, 1.1);
      considerar(u, function () { self._tiro(p, {}); });
    }

    // 2) pases
    var enCentro = Math.abs(p.y - 34) < 15 && ax > 30 && ax < 75;
    var zonaModC = 1 + this.mod[team].centro * 0.045;
    this.players[team].forEach(function (r) {
      if (r === p || r.off) return;
      if (r.rol === 'GK' && (ax > 35 || presion > 0.5)) return;
      var d = dist(p.x, p.y, r.x, r.y);
      if (d < 3 || d > 55) return;
      var progreso = (axOf(team, r.x) - ax) / 45;
      var oppCerca = 99;
      self.players[1 - team].forEach(function (o) {
        if (o.off) return;
        var od = dist(r.x, r.y, o.x, o.y);
        if (od < oppCerca) oppCerca = od;
      });
      var espacio = clamp(oppCerca / 10, 0, 1);
      var enAreaR = axOf(team, r.x) > CAMPO.w - AREA_X && Math.abs(r.y - 34) < AREA_Y;
      var valor = 0.34 * progreso + 0.30 * espacio + (enAreaR ? 0.16 : 0) + self.A(r, 'desmarque') * 0.004;
      if (progreso < 0) valor *= 0.5;
      valor += 0.22; // valor base de conservar con sentido
      // riesgo estimado por rivales cerca de la línea de pase
      var riesgo = 0;
      self.players[1 - team].forEach(function (o) {
        if (o.off || o.rol === 'GK') return;
        var t = clamp(((o.x - p.x) * (r.x - p.x) + (o.y - p.y) * (r.y - p.y)) / (d * d), 0.1, 0.9);
        var lx = p.x + (r.x - p.x) * t, ly = p.y + (r.y - p.y) * t;
        var dl = dist(o.x, o.y, lx, ly);
        if (dl < 4) riesgo += (0.30 - dl * 0.055) * (0.6 + self.A(o, 'anticipacion') * 0.03);
      });
      riesgo = clamp(riesgo, 0, 0.85);
      var u = valor * (1 - riesgo) * (0.82 + self.A(p, 'vision') * 0.018);
      if (enCentro && Math.abs(r.y - 34) < 15) u *= zonaModC;
      var largo = d > 30;
      if (tac.estilo === 'corto' && largo) u *= 0.6;
      if (tac.estilo === 'directo') { if (largo && progreso > 0.2) u *= 1.3; else if (!largo) u *= 0.92; }
      if (tac.mentalidad === 1 && progreso > 0) u *= 1.08;
      if (tac.mentalidad === -1 && progreso > 0.3) u *= 0.9;
      considerar(u, function () { self._pase(p, r, { lofted: d > 34 }); });
    });

    // 3) centro al área
    var esBanda = p.y < 16 || p.y > 52;
    if (esBanda && ax > 62) {
      var enArea = 0, defEnArea = 0;
      this.players[team].forEach(function (r) {
        if (!r.off && axOf(team, r.x) > CAMPO.w - AREA_X - 4 && Math.abs(r.y - 34) < AREA_Y) enArea++;
      });
      this.players[1 - team].forEach(function (o) {
        if (!o.off && o.rol !== 'GK' && axOf(team, o.x) > CAMPO.w - AREA_X - 4 && Math.abs(o.y - 34) < AREA_Y) defEnArea++;
      });
      var uC = (0.22 + this.A(p, 'centros') * 0.020 + (enArea - defEnArea * 0.6) * 0.05) * (1 + this.mod[team].banda * 0.05);
      considerar(uC, function () { self._centro(p, false); });
    }

    // 4) regate / conducción
    var dir = team === 0 ? 1 : -1;
    var espacioDelante = 99;
    this.players[1 - team].forEach(function (o) {
      if (o.off || o.rol === 'GK') return;
      var dx = (o.x - p.x) * dir;
      if (dx < -1) return;
      var d = dist(p.x, p.y, o.x, o.y);
      if (d < espacioDelante) espacioDelante = d;
    });
    var uR = 0.17 + (this.A(p, 'regate') + this.A(p, 'aceleracion') - 20) * 0.011 + clamp(espacioDelante / 14, 0, 0.28);
    if (ax < 30) uR -= 0.14;
    if (esBanda) uR *= (1 + this.mod[team].banda * 0.025);
    considerar(uR, function () {
      var ty = p.y + (34 - p.y) * 0.15 + (Math.random() * 2 - 1) * 6;
      p.task = { tipo: 'conducir', tx: clamp(p.x + dir * (7 + Math.random() * 5), 2, 103), ty: clamp(ty, 3, 65), timer: 0.9 };
    });

    // 5) despeje de urgencia
    if (ax < 25 && presion > 0.5) {
      considerar(0.30 + presion * 0.35 - this.A(p, 'compostura') * 0.012, function () {
        self._despeje(p, 45 + Math.random() * 25);
      });
    }

    if (mejor.accion) mejor.accion();
  };

  // ---------- tareas (presión, marcaje, desmarques, apoyos) ----------

  MatchEngine.prototype._asignarTareas = function () {
    var self = this;
    var b = this.ball;
    var carrier = this.jugadorBalon();
    var posTeam = this.posesionTeam();

    for (var team = 0; team < 2; team++) {
      var T = this.teams[team];
      var defensa = team !== posTeam;
      var arr = this.players[team];

      arr.forEach(function (p) {
        if (p.off || p.rol === 'GK') return;
        // caducar tareas temporales
        if (p.task && (p.task.tipo === 'presionar' || p.task.tipo === 'cubrir' || p.task.tipo === 'apoyo')) p.task = null;
        if (p.task && p.task.tipo === 'desmarque' && (p.task.timer -= 0.15) <= 0) p.task = null;
        if (p.task && p.task.tipo === 'conducir' && (p.task.timer -= 0.15) <= 0) p.task = null;
        if (p.task && p.task.tipo === 'recibir' && (!b.plan || b.plan.tipo !== 'pase' || b.plan.receptorI !== p.i)) p.task = null;
        if (p.task && p.task.tipo === 'cortar' && !b.plan) p.task = null;
        if (p.task && p.task.tipo === 'perseguir') p.task = null;
        if (p.task && p.task.tipo === 'estirada' && (!b.plan || b.plan.tipo !== 'tiro')) p.task = null;
      });

      if (defensa && carrier) {
        // presión: solo el más cercano (dos con presión alta)
        var presTrig = [11, 17, 26][T.tactica.presion];
        var axCarrier = axOf(team, carrier.x);
        if (axCarrier < 38) presTrig = Math.max(presTrig, 22); // cerca de nuestra área siempre se achica
        var cand = arr.filter(function (p) { return !p.off && p.rol !== 'GK' && p.stunned <= 0; })
          .sort(function (a, bb) { return dist(a.x, a.y, carrier.x, carrier.y) - dist(bb.x, bb.y, carrier.x, carrier.y); });
        if (cand[0] && dist(cand[0].x, cand[0].y, carrier.x, carrier.y) < presTrig) {
          var goalSideX = carrier.x + (team === 0 ? 1 : -1) * -1.2;
          cand[0].task = { tipo: 'presionar', tx: goalSideX, ty: carrier.y };
          if (T.tactica.presion === 2 && cand[1] && dist(cand[1].x, cand[1].y, carrier.x, carrier.y) < presTrig) {
            var cx = (carrier.x + fxOf(team, 0)) / 2;
            cand[1].task = { tipo: 'cubrir', tx: carrier.x + (fxOf(team, 0) - carrier.x) * 0.25, ty: carrier.y + (34 - carrier.y) * 0.2 };
          }
        }
      }

      if (!defensa && carrier && carrier.team === team) {
        // desmarques: atacantes sin balón buscan el hueco a la espalda
        var linea = self.lineaDefRival(team);
        arr.forEach(function (p) {
          if (p.off || p === carrier || p.task) return;
          if (['ST', 'W', 'AM', 'WM'].indexOf(p.rol) < 0) return;
          p.runCd -= 0.15;
          if (p.runCd > 0) return;
          var pRun = 0.10 + self.A(p, 'desmarque') * 0.012;
          if (axOf(team, carrier.x) < 40) pRun *= 0.4;
          if (Math.random() < pRun) {
            // hueco: y con menos defensores rivales
            var oppDef = self.players[1 - team].filter(function (o) { return !o.off && o.pos === 'DEF'; });
            var ys = oppDef.map(function (o) { return o.y; }).sort(function (a, b2) { return a - b2; });
            ys.unshift(8); ys.push(60);
            var mejorGap = 0, gy = 34;
            for (var g = 1; g < ys.length; g++) {
              if (ys[g] - ys[g - 1] > mejorGap) { mejorGap = ys[g] - ys[g - 1]; gy = (ys[g] + ys[g - 1]) / 2; }
            }
            p.task = {
              tipo: 'desmarque',
              tx: fxOf(team, clamp(linea + 4, 55, 98)),
              ty: clamp(gy + (Math.random() * 2 - 1) * 4, 5, 63),
              timer: 2.4
            };
            p.runCd = 3 + Math.random() * 4;
          }
        });
        // apoyos: los 2 más cercanos ofrecen línea de pase
        var cercanos = arr.filter(function (p) { return !p.off && p !== carrier && !p.task && p.rol !== 'GK'; })
          .sort(function (a, bb) { return dist(a.x, a.y, carrier.x, carrier.y) - dist(bb.x, bb.y, carrier.x, carrier.y); })
          .slice(0, 2);
        cercanos.forEach(function (p, k) {
          var atras = (team === 0 ? -1 : 1) * 6;
          var lado = p.y > carrier.y ? 7 : -7;
          p.task = { tipo: 'apoyo', tx: clamp(carrier.x + atras, 3, 102), ty: clamp(carrier.y + lado + k * lado * 0.5, 3, 65) };
        });
      }

      // balón suelto: el más cercano de cada equipo lo persigue
      if (!b.owner && !b.plan) {
        var chaser = self.masCercano(team, b.x, b.y, function (p) { return !p.off && p.stunned <= 0; });
        if (chaser) chaser.task = { tipo: 'perseguir', tx: b.x + b.vx * 0.25, ty: b.y + b.vy * 0.25 };
      }
    }
  };

  // ---------- ancla de formación ----------

  MatchEngine.prototype._ancla = function (p) {
    var team = p.team;
    var T = this.teams[team];
    var tac = T.tactica;
    var b = this.ball;
    var poss = this.posesionTeam() === team;
    var f = this.fase;

    var ballAx = axOf(team, b.x);
    var ballAy = ayOf(team, b.y);

    var kx = KX_ROL[p.rol], ky = KY_ROL[p.rol];
    var ax = p.slotAx + clamp(kx * (ballAx - 35), -14, 30);
    if (p.rol !== 'GK') ax += poss ? (8 + tac.mentalidad * 4) : (-7 + tac.mentalidad * 3);
    var ay = p.slotAy + ky * (ballAy - 34);

    // compactación defensiva hacia el balón
    if (!poss && p.rol !== 'GK') ay += (ballAy - ay) * 0.10;

    // marcaje al hombre: los defensas siguen al atacante rival más
    // cercano y se colocan entre él y su portería
    if (!poss && (p.pos === 'DEF' || p.rol === 'DM')) {
      var marcado = null, md = 9;
      var rivales = this.players[1 - team];
      var anchorFx = fxOf(team, ax), anchorFy = fyOf(team, ay);
      for (var ri = 0; ri < rivales.length; ri++) {
        var o = rivales[ri];
        if (o.off || ['ST', 'W', 'AM', 'WM'].indexOf(o.rol) < 0) continue;
        var dM = dist(anchorFx, anchorFy, o.x, o.y);
        if (dM < md) { md = dM; marcado = o; }
      }
      if (marcado) {
        var marcajeF = clamp(0.35 + this.A(p, 'marcaje') * 0.018, 0.35, 0.72);
        var oAx = axOf(team, marcado.x) - 1.6; // lado portería
        var oAy = ayOf(team, marcado.y);
        ax += (clamp(oAx, 1.5, 103) - ax) * marcajeF;
        ay += (oAy - ay) * marcajeF;
      }
    }

    // los puntas no rebasan al último defensor (disciplina de fuera de juego)
    if ((p.rol === 'ST' || p.rol === 'W' || p.rol === 'AM') && p.rol !== 'GK') {
      ax = Math.min(ax, this.lineaDefRival(team) + 1.5);
    }

    // saques: todo el mundo repliega a su campo en el kickoff; córner puebla el área
    if (f && f.tipo === 'saque') {
      if (f.clase === 'kickoff') ax = Math.min(ax, 49);
      if (f.clase === 'corner') {
        if (f.team === team && ['ST', 'W', 'CM', 'CB', 'AM'].indexOf(p.rol) >= 0 && p !== f.taker) {
          ax = 92 + (p.i % 3) * 3;
          ay = 26 + ((p.i * 7) % 17);
        }
        if (f.team !== team && p.rol !== 'GK' && (p.pos === 'DEF' || p.rol === 'DM')) {
          ax = 10 + (p.i % 3) * 3;
          ay = 26 + ((p.i * 5) % 17);
        }
      }
    }

    // ruido posicional (cohesión/colocación)
    ax += Math.sin(this.t * 0.35 + p.wPhase) * p.wAmp;
    ay += Math.cos(this.t * 0.28 + p.wPhase2) * p.wAmp * 1.25;

    ax = clamp(ax, 1.5, 103.5);
    ay = clamp(ay, 2, 66);
    return { x: fxOf(team, ax), y: fyOf(team, ay) };
  };

  // ---------- portero ----------

  MatchEngine.prototype._moverPortero = function (p, dt) {
    var team = p.team;
    var b = this.ball;
    var goalX = fxOf(team, 0);
    var tx, ty, modo = 0.7;

    if (p.task && p.task.tipo === 'estirada') {
      tx = p.task.tx; ty = p.task.ty; modo = 1.6; // la estirada es explosiva
    } else {
      var dBall = dist(b.x, b.y, goalX, 34);
      var salida = !b.owner && !b.plan && dBall < 14 && dist(p.x, p.y, b.x, b.y) < 9 + this.A(p, 'salidas') * 0.3;
      if (salida) { tx = b.x; ty = b.y; modo = 1.1; }
      else if (b.owner && b.owner.team === team && b.owner.i === p.i) { tx = p.x; ty = p.y; }
      else {
        var angY = clamp((b.y - 34) * 0.35, -GOL_Y - 0.6, GOL_Y + 0.6);
        var profundidad = 1.2 + this.A(p, 'salidas') * 0.10;
        tx = goalX + (team === 0 ? 1 : -1) * profundidad;
        ty = 34 + angY;
      }
    }
    this._integrar(p, tx, ty, modo, dt);
  };

  MatchEngine.prototype._integrar = function (p, tx, ty, modo, dt) {
    var dx = tx - p.x, dy = ty - p.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var stunF = p.stunned > 0 ? 0.35 : 1;
    var sp = Math.min(this.vmax(p) * modo * stunF, d * 4);
    var vdx = dx / d * sp, vdy = dy / d * sp;
    var acc = (28 + this.A(p, 'aceleracion') * 2.1) * dt;
    var ddx = vdx - p.vx, ddy = vdy - p.vy;
    var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 0.001;
    var f = Math.min(1, acc / dd);
    p.vx += ddx * f; p.vy += ddy * f;
    p.x = clamp(p.x + p.vx * dt, 0.5, 104.5);
    p.y = clamp(p.y + p.vy * dt, 0.5, 67.5);

    // gasto de energía
    var v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    var carga = 0.16 + (v / (this.vmax(p) + 0.01)) * 0.5;
    if (p.task && (p.task.tipo === 'presionar' || p.task.tipo === 'perseguir')) carga *= 1.22;
    carga *= (1.3 - this.A(p, 'resistencia') * 0.028);
    if (p.habs.motor) carga *= 0.7;
    p.stamina = clamp(p.stamina - carga * dt, 18, 100);
    if (p.stunned > 0) p.stunned -= dt;
  };

  MatchEngine.prototype._separacion = function (dt) {
    // que los compañeros no se apelotonen
    for (var team = 0; team < 2; team++) {
      var arr = this.players[team];
      for (var i = 0; i < arr.length; i++) {
        for (var j = i + 1; j < arr.length; j++) {
          var a = arr[i], b = arr[j];
          if (a.off || b.off) continue;
          var dx = b.x - a.x, dy = b.y - a.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 7.8 && d2 > 0.0001) {
            var d = Math.sqrt(d2);
            var push = (2.8 - d) * 2.6 * dt;
            dx /= d; dy /= d;
            a.x -= dx * push; a.y -= dy * push;
            b.x += dx * push; b.y += dy * push;
          }
        }
      }
    }
  };

  // ---------- entradas / faltas ----------

  MatchEngine.prototype._entradas = function (dt) {
    var carrier = this.jugadorBalon();
    if (!carrier || carrier.rol === 'GK') return;
    var self = this;
    var opp = this.players[1 - carrier.team];
    for (var j = 0; j < opp.length; j++) {
      var d = opp[j];
      if (d.off || d.rol === 'GK' || d.stunned > 0) continue;
      d.tackleCd -= dt;
      if (d.tackleCd > 0) continue;
      if (dist(d.x, d.y, carrier.x, carrier.y) > 1.9) continue;
      d.tackleCd = 0.7;
      var atkV = this.A(d, 'entradas') * 1.05 + this.A(d, 'fuerza') * 0.45 + this.A(d, 'anticipacion') * 0.35;
      var defV = this.A(carrier, 'regate') * 1.05 + this.A(carrier, 'equilibrio') * 0.5 + this.A(carrier, 'agilidad') * 0.4;
      var presionNivel = this.teams[d.team].tactica.presion;
      var pRoba = clamp(0.30 + (atkV - defV) * 0.022, 0.08, 0.68) * this.sf(d) * (0.92 + presionNivel * 0.09);
      var r = Math.random();
      if (r < pRoba) {
        // roba
        d.st.entradas++;
        d.nota += 0.18;
        carrier.nota -= 0.08;
        this.ball.owner = null;
        this.ball.plan = null;
        this.ball.x = d.x + (Math.random() * 2 - 1) * 1.5;
        this.ball.y = d.y + (Math.random() * 2 - 1) * 1.5;
        this.ball.vx = (Math.random() * 2 - 1) * 4;
        this.ball.vy = (Math.random() * 2 - 1) * 4;
        this.ball.lastTouch = d.team;
        if (Math.random() < 0.6) {
          this.ball.owner = { team: d.team, i: d.i };
          this.ball.vx = 0; this.ball.vy = 0;
        }
        return;
      }
      var pFalta = clamp(0.19 + this.A(d, 'agresividad') * 0.010 - this.A(d, 'entradas') * 0.004, 0.07, 0.38);
      if (r < pRoba + (1 - pRoba) * pFalta) {
        this._falta(d, carrier);
        return;
      }
      // el portador se marcha: acelerón, defensor superado
      d.stunned = 0.7;
      carrier.vx *= 1.25; carrier.vy *= 1.25;
      carrier.nota += 0.05;
    }
  };

  MatchEngine.prototype._falta = function (infractor, victima) {
    var team = victima.team;
    infractor.st.faltas++;
    infractor.nota -= 0.12;
    this.stats[infractor.team].faltas++;
    this._ev('falta', { team: infractor.team, jugador: infractor.nombre, sobre: victima.nombre });

    // tarjeta
    var pAmarilla = clamp(0.16 + this.A(infractor, 'agresividad') * 0.012, 0.1, 0.42);
    if (Math.random() < 0.012) {
      this._roja(infractor);
    } else if (Math.random() < pAmarilla) {
      if (infractor.amarilla) {
        this._roja(infractor, true);
      } else {
        infractor.amarilla = true;
        infractor.nota -= 0.25;
        this.stats[infractor.team].amarillas++;
        this._ev('amarilla', { team: infractor.team, jugador: infractor.nombre });
      }
    }

    // penalti si la falta es dentro del área del infractor
    var axV = axOf(team, victima.x);
    var enArea = axV > CAMPO.w - AREA_X && Math.abs(victima.y - 34) < AREA_Y;
    if (enArea) {
      this._penalti(team);
    } else {
      this._saque('falta', team, victima.x, victima.y);
    }
  };

  MatchEngine.prototype._roja = function (p, doble) {
    p.roja = true;
    p.off = true;
    p.nota -= 1.2;
    this.stats[p.team].rojas++;
    this._ev('roja', { team: p.team, jugador: p.nombre, cardId: p.cardId, doble: !!doble });
  };

  // ---------- balón ----------

  MatchEngine.prototype._moverBalon = function (dt) {
    var b = this.ball;

    if (b.owner) {
      var p = this.jugadorBalon();
      if (!p || p.off) { b.owner = null; return; }
      var v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      var fx = v > 1 ? p.vx / v : (p.team === 0 ? 1 : -1);
      var fy = v > 1 ? p.vy / v : 0;
      b.x = p.x + fx * 0.9;
      b.y = p.y + fy * 0.9;
      b.z = 0;
      p.st.toques += dt;
      return;
    }

    if (b.plan) {
      var plan = b.plan;
      plan.speed *= Math.exp(-0.25 * dt);
      plan.s += plan.speed * dt;
      var frac = clamp(plan.s / plan.d, 0, 1);
      b.x = plan.origenX + (plan.destX - plan.origenX) * frac;
      b.y = plan.origenY + (plan.destY - plan.origenY) * frac;
      b.z = plan.lofted ? 4 * plan.h * frac * (1 - frac) : 0;

      // intercepción planificada
      if (plan.intercept && frac >= plan.intercept.sFrac) {
        var o = this.players[1 - plan.team][plan.intercept.i];
        var pasador = this.players[plan.team][plan.pasadorI];
        pasador.nota -= 0.06;
        o.nota += 0.15;
        b.plan = null;
        b.lastTouch = o.team;
        if (Math.random() < 0.65) {
          b.owner = { team: o.team, i: o.i };
          b.x = o.x; b.y = o.y;
        } else {
          b.vx = (Math.random() * 2 - 1) * 7;
          b.vy = (Math.random() * 2 - 1) * 7;
        }
        return;
      }

      if (frac >= 1) {
        if (plan.tipo === 'tiro') { this._resolverLlegadaTiro(); return; }
        if (plan.tipo === 'centro' || plan.tipo === 'despeje') { this._resolverLlegadaAerea(); return; }
        // pase: control del receptor
        var receptor = this.players[plan.team][plan.receptorI];
        var pasador2 = this.players[plan.team][plan.pasadorI];
        b.plan = null;
        if (receptor && !receptor.off && dist(receptor.x, receptor.y, b.x, b.y) < 2.6) {
          var presionR = this.presionSobre(receptor);
          var pControl = clamp(0.9 + this.A(receptor, 'primerToque') * 0.008 - presionR * 0.22, 0.5, 0.99);
          pasador2.st.pasesOk++;
          this.stats[plan.team].pasesOk++;
          pasador2.nota += 0.02;
          this.lastPass[plan.team] = { i: plan.pasadorI, t: this.t };
          if (Math.random() < pControl) {
            b.owner = { team: plan.team, i: receptor.i };
            b.x = receptor.x; b.y = receptor.y;
          } else {
            // mal control: balón suelto cerca
            receptor.nota -= 0.05;
            b.vx = (Math.random() * 2 - 1) * 6;
            b.vy = (Math.random() * 2 - 1) * 6;
          }
        } else {
          pasador2.nota -= 0.05;
          b.vx = (b.x - plan.origenX) / plan.d * 5;
          b.vy = (b.y - plan.origenY) / plan.d * 5;
        }
        return;
      }
      return;
    }

    // balón suelto: física simple
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    var fr = Math.exp(-1.4 * dt);
    b.vx *= fr; b.vy *= fr;

    // recogida
    var self = this;
    for (var team = 0; team < 2; team++) {
      var cerca = this.masCercano(team, b.x, b.y, function (p) { return !p.off && p.stunned <= 0; });
      if (cerca && dist(cerca.x, cerca.y, b.x, b.y) < 1.2) {
        var pC = clamp(0.75 + this.A(cerca, 'primerToque') * 0.012, 0.5, 0.98);
        if (Math.random() < pC) {
          b.owner = { team: team, i: cerca.i };
          b.lastTouch = team;
          b.vx = 0; b.vy = 0;
        } else {
          b.vx += (Math.random() * 2 - 1) * 4;
          b.vy += (Math.random() * 2 - 1) * 4;
        }
        break;
      }
    }

    // fuera del campo
    if (b.y < 0 || b.y > CAMPO.h) {
      var saca = 1 - b.lastTouch;
      this._saque('banda', saca, clamp(b.x, 2, 103), b.y < 0 ? 0.8 : CAMPO.h - 0.8);
      return;
    }
    if (b.x < 0 || b.x > CAMPO.w) {
      // ¿quién defiende esa portería?
      var defiende = b.x < 0 ? 0 : 1; // el equipo 0 defiende x=0
      if (b.lastTouch === defiende) {
        // córner para el atacante
        var atacante = 1 - defiende;
        var cy = b.y < 34 ? 0.8 : CAMPO.h - 0.8;
        this._saque('corner', atacante, b.x < 0 ? 0.8 : CAMPO.w - 0.8, cy);
      } else {
        this._saque('puerta', defiende, fxOf(defiende, 5.5), 34 + (Math.random() < 0.5 ? -8 : 8));
      }
    }
  };

  // ---------- paso principal ----------

  MatchEngine.prototype.step = function (dt) {
    if (this.terminado || this.pausado) return;
    var b = this.ball;
    this.t += dt;

    // reloj: 2 partes de 47 s = 90'
    var tm = this.t < MEDIA_PARTE
      ? this.t / MEDIA_PARTE * 45
      : 45 + (this.t - MEDIA_PARTE) / MEDIA_PARTE * 45;
    this.minuto = Math.min(90, Math.floor(tm));

    // aviso de clutch al 75'
    if (!this.clutchAvisado && this.minuto >= 75) {
      this.clutchAvisado = true;
      var self0 = this;
      this.players.forEach(function (arr, team) {
        arr.forEach(function (p) {
          if (p.habs.clutch && !p.off) self0._ev('habilidad', { team: team, jugador: p.nombre, cardId: p.cardId, hab: 'clutch' });
        });
      });
    }

    // descanso
    if (this.half === 1 && this.t >= MEDIA_PARTE && this.fase.tipo === 'jugando') {
      this.half = 2;
      this._ev('descanso', { marcador: this.marcador.slice() });
      this.fase = { tipo: 'descanso', timer: 1.2 };
      if (this.opts.pausaDescanso) this.pausado = true;
      return;
    }

    // final
    if (this.t >= MEDIA_PARTE * 2 && (this.fase.tipo === 'jugando' || this.t > MEDIA_PARTE * 2 + 6)) {
      this.terminado = true;
      this._notasFinales();
      this._ev('final', { marcador: this.marcador.slice() });
      return;
    }

    var f = this.fase;

    if (f.tipo === 'descanso') {
      f.timer -= dt;
      if (f.timer <= 0) this._kickoff(1 - this.saqueInicial, false);
      return;
    }

    if (f.tipo === 'celebracion') {
      f.timer -= dt;
      // los jugadores deambulan; el render pone el confeti
      if (f.timer <= 0) this._kickoff(f.kickoffTeam, false);
      return;
    }

    if (f.tipo === 'penalti') {
      f.timer -= dt;
      // colocar al lanzador y al portero
      var spotX = fxOf(f.team, 94);
      if (f.taker) { this._integrar(f.taker, spotX - (f.team === 0 ? 3 : -3), 34, 0.6, dt); }
      var gk2 = this.players[1 - f.team][0];
      this._integrar(gk2, fxOf(1 - f.team, 0.8), 34, 0.8, dt);
      if (f.timer <= 0) {
        this.fase = { tipo: 'jugando' };
        this._resolverPenalti(f);
      }
      return;
    }

    // tareas periódicas
    this.taskTimer -= dt;
    if (this.taskTimer <= 0) {
      this.taskTimer = 0.15;
      this._asignarTareas();
    }

    // decisión del portador
    var carrier = this.jugadorBalon();
    if (carrier && f.tipo === 'jugando') {
      carrier.decCd -= dt;
      if (carrier.decCd <= 0) {
        carrier.decCd = 0.22 + Math.random() * 0.12;
        if (carrier.rol === 'GK') {
          // el portero distribuye rápido
          var T = this.teams[carrier.team];
          if (T.tactica.estilo === 'directo' && Math.random() < 0.5) this._despeje(carrier, 50 + Math.random() * 20);
          else {
            var comp = this.masCercano(carrier.team, carrier.x, carrier.y, function (p) { return p !== carrier && !p.off; });
            if (comp) this._pase(carrier, comp, {});
          }
        } else {
          this._decidir(carrier);
        }
      }
    }

    // movimiento
    for (var team = 0; team < 2; team++) {
      var arr = this.players[team];
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        if (p.off) continue;
        if (p.rol === 'GK') { this._moverPortero(p, dt); continue; }

        var tx, ty, modo;
        var esCarrier = b.owner && b.owner.team === team && b.owner.i === i;
        if (f.tipo === 'saque' && f.taker === p) {
          tx = f.x; ty = f.y; modo = 0.95;
        } else if (esCarrier) {
          if (p.task && p.task.tipo === 'conducir') { tx = p.task.tx; ty = p.task.ty; modo = 0.78 + this.A(p, 'regate') * 0.008; }
          else {
            var anc = this._ancla(p);
            var dirC = team === 0 ? 1 : -1;
            tx = clamp(p.x + dirC * 2.5, 2, 103); ty = (anc.y + p.y) / 2; modo = 0.55;
          }
        } else if (p.task) {
          tx = p.task.tx; ty = p.task.ty;
          modo = (p.task.tipo === 'apoyo') ? 0.75 : 1.0;
          if (p.task.tipo === 'presionar' && carrier) { tx = carrier.x + (team === 0 ? -1.2 : 1.2); ty = carrier.y; }
          if (p.task.tipo === 'perseguir') { tx = b.x + b.vx * 0.25; ty = b.y + b.vy * 0.25; }
        } else {
          var anc2 = this._ancla(p);
          tx = anc2.x; ty = anc2.y; modo = 0.62;
        }
        this._integrar(p, tx, ty, modo, dt);
      }
    }
    this._separacion(dt);

    // saques: ejecutar cuando el que saca llega
    if (f.tipo === 'saque') {
      f.timer -= dt;
      var lejos = f.taker ? dist(f.taker.x, f.taker.y, f.x, f.y) : 0;
      if (f.timer <= 0 && lejos < 2.2) this._ejecutarSaque();
      else if (f.timer < -4) this._ejecutarSaque(); // por si se atasca
      // el balón espera en el punto de saque
      b.x = f.x; b.y = f.y; b.z = 0; b.vx = 0; b.vy = 0;
      this.stats[this.posesionTeam()].posesion += dt;
      return;
    }

    this._moverBalon(dt);
    this._entradas(dt);
    this.stats[this.posesionTeam()].posesion += dt;
  };

  MatchEngine.prototype.reanudar = function () { this.pausado = false; };

  MatchEngine.prototype._notasFinales = function () {
    var self = this;
    var gana = this.marcador[0] > this.marcador[1] ? 0 : this.marcador[1] > this.marcador[0] ? 1 : -1;
    this.players.forEach(function (arr, team) {
      arr.forEach(function (p) {
        if (gana === team) p.nota += 0.3;
        else if (gana === 1 - team) p.nota -= 0.2;
        if (p.rol === 'GK') p.nota -= self.marcador[1 - team] * 0.15;
        p.nota = clamp(Math.round(p.nota * 10) / 10, 3, 10);
      });
    });
  };

  MatchEngine.prototype.runAll = function () {
    var pasos = 0;
    while (!this.terminado && pasos < 4000) {
      this.step(0.1);
      pasos++;
    }
    if (!this.terminado) { this.terminado = true; this._notasFinales(); }
    return this.resultado();
  };

  MatchEngine.prototype.resultado = function () {
    var total = this.stats[0].posesion + this.stats[1].posesion || 1;
    var self = this;
    function statsDe(t) {
      var s = self.stats[t];
      return {
        posesion: Math.round(s.posesion / total * 100),
        tiros: s.tiros, aPuerta: s.aPuerta,
        xg: Math.round(s.xg * 100) / 100,
        pases: s.pases, pasesOk: s.pasesOk,
        faltas: s.faltas, amarillas: s.amarillas, rojas: s.rojas, corners: s.corners
      };
    }
    function jugadoresDe(t) {
      return self.players[t].map(function (p) {
        return {
          cardId: p.cardId, nombre: p.nombre, pos: p.pos, rol: p.rol,
          nota: p.nota, goles: p.st.goles, asis: p.st.asis,
          paradas: p.st.paradas, entradas: p.st.entradas,
          pases: p.st.pases, pasesOk: p.st.pasesOk,
          tiros: p.st.tiros, amarilla: p.amarilla, roja: p.roja,
          stamina: Math.round(p.stamina)
        };
      });
    }
    return {
      gf: this.marcador[0], gc: this.marcador[1],
      goleadores: this.goleadores,
      stats: [statsDe(0), statsDe(1)],
      jugadores: [jugadoresDe(0), jugadoresDe(1)]
    };
  };

  // partido IA vs IA instantáneo (resto de la jornada)
  function simRapida(equipoA, equipoB) {
    var motor = new MatchEngine(contextoIA(equipoA, false), contextoIA(equipoB, false), {});
    var r = motor.runAll();
    return r;
  }

  return {
    CAMPO: CAMPO,
    MatchEngine: MatchEngine,
    contextoJugador: contextoJugador,
    contextoIA: contextoIA,
    simRapida: simRapida
  };
})();

if (typeof module !== 'undefined') module.exports = Engine;
