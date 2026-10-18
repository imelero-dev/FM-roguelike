/* ============================================================
   NEGO — negotiation minigame (buying/selling) against the AI
   with hidden patience and reserve price.
   ============================================================ */

var Nego = (function () {

  // active negotiation session
  var sesion = null;

  // mode: 'compra' (buying, haggle down) or 'venta' (selling, haggle up)
  function iniciar(modo, carta, precioBase) {
    var reserva, paciencia;
    if (modo === 'compra') {
      // the seller won't accept below their reserve
      reserva = Math.round(precioBase * (0.82 + RNG.f() * 0.16));   // 82%-98% of the price
      paciencia = RNG.int(2, 3);
    } else {
      // the buyer won't pay above their ceiling
      reserva = Math.round(precioBase * (1.02 + RNG.f() * 0.35));   // 102%-137% of the sale value
      paciencia = RNG.int(2, 3);
    }
    sesion = {
      modo: modo,
      carta: carta,
      precioBase: precioBase,
      reserva: reserva,
      paciencia: paciencia,
      ronda: 0,
      maxRondas: paciencia,
      contraoferta: null,
      ultimaOferta: null,
      cerrada: false,
      log: []
    };
    return sesion;
  }

  // Makes an offer. Returns {estado: 'aceptada'|'contraoferta'|'ultimatum'|'rota', contraoferta?}
  function ofertar(cantidad) {
    if (!sesion || sesion.cerrada) return { estado: 'rota' };
    sesion.ronda++;
    sesion.ultimaOferta = cantidad;
    var m = sesion.modo;

    var acepta = m === 'compra' ? cantidad >= sesion.reserva : cantidad <= sesion.reserva;
    // offers very close to the reserve may sneak through with luck
    if (!acepta) {
      var margen = Math.abs(cantidad - sesion.reserva) / sesion.reserva;
      if (margen < 0.06 && RNG.chance(0.5)) acepta = true;
    }

    if (acepta) {
      sesion.cerrada = true;
      return { estado: 'aceptada', precio: cantidad };
    }

    if (sesion.ronda >= sesion.maxRondas) {
      // last chance: the AI issues an ultimatum instead of walking away, unless the offer was insulting
      var insulto = m === 'compra' ? cantidad < sesion.reserva * 0.6 : cantidad > sesion.reserva * 1.6;
      if (insulto) {
        sesion.cerrada = true;
        return { estado: 'rota' };
      }
      sesion.contraoferta = sesion.reserva;
      return { estado: 'ultimatum', contraoferta: sesion.reserva };
    }

    // counter-offer: moves from their position towards yours, never crossing the reserve
    var contra;
    if (m === 'compra') {
      var pedidoInicial = Math.round(sesion.precioBase * 1.15);
      var previo = sesion.contraoferta || pedidoInicial;
      contra = Math.round(Math.max(sesion.reserva, previo - (previo - cantidad) * (0.35 + RNG.f() * 0.2)));
    } else {
      var ofertaInicial = Math.round(sesion.precioBase * 0.8);
      var previo2 = sesion.contraoferta || ofertaInicial;
      contra = Math.round(Math.min(sesion.reserva, previo2 + (cantidad - previo2) * (0.35 + RNG.f() * 0.2)));
    }
    sesion.contraoferta = contra;
    return { estado: 'contraoferta', contraoferta: contra };
  }

  function aceptarContraoferta() {
    if (!sesion || sesion.contraoferta === null) return null;
    sesion.cerrada = true;
    return sesion.contraoferta;
  }

  function retirarse() {
    if (sesion) sesion.cerrada = true;
    sesion = null;
  }

  function actual() { return sesion; }

  return { iniciar: iniciar, ofertar: ofertar, aceptarContraoferta: aceptarContraoferta, retirarse: retirarse, actual: actual };
})();
