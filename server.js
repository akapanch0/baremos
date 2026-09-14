import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
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
const ADMIN_AUTH_FILE = path.join(__dirname, 'admin-auth.json');
const LIVE_ALERTS_FILE = path.join(__dirname, 'push-live-alerts.json');
const JORNADAS_REMOTAS_FILE = path.join(__dirname, 'jornadas-remotas.json');
const USUARIOS_REMOTOS_FILE = path.join(__dirname, 'usuarios-remotos.json');

// ============================================================
// GESTIÓN REMOTA DE CLAVE MAESTRA DE ADMINISTRADOR
// ============================================================
function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

function leerConfigAdmin() {
  try {
    if (fs.existsSync(ADMIN_AUTH_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_AUTH_FILE, 'utf8'));
      if (data && data.hash && data.salt) return data;
    }
  } catch (e) {
    console.warn('[Admin] Error leyendo config admin:', e.message);
  }
  return null;
}

function guardarConfigAdmin(config) {
  try {
    fs.writeFileSync(ADMIN_AUTH_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[Admin] Error guardando config admin:', e);
  }
}

function inicializarClaveAdmin() {
  const cfg = leerConfigAdmin();
  if (!cfg) {
    const defaultPassword = process.env.ADMIN_MASTER_PASSWORD || 'admin';
    const { hash, salt } = hashPassword(defaultPassword);
    guardarConfigAdmin({
      hash,
      salt,
      actualizado: new Date().toISOString(),
      esDefecto: true
    });
    console.log('[Admin] Clave maestra inicial inicializada');
  }
}
inicializarClaveAdmin();

function verificarClaveMaestra(passwordIngresada) {
  if (!passwordIngresada || typeof passwordIngresada !== 'string') return { ok: false };
  const pass = passwordIngresada.trim();

  // 1. Validar contra admin-auth.json si existe
  const cfg = leerConfigAdmin();
  if (cfg && cfg.salt && cfg.hash) {
    const calculatedHash = crypto.pbkdf2Sync(pass, cfg.salt, 100000, 32, 'sha256').toString('hex');
    if (crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(cfg.hash))) {
      return { ok: true, esDefecto: !!cfg.esDefecto };
    }
  }

  // 2. Contraseñas de fábrica válidas: 'admin', 'baremo2026' o variable de entorno
  const defaults = ['admin', 'baremo2026'];
  if (process.env.ADMIN_MASTER_PASSWORD) defaults.push(process.env.ADMIN_MASTER_PASSWORD);

  if (defaults.includes(pass)) {
    return { ok: true, esDefecto: true };
  }

  return { ok: false };
}

const TOKENS_FILE = path.join(__dirname, 'push-admin-tokens.json');

function leerTokensPersistentes() {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const arr = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
      if (Array.isArray(arr)) {
        const map = new Map();
        const now = Date.now();
        arr.forEach(item => {
          if (item && item[0] && item[1] && item[1].expiresAt > now) {
            map.set(item[0], item[1]);
          }
        });
        return map;
      }
    }
  } catch (e) {
    console.warn('[Admin] Error leyendo tokens persistentes:', e.message);
  }
  return new Map();
}

function guardarTokensPersistentes(map) {
  try {
    const now = Date.now();
    const arr = Array.from(map.entries()).filter(item => item[1] && item[1].expiresAt > now);
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Admin] Error guardando tokens persistentes:', e.message);
  }
}

const activeAdminTokens = leerTokensPersistentes();

function generarTokenAdmin() {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  activeAdminTokens.set(token, {
    createdAt: now,
    expiresAt: now + (7 * 24 * 60 * 60 * 1000) // 7 días de sesión
  });
  guardarTokensPersistentes(activeAdminTokens);
  return token;
}

function validarTokenAdmin(token) {
  if (!token) return false;
  const info = activeAdminTokens.get(token);
  if (!info) return false;
  if (Date.now() > info.expiresAt) {
    activeAdminTokens.delete(token);
    guardarTokensPersistentes(activeAdminTokens);
    return false;
  }
  return true;
}

function requireAdminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const pass = req.headers['x-admin-password'] || req.body?.adminPassword;

  if (token && validarTokenAdmin(token)) {
    return next();
  }
  if (pass) {
    const v = verificarClaveMaestra(pass);
    if (v.ok) return next();
  }
  return res.status(401).json({ error: 'No autorizado. Se requiere Clave Maestra de Administrador.' });
}

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

// Helpers para alertas en vivo y sincronización remota de reportes
function leerLiveAlerts() {
  try {
    if (fs.existsSync(LIVE_ALERTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(LIVE_ALERTS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [];
}

function guardarLiveAlerts(alerts) {
  try {
    const limpios = Array.isArray(alerts) ? alerts.slice(0, 100) : [];
    fs.writeFileSync(LIVE_ALERTS_FILE, JSON.stringify(limpios, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Live Alerts] Error guardando alertas:', e.message);
  }
}

function registrarLiveAlert(alertObj) {
  try {
    const alerts = leerLiveAlerts();
    const itemConTimestamp = {
      ...alertObj,
      timestamp: Number(alertObj.timestamp) || Date.now(),
      creadoEn: alertObj.creadoEn || new Date().toISOString()
    };
    const existe = alerts.findIndex(a => a.id === itemConTimestamp.id);
    if (existe >= 0) {
      alerts[existe] = { ...alerts[existe], ...itemConTimestamp };
    } else {
      alerts.unshift(itemConTimestamp);
    }
    guardarLiveAlerts(alerts);
  } catch (e) {
    console.warn('[Live Alerts] Error registrando alerta:', e.message);
  }
}

function leerJornadasRemotas() {
  try {
    if (fs.existsSync(JORNADAS_REMOTAS_FILE)) {
      const data = JSON.parse(fs.readFileSync(JORNADAS_REMOTAS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [];
}

function guardarJornadasRemotas(jornadas) {
  try {
    fs.writeFileSync(JORNADAS_REMOTAS_FILE, JSON.stringify(jornadas, null, 2), 'utf8');
  } catch (e) {
    console.error('[Sync] Error guardando jornadas remotas:', e.message);
  }
}

function leerUsuariosRemotos() {
  try {
    if (fs.existsSync(USUARIOS_REMOTOS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USUARIOS_REMOTOS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [];
}

function guardarUsuariosRemotos(usuarios) {
  try {
    fs.writeFileSync(USUARIOS_REMOTOS_FILE, JSON.stringify(usuarios, null, 2), 'utf8');
  } catch (e) {
    console.error('[Sync] Error guardando usuarios remotos:', e.message);
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

    const alertId = tag || `push-${Date.now()}`;
    registrarLiveAlert({
      id: alertId,
      tipo,
      titulo,
      cuerpo,
      prioridad,
      categoria: 'General',
      autor: 'Supervisión',
      destinatario: legajo ? String(legajo) : 'todos',
      creadoEn: new Date().toISOString()
    });

    const subs = leerSuscripciones();
    if (subs.length === 0) {
      return res.json({ ok: true, enviados: 0, mensaje: 'Alerta registrada en vivo. No hay dispositivos suscritos por Push aún' });
    }

    // Filtrar por legajo si se especifica, o enviar a todos
    const destinatarios = legajo
      ? subs.filter(s => s.user && String(s.user.legajo) === String(legajo))
      : subs;

    if (destinatarios.length === 0) {
      return res.json({ ok: true, enviados: 0, mensaje: 'Alerta registrada en vivo. No se encontraron dispositivos Push para el legajo especificado' });
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

// 7. Crear nuevo Aviso de la Empresa (SOLO SUPERVISIÓN / ADMINISTRADOR)
app.post('/api/push/avisos', requireAdminAuth, async (req, res) => {
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
      creadoEn: new Date().toISOString(),
      destinatario: 'todos'
    };

    avisos.unshift(nuevoAviso);
    guardarAvisosEmpresa(avisos);

    // Registrar también en live alerts para recepción inmediata
    registrarLiveAlert({
      id: nuevoAviso.id,
      tipo: 'aviso_empresa',
      titulo: nuevoAviso.titulo,
      cuerpo: nuevoAviso.cuerpo,
      prioridad: nuevoAviso.prioridad,
      categoria: nuevoAviso.categoria,
      autor: nuevoAviso.autor,
      destinatario: 'todos',
      creadoEn: nuevoAviso.creadoEn
    });

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

// 8. Eventos y Alertas en vivo para todos los celulares y cuadrillas conectadas
app.get('/api/push/live-events', (req, res) => {
  try {
    const { desde = 0, since = 0, legajo = '' } = req.query || {};
    const desdeTime = Number(desde || since || 0);
    const legajoStr = String(legajo || '').trim();

    const alerts = leerLiveAlerts();
    const pendientes = alerts.filter(a => {
      const t = Number(a.timestamp) || new Date(a.creadoEn || a.fecha || 0).getTime();
      const esPosterior = t > desdeTime;
      const esParaMi = !a.destinatario || a.destinatario === 'todos' || (legajoStr && String(a.destinatario) === legajoStr);
      return esPosterior && esParaMi;
    });

    res.json({
      ok: true,
      timestamp: Date.now(),
      alerts: pendientes,
      events: pendientes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ENDPOINTS ADMINISTRATIVOS REMOTOS (CLAVE MAESTRA & PUSH REMOTO)
// ============================================================

// A1. Login remoto con Clave Maestra
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ ok: false, error: 'Ingrese la clave maestra' });
    }
    const verif = verificarClaveMaestra(password);
    if (!verif.ok) {
      return res.status(401).json({ ok: false, error: 'Clave maestra incorrecta' });
    }
    const token = generarTokenAdmin();
    res.json({
      ok: true,
      token,
      debeCambiar: !!verif.esDefecto,
      mensaje: 'Acceso remoto concedido al panel de administración'
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// A2. Verificar validez del token administrativo
app.post('/api/admin/verify', (req, res) => {
  const token = req.headers['x-admin-token'] || req.body?.token;
  const ok = validarTokenAdmin(token);
  res.json({ ok });
});

// A3. Cambiar clave maestra remotamente
app.post('/api/admin/change-password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ ok: false, error: 'La nueva clave debe tener al menos 4 caracteres' });
    }

    const token = req.headers['x-admin-token'];
    let autorizado = token && validarTokenAdmin(token);

    if (!autorizado && currentPassword) {
      const v = verificarClaveMaestra(currentPassword);
      if (v.ok) autorizado = true;
    }

    if (!autorizado) {
      return res.status(401).json({ ok: false, error: 'La contraseña actual no es válida' });
    }

    const { hash, salt } = hashPassword(newPassword);
    guardarConfigAdmin({
      hash,
      salt,
      actualizado: new Date().toISOString(),
      esDefecto: false
    });

    const nuevoToken = generarTokenAdmin();
    console.log('[Admin] Clave maestra actualizada remotamente en el servidor');
    res.json({
      ok: true,
      token: nuevoToken,
      mensaje: 'Clave maestra actualizada exitosamente en el servidor'
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// A4. Estadísticas del servicio Push y lista de dispositivos para el Administrador
app.get('/api/admin/push/stats', requireAdminAuth, (req, res) => {
  try {
    const subs = leerSuscripciones();
    const avisos = leerAvisosEmpresa();

    const dispositivos = subs.map((s, idx) => ({
      id: idx + 1,
      legajo: s.user?.legajo || 'Sin legajo',
      nombre: s.user?.nombre || 'Operario',
      updatedAt: s.updatedAt || 'Desconocido',
      endpointCorto: s.endpoint ? (s.endpoint.split('/').pop().slice(0, 16) + '...') : ''
    }));

    res.json({
      ok: true,
      totalSuscriptores: subs.length,
      totalAvisos: avisos.length,
      dispositivos,
      avisos
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// A5. Emisión remota de Notificación Push a cuadrillas desde el panel de admin
app.post('/api/admin/push/send', requireAdminAuth, async (req, res) => {
  try {
    const {
      tipo = 'aviso_empresa',
      titulo,
      cuerpo,
      prioridad = 'alta',
      categoria = 'Seguridad',
      autor = 'Administración',
      destinatario = 'todos',
      crearAviso = true,
      enviarPush = true
    } = req.body || {};

    if (!titulo || !cuerpo) {
      return res.status(400).json({ error: 'Título y mensaje son requeridos' });
    }

    let nuevoAviso = null;
    if (crearAviso) {
      const avisos = leerAvisosEmpresa();
      nuevoAviso = {
        id: 'aviso-' + Date.now(),
        titulo: titulo.trim(),
        cuerpo: cuerpo.trim(),
        prioridad,
        categoria,
        autor: autor.trim() || 'Administración',
        fecha: new Date().toISOString().split('T')[0],
        creadoEn: new Date().toISOString(),
        destinatario: destinatario !== 'todos' ? destinatario : 'todos'
      };
      avisos.unshift(nuevoAviso);
      guardarAvisosEmpresa(avisos);
    }

    // Registrar en live-alerts para que cualquier cuadrilla conectada reciba la alerta al instante
    registrarLiveAlert({
      id: nuevoAviso ? nuevoAviso.id : ('push-' + Date.now()),
      tipo,
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      prioridad,
      categoria,
      autor: autor.trim() || 'Administración',
      destinatario: destinatario !== 'todos' ? String(destinatario) : 'todos',
      creadoEn: new Date().toISOString()
    });

    let enviados = 0;
    let fallidos = 0;
    const subs = leerSuscripciones();

    if (enviarPush && subs.length > 0) {
      const filtrados = (destinatario && destinatario !== 'todos')
        ? subs.filter(s => s.user && String(s.user.legajo) === String(destinatario))
        : subs;

      const payloadObj = {
        tipo,
        id: nuevoAviso ? nuevoAviso.id : ('push-' + Date.now()),
        titulo: `📢 ${titulo.trim()}`,
        cuerpo: cuerpo.trim(),
        tag: `baremo-${tipo}-${Date.now()}`,
        prioridad,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        vibrate: prioridad === 'alta' ? [300, 150, 300, 150, 300] : [200, 100, 200],
        requireInteraction: prioridad === 'alta',
        datos: {
          vista: tipo === 'jornada_pendiente' ? 'Registro' : 'AvisosEmpresa',
          avisoId: nuevoAviso ? nuevoAviso.id : null
        }
      };

      const payloadString = JSON.stringify(payloadObj);
      const endpointsAEliminar = new Set();

      await Promise.all(
        filtrados.map(async sub => {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payloadString);
            enviados++;
          } catch (err) {
            fallidos++;
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

    res.json({
      ok: true,
      enviados,
      fallidos,
      totalSuscriptores: subs.length,
      aviso: nuevoAviso,
      mensaje: `Notificación emitida a ${enviados} dispositivo/s conectado/s`
    });
  } catch (err) {
    console.error('[Admin Push] Error enviando:', err);
    res.status(500).json({ error: err.message });
  }
});

// A6. Eliminar un aviso del servidor remotamente
app.delete('/api/admin/avisos/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    let avisos = leerAvisosEmpresa();
    const antes = avisos.length;
    avisos = avisos.filter(a => a.id !== id);
    guardarAvisosEmpresa(avisos);
    res.json({ ok: true, eliminados: antes - avisos.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ENDPOINTS DE SINCRONIZACIÓN REMOTA Y REPORTES DE CUADRILLAS
// ============================================================

function normalizarClaveJornada(j, fallbackLegajo) {
  const leg = String(j.legajo || fallbackLegajo || 'sin_legajo').trim();
  const fecha = String(j.fecha || 'sin_fecha').trim();
  const subId = String(j.remoteId || j.syncId || j.idLocal || j.localId || j.id || j.horaInicio || '1').trim();
  return `jornada__${leg}__${fecha}__${subId}`;
}

// S1. Sincronizar jornadas de un usuario/cuadrilla desde cualquier celular
app.post('/api/sync/jornadas', (req, res) => {
  try {
    const { usuario, usuarios: usuariosArr = [], jornadas = [] } = req.body || {};
    if (!usuario || !usuario.legajo) {
      return res.status(400).json({ error: 'Datos de usuario y legajo son requeridos' });
    }

    const legajo = String(usuario.legajo).trim();
    const nombre = String(usuario.nombre || 'Operador').trim();
    const zona = String(usuario.zona || '').trim();
    const ahora = new Date().toISOString();

    // Actualizar usuarios remotos
    const usuarios = leerUsuariosRemotos();
    
    // Registrar o actualizar usuario principal
    const registrarOActualizarUser = (l, n, z) => {
      const lStr = String(l).trim();
      let idx = usuarios.findIndex(u => String(u.legajo) === lStr);
      const uData = {
        legajo: lStr,
        nombre: String(n || 'Operario').trim(),
        zona: String(z || '').trim(),
        ultimaConexion: ahora,
        totalJornadas: 0,
        totalProduccion: 0
      };
      if (idx >= 0) {
        usuarios[idx] = { ...usuarios[idx], ...uData };
      } else {
        usuarios.push(uData);
      }
    };

    registrarOActualizarUser(legajo, nombre, zona);

    // Registrar otros usuarios locales reportados por este dispositivo
    if (Array.isArray(usuariosArr)) {
      usuariosArr.forEach(u => {
        if (u && u.legajo) {
          registrarOActualizarUser(u.legajo, u.nombre, u.zona);
        }
      });
    }

    // Actualizar jornadas remotas sin colisiones entre dispositivos
    let recibidas = 0;
    if (Array.isArray(jornadas) && jornadas.length > 0) {
      const dbJornadas = leerJornadasRemotas();
      const jornadaMap = new Map();

      // Cargar existentes preservando claves únicas
      dbJornadas.forEach(j => {
        const k = j.syncId || normalizarClaveJornada(j, j.legajo);
        jornadaMap.set(k, j);
      });

      jornadas.forEach(j => {
        if (!j || !j.fecha) return;
        const jLegajo = String(j.legajo || legajo).trim();
        const jNombre = String(j.usuario || j.nombreUsuario || (jLegajo === legajo ? nombre : 'Operador')).trim();
        const jZona = String(j.zona || (jLegajo === legajo ? zona : '')).trim();
        const k = normalizarClaveJornada(j, jLegajo);

        const jNorm = {
          ...j,
          syncId: k,
          id: k,
          localId: j.id,
          legajo: jLegajo,
          nombreUsuario: jNombre,
          zona: jZona,
          cerrada: Boolean(j.cerrada),
          total: Number(j.total) || 0,
          cantidadItems: Number(j.cantidadItems) || (Array.isArray(j.items) ? j.items.length : 0),
          cantidadRegistros: Number(j.cantidadRegistros) || (Array.isArray(j.tareas) ? j.tareas.length : 0),
          items: Array.isArray(j.items) ? j.items : [],
          tareas: Array.isArray(j.tareas) ? j.tareas : [],
          ats: j.ats || null,
          sincronizadoEn: ahora
        };

        jornadaMap.set(k, jNorm);
        recibidas++;
      });

      const todasJornadas = Array.from(jornadaMap.values());
      guardarJornadasRemotas(todasJornadas);

      // Calcular métricas actualizadas de cada usuario registrado
      usuarios.forEach(u => {
        const userJorns = todasJornadas.filter(j => String(j.legajo) === String(u.legajo));
        u.totalJornadas = userJorns.length;
        u.jornadasCerradas = userJorns.filter(j => j.cerrada).length;
        u.jornadasAbiertas = userJorns.filter(j => !j.cerrada).length;
        u.totalProduccion = userJorns
          .filter(j => j.cerrada)
          .reduce((a, b) => a + (Number(b.total) || 0), 0);
      });
    }

    guardarUsuariosRemotos(usuarios);

    res.json({
      ok: true,
      recibidas,
      totalJornadasServidor: leerJornadasRemotas().length,
      totalUsuariosServidor: usuarios.length,
      mensaje: `Sincronización remota exitosa: ${recibidas} jornada(s)`
    });
  } catch (err) {
    console.error('[Sync] Error en /api/sync/jornadas:', err);
    res.status(500).json({ error: err.message });
  }
});

// S2. Estado de sincronización remota
app.get('/api/sync/estado', (req, res) => {
  try {
    const usuarios = leerUsuariosRemotos();
    const jornadas = leerJornadasRemotas();
    const cerradas = jornadas.filter(j => j.cerrada).length;
    const abiertas = jornadas.length - cerradas;
    const totalProd = jornadas.filter(j => j.cerrada).reduce((a, b) => a + (Number(b.total) || 0), 0);

    res.json({
      ok: true,
      totalUsuarios: usuarios.length,
      totalJornadas: jornadas.length,
      totalCerradas: cerradas,
      totalAbiertas: abiertas,
      totalProduccion: totalProd,
      servidorHora: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// S3. Descargar todas las jornadas de la nube (para supervisión offline o copia espejo)
app.get('/api/sync/descargar-todas', (req, res) => {
  try {
    const usuarios = leerUsuariosRemotos();
    const jornadas = leerJornadasRemotas();
    res.json({
      ok: true,
      totalUsuarios: usuarios.length,
      totalJornadas: jornadas.length,
      usuarios,
      jornadas
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// R1. Obtener lista de usuarios/cuadrillas para reportes (Solo Admin)
app.get('/api/admin/reportes/usuarios', requireAdminAuth, (req, res) => {
  try {
    const usuarios = leerUsuariosRemotos();
    const jornadas = leerJornadasRemotas();

    const lista = usuarios.map(u => {
      const userJornadas = jornadas.filter(j => String(j.legajo) === String(u.legajo));
      return {
        legajo: u.legajo,
        nombre: u.nombre,
        zona: u.zona,
        ultimaConexion: u.ultimaConexion,
        totalJornadas: userJornadas.length,
        jornadasCerradas: userJornadas.filter(j => j.cerrada).length,
        jornadasAbiertas: userJornadas.filter(j => !j.cerrada).length,
        totalProduccion: userJornadas.filter(j => j.cerrada).reduce((a, b) => a + (Number(b.total) || 0), 0)
      };
    });

    res.json({ ok: true, usuarios: lista, totalJornadas: jornadas.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// R2. Obtener datos de reporte consolidados o individuales de cualquier cuadrilla (Solo Admin)
app.get('/api/admin/reportes/datos', requireAdminAuth, (req, res) => {
  try {
    const {
      legajo = 'todos',
      tipo = 'todos',
      fecha,
      desde,
      hasta,
      quincena = '1',
      estado = 'todos' // 'todos' | 'cerradas' | 'abiertas'
    } = req.query || {};

    const todasJornadas = leerJornadasRemotas();
    const usuarios = leerUsuariosRemotos();

    let fechaDesde = desde;
    let fechaHasta = hasta;
    let periodoLabel = '';
    const fechaRef = fecha || new Date().toISOString().split('T')[0];

    if (!fechaDesde || !fechaHasta) {
      if (tipo === 'diario') {
        fechaDesde = fechaRef;
        fechaHasta = fechaRef;
        periodoLabel = `Reporte Diario - ${fechaRef}`;
      } else if (tipo === 'semanal') {
        const d = new Date(fechaRef + 'T12:00:00Z');
        const day = d.getUTCDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const lunes = new Date(d);
        lunes.setUTCDate(d.getUTCDate() + diffToMonday);
        const domingo = new Date(lunes);
        domingo.setUTCDate(lunes.getUTCDate() + 6);
        fechaDesde = lunes.toISOString().split('T')[0];
        fechaHasta = domingo.toISOString().split('T')[0];
        periodoLabel = `Reporte Semanal - ${fechaDesde} al ${fechaHasta}`;
      } else if (tipo === 'quincenal') {
        const parts = fechaRef.split('-');
        const y = parts[0];
        const m = parts[1];
        if (String(quincena) === '2') {
          const ultimoDia = new Date(y, Number(m), 0).getDate();
          fechaDesde = `${y}-${m}-16`;
          fechaHasta = `${y}-${m}-${String(ultimoDia).padStart(2, '0')}`;
          periodoLabel = `2ª Quincena - ${m}/${y} (${fechaDesde} al ${fechaHasta})`;
        } else {
          fechaDesde = `${y}-${m}-01`;
          fechaHasta = `${y}-${m}-15`;
          periodoLabel = `1ª Quincena - ${m}/${y} (${fechaDesde} al ${fechaHasta})`;
        }
      } else if (tipo === 'mensual') {
        const parts = fechaRef.split('-');
        const y = parts[0];
        const m = parts[1];
        const ultimoDia = new Date(y, Number(m), 0).getDate();
        fechaDesde = `${y}-${m}-01`;
        fechaHasta = `${y}-${m}-${String(ultimoDia).padStart(2, '0')}`;
        periodoLabel = `Reporte Mensual - ${m}/${y}`;
      } else {
        // 'todos' / histórico
        fechaDesde = '2000-01-01';
        fechaHasta = '2099-12-31';
        periodoLabel = 'Reporte Histórico Consolidado (Todos los dispositivos)';
      }
    }

    let filtradas = todasJornadas.filter(j => {
      const f = j.fecha;
      return f >= fechaDesde && f <= fechaHasta;
    });

    if (legajo && legajo !== 'todos') {
      filtradas = filtradas.filter(j => String(j.legajo) === String(legajo));
    }

    if (estado === 'cerradas') {
      filtradas = filtradas.filter(j => j.cerrada);
    } else if (estado === 'abiertas') {
      filtradas = filtradas.filter(j => !j.cerrada);
    }

    // Ordenar por fecha descendente (más recientes primero)
    filtradas.sort((a, b) => b.fecha.localeCompare(a.fecha) || String(a.legajo).localeCompare(String(b.legajo)));

    const datos = filtradas.map(j => {
      const u = usuarios.find(usr => String(usr.legajo) === String(j.legajo));
      return {
        ...j,
        nombreUsuario: u?.nombre || j.nombreUsuario || j.usuario || 'Operador',
        zona: u?.zona || j.zona || '-'
      };
    });

    const totalProduccion = datos.filter(d => d.cerrada).reduce((a, d) => a + (Number(d.total) || 0), 0);
    const totalProduccionEnCurso = datos.filter(d => !d.cerrada).reduce((a, d) => a + (Number(d.totalEnCurso || d.total) || 0), 0);
    const totalItems = datos.reduce((a, d) => a + (Number(d.cantidadItems) || 0), 0);
    const totalTareas = datos.reduce((a, d) => a + (Number(d.cantidadRegistros) || 0), 0);
    const totalCerradas = datos.filter(d => d.cerrada).length;
    const totalAbiertas = datos.filter(d => !d.cerrada).length;
    const usuariosUnicos = [...new Set(datos.map(d => d.legajo))].length;

    res.json({
      ok: true,
      datos,
      usuarios,
      periodoLabel,
      fechaDesde,
      fechaHasta,
      tipo,
      legajo,
      estado,
      totalProduccion,
      totalProduccionEnCurso,
      totalItems,
      totalTareas,
      totalJornadas: datos.length,
      totalCerradas,
      totalAbiertas,
      usuariosUnicos
    });
  } catch (err) {
    console.error('[Admin Reportes] Error en datos:', err);
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
