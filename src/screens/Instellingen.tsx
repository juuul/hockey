import React, { useEffect, useState } from 'react'
import { TeamAanmelding, useAccount } from '../context/AccountContext'
import { useHockey } from '../context/HockeyContext'
import { appAdres, foutTekst, Gebruiker, pb, Rol, ROL_TEKST, ROL_UITLEG, ROL_VELD, rolIn, Uitnodiging } from '../server'
import { tel } from '../statistiek'
import DeelKijklink from '../components/DeelKijklink'
import ResetModal from '../components/ResetModal'
import { leesThema, Thema, zetThema } from '../thema'
import '../components/Modal.css'
import './Instellingen.css'

export type LinkSoort = 'uitnodiging' | 'wachtwoord' | 'aanmelding' | 'kijk' | 'aanvraag' | 'toegang'
export type AccountStart = { soort: LinkSoort; token: string } | null

type Weergave = { soort: 'hoofd' } | { soort: 'team'; id: string } | { soort: 'aanmelden' } | { soort: LinkSoort; token: string }

const ROLLEN: Rol[] = ['beheerder', 'kijker']

// Tabblad Instellingen: account, teams en alles rond inloggen. Links uit mails openen hier een eigen weergave
export default function Instellingen({ start, startGebruikt, naarDashboard }: { start: AccountStart; startGebruikt: () => void; naarDashboard: () => void }) {
  const { gebruiker } = useAccount()
  const [weergave, setWeergave] = useState<Weergave>(start ?? { soort: 'hoofd' })
  const terug = () => setWeergave({ soort: 'hoofd' })

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
    : weergave.soort === 'aanmelden' ? 'Team aanmelden'
    : weergave.soort === 'aanmelding' ? 'Teamaanmelding'
    : weergave.soort === 'kijk' ? 'Meekijken'
    : weergave.soort === 'aanvraag' ? 'Account aanvragen'
    : weergave.soort === 'toegang' ? 'Toegangsaanvraag'
    : null

  return (
    <div className="instellingen">
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
        {weergave.soort === 'aanmelden' && <TeamAanmelden />}
        {weergave.soort === 'aanmelding' && <AanmeldingBeoordelen token={weergave.token} />}
        {weergave.soort === 'aanvraag' && <ToegangAanvragen waarde={weergave.token} />}
        {weergave.soort === 'toegang' && <ToegangBeoordelen token={weergave.token} />}
        {weergave.soort === 'kijk' && <MeekijkenStart waarde={weergave.token} klaar={() => { terug(); naarDashboard() }} annuleer={terug} />}
        {weergave.soort === 'hoofd' && (gebruiker
          ? <Overzicht gebruiker={gebruiker} openTeam={id => setWeergave({ soort: 'team', id })} aanmelden={() => setWeergave({ soort: 'aanmelden' })} />
          : <Inloggen aanmelden={() => setWeergave({ soort: 'aanmelden' })} />)}
        {weergave.soort === 'hoofd' && <Weergave />}
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
  const tekst = sync.offline
    ? `Geen verbinding${sync.wachtend ? `: ${sync.wachtend} wijziging${sync.wachtend > 1 ? 'en' : ''} wacht${sync.wachtend > 1 ? 'en' : ''}` : ''}. Wordt later verstuurd.`
    : sync.fout ? `Versturen mislukt: ${sync.fout}`
    : !sync.geladen ? 'Gegevens ophalen…'
    : sync.wachtend ? 'Bezig met versturen…'
    : 'Alles is opgeslagen op de server.'
  const liveTekst = !live ? '' : !live.verbonden ? ' Live: geen verbinding.' : live.wachtend ? ' Live: bezig…' : ' Wedstrijd live gedeeld.'
  return (
    <button className={`account-sync ${sync.offline || sync.fout || (live && !live.verbonden) ? 'fout' : ''}`} onClick={nuSynchroniseren}>
      {tekst}{liveTekst}
    </button>
  )
}

function Inloggen({ email: startEmail = '', aanmelden }: { email?: string; aanmelden?: () => void }) {
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
        <p className="account-uitleg">Log in om met je team te delen: spelers, wedstrijden en de lopende wedstrijd live.</p>
        {formulier}
      </Kaart>
      <Kaart titel="Nog geen account?">
        <p className="account-uitleg"><strong>Zit je team al in de app?</strong> Vraag de trainer of teammanager om de aanmeldlink van je team, of om een uitnodiging per mail.</p>
        <p className="account-uitleg"><strong>Wil je de app voor je eigen team gebruiken?</strong> Meld je team aan. Na goedkeuring krijg je een mail om je account te maken, en word je beheerder van het team.</p>
        <button className="btn btn-primary" type="button" onClick={aanmelden}>Mijn team aanmelden</button>
      </Kaart>
    </>
  )
}

function Overzicht({ gebruiker, openTeam, aanmelden }: { gebruiker: Gebruiker; openTeam: (id: string) => void; aanmelden: () => void }) {
  const { teams, teamsLaden, uitloggen, actiefTeamId, kiesTeam } = useAccount()
  const [nieuwTeam, setNieuwTeam] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => { teamsLaden().catch(err => setFout(foutTekst(err))) }, [teamsLaden])

  const maakTeam = async () => {
    try {
      await pb.collection('teams').create({ naam: nieuwTeam.trim() })
      setNieuwTeam('')
      tel('team-gemaakt')
      await teamsLaden()
    } catch (err) {
      setFout(foutTekst(err))
    }
  }

  const actief = teams.find(t => t.id === actiefTeamId)
  const actieveRol = actief ? rolIn(actief, gebruiker.id) : null

  return (
    <>
      {gebruiker.gast ? (
        <Kaart titel="Meekijken">
          <div className="account-wie">
            <span className="account-wie-naam">{actief?.naam ?? 'Team'}</span>
            <span className="account-wie-sub">Je kijkt live mee via een link. Wijzigen kan niet.</span>
          </div>
          <DeelKijklink />
          <button className="btn btn-secondary" onClick={() => { uitloggen(); tel('meekijken-gestopt') }}>Stoppen met meekijken</button>
          <p className="account-uitleg">Heb je zelf een account? Stop dan met meekijken en log in.</p>
        </Kaart>
      ) : (
      <>
      <AanvragenKaart />
      <Kaart titel="Account">
        <div className="account-wie">
          <span className="account-wie-naam">{gebruiker.name || gebruiker.email}</span>
          {gebruiker.name && <span className="account-wie-sub">{gebruiker.email}</span>}
          <span className="account-wie-sub">
            {gebruiker.superadmin ? 'Superadmin' : actief ? `${actieveRol ? ROL_TEKST[actieveRol] : 'Lid'} van ${actief.naam}` : 'Niet in een team actief'}
          </span>
        </div>
        <button className="btn btn-secondary" onClick={() => { uitloggen(); tel('uitgelogd') }}>Uitloggen</button>
      </Kaart>

      <Kaart titel="Werken met">
        {teams.length === 0 && <p className="account-uitleg">Je zit nog in geen enkel team.</p>}
        <div className="account-lijst">
          {teams.map(t => {
            const rol = rolIn(t, gebruiker.id)
            const magBeheren = gebruiker.superadmin || rol === 'beheerder'
            const isActief = t.id === actiefTeamId
            return (
              <div key={t.id} className={`account-team ${isActief ? 'actief' : ''}`}>
                <button className="account-team-kies" onClick={() => { kiesTeam(t.id); tel('team-gekozen') }} aria-pressed={isActief}>
                  <span className="account-team-vink" aria-hidden="true">{isActief ? '✓' : ''}</span>
                  <span className="account-regel-tekst">
                    <span className="account-regel-naam">{t.naam}</span>
                    <span className="account-regel-sub">{rol ? ROL_TEKST[rol] : 'Superadmin'}</span>
                  </span>
                </button>
                {magBeheren && <button className="account-team-beheer" onClick={() => openTeam(t.id)}>Leden</button>}
              </div>
            )
          })}
          {teams.length > 0 && (
            <button className={`account-team-kies los ${actiefTeamId === null ? 'actief' : ''}`} onClick={() => { kiesTeam(null); tel('zonder-team') }} aria-pressed={actiefTeamId === null}>
              <span className="account-team-vink" aria-hidden="true">{actiefTeamId === null ? '✓' : ''}</span>
              <span className="account-regel-tekst">
                <span className="account-regel-naam">Zonder team</span>
                <span className="account-regel-sub">alleen op deze telefoon</span>
              </span>
            </button>
          )}
        </div>
        <SyncRegel />
        <DeelKijklink />
        <DeelKijklink soort="aanvraag" />
      </Kaart>

      <Kaart titel={gebruiker.superadmin ? 'Nieuw team' : 'Ander team'}>
        {gebruiker.superadmin ? (
          <form className="account-form" onSubmit={e => { e.preventDefault(); if (nieuwTeam.trim()) maakTeam() }}>
            <input className="modal-input" placeholder="Naam nieuw team" value={nieuwTeam} onChange={e => setNieuwTeam(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={!nieuwTeam.trim()}>Team maken</button>
          </form>
        ) : (
          <>
            <p className="account-uitleg">Wil je de app ook voor een ander team gebruiken?</p>
            <button className="btn btn-secondary" onClick={aanmelden}>Nog een team aanmelden</button>
          </>
        )}
        <Melding tekst={fout} fout />
      </Kaart>
      </>
      )}
    </>
  )
}

// Bovenaan Instellingen, alleen als er iets te beslissen is: ouders die toegang vragen (beheerders van dat team)
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
  const beslisToegang = (id: string, besluit: 'kijker' | 'af', wie: string) =>
    doe(() => pb.send(`/api/hockey/toegang-id/${id}`, { method: 'POST', body: { besluit } }).then(() => tel(`toegang-${besluit}`)),
      besluit === 'af' ? `Aanvraag van ${wie} afgewezen.` : `${wie} is toegelaten en krijgt een mail om een wachtwoord te kiezen.`)
  const beslisTeam = (a: TeamAanmelding, besluit: 'goed' | 'af') => {
    const teamnaam = (teamnamen[a.id] ?? a.teamnaam).trim() || a.teamnaam
    return doe(() => pb.send(`/api/hockey/aanmelding-id/${a.id}`, { method: 'POST', body: { besluit, teamnaam } }).then(() => tel(besluit === 'goed' ? 'aanmelding-goedgekeurd' : 'aanmelding-afgewezen')),
      besluit === 'goed' ? `${teamnaam} is aangemaakt en ${a.email} krijgt een uitnodiging als beheerder.` : `Aanmelding van ${teamnaam} afgewezen.`)
  }

  return (
    <Kaart titel={`Aanvragen (${toegang.length + teams.length})`}>
      <div className="account-lijst">
        {toegang.map(a => (
          <div key={a.id} className="account-aanvraag">
            <span className="account-regel-naam">{a.naam}</span>
            <span className="account-regel-sub">wil meekijken bij {a.expand?.team?.naam ?? 'het team'} · ouder van {a.kindNaam}</span>
            <span className="account-regel-sub">{a.email}</span>
            <div className="account-aanvraag-knoppen">
              <button className="btn btn-primary" disabled={bezig} onClick={() => beslisToegang(a.id, 'kijker', a.naam)}>Toelaten</button>
              <button className="btn btn-gevaar" disabled={bezig} onClick={() => beslisToegang(a.id, 'af', a.naam)}>Afwijzen</button>
            </div>
          </div>
        ))}
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
      {toegang.length > 0 && <p className="account-uitleg">Toelaten = als kijker. Beheerder maken kan daarna bij Leden.</p>}
      <Melding tekst={melding?.tekst ?? null} fout={melding?.fout} />
    </Kaart>
  )
}

function TeamBeheer({ id, gebruiker, weg }: { id: string; gebruiker: Gebruiker; weg: () => void }) {
  const { teams, teamsLaden, aanvragenLaden } = useAccount()
  const team = teams.find(t => t.id === id)
  const [uitnodigingen, setUitnodigingen] = useState<Uitnodiging[]>([])
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('kijker')
  const [lid, setLid] = useState<Gebruiker | null>(null)
  const [verwijderVraag, setVerwijderVraag] = useState(false)
  // Iemand uit het team halen: eerst bevestigen
  const [eruitVraag, setEruitVraag] = useState<Gebruiker | null>(null)
  const [melding, setMelding] = useState<{ tekst: string; fout: boolean } | null>(null)
  const [bezig, setBezig] = useState(false)
  const sa = gebruiker.superadmin

  const uitnodigingenLaden = () =>
    pb.collection('uitnodigingen').getFullList<Uitnodiging>({ filter: pb.filter('team = {:id}', { id }), sort: '-created' }).then(setUitnodigingen)

  useEffect(() => { uitnodigingenLaden().catch(() => {}) }, [id])

  // Open toegangsaanvragen van ouders (via de aanmeldlink)
  const [aanvragen, setAanvragen] = useState<{ id: string; naam: string; email: string; kindNaam: string }[]>([])
  const ververs = () => aanvragenLaden().catch(() => {})
  const lijstLaden = () =>
    pb.collection('toegangsaanvragen').getFullList<{ id: string; naam: string; email: string; kindNaam: string }>({ filter: pb.filter("team = {:id} && status = 'nieuw'", { id }), sort: 'created' }).then(setAanvragen)
  useEffect(() => { lijstLaden().catch(() => {}) }, [id])
  const beslis = (aanvraagId: string, besluit: 'kijker' | 'beheerder' | 'af', wie: string) => doe(async () => {
    await pb.send(`/api/hockey/toegang-id/${aanvraagId}`, { method: 'POST', body: { besluit } })
    tel(`toegang-${besluit}`)
    await lijstLaden()
    await uitnodigingenLaden()
    await ververs()
  }, besluit === 'af' ? `Aanvraag van ${wie} afgewezen.` : `${wie} is toegelaten en krijgt een mail om een wachtwoord te kiezen.`)

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
                  aria-label={`Uitnodiging voor ${u.email} intrekken`}
                  onClick={() => doe(async () => { await pb.collection('uitnodigingen').delete(u.id); await uitnodigingenLaden() })}
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
            {aanvragen.map(a => (
              <div key={a.id} className="account-aanvraag">
                <span className="account-regel-naam">{a.naam}</span>
                <span className="account-regel-sub">ouder van {a.kindNaam} · {a.email}</span>
                <div className="account-aanvraag-knoppen">
                  <button className="btn btn-primary" disabled={bezig} onClick={() => beslis(a.id, 'kijker', a.naam)}>Toelaten</button>
                  <button className="btn btn-gevaar" disabled={bezig} onClick={() => beslis(a.id, 'af', a.naam)}>Afwijzen</button>
                </div>
              </div>
            ))}
          </div>
          <p className="account-uitleg">Toelaten = als kijker. Maak iemand daarna bij Leden beheerder als dat nodig is.</p>
        </>
      )}

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
              <button className="btn btn-gevaar" disabled={bezig} onClick={() => { setEruitVraag(lid); setLid(null) }}>Uit team</button>
            </div>
          </div>
        </div>
      )}

      {eruitVraag && (
        <ResetModal
          titel={eruitVraag.gast ? 'Meekijklink uitzetten?' : `${eruitVraag.name || eruitVraag.email} uit het team halen?`}
          regels={eruitVraag.gast ? [
            { icoon: '🔗', tekst: `Wie de meekijklink heeft, kan ${team.naam} niet meer zien` },
            { icoon: '↩', tekst: 'Een nieuwe meekijklink maken kan altijd weer' },
          ] : [
            { icoon: '👤', tekst: `${eruitVraag.name || eruitVraag.email} kan ${team.naam} niet meer zien of bijhouden` },
            { icoon: '↩', tekst: 'Terugzetten kan alleen met een nieuwe uitnodiging' },
          ]}
          bevestig={eruitVraag.gast ? 'Ja, link uitzetten' : 'Ja, uit het team'}
          gevaar
          onConfirm={() => { zetRol(eruitVraag.id, null); setEruitVraag(null) }}
          onCancel={() => setEruitVraag(null)}
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
          <label className="account-label">
            Je naam
            <input className="modal-input" autoComplete="name" value={naam} onChange={e => setNaam(e.target.value)} />
          </label>
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

function TeamAanmelden() {
  const { gebruiker } = useAccount()
  const [teamnaam, setTeamnaam] = useState('')
  const [naam, setNaam] = useState(gebruiker?.name ?? '')
  const [email, setEmail] = useState(gebruiker?.email ?? '')
  const [bericht, setBericht] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [verstuurd, setVerstuurd] = useState(false)

  const versturen = async () => {
    setBezig(true)
    setFout(null)
    try {
      await pb.send('/api/hockey/aanmelding', { method: 'POST', body: { teamnaam, naam, email, bericht, terug: appAdres() } })
      tel('team-aangemeld')
      setVerstuurd(true)
    } catch (err) {
      setFout((err as { status?: number }).status === 429 ? 'Te veel aanmeldingen. Probeer het over een uur nog eens.' : foutTekst(err))
    }
    setBezig(false)
  }

  if (verstuurd) {
    return <p className="account-melding">Aanmelding verstuurd. Je krijgt een mail op {email.trim()} zodra je team is goedgekeurd.</p>
  }

  return (
    <form className="account-form" onSubmit={e => { e.preventDefault(); versturen() }}>
      <p className="account-uitleg">Meld je team aan. Na goedkeuring krijg je een mail om je account te maken; je wordt dan beheerder van het team.</p>
      <label className="account-label">
        Naam van het team
        <input className="modal-input" placeholder="bijv. MO11-3 HC Voorbeeld" value={teamnaam} onChange={e => setTeamnaam(e.target.value)} />
      </label>
      <label className="account-label">
        Je naam
        <input className="modal-input" autoComplete="name" value={naam} onChange={e => setNaam(e.target.value)} />
      </label>
      <label className="account-label">
        E-mail
        <input className="modal-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <label className="account-label">
        Bericht (mag leeg)
        <textarea className="modal-input account-bericht" value={bericht} onChange={e => setBericht(e.target.value)} />
      </label>
      <Melding tekst={fout} fout />
      <button className="btn btn-primary" type="submit" disabled={bezig || !teamnaam.trim() || !email.includes('@')}>Aanmelding versturen</button>
    </form>
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
function MeekijkenStart({ waarde, klaar, annuleer }: { waarde: string; klaar: () => void; annuleer: () => void }) {
  const { gebruiker, teams, kiesTeam, meekijken, uitloggen } = useAccount()
  const [teamId, token] = [waarde.slice(0, waarde.indexOf('.')), waarde.slice(waarde.indexOf('.') + 1)]
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const eigenLid = !!gebruiker && !gebruiker.gast && teams.some(t => t.id === teamId)
  const ander = !!gebruiker && !gebruiker.gast && !eigenLid

  const start = async () => {
    setBezig(true)
    setFout(null)
    try {
      if (gebruiker) uitloggen()
      await meekijken(teamId, token)
      tel('meekijken-gestart')
      klaar()
    } catch (err) {
      setFout((err as { status?: number }).status === 400 ? 'Deze link werkt niet meer. Vraag om een nieuwe.' : foutTekst(err))
    }
    setBezig(false)
  }

  useEffect(() => {
    // Zelf al lid van dit team: gewoon dat team openen
    if (eigenLid) { kiesTeam(teamId); klaar(); return }
    if (!ander) start()
  }, [])

  if (ander) {
    return (
      <div className="account-form">
        <p className="account-uitleg">Je bent ingelogd als <strong>{gebruiker!.name || gebruiker!.email}</strong>. Om via deze link mee te kijken, word je uitgelogd.</p>
        <Melding tekst={fout} fout />
        <button className="btn btn-primary" onClick={start} disabled={bezig}>Uitloggen en meekijken</button>
        <button className="btn btn-secondary" onClick={annuleer}>Annuleren</button>
      </div>
    )
  }
  return fout ? <Melding tekst={fout} fout /> : <p className="account-uitleg">Meekijken starten…</p>
}

const THEMAS: { id: Thema; naam: string }[] = [
  { id: 'auto', naam: 'Automatisch' },
  { id: 'licht', naam: 'Licht' },
  { id: 'donker', naam: 'Donker' },
]

// Licht/donker: volgens de telefoon, of vast gekozen (geldt alleen op deze telefoon)
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

interface AanvraagForm { team: string; spelers: { id: string; naam: string }[] }
const ANDERS = '__anders__'

// Ouder opent de aanmeldlink van het team (#aanvraag=<team>.<token>) en vraagt toegang aan
function ToegangAanvragen({ waarde }: { waarde: string }) {
  const [form, setForm] = useState<AanvraagForm | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [naam, setNaam] = useState('')
  const [kind, setKind] = useState('')
  const [kindNaam, setKindNaam] = useState('')
  const [email, setEmail] = useState('')
  const [bezig, setBezig] = useState(false)
  const [verstuurd, setVerstuurd] = useState(false)
  const url = `/api/hockey/aanvraag/${encodeURIComponent(waarde)}`

  useEffect(() => {
    pb.send<AanvraagForm>(url, {}).then(setForm).catch(err => setFout(foutTekst(err)))
  }, [url])

  const versturen = async () => {
    setBezig(true)
    setFout(null)
    try {
      await pb.send(url, { method: 'POST', body: { naam, email, kindId: kind === ANDERS ? '' : kind, kindNaam: kind === ANDERS ? kindNaam : '', terug: appAdres() } })
      tel('toegang-aangevraagd')
      setVerstuurd(true)
    } catch (err) {
      setFout((err as { status?: number }).status === 429 ? 'Te veel aanvragen. Probeer het over een uur nog eens.' : foutTekst(err))
    }
    setBezig(false)
  }

  if (!form) return fout ? <Melding tekst={fout} fout /> : <p className="account-uitleg">Even laden…</p>
  if (verstuurd) {
    return <p className="account-melding">Je aanvraag is verstuurd naar de beheerders van {form.team}. Na goedkeuring krijg je een mail op {email.trim()} om je account te maken.</p>
  }
  const kindGekozen = kind && (kind !== ANDERS || kindNaam.trim())
  return (
    <form className="account-form" onSubmit={e => { e.preventDefault(); versturen() }}>
      <div className="account-wie"><span className="account-wie-naam">{form.team}</span></div>
      <p className="account-uitleg">Vraag een account aan. De beheerders van het team krijgen je aanvraag en laten je toe.</p>
      <label className="account-label">
        Jouw voornaam
        <input className="modal-input" autoComplete="given-name" value={naam} onChange={e => setNaam(e.target.value)} />
      </label>
      <label className="account-label">
        Voornaam van je kind
        <select className="modal-input" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">Kies…</option>
          {form.spelers.map(s => <option key={s.id} value={s.id}>{s.naam}</option>)}
          <option value={ANDERS}>Staat er niet bij</option>
        </select>
      </label>
      {kind === ANDERS && <input className="modal-input" placeholder="Voornaam van je kind" value={kindNaam} onChange={e => setKindNaam(e.target.value)} />}
      <label className="account-label">
        E-mail
        <input className="modal-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <Melding tekst={fout} fout />
      <button className="btn btn-primary" type="submit" disabled={bezig || !naam.trim() || !kindGekozen || !email.includes('@')}>Aanvraag versturen</button>
    </form>
  )
}

interface AanvraagInfo { team: string; naam: string; email: string; kind: string; status: 'nieuw' | 'toegelaten' | 'afgewezen' }

// Beheerder opent de link uit de mail (#toegang=<token>)
function ToegangBeoordelen({ token }: { token: string }) {
  const [info, setInfo] = useState<AanvraagInfo | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const url = `/api/hockey/toegang/${encodeURIComponent(token)}`

  useEffect(() => {
    pb.send<AanvraagInfo>(url, {}).then(setInfo).catch(err => setFout(foutTekst(err)))
  }, [url])

  const beslis = async (besluit: 'kijker' | 'beheerder' | 'af') => {
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
      ) : (
        <p className={`account-melding ${info.status === 'afgewezen' ? 'fout' : ''}`}>
          {info.status === 'toegelaten' ? `${info.naam} is toegelaten en krijgt een mail om een wachtwoord te kiezen.` : 'Deze aanvraag is afgewezen.'}
        </p>
      )}
    </div>
  )
}
