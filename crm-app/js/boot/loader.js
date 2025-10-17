/* eslint-disable no-console */
import { CORE, PATCHES } from "./manifest.js";
import { ensureCoreThenPatches } from "./boot_hardener.js";

function shouldEnablePartnerDebug(){
  if(typeof window === "undefined") return false;
  try{
    const search = typeof window.location?.search === "string" ? window.location.search : "";
    if(search){
      try{
        const params = new URLSearchParams(search);
        if(params.get("partnerdebug") === "1"){
          return true;
        }
      }catch(_err){}
    }
  }catch(_err){}
  try{
    if(window.localStorage?.getItem("partnerdebug") === "1"){
      return true;
    }
  }catch(_err){}
  return false;
}

async function maybeLoadPartnerDebug(){
  if(!shouldEnablePartnerDebug()) return;
  try{
    const mod = await import("./partners_dom_debug.js");
    if(mod && typeof mod.ensurePartnerDomDebug === "function"){
      mod.ensurePartnerDomDebug();
    }
  }catch(err){
    try{ console && console.warn && console.warn("[partnerdebug] init failed", err); }
    catch(_err){}
  }
}

// Idempotent guard to avoid double-running
if (!window.__BOOT_LOADER_MAIN__) {
  window.__BOOT_LOADER_MAIN__ = (async () => {
    try {
      await ensureCoreThenPatches({ CORE, PATCHES });
      await maybeLoadPartnerDebug();
    } catch (err) {
      console.error("[boot/loader] unrecoverable boot failure", err);
      try { window.showDiagnosticsOverlay && window.showDiagnosticsOverlay(err); } catch (_) {}
    }
  })();
}

export default window.__BOOT_LOADER_MAIN__;

