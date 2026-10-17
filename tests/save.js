/* ============================================================
   Save / resume and season-review tests (Node, no dependencies):
     node tests/save.js
   Each "reload" boots a fresh copy of the game that shares the
   previous localStorage, exactly like refreshing the page.
   ============================================================ */
'use strict';
var assert = require('assert');
var harness = require('./harness');

var SAVE_KEY = 'relegation-run:save';
var passed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}

function readSave(storage) { return JSON.parse(storage.getItem(SAVE_KEY)); }
function snapshot(run) { return JSON.parse(JSON.stringify(run)); }

// pick a valid XI and play the current matchday, stopping on the post-match screen
function playMatch(h) {
  var S = h.ctx.State;
  if (!S.onceCompleto()) S.autoAlinear();
  if (!S.onceCompleto()) {
    var alt = h.ctx.Formations.LISTA.filter(S.puedeFormacion)[0];
    S.cambiarFormacion(alt); S.autoAlinear();
  }
  h.resetCreated();
  h.click('btn-play-match');
}

function continueAfterMatch(h) {
  if (!h.byId('btn-post-continue').onclick) {
    var skip = h.buttons('drop-skip');
    if (skip.length) { skip[0].onclick(); h.drain(); }
  }
  h.click('btn-post-continue');
}

function newRun(h) {
  h.click('btn-new-run');
  if (h.byId('confirm-yes').onclick) h.click('confirm-yes');
}

console.log('Save / resume');

test('a fresh install shows no Continue button', function () {
  var h = harness.boot();
  assert.strictEqual(h.ctx.State.resumenPartida(), null);
  assert.ok(h.hidden('btn-continue'));
  assert.deepStrictEqual(h.storage.keys().filter(function (k) { return k === SAVE_KEY; }), []);
});

test('starting a run autosaves an exact copy of the run', function () {
  var h = harness.boot();
  newRun(h);
  var save = readSave(h.storage);
  assert.strictEqual(save.version, 1);
  assert.strictEqual(save.phase, 'manage');
  assert.deepStrictEqual(save.run, snapshot(h.ctx.State.run));
  assert.ok(save.idSeq > 1);
});

test('reloading between matches restores the identical run', function () {
  var h1 = harness.boot();
  newRun(h1);
  playMatch(h1); continueAfterMatch(h1);
  var before = snapshot(h1.ctx.State.run);

  var h2 = harness.boot(h1.storage);
  h2.ctx.UI.renderMenu();
  assert.ok(!h2.hidden('btn-continue'), 'Continue should be visible');
  assert.ok(/Matchday 2\/14/.test(h2.byId('continue-info').textContent));
  h2.click('btn-continue');
  assert.deepStrictEqual(snapshot(h2.ctx.State.run), before);
  assert.strictEqual(h2.ctx.State.run.jornada, 2);
});

test('reloading on the post-match screen keeps the result and does not replay the match', function () {
  var h1 = harness.boot();
  newRun(h1);
  playMatch(h1);
  var S1 = h1.ctx.State;
  var save = readSave(h1.storage);
  assert.strictEqual(save.phase, 'post');
  assert.strictEqual(save.run.jornada, 1);
  var gf = S1.run.stats.gf, played = S1.run.stats.pg + S1.run.stats.pe + S1.run.stats.pp;
  assert.strictEqual(played, 1);

  var h2 = harness.boot(h1.storage);
  h2.click('btn-continue');
  var r = h2.ctx.State.run;
  assert.strictEqual(r.jornada, 2, 'resume should move on to matchday 2');
  assert.strictEqual(r.stats.gf, gf);
  assert.strictEqual(r.stats.pg + r.stats.pe + r.stats.pp, 1, 'the match must not be counted twice');
  h2.ctx.League.clasificacion().forEach(function (e) { assert.strictEqual(e.pj, 1); });
  assert.strictEqual(readSave(h2.storage).phase, 'manage');
});

test('resumed runs never reuse card ids', function () {
  var h1 = harness.boot();
  newRun(h1);
  var saved = h1.storage.getItem(SAVE_KEY);
  var savedSeq = JSON.parse(saved).idSeq;
  var used = {};
  (saved.match(/"id":"[a-z]+\d+"/g) || []).forEach(function (m) { used[m.slice(6, -1)] = 1; });

  var h2 = harness.boot(h1.storage);
  h2.click('btn-continue');
  assert.ok(h2.ctx.Gen.getIdSeq() >= savedSeq, 'id counter restored');
  // generate past the saved counter so every id the old run could hold is covered
  var target = savedSeq + 5;
  for (var i = 0; i < target; i++) {
    var fresh = h2.ctx.Gen.cartaJugador('MID', 'comun');
    assert.ok(!used[fresh.id], 'new card id ' + fresh.id + ' collides with the saved run');
  }
});

test('a corrupted or outdated save is ignored safely', function () {
  var storage = harness.memoryStorage();
  storage.setItem(SAVE_KEY, '{not json');
  var h = harness.boot(storage);
  assert.strictEqual(h.ctx.State.resumenPartida(), null);
  assert.ok(h.hidden('btn-continue'));

  var h1 = harness.boot();
  newRun(h1);
  var save = readSave(h1.storage);
  save.version = 999;
  storage.setItem(SAVE_KEY, JSON.stringify(save));
  assert.strictEqual(harness.boot(storage).ctx.State.resumenPartida(), null);
});

test('New Run asks before overwriting a saved run', function () {
  var h1 = harness.boot();
  newRun(h1);
  var team = h1.ctx.State.run.equipos[0].nombre;
  var h2 = harness.boot(h1.storage);
  h2.click('btn-new-run');
  assert.ok(!h2.hidden('confirm-modal'), 'confirmation expected');
  h2.click('confirm-no');
  assert.strictEqual(h2.ctx.State.resumenPartida().equipo, team, 'declining keeps the save');
  h2.click('btn-new-run');
  h2.click('confirm-yes');
  assert.strictEqual(readSave(h2.storage).run.jornada, 1);
});

console.log('Season review');

test('finishing a run clears the save and fills the season review', function () {
  var h = harness.boot();
  newRun(h);
  var S = h.ctx.State;
  var guard = 0;
  while (!S.run.terminada && guard++ < 20) { playMatch(h); continueAfterMatch(h); }
  assert.ok(S.run.terminada);
  assert.strictEqual(h.storage.getItem(SAVE_KEY), null, 'save must be deleted at the end of a run');

  var review = h.ctx.League.resumenTemporada();
  var played = S.run.stats.pg + S.run.stats.pe + S.run.stats.pp;
  assert.strictEqual(review.forma.length, played);
  assert.strictEqual(review.forma.filter(function (f) { return f.res === 'V'; }).length, S.run.stats.pg);
  assert.strictEqual(review.forma.reduce(function (a, f) { return a + f.gf; }, 0), S.run.stats.gf);
  assert.strictEqual(review.plantilla.length, S.run.plantilla.length);
  if (review.mejor) assert.ok(review.mejor.media > 0 && review.mejor.pj >= 1);

  assert.ok(/class="res res-/.test(h.byId('end-form').innerHTML), 'results strip rendered');
  assert.ok(/Player of the season/.test(h.byId('end-awards').innerHTML), 'awards rendered');
  assert.ok(/<th>Apps<\/th>/.test(h.byId('end-squad').innerHTML), 'squad table rendered');
  assert.ok(/fila-jugador/.test(h.byId('end-table').innerHTML), 'final table rendered');
});

test('legacy meta records are migrated to the new key', function () {
  var storage = harness.memoryStorage();
  storage.setItem('rm_meta', JSON.stringify({ runs: 4, victorias: 1, mejorPuesto: 2, mejorRacha: 7 }));
  var h = harness.boot(storage);
  assert.strictEqual(h.ctx.State.meta().runs, 4);
  assert.ok(storage.getItem('relegation-run:meta'));
});

console.log(process.exitCode ? '\nFAILED' : '\nOK ' + passed + ' tests passed');
