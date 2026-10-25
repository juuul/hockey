import { navigatieLink } from '../verzamelen'
import type { ProgrammaItem } from '../types'
import type { useVerzameltijd } from './useVerzameltijd'

export default function VerzameltijdBerekenen({ item, zet, berekening }: { item: ProgrammaItem; zet: (velden: Partial<ProgrammaItem>) => void; berekening: ReturnType<typeof useVerzameltijd> }) {
  const { bestemming, reis, fout, bezig, actiefTeam } = berekening
  if (!actiefTeam) return null
  return <div>
    <label className="prog-veld">Wedstrijdadres<input className="modal-input" maxLength={300} value={item.locatieAdres || ''} placeholder={bestemming || 'Straat, huisnummer, postcode en plaats'} onChange={e => zet({ locatieAdres: e.target.value })} /></label>
    {bestemming.trim() ? <a className="btn btn-secondary" href={navigatieLink(bestemming)} target="_blank" rel="noreferrer">Navigeer naar wedstrijd</a> : <button type="button" className="btn btn-secondary" disabled title="Wedstrijdadres nog niet bekend">Navigeer naar wedstrijd</button>}
    <p role="status">{bezig ? 'Reistijd ophalen…' : reis != null ? `Reistijd: ${reis} minuten` : 'Reistijd nog niet beschikbaar'}</p>
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
  </div>
}
