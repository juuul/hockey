import { useState } from 'react'
import { foutTekst, pb } from '../server'

export default function EmailBevestigen({ token, klaar }: { token: string; klaar: () => void }) {
  const [bezig, setBezig] = useState(false)
  const [bevestigd, setBevestigd] = useState(false)
  const [fout, setFout] = useState('')
  const bevestig = async () => {
    if (bezig || bevestigd) return
    setBezig(true); setFout('')
    try {
      await pb.collection('users').confirmVerification(token)
      setBevestigd(true)
      // De bevestiging is al opgeslagen; een tijdelijke refreshfout maakt die niet ongedaan.
      if (pb.authStore.isValid) await pb.collection('users').authRefresh().catch(() => {})
    } catch (e) {
      setFout(`Bevestigen is niet gelukt. ${foutTekst(e)} Is de link verlopen of al gebruikt? Vraag dan een nieuwe bevestigingsmail.`)
    } finally { setBezig(false) }
  }
  return <section className="account-form">
    {bevestigd ? <>
      <p className="account-melding" role="status">Je e-mailadres is bevestigd. Je kunt nu een nieuw team starten. Log zo nodig in met je bestaande wachtwoord.</p>
      <button className="btn btn-primary" onClick={klaar}>Verder naar de app</button>
    </> : <>
      <p className="account-uitleg">Bevestig dat dit e-mailadres van jou is om een nieuw team te kunnen starten.</p>
      <button className="btn btn-primary" disabled={bezig} onClick={bevestig}>{bezig ? 'Bevestigen…' : 'E-mailadres bevestigen'}</button>
      {fout && <p className="account-melding fout" role="alert">{fout}</p>}
    </>}
  </section>
}
