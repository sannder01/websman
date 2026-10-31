'use strict';
// Exercise the jQuery assignment against a dry-run server; never send live club requests.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const base = process.env.PIXEL_TEST_URL || 'http://127.0.0.1:8899';
const tomorrow = new Date(Date.now() + 86400000 + 5 * 3600000).toISOString().slice(0, 10);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PIXEL_BROWSER_EXECUTABLE_PATH ? {executablePath: process.env.PIXEL_BROWSER_EXECUTABLE_PATH} : {})
  });
  const errors = [], submissions = [], usedEffects = new Set();
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, locale: 'ru-RU', timezoneId: 'Asia/Almaty'});
    const config = await (await context.request.get(`${base}/api/booking-config`)).json();
    assert.equal(config.mode, 'test', 'Only the dry-run server may run these tests.');
    assert.equal(config.available, true);
    context.setDefaultTimeout(15000);
    context.on('page', page => {
      page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
      page.on('console', message => { if (message.type() === 'error') errors.push(`${page.url()}: ${message.text()}`); });
      page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/bookings') submissions.push(request.postDataJSON());
      });
    });
    const page = await context.newPage();
    async function open(route) {
      await page.goto(`${base}/${route}`, {waitUntil: 'networkidle'});
      assert.equal(await page.evaluate(() => window.jQuery?.fn.jquery), '3.7.1');
    }
    async function instrumentEffects() {
      await page.evaluate(() => {
        window.testEffects = [];
        for (const method of ['fadeIn', 'fadeOut', 'fadeToggle', 'slideUp', 'slideDown', 'slideToggle', 'animate']) {
          const original = $.fn[method];
          $.fn[method] = function (...args) {
            window.testEffects.push(method);
            return original.apply(this, args);
          };
        }
      });
    }
    async function collectEffects() {
      for (const effect of await page.evaluate(() => window.testEffects)) usedEffects.add(effect);
    }
    async function settled(selector, openState) {
      await page.waitForFunction(({selector, openState}) => {
        const item = document.querySelector(selector);
        return item.open === openState && !$(item).find(':animated').length;
      }, {selector, openState});
    }

    // All pages and redirects must preserve responsive layout and load without console errors.
    for (const width of [375, 1440]) {
      await page.setViewportSize({width, height: 1000});
      for (const route of ['index.html', 'rooms.html', 'games.html', 'booking.html', 'help.html', 'cart.html', 'computers.html', 'all-locations.html']) {
        await open(route);
        assert.equal(await page.locator('h1').count(), 1, `${route}: one main heading`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${route}: overflow at ${width}`);
        assert.equal(await page.locator('script[src*="old-js-version.js"]').count(), 0);
      }
    }
    console.log('PASS: all pages/redirects at 375/1440, pinned jQuery and no horizontal overflow.');

    await open('games.html');
    assert.equal(await page.locator('#games-saved-list li').count(), 0);
    await page.locator('[data-favorite-id="cs2"]').click();
    await page.locator('[data-favorite-id="minecraft"]').click();
    assert.equal(await page.locator('#games-saved-list li').count(), 2);
    await page.locator('#games-search').fill('Minecraft');
    await page.locator('#games-favorites-only').check();
    assert.equal(await page.locator('[data-favorite-id]').count(), 1);
    await page.locator('#games-category').selectOption('shooters');
    assert.equal(await page.locator('#games-empty').isVisible(), true);
    await page.locator('#games-empty-reset').click();
    assert.equal(await page.locator('[data-favorite-id]').count(), 20);
    assert.equal(await page.locator('#games-favorites-only').isChecked(), false);
    // The saved list and cards were rebuilt repeatedly; parent-bound events still receive clicks.
    await page.locator('[data-remove-favorite="cs2"]').click();
    assert.equal(await page.locator('#games-saved-list li').count(), 1);
    assert.equal(await page.locator('[data-favorite-id="cs2"]').getAttribute('aria-pressed'), 'false');
    await page.locator('[data-favorite-id="cs2"]').click();
    await page.reload({waitUntil: 'networkidle'});
    assert.equal(await page.locator('#games-saved-list li').count(), 2);
    await page.locator('#games-favorites-clear').click();
    assert.equal(await page.locator('#games-saved-list').isVisible(), false);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('pixel-favorite-games-v1'))), []);
    console.log('PASS: delegated actions on rebuilt catalog/saved list, combined filters, reset and persistence.');

    await open('help.html');
    await instrumentEffects();
    const faq = '#help-packages';
    await page.locator(`${faq} > summary`).click();
    await settled(faq, true);
    assert.equal(await page.locator(`${faq} > p`).first().isVisible(), true);
    await page.locator(`${faq} > summary`).click();
    await settled(faq, false);
    assert.equal(await page.locator(`${faq} > p`).first().isVisible(), false);
    // Rapid toggles must settle in the last requested state rather than leave a stale animation queue.
    await page.locator(`${faq} > summary`).evaluate(summary => { for (let i = 0; i < 5; i += 1) summary.click(); });
    await settled(faq, true);
    await page.locator(`${faq} > summary`).focus();
    await page.keyboard.press('Enter');
    await settled(faq, false);
    await collectEffects();
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.locator(`${faq} > summary`).click();
    await settled(faq, true);
    await page.locator(`${faq} > summary`).click();
    await settled(faq, false);
    console.log('PASS: FAQ slide effects, rapid toggles, keyboard activation and reduced motion.');

    await open('booking.html?mode=hourly');
    await instrumentEffects();
    await page.waitForFunction(() => !document.getElementById('booking-submit').disabled);
    await page.locator('#booking-name').fill('   ');
    await page.locator('#booking-phone').fill('letters');
    await page.locator('#booking-email').fill('wrong@');
    await page.locator('#booking-submit').click();
    for (const field of ['name', 'phone', 'email', 'date', 'time']) {
      assert.equal(await page.locator(`#booking-${field}`).getAttribute('aria-invalid'), 'true', `${field}: invalid state`);
      assert.equal(await page.locator(`#booking-${field}`).evaluate(node => node.classList.contains('is-invalid')), true);
      assert.equal(await page.locator(`#booking-${field}-error`).isVisible(), true, `${field}: adjacent error`);
    }
    assert.equal(await page.locator('#booking-result').isVisible(), false);
    assert.equal(submissions.length, 0, 'Invalid form must not submit.');
    await page.locator('#booking-name').fill('  Проверка jQuery  ');
    await page.locator('#booking-phone').fill('  +7 700 123 45 67  ');
    await page.locator('#booking-email').fill('  visitor@example.com  ');
    await page.locator('#booking-date').fill(tomorrow);
    await page.locator('#booking-time').fill('14:00');
    for (const field of ['name', 'phone', 'email', 'date', 'time']) {
      await page.waitForFunction(id => document.getElementById(id).getAttribute('aria-invalid') !== 'true', `booking-${field}`);
      assert.equal(await page.locator(`#booking-${field}-error`).isVisible(), false, `${field}: error cleared on correction`);
    }
    await page.locator('#booking-submit').click();
    await page.locator('#booking-result').waitFor({state: 'visible'});
    await page.waitForFunction(() => !$('#booking-success').is(':animated'));
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].contact.name, 'Проверка jQuery');
    assert.equal(submissions[0].contact.email, 'visitor@example.com');
    assert.equal(submissions[0].contact.phone.startsWith(' '), false);
    assert.ok((await page.locator('#booking-success').textContent()).includes('не отправлена администратору'));
    for (const field of ['name', 'phone', 'email']) assert.equal(await page.locator(`#booking-${field}`).inputValue(), '', `${field}: reset after success`);
    const stored = await page.evaluate(() => JSON.stringify({...localStorage, ...sessionStorage}));
    assert.equal(stored.includes('Проверка jQuery') || stored.includes('visitor@example.com'), false, 'Contacts must not persist.');
    await collectEffects();
    assert.ok(usedEffects.size >= 3, `Expected three purposeful effects, saw ${[...usedEffects].join(', ')}`);
    assert.deepEqual(errors, []);
    console.log('PASS: per-field jQuery validation/correction, trim/email/phone checks, one dry-run request, success/reset, contact privacy and three effects.');
  } catch (error) {
    if (errors.length) console.error('Browser errors:', errors);
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
