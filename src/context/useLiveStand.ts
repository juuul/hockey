import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HerstelPogingen, automatischHerstellen, verzoekMetTimeout } from '../herstel'
import { pb } from '../server'
import { lees, OPSLAG, schrijf } from '../opslag'
import { isStand, maakStand, Stand, toestelId } from '../live'

export interface LiveStatus {
  verbonden: boolean // realtime aan en laatste actie gelukt
  wachtend: boolean // eigen wijziging nog niet op de server
}

export interface LiveStand {
  status: LiveStatus
  ververs: () => Promise<void>
  // De stand die gelijk is aan de server (of null): nieuwe spelers uit de spelerslijst nemen hieruit hun plek over
  bekend: () => Stand | null
}

interface Props {
  teamId: string | null
  prefix: string
  stand: Stand
  toepassen: (stand: Stand) => void
  magBewerken: boolean
}

// Laatste schrijver wint. 'laatst' is de stand (als JSON) die gelijk is aan de server; wijkt de app daarvan af,
// dan is er een eigen wijziging die verstuurd moet worden. Een ontvangen stand wordt alleen toegepast als de
// app geen onverzonden eigen wijziging heeft (die gaat dan juist over de ontvangen stand heen).
export function useLiveStand({ teamId, prefix, stand, toepassen, magBewerken }: Props): LiveStand {
  const json = JSON.stringify(maakStand(stand))
  const jsonRef = useRef(json)
  jsonRef.current = json
  const laatst = useRef<string>(lees(prefix, 'live_laatst', ''))
  // De stand zoals hij echt op de server staat. 'laatst' is de app-stand die daarmee overeenkwam; die kan
  // spelers missen die de app nog niet kende. Nieuwe spelers halen hun plek uit deze serverstand
  const serverJson = useRef<string>(lees(prefix, 'live_server', ''))
  const versie = useRef<number>(lees(prefix, 'live_versie', 0))
  const bron = useRef(toestelId(OPSLAG))
  const toepassenRef = useRef(toepassen)
  toepassenRef.current = toepassen
  const bewerkRef = useRef(magBewerken)
  bewerkRef.current = magBewerken
  // Na toepassen van een ontvangen stand: de eerstvolgende stand van de app is de nieuwe 'gelijk aan server'
  const netOntvangen = useRef(0)
  const bezig = useRef(false)
  const lezend = useRef(false)
  const snelVervolg = useRef<ReturnType<typeof setTimeout>>()
  const leesRef = useRef<(handmatig?: boolean) => Promise<void>>(async () => {})
  const schrijfRef = useRef<(handmatig?: boolean) => Promise<void>>(async () => {})
  const abonneerRef = useRef<(handmatig?: boolean) => Promise<void>>(async () => {})
  const lezen = useMemo(() => new HerstelPogingen(h => { void leesRef.current(h) }), [teamId, prefix])
  const schrijven = useMemo(() => new HerstelPogingen(h => { void schrijfRef.current(h) }), [teamId, prefix])
  const abonnement = useMemo(() => new HerstelPogingen(h => { void abonneerRef.current(h) }), [teamId, prefix])
  const fouten = useRef({ lezen: false, schrijven: false, abonnement: false })
  useEffect(() => {
    lezen.start(); schrijven.start(); abonnement.start()
    return () => { lezen.stop(); schrijven.stop(); abonnement.stop(); clearTimeout(snelVervolg.current) }
  }, [lezen, schrijven, abonnement])

  // Pas versturen na de eerste keer ophalen: een toestel dat nieuw meedoet neemt eerst de lopende wedstrijd over
  const opgehaald = useRef(false)
  // Bij het starten uitgaan van verbinding: anders staat er kort ⚠ op het tandwiel tot de eerste keer ophalen
  const [status, setStatus] = useState<LiveStatus>({ verbonden: true, wachtend: false })

  const verbinding = useCallback((kanaal: keyof typeof fouten.current, goed: boolean) => {
    fouten.current[kanaal] = !goed
    setStatus(s => ({ ...s, verbonden: !Object.values(fouten.current).some(Boolean) }))
  }, [])

  const bewaar = () => {
    schrijf(prefix, 'live_laatst', laatst.current)
    schrijf(prefix, 'live_server', serverJson.current)
    schrijf(prefix, 'live_versie', versie.current)
  }

  const ontvang = useCallback((rec: { stand: unknown; versie: number; bron: string }) => {
    if (!isStand(rec.stand) || rec.versie <= versie.current) return
    versie.current = rec.versie
    serverJson.current = JSON.stringify(maakStand(rec.stand))
    // Nog nooit gelijk geweest met de server ('' ) telt niet als eigen wijziging: dan wint de server
    const vuil = laatst.current !== '' && jsonRef.current !== laatst.current && bewerkRef.current
    if (rec.bron === bron.current || vuil) {
      // Eigen wijziging die terugkomt, of eigen onverzonden wijziging die voorgaat
      if (rec.bron === bron.current) laatst.current = JSON.stringify(maakStand(rec.stand))
      bewaar()
      return
    }
    laatst.current = JSON.stringify(maakStand(rec.stand))
    bewaar()
    if (laatst.current === jsonRef.current) return
    netOntvangen.current = Date.now()
    toepassenRef.current(rec.stand)
  }, [prefix])

  const verstuur = useCallback(async (handmatig = false) => {
    if (!teamId || !bewerkRef.current || !pb.authStore.isValid || bezig.current || !opgehaald.current) return
    // Net een stand ontvangen die nog verwerkt wordt: de app-stand is dan nog de oude en mag niet terug
    if (netOntvangen.current) return
    const nu = jsonRef.current
    if (nu === laatst.current) return
    if (!schrijven.magProberen(handmatig)) return
    bezig.current = true
    let gelukt = false
    const data = { stand: JSON.parse(nu), versie: versie.current + 1, bron: bron.current }
    try {
      try {
        await verzoekMetTimeout(signal => pb.collection('standen').update(teamId, data, { signal }))
      } catch (err) {
        if ((err as { status?: number }).status !== 404) throw err
        await verzoekMetTimeout(signal => pb.collection('standen').create({ id: teamId, team: teamId, ...data }, { signal }))
      }
      if (!schrijven.actief) return
      gelukt = true
      schrijven.gelukt()
      verbinding('schrijven', true)
      versie.current = data.versie
      laatst.current = nu
      serverJson.current = nu
      bewaar()
      setStatus(s => ({ ...s, wachtend: jsonRef.current !== laatst.current }))
    } catch {
      if (!schrijven.actief) return
      schrijven.mislukt()
      verbinding('schrijven', false)
      setStatus(s => ({ ...s, wachtend: true }))
    } finally {
      bezig.current = false
    }
    // Intussen weer iets veranderd: meteen nog een keer
    if (gelukt && schrijven.actief && jsonRef.current !== laatst.current) snelVervolg.current = setTimeout(verstuur, 50)
  }, [teamId, schrijven, verbinding])
  schrijfRef.current = verstuur

  const ophalen = useCallback(async (handmatig = false) => {
    if (!teamId || !pb.authStore.isValid || lezend.current || !lezen.magProberen(handmatig)) return
    lezend.current = true
    void abonneerRef.current(handmatig)
    try {
      const rec = await verzoekMetTimeout(signal => pb.collection('standen').getOne(teamId, { signal }))
      if (!lezen.actief) return
      ontvang(rec as unknown as { stand: unknown; versie: number; bron: string })
      opgehaald.current = true
      lezen.gelukt()
      verbinding('lezen', true)
    } catch (err) {
      if (!lezen.actief) return
      const code = (err as { status?: number }).status
      if (code === 404) {
        opgehaald.current = true
        lezen.gelukt()
        verbinding('lezen', true)
      } else {
        lezen.mislukt()
        verbinding('lezen', false)
      }
    } finally { lezend.current = false }
    await verstuur(handmatig)
  }, [teamId, ontvang, verstuur, lezen, verbinding])
  leesRef.current = ophalen

  // Eigen wijziging: kort wachten (meerdere tikken) en versturen
  useEffect(() => {
    if (!teamId) return
    // De app-stand na het toepassen van een ontvangen stand is de nieuwe 'gelijk aan server'
    if (Date.now() - netOntvangen.current < 1500) {
      netOntvangen.current = 0
      laatst.current = json
      bewaar()
      return
    }
    if (json === laatst.current || !bewerkRef.current) return
    setStatus(s => (s.wachtend ? s : { ...s, wachtend: true }))
    const t = setTimeout(verstuur, 250)
    return () => clearTimeout(t)
  }, [json, teamId, verstuur])

  // Live meeluisteren, en bij terugkomen of weer verbinding de laatste stand ophalen
  useEffect(() => {
    if (!teamId) return
    let af: (() => Promise<void>) | null = null
    let gestopt = false
    let abonneren = false
    const abonneer = async (handmatig = false) => {
      if (gestopt || af || abonneren || !abonnement.magProberen(handmatig)) return
      abonneren = true
      try {
        const f = await pb.collection('standen').subscribe(teamId, e => {
          if (!gestopt && e.action !== 'delete') ontvang(e.record as unknown as { stand: unknown; versie: number; bron: string })
        })
        if (gestopt) { void f().catch(() => {}); return }
        af = f
        abonnement.gelukt()
        verbinding('abonnement', true)
      } catch {
        if (!gestopt) { abonnement.mislukt(); verbinding('abonnement', false) }
      } finally { abonneren = false }
    }
    abonneerRef.current = abonneer
    void ophalen()
    const wakker = () => { if (automatischHerstellen()) void ophalen(true) }
    window.addEventListener('online', wakker)
    document.addEventListener('visibilitychange', wakker)
    const interval = setInterval(() => { if (automatischHerstellen()) void ophalen() }, 30_000)
    return () => {
      gestopt = true
      clearInterval(interval)
      window.removeEventListener('online', wakker)
      document.removeEventListener('visibilitychange', wakker)
      if (af) (af as () => Promise<void>)().catch(() => {})
    }
  }, [teamId, ophalen, ontvang, abonnement, verbinding])

  const bekend = useCallback(() => {
    try {
      return serverJson.current ? (JSON.parse(serverJson.current) as Stand) : null
    } catch {
      return null
    }
  }, [])

  return { status, bekend, ververs: () => ophalen(true) }
}
