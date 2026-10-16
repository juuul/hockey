const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    let nieuw = false, controles = 0
    await page.setRequestInterception(true)
    page.on('request', req => {
      const u = new URL(req.url())
      if (u.hostname !== '127.0.0.1') return req.abort()
      if (u.pathname.includes('/assets/')) return req.respond({ contentType: u.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: '' })
      if (u.pathname === '/__versietest') {
        if (!req.isNavigationRequest()) { controles++; return req.respond({ contentType: 'text/html', body: `<script type="module" src="/assets/${nieuw ? 'nieuw' : 'oud'}.js"></script>` }) }
        return req.respond({ contentType: 'text/html', body: `<script type="module" src="/assets/${nieuw ? 'nieuw' : 'oud'}.js"></script><div class="content" style="height:200px;overflow:auto"><div style="height:2000px">Test</div></div><script type="module">
          const m=await import('/src/appVerversen.ts');window.m=m;m.herstelScrollNaUpdate(document.querySelector('.content'));window.klaar=true;
        </script>` })
      }
      req.continue()
    })
    await page.goto('http://127.0.0.1:5187/__versietest')
    await page.waitForFunction(() => window.klaar)
    assert.equal(await page.evaluate(() => window.m.assetVersie(new DOMParser().parseFromString('<script type="module" src="./assets/a.js"></script><link rel="stylesheet" href="./assets/b.css">', 'text/html'), 'https://example.invalid/test/')), '/test/assets/a.js|/test/assets/b.css')
    await page.evaluate(() => window.m.verversAppVersie(document.querySelector('.content')))
    assert.equal(controles, 1)
    nieuw = true
    // Een popup die tijdens ophalen opengaat mag niet door de nieuwe versie worden onderbroken.
    await page.evaluate(() => { const e=document.createElement('div');e.className='modal show';document.body.append(e) })
    await page.evaluate(() => window.m.verversAppVersie(document.querySelector('.content')))
    assert.equal(await page.$eval('script[src*="/assets/"]', e => e.getAttribute('src')), '/assets/oud.js')
    await page.evaluate(() => { document.querySelector('.modal').remove(); document.querySelector('.content').scrollTop=350 })
    await page.evaluate(() => {
      const gegevens = new Promise(resolve => { window.gegevensOpgeslagen = resolve })
      window.codeControle = window.m.verversAppVersie(document.querySelector('.content'), gegevens)
    })
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(await page.$eval('script[src*="/assets/"]', e => e.getAttribute('src')), '/assets/oud.js', 'Eerst lopende gegevensopslag afwachten')
    await Promise.all([page.waitForNavigation(), page.evaluate(() => window.gegevensOpgeslagen())])
    await page.waitForFunction(() => window.klaar)
    assert.equal(await page.$eval('script[src*="/assets/"]', e => e.getAttribute('src')), '/assets/nieuw.js')
    assert.equal(await page.$eval('.content', e => e.scrollTop), 350)
    console.log('APP_VERVERSEN_OK: cachevrije versiecheck, zelfde versie blijft staan, popup beschermd, nieuwe code met scrollherstel.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
