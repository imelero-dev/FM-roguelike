/* ============================================================
   SMOKE TEST headless (Node, sin dependencias):
     node tests/smoke.js [nRuns]
   Carga los módulos reales del juego con un DOM mínimo simulado
   (sin Phaser → el partido va por el camino "modo texto"/skip),
   juega temporadas completas pulsando botones al azar (fichar,
   vender, formación, táctica, drops) y comprueba invariantes.
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var N_RUNS = parseInt(process.argv[2], 10) || 20;

// ---------- DOM mínimo ----------
var creados = [];
function Elem(tag, id) {
  this.tagName = (tag || 'div').toUpperCase();
  this.id = id || '';
  this.className = '';
  this.innerHTML = '';
  this.textContent = '';
  this.style = {};
  this.dataset = {};
  this.children = [];
  this.value = '50'; this.min = '0'; this.max = '100';
  this.disabled = false;
  this.onclick = null;
  var self = this;
  this.classList = {
    _s: {},
    add: function () { for (var i = 0; i < arguments.length; i++) this._s[arguments[i]] = 1; },
    remove: function (c) { delete this._s[c]; },
    toggle: function (c, f) { if (f === undefined) f = !this._s[c]; if (f) this._s[c] = 1; else delete this._s[c]; },
    contains: function (c) { return !!this._s[c] || (' ' + self.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  };
  creados.push(this);
}
Elem.prototype.appendChild = function (c) { this.children.push(c); c.parent = this; return c; };
Elem.prototype.insertBefore = function (c) { this.children.unshift(c); return c; };
Elem.prototype.removeChild = function (c) { this.children = this.children.filter(function (x) { return x !== c; }); };
Elem.prototype.remove = function () {};
Elem.prototype.querySelector = function () { return new Elem('button'); };
Elem.prototype.querySelectorAll = function () { return []; };
Elem.prototype.addEventListener = function () {};
Elem.prototype.click = function () {};
Elem.prototype.dispatchEvent = function () {};
Object.defineProperty(Elem.prototype, 'firstChild', { get: function () { return this.children[0]; } });
Object.defineProperty(Elem.prototype, 'lastChild', { get: function () { return this.children[this.children.length - 1]; } });

var porId = {};
function byId(id) { return porId[id] || (porId[id] = new Elem('div', id)); }

var domReady = [];
var document = {
  getElementById: byId,
  querySelector: function (sel) { return sel.charAt(0) === '#' ? byId(sel.slice(1)) : new Elem('div'); },
  querySelectorAll: function () { return []; },
  createElement: function (t) { return new Elem(t); },
  addEventListener: function (ev, fn) { if (ev === 'DOMContentLoaded') domReady.push(fn); },
  documentElement: new Elem('html')
};

// temporizadores deterministas: cola que se drena a mano
var timers = [];
function setTimeoutFake(fn) { timers.push(fn); return timers.length; }
function drenar() {
  var guard = 0;
  while (timers.length && guard++ < 10000) timers.shift()();
}

var consola = { errores: [] };
var ctx = {
  console: console,
  Math: Math, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
  parseInt: parseInt, isNaN: isNaN,
  document: document,
  window: {},
  navigator: { userAgent: 'node', maxTouchPoints: 0 },
  location: { search: '' },
  localStorage: (function () {
    var s = {};
    return { getItem: function (k) { return k in s ? s[k] : null; }, setItem: function (k, v) { s[k] = String(v); } };
  })(),
  setTimeout: setTimeoutFake,
  clearTimeout: function () {},
  setInterval: function () { return 0; },
  clearInterval: function () {},
  requestAnimationFrame: function () {},
  scrollTo: function () {},
  Event: function () {},
  // stubs de módulos con canvas/WebAudio
  Sprite: { avatar: function () { return 'data:'; }, img: function () { return new Elem('img'); } },
  AudioFX: new Proxy({}, { get: function (t, k) { return k === 'toggleMute' ? function () { return true; } : function () {}; } })
};
ctx.window = ctx;
vm.createContext(ctx);

['attrs', 'formations', 'gen', 'synergy', 'engine', 'state', 'league', 'economy', 'nego', 'ui', 'mobile', 'match', 'main']
  .forEach(function (f) {
    var file = path.join(ROOT, 'js', f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  });
domReady.forEach(function (fn) { fn(); });

function click(id) { var e = byId(id); if (!e.onclick) throw new Error('#' + id + ' sin onclick'); e.onclick({ stopPropagation: function () {} }); drenar(); }
function botones(clase) {
  return creados.filter(function (e) { return (' ' + e.className + ' ').indexOf(' ' + clase + ' ') >= 0 && e.onclick; });
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function assert(cond, msg) { if (!cond) throw new Error('Invariante: ' + msg); }

// ---------- partidas ----------
var resumen = { runs: 0, titulos: 0, jornadas: 0, goles: 0, sanciones: 0, lesiones: 0, bloqueos: 0 };

for (var r = 0; r < N_RUNS; r++) {
  click('btn-new-run');
  var S = ctx.State;
  var jornadasRun = 0;
  while (!S.run.terminada && jornadasRun < 20) {
    creados = [];
    // re-render para tener botones frescos
    ctx.UI.renderManage();

    // acciones aleatorias de gestión
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
      // ¿hay alguna formación jugable? el jugador podría cambiar a ella
      var alt = ctx.Formations.LISTA.filter(S.puedeFormacion)[0];
      if (alt) { S.cambiarFormacion(alt); S.autoAlinear(); }
    }
    if (!S.onceCompleto()) {
      resumen.bloqueos++;
      var disp = {};
      S.run.plantilla.forEach(function (c) { if (S.disponible(c)) disp[c.pos] = (disp[c.pos] || 0) + 1; });
      console.log('BLOQUEO j' + S.run.jornada, S.run.tactica.formacion, JSON.stringify(disp), 'oro', S.run.oro);
      break;
    }

    // nadie no disponible en el once
    S.onceActual().forEach(function (c) {
      assert(c && S.disponible(c), 'jugador no disponible alineado: ' + (c && c.nombre));
    });

    var jornadaAntes = S.run.jornada;
    creados = [];
    click('btn-play-match'); // Match sin Phaser → skip → renderPost

    var bajas = [];
    S.run.plantilla.forEach(function (c) {
      if (c.sancion > 0) { resumen.sanciones++; bajas.push(c.id); }
      if (c.lesion > 0) { resumen.lesiones++; bajas.push(c.id); }
    });

    // drop: elegir carta, venta rápida o pasar
    var opciones = botones('btn-tiny').concat(botones('drop-skip'));
    if (opciones.length) { pick(opciones).onclick(); drenar(); }
    if (!byId('btn-post-continue').onclick) { var skipB = botones('drop-skip'); if (skipB.length) { skipB[0].onclick(); drenar(); } }
    click('btn-post-continue');

    assert(S.run.terminada || S.run.jornada === jornadaAntes + 1, 'la jornada no avanzó');
    // una baja (roja o lesión) recién producida debe perderse al menos el siguiente partido
    bajas.forEach(function (id) {
      var c = S.cartaPorId(id);
      assert(!c || S.run.terminada || !S.disponible(c), 'baja disponible en la jornada siguiente: ' + (c && c.nombre));
    });
    assert(S.run.oro >= 0, 'oro negativo');
    assert(S.run.plantilla.length <= S.MAX_PLANTILLA, 'plantilla excede el máximo');
    jornadasRun++;
  }
  resumen.runs++;
  resumen.jornadas += jornadasRun;
  var tabla = ctx.League.clasificacion();
  var pj = tabla.map(function (e) { return e.pj; });
  assert(pj.every(function (x) { return x === pj[0]; }), 'equipos con distinto nº de partidos: ' + pj);
  if (S.run.stats && ctx.League.puestoJugador() === 1 && S.run.jornada >= 14) resumen.titulos++;
  resumen.goles += S.run.stats.gf;
}

console.log('OK', JSON.stringify(resumen));
