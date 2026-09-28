// Vroeger begon de app zonder team met de echte namen. Die (herkend aan id 1–11 en een hash van de naam,
// zodat de namen zelf niet in de openbare code staan) worden bij het starten één keer de namen van het testteam,
// in de opslag 'Zonder team' van deze telefoon, ook als niemand inlogt. Daarna mag iemand namen gewoon zelf aanpassen.
import { GespeeldeWedstrijd } from './types'
import { lees, OPSLAG, schrijf } from './opslag'

const OUDE_NAAM: Record<string, string> = { '4egcjr': 'Yara', '377705': 'Roos', '4j7ws4': 'Nina', '3779vm': 'Tess', '3776ll': 'Emma', '46wakk': 'Lotte', '4a9vtz': 'Fleur', '1w8c9gs': 'Mila', '4daeyi': 'Saar', 'ykraoc': 'Lieke', '1vnsb3v': 'Noor' }
const naamHash = (naam: string) => {
  let x = 5381
  for (const c of naam.trim().toLowerCase()) x = (x * 33 + c.charCodeAt(0)) >>> 0
  return x.toString(36)
}
const nieuweNaam = (id: string | null, naam: string) =>
  id && /^([1-9]|1[01])$/.test(id) ? OUDE_NAAM[naamHash(naam)] ?? naam : naam
const vervangOudeNamen = <T extends { id: string; naam: string }>(lijst: T[]): T[] => {
  const bezet = new Set(lijst.map(s => s.naam.trim().toLowerCase()))
  return lijst.map(s => {
    const nieuw = nieuweNaam(s.id, s.naam)
    return nieuw !== s.naam && !bezet.has(nieuw.toLowerCase()) ? { ...s, naam: nieuw } : s
  })
}
const vervangOudeNamenWedstrijd = (w: GespeeldeWedstrijd): GespeeldeWedstrijd => ({
  ...w,
  spelers: vervangOudeNamen(w.spelers),
  doelpunten: w.doelpunten.map(d => ({ ...d, naam: nieuweNaam(d.spelerId, d.naam) })),
})

export function vervangOudeNamenOpTelefoon() {
  try {
    if (localStorage.getItem(`${OPSLAG}_namen_vervangen`)) return
    const spelers = localStorage.getItem(`${OPSLAG}_spelers`)
    if (spelers) schrijf(OPSLAG, 'spelers', vervangOudeNamen(JSON.parse(spelers)))
    const wedstrijden = lees<GespeeldeWedstrijd[] | null>(OPSLAG, 'wedstrijden', null)
    if (wedstrijden) schrijf(OPSLAG, 'wedstrijden', wedstrijden.map(vervangOudeNamenWedstrijd))
    localStorage.setItem(`${OPSLAG}_namen_vervangen`, '1')
  } catch {
    // kapotte of geblokkeerde opslag: dan maar niet
  }
}
