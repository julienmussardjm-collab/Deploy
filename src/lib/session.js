// Who is scanning, and at which event. Kept in localStorage so the app
// reopens straight on the scanner, with recent choices offered as chips.

const CURRENT_EVENT_KEY = 'lead-scanner:current-event';
const RECENT_EVENTS_KEY = 'lead-scanner:recent-events';
const MAX_RECENT_EVENTS = 6;

const CURRENT_USER_KEY = 'lead-scanner:current-user';
const RECENT_USERS_KEY = 'lead-scanner:recent-users';
const MAX_RECENT_USERS = 5;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Moves `entry` to the front of a recent list, de-duplicated by name.
function pushRecent(key, entry, list, max) {
  const rest = list.filter((item) => item.name.toLowerCase() !== entry.name.toLowerCase());
  rest.unshift(entry);
  localStorage.setItem(key, JSON.stringify(rest.slice(0, max)));
}

export function getCurrentEvent() {
  const event = readJson(CURRENT_EVENT_KEY, null);
  return event && event.name ? event : null;
}

export function getRecentEvents() {
  const events = readJson(RECENT_EVENTS_KEY, []);
  return Array.isArray(events) ? events.filter((event) => event && event.name) : [];
}

export function setCurrentEvent(name, location) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return null;
  const event = { name: trimmed, location: String(location ?? '').trim() };
  localStorage.setItem(CURRENT_EVENT_KEY, JSON.stringify(event));
  pushRecent(RECENT_EVENTS_KEY, event, getRecentEvents(), MAX_RECENT_EVENTS);
  return event;
}

export function initialsOf(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return '?';
}

export function getCurrentUser() {
  return readJson(CURRENT_USER_KEY, null);
}

export function getRecentUsers() {
  return readJson(RECENT_USERS_KEY, []);
}

export function setCurrentUser(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const user = { name: trimmed, initials: initialsOf(trimmed) };
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  pushRecent(RECENT_USERS_KEY, user, getRecentUsers(), MAX_RECENT_USERS);
  return user;
}

// Shared code that unlocks the team database. Entered once per phone.
const TEAM_CODE_KEY = 'lead-scanner:team-code';

export function getTeamCode() {
  return readJson(TEAM_CODE_KEY, null);
}

export function setTeamCode(code) {
  const normalized = String(code ?? '')
    .trim()
    .toUpperCase();
  if (normalized) localStorage.setItem(TEAM_CODE_KEY, JSON.stringify(normalized));
  else localStorage.removeItem(TEAM_CODE_KEY);
  return normalized || null;
}
