# Workflow & Status Map

## Canonical pipeline stages and aliases
- **Canonical keys (ordered)**: long-shot, application, preapproved, processing, underwriting, approved, cleared-to-close, funded, post-close, past-client, returning.
- **Labels**: Long Shot, Application, Pre-Approved, Processing, Underwriting, Approved, **CTC**, Funded, Post Close, Past Client, Returning.
- **Alias coverage (examples)**: CTC, Clear to Close, Clear-to-Close, clear_to_close, cleared to close, clear 2 close, long-shot/long shot/lead, nurture, and legacy prospecting labels mapped onto the canonical keys.
- **Sources**: pipeline stage canonical definitions and alias table in `js/pipeline/constants.js`; stage-key derivation and normalization (including key variants with dashes/underscores) in `js/pipeline/stages.js`.

## Allowed transitions
Allowed next steps per stage (canonicalized in the workflow model):
- long-shot → application, lost
- application → preapproved, long-shot, lost, paused
- preapproved → processing, application, paused
- processing → underwriting, approved, paused
- underwriting → approved, cleared-to-close, paused
- approved → cleared-to-close, processing, paused
- cleared-to-close → funded, post-close
- funded → post-close, past-client
- post-close → past-client, returning
- past-client → returning
- returning → application
- lost → returning

(Defined in the canonical workflow state model at `js/workflow/state_model.js`.)

## Automation triggers and stage/status normalization
- **Workflow normalization**: `normalizeWorkflow` ensures any record’s stage/status/milestone are canonical, allowed for each other, and aligned with milestone/status rules before Labs snapshots or UI uses them (`js/workflow/state_model.js`).
- **Status/milestone constraints**: Stage→status and status→milestone guards/aliases live in `js/pipeline/constants.js` (allowed status sets, cadence/follow-up defaults, milestone ranges).
- **Contact editor automations**: The contact editor declares stage flow, follow-up rules, and descriptive automation blurbs for each stage (e.g., cleared-to-close triggers closing packet reminders) and uses the slider/status sync to keep stage/status/milestone in lockstep (`js/contacts.js`).
- **Labs ingestion**: Labs normalizes contacts via `normalizeWorkflow` when building its model, so downstream widgets consume canonicalized stage/status/milestone data (`js/labs/data.js`).

## Mismatch / conflict notes
- Labs pipeline widgets now normalize lane orders against the canonical stage config before rendering. This prevents duplicate lanes that came from mixed alias keys (e.g., clear_to_close vs cleared-to-close) and collapses snapshot vs. derived stage lists into a single canonical set (`js/labs/crm_widgets.js`).
- Pipeline canonicalization is anchored on `cleared-to-close` (CTC) with aliases for underscore, dash, and label variations (`js/pipeline/constants.js`, `js/pipeline/stages.js`).

## CTC root cause and fixes
- **Kanban drop failure**: The drag/drop stage normalizer did not recognize canonical keys (cleared-to-close/clear_to_close), so CTC lanes failed normalization and rejected drops. The stage normalizer now registers canonical keys and common aliases, and stage label lookup accepts key variants, letting dragover/drop treat CTC as a valid lane (`js/pipeline/stages.js`).
- **Seed mismatch**: Seed data normalized stages via status normalization and wrote `clear_to_close`, which did not match the canonical pipeline key. Seed generation now canonicalizes with pipeline stage normalization and writes the canonical `cleared-to-close` key so the synthetic CTC record lands in the CTC lane (`js/data/seed.js`).
- **Labs duplicates**: Labs widgets could show redundant zero-count lanes when lane order or counts used non-canonical aliases. Lane order is now normalized against canonical stage config to collapse aliases before rendering (`js/labs/crm_widgets.js`).
