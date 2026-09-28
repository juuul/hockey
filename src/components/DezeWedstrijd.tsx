import { useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { datumTekst } from '../historie'
import { tel } from '../statistiek'
import WedstrijdModal from './WedstrijdModal'
import './DezeWedstrijd.css'

// De lopende wedstrijd (tabblad Historie): tegenstander, stand, scorers en afsluiten
export default function DezeWedstrijd() {
  const { spelers, score, doelpunten, clubs, wedstrijd, zetWedstrijd, wedstrijdAfsluiten, magBeheren: magBewerken, programma } = useHockey()
  const uitProgramma = programma.find(p => p.id === wedstrijd.programmaId)
  const [vraag, setVraag] = useState<'gegevens' | 'afsluiten' | null>(null)
  const tegenstander = clubs.find(c => c.id === wedstrijd.clubId)?.naam

  const scorers = Object.entries(
    doelpunten.reduce<Record<string, number>>((perNaam, id) => {
      const naam = spelers.find(s => s.id === id)?.naam ?? 'Onbekend'
      return { ...perNaam, [naam]: (perNaam[naam] ?? 0) + 1 }
    }, {})
  ).map(([naam, aantal]) => ({ naam, aantal })).sort((a, b) => b.aantal - a.aantal)

  return (
    <section className="deze-wedstrijd">
      <h2 className="section-title">Deze wedstrijd</h2>
      <button className="wedstrijd-kaart" onClick={() => setVraag('gegevens')} disabled={!magBewerken}>
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
      {magBewerken && <button className="btn btn-primary" onClick={() => setVraag('afsluiten')}>Wedstrijd afsluiten</button>}

      {vraag === 'gegevens' && (
        <WedstrijdModal
          titel="Wedstrijd"
          start={wedstrijd}
          bevestig="Opslaan"
          onOpslaan={info => { zetWedstrijd({ ...info, programmaId: wedstrijd.programmaId }); tel('wedstrijd-gegevens'); setVraag(null) }}
          onClose={() => setVraag(null)}
        />
      )}
      {vraag === 'afsluiten' && (
        <WedstrijdModal
          titel={`Afsluiten: ${score.wij} – ${score.zij}`}
          start={wedstrijd}
          bevestig="Opslaan"
          clubVerplicht
          uitleg="Daarna begint een nieuwe wedstrijd: nieuwe opstelling, wissels en score op 0, timer 0:00."
          onOpslaan={(info, naam) => { wedstrijdAfsluiten(info, naam); tel('wedstrijd-afgesloten'); setVraag(null) }}
          onClose={() => setVraag(null)}
        />
      )}
    </section>
  )
}
