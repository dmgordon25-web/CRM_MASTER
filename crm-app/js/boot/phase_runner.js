/* crm-app/js/boot/phase_runner.js */
export async function runPhase(phaseName, modulePaths, ctx, onEvent){
  const results = [];
  for (const spec of modulePaths){
    const entry = { module: spec, ok: false, usedInit: false, error: null, t0: performance.now(), t1: null };
    try {
      const mod = await import(spec);
      if (typeof mod.init === 'function'){
        entry.usedInit = true;
        await mod.init(ctx);
      }
      entry.ok = true;
    } catch (err){
      entry.error = String(err && err.stack || err);
    } finally {
      entry.t1 = performance.now();
      results.push(entry);
      onEvent && onEvent({ type: 'phase:module', phaseName, ...entry });
    }
  }
  onEvent && onEvent({ type: 'phase:done', phaseName, count: results.length });
  return results;
}

export function checkContract(name, checks){
  const fails = [];
  for (const [label, fn] of Object.entries(checks || {})){
    let ok = false, note = '';
    try { ok = !!fn(); } catch (e){ note = String(e); }
    if (!ok) fails.push(label + (note ? ` (${note})` : ''));
  }
  return { ok: fails.length === 0, fails };
}

export async function runPhaseParallel(phaseName, modulePaths, ctx, onEvent){
  const t0 = performance.now();
  const tasks = modulePaths.map(async (spec) => {
    const entry = { module: spec, ok: false, usedInit: false, error: null, t0: performance.now(), t1: null };
    try {
      const mod = await import(spec);
      if (typeof mod.init === 'function'){
        entry.usedInit = true;
        await mod.init(ctx);
      }
      entry.ok = true;
    } catch (err){
      entry.error = String(err && err.stack || err);
    } finally {
      entry.t1 = performance.now();
      onEvent && onEvent({ type: 'phase:module', phaseName, ...entry });
    }
    return entry;
  });
  const results = await Promise.all(tasks);
  onEvent && onEvent({ type: 'phase:done', phaseName, count: results.length, dt: performance.now() - t0 });
  return results;
}
