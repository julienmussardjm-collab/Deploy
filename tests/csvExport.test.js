import { describe, expect, it } from 'vitest';
import { exportFilename, leadsToCsv, slugify } from '../src/lib/csvExport.js';

describe('CSV export', () => {
  it('writes a header row and escapes quotes, commas and newlines', () => {
    const csv = leadsToCsv([
      {
        name: 'Jo "JJ" Smith',
        company: 'Acme, Inc.',
        interests: ['Sports', 'Industry'],
        action: 'Quotation',
        notes: 'line 1\nline 2',
        consent: true,
        intel: {
          website: 'https://www.acme.com',
          companyType: 'Distributor / wholesaler',
          linkedinCompany: 'https://www.linkedin.com/company/acme',
        },
        consentAt: Date.UTC(2026, 8, 24, 10, 1),
        capturedAt: Date.UTC(2026, 8, 24, 10, 0),
      },
      { name: 'No Consent', interests: [], consent: false, consentAt: Date.UTC(2026, 8, 24) },
    ]);
    const [header, row] = csv.split('\r\n');
    expect(header.split(',')).toHaveLength(21);
    expect(header).toContain('Consent to contact,Consent recorded at');
    expect(header.startsWith('Name,Job title,Company')).toBe(true);
    expect(row).toContain('"Jo ""JJ"" Smith"');
    expect(row).toContain('"Acme, Inc."');
    expect(row).toContain('Sports; Industry');
    expect(csv).toContain('"line 1\nline 2"');
    expect(row).toContain('2026-09-24T10:00:00.000Z');
    expect(row).toContain('Yes,2026-09-24T10:01:00.000Z');
    expect(header).toContain('Company website,Company type,Company LinkedIn');
    expect(row).toContain(
      'https://www.acme.com,Distributor / wholesaler,https://www.linkedin.com/company/acme',
    );
    // A consent time is only exported with an actual consent.
    expect(csv.split('\r\n').at(-1)).toContain(',No,,');
  });

  it('builds file names from the event label', () => {
    expect(slugify('Light + Building 2026 — Hall 3')).toBe('light-building-2026-hall-3');
    expect(exportFilename('LiGHT 26')).toMatch(/^leads-light-26-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
