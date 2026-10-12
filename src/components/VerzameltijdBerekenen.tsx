import { useEffect, useState } from 'react'
import { useAccount } from '../context/AccountContext'
import { pb, foutTekst } from '../server'
import { berekenVerzamelen, navigatieLink } from '../verzamelen'
import type { ProgrammaItem } from '../types'
import type { ReisInfo } from './VerzamelenInstellen'

export default function VerzameltijdBerekenen({ item, zet }: { item: ProgrammaItem; zet: (velden: Partial<ProgrammaItem>) => void }) {
  const { actiefTeam } = useAccount()
  const [info, setInfo] = useState<ReisInfo | null>(null)
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const [schatting, setSchatting] = useState<{ minuten: number; bestemming: string; vertrek: string; team: string } | null>(null)
  useEffect(() => {
    setInfo(null); setFout('')
    if (!actiefTeam) return
    let actief = true
    pb.send(`/api/hockey/verzamelinstellingen/team/${actiefTeam.id}`, { method: 'GET' }).then((data: ReisInfo) => {
      if (actief) setInfo(data)
    }).catch(e => { if (actief) setFout(foutTekst(e)) })
    return () => { actief = false }
  }, [actiefTeam?.id])
  const vertrek = info?.effectief.vertrekAdres || ''
  const zaal = item.bronPlanning?.spelvorm === 'Zaal' || info?.spelvorm === 'Zaal'
  const bestemming = item.locatieAdres || (item.thuis && !zaal ? info?.clubAdres : '') || ''
  const reis = schatting?.bestemming === bestemming && schatting?.vertrek === vertrek && schatting?.team === actiefTeam?.id ? schatting.minuten : null
  const voorstel = info && reis != null ? berekenVerzamelen(item.datum, item.spelen, reis, info.effectief) : null
  useEffect(() => {
    setSchatting(null); setFout(''); setBezig(false)
    if (!actiefTeam || !info || !vertrek || !bestemming) return
    let actief = true
    setBezig(true)
    pb.send(`/api/hockey/reiscache/team/${actiefTeam.id}`, { method: 'POST', body: { vertrekAdres: vertrek, locatieAdres: bestemming } }).then(data => {
      if (actief && typeof data.minuten === 'number') setSchatting({ minuten: data.minuten, bestemming, vertrek, team: actiefTeam.id })
    }).catch(e => { if (actief) setFout(foutTekst(e)) }).finally(() => { if (actief) setBezig(false) })
    return () => { actief = false }
  }, [actiefTeam?.id, info, vertrek, bestemming])
  if (!actiefTeam) return null
  return <div>
    <h3>Verzameltijd berekenen</h3>
    <label className="prog-veld">Wedstrijdadres<input className="modal-input" maxLength={300} value={item.locatieAdres || ''} placeholder={item.thuis && !zaal ? info?.clubAdres : 'Straat, huisnummer, postcode en plaats'} onChange={e => zet({ locatieAdres: e.target.value })} /></label>
    {bestemming.trim() ? <a className="btn btn-secondary" href={navigatieLink(bestemming)} target="_blank" rel="noreferrer">Navigeer naar wedstrijd</a> : <button type="button" className="btn btn-secondary" disabled title="Wedstrijdadres nog niet bekend">Navigeer naar wedstrijd</button>}
    <p role="status">{bezig ? 'Reistijd ophalen…' : reis != null ? `Reistijd: ${reis} minuten` : 'Reistijd nog niet beschikbaar'}</p>
    {voorstel && <button className="btn btn-primary" onClick={() => zet({ verzamelen: voorstel.tijd, verzamelDatum: voorstel.datum, reisMinuten: null, ...(item.locatieAdres ? {} : { locatieAdres: bestemming }) })}>Gebruik voorstel: {voorstel.datum !== item.datum ? `${voorstel.datum} · ` : ''}{voorstel.tijd}</button>}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
  </div>
}
