import assert from 'node:assert/strict'
import { programmaBronLink, programmaAfwijkingen } from '../../src/programmaBron'
assert.equal(programmaBronLink({ bronId: '46179', pouleId: '183769' }), 'https://www.hockey.nl/match-center#/team/46179|183769/program')
assert.equal(programmaBronLink({ bronId: '123', pouleId: '456' }), 'https://www.hockey.nl/match-center#/team/123|456/program')
for (const t of [undefined, null, { bronId: '46179' }, { bronId: '', pouleId: '1' }, { bronId: '46179', pouleId: '' }, { bronId: 'javascript:1', pouleId: '2' }, { bronId: '1', pouleId: '2/program#3' }]) assert.equal(programmaBronLink(t), null)
console.log('PROGRAMMA_BRON_OK: directe teamlink, ander team en ontbrekende/ongeldige ids zonder terugval naar verkeerde bron.')

const planning = { spelen: '10:00', thuis: true, locatie: 'Veld 2', bronWijziging: { spelen: '10:15', thuis: false, locatie: 'Veld 2' } } as import('../../src/types').ProgrammaItem
assert.deepEqual(programmaAfwijkingen(planning).map(v => v.tekst), [
  'Aanvang: in de app 10:00; hockey.nl 10:15.',
  'Thuis/uit: in de app Thuis; hockey.nl Uit.',
], 'Benoem wat verschilt en toon beide waarden; gelijke locatie geeft geen melding')
assert.deepEqual(programmaAfwijkingen({ ...planning, spelen: '10:15', thuis: false }), [], 'Na herstellen geen achterhaalde melding')
assert.deepEqual(programmaAfwijkingen({ ...planning, bronWijziging: null }), [], 'Geen melding zonder verschillen')
assert.deepEqual(programmaAfwijkingen({ ...planning, bronWijziging: { spelen: '' } }).map(v => v.tekst), ['Aanvang: in de app 10:00; hockey.nl niet bekend.'])
console.log('PROGRAMMA_AFWIJKING_OK: concrete waarden, thuis/uit, onbekende bron en geen melding na herstel.')
