import { useEffect, useRef, useState } from 'react';
import { useCamera } from './hooks/useCamera.js';
import { parseBadge } from './lib/badgeParser.js';
import { exportLeads } from './lib/csvExport.js';
import {
  findLeadByBadge,
  flushQueue,
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
  setCurrentEvent,
  setCurrentUser,
} from './lib/session.js';
import { IdentityScreen } from './screens/IdentityScreen.jsx';
import { LeadDetail } from './screens/LeadDetail.jsx';
import { LeadList } from './screens/LeadList.jsx';
import { QualifyForm } from './screens/QualifyForm.jsx';
import { ScannerScreen } from './screens/ScannerScreen.jsx';

// Short pause after a decode so the "Reading badge" state is visible.
const READ_DELAY_MS = 550;

export function App() {
  const [currentUser, setUser] = useState(() => getCurrentUser());
  const [recentUsers, setRecentUsers] = useState(() => getRecentUsers());
  const [currentEvent, setEvent] = useState(() => getCurrentEvent());
  const [recentEvents, setRecentEvents] = useState(() => getRecentEvents());
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

  async function refresh() {
    setStats(await getStats());
    setLeads(await getAllLeads());
  }

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, []);

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

  // Flush the offline queue when the connection comes back.
  const wasOnlineRef = useRef(online);
  useEffect(() => {
    if (online && !wasOnlineRef.current) flushQueue();
    wasOnlineRef.current = online;
  }, [online]);

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

  function confirmIdentity({ name, eventName, eventLocation }) {
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
      setSelectedLead({ ...selectedLead, ...changes });
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
      status: online ? 'synced' : 'queued',
      rawScan: draft.rawScan ?? null,
    });
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

  if (!currentUser || !currentEvent || switchingUser || changingEvent) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <IdentityScreen
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
