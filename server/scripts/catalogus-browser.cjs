const { route, retryTot } = require('./catalogus-bronmeting.cjs')
// Observeer uitsluitend de verzoeken die de publieke website zelf verstuurt.
// Geen zelfgemaakte headers, gekopieerde tokens of eigen netwerkherpogingen.
function wachtOpBron(page, pad, timeout = 45000) {
  const metSessiemeting = process.env.HOCKEY_BRON_SESSIE === '1'
  let afmelden
  const antwoord = new Promise((resolve, reject) => {
    let eerste401 = false
    const timer = setTimeout(() => klaar(new Error(eerste401
      ? 'Bron HTTP 401; herstelronde website niet geslaagd; geen automatische herhaalpoging'
      : 'Bronantwoord ontbreekt binnen de wachttijd; geen automatische herhaalpoging')), timeout)
    function klaar(fout, response) {
      afmelden()
      if (fout) reject(fout)
      else resolve(response)
    }
    function ontvangen(response) {
      const u = new URL(response.url())
      if (u.origin !== 'https://app.hockeyweerelt.nl' || response.request().method() === 'OPTIONS') return
      // Iedere bron-429 telt, ook wanneer een nevenverzoek wordt begrensd.
      if ((response.status() === 429 && (metSessiemeting || u.pathname === '/device/register')) ||
          (metSessiemeting && u.pathname === '/device/register' && response.status() === 403)) {
        return klaar(bronFout(response))
      }
      if (u.pathname !== pad || response.request().method() !== 'GET') return
      if (response.ok()) return klaar(null, response)
      // De officiële client vernieuwt na een eerste 401 zelf zijn anonieme
      // registratie en herhaalt het verzoek één keer. Alleen die ronde afwachten.
      if (response.status() === 401 && !eerste401) { eerste401 = true; return }
      klaar(bronFout(response))
    }
    function gesloten() { klaar(new Error('Bronbrowser gesloten')) }
    afmelden = () => {
      clearTimeout(timer)
      page.off('response', ontvangen)
      page.off('close', gesloten)
    }
    page.on('response', ontvangen)
    page.on('close', gesloten)
  })
  return { antwoord, stop: () => afmelden() }
}

function bronFout(response) {
  const tot = retryTot(response)
  const wacht = tot ? `; bronWachtTot=${tot}` : ''
  const pad = process.env.HOCKEY_BRON_SESSIE === '1' ? `; bronRoute=${route(response.url())}` : ''
  return new Error(`Bron HTTP ${response.status()}; geen automatische herhaalpoging${pad}${wacht}`)
}

module.exports = { wachtOpBron }
