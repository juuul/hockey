import assert from 'node:assert/strict'
import { verzamelKeuze } from '../../src/verzamelkeuze'
import type { ProgrammaItem } from '../../src/types'
const p = { datum: '2026-10-31', verzamelen: '09:10', verzamelModus: 'handmatig' } as ProgrammaItem
assert.deepEqual(verzamelKeuze(p, { tijd: '09:55', datum: p.datum }), { verzamelen: '09:10', verzamelDatum: p.datum, verzamelModus: 'handmatig' })
assert.deepEqual(verzamelKeuze({ ...p, verzamelDatum: '2026-10-30' }, null), { verzamelen: '09:10', verzamelDatum: '2026-10-30', verzamelModus: 'handmatig' })
assert.deepEqual(verzamelKeuze({ ...p, verzamelen: '' }, null), { verzamelen: '', verzamelDatum: '', verzamelModus: 'handmatig' })
assert.deepEqual(verzamelKeuze({ ...p, verzamelModus: 'automatisch' }, { tijd: '09:55', datum: p.datum }), { verzamelen: '09:55', verzamelDatum: p.datum, verzamelModus: 'automatisch' })
assert.deepEqual(verzamelKeuze({ ...p, verzamelModus: 'automatisch' }, null), { verzamelen: '', verzamelDatum: '', verzamelModus: 'automatisch' })
console.log('VERZAMELKEUZE_OK: eigen tijd/dag, lege keuze, automatisch herstel en ontbrekende schatting.')
