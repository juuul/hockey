import { useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { shootoutTelling } from '../historie'
import { tel } from '../statistiek'
import './Shootout.css'

// Shoot-outs na de wedstrijd (O10 en O9): wie er het minst genomen heeft (alle wedstrijden + deze) staat bovenaan.
// Alleen wie nam telt; raak of mis doet er niet toe (de score staat op het Dashboard)
export default function Shootout() {
  const { spelers, wedstrijden, shootouts, neemShootout, haalShootoutWeg, magBewerken } = useHockey()

  const telling = shootoutTelling(wedstrijden, shootouts)
  const genomen = (id: string) => telling.get(id) ?? 0
  const keeper = spelers.find(s => s.isKeeper && s.meedoen)
  const naarAantal = (a: typeof spelers[number], b: typeof spelers[number]) => genomen(a.id) - genomen(b.id) || a.naam.localeCompare(b.naam)
  // Volgorde van het moment dat je het tabblad opent: na een tik blijft de speler staan (met +1),
  // pas bij terugkomen op het tabblad schuift ze naar beneden. Wie er later bij komt: onderaan op aantal
  const [volgorde] = useState(() => [...spelers].sort(naarAantal).map(s => s.id))
  const plek = (id: string) => { const i = volgorde.indexOf(id); return i < 0 ? volgorde.length : i }
  const lijst = spelers
    .filter(s => s.meedoen && !s.isKeeper)
    .sort((a, b) => plek(a.id) - plek(b.id) || naarAantal(a, b))
  const nu = (id: string) => shootouts.filter(s => s.spelerId === id).length
  const laatste = shootouts.length ? spelers.find(s => s.id === shootouts[shootouts.length - 1].spelerId)?.naam ?? 'Onbekend' : ''

  return (
    <div className="shootout-scherm">
      <div className="shootout-kop">Shoot-out</div>
      <p className="shootout-uitleg">
        Wie het minst genomen heeft, staat bovenaan.{magBewerken ? ' Tik op wie een shoot-out neemt.' : ''}
      </p>
      {shootouts.length > 0 && <div className="shootout-nu">Deze wedstrijd: {shootouts.length} genomen</div>}

      <div className="shootout-lijst">
        {lijst.map(s => (
          <button
            key={s.id}
            className={`shootout-speler ${nu(s.id) ? 'genomen' : ''}`}
            onClick={() => { neemShootout(s.id); tel('shootout') }}
            disabled={!magBewerken}
          >
            <span className="shootout-info">
              <span className="shootout-naam">{s.naam}</span>
              {nu(s.id) > 0 && <span className="shootout-deze">+{nu(s.id)} deze wedstrijd</span>}
            </span>
            <span className="shootout-aantal" aria-label={`${genomen(s.id)} shoot-outs genomen`}>{genomen(s.id)}×</span>
          </button>
        ))}
        {lijst.length === 0 && <p className="shootout-uitleg">Niemand doet mee. Meld spelers aan bij 👥 Spelers.</p>}
      </div>

      {magBewerken && shootouts.length > 0 && (
        <button className="btn btn-secondary" onClick={() => { haalShootoutWeg(); tel('shootout-weg') }}>
          Laatste weghalen ({laatste})
        </button>
      )}

      {keeper && <p className="shootout-uitleg">{keeper.naam} staat op doel en staat niet in de lijst.</p>}
      <p className="shootout-uitleg">Telt alle afgesloten wedstrijden en deze wedstrijd. Bij Wedstrijd afsluiten worden de shoot-outs bewaard.</p>
    </div>
  )
}
