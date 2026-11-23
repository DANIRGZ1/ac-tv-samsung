const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(() => {
      const channels = [{ id: 'a'.repeat(40), name: 'Canal de prueba' }, { id: 'b'.repeat(40), name: 'Otro canal' }];
      localStorage.setItem('ace-tv.channels', JSON.stringify(channels));
      localStorage.setItem('ace-tv.favorites', JSON.stringify(channels));
      window.webapis = { avplay: { getState: () => 'NONE' } };
    });
    await page.goto(pathToFileURL(path.join(__dirname, 'acetv-native-app/index.html')).href);
    await page.evaluate(() => {
      window.SmokeStarted = 0;
      window.NativeP2PTransport = { start() { window.SmokeStarted++; return new Promise(() => {}); }, stop() {} };
    });
    const cards = page.locator('#guide-list .guide-channel:not(.guide-add)');
    const outline = page.locator('.guide-focus-indicator');
    await cards.first().focus();
    const firstPosition = await outline.evaluate(el => el.style.transform);
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await outline.evaluate(el => el.style.transform), firstPosition);
    assert.equal(await outline.count(), 1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await outline.evaluate(el => getComputedStyle(el).transitionDuration), '0s');

    await page.keyboard.down('Enter');
    await page.locator('#channel-move').waitFor();
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    assert.equal(await page.evaluate(() => window.SmokeStarted), 0);
    assert.equal(await page.locator('#library-title').textContent(), 'Otro canal');
    await page.locator('#channel-links').click();
    await page.locator('#link-watch-0').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#channel-edit').click();
    await page.locator('#library-cancel').click();
    await page.locator('#channel-move').click();
    await page.keyboard.press('ArrowLeft');
    assert.deepEqual(await page.evaluate(() => AceCatalog.libraryState().favorites.map(item => item.name)),
      ['Otro canal', 'Canal de prueba']);
    await page.keyboard.press('Escape');
    await page.locator('#channel-close').click();
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Otro canal, en favoritos');
    await page.keyboard.down('Enter');
    await page.locator('#channel-favorite').waitFor();
    await page.keyboard.up('Enter');
    await page.locator('#channel-favorite').click();
    assert.equal(await page.evaluate(() => AceCatalog.libraryState().favorites.length), 1);
    await cards.first().focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.SmokeStarted === 1);
    assert.equal(await page.locator('#channel-library').isVisible(), false);
    console.log('PASS short/long OK, repeats, focus, reduced motion, menu navigation and favorites');
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
