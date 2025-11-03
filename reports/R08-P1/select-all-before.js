const input = doc.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('data-ui', 'row-check-all');
    input.setAttribute('data-role', 'select-all');
    input.setAttribute('aria-label', 'Select all');
    if(typeof targetCell.insertBefore === 'function'){
      targetCell.insertBefore(input, targetCell.firstChild || null);
    }else if(typeof targetCell.appendChild === 'function'){
      targetCell.appendChild(input);
    }
    wireSelectAllForTable(table);