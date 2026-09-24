import { BackIcon, MailIcon, PhoneIcon } from '../components/icons.jsx';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export function LeadDetail({ lead, onBack, onEdit, onScanNext }) {
  const queued = lead.status === 'queued';
  const location = lead.eventLocation || lead.boothLocation || '';
  const captured = [timeFormat.format(lead.capturedAt), location].filter(Boolean).join(' · ');
  const eventName = lead.eventName || lead.boothLabel || '';

  return (
    <div className="ld-root">
      <div className="ld-header">
        <div className="ld-header-row">
          <button className="ld-back" onClick={onBack} aria-label="Back to scanner">
            <BackIcon />
          </button>
          <span
            className="ld-status-pill"
            title={
              queued ? 'Stored on this phone — uploads when online' : 'Saved to the team lead list'
            }
          >
            <span
              className="ld-status-dot"
              style={{ background: queued ? 'var(--status-warning)' : '#24D4C9' }}
            />
            <span className="ld-status-text">{queued ? 'QUEUED' : 'SYNCED'}</span>
          </span>
        </div>
        <div className="ld-name">{lead.name}</div>
        <div className="ld-subtitle">
          {lead.title || 'Title not provided'}
          <br />
          {[lead.company, lead.country].filter(Boolean).join(' · ') || 'Company not provided'}
        </div>
      </div>

      <div className="ld-card">
        <span className="ld-eyebrow">Contact</span>
        <div className="ld-rows">
          <div className="ld-row">
            <span className="ld-row-label">Email</span>
            {lead.email ? (
              <a className="ld-row-value ld-mono ld-link" href={`mailto:${lead.email}`}>
                <MailIcon /> {lead.email}
              </a>
            ) : (
              <span className="ld-row-value ld-mono">—</span>
            )}
          </div>
          <div className="ld-row">
            <span className="ld-row-label">Phone</span>
            {lead.phone ? (
              <a
                className="ld-row-value ld-mono ld-link"
                href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}
              >
                <PhoneIcon /> {lead.phone}
              </a>
            ) : (
              <span className="ld-row-value ld-mono">—</span>
            )}
          </div>
          <div className="ld-row">
            <span className="ld-row-label">Badge</span>
            <span className="ld-row-value ld-mono">{lead.badgeId}</span>
          </div>
          {eventName && (
            <div className="ld-row">
              <span className="ld-row-label">Event</span>
              <span className="ld-row-value ld-medium">{eventName}</span>
            </div>
          )}
          <div className="ld-row">
            <span className="ld-row-label">Captured</span>
            <span className="ld-row-value ld-medium">{captured}</span>
          </div>
        </div>
      </div>

      <div className="ld-card">
        <span className="ld-eyebrow">Area of interest</span>
        <div className="ld-tags">
          {(lead.interests.length ? lead.interests : ['None recorded']).map((interest) => (
            <span className="ld-tag" key={interest}>
              {interest}
            </span>
          ))}
        </div>
      </div>

      <div className="ld-card">
        <div className="ld-row-baseline">
          <span className="ld-eyebrow">Follow-up</span>
          {lead.priority && (
            <span className="ld-prio" data-prio={lead.priority}>
              <span className="ld-prio-dot" data-prio={lead.priority} />
              {lead.priority.toUpperCase()}
            </span>
          )}
        </div>
        <div className="ld-action-row">
          <span className="ld-avatar">{lead.capturedByInitials || '—'}</span>
          <div className="ld-action-text">
            <div className="ld-action-name">{lead.action}</div>
            <div className="ld-action-owner">
              {lead.capturedBy ? `Owned by ${lead.capturedBy}` : 'Unassigned'}
            </div>
          </div>
        </div>
        {lead.notes && <div className="ld-notes">{lead.notes}</div>}
      </div>

      {lead.rawScan && (
        <details className="ld-raw">
          <summary className="ld-raw-summary">Raw badge data</summary>
          <pre className="ld-raw-body">{lead.rawScan}</pre>
        </details>
      )}

      <div className="ld-footer">
        <button className="btn btn-secondary ld-edit-btn" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn-primary ld-scan-btn" onClick={onScanNext}>
          Scan next badge
        </button>
      </div>
    </div>
  );
}
