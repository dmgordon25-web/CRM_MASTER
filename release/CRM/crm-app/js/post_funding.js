
// post_funding.js — Idempotent watcher: keep one annual review reminder aligned to funded date
(function(){
  if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if(window.__INIT_FLAGS__.post_funding) return;
  window.__INIT_FLAGS__.post_funding = true;

  function lc(s){ return String(s||'').toLowerCase(); }
  function nowDate(){
    const override = window.__CRM_NOW__;
    if(typeof override === 'string' || typeof override === 'number' || override instanceof Date){
      const dt = new Date(override);
      if(!isNaN(dt)) return dt;
    }
    return new Date();
  }
  function ymd(d){ return new Date(d).toISOString().slice(0,10); }
  function addMonths(d, n){
    const dt = new Date(d);
    if(isNaN(dt)) return ymd(nowDate());
    const startDay = dt.getDate();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + n);
    const endOfTargetMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(startDay, endOfTargetMonth));
    return dt.toISOString().slice(0,10);
  }
  function contactName(c){
    const first = String(c?.first || c?.firstName || '').trim();
    const last = String(c?.last || c?.lastName || '').trim();
    const full = `${first} ${last}`.trim();
    return full || String(c?.name || 'Client').trim() || 'Client';
  }
  function fundedKey(c){
    return lc(c?.stage || c?.status || c?.pipelineMilestone);
  }
  function isFundedOrClosed(c){
    const key = fundedKey(c);
    return key === 'funded' || key === 'closed' || key === 'funded/closed';
  }
  function fundedDateValue(c){
    const raw = c?.fundedDate || c?.fundedOn || c?.closeDate || c?.closingDate || '';
    const dt = new Date(raw);
    return isNaN(dt) ? '' : dt.toISOString().slice(0,10);
  }
  function annualReminderId(contactId){
    return `postfunding-annual:${String(contactId || '').trim()}`;
  }

  async function onFunded(contact){
    try{
      if(!contact) return;
      await openDB();
      const c = Object.assign({}, contact);
      if(!isFundedOrClosed(c)) return;
      const fundedOn = fundedDateValue(c);
      if(!fundedOn) return;

      const displayName = contactName(c);
      const reminderTitle = `Annual mortgage review: ${displayName}`;
      const reminderDue = addMonths(fundedOn, 11);
      const taskId = annualReminderId(c.id);
      const allTasks = await dbGetAll('tasks');
      const reminder = (allTasks || []).find((task) => {
        if(!task) return false;
        if(task.id === taskId) return true;
        const isLegacyAnnual = String(task.title || task.text || '').startsWith('Annual mortgage review:');
        return isLegacyAnnual && String(task.contactId || '') === String(c.id || '');
      });
      const nextReminder = Object.assign({}, reminder || {}, {
        id: taskId,
        contactId: c.id,
        title: reminderTitle,
        text: reminderTitle,
        due: reminderDue,
        done: reminder?.done === true,
        updatedAt: Date.now(),
        type: reminder?.type || 'reminder',
        meta: Object.assign({}, reminder?.meta || {}, { postFundingAnnual: true, fundedDate: fundedOn })
      });
      await dbPut('tasks', nextReminder);

      // timeline + flag
      c.extras = c.extras || {};
      const tl = Array.isArray(c.extras.timeline)? c.extras.timeline : [];
      if(!c.postFundingWorkflowTriggered){
        tl.push({ when:new Date().toISOString(), text:'Post-funding annual reminder scheduled', tag:'nurture' });
      }
      c.extras.timeline = tl;
      c.postFundingWorkflowTriggered = true;
      c.updatedAt = Date.now();
      await dbPut('contacts', c);

      try{ await renderAll(); }catch (_) {}
    }catch (e) { console.warn('post_funding onFunded error', e); }
  }

  // Compose dbPut/dbBulkPut to detect transitions to funded
  const _dbPut = window.dbPut;
  const _dbBulkPut = window.dbBulkPut;

  window.dbPut = async function(store, obj){
    let old=null;
    try{
      if(store==='contacts' && obj && obj.id){
        old = await dbGet('contacts', obj.id);
      }
    }catch (_) {}
    const res = await _dbPut.call(this, store, obj);
    try{
      if(store==='contacts' && obj){
        const prevFundedDate = fundedDateValue(old);
        const nextFundedDate = fundedDateValue(obj);
        const wasFunded = isFundedOrClosed(old);
        const isFunded = isFundedOrClosed(obj);
        if(isFunded && nextFundedDate && (!wasFunded || prevFundedDate !== nextFundedDate || !obj.postFundingWorkflowTriggered)){
          await onFunded(obj);
        }
      }
    }catch (e) { console.warn('post_funding shim error', e); }
    return res;
  };

  window.dbBulkPut = async function(store, list){
    let beforeIdx = new Map();
    try{
      if(store==='contacts'){
        const before = await dbGetAll('contacts');
        beforeIdx = new Map(before.map(x=> [x.id,x]));
      }
    }catch (_) {}
    const res = await _dbBulkPut.call(this, store, list);
    try{
      if(store==='contacts'){
        for(const c of list){
          const old = beforeIdx.get(c.id);
          const prevFundedDate = fundedDateValue(old);
          const nextFundedDate = fundedDateValue(c);
          const wasFunded = isFundedOrClosed(old);
          const isFunded = isFundedOrClosed(c);
          if(isFunded && nextFundedDate && (!wasFunded || prevFundedDate !== nextFundedDate || !c.postFundingWorkflowTriggered)){
            await onFunded(c);
          }
        }
      }
    }catch (e) { console.warn('post_funding bulk shim error', e); }
    return res;
  };

  // Also scan on startup to catch imported/edited contacts that are funded but not flagged yet
  async function rescan(){
    try{
      await openDB();
      const contacts = await dbGetAll('contacts');
      for(const c of contacts){
        if(isFundedOrClosed(c) && fundedDateValue(c)){
          await onFunded(c);
        }
      }
    }catch (_) {}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rescan);
  else rescan();
})();
