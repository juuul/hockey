// Integratietest alleen tegen de losse testbackend en de afgevangen mailbox.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import PocketBase from 'pocketbase'
process.on('uncaughtException', e => { console.error(e.message, e.response?.data || '', (e.stack || '').split('\n').filter(l=>l.includes('catalogus.mjs')).join('\n')); process.exit(1) })
const base = 'http://127.0.0.1:8091'
const mail = 'http://127.0.0.1:8092'
const stamp = Date.now().toString(36)
const password = `Test-${stamp}-Account!`
const terug = 'https://hockey.juliaan.eu/test/'
const pub = new PocketBase(base); pub.autoCancellation(false)
const teams = await pub.collection('catalogus_teams').getFullList({ filter: 'bronId = "46179"' })
assert.equal(teams.length, 1)
const officieel = teams[0]
assert.equal((await pub.collection('catalogus_clubs').getList(1,1)).totalItems,344)
assert.equal((await pub.collection('spelers').getList()).totalItems,0)
const fail = async (fn, statuses = [400,401,403,404]) => {
  try { await fn(); assert.fail('Toegang werd ten onrechte toegestaan') }
  catch(e) { assert.ok(statuses.includes(e.status), `Onverwachte foutstatus ${e.status}: ${e.message}`) }
}
async function uitnodiging(email) {
  const lijst = await (await fetch(`${mail}/api/v1/messages`)).json()
  const bericht = lijst.messages.find(m => m.To.some(a => a.Address.toLowerCase() === email.toLowerCase()))
  assert.ok(bericht, 'Testmail niet afgevangen')
  const body = await (await fetch(`${mail}/api/v1/message/${bericht.ID}`)).json()
  const token = body.HTML.match(/#uitnodiging=([a-zA-Z0-9]+)/)?.[1]
  assert.ok(token, 'Uitnodiging ontbreekt')
  return token
}
async function aanmaken(suffix, token) {
  const email = `test-${stamp}-${suffix}@example.com`.toLowerCase()
  if (!token) {
    await pub.send('/api/hockey/aanmelding', { method:'POST', body:{ officieelTeam:officieel.id, omgevingNaam:`Test ${stamp} ${suffix}`, naam:`Test ${suffix}`, email, terug } })
    token = await uitnodiging(email)
  }
  const info = await pub.send(`/api/hockey/uitnodiging/${token}`, {})
  assert.equal(info.naam, `Test ${suffix}`)
  await fail(() => pub.send(`/api/hockey/uitnodiging/${token}`, { method:'POST', body:{wachtwoord:'kort'} }))
  await pub.send(`/api/hockey/uitnodiging/${token}`, { method:'POST', body:{wachtwoord:password} })
  await fail(() => pub.send(`/api/hockey/uitnodiging/${token}`, {method:'POST',body:{wachtwoord:password}}))
  const client = new PocketBase(base); client.autoCancellation(false)
  await new Promise(r=>setTimeout(r,1600)) // Respecteer de ingestelde authenticatielimiet.
  await client.collection('users').authWithPassword(email,password)
  assert.equal(client.authStore.record.name,`Test ${suffix}`)
  const omgeving = (await client.collection('teams').getFullList())[0]
  assert.ok(omgeving)
  return { client, omgeving, email }
}
console.log('Controle accounts en gescheiden omgevingen')
const a = await aanmaken('A'), b = await aanmaken('B')
assert.notEqual(a.omgeving.id,b.omgeving.id)
assert.ok(a.omgeving.beheerders.includes(a.client.authStore.record.id))
await fail(() => a.client.collection('teams').getOne(b.omgeving.id))
await fail(() => a.client.collection('users').update(a.client.authStore.record.id,{superadmin:true}))
const programma = (await a.client.collection('programma').getFullList({sort:'datum'})).filter(p => p.bronId)
assert.equal(programma.length,5)
const tegenstanders = await a.client.collection('clubs').getFullList()
assert.equal(tegenstanders.length,5)
for (const p of programma) assert.equal(tegenstanders.find(c=>c.id===p.clubId)?.naam,p.tegenstander)
const speler = await a.client.collection('spelers').create({team:a.omgeving.id,naam:'Voorbeeld'})
await fail(() => b.client.collection('spelers').getOne(speler.id))
console.log('Controle aanvraag en goedkeuring')
const link = await a.client.send(`/api/hockey/aanvraaglink/${a.omgeving.id}`,{method:'POST',body:{}})
const publiek = await pub.send(`/api/hockey/aanvraag/${a.omgeving.id}.${link.token}`,{})
assert.deepEqual(Object.keys(publiek),['team'])
await fail(() => pub.collection('teams').getOne(a.omgeving.id))
const emailC = `test-${stamp}-C@example.com`.toLowerCase()
await pub.send(`/api/hockey/aanvraag/${a.omgeving.id}.${link.token}`,{method:'POST',body:{naam:'Test C',email:emailC,terug}})
assert.equal((await a.client.collection('uitnodigingen').getFullList({filter:pub.filter('email = {:e}',{e:emailC})})).length,0)
const aanvraag = (await a.client.collection('toegangsaanvragen').getFullList({filter:pub.filter('email = {:e}',{e:emailC})}))[0]
assert.equal(aanvraag.status,'nieuw')
await fail(() => b.client.send(`/api/hockey/toegang-id/${aanvraag.id}`,{method:'POST',body:{besluit:'kijker'}}))
await a.client.send(`/api/hockey/toegang-id/${aanvraag.id}`,{method:'POST',body:{besluit:'kijker'}})
const c = await aanmaken('C',await uitnodiging(emailC))
assert.ok(c.omgeving.kijkers.includes(c.client.authStore.record.id))
await fail(() => c.client.collection('spelers').create({team:a.omgeving.id,naam:'Mag niet'}))
await fail(() => c.client.collection('teams').update(a.omgeving.id,{beheerders:[c.client.authStore.record.id]}))
await fail(async () => c.client.collection('programma').getOne((await b.client.collection('programma').getFullList())[0].id))
await fail(() => a.client.collection('teams').update(a.omgeving.id,{beheerders:[]}))
await fail(() => a.client.send(`/api/hockey/kijklink/${a.omgeving.id}`,{method:'POST',body:{}}))
const vernieuwd = await a.client.send(`/api/hockey/aanvraaglink/${a.omgeving.id}`,{method:'POST',body:{vernieuw:true}})
assert.notEqual(vernieuwd.token,link.token)
await fail(() => pub.send(`/api/hockey/aanvraag/${a.omgeving.id}.${link.token}`,{}))
// Eigen aanvullingen en overrides blijven staan na herhaalde officiële updates.
console.log('Controle bronupdates en eigen aanvullingen')
const p = programma[0]
await a.client.collection('programma').update(p.id,{spelen:'08:10',verzamelen:'08:00',notitie:'Eigen afspraak',bronId:'vervalst',bronBasis:null})
assert.equal((await a.client.collection('programma').getOne(p.id)).bronId,p.bronId)
const origineel = JSON.parse(fs.readFileSync(new URL('../catalogus/start.json',import.meta.url)))
const wijzig = structuredClone(origineel)
wijzig.wedstrijden.find(w=>w.bronId === p.bronId).spelen='09:00'
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hockey-test-import-'))
function importeer(data) {
  const bestand=path.join(dir,'data.json'); fs.writeFileSync(bestand,JSON.stringify(data))
  execFileSync('docker',['exec','-i','hockey-pocketbase-test','sh','-c','cat > /tmp/test-import.json'],{input:fs.readFileSync(bestand)})
  const uit=execFileSync('docker',['exec','hockey-pocketbase-test','/pb/pocketbase','catalogus-import','/tmp/test-import.json'],{encoding:'utf8'})
  assert.ok(uit.includes('Catalogus bijgewerkt'),uit)
}
try {
  importeer(wijzig); importeer(wijzig)
  let bijgewerkt=await a.client.collection('programma').getOne(p.id)
  assert.equal(bijgewerkt.spelen,'08:10'); assert.equal(bijgewerkt.verzamelen,'08:00'); assert.equal(bijgewerkt.notitie,'Eigen afspraak')
  assert.equal(bijgewerkt.bronWijziging.spelen,'09:00')
  assert.equal((await a.client.collection('programma').getFullList()).filter(p => p.bronId).length,5)
  await a.client.send(`/api/hockey/catalogus/programma/${p.id}/herstel`,{method:'POST',body:{veld:'spelen'}})
  bijgewerkt=await a.client.collection('programma').getOne(p.id)
  assert.equal(bijgewerkt.spelen,'09:00')
  assert.deepEqual(bijgewerkt.bronWijziging,{})
  importeer(origineel)
  const eigenClub = tegenstanders.find(c=>c.id===p.clubId)
  await a.client.collection('clubs').update(eigenClub.id,{naam:'Eigen naam tegenstander'})
  importeer(origineel)
  assert.equal((await a.client.collection('programma').getOne(p.id)).clubId,eigenClub.id)
  assert.equal((await a.client.collection('clubs').getOne(eigenClub.id)).naam,'Eigen naam tegenstander')
// Een bewust verwijderde geïmporteerde wedstrijd blijft weg na opnieuw importeren.
console.log('Controle bewuste verwijdering')
await a.client.collection('programma').delete(programma[1].id)
importeer(origineel)
assert.equal((await a.client.collection('programma').getFullList()).filter(p => p.bronId).length,4)
} finally { fs.rmSync(dir,{recursive:true,force:true}) }
// Intrekken beëindigt servertoegang ook met een nog geldige accounttoken.
await a.client.collection('teams').update(a.omgeving.id,{kijkers:[]})
await fail(() => c.client.collection('spelers').getOne(speler.id))
console.log('Geslaagd: gescheiden omgevingen, e-mailbevestiging, goedkeuring, privacy, rollen, linkrotatie en behoud eigen wedstrijdgegevens.')
