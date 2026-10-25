import { tijdWaarde } from '../tijdinvoer'
import './TijdInvoer.css'

export default function TijdInvoer({ label, waarde, onChange }: { label: string; waarde: string; onChange: (tijd: string) => void }) {
  const [uur = '', minuut = ''] = waarde.split(':')
  const zet = (u: string, m: string) => onChange(u || m ? `${u}:${m}` : '')
  const afronden = () => { const tijd = tijdWaarde(waarde); if (tijd !== null && tijd !== waarde) onChange(tijd) }
  return <div className="tijd-invoer" role="group" aria-label={label}>
    <label>Uur<input className="modal-input" aria-label={`${label} uur`} type="text" inputMode="numeric" maxLength={2} placeholder="09" value={uur} onChange={e => zet(e.target.value.replace(/\D/g, ''), minuut)} onBlur={afronden} /></label>
    <span aria-hidden="true">:</span>
    <label>Minuut<input className="modal-input" aria-label={`${label} minuut`} type="text" inputMode="numeric" maxLength={2} placeholder="00" value={minuut} onChange={e => zet(uur, e.target.value.replace(/\D/g, ''))} onBlur={afronden} /></label>
    <button type="button" className="btn btn-secondary" aria-label={`${label} wissen`} onClick={() => onChange('')} disabled={!waarde}>×</button>
  </div>
}
