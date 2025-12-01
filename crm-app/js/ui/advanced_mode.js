import { getUiMode, onUiModeChanged } from './ui_mode.js';

function apply(mode) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.dataset.uiMode = mode;
}

apply(getUiMode());
onUiModeChanged(apply);
