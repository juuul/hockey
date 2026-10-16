// Browserregressie: fictief account/API, geen echte spelers, mails of writes.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: 4000000000 })).toString('base64url')}.test`
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    const user = { id: 'testouder000001', email: 'test@example.invalid', name: 'Voorbeeldouder' }
    const team = { id: 'testgroep000001', naam: 'Voorbeeldteam', beheerders: [user.id], kijkers: [] }
    const spelers = [{ id: 'testspeler00001', team: team.id, naam: 'Voorbeeld', voorkeur1: '', voorkeur2: '' }]
    let navigaties = 0, teamvragen = 0
    const fouten = []
    page.on('pageerror', e => fouten.push(e.message))
    await page.setViewport({ width: 360, height: 640 })
    await page.evaluateOnNewDocument(({ token, user, team }) => {
      localStorage.clear()
      localStorage.setItem('hockey_test_backend', 'apart-v1')
      localStorage.setItem('hockey_test_auth', JSON.stringify({ token, record: user }))
      localStorage.setItem('hockey_test_teams', JSON.stringify([team]))
      localStorage.setItem('hockey_test_actief_team', JSON.stringify(team.id))
      localStorage.setItem(`hockey_test_t_${team.id}_overnemen_gevraagd`, 'true')
      sessionStorage.setItem('hockey_test_tabblad', 'players')
      const interval = window.setInterval.bind(window)
      window.setInterval = (fn, ms, ...args) => {
        if (ms === 30000) window.teamControle = fn
        return interval(fn, ms, ...args)
      }
      window.EventSource = class extends EventTarget {
        constructor() { super(); setTimeout(() => this.dispatchEvent(new MessageEvent('PB_CONNECT', { lastEventId: 'fixture', data: '{}' })), 0) }
        close() {}
      }
    }, { token, user, team })
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (req.isNavigationRequest() && req.frame() === page.mainFrame() && req.resourceType() === 'document') navigaties++
      const u = new URL(req.url())
      if (!u.pathname.includes('/api/')) return u.hostname === '127.0.0.1' ? req.continue() : req.abort()
      const lijst = items => ({ page: 1, perPage: 1000, totalItems: items.length, totalPages: 1, items })
      let body = lijst([])
      if (u.pathname.endsWith('/auth-refresh')) body = { token, record: user }
      else if (u.pathname.includes('/teams/records')) { teamvragen++; body = lijst([team]) }
      else if (u.pathname.includes('/spelers/records')) body = lijst(spelers)
      else if (u.pathname.includes('/standen/records/')) body = { id: 'teststand000001', versie: 0 }
      req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' }, body: JSON.stringify(body) })
    })
    await page.goto('http://127.0.0.1:5187/')
    await page.waitForSelector('.players-screen')
    await page.waitForFunction(() => typeof window.teamControle === 'function')
    const gebaar = async (selector, eind = 'touchend', dx = 0, dy = 400) => page.evaluate(({ selector, eind, dx, dy }) => {
      const el = document.querySelector(selector)
      const event = (type, x, y) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchstart' || type === 'touchmove' ? [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })] : [] }))
      event('touchstart', 30, 30); event('touchmove', 30 + dx, 30 + dy); event(eind, 30 + dx, 30 + dy)
    }, { selector, eind, dx, dy })
    const geenNavigatie = async () => { await new Promise(r => setTimeout(r, 350)); assert.equal(navigaties, 1) }
    // Een afgebroken of horizontaal gebaar mag nooit herladen.
    await gebaar('.spelvorm-kop', 'touchcancel')
    await geenNavigatie()
    await gebaar('.spelvorm-kop', 'touchend', 500)
    await geenNavigatie()
    await gebaar('.btn-icon')
    await geenNavigatie()
    const scrollpositie = await page.$eval('.players-screen', el => { el.scrollTop = 220; return el.scrollTop })
    assert.ok(scrollpositie > 0)
    await gebaar('.spelvorm-kop', 'touchend', 0, 90)
    await geenNavigatie()
    await page.evaluate(() => window.teamControle())
    await geenNavigatie()
    assert.equal(await page.$eval('.players-screen', el => el.scrollTop), scrollpositie, 'Eigen scrollvak blijft op dezelfde plek tijdens achtergrondcontrole')
    await page.click('.btn-icon')
    await page.waitForSelector('input[placeholder="Voornaam"]')
    await page.type('input[placeholder="Voornaam"]', 'Nieuwe voorbeeldnaam')
    await page.evaluate(() => { window.naamveld = document.querySelector('input[placeholder="Voornaam"]') })
    const voor = teamvragen
    await page.evaluate(() => window.teamControle())
    await page.waitForFunction(() => document.querySelector('input[placeholder="Voornaam"]')?.value === 'Nieuwe voorbeeldnaam')
    assert.ok(teamvragen > voor)
    assert.equal(await page.evaluate(() => window.naamveld === document.activeElement && window.naamveld === document.querySelector('input[placeholder="Voornaam"]')), true)
    // Ook een gebaar op de achtergrond van een open popup mag niets herladen.
    await gebaar('.spelvorm-kop')
    await geenNavigatie()
    await gebaar('input[placeholder="Voornaam"]')
    await geenNavigatie()
    assert.equal(await page.$eval('input[placeholder="Voornaam"]', e => e.value), 'Nieuwe voorbeeldnaam')
    await page.evaluate(() => [...document.querySelectorAll('.modal-actions button')].find(b => b.textContent === 'Annuleren').click())
    await page.waitForFunction(() => !document.querySelector('.modal.show'))
    await page.evaluate(() => { document.activeElement?.blur(); document.querySelector('.content').scrollTop = 0; document.querySelector('.players-screen').scrollTop = 0; window.spelersNode = document.querySelector('.players-screen') })
    const controlesVoor = teamvragen
    await gebaar('.spelvorm-kop', 'touchend', 0, 90)
    await geenNavigatie()
    assert.ok(teamvragen > controlesVoor, 'Bewust trekken haalt gegevens op zonder paginareload')
    assert.equal(await page.evaluate(() => window.spelersNode === document.querySelector('.players-screen')), true)
    assert.deepEqual(fouten, [])
    console.log('SPELERS_STABIEL_OK: touchcancel/horizontaal/knoppen geen reload; popup, naam en focus behouden bij teamcontrole en gebaren.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
