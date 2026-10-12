export interface VerzamelInstellingen { voorbereidingMinuten: number; bufferMinuten: number }
export function berekenVerzamelen(datum: string, aanvang: string, reis: number, instellingen: VerzamelInstellingen): { datum: string; tijd: string } | null {
  if (!/^\d{4}-\d\d-\d\d$/.test(datum) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(aanvang)) return null
  const waarden = [reis, instellingen.voorbereidingMinuten, instellingen.bufferMinuten]
  if (waarden.some(v => !Number.isInteger(v) || v < 0) || reis > 1440 || instellingen.voorbereidingMinuten > 360 || instellingen.bufferMinuten > 360) return null
  const begin = new Date(`${datum}T${aanvang}:00Z`)
  if (!Number.isFinite(begin.getTime()) || begin.toISOString().slice(0,10) !== datum) return null
  const verzamel = new Date(begin.getTime() - waarden.reduce((a,b)=>a+b,0) * 60000)
  return { datum: verzamel.toISOString().slice(0,10), tijd: verzamel.toISOString().slice(11,16) }
}
export function navigatieLink(adres: string): string {
  const parameters = new URLSearchParams({ api: '1', destination: adres.trim(), travelmode: 'driving' })
  return `https://www.google.com/maps/dir/?${parameters}`
}
