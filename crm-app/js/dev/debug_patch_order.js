// Dev helper: logs resolved patch load order when ?debugPatches=1 is present.
export function printPatchLoadOrder({ core = [], patches = [] } = {}) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search || '');
  if (params.get('debugPatches') !== '1') return;

  const normalize = (spec) => {
    if (typeof spec !== 'string') return String(spec);
    try {
      return new URL(spec, window.location.href).href;
    } catch (_) {
      return spec;
    }
  };

  const rows = [];
  let index = 0;
  for (const spec of core || []) {
    index += 1;
    rows.push({ phase: 'CORE', order: index, spec, normalized: normalize(spec) });
  }
  for (const spec of patches || []) {
    index += 1;
    rows.push({ phase: 'PATCH', order: index, spec, normalized: normalize(spec) });
  }

  console.groupCollapsed(`[debugPatches] planned module load order (${rows.length})`);
  console.table(rows);
  console.log('[debugPatches] expected patches', Array.isArray(window.__EXPECTED_PATCHES__) ? window.__EXPECTED_PATCHES__ : []);
  console.log('[debugPatches] loaded patches', Array.isArray(window.__PATCHES_LOADED__) ? window.__PATCHES_LOADED__ : []);
  console.groupEnd();
}
