
import { STR, text } from './ui/strings.js';
import { renderDailyView } from './calendar/daily_view.js';
import { createTaskFromEvent } from './tasks/api.js';

const fromHere = (p) => new URL(p, import.meta.url).href;

(function(){
  if(typeof window !== 'undefined'){
    const ready = Promise.resolve();
    try{
      Object.defineProperty(window, '__CALENDAR_READY__', {
        value: ready,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }catch (_) {
      window.__CALENDAR_READY__ = ready;
    }
  }

  function withLayoutGuard(moduleName, work){
    const debug = typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.DEBUG === true;
    if(!debug) return work();
    let hadRead = false;
    let lastOp = null;
    let violations = 0;
    const markRead = () => {
      if(lastOp === 'write' && hadRead) violations += 1;
      lastOp = 'read';
      hadRead = true;
    };
    const markWrite = () => {
      lastOp = 'write';
    };
    const restorers = [];
    const wrapMethod = (obj, key, marker) => {
      if(!obj || typeof obj[key] !== 'function') return;
      const original = obj[key];
      obj[key] = function(){
        marker();
        return original.apply(this, arguments);
      };
      restorers.push(()=>{ obj[key] = original; });
    };
    const wrapDescriptor = (proto, key, onGet, onSet) => {
      if(!proto) return;
      let desc;
      try{ desc = Object.getOwnPropertyDescriptor(proto, key); }
      catch (_err) { return; }
      if(!desc || desc.configurable === false) return;
      const next = {
        configurable: true,
        enumerable: desc.enumerable
      };
      if(typeof desc.get === 'function'){
        next.get = function(){ if(onGet) onGet(); return desc.get.call(this); };
      }
      if(typeof desc.set === 'function'){
        next.set = function(value){ if(onSet) onSet(); return desc.set.call(this, value); };
      }
      try{
        Object.defineProperty(proto, key, next);
        restorers.push(()=>{ Object.defineProperty(proto, key, desc); });
      }catch (_err) {}
    };
    wrapMethod(Element.prototype, 'getBoundingClientRect', markRead);
    if(typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'){
      const original = window.getComputedStyle;
      window.getComputedStyle = function(){
        markRead();
        return original.apply(window, arguments);
      };
      restorers.push(()=>{ window.getComputedStyle = original; });
    }
    ['appendChild','insertBefore','removeChild','replaceChild'].forEach(key => wrapMethod(Node.prototype, key, markWrite));
    if(typeof DOMTokenList !== 'undefined' && DOMTokenList.prototype){
      ['add','remove','toggle','replace'].forEach(key => wrapMethod(DOMTokenList.prototype, key, markWrite));
    }
    if(typeof CSSStyleDeclaration !== 'undefined' && CSSStyleDeclaration.prototype){
      ['setProperty','removeProperty'].forEach(key => wrapMethod(CSSStyleDeclaration.prototype, key, markWrite));
    }
    wrapDescriptor(Element.prototype, 'innerHTML', null, markWrite);
    wrapDescriptor(Element.prototype, 'outerHTML', null, markWrite);
    wrapDescriptor(Node.prototype, 'textContent', null, markWrite);
    if(typeof HTMLElement !== 'undefined' && HTMLElement.prototype){
      ['innerText','outerText','offsetWidth','offsetHeight','clientWidth','clientHeight','scrollTop','scrollLeft','scrollHeight','scrollWidth'].forEach(prop => {
        const onSet = (prop === 'scrollTop' || prop === 'scrollLeft') ? markWrite : null;
        wrapDescriptor(HTMLElement.prototype, prop, markRead, onSet);
      });
    }
    let finalized = false;
    const finalize = () => {
      if(finalized) return;
      finalized = true;
      while(restorers.length){
        const restore = restorers.pop();
        try{ restore(); }
        catch (_err) {}
      }
      if(violations >= 5 && console && typeof console.info === 'function'){
        console.info(`[LAYOUT] possible thrash at ${moduleName} (x${violations})`);
      }
    };
    try{
      const result = work();
      if(result && typeof result.then === 'function'){
        return result.finally(finalize);
      }
      finalize();
      return result;
    }catch (err) {
      finalize();
      throw err;
    }
  }

  // Deterministic helpers (no timers, no dispatch during render)
  function startOfWeek(d){
    const dd=new Date(d); const day=(dd.getDay()+6)%7; // Monday start
    dd.setDate(dd.getDate()-day); dd.setHours(0,0,0,0); return dd;
  }
  function addDays(d,n){ const dd=new Date(d); dd.setDate(dd.getDate()+n); return dd; }
  function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0'); }
  function parseISOish(s){
    if(!s) return null;
    try{
      if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s+"T00:00:00");
      const d = new Date(s); return isNaN(d) ? null : d;
    }catch (_) { return null; }
  }
  async function getAll(store){ try{ if(typeof dbGetAll==='function') return await dbGetAll(store); }catch (_) {} return []; }

  const EVENT_META = [
    {type:'followup', label:text('calendar.event.follow-up'), icon:'📞'},
    {type:'closing', label:text('calendar.event.closing'), icon:'🏁'},
    {type:'funded', label:text('calendar.event.funded'), icon:'💰'},
    {type:'task', label:text('calendar.event.task'), icon:'✅'},
    {type:'deal', label:text('calendar.event.deal'), icon:'📋'},
    {type:'birthday', label:text('calendar.event.birthday'), icon:'🎂'},
    {type:'anniversary', label:text('calendar.event.anniversary'), icon:'💍'}
  ];
  const EVENT_META_MAP = new Map(EVENT_META.map(meta => [meta.type, meta]));
  const LOAN_PALETTE = Object.freeze([
    {key:'fha', label:STR['calendar.legend.loan-type.fha'], css:'loan-purchase'},
    {key:'va', label:STR['calendar.legend.loan-type.va'], css:'loan-refi'},
    {key:'conv', label:STR['calendar.legend.loan-type.conv'], css:'loan-heloc'},
    {key:'jumbo', label:STR['calendar.legend.loan-type.jumbo'], css:'loan-construction'},
    {key:'other', label:STR['calendar.legend.loan-type.other'], css:'loan-other'}
  ]);
  const LOAN_PALETTE_MAP = new Map(LOAN_PALETTE.map(meta => [meta.key, meta]));
  const DEFAULT_LOAN = 'other';
  const CURRENCY = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});

  function normalizeLoanType(raw){
    const text = String(raw||'').trim().toLowerCase();
    if(!text) return DEFAULT_LOAN;
    if(text.includes('fha')) return 'fha';
    if(/\bva\b/.test(text) || text.includes('v.a')) return 'va';
    if(text.includes('jumbo')) return 'jumbo';
    if(text.includes('conv') || text.includes('convent') || text.includes('conforming') || text.includes('refi') || text.includes('refinance') || text.includes('purchase')) return 'conv';
    return DEFAULT_LOAN;
  }
  function loanMetaFromKey(key){ return LOAN_PALETTE_MAP.get(key) || LOAN_PALETTE_MAP.get(DEFAULT_LOAN); }
  function resolveLoanMeta(raw){
    if(LOAN_PALETTE_MAP.has(raw)) return loanMetaFromKey(raw);
    return loanMetaFromKey(normalizeLoanType(raw));
  }
  function contactName(contact){
    if(!contact) return STR['general.contact'];
    const first = String(contact.first||'').trim();
    const last = String(contact.last||'').trim();
    const parts = [first,last].filter(Boolean);
    if(parts.length) return parts.join(' ');
    return contact.name || contact.company || contact.email || 'Contact';
  }
  function formatAmount(value){
    const num = Number(value||0);
    return Number.isFinite(num) && num>0 ? CURRENCY.format(num) : '';
  }

  const popoverState = { node: null, detach: null, anchor: null };

  const ensureContactModal = (() => {
    let inflight = null;
    let warned = false;
    const noteWarn = (label, err) => {
      if(warned) return;
      warned = true;
      if(console && typeof console.warn === 'function'){
        console.warn(label, err);
      }
    };
    return async function ensureContactModal(){
      if(typeof window === 'undefined') return false;
      if(typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true){
        return true;
      }
      const ready = window.__CONTACT_MODAL_READY__;
      if(ready && typeof ready.then === 'function'){
        try{ await ready; }
        catch (err){ noteWarn('contact modal ready wait failed', err); }
        if(typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true){
          return true;
        }
      }
      if(inflight){
        try{ await inflight; }
        catch (_err){}
        return typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true;
      }
      try{
        inflight = import(fromHere('./contacts.js'));
        await inflight;
      }catch (err){
        noteWarn('contact modal import failed', err);
        inflight = null;
        return false;
      }
      inflight = null;
      const postReady = window.__CONTACT_MODAL_READY__;
      if(postReady && typeof postReady.then === 'function'){
        try{ await postReady; }
        catch (err){ noteWarn('contact modal ready wait failed', err); }
      }
      return typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true;
    };
  })();

  function closeEventPopover(){
    if(popoverState.detach){
      try{ popoverState.detach(); }
      catch (_err){}
      popoverState.detach = null;
    }
    if(popoverState.node){
      try{ popoverState.node.remove(); }
      catch (_err){}
      popoverState.node = null;
    }
    popoverState.anchor = null;
  }

  function postVisLog(eventName){
    const payload = JSON.stringify({ event: eventName });
    let delivered = false;
    if(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'){
      try{
        const blob = new Blob([payload], { type:'application/json' });
        delivered = navigator.sendBeacon('/__log', blob) === true;
      }catch (_err){}
    }
    if(delivered || typeof fetch !== 'function') return;
    try{
      fetch('/__log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(()=>{});
    }catch (_err){}
  }

  function logCalendarContact(){
    try{ console && typeof console.info === 'function' && console.info('[VIS] calendar→contact modal'); }
    catch (_err){}
    postVisLog('calendar-contact-modal');
  }

  function collectEvents(contacts,tasks,deals,anchor){
    const events = [];
    const year = anchor.getFullYear();
    const contactMap = new Map();
    for(const c of contacts||[]){
      const key = String(c.id || c.contactId || c.contactID || '').trim();
      if(key) contactMap.set(key, c);
    }

    function push(dateInput, type, title, subtitle, loanType, hasLoanOverride, source = null, status = '', extra = {}){
      const rawDate = dateInput instanceof Date ? new Date(dateInput) : parseISOish(dateInput);
      if(!rawDate) return;
      rawDate.setHours(0,0,0,0);
      const hasLoan = hasLoanOverride!=null ? hasLoanOverride : !!loanType;
      const loanMeta = hasLoan ? resolveLoanMeta(loanType) : loanMetaFromKey(DEFAULT_LOAN);
      const contactId = extra && extra.contactId ? String(extra.contactId).trim() : '';
      const contactStage = extra && extra.contactStage ? String(extra.contactStage).trim() : '';
      const contactNameLabel = extra && extra.contactName ? String(extra.contactName).trim() : '';
      events.push({
        date: rawDate,
        type,
        title: title || (EVENT_META_MAP.get(type)?.label || ''),
        subtitle: subtitle || '',
        loanKey: loanMeta.key,
        loanLabel: loanMeta.label,
        hasLoan,
        status: status || '',
        source: source,
        contactId,
        contactStage,
        contactName: contactNameLabel,
        raw: extra && extra.raw ? extra.raw : null
      });
    }

    for(const c of contacts||[]){
      const name = contactName(c);
      const loanType = c.loanType || c.loanProgram || '';
      const stage = c.stage || '';
      const amount = formatAmount(c.loanAmount || c.amount);
      const contactId = String(c.id||c.contactId||c.contactID||'');

      if(c.nextFollowUp){
        const parts = [text('calendar.subtitle.next-touch')];
        if(stage) parts.push(stage);
        push(c.nextFollowUp, 'followup', name, parts.filter(Boolean).join(' • '), loanType, undefined,
          { entity:'contacts', id:contactId, field:'nextFollowUp' },
          stage,
          { contactId, contactStage: stage, contactName: name, raw: c });
      }
      const closeRaw = c.expectedClosing || c.closingDate || '';
      if(closeRaw){
        const parts = [text('calendar.subtitle.closing')];
        if(stage) parts.push(stage);
        if(amount) parts.push(amount);
        push(closeRaw, 'closing', name, parts.filter(Boolean).join(' • '), loanType, undefined,
          { entity:'contacts', id:contactId, field:'expectedClosing' },
          stage,
          { contactId, contactStage: stage, contactName: name, raw: c });
      }
      if(c.fundedDate){
        const parts = [text('calendar.subtitle.funded')];
        if(amount) parts.push(amount);
        push(c.fundedDate, 'funded', name, parts.filter(Boolean).join(' • '), loanType, undefined,
          { entity:'contacts', id:contactId, field:'fundedDate' },
          stage,
          { contactId, contactStage: stage, contactName: name, raw: c });
      }
      const bd = c.birthday || c.birthdate || c.birthDate;
      if(bd){
        const d = parseISOish(bd);
        if(d){
          const e = new Date(year, d.getMonth(), d.getDate());
          push(e, 'birthday', name, text('calendar.subtitle.birthday'), loanType, undefined,
            { entity:'contacts', id:contactId, field:'birthday' },
            stage,
            { contactId, contactStage: stage, contactName: name, raw: c });
        }
      }
      const ann = c.anniversary || c.anniversaryDate;
      if(ann){
        const d = parseISOish(ann);
        if(d){
          const e = new Date(year, d.getMonth(), d.getDate());
          push(e, 'anniversary', name, text('calendar.subtitle.anniversary'), loanType, undefined,
            { entity:'contacts', id:contactId, field:'anniversary' },
            stage,
            { contactId, contactStage: stage, contactName: name, raw: c });
        }
      }
    }

    for(const t of tasks||[]){
      const when = t.due || t.dueDate || t.date;
      if(!when) continue;
      const contact = contactMap.get(String(t.contactId || t.contact || '').trim());
      const title = t.title || t.name || text('calendar.event.task');
      const parts = [];
      let loanType = '';
      const contactId = contact ? String(contact.id||contact.contactId||contact.contactID||'') : String(t.contactId||'');
      const stage = contact ? (contact.stage||'') : (t.stage||'');
      if(contact){
        parts.push(contactName(contact));
        if(t.stage) parts.push(t.stage);
        else if(contact.stage) parts.push(contact.stage);
        loanType = contact.loanType || contact.loanProgram || '';
      } else if(t.stage){
        parts.push(t.stage);
      }
      push(when, 'task', title, parts.filter(Boolean).join(' • '), loanType, contact ? undefined : false,
        { entity:'tasks', id:String(t.id||t.taskId||''), field:'due' },
        stage,
        { contactId, contactStage: stage, contactName: contact ? contactName(contact) : '', raw: t });
    }

    for(const dl of deals||[]){
      const close = dl.expectedClose || dl.closingDate || dl.closeDate || dl.fundedDate;
      if(!close) continue;
      const contact = contactMap.get(String(dl.contactId || dl.contact || '').trim());
      const loanType = contact ? (contact.loanType || contact.loanProgram || '') : '';
      const title = contact ? contactName(contact) : (dl.name || text('calendar.event.deal'));
      const parts = [text('calendar.subtitle.deal')];
      if(dl.name && contact) parts.push(dl.name);
      const stage = (dl.status||'');
      const contactId = contact ? String(contact.id||contact.contactId||contact.contactID||'') : String(dl.contactId||'');
      push(close, 'deal', title, parts.filter(Boolean).join(' • '), loanType, contact ? undefined : false,
        { entity:'deals', id:String(dl.id||dl.dealId||''), field:'expectedClose' },
        stage,
        { contactId, contactStage: contact ? (contact.stage||'') : stage, contactName: contact ? contactName(contact) : '', raw: dl });
    }

    events.sort((a,b)=>{
      const diff = a.date - b.date;
      if(diff!==0) return diff;
      if(a.type!==b.type) return a.type.localeCompare(b.type);
      return (a.title||'').localeCompare(b.title||'');
    });
    return events;
  }

  function legend(events){
    const view = document.getElementById('view-calendar');
    const host = view ? view.querySelector('#calendar-legend') : document.getElementById('calendar-legend');
    if(!host) return;
    host.innerHTML = '';

    const eventSection = document.createElement('div');
    eventSection.className = 'legend-section';
    const eventTitle = document.createElement('div');
    eventTitle.className = 'legend-title';
    eventTitle.textContent = text('calendar.legend.event-types');
    const eventList = document.createElement('div');
    eventList.className = 'legend-list';
    EVENT_META.forEach(meta => {
      const chip = document.createElement('span');
      chip.className = 'legend-chip';
      chip.innerHTML = `<span class="icon">${meta.icon||''}</span>${meta.label}`;
      chip.setAttribute('title', text('calendar.legend.tooltip.events'));
      eventList.appendChild(chip);
    });
    eventSection.appendChild(eventTitle);
    eventSection.appendChild(eventList);
    host.appendChild(eventSection);

    const loanSection = document.createElement('div');
    loanSection.className = 'legend-section';
    const loanTitle = document.createElement('div');
    loanTitle.className = 'legend-title';
    loanTitle.textContent = text('calendar.legend.loan-types');
    loanTitle.setAttribute('title', text('calendar.legend.tooltip.loan-types'));
    const loanList = document.createElement('div');
    loanList.className = 'legend-list';
    LOAN_PALETTE.forEach(meta => {
      const chip = document.createElement('span');
      chip.className = `legend-chip loan ${meta.css}`;
      chip.dataset.loan = meta.key;
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      chip.appendChild(swatch);
      chip.append(meta.label);
      loanList.appendChild(chip);
    });
    loanSection.appendChild(loanTitle);
    loanSection.appendChild(loanList);
    host.appendChild(loanSection);
  }

  function formatRange(anchor, view, start, end){
    const locale = undefined;
    if(view==='day'){
      return anchor.toLocaleDateString(locale, {weekday:'short', month:'long', day:'numeric', year:'numeric'});
    }
    if(view==='week'){
      const endInclusive = addDays(end, -1);
      const startLabel = start.toLocaleDateString(locale, {month:'short', day:'numeric'});
      const endLabel = endInclusive.toLocaleDateString(locale, {month:'short', day:'numeric', year:start.getFullYear()!==endInclusive.getFullYear() ? 'numeric' : undefined});
      return `${startLabel} – ${endLabel}`;
    }
    return anchor.toLocaleDateString(locale, {month:'long', year:'numeric'});
  }

  const LOAN_COLORS = Object.freeze({
    fha:'#2E86DE', va:'#10AC84', conv:'#C56CF0', jumbo:'#F368E0', other:'#8395A7'
  });
  const STATUS_COLORS = Object.freeze({
    'long-shot':'#7f8c8d', 'new':'#7f8c8d',
    'application':'#2980b9',
    'preapproved':'#16a085',
    'processing':'#8e44ad',
    'underwriting':'#d35400',
    'approved':'#27ae60',
    'cleared-to-close':'#c0392b',
    'ctc':'#c0392b',
    'funded':'#2c3e50'
  });
  function colorForLoan(key){ return LOAN_COLORS[key] || LOAN_COLORS.other; }
  function colorForStatus(s){ return STATUS_COLORS[(s||'').toLowerCase()] || '#95a5a6'; }

  async function render(anchor=new Date(), view='month'){
    return withLayoutGuard('calendar_impl.js', async () => {
    const viewEl = document.getElementById('view-calendar');
    const root = (viewEl ? viewEl.querySelector('#calendar-root') : null)
      || document.getElementById('calendar-root')
      || document.getElementById('calendar');
    if(!root) return;
    // Read data deterministically
    const [contacts,tasks,deals] = await Promise.all([getAll('contacts'), getAll('tasks'), getAll('deals')]);
    const events = collectEvents(contacts,tasks,deals, anchor);

    // Build frame
    let start, end, cols;
    if(view==='week'){ const s=startOfWeek(anchor); start=s; end=addDays(s,7); cols=7; }
    else if(view==='day'){ const s=new Date(anchor); s.setHours(0,0,0,0); start=s; end=addDays(s,1); cols=1; }
    else { // month grid (6 rows * 7)
      const first=new Date(anchor.getFullYear(), anchor.getMonth(),1);
      start=startOfWeek(first); end=addDays(start,42); cols=7;
    }

    const label = document.getElementById('calendar-label');
    if(label){
      label.textContent = formatRange(anchor, view, start, end);
    }

    closeEventPopover();
    root.innerHTML = '';
    root.setAttribute('data-view', view);
    const todayStr = new Date().toDateString();

    const openContactRecord = async (contactId)=>{
      const targetId = contactId ? String(contactId).trim() : '';
      if(!targetId){
        if(typeof window.toast === 'function'){
          window.toast('Contact unavailable for this event');
        }
        return false;
      }
      let ready = false;
      try{ ready = await ensureContactModal(); }
      catch (err){
        if(console && typeof console.warn === 'function'){
          console.warn('contact modal ensure failed', err);
        }
        ready = false;
      }
      if(!ready || typeof window.renderContactModal !== 'function' || window.renderContactModal.__crmReady !== true){
        if(typeof window.toast === 'function'){
          window.toast('Contact unavailable for this event');
        }
        return false;
      }
      logCalendarContact();
      try{ window.renderContactModal(targetId); }
      catch (err) {
        if(console && typeof console.warn === 'function'){
          console.warn('renderContactModal failed', err);
        }
        return false;
      }
      return true;
    };

    let __calPending = new Set();
    let __calFlushScheduled = false;
    function scheduleCalendarFlush(){
      if(__calFlushScheduled) return;
      __calFlushScheduled = true;
      const qmt = (typeof queueMicrotask==='function') ? queueMicrotask : (fn)=>Promise.resolve().then(fn);
      qmt(() => {
        __calFlushScheduled = false;
        if(__calPending.size===0) return;
        try{
          if (typeof window.dispatchAppDataChanged === 'function'){
            window.dispatchAppDataChanged({ scope:'calendar', ids:[...__calPending] });
          } else {
            document.dispatchEvent(new CustomEvent('app:data:changed', { detail:{ scope:'calendar', ids:[...__calPending] }}));
          }
          if (window.RenderGuard && typeof window.RenderGuard.requestRender === 'function'){
            window.RenderGuard.requestRender();
          }
        } finally {
          __calPending.clear();
        }
      });
    }

    async function persistEventDate(source, newDate){
      if(!source || !source.entity || !source.id || !newDate) return false;
      const scope = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
      if(typeof scope.openDB !== 'function' || typeof scope.dbGet !== 'function' || typeof scope.dbPut !== 'function'){
        await import(fromHere('./db.js')).catch(()=>null);
      }
      const openDB = typeof scope.openDB === 'function' ? scope.openDB : null;
      const dbGet = typeof scope.dbGet === 'function' ? scope.dbGet : null;
      const dbPut = typeof scope.dbPut === 'function' ? scope.dbPut : null;
      if(!openDB || !dbGet || !dbPut) return false;
      await openDB();
      const store = source.entity;
      const rec = await dbGet(store, String(source.id)).catch(()=>null);
      if(!rec) return false;
      const field = source.field || (store==='tasks' ? 'due' : store==='deals' ? 'expectedClose' : 'nextFollowUp');
      const iso = new Date(newDate); iso.setHours(0,0,0,0);
      const isoStr = iso.toISOString().slice(0,10);
      rec[field] = isoStr;
      rec.updatedAt = Date.now();
      await dbPut(store, rec);
      __calPending.add(`${store}:${source.id}`);
      scheduleCalendarFlush();
      return true;
    }

    const dayCount = Math.round((end - start)/86400000);
    if(view === 'day'){
      const dayEvents = events.filter(e=> ymd(e.date)===ymd(anchor));
      renderDailyView({
        root,
        anchor,
        events: dayEvents,
        metaFor: (type)=> EVENT_META_MAP.get(type) || null,
        openContact: openContactRecord,
        addTask: createTaskFromEvent,
        closePopover: closeEventPopover
      });
    }else{
      const grid = document.createElement('div');
      grid.className = 'calendar-grid';
      for(let i=0;i<dayCount;i++){
        const d = addDays(start,i);
        const inMonth = d.getMonth()===anchor.getMonth();

        const cell = document.createElement('div');
        cell.className='cal-cell';
        if(!inMonth && view==='month') cell.classList.add('muted');
        if(d.toDateString()===todayStr) cell.classList.add('today');

        const head = document.createElement('div');
        head.className='cal-cell-head';
        head.textContent = d.getDate();
        head.style.fontSize = '12px';
        cell.appendChild(head);

        const box = document.createElement('div');
        box.className='cal-events';

        cell.addEventListener('dragover', (e)=>{ e.preventDefault(); });
        cell.addEventListener('drop', async (e)=>{
          e.preventDefault();
          const data = e.dataTransfer && e.dataTransfer.getData('text/plain');
          if(!data) return;
          try{
            const payload = JSON.parse(data);
            if(payload && payload.source){
              await persistEventDate(payload.source, new Date(d));
            }
          }catch (_) { }
        });

        const todays = events.filter(e=> ymd(e.date)===ymd(d) );

        if(view==='month'){
          box.style.maxHeight = '140px';
          box.style.overflowY = 'auto';
          box.style.paddingRight = '2px';
        }

        for(let j=0; j<todays.length; j++){
          const ev = todays[j];
          const meta = EVENT_META_MAP.get(ev.type) || {label:ev.type, icon:''};
          const item = document.createElement('div');
          item.className = 'ev ev-'+ev.type;
          item.style.fontSize = '12px';
          item.style.background = colorForLoan(ev.loanKey) + '1A';
          item.style.borderLeft = '4px solid ' + colorForLoan(ev.loanKey);
          item.style.position = 'relative';
          item.dataset.date = String(ev.date?.toISOString?.() || '');
          item.dataset.eventType = ev.type || '';
          item.dataset.calendarEnhanced = '1';
          const contactId = ev.contactId ? String(ev.contactId) : '';
          if(contactId) item.dataset.contactId = contactId;
          const canDrag = !!(ev.source && ev.source.entity && ev.source.id);
          item.draggable = canDrag;
          if (canDrag) {
            item.dataset.source = `${ev.source.entity}:${ev.source.id}:${ev.source.field||''}`;
          }

          const bar = document.createElement('div');
          bar.className = 'ev-status';
          bar.style.height = '3px';
          bar.style.background = colorForStatus(ev.status);
          bar.style.marginBottom = '2px';
          item.appendChild(bar);

          if (canDrag){
            item.addEventListener('dragstart', (e)=>{
              if(!e.dataTransfer) return;
              const payload = { type: ev.type, date: ev.date, source: ev.source || null };
              try{ e.dataTransfer.setData('text/plain', JSON.stringify(payload)); }catch (_) { }
            });
          }

          const openContact = async (evt) => {
            if(evt){
              evt.preventDefault();
              if(typeof evt.stopPropagation === 'function') evt.stopPropagation();
            }
            closeEventPopover();
            await openContactRecord(contactId);
          };

          item.addEventListener('click', (evt)=>{
            Promise.resolve(openContact(evt)).catch(()=>{});
          });

          const icon = document.createElement('span');
          icon.className = 'ev-icon';
          icon.textContent = meta.icon || '';
          item.appendChild(icon);
          const textWrap = document.createElement('div');
          textWrap.className = 'ev-text';
          const title = document.createElement('strong');
          title.textContent = ev.title || meta.label;
          textWrap.appendChild(title);
          if(ev.subtitle){
            const sub = document.createElement('div');
            sub.className = 'muted';
            sub.textContent = ev.subtitle;
            textWrap.appendChild(sub);
          } else if(ev.contactName){
            const sub = document.createElement('div');
            sub.className = 'muted';
            sub.textContent = ev.contactName;
            textWrap.appendChild(sub);
          }
          item.appendChild(textWrap);
          item.title = `${meta.label}${ev.subtitle ? ' — '+ev.subtitle : ''}`;

          const menuBtn = document.createElement('button');
          menuBtn.type = 'button';
          menuBtn.setAttribute('aria-label', 'Event quick actions');
          menuBtn.textContent = '⋯';
          menuBtn.style.position = 'absolute';
          menuBtn.style.top = '2px';
          menuBtn.style.right = '4px';
          menuBtn.style.border = 'none';
          menuBtn.style.background = 'transparent';
          menuBtn.style.cursor = 'pointer';
          menuBtn.style.fontSize = '16px';
          menuBtn.style.lineHeight = '1';
          menuBtn.style.padding = '0 4px';
          menuBtn.style.color = '#555';
          menuBtn.addEventListener('click', (evt)=>{
            evt.preventDefault();
            evt.stopPropagation();
            if(popoverState.anchor === item){
              closeEventPopover();
              return;
            }
            closeEventPopover();
            const pop = document.createElement('div');
            pop.className = 'calendar-popover';
            pop.setAttribute('role', 'dialog');
            pop.style.position = 'absolute';
            pop.style.minWidth = '220px';
            pop.style.maxWidth = '260px';
            pop.style.background = '#fff';
            pop.style.border = '1px solid rgba(17,24,39,0.1)';
            pop.style.boxShadow = '0 10px 30px rgba(15,23,42,0.18)';
            pop.style.borderRadius = '8px';
            pop.style.padding = '12px';
            pop.style.fontSize = '12px';
            pop.style.color = '#111827';
            pop.style.zIndex = '10000';

            const header = document.createElement('div');
            header.style.fontWeight = '600';
            header.style.marginBottom = '4px';
            header.textContent = ev.title || meta.label || 'Calendar Event';
            pop.appendChild(header);

            const detail = document.createElement('div');
            detail.style.marginBottom = '8px';
            detail.style.color = '#4b5563';
            const detailParts = [];
            if(ev.contactName) detailParts.push(ev.contactName);
            if(ev.subtitle) detailParts.push(ev.subtitle);
            if(ev.contactStage) detailParts.push(ev.contactStage);
            detail.textContent = detailParts.filter(Boolean).join(' • ') || meta.label || '';
            pop.appendChild(detail);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';
            actions.style.flexWrap = 'wrap';
            actions.style.alignItems = 'center';

            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'btn';
            openBtn.textContent = 'Open Contact';
            if(!contactId || typeof window.renderContactModal !== 'function'){
              openBtn.disabled = true;
            }
            openBtn.addEventListener('click', (event)=>{
              event.preventDefault();
              event.stopPropagation();
              Promise.resolve(openContact(event)).catch(()=>{});
            });
            actions.appendChild(openBtn);

            const taskBtn = document.createElement('button');
            taskBtn.type = 'button';
            taskBtn.className = 'btn brand';
            taskBtn.textContent = 'Add as Task';
            if(!contactId){
              taskBtn.disabled = true;
            }
            taskBtn.addEventListener('click', async (event)=>{
              event.preventDefault();
              event.stopPropagation();
              if(taskBtn.disabled) return;
              taskBtn.disabled = true;
              try{
                const result = await createTaskFromEvent(ev);
                if(!result || result.status !== 'ok'){
                  taskBtn.disabled = false;
                  return;
                }
                closeEventPopover();
              }catch (err){
                taskBtn.disabled = false;
                console && console.warn && console.warn('createTaskFromEvent failed', err);
              }
            });
            actions.appendChild(taskBtn);
            pop.appendChild(actions);

            const rect = item.getBoundingClientRect();
            const docEl = document.documentElement || document.body;
            const top = rect.bottom + (window.scrollY || docEl.scrollTop || 0) + 6;
            let left = rect.left + (window.scrollX || docEl.scrollLeft || 0);
            pop.style.top = `${top}px`;
            pop.style.left = `${Math.max(8, left)}px`;

            document.body.appendChild(pop);

            const adjust = () => {
              const w = pop.getBoundingClientRect().width;
              const viewportWidth = window.innerWidth || docEl.clientWidth || 0;
              if(left + w > viewportWidth - 16){
                left = Math.max(8, viewportWidth - w - 16);
                pop.style.left = `${left}px`;
              }
            };
            adjust();

            const onDocClick = (docEvt) => {
              if(!pop.contains(docEvt.target) && docEvt.target !== menuBtn){
                closeEventPopover();
              }
            };
            document.addEventListener('click', onDocClick, true);
            popoverState.detach = () => { document.removeEventListener('click', onDocClick, true); };
            popoverState.node = pop;
            popoverState.anchor = item;
          });
          item.appendChild(menuBtn);

          box.appendChild(item);
        }
        cell.appendChild(box);
        grid.appendChild(cell);
      }
      root.appendChild(grid);
    }
    legend(events);

    const snapshot = events.map((ev, index) => {
      const date = new Date(ev.date.getTime());
      date.setHours(0, 0, 0, 0);
      const source = ev.source ? {
        entity: ev.source.entity || '',
        id: ev.source.id || '',
        field: ev.source.field || ''
      } : null;
      const uidParts = [ev.type || 'event', String(date.getTime())];
      if (source && source.entity && source.id) {
        uidParts.push(source.entity, source.id);
      } else {
        uidParts.push(String(index));
      }
      return {
        uid: uidParts.join(':'),
        type: ev.type,
        title: ev.title,
        subtitle: ev.subtitle,
        status: ev.status || '',
        hasLoan: !!ev.hasLoan,
        loanKey: ev.loanKey || '',
        loanLabel: ev.loanLabel || '',
        date,
        source,
        contactId: ev.contactId || '',
        contactStage: ev.contactStage || '',
        contactName: ev.contactName || ''
      };
    });
    const rangeStart = start ? new Date(start.getTime()) : null;
    const rangeEnd = end ? new Date(end.getTime()) : null;
    const calendarApi = window.CalendarAPI = window.CalendarAPI || {};
    calendarApi.visibleEvents = function(){
      return snapshot.map(ev => ({
        uid: ev.uid,
        type: ev.type,
        title: ev.title,
        subtitle: ev.subtitle,
        status: ev.status,
        hasLoan: ev.hasLoan,
        loanKey: ev.loanKey,
        loanLabel: ev.loanLabel,
        date: new Date(ev.date.getTime()),
        source: ev.source ? { entity: ev.source.entity, id: ev.source.id, field: ev.source.field } : null,
        contactId: ev.contactId || '',
        contactStage: ev.contactStage || '',
        contactName: ev.contactName || ''
      }));
    };
    calendarApi.currentRange = {
      view,
      anchor: new Date(anchor.getTime()),
      start: rangeStart,
      end: rangeEnd
    };

    });
  }

  // Expose as stable impl used by calendar.js
  const __test__ = {
    loanPalette: LOAN_PALETTE.map(meta => ({...meta})),
    normalizeLoanType
  };
  window.__CALENDAR_IMPL__ = { render, __test__ };

})();
