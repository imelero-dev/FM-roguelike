/* ============================================================
   Season card + Hall of Fame tests (Node, no dependencies):
     node tests/hall.js
   The card is drawn onto a recording fake 2D context, so layout
   and content can be checked without a real canvas.
   ============================================================ */
'use strict';
var assert = require('assert');
var harness = require('./harness');

var HALL_KEY = 'relegation-run:hall';
var SAVE_KEY = 'relegation-run:save';
var passed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}

// ---------- helpers ----------
function newRun(h) {
  h.click('btn-new-run');
  if (h.byId('confirm-yes').onclick) h.click('confirm-yes');
}

function playMatch(h) {
  var S = h.ctx.State;
  if (!S.onceCompleto()) S.autoAlinear();
  if (!S.onceCompleto()) {
    var alt = h.ctx.Formations.LISTA.filter(S.puedeFormacion)[0];
    if (alt) { S.cambiarFormacion(alt); S.autoAlinear(); }
  }
  if (!S.onceCompleto()) return false; // known rare deadlock, see MEJORAS.md
  h.resetCreated();
  h.click('btn-play-match');
  if (!h.byId('btn-post-continue').onclick) {
    var skip = h.buttons('drop-skip');
    if (skip.length) { skip[0].onclick(); h.drain(); }
  }
  h.click('btn-post-continue');
  return true;
}

// plays a whole run to its end; retries on the rare squad deadlock
function finishRun(h) {
  for (var attempt = 0; attempt < 5; attempt++) {
    newRun(h);
    var guard = 0;
    while (!h.ctx.State.run.terminada && guard++ < 20 && playMatch(h)) { /* keep playing */ }
    if (h.ctx.State.run.terminada) return h.ctx.State.run;
  }
  throw new Error('could not finish a run');
}

// values built inside the game VM have their own Array prototype
function plain(x) { return JSON.parse(JSON.stringify(x)); }
function hall(storage) { return JSON.parse(storage.getItem(HALL_KEY)); }

var seq = 0;
// synthetic Hall of Fame entry
function entry(o) {
  o = o || {};
  var forma = o.forma || 'VVEDVVVEVVDVVV';
  var f = forma.split('').map(function (r, i) {
    return { res: r, gf: r === 'V' ? 2 : r === 'E' ? 1 : 0, gc: r === 'D' ? 1 : r === 'E' ? 1 : 0, jefe: i === 4 || i === 9 || i === 13, rival: 'Rival ' + i };
  });
  var pg = f.filter(function (x) { return x.res === 'V'; }).length;
  var pe = f.filter(function (x) { return x.res === 'E'; }).length;
  var e = {
    id: o.id || 'test' + (++seq),
    numero: o.numero || seq,
    fecha: o.fecha || 1700000000000 + seq * 1000,
    equipo: { nombre: o.nombre || 'Athletic Northport', color: 0x3498db },
    victoria: o.victoria !== undefined ? o.victoria : false,
    despedido: !!o.despedido,
    puesto: o.puesto || 2,
    razon: 'test',
    pg: pg, pe: pe, pp: f.length - pg - pe,
    gf: o.gf !== undefined ? o.gf : f.reduce(function (a, x) { return a + x.gf; }, 0),
    gc: o.gc !== undefined ? o.gc : f.reduce(function (a, x) { return a + x.gc; }, 0),
    pts: o.pts !== undefined ? o.pts : pg * 3 + pe,
    jornadas: 14,
    forma: f,
    formacion: '4-3-3', jefes: 2, oro: 500,
    mvp: o.mvp === null ? null : { nombre: 'Leo Marsh', id: 'c12', pos: 'MID', media: 7.84 },
    goleador: { nombre: 'Kai Rowe', id: 'c13', pos: 'FWD', goles: 11 },
    asistente: { nombre: 'Tom Hale', id: 'c14', pos: 'MID', asistencias: 1 },
    xi: o.xi === null ? undefined : { legendaria: 1, epica: 2, rara: 5, comun: 3 }
  };
  return e;
}

// recording 2D context: text is measured as 0.6 × font size per character
function fakeCanvas() {
  var calls = { text: [], images: 0 };
  var state = { font: '10px sans', textAlign: 'left' };
  var grad = { addColorStop: function () {} };
  var ctx = new Proxy(state, {
    get: function (t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return function (s) { return { width: String(s).length * parseInt(/(\d+)px/.exec(t.font)[1], 10) * 0.6 }; };
      if (k === 'fillText') return function (s, x, y) { calls.text.push({ s: String(s), x: x, y: y, align: t.textAlign, w: ctx.measureText(s).width }); };
      if (k === 'drawImage') return function () { calls.images++; };
      if (/Gradient$/.test(k)) return function () { return grad; };
      return function () {};
    },
    set: function (t, k, v) { t[k] = v; return true; }
  });
  var attrs = {};
  return {
    width: 300, height: 150, calls: calls, attrs: attrs,
    getContext: function () { return ctx; },
    setAttribute: function (k, v) { attrs[k] = v; }
  };
}

// every text call stays inside the inner frame (6px border inset 14px)
function insideFrame(cv) {
  cv.calls.text.forEach(function (c) {
    var left = c.align === 'center' ? c.x - c.w / 2 : c.align === 'right' ? c.x - c.w : c.x;
    assert.ok(left >= 28 && left + c.w <= 1172, '"' + c.s + '" overflows (' + Math.round(left) + '..' + Math.round(left + c.w) + ')');
    assert.ok(c.y > 28 && c.y < 616, '"' + c.s + '" is outside the frame vertically');
  });
}

function texts(cv) { return cv.calls.text.map(function (t) { return t.s; }); }

// ================================================================
console.log('Hall of Fame');

test('a finished run is recorded once, with the season it actually played', function () {
  var h = harness.boot();
  var run = finishRun(h);
  var data = hall(h.storage);
  assert.strictEqual(data.version, 1);
  assert.strictEqual(data.entries.length, 1);
  var e = data.entries[0];
  assert.strictEqual(e.id, run.id);
  assert.strictEqual(e.equipo.nombre, run.equipos[0].nombre);
  assert.strictEqual(e.pts, run.stats.pg * 3 + run.stats.pe);
  assert.strictEqual(e.forma.length, run.stats.pg + run.stats.pe + run.stats.pp);
  assert.strictEqual(e.puesto, h.ctx.League.puestoJugador());
  assert.strictEqual(e.numero, h.ctx.State.meta().runs);
  assert.strictEqual(e.jornadas, 14);
  // rarity breakdown of the final starting XI
  var xi = e.xi.legendaria + e.xi.epica + e.xi.rara + e.xi.comun;
  assert.ok(xi > 0 && xi <= 11, 'final XI rarities recorded');
  // the end screen reports the rank and draws (or tries to draw) the card
  assert.ok(/Ranked <b>#1<\/b> of 1/.test(h.byId('end-rank').innerHTML));

  // registering the same run again does not duplicate it
  var again = h.ctx.Hall.registrar(e);
  assert.strictEqual(hall(h.storage).entries.length, 1);
  assert.strictEqual(again.total, 1);
});

test('runs accumulate across reloads and keep their numbering', function () {
  var h1 = harness.boot();
  finishRun(h1);
  var h2 = harness.boot(h1.storage);
  finishRun(h2);
  var entries = hall(h2.storage).entries;
  assert.strictEqual(entries.length, 2);
  assert.notStrictEqual(entries[0].id, entries[1].id);
  assert.deepStrictEqual(entries.map(function (e) { return e.numero; }).sort(), [1, 2]);
});

test('ranking: titles, then position, points, goal difference, goals, earliest', function () {
  var H = harness.boot().ctx.Hall;
  var champ = entry({ victoria: true, puesto: 1, pts: 30 });
  var second = entry({ puesto: 2, pts: 35 });
  var secondFewer = entry({ puesto: 2, pts: 33 });
  var gd = entry({ puesto: 2, pts: 33, gf: 30, gc: 5 });
  var early = entry({ puesto: 5, pts: 10, gf: 10, gc: 10, fecha: 1 });
  var late = entry({ puesto: 5, pts: 10, gf: 10, gc: 10, fecha: 2 });
  var orden = H.ranking([late, secondFewer, early, second, champ, gd]);
  assert.deepStrictEqual(orden, [champ, second, gd, secondFewer, early, late]);
  assert.deepStrictEqual(H.recientes([early, champ, late]), [champ, late, early]);
  // sacked while top of the table: still behind any title, however many points
  var sackedTop = entry({ despedido: true, puesto: 1, pts: 40 });
  assert.deepStrictEqual(H.ranking([sackedTop, champ]), [champ, sackedTop]);
});

test('new records: first title, best finish, most points, most goals, win streak', function () {
  var h = harness.boot();
  var H = h.ctx.Hall;
  var first = H.registrar(entry({ puesto: 4, pts: 20, gf: 15, forma: 'VVDEDVDVEVDDVE' }));
  assert.deepStrictEqual(plain(first.records), [], 'the very first non-title run sets no records');
  var keys = function (info) { return plain(info.records.map(function (r) { return r.key; })); };

  var better = H.registrar(entry({ puesto: 2, pts: 25, gf: 14, forma: 'VVVVDEVDVEDVDV' }));
  assert.deepStrictEqual(keys(better), ['best-finish', 'most-points', 'win-streak']);

  var champ = H.registrar(entry({ victoria: true, puesto: 1, pts: 24, gf: 40, forma: 'VEVEVEVEVEVEVE' }));
  assert.deepStrictEqual(keys(champ), ['first-title', 'best-finish', 'most-goals']);

  var champ2 = H.registrar(entry({ victoria: true, puesto: 1, pts: 24, gf: 40, forma: 'VEVEVEVEVEVEVE' }));
  assert.deepStrictEqual(keys(champ2), [], 'equalling a record is not a new record');
  assert.strictEqual(champ2.rank, 2, 'ties rank behind whoever got there first');
});

test('evaluating a season never writes to the Hall of Fame', function () {
  var h = harness.boot();
  var info = h.ctx.Hall.evaluar(entry({ victoria: true, puesto: 1 }));
  assert.strictEqual(info.rank, 1);
  assert.strictEqual(h.storage.getItem(HALL_KEY), null);
});

test('the Hall of Fame is capped and trims from the bottom, never the newest run', function () {
  var h = harness.boot();
  var H = h.ctx.Hall;
  var list = [];
  for (var i = 0; i < H.MAX_ENTRIES; i++) list.push(entry({ puesto: 3, pts: 20 + (i % 10) }));
  h.storage.setItem(HALL_KEY, JSON.stringify({ version: 1, entries: list }));
  var champ = entry({ victoria: true, puesto: 1 });
  H.registrar(champ);
  assert.strictEqual(H.leer().length, H.MAX_ENTRIES);
  var worst = entry({ puesto: 8, pts: 0, gf: 0, gc: 30 });
  var info = H.registrar(worst);
  var ids = H.leer().map(function (e) { return e.id; });
  assert.strictEqual(ids.length, H.MAX_ENTRIES);
  assert.ok(ids.indexOf(champ.id) >= 0, 'the title survives trimming');
  assert.ok(ids.indexOf(worst.id) >= 0, 'the run just played is always kept');
  assert.strictEqual(info.rank, H.MAX_ENTRIES + 1, 'rank reflects where it landed before trimming');
});

test('corrupted, outdated or malformed Hall of Fame data is ignored safely', function () {
  var storage = harness.memoryStorage();
  storage.setItem(HALL_KEY, '{oops');
  var h = harness.boot(storage);
  assert.deepStrictEqual(plain(h.ctx.Hall.leer()), []);
  storage.setItem(HALL_KEY, JSON.stringify({ version: 99, entries: [entry()] }));
  assert.deepStrictEqual(plain(h.ctx.Hall.leer()), []);
  storage.setItem(HALL_KEY, JSON.stringify({ version: 1, entries: [entry(), { id: 5 }, null] }));
  assert.strictEqual(h.ctx.Hall.leer().length, 1);
  h.ctx.UI.renderHall();
  assert.ok(h.hidden('hall-empty'));
});

test('saves from before the Hall of Fame get a run id on resume', function () {
  var h1 = harness.boot();
  newRun(h1);
  var save = JSON.parse(h1.storage.getItem(SAVE_KEY));
  delete save.run.id;
  h1.storage.setItem(SAVE_KEY, JSON.stringify(save));
  var h2 = harness.boot(h1.storage);
  h2.click('btn-continue');
  assert.ok(/^r[a-z0-9]+$/.test(h2.ctx.State.run.id));
});

console.log('Hall of Fame screen');

test('menu → Hall of Fame shows the empty state, then ranked rows after a run', function () {
  var h = harness.boot();
  h.click('btn-hall');
  assert.ok(h.byId('screen-hall').classList.contains('active'));
  assert.ok(!h.hidden('hall-empty'), 'empty state expected');
  assert.ok(/<b>0<\/b><span>Runs/.test(h.byId('hall-summary').innerHTML));

  finishRun(h);
  h.storage.setItem(HALL_KEY, JSON.stringify({ version: 1, entries: hall(h.storage).entries.concat([entry({ victoria: true, puesto: 1, nombre: 'Real <Harbour>' })]) }));
  h.click('btn-end-hall');
  assert.ok(h.hidden('hall-empty'));
  var rows = h.byId('hall-list').children.map(function (li) { return li.children[0]; });
  assert.strictEqual(rows.length, 2);
  assert.ok(/🥇/.test(rows[0].innerHTML) && /CHAMPIONS/.test(rows[0].innerHTML), 'title run ranked first');
  assert.ok(/Real &lt;Harbour&gt;/.test(rows[0].innerHTML), 'names are HTML-escaped');
  assert.ok(/<b>2<\/b><span>Runs/.test(h.byId('hall-summary').innerHTML));

  // Recent: newest first, ranks still from the Best order
  h.click('hall-sort-recent');
  assert.ok(h.byId('hall-sort-recent').classList.contains('active'));
  var recent = h.byId('hall-list').children.map(function (li) { return li.children[0]; });
  assert.strictEqual(recent.length, 2);

  // a row opens its season card; Close hides it; Back returns to the menu
  rows = h.byId('hall-list').children.map(function (li) { return li.children[0]; });
  rows[0].onclick();
  assert.ok(!h.hidden('card-modal'));
  assert.ok(h.byId('btn-card-copy').onclick && h.byId('btn-card-share').onclick && h.byId('btn-card-download').onclick);
  h.click('card-close');
  assert.ok(h.hidden('card-modal'));
  h.click('btn-hall-back');
  assert.ok(h.byId('screen-menu').classList.contains('active'));
});

console.log('Season card');

test('the share text is a compact, Wordle-style summary', function () {
  var C = harness.boot().ctx.SeasonCard;
  var e = entry({ victoria: true, puesto: 1, numero: 7, forma: 'VVEDVVVEVVDVVV' });
  var t = C.texto(e, { records: [{ key: 'most-points', label: 'Most points' }] });
  var lines = t.split('\n');
  assert.strictEqual(lines[0], 'Relegation Run #7 · 👑 Champions');
  assert.strictEqual(lines[1], 'Athletic Northport · 1st · ' + e.pts + ' pts');
  assert.strictEqual(lines[2], '🟩🟩🟨🟥🟩🟩🟩🟨🟩🟩🟥🟩🟩🟩');
  assert.ok(/^\d+W \d+D \d+L · \d+-\d+$/.test(lines[3]));
  assert.strictEqual(lines[4], '🏅 Leo Marsh (7.84)');
  assert.strictEqual(lines[5], '⭐ Most points');
  assert.ok(!/[<>]/.test(t));

  var sacked = C.texto(entry({ despedido: true, puesto: 6, forma: 'VDDD', mvp: null }));
  assert.ok(/💀 Sacked/.test(sacked));
  assert.ok(/🟩🟥🟥🟥⬛{10}/.test(sacked), 'unplayed matchdays are shown as empty squares');
  assert.ok(!/🏅/.test(sacked));
  assert.ok(/Finished 3rd/.test(C.texto(entry({ puesto: 3 }))));
});

test('the card draws every element inside the 1200×630 frame', function () {
  var C = harness.boot().ctx.SeasonCard;
  var e = entry({ victoria: true, puesto: 1, numero: 12 });
  var cv = fakeCanvas();
  assert.strictEqual(C.dibujar(cv, e, { rank: 1, total: 4, records: [{ key: 'first-title', label: 'First title' }] }), true);
  assert.strictEqual(cv.width, 1200);
  assert.strictEqual(cv.height, 630);
  var t = texts(cv);
  ['RELEGATION', 'RUN', 'A FOOTBALL ROGUELIKE', 'RUN #12', 'ATHLETIC NORTHPORT', 'CHAMPIONS',
   '1st', String(e.pts), 'Leo Marsh', 'Kai Rowe', '11 goals', 'Tom Hale', '1 assist',
   '★ FIRST TITLE', 'FINAL XI', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'outlined = boss match', 'Hall of Fame #1 of 4', 'ONE SEASON. ONE SHOT.'].forEach(function (s) {
    assert.ok(t.indexOf(s) >= 0, 'missing on card: ' + s);
  });
  e.forma.forEach(function (f) { assert.ok(t.indexOf(f.gf + '-' + f.gc) >= 0); });
  assert.strictEqual(t.filter(function (s) { return /^\d+-\d+$/.test(s); }).length, 14 + 0, 'one score per matchday');
  insideFrame(cv);
  // Relegation Run branding only
  t.forEach(function (s) { assert.ok(!/football manager|pichichi/i.test(s), 'off-brand wording: ' + s); });
  assert.ok(/Season card: Athletic Northport, champions\. 1st place/.test(cv.attrs['aria-label']));
  assert.strictEqual(cv.attrs.role, 'img');
});

test('long names shrink or get an ellipsis instead of overflowing', function () {
  var C = harness.boot().ctx.SeasonCard;
  var e = entry({ nombre: 'Sporting Club Extraordinarily Long Name Of Northporthampton-upon-Sea' });
  e.mvp.nombre = 'Maximilian-Alexander Wolfeschlegelsteinhausen';
  var cv = fakeCanvas();
  e.goleador.nombre = 'Bartholomew Featherstonehaugh-Cholmondeley';
  C.dibujar(cv, e, { rank: 3, total: 20, records: [{ label: 'Best finish' }, { label: 'Most points' }, { label: 'Longest win streak (9)' }] });
  insideFrame(cv);
  assert.ok(texts(cv).some(function (s) { return /…$/.test(s); }), 'long team name truncated');
  assert.ok(texts(cv).indexOf('FINISHED 2ND') >= 0);
});

test('a sacked run shows empty slots for the matchdays it never reached', function () {
  var C = harness.boot().ctx.SeasonCard;
  var cv = fakeCanvas();
  C.dibujar(cv, entry({ despedido: true, puesto: 7, forma: 'DDD', mvp: null }), null);
  var t = texts(cv);
  assert.ok(t.indexOf('SACKED') >= 0);
  assert.strictEqual(t.filter(function (s) { return /^\d+-\d+$/.test(s); }).length, 3);
  assert.strictEqual(cv.calls.images, 0, 'no portrait without a player of the season');
  assert.ok(t.indexOf('outlined = boss match') < 0, 'no boss legend without a boss match');
});

test('cards stored before the final XI was recorded still draw', function () {
  var C = harness.boot().ctx.SeasonCard;
  var cv = fakeCanvas();
  assert.strictEqual(C.dibujar(cv, entry({ xi: null }), null), true);
  var t = texts(cv);
  assert.ok(t.indexOf('FINAL XI') >= 0 && t.indexOf('LEGENDARY') < 0);
  insideFrame(cv);
});

test('the card is a no-op without a 2D canvas, and files get a clean name', function () {
  var C = harness.boot().ctx.SeasonCard;
  assert.strictEqual(C.dibujar({}, entry(), null), false);
  var e = entry({ nombre: 'Real Ñorth Port!!', fecha: new Date(2026, 9, 17).getTime() });
  assert.strictEqual(C.nombreArchivo(e), 'relegation-run-real-orth-port-2026-10-17.png');
});

console.log(process.exitCode ? '\nFAILED' : '\nOK ' + passed + ' tests passed');
