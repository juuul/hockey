import googleLogo from '../assets/google-maps-attribution.svg'
import { useEffect, useState } from 'react'
import { useAccount } from '../context/AccountContext'
import { pb, foutTekst } from '../server'
import { berekenVerzamelen, navigatieLink } from '../verzamelen'
import type { ProgrammaItem } from '../types'
import type { ReisInfo } from './VerzamelenInstellen'

export default function VerzameltijdBerekenen({ item, zet }: { item: ProgrammaItem; zet: (velden: Partial<ProgrammaItem>) => void }) {
  const { actiefTeam } = useAccount()
  const [info, setInfo] = useState<ReisInfo | null>(null)
  const [vertrek, setVertrek] = useState('')
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const [google, setGoogle] = useState<{ minuten: number; bestemming: string; vertrek: string } | null>(null)
  useEffect(() => {
    if (!actiefTeam) return
    let actief = true
    pb.send(`/api/hockey/verzamelinstellingen/team/${actiefTeam.id}`, { method: 'GET' }).then((data: ReisInfo) => {
      if (actief) { setInfo(data); setVertrek(data.effectief.vertrekAdres) }
    }).catch(e => { if (actief) setFout(foutTekst(e)) })
    return () => { actief = false }
  }, [actiefTeam?.id])
  if (!actiefTeam) return null
  const bestemming = item.locatieAdres || (item.thuis ? info?.clubAdres : '') || ''
  const geldigGoogle = google?.bestemming === bestemming && google?.vertrek === vertrek
  const reis = geldigGoogle ? google!.minuten : item.reisMinuten
  const voorstel = info && reis != null ? berekenVerzamelen(item.datum, item.spelen, reis, info.effectief) : null
  const ophalen = async () => {
    setBezig(true); setFout(''); setGoogle(null)
    try {
      const data = await pb.send(`/api/hockey/reistijd/team/${actiefTeam.id}`, { method: 'POST', body: { vertrekAdres: vertrek, locatieAdres: bestemming } })
      setGoogle({ minuten: data.minuten, bestemming, vertrek })
    } catch (e) { setFout(foutTekst(e)) }
    setBezig(false)
  }
  return <div>
    <h3>Verzameltijd berekenen</h3>
    <label className="prog-veld">Vertrekadres<input className="modal-input" maxLength={300} value={vertrek} onChange={e => { setVertrek(e.target.value); setGoogle(null) }} /></label>
    <label className="prog-veld">Wedstrijdadres<input className="modal-input" maxLength={300} value={item.locatieAdres || ''} placeholder={item.thuis ? info?.clubAdres : 'Straat, huisnummer, postcode en plaats'} onChange={e => { zet({ locatieAdres: e.target.value }); setGoogle(null) }} /></label>
    {bestemming && <a className="btn btn-secondary" href={navigatieLink(bestemming)} target="_blank" rel="noreferrer">Navigeer naar wedstrijd</a>}
    <label className="prog-veld">Reistijd (minuten)<input className="modal-input" type="number" min="0" max="1440" step="1" value={reis != null && Number.isFinite(reis) ? reis : ''} onChange={e => { setGoogle(null); zet({ reisMinuten: e.target.value === '' ? null : Number(e.target.value) }) }} /></label>
    <button className="btn btn-secondary" disabled={bezig || !info?.googleBeschikbaar || !vertrek.trim() || !bestemming.trim()} onClick={ophalen}>{bezig ? 'Reistijd ophalen…' : 'Reistijd ophalen'}</button>
    {geldigGoogle && <p className="account-uitleg">Schatting zonder actuele files<br /><img src={googleLogo} alt="Google Maps" style={{ height: 19, width: 'auto', margin: '10px 10px 5px' }} /></p>}
    {info && <p className="account-uitleg">{info.effectief.voorbereidingMinuten} min voorbereiding + reistijd + {info.effectief.bufferMinuten} min buffer. De teamstandaard staat in Instellingen.</p>}
    {!info?.googleBeschikbaar && info && <p className="account-uitleg">Google Maps is nog niet aangesloten; vul de reistijd zelf in. Bij dezelfde vertrek- en wedstrijdlocatie kun je 0 invullen.</p>}
    {voorstel && <button className="btn btn-primary" onClick={() => zet({ verzamelen: voorstel.tijd, verzamelDatum: voorstel.datum, ...(item.locatieAdres ? {} : { locatieAdres: bestemming }) })}>Gebruik voorstel: {voorstel.datum !== item.datum ? `${voorstel.datum} · ` : ''}{voorstel.tijd}</button>}
    {reis != null && (!Number.isInteger(reis) || reis < 0 || reis > 1440) && <p className="account-melding fout" role="alert">Vul hele minuten tussen 0 en 1440 in.</p>}
    {!voorstel && <p className="account-uitleg">Vul aanvangstijd en reistijd in om een voorstel te berekenen.</p>}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
  </div>
}
