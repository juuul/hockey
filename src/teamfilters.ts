// Oudere catalogus-/cachegegevens missen soms kenmerken van zaalteams (zMO/zJO/zD/zH).
// Vul alleen ontbrekende filterwaarden aan; de officiële naam en ingevulde kenmerken blijven staan.
export function teamFilterWaarden<T extends { naam: string; geslacht?: string; leeftijd?: string }>(team: T) {
  const codes = [...team.naam.matchAll(/(?:^|\s)z?(MO\d{1,2}|JO\d{1,2}|M\d{1,2}|J\d{1,2}|D\d+|H\d+|G\d*|X\d*|MIX(?:O\d{1,2})?)(?=-|\s|$)/gi)]
  const code = codes[codes.length - 1]?.[1]?.toUpperCase() || ''
  const geslacht = /^(MO|M\d|D)/.test(code) ? 'Meisjes / dames'
    : /^(JO|J\d|H)/.test(code) ? 'Jongens / heren'
    : /^(G|X|MIX)/.test(code) ? 'Gemengd' : ''
  return { ...team, geslacht: team.geslacht || geslacht, leeftijd: team.leeftijd || code.match(/O\d{1,2}/)?.[0] || '' }
}

export const TEAMFILTER_VELDEN = [['seizoen', 'Seizoen'], ['geslacht', 'Teamtype'], ['leeftijd', 'Leeftijd'], ['spelvorm', 'Veld of zaal']] as const
type FilterVeld = typeof TEAMFILTER_VELDEN[number][0]
type Filterbaar = { [K in FilterVeld]?: string }
const past = (t: Filterbaar, filters: Record<string, string>, behalve?: FilterVeld) =>
  TEAMFILTER_VELDEN.every(([veld]) => veld === behalve || !filters[veld] || t[veld] === filters[veld])

// Teams die bij de gekozen filters horen, en per filter de keuzes die bij de overige filters nog iets opleveren.
export function teamsMetFilters<T extends Filterbaar>(teams: T[], filters: Record<string, string>) {
  return teams.filter(t => past(t, filters))
}
export function teamFilterKeuzes(teams: Filterbaar[], filters: Record<string, string>) {
  return TEAMFILTER_VELDEN.map(([veld, label]) => ({ veld, label, waarden: [...new Set(teams.filter(t => past(t, filters, veld)).map(t => t[veld]).filter((w): w is string => !!w))].sort().reverse() }))
    .filter(({ veld, waarden }) => waarden.length > 1 || filters[veld])
}
