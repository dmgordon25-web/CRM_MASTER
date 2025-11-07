// Universal Search - Dynamic name search for contacts and partners
(function() {
  if (!window || typeof document === 'undefined') return;

  const DEBOUNCE_MS = 200;
  let debounceTimer = null;
  let searchInput = null;
  let resultsContainer = null;
  let currentResults = [];

  function init() {
    searchInput = document.getElementById('universal-search');
    resultsContainer = document.getElementById('universal-search-results');
    
    if (!searchInput || !resultsContainer) return;

    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', handleSearchFocus);
    searchInput.addEventListener('keydown', handleKeydown);
    
    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
        hideResults();
      }
    });
  }

  function handleSearchInput(e) {
    const query = e.target.value.trim();
    
    clearTimeout(debounceTimer);
    
    if (!query || query.length < 2) {
      hideResults();
      return;
    }

    debounceTimer = setTimeout(() => {
      performSearch(query);
    }, DEBOUNCE_MS);
  }

  function handleSearchFocus() {
    const query = searchInput.value.trim();
    if (query.length >= 2) {
      performSearch(query);
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      hideResults();
      searchInput.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusFirstResult();
    }
  }

  async function performSearch(query) {
    try {
      // Get data from IndexedDB
      await openDB();
      const [contacts, partners] = await Promise.all([
        dbGetAll('contacts'),
        dbGetAll('partners')
      ]);

      const queryLower = query.toLowerCase();
      currentResults = [];

      // Search contacts
      (contacts || []).forEach(contact => {
        if (!contact) return;
        
        const firstName = (contact.first || '').toLowerCase();
        const lastName = (contact.last || '').toLowerCase();
        const fullName = `${contact.first || ''} ${contact.last || ''}`.toLowerCase().trim();
        const email = (contact.email || '').toLowerCase();
        const phone = (contact.phone || '').toLowerCase();
        
        if (firstName.includes(queryLower) ||
            lastName.includes(queryLower) ||
            fullName.includes(queryLower) ||
            email.includes(queryLower) ||
            phone.includes(queryLower)) {
          currentResults.push({
            type: 'contact',
            id: contact.id,
            name: `${contact.first || ''} ${contact.last || ''}`.trim() || 'Unnamed Contact',
            subtitle: [contact.email, contact.phone, contact.stage].filter(Boolean).join(' • '),
            record: contact
          });
        }
      });

      // Search partners
      (partners || []).forEach(partner => {
        if (!partner) return;
        
        const name = (partner.name || '').toLowerCase();
        const company = (partner.company || '').toLowerCase();
        const email = (partner.email || '').toLowerCase();
        const phone = (partner.phone || '').toLowerCase();
        
        if (name.includes(queryLower) ||
            company.includes(queryLower) ||
            email.includes(queryLower) ||
            phone.includes(queryLower)) {
          currentResults.push({
            type: 'partner',
            id: partner.id,
            name: partner.name || partner.company || 'Unnamed Partner',
            subtitle: [partner.company, partner.tier, partner.email].filter(Boolean).join(' • '),
            record: partner
          });
        }
      });

      displayResults(currentResults, query);
    } catch (error) {
      console.error('Universal search error:', error);
      hideResults();
    }
  }

  function displayResults(results, query) {
    if (!resultsContainer) return;

    if (results.length === 0) {
      resultsContainer.innerHTML = `
        <div style="padding:16px;text-align:center;color:#64748b;">
          No results found for "${escapeHtml(query)}"
        </div>
      `;
      resultsContainer.style.display = 'block';
      return;
    }

    const contactResults = results.filter(r => r.type === 'contact').slice(0, 5);
    const partnerResults = results.filter(r => r.type === 'partner').slice(0, 5);

    let html = '';

    if (contactResults.length > 0) {
      html += '<div style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">Contacts</div>';
      contactResults.forEach(result => {
        html += createResultItem(result);
      });
    }

    if (partnerResults.length > 0) {
      html += '<div style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-top:4px;">Partners</div>';
      partnerResults.forEach(result => {
        html += createResultItem(result);
      });
    }

    const totalCount = results.length;
    const displayedCount = contactResults.length + partnerResults.length;
    if (totalCount > displayedCount) {
      html += `<div style="padding:12px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">
        +${totalCount - displayedCount} more results
      </div>`;
    }

    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';

    // Attach click handlers
    resultsContainer.querySelectorAll('[data-result-id]').forEach(el => {
      el.addEventListener('click', () => {
        const resultId = el.getAttribute('data-result-id');
        const resultType = el.getAttribute('data-result-type');
        openRecord(resultId, resultType);
      });
    });
  }

  function createResultItem(result) {
    const icon = result.type === 'contact' ? '👤' : '🤝';
    const escapedName = escapeHtml(result.name);
    const escapedSubtitle = escapeHtml(result.subtitle);
    
    return `
      <div class="universal-search-result" data-result-id="${escapeHtml(result.id)}" data-result-type="${result.type}" 
           style="padding:12px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background 0.15s;"
           onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:20px;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapedName}</div>
            <div style="font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapedSubtitle}</div>
          </div>
        </div>
      </div>
    `;
  }

  function openRecord(id, type) {
    hideResults();
    searchInput.value = '';

    if (type === 'contact') {
      if (window.renderContactModal && typeof window.renderContactModal === 'function') {
        window.renderContactModal(id);
      }
    } else if (type === 'partner') {
      if (window.openPartnerEditModal && typeof window.openPartnerEditModal === 'function') {
        window.openPartnerEditModal(id);
      }
    }
  }

  function hideResults() {
    if (resultsContainer) {
      resultsContainer.style.display = 'none';
    }
  }

  function focusFirstResult() {
    if (!resultsContainer) return;
    const firstResult = resultsContainer.querySelector('[data-result-id]');
    if (firstResult) {
      firstResult.click();
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also initialize on route change
  if (window.RenderGuard && typeof window.RenderGuard.registerHook === 'function') {
    window.RenderGuard.registerHook(init);
  }

  // Expose for debugging
  window.__UNIVERSAL_SEARCH__ = {
    performSearch,
    hideResults,
    getCurrentResults: () => currentResults
  };
})();
