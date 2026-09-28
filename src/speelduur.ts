// Speelduur van een wedstrijd (KNHB, O11 en ouder): 4 kwarten van 17:30, daartussen 2 min pauze, 5 min rust, 2 min pauze.
// De timer loopt gewoon door; uit de verstreken tijd volgt vanzelf in welk deel van de wedstrijd je zit.

export type DeelSoort = 'kwart' | 'pauze' | 'rust'

export interface Deel {
  soort: DeelSoort
  kwart: number // bij een kwart het nummer (1–4), bij een pauze het kwart dat erna komt
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

// Hoe ver elk deel is (0–1), voor de balk
export function voortgang(verstreken: number, schema: Deel[] = SCHEMA): number[] {
  let begin = 0
  return schema.map(d => {
    const v = Math.min(1, Math.max(0, (verstreken - begin) / d.lengte))
    begin += d.lengte
    return v
  })
}

export const deelNaam = (d: Deel | null) =>
  !d ? 'Afgelopen' : d.soort === 'kwart' ? `${d.kwart}e kwart` : d.soort === 'rust' ? 'Rust' : 'Pauze'
