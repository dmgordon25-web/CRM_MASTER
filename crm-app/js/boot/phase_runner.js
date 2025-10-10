// crm-app/js/boot/phase_runner.js
export async function runPhase(name, modules, ctx, onError){
  const results = [];
  for (const m of modules){
    try {
      const mod = await import(m);
      if (typeof mod.init === 'function'){
        await mod.init(ctx);
      }
      results.push({ module: m, ok: true });
    } catch (err){
      results.push({ module: m, ok: false, err: String((err && err.stack) || err) });
      onError && onError(name, m, err);
    }
  }
  return results;
}
