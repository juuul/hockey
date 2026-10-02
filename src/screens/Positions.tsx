import { useHockey } from '../context/HockeyContext'
import { POSITIE_LABEL, Position, veldPosities } from '../types'
import { tel } from '../statistiek'
import './Positions.css'

const KEUZE_NAAM = ['1e keuze', '2e keuze']

export default function Positions() {
  const { spelers, vastePosities, setVastePositie, opstelling, magBeheren: magBewerken } = useHockey()
  const fieldPlayers = spelers.filter(s => !s.isKeeper)

  const handleSetPosition = (spelerId: string, keuze: number, positie: Position | null) => {
    setVastePositie(spelerId, keuze, positie)
    tel('voorkeur')
  }

  return (
    <div className="positions-screen">
      <h2>Voorkeursposities</h2>
      <p className="help-text">Bij "Nieuwe opstelling" wordt eerst geloot wie begint. Wie begint, krijgt zo mogelijk de 1e keuze, anders de 2e. Hebben meerdere spelers dezelfde keuze, dan wordt geloot wie hem krijgt.</p>

      <div className="positions-list">
        {fieldPlayers.map(player => (
          // Wie niet meedoet blijft staan (voorkeur blijft bewaard), maar wordt niet opgesteld
          <div key={player.id} className={`position-item ${player.meedoen ? '' : 'doet-niet-mee'}`}>
            <div className="player-name">
              {player.naam}
              {!player.meedoen && <div className="niet-mee">Doet niet mee, wordt niet opgesteld</div>}
            </div>
            <div className="position-buttons">
              {[0, 1].map(keuze => {
                const waarde = (vastePosities[player.id]?.[keuze] ?? '') as Position | ''
                return (
                  <label key={keuze} className={`keuze ${waarde ? 'gekozen' : ''}`}>
                    <span className="keuze-tekst">
                      {waarde ? `${keuze + 1}. ${POSITIE_LABEL[waarde]}` : KEUZE_NAAM[keuze]}
                    </span>
                    <select
                      disabled={!magBewerken}
                      className="keuze-select"
                      aria-label={`${KEUZE_NAAM[keuze]} voor ${player.naam}`}
                      value={waarde}
                      onChange={(e) => handleSetPosition(player.id, keuze, e.target.value ? (e.target.value as Position) : null)}
                    >
                      <option value="">Geen {KEUZE_NAAM[keuze]}</option>
                      {veldPosities(opstelling).map(pos => {
                        const ook = fieldPlayers.filter(p => p.id !== player.id && vastePosities[p.id]?.includes(pos)).map(p => p.naam)
                        return (
                          <option key={pos} value={pos}>
                            {POSITIE_LABEL[pos]}{ook.length ? ` (ook ${ook.join(', ')})` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
