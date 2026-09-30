import './ResetModal.css'

interface ResetModalProps {
  titel: string
  regels: { icoon: string; tekst: string }[]
  bevestig: string
  annuleer?: string
  gevaar?: boolean // rode bevestigknop (iets weghalen)
  onConfirm: () => void
  onCancel: () => void
}

export default function ResetModal({ titel, regels, bevestig, annuleer = 'Annuleren', gevaar = false, onConfirm, onCancel }: ResetModalProps) {
  return (
    <div className="reset-modal-overlay">
      <div className="reset-modal">
        <h2>{titel}</h2>

        <div className="reset-info">
          {regels.map(r => (
            <div key={r.tekst} className="info-item">
              <span className="info-icon">{r.icoon}</span>
              <span className="info-text">{r.tekst}</span>
            </div>
          ))}
        </div>

        <div className="reset-buttons">
          <button className="btn btn-cancel" onClick={onCancel}>
            {annuleer}
          </button>
          <button className={`btn btn-confirm ${gevaar ? 'gevaar' : ''}`} onClick={onConfirm}>
            {bevestig}
          </button>
        </div>
      </div>
    </div>
  )
}
