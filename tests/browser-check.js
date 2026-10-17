/* ============================================================
   BROWSER CHECK (headless Chrome via CDP, no deps):
     node --experimental-websocket tests/browser-check.js [chrome-path] [?query]
   Opens index.html over file:// (no server), plays a full
   visible match (half-time included) and lists any console
   error or warning. Exits with code 1 if there are errors.
   Matches DOM by id/class only, never by UI text.
   ============================================================ */
'use strict';
var path = require('path');
var spawn = require('child_process').spawn;
var http = require('http');
var os = require('os');
var fs = require('fs');

var CHROME = process.argv[2] || 'google-chrome';
var QUERY = process.argv[3] || '';
var PORT = 9300 + Math.floor(Math.random() * 500);
var URL = 'file://' + path.join(__dirname, '..', 'index.html') + QUERY;
var perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'relegation-run-chrome-'));

var chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--mute-audio',
  '--user-data-dir=' + perfil, '--remote-debugging-port=' + PORT,
  '--window-size=1280,900', 'about:blank'
], { stdio: 'ignore' });

function getJSON(url) {
  return new Promise(function (ok, ko) {
    http.get(url, function (res) {
      var d = ''; res.on('data', function (c) { d += c; }); res.on('end', function () { ok(JSON.parse(d)); });
    }).on('error', ko);
  });
}
function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var targets;
  for (var i = 0; i < 50; i++) {
    try { targets = await getJSON('http://127.0.0.1:' + PORT + '/json'); break; } catch (e) { await esperar(200); }
  }
  var page = targets.filter(function (t) { return t.type === 'page'; })[0];
  var ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(function (r) { ws.onopen = r; });

  var seq = 0, pend = {}, problemas = [];
  ws.onmessage = function (m) {
    var msg = JSON.parse(m.data);
    if (msg.id && pend[msg.id]) { pend[msg.id](msg); delete pend[msg.id]; return; }
    if (msg.method === 'Runtime.exceptionThrown') {
      var d = msg.params.exceptionDetails;
      problemas.push('EXCEPTION: ' + (d.exception && d.exception.description || d.text));
    } else if (msg.method === 'Runtime.consoleAPICalled' && /error|warning/.test(msg.params.type)) {
      problemas.push('console.' + msg.params.type + ': ' + msg.params.args.map(function (a) { return a.value || a.description; }).join(' '));
    } else if (msg.method === 'Log.entryAdded' && /error|warning/.test(msg.params.entry.level)) {
      problemas.push('log.' + msg.params.entry.level + ': ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
    }
  };
  function cdp(method, params) {
    return new Promise(function (r) { var id = ++seq; pend[id] = r; ws.send(JSON.stringify({ id: id, method: method, params: params || {} })); });
  }
  async function js(expr) {
    var r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) problemas.push('EVAL: ' + expr + ' → ' + r.result.exceptionDetails.exception.description);
    return r.result.result && r.result.result.value;
  }
  async function hasta(expr, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await js(expr)) return true; await esperar(250); }
    problemas.push('TIMEOUT waiting for: ' + expr);
    return false;
  }

  await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.enable');
  await cdp('Page.navigate', { url: URL });
  await hasta('document.readyState === "complete" && !!window.Phaser', 10000);

  var ok = true;
  for (var partido = 1; partido <= 2 && ok; partido++) {
    if (partido === 1) {
      // real click (user gesture) so the browser allows audio
      var r = await js('JSON.stringify(document.getElementById("btn-new-run").getBoundingClientRect())');
      r = JSON.parse(r);
      var x = r.x + r.width / 2, y = r.y + r.height / 2;
      await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 });
    }
    await hasta('document.getElementById("screen-manage").classList.contains("active")', 3000);
    // cycle through the tabs
    await js('document.querySelectorAll(".tab").forEach(function(t){t.click()}); document.querySelector(".tab").click()');
    await js('document.getElementById("btn-play-match").click()');
    await hasta('document.getElementById("screen-match").classList.contains("active")', 3000);
    await js('document.querySelector(".speed-btn[data-speed=\'4\']").click()');
    // half-time team talk / tactics board
    await hasta('!document.getElementById("ht-panel").classList.contains("hidden")', 30000);
    await js('document.querySelector("#ht-mentalidad .seg-btn").click(); document.getElementById("ht-continue").click()');
    if (partido === 2) await js('document.getElementById("btn-skip").click()');
    ok = await hasta('document.getElementById("screen-post").classList.contains("active")', 40000);
    // drop: open the player profile, then skip the drop
    await esperar(2500);
    await js('var f=document.querySelector("#drop-cards .btn-ficha"); f && f.click(); document.getElementById("ficha-close").click()');
    await js('var b=document.querySelector("#drop-cards .drop-skip"); b && b.click()');
    await js('var c=document.getElementById("btn-post-continue"); c.classList.contains("hidden") || c.click()');
  }
  var estado = await js('JSON.stringify({matchday: State.run.jornada, screen: document.querySelector(".screen.active").id})');

  console.log('URL:', URL);
  console.log('Final state:', estado);
  // warnings from headless Chrome itself (no GPU), not from the game
  var entorno = /software WebGL|GL Driver Message|swiftshader/i;
  var ignorados = problemas.filter(function (p) { return entorno.test(p); }).length;
  problemas = problemas.filter(function (p) { return !entorno.test(p); });
  if (ignorados) console.log('Ignored ' + ignorados + ' software-WebGL warnings (headless environment).');
  if (problemas.length) {
    console.log('PROBLEMS (' + problemas.length + '):');
    problemas.forEach(function (p) { console.log(' - ' + p); });
  } else {
    console.log('No console errors or warnings.');
  }
  ws.close();
  var codigo = problemas.length ? 1 : 0;
  chrome.on('exit', function () {
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) { /* temporary profile */ }
    process.exit(codigo);
  });
  chrome.kill();
})().catch(function (e) { console.error(e); chrome.kill(); process.exit(2); });
