import { useEffect } from 'react'
import { navigatieLink } from '../verzamelen'
import type { ProgrammaItem } from '../types'
import { useVerzameltijd } from './useVerzameltijd'

export default function VerzameltijdBerekenen({ item, zet }: { item: ProgrammaItem; zet: (velden: Partial<ProgrammaItem>) => void }) {
  const { bestemming, reis, voorstel, fout, bezig, actiefTeam } = useVerzameltijd({ item, zet })
  const modus = item.verzamelModus || (item.verzamelen ? 'handmatig' : 'automatisch')
  useEffect(() => {
    if (modus !== 'automatisch') return
    const tijd = voorstel?.tijd || '', datum = voorstel?.datum || ''
    if (item.verzamelen !== tijd || (item.verzamelDatum || '') !== datum) zet({ verzamelen: tijd, verzamelDatum: datum, verzamelModus: 'automatisch' })
  }, [modus, voorstel?.tijd, voorstel?.datum, item.verzamelen, item.verzamelDatum])
  if (!actiefTeam) return null
  return <div>
    <label className="prog-veld">Wedstrijdadres<input className="modal-input" maxLength={300} value={item.locatieAdres || ''} placeholder={bestemming || 'Straat, huisnummer, postcode en plaats'} onChange={e => zet({ locatieAdres: e.target.value })} /></label>
    {bestemming.trim() ? <a className="btn btn-secondary" href={navigatieLink(bestemming)} target="_blank" rel="noreferrer">Navigeer naar wedstrijd</a> : <button type="button" className="btn btn-secondary" disabled title="Wedstrijdadres nog niet bekend">Navigeer naar wedstrijd</button>}
    <p role="status">{bezig ? 'Reistijd ophalen…' : reis != null ? `Reistijd: ${reis} minuten` : 'Reistijd nog niet beschikbaar'}</p>
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
  </div>
}
