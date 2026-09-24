// Turns the raw text of a badge QR code into a contact record.
// Supported formats, tried in order:
//   1. vCard (multi-line, or flattened onto one line by some badge printers)
//   2. JSON object
//   3. Pipe-separated: badgeId|name|title|company|country|email|phone
//   4. GES / LiGHT compact code: <10-20 lowercase alnum id><3 uppercase letters><surname>
//   5. Anything else is kept as the badge ID.

const PIPE_FIELDS = ['badgeId', 'name', 'title', 'company', 'country', 'email', 'phone'];

const VCARD_KEYS = [
  'BEGIN',
  'VERSION',
  'N',
  'FN',
  'ORG',
  'TITLE',
  'TEL',
  'EMAIL',
  'ADR',
  'X-REFCODE',
  'UID',
  'REV',
  'END',
];

const COMPACT_CODE = /^([a-z0-9]{10,20})([A-Z]{3})([A-Za-z][A-Za-z'-]*)$/;

export function parseBadge(raw) {
  const text = String(raw ?? '').trim();

  const vcard = parseVCard(text);
  if (vcard) return withDefaults(vcard);

  if (text[0] === '{') {
    try {
      const json = JSON.parse(text);
      return withDefaults({
        badgeId: json.badgeId ?? json.id,
        name: json.name,
        title: json.title ?? json.role,
        company: json.company,
        country: json.country,
        email: json.email,
        phone: json.phone,
      });
    } catch {
      // Not JSON after all; fall through.
    }
  }

  if (text.includes('|')) {
    const parts = text.split('|').map((part) => part.trim());
    const contact = {};
    PIPE_FIELDS.forEach((field, i) => {
      contact[field] = parts[i];
    });
    return withDefaults(contact);
  }

  const compact = text.match(COMPACT_CODE);
  if (compact) {
    const [, badgeId, , name] = compact;
    return withDefaults({ badgeId, name });
  }

  return withDefaults({ badgeId: text });
}

// vCard property names can carry a group prefix ("item1.EMAIL"); drop it.
function stripGroup(key) {
  const dot = key.indexOf('.');
  if (dot === -1) return key;
  const rest = key.slice(dot + 1);
  return VCARD_KEYS.includes(rest.toUpperCase()) ? rest : key;
}

export function parseVCard(text) {
  if (!/BEGIN:VCARD/i.test(text)) return null;

  const props = {};
  const setProp = (key, value) => {
    const upper = key.toUpperCase();
    // First occurrence wins (e.g. the primary TEL or EMAIL).
    if (!(upper in props)) props[upper] = value.trim();
  };

  if (/[\r\n]/.test(text)) {
    for (const line of text.split(/\r\n|\r|\n/)) {
      const trimmed = line.trim();
      const colon = trimmed.indexOf(':');
      if (colon !== -1) {
        setProp(stripGroup(trimmed.slice(0, colon).split(';')[0]), trimmed.slice(colon + 1));
      }
    }
  } else {
    // Single-line vCard: split on the known property names.
    const keyPattern = new RegExp(`(${VCARD_KEYS.join('|')})(;[^:\\s]*)?:`, 'g');
    const matches = [...text.matchAll(keyPattern)];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      setProp(matches[i][1], text.slice(start, end));
    }
  }

  const [lastName = '', firstName = ''] = (props.N || '').split(';').map((s) => s.trim());
  const nameFromN = [firstName, lastName].filter(Boolean).join(' ');
  const name = props.FN || nameFromN;
  const company = (props.ORG || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');

  // ADR: PO box;ext;street;city;region;postcode;country — country is the last field.
  const address = (props.ADR || '').split(';').map((s) => s.trim());
  while (address.length > 7 && address[address.length - 1] === '') address.pop();
  const country = address[address.length - 1] || '';

  return {
    badgeId:
      props['X-REFCODE'] || props.UID || props.EMAIL || [name, company].filter(Boolean).join(' · '),
    name,
    title: props.TITLE || '',
    company,
    country,
    email: props.EMAIL || '',
    phone: props.TEL || '',
  };
}

function withDefaults(contact) {
  return {
    badgeId: contact.badgeId || 'UNREADABLE',
    name: contact.name || 'Unknown attendee',
    title: contact.title || '',
    company: contact.company || '',
    country: contact.country || '',
    email: contact.email || '',
    phone: contact.phone || '',
  };
}
