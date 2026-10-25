import assert from 'node:assert/strict'
import { tijdWaarde, tijdenGeldig, officieleAanvang } from '../../src/tijdinvoer'
import type { ProgrammaItem } from '../../src/types'
for (const [invoer, uit] of [['9:5', '09:05'], ['23:59', '23:59'], ['', ''], ['24:00', null], ['12:', null], [':30', null], ['12:70', null], ['a:30', null]]) assert.equal(tijdWaarde(invoer!), uit)
const p = { soort: 'wedstrijd', spelen: '9:5', verzamelen: '8:30', verzamelModus: 'handmatig', bronId: '123', bronBasis: { spelen: '10:30' } } as ProgrammaItem
assert.equal(tijdenGeldig(p), true)
assert.equal(tijdenGeldig({ ...p, spelen: '25:30' }), false)
assert.equal(tijdenGeldig({ ...p, verzamelen: '12:' }), false)
assert.equal(officieleAanvang(p), '10:30')
assert.equal(officieleAanvang({ ...p, bronWijziging: { spelen: '11:30' } }), '11:30')
assert.equal(officieleAanvang({ ...p, bronWijziging: { spelen: '' } }), '')
assert.equal(officieleAanvang({ ...p, bronId: '', bronBasis: null }), null)
console.log('TIJDINVOER_OK: losse uur/minuut, validatie, actuele brontijd heeft voorrang, onbekend blijft onbekend.')
