import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTerug } from '../terug'
import './DatumTijdKiezer.css'

const isoDatum = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const datumTekst = (waarde: string) => new Date(`${waarde}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

export default function DatumTijdKiezer({ soort, waarde, onChange, optioneel = false, titel }: {
  soort: 'date' | 'time'; waarde: string; onChange: (waarde: string) => void; optioneel?: boolean; titel?: string
}) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="modal-input datumtijd-veld" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      {waarde ? soort === 'date' ? datumTekst(waarde) : waarde : soort === 'date' ? 'Kies een datum' : 'Kies een tijd'}
    </button>
    {open && <Kiezer soort={soort} waarde={waarde} optioneel={optioneel} onChange={onChange} dicht={() => setOpen(false)} titel={titel} />}
  </>
}

function Kiezer({ soort, waarde, optioneel, onChange, dicht, titel: eigenTitel }: {
  soort: 'date' | 'time'; waarde: string; optioneel: boolean; onChange: (waarde: string) => void; dicht: () => void; titel?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [datum, setDatum] = useState(() => soort === 'date' && waarde ? waarde : isoDatum(new Date()))
  const [maand, setMaand] = useState(() => new Date(`${datum.slice(0, 7)}-01T12:00:00`))
  const [uur, setUur] = useState(soort === 'time' ? waarde.split(':')[0] ?? '' : '')
  const [minuut, setMinuut] = useState(soort === 'time' ? waarde.split(':')[1] ?? '' : '')
  useTerug(true, dicht)
  useEffect(() => {
    const el = dialog.current!
    el.showModal()
    return () => el.close()
  }, [])
  const tijdGeldig = /^\d{1,2}$/.test(uur) && +uur < 24 && /^\d{1,2}$/.test(minuut) && +minuut < 60
  const bewaren = () => {
    if (soort === 'time' && !tijdGeldig) return
    onChange(soort === 'date' ? datum : `${uur.padStart(2, '0')}:${minuut.padStart(2, '0')}`)
    dicht()
  }
  const dagen = new Date(maand.getFullYear(), maand.getMonth() + 1, 0).getDate()
  const leeg = (maand.getDay() + 6) % 7
  const titel = eigenTitel || (soort === 'date' ? 'Datum kiezen' : 'Aanvang kiezen')
  return createPortal(<dialog ref={dialog} className="datumtijd-dialog" aria-label={titel}
    onCancel={e => { e.preventDefault(); dicht() }} onClick={e => e.stopPropagation()}>
    <div className="datumtijd-inhoud">
      <h2 className="modal-title">{titel}</h2>
      <div className="datumtijd-keuzegebied">
      {soort === 'date' ? <>
        <div className="datumtijd-maand">
          <button type="button" className="btn btn-secondary" aria-label="Vorige maand" onClick={() => setMaand(new Date(maand.getFullYear(), maand.getMonth() - 1, 1, 12))}>‹</button>
          <span aria-live="polite">{maand.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</span>
          <button type="button" className="btn btn-secondary" aria-label="Volgende maand" onClick={() => setMaand(new Date(maand.getFullYear(), maand.getMonth() + 1, 1, 12))}>›</button>
        </div>
        <div className="datumtijd-dagen">
          {['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map(d => <span key={d} aria-hidden="true">{d}</span>)}
          {Array.from({ length: leeg }, (_, i) => <span key={`leeg${i}`} />)}
          {Array.from({ length: dagen }, (_, i) => {
            const dag = new Date(maand.getFullYear(), maand.getMonth(), i + 1, 12)
            const iso = isoDatum(dag)
            return <button type="button" key={iso} className={`datumtijd-dag ${iso === datum ? 'gekozen' : ''}`}
              aria-label={datumTekst(iso)} aria-pressed={iso === datum} onClick={() => setDatum(iso)}>{i + 1}</button>
          })}
        </div>
        <p className="datumtijd-keuze" aria-live="polite">{datumTekst(datum)}</p>
      </> : <div className="datumtijd-tijd">
        <label>Uur<input className="modal-input" type="text" inputMode="numeric" placeholder="09" maxLength={2} value={uur} onChange={e => setUur(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
        <span>:</span>
        <label>Minuut<input className="modal-input" type="text" inputMode="numeric" placeholder="00" maxLength={2} value={minuut} onChange={e => setMinuut(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
      </div>}
      {optioneel && waarde && <button type="button" className="btn btn-secondary" onClick={() => { onChange(''); dicht() }}>{soort === 'date' ? 'Datum wissen' : 'Tijd wissen'}</button>}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={dicht}>Terug</button>
        <button type="button" className="btn btn-primary" disabled={soort === 'time' && !tijdGeldig} onClick={bewaren}>Kiezen</button>
      </div>
    </div>
  </dialog>, document.body)
}
