import { useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { datumTekst } from '../historie'
import { tel } from '../statistiek'
import WedstrijdModal from './WedstrijdModal'
import './DezeWedstrijd.css'

// De lopende wedstrijd (tabblad Historie): tegenstander, stand, scorers en afsluiten
export default function DezeWedstrijd() {
  const { spelers, score, doelpunten, clubs, wedstrijd, zetWedstrijd, weerOpenen, magBeheren: magBewerken, programma } = useHockey()
  const isAfgesloten = !!wedstrijd.afgesloten
  const uitProgramma = programma.find(p => p.id === wedstrijd.programmaId)
  const [vraag, setVraag] = useState<'gegevens' | null>(null)
  const tegenstander = clubs.find(c => c.id === wedstrijd.clubId)?.naam

  const scorers = Object.entries(
    doelpunten.reduce<Record<string, number>>((perNaam, id) => {
      const naam = spelers.find(s => s.id === id)?.naam ?? 'Onbekend'
      return { ...perNaam, [naam]: (perNaam[naam] ?? 0) + 1 }
    }, {})
  ).map(([naam, aantal]) => ({ naam, aantal })).sort((a, b) => b.aantal - a.aantal)

  return (
    <section className="deze-wedstrijd">
      <h2 className="section-title">{isAfgesloten ? 'Deze wedstrijd · afgesloten' : 'Deze wedstrijd'}</h2>
      <button className="wedstrijd-kaart" onClick={() => setVraag('gegevens')} disabled={!magBewerken || isAfgesloten}>
        <span className="wedstrijd-kaart-club">{tegenstander ? `Tegen ${tegenstander}` : magBewerken ? 'Kies tegenstander' : 'Tegenstander nog niet gekozen'}</span>
        <span className="wedstrijd-kaart-info">{wedstrijd.thuis ? 'Thuis' : 'Uit'} · {wedstrijd.datum ? datumTekst(wedstrijd.datum) : 'vandaag'}</span>
        {uitProgramma && (uitProgramma.verzamelen || uitProgramma.spelen) && (
          <span className="wedstrijd-kaart-info">
            ⏰ {uitProgramma.verzamelen ? `verzamelen ${uitProgramma.verzamelen}` : ''}{uitProgramma.verzamelen && uitProgramma.spelen ? ' · ' : ''}{uitProgramma.spelen ? `aanvang ${uitProgramma.spelen}` : ''}
          </span>
        )}
      </button>
      <div className="deze-wedstrijd-stand" aria-label={`Stand ${score.wij} tegen ${score.zij}`}>
        <span>Wij</span>
        <span className="deze-wedstrijd-getal">{score.wij} – {score.zij}</span>
        <span>Zij</span>
      </div>
      {scorers.length > 0 && (
        <div className="doelpunten-lijst">
          {scorers.map(({ naam, aantal }) => (
            <span key={naam} className="doelpunt-scorer">⚽ {naam} <strong>{aantal}</strong></span>
          ))}
        </div>
      )}
      {magBewerken && !isAfgesloten && <WedstrijdAfsluitenKnop />}
      {magBewerken && isAfgesloten && <button className="btn btn-secondary" onClick={() => { weerOpenen(); tel('wedstrijd-heropend') }}>Wedstrijd weer openen</button>}

      {vraag === 'gegevens' && (
        <WedstrijdModal
          titel="Wedstrijd"
          start={wedstrijd}
          bevestig="Opslaan"
          onOpslaan={info => { zetWedstrijd({ ...info, programmaId: wedstrijd.programmaId }); tel('wedstrijd-gegevens'); setVraag(null) }}
          onClose={() => setVraag(null)}
        />
      )}
    </section>
  )
}

// Wedstrijd afsluiten (beheerders): op het Dashboard (onder de vouw) en bij Historie → Deze wedstrijd
export function WedstrijdAfsluitenKnop() {
  const { score, wedstrijd, wedstrijdAfsluiten } = useHockey()
  const [vraag, setVraag] = useState<'afsluiten' | null>(null)
  return (
    <>
      <button className="btn btn-primary" onClick={() => setVraag('afsluiten')}>{wedstrijd.bewerkt ? 'Opnieuw afsluiten' : 'Wedstrijd afsluiten'}</button>
      {vraag === 'afsluiten' && (
        <WedstrijdModal
          titel={`${wedstrijd.bewerkt ? 'Opnieuw afsluiten' : 'Afsluiten'}: ${score.wij} – ${score.zij}`}
          start={wedstrijd}
          bevestig="Opslaan"
          clubVerplicht
          uitleg={wedstrijd.bewerkt
            ? 'Overschrijft de wedstrijd die je eerder afsloot. De uitslag blijft vandaag op het Dashboard staan.'
            : 'De wedstrijd wordt opgeslagen. De uitslag blijft vandaag op het Dashboard staan; daarna begint een nieuwe wedstrijd.'}
          onOpslaan={(info, naam) => { wedstrijdAfsluiten(info, naam); tel('wedstrijd-afgesloten'); setVraag(null) }}
          onClose={() => setVraag(null)}
        />
      )}
    </>
  )
}
