/* ============================================================
   MATCH — partido en Phaser con simulación posicional:
   jugadores que se desplazan tácticamente, balón pegado al
   portador, pases entre jugadores, desmarques, presión, tiros
   y estirada del portero. El jugador humano siempre es el
   equipo 0 (ataca hacia la derecha).
   ============================================================ */

var Match = (function () {

  var BASE_DELAY = 820; // ms por minuto simulado a x1 (~74 s por partido)
  var W = 900, H = 540;
  var current = null;

  // X base por línea (fracción del campo, atacando hacia la derecha)
  var LINE_X = { por: 0.06, def: 0.19, med: 0.40, del: 0.60 };
  // Y por línea (fracción de la altura útil)
  var LINE_Y = {
    por: [0.5],
    def: [0.14, 0.38, 0.62, 0.86],
    med: [0.22, 0.5, 0.78],
    del: [0.18, 0.5, 0.82]
  };
  // slots 0..10 → línea e índice dentro de la línea
  var SLOT_LINE = [
    ['por', 0],
    ['def', 0], ['def', 1], ['def', 2], ['def', 3],
    ['med', 0], ['med', 1], ['med', 2],
    ['del', 0], ['del', 1], ['del', 2]
  ];

  function fieldY(fy) { return 40 + fy * (H - 80); }

  function esClaro(color) {
    var r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    return r * 0.299 + g * 0.587 + b * 0.114 > 150;
  }

  // aclara un color oscuro para que sea legible como texto sobre fondo oscuro
  function colorTexto(color) {
    var r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    if (r * 0.299 + g * 0.587 + b * 0.114 < 90) {
      r = Math.min(255, r + 110); g = Math.min(255, g + 110); b = Math.min(255, b + 110);
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ---------- feed / HUD (DOM) ----------
  function feedLine(html, cls) {
    var feed = document.getElementById('match-feed');
    var d = document.createElement('div');
    d.className = 'feed-line ' + (cls || '');
    d.innerHTML = html;
    feed.insertBefore(d, feed.firstChild);
    while (feed.children.length > 30) feed.removeChild(feed.lastChild);
  }

  function updateHUD() {
    if (!current) return;
    var e = current.engine;
    document.getElementById('sb-score').textContent = e.goles[0] + ' - ' + e.goles[1];
    document.getElementById('sb-minute').textContent = Math.min(90, e.minuto) + "'";
  }

  // ---------- escena ----------
  function crearJuego(colores) {
    var sceneConfig = {
      create: function () {
        var s = this;
        current.scene = s;
        s.players = [[], []];
        s.anim = { carrier: null, flying: false, queue: [], busy: false, celebrando: false };

        // césped
        var g = s.add.graphics();
        g.fillStyle(0x17542a, 1);
        g.fillRoundedRect(6, 6, W - 12, H - 12, 14);
        for (var i = 0; i < 9; i++) {
          g.fillStyle(i % 2 ? 0x1b5e30 : 0x17542a, 1);
          g.fillRect(8 + i * (W - 16) / 9, 8, (W - 16) / 9, H - 16);
        }
        g.lineStyle(2, 0xffffff, 0.55);
        g.strokeRoundedRect(20, 20, W - 40, H - 40, 6);
        g.strokeCircle(W / 2, H / 2, 62);
        g.lineBetween(W / 2, 20, W / 2, H - 20);
        g.strokeRect(20, H / 2 - 105, 92, 210);
        g.strokeRect(W - 112, H / 2 - 105, 92, 210);
        g.strokeRect(20, H / 2 - 52, 38, 104);
        g.strokeRect(W - 58, H / 2 - 52, 38, 104);
        g.lineStyle(5, 0xffffff, 0.95);
        g.lineBetween(21, H / 2 - 44, 21, H / 2 + 44);
        g.lineBetween(W - 21, H / 2 - 44, W - 21, H / 2 + 44);

        // textura de partícula
        var pg = s.make.graphics({ x: 0, y: 0, add: false });
        pg.fillStyle(0xffffff, 1);
        pg.fillCircle(6, 6, 6);
        pg.generateTexture('spark', 12, 12);

        // anillo del portador
        s.carrierRing = s.add.circle(W / 2, H / 2, 15, 0x000000, 0);
        s.carrierRing.setStrokeStyle(2, 0xffe14d, 0.9);
        s.carrierRing.setVisible(false);

        // jugadores
        function colocar(team, color) {
          SLOT_LINE.forEach(function (sl, idx) {
            var fx = LINE_X[sl[0]], fy = LINE_Y[sl[0]][sl[1]];
            var x = team === 0 ? fx * W : (1 - fx) * W;
            var y = fieldY(fy);
            var c = s.add.circle(x, y, 11, color);
            c.setStrokeStyle(2, 0xffffff, 0.9);
            var num = s.add.text(x, y, String(idx === 0 ? 1 : idx + 1), {
              fontFamily: 'Arial Black, sans-serif', fontSize: '9px', color: esClaro(color) ? '#222' : '#fff'
            }).setOrigin(0.5);
            s.players[team].push({
              c: c, num: num,
              baseFX: fx, baseFY: fy, line: sl[0],
              tx: x, ty: y,
              phase: Math.random() * Math.PI * 2,
              phase2: Math.random() * Math.PI * 2,
              runX: 0, runY: 0 // impulso de desmarque temporal
            });
          });
        }
        colocar(0, colores[0]);
        colocar(1, colores[1]);

        s.ball = s.add.circle(W / 2, H / 2, 5, 0xffffff);
        s.ball.setStrokeStyle(1, 0x222222, 0.9);
        s.ballShadow = s.add.ellipse(W / 2, H / 2 + 4, 8, 3, 0x000000, 0.25);

        s.cameras.main.setBackgroundColor('#0d0b14');
        setCarrier(0, 6); // MED centro del equipo 0 para el saque
      },

      update: function (time, delta) {
        var s = this;
        if (!current || !s.players || !s.players[0].length) return;
        var spd = current.speed;
        var e = current.engine;

        // desplazamiento táctico por posesión/zona: la línea del poseedor sube,
        // la del defensor se repliega y compacta
        var pos = e.posesion, zona = e.zona;
        var shift = [[0, 0], [0, 0]]; // [avance, compactación] por equipo
        shift[pos][0] = (zona - 1) * 0.075 + 0.02;
        shift[1 - pos][0] = -((zona - 1) * 0.06 + 0.015);
        shift[1 - pos][1] = zona === 2 ? 0.18 : 0.06;

        var ballX = s.ball.x, ballY = s.ball.y;

        for (var team = 0; team < 2; team++) {
          var dir = team === 0 ? 1 : -1;
          for (var i = 0; i < 11; i++) {
            var p = s.players[team][i];
            var fx = p.baseFX + (p.line === 'por' ? 0 : shift[team][0]);
            var x = team === 0 ? fx * W : (1 - fx) * W;
            // compactación vertical hacia el centro cuando defienden cerca
            var fy = p.baseFY + (0.5 - p.baseFY) * shift[team][1];
            var y = fieldY(fy);

            // movimiento orgánico: nadie se queda clavado
            x += Math.sin(time * 0.0011 * (1 + spd * 0.15) + p.phase) * 9;
            y += Math.cos(time * 0.0009 * (1 + spd * 0.15) + p.phase2) * 11;

            // impulso de desmarque (decae solo)
            x += p.runX; y += p.runY;
            p.runX *= Math.pow(0.994, delta); p.runY *= Math.pow(0.994, delta);

            // presión: el defensor de campo más cercano al balón lo acosa
            if (team !== pos && p.line !== 'por' && !s.anim.celebrando) {
              var dx = ballX - p.c.x, dy = ballY - p.c.y;
              var d2 = dx * dx + dy * dy;
              if (d2 < 150 * 150) {
                var f = Math.max(0.35, 1 - Math.sqrt(d2) / 150);
                // se coloca entre el balón y su propia portería
                x = x + (ballX - dir * 14 - x) * f * 0.55;
                y = y + (ballY - y) * f * 0.55;
              }
            }

            // el portador empuja ligeramente hacia la portería rival
            var isCarrier = s.anim.carrier && s.anim.carrier.team === team && s.anim.carrier.idx === i;
            if (isCarrier) x += dir * 16;

            p.tx = x; p.ty = y;
            var k = 1 - Math.exp(-delta * 0.0035 * (0.8 + spd * 0.35));
            p.c.x += (p.tx - p.c.x) * k;
            p.c.y += (p.ty - p.c.y) * k;
            p.num.x = p.c.x; p.num.y = p.c.y;
          }
        }

        // balón pegado al portador (regate con bote corto)
        if (s.anim.carrier && !s.anim.flying) {
          var cp = s.players[s.anim.carrier.team][s.anim.carrier.idx];
          var cdir = s.anim.carrier.team === 0 ? 1 : -1;
          s.ball.x = cp.c.x + cdir * 13 + Math.sin(time * 0.02) * 2;
          s.ball.y = cp.c.y + Math.cos(time * 0.016) * 3;
        }
        s.ballShadow.x = s.ball.x; s.ballShadow.y = s.ball.y + 5;

        // anillo sobre el portador
        if (s.anim.carrier) {
          var cc = s.players[s.anim.carrier.team][s.anim.carrier.idx].c;
          s.carrierRing.setVisible(true);
          s.carrierRing.x = cc.x; s.carrierRing.y = cc.y;
        } else {
          s.carrierRing.setVisible(false);
        }
      }
    };

    return new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'phaser-container',
      width: W, height: H,
      scene: sceneConfig,
      banner: false
    });
  }

  // ---------- utilidades de animación ----------
  function scene() { return current && current.scene; }

  function setCarrier(team, idx) {
    var s = scene();
    if (!s) return;
    s.anim.carrier = { team: team, idx: idx };
    s.anim.flying = false;
  }

  function randomDe(team, lineas) {
    var s = scene();
    var candidatos = [];
    s.players[team].forEach(function (p, i) {
      if (lineas.indexOf(p.line) >= 0) candidatos.push(i);
    });
    return candidatos[Math.floor(Math.random() * candidatos.length)];
  }

  function idxDeCard(cardId) {
    if (!current.lineupIds) return -1;
    return current.lineupIds.indexOf(cardId);
  }

  // vuelo del balón hacia un jugador; al llegar, ese jugador es el portador
  function passTo(team, idx, dur, onDone) {
    var s = scene();
    if (!s) { if (onDone) onDone(); return; }
    var destino = s.players[team][idx];
    // desmarque: el receptor se abre a un hueco mientras viaja el balón
    var ddir = team === 0 ? 1 : -1;
    destino.runX += ddir * (10 + Math.random() * 22);
    destino.runY += (Math.random() * 2 - 1) * 26;
    s.anim.flying = true;
    s.anim.carrier = null;
    // pase al hueco: punto previsto según la arrancada del receptor
    var px2 = destino.c.x + destino.runX * 1.1 + ddir * 12;
    var py2 = destino.c.y + destino.runY * 1.1;
    s.tweens.add({
      targets: s.ball,
      x: px2, y: py2,
      duration: dur,
      ease: 'Quad.easeOut',
      onComplete: function () {
        setCarrier(team, idx);
        if (onDone) onDone();
      }
    });
  }

  // cola de acciones visuales para que los eventos del tick se encadenen
  function enqueue(fn) {
    var s = scene();
    if (!s) return;
    if (s.anim.queue.length > 5) s.anim.queue.shift(); // no acumular retraso
    s.anim.queue.push(fn);
    drainQueue();
  }

  function drainQueue() {
    var s = scene();
    if (!s || s.anim.busy) return;
    var fn = s.anim.queue.shift();
    if (!fn) return;
    s.anim.busy = true;
    fn(function () {
      if (!scene()) return;
      s.anim.busy = false;
      drainQueue();
    });
  }

  function dur(ms) { return Math.max(60, ms / (current ? current.speed : 1)); }

  // ---------- acciones visuales ----------
  function animPase(team, zona) {
    enqueue(function (done) {
      var s = scene();
      if (!s) return done();
      var linea = zona >= 2 ? ['del'] : zona === 1 ? ['med', 'del'] : ['def', 'med'];
      // 25%: conducción del portador en vez de pase
      if (s.anim.carrier && s.anim.carrier.team === team && Math.random() < 0.25) {
        var p = s.players[team][s.anim.carrier.idx];
        p.runX += (team === 0 ? 1 : -1) * 34;
        s.time.delayedCall(dur(240), done);
        return;
      }
      var idx = randomDe(team, linea);
      passTo(team, idx, dur(340), done);
    });
  }

  function animCircula(team) {
    enqueue(function (done) {
      passTo(team, randomDe(team, ['med', 'del']), dur(300), done);
    });
  }

  function animPerdida(teamPerdedor) {
    enqueue(function (done) {
      var rival = 1 - teamPerdedor;
      passTo(rival, randomDe(rival, ['def', 'med']), dur(300), done);
    });
  }

  function animOcasion(team, cardId) {
    enqueue(function (done) {
      var s = scene();
      if (!s) return done();
      var idx = team === 0 ? idxDeCard(cardId) : -1;
      if (idx < 0) idx = randomDe(team, ['del', 'med']);
      // el rematador arranca hacia el área
      var p = s.players[team][idx];
      p.runX += (team === 0 ? 1 : -1) * 40;
      passTo(team, idx, dur(300), done);
    });
  }

  // tiro: outcome = 'gol' | 'parada' | 'fuera'
  function animTiro(team, outcome) {
    enqueue(function (done) {
      var s = scene();
      if (!s) return done();
      var dirGoal = team === 0 ? W - 21 : 21;
      var rival = 1 - team;
      var keeper = s.players[rival][0];
      var targetY = H / 2 + (Math.random() * 2 - 1) * 38;
      if (outcome === 'fuera') targetY = H / 2 + (Math.random() < 0.5 ? -1 : 1) * (55 + Math.random() * 40);

      s.anim.flying = true;
      s.anim.carrier = null;

      // estirada del portero: hacia el balón si para, al lado contrario si es gol
      var diveY = outcome === 'parada' ? targetY : H / 2 - (targetY - H / 2) * 0.8;
      keeper.runY += (diveY - keeper.c.y) * 1.4;

      s.tweens.add({
        targets: s.ball,
        x: dirGoal, y: targetY,
        duration: dur(230),
        ease: 'Cubic.easeIn',
        onComplete: function () {
          if (!scene()) return done();
          if (outcome === 'gol') {
            celebrarGol(team, dirGoal, targetY, done);
          } else if (outcome === 'parada') {
            // el portero se queda el balón y saca
            setCarrier(rival, 0);
            s.time.delayedCall(dur(350), function () {
              if (scene()) passTo(rival, randomDe(rival, ['def']), dur(320), done);
              else done();
            });
          } else {
            // fuera: saque de puerta
            s.ball.x = dirGoal + (team === 0 ? 14 : -14);
            s.time.delayedCall(dur(300), function () {
              setCarrier(rival, 0);
              done();
            });
          }
        }
      });
    });
  }

  function celebrarGol(team, gx, gy, done) {
    var s = scene();
    if (!s) return done();
    s.anim.celebrando = true;
    s.cameras.main.shake(300, 0.012);
    s.cameras.main.flash(150, 255, 255, 255);
    var part = s.add.particles(gx, gy, 'spark', {
      speed: { min: 80, max: 280 }, lifespan: 750, quantity: 26,
      scale: { start: 1, end: 0 }, emitting: false,
      tint: current.colores[team]
    });
    part.explode(26);
    var txt = s.add.text(W / 2, H / 2, '¡GOOOL!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '64px', color: '#ffe14d',
      stroke: '#000', strokeThickness: 8
    }).setOrigin(0.5).setScale(0.2);
    s.tweens.add({
      targets: txt, scale: 1.1, duration: 320, ease: 'Back.easeOut',
      onComplete: function () {
        s.tweens.add({ targets: txt, alpha: 0, scale: 1.4, delay: 450, duration: 300, onComplete: function () { txt.destroy(); } });
      }
    });
    // los compañeros del goleador se arremolinan un instante
    s.players[team].forEach(function (p) {
      if (p.line === 'por') return;
      p.runX += (gx - p.c.x) * 0.18;
      p.runY += (gy - p.c.y) * 0.18;
    });
    document.getElementById('screen-match').classList.add('shake');
    setTimeout(function () { document.getElementById('screen-match').classList.remove('shake'); }, 450);

    // saque de centro del equipo que encaja
    s.time.delayedCall(dur(900), function () {
      if (!scene()) return done();
      s.anim.celebrando = false;
      s.ball.x = W / 2; s.ball.y = H / 2;
      setCarrier(1 - team, 6);
      done();
    });
  }

  function glowJugador(team, cardId, pos) {
    var s = scene();
    if (!s) return;
    var idx = team === 0 ? idxDeCard(cardId) : -1;
    if (idx < 0) {
      var rangos = { POR: [0, 0], DEF: [1, 4], MED: [5, 7], DEL: [8, 10] };
      var r = rangos[pos] || [5, 7];
      idx = r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
    }
    var p = s.players[team][idx];
    if (!p) return;
    var ring = s.add.circle(p.c.x, p.c.y, 14, 0x000000, 0);
    ring.setStrokeStyle(3, 0xffe14d, 1);
    s.tweens.add({
      targets: ring, radius: 32, alpha: 0, duration: 700, ease: 'Quad.easeOut',
      onUpdate: function () {
        ring.x = p.c.x; ring.y = p.c.y;
        ring.setStrokeStyle(3, 0xffe14d, Math.max(0, ring.alpha));
      },
      onComplete: function () { ring.destroy(); }
    });
  }

  function resetPosiciones(posesionTeam) {
    var s = scene();
    if (!s) return;
    s.anim.queue = [];
    s.ball.x = W / 2; s.ball.y = H / 2;
    setCarrier(posesionTeam, 6);
  }

  // ---------- procesado de eventos del motor ----------
  function procesarEventos(eventos, visual) {
    var e = current.engine;
    eventos.forEach(function (ev) {
      var esJugador = ev.team === 0;
      switch (ev.t) {
        case 'inicio':
          feedLine("🏁 ¡Comienza el partido!");
          if (visual) { AudioFX.silbato(); resetPosiciones(ev.team); }
          break;
        case 'descanso':
          feedLine("🥤 Descanso.");
          if (visual) resetPosiciones(e.posesion);
          break;
        case 'avance':
          if (visual) animPase(ev.team, ev.zona);
          break;
        case 'circula':
          if (visual) animCircula(ev.team);
          break;
        case 'perdida':
          if (visual) animPerdida(ev.team);
          break;
        case 'ocasion':
          feedLine(ev.min + "' ⚡ Ocasión de <b>" + ev.jugador + "</b>" + (esJugador ? '' : ' (rival)'), esJugador ? 'feed-mia' : 'feed-rival');
          if (visual) { AudioFX.ocasion(); animOcasion(ev.team, ev.cardId); }
          break;
        case 'gol':
          feedLine(ev.min + "' ⚽ <b>¡GOL de " + ev.jugador + "!</b> (" + ev.marcador[0] + '-' + ev.marcador[1] + ')', esJugador ? 'feed-gol' : 'feed-gol-rival');
          if (visual) {
            animTiro(ev.team, 'gol');
            if (esJugador) AudioFX.gol(); else AudioFX.golRival();
          }
          break;
        case 'parada':
          feedLine(ev.min + "' 🧤 ¡Paradón a " + ev.jugador + '!');
          if (visual) { animTiro(ev.team, 'parada'); AudioFX.parada(); }
          break;
        case 'fuera':
          feedLine(ev.min + "' 💨 " + ev.jugador + ' la manda fuera');
          if (visual) animTiro(ev.team, 'fuera');
          break;
        case 'habilidad':
          var hab = Gen.HABILIDADES[ev.hab];
          feedLine(ev.min + "' ✨ <b>" + (hab ? hab.nombre : ev.hab) + "</b> de " + (ev.jugador || 'un jugador') + ' se activa', 'feed-hab');
          if (visual) {
            AudioFX.habilidad();
            var carta = ev.cardId ? State.cartaPorId(ev.cardId) : null;
            glowJugador(ev.team, ev.cardId, carta ? carta.pos : 'MED');
          }
          break;
        case 'final':
          feedLine('🏁 Final del partido. <b>' + ev.marcador[0] + ' - ' + ev.marcador[1] + '</b>');
          if (visual) AudioFX.silbato();
          break;
      }
    });
    updateHUD();
  }

  // ---------- bucle ----------
  function tick() {
    if (!current || current.terminado) return;
    var eventos = current.engine.step();
    try {
      procesarEventos(eventos, true);
    } catch (e) {
      // un fallo de render no debe detener el partido
      if (window.console) console.warn('render error', e);
    }
    if (current.engine.terminado) {
      finalizar(1200);
    } else {
      current.timer = setTimeout(tick, BASE_DELAY / current.speed);
    }
  }

  function finalizar(delay) {
    if (!current || current.terminado) return;
    current.terminado = true;
    clearTimeout(current.timer);
    var resultado = {
      gf: current.engine.goles[0],
      gc: current.engine.goles[1],
      goleadores: current.engine.goleadores
    };
    var fin = current.onFinish;
    setTimeout(function () {
      if (current && current.game) current.game.destroy(true);
      current = null;
      fin(resultado);
    }, delay);
  }

  function skip() {
    if (!current || current.terminado) return;
    clearTimeout(current.timer);
    while (!current.engine.terminado) {
      procesarEventos(current.engine.step(), false);
    }
    finalizar(400);
  }

  // ---------- API ----------
  function start(ctxJugador, ctxRival, opts, onFinish) {
    var engine = new Engine.MatchEngine(ctxJugador, ctxRival, opts);
    document.getElementById('match-feed').innerHTML = '';
    document.getElementById('sb-home').textContent = ctxJugador.nombre;
    document.getElementById('sb-away').textContent = ctxRival.nombre;
    document.getElementById('sb-home').style.color = colorTexto(opts.colores[0]);
    document.getElementById('sb-away').style.color = colorTexto(opts.colores[1]);
    document.getElementById('phaser-container').innerHTML = '';

    current = {
      engine: engine,
      speed: 1,
      timer: null,
      game: null,
      scene: null,
      terminado: false,
      colores: opts.colores,
      lineupIds: opts.lineupIds || [],
      onFinish: onFinish
    };
    updateHUD();

    document.querySelectorAll('.speed-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.speed === '1');
      b.onclick = function () {
        AudioFX.click();
        if (!current) return;
        current.speed = parseInt(b.dataset.speed, 10);
        document.querySelectorAll('.speed-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      };
    });
    document.getElementById('btn-skip').onclick = function () { AudioFX.click(); skip(); };

    UI.showScreen('screen-match');

    if (window.Phaser) {
      current.game = crearJuego(opts.colores);
      // deja que Phaser cree la escena antes del primer tick
      setTimeout(tick, 650);
    } else {
      feedLine('⚠️ No se pudo cargar Phaser (sin conexión al CDN). Simulación en modo texto.');
      setTimeout(tick, 400);
    }
  }

  return { start: start };
})();
