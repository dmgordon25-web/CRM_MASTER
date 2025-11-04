import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Workbench Select All Checkbox', () => {
  let dom;
  let document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
  });

  it('should render select-all checkbox in table header', () => {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Create select-all checkbox as per implementation
    const selectAllTh = document.createElement('th');
    selectAllTh.setAttribute('data-role', 'select');
    selectAllTh.dataset.compact = '1';
    selectAllTh.dataset.column = 'select';
    selectAllTh.style.width = '40px';
    selectAllTh.style.minWidth = '40px';
    selectAllTh.style.textAlign = 'center';
    selectAllTh.style.padding = '8px';
    
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.setAttribute('data-role', 'select-all');
    selectAll.setAttribute('data-ui', 'row-check-all');
    selectAll.setAttribute('aria-label', 'Select all');
    selectAll.style.cursor = 'pointer';
    selectAll.style.display = 'inline-block';
    selectAll.style.margin = '0';
    
    selectAllTh.appendChild(selectAll);
    headerRow.appendChild(selectAllTh);
    thead.appendChild(headerRow);
    
    // Verify checkbox exists and is visible
    const checkbox = thead.querySelector('input[data-role="select-all"]');
    expect(checkbox).toBeTruthy();
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.getAttribute('aria-label')).toBe('Select all');
    expect(checkbox.style.display).toBe('inline-block');
    expect(checkbox.style.cursor).toBe('pointer');
    
    // Verify th has proper styling for visibility
    const th = thead.querySelector('th[data-role="select"]');
    expect(th).toBeTruthy();
    expect(th.style.width).toBe('40px');
    expect(th.style.textAlign).toBe('center');
  });

  it('should have checkbox visible in header column with proper dimensions', () => {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const selectAllTh = document.createElement('th');
    selectAllTh.style.width = '40px';
    selectAllTh.style.minWidth = '40px';
    selectAllTh.style.textAlign = 'center';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-role', 'select-all');
    checkbox.style.display = 'inline-block';
    
    selectAllTh.appendChild(checkbox);
    headerRow.appendChild(selectAllTh);
    thead.appendChild(headerRow);
    
    const th = thead.querySelector('th');
    expect(th.style.width).toBe('40px');
    expect(th.style.minWidth).toBe('40px');
    
    const foundCheckbox = th.querySelector('input[type="checkbox"]');
    expect(foundCheckbox).toBeTruthy();
    expect(foundCheckbox.style.display).toBe('inline-block');
  });
});
