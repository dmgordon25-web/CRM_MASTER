/* P6c: Calendar export wiring (idempotent) */
(function(){
  if (window.__CAL_EXPORTS_V2__) return;
  window.__CAL_EXPORTS_V2__ = true;

  const SELECTOR_ICS = '[data-ui="calendar-export-ics"]';
  const SELECTOR_CSV = '[data-ui="calendar-export-csv"]';
  const CSV_HEADER = ['Date','Type','Title','Details','Loan','Status','Source'];

  function safeEvents(){
    const api = window.CalendarAPI;
    if (!api || typeof api.visibleEvents !== 'function') return [];
    let events = [];
    try {
      events = api.visibleEvents();
    } catch (err) {
      if (console && console.warn) console.warn('calendar exports visibleEvents failed', err);
      events = [];
    }
    if (!Array.isArray(events)) return [];
    return events.map((ev, index) => {
      if (!ev) return null;
      const date = ev.date instanceof Date ? new Date(ev.date.getTime()) : new Date(ev.date);
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
      date.setHours(0, 0, 0, 0);
      const source = ev.source && typeof ev.source === 'object'
        ? {
            entity: String(ev.source.entity || ''),
            id: String(ev.source.id || ''),
            field: String(ev.source.field || '')
          }
        : null;
      const baseUid = ev.uid || `${ev.type || 'event'}:${date.getTime()}:${index}`;
      return {
        uid: String(baseUid),
        type: String(ev.type || ''),
        title: String(ev.title || 'CRM Event'),
        subtitle: String(ev.subtitle || ''),
        status: String(ev.status || ''),
        hasLoan: !!ev.hasLoan,
        loanKey: String(ev.loanKey || ''),
        loanLabel: String(ev.loanLabel || ''),
        date,
        source
      };
    }).filter(Boolean);
  }

  function describeSource(source){
    if (!source) return '';
    const entity = source.entity ? String(source.entity) : '';
    const id = source.id ? String(source.id) : '';
    if (!entity && !id) return '';
    return entity && id ? `${entity}:${id}` : (entity || id);
  }

  function buildIcsPayload(events){
    return events.map((ev, index) => {
      const uid = ev.uid || `${ev.type || 'event'}:${index}`;
      const details = [];
      if (ev.subtitle) details.push(ev.subtitle);
      if (ev.status) details.push(`Status: ${ev.status}`);
      if (ev.hasLoan && (ev.loanLabel || ev.loanKey)) {
        details.push(`Loan: ${ev.loanLabel || ev.loanKey}`);
      }
      return {
        id: uid,
        title: ev.title || 'CRM Event',
        desc: details.join(' • '),
        location: '',
        start: new Date(ev.date.getTime()),
        end: null,
        allDay: true
      };
    });
  }

  function triggerDownload(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadCsv(events){
    const rows = [CSV_HEADER.join(',')];
    const esc = (value) => {
      const str = String(value ?? '');
      if (/[,"\n]/.test(str)){
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const formatLocalDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    for (const ev of events){
      rows.push([
        formatLocalDate(ev.date),
        ev.type,
        ev.title,
        ev.subtitle,
        ev.hasLoan ? (ev.loanLabel || ev.loanKey) : '',
        ev.status,
        describeSource(ev.source)
      ].map(esc).join(','));
    }
    const csv = rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, 'calendar-export.csv');
  }

  function handleIcs(){
    const events = safeEvents();
    const payload = buildIcsPayload(events);
    const build = window.CRM_ICS && typeof window.CRM_ICS.buildICS === 'function'
      ? window.CRM_ICS.buildICS.bind(window.CRM_ICS)
      : null;
    const download = window.CRM_ICS && typeof window.CRM_ICS.downloadICS === 'function'
      ? window.CRM_ICS.downloadICS.bind(window.CRM_ICS)
      : null;
    if (build && download){
      const ics = build(payload);
      download('calendar-export.ics', ics);
      return;
    }
    const head = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';
    triggerDownload(new Blob([head], { type: 'text/calendar;charset=utf-8' }), 'calendar-export.ics');
  }

  function handleCsv(){
    const events = safeEvents();
    downloadCsv(events);
  }

  function bind(selector, handler){
    const node = document.querySelector(selector);
    if (!node) return;
    if (node.dataset.calendarExportBound === '1') return;
    node.dataset.calendarExportBound = '1';
    node.addEventListener('click', (evt) => {
      evt.preventDefault();
      handler();
    });
  }

  function ensureButtons(){
    bind(SELECTOR_ICS, handleIcs);
    bind(SELECTOR_CSV, handleCsv);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ensureButtons, { once:true });
  }else{
    ensureButtons();
  }

  document.addEventListener('calendar:exports:ready', ensureButtons);
  document.addEventListener('app:view:changed', ensureButtons);

  window.CalendarExports = Object.assign(window.CalendarExports || {}, {
    ensureButtons,
    getVisibleEvents: safeEvents,
    downloadIcs: handleIcs,
    downloadCsv: () => downloadCsv(safeEvents())
  });

  document.dispatchEvent(new CustomEvent('calendar:exports:ready'));
})();
