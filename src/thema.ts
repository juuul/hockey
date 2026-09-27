// Licht/donker: automatisch (systeeminstelling) of vast gekozen in Instellingen. Per telefoon, voor test en live samen.
// index.html zet de keuze al vóór het laden (geen flits); deze module houdt hem daarna bij.
export type Thema = 'auto' | 'licht' | 'donker'
const SLEUTEL = 'hockey_thema'

export function leesThema(): Thema {
  try {
    const t = localStorage.getItem(SLEUTEL)
    return t === 'licht' || t === 'donker' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export function zetThema(t: Thema) {
  try {
    if (t === 'auto') localStorage.removeItem(SLEUTEL)
    else localStorage.setItem(SLEUTEL, t)
  } catch {
    // geen opslag: dan alleen voor nu
  }
  if (t === 'auto') delete document.documentElement.dataset.thema
  else document.documentElement.dataset.thema = t
}
