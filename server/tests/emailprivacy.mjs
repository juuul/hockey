// Uitsluitend de geïsoleerde QA-fixture op 8099; geen productiedata of mails.
import assert from 'node:assert/strict'
import PocketBase from 'pocketbase'
process.on('uncaughtException', e => { console.error(e.message, e.response?.data || '', (e.stack || '').split('\n').filter(l => l.includes('emailprivacy.mjs')).join('\n')); process.exit(1) })
const base = 'http://127.0.0.1:8099', password = 'Fictief-Toegang-Test-123!'
const beheer = new PocketBase(base), kijker = new PocketBase(base), ander = new PocketBase(base), anoniem = new PocketBase(base)
for (const p of [beheer,kijker,ander,anoniem]) p.autoCancellation(false)
for (const [client,email] of [[beheer,'beheer@example.invalid'],[kijker,'kijker@example.invalid'],[ander,'ander@example.invalid']]) {
  await client.collection('users').authWithPassword(email,password)
  await new Promise(resolve=>setTimeout(resolve,1600))
}
const fail = async fn => { try { await fn(); assert.fail('Ten onrechte toegestaan') } catch(e) { assert.ok([400,401,403,404].includes(e.status), `${e.status}: ${e.message}`) } }
const team='toegangteam0001', owner=beheer.authStore.record.id, viewer=kijker.authStore.record.id
assert.equal((await beheer.collection('users').getOne(viewer)).email,'kijker@example.invalid')
assert.equal((await kijker.collection('users').getOne(viewer)).email,'kijker@example.invalid','Eigen accountadres blijft zichtbaar')
await fail(()=>kijker.collection('users').getOne(owner))
await fail(()=>ander.collection('users').getOne(viewer))
await fail(()=>ander.collection('users').getOne(owner))
await fail(()=>anoniem.collection('users').getOne(viewer))
assert.deepEqual((await kijker.collection('users').getFullList()).map(u=>u.id),[viewer])
assert.equal((await anoniem.collection('users').getFullList()).length,0)
assert.equal((await kijker.collection('users').getList(1,10,{filter:'email = "beheer@example.invalid"'})).totalItems,0)
for (const fields of [undefined,'id,expand.beheerders.email,expand.kijkers.email']) {
  const expanded=await kijker.collection('teams').getOne(team,{expand:'beheerders,kijkers',fields})
  assert.ok(!JSON.stringify(expanded).includes('beheer@example.invalid'),'Ook relation-expand mag geen e-mailadres lekken')
  assert.ok(!JSON.stringify(expanded).includes('ander@example.invalid'))
}
const expanded=await beheer.collection('teams').getOne(team,{expand:'beheerders,kijkers'})
assert.equal(expanded.expand.kijkers[0].email,'kijker@example.invalid')
for (const col of ['uitnodigingen','toegangsaanvragen','teamblokkades']) {
  assert.equal((await kijker.collection(col).getFullList()).length,0)
}
// Dezelfde geldige login mag na verlies van de beheerrol geen ledenadressen meer ophalen.
await beheer.collection('teams').update(team,{beheerders:[viewer],kijkers:[owner]})
await fail(()=>beheer.collection('users').getOne(viewer))
assert.equal((await kijker.collection('users').getOne(owner)).email,'beheer@example.invalid')
await kijker.collection('teams').update(team,{beheerders:[owner],kijkers:[viewer]})
console.log('EMAILPRIVACY_OK: eigen adres, beheerder eigen team, kijker, ander team, anoniem, filters, expand en ingetrokken beheerrol')
