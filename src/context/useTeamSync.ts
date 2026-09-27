import { useCallback, useEffect, useRef, useState } from 'react'
import { pb } from '../server'
import { lees, schrijf } from '../opslag'
import { acties, Alles, GeenVerbinding, LEEG, SOORTEN, synchroniseer, Verwijderd } from '../sync'

export interface SyncStatus {
  geladen: boolean // minstens één keer van de server opgehaald
  wachtend: number // lokale wijzigingen die nog niet op de server staan
  offline: boolean
  fout: string | null
  serverLeeg: boolean // het team heeft op de server nog geen spelers, clubs of wedstrijden
}


interface Props {
  teamId: string | null
  prefix: string
  records: Alles
  toepassen: (samengevoegd: Alles) => void
  verwijderd: Verwijderd
  verwijderdVerwerkt: (verwerkt: Verwijderd) => void
}

// Offline eerst: de app werkt altijd op de lokale gegevens; deze hook stuurt verschillen door en haalt de serverstand op.
// 'basis' (wat de server de vorige keer had) wordt bewaard, zodat ook na herstarten duidelijk is wat nog verstuurd moet worden.
export function useTeamSync({ teamId, prefix, records, toepassen, verwijderd, verwijderdVerwerkt }: Props): { status: SyncStatus; nuSynchroniseren: () => void } {
  const [status, setStatus] = useState<SyncStatus>({ geladen: false, wachtend: 0, offline: false, fout: null, serverLeeg: false })
  const recordsRef = useRef(records)
  recordsRef.current = records
  const toepassenRef = useRef(toepassen)
  toepassenRef.current = toepassen
  const verwijderdRef = useRef(verwijderd)
  verwijderdRef.current = verwijderd
  const verwerktRef = useRef(verwijderdVerwerkt)
  verwerktRef.current = verwijderdVerwerkt
  const basisRef = useRef<Alles>(lees(prefix, 'basis', LEEG))
  const bezig = useRef(false)
  const nogEens = useRef(false)

  const sync = useCallback(async () => {
    if (!teamId || !pb.authStore.isValid) return
    if (bezig.current) {
      nogEens.current = true
      return
    }
    bezig.current = true
    try {
      do {
        nogEens.current = false
        const uit = await synchroniseer(pb, teamId, () => recordsRef.current, basisRef.current, verwijderdRef.current)
        basisRef.current = uit.basis
        schrijf(prefix, 'basis', uit.basis)
        toepassenRef.current(uit.samengevoegd)
        // De app-state is pas na de volgende render bijgewerkt. Tot die tijd geldt het samengevoegde resultaat als
        // 'lokaal'; anders ziet een volgende ronde (nogEens) de nieuwe serverrecords als lokaal verwijderd en wist ze
        recordsRef.current = uit.samengevoegd
        if (SOORTEN.some(s => uit.verwerkt[s].length)) {
          verwerktRef.current(uit.verwerkt)
          verwijderdRef.current = {
            spelers: verwijderdRef.current.spelers.filter(id => !uit.verwerkt.spelers.includes(id)),
            clubs: verwijderdRef.current.clubs.filter(id => !uit.verwerkt.clubs.includes(id)),
            wedstrijden: verwijderdRef.current.wedstrijden.filter(id => !uit.verwerkt.wedstrijden.includes(id)),
          }
        }
        setStatus({ geladen: true, wachtend: uit.wachtend, offline: false, fout: null, serverLeeg: uit.serverLeeg })
      } while (nogEens.current)
    } catch (err) {
      const offline = err instanceof GeenVerbinding
      setStatus(s => ({
        ...s,
        offline,
        fout: offline ? null : String((err as Error).message ?? err),
        wachtend: acties(recordsRef.current, basisRef.current, verwijderdRef.current).length,
      }))
    } finally {
      bezig.current = false
    }
  }, [teamId, prefix])

  // Lokale wijziging: even wachten (meerdere tikken achter elkaar) en dan versturen
  const vingerafdruk = JSON.stringify(records) + JSON.stringify(verwijderd)
  useEffect(() => {
    if (!teamId) return
    const wachtend = acties(recordsRef.current, basisRef.current, verwijderdRef.current).length
    setStatus(s => (s.wachtend === wachtend ? s : { ...s, wachtend }))
    const t = setTimeout(sync, 800)
    return () => clearTimeout(t)
  }, [vingerafdruk, teamId, sync])

  // Wijzigingen van anderen live binnenhalen, en opnieuw proberen bij verbinding of terugkeren naar de app
  useEffect(() => {
    if (!teamId) return
    let t: ReturnType<typeof setTimeout> | undefined
    const straks = () => {
      clearTimeout(t)
      t = setTimeout(sync, 300)
    }
    const afmelden: (() => Promise<void>)[] = []
    let gestopt = false
    for (const soort of SOORTEN) {
      pb.collection(soort)
        .subscribe('*', straks, { filter: pb.filter('team = {:team}', { team: teamId }) })
        .then(af => { if (gestopt) af().catch(() => {}); else afmelden.push(af) })
        .catch(() => {})
    }
    const zichtbaar = () => { if (document.visibilityState === 'visible') straks() }
    window.addEventListener('online', straks)
    document.addEventListener('visibilitychange', zichtbaar)
    const interval = setInterval(sync, 60_000)
    return () => {
      gestopt = true
      clearTimeout(t)
      clearInterval(interval)
      window.removeEventListener('online', straks)
      document.removeEventListener('visibilitychange', zichtbaar)
      afmelden.forEach(af => af().catch(() => {}))
    }
  }, [teamId, sync])

  return { status, nuSynchroniseren: sync }
}
