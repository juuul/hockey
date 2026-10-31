// Alleen tellers en vaste routenamen. Nooit URL-query's, headers, bodies of tokens.
const BRON = 'https://app.hockeyweerelt.nl'
function route(url) {
  const u = new URL(url)
  if (u.origin !== BRON) return null
  if (u.pathname === '/device/register') return 'bezoekersregistratie'
  if (u.pathname === '/clubs') return 'clublijst'
  if (/^\/clubs\/[A-Z0-9]{7}$/.test(u.pathname)) return 'clubteams'
  if (/^\/poules\/\d+\/teams\/\d+$/.test(u.pathname)) return 'teamprogramma'
  if (/^\/poules\/\d+$/.test(u.pathname)) return 'poule'
  return 'overig'
}
function retryTot(response, nu = Date.now()) {
  const waarde = response.headers?.()['retry-after']
  const tot = /^\d+$/.test(waarde || '') ? nu + Number(waarde) * 1000 : Date.parse(waarde || '')
  return Number.isFinite(tot) && tot > nu ? Math.ceil(tot / 1000) : null
}
function meetBron(page) {
  const begin = Date.now(), nummers = new WeakMap()
  const data = { versie: 1, verzoeken: 0, bronverzoeken: 0, antwoorden: [], volgorde: [], afgekapt: false }
  function verzoek(req) {
    data.verzoeken++
    if (route(req.url()) !== null) nummers.set(req, ++data.bronverzoeken)
  }
  function antwoord(res) {
    const pad = route(res.url())
    if (pad === null) return
    const req = res.request(), methode = req.method()
    if (!['GET', 'POST', 'OPTIONS', 'HEAD'].includes(methode)) return
    const status = res.status(), retryNa = retryTot(res)
    const oud = data.antwoorden.find(r => r.route === pad && r.methode === methode && r.status === status)
    if (oud) { oud.aantal++; oud.retryNa = Math.max(oud.retryNa || 0, retryNa || 0) || null }
    else if (data.antwoorden.length < 100) data.antwoorden.push({ route: pad, methode, status, aantal: 1, retryNa })
    else data.afgekapt = true
    if (data.volgorde.length < 100) data.volgorde.push({ route: pad, methode, status, verzoek: nummers.get(req) || 0 })
    else data.afgekapt = true
  }
  page.on('request', verzoek)
  page.on('response', antwoord)
  return () => {
    page.off('request', verzoek)
    page.off('response', antwoord)
    return { ...data, duurMs: Date.now() - begin }
  }
}
module.exports = { route, retryTot, meetBron }
