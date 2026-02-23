const columnSchemas = {
  contacts: [
    { id: 'name', label: 'Name', required: true, simple: true, sortKey: 'name' },
    { id: 'email', label: 'Email', required: true, simple: true, sortKey: 'email' },
    { id: 'phone', label: 'Phone', required: false, simple: true, sortKey: 'phone' },
    { id: 'city', label: 'City', required: false, simple: true, sortKey: 'city' },
    { id: 'status', label: 'Status', required: false, simple: true, sortKey: 'status' },
    { id: 'stage', label: 'Stage', required: false, simple: true, sortKey: 'stage' },
    { id: 'pipelineMilestone', label: 'Milestone', required: false, simple: true, sortKey: 'pipelineMilestone' },
    { id: 'owner', label: 'Owner', required: false, simple: true, sortKey: 'owner' },
    { id: 'loanType', label: 'Loan Type', required: false, simple: false, sortKey: 'loanType' },
    { id: 'loanAmount', label: 'Loan Amount', required: false, simple: true, sortKey: 'loanAmount' },
    { id: 'referredBy', label: 'Referral Partner', required: false, simple: true, sortKey: 'referredBy' },
    { id: 'lastTouch', label: 'Last Touch', required: false, simple: true, sortKey: 'lastTouch' },
    { id: 'nextAction', label: 'Next Action', required: false, simple: true, sortKey: 'nextAction' },
    { id: 'fundedDate', label: 'Funded Date', required: false, simple: true, sortKey: 'fundedDate' },
    { id: 'createdAt', label: 'Created', required: false, simple: false, sortKey: 'createdAt' },
    { id: 'updatedAt', label: 'Updated', required: false, simple: false, sortKey: 'updatedAt' }
  ],
  longshots: [
    { id: 'name', label: 'Name', required: true, simple: true, sortKey: 'name' },
    { id: 'email', label: 'Email', required: false, simple: true, sortKey: 'email' },
    { id: 'phone', label: 'Phone', required: false, simple: true, sortKey: 'phone' },
    { id: 'city', label: 'City', required: false, simple: true, sortKey: 'city' },
    { id: 'status', label: 'Status', required: false, simple: true, sortKey: 'status' },
    { id: 'stage', label: 'Stage', required: false, simple: true, sortKey: 'stage' },
    { id: 'loanType', label: 'Loan Type', required: false, simple: true, sortKey: 'loanType' },
    { id: 'loanAmount', label: 'Loan Amount', required: false, simple: true, sortKey: 'loanAmount' },
    { id: 'referredBy', label: 'Referral Partner', required: false, simple: true, sortKey: 'referredBy' },
    { id: 'owner', label: 'Owner', required: false, simple: true, sortKey: 'owner' },
    { id: 'lastTouch', label: 'Last Touch', required: false, simple: true, sortKey: 'lastTouch' },
    { id: 'nextAction', label: 'Next Action', required: false, simple: true, sortKey: 'nextAction' },
    { id: 'createdAt', label: 'Created', required: false, simple: false, sortKey: 'createdAt' },
    { id: 'updatedAt', label: 'Updated', required: false, simple: false, sortKey: 'updatedAt' }
  ],
  pipeline: [
    { id: 'name', label: 'Name', required: true, simple: true, sortKey: 'name' },
    { id: 'stage', label: 'Stage', required: true, simple: true, sortKey: 'stage' },
    { id: 'email', label: 'Email', required: false, simple: true, sortKey: 'email' },
    { id: 'phone', label: 'Phone', required: false, simple: true, sortKey: 'phone' },
    { id: 'city', label: 'City', required: false, simple: true, sortKey: 'city' },
    { id: 'pipelineMilestone', label: 'Milestone', required: false, simple: true, sortKey: 'pipelineMilestone' },
    { id: 'loanType', label: 'Loan Type', required: false, simple: true, sortKey: 'loanType' },
    { id: 'loanAmount', label: 'Loan Amount', required: false, simple: true, sortKey: 'loanAmount' },
    { id: 'referredBy', label: 'Referred By', required: false, simple: true, sortKey: 'referredBy' },
    { id: 'owner', label: 'Owner', required: false, simple: true, sortKey: 'owner' },
    { id: 'lastTouch', label: 'Last Touch', required: false, simple: true, sortKey: 'lastTouch' },
    { id: 'nextAction', label: 'Next Action', required: false, simple: true, sortKey: 'nextAction' },
    { id: 'createdAt', label: 'Created', required: false, simple: false, sortKey: 'createdAt' },
    { id: 'updatedAt', label: 'Updated', required: false, simple: false, sortKey: 'updatedAt' }
  ],
  clients: [
    { id: 'name', label: 'Name', required: true, simple: true, sortKey: 'name' },
    { id: 'stage', label: 'Stage', required: true, simple: true, sortKey: 'stage' },
    { id: 'email', label: 'Email', required: false, simple: true, sortKey: 'email' },
    { id: 'phone', label: 'Phone', required: false, simple: true, sortKey: 'phone' },
    { id: 'city', label: 'City', required: false, simple: true, sortKey: 'city' },
    { id: 'pipelineMilestone', label: 'Milestone', required: false, simple: true, sortKey: 'pipelineMilestone' },
    { id: 'loanType', label: 'Loan Type', required: false, simple: true, sortKey: 'loanType' },
    { id: 'loanAmount', label: 'Loan Amount', required: false, simple: true, sortKey: 'loanAmount' },
    { id: 'fundedDate', label: 'Funded Date', required: false, simple: true, sortKey: 'fundedDate' },
    { id: 'owner', label: 'Owner', required: false, simple: true, sortKey: 'owner' },
    { id: 'lastTouch', label: 'Last Touch', required: false, simple: true, sortKey: 'lastTouch' },
    { id: 'updatedAt', label: 'Updated', required: false, simple: false, sortKey: 'updatedAt' }
  ],
  partners: [
    { id: 'name', label: 'Name', required: true, simple: true, sortKey: 'name' },
    { id: 'company', label: 'Company', required: false, simple: true, sortKey: 'company' },
    { id: 'tier', label: 'Tier', required: false, simple: true, sortKey: 'tier' },
    { id: 'referrals', label: 'Referrals', required: false, simple: true, sortKey: 'referrals' },
    { id: 'funded', label: 'Funded', required: false, simple: true, sortKey: 'funded' },
    { id: 'active', label: 'Active', required: false, simple: true, sortKey: 'active' },
    { id: 'volume', label: 'Volume', required: false, simple: true, sortKey: 'volume' },
    { id: 'conversion', label: 'Conversion', required: false, simple: true, sortKey: 'conversion' },
    { id: 'email', label: 'Email', required: false, simple: true, sortKey: 'email' },
    { id: 'phone', label: 'Phone', required: false, simple: true, sortKey: 'phone' },
    { id: 'owner', label: 'Owner', required: false, simple: true, sortKey: 'owner' },
    { id: 'lastTouch', label: 'Last Touch', required: false, simple: true, sortKey: 'lastTouch' },
    { id: 'nextTouch', label: 'Next Action', required: false, simple: true, sortKey: 'nextTouch' },
    { id: 'createdAt', label: 'Created', required: false, simple: false, sortKey: 'createdAt' },
    { id: 'updatedAt', label: 'Updated', required: false, simple: false, sortKey: 'updatedAt' }
  ],
  'pipeline-main': [
    { id: 'name', label: 'Name', required: true, simple: true, sortKey: 'name' },
    { id: 'stage', label: 'Stage', required: true, simple: true, sortKey: 'stage' },
    { id: 'status', label: 'Status', required: false, simple: true, sortKey: 'status' },
    { id: 'pipelineMilestone', label: 'Milestone', required: false, simple: true, sortKey: 'pipelineMilestone' },
    { id: 'loanType', label: 'Loan Type', required: false, simple: true, sortKey: 'loanType' },
    { id: 'loanAmount', label: 'Loan Amount', required: false, simple: true, sortKey: 'loanAmount' },
    { id: 'email', label: 'Email', required: false, simple: true, sortKey: 'email' },
    { id: 'phone', label: 'Phone', required: false, simple: true, sortKey: 'phone' },
    { id: 'city', label: 'City', required: false, simple: true, sortKey: 'city' },
    { id: 'referredBy', label: 'Referral Partner', required: false, simple: true, sortKey: 'referredBy' },
    { id: 'owner', label: 'Owner', required: false, simple: true, sortKey: 'owner' },
    { id: 'lastTouch', label: 'Last Touch', required: false, simple: true, sortKey: 'lastTouch' },
    { id: 'nextAction', label: 'Next Action', required: false, simple: true, sortKey: 'nextAction' },
    { id: 'createdAt', label: 'Created', required: false, simple: false, sortKey: 'createdAt' },
    { id: 'updatedAt', label: 'Updated', required: false, simple: false, sortKey: 'updatedAt' }
  ],
  'leads-main': [
    { id: 'name', label: 'Name', required: true, simple: true, sortKey: 'name' },
    { id: 'status', label: 'Status', required: false, simple: true, sortKey: 'status' },
    { id: 'stage', label: 'Stage', required: false, simple: true, sortKey: 'stage' },
    { id: 'loanType', label: 'Loan Type', required: false, simple: true, sortKey: 'loanType' },
    { id: 'loanAmount', label: 'Loan Amount', required: false, simple: true, sortKey: 'loanAmount' },
    { id: 'pipelineMilestone', label: 'Milestone', required: false, simple: true, sortKey: 'pipelineMilestone' },
    { id: 'email', label: 'Email', required: false, simple: true, sortKey: 'email' },
    { id: 'phone', label: 'Phone', required: false, simple: true, sortKey: 'phone' },
    { id: 'city', label: 'City', required: false, simple: true, sortKey: 'city' },
    { id: 'referredBy', label: 'Referral Partner', required: false, simple: true, sortKey: 'referredBy' },
    { id: 'owner', label: 'Owner', required: false, simple: true, sortKey: 'owner' },
    { id: 'lastTouch', label: 'Last Touch', required: false, simple: true, sortKey: 'lastTouch' },
    { id: 'nextAction', label: 'Next Action', required: false, simple: true, sortKey: 'nextAction' },
    { id: 'createdAt', label: 'Created', required: false, simple: false, sortKey: 'createdAt' },
    { id: 'updatedAt', label: 'Updated', required: false, simple: false, sortKey: 'updatedAt' }
  ],
  'partners-main': [
    { id: 'name', label: 'Name', required: true, simple: true, sortKey: 'name' },
    { id: 'company', label: 'Company', required: false, simple: true, sortKey: 'company' },
    { id: 'tier', label: 'Tier', required: false, simple: true, sortKey: 'tier' },
    { id: 'referrals', label: 'Referrals', required: false, simple: true, sortKey: 'referrals' },
    { id: 'funded', label: 'Funded', required: false, simple: true, sortKey: 'funded' },
    { id: 'active', label: 'Active', required: false, simple: true, sortKey: 'active' },
    { id: 'volume', label: 'Volume', required: false, simple: true, sortKey: 'volume' },
    { id: 'conversion', label: 'Conversion', required: false, simple: true, sortKey: 'conversion' },
    { id: 'email', label: 'Email', required: false, simple: true, sortKey: 'email' },
    { id: 'phone', label: 'Phone', required: false, simple: true, sortKey: 'phone' },
    { id: 'owner', label: 'Owner', required: false, simple: true, sortKey: 'owner' },
    { id: 'lastTouch', label: 'Last Touch', required: false, simple: true, sortKey: 'lastTouch' },
    { id: 'nextTouch', label: 'Next Action', required: false, simple: true, sortKey: 'nextTouch' },
    { id: 'createdAt', label: 'Created', required: false, simple: false, sortKey: 'createdAt' },
    { id: 'updatedAt', label: 'Updated', required: false, simple: false, sortKey: 'updatedAt' }
  ]
};

function getColumnSchema(viewKey){
  if(!viewKey) return [];
  return columnSchemas[viewKey] ? columnSchemas[viewKey].slice() : [];
}

function getRequiredColumns(viewKey){
  return getColumnSchema(viewKey).filter((col) => col.required);
}

function getSimpleColumns(viewKey){
  return getColumnSchema(viewKey).filter((col) => col.simple !== false);
}

export { columnSchemas, getColumnSchema, getRequiredColumns, getSimpleColumns };
export default columnSchemas;
