// Volledige lezer met echte Chrome, uitsluitend onderschepte fictieve netwerkdata.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const { lees } = require('/scripts/catalogus-lees.cjs')
const start = puppeteer.launch.bind(puppeteer)
let scenario = 'herstel', telling
const club = { data: { type: 'regular', federation_reference_id: 'HH11PD0', name: 'Voorbeeld', city: 'Voorbeeldplaats', teams: [
  { id: 46179, name: 'Voorbeeld MO11-1', federation_reference_id: 'HH11PD0', recent_poule_id: 200, hockey_type: 'VE' }
] } }
const detail = { data: { season_name: '2026-2027', poules: [{ matches: [
  { id: 123, date: '2026-10-31T10:30:00', home: club.data.teams[0], away: { id: 46180, name: 'Ander MO11-1', federation_reference_id: 'HH22PD0', hockey_type: 'VE' }, privateField: 'niet-exporteren' },
  { id: 124, date: '2026-11-07T00:00:00+01:00', status: 'announced', home: club.data.teams[0], away: { id: 46180, name: 'Ander MO11-1', federation_reference_id: 'HH22PD0', hockey_type: 'VE' } }
] }] } }
puppeteer.launch = async options => {
  const browser = await start(options)
  const nieuw = browser.newPage.bind(browser)
  browser.newPage = async () => {
    const page = await nieuw()
    await page.setRequestInterception(true)
    telling = { clubs: 0, registratie: 0, detail: 0 }
    page.on('request', async req => {
      const u = new URL(req.url())
      if (u.origin === 'https://www.hockey.nl') {
        return req.respond({ contentType: 'text/html', body: `<script>
          const bron='https://app.hockeyweerelt.nl';
          addEventListener('hashchange',()=>fetch(bron+'/poules/200/teams/46179'));
          const pad=location.hash.includes('/team/')?'/poules/200/teams/46179':'/clubs/HH11PD0';
          (async()=>{if(${JSON.stringify(scenario)}==='sessie' && !localStorage.getItem('fixture-bezoeker')){
            await fetch(bron+'/device/register',{method:'POST'}); localStorage.setItem('fixture-bezoeker','bekend');
          }const r=await fetch(bron+pad);if(r.status===401){
            const herstel=await fetch(bron+'/device/register',{method:'POST'});
            if(herstel.ok) await fetch(bron+pad);
          }})();</script>` })
      }
      if (u.origin !== 'https://app.hockeyweerelt.nl') return req.abort()
      const headers = { 'Access-Control-Allow-Origin': '*' }
      const json = (status, data) => req.respond({ status, headers, contentType: 'application/json', body: JSON.stringify(data) })
      if (u.pathname === '/clubs/HH11PD0') {
        telling.clubs++
        if (scenario === 'onvolledig') return json(200, { data: { ...club.data, teams: undefined } })
        if (scenario === 'lege-club') return json(200, { data: { ...club.data, teams: [] } })
        if (scenario === 'verboden') return json(403, {})
        if (telling.clubs === 1) return json(401, {})
        return json(200, club)
      }
      if (u.pathname === '/device/register') {
        telling.registratie++
        return json(scenario === 'limiet' ? 429 : 201, {})
      }
      if (u.pathname === '/poules/200/teams/46179') {
        telling.detail++
        if (scenario === 'verboden') return json(403, {})
        if (telling.detail === 1 && scenario !== 'sessie') return json(401, {})
        return json(200, detail)
      }
      return req.abort()
    })
    return page
  }
  return browser
}
;(async () => {
  process.env.HOCKEY_BRON_BROWSER_HERSTEL = '1'
  process.env.HOCKEY_BRON_SESSIE = '1'
  await lees(['HH11PD0', '46179', '200', '2026-2027'])
  const resultaat = JSON.parse(fs.readFileSync('/resultaat/catalogus.json'))
  assert.deepEqual(telling, { clubs: 0, registratie: 1, detail: 2 })
  assert.equal(resultaat.wedstrijden[0].uitNaam, 'Ander MO11-1')
  assert.equal(resultaat.wedstrijden[0].spelen, '10:30')
  assert.equal(resultaat.wedstrijden[1].spelen, '', 'Aangekondigde 00:00 is nog onbekend')
  assert.equal(resultaat.teams.find(t => t.bronId === '46179').pouleId, '200')
  assert.ok(!JSON.stringify(resultaat).includes('niet-exporteren'))
  // Een oud resultaat mag bij een mislukte run niet voor nieuwe data doorgaan.
  fs.unlinkSync('/resultaat/catalogus.json')
  for (const [naam, code] of [['limiet', 429], ['verboden', 403]]) {
    scenario = naam
    await assert.rejects(lees(['HH11PD0', '46179', '200', '2026-2027']), new RegExp(`HTTP ${code}`))
    assert.equal(telling.clubs, 0)
    assert.equal(telling.detail, 1)
    assert.ok(!fs.existsSync('/resultaat/catalogus.json'))
    const meting = JSON.parse(fs.readFileSync('/resultaat/bronmeting.json'))
    assert.ok(meting.antwoorden.some(r => r.status === code && r.route === (code === 429 ? 'bezoekersregistratie' : 'teamprogramma')))
  }
  scenario = 'herstel'
  detail.data.season_name = '2025-2026'
  await assert.rejects(lees(['HH11PD0', '46179', '200', '2026-2027']), /ander seizoen/)
  assert.ok(!fs.existsSync('/resultaat/catalogus.json'))
  scenario = 'sessie'; detail.data.season_name = '2026-2027'
  await lees(['HH11PD0', '46179', '200', '2026-2027'])
  assert.equal(telling.registratie, 1)
  await lees(['HH11PD0', '46179', '200', '2026-2027'])
  assert.equal(telling.registratie, 0, 'Volgend browserbezoek hergebruikt de bezoekerregistratie')
  assert.equal(telling.detail, 1)
  assert.equal(JSON.parse(fs.readFileSync('/resultaat/bronmeting.json')).antwoorden.some(r => r.route === 'bezoekersregistratie'), false)
  scenario = 'onvolledig'
  await assert.rejects(lees(['HH11PD0', '', '', '']), /geen volledige clubteams/)
  assert.ok(!fs.existsSync('/resultaat/catalogus.json'), 'Geen oud resultaat bij een onvolledig bronantwoord')
  scenario = 'lege-club'
  await lees(['HH11PD0', '', '', ''])
  assert.deepEqual(JSON.parse(fs.readFileSync('/resultaat/catalogus.json')).teams, [])
  console.log('CATALOGUS_BROWSER_FIXTURE_OK: direct programma, websiteherstel, publieke export, 403/429 met veilige meting, seizoenbescherming en sessiehergebruik; geen externe bron bezocht.')
})().catch(e => { console.error(e); process.exit(1) })
