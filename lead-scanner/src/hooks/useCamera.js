import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const CAMERA_ERRORS = {
  NotAllowedError:
    'Camera permission was refused. Allow camera access for this site in your browser settings, then tap Retry.',
  PermissionDeniedError:
    'Camera permission was refused. Allow camera access for this site in your browser settings, then tap Retry.',
  NotFoundError: 'No camera found on this device.',
  DevicesNotFoundError: 'No camera found on this device.',
  NotReadableError: 'The camera is already in use by another app. Close it, then tap Retry.',
  TrackStartError: 'The camera is already in use by another app. Close it, then tap Retry.',
  OverconstrainedError: 'No camera matches the requested settings.',
  SecurityError:
    'The browser blocked the camera here. Open the page directly in Safari or Chrome (not inside another app).',
  AbortError: 'The camera failed to start. Tap Retry.',
};

function describeCameraError(error) {
  const name = error?.name;
  const message = name && CAMERA_ERRORS[name];
  if (message) return { name, message };
  return { name: name || 'Error', message: error?.message || 'Could not access the camera.' };
}

// The same code is reported again only after this delay, so a badge held
// in front of the camera does not fire repeatedly.
const REPEAT_SCAN_MS = 4000;
const REFOCUS_RESET_MS = 3000;

// Streams the rear camera into `videoRef` while `active` and calls
// `onDetect(text)` whenever a QR code is decoded.
export function useCamera({ active, onDetect }) {
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const refocusTimerRef = useRef(null);
  const restartingRef = useRef(false);
  const startRef = useRef(null);
  const onDetectRef = useRef(onDetect);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [zoomRange, setZoomRange] = useState(null);
  const [canTapFocus, setCanTapFocus] = useState(false);

  const setZoom = useCallback(async (value) => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: value }] });
      setZoomState(value);
    } catch {
      // Zoom not supported on this device.
    }
  }, []);

  // Point-of-interest focus, where the browser supports it (mostly Android Chrome).
  const focusOnPoint = useCallback(async (x, y) => {
    const track = trackRef.current;
    if (!track?.getCapabilities) return false;
    const caps = track.getCapabilities();
    if (!caps.pointsOfInterest) return false;
    const modes = Array.isArray(caps.focusMode) ? caps.focusMode : [];
    if (!modes.includes('single-shot') && !modes.includes('continuous')) return false;

    const constraint = { pointsOfInterest: [{ x, y }] };
    if (modes.includes('single-shot')) constraint.focusMode = 'single-shot';
    try {
      await track.applyConstraints({ advanced: [constraint] });
      if (modes.includes('continuous')) {
        clearTimeout(refocusTimerRef.current);
        refocusTimerRef.current = setTimeout(() => {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
        }, REFOCUS_RESET_MS);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const retry = useCallback(async () => {
    if (!startRef.current) return;
    setError(null);
    try {
      await startRef.current();
    } catch (e) {
      setError(describeCameraError(e));
    }
  }, []);

  // Tap to focus. Without point-of-interest support, restarting the stream
  // makes most phones run their autofocus again.
  const focusAt = useCallback(
    async (x, y) => {
      if (await focusOnPoint(x, y)) return true;
      if (restartingRef.current || !startRef.current) return false;
      restartingRef.current = true;
      try {
        await startRef.current();
        return true;
      } catch {
        return false;
      } finally {
        restartingRef.current = false;
      }
    },
    [focusOnPoint],
  );

  useEffect(() => {
    if (!active) {
      setReady(false);
      setError(null);
      setZoomRange(null);
      setCanTapFocus(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        name: 'Unavailable',
        message:
          'This browser exposes no camera API. Open the page over https:// in Safari or Chrome rather than inside another app.',
      });
      return;
    }

    let stopped = false;
    let frameId = null;
    let stream = null;
    let lastCode = null;
    let lastCodeAt = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function scanFrame() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          const now = Date.now();
          if (code.data !== lastCode || now - lastCodeAt > REPEAT_SCAN_MS) {
            lastCode = code.data;
            lastCodeAt = now;
            onDetectRef.current?.(code.data);
          }
        }
      }
      frameId = requestAnimationFrame(scanFrame);
    }

    async function start() {
      const next = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const video = videoRef.current;
      if (stopped || !video) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = next;
      try {
        await video.play();
      } catch {
        // Autoplay can reject while the stream still renders.
      }
      if (stopped) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }

      const previous = stream;
      stream = next;
      if (previous) previous.getTracks().forEach((track) => track.stop());

      const track = next.getVideoTracks()[0];
      trackRef.current = track;
      const caps = track?.getCapabilities?.() ?? {};
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        setZoomRange({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 });
        setZoomState(track.getSettings?.().zoom ?? caps.zoom.min);
      } else {
        setZoomRange(null);
      }
      if ((Array.isArray(caps.focusMode) ? caps.focusMode : []).includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      }
      setCanTapFocus(true);
      setReady(true);
      frameId ||= requestAnimationFrame(scanFrame);
    }

    startRef.current = start;
    start().catch((e) => {
      if (!stopped) setError(describeCameraError(e));
    });

    return () => {
      stopped = true;
      startRef.current = null;
      clearTimeout(refocusTimerRef.current);
      if (frameId) cancelAnimationFrame(frameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      trackRef.current = null;
    };
  }, [active]);

  return { videoRef, error, ready, zoom, zoomRange, setZoom, canTapFocus, focusAt, retry };
}
