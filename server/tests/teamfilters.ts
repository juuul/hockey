import assert from 'node:assert/strict'
import { teamFilterWaarden } from '../../src/teamfilters'
for (const naam of ['SCHC zMO11-1', 'SCHC zMO11-2', 'zMO11-1', 'BHV Push zMO11-1', 'SCHC MO11-1', 'SCHC ZMO11-1']) {
  const t = teamFilterWaarden({ naam, geslacht: '', leeftijd: '' })
  assert.equal(t.geslacht, 'Meisjes / dames', naam)
  assert.equal(t.leeftijd, 'O11', naam)
  assert.equal(t.naam, naam)
}
for (const [naam, geslacht, leeftijd] of [['SCHC zJO11-1', 'Jongens / heren', 'O11'], ['SCHC zD1', 'Meisjes / dames', ''], ['SCHC zH1', 'Jongens / heren', ''], ['Voorbeeld zMIXO11-1', 'Gemengd', 'O11'], ['Voorbeeld zG1', 'Gemengd', '']]) {
  const t = teamFilterWaarden({ naam })
  assert.equal(t.geslacht, geslacht, naam); assert.equal(t.leeftijd, leeftijd, naam)
}
const officieel = { naam: 'Voorbeeld zMO11-1', geslacht: 'Gemengd', leeftijd: 'O12', spelvorm: 'Zaal', pouleId: '123' }
assert.deepEqual(teamFilterWaarden(officieel), officieel, 'Ingevulde brongegevens hebben voorrang')
for (const naam of ['Meisjesvereniging', 'Hockeyclub Damesvrienden', 'Clubnaam']) {
  assert.equal(teamFilterWaarden({ naam }).geslacht, '', 'Geen teamtype gokken uit een clubnaam')
}
console.log('TEAMFILTERS_OK: zaal-/veldnaam, MO/JO/senioren/gemengd, leeftijd, oude lege metadata en behoud officiële waarden.')
