# CRM Status & Stage Inventory

## 1. Pipeline Stages
Defined in `js/pipeline/stages.js`, `js/pipeline/constants.js`, and `js/contacts.js`.

### Canonical Stages (Ordered Flow)
| Key | Label | Defined In | Notes |
| :--- | :--- | :--- | :--- |
| `long-shot` | Long Shot / Lead | `state_model.js` | "Lead" in UI (`contacts.js`) |
| `application` | Application | `state_model.js` | |
| `preapproved` | Pre-Approved | `state_model.js` | |
| `processing` | Processing | `state_model.js` | |
| `underwriting` | Underwriting | `state_model.js` | |
| `approved` | Approved | `state_model.js` | |
| `cleared-to-close`| Cleared to Close | `state_model.js` | Alias: `CTC` |
| `funded` | Funded | `state_model.js` | |
| `post-close` | Post-Close | `state_model.js` | |
| `past-client` | Past Client | `state_model.js` | Not in `contacts.js` dropdown explicitly? |
| `returning` | Returning | `state_model.js` | Not in `contacts.js` dropdown explicitly? |

### Terminal / Special Stages
Values used in `stage` field but not part of the main "flow".
| Key | Label | Defined In | Notes |
| :--- | :--- | :--- | :--- |
| `nurture` | Nurture | `contacts.js` | Mapped to `long-shot` in some logic, but distinct in UI. |
| `lost` | Lost | `contacts.js` | Terminal state. |
| `denied` | Denied | `contacts.js` | Terminal state. |

## 2. Contact Statuses
Defined in `js/pipeline/constants.js` and `js/contacts.js`.

| Key | Label | UI Usage | Notes |
| :--- | :--- | :--- | :--- |
| `inprogress` | In Progress | Yes | Default active status |
| `active` | Active | Yes | Usually for deals in flight |
| `client` | Client | Yes | Won/Funded deals |
| `paused` | Paused | Yes | On Hold |
| `lost` | Lost | Yes | Dead deals |
| `nurture` | Nurture | Yes | Long-term leads |

## 3. Milestones
Defined in `js/pipeline/constants.js`.

- Intro Call
- Application Sent
- Application Submitted
- UW in Progress
- Conditions Out
- Clear to Close (Note: distinct from Stage CTC)
- Docs Out
- Funded / Post-Close

## 4. Task Types
Defined in `js/ui/quick_create_menu.js`.

- Call
- Email
- SMS
- Meeting
- Postal
- Follow-up

## 5. Partner Tiers
Defined in `js/reports.js` (implicit) and `js/partners.js`.

- Core
- Preferred
- Strategic
- Developing
- Partner (default)

## 6. Document Statuses
Defined in `js/doc/doc_center_enhancer.js`.

- Uploaded
- Pending
- Signed
- Draft
- Error
- Requested
- Follow Up
- Received
- Waived
