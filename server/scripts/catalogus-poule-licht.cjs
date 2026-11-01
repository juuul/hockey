// Gebruik de officiële anonieme API-client in één lege browserpagina.
// Geen gekopieerde tokens, zelfgemaakte handtekeningen of website-nevenverzoeken.
const { wachtOpBron } = require('./catalogus-browser.cjs')
const { retryTot } = require('./catalogus-bronmeting.cjs')
const ORIGIN = 'https://www.hockey.nl'
const CDN = 'https://mc.static-hw.nl/v2/'
const API = 'https://app.hockeyweerelt.nl'

async function leesPouleLicht(page, team, poule) {
  if (!/^\d+$/.test(team) || !/^\d+$/.test(poule)) throw new Error('Ongeldige poule of team')
  const pad = `/poules/${poule}/teams/${team}`
  const aantallen = { registratie: 0, programma: 0 }
  const preflights = new Map()
  let afgebroken = false, onverwacht = false, moduleFout
  await page.setRequestInterception(true)
  const filter = req => {
    if (req.isInterceptResolutionHandled()) return
    const u = new URL(req.url()), methode = req.method()
    if (afgebroken) return req.abort()
    if (req.isNavigationRequest() && req.frame() === page.mainFrame() && u.origin === ORIGIN && u.pathname === '/match-center') {
      return req.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })
    }
    if (u.origin === 'https://mc.static-hw.nl' && /^\/v2\/[\w.-]+\.js$/.test(u.pathname) && !u.search && methode === 'GET') return req.continue()
    if (u.origin === API && !u.search) {
      if (methode === 'OPTIONS' && [pad, '/device/register'].includes(u.pathname)) {
        const n = (preflights.get(u.pathname) || 0) + 1
        preflights.set(u.pathname, n)
        if (n <= 2) return req.continue()
      }
      const soort = u.pathname === '/device/register' && methode === 'POST' ? 'registratie'
        : u.pathname === pad && methode === 'GET' ? 'programma' : null
      // Eén initiële registratie plus hoogstens één herstel; hoogstens één GET-herstel.
      if (soort && ++aantallen[soort] <= 2) return req.continue()
      onverwacht = true
    }
    return req.abort()
  }
  page.on('request', filter)
  const moduleAntwoord = res => {
    if (new URL(res.url()).origin === 'https://mc.static-hw.nl' && [401, 403, 429].includes(res.status())) {
      const tot = retryTot(res)
      moduleFout = new Error(`Bron HTTP ${res.status()}; bronRoute=clientmodule${tot ? '; bronWachtTot=' + tot : ''}`)
      afgebroken = true
    }
  }
  page.on('response', moduleAntwoord)
  const wacht = wachtOpBron(page, pad)
  // Direct de afbreekvlag zetten, ook tijdens de module-/sessie-initialisatie.
  const antwoord = wacht.antwoord.catch(e => { afgebroken = true; throw e })
  try {
    const start = async () => {
      await page.goto(ORIGIN + '/match-center', { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.evaluate(async cdn => {
        const haalTekst = async url => {
          const r = await fetch(url)
          if (!r.ok) throw new Error('Bron HTTP ' + r.status + '; bronRoute=clientmodule')
          const s = await r.text()
          if (s.length > 2*1024*1024) throw new Error('Onverwachte clientmodule')
          return s
        }
        const entry = await haalTekst(cdn + 'match-center.js')
        const imports = [...entry.matchAll(/from\s+["'](\.\/[^"']+\.js)["']/g)].map(m => m[1])
        const veilig = p => /^\.\/[\w.-]+\.js$/.test(p)
        const apiPaden = [...new Set(imports.filter(p => veilig(p) && /^\.\/useApi-/.test(p)))]
        const runtimePad = imports.find(p => veilig(p) && /^\.\/runtime-dom\.esm-bundler-/.test(p))
        if (!runtimePad || apiPaden.length < 1 || apiPaden.length > 4) throw new Error('Officiële clientopbouw gewijzigd')
        let apiPad
        for (const p of apiPaden) {
          const tekst = await haalTekst(new URL(p, cdn).href)
          if (tekst.includes('/device/register') && tekst.includes('X-HAPI-Authorization')) {
            if (apiPad) throw new Error('Onbekende clientopbouw')
            apiPad = p
          }
        }
        if (!apiPad) throw new Error('Officiële bezoekersclient ontbreekt')
        const client = await import(new URL(apiPad, cdn).href)
        const runtime = await import(new URL(runtimePad, cdn).href)
        if (typeof client.r !== 'function' || typeof client.t !== 'function' || typeof runtime.n !== 'function') throw new Error('Officiële clientinterface gewijzigd')
        // Alleen deze component starten. Haar eigen mounted-hook initialiseert
        // de bezoekerssessie; er worden geen andere websitecomponenten geladen.
        const Component = runtime.n({
          configureApp(app) { app.use(client.r()) },
          setup() { window.__hockeyPouleClient = client.t(); return () => null }
        })
        customElements.define('hockey-poule-lezer', Component)
        document.body.appendChild(new Component())
      }, CDN)
      // Wacht de ene eigen sessie-initialisatie af vóór het programmaverzoek.
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      if (afgebroken || onverwacht) throw new Error('Lichte broncontrole afgebroken')
      await page.evaluate(async pad => {
        const api = window.__hockeyPouleClient
        if (!api || typeof api.get !== 'function') throw new Error('Bezoekersclient niet gestart')
        await api.get(pad)
      }, pad)
      if (onverwacht) throw new Error('Onverwacht bronverzoek; bestaande gegevens blijven behouden')
    }
    const [, response] = await Promise.all([start(), antwoord])
    const data = await response.json()
    if (!data?.data || !Array.isArray(data.data.poules)) throw new Error('Onvolledig pouleantwoord')
    return data
  } catch (e) {
    throw moduleFout || e
  } finally {
    afgebroken = true
    wacht.stop()
    page.off('response', moduleAntwoord)
    // De requestfilter blijft tot het sluiten van deze pagina actief, zodat
    // een afgebroken initialisatie geen late bronverzoeken kan starten.
  }
}
module.exports = { leesPouleLicht }
