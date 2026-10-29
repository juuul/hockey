import { useEffect, useId, useRef, useState } from 'react'
import { useAccount } from '../context/AccountContext'
import { appAdres, foutTekst, pb } from '../server'
import { clubKomtOvereen, teamKomtOvereen } from '../clubzoeken'
import './TeamSelectie.css'
import { lees, OPSLAG, schrijf } from '../opslag'

export interface OfficieelTeam {
  id: string; bronId: string; clubBronId: string; naam: string; seizoen: string
  geslacht: string; leeftijd: string; categorie: string; spelvorm: string; klasse: string; gecontroleerd: string
}
interface CatalogusClub { id: string; bronId: string; naam: string; plaats: string }
interface OfficieleWedstrijd { id: string; datum: string; spelen: string; thuisNaam: string; uitNaam: string; uitslag?: { home: number; away: number } | null }
interface Omgeving { id: string; naam: string; omgevingNaam: string }
type Stap = 1 | 2 | 3

function bewaardeClubs(): CatalogusClub[] {
  const lijst = lees<unknown>(OPSLAG, 'catalogus_clubs', [])
  if (!Array.isArray(lijst)) return []
  return lijst.filter(c => c && ['id', 'bronId', 'naam', 'plaats'].every(k => typeof c[k] === 'string'))
}

// Een club kiezen laadt alleen de teams van die club. Gegevens komen uit de eigen catalogus.
export function TeamKiezer({ gekozen, kies, stap, naarStap }: { gekozen: OfficieelTeam | null; kies: (t: OfficieelTeam | null) => void; stap?: Stap; naarStap?: (stap: Stap) => void }) {
  const clubTitel = useId()
  const teamTitel = useId()
  const [clubs, setClubs] = useState<CatalogusClub[]>(bewaardeClubs)
  const [clubsLaden, setClubsLaden] = useState(true)
  const [clubsGeladen, setClubsGeladen] = useState(false)
  const [clubsFout, setClubsFout] = useState('')
  const [clubPoging, setClubPoging] = useState(0)
  const [zoek, setZoek] = useState('')
  const [teamZoek, setTeamZoek] = useState('')
  const [alleResultaten, setAlleResultaten] = useState(false)
  const [clubId, setClubId] = useState('')
  const [teams, setTeams] = useState<OfficieelTeam[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const [ververs, setVervers] = useState(0)
  useEffect(() => {
    let actief = true
    let controller: AbortController | undefined
    let herhaal: ReturnType<typeof setTimeout> | undefined
    const laad = async (poging = 0) => {
      setClubsLaden(true); setClubsFout('')
      controller = new AbortController()
      const timeout = setTimeout(() => controller?.abort(), 10_000)
      try {
        const lijst = await pb.collection('catalogus_clubs').getFullList<CatalogusClub>({ sort: 'naam', signal: controller.signal })
        if (!actief) return
        setClubs(lijst); setClubsGeladen(true); setClubsLaden(false)
        // Alleen openbare clubvelden bewaren, geen leden, tokens of accountgegevens.
        schrijf(OPSLAG, 'catalogus_clubs', lijst.map(({ id, bronId, naam, plaats }) => ({ id, bronId, naam, plaats })))
      } catch (e) {
        if (!actief) return
        const status = (e as { status?: number }).status
        if (poging < 2 && (status === 0 || (status ?? 0) >= 500)) {
          herhaal = setTimeout(() => laad(poging + 1), 1500 * (poging + 1))
        } else {
          setClubsFout(foutTekst(e)); setClubsLaden(false)
        }
      } finally {
        clearTimeout(timeout)
      }
    }
    laad()
    return () => { actief = false; clearTimeout(herhaal); controller?.abort() }
  }, [clubPoging])
  useEffect(() => {
    const opnieuw = () => setClubPoging(p => p + 1)
    window.addEventListener('online', opnieuw)
    return () => window.removeEventListener('online', opnieuw)
  }, [])
  const club = clubs.find(c => c.id === clubId)
  useEffect(() => {
    if (!club) return
    let actief = true
    setTeams([]); setLaden(true); setFout('')
    const laad = async () => {
      try {
        const lijst = await pb.collection('catalogus_teams').getFullList<OfficieelTeam>({ filter: pb.filter('clubBronId = {:id} && actief = true', { id: club.bronId }), sort: '-seizoen,naam' })
        if (actief) { setTeams(lijst); setLaden(false) }
      } catch (e) { if (actief) { setFout(foutTekst(e)); setLaden(false) } }
    }
    laad()
    // Een importverzoek is begrensd en hergebruikbaar; de achtergrondimport leest de openbare bron.
    pb.send(`/api/hockey/catalogus/club/${club.id}/ververs`, { method: 'POST' }).catch(e => { if (actief) setFout(foutTekst(e)) })
    const timer = setInterval(laad, 10_000)
    return () => { actief = false; clearInterval(timer) }
  }, [clubId, ververs, clubs])
  const velden = [['seizoen', 'Seizoen'], ['geslacht', 'Teamtype'], ['leeftijd', 'Leeftijd'], ['spelvorm', 'Veld of zaal']] as const
  const lijst = teams.filter(t => teamKomtOvereen(t.naam, teamZoek) && velden.every(([veld]) => !filters[veld] || t[veld] === filters[veld]))
  const filterKeuzes = velden.map(([veld, label]) => ({ veld, label, waarden: [...new Set(teams.filter(t => velden.every(([ander]) => ander === veld || !filters[ander] || t[ander] === filters[ander])).map(t => t[veld]).filter(Boolean))].sort().reverse() }))
    .filter(({ veld, waarden }) => waarden.length > 1 || filters[veld])
  const gevondenClubs = clubs.filter(c => clubKomtOvereen(c.naam, c.plaats, zoek)).sort((a, b) =>
    Number(!a.naam.toLowerCase().startsWith(zoek.trim().toLowerCase())) - Number(!b.naam.toLowerCase().startsWith(zoek.trim().toLowerCase())) || a.naam.localeCompare(b.naam, 'nl'))
  return <>
    {(!stap || stap === 1) && <section className="teamselectie-stap" aria-labelledby={stap ? undefined : clubTitel}>
      {!stap && <h2 id={clubTitel}>Club kiezen</h2>}
      {club && !stap ? <div className="teamselectie-geselecteerd">
        <span><strong>{club.naam}</strong><small>{club.plaats}</small></span>
        <button className="teamselectie-link" type="button" onClick={() => { setClubId(''); setTeams([]); setFilters({}); setFout(''); kies(null) }}>Wijzigen</button>
      </div> : <>
        <label className="account-label"><span className="teamselectie-sr">Zoek je club</span>
          <input className="modal-input" type="search" placeholder="Clubnaam of plaats" value={zoek} onChange={e => { setZoek(e.target.value); setAlleResultaten(false) }} />
        </label>
        {!!zoek.trim() && !!gevondenClubs.length && <div className="teamselectie-resultaten" aria-label="Gevonden clubs">
          {(alleResultaten ? gevondenClubs : gevondenClubs.slice(0, 6)).map(c => <button key={c.id} className="teamselectie-resultaat" type="button" onClick={() => {
            if (clubId !== c.id) { setClubId(c.id); setTeams([]); setFilters({}); setTeamZoek(''); kies(null) }
            naarStap?.(2)
          }}>
            <span><strong>{c.naam}</strong><small>{c.plaats}</small></span><span aria-hidden="true">›</span>
          </button>)}
          {!alleResultaten && gevondenClubs.length > 6 && <button className="teamselectie-link" type="button" onClick={() => setAlleResultaten(true)}>Meer clubs tonen ({gevondenClubs.length - 6})</button>}
        </div>}
      </>}
    {clubsLaden && <p className="account-uitleg" role="status">{clubs.length ? 'Clublijst bijwerken…' : 'Clubs ophalen…'}</p>}
    {clubsFout && <div>
      <p className="account-melding fout" role="alert">Clubs laden lukt niet.{clubs.length ? ' Bewaarde clubs blijven beschikbaar.' : ''}</p>
      <button className="btn btn-secondary" type="button" onClick={() => setClubPoging(p => p + 1)}>Opnieuw proberen</button>
    </div>}
    {clubsGeladen && !clubsLaden && !clubsFout && !!zoek.trim() && !gevondenClubs.length && <p className="account-uitleg" role="status">Geen clubs gevonden.</p>}
    </section>}
    {club && stap && stap > 1 && <div className="teamselectie-geselecteerd">
      <span><strong>{stap === 3 && gekozen ? gekozen.naam : club.naam}</strong><small>{stap === 3 && gekozen ? `${gekozen.seizoen} · ${gekozen.spelvorm}` : club.plaats}</small></span>
      <button className="teamselectie-link" type="button" onClick={() => naarStap?.(stap === 3 ? 2 : 1)}>Wijzigen</button>
    </div>}
    {club && (!stap || stap === 2) && <section className="teamselectie-stap" aria-labelledby={stap ? undefined : teamTitel}>
      {!stap && <h2 id={teamTitel}>Team kiezen</h2>}
      {!!teams.length && <label className="account-label"><span className="teamselectie-sr">Zoek een team</span>
        <input className="modal-input" type="search" placeholder="Zoek een team" value={teamZoek} onChange={e => setTeamZoek(e.target.value)} />
      </label>}
      {laden && <p className="account-uitleg">Teams ophalen…</p>}
      {!laden && !teams.length && !fout && <p className="account-uitleg">Nog geen teams beschikbaar. Probeer het straks opnieuw.</p>}
      {!!filterKeuzes.length && <details className="teamselectie-filters">
        <summary>Filters</summary>
      {filterKeuzes.map(({ veld, label, waarden }) => {
        return <label key={veld} className="account-label">{label}
          <select className="modal-input" value={filters[veld] || ''} onChange={e => { setFilters(f => ({ ...f, [veld]: e.target.value })); kies(null) }}>
            <option value="">Alle {label.toLowerCase()}</option>
            {waarden.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
      })}
      </details>}
      {!!teams.length && !lijst.length && <p className="account-uitleg" role="status">Geen teams gevonden. Pas je zoekopdracht of filters aan.</p>}
      <div className="teamselectie-resultaten" aria-label="Gevonden teams">
        {lijst.map(t => <button key={t.id} className="teamselectie-resultaat" type="button" aria-pressed={gekozen?.id === t.id} onClick={() => {
          kies(t); naarStap?.(3)
          pb.send(`/api/hockey/catalogus/team/${t.id}/ververs`, { method: 'POST' }).catch(() => {})
        }}>
          <span><strong>{t.naam}</strong><small>{t.seizoen} · {t.spelvorm}</small></span><span aria-hidden="true">›</span>
        </button>)}
      </div>
      {gekozen && !stap && <OfficieelProgramma key={gekozen.id} team={gekozen} />}
      {(fout || (!laden && !teams.length)) && <button type="button" className="teamselectie-link" onClick={() => setVervers(v => v + 1)}>Opnieuw proberen</button>}
      {fout && <p className="account-melding fout" role="alert">Teams laden lukt niet.</p>}
    </section>}
  </>
}

// Het officiële programma is openbaar; dit component leest geen privéteamgegevens.
function OfficieelProgramma({ team }: { team: OfficieelTeam }) {
  const [wedstrijden, setWedstrijden] = useState<OfficieleWedstrijd[]>([])
  const [fout, setFout] = useState('')
  useEffect(() => {
    let actief = true
    const laad = () => pb.collection('catalogus_wedstrijden').getFullList<OfficieleWedstrijd>({
      filter: pb.filter('seizoen = {:s} && (thuisBronId = {:id} || uitBronId = {:id})', { s: team.seizoen, id: team.bronId }), sort: 'datum',
    }).then(w => { if (actief) { setWedstrijden(w); setFout('') } }).catch(e => { if (actief) setFout(foutTekst(e)) })
    laad()
    const interval = setInterval(laad, 30_000)
    return () => { actief = false; clearInterval(interval) }
  }, [team.id])
  return <details>
    <summary className="teamselectie-link">Wedstrijdprogramma</summary>
    <p className="account-uitleg">Bron: KNHB Match Center.</p>
    {!wedstrijden.length && !fout && <p className="account-uitleg">Nog geen wedstrijden beschikbaar.</p>}
    {wedstrijden.map(w => <div key={w.id} className="account-wie">
      <span className="account-wie-sub">{new Date(w.datum + 'T12:00:00').toLocaleDateString('nl-NL')} · {w.spelen || 'tijd onbekend'}</span>
      <span className="account-wie-sub">{w.thuisNaam} – {w.uitNaam}</span>
      {w.uitslag && <span className="account-wie-sub">{w.uitslag.home} – {w.uitslag.away}</span>}
    </div>)}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
  </details>
}

export default function TeamAanmelden({ startKeuze = 'bestaand', stap, naarStap }: { startKeuze?: 'bestaand' | 'nieuw'; stap: Stap; naarStap: (stap: Stap) => void }) {
  const { gebruiker, teamsLaden, kiesTeam } = useAccount()
  const [officieel, setOfficieel] = useState<OfficieelTeam | null>(null)
  const [omgevingen, setOmgevingen] = useState<Omgeving[]>([])
  const [keuze, setKeuze] = useState<'bestaand' | 'nieuw'>(startKeuze)
  const [omgeving, setOmgeving] = useState('')
  const [omgevingNaam, setOmgevingNaam] = useState('')
  const [naam, setNaam] = useState(gebruiker?.name || '')
  const [email, setEmail] = useState(gebruiker?.email || '')
  const [bezig, setBezig] = useState(false)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const [melding, setMelding] = useState('')
  const titelRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titelRef.current?.focus({ preventScroll: true })
    titelRef.current?.closest('.content')?.scrollTo(0, 0)
  }, [stap])
  useEffect(() => {
    setOmgevingen([]); setOmgeving(''); setFout(''); setLaden(false)
    if (!officieel) return
    let actief = true
    setLaden(true)
    pb.send<Omgeving[]>(`/api/hockey/catalogus/team/${officieel.id}/omgevingen`, {}).then(lijst => {
      if (actief) { setOmgevingen(lijst); setOmgeving(lijst.length === 1 ? lijst[0].id : '') }
    }).catch(e => { if (actief) setFout(foutTekst(e)) }).finally(() => { if (actief) setLaden(false) })
    return () => { actief = false }
  }, [officieel?.id])
  const versturen = async () => {
    if (stap !== 3 || bezig || !officieel || laden || (keuze === 'bestaand' && !omgeving)) return
    setBezig(true); setFout('')
    try {
      if (keuze === 'bestaand') {
        await pb.send(`/api/hockey/catalogus/omgeving/${omgeving}/aanvraag`, { method: 'POST', body: { naam: gebruiker?.name || naam, email: gebruiker?.email || email, terug: appAdres() } })
        setMelding('Je ontvangt direct een uitnodiging per e-mail. Open de link om aan te sluiten.')
      } else if (gebruiker) {
        const r = await pb.send<{ id: string }>('/api/hockey/catalogus/omgeving', { method: 'POST', body: { officieelTeam: officieel.id, omgevingNaam } })
        await teamsLaden(); kiesTeam(r.id)
        setMelding('Groep aangemaakt. Je kunt nu leden uitnodigen.')
      } else {
        await pb.send('/api/hockey/aanmelding', { method: 'POST', body: { officieelTeam: officieel.id, omgevingNaam, naam, email, terug: appAdres() } })
        setMelding(`Je krijgt een uitnodiging op ${email.trim()}.`)
      }
      // Na de bevestiging gaat Terug naar het overzicht, niet naar een verborgen tussenstap.
      naarStap(1)
    } catch (e) { setFout(foutTekst(e)) }
    finally { setBezig(false) }
  }
  if (melding) return <p className="account-melding" role="status">{melding}</p>
  return <form className="account-form teamselectie-wizard" onSubmit={e => { e.preventDefault(); versturen() }} onKeyDown={e => {
    if (e.key === 'Enter' && (e.target as HTMLInputElement).type === 'search') e.preventDefault()
  }}>
    <nav aria-label="Stappen team kiezen"><ol className="teamselectie-voortgang">
      {(['Club', 'Team', 'Groep'] as const).map((label, i) => <li key={label}>
        <button type="button" aria-current={stap === i + 1 ? 'step' : undefined} disabled={i + 1 > stap} onClick={() => naarStap((i + 1) as Stap)}>
          <span className="teamselectie-stapnummer" aria-hidden="true">{i + 1 < stap ? '✓' : i + 1}</span>{label}
        </button>
      </li>)}
    </ol></nav>
    <h2 className="teamselectie-vraag" ref={titelRef} tabIndex={-1}>{stap === 1 ? 'Bij welke club speel je?' : stap === 2 ? 'Welk team zoek je?' : keuze === 'bestaand' ? 'Kies je groep' : 'Maak je eigen groep'}</h2>
    <TeamKiezer gekozen={officieel} kies={setOfficieel} stap={stap} naarStap={naarStap} />
    {stap === 3 && officieel && <section className="teamselectie-stap">
      {keuze === 'bestaand' && (laden ? <p className="account-uitleg">Groepen ophalen…</p> : !!omgevingen.length ? <fieldset className="teamselectie-keuzes">
        <legend>Kies je groep</legend>
        {omgevingen.map(o => <label key={o.id} className="teamselectie-keuze">
          <input type="radio" name="bestaande-groep" value={o.id} checked={omgeving === o.id} onChange={() => setOmgeving(o.id)} />
          <span>{o.naam}{omgevingen.filter(andere => andere.naam === o.naam).length > 1 ? ` · groep ${o.id.slice(-5)}` : ''}</span>
        </label>)}
      </fieldset> : !fout && <div>
        <p className="account-uitleg">Geen openbare groep gevonden. Vraag je teambeheerder om een aanmeldlink.</p>
      </div>)}
      {keuze === 'nieuw' && <label className="account-label">Groepsnaam (openbaar, optioneel)
        <input className="modal-input" placeholder="Bijvoorbeeld begeleiding" maxLength={40} value={omgevingNaam} onChange={e => setOmgevingNaam(e.target.value)} />
      </label>}
      {(keuze === 'nieuw' || !!omgevingen.length) && <p className="account-uitleg">{keuze === 'bestaand' ? 'Je ontvangt direct een uitnodiging per e-mail.' : 'Je wordt beheerder van deze groep.'}</p>}
      {!gebruiker && (keuze === 'nieuw' || !!omgevingen.length) && <>
        <label className="account-label">Je naam<input className="modal-input" autoComplete="name" required maxLength={60} value={naam} onChange={e => setNaam(e.target.value)} /></label>
        <label className="account-label">E-mail<input className="modal-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      </>}
      {(keuze === 'nieuw' || !!omgevingen.length) && <button className="btn btn-primary" type="submit" disabled={bezig || laden || (keuze === 'bestaand' && !omgeving) || (!gebruiker && (!naam.trim() || !email.includes('@')))}>{bezig ? 'Bezig…' : keuze === 'nieuw' ? 'Eigen groep maken' : 'Toegang aanvragen'}</button>}
      <OfficieelProgramma key={officieel.id} team={officieel} />
    </section>}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
    <button className="teamselectie-link teamselectie-wissel" type="button" onClick={() => { setKeuze(k => k === 'bestaand' ? 'nieuw' : 'bestaand'); setFout('') }}>{keuze === 'bestaand' ? 'Nieuw team starten' : 'Aansluiten bij een team'}</button>
  </form>
}

export function TeamKoppelen({ id, gekoppeld }: { id: string; gekoppeld?: string }) {
  const { teamsLaden } = useAccount()
  const [officieel, setOfficieel] = useState<OfficieelTeam | null>(null)
  const [melding, setMelding] = useState('')
  const [bezig, setBezig] = useState(false)
  if (gekoppeld) return <p className="account-uitleg">Dit team ontvangt updates van het gekoppelde officiële team. Eigen gegevens blijven behouden.</p>
  return <details>
    <summary className="btn btn-secondary">Bestaand team koppelen aan de clubgegevens</summary>
    <p className="account-uitleg">Je spelers, leden en eigen wedstrijdgegevens blijven behouden. Kies het juiste team en seizoen; de koppeling geldt voor deze omgeving.</p>
    <TeamKiezer gekozen={officieel} kies={setOfficieel} />
    <button className="btn btn-primary" disabled={!officieel || bezig} onClick={async () => {
      setBezig(true)
      try {
        await pb.send(`/api/hockey/catalogus/omgeving/${id}/koppel`, { method: 'POST', body: { officieelTeam: officieel!.id } })
        await teamsLaden()
      } catch (e) { setMelding(foutTekst(e)) }
      finally { setBezig(false) }
    }}>Koppelen en wedstrijdgegevens aanvullen</button>
    {melding && <p className="account-melding fout" role="alert">{melding}</p>}
  </details>
}
