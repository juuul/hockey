// Fictieve browserfixture; bundel server.ts uitsluitend naar de mock in sync-herstel-ui.cjs.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useLiveStand } from '../../src/context/useLiveStand'
import { useTeamSync } from '../../src/context/useTeamSync'
import { maakStand } from '../../src/live'
import { perSoort, schoon } from '../../src/sync'
const w = window as any
const begin = maakStand({ spelers: {}, wisselingen: [], score: { wij: 0, zij: 0 }, doelpunten: [], opstelling: '3-4-3', timer: { opgebouwd: 0, gestartOp: Date.now() - 1000 }, wedstrijd: { datum: '2026-11-05', thuis: true, clubId: null } })
const regel = schoon('programma', { id: 'fictieveplanning', soort: 'wedstrijd', datum: '2026-11-07', thuis: true, notitie: '', locatie: 'Voorbeeldveld', locatieAdres: 'Voorbeeldstraat 1' })
const records = perSoort(() => ({})); records.programma[regel.id as string] = regel
localStorage.clear(); localStorage.setItem('qa_basis', JSON.stringify(records)); localStorage.setItem('qa_live_laatst', JSON.stringify(begin))
w.net = { lezen: false, schrijven: false, abonnement: false }
w.tellingen = { lezen: 0, schrijven: 0, abonnement: 0, records: 0 }
w.serverStand = begin; w.serverRegel = { ...regel }
w.fakepb = {
  authStore: { isValid: true }, filter: () => '', collection: (soort: string) => ({
    getOne: async () => { w.tellingen.lezen++; if (!w.net.lezen) throw { status: 0 }; return { stand: w.serverStand, versie: 1, bron: 'ander-toestel' } },
    update: async (_id: string, data: any) => {
      if (soort === 'standen') { w.tellingen.schrijven++; if (!w.net.schrijven) throw { status: 503 }; w.serverStand = data.stand }
      else { w.tellingen.records++; if (!w.net.schrijven) throw { status: 503 }; Object.assign(w.serverRegel, data) }
      return data
    },
    getFullList: async () => { if (!w.net.lezen) throw { status: 0 }; return soort === 'programma' ? [w.serverRegel] : [] },
    subscribe: async () => { if (soort === 'standen') { w.tellingen.abonnement++; if (!w.net.abonnement) throw { status: 0 } } return async () => {} },
  }),
}
function Test() {
  const [stand, zetStand] = useState(begin), [data, zetData] = useState(records)
  const live = useLiveStand({ teamId: 'fictiefteam0001', prefix: 'qa', stand, toepassen: zetStand, magBewerken: true })
  const sync = useTeamSync({ teamId: 'fictiefteam0001', prefix: 'qa', records: data, toepassen: zetData, verwijderd: perSoort(() => []), verwijderdVerwerkt: () => {} })
  w.acties = {
    score: () => zetStand(s => ({ ...s, score: { ...s.score, wij: s.score.wij + 1 } })),
    notitie: () => zetData(d => ({ ...d, programma: { ...d.programma, [regel.id as string]: { ...d.programma[regel.id as string], notitie: 'Eigen nieuwe notitie' } } })),
    ververs: () => Promise.all([live.ververs(), sync.nuSynchroniseren()]),
  }
  w.stand = stand
  w.qaStatus = { live: live.status, sync: sync.status, fout: !live.status.verbonden || sync.status.offline || !!sync.status.fout }
  return <><input id="invoer" defaultValue="" /><div id="scroll" style={{ height: 150, overflow: 'auto' }}><div style={{ height: 1000 }}>Spelers</div></div><pre>{JSON.stringify(w.qaStatus)}</pre></>
}
const root = createRoot(document.getElementById('app')!)
w.qaStop = () => root.unmount()
root.render(<Test />)
