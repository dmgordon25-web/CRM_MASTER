# CRM Lab UX2 - Experimental Dashboard

## Overview

This is an experimental dashboard environment for the CRM application. It provides a sandboxed area to test new UI/UX concepts without affecting the baseline application.

## Features

### ✨ Fully Customizable Dashboard
- **Drag & Drop**: Rearrange widgets by dragging them to new positions
- **Resize**: Resize widgets using the corner handles (in edit mode)
- **Persistent Layout**: Your layout preferences are saved to localStorage
- **Reset Layout**: Restore to default layout with one click

### 🎨 Theme Switcher
- **Default Theme**: Clean, modern light theme
- **Dark Theme**: Easy on the eyes for low-light environments
- **Compact Theme**: Tighter spacing for more content density

### 📦 All Existing Widgets
All widgets from the baseline CRM are available in the Lab:

1. Focus Summary
2. Today's Work
3. Key Performance Indicators
4. Pipeline Overview
5. Upcoming Birthdays & Anniversaries
6. Referral Leaderboard
7. Stale Deals
8. Favorites
9. Production Goals
10. Partner Portfolio
11. Referral Leaders
12. Pipeline Momentum
13. Pipeline Calendar
14. Priority Actions
15. Milestones Ahead
16. Document Pulse
17. Relationship Opportunities
18. Client Care Radar
19. Closing Watchlist
20. Document Center
21. Status Panels
22. Dashboard Filters

### 🔒 Complete Isolation
- No changes to baseline routes, guardrails, or protected selectors
- All Lab CSS/JS contained in `/labs/ux2/`
- No modifications to baseline tokens/styles
- No changes to baseline manifests
- Baseline routes work unchanged

## Access

### From Baseline Dashboard
Click the **🧪 Labs** button next to the "Today" and "All" toggles on the dashboard.

### Direct URL
Navigate to: `crm-app/labs/ux2/index.html`

### Return to Baseline
Click the **"Back to Dashboard"** button in the Lab header.

## Technology Stack

### CDN Libraries (No Build Dependencies)
- **GridStack 10.2.0**: Drag and drop grid layout
- **Day.js 1.11.10**: Date/time handling with plugins
- Pure CSS (no build step required)

### Architecture
- **ES Modules**: Modern JavaScript modules
- **LocalStorage**: Client-side persistence for layout, theme, and preferences
- **Responsive Grid**: 12-column grid system with auto-layout
- **No Overlap Prevention**: GridStack's built-in collision detection

## Usage

### Edit Mode
1. Click the **Edit** button (pencil icon) in the header
2. Drag widgets to rearrange
3. Resize using corner handles
4. Click **Edit** again to lock layout

### Theme Switching
Click one of the theme buttons in the header:
- ☀️ Default (light)
- 🌙 Dark
- 📐 Compact

### Reset Layout
Click the **Reset** button (circular arrow) to restore default layout.

### Hide/Show Widgets
Click the **×** button on any widget to hide it (reload to restore).

## File Structure

```
crm-app/labs/ux2/
├── index.html          # Main Lab HTML
├── README.md           # This file
├── css/
│   └── lab.css         # Lab-specific styles (isolated)
└── js/
    ├── lab.js          # Main Lab JavaScript
    └── widgets.js      # Widget configurations
```

## Storage Keys

The Lab uses the following localStorage keys:
- `lab:ux2:layout:v1` - Grid layout positions
- `lab:ux2:theme:v1` - Selected theme
- `lab:ux2:hidden-widgets:v1` - Hidden widget IDs

## Development

### Adding New Widgets
1. Add configuration to `js/widgets.js` in `WIDGET_CONFIGS`
2. Specify default position (x, y, w, h)
3. Add widget icon (SVG path)
4. Set `enabled: true` to show by default

### Customizing Themes
Edit CSS custom properties in `css/lab.css`:
- `:root` - Default theme
- `[data-lab-theme="dark"]` - Dark theme
- `[data-lab-theme="compact"]` - Compact theme

### Widget Content
Currently widgets show placeholder content. To load actual widget content:
1. Update `loadWidgetFromSource()` in `lab.js`
2. Implement widget-specific loading logic
3. Or embed baseline widgets using iframes

## Verification

### Manifest Audit
```bash
npm run audit:manifest
```
✅ **Status**: PASS

### Baseline Isolation
Only one baseline file modified:
- `crm-app/index.html` (+3 lines for Labs button)

All Lab code isolated in:
- `crm-app/labs/ux2/` (new directory)

### No Breaking Changes
- ✅ Baseline routes unchanged
- ✅ No modifications to guardrails
- ✅ No changes to protected selectors
- ✅ No baseline CSS/JS collisions
- ✅ No changes to baseline manifests
- ✅ `verify:build` audit passes

## Future Enhancements

Potential features for future iterations:
- Widget content loading from baseline
- Custom widget creation
- Dashboard templates
- Export/import layouts
- Widget settings panel
- More themes
- Mobile responsive improvements
- Accessibility enhancements

## Browser Support

- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge (latest versions)
- GridStack requires: `grid` CSS support

## License

Same as main CRM application.

## Notes

- This is an **experimental** environment
- Not intended for production use
- Isolated from baseline application
- Safe to explore and customize
- Layout resets on browser cache clear
