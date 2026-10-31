const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { wachtOpBron } = require('../scripts/catalogus-browser.cjs')
const { normaliseer } = require('../scripts/catalogus-normaliseer.cjs')
const { meetBron } = require('../scripts/catalogus-bronmeting.cjs')
function response(status, path = '/clubs/ABC1234', method = 'GET', origin = 'https://app.hockeyweerelt.nl') {
  return { status: () => status, ok: () => status >= 200 && status < 300,
    url: () => origin + path, request: () => ({ method: () => method }) }
}
async function test() {
  process.env.HOCKEY_BRON_SESSIE = '1'
  const events = new EventEmitter(), stop = meetBron(events)
  const req = { method: () => 'POST', url: () => 'https://app.hockeyweerelt.nl/device/register?token=GEHEIM' }
  events.emit('request', req)
  events.emit('response', { status: () => 429, url: req.url, request: () => req,
    headers: () => ({ 'retry-after': '3600', authorization: 'NIET-BEWAREN' }) })
  const meting = stop()
  assert.equal(meting.bronverzoeken, 1)
  assert.equal(meting.antwoorden[0].route, 'bezoekersregistratie')
  assert.equal(meting.antwoorden[0].status, 429)
  assert.ok(meting.antwoorden[0].retryNa > Date.now()/1000 + 3500)
  assert.equal(meting.volgorde[0].verzoek, 1)
  assert.ok(!/GEHEIM|NIET-BEWAREN|token|authorization|hockeyweerelt/.test(JSON.stringify(meting)))
  assert.equal(events.listenerCount('request'), 0)
  assert.equal(events.listenerCount('response'), 0)
  const t = { id: 1, name: 'Voorbeeld MO11-1', federation_reference_id: 'ABC1234' }
  for (const [status, tijd, verwacht] of [['announced', '00:00', ''], ['announced', '09:00', '09:00'], ['scheduled', '00:00', '00:00'], ['scheduled', '09:00', '09:00']]) {
    const data = normaliseer(null, null, { data: { season_name: '2026-2027', poules: [{ matches: [{ id: 1, date: `2026-10-31T${tijd}:00+01:00`, status, home: t, away: { ...t, id: 2 } }] }] } })
    assert.equal(data.wedstrijden[0].spelen, verwacht)
  }
  const page = new EventEmitter()
  let w = wachtOpBron(page, '/clubs/ABC1234', 100)
  page.emit('response', response(401)); page.emit('response', response(200))
  assert.equal((await w.antwoord).status(), 200)
  assert.equal(page.listenerCount('response'), 0)
  for (const [code, path, method] of [[429, '/clubs/ABC1234', 'GET'], [429, '/device/register', 'POST'], [429, '/other', 'GET'], [403, '/device/register', 'POST'], [403, '/clubs/ABC1234', 'GET']]) {
    w = wachtOpBron(page, '/clubs/ABC1234', 100)
    page.emit('response', response(code, path, method))
    await assert.rejects(w.antwoord, new RegExp(`HTTP ${code}`))
    assert.equal(page.listenerCount('response'), 0)
  }
  w = wachtOpBron(page, '/clubs/ABC1234', 100)
  page.emit('response', { ...response(429), headers: () => ({ 'retry-after': '3600' }) })
  await assert.rejects(w.antwoord, /bronWachtTot=\d+/)
  w = wachtOpBron(page, '/clubs/ABC1234', 100)
  page.emit('response', response(401)); page.emit('response', response(401))
  await assert.rejects(w.antwoord, /HTTP 401/)
  w = wachtOpBron(page, '/clubs/ABC1234', 5)
  page.emit('response', response(401))
  await assert.rejects(w.antwoord, /HTTP 401; herstelronde/)
  w = wachtOpBron(page, '/clubs/ABC1234', 5)
  for (const r of [response(200, '/other'), response(200, '/clubs/ABC1234', 'OPTIONS'), response(200, '/clubs/ABC1234', 'GET', 'https://example.invalid')]) page.emit('response', r)
  await assert.rejects(w.antwoord, /Bronantwoord ontbreekt/)
  w = wachtOpBron(page, '/clubs/ABC1234', 100)
  page.emit('close')
  await assert.rejects(w.antwoord, /browser gesloten/)
  w = wachtOpBron(page, '/clubs/ABC1234', 5); w.stop()
  assert.equal(page.listenerCount('response'), 0)
  assert.equal(page.listenerCount('close'), 0)
  console.log('CATALOGUS_BROWSER_OK: eigen websiteherstel afwachten; 403/429 stoppen; filters, timeout en opruimen.')
}
test().catch(e => { console.error(e); process.exit(1) })
