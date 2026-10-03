import { Player, Position } from './types'

// Speeltijd per speler per linie, gemeten op de wedstrijdklok (pauzes en rust tellen niet mee).
// Wissel (op de bank) is een eigen groep; wie niet meedoet telt niet.
export type Linie = 'a' | 'm' | 'v' | 'k' | 'w'
export const LINIES: Linie[] = ['a', 'm', 'v', 'k', 'w']
export const LINIE_NAAM: Record<Linie, string> = { a: 'Aanval', m: 'Middenveld', v: 'Verdediging', k: 'Keeper', w: 'Wissel' }
export type Tijden = Record<Linie, number> // seconden

const AANVAL: Position[] = ['LW', 'CV', 'RW']
const MIDDEN: Position[] = ['LM', 'LCM', 'CM', 'RCM', 'RM']

export function linieVan(s: Player): Linie | null {
  if (!s.meedoen) return null
  if (!s.inVeld) return 'w'
  if (s.isKeeper || s.positie === 'K') return 'k'
  return AANVAL.includes(s.positie) ? 'a' : MIDDEN.includes(s.positie) ? 'm' : 'v'
}

// Moment waarop de indeling veranderde: t = stand van de wedstrijdklok (ms), g = linie per speler
export interface SpeeltijdMoment { t: number; g: Record<string, Linie> }

export const indeling = (spelers: Player[]): Record<string, Linie> => {
  const g: Record<string, Linie> = {}
  for (const s of [...spelers].sort((a, b) => a.id.localeCompare(b.id))) {
    const l = linieVan(s)
    if (l) g[s.id] = l
  }
  return g
}

const zelfde = (a: Record<string, Linie>, b: Record<string, Linie>) => JSON.stringify(a) === JSON.stringify(b)

// Nieuwe indeling vastleggen. Zelfde indeling: niets. Klok nog op hetzelfde moment (of teruggezet): het laatste moment vervangen
export function logBij(log: SpeeltijdMoment[], t: number, g: Record<string, Linie>): SpeeltijdMoment[] {
  const laatste = log[log.length - 1]
  if (laatste && zelfde(laatste.g, g)) return log
  if (laatste && t <= laatste.t) return [...log.slice(0, -1), { t: laatste.t, g }]
  return [...log, { t, g }]
}

export const klokMs = (timer: { gestartOp: number | null; opgebouwd: number }, nu = Date.now()) => timer.opgebouwd + (timer.gestartOp !== null ? nu - timer.gestartOp : 0)

const leeg = (): Tijden => ({ a: 0, m: 0, v: 0, k: 0, w: 0 })

// Seconden per speler per linie, tot klokstand 'nu' (ms)
export function speeltijden(log: SpeeltijdMoment[], nu: number): Record<string, Tijden> {
  const uit: Record<string, Tijden> = {}
  log.forEach((m, i) => {
    const eind = i + 1 < log.length ? log[i + 1].t : nu
    const duur = Math.max(0, eind - m.t) / 1000
    if (!duur) return
    for (const [id, l] of Object.entries(m.g)) (uit[id] ??= leeg())[l] += duur
  })
  for (const t of Object.values(uit)) for (const l of LINIES) t[l] = Math.round(t[l])
  return uit
}

export const opVeld = (t: Partial<Tijden>) => (t.a ?? 0) + (t.m ?? 0) + (t.v ?? 0) + (t.k ?? 0)
export const minuten = (sec: number) => Math.round(sec / 60)
