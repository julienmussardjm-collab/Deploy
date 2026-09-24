// POST /api/enrich-company  { code, name, company, country, email }
//  -> intel object (see README, "Company intel")
//
// Researches the attendee's company as soon as a badge is scanned, without
// AI and without touching LinkedIn: finds the company website (from the
// badge email domain, else from the company name), reads the home page and
// up to three about/contact/product pages, and classifies the company with
// keywords. Personal data added here is limited to what the company itself
// publishes (generic contact addresses) and guessed address formats.

import { classifyCompany, countryFromDomain } from './_lib/classify.js';
import { acceptsEmail, candidateDomains, guessEmails, splitName } from './_lib/domains.js';
import { extractPage } from './_lib/extract.js';
import { teamCodeOk } from './_lib/team.js';

const FREE_MAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'hotmail.fr',
  'hotmail.it',
  'live.com',
  'live.fr',
  'msn.com',
  'yahoo.com',
  'yahoo.fr',
  'yahoo.it',
  'yahoo.de',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'gmx.de',
  'gmx.net',
  'gmx.at',
  'gmx.ch',
  'web.de',
  't-online.de',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'laposte.net',
  'sfr.fr',
  'libero.it',
  'virgilio.it',
  'tiscali.it',
  'alice.it',
  'protonmail.com',
  'proton.me',
  'yandex.ru',
  'mail.ru',
  'qq.com',
  '163.com',
  '126.com',
  'seznam.cz',
  'wp.pl',
  'o2.pl',
  'telenet.be',
  'skynet.be',
  'bluewin.ch',
]);

const DOMAIN = /^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,24}$/;
const HOME_TIMEOUT_MS = 5000;
const PAGE_TIMEOUT_MS = 3500;
const MAX_PAGE_CHARS = 1_500_000;
const MAX_TEXT_CHARS = 60_000;

function emailDomain(email) {
  const domain =
    String(email || '')
      .trim()
      .toLowerCase()
      .split('@')[1] || '';
  return DOMAIN.test(domain) ? domain : null;
}

async function fetchHtml(url, timeout) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; InventronicsLeadScanner/1.0; +https://deploy-self-tau.vercel.app)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en,fr;q=0.8,de;q=0.7,it;q=0.6',
      },
    });
    if (!response.ok || !/html/i.test(response.headers.get('content-type') || '')) return null;
    const html = (await response.text()).slice(0, MAX_PAGE_CHARS);
    return { html, url: response.url || url };
  } catch {
    return null;
  }
}

// Home page over https, with and without "www.".
async function fetchHome(domain) {
  return (
    (await fetchHtml(`https://${domain}/`, HOME_TIMEOUT_MS)) ||
    (await fetchHtml(`https://www.${domain}/`, HOME_TIMEOUT_MS))
  );
}

async function findCompanyDomain({ email, company, country }) {
  const fromEmail = emailDomain(email);
  if (fromEmail && !FREE_MAIL.has(fromEmail)) return { domain: fromEmail, source: 'email' };
  const candidates = candidateDomains(company, country).filter((d) => DOMAIN.test(d));
  const checks = await Promise.all(candidates.map(acceptsEmail));
  const index = checks.indexOf(true);
  return index === -1 ? null : { domain: candidates[index], source: 'company_name' };
}

function sameDomain(email, domain) {
  return email.endsWith(`@${domain}`) || email.endsWith(`.${domain}`);
}

export async function researchCompany({ name, company, country, email }) {
  const at = Date.now();
  const badgeEmail =
    String(email || '')
      .trim()
      .toLowerCase() || null;
  const badgeDomain = emailDomain(badgeEmail);

  const found = await findCompanyDomain({ email: badgeEmail, company, country });
  if (!found) {
    return {
      status: 'no_company',
      at,
      email: {
        badge: badgeEmail,
        badgeDomainAcceptsMail: badgeDomain ? await acceptsEmail(badgeDomain) : null,
        found: [],
        guessed: [],
      },
    };
  }
  const { domain, source } = found;

  const [home, domainAcceptsMail] = await Promise.all([fetchHome(domain), acceptsEmail(domain)]);
  const pages = [];
  if (home) {
    const first = extractPage(home.html, home.url);
    pages.push(first);
    const more = await Promise.all(first.nextPages.map((url) => fetchHtml(url, PAGE_TIMEOUT_MS)));
    for (const page of more) if (page) pages.push(extractPage(page.html, page.url));
  }

  const [main] = pages;
  const org = pages.find((p) => p.org)?.org || null;
  const social = Object.assign({}, ...pages.map((p) => p.social).reverse());
  const text = pages
    .map((p) => `${p.title} ${p.description || ''} ${p.text}`)
    .join(' ')
    .slice(0, MAX_TEXT_CHARS);
  const siteName = main?.siteName || org?.name || null;
  const classification = classifyCompany({
    text,
    name: `${company || ''} ${siteName || ''}`,
    domain,
  });

  const siteEmails = [...new Set(pages.flatMap((p) => p.emails))].filter((e) =>
    sameDomain(e, domain),
  );
  const { first, last } = splitName(name);
  const guessed =
    badgeEmail && badgeDomain === domain ? [] : guessEmails(first, last, domain).slice(0, 4);

  return {
    status: home ? 'done' : 'no_site',
    at,
    domain,
    domainSource: source,
    website: home ? new URL(home.url).origin : `https://${domain}`,
    siteName,
    description: (main?.description || org?.description || '').slice(0, 400) || null,
    country: org?.country || countryFromDomain(domain),
    city: org?.city || null,
    phone: org?.telephone || pages.flatMap((p) => p.phones)[0] || null,
    employees: org?.employees ?? null,
    founded: org?.founded ?? null,
    ...classification,
    linkedinCompany: social.linkedin || null,
    social: {
      facebook: social.facebook || null,
      instagram: social.instagram || null,
      youtube: social.youtube || null,
      x: social.x || null,
    },
    email: {
      badge: badgeEmail,
      badgeDomainAcceptsMail: badgeDomain
        ? badgeDomain === domain
          ? domainAcceptsMail
          : await acceptsEmail(badgeDomain)
        : null,
      found: siteEmails.slice(0, 6),
      guessed,
    },
  };
}

export default async function handler(req, res) {
  const input =
    req.method === 'POST'
      ? typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {}
      : req.method === 'GET'
        ? req.query || {}
        : null;
  if (!input) {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  try {
    if (
      !(await teamCodeOk(
        String(input.code || '')
          .trim()
          .toUpperCase(),
      ))
    ) {
      res.status(401).json({ error: 'invalid_team_code' });
      return;
    }
  } catch {
    res.status(503).json({ error: 'team_check_unavailable' });
    return;
  }
  const intel = await researchCompany(input);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(intel);
}
