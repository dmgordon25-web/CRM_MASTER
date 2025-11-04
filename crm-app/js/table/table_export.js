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
    const rows = [];
    const BOM = '\ufeff'; // UTF-8 BOM for Excel

    // Get headers
    const headerRow = table.querySelector('thead tr');
    if (headerRow) {
      const headers = Array.from(headerRow.querySelectorAll('th'))
        .filter(th => {
          // Skip checkbox columns
          const checkbox = th.querySelector('input[type="checkbox"]');
          return !checkbox;
        })
        .map(th => {
          // Get button text if it exists, otherwise cell text
          const btn = th.querySelector('.sort-btn');
          const text = btn ? btn.textContent.replace(/[↕↑↓]/g, '').trim() : th.textContent.trim();
          return escapeCSV(text);
        });
      
      if (headers.length > 0) {
        rows.push(headers.join(','));
      }
    }

    // Get data rows
    const dataRows = table.querySelectorAll('tbody tr:not(.empty-row)');
    dataRows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'))
        .filter((td, index) => {
          // Skip checkbox columns (usually first column)
          const checkbox = td.querySelector('input[type="checkbox"]');
          return !checkbox;
        })
        .map(td => {
          // Get text content, handling links
          const link = td.querySelector('a');
          let text = link ? link.textContent.trim() : td.textContent.trim();
          
          // Clean up extra whitespace
          text = text.replace(/\s+/g, ' ').trim();
          
          return escapeCSV(text);
        });
      
      if (cells.length > 0) {
        rows.push(cells.join(','));
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
