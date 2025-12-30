# Seed Full Workflow Dataset

This document describes the "Full Workflow Dataset" seed option added to the Settings panel. This dataset is designed to populate the CRM with a comprehensive, deterministic set of data suitable for demonstrating all major workflows and dashboard widgets.

## Usage
1. Open **Settings** (gear icon).
2. Navigate to **Data Tools**.
3. Click **Seed Full Workflow Dataset**.

## Dataset Composition

### Partners (8 Records)
A diverse set of partners covering various industries to demonstrate filtering and categorization:
- **Real Estate**: Apex Realty (Preferred)
- **Title**: Beta Title (Core)
- **Insurance**: Gamma Insurance (Strategic)
- **Inspection**: Delta Inspections (Developing)
- **Wholesale**: Epsilon Wholesalers (Inactive)
- **Legal**: Zeta Legal (Keep in Touch)
- **Financial**: Eta Financial (Preferred)
- **Builder**: Theta Builders (Core)

### Contacts (12 Records)
Contacts are spread across all pipeline stages and statuses to populate the Funnel and Status widgets:
- **Lead/Nurture**: Aaron Anderson, Julia Jones, Hannah Hill (Long-term nurture)
- **Application**: Beth Baker, Ivan Ingram (Paused)
- **Processing**: Carl Clark, Kevin King
- **Underwriting**: Diana Davis
- **Approved**: Evan Edwards
- **Cleared to Close**: Fiona Foster (triggers closing workflows)
- **Funded/Client**: George Green, Laura Lee (Past clients)

**Special Attributes:**
- **Contact 1 (Aaron)**: Birthday set to today (populates "Upcoming Celebrations").
- **Contact 2 (Beth)**: Anniversary set to today.

### Tasks (20 Records)
- Mix of tasks linked to Contacts vs Partners.
- Due dates range from overdue (past) to future (next 20 days).
- Priorities mixed (High/Normal).
- Ensures "Priority Actions" widget is populated.

### Calendar Events (15 Records)
- Mix of Meeting, Call, Reminder, Closing, Birthday.
- spread over the next 3 weeks, with a concentration in the first week.
- Includes some All-Day events.

### Documents (9 Records)
- 3 contacts in active stages have documents seeded.
- Statuses mixed: Requested, Received, In Review, Approved, Waived.
- Populates Document Center widgets.

## Technical Details
- **File**: `js/seed_full.js`
- **Function**: `runFullWorkflowSeed()`
- **Mechanism**: Use `window.db` directly to upsert records with deterministic IDs (`seed_fw_...`) to ensure repeatability without duplicates.
- **Refresh**: Triggers `app:data:changed` with `mode: full-repaint` to refresh the UI immediately.
