import assert from 'node:assert/strict'
import { programmaBronLink } from '../../src/programmaBron'
assert.equal(programmaBronLink({ bronId: '46179', pouleId: '183769' }), 'https://www.hockey.nl/match-center#/team/46179|183769/program')
assert.equal(programmaBronLink({ bronId: '123', pouleId: '456' }), 'https://www.hockey.nl/match-center#/team/123|456/program')
for (const t of [undefined, null, { bronId: '46179' }, { bronId: '', pouleId: '1' }, { bronId: '46179', pouleId: '' }, { bronId: 'javascript:1', pouleId: '2' }, { bronId: '1', pouleId: '2/program#3' }]) assert.equal(programmaBronLink(t), null)
console.log('PROGRAMMA_BRON_OK: directe teamlink, ander team en ontbrekende/ongeldige ids zonder terugval naar verkeerde bron.')
