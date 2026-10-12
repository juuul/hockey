import { useEffect, useState } from 'react'
import { pb, foutTekst } from '../server'
interface Document { id: string; naam: string; seizoen: string; url: string; geaccepteerd: string | null; laatste: string | null; gecontroleerd: string | null; fout: string | null; versies: { sha: string; gevonden: string; status: string }[] }
interface Status { bijgewerkt: string | null; documenten: Document[]; wachtendeMails: number }
export default function PlanningDocumenten() {
  const [data, setData] = useState<Status | null>(null)
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const laden = async () => {
    setBezig(true); setFout('')
    try { setData(await pb.send('/api/hockey/planning/documenten', { method: 'GET' })) }
    catch (e) { setFout(foutTekst(e)) }
    finally { setBezig(false) }
  }
  useEffect(() => { void laden() }, [])
  return <section className="instellingen-kaart">
    <h2 className="instellingen-kaart-titel">Planningsdocumenten</h2>
    <p className="account-uitleg">Dagelijks om 03:00 gecontroleerd. Nieuwe bestanden worden gemeld per mail en wachten op handmatige beoordeling in de GPT-app.</p>
    {data?.bijgewerkt && <p className="account-uitleg">Laatste controle: {new Date(data.bijgewerkt).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}</p>}
    {!!data?.wachtendeMails && <p role="alert">{data.wachtendeMails} mailmelding(en) wachten op verzending.</p>}
    {data?.documenten.map(d => <div key={d.id} className="account-uitleg">
      <strong>{d.naam} · {d.seizoen}</strong>
      <p>{d.fout ? 'Controle mislukt; bestaande planning behouden' : !d.laatste ? 'Nog niet gecontroleerd' : d.laatste !== d.geaccepteerd ? 'Nieuwe versie — handmatig beoordelen' : 'Geen nieuwe versie'}</p>
      <a className="btn btn-secondary" href={d.url} target="_blank" rel="noreferrer">Open brondocument</a>
      {d.laatste && d.laatste !== d.geaccepteerd && <p>Vraag hier in de GPT-app om document {d.id} te beoordelen. Versie: {d.laatste.slice(0, 12)}.</p>}
    </div>)}
    {data && !data.documenten.length && <p>Nog geen controles geregistreerd.</p>}
    {fout && <p className="account-melding fout" role="alert">{fout}</p>}
    <button className="btn btn-secondary" disabled={bezig} onClick={laden}>{bezig ? 'Laden…' : 'Status verversen'}</button>
  </section>
}
