import { useEffect, useState } from 'react'
import { useAccount } from '../context/AccountContext'
import { appAdres, foutTekst, pb } from '../server'
import { clubKomtOvereen } from '../clubzoeken'
import './TeamSelectie.css'
import { lees, OPSLAG, schrijf } from '../opslag'

export interface OfficieelTeam {
  id: string; bronId: string; clubBronId: string; naam: string; seizoen: string
  geslacht: string; leeftijd: string; categorie: string; spelvorm: string; klasse: string; gecontroleerd: string
}
interface CatalogusClub { id: string; bronId: string; naam: string; plaats: string }
interface OfficieleWedstrijd { id: string; datum: string; spelen: string; thuisNaam: string; uitNaam: string; uitslag?: { home: number; away: number } | null }
interface Omgeving { id: string; naam: string; omgevingNaam: string }

function bewaardeClubs(): CatalogusClub[] {
  const lijst = lees<unknown>(OPSLAG, 'catalogus_clubs', [])
  if (!Array.isArray(lijst)) return []
  return lijst.filter(c => c && ['id', 'bronId', 'naam', 'plaats'].every(k => typeof c[k] === 'string'))
}

// Een club kiezen laadt alleen de teams van die club. Gegevens komen uit de eigen catalogus.
export function TeamKiezer({ gekozen, kies }: { gekozen: OfficieelTeam | null; kies: (t: OfficieelTeam | null) => void }) {
  const [clubs, setClubs] = useState<CatalogusClub[]>(bewaardeClubs)
  const [clubsLaden, setClubsLaden] = useState(true)
  const [clubsGeladen, setClubsGeladen] = useState(false)
  const [clubsFout, setClubsFout] = useState('')
  const [clubPoging, setClubPoging] = useState(0)
  const [zoek, setZoek] = useState('')
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
  const velden = [['seizoen', 'Seizoen'], ['geslacht', 'Meisjes, jongens of gemengd'], ['leeftijd', 'Leeftijd'], ['spelvorm', 'Veld of zaal']] as const
  const lijst = teams.filter(t => velden.every(([veld]) => !filters[veld] || t[veld] === filters[veld]))
  const gevondenClubs = clubs.filter(c => clubKomtOvereen(c.naam, c.plaats, zoek))
  return <>
    <label className="account-label">Zoek je club
      <input className="modal-input" type="search" placeholder="Clubnaam, afkorting of plaats, bijvoorbeeld sc" value={zoek} onChange={e => setZoek(e.target.value)} />
    </label>
    {clubsLaden && <p className="account-uitleg" role="status">{clubs.length ? 'Clublijst bijwerken… Je kunt alvast zoeken.' : 'Clubs ophalen… Bij een verbindingsprobleem proberen we het automatisch opnieuw.'}</p>}
    {clubsFout && <div>
      <p className="account-melding fout" role="alert">De clublijst kon niet worden opgehaald. {clubsFout}{clubs.length ? ' Je kunt de eerder opgehaalde clubs alvast doorzoeken. Voor teams en toegang aanvragen is verbinding nodig.' : ''}</p>
      <button className="btn btn-secondary" type="button" onClick={() => setClubPoging(p => p + 1)}>Clubs opnieuw ophalen</button>
    </div>}
    {clubsGeladen && !clubsLaden && !clubsFout && !!zoek.trim() && !gevondenClubs.length && <p className="account-uitleg" role="status">Geen clubs gevonden. Probeer een andere naam, afkorting of plaats.</p>}
    <label className="account-label">Club
      <select className="modal-input" disabled={!clubs.length} value={clubId} onChange={e => { setClubId(e.target.value); setFilters({}); kies(null) }}>
        <option value="">Kies je club…</option>
        {clubs.filter(c => c.id === clubId || gevondenClubs.includes(c)).map(c => <option key={c.id} value={c.id}>{c.naam} · {c.plaats}</option>)}
      </select>
    </label>
    {club && <>
      {laden && <p className="account-uitleg">Teams ophalen…</p>}
      {!laden && !teams.length && <p className="account-uitleg">De teams van deze club worden opgehaald. Dit kan enkele minuten duren. Laat dit scherm open of probeer het later opnieuw.</p>}
      {velden.map(([veld, label]) => {
        const waarden = [...new Set(teams.filter(t => velden.every(([ander]) => ander === veld || !filters[ander] || t[ander] === filters[ander])).map(t => t[veld]).filter(Boolean))].sort().reverse()
        if (!waarden.length) return null
        return <label key={veld} className="account-label">{label}
          <select className="modal-input" value={filters[veld] || ''} onChange={e => { setFilters(f => ({ ...f, [veld]: e.target.value })); kies(null) }}>
            <option value="">Alle {label.toLowerCase()}</option>
            {waarden.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
      })}
      {!!teams.length && <label className="account-label">Officieel team
        <select className="modal-input" value={gekozen?.id || ''} onChange={e => {
          const t = teams.find(t => t.id === e.target.value) || null
          kies(t)
          if (t) pb.send(`/api/hockey/catalogus/team/${t.id}/ververs`, { method: 'POST' }).catch(() => {})
        }}>
          <option value="">Kies je team…</option>
          {lijst.map(t => <option key={t.id} value={t.id}>{t.naam} · {t.seizoen} · {t.spelvorm}</option>)}
        </select>
      </label>}
      {gekozen && <OfficieelProgramma key={gekozen.id} team={gekozen} />}
      {gekozen && <p className="account-uitleg">Bron: KNHB Match Center. Gecontroleerd {new Date(gekozen.gecontroleerd).toLocaleDateString('nl-NL')}. Alleen gepubliceerde wedstrijden worden overgenomen.</p>}
      <button type="button" className="btn btn-secondary" onClick={() => setVervers(v => v + 1)}>Gegevens opnieuw controleren</button>
    </>}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
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
    <summary className="btn btn-secondary">Officieel wedstrijdprogramma bekijken</summary>
    {!wedstrijden.length && !fout && <p className="account-uitleg">Er staan nog geen wedstrijden voor dit team in de catalogus. Ze verschijnen na een geslaagde broncontrole.</p>}
    {wedstrijden.map(w => <div key={w.id} className="account-wie">
      <span className="account-wie-sub">{new Date(w.datum + 'T12:00:00').toLocaleDateString('nl-NL')} · {w.spelen || 'tijd onbekend'}</span>
      <span className="account-wie-sub">{w.thuisNaam} – {w.uitNaam}</span>
      {w.uitslag && <span className="account-wie-sub">{w.uitslag.home} – {w.uitslag.away}</span>}
    </div>)}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
  </details>
}

export default function TeamAanmelden() {
  const { gebruiker, teamsLaden, kiesTeam } = useAccount()
  const [officieel, setOfficieel] = useState<OfficieelTeam | null>(null)
  const [omgevingen, setOmgevingen] = useState<Omgeving[]>([])
  const [keuze, setKeuze] = useState<'bestaand' | 'nieuw'>('bestaand')
  const [omgeving, setOmgeving] = useState('')
  const [omgevingNaam, setOmgevingNaam] = useState('')
  const [naam, setNaam] = useState(gebruiker?.name || '')
  const [email, setEmail] = useState(gebruiker?.email || '')
  const [bezig, setBezig] = useState(false)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const [melding, setMelding] = useState('')
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
    if (!officieel || laden || (keuze === 'bestaand' && !omgeving)) return
    setBezig(true); setFout('')
    try {
      if (keuze === 'bestaand') {
        await pb.send(`/api/hockey/catalogus/omgeving/${omgeving}/aanvraag`, { method: 'POST', body: { naam: gebruiker?.name || naam, email: gebruiker?.email || email, terug: appAdres() } })
        setMelding('Je aanvraag staat klaar voor de beheerder. Na goedkeuring krijg je een uitnodiging per e-mail. Tot die tijd blijven de teamgegevens privé.')
      } else if (gebruiker) {
        const r = await pb.send<{ id: string }>('/api/hockey/catalogus/omgeving', { method: 'POST', body: { officieelTeam: officieel.id, omgevingNaam } })
        await teamsLaden(); kiesTeam(r.id)
        setMelding('Je eigen groep is aangemaakt. Je bent beheerder en kunt nu bij Leden anderen uitnodigen.')
      } else {
        await pb.send('/api/hockey/aanmelding', { method: 'POST', body: { officieelTeam: officieel.id, omgevingNaam, naam, email, terug: appAdres() } })
        setMelding(`Je krijgt een uitnodiging op ${email.trim()}. Open die om een wachtwoord te kiezen. Daarna ben je beheerder van je eigen groep.`)
      }
    } catch (e) { setFout(foutTekst(e)) }
    finally { setBezig(false) }
  }
  if (melding) return <p className="account-melding">{melding}</p>
  return <form className="account-form" onSubmit={e => { e.preventDefault(); versturen() }}>
    <fieldset className="teamselectie-keuzes">
      <legend>Wat wil je doen?</legend>
      <label className="teamselectie-keuze"><input type="radio" name="groepskeuze" checked={keuze === 'bestaand'} onChange={() => setKeuze('bestaand')} /><span>Bestaande groep zoeken</span></label>
      <label className="teamselectie-keuze"><input type="radio" name="groepskeuze" checked={keuze === 'nieuw'} onChange={() => setKeuze('nieuw')} /><span>Nieuwe eigen groep maken</span></label>
    </fieldset>
    <p className="account-uitleg">{keuze === 'bestaand' ? 'Zoek je club en team en kies de groep waarbij je wilt aansluiten. Je kunt zelf toegang aanvragen; na goedkeuring krijg je een uitnodiging per e-mail.' : 'Kies je club en officiële team om een eigen groep te maken. Elke groep heeft eigen spelers, leden en instellingen.'}</p>
    <TeamKiezer gekozen={officieel} kies={setOfficieel} />
    {officieel && <>
      {keuze === 'bestaand' && (laden ? <p className="account-uitleg">Groepen ophalen…</p> : !!omgevingen.length ? <fieldset className="teamselectie-keuzes">
        <legend>Kies de bestaande groep</legend>
        {omgevingen.map(o => <label key={o.id} className="teamselectie-keuze">
          <input type="radio" name="bestaande-groep" value={o.id} checked={omgeving === o.id} onChange={() => setOmgeving(o.id)} />
          <span>{o.naam}{omgevingen.filter(andere => andere.naam === o.naam).length > 1 ? ` · groep ${o.id.slice(-5)}` : ''}</span>
        </label>)}
      </fieldset> : !fout && <div>
        <p className="account-uitleg">Er zijn geen vindbare groepen bij dit team. Vraag de beheerder om een aanmeldlink als de groep afgeschermd is, of maak zelf een groep.</p>
        <button className="btn btn-secondary" type="button" onClick={() => setKeuze('nieuw')}>Eigen groep maken</button>
      </div>)}
      {keuze === 'nieuw' && <label className="account-label">Groepsnaam (openbaar, optioneel)
        <input className="modal-input" placeholder="Bijvoorbeeld begeleiding" maxLength={40} value={omgevingNaam} onChange={e => setOmgevingNaam(e.target.value)} />
      </label>}
      {!gebruiker && (keuze === 'nieuw' || !!omgevingen.length) && <>
        <label className="account-label">Je naam<input className="modal-input" autoComplete="name" required maxLength={60} value={naam} onChange={e => setNaam(e.target.value)} /></label>
        <label className="account-label">E-mail<input className="modal-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      </>}
      {keuze === 'nieuw' && <p className="account-uitleg">Een nieuwe groep beheren geeft geen toegang tot andere groepen van dit team.</p>}
      {(keuze === 'nieuw' || !!omgevingen.length) && <button className="btn btn-primary" type="submit" disabled={bezig || laden || (keuze === 'bestaand' && !omgeving) || (!gebruiker && (!naam.trim() || !email.includes('@')))}>{keuze === 'nieuw' ? 'Eigen groep maken' : 'Toegang aanvragen bij deze groep'}</button>}
    </>}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
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
