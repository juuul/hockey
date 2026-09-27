import { useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { WedstrijdInfo } from '../types'
import type { OpgeslagenStand } from '../context/HockeyContext'
import { vandaag, vindClub, zoekClubs } from '../historie'
import './Modal.css'
import './WedstrijdModal.css'

interface Props {
  titel: string
  start: WedstrijdInfo
  bevestig: string
  clubVerplicht?: boolean
  uitleg?: string
  // Alleen bij een opgeslagen wedstrijd: de stand is dan ook aan te passen, met wie scoorde (zoals op het Dashboard)
  stand?: OpgeslagenStand
  kandidaten?: { id: string; naam: string }[]
  onOpslaan: (info: WedstrijdInfo, tegenstander: string, stand?: OpgeslagenStand) => void
  onClose: () => void
}

// Een nieuwe club wordt pas bij Opslaan echt toegevoegd, zodat je geen losse clubs overhoudt na Annuleren
export default function WedstrijdModal({ titel, start, bevestig, clubVerplicht, uitleg, stand: startStand, kandidaten = [], onOpslaan, onClose }: Props) {
  const { clubs, clubToevoegen } = useHockey()
  const [datum, setDatum] = useState(start.datum ?? vandaag())
  const [thuis, setThuis] = useState(start.thuis)
  const [clubId, setClubId] = useState<string | null>(start.clubId)
  const [nieuweClub, setNieuweClub] = useState<string | null>(null)
  const [zoek, setZoek] = useState('')
  const [stand, setStand] = useState(startStand)
  const [kiesDoelpunt, setKiesDoelpunt] = useState<'erbij' | 'eraf' | null>(null)
  const aantalVan = (id: string | null) => stand?.doelpunten.filter(d => d.spelerId === id).length ?? 0
  // Scorers van deze wedstrijd, voor 'weghalen': per speler (of Onbekend) met aantal
  const scorers = stand
    ? [...new Map(stand.doelpunten.map(d => [d.spelerId, d.spelerId === null ? 'Onbekend' : d.naam])).entries()].map(([id, naam]) => ({ id, naam, aantal: aantalVan(id) }))
    : []
  const doelpuntErbij = (id: string | null, naam: string) => {
    if (stand) setStand({ ...stand, doelpunten: [...stand.doelpunten, { spelerId: id, naam }] })
    setKiesDoelpunt(null)
  }
  const doelpuntEraf = (id: string | null) => {
    if (stand) {
      const i = stand.doelpunten.map(d => d.spelerId).lastIndexOf(id)
      setStand({ ...stand, doelpunten: stand.doelpunten.filter((_, j) => j !== i) })
    }
    setKiesDoelpunt(null)
  }
  // Toetsenbord pas openen na 'Wijzig', niet meteen bij het openen van de pop-up
  const [wijzigt, setWijzigt] = useState(false)

  const gekozenNaam = nieuweClub ?? clubs.find(c => c.id === clubId)?.naam ?? null
  const gevonden = zoekClubs(clubs, zoek)
  const kanNieuw = zoek.trim() !== '' && !vindClub(clubs, zoek)

  const kiesBestaand = (id: string) => {
    setClubId(id)
    setNieuweClub(null)
    setZoek('')
  }
  const kiesNieuw = () => {
    setNieuweClub(zoek.trim())
    setClubId(null)
    setZoek('')
  }

  // Wat nog in het zoekveld staat telt ook: wie een naam typt en meteen Opslaan drukt, verwacht die club
  const getypt = zoek.trim()
  const eindNaam = getypt ? vindClub(clubs, getypt)?.naam ?? getypt : gekozenNaam

  const opslaan = () => {
    const id = getypt ? clubToevoegen(getypt) : nieuweClub ? clubToevoegen(nieuweClub) : clubId
    // Datum van vandaag niet vastzetten: een wedstrijd die je morgen afsluit krijgt dan ook de juiste datum
    const vasteDatum = !start.datum && datum === vandaag() ? null : datum
    onOpslaan({ datum: vasteDatum, clubId: id, thuis }, eindNaam ?? '', stand)
  }

  const kiesGetypt = () => {
    const bestaand = vindClub(clubs, getypt)
    if (bestaand) kiesBestaand(bestaand.id)
    else if (getypt) kiesNieuw()
  }

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{titel}</div>
        <div className="wedstrijd-velden">
          {uitleg && <p className="wedstrijd-uitleg">{uitleg}</p>}

          <label className="wedstrijd-label">
            Datum
            <input type="date" className="modal-input wedstrijd-datum" value={datum} onChange={e => e.target.value && setDatum(e.target.value)} />
          </label>

          <div className="keuze-knoppen" role="radiogroup" aria-label="Thuis of uit">
            {[true, false].map(t => (
              <button key={String(t)} role="radio" aria-checked={thuis === t} className={`keuze-knop ${thuis === t ? 'actief' : ''}`} onClick={() => setThuis(t)}>
                {t ? 'Thuis' : 'Uit'}
              </button>
            ))}
          </div>

          {stand && (
            <>
              <div className="wedstrijd-label">Stand</div>
              <div className="stand-rij">
                <span className="stand-naam">Wij</span>
                <button className="stand-knop" aria-label="Wij een eraf: kies welk doelpunt" disabled={stand.doelpunten.length === 0} onClick={() => setKiesDoelpunt('eraf')}>−</button>
                <span className="stand-getal">{stand.doelpunten.length}</span>
                <button className="stand-knop" aria-label="Wij een erbij: kies wie scoorde" onClick={() => setKiesDoelpunt('erbij')}>+</button>
              </div>
              {scorers.length > 0 && (
                <p className="wedstrijd-uitleg">{scorers.map(sc => `${sc.naam}${sc.aantal > 1 ? ` ${sc.aantal}×` : ''}`).join(', ')}</p>
              )}
              <div className="stand-rij">
                <span className="stand-naam">Zij</span>
                <button className="stand-knop" aria-label="Zij een eraf" disabled={stand.zij === 0} onClick={() => setStand({ ...stand, zij: stand.zij - 1 })}>−</button>
                <span className="stand-getal">{stand.zij}</span>
                <button className="stand-knop" aria-label="Zij een erbij" onClick={() => setStand({ ...stand, zij: stand.zij + 1 })}>+</button>
              </div>
            </>
          )}

          <div className="wedstrijd-label">Tegenstander</div>
          {/* Eén van de twee: de gekozen club, of zoeken/typen. Zo is altijd duidelijk wat er wordt opgeslagen */}
          {gekozenNaam ? (
            <div className="gekozen-club">
              <span className="gekozen-club-naam">{gekozenNaam}</span>
              <button className="gekozen-club-wijzig" onClick={() => { setClubId(null); setNieuweClub(null); setWijzigt(true) }}>Wijzig</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                className="modal-input"
                placeholder={clubs.length ? 'Zoek of typ een club' : 'Naam van de club'}
                value={zoek}
                autoFocus={wijzigt}
                onChange={e => setZoek(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && kiesGetypt()}
                enterKeyHint="done"
              />
              <div className="club-lijst">
                {kanNieuw && (
                  <button className="modal-option nieuw" onClick={kiesNieuw}>
                    <span className="modal-option-name">+ {getypt}</span>
                  </button>
                )}
                {gevonden.map(c => (
                  <button key={c.id} className="modal-option" onClick={() => kiesBestaand(c.id)}>
                    <span className="modal-option-name">{c.naam}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {kiesDoelpunt && (
          <div className="modal show" onClick={() => setKiesDoelpunt(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-title">{kiesDoelpunt === 'erbij' ? 'Wie scoorde?' : 'Welk doelpunt weghalen?'}</div>
              <div className="modal-options">
                {kiesDoelpunt === 'erbij'
                  ? kandidaten.map(k => (
                      <button key={k.id} className="modal-option" onClick={() => doelpuntErbij(k.id, k.naam)}>
                        <span className="modal-option-name">{k.naam}</span>
                        {aantalVan(k.id) > 0 && <span className="modal-option-place">⚽ {aantalVan(k.id)}</span>}
                      </button>
                    ))
                  : scorers.map(sc => (
                      <button key={sc.id ?? 'onbekend'} className="modal-option" onClick={() => doelpuntEraf(sc.id)}>
                        <span className="modal-option-name">{sc.naam}</span>
                        <span className="modal-option-place">⚽ {sc.aantal}</span>
                      </button>
                    ))}
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setKiesDoelpunt(null)}>Annuleren</button>
                {kiesDoelpunt === 'erbij' && <button className="btn btn-primary" onClick={() => doelpuntErbij(null, 'Onbekend')}>Weet ik niet</button>}
              </div>
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" onClick={opslaan} disabled={clubVerplicht && !eindNaam}>{bevestig}</button>
        </div>
      </div>
    </div>
  )
}
