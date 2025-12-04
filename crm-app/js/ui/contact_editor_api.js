// Transitional shim that bridges router calls to the real contacts module.
// Guarantees Promise-based APIs and never throws synchronously so routing/boot stay stable.
// Real contact editor behaviour lives in the contacts module referenced below.
import { logError } from '../util/errors.js';

const CONTACTS_MODULE_PATH = '../contacts.js';
let editorModule = null;
let editorModulePromise = null;

function loadEditorModule() {
  if (editorModule) return Promise.resolve(editorModule);
  if (!editorModulePromise) {
    editorModulePromise = import(CONTACTS_MODULE_PATH)
      .then((mod) => {
        editorModule = mod || null;
        return editorModule;
      })
      .catch((err) => {
        logError('contact_editor_api:import', err);
        editorModulePromise = null;
        return null;
      });
  }
  return editorModulePromise.then((mod) => mod).catch((err) => {
    logError('contact_editor_api:import', err);
    return null;
  });
}

function resolveApi(mod) {
  if (!mod || typeof mod !== 'object') return {};
  return {
    open: typeof mod.openContactEditor === 'function' ? mod.openContactEditor : null,
    close: typeof mod.closeContactEditor === 'function' ? mod.closeContactEditor : null,
    reset: typeof mod.resetContactEditorForRouteLeave === 'function' ? mod.resetContactEditorForRouteLeave : null
  };
}

function logShimError(context, err) {
  logError(`contact_editor_api:${context}`, err);
}

function invokeEditorMethod(methodName, ...args) {
  return loadEditorModule()
    .then((mod) => {
      const api = resolveApi(mod);
      const method = api[methodName];
      if (typeof method === 'function') {
        try {
          return method(...args);
        } catch (err) {
          logShimError(methodName, err);
          return null;
        }
      }
      logShimError(methodName, 'method unavailable');
      return null;
    })
    .catch((err) => {
      logShimError(methodName, err);
      return null;
    });
}

export function getContactEditorApi() {
  return loadEditorModule()
    .then((mod) => resolveApi(mod))
    .catch(() => ({}));
}

export function openContactEditor(target, options) {
  return invokeEditorMethod('open', target, options);
}

export function closeContactEditor(reason) {
  return invokeEditorMethod('close', reason);
}

export function resetContactEditorForRouteLeave() {
  return invokeEditorMethod('reset');
}
