// Shared by the api/ functions (the _lib folder is not deployed as a function).
// Company domain guessing, email patterns and mail-server checks.
//
// The pattern list, legal-suffix list, country TLD map and domain slug logic
// come from the original production build of api/enrich-email.js.

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

export async function acceptsEmail(domain) {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

export function splitName(fullName) {
  const words = String(fullName || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return { first: words[0] || '', last: words.length > 1 ? words[words.length - 1] : '' };
}
