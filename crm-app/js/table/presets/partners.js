/**
 * Partners table column schema
 */

import { registerSurface } from '../registry.js';

const PARTNERS_COLUMNS = [
  {
    id: 'name',
    label: 'Name',
    accessor: 'name',
    width: 'clamp(220px, 32vw, 420px)',
    sortable: true,
    defaultVisible: true
  },
  {
    id: 'company',
    label: 'Company',
    accessor: 'company',
    width: '200px',
    sortable: true,
    defaultVisible: true
  },
  {
    id: 'tier',
    label: 'Tier',
    accessor: 'tier',
    width: '120px',
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
    id: 'lastTouch',
    label: 'Last Touch',
    accessor: 'lastTouch',
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

// Register the partners surface
registerSurface('partners', PARTNERS_COLUMNS);

export default PARTNERS_COLUMNS;
