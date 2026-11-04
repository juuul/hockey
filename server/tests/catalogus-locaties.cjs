// Regressie: een lege teamlocatie mag een bekende officiële locatie niet blijvend blokkeren.
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const sandbox = { module: { exports: {} } }
runInNewContext(readFileSync(require('node:path').join(__dirname, '../pb_hooks/catalogus.js'), 'utf8'), sandbox)
const { synchroniseer } = sandbox.module.exports
class Record {
  constructor(id, data) { this.id = id; this.data = structuredClone(data) }
  getString(k) { const v = this.data[k]; return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '') }
  getBool(k) { return !!this.data[k] }
  set(k, v) { this.data[k] = v }
}
function fixture(eigen = {}) {
  const bron = { datum: '2026-11-07', spelen: '10:00', thuis: false, tegenstander: 'Voorbeeld MO11-4', locatie: 'Sportpark Voorbeeld · Veld 2', locatieAdres: 'Voorbeeldweg 2, 1234AB Voorbeeld' }
  const team = new Record('team', { officieelTeam: 'officieel', planningKalenders: [], bronGenegeerd: [] })
  const officieel = new Record('officieel', { bronId: '100', seizoen: '2026-2027', spelvorm: 'Veld' })
  const w = new Record('bron', { bronId: '200', seizoen: '2026-2027', datum: bron.datum, spelen: bron.spelen, thuisBronId: '101', uitBronId: '100', thuisNaam: bron.tegenstander, uitNaam: 'Eigen MO11-1', locatie: bron.locatie, locatieAdres: bron.locatieAdres, status: 'scheduled' })
  const p = new Record('planning', { ...bron, locatie: '', locatieAdres: '', bronId: '200', bronBasis: bron, bronWijziging: { locatie: bron.locatie, locatieAdres: bron.locatieAdres }, clubId: 'club', soort: 'wedstrijd', fruit: 'kind-a', begeleider1: '-', begeleider2: '-', rijders: ['kind-b', 'kind-c'], notitie: 'Eigen teamafspraak', spelen: '10:15', verzamelen: '09:00', verzamelModus: 'handmatig', ...eigen })
  const club = new Record('club', { team: 'team', naam: bron.tegenstander })
  const app = {
    findRecordById: (collectie, id) => { if (collectie === 'catalogus_teams') return officieel; if (collectie === 'clubs' && id === club.id) return club; throw Error('Niet gevonden') },
    findRecordsByFilter: (collectie) => { assert.equal(collectie, 'catalogus_wedstrijden'); return [w] },
    findFirstRecordByFilter: (collectie) => { assert.equal(collectie, 'programma'); return p },
    save: () => {},
  }
  return { app, team, p, bron, w }
}
const taken = p => Object.fromEntries(['fruit', 'begeleider1', 'begeleider2', 'rijders', 'notitie', 'spelen', 'verzamelen', 'verzamelModus'].map(k => [k, structuredClone(p.data[k])]))
{
  const { app, team, p, bron, w } = fixture()
  const voor = taken(p)
  synchroniseer(app, team)
  assert.equal(p.data.locatie, bron.locatie, 'Lege locatie moet opnieuw uit de officiële bron worden ingevuld')
  assert.equal(p.data.locatieAdres, bron.locatieAdres, 'Ook het navigatieadres moet terugkomen')
  assert.deepEqual(taken(p), voor, 'Taken, notities en eigen tijden blijven behouden')
  assert.deepEqual(JSON.parse(JSON.stringify(p.data.bronWijziging)), { spelen: '10:00' }, 'Geen vals locatieconflict meer, echte tijdafwijking blijft')
  w.set('locatie', 'Sportpark Voorbeeld · Veld 3')
  synchroniseer(app, team)
  assert.equal(p.data.locatie, w.data.locatie, 'Volgende officiële locatie-update blijft werken')
  assert.deepEqual(taken(p), voor)
}
{
  const { app, team, p } = fixture({ locatie: 'Eigen afgesproken accommodatie', locatieAdres: 'Eigenweg 5' })
  synchroniseer(app, team)
  assert.equal(p.data.locatie, 'Eigen afgesproken accommodatie')
  assert.equal(p.data.locatieAdres, 'Eigenweg 5')
  assert.ok(p.data.bronWijziging.locatie)
}
{
  const { app, team, p, bron } = fixture({ locatie: 'Eigen verzamelplek', locatieAdres: '' })
  synchroniseer(app, team)
  assert.equal(p.data.locatie, 'Eigen verzamelplek')
  assert.equal(p.data.locatieAdres, bron.locatieAdres)
}
console.log('CATALOGUS_LOCATIES_OK: lege locaties/adressen herstellen; eigen locaties, tijden en taken blijven; volgende import werkt.')
