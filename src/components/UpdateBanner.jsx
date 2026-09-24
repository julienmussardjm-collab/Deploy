// Shown when a newer release is online. Reloading picks it up; leads are
// stored on the phone, so nothing is lost.
export function UpdateBanner() {
  return (
    <div className="update-banner" role="status">
      <span className="update-banner-text">A new version of the app is available.</span>
      <button className="update-banner-btn" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}
