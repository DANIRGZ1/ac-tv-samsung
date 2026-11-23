const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--allow-file-access-from-files']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.setDefaultTimeout(6000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(!localStorage.getItem('ace-tv.channels')){
   localStorage.setItem('ace-tv.channels',JSON.stringify([{id:'1'.repeat(40),name:'Canal privado secreto',kind:'content_id'},{id:'2'.repeat(40),name:'Canal privado secreto',kind:'content_id'}]));
   localStorage.setItem('ace-tv.favorites',localStorage.getItem('ace-tv.channels'));
  }
  localStorage.setItem('ace-tv.public-use.v1','seen');
  window.AceVpnProfile={read:()=>({secret:'TOKEN_NUNCA_EXPORTAR',endpoint:'192.168.1.99'})};
  let state='NONE';
  window.webapis={avplay:{getState:()=>state,setDisplayRect(){},setDisplayMethod(){},open(){state='IDLE'},setListener(v){window.listener=v},prepareAsync(ok){window.ready=ok},play(){state='PLAYING'},stop(){state='NONE'},close(){state='NONE'},getCurrentTime:()=>0}};
 });
 const url='file:///'+path.resolve('work/acetv-native-app/index.html').replace(/\\/g,'/');
 async function transport(){await page.evaluate(()=>{window.NativeP2PTransport={start(spec){window.source=spec;return new Promise(resolve=>window.resolveStream=resolve)},stop(){},invalidate(){},diagnostics(){return {}}}});}
 await page.goto(url);await transport();
 const initial=await page.evaluate(()=>[localStorage.getItem('ace-tv.channels'),localStorage.getItem('ace-tv.favorites')]);
 await page.evaluate(()=>AceCatalog.playSaved('2'.repeat(40)));
 await page.evaluate(()=>resolveStream('http://127.0.0.1:1234/test'));await page.evaluate(()=>ready());
 assert.equal(await page.evaluate(()=>AceTV.diagnostics().phase),'playing');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ace-tv.working-links.v1'))[0].id),'2'.repeat(40));
 await page.evaluate(()=>AceTV.stop());
 await page.reload();await transport();
 await page.locator('#guide-watch').click();
 assert.equal(await page.evaluate(()=>source.contentId),'2'.repeat(40),'OK must reuse successful alternative after restart');
 assert.equal(await page.locator('#loading-back').isVisible(),true);
 await page.locator('#loading-back').click();
 assert.equal(await page.evaluate(()=>AceTV.diagnostics().phase),'idle');
 assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('ace-tv.channels'),localStorage.getItem('ace-tv.favorites')]),initial);
 await page.locator('#guide-library').click();
 await page.locator('#library-links').click();
 assert((await page.locator('.library-link').allTextContents()).some(s=>s.includes('Se abre con OK')));
 assert.equal(await page.evaluate(()=>AceCatalog.preferLink('1'.repeat(40)).ok),true);
 await page.locator('#library-close').click();
 await page.locator('#guide-watch').click();
 assert.equal(await page.evaluate(()=>source.contentId),'1'.repeat(40),'explicit main source overrides remembered alternative');
 await page.keyboard.press('Escape');
 for(const viewport of [{width:1920,height:1080},{width:1280,height:720}]){
  await page.setViewportSize(viewport);
  await page.locator('#guide-library').click();
  await page.locator('#library-diagnostics').click();
  assert.equal(await page.locator('#app-diagnostics').isVisible(),true);
  const report=await page.locator('.diagnostics-report').inputValue();
  for(const secret of ['Canal privado secreto','TOKEN_NUNCA_EXPORTAR','192.168.1.99','1'.repeat(40),'2'.repeat(40)])assert(!report.includes(secret));
  assert(report.includes('Canales: 2'));
  const bounds=await page.locator('.diagnostics-card').boundingBox();
  assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width&&bounds.y+bounds.height<=viewport.height);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-action=copy]').evaluate(e=>e===document.activeElement),true);
  await page.evaluate(()=>{document.execCommand=()=>false});
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.diagnostics-report').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#library-diagnostics').evaluate(e=>e===document.activeElement),true);
  await page.locator('#library-close').click();
 }
 const afterPreference=await page.evaluate(()=>[localStorage.getItem('ace-tv.channels'),localStorage.getItem('ace-tv.favorites')]);
 // Repeated modal open/back exercises event handling and focus restoration.
 for(let i=0;i<100;i++){
  await page.evaluate(()=>{document.getElementById('guide-library').click();document.getElementById('library-diagnostics').click()});
  await page.keyboard.press('Escape');
  await page.evaluate(()=>document.getElementById('library-close').click());
 }
 assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('ace-tv.channels'),localStorage.getItem('ace-tv.favorites')]),afterPreference);
 assert.deepEqual(errors,[]);
 console.log('PASS successful-source persistence, explicit preference, preserved library, cancellable loading, safe diagnostics, 720p/1080p and 100 modal cycles');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
