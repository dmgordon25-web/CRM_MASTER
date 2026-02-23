const partnerFields = [
  { id: 'name', inputId: 'p-name', label: 'Partner Name', required: true, simple: true },
  { id: 'company', inputId: 'p-company', label: 'Company / Team', required: false, simple: true },
  { id: 'partnerType', inputId: 'p-type', label: 'Partner Type', required: false, simple: true },
  { id: 'tier', inputId: 'p-tier', label: 'Tier', required: false, simple: true },
  { id: 'focus', inputId: 'p-focus', label: 'Primary Market Focus', required: false, simple: true },
  { id: 'priority', inputId: 'p-priority', label: 'Relationship Priority', required: false, simple: true },
  { id: 'email', inputId: 'p-email', label: 'Email', required: true, simple: true },
  { id: 'phone', inputId: 'p-phone', label: 'Mobile / Direct Line', required: true, simple: true },
  { id: 'preferredContact', inputId: 'p-pref', label: 'Preferred Contact Method', required: false, simple: true },
  { id: 'cadence', inputId: 'p-cadence', label: 'Communication Cadence', required: false, simple: true },
  { id: 'address', inputId: 'p-address', label: 'Office Address', required: false, simple: false },
  { id: 'city', inputId: 'p-city', label: 'City', required: false, simple: false },
  { id: 'state', inputId: 'p-state', label: 'State', required: false, simple: false },
  { id: 'zip', inputId: 'p-zip', label: 'ZIP', required: false, simple: false },
  { id: 'referralVolume', inputId: 'p-volume', label: 'Referral Volume', required: false, simple: false },
  { id: 'lastTouch', inputId: 'p-lasttouch', label: 'Last Touch', required: false, simple: true },
  { id: 'nextTouch', inputId: 'p-nexttouch', label: 'Next Planned Touch', required: false, simple: true },
  { id: 'relationshipOwner', inputId: 'p-owner', label: 'Relationship Owner', required: false, simple: false },
  { id: 'collaborationFocus', inputId: 'p-collab', label: 'Collaboration Focus', required: false, simple: false },
  { id: 'notes', inputId: 'p-notes', label: 'Success Plan & Notes', required: false, simple: true }
];

function visiblePartnerFieldIds(mode = 'advanced'){
  const normalized = mode === 'simple' ? 'simple' : 'advanced';
  return partnerFields
    .filter((field) => normalized === 'advanced' || field.required || field.simple)
    .map((field) => field.id);
}

function resolveNode(container, field){
  if(!container) return null;
  const input = field.inputId ? container.querySelector(`#${field.inputId}`) : null;
  if(input){
    const label = input.closest('label');
    return { node: label || input, control: input };
  }
  return null;
}

function applyPartnerFieldVisibility(container, mode = 'advanced'){
  const visibleIds = new Set(visiblePartnerFieldIds(mode));
  partnerFields.forEach((field) => {
    const resolved = resolveNode(container, field);
    if(!resolved || !resolved.node) return;
    const show = visibleIds.has(field.id);
    resolved.node.hidden = !show;
    resolved.node.classList.toggle('is-hidden-simple', !show);
    if(resolved.control){
      resolved.control.disabled = !show;
    }
  });
}

export { partnerFields, visiblePartnerFieldIds, applyPartnerFieldVisibility };
export default partnerFields;
