import { describe, expect, it } from 'vitest';
import { parseBadge } from '../src/lib/badgeParser.js';

describe('parseBadge', () => {
  it('reads a multi-line vCard', () => {
    const raw = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Keller;Mira',
      'ORG:Lumen BV;Lighting',
      'TITLE:Product manager',
      'TEL;TYPE=work:+31 6 1234 5678',
      'EMAIL:mira@lumen.nl',
      'ADR:;;Main St 1;Eindhoven;;5611;Netherlands',
      'X-REFCODE:ABC123',
      'END:VCARD',
    ].join('\r\n');
    expect(parseBadge(raw)).toEqual({
      badgeId: 'ABC123',
      name: 'Mira Keller',
      title: 'Product manager',
      company: 'Lumen BV Lighting',
      country: 'Netherlands',
      email: 'mira@lumen.nl',
      phone: '+31 6 1234 5678',
    });
  });

  it('reads a vCard flattened onto one line', () => {
    const raw = 'BEGIN:VCARD VERSION:3.0 FN:Mira Keller ORG:Lumen EMAIL:mira@lumen.nl END:VCARD';
    const contact = parseBadge(raw);
    expect(contact.name).toBe('Mira Keller');
    expect(contact.company).toBe('Lumen');
    expect(contact.email).toBe('mira@lumen.nl');
    expect(contact.badgeId).toBe('mira@lumen.nl');
  });

  it('strips vCard group prefixes', () => {
    const raw = 'BEGIN:VCARD\nFN:Jo Smith\nitem1.EMAIL:jo@x.com\nEND:VCARD';
    expect(parseBadge(raw).email).toBe('jo@x.com');
  });

  it('reads JSON badges', () => {
    const contact = parseBadge('{"id":"42","name":"Jo","role":"Buyer","company":"X"}');
    expect(contact).toMatchObject({ badgeId: '42', name: 'Jo', title: 'Buyer', company: 'X' });
  });

  it('reads pipe-separated badges', () => {
    const contact = parseBadge('B1|Jo Smith|Engineer|Acme|UK|jo@acme.com|+44 1');
    expect(contact).toEqual({
      badgeId: 'B1',
      name: 'Jo Smith',
      title: 'Engineer',
      company: 'Acme',
      country: 'UK',
      email: 'jo@acme.com',
      phone: '+44 1',
    });
  });

  it('reads the GES / LiGHT compact code', () => {
    expect(parseBadge('a1b2c3d4e5f6XYZSmith')).toMatchObject({
      badgeId: 'a1b2c3d4e5f6',
      name: 'Smith',
    });
  });

  it('keeps unknown codes as the badge ID', () => {
    expect(parseBadge('  12345  ')).toMatchObject({ badgeId: '12345', name: 'Unknown attendee' });
  });
});
