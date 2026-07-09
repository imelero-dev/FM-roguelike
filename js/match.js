/* ============================================================
   MATCH — renderizado del partido con Phaser + HUD DOM.
   El jugador siempre es el equipo 0 (izquierda).
   ============================================================ */

var Match = (function () {

  var BASE_DELAY = 720; // ms por minuto simulado a x1  (~65 s por partido)
  var current = null;

  // posiciones 4-3-3 en fracción del campo (equipo que ataca hacia la derecha)
  var FORM = [
    [0.06, 0.50],
    [0.18, 0.15], [0.16, 0.38], [0.16, 0.62], [0.18, 0.85],
    [0.32, 0.25], [0.30, 0.50], [0.32, 0.75],
    [0.44, 0.20], [0.46, 0.50], [0.44, 0.80]
  ];

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

  // ---------- Escena Phaser ----------
  function crearJuego(colores) {
    var W = 900, H = 540;
    var sceneConfig = {
      preload: function () {},
      create: function () {
        var s = this;
        s.circles = [[], []];
        s.ball = null;
        current.scene = s;

        // césped
        var g = s.add.graphics();
        g.fillStyle(0x1a5c2a, 1);
        g.fillRoundedRect(10, 10, W - 20, H - 20, 16);
        for (var i = 0; i < 7; i++) {
          g.fillStyle(i % 2 ? 0x1e6630 : 0x1a5c2a, 1);
          g.fillRect(10 + i * (W - 20) / 7, 12, (W - 20) / 7, H - 24);
        }
        g.lineStyle(2, 0xffffff, 0.6);
        g.strokeRoundedRect(20, 20, W - 40, H - 40, 8);
        g.strokeCircle(W / 2, H / 2, 60);
        g.lineBetween(W / 2, 20, W / 2, H - 20);
        // áreas
        g.strokeRect(20, H / 2 - 100, 90, 200);
        g.strokeRect(W - 110, H / 2 - 100, 90, 200);
        // porterías
        g.lineStyle(4, 0xffffff, 0.9);
        g.lineBetween(20, H / 2 - 45, 20, H / 2 + 45);
        g.lineBetween(W - 20, H / 2 - 45, W - 20, H / 2 + 45);

        // textura de partícula
        var pg = s.make.graphics({ x: 0, y: 0, add: false });
        pg.fillStyle(0xffffff, 1);
        pg.fillCircle(6, 6, 6);
        pg.generateTexture('spark', 12, 12);

        // jugadores
        function colocar(equipo, color) {
          FORM.forEach(function (f, i) {
            var x = equipo === 0 ? f[0] * W : (1 - f[0]) * W;
            var y = f[1] * (H - 80) + 40;
            var c = s.add.circle(x, y, 11, color);
            c.setStrokeStyle(2, 0xffffff, 0.85);
            s.circles[equipo].push(c);
            // respiración sutil
            s.tweens.add({
              targets: c, x: x + (Math.random() * 16 - 8), y: y + (Math.random() * 16 - 8),
              duration: 1200 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
          });
        }
        colocar(0, colores[0]);
        colocar(1, colores[1]);

        s.ball = s.add.circle(W / 2, H / 2, 6, 0xffffff);
        s.ball.setStrokeStyle(1, 0x222222, 0.8);
        s.cameras.main.setBackgroundColor('#0d0b14');
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

  function posBalon(team, zona) {
    var W = 900, H = 540;
    // zonas desde la perspectiva del poseedor; equipo 0 ataca a la derecha
    var fx = zona === 0 ? 0.2 : zona === 1 ? 0.5 : 0.8;
    var x = team === 0 ? fx * W : (1 - fx) * W;
    var y = H / 2 + (Math.random() * 2 - 1) * H * 0.3;
    return { x: x, y: y };
  }

  function moverBalon(team, zona, dur) {
    if (!current || !current.scene || !current.scene.ball) return;
    var s = current.scene;
    var p = posBalon(team, zona);
    s.tweens.add({ targets: s.ball, x: p.x, y: p.y, duration: dur, ease: 'Quad.easeOut' });
  }

  function golVisual(team) {
    if (!current || !current.scene) return;
    var s = current.scene;
    var W = 900, H = 540;
    var gx = team === 0 ? W - 22 : 22;
    s.tweens.add({ targets: s.ball, x: gx, y: H / 2, duration: 220, ease: 'Cubic.easeIn' });
    s.cameras.main.shake(300, 0.012);
    s.cameras.main.flash(150, 255, 255, 255);
    var part = s.add.particles(gx, H / 2, 'spark', {
      speed: { min: 80, max: 260 }, lifespan: 700, quantity: 24,
      scale: { start: 1, end: 0 }, emitting: false,
      tint: team === 0 ? current.colores[0] : current.colores[1]
    });
    part.explode(24);
    var txt = s.add.text(W / 2, H / 2, '¡GOOOL!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '64px', color: '#ffe14d',
      stroke: '#000', strokeThickness: 8
    }).setOrigin(0.5).setScale(0.2);
    s.tweens.add({
      targets: txt, scale: 1.1, duration: 350, ease: 'Back.easeOut',
      onComplete: function () {
        s.tweens.add({ targets: txt, alpha: 0, scale: 1.4, delay: 550, duration: 350, onComplete: function () { txt.destroy(); } });
      }
    });
    document.getElementById('screen-match').classList.add('shake');
    setTimeout(function () { document.getElementById('screen-match').classList.remove('shake'); }, 450);
  }

  function glowJugador(team, cardId, pos) {
    if (!current || !current.scene) return;
    var s = current.scene;
    var idx = -1;
    if (team === 0 && current.lineupIds) idx = current.lineupIds.indexOf(cardId);
    if (idx < 0) {
      // rival o no encontrado: elige un círculo plausible por posición
      var rangos = { POR: [0, 0], DEF: [1, 4], MED: [5, 7], DEL: [8, 10] };
      var r = rangos[pos] || [5, 7];
      idx = r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
    }
    var c = current.scene.circles[team][idx];
    if (!c) return;
    var ring = s.add.circle(c.x, c.y, 14, 0x000000, 0);
    ring.setStrokeStyle(3, 0xffe14d, 1);
    s.tweens.add({
      targets: ring, radius: 30, alpha: 0, duration: 700, ease: 'Quad.easeOut',
      onUpdate: function () { ring.setStrokeStyle(3, 0xffe14d, ring.alpha); },
      onComplete: function () { ring.destroy(); }
    });
  }

  // ---------- procesado de eventos ----------
  function procesarEventos(eventos, visual) {
    var e = current.engine;
    eventos.forEach(function (ev) {
      var esJugador = ev.team === 0;
      switch (ev.t) {
        case 'inicio':
          feedLine("🏁 ¡Comienza el partido!");
          if (visual) AudioFX.silbato();
          break;
        case 'descanso':
          feedLine("🥤 Descanso.");
          break;
        case 'avance':
        case 'circula':
          if (visual) moverBalon(ev.team, e.zona, BASE_DELAY / current.speed * 0.7);
          break;
        case 'perdida':
          if (visual) moverBalon(1 - ev.team, e.zona, BASE_DELAY / current.speed * 0.7);
          break;
        case 'ocasion':
          feedLine(ev.min + "' ⚡ Ocasión de <b>" + ev.jugador + "</b>" + (esJugador ? '' : ' (rival)'), esJugador ? 'feed-mia' : 'feed-rival');
          if (visual) AudioFX.ocasion();
          break;
        case 'gol':
          feedLine(ev.min + "' ⚽ <b>¡GOL de " + ev.jugador + "!</b> (" + ev.marcador[0] + '-' + ev.marcador[1] + ')', esJugador ? 'feed-gol' : 'feed-gol-rival');
          if (visual) {
            golVisual(ev.team);
            if (esJugador) AudioFX.gol(); else AudioFX.golRival();
          }
          break;
        case 'parada':
          feedLine(ev.min + "' 🧤 ¡Paradón a " + ev.jugador + '!');
          if (visual) AudioFX.parada();
          break;
        case 'fuera':
          feedLine(ev.min + "' 💨 " + ev.jugador + ' la manda fuera');
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
    document.getElementById('sb-home').style.color = UI.colorHex(opts.colores[0]);
    document.getElementById('sb-away').style.color = UI.colorHex(opts.colores[1]);
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
      setTimeout(tick, 600);
    } else {
      feedLine('⚠️ No se pudo cargar Phaser (sin conexión al CDN). Simulación en modo texto.');
      setTimeout(tick, 400);
    }
  }

  return { start: start };
})();
