/* ============================================================
   SPRITE — retratos pixel-art procedurales (canvas, sin assets).
   Deterministas: el mismo jugador siempre tiene la misma cara.
   ============================================================ */

var Sprite = (function () {

  var cache = {};

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  // PRNG determinista (mulberry32)
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var PIEL = ['#ffd9b3', '#f2b98c', '#d69a6b', '#a9714b', '#7c4f33'];
  var PELO = ['#191919', '#332414', '#3a2a1a', '#6b4a2a', '#a8742f', '#d9c26a', '#8a8a8a', '#7a2e1d'];
  var KIT_POS = {
    POR: ['#c9a227', '#8a6d12'],
    DEF: ['#2e7cd6', '#1b4f8f'],
    MED: ['#2fa45c', '#1d6e3c'],
    DEL: ['#d64545', '#8f2626'],
    STAFF: ['#3a3358', '#241f38']
  };

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // dibuja un retrato 16x16 en el canvas dado
  function dibujar(ctx, seed, pos) {
    var r = rng(seed);
    var piel = PIEL[Math.floor(r() * PIEL.length)];
    var pieloscura = '#00000022';
    var pelo = PELO[Math.floor(r() * PELO.length)];
    var estilo = Math.floor(r() * 6); // 0 rapado 1 corto 2 puntas 3 melena 4 afro 5 calvo
    var barba = r() < 0.3;
    var bigote = !barba && r() < 0.15;
    var kit = KIT_POS[pos] || KIT_POS.MED;
    var rayas = pos !== 'STAFF' && r() < 0.4;

    // fondo transparente
    ctx.clearRect(0, 0, 16, 16);

    // cuello + cara
    px(ctx, 5, 3, 6, 7, piel);           // cara
    px(ctx, 4, 4, 1, 5, piel);           // sien izq
    px(ctx, 11, 4, 1, 5, piel);          // sien dcha
    px(ctx, 6, 10, 4, 1, piel);          // barbilla/cuello

    // pelo
    if (estilo !== 5) {
      px(ctx, 4, 2, 8, 2, pelo);         // base superior
      px(ctx, 4, 3, 2, 2, pelo);
      px(ctx, 10, 3, 2, 2, pelo);
      if (estilo === 1) { px(ctx, 3, 3, 1, 3, pelo); px(ctx, 12, 3, 1, 3, pelo); }
      if (estilo === 2) { px(ctx, 5, 1, 1, 1, pelo); px(ctx, 7, 0, 2, 2, pelo); px(ctx, 10, 1, 1, 1, pelo); }
      if (estilo === 3) { px(ctx, 3, 3, 1, 6, pelo); px(ctx, 12, 3, 1, 6, pelo); px(ctx, 4, 2, 8, 1, pelo); }
      if (estilo === 4) { px(ctx, 3, 0, 10, 4, pelo); px(ctx, 2, 2, 2, 4, pelo); px(ctx, 12, 2, 2, 4, pelo); }
    }

    // ojos + boca
    var ojo = '#1d1d2b';
    px(ctx, 6, 6, 1, 1, ojo);
    px(ctx, 9, 6, 1, 1, ojo);
    px(ctx, 7, 8, 2, 1, pieloscura);

    // barba / bigote
    if (barba) {
      px(ctx, 5, 8, 1, 2, pelo); px(ctx, 10, 8, 1, 2, pelo);
      px(ctx, 6, 9, 4, 1, pelo);
    }
    if (bigote) px(ctx, 6, 7, 4, 1, pelo);

    // camiseta / traje
    px(ctx, 3, 11, 10, 5, kit[0]);       // torso
    px(ctx, 2, 12, 1, 4, kit[0]);        // hombro izq
    px(ctx, 13, 12, 1, 4, kit[0]);       // hombro dcho
    if (rayas) {
      px(ctx, 5, 11, 2, 5, kit[1]);
      px(ctx, 9, 11, 2, 5, kit[1]);
    }
    if (pos === 'STAFF') {
      px(ctx, 7, 11, 2, 5, '#0e0c16');   // corbata
      px(ctx, 6, 11, 1, 2, '#dcdcec');   // cuello camisa
      px(ctx, 9, 11, 1, 2, '#dcdcec');
      if (r() < 0.5) { px(ctx, 5, 6, 3, 1, '#111'); px(ctx, 8, 6, 3, 1, '#111'); } // gafas
    } else {
      px(ctx, 6, 11, 4, 1, '#f0f0f5');   // cuello
    }
  }

  // devuelve dataURL cacheado del retrato de una carta
  function avatar(carta) {
    var key = carta.id;
    if (cache[key]) return cache[key];
    var canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    var ctx = canvas.getContext('2d');
    var seed = hash(carta.nombre + '|' + carta.id);
    dibujar(ctx, seed, carta.type === 'staff' ? 'STAFF' : carta.pos);
    var url = canvas.toDataURL();
    cache[key] = url;
    return url;
  }

  // <img> listo para insertar, con el escalado pixelado
  function img(carta, size) {
    var i = document.createElement('img');
    i.src = avatar(carta);
    i.className = 'pixel-sprite';
    i.width = size; i.height = size;
    i.alt = '';
    return i;
  }

  return { avatar: avatar, img: img, hash: hash };
})();
