// Alleen geïsoleerde localhost-QA met catalogus-herstel.pb.js; geen echte bron of e-mail.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
const base='http://127.0.0.1:8099/api/hockey/catalogus/club/herstelclub0001'
const status=async()=> (await fetch(base+'/status')).json()
const pb=(...args)=>execFileSync('docker',['exec','hockey-clubherstel-qa','/pb/pocketbase',...args],{encoding:'utf8'})
execFileSync('docker',['exec','hockey-clubherstel-qa','sh','-c','test "$HOCKEY_ENV" = test'])
let data=await status()
assert.deepEqual(Object.keys(data).sort(),['gecontroleerd','opnieuwNa','status'])
assert.equal(data.status,'fout');assert.equal(data.opnieuwNa,'2099-01-01T21:46:00.000Z')
for(let i=0;i<2;i++) assert.equal((await fetch(base+'/ververs',{method:'POST'})).status,200)
assert.deepEqual(await status(),data,'Een dubbele klik mag de bronpauze niet resetten')
const snapshot='/tmp/hockey-clubherstel-qa-20261031/planning/catalogus-status.json'
fs.writeFileSync(snapshot,JSON.stringify({bronOpnieuwNa:'2099-01-02T21:46:00Z'}))
assert.equal((await status()).opnieuwNa,'2099-01-02T21:46:00.000Z','Ook de gedeelde pauze is zichtbaar')
pb('catalogus-taakstatus','hersteltaak0001','bezig')
assert.equal((await status()).status,'bezig')
pb('catalogus-taakstatus','hersteltaak0001','fout','2099-01-03T21:46:00Z')
assert.equal((await status()).opnieuwNa,'2099-01-03T21:46:00.000Z')
execFileSync('docker',['exec','-i','hockey-clubherstel-qa','sh','-c','cat > /tmp/clubimport.json'],{input:JSON.stringify({clubs:[],teams:[],wedstrijden:[],taakId:'hersteltaak0001'})})
assert.ok(pb('catalogus-import','/tmp/clubimport.json').includes('Catalogus bijgewerkt'))
data=await status();assert.equal(data.status,'klaar');assert.equal(data.opnieuwNa,null)
const teams=await (await fetch('http://127.0.0.1:8099/api/collections/catalogus_teams/records')).json()
assert.equal(teams.items.length,1,'Een lege import wist bestaande teams niet')
console.log('CLUBHERSTEL_API_OK: veilige status, dubbele klik, gedeelde pauze, statusovergangen, succes en behouden teams')
