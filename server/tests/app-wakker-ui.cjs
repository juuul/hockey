// Gebouwde app tegen twee nagebootste publicaties, uitsluitend fictieve lokale gegevens.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const puppeteer=require('/usr/src/app/node_modules/puppeteer')
const url=process.env.TEST_URL||'http://127.0.0.1:5190/'
const site='/site'
const html=fs.readFileSync(path.join(site,'index.html'),'utf8')
const asset=html.match(/src="\.\/assets\/([^"?]+\.js)"/)[1]
const js=fs.readFileSync(path.join(site,'assets',asset))
;(async()=>{
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium-browser',args:['--no-sandbox']})
 try{
  const page=await browser.newPage();await page.setViewport({width:390,height:844})
  let versie=0,controles=0,navigaties=0,fout=false
  const fouten=[];page.on('pageerror',e=>fouten.push(e.message))
  await page.evaluateOnNewDocument(()=>{
   const nu=Date.now.bind(Date);window.tijdExtra=0;Date.now=()=>nu()+window.tijdExtra
   if(localStorage.getItem('wakker-fixture'))return
   localStorage.clear();localStorage.setItem('wakker-fixture','1');localStorage.setItem('hockey_test_backend','apart-v1')
   localStorage.setItem('hockey_test_opstelling',JSON.stringify('2-3-3'))
   localStorage.setItem('hockey_test_score',JSON.stringify({wij:2,zij:1}))
  })
  await page.setRequestInterception(true)
  page.on('request',r=>{
   const u=new URL(r.url());if(u.hostname!==new URL(url).hostname||u.pathname.includes('/api/'))return r.abort()
   if(u.pathname===new URL(url).pathname){
    if(r.isNavigationRequest())navigaties++;else controles++
    if(fout&&!r.isNavigationRequest())return r.respond({status:503,body:'tijdelijk offline'})
    return r.respond({contentType:'text/html',body:html.replace(asset,versie?`nieuw-${versie}.js`:asset)})
   }
   if(/\/assets\/nieuw-\d+\.js$/.test(u.pathname))return r.respond({contentType:'text/javascript',body:js})
   return r.continue()
  })
  const wacht=async(pred)=>{const eind=Date.now()+8000;while(!pred()){if(Date.now()>eind)throw Error('Controle niet voltooid');await new Promise(r=>setTimeout(r,50))}}
  const wakker=()=>page.evaluate(()=>{window.tijdExtra+=31000;window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'))})
  await page.goto(url);await page.waitForSelector('.player-slot');await wacht(()=>controles>=1)
  assert.equal(navigaties,1,'Geen herlaadlus bij dezelfde versie')
  let n=controles;await wakker();await wacht(()=>controles>n);await new Promise(r=>setTimeout(r,100));assert.equal(controles,n+1,'Focus/pageshow/zichtbaar bundelen');assert.equal(navigaties,1)
  await page.click('.tab-btn[aria-label="Spelers"]');await page.click('.btn-icon');await page.type('input[placeholder="Voornaam"]','T Invoer')
  versie=1;n=controles;await wakker();await wacht(()=>controles>n);await new Promise(r=>setTimeout(r,100))
  assert.equal(navigaties,1,'Open formulier mag niet verdwijnen');assert.equal(await page.$eval('input[placeholder="Voornaam"]',e=>e.value),'T Invoer')
  await page.click('.modal .btn-secondary');await page.evaluate(()=>{document.querySelector('.players-screen').scrollTop=300})
  const scroll=await page.$eval('.players-screen',e=>e.scrollTop)
  await Promise.all([page.waitForNavigation(),wakker()]);await page.waitForSelector('.players-screen');assert.equal(navigaties,2)
  assert.equal(await page.$eval('.players-screen',e=>e.scrollTop),scroll)
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('hockey_test_score'))),{wij:2,zij:1})
  await page.click('.tab-btn[aria-label="Wedstrijd"]');await page.click('[aria-label="Starten"]')
  versie=2;n=controles;await wakker();await wacht(()=>controles>n);await new Promise(r=>setTimeout(r,100));assert.equal(navigaties,2,'Lopende klok mag niet onderbroken worden')
  await page.click('[aria-label="Pauzeren"]');await Promise.all([page.waitForNavigation(),wakker()]);await page.waitForSelector('[aria-label="Verdergaan"]');assert.equal(navigaties,3)
  fout=true;n=controles;await wakker();await wacht(()=>controles>n);assert.equal(navigaties,3,'503 mag de bruikbare app niet herladen')
  assert.deepEqual(fouten,[])
  console.log('APP_WAKKER_UI_OK: openen, Chrome-terugkeer, events bundelen, dezelfde versie blijft staan, nieuwe code met scroll/scorebehoud, invoer en lopende klok beschermd, hervatten en 503 zonder herlaadlus.')
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
