// Bezoek dezelfde openbare Match Center-pagina als een normale bezoeker.
// Geen clubaccount of privégegevens; geen vaste gekopieerde API-sleutels.
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const fs = require('fs')
const { normaliseer } = require('/scripts/catalogus-normaliseer.cjs')
;(async () => {
  const [clubId, teamId, pouleId, verwachtSeizoen] = process.argv.slice(2)
  if (clubId && !/^[A-Z0-9]{7}$/.test(clubId)) throw new Error('Ongeldige clubcode')
  if (teamId && (!/^\d+$/.test(teamId) || !/^\d+$/.test(pouleId))) throw new Error('Ongeldig team of poule')
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    const pad = clubId ? `/clubs/${clubId}` : '/clubs'
    const antwoord = page.waitForResponse(r => r.request().method() === 'GET' && new URL(r.url()).origin === 'https://app.hockeyweerelt.nl' && new URL(r.url()).pathname === pad, { timeout: 45000 })
    await page.goto(`https://www.hockey.nl/match-center#/${clubId ? `club/${clubId}` : 'clubs'}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    const response = await antwoord
    if (!response.ok()) throw new Error(`Bron HTTP ${response.status()}; geen automatische herhaalpoging`)
    const club = await response.json()
    let detail
    if (teamId) {
      // Eerst de club verversen: een nieuwe competitieperiode kan een andere poule hebben.
      const actuelePoule = String(club.data?.teams?.find(t => String(t.id) === teamId)?.recent_poule_id || pouleId)
      const antwoord = page.waitForResponse(r => r.request().method() === 'GET' && new URL(r.url()).origin === 'https://app.hockeyweerelt.nl' && new URL(r.url()).pathname === `/poules/${actuelePoule}/teams/${teamId}`, { timeout: 45000 })
      await page.evaluate(hash => { location.hash = hash }, `/team/${teamId}|${actuelePoule}`)
      const response = await antwoord
      if (!response.ok()) throw new Error(`Bron HTTP ${response.status()}; geen automatische herhaalpoging`)
      detail = await response.json()
      if (verwachtSeizoen && detail?.data?.season_name !== verwachtSeizoen) throw new Error('De bron levert een ander seizoen; bestaande gegevens blijven behouden')
    }
    fs.writeFileSync('/resultaat/catalogus.json', JSON.stringify(normaliseer(clubId ? null : club, clubId ? club : null, detail)))
  } finally { await browser.close() }
})().catch(e => { console.error(e.message); process.exit(1) })
