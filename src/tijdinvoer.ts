import type { ProgrammaItem } from './types'

// Leeg is toegestaan; onvolledige of ongeldige invoer is null.
export function tijdWaarde(invoer: string): string | null {
  if (!invoer) return ''
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(invoer)
  return m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}` : null
}
export function tijdenGeldig(p: ProgrammaItem): boolean {
  return p.soort !== 'wedstrijd' || (tijdWaarde(p.spelen) !== null && (p.verzamelModus !== 'handmatig' || tijdWaarde(p.verzamelen) !== null))
}
export function officieleAanvang(p: ProgrammaItem): string | null {
  if (p.bronId && p.bronBasis) return p.bronWijziging?.spelen ?? p.bronBasis.spelen
  return p.bronPlanning ? '' : null
}
