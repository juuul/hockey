import './Modal.css'

export interface Scorer { id: string | null; naam: string; aantal: number }

// Per scorer (of Onbekend) samengevat, in volgorde van het eerste doelpunt
export function scorersVan(doelpunten: { spelerId: string | null; naam: string }[]): Scorer[] {
  const per = new Map<string | null, Scorer>()
  for (const d of doelpunten) {
    const s = per.get(d.spelerId)
    if (s) s.aantal++
    else per.set(d.spelerId, { id: d.spelerId, naam: d.spelerId === null ? 'Onbekend' : d.naam, aantal: 1 })
  }
  return [...per.values()]
}

// "Welk doelpunt weghalen?" — op het Dashboard (−) en bij Wedstrijd wijzigen
export default function KiesDoelpuntWeg({ scorers, onKies, onClose }: { scorers: Scorer[]; onKies: (id: string | null) => void; onClose: () => void }) {
  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Welk doelpunt weghalen?</div>
        <div className="modal-options">
          {scorers.map(sc => (
            <button key={sc.id ?? 'onbekend'} className="modal-option" onClick={() => onKies(sc.id)}>
              <span className="modal-option-name">{sc.naam}</span>
              <span className="modal-option-place">⚽ {sc.aantal}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuleren</button>
        </div>
      </div>
    </div>
  )
}
