import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { gastEmail, Gebruiker, pb, rolIn, STANDAARD_INSTELLINGEN, Team, TeamInstellingen } from '../server'
import { lees, OPSLAG, schrijf } from '../opslag'

interface AccountContextType {
  gebruiker: Gebruiker | null
  teams: Team[]
  teamsLaden: () => Promise<void>
  inloggen: (email: string, wachtwoord: string) => Promise<void>
  uitloggen: () => void
  actiefTeam: Team | null
  actiefTeamId: string | null
  kiesTeam: (id: string | null) => void
  magBewerken: boolean
  meekijken: (teamId: string, token: string) => Promise<void>
  mijnKinderen: string[]
  zetMijnKinderen: (ids: string[]) => void
  teamInstellingen: TeamInstellingen
  zetTeamInstellingen: (i: TeamInstellingen) => void
  aanvragen: OpenAanvragen
  aanvragenLaden: () => Promise<void>
}

// Wat een beheerder (toegang tot een team) of superadmin (nieuw team) nog moet goedkeuren
export interface ToegangAanvraag { id: string; naam: string; email: string; kindNaam: string; team: string; expand?: { team?: { naam: string } } }
export interface TeamAanmelding { id: string; teamnaam: string; naam: string; email: string; bericht: string }
export interface OpenAanvragen { toegang: ToegangAanvraag[]; teams: TeamAanmelding[] }
const GEEN_AANVRAGEN: OpenAanvragen = { toegang: [], teams: [] }

const AccountContext = createContext<AccountContextType | undefined>(undefined)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [gebruiker, setGebruiker] = useState<Gebruiker | null>(() => (pb.authStore.isValid ? (pb.authStore.record as Gebruiker) : null))
  const [teams, setTeams] = useState<Team[]>(() => lees(OPSLAG, 'teams', []))
  // Welk team de app gebruikt; bewaard zodat het ook zonder verbinding bij het opstarten klopt
  const [actiefTeamId, setActiefTeamId] = useState<string | null>(() => (pb.authStore.isValid ? lees(OPSLAG, 'actief_team', null) : null))

  const kiesTeam = (id: string | null) => {
    setActiefTeamId(id)
    schrijf(OPSLAG, 'actief_team', id)
  }

  useEffect(() => pb.authStore.onChange((_, record) => setGebruiker(pb.authStore.isValid ? (record as Gebruiker) : null)), [])

  const teamsLaden = useCallback(async () => {
    if (!pb.authStore.isValid) return setTeams([])
    const lijst = await pb.collection('teams').getFullList<Team>({ sort: 'naam', expand: 'beheerders,kijkers' })
    setTeams(lijst)
    schrijf(OPSLAG, 'teams', lijst)
    // Actief team bestaat niet meer (of nog geen keuze): bij precies één team dat nemen
    setActiefTeamId(huidig => {
      const nieuw = huidig && lijst.some(t => t.id === huidig) ? huidig : lijst.length === 1 ? lijst[0].id : null
      schrijf(OPSLAG, 'actief_team', nieuw)
      return nieuw
    })
  }, [])

  // Bij het opstarten de inlog verversen (en uitloggen als het account niet meer bestaat)
  useEffect(() => {
    if (!pb.authStore.isValid) return
    pb.collection('users').authRefresh()
      .then(() => teamsLaden())
      .catch(err => { if (err?.status === 401 || err?.status === 404) pb.authStore.clear() })
  }, [teamsLaden])

  useEffect(() => {
    if (gebruiker) return
    setTeams([])
    schrijf(OPSLAG, 'teams', [])
    setActiefTeamId(null)
    schrijf(OPSLAG, 'actief_team', null)
  }, [gebruiker])

  const inloggen = async (email: string, wachtwoord: string) => {
    await pb.collection('users').authWithPassword(email.trim().toLowerCase(), wachtwoord)
    await teamsLaden()
  }

  const uitloggen = () => pb.authStore.clear()

  // Via een meekijklink: inloggen als de gast van dat team en dat team kiezen
  const meekijken = async (teamId: string, token: string) => {
    await pb.collection('users').authWithPassword(gastEmail(teamId), token)
    await teamsLaden()
    kiesTeam(teamId)
  }

  // 'Mijn kind(eren)' per team: bij een gewoon account op de server (volgt je account), anders op deze telefoon
  const kindSleutel = `kinderen_${actiefTeamId ?? 'lokaal'}`
  const [lokaleKinderen, setLokaleKinderen] = useState<string[]>(() => lees(OPSLAG, kindSleutel, []))
  useEffect(() => { setLokaleKinderen(lees(OPSLAG, kindSleutel, [])) }, [kindSleutel])
  const opAccount = !!gebruiker && !gebruiker.gast && !!actiefTeamId
  const mijnKinderen = opAccount ? gebruiker!.kinderen?.[actiefTeamId!] ?? [] : lokaleKinderen
  const zetMijnKinderen = (ids: string[]) => {
    if (opAccount) {
      const kinderen = { ...(gebruiker!.kinderen ?? {}), [actiefTeamId!]: ids }
      // Meteen tonen; de server bevestigt (de SDK werkt dan ook de inlog-gegevens bij)
      pb.authStore.save(pb.authStore.token, { ...pb.authStore.record!, kinderen })
      pb.collection('users').update(gebruiker!.id, { kinderen }).catch(() => {})
    } else {
      setLokaleKinderen(ids)
      schrijf(OPSLAG, kindSleutel, ids)
    }
  }

  const actiefTeam = teams.find(t => t.id === actiefTeamId) ?? null

  // Team-instellingen (standaard spelbegeleiding): op het team op de server, zonder team op deze telefoon
  const [lokaleInstellingen, setLokaleInstellingen] = useState<Partial<TeamInstellingen>>(() => lees(OPSLAG, 'instellingen', {}))
  const teamInstellingen: TeamInstellingen = { ...STANDAARD_INSTELLINGEN, ...(actiefTeam ? actiefTeam.instellingen ?? {} : lokaleInstellingen) }
  const zetTeamInstellingen = (i: TeamInstellingen) => {
    if (actiefTeam) {
      setTeams(ts => ts.map(t => (t.id === actiefTeam.id ? { ...t, instellingen: i } : t)))
      pb.collection('teams').update(actiefTeam.id, { instellingen: i }).catch(() => teamsLaden().catch(() => {}))
    } else {
      setLokaleInstellingen(i)
      schrijf(OPSLAG, 'instellingen', i)
    }
  }
  // Open aanvragen: bij inloggen, elke minuut en als de app weer in beeld komt. De server laat alleen zien
  // wat jij mag behandelen (beheerders: hun teams; superadmin: alles; nieuwe teams: superadmin en vlag 'teamaanmeldingen')
  const [aanvragen, setAanvragen] = useState<OpenAanvragen>(GEEN_AANVRAGEN)
  const aanvragenLaden = useCallback(async () => {
    const wie = pb.authStore.record as Gebruiker | null
    if (!pb.authStore.isValid || !wie || wie.gast) return setAanvragen(GEEN_AANVRAGEN)
    const [toegang, teams] = await Promise.all([
      pb.collection('toegangsaanvragen').getFullList<ToegangAanvraag>({ filter: "status = 'nieuw'", sort: 'created', expand: 'team' }),
      wie.superadmin || wie.teamaanmeldingen ? pb.collection('aanmeldingen').getFullList<TeamAanmelding>({ filter: "status = 'nieuw'", sort: 'created' }) : Promise.resolve([]),
    ])
    setAanvragen({ toegang, teams })
  }, [])
  useEffect(() => {
    if (!gebruiker || gebruiker.gast) return setAanvragen(GEEN_AANVRAGEN)
    const laad = () => { aanvragenLaden().catch(() => {}) }
    laad()
    const id = setInterval(laad, 60_000)
    const zichtbaar = () => { if (document.visibilityState === 'visible') laad() }
    document.addEventListener('visibilitychange', zichtbaar)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', zichtbaar) }
  }, [gebruiker?.id, aanvragenLaden])

  // Zonder team mag je alles (alleen deze telefoon); in een team alleen als beheerder of superadmin
  const magBewerken = !actiefTeamId || !!gebruiker?.superadmin || (actiefTeam ? rolIn(actiefTeam, gebruiker?.id ?? '') === 'beheerder' : true)

  return (
    <AccountContext.Provider value={{ gebruiker, teams, teamsLaden, inloggen, uitloggen, actiefTeam, actiefTeamId, kiesTeam, magBewerken, meekijken, mijnKinderen, zetMijnKinderen, teamInstellingen, zetTeamInstellingen, aanvragen, aanvragenLaden }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (!context) throw new Error('useAccount must be used within AccountProvider')
  return context
}
