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
    const fail = () => reject(transaction.error ?? request.error ?? new Error('Storage operation failed'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = fail;
    transaction.onabort = fail;
  });
}

// Images are stored as raw bytes ({ bytes: ArrayBuffer, type }) rather than Blobs:
// some WebKit builds can't put Blobs into IndexedDB. Items saved as Blobs by
// earlier versions still load.
const IMAGE_FIELDS = ['cutout', 'original'];

async function toStorable(item) {
  const stored = { ...item };
  for (const field of IMAGE_FIELDS) {
    const blob = item[field];
    if (blob instanceof Blob) stored[field] = { bytes: await blob.arrayBuffer(), type: blob.type };
  }
  return stored;
}

function fromStored(stored) {
  const item = { ...stored };
  for (const field of IMAGE_FIELDS) {
    const value = stored[field];
    if (value && !(value instanceof Blob) && value.bytes) item[field] = new Blob([value.bytes], { type: value.type });
  }
  return item;
}

export async function getAllItems() {
  const items = await run('items', 'readonly', (store) => store.getAll());
  return items.map(fromStored).sort((a, b) => b.createdAt - a.createdAt);
}

export async function putItem(item) {
  const stored = await toStorable(item); // convert before opening the transaction
  return run('items', 'readwrite', (store) => store.put(stored));
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
