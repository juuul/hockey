import assert from 'node:assert/strict'
import { berekenVerzamelen, navigatieLink } from '../../src/verzamelen'
const defaults = { voorbereidingMinuten: 30, bufferMinuten: 5 }
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
