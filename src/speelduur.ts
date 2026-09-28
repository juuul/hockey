// Speelduur van een wedstrijd (KNHB): 11- en 9-tal (O11 en ouder) 4 kwarten van 17:30, daartussen 2 min pauze,
// 5 min rust, 2 min pauze; 8-tal (O10) 2 helften van 30 min, 6-tal (O9) 2 helften van 25 min, beide met 5 min rust.
// De timer loopt gewoon door; uit de verstreken tijd volgt vanzelf in welk deel van de wedstrijd je zit.

import { Spelvorm } from './types'

export type DeelSoort = 'kwart' | 'pauze' | 'rust'

export interface Deel {
  soort: DeelSoort
  kwart: number // bij een kwart/helft het nummer, bij een pauze het nummer dat erna komt
  lengte: number // ms
}

const MIN = 60_000
const KWART = 17.5 * MIN

export const SCHEMA: Deel[] = [
  { soort: 'kwart', kwart: 1, lengte: KWART },
  { soort: 'pauze', kwart: 2, lengte: 2 * MIN },
  { soort: 'kwart', kwart: 2, lengte: KWART },
  { soort: 'rust', kwart: 3, lengte: 5 * MIN },
  { soort: 'kwart', kwart: 3, lengte: KWART },
  { soort: 'pauze', kwart: 4, lengte: 2 * MIN },
  { soort: 'kwart', kwart: 4, lengte: KWART },
]

const helften = (minuten: number): Deel[] => [
  { soort: 'kwart', kwart: 1, lengte: minuten * MIN },
  { soort: 'rust', kwart: 2, lengte: 5 * MIN },
  { soort: 'kwart', kwart: 2, lengte: minuten * MIN },
]

export const schemaVoor = (spelvorm: Spelvorm): Deel[] => (spelvorm === 8 ? helften(30) : spelvorm === 6 ? helften(25) : SCHEMA)
const isHelften = (schema: Deel[]) => schema.filter(d => d.soort === 'kwart').length === 2

export interface Fase {
  index: number // plek in SCHEMA; SCHEMA.length = afgelopen
  deel: Deel | null // null = afgelopen
  inDeel: number // ms verstreken in dit deel (afgelopen: ms na het laatste fluitsignaal)
  nog: number // ms tot het volgende deel (afgelopen: 0)
}

export function faseVan(verstreken: number, schema: Deel[] = SCHEMA): Fase {
  let begin = 0
  for (let i = 0; i < schema.length; i++) {
    const eind = begin + schema[i].lengte
    if (verstreken < eind) return { index: i, deel: schema[i], inDeel: verstreken - begin, nog: eind - verstreken }
    begin = eind
  }
  return { index: schema.length, deel: null, inDeel: verstreken - begin, nog: 0 }
}

// Tijd (ms) waarop een deel begint
export const beginVan = (index: number, schema: Deel[] = SCHEMA) =>
  schema.slice(0, index).reduce((som, d) => som + d.lengte, 0)

// Hoe ver elk deel is (0–1), voor de balk
export function voortgang(verstreken: number, schema: Deel[] = SCHEMA): number[] {
  let begin = 0
  return schema.map(d => {
    const v = Math.min(1, Math.max(0, (verstreken - begin) / d.lengte))
    begin += d.lengte
    return v
  })
}

// '2e kwart' of bij helften '2e helft'
export const speelNaam = (nummer: number, schema: Deel[]) => `${nummer}e ${isHelften(schema) ? 'helft' : 'kwart'}`

export const deelNaam = (d: Deel | null, schema: Deel[] = SCHEMA) =>
  !d ? 'Afgelopen' : d.soort === 'kwart' ? speelNaam(d.kwart, schema) : d.soort === 'rust' ? 'Rust' : 'Pauze'

// Kort voor onder de keuze van de categorie
export const speelduurTekst = (spelvorm: Spelvorm) =>
  spelvorm === 8 ? '2 × 30 min' : spelvorm === 6 ? '2 × 25 min' : '4 × 17:30'
