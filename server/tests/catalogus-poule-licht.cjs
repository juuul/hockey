// Echte Chrome + ongewijzigde officiële JS-modules, met volledig fictieve bronantwoorden.
// /officieel bevat vooraf bewaarde statische CDN-modules; netwerk staat geheel uit.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const { lees } = require('/scripts/catalogus-lees.cjs')
const echt = puppeteer.launch.bind(puppeteer)
let scenario = 'goed', calls
const team = { id: 46179, name: 'Voorbeeld MO11-1', federation_reference_id: 'ABC1234', hockey_type: 'VE' }
const detail = { data: { season_name: '2026-2027', poules: [{ matches: [
  { id: 123, date: '2026-11-07T10:30:00', home: team, away: { ...team, id: 46180, name: 'Ander MO11-1' }, geheim: 'NIET-EXPORTEREN' }
] }] } }
puppeteer.launch = async opts => {
  const browser = await echt(opts)
  const nieuw = browser.newPage.bind(browser)
  browser.newPage = async () => {
    const page = await nieuw()
    calls = { registratie: 0, programma: 0, overig: 0, website: 0 }
    // De productiefilter beslist wat mag worden verstuurd. Alleen toegelaten
    // continue() krijgt hier een fixture-antwoord, zodat ook de allowlist echt getest wordt.
    page.on('request', req => {
      req.continue = async () => {
        const u = new URL(req.url())
        if (u.origin === 'https://mc.static-hw.nl') {
          if (['module-429','module-403'].includes(scenario)) return req.respond({ status: scenario === 'module-429' ? 429 : 403,
            headers: { 'Access-Control-Allow-Origin': '*', 'Retry-After': '60' }, body: '' })
          let tekst = fs.readFileSync('/officieel/' + u.pathname.split('/').pop(), 'utf8')
          if (scenario === 'andere-client' && tekst.includes('X-HAPI-Authorization')) tekst = 'export const r=1,t=2;'
          if (scenario === 'nevenverzoek' && tekst.includes('X-HAPI-Authorization')) tekst += '\nfetch("https://app.hockeyweerelt.nl/favorites/defaults").catch(()=>{});'
          return req.respond({ contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: tekst })
        }
        if (u.origin !== 'https://app.hockeyweerelt.nl') {
          calls.website++; return req.abort()
        }
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers })
        const json = (status, data) => req.respond({ status, headers: { ...headers, ...(status === 429 ? { 'Retry-After': '60' } : {}) }, contentType: 'application/json', body: JSON.stringify(data) })
        if (u.pathname === '/device/register') {
          calls.registratie++
          return json(scenario === 'registratie-429' ? 429 : scenario === 'registratie-403' ? 403 : 201,
            { token: 'fixture-anonieme-bezoeker' })
        }
        if (u.pathname === '/poules/200/teams/46179') {
          calls.programma++
          if (!req.headers()['x-hapi-authorization']) return json(401, {})
          if (['verlopen', 'registratie-429', 'registratie-403'].includes(scenario) && calls.programma === 1) return json(401, {})
          if (scenario === 'tweemaal-401') return json(401, {})
          if (scenario === '429') return json(429, {})
          if (scenario === '403') return json(403, {})
          if (scenario === 'onvolledig') return json(200, { data: {} })
          if (scenario === 'ander-seizoen') return json(200, { data: { ...detail.data, season_name: '2025-2026' } })
          return json(200, detail)
        }
        calls.overig++; return json(500, {})
      }
    })
    return page
  }
  return browser
}
async function run(naam, error) {
  scenario = naam
  if (error) {
    await assert.rejects(lees(['ABC1234', '46179', '200', '2026-2027']), error)
    assert.ok(!fs.existsSync('/resultaat/catalogus.json'))
  } else {
    await lees(['ABC1234', '46179', '200', '2026-2027'])
    const d = JSON.parse(fs.readFileSync('/resultaat/catalogus.json'))
    assert.equal(d.wedstrijden[0].spelen, '10:30')
    assert.ok(!JSON.stringify(d).includes('NIET-EXPORTEREN'))
    assert.ok(!JSON.stringify(d).includes('fixture-anonieme-bezoeker'))
  }
  assert.equal(calls.overig, 0, 'Alleen poule en noodzakelijke bezoekersregistratie')
  assert.equal(calls.website, 0, 'Geen volledige website geladen')
  const meting = JSON.parse(fs.readFileSync('/resultaat/bronmeting.json'))
  assert.equal(meting.werkwijze, 'licht')
  assert.ok(!JSON.stringify(meting).includes('fixture-anonieme-bezoeker'))
  return meting
}
;(async () => {
  process.env.HOCKEY_BRON_SESSIE = '1'
  process.env.HOCKEY_BRON_BROWSER_HERSTEL = '1'
  process.env.HOCKEY_BRON_POULE_LICHT = '1'
  await run('goed')
  assert.deepEqual(calls, { registratie: 1, programma: 1, overig: 0, website: 0 })
  const warm = await run('goed')
  assert.deepEqual(calls, { registratie: 0, programma: 1, overig: 0, website: 0 })
  assert.ok(warm.bronverzoeken <= 2, 'Geldige sessie: alleen programma plus eventuele CORS-controle')
  await run('verlopen')
  assert.equal(calls.registratie, 1); assert.equal(calls.programma, 2)
  for (const [naam, fout] of [['429', /HTTP 429/], ['403', /HTTP 403/], ['registratie-429', /HTTP 429/], ['registratie-403', /HTTP 403/], ['tweemaal-401', /HTTP 401/], ['ander-seizoen', /ander seizoen/], ['onvolledig', /Onvolledig pouleantwoord/], ['andere-client', /client/], ['nevenverzoek', /afgebroken|Onverwacht/], ['module-429', /HTTP 429; bronRoute=clientmodule; bronWachtTot=/], ['module-403', /HTTP 403; bronRoute=clientmodule/]]) {
    await run(naam, fout)
    assert.ok(calls.programma <= 2)
    assert.ok(calls.registratie <= 1)
  }
  console.log('POULE_LICHT_OK: officiële client, koude/warme sessie, één herstel, 401/403/429, gewijzigde modules, nevenverzoeken, seizoen en veilige export; zonder externe bronverzoeken.')
})().catch(e => { console.error(e); process.exit(1) })
