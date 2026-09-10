/* ============================================================
   BAREMO — Puerta de entrada (gate PWA)
   La aplicacion completa se usa en modo standalone (app instalada).
   Desde el navegador se redirige a la landing de presentacion.

   IMPORTANTE: este archivo NUNCA debe detener la carga de la pagina
   (nada de window.stop()). Si algo falla, la app tiene que arrancar
   igual; jamas puede quedar una pantalla gris.
   ============================================================ */
(function () {
  'use strict';

  var html = document.documentElement;

  function liberarApp() {
    html.removeAttribute('data-gate');
    html.setAttribute('data-pwa', 'app');
  }

  // En entorno web y vista previa de AI Studio, liberar la aplicación directamente
  liberarApp();
})();
