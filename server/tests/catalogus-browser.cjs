const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { wachtOpBron } = require('../scripts/catalogus-browser.cjs')
function response(status, path = '/clubs/ABC1234', method = 'GET', origin = 'https://app.hockeyweerelt.nl') {
  return { status: () => status, ok: () => status >= 200 && status < 300,
    url: () => origin + path, request: () => ({ method: () => method }) }
}
async function test() {
  const page = new EventEmitter()
  let w = wachtOpBron(page, '/clubs/ABC1234', 100)
  page.emit('response', response(401)); page.emit('response', response(200))
  assert.equal((await w.antwoord).status(), 200)
  assert.equal(page.listenerCount('response'), 0)
  for (const [code, path, method] of [[429, '/clubs/ABC1234', 'GET'], [429, '/device/register', 'POST'], [403, '/clubs/ABC1234', 'GET']]) {
    w = wachtOpBron(page, '/clubs/ABC1234', 100)
    page.emit('response', response(code, path, method))
    await assert.rejects(w.antwoord, new RegExp(`HTTP ${code}`))
    assert.equal(page.listenerCount('response'), 0)
  }
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
