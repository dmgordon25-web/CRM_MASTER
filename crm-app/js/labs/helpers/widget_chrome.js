export function renderWidgetChrome({ widgetId, title, countText, bodyHtml, footerHtml, helpId } = {}) {
  const shell = document.createElement('div');
  shell.className = 'labs-widget labs-widget--chrome';
  if (widgetId) {
    shell.setAttribute('data-widget-id', widgetId);
  }
  if (helpId) {
    shell.setAttribute('data-help', helpId);
  }

  const header = document.createElement('div');
  header.className = 'labs-widget-chrome__header';

  const titleEl = document.createElement('div');
  titleEl.className = 'labs-widget-chrome__title';
  titleEl.textContent = title || '';
  header.appendChild(titleEl);

  const meta = document.createElement('div');
  meta.className = 'labs-widget-chrome__meta';

  if (helpId) {
    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'labs-widget-chrome__help';
    help.setAttribute('data-help', helpId);
    help.setAttribute('aria-label', 'Help');
    help.textContent = '?';
    meta.appendChild(help);
  }

  if (countText !== undefined && countText !== null && countText !== '') {
    const count = document.createElement('span');
    count.className = 'labs-widget-chrome__count';
    count.textContent = countText;
    meta.appendChild(count);
  }

  header.appendChild(meta);
  shell.appendChild(header);

  const body = document.createElement('div');
  body.className = 'labs-widget__body labs-widget-chrome__body';
  if (bodyHtml == null) {
    body.innerHTML = '<div class="labs-widget__state labs-widget__state--empty">No data available</div>';
    body.dataset.state = 'empty';
  } else {
    body.innerHTML = bodyHtml;
  }
  shell.appendChild(body);
  shell._labsBody = body;

  if (footerHtml) {
    const footer = document.createElement('div');
    footer.className = 'labs-widget-chrome__footer';
    footer.innerHTML = footerHtml;
    shell.appendChild(footer);
  }

  return shell;
}
