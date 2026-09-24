// Pulls company facts out of a web page's HTML: title and meta tags,
// schema.org Organization data, social links, contact details, readable text
// and the internal pages worth reading next (about, contact, imprint...).
// Pure functions on strings, so they can be unit-tested with saved pages.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const clean = (text) => decodeEntities(text).replace(/\s+/g, ' ').trim();

function attributes(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  }
  return attrs;
}

function metaTags(html) {
  const meta = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(m[0]);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content && !(key in meta)) meta[key] = clean(attrs.content);
  }
  return meta;
}

// Visible text: scripts, styles and markup removed.
export function visibleText(html) {
  return clean(
    html
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

const ORG_TYPES = /Organization|Corporation|LocalBusiness|Store|Manufacturer|Company|Brand/i;

function* walkJson(node) {
  if (Array.isArray(node)) {
    for (const item of node) yield* walkJson(item);
  } else if (node && typeof node === 'object') {
    yield node;
    for (const value of Object.values(node))
      if (value && typeof value === 'object') yield* walkJson(value);
  }
}

// First schema.org Organization-like object in the page's JSON-LD blocks.
function organizationData(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const node of walkJson(data)) {
      const type = [].concat(node['@type'] || []).join(' ');
      if (!ORG_TYPES.test(type)) continue;
      const address = [].concat(node.address || [])[0] || {};
      const employees = node.numberOfEmployees;
      return {
        name: node.name ? clean(node.name) : null,
        description: node.description ? clean(node.description) : null,
        url: typeof node.url === 'string' ? node.url : null,
        telephone: typeof node.telephone === 'string' ? node.telephone : null,
        email: typeof node.email === 'string' ? node.email.replace(/^mailto:/i, '') : null,
        country:
          typeof address.addressCountry === 'string'
            ? address.addressCountry
            : address.addressCountry?.name || null,
        city: typeof address.addressLocality === 'string' ? address.addressLocality : null,
        sameAs: [].concat(node.sameAs || []).filter((u) => typeof u === 'string'),
        employees:
          typeof employees === 'object' && employees
            ? (employees.value ?? employees.maxValue ?? null)
            : (employees ?? null),
        founded: node.foundingDate ? String(node.foundingDate).slice(0, 4) : null,
      };
    }
  }
  return null;
}

const SOCIAL = {
  linkedin: /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/(company|showcase|school)\/[^/?#]+/i,
  facebook: /^https?:\/\/(www\.)?facebook\.com\/[^/?#]+/i,
  instagram: /^https?:\/\/(www\.)?instagram\.com\/[^/?#]+/i,
  youtube: /^https?:\/\/(www\.)?youtube\.com\/(@|c\/|channel\/|user\/)[^/?#]+/i,
  x: /^https?:\/\/(www\.)?(x|twitter)\.com\/[^/?#]+/i,
};

// Internal pages that usually say what the company does or where it is.
const SUBPAGES = [
  /about|company|unternehmen|uber-uns|ueber-uns|chi-siamo|azienda|qui-sommes|societe|entreprise|a-propos|empresa|over-ons/i,
  /impressum|imprint|legal|mentions|note-legali|aviso-legal|contact|kontakt|contatti|contacto/i,
  /products|produkte|prodotti|produits|productos|producten|solutions|loesungen|losungen/i,
];

function sameSite(host, other) {
  const bare = (h) => h.replace(/^www\./, '');
  return bare(host) === bare(other);
}

export function extractPage(html, pageUrl) {
  const base = new URL(pageUrl);
  const meta = metaTags(html);
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const lang = attributes(html.match(/<html\b[^>]*>/i)?.[0] || '').lang || null;

  const social = {};
  const emails = new Set();
  const phones = new Set();
  const internal = [];
  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = decodeEntities(attributes(m[0]).href || '').trim();
    if (!href) continue;
    if (/^mailto:/i.test(href)) {
      const email = href.slice(7).split('?')[0].trim().toLowerCase();
      if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) emails.add(email);
      continue;
    }
    if (/^tel:/i.test(href)) {
      const phone = decodeURIComponent(href.slice(4)).replace(/[^+\d]/g, '');
      if (phone.length >= 7) phones.add(phone);
      continue;
    }
    let url;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    for (const [network, pattern] of Object.entries(SOCIAL)) {
      const found = url.href.match(pattern);
      if (found && !social[network]) social[network] = found[0];
    }
    if (sameSite(url.hostname, base.hostname) && url.pathname.length > 1) {
      internal.push(url.origin + url.pathname);
    }
  }

  const org = organizationData(html);
  for (const link of org?.sameAs || []) {
    for (const [network, pattern] of Object.entries(SOCIAL)) {
      const found = link.match(pattern);
      if (found && !social[network]) social[network] = found[0];
    }
  }
  if (org?.email) emails.add(org.email.toLowerCase());

  const text = visibleText(html);
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    emails.add(m[0].toLowerCase());
  }

  // Up to one link per kind of subpage, in the order of SUBPAGES.
  const unique = [...new Set(internal)];
  const nextPages = SUBPAGES.map((pattern) =>
    unique.find((u) => pattern.test(new URL(u).pathname)),
  ).filter(Boolean);

  return {
    title,
    lang,
    siteName: meta['og:site_name'] || org?.name || null,
    description: meta.description || meta['og:description'] || org?.description || null,
    org,
    social,
    emails: [...emails],
    phones: [...phones],
    text,
    nextPages,
  };
}
