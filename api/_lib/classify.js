// Keyword classification of a company from its website text, in English,
// French, German, Italian, Spanish and Dutch. Rule-based, so it gives a
// hint with a confidence level, not a verdict.

// Lowercase, accents removed, punctuation to spaces: "Straßen-Beleuchtung"
// and "strassen beleuchtung" compare equal.
export function normalize(text) {
  return ` ${String(text || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')} `;
}

function count(haystack, term) {
  const needle = normalize(term);
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1 && n < 20) {
    n++;
    i = haystack.indexOf(needle, i + needle.length - 1);
  }
  return n;
}

// [label, weight, terms]. Weight 2 for terms that name the business model
// outright, 1 for supporting vocabulary.
const COMPANY_TYPES = [
  [
    'Luminaire manufacturer (OEM)',
    [
      [
        2,
        [
          'luminaire manufacturer',
          'lighting manufacturer',
          'manufacturer of luminaires',
          'fabricant de luminaires',
          'leuchtenhersteller',
          'produttore di apparecchi',
          'fabricante de luminarias',
          'armaturenfabrikant',
        ],
      ],
      [
        1,
        [
          'luminaire',
          'luminaires',
          'leuchten',
          'leuchte',
          'apparecchi di illuminazione',
          'luminarias',
          'armaturen',
          'light fixtures',
          'lighting fixtures',
          'luminaria',
          'our luminaires',
          'nos luminaires',
          'unsere leuchten',
        ],
      ],
    ],
  ],
  [
    'Distributor / wholesaler',
    [
      [
        2,
        [
          'wholesaler',
          'wholesale',
          'grossiste',
          'grosshandel',
          'grosshandler',
          'distributore',
          'mayorista',
          'groothandel',
          'authorized distributor',
          'official distributor',
        ],
      ],
      [
        1,
        [
          'distributor',
          'distribution',
          'distributeur',
          'distribuzione',
          'distribuidor',
          'webshop',
          'online shop',
          'in stock',
          'brands we carry',
        ],
      ],
    ],
  ],
  [
    'Lighting designer / engineering office',
    [
      [
        2,
        [
          'lighting design',
          'lighting designer',
          'lichtplanung',
          'lichtplaner',
          'bureau d etudes',
          'conception lumiere',
          'eclairagiste',
          'progettazione illuminotecnica',
          'lighting consultancy',
          'ingenieurburo',
          'planungsburo',
        ],
      ],
      [
        1,
        [
          'consulting engineers',
          'engineering consultancy',
          'specifier',
          'lighting concept',
          'lichtkonzept',
        ],
      ],
    ],
  ],
  [
    'Installer / contractor',
    [
      [
        2,
        [
          'electrical contractor',
          'elektroinstallation',
          'installation company',
          'installateur electricien',
          'impianti elettrici',
          'instalaciones electricas',
        ],
      ],
      [
        1,
        [
          'installer',
          'installation',
          'electricien',
          'elektrotechnik',
          'installatore',
          'instalador',
          'maintenance contracts',
        ],
      ],
    ],
  ],
  [
    'LED driver / power supply maker (competitor)',
    [
      [
        2,
        [
          'led driver manufacturer',
          'manufacturer of led drivers',
          'power supply manufacturer',
          'betriebsgerate hersteller',
          'produttore di alimentatori',
        ],
      ],
      [
        1,
        [
          'led drivers',
          'led driver',
          'power supplies',
          'betriebsgerate',
          'alimentatori',
          'alimentations led',
          'drivers led',
        ],
      ],
    ],
  ],
];

// Driver makers and other lighting-electronics competitors, matched on the
// company name or domain.
const COMPETITOR_BRANDS = [
  'mean well',
  'meanwell',
  'tridonic',
  'eldoled',
  'helvar',
  'sosen',
  'ltech',
  'lifud',
  'moso',
  'euchips',
  'vossloh schwabe',
  'osram',
  'signify',
  'harvard technology',
  'self electronics',
  'done power',
  'boke',
];
const INTERNAL_DOMAINS = ['inventronicsglobal.com', 'inventronics.com', 'inventronics-co.com'];

const SEGMENTS = [
  [
    'Street & Area',
    [
      'street light',
      'streetlight',
      'street lighting',
      'road lighting',
      'area lighting',
      'outdoor lighting',
      'public lighting',
      'eclairage public',
      'eclairage exterieur',
      'strassenbeleuchtung',
      'aussenbeleuchtung',
      'illuminazione pubblica',
      'illuminazione stradale',
      'alumbrado publico',
      'tunnel lighting',
      'smart city',
      'straatverlichting',
    ],
  ],
  [
    'Sports',
    [
      'sports lighting',
      'stadium',
      'sportbeleuchtung',
      'sportplatz',
      'eclairage sportif',
      'illuminazione sportiva',
      'floodlight',
      'arena lighting',
    ],
  ],
  [
    'Horticulture',
    [
      'horticulture',
      'horticultural',
      'grow light',
      'grow lights',
      'greenhouse',
      'vertical farming',
      'gewachshaus',
      'serre',
      'horticole',
      'orticoltura',
      'invernadero',
      'kas verlichting',
    ],
  ],
  [
    'Industry',
    [
      'industrial lighting',
      'high bay',
      'highbay',
      'warehouse',
      'industriebeleuchtung',
      'hallenbeleuchtung',
      'eclairage industriel',
      'illuminazione industriale',
      'iluminacion industrial',
      'hazardous area',
      'atex',
    ],
  ],
  [
    'Commercial',
    [
      'office lighting',
      'commercial lighting',
      'buroleuchten',
      'buerobeleuchtung',
      'eclairage de bureau',
      'illuminazione uffici',
      'hospitality',
      'education lighting',
      'healthcare lighting',
    ],
  ],
  [
    'Retail & Residential',
    [
      'retail lighting',
      'shop lighting',
      'store lighting',
      'residential',
      'home lighting',
      'wohnraum',
      'ladenbau',
      'illuminazione negozi',
      'eclairage commercial',
    ],
  ],
  [
    'Architectural',
    [
      'architectural lighting',
      'facade lighting',
      'fassadenbeleuchtung',
      'facciata',
      'landscape lighting',
      'museum lighting',
      'linear lighting',
      'accent lighting',
      'architekturbeleuchtung',
      'eclairage architectural',
    ],
  ],
  [
    'Signage & Non-Signage',
    [
      'signage',
      'sign lighting',
      'lichtwerbung',
      'leuchtreklame',
      'enseigne',
      'enseignes lumineuses',
      'insegne',
      'channel letters',
      'display lighting',
      'lightbox',
      'light box',
    ],
  ],
];

const TECH = [
  ['DALI-2', ['dali 2', 'dali2']],
  ['D4i', ['d4i']],
  ['DALI', ['dali']],
  ['Zhaga', ['zhaga']],
  ['NEMA socket', ['nema socket', 'nema 7 pin', 'nema7']],
  ['0-10V / 1-10V dimming', ['0 10v', '1 10v']],
  ['Casambi / Bluetooth', ['casambi', 'bluetooth mesh']],
  [
    'Emergency lighting',
    ['emergency lighting', 'notbeleuchtung', 'eclairage de securite', 'illuminazione di emergenza'],
  ],
  ['Tunable white / HCL', ['tunable white', 'human centric', 'human centric lighting']],
  ['Surge protection', ['surge protection', 'uberspannungsschutz', 'parafoudre']],
  ['UV-C', ['uv c', 'uvc']],
];

function score(haystack, groups) {
  let total = 0;
  const evidence = [];
  for (const [weight, terms] of groups) {
    for (const term of terms) {
      const n = count(haystack, term);
      if (n) {
        total += weight * Math.min(n, 3);
        evidence.push(term);
      }
    }
  }
  return { total, evidence };
}

export function classifyCompany({ text = '', name = '', domain = '' }) {
  const haystack = normalize(`${name} ${text}`);
  const nameAndDomain = normalize(`${name} ${domain.replace(/\.[a-z.]+$/, '')}`);

  if (INTERNAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return {
      companyType: 'Inventronics (internal)',
      typeConfidence: 'high',
      typeEvidence: [domain],
      segments: [],
      tech: [],
    };
  }

  const segments = SEGMENTS.filter(([, terms]) => terms.some((t) => count(haystack, t))).map(
    ([label]) => label,
  );
  const tech = TECH.filter(([, terms]) => terms.some((t) => count(haystack, t))).map(
    ([label]) => label,
  );
  // "DALI" is implied when DALI-2 or D4i is found.
  const techShown =
    tech.includes('DALI-2') || tech.includes('D4i') ? tech.filter((t) => t !== 'DALI') : tech;

  const brand = COMPETITOR_BRANDS.find((b) => count(nameAndDomain, b));
  if (brand) {
    return {
      companyType: 'LED driver / power supply maker (competitor)',
      typeConfidence: 'high',
      typeEvidence: [brand],
      segments,
      tech: techShown,
    };
  }

  const ranked = COMPANY_TYPES.map(([label, groups]) => ({
    label,
    ...score(haystack, groups),
  })).sort((a, b) => b.total - a.total);
  const [top, second] = ranked;
  let companyType = 'Unknown';
  let typeConfidence = 'low';
  if (top.total >= 2) {
    companyType = top.label;
    typeConfidence =
      top.total >= 6 && top.total >= 2 * second.total ? 'high' : top.total >= 3 ? 'medium' : 'low';
  }
  return {
    companyType,
    typeConfidence,
    typeEvidence: top.evidence.slice(0, 5),
    segments,
    tech: techShown,
  };
}

const TLD_COUNTRIES = {
  de: 'Germany',
  fr: 'France',
  it: 'Italy',
  es: 'Spain',
  nl: 'Netherlands',
  be: 'Belgium',
  ch: 'Switzerland',
  at: 'Austria',
  uk: 'United Kingdom',
  pl: 'Poland',
  cz: 'Czech Republic',
  se: 'Sweden',
  dk: 'Denmark',
  no: 'Norway',
  fi: 'Finland',
  pt: 'Portugal',
  ie: 'Ireland',
  tr: 'Turkey',
  cn: 'China',
  jp: 'Japan',
  kr: 'South Korea',
  in: 'India',
  br: 'Brazil',
  ca: 'Canada',
  au: 'Australia',
  ae: 'United Arab Emirates',
  hu: 'Hungary',
  ro: 'Romania',
  gr: 'Greece',
  lu: 'Luxembourg',
  si: 'Slovenia',
  sk: 'Slovakia',
  hr: 'Croatia',
};

// Country from a domain's top-level domain, when it is a country code.
export function countryFromDomain(domain) {
  const tld = String(domain || '')
    .split('.')
    .pop();
  return TLD_COUNTRIES[tld] || null;
}
