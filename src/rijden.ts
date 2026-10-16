import { NIET_NODIG, type ProgrammaItem } from './types'

// De hele spelerslijst (ook wissels), niet de veldbezetting of de aanwezigheid van vandaag.
export function autoPlekken(p: Pick<ProgrammaItem, 'thuis' | 'soort' | 'rijders'>, teamgrootte: number): string[] {
  if (p.thuis || p.soort !== 'wedstrijd') return []
  const bewaard = Array.isArray(p.rijders) ? p.rijders : []
  // Een kleiner geworden team mag bestaande ingeplande ouders niet stilzwijgend verliezen.
  const laatste = bewaard.reduce((n, id, i) => id && id !== NIET_NODIG ? i + 1 : n, 0)
  const aantal = Math.max(Math.ceil(Math.max(0, teamgrootte) / 4), laatste)
  return Array.from({ length: aantal }, (_, i) => typeof bewaard[i] === 'string' && bewaard[i] !== NIET_NODIG ? bewaard[i] : '')
}

export function rijdenTekst(plekken: string[], naam: (id: string) => string): string {
  if (!plekken.length) return 'niet nodig'
  const kinderen = plekken.map(id => id && id !== NIET_NODIG ? naam(id) : '').filter(Boolean)
  const open = plekken.length - kinderen.length
  if (!kinderen.length) return `${open} ${open === 1 ? 'chauffeur' : 'chauffeurs'} nog te bepalen`
  const gekozen = `${kinderen.length === 1 ? 'ouder' : 'ouders'} van ${kinderen.join(', ')}`
  return open ? `${gekozen} · nog ${open} ${open === 1 ? 'chauffeur' : 'chauffeurs'} nodig` : gekozen
}
