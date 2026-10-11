// Controleer de kalendergegevens, inclusief leeftijdsafhankelijke reservevoetnoten.
import assert from 'node:assert/strict'
import fs from 'node:fs'
const kalenders = JSON.parse(fs.readFileSync(new URL('../catalogus/kalenders-2026-2027.json', import.meta.url)))
assert.equal(new Set(kalenders.map(k => k.bronId)).size, kalenders.length)
for (const regio of ['Midden Nederland','Noord-Holland','Noord-Oost Nederland','Zuid-Holland','Zuid Nederland','Landelijk']) {
  for (const vorm of ['Veld','Zaal']) assert.ok(kalenders.some(k => k.district === regio && k.spelvorm === vorm), `${regio} ${vorm} ontbreekt`)
}
for (const k of kalenders) {
  assert.equal(k.seizoen, '2026-2027')
  assert.ok(k.bron.startsWith('https://media.static-hw.nl/media/'))
  assert.equal(new Set(k.dagen.map(d=>d.datum)).size, k.dagen.length)
  for (const d of k.dagen) {
    assert.equal(new Date(d.datum).toISOString().slice(0,10),d.datum)
    assert.ok(d.datum >= '2026-07-01' && d.datum < '2027-08-01')
    assert.ok(['reserve','speeldag','slotdag'].includes(d.status))
  }
}
const vind = (regio,vorm,naam) => kalenders.find(k => k.district === regio && k.spelvorm === vorm && k.naam === naam)
const mn = vind('Midden Nederland','Veld','O14 / O12 / O11 1e klasse en lager')
const toekomst = mn.dagen.filter(d => d.datum >= '2026-10-11')
assert.equal(toekomst.length,20)
assert.deepEqual(toekomst.filter(d=>d.status==='reserve').map(d=>d.datum),['2027-03-27','2027-03-29','2027-04-24','2027-05-08','2027-06-19'])
assert.ok(!toekomst.some(d => ['2026-10-17','2026-12-19','2027-02-20','2027-05-15'].includes(d.datum)))
for (const [age,sat,sun] of [['O11','speeldag','reserve'],['O12','reserve','speeldag']]) {
  const zaal = vind('Midden Nederland','Zaal',`${age} · 1e klasse en lager`)
  assert.equal(zaal.dagen.find(d=>d.datum==='2026-12-05').status,sat)
  assert.equal(zaal.dagen.find(d=>d.datum==='2026-12-06').status,sun)
}
const zh = vind('Zuid-Holland','Veld','O14 / O12 / O11 1e klasse en lager')
assert.ok(zh.dagen.some(d=>d.datum==='2026-09-26'&&d.omschrijving==='4'))
assert.ok(zh.dagen.some(d=>d.datum==='2027-04-03'&&d.omschrijving==='4'))
console.log('Kalenders gecontroleerd: alle regio’s, veld/zaal, geldige datums en MO11/O12-reservedagen.')
