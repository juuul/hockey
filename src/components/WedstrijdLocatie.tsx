import { navigatieLink } from '../verzamelen'

export default function WedstrijdLocatie({ locatie, adres }: { locatie?: string; adres?: string }) {
  const bestemming = adres?.trim() || ''
  const naam = locatie?.trim() || bestemming || 'Locatie nog niet bekend'
  const inhoud = <><span aria-hidden="true">📍</span><span className="prog-locatie-naam">{naam}</span></>
  return bestemming
    ? <a className="prog-regel prog-locatie" href={navigatieLink(bestemming)} target="_blank" rel="noreferrer" aria-label={`Navigeer naar ${naam}`}>{inhoud}</a>
    : <div className="prog-regel prog-locatie" title="Wedstrijdadres nog niet bekend">{inhoud}</div>
}
