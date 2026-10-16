import { useState } from 'react'
import type { ProgrammaItem } from '../types'
import { useTerug } from '../terug'
import { useVerzameltijd } from './useVerzameltijd'
import './Modal.css'
import DatumTijdKiezer from './DatumTijdKiezer'

export default function ProgrammaTijd({ item, bewaar, bewerkbaar }: { item: ProgrammaItem; bewaar: (p: ProgrammaItem) => void; bewerkbaar: boolean }) {
  const [open, setOpen] = useState(false)
  const tekst = [item.verzamelen ? `verzamelen ${item.verzamelDatum && item.verzamelDatum !== item.datum ? item.verzamelDatum + ' · ' : ''}${item.verzamelen}` : '', item.spelen ? `aanvang ${item.spelen}` : ''].filter(Boolean).join(' · ') || 'Tijden nog niet bekend'
  return <>
    <button type="button" className="btn btn-secondary prog-tijd-knop" onClick={() => setOpen(true)} disabled={!bewerkbaar}>⏰ {tekst}</button>
    {open && <TijdPopup item={item} bewaar={bewaar} dicht={() => setOpen(false)} />}
  </>
}
function TijdPopup({ item, bewaar, dicht }: { item: ProgrammaItem; bewaar: (p: ProgrammaItem) => void; dicht: () => void }) {
  const [draft, setDraft] = useState(item)
  const zet = (velden: Partial<ProgrammaItem>) => setDraft(p => ({ ...p, ...velden }))
  const { voorstel, fout, bezig } = useVerzameltijd({ item: draft, zet })
  useTerug(true, dicht)
  const opslaan = () => {
    bewaar({ ...draft, verzamelModus: 'automatisch', verzamelen: voorstel?.tijd || '', verzamelDatum: voorstel?.datum || '', reisMinuten: null })
    dicht()
  }
  return <div className="modal show"><div className="modal-content" role="dialog" aria-modal="true" aria-label="Wedstrijdtijden" onClick={e => e.stopPropagation()}>
    <h2 className="modal-title">Wedstrijdtijden</h2>
    <div className="prog-velden">
      <label className="prog-veld">Aanvang<DatumTijdKiezer soort="time" waarde={draft.spelen} onChange={spelen => zet({ spelen })} optioneel /></label>
      <p role="status">{bezig ? 'Berekenen…' : voorstel ? `Verzamelen: ${voorstel.datum !== draft.datum ? voorstel.datum + ' · ' : ''}${voorstel.tijd}` : 'Verzameltijd nog niet beschikbaar'}</p>
      {fout && <p role="alert" className="account-melding fout">{fout}</p>}
    </div>
    <div className="modal-actions"><button className="btn btn-secondary" onClick={dicht}>Annuleren</button><button className="btn btn-primary" onClick={opslaan}>Opslaan</button></div>
  </div></div>
}
