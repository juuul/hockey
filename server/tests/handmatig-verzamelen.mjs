// Alleen localhost 8099 met de geïsoleerde rijden-fixture.
import assert from 'node:assert/strict'
const base = 'http://127.0.0.1:8099/api/collections'
const tokens = {}
for (const rol of ['beheer', 'kijker', 'ander']) {
  let r
  for (let i = 0; i < 10; i++) {
    r = await fetch(`${base}/users/auth-with-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity: `${rol}@example.invalid`, password: 'Fictief-Rijden-Test-123!' }) })
    if (r.status !== 429) break
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  assert.equal(r.status, 200); tokens[rol] = (await r.json()).token
}
const url = `${base}/programma/records/rijtestpot00001`
const headers = rol => ({ 'content-type': 'application/json', ...(tokens[rol] ? { authorization: tokens[rol] } : {}) })
const patch = (rol, data) => fetch(url, { method: 'PATCH', headers: headers(rol), body: JSON.stringify(data) })
for (const rol of ['beheer', 'kijker', 'ander', 'anoniem']) {
  const r = await patch(rol, { verzamelModus: 'handmatig', verzamelen: '09:10', verzamelDatum: '2026-10-31' })
  assert.equal(r.status, rol === 'beheer' ? 200 : 404, rol)
}
let r = await patch('beheer', { spelen: '13:00' })
assert.equal(r.status, 200)
assert.equal((await r.json()).verzamelen, '09:10')
r = await fetch(url, { headers: headers('kijker') })
assert.equal((await r.json()).verzamelen, '09:10')
assert.equal((await patch('beheer', { verzamelen: '25:00' })).status, 400)
assert.equal((await patch('beheer', { verzamelDatum: '2026-02-30' })).status, 400)
r = await patch('beheer', { verzamelModus: 'automatisch' })
assert.equal(r.status, 200)
assert.equal((await r.json()).verzamelen, '12:25')
console.log('HANDMATIG_API_OK: beheer bewaart, kijker leest, anderen geweigerd; aanvangupdate behoudt tijd, foutieve invoer geweigerd, automatisch herstel.')
