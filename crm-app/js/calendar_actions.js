/* P6c: Calendar export wiring (idempotent) */
import { toastSoftError, toastSuccess } from './ui/toast_helpers.js';

(function(){
  if (window.__CAL_EXPORTS_V2__) return;
  window.__CAL_EXPORTS_V2__ = true;

  const SELECTOR_ICS = '[data-ui="calendar-export-ics"]';
  const SELECTOR_CSV = '[data-ui="calendar-export-csv"]';
  const CSV_HEADER = ['Date','Type','Title','Details','Loan','Status','Source'];
  const CSV_BOM = '\ufeff';

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

  function pad(number){
    return number < 10 ? `0${number}` : String(number);
  }

  function formatDateValue(date){
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    return `${y}${m}${d}`;
  }

  function escapeIcsValue(value){
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function buildFallbackIcs(payload){
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CRM//Calendar Export//EN'
    ];
    payload.forEach((item, index) => {
      if (!item || !(item.start instanceof Date) || Number.isNaN(item.start.getTime())) return;
      const uid = escapeIcsValue(item.id || `event-${index}`);
      const title = escapeIcsValue(item.title || 'CRM Event');
      const description = item.desc ? escapeIcsValue(item.desc) : '';
      const location = item.location ? escapeIcsValue(item.location) : '';
      const startDate = new Date(item.start.getTime());
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`SUMMARY:${title}`);
      if (description) lines.push(`DESCRIPTION:${description}`);
      if (location) lines.push(`LOCATION:${location}`);
      if (item.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${formatDateValue(startDate)}`);
      } else {
        lines.push(`DTSTART:${formatDateValue(startDate)}T000000`);
      }
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
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
    for (const ev of events){
      rows.push([
        ev.date.toISOString().slice(0, 10),
        ev.type,
        ev.title,
        ev.subtitle,
        ev.hasLoan ? (ev.loanLabel || ev.loanKey) : '',
        ev.status,
        describeSource(ev.source)
      ].map(esc).join(','));
    }
    const csv = `${CSV_BOM}${rows.join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, 'calendar-export.csv');
  }

  function handleIcs(){
    try {
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
      } else {
        const icsText = buildFallbackIcs(payload);
        triggerDownload(new Blob([icsText], { type: 'text/calendar;charset=utf-8' }), 'calendar-export.ics');
      }
      toastSuccess('Calendar ICS exported');
    } catch (err) {
      toastSoftError('[soft] calendar export ics failed', err, 'Unable to export calendar ICS.');
    }
  }

  function handleCsv(){
    try {
      const events = safeEvents();
      downloadCsv(events);
      toastSuccess('Calendar CSV exported');
    } catch (err) {
      toastSoftError('[soft] calendar export csv failed', err, 'Unable to export calendar CSV.');
    }
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

  const LEGEND_SELECTOR = '[data-qa="cal-legend"]';

  function ensureButtons(){
    bind(SELECTOR_ICS, handleIcs);
    bind(SELECTOR_CSV, handleCsv);
  }

  function enhanceLegend(){
    const legend = document.querySelector(LEGEND_SELECTOR);
    if(!legend) return;
    if(legend.dataset.calendarLegendBound === '1') return;
    legend.dataset.calendarLegendBound = '1';
    legend.setAttribute('role', 'list');
    legend.setAttribute('aria-label', 'Calendar legend');
    Array.from(legend.children).forEach((item) => {
      try{ item.setAttribute('role', 'listitem'); }
      catch (_err){}
    });
  }

  function handleRendered(){
    ensureButtons();
    enhanceLegend();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      ensureButtons();
      enhanceLegend();
    }, { once:true });
  }else{
    ensureButtons();
    enhanceLegend();
  }

  document.addEventListener('calendar:exports:ready', handleRendered);
  document.addEventListener('app:view:changed', handleRendered);
  document.addEventListener('calendar:rendered', handleRendered);

  window.CalendarExports = Object.assign(window.CalendarExports || {}, {
    ensureButtons,
    getVisibleEvents: safeEvents,
    downloadIcs: handleIcs,
    downloadCsv: () => downloadCsv(safeEvents())
  });

  document.dispatchEvent(new CustomEvent('calendar:exports:ready'));
})();
