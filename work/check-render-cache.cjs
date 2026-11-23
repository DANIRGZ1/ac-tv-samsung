const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--allow-file-access-from-files'],headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
   const channels=Array.from({length:2016},(_,i)=>({id:(i+1).toString(16).padStart(40,'0'),name:'Canal de prueba '+(i+1),kind:'content_id'}));
   localStorage.setItem('ace-tv.public-use.v1','seen');localStorage.setItem('ace-tv.channels',JSON.stringify(channels));localStorage.setItem('ace-tv.favorites',JSON.stringify(channels.slice(0,3)));
  });
  await p.goto('file:///'+path.resolve('work/acetv-native-app/index.html').replace(/\\/g,'/'));
  const library=await p.evaluate(()=>[localStorage.getItem('ace-tv.channels'),localStorage.getItem('ace-tv.favorites')]);
  await p.locator('#guide-live').click();
  await p.evaluate(()=>window.firstLive=document.querySelector('#guide-list [role=option]'));
  for(let i=0;i<100;i++)await p.evaluate(()=>{document.getElementById('guide-home').click();document.getElementById('guide-favorites').click();document.getElementById('guide-live').click();});
  assert.equal(await p.evaluate(()=>window.firstLive===document.querySelector('#guide-list [role=option]')),true,'warm section changes reuse the card instead of rebuilding it');
  assert.equal(await p.locator('#guide-list [role=option]').count(),50);
  assert.deepEqual(await p.evaluate(()=>[localStorage.getItem('ace-tv.channels'),localStorage.getItem('ace-tv.favorites')]),library);
  const chosen=(11).toString(16).padStart(40,'0');
  assert.equal(await p.evaluate(id=>AceCatalog.toggleFavorite(id),chosen),true);
  await p.locator('#guide-home').click();await p.locator('#guide-live').click();
  assert.equal(await p.locator('#guide-list .is-favorite').count(),4,'favorite change invalidates all section visuals');
  assert.equal(await p.evaluate(id=>AceCatalog.editChannel(id,'Nombre actualizado','content_id:'+id).ok,chosen),true);
  await p.locator('#guide-home').click();await p.locator('#guide-live').click();
  assert((await p.locator('#guide-list [role=option]').allTextContents()).some(text=>text.includes('Nombre actualizado')));
  assert.equal(await p.evaluate(id=>AceCatalog.deleteChannel(id).ok,chosen),true);
  await p.locator('#guide-home').click();await p.locator('#guide-live').click();
  assert(!(await p.locator('#guide-list [role=option]').allTextContents()).some(text=>text.includes('Nombre actualizado')));
  assert.equal(await p.evaluate(()=>AceCatalog.diagnostics().cachedChannels),2015);
  assert.deepEqual(errors,[]);
  console.log('PASS 300 section changes reuse card DOM; library preserved; favorite, edit and delete invalidate cached views');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
