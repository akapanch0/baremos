import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase App and Firestore with specified database ID
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

/**
 * Robust error handler conforming to FirestoreErrorInfo
 */
export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Mandatory initial connectivity test
 */
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

// Execute connection test on initialization
testConnection();

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle() {
  try {
    const res = await signInWithPopup(auth, googleProvider);
    return res.user;
  } catch (err) {
    console.error('Firebase Auth error:', err);
    throw err;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Firebase Logout error:', err);
    throw err;
  }
}

/**
 * Save user profile to Firestore (/users/{userId})
 */
export async function saveCloudUserProfile(profile) {
  if (!auth.currentUser) return null;
  const uid = auth.currentUser.uid;
  const path = `users/${uid}`;
  const docRef = doc(db, 'users', uid);
  const data = {
    userId: uid,
    nombre: String(profile.nombre || auth.currentUser.displayName || 'Contratista').slice(0, 100),
    legajo: String(profile.legajo || '').slice(0, 50),
    zona: String(profile.zona || 'General').slice(0, 100),
    email: String(auth.currentUser.email || profile.email || '').slice(0, 120),
    creado: profile.creado || new Date().toISOString()
  };
  try {
    await setDoc(docRef, data, { merge: true });
    return data;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Fetch user profile from Firestore
 */
export async function getCloudUserProfile() {
  if (!auth.currentUser) return null;
  const uid = auth.currentUser.uid;
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Sync an individual Jornada to Firestore
 */
export async function syncJornadaToCloud(jornada) {
  if (!auth.currentUser || !jornada) return;
  const uid = auth.currentUser.uid;
  const jId = String(jornada.id || (jornada.fecha + '_' + (jornada.legajo || '0'))).replace(/[^a-zA-Z0-9_\-]/g, '_');
  const path = `users/${uid}/jornadas/${jId}`;
  
  // Clean items array to prevent deep or non-serializable objects
  const cleanItems = Array.isArray(jornada.items) ? jornada.items.slice(0, 150).map(it => ({
    baremo: String(it.baremo || '').slice(0, 50),
    cant: Number(it.cant) || 1,
    desc: String(it.desc || '').slice(0, 200),
    monto: Number(it.monto) || 0,
    subtotal: Number(it.subtotal) || 0,
    unidad: String(it.unidad || '').slice(0, 30)
  })) : [];

  const payload = {
    userId: uid,
    id: jId,
    fecha: String(jornada.fecha || '').slice(0, 10),
    legajo: String(jornada.legajo || '').slice(0, 50),
    cerrada: Boolean(jornada.cerrada),
    total: Number(jornada.total) || 0,
    items: cleanItems,
    observaciones: String(jornada.observaciones || '').slice(0, 500),
    vehiculo: String(jornada.vehiculo || '').slice(0, 100),
    creado: String(jornada.creado || new Date().toISOString()).slice(0, 50),
    actualizado: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'users', uid, 'jornadas', jId), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Sync an individual Combustible ticket to Firestore
 */
export async function syncCombustibleToCloud(ticket) {
  if (!auth.currentUser || !ticket) return;
  const uid = auth.currentUser.uid;
  const cId = String(ticket.id || (ticket.fecha + '_' + (ticket.patente || 'comb'))).replace(/[^a-zA-Z0-9_\-]/g, '_');
  const path = `users/${uid}/combustible/${cId}`;

  const payload = {
    userId: uid,
    legajo: String(ticket.legajo || '').slice(0, 50),
    patente: String(ticket.patente || '').slice(0, 20),
    monto: Number(ticket.monto) || 0,
    descontar: Boolean(ticket.descontar),
    fecha: String(ticket.fecha || '').slice(0, 10),
    mes: String(ticket.mes || '').slice(0, 10),
    creado: String(ticket.creado || new Date().toISOString()).slice(0, 50)
  };

  try {
    await setDoc(doc(db, 'users', uid, 'combustible', cId), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Sync an individual Quincena summary to Firestore
 */
export async function syncQuincenaToCloud(quincena) {
  if (!auth.currentUser || !quincena) return;
  const uid = auth.currentUser.uid;
  const qId = String(quincena.id || (quincena.mes + '_' + (quincena.tipo || '1q'))).replace(/[^a-zA-Z0-9_\-]/g, '_');
  const path = `users/${uid}/quincenas/${qId}`;

  const payload = {
    userId: uid,
    legajo: String(quincena.legajo || '').slice(0, 50),
    mes: String(quincena.mes || '').slice(0, 10),
    tipo: String(quincena.tipo || '1q').slice(0, 20),
    total: Number(quincena.total) || 0,
    fechaRegistro: String(quincena.fechaRegistro || '').slice(0, 10),
    bloqueada: Boolean(quincena.bloqueada),
    creado: String(quincena.creado || new Date().toISOString()).slice(0, 50)
  };

  try {
    await setDoc(doc(db, 'users', uid, 'quincenas', qId), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Fetch all jornadas from cloud for current user
 */
export async function fetchCloudJornadas() {
  if (!auth.currentUser) return [];
  const uid = auth.currentUser.uid;
  const path = `users/${uid}/jornadas`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'jornadas'));
    return snap.docs.map(d => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Full two-way sync between IndexedDB and Firestore
 */
export async function syncFullCloudDatabase() {
  if (!auth.currentUser || !window.dbGetAll || !window.dbPut) return { synced: false, reason: 'No auth or db' };
  const uid = auth.currentUser.uid;
  try {
    // 1. Upload local data to cloud
    const localJornadas = await window.dbGetAll('jornadas');
    for (const j of localJornadas) {
      if (j) await syncJornadaToCloud(j);
    }

    const localCombustible = await window.dbGetAll('combustible');
    for (const c of localCombustible) {
      if (c) await syncCombustibleToCloud(c);
    }

    const localQuincenas = await window.dbGetAll('quincenas');
    for (const q of localQuincenas) {
      if (q) await syncQuincenaToCloud(q);
    }

    // 2. Fetch cloud data to ensure any missing records on this device are merged
    const cloudJornadas = await fetchCloudJornadas();
    if (cloudJornadas && cloudJornadas.length) {
      const localIds = new Set(localJornadas.map(j => String(j.id)));
      for (const cj of cloudJornadas) {
        if (cj && !localIds.has(String(cj.id))) {
          await window.dbPut('jornadas', cj);
        }
      }
    }

    return { synced: true, count: localJornadas.length };
  } catch (err) {
    console.error('Error in syncFullCloudDatabase:', err);
    return { synced: false, error: err };
  }
}

// Expose on global window object for immediate use in application
window.FirebaseSync = {
  auth,
  db,
  loginWithGoogle,
  logoutUser,
  saveCloudUserProfile,
  getCloudUserProfile,
  syncJornadaToCloud,
  syncCombustibleToCloud,
  syncQuincenaToCloud,
  syncFullCloudDatabase,
  fetchCloudJornadas,
  handleFirestoreError,
  OperationType,
  onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb)
};
