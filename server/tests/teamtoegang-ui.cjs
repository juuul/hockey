// Echte UI met uitsluitend de geïsoleerde fictieve QA-backend op 8099, ook bij een gepubliceerde TEST_URL.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const base = 'http://127.0.0.1:8099', app = process.env.TEST_URL || 'http://127.0.0.1:5187/'
;(async () => {
  const auth = await (await fetch(base + '/api/collections/users/auth-with-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity: 'beheer@example.invalid', password: 'Fictief-Toegang-Test-123!' }) })).json()
  assert.ok(auth.token)
  const headers = { 'content-type': 'application/json', authorization: auth.token }
  const teams = (await (await fetch(base + '/api/collections/teams/records?expand=beheerders,kijkers,officieelTeam', { headers })).json()).items
  const email = `ui-${Date.now()}@example.invalid`, naam = 'Demo UI Ouder'
  const aanmelden = await fetch(base + '/api/hockey/catalogus/omgeving/toegangteam0001/aanvraag', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, naam, terug: 'https://hockey.juliaan.eu/test/' }) })
  assert.equal(aanmelden.status, 200)
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage(), fouten = []
    page.on('pageerror', e => fouten.push(e.message))
    await page.setViewport({ width: 390, height: 844 })
    await page.evaluateOnNewDocument(({ auth, teams }) => {
      localStorage.clear()
      localStorage.setItem('hockey_test_backend', 'apart-v1')
      localStorage.setItem('hockey_test_auth', JSON.stringify(auth))
      localStorage.setItem('hockey_test_teams', JSON.stringify(teams))
      localStorage.setItem('hockey_test_actief_team', JSON.stringify('toegangteam0001'))
      localStorage.setItem('hockey_test_t_toegangteam0001_overnemen_gevraagd', 'true')
      sessionStorage.setItem('hockey_test_tabblad', 'instellingen')
      window.EventSource = class extends EventTarget {
        constructor() { super(); setTimeout(() => this.dispatchEvent(new MessageEvent('PB_CONNECT', { lastEventId: 'qa', data: '{}' })), 0) }
        close() {}
      }
    }, { auth, teams })
    await page.setRequestInterception(true)
    page.on('request', async req => {
      const u = new URL(req.url())
      if (u.pathname.includes('/api/')) {
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' } })
        // Alle app-API-calls blijven bij de QA-fixture; nooit naar de echte test- of productiedatabase.
        try {
          let body = ['GET','HEAD'].includes(req.method()) ? undefined : req.postData()
          // De lokale Vite-poort is geen mail-terugadres; gebruik de echte testapp in QA-mails.
          if (body && new URL(app).hostname === '127.0.0.1') { const data = JSON.parse(body); if (data.terug) data.terug = 'https://hockey.juliaan.eu/test/'; body = JSON.stringify(data) }
          const res = await fetch(base + u.pathname.slice(u.pathname.indexOf('/api/')) + u.search, { method: req.method(), headers: { 'content-type': 'application/json', authorization: auth.token }, body })
          return req.respond({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: await res.text() })
        } catch (_) { return req.abort() }
      }
      return u.hostname === new URL(app).hostname ? req.continue() : req.abort()
    })
    await page.goto(app)
    const klik = async tekst => {
      try { await page.waitForFunction(t => [...document.querySelectorAll('button')].some(b => b.textContent.replace(/›/g, '').trim() === t || b.textContent.replace(/›/g, '').trim().startsWith(t + ' (')), {}, tekst) }
      catch (e) { console.error('Scherm:', await page.$eval('body', e => e.textContent.slice(0,1600))); throw e }
      await page.evaluate(t => [...document.querySelectorAll('button')].find(b => b.textContent.replace(/›/g, '').trim() === t || b.textContent.replace(/›/g, '').trim().startsWith(t + ' (')).click(), tekst)
    }
    await klik('Aanvragen')
    await page.waitForFunction(email => document.body.textContent.includes(email), {}, email)
    assert.equal(await page.$$eval('.account-aanvraag', (els, email) => els.find(e => e.textContent.includes(email)).textContent.includes('Bekeken'), email), true)
    await page.evaluate(email => [...document.querySelectorAll('.account-aanvraag')].find(e => e.textContent.includes(email)).querySelector('.btn-gevaar').click(), email)
    await page.waitForFunction(email => !document.body.textContent.includes(email), {}, email)
    await klik('‹ Terug')
    await klik('Leden')
    await page.waitForFunction(email => document.body.textContent.includes(email) && document.body.textContent.includes('Geblokkeerd'), {}, email)
    await page.evaluate(email => [...document.querySelectorAll('.account-aanvraag')].find(e => e.textContent.includes(email)).querySelector('button').click(), email)
    await page.waitForFunction(email => ![...document.querySelectorAll('.account-aanvraag')].some(e => e.textContent.includes(email) && e.textContent.includes('Deblokkeren')), {}, email)
    const blocks = await (await fetch(base + '/api/collections/teamblokkades/records', { headers })).json()
    assert.equal(blocks.items.some(b => b.email === email), false)
    assert.deepEqual(fouten, [])
    console.log('TEAMTOEGANG_UI_OK: melding zichtbaar, blokkeren, lijst Geblokkeerd, deblokkeren op mobiel scherm')
  } finally { await browser.close() }
})().catch(e => { console.error(e.message, e.stack); process.exit(1) })
