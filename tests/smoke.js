/* ============================================================
   Headless SMOKE TEST (Node, no dependencies):
     node tests/smoke.js [nRuns]
   Loads the real game modules with a minimal fake DOM
   (no Phaser → the match takes the "text mode"/skip path),
   plays full seasons pressing random buttons (sign, sell,
   formation, tactics, drops) and checks invariants.
   ============================================================ */
'use strict';
var harness = require('./harness');

var N_RUNS = parseInt(process.argv[2], 10) || 20;

var h = harness.boot();
var ctx = h.ctx;
var byId = h.byId;
var click = h.click;
var drenar = h.drain;
var botones = h.buttons;
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function assert(cond, msg) { if (!cond) throw new Error('Invariant: ' + msg); }

// ---------- runs ----------
var resumen = { runs: 0, titles: 0, matchdays: 0, goals: 0, suspensions: 0, injuries: 0, deadlocks: 0 };

for (var r = 0; r < N_RUNS; r++) {
  click('btn-new-run');
  // a run that ended in a deadlock leaves a save behind: confirm the overwrite
  if (byId('confirm-yes').onclick) click('confirm-yes');
  var S = ctx.State;
  var jornadasRun = 0;
  while (!S.run.terminada && jornadasRun < 20) {
    h.resetCreated();
    // re-render to get fresh buttons
    ctx.UI.renderManage();

    // random management actions
    if (Math.random() < 0.3) { var fc = botones('formation-card'); if (fc.length) { pick(fc).onclick(); drenar(); } }
    if (Math.random() < 0.3) { var sg = botones('seg-btn'); if (sg.length) { pick(sg).onclick(); drenar(); } }
    if (Math.random() < 0.4) {
      var buy = botones('btn-buy');
      if (buy.length) {
        pick(buy).onclick(); drenar();
        var sl = byId('nego-slider'); sl.value = sl.max;
        if (byId('nego-btn-offer').onclick) { byId('nego-btn-offer').onclick(); drenar(); }
        if (byId('nego-btn-accept').onclick) { byId('nego-btn-accept').onclick(); drenar(); }
        click('nego-btn-walk');
      }
    }
    if (Math.random() < 0.2) {
      var sell = botones('btn-sell');
      if (sell.length) {
        pick(sell).onclick({ stopPropagation: function () {} }); drenar();
        var sl2 = byId('nego-slider'); sl2.value = sl2.min;
        if (byId('nego-btn-offer').onclick) { byId('nego-btn-offer').onclick(); drenar(); }
        click('nego-btn-walk');
        if (byId('confirm-yes').onclick) { byId('confirm-yes').onclick(); drenar(); }
      }
    }
    if (Math.random() < 0.3) click('btn-reroll');

    if (!S.onceCompleto()) click('btn-auto-lineup');
    if (!S.onceCompleto()) {
      // is any formation playable? the player could switch to it
      var alt = ctx.Formations.LISTA.filter(S.puedeFormacion)[0];
      if (alt) { S.cambiarFormacion(alt); S.autoAlinear(); }
    }
    if (!S.onceCompleto()) {
      resumen.deadlocks++;
      var disp = {};
      S.run.plantilla.forEach(function (c) { if (S.disponible(c)) disp[c.pos] = (disp[c.pos] || 0) + 1; });
      console.log('DEADLOCK md' + S.run.jornada, S.run.tactica.formacion, JSON.stringify(disp), 'gold', S.run.oro);
      break;
    }

    // no unavailable player in the XI
    S.onceActual().forEach(function (c) {
      assert(c && S.disponible(c), 'unavailable player in the XI: ' + (c && c.nombre));
    });

    var jornadaAntes = S.run.jornada;
    h.resetCreated();
    click('btn-play-match'); // Match without Phaser → skip → renderPost

    var bajas = [];
    S.run.plantilla.forEach(function (c) {
      if (c.sancion > 0) { resumen.suspensions++; bajas.push(c.id); }
      if (c.lesion > 0) { resumen.injuries++; bajas.push(c.id); }
    });

    // drop: pick a card, quick-sell or skip
    var opciones = botones('btn-tiny').concat(botones('drop-skip'));
    if (opciones.length) { pick(opciones).onclick(); drenar(); }
    if (!byId('btn-post-continue').onclick) { var skipB = botones('drop-skip'); if (skipB.length) { skipB[0].onclick(); drenar(); } }
    click('btn-post-continue');

    assert(S.run.terminada || S.run.jornada === jornadaAntes + 1, 'matchday did not advance');
    // a fresh absence (red card or injury) must miss at least the next match
    bajas.forEach(function (id) {
      var c = S.cartaPorId(id);
      assert(!c || S.run.terminada || !S.disponible(c), 'absent player available next matchday: ' + (c && c.nombre));
    });
    assert(S.run.oro >= 0, 'negative gold');
    assert(S.run.plantilla.length <= S.MAX_PLANTILLA, 'squad exceeds the maximum');
    jornadasRun++;
  }
  resumen.runs++;
  resumen.matchdays += jornadasRun;
  var tabla = ctx.League.clasificacion();
  var pj = tabla.map(function (e) { return e.pj; });
  assert(pj.every(function (x) { return x === pj[0]; }), 'teams with different games played: ' + pj);
  if (S.run.stats && ctx.League.puestoJugador() === 1 && S.run.jornada >= 14) resumen.titles++;
  resumen.goals += S.run.stats.gf;
}

console.log('OK', JSON.stringify(resumen));
