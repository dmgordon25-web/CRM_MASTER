
import { STR, text } from './ui/strings.js';
import { renderDailyView } from './calendar/daily_view.js';
import { createTaskFromEvent } from './tasks/api.js';
import { rangeForView, addDays, ymd, parseDateInput, loadEventsBetween, isWithinRange } from './calendar/index.js';
import { ensureContactModalReady, openContactModal } from './contacts.js';

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
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const EVENT_ICON_PATHS = Object.freeze({
    followup: 'M2.25 6.75C2.25 15.0343 8.96573 21.75 17.25 21.75H19.5C20.7426 21.75 21.75 20.7426 21.75 19.5V18.1284C21.75 17.6121 21.3987 17.1622 20.8979 17.037L16.4747 15.9312C16.0355 15.8214 15.5734 15.9855 15.3018 16.3476L14.3316 17.6412C14.05 18.0166 13.563 18.1827 13.1223 18.0212C9.81539 16.8098 7.19015 14.1846 5.97876 10.8777C5.81734 10.437 5.98336 9.94998 6.3588 9.6684L7.65242 8.69818C8.01453 8.4266 8.17861 7.96445 8.06883 7.52533L6.96304 3.10215C6.83783 2.60133 6.38785 2.25 5.87163 2.25H4.5C3.25736 2.25 2.25 3.25736 2.25 4.5V6.75Z',
    closing: 'M3 3V4.5M3 21V15M3 15L5.77009 14.3075C7.85435 13.7864 10.0562 14.0281 11.9778 14.9889L12.0856 15.0428C13.9687 15.9844 16.1224 16.2359 18.1718 15.7537L21.2861 15.0209C21.097 13.2899 21 11.5313 21 9.75C21 7.98343 21.0954 6.23914 21.2814 4.52202L18.1718 5.25369C16.1224 5.73591 13.9687 5.48435 12.0856 4.54278L11.9778 4.48892C10.0562 3.52812 7.85435 3.28641 5.77009 3.80748L3 4.5M3 15V4.5',
    funded: 'M12 6V18M9 15.1818L9.87887 15.841C11.0504 16.7197 12.9498 16.7197 14.1214 15.841C15.2929 14.9623 15.2929 13.5377 14.1214 12.659C13.5355 12.2196 12.7677 12 11.9999 12C11.275 12 10.5502 11.7804 9.99709 11.341C8.891 10.4623 8.891 9.03772 9.9971 8.15904C11.1032 7.28036 12.8965 7.28036 14.0026 8.15904L14.4175 8.48863M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z',
    task: 'M11.3495 3.83619C11.2848 4.04602 11.25 4.26894 11.25 4.5C11.25 4.91421 11.5858 5.25 12 5.25H16.5C16.9142 5.25 17.25 4.91421 17.25 4.5C17.25 4.26894 17.2152 4.04602 17.1505 3.83619M11.3495 3.83619C11.6328 2.91757 12.4884 2.25 13.5 2.25H15C16.0116 2.25 16.8672 2.91757 17.1505 3.83619M11.3495 3.83619C10.9739 3.85858 10.5994 3.88529 10.2261 3.91627C9.09499 4.01015 8.25 4.97324 8.25 6.10822V8.25M17.1505 3.83619C17.5261 3.85858 17.9006 3.88529 18.2739 3.91627C19.405 4.01015 20.25 4.97324 20.25 6.10822V16.5C20.25 17.7426 19.2426 18.75 18 18.75H15.75M8.25 8.25H4.875C4.25368 8.25 3.75 8.75368 3.75 9.375V20.625C3.75 21.2463 4.25368 21.75 4.875 21.75H14.625C15.2463 21.75 15.75 21.2463 15.75 20.625V18.75M8.25 8.25H14.625C15.2463 8.25 15.75 8.75368 15.75 9.375V18.75M7.5 15.75L9 17.25L12 13.5',
    deal: 'M20.25 14.1499V18.4C20.25 19.4944 19.4631 20.4359 18.3782 20.58C16.2915 20.857 14.1624 21 12 21C9.83757 21 7.70854 20.857 5.62185 20.58C4.5369 20.4359 3.75 19.4944 3.75 18.4V14.1499M20.25 14.1499C20.7219 13.7476 21 13.1389 21 12.4889V8.70569C21 7.62475 20.2321 6.69082 19.1631 6.53086C18.0377 6.36247 16.8995 6.23315 15.75 6.14432M20.25 14.1499C20.0564 14.315 19.8302 14.4453 19.5771 14.5294C17.1953 15.3212 14.6477 15.75 12 15.75C9.35229 15.75 6.80469 15.3212 4.42289 14.5294C4.16984 14.4452 3.94361 14.3149 3.75 14.1499M3.75 14.1499C3.27808 13.7476 3 13.1389 3 12.4889V8.70569C3 7.62475 3.7679 6.69082 4.83694 6.53086C5.96233 6.36247 7.10049 6.23315 8.25 6.14432M15.75 6.14432V5.25C15.75 4.00736 14.7426 3 13.5 3H10.5C9.25736 3 8.25 4.00736 8.25 5.25V6.14432M15.75 6.14432C14.5126 6.0487 13.262 6 12 6C10.738 6 9.48744 6.0487 8.25 6.14432M12 12.75H12.0075V12.7575H12V12.75Z',
    birthday: 'M12 8.25V6.75M12 8.25C10.6448 8.25 9.30281 8.30616 7.97608 8.41627C6.84499 8.51015 6 9.47323 6 10.6082V13.1214M12 8.25C13.3552 8.25 14.6972 8.30616 16.0239 8.41627C17.155 8.51015 18 9.47323 18 10.6082V13.1214M15 8.25V6.75M9 8.25V6.75M21 16.5L19.5 17.25C18.5557 17.7221 17.4443 17.7221 16.5 17.25C15.5557 16.7779 14.4443 16.7779 13.5 17.25C12.5557 17.7221 11.4443 17.7221 10.5 17.25C9.55573 16.7779 8.44427 16.7779 7.5 17.25C6.55573 17.7221 5.44427 17.7221 4.5 17.25L3 16.5M18 13.1214C16.0344 12.8763 14.032 12.75 12 12.75C9.96804 12.75 7.96557 12.8763 6 13.1214M18 13.1214C18.3891 13.1699 18.7768 13.2231 19.163 13.2809C20.2321 13.4408 21 14.3747 21 15.4557V20.625C21 21.2463 20.4963 21.75 19.875 21.75H4.125C3.50368 21.75 3 21.2463 3 20.625V15.4557C3 14.3747 3.76793 13.4408 4.83697 13.2809C5.22316 13.2231 5.61086 13.1699 6 13.1214M12.2652 3.10983C12.4117 3.25628 12.4117 3.49372 12.2652 3.64016C12.1188 3.78661 11.8813 3.78661 11.7349 3.64016C11.5884 3.49372 11.5884 3.25628 11.7349 3.10983C11.8104 3.03429 12.0001 2.84467 12.0001 2.84467C12.0001 2.84467 12.1943 3.03893 12.2652 3.10983ZM9.26522 3.10983C9.41167 3.25628 9.41167 3.49372 9.26522 3.64016C9.11878 3.78661 8.88134 3.78661 8.73489 3.64016C8.58844 3.49372 8.58844 3.25628 8.73489 3.10983C8.81044 3.03429 9.00005 2.84467 9.00005 2.84467C9.00005 2.84467 9.19432 3.03893 9.26522 3.10983ZM15.2652 3.10983C15.4117 3.25628 15.4117 3.49372 15.2652 3.64016C15.1188 3.78661 14.8813 3.78661 14.7349 3.64016C14.5884 3.49372 14.5884 3.25628 14.7349 3.10983C14.8104 3.03429 15.0001 2.84467 15.0001 2.84467C15.0001 2.84467 15.1943 3.03893 15.2652 3.10983Z',
    anniversary: 'M21 8.25C21 5.76472 18.9013 3.75 16.3125 3.75C14.3769 3.75 12.7153 4.87628 12 6.48342C11.2847 4.87628 9.62312 3.75 7.6875 3.75C5.09867 3.75 3 5.76472 3 8.25C3 15.4706 12 20.25 12 20.25C12 20.25 21 15.4706 21 8.25Z'
  });
  const EVENT_ICON_FALLBACK = 'followup';
  const EVENT_ICON_CACHE = new Map();

  function createSvgNode(tag){
    if(typeof document === 'undefined') return null;
    if(typeof document.createElementNS === 'function') return document.createElementNS(SVG_NS, tag);
    return document.createElement(tag);
  }

  function createEventIconSvg(key, path){
    const svg = createSvgNode('svg');
    if(!svg) return null;
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.dataset.iconKey = key;
    const segment = createSvgNode('path');
    if(!segment) return svg;
    segment.setAttribute('d', path);
    segment.setAttribute('fill', 'none');
    segment.setAttribute('stroke', 'currentColor');
    segment.setAttribute('stroke-width', '1.5');
    segment.setAttribute('stroke-linecap', 'round');
    segment.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(segment);
    return svg;
  }

  function getEventIcon(type){
    const key = EVENT_ICON_PATHS[type] ? type : EVENT_ICON_FALLBACK;
    if(!EVENT_ICON_CACHE.has(key)){
      const path = EVENT_ICON_PATHS[key];
      EVENT_ICON_CACHE.set(key, path ? createEventIconSvg(key, path) : null);
    }
    const base = EVENT_ICON_CACHE.get(key);
    return base ? base.cloneNode(true) : null;
  }

  const EVENT_META = [
    {type:'followup', label:text('calendar.event.follow-up'), iconKey:'followup'},
    {type:'closing', label:text('calendar.event.closing'), iconKey:'closing'},
    {type:'funded', label:text('calendar.event.funded'), iconKey:'funded'},
    {type:'task', label:text('calendar.event.task'), iconKey:'task'},
    {type:'deal', label:text('calendar.event.deal'), iconKey:'deal'},
    {type:'birthday', label:text('calendar.event.birthday'), iconKey:'birthday'},
    {type:'anniversary', label:text('calendar.event.anniversary'), iconKey:'anniversary'}
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

  function collectEvents(contacts,tasks,deals,anchor,start,end){
    const events = [];
    const year = anchor.getFullYear();
    const contactMap = new Map();
    for(const c of contacts||[]){
      const key = String(c.id || c.contactId || c.contactID || '').trim();
      if(key) contactMap.set(key, c);
    }

    const rangeStart = start instanceof Date ? start.getTime() : null;
    const rangeEnd = end instanceof Date ? end.getTime() : null;

    function push(dateInput, type, title, subtitle, loanType, hasLoanOverride, source = null, status = '', extra = {}){
      const rawDate = parseDateInput(dateInput);
      if(!rawDate) return;
      const time = rawDate.getTime();
      if(rangeStart != null && time < rangeStart) return;
      if(rangeEnd != null && time >= rangeEnd) return;
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
        const d = parseDateInput(bd);
        if(d){
          const e = new Date(year, d.getMonth(), d.getDate());
          e.setHours(0,0,0,0);
          if(!isWithinRange(e, start, end)){
            // try previous year when range spans new year
            const prev = new Date(year - 1, d.getMonth(), d.getDate());
            prev.setHours(0,0,0,0);
            if(isWithinRange(prev, start, end)){
              push(prev, 'birthday', name, text('calendar.subtitle.birthday'), loanType, undefined,
                { entity:'contacts', id:contactId, field:'birthday' },
                stage,
                { contactId, contactStage: stage, contactName: name, raw: c });
            }
            continue;
          }
          push(e, 'birthday', name, text('calendar.subtitle.birthday'), loanType, undefined,
            { entity:'contacts', id:contactId, field:'birthday' },
            stage,
            { contactId, contactStage: stage, contactName: name, raw: c });
        }
      }
      const ann = c.anniversary || c.anniversaryDate;
      if(ann){
        const d = parseDateInput(ann);
        if(d){
          const e = new Date(year, d.getMonth(), d.getDate());
          e.setHours(0,0,0,0);
          if(!isWithinRange(e, start, end)){
            const prev = new Date(year - 1, d.getMonth(), d.getDate());
            prev.setHours(0,0,0,0);
            if(isWithinRange(prev, start, end)){
              push(prev, 'anniversary', name, text('calendar.subtitle.anniversary'), loanType, undefined,
                { entity:'contacts', id:contactId, field:'anniversary' },
                stage,
                { contactId, contactStage: stage, contactName: name, raw: c });
            }
            continue;
          }
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

  function normalizeProvidedEvents(list, anchorDate, start, end){
    const normalized = [];
    const begin = start instanceof Date ? start.getTime() : null;
    const finish = end instanceof Date ? end.getTime() : null;
    for(const entry of Array.isArray(list) ? list : []){
      if(!entry || typeof entry !== 'object') continue;
      const parsedDate = parseDateInput(entry.date ?? entry.when ?? entry.start);
      if(!(parsedDate instanceof Date)) continue;
      const stamp = parsedDate.getTime();
      if(begin != null && stamp < begin) continue;
      if(finish != null && stamp >= finish) continue;
      const typeKey = String(entry.type || '').trim().toLowerCase() || 'followup';
      const source = entry.source && typeof entry.source === 'object'
        ? {
            entity: String(entry.source.entity || ''),
            id: String(entry.source.id || ''),
            field: String(entry.source.field || '')
          }
        : null;
      const contactId = entry.contactId ? String(entry.contactId).trim() : '';
      const contactStage = entry.contactStage ? String(entry.contactStage).trim() : '';
      const contactName = entry.contactName ? String(entry.contactName).trim() : '';
      const status = entry.status ? String(entry.status).trim() : '';
      const title = entry.title ? String(entry.title) : '';
      const subtitle = entry.subtitle ? String(entry.subtitle) : '';
      const rawLoan = entry.loanKey ? entry.loanKey : (entry.loanType || '');
      const loanMeta = entry.loanKey && LOAN_PALETTE_MAP.has(entry.loanKey)
        ? LOAN_PALETTE_MAP.get(entry.loanKey)
        : resolveLoanMeta(rawLoan);
      const hasLoan = entry.hasLoan != null ? !!entry.hasLoan : !!rawLoan;
      normalized.push({
        date: parsedDate,
        type: typeKey,
        title: title || (EVENT_META_MAP.get(typeKey)?.label || ''),
        subtitle,
        loanKey: loanMeta.key,
        loanLabel: loanMeta.label,
        hasLoan,
        status,
        source,
        contactId,
        contactStage,
        contactName,
        raw: entry
      });
    }
    return normalized;
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
      chip.dataset.event = meta.type;
      chip.setAttribute('title', text('calendar.legend.tooltip.events'));
      const iconWrap = document.createElement('span');
      iconWrap.className = 'icon';
      const iconKey = meta.iconKey || meta.type;
      const iconNode = getEventIcon(iconKey);
      if(iconNode){
        iconWrap.dataset.icon = iconNode.dataset.iconKey || iconKey;
        iconWrap.setAttribute('aria-hidden', 'true');
        iconWrap.appendChild(iconNode);
      }else{
        iconWrap.textContent = '•';
      }
      chip.appendChild(iconWrap);
      chip.append(meta.label);
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

  function renderSkeleton(root, range, currentView){
    if(!root) return;
    root.innerHTML = '';
    root.setAttribute('data-view', currentView);
    const todayStr = new Date().toDateString();
    if(currentView === 'day'){
      const loading = document.createElement('div');
      loading.className = 'muted';
      loading.style.padding = '24px';
      loading.style.textAlign = 'center';
      loading.textContent = 'Loading…';
      root.appendChild(loading);
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    grid.dataset.calendarEnhanced = '1';
    for(let i=0;i<range.days;i++){
      const d = addDays(range.start, i);
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      if(currentView === 'month' && d.getMonth() !== range.anchor.getMonth()){
        cell.classList.add('muted');
      }
      if(d.toDateString() === todayStr){
        cell.classList.add('today');
      }
      const head = document.createElement('div');
      head.className = 'cal-cell-head';
      head.textContent = d.getDate();
      head.style.fontSize = '12px';
      cell.appendChild(head);
      const box = document.createElement('div');
      box.className = 'cal-events';
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.style.fontSize = '11px';
      empty.style.padding = '4px 0 6px';
      empty.textContent = 'Loading…';
      box.appendChild(empty);
      cell.appendChild(box);
      grid.appendChild(cell);
    }
    root.appendChild(grid);
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
    // Build frame
    const range = rangeForView(anchor, view);
    const currentView = range.view;
    const anchorDate = range.anchor;
    const start = range.start;
    const end = range.end;
    const dayCount = range.days;

    const label = document.getElementById('calendar-label');
    const labelText = formatRange(anchorDate, currentView, start, end);
    if(label){
      label.textContent = `${labelText} • Loading…`;
      label.dataset.loading = '1';
    }

    closeEventPopover();
    renderSkeleton(root, range, currentView);

    let events = [];
    try{
      events = await loadEventsBetween(start, end, { anchor: anchorDate, view: currentView });
    }catch (err){
      if(console && console.warn) console.warn('[CAL] provider fallback (empty):', err);
      events = [];
    }

    if(label){
      delete label.dataset.loading;
      label.textContent = labelText;
    }

    root.innerHTML = '';
    root.setAttribute('data-view', currentView);
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
      try{ ready = await ensureContactModalReady(); }
      catch (err){
        if(console && typeof console.warn === 'function'){
          console.warn('contact modal ensure failed', err);
        }
        ready = false;
      }
      if(!ready || typeof openContactModal !== 'function'){
        if(typeof window.toast === 'function'){
          window.toast('Contact unavailable for this event');
        }
        return false;
      }
      logCalendarContact();
      try{ openContactModal(targetId); }
      catch (err) {
        if(console && typeof console.warn === 'function'){
          console.warn('openContactModal failed', err);
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

    if(currentView === 'day'){
      const dayEvents = events.filter(e=> ymd(e.date)===ymd(anchorDate));
      renderDailyView({
        root,
        anchor: anchorDate,
        events: dayEvents,
        metaFor: (type)=> EVENT_META_MAP.get(type) || null,
        iconFor: (type)=> getEventIcon(type),
        openContact: openContactRecord,
        addTask: createTaskFromEvent,
        closePopover: closeEventPopover
      });
    }else{
      const grid = document.createElement('div');
      grid.className = 'calendar-grid';
      grid.dataset.calendarEnhanced = '1';
      for(let i=0;i<dayCount;i++){
        const d = addDays(start,i);
        const inMonth = d.getMonth()===anchorDate.getMonth();

        const cell = document.createElement('div');
        cell.className='cal-cell';
        if(!inMonth && currentView==='month') cell.classList.add('muted');
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

        if(currentView==='month'){
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
          const iconKey = meta && meta.iconKey ? meta.iconKey : (ev.type || '');
          const iconNode = getEventIcon(iconKey);
          if(iconNode){
            icon.dataset.icon = iconNode.dataset.iconKey || iconKey;
            icon.setAttribute('aria-hidden', 'true');
            icon.appendChild(iconNode);
          }else{
            icon.textContent = '•';
          }
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
                if(typeof window !== 'undefined' && typeof window.renderCalendar === 'function'){
                  try{ window.renderCalendar(); }
                  catch (_err){}
                }
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
      if(!events.length){
        const emptyState = document.createElement('div');
        emptyState.className = 'muted';
        emptyState.style.padding = '24px';
        emptyState.style.textAlign = 'center';
        emptyState.setAttribute('role', 'status');
        emptyState.textContent = 'Calendar looks clear! Add tasks or closing dates to see them here.';
        root.appendChild(emptyState);
      }
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
      view: currentView,
      anchor: new Date(anchorDate.getTime()),
      start: rangeStart,
      end: rangeEnd
    };

    calendarApi.loadRange = async function(rangeStartDate, rangeEndDate){
      const safeStart = parseDateInput(rangeStartDate) || null;
      const safeEnd = parseDateInput(rangeEndDate) || null;
      const baseAnchor = safeStart instanceof Date ? safeStart : anchorDate;
      let rangeEvents = [];
      try{
        const loaded = await loadEventsBetween(safeStart, safeEnd, { anchor: baseAnchor, view: currentView });
        if(Array.isArray(loaded)) rangeEvents = loaded;
      }catch (err){
        if(console && console.warn) console.warn('[CAL] provider fallback (empty):', err);
        rangeEvents = [];
      }
      return rangeEvents.map(ev => ({
        type: ev.type,
        title: ev.title,
        subtitle: ev.subtitle,
        status: ev.status || '',
        hasLoan: !!ev.hasLoan,
        loanKey: ev.loanKey || '',
        loanLabel: ev.loanLabel || '',
        date: ev.date instanceof Date ? new Date(ev.date.getTime()) : parseDateInput(ev.date) || new Date(),
        source: ev.source ? { entity: ev.source.entity, id: ev.source.id, field: ev.source.field } : null,
        contactId: ev.contactId || '',
        contactStage: ev.contactStage || '',
        contactName: ev.contactName || ''
      }));
    };

    });
  }

  // Expose as stable impl used by calendar.js
  const __test__ = {
    loanPalette: LOAN_PALETTE.map(meta => ({...meta})),
    normalizeLoanType
  };
  window.__CALENDAR_IMPL__ = { render, collectEvents, normalizeProvidedEvents, __test__ };

})();
