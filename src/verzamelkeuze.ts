import type { ProgrammaItem } from './types'

export function verzamelKeuze(item: ProgrammaItem, voorstel: { tijd: string; datum: string } | null) {
  const handmatig = item.verzamelModus === 'handmatig'
  const verzamelen = handmatig ? item.verzamelen : voorstel?.tijd || ''
  return {
    verzamelModus: handmatig ? 'handmatig' as const : 'automatisch' as const,
    verzamelen,
    verzamelDatum: verzamelen ? handmatig ? item.verzamelDatum || item.datum : voorstel?.datum || '' : '',
  }
}
