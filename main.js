/* ============================================================
   BAREMO — Puerta de entrada (gate PWA) y Detección de Actualizaciones SW
   La aplicación completa se usa en modo standalone (app instalada) o web.
   Gestiona la detección del ciclo de vida del Service Worker (updatefound,
   waiting, skipWaiting y controllerchange con recarga limpia).

   IMPORTANTE: este archivo NUNCA debe detener la carga de la página
   (nada de window.stop()). Si algo falla, la app tiene que arrancar
   igual; jamás puede quedar una pantalla gris.
   ============================================================ */
(function () {
  'use strict';

  var html = document.documentElement;

  function esStandalone() {
    try {
      if (window.navigator.standalone === true) return true;
      var params = new URLSearchParams(window.location.search);
      // Parámetros de desarrollo o apertura directa autorizada
      if (params.has('app') || params.has('standalone') || params.has('preview')) return true;
      if (window.matchMedia) {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.matchMedia('(display-mode: fullscreen)').matches ||
               window.matchMedia('(display-mode: minimal-ui)').matches ||
               window.matchMedia('(display-mode: window-controls-overlay)').matches;
      }
    } catch (e) {}
    return false;
  }

  function liberarApp() {
    html.removeAttribute('data-gate');
    html.setAttribute('data-pwa', 'app');
  }

  // La aplicación es accesible ÚNICAMENTE desde la instalación standalone.
  // En el navegador estándar, la app no abre ni muestra funcionalidades; se redirige a la Landing.
  if (esStandalone()) {
    liberarApp();
  } else {
    html.setAttribute('data-gate', 'redirecting');
    window.location.replace('landing.html');
    return;
  }

  /* ============================================================
     GESTIÓN DE ACTUALIZACIONES DEL SERVICE WORKER (CICLO DE VIDA)
     ============================================================ */
  window.__swRegistration = null;
  window.__swWaitingWorker = null;
  window.__swUpdateAvailable = false;
  window.__isReloadingForUpdate = false;

  // Disparar barra de actualización cuando hay un nuevo Service Worker esperando
  window.dispararBarraActualizacion = function (reg, worker) {
    var waiting = worker || (reg && reg.waiting) || null;
    window.__swWaitingWorker = waiting;
    window.__swUpdateAvailable = true;

    if (window.State) {
      window.State.updateAvailable = true;
    }

    try {
      window.dispatchEvent(new CustomEvent('swUpdateAvailable', {
        detail: { registration: reg, worker: waiting }
      }));
    } catch (e) {}

    function intentarMostrar() {
      if (typeof window.showUpdateNotification === 'function') {
        window.showUpdateNotification(false);
        return true;
      }
      return false;
    }

    if (!intentarMostrar()) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          setTimeout(intentarMostrar, 200);
        });
      } else {
        setTimeout(intentarMostrar, 300);
      }
    }
  };

  // Función global para aplicar la actualización (skipWaiting y recarga)
  window.aplicarActualizacionSW = function () {
    return new Promise(function (resolve) {
      var reg = window.__swRegistration || window.swRegistration;
      var worker = (reg && reg.waiting) || window.__swWaitingWorker;

      console.info('[SW Lifecycle] Aplicando actualización de Service Worker...');

      if (worker) {
        worker.postMessage({ type: 'SKIP_WAITING' });
        worker.postMessage('SKIP_WAITING');
        worker.postMessage('APLICAR_ACTUALIZACION');
      } else if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        navigator.serviceWorker.controller.postMessage('SKIP_WAITING');
        navigator.serviceWorker.controller.postMessage('APLICAR_ACTUALIZACION');
      }

      // Fallback de recarga si controllerchange no dispara a tiempo
      setTimeout(function () {
        if (!window.__isReloadingForUpdate) {
          window.__isReloadingForUpdate = true;
          console.info('[SW Lifecycle] Fallback de recarga activado.');
          try {
            var u = new URL(window.location.href);
            u.searchParams.set('nocache', String(Date.now()));
            u.searchParams.set('updated', '1');
            window.location.replace(u.toString());
          } catch (e) {
            window.location.reload();
          }
        }
        resolve();
      }, 1200);
    });
  };

  // Escucha del ciclo de vida en navegadores con soporte
  if ('serviceWorker' in navigator) {
    // Escuchar controllerchange para recargar la página inmediatamente cuando el nuevo SW tome el control
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (window.__isReloadingForUpdate) return;
      window.__isReloadingForUpdate = true;
      console.info('[SW Lifecycle] Evento controllerchange disparado. Recargando página para activar versión fresca...');
      try {
        var u = new URL(window.location.href);
        u.searchParams.set('nocache', String(Date.now()));
        u.searchParams.set('updated', '1');
        window.location.replace(u.toString());
      } catch (e) {
        window.location.reload();
      }
    });

    // Registrar e iniciar monitoreo de actualizaciones
    function iniciarMonitoreoSW() {
      navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).then(function (reg) {
        window.__swRegistration = reg;
        window.swRegistration = reg;

        // 1. Si ya había un Service Worker en espera (waiting) al cargar la página
        if (reg.waiting) {
          console.info('[SW Lifecycle] Service Worker en estado WAITING encontrado al iniciar.');
          window.dispararBarraActualizacion(reg, reg.waiting);
        }

        // 2. Escuchar el evento 'updatefound' cuando se detecta y descarga una nueva versión
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          if (!newWorker) return;
          console.info('[SW Lifecycle] Evento updatefound detectado: instalando nuevo Service Worker...');

          newWorker.addEventListener('statechange', function () {
            console.info('[SW Lifecycle] Estado del nuevo Service Worker:', newWorker.state);

            // Cuando pasa a 'installed', si hay un controller activo significa que es una actualización disponible
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.info('[SW Lifecycle] Nuevo Service Worker INSTALADO y esperando activación. Disparando barra...');
                window.dispararBarraActualizacion(reg, newWorker);
              } else {
                console.info('[SW Lifecycle] Service Worker instalado por primera vez en este dispositivo.');
              }
            }
          });
        });

        // 3. Chequeo proactivo cuando la pestaña recupera el foco o conexión
        window.addEventListener('focus', function () {
          try { reg.update(); } catch (e) {}
        });
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            try { reg.update(); } catch (e) {}
          }
        });
      }).catch(function (err) {
        console.warn('[SW Lifecycle] Error al registrar Service Worker:', err);
      });
    }

    if (document.readyState === 'complete') {
      iniciarMonitoreoSW();
    } else {
      window.addEventListener('load', iniciarMonitoreoSW);
    }
  }
})();

