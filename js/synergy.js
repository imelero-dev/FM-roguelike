/* ============================================================
   SYNERGY — sinergias por tag y aplicación de bonos de equipo
   ============================================================ */

var Synergy = (function () {

  // Definición de sinergias: umbrales -> bonos
  var SINERGIAS = {
    'Cantera': {
      icono: '🌱',
      niveles: [
        { n: 3, desc: '+7 a todos los stats de los jugadores Cantera', apply: function (ctx) { ctx.bonusTagAll['Cantera'] = 7; } },
        { n: 5, desc: '+14 a todos los stats de los jugadores Cantera', apply: function (ctx) { ctx.bonusTagAll['Cantera'] = 14; } }
      ]
    },
    'Galáctico': {
      icono: '🌟',
      niveles: [
        { n: 2, desc: '+8 ataque a todo el equipo', apply: function (ctx) { ctx.bonusEquipo.atq += 8; } },
        { n: 4, desc: '+16 ataque a todo el equipo', apply: function (ctx) { ctx.bonusEquipo.atq += 8; } }
      ]
    },
    'Físico': {
      icono: '💪',
      niveles: [
        { n: 3, desc: '+10 velocidad a todo el equipo', apply: function (ctx) { ctx.bonusEquipo.vel += 10; } },
        { n: 5, desc: '+18 velocidad a todo el equipo', apply: function (ctx) { ctx.bonusEquipo.vel += 8; } }
      ]
    },
    'Técnico': {
      icono: '🎩',
      niveles: [
        { n: 3, desc: '+10 pase a todo el equipo', apply: function (ctx) { ctx.bonusEquipo.pas += 10; } },
        { n: 5, desc: '+18 pase a todo el equipo', apply: function (ctx) { ctx.bonusEquipo.pas += 8; } }
      ]
    }
  };

  // Cuenta tags en el once y devuelve estado de sinergias
  function evaluar(lineup) {
    var counts = {};
    lineup.forEach(function (c) {
      if (!c) return;
      counts[c.tag] = (counts[c.tag] || 0) + 1;
    });
    var resultado = [];
    Object.keys(SINERGIAS).forEach(function (tag) {
      var def = SINERGIAS[tag];
      var count = counts[tag] || 0;
      var activos = def.niveles.filter(function (nv) { return count >= nv.n; });
      resultado.push({
        tag: tag,
        icono: def.icono,
        count: count,
        siguiente: def.niveles.filter(function (nv) { return count < nv.n; })[0] || null,
        activos: activos
      });
    });
    return resultado;
  }

  // Construye stats efectivos del once aplicando sinergias, staff y habilidades pasivas.
  // Devuelve { jugadores: [{card, eff:{atq,def,pas,vel}}], hooks: {...}, sinergias }
  function aplicar(lineup, staff, opts) {
    opts = opts || {};
    var ctx = { bonusEquipo: { atq: 0, def: 0, pas: 0, vel: 0 }, bonusTagAll: {} };
    var sinergias = evaluar(lineup);
    sinergias.forEach(function (s) {
      s.activos.forEach(function (nv) { nv.apply(ctx); });
    });

    var staffKeys = (staff || []).map(function (s) { return s.key; });

    // Staff pasivo de partido
    if (staffKeys.indexOf('pizarra') >= 0) { ctx.bonusEquipo.pas += 6; ctx.bonusEquipo.def += 6; }
    if (opts.esJefe && staffKeys.indexOf('motivador') >= 0) {
      ctx.bonusEquipo.atq += 8; ctx.bonusEquipo.def += 8; ctx.bonusEquipo.pas += 8; ctx.bonusEquipo.vel += 8;
    }

    // Habilidades pasivas globales
    var flat = 0;
    var hooks = {
      muroZona: 0,        // reducción prob. gol rival
      cerrojo: 0,
      motorPase: 0,       // % extra de pase
      velocistaAvance: 0, // % extra de avance
      francotirador: 0,   // % extra de ocasión
      clutchIds: [],      // jugadores con clutch
      killerIds: {},      // id -> true
      abilityCast: []     // eventos de activación para feedback visual al inicio
    };

    lineup.forEach(function (c) {
      if (!c) return;
      (c.habilidades || []).forEach(function (h) {
        if (h === 'capitan') { flat += 4; hooks.abilityCast.push({ card: c, hab: 'capitan' }); }
        if (h === 'muro') hooks.muroZona += 0.15;
        if (h === 'cerrojo' && c.pos === 'POR') hooks.cerrojo += 0.12;
        if (h === 'motor' && c.pos === 'MED') { hooks.motorPase += 0.10; hooks.abilityCast.push({ card: c, hab: 'motor' }); }
        if (h === 'velocista') hooks.velocistaAvance += 0.08;
        if (h === 'francotirador') hooks.francotirador += 0.15;
        if (h === 'clutch') hooks.clutchIds.push(c.id);
        if (h === 'killer') hooks.killerIds[c.id] = true;
      });
    });
    hooks.muroZona = Math.min(0.35, hooks.muroZona);
    ctx.bonusEquipo.atq += flat; ctx.bonusEquipo.def += flat;
    ctx.bonusEquipo.pas += flat; ctx.bonusEquipo.vel += flat;

    // Stat efectivo por jugador
    var maxAtq = -1, maxAtqId = null;
    lineup.forEach(function (c) {
      if (c && c.stats.atq > maxAtq) { maxAtq = c.stats.atq; maxAtqId = c.id; }
    });

    var jugadores = lineup.map(function (c) {
      if (!c) return null;
      var tagBonus = ctx.bonusTagAll[c.tag] || 0;
      var jefeBonus = (opts.esJefe && c.habilidades.indexOf('fajador') >= 0) ? 12 : 0;
      var estrella = (c.habilidades.indexOf('estrella') >= 0 && c.id === maxAtqId) ? 10 : 0;
      var debuff = opts.debuff || 0;
      function eff(base, extra) {
        return Math.max(10, Math.min(120, base + tagBonus + jefeBonus - debuff + (extra || 0)));
      }
      return {
        card: c,
        eff: {
          atq: eff(c.stats.atq, ctx.bonusEquipo.atq + estrella),
          def: eff(c.stats.def, ctx.bonusEquipo.def),
          pas: eff(c.stats.pas, ctx.bonusEquipo.pas),
          vel: eff(c.stats.vel, ctx.bonusEquipo.vel)
        }
      };
    });

    return { jugadores: jugadores, hooks: hooks, sinergias: sinergias };
  }

  return { SINERGIAS: SINERGIAS, evaluar: evaluar, aplicar: aplicar };
})();
