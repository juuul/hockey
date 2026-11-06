const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
;(async () => {
 const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium-browser',args:['--no-sandbox']})
 try {
  const page=await browser.newPage();await page.setViewport({width:390,height:844})
  let posts=0,fail=true
  await page.setRequestInterception(true)
  page.on('request', req=>{
   const u=new URL(req.url())
   if(u.pathname.includes('/api/')){
    let status=200,body={}
    if(u.pathname.endsWith('/confirm-verification')&&req.method()==='POST'){
     posts++;assert.equal(JSON.parse(req.postData()).token,'FictieveEmailToken')
     status=fail?400:200;body=fail?{message:'Invalid verification token.',data:{}}:{}
    }else if(u.pathname.includes('/records'))body={items:[],page:1,perPage:100,totalPages:1,totalItems:0}
    return req.respond({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'},body:body===null?'':JSON.stringify(body)})
   }
   if(u.hostname!==new URL(process.env.TEST_URL).hostname)return req.abort()
   req.continue()
  })
  const button=async text=>{const h=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(x=>x.textContent===text),text);return h.asElement()}
  await page.goto(process.env.TEST_URL+'#bevestigen=FictieveEmailToken',{waitUntil:'networkidle0'})
  await page.waitForFunction(()=>document.body.textContent.includes('E-mailadres bevestigen'))
  assert.equal(posts,0,'Openen bevestigt niet automatisch');assert.equal(new URL(page.url()).hash,'')
  await (await button('E-mailadres bevestigen')).click()
  await page.waitForSelector('[role="alert"]');assert.equal(posts,1)
  assert.match(await page.$eval('[role="alert"]',e=>e.textContent),/nieuwe bevestigingsmail/)
  fail=false;await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='E-mailadres bevestigen'&&!b.disabled));await(await button('E-mailadres bevestigen')).click()
  await page.waitForFunction(()=>document.body.textContent.includes('Je e-mailadres is bevestigd.')).catch(async e=>{console.error({posts,text:await page.$eval('body',e=>e.textContent)});throw e})
  assert.equal(posts,2)
  await(await button('Verder naar de app')).click()
  await page.waitForFunction(()=>document.body.textContent.includes('Inloggen'))
  assert.equal(posts,2)
  console.log('EMAILBEVESTIGING_UI_OK: mailfragment herkend, openen wijzigt niets, token niet in adres, zichtbare fout, opnieuw proberen, succes en terug naar app; fictieve API zonder mails.')
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
