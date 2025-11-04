/**
 * Workbench table column schema
 * The workbench uses lens-specific schemas, so this provides shared utilities
 */

import { registerSurface } from '../registry.js';

// Workbench columns are dynamically determined by the active lens
// This file provides a unified schema for workbench views

const WORKBENCH_SHARED_COLUMNS = [
  {
    id: 'name',
    label: 'Name',
    accessor: (record) => {
      if (record.first || record.last) {
        const first = record.first || '';
        const last = record.last || '';
        return `${first} ${last}`.trim();
      }
      return record.name || '—';
    },
    width: 'clamp(220px, 32vw, 420px)',
    sortable: true,
    defaultVisible: true
  },
  {
    id: 'status',
    label: 'Status',
    accessor: 'status',
    width: '140px',
    sortable: true,
    defaultVisible: true
  },
  {
    id: 'stage',
    label: 'Stage',
    accessor: 'stage',
    width: '160px',
    sortable: true,
    defaultVisible: true
  },
  {
    id: 'owner',
    label: 'Owner',
    accessor: 'owner',
    width: '140px',
    sortable: true,
    defaultVisible: true
  },
  {
    id: 'loanAmount',
    label: 'Loan Amount',
    accessor: 'loanAmount',
    width: '140px',
    sortable: true,
    defaultVisible: true,
    format: (value) => {
      if (!value) return '—';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    }
  },
  {
    id: 'lastTouch',
    label: 'Last Touch',
    accessor: (record) => record.lastContact || record.lastTouch,
    width: '140px',
    sortable: true,
    defaultVisible: true,
    format: (value) => {
      if (!value) return '—';
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return '—';
      }
    }
  },
  {
    id: 'nextAction',
    label: 'Next Follow-Up',
    accessor: (record) => record.nextFollowUp || record.nextTouch,
    width: '140px',
    sortable: true,
    defaultVisible: true,
    format: (value) => {
      if (!value) return '—';
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return '—';
      }
    }
  },
  {
    id: 'fundedDate',
    label: 'Funded Date',
    accessor: 'fundedDate',
    width: '140px',
    sortable: true,
    defaultVisible: false,
    format: (value) => {
      if (!value) return '—';
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return '—';
      }
    }
  },
  {
    id: 'company',
    label: 'Company',
    accessor: 'company',
    width: '200px',
    sortable: true,
    defaultVisible: false
  },
  {
    id: 'tier',
    label: 'Tier',
    accessor: 'tier',
    width: '120px',
    sortable: true,
    defaultVisible: false
  }
];

// Register base workbench surface (individual lenses can override)
registerSurface('workbench', WORKBENCH_SHARED_COLUMNS);
registerSurface('workbench:leads', WORKBENCH_SHARED_COLUMNS.filter(c =>
  ['name', 'status', 'owner', 'lastTouch', 'nextAction', 'loanAmount'].includes(c.id)
));
registerSurface('workbench:pipeline', WORKBENCH_SHARED_COLUMNS.filter(c =>
  ['name', 'stage', 'owner', 'loanAmount', 'lastTouch', 'nextAction'].includes(c.id)
));
registerSurface('workbench:clients', WORKBENCH_SHARED_COLUMNS.filter(c =>
  ['name', 'stage', 'owner', 'fundedDate', 'loanAmount'].includes(c.id)
));
registerSurface('workbench:partners', [
  WORKBENCH_SHARED_COLUMNS.find(c => c.id === 'name'),
  WORKBENCH_SHARED_COLUMNS.find(c => c.id === 'company'),
  WORKBENCH_SHARED_COLUMNS.find(c => c.id === 'tier'),
  WORKBENCH_SHARED_COLUMNS.find(c => c.id === 'owner'),
  WORKBENCH_SHARED_COLUMNS.find(c => c.id === 'lastTouch'),
  {
    id: 'nextTouch',
    label: 'Next Touch',
    accessor: 'nextTouch',
    width: '140px',
    sortable: true,
    defaultVisible: true,
    format: (value) => {
      if (!value) return '—';
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return '—';
      }
    }
  }
].filter(Boolean));

export default WORKBENCH_SHARED_COLUMNS;
