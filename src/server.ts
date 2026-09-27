import PocketBase, { ClientResponseError, LocalAuthStore, RecordModel } from 'pocketbase'
import { OPSLAG } from './opslag'


export const pb = new PocketBase(import.meta.env.VITE_SERVER ?? 'https://serverbot.taild1b3c5.ts.net', new LocalAuthStore(`${OPSLAG}_auth`))
pb.autoCancellation(false)

export type Rol = 'beheerder' | 'kijker'
export const ROL_VELD: Record<Rol, 'beheerders' | 'kijkers'> = { beheerder: 'beheerders', kijker: 'kijkers' }
export const ROL_TEKST: Record<Rol, string> = { beheerder: 'Beheerder', kijker: 'Kijker' }
export const ROL_UITLEG: Record<Rol, string> = {
  beheerder: 'mag alles bijhouden en regelen',
  kijker: 'kijkt alleen mee',
}

export interface Gebruiker extends RecordModel { email: string; name: string; superadmin: boolean; gast?: boolean; kinderen?: Record<string, string[]> | null }
export interface Team extends RecordModel {
  naam: string
  beheerders: string[]
  kijkers: string[]
  kijklink?: string
  instellingen?: Partial<TeamInstellingen> | null
  expand?: { beheerders?: Gebruiker[]; kijkers?: Gebruiker[] }
}
// Standaard per team: bij een uit- of thuiswedstrijd is (geen) spelbegeleiding van ons nodig
export interface TeamInstellingen { uitGeenBegeleiding: boolean; thuisGeenBegeleiding: boolean }
export const STANDAARD_INSTELLINGEN: TeamInstellingen = { uitGeenBegeleiding: true, thuisGeenBegeleiding: false }

export interface Uitnodiging extends RecordModel { team: string; email: string; rol: Rol }

export const rolIn = (team: Team, userId: string): Rol | null =>
  team.beheerders?.includes(userId) ? 'beheerder' : team.kijkers?.includes(userId) ? 'kijker' : null

// Adres van deze app (test of live), voor de links in uitnodigingsmails
export const appAdres = () => window.location.origin + window.location.pathname.replace(/index\.html$/, '')

export function foutTekst(fout: unknown): string {
  if (fout instanceof ClientResponseError) {
    if (fout.status === 0) return 'Geen verbinding met de server. Probeer het later nog eens.'
    const velden = Object.values(fout.response?.data ?? {}) as { message?: string }[]
    return fout.response?.message && !velden.length ? fout.response.message : velden[0]?.message ?? fout.message
  }
  return String(fout)
}

// Meekijklink: een gast-account per team (zie pb_hooks). In de link staan team-id en het geheime wachtwoord
export const gastEmail = (teamId: string) => `kijk-${teamId}@meekijken.invalid`
export const kijkLink = (teamId: string, token: string) => `${appAdres()}#kijk=${teamId}.${token}`

export async function haalKijkLink(teamId: string, vernieuw = false): Promise<string> {
  const r = await pb.send<{ token: string }>(`/api/hockey/kijklink/${teamId}`, { method: 'POST', body: { vernieuw } })
  return kijkLink(teamId, r.token)
}
