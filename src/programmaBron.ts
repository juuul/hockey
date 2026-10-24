// Alleen de openbare KNHB-team- en poule-id's bepalen de bronlink.
export function programmaBronLink(team?: { bronId: string; pouleId?: string } | null): string | null {
  if (!team || !/^\d+$/.test(team.bronId) || !/^\d+$/.test(team.pouleId ?? '')) return null
  return `https://www.hockey.nl/match-center#/team/${team.bronId}|${team.pouleId}/program`
}
