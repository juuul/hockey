// Echte context, alleen fictieve gegevens en onderschept netwerk.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage(), fouten = []
    page.on('pageerror', e => fouten.push(e.message))
    await page.evaluateOnNewDocument(() => {
      localStorage.clear()
      localStorage.setItem('hockey_test_backend', 'apart-v1')
      localStorage.setItem('hockey_test_spelers', JSON.stringify([{ id: 'voorbeeld', naam: 'Voorbeeld', positie: 'LW', inVeld: true, meedoen: true, isKeeper: false, wisselCount: 0 }]))
    })
    await page.setRequestInterception(true)
    page.on('request', req => {
      const u = new URL(req.url())
      if (u.hostname !== '127.0.0.1' || u.pathname.includes('/api/')) return req.abort()
      if (u.pathname === '/__teamopties') return req.respond({ contentType: 'text/html', body: `<div id="test"></div><script type="module">
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
        const {HockeyProvider,useHockey}=await import('/src/context/HockeyContext.tsx');
        const {speeltijden}=await import('/src/speeltijd.ts');window.speeltijden=speeltijden;
        const {balans,topscorers}=await import('/src/historie.ts');window.balans=balans;window.topscorers=topscorers;
        function Probe(){window.hockey=useHockey();return React.createElement('span',null,'klaar')}
        function Test(){const [opties,zet]=React.useState({});window.zetOpties=zet;return React.createElement(HockeyProvider,opties,React.createElement(Probe))}
        ReactDOM.createRoot(document.querySelector('#test')).render(React.createElement(Test));
      </script>` })
      return req.continue()
    })
    await page.goto('http://127.0.0.1:5187/__teamopties', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.hockey?.spelers.length === 1)
    assert.deepEqual(await page.evaluate(() => [hockey.scoreBijhouden, hockey.speeltijdBijhouden]), [false, true])
    await page.evaluate(() => hockey.scoor('wij', 1, 'voorbeeld'))
    assert.equal(await page.evaluate(() => hockey.score.wij), 0)
    await page.evaluate(() => hockey.zetKlok(60000))
    await page.waitForFunction(() => hockey.timer.opgebouwd === 60000)
    await page.evaluate(() => zetOpties({ scoreBijhouden: true, speeltijdBijhouden: false }))
    await page.waitForFunction(() => !hockey.speeltijdBijhouden && Object.keys(hockey.speeltijdLog.at(-1).g).length === 0)
    await page.evaluate(() => hockey.scoor('wij', 1, 'voorbeeld'))
    await page.waitForFunction(() => hockey.score.wij === 1)
    await page.evaluate(() => hockey.zetKlok(180000))
    await page.waitForFunction(() => hockey.timer.opgebouwd === 180000)
    assert.equal(await page.evaluate(() => speeltijden(hockey.speeltijdLog, 180000).voorbeeld.a), 60)
    await page.evaluate(() => zetOpties({ scoreBijhouden: false, speeltijdBijhouden: true }))
    await page.waitForFunction(() => hockey.speeltijdLog.at(-1).g.voorbeeld === 'a')
    await page.evaluate(() => hockey.scoor('zij', 1))
    assert.equal(await page.evaluate(() => hockey.score.zij), 0)
    assert.equal(await page.evaluate(() => hockey.score.wij), 1, 'Uitzetten wist eerder ingevoerde score niet')
    await page.evaluate(() => hockey.zetKlok(240000))
    await page.waitForFunction(() => hockey.timer.opgebouwd === 240000)
    await page.evaluate(() => {
      const id = hockey.clubToevoegen('Voorbeeldclub')
      window.clubId = id
    })
    await page.waitForFunction(() => hockey.clubs.some(c => c.id === window.clubId))
    await page.evaluate(() => hockey.wedstrijdAfsluiten({ clubId: window.clubId, datum: '2026-10-20', thuis: true }, 'Voorbeeldclub'))
    await page.waitForFunction(() => hockey.wedstrijden.length === 1)
    const opgeslagen = await page.evaluate(() => ({ w: hockey.wedstrijden[0], balans: balans(hockey.wedstrijden), scorers: topscorers(hockey.wedstrijden, hockey.spelers) }))
    assert.equal(opgeslagen.w.spelers[0].tijd.a, 120, 'Uitgeschakelde twee minuten tellen niet mee')
    assert.equal(opgeslagen.w.scoreNietBijgehouden, true)
    assert.equal(opgeslagen.balans.gespeeld, 1)
    assert.equal(opgeslagen.balans.G, 0)
    assert.equal(opgeslagen.balans.voor, 0)
    assert.deepEqual(opgeslagen.scorers, [])
    assert.deepEqual(fouten, [])
    console.log('TEAM_OPTIES_OK: defaults, scoreblokkade, tijd pauzeren/hervatten zonder wissen, veilig afsluiten en geen fictieve uitslag.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
