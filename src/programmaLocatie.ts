import type { ProgrammaItem } from './types'

// Een speeldagenkalender geeft alleen datums. De verplichte bool in zo'n lege regel
// is geen bevestigde thuis-/uitindeling; handmatige of gepubliceerde wedstrijden wel.
export function thuisUitBekend(p: ProgrammaItem): boolean {
  return p.soort === 'wedstrijd' && (!p.bronPlanning || !!p.bronId || !!p.clubId || !!(p.tegenstander || '').trim())
}

export function thuisUitTekst(p: ProgrammaItem): string {
  return thuisUitBekend(p) ? p.thuis ? 'Thuis' : 'Uit' : 'Thuis/uit nog onbekend'
}
