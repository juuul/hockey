import type { ProgrammaItem } from './types'
import { tijdWaarde } from './tijdinvoer'

export function verzamelKeuze(item: ProgrammaItem, voorstel: { tijd: string; datum: string } | null) {
  const handmatig = item.verzamelModus === 'handmatig'
  const verzamelen = handmatig ? tijdWaarde(item.verzamelen) ?? item.verzamelen : voorstel?.tijd || ''
  return {
    verzamelModus: handmatig ? 'handmatig' as const : 'automatisch' as const,
    verzamelen,
    verzamelDatum: verzamelen ? handmatig ? item.verzamelDatum || item.datum : voorstel?.datum || '' : '',
  }
}
