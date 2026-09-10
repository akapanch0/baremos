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

  function esStandalone() {
    try {
      if (window.navigator.standalone === true) return true;                 // iOS
      if (!window.matchMedia) return false;
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.matchMedia('(display-mode: fullscreen)').matches ||
             window.matchMedia('(display-mode: minimal-ui)').matches ||
             window.matchMedia('(display-mode: window-controls-overlay)').matches;
    } catch (e) { return false; }
  }

  // Bypass de pruebas SOLO en localhost. En produccion no existe: la
  // aplicacion completa se abre unicamente como app instalada (standalone).
  var bypass = false;
  try {
    var esLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    if (esLocal && /[?&]app=1\b/.test(location.search)) {
      sessionStorage.setItem('baremos_bypass', '1');
      bypass = true;
    } else if (sessionStorage.getItem('baremos_bypass') === '1') {
      bypass = true;
    }
  } catch (e) {}

  // Sin http(s) no hay PWA posible (file://, etc.): se abre la app directo.
  var servidoPorWeb = location.protocol === 'http:' || location.protocol === 'https:';

  if (esStandalone() || bypass || !servidoPorWeb) {
    liberarApp();
    return;
  }

  // --- Navegador: se va a la landing ---
  // Se oculta el contenido solo mientras dura la redireccion, y se libera
  // si por cualquier motivo la redireccion no ocurre.
  html.setAttribute('data-gate', 'redirecting');

  var yaRedirigido = false;
  try {
    yaRedirigido = sessionStorage.getItem('baremos_redirect') === '1';
    sessionStorage.setItem('baremos_redirect', '1');
  } catch (e) {}

  if (yaRedirigido) {
    // Ya se intento ir a la landing y volvimos aca. La aplicacion NO se
    // muestra en el navegador bajo ninguna circunstancia: se deja un aviso
    // minimo con el acceso a la presentacion.
    try { sessionStorage.removeItem('baremos_redirect'); } catch (e) {}
    mostrarSoloApp();
    return;
  }

  try {
    location.replace('landing.html');
  } catch (e) {
    mostrarSoloApp();
    return;
  }

  // Red de seguridad: si la redireccion no ocurrio, tampoco se libera la app.
  setTimeout(function () {
    if (document.documentElement.getAttribute('data-gate') !== 'redirecting') return;
    mostrarSoloApp();
  }, 3000);

  /* Pantalla minima para el navegador. Nunca carga la aplicacion. */
  function mostrarSoloApp() {
    html.setAttribute('data-gate', 'blocked');
    var pintar = function () {
      try {
        document.body.innerHTML =
          '<div style="min-height:100svh;display:flex;flex-direction:column;' +
          'align-items:center;justify-content:center;gap:18px;padding:28px;' +
          'background:#000;color:#d4dae1;font-family:-apple-system,BlinkMacSystemFont,' +
          '\'Segoe UI\',Roboto,Arial,sans-serif;text-align:center">' +
          '<p style="font-size:14px;line-height:1.6;color:#8d97a3;max-width:32ch;margin:0">' +
          'BAREMO se usa como aplicacion instalada.</p>' +
          '<a href="landing.html" style="padding:14px 26px;border-radius:999px;' +
          'background:linear-gradient(135deg,#00aaff,#38c6ff);color:#00131f;' +
          'font-weight:700;font-size:15px;text-decoration:none">Ver la presentacion</a>' +
          '</div>';
        document.body.style.visibility = 'visible';
        html.removeAttribute('data-gate');
      } catch (e) {}
    };
    if (document.body) pintar();
    else document.addEventListener('DOMContentLoaded', pintar);
  }
})();
