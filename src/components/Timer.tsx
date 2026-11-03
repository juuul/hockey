import { useEffect, useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import ResetModal from './ResetModal'
import { tel } from '../statistiek'
import { beginVan, deelNaam, faseVan, wedstrijdDuur, schemaVoor, speelNaam, voortgang } from '../speelduur'
import './Timer.css'

function formatteer(ms: number) {
  const totaal = Math.floor(ms / 1000)
  const min = Math.floor(totaal / 60)
  const sec = totaal % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// Stand van de wedstrijdklok, voor de timer onder de vouw en de regel onder de score
export function useKlok() {
  const { timer: stand, spelvorm } = useHockey()
  const [nu, setNu] = useState(Date.now())
  const loopt = stand.gestartOp !== null

  useEffect(() => {
    if (!loopt) return
    setNu(Date.now())
    const id = setInterval(() => setNu(Date.now()), 250)
    return () => clearInterval(id)
  }, [loopt])

  const schema = schemaVoor(spelvorm)
  // Nooit verder dan het einde van de wedstrijd (de context zet de klok daar ook stil)
  const verstreken = Math.min(wedstrijdDuur(schema), stand.opgebouwd + (loopt ? Math.max(0, nu - stand.gestartOp!) : 0))
  // Kwart, pauze of rust volgt vanzelf uit de verstreken tijd. Pauze/rust telt af (naar boven afgerond)
  const fase = faseVan(verstreken, schema)
  const inPauze = !!fase.deel && fase.deel.soort !== 'kwart'
  const naam = deelNaam(fase.deel, schema)
  const groot = !fase.deel ? formatteer(verstreken) : inPauze ? formatteer(fase.nog + 999) : formatteer(fase.inDeel)
  const rechts = !fase.deel ? 'totaal' : inPauze ? `daarna ${speelNaam(fase.deel.kwart, schema)}` : `nog ${formatteer(fase.nog + 999)}`
  return { loopt, verstreken, schema, fase, inPauze, naam, groot, rechts, delen: voortgang(verstreken, schema) }
}

// Onder de score: resterende tijd van dit deel, met directe bediening.
export function KlokRegel() {
  const { startTimer, pauzeTimer, zetKlok, magBewerken, undo, canUndo } = useHockey()
  const { loopt, verstreken, schema, fase, inPauze, naam } = useKlok()
  const spring = (index: number) => {
    if (!magBewerken || index < 0 || index > schema.length) return
    // Een stilstaande klok blijft stilstaan; een lopende klok loopt verder.
    zetKlok(beginVan(index, schema))
    tel('timer-deel-boven')
  }
  const schakel = () => {
    if (!magBewerken || !fase.deel) return
    if (loopt) { pauzeTimer(); tel('timer-pauze-boven') }
    else { startTimer(); tel('timer-start-boven') }
  }
  const actie = loopt ? 'Pauzeren' : verstreken === 0 ? 'Starten' : 'Verdergaan'
  const vorige = fase.index - 1
  const volgende = fase.index + 1
  return (
    <div className={`klok-regel ${loopt ? 'loopt' : ''} ${inPauze ? 'in-pauze' : ''}`}>
      <span className="klok-regel-tekst" aria-live="off">
        <span className="klok-regel-deel">{naam}</span>
        <strong>{fase.deel ? `nog ${formatteer(Math.max(0, fase.nog) + 999)}` : '0:00'}</strong>
      </span>
      {magBewerken && <div className="klok-bediening" role="group" aria-label="Wedstrijdklok">
        <button type="button" className="klok-sprong" disabled={vorige < 0}
          aria-label="Vorig deel" title={vorige >= 0 ? `Vorig deel: ${deelNaam(schema[vorige], schema)}` : 'Vorig deel'}
          onClick={() => spring(vorige)}><span aria-hidden="true">|◀</span></button>
        <button type="button" className={loopt ? 'timer-pauze' : 'timer-start'} disabled={!fase.deel}
          aria-label={actie} title={actie} onClick={schakel}>
          <span aria-hidden="true">{loopt ? 'Ⅱ' : '▶'}</span>
        </button>
        <button type="button" className="klok-sprong" disabled={!fase.deel}
          aria-label="Volgend deel" title={fase.deel ? `Volgend deel: ${deelNaam(schema[volgende] ?? null, schema)}` : 'Volgend deel'}
          onClick={() => spring(volgende)}><span aria-hidden="true">▶|</span></button>
        <button type="button" className="klok-undo" disabled={!canUndo}
          aria-label="Undo" title="Laatste actie ongedaan maken"
          onClick={() => { if (magBewerken && canUndo) { undo(); tel('undo') } }}>
          <span aria-hidden="true">↶</span>
        </button>
      </div>}
    </div>
  )
}

export default function Timer() {
  const { startTimer, pauzeTimer, stopTimer, zetKlok, magBewerken } = useHockey()
  const [stopVraag, setStopVraag] = useState(false)
  const { loopt, verstreken, schema, fase, inPauze, naam, groot, rechts, delen } = useKlok()
  // Per kwart (of helft) een knop: tikken = dat kwart begint nu op 0:00 (op het fluitsignaal).
  // Groen = het kwart waarin je zit; in een pauze of voor de start het kwart dat eraan komt (met ▶). Grijs = gespeeld
  const kwarten = schema.map((d, i) => ({ d, i })).filter(({ d }) => d.soort === 'kwart')
  const nietBegonnen = !loopt && verstreken === 0
  const volgende = nietBegonnen ? kwarten[0]?.i : inPauze ? fase.index + 1 : undefined
  const groen = fase.deel?.soort === 'kwart' && !nietBegonnen ? fase.index : volgende

  const start = () => {
    startTimer()
    tel('timer-start')
  }
  const pauze = () => {
    pauzeTimer()
    tel('timer-pauze')
  }
  const stop = () => {
    stopTimer()
    setStopVraag(false)
    tel('timer-stop')
  }

  return (
    <div className={`timer ${loopt ? 'loopt' : ''} ${inPauze ? 'in-pauze' : ''}`}>
      <div className="timer-kop">
        <span className="timer-deel">{naam}</span>
        <span className="timer-nog">{rechts}</span>
      </div>
      <div className="timer-tijd" aria-live="off">{groot}</div>
      <div className="timer-balk" aria-hidden="true">
        {schema.map((d, i) => (
          <div key={i} className={`timer-seg ${d.soort}`} style={{ flexGrow: d.lengte }}>
            <i style={{ width: `${delen[i] * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="timer-labels" aria-hidden="true">
        {schema.map((d, i) => <span key={i} style={{ flexGrow: d.lengte }}>{d.soort === 'kwart' ? d.kwart : d.soort === 'rust' ? 'rust' : ''}</span>)}
      </div>
      {magBewerken && <>
        <div className="timer-uitleg">{kwarten.length === 1 ? 'Wedstrijd' : kwarten.length === 2 ? 'Helft' : 'Kwart'} begint nu:</div>
        <div className="timer-kwarten">
          {kwarten.map(({ d, i }) => (
            <button
              key={i}
              className={`btn ${i === groen ? 'timer-start' : i < fase.index ? 'gespeeld' : 'btn-secondary'}`}
              onClick={() => { zetKlok(beginVan(i, schema), true); tel('timer-kwart') }}
            >
              {i === volgende && <span aria-hidden="true">▶ </span>}{kwarten.length === 1 ? 'Start' : `${d.kwart}e`}
              {kwarten.length > 1 && <small>{kwarten.length === 2 ? 'helft' : 'kwart'}</small>}
            </button>
          ))}
        </div>
        <div className="timer-knoppen">
          {loopt || nietBegonnen || !fase.deel
            ? <button className="btn timer-pauze" onClick={pauze} disabled={!loopt}>Pauze</button>
            : <button className="btn timer-start" onClick={start}>Verder</button>}
          <button className="btn timer-stop" onClick={() => setStopVraag(true)} disabled={nietBegonnen}>Stop</button>
        </div>
        {/* Helemaal onderaan: de tijd een beetje bijstellen */}
        <div className="timer-knoppen timer-bijstellen">
          {[-60, -10, 10, 60].map(sec => (
            <button key={sec} className="btn btn-secondary" onClick={() => { zetKlok(verstreken + sec * 1000); tel('timer-bijstellen') }}>
              {sec < 0 ? '−' : '+'}{formatteer(Math.abs(sec) * 1000)}
            </button>
          ))}
        </div>
      </>}

      {stopVraag && (
        <ResetModal
          titel="Timer stoppen?"
          regels={[{ icoon: '⏱', tekst: `De tijd (${formatteer(verstreken)}) gaat terug naar 0:00` }]}
          bevestig="Ja, stop timer"
          onConfirm={stop}
          onCancel={() => setStopVraag(false)}
        />
      )}
    </div>
  )
}
