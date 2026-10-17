// Observeer uitsluitend de verzoeken die de publieke website zelf verstuurt.
// Geen zelfgemaakte headers, gekopieerde tokens of eigen netwerkherpogingen.
function wachtOpBron(page, pad, timeout = 45000) {
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
      // Stop ook als registratie zelf wordt begrensd: niet wachten op meer verkeer.
      if (u.pathname === '/device/register' && response.status() === 429) {
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
  const header = response.headers?.()['retry-after']
  const tot = /^\d+$/.test(header || '') ? Date.now() + Number(header)*1000 : Date.parse(header || '')
  const wacht = Number.isFinite(tot) && tot > Date.now() ? `; bronWachtTot=${Math.ceil(tot/1000)}` : ''
  return new Error(`Bron HTTP ${response.status()}; geen automatische herhaalpoging${wacht}`)
}

module.exports = { wachtOpBron }
