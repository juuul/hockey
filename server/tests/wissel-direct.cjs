// Echte app met uitsluitend lokale voorbeeldgegevens; alle API-verzoeken geblokkeerd.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const url = process.env.TEST_URL || 'http://127.0.0.1:5187/'
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage(), fouten = []
    page.on('pageerror', e => fouten.push(e.message))
    await page.setViewport({ width: 360, height: 640 })
    await page.setRequestInterception(true)
    page.on('request', r => {
      const u = new URL(r.url())
      return u.hostname !== new URL(url).hostname || u.pathname.includes('/api/') ? r.abort() : r.continue()
    })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.player-slot:not(.keeper):not(.leeg)')
    const snapshot = () => page.evaluate(() => ({
      spelers: JSON.parse(localStorage.getItem('hockey_test_spelers')),
      wisselingen: JSON.parse(localStorage.getItem('hockey_test_wisselingen')) || [],
    }))
    const voor = await snapshot()
    const uitNaam = await page.$eval('.player-slot:not(.keeper):not(.leeg) .name', n => n.textContent)
    await page.click('.player-slot:not(.keeper):not(.leeg)')
    await page.waitForSelector('.modal-option')
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.modal button')].some(b => b.textContent.trim() === 'Bevestig')), false)
    const inNaam = await page.$eval('.modal-option-name', n => n.textContent)
    await page.$eval('.modal-option', b => { b.click(); b.click() })
    await page.waitForFunction(() => !document.querySelector('.modal.show'))
    const na = await snapshot()
    assert.equal(na.wisselingen.length, voor.wisselingen.length + 1)
    assert.equal(na.spelers.find(s => s.naam === uitNaam).wisselCount, voor.spelers.find(s => s.naam === uitNaam).wisselCount + 1)
    assert.ok(na.spelers.find(s => s.naam === inNaam).inVeld)
    assert.equal(await page.evaluate(n => [...document.querySelectorAll('.player-slot.rood .name')].some(el => el.textContent === n), inNaam), true)
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Undo').click())
    await page.waitForFunction(v => JSON.stringify(JSON.parse(localStorage.getItem('hockey_test_spelers'))) === JSON.stringify(v), {}, voor.spelers)
    // Annuleren en telefoonterug voeren geen wissel uit.
    await page.click('.player-slot:not(.keeper):not(.leeg)')
    await page.waitForSelector('.modal-option')
    await page.click('.modal-actions .btn-secondary')
    assert.deepEqual(await snapshot(), voor)
    await page.click('.player-slot:not(.keeper):not(.leeg)')
    await page.waitForSelector('.modal-option')
    await page.goBack()
    await page.waitForFunction(() => !document.querySelector('.modal.show'))
    assert.deepEqual(await snapshot(), voor)
    // Verplaatsen behoudt de bestaande selectie + bevestiging.
    await page.click('.player-slot:not(.keeper):not(.leeg)')
    await page.waitForSelector('.modal-mode-btn')
    await page.click('.modal-mode-btn')
    await page.waitForSelector('.modal-actions .btn-primary')
    await page.click('.modal-option')
    assert.ok(await page.$('.modal.show'))
    assert.deepEqual(await snapshot(), voor)
    await page.click('.modal-actions .btn-secondary')
    // Eén kandidaat is nooit automatisch een wissel: tik blijft nodig.
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('hockey_test_spelers'))
      p.filter(s => !s.inVeld && s.meedoen).slice(1).forEach(s => { s.meedoen = false })
      localStorage.setItem('hockey_test_spelers', JSON.stringify(p))
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.player-slot:not(.keeper):not(.leeg)')
    const een = await snapshot()
    await page.click('.player-slot:not(.keeper):not(.leeg)')
    await page.waitForSelector('.modal-option')
    assert.equal(await page.$$eval('.modal-option', ns => ns.length), 1)
    assert.deepEqual(await snapshot(), een)
    await page.click('.modal-option')
    await page.waitForFunction(() => !document.querySelector('.modal.show'))
    assert.equal((await snapshot()).wisselingen.length, een.wisselingen.length + 1)
    // Een lege veldplek houdt haar expliciete bevestiging.
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('hockey_test_spelers'))
      p.find(s => s.inVeld && !s.isKeeper).inVeld = false
      localStorage.setItem('hockey_test_spelers', JSON.stringify(p))
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.player-slot.leeg')
    await page.click('.player-slot.leeg')
    await page.waitForSelector('.modal-actions .btn-primary')
    await page.click('.modal-option')
    assert.ok(await page.$('.modal.show'))
    assert.deepEqual(fouten, [])
    console.log('WISSEL_DIRECT_OK: tik wisselt direct, geen dubbele telling, Undo, annuleren/terug, één kandidaat; verplaatsen en lege plek behouden bevestiging.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
