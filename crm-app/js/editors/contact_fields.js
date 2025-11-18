const CONTACT_FIELD_GROUPS = {
  profile: { id: 'profile', label: 'Borrower Profile', simple: true },
  loanSnapshot: { id: 'loanSnapshot', label: 'Pipeline Stage', simple: true },
  loanDetails: {
    id: 'loanDetails',
    label: 'Loan & Property Details',
    simple: false,
    simpleSettingKey: 'showLoanDetails'
  },
  address: { id: 'address', label: 'Property Address', simple: false, simpleSettingKey: 'showAddress' },
  relationships: {
    id: 'relationships',
    label: 'Relationships',
    simple: false,
    simpleSettingKey: 'showRelationshipDetails'
  },
  engagement: { id: 'engagement', label: 'Engagement', simple: true },
  notes: { id: 'notes', label: 'Notes', simple: true }
};

const SIMPLE_MODE_DEFAULTS = {
  showLoanDetails: false,
  showRelationshipDetails: false,
  showAddress: false
};

function normalizeBooleanLike(value){
  if(value === true || value === false) return value;
  if(typeof value === 'string'){
    const normalized = value.trim().toLowerCase();
    if(normalized === 'true') return true;
    if(normalized === 'false') return false;
  }
  if(typeof value === 'number'){
    if(value === 1) return true;
    if(value === 0) return false;
  }
  return Boolean(value);
}

function normalizeSimpleModeSettings(source){
  const base = source && typeof source === 'object' ? source : {};
  const loanDetails = normalizeBooleanLike(base.showLoanDetails);
  const relationshipDetails = normalizeBooleanLike(base.showRelationshipDetails);
  const address = normalizeBooleanLike(base.showAddress);
  return {
    showLoanDetails: loanDetails === true,
    showRelationshipDetails: relationshipDetails === true,
    showAddress: address === true
  };
}

const CONTACT_FIELD_META = {
  profile: [
    { id: 'first', inputId: 'c-first', label: 'First Name', required: true, simple: true, group: 'profile' },
    { id: 'last', inputId: 'c-last', label: 'Last Name', required: true, simple: true, group: 'profile' },
    { id: 'contactType', inputId: 'c-type', label: 'Contact Role', required: false, simple: true, group: 'profile' },
    { id: 'priority', inputId: 'c-priority', label: 'Priority', required: false, simple: true, group: 'profile' },
    { id: 'leadSource', inputId: 'c-source', label: 'Lead Source', required: false, simple: true, group: 'profile' },
    { id: 'communicationPreference', inputId: 'c-pref', label: 'Communication Preference', required: false, simple: true, group: 'profile' },
    { id: 'email', inputId: 'c-email', label: 'Primary Email', required: true, simple: true, group: 'profile' },
    { id: 'phone', inputId: 'c-phone', label: 'Mobile / Direct Line', required: true, simple: true, group: 'profile' },
    { id: 'secondaryEmail', inputId: 'c-email2', label: 'Secondary Email', required: false, simple: false, advancedOnly: true, group: 'profile' },
    { id: 'secondaryPhone', inputId: 'c-phone2', label: 'Secondary Phone', required: false, simple: false, advancedOnly: true, group: 'profile' }
  ],
  loanSnapshot: [
    { id: 'stage', inputId: 'c-stage', label: 'Stage', required: true, simple: true, group: 'loanSnapshot' },
    { id: 'status', inputId: 'c-status', label: 'Status', required: true, simple: true, group: 'loanSnapshot' },
    { id: 'pipelineMilestone', inputId: 'c-milestone', label: 'Pipeline Milestone', required: false, simple: true, group: 'loanSnapshot' }
  ],
  loanDetails: [
    { id: 'closingTimeline', inputId: 'c-timeline', label: 'Closing Timeline', required: false, simple: false, advancedOnly: true, group: 'loanDetails' },
    { id: 'loanPurpose', inputId: 'c-purpose', label: 'Loan Purpose', required: false, simple: false, advancedOnly: true, group: 'loanDetails' },
    { id: 'loanProgram', inputId: 'c-loanType', label: 'Loan Program', required: false, simple: false, advancedOnly: true, group: 'loanDetails' },
    { id: 'propertyType', inputId: 'c-property', label: 'Property Type', required: false, simple: false, advancedOnly: true, group: 'loanDetails' },
    { id: 'occupancy', inputId: 'c-occupancy', label: 'Occupancy', required: false, simple: false, advancedOnly: true, group: 'loanDetails' },
    { id: 'employmentType', inputId: 'c-employment', label: 'Employment Type', required: false, simple: false, advancedOnly: true, group: 'loanDetails' },
    { id: 'creditRange', inputId: 'c-credit', label: 'Credit Range', required: false, simple: false, advancedOnly: true, group: 'loanDetails' },
    { id: 'loanAmount', inputId: 'c-amount', label: 'Loan Amount', required: false, simple: true, group: 'loanDetails' },
    { id: 'rate', inputId: 'c-rate', label: 'Rate', required: false, simple: false, advancedOnly: true, group: 'loanDetails' },
    { id: 'fundedDate', inputId: 'c-funded', label: 'Funded / Expected Closing', required: false, simple: true, group: 'loanDetails' },
    { id: 'preApprovalExpires', inputId: 'c-preexp', label: 'Pre-Approval Expires', required: false, simple: false, advancedOnly: true, group: 'loanDetails' },
    { id: 'docStage', inputId: 'c-docstage', label: 'Documentation Stage', required: false, simple: false, advancedOnly: true, group: 'loanDetails' }
  ],
  address: [
    { id: 'address', inputId: 'c-address', label: 'Street Address', required: false, simple: false, advancedOnly: true, group: 'address' },
    { id: 'city', inputId: 'c-city', label: 'City', required: false, simple: false, advancedOnly: true, group: 'address' },
    { id: 'state', inputId: 'c-state', label: 'State', required: false, simple: false, advancedOnly: true, group: 'address' },
    { id: 'zip', inputId: 'c-zip', label: 'ZIP', required: false, simple: false, advancedOnly: true, group: 'address' }
  ],
  relationships: [
    { id: 'buyerPartner', inputId: 'c-buyer', label: 'Buyer Partner', required: false, simple: false, advancedOnly: true, group: 'relationships' },
    { id: 'listingPartner', inputId: 'c-listing', label: 'Listing Partner', required: false, simple: false, advancedOnly: true, group: 'relationships' },
    { id: 'referralPartner', inputId: 'c-referral-partner', label: 'Referral Partner', required: false, simple: false, advancedOnly: true, group: 'relationships' },
    { id: 'referredBy', inputId: 'c-ref', label: 'Referred By', required: false, simple: false, advancedOnly: true, group: 'relationships' }
  ],
  engagement: [
    { id: 'lastContact', inputId: 'c-lastcontact', label: 'Last Contact', required: false, simple: true, group: 'engagement' },
    { id: 'nextFollowUp', inputId: 'c-nexttouch', label: 'Next Follow-Up', required: false, simple: true, group: 'engagement' }
  ],
  notes: [
    { id: 'notes', selector: '#c-notes', label: 'Notes', required: false, simple: true, group: 'notes' }
  ]
};

const contactFields = Object.values(CONTACT_FIELD_META).flat();

function resolveGroupSetting(field){
  if(!field || !field.group) return null;
  const group = CONTACT_FIELD_GROUPS[field.group];
  if(!group || !group.simpleSettingKey) return null;
  return group.simpleSettingKey;
}

function visibleContactFieldIds(mode = 'advanced', simpleModeSettings = SIMPLE_MODE_DEFAULTS){
  const normalized = mode === 'simple' ? 'simple' : 'advanced';
  const simpleSettings = normalizeSimpleModeSettings(simpleModeSettings);
  return contactFields
    .filter((field) => {
      if(normalized === 'advanced') return true;
      const groupSettingKey = resolveGroupSetting(field);
      const groupEnabled = groupSettingKey ? simpleSettings[groupSettingKey] === true : false;
      if(field.required || field.simple) return !field.advancedOnly || groupEnabled;
      if(field.advancedOnly) return groupEnabled;
      return groupEnabled;
    })
    .map((field) => field.id);
}

function resolveFieldNode(container, field){
  if(!container) return null;
  const input = field.inputId ? container.querySelector(`#${field.inputId}`) : null;
  if(input){
    const label = input.closest('label');
    return { node: label || input, control: input };
  }
  const node = field.selector ? container.querySelector(field.selector) : null;
  if(node){
    const control = node.matches('input,select,textarea') ? node : node.querySelector('input,select,textarea');
    return { node, control };
  }
  return null;
}

function applyContactFieldVisibility(container, mode = 'advanced', options = {}){
  const simpleSettings = normalizeSimpleModeSettings(options.simpleMode || SIMPLE_MODE_DEFAULTS);
  const visibleIds = new Set(visibleContactFieldIds(mode, simpleSettings));
  contactFields.forEach((field) => {
    const resolved = resolveFieldNode(container, field);
    if(!resolved || !resolved.node) return;
    const show = visibleIds.has(field.id);
    resolved.node.hidden = !show;
    resolved.node.classList.toggle('is-hidden-simple', !show);
    if(resolved.control){
      resolved.control.disabled = !show;
    }
  });
}

export {
  CONTACT_FIELD_GROUPS,
  CONTACT_FIELD_META,
  SIMPLE_MODE_DEFAULTS,
  contactFields,
  visibleContactFieldIds,
  applyContactFieldVisibility,
  normalizeSimpleModeSettings
};
export default contactFields;
