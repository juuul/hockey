import assert from 'node:assert/strict'
import { stempelInkomers, veldKleuren, resetTellers, verplaatsSpelers } from '../../src/opstelling'
import { maakStand, spelersStand, spelersMetStand } from '../../src/live'
import type { Player } from '../../src/types'

const spelers: Player[] = Array.from({ length: 7 }, (_, i) => ({
  id: String(i), naam: `Test ${i}`, positie: 'LW', inVeld: i < 6, meedoen: true,
  isKeeper: false, wisselCount: 2, inVolgorde: i < 5 ? i : 50,
}))
const wissel = (tellen: boolean) => stempelInkomers(spelers, spelers.map(s => s.id === '6' ? { ...s, inVeld: true } : s.id === '4' ? { ...s, inVeld: false } : s), tellen)
const kleuren = (lijst: Player[]) => veldKleuren(lijst.filter(s => s.inVeld && !s.isKeeper))
assert.equal(kleuren(spelers)['4'], 'rood')
assert.equal(kleuren(spelers)['0'], 'groen')
const nietGeteld = wissel(false)
assert.equal(nietGeteld.find(s => s.id === '6')!.inVolgorde, 0)
assert.equal(kleuren(nietGeteld)['6'], 'groen')
assert.equal(kleuren(nietGeteld)['0'], 'groen')
assert.deepEqual(nietGeteld.map(s => s.wisselCount), spelers.map(s => s.wisselCount))
const welGeteld = wissel(true)
assert.equal(welGeteld.find(s => s.id === '6')!.inVolgorde, 51)
assert.equal(kleuren(welGeteld)['6'], 'rood')
assert.deepEqual(stempelInkomers(spelers, welGeteld), welGeteld)
// Ook zonder oude markering komt een niet-meetellende invaller groen binnen.
const zonderMarkering = spelers.map(s => s.id === '6' ? { ...s, inVolgorde: undefined } : s)
assert.equal(kleuren(stempelInkomers(zonderMarkering, wissel(false), false))['6'], 'groen')
// Bestaande live-opslag bevat inVolgorde al: 0 blijft op een ander toestel groen.
const stand = maakStand({ spelers: spelersStand(nietGeteld), wisselingen: [], score: { wij: 0, zij: 0 }, doelpunten: [], opstelling: '3-4-3', timer: { gestartOp: null, opgebouwd: 0 }, wedstrijd: { datum: null, clubId: null, thuis: true }, wisselsAltijdTellen: false })
assert.equal(stand.wisselsAltijdTellen, true, 'Oude klokafhankelijke keuze wordt niet overgenomen')
assert.equal(kleuren(spelersMetStand(spelers, stand.spelers))['6'], 'groen')
assert.ok(Object.values(kleuren(resetTellers(welGeteld))).every(k => k === 'groen'))
const verplaatst = verplaatsSpelers(spelers, '4', '6')
assert.equal(verplaatst.find(s => s.id === '6')!.inVolgorde, spelers.find(s => s.id === '4')!.inVolgorde)
console.log('WISSELKLEUREN_OK: invalvolgorde, live-opslag, compatibiliteit zonder klokkeuze, reset en verplaatsen.')
