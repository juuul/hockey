import { useEffect, useRef, useState } from 'react'
import { HockeyProvider } from './context/HockeyContext'
import { AccountProvider, useAccount } from './context/AccountContext'
import { useHockey } from './context/HockeyContext'
import ResetModal from './components/ResetModal'
import Instellingen, { AccountStart, LinkSoort } from './screens/Instellingen'
import Dashboard from './screens/Dashboard'
import Players from './screens/Players'
import Positions from './screens/Positions'
import Historie from './screens/Historie'
import Programma from './screens/Programma'
import Verversen from './components/Verversen'
import { OPSLAG } from './opslag'
import './App.css'

type Scherm = 'dashboard' | 'players' | 'positions' | 'programma' | 'historie' | 'instellingen'

// Zes namen passen niet naast elkaar op een smalle telefoon: iconen even breed; alleen het actieve tabblad toont
// zijn naam eronder (die mag uitlopen onder de lege plek van de buren; aan de randen uitgelijnd met de schermrand)
const TABS: { id: Scherm; icoon: string; naam: string }[] = [
  { id: 'dashboard', icoon: '🏑', naam: 'Wedstrijd' },
  { id: 'players', icoon: '👥', naam: 'Spelers' },
  { id: 'positions', icoon: '⭐', naam: 'Voorkeur' },
  { id: 'programma', icoon: '📅', naam: 'Programma' },
  { id: 'historie', icoon: '📊', naam: 'Historie' },
  { id: 'instellingen', icoon: '⚙️', naam: 'Instellingen' },
]

interface Navigatie {
  screen: Scherm
  setScreen: (s: Scherm) => void
  start: AccountStart
  startGebruikt: () => void
}

function AppContent({ screen, setScreen, start, startGebruikt }: Navigatie) {
  const scrollVak = useRef<HTMLDivElement>(null)
  const { sync, live, demo, clubs, wedstrijd } = useHockey()
  // Het eerste tabblad heet naar de tegenstander van de wedstrijd die klaarstaat (anders 'Wedstrijd')
  const tegenstander = clubs.find(c => c.id === wedstrijd.clubId)?.naam
  const tabNaam = (tab: { id: Scherm; naam: string }) => (tab.id === 'dashboard' && tegenstander ? tegenstander : tab.naam)
  const syncProbleem = !!((sync && (sync.offline || sync.fout)) || (live && !live.verbonden))
  // Open aanvragen (toegang tot een team, nieuwe teams): aantal op het tandwiel
  const { aanvragen } = useAccount()
  const aantalAanvragen = aanvragen.toegang.length + aanvragen.teams.length

  return (
    <div className="mobile-frame">
      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${screen === tab.id ? 'active' : ''}`}
            onClick={() => setScreen(tab.id)}
            aria-label={tabNaam(tab)}
            title={tabNaam(tab)}
            aria-current={screen === tab.id ? 'page' : undefined}
          >
            <span className="tab-icoon" aria-hidden="true">{tab.icoon}</span>
            {screen === tab.id && <span className="tab-naam" aria-hidden="true">{tabNaam(tab)}</span>}
            {tab.id === 'instellingen' && syncProbleem && <span className="tab-waarschuwing" aria-label="geen verbinding met de server">⚠</span>}
            {tab.id === 'instellingen' && !syncProbleem && aantalAanvragen > 0 && <span className="tab-teller" aria-label={`${aantalAanvragen} aanvragen`}>{aantalAanvragen}</span>}
          </button>
        ))}
      </nav>

      <div className="content" ref={scrollVak}>
        {/* Niet ingelogd: alles werkt, maar alleen op deze telefoon; de weg naar inloggen */}
        {demo && screen !== 'dashboard' && screen !== 'instellingen' && (
          <div className="demo-kop">
            <button className="inlog-balk" onClick={() => setScreen('instellingen')}>
              <span aria-hidden="true">👤</span> Inloggen
            </button>
            <p className="demo-uitleg">Zonder account staat alles alleen op deze telefoon. Log in om het met je team te delen.</p>
          </div>
        )}
        {screen === 'dashboard' && <Dashboard naarInstellingen={() => setScreen('instellingen')} />}
        {screen === 'players' && <Players />}
        {screen === 'positions' && <Positions />}
        {screen === 'programma' && <Programma naarDashboard={() => setScreen('dashboard')} />}
        {screen === 'historie' && <Historie />}
        {screen === 'instellingen' && <Instellingen start={start} startGebruikt={startGebruikt} naarDashboard={() => setScreen('dashboard')} />}
      </div>
      <Verversen scrollVak={scrollVak} />
      <OvernemenVraag />
    </div>
  )
}

// Eerste keer in een leeg team: meenemen wat op deze telefoon staat?
function OvernemenVraag() {
  const { overnemenVraag, overnemen } = useHockey()
  const { actiefTeam } = useAccount()
  if (!overnemenVraag) return null
  const { spelers, clubs, wedstrijden } = overnemenVraag
  return (
    <ResetModal
      titel={`Gegevens naar ${actiefTeam?.naam ?? 'het team'}?`}
      regels={[
        { icoon: '👥', tekst: `${spelers} spelers met voorkeuren` },
        { icoon: '🏟', tekst: `${clubs} clubs` },
        { icoon: '📊', tekst: `${wedstrijden} wedstrijden` },
        { icoon: '📱', tekst: 'Wat nu op deze telefoon staat, komt in het team' },
      ]}
      bevestig="Ja, meenemen"
      annuleer="Nee, leeg beginnen"
      onConfirm={() => overnemen(true)}
      onCancel={() => overnemen(false)}
    />
  )
}

// Per team een eigen set gegevens: bij een ander team begint de app-state opnieuw (key).
// Het gekozen tabblad staat hierboven, zodat je na inloggen of van team wisselen op dezelfde plek blijft
function MetTeam() {
  const { gebruiker, actiefTeamId, magBewerken } = useAccount()
  const demo = !gebruiker
  // Na verversen op hetzelfde tabblad blijven (per browsertabblad; een nieuwe keer openen begint op het Dashboard)
  const [screen, zetScreen] = useState<Scherm>(() => {
    try {
      const t = sessionStorage.getItem(`${OPSLAG}_tabblad`)
      return TABS.some(x => x.id === t) ? (t as Scherm) : 'dashboard'
    } catch {
      return 'dashboard'
    }
  })
  const setScreen = (s: Scherm) => {
    zetScreen(s)
    try { sessionStorage.setItem(`${OPSLAG}_tabblad`, s) } catch { /* geen opslag */ }
  }
  const [start, setStart] = useState<AccountStart>(null)

  // Links uit mail of app: #uitnodiging=…, #wachtwoord=…, #aanmelding=… of #kijk=… (meekijklink). Daarna het # weghalen, zodat verversen het niet opnieuw opent
  useEffect(() => {
    const m = window.location.hash.match(/^#(uitnodiging|wachtwoord|aanmelding|kijk|aanvraag|toegang)=(.+)$/)
    if (!m) return
    setStart({ soort: m[1] as LinkSoort, token: decodeURIComponent(m[2]) })
    setScreen('instellingen')
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  return (
    <HockeyProvider key={demo ? 'demo' : actiefTeamId ?? 'lokaal'} teamId={demo ? null : actiefTeamId} magBewerken={magBewerken} demo={demo}>
      <AppContent screen={screen} setScreen={setScreen} start={start} startGebruikt={() => setStart(null)} />
    </HockeyProvider>
  )
}

export default function App() {
  return (
    <AccountProvider>
      <MetTeam />
    </AccountProvider>
  )
}
