/* ============================================================
   CARD — the shareable season card.
   Draws a 1200x630 (1.91:1, the link-preview / feed size) PNG of
   a Hall of Fame entry on a canvas, builds a spoiler-free text
   version with an emoji results strip, and shares either through
   the Web Share API, a PNG download or the clipboard. Everything
   is generated locally: no network, no assets.
   ============================================================ */

var SeasonCard = (function () {

  // 1200x630 (1.91:1): the size link previews and most feeds expect.
  // Two columns: the result on the left (LW wide), the people on the right (from RX).
  var W = 1200, H = 630, PAD = 48, LW = 500, RX = 588;
  var C = {
    bg: '#100e18', panel: '#201c2e', panel2: '#2a2540', border: '#3a3358',
    text: '#eae8f2', muted: '#8f8aa8', gold: '#ffd54a', accent: '#7c5cff',
    win: '#4ade80', draw: '#ffd54a', loss: '#ff6b5c', red: '#ff5c6c', ink: '#10101a'
  };
  var FONT = "'Arial Black', 'Segoe UI Black', Impact, sans-serif";
  var FONT_TXT = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
  var RES_COLOR = { V: C.win, E: C.draw, D: C.loss };
  var RAREZAS = [['legendaria', 'LEGENDARY', '#f59e0b'], ['epica', 'EPIC', '#a855f7'], ['rara', 'RARE', '#3b82f6'], ['comun', 'COMMON', '#8a919e']];

  // ---- small helpers (pure) ----
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function hex(color) {
    return typeof color === 'number' ? '#' + ('000000' + color.toString(16)).slice(-6) : (color || C.accent);
  }

  // team colour lifted enough to read on the dark card
  function legible(color) {
    var n = typeof color === 'number' ? color : parseInt(String(color).replace('#', ''), 16) || 0;
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (r * 0.299 + g * 0.587 + b * 0.114 < 90) {
      r = Math.min(255, r + 110); g = Math.min(255, g + 110); b = Math.min(255, b + 110);
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function iniciales(nombre) {
    var p = String(nombre).split(/\s+/).filter(Boolean);
    return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : String(nombre).slice(0, 2)).toUpperCase();
  }

  function fechaISO(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  // headline verdict for an entry
  function veredicto(e) {
    if (e.victoria) return { titulo: 'CHAMPIONS', linea: 'League winners', color: C.gold };
    var jugados = e.forma.length;
    if (e.despedido) return { titulo: 'SACKED', linea: 'Shown the door after matchday ' + jugados, color: C.red };
    return { titulo: 'FINISHED ' + ordinal(e.puesto).toUpperCase(), linea: 'Only the title would do', color: C.red };
  }

  // ---- text share (the Wordle pattern: compact, emoji strip, no spoilers needed) ----
  function texto(e, info) {
    var v = veredicto(e);
    var cuadros = { V: '🟩', E: '🟨', D: '🟥' };
    var tira = e.forma.map(function (f) { return cuadros[f.res]; }).join('');
    for (var i = e.forma.length; i < e.jornadas; i++) tira += '⬛';
    var lineas = [
      'Relegation Run' + (e.numero ? ' #' + e.numero : '') + ' · ' + (e.victoria ? '👑 ' : e.despedido ? '💀 ' : '') +
        v.titulo.charAt(0) + v.titulo.slice(1).toLowerCase(),
      e.equipo.nombre + ' · ' + ordinal(e.puesto) + ' · ' + e.pts + ' pts',
      tira,
      e.pg + 'W ' + e.pe + 'D ' + e.pp + 'L · ' + e.gf + '-' + e.gc
    ];
    if (e.mvp) lineas.push('🏅 ' + e.mvp.nombre + ' (' + e.mvp.media.toFixed(2) + ')');
    if (info && info.records && info.records.length) {
      lineas.push('⭐ ' + info.records.map(function (r) { return r.label; }).join(' · '));
    }
    return lineas.join('\n');
  }

  // accessible description of the card image
  function alt(e) {
    var v = veredicto(e);
    return 'Season card: ' + e.equipo.nombre + ', ' + v.titulo.toLowerCase() + '. ' + ordinal(e.puesto) + ' place, ' +
      e.pts + ' points, ' + e.pg + ' won, ' + e.pe + ' drawn, ' + e.pp + ' lost, goals ' + e.gf + ' for and ' + e.gc + ' against.';
  }

  function nombreArchivo(e) {
    var slug = String(e.equipo.nombre).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'relegation-run-' + (slug || 'season') + '-' + fechaISO(e.fecha) + '.png';
  }

  // ---- canvas drawing ----
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function font(ctx, size, display) {
    ctx.font = (display ? '900 ' : '700 ') + size + 'px ' + (display ? FONT : FONT_TXT);
  }

  // largest font size (down to `min`) at which the text fits in maxW
  function ajustar(ctx, txt, maxW, size, min, display) {
    font(ctx, size, display);
    while (size > min && ctx.measureText(txt).width > maxW) { size -= 2; font(ctx, size, display); }
    return size;
  }

  // shorten with an ellipsis if it still does not fit
  function recortar(ctx, txt, maxW) {
    if (ctx.measureText(txt).width <= maxW) return txt;
    while (txt.length > 1 && ctx.measureText(txt + '…').width > maxW) txt = txt.slice(0, -1);
    return txt + '…';
  }

  function rotulo(ctx, txt, x, y, color, align) {
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(txt, x, y);
  }

  function panel(ctx, x, y, w, h, borde, r) {
    r = r || 18;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rrect(ctx, x, y + 6, w, h, r); ctx.fill();
    ctx.fillStyle = C.panel;
    rrect(ctx, x, y, w, h, r); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = borde || C.border;
    rrect(ctx, x, y, w, h, r); ctx.stroke();
  }

  function fondo(ctx, e) {
    var club = hex(e.equipo.color);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // club-coloured glow and a diagonal sash
    var glow = ctx.createRadialGradient(W * 0.2, H * 0.35, 30, W * 0.2, H * 0.35, 620);
    glow.addColorStop(0, club);
    glow.addColorStop(1, 'rgba(16,14,24,0)');
    ctx.globalAlpha = 0.30; ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.09; ctx.fillStyle = club;
    ctx.beginPath(); ctx.moveTo(W * 0.38, 0); ctx.lineTo(W * 0.62, 0); ctx.lineTo(W * 0.42, H); ctx.lineTo(W * 0.18, H);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    // faint centre circle behind the footer
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(W / 2, H - 20, 130, Math.PI, 2 * Math.PI); ctx.stroke();

    // frame: gold for champions
    ctx.lineWidth = 6; ctx.strokeStyle = e.victoria ? C.gold : C.border;
    rrect(ctx, 14, 14, W - 28, H - 28, 26); ctx.stroke();
  }

  function cabecera(ctx, e) {
    font(ctx, 34, true);
    rotulo(ctx, 'RELEGATION', PAD, 76, C.gold);
    var w = ctx.measureText('RELEGATION ').width;
    rotulo(ctx, 'RUN', PAD + w, 76, C.accent);
    font(ctx, 15, false);
    rotulo(ctx, 'A FOOTBALL ROGUELIKE', PAD, 102, C.muted);

    font(ctx, 24, true);
    rotulo(ctx, e.numero ? 'RUN #' + e.numero : 'SEASON', W - PAD, 72, C.text, 'right');
    font(ctx, 16, false);
    rotulo(ctx, fechaISO(e.fecha), W - PAD, 98, C.muted, 'right');
  }

  function escudo(ctx, e, x, y, s) {
    var club = hex(e.equipo.color);
    function forma() {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x + s, y + s * 0.55);
      ctx.quadraticCurveTo(x + s, y + s * 0.95, x + s / 2, y + s * 1.12);
      ctx.quadraticCurveTo(x, y + s * 0.95, x, y + s * 0.55);
      ctx.closePath();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.save(); ctx.translate(0, 6); forma(); ctx.fill(); ctx.restore();
    ctx.fillStyle = club; forma(); ctx.fill();
    // a darker half for depth
    ctx.save(); forma(); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + s / 2, y, s / 2, s * 1.2);
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = e.victoria ? C.gold : '#f0f0f5'; forma(); ctx.stroke();
    font(ctx, Math.round(s * 0.36), true);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.textAlign = 'center';
    ctx.fillText(iniciales(e.equipo.nombre), x + s / 2 + 2, y + s * 0.62 + 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(iniciales(e.equipo.nombre), x + s / 2, y + s * 0.62);
  }

  // left column: crest, club, verdict
  function titular(ctx, e, v) {
    var cx = PAD + 120, maxW = PAD + LW - cx;
    escudo(ctx, e, PAD, 132, 96);
    ajustar(ctx, e.equipo.nombre.toUpperCase(), maxW, 32, 18, true);
    rotulo(ctx, recortar(ctx, e.equipo.nombre.toUpperCase(), maxW), cx, 170, legible(e.equipo.color));

    // verdict banner
    ajustar(ctx, v.titulo, maxW, 58, 28, true);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.textAlign = 'left';
    ctx.fillText(v.titulo, cx + 3, 232 + 4);
    rotulo(ctx, v.titulo, cx, 232, v.color);
    font(ctx, 18, false);
    rotulo(ctx, recortar(ctx, v.linea + ' · ' + e.formacion, LW), PAD, 278, C.muted);
  }

  function tiles(ctx, e) {
    var datos = [
      ['POSITION', ordinal(e.puesto)],
      ['POINTS', String(e.pts)],
      ['W · D · L', e.pg + '-' + e.pe + '-' + e.pp],
      ['GOALS', e.gf + ':' + e.gc]
    ];
    var gap = 12, w = (LW - gap * 3) / 4, y = 304, h = 96;
    datos.forEach(function (d, i) {
      var x = PAD + i * (w + gap);
      panel(ctx, x, y, w, h, i === 0 && e.victoria ? C.gold : null, 14);
      ajustar(ctx, d[1], w - 20, 38, 20, true);
      rotulo(ctx, d[1], x + w / 2, y + 54, i === 0 ? (e.victoria ? C.gold : C.text) : C.text, 'center');
      font(ctx, 13, false);
      rotulo(ctx, d[0], x + w / 2, y + 80, C.muted, 'center');
    });
  }

  function tira(ctx, e) {
    var y = 440;
    font(ctx, 17, true);
    rotulo(ctx, 'THE SEASON', PAD, y, C.muted);
    if (e.forma.some(function (f) { return f.jefe; })) {
      font(ctx, 14, false);
      rotulo(ctx, 'outlined = boss match', PAD + LW, y, C.muted, 'right');
    }

    var n = Math.max(e.jornadas, e.forma.length), gap = 6;
    var s = Math.floor((LW - gap * (n - 1)) / n), top = y + 14;
    for (var i = 0; i < n; i++) {
      var x = PAD + i * (s + gap), f = e.forma[i];
      if (!f) {
        ctx.setLineDash && ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2; ctx.strokeStyle = C.border;
        rrect(ctx, x + 1, top + 1, s - 2, s - 2, 6); ctx.stroke();
        ctx.setLineDash && ctx.setLineDash([]);
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, x, top + 3, s, s, 6); ctx.fill();
      ctx.fillStyle = RES_COLOR[f.res]; rrect(ctx, x, top, s, s, 6); ctx.fill();
      if (f.jefe) { ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; rrect(ctx, x - 2.5, top - 2.5, s + 5, s + 5, 8); ctx.stroke(); }
      font(ctx, Math.min(13, Math.floor(s * 0.4)), true);
      rotulo(ctx, f.gf + '-' + f.gc, x + s / 2, top + s / 2 + 5, C.ink, 'center');
    }
  }

  // "new record" chips, under the results strip
  function records(ctx, info) {
    var lista = (info && info.records) || [];
    var x = PAD, y = 506, h = 32;
    font(ctx, 14, true);
    lista.slice(0, 3).forEach(function (r) {
      var txt = '★ ' + r.label.toUpperCase();
      var w = ctx.measureText(txt).width + 28;
      if (x + w > PAD + LW) return;
      ctx.fillStyle = C.gold; rrect(ctx, x, y, w, h, h / 2); ctx.fill();
      rotulo(ctx, txt, x + 14, y + 21, C.ink);
      x += w + 10;
    });
  }

  // right column: player of the season, top scorer / assists, final XI
  function premios(ctx, e) {
    var y = 128, w = W - PAD - RX;
    panel(ctx, RX, y, w, 160, C.gold);
    var px = RX + 24, py = y + 24, ps = 112;
    ctx.fillStyle = C.panel2; rrect(ctx, px - 4, py - 4, ps + 8, ps + 8, 12); ctx.fill();
    if (e.mvp && typeof Sprite !== 'undefined' && Sprite.lienzo) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Sprite.lienzo(e.mvp), px, py, ps, ps);
      ctx.imageSmoothingEnabled = true;
    }
    var tx = px + ps + 28, maxW = RX + w - 24 - tx;
    font(ctx, 15, false);
    rotulo(ctx, 'PLAYER OF THE SEASON', tx, y + 46, C.gold);
    if (e.mvp) {
      ajustar(ctx, e.mvp.nombre, maxW, 38, 22, true);
      rotulo(ctx, recortar(ctx, e.mvp.nombre, maxW), tx, y + 96, C.text);
      font(ctx, 18, false);
      rotulo(ctx, recortar(ctx, e.mvp.pos + ' · ' + e.mvp.media.toFixed(2) + ' average rating', maxW), tx, y + 130, C.muted);
    } else {
      font(ctx, 34, true);
      rotulo(ctx, '—', tx, y + 96, C.muted);
    }

    // top scorer and top assists, level with the stat tiles
    var gap = 16, hw = (w - gap) / 2, y2 = 304;
    [['TOP SCORER', e.goleador, 'goles', 'goal', 'goals'],
     ['TOP ASSISTS', e.asistente, 'asistencias', 'assist', 'assists']].forEach(function (a, i) {
      var x = RX + i * (hw + gap);
      panel(ctx, x, y2, hw, 96, null, 14);
      font(ctx, 13, false);
      rotulo(ctx, a[0], x + 20, y2 + 28, C.muted);
      if (a[1]) {
        var n = a[1][a[2]];
        ajustar(ctx, a[1].nombre, hw - 40, 24, 15, true);
        rotulo(ctx, recortar(ctx, a[1].nombre, hw - 40), x + 20, y2 + 58, C.text);
        font(ctx, 16, false);
        rotulo(ctx, n + ' ' + (n === 1 ? a[3] : a[4]), x + 20, y2 + 82, C.gold);
      } else {
        font(ctx, 26, true);
        rotulo(ctx, '—', x + 20, y2 + 64, C.muted);
      }
    });

    xi(ctx, e, RX, 420, w);
  }

  // rarity breakdown of the last starting XI (entries from before RR-4 have none)
  function xi(ctx, e, x, y, w) {
    panel(ctx, x, y, w, 118, null, 14);
    font(ctx, 13, false);
    rotulo(ctx, 'FINAL XI', x + 20, y + 28, C.muted);
    if (!e.xi) {
      font(ctx, 26, true);
      rotulo(ctx, '—', x + 20, y + 76, C.muted);
      return;
    }
    var gap = 10, bw = (w - 40 - gap * 3) / 4;
    RAREZAS.forEach(function (r, i) {
      var bx = x + 20 + i * (bw + gap), by = y + 40, n = e.xi[r[0]] || 0;
      ctx.globalAlpha = n ? 0.18 : 0.06;
      ctx.fillStyle = r[2]; rrect(ctx, bx, by, bw, 62, 10); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2; ctx.strokeStyle = n ? r[2] : C.border; rrect(ctx, bx, by, bw, 62, 10); ctx.stroke();
      font(ctx, 28, true);
      rotulo(ctx, String(n), bx + bw / 2, by + 34, n ? r[2] : C.muted, 'center');
      font(ctx, 12, false);
      rotulo(ctx, r[1], bx + bw / 2, by + 53, n ? C.text : C.muted, 'center');
    });
  }

  function pie(ctx, e, info) {
    var y = 596;
    font(ctx, 16, false);
    var rank = info && info.rank ? 'Hall of Fame #' + info.rank + ' of ' + info.total : '';
    rotulo(ctx, rank, PAD, y, C.muted);
    font(ctx, 16, true);
    rotulo(ctx, 'ONE SEASON. ONE SHOT.', W - PAD, y, C.text, 'right');
  }

  // Draw the card for `entry` onto `canvas` (resized to 1200x630).
  // info = {rank, total, records} from Hall.evaluar/registrar (optional).
  // Returns false where there is no 2D canvas (e.g. the Node tests).
  function dibujar(canvas, entry, info) {
    var ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return false;
    canvas.width = W; canvas.height = H;
    var v = veredicto(entry);
    ctx.textBaseline = 'alphabetic';
    fondo(ctx, entry);
    cabecera(ctx, entry);
    titular(ctx, entry, v);
    tiles(ctx, entry);
    tira(ctx, entry);
    records(ctx, info);
    premios(ctx, entry);
    pie(ctx, entry, info);
    if (canvas.setAttribute) {
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', alt(entry));
    }
    return true;
  }

  // ---- sharing ----
  function aBlob(canvas, cb) {
    if (canvas.toBlob) { canvas.toBlob(function (b) { cb(b); }, 'image/png'); return; }
    cb(null);
  }

  function descargar(canvas, entry) {
    var a = document.createElement('a');
    a.download = nombreArchivo(entry);
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Copies text to the clipboard: async Clipboard API with a textarea fallback
  // (file:// pages and older browsers do not expose navigator.clipboard).
  function copiar(txt, cb) {
    function fallback() {
      var ok = false;
      try {
        var ta = document.createElement('textarea');
        ta.value = txt; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch (e) { ok = false; }
      cb(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { cb(true); }, fallback);
    } else fallback();
  }

  // Native share sheet with the PNG when supported (mostly mobile); otherwise
  // download the PNG and copy the text so it can be pasted next to it.
  // cb(result) with result in 'shared' | 'cancelled' | 'downloaded'.
  function compartir(canvas, entry, info, cb) {
    var txt = texto(entry, info);
    aBlob(canvas, function (blob) {
      var file = null;
      try { file = blob && typeof File !== 'undefined' ? new File([blob], nombreArchivo(entry), { type: 'image/png' }) : null; } catch (e) { file = null; }
      var datos = file ? { files: [file], text: txt, title: 'Relegation Run' } : null;
      if (datos && navigator.canShare && navigator.canShare(datos) && navigator.share) {
        navigator.share(datos).then(function () { cb('shared'); }, function (err) {
          if (err && err.name === 'AbortError') cb('cancelled');
          else { descargar(canvas, entry); copiar(txt, function () { cb('downloaded'); }); }
        });
        return;
      }
      descargar(canvas, entry);
      copiar(txt, function () { cb('downloaded'); });
    });
  }

  return {
    W: W, H: H,
    dibujar: dibujar,
    texto: texto,
    alt: alt,
    veredicto: veredicto,
    nombreArchivo: nombreArchivo,
    ordinal: ordinal,
    compartir: compartir,
    descargar: descargar,
    copiar: copiar
  };
})();

if (typeof module !== 'undefined') module.exports = SeasonCard;
