# CRM Status Taxonomy

## 1. Overview
This document serves as the single source of truth for all workflows, stages, and statuses in the CRM. It defines the allowed values, transitions, and canonical definitions.

## 2. Pipeline Stages
The Pipeline Stage represents the macro-level lifecycle of a deal.

### Canonical Flow
These stages represent the standard "Happy Path" for a loan modification/origination.

1.  **Long Shot** (`long-shot`)
    *   *Definition*: Unqualified lead or early prospect.
    *   *Also known as*: Lead, Prospect.
2.  **Application** (`application`)
    *   *Definition*: Engagement started, application invited/sent.
3.  **Pre-Approved** (`preapproved`)
    *   *Definition*: Credit pulled, pre-approval letter issued.
4.  **Processing** (`processing`)
    *   *Definition*: Deal is live, documents being gathered.
5.  **Underwriting** (`underwriting`)
    *   *Definition*: File submitted to UW.
6.  **Approved** (`approved`)
    *   *Definition*: Conditional Approval received.
7.  **Cleared to Close** (`cleared-to-close`)
    *   *Definition*: Final approval, CTC issued.
    *   *Legacy Alias*: `CTC`
8.  **Funded** (`funded`)
    *   *Definition*: Loan funded and recorded.
9.  **Post-Close** (`post-close`)
    *   *Definition*: Immediate post-closing activities (audit, reviews).

### Special / Terminal Stages
These stages exist outside the linear flow or represent exit states.

*   **Nurture** (`nurture`)
    *   *Definition*: Long-term hold. Not actively processing but not dead.
    *   *Mapping*: Often maps to `nurture` Status within `long-shot` Stage in internal logic, but exposed as a distinct Stage in UI.
*   **Lost** (`lost`)
    *   *Definition*: Deal dead/archived.
*   **Denied** (`denied`)
    *   *Definition*: Deal denied by UW/Lender.
*   **Past Client** (`past-client`)
    *   *Definition*: Historic record of a completed transaction. Distinct from `post-close` (active) vs `past-client` (archive/CRM).
*   **Returning** (`returning`)
    *   *Definition*: Past client re-engaging for new business.

## 3. Contact Statuses
The Contact Status represents the micro-level state or "health" of the record *within* a stage.

| Key | Label | Definition | Allowed Stages |
| :--- | :--- | :--- | :--- |
| `inprogress` | In Progress | Moving forward normally. | All except Locked |
| `active` | Active | High priority, daily activity. | Processing, UW, Approved, CTC |
| `client` | Client | Relationship won. | Funded, Post-Close |
| `paused` | Paused | On hold / Stall. | All |
| `nurture` | Nurture | Long term drip. | Long Shot, Application, Nurture |
| `lost` | Lost | Dead. | Lost, Denied |

## 4. Key Mappings & Rules
*   **CTC Normalization**: The system strictly normalizes `CTC`, `Clear-to-Close`, and `Clear to Close` to `cleared-to-close`.
*   **Lead vs Long Shot**: "Lead" is the UI Label for the `long-shot` key.
*   **Nurture Ambiguity**: `nurture` is both a specific **Status** and a **Stage**. Interaction carefully managed by `normalizeStatusForStage`.

## 5. Persistence Format
*   **Database**: Stores `stage` and `status` as lowercase, hyphenated strings (kebab-case).
*   **Code**: Uses `camelCase` for variable names but compares against `kebab-case` string constants.
*   **Display**: Uses dictionary lookup for "Human Readable" labels.
