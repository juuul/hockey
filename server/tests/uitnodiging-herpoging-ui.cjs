// Haperende verbinding bij Account maken: fictieve API, geen echte accounts of mails.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const token = 'FictieveUitnodiging0123456789abcdefghij'
const email = 'ouder@example.invalid'

;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    // scenario: per POST-poging wat de 'server' doet
    const draai = async (scenario) => {
      const context = await (browser.createBrowserContext ? browser.createBrowserContext() : browser.createIncognitoBrowserContext())
      const page = await context.newPage()
      await page.setViewport({ width: 360, height: 640 })
      const log = { posts: 0, logins: 0 }
      await page.setRequestInterception(true)
      page.on('request', req => {
        const u = new URL(req.url())
        if (!u.pathname.includes('/api/')) return u.hostname === new URL(process.env.TEST_URL).hostname ? req.continue() : req.abort()
        const antwoord = (status, body) => req.respond({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' }, body: JSON.stringify(body) })
        if (req.method() === 'OPTIONS') return antwoord(204, {})
        if (u.pathname.endsWith(`/uitnodiging/${token}`) && req.method() === 'GET') return antwoord(200, { team: 'Voorbeeldteam', email, rol: 'kijker', naam: 'Fictieve ouder', bestaat: false })
        if (u.pathname.endsWith(`/uitnodiging/${token}`) && req.method() === 'POST') {
          const actie = scenario[log.posts++] || 'ok'
          if (actie === 'weg') return req.abort('connectionreset')
          if (actie === 'gebruikt') return antwoord(404, { status: 404, message: 'Uitnodiging niet gevonden of al gebruikt', data: {} })
          return antwoord(200, { email, bestaat: false })
        }
        if (u.pathname.endsWith('/auth-with-password')) {
          log.logins++
          return antwoord(200, { token: 'x.eyJleHAiOjk5OTk5OTk5OTl9.x', record: { id: 'ouder000000001', collectionName: 'users', email, name: 'Fictieve ouder', verified: true } })
        }
        if (u.pathname.includes('/records')) return antwoord(200, { items: [], page: 1, perPage: 100, totalPages: 1, totalItems: 0 })
        return antwoord(200, {})
      })
      await page.goto(process.env.TEST_URL + '#uitnodiging=' + token, { waitUntil: 'load' })
      await page.waitForSelector('input[autocomplete="new-password"]')
      await page.type('input[autocomplete="new-password"]', 'geheim1234')
      await page.click('button[type="submit"]')
      return { page, log }
    }

    // Eerste poging komt niet aan, tweede vindt de uitnodiging al gebruikt (eerste kwam tóch aan): gewoon inloggen.
    {
      const { page, log } = await draai(['weg', 'gebruikt'])
      await page.waitForFunction(() => document.body.textContent.includes('De verbinding hapert'), { timeout: 5000 })
      await page.waitForFunction(() => !document.querySelector('input[autocomplete="new-password"]'), { timeout: 15000 })
      assert.equal(log.posts, 2); assert.equal(log.logins, 1)
      assert.ok(!(await page.evaluate(() => document.body.textContent.includes('niet gevonden'))), 'Geen foutmelding over een gebruikte uitnodiging')
      await page.close()
    }
    // Drie keer geen verbinding: duidelijke melding, knop weer bruikbaar, niet eindeloos doorgaan.
    {
      const { page, log } = await draai(['weg', 'weg', 'weg'])
      await page.waitForFunction(() => document.body.textContent.includes('Geen verbinding met de server'), { timeout: 15000 })
      await page.waitForFunction(() => [...document.querySelectorAll('button[type="submit"]')].some(b => b.textContent === 'Account maken' && !b.disabled))
      assert.equal(log.posts, 3); assert.equal(log.logins, 0)
      await page.click('button[type="submit"]')
      await page.waitForFunction(() => !document.querySelector('input[autocomplete="new-password"]'), { timeout: 15000 })
      assert.equal(log.posts, 4, 'Handmatig opnieuw proberen lukt')
      await page.close()
    }
    // Normale situatie: één verzoek, meteen klaar.
    {
      const { page, log } = await draai([])
      await page.waitForFunction(() => !document.querySelector('input[autocomplete="new-password"]'), { timeout: 5000 })
      assert.deepEqual(log, { posts: 1, logins: 1 })
      await page.close()
    }
    console.log('UITNODIGING_HERPOGING_OK: haperende verbinding herhaalt zelf (max 3), al aangekomen poging telt als gelukt, daarna duidelijke melding en handmatig opnieuw; normaal één verzoek.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
