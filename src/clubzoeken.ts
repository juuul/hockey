const zoektekst = (tekst: string) => tekst.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Teamnummers blijven aaneengesloten: MO11 mag niet ook MO12-1 vinden.
export function teamKomtOvereen(naam: string, zoek: string): boolean {
  const bron = zoektekst(naam)
  return zoek.trim().split(/\s+/).every(deel => bron.includes(zoektekst(deel)))
}

// Ook afkortingen met ontbrekende tussenletters werken: 'sc' vindt 'SCHC'.
export function clubKomtOvereen(naam: string, plaats: string, zoek: string): boolean {
  const bron = zoektekst(`${naam} ${plaats}`)
  return zoek.trim().split(/\s+/).every(deel => {
    const letters = zoektekst(deel)
    let positie = 0
    for (const letter of letters) {
      positie = bron.indexOf(letter, positie)
      if (positie < 0) return false
      positie++
    }
    return true
  })
}
