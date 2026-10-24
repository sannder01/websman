'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require('playwright');

const base = process.env.PIXEL_TEST_URL || 'http://127.0.0.1:8899';
const evidence = process.env.PIXEL_EVIDENCE_DIR || path.join(os.tmpdir(), 'pixel-individual-features-qa');
const storageKey = 'pixel-favorite-games-v1';
fs.mkdirSync(evidence, {recursive: true});

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PIXEL_BROWSER_EXECUTABLE_PATH ? {executablePath: process.env.PIXEL_BROWSER_EXECUTABLE_PATH} : {})
  });
  const errors = [], submissions = [];
  async function newContext() {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, locale: 'ru-RU', reducedMotion: 'reduce'});
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(30000);
    context.on('page', page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    });
    await context.route('**/api/bookings', route => {
      submissions.push(route.request().method());
      return route.abort();
    });
    return context;
  }
  async function open(page, route) { await page.goto(`${base}/${route}`, {waitUntil: 'networkidle'}); }
  async function contains(page, selector, expected) {
    assert.ok((await page.locator(selector).textContent()).includes(expected), `${selector}: ${expected}`);
  }
  async function total(page, room, expected) {
    const value = await page.locator(`[data-comparison-total="${room}"]`).textContent();
    assert.equal(Number(value.replace(/\D/g, '')), expected, `${room}: ${value}`);
  }
  async function countFavorites(page, count) {
    await page.waitForFunction(expected => document.getElementById('games-favorites-count').textContent === `В избранном: ${expected}`, count);
  }
  const toggle = (page, room) => page.locator(`[data-compare-room="${room}"]`);
  const favorite = (page, game) => page.locator(`[data-favorite-id="${game}"]`);

  try {
    const context = await newContext();
    const page = await context.newPage();
    await open(page, 'rooms.html');
    assert.equal(await page.locator('[data-comparison-room]').count(), 0);
    assert.equal(await page.locator('#comparison-clear').isDisabled(), true);
    assert.equal(await page.locator('#comparison-guests').inputValue(), '2');
    assert.equal(await page.locator('#comparison-duration').inputValue(), '2');
    await toggle(page, 'standard').click();
    await toggle(page, 'vip').click();
    await total(page, 'standard', 3600);
    await total(page, 'vip', 6000);
    assert.equal(await toggle(page, 'standard').getAttribute('aria-pressed'), 'true');
    await page.locator('#comparison-guests').fill('3');
    await page.locator('#comparison-duration').fill('3');
    await total(page, 'standard', 8100);
    await total(page, 'vip', 13500);
    await toggle(page, 'duo').click();
    await contains(page, '[data-comparison-total="duo"]', 'не подходит');
    const unavailable = page.locator('[data-comparison-room="duo"] a');
    assert.equal(await unavailable.getAttribute('aria-disabled'), 'true');
    assert.equal(await unavailable.getAttribute('href'), null);
    await contains(page, '[data-comparison-room="standard"]', 'Самая низкая цена');

    for (const [id, value] of [['guests', ''], ['guests', '2.5'], ['guests', '21'], ['duration', '0'], ['duration', '13']]) {
      await page.locator(`#comparison-${id}`).fill(value);
      assert.equal(await page.locator(`#comparison-${id}`).getAttribute('aria-invalid'), 'true');
      assert.equal(await page.locator('[data-comparison-room="standard"] a').getAttribute('aria-disabled'), 'true');
      await page.locator(`#comparison-${id}`).fill('3');
    }
    await page.locator('#comparison-guests').fill('');
    await page.getByRole('button', {name: 'Пересчитать', exact: true}).click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'comparison-guests');
    await page.locator('#comparison-guests').fill('3');
    await total(page, 'standard', 8100);
    await page.getByRole('button', {name: 'Убрать VIP из сравнения', exact: true}).click();
    assert.equal(await page.locator('[data-comparison-room="vip"]').count(), 0);
    assert.equal(await toggle(page, 'vip').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.compareRoom), 'vip');
    await page.keyboard.press('Space');
    await total(page, 'vip', 13500);

    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({width, height: 1000});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `rooms overflow at ${width}`);
      if (width !== 768) await page.screenshot({path: path.join(evidence, `comparison-${width}.png`), fullPage: true});
    }
    const visit = page.locator('[data-comparison-room="standard"] a');
    const href = new URL(await visit.getAttribute('href'), page.url());
    assert.deepEqual(Object.fromEntries(href.searchParams), {room: 'standard', mode: 'hourly', guests: '3', duration: '3'});
    await visit.click();
    await page.waitForFunction(() => document.getElementById('booking-guests').value === '3' && document.getElementById('booking-duration').value === '3');
    assert.equal(await page.locator('#booking-room').inputValue(), 'standard');
    assert.equal(await page.locator('#booking-mode').inputValue(), 'hourly');
    assert.equal(Number((await page.locator('#booking-total').textContent()).replace(/\D/g, '')), 8100);
    await open(page, 'rooms.html');
    await toggle(page, 'standard').click();
    await toggle(page, 'duo').click();
    await page.locator('#comparison-clear').click();
    assert.equal(await page.locator('[data-comparison-room]').count(), 0);
    assert.equal(await page.locator('#comparison-clear').isDisabled(), true);
    assert.equal(await page.locator('[data-compare-room][aria-pressed="true"]').count(), 0);
    console.log('PASS: room totals, capacity, validation and focus, remove/clear, comparison-to-booking handoff, responsive layout.');

    await open(page, 'games.html');
    await countFavorites(page, 0);
    assert.equal(await page.locator('#games-favorites-clear').isDisabled(), true);
    await favorite(page, 'cs2').click();
    await favorite(page, 'minecraft').click();
    await countFavorites(page, 2);
    await page.reload({waitUntil: 'networkidle'});
    assert.equal(await favorite(page, 'cs2').getAttribute('aria-pressed'), 'true');
    assert.equal(await favorite(page, 'minecraft').getAttribute('aria-pressed'), 'true');
    await page.locator('#games-favorites-only').check();
    assert.equal(await page.locator('[data-favorite-id]').count(), 2);
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({width, height: 1000});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `favorites overflow at ${width}`);
      if (width !== 768) await page.screenshot({path: path.join(evidence, `favorites-${width}.png`), fullPage: true});
    }
    await page.locator('#games-search').fill('Minecraft');
    assert.equal(await page.locator('[data-favorite-id]').count(), 1);
    await page.locator('#games-category').selectOption('shooters');
    assert.equal(await page.locator('#games-empty').isVisible(), true);
    await contains(page, '#games-empty h2', 'В избранном ничего не найдено');
    await page.locator('#games-empty-reset').click();
    assert.equal(await page.locator('#games-favorites-only').isChecked(), false);
    assert.equal(await page.locator('[data-favorite-id]').count(), 20);
    await countFavorites(page, 2);

    const other = await context.newPage();
    await open(other, 'games.html');
    await favorite(other, 'cs2').click();
    await countFavorites(page, 1);
    assert.equal(await favorite(page, 'cs2').getAttribute('aria-pressed'), 'false');
    await contains(page, '#games-favorites-status', 'другой вкладке');
    await other.close();
    await page.locator('#games-favorites-only').check();
    await favorite(page, 'minecraft').click();
    await countFavorites(page, 0);
    assert.equal(await page.locator('#games-empty').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'games-favorites-only');
    await page.locator('#games-empty-reset').click();
    await favorite(page, 'cs2').click();
    await page.locator('#games-favorites-clear').click();
    await countFavorites(page, 0);
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey), []);
    console.log('PASS: favorites persist, combine with search/genre, reset without losing favorites, synchronize across tabs, remove and clear.');

    await page.evaluate(key => localStorage.setItem(key, '{broken json'), storageKey);
    await page.reload({waitUntil: 'networkidle'});
    await countFavorites(page, 0);
    await contains(page, '#games-favorites-status', 'не удалось прочитать');
    await favorite(page, 'minecraft').click();
    await countFavorites(page, 1);
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify(['minecraft', 'unknown-game', 'minecraft', 42, null])), storageKey);
    await page.reload({waitUntil: 'networkidle'});
    await countFavorites(page, 1);
    await page.locator('#games-favorites-only').check();
    assert.equal(await page.locator('[data-favorite-id]').count(), 1);
    assert.equal(await favorite(page, 'minecraft').getAttribute('aria-pressed'), 'true');

    const deniedContext = await newContext();
    await deniedContext.addInitScript(() => {
      for (const method of ['getItem', 'setItem']) {
        Storage.prototype[method] = () => { throw new DOMException('Storage denied for browser test', 'SecurityError'); };
      }
    });
    const denied = await deniedContext.newPage();
    await open(denied, 'games.html');
    await contains(denied, '#games-favorites-status', 'браузер не разрешил сохранить');
    await favorite(denied, 'minecraft').click();
    await countFavorites(denied, 1);
    await denied.locator('#games-favorites-only').check();
    assert.equal(await denied.locator('[data-favorite-id]').count(), 1);
    await denied.locator('#games-favorites-clear').click();
    await countFavorites(denied, 0);
    assert.equal(await denied.locator('#games-empty').isVisible(), true);
    await deniedContext.close();
    assert.deepEqual(submissions, [], 'Feature checks must never submit bookings');
    assert.deepEqual(errors, []);
    console.log(`PASS: corrupt/unknown favorite data and denied storage recover, no console errors or booking submissions. Screenshots: ${evidence}`);
  } catch (error) {
    console.error('Browser errors:', errors);
    for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
      console.error(`Failure page ${index}: ${page.url()}`);
      await page.screenshot({path: path.join(evidence, `failure-${index}.png`), fullPage: true}).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
