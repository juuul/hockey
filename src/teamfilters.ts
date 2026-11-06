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
