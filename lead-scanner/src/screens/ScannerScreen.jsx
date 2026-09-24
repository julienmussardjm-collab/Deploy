import { useState } from 'react';
import { PencilIcon, UsersIcon } from '../components/icons.jsx';

// Up to four zoom presets within the camera's range: min, 2×, 3×, max.
function zoomPresets(range) {
  if (!range) return [];
  const presets = [];
  for (const target of [range.min, 2, 3, range.max]) {
    const value = Math.min(range.max, Math.max(range.min, target));
    if (!presets.some((p) => Math.abs(p - value) < 0.05)) presets.push(value);
  }
  return presets.sort((a, b) => a - b).slice(0, 4);
}

const formatZoom = (value) => `${Number.isInteger(value) ? value : value.toFixed(1)}×`;

export function ScannerScreen({
  eventLabel,
  online,
  queued,
  capturedToday,
  reading,
  videoRef,
  cameraReady,
  cameraError,
  currentUser,
  zoom,
  zoomRange,
  onSetZoom,
  canTapFocus,
  onFocusAt,
  onRetryCamera,
  onManualEntry,
  onOpenLeads,
  onSwitchUser,
  onChangeEvent,
}) {
  const [cameraEl, setCameraEl] = useState(null);
  const [focusRing, setFocusRing] = useState(null);

  const queuedColor = online ? '#fff' : 'var(--orange-500)';
  const queuedValue = online ? '0' : String(queued);
  const presets = zoomPresets(zoomRange);

  async function handleTap(e) {
    if (!canTapFocus || !cameraReady) return;
    const rect = cameraEl?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setFocusRing({ x, y, id });
    setTimeout(() => setFocusRing((ring) => (ring?.id === id ? null : ring)), 900);
    await onFocusAt(x / rect.width, y / rect.height);
  }

  return (
    <div className="scr-root">
      <div className="scr-camera" ref={setCameraEl} onPointerDown={handleTap}>
        <video ref={videoRef} className="scr-video" playsInline muted autoPlay />

        {!cameraReady && (
          <div className="scr-camera-fallback" onPointerDown={(e) => e.stopPropagation()}>
            {cameraError ? (
              <div className="scr-camera-err">
                <div className="scr-camera-err-title">CAMERA UNAVAILABLE</div>
                <div className="scr-camera-err-msg">{cameraError.message}</div>
                <div className="scr-camera-err-code">{cameraError.name}</div>
                <button className="btn btn-ghost scr-camera-retry" onClick={onRetryCamera}>
                  Retry camera
                </button>
                <div className="scr-camera-err-alt">Or use manual entry below.</div>
              </div>
            ) : (
              <span>STARTING CAMERA…</span>
            )}
          </div>
        )}

        {focusRing && (
          <span
            className="scr-focus-ring"
            style={{ left: focusRing.x, top: focusRing.y }}
            key={focusRing.id}
          />
        )}

        <div className="scr-topbar">
          <button
            className="scr-booth"
            onClick={onChangeEvent}
            aria-label={`Event: ${eventLabel} — tap to change`}
          >
            <span className="scr-booth-dot" />
            <span className="scr-booth-label">{eventLabel}</span>
          </button>
          {currentUser && (
            <button
              className="scr-user-pill"
              onClick={onSwitchUser}
              aria-label={`Scanning as ${currentUser.name} — tap to switch`}
            >
              {currentUser.initials}
            </button>
          )}
        </div>

        <div className="scr-frame-wrap">
          <div className="scr-frame">
            <div className="scr-frame-border" />
            <span className="scr-corner scr-corner-tl" />
            <span className="scr-corner scr-corner-tr" />
            <span className="scr-corner scr-corner-bl" />
            <span className="scr-corner scr-corner-br" />
            <div className="scr-scanline" />
            {reading && (
              <div className="scr-reading">
                <span className="scr-reading-dot" />
                <span className="scr-reading-text">READING BADGE</span>
              </div>
            )}
          </div>
        </div>

        {presets.length > 1 && (
          <div className="scr-zoom" onPointerDown={(e) => e.stopPropagation()}>
            {presets.map((value) => (
              <button
                className={`scr-zoom-btn${Math.abs(zoom - value) < 0.05 ? ' scr-zoom-btn-on' : ''}`}
                onClick={() => onSetZoom(value)}
                aria-label={`Zoom ${formatZoom(value)}`}
                key={value}
              >
                {formatZoom(value)}
              </button>
            ))}
          </div>
        )}

        <div className="scr-hint">
          Align the badge QR inside the frame — it captures automatically.
          {canTapFocus && (
            <>
              <br />
              Tap anywhere to refocus.
            </>
          )}
        </div>
      </div>

      <div className="scr-footer">
        <div className="scr-stats">
          <div className="scr-stat scr-stat-bordered">
            <div className="scr-stat-label">Captured today</div>
            <div className="scr-stat-value">{capturedToday}</div>
          </div>
          <div className="scr-stat">
            <div className="scr-stat-label">{online ? 'Awaiting sync' : 'Queued offline'}</div>
            <div className="scr-stat-value" style={{ color: queuedColor }}>
              {queuedValue}
            </div>
          </div>
        </div>
        <div className="scr-controls">
          <button className="btn btn-ghost scr-ctrl-btn" onClick={onManualEntry}>
            <PencilIcon />
            <span>Manual entry</span>
          </button>
          <button className="btn btn-ghost scr-ctrl-btn" onClick={onOpenLeads}>
            <UsersIcon />
            <span>Leads</span>
          </button>
        </div>
      </div>
    </div>
  );
}
