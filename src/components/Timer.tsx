import { useEffect, useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import ResetModal from './ResetModal'
import { tel } from '../statistiek'
import { beginVan, deelNaam, faseVan, schemaVoor, speelNaam, voortgang } from '../speelduur'
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

  const verstreken = stand.opgebouwd + (loopt ? nu - stand.gestartOp! : 0)
  // Kwart, pauze of rust volgt vanzelf uit de verstreken tijd. Pauze/rust telt af (naar boven afgerond)
  const schema = schemaVoor(spelvorm)
  const fase = faseVan(verstreken, schema)
  const inPauze = !!fase.deel && fase.deel.soort !== 'kwart'
  const naam = deelNaam(fase.deel, schema)
  const groot = !fase.deel ? formatteer(verstreken) : inPauze ? formatteer(fase.nog + 999) : formatteer(fase.inDeel)
  const rechts = !fase.deel ? 'totaal' : inPauze ? `daarna ${speelNaam(fase.deel.kwart, schema)}` : `nog ${formatteer(fase.nog + 999)}`
  return { loopt, verstreken, schema, fase, inPauze, naam, groot, rechts, delen: voortgang(verstreken, schema) }
}

// Onder de score: altijd in beeld, zonder te scrollen. Met een startknop als de klok stilstaat,
// en in een pauze of de rust om het volgende deel meteen te laten beginnen (als de scheidsrechter fluit)
export function KlokRegel() {
  const { startTimer, zetKlok, magBewerken } = useHockey()
  const { loopt, verstreken, schema, fase, inPauze, naam, groot, rechts } = useKlok()
  const knop = !magBewerken || !fase.deel ? null
    : !loopt ? { tekst: verstreken === 0 ? '▶ Start' : '▶ Verder', doe: () => { startTimer(); tel('timer-start-boven') } }
    : inPauze ? { tekst: `▶ ${speelNaam(fase.deel.kwart, schema)}`, doe: () => { zetKlok(beginVan(fase.index + 1, schema), true); tel('timer-volgende-boven') } }
    : null
  return (
    <div className={`klok-regel ${loopt ? 'loopt' : ''} ${inPauze ? 'in-pauze' : ''} ${knop ? 'met-knop' : ''}`}>
      <span className="klok-regel-tekst">
        <span aria-hidden="true">{inPauze ? '☕' : '⏱'}</span>
        <strong>{naam} {groot}</strong>
        {!knop && <span className="klok-regel-nog">· {rechts}</span>}
      </span>
      {knop && <button className="btn timer-start klok-regel-knop" onClick={knop.doe}>{knop.tekst}</button>}
    </div>
  )
}

export default function Timer() {
  const { startTimer, pauzeTimer, stopTimer, zetKlok, magBewerken } = useHockey()
  const [stopVraag, setStopVraag] = useState(false)
  const { loopt, verstreken, schema, fase, inPauze, naam, groot, rechts, delen } = useKlok()
  // Per kwart (of helft) een knop: tikken = dat kwart begint nu op 0:00 (op het fluitsignaal).
  // Grijs = al gespeeld, groen = het volgende
  const kwarten = schema.map((d, i) => ({ d, i })).filter(({ d }) => d.soort === 'kwart')
  const nietBegonnen = !loopt && verstreken === 0
  const volgende = nietBegonnen ? kwarten[0]?.i : kwarten.find(({ i }) => i > fase.index)?.i

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
        <div className="timer-uitleg">{kwarten.length === 2 ? 'Helft' : 'Kwart'} begint nu:</div>
        <div className="timer-kwarten">
          {kwarten.map(({ d, i }) => (
            <button
              key={i}
              className={`btn ${i === volgende ? 'timer-start' : i < fase.index ? 'gespeeld' : 'btn-secondary'}`}
              onClick={() => { zetKlok(beginVan(i, schema), true); tel('timer-kwart') }}
            >
              {i === volgende && <span aria-hidden="true">▶ </span>}{d.kwart}e
              <small>{kwarten.length === 2 ? 'helft' : 'kwart'}</small>
            </button>
          ))}
        </div>
        <div className="timer-knoppen">
          {loopt || nietBegonnen
            ? <button className="btn btn-secondary" onClick={pauze} disabled={!loopt}>Pauze</button>
            : <button className="btn timer-start" onClick={start}>Verder</button>}
          <button className="btn btn-secondary" onClick={() => setStopVraag(true)} disabled={nietBegonnen}>Stop</button>
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
