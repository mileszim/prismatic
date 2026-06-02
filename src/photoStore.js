// Tiny IndexedDB wrapper for the camera roll. Photos are stored as
// { id, dataURL, meta } records that survive reloads.

const DB_NAME = 'prismatic';
const STORE = 'photos';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Returns the new record's id. `photo` is { dataURL, meta }.
export async function addPhoto(photo) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).add(photo);
      req.onsuccess = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// Oldest-first (ascending id); callers reverse for newest-first display.
export async function getAllPhotos() {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function clearPhotos() {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
