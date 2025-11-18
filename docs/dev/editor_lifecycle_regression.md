# Editor Lifecycle Regression Check

Manual smoke scenario to verify Contact and Partner full editors never freeze after navigation:

1. From the Partners tab, open a Partner full editor and close it.
2. Navigate to Contacts, open a Contact full editor, and close it.
3. Visit other areas (Pipeline, Dashboard, Settings) and return.
4. Repeat opening and closing Partner, then Contact, a few cycles while moving between tabs.

Expectation: every click to open a full editor either opens the modal or logs a debug reset, and the next click works normally—no dead/stuck editors.
