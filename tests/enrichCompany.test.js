import fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyCompany, countryFromDomain } from '../api/_lib/classify.js';
import { decodeEntities, extractPage } from '../api/_lib/extract.js';

vi.mock('dns/promises', () => ({
  default: {
    resolveMx: vi.fn(async (domain) =>
      domain.endsWith('.invalid') ? [] : [{ exchange: `mx.${domain}` }],
    ),
  },
}));

vi.mock('../api/_lib/team.js', () => ({
  teamCodeOk: vi.fn(async (code) => code === 'INV-GOOD-CODE'),
}));

const home = fs.readFileSync('tests/fixtures/lumen-home.html', 'utf8');
const about = fs.readFileSync('tests/fixtures/lumen-about.html', 'utf8');

describe('extractPage', () => {
  const page = extractPage(home, 'https://www.lumen-licht.de/');

  it('reads title, description and site name', () => {
    expect(page.title).toBe('Lumen Licht GmbH – Leuchtenhersteller für Straßenbeleuchtung');
    expect(page.description).toContain('Industrie & Logistik');
    expect(page.siteName).toBe('Lumen Licht');
    expect(page.lang).toBe('de');
  });

  it('reads the schema.org organization inside an @graph', () => {
    expect(page.org).toMatchObject({
      name: 'Lumen Licht GmbH',
      country: 'DE',
      city: 'Stuttgart',
      telephone: '+49 711 123456',
      employees: 120,
      founded: '1998',
    });
  });

  it('collects social links, contact details and next pages', () => {
    expect(page.social.linkedin).toBe('https://www.linkedin.com/company/lumen-licht');
    expect(page.social.youtube).toBe('https://www.youtube.com/@lumenlicht');
    expect(page.social.facebook).toBe('https://www.facebook.com/lumenlicht');
    expect(page.emails).toContain('vertrieb@lumen-licht.de');
    expect(page.emails).not.toContain('info@tracker.example'); // inside a script
    expect(page.phones).toContain('+49711123456');
    expect(page.nextPages).toEqual([
      'https://www.lumen-licht.de/de/unternehmen/',
      'https://www.lumen-licht.de/de/kontakt',
      'https://www.lumen-licht.de/de/produkte/strassenleuchten',
    ]);
  });

  it('decodes HTML entities', () => {
    expect(decodeEntities('Licht &amp; Leuchten &#8211; &#x2014; &nbsp;')).toBe(
      'Licht & Leuchten – —  ',
    );
  });
});

describe('classifyCompany', () => {
  it('recognises a German luminaire maker and its segments', () => {
    const page = extractPage(home, 'https://www.lumen-licht.de/');
    const result = classifyCompany({
      text: `${page.title} ${page.text}`,
      domain: 'lumen-licht.de',
    });
    expect(result.companyType).toBe('Luminaire manufacturer (OEM)');
    expect(['high', 'medium']).toContain(result.typeConfidence);
    expect(result.segments).toEqual(expect.arrayContaining(['Street & Area', 'Industry']));
    expect(result.tech).toEqual(expect.arrayContaining(['DALI-2', 'D4i', 'Zhaga']));
    expect(result.tech).not.toContain('DALI');
  });

  it('recognises a distributor', () => {
    const result = classifyCompany({
      text: 'Grossiste en matériel électrique. Distributeur officiel des grandes marques, webshop et stock.',
      domain: 'elec-grossiste.fr',
    });
    expect(result.companyType).toBe('Distributor / wholesaler');
  });

  it('sees a French electrical wholesaler as a distributor, not an installer', () => {
    const result = classifyCompany({
      text:
        'Rexel, leader multi-spécialiste du matériel électrique professionnel. ' +
        'Solutions pour les électriciens : installation, éclairage, sécurité. Livraison sur chantier.',
      domain: 'rexel.fr',
    });
    expect(result.companyType).toBe('Distributor / wholesaler');
  });

  it('keeps the four most-mentioned segments', () => {
    const result = classifyCompany({
      text:
        'street lighting street lighting street lighting stadium stadium greenhouse ' +
        'high bay office lighting signage facade lighting',
      domain: 'x.com',
    });
    expect(result.segments).toHaveLength(4);
    expect(result.segments[0]).toBe('Street & Area');
    expect(result.segments[1]).toBe('Sports');
  });

  it('flags competitors and Inventronics itself by domain', () => {
    expect(classifyCompany({ text: '', domain: 'meanwell.com' }).companyType).toBe(
      'LED driver / power supply maker (competitor)',
    );
    expect(classifyCompany({ text: '', domain: 'inventronicsglobal.com' }).companyType).toBe(
      'Inventronics (internal)',
    );
  });

  it('stays at Unknown without evidence', () => {
    expect(
      classifyCompany({ text: 'Welcome to our website', domain: 'acme.com' }).companyType,
    ).toBe('Unknown');
  });

  it('maps country-code domains to countries', () => {
    expect(countryFromDomain('lumen-licht.de')).toBe('Germany');
    expect(countryFromDomain('acme.com')).toBeNull();
  });
});

describe('researchCompany', () => {
  const pages = {
    'https://lumen-licht.de/': { html: home, url: 'https://www.lumen-licht.de/' },
    'https://www.lumen-licht.de/de/unternehmen/': {
      html: about.replace(
        'presse@lumen-licht.de',
        'presse@lumen-licht.de, jan.weber@lumen-licht.de',
      ),
    },
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const page = pages[url];
        if (!page) return { ok: false, headers: new Headers(), text: async () => '' };
        return {
          ok: true,
          url: page.url || url,
          headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
          text: async () => page.html,
        };
      }),
    );
  });

  it('builds the intel from the badge email domain', async () => {
    const { researchCompany } = await import('../api/enrich-company.js');
    const intel = await researchCompany({
      name: 'Mira Keller',
      company: 'Lumen Licht GmbH',
      country: 'Germany',
      email: 'm.keller@lumen-licht.de',
    });
    expect(intel).toMatchObject({
      status: 'done',
      domain: 'lumen-licht.de',
      domainSource: 'email',
      website: 'https://www.lumen-licht.de',
      siteName: 'Lumen Licht',
      country: 'DE',
      city: 'Stuttgart',
      companyType: 'Luminaire manufacturer (OEM)',
      linkedinCompany: 'https://www.linkedin.com/company/lumen-licht',
      employees: 120,
    });
    expect(intel.email.badgeDomainAcceptsMail).toBe(true);
    expect(intel.email.found).toEqual(
      expect.arrayContaining([
        'vertrieb@lumen-licht.de',
        'info@lumen-licht.de',
        'presse@lumen-licht.de',
      ]),
    );
    expect(intel.email.found).not.toContain('jan.weber@lumen-licht.de'); // a named colleague
    expect(intel.phone).toBe('+49 711 123456'); // declared by the company, not the first tel: link
    expect(intel.email.guessed).toEqual([]); // the badge already has a work email
  });

  it('falls back to the company name for free-mail badges', async () => {
    const { researchCompany } = await import('../api/enrich-company.js');
    const intel = await researchCompany({
      name: 'Tom Baker',
      company: 'Acme Ltd',
      country: 'United Kingdom',
      email: 'tom.baker@gmail.com',
    });
    expect(intel.domain).toBe('acme.com');
    expect(intel.domainSource).toBe('company_name');
    expect(intel.status).toBe('no_site'); // the site did not answer
    expect(intel.email.guessed[0]).toBe('tom.baker@acme.com');
  });

  it('reports when no company can be found', async () => {
    const { researchCompany } = await import('../api/enrich-company.js');
    const intel = await researchCompany({ name: 'Jo', company: '', email: '' });
    expect(intel.status).toBe('no_company');
  });
});

describe('enrich-company handler', () => {
  function call(query) {
    const res = { statusCode: 0, body: null, headers: {} };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    res.setHeader = (k, v) => (res.headers[k] = v);
    return import('../api/enrich-company.js').then(({ default: handler }) =>
      handler({ method: 'GET', query }, res).then(() => res),
    );
  }

  it('refuses a wrong team code', async () => {
    const res = await call({ code: 'nope', company: 'Acme' });
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'invalid_team_code' });
  });

  it('answers with the right code (case-insensitive)', async () => {
    const res = await call({ code: 'inv-good-code', name: 'Jo', company: '' });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('no_company');
  });
});
