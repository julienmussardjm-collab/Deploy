import { useState } from 'react';
import { Mascot } from '../components/Mascot.jsx';
import { checkTeamCode } from '../lib/teamSync.js';

// Start screen: pick the event and who is scanning, and enter the team code
// once per phone. Also reused to switch user (`switching`) or change event
// (`startInEventMode`) mid-show.
export function IdentityScreen({
  teamCode: savedTeamCode,
  teamCodeRejected,
  currentEvent,
  recentEvents,
  recentUsers,
  switching,
  startInEventMode,
  onConfirm,
}) {
  const [userName, setUserName] = useState('');
  const [editingEvent, setEditingEvent] = useState(!currentEvent || startInEventMode);
  const [eventName, setEventName] = useState(currentEvent?.name ?? '');
  const [eventLocation, setEventLocation] = useState(currentEvent?.location ?? '');
  const needsTeamCode = !savedTeamCode || teamCodeRejected;
  const [teamCode, setTeamCode] = useState('');
  const [codeError, setCodeError] = useState(
    teamCodeRejected ? 'This team code is no longer valid. Ask your coordinator.' : null,
  );
  const [checking, setChecking] = useState(false);

  const hasEvent = eventName.trim().length > 0;
  const hasCode = !needsTeamCode || teamCode.trim().length > 0;
  const canStart = hasEvent && hasCode && userName.trim().length > 0 && !checking;

  // Checks a newly entered team code. Without a connection the code is
  // accepted for now and verified at the first sync.
  async function confirm(name) {
    if (!needsTeamCode) {
      onConfirm({ name, eventName, eventLocation, teamCode: savedTeamCode });
      return;
    }
    const code = teamCode.trim().toUpperCase();
    setChecking(true);
    setCodeError(null);
    try {
      if (!(await checkTeamCode(code))) {
        setCodeError('Wrong team code.');
        return;
      }
    } catch {
      // Offline or database unreachable: accept, sync will verify.
    } finally {
      setChecking(false);
    }
    onConfirm({ name, eventName, eventLocation, teamCode: code });
  }

  function pickRecentEvent(event) {
    setEventName(event.name);
    setEventLocation(event.location || '');
    setEditingEvent(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (canStart) confirm(userName);
  }

  return (
    <div className="id-root">
      <div className="id-hero">
        <div className="id-hero-glow" />
        <Mascot className="id-mascot" />
        <span className="id-eyebrow">Inventronics · Event lead capture</span>
        <h1 className="id-headline">{switching ? 'Switch scanner' : 'Ready when you are'}</h1>
      </div>
      <form className="id-body" onSubmit={handleSubmit}>
        <section className="id-section">
          <div className="id-section-head">
            <span className="id-label">Event</span>
            {!editingEvent && (
              <button type="button" className="id-textbtn" onClick={() => setEditingEvent(true)}>
                Change
              </button>
            )}
          </div>
          {editingEvent ? (
            <>
              <input
                className="id-input"
                type="text"
                autoFocus={!currentEvent}
                placeholder="e.g. Light + Building 2026"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
              <input
                className="id-input id-input-sub"
                type="text"
                placeholder="Hall / booth (optional)"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
              />
              {recentEvents.length > 0 && (
                <div className="id-chips">
                  {recentEvents.map((event) => (
                    <button
                      type="button"
                      className="id-chip"
                      onClick={() => pickRecentEvent(event)}
                      key={event.name}
                    >
                      {event.name}
                    </button>
                  ))}
                </div>
              )}
              {hasEvent && (
                <button
                  type="button"
                  className="id-confirm-event"
                  onClick={() => setEditingEvent(false)}
                >
                  Use this event
                </button>
              )}
            </>
          ) : (
            <div className="id-event-card">
              <span className="id-event-dot" />
              <span className="id-event-text">
                <span className="id-event-name">{eventName}</span>
                {eventLocation && <span className="id-event-loc">{eventLocation}</span>}
              </span>
            </div>
          )}
        </section>

        {needsTeamCode && (
          <section className="id-section">
            <label className="id-label" htmlFor="id-team-code">
              Team code
            </label>
            <input
              id="id-team-code"
              className="id-input"
              type="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. INV-XXXX-XXXX"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value)}
            />
            {codeError && <span className="id-error">{codeError}</span>}
          </section>
        )}

        <section className="id-section">
          <label className="id-label" htmlFor="id-name">
            Your name
          </label>
          <input
            id="id-name"
            className="id-input"
            type="text"
            autoComplete="name"
            autoFocus={!!currentEvent && !startInEventMode}
            placeholder="e.g. Mira Keller"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          {recentUsers.length > 0 && (
            <div className="id-chips">
              {recentUsers.map((user) => (
                <button
                  type="button"
                  className="id-chip id-chip-user"
                  onClick={() => hasEvent && hasCode && confirm(user.name)}
                  disabled={!hasEvent || !hasCode || checking}
                  key={user.name}
                >
                  <span className="id-chip-initials">{user.initials}</span>
                  {user.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="id-footer">
          <button className="btn btn-primary btn-lg" type="submit" disabled={!canStart}>
            {checking ? 'Checking team code…' : 'Start scanning'}
          </button>
          <div className="id-footnote">
            {needsTeamCode && hasEvent
              ? 'The team code connects this phone to the shared lead list.'
              : hasEvent
                ? 'Every lead you capture is tagged with this event and your name.'
                : 'Name the event first — it stamps every lead captured today.'}
          </div>
        </div>
      </form>
    </div>
  );
}
