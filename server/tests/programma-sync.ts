import assert from 'node:assert/strict'
import { perSoort, schoon, synchroniseer, samenvoegen, type Alles } from '../../src/sync'

const basis: Alles = perSoort(() => ({}))
const id = 'voorbeeld123456'
const p = schoon('programma', { id, datum: '2026-10-31', soort: 'wedstrijd', spelen: '09:00', verzamelen: '', tegenstander: 'Voorbeeld MO11-1', thuis: true, bronId: '123', bronBasis: { spelen: '09:00' } })
basis.programma[id] = p
const lokaal: Alles = perSoort(s => ({ ...basis[s] }))
lokaal.programma[id] = { ...p, verzamelen: '08:15' }
const opServer = { ...p, spelen: '09:30', bronBasis: { spelen: '09:30' } }
let patch: Record<string, unknown> = {}
const fake = { filter: () => '', collection: (soort: string) => ({
  update: async (_: string, velden: Record<string, unknown>) => { patch = velden; Object.assign(opServer, velden) },
  getFullList: async () => soort === 'programma' ? [opServer] : [],
}) }
const uit = await synchroniseer(fake as never, 'team', () => lokaal, basis)
assert.deepEqual(patch, { verzamelen: '08:15' })
assert.equal(uit.samengevoegd.programma[id].spelen, '09:30')
assert.equal(uit.samengevoegd.programma[id].verzamelen, '08:15')
const samengevoegd = samenvoegen(lokaal.programma, basis.programma, { [id]: opServer }, new Set(), [], true)
assert.equal(samengevoegd[id].spelen, '09:30')
assert.equal(samengevoegd[id].verzamelen, '08:15')
console.log('Geslaagd: offline verzameltijd aanpassen behoudt een nieuwe officiële aanvangstijd.')

// Een oude lokale kopie kent de later toegevoegde locatievelden niet.
// Een eigen taak/notitie wijzigen mag die velden niet leeg naar de server sturen.
const metLocatie = schoon('programma', { ...p, locatie: 'Sportpark Voorbeeld · Veld 2', locatieAdres: 'Voorbeeldweg 2', bronBasis: { spelen: '09:00', locatie: 'Sportpark Voorbeeld · Veld 2', locatieAdres: 'Voorbeeldweg 2' } })
const oudeKopie = { ...metLocatie, notitie: 'Eigen teamafspraak' }
delete oudeKopie.locatie
delete oudeKopie.locatieAdres
const basisLocatie: Alles = perSoort(() => ({}))
basisLocatie.programma[id] = metLocatie
const lokaalLocatie: Alles = perSoort(() => ({}))
lokaalLocatie.programma[id] = schoon('programma', oudeKopie)
const locatieServer = { ...metLocatie, locatie: 'Sportpark Voorbeeld · Veld 3', locatieAdres: 'Nieuwe Voorbeeldweg 3' }
let locatiePatch: Record<string, unknown> = {}
const locatieFake = { filter: () => '', collection: (soort: string) => ({
  update: async (_: string, velden: Record<string, unknown>) => { locatiePatch = velden; Object.assign(locatieServer, velden) },
  getFullList: async () => soort === 'programma' ? [locatieServer] : [],
}) }
const locatieUit = await synchroniseer(locatieFake as never, 'team', () => lokaalLocatie, basisLocatie)
assert.deepEqual(locatiePatch, { notitie: 'Eigen teamafspraak' }, 'Ontbrekende lokale locatievelden mogen niets wissen')
assert.equal(locatieUit.samengevoegd.programma[id].locatie, locatieServer.locatie)
assert.equal(locatieUit.samengevoegd.programma[id].locatieAdres, locatieServer.locatieAdres)
assert.equal(locatieUit.wachtend, 0)
const bewustLeeg = { ...metLocatie, locatie: '', locatieAdres: '' }
const bewustSamengevoegd = samenvoegen({ [id]: bewustLeeg }, { [id]: metLocatie }, { [id]: metLocatie }, new Set(), [], true)
assert.equal(bewustSamengevoegd[id].locatie, '', 'Een expliciete tekstwijziging blijft herkenbaar als eigen invoer')
console.log('PROGRAMMA_SYNC_LOCATIE_OK: oude kopieën wissen geen locaties; notities synchroniseren en actuele bronlocaties blijven behouden.')

// Tijdelijke serverfouten mogen onverzonden wijzigingen niet als ongeldige invoer weggooien.
for (const status of [429, 500, 503]) {
  const tijdelijk = { filter: () => '', collection: () => ({ update: async () => { throw { status } } }) }
  await assert.rejects(synchroniseer(tijdelijk as never, 'team', () => lokaal, basis), (err: unknown) => (err as { status: number }).status === status)
  assert.equal(lokaal.programma[id].verzamelen, '08:15')
}
console.log('SYNC_HERSTEL_OK: tijdelijke serverfouten houden eigen wijzigingen vast voor de volgende poging.')
