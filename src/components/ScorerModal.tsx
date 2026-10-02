import { Player, POSITIE_LABEL, VELD_VOLGORDE } from '../types'
import './Modal.css'
import { useTerug } from '../terug'

interface Props {
  spelers: Player[]
  doelpunten: (string | null)[]
  onKies: (scorerId: string | null) => void
  onClose: () => void
}

// Van spits naar achter: veld op positievolgorde, dan keeper, dan wissels
export default function ScorerModal({ spelers, doelpunten, onKies, onClose }: Props) {
  useTerug(true, onClose)
  const veld = spelers
    .filter(s => s.inVeld && !s.isKeeper)
    .sort((a, b) => VELD_VOLGORDE.indexOf(a.positie) - VELD_VOLGORDE.indexOf(b.positie))
  const keeper = spelers.filter(s => s.inVeld && s.isKeeper)
  const bank = spelers.filter(s => !s.inVeld && s.meedoen)
  const aantal = (id: string) => doelpunten.filter(d => d === id).length

  const optie = (s: Player, plek: string) => (
    <button key={s.id} className="modal-option" onClick={() => onKies(s.id)}>
      <span className="modal-option-name">{s.naam}</span>
      <span className="modal-option-place">{aantal(s.id) > 0 ? `⚽ ${aantal(s.id)} · ` : ''}{plek}</span>
    </button>
  )

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Wie scoorde?</div>
        <div className="modal-options">
          {veld.map(s => optie(s, POSITIE_LABEL[s.positie]))}
          {keeper.map(s => optie(s, 'keeper'))}
          {bank.map(s => optie(s, 'wissel'))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" onClick={() => onKies(null)}>Weet ik niet</button>
        </div>
      </div>
    </div>
  )
}
