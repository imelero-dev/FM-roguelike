/* ============================================================
   NEGO — minijuego de negociación (compra/venta) contra IA
   con paciencia y precio de reserva ocultos.
   ============================================================ */

var Nego = (function () {

  // sesión de negociación activa
  var sesion = null;

  // modo: 'compra' (regateas hacia abajo) o 'venta' (regateas hacia arriba)
  function iniciar(modo, carta, precioBase) {
    var reserva, paciencia;
    if (modo === 'compra') {
      // el vendedor no acepta por debajo de su reserva
      reserva = Math.round(precioBase * (0.82 + RNG.f() * 0.16));   // 82%-98% del precio
      paciencia = RNG.int(2, 3);
    } else {
      // el comprador no paga por encima de su tope
      reserva = Math.round(precioBase * (1.02 + RNG.f() * 0.35));   // 102%-137% del valor de venta
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

  // Presenta una oferta. Devuelve {estado: 'aceptada'|'contraoferta'|'rota', contraoferta?}
  function ofertar(cantidad) {
    if (!sesion || sesion.cerrada) return { estado: 'rota' };
    sesion.ronda++;
    sesion.ultimaOferta = cantidad;
    var m = sesion.modo;

    var acepta = m === 'compra' ? cantidad >= sesion.reserva : cantidad <= sesion.reserva;
    // ofertas muy cercanas a la reserva pueden colar con suerte
    if (!acepta) {
      var margen = Math.abs(cantidad - sesion.reserva) / sesion.reserva;
      if (margen < 0.06 && RNG.chance(0.5)) acepta = true;
    }

    if (acepta) {
      sesion.cerrada = true;
      return { estado: 'aceptada', precio: cantidad };
    }

    if (sesion.ronda >= sesion.maxRondas) {
      // última bala: la IA lanza su ultimátum en vez de romper, si la oferta no fue insultante
      var insulto = m === 'compra' ? cantidad < sesion.reserva * 0.6 : cantidad > sesion.reserva * 1.6;
      if (insulto) {
        sesion.cerrada = true;
        return { estado: 'rota' };
      }
      sesion.contraoferta = sesion.reserva;
      return { estado: 'ultimatum', contraoferta: sesion.reserva };
    }

    // contraoferta: se mueve desde su posición hacia la tuya, sin cruzar la reserva
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
