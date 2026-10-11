// Test en live delen dezelfde origin, maar hebben aparte servers en opslag.
export const OPSLAG = import.meta.env.MODE === 'test' ? 'hockey_test' : 'hockey'

// Per team een eigen opslag; zonder team de gewone (alleen deze telefoon)
export const teamOpslag = (teamId: string | null) => (teamId ? `${OPSLAG}_t_${teamId}` : OPSLAG)

// Kapotte of geblokkeerde opslag: gewoon met de standaardwaarde beginnen
export function lees<T>(prefix: string, sleutel: string, standaard: T): T {
  try {
    const saved = localStorage.getItem(`${prefix}_${sleutel}`)
    return saved ? JSON.parse(saved) : standaard
  } catch {
    return standaard
  }
}

export function schrijf(prefix: string, sleutel: string, waarde: unknown) {
  try {
    localStorage.setItem(`${prefix}_${sleutel}`, JSON.stringify(waarde))
  } catch {
    // vol of geblokkeerd: niets aan te doen
  }
}

// Oude testopslag kwam van de productieserver: niet naar de nieuwe testserver uploaden.
if (import.meta.env.MODE === 'test') {
  try {
    if (localStorage.getItem('hockey_test_backend') !== 'apart-v1') {
      for (const sleutel of Object.keys(localStorage)) {
        if (sleutel.startsWith('hockey_test_')) localStorage.removeItem(sleutel)
      }
      localStorage.setItem('hockey_test_backend', 'apart-v1')
    }
  } catch { /* Opslag kan geblokkeerd zijn. */ }
}
