import { acquireRouteLifecycleToken } from '../route_lifecycle.js';

const STYLE_DEFINITIONS = [
  {
    id: 'crm-theme-base-style',
    origin: 'crm:ui:theme:base',
    css: `
      :root {
        color-scheme: light;
      }

      body[data-crm-theme="active"] {
        background-color: var(--surface-background, #f8fafc);
        color: var(--text-primary, #1f2937);
      }
    `,
    routes: [
      'dashboard',
      'pipeline',
      'partners',
      'longshots',
      'calendar',
      'reports',
      'workbench',
      'templates',
      'labs',
      'notifications',
      'settings',
      'print'
    ],
    bodyFlag: 'data-crm-theme'
  }
];

const styleRefCounts = new Map();
const bodyFlagCounts = new Map();

function getDocument() {
  if (typeof document === 'undefined') return null;
  return document;
}

function ensureStyleElement(doc, definition) {
  if (!doc) return null;
  const cssText = typeof definition.css === 'string' ? definition.css.trim() : '';
  const existing = doc.getElementById(definition.id);
  if (existing) {
    if (existing.textContent !== cssText) {
      existing.textContent = cssText;
    }
    return existing;
  }

  const style = doc.createElement('style');
  style.id = definition.id;
  style.type = 'text/css';
  style.setAttribute('data-origin', definition.origin);
  style.textContent = cssText;

  const target = doc.head || doc.documentElement || doc.body;
  if (target) {
    target.appendChild(style);
  }
  return style;
}

function incrementBodyFlag(doc, flagAttribute) {
  if (!doc || !flagAttribute) return;
  const current = bodyFlagCounts.get(flagAttribute) || 0;
  bodyFlagCounts.set(flagAttribute, current + 1);
  if (current === 0 && doc.body) {
    doc.body.setAttribute(flagAttribute, 'active');
  }
}

function decrementBodyFlag(doc, flagAttribute) {
  if (!doc || !flagAttribute) return;
  const current = bodyFlagCounts.get(flagAttribute) || 0;
  if (current <= 1) {
    bodyFlagCounts.delete(flagAttribute);
    if (doc.body) {
      doc.body.removeAttribute(flagAttribute);
    }
    return;
  }
  bodyFlagCounts.set(flagAttribute, current - 1);
}

function attachStyle(definition) {
  const doc = getDocument();
  if (!doc) return;
  ensureStyleElement(doc, definition);
  styleRefCounts.set(definition.id, (styleRefCounts.get(definition.id) || 0) + 1);
  incrementBodyFlag(doc, definition.bodyFlag);
}

function detachStyle(definition) {
  const doc = getDocument();
  if (!doc) return;
  const count = styleRefCounts.get(definition.id) || 0;
  if (count <= 1) {
    styleRefCounts.delete(definition.id);
    const node = doc.getElementById(definition.id);
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
    decrementBodyFlag(doc, definition.bodyFlag);
    return;
  }

  styleRefCounts.set(definition.id, count - 1);
  decrementBodyFlag(doc, definition.bodyFlag);
}

function registerDefinition(definition) {
  const routes = Array.isArray(definition.routes) ? definition.routes : [];
  if (routes.length === 0) {
    attachStyle(definition);
    return;
  }

  const mount = () => attachStyle(definition);
  const unmount = () => detachStyle(definition);
  routes.forEach((route) => {
    acquireRouteLifecycleToken(route, { mount, unmount });
  });
}

STYLE_DEFINITIONS.forEach(registerDefinition);

export function __debugThemeRegistry() {
  return {
    styles: Array.from(styleRefCounts.entries()),
    flags: Array.from(bodyFlagCounts.entries())
  };
}
