import assert from 'node:assert/strict'
import { OPSTELLINGEN, OPSTELLINGEN_PER_SPELVORM, opstellingTekst, SPELVORMEN, aantalSpelers, heeftKeeper, leesOpstelling, spelvormVan, veldPosities, type Player } from '../../src/types'
import { schemaVoor, faseVan, wedstrijdDuur } from '../../src/speelduur'
import { pasSpelvormAan } from '../../src/opstelling'
import { maakStand } from '../../src/live'
import { linieVan } from '../../src/speeltijd'
for (const vorm of SPELVORMEN) {
 for (const naam of OPSTELLINGEN_PER_SPELVORM[vorm]) {
  assert.equal(spelvormVan(naam),vorm);assert.equal(leesOpstelling(naam),naam)
  assert.equal(new Set(veldPosities(naam)).size,veldPosities(naam).length)
  assert.equal(veldPosities(naam).length+(heeftKeeper(vorm)?1:0),aantalSpelers(vorm))
 }
 const schema=schemaVoor(vorm);assert.equal(faseVan(wedstrijdDuur(schema),schema).deel,null)
}
assert.equal(schemaVoor('zaaljeugd6')[0].lengte,15*60000)
assert.equal(schemaVoor('zaaljeugd6')[1].lengte,3*60000)
assert.equal(schemaVoor('zaal6')[0].lengte,20*60000)
assert.equal(wedstrijdDuur(schemaVoor('hockey7')),25*60000)
const spelers:Player[]=Array.from({length:12},(_,i)=>({id:String(i),naam:'Test '+i,positie:i===0?'K':'CM',isKeeper:i===0,inVeld:i===0,meedoen:true,wisselCount:0}))
const klein=pasSpelvormAan(spelers,'mini-1-2');assert.equal(klein.length,12);assert.ok(klein.every(p=>!p.isKeeper));assert.equal(klein.filter(p=>p.inVeld).length,3)
const zaal=pasSpelvormAan(spelers,'zaal-2-1-2');assert.equal(zaal.filter(p=>p.inVeld).length,6);assert.equal(zaal.filter(p=>p.isKeeper).length,1)
const stand=maakStand({spelers:{},wisselingen:[],score:{wij:0,zij:0},doelpunten:[],opstelling:'zaal-2-1-2',timer:{gestartOp:null,opgebouwd:0},wedstrijd:{datum:null,clubId:null,thuis:true}})
assert.equal(leesOpstelling(JSON.parse(JSON.stringify(stand)).opstelling),'zaal-2-1-2')
const o11=pasSpelvormAan(spelers,'1-3-3-1')
assert.deepEqual(OPSTELLINGEN['1-3-3-1'].map(r=>r.length),[1,3,3,1])
assert.equal(opstellingTekst('1-3-3-1'),'1-3-3-1')
assert.equal(o11.filter(s=>s.inVeld).length,9)
assert.equal(o11.filter(s=>s.isKeeper).length,1)
assert.equal(o11.filter(s=>s.inVeld&&s.positie==='LIB').length,1)
assert.equal(linieVan(o11.find(s=>s.positie==='LIB')!),'v')
assert.ok(o11.every(s=>s.wisselCount===0))
assert.ok(!OPSTELLINGEN_PER_SPELVORM[6].includes('1-3-3-1'))
assert.ok(!OPSTELLINGEN_PER_SPELVORM.zaal6.includes('1-3-3-1'))
assert.equal(leesOpstelling(JSON.parse(JSON.stringify(maakStand({...stand,opstelling:'1-3-3-1'}))).opstelling),'1-3-3-1')
console.log('SPELVORMEN_OK: aantallen, keeper, zaalduur/rust, wissels, klokstop, omschakelen en live opslag')
