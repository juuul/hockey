// Eén hersteltimer per kanaal. Nieuwe gebeurtenissen mogen een foutpauze niet omzeilen.
const WACHTTIJDEN = [5_000, 10_000, 20_000, 30_000, 60_000]
export interface HerstelKlok {
  nu: () => number
  zet: (actie: () => void, ms: number) => ReturnType<typeof setTimeout>
  wis: (id: ReturnType<typeof setTimeout>) => void
}
const klok: HerstelKlok = { nu: Date.now, zet: (f, ms) => setTimeout(f, ms), wis: id => clearTimeout(id) }
export const automatischHerstellen = () => typeof document === 'undefined' || (document.visibilityState !== 'hidden' && navigator.onLine !== false)

export class HerstelPogingen {
  actief = true
  private aantal = 0
  private vanaf = 0
  private laatste = -Infinity
  private timer: ReturnType<typeof setTimeout> | undefined
  private gepland = Infinity
  constructor(private actie: (handmatig: boolean) => void, private magAutomatisch = automatischHerstellen, private tijd: HerstelKlok = klok) {}
  start() { this.actief = true }
  stop() { this.actief = false; this.wis() }
  private wis() { if (this.timer !== undefined) this.tijd.wis(this.timer); this.timer = undefined; this.gepland = Infinity }
  private plan(vanaf: number, handmatig = false) {
    if (!this.actief || vanaf >= this.gepland) return
    this.wis(); this.gepland = vanaf
    this.timer = this.tijd.zet(() => {
      this.timer = undefined; this.gepland = Infinity
      if (this.actief && (handmatig || this.magAutomatisch())) this.actie(handmatig)
    }, Math.max(0, vanaf - this.tijd.nu()))
  }
  magProberen(handmatig = false) {
    if (!this.actief || (!handmatig && this.aantal > 0 && !this.magAutomatisch())) return false
    const vanaf = handmatig ? this.laatste + 2_000 : this.vanaf
    if (this.tijd.nu() < vanaf) { this.plan(vanaf, handmatig); return false }
    this.wis(); this.laatste = this.tijd.nu()
    return true
  }
  mislukt() {
    this.vanaf = this.tijd.nu() + WACHTTIJDEN[Math.min(this.aantal++, WACHTTIJDEN.length - 1)]
    this.plan(this.vanaf)
  }
  gelukt() { this.aantal = 0; this.vanaf = 0; this.wis() }
}

// Een vastgelopen aanvraag mag het herstellen niet onbeperkt blokkeren. De echte fetch wordt afgebroken.
export async function verzoekMetTimeout<T>(actie: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try { return await actie(controller.signal) } finally { clearTimeout(timer) }
}
