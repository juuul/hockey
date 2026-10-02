import { useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { shootoutTelling } from '../historie'
import { tel } from '../statistiek'
import '../components/Modal.css'
import './Shootout.css'

// Shoot-outs na de wedstrijd (O10 en O9): wie er het minst genomen heeft (alle wedstrijden + deze) staat bovenaan
export default function Shootout() {
  const { spelers, wedstrijden, shootouts, neemShootout, haalShootoutWeg, magBewerken } = useHockey()
  const [gekozen, setGekozen] = useState<{ id: string; naam: string } | null>(null)

  const telling = shootoutTelling(wedstrijden, shootouts)
  const genomen = (id: string) => telling.get(id)?.genomen ?? 0
  const keeper = spelers.find(s => s.isKeeper && s.meedoen)
  const lijst = spelers
    .filter(s => s.meedoen && !s.isKeeper)
    .sort((a, b) => genomen(a.id) - genomen(b.id) || a.naam.localeCompare(b.naam))
  const nu = (id: string) => shootouts.filter(s => s.spelerId === id)
  const raakNu = shootouts.filter(s => s.raak).length
  const laatste = shootouts.length ? spelers.find(s => s.id === shootouts[shootouts.length - 1].spelerId)?.naam ?? 'Onbekend' : ''

  const kies = (raak: boolean) => {
    if (!gekozen) return
    neemShootout(gekozen.id, raak)
    tel(raak ? 'shootout-raak' : 'shootout-mis')
    setGekozen(null)
  }

  return (
    <div className="shootout-scherm">
      <div className="shootout-kop">Shoot-out</div>
      <p className="shootout-uitleg">
        Wie het minst genomen heeft, staat bovenaan.{magBewerken ? ' Tik op wie nu neemt.' : ''}
      </p>
      {shootouts.length > 0 && (
        <div className="shootout-nu">Deze wedstrijd: {shootouts.length} genomen · {raakNu} raak</div>
      )}

      <div className="shootout-lijst">
        {lijst.map(s => {
          const deze = nu(s.id)
          return (
            <button
              key={s.id}
              className={`shootout-speler ${deze.length ? 'genomen' : ''}`}
              onClick={() => setGekozen({ id: s.id, naam: s.naam })}
              disabled={!magBewerken}
            >
              <span className="shootout-info">
                <span className="shootout-naam">{s.naam}</span>
                {deze.length > 0 && <span className="shootout-deze">Nu: {deze.map(d => (d.raak ? '⚽' : '✗')).join(' ')}</span>}
              </span>
              <span className="shootout-aantal" aria-label={`${genomen(s.id)} shoot-outs genomen`}>{genomen(s.id)}×</span>
            </button>
          )
        })}
        {lijst.length === 0 && <p className="shootout-uitleg">Niemand doet mee. Meld spelers aan bij 👥 Spelers.</p>}
      </div>

      {keeper && <p className="shootout-uitleg">{keeper.naam} staat op doel en staat niet in de lijst.</p>}
      <p className="shootout-uitleg">Telt alle afgesloten wedstrijden en deze wedstrijd. Bij Wedstrijd afsluiten worden de shoot-outs bewaard.</p>

      {magBewerken && shootouts.length > 0 && (
        <button className="btn btn-secondary" onClick={() => { haalShootoutWeg(); tel('shootout-weg') }}>
          Laatste weghalen ({laatste})
        </button>
      )}

      {gekozen && (
        <div className="modal show" onClick={() => setGekozen(null)}>
          <div className="modal-content shootout-vraag" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Shoot-out {gekozen.naam}</div>
            <div className="modal-options">
              <button className="modal-option shootout-raak" onClick={() => kies(true)}>
                <span className="modal-option-name">⚽ Raak</span>
              </button>
              <button className="modal-option" onClick={() => kies(false)}>
                <span className="modal-option-name">✗ Mis</span>
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setGekozen(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
