// Echte categorieknoppen met een nieuwe, gepauzeerde en lopende fictieve wedstrijd.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const url = process.env.TEST_URL || 'http://127.0.0.1:5189/'
;(async () => {
 const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium-browser',args:['--no-sandbox']})
 try {
  for (const status of ['nieuw', 'pauze', 'lopend']) {
   const page = await browser.newPage()
   await page.setViewport({width:390,height:844})
   const fouten=[];page.on('pageerror',e=>fouten.push(e.message))
   await page.setRequestInterception(true)
   page.on('request',r=>new URL(r.url()).hostname===new URL(url).hostname&&!r.url().includes('/api/')?r.continue():r.abort())
   await page.evaluateOnNewDocument(status=>{
    localStorage.clear();localStorage.setItem('hockey_test_backend','apart-v1')
    localStorage.setItem('hockey_test_opstelling',JSON.stringify('2-1-2'))
    localStorage.setItem('hockey_test_spelers',JSON.stringify(Array.from({length:12},(_,i)=>({id:`kind${i}`,naam:`T Kind ${i}`,positie:i===0?'K':'LW',inVeld:i===0,meedoen:true,isKeeper:i===0,wisselCount:2,inVolgorde:0}))))
    localStorage.setItem('hockey_test_timer',JSON.stringify({gestartOp:status==='lopend'?Date.now():null,opgebouwd:status==='nieuw'?0:61000}))
   },status)
   await page.goto(url);await page.click('.tab-btn[aria-label="Spelers"]')
   const knoppen=await page.$$('[aria-label="Categorie"] button')
   assert.equal(await page.$$eval('[aria-label="Categorie"] button',bs=>bs.every(b=>b.disabled)),status!=='nieuw')
   if(status==='nieuw') {
    assert.equal(await page.$('#categorie-blokkade'),null)
    await knoppen[0].click()
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hockey_test_opstelling'))==='3-4-3')
   } else {
    const melding=await page.$eval('#categorie-blokkade',e=>e.textContent)
    assert.match(melding,status==='pauze'?/klok staat stil, maar bevat nog 1:01 wedstrijdtijd/:/wedstrijdklok loopt/)
    assert.equal(await page.$eval('[aria-label="Categorie"]',e=>e.getAttribute('aria-describedby')),'categorie-blokkade')
    const voor=await page.evaluate(()=>localStorage.getItem('hockey_test_spelers'))
    await knoppen[0].click()
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('hockey_test_opstelling'))),'2-1-2')
    assert.equal(await page.evaluate(()=>localStorage.getItem('hockey_test_spelers')),voor)
    assert.ok(await page.$eval('[aria-label="Veld of zaal"] button',e=>e.disabled))
    assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('hockey_test_timer')).opgebouwd===61000))
   }
   const b=(await page.$$('[aria-label="Opstelling"] button'))[1]
   await b.click();assert.equal(await b.evaluate(e=>e.getAttribute('aria-checked')),'true')
   assert.deepEqual(fouten,[])
   await page.close()
  }
  console.log('CATEGORIE_BLOKKADE_UI_OK: categorie klikbaar bij nul; gepauzeerde/opgeslagen en lopende tijd duidelijk uitgelegd boven knoppen, geen gegevensreset en opstelling blijft wijzigbaar.')
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
