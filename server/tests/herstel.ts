import assert from 'node:assert/strict'
import { HerstelPogingen, metHerpogingen, tijdelijkeFout, verzoekMetTimeout, type HerstelKlok } from '../../src/herstel'
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
// Eenmalige gebruikersactie: maximaal drie pogingen bij geen antwoord of tijdelijke serverfout, niet bij een inhoudelijke fout.
{
  const gewacht: number[] = [], gemeld: number[] = []
  const opties = { wacht: async (ms: number) => { gewacht.push(ms) }, opnieuw: (p: number) => gemeld.push(p), timeout: <U>(a: (s: AbortSignal) => Promise<U>) => a(new AbortController().signal) }
  let pogingen = 0
  assert.equal(await metHerpogingen(async (_s, p) => { pogingen++; if (p < 2) throw Object.assign(new Error('weg'), { status: 0 }); return 'ok' }, opties), 'ok')
  assert.deepEqual([pogingen, gewacht, gemeld], [3, [2000, 5000], [1, 2]])
  pogingen = 0
  await assert.rejects(metHerpogingen(async () => { pogingen++; throw Object.assign(new Error('weg'), { status: 0 }) }, opties), /weg/)
  assert.equal(pogingen, 3, 'Na drie pogingen stoppen')
  pogingen = 0
  await assert.rejects(metHerpogingen(async () => { pogingen++; throw Object.assign(new Error('kort'), { status: 400 }) }, opties), /kort/)
  assert.equal(pogingen, 1, 'Inhoudelijke fout niet herhalen')
  for (const [status, tijdelijk] of [[0, true], [undefined, true], [429, true], [502, true], [400, false], [404, false], [403, false]] as const) assert.equal(tijdelijkeFout({ status }), tijdelijk, String(status))
}
console.log('HERSTEL_OK: begrensde pauzes, geen foutlus, handmatig limiet, zichtbaarheid/online, cleanup, echte aanvraagtimeout en herpogingen bij eenmalige acties.')
