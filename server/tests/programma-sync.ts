import assert from 'node:assert/strict'
import { perSoort, schoon, synchroniseer, samenvoegen, type Alles } from '../../src/sync'

const basis: Alles = perSoort(() => ({}))
const id = 'voorbeeld123456'
const p = schoon('programma', { id, datum: '2026-10-31', soort: 'wedstrijd', spelen: '09:00', verzamelen: '', tegenstander: 'Voorbeeld MO11-1', thuis: true, bronId: '123', bronBasis: { spelen: '09:00' } })
basis.programma[id] = p
const lokaal: Alles = perSoort(s => ({ ...basis[s] }))
lokaal.programma[id] = { ...p, verzamelen: '08:15' }
const opServer = { ...p, spelen: '09:30', bronBasis: { spelen: '09:30' } }
let patch: Record<string, unknown> = {}
const fake = { filter: () => '', collection: (soort: string) => ({
  update: async (_: string, velden: Record<string, unknown>) => { patch = velden; Object.assign(opServer, velden) },
  getFullList: async () => soort === 'programma' ? [opServer] : [],
}) }
const uit = await synchroniseer(fake as never, 'team', () => lokaal, basis)
assert.deepEqual(patch, { verzamelen: '08:15' })
assert.equal(uit.samengevoegd.programma[id].spelen, '09:30')
assert.equal(uit.samengevoegd.programma[id].verzamelen, '08:15')
const samengevoegd = samenvoegen(lokaal.programma, basis.programma, { [id]: opServer }, new Set(), [], true)
assert.equal(samengevoegd[id].spelen, '09:30')
assert.equal(samengevoegd[id].verzamelen, '08:15')
console.log('Geslaagd: offline verzameltijd aanpassen behoudt een nieuwe officiële aanvangstijd.')
