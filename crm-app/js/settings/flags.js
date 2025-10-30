const globalObject = typeof window !== 'undefined'
  ? window
  : (typeof globalThis !== 'undefined' ? globalThis : {});

const root = (globalObject && typeof globalObject.__APP_FLAGS__ === 'object' && globalObject.__APP_FLAGS__)
  ? globalObject.__APP_FLAGS__
  : {};

if (!Object.prototype.hasOwnProperty.call(root, 'notificationsMVP')) {
  root.notificationsMVP = false;
}

if (globalObject && typeof globalObject === 'object') {
  globalObject.__APP_FLAGS__ = root;
}

const flags = root;

export { flags };
export default flags;
