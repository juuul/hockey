// Alleen lokale voorbeeldplanning; geen servergegevens of navigatieverzoeken.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const url = process.env.TEST_URL || 'http://127.0.0.1:5187/'
;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage(), fouten = []
    page.on('pageerror', e => fouten.push(e.message))
    await page.setViewport({ width: 360, height: 640 })
    await page.evaluateOnNewDocument(() => {
      localStorage.clear()
      localStorage.setItem('hockey_test_backend', 'apart-v1')
      const datum = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      const locaties = [
        { locatie: 'Sportpark Oostwaard · DentiQ (2)', locatieAdres: 'Oostwaard 32, 3602AA Maarssen' },
        { locatie: '', locatieAdres: 'Voorbeeldstraat 1, Utrecht' },
        { locatie: 'Sportpark zonder bekend adres', locatieAdres: '' },
        { locatie: '', locatieAdres: '' },
      ]
      localStorage.setItem('hockey_test_programma', JSON.stringify(locaties.map((p, i) => ({ id: `locatietest${i}`, datum, soort: 'wedstrijd', thuis: false, tegenstander: 'Voorbeeldclub', clubId: '', spelen: '10:00', verzamelen: '', fruit: '', begeleider1: '', begeleider2: '', notitie: '', ...p }))))
      sessionStorage.setItem('hockey_test_tabblad', 'programma')
    })
    await page.setRequestInterception(true)
    page.on('request', r => {
      const u = new URL(r.url())
      return u.hostname !== new URL(url).hostname || u.pathname.includes('/api/') ? r.abort() : r.continue()
    })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.prog-locatie')
    const lees = () => page.$$eval('.prog-locatie', ns => ns.map(n => ({ tag: n.tagName, tekst: n.textContent, href: n.getAttribute('href'), target: n.getAttribute('target'), rel: n.getAttribute('rel') })))
    const regels = await lees()
    assert.equal(regels.length, 4)
    assert.equal(regels[0].tag, 'A')
    assert.ok(regels[0].tekst.includes('📍Sportpark Oostwaard · DentiQ (2)'))
    const route = new URL(regels[0].href)
    assert.equal(route.origin, 'https://www.google.com')
    assert.equal(route.searchParams.get('destination'), 'Oostwaard 32, 3602AA Maarssen')
    assert.equal(regels[0].target, '_blank')
    assert.equal(regels[0].rel, 'noreferrer')
    assert.ok(regels[1].tekst.includes('Voorbeeldstraat 1, Utrecht'))
    assert.equal(regels[2].tag, 'DIV')
    assert.equal(regels[2].href, null)
    assert.ok(regels[3].tekst.includes('Locatie nog niet bekend'))
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button,a')].some(n => n.textContent.trim() === 'Navigeer naar wedstrijd')), false)
    for (const thema of ['licht', 'donker']) {
      await page.evaluate(t => { document.documentElement.dataset.thema = t }, thema)
      assert.ok(await page.$$eval('.prog-locatie', ns => ns.every(n => n.getBoundingClientRect().height >= 60 && parseFloat(getComputedStyle(n).fontSize) >= 22)))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    if (process.env.PREVIEW_PATH) await page.screenshot({ path: process.env.PREVIEW_PATH, fullPage: true })
    assert.deepEqual(fouten, [])
    console.log('LOCATIELINK_OK: speld en naam één juiste routelink; geen losse knop; adresfallback, ontbrekende gegevens, mobiel licht/donker; geen serverwrites.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
