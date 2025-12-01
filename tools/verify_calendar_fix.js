
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {

        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

        console.log('Navigating to CRM...');
        await page.goto('http://127.0.0.1:8080/index.html?skipBootAnimation=1', { waitUntil: 'networkidle0' });

        console.log('Waiting for dashboard...');
        await page.waitForSelector('#view-dashboard', { timeout: 5000 });

        // Check if splash is gone
        const splashState = await page.evaluate(() => {
            const splash = document.getElementById('diagnostics-splash');
            if (!splash) return 'missing';
            return {
                visible: !splash.classList.contains('hidden') && splash.style.display !== 'none',
                classes: splash.className,
                style: splash.getAttribute('style')
            };
        });
        console.log('Splash State:', JSON.stringify(splashState, null, 2));

        // Force hide splash if needed
        if (splashState !== 'missing' && splashState.visible) {
            console.log('Forcing splash hide...');
            await page.evaluate(() => {
                const splash = document.getElementById('diagnostics-splash');
                if (splash) splash.style.display = 'none';
            });
        }

        // Navigate to Calendar using evaluate
        console.log('Navigating to Calendar...');
        const clickResult = await page.evaluate(() => {
            if (typeof window.activate === 'function') {
                window.activate('calendar');
                return 'Activated direct';
            }
            const btn = document.querySelector('button[data-nav="calendar"]');
            if (!btn) return 'Button not found';
            btn.click();
            return 'Clicked button';
        });
        console.log('Click Result:', clickResult);

        if (clickResult !== 'Clicked' && clickResult !== 'Clicked button' && clickResult !== 'Activated direct') {
            const bodyHtml = await page.content();
            console.log('Body HTML (truncated):', bodyHtml.substring(0, 2000));
            throw new Error('Failed to click calendar button: ' + clickResult);
        }

        // Debug visibility immediately
        const calVis = await page.evaluate(() => {
            const el = document.getElementById('view-calendar');
            if (!el) return 'MISSING';
            return {
                exists: true,
                classList: el.className,
                style: el.getAttribute('style'),
                display: window.getComputedStyle(el).display,
                hidden: el.hidden
            };
        });
        console.log('Immediate Calendar Visibility:', JSON.stringify(calVis, null, 2));

        console.log('Waiting for calendar view...');
        await page.waitForSelector('#view-calendar', { visible: true, timeout: 5000 });

        // Verify Calendar Content
        const calendarContent = await page.evaluate(() => {
            const el = document.getElementById('view-calendar');
            return {
                html: el.innerHTML,
                hasMonthBtn: !!el.querySelector('button[data-calview="month"]'),
                hasWeekBtn: !!el.querySelector('button[data-calview="week"]'),
                hasDayBtn: !!el.querySelector('button[data-calview="day"]'),
                hasMount: !!el.querySelector('#calendar-mount')
            };
        });

        console.log('Calendar Content Check:', calendarContent.hasMonthBtn ? 'PASS' : 'FAIL');
        if (!calendarContent.hasMonthBtn) {
            console.log('Calendar HTML:', calendarContent.html);
        }

        // Check for Bleed (Dashboard should be hidden)
        const dashboardVisible = await page.evaluate(() => {
            const el = document.getElementById('view-dashboard');
            return el && !el.classList.contains('hidden') && el.style.display !== 'none';
        });
        console.log('Dashboard Bleed Check:', !dashboardVisible ? 'PASS' : 'FAIL');

        // Navigate to Pipeline
        console.log('Navigating to Pipeline...');
        await page.click('button[data-nav="pipeline"]');
        await page.waitForSelector('#view-pipeline', { visible: true, timeout: 5000 });

        // Check if Calendar is hidden
        const calendarVisible = await page.evaluate(() => {
            const el = document.getElementById('view-calendar');
            return el && !el.classList.contains('hidden') && el.style.display !== 'none';
        });
        console.log('Calendar Hidden Check:', !calendarVisible ? 'PASS' : 'FAIL');

        // Navigate back to Calendar
        console.log('Navigating back to Calendar...');
        await page.click('button[data-nav="calendar"]');
        await page.waitForSelector('#view-calendar', { visible: true, timeout: 5000 });
        console.log('Calendar Re-render: PASS');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
