import { Player, Position, Wissel } from './types'

function schud<T>(lijst: T[]): T[] {
  const kopie = [...lijst]
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[kopie[i], kopie[j]] = [kopie[j], kopie[i]]
  }
  return kopie
}

// Eerst eerlijk loten wie begint, pas daarna plaatsen: anders zitten spelers met een vaste positie nooit op de bank.
// Eerst krijgt iedereen zo mogelijk zijn 1e keuze, daarna zijn 2e. Door de geschudde volgorde wint bij een dubbele keuze een willekeurige speler.
export function nieuweOpstelling(spelers: Player[], vastePosities: Record<string, string[]>, posities: Position[]): Player[] {
  const geschud = schud(spelers.filter(s => !s.isKeeper && s.meedoen))
  const basis = geschud.slice(0, posities.length)
  const bank = geschud.slice(posities.length)

  const placed = new Map<string, Player>()
  const vrij = [...posities]
  for (const keuze of [0, 1]) {
    basis.filter(s => !placed.has(s.id)).forEach(s => {
      const wens = vastePosities[s.id]?.[keuze] as Position | undefined
      if (wens && vrij.includes(wens)) {
        vrij.splice(vrij.indexOf(wens), 1)
        placed.set(s.id, { ...s, inVeld: true, positie: wens })
      }
    })
  }
  const vrijGeschud = schud(vrij)
  basis.filter(s => !placed.has(s.id)).forEach((s, i) => {
    placed.set(s.id, { ...s, inVeld: true, positie: vrijGeschud[i] })
  })
  bank.forEach(s => placed.set(s.id, { ...s, inVeld: false }))

  return spelers.map(s => placed.get(s.id) ?? (s.meedoen ? s : { ...s, inVeld: false }))
}

// Wie op de bank zit, staat al één keer 'uit' en begint daarom op 1
export function resetTellers(spelers: Player[]): Player[] {
  // Ook de kleuren terug naar groen: niemand telt nog als invaller
  return spelers.map(s => ({ ...s, wisselCount: s.meedoen && !s.inVeld ? 1 : 0, inVolgorde: 0 }))
}

// Een vrijgekomen veldplek wordt gevuld door de meedoende wisselspeler met de minste wissels; het doel blijft leeg (keeper kies je bewust)
export function haalUitVeld(spelers: Player[], id: string): Player[] {
  const speler = spelers.find(s => s.id === id)
  if (!speler?.inVeld) return spelers
  const zonder = spelers.map(s => s.id === id ? { ...s, inVeld: false, isKeeper: false } : s)
  if (speler.isKeeper) return zonder
  const invaller = zonder
    .filter(s => !s.inVeld && s.meedoen && s.id !== id)
    .sort((a, b) => a.wisselCount - b.wisselCount)[0]
  return invaller
    ? zonder.map(s => s.id === invaller.id ? { ...s, inVeld: true, positie: speler.positie } : s)
    : zonder
}

export function zetMeedoen(spelers: Player[], id: string, meedoen: boolean, posities: Position[]): Player[] {
  if (!meedoen) return haalUitVeld(spelers, id).map(s => s.id === id ? { ...s, meedoen: false } : s)
  const bezet = new Set(spelers.filter(s => s.inVeld && !s.isKeeper).map(s => s.positie))
  const leeg = posities.find(p => !bezet.has(p))
  return spelers.map(s => s.id === id ? { ...s, meedoen: true, inVeld: !!leeg, positie: leeg ?? s.positie } : s)
}

export function plaatsIn(spelers: Player[], id: string, positie: Position): Player[] {
  const basis = positie === 'K' ? haalUitVeld(spelers, id) : spelers
  return basis.map(s => s.id === id ? { ...s, inVeld: true, positie, isKeeper: positie === 'K' } : s)
}

// Minste wissels eerst; bij gelijke stand komt wie het laatst uit het veld ging onderaan
export function sorteerWissels(wissels: Player[], wisselingen: Wissel[]): Player[] {
  const laatstUit = (id: string) => wisselingen.map(w => w.uitSpeler).lastIndexOf(id)
  return [...wissels].sort((a, b) => a.wisselCount - b.wisselCount || laatstUit(a.id) - laatstUit(b.id))
}

// Wie het veld in komt, krijgt het volgende volgnummer (wie samen invallen, krijgen hetzelfde)
export function stempelInkomers(oud: Player[], nieuw: Player[]): Player[] {
  const volgende = Math.max(0, ...oud.map(s => s.inVolgorde ?? 0)) + 1
  return nieuw.map(s => {
    const voorheen = oud.find(o => o.id === s.id)
    return s.inVeld && !voorheen?.inVeld ? { ...s, inVolgorde: volgende } : s
  })
}

export type VeldKleur = 'groen' | 'oranje' | 'rood'

// Op volgorde van invallen: laatste invallers rood, die daarvoor oranje, de rest (ook de basis) groen
export function veldKleuren(veldspelers: Player[], perKleur = 2): Record<string, VeldKleur> {
  const invallers = veldspelers
    .filter(s => (s.inVolgorde ?? 0) > 0)
    .sort((a, b) => (b.inVolgorde ?? 0) - (a.inVolgorde ?? 0))
  return Object.fromEntries(veldspelers.map(s => {
    const plek = invallers.indexOf(s)
    return [s.id, plek === -1 || plek >= 2 * perKleur ? 'groen' : plek < perKleur ? 'rood' : 'oranje']
  }))
}

// Andere opstelling: wie op een bestaande positie staat blijft staan; spelers van weggevallen posities
// schuiven willekeurig naar nieuwe plekken; te veel -> bank, te weinig -> aanvullen met minste wissels
export function pasOpstellingAan(spelers: Player[], posities: Position[]): Player[] {
  const veld = spelers.filter(s => s.inVeld && !s.isKeeper)
  const blijvers = new Map<Position, Player>()
  veld.forEach(s => { if (posities.includes(s.positie) && !blijvers.has(s.positie)) blijvers.set(s.positie, s) })
  const vrij = posities.filter(p => !blijvers.has(p))
  const ontheemd = schud(veld.filter(s => blijvers.get(s.positie) !== s))
  const bank = spelers.filter(s => !s.inVeld && s.meedoen).sort((a, b) => a.wisselCount - b.wisselCount)
  const nieuw = new Map<string, Partial<Player>>()
  ontheemd.forEach((s, i) => nieuw.set(s.id, i < vrij.length ? { positie: vrij[i] } : { inVeld: false }))
  bank.slice(0, Math.max(0, vrij.length - ontheemd.length)).forEach((s, i) => {
    nieuw.set(s.id, { inVeld: true, positie: vrij[ontheemd.length + i] })
  })
  return spelers.map(s => nieuw.has(s.id) ? { ...s, ...nieuw.get(s.id) } : s)
}

// Spelersnamen zijn uniek binnen een team (hoofdletters en spaties tellen niet mee)
export const naamSleutel = (naam: string) => naam.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nl')
export const naamBezet = (bestaand: string[], naam: string) => bestaand.some(b => naamSleutel(b) === naamSleutel(naam))
