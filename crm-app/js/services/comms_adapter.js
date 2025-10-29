/* services/comms_adapter.js — feature-gated communications adapter skeleton */

const GLOBAL = typeof globalThis !== 'undefined'
  ? globalThis
  : (typeof window !== 'undefined' ? window : null);

const FLAG_KEYS = ['comms.adapter', 'commsAdapter', 'comms_adapter'];

function isTruthy(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === 'number') return !Number.isNaN(value) && value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return ['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized);
  }
  return false;
}

function getFeatureFlags(target) {
  if (!target) return {};
  const ctxFlags = target?.CRM?.ctx?.featureFlags;
  if (ctxFlags && typeof ctxFlags === 'object') {
    return ctxFlags;
  }
  const legacy = target?.__FEATURES__;
  if (legacy && typeof legacy === 'object') {
    return legacy;
  }
  return {};
}

function shouldEnableAdapter(target) {
  const flags = getFeatureFlags(target);
  return FLAG_KEYS.some((key) => isTruthy(flags[key]));
}

function createNoopAdapter() {
  const resolveChannel = () => null;
  return {
    resolve: resolveChannel,
    resolveEmail: resolveChannel,
    resolveSms: resolveChannel
  };
}

function installAdapter(target) {
  if (!target) {
    return { enabled: false, adapter: null };
  }
  const crm = target.CRM = target.CRM || {};
  const adapters = crm.adapters = crm.adapters || {};

  const adapter = adapters.comms && typeof adapters.comms === 'object'
    ? adapters.comms
    : createNoopAdapter();

  adapters.comms = adapter;

  if (typeof crm.resolveEmailHandler !== 'function') {
    Object.defineProperty(crm, 'resolveEmailHandler', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: (context) => adapter.resolveEmail(context)
    });
  }

  if (typeof crm.resolveSmsHandler !== 'function') {
    Object.defineProperty(crm, 'resolveSmsHandler', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: (context) => adapter.resolveSms(context)
    });
  }

  return { enabled: true, adapter };
}

let runtime = { enabled: false, adapter: null };

if (shouldEnableAdapter(GLOBAL)) {
  runtime = installAdapter(GLOBAL);
}

export function isCommsAdapterEnabled() {
  return shouldEnableAdapter(GLOBAL);
}

export function ensureCommsAdapter() {
  if (!GLOBAL) {
    return { enabled: false, adapter: null };
  }
  if (!shouldEnableAdapter(GLOBAL)) {
    runtime = { enabled: false, adapter: null };
    return runtime;
  }
  if (!runtime.enabled || !runtime.adapter) {
    runtime = installAdapter(GLOBAL);
  }
  return runtime;
}

export function getCommsAdapter() {
  return runtime.adapter;
}

export default runtime;
