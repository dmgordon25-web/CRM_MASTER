# CRM UX Lab

The UX Lab is an isolated playground for experimenting with future UI concepts without touching the production baseline. It lives under `crm-app/labs/ux/` and loads only when you visit the lab route.

## Launching the Lab

1. From the project root, run the static development server that you normally use for the CRM (for example `npm run dev` or `npm run start` if available). Any HTTP server that can serve the `crm-app` directory will work.
2. Navigate to [`/crm-app/labs/ux/`](../ux/) (e.g. `http://localhost:4173/crm-app/labs/ux/` when using Vite).
3. You will see the experimental shell with the calendar, adaptive dashboard, and partner list demos. Baseline routes such as `/crm-app/index.html` remain unchanged.

## Design Notes

- **Isolation first.** All markup, scripts, styles, and vendor bundles for the UX Lab are contained within `crm-app/labs/ux/`. No baseline selectors, manifests, or routes were modified.
- **Self-hosted vendor bundles.** Modern UI helpers (FullCalendar, GridStack, and Day.js) are copied into `labs/ux/vendor/` so the Lab works without mutating `package.json` or relying on runtime CDN access.
- **Theme experimentation.** A header switcher lets you toggle between *Sunrise*, *Aurora*, and *Tidepool* palettes. Themes update spacing and color tokens via CSS custom properties scoped to the Lab.
- **Demo surfaces.**
  - **Calendar:** Renders partner events with modern navigation controls via FullCalendar DayGrid.
  - **Dashboard:** Uses GridStack to drag and resize cards for workspace prototyping.
  - **Partners:** Provides chip filters and a drawer modal for rapid context.

Because the Lab is opt-in and sandboxed, the regular CRM experience and automated checks (`npm run verify:build`, `npm run check:features`) continue to pass unchanged.
