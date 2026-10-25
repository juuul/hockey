import type { ProgrammaItem } from '../types'
import { officieleAanvang, tijdWaarde } from '../tijdinvoer'
import type { useVerzameltijd } from './useVerzameltijd'
import TijdInvoer from './TijdInvoer'
import VerzameltijdKiezen from './VerzameltijdKiezen'

export default function TijdenVelden({ item, zet, berekening }: {
  item: ProgrammaItem; zet: (p: Partial<ProgrammaItem>) => void; berekening: ReturnType<typeof useVerzameltijd>
}) {
  const bron = officieleAanvang(item)
  return <div className="tijden-velden">
    <div className="prog-veld">Aanvang<TijdInvoer label="Aanvang" waarde={item.spelen} onChange={spelen => zet({ spelen })} /></div>
    {bron !== null && <div className="tijden-bron">
      <p className="account-uitleg">Officiële aanvang: {bron || 'nog niet bekend'}</p>
      {tijdWaarde(item.spelen) !== bron && <button type="button" className="btn btn-secondary" onClick={() => zet({ spelen: bron })}>Herstel officiële tijd</button>}
    </div>}
    <VerzameltijdKiezen item={item} zet={zet} voorstel={berekening.voorstel} bezig={berekening.bezig} />
    {berekening.fout && <p role="alert" className="account-melding fout">{berekening.fout}</p>}
  </div>
}
