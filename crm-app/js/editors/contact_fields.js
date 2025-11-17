const contactFields = [
  { id: 'first', inputId: 'c-first', label: 'First Name', required: true, simple: true },
  { id: 'last', inputId: 'c-last', label: 'Last Name', required: true, simple: true },
  { id: 'contactType', inputId: 'c-type', label: 'Contact Role', required: false, simple: true },
  { id: 'priority', inputId: 'c-priority', label: 'Priority', required: false, simple: true },
  { id: 'leadSource', inputId: 'c-source', label: 'Lead Source', required: false, simple: true },
  { id: 'communicationPreference', inputId: 'c-pref', label: 'Communication Preference', required: false, simple: true },
  { id: 'email', inputId: 'c-email', label: 'Primary Email', required: true, simple: true },
  { id: 'phone', inputId: 'c-phone', label: 'Mobile / Direct Line', required: true, simple: true },
  { id: 'secondaryEmail', inputId: 'c-email2', label: 'Secondary Email', required: false, simple: false },
  { id: 'secondaryPhone', inputId: 'c-phone2', label: 'Secondary Phone', required: false, simple: false },
  { id: 'stage', inputId: 'c-stage', label: 'Stage', required: true, simple: true },
  { id: 'status', inputId: 'c-status', label: 'Status', required: true, simple: true },
  { id: 'closingTimeline', inputId: 'c-timeline', label: 'Closing Timeline', required: false, simple: false },
  { id: 'loanPurpose', inputId: 'c-purpose', label: 'Loan Purpose', required: false, simple: false },
  { id: 'loanProgram', inputId: 'c-loanType', label: 'Loan Program', required: false, simple: false },
  { id: 'propertyType', inputId: 'c-property', label: 'Property Type', required: false, simple: false },
  { id: 'occupancy', inputId: 'c-occupancy', label: 'Occupancy', required: false, simple: false },
  { id: 'employmentType', inputId: 'c-employment', label: 'Employment Type', required: false, simple: false },
  { id: 'creditRange', inputId: 'c-credit', label: 'Credit Range', required: false, simple: false },
  { id: 'loanAmount', inputId: 'c-amount', label: 'Loan Amount', required: false, simple: true },
  { id: 'rate', inputId: 'c-rate', label: 'Rate', required: false, simple: false },
  { id: 'fundedDate', inputId: 'c-funded', label: 'Funded / Expected Closing', required: false, simple: true },
  { id: 'preApprovalExpires', inputId: 'c-preexp', label: 'Pre-Approval Expires', required: false, simple: false },
  { id: 'docStage', inputId: 'c-docstage', label: 'Documentation Stage', required: false, simple: false },
  { id: 'pipelineMilestone', inputId: 'c-milestone', label: 'Pipeline Milestone', required: false, simple: true },
  { id: 'address', inputId: 'c-address', label: 'Street Address', required: false, simple: false },
  { id: 'city', inputId: 'c-city', label: 'City', required: false, simple: false },
  { id: 'state', inputId: 'c-state', label: 'State', required: false, simple: false },
  { id: 'zip', inputId: 'c-zip', label: 'ZIP', required: false, simple: false },
  { id: 'buyerPartner', inputId: 'c-buyer', label: 'Buyer Partner', required: false, simple: false },
  { id: 'listingPartner', inputId: 'c-listing', label: 'Listing Partner', required: false, simple: false },
  { id: 'referralPartner', inputId: 'c-referral-partner', label: 'Referral Partner', required: false, simple: false },
  { id: 'referredBy', inputId: 'c-ref', label: 'Referred By', required: false, simple: false },
  { id: 'lastContact', inputId: 'c-lastcontact', label: 'Last Contact', required: false, simple: true },
  { id: 'nextFollowUp', inputId: 'c-nexttouch', label: 'Next Follow-Up', required: false, simple: true },
  { id: 'notes', selector: '#c-notes', label: 'Notes', required: false, simple: true }
];

function visibleContactFieldIds(mode = 'advanced'){
  const normalized = mode === 'simple' ? 'simple' : 'advanced';
  return contactFields
    .filter((field) => normalized === 'advanced' || field.required || field.simple)
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

function applyContactFieldVisibility(container, mode = 'advanced'){
  const visibleIds = new Set(visibleContactFieldIds(mode));
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

export { contactFields, visibleContactFieldIds, applyContactFieldVisibility };
export default contactFields;
