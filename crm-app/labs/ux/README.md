# CRM UX Lab

The UX Lab is an isolated playground for experimenting with future UI concepts without touching the production baseline. It lives under `crm-app/labs/ux/` and loads only when you visit the lab route.

## Launching the Lab

1. From the project root, run the static development server that you normally use for the CRM (for example `npm run dev` or `npm run start` if available). Any HTTP server that can serve the `crm-app` directory will work.
2. Navigate to [`/crm-app/labs/ux/`](../ux/) (e.g. `http://localhost:4173/crm-app/labs/ux/` when using Vite).
3. The Lab opens in its own chrome with a mission-control overview, pipeline storyboard, interactive calendar, adaptive dashboard, relationship roster, automation-powered settings, and insights playground. Use the **Back to CRM settings** link in the Lab sidebar to return to the classic experience at any time.

## Design Notes

- **Isolation first.** All markup, scripts, styles, and vendor bundles for the UX Lab are contained within `crm-app/labs/ux/`. No baseline selectors, manifests, or routes were modified.
- **Self-hosted vendor bundles.** Modern UI helpers (FullCalendar, GridStack, and Day.js) are copied into `labs/ux/vendor/` so the Lab works without mutating `package.json` or relying on runtime CDN access.
- **Theme experimentation.** A header switcher lets you toggle between *Sunrise*, *Aurora*, and *Tidepool* palettes. Themes update spacing and color tokens via CSS custom properties scoped to the Lab.
- **Demo surfaces.**
  - **Overview:** Horizon switcher for today/week/quarter focus, sparkline trends, goal footnotes, and signal cards.
  - **Pipeline:** Kanban storyboard with deal metrics, advance buttons, and automation highlights.
  - **Calendar:** Renders partner events with modern navigation controls via FullCalendar DayGrid.
  - **Dashboard:** Uses GridStack to drag and resize cards for workspace prototyping.
  - **Partners:** Provides chip filters, search, and a drawer with edit/schedule actions powered by shared modals.
  - **Settings:** Reimagined profile, goal, and automation toggles that persist in `localStorage`.
  - **Insights:** Timeframe toggles feed scorecards, an engagement heatmap, and recommended strategic actions.
- **Workflow helpers.** A global action bar opens contextual modals (new partner, log activity, schedule events) and toast confirmations—all scoped to the Lab so the baseline CRM remains untouched.

Because the Lab is opt-in and sandboxed, the regular CRM experience and automated checks (`npm run verify:build`, `npm run check:features`) continue to pass unchanged.
