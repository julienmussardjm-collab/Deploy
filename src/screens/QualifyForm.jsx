import { useState } from 'react';
import { BackIcon } from '../components/icons.jsx';
import { useScrolled } from '../hooks/useScrolled.js';
import { lookupEmail } from '../lib/emailLookup.js';

// [field, label, input type, placeholder]
const CONTACT_FIELDS = [
  ['name', 'Full name', 'text', 'Jane Doe'],
  ['title', 'Job title', 'text', 'Lighting engineer'],
  ['company', 'Company', 'text', 'Company BV'],
  ['country', 'Country', 'text', 'Netherlands'],
  ['email', 'Email', 'email', 'jane@company.com'],
  ['phone', 'Phone', 'tel', '+31 6 …'],
];

function EmailSuggest({ contact, onPick }) {
  const [lookup, setLookup] = useState({ status: 'idle' });
  const canLookup = contact.name.trim() && contact.company.trim();

  async function runLookup() {
    setLookup({ status: 'loading' });
    try {
      const result = await lookupEmail({
        name: contact.name,
        company: contact.company,
        country: contact.country,
      });
      setLookup({ status: 'done', ...result });
    } catch {
      setLookup({ status: 'error' });
    }
  }

  const hasScraped = lookup.scraped?.length > 0;
  const hasSuggestions = lookup.suggestions?.length > 0;

  return (
    <div className="qf-email-suggest">
      <button
        type="button"
        className="qf-suggest-btn"
        disabled={!canLookup || lookup.status === 'loading'}
        onClick={runLookup}
      >
        {lookup.status === 'loading' ? 'Searching…' : 'Suggest email'}
      </button>
      {!canLookup && <span className="qf-suggest-hint">Add name and company first.</span>}
      {lookup.status === 'error' && (
        <span className="qf-suggest-hint">Couldn’t reach the lookup — try again.</span>
      )}
      {lookup.status === 'done' && (
        <div className="qf-suggest-results">
          {hasScraped && (
            <div className="qf-suggest-group">
              <span className="qf-suggest-group-label">Found on company site</span>
              <div className="qf-suggest-chips">
                {lookup.scraped.map((email) => (
                  <button
                    type="button"
                    className="qf-suggest-chip qf-suggest-chip-found"
                    onClick={() => onPick(email)}
                    key={email}
                  >
                    {email}
                  </button>
                ))}
              </div>
            </div>
          )}
          {hasSuggestions && (
            <div className="qf-suggest-group">
              <span className="qf-suggest-group-label">
                Estimated{lookup.domain ? ` · ${lookup.domain}` : ''}
                {lookup.domainVerified === false ? ' (domain unconfirmed)' : ''}
              </span>
              <div className="qf-suggest-chips">
                {lookup.suggestions.map((email) => (
                  <button
                    type="button"
                    className="qf-suggest-chip"
                    onClick={() => onPick(email)}
                    key={email}
                  >
                    {email}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!hasScraped && !hasSuggestions && (
            <span className="qf-suggest-hint">No candidates found for this company.</span>
          )}
          {(hasScraped || hasSuggestions) && (
            <span className="qf-suggest-note">
              Not verified deliverable — confirm before using.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Lead form: contact details plus qualification (interests, follow-up,
// priority, notes). Used for new scans, re-scans, manual entry and edits.
export function QualifyForm({
  online,
  contact,
  interests,
  areas,
  action,
  actions,
  priority,
  priorities,
  notes,
  isEditing,
  isManual,
  isRescan,
  onBack,
  onToggleInterest,
  onSetAction,
  onSetPriority,
  onSetNotes,
  onSetContactField,
  onSave,
}) {
  const scrolled = useScrolled();

  const eyebrow = isEditing ? 'Editing' : isManual ? 'Manual entry' : 'Qualify';
  const title = isEditing ? 'Edit lead' : 'New lead';
  const showBadgeId = !isManual && !!contact.badgeId;
  const missingName = !contact.name.trim();
  const saveLabel = isEditing ? 'Save changes' : online ? 'Save lead' : 'Save lead · queue';
  const saveHint = missingName
    ? 'Add at least the attendee’s name to save.'
    : isEditing
      ? 'Updates this lead.'
      : online
        ? 'Saved to the team lead list.'
        : 'Stored on this phone — uploads when back online.';

  return (
    <div className="qf-root">
      <div className={`qf-header${scrolled ? ' qf-header-elevated' : ''}`}>
        <button className="qf-back" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        <div className="qf-header-mid">
          <div className="qf-eyebrow">{eyebrow}</div>
          <div className="qf-title">{title}</div>
        </div>
      </div>

      {isRescan && (
        <div className="qf-rescan-banner">
          <div className="qf-rescan-title">Already captured</div>
          <div className="qf-rescan-body">
            This badge was scanned earlier — you're updating the existing lead, not creating a new
            one.
          </div>
        </div>
      )}

      <div className="qf-card">
        <div className="qf-row-baseline">
          <span className="qf-eyebrow">Attendee</span>
          {showBadgeId && <span className="qf-badge-id">Badge {contact.badgeId}</span>}
        </div>
        <div className="qf-inputs">
          {CONTACT_FIELDS.map(([field, label, type, placeholder]) => (
            <label className="qf-input-row" key={field}>
              <span className="qf-input-label">{label}</span>
              <input
                className="qf-input"
                type={type}
                value={contact[field]}
                placeholder={placeholder}
                autoCapitalize={type === 'email' ? 'none' : 'words'}
                autoCorrect={type === 'email' ? 'off' : undefined}
                onChange={(e) => onSetContactField(field, e.target.value)}
              />
              {field === 'email' && (
                <EmailSuggest
                  contact={contact}
                  onPick={(email) => onSetContactField('email', email)}
                />
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="qf-card">
        <div className="qf-row-baseline">
          <span className="qf-eyebrow">Area of interest</span>
          <span className="qf-count">
            {interests.length} / {areas.length}
          </span>
        </div>
        <div className="qf-chip-grid">
          {areas.map((area) => {
            const on = interests.includes(area);
            return (
              <button
                className={`qf-chip${on ? ' qf-chip-on' : ''}`}
                onClick={() => onToggleInterest(area)}
                key={area}
              >
                <span className={`qf-checkbox${on ? ' qf-checkbox-on' : ''}`}>
                  <span className="qf-checkbox-tick" />
                </span>
                {area}
              </button>
            );
          })}
        </div>
      </div>

      <div className="qf-card">
        <span className="qf-eyebrow">Follow-up action</span>
        <div className="qf-action-list">
          {actions.map(([name, detail]) => {
            const on = action === name;
            return (
              <button
                className={`qf-action-row${on ? ' qf-action-row-on' : ''}`}
                onClick={() => onSetAction(name)}
                key={name}
              >
                <span className={`qf-action-rule${on ? ' qf-action-rule-on' : ''}`} />
                <span className={`qf-radio${on ? ' qf-radio-on' : ''}`}>
                  <span className={`qf-radio-dot${on ? ' qf-radio-dot-on' : ''}`} />
                </span>
                <span className="qf-action-text">
                  <span className="qf-action-name">{name}</span>
                  <span className="qf-action-detail">{detail}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="qf-subfield">
          <span className="qf-input-label">Priority</span>
          <div className="qf-seg">
            {priorities.map((p) => (
              <button
                className={`qf-seg-btn${priority === p ? ' qf-seg-btn-on' : ''}`}
                onClick={() => onSetPriority(p)}
                key={p}
              >
                <span className="qf-prio-dot" data-prio={p} />
                {p}
              </button>
            ))}
          </div>
        </div>
        <label className="qf-subfield">
          <span className="qf-input-label">Notes</span>
          <textarea
            className="qf-textarea"
            rows={3}
            value={notes}
            placeholder="What they asked for, project, timing…"
            onChange={(e) => onSetNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="qf-savebar">
        <button className="btn btn-primary btn-lg" onClick={onSave} disabled={missingName}>
          {saveLabel}
        </button>
        <div className="qf-save-hint">{saveHint}</div>
      </div>
    </div>
  );
}
