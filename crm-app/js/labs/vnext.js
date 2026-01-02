/**
 * Labs vNext Grid Engine (Spike)
 * Adapts Gridstack.js to the Labs ecosystem.
 */

// Import bundled Gridstack
// Since we used curl to vendor it, we reference it relative to this file
import '../../vendor/gridstack/gridstack.all.js';
import { VNEXT_WIDGET_DEFAULTS } from './vnext_widget_meta.js';

const VNEXT_STORAGE_PREFIX = 'labs.vnext.layout.';
let activeGrids = new Map();

/**
 * Initialize vNext Grid for a container
 * @param {HTMLElement} container - The section container
 * @param {string} sectionId - 'overview', 'pipeline', etc.
 */
export function enableVNextGrid(container, sectionId) {
    if (!container || !sectionId) return;

    console.log(`[vNext] Initializing grid for ${sectionId}`);
    console.log('[ZNEXT] enableVNextGrid entered');

    if (activeGrids.has(sectionId)) {
        const existing = activeGrids.get(sectionId);
        if (existing.container === container && existing.grid) {
            return existing.grid;
        }
        disableVNextGrid(sectionId);
    }

    // 2. Prepare DOM structure for Gridstack
    // Gridstack expects items to have class 'grid-stack-item' 
    // and content in 'grid-stack-item-content'.
    // Labs widgets are currently direct children of container, e.g. <div class="widget-shell w1">...</div>

    // We need to wrap them if they aren't wrapped, or adapt the class names.
    // Gridstack allow customizing itemClass.

    // Strategy:
    // - Add 'grid-stack' class to container
    // - Wrap each widget (that is not a placeholder) in a proper grid-stack-item structure if needed.
    // - Apply saved layout.

    const savedLayout = loadVNextLayout(sectionId);
    unwrapGridContainer(container);

    const elements = Array.from(container.children).filter(el => el.hasAttribute('data-widget-id'));
    const fragment = document.createDocumentFragment();

    elements.forEach(el => {
        const widgetId = el.getAttribute('data-widget-id');
        const saved = savedLayout ? savedLayout.find(item => item.id === widgetId) : null;
        const defaults = VNEXT_WIDGET_DEFAULTS[widgetId] || {};
        let w = 4;
        let h = 4;

        if (saved) {
            w = saved.width || saved.w || 4;
            h = saved.height || saved.h || 4;
        } else {
            const attrW = el.getAttribute('data-gs-w') || el.getAttribute('data-gs-width');
            const attrH = el.getAttribute('data-gs-h') || el.getAttribute('data-gs-height');
            if (attrW) w = Number.parseInt(attrW, 10) || w;
            if (attrH) h = Number.parseInt(attrH, 10) || h;
            if (!attrW && defaults.w) w = defaults.w;
            if (!attrH && defaults.h) h = defaults.h;
            if (!attrW && !defaults.w) {
                if (el.classList.contains('w2')) w = 8;
                if (el.classList.contains('w3')) w = 12;
            }
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'grid-stack-item';
        wrapper.setAttribute('data-gs-id', widgetId);
        wrapper.setAttribute('gs-id', widgetId);
        wrapper.setAttribute('data-gs-width', w);
        wrapper.setAttribute('data-gs-height', h);
        wrapper.setAttribute('data-gs-x', saved ? saved.x : 0);
        wrapper.setAttribute('data-gs-y', saved ? saved.y : 0);
        wrapper.setAttribute('gs-w', w);
        wrapper.setAttribute('gs-h', h);
        wrapper.setAttribute('gs-x', saved ? saved.x : 0);
        wrapper.setAttribute('gs-y', saved ? saved.y : 0);

        const pct = (w / 12) * 100;
        wrapper.style.setProperty('--gs-column-width', `${pct}%`);
        wrapper.style.setProperty('--gs-cell-height', `${h * 120}px`);

        const content = document.createElement('div');
        content.className = 'grid-stack-item-content';
        content.appendChild(el);

        wrapper.appendChild(content);
        fragment.appendChild(wrapper);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
    container.classList.add('grid-stack');

    // 3. Init Gridstack
    // We expect 'GridStack' to be on window from the import above (UMD).
    // If not, we might need to rely on the side-effect or window property.
    const GS = window.GridStack;
    console.debug('[ZNEXT] Checking GridStack', !!GS);
    if (!GS) {
        console.warn('[vNext] GridStack library not found on window. Ensure it is loaded.');
        return;
    }

    // Inject CSS if needed (Gridstack css)
    // We assumed it's loaded via import or global css. 
    // We should add a link tag if not present?
    // User asked to bundle locally. We read styles/labs.css @import.
    // So we assume styles/labs.css will have the import which we need to add.

    const grid = GS.init({
        column: 12,
        cellHeight: 120, // Tweak height to match widget scale
        margin: 16,     // Match labs gap
        float: false,   // gravity based
        animate: true,
        disableOneColumnMode: true, // Force 12 col or similar?
        draggable: {
            handle: '.widget-header', // Standard labs widget header class
            appendTo: 'body'
        },
        resizable: {
            handles: 'e, se, s, sw, w'
        }
    }, container);

    const handleChange = () => scheduleSave(sectionId, grid);
    grid.on('change', handleChange);

    activeGrids.set(sectionId, {
        grid,
        container,
        changeHandler: handleChange,
        saveTimer: null
    });
}

function loadVNextLayout(sectionId) {
    try {
        const raw = localStorage.getItem(VNEXT_STORAGE_PREFIX + sectionId);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function saveVNextLayout(sectionId, grid) {
    const data = grid.save(false);
    const layout = data.map(node => ({
        id: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
    }));
    try {
        localStorage.setItem(VNEXT_STORAGE_PREFIX + sectionId, JSON.stringify(layout));
    } catch (e) {
        console.warn('[vNext] Unable to persist layout', e);
    }
}

function scheduleSave(sectionId, grid) {
    const entry = activeGrids.get(sectionId);
    if (!entry) return;
    if (entry.saveTimer) {
        clearTimeout(entry.saveTimer);
    }
    entry.saveTimer = setTimeout(() => {
        saveVNextLayout(sectionId, grid);
        entry.saveTimer = null;
    }, 300);
}

export function disableVNextGrid(sectionId) {
    const entry = activeGrids.get(sectionId);
    if (!entry) return;
    if (entry.saveTimer) {
        clearTimeout(entry.saveTimer);
        entry.saveTimer = null;
    }
    if (entry.grid && entry.changeHandler && entry.grid.off) {
        entry.grid.off('change', entry.changeHandler);
    }
    if (entry.grid && entry.grid.destroy) {
        entry.grid.destroy(false);
    }
    if (entry.container) {
        unwrapGridContainer(entry.container);
        entry.container.classList.remove('grid-stack');
    }
    activeGrids.delete(sectionId);
}

function unwrapGridContainer(container) {
    const items = Array.from(container.querySelectorAll(':scope > .grid-stack-item'));
    if (!items.length) return;
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
        const content = item.querySelector('.grid-stack-item-content');
        if (content) {
            while (content.firstChild) {
                fragment.appendChild(content.firstChild);
            }
        } else {
            while (item.firstChild) {
                fragment.appendChild(item.firstChild);
            }
        }
    });
    container.innerHTML = '';
    container.appendChild(fragment);
}
