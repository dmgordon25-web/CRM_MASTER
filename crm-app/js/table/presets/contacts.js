/**
 * Contacts table column schema
 */

import { registerSurface } from '../registry.js';

const CONTACTS_COLUMNS = [
  {
    id: 'name',
    label: 'Name',
    accessor: (record) => {
      const first = record.first || '';
      const last = record.last || '';
      return `${first} ${last}`.trim() || record.name || '—';
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
    id: 'loanType',
    label: 'Loan Type',
    accessor: 'loanType',
    width: 'clamp(140px, 26vw, 220px)',
    sortable: true,
    defaultVisible: false
  },
  {
    id: 'lastTouch',
    label: 'Last Touch',
    accessor: 'lastContact',
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
    accessor: 'nextFollowUp',
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
    id: 'email',
    label: 'Email',
    accessor: 'email',
    width: '200px',
    sortable: true,
    defaultVisible: false
  },
  {
    id: 'phone',
    label: 'Phone',
    accessor: 'phone',
    width: '140px',
    sortable: true,
    defaultVisible: false
  },
  {
    id: 'createdAt',
    label: 'Created',
    accessor: 'createdAt',
    width: '120px',
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
    id: 'updatedAt',
    label: 'Updated',
    accessor: 'updatedAt',
    width: '120px',
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
  }
];

// Register the contacts surface
registerSurface('contacts', CONTACTS_COLUMNS);

export default CONTACTS_COLUMNS;
