const MAX_NODES = 200;
const NONE_PARTNER = '00000000-0000-none-partner-000000000000';
const EDGE_BUNDLE_SPREAD = 28;
const EDGE_BASE_OPACITY = 0.28;
const EDGE_HIGHLIGHT_OPACITY = 0.9;
const ZOOM_LEVELS = [
  { index: 0, label: 'Overview', cap: 60 },
  { index: 1, label: 'Balanced', cap: 120 },
  { index: 2, label: 'Detail', cap: Number.POSITIVE_INFINITY }
];

const soon = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

const norm = (value) => String(value ?? '').trim();
const text = (value, fallback = '') => {
  const out = norm(value);
  return out || fallback;
};
const arr = (value) => (Array.isArray(value) ? value : []);

const contactName = (contact) => {
  if (!contact) return 'Contact';
  const combo = `${text(contact.first || contact.firstName)} ${text(contact.last || contact.lastName)}`.trim();
  return combo
    || text(contact.name)
    || text(contact.company)
    || text(contact.email)
    || text(contact.phone)
    || (contact.id ? `Contact ${contact.id}` : 'Contact');
};

const partnerName = (partner, id) => {
  if (!partner) return id ? `Partner ${id}` : 'Partner';
  const combo = `${text(partner.first || partner.firstName)} ${text(partner.last || partner.lastName)}`.trim();
  return text(partner.company)
    || text(partner.name)
    || combo
    || text(partner.email)
    || text(partner.phone)
    || (id ? `Partner ${id}` : 'Partner');
};

const syncDiagnostics = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const nodes = document.querySelectorAll('[data-qa="rel-node"]').length;
  const edges = document.querySelectorAll('[data-qa="rel-edge"]').length;
  const keyboardAccess = !!document.querySelector('[data-qa="rel-node"][tabindex="0"]');
  window.__REL_DEBUG__ = { nodes, edges, keyboardAccess };
  try { console.log('REL_SUMMARY', window.__REL_DEBUG__); }
  catch (_err) {}
};

const buildDataset = ({ contacts = [], partners = [], noneId = NONE_PARTNER }) => {
  const skip = norm(noneId);
  const partnerById = new Map();
  for (const partner of partners) {
    const id = norm(partner && partner.id);
    if (id && !partnerById.has(id)) partnerById.set(id, partner);
  }
  const seenContacts = new Set();
  const contactNodes = [];
  const partnerCounts = new Map();
  const edges = [];
  for (const contact of contacts) {
    const contactId = norm(contact && contact.id);
    if (!contactId || seenContacts.has(contactId)) continue;
    seenContacts.add(contactId);
    const linkSet = new Set();
    for (const key of ['partnerId', 'primaryPartnerId', 'buyerPartnerId', 'listingPartnerId', 'referralPartnerId']) {
      const id = norm(contact && contact[key]);
      if (id && id !== skip) linkSet.add(id);
    }
    for (const value of arr(contact && contact.partnerIds)) {
      const id = norm(value);
      if (id && id !== skip) linkSet.add(id);
    }
    if (!linkSet.size) continue;
    contactNodes.push({
      id: contactId,
      name: contactName(contact),
      count: linkSet.size,
      detail: text(contact && (contact.stage || contact.pipelineStage || contact.status))
    });
    for (const partnerId of linkSet) {
      if (!partnerById.has(partnerId)) partnerById.set(partnerId, { id: partnerId });
      partnerCounts.set(partnerId, (partnerCounts.get(partnerId) || 0) + 1);
      edges.push({ contactId, partnerId });
    }
  }
  const partnerNodes = Array.from(partnerCounts.entries()).map(([id, count]) => {
    const record = partnerById.get(id) || null;
    return {
      id,
      name: partnerName(record, id),
      count,
      detail: text(record && (record.focus || record.partnerType || record.tier))
    };
  });
  contactNodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  partnerNodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { contactNodes, partnerNodes, edges };
};

const buildNode = (type, node) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `rel-node rel-${type}`;
  button.dataset.qa = 'rel-node';
  button.dataset.relType = type;
  button.dataset.relId = node.id;
  button.dataset.relKey = `${type}:${node.id}`;
  button.tabIndex = 0;
  button.setAttribute('aria-label', `${node.name} — ${node.count} link${node.count === 1 ? '' : 's'}`);
  const label = document.createElement('span');
  label.className = 'rel-node-label';
  label.textContent = node.name;
  button.appendChild(label);
  if (node.detail) {
    const detail = document.createElement('span');
    detail.className = 'rel-node-detail';
    detail.textContent = node.detail;
    button.appendChild(detail);
  }
  const badge = document.createElement('span');
  badge.className = 'rel-node-count';
  badge.textContent = `${node.count}`;
  button.appendChild(badge);
  return button;
};

const renderFallback = (root, dataset, handlers) => {
  if (root.__relCleanup) {
    try { root.__relCleanup(); }
    catch (_err) {}
  }
  root.innerHTML = '';
  root.classList.remove('rel-map-root');
  root.classList.add('rel-map-fallback');
  const wrap = document.createElement('div');
  wrap.className = 'rel-fallback-shell';
  const title = document.createElement('h4');
  title.className = 'rel-fallback-title';
  title.textContent = 'Zoom to search';
  wrap.appendChild(title);
  const help = document.createElement('p');
  help.className = 'rel-fallback-help';
  help.textContent = 'Too many links to render at once. Search to open a record.';
  wrap.appendChild(help);
  const label = document.createElement('label');
  label.className = 'rel-fallback-search';
  label.textContent = 'Search contacts or partners';
  const input = document.createElement('input');
  input.type = 'search';
  input.setAttribute('aria-label', 'Search contacts or partners');
  label.appendChild(input);
  wrap.appendChild(label);
  const list = document.createElement('ul');
  list.className = 'rel-fallback-results';
  wrap.appendChild(list);
  const items = [
    ...dataset.partnerNodes.map((node) => ({ type: 'partner', node })),
    ...dataset.contactNodes.map((node) => ({ type: 'contact', node }))
  ];
  const draw = (query) => {
    const needle = norm(query).toLowerCase();
    list.innerHTML = '';
    const matches = needle
      ? items.filter(({ node }) => [node.name, node.detail, node.id].some((value) => norm(value).toLowerCase().includes(needle)))
      : items.slice(0, 40);
    matches.slice(0, 60).forEach(({ type, node }) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `rel-fallback-node rel-${type}`;
      btn.dataset.qa = 'rel-node';
      btn.dataset.relType = type;
      btn.dataset.relId = node.id;
      btn.tabIndex = 0;
      btn.textContent = node.detail ? `${node.name} — ${node.detail}` : node.name;
      btn.addEventListener('click', () => (type === 'partner' ? handlers.openPartner(node.id) : handlers.openContact(node.id)));
      li.appendChild(btn);
      list.appendChild(li);
    });
  };
  input.addEventListener('input', () => draw(input.value));
  draw('');
  root.appendChild(wrap);
  root.__relCleanup = null;
  syncDiagnostics();
};

const bundleOffset = (index, total) => {
  if (!total || total <= 1) return 0;
  const spread = Math.min(EDGE_BUNDLE_SPREAD, 6 * (total - 1));
  const step = total > 1 ? spread / (total - 1) : 0;
  return (index * step) - spread / 2;
};

const clampZoomIndex = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(0, Math.min(ZOOM_LEVELS.length - 1, Math.round(numeric)));
};

const describeZoom = (index) => {
  const level = ZOOM_LEVELS[clampZoomIndex(index)];
  return level ? level.label : 'Balanced';
};

const renderMap = (root, dataset, handlers) => {
  if (root.__relCleanup) {
    try { root.__relCleanup(); }
    catch (_err) {}
  }
  root.innerHTML = '';
  root.classList.remove('rel-map-fallback');
  root.classList.add('rel-map-root');

  const controls = document.createElement('div');
  controls.className = 'rel-map-controls';
  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'rel-map-zoom-text';
  zoomLabel.textContent = 'Zoom';
  controls.appendChild(zoomLabel);
  const zoomValue = document.createElement('span');
  zoomValue.className = 'rel-map-zoom-level';
  controls.appendChild(zoomValue);
  const zoomInput = document.createElement('input');
  zoomInput.type = 'range';
  zoomInput.min = '0';
  zoomInput.max = String(ZOOM_LEVELS.length - 1);
  zoomInput.step = '1';
  zoomInput.value = '1';
  zoomInput.setAttribute('aria-label', 'Adjust relationship map zoom');
  controls.appendChild(zoomInput);
  root.appendChild(controls);

  const scroller = document.createElement('div');
  scroller.className = 'rel-map-scroll';
  root.appendChild(scroller);

  const board = document.createElement('div');
  board.className = 'rel-map-board';
  scroller.appendChild(board);

  const columns = document.createElement('div');
  columns.className = 'rel-map-columns';
  board.appendChild(columns);

  const partnersCol = document.createElement('div');
  partnersCol.className = 'rel-map-column rel-partners';
  columns.appendChild(partnersCol);

  const contactsCol = document.createElement('div');
  contactsCol.className = 'rel-map-column rel-contacts';
  columns.appendChild(contactsCol);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('rel-map-edges');
  svg.setAttribute('aria-hidden', 'true');
  board.appendChild(svg);

  const nodes = new Map();
  const links = new Map();
  const segments = [];

  const attachLink = (key, entry) => {
    const list = links.get(key);
    if (list) list.push(entry);
    else links.set(key, [entry]);
  };

  const clear = () => {
    const activeKey = board.dataset.activeKey || '';
    if (!activeKey) return;
    board.dataset.activeKey = '';
    const current = nodes.get(activeKey);
    if (current) current.classList.remove('is-active');
    nodes.forEach((node) => node.classList.remove('is-linked'));
    segments.forEach(({ line }) => line.classList.remove('is-linked'));
  };

  const focus = (key) => {
    if (!key || board.dataset.activeKey === key) return;
    clear();
    board.dataset.activeKey = key;
    const node = nodes.get(key);
    if (!node) return;
    node.classList.add('is-active');
    (links.get(key) || []).forEach(({ target, line }) => {
      const other = nodes.get(target);
      if (other) other.classList.add('is-linked');
      if (line) line.classList.add('is-linked');
    });
  };

  const bind = (element, key, open) => {
    nodes.set(key, element);
    if (!links.has(key)) links.set(key, []);
    element.addEventListener('mouseenter', () => focus(key));
    element.addEventListener('focus', () => focus(key));
    element.addEventListener('blur', () => soon(() => {
      const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
      if (!activeElement || !board.contains(activeElement)) clear();
    }));
    element.addEventListener('click', open);
  };

  const partnerById = new Map(dataset.partnerNodes.map((node) => [node.id, node]));
  const contactById = new Map(dataset.contactNodes.map((node) => [node.id, node]));

  dataset.partnerNodes.forEach((node) => {
    const button = buildNode('partner', node);
    bind(button, `partner:${node.id}`, () => handlers.openPartner(node.id));
    partnersCol.appendChild(button);
  });

  dataset.contactNodes.forEach((node) => {
    const button = buildNode('contact', node);
    bind(button, `contact:${node.id}`, () => handlers.openContact(node.id));
    contactsCol.appendChild(button);
  });

  const partnerTotals = new Map();
  const contactTotals = new Map();
  dataset.edges.forEach((edge) => {
    partnerTotals.set(edge.partnerId, (partnerTotals.get(edge.partnerId) || 0) + 1);
    contactTotals.set(edge.contactId, (contactTotals.get(edge.contactId) || 0) + 1);
  });

  const partnerIndex = new Map();
  const contactIndex = new Map();

  dataset.edges.forEach((edge) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('rel-edge');
    line.dataset.qa = 'rel-edge';
    line.dataset.relPartnerId = edge.partnerId;
    line.dataset.relContactId = edge.contactId;
    svg.appendChild(line);

    const partnerKey = `partner:${edge.partnerId}`;
    const contactKey = `contact:${edge.contactId}`;

    const pIndex = partnerIndex.get(edge.partnerId) || 0;
    partnerIndex.set(edge.partnerId, pIndex + 1);
    const cIndex = contactIndex.get(edge.contactId) || 0;
    contactIndex.set(edge.contactId, cIndex + 1);

    const partnerNode = partnerById.get(edge.partnerId);
    const contactNode = contactById.get(edge.contactId);
    const score = (partnerNode ? partnerNode.count : 0) + (contactNode ? contactNode.count : 0);
    const bundleSize = Math.max(partnerTotals.get(edge.partnerId) || 1, contactTotals.get(edge.contactId) || 1);
    const baseOpacity = Math.max(0.18, EDGE_BASE_OPACITY + 0.05 * Math.max(0, 4 - bundleSize));

    segments.push({
      edge,
      line,
      partnerIndex: pIndex,
      partnerTotal: partnerTotals.get(edge.partnerId) || 1,
      contactIndex: cIndex,
      contactTotal: contactTotals.get(edge.contactId) || 1,
      score,
      baseOpacity,
      visible: true,
      rank: 0
    });

    attachLink(partnerKey, { target: contactKey, line });
    attachLink(contactKey, { target: partnerKey, line });
  });

  const sortedByScore = segments.slice().sort((a, b) => b.score - a.score);
  sortedByScore.forEach((segment, index) => {
    segment.rank = index;
  });

  const updateLines = () => {
    const bounds = board.getBoundingClientRect();
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    segments.forEach((segment) => {
      const { edge, line, partnerIndex: pIndex, partnerTotal, contactIndex: cIndex, contactTotal, visible, baseOpacity } = segment;
      if (!visible) {
        line.setAttribute('opacity', '0');
        return;
      }
      const partnerNode = nodes.get(`partner:${edge.partnerId}`);
      const contactNode = nodes.get(`contact:${edge.contactId}`);
      if (!partnerNode || !contactNode) {
        line.setAttribute('opacity', '0');
        return;
      }
      const partnerRect = partnerNode.getBoundingClientRect();
      const contactRect = contactNode.getBoundingClientRect();
      const x1 = partnerRect.right - bounds.left;
      const y1 = partnerRect.top - bounds.top + partnerRect.height / 2 + bundleOffset(pIndex, partnerTotal);
      const x2 = contactRect.left - bounds.left;
      const y2 = contactRect.top - bounds.top + contactRect.height / 2 + bundleOffset(cIndex, contactTotal);
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.style.opacity = String(baseOpacity);
    });
  };

  const applyZoom = (value) => {
    const index = clampZoomIndex(value);
    zoomValue.textContent = describeZoom(index);
    zoomInput.value = String(index);
    const level = ZOOM_LEVELS[index];
    const cap = level.cap;
    segments.forEach((segment) => {
      const visible = !Number.isFinite(cap) || segment.rank < cap;
      segment.visible = visible;
      if (!visible) {
        segment.line.setAttribute('data-state', 'hidden');
        segment.line.style.opacity = '0';
      } else {
        segment.line.removeAttribute('data-state');
        segment.line.style.opacity = String(segment.baseOpacity);
      }
    });
    updateLines();
  };

  const onZoomInput = (evt) => {
    applyZoom(evt && evt.target ? evt.target.value : zoomInput.value);
  };
  zoomInput.addEventListener('input', onZoomInput);

  board.addEventListener('pointerleave', clear);
  const onScroll = () => soon(updateLines);
  scroller.addEventListener('scroll', onScroll);

  let resizeObserver = null;
  const refresh = () => updateLines();
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(board);
  } else if (typeof window !== 'undefined') {
    window.addEventListener('resize', refresh);
  }

  applyZoom(1);

  root.__relCleanup = () => {
    clear();
    scroller.removeEventListener('scroll', onScroll);
    board.removeEventListener('pointerleave', clear);
    zoomInput.removeEventListener('input', onZoomInput);
    if (resizeObserver && typeof resizeObserver.disconnect === 'function') {
      try { resizeObserver.disconnect(); }
      catch (_err) {}
    } else if (typeof window !== 'undefined') {
      window.removeEventListener('resize', refresh);
    }
    nodes.clear();
    links.clear();
    segments.length = 0;
  };

  syncDiagnostics();
};

export const renderRelationshipMap = (options = {}) => {
  const { root, contacts, partners, nonePartnerId, openContact, openPartner } = options;
  if (!root) return;
  const dataset = buildDataset({ contacts, partners, noneId: nonePartnerId || NONE_PARTNER });
  const handlers = {
    openContact: typeof openContact === 'function' ? openContact : () => {},
    openPartner: typeof openPartner === 'function' ? openPartner : () => {}
  };
  const totalNodes = dataset.contactNodes.length + dataset.partnerNodes.length;
  if (!dataset.edges.length) {
    renderFallback(root, dataset, handlers);
    root.querySelector('.rel-fallback-help')?.classList.add('muted');
    const wrap = root.querySelector('.rel-fallback-shell');
    if (wrap) {
      wrap.insertAdjacentHTML('beforeend', '<div class="muted">No relationships yet. Add partner links to contacts to populate this map.</div>');
    }
    return;
  }
  if (totalNodes > MAX_NODES || dataset.edges.length > MAX_NODES) {
    renderFallback(root, dataset, handlers);
    return;
  }
  renderMap(root, dataset, handlers);
};

export default renderRelationshipMap;
