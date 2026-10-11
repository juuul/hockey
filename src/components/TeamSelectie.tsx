import { useEffect, useState } from 'react'
import { useAccount } from '../context/AccountContext'
import { appAdres, foutTekst, pb } from '../server'

export interface OfficieelTeam {
  id: string; bronId: string; clubBronId: string; naam: string; seizoen: string
  geslacht: string; leeftijd: string; categorie: string; spelvorm: string; klasse: string; gecontroleerd: string
}
interface CatalogusClub { id: string; bronId: string; naam: string; plaats: string }
interface Omgeving { id: string; naam: string; omgevingNaam: string }

// Een club kiezen laadt alleen de teams van die club. Gegevens komen uit de eigen catalogus.
export function TeamKiezer({ gekozen, kies }: { gekozen: OfficieelTeam | null; kies: (t: OfficieelTeam | null) => void }) {
  const [clubs, setClubs] = useState<CatalogusClub[]>([])
  const [zoek, setZoek] = useState('')
  const [clubId, setClubId] = useState('')
  const [teams, setTeams] = useState<OfficieelTeam[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const [ververs, setVervers] = useState(0)
  useEffect(() => {
    pb.collection('catalogus_clubs').getFullList<CatalogusClub>({ sort: 'naam' }).then(setClubs).catch(e => setFout(foutTekst(e)))
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
  const velden = [['seizoen', 'Seizoen'], ['geslacht', 'Meisjes, jongens of gemengd'], ['leeftijd', 'Leeftijd'], ['categorie', 'Categorie'], ['spelvorm', 'Veld of zaal'], ['klasse', 'Klasse']] as const
  const lijst = teams.filter(t => velden.every(([veld]) => !filters[veld] || t[veld] === filters[veld]))
  return <>
    <label className="account-label">Zoek je club
      <input className="modal-input" type="search" placeholder="Bijvoorbeeld SCHC" value={zoek} onChange={e => setZoek(e.target.value)} />
    </label>
    <label className="account-label">Club
      <select className="modal-input" value={clubId} onChange={e => { setClubId(e.target.value); setFilters({}); kies(null) }}>
        <option value="">Kies je club…</option>
        {clubs.filter(c => c.id === clubId || `${c.naam} ${c.plaats}`.toLowerCase().includes(zoek.toLowerCase())).map(c => <option key={c.id} value={c.id}>{c.naam} · {c.plaats}</option>)}
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
          {lijst.map(t => <option key={t.id} value={t.id}>{t.naam} · {t.seizoen} · {t.spelvorm}{t.klasse ? ` · ${t.klasse}` : ''}</option>)}
        </select>
      </label>}
      {gekozen && <p className="account-uitleg">Bron: KNHB Match Center. Gecontroleerd {new Date(gekozen.gecontroleerd).toLocaleDateString('nl-NL')}. Alleen gepubliceerde wedstrijden worden overgenomen.</p>}
      <button type="button" className="btn btn-secondary" onClick={() => setVervers(v => v + 1)}>Gegevens opnieuw controleren</button>
    </>}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
  </>
}

export default function TeamAanmelden() {
  const { gebruiker, teamsLaden, kiesTeam } = useAccount()
  const [officieel, setOfficieel] = useState<OfficieelTeam | null>(null)
  const [omgevingen, setOmgevingen] = useState<Omgeving[]>([])
  const [omgeving, setOmgeving] = useState('nieuw')
  const [omgevingNaam, setOmgevingNaam] = useState('')
  const [naam, setNaam] = useState(gebruiker?.name || '')
  const [email, setEmail] = useState(gebruiker?.email || '')
  const [bezig, setBezig] = useState(false)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const [melding, setMelding] = useState('')
  useEffect(() => {
    setOmgevingen([]); setOmgeving('nieuw'); setFout('')
    if (!officieel) return
    let actief = true
    setLaden(true)
    pb.send<Omgeving[]>(`/api/hockey/catalogus/team/${officieel.id}/omgevingen`, {}).then(lijst => {
      if (actief) { setOmgevingen(lijst); setOmgeving(lijst.length ? '' : 'nieuw') }
    }).catch(e => { if (actief) setFout(foutTekst(e)) }).finally(() => { if (actief) setLaden(false) })
    return () => { actief = false }
  }, [officieel?.id])
  const versturen = async () => {
    if (!officieel || !omgeving) return
    setBezig(true); setFout('')
    try {
      if (omgeving !== 'nieuw') {
        await pb.send(`/api/hockey/catalogus/omgeving/${omgeving}/aanvraag`, { method: 'POST', body: { naam: gebruiker?.name || naam, email: gebruiker?.email || email, terug: appAdres() } })
        setMelding('Je aanvraag staat klaar voor de beheerder. Na goedkeuring krijg je een uitnodiging per e-mail. Tot die tijd blijven de teamgegevens privé.')
      } else if (gebruiker) {
        const r = await pb.send<{ id: string }>('/api/hockey/catalogus/omgeving', { method: 'POST', body: { officieelTeam: officieel.id, omgevingNaam } })
        await teamsLaden(); kiesTeam(r.id)
        setMelding('Je eigen teamomgeving is aangemaakt. Je bent beheerder en kunt nu bij Leden anderen uitnodigen.')
      } else {
        await pb.send('/api/hockey/aanmelding', { method: 'POST', body: { officieelTeam: officieel.id, omgevingNaam, naam, email, terug: appAdres() } })
        setMelding(`Je krijgt een uitnodiging op ${email.trim()}. Open die om een wachtwoord te kiezen. Daarna ben je beheerder van je eigen teamomgeving.`)
      }
    } catch (e) { setFout(foutTekst(e)) }
    finally { setBezig(false) }
  }
  if (melding) return <p className="account-melding">{melding}</p>
  return <form className="account-form" onSubmit={e => { e.preventDefault(); versturen() }}>
    <p className="account-uitleg">Kies je officiële team. Je kunt toegang vragen tot een bestaande omgeving of een eigen omgeving maken. Elke omgeving heeft eigen spelers, leden en instellingen.</p>
    <TeamKiezer gekozen={officieel} kies={setOfficieel} />
    {officieel && <>
      {laden ? <p className="account-uitleg">Teamomgevingen ophalen…</p> : <label className="account-label">Teamomgeving
        <select className="modal-input" value={omgeving} onChange={e => setOmgeving(e.target.value)}>
          <option value="">Kies een omgeving…</option>
          {omgevingen.map(o => <option key={o.id} value={o.id}>{o.naam} · omgeving {o.id.slice(-5)}</option>)}
          <option value="nieuw">Nieuwe eigen teamomgeving maken</option>
        </select>
      </label>}
      {omgeving === 'nieuw' && <label className="account-label">Groepsnaam (openbaar, optioneel)
        <input className="modal-input" placeholder="Bijvoorbeeld begeleiding" maxLength={40} value={omgevingNaam} onChange={e => setOmgevingNaam(e.target.value)} />
      </label>}
      {!gebruiker && <>
        <label className="account-label">Je naam<input className="modal-input" autoComplete="name" required maxLength={60} value={naam} onChange={e => setNaam(e.target.value)} /></label>
        <label className="account-label">E-mail<input className="modal-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      </>}
      <p className="account-uitleg">Een nieuwe omgeving beheren geeft geen toegang tot andere omgevingen van dit team.</p>
      <button className="btn btn-primary" type="submit" disabled={bezig || laden || !omgeving || (!gebruiker && (!naam.trim() || !email.includes('@')))}>{omgeving === 'nieuw' ? 'Eigen teamomgeving maken' : 'Toegang aanvragen'}</button>
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
