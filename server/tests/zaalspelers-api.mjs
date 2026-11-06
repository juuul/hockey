// Uitsluitend de geïsoleerde fictieve zaal-fixture op 8099, geen productieaccounts/mail.
import assert from 'node:assert/strict'
import PocketBase from 'pocketbase'
const p=new PocketBase('http://127.0.0.1:8099');p.autoCancellation(false)
await p.collection('users').authWithPassword('zaal-fictief@example.invalid','Fictief-Zaal-123456!')
assert.equal(p.authStore.record.id,'zzqa00000000001');assert.equal(p.authStore.record.verified,false)
const maak=officieelTeam=>p.send('/api/hockey/catalogus/omgeving',{method:'POST',body:{officieelTeam}})
await assert.rejects(()=>maak('zzqa00000000004'),e=>e.status===401)
await p.send('/api/hockey/uitnodiging/FictieveZaalUitnodiging12345678901234567890',{method:'POST',body:{}})
await p.collection('users').authRefresh();assert.equal(p.authStore.record.verified,true)
const spelers=team=>p.collection('spelers').getFullList({filter:p.filter('team = {:team}',{team}),sort:'naam'})
const bron=await spelers('zzqa00000000002')
const vergelijk=async team=>{
 const zaal=await spelers(team);assert.equal(zaal.length,2)
 assert.deepEqual(zaal.map(s=>[s.naam,s.voorkeur1,s.voorkeur2]),bron.map(s=>[s.naam,s.voorkeur1,s.voorkeur2]))
 assert.ok(zaal.every(s=>!bron.some(b=>b.id===s.id)))
}
await vergelijk('zzqa00000000006')
const r=await maak('zzqa00000000004');assert.equal(r.spelersOvername.aantal,2);await vergelijk(r.id)
const veld=await maak('zzqa00000000003');assert.equal(veld.spelersOvername.aantal,0)
const dubbel=await maak('zzqa00000000004');assert.equal(dubbel.spelersOvername.status,'meerdere-veldteams');assert.equal((await spelers(dubbel.id)).length,0)
assert.deepEqual(await spelers('zzqa00000000002'),bron)
console.log('ZAALSPELERS_API_OK: echte PocketBase-routes; onbevestigd geblokkeerd, uitnodiging bevestigt bestaand account en kopieert, nieuw zaalteam kopieert namen/voorkeuren met nieuwe IDs; veldteam/dubbelzinnige bron niet gekopieerd; bron intact.')
