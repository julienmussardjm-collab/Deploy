import { beforeEach, describe, expect, it, vi } from 'vitest';
import { releaseScript } from '../src/hooks/useUpdateAvailable.js';

vi.mock('../src/lib/leadStore.js', () => ({
  getQueuedLeads: vi.fn(),
  markSynced: vi.fn(async () => {}),
  mergeRemoteLeads: vi.fn(async () => {}),
}));

const { getQueuedLeads } = await import('../src/lib/leadStore.js');
const { syncNow } = await import('../src/lib/teamSync.js');

describe('releaseScript', () => {
  it('finds the hashed entry script of a build', () => {
    const html =
      '<script type="module" crossorigin src="/assets/index-DURNsUOD.js"></script>' +
      '<link rel="stylesheet" crossorigin href="/assets/index-HiQFmw3C.css">';
    expect(releaseScript(html)).toBe('/assets/index-DURNsUOD.js');
    expect(releaseScript('<p>maintenance</p>')).toBeNull();
  });
});

describe('syncNow', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { ok: true, json: async () => [] };
      }),
    );
  });

  it('runs one more pass when a change arrives during a sync', async () => {
    getQueuedLeads.mockResolvedValue([]);
    const first = syncNow('CODE');
    const second = syncNow('CODE'); // e.g. a save while the timer sync runs
    expect(second).toBe(first);
    await first;
    expect(getQueuedLeads).toHaveBeenCalledTimes(2);
  });

  it('does a single pass when nothing else happens', async () => {
    getQueuedLeads.mockClear();
    await syncNow('CODE');
    expect(getQueuedLeads).toHaveBeenCalledTimes(1);
  });
});
