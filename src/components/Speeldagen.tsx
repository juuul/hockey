import { useEffect, useState } from 'react'
import { pb, foutTekst } from '../server'
import { useAccount } from '../context/AccountContext'
import { useTerug } from '../terug'

interface Kalender { id: string; naam: string; seizoen: string; district: string; spelvorm: string; doelgroep: string; bron: string }

export default function Speeldagen({ dicht }: { dicht: () => void }) {
  const { actiefTeam, teamsLaden } = useAccount()
  const [kalenders, setKalenders] = useState<Kalender[]>([])
  const [keuze, setKeuze] = useState<string[]>(actiefTeam?.planningKalenders || [])
  const [district, setDistrict] = useState('')
  const [vorm, setVorm] = useState('Veld')
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)
  useTerug(true, dicht)
  useEffect(() => {
    let actief = true
    ;(async () => {
      const team = await pb.collection('catalogus_teams').getOne(actiefTeam!.officieelTeam!)
      const gekozen = await pb.send(`/api/hockey/catalogus/omgeving/${actiefTeam!.id}/kalenders`, { method: 'GET' })
      const club = await pb.collection('catalogus_clubs').getFirstListItem(pb.filter('bronId = {:id}', { id: team.clubBronId }))
      const lijst = await pb.collection('catalogus_kalenders').getFullList<Kalender>({ filter: pb.filter('seizoen = {:s}', { s: team.seizoen }), sort: 'district,doelgroep,naam' })
      if (actief) { setKalenders(lijst); setKeuze(gekozen.kalenders); setDistrict(club.district || ''); setVorm(team.spelvorm || 'Veld') }
    })().catch(e => { if (actief) setFout(foutTekst(e)) })
    return () => { actief = false }
  }, [actiefTeam?.officieelTeam])
  const opslaan = async () => {
    setBezig(true); setFout('')
    try {
      await pb.send(`/api/hockey/catalogus/omgeving/${actiefTeam!.id}/kalenders`, { method: 'POST', body: { kalenders: keuze } })
      await teamsLaden(); dicht()
    } catch (e) { setFout(foutTekst(e)); setBezig(false) }
  }
  return <div className="modal show" onClick={dicht}><div className="modal-content" role="dialog" aria-modal="true" aria-label="Speeldagen plannen" onClick={e => e.stopPropagation()}>
    <h2>Speeldagen plannen</h2>
    <div className="prog-velden">
    <p className="account-uitleg">Kies de kalender voor jouw klasse en poulegrootte. Je kunt veld en zaal toevoegen. Datums zijn voorlopig; zaal kan op zaterdag óf zondag zijn. Reservedagen zijn geen vaststaande wedstrijden.</p>
    <label className="prog-veld">Regio<select className="modal-input" value={district} onChange={e => setDistrict(e.target.value)}>
      <option value="">Alle regio’s</option>{[...new Set(kalenders.map(k => k.district))].map(d => <option key={d}>{d}</option>)}
    </select></label>
    <label className="prog-veld">Veld of zaal<select className="modal-input" value={vorm} onChange={e => setVorm(e.target.value)}><option>Veld</option><option>Zaal</option></select></label>
    <label className="prog-veld">Kalender toevoegen<select className="modal-input" value="" onChange={e => { if (e.target.value && !keuze.includes(e.target.value)) setKeuze([...keuze, e.target.value]) }} disabled={keuze.length >= 4}>
      <option value="">Kies een kalender</option>{kalenders.filter(k => (!district || k.district === district) && k.spelvorm === vorm && !keuze.includes(k.id)).map(k => <option key={k.id} value={k.id}>{k.doelgroep} · {k.naam}</option>)}
    </select></label>
    {keuze.map(id => { const k = kalenders.find(x => x.id === id); return k && <div key={id}><p>{k.district} · {k.spelvorm} · {k.naam}</p><a href={k.bron} target="_blank" rel="noreferrer">Officiële kalender</a><button className="btn btn-secondary" onClick={() => setKeuze(keuze.filter(x => x !== id))}>Niet meer toevoegen</button></div> })}
    <p className="account-uitleg">Bestaande datums en eigen afspraken blijven behouden. Onjuiste datums kun je afzonderlijk verwijderen bij Wijzigen.</p>
    {fout && <p role="alert" className="account-melding fout">{fout}</p>}
    </div>
    <button className="btn btn-primary" disabled={bezig || !kalenders.length} onClick={opslaan}>{bezig ? 'Bezig…' : 'Datums toevoegen'}</button>
    <button className="btn btn-secondary" onClick={dicht}>Sluiten</button>
  </div></div>
}
