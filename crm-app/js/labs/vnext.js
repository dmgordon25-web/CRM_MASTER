/**
 * Labs vNext Grid Engine (Spike)
 * Adapts Gridstack.js to the Labs ecosystem.
 */

// Import bundled Gridstack
// Since we used curl to vendor it, we reference it relative to this file
import '../../vendor/gridstack/gridstack.all.js';

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

    // 1. Destroy existing instance if any
    if (activeGrids.has(sectionId)) {
        const old = activeGrids.get(sectionId);
        old.destroy(false); // don't remove elements
        activeGrids.delete(sectionId);
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
    const elements = Array.from(container.children).filter(el => el.hasAttribute('data-widget-id'));

    // Clear container to rebuild structure safely
    // (We detach elements, wrap them, re-append)
    const fragment = document.createDocumentFragment();

    elements.forEach(el => {
        // Determine props
        const widgetId = el.getAttribute('data-widget-id');
        const saved = savedLayout ? savedLayout.find(item => item.id === widgetId) : null;

        // Default size mapping
        // If saved exists, use it. Else infer from class.
        let w = 4; // default small
        let h = 4; // default height units

        if (saved) {
            w = saved.width || saved.w || 4;
            h = saved.height || saved.h || 4;
        } else {
            if (el.classList.contains('w2')) w = 8;
            if (el.classList.contains('w3')) w = 12;
            // Infer height approx from content? 
            // Gridstack handles auto-height somewhat, but better to set a default.
        }

        // Wrap
        const wrapper = document.createElement('div');
        wrapper.className = 'grid-stack-item';
        // Compatibility: Set both dataset and manual attributes for different GS versions
        wrapper.setAttribute('data-gs-id', widgetId);
        wrapper.setAttribute('data-gs-width', w);
        wrapper.setAttribute('data-gs-height', h);
        wrapper.setAttribute('gs-w', w);
        wrapper.setAttribute('gs-h', h);

        if (saved) {
            wrapper.setAttribute('data-gs-x', saved.x);
            wrapper.setAttribute('data-gs-y', saved.y);
            wrapper.setAttribute('gs-x', saved.x);
            wrapper.setAttribute('gs-y', saved.y);
        }

        // Fix: Manually set CSS variables to bridge JS/CSS version mismatch
        // The CSS expects --gs-column-width but old JS might not set it.
        const pct = (w / 12) * 100;
        wrapper.style.setProperty('--gs-column-width', `${pct}%`);
        wrapper.style.setProperty('--gs-cell-height', `${h * 120}px`);

        const content = document.createElement('div');
        content.className = 'grid-stack-item-content';
        // Move element into content
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

    // 4. Persistence
    grid.on('change', (event, items) => {
        saveVNextLayout(sectionId, grid);
    });

    activeGrids.set(sectionId, grid);
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
    localStorage.setItem(VNEXT_STORAGE_PREFIX + sectionId, JSON.stringify(layout));
}
