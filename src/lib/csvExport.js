// CSV export of leads. Tries, in order: the native share sheet (phones),
// the claude.ai artifact downloads capability, then a plain file download.

const COLUMNS = [
  ['Name', (lead) => lead.name],
  ['Job title', (lead) => lead.title],
  ['Company', (lead) => lead.company],
  ['Country', (lead) => lead.country],
  ['Email', (lead) => lead.email],
  ['Phone', (lead) => lead.phone],
  ['Badge ID', (lead) => lead.badgeId],
  ['Event', (lead) => lead.eventName || lead.boothLabel || ''],
  ['Location', (lead) => lead.eventLocation || lead.boothLocation || ''],
  ['Areas of interest', (lead) => (lead.interests || []).join('; ')],
  ['Follow-up action', (lead) => lead.action],
  ['Priority', (lead) => lead.priority || ''],
  ['Notes', (lead) => lead.notes || ''],
  ['Consent to contact', (lead) => (lead.consent ? 'Yes' : 'No')],
  [
    'Consent recorded at',
    (lead) => (lead.consent && lead.consentAt ? new Date(lead.consentAt).toISOString() : ''),
  ],
  ['Captured by', (lead) => lead.capturedBy || ''],
  ['Captured at', (lead) => (lead.capturedAt ? new Date(lead.capturedAt).toISOString() : '')],
  ['Sync status', (lead) => lead.status || ''],
];

function escapeCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function leadsToCsv(leads) {
  return [
    COLUMNS.map(([header]) => escapeCell(header)).join(','),
    ...leads.map((lead) => COLUMNS.map(([, get]) => escapeCell(get(lead))).join(',')),
  ].join('\r\n');
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function exportFilename(label) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(label);
  return `leads-${slug ? `${slug}-` : ''}${date}.csv`;
}

// Saves through the claude.ai artifact runtime when the page runs there.
// Returns null when that path is unavailable so the caller can fall back.
async function saveViaArtifactRuntime(filename, data) {
  const use = globalThis.claude?.use;
  if (typeof use !== 'function') return null;
  let downloads = null;
  try {
    downloads = await use.call(globalThis.claude, 'downloads');
  } catch {
    return null;
  }
  if (!downloads) return null;

  const save = async (name) => {
    await downloads.save({ filename: name, data });
    return 'downloaded';
  };
  try {
    return await save(filename);
  } catch (error) {
    if (error?.code === 'declined') return 'cancelled';
    if (error?.code === 'extension_not_enabled') {
      try {
        return await save(filename.replace(/\.csv$/, '.txt'));
      } catch (retryError) {
        return retryError?.code === 'declined' ? 'cancelled' : null;
      }
    }
    return null;
  }
}

// Resolves with 'shared' | 'downloaded' | 'cancelled' | 'failed'.
export async function exportLeads(leads, label) {
  if (!leads.length) return 'failed';

  const filename = exportFilename(label);
  // BOM so Excel opens accented characters correctly.
  const csv = `﻿${leadsToCsv(leads)}`;
  const type = 'text/csv;charset=utf-8';

  try {
    const file = new File([csv], filename, { type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled';
  }

  const viaRuntime = await saveViaArtifactRuntime(filename, csv);
  if (viaRuntime) return viaRuntime;

  try {
    const url = URL.createObjectURL(new Blob([csv], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
