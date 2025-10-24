let logged = false;

function postLog(eventName){
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

function ensureLog(){
  if(logged) return;
  logged = true;
  try{ console && typeof console.info === 'function' && console.info('[VIS] calendar daily expanded'); }
  catch (_err){}
  postLog('calendar-daily-expanded');
}

function slotForEvent(ev){
  const type = (ev && ev.type) ? String(ev.type).toLowerCase() : '';
  switch(type){
    case 'followup':
    case 'task':
      return 'morning';
    case 'closing':
    case 'deal':
    case 'funded':
      return 'afternoon';
    case 'birthday':
    case 'anniversary':
      return 'all-day';
    default:
      return 'midday';
  }
}

const SLOT_DEFS = [
  { key:'all-day', label:'All Day' },
  { key:'morning', label:'9:00 AM' },
  { key:'midday', label:'12:00 PM' },
  { key:'afternoon', label:'3:00 PM' },
  { key:'evening', label:'6:00 PM' }
];

function buildCard(event, metaFor, iconFor, openContact, addTask){
  const card = document.createElement('div');
  card.style.border = '1px solid #e5e7eb';
  card.style.borderRadius = '8px';
  card.style.padding = '10px';
  card.style.background = '#fff';
  card.style.boxShadow = '0 1px 2px rgba(15,23,42,0.08)';
  card.style.display = 'grid';
  card.style.gap = '6px';
  if(event && event.contactId){
    card.tabIndex = 0;
    card.style.cursor = 'pointer';
  }

  const meta = typeof metaFor === 'function' ? metaFor(event.type) : null;

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '10px';
  const iconWrap = document.createElement('span');
  iconWrap.className = 'calendar-daily-icon';
  const iconKey = meta && meta.iconKey ? meta.iconKey : (event && event.type) || '';
  const iconNode = typeof iconFor === 'function' ? iconFor(iconKey) : null;
  if(iconNode){
    const derivedKey = iconNode.dataset && iconNode.dataset.iconKey ? iconNode.dataset.iconKey : iconKey;
    if(derivedKey) iconWrap.dataset.icon = derivedKey;
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(iconNode);
  }else{
    iconWrap.textContent = '•';
  }
  header.appendChild(iconWrap);
  const title = document.createElement('div');
  title.style.fontWeight = '600';
  title.style.fontSize = '13px';
  title.textContent = event.title || (meta && meta.label) || 'Calendar Event';
  header.appendChild(title);
  card.appendChild(header);

  const detail = document.createElement('div');
  detail.style.fontSize = '12px';
  detail.style.color = '#4b5563';
  const detailParts = [];
  if(event.contactName) detailParts.push(event.contactName);
  if(event.subtitle) detailParts.push(event.subtitle);
  if(event.contactStage) detailParts.push(event.contactStage);
  detail.textContent = detailParts.filter(Boolean).join(' • ');
  card.appendChild(detail);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.flexWrap = 'wrap';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'btn';
  openBtn.textContent = 'Open Contact';
  if(!event.contactId){
    openBtn.disabled = true;
  }
  openBtn.addEventListener('click', (evt)=>{
    evt.preventDefault();
    evt.stopPropagation();
    if(!event.contactId) return;
    if(typeof openContact === 'function'){
      Promise.resolve(openContact(event.contactId)).catch(()=>{});
    }
  });
  actions.appendChild(openBtn);

  const taskBtn = document.createElement('button');
  taskBtn.type = 'button';
  taskBtn.className = 'btn brand';
  taskBtn.textContent = 'Add as Task';
  if(!event.contactId){
    taskBtn.disabled = true;
  }
  taskBtn.addEventListener('click', async (evt)=>{
    evt.preventDefault();
    evt.stopPropagation();
    if(taskBtn.disabled) return;
    taskBtn.disabled = true;
    try{
      const result = typeof addTask === 'function' ? await addTask(event) : null;
      if(!result || result.status !== 'ok'){
        taskBtn.disabled = false;
      }
    }catch (err){
      taskBtn.disabled = false;
      console && console.warn && console.warn('daily task create failed', err);
    }
  });
  actions.appendChild(taskBtn);
  card.appendChild(actions);

  const triggerOpen = ()=>{
    if(!event || !event.contactId) return;
    if(typeof openContact !== 'function') return;
    Promise.resolve(openContact(event.contactId)).catch(()=>{});
  };
  if(event && event.contactId){
    card.addEventListener('click', (evt)=>{
      if(evt.defaultPrevented) return;
      triggerOpen();
    });
    card.addEventListener('keydown', (evt)=>{
      if(evt.defaultPrevented) return;
      if(evt.key === 'Enter' || evt.key === ' '){
        evt.preventDefault();
        triggerOpen();
      }
    });
  }

  return card;
}

export function renderDailyView({ root, anchor, events, metaFor, iconFor, openContact, addTask, closePopover }){
  if(!root) return;
  if(typeof closePopover === 'function'){
    try{ closePopover(); }
    catch (_err){}
  }
  ensureLog();
  root.innerHTML = '';

  const container = document.createElement('div');
  container.dataset.calendarDaily = '1';
  container.dataset.calendarEnhanced = '1';
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'minmax(200px, 260px) 1fr';
  container.style.gap = '24px';
  container.style.alignItems = 'start';

  const timeline = document.createElement('div');
  timeline.style.display = 'grid';
  timeline.style.gap = '12px';

  const buckets = new Map(SLOT_DEFS.map(slot => [slot.key, []]));
  (events || []).forEach(event => {
    const key = slotForEvent(event);
    if(!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(event);
  });

  SLOT_DEFS.forEach(slot => {
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '80px 1fr';
    row.style.gap = '10px';
    row.style.alignItems = 'start';

    const label = document.createElement('div');
    label.style.fontWeight = '600';
    label.style.fontSize = '12px';
    label.style.color = '#6b7280';
    label.textContent = slot.label;
    row.appendChild(label);

    const list = document.createElement('div');
    list.style.display = 'grid';
    list.style.gap = '10px';
    const listEvents = buckets.get(slot.key) || [];
    if(listEvents.length === 0){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.style.fontSize = '12px';
      empty.textContent = 'No events';
      list.appendChild(empty);
    }else{
      listEvents.forEach(ev => {
        list.appendChild(buildCard(ev, metaFor, iconFor, openContact, addTask));
      });
    }
    row.appendChild(list);
    timeline.appendChild(row);
  });

  container.appendChild(timeline);

  const summary = document.createElement('div');
  summary.style.display = 'grid';
  summary.style.gap = '12px';
  summary.style.background = '#f9fafb';
  summary.style.border = '1px solid #e5e7eb';
  summary.style.borderRadius = '12px';
  summary.style.padding = '16px';

  const dayLabel = document.createElement('div');
  dayLabel.style.fontSize = '18px';
  dayLabel.style.fontWeight = '600';
  const isToday = anchor instanceof Date && !Number.isNaN(anchor.getTime())
    && new Date().toDateString() === anchor.toDateString();
  dayLabel.textContent = isToday ? 'Today' : 'Selected Day';
  summary.appendChild(dayLabel);

  const dateLabel = document.createElement('div');
  dateLabel.style.fontSize = '13px';
  dateLabel.style.color = '#4b5563';
  const dateFmt = anchor instanceof Date && !Number.isNaN(anchor.getTime())
    ? anchor.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' })
    : '';
  dateLabel.textContent = dateFmt;
  summary.appendChild(dateLabel);

  const agenda = document.createElement('div');
  agenda.style.display = 'grid';
  agenda.style.gap = '8px';

  const agendaTitle = document.createElement('div');
  agendaTitle.style.fontWeight = '600';
  agendaTitle.style.fontSize = '13px';
  agendaTitle.textContent = 'Quick Actions';
  agenda.appendChild(agendaTitle);

  const actionable = (events || []).slice().sort((a,b)=>{
    const at = a.date ? a.date.getTime() : 0;
    const bt = b.date ? b.date.getTime() : 0;
    return at - bt;
  }).slice(0, 3);

  if(actionable.length === 0){
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.style.fontSize = '12px';
    empty.textContent = 'All clear — add a follow-up from the calendar.';
    agenda.appendChild(empty);
  }else{
    actionable.forEach(ev => {
      const wrap = document.createElement('div');
      wrap.style.display = 'grid';
      wrap.style.gap = '6px';
      wrap.appendChild(buildCard(ev, metaFor, iconFor, openContact, addTask));
      agenda.appendChild(wrap);
    });
  }

  summary.appendChild(agenda);
  container.appendChild(summary);

  root.appendChild(container);
}

export default renderDailyView;
