import { useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { WedstrijdInfo } from '../types'
import { vandaag, vindClub, zoekClubs } from '../historie'
import './Modal.css'
import './WedstrijdModal.css'

interface Props {
  titel: string
  start: WedstrijdInfo
  bevestig: string
  clubVerplicht?: boolean
  uitleg?: string
  // Alleen bij een opgeslagen wedstrijd: de stand is dan ook aan te passen
  stand?: { wij: number; zij: number }
  onOpslaan: (info: WedstrijdInfo, tegenstander: string, stand?: { wij: number; zij: number }) => void
  onClose: () => void
}

// Een nieuwe club wordt pas bij Opslaan echt toegevoegd, zodat je geen losse clubs overhoudt na Annuleren
export default function WedstrijdModal({ titel, start, bevestig, clubVerplicht, uitleg, stand: startStand, onOpslaan, onClose }: Props) {
  const { clubs, clubToevoegen } = useHockey()
  const [datum, setDatum] = useState(start.datum ?? vandaag())
  const [thuis, setThuis] = useState(start.thuis)
  const [clubId, setClubId] = useState<string | null>(start.clubId)
  const [nieuweClub, setNieuweClub] = useState<string | null>(null)
  const [zoek, setZoek] = useState('')
  const [stand, setStand] = useState(startStand)
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
              {(['wij', 'zij'] as const).map(kant => (
                <div key={kant} className="stand-rij">
                  <span className="stand-naam">{kant === 'wij' ? 'Wij' : 'Zij'}</span>
                  <button className="stand-knop" aria-label={`${kant === 'wij' ? 'Wij' : 'Zij'} een eraf`} disabled={stand[kant] === 0} onClick={() => setStand({ ...stand, [kant]: stand[kant] - 1 })}>−</button>
                  <span className="stand-getal">{stand[kant]}</span>
                  <button className="stand-knop" aria-label={`${kant === 'wij' ? 'Wij' : 'Zij'} een erbij`} onClick={() => setStand({ ...stand, [kant]: stand[kant] + 1 })}>+</button>
                </div>
              ))}
              {stand.wij > (startStand?.wij ?? 0) && <p className="wedstrijd-uitleg">Extra doelpunten tellen mee als "Onbekend" bij de scorers.</p>}
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
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" onClick={opslaan} disabled={clubVerplicht && !eindNaam}>{bevestig}</button>
        </div>
      </div>
    </div>
  )
}
