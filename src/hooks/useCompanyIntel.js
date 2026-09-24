import { useEffect, useState } from 'react';
import { canResearch, intelKey, requestIntel } from '../lib/companyIntel.js';

// Waits for typing to settle before researching a manually entered company.
const TYPING_DELAY_MS = 900;

// Company research for the contact being qualified. Starts as soon as the
// form opens with a scanned badge, or once the rep has typed a company or
// email. `existing` is the intel already stored on the lead (edit, re-scan).
// Returns { status: 'idle' | 'loading' | 'done' | 'error', intel }.
export function useCompanyIntel(contact, { code, online, existing }) {
  const key = contact ? intelKey(contact) : null;
  const reusable = existing && existing.key === key ? existing : null;
  const [state, setState] = useState({ key: null, status: 'idle', intel: null });

  useEffect(() => {
    if (!contact || reusable || !code || !online || !canResearch(contact)) return undefined;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        setState({ key, status: 'loading', intel: null });
        try {
          const intel = await requestIntel(contact, code);
          if (!cancelled) setState({ key, status: 'done', intel });
        } catch {
          if (!cancelled) setState({ key, status: 'error', intel: null });
        }
      },
      contact.badgeId && !contact.badgeId.startsWith('MANUAL-') ? 0 : TYPING_DELAY_MS,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // The key captures every contact field the research depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, code, online, !!reusable]);

  if (reusable) return { status: 'done', intel: reusable };
  if (!contact || state.key !== key) return { status: 'idle', intel: null };
  return state;
}
