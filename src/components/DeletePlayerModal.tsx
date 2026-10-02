import './Modal.css'
import { useTerug } from '../terug'

interface Props {
  playerName: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeletePlayerModal({ playerName, onConfirm, onCancel }: Props) {
  useTerug(true, onCancel)
  return (
    <div className="modal show">
      <div className="modal-content">
        <div className="modal-title">Speler Verwijderen</div>
        <div className="modal-subtitle">
          Weet je het zeker? <strong>{playerName}</strong> verwijderen?
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Nee, Annuleren
          </button>
          <button
            className="btn btn-primary"
            style={{ background: '#ef4444' }}
            onClick={onConfirm}
          >
            Ja, Verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}
