// Lead storage in the browser's IndexedDB.
// Leads live on this device only; there is no server copy yet.

const DB_NAME = 'lead-scanner';
const DB_VERSION = 2;
const STORE = 'leads';

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE)
          ? request.transaction.objectStore(STORE)
          : db.createObjectStore(STORE, { keyPath: 'id' });
        if (!store.indexNames.contains('status')) store.createIndex('status', 'status');
        if (!store.indexNames.contains('capturedAt')) store.createIndex('capturedAt', 'capturedAt');
        if (!store.indexNames.contains('badgeId')) store.createIndex('badgeId', 'badgeId');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

// Runs `work` inside a transaction and resolves with its return value once
// the transaction has committed.
async function withStore(mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const listeners = new Set();

function notifyChange() {
  for (const listener of listeners) listener();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function updateLead(id, changes) {
  await withStore('readwrite', (store) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const lead = request.result;
      if (lead) store.put({ ...lead, ...changes });
    };
  });
  notifyChange();
}

export async function findLeadByBadge(badgeId) {
  return withStore(
    'readonly',
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.index('badgeId').get(badgeId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      }),
  );
}

// Inserts a new lead, or, if the badge was already scanned, updates the
// qualification fields of the existing one.
export async function saveLead(lead) {
  const result = await withStore(
    'readwrite',
    (store) =>
      new Promise((resolve, reject) => {
        const lookup = store.index('badgeId').get(lead.badgeId);
        lookup.onsuccess = () => {
          const existing = lookup.result;
          const record = existing
            ? {
                ...existing,
                interests: lead.interests,
                action: lead.action,
                priority: lead.priority,
                notes: lead.notes,
              }
            : lead;
          const put = store.put(record);
          put.onsuccess = () => resolve({ lead: record, created: !existing });
          put.onerror = () => reject(put.error);
        };
        lookup.onerror = () => reject(lookup.error);
      }),
  );
  notifyChange();
  return result;
}

export async function getAllLeads() {
  return withStore(
    'readonly',
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () =>
          resolve(request.result.sort((a, b) => b.capturedAt - a.capturedAt));
        request.onerror = () => reject(request.error);
      }),
  );
}

// Marks every queued lead as synced. There is no upload behind this yet:
// the status only flips locally when the device comes back online.
export async function flushQueue() {
  const ids = await withStore(
    'readwrite',
    (store) =>
      new Promise((resolve, reject) => {
        const cursorRequest = store.index('status').openCursor(IDBKeyRange.only('queued'));
        const flushed = [];
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor) {
            const lead = cursor.value;
            cursor.update({ ...lead, status: 'synced' });
            flushed.push(lead.id);
            cursor.continue();
          } else {
            resolve(flushed);
          }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      }),
  );
  if (ids.length) notifyChange();
  return ids;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function getStats() {
  const leads = await getAllLeads();
  const today = startOfToday();
  return {
    capturedToday: leads.filter((lead) => lead.capturedAt >= today).length,
    queued: leads.filter((lead) => lead.status === 'queued').length,
  };
}

export function newId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
