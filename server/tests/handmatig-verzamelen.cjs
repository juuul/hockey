// Echte app met nagebootste accounts/API. Geen echte serverwrites of routes.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const appUrl = process.env.TEST_URL || 'http://127.0.0.1:5187/'
const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: 4000000000 })).toString('base64url')}.test`
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage(), fouten = []
    page.on('pageerror', e => fouten.push(e.message))
    await page.setViewport({ width: 360, height: 640 })
    const user = { id: 'handmatigouder1', email: 'ouder@example.invalid', name: 'Voorbeeldouder', superadmin: false }
    const team = { id: 'handmatigteam01', naam: 'Voorbeeld', beheerders: [user.id], kijkers: [] }
    const datum = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    let wedstrijd = { id: 'handmatigpot001', team: team.id, datum, soort: 'wedstrijd', thuis: true, tegenstander: 'Voorbeeldclub', clubId: '', spelen: '10:30', verzamelen: '09:55', verzamelDatum: datum, verzamelModus: 'automatisch', fruit: '', begeleider1: '', begeleider2: '', notitie: '', locatieAdres: 'Voorbeeldstraat 1, Utrecht' }
    await page.evaluateOnNewDocument(({ token, user, team }) => {
      localStorage.setItem('hockey_test_backend', 'apart-v1')
      localStorage.setItem('hockey_test_auth', JSON.stringify({ token, record: user }))
      localStorage.setItem('hockey_test_teams', JSON.stringify([team]))
      localStorage.setItem('hockey_test_actief_team', JSON.stringify(team.id))
      localStorage.setItem(`hockey_test_t_${team.id}_overnemen_gevraagd`, 'true')
      sessionStorage.setItem('hockey_test_tabblad', 'programma')
      window.EventSource = class extends EventTarget { readyState = 1; constructor() { super(); setTimeout(() => this.dispatchEvent(new MessageEvent('PB_CONNECT', { lastEventId: 'testclient', data: '{}' })), 0) } close() { this.readyState = 2 } }
    }, { token, user, team })
    await page.setRequestInterception(true)
    page.on('request', req => {
      const u = new URL(req.url())
      if (!u.pathname.includes('/api/')) return u.hostname === new URL(appUrl).hostname ? req.continue() : req.abort()
      const lijst = items => ({ page: 1, perPage: 1000, totalPages: 1, totalItems: items.length, items })
      let body = lijst([])
      if (u.pathname.endsWith('/auth-refresh')) body = { token, record: user }
      else if (u.pathname.includes('/teams/records')) body = lijst([team])
      else if (u.pathname.includes('/programma/records')) {
        if (req.method() === 'PATCH' || req.method() === 'POST') { wedstrijd = { ...wedstrijd, ...JSON.parse(req.postData()) }; body = wedstrijd }
        else body = lijst([wedstrijd])
      } else if (u.pathname.includes('/standen/records/')) body = { id: team.id, versie: 0 }
      else if (u.pathname.includes('/verzamelinstellingen/team/')) body = { globaal: { voorbereidingMinuten: 30, bufferMinuten: 5 }, eigen: {}, effectief: { voorbereidingMinuten: 30, bufferMinuten: 5, vertrekAdres: 'Voorbeeldstraat 1, Utrecht' }, clubAdres: 'Voorbeeldstraat 1, Utrecht' }
      else if (u.pathname.includes('/reiscache/team/')) body = { minuten: 0 }
      req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' }, body: JSON.stringify(body) })
    })
    const popup = '.modal-content[aria-label="Wedstrijdtijden"]'
    const open = async () => { await page.click('.prog-tijd-knop'); await page.waitForSelector(popup) }
    const tijd = async (selector, waarde) => {
      await page.click(selector)
      await page.waitForSelector('dialog[open]')
      await page.$$eval('dialog input', (ns, waarde) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        ns.forEach((n, i) => { set.call(n, waarde.split(':')[i]); n.dispatchEvent(new Event('input', { bubbles: true })) })
      }, waarde)
      await page.click('dialog .btn-primary')
      await page.waitForFunction(() => !document.querySelector('dialog'))
    }
    const opslaan = async () => { await page.click(`${popup} > .modal-actions .btn-primary`); await page.waitForFunction(() => !document.querySelector('.modal-content[aria-label="Wedstrijdtijden"]')) }
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.prog-tijd-knop')
    await open()
    await page.waitForFunction(() => document.querySelector('.verzameltijd-kiezen .datumtijd-veld').textContent === '09:55')
    await tijd('.verzameltijd-kiezen .datumtijd-veld', '09:10')
    assert.equal(wedstrijd.verzamelen, '09:55', 'Pas bewaren na Opslaan')
    await page.click(`${popup} > .modal-actions .btn-secondary`)
    assert.equal(wedstrijd.verzamelen, '09:55', 'Annuleren verandert niets')
    await open(); await tijd('.verzameltijd-kiezen .datumtijd-veld', '09:10'); await opslaan()
    await page.waitForFunction(() => document.querySelector('.prog-tijd-knop').textContent.includes('verzamelen 09:10'))
    await page.waitForResponse(r => r.url().includes('/programma/records/') && r.request().method() === 'PATCH')
    assert.equal(wedstrijd.verzamelModus, 'handmatig')
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.prog-tijd-knop')
    assert.ok(await page.$eval('.prog-tijd-knop', n => n.textContent.includes('verzamelen 09:10')))
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Wijzigen')).click())
    await page.waitForFunction(() => document.body.textContent.includes('Reistijd: 0 minuten'))
    assert.ok(await page.$eval('.modal .prog-tijd-knop', n => n.textContent.includes('verzamelen 09:10')), 'Editor mag handmatig niet door automatisch vervangen')
    await page.evaluate(() => {
      const n = [...document.querySelectorAll('label')].find(l => l.textContent.includes('Opmerking')).querySelector('input')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(n, 'Fictieve notitie')
      n.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.evaluate(() => [...document.querySelectorAll('.modal-actions button')].find(b => b.textContent === 'Opslaan').click())
    await page.waitForResponse(r => r.url().includes('/programma/records/') && r.request().method() === 'PATCH')
    assert.equal(wedstrijd.verzamelen, '09:10')
    assert.equal(wedstrijd.verzamelModus, 'handmatig')
    await open()
    await tijd(`${popup} > .prog-velden > .prog-veld .datumtijd-veld`, '11:30')
    assert.equal(await page.$eval('.verzameltijd-kiezen .datumtijd-veld', n => n.textContent), '09:10')
    await opslaan()
    await page.waitForResponse(r => r.url().includes('/programma/records/') && r.request().method() === 'PATCH')
    assert.equal(wedstrijd.verzamelen, '09:10', 'Aanvangwijziging bewaart eigen tijd')
    await open()
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Automatisch berekenen').click())
    await page.waitForFunction(() => document.querySelector('.verzameltijd-kiezen .datumtijd-veld').textContent === '10:55')
    await opslaan()
    await page.waitForResponse(r => r.url().includes('/programma/records/') && r.request().method() === 'PATCH')
    assert.equal(wedstrijd.verzamelModus, 'automatisch')
    assert.equal(wedstrijd.verzamelen, '10:55')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.deepEqual(fouten, [])
    console.log('HANDMATIG_UI_OK: kiezen, annuleren, bewaren/herladen, aanvang aanpassen zonder overschrijven en terug naar automatisch; mobiel, geen serverwrites.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
