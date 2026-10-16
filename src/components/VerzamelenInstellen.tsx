import { useEffect, useState } from 'react'
import { pb, foutTekst, type Team } from '../server'
import type { VerzamelInstellingen } from '../verzamelen'
import { useAccount } from '../context/AccountContext'
import './VerzamelenInstellen.css'

export interface ReisInfo {
  globaal: VerzamelInstellingen; eigen: Partial<VerzamelInstellingen> & { vertrekAdres?: string };
  effectief: VerzamelInstellingen & { vertrekAdres: string }; clubAdres: string; googleBeschikbaar: boolean; databaseBeschikbaar?: boolean; spelvorm?: string;
}
export default function VerzamelenInstellen({ team }: { team?: Team }) {
  const { teamsLaden } = useAccount()
  const [waarden, setWaarden] = useState<VerzamelInstellingen>({ voorbereidingMinuten: 30, bufferMinuten: 5 })
  const [vertrekAdres, setVertrekAdres] = useState('')
  const [clubAdres, setClubAdres] = useState('')
  const [globaal, setGlobaal] = useState<VerzamelInstellingen>({ voorbereidingMinuten: 30, bufferMinuten: 5 })
  const [eigen, setEigen] = useState(false)
  const [geladen, setGeladen] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [laadPoging, setLaadPoging] = useState(0)
  const route = team ? `/api/hockey/verzamelinstellingen/team/${team.id}` : '/api/hockey/verzamelinstellingen'
  useEffect(() => {
    let actief = true; setGeladen(false); setFout('')
    pb.send(route, { method: 'GET' }).then((data: ReisInfo & VerzamelInstellingen) => {
      if (!actief) return
      setWaarden(team ? data.effectief : data); setGlobaal(team ? data.globaal : data); setEigen(team ? data.eigen.voorbereidingMinuten != null || data.eigen.bufferMinuten != null : true)
      setVertrekAdres(team ? data.eigen.vertrekAdres || '' : ''); setClubAdres(data.clubAdres || ''); setGeladen(true)
    }).catch(e => { if (actief) setFout(foutTekst(e)) })
    return () => { actief = false }
  }, [route, laadPoging])
  useEffect(() => {
    if (!team) return
    const ververs = () => pb.send(route, { method: 'GET' }).then((data: ReisInfo) => { setGlobaal(data.globaal); if (!eigen) setWaarden(data.globaal) }).catch(e => setFout(foutTekst(e)))
    window.addEventListener('hockey-verzamel-defaults', ververs)
    return () => window.removeEventListener('hockey-verzamel-defaults', ververs)
  }, [route, eigen, !!team])
  const geldig = [waarden.voorbereidingMinuten, waarden.bufferMinuten].every(v => Number.isInteger(v) && v >= 0 && v <= 360)
  const opslaan = async () => {
    if (!geladen || bezig || !geldig) return
    setBezig(true); setFout('')
    try {
      await pb.send(route, { method: 'POST', body: team ? { voorbereidingMinuten: eigen ? waarden.voorbereidingMinuten : null, bufferMinuten: eigen ? waarden.bufferMinuten : null, vertrekAdres } : { voorbereidingMinuten: waarden.voorbereidingMinuten, bufferMinuten: waarden.bufferMinuten } })
      if (team) await teamsLaden()
      else window.dispatchEvent(new Event('hockey-verzamel-defaults'))
    } catch (e) { setFout(foutTekst(e)) }
    setBezig(false)
  }
  return <section className="instellingen-kaart verzamelen-instellen">
    <h2 className="instellingen-kaart-titel">{team?.naam ?? 'Algemene tijden'}</h2>
    <p className="account-uitleg">Reistijd wordt automatisch meegerekend.</p>
    {!geladen && !fout && <p className="account-uitleg" role="status">Tijden ophalen…</p>}
    {([['voorbereidingMinuten', 'Voorbereiding (minuten)'], ['bufferMinuten', 'Extra buffer (minuten)']] as const).map(([veld, label]) => <label key={veld} className="account-label">{label}
      <input className="modal-input" type="number" inputMode="numeric" min="0" max="360" step="1" disabled={!geladen || bezig} value={!geladen || Number.isNaN(waarden[veld]) ? '' : waarden[veld]} onChange={e => {
        if (team) setEigen(true)
        setWaarden({ ...waarden, [veld]: e.target.value === '' ? NaN : Number(e.target.value) })
      }} />
      {team && geladen && <span className="verzamelen-standaard">Standaard: {globaal[veld]} min</span>}
    </label>)}
    {team && <details className="verzamelen-extra">
      <summary>{vertrekAdres ? 'Eigen vertrekadres' : 'Ander vertrekadres'}</summary>
      <label className="account-label">Vertrekadres<input className="modal-input" maxLength={300} disabled={!geladen || bezig} value={vertrekAdres} placeholder={clubAdres || 'Clubadres gebruiken'} onChange={e => setVertrekAdres(e.target.value)} /></label>
      <p className="account-uitleg">Alleen voor je team. Leeg = clubadres.</p>
    </details>}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
    {!geladen && fout && <button className="btn btn-secondary" onClick={() => setLaadPoging(p => p + 1)}>Opnieuw proberen</button>}
    <button className="btn btn-primary" disabled={!geladen || bezig || !geldig} onClick={opslaan}>{bezig ? 'Bezig…' : 'Opslaan'}</button>
    {team && <button className="btn btn-secondary" disabled={!geladen || bezig || !eigen} onClick={() => { setEigen(false); setWaarden(globaal) }}>Herstel standaardwaarden</button>}
  </section>
}
