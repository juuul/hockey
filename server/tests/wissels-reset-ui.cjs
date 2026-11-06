// Reset en opnieuw loten in de echte app; alleen fictieve lokale spelers, zonder API.
const assert=require('node:assert/strict')
const puppeteer=require('/usr/src/app/node_modules/puppeteer')
const url=process.env.TEST_URL||'http://127.0.0.1:5189/'
;(async()=>{
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium-browser',args:['--no-sandbox']})
 try {
  for(const opstelling of ['2-3-3','zaal-2-1-2']){
   const page=await browser.newPage();await page.setViewport({width:390,height:844})
   const fouten=[];page.on('pageerror',e=>fouten.push(e.message))
   await page.setRequestInterception(true)
   page.on('request',r=>new URL(r.url()).hostname===new URL(url).hostname&&!r.url().includes('/api/')?r.continue():r.abort())
   await page.evaluateOnNewDocument(opstelling=>{
    if(localStorage.getItem('reset-fixture'))return
    localStorage.clear();localStorage.setItem('reset-fixture','1');localStorage.setItem('hockey_test_backend','apart-v1')
    localStorage.setItem('hockey_test_opstelling',JSON.stringify(opstelling))
    localStorage.setItem('hockey_test_score',JSON.stringify({wij:2,zij:1}))
    localStorage.setItem('hockey_test_spelers',JSON.stringify(Array.from({length:12},(_,i)=>({id:`kind${i}`,naam:`T Kind ${i}`,positie:i===0?'K':'LW',isKeeper:i===0,inVeld:i===0,meedoen:i!==11,wisselCount:i===0?3:1,inVolgorde:5}))))
   },opstelling)
   await page.goto(url);await page.waitForSelector('.player-slot')
   const klik=async tekst=>{const buttons=await page.$$('button');for(const b of buttons){if(await b.evaluate(e=>e.textContent.trim())===tekst){await b.click();return}}throw Error('Knop ontbreekt: '+tekst)}
   const stand=()=>page.evaluate(()=>({spelers:JSON.parse(localStorage.getItem('hockey_test_spelers')),score:JSON.parse(localStorage.getItem('hockey_test_score'))}))
   const reset=async()=>{await klik('Reset wissels');await page.waitForSelector('.reset-modal-overlay');assert.match(await page.$eval('.reset-modal',e=>e.textContent),/Alle wisseltellers op 0, ook op de bank/);await klik('Ja, reset wissels');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hockey_test_spelers')).every(s=>s.wisselCount===0&&s.inVolgorde===0))}
   const voor=await stand();await reset();const na=await stand()
   assert.deepEqual(na.score,voor.score)
   const zonderTellers=spelers=>spelers.map(({wisselCount,inVolgorde,...s})=>s)
   assert.deepEqual(zonderTellers(na.spelers),zonderTellers(voor.spelers))
   await page.click('[aria-label="Undo"]');await page.waitForFunction(v=>JSON.stringify(JSON.parse(localStorage.getItem('hockey_test_spelers')))===JSON.stringify(v),{},voor.spelers)
   await reset();await klik('Nieuwe opstelling');await klik('Ja, nieuwe opstelling')
   assert.ok((await stand()).spelers.every(s=>s.wisselCount===0))
   assert.equal(await page.$('.player-slot.rood, .player-slot.oranje'),null)
   await page.click('.player-slot:not(.keeper):not(.leeg)');await page.click('.substitute-item')
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hockey_test_wisselingen')).length===1)
   const echt=await stand();assert.equal(echt.spelers.filter(s=>s.wisselCount===1).length,1);assert.ok(echt.spelers.every(s=>s.wisselCount<=1))
   assert.ok(await page.$('.player-slot.rood'))
   await page.reload();await page.waitForSelector('.player-slot.rood');assert.deepEqual((await stand()).spelers,echt.spelers)
   assert.deepEqual(fouten,[]);await page.close()
  }
  console.log('WISSELS_RESET_UI_OK: veld/zaal iedereen nul, opstelling/score behouden, Undo, opnieuw loten zonder spookwissels en echte wissel telt precies één, ook na verversen.')
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
