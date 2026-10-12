import { useState } from 'react'
import type { ProgrammaItem } from '../types'
import { useTerug } from '../terug'
import { useVerzameltijd } from './useVerzameltijd'
import './Modal.css'

export default function ProgrammaTijd({ item, bewaar, bewerkbaar }: { item: ProgrammaItem; bewaar: (p: ProgrammaItem) => void; bewerkbaar: boolean }) {
  const [open, setOpen] = useState(false)
  const tekst = [item.verzamelen ? `verzamelen ${item.verzamelDatum && item.verzamelDatum !== item.datum ? item.verzamelDatum + ' · ' : ''}${item.verzamelen}` : '', item.spelen ? `aanvang ${item.spelen}` : ''].filter(Boolean).join(' · ') || 'Tijden nog niet bekend'
  return <>
    <button type="button" className="prog-tijd-knop" onClick={() => setOpen(true)} disabled={!bewerkbaar}>⏰ {tekst}</button>
    {open && <TijdPopup item={item} bewaar={bewaar} dicht={() => setOpen(false)} />}
  </>
}
function TijdPopup({ item, bewaar, dicht }: { item: ProgrammaItem; bewaar: (p: ProgrammaItem) => void; dicht: () => void }) {
  const [draft, setDraft] = useState(item)
  const [modus, setModus] = useState<'automatisch' | 'handmatig'>(item.verzamelModus === 'wissen' ? 'handmatig' : item.verzamelModus || (item.verzamelen ? 'handmatig' : 'automatisch'))
  const zet = (velden: Partial<ProgrammaItem>) => setDraft(p => ({ ...p, ...velden }))
  const { voorstel, fout, bezig } = useVerzameltijd({ item: draft, zet })
  useTerug(true, dicht)
  const opslaan = () => {
    if (modus === 'handmatig' && !draft.verzamelen) return
    bewaar({ ...draft, verzamelModus: modus, verzamelen: modus === 'automatisch' ? voorstel?.tijd || '' : draft.verzamelen, verzamelDatum: modus === 'automatisch' ? voorstel?.datum || '' : draft.verzamelDatum || draft.datum, reisMinuten: null })
    dicht()
  }
  return <div className="modal show" onClick={dicht}><div className="modal-content" role="dialog" aria-modal="true" aria-label="Wedstrijdtijden" onClick={e => e.stopPropagation()}>
    <h2 className="modal-title">Wedstrijdtijden</h2>
    <div className="prog-velden">
      <label className="prog-veld">Aanvang<input className="modal-input" type="time" value={draft.spelen} onChange={e => zet({ spelen: e.target.value })} /></label>
      <div className="keuze-knoppen tijd-keuze" role="radiogroup" aria-label="Verzameltijd">
        {(['automatisch', 'handmatig'] as const).map(m => <button type="button" key={m} className={`keuze-knop ${modus === m ? 'actief' : ''}`} role="radio" aria-checked={modus === m} onClick={() => setModus(m)}>{m === 'automatisch' ? 'Automatisch' : 'Handmatig'}</button>)}
      </div>
      {modus === 'handmatig' && <>
        <label className="prog-veld">Verzameldatum<input type="date" className="modal-input" value={draft.verzamelDatum || draft.datum} onChange={e => zet({ verzamelDatum: e.target.value })} /></label>
        <label className="prog-veld">Verzameltijd<input type="time" className="modal-input" value={draft.verzamelen} onChange={e => zet({ verzamelen: e.target.value })} /></label>
      </>}
      {modus === 'automatisch' && <p role="status">{bezig ? 'Berekenen…' : voorstel ? `Verzamelen: ${voorstel.datum !== draft.datum ? voorstel.datum + ' · ' : ''}${voorstel.tijd}` : 'Verzameltijd nog niet beschikbaar'}</p>}
      {fout && <p role="alert" className="account-melding fout">{fout}</p>}
    </div>
    <div className="modal-actions"><button className="btn btn-secondary" onClick={dicht}>Annuleren</button><button className="btn btn-primary" onClick={opslaan} disabled={modus === 'handmatig' && !draft.verzamelen}>Opslaan</button></div>
  </div></div>
}
