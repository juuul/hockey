import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { Club, GespeeldeWedstrijd, ProgrammaItem, isOpstelling, leesOpstelling, OpstellingNaam, OPSTELLINGEN_PER_SPELVORM, Player, Position, Spelvorm, spelvormVan, veldPosities, Wissel, WedstrijdInfo } from '../types'
import { nieuweOpstelling as lootOpstelling, resetTellers, stempelInkomers, haalUitVeld, zetMeedoen as zetMeedoenIn, plaatsIn as plaatsInOpstelling, pasOpstellingAan, naamBezet } from '../opstelling'
import { vandaag, vindClub } from '../historie'
import { lees, OPSLAG, schrijf, teamOpslag } from '../opslag'
import { Alles, GEEN_VERWIJDERD, Lokaal, naarRecords, nieuweIds, pbId, perSoort, Soort, spelersToepassen, Verwijderd, voorkeurenUit } from '../sync'
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

// Aangepaste stand van een opgeslagen wedstrijd: 'wij' volgt uit het aantal doelpunten
export interface OpgeslagenStand {
  zij: number
  doelpunten: GespeeldeWedstrijd['doelpunten']
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
  haalDoelpuntWeg: (scorerId: string | null) => void
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
  programma: ProgrammaItem[]
  bewaarProgramma: (item: ProgrammaItem) => void
  verwijderProgramma: (id: string) => void
  wedstrijdAfsluiten: (info: WedstrijdInfo, tegenstander: string) => void
  wijzigWedstrijd: (id: string, info: WedstrijdInfo, tegenstander: string, stand?: OpgeslagenStand) => void
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

// Zonder team (niet ingelogd): de namen van het testteam, 11 spelers met keeper en twee wissels
const INITIAL_PLAYERS: Player[] = [
  { id: '1', naam: 'Yara', positie: 'LW', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '2', naam: 'Roos', positie: 'CV', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '3', naam: 'Nina', positie: 'RW', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '4', naam: 'Tess', positie: 'LM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '5', naam: 'Emma', positie: 'LCM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '6', naam: 'Lotte', positie: 'RCM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '7', naam: 'Fleur', positie: 'RM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '8', naam: 'Mila', positie: 'LBM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '9', naam: 'Lieke', positie: 'CBM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '10', naam: 'Noor', positie: 'RBM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '11', naam: 'Saar', positie: 'K', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: true },
  { id: '12', naam: 'Etter', positie: 'LW', inVeld: false, meedoen: true, wisselCount: 1, isKeeper: false },
  { id: '13', naam: 'Bakje', positie: 'RW', inVeld: false, meedoen: true, wisselCount: 1, isKeeper: false },
]

// Vroeger begon de app zonder team met de echte namen. Die (herkend aan id 1–11 en een hash van de naam,
// zodat de namen zelf niet in de openbare code staan) worden de namen van het testteam; de rest blijft staan.
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
    if (!saved) return teamId ? [] : INITIAL_PLAYERS
    const lijst: Player[] = JSON.parse(saved).map((sp: Player) => ({ ...sp, meedoen: sp.meedoen ?? true }))
    return teamId ? lijst : vervangOudeNamen(lijst)
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
    const bekend = leesOpstelling(saved)
    if (bekend) return bekend
    // Vorige versie bewaarde alleen de spelvorm (9 of 6)
    const oudeSpelvorm = localStorage.getItem(`${P}_spelvorm`)
    return OPSTELLINGEN_PER_SPELVORM[oudeSpelvorm ? (JSON.parse(oudeSpelvorm) as Spelvorm) : 11][0]
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
  const [wedstrijden, setWedstrijden] = useState<GespeeldeWedstrijd[]>(() => {
    const lijst = lees<GespeeldeWedstrijd[]>(P, 'wedstrijden', [])
    return teamId ? lijst : lijst.map(vervangOudeNamenWedstrijd)
  })
  // Wat op dit toestel expliciet is verwijderd en nog naar de server moet (alleen dat wordt daar gewist)
  const [programma, setProgramma] = useState<ProgrammaItem[]>(() => lees(P, 'programma', []))
  useEffect(() => { schrijf(P, 'programma', programma) }, [programma])
  const [verwijderd, setVerwijderd] = useState<Verwijderd>(() => ({ ...GEEN_VERWIJDERD, ...lees<Partial<Verwijderd>>(P, 'verwijderd', {}) }))
  useEffect(() => { schrijf(P, 'verwijderd', verwijderd) }, [verwijderd])
  const markeerVerwijderd = (soort: Soort, id: string) =>
    setVerwijderd(v => ((v[soort] ?? []).includes(id) ? v : { ...v, [soort]: [...(v[soort] ?? []), id] }))

  // Programma: toevoegen of bijwerken (zelfde id), en verwijderen
  const bewaarProgramma = (item: ProgrammaItem) =>
    setProgramma(huidig => (huidig.some(p => p.id === item.id) ? huidig.map(p => (p.id === item.id ? item : p)) : [...huidig, item]))
  const verwijderProgramma = (id: string) => {
    setProgramma(huidig => huidig.filter(p => p.id !== id))
    markeerVerwijderd('programma', id)
  }

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
    // Dubbele naam in het team: niet toevoegen (het venster meldt dit al; dit is de vangrail)
    if (naamBezet(spelers.map(s => s.naam), naam)) return
    remember()
    const newId = pbId()
    const newSpeler: Player = {
      id: newId,
      naam: naam.trim().replace(/\s+/g, ' '),
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
    markeerVerwijderd('spelers', id)
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
    markeerVerwijderd('clubs', id)
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

  const wijzigWedstrijd = (id: string, info: WedstrijdInfo, tegenstander: string, stand?: OpgeslagenStand) =>
    setWedstrijden(wedstrijden.map(w => (w.id === id && info.clubId
      ? {
          ...w,
          datum: info.datum ?? w.datum,
          clubId: info.clubId,
          tegenstander,
          thuis: info.thuis,
          ...(stand ? { wij: stand.doelpunten.length, zij: stand.zij, doelpunten: stand.doelpunten } : {}),
        }
      : w)))

  const verwijderWedstrijd = (id: string) => {
    setWedstrijden(wedstrijden.filter(w => w.id !== id))
    markeerVerwijderd('wedstrijden', id)
  }

  const resetScore = () => {
    remember()
    setScore({ wij: 0, zij: 0 })
    setDoelpunten([])
  }

  // Eén doelpunt van ons weg bij deze scorer (de laatste van hem/haar); onbekend in de lijst → het laatste doelpunt
  const haalDoelpuntWeg = (scorerId: string | null) => {
    if (score.wij === 0) return
    remember()
    setScore({ ...score, wij: score.wij - 1 })
    const i = doelpunten.lastIndexOf(scorerId)
    setDoelpunten(doelpunten.filter((_, j) => j !== (i >= 0 ? i : doelpunten.length - 1)))
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
  const records = naarRecords(spelers, vastePosities, clubs, wedstrijden, programma)
  const toepassen = (nieuw: Alles) => {
    const oud = naarRecords(spelers, vastePosities, clubs, wedstrijden, programma)
    if (JSON.stringify(nieuw.programma) !== JSON.stringify(oud.programma)) setProgramma(Object.values(nieuw.programma) as unknown as ProgrammaItem[])
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
  // Door de server verwerkte verwijderingen uit de lijst halen
  const verwijderdVerwerkt = (verwerkt: Verwijderd) =>
    setVerwijderd(v => perSoort(so => (v[so] ?? []).filter(id => !verwerkt[so].includes(id))))
  const { status: sync, nuSynchroniseren } = useTeamSync({ teamId, prefix: P, records, toepassen, verwijderd, verwijderdVerwerkt })

  // ── Lopende wedstrijd live delen met het team ──
  const stand: Stand = { spelers: spelersStand(spelers), wisselingen, score, doelpunten, opstelling, timer, wedstrijd }
  const standToepassen = (st: Stand) => {
    zetSpelersRuw(huidig => spelersMetStand(huidig, st.spelers))
    setWisselingen(st.wisselingen)
    setScore(st.score)
    setDoelpunten(st.doelpunten)
    const ontvangen = leesOpstelling(st.opstelling)
    if (ontvangen) setOpstelling(ontvangen)
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
    <HockeyContext.Provider value={{ spelers, wisselingen, vastePosities, addSpeler, deleteSpeler, zetMeedoen, plaatsIn, wissel, resetWissels, nieuweOpstelling, verplaats, undo, canUndo: history.length > 0, setVastePositie, score, scoor, haalDoelpuntWeg, resetScore, doelpunten, spelvorm, opstelling, kiesOpstelling, timer, startTimer, pauzeTimer, stopTimer, allesResetten, clubs, clubToevoegen, hernoemClub, verwijderClub, wedstrijd, zetWedstrijd, wedstrijden, wedstrijdAfsluiten, wijzigWedstrijd, verwijderWedstrijd, programma, bewaarProgramma, verwijderProgramma, teamId, magBewerken, sync: teamId ? sync : null, live: teamId ? live : null, nuSynchroniseren, overnemenVraag, overnemen }}>
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
