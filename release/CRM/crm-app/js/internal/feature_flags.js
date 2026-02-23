// Internal-only feature visibility map to prevent accidental resurrection of hidden/legacy surfaces.
export const FEATURE_STATUS = {
  printSuite: { status: 'hidden', entry: 'index.html#view-print' },
  templates: { status: 'hidden', entry: 'index.html#view-templates' },
  legacyAutomations: { status: 'zombie', entry: 'js/patch_2025-09-26_phase2_automations.js' }
};
