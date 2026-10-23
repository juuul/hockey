import assert from 'node:assert/strict'
import { OPSTELLINGEN_PER_SPELVORM, SPELVORMEN, aantalSpelers, heeftKeeper, leesOpstelling, spelvormVan, veldPosities, type Player } from '../../src/types'
import { schemaVoor, faseVan, wedstrijdDuur } from '../../src/speelduur'
import { pasSpelvormAan } from '../../src/opstelling'
import { maakStand } from '../../src/live'
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
console.log('SPELVORMEN_OK: aantallen, keeper, zaalduur/rust, wissels, klokstop, omschakelen en live opslag')
