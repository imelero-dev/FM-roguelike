/* ============================================================
   ATTRS — player attribute system.
   33 attributes on a 1-20 scale, grouped into Technical / Mental /
   Physical / Goalkeeping. Each position has a profile that biases
   generation and weights the overall rating (1-99) shown on the card.
   The match engine uses specific attributes for each action
   (a pass uses Passing/Vision, a tackle uses Tackling/Strength
   against Dribbling/Balance, etc.).
   ============================================================ */

var Attrs = (function () {

  var GRUPOS = [
    { key: 'tecnica', nombre: 'Technical', attrs: ['remate', 'regate', 'pase', 'primerToque', 'centros', 'tirosLejanos', 'entradas', 'marcaje', 'tecnica', 'cabeza'] },
    { key: 'mental', nombre: 'Mental', attrs: ['agresividad', 'anticipacion', 'compostura', 'concentracion', 'decisiones', 'desmarque', 'colocacion', 'liderazgo', 'vision', 'sacrificio'] },
    { key: 'fisico', nombre: 'Physical', attrs: ['aceleracion', 'velocidad', 'agilidad', 'equilibrio', 'fuerza', 'salto', 'resistencia'] },
    { key: 'portero', nombre: 'Goalkeeping', attrs: ['reflejos', 'paradas', 'salidas', 'unoContraUno', 'juegoAereo', 'saques'] }
  ];

  var NOMBRES = {
    remate: 'Finishing', regate: 'Dribbling', pase: 'Passing', primerToque: 'First Touch',
    centros: 'Crossing', tirosLejanos: 'Long Shots', entradas: 'Tackling',
    marcaje: 'Marking', tecnica: 'Technique', cabeza: 'Heading',
    agresividad: 'Aggression', anticipacion: 'Anticipation', compostura: 'Composure',
    concentracion: 'Concentration', decisiones: 'Decisions', desmarque: 'Off the Ball',
    colocacion: 'Positioning', liderazgo: 'Leadership', vision: 'Vision', sacrificio: 'Work Rate',
    aceleracion: 'Acceleration', velocidad: 'Pace', agilidad: 'Agility',
    equilibrio: 'Balance', fuerza: 'Strength', salto: 'Jumping', resistencia: 'Stamina',
    reflejos: 'Reflexes', paradas: 'Handling', salidas: 'Rushing Out',
    unoContraUno: 'One on Ones', juegoAereo: 'Aerial Reach', saques: 'Kicking'
  };

  var TODOS = GRUPOS.reduce(function (a, g) { return a.concat(g.attrs); }, []);

  // Profile per position: which attributes define the player (high),
  // which support them (medium); the rest roll low.
  var PERFILES = {
    GK: {
      alto: ['reflejos', 'paradas', 'unoContraUno', 'colocacion', 'concentracion', 'agilidad'],
      medio: ['salidas', 'juegoAereo', 'saques', 'compostura', 'decisiones', 'salto', 'fuerza', 'equilibrio'],
      // goalkeepers barely use the outfield attributes
      campoBajo: true
    },
    DEF: {
      alto: ['marcaje', 'entradas', 'colocacion', 'anticipacion', 'cabeza', 'fuerza'],
      medio: ['salto', 'concentracion', 'agresividad', 'equilibrio', 'pase', 'decisiones', 'velocidad', 'aceleracion', 'resistencia', 'sacrificio', 'primerToque']
    },
    MID: {
      alto: ['pase', 'vision', 'tecnica', 'primerToque', 'decisiones', 'resistencia'],
      medio: ['regate', 'anticipacion', 'entradas', 'compostura', 'colocacion', 'tirosLejanos', 'sacrificio', 'desmarque', 'centros', 'agilidad', 'equilibrio', 'aceleracion', 'velocidad', 'concentracion']
    },
    FWD: {
      alto: ['remate', 'desmarque', 'compostura', 'aceleracion', 'regate'],
      medio: ['velocidad', 'primerToque', 'tecnica', 'cabeza', 'vision', 'agilidad', 'equilibrio', 'salto', 'tirosLejanos', 'decisiones', 'fuerza', 'anticipacion', 'concentracion', 'resistencia']
    }
  };

  // Overall rating (1-99) weights per position
  var PESOS_MEDIA = {
    GK: { reflejos: 3, paradas: 3, unoContraUno: 2.5, salidas: 2, juegoAereo: 2, saques: 1, colocacion: 2, concentracion: 1.5, compostura: 1, decisiones: 1, agilidad: 2, salto: 1 },
    DEF: { marcaje: 3, entradas: 3, colocacion: 2.5, anticipacion: 2, cabeza: 2, fuerza: 2, salto: 1.5, concentracion: 1.5, velocidad: 1.5, aceleracion: 1, pase: 1, agresividad: 0.8, equilibrio: 0.8, decisiones: 1 },
    MID: { pase: 3, vision: 2.5, tecnica: 2, primerToque: 2, decisiones: 2, resistencia: 1.5, sacrificio: 1.3, regate: 1.5, anticipacion: 1, entradas: 1, compostura: 1, tirosLejanos: 0.8, desmarque: 0.8, colocacion: 0.8 },
    FWD: { remate: 3, desmarque: 2.5, compostura: 2, aceleracion: 2, regate: 2, primerToque: 1.5, velocidad: 1.5, tecnica: 1.2, cabeza: 1, vision: 1, agilidad: 1, decisiones: 0.8, equilibrio: 0.7 }
  };

  // 4-bar summary for the compact card (label + attributes it averages)
  var RESUMEN = {
    GK: [
      ['REF', ['reflejos', 'agilidad']],
      ['HAN', ['paradas', 'unoContraUno']],
      ['AER', ['salidas', 'juegoAereo']],
      ['KIC', ['saques', 'pase']]
    ],
    campo: [
      ['ATT', ['remate', 'regate', 'tirosLejanos', 'desmarque']],
      ['DEF', ['entradas', 'marcaje', 'colocacion', 'anticipacion']],
      ['PAS', ['pase', 'vision', 'tecnica', 'primerToque']],
      ['PHY', ['aceleracion', 'velocidad', 'resistencia', 'fuerza']]
    ]
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function gauss() { return (Math.random() + Math.random() + Math.random()) / 1.5 - 1; } // ~N(0, 0.47)

  function rollAttr(nivel, spread) {
    return clamp(Math.round(nivel + gauss() * (spread || 2.4)), 1, 20);
  }

  // Generates the full attribute map for a position and base level (1-20)
  function generarNivel(pos, nivel) {
    var perfil = PERFILES[pos];
    var attrs = {};
    TODOS.forEach(function (a) {
      var esPortero = GRUPOS[3].attrs.indexOf(a) >= 0;
      if (pos !== 'GK' && esPortero) { attrs[a] = rollAttr(2.5, 1.2); return; }
      if (pos === 'GK' && !esPortero && perfil.alto.indexOf(a) < 0 && perfil.medio.indexOf(a) < 0) {
        attrs[a] = rollAttr(4.5, 1.8); return;
      }
      if (perfil.alto.indexOf(a) >= 0) attrs[a] = rollAttr(nivel + 2.6, 1.9);
      else if (perfil.medio.indexOf(a) >= 0) attrs[a] = rollAttr(nivel + 0.2, 2.1);
      else attrs[a] = rollAttr(nivel - 2.6, 2.2);
    });
    return attrs;
  }

  // Base level per rarity (with some variance within each rarity)
  var NIVEL_RAREZA = { comun: 8.4, rara: 10.5, epica: 12.7, legendaria: 15.3 };

  function generar(pos, rareza) {
    var nivel = NIVEL_RAREZA[rareza] + gauss() * 0.8;
    return generarNivel(pos, nivel);
  }

  // Position-weighted overall rating 1-99
  function media(pos, attrs) {
    var pesos = PESOS_MEDIA[pos];
    var suma = 0, total = 0;
    Object.keys(pesos).forEach(function (a) {
      suma += attrs[a] * pesos[a];
      total += pesos[a];
    });
    return clamp(Math.round((suma / total) * 5), 1, 99);
  }

  // 4 summary bars (1-99) for the compact card
  function resumen(carta) {
    var defs = carta.pos === 'GK' ? RESUMEN.GK : RESUMEN.campo;
    return defs.map(function (d) {
      var s = 0;
      d[1].forEach(function (a) { s += carta.attrs[a]; });
      return { label: d[0], val: clamp(Math.round((s / d[1].length) * 5), 1, 99) };
    });
  }

  // Colour class for a 1-20 attribute on the player profile
  function colorAttr(v) {
    if (v >= 16) return 'attr-elite';
    if (v >= 13) return 'attr-bueno';
    if (v >= 8) return 'attr-normal';
    return 'attr-flojo';
  }

  return {
    GRUPOS: GRUPOS,
    NOMBRES: NOMBRES,
    TODOS: TODOS,
    NIVEL_RAREZA: NIVEL_RAREZA,
    generar: generar,
    generarNivel: generarNivel,
    media: media,
    resumen: resumen,
    colorAttr: colorAttr
  };
})();

// for headless tests in Node
if (typeof module !== 'undefined') module.exports = Attrs;
