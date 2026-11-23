const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

async function render() {
  const root = path.resolve(__dirname, '..');
  const media = path.join(root, 'docs/images');
  const browser = await chromium.launch({channel:'chrome', args:['--allow-file-access-from-files']});
  try {
    const page = await browser.newPage({viewport:{width:1920,height:1080}, deviceScaleFactor:1});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const channels = ['Fútbol 1','Campeones 1','Deportes 1','Cine 1','Noticias 1'].map((name,index) => ({
        id: String(index+1).repeat(40), name, kind:'content_id'
      }));
      localStorage.setItem('ace-tv.public-use.v1','seen');
      localStorage.setItem('ace-tv.channels',JSON.stringify(channels));
      localStorage.setItem('ace-tv.favorites',JSON.stringify(channels.slice(0,4)));
      window.webapis = {avplay:{getState:()=> 'NONE', close(){}}};
    });
    await page.goto(pathToFileURL(path.join(root,'work/acetv-native-app/index.html')).href);
    await page.locator('#guide-home').click();
    await page.locator('#category-football').focus();
    await page.locator('#guide-list [role=option]').first().waitFor();
    await page.screenshot({path:path.join(media,'readme-home.jpg'),quality:88,animations:'disabled'});
    await page.evaluate(() => {
      window.NativeP2PTransport = {
        start(_source, progress) {
          progress({type:'progress',stage:'finding-peers'});
          return new Promise(() => {});
        },
        stop(){},
        diagnostics(){return {};}
      };
    });
    await page.locator('#guide-watch').click();
    assert.equal(await page.locator('#loading-copy').textContent(),'Buscando conexiones P2P…');
    await page.screenshot({path:path.join(media,'readme-loading.jpg'),quality:88,animations:'disabled'});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#channel-loading').isVisible(),false);
    assert.deepEqual(errors,[]);
    const cover = await browser.newPage({viewport:{width:1600,height:620},deviceScaleFactor:1});
    await cover.goto(pathToFileURL(path.join(root,'docs/brand/readme-cover.html')).href);
    await cover.evaluate(() => Promise.all(Array.from(document.images,image => image.decode())));
    const screen = await cover.locator('figure img').boundingBox();
    assert(Math.abs(screen.width/screen.height-16/9)<0.005);
    assert(screen.x+screen.width<=1600 && screen.y+screen.height<=620);
    await cover.screenshot({path:path.join(media,'readme-cover.jpg'),quality:90});
  } finally {
    await browser.close();
  }
}

render().catch(error=>{console.error(error);process.exitCode=1;});
