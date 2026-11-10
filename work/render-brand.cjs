const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const cover = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await cover.goto(pathToFileURL(path.join(root, 'docs/brand/cover.html')).href);
    await cover.evaluate(() => Promise.all(Array.from(document.images, img => img.decode())));
    assert.equal(await cover.locator('figure').evaluate(el => getComputedStyle(el).transform), 'none');
    const size = await cover.locator('figure img').boundingBox();
    assert(Math.abs(size.width / size.height - 16 / 9) < 0.005);
    await cover.screenshot({ path: path.join(root, 'docs/images/cover.png') });

    const icon = await browser.newPage({ viewport: { width: 512, height: 512 } });
    await icon.goto(pathToFileURL(path.join(root, 'docs/brand/icon.svg')).href);
    await icon.screenshot({ path: path.join(root, 'work/acetv-native-app/icon.png'), omitBackground: true });
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
