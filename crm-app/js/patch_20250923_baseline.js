import { openPartnerEditor } from './editors/partner_entry.js';
import { openContactEditor } from './editors/contact_entry.js';
import { clearSelectionForSurface } from './services/selection_reset.js';

let __wired = false;
function domReady(){ if(['complete','interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r=>document.addEventListener('DOMContentLoaded', r, {once:true})); }
function ensureCRM(){ window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch(){
  // patch_20250923_baseline.js — name/✎ modals + calendar fallback + nav hooks
  if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if(window.__INIT_FLAGS__.patch_20250923_trim2) return; window.__INIT_FLAGS__.patch_20250923_trim2 = true;
  if(Array.isArray(window.__PATCHES_LOADED__) && !window.__PATCHES_LOADED__.includes('/js/patch_20250923_baseline.js')){
    window.__PATCHES_LOADED__.push('/js/patch_20250923_baseline.js');
  }

  const DIRECT_ATTRS = ['data-id','data-contact-id','data-partner-id','data-row-id'];

  function normalizeKey(value){
    if(value == null) return '';
    const str = String(value).trim().toLowerCase();
    if(!str || str === '—' || str === '-') return '';
    return str.replace(/\s+/g, ' ');
  }

  function normalizeEmail(value){
    if(value == null) return '';
    const str = String(value).trim().toLowerCase();
    if(!str || str === '—') return '';
    return str;
  }

  function normalizePhone(value){
    if(value == null) return '';
    const digits = String(value).replace(/\D+/g, '');
    return digits.length ? digits : '';
  }

  function normalizeStageKey(value){
    const raw = value == null ? '' : value;
    try{
      if(typeof window.canonicalizeStage === 'function'){
        return window.canonicalizeStage(raw);
      }
    }catch (_err) {}
    const base = String(raw).trim().toLowerCase();
    if(!base) return 'application';
    return base.replace(/\s+/g, '-');
  }

  function parseAmountNumber(value){
    if(value == null) return null;
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    if(!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  function directId(node){
    if(!node) return null;
    for(const attr of DIRECT_ATTRS){
      const val = node.getAttribute && node.getAttribute(attr);
      if(val) return String(val);
    }
    if(node.dataset){
      if(node.dataset.id) return String(node.dataset.id);
      if(node.dataset.contactId) return String(node.dataset.contactId);
      if(node.dataset.partnerId) return String(node.dataset.partnerId);
      if(node.dataset.rowId) return String(node.dataset.rowId);
    }
    return null;
  }

  function detectEntity(trigger, row){
    if(trigger && trigger.closest && trigger.closest('.edit-partner,[data-partner-id],.partner-name')) return 'partners';
    if(row && row.closest && row.closest('#view-partners')) return 'partners';
    const table = row && row.closest ? row.closest('table') : null;
    if(table){
      const hint = [
        table.getAttribute('data-entity'),
        table.getAttribute('data-type'),
        table.getAttribute('aria-label'),
        table.dataset ? (table.dataset.scope || table.dataset.type) : null
      ].filter(Boolean).join(' ').toLowerCase();
      if(hint.includes('partner')) return 'partners';
    }
    return 'contacts';
  }

  function getRecordIndex(type){
    const store = window.__RECORD_INDEX__;
    if(!store) return null;
    return store[type] || null;
  }

  function extractContactHints(row){
    const dataset = row && row.dataset ? row.dataset : {};
    const hints = {
      name: dataset.name || dataset.contactName || '',
      email: dataset.email || dataset.contactEmail || '',
      altEmail: dataset.secondaryEmail || '',
      phone: dataset.phone || dataset.contactPhone || '',
      altPhone: dataset.secondaryPhone || '',
      stage: dataset.stage || dataset.status || '',
      loan: dataset.loan || '',
      amount: dataset.amount || '',
      ref: dataset.ref || '',
      funded: dataset.funded || '',
      last: dataset.last || ''
    };
    if(!hints.name && row){
      const label = row.querySelector('[data-role="contact-name"], .contact-name, a');
      if(label) hints.name = label.textContent || '';
      else if(row.cells && row.cells.length>1) hints.name = row.cells[1].textContent || '';
    }
    if(!hints.stage && row && row.cells && row.cells.length>2) hints.stage = row.cells[2].textContent || '';
    if(!hints.loan && row && row.cells && row.cells.length>3) hints.loan = row.cells[3].textContent || '';
    if(!hints.amount && row && row.cells && row.cells.length>4) hints.amount = row.cells[4].textContent || '';
    if(!hints.ref && row && row.cells && row.cells.length>5) hints.ref = row.cells[5].textContent || '';
    return hints;
  }

  function resolveContactFromHints(index, hints){
    if(!index) return null;
    const emailKeys = [normalizeEmail(hints.email), normalizeEmail(hints.altEmail)].filter(Boolean);
    for(const key of emailKeys){
      const id = index.byEmail && index.byEmail.get ? index.byEmail.get(key) : null;
      if(typeof id === 'string' && id) return id;
    }
    const phoneKeys = [normalizePhone(hints.phone), normalizePhone(hints.altPhone)].filter(Boolean);
    for(const key of phoneKeys){
      const id = index.byPhone && index.byPhone.get ? index.byPhone.get(key) : null;
      if(typeof id === 'string' && id) return id;
    }
    const nameKey = normalizeKey(hints.name);
    if(nameKey){
      const unique = index.byName && index.byName.get ? index.byName.get(nameKey) : null;
      if(typeof unique === 'string' && unique) return unique;
      const bucket = index.groupsByName && index.groupsByName.get ? (index.groupsByName.get(nameKey) || []) : [];
      if(bucket.length){
        let candidates = bucket.slice();
        const stageKey = normalizeStageKey(hints.stage);
        if(stageKey){
          candidates = candidates.filter(meta => meta && meta.stage === stageKey);
        }
        const loanKey = normalizeKey(hints.loan);
        if(loanKey){
          candidates = candidates.filter(meta => meta && meta.loan === loanKey);
        }
        const amountVal = parseAmountNumber(hints.amount);
        if(amountVal != null){
          candidates = candidates.filter(meta => meta && meta.amount === amountVal);
        }
        const refTokens = String(hints.ref||'').split('|').map(normalizeKey).filter(Boolean);
        if(refTokens.length){
          candidates = candidates.filter(meta => {
            if(!meta) return false;
            if(meta.referredBy && refTokens.includes(meta.referredBy)) return true;
            if(meta.partnerNames){
              for(const token of refTokens){ if(meta.partnerNames.has(token)) return true; }
            }
            return false;
          });
        }
        if(candidates.length === 1) return candidates[0].id;
        if(candidates.length > 1){
          console.warn('resolveContactFromHints ambiguous match', candidates.map(meta => meta.id));
          return null;
        }
      }
    }
    if(Array.isArray(index.ordered) && index.ordered.length) return index.ordered[0];
    return null;
  }

  function extractPartnerHints(row){
    const dataset = row && row.dataset ? row.dataset : {};
    const hints = {
      name: dataset.name || '',
      company: dataset.company || '',
      email: dataset.email || '',
      altEmail: dataset.secondaryEmail || '',
      phone: dataset.phone || '',
      altPhone: dataset.secondaryPhone || '',
      tier: dataset.tier || ''
    };
    if(!hints.name && row){
      const link = row.querySelector('.partner-name, [data-partner-id]');
      if(link) hints.name = link.textContent || '';
      else if(row.cells && row.cells.length>1) hints.name = row.cells[1].textContent || '';
    }
    if(!hints.company && row && row.cells && row.cells.length>2) hints.company = row.cells[2].textContent || '';
    if(!hints.email && row && row.cells && row.cells.length>3) hints.email = row.cells[3].textContent || '';
    if(!hints.phone && row && row.cells && row.cells.length>4) hints.phone = row.cells[4].textContent || '';
    if(!hints.tier && row && row.cells && row.cells.length>5) hints.tier = row.cells[5].textContent || '';
    return hints;
  }

  function resolvePartnerFromHints(index, hints){
    if(!index) return null;
    const emailKeys = [normalizeEmail(hints.email), normalizeEmail(hints.altEmail)].filter(Boolean);
    for(const key of emailKeys){
      const id = index.byEmail && index.byEmail.get ? index.byEmail.get(key) : null;
      if(typeof id === 'string' && id) return id;
    }
    const phoneKeys = [normalizePhone(hints.phone), normalizePhone(hints.altPhone)].filter(Boolean);
    for(const key of phoneKeys){
      const id = index.byPhone && index.byPhone.get ? index.byPhone.get(key) : null;
      if(typeof id === 'string' && id) return id;
    }
    const nameKey = normalizeKey(hints.name);
    if(nameKey){
      const unique = index.byName && index.byName.get ? index.byName.get(nameKey) : null;
      if(typeof unique === 'string' && unique) return unique;
      const bucket = index.groupsByName && index.groupsByName.get ? (index.groupsByName.get(nameKey) || []) : [];
      if(bucket.length){
        let candidates = bucket.slice();
        const companyKey = normalizeKey(hints.company);
        if(companyKey){
          candidates = candidates.filter(meta => meta && meta.companyKey === companyKey);
        }
        const tierKey = normalizeKey(hints.tier);
        if(tierKey){
          candidates = candidates.filter(meta => meta && meta.tier === tierKey);
        }
        if(candidates.length === 1) return candidates[0].id;
        if(candidates.length > 1){
          console.warn('resolvePartnerFromHints ambiguous match', candidates.map(meta => meta.id));
          return null;
        }
      }
    }
    const companyKey = normalizeKey(hints.company);
    if(companyKey){
      const uniqueCompany = index.byCompany && index.byCompany.get ? index.byCompany.get(companyKey) : null;
      if(typeof uniqueCompany === 'string' && uniqueCompany) return uniqueCompany;
      const bucket = index.groupsByCompany && index.groupsByCompany.get ? (index.groupsByCompany.get(companyKey) || []) : [];
      if(bucket.length === 1) return bucket[0].id;
      if(bucket.length > 1){
        console.warn('resolvePartnerFromHints ambiguous company match', bucket.map(meta => meta.id));
        return null;
      }
    }
    if(Array.isArray(index.ordered) && index.ordered.length) return index.ordered[0];
    return null;
  }

  function resolveRowIdFromIndex(row, type){
    if(!row) return null;
    const nameMap = window.__NAME_ID_MAP__ || {};
    const rawName = row.dataset ? row.dataset.name : null;
    if(rawName && nameMap[rawName]) return nameMap[rawName];
    const index = getRecordIndex(type);
    if(!index) return null;
    if(type === 'partners') return resolvePartnerFromHints(index, extractPartnerHints(row));
    return resolveContactFromHints(index, extractContactHints(row));
  }

  // Name / ✎ → open modals (contacts + partners)
  document.addEventListener('click', (e)=>{
    if(e && e.__crmRowEditorHandled) return;
    const nameCell = e.target.closest('.contact-name, .cell-edit, .edit-contact, .edit-partner, [data-role="contact-name"], [data-role="edit"], button[title="Edit"]');
    if(!nameCell) return;
    const tr = nameCell.closest('tr'); if(!tr) return;
    let id = directId(nameCell) || directId(tr);
    const entity = detectEntity(nameCell, tr);
    const rowGate = (typeof window !== 'undefined' && window.__ROW_BIND_ONCE__)
      ? window.__ROW_BIND_ONCE__[entity === 'partners' ? 'partners' : 'contacts']
      : null;
    if(rowGate && rowGate.active) return;
    if(!id){
      id = resolveRowIdFromIndex(tr, entity);
    }
    if(!id) return;
    const scope = entity === 'partners' ? 'partners' : 'contacts';
    try { clearSelectionForSurface(scope, { reason: `${scope}:row-open` }); }
    catch (_err){}
    e.preventDefault();
    if(entity === 'partners'){
      e.__partnerEditHandled = true;
      const trigger = e.target?.closest('a.partner-name, [data-partner-id]') || nameCell;
      if(trigger && id){
        const normalizedId = String(id).trim();
        try {
          if(trigger.dataset){
            if(!trigger.dataset.partnerId) trigger.dataset.partnerId = normalizedId;
          }
          if(typeof trigger.setAttribute === 'function' && !trigger.getAttribute('data-partner-id')){
            trigger.setAttribute('data-partner-id', normalizedId);
          }
        }catch(_err){}
      }
      if(typeof openPartnerEditor === 'function'){
        try{
          const result = openPartnerEditor(id, {
            trigger,
            source: 'partners:baseline-capture',
            context: 'row-click'
          });
          if(result && typeof result.catch === 'function'){
            result.catch(err => {
              try{ console && console.warn && console.warn('openPartnerEditor failed', err); }
              catch(_warnErr){}
            });
          }
        }catch(err){
          try{ console && console.warn && console.warn('openPartnerEditor error', err); }
          catch(_err){}
        }
        return;
      }
    }else{
      try {
        const result = openContactEditor({ id, __isNew: false }, {
          allowAutoOpen: true,
          sourceHint: 'baseline:row-open',
          trigger: nameCell,
          suppressErrorToast: true
        });
        if(result && typeof result.catch === 'function'){
          result.catch(err => {
            if(typeof window.renderContactModal === 'function'){
              window.renderContactModal(id);
            }
          });
        }
      } catch (err) {
        if(typeof window.renderContactModal === 'function'){
          window.renderContactModal(id);
        }
      }
    }
  }, true);
}

export async function init(ctx){
  ensureCRM();
  const log = (ctx?.logger?.log)||console.log;
  const error = (ctx?.logger?.error) || ((...args) => console.warn('[soft]', ...args));

  if(__wired){
    log('[patch_20250923_baseline.init] already wired');
    window.CRM.health['patch_20250923_baseline'] ??= 'ok';
    return;
  }
  __wired = true;

  try {
    await domReady();
    runPatch();
    window.CRM.health['patch_20250923_baseline'] = 'ok';
    log('[patch_20250923_baseline.init] complete');
  } catch (e) {
    window.CRM.health['patch_20250923_baseline'] = 'error';
    error('[patch_20250923_baseline.init] failed', e);
  }
}

ensureCRM();
window.CRM.modules['patch_20250923_baseline'] = window.CRM.modules['patch_20250923_baseline'] || {};
window.CRM.modules['patch_20250923_baseline'].init = init;

// Aggressive cleaner: remove any fixed-bottom overlays that aren't our #actionbar
export function cleanBottomOverlaysAggressive(){
  try{
    const els = Array.from(document.querySelectorAll('body *')).filter(n=>{
      const s = getComputedStyle(n);
      if(s.position!=='fixed') return false;
      const rect = n.getBoundingClientRect();
      const nearBottom = (window.innerHeight - rect.bottom) <= 64;
      const isActionBar = n.id === 'actionbar';
      const isDialog = n.tagName==='DIALOG' || !!n.closest('dialog');
      return nearBottom && !isActionBar && !isDialog;
    });
    els.forEach(n=>{ try{ n.remove(); }catch (_) { } });
  }catch (e) { console.warn('cleanBottomOverlaysAggressive failed', e); }
}

window.cleanBottomOverlaysAggressive = window.cleanBottomOverlaysAggressive || cleanBottomOverlaysAggressive;
