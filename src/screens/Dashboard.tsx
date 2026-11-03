import React, { useEffect, useRef, useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { useAccount } from '../context/AccountContext'
import { OPSTELLINGEN, heeftKeeper, Position, POSITIE_LABEL } from '../types'
import { useTerug } from '../terug'
import ResetModal from '../components/ResetModal'
import Timer, { KlokRegel } from '../components/Timer'
import ScorerModal from '../components/ScorerModal'
import { WedstrijdAfsluitenKnop } from '../components/DezeWedstrijd'
import KiesDoelpuntWeg, { scorersVan } from '../components/KiesDoelpuntWeg'
import { tel } from '../statistiek'
import { sorteerWissels, veldKleuren } from '../opstelling'
import { klokMs, minuten, opVeld, speeltijden } from '../speeltijd'
import './Dashboard.css'

export default function Dashboard({ naarInstellingen }: { naarInstellingen: () => void }) {
  const { gebruiker } = useAccount()
  const { doelpuntenBijhouden, speeltijdBijhouden } = useHockey()
  const { spelers, wisselingen, wissel, resetWissels, nieuweOpstelling, verplaats, plaatsIn, score, scoor, haalDoelpuntWeg, resetScore, doelpunten, spelvorm, opstelling, magBewerken, magBeheren, afgesloten, wedstrijd, clubs, weerOpenen, nieuweWedstrijd, speeltijdLog, timer } = useHockey()
  const [modus, setModus] = useState<'wissel' | 'verplaats'>('wissel')
  type Selectie = { id: string; positie: Position; inVeld: boolean } | { leeg: Position }
  const [selectie, setSelectie] = useState<Selectie | null>(null)
  const selectieRef = useRef<Selectie | null>(null)
  const kies = (waarde: Selectie | null) => { selectieRef.current = waarde; setSelectie(waarde) }
  useTerug(!!selectie, () => kies(null))
  // Wis een keuze zodra een andere beheerder de gekozen speler of lege plek wijzigt.
  useEffect(() => {
    const gekozen = selectieRef.current
    if (!gekozen) return
    const geldig = 'leeg' in gekozen
      ? !spelers.some(s => s.inVeld && s.positie === gekozen.leeg)
      : spelers.some(s => s.id === gekozen.id && s.meedoen && s.inVeld === gekozen.inVeld && s.positie === gekozen.positie)
    if (!geldig || !magBewerken) kies(null)
  }, [spelers, magBewerken])
  const [vraag, setVraag] = useState<'wissels' | 'opstelling' | null>(null)
  const [kiesScorer, setKiesScorer] = useState(false)
  const [kiesWeg, setKiesWeg] = useState(false)
  const huidigeScorers = scorersVan(doelpunten.map(id => ({ spelerId: id, naam: spelers.find(s => s.id === id)?.naam ?? 'Onbekend' })))
  // − bij Wij: bij één scorer meteen weg, anders kiezen bij wie
  const wijEraf = () => {
    if (!doelpuntenBijhouden) { scoor('wij', -1); return }
    if (huidigeScorers.length > 1) return setKiesWeg(true)
    haalDoelpuntWeg(huidigeScorers[0]?.id ?? null)
    tel('score-wij-min')
  }

  const fieldPlayers = spelers.filter(s => s.inVeld && !s.isKeeper)
  const keeper = spelers.find(s => s.isKeeper)
  const kleuren = veldKleuren(fieldPlayers, spelvorm === 6 ? 1 : 2)
  const substitutes = sorteerWissels(spelers.filter(s => !s.inVeld && s.meedoen), wisselingen)
  // Eén regel wissels past in beeld; de rest staat onder de vouw, bereikbaar door de pagina te scrollen
  const wisselsInBeeld = substitutes.slice(0, 2)
  const wisselsEronder = substitutes.slice(2)
  // Speeltijd (minuten in het veld) op de wisseltegels; elke 15 s bijwerken zolang de klok loopt
  const [, setTik] = useState(0)
  useEffect(() => {
    if (timer.gestartOp === null) return
    const id = setInterval(() => setTik(t => t + 1), 15000)
    return () => clearInterval(id)
  }, [timer.gestartOp])
  const klok = klokMs(timer)
  const tijden = klok > 0 ? speeltijden(speeltijdLog, klok) : {}
  const wisselTegel = (sub: typeof substitutes[number]) => (
    <button key={sub.id} type="button"
      className={`substitute-item ${selectie && 'id' in selectie && selectie.id === sub.id ? 'geselecteerd' : ''}`}
      aria-pressed={!!selectie && 'id' in selectie && selectie.id === sub.id}
      disabled={!magBewerken} onClick={() => tik(sub.id)}>

      <span className="name">
        {sub.naam}
        {speeltijdBijhouden && tijden[sub.id] && <span className="speeltijd">{minuten(opVeld(tijden[sub.id]))} min</span>}
      </span>
      <span className="count">{sub.wisselCount}×</span>
    </button>
  )

  const getPlayerByPosition = (pos: Position) =>
    pos === 'K' ? keeper : fieldPlayers.find(p => p.positie === pos)

  const tik = (id?: string, leeg?: Position) => {
    if (!magBewerken) return
    const gekozen = selectieRef.current
    const speler = spelers.find(s => s.id === id && s.meedoen)
    if (!gekozen) {
      if (speler) kies({ id: speler.id, positie: speler.positie, inVeld: speler.inVeld })
      else if (leeg) kies({ leeg })
      return
    }
    if ('leeg' in gekozen) {
      kies(null)
      if (speler) { plaatsIn(speler.id, gekozen.leeg); setModus('wissel'); tel('lege-plek-gevuld') }
      return
    }
    const bron = spelers.find(s => s.id === gekozen.id && s.meedoen && s.inVeld === gekozen.inVeld && s.positie === gekozen.positie)
    kies(null)
    if (!bron || bron.id === speler?.id) return
    if (!speler) {
      if (leeg) { plaatsIn(bron.id, leeg); setModus('wissel'); tel('lege-plek-gevuld') }
      return
    }
    // Twee reserves kiezen verandert alleen de selectie, nooit de opstelling.
    if (!bron.inVeld && !speler.inVeld) {
      kies({ id: speler.id, positie: speler.positie, inVeld: false })
      return
    }
    if (modus === 'wissel' && bron.inVeld !== speler.inVeld && !bron.isKeeper && !speler.isKeeper) {
      const uit = bron.inVeld ? bron : speler
      const invaller = bron.inVeld ? speler : bron
      wissel(uit.id, invaller.id, uit.positie)
      tel('wissel')
    } else {
      verplaats(bron.id, speler.id)
      tel(bron.isKeeper || speler.isKeeper ? 'keeper-verplaatst' : 'verplaats')
    }
    setModus('wissel')
  }

  const bevestigVraag = () => {
    if (vraag === 'wissels') resetWissels()
    else nieuweOpstelling()
    tel(vraag === 'wissels' ? 'reset' : 'nieuwe-opstelling')
    setVraag(null)
  }

  const slot = (pos: Position) => {
    const player = getPlayerByPosition(pos)
    return (
      <button
        key={pos}
        className={`player-slot ${pos === 'K' ? 'keeper' : ''} ${player ? kleuren[player.id] ?? '' : 'leeg'} ${selectie && ('id' in selectie ? selectie.id === player?.id : selectie.leeg === pos) ? 'geselecteerd' : ''}`}
        onClick={() => tik(player?.id, player ? undefined : pos)}
        aria-pressed={!!selectie && ('id' in selectie ? selectie.id === player?.id : selectie.leeg === pos)}
        disabled={!magBewerken}
        aria-label={player ? `${player.naam}, ${player.wisselCount} keer gewisseld` : `Lege plek ${POSITIE_LABEL[pos]}: iemand erin zetten`}
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
        <button className="score-min" onClick={wijEraf} disabled={!magBewerken || score.wij === 0} aria-label="Doelpunt wij eraf">−</button>
        <button className="score-team wij" onClick={() => { if (doelpuntenBijhouden) setKiesScorer(true); else { scoor('wij', 1); tel('score-wij') } }} disabled={!magBewerken} aria-label={`Wij ${score.wij}, doelpunt erbij`}>
          <span className="score-naam">Wij</span>
          <span className="score-getal">{score.wij}</span>
        </button>
        <button className="score-team zij" onClick={() => { scoor('zij', 1); tel('score-zij') }} disabled={!magBewerken} aria-label={`Zij ${score.zij}, doelpunt erbij`}>
          <span className="score-getal">{score.zij}</span>
          <span className="score-naam">Zij</span>
        </button>
        <button className="score-min" onClick={() => { scoor('zij', -1); tel('score-zij-min') }} disabled={!magBewerken || score.zij === 0} aria-label="Doelpunt zij eraf">−</button>
      </div>
      {/* Afgesloten: de uitslag blijft staan (voor iedereen) tot er een nieuwe wedstrijd begint */}
      {wedstrijd.afgesloten ? (
        <div className="afgelopen-regel">
          <span className="afgelopen-kop">🏁 Afgelopen{afgesloten?.tegenstander || clubs.find(c => c.id === wedstrijd.clubId)?.naam ? ` · tegen ${afgesloten?.tegenstander || clubs.find(c => c.id === wedstrijd.clubId)?.naam}` : ''}</span>
          {doelpuntenBijhouden && huidigeScorers.length > 0 && (
            <span className="afgelopen-scorers">{huidigeScorers.map(s => `⚽ ${s.naam}${s.aantal > 1 ? ` ${s.aantal}` : ''}`).join(' · ')}</span>
          )}
        </div>
      ) : <KlokRegel />}

      <div className="field-container">
        <svg className="field-lines" viewBox="0 0 320 400" preserveAspectRatio="none" aria-hidden="true">
          <rect x="8" y="8" width="304" height="384" rx="2" />
          <path d="M8 200h304M8 106h304M8 294h304M70 8a90 86 0 0 0 180 0M70 392a90 86 0 0 1 180 0M138 8V3h44v5M138 392v5h44v-5" />
        </svg>
        {/* Rondjes schalen mee met de breedste rij en het aantal rijen (11 spelers: rijen van 4 en een laatste man) */}
        <div
          className="field"
          style={{
            '--breedste': Math.max(3, ...OPSTELLINGEN[opstelling].map(r => r.length)),
            '--rijen': Math.max(4, OPSTELLINGEN[opstelling].length + 1),
          } as React.CSSProperties}
        >
          {OPSTELLINGEN[opstelling].map(rij => (
            <div key={rij.join()} className={`field-row rij-${rij.length}`} style={{ '--kolommen': rij.length } as React.CSSProperties}>{rij.map(slot)}</div>
          ))}
          {heeftKeeper(spelvorm) && <div className="field-row single">{slot('K')}</div>}
        </div>
      </div>

      {/* Wisselspelers */}
      {(wisselsInBeeld.length > 0 || magBewerken) && (
        <div className="substitutes-section">
          <div className={`substitutes-list ${magBewerken ? 'met-modus' : ''}`}>
            {wisselsInBeeld.map(wisselTegel)}
            {magBewerken && <button type="button" className="wissel-modus-icoon"
              aria-pressed={modus === 'verplaats'}
              aria-label={modus === 'verplaats' ? 'Alleen verplaatsen actief, terug naar wisselen' : 'Wisselen actief, één keer verplaatsen'}
              title={modus === 'verplaats' ? 'Alleen verplaatsen (eenmalig)' : 'Wisselen; tik voor één keer verplaatsen'}
              onClick={() => { setModus(modus === 'wissel' ? 'verplaats' : 'wissel'); kies(null) }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {modus === 'wissel'
                  ? <path transform="rotate(80 12 12)" d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
                  : <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />}
              </svg>
            </button>}
          </div>
        </div>
      )}

    </div>

    {/* Bewust onder de vouw: alleen bereikbaar door te scrollen, zodat je er niet per ongeluk op tikt */}
    {wisselsEronder.length > 0 && (
      <div className="substitutes-list wissels-eronder">{wisselsEronder.map(wisselTegel)}</div>
    )}

    <div className="dashboard-knoppen">
      {wedstrijd.afgesloten && magBeheren && (
        <>
          <p className="kijker-melding">De wedstrijd is afgesloten en opgeslagen. De uitslag blijft vandaag hier staan.</p>
          <button className="btn btn-primary" onClick={() => { nieuweWedstrijd(); tel('nieuwe-wedstrijd') }}>Nieuwe wedstrijd</button>
          <button className="btn btn-secondary" onClick={() => { weerOpenen(); tel('wedstrijd-heropend') }}>Wedstrijd weer openen</button>
        </>
      )}
      {!magBeheren && <p className="kijker-melding">Je kijkt live mee. Alleen beheerders kunnen de wedstrijd bijhouden.</p>}
      {magBewerken && <WedstrijdAfsluitenKnop />}
      {magBewerken && (
        <>
          <button className="btn btn-secondary" onClick={() => setVraag('opstelling')}>Nieuwe opstelling</button>
          <button className="btn btn-secondary" onClick={() => setVraag('wissels')}>Reset wissels</button>
          <button className="btn btn-secondary" onClick={() => { resetScore(); tel('score-reset') }} disabled={score.wij === 0 && score.zij === 0}>Score 0 – 0</button>
        </>
      )}
      <Timer />

      {doelpuntenBijhouden && kiesWeg && (
        <KiesDoelpuntWeg
          scorers={huidigeScorers}
          onKies={id => { haalDoelpuntWeg(id); tel('score-wij-min-gekozen'); setKiesWeg(false) }}
          onClose={() => setKiesWeg(false)}
        />
      )}

      {doelpuntenBijhouden && kiesScorer && (
        <ScorerModal
          spelers={spelers}
          doelpunten={doelpunten}
          onKies={id => { scoor('wij', 1, id); tel(id ? 'score-wij' : 'score-wij-onbekend'); setKiesScorer(false) }}
          onClose={() => setKiesScorer(false)}
        />
      )}

      {vraag === 'wissels' && (
        <ResetModal
          titel="Wissels resetten?"
          regels={[
            { icoon: '↺', tekst: 'Veldspelers op 0, wisselspelers op 1' },
            { icoon: '🟢', tekst: 'Kleuren in het veld weer groen' },
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
