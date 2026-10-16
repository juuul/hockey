import assert from 'node:assert/strict'
import { thuisUitBekend, thuisUitTekst } from '../../src/programmaLocatie'
import type { ProgrammaItem } from '../../src/types'
const p = { soort: 'wedstrijd', thuis: true, clubId: '', tegenstander: '' } as ProgrammaItem
assert.equal(thuisUitTekst(p), 'Thuis', 'Handmatige thuiskeuze zonder tegenstander blijft zichtbaar')
assert.equal(thuisUitTekst({ ...p, thuis: false }), 'Uit')
const planning = { ...p, bronPlanning: { id: 'planning:Veld:2026-10-31' } } as ProgrammaItem
assert.equal(thuisUitBekend(planning), false)
assert.equal(thuisUitTekst(planning), 'Thuis/uit nog onbekend')
assert.equal(thuisUitTekst({ ...planning, thuis: false }), 'Thuis/uit nog onbekend', 'Ook zaalregels met false zijn geen bevestigde uitwedstrijden')
assert.equal(thuisUitTekst({ ...planning, bronId: 'bronwedstrijd' }), 'Thuis')
assert.equal(thuisUitTekst({ ...planning, thuis: false, tegenstander: 'Voorbeeldclub' }), 'Uit')
assert.equal(thuisUitTekst({ ...planning, clubId: 'club' }), 'Thuis')
assert.equal(thuisUitBekend({ ...p, soort: 'vrij' }), false)
console.log('PROGRAMMA_LOCATIE_OK: bekende thuis/uit altijd zichtbaar; kalenderdatums niet als thuis/uit voorstellen.')
