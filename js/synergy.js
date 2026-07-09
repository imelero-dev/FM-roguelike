/* ============================================================
   SYNERGY — sinergias por tag, habilidades pasivas, staff,
   forma y moral aplicados como bonos de ATRIBUTO. Devuelve
   los atributos efectivos que consume el motor de partido.
   ============================================================ */

var Synergy = (function () {

  var OFENSIVOS = ['remate', 'regate', 'desmarque', 'compostura', 'tirosLejanos', 'primerToque', 'tecnica', 'vision'];
  var MENTALES = ['agresividad', 'anticipacion', 'compostura', 'concentracion', 'decisiones', 'desmarque', 'colocacion', 'liderazgo', 'vision', 'sacrificio'];

  var SINERGIAS = {
    'Cantera': {
      icono: '🌱',
      niveles: [
        { n: 3, desc: '+1 a TODOS los atributos de los jugadores Cantera' },
        { n: 5, desc: '+2 a TODOS los atributos de los jugadores Cantera' }
      ],
      aplicar: function (nivel, ctx) { ctx.porTag['Cantera'] = nivel; }
    },
    'Galáctico': {
      icono: '🌟',
      niveles: [
        { n: 2, desc: '+1 Remate, Regate, Técnica y Desmarque a todo el equipo' },
        { n: 4, desc: '+2 Remate, Regate, Técnica y Desmarque a todo el equipo' }
      ],
      aplicar: function (nivel, ctx) {
        ['remate', 'regate', 'tecnica', 'desmarque'].forEach(function (a) { ctx.equipo[a] = (ctx.equipo[a] || 0) + nivel; });
      }
    },
    'Físico': {
      icono: '💪',
      niveles: [
        { n: 3, desc: '+1 Velocidad, Aceleración, Fuerza y Resistencia a todo el equipo' },
        { n: 5, desc: '+2 Velocidad, Aceleración, Fuerza y Resistencia a todo el equipo' }
      ],
      aplicar: function (nivel, ctx) {
        ['velocidad', 'aceleracion', 'fuerza', 'resistencia'].forEach(function (a) { ctx.equipo[a] = (ctx.equipo[a] || 0) + nivel; });
      }
    },
    'Técnico': {
      icono: '🎩',
      niveles: [
        { n: 3, desc: '+1 Pase, Primer toque, Visión y Técnica a todo el equipo' },
        { n: 5, desc: '+2 Pase, Primer toque, Visión y Técnica a todo el equipo' }
      ],
      aplicar: function (nivel, ctx) {
        ['pase', 'primerToque', 'vision', 'tecnica'].forEach(function (a) { ctx.equipo[a] = (ctx.equipo[a] || 0) + nivel; });
      }
    }
  };

  function evaluar(lineup) {
    var counts = {};
    lineup.forEach(function (c) {
      if (!c) return;
      counts[c.tag] = (counts[c.tag] || 0) + 1;
    });
    return Object.keys(SINERGIAS).map(function (tag) {
      var def = SINERGIAS[tag];
      var count = counts[tag] || 0;
      var activos = def.niveles.filter(function (nv) { return count >= nv.n; });
      return {
        tag: tag,
        icono: def.icono,
        count: count,
        siguiente: def.niveles.filter(function (nv) { return count < nv.n; })[0] || null,
        activos: activos
      };
    });
  }

  // Construye los atributos efectivos del once.
  // opts: { esJefe, debuff, moral (20-95), staffKeys }
  // Devuelve { jugadores: [{card, attrs, habs}], sinergias, castList }
  function aplicar(lineup, staff, opts) {
    opts = opts || {};
    var ctx = { equipo: {}, porTag: {} };
    var sinergias = evaluar(lineup);
    sinergias.forEach(function (s) {
      if (!s.activos.length) return;
      var nivel = s.activos.length; // 1 o 2 según umbral alcanzado
      SINERGIAS[s.tag].aplicar(nivel, ctx);
    });

    var staffKeys = (staff || []).map(function (s) { return s.key; });
    if (staffKeys.indexOf('pizarra') >= 0) ctx.equipo.colocacion = (ctx.equipo.colocacion || 0) + 1;
    if (staffKeys.indexOf('motivador') >= 0) {
      var m = opts.esJefe ? 2 : 1;
      ctx.equipo.compostura = (ctx.equipo.compostura || 0) + m;
      ctx.equipo.concentracion = (ctx.equipo.concentracion || 0) + m;
    }

    // habilidades que afectan a todo el equipo + lista de "casts" visuales
    var castList = [];
    var capitanes = 0;
    lineup.forEach(function (c) {
      if (!c) return;
      if (c.habilidades.indexOf('capitan') >= 0) { capitanes++; castList.push({ card: c, hab: 'capitan' }); }
      if (c.habilidades.indexOf('motor') >= 0) castList.push({ card: c, hab: 'motor' });
    });
    if (capitanes) {
      ctx.equipo.compostura = (ctx.equipo.compostura || 0) + capitanes;
      ctx.equipo.decisiones = (ctx.equipo.decisiones || 0) + capitanes;
    }

    var moralBonus = opts.moral !== undefined ? (opts.moral - 60) / 25 : 0; // ±1.4 mental
    var debuff = opts.debuff || 0;

    var jugadores = lineup.map(function (c) {
      if (!c) return null;
      var eff = {};
      var habs = {
        clutch: c.habilidades.indexOf('clutch') >= 0,
        killer: c.habilidades.indexOf('killer') >= 0,
        motor: c.habilidades.indexOf('motor') >= 0,
        franco: c.habilidades.indexOf('francotirador') >= 0
      };
      var tagAll = ctx.porTag[c.tag] || 0;
      var formaBonus = (c.forma || 0) * 0.6;
      Object.keys(c.attrs).forEach(function (a) {
        var v = c.attrs[a] + (ctx.equipo[a] || 0) + tagAll + formaBonus - debuff;
        if (MENTALES.indexOf(a) >= 0) v += moralBonus;
        eff[a] = v;
      });
      // habilidades individuales
      if (c.habilidades.indexOf('muro') >= 0 && c.pos === 'DEF') {
        eff.marcaje += 2; eff.colocacion += 2; eff.cabeza += 2;
      }
      if (c.habilidades.indexOf('velocista') >= 0) { eff.velocidad += 2; eff.aceleracion += 2; }
      if (c.habilidades.indexOf('cerrojo') >= 0 && c.pos === 'POR') { eff.reflejos += 2; eff.unoContraUno += 2; }
      if (c.habilidades.indexOf('francotirador') >= 0) eff.tirosLejanos += 3;
      if (c.habilidades.indexOf('fajador') >= 0) {
        eff.fuerza += 2; eff.agresividad += 2;
        if (opts.esJefe) Object.keys(eff).forEach(function (a) { eff[a] += 1; });
      }
      if (c.habilidades.indexOf('estrella') >= 0) {
        OFENSIVOS.forEach(function (a) { eff[a] += 1; });
      }
      Object.keys(eff).forEach(function (a) { eff[a] = Math.max(1, Math.min(22, eff[a])); });
      return { card: c, attrs: eff, habs: habs };
    });

    return { jugadores: jugadores, sinergias: sinergias, castList: castList };
  }

  return { SINERGIAS: SINERGIAS, evaluar: evaluar, aplicar: aplicar };
})();

if (typeof module !== 'undefined') module.exports = Synergy;
