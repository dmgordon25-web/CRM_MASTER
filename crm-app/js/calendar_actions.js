/* Calendar export wiring — unified ICS + CSV handlers */
(function(){
  if(window.__WIRED_CAL_EXPORTS_V2__) return;
  window.__WIRED_CAL_EXPORTS_V2__ = true;

  const exportsMetrics = window.__CALENDAR_EXPORTS__ = window.__CALENDAR_EXPORTS__ || {};
  exportsMetrics.clicks = exportsMetrics.clicks || { ics: 0, csv: 0 };

  function ensureCalendarApi(){
    window.CalendarAPI = window.CalendarAPI || {};
    return window.CalendarAPI;
  }

  function normalizeEventRecord(event){
    if(!event || typeof event !== 'object') return {
      id: '',
      title: 'Event',
      description: '',
      location: '',
      start: '',
      end: '',
      allDay: false
    };
    const id = event.id || event.eventId || event.uuid || event.key || '';
    const title = event.title || event.summary || 'Event';
    const description = event.description || event.subtitle || '';
    const location = event.location || '';
    const start = event.start || event.date || event.startDate || '';
    const end = event.end || event.endDate || start || '';
    const allDay = Boolean(event.allDay || event.isAllDay || event.fullDay);
    return { id: String(id || `${title}-${start}`), title, description, location, start, end, allDay };
  }

  function toIso(value){
    if(!value) return '';
    if(value instanceof Date){
      return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }
    const parsed = new Date(value);
    if(Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString();
  }

  function rawVisibleEvents(){
    const api = ensureCalendarApi();
    if(typeof api.visibleEvents === 'function'){
      try{
        const events = api.visibleEvents();
        if(Array.isArray(events)) return events;
      }catch (_err) {}
    }
    const scope = document.getElementById('view-calendar') || document.querySelector('[data-view="calendar"]');
    if(!scope) return [];
    const nodes = Array.from(scope.querySelectorAll('[data-event]'));
    return nodes.map(node => ({
      id: node.getAttribute('data-event-id') || node.dataset.eventId || node.id || '',
      title: node.getAttribute('data-title') || node.dataset.title || node.textContent || '',
      description: node.getAttribute('data-desc') || node.dataset.desc || '',
      location: node.getAttribute('data-location') || node.dataset.location || '',
      start: node.getAttribute('data-start') || node.dataset.start || '',
      end: node.getAttribute('data-end') || node.dataset.end || '',
      allDay: node.getAttribute('data-all-day') === 'true' || node.dataset.allDay === 'true'
    }));
  }

  function selectedIds(){
    const ids = [];
    try{
      const scoped = window.selectionService?.get?.('calendar');
      if(Array.isArray(scoped)) scoped.forEach(id => ids.push(String(id)));
    }catch (_err) {}
    try{
      const svc = window.SelectionService || window.Selection || null;
      if(svc){
        if(typeof svc.idsOf === 'function'){
          const scoped = svc.idsOf('calendar');
          if(Array.isArray(scoped)) scoped.forEach(id => ids.push(String(id)));
        } else if(typeof svc.getIds === 'function'){
          const scoped = svc.getIds();
          if(Array.isArray(scoped)) scoped.forEach(id => ids.push(String(id)));
        }
      }
    }catch (_err) {}
    if(!ids.length){
      const highlighted = Array.from(document.querySelectorAll('[data-view="calendar"] [data-event][aria-selected="true"]'));
      highlighted.forEach(node => {
        const id = node.getAttribute('data-event-id') || node.dataset.eventId;
        if(id) ids.push(String(id));
      });
    }
    return ids;
  }

  function eventsForExport(){
    const events = rawVisibleEvents();
    const picks = selectedIds();
    if(picks.length){
      const allowed = new Set(picks.map(String));
      const filtered = events.filter(ev => allowed.has(String(ev.id || ev.eventId || ev.uuid || '')));
      if(filtered.length) return filtered;
    }
    return events;
  }

  function ensureCsv(rows){
    const quote = (value) => {
      const str = value == null ? '' : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    return rows.map(row => row.map(quote).join(',')).join('\r\n');
  }

  async function exportVisibleIcs(){
    const payload = eventsForExport().map(normalizeEventRecord);
    const builder = window.CRM_ICS && typeof window.CRM_ICS.buildICS === 'function'
      ? window.CRM_ICS.buildICS.bind(window.CRM_ICS)
      : null;
    const downloader = window.CRM_ICS && typeof window.CRM_ICS.downloadICS === 'function'
      ? window.CRM_ICS.downloadICS.bind(window.CRM_ICS)
      : null;
    if(!builder){
      console.warn('Calendar ICS builder unavailable');
      return null;
    }
    const ics = builder(payload.map(ev => ({
      id: ev.id,
      title: ev.title,
      desc: ev.description,
      location: ev.location,
      start: ev.start,
      end: ev.end,
      allDay: ev.allDay
    })));
    const filename = payload.length === 1 ? `event-${payload[0].id || Date.now()}.ics` : `events-${Date.now()}.ics`;
    if(downloader){
      try{ downloader(filename, ics); }
      catch (err) { console.warn('Calendar ICS download failed', err); }
    }
    exportsMetrics.clicks.ics += 1;
    const detail = { filename, count: payload.length, ids: payload.map(ev => ev.id) };
    window.__CALENDAR_LAST_ICS__ = detail;
    exportsMetrics.lastIcs = detail;
    return detail;
  }

  async function exportVisibleCsv(){
    const events = eventsForExport().map(normalizeEventRecord);
    const headers = ['Title','Start','End','All Day','Description','Location','Id'];
    const rows = events.map(ev => [
      ev.title,
      toIso(ev.start),
      toIso(ev.end),
      ev.allDay ? 'true' : 'false',
      ev.description,
      ev.location,
      ev.id
    ]);
    if(typeof window.exportCSV === 'function'){
      try{ window.exportCSV('calendar-events.csv', headers, rows); }
      catch (err) { console.warn('Calendar CSV export failed', err); }
    }else{
      const csv = ensureCsv([headers, ...rows]);
      try{
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'calendar-events.csv';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        Promise.resolve().then(() => {
          URL.revokeObjectURL(link.href);
          link.remove();
        });
      }catch (err) { console.warn('Calendar CSV fallback failed', err); }
    }
    exportsMetrics.clicks.csv += 1;
    const detail = { headers, rows };
    window.__CALENDAR_LAST_CSV__ = detail;
    exportsMetrics.lastCsv = detail;
    return detail;
  }

  function bindButtons(){
    const view = document.getElementById('view-calendar') || document.querySelector('[data-view="calendar"]');
    if(!view) return;
    const icsBtn = view.querySelector('#cal-export-ics,[data-act="calendar:export:ics"],[data-ics-export]');
    if(icsBtn){
      icsBtn.dataset.act = 'calendar:export:ics';
      if(!icsBtn.__calendarExport){
        icsBtn.__calendarExport = true;
        icsBtn.addEventListener('click', (evt) => {
          evt.preventDefault();
          exportVisibleIcs().catch(err => console.warn('Calendar ICS click failed', err));
        });
      }
    }
    const csvBtn = view.querySelector('#cal-export,[data-act="calendar:export:csv"]');
    if(csvBtn){
      csvBtn.dataset.act = 'calendar:export:csv';
      if(!csvBtn.__calendarExport){
        csvBtn.__calendarExport = true;
        csvBtn.addEventListener('click', (evt) => {
          evt.preventDefault();
          exportVisibleCsv().catch(err => console.warn('Calendar CSV click failed', err));
        });
      }
    }
  }

  function refreshBindings(){
    try{ bindButtons(); }
    catch (err) { console.warn('Calendar export binding failed', err); }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', refreshBindings, { once: true });
  }else{
    refreshBindings();
  }
  window.RenderGuard?.registerHook?.(refreshBindings);

  const api = ensureCalendarApi();
  if(typeof api.visibleEvents !== 'function'){
    api.visibleEvents = () => eventsForExport().map(normalizeEventRecord);
  }

  const exportsApi = window.CalendarExports = window.CalendarExports || {};
  exportsApi.exportVisibleIcs = exportVisibleIcs;
  exportsApi.exportVisibleCsv = exportVisibleCsv;
  exportsApi.getVisibleEvents = () => eventsForExport().map(normalizeEventRecord);
})();
