// Alleen de geïsoleerde fixture op localhost 8099; fictieve accounts.
import assert from 'node:assert/strict'
const base = 'http://127.0.0.1:8099/api/collections'
const tokens = {}
for (const rol of ['beheer', 'kijker', 'ander']) {
  let r
  for (let poging = 0; poging < 10; poging++) {
    r = await fetch(`${base}/users/auth-with-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity: `${rol}@example.invalid`, password: 'Fictief-Rijden-Test-123!' }) })
    if (r.status !== 429) break
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  assert.equal(r.status, 200, rol); tokens[rol] = (await r.json()).token
}
const pad = `${base}/programma/records/rijtestpot00001`
for (const rol of ['beheer', 'kijker', 'ander', 'anoniem']) {
  const headers = { 'content-type': 'application/json', ...(tokens[rol] ? { authorization: tokens[rol] } : {}) }
  const lezen = await fetch(pad, { headers })
  assert.equal(lezen.status, ['beheer', 'kijker'].includes(rol) ? 200 : 404, rol)
  if (lezen.status === 200) assert.deepEqual((await lezen.json()).rijders, ['kindvoorbeeld', '-', ''])
  const wijzig = await fetch(pad, { method: 'PATCH', headers, body: JSON.stringify({ rijders: rol === 'beheer' ? ['kindvoorbeeld', '-', ''] : ['mag-niet'] }) })
  assert.equal(wijzig.status, rol === 'beheer' ? 200 : 404, rol)
}
console.log('RIJDEN_RECHTEN_OK: beheer schrijft, kijker leest alleen, andere teams en bezoekers geen toegang.')
