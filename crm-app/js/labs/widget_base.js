export function renderWidgetShell(container, spec = {}) {
  const {
    id,
    title,
    description,
    subtitle,
    insightText,
    size,
    status = 'ok',
    emptyMessage = 'No data yet',
    errorMessage = 'Something went wrong',
    debugFootnote,
    actions,
    metaStatus,
    labsStatus,
    count,
    shown
  } = spec;

  const fallbackTitle = id ? id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').trim() : 'Widget';
  const resolvedTitle = title || fallbackTitle;
  const resolvedDescription = description || subtitle;
  const badgeStatus = metaStatus || labsStatus;

  const shell = document.createElement('div');
  shell.className = 'labs-widget';
  if (id) {
    shell.setAttribute('data-widget-id', id);
  }
  if (size) {
    shell.classList.add(`labs-widget--${size}`);
  }
  if (status) {
    shell.classList.add(`labs-widget--${status}`);
  }

  const header = document.createElement('div');
  header.className = 'labs-widget__header';

  // --- LEFT: Icon + Title/Subtitle ---
  const headerLeft = document.createElement('div');
  headerLeft.className = 'labs-widget__header-left';

  // Icon Badge (if provided)
  if (spec.icon) {
    const iconEl = document.createElement('div');
    iconEl.className = 'labs-widget__icon';
    iconEl.innerHTML = spec.icon;
    headerLeft.appendChild(iconEl);
  }

  // Text Column (Title + Subtitle)
  const textCol = document.createElement('div');
  textCol.className = 'labs-widget__header-text';

  const titleEl = document.createElement('h3');
  titleEl.className = 'labs-widget__title';
  titleEl.textContent = resolvedTitle || '';
  textCol.appendChild(titleEl);

  if (resolvedDescription) {
    const descEl = document.createElement('div');
    descEl.className = 'labs-widget__subtitle';
    descEl.textContent = resolvedDescription;
    textCol.appendChild(descEl);
  }

  if (badgeStatus === 'experimental') {
    const expBadge = document.createElement('span');
    expBadge.className = 'labs-widget__badge labs-widget__badge--experimental';
    expBadge.textContent = 'Experimental';
    // Append to title or text col? Let's add it to text col for now, 
    // or maybe title row if we want it inline. Text col is safer for layout.
    textCol.appendChild(expBadge);
  }

  headerLeft.appendChild(textCol);
  header.appendChild(headerLeft);

  // --- RIGHT: Insight/Tools + Count + Actions ---
  const headerRight = document.createElement('div');
  headerRight.className = 'labs-widget__header-right';

  if (insightText) {
    // Insight can be a tooltip or small text. For now, let's keep it if it was used,
    // but maybe more subtle.
    const insightEl = document.createElement('div');
    insightEl.className = 'labs-insight';
    insightEl.textContent = insightText;
    headerRight.appendChild(insightEl);
  }

  if (typeof count === 'number') {
    const countBadge = document.createElement('span');
    countBadge.className = 'labs-widget__count';
    // If we have a 'shown' vs 'total', we can show nicely?
    // Dashboard usually just shows the total count in a pill.
    countBadge.textContent = count;
    headerRight.appendChild(countBadge);
  }

  if (Array.isArray(actions) && actions.length) {
    const actionGroup = document.createElement('div');
    actionGroup.className = 'labs-action-group';

    actions.forEach((action) => {
      if (!action || typeof action.onClick !== 'function') return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'labs-action';
      if (action.id) {
        btn.dataset.actionId = action.id;
      }
      if (action.variant === 'subtle') {
        btn.classList.add('labs-action--subtle');
      }
      btn.textContent = action.label || 'Action';
      btn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        action.onClick(evt);
      });
      actionGroup.appendChild(btn);
    });
    headerRight.appendChild(actionGroup);
  }

  header.appendChild(headerRight);

  shell.appendChild(header);

  const body = document.createElement('div');
  body.className = 'labs-widget__body';
  shell.appendChild(body);
  shell._labsBody = body;

  if (debugFootnote) {
    const footnote = document.createElement('div');
    footnote.className = 'labs-widget__footnote';
    footnote.textContent = debugFootnote;
    shell.appendChild(footnote);
  }

  container.appendChild(shell);

  applyState(body, status, { emptyMessage, errorMessage });

  return shell;
}

export function renderWidgetBody(shellEl, bodyRenderer) {
  const body = shellEl?._labsBody || shellEl?.querySelector?.('.labs-widget__body');
  if (!body) return null;

  if (body.dataset.state && body.dataset.state !== 'ok') {
    return body;
  }

  try {
    body.dataset.state = 'ok';
    const rendered = bodyRenderer?.(body);
    if (rendered instanceof HTMLElement) {
      body.innerHTML = '';
      body.appendChild(rendered);
    } else if (typeof rendered === 'string') {
      body.innerHTML = rendered;
    }
  } catch (err) {
    console.error('[labs] widget render failed', err);
    applyState(body, 'error', { errorMessage: err?.message || 'Unable to render widget' });
    shellEl?.classList?.add?.('labs-widget--error');
  }

  return body;
}

function applyState(bodyEl, status, messages) {
  if (!bodyEl) return;

  bodyEl.dataset.state = status;

  if (status === 'loading') {
    bodyEl.innerHTML = '<div class="labs-widget__state labs-widget__state--loading"><span class="labs-spinner"></span> Loading</div>';
  } else if (status === 'empty') {
    bodyEl.innerHTML = `<div class="labs-widget__state labs-widget__state--empty">${messages.emptyMessage || 'No data available'}</div>`;
  } else if (status === 'error') {
    bodyEl.innerHTML = `<div class="labs-widget__state labs-widget__state--error">${messages.errorMessage || 'Something went wrong'}</div>`;
  }
}
