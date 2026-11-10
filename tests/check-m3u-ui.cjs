const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const app = pathToFileURL(path.resolve(__dirname, '../work/acetv-native-app/index.html')).href;
const id = digit => digit.repeat(40);
const initial = { id: id('1'), name: 'Favorito original' };
const list = [
  '#EXTM3U', '#EXTINF:-1,Duplicado', `acestream://${initial.id}`,
  '#EXTINF:-1 group-title="Noticias",Noticias de prueba', `content_id:${id('2')}`,
  '#EXTINF:-1,No compatible', 'https://example.invalid/demo.m3u8',
].join('\n');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const requests = [], errors = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(channel => {
      if (!localStorage.getItem('m3u-test-seeded')) {
        localStorage.setItem('ace-tv.channels', JSON.stringify([channel]));
        localStorage.setItem('ace-tv.favorites', JSON.stringify([channel]));
        localStorage.setItem('m3u-test-seeded', '1');
      }
    }, initial);
    await page.goto(app);
    const open = async () => {
      await page.locator('#guide-reload').click();
      await page.locator('#import-m3u').click();
    };
    const count = () => page.evaluate(() => AceCatalog.diagnostics().cachedChannels);
    const key = code => page.evaluate(keyCode => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, keyCode,
    })), code);

    await open();
    const card = await page.locator('.m3u-card').boundingBox();
    assert(card && card.y >= 0 && card.y + card.height <= 721, 'dialog fits at 720p');
    await page.locator('#m3u-text').fill(list);
    await page.locator('#m3u-preview').click();
    assert.equal(await count(), 1, 'preview does not write');
    assert.match(await page.locator('#m3u-dialog').innerText(), /Noticias de prueba/);
    await key(10009);
    assert.equal(await count(), 1, 'remote Back cancels preview');
    if (await page.locator('#m3u-dialog').isVisible()) await page.locator('#m3u-cancel').click();
    assert.equal(await page.locator('#m3u-dialog').isVisible(), false);

    await page.locator('#import-m3u').click();
    await page.locator('#m3u-file').setInputFiles({ name: 'demo.m3u', mimeType: 'audio/x-mpegurl', buffer: Buffer.from(list) });
    await page.waitForFunction(expected => document.querySelector('#m3u-text').value === expected, list);
    await page.locator('#m3u-preview').click();
    await page.locator('#m3u-confirm').click();
    assert.equal(await count(), 2);
    assert.deepEqual(await page.evaluate(() => AceCatalog.libraryState().favorites.map(item => item.name)), [initial.name]);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ace-tv.channels'))[1].kind), 'content_id');

    await page.reload();
    assert.equal(await count(), 2);
    await open();
    await page.locator('#m3u-text').fill(list);
    await page.locator('#m3u-preview').click();
    assert.equal(await page.locator('#m3u-confirm').isEnabled(), false, 'reimporting duplicates cannot write');
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    console.log('PASS M3U on desktop: paste, local file, 720p, preview/cancel, append, favorites, reload and no network.');
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
