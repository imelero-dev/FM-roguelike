/* ============================================================
   MOBILE — adaptación táctil de la UI. Solo actúa si el
   dispositivo es móvil (clase is-mobile puesta en <html> por
   el detector de index.html). Reorganiza la gestión como una
   app: barra de navegación inferior con las pestañas y el
   botón de jugar siempre a mano del pulgar.
   ============================================================ */

var Mobile = (function () {

  var activo = !!window.IS_MOBILE;

  // mueve tabs + botón JUGAR a una barra inferior fija
  function montarBarraInferior() {
    var manage = document.getElementById('screen-manage');
    var tabs = manage.querySelector('.tabs');
    var play = document.getElementById('btn-play-match');

    // icono arriba, etiqueta debajo en cada pestaña
    tabs.querySelectorAll('.tab').forEach(function (t) {
      var partes = t.textContent.trim().split(' ');
      var icono = partes.shift();
      t.innerHTML = '<span class="tab-ico">' + icono + '</span>' +
        '<span class="tab-txt">' + partes.join(' ') + '</span>';
    });

    var barra = document.createElement('div');
    barra.id = 'mobile-bottom';
    var accion = document.createElement('div');
    accion.id = 'mobile-action';
    accion.appendChild(play);
    barra.appendChild(accion);
    barra.appendChild(tabs);
    manage.appendChild(barra);
  }

  // botones −/+ para ajustar la oferta con precisión en táctil
  function montarSteppers() {
    var slider = document.getElementById('nego-slider');
    function paso() {
      var rango = (+slider.max) - (+slider.min);
      return Math.max(5, Math.round(rango / 30 / 5) * 5);
    }
    function mover(signo) {
      AudioFX.click();
      var v = (+slider.value) + signo * paso();
      slider.value = Math.max(+slider.min, Math.min(+slider.max, v));
      slider.dispatchEvent(new Event('input'));
    }
    document.getElementById('nego-minus').onclick = function () { mover(-1); };
    document.getElementById('nego-plus').onclick = function () { mover(1); };
  }

  function init() {
    if (!activo) return;
    montarBarraInferior();
    montarSteppers();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { activo: activo };
})();
