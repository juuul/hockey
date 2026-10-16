import { NIET_NODIG, type ProgrammaItem, type Spelvorm, isZaal } from './types'
import type { TeamInstellingen } from './server'
import { autoPlekken } from './rijden'

export function begeleidingProfiel(vorm: Spelvorm, teamnaam = '') {
  const leeftijd = Number(teamnaam.match(/(?:^|[^a-z])[jm]?o[-\s]?(7|8|9|10)(?=[^0-9]|$)/i)?.[1])
  if (isZaal(vorm)) {
    if (vorm === 'zaalmini3' || vorm === 'zaalmini4' || leeftijd === 7 || leeftijd === 8) return 'zaal-o8'
    if (vorm === 'zaaljeugd6') return leeftijd === 10 ? 'o10' : leeftijd === 9 ? 'o9' : 'onbekend'
    return 'onbekend'
  }
  if (vorm === 'mini3') return 'o78'
  if (vorm === 6) return 'o9'
  if (vorm === 8) return 'o10'
  return 'onbekend'
}

export function begeleidingStandaard(profiel: string, thuis: boolean, veldjes = 1): number | null {
  if (profiel === 'o78') return thuis ? veldjes : 0
  if (profiel === 'o9') return thuis ? 1 : 0
  if (profiel === 'o10') return 1
  return null // Geen bevestigde standaard: expliciet instellen, geen KNHB-regel suggereren.
}

export function begeleidingAantal(profiel: string, thuis: boolean, inst: TeamInstellingen): number {
  const eigen = thuis ? inst.begeleidingThuis : inst.begeleidingUit
  if (eigen === 0 || eigen === 1 || eigen === 2) return eigen
  if (thuis ? inst.thuisGeenBegeleiding : inst.uitGeenBegeleiding) return 0
  return begeleidingStandaard(profiel, thuis, inst.begeleidingVeldjes ?? 1) ?? 2
}

export function begeleidingPlekken(p: Pick<ProgrammaItem, 'begeleider1' | 'begeleider2' | 'thuis'>, profiel: string, inst: TeamInstellingen): [string, string] {
  const aantal = begeleidingAantal(profiel, p.thuis, inst)
  return [p.begeleider1, p.begeleider2].map((id, i) => id && id !== NIET_NODIG ? id : i < aantal ? id || '' : NIET_NODIG) as [string, string]
}

// Alleen de allereerste echte ouderkeuze koppelen, nooit bestaande taken overschrijven.
export function kiesTaak(p: ProgrammaItem, veld: 'fruit' | 'begeleider1' | 'begeleider2' | number, id: string, profiel: string, inst: TeamInstellingen, teamgrootte: number): ProgrammaItem {
  const isOuder = (waarde: string) => !!waarde && waarde !== NIET_NODIG
  const [b1, b2] = begeleidingPlekken(p, profiel, inst)
  const rijders = autoPlekken(p, teamgrootte)
  const eerste = ![p.fruit, b1, b2, ...rijders].some(isOuder)
  const nieuw = { ...p, begeleider1: b1, begeleider2: b2, rijders }
  if (typeof veld === 'number') nieuw.rijders[veld] = id
  else nieuw[veld] = id
  if (!eerste || !isOuder(id)) return nieuw
  if (!nieuw.fruit) nieuw.fruit = id
  if (![nieuw.begeleider1, nieuw.begeleider2].some(isOuder) && begeleidingAantal(profiel, p.thuis, inst) > 0) nieuw.begeleider1 = id
  if (rijders.length && !nieuw.rijders.some(isOuder)) nieuw.rijders[0] = id
  return nieuw
}
