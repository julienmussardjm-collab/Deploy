// Sync between this phone and the team database (Supabase).
//
// The app never reads or writes the leads table directly: it calls two
// database functions, sync_leads and list_leads, which both check the shared
// team code first. The publishable key below is public by design; without
// the team code it gives access to nothing.

import { getQueuedLeads, markSynced, mergeRemoteLeads } from './leadStore.js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://uugwgvoxxsunbelrjwjk.supabase.co';
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_B3OC7tzwW5uYvYwWG15w-A_CxbDu7w9';

const LAST_PULL_KEY = 'lead-scanner:last-pull';
const UPLOAD_BATCH_SIZE = 50;

export class InvalidTeamCodeError extends Error {
  constructor() {
    super('Invalid team code');
    this.name = 'InvalidTeamCodeError';
  }
}

async function rpc(fn, args) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (body.code === '28000') throw new InvalidTeamCodeError();
    throw new Error(`${fn} failed (${response.status}): ${body.message || response.statusText}`);
  }
  return response.json();
}

// true / false for a checked code. Network errors propagate so the caller
// can tell "wrong code" from "no connection".
export async function checkTeamCode(code) {
  return rpc('team_code_ok', { p_code: code });
}

export function toRemote(lead) {
  return {
    id: lead.id,
    badgeId: lead.badgeId,
    name: lead.name,
    title: lead.title,
    company: lead.company,
    country: lead.country,
    email: lead.email,
    phone: lead.phone,
    interests: lead.interests || [],
    action: lead.action,
    priority: lead.priority,
    notes: lead.notes,
    capturedBy: lead.capturedBy,
    capturedByInitials: lead.capturedByInitials,
    eventName: lead.eventName || lead.boothLabel || null,
    eventLocation: lead.eventLocation || lead.boothLocation || null,
    rawScan: lead.rawScan,
    consent: !!lead.consent,
    consentAt: lead.consentAt ?? null,
    capturedAt: lead.capturedAt,
    updatedAt: lead.updatedAt ?? lead.capturedAt,
    deletedAt: lead.deletedAt ?? null,
  };
}

export function fromRemote(row) {
  return {
    id: row.id,
    badgeId: row.badge_id,
    name: row.name,
    title: row.title,
    company: row.company,
    country: row.country,
    email: row.email,
    phone: row.phone,
    interests: row.interests || [],
    action: row.action,
    priority: row.priority,
    notes: row.notes,
    capturedBy: row.captured_by,
    capturedByInitials: row.captured_by_initials,
    eventName: row.event_name,
    eventLocation: row.event_location,
    rawScan: row.raw_scan,
    consent: !!row.consent,
    consentAt: row.consent_at ? Date.parse(row.consent_at) : null,
    capturedAt: Date.parse(row.captured_at),
    updatedAt: Date.parse(row.updated_at),
    deletedAt: row.deleted_at ? Date.parse(row.deleted_at) : null,
  };
}

async function pushQueued(code) {
  const queued = await getQueuedLeads();
  for (let i = 0; i < queued.length; i += UPLOAD_BATCH_SIZE) {
    const batch = queued.slice(i, i + UPLOAD_BATCH_SIZE);
    await rpc('sync_leads', { p_code: code, p_leads: batch.map(toRemote) });
    // Rows the server kept (because its copy was newer) come back on the next pull.
    await markSynced(batch.map((lead) => ({ id: lead.id, updatedAt: lead.updatedAt })));
  }
  return queued.length;
}

async function pullTeam(code) {
  let since = null;
  try {
    since = localStorage.getItem(LAST_PULL_KEY);
  } catch {
    // Storage unavailable: pull everything.
  }
  const rows = await rpc('list_leads', { p_code: code, p_since: since });
  await mergeRemoteLeads(rows.map(fromRemote));
  const newest = rows.reduce(
    (max, row) => (!max || row.received_at > max ? row.received_at : max),
    since,
  );
  if (newest) {
    try {
      localStorage.setItem(LAST_PULL_KEY, newest);
    } catch {
      // Next pull will fetch more than needed; harmless.
    }
  }
  return rows.length;
}

// Uploads this phone's pending changes, then fetches the team's.
// Only one sync runs at a time. A call made while one is running (for
// instance a save during a background sync) makes it do one more pass
// right after, so the new change goes out without waiting for the timer.
let running = null;
let again = false;

export function syncNow(code) {
  if (!code) return Promise.reject(new InvalidTeamCodeError());
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      let result;
      do {
        again = false;
        const pushed = await pushQueued(code);
        const pulled = await pullTeam(code);
        result = { pushed, pulled, at: Date.now() };
      } while (again);
      return result;
    } finally {
      running = null;
    }
  })();
  return running;
}
