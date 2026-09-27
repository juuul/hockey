import { useState } from 'react'
import { useAccount } from '../context/AccountContext'
import { foutTekst, haalKijkLink, rolIn } from '../server'
import { tel } from '../statistiek'
import ResetModal from './ResetModal'
import './DeelKijklink.css'

// Delen van de meekijklink van het actieve team (beheerders en kijkers). Beheerders kunnen een nieuwe maken
export default function DeelKijklink() {
  const { gebruiker, actiefTeam, teamsLaden } = useAccount()
  const [melding, setMelding] = useState<{ tekst: string; fout?: boolean } | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [vernieuwVraag, setVernieuwVraag] = useState(false)
  if (!gebruiker || !actiefTeam) return null
  const rol = rolIn(actiefTeam, gebruiker.id)
  if (!rol && !gebruiker.superadmin) return null
  const beheert = gebruiker.superadmin || rol === 'beheerder'

  const deel = async (vernieuw = false) => {
    setBezig(true)
    setMelding(null)
    try {
      const url = await haalKijkLink(actiefTeam.id, vernieuw)
      if (vernieuw) teamsLaden().catch(() => {})
      tel(vernieuw ? 'kijklink-vernieuwd' : 'kijklink-gedeeld')
      const tekst = `Kijk live mee met ${actiefTeam.naam} (score, opstelling en wissels):`
      if (navigator.share) {
        try {
          await navigator.share({ title: `${actiefTeam.naam} live`, text: tekst, url })
          setBezig(false)
          return
        } catch (err) {
          // Zelf geannuleerd: niets aan de hand. Anders hieronder kopiëren
          if ((err as Error).name === 'AbortError') { setBezig(false); return }
        }
      }
      try {
        await navigator.clipboard.writeText(url)
        setMelding({ tekst: 'Link gekopieerd. Plak hem in een app-bericht of mail.' })
      } catch {
        setLink(url)
        setMelding({ tekst: 'Kopieer de link hieronder:' })
      }
    } catch (err) {
      setMelding({ tekst: foutTekst(err), fout: true })
    }
    setBezig(false)
  }

  return (
    <div className="kijklink">
      <button className="btn btn-primary" onClick={() => deel()} disabled={bezig}>🔗 Meekijklink delen</button>
      <p className="kijklink-uitleg">Wie de link opent, kijkt live mee zonder account en kan niets wijzigen.</p>
      {melding && <p className={`kijklink-melding ${melding.fout ? 'fout' : ''}`} role="status">{melding.tekst}</p>}
      {link && <input className="modal-input kijklink-adres" readOnly value={link} onFocus={e => e.target.select()} />}
      {beheert && <button className="btn btn-secondary" onClick={() => setVernieuwVraag(true)} disabled={bezig}>Nieuwe link maken</button>}
      {vernieuwVraag && (
        <ResetModal
          titel="Nieuwe meekijklink?"
          regels={[
            { icoon: '🔗', tekst: 'De oude link werkt dan niet meer' },
            { icoon: '👀', tekst: 'Wie via de oude link meekijkt, stopt' },
          ]}
          bevestig="Ja, nieuwe link"
          onConfirm={() => { setVernieuwVraag(false); deel(true) }}
          onCancel={() => setVernieuwVraag(false)}
        />
      )}
    </div>
  )
}
