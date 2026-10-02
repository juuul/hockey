import { OpstellingNaam, Player, Shootout, Wissel, WedstrijdInfo } from './types'

// De lopende wedstrijd zoals die live gedeeld wordt. Wie in het team zit (naam) komt uit de spelerslijst (stap 4);
// hier alleen de wedstrijdstand per speler.
export interface SpelerStand {
  positie: Player['positie']
  inVeld: boolean
  meedoen: boolean
  wisselCount: number
  inVolgorde: number
  isKeeper: boolean
}

export interface Stand {
  spelers: Record<string, SpelerStand>
  wisselingen: Wissel[]
  score: { wij: number; zij: number }
  doelpunten: (string | null)[]
  opstelling: OpstellingNaam
  timer: { gestartOp: number | null; opgebouwd: number }
  wedstrijd: WedstrijdInfo
  shootouts?: Shootout[] // ontbreekt in standen van oudere versies
}

// Vaste volgorde van velden, zodat twee toestellen met dezelfde stand ook dezelfde JSON hebben
export function maakStand(d: Stand): Stand {
  const spelers: Record<string, SpelerStand> = {}
  for (const id of Object.keys(d.spelers).sort()) {
    const s = d.spelers[id]
    spelers[id] = { positie: s.positie, inVeld: s.inVeld, meedoen: s.meedoen, wisselCount: s.wisselCount, inVolgorde: s.inVolgorde ?? 0, isKeeper: s.isKeeper }
  }
  return {
    spelers,
    wisselingen: d.wisselingen.map(w => ({ id: w.id, tijdstip: w.tijdstip, inSpeler: w.inSpeler, uitSpeler: w.uitSpeler, positie: w.positie })),
    score: { wij: d.score.wij, zij: d.score.zij },
    doelpunten: [...d.doelpunten],
    opstelling: d.opstelling,
    timer: { gestartOp: d.timer.gestartOp, opgebouwd: d.timer.opgebouwd },
    wedstrijd: { datum: d.wedstrijd.datum, clubId: d.wedstrijd.clubId, thuis: d.wedstrijd.thuis, programmaId: d.wedstrijd.programmaId ?? '' },
    shootouts: (d.shootouts ?? []).map(s => ({ spelerId: s.spelerId })),
  }
}

export const spelersStand = (spelers: Player[]): Record<string, SpelerStand> =>
  Object.fromEntries(spelers.map(s => [s.id, { positie: s.positie, inVeld: s.inVeld, meedoen: s.meedoen, wisselCount: s.wisselCount, inVolgorde: s.inVolgorde ?? 0, isKeeper: s.isKeeper }]))

// Spelers die (nog) niet in de ontvangen stand staan houden hun eigen stand; de rest neemt de stand over
export const spelersMetStand = (spelers: Player[], stand: Record<string, SpelerStand>): Player[] =>
  spelers.map(s => (stand[s.id] ? { ...s, ...stand[s.id] } : s))

// Een ontvangen stand is alleen bruikbaar als hij de verwachte vorm heeft (oude of kapotte records overslaan)
export const isStand = (x: unknown): x is Stand => {
  const s = x as Stand
  return !!s && typeof s === 'object' && !!s.spelers && Array.isArray(s.doelpunten) && !!s.score && !!s.timer && !!s.wedstrijd && typeof s.opstelling === 'string'
}

// Per toestel een vaste id, zodat de app zijn eigen wijzigingen herkent als ze terugkomen
export function toestelId(prefix: string): string {
  try {
    const bestaand = localStorage.getItem(`${prefix}_toestel`)
    if (bestaand) return bestaand
    const nieuw = Math.random().toString(36).slice(2, 12)
    localStorage.setItem(`${prefix}_toestel`, nieuw)
    return nieuw
  } catch {
    return Math.random().toString(36).slice(2, 12)
  }
}
