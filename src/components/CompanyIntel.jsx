import {
  linkedinCompanySearch,
  linkedinPeopleSearch,
  typeLabel,
  webSearch,
} from '../lib/companyIntel.js';

const firstName = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)[0] || 'this person';

function StatusLine({ status, intel, domainHint }) {
  if (status === 'loading') {
    return (
      <div className="ci-status">
        <span className="ci-dot" />
        Researching {domainHint || 'the company'}…
      </div>
    );
  }
  if (status === 'error') {
    return <div className="ci-status ci-status-muted">Company research unavailable right now.</div>;
  }
  if (intel?.status === 'no_company') {
    return (
      <div className="ci-status ci-status-muted">
        No company website found. Add the company name or a work email.
      </div>
    );
  }
  if (intel?.status === 'no_site') {
    return (
      <div className="ci-status ci-status-muted">
        {intel.domain} did not answer (some sites block automated visits).
      </div>
    );
  }
  return null;
}

function Links({ intel, name, company }) {
  const companyName = company || intel?.siteName || intel?.domain || '';
  return (
    <div className="ci-links">
      <a
        className="ci-link ci-link-primary"
        href={linkedinPeopleSearch(name, companyName)}
        target="_blank"
        rel="noreferrer"
      >
        Find {firstName(name)} on LinkedIn
      </a>
      <a
        className="ci-link"
        href={intel?.linkedinCompany || linkedinCompanySearch(companyName)}
        target="_blank"
        rel="noreferrer"
      >
        {intel?.linkedinCompany ? 'Company LinkedIn' : 'Search company on LinkedIn'}
      </a>
      {intel?.website && (
        <a className="ci-link" href={intel.website} target="_blank" rel="noreferrer">
          Website
        </a>
      )}
      <a className="ci-link" href={webSearch(name, companyName)} target="_blank" rel="noreferrer">
        Web search
      </a>
    </div>
  );
}

// Compact panel in the lead form: what kind of company this is and which
// segments to tick, available a few seconds after the scan.
export function IntelPanel({ state, contact, interests, onToggleInterest }) {
  const { status, intel } = state;
  if (status === 'idle') return null;
  const label = typeLabel(intel);
  const suggested = (intel?.segments || []).filter((s) => !interests.includes(s));
  return (
    <div className="qf-card ci-panel">
      <div className="qf-row-baseline">
        <span className="qf-eyebrow">Company intel</span>
        {intel?.domain && <span className="qf-badge-id">{intel.domain}</span>}
      </div>
      <StatusLine status={status} intel={intel} domainHint={intel?.domain || contact.company} />
      {intel?.status === 'done' && (
        <>
          {label && <div className="ci-type">{label}</div>}
          {intel.description && <p className="ci-desc ci-desc-clamp">{intel.description}</p>}
          {suggested.length > 0 && (
            <div className="ci-suggest">
              <span className="qf-input-label">Suggested areas · tap to add</span>
              <div className="ci-chips">
                {suggested.map((segment) => (
                  <button
                    type="button"
                    className="ci-chip ci-chip-add"
                    onClick={() => onToggleInterest(segment)}
                    key={segment}
                  >
                    + {segment}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {status !== 'loading' && (
        <Links intel={intel} name={contact.name} company={contact.company} />
      )}
    </div>
  );
}

// Full company card on the lead page.
export function CompanyIntelCard({ lead, researching, onRefresh }) {
  const intel = lead.intel;
  const status = researching ? 'loading' : intel ? 'done' : 'idle';
  const label = typeLabel(intel);
  const facts = [
    [intel?.city, intel?.country].filter(Boolean).join(', '),
    intel?.employees ? `${intel.employees} employees` : null,
    intel?.founded ? `founded ${intel.founded}` : null,
  ].filter(Boolean);
  const mail = intel?.email;

  return (
    <div className="ld-card">
      <div className="ld-row-baseline">
        <span className="ld-eyebrow">Company intel</span>
        {!researching && onRefresh && (
          <button className="ci-refresh" onClick={onRefresh}>
            {intel ? 'Refresh' : 'Research'}
          </button>
        )}
      </div>

      {status === 'idle' && (
        <div className="ci-status ci-status-muted">
          {onRefresh ? 'Not researched yet.' : 'Research runs when the phone is back online.'}
        </div>
      )}
      <StatusLine status={status} intel={intel} domainHint={intel?.domain || lead.company} />

      {intel?.status === 'done' && (
        <>
          <div className="ci-head">
            <span className="ci-name">{intel.siteName || intel.domain}</span>
            {intel.domainSource === 'company_name' && (
              <span className="ci-note">found from the company name</span>
            )}
          </div>
          {label && <div className="ci-type">{label}</div>}
          {intel.description && <p className="ci-desc">{intel.description}</p>}
          {facts.length > 0 && <div className="ci-facts">{facts.join(' · ')}</div>}
          {(intel.segments?.length > 0 || intel.tech?.length > 0) && (
            <div className="ci-chips">
              {intel.segments?.map((s) => (
                <span className="ci-chip" key={s}>
                  {s}
                </span>
              ))}
              {intel.tech?.map((t) => (
                <span className="ci-chip ci-chip-tech" key={t}>
                  {t}
                </span>
              ))}
            </div>
          )}
          {intel.phone && (
            <a
              className="ld-link ld-mono ci-phone"
              href={`tel:${intel.phone.replace(/[^+\d]/g, '')}`}
            >
              {intel.phone}
            </a>
          )}
        </>
      )}

      {mail && (
        <div className="ci-mail">
          {mail.badge && mail.badgeDomainAcceptsMail === false && (
            <div className="ci-warn">
              The domain of {mail.badge} has no mail server. Check the address.
            </div>
          )}
          {mail.found?.length > 0 && (
            <>
              <span className="qf-input-label">Company addresses</span>
              <div className="ci-chips">
                {mail.found.map((e) => (
                  <a className="ci-chip ci-chip-mail" href={`mailto:${e}`} key={e}>
                    {e}
                  </a>
                ))}
              </div>
            </>
          )}
          {!lead.email && mail.guessed?.length > 0 && (
            <>
              <span className="qf-input-label">Likely formats (unverified)</span>
              <div className="ci-chips">
                {mail.guessed.map((e) => (
                  <span className="ci-chip ci-chip-mail" key={e}>
                    {e}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!researching && <Links intel={intel} name={lead.name} company={lead.company} />}
    </div>
  );
}
