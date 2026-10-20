// Alleen de geïsoleerde rijden.pb.js-fixture op localhost 8099.
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
  assert.equal(r.status, 200)
  tokens[rol] = (await r.json()).token
}
const headers = rol => ({ 'content-type': 'application/json', ...(tokens[rol] ? { authorization: tokens[rol] } : {}) })
const team = `${base}/teams/records/rijtestteam0001`
for (const rol of ['beheer', 'kijker', 'ander', 'anoniem']) {
  const r = await fetch(team, { method: 'PATCH', headers: headers(rol), body: JSON.stringify({ instellingen: { scoreBijhouden: true, speeltijdBijhouden: false, begeleidingThuis: 2 } }) })
  assert.equal(r.status, rol === 'beheer' ? 200 : 404, rol)
}
const voorKijker = await fetch(team, { headers: headers('kijker') })
assert.deepEqual((await voorKijker.json()).instellingen, { scoreBijhouden: true, speeltijdBijhouden: false, begeleidingThuis: 2 })
const wedstrijd = { id: 'teamoptiepot001', team: 'rijtestteam0001', datum: '2026-10-20', tegenstander: 'Voorbeeldclub', thuis: true, wij: 0, zij: 0, doelpunten: [], spelers: [], opstelling: '3-4-3', opgeslagenOp: Date.now() }
const r = await fetch(`${base}/wedstrijden/records`, { method: 'POST', headers: headers('beheer'), body: JSON.stringify(wedstrijd) })
assert.equal(r.status, 200, JSON.stringify(await r.clone().json()))
assert.equal((await r.json()).scoreNietBijgehouden, false, 'Oude wedstrijden blijven geldig')
const w = await fetch(`${base}/wedstrijden/records/${wedstrijd.id}`, { method: 'PATCH', headers: headers('beheer'), body: JSON.stringify({ scoreNietBijgehouden: true }) })
assert.equal(w.status, 200)
assert.equal((await w.json()).scoreNietBijgehouden, true)
const gelezen = await fetch(`${base}/wedstrijden/records/${wedstrijd.id}`, { headers: headers('kijker') })
assert.equal((await gelezen.json()).scoreNietBijgehouden, true)
console.log('TEAM_OPTIES_RECHTEN_OK: beheer bewaart, kijker ontvangt, anderen geen toegang; scoremarkering blijft bewaard en oude wedstrijden behouden score.')
