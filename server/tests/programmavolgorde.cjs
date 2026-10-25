// Controleer de echte programma-editor met alleen lokale voorbeeldgegevens.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 360, height: 640 })
    await page.evaluateOnNewDocument(() => {
      localStorage.clear()
      localStorage.setItem('hockey_test_backend', 'apart-v1')
      sessionStorage.setItem('hockey_test_tabblad', 'programma')
    })
    await page.setRequestInterception(true)
    page.on('request', req => {
      const u = new URL(req.url())
      return u.hostname === '127.0.0.1' && !u.pathname.includes('/api/') ? req.continue() : req.abort()
    })
    await page.goto('http://127.0.0.1:5187/')
    await page.waitForSelector('.prog-knoppenrij button')
    await page.click('.prog-knoppenrij button')
    await page.waitForSelector('.modal.show .prog-velden')
    assert.equal(await page.$eval('.modal.show .prog-velden', el => {
      const datum = el.querySelector('label')
      return datum.textContent.trim().startsWith('Datum') && datum.nextElementSibling.matches('.tijden-velden')
    }), true)
    const klikSoort = async naam => {
      await page.evaluate(naam => [...document.querySelectorAll('[aria-label="Soort"] button')].find(b => b.textContent === naam).click(), naam)
    }
    await klikSoort('Geen wedstrijd')
    assert.equal(await page.$('.modal.show .tijden-velden'), null)
    await klikSoort('Wedstrijd')
    assert.equal(await page.$eval('.modal.show .prog-velden > label', el => el.nextElementSibling.matches('.tijden-velden')), true)
    assert.ok(await page.$('.modal [aria-label="Aanvang uur"]'))
    assert.ok(await page.$('.modal [aria-label="Verzamelen uur"]'))
    assert.equal(await page.$('.modal .prog-tijd-knop'), null)
    console.log('PROGRAMMAVOLGORDE_OK: tijdvelden direct onder datum, alleen bij wedstrijden, geen extra tijdvenster.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
