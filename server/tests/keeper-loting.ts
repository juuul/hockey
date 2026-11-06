import assert from 'node:assert/strict'
import { nieuweOpstelling } from '../../src/opstelling'
import { SPELVORMEN, OPSTELLINGEN_PER_SPELVORM, veldPosities, heeftKeeper, aantalSpelers, type Player } from '../../src/types'
const speler = (id: string, extra: Partial<Player> = {}): Player => ({ id, naam: `T ${id}`, positie: 'LW', meedoen: true, isKeeper: false, inVeld: false, wisselCount: 2, ...extra })
const spelers = Array.from({ length: 13 }, (_, i) => speler(String(i), i === 0 ? { isKeeper: true, positie: 'K', inVeld: true } : {}))
const veld = veldPosities('3-4-3')
const keeper = (ps: Player[]) => ps.filter(s => s.isKeeper)
const origineel = structuredClone(spelers)
assert.equal(keeper(nieuweOpstelling(spelers, { '1': ['K', 'LW'] }, veld))[0].id, '1', 'Een keepervoorkeur vervangt de huidige keeper')
assert.equal(keeper(nieuweOpstelling(spelers, { '1': ['LW', 'K'] }, veld))[0].id, '1', 'Tweede voorkeur wordt gebruikt zonder eerste keepervoorkeur')
assert.equal(keeper(nieuweOpstelling(spelers, { '1': ['LW', 'K'], '2': ['K', ''] }, veld))[0].id, '2', 'Eerste keepervoorkeur gaat voor tweede')
assert.equal(keeper(nieuweOpstelling(spelers, {}, veld))[0].id, '0', 'Zonder keepervoorkeur blijft de huidige aanwezige keeper staan')
const afwezig = spelers.map(s => ['0', '1'].includes(s.id) ? { ...s, meedoen: false } : s)
assert.equal(keeper(nieuweOpstelling(afwezig, { '1': ['K'], '2': ['', 'K'] }, veld))[0].id, '2')
assert.ok(nieuweOpstelling(afwezig, {}, veld).filter(s => !s.meedoen).every(s => !s.inVeld && !s.isKeeper))
assert.equal(keeper(nieuweOpstelling(spelers.map(s => ({ ...s, isKeeper: false })), {}, veld)).length, 1, 'Ook een leeg doel wordt bij loting gevuld')
const random = Math.random
try {
 const winnaars = new Set<string>()
 for (const getal of [0, 0.99999]) {
  Math.random = () => getal
  winnaars.add(keeper(nieuweOpstelling(spelers, { '0': ['K'], '1': ['K'] }, veld))[0].id)
 }
 assert.deepEqual([...winnaars].sort(), ['0', '1'], 'Beide gelijkwaardige keeperkandidaten kunnen winnen')
 // Vaste seeds, geen kansafhankelijke grenswaarden: controleer alle spelvormen en aantallen.
 for (let seed = 1; seed <= 30; seed++) {
  let toestand = seed
  Math.random = () => ((toestand = (toestand * 1664525 + 1013904223) >>> 0) / 4294967296)
  for (const vorm of SPELVORMEN) {
   const pos = veldPosities(OPSTELLINGEN_PER_SPELVORM[vorm][0])
   for (const n of [0, 1, 4, 13]) {
    const inlijst = spelers.slice(0, n)
    const uit = nieuweOpstelling(inlijst, { '1': ['K', pos[0]], '2': [pos[0], 'K'] }, pos, heeftKeeper(vorm))
    assert.equal(uit.length, n)
    assert.equal(keeper(uit).length, heeftKeeper(vorm) && n ? 1 : 0)
    assert.equal(uit.filter(s => s.inVeld).length, Math.min(n, aantalSpelers(vorm)))
    const veldspelers = uit.filter(s => s.inVeld && !s.isKeeper)
    assert.ok(veldspelers.every(s => pos.includes(s.positie)))
    assert.equal(new Set(veldspelers.map(s => s.positie)).size, veldspelers.length)
    assert.ok(keeper(uit).every(s => s.positie === 'K' && s.inVeld && s.meedoen))
    assert.ok(uit.every(s => s.wisselCount === 2), 'Opnieuw loten verandert geen tellers')
   }
  }
 }
} finally { Math.random = random }
const klein = [speler('doel'), speler('voor'), speler('achter')]
const gezet = nieuweOpstelling(klein, { doel: ['K'], voor: ['LW'], achter: ['RBM'] }, veld)
assert.equal(gezet.find(s => s.id === 'voor')?.positie, 'LW')
assert.equal(gezet.find(s => s.id === 'achter')?.positie, 'RBM')
assert.deepEqual(spelers, origineel, 'Loting wijzigt de bronlijst niet')
console.log('KEEPER_LOTING_OK: eerste/tweede voorkeur, gelijke kansen, huidige keeper/lege doel als terugval, afwezigen, alle veld-/zaalvormen, zonder keeper, korte/lege rosters, unieke posities, tellers en veldvoorkeuren.')
