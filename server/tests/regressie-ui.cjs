// Echte gebouwde testapp tegen de echte testserver, met uitsluitend het fictieve regressieaccount.
// Gestart door tests/regressie.py in zenika/alpine-chrome:with-puppeteer (--network host).
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const appUrl = process.env.APP_URL
const sessie = JSON.parse(process.env.REGRESSIE_SESSIE)
const verwacht = JSON.parse(process.env.REGRESSIE_TEKSTEN)

;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  const fouten = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 360, height: 640 })
    page.on('pageerror', e => fouten.push(e.message))
    const klik = tekst => page.evaluate(tekst => {
      const knop = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === tekst)
      if (!knop) throw new Error('Knop niet gevonden: ' + tekst)
      knop.click()
    }, tekst)
    const filter = async (label, waarde) => {
      const el = await page.evaluateHandle(label => [...document.querySelectorAll('.teamselectie-filters label')].find(l => l.firstChild.textContent.trim() === label)?.querySelector('select'), label)
      assert.ok(el.asElement(), `Filter ${label} zichtbaar`)
      await el.asElement().select(waarde)
    }

    // 1. Niet ingelogd: club zoeken en zaalteam vinden met de gecombineerde filters.
    await page.goto(appUrl, { waitUntil: 'load' })
    await page.waitForSelector('button[aria-label="Instellingen"]')
    await page.click('button[aria-label="Instellingen"]')
    await klik('Aansluiten bij een team')
    await page.waitForSelector('input[type="search"]')
    await page.type('input[type="search"]', 'sc')
    await page.waitForFunction(() => [...document.querySelectorAll('.teamselectie-resultaat strong')].some(o => o.textContent === 'SCHC'), { timeout: 20000 })
    await page.evaluate(() => [...document.querySelectorAll('.teamselectie-resultaat')].find(b => b.querySelector('strong').textContent === 'SCHC').click())
    await page.waitForSelector('input[placeholder="Zoek een team"]')
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Gevonden teams"] button').length > 0, { timeout: 20000 })
    await page.click('.teamselectie-filters summary')
    await filter('Veld of zaal', 'Zaal')
    await filter('Teamtype', 'Meisjes / dames')
    await filter('Leeftijd', 'O11')
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Gevonden teams"] strong')].some(e => e.textContent === 'SCHC zMO11-1'), { timeout: 5000 })
    await page.type('input[placeholder="Zoek een team"]', 'zmo11')
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Gevonden teams"] strong')].some(e => e.textContent === 'SCHC zMO11-1'), { timeout: 5000 })

    // 2. Ingelogd als fictief regressieaccount: eigen afspraken staan in Programma.
    for (const team of verwacht) {
      const p = await browser.newPage()
      await p.setViewport({ width: 360, height: 640 })
      p.on('pageerror', e => fouten.push(e.message))
      await p.evaluateOnNewDocument((sessie, team) => {
        if (sessionStorage.getItem('regressie-klaar')) return
        sessionStorage.setItem('regressie-klaar', '1')
        localStorage.clear()
        localStorage.setItem('hockey_test_backend', 'apart-v1')
        localStorage.setItem('hockey_test_auth', JSON.stringify({ token: sessie.token, record: sessie.record }))
        localStorage.setItem('hockey_test_actief_team', JSON.stringify(team))
      }, sessie, team.team)
      await p.goto(appUrl, { waitUntil: 'load' })
      await p.waitForSelector('button[aria-label="Programma"]')
      await p.click('button[aria-label="Programma"]')
      for (const tekst of team.teksten) {
        await p.waitForFunction(t => document.body.textContent.includes(t), { timeout: 20000 }, tekst)
          .catch(() => { throw new Error(`${team.naam}: "${tekst}" niet zichtbaar in Programma`) })
      }
      // Laat de achtergrondsync even lopen: daarna controleert regressie.py dat niets is overschreven.
      await new Promise(r => setTimeout(r, 4000))
      assert.ok(!(await p.evaluate(() => document.body.textContent.includes('Geen verbinding met de server'))), `${team.naam}: syncprobleem`)
      await p.close()
    }
    assert.deepEqual(fouten, [], 'Geen JavaScript-fouten')
    console.log('REGRESSIE_UI_OK: club/zaalteam vindbaar met filters; eigen afspraken zichtbaar in Programma van ' + verwacht.map(t => t.naam).join(' en ') + '.')
  } finally {
    await browser.close()
  }
})().catch(e => { console.error(e.message); process.exit(1) })
