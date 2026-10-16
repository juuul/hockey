import { useState } from 'react'
import { useAccount } from '../context/AccountContext'
import { foutTekst, haalAanvraagLink, haalKijkLink, rolIn } from '../server'
import { tel } from '../statistiek'
import ResetModal from './ResetModal'
import './DeelKijklink.css'

// Delen van een link van het actieve team:
// - 'kijk': teamlink (beheerders en kijkers), toegang blijft afhankelijk van goedkeuring
// - 'aanvraag': aanmeldlink voor ouders (alleen beheerders), ouders vragen toegang aan
const TEKSTEN = {
  kijk: {
    knop: '🔗 Teamlink delen',
    uitleg: 'Via deze link vraag je toegang aan. De beheerder keurt de aanvraag goed voordat je kunt meekijken.',
    vraag: 'Nieuwe meekijklink?',
    regels: [{ icoon: '🔗', tekst: 'De oude link werkt dan niet meer' }, { icoon: '👀', tekst: 'Goedgekeurde leden behouden hun toegang' }],
  },
  aanvraag: {
    knop: '🔗 Aanmeldlink voor ouders delen',
    uitleg: 'Via deze link vragen ouders en begeleiders toegang aan. Jij keurt de aanvragen goed voordat zij een uitnodiging ontvangen.',
    vraag: 'Nieuwe aanmeldlink?',
    regels: [{ icoon: '🔗', tekst: 'De oude aanmeldlink werkt dan niet meer' }, { icoon: '📨', tekst: 'Al verstuurde aanvragen blijven staan' }],
  },
}

export default function DeelKijklink({ soort = 'kijk', compact = false }: { soort?: 'kijk' | 'aanvraag'; compact?: boolean }) {
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
      if (navigator.share) {
        try {
          await navigator.share({ url })
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
    <div className={`kijklink${compact ? ' kijklink-compact' : ''}`}>
      <button className={compact ? 'instellingen-menuregel' : 'btn btn-primary'} onClick={() => deel()} disabled={bezig}>{compact ? <><span>Teamlink delen</span><span aria-hidden="true">↗</span></> : t.knop}</button>
      {!compact && <p className="kijklink-uitleg">{t.uitleg}</p>}
      {melding && <p className={`kijklink-melding ${melding.fout ? 'fout' : ''}`} role="status">{melding.tekst}</p>}
      {link && <input className="modal-input kijklink-adres" readOnly value={link} onFocus={e => e.target.select()} />}
      {beheert && !compact && <button className="btn btn-secondary" onClick={() => setVernieuwVraag(true)} disabled={bezig}>Nieuwe link maken</button>}
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
