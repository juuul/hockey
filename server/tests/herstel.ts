import assert from 'node:assert/strict'
import { HerstelPogingen, verzoekMetTimeout, type HerstelKlok } from '../../src/herstel'
let nu = 0, nummer = 0
const timers = new Map<number, { op: number; actie: () => void }>()
const klok: HerstelKlok = { nu: () => nu, zet: (actie, ms) => { const id = ++nummer; timers.set(id, { op: nu + ms, actie }); return id as unknown as ReturnType<typeof setTimeout> }, wis: id => { timers.delete(id as unknown as number) } }
const stap = (ms: number) => {
  const eind = nu + ms
  for (;;) {
    const volgende = [...timers].sort((a, b) => a[1].op - b[1].op)[0]
    if (!volgende || volgende[1].op > eind) break
    nu = volgende[1].op; timers.delete(volgende[0]); volgende[1].actie()
  }
  nu = eind
}
let zichtbaar = true
const momenten: number[] = []
let herstel: HerstelPogingen
const probeer = (handmatig = false) => { if (herstel.magProberen(handmatig)) { momenten.push(nu); herstel.mislukt() } }
herstel = new HerstelPogingen(probeer, () => zichtbaar, klok)
probeer()
for (const wacht of [5_000, 10_000, 20_000, 30_000, 60_000, 60_000]) {
  const voor = momenten.length
  for (let i = 0; i < 10; i++) probeer() // Typen/berichten mogen de foutpauze niet verkorten.
  stap(wacht - 1); assert.equal(momenten.length, voor)
  stap(1); assert.equal(momenten.length, voor + 1)
}
herstel.gelukt(); assert.equal(timers.size, 0)
probeer(); const laatste = nu; stap(4_999); assert.equal(momenten.at(-1), laatste); stap(1); assert.equal(momenten.at(-1), laatste + 5_000, 'Na herstel begint de wachttijd weer kort')
const begin = nu; probeer(true); probeer(true); stap(1_999); assert.equal(momenten.at(-1), begin); stap(1); assert.equal(momenten.at(-1), begin + 2_000, 'Handmatig omzeilt lange pauze, maar niet de bescherming tegen snel herhaald klikken')
zichtbaar = false; const aantal = momenten.length; stap(120_000); probeer(); assert.equal(momenten.length, aantal); assert.equal(timers.size, 0, 'Geen herhaalde achtergrondpogingen als de pagina niet zichtbaar/offline is')
zichtbaar = true; probeer(true); assert.equal(momenten.length, aantal + 1, 'Terugkeren/online kan meteen herstellen')
herstel.stop(); stap(120_000); assert.equal(momenten.length, aantal + 1, 'Na teamwissel/afsluiten geen oude retries')
const oudZet = globalThis.setTimeout, oudWis = globalThis.clearTimeout
let afbreken = () => {}, gewist = false
try {
  globalThis.setTimeout = ((actie: () => void, ms: number) => { assert.equal(ms, 15_000); afbreken = actie; return 123 }) as unknown as typeof setTimeout
  globalThis.clearTimeout = (() => { gewist = true }) as typeof clearTimeout
  const aanvraag = verzoekMetTimeout(signal => new Promise<void>((_, reject) => signal.addEventListener('abort', () => reject(new Error('afgebroken')))))
  afbreken(); await assert.rejects(aanvraag, /afgebroken/); assert.ok(gewist)
} finally { globalThis.setTimeout = oudZet; globalThis.clearTimeout = oudWis }
console.log('HERSTEL_OK: begrensde pauzes, geen foutlus, handmatig limiet, zichtbaarheid/online, cleanup en echte aanvraagtimeout.')
