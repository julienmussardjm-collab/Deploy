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

## Deployment

Vercel project `deploy` (team `julienmussardjm-5546s-projects`), linked to
this repository:

- Push to `main` → production (https://deploy-self-tau.vercel.app).
- Push to any other branch → preview deployment with its own URL.
- Build settings are pinned in `vercel.json` (Vite, output `dist`).
- Roll back from Vercel → Deployments → a previous production build →
  "Promote".

## Team database (Supabase)

Leads are stored on the phone first (IndexedDB), then uploaded to a shared
Supabase database (project `inventronics-lead-scanner`, Frankfurt), so every
phone sees the whole team's leads and nothing is lost with a phone.

- Each phone enters the **team code** once on the start screen. The code is
  never stored in this repository; ask the event coordinator. To rotate it, see
  the header of `supabase/migrations/20260924_leads_and_team_access.sql`.
- Without connection, leads are saved as `QUEUED` and upload automatically
  when the phone is back online. Sync also runs every 30 s and after each save.
- The app only calls the database functions `sync_leads` and `list_leads`,
  which check the team code. The table itself is closed to the public API.
- Leads captured with builds older than 2026-09-24 are uploaded automatically
  the first time the phone opens this version.
- **Consent**: the lead form records whether the attendee agreed to be
  contacted, with the time; both are in the CSV export.
- **Deletion** (lead detail → "Delete this lead") removes the lead on every
  phone and wipes its personal data in the database; only the id, dates,
  capturing user and event remain.

`src/lib/teamSync.js` holds the Supabase URL and publishable key (public by
design). Override with `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Known limitations

- The Supabase free plan pauses a project after 7 days without activity.
  Open the app (or the Supabase dashboard) in the days before an event, or
  move the project to a paid plan.
- A badge scanned on two phones before either has synced gives two leads
  (same badge ID in the CSV). Once synced, a re-scan on any phone updates the
  existing lead.
- Offline: `public/sw.js` keeps the app on the phone after the first visit
  with a connection, so it opens without network. Open the app once on each
  phone before the show.
