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
  // SCREENSHOT_DIR=docs/screenshots saves PNGs of each screen (used for the README)
  var SHOTS = process.env.SCREENSHOT_DIR;
  async function shot(name) {
    if (!SHOTS) return;
    await esperar(400);
    var r = await cdp('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64'));
  }
  // a real mouse click counts as a user gesture, so the browser allows audio
  async function realClick(id) {
    var r = JSON.parse(await js('JSON.stringify(document.getElementById("' + id + '").getBoundingClientRect())'));
    var x = r.x + r.width / 2, y = r.y + r.height / 2;
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 });
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

  await js('localStorage.clear()');
  await shot('menu');
  var ok = true;
  for (var partido = 1; partido <= 2 && ok; partido++) {
    if (partido === 1) {
      // real click (user gesture) so the browser allows audio
      await realClick('btn-new-run');
    }
    await hasta('document.getElementById("screen-manage").classList.contains("active")', 3000);
    // cycle through the tabs
    await js('document.querySelectorAll(".tab").forEach(function(t){t.click()}); document.querySelector(".tab").click()');
    if (partido === 1) await shot('manage');
    await js('document.getElementById("btn-play-match").click()');
    await hasta('document.getElementById("screen-match").classList.contains("active")', 3000);
    await js('document.querySelector(".speed-btn[data-speed=\'4\']").click()');
    // half-time team talk / tactics board
    if (partido === 1) { await esperar(6000); await shot('match'); }
    await hasta('!document.getElementById("ht-panel").classList.contains("hidden")', 30000);
    await js('document.querySelector("#ht-mentalidad .seg-btn").click(); document.getElementById("ht-continue").click()');
    if (partido === 2) await js('document.getElementById("btn-skip").click()');
    ok = await hasta('document.getElementById("screen-post").classList.contains("active")', 40000);
    // drop: open the player profile, then skip the drop
    await esperar(2500);
    if (partido === 1) await shot('post-match');
    await js('var f=document.querySelector("#drop-cards .btn-ficha"); f && f.click(); document.getElementById("ficha-close").click()');
    await js('var b=document.querySelector("#drop-cards .drop-skip"); b && b.click()');
    await js('var c=document.getElementById("btn-post-continue"); c.classList.contains("hidden") || c.click()');
  }
  // save / resume: reload the page and continue the saved run
  var jornadaAntes = await js('State.run.jornada');
  await cdp('Page.navigate', { url: URL });
  await hasta('document.readyState === "complete" && !!window.UI', 10000);
  if (!await js('!document.getElementById("btn-continue").classList.contains("hidden")')) problemas.push('RESUME: Continue button not shown after reload');
  await realClick('btn-continue');
  await hasta('document.getElementById("screen-manage").classList.contains("active")', 3000);
  var jornadaDespues = await js('State.run.jornada');
  if (jornadaDespues !== jornadaAntes) problemas.push('RESUME: matchday ' + jornadaAntes + ' became ' + jornadaDespues + ' after reload');

  // season review: render the end screen for the current run
  await js('UI.renderEnd({ victoria: false, razon: "Browser check", puesto: League.puestoJugador() })');
  await hasta('document.getElementById("screen-end").classList.contains("active")', 3000);
  if (!await js('document.querySelectorAll("#end-form .res").length > 0 && document.querySelectorAll("#end-squad tr").length > 1')) problemas.push('REVIEW: season review not rendered');
  await shot('season-review');

  // season card: really painted on the canvas (not just the background colour)
  var CARD_PAINTED = '(function(id){var c=document.getElementById(id);if(c.width!==1080||c.height!==1350)return false;' +
    'var d=c.getContext("2d").getImageData(0,0,c.width,c.height).data,cols={};' +
    'for(var i=0;i<d.length;i+=4*997)cols[d[i]+","+d[i+1]+","+d[i+2]]=1;return Object.keys(cols).length>20;})';
  if (!await js(CARD_PAINTED + '("end-card-canvas")')) problemas.push('CARD: season card canvas is blank');
  if (!await js('/^Season card: /.test(document.getElementById("end-card-canvas").getAttribute("aria-label"))')) problemas.push('CARD: missing accessible label');
  if (SHOTS) {
    var png = await js('document.getElementById("end-card-canvas").toDataURL("image/png")');
    fs.writeFileSync(path.join(SHOTS, 'season-card.png'), Buffer.from(png.split(',')[1], 'base64'));
  }
  // the top of a long end screen must stay reachable (flex centring used to push it above the scroll area)
  if (!await js('document.querySelector(".end-content").getBoundingClientRect().top >= document.getElementById("screen-end").getBoundingClientRect().top - 1')) problemas.push('END: top of the end screen is cut off');
  // copy text works from file:// (falls back to execCommand without the Clipboard API)
  await js('document.getElementById("btn-end-copy").click()');

  // Hall of Fame: store this season, open the screen, open its card, close with Esc
  await js('Hall.registrar(Hall.crearEntrada(State.run, { victoria: false, razon: "Browser check", puesto: League.puestoJugador() }, League.resumenTemporada(), 1))');
  await js('document.getElementById("btn-end-hall").click()');
  await hasta('document.getElementById("screen-hall").classList.contains("active")', 3000);
  if (await js('document.querySelectorAll("#hall-list .hall-row").length') !== 1) problemas.push('HALL: expected one Hall of Fame row');
  await shot('hall-of-fame');
  await js('document.querySelector("#hall-list .hall-row").click()');
  await hasta('!document.getElementById("card-modal").classList.contains("hidden")', 3000);
  if (!await js(CARD_PAINTED + '("card-canvas")')) problemas.push('HALL: card modal canvas is blank');
  await js('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))');
  if (!await js('document.getElementById("card-modal").classList.contains("hidden")')) problemas.push('HALL: Esc did not close the card');
  await js('document.getElementById("hall-sort-recent").click()');
  await js('document.getElementById("btn-hall-back").click()');
  await hasta('document.getElementById("screen-menu").classList.contains("active")', 3000);

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
