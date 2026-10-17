/* ============================================================
   Shared headless harness for the Node tests (no dependencies).
   boot(storage?) loads the real game modules into a fresh VM
   context with a minimal fake DOM, as if the page had just been
   opened. Passing the same `storage` to a second boot() simulates
   a page reload that keeps localStorage.
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var MODULES = ['attrs', 'formations', 'gen', 'synergy', 'engine', 'commentary', 'state', 'league', 'economy', 'nego', 'ui', 'mobile', 'match', 'main'];

function memoryStorage() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; },
    keys: function () { return Object.keys(s); }
  };
}

function boot(storage) {
  var h = { created: [] };

  // ---------- minimal DOM ----------
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
    h.created.push(this);
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

  var byIdMap = {};
  function byId(id) { return byIdMap[id] || (byIdMap[id] = new Elem('div', id)); }

  var domReady = [];
  var document = {
    getElementById: byId,
    querySelector: function (sel) { return sel.charAt(0) === '#' ? byId(sel.slice(1)) : new Elem('div'); },
    querySelectorAll: function () { return []; },
    createElement: function (t) { return new Elem(t); },
    addEventListener: function (ev, fn) { if (ev === 'DOMContentLoaded') domReady.push(fn); },
    documentElement: new Elem('html')
  };

  // deterministic timers: a queue drained by hand
  var timers = [];
  function drain() {
    var guard = 0;
    while (timers.length && guard++ < 10000) timers.shift()();
  }

  var ctx = {
    console: console,
    Math: Math, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date,
    parseInt: parseInt, isNaN: isNaN,
    document: document,
    navigator: { userAgent: 'node', maxTouchPoints: 0 },
    location: { search: '' },
    localStorage: storage || memoryStorage(),
    setTimeout: function (fn) { timers.push(fn); return timers.length; },
    clearTimeout: function () {},
    setInterval: function () { return 0; },
    clearInterval: function () {},
    requestAnimationFrame: function () {},
    scrollTo: function () {},
    Event: function () {},
    // stubs for canvas/WebAudio modules
    Sprite: { avatar: function () { return 'data:'; }, img: function () { return new Elem('img'); } },
    AudioFX: new Proxy({}, { get: function (t, k) { return k === 'toggleMute' ? function () { return true; } : function () {}; } })
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  MODULES.forEach(function (f) {
    var file = path.join(ROOT, 'js', f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  });
  domReady.forEach(function (fn) { fn(); });

  h.ctx = ctx;
  h.storage = ctx.localStorage;
  h.byId = byId;
  h.drain = drain;
  h.click = function (id) {
    var e = byId(id);
    if (!e.onclick) throw new Error('#' + id + ' has no onclick');
    e.onclick({ stopPropagation: function () {} });
    drain();
  };
  // clickable elements with a given class created since the last resetCreated()
  h.buttons = function (cls) {
    return h.created.filter(function (e) { return (' ' + e.className + ' ').indexOf(' ' + cls + ' ') >= 0 && e.onclick; });
  };
  h.resetCreated = function () { h.created.length = 0; };
  h.hidden = function (id) { return byId(id).classList.contains('hidden'); };
  return h;
}

module.exports = { boot: boot, memoryStorage: memoryStorage };
