import { useEffect, useRef, useState } from 'react'
import { HockeyProvider } from './context/HockeyContext'
import { AccountProvider, useAccount } from './context/AccountContext'
import { useHockey } from './context/HockeyContext'
import ResetModal from './components/ResetModal'
import Instellingen, { AccountStart } from './screens/Instellingen'
import Dashboard from './screens/Dashboard'
import Players from './screens/Players'
import Positions from './screens/Positions'
import Historie from './screens/Historie'
import Verversen from './components/Verversen'
import './App.css'

type Scherm = 'dashboard' | 'players' | 'positions' | 'historie' | 'instellingen'

// Vijf namen passen niet naast elkaar op een smalle telefoon: iconen even breed; alleen het actieve tabblad toont
// zijn naam eronder (die mag uitlopen onder de lege plek van de buren; aan de randen uitgelijnd met de schermrand)
const TABS: { id: Scherm; icoon: string; naam: string }[] = [
  { id: 'dashboard', icoon: '🏑', naam: 'Dashboard' },
  { id: 'players', icoon: '👥', naam: 'Spelers' },
  { id: 'positions', icoon: '⭐', naam: 'Voorkeur' },
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
  const { sync, live } = useHockey()
  const syncProbleem = !!((sync && (sync.offline || sync.fout)) || (live && !live.verbonden))

  return (
    <div className="mobile-frame">
      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${screen === tab.id ? 'active' : ''}`}
            onClick={() => setScreen(tab.id)}
            aria-label={tab.naam}
            title={tab.naam}
            aria-current={screen === tab.id ? 'page' : undefined}
          >
            <span className="tab-icoon" aria-hidden="true">{tab.icoon}</span>
            {screen === tab.id && <span className="tab-naam" aria-hidden="true">{tab.naam}</span>}
            {tab.id === 'instellingen' && syncProbleem && <span className="tab-waarschuwing" aria-label="geen verbinding met de server">⚠</span>}
          </button>
        ))}
      </nav>

      <div className="content" ref={scrollVak}>
        {screen === 'dashboard' && <Dashboard naarInstellingen={() => setScreen('instellingen')} />}
        {screen === 'players' && <Players />}
        {screen === 'positions' && <Positions />}
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
  const { actiefTeamId, magBewerken } = useAccount()
  const [screen, setScreen] = useState<Scherm>('dashboard')
  const [start, setStart] = useState<AccountStart>(null)

  // Links uit mail of app: #uitnodiging=…, #wachtwoord=…, #aanmelding=… of #kijk=… (meekijklink). Daarna het # weghalen, zodat verversen het niet opnieuw opent
  useEffect(() => {
    const m = window.location.hash.match(/^#(uitnodiging|wachtwoord|aanmelding|kijk)=(.+)$/)
    if (!m) return
    setStart({ soort: m[1] as 'uitnodiging' | 'wachtwoord' | 'aanmelding' | 'kijk', token: decodeURIComponent(m[2]) })
    setScreen('instellingen')
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  return (
    <HockeyProvider key={actiefTeamId ?? 'lokaal'} teamId={actiefTeamId} magBewerken={magBewerken}>
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
