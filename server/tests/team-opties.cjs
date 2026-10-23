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
        const {balans,topscorers,vandaag}=await import('/src/historie.ts');window.balans=balans;window.topscorers=topscorers;window.vandaag=vandaag;
        function Probe(){window.hockey=useHockey();return React.createElement('span',null,'klaar')}
        function Test(){const [opties,zet]=React.useState({});window.zetOpties=zet;return React.createElement(HockeyProvider,opties,React.createElement(Probe))}
        ReactDOM.createRoot(document.querySelector('#test')).render(React.createElement(Test));
      </script>` })
      return req.continue()
    })
    await page.goto('http://127.0.0.1:5187/__teamopties', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.hockey?.spelers.length === 1)
    assert.deepEqual(await page.evaluate(() => [hockey.doelpuntenBijhouden, hockey.speeltijdBijhouden]), [false, true])
    await page.evaluate(() => hockey.scoor('wij', 1, 'voorbeeld'))
    await page.waitForFunction(() => hockey.score.wij === 1)
    assert.deepEqual(await page.evaluate(() => hockey.doelpunten), [null], 'Wel stand, geen spelersnaam bij uitgeschakelde registratie')
    await page.evaluate(() => hockey.zetKlok(60000))
    await page.waitForFunction(() => hockey.timer.opgebouwd === 60000)
    await page.evaluate(() => zetOpties({ doelpuntenBijhouden: true, speeltijdBijhouden: false }))
    await page.waitForFunction(() => !hockey.speeltijdBijhouden && Object.keys(hockey.speeltijdLog.at(-1).g).length === 0)
    await page.evaluate(() => hockey.scoor('wij', 1, 'voorbeeld'))
    await page.waitForFunction(() => hockey.score.wij === 2)
    await page.evaluate(() => hockey.zetKlok(180000))
    await page.waitForFunction(() => hockey.timer.opgebouwd === 180000)
    assert.equal(await page.evaluate(() => speeltijden(hockey.speeltijdLog, 180000).voorbeeld.a), 60)
    await page.evaluate(() => zetOpties({ doelpuntenBijhouden: false, speeltijdBijhouden: true }))
    await page.waitForFunction(() => hockey.speeltijdLog.at(-1).g.voorbeeld === 'a')
    await page.evaluate(() => hockey.scoor('zij', 1))
    await page.waitForFunction(() => hockey.score.zij === 1)
    assert.equal(await page.evaluate(() => hockey.score.wij), 2, 'Uitzetten wist eerder ingevoerde score niet')
    await page.evaluate(() => hockey.zetKlok(240000))
    await page.waitForFunction(() => hockey.timer.opgebouwd === 240000)
    await page.evaluate(() => {
      const id = hockey.clubToevoegen('Voorbeeldclub')
      window.clubId = id
    })
    await page.waitForFunction(() => hockey.clubs.some(c => c.id === window.clubId))
    await page.evaluate(() => hockey.wedstrijdAfsluiten({ clubId: window.clubId, datum: window.vandaag(), thuis: true }, 'Voorbeeldclub'))
    await page.waitForFunction(() => hockey.wedstrijden.length === 1)
    const opgeslagen = await page.evaluate(() => ({ w: hockey.wedstrijden[0], balans: balans(hockey.wedstrijden), scorers: topscorers(hockey.wedstrijden, hockey.spelers) }))
    assert.equal(opgeslagen.w.spelers[0].tijd.a, 120, 'Uitgeschakelde twee minuten tellen niet mee')
    assert.equal(opgeslagen.w.scoreNietBijgehouden, false)
    assert.equal(opgeslagen.balans.gespeeld, 1)
    assert.equal(opgeslagen.balans.G, 0)
    assert.equal(opgeslagen.balans.W, 1)
    assert.equal(opgeslagen.balans.voor, 2)
    assert.equal(opgeslagen.scorers.find(s => s.id === 'voorbeeld').aantal, 1)
    assert.equal(opgeslagen.scorers.find(s => s.id === null).aantal, 1)
    const voorReset = await page.evaluate(() => ({ spelers: hockey.spelers, timer: hockey.timer, clubs: hockey.clubs, programma: hockey.programma, wisselingen: hockey.wisselingen }))
    await page.evaluate(() => hockey.resetTeamRegistratie('speeltijd'))
    await page.waitForFunction(() => !('tijd' in hockey.wedstrijden[0].spelers[0]))
    assert.equal(await page.evaluate(() => hockey.wedstrijden[0].wij), 2, 'Speeltijdreset laat scores ongemoeid')
    assert.deepEqual(await page.evaluate(() => ({ spelers: hockey.spelers, timer: hockey.timer, clubs: hockey.clubs, programma: hockey.programma, wisselingen: hockey.wisselingen })), voorReset)
    await page.evaluate(() => hockey.weerOpenen())
    await page.waitForFunction(() => !hockey.wedstrijd.afgesloten)
    await page.evaluate(() => hockey.zetKlok(300000))
    await page.waitForFunction(() => hockey.timer.opgebouwd === 300000)
    await page.evaluate(() => hockey.resetTeamRegistratie('speeltijd'))
    await page.waitForFunction(() => hockey.speeltijdLog[0].t === 300000)
    await page.evaluate(() => hockey.zetKlok(360000))
    await page.waitForFunction(() => hockey.timer.opgebouwd === 360000)
    assert.equal(await page.evaluate(() => speeltijden(hockey.speeltijdLog, 360000).voorbeeld.a), 60, 'Na reset geen oude minuten terugtellen')
    const tijdVoorGoals = await page.evaluate(() => hockey.speeltijdLog)
    await page.evaluate(() => hockey.resetTeamRegistratie('goals'))
    await page.waitForFunction(() => hockey.score.wij === 0 && hockey.wedstrijden[0].wij === 0)
    assert.deepEqual(await page.evaluate(() => hockey.speeltijdLog), tijdVoorGoals, 'Goalsreset laat speeltijd staan')
    assert.deepEqual(await page.evaluate(() => hockey.wedstrijden[0].doelpunten), [])
    assert.equal(await page.evaluate(() => hockey.wedstrijden[0].scoreNietBijgehouden), true)
    assert.equal(await page.evaluate(() => hockey.canUndo), false)
    await page.evaluate(() => {
      const w = hockey.wedstrijden[0]
      hockey.wijzigWedstrijd(w.id, { datum: w.datum, clubId: w.clubId, thuis: false }, w.tegenstander, { zij: w.zij, doelpunten: w.doelpunten })
    })
    await page.waitForFunction(() => !hockey.wedstrijden[0].thuis)
    assert.equal(await page.evaluate(() => hockey.wedstrijden[0].scoreNietBijgehouden), true, 'Alleen gegevens wijzigen herstelt geen gewiste uitslag')
    await page.evaluate(() => zetOpties({ magBewerken: false }))
    await page.waitForFunction(() => !hockey.magBeheren)
    assert.equal(await page.evaluate(() => { try { hockey.resetTeamRegistratie('goals'); return false } catch { return true } }), true)
    assert.deepEqual(fouten, [])
    console.log('TEAM_OPTIES_OK: defaults, registratie pauzeren/hervatten, afzonderlijke teamresets voor live/historie, geen oude minuten of fictieve uitslag, gegevensbehoud en beheerdersrechten.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
