import assert from 'node:assert/strict'
import { stempelInkomers, veldKleuren, resetTellers, verplaatsSpelers, pasSpelvormAan } from '../../src/opstelling'
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
assert.ok(resetTellers(welGeteld).every(s => s.wisselCount === 0), 'Reset zet ook bankspelers op nul')
assert.deepEqual(resetTellers(welGeteld).map(({ wisselCount, inVolgorde, ...s }) => s), welGeteld.map(({ wisselCount, inVolgorde, ...s }) => s), 'Reset behoudt spelers, aanwezigheid, positie en keeper')
const verplaatst = verplaatsSpelers(spelers, '4', '6')
assert.equal(verplaatst.find(s => s.id === '6')!.inVolgorde, spelers.find(s => s.id === '4')!.inVolgorde)
// Categorie vergroten haalt bankspelers naar het veld, zonder nieuwe invalkleur.
const ploeg: Player[] = Array.from({ length: 12 }, (_, i) => ({ id: `kind${i}`, naam: `T ${i}`, positie: i === 0 ? 'K' : 'LW', isKeeper: i === 0, inVeld: i === 0, meedoen: true, wisselCount: 4, inVolgorde: i === 0 ? 99 : 0 }))
const klein = pasSpelvormAan(ploeg, '2-1-2')
const groot = stempelInkomers(klein, pasSpelvormAan(klein, '3-4-3'), false)
assert.equal(groot.filter(s => s.inVeld).length, 11)
assert.ok(Object.values(kleuren(groot)).every(k => k === 'groen'))
assert.deepEqual(groot.map(s => s.wisselCount), ploeg.map(s => s.wisselCount))
// Ook een oud positief bankstempel mag niet opnieuw rood worden bij uitbreiden.
const oudeBankkleur = klein.map(s => !s.inVeld ? { ...s, inVolgorde: 50 } : s)
const terug = stempelInkomers(oudeBankkleur, pasSpelvormAan(oudeBankkleur, '3-4-3'), false)
assert.ok(terug.filter(s => s.inVeld && !oudeBankkleur.find(o => o.id === s.id)!.inVeld).every(s => s.inVolgorde === 0))
// Keeper naar een vorm zonder keeper: geen hergebruik van een oud invallersnummer.
const zonderKeeper = stempelInkomers(groot, pasSpelvormAan(groot, 'hockeyzeven-2-3-2'), false)
assert.ok(Object.values(kleuren(zonderKeeper)).every(k => k === 'groen'))
const keeperNaarVeld = stempelInkomers([ploeg[0]], [{ ...ploeg[0], isKeeper: false, positie: 'LW' }], false)
assert.equal(keeperNaarVeld[0].inVolgorde, 0)
// Kleuren van spelers die al op het veld stonden veranderen niet door de normalisatie.
assert.equal(stempelInkomers(welGeteld, welGeteld.map(s => s.id === '4' ? { ...s, inVeld: true } : s), false).find(s => s.id === '6')!.inVolgorde, 51)
console.log('WISSELKLEUREN_OK: invalvolgorde, live-opslag, compatibiliteit zonder klokkeuze, reset/verplaatsen, categorie vergroten, oude bankkleur en keeper naar veld zonder nieuwe kleuren.')
