import { useEffect, useState } from 'react'
import { pb, foutTekst, type Team } from '../server'
import type { VerzamelInstellingen } from '../verzamelen'
import { useAccount } from '../context/AccountContext'

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
  const [google, setGoogle] = useState(false)
  const route = team ? `/api/hockey/verzamelinstellingen/team/${team.id}` : '/api/hockey/verzamelinstellingen'
  useEffect(() => {
    let actief = true; setGeladen(false); setFout('')
    pb.send(route, { method: 'GET' }).then((data: ReisInfo & VerzamelInstellingen) => {
      if (!actief) return
      setWaarden(team ? data.effectief : data); setGlobaal(team ? data.globaal : data); setEigen(team ? data.eigen.voorbereidingMinuten != null || data.eigen.bufferMinuten != null : true)
      setVertrekAdres(team ? data.eigen.vertrekAdres || '' : ''); setClubAdres(data.clubAdres || ''); setGoogle(data.googleBeschikbaar); setGeladen(true)
    }).catch(e => { if (actief) setFout(foutTekst(e)) })
    return () => { actief = false }
  }, [route])
  useEffect(() => {
    if (!team) return
    const ververs = () => pb.send(route, { method: 'GET' }).then((data: ReisInfo) => { setGlobaal(data.globaal); if (!eigen) setWaarden(data.effectief) }).catch(e => setFout(foutTekst(e)))
    window.addEventListener('hockey-verzamel-defaults', ververs)
    return () => window.removeEventListener('hockey-verzamel-defaults', ververs)
  }, [route, eigen, !!team])
  const geldig = [waarden.voorbereidingMinuten, waarden.bufferMinuten].every(v => Number.isInteger(v) && v >= 0 && v <= 360)
  const opslaan = async () => {
    setBezig(true); setFout('')
    try {
      await pb.send(route, { method: 'POST', body: team ? { voorbereidingMinuten: eigen ? waarden.voorbereidingMinuten : null, bufferMinuten: eigen ? waarden.bufferMinuten : null, vertrekAdres } : { voorbereidingMinuten: waarden.voorbereidingMinuten, bufferMinuten: waarden.bufferMinuten } })
      if (team) await teamsLaden()
      else window.dispatchEvent(new Event('hockey-verzamel-defaults'))
    } catch (e) { setFout(foutTekst(e)) }
    setBezig(false)
  }
  return <section className="instellingen-kaart">
    <h2 className="instellingen-kaart-titel">{team ? 'Verzameltijden voor dit team' : 'Verzameltijden · globale standaard'}</h2>
    <p className="account-uitleg">Verzameltijd = aanvang − voorbereiding − reistijd − buffer.</p>
    {team && <label className="account-label"><input type="checkbox" checked={eigen} disabled={!geladen} onChange={e => { setEigen(e.target.checked); if (!e.target.checked) setWaarden(globaal) }} />Eigen standaard voor dit team</label>}
    {team && <p className="account-uitleg">Uit = algemene tijden. Een waarde aanpassen zet eigen tijden aan.</p>}
    <label className="account-label">Voorbereiding (minuten)<input className="account-input" type="number" inputMode="numeric" min="0" max="360" step="1" disabled={!geladen} value={Number.isNaN(waarden.voorbereidingMinuten) ? '' : waarden.voorbereidingMinuten} onChange={e => { if (team) setEigen(true); setWaarden({ ...waarden, voorbereidingMinuten: e.target.value === '' ? NaN : Number(e.target.value) }) }} /></label>
    <label className="account-label">Extra buffer (minuten)<input className="account-input" type="number" inputMode="numeric" min="0" max="360" step="1" disabled={!geladen} value={Number.isNaN(waarden.bufferMinuten) ? '' : waarden.bufferMinuten} onChange={e => { if (team) setEigen(true); setWaarden({ ...waarden, bufferMinuten: e.target.value === '' ? NaN : Number(e.target.value) }) }} /></label>
    {team && <label className="account-label">Vertrekadres<input className="account-input" maxLength={300} value={vertrekAdres} placeholder={clubAdres || 'Adres waar het team verzamelt'} onChange={e => setVertrekAdres(e.target.value)} /><span className="account-uitleg">Leeg laten gebruikt het clubadres, zodra dat bekend is. Deze keuze blijft privé binnen het team.</span></label>}
    <p className="account-uitleg">Reistijden tussen bekende clubs en accommodaties worden opgeslagen en naar boven afgerond op 5 minuten. Handmatig invullen blijft mogelijk.{google ? ' Google Maps is daarnaast beschikbaar voor een andere vertrekplaats.' : ''}</p>
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
    <button className="btn btn-primary" disabled={!geladen || bezig || (eigen && !geldig)} onClick={opslaan}>{bezig ? 'Bezig…' : 'Opslaan'}</button>
  </section>
}
