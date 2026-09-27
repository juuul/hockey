import { Club, GespeeldeWedstrijd, Player } from './types'

export function vandaag(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function datumTekst(datum: string): string {
  const d = new Date(`${datum}T12:00:00`)
  const metJaar = d.getFullYear() !== new Date().getFullYear()
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', ...(metJaar ? { year: 'numeric' } : {}) })
}

export type Uitslag = 'W' | 'G' | 'V'
export const uitslag = (w: GespeeldeWedstrijd): Uitslag => (w.wij > w.zij ? 'W' : w.wij < w.zij ? 'V' : 'G')

export interface Balans { gespeeld: number; W: number; G: number; V: number; voor: number; tegen: number }

export function balans(wedstrijden: GespeeldeWedstrijd[]): Balans {
  const b: Balans = { gespeeld: 0, W: 0, G: 0, V: 0, voor: 0, tegen: 0 }
  for (const w of wedstrijden) {
    b.gespeeld++
    b[uitslag(w)]++
    b.voor += w.wij
    b.tegen += w.zij
  }
  return b
}

// Nieuwste eerst; bij dezelfde datum de laatst opgeslagen bovenaan
export const sorteerWedstrijden = (wedstrijden: GespeeldeWedstrijd[]) =>
  [...wedstrijden].sort((a, b) => b.datum.localeCompare(a.datum) || b.opgeslagenOp - a.opgeslagenOp)

// Per speler-id, met de huidige naam als de speler nog bestaat. Onbekende scorers apart onderaan
export function topscorers(wedstrijden: GespeeldeWedstrijd[], spelers: Player[]): { id: string | null; naam: string; aantal: number }[] {
  const telling = new Map<string | null, { naam: string; aantal: number }>()
  for (const w of wedstrijden) {
    for (const d of w.doelpunten) {
      const huidig = telling.get(d.spelerId)
      if (huidig) huidig.aantal++
      else telling.set(d.spelerId, { naam: d.spelerId === null ? 'Onbekend' : d.naam, aantal: 1 })
    }
  }
  return [...telling.entries()]
    .map(([id, t]) => ({ id, naam: spelers.find(s => s.id === id)?.naam ?? t.naam, aantal: t.aantal }))
    .sort((a, b) => Number(a.id === null) - Number(b.id === null) || b.aantal - a.aantal || a.naam.localeCompare(b.naam))
}

export const clubNaam = (w: GespeeldeWedstrijd, clubs: Club[]) => clubs.find(c => c.id === w.clubId)?.naam ?? w.tegenstander

// Alle bekende clubs (ook zonder wedstrijden) plus clubs die alleen nog in de historie staan
export function perTegenstander(wedstrijden: GespeeldeWedstrijd[], clubs: Club[]): { clubId: string; naam: string; bestaat: boolean; balans: Balans }[] {
  const ids = [...new Set([...clubs.map(c => c.id), ...wedstrijden.map(w => w.clubId)])]
  return ids
    .map(id => {
      const club = clubs.find(c => c.id === id)
      const tegen = wedstrijden.filter(w => w.clubId === id)
      return { clubId: id, naam: club?.naam ?? tegen[0].tegenstander, bestaat: !!club, balans: balans(tegen) }
    })
    .sort((a, b) => b.balans.gespeeld - a.balans.gespeeld || a.naam.localeCompare(b.naam))
}

// Keuzelijst: laatst gebruikt bovenaan, gefilterd op wat er getypt is
export function zoekClubs(clubs: Club[], zoek: string): Club[] {
  const z = zoek.trim().toLowerCase()
  return clubs.filter(c => c.naam.toLowerCase().includes(z)).sort((a, b) => b.laatstGebruikt - a.laatstGebruikt || a.naam.localeCompare(b.naam))
}

export const vindClub = (clubs: Club[], naam: string) => clubs.find(c => c.naam.trim().toLowerCase() === naam.trim().toLowerCase())
