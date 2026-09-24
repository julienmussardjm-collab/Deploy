import { useState } from 'react';
import { BackIcon, DownloadIcon } from '../components/icons.jsx';
import { useScrolled } from '../hooks/useScrolled.js';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const NO_EVENT = 'No event';

const EXPORT_MESSAGES = {
  shared: 'Shared.',
  downloaded: 'CSV downloaded.',
  cancelled: 'Export cancelled.',
  failed: "Couldn't export on this device.",
};

function formatCapturedAt(timestamp) {
  const date = new Date(timestamp);
  if (date.toDateString() === new Date().toDateString()) return timeFormat.format(date);
  return `${dayFormat.format(date)}, ${timeFormat.format(date)}`;
}

// boothLabel is the field name used by early builds.
const eventOf = (lead) => lead.eventName || lead.boothLabel || NO_EVENT;

export function LeadList({ leads, currentUser, onBack, onOpenLead, onExport }) {
  const [owner, setOwner] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [exportResult, setExportResult] = useState(null);
  const scrolled = useScrolled();

  const eventCounts = (() => {
    const counts = new Map();
    for (const lead of leads) {
      const event = eventOf(lead);
      counts.set(event, (counts.get(event) || 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  })();

  // Fall back to "all" if the selected event no longer has leads.
  const eventFilter =
    selectedEvent !== 'all' && eventCounts.some((e) => e.name === selectedEvent)
      ? selectedEvent
      : 'all';

  const visible = leads.filter(
    (lead) =>
      !(
        (owner === 'mine' && currentUser && lead.capturedBy !== currentUser.name) ||
        (eventFilter !== 'all' && eventOf(lead) !== eventFilter)
      ),
  );

  // Group by event only when showing several events at once.
  const groups = (() => {
    if (eventFilter !== 'all' || eventCounts.length < 2) return [{ name: null, leads: visible }];
    const byEvent = new Map();
    for (const lead of visible) {
      const event = eventOf(lead);
      if (!byEvent.has(event)) byEvent.set(event, []);
      byEvent.get(event).push(lead);
    }
    return [...byEvent.entries()].map(([name, groupLeads]) => ({ name, leads: groupLeads }));
  })();

  async function handleExport() {
    const label = [
      eventFilter === 'all' ? 'all-events' : eventFilter,
      owner === 'mine' && currentUser ? currentUser.name : null,
    ]
      .filter(Boolean)
      .join('-');
    const result = await onExport(visible, label);
    setExportResult(result);
    setTimeout(() => setExportResult(null), 4000);
  }

  return (
    <div className="ll-root">
      <div className={`ll-header${scrolled ? ' ll-header-elevated' : ''}`}>
        <button className="ll-back" onClick={onBack} aria-label="Back to scanner">
          <BackIcon />
        </button>
        <div className="ll-header-mid">
          <div className="ll-eyebrow">{leads.length} captured</div>
          <div className="ll-title">Leads</div>
        </div>
        <button
          className="ll-export"
          onClick={handleExport}
          disabled={visible.length === 0}
          aria-label={`Export ${visible.length} leads as CSV`}
        >
          <DownloadIcon />
          <span>Export</span>
        </button>
      </div>

      <div className="ll-filters">
        {currentUser && (
          <div className="ll-filter">
            <button
              className={`ll-filter-btn${owner === 'all' ? ' ll-filter-btn-on' : ''}`}
              onClick={() => setOwner('all')}
            >
              Everyone
            </button>
            <button
              className={`ll-filter-btn${owner === 'mine' ? ' ll-filter-btn-on' : ''}`}
              onClick={() => setOwner('mine')}
            >
              Mine
            </button>
          </div>
        )}
        {eventCounts.length > 1 && (
          <div className="ll-events" role="group" aria-label="Filter by event">
            <button
              className={`ll-event-chip${eventFilter === 'all' ? ' ll-event-chip-on' : ''}`}
              onClick={() => setSelectedEvent('all')}
            >
              All events
              <span className="ll-event-count">{leads.length}</span>
            </button>
            {eventCounts.map((event) => (
              <button
                className={`ll-event-chip${eventFilter === event.name ? ' ll-event-chip-on' : ''}`}
                onClick={() => setSelectedEvent(event.name)}
                key={event.name}
              >
                {event.name}
                <span className="ll-event-count">{event.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {exportResult && (
        <div className="ll-export-note">
          {EXPORT_MESSAGES[exportResult]}
          {exportResult === 'downloaded' &&
            ` ${visible.length} lead${visible.length === 1 ? '' : 's'}.`}
        </div>
      )}

      <div className="ll-list">
        {visible.length === 0 && (
          <div className="ll-empty">
            <div className="ll-empty-title">
              {owner === 'mine' ? 'No leads captured by you yet.' : 'No leads captured yet.'}
            </div>
            <div className="ll-empty-body">Scanned badges will show up here.</div>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.name || 'all'}>
            {group.name && (
              <div className="ll-group">
                <span className="ll-group-name">{group.name}</span>
                <span className="ll-group-count">{group.leads.length}</span>
              </div>
            )}
            {group.leads.map((lead) => {
              const queued = lead.status === 'queued';
              return (
                <button className="ll-row" onClick={() => onOpenLead(lead)} key={lead.id}>
                  <span className="ll-row-avatar">{lead.capturedByInitials || '·'}</span>
                  <span className="ll-row-main">
                    <span className="ll-row-name">{lead.name}</span>
                    <span className="ll-row-sub">
                      {lead.priority && (
                        <span className="ll-prio" data-prio={lead.priority}>
                          {lead.priority.toUpperCase()} ·{' '}
                        </span>
                      )}
                      {lead.company || 'No company'} · {lead.interests.length} area
                      {lead.interests.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="ll-row-meta">
                    <span className="ll-row-status">
                      <span
                        className="ll-status-dot"
                        style={{ background: queued ? 'var(--status-warning)' : '#24D4C9' }}
                      />
                      {queued ? 'QUEUED' : 'SYNCED'}
                    </span>
                    <span className="ll-row-time">{formatCapturedAt(lead.capturedAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
