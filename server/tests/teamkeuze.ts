import assert from 'node:assert/strict'
import { kiesStartteam } from '../../src/teamkeuze'

const teams = [{ id: 'test', naam: 'Testteam' }, { id: 'echt', naam: 'MO-11-1' }, { id: 'ander', naam: 'MO-12-2' }]
assert.equal(kiesStartteam(teams, null, true), 'echt')
assert.equal(kiesStartteam(teams, 'test', true), 'echt')
assert.equal(kiesStartteam(teams, 'ander', true), 'ander')
assert.equal(kiesStartteam(teams, 'test'), 'test', 'Handmatig gekozen testteam blijft tijdens verversen actief')
assert.equal(kiesStartteam(teams, null), null, 'Zonder team blijft behouden bij meerdere teams')
assert.equal(kiesStartteam(teams, 'verwijderd'), 'echt')
assert.equal(kiesStartteam([], null, true), null)
assert.equal(kiesStartteam([teams[0]], null, true), 'test')
for (const naam of ['Test team', 'Test-team', 'Testteam 2', 'Demo', 'Demoteam', 'Test']) {
  assert.equal(kiesStartteam([{ id: 'test', naam }, teams[1]], null, true), 'echt', naam)
}
assert.equal(kiesStartteam([{ id: 'club', naam: 'Contest HC' }, teams[0]], null, true), 'club')
console.log('TEAMKEUZE_OK: echt team bij inloggen, bestaande echte keuze behouden, handmatige testkeuze behouden, veilige lege/test-only fallback.')
