import type { Spelvorm } from './types'

// KNHB-kaarten uit de officiële competitiepagina's; algemene reglementpagina's blijven actueel per seizoen.
// Veld jongste jeugd: https://www.knhb.nl/competitie/veldcompetitie/competitieaanbod/jongste-jeugd
// Zaal jongste jeugd: https://www.knhb.nl/competitie/zaalcompetitie/competitieaanbod/jongste-jeugd
export const SPELREGELS: Record<Spelvorm, { tekst: string; url: string }[]> = {
  11: [{ tekst: 'Spelregels O12+ / senioren (veld)', url: 'https://www.knhb.nl/competitie/veldcompetitie/regelgeving/spelregels/spelregeldocumenten' }],
  9: [{ tekst: 'Spelregels O11 (veld)', url: 'https://media.static-hw.nl/media/224fb240-b68e-4863-8c69-077bbce4e583/_o112025_def.pdf' }],
  8: [{ tekst: 'Spelregels O10 (veld)', url: 'https://media.static-hw.nl/media/9b893f12-4b37-4315-81fc-ab9eda8a05f1/speelregels-en-veldindeling-o10.pdf' }],
  6: [{ tekst: 'Spelregels O9 (veld)', url: 'https://media.static-hw.nl/media/49152e0c-d538-4cfd-bb5a-f520e0001eab/speelregels-en-veldindeling-o9.pdf' }],
  mini3: [
    { tekst: 'Spelregels O7 (veld)', url: 'https://media.static-hw.nl/media/aee0f9e2-9439-47ce-99f9-be6bcfe7f02d/speelregels-en-veldindeling-o7-okt2025.pdf' },
    { tekst: 'Spelregels O8 (veld)', url: 'https://media.static-hw.nl/media/1b845ad6-cde2-41a4-a52e-63a08bc6820a/speelregels-en-veldindeling-o8-1.pdf' },
  ],
  zaal6: [{ tekst: 'Spelregels O11+ / senioren (zaal)', url: 'https://www.knhb.nl/competitie/zaalcompetitie/regelgeving/spelregels' }],
  zaaljeugd6: [
    { tekst: 'Spelregels O9 (zaal)', url: 'https://media.static-hw.nl/media/6551f62c-4c9b-4c94-bd73-cd6f646973dc/speelregels_-zaal_o9-1.pdf' },
    { tekst: 'Spelregels O10 (zaal)', url: 'https://media.static-hw.nl/media/6ea7a962-31d3-48b4-abb3-ff2cd1bddb82/speelregels_-zaal_10-okt2025-1.pdf' },
  ],
  zaalmini3: [{ tekst: 'Spelregels O8 (zaal)', url: 'https://media.static-hw.nl/media/740acd3e-0432-471d-bf8e-c51cbb621609/uitleg_onder8zaal-no.pdf' }],
  zaalmini4: [{ tekst: 'Spelregels O8 (zaal)', url: 'https://media.static-hw.nl/media/740acd3e-0432-471d-bf8e-c51cbb621609/uitleg_onder8zaal-no.pdf' }],
  hockey5: [{ tekst: 'Spelregels Hockey5s', url: 'https://www.knhb.nl/api/get-media/media/8c5a8374-d6ab-417b-8104-d814bdda3fde/hockey5s.pdf' }],
  hockey7: [{ tekst: 'Spelregels Hockey7s', url: 'https://www.knhb.nl/competitie/veldcompetitie/regelgeving/spelregels/spelregels-hockey7' }],
}
