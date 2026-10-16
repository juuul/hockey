// Test-/demogroepen hebben geen apart kenmerk; herken de expliciete namen.
const isTestteam = (naam: string) => /\b(?:test(?:[\s-]*team)?|demo(?:[\s-]*team)?)(?:\b|\d)/i.test(naam)

export function kiesStartteam<T extends { id: string; naam: string }>(teams: T[], huidig: string | null, bijInloggen = false): string | null {
  if (!bijInloggen && !huidig) return teams.length === 1 ? teams[0].id : null
  const bewaard = teams.find(t => t.id === huidig)
  if (bewaard && (!bijInloggen || !isTestteam(bewaard.naam))) return bewaard.id
  return teams.find(t => !isTestteam(t.naam))?.id ?? bewaard?.id ?? teams[0]?.id ?? null
}
