export function renderWidgetShell(container, spec = {}) {
  const {
    id,
    title,
    subtitle,
    insightText,
    size,
    status = 'ok',
    emptyMessage = 'No data yet',
    errorMessage = 'Something went wrong',
    debugFootnote
  } = spec;

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

  const titleEl = document.createElement('h3');
  titleEl.className = 'labs-widget__title';
  titleEl.textContent = title || '';
  header.appendChild(titleEl);

  if (subtitle) {
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'labs-widget__subtitle';
    subtitleEl.textContent = subtitle;
    header.appendChild(subtitleEl);
  }

  if (insightText) {
    const insightEl = document.createElement('div');
    insightEl.className = 'labs-insight';
    insightEl.textContent = insightText;
    header.appendChild(insightEl);
  }

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
