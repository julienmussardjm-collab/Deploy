import { useState } from 'react';
import { Mascot } from '../components/Mascot.jsx';

// Start screen: pick the event and who is scanning. Also reused to switch
// user (`switching`) or change event (`startInEventMode`) mid-show.
export function IdentityScreen({
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

  const hasEvent = eventName.trim().length > 0;
  const canStart = hasEvent && userName.trim().length > 0;

  function pickRecentEvent(event) {
    setEventName(event.name);
    setEventLocation(event.location || '');
    setEditingEvent(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (canStart) onConfirm({ name: userName, eventName, eventLocation });
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
                  onClick={() =>
                    hasEvent && onConfirm({ name: user.name, eventName, eventLocation })
                  }
                  disabled={!hasEvent}
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
            Start scanning
          </button>
          <div className="id-footnote">
            {hasEvent
              ? 'Every lead you capture is tagged with this event and your name.'
              : 'Name the event first — it stamps every lead captured today.'}
          </div>
        </div>
      </form>
    </div>
  );
}
