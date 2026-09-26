import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { Club, GespeeldeWedstrijd, isOpstelling, OpstellingNaam, OPSTELLINGEN_PER_SPELVORM, Player, Position, Spelvorm, spelvormVan, veldPosities, Wissel, WedstrijdInfo } from '../types'
import { nieuweOpstelling as lootOpstelling, resetTellers, stempelInkomers, haalUitVeld, zetMeedoen as zetMeedoenIn, plaatsIn as plaatsInOpstelling, pasOpstellingAan } from '../opstelling'
import { vandaag, vindClub } from '../historie'
import { lees, OPSLAG, schrijf, teamOpslag } from '../opslag'
import { Alles, Lokaal, naarRecords, nieuweIds, pbId, spelersToepassen, voorkeurenUit } from '../sync'
import { SyncStatus, useTeamSync } from './useTeamSync'
import { LiveStand, LiveStatus, useLiveStand } from './useLiveStand'
import { Stand, spelersMetStand, spelersStand } from '../live'

// Starttijdstip + opgebouwde tijd i.p.v. een teller: zo klopt de tijd ook na verversen of een vergrendeld scherm
export interface TimerStand {
  gestartOp: number | null
  opgebouwd: number
}

export interface Score {
  wij: number
  zij: number
}

interface HockeyContextType {
  spelers: Player[]
  wisselingen: Wissel[]
  vastePosities: Record<string, string[]>
  addSpeler: (naam: string) => void
  deleteSpeler: (id: string) => void
  zetMeedoen: (id: string, meedoen: boolean) => void
  plaatsIn: (id: string, positie: Position) => void
  wissel: (uitId: string, inId: string, positie: string) => void
  resetWissels: () => void
  nieuweOpstelling: () => void
  verplaats: (idA: string, idB: string) => void
  undo: () => void
  canUndo: boolean
  score: Score
  scoor: (team: keyof Score, verschil: 1 | -1, scorerId?: string | null) => void
  doelpunten: (string | null)[]
  spelvorm: Spelvorm
  timer: TimerStand
  startTimer: () => void
  pauzeTimer: () => void
  stopTimer: () => void
  allesResetten: () => void
  opstelling: OpstellingNaam
  kiesOpstelling: (opstelling: OpstellingNaam) => void
  resetScore: () => void
  setVastePositie: (spelerId: string, keuze: number, positie: string | null) => void
  clubs: Club[]
  clubToevoegen: (naam: string) => string
  hernoemClub: (id: string, naam: string) => void
  verwijderClub: (id: string) => void
  wedstrijd: WedstrijdInfo
  zetWedstrijd: (info: WedstrijdInfo) => void
  wedstrijden: GespeeldeWedstrijd[]
  wedstrijdAfsluiten: (info: WedstrijdInfo, tegenstander: string) => void
  wijzigWedstrijd: (id: string, info: WedstrijdInfo, tegenstander: string) => void
  verwijderWedstrijd: (id: string) => void
  teamId: string | null
  magBewerken: boolean
  sync: SyncStatus | null
  live: LiveStatus | null
  nuSynchroniseren: () => void
  overnemenVraag: { spelers: number; clubs: number; wedstrijden: number } | null
  overnemen: (ja: boolean) => void
}

const LEGE_WEDSTRIJD: WedstrijdInfo = { datum: null, clubId: null, thuis: true }

const HockeyContext = createContext<HockeyContextType | undefined>(undefined)

const INITIAL_PLAYERS: Player[] = [
  { id: '1', naam: 'Lizzy', positie: 'LW', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '2', naam: 'Fee', positie: 'RW', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '3', naam: 'Sarah', positie: 'LM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '4', naam: 'Isa', positie: 'CM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '5', naam: 'Evi', positie: 'RM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '6', naam: 'Aster', positie: 'LBM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '7', naam: 'Floor', positie: 'CBM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '8', naam: 'Carice', positie: 'RBM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '9', naam: 'Julia', positie: 'K', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: true },
  { id: '10', naam: 'Sara', positie: 'LW', inVeld: false, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '11', naam: 'Benthe', positie: 'RW', inVeld: false, meedoen: true, wisselCount: 0, isKeeper: false },
]

interface ProviderProps {
  children: React.ReactNode
  teamId?: string | null
  magBewerken?: boolean
}

// Met een team: eigen opslag per team en synchroniseren met de server. Zonder team: alleen deze telefoon
export function HockeyProvider({ children, teamId = null, magBewerken = true }: ProviderProps) {
  const P = teamOpslag(teamId)

  const [spelers, zetSpelersRuw] = useState<Player[]>(() => {
    const saved = localStorage.getItem(`${P}_spelers`)
    // Oudere versies kenden 'meedoen' nog niet
    return saved ? JSON.parse(saved).map((sp: Player) => ({ ...sp, meedoen: sp.meedoen ?? true })) : teamId ? [] : INITIAL_PLAYERS
  })

  const [wisselingen, setWisselingen] = useState<Wissel[]>(() => {
    const saved = localStorage.getItem(`${P}_wisselingen`)
    return saved ? JSON.parse(saved) : []
  })

  const [vastePosities, setVastePositiesState] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem(`${P}_vaste_posities`)
    const parsed: Record<string, string | string[]> = saved ? JSON.parse(saved) : {}
    // Oudere versie bewaarde één positie per speler als string
    return Object.fromEntries(Object.entries(parsed).map(([id, v]) => [id, typeof v === 'string' ? [v, ''] : v]))
  })

  const [score, setScore] = useState<Score>(() => {
    const saved = localStorage.getItem(`${P}_score`)
    return saved ? JSON.parse(saved) : { wij: 0, zij: 0 }
  })

  const setSpelers = (nieuw: Player[]) => zetSpelersRuw(stempelInkomers(spelers, nieuw))

  // Scorers van onze doelpunten, in volgorde; null = onbekend
  const [doelpunten, setDoelpunten] = useState<(string | null)[]>(() => {
    const saved = localStorage.getItem(`${P}_doelpunten`)
    return saved ? JSON.parse(saved) : []
  })

  const [opstelling, setOpstelling] = useState<OpstellingNaam>(() => {
    const saved = lees<unknown>(P, 'opstelling', null)
    if (isOpstelling(saved)) return saved
    // Kort op test bestaande 11-tallen onder hun oude naam
    if (saved === '3-3-3-1') return '2-4-4'
    if (saved === '4-3-3') return '3-3-4'
    // Vorige versie bewaarde alleen de spelvorm (9 of 6)
    const oudeSpelvorm = localStorage.getItem(`${P}_spelvorm`)
    return OPSTELLINGEN_PER_SPELVORM[oudeSpelvorm ? (JSON.parse(oudeSpelvorm) as Spelvorm) : 9][0]
  })
  const spelvorm = spelvormVan(opstelling)
  const posities = veldPosities(opstelling)

  // Een veldspeler op een plek die in deze opstelling niet (meer) bestaat (bv. een vervallen opstelling
  // of een oude stand van een ander toestel): naar een vrije plek schuiven
  useEffect(() => {
    if (spelers.some(s => s.inVeld && !s.isKeeper && !posities.includes(s.positie))) {
      zetSpelersRuw(huidig => pasOpstellingAan(huidig, posities))
    }
  }, [spelers, opstelling])

  useEffect(() => {
    localStorage.setItem(`${P}_opstelling`, JSON.stringify(opstelling))
  }, [opstelling])

  const [timer, setTimer] = useState<TimerStand>(() => {
    try {
      const saved = localStorage.getItem(`${P}_timer`)
      if (saved) return JSON.parse(saved)
    } catch {
      // kapotte of geblokkeerde opslag: begin gewoon op 0
    }
    return { gestartOp: null, opgebouwd: 0 }
  })

  useEffect(() => {
    localStorage.setItem(`${P}_timer`, JSON.stringify(timer))
  }, [timer])

  const startTimer = () => setTimer({ ...timer, gestartOp: Date.now() })
  const pauzeTimer = () => setTimer({ gestartOp: null, opgebouwd: timer.opgebouwd + (timer.gestartOp !== null ? Date.now() - timer.gestartOp : 0) })
  const stopTimer = () => setTimer({ gestartOp: null, opgebouwd: 0 })

  const [clubs, setClubs] = useState<Club[]>(() => lees(P, 'clubs', []))
  const [wedstrijd, zetWedstrijd] = useState<WedstrijdInfo>(() => lees(P, 'wedstrijd', LEGE_WEDSTRIJD))
  const [wedstrijden, setWedstrijden] = useState<GespeeldeWedstrijd[]>(() => lees(P, 'wedstrijden', []))

  useEffect(() => {
    localStorage.setItem(`${P}_clubs`, JSON.stringify(clubs))
  }, [clubs])

  useEffect(() => {
    localStorage.setItem(`${P}_wedstrijd`, JSON.stringify(wedstrijd))
  }, [wedstrijd])

  useEffect(() => {
    localStorage.setItem(`${P}_wedstrijden`, JSON.stringify(wedstrijden))
  }, [wedstrijden])

  const [history, setHistory] = useState<{ spelers: Player[]; wisselingen: Wissel[]; score: Score; doelpunten: (string | null)[] }[]>([])

  const remember = () => {
    setHistory(h => [...h, { spelers, wisselingen, score, doelpunten }])
  }

  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    zetSpelersRuw(last.spelers)
    setWisselingen(last.wisselingen)
    setScore(last.score)
    setDoelpunten(last.doelpunten)
    setHistory(history.slice(0, -1))
  }

  useEffect(() => {
    localStorage.setItem(`${P}_spelers`, JSON.stringify(spelers))
  }, [spelers])

  useEffect(() => {
    localStorage.setItem(`${P}_wisselingen`, JSON.stringify(wisselingen))
  }, [wisselingen])

  useEffect(() => {
    localStorage.setItem(`${P}_score`, JSON.stringify(score))
  }, [score])

  useEffect(() => {
    localStorage.setItem(`${P}_doelpunten`, JSON.stringify(doelpunten))
  }, [doelpunten])

  useEffect(() => {
    localStorage.setItem(`${P}_vaste_posities`, JSON.stringify(vastePosities))
  }, [vastePosities])

  const addSpeler = (naam: string) => {
    remember()
    const newId = pbId()
    const newSpeler: Player = {
      id: newId,
      naam,
      positie: 'LW',
      inVeld: false,
      meedoen: true,
      wisselCount: 0,
      isKeeper: false,
    }
    setSpelers([...spelers, newSpeler])
  }

  const deleteSpeler = (id: string) => {
    remember()
    setSpelers(haalUitVeld(spelers, id).filter(s => s.id !== id))
  }

  const zetMeedoen = (id: string, meedoen: boolean) => {
    remember()
    setSpelers(zetMeedoenIn(spelers, id, meedoen, posities))
  }

  const plaatsIn = (id: string, positie: Position) => {
    remember()
    setSpelers(plaatsInOpstelling(spelers, id, positie))
  }


  const wissel = (uitId: string, inId: string, positie: string) => {
    remember()
    setSpelers(spelers.map(s => {
      if (s.id === inId) {
        return { ...s, inVeld: true, positie: positie as Player['positie'] }
      }
      if (s.id === uitId) {
        return { ...s, inVeld: false, wisselCount: s.wisselCount + 1 }
      }
      return s
    }))

    const newWissel: Wissel = {
      id: Date.now().toString(),
      tijdstip: new Date(),
      inSpeler: inId,
      uitSpeler: uitId,
      positie: positie as any,
    }
    setWisselingen([...wisselingen, newWissel])
  }

  const verplaats = (idA: string, idB: string) => {
    const a = spelers.find(s => s.id === idA)
    const b = spelers.find(s => s.id === idB)
    if (!a || !b) return
    remember()
    setSpelers(spelers.map(s => {
      if (s.id === idA) return { ...s, positie: b.positie, isKeeper: b.isKeeper, inVeld: b.inVeld }
      if (s.id === idB) return { ...s, positie: a.positie, isKeeper: a.isKeeper, inVeld: a.inVeld }
      return s
    }))
  }

  const resetWissels = () => {
    remember()
    setSpelers(resetTellers(spelers))
    setWisselingen([])
  }

  const nieuweOpstelling = () => {
    remember()
    zetSpelersRuw(lootOpstelling(spelers, vastePosities, posities).map(s => ({ ...s, inVolgorde: 0 })))
  }

  const kiesOpstelling = (nieuw: OpstellingNaam) => {
    if (nieuw === opstelling) return
    remember()
    setOpstelling(nieuw)
    setSpelers(pasOpstellingAan(spelers, veldPosities(nieuw)))
  }

  // Nieuwe wedstrijd: opnieuw loten, tellers, score en timer terug. Spelers, aanwezigheid, voorkeuren en opstelling blijven
  const allesResetten = () => {
    remember()
    zetSpelersRuw(resetTellers(lootOpstelling(spelers, vastePosities, posities).map(s => ({ ...s, inVolgorde: 0 }))))
    setWisselingen([])
    setScore({ wij: 0, zij: 0 })
    setDoelpunten([])
    stopTimer()
  }

  // Bestaat de naam al (hoofdletters maken niet uit), dan die club
  const clubToevoegen = (naam: string) => {
    const bestaand = vindClub(clubs, naam)
    if (bestaand) return bestaand.id
    const club: Club = { id: pbId(), naam: naam.trim(), laatstGebruikt: Date.now() }
    setClubs(c => [...c, club])
    return club.id
  }

  const hernoemClub = (id: string, naam: string) =>
    setClubs(clubs.map(c => (c.id === id ? { ...c, naam: naam.trim() } : c)))

  // Oude wedstrijden houden de naam die bij het opslaan gold
  const verwijderClub = (id: string) => {
    setClubs(clubs.filter(c => c.id !== id))
    if (wedstrijd.clubId === id) zetWedstrijd({ ...wedstrijd, clubId: null })
  }

  // Bewaart de wedstrijd en begint een nieuwe (zoals Alles resetten). Niet terug te draaien met Undo.
  // De naam gaat mee omdat een net toegevoegde club nog niet in 'clubs' staat
  const wedstrijdAfsluiten = (info: WedstrijdInfo, tegenstander: string) => {
    if (!info.clubId) return
    const clubId = info.clubId
    const gespeeld: GespeeldeWedstrijd = {
      id: pbId(),
      datum: info.datum ?? vandaag(),
      clubId,
      tegenstander,
      thuis: info.thuis,
      wij: score.wij,
      zij: score.zij,
      doelpunten: doelpunten.map(id => ({ spelerId: id, naam: spelers.find(s => s.id === id)?.naam ?? 'Onbekend' })),
      spelers: spelers.filter(s => s.meedoen).map(s => ({ id: s.id, naam: s.naam, wissels: s.wisselCount })),
      opstelling,
      opgeslagenOp: Date.now(),
    }
    setWedstrijden(w => [...w, gespeeld])
    setClubs(c => c.map(club => (club.id === clubId ? { ...club, laatstGebruikt: Date.now() } : club)))
    zetWedstrijd({ ...LEGE_WEDSTRIJD, thuis: info.thuis })
    allesResetten()
    setHistory([])
  }

  const wijzigWedstrijd = (id: string, info: WedstrijdInfo, tegenstander: string) =>
    setWedstrijden(wedstrijden.map(w => (w.id === id && info.clubId
      ? { ...w, datum: info.datum ?? w.datum, clubId: info.clubId, tegenstander, thuis: info.thuis }
      : w)))

  const verwijderWedstrijd = (id: string) => setWedstrijden(wedstrijden.filter(w => w.id !== id))

  const resetScore = () => {
    remember()
    setScore({ wij: 0, zij: 0 })
    setDoelpunten([])
  }

  const scoor = (team: keyof Score, verschil: 1 | -1, scorerId: string | null = null) => {
    if (score[team] + verschil < 0) return
    remember()
    setScore({ ...score, [team]: score[team] + verschil })
    if (team === 'wij') setDoelpunten(verschil === 1 ? [...doelpunten, scorerId] : doelpunten.slice(0, -1))
  }




  const setVastePositie = (spelerId: string, keuze: number, positie: string | null) => {
    const keuzes = [...(vastePosities[spelerId] ?? ['', ''])]
    keuzes[keuze] = positie ?? ''
    const newVaste = { ...vastePosities }
    if (keuzes.every(k => !k)) delete newVaste[spelerId]
    else newVaste[spelerId] = keuzes
    setVastePositiesState(newVaste)
  }


  // ── Synchroniseren met het team op de server ──
  const records = naarRecords(spelers, vastePosities, clubs, wedstrijden)
  const toepassen = (nieuw: Alles) => {
    const oud = naarRecords(spelers, vastePosities, clubs, wedstrijden)
    if (JSON.stringify(nieuw.spelers) !== JSON.stringify(oud.spelers)) {
      zetSpelersRuw(huidig => {
        const bijgewerkt = spelersToepassen(huidig, nieuw.spelers, haalUitVeld)
        // Net binnengekomen spelers: hun plek (veld/bank, wissels) staat misschien al in de live stand van het team
        const bekendeStand = liveRef.current?.bekend()?.spelers ?? {}
        return bijgewerkt.map(sp => (huidig.some(h => h.id === sp.id) || !bekendeStand[sp.id] ? sp : { ...sp, ...bekendeStand[sp.id] }))
      })
      setVastePositiesState(voorkeurenUit(nieuw.spelers))
    }
    if (JSON.stringify(nieuw.clubs) !== JSON.stringify(oud.clubs)) setClubs(Object.values(nieuw.clubs) as unknown as Club[])
    if (JSON.stringify(nieuw.wedstrijden) !== JSON.stringify(oud.wedstrijden)) setWedstrijden(Object.values(nieuw.wedstrijden) as unknown as GespeeldeWedstrijd[])
  }
  const liveRef = useRef<LiveStand | null>(null)
  const { status: sync, nuSynchroniseren } = useTeamSync({ teamId, prefix: P, records, toepassen })

  // ── Lopende wedstrijd live delen met het team ──
  const stand: Stand = { spelers: spelersStand(spelers), wisselingen, score, doelpunten, opstelling, timer, wedstrijd }
  const standToepassen = (st: Stand) => {
    zetSpelersRuw(huidig => spelersMetStand(huidig, st.spelers))
    setWisselingen(st.wisselingen)
    setScore(st.score)
    setDoelpunten(st.doelpunten)
    if (isOpstelling(st.opstelling)) setOpstelling(st.opstelling)
    setTimer(st.timer)
    zetWedstrijd(st.wedstrijd)
    // Undo van een ander toestel terugdraaien zou verwarrend zijn
    setHistory([])
  }
  const liveStand = useLiveStand({ teamId, prefix: P, stand, toepassen: standToepassen, magBewerken })
  liveRef.current = liveStand
  const live = liveStand.status

  // Eerste keer in een leeg team: aanbieden om wat op deze telefoon staat mee te nemen
  const [gevraagd, setGevraagd] = useState(() => lees(P, 'overnemen_gevraagd', false))
  const lokaalAantal = teamId && !gevraagd ? {
    spelers: lees<Player[]>(OPSLAG, 'spelers', []).length,
    clubs: lees<Club[]>(OPSLAG, 'clubs', []).length,
    wedstrijden: lees<GespeeldeWedstrijd[]>(OPSLAG, 'wedstrijden', []).length,
  } : null
  const overnemenVraag = teamId && !gevraagd && sync.geladen && sync.serverLeeg && sync.wachtend === 0
    && spelers.length === 0 && clubs.length === 0 && wedstrijden.length === 0
    && lokaalAantal && lokaalAantal.spelers + lokaalAantal.clubs + lokaalAantal.wedstrijden > 0
    ? lokaalAantal : null

  const overnemen = (ja: boolean) => {
    schrijf(P, 'overnemen_gevraagd', true)
    setGevraagd(true)
    if (!ja) return
    const d: Lokaal = nieuweIds({
      spelers: lees<Player[]>(OPSLAG, 'spelers', []).map(sp => ({ ...sp, meedoen: sp.meedoen ?? true })),
      wisselingen: lees(OPSLAG, 'wisselingen', []),
      vastePosities: lees(OPSLAG, 'vaste_posities', {}),
      doelpunten: lees(OPSLAG, 'doelpunten', []),
      clubs: lees(OPSLAG, 'clubs', []),
      wedstrijd: lees(OPSLAG, 'wedstrijd', LEGE_WEDSTRIJD),
      wedstrijden: lees(OPSLAG, 'wedstrijden', []),
    })
    zetSpelersRuw(d.spelers)
    setWisselingen(d.wisselingen)
    setVastePositiesState(d.vastePosities)
    setDoelpunten(d.doelpunten)
    setClubs(d.clubs)
    zetWedstrijd(d.wedstrijd)
    setWedstrijden(d.wedstrijden)
    setScore(lees(OPSLAG, 'score', { wij: 0, zij: 0 }))
    const oudeOpstelling = lees<unknown>(OPSLAG, 'opstelling', opstelling)
    if (isOpstelling(oudeOpstelling)) setOpstelling(oudeOpstelling)
    setTimer(lees(OPSLAG, 'timer', { gestartOp: null, opgebouwd: 0 }))
    setHistory([])
  }

  return (
    <HockeyContext.Provider value={{ spelers, wisselingen, vastePosities, addSpeler, deleteSpeler, zetMeedoen, plaatsIn, wissel, resetWissels, nieuweOpstelling, verplaats, undo, canUndo: history.length > 0, setVastePositie, score, scoor, resetScore, doelpunten, spelvorm, opstelling, kiesOpstelling, timer, startTimer, pauzeTimer, stopTimer, allesResetten, clubs, clubToevoegen, hernoemClub, verwijderClub, wedstrijd, zetWedstrijd, wedstrijden, wedstrijdAfsluiten, wijzigWedstrijd, verwijderWedstrijd, teamId, magBewerken, sync: teamId ? sync : null, live: teamId ? live : null, nuSynchroniseren, overnemenVraag, overnemen }}>
      {children}
    </HockeyContext.Provider>
  )
}

export function useHockey() {
  const context = useContext(HockeyContext)
  if (!context) {
    throw new Error('useHockey must be used within HockeyProvider')
  }
  return context
}
