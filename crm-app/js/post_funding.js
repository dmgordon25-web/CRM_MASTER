
// post_funding.js — Idempotent watcher: on first transition to funded, enqueue nurture follow-ups
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
  function addDays(d, n){ const dt = new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10); }
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

  async function onFunded(contact){
    try{
      if(!contact) return;
      await openDB();
      const c = Object.assign({}, contact);
      if(c.postFundingWorkflowTriggered) return;

      const today = ymd(nowDate());
      const fundedBase = c.fundedDate || c.fundedOn || c.closeDate || c.closingDate || today;
      const displayName = contactName(c);
      const nurture = [
        { title:`Nurture: 1-week check-in with ${displayName}`, due:addDays(today, 7) },
        { title:`Nurture: 30-day satisfaction + docs follow-up`, due:addDays(today, 30) },
        { title:`Request review/testimonial`, due:addDays(today, 14) },
        { title:`Annual mortgage review: ${displayName}`, due:addMonths(fundedBase, 11) }
      ];

      const tasks = nurture.map(n => ({
        id: (window.uuid ? uuid() : (Math.random().toString(16).slice(2))),
        contactId: c.id, title: n.title, text: n.title, due: n.due, done:false, updatedAt: Date.now()
      }));

      if(tasks.length) await dbBulkPut('tasks', tasks);

      // timeline + flag
      c.extras = c.extras || {};
      const tl = Array.isArray(c.extras.timeline)? c.extras.timeline : [];
      tl.push({ when:new Date().toISOString(), text:'Post-funding workflow started', tag:'nurture' });
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
        const prev = lc(old?.stage);
        const next = lc(obj.stage);
        if(next==='funded' && prev!=='funded' && !obj.postFundingWorkflowTriggered){
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
          const prev = lc(old?.stage);
          const next = lc(c?.stage);
          if(next==='funded' && prev!=='funded' && !c.postFundingWorkflowTriggered){
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
        if(lc(c.stage)==='funded' && !c.postFundingWorkflowTriggered){
          await onFunded(c);
        }
      }
    }catch (_) {}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rescan);
  else rescan();
})();
