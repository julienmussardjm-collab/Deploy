// POST /api/enrich-email  { name, company, country }
//  -> { domain, domainVerified, suggestions: string[], scraped: string[] }
//
// Guesses a contact's work email: finds the company domain (checked via MX
// records), builds the usual address patterns, and collects addresses that
// appear on the company's own website. Nothing here proves an address is
// deliverable; the UI says so.
//
// Recovered from the production deployment: the pattern list, legal-suffix
// list, country TLD map and domain-slug logic are the original code; the
// domain check, site scraping and handler were rebuilt around the response
// shape the app expects.

import dns from 'dns/promises';

const PATTERNS = [
  (first, last, domain) => `${first}.${last}@${domain}`,
  (first, last, domain) => `${first}@${domain}`,
  (first, last, domain) => `${first[0]}${last}@${domain}`,
  (first, last, domain) => `${first[0]}.${last}@${domain}`,
  (first, last, domain) => `${first}${last}@${domain}`,
  (first, last, domain) => `${last}.${first}@${domain}`,
  (first, last, domain) => `${first}${last[0]}@${domain}`,
  (first, last, domain) => `${last}@${domain}`,
];

export function guessEmails(firstName, lastName, domain) {
  const first = firstName
    ?.toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
  const last = lastName
    ?.toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
  if (!first) return [];
  const emails = new Set();
  if (last) {
    for (const pattern of PATTERNS) {
      try {
        emails.add(pattern(first, last, domain));
      } catch {
        // Skip patterns that do not apply.
      }
    }
  } else {
    emails.add(`${first}@${domain}`);
  }
  return [...emails];
}

const LEGAL_SUFFIXES = [
  'gmbh',
  'mbh',
  'ag',
  'kgaa',
  'kg',
  'ohg',
  'ug',
  'ev',
  'ltd',
  'llc',
  'inc',
  'plc',
  'corp',
  'corporation',
  'company',
  'co',
  'sa',
  'sas',
  'sasu',
  'sarl',
  'eurl',
  'bv',
  'nv',
  'oy',
  'oyj',
  'ab',
  'as',
  'aps',
  'spa',
  'srl',
  'group',
  'holding',
  'international',
  'ltda',
  'pty',
];

const COUNTRY_TLDS = {
  germany: 'de',
  deutschland: 'de',
  france: 'fr',
  netherlands: 'nl',
  belgium: 'be',
  italy: 'it',
  spain: 'es',
  switzerland: 'ch',
  austria: 'at',
  sweden: 'se',
  denmark: 'dk',
  norway: 'no',
  finland: 'fi',
  portugal: 'pt',
  ireland: 'ie',
  poland: 'pl',
  'czech republic': 'cz',
  czechia: 'cz',
  'united kingdom': 'co.uk',
  uk: 'co.uk',
  china: 'cn',
  japan: 'jp',
  'south korea': 'kr',
  india: 'in',
  brazil: 'com.br',
  canada: 'ca',
  australia: 'com.au',
  turkey: 'com.tr',
  'united arab emirates': 'ae',
  uae: 'ae',
};

// "Müller Licht GmbH & Co. KG" -> "mullerlicht"
export function companySlug(company) {
  const words = company
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((word) => !LEGAL_SUFFIXES.includes(word));
  // "GmbH & Co. KG": once the suffixes are gone, the "&" is left dangling.
  while (words[words.length - 1] === 'and') words.pop();
  return words.join('');
}

// Candidate domains, most likely first: .com, then the country TLD.
export function candidateDomains(company, country) {
  const slug = companySlug(company || '');
  if (!slug) return [];
  const tlds = ['com'];
  const countryTld = COUNTRY_TLDS[(country || '').trim().toLowerCase()];
  if (countryTld && countryTld !== 'com') tlds.push(countryTld);
  return [...new Set(tlds.map((tld) => `${slug}.${tld}`))];
}

async function acceptsEmail(domain) {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

const SCRAPE_PATHS = ['', '/contact', '/kontakt', '/impressum', '/contatti', '/about'];
const SCRAPE_TIMEOUT_MS = 3000;
const MAX_SCRAPED = 6;
const EMAIL_IN_PAGE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InventronicsLeadScanner/1.0)' },
      redirect: 'follow',
    });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

// Addresses on the company's own site that belong to its domain.
async function scrapeCompanyEmails(domain) {
  const pages = await Promise.all(
    SCRAPE_PATHS.map((path) => fetchPage(`https://${domain}${path}`)),
  );
  const found = new Set();
  for (const html of pages) {
    for (const match of html.matchAll(EMAIL_IN_PAGE)) {
      const email = match[0].toLowerCase();
      if (email.endsWith(`@${domain}`) || email.endsWith(`.${domain}`)) found.add(email);
    }
  }
  return [...found].slice(0, MAX_SCRAPED);
}

function splitName(fullName) {
  const words = String(fullName || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return { first: words[0] || '', last: words.length > 1 ? words[words.length - 1] : '' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { name, company, country } = body;
  const domains = candidateDomains(company, country);
  if (!name || !domains.length) {
    res.status(200).json({ domain: null, domainVerified: false, suggestions: [], scraped: [] });
    return;
  }

  const checks = await Promise.all(domains.map(acceptsEmail));
  const verifiedIndex = checks.indexOf(true);
  const domainVerified = verifiedIndex !== -1;
  const domain = domains[domainVerified ? verifiedIndex : 0];

  const { first, last } = splitName(name);
  const suggestions = guessEmails(first, last, domain);
  const scraped = domainVerified ? await scrapeCompanyEmails(domain) : [];

  res.status(200).json({ domain, domainVerified, suggestions, scraped });
}
