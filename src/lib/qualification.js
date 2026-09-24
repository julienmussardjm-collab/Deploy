// Qualification options shown on the lead form.

export const INTEREST_AREAS = [
  'Street & Area',
  'Sports',
  'Horticulture',
  'Industry',
  'Commercial',
  'Retail & Residential',
  'Architectural',
  'Signage & Non-Signage',
];

// [action, description]
export const FOLLOW_UP_ACTIONS = [
  ['Send datasheet', 'Email product documentation within 48h'],
  ['Sample request', 'Ship an evaluation unit — needs shipping address'],
  ['Quotation', 'Sales prepares a priced offer for the project'],
  ['Schedule call', 'Book a technical call with an applications engineer'],
  ['Site / project visit', 'Field visit to qualify the project on site'],
  ['Distributor handover', 'Pass to the local distributor for this territory'],
];

export const PRIORITIES = ['Hot', 'Warm', 'Cold'];

export const EMPTY_CONTACT = {
  badgeId: '',
  name: '',
  title: '',
  company: '',
  country: '',
  email: '',
  phone: '',
};

export function newDraft(contact, rawScan) {
  return {
    contact,
    interests: [],
    action: FOLLOW_UP_ACTIONS[0][0],
    priority: 'Warm',
    notes: '',
    rawScan: rawScan ?? null,
  };
}

export function draftFromLead(lead, rawScan) {
  return {
    contact: {
      badgeId: lead.badgeId,
      name: lead.name,
      title: lead.title,
      company: lead.company,
      country: lead.country,
      email: lead.email,
      phone: lead.phone,
    },
    interests: lead.interests,
    action: lead.action,
    priority: lead.priority ?? 'Warm',
    notes: lead.notes ?? '',
    rawScan: rawScan !== undefined ? rawScan : (lead.rawScan ?? null),
  };
}
