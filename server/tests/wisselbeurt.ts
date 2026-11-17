import assert from 'node:assert/strict'
import { klokTerug, logBij, speeltijden, wisselbeurt, type SpeeltijdMoment } from '../../src/speeltijd'
const min = (m: number) => m * 60_000
let log: SpeeltijdMoment[] = []
log = logBij(log, 0, { anna: 'a', bo: 'w', cleo: 'v' })
assert.equal(wisselbeurt(log, 'bo', 0), 0, 'Wissel bij de aftrap begint op 0')
assert.equal(wisselbeurt(log, 'bo', min(4) + 59_000), 299, 'Seconden op de wedstrijdklok')
assert.equal(wisselbeurt(log, 'anna', min(4)), null, 'Veldspeler heeft geen wisselbeurt')
// Bo komt erin voor Anna: Anna begint opnieuw bij 0, Bo heeft geen wisseltijd meer.
log = logBij(log, min(5), { anna: 'w', bo: 'a', cleo: 'v' })
assert.equal(wisselbeurt(log, 'anna', min(5)), 0)
assert.equal(wisselbeurt(log, 'anna', min(8)), 180)
assert.equal(wisselbeurt(log, 'bo', min(8)), null)
// Een andere wijziging (Cleo verplaatst) breekt de wisselbeurt van Anna niet af.
log = logBij(log, min(9), { anna: 'w', bo: 'a', cleo: 'm' })
assert.equal(wisselbeurt(log, 'anna', min(10)), 300, 'Doorlopende beurt telt vanaf het moment van eruit gaan')
// Bo gaat er weer uit: nieuwe beurt, opnieuw vanaf 0 (niet opgeteld bij de eerste beurt van 5 minuten).
log = logBij(log, min(12), { anna: 'a', bo: 'w', cleo: 'm' })
assert.equal(wisselbeurt(log, 'bo', min(12)), 0)
assert.equal(wisselbeurt(log, 'bo', min(13)), 60)
// Afgemeld of speeltijd uit: geen tijd tonen.
log = logBij(log, min(14), {})
assert.equal(wisselbeurt(log, 'bo', min(15)), null)
assert.equal(wisselbeurt([], 'bo', 0), null)
// Klok terug: latere momenten schuiven naar de nieuwe klokstand, zodat een nieuwe wisselbeurt meteen meeloopt.
{
  let l: SpeeltijdMoment[] = logBij([], 0, { a: 'a', b: 'w', c: 'w' })
  l = logBij(l, min(10), { a: 'w', b: 'a', c: 'w' })        // wissel op 10:00
  assert.equal(klokTerug(l, min(12)), l, 'Vooruit of gelijk: log ongewijzigd')
  l = klokTerug(l, min(9))                                   // klok één minuut terug
  assert.deepEqual(l.map(m => m.t), [0, min(9)])
  assert.equal(wisselbeurt(l, 'a', min(9) + 5000), 5, 'Eerder gewisselde speler loopt vanaf de nieuwe klokstand')
  l = logBij(l, min(9) + 30_000, { a: 'w', b: 'w', c: 'a' }) // nog een wissel op 9:30
  assert.equal(wisselbeurt(l, 'b', min(9) + 35_000), 5, 'Nieuwe wisselbeurt loopt meteen mee')
  assert.equal(wisselbeurt(l, 'a', min(9) + 35_000), 35)
  assert.equal(wisselbeurt(l, 'c', min(9) + 35_000), null)
  // Stop (klok naar 0): alleen de huidige indeling vanaf 0.
  assert.deepEqual(klokTerug(l, 0), [{ t: 0, g: { a: 'w', b: 'w', c: 'a' } }])
  // Gelijke opeenvolgende indelingen worden samengevoegd; gemeten tijd vóór de nieuwe klokstand blijft.
  const m = klokTerug([{ t: 0, g: { a: 'a' } }, { t: min(5), g: { a: 'w' } }, { t: min(8), g: { a: 'a' } }], min(3))
  assert.deepEqual(m, [{ t: 0, g: { a: 'a' } }])
  assert.equal(speeltijden(m, min(3)).a.a, 180)
}
console.log('WISSELBEURT_OK: klok terug laat geen beurt in de toekomst beginnen;  elke beurt op de bank vanaf 0 op de wedstrijdklok, doorlopend bij andere wijzigingen, niet bij veldspelers/afgemeld/speeltijd uit.')
