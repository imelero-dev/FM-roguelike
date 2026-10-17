/* ============================================================
   Match presentation tests (Node, no dependencies):
     node tests/presentation.js
   Commentary variety (no phrasing repeated by two consecutive
   events of one kind), big-chance calls and the half-time card.
   The last test drives the real visual match path with a fake
   Phaser, so the card is built exactly as in the browser.
   ============================================================ */
'use strict';
var assert = require('assert');
var harness = require('./harness');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}

var h = harness.boot();
var ctx = h.ctx;
var C = ctx.Commentary;
h.click('btn-new-run');
var EQUIPOS = ctx.State.run.equipos;

function nuevoMotor(k, opts) {
  var a = EQUIPOS[1 + k % (EQUIPOS.length - 1)], b = EQUIPOS[1 + (k + 3) % (EQUIPOS.length - 1)];
  return new ctx.Engine.MatchEngine(ctx.Engine.contextoIA(a, false), ctx.Engine.contextoIA(b, false), opts || {});
}

// every event of N full AI matches, in order, one array per match
var PARTIDOS = [];
for (var k = 0; k < 40; k++) {
  var m = nuevoMotor(k);
  m.runAll();
  PARTIDOS.push(m.drenarEventos());
}

test('every event kind has at least 3 phrasings', function () {
  Object.keys(C.LINES).forEach(function (key) {
    assert.ok(C.LINES[key].length >= 3, key + ' has ' + C.LINES[key].length);
  });
});

test('no repeated phrasing in two consecutive same-type events (real matches)', function () {
  var lineas = 0;
  PARTIDOS.forEach(function (eventos) {
    var c = C.create();
    var previa = {};
    eventos.forEach(function (ev) {
      var key = C.keyFor(ev);
      if (!key) return;
      // same names for every line so only the phrasing can differ
      var txt = c.line(key, { p: 'P', k: 'K', v: 'V', team: 'T' });
      assert.ok(txt && txt.indexOf('{') < 0, key + ' left a placeholder: ' + txt);
      assert.notStrictEqual(txt, previa[key], key + ' repeated "' + txt + '"');
      previa[key] = txt;
      lineas++;
    });
  });
  assert.ok(lineas > 40 * 20, 'too few commented events: ' + lineas);
});

test('no repeats even with a worst-case random source', function () {
  [function () { return 0; }, function () { return 0.999999; }].forEach(function (rng) {
    var c = C.create(rng);
    Object.keys(C.LINES).forEach(function (key) {
      var prev = null;
      for (var i = 0; i < 30; i++) {
        var t = c.line(key, { p: 'P', k: 'K', v: 'V', team: 'T' });
        assert.notStrictEqual(t, prev, key);
        prev = t;
      }
    });
  });
});

test('big-chance call fires on high-xG open-play shots only', function () {
  assert.strictEqual(C.keyFor({ t: 'tiro_va', xg: 0.55 }), 'chance');
  assert.strictEqual(C.keyFor({ t: 'tiro_va', xg: 0.55, cabeza: true }), 'chance_cabeza');
  assert.strictEqual(C.keyFor({ t: 'tiro_va', xg: 0.1 }), null);
  assert.strictEqual(C.keyFor({ t: 'tiro_va', xg: 0.78, penalti: true }), null);
  var calls = 0;
  PARTIDOS.forEach(function (evs) { evs.forEach(function (ev) { if (ev.t === 'tiro_va' && C.keyFor(ev)) calls++; }); });
  var porPartido = calls / PARTIDOS.length;
  assert.ok(porPartido > 0.3 && porPartido < 4, 'big chances per match: ' + porPartido);
});

test('penalty outcomes use the penalty phrasing', function () {
  assert.strictEqual(C.keyFor({ t: 'gol', penalti: true }), 'gol_pen');
  assert.strictEqual(C.keyFor({ t: 'tiro', resultado: 'parada', penalti: true }), 'parada_pen');
  assert.strictEqual(C.keyFor({ t: 'tiro', resultado: 'fuera', penalti: true }), 'fuera_pen');
});

test('half-time summary: score, possession, shots, xG, top performer, 2 key moments', function () {
  for (var k = 0; k < 15; k++) {
    var e = nuevoMotor(k, { pausaDescanso: true });
    var momentos = [];
    var guard = 0;
    while (!e.pausado && guard++ < 4000) {
      e.step(0.05);
      e.drenarEventos().forEach(function (ev) { var m = C.momento(ev); if (m) momentos.push(m); });
    }
    assert.ok(e.pausado && e.half === 2, 'did not reach half-time');
    var r = C.resumenDescanso(e, momentos);
    // arrays come from the VM realm: compare by value
    assert.strictEqual(JSON.stringify(r.marcador), JSON.stringify(e.marcador));
    assert.strictEqual(r.posesion[0] + r.posesion[1], 100);
    assert.strictEqual(JSON.stringify(r.tiros), JSON.stringify([e.stats[0].tiros, e.stats[1].tiros]));
    assert.ok(r.aPuerta[0] <= r.tiros[0] && r.aPuerta[1] <= r.tiros[1]);
    assert.ok(r.xg.every(function (x) { return typeof x === 'number' && x >= 0; }));
    // top performer is the highest-rated player on the pitch
    var maxNota = Math.max.apply(null, e.players[0].concat(e.players[1]).map(function (p) { return p.nota; }));
    assert.ok(r.mejor.nombre && Math.abs(r.mejor.nota - Math.min(10, maxNota)) < 0.051, 'top performer ' + JSON.stringify(r.mejor));
    // up to 2 moments, in match order; goals always make it when there are 2 or fewer
    assert.ok(r.momentos.length <= 2);
    if (r.momentos.length === 2) assert.ok(r.momentos[0].min <= r.momentos[1].min);
    var goles = e.marcador[0] + e.marcador[1];
    if (goles > 0 && goles <= 2) {
      assert.strictEqual(r.momentos.filter(function (m) { return m.icon === '⚽'; }).length, goles);
    }
  }
});

test('visual match: half-time card is rendered, then the match finishes', function () {
  var hv = harness.boot();
  var escena = null;
  // fake Phaser: keep the scene config; any drawing call is a no-op
  var nada = new Proxy(function () {}, {
    get: function (t, key) { return key === Symbol.toPrimitive ? function () { return 0; } : nada; },
    set: function () { return true; },
    apply: function () { return nada; }
  });
  hv.ctx.Phaser = { AUTO: 0, Game: function (cfg) { escena = cfg.scene; this.destroy = function () {}; } };
  hv.click('btn-new-run');
  var S = hv.ctx.State;
  if (!S.onceCompleto()) S.autoAlinear();
  hv.click('btn-play-match');
  assert.ok(escena, 'Phaser game not created');
  var s = { sprites: [[], []], trail: [], trailHist: [], ring: nada, ball: nada, ballShadow: nada, trailTimer: 0 };
  for (var i = 0; i < 11; i++) { s.sprites[0].push({ c: nada, num: nada }); s.sprites[1].push({ c: nada, num: nada }); }

  var guard = 0;
  while (hv.hidden('ht-panel') && guard++ < 5000) escena.update.call(s, 0, 100);
  assert.ok(!hv.hidden('ht-panel'), 'half-time card never shown');
  assert.ok(/^\d+ - \d+$/.test(hv.byId('ht-marcador').textContent));
  var stats = hv.byId('ht-stats').innerHTML;
  ['posesion', 'tiros', 'xg'].forEach(function (k) { assert.ok(stats.indexOf('data-stat="' + k + '"') >= 0, k + ' row missing'); });
  assert.ok(/ht-top-name[^>]*>[^<]+</.test(hv.byId('ht-top').innerHTML), 'top performer missing');
  assert.ok(/ht-top-nota">\d+\.\d</.test(hv.byId('ht-top').innerHTML), 'top performer rating missing');
  assert.ok(/class="ht-moment/.test(hv.byId('ht-momentos').innerHTML), 'key moments missing');

  hv.click('ht-continue');
  assert.ok(hv.hidden('ht-panel'));
  guard = 0;
  while (!hv.byId('screen-post').classList.contains('active') && guard++ < 5000) {
    escena.update.call(s, 0, 100);
    hv.drain();
  }
  assert.ok(hv.byId('screen-post').classList.contains('active'), 'post-match screen not reached');
});

console.log(process.exitCode ? '\nFAILED' : '\nOK ' + passed + ' tests passed');
