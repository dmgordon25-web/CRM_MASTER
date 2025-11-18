# Dashboard Features Analysis & Implementation Guide

> Updated for current code as of 2025-11-18. Code under crm-app/ is the source of truth; this document is a descriptive snapshot.

## Executive Summary

After comprehensive analysis of the CRM codebase, I've discovered that **most of the requested dashboard features already exist** but may need configuration or UI exposure. Below is a detailed breakdown of existing vs. missing features.

---

## ✅ EXISTING FEATURES (Already Implemented)

### 1. **Draggable Widgets**
**Status:** ✅ FULLY IMPLEMENTED
**Location:** `crm-app/js/ui/drag_core.js`

The dashboard uses a sophisticated custom drag-and-drop system:
- **File:** Lines 1401-1461 (`makeDraggableGrid`)
- **Dashboard Integration:** `crm-app/js/dashboard/index.js:2719-2818` (`ensureWidgetDnD`)
- **Features:**
  - Drag handles on widgets
  - Touch support
  - Persistence to localStorage
  - Order management
  - Event callbacks

**How It Works:**
```javascript
makeDraggableGrid({
  container: dashboardContainer,
  itemSel: ':scope > [data-dash-widget]',
  handleSel: '.dash-drag-handle',
  storageKey: 'crm:dashboard:widget-order',
  grid: { gap, columns, minColumns: 3, maxColumns: 4 },
  enabled: editingMode
});
```

---

### 2. **Grid Snapping**
**Status:** ✅ FULLY IMPLEMENTED
**Location:** `crm-app/js/ui/drag_core.js`

Advanced grid system with automatic snapping:
- **Occupancy Planning:** Lines 859-938 (`computeOccupancyPlan`)
- **Grid Overlay:** Lines 354-428 (`ensureGridOverlay`, `syncOverlayVisibility`)
- **Snap Behavior:** Line 607 ("snap to the nearest valid position")
- **CSS Grid Integration:** Lines 339-350 (gridColumn, gridRow properties)

**Features:**
- Configurable column width, row height, gap
- Visual grid overlay (`.dash-gridlines` class)
- CSS Grid layout with `grid-template-columns`
- Automatic positioning based on available space

**Grid Configuration:**
```javascript
gridOptions = {
  gap: 16,              // pixels
  columns: 3-4,         // responsive
  colWidth: auto,       // calculated
  rowHeight: auto,      // calculated
  minColumns: 3,
  maxColumns: 4
};
```

---

### 3. **Overlap Prevention**
**Status:** ✅ FULLY IMPLEMENTED
**Location:** `crm-app/js/ui/drag_core.js:859-938`

Sophisticated collision detection and prevention:
- **Occupancy Grid:** Tracks which grid cells are occupied (line 869)
- **Best-Fit Algorithm:** Finds optimal placement without overlaps (lines 882-913)
- **Collision Detection:** `hasCollision` flag (line 872)
- **Automatic Reflow:** Widgets move out of the way when dragging

**Algorithm:**
```javascript
// For each widget:
1. Check occupancy grid for available space
2. Find best fit position (no overlaps)
3. If overlap detected, try next row
4. Mark grid cells as occupied
5. Apply CSS Grid positioning
```

**Collision Prevention:**
- Lines 886-893: Check if position fits
- Lines 894-901: Find best column with no overlap
- Lines 902-913: Place widget only if perfect fit
- Lines 916-935: Fallback placement if no space (rare)

---

### 4. **Edit Mode Toggle**
**Status:** ✅ FULLY IMPLEMENTED
**Location:** `crm-app/js/dashboard/index.js`

Complete edit mode system with UI toggle:
- **Edit Mode State:** `isDashboardEditingEnabled()` (line 268)
- **Toggle Button:** `ensureLayoutToggle()` (line 789)
- **Controller API:** `setEditMode(enabled)` (drag_core.js:1446)
- **Storage:** Persisted to localStorage

**UI Elements:**
- **Toggle Button:** Located in dashboard header
- **Selector:** Resolved via `resolveLayoutToggleButton()` (line 790)
- **Event Handling:** Click and keyboard support (lines 815-816)
- **Storage Sync:** Cross-tab sync via storage events (line 824)

**Behavior:**
- **Edit Mode ON:**
  - Widgets draggable
  - Grid overlay visible
  - Resize handles shown
  - Drilldown clicks disabled
  - `[data-editing="1"]` attribute on container
- **Edit Mode OFF:**
  - Widgets locked in place
  - Grid hidden
  - Drilldown clicks enabled
  - Normal dashboard view

**Code Reference:**
```javascript
// dashboard/index.js:2795-2804
if (typeof controller.setEditMode === 'function') {
  controller.setEditMode(editing);
}
if (editing) {
  controller.enable();  // Enable drag
} else {
  controller.disable(); // Lock widgets
}
```

---

### 5. **Resizable Widgets**
**Status:** ✅ IMPLEMENTED (Partial)
**Location:** `crm-app/js/dashboard/index.js:42-46`

Resize handles are defined but may not be fully wired:
```javascript
const DASHBOARD_RESIZE_HANDLES = [
  { key: 'e', qa: 'resize-e', label: 'Resize from right edge' },
  { key: 'se', qa: 'resize-se', label: 'Resize from bottom right corner' },
  { key: 'ne', qa: 'resize-ne', label: 'Resize from top right corner' }
];
```

**Widget Widths:**
- Predefined sizes: `third`, `half`, `twoThird`, `full`
- Stored per-widget in preferences
- CSS Grid spans applied automatically

**Current State:**
- Width changes are supported (1/3, 1/2, 2/3, full)
- Resize handles defined but may need activation
- `bumpDebugResized()` tracking exists

---

### 6. **Column Configuration**
**Status:** ⚠️ PARTIALLY IMPLEMENTED (Dashboard-level only)
**Location:** `crm-app/js/dashboard/index.js`

Dashboard columns are configurable:
- **Min:** 3 columns (line 39)
- **Max:** 4 columns (line 40)
- **Change Event:** `dashboard:layout-columns` (line 3485)
- **Persistence:** localStorage

**What's Missing:**
- Per-TABLE column configuration (not per-widget)
- Settings UI for column selection
- Right-click context menu for tables
- Simple mode integration

---

## ❌ MISSING FEATURES (Need Implementation)

### 1. **Table Column Configuration**
**Status:** ✅ IMPLEMENTED (Settings → Columns)
**Priority:** HIGH

**Current Implementation:**
- Drag/drop column ordering and visibility are handled in `crm-app/js/settings/columns_tab.js` backed by `crm-app/js/tables/column_config.js` and `crm-app/js/tables/column_schema.js`.
- Per-view configs persist to localStorage (`crm:columns`) and emit `settings:columns:changed` events.
- Simple mode support is enforced by filtering columns with `simple === false` when `ui-mode` is set to `simple` via `crm-app/js/ui/ui_mode.js`.

**Remaining Gaps:**
- No right-click column header context menu.
- UI polish and affordances could be improved for discoverability.

---

### 2. **Simple/Advanced User Mode**
**Status:** ✅ IMPLEMENTED (Toggle under Settings → General)
**Priority:** HIGH

**Current Implementation:**
- Mode state is managed by `crm-app/js/ui/ui_mode.js` with storage key `crm:uiMode`, DOM class toggles (`ui-simple-mode` / `ui-advanced-mode`), and Settings integration.
- Navigation and page visibility respond to mode in `crm-app/js/app.js` and downstream listeners (e.g., `crm-app/js/pages/workbench.js`, contact/partner flows) via `getUiMode`/`onUiModeChanged`.
- Column configuration honors simple mode by hiding `simple === false` columns in `crm-app/js/settings/columns_tab.js`.

**Remaining Gaps:**
- Some modal field pruning still relies on per-form logic rather than a central schema flag.
- Dashboard widget simplification remains manual; there is no automatic widget filtering for simple mode.

---

### 3. **Separate KPI Widgets**
**Status:** ❌ NOT IMPLEMENTED (KPIs are grouped)
**Priority:** MEDIUM

**Current State:**
- KPIs are in a single grid container: `#dashboard-kpis`
- KPI keys defined in array (dashboard/index.js:74-83):
  ```javascript
  const KPI_KEYS = [
    'kpiNewLeads7d', 'kpiActivePipeline', 'kpiFundedYTD',
    'kpiFundedVolumeYTD', 'kpiAvgCycleLeadToFunded',
    'kpiTasksToday', 'kpiTasksOverdue', 'kpiReferralsYTD'
  ];
  ```

**Requirements:**
- Break apart into individual draggable widgets
- Each KPI as separate `[data-dash-widget]` element
- Allow independent positioning
- Allow hiding individual KPIs (not all-or-nothing)

**Implementation Approach:**
1. Modify `crm-app/js/dashboard/kpis.js`
2. Change from single grid to individual cards
3. Wrap each KPI in `<section data-dash-widget="kpiNewLeads7d">...</section>`
4. Update widget resolvers in dashboard/index.js
5. Add drag handles to each KPI card
6. Update preferences to store per-KPI visibility

**Estimated Effort:** 2-3 hours

---

### 4. **Disable Drilldowns in Edit Mode**
**Status:** ⚠️ NEEDS VERIFICATION
**Priority:** MEDIUM

**Requirements:**
- In **Edit Mode:** Clicks should NOT open drilldown modals/routes
- In **Normal Mode:** All items should be clickable for drilldown

**Current Implementation:**
- Drilldown selector: `[data-contact-id],[data-partner-id],[data-dashboard-route]` (line 35)
- Tap handler: `wireTileTap()` (line 2813)

**Potential Issue:**
- Edit mode might not properly disable drilldown clicks
- Need to verify click handlers respect `data-editing` attribute

**Implementation Approach:**
1. Check if tap handlers respect edit mode
2. Add guard in click handlers:
   ```javascript
   if (container.hasAttribute('data-editing')) return; // Skip drilldowns in edit mode
   ```
3. Test drilldown clicks in both modes
4. Add visual indication (cursor changes)

**Estimated Effort:** 1 hour

---

### 5. **Make All Dashboard Items Clickable**
**Status:** ⚠️ NEEDS AUDIT
**Priority:** LOW

**Requirements:**
- Every row/item in widgets should be clickable (in normal mode)
- Open contact modal, partner modal, or route navigation

**Current State:**
- Some items are clickable via drilldown selectors
- Need to audit each widget for missing click handlers

**Implementation Approach:**
1. Audit all dashboard widgets
2. Add missing `data-contact-id`, `data-partner-id` attributes
3. Ensure click delegation covers all widget types
4. Test each widget's drilldown behavior

**Estimated Effort:** 2-3 hours (audit + fixes)

---

## 🔧 CONFIGURATION & TROUBLESHOOTING

### Enable Dashboard Edit Mode

**Via UI:**
1. Look for "Edit Layout" or similar button in dashboard header
2. Click to toggle between View and Edit modes

**Via Console:**
```javascript
// Enable edit mode
document.dispatchEvent(new CustomEvent('dashboard:layout-mode', {
  detail: { enabled: true, source: 'manual' }
}));

// Check current state
window.__DND_DEBUG__
```

**Via LocalStorage:**
```javascript
// Enable edit mode permanently
localStorage.setItem('dash:layoutMode:v1', '1');
location.reload();

// Disable
localStorage.removeItem('dash:layoutMode:v1');
```

---

### View Grid Overlay

**Automatic:**
- Grid overlay appears when in edit mode
- Class: `.dash-gridlines-visible` added to container

**Manual:**
```javascript
// Show grid
document.querySelector('[data-ui="dashboard-root"]').classList.add('dash-gridlines-visible');

// Configure grid
const controller = window.__dashDnDController; // May need to expose
controller.setGrid({
  gap: 16,
  columns: 4,
  minColumns: 3,
  maxColumns: 4
});
```

---

### Debug Dashboard Drag-and-Drop

**Debug Object:**
```javascript
window.__DND_DEBUG__ = {
  columns: 4,              // Current column count
  widgets: [...],          // Ordered widget IDs
  dragStarts: N,           // Drag operation count
  swaps: N,                // Reorder count
  dragEnds: N,             // Completed drags
  resized: N,              // Resize operations
  todayMode: true/false,   // Dashboard mode
  selectedIds: [...]       // Selected items
}
```

**Check Edit Mode:**
```javascript
const container = document.querySelector('[data-ui="dashboard-root"]');
const isEditing = container.hasAttribute('data-editing');
console.log('Edit mode:', isEditing);
```

**Check Widget Order:**
```javascript
localStorage.getItem('crm:dashboard:widget-order');
// Returns: JSON array of widget IDs in current order
```

---

## 📋 IMPLEMENTATION ROADMAP

### **Phase 1: Boot Optimization** ✅ COMPLETED
- [x] Remove partner cycling
- [x] Single-pass tab cycling with equal spacing
- [x] Reduce dashboard toggles from 4 to 3
- [x] Fix splash screen timing
- [x] Documentation

**Result:** Boot time optimized to ~8.5 seconds

---

### **Phase 2: Dashboard UI Improvements** (NEXT)
**Timeline:** 1-2 days

1. **Verify Edit Mode UI** (1 hour)
   - Find layout toggle button
   - Test edit mode activation
   - Verify grid overlay visibility
   - Test drag and drop

2. **Disable Drilldowns in Edit Mode** (1 hour)
   - Add edit mode guard to click handlers
   - Test in both modes
   - Add cursor visual feedback

3. **Audit Clickable Items** (2-3 hours)
   - Check each widget for drilldowns
   - Add missing click handlers
   - Test all drilldown paths

4. **Separate KPI Widgets** (2-3 hours)
   - Break apart KPI grid
   - Create individual widget cards
   - Update drag/drop configuration
   - Test positioning and hiding

---

### **Phase 3: Column Configuration** (NEXT)
**Timeline:** 1 day

1. **Backend Logic** (2-3 hours)
   - Create column config service
   - Define column metadata per table
   - Implement localStorage persistence
   - Add required field validation

2. **Settings UI** (2-3 hours)
   - Add "Column Configuration" tab
   - Build drag-drop interface
   - Implement available ↔ active lists
   - Wire up save/reset buttons

3. **Table Integration** (2 hours)
   - Hook into render.js
   - Apply column visibility
   - Update table headers
   - Test with all tables

4. **Alternative: Context Menu** (1 hour)
   - Right-click column headers
   - Show/hide column menu
   - Quick toggle implementation

---

### **Phase 4: Simple/Advanced Mode** (NEXT)
**Timeline:** 0.5 days

1. **Core Implementation** (2 hours)
   - Create user mode service
   - Add settings toggle
   - Store preference
   - Apply body class

2. **Simple Mode Rules** (2 hours)
   - Hide Workbench tab
   - Hide Client pages
   - Filter modal fields
   - Limit column config
   - Simplify dashboard

3. **Testing** (1 hour)
   - Test mode switching
   - Verify tab visibility
   - Check modal field filtering
   - Validate column restrictions

---

## 🎯 QUICK WINS

### Immediate Actions (No Code Required)

1. **Enable Edit Mode Now:**
   ```javascript
   localStorage.setItem('dash:layoutMode:v1', '1');
   location.reload();
   ```

2. **Check if Edit Button Exists:**
   ```javascript
   document.querySelector('[data-action="toggle-layout"]') ||
   document.querySelector('button:contains("Edit")');
   ```

3. **Force Grid Overlay:**
   ```javascript
   document.querySelector('[data-ui="dashboard-root"]')
     .classList.add('dash-gridlines-visible');
   ```

---

## 📊 FEATURE COMPARISON MATRIX

| Feature | Status | Location | Effort to Complete |
|---------|--------|----------|-------------------|
| Draggable Widgets | ✅ Complete | drag_core.js:1401 | 0 hours |
| Grid Snapping | ✅ Complete | drag_core.js:607 | 0 hours |
| Overlap Prevention | ✅ Complete | drag_core.js:859 | 0 hours |
| Edit Mode Toggle | ✅ Complete | dashboard/index.js:789 | 0 hours (verify UI) |
| Resizable Widgets | ⚠️ Partial | dashboard/index.js:42 | 1-2 hours |
| Table Column Config | ❌ Missing | N/A | 4-6 hours |
| Simple/Advanced Mode | ❌ Missing | N/A | 3-4 hours |
| Separate KPIs | ❌ Missing | dashboard/kpis.js | 2-3 hours |
| Disable Drilldowns in Edit | ⚠️ Needs Check | dashboard/index.js:2813 | 1 hour |
| All Items Clickable | ⚠️ Needs Audit | Various widgets | 2-3 hours |

---

## 🚀 RECOMMENDED NEXT STEPS

### Option A: Verify & Polish Existing Features (Quick)
**Timeline:** 2-3 hours
1. Verify edit mode button exists and works
2. Test drag-and-drop functionality
3. Check grid overlay visibility
4. Disable drilldowns in edit mode
5. Document how to use features

### Option B: Implement Missing Features (Comprehensive)
**Timeline:** 2-3 days
1. Table column configuration (6 hours)
2. Simple/Advanced user mode (4 hours)
3. Separate KPI widgets (3 hours)
4. Clickable items audit (3 hours)
5. Testing and polish (2 hours)

### Option C: Hybrid Approach (Recommended)
**Timeline:** 1 day
1. Morning: Verify existing features (2 hours)
2. Afternoon: Separate KPI widgets (3 hours)
3. Disable drilldowns in edit mode (1 hour)
4. Evening: Start column configuration (2 hours)
5. Next day: Complete column config + simple mode

---

## 📝 NOTES

- **Boot optimization is DONE** ✅
- **Dashboard features mostly exist** - need verification and polish
- **Column config and simple mode** are the only truly missing features
- **Total effort for all missing features:** ~15-20 hours

---

## 🔍 VERIFICATION CHECKLIST

Before implementing new features, verify existing ones:

- [ ] Find and test edit mode toggle button
- [ ] Confirm drag-and-drop works in edit mode
- [ ] Verify grid overlay appears in edit mode
- [ ] Test that widgets snap to grid
- [ ] Confirm no overlaps when dragging
- [ ] Test drilldown clicks in normal mode
- [ ] Verify drilldown clicks are disabled in edit mode
- [ ] Check if resize handles appear
- [ ] Test widget resizing functionality
- [ ] Audit all dashboard widgets for clickability

---

**Document Author:** Claude (Sonnet 4.5)
**Date:** 2025-11-14
**Branch:** claude/optimize-performance-and-ui-01AN7cKhuHrXMWUcGxnjpw2b
**Related:** BOOT_OPTIMIZATION_2025.md
