// Echte HockeyProvider in headless Chrome, zonder account/serverdata of netwerkmutaties.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    const fouten = []
    page.on('pageerror', e => fouten.push(e.message))
    await page.evaluateOnNewDocument(() => {
      if (localStorage.getItem('kleurfixture')) return
      localStorage.clear()
      localStorage.setItem('kleurfixture', 'ja')
      localStorage.setItem('hockey_test_backend', 'apart-v1')
      localStorage.setItem('hockey_test_spelers', JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ id: String(i), naam: `Test ${i}`, positie: 'LW', inVeld: i < 6, meedoen: true, isKeeper: false, wisselCount: 2, inVolgorde: i < 5 ? i : 50 }))))
    })
    await page.setRequestInterception(true)
    page.on('request', req => {
      const u = new URL(req.url())
      if (u.hostname !== '127.0.0.1' || u.pathname.includes('/api/')) return req.abort()
      if (u.pathname === '/__wisseltest') return req.respond({ contentType: 'text/html', body: `<div id="test"></div><script type="module">
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;
        window.__vite_plugin_react_preamble_installed__=true;
        const {HockeyProvider,useHockey}=await import('/src/context/HockeyContext.tsx');
        function Probe(){window.hockey=useHockey();return React.createElement('span',null,'klaar')}
        ReactDOM.createRoot(document.querySelector('#test')).render(React.createElement(HockeyProvider,{demo:false},React.createElement(Probe)));
      </script>` })
      return req.continue()
    })
    await page.goto('http://127.0.0.1:5187/__wisseltest', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.hockey?.spelers.length === 7, { timeout: 8000 }).catch(e => { throw Error(fouten.join('; ') || e.message) })
    await page.evaluate(() => window.hockey.wissel('4', '6', 'LW'))
    await page.waitForFunction(() => window.hockey.spelers.find(s => s.id === '6').inVeld)
    const groen = await page.evaluate(() => ({ spelers: window.hockey.spelers, wisselingen: window.hockey.wisselingen }))
    assert.equal(groen.spelers.find(s => s.id === '6').inVolgorde, 0)
    assert.equal(groen.spelers.find(s => s.id === '4').wisselCount, 2)
    assert.equal(groen.wisselingen.length, 0)
    await page.evaluate(() => window.hockey.zetKlok(1000, true))
    await page.waitForFunction(() => window.hockey.timer.gestartOp !== null)
    await page.evaluate(() => window.hockey.wissel('6', '4', 'LW'))
    await page.waitForFunction(() => window.hockey.wisselingen.length === 1)
    assert.equal(await page.evaluate(() => window.hockey.spelers.find(s => s.id === '6').wisselCount), 3)
    assert.ok(await page.evaluate(() => window.hockey.spelers.find(s => s.id === '4').inVolgorde > 0))
    await page.evaluate(() => window.hockey.undo())
    await page.waitForFunction(() => window.hockey.wisselingen.length === 0)
    assert.deepEqual(await page.evaluate(() => window.hockey.spelers), groen.spelers)
    await page.evaluate(() => window.hockey.undo())
    await page.waitForFunction(() => !window.hockey.spelers.find(s => s.id === '6').inVeld)
    assert.equal(await page.evaluate(() => window.hockey.spelers.find(s => s.id === '6').inVolgorde), 50)
    await page.evaluate(() => window.hockey.pauzeTimer())
    await page.waitForFunction(() => window.hockey.timer.gestartOp === null)
    await page.evaluate(() => window.hockey.wissel('4', '6', 'LW'))
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('hockey_test_spelers')).find(s => s.id === '6').inVolgorde === 0)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.hockey?.spelers.find(s => s.id === '6').inVeld)
    assert.equal(await page.evaluate(() => window.hockey.spelers.find(s => s.id === '6').inVolgorde), 0)
    assert.deepEqual(fouten, [])
    console.log('WISSEL_PROVIDER_OK: niet-meetellen houdt teller/geschiedenis vast en maakt groen; echte wissel telt; Undo en verversen bewaren de juiste markering.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
