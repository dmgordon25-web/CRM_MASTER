# CRM Field & Automation Dump

Generated: 2025-10-27T22:31:55.163Z

## Fields

| Field | Label | Type | Required | Normalizers | Used By |
| --- | --- | --- | --- | --- | --- |
| address | Street | text |  |  | contact-modal, merge-ui |
| buyerPartnerId | Buyer Partner | partner |  |  | contact-modal, merge-ui |
| city | City | text |  |  | contact-modal, merge-ui |
| closingTimeline | Closing Timeline | text |  |  | contact-modal, merge-ui |
| communicationPreference | Communication Preference | text |  |  | contact-modal, merge-ui |
| contactType | Contact Role | text |  |  | contact-modal, merge-ui |
| creditRange | Credit Range | text |  |  | contact-modal |
| docStage | Documentation Stage | text |  |  | contact-modal, merge-ui |
| email | Primary Email | email | Yes | normalizeEmail | contact-modal, merge-ui |
| employmentType | Employment Type | text |  |  | contact-modal |
| first | First Name | text | Yes |  | contact-modal, merge-ui |
| fundedDate | Funded / Expected Closing | date |  |  | contact-modal, merge-ui |
| last | Last Name | text | Yes |  | contact-modal, merge-ui |
| lastContact | Last Contact | date |  |  | contact-modal, merge-ui |
| leadSource | Lead Source | text |  |  | contact-modal, merge-ui |
| listingPartnerId | Listing Partner | partner |  |  | contact-modal, merge-ui |
| loanAmount | Loan Amount | number |  |  | contact-modal, merge-ui |
| loanProgram | Loan Program (Legacy) | text |  | normalizeLoanProgram | contact-modal, merge-ui |
| loanPurpose | Loan Purpose | text |  |  | contact-modal, merge-ui |
| loanType | Loan Program | text |  | normalizeLoanProgram | contact-modal, merge-ui |
| nextFollowUp | Next Follow-Up | date |  |  | contact-modal, merge-ui |
| notes | Notes | textarea |  |  | contact-modal, merge-ui |
| occupancy | Occupancy | text |  |  | contact-modal |
| phone | Mobile / Direct | phone | Yes | normalizePhone | contact-modal, merge-ui |
| pipelineMilestone | Pipeline Milestone | text |  |  | contact-modal, merge-ui |
| preApprovalExpires | Pre Approval Expires | text |  |  | contact-modal |
| preferredName | Preferred Name | text |  |  | contact-modal, merge-ui |
| priority | Priority | text |  |  | contact-modal, merge-ui |
| propertyType | Property Type | text |  |  | contact-modal |
| rate | Rate | number |  |  | contact-modal, merge-ui |
| referredBy | Referred By | text |  |  | contact-modal, merge-ui |
| secondaryEmail | Secondary Email | email |  | normalizeEmail | contact-modal, merge-ui |
| secondaryPhone | Secondary Phone | phone |  | normalizePhone | contact-modal, merge-ui |
| stage | Pipeline Stage | select | Yes | normalizeStage | contact-modal, merge-ui |
| state | State | text |  | inline | contact-modal, merge-ui |
| status | Status | select | Yes | normalizeLower | contact-modal, merge-ui |
| tags | Tags | tags |  |  | contact-modal, merge-ui |
| zip | ZIP | text |  |  | contact-modal, merge-ui |

## Statuses

| Status | Label |
| --- | --- |
| inprogress | In Progress |
| active | Active |
| client | Client |
| paused | Paused |
| lost | Lost |
| nurture | Nurture |

## Stages

| Stage | Label |
| --- | --- |
| application | Application |
| preapproved | Pre-Approved |
| processing | Processing |
| underwriting | Underwriting |
| approved | Approved |
| cleared-to-close | Cleared to Close |
| funded | Funded |
| post-close | Post-Close |
| nurture | Nurture |
| lost | Lost |
| denied | Denied |

## Document Stages

| Doc Stage | Label |
| --- | --- |
| application-started | Application Started |
| needs-docs | Needs Docs |
| submitted-to-uw | Submitted to UW |
| conditional-approval | Conditional Approval |
| clear-to-close | Clear to Close |
| post-closing | Post-Closing |

## Pipeline Milestones

| Milestone |
| --- |
| Intro Call |
| Application Sent |
| Application Submitted |
| UW in Progress |
| Conditions Out |
| Clear to Close |
| Docs Out |
| Funded / Post-Close |

## Automation Hooks

| Stage | Automation |
| --- | --- |
| application | Creates welcome tasks, kicks off the doc checklist, and schedules a first follow-up reminder. |
| preapproved | Confirms credit docs, arms borrowers with next steps, and keeps partners in the loop. |
| processing | Alerts processing teammates, syncs missing documents, and tightens the follow-up cadence. |
| underwriting | Logs underwriting review, sets condition tracking tasks, and updates partner status digests. |
| approved | Preps clear-to-close outreach, nudges partners with status updates, and confirms closing logistics. |
| cleared-to-close | Queues closing packet reminders, notifies settlement partners, and schedules celebration touch points. |
| funded | Triggers post-closing nurture, partner thank-yous, and review requests for the borrower. |
| post-close | Launches annual reviews, referrals, and gifting automations for happy clients. |
| nurture | Keeps long-term leads warm with periodic value touches and partner updates. |
| lost | Documents outcome, schedules re-engagement, and captures learnings for the team. |
| denied | Captures denial reasons, assigns compliance follow-ups, and plans credit repair touchpoints. |
