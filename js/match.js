/* ============================================================
   MATCH — Phaser match rendering. The Engine holds ALL the
   logic: here we only advance the engine clock at the chosen
   speed, draw its state (22 players, ball with flight and shadow,
   trail) and turn its events into feed, sound and effects.
   Half-time summary card with a tactical pause; the
   commentary phrasing lives in commentary.js.
   ============================================================ */

var Match = (function () {

  var W = 940, H = 620;
  var SX = 8.4, SY = 8.4;
  var OX = (W - 105 * SX) / 2, OY = (H - 68 * SY) / 2;
  var current = null;

  function px(u) { return OX + u * SX; }
  function py(u) { return OY + u * SY; }

  function esClaro(color) {
    var r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    return r * 0.299 + g * 0.587 + b * 0.114 > 150;
  }

  function colorTexto(color) {
    var r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    if (r * 0.299 + g * 0.587 + b * 0.114 < 90) {
      r = Math.min(255, r + 110); g = Math.min(255, g + 110); b = Math.min(255, b + 110);
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // alternate goalkeeper colour
  function colorGK(color) {
    return esClaro(color) ? 0x222831 : 0xf3e04b;
  }

  // ---------- feed / HUD ----------
  function feedLine(html, cls) {
    var feed = document.getElementById('match-feed');
    var d = document.createElement('div');
    d.className = 'feed-line ' + (cls || '');
    d.innerHTML = html;
    feed.insertBefore(d, feed.firstChild);
    while (feed.children.length > 40) feed.removeChild(feed.lastChild);
  }

  function updateHUD() {
    if (!current) return;
    var e = current.engine;
    document.getElementById('sb-score').textContent = e.marcador[0] + ' - ' + e.marcador[1];
    document.getElementById('sb-minute').textContent = e.minuto + "'";
    var total = e.stats[0].posesion + e.stats[1].posesion || 1;
    var p0 = Math.round(e.stats[0].posesion / total * 100);
    document.getElementById('ms-pos-fill').style.width = p0 + '%';
    document.getElementById('ms-pos-val').textContent = p0 + '%';
    document.getElementById('ms-tiros').textContent = e.stats[0].tiros + ' (' + e.stats[0].aPuerta + ') · Shots · ' + e.stats[1].tiros + ' (' + e.stats[1].aPuerta + ')';
    document.getElementById('ms-corners').textContent = e.stats[0].corners + ' · Corners · ' + e.stats[1].corners;
  }

  // ---------- scene ----------
  function crearJuego(colores) {
    var sceneConfig = {
      create: function () {
        var s = this;
        current.scene = s;

        // ----- pitch -----
        var g = s.add.graphics();
        g.fillStyle(0x0d2416, 1);
        g.fillRect(0, 0, W, H);
        // grass with mowing stripes
        for (var i = 0; i < 10; i++) {
          g.fillStyle(i % 2 ? 0x1c6b35 : 0x175c2d, 1);
          g.fillRect(px(i * 10.5), py(0) - 8, 10.5 * SX, 68 * SY + 16);
        }
        // lines
        g.lineStyle(2, 0xffffff, 0.75);
        g.strokeRect(px(0), py(0), 105 * SX, 68 * SY);
        g.lineBetween(px(52.5), py(0), px(52.5), py(68));
        g.strokeCircle(px(52.5), py(34), 9.15 * SX);
        g.fillStyle(0xffffff, 0.75);
        g.fillCircle(px(52.5), py(34), 3);
        // penalty areas
        [0, 1].forEach(function (side) {
          var x0 = side === 0 ? 0 : 105;
          var dir = side === 0 ? 1 : -1;
          g.lineStyle(2, 0xffffff, 0.75);
          g.strokeRect(Math.min(px(x0), px(x0 + dir * 16.5)), py(34 - 20.15), 16.5 * SX, 40.3 * SY);
          g.strokeRect(Math.min(px(x0), px(x0 + dir * 5.5)), py(34 - 9.16), 5.5 * SX, 18.32 * SY);
          g.fillCircle(px(x0 + dir * 11), py(34), 2.5);
          // goals
          g.lineStyle(4, 0xf0f0f0, 0.95);
          g.strokeRect(Math.min(px(x0), px(x0 - dir * 2.2)), py(34 - 3.66), 2.2 * SX, 7.32 * SY);
        });
        // corner arcs
        g.lineStyle(2, 0xffffff, 0.5);
        [[0, 0], [0, 68], [105, 0], [105, 68]].forEach(function (c) {
          g.strokeCircle(px(c[0]), py(c[1]), 1.2 * SX);
        });

        // particle texture
        var pg = s.make.graphics({ x: 0, y: 0, add: false });
        pg.fillStyle(0xffffff, 1);
        pg.fillCircle(6, 6, 6);
        pg.generateTexture('spark', 12, 12);

        // ----- ball trail -----
        s.trail = [];
        for (var t = 0; t < 7; t++) {
          var tc = s.add.circle(0, 0, 3.2 - t * 0.35, 0xffffff, 0.16 - t * 0.02);
          tc.setVisible(false);
          s.trail.push(tc);
        }
        s.trailHist = [];

        // ----- players -----
        s.sprites = [[], []];
        current.engine.players.forEach(function (arr, team) {
          arr.forEach(function (p, i) {
            var col = p.rol === 'GK' ? colorGK(colores[team]) : colores[team];
            var c = s.add.circle(px(p.x), py(p.y), 9.5, col);
            c.setStrokeStyle(2, team === 0 ? 0xffffff : 0x111111, 0.9);
            var num = s.add.text(px(p.x), py(p.y), String(i + 1), {
              fontFamily: 'Arial Black, sans-serif', fontSize: '9px',
              color: esClaro(col) ? '#1a1a1a' : '#ffffff'
            }).setOrigin(0.5);
            s.sprites[team].push({ c: c, num: num });
          });
        });

        // ball carrier ring
        s.ring = s.add.circle(0, 0, 13, 0x000000, 0);
        s.ring.setStrokeStyle(2, 0xffe14d, 0.85);
        s.ring.setVisible(false);

        // ball + shadow
        s.ballShadow = s.add.ellipse(px(52.5), py(34) + 4, 9, 3.5, 0x000000, 0.3);
        s.ball = s.add.circle(px(52.5), py(34), 4.5, 0xffffff);
        s.ball.setStrokeStyle(1.5, 0x222222, 0.9);

        s.cameras.main.setBackgroundColor('#0d0b14');
        s.trailTimer = 0;
      },

      update: function (time, deltaMs) {
        var s = this;
        if (!current || !s.sprites) return;
        var e = current.engine;

        // advance the engine by speed (fixed 50 ms steps)
        if (!current.enDescanso) {
          var avance = Math.min(deltaMs / 1000, 0.1) * current.speed;
          current.acc = (current.acc || 0) + avance;
          var pasos = 0;
          while (current.acc >= 0.05 && pasos < 24 && !e.terminado) {
            e.step(0.05);
            current.acc -= 0.05;
            pasos++;
          }
          procesarEventos(e.drenarEventos(), true);
          if (e.terminado && !current.finalizando) finalizar(1400);
        }

        // draw state
        e.players.forEach(function (arr, team) {
          arr.forEach(function (p, i) {
            var sp = s.sprites[team][i];
            sp.c.x = px(p.x); sp.c.y = py(p.y);
            sp.num.x = sp.c.x; sp.num.y = sp.c.y;
            if (p.off && sp.c.alpha > 0.2) { sp.c.setAlpha(0.15); sp.num.setAlpha(0.15); }
            // visible fatigue: fades as stamina drops
            else if (!p.off) {
              var st = p.stamina / 100;
              sp.c.setAlpha(0.75 + st * 0.25);
            }
          });
        });

        var b = e.ball;
        s.ball.x = px(b.x);
        s.ball.y = py(b.y) - b.z * 3.4;
        var esc = 1 + b.z * 0.07;
        s.ball.setScale(esc);
        s.ballShadow.x = px(b.x);
        s.ballShadow.y = py(b.y) + 4;
        s.ballShadow.setScale(1 + b.z * 0.04);
        s.ballShadow.setAlpha(0.3 - b.z * 0.02);

        // trail
        s.trailTimer += deltaMs;
        if (s.trailTimer > 28) {
          s.trailTimer = 0;
          s.trailHist.unshift({ x: s.ball.x, y: s.ball.y });
          if (s.trailHist.length > 7) s.trailHist.pop();
        }
        var enVuelo = b.plan && (b.plan.tipo === 'tiro' || b.plan.lofted || b.plan.speed > 30);
        s.trail.forEach(function (tc, k) {
          var h = s.trailHist[k + 1];
          if (h && enVuelo) { tc.setVisible(true); tc.x = h.x; tc.y = h.y; }
          else tc.setVisible(false);
        });

        // ball carrier ring
        if (b.owner) {
          var cp = e.players[b.owner.team][b.owner.i];
          s.ring.setVisible(true);
          s.ring.x = px(cp.x); s.ring.y = py(cp.y);
        } else {
          s.ring.setVisible(false);
        }

        current.hudTimer = (current.hudTimer || 0) + deltaMs;
        if (current.hudTimer > 180) { current.hudTimer = 0; updateHUD(); }
      }
    };

    return new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'phaser-container',
      width: W, height: H,
      scene: sceneConfig,
      banner: false,
      // sound goes through AudioFX: avoids a second Phaser AudioContext
      audio: { noAudio: true }
    });
  }

  // ---------- effects ----------
  function glowJugador(team, cardId) {
    var s = current && current.scene;
    if (!s) return;
    var e = current.engine;
    var idx = -1;
    e.players[team].forEach(function (p, i) { if (p.cardId === cardId) idx = i; });
    if (idx < 0) return;
    var p = e.players[team][idx];
    var ring = s.add.circle(px(p.x), py(p.y), 14, 0x000000, 0);
    ring.setStrokeStyle(3, 0xffe14d, 1);
    s.tweens.add({
      targets: ring, radius: 34, alpha: 0, duration: 750, ease: 'Quad.easeOut',
      onUpdate: function () {
        var pp = e.players[team][idx];
        ring.x = px(pp.x); ring.y = py(pp.y);
        ring.setStrokeStyle(3, 0xffe14d, Math.max(0, ring.alpha));
      },
      onComplete: function () { ring.destroy(); }
    });
  }

  function fxGol(team, jugador) {
    var s = current && current.scene;
    if (!s) return;
    s.cameras.main.shake(320, 0.012);
    s.cameras.main.flash(160, 255, 255, 255);
    var b = current.engine.ball;
    var part = s.add.particles(px(b.x), py(b.y), 'spark', {
      speed: { min: 90, max: 300 }, lifespan: 800, quantity: 30,
      scale: { start: 1, end: 0 }, emitting: false,
      tint: current.colores[team]
    });
    part.explode(30);
    var txt = s.add.text(W / 2, H / 2 - 30, 'GOAL!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '64px', color: '#ffe14d',
      stroke: '#000', strokeThickness: 8
    }).setOrigin(0.5).setScale(0.2);
    var sub = s.add.text(W / 2, H / 2 + 22, jugador, {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#ffffff',
      stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0);
    s.tweens.add({
      targets: txt, scale: 1.1, duration: 330, ease: 'Back.easeOut',
      onComplete: function () {
        s.tweens.add({ targets: sub, alpha: 1, duration: 200 });
        s.tweens.add({
          targets: [txt, sub], alpha: 0, delay: 900, duration: 350,
          onComplete: function () { txt.destroy(); sub.destroy(); }
        });
      }
    });
    document.getElementById('screen-match').classList.add('shake');
    setTimeout(function () { document.getElementById('screen-match').classList.remove('shake'); }, 450);
  }

  function fxTarjeta(team, cardId, roja) {
    var s = current && current.scene;
    if (!s) return;
    var e = current.engine;
    var target = null;
    e.players[team].forEach(function (p) { if (p.cardId === cardId) target = p; });
    var x = target ? px(target.x) : W / 2, y = target ? py(target.y) - 24 : H / 2;
    var card = s.add.rectangle(x, y, 13, 18, roja ? 0xe03131 : 0xf5d90a);
    card.setStrokeStyle(1, 0x000000, 0.6);
    card.setAngle(-8);
    s.tweens.add({
      targets: card, y: y - 22, angle: 8, duration: 700, ease: 'Quad.easeOut',
      onComplete: function () {
        s.tweens.add({ targets: card, alpha: 0, duration: 400, onComplete: function () { card.destroy(); } });
      }
    });
  }

  // ---------- engine events ----------
  function procesarEventos(eventos, visual) {
    if (!current) return;
    var c = current.comentarista;
    eventos.forEach(function (ev) {
      var mio = ev.team === 0;
      var lado = mio ? 'feed-mia' : 'feed-rival';
      var key = Commentary.keyFor(ev);
      var txt = key ? c.line(key, {
        p: ev.jugador, k: ev.portero || 'The keeper', v: ev.sobre,
        team: current.nombres[mio ? 0 : 1]
      }) : '';
      var min = ev.min + "' ";
      var m = Commentary.momento(ev);
      if (m) current.momentos.push(m);
      switch (ev.t) {
        case 'inicio':
          feedLine('🏁 ' + txt);
          if (visual) AudioFX.silbato();
          break;
        case 'gol':
          feedLine(min + '⚽ <b>' + txt + '</b>' +
            (ev.asistente ? ' <span class="feed-asist">(assist: ' + ev.asistente + ')</span>' : '') +
            ' (' + ev.marcador[0] + '-' + ev.marcador[1] + ')', mio ? 'feed-gol' : 'feed-gol-rival');
          if (visual) {
            fxGol(ev.team, ev.jugador);
            if (mio) AudioFX.gol(); else AudioFX.golRival();
          }
          break;
        case 'tiro_va':
          // big-chance call while the ball is in flight (live only: the skip summary stays short)
          if (visual && txt) feedLine(min + '😱 <b>' + txt + '</b>', 'feed-chance ' + lado);
          if (visual) AudioFX.ocasion();
          break;
        case 'tiro':
          if (ev.resultado === 'parada') {
            feedLine(min + '🧤 ' + txt, ev.penalti ? lado : '');
            if (visual) AudioFX.parada();
          } else if (ev.resultado === 'palo') {
            feedLine(min + '🥅 ' + txt, lado);
            if (visual) AudioFX.parada();
          } else if (ev.resultado === 'atrapa') {
            feedLine(min + '🧤 ' + txt);
          } else {
            feedLine(min + '💨 ' + txt + (mio ? '' : ' (opp.)'), lado);
          }
          break;
        case 'falta':
          feedLine(min + '⚠️ ' + txt);
          if (visual) AudioFX.silbato();
          break;
        case 'amarilla':
          feedLine(min + '🟨 ' + txt + (mio ? '' : ' (opp.)'));
          if (visual) { fxTarjeta(ev.team, ev.cardId, false); AudioFX.error(); }
          break;
        case 'roja':
          feedLine(min + '🟥 <b>' + txt + '</b>' + (ev.doble ? ' (second yellow)' : ''), 'feed-gol-rival');
          if (visual) { fxTarjeta(ev.team, ev.cardId, true); AudioFX.derrota(); }
          break;
        case 'penalti':
          feedLine(min + '🎯 <b>' + txt + '</b>', mio ? 'feed-gol' : 'feed-gol-rival');
          if (visual) AudioFX.ocasion();
          break;
        case 'corner':
          feedLine(min + '🚩 ' + txt);
          break;
        case 'descanso':
          feedLine('🥤 ' + txt + ' <b>' + ev.marcador[0] + ' - ' + ev.marcador[1] + '</b>');
          if (visual) { AudioFX.silbato(); mostrarDescanso(); }
          break;
        case 'habilidad':
          var hab = Gen.HABILIDADES[ev.hab];
          feedLine(min + '✨ <b>' + (hab ? hab.nombre : ev.hab) + '</b> activated by ' + ev.jugador, 'feed-hab');
          if (visual && mio) { AudioFX.habilidad(); glowJugador(ev.team, ev.cardId); }
          break;
        case 'final':
          feedLine('🏁 ' + txt + ' <b>' + ev.marcador[0] + ' - ' + ev.marcador[1] + '</b>');
          if (visual) AudioFX.silbato();
          break;
      }
    });
    if (!visual) updateHUD();
  }

  // ---------- half-time card + team talk ----------
  function filaHT(stat, a, label, b) {
    return '<div class="ht-row" data-stat="' + stat + '"><span>' + a + '</span><b>' + label + '</b><span>' + b + '</span></div>';
  }

  function pintarResumenDescanso(r) {
    document.getElementById('ht-marcador').textContent = r.marcador[0] + ' - ' + r.marcador[1];
    document.getElementById('ht-stats').innerHTML =
      '<div class="ht-row ht-head"><span>' + current.nombres[0] + '</span><span>' + current.nombres[1] + '</span></div>' +
      filaHT('posesion', r.posesion[0] + '%', 'Possession', r.posesion[1] + '%') +
      filaHT('tiros', r.tiros[0] + ' (' + r.aPuerta[0] + ')', 'Shots (on target)', r.tiros[1] + ' (' + r.aPuerta[1] + ')') +
      filaHT('xg', r.xg[0].toFixed(2), 'xG', r.xg[1].toFixed(2)) +
      filaHT('faltas', r.faltas[0], 'Fouls', r.faltas[1]);

    var m = r.mejor;
    var extra = [];
    if (m.goles) extra.push(m.goles + (m.goles > 1 ? ' goals' : ' goal'));
    if (m.asis) extra.push(m.asis + (m.asis > 1 ? ' assists' : ' assist'));
    if (!extra.length && m.paradas) extra.push(m.paradas + (m.paradas > 1 ? ' saves' : ' save'));
    document.getElementById('ht-top').innerHTML =
      '<span class="ht-top-label">⭐ Top performer</span>' +
      '<span class="ht-top-name ' + (m.team === 0 ? 'ht-mio' : 'ht-rival') + '">' + m.nombre + '</span>' +
      '<span class="ht-top-meta">' + m.pos + ' · ' + current.nombres[m.team] + (extra.length ? ' · ' + extra.join(', ') : '') + '</span>' +
      '<span class="ht-top-nota">' + m.nota.toFixed(1) + '</span>';

    document.getElementById('ht-momentos').innerHTML = r.momentos.length
      ? r.momentos.map(function (k) {
        return '<div class="ht-moment ' + (k.team === 0 ? 'ht-mio' : 'ht-rival') + '"><span class="ht-moment-min">' + k.min + "'</span> " + k.icon + ' ' + k.texto + '</div>';
      }).join('')
      : '<div class="ht-moment ht-quiet">A cagey first half: no clear-cut chances yet.</div>';
  }

  function mostrarDescanso() {
    if (!current) return;
    current.enDescanso = true;
    var e = current.engine;
    var panel = document.getElementById('ht-panel');
    pintarResumenDescanso(Commentary.resumenDescanso(e, current.momentos));

    // tactics board: change mentality and pressing at half-time
    var tac = e.teams[0].tactica;
    function pintarSeg(contId, opciones, actual, aplicar) {
      var cont = document.getElementById(contId);
      cont.innerHTML = '';
      opciones.forEach(function (o) {
        var btn = document.createElement('button');
        btn.className = 'btn btn-small seg-btn' + (o.v === actual ? ' active' : '');
        btn.textContent = o.nombre;
        btn.onclick = function () {
          AudioFX.click();
          aplicar(o.v);
          pintarSeg(contId, opciones, o.v, aplicar);
        };
        cont.appendChild(btn);
      });
    }
    pintarSeg('ht-mentalidad', Formations.MENTALIDADES, tac.mentalidad, function (v) { tac.mentalidad = v; });
    pintarSeg('ht-presion', Formations.PRESIONES, tac.presion, function (v) { tac.presion = v; });

    panel.classList.remove('hidden');
    document.getElementById('ht-continue').onclick = function () {
      AudioFX.click();
      panel.classList.add('hidden');
      if (!current) return; // the match already ended (e.g. skipped)
      current.enDescanso = false;
      current.engine.reanudar();
    };
  }

  // ---------- end / skip ----------
  function finalizar(delay) {
    if (!current || current.finalizando) return;
    current.finalizando = true;
    var resultado = current.engine.resultado();
    var fin = current.onFinish;
    setTimeout(function () {
      if (current && current.game) current.game.destroy(true);
      current = null;
      document.getElementById('ht-panel').classList.add('hidden');
      fin(resultado);
    }, delay);
  }

  function skip() {
    if (!current || current.finalizando) return;
    var e = current.engine;
    document.getElementById('ht-panel').classList.add('hidden');
    current.enDescanso = false;
    e.reanudar();
    var guard = 0;
    while (!e.terminado && guard < 4000) {
      if (e.pausado) e.reanudar();
      e.step(0.1);
      guard++;
    }
    procesarEventos(e.drenarEventos(), false);
    finalizar(400);
  }

  // ---------- API ----------
  function start(ctxJugador, ctxRival, opts, onFinish) {
    var engine = new Engine.MatchEngine(ctxJugador, ctxRival, { pausaDescanso: true });
    document.getElementById('match-feed').innerHTML = '';
    document.getElementById('sb-home').textContent = ctxJugador.nombre;
    document.getElementById('sb-away').textContent = ctxRival.nombre;
    document.getElementById('sb-home').style.color = colorTexto(opts.colores[0]);
    document.getElementById('sb-away').style.color = colorTexto(opts.colores[1]);
    document.getElementById('ms-pos-fill').style.background = colorTexto(opts.colores[0]);
    document.getElementById('phaser-container').innerHTML = '';
    document.getElementById('ht-panel').classList.add('hidden');
    feedLine('📋 ' + ctxJugador.nombre + ': ' + Formations.etiquetaTactica(ctxJugador.tactica));
    feedLine('📋 ' + ctxRival.nombre + ': ' + Formations.etiquetaTactica(ctxRival.tactica));

    current = {
      engine: engine,
      speed: 1,
      acc: 0,
      game: null,
      scene: null,
      enDescanso: false,
      finalizando: false,
      colores: opts.colores,
      nombres: [ctxJugador.nombre, ctxRival.nombre],
      comentarista: Commentary.create(),
      momentos: [],
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
    } else {
      feedLine('⚠️ Could not load Phaser. Running in text mode…');
      setTimeout(skip, 600);
    }
  }

  return { start: start };
})();
