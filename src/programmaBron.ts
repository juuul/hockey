import type { ProgrammaItem } from './types'

// Alleen de openbare KNHB-team- en poule-id's bepalen de bronlink.
export function programmaBronLink(team?: { bronId: string; pouleId?: string } | null): string | null {
  if (!team || !/^\d+$/.test(team.bronId) || !/^\d+$/.test(team.pouleId ?? '')) return null
  return `https://www.hockey.nl/match-center#/team/${team.bronId}|${team.pouleId}/program`
}

const BRONVELDEN = {
  datum: 'Datum', spelen: 'Aanvang', thuis: 'Thuis/uit', tegenstander: 'Tegenstander', locatie: 'Locatie', locatieAdres: 'Adres',
} as const

// Toon alleen echte verschillen, met beide waarden; oude metadata is geen waarschuwing.
export function programmaAfwijkingen(p: ProgrammaItem) {
  return (Object.keys(BRONVELDEN) as (keyof typeof BRONVELDEN)[]).flatMap(veld => {
    const bron = p.bronWijziging?.[veld]
    if (bron === undefined || bron === null) return []
    const ingesteld = p[veld] ?? ''
    if (ingesteld === bron) return []
    const tekst = (waarde: string | boolean) => {
      if (typeof waarde === 'boolean') return waarde ? 'Thuis' : 'Uit'
      return waarde.trim() || 'niet bekend'
    }
    return [{ veld, tekst: `${BRONVELDEN[veld]}: in de app ${tekst(ingesteld)}; hockey.nl ${tekst(bron)}.` }]
  })
}
