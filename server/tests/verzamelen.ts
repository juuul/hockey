import assert from 'node:assert/strict'
import { berekenVerzamelen, navigatieLink } from '../../src/verzamelen'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const defaults = { voorbereidingMinuten: 30, bufferMinuten: 5 }
const sandbox = { module: { exports: {} as { bereken: (datum: string, tijd: string, reis: number, opties: typeof defaults) => string | null } } }
runInNewContext(readFileSync('server/pb_hooks/verzamelen.js', 'utf8'), sandbox)
const backend = sandbox.module.exports.bereken
for (let minuut = 0; minuut < 60; minuut++) {
  const tijd = `12:${String(minuut).padStart(2, '0')}`
  const verwacht = `12:${String(Math.floor(minuut / 5) * 5).padStart(2, '0')}`
  const instellingen = { voorbereidingMinuten: 0, bufferMinuten: 0 }
  assert.deepEqual(berekenVerzamelen('2026-10-31', tijd, 0, instellingen), { datum: '2026-10-31', tijd: verwacht })
  assert.equal(backend('2026-10-31', tijd, 0, instellingen), `2026-10-31T${verwacht}:00.000Z`)
}
assert.deepEqual(berekenVerzamelen('2026-10-31','10:32',0,defaults), { datum: '2026-10-31', tijd: '09:55' }, '09:57 wordt 09:55')
assert.deepEqual(berekenVerzamelen('2027-01-01','00:00',1,{ voorbereidingMinuten:0,bufferMinuten:0 }), { datum:'2026-12-31', tijd:'23:55' })
assert.equal(backend('2027-01-01','00:00',1,{ voorbereidingMinuten:0,bufferMinuten:0 }), '2026-12-31T23:55:00.000Z')
assert.deepEqual(berekenVerzamelen('2026-10-31','10:30',35,defaults),{datum:'2026-10-31',tijd:'09:20'})
assert.deepEqual(berekenVerzamelen('2026-10-31','10:30',0,defaults),{datum:'2026-10-31',tijd:'09:55'})
assert.deepEqual(berekenVerzamelen('2027-01-01','00:10',35,defaults),{datum:'2026-12-31',tijd:'23:00'})
assert.deepEqual(berekenVerzamelen('2026-10-31','10:30',0,{voorbereidingMinuten:0,bufferMinuten:0}),{datum:'2026-10-31',tijd:'10:30'})
for (const v of [-1,NaN,Infinity,1.5,1441]) assert.equal(berekenVerzamelen('2026-10-31','10:30',v,defaults),null)
assert.equal(berekenVerzamelen('2026-02-30','10:30',35,defaults),null)
assert.equal(berekenVerzamelen('2026-10-31','24:30',35,defaults),null)
const url=new URL(navigatieLink("Club & veld, Côte d'Azur 1"))
assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('destination'),"Club & veld, Côte d'Azur 1");assert.equal(url.searchParams.get('api'),'1')
console.log('Verzameltijden gecontroleerd: standaard, eigen waarden, nul, vorige dag, ongeldige invoer en navigatielinks.')
