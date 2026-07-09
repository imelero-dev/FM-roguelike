/* ============================================================
   UI — renderizado DOM: pantallas, cartas, ficha de jugador,
   táctica con scouting, tienda, liga, negociación y post-partido.
   ============================================================ */

var UI = (function () {

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var seleccionBanquillo = null;

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

  function colorLegible(color) {
    var r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    if (r * 0.299 + g * 0.587 + b * 0.114 < 90) {
      r = Math.min(255, r + 110); g = Math.min(255, g + 110); b = Math.min(255, b + 110);
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function notaClase(n) {
    return n >= 7.5 ? 'nota-alta' : n >= 6.3 ? 'nota-media' : 'nota-baja';
  }

  function condicionColor(c) {
    return c >= 85 ? 'var(--green)' : c >= 65 ? 'var(--gold)' : 'var(--red)';
  }

  function formaIcono(f) {
    if (f >= 1) return '<span class="forma-up">▲</span>';
    if (f <= -1) return '<span class="forma-down">▼</span>';
    return '<span class="forma-flat">▬</span>';
  }

  // ---------- render de cartas ----------
  function statsHTML(c) {
    var barClase = { 0: 'atq', 1: 'def', 2: 'pas', 3: 'vel' };
    return '<div class="card-stats">' + Attrs.resumen(c).map(function (b, i) {
      var pct = Math.round(b.val / 99 * 100);
      return '<div class="stat-row"><span class="stat-label">' + b.label + '</span>' +
        '<span class="stat-bar bar-' + barClase[i] + '"><i style="width:' + pct + '%"></i></span>' +
        '<b class="stat-val">' + b.val + '</b></div>';
    }).join('') + '</div>';
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

  function estadoHTML(c) {
    // condición + forma en el pie de la carta
    return '<div class="card-estado">' +
      '<span class="cond-wrap" title="Condición física"><i class="cond-bar" style="width:' + c.condicion + '%; background:' + condicionColor(c.condicion) + '"></i></span>' +
      '<span class="cond-num">' + c.condicion + '%</span>' +
      formaIcono(c.forma) +
      '</div>';
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
      d = el('div', 'card rarity-' + c.rareza + (c.lesion > 0 ? ' lesionado' : '') + (c.sancion > 0 ? ' sancionado' : ''));
      d.innerHTML =
        '<div class="card-top"><span class="card-pos pos-' + c.pos + '">' + c.pos + '</span>' +
        '<button class="btn-ficha" title="Ver ficha completa">🔍</button>' +
        '<span class="card-media">' + c.media + '</span></div>' +
        retrato +
        '<div class="card-name">' + c.nombre + '</div>' +
        '<div class="card-tag">' + tagIcono(c.tag) + ' · ' + c.edad + ' años</div>' +
        statsHTML(c) + habsHTML(c) +
        estadoHTML(c) +
        '<div class="card-footer"><span class="rareza-label">' + Gen.RAREZAS[c.rareza].nombre + '</span>' +
        '<span>💰 ' + c.salario + '/j</span></div>' +
        (c.lesion > 0 ? '<div class="lesion-badge">🚑 ' + c.lesion + ' j.</div>' : '') +
        (c.sancion > 0 ? '<div class="lesion-badge sancion-badge">🟥 ' + c.sancion + ' j.</div>' : '');
      var lupa = d.querySelector('.btn-ficha');
      lupa.onclick = function (ev) {
        ev.stopPropagation();
        AudioFX.click();
        showFicha(c);
      };
    }
    d.dataset.id = c.id;
    if (opciones.mini) d.classList.add('card-mini');
    d.addEventListener('mouseenter', function () { AudioFX.hover(); });
    return d;
  }

  // ---------- ficha de jugador (33 atributos) ----------
  function showFicha(c) {
    var cont = $('#ficha-content');
    var mediaTemp = c.temporada.pj > 0 ? (c.temporada.ratingTotal / c.temporada.pj).toFixed(1) : '—';

    var html =
      '<div class="ficha-head">' +
      '<img class="pixel-sprite ficha-sprite" src="' + Sprite.avatar(c) + '" alt="">' +
      '<div class="ficha-id">' +
      '<div class="ficha-nombre">' + c.nombre + '</div>' +
      '<div class="ficha-sub"><span class="card-pos pos-' + c.pos + '">' + c.pos + '</span> ' +
      tagIcono(c.tag) + ' · ' + c.edad + ' años · <span class="rareza-label rarity-' + c.rareza + '-txt">' + Gen.RAREZAS[c.rareza].nombre + '</span></div>' +
      '<div class="ficha-sub">💰 ' + c.salario + '/jornada · Valor ~' + c.valorBase + ' 💰</div>' +
      estadoHTML(c) +
      '</div>' +
      '<div class="ficha-media">' + c.media + '</div>' +
      '</div>';

    html += habsHTML(c);

    // grupos de atributos: portero primero si es POR
    var grupos = Attrs.GRUPOS.slice();
    if (c.pos === 'POR') grupos = [grupos[3], grupos[1], grupos[2], grupos[0]];
    html += '<div class="ficha-grid">';
    grupos.forEach(function (g) {
      // no ensucia la ficha de un jugador de campo con la portería
      if (c.pos !== 'POR' && g.key === 'portero') return;
      html += '<div class="ficha-grupo"><h5>' + g.nombre + '</h5>';
      g.attrs.forEach(function (a) {
        var v = c.attrs[a];
        html += '<div class="attr-row"><span>' + Attrs.NOMBRES[a] + '</span>' +
          '<span class="attr-mini-bar"><i class="' + Attrs.colorAttr(v) + '-bg" style="width:' + (v / 20 * 100) + '%"></i></span>' +
          '<b class="attr-val ' + Attrs.colorAttr(v) + '">' + v + '</b></div>';
      });
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="ficha-temporada">' +
      '<span>PJ <b>' + c.temporada.pj + '</b></span>' +
      '<span>⚽ <b>' + c.temporada.goles + '</b></span>' +
      '<span>🅰️ <b>' + c.temporada.asistencias + '</b></span>' +
      '<span>Nota media <b>' + mediaTemp + '</b></span>' +
      '</div>';

    cont.innerHTML = html;
    $('#ficha-modal').classList.remove('hidden');
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
    var mEmoji = run.moral >= 80 ? '😄' : run.moral >= 60 ? '🙂' : run.moral >= 45 ? '😐' : '😟';
    $('#mg-moral').textContent = mEmoji + ' ' + run.moral;

    var peligro = rival.rating >= 68 ? '🔴' : rival.rating >= 58 ? '🟠' : '🟢';
    $('#mg-next-rival').innerHTML =
      (jefe ? '<span class="boss-label">' + jefe + '</span> ' : '') +
      'Próximo rival: <b style="color:' + colorLegible(rival.color) + '">' + rival.nombre + '</b> ' +
      '(' + (p.esLocal ? 'casa' : 'fuera') + ') · Nivel ' + rival.rating + ' ' + peligro +
      ' · Juega en <b>' + rival.tactica.formacion + '</b> — informe completo en 📋 Táctica' +
      (jefe ? ' · <span class="boss-hint">botín de rareza alta garantizado</span>' : '');
    $('#mg-next-rival').classList.toggle('es-jefe', !!jefe);

    renderLineup();
    renderTactics();
    renderShop();
    renderStaff();
    renderLeague();

    var completo = State.onceCompleto();
    $('#btn-play-match').disabled = !completo;
    $('#btn-play-match').textContent = completo ? 'JUGAR PARTIDO ▶' : 'ALINEA 11 JUGADORES';
    showScreen('screen-manage');
  }

  // ----- alineación (click-to-swap sobre la formación actual) -----
  function coordsSlot(sl) {
    // el campo se pinta en vertical: ataque hacia arriba
    var top = 92 - sl.x * 118;
    var left = 8 + sl.y * 84;
    return { top: Math.max(8, Math.min(90, top)), left: left };
  }

  function renderLineup() {
    var run = State.run;
    var pitch = $('#pitch-mini');
    pitch.innerHTML = '<div class="pitch-lines"></div>';
    var slots = State.slotsActuales();

    $('#pitch-formacion').textContent = run.tactica.formacion;
    var coh = State.cohesionActual();
    $('#pitch-cohesion').innerHTML = 'Cohesión <span class="coh-bar"><i style="width:' + coh + '%"></i></span> ' + coh + '%';

    slots.forEach(function (sl, i) {
      var slot = el('div', 'pitch-slot');
      var co = coordsSlot(sl);
      slot.style.left = co.left + '%';
      slot.style.top = co.top + '%';
      var carta = State.cartaPorId(run.alineacion[i]);
      if (carta) {
        slot.classList.add('ocupado', 'rarity-' + carta.rareza);
        slot.innerHTML = '<img class="pixel-sprite slot-sprite" src="' + Sprite.avatar(carta) + '" alt="">' +
          '<span class="slot-media">' + carta.media + '</span>' +
          '<span class="slot-name">' + carta.nombre.split(' ')[1] + '</span>';
        slot.title = carta.nombre + ' (' + sl.rol + ') — clic para retirar del once';
      } else {
        slot.innerHTML = '<span class="slot-pos-empty">' + sl.pos + '</span><span class="slot-rol">' + sl.rol + '</span>';
      }
      if (seleccionBanquillo) {
        var sel = State.cartaPorId(seleccionBanquillo);
        if (sel && sel.pos === sl.pos) slot.classList.add('destino-valido');
      }
      slot.onclick = function () {
        AudioFX.click();
        if (seleccionBanquillo) {
          var sel2 = State.cartaPorId(seleccionBanquillo);
          if (sel2 && sel2.pos === sl.pos) {
            State.asignarSlot(i, seleccionBanquillo);
            seleccionBanquillo = null;
            renderManage();
          } else {
            toast('Esa carta no juega de ' + sl.pos, 'error');
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
        if (c.sancion > 0) { toast('🟥 ' + c.nombre + ' está sancionado (' + c.sancion + ' jornadas)', 'error'); return; }
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

  // ----- táctica -----
  function miniPitchHTML(formKey) {
    var slots = Formations.DEFS[formKey].slots;
    return '<div class="mini-pitch">' + slots.map(function (sl) {
      var left = 6 + sl.y * 88;
      var top = 90 - sl.x * 120;
      return '<i class="mp-dot mp-' + sl.pos + '" style="left:' + left + '%; top:' + Math.max(6, top) + '%"></i>';
    }).join('') + '</div>';
  }

  function renderTactics() {
    var run = State.run;
    var tac = run.tactica;

    // rejilla de formaciones
    var grid = $('#formation-grid');
    grid.innerHTML = '';
    Formations.LISTA.forEach(function (key) {
      var def = Formations.DEFS[key];
      var puede = State.puedeFormacion(key);
      var coh = run.cohesion[key] || 0;
      var card = el('div', 'formation-card' + (key === tac.formacion ? ' activa' : '') + (puede ? '' : ' bloqueada'));
      var req = Formations.req(key);
      card.innerHTML =
        '<div class="fc-nombre">' + def.nombre + '</div>' +
        miniPitchHTML(key) +
        '<div class="fc-req">' + req.DEF + ' DEF · ' + req.MED + ' MED · ' + req.DEL + ' DEL</div>' +
        '<div class="fc-coh"><span class="coh-bar"><i style="width:' + coh + '%"></i></span> ' + coh + '%</div>' +
        (puede ? '' : '<div class="fc-lock">Sin efectivos</div>');
      card.title = def.desc;
      card.onclick = function () {
        if (!puede) { toast('No tienes jugadores disponibles para el ' + key, 'error'); AudioFX.error(); return; }
        if (key === tac.formacion) return;
        AudioFX.click();
        State.cambiarFormacion(key);
        seleccionBanquillo = null;
        State.autoAlinear();
        renderManage();
        $('.tab[data-tab="tab-tactics"]').click();
        toast('Formación cambiada a ' + key + '. La cohesión crece jugando con ella.');
      };
      grid.appendChild(card);
    });

    // selectores de instrucciones
    function seg(contId, descId, opciones, actual, aplicar) {
      var cont = $('#' + contId);
      cont.innerHTML = '';
      var descActual = '';
      opciones.forEach(function (o) {
        var btn = el('button', 'btn btn-small seg-btn' + (o.v === actual ? ' active' : ''), o.nombre);
        if (o.v === actual) descActual = o.desc;
        btn.onclick = function () {
          AudioFX.click();
          aplicar(o.v);
          renderTactics();
        };
        cont.appendChild(btn);
      });
      $('#' + descId).textContent = descActual;
    }
    seg('sel-mentalidad', 'desc-mentalidad', Formations.MENTALIDADES, tac.mentalidad, function (v) { tac.mentalidad = v; });
    seg('sel-presion', 'desc-presion', Formations.PRESIONES, tac.presion, function (v) { tac.presion = v; });
    seg('sel-estilo', 'desc-estilo', Formations.ESTILOS, tac.estilo, function (v) { tac.estilo = v; });
    seg('sel-amplitud', 'desc-amplitud', Formations.AMPLITUDES, tac.amplitud, function (v) { tac.amplitud = v; });

    // scouting del rival
    var rival = State.rivalActual();
    var jefe = State.etiquetaJefe(run.jornada);
    var consejos = Formations.consejos(tac.formacion, rival.tactica);
    var estrellas = rival.rating >= 68 ? '★★★★★' : rival.rating >= 62 ? '★★★★' : rival.rating >= 56 ? '★★★' : rival.rating >= 50 ? '★★' : '★';
    $('#scout-panel').innerHTML =
      '<div class="scout-head">' +
      '<span class="dot" style="background:' + colorHex(rival.color) + '"></span>' +
      '<b style="color:' + colorLegible(rival.color) + '">' + rival.nombre + '</b>' +
      (jefe ? ' <span class="boss-label">' + jefe + '</span>' : '') +
      '</div>' +
      '<div class="scout-row">Nivel <b>' + rival.rating + '</b> <span class="scout-stars">' + estrellas + '</span></div>' +
      '<div class="scout-row">Plan de partido: <b>' + Formations.etiquetaTactica(rival.tactica) + '</b></div>' +
      miniPitchHTML(rival.tactica.formacion) +
      (rival.estrella ? '<div class="scout-row">⭐ Peligro: <b>' + rival.estrella + '</b></div>' : '') +
      '<h5 class="scout-consejos-t">Informe del ojeador</h5>' +
      '<ul class="scout-consejos">' + consejos.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul>';
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
            toast('Plantilla llena (' + State.MAX_PLANTILLA + '). Vende antes de comprar.', 'error'); return;
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

    // pichichi
    var goleadores = League.pichichi(6);
    var ph = '<tr><th>#</th><th>Jugador</th><th>Equipo</th><th>⚽</th></tr>';
    if (!goleadores.length) ph += '<tr><td colspan="4" class="muted">Aún no hay goles</td></tr>';
    goleadores.forEach(function (g, i) {
      var esMio = g.equipo.esJugador;
      ph += '<tr class="' + (esMio ? 'fila-jugador' : '') + '"><td>' + (i + 1) + '</td>' +
        '<td>' + g.nombre + (esMio ? ' ★' : '') + '</td>' +
        '<td><span class="dot" style="background:' + colorHex(g.equipo.color) + '"></span>' + g.equipo.nombre + '</td>' +
        '<td><b>' + g.goles + '</b></td></tr>';
    });
    $('#pichichi-table').innerHTML = ph;

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
        '<span class="cal-rival">' + (esLocal ? 'vs ' : '@ ') + rival.nombre + ' <span class="muted">(' + rival.tactica.formacion + ')</span></span>' +
        (jefe ? '<span class="cal-boss">' + jefe.split(' ')[0] + '</span>' : '') +
        '<span class="cal-res">' + res + '</span>';
      cal.appendChild(fila);
    });
  }

  // ---------- negociación ----------
  var negoCtx = null;

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
    var base = carta.valorBase;
    Nego.iniciar('compra', carta, base);
    negoCtx = { modo: 'compra', carta: carta, shopIdx: shopIdx };
    abrirNego('Fichar a ' + (carta.nombre || carta.key), carta,
      Math.round(base * 0.4), Math.round(base * 1.5), Math.round(base * 0.75));
    negoLog('ia', 'Vendedor: «Pedimos unos ' + Math.round(base * 1.15) + ' 💰 por esta carta. Escucho ofertas.»');
  }

  function iniciarVenta(carta) {
    // evita el soft-lock: no vender si deja la formación actual sin cubrir
    var REQ = State.reqActual();
    var mismos = State.run.plantilla.filter(function (c) { return c.pos === carta.pos; }).length;
    if (carta.type === 'player' && mismos <= REQ[carta.pos]) {
      toast('No puedes venderlo: tu ' + State.run.tactica.formacion + ' necesita ' + REQ[carta.pos] + ' ' + carta.pos, 'error');
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
  function renderPost(resumen, onContinue) {
    var run = State.run;
    var titulo = resumen.resultado === 'V' ? '🏆 ¡VICTORIA!' : resumen.resultado === 'E' ? '🤝 EMPATE' : '💔 DERROTA';
    $('#post-result-title').textContent = titulo;
    $('#post-result-title').className = 'post-' + resumen.resultado;
    $('#post-score').innerHTML =
      run.equipos[0].nombre + ' <b class="marcador">' + resumen.gf + ' - ' + resumen.gc + '</b> ' + resumen.rival.nombre +
      (resumen.esJefe ? ' <span class="boss-label">PARTIDO JEFE</span>' : '');

    // goleadores
    $('#post-goleadores').innerHTML = (resumen.goleadores || []).map(function (g) {
      return '<span class="gol-chip ' + (g.team === 0 ? 'gol-mio' : 'gol-rival') + '">' +
        g.min + "' ⚽ " + g.nombre + (g.asistente ? ' <i>(' + g.asistente + ')</i>' : '') + '</span>';
    }).join(' ');

    // estadísticas del partido
    var st = resumen.statsPartido;
    if (st) {
      function fila(lbl, a, b) {
        return '<div class="ps-row"><span>' + a + '</span><b>' + lbl + '</b><span>' + b + '</span></div>';
      }
      $('#post-stats').innerHTML =
        fila('Posesión', st[0].posesion + '%', st[1].posesion + '%') +
        fila('Tiros (a puerta)', st[0].tiros + ' (' + st[0].aPuerta + ')', st[1].tiros + ' (' + st[1].aPuerta + ')') +
        fila('xG', st[0].xg.toFixed(2), st[1].xg.toFixed(2)) +
        fila('Pases (acierto)', st[0].pases + ' (' + (st[0].pases ? Math.round(st[0].pasesOk / st[0].pases * 100) : 0) + '%)',
          st[1].pases + ' (' + (st[1].pases ? Math.round(st[1].pasesOk / st[1].pases * 100) : 0) + '%)') +
        fila('Faltas', st[0].faltas, st[1].faltas) +
        fila('Tarjetas', '🟨' + st[0].amarillas + ' 🟥' + st[0].rojas, '🟨' + st[1].amarillas + ' 🟥' + st[1].rojas) +
        fila('Córners', st[0].corners, st[1].corners);
    }

    // notas de tus jugadores
    var ratings = (resumen.ratings || []).slice().sort(function (a, b) { return b.nota - a.nota; });
    $('#post-ratings').innerHTML = '<h4>Notas del equipo</h4>' +
      '<div class="ratings-grid">' + ratings.map(function (j) {
        var esMvp = resumen.mvp && resumen.mvp.cardId === j.cardId;
        return '<div class="rating-row' + (esMvp ? ' mvp' : '') + '">' +
          (esMvp ? '<span class="mvp-badge">MVP</span>' : '') +
          '<span class="rr-pos">' + j.pos + '</span>' +
          '<span class="rr-nombre">' + j.nombre + '</span>' +
          '<span class="rr-extra">' +
          (j.goles ? '⚽' + j.goles + ' ' : '') + (j.asis ? '🅰️' + j.asis + ' ' : '') +
          (j.paradas ? '🧤' + j.paradas + ' ' : '') +
          (j.amarilla ? '🟨 ' : '') + (j.roja ? '🟥 ' : '') + '</span>' +
          '<b class="rr-nota ' + notaClase(j.nota) + '">' + j.nota.toFixed(1) + '</b>' +
          '</div>';
      }).join('') + '</div>';

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
        if (c.type === 'staff' && State.run.staff.length >= State.MAX_STAFF) { toast('Staff completo (3)', 'error'); return; }
        if (c.type === 'player' && State.run.plantilla.length >= State.MAX_PLANTILLA) { toast('Plantilla llena: usa venta rápida o pasa', 'error'); return; }
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
        State.run.oro += oro;
        State.run.stats.oroGanado += oro;
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
    $('#ficha-close').onclick = function () {
      AudioFX.click();
      $('#ficha-modal').classList.add('hidden');
    };
    $('#ficha-modal').onclick = function (ev) {
      if (ev.target === this) $('#ficha-modal').classList.add('hidden');
    };
  }

  return {
    $: $,
    init: init,
    showScreen: showScreen,
    toast: toast,
    confirmar: confirmar,
    cartaDOM: cartaDOM,
    showFicha: showFicha,
    colorHex: colorHex,
    renderMenu: renderMenu,
    renderManage: renderManage,
    renderPost: renderPost,
    renderEnd: renderEnd,
    resetSeleccion: function () { seleccionBanquillo = null; }
  };
})();
