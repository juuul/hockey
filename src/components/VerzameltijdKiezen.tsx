import type { ProgrammaItem } from '../types'
import { verzamelKeuze } from '../verzamelkeuze'
import DatumTijdKiezer from './DatumTijdKiezer'
import './VerzameltijdKiezen.css'

export default function VerzameltijdKiezen({ item, zet, voorstel, bezig }: {
  item: ProgrammaItem; zet: (p: Partial<ProgrammaItem>) => void
  voorstel: { tijd: string; datum: string } | null; bezig: boolean
}) {
  const waarde = verzamelKeuze(item, voorstel)
  const handmatig = waarde.verzamelModus === 'handmatig'
  return <div className="verzameltijd-kiezen">
    <label className="prog-veld">Verzamelen
      <DatumTijdKiezer soort="time" titel="Verzameltijd kiezen" waarde={waarde.verzamelen} optioneel onChange={tijd => zet({
        verzamelModus: 'handmatig', verzamelen: tijd, verzamelDatum: tijd ? waarde.verzamelDatum || item.datum : '',
      })} />
    </label>
    {handmatig ? <>
      <p className="account-uitleg">Zelf ingesteld; blijft behouden.</p>
      <button type="button" className="btn btn-secondary" onClick={() => zet({ verzamelModus: 'automatisch', verzamelen: voorstel?.tijd || '', verzamelDatum: voorstel?.datum || '' })}>Automatisch berekenen</button>
      {waarde.verzamelen && <details>
        <summary>Verzameldag: {waarde.verzamelDatum === item.datum ? 'wedstrijddag' : waarde.verzamelDatum}</summary>
        <DatumTijdKiezer soort="date" waarde={waarde.verzamelDatum} onChange={verzamelDatum => zet({ verzamelDatum })} />
      </details>}
    </> : <p className="account-uitleg" role="status">{bezig ? 'Automatisch berekenen…' : voorstel ? 'Automatisch berekend; tik op de tijd om aan te passen.' : 'Nog niet berekend; je kunt zelf een tijd kiezen.'}</p>}
  </div>
}
