// Alleen de geïsoleerde fixture op localhost 8099; geen echte gebruikers of mails.
import assert from 'node:assert/strict'
const base = 'http://127.0.0.1:8099'
const lijst = await (await fetch(`${base}/api/hockey/catalogus/team/testofficieel01/omgevingen`)).json()
assert.ok(Array.isArray(lijst), JSON.stringify(lijst))
assert.deepEqual(lijst.map(t => t.id), ['testgroep000001', 'testgroep000002'])
for (const team of lijst) assert.deepEqual(Object.keys(team).sort(), ['id', 'naam', 'omgevingNaam'])
for (const id of ['testgroep000001', 'testgroep000002']) {
  const r = await fetch(`${base}/api/hockey/catalogus/omgeving/${id}/aanvraag`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ naam: 'Testouder', email: `ouder-${id}@example.invalid`, terug: 'https://hockey.juliaan.eu/test/' }) })
  assert.equal(r.status, 200, await r.text())
  assert.equal((await fetch(`${base}/api/collections/teams/records/${id}`)).status, 404)
}
const ongebonden = await fetch(`${base}/api/hockey/catalogus/omgeving/testgroep000003/aanvraag`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ naam: 'Testouder', email: 'ouder@example.invalid', terug: 'https://hockey.juliaan.eu/test/' }) })
assert.equal(ongebonden.status, 404)
assert.equal((await fetch(`${base}/api/collections/spelers/records/testspeler00001`)).status, 404)
for (const col of ['spelers', 'teams', 'users', 'uitnodigingen', 'toegangsaanvragen']) {
  const r = await fetch(`${base}/api/collections/${col}/records`)
  if (r.status === 200) assert.equal((await r.json()).totalItems, 0, col)
  else assert.ok([401, 403, 404].includes(r.status), `${col}: ${r.status}`)
}
console.log('VINDBAARHEID_OK: ook oude verborgen gekoppelde groepen vindbaar; alleen openbare namen/id; ongekoppelde groepen en privégegevens afgeschermd.')
