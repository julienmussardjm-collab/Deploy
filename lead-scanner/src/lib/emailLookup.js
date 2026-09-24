// Client for /api/enrich-email. Resolves with
// { domain, domainVerified, suggestions: string[], scraped: string[] }.
export async function lookupEmail({ name, company, country }) {
  const response = await fetch('/api/enrich-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, company, country }),
  });
  if (!response.ok) throw new Error(`enrich-email failed (${response.status})`);
  return response.json();
}
