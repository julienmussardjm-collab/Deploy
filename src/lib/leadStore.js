// Lead storage in the browser's IndexedDB, the source of truth on the phone.
// Every local change is marked `queued` until teamSync.js has uploaded it to
// the team database; leads pulled from the team arrive already `synced`.
// A deleted lead stays as a tombstone (id and dates only, personal data
// dropped) so the deletion reaches the other phones; the UI never shows it.

const DB_NAME = 'lead-scanner';
const DB_VERSION = 3;
const STORE = 'leads';

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE)
          ? request.transaction.objectStore(STORE)
          : db.createObjectStore(STORE, { keyPath: 'id' });
        if (!store.indexNames.contains('status')) store.createIndex('status', 'status');
        if (!store.indexNames.contains('capturedAt')) store.createIndex('capturedAt', 'capturedAt');
        if (!store.indexNames.contains('badgeId')) store.createIndex('badgeId', 'badgeId');

        // Before v3, "synced" only meant "the phone was online"; nothing was
        // ever uploaded. Queue every existing lead so it reaches the team database.
        if (event.oldVersion > 0 && event.oldVersion < 3) {
          store.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) return;
            const lead = cursor.value;
            cursor.update({
              ...lead,
              status: 'queued',
              updatedAt: lead.updatedAt ?? lead.capturedAt,
            });
            cursor.continue();
          };
        }
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

function getAllFrom(source, query) {
  return new Promise((resolve, reject) => {
    const request = source.getAll(query);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
      if (lead) store.put({ ...lead, ...changes, status: 'queued', updatedAt: Date.now() });
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
          const now = Date.now();
          const record = existing
            ? {
                ...existing,
                interests: lead.interests,
                action: lead.action,
                priority: lead.priority,
                notes: lead.notes,
                consent: lead.consent,
                consentAt: lead.consentAt,
                status: 'queued',
                updatedAt: now,
              }
            : { ...lead, status: 'queued', updatedAt: now };
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

// Visible leads, newest first (tombstones excluded).
export async function getAllLeads() {
  const leads = await withStore('readonly', (store) => getAllFrom(store));
  return leads.filter((lead) => !lead.deletedAt).sort((a, b) => b.capturedAt - a.capturedAt);
}

function tombstone(lead, deletedAt) {
  return {
    id: lead.id,
    badgeId: '',
    capturedAt: lead.capturedAt,
    capturedBy: lead.capturedBy ?? null,
    capturedByInitials: lead.capturedByInitials ?? null,
    eventName: lead.eventName ?? lead.boothLabel ?? null,
    eventLocation: lead.eventLocation ?? lead.boothLocation ?? null,
    deletedAt,
    updatedAt: deletedAt,
  };
}

// Deletes a lead on this phone and queues the deletion for the team database,
// which wipes its personal data too.
export async function deleteLead(id) {
  await withStore('readwrite', (store) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const lead = request.result;
      if (lead) store.put({ ...tombstone(lead, Date.now()), status: 'queued' });
    };
  });
  notifyChange();
}

export async function getQueuedLeads() {
  return withStore('readonly', (store) => getAllFrom(store.index('status'), 'queued'));
}

// Marks uploaded leads as synced, unless they were edited again while the
// upload was in flight (their updatedAt moved on).
export async function markSynced(uploaded) {
  await withStore('readwrite', (store) => {
    for (const sent of uploaded) {
      const request = store.get(sent.id);
      request.onsuccess = () => {
        const lead = request.result;
        if (lead && lead.status === 'queued' && lead.updatedAt === sent.updatedAt) {
          store.put({ ...lead, status: 'synced' });
        }
      };
    }
  });
  notifyChange();
}

// Stores leads pulled from the team database. A local copy with unsent
// changes that are newer than the team copy is kept as is.
export async function mergeRemoteLeads(remoteLeads) {
  if (!remoteLeads.length) return;
  await withStore('readwrite', (store) => {
    for (const remote of remoteLeads) {
      const request = store.get(remote.id);
      request.onsuccess = () => {
        const local = request.result;
        // A deletion always wins, from either side.
        if (remote.deletedAt) {
          store.put({ ...tombstone(remote, remote.deletedAt), status: 'synced' });
          return;
        }
        if (local?.deletedAt) return;
        if (local && local.status === 'queued' && local.updatedAt > remote.updatedAt) return;
        store.put({ ...local, ...remote, status: 'synced' });
      };
    }
  });
  notifyChange();
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// capturedToday counts the given user's own scans; queued counts everything
// on this phone that still has to be uploaded.
export async function getStats(userName) {
  const leads = await getAllLeads();
  const today = startOfToday();
  return {
    capturedToday: leads.filter(
      (lead) => lead.capturedAt >= today && (!userName || lead.capturedBy === userName),
    ).length,
    queued: leads.filter((lead) => lead.status === 'queued').length,
  };
}

// UUID v4. The team database keys leads by UUID, so the fallback for
// browsers without crypto.randomUUID must produce one too.
export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
