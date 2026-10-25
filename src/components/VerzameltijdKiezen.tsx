import type { ProgrammaItem } from '../types'
import { verzamelKeuze } from '../verzamelkeuze'
import DatumTijdKiezer from './DatumTijdKiezer'
import TijdInvoer from './TijdInvoer'
import './VerzameltijdKiezen.css'

export default function VerzameltijdKiezen({ item, zet, voorstel, bezig }: {
  item: ProgrammaItem; zet: (p: Partial<ProgrammaItem>) => void
  voorstel: { tijd: string; datum: string } | null; bezig: boolean
}) {
  const waarde = verzamelKeuze(item, voorstel)
  const handmatig = waarde.verzamelModus === 'handmatig'
  return <div className="verzameltijd-kiezen">
    <div className="prog-veld">Verzamelen
      <TijdInvoer label="Verzamelen" waarde={handmatig ? item.verzamelen : waarde.verzamelen} onChange={tijd => zet({
        verzamelModus: 'handmatig', verzamelen: tijd, verzamelDatum: tijd ? waarde.verzamelDatum || item.datum : '',
      })} />
    </div>
    {handmatig ? <>
      <p className="account-uitleg">Zelf ingesteld; blijft behouden.</p>
      <button type="button" className="btn btn-secondary" onClick={() => zet({ verzamelModus: 'automatisch', verzamelen: voorstel?.tijd || '', verzamelDatum: voorstel?.datum || '' })}>Automatisch berekenen</button>
      {waarde.verzamelen && <details>
        <summary>Verzameldag: {waarde.verzamelDatum === item.datum ? 'wedstrijddag' : waarde.verzamelDatum}</summary>
        <DatumTijdKiezer soort="date" waarde={waarde.verzamelDatum} onChange={verzamelDatum => zet({ verzamelDatum })} />
      </details>}
    </> : <p className="account-uitleg" role="status">{bezig ? 'Automatisch berekenen…' : voorstel ? 'Automatisch berekend; aanpassen mag.' : 'Nog niet berekend; je kunt zelf een tijd invullen.'}</p>}
  </div>
}
