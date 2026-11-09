// Vindbaarheid van álle catalogusteams met de echte app-logica (zoeken + filters).
// Invoer: JSON-export van uitsluitend openbare catalogusvelden (zie tests/regressie.py).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clubKomtOvereen, teamKomtOvereen } from '../../src/clubzoeken'
import { TEAMFILTER_VELDEN, teamFilterKeuzes, teamFilterWaarden, teamsMetFilters } from '../../src/teamfilters'

type Team = { id: string; naam: string; clubBronId: string; seizoen: string; geslacht: string; leeftijd: string; spelvorm: string }
type Club = { bronId: string; naam: string; plaats: string }
const { omgeving, clubs, teams } = JSON.parse(readFileSync(process.argv[2], 'utf8')) as { omgeving: string; clubs: Club[]; teams: Team[] }
const perClub = new Map<string, Team[]>()
for (const t of teams.map(teamFilterWaarden)) perClub.set(t.clubBronId, [...(perClub.get(t.clubBronId) || []), t])

const fouten: string[] = []
const fout = (tekst: string) => { if (fouten.length < 25) fouten.push(tekst); else fouten.length === 25 && fouten.push('…') }
let gecontroleerd = 0
for (const [, lijst] of perClub) for (const t of lijst) {
  gecontroleerd++
  // Een herkenbare jeugd-/seniorcode in de naam moet een filterbaar teamtype/leeftijd opleveren.
  if (/(?:^|\s)z?(MO|JO)\d/i.test(t.naam) && (!t.geslacht || !t.leeftijd)) fout(`${t.naam} (${t.spelvorm}): teamtype/leeftijd ontbreekt`)
  const eigen = Object.fromEntries(TEAMFILTER_VELDEN.map(([v]) => [v, t[v]]).filter(([, w]) => w))
  if (!teamsMetFilters(lijst, eigen).includes(t)) fout(`${t.naam}: valt weg bij eigen filters ${JSON.stringify(eigen)}`)
  if (!teamsMetFilters(lijst, {}).filter(x => teamKomtOvereen(x.naam, t.naam)).includes(t)) fout(`${t.naam}: niet te vinden op eigen naam`)
  // Elke eigen waarde moet kiesbaar zijn zodra het filter in beeld is.
  for (const { veld, waarden } of teamFilterKeuzes(lijst, {})) if (t[veld] && !waarden.includes(t[veld])) fout(`${t.naam}: ${veld}=${t[veld]} niet kiesbaar`)
}
for (const c of clubs) if (!clubKomtOvereen(c.naam, c.plaats, c.naam)) fout(`Club ${c.naam} niet te vinden op eigen naam`)

// Vaste gevallen die eerder misgingen of vaak gebruikt worden.
const schc = clubs.find(c => c.naam === 'SCHC')
assert.ok(schc, 'SCHC staat in de catalogus')
assert.ok(clubs.filter(c => clubKomtOvereen(c.naam, c.plaats, 'sc')).includes(schc), '"sc" vindt SCHC')
const schcTeams = perClub.get(schc.bronId) || []
const zaal = schcTeams.filter(t => t.spelvorm === 'Zaal')
if (zaal.length) {
  const gevonden = teamsMetFilters(schcTeams, { geslacht: 'Meisjes / dames', leeftijd: 'O11', spelvorm: 'Zaal' }).map(t => t.naam)
  assert.ok(gevonden.some(n => /zMO11/i.test(n)), `Meisjes + O11 + Zaal vindt zMO11 bij SCHC (gevonden: ${gevonden.join(', ') || 'niets'})`)
  assert.ok(schcTeams.filter(t => teamKomtOvereen(t.naam, 'zmo')).length > 0, '"zmo" vindt zaalteams')
}
assert.deepEqual(fouten, [], `${fouten.length} vindbaarheidsfouten:\n${fouten.join('\n')}`)
console.log(`CATALOGUS_VINDBAAR_OK (${omgeving}): ${clubs.length} clubs, ${gecontroleerd} teams (${teams.filter(t => t.spelvorm === 'Zaal').length} zaal) vindbaar op naam en filters; SCHC Meisjes+O11+Zaal ${zaal.length ? 'gecontroleerd' : 'n.v.t. (geen zaalteams)'}.`)
