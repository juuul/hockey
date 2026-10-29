import { useEffect, useState } from 'react'
import { ToegangAanvraag } from '../context/AccountContext'
import { appAdres, foutTekst, pb } from '../server'

export function NieuweLeden({ aanvragen, ververs }: { aanvragen: ToegangAanvraag[]; ververs: () => Promise<unknown> }) {
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const beslis = async (id: string, besluit: string) => {
    if (bezig) return
    setBezig(true); setFout('')
    try { await pb.send(`/api/hockey/toegang-id/${id}`, { method: 'POST', body: { besluit } }); await ververs() }
    catch (e) { setFout(foutTekst(e)) }
    finally { setBezig(false) }
  }
  return <div className="account-lijst">
    {aanvragen.map(a => <div key={a.id} className="account-aanvraag">
      <span className="account-regel-naam">{a.naam}</span>
      <span className="account-regel-sub">{a.automatisch ? 'Nieuw aangemeld bij' : 'Wil meekijken bij'} {a.expand?.team?.naam ?? 'dit team'}</span>
      <span className="account-regel-sub">{a.email}</span>
      <div className="account-aanvraag-knoppen">
        <button className="btn btn-primary" disabled={bezig} onClick={() => beslis(a.id, a.automatisch ? 'gezien' : 'kijker')}>{a.automatisch ? 'Bekeken' : 'Toelaten'}</button>
        <button className="btn btn-gevaar" disabled={bezig} onClick={() => beslis(a.id, a.automatisch ? 'blokkeren' : 'af')}>{a.automatisch ? 'Blokkeren' : 'Afwijzen'}</button>
      </div>
    </div>)}
    {fout && <p className="account-melding fout">{fout}</p>}
  </div>
}

export function GeblokkeerdeLeden({ team, ververs, versie = 0 }: { team: string; ververs: () => Promise<unknown>; versie?: number }) {
  const [leden, setLeden] = useState<{ id: string; naam: string; email: string }[]>([])
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const laden = () => pb.collection('teamblokkades').getFullList<{ id: string; naam: string; email: string }>({ filter: pb.filter('team = {:t}', { t: team }), sort: '-created' }).then(setLeden)
  useEffect(() => { laden().catch(e => setFout(foutTekst(e))) }, [team, versie])
  const herstel = async (id: string) => {
    if (bezig) return
    setBezig(true); setFout('')
    try {
      await pb.send(`/api/hockey/teamtoegang/${team}`, { method: 'POST', body: { actie: 'deblokkeren', id, terug: appAdres() } })
      await Promise.all([laden(), ververs()])
    } catch (e) { setFout(foutTekst(e)) }
    finally { setBezig(false) }
  }
  return <>
    <h2 className="section-title">Geblokkeerd ({leden.length})</h2>
    {leden.length === 0 && <p className="account-uitleg">Niemand geblokkeerd.</p>}
    <div className="account-lijst">{leden.map(lid => <div key={lid.id} className="account-aanvraag">
      <span className="account-regel-naam">{lid.naam || lid.email}</span>
      {lid.naam && <span className="account-regel-sub">{lid.email}</span>}
      <button className="btn btn-secondary" disabled={bezig} onClick={() => herstel(lid.id)}>Deblokkeren</button>
    </div>)}</div>
    {fout && <p className="account-melding fout">{fout}</p>}
  </>
}
