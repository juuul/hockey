import type PocketBase from 'pocketbase'
import { Club, GespeeldeWedstrijd, Player, Position, ProgrammaItem, Wissel, WedstrijdInfo } from './types'

// Synchronisatie per record (speler, club, wedstrijd) met drie standen:
// lokaal (wat de app nu heeft), basis (wat de server de vorige keer had) en server (wat de server nu heeft).
// Lokaal gewijzigd t.o.v. basis → naar de server sturen. Niet lokaal gewijzigd → overnemen van de server.

export type Soort = 'spelers' | 'clubs' | 'wedstrijden' | 'programma'
export const SOORTEN: Soort[] = ['clubs', 'spelers', 'programma', 'wedstrijden']

// Per soort een waarde (voorkomt overal losse { spelers, clubs, wedstrijden, programma }-objecten)
export const perSoort = <T>(f: (s: Soort) => T): Record<Soort, T> => Object.fromEntries(SOORTEN.map(s => [s, f(s)])) as Record<Soort, T>

export interface SpelerRecord { id: string; naam: string; voorkeur1: string; voorkeur2: string }
export type ClubRecord = Club
export type WedstrijdRecord = GespeeldeWedstrijd

export type Records = Record<string, Record<string, unknown>>
export type Alles = Record<Soort, Records>

// Vaste veldvolgorde, zodat vergelijken via JSON betrouwbaar is en serverextra's (created, collectionId…) wegvallen
const VELDEN: Record<Soort, string[]> = {
  spelers: ['id', 'naam', 'voorkeur1', 'voorkeur2'],
  clubs: ['id', 'naam', 'laatstGebruikt'],
  wedstrijden: ['id', 'datum', 'clubId', 'tegenstander', 'thuis', 'wij', 'zij', 'doelpunten', 'spelers', 'opstelling', 'opgeslagenOp'],
  programma: ['id', 'datum', 'tot', 'soort', 'clubId', 'tegenstander', 'thuis', 'verzamelen', 'spelen', 'fruit', 'begeleider1', 'begeleider2', 'notitie'],
}

// Tekstvelden die leeg '' zijn als ze ontbreken (de server geeft '' terug, de app soms undefined)
const TEKST = new Set(['voorkeur1', 'voorkeur2', 'clubId', 'tegenstander', 'opstelling', 'tot', 'verzamelen', 'spelen', 'fruit', 'begeleider1', 'begeleider2', 'notitie'])

export function schoon(soort: Soort, r: Record<string, unknown>): Record<string, unknown> {
  const uit: Record<string, unknown> = {}
  for (const v of VELDEN[soort]) uit[v] = r[v] ?? (TEKST.has(v) ? '' : v === 'thuis' ? false : null)
  return uit
}

export const gelijk = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const perId = (lijst: Record<string, unknown>[], soort: Soort): Records =>
  Object.fromEntries(lijst.map(r => [r.id as string, schoon(soort, r)]))

// Van de app-state naar records
export function naarRecords(spelers: Player[], vastePosities: Record<string, string[]>, clubs: Club[], wedstrijden: GespeeldeWedstrijd[], programma: ProgrammaItem[] = []): Alles {
  return {
    spelers: perId(spelers.map(s => ({ id: s.id, naam: s.naam, voorkeur1: vastePosities[s.id]?.[0] ?? '', voorkeur2: vastePosities[s.id]?.[1] ?? '' })), 'spelers'),
    clubs: perId(clubs as unknown as Record<string, unknown>[], 'clubs'),
    wedstrijden: perId(wedstrijden as unknown as Record<string, unknown>[], 'wedstrijden'),
    programma: perId(programma as unknown as Record<string, unknown>[], 'programma'),
  }
}

export interface Actie { soort: Soort; soortActie: 'create' | 'update' | 'delete'; id: string; data?: Record<string, unknown> }

// Aanmaken van clubs en spelers vóór wedstrijden; verwijderen daarna
// Expliciet verwijderd op dit toestel (per soort de id's). Alleen deze worden op de server verwijderd:
// iets dat lokaal (nog) ontbreekt is geen reden om te wissen (zo verdwenen eens nieuwe wedstrijden van de server)
export type Verwijderd = Record<Soort, string[]>
export const GEEN_VERWIJDERD: Verwijderd = perSoort(() => [])

export function acties(lokaal: Alles, basis: Alles, verwijderd: Verwijderd = GEEN_VERWIJDERD): Actie[] {
  const maak: Actie[] = []
  const weg: Actie[] = []
  for (const soort of SOORTEN) {
    const l = lokaal[soort] ?? {}, b = basis[soort] ?? {}
    for (const id of Object.keys(l)) {
      if ((verwijderd[soort] ?? []).includes(id)) continue
      if (!(id in b)) maak.push({ soort, soortActie: 'create', id, data: l[id] })
      else if (!gelijk(l[id], b[id])) maak.push({ soort, soortActie: 'update', id, data: l[id] })
    }
    for (const id of verwijderd[soort] ?? []) weg.push({ soort, soortActie: 'delete', id })
  }
  return [...maak, ...weg]
}

// Wat de app na het ophalen moet hebben. 'afgewezen': lokale wijzigingen die de server weigerde → serverstand terug.
// Lokaal ontbrekend (en niet expliciet verwijderd) → serverstand, nooit 'weg'
export function samenvoegen(lokaal: Records, basis: Records, server: Records, afgewezen: Set<string> = new Set(), verwijderd: string[] = []): Records {
  const uit: Records = {}
  for (const id of new Set([...Object.keys(lokaal), ...Object.keys(basis), ...Object.keys(server)])) {
    if (verwijderd.includes(id)) continue
    const lokaalGewijzigd = lokaal[id] !== undefined && !gelijk(lokaal[id], basis[id]) && !afgewezen.has(id)
    const r = lokaalGewijzigd ? lokaal[id] : server[id]
    if (r !== undefined) uit[id] = r
  }
  return uit
}

// Records terug in de app-state. Spelers: de wedstrijdstand (veld/bank, wissels) blijft lokaal; nieuwe spelers op de bank
export function spelersToepassen(spelers: Player[], records: Records, haalWeg: (lijst: Player[], id: string) => Player[]): Player[] {
  let uit = spelers
  for (const s of spelers) if (!(s.id in records)) uit = haalWeg(uit, s.id).filter(x => x.id !== s.id)
  uit = uit.map(s => (records[s.id] && records[s.id].naam !== s.naam ? { ...s, naam: records[s.id].naam as string } : s))
  for (const [id, r] of Object.entries(records)) {
    if (!uit.some(s => s.id === id)) {
      uit = [...uit, { id, naam: r.naam as string, positie: 'LW' as Position, inVeld: false, meedoen: true, wisselCount: 0, isKeeper: false }]
    }
  }
  return uit
}

export function voorkeurenUit(records: Records): Record<string, string[]> {
  const uit: Record<string, string[]> = {}
  for (const [id, r] of Object.entries(records)) {
    if (r.voorkeur1 || r.voorkeur2) uit[id] = [(r.voorkeur1 as string) ?? '', (r.voorkeur2 as string) ?? '']
  }
  return uit
}

// Id's zoals PocketBase ze wil: 15 tekens a-z0-9
export function pbId(): string {
  const tekens = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(15)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => tekens[b % tekens.length]).join('')
}

export const isPbId = (id: string) => /^[a-z0-9]{15}$/.test(id)

// Alles wat op deze telefoon staat, met nieuwe id's, om in een team te zetten
export interface Lokaal {
  spelers: Player[]
  wisselingen: Wissel[]
  vastePosities: Record<string, string[]>
  doelpunten: (string | null)[]
  clubs: Club[]
  wedstrijd: WedstrijdInfo
  wedstrijden: GespeeldeWedstrijd[]
}

export function nieuweIds(d: Lokaal): Lokaal {
  const sp = new Map(d.spelers.map(s => [s.id, pbId()]))
  const cl = new Map(d.clubs.map(c => [c.id, pbId()]))
  // Spelers die al weg zijn maar nog in oude wedstrijden staan krijgen ook een vaste nieuwe id
  const s = (id: string | null) => (id === null ? null : sp.get(id) ?? (sp.set(id, pbId()), sp.get(id)!))
  const c = (id: string | null) => (id === null ? null : cl.get(id) ?? id)
  return {
    spelers: d.spelers.map(x => ({ ...x, id: s(x.id)! })),
    wisselingen: d.wisselingen.map(w => ({ ...w, inSpeler: s(w.inSpeler)!, uitSpeler: s(w.uitSpeler)! })),
    vastePosities: Object.fromEntries(Object.entries(d.vastePosities).filter(([id]) => sp.has(id)).map(([id, v]) => [s(id)!, v])),
    doelpunten: d.doelpunten.map(s),
    clubs: d.clubs.map(x => ({ ...x, id: c(x.id)! })),
    wedstrijd: { ...d.wedstrijd, clubId: c(d.wedstrijd.clubId) },
    wedstrijden: d.wedstrijden.map(w => ({
      ...w,
      id: pbId(),
      clubId: c(w.clubId)!,
      doelpunten: w.doelpunten.map(dp => ({ ...dp, spelerId: s(dp.spelerId) })),
      spelers: w.spelers.map(x => ({ ...x, id: s(x.id)! })),
    })),
  }
}

export const LEEG: Alles = perSoort(() => ({}))
const kopie = (a: Alles): Alles => perSoort(s => ({ ...(a[s] ?? {}) }))

export class GeenVerbinding extends Error {}

// Eén ronde: eerst lokale verschillen versturen, dan de serverstand ophalen en samenvoegen.
// 'lokaalNu' wordt na het versturen opnieuw gelezen: wat er intussen lokaal veranderde gaat niet verloren
export async function synchroniseer(pb: PocketBase, teamId: string, lokaalNu: () => Alles, basisVoor: Alles, verwijderd: Verwijderd = GEEN_VERWIJDERD) {
  const basis = kopie(basisVoor)
  const afgewezen: Record<Soort, Set<string>> = perSoort(() => new Set<string>())
  // Verwijderingen die de server heeft verwerkt (of die er al niet meer waren): mogen uit de lijst
  const verwerkt: Verwijderd = perSoort(() => [])

  for (const a of acties(lokaalNu(), basis, verwijderd)) {
    try {
      const col = pb.collection(a.soort)
      if (a.soortActie === 'create') await col.create({ ...a.data, team: teamId })
      else if (a.soortActie === 'update') {
        const { id: _id, ...velden } = a.data!
        await col.update(a.id, velden)
      } else await col.delete(a.id)
      if (a.soortActie === 'delete') {
        delete basis[a.soort][a.id]
        verwerkt[a.soort].push(a.id)
      } else basis[a.soort][a.id] = a.data!
    } catch (err) {
      // Geen verbinding: later opnieuw. Geweigerd (geen rechten, ongeldig, al weg): terug naar de serverstand
      const status = (err as { status?: number }).status
      if (status === 0) throw new GeenVerbinding()
      if (a.soortActie === 'delete') verwerkt[a.soort].push(a.id)
      afgewezen[a.soort].add(a.id)
    }
  }

  const server: Alles = { ...LEEG }
  try {
    for (const soort of SOORTEN) {
      const lijst = await pb.collection(soort).getFullList({ filter: pb.filter('team = {:team}', { team: teamId }), batch: 500 })
      server[soort] = perId(lijst, soort)
    }
  } catch (err) {
    if ((err as { status?: number }).status === 0) throw new GeenVerbinding()
    throw err
  }

  const lokaal = lokaalNu()
  // Nog openstaande verwijderingen (niet in deze ronde verwerkt) blijven weg uit het resultaat
  const open = (soort: Soort) => (verwijderd[soort] ?? []).filter(id => !verwerkt[soort].includes(id))
  const samengevoegd: Alles = perSoort(so => samenvoegen(lokaal[so] ?? {}, basis[so] ?? {}, server[so], afgewezen[so], open(so)))
  const nogOpen: Verwijderd = perSoort(open)
  return {
    samengevoegd,
    basis: server,
    verwerkt,
    wachtend: acties(samengevoegd, server, nogOpen).length,
    serverLeeg: SOORTEN.every(s => Object.keys(server[s]).length === 0),
  }
}
