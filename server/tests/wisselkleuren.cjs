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
      localStorage.setItem('hockey_test_wissels_altijd_tellen', 'false')
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
        const {veldKleuren}=await import('/src/opstelling.ts');
        const {schemaVoor,wedstrijdDuur}=await import('/src/speelduur.ts');
        const {speeltijden,klokMs}=await import('/src/speeltijd.ts');
        window.tijden=()=>speeltijden(window.hockey.speeltijdLog,klokMs(window.hockey.timer));
        window.kleuren=()=>veldKleuren(window.hockey.spelers.filter(s=>s.inVeld&&!s.isKeeper));
        window.schema=schemaVoor(11);window.eindtijd=wedstrijdDuur(window.schema);
        function Probe(){window.hockey=useHockey();return React.createElement('span',null,'klaar')}
        ReactDOM.createRoot(document.querySelector('#test')).render(React.createElement(HockeyProvider,{demo:false},React.createElement(Probe)));
      </script>` })
      return req.continue()
    })
    await page.goto('http://127.0.0.1:5187/__wisseltest', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.hockey?.spelers.length === 7, { timeout: 8000 }).catch(e => { throw Error(fouten.join('; ') || e.message) })
    await page.evaluate(() => window.hockey.wissel('4', '6', 'LW'))
    await page.waitForFunction(() => window.hockey.spelers.find(s => s.id === '6').inVeld)
    const eerste = await page.evaluate(() => ({ spelers: window.hockey.spelers, wisselingen: window.hockey.wisselingen }))
    assert.equal(eerste.spelers.find(s => s.id === '6').inVolgorde, 51)
    assert.equal(eerste.spelers.find(s => s.id === '4').wisselCount, 3)
    assert.equal(eerste.wisselingen.length, 1)
    assert.equal(await page.evaluate(() => window.kleuren()['6']), 'rood')
    assert.deepEqual(await page.evaluate(() => window.hockey.timer), { gestartOp: null, opgebouwd: 0 })
    assert.deepEqual(await page.evaluate(() => window.tijden()), {}, 'Wissels tellen bij stilstand, maar speeltijd niet')
    await page.evaluate(() => window.hockey.wissel('4', '6', 'LW'))
    assert.deepEqual(await page.evaluate(() => ({ spelers: window.hockey.spelers, wisselingen: window.hockey.wisselingen })), eerste, 'Dubbele wissel mag niet alleen de teller veranderen')
    await page.evaluate(() => window.hockey.zetKlok(1000, true))
    await page.waitForFunction(() => window.hockey.timer.gestartOp !== null)
    assert.ok(await page.evaluate(() => Object.values(window.tijden()).some(t=>Object.values(t).some(sec=>sec>0))), 'Speeltijd blijft werken bij lopende klok')
    await page.evaluate(() => window.hockey.wissel('6', '4', 'LW'))
    await page.waitForFunction(() => window.hockey.wisselingen.length === 2)
    assert.equal(await page.evaluate(() => window.hockey.spelers.find(s => s.id === '6').wisselCount), 3)
    assert.ok(await page.evaluate(() => window.hockey.spelers.find(s => s.id === '4').inVolgorde > 0))
    await page.evaluate(() => window.hockey.undo())
    await page.waitForFunction(() => window.hockey.wisselingen.length === 1)
    assert.deepEqual(await page.evaluate(() => window.hockey.spelers), eerste.spelers)
    await page.evaluate(() => window.hockey.undo())
    await page.waitForFunction(() => !window.hockey.spelers.find(s => s.id === '6').inVeld)
    assert.equal(await page.evaluate(() => window.hockey.spelers.find(s => s.id === '6').inVolgorde), 50)
    await page.evaluate(() => window.hockey.pauzeTimer())
    await page.waitForFunction(() => window.hockey.timer.gestartOp === null)
    await page.evaluate(() => window.hockey.wissel('4', '6', 'LW'))
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('hockey_test_spelers')).find(s => s.id === '6').inVolgorde === 51)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.hockey?.spelers.find(s => s.id === '6').inVeld)
    assert.equal(await page.evaluate(() => window.hockey.spelers.find(s => s.id === '6').inVolgorde), 51)
    // Iedere echte wissel telt, ook bij stilstand, pauze, rust en na de eindtijd.
    const momenten = await page.evaluate(() => [20000, window.schema[0].lengte, window.schema.slice(0, 3).reduce((n,d)=>n+d.lengte,0), window.eindtijd])
    for (const ms of momenten) {
      await page.evaluate(ms => window.hockey.zetKlok(ms), ms)
      const voor = await page.evaluate(() => {
        const uit=window.hockey.spelers.find(s=>s.id==='4').inVeld?'4':'6'
        return {uit, in:uit==='4'?'6':'4', aantal:window.hockey.wisselingen.length, teller:window.hockey.spelers.find(s=>s.id===uit).wisselCount}
      })
      await page.evaluate(v => window.hockey.wissel(v.uit,v.in,'LW'), voor)
      await page.waitForFunction(v => window.hockey.wisselingen.length === v.aantal+1, {}, voor)
      assert.equal(await page.evaluate(v=>window.hockey.spelers.find(s=>s.id===v.uit).wisselCount,voor),voor.teller+1)
      assert.equal(await page.evaluate(v=>window.kleuren()[v.in],voor),'rood')
    }
    assert.deepEqual(fouten, [])
    console.log('WISSEL_PROVIDER_OK: teller, kleur en geschiedenis werken zonder klok, bij pauze/rust/einde; oude voorkeur genegeerd; Undo en verversen behouden de stand.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
