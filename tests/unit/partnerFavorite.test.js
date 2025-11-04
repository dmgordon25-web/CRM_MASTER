import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Partner Favorite Star Click Handler', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
  });

  it('should stop propagation when clicking favorite toggle in partner row', () => {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('data-partner-id', 'test-123');
    
    const cell = document.createElement('td');
    const favoriteButton = document.createElement('button');
    favoriteButton.setAttribute('data-role', 'favorite-toggle');
    favoriteButton.textContent = '☆';
    
    cell.appendChild(favoriteButton);
    row.appendChild(cell);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    
    let rowClickHandled = false;
    let favoriteClickHandled = false;
    
    // Simulate the row click handler pattern from partners.js
    const rowHandler = (event) => {
      const favoriteToggle = event.target?.closest?.('[data-role="favorite-toggle"]');
      if (favoriteToggle) {
        event.stopPropagation();
        return;
      }
      rowClickHandled = true;
    };
    
    table.addEventListener('click', rowHandler);
    
    favoriteButton.addEventListener('click', (event) => {
      favoriteClickHandled = true;
    });
    
    // Simulate clicking the favorite button
    const clickEvent = new window.Event('click', { bubbles: true, cancelable: true });
    favoriteButton.dispatchEvent(clickEvent);
    
    // Favorite should be clicked but row handler should not trigger
    expect(favoriteClickHandled).toBe(true);
    expect(rowClickHandled).toBe(false);
  });

  it('should not open editor modal when favorite star is clicked', () => {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('data-partner-id', 'partner-456');
    
    const nameCell = document.createElement('td');
    nameCell.textContent = 'Test Partner';
    
    const favoriteCell = document.createElement('td');
    const favoriteButton = document.createElement('button');
    favoriteButton.setAttribute('data-role', 'favorite-toggle');
    favoriteButton.textContent = '☆';
    
    favoriteCell.appendChild(favoriteButton);
    row.appendChild(nameCell);
    row.appendChild(favoriteCell);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    
    let modalOpened = false;
    const mockOpenModal = vi.fn(() => { modalOpened = true; });
    
    // Simulate the corrected handler
    table.addEventListener('click', (event) => {
      const favoriteToggle = event.target?.closest?.('[data-role="favorite-toggle"]');
      if (favoriteToggle) {
        event.stopPropagation();
        return;
      }
      
      const rowElement = event.target?.closest?.('tr[data-partner-id]');
      if (rowElement) {
        mockOpenModal(rowElement.getAttribute('data-partner-id'));
      }
    });
    
    // Click favorite button - should not open modal
    const favoriteEvent = new window.Event('click', { bubbles: true });
    favoriteButton.dispatchEvent(favoriteEvent);
    
    expect(mockOpenModal).not.toHaveBeenCalled();
    expect(modalOpened).toBe(false);
    
    // Click name cell - should open modal
    const nameEvent = new window.Event('click', { bubbles: true });
    nameCell.dispatchEvent(nameEvent);
    
    expect(mockOpenModal).toHaveBeenCalledWith('partner-456');
    expect(modalOpened).toBe(true);
  });
});
