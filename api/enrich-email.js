// POST /api/enrich-email  { name, company, country }
//  -> { domain, domainVerified, suggestions: string[], scraped: string[] }
//
// Guesses a contact's work email: finds the company domain (checked via MX
// records), builds the usual address patterns, and collects addresses that
// appear on the company's own website. Nothing here proves an address is
// deliverable; the UI says so.

import {
  acceptsEmail,
  candidateDomains,
  companySlug,
  guessEmails,
  splitName,
} from './_lib/domains.js';

export { candidateDomains, companySlug, guessEmails };

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
