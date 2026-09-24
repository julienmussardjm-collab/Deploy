// Checks the shared team code against the team database, so the api/
// functions cannot be used as an open scraping proxy.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uugwgvoxxsunbelrjwjk.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_B3OC7tzwW5uYvYwWG15w-A_CxbDu7w9';

// Accepted codes are remembered while the function instance stays warm.
const accepted = new Map();
const REMEMBER_MS = 10 * 60_000;

export async function teamCodeOk(code) {
  if (!code) return false;
  if ((accepted.get(code) ?? 0) > Date.now()) return true;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/team_code_ok`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: code }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`team_code_ok failed (${response.status})`);
  const ok = (await response.json()) === true;
  if (ok) accepted.set(code, Date.now() + REMEMBER_MS);
  return ok;
}
