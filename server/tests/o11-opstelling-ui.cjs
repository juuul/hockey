// De gebouwde app: O11 buiten 1-3-3-1, uitsluitend fictieve lokale gegevens.
const assert=require('node:assert/strict')
const puppeteer=require('/usr/src/app/node_modules/puppeteer')
const url=process.env.TEST_URL||'http://127.0.0.1:5190/'
;(async()=>{
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium-browser',args:['--no-sandbox']})
 try{
  const page=await browser.newPage();await page.setViewport({width:390,height:844})
  const fouten=[];page.on('pageerror',e=>fouten.push(e.message))
  await page.setRequestInterception(true)
  page.on('request',r=>new URL(r.url()).hostname===new URL(url).hostname&&!r.url().includes('/api/')?r.continue():r.abort())
  await page.evaluateOnNewDocument(()=>{
   if(localStorage.getItem('o11-fixture'))return
   localStorage.clear();localStorage.setItem('o11-fixture','1');localStorage.setItem('hockey_test_backend','apart-v1')
   localStorage.setItem('hockey_test_opstelling',JSON.stringify('2-3-3'))
   const pos=['K','LW','RW','LM','CM','RM','LBM','CBM','RBM']
   localStorage.setItem('hockey_test_spelers',JSON.stringify(Array.from({length:11},(_,i)=>({id:`kind${i}`,naam:`T Speler ${i}`,positie:pos[i]||'LW',inVeld:i<9,meedoen:true,isKeeper:i===0,wisselCount:0,inVolgorde:0}))))
  })
  await page.goto(url);await page.waitForSelector('.player-slot')
  const data=()=>page.evaluate(()=>({spelers:JSON.parse(localStorage.getItem('hockey_test_spelers')),opstelling:JSON.parse(localStorage.getItem('hockey_test_opstelling'))}))
  const kies=async(groep,tekst)=>{for(const b of await page.$$(`[aria-label="${groep}"] button`)){if(await b.evaluate(e=>e.textContent)===tekst){await b.click();return}}throw Error('Keuze ontbreekt: '+tekst)}
  const beschikbaar=()=>page.$$eval('[aria-label="Opstelling"] button',bs=>bs.some(b=>b.textContent==='1-3-3-1'))
  const voor=await data()
  await page.click('.tab-btn[aria-label="Spelers"]');await kies('Opstelling','1-3-3-1')
  await page.click('.tab-btn[aria-label="Wedstrijd"]');await page.waitForSelector('.field-row:nth-of-type(5)')
  assert.deepEqual(await page.$$eval('.field-row',rs=>rs.map(r=>r.querySelectorAll('.player-slot').length)),[1,3,3,1,1])
  let d=await data();assert.equal(d.opstelling,'1-3-3-1');assert.equal(d.spelers.filter(s=>s.inVeld).length,9)
  assert.equal(d.spelers.filter(s=>s.isKeeper).length,1);assert.ok(d.spelers.every(s=>s.wisselCount===0))
  assert.equal(await page.$('.player-slot.rood, .player-slot.oranje'),null)
  const vrij=await page.$$eval('.field-row',rs=>rs.slice(0,-1).every((r,i)=>r.getBoundingClientRect().bottom<=rs[i+1].getBoundingClientRect().top+1))
  assert.ok(vrij,'De vijf rijen mogen niet overlappen')
  await page.click('[aria-label="Undo"]');await page.waitForFunction(v=>JSON.stringify(JSON.parse(localStorage.getItem('hockey_test_spelers')))===JSON.stringify(v),{},voor.spelers)
  assert.equal((await data()).opstelling,'2-3-3')
  await page.click('.tab-btn[aria-label="Spelers"]');await kies('Categorie','O9');assert.equal(await beschikbaar(),false)
  await kies('Veld of zaal','Zaal');assert.equal(await beschikbaar(),false)
  await kies('Veld of zaal','Veld');await kies('Categorie','O11');await kies('Opstelling','1-3-3-1')
  await page.click('.tab-btn[aria-label="Voorkeur"]');await page.select('[aria-label="1e keuze voor T Speler 1"]','LIB')
  await page.click('.tab-btn[aria-label="Wedstrijd"]')
  for(const tekst of ['Nieuwe opstelling','Ja, nieuwe opstelling']){
   for(const b of await page.$$('button')){if(await b.evaluate(e=>e.textContent.trim())===tekst){await b.click();break}}
  }
  await page.waitForFunction(()=>document.querySelectorAll('.player-slot:not(.leeg)').length===9)
  assert.ok((await data()).spelers.every(s=>s.wisselCount===0))
  const veld=await data();const libero=veld.spelers.find(s=>s.inVeld&&s.positie==='LIB')
  const slot=await page.$('.field-row:nth-of-type(4) .player-slot')
  assert.match(await slot.evaluate(e=>e.textContent),new RegExp(libero.naam))
  await slot.click();await page.click('.substitute-item')
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hockey_test_wisselingen')).length===1)
  d=await data();assert.equal(d.spelers.find(s=>s.id===libero.id).wisselCount,1)
  assert.equal(d.spelers.filter(s=>s.inVeld&&s.positie==='LIB').length,1)
  assert.equal(d.spelers.filter(s=>s.inVeld).length,9);assert.ok(await page.$('.player-slot.rood'))
  await page.reload();await page.waitForSelector('.player-slot.rood');assert.deepEqual(await data(),d)
  assert.deepEqual(fouten,[])
  console.log('O11_OPSTELLING_UI_OK: alleen O11 buiten, vijf aparte rijen inclusief keeper, 9 spelers, groen zonder wissels, Undo, libero als voorkeur, echte wissel en bewaren na verversen.')
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
