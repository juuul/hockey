import { OPSLAG } from './opslag'

const SLEUTEL = `${OPSLAG}_scroll_na_update`
const invoerOpen = () => !!document.querySelector('.modal.show, .reset-modal-overlay, dialog[open]') || !!document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')

export function assetVersie(doc: Document, basis: string): string {
  return [...doc.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[type="module"][src], link[rel="stylesheet"][href]')]
    .map(el => new URL(el.getAttribute('src') || el.getAttribute('href')!, basis).pathname)
    .filter(pad => pad.includes('/assets/')).sort().join('|')
}

export async function verversAppVersie(vak: HTMLElement): Promise<void> {
  const huidig = assetVersie(document, location.href)
  if (!huidig) return // Lokale ontwikkelserver gebruikt geen gepubliceerde assetnamen.
  const url = new URL(location.href)
  url.hash = ''
  url.searchParams.set('v', String(Date.now()))
  const antwoord = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!antwoord.ok) return
  const doc = new DOMParser().parseFromString(await antwoord.text(), 'text/html')
  const nieuw = assetVersie(doc, url.href)
  if (!nieuw || nieuw === huidig || invoerOpen()) return
  const posities = [vak, ...vak.querySelectorAll<HTMLElement>('*')].filter(el => el.scrollTop > 0).map(el => {
    const stappen: number[] = []
    for (let node = el; node !== vak; node = node.parentElement!) stappen.unshift([...node.parentElement!.children].indexOf(node))
    return { stappen, top: el.scrollTop }
  })
  try { sessionStorage.setItem(SLEUTEL, JSON.stringify({ tijd: Date.now(), posities })) } catch { /* Geen opslag. */ }
  location.replace(url.href)
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
