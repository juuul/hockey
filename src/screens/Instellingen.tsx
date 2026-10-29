import React, { useEffect, useState } from 'react'
import { TeamAanmelding, ToegangAanvraag, useAccount } from '../context/AccountContext'
import { useHockey } from '../context/HockeyContext'
import { appAdres, foutTekst, Gebruiker, pb, Rol, ROL_TEKST, ROL_UITLEG, ROL_VELD, rolIn, Uitnodiging } from '../server'
import { tel } from '../statistiek'
import { useTerug } from '../terug'
import DeelKijklink from '../components/DeelKijklink'
import ResetModal from '../components/ResetModal'
import { NieuweLeden, GeblokkeerdeLeden } from '../components/ToegangBeheer'
import { leesThema, Thema, zetThema } from '../thema'
import PlanningDocumenten from '../components/PlanningDocumenten'
import VerzamelenInstellen from '../components/VerzamelenInstellen'
import TeamAanmelden, { TeamKoppelen } from '../components/TeamSelectie'
import '../components/Modal.css'
import './Instellingen.css'

export type LinkSoort = 'uitnodiging' | 'wachtwoord' | 'aanmelding' | 'kijk' | 'aanvraag' | 'toegang'
export type AccountStart = { soort: LinkSoort; token: string } | null

type InstellingMenu = 'wisselen' | 'teaminstellingen' | 'verzamelen' | 'weergave' | 'account' | 'aanvragen' | 'beheer' | 'globaal' | 'planning'
type Weergave = ({ soort: 'hoofd' } | { soort: 'team'; id: string } | { soort: 'aanmelden'; keuze: 'bestaand' | 'nieuw'; stap?: 1 | 2 | 3 } | { soort: 'gebruik' | InstellingMenu } | { soort: LinkSoort; token: string }) & { terugNaar?: InstellingMenu }

const ROLLEN: Rol[] = ['beheerder', 'kijker']

// Tabblad Instellingen: account, teams en alles rond inloggen. Links uit mails openen hier een eigen weergave
export default function Instellingen({ start, startGebruikt, naarDashboard }: { start: AccountStart; startGebruikt: () => void; naarDashboard: () => void }) {
  const { gebruiker, actiefTeam } = useAccount()
  const [weergave, setWeergave] = useState<Weergave>(start ?? { soort: 'hoofd' })
  const terug = () => setWeergave(w => w.soort === 'aanmelden' && (w.stap ?? 1) > 1
    ? { ...w, stap: w.stap === 3 ? 2 : 1 }
    : { soort: w.terugNaar ?? 'hoofd' })
  useTerug(weergave.soort !== 'hoofd', terug)
  const openMenu = (soort: InstellingMenu) => setWeergave({ soort })
  const beheert = !!gebruiker && !!actiefTeam && (gebruiker.superadmin || rolIn(actiefTeam, gebruiker.id) === 'beheerder')

  useEffect(() => {
    document.querySelector('.content')?.scrollTo(0, 0)
  }, [weergave.soort])
  useEffect(() => {
    if (!gebruiker) setWeergave(w => ['team', 'gebruik', 'wisselen', 'teaminstellingen', 'verzamelen', 'account', 'aanvragen', 'beheer', 'globaal', 'planning'].includes(w.soort) ? { soort: 'hoofd' } : w)
  }, [gebruiker?.id])

  // Een link uit een mail wordt één keer geopend (niet opnieuw bij de volgende keer dit tabblad)
  useEffect(() => {
    if (!start) return
    setWeergave(start)
    startGebruikt()
  }, [start])

  const titel =
    weergave.soort === 'uitnodiging' ? 'Uitnodiging'
    : weergave.soort === 'wachtwoord' ? 'Nieuw wachtwoord'
    : weergave.soort === 'team' ? 'Leden'
    : weergave.soort === 'aanmelden' ? 'Team kiezen'
    : weergave.soort === 'gebruik' ? 'Gebruik per team'
    : weergave.soort === 'aanmelding' ? 'Teamaanmelding'
    : weergave.soort === 'kijk' ? 'Meekijken'
    : weergave.soort === 'aanvraag' ? 'Account aanvragen'
    : weergave.soort === 'toegang' ? 'Toegangsaanvraag'
    : weergave.soort === 'wisselen' ? 'Team wisselen'
    : weergave.soort === 'teaminstellingen' ? 'Teaminstellingen'
    : weergave.soort === 'verzamelen' ? 'Verzameltijd'
    : weergave.soort === 'weergave' ? 'Weergave'
    : weergave.soort === 'account' ? 'Account'
    : weergave.soort === 'aanvragen' ? 'Aanvragen'
    : weergave.soort === 'beheer' ? 'Beheer'
    : weergave.soort === 'globaal' ? 'Algemene verzameltijden'
    : weergave.soort === 'planning' ? 'Planningsdocumenten'
    : null

  return (
    <div className={`instellingen${weergave.soort === 'aanmelden' ? ' instellingen-teamkeuze' : ''}`}>
      {titel && (
        <div className="instellingen-kop">
          <button className="instellingen-terug" onClick={terug}>‹ Terug</button>
          <span className="instellingen-kop-titel">{titel}</span>
        </div>
      )}
      <div className="instellingen-inhoud">
        {weergave.soort === 'uitnodiging' && <UitnodigingAannemen token={weergave.token} klaar={terug} />}
        {weergave.soort === 'wachtwoord' && <WachtwoordKiezen token={weergave.token} klaar={terug} />}
        {weergave.soort === 'team' && gebruiker && <TeamBeheer id={weergave.id} gebruiker={gebruiker} weg={terug} />}
        {weergave.soort === 'aanmelden' && <TeamAanmelden startKeuze={weergave.keuze} stap={weergave.stap ?? 1} naarStap={stap => setWeergave(w => w.soort === 'aanmelden' ? { ...w, stap } : w)} />}
        {weergave.soort === 'gebruik' && gebruiker?.superadmin && <Gebruik />}
        {weergave.soort === 'wisselen' && gebruiker && <TeamWisselen gebruiker={gebruiker} gekozen={terug} aanmelden={keuze => setWeergave({ soort: 'aanmelden', keuze, terugNaar: 'wisselen' })} />}
        {weergave.soort === 'teaminstellingen' && beheert && <TeamInstellingen key={actiefTeam?.id} />}
        {weergave.soort === 'verzamelen' && beheert && <VerzamelenInstellen key={actiefTeam!.id} team={actiefTeam!} />}
        {weergave.soort === 'weergave' && <Weergave />}
        {weergave.soort === 'account' && gebruiker && <Account gebruiker={gebruiker} klaar={() => setWeergave({ soort: 'hoofd' })} />}
        {weergave.soort === 'aanvragen' && gebruiker && <AanvragenKaart />}
        {weergave.soort === 'globaal' && gebruiker?.superadmin && <VerzamelenInstellen />}
        {weergave.soort === 'planning' && gebruiker?.superadmin && <PlanningDocumenten />}
        {weergave.soort === 'beheer' && gebruiker?.superadmin && <div className="instellingen-menu">
          <MenuRegel tekst="Algemene verzameltijden" open={() => setWeergave({ soort: 'globaal', terugNaar: 'beheer' })} />
          <MenuRegel tekst="Planningsdocumenten" open={() => setWeergave({ soort: 'planning', terugNaar: 'beheer' })} />
          <MenuRegel tekst="Gebruik per team" open={() => setWeergave({ soort: 'gebruik', terugNaar: 'beheer' })} />
        </div>}
        {weergave.soort === 'aanmelding' && <AanmeldingBeoordelen token={weergave.token} />}
        {weergave.soort === 'aanvraag' && <ToegangAanvragen waarde={weergave.token} />}
        {weergave.soort === 'toegang' && <ToegangBeoordelen token={weergave.token} />}
        {weergave.soort === 'kijk' && <MeekijkenStart waarde={weergave.token} klaar={() => { terug(); naarDashboard() }} annuleer={terug} />}
        {weergave.soort === 'hoofd' && (gebruiker
          ? <Overzicht gebruiker={gebruiker} openTeam={id => setWeergave({ soort: 'team', id })} openMenu={openMenu} />
          : <Inloggen aanmelden={keuze => setWeergave({ soort: 'aanmelden', keuze })} />)}
        {weergave.soort === 'hoofd' && !gebruiker && <>
          <div className="instellingen-menu"><MenuRegel tekst="Weergave" sub={THEMAS.find(t => t.id === leesThema())?.naam} open={() => openMenu('weergave')} /></div>
          <p className="account-uitleg"><a href="./privacy.html" target="_blank" rel="noreferrer">Privacy</a> · <a href="./voorwaarden.html" target="_blank" rel="noreferrer">Gebruiksvoorwaarden</a></p>
        </>}
        {weergave.soort === 'hoofd' && <div className="instellingen-menu">
          <a className="instellingen-menuregel" href={import.meta.env.MODE === 'test'
            ? 'https://serverbot.taild1b3c5.ts.net/test/api/feedback/voorbeeld/feedback.html?app=hockey'
            : 'https://juliaan.eu/feedback.html?app=hockey'}><span>Feedback geven</span><span aria-hidden="true">›</span></a>
          <a className="instellingen-menuregel" href="https://juliaan.eu/"><span>Juliaan.eu</span><span aria-hidden="true">›</span></a>
        </div>}
      </div>
    </div>
  )
}

function Kaart({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="instellingen-kaart">
      <h2 className="instellingen-kaart-titel">{titel}</h2>
      {children}
    </section>
  )
}

function Melding({ tekst, fout }: { tekst: string | null; fout?: boolean }) {
  if (!tekst) return null
  return <p className={`account-melding ${fout ? 'fout' : ''}`} role={fout ? 'alert' : 'status'}>{tekst}</p>
}

// Hoe staat het met versturen naar de server?
function SyncRegel() {
  const { sync, live, nuSynchroniseren } = useHockey()
  if (!sync) return null
  const fout = sync.offline || sync.fout || (live && !live.verbonden)
  if (fout) return <button className="account-sync fout" onClick={nuSynchroniseren}>
    {sync.offline ? sync.wachtend ? 'Geen verbinding. Wijzigingen wachten.' : 'Geen verbinding. Tik om opnieuw te proberen.' : 'Synchroniseren lukt niet. Tik om opnieuw te proberen.'}
  </button>
  return <p className="instellingen-status" role="status">{!sync.geladen ? 'Gegevens ophalen…' : sync.wachtend || live?.wachtend ? 'Bijwerken…' : 'Alles bijgewerkt'}</p>
}

function Inloggen({ email: startEmail = '', aanmelden }: { email?: string; aanmelden?: (keuze: 'bestaand' | 'nieuw') => void }) {
  const { inloggen } = useAccount()
  const [email, setEmail] = useState(startEmail)
  const [wachtwoord, setWachtwoord] = useState('')
  const [bezig, setBezig] = useState(false)
  const [melding, setMelding] = useState<{ tekst: string; fout: boolean } | null>(null)

  const login = async () => {
    setBezig(true)
    setMelding(null)
    try {
      await inloggen(email, wachtwoord)
      tel('ingelogd')
    } catch (err) {
      setMelding({ tekst: (err as { status?: number }).status === 400 ? 'E-mail of wachtwoord klopt niet.' : foutTekst(err), fout: true })
    }
    setBezig(false)
  }

  const vergeten = async () => {
    if (!email.trim()) return setMelding({ tekst: 'Vul eerst je e-mailadres in.', fout: true })
    setBezig(true)
    try {
      await pb.collection('users').requestPasswordReset(email.trim().toLowerCase())
      setMelding({ tekst: `Als ${email.trim()} bekend is, staat er nu een mail klaar om een nieuw wachtwoord te kiezen.`, fout: false })
      tel('wachtwoord-vergeten')
    } catch (err) {
      setMelding({ tekst: foutTekst(err), fout: true })
    }
    setBezig(false)
  }

  const formulier = (
    <form className="account-form" onSubmit={e => { e.preventDefault(); login() }}>
      <label className="account-label">
        E-mail
        <input className="modal-input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <label className="account-label">
        Wachtwoord
        <input className="modal-input" type="password" autoComplete="current-password" value={wachtwoord} onChange={e => setWachtwoord(e.target.value)} />
      </label>
      <Melding tekst={melding?.tekst ?? null} fout={melding?.fout} />
      <button className="btn btn-primary" type="submit" disabled={bezig || !email.trim() || !wachtwoord}>Inloggen</button>
      <button className="btn btn-secondary" type="button" onClick={vergeten} disabled={bezig}>Wachtwoord vergeten</button>
    </form>
  )
  if (!aanmelden) return formulier

  return (
    <>
      <Kaart titel="Inloggen">
        {formulier}
      </Kaart>
      <Kaart titel="Je team">
        <button className="btn btn-primary" type="button" onClick={() => aanmelden('bestaand')}>Aansluiten bij een team</button>
        <button className="btn btn-secondary" type="button" onClick={() => aanmelden('nieuw')}>Nieuw team starten</button>
      </Kaart>
    </>
  )
}

function MenuRegel({ tekst, sub, open }: { tekst: string; sub?: string; open: () => void }) {
  return <button className="instellingen-menuregel" type="button" onClick={open}>
    <span>{tekst}{sub && <small>{sub}</small>}</span><span aria-hidden="true">›</span>
  </button>
}

function Overzicht({ gebruiker, openTeam, openMenu }: { gebruiker: Gebruiker; openTeam: (id: string) => void; openMenu: (menu: InstellingMenu) => void }) {
  const { teamsLaden, actiefTeam, aanvragen, uitloggen } = useAccount()
  const [fout, setFout] = useState<string | null>(null)
  useEffect(() => { teamsLaden().catch(err => setFout(foutTekst(err))) }, [teamsLaden])
  const rol = actiefTeam ? rolIn(actiefTeam, gebruiker.id) : null
  const beheert = !!actiefTeam && (gebruiker.superadmin || rol === 'beheerder')
  const aantal = aanvragen.toegang.length + aanvragen.teams.length
  return <div className="instellingen-overzicht">
    <section className="instellingen-teamoverzicht" aria-label="Je team">
      <h2>Je team</h2>
      <div className="instellingen-actief-team">
        <span><strong>{actiefTeam?.naam ?? 'Zonder team'}</strong><small>{actiefTeam ? rol ? ROL_TEKST[rol] : gebruiker.superadmin ? 'Superadmin' : 'Lid' : 'Alleen op deze telefoon'}</small></span>
        <span className="instellingen-actief-label">Actief</span>
      </div>
      <MenuRegel tekst="Team wisselen" open={() => openMenu('wisselen')} />
      <SyncRegel />
    </section>
    <DeelKijklink compact knop />
    <div className="instellingen-menu">
      {aantal > 0 && <MenuRegel tekst={`Aanvragen (${aantal})`} open={() => openMenu('aanvragen')} />}
      {beheert && <MenuRegel tekst="Leden" open={() => openTeam(actiefTeam!.id)} />}
      {beheert && <MenuRegel tekst="Teaminstellingen" open={() => openMenu('teaminstellingen')} />}
      {beheert && <MenuRegel tekst="Verzameltijd" sub="Automatisch berekend" open={() => openMenu('verzamelen')} />}
      <MenuRegel tekst="Weergave" sub={THEMAS.find(t => t.id === leesThema())?.naam} open={() => openMenu('weergave')} />
      <MenuRegel tekst="Account" open={() => openMenu('account')} />
      {gebruiker.superadmin && <MenuRegel tekst="Beheer" open={() => openMenu('beheer')} />}
    </div>
    {gebruiker.gast && <button className="btn btn-secondary" onClick={() => { uitloggen(); tel('meekijken-gestopt') }}>Stoppen met meekijken</button>}
    <Melding tekst={fout} fout />
  </div>
}

function TeamWisselen({ gebruiker, gekozen, aanmelden }: { gebruiker: Gebruiker; gekozen: () => void; aanmelden: (keuze: 'bestaand' | 'nieuw') => void }) {
  const { teams, actiefTeamId, kiesTeam } = useAccount()
  const kies = (id: string | null) => { kiesTeam(id); tel(id ? 'team-gekozen' : 'zonder-team'); gekozen() }
  return <>
    <div className="instellingen-menu">
      {teams.map(team => <button key={team.id} className="instellingen-menuregel" aria-pressed={team.id === actiefTeamId} onClick={() => kies(team.id)}>
        <span>{team.naam}<small>{rolIn(team, gebruiker.id) === 'beheerder' ? 'Beheerder' : gebruiker.superadmin ? 'Superadmin' : 'Kijker'}</small></span>
        {team.id === actiefTeamId && <span className="instellingen-actief-label">Actief</span>}
      </button>)}
      <button className="instellingen-menuregel" aria-pressed={actiefTeamId === null} onClick={() => kies(null)}>
        <span>Zonder team<small>Alleen op deze telefoon</small></span>{actiefTeamId === null && <span className="instellingen-actief-label">Actief</span>}
      </button>
    </div>
    <div className="account-form">
      <button className="btn btn-primary" onClick={() => aanmelden('bestaand')}>Aansluiten bij een team</button>
      <button className="btn btn-secondary" onClick={() => aanmelden('nieuw')}>Nieuw team starten</button>
    </div>
  </>
}

function TeamInstellingen() {
  const { actiefTeam, teamInstellingen: instellingen, bewaarTeamInstellingen } = useAccount()
  const { resetTeamRegistratie, wedstrijden, sync, live } = useHockey()
  const [resetVraag, setResetVraag] = useState<'goals' | 'speeltijd' | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const verander = async (sleutel: 'doelpuntenBijhouden' | 'speeltijdBijhouden') => {
    setBezig(true); setFout(null)
    try { await bewaarTeamInstellingen({ ...instellingen, [sleutel]: !instellingen[sleutel] }) }
    catch (err) { setFout(foutTekst(err)) }
    finally { setBezig(false) }
  }
  if (!actiefTeam) return null
  const wachtOpSync = !!(sync && (!sync.geladen || sync.offline || sync.fout || sync.wachtend)) || !!(live && (!live.verbonden || live.wachtend))
  return <>
    <Kaart titel="Bijhouden voor dit team">
      <div className="team-opties">
        {([['doelpuntenBijhouden', 'Doelpunten per speler'], ['speeltijdBijhouden', 'Speeltijd per positie']] as const).map(([sleutel, tekst]) =>
          <button key={sleutel} type="button" className="team-optie" role="switch" aria-label={tekst} aria-checked={instellingen[sleutel]} disabled={bezig} onClick={() => verander(sleutel)}>
            <span>{tekst}</span><span className="team-optie-waarde">{instellingen[sleutel] ? 'Aan' : 'Uit'}</span>
          </button>
        )}
      </div>
      <p className="account-uitleg">De stand houd je altijd bij. Deze opties gelden voor het hele team; eerdere gegevens blijven bewaard.</p>
      <Melding tekst={fout} fout />
    </Kaart>
    <Kaart titel="Gegevens resetten">
      <button className="btn btn-gevaar" disabled={bezig || wachtOpSync} onClick={() => { setFout(null); setResetVraag('goals') }}>Scores en goals resetten</button>
      <button className="btn btn-gevaar" disabled={bezig || wachtOpSync} onClick={() => { setFout(null); setResetVraag('speeltijd') }}>Speeltijd resetten</button>
      <p className="account-uitleg">Voor de lopende wedstrijd én de hele historie van dit team.</p>
      {wachtOpSync && <p className="account-uitleg">Wacht tot alles is bijgewerkt.</p>}
    </Kaart>
    <Kaart titel={actiefTeam.naam}>
      {actiefTeam.officieelTeam && <p className="account-uitleg">Je groep is vindbaar. Spelers en leden blijven privé.</p>}
      <TeamKoppelen id={actiefTeam.id} gekoppeld={actiefTeam.officieelTeam} />
    </Kaart>
    <DeelKijklink />
    {resetVraag && <ResetModal
      titel={resetVraag === 'goals' ? 'Scores en goals resetten?' : 'Speeltijd resetten?'}
      regels={[
        { icoon: '👥', tekst: `${actiefTeam.naam}: de lopende wedstrijd en alle ${wedstrijden.length} opgeslagen wedstrijden.` },
        { icoon: resetVraag === 'goals' ? '⚽' : '⏱', tekst: resetVraag === 'goals'
          ? 'Alle scores en doelpunten worden gewist. Oude wedstrijden krijgen geen fictieve 0–0-uitslag.'
          : 'Alle gemeten speeltijd per positie wordt gewist. Nieuwe metingen beginnen vanaf nu; de wedstrijdklok blijft staan.' },
        { icoon: '⚠', tekst: 'Niet ongedaan te maken in de app. Spelers, opstelling, wissels en planning blijven behouden.' },
      ]}
      bevestig="Definitief resetten" gevaar
      onCancel={() => setResetVraag(null)}
      onConfirm={() => {
        try { resetTeamRegistratie(resetVraag); setResetVraag(null) }
        catch (err) { setFout(foutTekst(err)); setResetVraag(null) }
      }}
    />}
  </>
}

function Account({ gebruiker, klaar }: { gebruiker: Gebruiker; klaar: () => void }) {
  const { uitloggen } = useAccount()
  return <>
    <Kaart titel="Je account">
      <div className="account-wie"><span className="account-wie-naam">{gebruiker.name || gebruiker.email}</span>{gebruiker.name && <span className="account-wie-sub">{gebruiker.email}</span>}</div>
      {gebruiker.superadmin && <p className="account-uitleg">Superadmin</p>}
      <button className="btn btn-secondary" onClick={() => { uitloggen(); tel('uitgelogd'); klaar() }}>Uitloggen</button>
    </Kaart>
    <p className="account-uitleg"><a href="./privacy.html" target="_blank" rel="noreferrer">Privacy</a> · <a href="./voorwaarden.html" target="_blank" rel="noreferrer">Gebruiksvoorwaarden</a></p>
  </>
}

// Eigen scherm via de teller in Instellingen: ouders die toegang vragen (beheerders van dat team)
// en nieuwe teams (superadmin). Toelaten = als kijker; beheerder maken kan daarna bij Leden
function AanvragenKaart() {
  const { aanvragen, aanvragenLaden, teamsLaden } = useAccount()
  const [bezig, setBezig] = useState(false)
  const [melding, setMelding] = useState<{ tekst: string; fout: boolean } | null>(null)
  const [teamnamen, setTeamnamen] = useState<Record<string, string>>({})
  const { toegang, teams } = aanvragen
  if (toegang.length + teams.length === 0 && !melding) return null

  const doe = async (actie: () => Promise<unknown>, gelukt: string) => {
    setBezig(true)
    setMelding(null)
    try {
      await actie()
      setMelding({ tekst: gelukt, fout: false })
      await Promise.all([aanvragenLaden(), teamsLaden()])
    } catch (err) {
      setMelding({ tekst: foutTekst(err), fout: true })
    } finally {
      setBezig(false)
    }
  }
  const beslisTeam = (a: TeamAanmelding, besluit: 'goed' | 'af') => {
    const teamnaam = (teamnamen[a.id] ?? a.teamnaam).trim() || a.teamnaam
    return doe(() => pb.send(`/api/hockey/aanmelding-id/${a.id}`, { method: 'POST', body: { besluit, teamnaam } }).then(() => tel(besluit === 'goed' ? 'aanmelding-goedgekeurd' : 'aanmelding-afgewezen')),
      besluit === 'goed' ? `${teamnaam} is aangemaakt en ${a.email} krijgt een uitnodiging als beheerder.` : `Aanmelding van ${teamnaam} afgewezen.`)
  }

  return (
    <Kaart titel={`Aanvragen (${toegang.length + teams.length})`}>
      <div className="account-lijst">
        <NieuweLeden aanvragen={toegang} ververs={async () => { await Promise.all([aanvragenLaden(), teamsLaden()]) }} />
        {teams.map(a => (
          <div key={a.id} className="account-aanvraag">
            <span className="account-regel-sub">Nieuw team</span>
            <input className="modal-input" aria-label="Teamnaam" value={teamnamen[a.id] ?? a.teamnaam} onChange={e => setTeamnamen(t => ({ ...t, [a.id]: e.target.value }))} />
            <span className="account-regel-sub">{a.naam ? `${a.naam} · ` : ''}{a.email}</span>
            {a.bericht && <span className="account-regel-sub">“{a.bericht}”</span>}
            <div className="account-aanvraag-knoppen">
              <button className="btn btn-primary" disabled={bezig} onClick={() => beslisTeam(a, 'goed')}>Goedkeuren</button>
              <button className="btn btn-gevaar" disabled={bezig} onClick={() => beslisTeam(a, 'af')}>Afwijzen</button>
            </div>
          </div>
        ))}
      </div>
      {toegang.length > 0 && <p className="account-uitleg">Nieuwe ouders krijgen direct een uitnodiging als kijker. Blokkeren kan hier of bij Leden.</p>}
      <Melding tekst={melding?.tekst ?? null} fout={melding?.fout} />
    </Kaart>
  )
}

function TeamBeheer({ id, gebruiker, weg }: { id: string; gebruiker: Gebruiker; weg: () => void }) {
  const { teams, teamsLaden, aanvragenLaden } = useAccount()
  const team = teams.find(t => t.id === id)
  const [kindSpelers, setKindSpelers] = useState<{ team: string; spelers: { id: string; naam: string }[] } | null>(null)
  const [kindFout, setKindFout] = useState(false)
  useEffect(() => {
    let actief = true
    setKindFout(false)
    pb.collection('spelers').getFullList<{ id: string; naam: string }>({ filter: pb.filter('team = {:id}', { id }), fields: 'id,naam' })
      .then(spelers => { if (actief) setKindSpelers({ team: id, spelers }) })
      .catch(() => { if (actief) setKindFout(true) })
    return () => { actief = false }
  }, [id, team])
  const kindTekst = (lid: Gebruiker) => {
    const keuze = (lid.id === gebruiker.id ? gebruiker : lid).kinderen?.[id]
    const ids = Array.isArray(keuze) ? [...new Set(keuze)] : []
    if (!ids.length) return 'Geen kind gekozen'
    if (kindFout) return 'Kindkeuze laden lukt niet'
    if (kindSpelers?.team !== id) return 'Kinderen laden…'
    const namen = ids.map(kind => kindSpelers.spelers.find(s => s.id === kind)?.naam).filter(Boolean)
    return namen.length ? `Ouder van ${namen.join(', ')}` : 'Gekozen kind niet meer in de spelerslijst'
  }
  const [uitnodigingen, setUitnodigingen] = useState<Uitnodiging[]>([])
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('kijker')
  const [lid, setLid] = useState<Gebruiker | null>(null)
  useTerug(!!lid, () => setLid(null))
  const [verwijderVraag, setVerwijderVraag] = useState(false)
  useTerug(verwijderVraag, () => setVerwijderVraag(false))
  // Iemand uit het team halen: eerst bevestigen
  const [eruitVraag, setEruitVraag] = useState<Gebruiker | null>(null)
  const [intrekVraag, setIntrekVraag] = useState<Uitnodiging | null>(null)
  const [melding, setMelding] = useState<{ tekst: string; fout: boolean } | null>(null)
  const [bezig, setBezig] = useState(false)
  const sa = gebruiker.superadmin

  const uitnodigingenLaden = () =>
    pb.collection('uitnodigingen').getFullList<Uitnodiging>({ filter: pb.filter('team = {:id}', { id }), sort: '-created' }).then(setUitnodigingen)

  useEffect(() => { uitnodigingenLaden().catch(() => {}) }, [id])

  // Open toegangsaanvragen van ouders (via de aanmeldlink)
  const [aanvragen, setAanvragen] = useState<ToegangAanvraag[]>([])
  const lijstLaden = () =>
    pb.collection('toegangsaanvragen').getFullList<ToegangAanvraag>({ filter: pb.filter("team = {:id} && (status = 'nieuw' || (status = 'toegelaten' && automatisch = true && gezien = false))", { id }), sort: 'created' }).then(setAanvragen)
  useEffect(() => { lijstLaden().catch(() => {}) }, [id])
  const [blokVersie, setBlokVersie] = useState(0)
  const verversLeden = async () => {
    await Promise.all([lijstLaden(), uitnodigingenLaden(), teamsLaden(), aanvragenLaden()])
    setBlokVersie(v => v + 1)
  }
  const blokkeer = (email: string, naam: string) => doe(async () => {
    await pb.send(`/api/hockey/teamtoegang/${id}`, { method: 'POST', body: { actie: 'blokkeren', email, naam } })
    await verversLeden()
    setLid(null)
  })

  if (!team) return <p className="account-uitleg">Team niet gevonden.</p>

  const leden = ROLLEN.flatMap(r => (team.expand?.[ROL_VELD[r]] ?? []).map(g => ({ g, rol: r })))

  const doe = async (actie: () => Promise<unknown>, gelukt?: string) => {
    setBezig(true)
    setMelding(null)
    try {
      await actie()
      if (gelukt) setMelding({ tekst: gelukt, fout: false })
    } catch (err) {
      setMelding({ tekst: foutTekst(err), fout: true })
    }
    setBezig(false)
  }

  const nodigUit = () => doe(async () => {
    await pb.collection('uitnodigingen').create({ team: id, email: email.trim(), rol, terug: appAdres() })
    tel('uitgenodigd')
    await uitnodigingenLaden()
    setEmail('')
  }, `Uitnodiging gemaild naar ${email.trim()}.`)

  const zetRol = (userId: string, nieuw: Rol | null) => doe(async () => {
    const velden: Partial<Record<'beheerders' | 'kijkers', string[]>> = {}
    for (const r of ROLLEN) {
      const veld = ROL_VELD[r]
      const lijst = (team[veld] ?? []).filter(x => x !== userId)
      if (r === nieuw) lijst.push(userId)
      velden[veld] = lijst
    }
    await pb.collection('teams').update(id, velden)
    tel(nieuw ? 'rol-gewijzigd' : 'lid-verwijderd')
    await teamsLaden()
    setLid(null)
  })

  const lidRol = lid ? rolIn(team, lid.id) : null

  return (
    <div className="account-form">
      <div className="account-wie">
        <span className="account-wie-naam">{team.naam}</span>
      </div>

      <h2 className="section-title">Leden</h2>
      <div className="account-lijst">
        {leden.map(({ g, rol: r }) => (
          <button
            key={g.id}
            className="account-regel"
            onClick={() => setLid(g)}
            disabled={g.id === gebruiker.id}
          >
            <span className="account-regel-tekst">
              <span className="account-regel-naam">{g.gast ? '🔗 Meekijklink' : g.name || g.email}</span>
              <span className="account-regel-sub">{g.gast ? 'iedereen met de link' : g.name ? g.email : ''}</span>
              {!g.gast && <span className="account-regel-sub account-lid-kinderen">{kindTekst(g)}</span>}
            </span>
            <span className="account-regel-sub">{ROL_TEKST[r]}</span>
          </button>
        ))}
      </div>

      {uitnodigingen.length > 0 && (
        <>
          <h2 className="section-title">Uitgenodigd</h2>
          <div className="account-lijst">
            {uitnodigingen.map(u => (
              <div key={u.id} className="account-regel">
                <span className="account-regel-tekst">
                  <span className="account-regel-naam">{u.email}</span>
                  <span className="account-regel-sub">{ROL_TEKST[u.rol]}</span>
                </span>
                <button
                  className="account-weg"
                  disabled={bezig}
                  onClick={() => blokkeer(u.email, '')}
                >Blokkeren</button>
                <button
                  className="account-weg"
                  aria-label={`Uitnodiging voor ${u.email} intrekken`}
                  onClick={() => setIntrekVraag(u)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {aanvragen.length > 0 && (
        <>
          <h2 className="section-title">Aanvragen</h2>
          <div className="account-lijst">
            <NieuweLeden aanvragen={aanvragen} ververs={verversLeden} />
          </div>
          <p className="account-uitleg">Nieuwe ouders krijgen direct een uitnodiging als kijker.</p>
        </>
      )}

      <GeblokkeerdeLeden team={id} ververs={verversLeden} versie={blokVersie} />

      <h2 className="section-title">Iemand uitnodigen</h2>
      <form className="account-form" onSubmit={e => { e.preventDefault(); nodigUit() }}>
        <input className="modal-input" type="email" placeholder="E-mailadres" value={email} onChange={e => setEmail(e.target.value)} />
        <div className="account-rollen" role="radiogroup" aria-label="Rol">
          {ROLLEN.map(r => (
            <button key={r} type="button" role="radio" aria-checked={rol === r} className={`account-rol ${rol === r ? 'actief' : ''}`} onClick={() => setRol(r)}>
              <span className="account-rol-naam">{ROL_TEKST[r]}</span>
              <span className="account-rol-uitleg">{ROL_UITLEG[r]}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-primary" type="submit" disabled={bezig || !email.includes('@')}>Uitnodiging mailen</button>
      </form>
      <Melding tekst={melding?.tekst ?? null} fout={melding?.fout} />

      {sa && <button className="btn btn-gevaar" onClick={() => setVerwijderVraag(true)}>Team verwijderen</button>}

      {lid && (
        <div className="modal show" onClick={() => setLid(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{lid.name || lid.email}</div>
            <div className="modal-options">
              {ROLLEN.map(r => (
                <button key={r} className={`modal-option ${lidRol === r ? 'selected' : ''}`} disabled={bezig} onClick={() => zetRol(lid.id, r)}>
                  <span className="modal-option-name">{ROL_TEKST[r]}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setLid(null)}>Annuleren</button>
              <button className="btn btn-gevaar" disabled={bezig} onClick={() => { setEruitVraag(lid); setLid(null) }}>Blokkeren</button>
            </div>
          </div>
        </div>
      )}

      {eruitVraag && (
        <ResetModal
          titel={eruitVraag.gast ? 'Meekijklink uitzetten?' : `${eruitVraag.name || eruitVraag.email} blokkeren?`}
          regels={eruitVraag.gast ? [
            { icoon: '🔗', tekst: `Wie de meekijklink heeft, kan ${team.naam} niet meer zien` },
            { icoon: '↩', tekst: 'Een nieuwe meekijklink maken kan altijd weer' },
          ] : [
            { icoon: '👤', tekst: `${eruitVraag.name || eruitVraag.email} kan ${team.naam} niet meer zien of bijhouden` },
            { icoon: '↩', tekst: 'Je kunt dit herstellen bij Geblokkeerd' },
          ]}
          bevestig={eruitVraag.gast ? 'Ja, link uitzetten' : 'Blokkeren'}
          gevaar
          onConfirm={() => { blokkeer(eruitVraag.email, eruitVraag.name); setEruitVraag(null) }}
          onCancel={() => setEruitVraag(null)}
        />
      )}

      {intrekVraag && (
        <ResetModal
          titel="Uitnodiging intrekken?"
          regels={[
            { icoon: '✉️', tekst: `De link in de mail aan ${intrekVraag.email} werkt dan niet meer` },
            { icoon: '↩', tekst: 'Opnieuw uitnodigen kan altijd' },
          ]}
          bevestig="Ja, intrekken"
          gevaar
          onConfirm={() => { const u = intrekVraag; setIntrekVraag(null); doe(async () => { await pb.collection('uitnodigingen').delete(u.id); tel('uitnodiging-ingetrokken'); await uitnodigingenLaden() }) }}
          onCancel={() => setIntrekVraag(null)}
        />
      )}

      {verwijderVraag && (
        <div className="modal show">
          <div className="modal-content">
            <div className="modal-title">Team verwijderen?</div>
            <div className="modal-subtitle">{team.naam} en alle uitnodigingen verdwijnen. Accounts blijven bestaan.</div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setVerwijderVraag(false)}>Annuleren</button>
              <button
                className="btn btn-primary knop-rood"
                onClick={() => doe(async () => { await pb.collection('teams').delete(id); tel('team-verwijderd'); await teamsLaden(); weg() })}
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface UitnodigingInfo { team: string; email: string; rol: Rol; bestaat: boolean; naam?: string }

function UitnodigingAannemen({ token, klaar }: { token: string; klaar: () => void }) {
  const { gebruiker, inloggen, teamsLaden } = useAccount()
  const [info, setInfo] = useState<UitnodigingInfo | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [naam, setNaam] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [bezig, setBezig] = useState(false)
  const [inlogNodig, setInlogNodig] = useState<string | null>(null)

  useEffect(() => {
    pb.send<UitnodigingInfo>(`/api/hockey/uitnodiging/${encodeURIComponent(token)}`, {})
      .then(i => { setInfo(i); if (i.naam) setNaam(i.naam) })
      .catch(err => setFout(foutTekst(err)))
  }, [token])

  const aannemen = async () => {
    if (!info) return
    setBezig(true)
    setFout(null)
    try {
      await pb.send(`/api/hockey/uitnodiging/${encodeURIComponent(token)}`, { method: 'POST', body: { naam, wachtwoord } })
      tel('uitnodiging-aangenomen')
      if (!info.bestaat) {
        await inloggen(info.email, wachtwoord)
        klaar()
      } else if (gebruiker?.email === info.email) {
        await teamsLaden()
        klaar()
      } else {
        if (gebruiker) pb.authStore.clear()
        setInlogNodig(info.email)
      }
    } catch (err) {
      setFout(foutTekst(err))
    }
    setBezig(false)
  }

  // Na inloggen met het uitgenodigde account door naar het overzicht met teams
  useEffect(() => {
    if (inlogNodig && gebruiker?.email === inlogNodig) klaar()
  }, [inlogNodig, gebruiker, klaar])

  if (inlogNodig) {
    return (
      <>
        <p className="account-melding">Je bent toegevoegd. Log in met je bestaande wachtwoord.</p>
        <Inloggen email={inlogNodig} />
      </>
    )
  }
  if (fout && !info) return <Melding tekst={fout} fout />
  if (!info) return <p className="account-uitleg">Uitnodiging ophalen…</p>

  return (
    <form className="account-form" onSubmit={e => { e.preventDefault(); aannemen() }}>
      <p className="account-uitleg">
        Je bent uitgenodigd voor <strong>{info.team}</strong> als {ROL_TEKST[info.rol].toLowerCase()} ({ROL_UITLEG[info.rol]}).
      </p>
      <p className="account-uitleg">Account: <strong>{info.email}</strong></p>
      {!info.bestaat && (
        <>
          <input type="email" autoComplete="username" value={info.email} readOnly hidden />
          {info.naam?.trim() ? (
            <p className="account-uitleg">Naam: <strong>{info.naam}</strong></p>
          ) : (
            <label className="account-label">
              Je naam
              <input className="modal-input" autoComplete="name" value={naam} onChange={e => setNaam(e.target.value)} />
            </label>
          )}
          <label className="account-label">
            Kies een wachtwoord (minstens 8 tekens)
            <input className="modal-input" type="password" autoComplete="new-password" value={wachtwoord} onChange={e => setWachtwoord(e.target.value)} />
          </label>
        </>
      )}
      <Melding tekst={fout} fout />
      <button className="btn btn-primary" type="submit" disabled={bezig || (!info.bestaat && wachtwoord.length < 8)}>
        {info.bestaat ? 'Toevoegen aan team' : 'Account maken'}
      </button>
    </form>
  )
}

function WachtwoordKiezen({ token, klaar }: { token: string; klaar: () => void }) {
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [gelukt, setGelukt] = useState(false)
  const [bezig, setBezig] = useState(false)

  const opslaan = async () => {
    setBezig(true)
    setFout(null)
    try {
      await pb.collection('users').confirmPasswordReset(token, wachtwoord, wachtwoord)
      tel('wachtwoord-gewijzigd')
      setGelukt(true)
    } catch (err) {
      setFout((err as { status?: number }).status === 400 ? 'Deze link is verlopen of al gebruikt. Vraag een nieuwe aan via Wachtwoord vergeten.' : foutTekst(err))
    }
    setBezig(false)
  }

  if (gelukt) {
    return (
      <div className="account-form">
        <p className="account-melding">Je wachtwoord is gewijzigd. Log nu in.</p>
        <button className="btn btn-primary" onClick={klaar}>Naar inloggen</button>
      </div>
    )
  }

  return (
    <form className="account-form" onSubmit={e => { e.preventDefault(); opslaan() }}>
      <label className="account-label">
        Nieuw wachtwoord (minstens 8 tekens)
        <input className="modal-input" type="password" autoComplete="new-password" value={wachtwoord} onChange={e => setWachtwoord(e.target.value)} />
      </label>
      <Melding tekst={fout} fout />
      <button className="btn btn-primary" type="submit" disabled={bezig || wachtwoord.length < 8}>Opslaan</button>
    </form>
  )
}

interface TeamGebruik { id: string; naam: string; leden: number; actief: number; meekijklink: boolean; meekijkers: number; laatst: string | null; wie: string }

// 'Vandaag 21:14', 'gisteren 9:05', 'za 27 sep 14:00'
function wanneer(iso: string) {
  const d = new Date(iso)
  const tijd = d.toLocaleTimeString('nl-NL', { hour: 'numeric', minute: '2-digit' })
  const dagen = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (dagen === 0) return `vandaag ${tijd}`
  if (dagen === 1) return `gisteren ${tijd}`
  return `${d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })} ${tijd}`
}

// Superadmin: per team deze week de actieve leden en de toestellen via de meekijklink, en wanneer het laatst
function Gebruik() {
  const [teams, setTeams] = useState<TeamGebruik[] | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    pb.send('/api/hockey/gebruik', {}).then(r => setTeams(r.teams)).catch(err => setFout(foutTekst(err)))
  }, [])

  return (
    <Kaart titel="Gebruik per team">
      <p className="account-uitleg">Afgelopen 7 dagen: leden die inlogden of de app openden, en toestellen die via de meekijklink keken.</p>
      <Melding tekst={fout} fout />
      {!teams && !fout && <p className="account-uitleg">Laden…</p>}
      <div className="account-lijst">
        {teams?.map(t => (
          <div key={t.id} className="account-regel account-gebruik">
            <span className="account-regel-tekst">
              <span className="account-regel-naam">{t.naam}</span>
              <span className="account-regel-sub">{t.actief} van {t.leden} {t.leden === 1 ? 'lid' : 'leden'} actief</span>
              {t.meekijklink && <span className="account-regel-sub">Meekijklink: {t.meekijkers} {t.meekijkers === 1 ? 'toestel' : 'toestellen'}</span>}
              <span className="account-regel-sub">{t.laatst ? `Laatst: ${wanneer(t.laatst)}${t.wie ? ` (${t.wie})` : ''}` : 'Nog niet gebruikt'}</span>
            </span>
          </div>
        ))}
      </div>
    </Kaart>
  )
}

interface AanmeldingInfo { teamnaam: string; naam: string; email: string; bericht: string; status: 'nieuw' | 'goedgekeurd' | 'afgewezen'; created: string }

// Geopend vanuit de mail aan de superadmin. De link zelf geeft het recht om te beslissen
function AanmeldingBeoordelen({ token }: { token: string }) {
  const { teamsLaden, gebruiker } = useAccount()
  const [info, setInfo] = useState<AanmeldingInfo | null>(null)
  const [teamnaam, setTeamnaam] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const url = `/api/hockey/aanmelding/${encodeURIComponent(token)}`

  useEffect(() => {
    pb.send<AanmeldingInfo>(url, {})
      .then(i => { setInfo(i); setTeamnaam(i.teamnaam) })
      .catch(err => setFout(foutTekst(err)))
  }, [url])

  const beslis = async (besluit: 'goed' | 'af') => {
    setBezig(true)
    setFout(null)
    try {
      const r = await pb.send<{ status: AanmeldingInfo['status'] }>(url, { method: 'POST', body: { besluit, teamnaam } })
      tel(besluit === 'goed' ? 'aanmelding-goedgekeurd' : 'aanmelding-afgewezen')
      setInfo(i => (i ? { ...i, status: r.status, teamnaam } : i))
      if (gebruiker) teamsLaden().catch(() => {})
    } catch (err) {
      setFout(foutTekst(err))
    }
    setBezig(false)
  }

  if (!info) return fout ? <Melding tekst={fout} fout /> : <p className="account-uitleg">Aanmelding ophalen…</p>

  return (
    <div className="account-form">
      <div className="account-wie">
        <span className="account-wie-naam">{info.teamnaam}</span>
        <span className="account-wie-sub">{info.naam ? `${info.naam} · ` : ''}{info.email}</span>
      </div>
      {info.bericht && <p className="account-uitleg account-citaat">{info.bericht}</p>}
      {info.status === 'nieuw' ? (
        <>
          <label className="account-label">
            Teamnaam (kun je nog aanpassen)
            <input className="modal-input" value={teamnaam} onChange={e => setTeamnaam(e.target.value)} />
          </label>
          <Melding tekst={fout} fout />
          <button className="btn btn-primary" onClick={() => beslis('goed')} disabled={bezig || !teamnaam.trim()}>Goedkeuren</button>
          <button className="btn btn-gevaar" onClick={() => beslis('af')} disabled={bezig}>Afwijzen</button>
          <p className="account-uitleg">Goedkeuren maakt het team aan en mailt {info.email} een uitnodiging als beheerder.</p>
        </>
      ) : (
        <p className={`account-melding ${info.status === 'afgewezen' ? 'fout' : ''}`}>
          {info.status === 'goedgekeurd' ? `Goedgekeurd: ${info.teamnaam} is aangemaakt en ${info.email} heeft een uitnodiging gekregen.` : 'Deze aanmelding is afgewezen.'}
        </p>
      )}
    </div>
  )
}

// Geopend via een meekijklink (#kijk=<team>.<token>)
function MeekijkenStart({ annuleer }: { waarde: string; klaar: () => void; annuleer: () => void }) {
  return <>
    <p className="account-uitleg">Deze oude meekijklink geeft geen toegang meer. Vraag de beheerder om een teamlink en meld je aan met je eigen e-mailadres.</p>
    <button className="btn btn-secondary" onClick={annuleer}>Terug</button>
  </>
}

const THEMAS: { id: Thema; naam: string }[] = [
  { id: 'auto', naam: 'Automatisch' }, { id: 'licht', naam: 'Licht' }, { id: 'donker', naam: 'Donker' },
]

function Weergave() {
  const [thema, setThema] = useState<Thema>(leesThema)
  const kies = (t: Thema) => {
    zetThema(t)
    setThema(t)
    tel(`thema-${t}`)
  }
  return (
    <Kaart titel="Weergave">
      <div className="thema-keuze" role="radiogroup" aria-label="Weergave">
        {THEMAS.map(t => (
          <button key={t.id} role="radio" aria-checked={thema === t.id} className={`thema-knop ${thema === t.id ? 'actief' : ''}`} onClick={() => kies(t.id)}>
            {t.naam}
          </button>
        ))}
      </div>
      <p className="account-uitleg">
        {thema === 'auto' ? 'Licht of donker volgens de instelling van je telefoon.' : `Altijd ${thema}, wat je telefoon ook doet.`} Geldt alleen op deze telefoon.
      </p>
    </Kaart>
  )
}

interface AanvraagForm { team: string }
function ToegangAanvragen({ waarde }: { waarde: string }) {
  const { gebruiker } = useAccount()
  const [form, setForm] = useState<AanvraagForm | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [naam, setNaam] = useState(gebruiker?.name || '')
  const [email, setEmail] = useState(gebruiker?.email || '')
  const [bezig, setBezig] = useState(false)
  const [verstuurd, setVerstuurd] = useState(false)
  const url = `/api/hockey/aanvraag/${encodeURIComponent(waarde)}`
  useEffect(() => {
    let actief = true
    pb.send<AanvraagForm>(url, {}).then(v => { if (actief) setForm(v) }).catch(e => { if (actief) setFout(foutTekst(e)) })
    return () => { actief = false }
  }, [url])
  if (!form) return fout ? <Melding tekst={fout} fout /> : <p className="account-uitleg">Even laden…</p>
  if (verstuurd) return <p className="account-melding">Je aanvraag staat bij de beheerder van {form.team}. Je ontvangt direct een uitnodiging op {email.trim()}.</p>
  return <form className="account-form" onSubmit={async e => {
    e.preventDefault(); setBezig(true); setFout(null)
    try {
      await pb.send(url, { method: 'POST', body: { naam, email, terug: appAdres() } })
      setVerstuurd(true)
    } catch (err) { setFout(foutTekst(err)) }
    finally { setBezig(false) }
  }}>
    <div className="account-wie"><span className="account-wie-naam">{form.team}</span></div>
    <p className="account-uitleg">Vraag toegang aan. De beheerder beslist wie mag meekijken; spelersnamen blijven tot die tijd privé.</p>
    <label className="account-label">Je naam<input className="modal-input" required autoComplete="name" value={naam} onChange={e => setNaam(e.target.value)} /></label>
    <label className="account-label">E-mail<input className="modal-input" required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <Melding tekst={fout} fout />
    <button className="btn btn-primary" type="submit" disabled={bezig || !naam.trim() || !email.includes('@')}>Aansluiten</button>
  </form>
}

interface AanvraagInfo { team: string; naam: string; email: string; kind: string; automatisch?: boolean; status: 'nieuw' | 'toegelaten' | 'afgewezen' | 'geblokkeerd' }

// Beheerder opent de link uit de mail (#toegang=<token>)
function ToegangBeoordelen({ token }: { token: string }) {
  const [info, setInfo] = useState<AanvraagInfo | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const url = `/api/hockey/toegang/${encodeURIComponent(token)}`

  useEffect(() => {
    pb.send<AanvraagInfo>(url, {}).then(setInfo).catch(err => setFout(foutTekst(err)))
  }, [url])

  const beslis = async (besluit: 'kijker' | 'beheerder' | 'af' | 'gezien' | 'blokkeren') => {
    setBezig(true)
    setFout(null)
    try {
      const r = await pb.send<{ status: AanvraagInfo['status'] }>(url, { method: 'POST', body: { besluit } })
      tel(`toegang-${besluit}`)
      setInfo(i => (i ? { ...i, status: r.status } : i))
    } catch (err) {
      setFout(foutTekst(err))
    }
    setBezig(false)
  }

  if (!info) return fout ? <Melding tekst={fout} fout /> : <p className="account-uitleg">Aanvraag ophalen…</p>
  return (
    <div className="account-form">
      <div className="account-wie">
        <span className="account-wie-naam">{info.naam}</span>
        <span className="account-wie-sub">ouder van {info.kind} · {info.team}</span>
        <span className="account-wie-sub">{info.email}</span>
      </div>
      {info.status === 'nieuw' ? (
        <>
          <Melding tekst={fout} fout />
          <button className="btn btn-primary" disabled={bezig} onClick={() => beslis('kijker')}>Toelaten als kijker</button>
          <button className="btn btn-secondary" disabled={bezig} onClick={() => beslis('beheerder')}>Toelaten als beheerder</button>
          <button className="btn btn-gevaar" disabled={bezig} onClick={() => beslis('af')}>Afwijzen</button>
          <p className="account-uitleg">Kijker: ziet alles live, kan niets wijzigen. Beheerder: mag alles bijhouden en regelen.</p>
        </>
      ) : info.automatisch && info.status === 'toegelaten' ? <>
        <p className="account-uitleg">De persoonlijke uitnodiging is verstuurd.</p>
        <Melding tekst={fout} fout />
        <button className="btn btn-primary" disabled={bezig} onClick={() => beslis('gezien')}>Bekeken</button>
        <button className="btn btn-gevaar" disabled={bezig} onClick={() => beslis('blokkeren')}>Blokkeren</button>
      </> : (
        <p className={`account-melding ${info.status === 'afgewezen' ? 'fout' : ''}`}>
          {info.status === 'toegelaten' ? `${info.naam} is toegelaten en krijgt een mail om een wachtwoord te kiezen.` : info.status === 'geblokkeerd' ? 'Deze persoon is geblokkeerd. Deblokkeren kan bij Leden.' : 'Deze aanvraag is afgewezen.'}
        </p>
      )}
    </div>
  )
}
