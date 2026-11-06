// Alleen de geïsoleerde fictieve fixture op localhost:8099. Geen echte leden of mails.
import assert from 'node:assert/strict'
import PocketBase from 'pocketbase'
const base='http://127.0.0.1:8099', pub=new PocketBase(base)
const clients=[]
for(let n=1;n<=3;n++){
 const p=new PocketBase(base);p.autoCancellation(false)
 await p.collection('users').authWithPassword(`verlaten${n}@example.invalid`,'Fictief-Verlaten-123!')
 assert.equal(p.authStore.record.id,`verlaatuser000${n}`);clients.push(p)
 if(n<3)await new Promise(r=>setTimeout(r,1600))
}
const [een,twee,kijker]=clients
const verlaten=(p,id)=>p.send(`/api/hockey/team/${id}/verlaten`,{method:'POST',body:{user:'verlaatuser0002'}})
const fout=(fn,status)=>assert.rejects(fn,e=>status.includes(e.status))
const bron=await twee.collection('spelers').getOne('verlaatkind0001')
const solo=await een.collection('teams').getOne('verlaatteam0002')
const ander=await twee.collection('teams').getOne('verlaatteam0003')
await fout(()=>verlaten(pub,'verlaatteam0001'),[401])
await fout(()=>verlaten(een,'verlaatteam0003'),[403])
await fout(()=>verlaten(een,'verlaatteam0002'),[400])
assert.deepEqual(await een.collection('teams').getOne(solo.id),solo)
assert.deepEqual(await twee.collection('teams').getOne(ander.id),ander)
await verlaten(kijker,'verlaatteam0001')
await fout(()=>kijker.collection('teams').getOne('verlaatteam0001'),[403,404])
let t=await twee.collection('teams').getOne('verlaatteam0001')
assert.deepEqual(t.beheerders,['verlaatuser0001','verlaatuser0002']);assert.deepEqual(t.kijkers,[])
await verlaten(een,'verlaatteam0001')
await fout(()=>een.collection('teams').getOne('verlaatteam0001'),[403,404])
t=await twee.collection('teams').getOne('verlaatteam0001');assert.deepEqual(t.beheerders,['verlaatuser0002'])
await fout(()=>verlaten(twee,'verlaatteam0001'),[400])
assert.deepEqual(await twee.collection('spelers').getOne('verlaatkind0001'),bron)
await fout(()=>kijker.collection('spelers').getOne('verlaatkind0001'),[403,404])
console.log('TEAM_VERLATEN_API_OK: eigen kijker-/beheerlidmaatschap opzeggen, geen keuze van andere gebruiker via body, directe intrekking toegang, laatste beheerder/ander team/anoniem geweigerd, spelers en andere teams intact.')
