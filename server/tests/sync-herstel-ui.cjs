const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
async function main() {
  if (process.argv[2] === '--build') {
    const map = process.argv[3]
    if (!map) throw Error('Geef een tijdelijke uitvoermap op')
    fs.mkdirSync(map, { recursive: true })
    await require('esbuild').build({ entryPoints: [path.join(__dirname, 'sync-herstel-fixture.tsx')], outfile: path.join(map, 'fixture.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.MODE': '"test"' }, plugins: [{ name: 'alleen-fictieve-server', setup(b) { b.onLoad({ filter: /\/src\/server\.ts$/ }, () => ({ contents: 'export const pb = new Proxy({}, { get: (_, key) => window.fakepb[key] })', loader: 'js' })) } }] })
    return
  }
  const puppeteer = require('/usr/src/app/node_modules/puppeteer')
  const code = fs.readFileSync(process.env.FIXTURE || '/qa/fixture.js', 'utf8')
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  const page = await browser.newPage(), errors = []
  try {
    await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'onLine', { get: () => true }))
    page.on('pageerror', e => errors.push(e.message))
    await page.setRequestInterception(true)
    page.on('request', r => {
      if (r.url() === 'http://qa.test/') r.respond({ status: 200, contentType: 'text/html', body: '<div id="app"></div><script type="module" src="/fixture.js"></script>' })
      else if (r.url() === 'http://qa.test/fixture.js') r.respond({ status: 200, contentType: 'text/javascript', body: code })
      else r.abort()
    })
    await page.goto('http://qa.test/')
    await page.waitForFunction(() => window.qaStatus?.fout)
    await page.type('#invoer', 'Nog bezig met invoeren')
    await page.evaluate(() => { window.invoerNode = document.querySelector('#invoer'); document.querySelector('#scroll').scrollTop = 220; window.acties.score(); window.acties.notitie() })
    await new Promise(r => setTimeout(r, 1200))
    let t = await page.evaluate(() => window.tellingen)
    assert.equal(t.lezen, 1); assert.equal(t.abonnement, 1); assert.equal(t.schrijven, 0); assert.equal(t.records, 1, 'Geen snelle foutlus')
    await page.evaluate(() => { window.net.lezen = true; window.net.abonnement = true })
    await page.waitForFunction(() => window.tellingen.schrijven === 1 && window.tellingen.abonnement === 2, { timeout: 7000 })
    assert.equal(await page.evaluate(() => window.stand.score.wij), 1, 'Oude serverstand overschrijft de nog niet verzonden score niet')
    assert.ok(await page.evaluate(() => window.qaStatus.fout), 'Een geslaagde GET verbergt een mislukte opslag niet')
    await new Promise(r => setTimeout(r, 1000))
    assert.equal(await page.evaluate(() => window.tellingen.schrijven), 1, 'Geen 50ms-lus bij fout opslaan')
    await page.evaluate(() => { window.net.schrijven = true; window.dispatchEvent(new Event('online')) })
    await page.waitForFunction(() => !window.qaStatus.fout && !window.qaStatus.live.wachtend && window.serverRegel.notitie === 'Eigen nieuwe notitie', { timeout: 6000 })
    assert.equal(await page.evaluate(() => window.serverStand.score.wij), 1)
    assert.equal(await page.evaluate(() => window.stand.timer.gestartOp === window.serverStand.timer.gestartOp), true)
    assert.equal(await page.$eval('#invoer', e => e.value), 'Nog bezig met invoeren')
    assert.equal(await page.$eval('#scroll', e => e.scrollTop), 220)
    assert.equal(await page.evaluate(() => window.invoerNode === document.querySelector('#invoer')), true)
    await page.evaluate(() => { window.net.lezen = false; window.net.schrijven = false; window.acties.score() })
    await page.waitForFunction(() => window.qaStatus.fout)
    await page.evaluate(() => window.qaStop())
    t = await page.evaluate(() => window.tellingen)
    await new Promise(r => setTimeout(r, 5500))
    assert.deepEqual(await page.evaluate(() => window.tellingen), t, 'Na verlaten/andere team geen achtergebleven hersteltimer')
    assert.deepEqual(errors, [])
    console.log('SYNC_HERSTEL_UI_OK: echte hooks herstellen automatisch, geen schrijflus, score/notitie bewaard, warning verdwijnt pas na herstel, invoer/scroll behouden en cleanup werkt.')
  } catch (err) { console.error(await page.evaluate(() => ({ tellingen: window.tellingen, status: window.qaStatus, online: navigator.onLine, zicht: document.visibilityState }))); throw err } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exit(1) })
