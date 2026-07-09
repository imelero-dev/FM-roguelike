/* ============================================================
   ATTRS — sistema de atributos estilo Football Manager.
   33 atributos en escala 1-20, agrupados en Técnica / Mental /
   Físico / Portería. Cada posición tiene un perfil que sesga
   la generación y pondera la media (1-99) mostrada en la carta.
   El motor de partido consume atributos concretos en cada
   acción (un pase usa Pase/Visión, una entrada usa Entradas/
   Fuerza contra Regate/Equilibrio, etc.).
   ============================================================ */

var Attrs = (function () {

  var GRUPOS = [
    { key: 'tecnica', nombre: 'Técnica', attrs: ['remate', 'regate', 'pase', 'primerToque', 'centros', 'tirosLejanos', 'entradas', 'marcaje', 'tecnica', 'cabeza'] },
    { key: 'mental', nombre: 'Mental', attrs: ['agresividad', 'anticipacion', 'compostura', 'concentracion', 'decisiones', 'desmarque', 'colocacion', 'liderazgo', 'vision', 'sacrificio'] },
    { key: 'fisico', nombre: 'Físico', attrs: ['aceleracion', 'velocidad', 'agilidad', 'equilibrio', 'fuerza', 'salto', 'resistencia'] },
    { key: 'portero', nombre: 'Portería', attrs: ['reflejos', 'paradas', 'salidas', 'unoContraUno', 'juegoAereo', 'saques'] }
  ];

  var NOMBRES = {
    remate: 'Remate', regate: 'Regate', pase: 'Pase', primerToque: 'Primer toque',
    centros: 'Centros', tirosLejanos: 'Tiros lejanos', entradas: 'Entradas',
    marcaje: 'Marcaje', tecnica: 'Técnica', cabeza: 'Cabeza',
    agresividad: 'Agresividad', anticipacion: 'Anticipación', compostura: 'Compostura',
    concentracion: 'Concentración', decisiones: 'Decisiones', desmarque: 'Desmarque',
    colocacion: 'Colocación', liderazgo: 'Liderazgo', vision: 'Visión', sacrificio: 'Sacrificio',
    aceleracion: 'Aceleración', velocidad: 'Velocidad', agilidad: 'Agilidad',
    equilibrio: 'Equilibrio', fuerza: 'Fuerza', salto: 'Salto', resistencia: 'Resistencia',
    reflejos: 'Reflejos', paradas: 'Paradas', salidas: 'Salidas',
    unoContraUno: '1 contra 1', juegoAereo: 'Juego aéreo', saques: 'Saques'
  };

  var TODOS = GRUPOS.reduce(function (a, g) { return a.concat(g.attrs); }, []);

  // Perfil por posición: qué atributos definen al jugador (alto),
  // cuáles acompañan (medio) y el resto sale bajo.
  var PERFILES = {
    POR: {
      alto: ['reflejos', 'paradas', 'unoContraUno', 'colocacion', 'concentracion', 'agilidad'],
      medio: ['salidas', 'juegoAereo', 'saques', 'compostura', 'decisiones', 'salto', 'fuerza', 'equilibrio'],
      // los porteros apenas usan el resto del juego de campo
      campoBajo: true
    },
    DEF: {
      alto: ['marcaje', 'entradas', 'colocacion', 'anticipacion', 'cabeza', 'fuerza'],
      medio: ['salto', 'concentracion', 'agresividad', 'equilibrio', 'pase', 'decisiones', 'velocidad', 'aceleracion', 'resistencia', 'sacrificio', 'primerToque']
    },
    MED: {
      alto: ['pase', 'vision', 'tecnica', 'primerToque', 'decisiones', 'resistencia'],
      medio: ['regate', 'anticipacion', 'entradas', 'compostura', 'colocacion', 'tirosLejanos', 'sacrificio', 'desmarque', 'centros', 'agilidad', 'equilibrio', 'aceleracion', 'velocidad', 'concentracion']
    },
    DEL: {
      alto: ['remate', 'desmarque', 'compostura', 'aceleracion', 'regate'],
      medio: ['velocidad', 'primerToque', 'tecnica', 'cabeza', 'vision', 'agilidad', 'equilibrio', 'salto', 'tirosLejanos', 'decisiones', 'fuerza', 'anticipacion', 'concentracion', 'resistencia']
    }
  };

  // Ponderación de la media (1-99) por posición
  var PESOS_MEDIA = {
    POR: { reflejos: 3, paradas: 3, unoContraUno: 2.5, salidas: 2, juegoAereo: 2, saques: 1, colocacion: 2, concentracion: 1.5, compostura: 1, decisiones: 1, agilidad: 2, salto: 1 },
    DEF: { marcaje: 3, entradas: 3, colocacion: 2.5, anticipacion: 2, cabeza: 2, fuerza: 2, salto: 1.5, concentracion: 1.5, velocidad: 1.5, aceleracion: 1, pase: 1, agresividad: 0.8, equilibrio: 0.8, decisiones: 1 },
    MED: { pase: 3, vision: 2.5, tecnica: 2, primerToque: 2, decisiones: 2, resistencia: 1.5, sacrificio: 1.3, regate: 1.5, anticipacion: 1, entradas: 1, compostura: 1, tirosLejanos: 0.8, desmarque: 0.8, colocacion: 0.8 },
    DEL: { remate: 3, desmarque: 2.5, compostura: 2, aceleracion: 2, regate: 2, primerToque: 1.5, velocidad: 1.5, tecnica: 1.2, cabeza: 1, vision: 1, agilidad: 1, decisiones: 0.8, equilibrio: 0.7 }
  };

  // Resumen de 4 barras para la carta compacta (etiqueta + atributos que promedia)
  var RESUMEN = {
    POR: [
      ['REF', ['reflejos', 'agilidad']],
      ['PAR', ['paradas', 'unoContraUno']],
      ['SAL', ['salidas', 'juegoAereo']],
      ['SAQ', ['saques', 'pase']]
    ],
    campo: [
      ['ATQ', ['remate', 'regate', 'tirosLejanos', 'desmarque']],
      ['DEF', ['entradas', 'marcaje', 'colocacion', 'anticipacion']],
      ['PAS', ['pase', 'vision', 'tecnica', 'primerToque']],
      ['FÍS', ['aceleracion', 'velocidad', 'resistencia', 'fuerza']]
    ]
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function gauss() { return (Math.random() + Math.random() + Math.random()) / 1.5 - 1; } // ~N(0, 0.47)

  function rollAttr(nivel, spread) {
    return clamp(Math.round(nivel + gauss() * (spread || 2.4)), 1, 20);
  }

  // Genera el mapa completo de atributos para una posición y un nivel base (1-20)
  function generarNivel(pos, nivel) {
    var perfil = PERFILES[pos];
    var attrs = {};
    TODOS.forEach(function (a) {
      var esPortero = GRUPOS[3].attrs.indexOf(a) >= 0;
      if (pos !== 'POR' && esPortero) { attrs[a] = rollAttr(2.5, 1.2); return; }
      if (pos === 'POR' && !esPortero && perfil.alto.indexOf(a) < 0 && perfil.medio.indexOf(a) < 0) {
        attrs[a] = rollAttr(4.5, 1.8); return;
      }
      if (perfil.alto.indexOf(a) >= 0) attrs[a] = rollAttr(nivel + 2.6, 1.9);
      else if (perfil.medio.indexOf(a) >= 0) attrs[a] = rollAttr(nivel + 0.2, 2.1);
      else attrs[a] = rollAttr(nivel - 2.6, 2.2);
    });
    return attrs;
  }

  // Nivel base por rareza (con algo de varianza dentro de cada rareza)
  var NIVEL_RAREZA = { comun: 8.4, rara: 10.5, epica: 12.7, legendaria: 15.3 };

  function generar(pos, rareza) {
    var nivel = NIVEL_RAREZA[rareza] + gauss() * 0.8;
    return generarNivel(pos, nivel);
  }

  // Media 1-99 ponderada por posición
  function media(pos, attrs) {
    var pesos = PESOS_MEDIA[pos];
    var suma = 0, total = 0;
    Object.keys(pesos).forEach(function (a) {
      suma += attrs[a] * pesos[a];
      total += pesos[a];
    });
    return clamp(Math.round((suma / total) * 5), 1, 99);
  }

  // 4 barras resumidas (1-99) para la carta compacta
  function resumen(carta) {
    var defs = carta.pos === 'POR' ? RESUMEN.POR : RESUMEN.campo;
    return defs.map(function (d) {
      var s = 0;
      d[1].forEach(function (a) { s += carta.attrs[a]; });
      return { label: d[0], val: clamp(Math.round((s / d[1].length) * 5), 1, 99) };
    });
  }

  // Color de un atributo 1-20 para la ficha (convención FM)
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

// para tests headless en Node
if (typeof module !== 'undefined') module.exports = Attrs;
