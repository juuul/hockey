// Expliciete whitelist: de import bevat uitsluitend openbare clubs, teams en wedstrijden.
function normaliseer(clubs, club, detail, gecontroleerd = new Date().toISOString()) {
  const jaar = new Date(gecontroleerd).getUTCFullYear() - (new Date(gecontroleerd).getUTCMonth() < 6 ? 1 : 0)
  const seizoen = detail?.data?.season_name || `${jaar}-${jaar + 1}`
  const uit = { clubs: [], teams: [], wedstrijden: [] }
  const clubdata = clubs?.data || (club ? [club.data] : [])
  uit.clubs = clubdata.filter(c => c.type === 'regular').map(c => ({ bronId: c.federation_reference_id, naam: c.friendly_name || c.name, plaats: c.city || '', gecontroleerd }))
  const teamdata = new Map((club?.data?.teams || []).map(t => [String(t.id), t]))
  const matches = new Map()
  for (const poule of detail?.data?.poules || []) {
    for (const w of poule.matches || []) {
      if (!w.home?.id || !w.away?.id || !/^\d{4}-\d\d-\d\dT/.test(w.date || '')) continue
      teamdata.set(String(w.home.id), w.home); teamdata.set(String(w.away.id), w.away)
      matches.set(String(w.id), { bronId: String(w.id), seizoen, thuisBronId: String(w.home.id), uitBronId: String(w.away.id), datum: w.date.slice(0, 10), spelen: w.date.slice(11, 16), thuisNaam: w.home.name, uitNaam: w.away.name, locatie: [w.location?.facility?.name, w.location?.field?.name].filter(Boolean).join(' · '), status: w.status || '', uitslag: w.score || null, gecontroleerd })
    }
  }
  uit.wedstrijden = [...matches.values()]
  uit.teams = [...teamdata.values()].map(t => {
    const naam = t.short_name || t.name
    const leeftijd = naam.match(/O(\d{1,2})/)?.[0] || ''
    const geslacht = /^(MO|M\d|D)/.test(naam) ? 'Meisjes / dames' : /^(JO|J\d|H)/.test(naam) ? 'Jongens / heren' : /^(G|X|MIX)/i.test(naam) ? 'Gemengd' : ''
    return { bronId: String(t.id), clubBronId: t.federation_reference_id, naam: t.name, seizoen, geslacht, leeftijd, categorie: t.category_group_name || '', spelvorm: t.hockey_type === 'ZA' ? 'Zaal' : t.hockey_type === 'VE' ? 'Veld' : t.hockey_type || '', klasse: String(t.id) === String(detail?.header?.id) ? detail?.data?.class_name || detail?.data?.poule_class_name || '' : '', pouleId: String(t.recent_poule_id || ''), actief: true, gecontroleerd }
  })
  // De competitieklasse geldt voor de teams van die poule, alleen in dit seizoen.
  if (detail) {
    const ids = new Set(uit.wedstrijden.flatMap(w => [w.thuisBronId, w.uitBronId]))
    for (const t of uit.teams) if (ids.has(t.bronId)) t.klasse = detail.data.class_name || detail.data.poule_class_name || ''
  }
  return uit
}
module.exports = { normaliseer }
