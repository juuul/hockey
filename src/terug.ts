import { useEffect, useRef } from 'react'

// Terugknop van de telefoon: eerst een open pop-up sluiten, dan een subscherm verlaten, dan naar het Dashboard;
// pas daarna verlaat je de app. Zolang er iets terug te doen is, staat er één extra regel in de browsergeschiedenis.
// Terug haalt die regel weg (popstate) en voert de bovenste (laatst geopende) actie uit.
const stapel: { id: number; actie: () => void }[] = []
let volgnummer = 0
let extraRegel = false
let negeerPop = false

function bijwerken() {
  if (stapel.length && !extraRegel) {
    history.pushState({ hockeyTerug: true }, '')
    extraRegel = true
  } else if (!stapel.length && extraRegel) {
    // Via de app zelf terug (bv. Annuleren): de extra regel weer weghalen, zonder dat dat als terug telt
    extraRegel = false
    negeerPop = true
    history.back()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (negeerPop) {
      negeerPop = false
      return
    }
    if (!extraRegel) return
    extraRegel = false
    const boven = stapel[stapel.length - 1]
    boven?.actie()
    // Na de render: is er nog iets terug te doen, dan opnieuw een extra regel
    setTimeout(bijwerken, 0)
  })
}

// actief = er is iets terug te doen (pop-up open, subscherm, ander tabblad); actie = wat terug doet
export function useTerug(actief: boolean, actie: () => void) {
  const actieRef = useRef(actie)
  actieRef.current = actie
  useEffect(() => {
    if (!actief) return
    const id = ++volgnummer
    stapel.push({ id, actie: () => actieRef.current() })
    bijwerken()
    return () => {
      const i = stapel.findIndex(x => x.id === id)
      if (i >= 0) stapel.splice(i, 1)
      setTimeout(bijwerken, 0)
    }
  }, [actief])
}
