import { RefObject, useEffect, useRef, useState } from 'react'
import './Verversen.css'

const DREMPEL = 90

// Eigen "trek omlaag om te verversen": html/body scrollen niet (alleen .content), dus het browsergebaar werkt hier niet
export default function Verversen({ scrollVak, onVervers }: { scrollVak: RefObject<HTMLElement>; onVervers: () => Promise<unknown> }) {
  const [afstand, setAfstand] = useState(0)
  const [laden, setLaden] = useState(false)
  const actie = useRef(onVervers)
  actie.current = onVervers
  const bezig = useRef(false)

  useEffect(() => {
    const vak = scrollVak.current
    if (!vak) return
    let startY: number | null = null
    let startX = 0
    let huidig = 0
    let gestopt = false
    let scrollVakken: HTMLElement[] = []

    const invoerOpen = () => !!document.querySelector('.modal.show, .reset-modal-overlay, dialog[open]') || !!document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')
    const annuleer = () => {
      startY = null
      huidig = 0
      setAfstand(0)
    }

    const start = (e: TouchEvent) => {
      annuleer()
      const interactief = (e.target as Element).closest('button, a, input, textarea, select, label, [contenteditable="true"]')
      scrollVakken = [vak]
      for (let el = e.target as HTMLElement; el && el !== vak; el = el.parentElement!) {
        if (el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY)) scrollVakken.push(el)
      }
      if (bezig.current || invoerOpen() || interactief || e.touches.length !== 1 || scrollVakken.some(el => el.scrollTop > 0)) return
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
    }
    const beweeg = (e: TouchEvent) => {
      if (startY === null) return
      if (invoerOpen() || e.touches.length !== 1 || scrollVakken.some(el => el.scrollTop > 0)) return annuleer()
      const dy = e.touches[0].clientY - startY
      const dx = Math.abs(e.touches[0].clientX - startX)
      if (dy < -8 || dx > Math.max(16, dy)) return annuleer()
      huidig = Math.max(0, dy * 0.5)
      setAfstand(huidig)
    }
    const eind = () => {
      if (startY !== null && huidig >= DREMPEL && !invoerOpen()) {
        setLaden(true)
        bezig.current = true
        // Alleen gegevens bijwerken: behoud dezelfde scherm-/formuliernodes en scrollpositie.
        void Promise.resolve().then(() => actie.current()).catch(() => {}).finally(() => {
          bezig.current = false
          if (!gestopt) { setLaden(false); annuleer() }
        })
      } else {
        setAfstand(0)
      }
      startY = null
      huidig = 0
    }

    vak.addEventListener('touchstart', start, { passive: true })
    vak.addEventListener('touchmove', beweeg, { passive: true })
    vak.addEventListener('touchend', eind)
    vak.addEventListener('touchcancel', annuleer)
    return () => {
      gestopt = true
      vak.removeEventListener('touchstart', start)
      vak.removeEventListener('touchmove', beweeg)
      vak.removeEventListener('touchend', eind)
      vak.removeEventListener('touchcancel', annuleer)
    }
  }, [scrollVak])

  if (!laden && afstand < 4) return null
  const zichtbaar = laden ? DREMPEL : Math.min(afstand, DREMPEL + 20)
  const klaar = laden || afstand >= DREMPEL
  return (
    <div
      className={`verversen ${klaar ? 'klaar' : ''} ${laden ? 'laden' : ''}`}
      style={{ transform: `translate(-50%, ${zichtbaar * 0.8}px)`, opacity: Math.min(1, zichtbaar / (DREMPEL * 0.6)) }}
      role="status"
      aria-label={laden ? 'Verversen' : klaar ? 'Loslaten om te verversen' : 'Trek verder om te verversen'}
    >
      <svg
        className="verversen-pijl"
        style={laden ? undefined : { transform: `rotate(${zichtbaar * 3}deg)` }}
        viewBox="0 0 24 24"
        width="26"
        height="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v5h-5" />
      </svg>
    </div>
  )
}
