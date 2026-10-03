import { useState } from 'react'
import { useAccount } from '../context/AccountContext'
import { foutTekst, haalAanvraagLink, haalKijkLink, rolIn } from '../server'
import { tel } from '../statistiek'
import ResetModal from './ResetModal'
import './DeelKijklink.css'

// Delen van een link van het actieve team:
// - 'kijk': meekijklink (beheerders en kijkers), iedereen met de link kijkt live mee
// - 'aanvraag': aanmeldlink voor ouders (alleen beheerders), ouders vragen toegang aan
const TEKSTEN = {
  kijk: {
    knop: '🔗 Meekijklink delen',
    uitleg: 'Wie de link opent, kijkt live mee zonder account en kan niets wijzigen.',
    deelTekst: (team: string) => `Hoi! Volg ${team} live tijdens de wedstrijd: score, opstelling en wissels 👇`,
    titel: (team: string) => `${team} live`,
    vraag: 'Nieuwe meekijklink?',
    regels: [{ icoon: '🔗', tekst: 'De oude link werkt dan niet meer' }, { icoon: '👀', tekst: 'Wie via de oude link meekijkt, stopt' }],
  },
  aanvraag: {
    knop: '🔗 Aanmeldlink voor ouders delen',
    uitleg: 'Ouders vullen via deze link hun naam, kind en e-mail in en krijgen meteen een uitnodiging als kijker. Jij en de andere beheerders krijgen een mail ter informatie.',
    deelTekst: (team: string) => `Vraag hier je account aan voor ${team} in de hockey-app:`,
    titel: (team: string) => `Account aanvragen ${team}`,
    vraag: 'Nieuwe aanmeldlink?',
    regels: [{ icoon: '🔗', tekst: 'De oude aanmeldlink werkt dan niet meer' }, { icoon: '📨', tekst: 'Al verstuurde aanvragen blijven staan' }],
  },
}

export default function DeelKijklink({ soort = 'kijk' }: { soort?: 'kijk' | 'aanvraag' }) {
  const t = TEKSTEN[soort]
  const { gebruiker, actiefTeam, teamsLaden } = useAccount()
  const [melding, setMelding] = useState<{ tekst: string; fout?: boolean } | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [vernieuwVraag, setVernieuwVraag] = useState(false)
  if (!gebruiker || !actiefTeam) return null
  const rol = rolIn(actiefTeam, gebruiker.id)
  if (!rol && !gebruiker.superadmin) return null
  const beheert = gebruiker.superadmin || rol === 'beheerder'
  if (soort === 'aanvraag' && !beheert) return null

  const deel = async (vernieuw = false) => {
    setBezig(true)
    setMelding(null)
    try {
      const url = soort === 'kijk' ? await haalKijkLink(actiefTeam.id, vernieuw) : await haalAanvraagLink(actiefTeam.id, vernieuw)
      if (vernieuw) teamsLaden().catch(() => {})
      tel(`${soort}link-${vernieuw ? 'vernieuwd' : 'gedeeld'}`)
      const tekst = t.deelTekst(actiefTeam.naam)
      if (navigator.share) {
        try {
          await navigator.share({ title: t.titel(actiefTeam.naam), text: tekst, url })
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
      <button className="btn btn-primary" onClick={() => deel()} disabled={bezig}>{t.knop}</button>
      <p className="kijklink-uitleg">{t.uitleg}</p>
      {melding && <p className={`kijklink-melding ${melding.fout ? 'fout' : ''}`} role="status">{melding.tekst}</p>}
      {link && <input className="modal-input kijklink-adres" readOnly value={link} onFocus={e => e.target.select()} />}
      {beheert && <button className="btn btn-secondary" onClick={() => setVernieuwVraag(true)} disabled={bezig}>Nieuwe link maken</button>}
      {vernieuwVraag && (
        <ResetModal
          titel={t.vraag}
          regels={t.regels}
          bevestig="Ja, nieuwe link"
          onConfirm={() => { setVernieuwVraag(false); deel(true) }}
          onCancel={() => setVernieuwVraag(false)}
        />
      )}
    </div>
  )
}
