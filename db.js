/* ============================================================
   BAREMO - db.js (v5.9.28)

   REGLA DE ORO: NUNCA SE BORRAN DATOS DE USUARIO.
   La migracion de version es SOLO ADITIVA: se crean los almacenes o
   indices que falten, jamas se elimina ni se recrea uno existente.
   Un usuario que viene de la v1 conserva usuarios, jornadas,
   combustible, quincenas y config exactamente como estaban.
   ============================================================ */
const DB_NAME = 'BaremosDB';
const DB_VERSION = 2;   // v1 -> v2: solo agrega indices faltantes. Sin borrado.
let db;
let _aperturaEnCurso = null;

/* Crea un almacen solo si falta. Nunca lo reemplaza. */
function asegurarStore(d, nombre, opciones) {
  if (d.objectStoreNames.contains(nombre)) return null;
  return d.createObjectStore(nombre, opciones);
}

/* Crea un indice solo si falta, sobre un almacen que ya puede tener datos. */
function asegurarIndice(tx, store, nombre, keyPath, opciones) {
  try {
    const st = tx.objectStore(store);
    if (!st.indexNames.contains(nombre)) st.createIndex(nombre, keyPath, opciones || {});
  } catch (e) { /* si el almacen no existe todavia, ya se creo con sus indices */ }
}

function openDB() {
  if (db) return Promise.resolve(db);
  if (_aperturaEnCurso) return _aperturaEnCurso;

  _aperturaEnCurso = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const d = e.target.result;
      const tx = e.target.transaction;

      // --- Almacenes (se crean solo si faltan) ---
      asegurarStore(d, 'config', { keyPath: 'key' });
      asegurarStore(d, 'usuarios', { keyPath: 'legajo' });
      asegurarStore(d, 'baremo', { keyPath: 'baremo' });

      const stJ = asegurarStore(d, 'jornadas', { keyPath: 'id', autoIncrement: true });
      if (stJ) {
        stJ.createIndex('legajo', 'legajo', { unique: false });
        stJ.createIndex('fechaLegajo', ['fecha', 'legajo'], { unique: false });
      }

      const stC = asegurarStore(d, 'combustible', { keyPath: 'id', autoIncrement: true });
      if (stC) stC.createIndex('legajo', 'legajo', { unique: false });

      const stQ = asegurarStore(d, 'quincenas', { keyPath: 'id', autoIncrement: true });
      if (stQ) stQ.createIndex('legajo', 'legajo', { unique: false });

      // --- Indices sobre almacenes que ya existian (bases v1) ---
      if (tx) {
        asegurarIndice(tx, 'jornadas', 'legajo', 'legajo', { unique: false });
        asegurarIndice(tx, 'jornadas', 'fechaLegajo', ['fecha', 'legajo'], { unique: false });
        asegurarIndice(tx, 'jornadas', 'fecha', 'fecha', { unique: false });
        asegurarIndice(tx, 'combustible', 'legajo', 'legajo', { unique: false });
        asegurarIndice(tx, 'quincenas', 'legajo', 'legajo', { unique: false });
      }
    };

    req.onsuccess = e => {
      db = e.target.result;
      // Si otra pestana pide subir la version, se cierra esta conexion para no
      // bloquearla. La proxima operacion vuelve a abrir sola.
      db.onversionchange = () => { try { db.close(); } catch (x) {} db = null; };
      db.onclose = () => { db = null; };
      _aperturaEnCurso = null;
      resolve(db);
    };
    req.onerror = e => { _aperturaEnCurso = null; reject(e.target.error); };
    req.onblocked = () => { /* otra pestana abierta con la version vieja */ };
  });

  return _aperturaEnCurso;
}

/* Toda operacion pasa por aca: si la conexion se cayo, se reabre sola. */
async function conexion() {
  if (!db) await openDB();
  return db;
}

async function dbGet(store, key) {
  const d = await conexion();
  return new Promise((res, rej) => { const r = d.transaction(store).objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function dbGetAll(store) {
  const d = await conexion();
  return new Promise((res, rej) => { const r = d.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function dbPut(store, data) {
  const d = await conexion();
  return new Promise((res, rej) => { const r = d.transaction(store, 'readwrite').objectStore(store).put(data); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function dbAdd(store, data) {
  const d = await conexion();
  return new Promise((res, rej) => { const r = d.transaction(store, 'readwrite').objectStore(store).add(data); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function dbDelete(store, key) {
  const d = await conexion();
  return new Promise((res, rej) => { const r = d.transaction(store, 'readwrite').objectStore(store).delete(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function dbGetByIndex(store, idx, key) {
  const d = await conexion();
  return new Promise((res, rej) => { const r = d.transaction(store).objectStore(store).index(idx).getAll(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

async function exportAllDB() {
  return {
    _meta: { app: 'BAREMO', dbVersion: DB_VERSION, exportado: new Date().toISOString() },
    config: await dbGetAll('config'),
    usuarios: await dbGetAll('usuarios'),
    baremo: await dbGetAll('baremo'),
    jornadas: await dbGetAll('jornadas'),
    combustible: await dbGetAll('combustible'),
    quincenas: await dbGetAll('quincenas')
  };
}

/* Importacion NO destructiva: fusiona por clave, nunca vacia un almacen.
   La credencial de administrador del dispositivo se respeta y no se pisa
   con la del backup, para no dejar a nadie afuera del panel. */
async function importAllDB(data) {
  if (!data || typeof data !== 'object') throw new Error('Backup invalido');
  const credActual = await dbGet('config', 'adminCredencial');

  if (data.config) for (const i of data.config) { if (i && i.key) await dbPut('config', i); }
  if (data.usuarios) for (const i of data.usuarios) { if (i && i.legajo) await dbPut('usuarios', i); }
  if (data.baremo) for (const i of data.baremo) { if (i && i.baremo) await dbPut('baremo', i); }
  if (data.jornadas) for (const i of data.jornadas) await dbPut('jornadas', i);
  if (data.combustible) for (const i of data.combustible) await dbPut('combustible', i);
  if (data.quincenas) for (const i of data.quincenas) await dbPut('quincenas', i);

  if (credActual) await dbPut('config', credActual);
}

/* Le pide al navegador que NO borre la base por falta de espacio.
   Sin esto el sistema operativo puede limpiar IndexedDB y el usuario
   pierde el historial completo. */
async function pedirAlmacenamientoPersistente() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return { soportado: false, persistente: false };
    let persistente = false;
    if (navigator.storage.persisted) persistente = await navigator.storage.persisted();
    if (!persistente) persistente = await navigator.storage.persist();
    let uso = null;
    try {
      if (navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        uso = { usado: e.usage || 0, disponible: e.quota || 0 };
      }
    } catch (x) {}
    return { soportado: true, persistente, uso };
  } catch (e) {
    return { soportado: false, persistente: false };
  }
}
