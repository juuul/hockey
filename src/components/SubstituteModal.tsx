import { useState } from 'react'
import { Player, Position, POSITIE_LABEL, VELD_VOLGORDE } from '../types'
import './Modal.css'
import { useTerug } from '../terug'

interface Props {
  playerName: string
  position: Position
  substitutes: Player[]
  fieldPlayers: Player[]
  onSubstitute: (playerId: string) => void
  onMove: (playerId: string) => void
  onClose: () => void
  alleenVerplaatsen?: boolean
  leegPlek?: boolean
}

export default function SubstituteModal({ playerName, position, substitutes, fieldPlayers, onSubstitute, onMove, onClose, alleenVerplaatsen = false, leegPlek = false }: Props) {
  useTerug(true, onClose)
  const sortedSubs = substitutes
  const sortedField = [...fieldPlayers].sort(
    (a, b) => VELD_VOLGORDE.indexOf(a.positie) - VELD_VOLGORDE.indexOf(b.positie)
  )
  const [mode, setMode] = useState<'wissel' | 'verplaats'>(alleenVerplaatsen && !leegPlek ? 'verplaats' : 'wissel')
  const [selectedId, setSelectedId] = useState<string | null>(
    (leegPlek || !alleenVerplaatsen) && sortedSubs.length === 1 ? sortedSubs[0].id : null
  )

  const switchMode = (next: 'wissel' | 'verplaats') => {
    setMode(next)
    setSelectedId(next === 'wissel' && sortedSubs.length === 1 ? sortedSubs[0].id : null)
  }

  const confirm = () => {
    if (!selectedId) return
    if (leegPlek || mode === 'wissel') onSubstitute(selectedId)
    else onMove(selectedId)
  }

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {leegPlek ? (
          <>
            <div className="modal-title">Wie komt op {POSITIE_LABEL[position]}?</div>
            {sortedSubs.length === 0 && position !== 'K' ? (
              <div className="modal-empty">Geen wisselspelers beschikbaar</div>
            ) : (
              <div className="modal-options">
                {sortedSubs.map(p => (
                  <button
                    key={p.id}
                    className={`modal-option ${selectedId === p.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="modal-option-name">{p.naam}</span>
                    <span className="modal-option-count">{p.wisselCount}×</span>
                  </button>
                ))}
                {position === 'K' && sortedField.map(p => (
                  <button
                    key={p.id}
                    className={`modal-option ${selectedId === p.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="modal-option-name">{p.naam}</span>
                    <span className="modal-option-place">{POSITIE_LABEL[p.positie]}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : mode === 'wissel' ? (
          <>
            <div className="modal-title">Wissel {playerName}</div>
            <div className="modal-subtitle">Wie komt erin?</div>

            {sortedSubs.length === 0 ? (
              <div className="modal-empty">Geen wisselspelers beschikbaar</div>
            ) : (
              <div className="modal-options">
                {sortedSubs.map(sub => (
                  <button
                    key={sub.id}
                    className={`modal-option ${selectedId === sub.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(sub.id)}
                  >
                    <span className="modal-option-name">{sub.naam}</span>
                    <span className="modal-option-count">{sub.wisselCount}×</span>
                  </button>
                ))}
              </div>
            )}

            <button className="btn btn-secondary modal-mode-btn" onClick={() => switchMode('verplaats')}>
              ⇄ Verplaatsen
            </button>
          </>
        ) : (
          <>
            <div className="modal-title">Verplaats {playerName}</div>
            <div className="modal-subtitle">Staat nu {POSITIE_LABEL[position]}. Ruilen met:</div>

            <div className="modal-options">
              {sortedField.map(p => (
                <button
                  key={p.id}
                  className={`modal-option ${selectedId === p.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className="modal-option-name">{p.naam}</span>
                  <span className="modal-option-place">{POSITIE_LABEL[p.positie]}</span>
                </button>
              ))}
              {sortedSubs.map(p => (
                <button
                  key={p.id}
                  className={`modal-option ${selectedId === p.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className="modal-option-name">{p.naam}</span>
                  <span className="modal-option-place">wissel</span>
                </button>
              ))}
            </div>

            {!alleenVerplaatsen && (
              <button className="btn btn-secondary modal-mode-btn" onClick={() => switchMode('wissel')}>
                ← Terug naar wissel
              </button>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" disabled={!selectedId} onClick={confirm}>
            Bevestig
          </button>
        </div>
      </div>
    </div>
  )
}
