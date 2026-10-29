// On-device storage (IndexedDB). Images are stored as Blobs alongside their metadata.
//
// Item shape:
//   { id, name, category, cutout: Blob (PNG, transparent), original: Blob (JPEG,
//     the whole photo it came from), labelId (e.g. 'hoodie', or null),
//     color (e.g. 'navy', or null), width, height, createdAt }

const DB_NAME = 'closet';
const DB_VERSION = 1;

let dbPromise;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('outfits')) db.createObjectStore('outfits', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = undefined;
      reject(request.error);
    };
  });
  return dbPromise;
}

async function run(storeName, mode, operation) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getAllItems() {
  const items = await run('items', 'readonly', (store) => store.getAll());
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export function putItem(item) {
  return run('items', 'readwrite', (store) => store.put(item));
}

export function deleteItem(id) {
  return run('items', 'readwrite', (store) => store.delete(id));
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Not supported; data is still stored, just not guaranteed.
  }
}

export function newId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
