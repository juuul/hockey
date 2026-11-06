// Echte categorieknoppen en wissels met alleen lokale fictieve spelers; geen API of echte teamdata.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const url = process.env.TEST_URL || 'http://127.0.0.1:5189/'
;(async () => {
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium-browser',args:['--no-sandbox']})
 try {
  const page=await browser.newPage();await page.setViewport({width:390,height:844})
  const fouten=[];page.on('pageerror',e=>fouten.push(e.message))
  await page.evaluateOnNewDocument(()=>{
   if(localStorage.getItem('categorie-kleur-fixture'))return
   localStorage.clear();localStorage.setItem('categorie-kleur-fixture','1');localStorage.setItem('hockey_test_backend','apart-v1')
   localStorage.setItem('hockey_test_opstelling',JSON.stringify('2-1-2'))
   const pos=['K','LW','RW','CM','LBM','RBM']
   localStorage.setItem('hockey_test_spelers',JSON.stringify(Array.from({length:12},(_,i)=>({id:`kind${i}`,naam:`T Kind ${i}`,positie:pos[i]||'LW',meedoen:true,isKeeper:i===0,inVeld:i<6,wisselCount:2,inVolgorde:i<6?0:50}))))
  })
  await page.setRequestInterception(true)
  page.on('request',req=>{const u=new URL(req.url());return u.hostname===new URL(url).hostname&&!u.pathname.includes('/api/')?req.continue():req.abort()})
  await page.goto(url);await page.waitForSelector('.player-slot')
  const snapshot=()=>page.evaluate(()=>({spelers:JSON.parse(localStorage.getItem('hockey_test_spelers')),wisselingen:JSON.parse(localStorage.getItem('hockey_test_wisselingen')||'[]'),opstelling:JSON.parse(localStorage.getItem('hockey_test_opstelling'))}))
  const groen=async()=>{
   assert.equal(await page.$('.player-slot.rood, .player-slot.oranje'),null)
   const d=await snapshot();assert.equal(d.wisselingen.length,0);assert.ok(d.spelers.every(s=>s.wisselCount===2))
   assert.ok(d.spelers.filter(s=>s.inVeld&&!s.isKeeper).every(s=>(s.inVolgorde||0)===0))
  }
  const kies=async(groep,tekst)=>{
   await page.click('.tab-btn[aria-label="Spelers"]')
   await page.evaluate(({groep,tekst})=>{const b=[...document.querySelectorAll(`[aria-label="${groep}"] button`)].find(b=>b.textContent===tekst);if(!b)throw Error('Keuze ontbreekt: '+tekst);b.click()},{groep,tekst})
   await page.click('.tab-btn[aria-label="Wedstrijd"]');await page.waitForSelector('.player-slot')
  }
  const voor=await snapshot();await groen()
  await kies('Categorie','O12+ / senioren');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hockey_test_spelers')).filter(s=>s.inVeld).length===11);await groen()
  await page.click('[aria-label="Undo"]')
  await page.waitForFunction(v=>JSON.stringify(JSON.parse(localStorage.getItem('hockey_test_spelers')))===JSON.stringify(v),{},voor.spelers)
  assert.equal((await snapshot()).opstelling,'2-1-2');await groen()
  await kies('Categorie','O11');await groen()
  await kies('Categorie','O9');await groen()
  await kies('Veld of zaal','Zaal');await groen()
  await kies('Categorie','Mini’s · 3 tegen 3');await groen()
  assert.equal((await snapshot()).spelers.filter(s=>s.isKeeper).length,0)
  await kies('Veld of zaal','Veld');await groen()
  // Een echte veld/bank-wissel geeft wel kleur, ook zonder lopende klok.
  const namen={uit:await page.$eval('.player-slot:not(.keeper):not(.leeg) .name',e=>e.textContent),in:await page.$eval('.substitute-item .name',e=>e.textContent)}
  const oud=await snapshot();const uit=oud.spelers.find(s=>s.naam===namen.uit),inv=oud.spelers.find(s=>s.naam===namen.in)
  await page.click('.player-slot:not(.keeper):not(.leeg)');await page.click('.substitute-item')
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hockey_test_wisselingen')).length===1)
  assert.ok(await page.$('.player-slot.rood'))
  const na=await snapshot();assert.equal(na.spelers.find(s=>s.id===uit.id).wisselCount,3);assert.ok(na.spelers.find(s=>s.id===inv.id).inVolgorde>0)
  await page.reload();await page.waitForSelector('.player-slot.rood')
  assert.deepEqual((await snapshot()).spelers,na.spelers)
  assert.deepEqual(fouten,[])
  console.log('CATEGORIE_KLEUREN_UI_OK: vergroten/verkleinen, leeftijd, veld/zaal, zonder keeper en Undo blijven groen zonder teller/historiewijziging; echte wissel bij stilstand kleurt wel en blijft na verversen bewaard.')
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
