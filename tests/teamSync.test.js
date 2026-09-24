import { describe, expect, it } from 'vitest';
import { fromRemote, toRemote } from '../src/lib/teamSync.js';

describe('team sync mapping', () => {
  const lead = {
    id: '11111111-1111-4111-8111-111111111111',
    badgeId: 'LB26-0042',
    name: 'Mira Keller',
    title: 'Product manager',
    company: 'Lumen BV',
    country: 'Netherlands',
    email: 'mira@lumen.nl',
    phone: '+31 6 1234 5678',
    interests: ['Street & Area'],
    action: 'Quotation',
    priority: 'Hot',
    notes: 'Tunnel project',
    capturedBy: 'Julien Mussard',
    capturedByInitials: 'JM',
    eventName: 'LiGHT 26 London',
    eventLocation: 'Stand H40',
    rawScan: 'BEGIN:VCARD…',
    consent: true,
    consentAt: Date.UTC(2026, 8, 24, 9, 1),
    capturedAt: Date.UTC(2026, 8, 24, 9, 0),
    updatedAt: Date.UTC(2026, 8, 24, 9, 5),
    deletedAt: null,
    intel: { status: 'done', domain: 'lumen.nl', companyType: 'Luminaire manufacturer (OEM)' },
    status: 'queued',
  };

  it('sends every field the database function reads', () => {
    const { status, ...expected } = lead;
    expect(toRemote(lead)).toEqual(expected);
  });

  it('falls back to capturedAt and early-build event fields', () => {
    const legacy = { ...lead, updatedAt: undefined, eventName: undefined, boothLabel: 'Booth 7' };
    const sent = toRemote(legacy);
    expect(sent.updatedAt).toBe(lead.capturedAt);
    expect(sent.eventName).toBe('Booth 7');
  });

  it('sends a deletion as a tombstone', () => {
    const sent = toRemote({ id: lead.id, capturedAt: lead.capturedAt, deletedAt: 1, updatedAt: 1 });
    expect(sent).toMatchObject({ id: lead.id, deletedAt: 1, consent: false, consentAt: null });
  });

  it('reads a deleted row as deleted', () => {
    const row = {
      id: lead.id,
      badge_id: '',
      name: '',
      interests: [],
      consent: false,
      consent_at: null,
      captured_at: '2026-09-24T09:00:00+00:00',
      updated_at: '2026-09-24T10:00:00+00:00',
      deleted_at: '2026-09-24T10:00:00+00:00',
    };
    expect(fromRemote(row)).toMatchObject({ deletedAt: Date.UTC(2026, 8, 24, 10), consent: false });
  });

  it('reads a database row back into the same lead', () => {
    const row = {
      id: lead.id,
      badge_id: lead.badgeId,
      name: lead.name,
      title: lead.title,
      company: lead.company,
      country: lead.country,
      email: lead.email,
      phone: lead.phone,
      interests: lead.interests,
      action: lead.action,
      priority: lead.priority,
      notes: lead.notes,
      captured_by: lead.capturedBy,
      captured_by_initials: lead.capturedByInitials,
      event_name: lead.eventName,
      event_location: lead.eventLocation,
      raw_scan: lead.rawScan,
      consent: true,
      consent_at: '2026-09-24T09:01:00+00:00',
      deleted_at: null,
      intel: { status: 'done', domain: 'lumen.nl', companyType: 'Luminaire manufacturer (OEM)' },
      captured_at: '2026-09-24T09:00:00+00:00',
      updated_at: '2026-09-24T09:05:00+00:00',
      received_at: '2026-09-24T09:05:01.123456+00:00',
    };
    const { status, ...expected } = lead;
    expect(fromRemote(row)).toEqual(expected);
  });
});
