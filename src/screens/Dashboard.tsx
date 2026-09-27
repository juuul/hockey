import React, { useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { useAccount } from '../context/AccountContext'
import DeelKijklink from '../components/DeelKijklink'
import { OPSTELLINGEN, Position, POSITIE_LABEL } from '../types'
import SubstituteModal from '../components/SubstituteModal'
import ResetModal from '../components/ResetModal'
import Timer from '../components/Timer'
import ScorerModal from '../components/ScorerModal'
import WedstrijdModal from '../components/WedstrijdModal'
import { datumTekst } from '../historie'
import { tel } from '../statistiek'
import { sorteerWissels, veldKleuren } from '../opstelling'
import './Dashboard.css'

export default function Dashboard({ naarInstellingen }: { naarInstellingen: () => void }) {
  const { gebruiker } = useAccount()
  const { spelers, wisselingen, wissel, resetWissels, nieuweOpstelling, verplaats, plaatsIn, undo, canUndo, score, scoor, resetScore, doelpunten, spelvorm, opstelling, allesResetten, clubs, wedstrijd, zetWedstrijd, wedstrijdAfsluiten, magBewerken } = useHockey()
  const [showSubstituteModal, setShowSubstituteModal] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<Position>('LW')
  const [selectedPlayerName, setSelectedPlayerName] = useState('')
  const [vraag, setVraag] = useState<'wissels' | 'opstelling' | 'alles' | null>(null)
  const [kiesScorer, setKiesScorer] = useState(false)
  const [wedstrijdVraag, setWedstrijdVraag] = useState<'gegevens' | 'afsluiten' | null>(null)
  const tegenstander = clubs.find(c => c.id === wedstrijd.clubId)?.naam

  const fieldPlayers = spelers.filter(s => s.inVeld && !s.isKeeper)
  const keeper = spelers.find(s => s.isKeeper)
  const kleuren = veldKleuren(fieldPlayers, spelvorm === 6 ? 1 : 2)
  const scorerOverzicht = Object.entries(
    doelpunten.reduce<Record<string, number>>((perNaam, id) => {
      const naam = spelers.find(s => s.id === id)?.naam ?? 'Onbekend'
      return { ...perNaam, [naam]: (perNaam[naam] ?? 0) + 1 }
    }, {})
  ).map(([naam, aantal]) => ({ naam, aantal })).sort((a, b) => b.aantal - a.aantal)
  const substitutes = sorteerWissels(spelers.filter(s => !s.inVeld && s.meedoen), wisselingen)
  // Eén regel wissels past in beeld; de rest staat onder de vouw, bereikbaar door de pagina te scrollen
  const wisselsInBeeld = substitutes.slice(0, 2)
  const wisselsEronder = substitutes.slice(2)
  const wisselTegel = (sub: typeof substitutes[number]) => (
    <div key={sub.id} className="substitute-item">
      <span className="name">{sub.naam}</span>
      <span className="count">{sub.wisselCount}×</span>
    </div>
  )

  const getPlayerByPosition = (pos: Position) =>
    pos === 'K' ? keeper : fieldPlayers.find(p => p.positie === pos)

  const handlePlayerClick = (position: Position) => {
    setSelectedPosition(position)
    setSelectedPlayerName(getPlayerByPosition(position)?.naam ?? '')
    setShowSubstituteModal(true)
  }

  const handleSubstitute = (inPlayerId: string) => {
    const outPlayer = getPlayerByPosition(selectedPosition)
    if (outPlayer) {
      wissel(outPlayer.id, inPlayerId, selectedPosition)
      tel('wissel')
    } else {
      plaatsIn(inPlayerId, selectedPosition)
      tel('lege-plek-gevuld')
    }
    setShowSubstituteModal(false)
  }

  const handleMove = (otherPlayerId: string) => {
    const player = getPlayerByPosition(selectedPosition)
    if (player) {
      verplaats(player.id, otherPlayerId)
      tel(selectedPosition === 'K' ? 'keeper-verplaatst' : 'verplaats')
      setShowSubstituteModal(false)
    }
  }

  const bevestigVraag = () => {
    if (vraag === 'wissels') resetWissels()
    else if (vraag === 'alles') allesResetten()
    else nieuweOpstelling()
    tel(vraag === 'wissels' ? 'reset' : vraag === 'alles' ? 'alles-resetten' : 'nieuwe-opstelling')
    setVraag(null)
  }

  const slot = (pos: Position) => {
    const player = getPlayerByPosition(pos)
    return (
      <button
        key={pos}
        className={`player-slot ${pos === 'K' ? 'keeper' : ''} ${player ? kleuren[player.id] ?? '' : 'leeg'}`}
        onClick={() => handlePlayerClick(pos)}
        disabled={!magBewerken}
        aria-label={player ? undefined : `Lege plek ${POSITIE_LABEL[pos]}: iemand erin zetten`}
      >
        {player ? (
          <>
            <div className="name">{player.naam}</div>
            <div className="count">{player.wisselCount}×</div>
          </>
        ) : (
          <div className="name">+</div>
        )}
      </button>
    )
  }

  return (
    <>
    <div className="dashboard">
      {/* Alleen zonder account: de weg naar inloggen (tabblad Instellingen) */}
      {!gebruiker && (
        <button className="inlog-balk" onClick={naarInstellingen}>
          <span aria-hidden="true">👤</span> Inloggen
        </button>
      )}
      <div className="score-regel">
        <button className="score-min" onClick={() => { scoor('wij', -1); tel('score-wij-min') }} disabled={!magBewerken || score.wij === 0} aria-label="Doelpunt wij eraf">−</button>
        <button className="score-team wij" onClick={() => setKiesScorer(true)} disabled={!magBewerken} aria-label={`Wij ${score.wij}, doelpunt erbij`}>
          <span className="score-naam">Wij</span>
          <span className="score-getal">{score.wij}</span>
        </button>
        <button className="score-team zij" onClick={() => { scoor('zij', 1); tel('score-zij') }} disabled={!magBewerken} aria-label={`Zij ${score.zij}, doelpunt erbij`}>
          <span className="score-getal">{score.zij}</span>
          <span className="score-naam">Zij</span>
        </button>
        <button className="score-min" onClick={() => { scoor('zij', -1); tel('score-zij-min') }} disabled={!magBewerken || score.zij === 0} aria-label="Doelpunt zij eraf">−</button>
      </div>

      <div className="field-container">
        {/* Rondjes schalen mee met de breedste rij en het aantal rijen (11 spelers: rijen van 4 en een laatste man) */}
        <div
          className="field"
          style={{
            '--breedste': Math.max(3, ...OPSTELLINGEN[opstelling].map(r => r.length)),
            '--rijen': Math.max(4, OPSTELLINGEN[opstelling].length + 1),
          } as React.CSSProperties}
        >
          {OPSTELLINGEN[opstelling].map(rij => (
            <div key={rij.join()} className={`field-row rij-${rij.length}`}>{rij.map(slot)}</div>
          ))}
          <div className="field-row single">{slot('K')}</div>
        </div>
      </div>

      {/* Wisselspelers */}
      {wisselsInBeeld.length > 0 && (
        <div className="substitutes-section">
          <div className="substitutes-list">{wisselsInBeeld.map(wisselTegel)}</div>
        </div>
      )}

    </div>

    {/* Bewust onder de vouw: alleen bereikbaar door te scrollen, zodat je er niet per ongeluk op tikt */}
    {wisselsEronder.length > 0 && (
      <div className="substitutes-list wissels-eronder">{wisselsEronder.map(wisselTegel)}</div>
    )}

    <div className="dashboard-knoppen">
      {!magBewerken && <p className="kijker-melding">Je kijkt live mee. Alleen beheerders kunnen de wedstrijd bijhouden.</p>}
      <DeelKijklink />
      <button className="wedstrijd-kaart" onClick={() => setWedstrijdVraag('gegevens')} disabled={!magBewerken}>
        <span className="wedstrijd-kaart-club">{tegenstander ? `Tegen ${tegenstander}` : 'Kies tegenstander'}</span>
        <span className="wedstrijd-kaart-info">{wedstrijd.thuis ? 'Thuis' : 'Uit'} · {wedstrijd.datum ? datumTekst(wedstrijd.datum) : 'vandaag'}</span>
      </button>
      {magBewerken && <button className="btn btn-primary" onClick={() => setWedstrijdVraag('afsluiten')}>Wedstrijd afsluiten</button>}
      {magBewerken && <button className="btn btn-gevaar" onClick={() => setVraag('alles')}>Alles resetten</button>}
      {doelpunten.length > 0 && (
        <div className="doelpunten">
          <div className="section-title">Doelpunten</div>
          <div className="doelpunten-lijst">
            {scorerOverzicht.map(({ naam, aantal }) => (
              <span key={naam} className="doelpunt-scorer">{naam} <strong>{aantal}</strong></span>
            ))}
          </div>
        </div>
      )}
      {magBewerken && (
        <>
          <button className="btn btn-secondary" onClick={() => { undo(); tel('undo') }} disabled={!canUndo}>Undo</button>
          <button className="btn btn-secondary" onClick={() => setVraag('opstelling')}>Nieuwe opstelling</button>
          <button className="btn btn-secondary" onClick={() => setVraag('wissels')}>Reset wissels</button>
          <button className="btn btn-secondary" onClick={() => { resetScore(); tel('score-reset') }} disabled={score.wij === 0 && score.zij === 0}>Score 0 – 0</button>
        </>
      )}
      <Timer />

      {showSubstituteModal && (
        <SubstituteModal
          playerName={selectedPlayerName}
          position={selectedPosition}
          substitutes={substitutes}
          fieldPlayers={fieldPlayers.filter(p => p.positie !== selectedPosition)}
          onSubstitute={handleSubstitute}
          onMove={handleMove}
          onClose={() => setShowSubstituteModal(false)}
          leegPlek={!getPlayerByPosition(selectedPosition)}
          alleenVerplaatsen={selectedPosition === 'K'}
        />
      )}

      {kiesScorer && (
        <ScorerModal
          spelers={spelers}
          doelpunten={doelpunten}
          onKies={id => { scoor('wij', 1, id); tel(id ? 'score-wij' : 'score-wij-onbekend'); setKiesScorer(false) }}
          onClose={() => setKiesScorer(false)}
        />
      )}

      {wedstrijdVraag === 'gegevens' && (
        <WedstrijdModal
          titel="Wedstrijd"
          start={wedstrijd}
          bevestig="Opslaan"
          onOpslaan={info => { zetWedstrijd(info); tel('wedstrijd-gegevens'); setWedstrijdVraag(null) }}
          onClose={() => setWedstrijdVraag(null)}
        />
      )}

      {wedstrijdVraag === 'afsluiten' && (
        <WedstrijdModal
          titel={`Afsluiten: ${score.wij} – ${score.zij}`}
          start={wedstrijd}
          bevestig="Opslaan"
          clubVerplicht
          uitleg="Daarna begint een nieuwe wedstrijd: nieuwe opstelling, wissels en score op 0, timer 0:00."
          onOpslaan={(info, naam) => { wedstrijdAfsluiten(info, naam); tel('wedstrijd-afgesloten'); setWedstrijdVraag(null) }}
          onClose={() => setWedstrijdVraag(null)}
        />
      )}

      {vraag === 'alles' && (
        <ResetModal
          titel="Alles resetten?"
          regels={[
            { icoon: '🔀', tekst: 'Nieuwe opstelling geloot' },
            { icoon: '↺', tekst: 'Wissels: veld 0, bank 1' },
            { icoon: '⚽', tekst: 'Score 0 – 0, scorers gewist' },
            { icoon: '⏱', tekst: 'Timer 0:00 en gestopt' },
          ]}
          bevestig="Ja, alles resetten"
          onConfirm={bevestigVraag}
          onCancel={() => setVraag(null)}
        />
      )}

      {vraag === 'wissels' && (
        <ResetModal
          titel="Wissels resetten?"
          regels={[
            { icoon: '↺', tekst: 'Veldspelers op 0, wisselspelers op 1' },
            { icoon: '📍', tekst: 'Opstelling blijft staan' },
          ]}
          bevestig="Ja, reset wissels"
          onConfirm={bevestigVraag}
          onCancel={() => setVraag(null)}
        />
      )}

      {vraag === 'opstelling' && (
        <ResetModal
          titel="Nieuwe opstelling?"
          regels={[
            { icoon: '🔀', tekst: 'Loten wie begint, daarna gelden de voorkeuren' },
            { icoon: '🔢', tekst: 'Wissels blijven staan' },
          ]}
          bevestig="Ja, nieuwe opstelling"
          onConfirm={bevestigVraag}
          onCancel={() => setVraag(null)}
        />
      )}
    </div>
    </>
  )
}
