// Table Export Handler - Simple CSV export from HTML tables
(function() {
  if (!window || typeof document === 'undefined') return;

  function init() {
    // Find all export buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-export-table]');
      if (!btn) return;
      
      e.preventDefault();
      const tableName = btn.getAttribute('data-export-table');
      exportTable(tableName);
    });
  }

  async function exportTable(tableName) {
    try {
      let table, filename;
      switch(tableName) {
        case 'pipeline':
          table = document.getElementById('tbl-pipeline');
          filename = 'pipeline-export';
          break;
        case 'clients':
          table = document.getElementById('tbl-clients');
          filename = 'clients-export';
          break;
        case 'longshots':
          table = document.getElementById('tbl-longshots');
          filename = 'leads-export';
          break;
        case 'partners':
          table = document.getElementById('tbl-partners');
          filename = 'partners-export';
          break;
        default:
          console.warn('Unknown table:', tableName);
          return;
      }

      if (!table) {
        console.warn('Table not found:', tableName);
        return;
      }

      await waitForTableLayout();

      if (!table.isConnected) {
        console.warn('Table detached before export:', tableName);
        return;
      }

      const csv = tableToCSV(table);
      downloadCSV(csv, filename);

      if (window.Toast && typeof window.Toast.success === 'function') {
        window.Toast.success('CSV exported successfully');
      }
    } catch (error) {
      console.error('Export error:', error);
      if (window.Toast && typeof window.Toast.error === 'function') {
        window.Toast.error('Export failed');
      }
    }
  }

  function tableToCSV(table) {
    const BOM = '\ufeff'; // UTF-8 BOM for Excel
    const rows = [];

    const { headers, visibility } = extractHeaders(table);
    if (headers.length > 0) {
      rows.push(headers.map(escapeCSV).join(','));
    }

    const dataRows = table.querySelectorAll('tbody tr:not(.empty-row)');
    dataRows.forEach((row) => {
      if (!isRowVisible(row)) return;
      const values = extractRowValues(row, visibility);
      if (values.length > 0) {
        rows.push(values.map(escapeCSV).join(','));
      }
    });

    return BOM + rows.join('\r\n');
  }

  function escapeCSV(text) {
    if (text == null) return '';

    const str = String(text);
    
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
  }

  function waitForTableLayout() {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve);
      });
    });
  }

  function extractHeaders(table) {
    const headers = [];
    const visibility = [];
    if (!table || !table.tHead) return { headers, visibility: null };

    const headerRow = table.tHead.rows && table.tHead.rows[0]
      ? table.tHead.rows[0]
      : table.querySelector('thead tr');

    if (!headerRow) return { headers, visibility: null };

    let columnIndex = 0;
    Array.from(headerRow.cells || headerRow.querySelectorAll('th')).forEach((cell) => {
      const span = Math.max(1, cell.colSpan || 1);
      const include = shouldIncludeHeaderCell(cell);
      for (let offset = 0; offset < span; offset += 1) {
        visibility[columnIndex + offset] = include;
      }
      if (include) {
        headers.push(extractHeaderLabel(cell));
      }
      columnIndex += span;
    });

    return { headers, visibility };
  }

  function extractHeaderLabel(cell) {
    if (!cell) return '';
    const button = cell.querySelector('.sort-btn');
    const source = button || cell;
    const raw = source.textContent || '';
    return raw.replace(/[↕↑↓]/g, '').replace(/\s+/g, ' ').trim();
  }

  function extractRowValues(row, visibility) {
    const values = [];
    if (!row || !row.cells) return values;

    let columnIndex = 0;
    Array.from(row.cells).forEach((cell) => {
      const span = Math.max(1, cell.colSpan || 1);
      if (shouldIncludeDataCell(cell, visibility, columnIndex, span)) {
        values.push(extractCellText(cell));
      }
      columnIndex += span;
    });

    return values;
  }

  function extractCellText(cell) {
    if (!cell) return '';
    const link = cell.querySelector('a');
    const target = link || cell;
    const raw = target.textContent || '';
    return raw.replace(/\s+/g, ' ').trim();
  }

  function shouldIncludeHeaderCell(cell) {
    if (!cell) return false;
    if (isSelectionCell(cell)) return false;
    if (isCellEffectivelyHidden(cell)) return false;
    return true;
  }

  function shouldIncludeDataCell(cell, visibility, columnIndex, span) {
    if (!cell) return false;
    if (isSelectionCell(cell)) return false;
    if (isCellEffectivelyHidden(cell)) return false;

    if (!visibility || !visibility.length) {
      return true;
    }

    for (let offset = 0; offset < span; offset += 1) {
      if (visibility[columnIndex + offset]) {
        return true;
      }
    }

    return false;
  }

  function isSelectionCell(cell) {
    if (!cell) return false;
    if (cell.querySelector('input[type="checkbox"]')) return true;
    const role = cell.getAttribute && cell.getAttribute('data-role');
    if (role === 'select') return true;
    const dataset = cell.dataset || {};
    if (dataset.role === 'select') return true;
    if (dataset.column === 'select') return true;
    return false;
  }

  function isRowVisible(row) {
    if (!row) return false;
    if (row.hidden) return false;
    const attrHidden = row.getAttribute ? row.getAttribute('hidden') : null;
    if (attrHidden === '' || attrHidden === 'true') return false;
    if (row.getAttribute && row.getAttribute('aria-hidden') === 'true') return false;
    const style = safeGetComputedStyle(row);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    if (typeof row.getClientRects === 'function' && row.getClientRects().length === 0) return false;
    return true;
  }

  function isCellEffectivelyHidden(cell) {
    if (!cell) return true;
    if (cell.hidden) return true;
    const attrHidden = cell.getAttribute ? cell.getAttribute('hidden') : null;
    if (attrHidden === '' || attrHidden === 'true') return true;
    if (cell.getAttribute && cell.getAttribute('aria-hidden') === 'true') return true;
    if (cell.matches) {
      if (cell.matches('[data-column-visible="0"], [data-column-hidden="1"], [data-hidden="1"]')) {
        return true;
      }
    }
    const style = safeGetComputedStyle(cell);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return true;
    if (cell.offsetWidth === 0 && cell.offsetHeight === 0 && cell.getClientRects && cell.getClientRects().length === 0) {
      return true;
    }
    return false;
  }

  function safeGetComputedStyle(element) {
    if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
      return null;
    }
    try {
      return window.getComputedStyle(element);
    } catch (_err) {
      return null;
    }
  }

  function downloadCSV(csvContent, filename) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const fullFilename = `${filename}-${year}${month}${day}-${hours}${minutes}.csv`;

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fullFilename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch (err) {
          // Ignore cleanup errors
        }
      }, 100);
    } catch (err) {
      console.error('Download failed:', err);
      throw err;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.__TABLE_EXPORT__ = {
    exportTable,
    tableToCSV
  };
})();
