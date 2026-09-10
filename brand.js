/* ============================================================
   BAREMO - brand.js (v5.9.28)

   Muestra el logo original respetando colores y transparencia.
   No usa mascara ni recolorea la imagen.

   v5.9.28 - el logo del encabezado ya NO puede desaparecer:
   - El fondo del logo tambien esta declarado en CSS, asi que se ve incluso
     si este script tarda, falla o no se ejecuta.
   - Se aplica de inmediato, sin esperar la descarga de la imagen.
   - Un MutationObserver lo vuelve a poner si el DOM se re-dibuja o si algo
     limpia sus clases o estilos.
   - Reintentos con corte: si la imagen realmente no existe, se muestra el
     nombre BAREMO y nunca un bloque vacio.
   ============================================================ */
(function () {
  'use strict';

  var VERSION = '5.9.28';
  var SRC = 'icons/logo.png?v=' + VERSION;
  var MAX_REINTENTOS = 3;

  var estadoImagen = 'pendiente'; // pendiente | ok | falla
  var reintentos = 0;

  function esNodoLogo(el) {
    return !!(el && el.nodeType === 1 && el.hasAttribute && el.hasAttribute('data-brand-logo'));
  }

  function posicion(el) {
    return el.getAttribute('data-brand-align') === 'left' ? 'left center' : 'center';
  }

  /* Pinta el logo. Se llama enseguida, sin esperar la descarga: si la imagen
     ya esta en cache aparece al instante y, si no, aparece al terminar de
     bajar, igual que cualquier fondo CSS. */
  function aplicarLogo(el) {
    if (!el || !el.style) return;
    el.style.backgroundImage = 'url("' + SRC + '")';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundSize = 'contain';
    el.style.backgroundPosition = posicion(el);
    el.style.webkitMaskImage = 'none';
    el.style.maskImage = 'none';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.classList.remove('brand-cargando', 'brand-mask', 'brand-sin-logo');
    el.classList.add('brand-listo', 'brand-plana');
    if (el.textContent) el.textContent = '';
  }

  /* Ultimo recurso: sin archivo de logo se muestra el nombre, jamas un hueco. */
  function fallback(el) {
    if (!el) return;
    el.classList.remove('brand-cargando', 'brand-listo', 'brand-plana');
    el.classList.add('brand-sin-logo');
    el.style.backgroundImage = 'none';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    if (!el.textContent) el.textContent = el.getAttribute('data-brand-text') || 'BAREMO';
  }

  function nodos() {
    try {
      return document.querySelectorAll('[data-brand-logo]');
    } catch (e) {
      return [];
    }
  }

  function pintarTodos() {
    var lista = nodos();
    for (var i = 0; i < lista.length; i++) {
      if (estadoImagen === 'falla') fallback(lista[i]);
      else aplicarLogo(lista[i]);
    }
  }

  /* Verificacion aparte: solo sirve para decidir si hay que mostrar el texto
     de reserva. El logo ya se pinto antes, asi que esta comprobacion nunca
     puede dejar la cabecera sin marca. */
  function verificarImagen() {
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      if (!img.naturalWidth) { img.onerror(); return; }
      estadoImagen = 'ok';
      pintarTodos();
    };
    img.onerror = function () {
      if (reintentos < MAX_REINTENTOS) {
        reintentos++;
        setTimeout(verificarImagen, 600 * reintentos);
        return;
      }
      estadoImagen = 'falla';
      pintarTodos();
    };
    img.src = SRC;
  }

  /* Si el DOM cambia (re-render de vistas, cabecera re-dibujada, clases
     borradas por otro script) el logo se vuelve a aplicar solo. */
  function vigilar() {
    if (!window.MutationObserver || !document.documentElement) return;
    var pendiente = false;
    var obs = new MutationObserver(function (cambios) {
      if (pendiente) return;
      var hayQueRevisar = false;
      for (var i = 0; i < cambios.length && !hayQueRevisar; i++) {
        var c = cambios[i];
        if (c.type === 'attributes' && esNodoLogo(c.target)) { hayQueRevisar = true; break; }
        for (var j = 0; j < c.addedNodes.length; j++) {
          var n = c.addedNodes[j];
          if (esNodoLogo(n)) { hayQueRevisar = true; break; }
          if (n.nodeType === 1 && n.querySelector && n.querySelector('[data-brand-logo]')) {
            hayQueRevisar = true;
            break;
          }
        }
      }
      if (!hayQueRevisar) return;
      pendiente = true;
      setTimeout(function () { pendiente = false; pintarTodos(); }, 60);
    });
    try {
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    } catch (e) {}
  }

  function iniciar() {
    pintarTodos();
    verificarImagen();
    vigilar();
    // red de seguridad: repasos puntuales durante el arranque de la app
    setTimeout(pintarTodos, 400);
    setTimeout(pintarTodos, 1500);
    setTimeout(pintarTodos, 3000);
    window.addEventListener('pageshow', pintarTodos);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) pintarTodos();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
    // por si el script se carga antes del <body>, igual pinta lo que ya exista
    pintarTodos();
  } else {
    iniciar();
  }
})();
