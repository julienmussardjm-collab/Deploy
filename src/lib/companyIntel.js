// Client for /api/enrich-company: researches the attendee's company from
// the badge (see api/enrich-company.js). Results are cached for the session
// so the form, the save and the background pass share one request.

const cache = new Map();

// Identifies one research: the inputs the server uses.
export function intelKey({ email, company, country }) {
  return [email, company, country]
    .map((v) =>
      String(v ?? '')
        .trim()
        .toLowerCase(),
    )
    .join('|');
}

// Enough to research: a company name or an email address.
export function canResearch({ email, company }) {
  return (
    /@[^@\s]+\.[a-z]{2,}$/i.test(String(email || '').trim()) ||
    String(company || '').trim().length >= 2
  );
}

async function fetchIntel(contact, code) {
  const response = await fetch('/api/enrich-company', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      name: contact.name,
      company: contact.company,
      country: contact.country,
      email: contact.email,
    }),
  });
  if (!response.ok) throw new Error(`enrich-company failed (${response.status})`);
  return { ...(await response.json()), key: intelKey(contact) };
}

// `fresh` skips the session cache (the "Refresh" button).
export function requestIntel(contact, code, { fresh = false } = {}) {
  const key = intelKey(contact);
  if (!fresh && cache.has(key)) return cache.get(key);
  const promise = fetchIntel(contact, code);
  cache.set(key, promise);
  promise.catch(() => cache.delete(key)); // let a later attempt retry
  return promise;
}

// Opens a LinkedIn search in the salesperson's own LinkedIn session. Nothing
// is scraped or stored: the rep sees what LinkedIn shows them.
export function linkedinPeopleSearch(name, company) {
  const keywords = [name, company]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export function linkedinCompanySearch(company) {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(String(company || '').trim())}`;
}

export function webSearch(name, company) {
  const q = [name, company]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

// Short label for the company type, e.g. "Luminaire manufacturer (OEM)" ->
// "Luminaire manufacturer (OEM) · likely".
export function typeLabel(intel) {
  if (!intel?.companyType || intel.companyType === 'Unknown') return null;
  const qualifier =
    { high: '', medium: ' · likely', low: ' · possible' }[intel.typeConfidence] ?? '';
  return `${intel.companyType}${qualifier}`;
}
