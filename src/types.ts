export type Position = 'LW' | 'CV' | 'RW' | 'LM' | 'LCM' | 'CM' | 'RCM' | 'RM' | 'LBM' | 'LCA' | 'CBM' | 'RCA' | 'RBM' | 'K';

export interface Player {
  id: string;
  naam: string;
  positie: Position;
  inVeld: boolean;
  meedoen: boolean;
  inVolgorde?: number; // oplopend volgnummer van het moment waarop de speler het veld in kwam
  wisselCount: number;
  isKeeper: boolean;
}

export interface Wissel {
  id: string;
  tijdstip: Date;
  inSpeler: string;
  uitSpeler: string;
  positie: Position;
}

export const POSITIE_LABEL: Record<Position, string> = {
  LW: 'links voor',
  CV: 'centraal voor',
  RW: 'rechts voor',
  LM: 'links midden',
  LCM: 'links binnen',
  CM: 'midden',
  RCM: 'rechts binnen',
  RM: 'rechts midden',
  LBM: 'links achter',
  LCA: 'links centraal',
  CBM: 'centraal achter',
  RCA: 'rechts centraal',
  RBM: 'rechts achter',
  K: 'keeper',
};

// Van voor naar achter; ook de sorteervolgorde voor elke opstelling
export const VELD_VOLGORDE: Position[] = ['LW', 'CV', 'RW', 'LM', 'LCM', 'CM', 'RCM', 'RM', 'LBM', 'LCA', 'CBM', 'RCA', 'RBM'];

// Totaal aantal spelers incl. keeper
export type Spelvorm = 11 | 9 | 8 | 6;

export type OpstellingNaam = '3-3-4' | '3-4-3' | '2-3-3' | '3-3-2' | '3-2-3' | '2-3-2' | '1-3-3' | '2-2-3' | '2-1-2' | '2-2-1' | '1-2-2';

// Rijen van voor naar achter (keeper staat er altijd los onder)
export const OPSTELLINGEN: Record<OpstellingNaam, Position[][]> = {
  // Interne namen tellen van voor naar achter (zo staan ze al in opslag en op de server).
  // In beeld altijd hockeytaal, van achter naar voor: zie opstellingTekst
  '3-3-4': [['LW', 'CV', 'RW'], ['LM', 'CM', 'RM'], ['LBM', 'LCA', 'RCA', 'RBM']],
  '3-4-3': [['LW', 'CV', 'RW'], ['LM', 'LCM', 'RCM', 'RM'], ['LBM', 'CBM', 'RBM']],
  '2-3-3': [['LW', 'RW'], ['LM', 'CM', 'RM'], ['LBM', 'CBM', 'RBM']],
  '3-3-2': [['LW', 'CV', 'RW'], ['LM', 'CM', 'RM'], ['LBM', 'RBM']],
  '3-2-3': [['LW', 'CV', 'RW'], ['LM', 'RM'], ['LBM', 'CBM', 'RBM']],
  '2-3-2': [['LW', 'RW'], ['LM', 'CM', 'RM'], ['LBM', 'RBM']],
  '1-3-3': [['CV'], ['LM', 'CM', 'RM'], ['LBM', 'CBM', 'RBM']],
  '2-2-3': [['LW', 'RW'], ['LM', 'RM'], ['LBM', 'CBM', 'RBM']],
  '2-1-2': [['LW', 'RW'], ['CM'], ['LBM', 'RBM']],
  '2-2-1': [['LW', 'RW'], ['LM', 'RM'], ['CBM']],
  '1-2-2': [['CV'], ['LM', 'RM'], ['LBM', 'RBM']],
};

// De eerste is de standaard bij die spelvorm
export const OPSTELLINGEN_PER_SPELVORM: Record<Spelvorm, OpstellingNaam[]> = {
  11: ['3-4-3', '3-3-4'],
  9: ['2-3-3', '3-3-2', '3-2-3'],
  8: ['2-3-2', '1-3-3', '2-2-3'],
  6: ['2-1-2', '2-2-1', '1-2-2'],
};

// In beeld: de KNHB-categorie bij de spelvorm (11-tal vanaf O12, 9-tal O11, 8-tal O10, 6-tal O9)
export const CATEGORIE: Record<Spelvorm, string> = { 11: 'O12+', 9: 'O11', 8: 'O10', 6: 'O9' };

export const spelvormVan = (opstelling: OpstellingNaam): Spelvorm =>
  ([11, 9, 8, 6] as const).find(v => OPSTELLINGEN_PER_SPELVORM[v].includes(opstelling)) ?? 9;

export const veldPosities = (opstelling: OpstellingNaam): Position[] => OPSTELLINGEN[opstelling].flat();

// Tegenstanders worden onthouden zodat je ze later kunt kiezen
export interface Club {
  id: string;
  naam: string;
  laatstGebruikt: number; // tijdstip, meest recente bovenaan in de keuzelijst
}

// Gegevens van de wedstrijd die nu bezig is
export interface WedstrijdInfo {
  datum: string | null; // 'JJJJ-MM-DD'; null = vandaag
  clubId: string | null;
  thuis: boolean;
  programmaId?: string; // klaargezet vanuit het programma (voor tijden en het label 'Klaargezet')
  afgesloten?: string; // id van de opgeslagen wedstrijd: afgelopen, de uitslag blijft staan tot er een nieuwe wedstrijd begint
  bewerkt?: string; // weer geopend: opnieuw afsluiten overschrijft deze opgeslagen wedstrijd
}

// Afgesloten wedstrijd. Namen worden meebewaard zodat de historie klopt als een speler of club later weg is
export interface GespeeldeWedstrijd {
  id: string;
  datum: string;
  clubId: string;
  tegenstander: string;
  thuis: boolean;
  wij: number;
  zij: number;
  doelpunten: { spelerId: string | null; naam: string }[];
  spelers: { id: string; naam: string; wissels: number; tijd?: Partial<Record<'a' | 'm' | 'v' | 'k' | 'w', number>> }[]; // wie meedeed; tijd = seconden per linie (zie speeltijd.ts), ontbreekt bij oudere wedstrijden
  opstelling: OpstellingNaam;
  opgeslagenOp: number;
  shootouts?: { spelerId: string; naam: string }[]; // wie na de wedstrijd een shoot-out nam (O10 en O9); ontbreekt bij oudere wedstrijden
}

// Shoot-out in de lopende wedstrijd: alleen wie nam (of hij raak was doet er niet toe; de score staat op het Dashboard)
export interface Shootout { spelerId: string }

// Na afloop van elke wedstrijd shoot-outs: alleen bij 8-tal (O10) en 6-tal (O9)
export const heeftShootouts = (spelvorm: Spelvorm) => spelvorm === 8 || spelvorm === 6;

// Hockeytaal: van achter naar voor, zonder keeper (intern '3-3-4' = 3 voor, 3 midden, 4 achter → '4-3-3')
export const opstellingTekst = (naam: string): string => naam.split('-').reverse().join('-');

export const isOpstelling = (naam: unknown): naam is OpstellingNaam => typeof naam === 'string' && naam in OPSTELLINGEN;

// Opgeslagen of ontvangen opstelling, met vervallen namen omgezet (4-4-2, intern '2-4-4', bestaat niet meer → 3-4-3)
export const leesOpstelling = (naam: unknown): OpstellingNaam | null =>
  isOpstelling(naam) ? naam
  : naam === '2-4-4' || naam === '3-3-3-1' ? '3-4-3'
  : naam === '4-3-3' ? '3-3-4'
  : null;

// Programma (tabblad Programma): per datum een wedstrijd met tijden en taken, of een regel zonder wedstrijd.
// Lege tekst = nog niet bekend (tegenstander/tijden) of niemand (fruit/begeleiding). Taken verwijzen naar een speler-id
export interface ProgrammaItem {
  id: string;
  datum: string; // 'JJJJ-MM-DD'
  tot: string; // laatste datum bij een periode (bv. vakantie), anders ''
  soort: 'wedstrijd' | 'vrij';
  clubId: string;
  tegenstander: string;
  thuis: boolean;
  verzamelen: string; // 'UU:MM' of ''
  spelen: string;
  fruit: string;
  begeleider1: string; // '' = nog te bepalen, '-' = niet nodig, anders speler-id (ouder van)
  begeleider2: string;
  notitie: string;
}

export const NIET_NODIG = '-';

// Tekst voor op het kaartje: 'niet nodig', 'ouder Noor, ouder Emma', 'ouder Noor · nog 1 te bepalen', 'nog te bepalen'
export function begeleidingTekst(p: ProgrammaItem, naam: (id: string) => string): string {
  const plekken = [p.begeleider1, p.begeleider2].filter(b => b !== NIET_NODIG)
  if (plekken.length === 0) return 'niet nodig';
  const namen = plekken.filter(b => b && naam(b)).map(b => `ouder ${naam(b)}`);
  const open = plekken.length - namen.length;
  if (namen.length === 0) return 'nog te bepalen';
  return open ? `${namen.join(', ')} · nog ${open} te bepalen` : namen.join(', ');
}
