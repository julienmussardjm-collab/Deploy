# Inventronics Lead Scanner

Mobile web app for capturing leads at trade shows: scan an attendee's badge
QR code, qualify the lead (areas of interest, follow-up action, priority,
notes), and export the list as CSV.

Production: https://deploy-self-tau.vercel.app (Vercel project `deploy`,
deployed from the `main` branch). The Meeting Recorder app that previously
lived in this repository is kept on the `claude/meeting-recorder-app-h7CTM`
branch.

## Where this code comes from

The app was first built in a Claude Design session whose source never
reached Git. This folder was rebuilt on 2026-09-24 from the production
deployment of 2026-09-18:

- `src/index.css` is byte-identical to the production stylesheet (only reformatted).
- The React code was recovered from the production bundle and rewritten into
  readable modules; behaviour is unchanged.
- `api/enrich-email.js`: the pattern list, legal-suffix list, country TLD map
  and domain slug logic are the original code. The domain check, site scraping
  and request handler were rebuilt around the response the app expects.

## Structure

```
api/enrich-email.js      Serverless function: suggests a contact's work email
src/App.jsx              Screen state and lead save flow
src/screens/             IdentityScreen, ScannerScreen, QualifyForm, LeadDetail, LeadList
src/hooks/useCamera.js   Rear camera stream, QR decoding (jsQR), zoom, tap-to-focus
src/lib/badgeParser.js   Badge QR formats: vCard, JSON, pipe-separated, GES/LiGHT compact code
src/lib/leadStore.js     IndexedDB storage of leads (on the device only)
src/lib/session.js       Current event and user, recent choices (localStorage)
src/lib/csvExport.js     CSV export through share sheet, artifact downloads or file download
src/lib/qualification.js Interest areas, follow-up actions, priorities
tests/                   Vitest unit tests
```

## Commands

```
npm install
npm run dev      # local dev server (the camera needs https or localhost)
npm test
npm run build
```

## Known limitations

- Leads are stored only in the browser of the device that scanned them.
  "Synced" means the device was online when the lead was saved; nothing is
  uploaded yet. Export to CSV at the end of each day.
- The "Everyone / Mine" filter only covers leads on the current device.
