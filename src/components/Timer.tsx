import { useEffect, useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import ResetModal from './ResetModal'
import { tel } from '../statistiek'
import { deelNaam, faseVan, SCHEMA, voortgang } from '../speelduur'
import './Timer.css'

function formatteer(ms: number) {
  const totaal = Math.floor(ms / 1000)
  const min = Math.floor(totaal / 60)
  const sec = totaal % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export default function Timer() {
  const { timer: stand, startTimer, pauzeTimer, stopTimer, magBewerken } = useHockey()
  const [nu, setNu] = useState(Date.now())
  const [stopVraag, setStopVraag] = useState(false)
  const loopt = stand.gestartOp !== null

  useEffect(() => {
    if (!loopt) return
    setNu(Date.now())
    const id = setInterval(() => setNu(Date.now()), 250)
    return () => clearInterval(id)
  }, [loopt])

  const verstreken = stand.opgebouwd + (loopt ? nu - stand.gestartOp! : 0)
  // Kwart, pauze of rust volgt vanzelf uit de verstreken tijd. Pauze/rust telt af (naar boven afgerond)
  const fase = faseVan(verstreken)
  const inPauze = !!fase.deel && fase.deel.soort !== 'kwart'
  const groot = !fase.deel ? formatteer(verstreken) : inPauze ? formatteer(fase.nog + 999) : formatteer(fase.inDeel)
  const rechts = !fase.deel ? 'totaal' : inPauze ? `daarna ${fase.deel.kwart}e kwart` : `nog ${formatteer(fase.nog + 999)}`
  const delen = voortgang(verstreken)

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
        <span className="timer-deel">{deelNaam(fase.deel)}</span>
        <span className="timer-nog">{rechts}</span>
      </div>
      <div className="timer-tijd" aria-live="off">{groot}</div>
      <div className="timer-balk" aria-hidden="true">
        {SCHEMA.map((d, i) => (
          <div key={i} className={`timer-seg ${d.soort}`} style={{ flexGrow: d.lengte }}>
            <i style={{ width: `${delen[i] * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="timer-labels" aria-hidden="true">
        {SCHEMA.map((d, i) => <span key={i} style={{ flexGrow: d.lengte }}>{d.soort === 'kwart' ? d.kwart : d.soort === 'rust' ? 'rust' : ''}</span>)}
      </div>
      {magBewerken && <div className="timer-knoppen">
        <button className="btn timer-start" onClick={start} disabled={loopt}>Start</button>
        <button className="btn btn-secondary" onClick={pauze} disabled={!loopt}>Pauze</button>
        <button className="btn btn-secondary" onClick={() => setStopVraag(true)} disabled={!loopt && verstreken === 0}>Stop</button>
      </div>}

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
