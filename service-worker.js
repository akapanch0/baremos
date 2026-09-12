/* ============================================================
   BAREMO - Service Worker

   REGLA CENTRAL
   La app instalada NO se actualiza sola: los archivos guardados
   quedan congelados y se siguen sirviendo hasta que el usuario
   acepte la actualizacion desde el aviso de abajo.

   IMPORTANTE (correccion 5.9.29)
   El hosting usa cleanUrls, o sea que /index.html contesta con un
   redirect 308 hacia /index. Un service worker NO puede entregar
   una respuesta redirigida a una navegacion: el navegador la
   rechaza y se ve el cartel de sin conexion. Ademas cache.add()
   falla con redirects, asi que el html nunca quedaba guardado.
   Por eso todas las respuestas se SANEAN antes de guardarlas y
   antes de entregarlas, y si algo sale mal siempre se sale a la red.
   ============================================================ */
/* ------------------------------------------------------------
   NOMBRE DE LA CACHE CON LA VERSION ADENTRO (correccion v5.9.29)

   EL BUG: la cache se llamaba siempre 'baremo-shell', sin version. Como
   las navegaciones se responden con el index.html guardado, al publicar
   una version nueva el telefono seguia mostrando el index.html VIEJO,
   que a su vez pedia app.js?v=<version vieja> y styles.css?v=<version
   vieja>. Resultado: se publicaban los cambios y en el telefono no se
   veia absolutamente nada. Los archivos nuevos ni se pedian.

   LA CORRECCION: el nombre lleva la version. Una version nueva estrena
   cache nueva, con el index.html nuevo adentro, y en 'activate' se
   borran las anteriores.

   IMPORTANTE: esto es SOLO cache de archivos (HTML, CSS, JS, imagenes).
   Las bases de datos con jornadas, usuarios, combustible y quincenas
   viven en IndexedDB y no se tocan nunca.

   Se mantiene el control del usuario: el service worker nuevo espera y
   la cache vieja recien se reemplaza cuando se acepta actualizar.
   ------------------------------------------------------------ */
const SHELL_CACHE = 'baremo-shell-5.9.49';

// Se guardan las dos formas de cada pagina (con y sin .html) porque el
// hosting puede entrar por cualquiera de las dos.
const PAGINAS = ['./', './index.html', './index', './landing.html', './landing'];

// Copias locales de las librerias (si estan en ./vendor). Si no existen, se
// omiten en silencio y la app usa el CDN, que tambien queda cacheado.
const VENDOR_ASSETS = [
  './vendor/chart.umd.min.js?v=5.9.49',
  './vendor/jspdf.umd.min.js?v=5.9.49',
  './vendor/jspdf.plugin.autotable.min.js?v=5.9.49',
  './vendor/xlsx.full.min.js?v=5.9.49'
];

const ASSETS = [
  './landing.css?v=5.9.49',
  './styles.css?v=5.9.49',
  './main.js?v=5.9.49',
  './brand.js?v=5.9.49',
  './app.js?v=5.9.49',
  './db.js?v=5.9.49',
  './baremo.json',
  './manifest.json?v=5.9.49',
  './icons/logo.png?v=5.9.49',
  './icons/icon-192.png?v=5.9.49',
  './icons/icon-512.png?v=5.9.49',
  './icons/icon-any-192.png?v=5.9.49',
  './icons/icon-any-512.png?v=5.9.49',
  './icons/icon-maskable-192.png?v=5.9.49',
  './icons/icon-maskable-512.png?v=5.9.49',
  './icons/apple-touch-icon-180.png?v=5.9.49',
  './maps/trujui.png', './maps/cuartelv.png', './maps/moreno.png',
  './maps/gralrodriguez.png', './maps/tigre.png', './maps/sanmartin.png',
  './maps/olivos.png', './maps/pilarescobar.png',
  './help/baremos-1.png?v=5.9.49',
  './help/baremos-2.png?v=5.9.49',
  './help/baremos-3.png?v=5.9.49',
  './help/baremos-4.png?v=5.9.49',
  './help/baremos-5.png?v=5.9.49'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.6.0/dist/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

function esArchivoDeVersion(url) {
  return url.pathname.endsWith('version.json') || url.pathname.endsWith('VERSION');
}

/* Convierte una respuesta redirigida en una respuesta comun, que si se puede
   guardar y entregar en una navegacion. */
async function sanear(respuesta) {
  if (!respuesta) return null;
  if (!respuesta.redirected && respuesta.status < 300) return respuesta;
  if (!respuesta.ok) return null;
  const cuerpo = await respuesta.blob();
  return new Response(cuerpo, {
    status: 200,
    statusText: 'OK',
    headers: respuesta.headers
  });
}

function sirveParaNavegar(respuesta) {
  return !!respuesta && respuesta.ok && !respuesta.redirected && respuesta.status < 300;
}

async function guardarSiFalta(cache, url) {
  try {
    if (await cache.match(url)) return;
    const r = await fetch(url, { redirect: 'follow', cache: 'reload' });
    const limpia = await sanear(r);
    if (limpia) await cache.put(url, limpia);
  } catch (e) { /* si un archivo no esta, se sigue con el resto */ }
}

/* ---------- INSTALACION ---------- */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    for (const url of PAGINAS) await guardarSiFalta(cache, url);
    for (const url of ASSETS) await guardarSiFalta(cache, url);
    for (const url of VENDOR_ASSETS) await guardarSiFalta(cache, url);
    for (const url of CDN_ASSETS) await guardarSiFalta(cache, url);
    // v5.9.39: sin esto la version nueva quedaba "esperando" y el usuario
    // seguia viendo la anterior (con los colores viejos) al abrir la app.
    try { await self.skipWaiting(); } catch (e) {}
  })());
});

/* ---------- ACTIVACION ----------
   v5.9.29: antes solo se borraban las caches con prefijo "baremos-v", que ya
   no se usa desde hace varias versiones, asi que las caches viejas quedaban
   ocupando lugar para siempre. Ahora se borra TODA cache de esta app que no
   sea la actual. Esto toca unicamente el cache de archivos: la base de datos
   con las jornadas, usuarios, combustible y quincenas NO se toca nunca.

   Ademas se unifican aca las dos tareas de activacion (limpieza y revision de
   avisos vencidos), que antes vivian en dos listeners separados y la segunda
   corria sin waitUntil, por lo que el navegador podia cortarla por la mitad. */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && /^baremos?[-_]/i.test(k))
          .map(k => caches.delete(k))
      );
    } catch (e) {}

    try { await self.clients.claim(); } catch (e) {}

    // Avisos que hayan vencido mientras el service worker estaba dormido.
    try { await revisarAvisosVencidos(); } catch (e) {}
  })());
});

/* ---------- NAVEGACION ----------
   Se entrega la pagina guardada (asi la app no se actualiza sola), pero
   solo si sirve de verdad. Ante cualquier duda, se sale a la red. */
async function responderNavegacion(request) {
  const cache = await caches.open(SHELL_CACHE);
  const url = new URL(request.url);
  const sinHtml = url.pathname.replace(/\.html$/, '');

  const candidatos = [
    request,
    url.pathname,
    sinHtml,
    sinHtml + '.html'
  ];

  for (const c of candidatos) {
    try {
      const guardada = await cache.match(c, { ignoreSearch: true });
      if (sirveParaNavegar(guardada)) return guardada;
    } catch (e) {}
  }

  // No habia nada usable guardado: se busca en la red y se guarda saneado.
  try {
    const r = await fetch(request, { redirect: 'follow' });
    const limpia = await sanear(r);
    if (sirveParaNavegar(limpia)) {
      try { await cache.put(url.pathname, limpia.clone()); } catch (e) {}
      return limpia;
    }
    if (r && !r.redirected) return r;
  } catch (e) {}

  // Sin red: se ofrece lo que haya.
  for (const c of ['./index.html', './index', './landing.html', './landing', './']) {
    try {
      const g = await cache.match(c, { ignoreSearch: true });
      if (sirveParaNavegar(g)) return g;
    } catch (e) {}
  }

  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font-family:system-ui;text-align:center;padding:40px">' +
    '<h1 style="color:#4338ca">BAREMO</h1><p>No hay conexion en este momento.</p>' +
    '<p><a href="./index" style="color:#4338ca">Reintentar</a></p></div>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  let url;
  try { url = new URL(event.request.url); } catch (e) { return; }

  // Los archivos de version SIEMPRE van a la red y nunca se guardan: son los
  // que permiten detectar la version nueva desde adentro de la app.
  if (esArchivoDeVersion(url)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      responderNavegacion(event.request).catch(() => fetch(event.request))
    );
    return;
  }

  // Resto de archivos: primero lo guardado, si no la red.
  event.respondWith((async () => {
    try {
      const guardada = await caches.match(event.request);
      if (guardada) return guardada;
    } catch (e) {}

    try {
      const r = await fetch(event.request);
      if (r && r.ok && url.origin === location.origin && !r.redirected) {
        const copia = r.clone();
        caches.open(SHELL_CACHE).then(c => c.put(event.request, copia)).catch(() => {});
      }
      return r;
    } catch (e) {
      try {
        const cache = await caches.open(SHELL_CACHE);
        const alt = await cache.match(event.request, { ignoreSearch: true });
        if (alt) return alt;
      } catch (e2) {}
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

/* ---------- MENSAJES DE LA APP ----------
   v5.9.29: un solo listener para los dos mensajes. Antes habia dos
   addEventListener('message') separados, lo que hacia dificil seguir el hilo.
   Importante: aca solo se borra el CACHE DE ARCHIVOS. Las bases de datos con
   la informacion del usuario nunca se tocan. */
self.addEventListener('message', event => {
  const data = event.data;

  if (data === 'SKIP_WAITING' || data === 'APLICAR_ACTUALIZACION') {
    event.waitUntil((async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(k => k !== SHELL_CACHE && /^baremos?[-_]/i.test(k))
            .map(k => caches.delete(k).catch(() => false))
        );
      } catch (e) {}
      await self.skipWaiting();
    })());
    return;
  }

  if (data === 'REVISAR_AVISOS') {
    event.waitUntil(revisarAvisosVencidos());
    return;
  }

  // Servicio de notificación local para ATS pendiente
  if (data && (data.tipo === 'NOTIFICAR_ATS' || data === 'NOTIFICAR_ATS')) {
    event.waitUntil((async () => {
      try {
        if (!self.registration || !self.registration.showNotification) return;
        await self.registration.showNotification(data.titulo || '⚠️ ATS Pendiente - Seguridad en el Trabajo', {
          body: data.cuerpo || 'Recordá completar el Análisis de Trabajo Seguro (ATS) antes de iniciar las tareas del día.',
          tag: 'baremo-ats-recordatorio',
          renotify: true,
          requireInteraction: true,
          silent: false,
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          vibrate: [300, 150, 300, 150, 300],
          timestamp: Date.now(),
          data: { tipo: 'ats-recordatorio', accion: 'abrir_ats', vista: 'Registro' }
        });
      } catch (e) {}
    })());
    return;
  }

  if (data && (data.tipo === 'LIMPIAR_NOTIFICACION_ATS' || data === 'LIMPIAR_NOTIFICACION_ATS')) {
    event.waitUntil((async () => {
      try {
        if (!self.registration || !self.registration.getNotifications) return;
        const notifs = await self.registration.getNotifications({ tag: 'baremo-ats-recordatorio' });
        for (const n of notifs) n.close();
      } catch (e) {}
    })());
    return;
  }
});

/* ============================================================
   AVISOS CON LA APP CERRADA (v5.9.29)

   La app agenda sus avisos en IndexedDB (base BaremoAvisos). Cuando el
   navegador despierta al service worker (Periodic Background Sync o un
   sync comun), se revisan los vencidos y se muestran en la barra de
   notificaciones del sistema, aunque la app este cerrada o suspendida.
   ============================================================ */
const AVISOS_DB_NAME = 'BaremoAvisos';
const AVISOS_DB_VERSION = 1;
const AVISOS_STORE = 'avisos';
const SYNC_TAG_AVISOS = 'baremo-avisos';

function abrirAvisosDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(AVISOS_DB_NAME, AVISOS_DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(AVISOS_STORE)) {
          d.createObjectStore(AVISOS_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

async function revisarAvisosVencidos() {
  try {
    if (!self.registration || !self.registration.showNotification) return;

    const d = await abrirAvisosDB();
    const avisos = await new Promise((res, rej) => {
      const r = d.transaction(AVISOS_STORE).objectStore(AVISOS_STORE).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });

    const ahora = Date.now();
    // v5.9.35 - un aviso con fecha de expiracion (por ejemplo el del inicio de
    // mes) no se muestra si el telefono desperto al service worker al otro dia.
    const vencidos = avisos.filter(a => a && !a.mostrado && a.vence && a.vence <= ahora &&
      (!a.expira || a.expira > ahora));

    // v5.9.35 - si quedaron varias franjas juntas (el telefono estuvo
    // apagado), sale solo la mas reciente de cada tag; las anteriores se dan
    // por vistas y no se acumulan en la barra.
    const ultimoPorTag = {};
    for (const a of vencidos) {
      const t = a.tag || ('baremo-' + a.id);
      if (!ultimoPorTag[t] || (a.vence || 0) > (ultimoPorTag[t].vence || 0)) ultimoPorTag[t] = a;
    }

    for (const a of vencidos) {
      try {
        const t = a.tag || ('baremo-' + a.id);
        if (ultimoPorTag[t] === a) {
          await self.registration.showNotification(a.titulo, {
            body: a.cuerpo,
            tag: t,
            renotify: true,
            requireInteraction: !!a.requiereInteraccion,
            silent: false,
            icon: './icons/icon-192.png',
            badge: './icons/icon-192.png',
            vibrate: [200, 100, 200],
            timestamp: a.vence || ahora,
            data: a.datos || { tipo: a.id }
          });
        }

        // Queda marcado para no repetirlo cuando la app vuelva a abrirse.
        a.mostrado = true;
        a.mostradoEn = ahora;
        await new Promise((res, rej) => {
          const r = d.transaction(AVISOS_STORE, 'readwrite').objectStore(AVISOS_STORE).put(a);
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        });
      } catch (e) {}
    }

    d.close();
  } catch (e) {}
}

// El navegador despierta al service worker cada tanto con la app cerrada.
self.addEventListener('periodicsync', event => {
  if (event.tag === SYNC_TAG_AVISOS) event.waitUntil(revisarAvisosVencidos());
});

// Respaldo: sync comun, que se ejecuta en cuanto el navegador puede.
self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG_AVISOS) event.waitUntil(revisarAvisosVencidos());
});

// (El mensaje REVISAR_AVISOS y la revision al activar se manejan mas arriba,
//  en el listener unico de 'message' y en el de 'activate'.)

/* ---------- AL TOCAR UNA NOTIFICACION ---------- */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const datos = event.notification.data || {};
  const vista = datos.vista || 'Registro';
  const accion = datos.accion || '';

  event.waitUntil((async () => {
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientes) {
      if ('focus' in c) {
        try { c.postMessage({ tipo: 'IR_A_REGISTRO', vista: vista, accion: accion }); } catch (e) {}
        return c.focus();
      }
    }
    const url = './index.html?app=1' + (accion === 'abrir_ats' ? '&ats=1' : '');
    return self.clients.openWindow(url);
  })());
});
