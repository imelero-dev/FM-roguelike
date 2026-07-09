/* ============================================================
   UI — renderizado DOM: pantallas, cartas, tienda, liga, negociación
   ============================================================ */

var UI = (function () {

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var seleccionBanquillo = null; // id de carta seleccionada para alinear

  // ---------- utilidades ----------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function showScreen(id) {
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    $('#' + id).classList.add('active');
    window.scrollTo(0, 0);
  }

  function toast(msg, tipo) {
    var t = el('div', 'toast ' + (tipo || ''), msg);
    $('#toast-container').appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 400);
    }, 2600);
  }

  function confirmar(texto, onYes) {
    $('#confirm-text').innerHTML = texto;
    $('#confirm-modal').classList.remove('hidden');
    var yes = $('#confirm-yes'), no = $('#confirm-no');
    var cerrar = function () {
      $('#confirm-modal').classList.add('hidden');
      yes.onclick = no.onclick = null;
    };
    yes.onclick = function () { AudioFX.click(); cerrar(); onYes(); };
    no.onclick = function () { AudioFX.click(); cerrar(); };
  }

  function colorHex(color) {
    return '#' + ('000000' + color.toString(16)).slice(-6);
  }

  // aclara colores oscuros para usarlos como texto sobre fondo oscuro
  function colorLegible(color) {
    var r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    if (r * 0.299 + g * 0.587 + b * 0.114 < 90) {
      r = Math.min(255, r + 110); g = Math.min(255, g + 110); b = Math.min(255, b + 110);
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ---------- render de cartas ----------
  function statsHTML(c) {
    function bar(label, key, val) {
      var pct = Math.round(val / 99 * 100);
      return '<div class="stat-row"><span class="stat-label">' + label + '</span>' +
        '<span class="stat-bar bar-' + key + '"><i style="width:' + pct + '%"></i></span>' +
        '<b class="stat-val">' + val + '</b></div>';
    }
    return '<div class="card-stats">' +
      bar('ATQ', 'atq', c.stats.atq) + bar('DEF', 'def', c.stats.def) +
      bar('PAS', 'pas', c.stats.pas) + bar('VEL', 'vel', c.stats.vel) +
      '</div>';
  }

  function habsHTML(c) {
    if (!c.habilidades || !c.habilidades.length) return '<div class="card-habs card-habs-empty">—</div>';
    return '<div class="card-habs">' + c.habilidades.map(function (h) {
      var def = Gen.HABILIDADES[h];
      return '<span class="hab-chip" title="' + def.nombre + ': ' + def.desc + '">' + def.icono + ' ' + def.nombre + '</span>';
    }).join('') + '</div>';
  }

  function tagIcono(tag) {
    return (Synergy.SINERGIAS[tag] ? Synergy.SINERGIAS[tag].icono : '') + ' ' + tag;
  }

  function cartaDOM(c, opciones) {
    opciones = opciones || {};
    var d;
    var retrato = '<div class="card-face"><img class="pixel-sprite" src="' + Sprite.avatar(c) + '" alt=""></div>';
    if (c.type === 'staff') {
      d = el('div', 'card staff-card rarity-' + c.rareza);
      d.innerHTML =
        '<div class="card-top"><span class="card-pos">STAFF</span><span class="staff-icon">' + c.icono + '</span></div>' +
        retrato +
        '<div class="card-name">' + c.nombre + '</div>' +
        '<div class="staff-desc">' + c.desc + '</div>' +
        '<div class="card-footer"><span>💰 ' + c.salario + '/j</span></div>';
    } else {
      d = el('div', 'card rarity-' + c.rareza + (c.lesion > 0 ? ' lesionado' : ''));
      d.innerHTML =
        '<div class="card-top"><span class="card-pos pos-' + c.pos + '">' + c.pos + '</span>' +
        '<span class="card-media">' + c.media + '</span></div>' +
        retrato +
        '<div class="card-name">' + c.nombre + '</div>' +
        '<div class="card-tag">' + tagIcono(c.tag) + '</div>' +
        statsHTML(c) + habsHTML(c) +
        '<div class="card-footer"><span class="rareza-label">' + Gen.RAREZAS[c.rareza].nombre + '</span>' +
        '<span>💰 ' + c.salario + '/j</span></div>' +
        (c.lesion > 0 ? '<div class="lesion-badge">🚑 ' + c.lesion + ' j.</div>' : '');
    }
    d.dataset.id = c.id;
    if (opciones.mini) d.classList.add('card-mini');
    d.addEventListener('mouseenter', function () { AudioFX.hover(); });
    return d;
  }

  // ---------- pantalla: menú ----------
  function renderMenu() {
    var m = State.meta();
    $('#meta-stats').innerHTML = m.runs > 0
      ? 'Runs: <b>' + m.runs + '</b> · Títulos: <b>' + m.victorias + '</b> · Mejor puesto: <b>' +
        (m.mejorPuesto ? m.mejorPuesto + 'º' : '—') + '</b>'
      : 'Primera run. Suerte, míster.';
    showScreen('screen-menu');
  }

  // ---------- pantalla: gestión ----------
  function renderManage() {
    var run = State.run;
    var rival = State.rivalActual();
    var p = State.partidoDelJugador(run.jornada);
    var jefe = State.etiquetaJefe(run.jornada);

    $('#mg-team-name').textContent = run.equipos[0].nombre;
    $('#mg-jornada').textContent = 'Jornada ' + run.jornada + '/14';
    $('#mg-gold').textContent = '💰 ' + run.oro;
    $('#mg-salary').textContent = '📉 ' + State.salarioTotal() + '/jornada';

    var peligro = rival.rating >= 76 ? '🔴' : rival.rating >= 66 ? '🟠' : '🟢';
    $('#mg-next-rival').innerHTML =
      (jefe ? '<span class="boss-label">' + jefe + '</span> ' : '') +
      'Próximo rival: <b style="color:' + colorLegible(rival.color) + '">' + rival.nombre + '</b> ' +
      '(' + (p.esLocal ? 'casa' : 'fuera') + ') · Nivel ' + rival.rating + ' ' + peligro +
      (jefe ? ' · <span class="boss-hint">botín de rareza alta garantizado</span>' : '');
    $('#mg-next-rival').classList.toggle('es-jefe', !!jefe);

    renderLineup();
    renderShop();
    renderStaff();
    renderLeague();

    var completo = State.onceCompleto();
    $('#btn-play-match').disabled = !completo;
    $('#btn-play-match').textContent = completo ? 'JUGAR PARTIDO ▶' : 'ALINEA 11 JUGADORES';
    showScreen('screen-manage');
  }

  // ----- alineación (click-to-swap) -----
  var SLOT_COORDS = [
    [50, 88],                                   // POR
    [14, 68], [38, 73], [62, 73], [86, 68],     // DEF
    [25, 47], [50, 53], [75, 47],               // MED
    [20, 24], [50, 17], [80, 24]                // DEL
  ];

  function renderLineup() {
    var run = State.run;
    var pitch = $('#pitch-mini');
    pitch.innerHTML = '<div class="pitch-lines"></div>';

    State.SLOT_POS.forEach(function (pos, i) {
      var slot = el('div', 'pitch-slot');
      slot.style.left = SLOT_COORDS[i][0] + '%';
      slot.style.top = SLOT_COORDS[i][1] + '%';
      var carta = State.cartaPorId(run.alineacion[i]);
      if (carta) {
        slot.classList.add('ocupado', 'rarity-' + carta.rareza);
        slot.innerHTML = '<img class="pixel-sprite slot-sprite" src="' + Sprite.avatar(carta) + '" alt="">' +
          '<span class="slot-media">' + carta.media + '</span>' +
          '<span class="slot-name">' + carta.nombre.split(' ')[1] + '</span>';
        slot.title = carta.nombre + ' (' + pos + ') — clic para retirar del once';
      } else {
        slot.innerHTML = '<span class="slot-pos-empty">' + pos + '</span>';
      }
      if (seleccionBanquillo) {
        var sel = State.cartaPorId(seleccionBanquillo);
        if (sel && sel.pos === pos) slot.classList.add('destino-valido');
      }
      slot.onclick = function () {
        AudioFX.click();
        if (seleccionBanquillo) {
          var sel2 = State.cartaPorId(seleccionBanquillo);
          if (sel2 && sel2.pos === pos) {
            State.asignarSlot(i, seleccionBanquillo);
            seleccionBanquillo = null;
            renderManage();
          } else {
            toast('Esa carta no juega de ' + pos, 'error');
          }
        } else if (carta) {
          State.quitarSlot(i);
          renderManage();
        }
      };
      pitch.appendChild(slot);
    });

    // sinergias
    var sins = Synergy.evaluar(State.onceActual());
    var sp = $('#synergy-panel');
    sp.innerHTML = '<h4 class="panel-title">✨ Sinergias</h4>';
    sins.forEach(function (s) {
      var activa = s.activos.length > 0;
      var fila = el('div', 'synergy-row' + (activa ? ' activa' : ''));
      var detalle = activa
        ? s.activos[s.activos.length - 1].desc
        : (s.siguiente ? 'Alinea ' + s.siguiente.n + ' (' + s.count + '/' + s.siguiente.n + ')' : '');
      fila.innerHTML = '<span class="syn-tag">' + s.icono + ' ' + s.tag + ' <b>×' + s.count + '</b></span>' +
        '<span class="syn-desc">' + detalle + '</span>';
      sp.appendChild(fila);
    });

    // banquillo / plantilla
    var bench = $('#bench-list');
    bench.innerHTML = '';
    $('#squad-count').textContent = '(' + State.run.plantilla.length + '/' + State.MAX_PLANTILLA + ')';
    run.plantilla.forEach(function (c) {
      var wrap = el('div', 'bench-item');
      var d = cartaDOM(c, { mini: true });
      if (State.enOnce(c.id)) d.classList.add('en-once');
      if (seleccionBanquillo === c.id) d.classList.add('seleccionada');
      d.onclick = function () {
        AudioFX.click();
        if (c.lesion > 0) { toast('🚑 ' + c.nombre + ' está lesionado (' + c.lesion + ' jornadas)', 'error'); return; }
        seleccionBanquillo = seleccionBanquillo === c.id ? null : c.id;
        renderManage();
      };
      wrap.appendChild(d);
      var btnVender = el('button', 'btn btn-tiny btn-sell', 'Vender ~' + Economy.precioVenta(c) + ' 💰');
      btnVender.onclick = function (ev) {
        ev.stopPropagation();
        AudioFX.click();
        iniciarVenta(c);
      };
      wrap.appendChild(btnVender);
      bench.appendChild(wrap);
    });
  }

  // ----- tienda -----
  function renderShop() {
    var run = State.run;
    var stock = Economy.tiendaActual();
    var cont = $('#shop-cards');
    cont.innerHTML = '';
    var gratis = State.tieneStaff('economista') && !run.economistaUsado;
    $('#btn-reroll').textContent = gratis ? '🎲 Reroll (GRATIS)' : '🎲 Reroll (' + run.rerollCost + ' 💰)';

    var items = stock.cartas.slice();
    if (stock.staff) items.push(stock.staff);
    items.forEach(function (c, idx) {
      var wrap = el('div', 'shop-item');
      var d = cartaDOM(c);
      wrap.appendChild(d);
      if (stock.vendidos[idx]) {
        wrap.classList.add('vendido');
        wrap.appendChild(el('div', 'sold-stamp', 'ADQUIRIDO'));
      } else {
        var precio = c.valorBase;
        var btn = el('button', 'btn btn-buy', 'Negociar · ~' + precio + ' 💰');
        btn.onclick = function () {
          AudioFX.click();
          if (c.type === 'staff' && run.staff.length >= State.MAX_STAFF) {
            toast('Ya tienes 3 cartas de staff. Despide a alguien primero.', 'error'); return;
          }
          if (c.type === 'player' && run.plantilla.length >= State.MAX_PLANTILLA) {
            toast('Plantilla llena (15). Vende antes de comprar.', 'error'); return;
          }
          iniciarCompra(c, idx);
        };
        wrap.appendChild(btn);
      }
      cont.appendChild(wrap);
    });
  }

  // ----- staff -----
  function renderStaff() {
    var run = State.run;
    var cont = $('#staff-list');
    cont.innerHTML = '';
    run.staff.forEach(function (s) {
      var wrap = el('div', 'shop-item');
      wrap.appendChild(cartaDOM(s));
      var btn = el('button', 'btn btn-tiny btn-sell', 'Despedir');
      btn.onclick = function () {
        confirmar('¿Despedir a tu <b>' + s.nombre + '</b>? No recuperas oro.', function () {
          State.quitarStaff(s.id);
          toast(s.nombre + ' despedido');
          renderManage();
        });
      };
      wrap.appendChild(btn);
      cont.appendChild(wrap);
    });
    for (var i = run.staff.length; i < State.MAX_STAFF; i++) {
      cont.appendChild(el('div', 'staff-slot-empty', '<span>Slot de staff libre</span>'));
    }
  }

  // ----- liga -----
  function renderLeague() {
    var run = State.run;
    var tabla = League.clasificacion();
    var html = '<tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>PTS</th></tr>';
    tabla.forEach(function (e, i) {
      html += '<tr class="' + (e.esJugador ? 'fila-jugador' : '') + (i < 4 ? ' top4' : '') + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td><span class="dot" style="background:' + colorHex(e.color) + '"></span>' + e.nombre + (e.esJugador ? ' ★' : '') + '</td>' +
        '<td>' + e.pj + '</td><td>' + e.pg + '</td><td>' + e.pe + '</td><td>' + e.pp + '</td>' +
        '<td>' + e.gf + '</td><td>' + e.gc + '</td><td><b>' + e.pts + '</b></td></tr>';
    });
    $('#league-table').innerHTML = html;

    var cal = $('#calendar');
    cal.innerHTML = '';
    run.calendario.forEach(function (ronda, j) {
      var jn = j + 1;
      var p = ronda.filter(function (x) { return x[0] === 0 || x[1] === 0; })[0];
      var esLocal = p[0] === 0;
      var rival = run.equipos[esLocal ? p[1] : p[0]];
      var jefe = State.etiquetaJefe(jn);
      var res = '';
      if (jn < run.jornada && run.resultados[j]) {
        var r = run.resultados[j].filter(function (x) { return x.jugador; })[0];
        if (r) {
          var gfj = r.h === 0 ? r.gh : r.ga, gcj = r.h === 0 ? r.ga : r.gh;
          var cls = gfj > gcj ? 'res-v' : gfj < gcj ? 'res-d' : 'res-e';
          res = '<span class="' + cls + '">' + gfj + '-' + gcj + '</span>';
        }
      }
      var fila = el('div', 'cal-row' + (jn === run.jornada ? ' cal-actual' : '') + (jefe ? ' cal-jefe' : ''));
      fila.innerHTML = '<span class="cal-j">J' + jn + '</span>' +
        '<span class="cal-rival">' + (esLocal ? 'vs ' : '@ ') + rival.nombre + '</span>' +
        (jefe ? '<span class="cal-boss">' + jefe.split(' ')[0] + '</span>' : '') +
        '<span class="cal-res">' + res + '</span>';
      cal.appendChild(fila);
    });
  }

  // ---------- negociación ----------
  var negoCtx = null; // {modo, carta, shopIdx, onFin}

  function frasesIA(modo) {
    return modo === 'compra'
      ? ['Ese jugador vale mucho más, míster.', 'Mmm... vas a tener que subir.', 'Por ese precio no se levanta ni del sofá.', 'Te estás acercando...', 'Casi. Un empujoncito más.']
      : ['No pagamos tanto por ese perfil.', 'Nuestro presupuesto no da para eso.', 'Baja un poco y hablamos.', 'Interesante, pero es caro.', 'Estamos cerca del acuerdo...'];
  }

  function abrirNego(titulo, carta, min, max, inicial) {
    $('#nego-title').textContent = titulo;
    var prev = $('#nego-card-preview');
    prev.innerHTML = '';
    prev.appendChild(cartaDOM(carta, { mini: true }));
    $('#nego-log').innerHTML = '';
    $('#nego-rounds').innerHTML = '';
    var slider = $('#nego-slider');
    slider.min = min; slider.max = max; slider.value = inicial;
    $('#nego-offer-value').textContent = '💰 ' + inicial;
    slider.oninput = function () { $('#nego-offer-value').textContent = '💰 ' + slider.value; };
    $('#nego-btn-accept').classList.add('hidden');
    $('#nego-btn-offer').disabled = false;
    $('#nego-modal').classList.remove('hidden');
  }

  function negoLog(quien, texto) {
    var log = $('#nego-log');
    var linea = el('div', 'nego-line ' + quien, texto);
    log.appendChild(linea);
    log.scrollTop = log.scrollHeight;
  }

  function negoRondas() {
    var s = Nego.actual();
    if (!s) return;
    $('#nego-rounds').textContent = 'Ronda ' + s.ronda + ' · la paciencia del ' + (s.modo === 'compra' ? 'vendedor' : 'comprador') + ' es limitada…';
  }

  function cerrarNego() {
    $('#nego-modal').classList.add('hidden');
    Nego.retirarse();
    negoCtx = null;
  }

  function iniciarCompra(carta, shopIdx) {
    var run = State.run;
    var base = carta.valorBase;
    Nego.iniciar('compra', carta, base);
    negoCtx = { modo: 'compra', carta: carta, shopIdx: shopIdx };
    abrirNego('Fichar a ' + (carta.nombre || carta.key), carta,
      Math.round(base * 0.4), Math.round(base * 1.5), Math.round(base * 0.75));
    negoLog('ia', 'Vendedor: «Pedimos unos ' + Math.round(base * 1.15) + ' 💰 por esta carta. Escucho ofertas.»');
  }

  function iniciarVenta(carta) {
    // evita el soft-lock: no se puede vender si dejaría la posición sin cubrir
    var REQ = { POR: 1, DEF: 4, MED: 3, DEL: 3 };
    var mismos = State.run.plantilla.filter(function (c) { return c.pos === carta.pos; }).length;
    if (mismos <= REQ[carta.pos]) {
      toast('No puedes venderlo: necesitas al menos ' + REQ[carta.pos] + ' ' + carta.pos + ' en plantilla', 'error');
      AudioFX.error();
      return;
    }
    var base = Economy.precioVenta(carta);
    Nego.iniciar('venta', carta, base);
    negoCtx = { modo: 'venta', carta: carta };
    abrirNego('Vender a ' + carta.nombre, carta,
      Math.round(base * 0.5), Math.round(base * 1.9), Math.round(base * 1.2));
    negoLog('ia', 'Comprador: «Nos interesa. Ofrecemos unos ' + Math.round(base * 0.8) + ' 💰. ¿Qué pides?»');
  }

  function cerrarTratoCompra(precio) {
    var run = State.run;
    if (run.oro < precio) { toast('No tienes suficiente oro', 'error'); AudioFX.error(); return false; }
    run.oro -= precio;
    run.stats.oroGastado += precio;
    run.stats.cartasCompradas++;
    State.agregarCarta(negoCtx.carta);
    var stock = Economy.tiendaActual();
    if (negoCtx.shopIdx !== undefined) stock.vendidos[negoCtx.shopIdx] = true;
    AudioFX.buy();
    toast('✅ Fichado por ' + precio + ' 💰');
    return true;
  }

  function cerrarTratoVenta(precio) {
    var run = State.run;
    run.oro += precio;
    run.stats.oroGanado += precio;
    run.stats.cartasVendidas++;
    State.quitarCarta(negoCtx.carta.id);
    AudioFX.sell();
    toast('✅ Vendido por ' + precio + ' 💰');
    return true;
  }

  function resolverTrato(precio) {
    var ok = negoCtx.modo === 'compra' ? cerrarTratoCompra(precio) : cerrarTratoVenta(precio);
    if (ok) {
      cerrarNego();
      renderManage();
    }
  }

  function wireNego() {
    $('#nego-btn-offer').onclick = function () {
      if (!negoCtx) return;
      AudioFX.click();
      var oferta = parseInt($('#nego-slider').value, 10);
      if (negoCtx.modo === 'compra' && oferta > State.run.oro) {
        toast('Solo tienes ' + State.run.oro + ' 💰', 'error'); AudioFX.error(); return;
      }
      negoLog('yo', 'Tú: «Ofrezco ' + oferta + ' 💰.»');
      $('#nego-btn-offer').disabled = true;
      setTimeout(function () {
        if (!negoCtx) return;
        var r = Nego.ofertar(oferta);
        negoRondas();
        $('#nego-btn-offer').disabled = false;
        if (r.estado === 'aceptada') {
          negoLog('ia', '🤝 «¡Trato hecho!»');
          setTimeout(function () { resolverTrato(r.precio); }, 500);
        } else if (r.estado === 'contraoferta') {
          negoLog('ia', RNG.pick(frasesIA(negoCtx.modo)) + ' «¿Qué tal ' + r.contraoferta + ' 💰?»');
          var btn = $('#nego-btn-accept');
          btn.textContent = 'Aceptar ' + r.contraoferta + ' 💰';
          btn.classList.remove('hidden');
        } else if (r.estado === 'ultimatum') {
          negoLog('ia', '⚠️ «Última palabra: ' + r.contraoferta + ' 💰. Lo tomas o lo dejas.»');
          $('#nego-btn-offer').disabled = true;
          var btn2 = $('#nego-btn-accept');
          btn2.textContent = 'Aceptar ' + r.contraoferta + ' 💰';
          btn2.classList.remove('hidden');
        } else {
          negoLog('ia', '❌ «Se acabó la charla. No hay trato.»');
          AudioFX.error();
          setTimeout(function () { cerrarNego(); renderManage(); }, 900);
        }
      }, 550 + Math.random() * 450);
    };

    $('#nego-btn-accept').onclick = function () {
      if (!negoCtx) return;
      AudioFX.click();
      var precio = Nego.aceptarContraoferta();
      if (precio !== null) resolverTrato(precio);
    };

    $('#nego-btn-walk').onclick = function () {
      AudioFX.click();
      cerrarNego();
      renderManage();
    };
  }

  // ---------- post-partido ----------
  // resumen: {gf, gc, resultado, rival, esJefe, oroTotal, detalles, otros, lesion, drop}
  function renderPost(resumen, onContinue) {
    var run = State.run;
    var titulo = resumen.resultado === 'V' ? '🏆 ¡VICTORIA!' : resumen.resultado === 'E' ? '🤝 EMPATE' : '💔 DERROTA';
    $('#post-result-title').textContent = titulo;
    $('#post-result-title').className = 'post-' + resumen.resultado;
    $('#post-score').innerHTML =
      run.equipos[0].nombre + ' <b class="marcador">' + resumen.gf + ' - ' + resumen.gc + '</b> ' + resumen.rival.nombre +
      (resumen.esJefe ? ' <span class="boss-label">PARTIDO JEFE</span>' : '');

    // desglose de oro con contador animado
    var pg = $('#post-gold');
    pg.innerHTML = resumen.detalles.map(function (d) {
      return '<div class="gold-line">' + d.txt + ' <b>+' + d.oro + ' 💰</b></div>';
    }).join('') + (resumen.lesion ? '<div class="gold-line lesion-line">🚑 ' + resumen.lesion.carta.nombre +
      ' se ha lesionado (' + resumen.lesion.dur + ' jornadas)</div>' : '');
    var total = el('div', 'gold-total', 'Total: <b id="gold-counter">+0 💰</b>');
    pg.appendChild(total);
    animarContador($('#gold-counter'), resumen.oroTotal);

    // otros resultados
    $('#post-other-results').innerHTML = '<h4>Resto de la jornada</h4>' + resumen.otros.map(function (r) {
      return '<div class="other-res">' + run.equipos[r.h].nombre + ' <b>' + r.gh + '-' + r.ga + '</b> ' + run.equipos[r.a].nombre + '</div>';
    }).join('');

    // drop de cartas con reveal
    var dc = $('#drop-cards');
    dc.innerHTML = '';
    $('#btn-post-continue').classList.add('hidden');
    var elegido = false;

    if (!resumen.drop.length) {
      $('#post-drop-title').textContent = 'Sin botín esta vez.';
      mostrarContinuar();
    } else {
      $('#post-drop-title').textContent = '🎁 Elige tu recompensa';
    }

    function mostrarContinuar() {
      var btn = $('#btn-post-continue');
      btn.classList.remove('hidden');
      btn.onclick = function () { AudioFX.click(); onContinue(); };
    }

    resumen.drop.forEach(function (c, i) {
      var flip = el('div', 'flip-card');
      var inner = el('div', 'flip-inner');
      var back = el('div', 'flip-back', '<span>?</span>');
      var front = el('div', 'flip-front');
      front.appendChild(cartaDOM(c));

      var acciones = el('div', 'drop-actions');
      var btnKeep = el('button', 'btn btn-tiny btn-gold', c.type === 'staff' ? 'Contratar' : 'Quedármela');
      var btnSell = el('button', 'btn btn-tiny', 'Venta rápida +' + Economy.precioVenta(c) + ' 💰');
      btnKeep.onclick = function () {
        if (elegido) return;
        if (c.type === 'staff' && run.staff.length >= State.MAX_STAFF) { toast('Staff completo (3)', 'error'); return; }
        if (c.type === 'player' && run.plantilla.length >= State.MAX_PLANTILLA) { toast('Plantilla llena (15): usa venta rápida o pasa', 'error'); return; }
        elegido = true;
        State.agregarCarta(c);
        AudioFX.buy();
        toast('✅ ' + (c.nombre || '') + ' se une al club');
        finalizarEleccion(flip);
      };
      btnSell.onclick = function () {
        if (elegido) return;
        elegido = true;
        var oro = Economy.precioVenta(c);
        run.oro += oro;
        run.stats.oroGanado += oro;
        AudioFX.sell();
        toast('+' + oro + ' 💰 por venta rápida');
        finalizarEleccion(flip);
      };
      acciones.appendChild(btnKeep);
      acciones.appendChild(btnSell);
      front.appendChild(acciones);

      inner.appendChild(back);
      inner.appendChild(front);
      flip.appendChild(inner);
      dc.appendChild(flip);

      // reveal escalonado
      setTimeout(function () {
        flip.classList.add('flipped');
        AudioFX.flip();
        setTimeout(function () { AudioFX.reveal(c.rareza); }, 300);
      }, 500 + i * 450);
    });

    function finalizarEleccion(flipElegido) {
      $$('#drop-cards .flip-card').forEach(function (f) {
        if (f !== flipElegido) f.classList.add('descartada');
        else f.classList.add('elegida');
      });
      $('#post-drop-title').textContent = 'Recompensa asegurada';
      mostrarContinuar();
    }

    if (resumen.drop.length) {
      // opción de pasar del drop
      var pasar = el('button', 'btn btn-ghost btn-small drop-skip', 'No quiero ninguna');
      pasar.onclick = function () {
        if (elegido) return;
        elegido = true;
        AudioFX.click();
        finalizarEleccion(null);
      };
      dc.appendChild(pasar);
    }

    showScreen('screen-post');
  }

  function animarContador(elem, hasta) {
    var v = 0;
    var paso = Math.max(1, Math.round(hasta / 40));
    var iv = setInterval(function () {
      v = Math.min(hasta, v + paso);
      elem.textContent = '+' + v + ' 💰';
      if (v >= hasta) clearInterval(iv);
    }, 30);
  }

  // ---------- fin de run ----------
  function renderEnd(fin) {
    var run = State.run;
    var s = run.stats;
    $('#end-title').textContent = fin.victoria ? '👑 ¡CAMPEÓN!' : '💀 RUN TERMINADA';
    $('#end-title').className = fin.victoria ? 'end-win' : 'end-lose';
    $('#end-reason').textContent = fin.razon;

    var goleador = null, maxG = 0;
    Object.keys(s.mejorGoleador).forEach(function (n) {
      if (s.mejorGoleador[n] > maxG) { maxG = s.mejorGoleador[n]; goleador = n; }
    });

    var filas = [
      ['Puesto final', fin.puesto + 'º de 8'],
      ['Balance', s.pg + 'G · ' + s.pe + 'E · ' + s.pp + 'P'],
      ['Goles', s.gf + ' a favor / ' + s.gc + ' en contra'],
      ['Oro ganado', s.oroGanado + ' 💰'],
      ['Oro gastado', s.oroGastado + ' 💰'],
      ['Fichajes / ventas', s.cartasCompradas + ' / ' + s.cartasVendidas],
      ['Partidos jefe ganados', s.jefesGanados],
      ['Máximo goleador', goleador ? goleador + ' (' + maxG + ')' : '—']
    ];
    $('#end-stats').innerHTML = filas.map(function (f) {
      return '<div class="end-stat"><span>' + f[0] + '</span><b>' + f[1] + '</b></div>';
    }).join('');

    if (fin.victoria) AudioFX.victoria(); else AudioFX.derrota();
    showScreen('screen-end');
  }

  // ---------- tabs ----------
  function wireTabs() {
    $$('.tab').forEach(function (t) {
      t.onclick = function () {
        AudioFX.click();
        $$('.tab').forEach(function (x) { x.classList.remove('active'); });
        $$('.tab-panel').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        $('#' + t.dataset.tab).classList.add('active');
        $('.manage-body').scrollTop = 0;
      };
    });
  }

  function init() {
    wireTabs();
    wireNego();
  }

  return {
    $: $,
    init: init,
    showScreen: showScreen,
    toast: toast,
    confirmar: confirmar,
    cartaDOM: cartaDOM,
    colorHex: colorHex,
    renderMenu: renderMenu,
    renderManage: renderManage,
    renderPost: renderPost,
    renderEnd: renderEnd,
    resetSeleccion: function () { seleccionBanquillo = null; }
  };
})();
