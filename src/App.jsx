import { useCallback, useEffect, useRef, useState } from 'react';
import { useCamera } from './hooks/useCamera.js';
import { parseBadge } from './lib/badgeParser.js';
import { exportLeads } from './lib/csvExport.js';
import {
  findLeadByBadge,
  getAllLeads,
  getStats,
  newId,
  saveLead,
  subscribe,
  updateLead,
} from './lib/leadStore.js';
import {
  EMPTY_CONTACT,
  FOLLOW_UP_ACTIONS,
  INTEREST_AREAS,
  PRIORITIES,
  draftFromLead,
  newDraft,
} from './lib/qualification.js';
import {
  getCurrentEvent,
  getCurrentUser,
  getRecentEvents,
  getRecentUsers,
  getTeamCode,
  setCurrentEvent,
  setCurrentUser,
  setTeamCode as saveTeamCode,
} from './lib/session.js';
import { InvalidTeamCodeError, syncNow } from './lib/teamSync.js';
import { IdentityScreen } from './screens/IdentityScreen.jsx';
import { LeadDetail } from './screens/LeadDetail.jsx';
import { LeadList } from './screens/LeadList.jsx';
import { QualifyForm } from './screens/QualifyForm.jsx';
import { ScannerScreen } from './screens/ScannerScreen.jsx';

// Short pause after a decode so the "Reading badge" state is visible.
const READ_DELAY_MS = 550;
// Background sync interval while online, so the team list stays current.
const SYNC_INTERVAL_MS = 30_000;

export function App() {
  const [currentUser, setUser] = useState(() => getCurrentUser());
  const [recentUsers, setRecentUsers] = useState(() => getRecentUsers());
  const [currentEvent, setEvent] = useState(() => getCurrentEvent());
  const [recentEvents, setRecentEvents] = useState(() => getRecentEvents());
  const [teamCode, setTeamCode] = useState(() => getTeamCode());
  const [teamCodeRejected, setTeamCodeRejected] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [switchingUser, setSwitchingUser] = useState(false);
  const [changingEvent, setChangingEvent] = useState(false);

  // 'scanner' | 'form' | 'detail' | 'leads'
  const [screen, setScreen] = useState('scanner');
  const [detailReturnScreen, setDetailReturnScreen] = useState('scanner');
  const [reading, setReading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [stats, setStats] = useState({ capturedToday: 0, queued: 0 });
  const [leads, setLeads] = useState([]);

  const [draft, setDraft] = useState(() => newDraft(EMPTY_CONTACT));
  const [isManual, setIsManual] = useState(false);
  const [editingId, setEditingId] = useState(null); // set when the form updates an existing lead
  const [isRescan, setIsRescan] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const readTimerRef = useRef(null);

  const userName = currentUser?.name;
  useEffect(() => {
    async function refresh() {
      const all = await getAllLeads();
      setStats(await getStats(userName));
      setLeads(all);
      // Keep the open lead in step with sync status and team edits.
      setSelectedLead((open) => (open && all.find((lead) => lead.id === open.id)) || open);
    }
    refresh();
    return subscribe(refresh);
  }, [userName]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const runSync = useCallback(async () => {
    if (!teamCode || teamCodeRejected || !navigator.onLine) return;
    try {
      const result = await syncNow(teamCode);
      setLastSyncAt(result.at);
      setSyncError(null);
    } catch (error) {
      if (error instanceof InvalidTeamCodeError) setTeamCodeRejected(true);
      else setSyncError(error.message);
    }
  }, [teamCode, teamCodeRejected]);

  // Sync on start, whenever the connection comes back, and every 30 s.
  useEffect(() => {
    if (!online) return undefined;
    runSync();
    const timer = setInterval(runSync, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [online, runSync]);

  useEffect(() => () => clearTimeout(readTimerRef.current), []);

  function handleDetect(raw) {
    if (reading) return;
    setReading(true);
    clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(async () => {
      const contact = parseBadge(raw);
      const existing = await findLeadByBadge(contact.badgeId);
      if (existing) {
        setEditingId(existing.id);
        setSelectedLead(existing);
        setDetailReturnScreen('scanner');
        setDraft(draftFromLead(existing, raw));
        setIsRescan(true);
      } else {
        setEditingId(null);
        setDraft(newDraft(contact, raw));
        setIsRescan(false);
      }
      setIsManual(false);
      setReading(false);
      setScreen('form');
    }, READ_DELAY_MS);
  }

  const camera = useCamera({
    active: screen === 'scanner' && !!currentUser && !switchingUser,
    onDetect: handleDetect,
  });

  function startManualEntry() {
    setEditingId(null);
    setIsRescan(false);
    setIsManual(true);
    setDraft(newDraft(EMPTY_CONTACT));
    setScreen('form');
  }

  function confirmIdentity({ name, eventName, eventLocation, teamCode: code }) {
    setTeamCode(saveTeamCode(code));
    setTeamCodeRejected(false);
    const event = setCurrentEvent(eventName, eventLocation);
    const user = setCurrentUser(name);
    setEvent(event);
    setRecentEvents(getRecentEvents());
    setUser(user);
    setRecentUsers(getRecentUsers());
    setSwitchingUser(false);
    setChangingEvent(false);
  }

  function toggleInterest(area) {
    setDraft((d) => ({
      ...d,
      interests: d.interests.includes(area)
        ? d.interests.filter((a) => a !== area)
        : [...d.interests, area],
    }));
  }

  function setContactField(field, value) {
    setDraft((d) => ({ ...d, contact: { ...d.contact, [field]: value } }));
  }

  async function handleSave() {
    const contact = Object.fromEntries(
      Object.entries(draft.contact).map(([key, value]) => [key, String(value ?? '').trim()]),
    );
    const qualification = {
      interests: draft.interests,
      action: draft.action,
      priority: draft.priority,
      notes: draft.notes.trim(),
    };

    if (editingId) {
      const changes = {
        ...contact,
        ...qualification,
        rawScan: draft.rawScan ?? selectedLead?.rawScan ?? null,
      };
      await updateLead(editingId, changes);
      runSync();
      setSelectedLead({ ...selectedLead, ...changes, status: 'queued' });
      setEditingId(null);
      setIsRescan(false);
      setScreen('detail');
      return;
    }

    contact.badgeId ||= `MANUAL-${newId().slice(0, 8).toUpperCase()}`;
    const { lead } = await saveLead({
      id: newId(),
      ...contact,
      ...qualification,
      capturedAt: Date.now(),
      capturedBy: currentUser?.name ?? null,
      capturedByInitials: currentUser?.initials ?? null,
      eventName: currentEvent?.name ?? null,
      eventLocation: currentEvent?.location ?? null,
      rawScan: draft.rawScan ?? null,
    });
    runSync();
    setIsManual(false);
    setSelectedLead(lead);
    setDetailReturnScreen('scanner');
    setScreen('detail');
  }

  function editSelectedLead() {
    if (!selectedLead) {
      setScreen('form');
      return;
    }
    setIsRescan(false);
    setIsManual(false);
    setEditingId(selectedLead.id);
    setDraft(draftFromLead(selectedLead));
    setScreen('form');
  }

  function openLead(lead) {
    setSelectedLead(lead);
    setDetailReturnScreen('leads');
    setScreen('detail');
  }

  const needsIdentity =
    !currentUser ||
    !currentEvent ||
    !teamCode ||
    teamCodeRejected ||
    switchingUser ||
    changingEvent;
  if (needsIdentity) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <IdentityScreen
            teamCode={teamCode}
            teamCodeRejected={teamCodeRejected}
            currentEvent={currentEvent}
            recentEvents={recentEvents}
            recentUsers={recentUsers}
            switching={switchingUser}
            startInEventMode={changingEvent}
            onConfirm={confirmIdentity}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        {screen === 'scanner' && (
          <ScannerScreen
            eventLabel={currentEvent.name}
            online={online}
            queued={stats.queued}
            capturedToday={stats.capturedToday}
            reading={reading}
            videoRef={camera.videoRef}
            cameraReady={camera.ready}
            cameraError={camera.error}
            currentUser={currentUser}
            zoom={camera.zoom}
            zoomRange={camera.zoomRange}
            onSetZoom={camera.setZoom}
            canTapFocus={camera.canTapFocus}
            onFocusAt={camera.focusAt}
            onRetryCamera={camera.retry}
            onManualEntry={startManualEntry}
            onOpenLeads={() => setScreen('leads')}
            onSwitchUser={() => setSwitchingUser(true)}
            onChangeEvent={() => setChangingEvent(true)}
          />
        )}
        {screen === 'form' && (
          <QualifyForm
            online={online}
            contact={draft.contact}
            interests={draft.interests}
            areas={INTEREST_AREAS}
            action={draft.action}
            actions={FOLLOW_UP_ACTIONS}
            priority={draft.priority}
            priorities={PRIORITIES}
            notes={draft.notes}
            isEditing={!!editingId}
            isManual={isManual}
            isRescan={isRescan}
            onBack={() => setScreen(editingId ? 'detail' : 'scanner')}
            onToggleInterest={toggleInterest}
            onSetAction={(action) => setDraft((d) => ({ ...d, action }))}
            onSetPriority={(priority) => setDraft((d) => ({ ...d, priority }))}
            onSetNotes={(notes) => setDraft((d) => ({ ...d, notes }))}
            onSetContactField={setContactField}
            onSave={handleSave}
          />
        )}
        {screen === 'detail' && selectedLead && (
          <LeadDetail
            lead={selectedLead}
            onBack={() => setScreen(detailReturnScreen)}
            onEdit={editSelectedLead}
            onScanNext={() => setScreen('scanner')}
          />
        )}
        {screen === 'leads' && (
          <LeadList
            leads={leads}
            online={online}
            lastSyncAt={lastSyncAt}
            syncError={syncError}
            currentUser={currentUser}
            onBack={() => setScreen('scanner')}
            onOpenLead={openLead}
            onExport={exportLeads}
          />
        )}
      </div>
    </div>
  );
}
