# CRM Field & Status Audit

## Executive Summary
This document provides a comprehensive audit of all fields, statuses, milestones, and workflow logic in THE CRM Tool. It identifies which elements are actively used, their purposes, data types, validation rules, and interdependencies.

---

## Pipeline Stages

### Active Pipeline Stages
These are the canonical stages contacts progress through:

1. **Long Shot** (alias: Lead, Prospect, New Lead, Buyer Lead)
   - Data Type: String
   - Purpose: Initial lead capture, cold prospects
   - Triggers: Initial contact creation
   - Next Steps: Qualification call, application start
   - Used in: Leads page, Dashboard widgets, Kanban board

2. **Application** (aliases: Application Started, Nurture)
   - Data Type: String
   - Purpose: Contact has expressed interest, application in progress
   - Triggers: Application form opened
   - Follow-up Cadence: 3 days
   - Next Steps: Pre-approval, document gathering
   - Used in: Pipeline page, Kanban board, Status tracking

3. **Pre-Approved**
   - Data Type: String
   - Purpose: Initial approval granted, conditions pending
   - Triggers: Lender pre-approval received
   - Next Steps: Full application, document collection
   - Used in: Pipeline page, Kanban board

4. **Processing** (alias: Docs Gathering, Doc Gathering)
   - Data Type: String
   - Purpose: Documents being collected and processed
   - Triggers: Document checklist initiated
   - Follow-up Cadence: 2 days
   - Next Steps: Underwriting
   - Used in: Pipeline page, Kanban board, Document center

5. **Underwriting** (aliases: Under-write, Under Writing)
   - Data Type: String
   - Purpose: Loan file under review by underwriter
   - Triggers: File submitted to underwriting
   - Follow-up Cadence: 2 days
   - Next Steps: Approval or conditions
   - Used in: Pipeline page, Kanban board, Status tracking

6. **Approved**
   - Data Type: String
   - Purpose: Underwriting approval received
   - Triggers: Underwriter approval
   - Next Steps: Clear to close
   - Used in: Pipeline page, Client stages, Kanban board

7. **CTC** (Clear to Close, aliases: Cleared to Close, Clear-to-Close)
   - Data Type: String
   - Purpose: All conditions met, ready for closing
   - Triggers: Final approval from lender
   - Follow-up Cadence: 1 day
   - Next Steps: Funding
   - Used in: Pipeline page, Client stages, Closing watchlist

8. **Funded** (aliases: Closed, Funded/Closed, Post Close, Past Client)
   - Data Type: String
   - Purpose: Loan has funded and closed
   - Triggers: Funding date recorded
   - Follow-up Cadence: 14 days (nurture)
   - Next Steps: Post-close nurture, referral request
   - Used in: Client portfolio, Reports, Commissions tracking

### Inactive/Special Stages
- **Lost** (aliases: Denied, Cancelled, Withdrawn, Closed Lost)
  - Purpose: Deal fell through or was denied
  - Used in: Historical reporting only
  - Not displayed in active pipeline

---

## Pipeline Milestones

### Active Milestones (Sequential Progression)
Milestones track granular progress within stages:

1. **Intro Call** (Index: 0)
   - Allowed Statuses: nurture, inprogress, paused, lost
   - Purpose: Initial contact conversation
   - Triggers: First meaningful contact logged

2. **Application Sent** (Index: 1)
   - Allowed Statuses: nurture, inprogress, paused, lost
   - Purpose: Application form sent to borrower
   - Triggers: Application link shared

3. **Application Submitted** (Index: 2)
   - Allowed Statuses: inprogress, active, paused, lost
   - Purpose: Completed application received
   - Triggers: Application form submitted

4. **UW in Progress** (Index: 3)
   - Allowed Statuses: inprogress, active, paused
   - Purpose: File actively being underwritten
   - Triggers: Submission to underwriting

5. **Conditions Out** (Index: 4)
   - Allowed Statuses: active, paused
   - Purpose: Underwriter conditions issued
   - Triggers: Condition list received

6. **Clear to Close** (Index: 5)
   - Allowed Statuses: active, paused
   - Purpose: Final approval, ready to close
   - Triggers: All conditions cleared

7. **Docs Out** (Index: 6)
   - Allowed Statuses: active, client
   - Purpose: Closing documents sent
   - Triggers: Closing docs generated

8. **Funded / Post-Close** (Index: 7)
   - Allowed Statuses: client
   - Purpose: Loan has funded
   - Triggers: Funding date recorded

**Important Rule:** Milestones must align with statuses. The system enforces that milestone index falls within the allowed range for the current status.

---

## Pipeline Status Keys

### Active Statuses

1. **inprogress**
   - Label: "In Progress"
   - Allowed Milestones: 0-3 (Intro Call through UW in Progress)
   - Purpose: Early pipeline deals
   - Visual: Blue tone
   - Used in: Dashboard "In Progress" widget, Pipeline filters

2. **active**
   - Label: "Active Pipeline"
   - Allowed Milestones: 2-6 (Application Submitted through Docs Out)
   - Purpose: Deals actively moving through underwriting
   - Visual: Blue tone
   - Used in: Dashboard "Active Pipeline" widget, Pipeline page

3. **client**
   - Label: "Client Stages"
   - Allowed Milestones: 7 (Funded / Post-Close only)
   - Purpose: Funded deals, post-close nurture
   - Visual: Green tone
   - Used in: Client Portfolio page, Reports, Commissions

4. **paused**
   - Label: "Paused"
   - Allowed Milestones: 0-6
   - Purpose: Temporarily on hold (buyer delays, market issues)
   - Visual: Yellow tone
   - Used in: Dashboard filters only (not primary display)

5. **lost**
   - Label: "Lost"
   - Allowed Milestones: 0-2 (Early pipeline only)
   - Purpose: Deal fell through
   - Visual: Red tone
   - Used in: Historical reporting, conversion analytics

6. **nurture**
   - Label: "Leads & Nurture"
   - Allowed Milestones: 0-1 (Intro Call, Application Sent)
   - Purpose: Long-term nurture contacts
   - Visual: Light blue tone
   - Used in: Leads page, Dashboard "Leads & Nurture" widget

---

## Contact Fields

### Required Fields (Cannot be empty)
1. **name** (or firstName + lastName)
   - Data Type: String (max 200 chars)
   - Validation: At least one character
   - Purpose: Primary identifier
   - Used in: All tables, modals, search, reports

2. **email** OR **phone** (at least one required)
   - **email**
     - Data Type: String (max 255 chars)
     - Validation: Valid email format (regex: `^[^\s@]+@[^\s@]+\.[^\s@]+$`)
     - Purpose: Communication, unique identifier
     - Used in: All communication, notifications, duplicate detection
   
   - **phone**
     - Data Type: String (max 50 chars)
     - Validation: Phone number format (flexible)
     - Purpose: Communication, unique identifier
     - Used in: Call logging, SMS notifications, duplicate detection

### Core Pipeline Fields (Used in Workflow)
3. **stage**
   - Data Type: String (enum from PIPELINE_STAGES)
   - Validation: Must match canonical stage
   - Purpose: Primary workflow position
   - Triggers: Automation rules, follow-up scheduling
   - Used in: Kanban board, pipeline widgets, filters

4. **status**
   - Data Type: String (enum from PIPELINE_STATUS_KEYS)
   - Validation: Must be valid status key
   - Purpose: Granular status tracking within stages
   - Linked to: Milestone restrictions (enforced)
   - Used in: Dashboard widgets, reports, filters

5. **pipelineMilestone**
   - Data Type: String (enum from PIPELINE_MILESTONES)
   - Validation: Must fall within allowed range for current status
   - Purpose: Track detailed progress
   - Linked to: Status (automatically corrected if out of range)
   - Used in: Pipeline tracking, automation triggers

6. **loanAmount**
   - Data Type: Number (decimal, positive)
   - Validation: >= 0, max 50,000,000
   - Purpose: Loan volume calculations, commissions
   - Used in: Reports, KPIs, portfolio metrics, commission calculations

7. **loanType**
   - Data Type: String (enum: Conventional, FHA, VA, Jumbo, USDA, Other)
   - Validation: Must be from predefined list
   - Purpose: Product categorization, document requirements
   - Triggers: Document checklist assignment
   - Used in: Filters, reports, document automation

8. **interestRate**
   - Data Type: Number (decimal, 0-100)
   - Validation: 0 <= rate <= 100
   - Purpose: Rate tracking, reports
   - Used in: Reports only (not in automation)

9. **fundedDate**
   - Data Type: Date (ISO 8601)
   - Validation: Valid date, not in future
   - Purpose: Closing date, commission tracking
   - Triggers: Status change to 'client', commission calculations
   - Used in: Reports, KPIs, commission ledger, nurture scheduling

10. **nextFollowUp**
    - Data Type: Date (ISO 8601)
    - Validation: Valid date
    - Purpose: Task scheduling, follow-up reminders
    - Triggers: Dashboard "Priority Actions" widget
    - Used in: Dashboard widgets, calendar, task management

11. **lastContact**
    - Data Type: Date (ISO 8601)
    - Validation: Valid date, not in future
    - Purpose: Relationship tracking
    - Used in: Dashboard "Relationship Opportunities" widget, stale alerts

### Partner/Referral Fields (Used in Reports)
12. **referredBy**
    - Data Type: String (free text or partner name)
    - Validation: None
    - Purpose: Referral tracking
    - Used in: Partner performance reports, referral leaders widget

13. **buyerPartnerId**
    - Data Type: String (UUID)
    - Validation: Must match existing partner ID
    - Purpose: Link to buyer agent partner
    - Used in: Partner metrics, referral tracking

14. **listingPartnerId**
    - Data Type: String (UUID)
    - Validation: Must match existing partner ID
    - Purpose: Link to listing agent partner
    - Used in: Partner metrics, referral tracking

15. **partnerId** (legacy/generic)
    - Data Type: String (UUID)
    - Validation: Must match existing partner ID
    - Purpose: Generic partner link
    - Used in: Reports only

### Available But Rarely Used Fields
16. **company**
    - Data Type: String (max 200 chars)
    - Validation: None
    - Purpose: Business contact affiliation
    - Used in: Contact modal only, not in reports

17. **address**, **city**, **state**, **zip**
    - Data Type: String
    - Validation: None (except state: 2-letter code)
    - Purpose: Property/mailing address
    - Used in: Contact modal, print suite only

18. **birthday**, **anniversary**
    - Data Type: Date (ISO 8601, no year required)
    - Validation: Valid month-day
    - Purpose: Celebration tracking, nurture touches
    - Used in: Calendar, print suite only

19. **notes**
    - Data Type: Text (unlimited)
    - Validation: None
    - Purpose: Free-form notes
    - Used in: Contact modal only

20. **tags**
    - Data Type: Array of Strings
    - Validation: None
    - Purpose: Custom categorization
    - Used in: Filters, search (not in primary UI)

### Unused/Deprecated Fields
- **tier**: Legacy field, not currently used
- **source**: Superseded by `referredBy`
- **expectedCloseDate**: Replaced by milestone tracking

---

## Partner Fields

### Required Fields
1. **name**
   - Data Type: String (max 200 chars)
   - Validation: At least one character
   - Purpose: Primary identifier
   - Used in: All tables, modals, search, reports

2. **email** OR **phone** (at least one required)
   - Same validation as contact fields
   - Purpose: Communication
   - Used in: Partner communications, reports

### Core Partner Fields (Used in Reports)
3. **tier**
   - Data Type: String (enum: Top, Core, Developing, Keep in Touch)
   - Validation: Must be from predefined list
   - Purpose: Relationship priority
   - Used in: Partner filters, dashboard widget

4. **partnerType**
   - Data Type: String (enum: Realtor Partner, Builder, Financial Advisor, CPA, Attorney, Insurance, Home Services, Other)
   - Validation: Must be from predefined list
   - Purpose: Categorization
   - Used in: Partner filters

5. **company**
   - Data Type: String (max 200 chars)
   - Validation: None
   - Purpose: Brokerage/firm name
   - Used in: Partner tables, modal

6. **focus**
   - Data Type: String (enum: Purchase, Listing, First-Time Buyers, Move-Up Buyers, Luxury, Investors, New Construction, Referral Network)
   - Validation: Must be from predefined list
   - Purpose: Market focus
   - Used in: Partner modal only

7. **cadence**
   - Data Type: String (enum: Weekly, Bi-Weekly, Monthly, Quarterly, As Needed)
   - Validation: Must be from predefined list
   - Purpose: Touch frequency
   - Used in: Partner modal, relationship tracking

### Available But Optional Fields
8. **priority**
   - Data Type: String (enum: Strategic, Core, Emerging, Watchlist)
   - Validation: Must be from predefined list
   - Purpose: Relationship management
   - Used in: Partner modal only

9. **volume**
   - Data Type: String (enum: 1-2 / quarter, 1-2 / month, 3-5 / month, 6+ / month, Project-Based)
   - Validation: Must be from predefined list
   - Purpose: Expected referral volume
   - Used in: Partner modal only

10. **lastTouch**, **nextTouch**
    - Data Type: Date (ISO 8601)
    - Validation: Valid date
    - Purpose: Relationship tracking
    - Used in: Partner modal only

### Calculated Fields (Read-Only)
- **referrals**: Count of contacts referred (calculated from contact.referredBy matching partner name)
- **funded**: Count of funded deals (calculated from funded contacts)
- **active**: Count of active pipeline contacts (calculated)
- **volume**: Total loan volume (calculated from loanAmount)
- **conversion**: Conversion percentage (funded / referrals)

---

## Workflow Rules & Automations

### Status-Milestone Enforcement
**Rule:** When a contact's status changes, the milestone is automatically adjusted if it falls outside the allowed range.

Example:
- Contact has status="inprogress" and milestone="Clear to Close" (invalid)
- System automatically adjusts milestone to "Application Submitted" (nearest allowed milestone)

**Implementation:** `normalizeMilestoneForStatus()` function in pipeline/constants.js

### Stage-Status Coordination
**Rule:** Each stage has a default status. When stage changes without explicit status, the default is applied.

Defaults:
- Long Shot → nurture
- Application → inprogress
- Pre-Approved → inprogress
- Processing → active
- Underwriting → active
- Approved → active
- CTC → active
- Funded → client

**Implementation:** `STAGE_DEFAULT_STATUS` in pipeline/constants.js

### Follow-Up Scheduling
**Rule:** When a contact enters a stage, if no nextFollowUp is set, it's automatically calculated based on stage cadence.

Cadences:
- Application: 3 days
- Processing/Underwriting: 2 days
- CTC: 1 day
- Funded: 14 days

**Implementation:** `followUpCadenceDaysForStage()` function

### Document Automation
**Rule:** When loanType is set, appropriate document checklist is assigned.

Document Templates by Loan Type:
- Conventional: Standard docs
- FHA: FHA-specific requirements
- VA: VA-specific requirements
- Jumbo: Jumbo requirements

**Implementation:** Document automation rules in settings

---

## Data Validation Rules

### On Contact Save
1. Name validation: `name` OR (`firstName` + `lastName`) required
2. Communication validation: `email` OR `phone` required
3. Email format validation: Must match email regex
4. Loan amount validation: If provided, must be >= 0
5. Interest rate validation: If provided, must be 0-100
6. Date validation: All dates must be valid ISO 8601
7. Status-milestone validation: Automatically corrected if invalid

### On Import
1. Duplicate detection:
   - Primary: Match on email (exact, case-insensitive)
   - Secondary: Match on phone (normalized)
   - Tertiary: Match on name + (email OR phone)
2. Required field check: Reject rows missing required fields
3. Data type validation: Attempt to parse numbers and dates
4. Stage normalization: Map synonyms to canonical stages
5. Status normalization: Map to valid status keys

### On Partner Save
1. Name required
2. Email OR phone required
3. Tier validation: Must be from enum
4. Partner type validation: Must be from enum

---

## Count Reconciliation

### Critical Counts (Must Always Match)
1. **Pipeline Count** = Sum of (inprogress + active + paused)
   - Widget: Dashboard "Active Pipeline"
   - Tab: Pipeline page count
   - Workbench: Pipeline lens count

2. **Client Count** = Contacts with status="client"
   - Widget: Dashboard "Clients Funded"
   - Tab: Client Portfolio page count
   - Reports: Funded count

3. **Leads Count** = Contacts with status="nurture"
   - Widget: Dashboard "Leads & Nurture"
   - Tab: Leads page count
   - Workbench: Leads lens count

4. **Partner Count** = All partners (not deleted)
   - Tab: Partners page count
   - Widget: Partner Portfolio count

### Calculation Sources
- All counts are calculated from the same data store: `window.DB.contacts` and `window.DB.partners`
- Filters applied consistently: Exclude deleted records
- Real-time updates: All widgets and tables subscribe to data changes

---

## Testing & Verification Checklist

### Field Validation
- [ ] Test required field enforcement on save
- [ ] Test email format validation
- [ ] Test loan amount range validation
- [ ] Test date parsing and validation
- [ ] Test status-milestone auto-correction

### Workflow Rules
- [ ] Verify stage change triggers default status
- [ ] Verify status change adjusts milestone if needed
- [ ] Verify follow-up scheduling based on stage
- [ ] Verify document checklist assignment by loan type

### Count Reconciliation
- [ ] Verify pipeline count matches across all views
- [ ] Verify client count matches in widget, page, and reports
- [ ] Verify leads count matches across dashboard and leads page
- [ ] Verify partner counts match

### Import/Export
- [ ] Test CSV import with valid data
- [ ] Test CSV import with invalid data (should show errors)
- [ ] Test duplicate detection on import
- [ ] Test export format matches import template
- [ ] Test export then import round-trip (data preserved)

### Data Persistence
- [ ] Verify seeding creates all stages and statuses
- [ ] Verify seeding creates test data for all scenarios
- [ ] Verify local storage persists on page reload
- [ ] Verify data survives browser close/reopen

---

## Recommendations

### Immediate Actions
1. **Enforce Required Validation**: Add UI indicators for required fields in all modals
2. **Simplify Status Model**: Consider consolidating `stage`, `status`, and `milestone` into a single unified workflow
3. **Add Duplicate Warnings**: Show "Similar contact exists" warning on create
4. **Improve Count Display**: Add tooltips explaining what each count includes

### Future Enhancements
1. **Custom Fields**: Allow admins to define custom fields per organization
2. **Workflow Customization**: Let admins configure stage names and progression
3. **Validation Rules**: Admin-configurable validation rules per field
4. **Audit Log**: Track all field changes for compliance

---

## Appendix: Quick Reference

### Field Usage Matrix
| Field | Required | Used in UI | Used in Reports | Used in Automation | Data Type |
|-------|----------|-----------|----------------|-------------------|-----------|
| name | ✓ | ✓ | ✓ | ✓ | String |
| email | ✓* | ✓ | ✓ | ✓ | Email |
| phone | ✓* | ✓ | ✓ | ✓ | Phone |
| stage | - | ✓ | ✓ | ✓ | Enum |
| status | - | ✓ | ✓ | ✓ | Enum |
| pipelineMilestone | - | ✓ | - | ✓ | Enum |
| loanAmount | - | ✓ | ✓ | ✓ | Number |
| loanType | - | ✓ | ✓ | ✓ | Enum |
| interestRate | - | ✓ | ✓ | - | Number |
| fundedDate | - | ✓ | ✓ | ✓ | Date |
| nextFollowUp | - | ✓ | - | ✓ | Date |
| lastContact | - | ✓ | - | ✓ | Date |
| referredBy | - | ✓ | ✓ | - | String |
| buyerPartnerId | - | - | ✓ | - | UUID |
| company | - | ✓ | - | - | String |
| address | - | ✓ | - | - | String |
| birthday | - | ✓ | - | ✓ | Date |
| notes | - | ✓ | - | - | Text |
| tags | - | - | - | - | Array |

*Either email OR phone required (at least one)

### Status-Milestone Compatibility Matrix
| Status | Min Milestone | Max Milestone | Default Milestone |
|--------|--------------|---------------|-------------------|
| nurture | Intro Call (0) | Application Sent (1) | Intro Call |
| inprogress | Intro Call (0) | UW in Progress (3) | Application Submitted |
| active | Application Submitted (2) | Docs Out (6) | UW in Progress |
| paused | Intro Call (0) | Docs Out (6) | Application Submitted |
| client | Funded (7) | Funded (7) | Funded / Post-Close |
| lost | Intro Call (0) | Application Submitted (2) | Application Sent |

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-04  
**Maintained By:** Development Team
