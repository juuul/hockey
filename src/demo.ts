// Voorbeeld voor wie niet ingelogd is: het Dashboard werkt echt (op deze telefoon), de andere tabbladen tonen
// deze vaste voorbeeldgegevens en zijn niet te wijzigen. Namen van het testteam, clubs verzonnen.
import { Club, GespeeldeWedstrijd, Player, ProgrammaItem } from './types'

export const DEMO_SPELERS: Player[] = [
  { id: '1', naam: 'Yara', positie: 'LW', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '2', naam: 'Roos', positie: 'CV', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '3', naam: 'Nina', positie: 'RW', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '4', naam: 'Tess', positie: 'LM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '5', naam: 'Emma', positie: 'LCM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '6', naam: 'Lotte', positie: 'RCM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '7', naam: 'Fleur', positie: 'RM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '8', naam: 'Mila', positie: 'LBM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '9', naam: 'Lieke', positie: 'CBM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '10', naam: 'Noor', positie: 'RBM', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: false },
  { id: '11', naam: 'Saar', positie: 'K', inVeld: true, meedoen: true, wisselCount: 0, isKeeper: true },
  { id: '12', naam: 'Sophie', positie: 'LW', inVeld: false, meedoen: true, wisselCount: 1, isKeeper: false },
  { id: '13', naam: 'Anna', positie: 'RW', inVeld: false, meedoen: true, wisselCount: 1, isKeeper: false },
]

// 'Mijn kind' in het voorbeeld: heeft fruit bij de volgende wedstrijd en begeleidt later
export const DEMO_KIND = ['5']

export const DEMO_VOORKEUR: Record<string, string[]> = {
  '1': ['LW', 'CV'], '2': ['CV', 'RW'], '3': ['RW', 'LW'], '4': ['LM', 'LCM'], '5': ['LCM', 'CV'],
  '6': ['RCM', 'RM'], '7': ['RM', 'RW'], '8': ['LBM', 'CBM'], '9': ['CBM', ''], '10': ['RBM', 'LBM'],
  '12': ['CV', 'LM'], '13': ['RM', 'RBM'],
}

export const DEMO_CLUBS: Club[] = [
  { id: 'demo-c1', naam: 'HC De Wieken', laatstGebruikt: 5 },
  { id: 'demo-c2', naam: 'MHC Lindeweide', laatstGebruikt: 4 },
  { id: 'demo-c3', naam: 'HC Rietvelde', laatstGebruikt: 3 },
  { id: 'demo-c4', naam: 'MHC Oosterkade', laatstGebruikt: 2 },
  { id: 'demo-c5', naam: 'HC Heidebloem', laatstGebruikt: 1 },
]

// Zaterdag n weken van nu (0 = komende zaterdag, -1 = afgelopen), als 'JJJJ-MM-DD'
function zaterdag(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7) + 7 * n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const naam = (id: string) => DEMO_SPELERS.find(s => s.id === id)!.naam
const goals = (...ids: string[]) => ids.map(id => ({ spelerId: id, naam: naam(id) }))
const iedereen = (wissels: number[]) => DEMO_SPELERS.map((s, i) => ({ id: s.id, naam: s.naam, wissels: wissels[i] ?? 0 }))

export function demoWedstrijden(): GespeeldeWedstrijd[] {
  const w = (n: number, club: number, thuis: boolean, zij: number, doelpunten: GespeeldeWedstrijd['doelpunten'], wissels: number[]): GespeeldeWedstrijd => ({
    id: `demo-w${n}`, datum: zaterdag(-n), clubId: DEMO_CLUBS[club].id, tegenstander: DEMO_CLUBS[club].naam, thuis,
    wij: doelpunten.length, zij, doelpunten, spelers: iedereen(wissels), opstelling: '3-4-3', opgeslagenOp: n,
  })
  return [
    w(1, 0, true, 1, goals('2', '1', '5'), [2, 1, 2, 1, 1, 2, 1, 1, 1, 1, 0, 2, 2]),
    w(2, 1, false, 2, goals('3', '2'), [1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 0, 2, 2]),
    w(3, 2, true, 0, goals('1', '1', '12', '6'), [2, 1, 1, 1, 2, 1, 1, 2, 1, 1, 0, 2, 2]),
    w(4, 3, false, 3, goals('2'), [1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 0, 2, 2]),
  ]
}

export function demoProgramma(): ProgrammaItem[] {
  const p = (n: number, club: number, thuis: boolean, verzamelen: string, spelen: string, fruit: string, b1: string, b2: string, notitie = ''): ProgrammaItem => ({
    id: `demo-p${n + 10}`, datum: zaterdag(n), tot: '', soort: 'wedstrijd', clubId: DEMO_CLUBS[club].id, tegenstander: DEMO_CLUBS[club].naam,
    thuis, verzamelen, spelen, fruit, begeleider1: b1, begeleider2: b2, notitie,
  })
  return [
    p(-2, 1, false, '09:15', '10:00', '4', '-', '-'),
    p(-1, 0, true, '10:30', '11:15', '9', '7', '3'),
    p(0, 4, true, '08:45', '09:30', '5', '10', ''),
    p(1, 2, false, '11:00', '11:45', '8', '-', '-', 'Carpoolen vanaf het clubhuis'),
    { id: 'demo-p-vrij', datum: zaterdag(2), tot: zaterdag(3), soort: 'vrij', clubId: '', tegenstander: '', thuis: true, verzamelen: '', spelen: '', fruit: '', begeleider1: '', begeleider2: '', notitie: 'Herfstvakantie' },
    p(4, 3, true, '09:45', '10:30', '', '5', ''),
  ]
}
