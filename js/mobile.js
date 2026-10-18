/* ============================================================
   MOBILE — touch adaptation of the UI. Only runs if the
   device is mobile (is-mobile class set on <html> by the
   detector in index.html). Rearranges management like an
   app: bottom nav bar with the tabs, and the play button
   always within thumb reach.
   ============================================================ */

var Mobile = (function () {

  var activo = !!window.IS_MOBILE;

  // moves tabs + PLAY button into a fixed bottom bar
  function montarBarraInferior() {
    var manage = document.getElementById('screen-manage');
    var tabs = manage.querySelector('.tabs');
    var play = document.getElementById('btn-play-match');

    // icon on top, label below on each tab
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

  // −/+ buttons to fine-tune the offer on touch
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
