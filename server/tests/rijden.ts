import assert from 'node:assert/strict'
import { autoPlekken, rijdenTekst } from '../../src/rijden'
import { schoon, samenvoegen } from '../../src/sync'
const uit = { thuis: false, soort: 'wedstrijd' as const }
for (const [kinderen, autos] of [[0, 0], [1, 1], [4, 1], [5, 2], [8, 2], [9, 3], [11, 3], [13, 4]]) {
  assert.deepEqual(autoPlekken(uit, kinderen), Array(autos).fill(''))
}
assert.deepEqual(autoPlekken({ ...uit, thuis: true, rijders: ['ouder'] }, 13), [])
assert.deepEqual(autoPlekken({ ...uit, soort: 'vrij' }, 13), [])
assert.deepEqual(autoPlekken({ ...uit, rijders: ['a', '', '-'] }, 13), ['a', '', '', ''])
assert.deepEqual(autoPlekken({ ...uit, rijders: ['-', '-', 'ouder'] }, 4), ['', '', 'ouder'])
assert.equal(rijdenTekst(['a', '-', ''], id => id === 'a' ? 'Voorbeeld' : ''), 'auto 1: ouder Voorbeeld · auto 2: nog te bepalen · auto 3: nog te bepalen')
const oud = schoon('programma', { id: 'p' })
assert.deepEqual(oud.rijders, [])
const lokaal = schoon('programma', { id: 'p', rijders: ['a', '-', ''] })
const server = schoon('programma', { id: 'p', spelen: '10:30' })
const samen = samenvoegen({ p: lokaal }, { p: oud }, { p: server }, new Set(), [], true).p
assert.deepEqual(samen.rijders, ['a', '-', ''])
assert.equal(samen.spelen, '10:30')
console.log('RIJDEN_OK: afronden per 4, thuis/vrij nul, nog te bepalen inclusief oud n.v.t., bestaande ouders behouden, tekst en sync met bronwijzigingen.')
