import { describe, expect, it } from 'vitest';
import { candidateDomains, companySlug, guessEmails } from '../api/enrich-email.js';

describe('enrich-email helpers', () => {
  it('drops legal suffixes and accents from company names', () => {
    expect(companySlug('Müller Licht GmbH')).toBe('mullerlicht');
    expect(companySlug('Müller Licht GmbH & Co. KG')).toBe('mullerlicht');
    expect(companySlug('Marks & Spencer')).toBe('marksandspencer');
    expect(companySlug('Lumen B.V.')).toBe('lumenbv');
    expect(companySlug('Lumen BV')).toBe('lumen');
  });

  it('tries .com then the country TLD', () => {
    expect(candidateDomains('Lumen BV', 'Netherlands')).toEqual(['lumen.com', 'lumen.nl']);
    expect(candidateDomains('Acme Ltd', 'United Kingdom')).toEqual(['acme.com', 'acme.co.uk']);
    expect(candidateDomains('', 'France')).toEqual([]);
  });

  it('builds the usual address patterns', () => {
    expect(guessEmails('Mira', 'Keller', 'lumen.nl')).toEqual([
      'mira.keller@lumen.nl',
      'mira@lumen.nl',
      'mkeller@lumen.nl',
      'm.keller@lumen.nl',
      'mirakeller@lumen.nl',
      'keller.mira@lumen.nl',
      'mirak@lumen.nl',
      'keller@lumen.nl',
    ]);
    expect(guessEmails('Mira', '', 'lumen.nl')).toEqual(['mira@lumen.nl']);
  });
});
