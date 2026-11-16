import assert from 'node:assert/strict'
import { logBij, wisselbeurt, type SpeeltijdMoment } from '../../src/speeltijd'
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
console.log('WISSELBEURT_OK: elke beurt op de bank vanaf 0 op de wedstrijdklok, doorlopend bij andere wijzigingen, niet bij veldspelers/afgemeld/speeltijd uit.')
