
(function () {
    window.StabilityVerifier = {
        log: [],

        logMsg: function (msg, type = 'info') {
            const entry = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${msg}`;
            console.log(entry);
            this.log.push(entry);
        },

        pass: function (msg) { this.logMsg(msg, 'pass'); },
        fail: function (msg) { this.logMsg(msg, 'fail'); },

        // 1. Verify Wiring (Action Bar Drag, etc.)
        verifyWiring: function () {
            this.logMsg('Verifying Core Wiring...');
            if (window.__ACTION_BAR_WIRING__ && window.__ACTION_BAR_WIRING__.dragState && window.__ACTION_BAR_WIRING__.dragState.wired) {
                this.pass('Action Bar Drag Wiring is ACTIVE');
            } else {
                this.fail('Action Bar Drag Wiring is MISSING or inactive');
            }
        },

        // 2. Widget Click Test
        testDashboardClicks: async function () {
            this.logMsg('Starting Dashboard Click Test...');
            // Try to find a deal tile
            const dealTile = document.querySelector('[data-deal-id]') || document.querySelector('[data-contact-id]');
            if (!dealTile) {
                this.logMsg('No deal/contact tile found on dashboard to test.', 'warn');
                return;
            }

            this.logMsg(`Clicking tile: ${dealTile.outerHTML.slice(0, 50)}...`);
            dealTile.click();

            await new Promise(r => setTimeout(r, 1500)); // Wait for import and render

            const modal = document.querySelector('.modal-dialog, .contact-editor, dialog[open]');
            if (modal || document.body.getAttribute('data-modal-open')) {
                this.pass('Editor Modal opened successfully');
                // Attempt validation of content (e.g. name appearing)
                // Cleanup: Close it
                const closeBtn = document.querySelector('.modal-close, [data-action="close"]');
                if (closeBtn) closeBtn.click();
            } else {
                this.fail('Editor Modal did NOT open after clicking tile');
            }
        },

        // 3. Selection Test
        testSelection: async function () {
            this.logMsg('Starting Selection Test...');
            const checkAll = document.querySelector('input[data-role="select-all"]');
            if (!checkAll) {
                this.logMsg('Select All checkbox not found (maybe not on list view)', 'warn');
                return;
            }

            // Test Select All
            if (!checkAll.checked) {
                checkAll.click();
                await new Promise(r => setTimeout(r, 100)); // Wait for async
            }

            const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            if (allChecked) this.pass('Select All checked all rows');
            else this.fail('Select All failed to check all rows');

            // Verify Action Bar
            const ab = document.getElementById('actionbar');
            if (ab && ab.getAttribute('data-visible') === '1') this.pass('Action bar visible');
            else this.fail('Action bar not visible');

            // Test Unselect All
            checkAll.click();
            await new Promise(r => setTimeout(r, 100));
            const noneChecked = Array.from(checkboxes).every(cb => !cb.checked);
            if (noneChecked) this.pass('Unselect All cleared all rows');
            else this.fail('Unselect All failed to clear rows');

            if (ab && !ab.hasAttribute('data-visible')) this.pass('Action bar hidden');
            else this.fail('Action bar still visible after clear');
        },

        // 4. Export Verification
        verifyExport: function () {
            this.logMsg('Verifying Export Log...');
            const key = 'stability_test_change_log';
            const raw = localStorage.getItem(key);
            if (raw) {
                const data = JSON.parse(raw);
                if (Array.isArray(data) && data.length > 0) {
                    this.pass(`Export log found with ${data.length} entries.`);

                    // Verify detailed changes presence
                    const hasDetails = data.some(e => Array.isArray(e.changes) && e.changes.length > 0);
                    if (hasDetails) this.pass('Detailed field changes detected in log.');
                    else this.logMsg('No detailed field changes found in log (maybe only creations/deletions logged?)', 'warn');

                    // Create CSV download
                    const csvLines = ["Timestamp,Store,ID,Type,Field,OldValue,NewValue"];
                    data.forEach(e => {
                        const base = `${e.timestamp},${e.store},${e.id},${e.type}`;
                        if (e.changes && e.changes.length) {
                            e.changes.forEach(c => {
                                csvLines.push(`${base},${c.field},"${String(c.old_value).replace(/"/g, '""')}","${String(c.new_value).replace(/"/g, '""')}"`);
                            });
                        } else {
                            csvLines.push(`${base},,,"${String(e.summary).replace(/"/g, '""')}"`);
                        }
                    });

                    const csvContent = "data:text/csv;charset=utf-8," + csvLines.join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "export_changed_records_stability.csv");
                    document.body.appendChild(link);
                    link.click();
                    this.pass('CSV download triggered');
                } else {
                    this.fail('Export log empty');
                }
            } else {
                this.fail('Export log not found in localStorage');
            }
        },

        runAll: async function () {
            this.verifyWiring();
            await this.testSelection();
            await this.testDashboardClicks();
            this.verifyExport();
            console.log('--- Verification Complete ---');
        }
    };

    console.log("StabilityVerifier loaded. Run window.StabilityVerifier.runAll()");
})();
