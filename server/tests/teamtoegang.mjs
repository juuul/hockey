// Alleen een geïsoleerde QA-server op 8099; alle mail wordt door Mailpit afgevangen.
import assert from 'node:assert/strict'
import PocketBase from 'pocketbase'
process.on('uncaughtException', e => { console.error(e.message, e.response?.data || '', (e.stack || '').split('\n').filter(l => l.includes('teamtoegang.mjs')).join('\n')); process.exit(1) })
const base = 'http://127.0.0.1:8099', terug = 'https://hockey.juliaan.eu/test/'
const team = 'toegangteam0001', officieel = 'toegangbron0001', wachtwoord = 'Fictief-Toegang-Test-123!'
const pub = new PocketBase(base), admin = new PocketBase(base), ander = new PocketBase(base), ouder = new PocketBase(base)
for (const p of [pub,admin,ander,ouder]) p.autoCancellation(false)
const fail = async fn => { try { await fn(); assert.fail('Ten onrechte toegestaan') } catch(e) { assert.ok([400,401,403,404].includes(e.status), `${e.status}: ${e.message}`) } }
await admin.collection('users').authWithPassword('beheer@example.invalid',wachtwoord)
await new Promise(r => setTimeout(r,1600))
await ander.collection('users').authWithPassword('ander@example.invalid',wachtwoord)
const email = 'zelf-aansluiten@example.invalid', naam = 'Demo nieuwe ouder', body = {naam,email,terug,rol:'beheerder'}
const aanvraaglink = `${team}.FictieveTeamlinkMetVoldoendeTekens123`
const beheerMails = async () => (await (await fetch('http://127.0.0.1:8092/api/v1/messages')).json()).messages.filter(m=>m.Subject==='Nieuw lid bij Demo toegangteam0001' && m.To.some(a=>a.Address==='beheer@example.invalid'))
const voorAanmelden = (await beheerMails()).length
await pub.send(`/api/hockey/aanvraag/${aanvraaglink}`,{method:'POST',body})
await pub.send(`/api/hockey/catalogus/omgeving/${team}/aanvraag`,{method:'POST',body})
const aanvragen = await admin.collection('toegangsaanvragen').getFullList({filter:admin.filter('team = {:t}',{t:team})})
assert.equal(aanvragen.length,1); assert.equal(aanvragen[0].status,'toegelaten'); assert.equal(aanvragen[0].automatisch,true); assert.equal(aanvragen[0].gezien,false)
const invs = await admin.collection('uitnodigingen').getFullList({filter:admin.filter('team = {:t}',{t:team})})
assert.equal(invs.length,1);assert.equal(invs[0].rol,'kijker')
// Aanmelden verstuurt uitsluitend de persoonlijke uitnodiging, nog geen beheerdersmail.
const messages = await (await fetch('http://127.0.0.1:8092/api/v1/messages')).json()
const invitation = messages.messages.find(m=>m.To.some(a=>a.Address===email))
assert.ok(invitation)
const mail = await (await fetch(`http://127.0.0.1:8092/api/v1/message/${invitation.ID}`)).json()
const token = mail.HTML.match(/#uitnodiging=([a-zA-Z0-9]+)/)?.[1];assert.ok(token)
assert.equal((await beheerMails()).length,voorAanmelden)
await pub.send(`/api/hockey/uitnodiging/${token}`,{})
await fail(()=>pub.send(`/api/hockey/uitnodiging/${token}`,{method:'POST',body:{wachtwoord:'kort'}}))
assert.equal((await beheerMails()).length,voorAanmelden,'Bekijken of mislukte acceptatie mag geen beheerdersmail sturen')
await fail(()=>pub.collection('spelers').getOne('toegangkind0001'))
await fail(()=>ander.send(`/api/hockey/toegang-id/${aanvragen[0].id}`,{method:'POST',body:{besluit:'blokkeren'}}))
await pub.send(`/api/hockey/uitnodiging/${token}`,{method:'POST',body:{wachtwoord}})
assert.equal((await beheerMails()).length,voorAanmelden+1,'Pas na bevestiging en lidmaatschap één beheerdersmail')
await fail(()=>pub.send(`/api/hockey/uitnodiging/${token}`,{method:'POST',body:{wachtwoord}}))
assert.equal((await beheerMails()).length,voorAanmelden+1,'Dubbele acceptatie mag niet opnieuw mailen')
const bevestiging = (await beheerMails())[0]
const bevestigingsmail = await (await fetch(`http://127.0.0.1:8092/api/v1/message/${bevestiging.ID}`)).json()
assert.ok(bevestigingsmail.HTML.includes('heeft de uitnodiging geaccepteerd en is nu lid'))
await new Promise(r=>setTimeout(r,1600))
await ouder.collection('users').authWithPassword(email,wachtwoord)
assert.equal((await ouder.collection('teams').getOne(team)).beheerders.includes(ouder.authStore.record.id),false)
await ouder.collection('spelers').getOne('toegangkind0001')
await fail(()=>ouder.send(`/api/hockey/teamtoegang/${team}`,{method:'POST',body:{actie:'blokkeren',email:'beheer@example.invalid'}}))
await fail(()=>ander.collection('teamblokkades').create({team,email}))
await admin.send(`/api/hockey/toegang-id/${aanvragen[0].id}`,{method:'POST',body:{besluit:'gezien'}})
assert.equal((await admin.collection('toegangsaanvragen').getOne(aanvragen[0].id)).gezien,true)
const blokkeer = email=>admin.send(`/api/hockey/teamtoegang/${team}`,{method:'POST',body:{actie:'blokkeren',email,naam}})
await blokkeer(email)
await fail(()=>ouder.collection('spelers').getOne('toegangkind0001'))
await fail(()=>ouder.collection('teams').getOne(team))
await fail(()=>pub.send(`/api/hockey/aanvraag/${aanvraaglink}`,{method:'POST',body}))
await fail(()=>pub.send(`/api/hockey/catalogus/omgeving/${team}/aanvraag`,{method:'POST',body}))
await fail(()=>admin.collection('uitnodigingen').create({team,email,rol:'kijker',terug}))
await fail(()=>admin.collection('teams').update(team,{kijkers:[ouder.authStore.record.id]}))
const blocks=await admin.collection('teamblokkades').getFullList();assert.equal(blocks.length,1)
assert.equal((await ander.collection('teamblokkades').getFullList()).length,0)
await fail(()=>ander.send(`/api/hockey/teamtoegang/toegangteam0002`,{method:'POST',body:{actie:'deblokkeren',id:blocks[0].id,terug}}))
await admin.send(`/api/hockey/teamtoegang/${team}`,{method:'POST',body:{actie:'deblokkeren',id:blocks[0].id,terug}})
await ouder.collection('spelers').getOne('toegangkind0001')
assert.equal((await admin.collection('teamblokkades').getFullList()).length,0)
// Nog niet geactiveerde mail wordt ook ingetrokken; deblokkeren levert een nieuwe uitnodiging op.
const pending='nog-niet-geactiveerd@example.invalid'
await pub.send(`/api/hockey/catalogus/omgeving/${team}/aanvraag`,{method:'POST',body:{...body,email:pending}})
const list=await (await fetch('http://127.0.0.1:8092/api/v1/messages')).json()
const pendingMail=list.messages.find(m=>m.To.some(a=>a.Address===pending))
const detail=await (await fetch(`http://127.0.0.1:8092/api/v1/message/${pendingMail.ID}`)).json()
const oldToken=detail.HTML.match(/#uitnodiging=([a-zA-Z0-9]+)/)[1]
await blokkeer(pending)
await fail(()=>pub.send(`/api/hockey/uitnodiging/${oldToken}`,{method:'POST',body:{wachtwoord}}))
const block=(await admin.collection('teamblokkades').getFullList())[0]
await admin.send(`/api/hockey/teamtoegang/${team}`,{method:'POST',body:{actie:'deblokkeren',id:block.id,terug}})
await fail(()=>pub.send(`/api/hockey/uitnodiging/${oldToken}`,{}))
assert.equal((await admin.collection('uitnodigingen').getFullList({filter:admin.filter('email = {:e}',{e:pending})})).length,1)
await fail(()=>blokkeer('beheer@example.invalid'))
assert.ok((await admin.collection('teams').getOne(team)).beheerders.includes(admin.authStore.record.id))
console.log('TEAMTOEGANG_OK: direct uitnodigen, mail en teller, dubbele aanvraag, kijkrechten, blokkeren, oude tokens, beide aanmeldroutes, beheerrechten en deblokkeren')
