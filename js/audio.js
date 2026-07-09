/* ============================================================
   AUDIO — sonidos sintetizados con WebAudio, sin assets externos
   ============================================================ */
var AudioFX = (function () {
  var ctx = null;
  var muted = false;

  function ensureCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, delay, slide) {
    if (muted || !ensureCtx()) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, delay) {
    if (muted || !ensureCtx()) return;
    var t0 = ctx.currentTime + (delay || 0);
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.1, t0);
    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  }

  return {
    click: function () { tone(660, 0.06, 'square', 0.06); },
    hover: function () { tone(440, 0.03, 'sine', 0.02); },
    buy: function () { tone(523, 0.08, 'square', 0.08); tone(784, 0.1, 'square', 0.08, 0.08); },
    sell: function () { tone(784, 0.08, 'square', 0.08); tone(523, 0.1, 'square', 0.08, 0.08); },
    error: function () { tone(180, 0.15, 'sawtooth', 0.08, 0, 120); },
    flip: function () { tone(880, 0.05, 'triangle', 0.06, 0, 1400); },
    reveal: function (rarity) {
      var base = { comun: 440, rara: 523, epica: 659, legendaria: 784 }[rarity] || 440;
      tone(base, 0.1, 'triangle', 0.1);
      tone(base * 1.5, 0.15, 'triangle', 0.09, 0.09);
      if (rarity === 'epica' || rarity === 'legendaria') tone(base * 2, 0.25, 'triangle', 0.09, 0.18);
      if (rarity === 'legendaria') tone(base * 2.5, 0.4, 'triangle', 0.1, 0.3);
    },
    gol: function () {
      tone(523, 0.12, 'square', 0.12);
      tone(659, 0.12, 'square', 0.12, 0.1);
      tone(784, 0.12, 'square', 0.12, 0.2);
      tone(1047, 0.35, 'square', 0.13, 0.3);
      noise(0.5, 0.06, 0.05);
    },
    golRival: function () { tone(330, 0.2, 'sawtooth', 0.09, 0, 200); tone(247, 0.3, 'sawtooth', 0.08, 0.18, 150); },
    parada: function () { tone(392, 0.08, 'triangle', 0.08); },
    ocasion: function () { tone(587, 0.06, 'triangle', 0.06); tone(698, 0.08, 'triangle', 0.06, 0.06); },
    silbato: function () { tone(2200, 0.18, 'square', 0.05); tone(2200, 0.3, 'square', 0.05, 0.25); },
    sinergia: function () { tone(659, 0.08, 'sine', 0.09); tone(831, 0.12, 'sine', 0.09, 0.07); tone(988, 0.2, 'sine', 0.09, 0.15); },
    habilidad: function () { tone(1175, 0.08, 'sine', 0.07); tone(1568, 0.15, 'sine', 0.06, 0.06); },
    victoria: function () {
      [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, 0.18, 'square', 0.11, i * 0.15); });
    },
    derrota: function () {
      [392, 349, 311, 262].forEach(function (f, i) { tone(f, 0.3, 'sawtooth', 0.09, i * 0.25); });
    },
    toggleMute: function () { muted = !muted; return muted; },
    isMuted: function () { return muted; }
  };
})();
