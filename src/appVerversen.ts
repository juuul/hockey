import { OPSLAG } from './opslag'

const SLEUTEL = `${OPSLAG}_scroll_na_update`
const invoerOpen = () => !!document.querySelector('.modal.show, .reset-modal-overlay, dialog[open]') || !!document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')

export function assetVersie(doc: Document, basis: string): string {
  return [...doc.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[type="module"][src], link[rel="stylesheet"][href]')]
    .map(el => new URL(el.getAttribute('src') || el.getAttribute('href')!, basis).pathname)
    .filter(pad => pad.includes('/assets/')).sort().join('|')
}

// true betekent: nieuwe versie beschikbaar, maar veilig herladen moet nog wachten.
export async function verversAppVersie(vak: HTMLElement, gegevensKlaar: Promise<unknown> = Promise.resolve(), magHerladen: () => boolean = () => true): Promise<boolean> {
  const huidig = assetVersie(document, location.href)
  if (!huidig) return false // Lokale ontwikkelserver gebruikt geen gepubliceerde assetnamen.
  const url = new URL(location.href)
  url.hash = ''
  url.searchParams.set('v', String(Date.now()))
  const antwoord = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!antwoord.ok) return false
  const doc = new DOMParser().parseFromString(await antwoord.text(), 'text/html')
  const nieuw = assetVersie(doc, url.href)
  if (!nieuw || nieuw === huidig) return false
  // Controleer de versie parallel, maar rond eerst gegevensopslag af vóór echt herladen.
  await gegevensKlaar
  // Laat de sync-status eerst in React renderen voordat de bewaarbeveiliging hem leest.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  if (document.visibilityState !== 'visible' || invoerOpen() || !magHerladen()) return true
  const posities = [vak, ...vak.querySelectorAll<HTMLElement>('*')].filter(el => el.scrollTop > 0).map(el => {
    const stappen: number[] = []
    for (let node = el; node !== vak; node = node.parentElement!) stappen.unshift([...node.parentElement!.children].indexOf(node))
    return { stappen, top: el.scrollTop }
  })
  try { sessionStorage.setItem(SLEUTEL, JSON.stringify({ tijd: Date.now(), posities })) } catch { /* Geen opslag. */ }
  location.replace(url.href)
  return false
}

// Chrome kan een tabblad uit het geheugen/bfcache herstellen zonder de app opnieuw te laden.
// Bundel de bijbehorende events en controleer hoogstens eens per 30 seconden.
export function automatischVerversen(vak: HTMLElement, gegevens: () => Promise<unknown>, magHerladen: () => boolean): () => void {
  let gestopt = false, bezig = false
  let laatst = -Infinity
  let uitgesteld = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const controleer = async () => {
    if (gestopt || bezig || document.visibilityState !== 'visible' || !navigator.onLine) return
    clearTimeout(timer)
    const wacht = 30_000 - (Date.now() - laatst)
    if (wacht > 0) {
      if (uitgesteld) timer = setTimeout(() => { void controleer() }, wacht)
      return
    }
    laatst = Date.now(); bezig = true
    try {
      // Ook bij versiecontrole bestaande gegevens veilig opslaan/synchroniseren.
      let opgeslagen = false
      const klaar = gegevens().then(() => { opgeslagen = true }, () => {})
      uitgesteld = await verversAppVersie(vak, klaar, () => !gestopt && opgeslagen && magHerladen())
      await klaar
    } catch { /* Offline of mislukte controle: de bestaande app blijft bruikbaar. */ }
    finally {
      bezig = false
      if (!gestopt && uitgesteld && document.visibilityState === 'visible') timer = setTimeout(() => { void controleer() }, 30_000)
    }
  }
  const wakker = () => { void controleer() }
  const invoerGesloten = () => { if (uitgesteld) wakker() }
  window.addEventListener('pageshow', wakker)
  window.addEventListener('focus', wakker)
  window.addEventListener('online', wakker)
  document.addEventListener('visibilitychange', wakker)
  document.addEventListener('focusout', invoerGesloten)
  void controleer()
  return () => {
    gestopt = true; clearTimeout(timer)
    window.removeEventListener('pageshow', wakker)
    window.removeEventListener('focus', wakker)
    window.removeEventListener('online', wakker)
    document.removeEventListener('visibilitychange', wakker)
    document.removeEventListener('focusout', invoerGesloten)
  }
}

export function herstelScrollNaUpdate(vak: HTMLElement): () => void {
  let bewaard: { tijd: number; posities: { stappen: number[]; top: number }[] } | null = null
  try { bewaard = JSON.parse(sessionStorage.getItem(SLEUTEL) || 'null'); sessionStorage.removeItem(SLEUTEL) } catch { /* Geen geldige opslag. */ }
  if (!bewaard || Date.now() - bewaard.tijd > 60_000 || !Array.isArray(bewaard.posities)) return () => {}
  let klaar = false
  const herstel = () => {
    if (klaar) return
    for (const { stappen, top } of bewaard!.posities) {
      let el: HTMLElement | undefined = vak
      for (const i of stappen) el = el?.children[i] as HTMLElement | undefined
      if (el) el.scrollTop = top
    }
  }
  const stop = () => { klaar = true; observer.disconnect(); clearTimeout(einde); vak.removeEventListener('touchstart', stop); vak.removeEventListener('wheel', stop); vak.removeEventListener('keydown', stop) }
  const observer = new MutationObserver(herstel)
  observer.observe(vak, { childList: true, subtree: true })
  const einde = setTimeout(stop, 3000)
  vak.addEventListener('touchstart', stop, { passive: true })
  vak.addEventListener('wheel', stop, { passive: true })
  vak.addEventListener('keydown', stop)
  herstel()
  return stop
}
