/**
 * CSV Export for Tables
 * Exports table data to CSV format using only visible columns
 */

import { getVisibleColumns } from './registry.js';

// UTF-8 BOM for Excel compatibility
const CSV_BOM = '\ufeff';

/**
 * Export data to CSV
 * @param {string} surface - Surface identifier
 * @param {Array} records - Data records to export
 * @param {string} filename - Optional filename (defaults to surface-export-YYYYMMDD-HHMM.csv)
 */
export function exportToCSV(surface, records, filename) {
  if (!Array.isArray(records) || records.length === 0) {
    console.warn('[csv-export] No records to export');
    return;
  }

  const columns = getVisibleColumns(surface);
  if (!columns.length) {
    console.warn('[csv-export] No visible columns');
    return;
  }

  const csv = generateCSV(columns, records);
  const finalFilename = filename || generateFilename(surface);
  downloadCSV(csv, finalFilename);
}

/**
 * Generate CSV content from columns and records
 * @param {Array} columns - Column definitions
 * @param {Array} records - Data records
 * @returns {string} CSV content with BOM
 */
function generateCSV(columns, records) {
  const rows = [];

  // Header row
  const headers = columns.map(col => escapeCSVValue(col.label));
  rows.push(headers.join(','));

  // Data rows
  records.forEach(record => {
    const values = columns.map(col => {
      const value = getColumnValue(record, col);
      const formatted = formatValue(value, col);
      return escapeCSVValue(formatted);
    });
    rows.push(values.join(','));
  });

  return CSV_BOM + rows.join('\r\n');
}

/**
 * Get value from record using column accessor
 * @param {Object} record - Data record
 * @param {Object} column - Column definition
 * @returns {*} Column value
 */
function getColumnValue(record, column) {
  if (!record || !column) return null;

  if (typeof column.accessor === 'function') {
    try {
      return column.accessor(record);
    } catch (err) {
      console.warn('[csv-export] Accessor function failed', err);
      return null;
    }
  }

  if (typeof column.accessor === 'string') {
    return record[column.accessor];
  }

  if (column.id && typeof record[column.id] !== 'undefined') {
    return record[column.id];
  }

  return null;
}

/**
 * Format value for CSV output
 * @param {*} value - Raw value
 * @param {Object} column - Column definition
 * @returns {string} Formatted value
 */
function formatValue(value, column) {
  if (value == null) return '';

  // Use column's format function if available
  if (column.format && typeof column.format === 'function') {
    try {
      return String(column.format(value));
    } catch (err) {
      console.warn('[csv-export] Format function failed', err);
      return String(value);
    }
  }

  // Handle dates
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle numbers
  if (typeof value === 'number') {
    return String(value);
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Default to string
  return String(value);
}

/**
 * Escape CSV value (handle quotes and commas)
 * @param {string} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeCSVValue(value) {
  if (value == null) return '';

  const str = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Generate filename with timestamp
 * @param {string} surface - Surface identifier
 * @returns {string} Filename
 */
function generateFilename(surface) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const safeSurface = surface.replace(/[^a-z0-9]/gi, '-');
  return `${safeSurface}-export-${year}${month}${day}-${hours}${minutes}.csv`;
}

/**
 * Trigger CSV download
 * @param {string} csvContent - CSV content
 * @param {string} filename - Filename
 */
function downloadCSV(csvContent, filename) {
  if (typeof document === 'undefined') {
    console.warn('[csv-export] Document not available');
    return;
  }

  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up URL object
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        // Ignore cleanup errors
      }
    }, 100);
  } catch (err) {
    console.warn('[csv-export] Download failed', err);
  }
}

/**
 * Create a CSV export button
 * @param {string} surface - Surface identifier
 * @param {Function} getRecords - Function that returns records to export
 * @returns {HTMLButtonElement}
 */
export function createCSVExportButton(surface, getRecords) {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-ui', 'export-csv');
  button.textContent = 'Export CSV';
  button.className = 'btn';

  button.addEventListener('click', async (event) => {
    event.preventDefault();

    try {
      const records = typeof getRecords === 'function' ? await getRecords() : [];
      exportToCSV(surface, records);
    } catch (err) {
      console.warn('[csv-export] Export failed', err);
      if (typeof window !== 'undefined' && window.Toast && typeof window.Toast.error === 'function') {
        window.Toast.error('CSV export failed');
      }
    }
  });

  return button;
}
