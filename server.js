import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import webpush from 'web-push';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Middleware para JSON en API endpoints
app.use(express.json());

// ============================================================
// CONFIGURACIÓN DE NOTIFICACIONES PUSH Y CLAVES VAPID
// ============================================================
const VAPID_FILE = path.join(__dirname, 'push-vapid.json');
const SUBS_FILE = path.join(__dirname, 'push-subscriptions.json');
const AVISOS_FILE = path.join(__dirname, 'push-avisos.json');

let vapidKeys = null;
try {
  if (fs.existsSync(VAPID_FILE)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
  }
} catch (e) {
  console.warn('[Push] Error leyendo claves VAPID existentes:', e.message);
}

if (!vapidKeys || !vapidKeys.publicKey || !vapidKeys.privateKey) {
  try {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), 'utf8');
    console.log('[Push] Nuevas claves VAPID generadas con éxito');
  } catch (err) {
    console.error('[Push] Error generando claves VAPID:', err);
  }
}

if (vapidKeys && vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    'mailto:seguridad-operativa@baremo.app',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

// Helpers para almacenamiento persistente de suscripciones y avisos
function leerSuscripciones() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (e) {
    console.warn('[Push] Error leyendo suscripciones:', e.message);
  }
  return [];
}

function guardarSuscripciones(subs) {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Push] Error guardando suscripciones:', e.message);
  }
}

function leerAvisosEmpresa() {
  try {
    if (fs.existsSync(AVISOS_FILE)) {
      const data = JSON.parse(fs.readFileSync(AVISOS_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {}

  // Semilla inicial con avisos importantes de la empresa si no existe
  const avisosIniciales = [
    {
      id: 'aviso-init-1',
      titulo: '⚠️ Alerta de Seguridad: EPP y Arnés Obligatorio',
      cuerpo: 'Todo el personal en trabajos de altura o poda debe utilizar arnés con doble cabo de vida y verificar ausencia de tensión en líneas MT/BT.',
      prioridad: 'alta',
      categoria: 'Seguridad',
      autor: 'Dpto. de Higiene & Seguridad',
      fecha: '2026-09-13',
      leido: false
    },
    {
      id: 'aviso-init-2',
      titulo: '📋 Análisis de Trabajo Seguro (ATS) Diario',
      cuerpo: 'Recordá completar y firmar el ATS con todo el equipo antes de comenzar cualquier tarea en la vía pública. Podés exportar el PDF con firmas digitales.',
      prioridad: 'alta',
      categoria: 'Procedimiento',
      autor: 'Supervisión Operativa',
      fecha: '2026-09-12',
      leido: false
    },
    {
      id: 'aviso-init-3',
      titulo: '⏰ Alerta de Cierre de Jornadas Pendientes',
      cuerpo: 'Evitá dejar jornadas abiertas de días anteriores. Al finalizar el día, asegurate de cerrar tu jornada para consolidar la producción y baremos.',
      prioridad: 'media',
      categoria: 'Operaciones',
      autor: 'Administración BAREMO',
      fecha: '2026-09-11',
      leido: false
    },
    {
      id: 'aviso-init-4',
      titulo: '⛈️ Protocolo de Tormenta Eléctrica',
      cuerpo: 'Ante relámpagos o alerta meteorológica en la zona de trabajo, interrumpir inmediatamente las tareas en postes o grúas y guarecerse.',
      prioridad: 'media',
      categoria: 'Seguridad',
      autor: 'Coordinación Central',
      fecha: '2026-09-10',
      leido: false
    }
  ];

  try {
    fs.writeFileSync(AVISOS_FILE, JSON.stringify(avisosIniciales, null, 2), 'utf8');
  } catch (e) {}
  return avisosIniciales;
}

function guardarAvisosEmpresa(avisos) {
  try {
    fs.writeFileSync(AVISOS_FILE, JSON.stringify(avisos, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Push] Error guardando avisos de empresa:', e.message);
  }
}

// ============================================================
// ENDPOINTS DE NOTIFICACIONES PUSH
// ============================================================

// 1. Clave pública VAPID
app.get('/api/push/public-key', (req, res) => {
  if (!vapidKeys || !vapidKeys.publicKey) {
    return res.status(500).json({ error: 'VAPID no inicializado' });
  }
  res.json({ publicKey: vapidKeys.publicKey });
});

// 2. Estado general del servicio Push
app.get('/api/push/status', (req, res) => {
  const subs = leerSuscripciones();
  res.json({
    activo: !!(vapidKeys && vapidKeys.publicKey),
    totalSuscriptores: subs.length,
    publicKey: vapidKeys ? vapidKeys.publicKey : null
  });
});

// 3. Registrar / Actualizar suscripción Push del cliente
app.post('/api/push/subscribe', (req, res) => {
  try {
    const { subscription, user } = req.body || {};
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Suscripción inválida' });
    }

    const subs = leerSuscripciones();
    const index = subs.findIndex(s => s.endpoint === subscription.endpoint);
    const ahora = new Date().toISOString();

    const nuevoRegistro = {
      endpoint: subscription.endpoint,
      keys: subscription.keys || {},
      user: {
        legajo: (user && user.legajo) ? String(user.legajo) : '',
        nombre: (user && user.nombre) ? String(user.nombre) : 'Usuario'
      },
      updatedAt: ahora
    };

    if (index >= 0) {
      subs[index] = { ...subs[index], ...nuevoRegistro };
    } else {
      subs.push(nuevoRegistro);
    }

    guardarSuscripciones(subs);
    console.log(`[Push] Suscripción registrada/actualizada. Total suscriptores: ${subs.length}`);
    res.json({ ok: true, totalSuscriptores: subs.length });
  } catch (err) {
    console.error('[Push] Error al registrar suscripción:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Cancelar suscripción Push
app.post('/api/push/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'Endpoint requerido' });

    let subs = leerSuscripciones();
    const largoAntes = subs.length;
    subs = subs.filter(s => s.endpoint !== endpoint);
    guardarSuscripciones(subs);

    console.log(`[Push] Desuscripción procesada. Suscriptores restantes: ${subs.length}`);
    res.json({ ok: true, eliminados: largoAntes - subs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Enviar Notificación Push (Broadcast o a usuario específico)
app.post('/api/push/send', async (req, res) => {
  try {
    const {
      tipo = 'aviso_empresa', // 'jornada_pendiente' | 'aviso_empresa' | 'ats_pendiente' | 'alerta'
      titulo = '📢 Notificación BAREMO',
      cuerpo = 'Tenés una nueva notificación de la empresa.',
      tag,
      legajo,
      prioridad = 'normal',
      datos = {}
    } = req.body || {};

    const subs = leerSuscripciones();
    if (subs.length === 0) {
      return res.json({ ok: true, enviados: 0, mensaje: 'No hay dispositivos suscritos aún' });
    }

    // Filtrar por legajo si se especifica, o enviar a todos
    const destinatarios = legajo
      ? subs.filter(s => s.user && String(s.user.legajo) === String(legajo))
      : subs;

    if (destinatarios.length === 0) {
      return res.json({ ok: true, enviados: 0, mensaje: 'No se encontraron dispositivos para el legajo especificado' });
    }

    const payloadObj = {
      tipo,
      titulo,
      cuerpo,
      tag: tag || (`baremo-${tipo}-${Date.now()}`),
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: prioridad === 'alta' ? [300, 100, 300, 100, 300] : [200, 100, 200],
      requireInteraction: prioridad === 'alta',
      prioridad,
      timestamp: Date.now(),
      ...datos
    };

    const payloadString = JSON.stringify(payloadObj);
    const endpointsAEliminar = new Set();
    let enviados = 0;
    let fallidos = 0;

    await Promise.all(
      destinatarios.map(async sub => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: sub.keys
          };
          await webpush.sendNotification(pushSubscription, payloadString);
          enviados++;
        } catch (err) {
          fallidos++;
          // Si el endpoint expiró (404 Not Found o 410 Gone) se marca para borrar
          if (err.statusCode === 404 || err.statusCode === 410) {
            endpointsAEliminar.add(sub.endpoint);
          } else {
            console.warn('[Push] Error al enviar a un dispositivo:', err.statusCode, err.message);
          }
        }
      })
    );

    // Limpiar endpoints inválidos / desinstalados
    if (endpointsAEliminar.size > 0) {
      const subsRestantes = subs.filter(s => !endpointsAEliminar.has(s.endpoint));
      guardarSuscripciones(subsRestantes);
      console.log(`[Push] Se limpiaron ${endpointsAEliminar.size} suscripciones inactivas.`);
    }

    res.json({
      ok: true,
      enviados,
      fallidos,
      totalDestinatarios: destinatarios.length
    });
  } catch (err) {
    console.error('[Push] Error general enviando notificación push:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Obtener lista de Avisos Importantes de la Empresa
app.get('/api/push/avisos', (req, res) => {
  const avisos = leerAvisosEmpresa();
  res.json({ avisos });
});

// 7. Crear nuevo Aviso de la Empresa y enviarlo por Push
app.post('/api/push/avisos', async (req, res) => {
  try {
    const { titulo, cuerpo, prioridad = 'alta', categoria = 'Seguridad', autor = 'Supervisión' } = req.body || {};

    if (!titulo || !cuerpo) {
      return res.status(400).json({ error: 'Título y mensaje son obligatorios' });
    }

    const avisos = leerAvisosEmpresa();
    const hoyStr = new Date().toISOString().split('T')[0];
    const nuevoAviso = {
      id: 'aviso-' + Date.now(),
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      prioridad,
      categoria,
      autor: autor.trim() || 'Supervisión',
      fecha: hoyStr,
      creadoEn: new Date().toISOString()
    };

    avisos.unshift(nuevoAviso);
    guardarAvisosEmpresa(avisos);

    // Enviar Push a todos los suscriptores conectados
    const subs = leerSuscripciones();
    let enviados = 0;
    if (subs.length > 0) {
      const payloadString = JSON.stringify({
        tipo: 'aviso_empresa',
        id: nuevoAviso.id,
        titulo: `📢 ${nuevoAviso.titulo}`,
        cuerpo: nuevoAviso.cuerpo,
        tag: `baremo-aviso-${nuevoAviso.id}`,
        prioridad: nuevoAviso.prioridad,
        vibrate: nuevoAviso.prioridad === 'alta' ? [300, 150, 300, 150, 300] : [200, 100, 200],
        requireInteraction: nuevoAviso.prioridad === 'alta',
        datos: {
          vista: 'AvisosEmpresa',
          avisoId: nuevoAviso.id
        }
      });

      const endpointsAEliminar = new Set();
      await Promise.all(
        subs.map(async sub => {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payloadString);
            enviados++;
          } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              endpointsAEliminar.add(sub.endpoint);
            }
          }
        })
      );

      if (endpointsAEliminar.size > 0) {
        guardarSuscripciones(subs.filter(s => !endpointsAEliminar.has(s.endpoint)));
      }
    }

    res.json({ ok: true, aviso: nuevoAviso, pushEnviados: enviados });
  } catch (err) {
    console.error('[Push] Error creando aviso de la empresa:', err);
    res.status(500).json({ error: err.message });
  }
});

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'BAREMO', version: '5.9.50' });
});

// Servir archivos estáticos
app.use(express.static(__dirname, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (
      filePath.endsWith('.html') ||
      filePath.endsWith('.css') ||
      filePath.endsWith('.js') ||
      filePath.endsWith('baremo.json') ||
      filePath.endsWith('version.json') ||
      filePath.endsWith('VERSION')
    ) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Fallback a index.html solo para solicitudes de navegación HTML (sin extensión de archivo)
app.use((req, res) => {
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') {
    return res.status(404).end();
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`BAREMO server running on http://${HOST}:${PORT}`);
});
