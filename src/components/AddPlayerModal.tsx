import { useState } from 'react'
import { naamBezet } from '../opstelling'
import './Modal.css'

interface Props {
  bestaandeNamen: string[]
  onAdd: (naam: string) => void
  onClose: () => void
}

// Alleen een voornaam. Twee dezelfde voornamen? Dan maakt de beheerder de naam zelf uniek (bv. 'Sarah E.')
export default function AddPlayerModal({ bestaandeNamen, onAdd, onClose }: Props) {
  const [naam, setNaam] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  const handleAdd = () => {
    const schoon = naam.trim().replace(/\s+/g, ' ')
    if (!schoon) return setFout('Vul een voornaam in.')
    if (naamBezet(bestaandeNamen, schoon)) {
      return setFout(`Er is al een speler "${schoon}". Maak de naam uniek, bijvoorbeeld met de eerste letter van de achternaam: "${schoon} E."`)
    }
    onAdd(schoon)
    setNaam('')
  }

  return (
    <div className="modal show">
      <div className="modal-content">
        <div className="modal-title">Speler toevoegen</div>
        <input
          type="text"
          placeholder="Voornaam"
          value={naam}
          onChange={(e) => { setNaam(e.target.value); setFout(null) }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="modal-input"
          maxLength={40}
          autoFocus
        />
        {fout && <p className="modal-subtitle modal-fout" role="alert">{fout}</p>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" onClick={handleAdd}>Toevoegen</button>
        </div>
      </div>
    </div>
  )
}
