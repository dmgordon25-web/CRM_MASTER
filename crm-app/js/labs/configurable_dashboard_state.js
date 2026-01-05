/**
 * Configurable Dashboard State Module
 * Manages saved dashboard configurations for the zNext-powered Dashboard (Configurable)
 */

const RECOMMENDED_CONFIG_ID = 'recommended';
const LEGACY_VNEXT_PREFIX = 'labs.vnext.layout.';

let isDirtyState = false;
let migrationComplete = false;

/**
 * Generate a unique config ID
 */
function generateConfigId() {
    return 'cfg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Load all dashboard configurations from Settings
 * @returns {Promise<{activeId: string, configs: Object}>}
 */
export async function loadConfigs() {
    if (!window.Settings || typeof window.Settings.get !== 'function') {
        console.warn('[configurable-dashboard] Settings API not available');
        return getDefaultConfigs();
    }
    try {
        const settings = await window.Settings.get();
        const configs = settings.dashboardConfigs || getDefaultConfigs();

        // Perform one-time migration from legacy localStorage
        if (!migrationComplete) {
            await migrateFromLocalStorage(configs);
            migrationComplete = true;
        }

        return configs;
    } catch (err) {
        console.error('[configurable-dashboard] Failed to load configs', err);
        return getDefaultConfigs();
    }
}

/**
 * Get default configs structure
 */
function getDefaultConfigs() {
    return {
        activeId: RECOMMENDED_CONFIG_ID,
        configs: {
            [RECOMMENDED_CONFIG_ID]: {
                name: 'Recommended',
                starred: true,
                layout: [],
                updatedAt: Date.now()
            }
        }
    };
}

/**
 * Migrate layouts from legacy localStorage to new Settings-based storage
 */
async function migrateFromLocalStorage(currentConfigs) {
    if (typeof localStorage === 'undefined') return;

    const sections = ['overview', 'tasks', 'portfolio', 'analytics'];
    let migratedAny = false;

    for (const sectionId of sections) {
        const key = LEGACY_VNEXT_PREFIX + sectionId;
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const layout = JSON.parse(raw);
                if (Array.isArray(layout) && layout.length > 0) {
                    // Create a migrated config if we don't already have user configs
                    const existingUserConfigs = Object.keys(currentConfigs.configs).filter(id => id !== RECOMMENDED_CONFIG_ID);
                    if (existingUserConfigs.length === 0 && !migratedAny) {
                        const migratedId = generateConfigId();
                        currentConfigs.configs[migratedId] = {
                            name: 'Migrated Layout',
                            starred: false,
                            layout: layout,
                            updatedAt: Date.now()
                        };
                        migratedAny = true;
                        console.info('[configurable-dashboard] Migrated legacy layout from localStorage');
                    }
                }
                // Clear legacy key
                localStorage.removeItem(key);
            }
        } catch (err) {
            console.warn('[configurable-dashboard] Failed to migrate legacy layout', key, err);
        }
    }

    // If we migrated, save the updated configs
    if (migratedAny) {
        await saveConfigs(currentConfigs);
    }
}

/**
 * Save configs to Settings
 * @param {{activeId: string, configs: Object}} configs
 * @param {Object} options
 */
async function saveConfigs(configs, options = { silent: true }) {
    if (!window.Settings || typeof window.Settings.save !== 'function') {
        console.warn('[configurable-dashboard] Settings API not available for save');
        return false;
    }
    try {
        await window.Settings.save({ dashboardConfigs: configs }, options);
        return true;
    } catch (err) {
        console.error('[configurable-dashboard] Failed to save configs', err);
        return false;
    }
}

/**
 * Get the currently active configuration
 * @returns {Promise<{id: string, name: string, starred: boolean, layout: Array}>}
 */
export async function getActiveConfig() {
    const data = await loadConfigs();
    const activeId = data.activeId || RECOMMENDED_CONFIG_ID;
    const config = data.configs[activeId] || data.configs[RECOMMENDED_CONFIG_ID];
    return {
        id: activeId,
        name: config?.name || 'Recommended',
        starred: !!config?.starred,
        layout: config?.layout || []
    };
}

/**
 * Save the current layout to the active config
 * @param {Array} layout - Array of widget positions
 * @returns {Promise<boolean>}
 */
export async function saveCurrentLayout(layout) {
    const data = await loadConfigs();
    const activeId = data.activeId || RECOMMENDED_CONFIG_ID;

    if (!data.configs[activeId]) {
        console.error('[configurable-dashboard] Active config not found:', activeId);
        return false;
    }

    data.configs[activeId].layout = layout;
    data.configs[activeId].updatedAt = Date.now();

    const success = await saveConfigs(data, { silent: false });
    if (success) {
        clearDirty();
    }
    return success;
}

/**
 * Save layout as a new configuration
 * @param {string} name - Name for the new config
 * @param {Array} layout - Array of widget positions
 * @returns {Promise<string|null>} - New config ID or null on failure
 */
export async function saveAsNewConfig(name, layout) {
    if (!name || typeof name !== 'string') {
        console.warn('[configurable-dashboard] Invalid name for new config');
        return null;
    }

    const data = await loadConfigs();
    const newId = generateConfigId();

    data.configs[newId] = {
        name: name.trim(),
        starred: false,
        layout: Array.isArray(layout) ? layout : [],
        updatedAt: Date.now()
    };
    data.activeId = newId;

    const success = await saveConfigs(data, { silent: false });
    if (success) {
        clearDirty();
        return newId;
    }
    return null;
}

/**
 * Rename a configuration
 * @param {string} id - Config ID
 * @param {string} newName - New name
 * @returns {Promise<boolean>}
 */
export async function renameConfig(id, newName) {
    if (id === RECOMMENDED_CONFIG_ID) {
        console.warn('[configurable-dashboard] Cannot rename Recommended config');
        return false;
    }

    if (!newName || typeof newName !== 'string') {
        console.warn('[configurable-dashboard] Invalid name');
        return false;
    }

    const data = await loadConfigs();
    if (!data.configs[id]) {
        console.error('[configurable-dashboard] Config not found:', id);
        return false;
    }

    data.configs[id].name = newName.trim();
    data.configs[id].updatedAt = Date.now();

    return saveConfigs(data, { silent: false });
}

/**
 * Delete a configuration
 * @param {string} id - Config ID
 * @returns {Promise<boolean>}
 */
export async function deleteConfig(id) {
    if (id === RECOMMENDED_CONFIG_ID) {
        console.warn('[configurable-dashboard] Cannot delete Recommended config');
        return false;
    }

    const data = await loadConfigs();
    if (!data.configs[id]) {
        console.warn('[configurable-dashboard] Config not found:', id);
        return false;
    }

    delete data.configs[id];

    // If we deleted the active config, switch to Recommended
    if (data.activeId === id) {
        data.activeId = RECOMMENDED_CONFIG_ID;
    }

    return saveConfigs(data, { silent: false });
}

/**
 * Set the active configuration
 * @param {string} id - Config ID to activate
 * @returns {Promise<{id: string, layout: Array}|null>}
 */
export async function setActiveConfig(id) {
    const data = await loadConfigs();

    if (!data.configs[id]) {
        console.error('[configurable-dashboard] Config not found:', id);
        return null;
    }

    data.activeId = id;
    await saveConfigs(data);
    clearDirty();

    return {
        id,
        layout: data.configs[id].layout || []
    };
}

/**
 * Reset to Recommended layout
 * @returns {Promise<{id: string, layout: Array}>}
 */
export async function resetToRecommended() {
    return setActiveConfig(RECOMMENDED_CONFIG_ID);
}

/**
 * Get all config options for dropdown
 * @returns {Promise<Array<{id: string, name: string, starred: boolean}>>}
 */
export async function getConfigOptions() {
    const data = await loadConfigs();
    const options = [];

    // Always put Recommended first
    if (data.configs[RECOMMENDED_CONFIG_ID]) {
        options.push({
            id: RECOMMENDED_CONFIG_ID,
            name: data.configs[RECOMMENDED_CONFIG_ID].name,
            starred: true
        });
    }

    // Add other configs alphabetically
    const otherIds = Object.keys(data.configs)
        .filter(id => id !== RECOMMENDED_CONFIG_ID)
        .sort((a, b) => {
            const nameA = data.configs[a]?.name || a;
            const nameB = data.configs[b]?.name || b;
            return nameA.localeCompare(nameB);
        });

    for (const id of otherIds) {
        options.push({
            id,
            name: data.configs[id].name,
            starred: !!data.configs[id].starred
        });
    }

    return options;
}

/**
 * Mark layout as dirty (has unsaved changes)
 */
export function markDirty() {
    isDirtyState = true;
    document.dispatchEvent(new CustomEvent('configurable-dashboard:dirty', { detail: { dirty: true } }));
}

/**
 * Clear dirty state
 */
export function clearDirty() {
    isDirtyState = false;
    document.dispatchEvent(new CustomEvent('configurable-dashboard:dirty', { detail: { dirty: false } }));
}

/**
 * Check if there are unsaved changes
 * @returns {boolean}
 */
export function isDirty() {
    return isDirtyState;
}

/**
 * Reset all configurable layouts (for Settings danger zone)
 * Keeps only Recommended with default layout
 * @returns {Promise<boolean>}
 */
export async function resetAllConfigurableLayouts() {
    const fresh = getDefaultConfigs();
    const success = await saveConfigs(fresh, { silent: false });
    if (success) {
        clearDirty();
        migrationComplete = true; // Prevent re-migration
    }
    return success;
}
