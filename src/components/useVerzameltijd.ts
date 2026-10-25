import { useEffect, useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { useAccount } from '../context/AccountContext'
import { pb, foutTekst } from '../server'
import { berekenVerzamelen } from '../verzamelen'
import type { ProgrammaItem } from '../types'
import type { ReisInfo } from './VerzamelenInstellen'
import { tijdWaarde } from '../tijdinvoer'

export function useVerzameltijd({ item, zet }: { item: ProgrammaItem; zet: (velden: Partial<ProgrammaItem>) => void }) {
  const { actiefTeam } = useAccount()
  const { clubs } = useHockey()
  const [info, setInfo] = useState<ReisInfo | null>(null)
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const [schatting, setSchatting] = useState<{ minuten: number; bestemming: string; vertrek: string; team: string } | null>(null)
  useEffect(() => {
    setInfo(null); setFout('')
    if (!actiefTeam) return
    let actief = true
    pb.send(`/api/hockey/verzamelinstellingen/team/${actiefTeam.id}`, { method: 'GET' }).then((data: ReisInfo) => {
      if (actief) setInfo(data)
    }).catch(e => { if (actief) setFout(foutTekst(e)) })
    return () => { actief = false }
  }, [actiefTeam?.id])
  const vertrek = info?.effectief.vertrekAdres || ''
  const zaal = item.bronPlanning?.spelvorm === 'Zaal' || info?.spelvorm === 'Zaal'
  const bestemming = item.locatieAdres || (item.thuis && !zaal ? info?.clubAdres : '') || ''
  const tegenstander = clubs.find(c => c.id === item.clubId)?.naam || item.tegenstander
  useEffect(() => {
    if (!info || item.locatieAdres || !actiefTeam) return
    let actief = true
    ;(async () => {
      if (item.thuis && !zaal && info.clubAdres) {
        if (actief) zet({ locatieAdres: info.clubAdres })
        return
      }
      if (item.thuis || !tegenstander) return
      const officieel = actiefTeam.officieelTeam ? await pb.collection('catalogus_teams').getOne(actiefTeam.officieelTeam) : null
      if (!officieel) return
      const teams = await pb.collection('catalogus_teams').getFullList({ filter: pb.filter('naam = {:naam} && seizoen = {:seizoen} && spelvorm = {:vorm}', { naam: tegenstander, seizoen: officieel.seizoen, vorm: zaal ? 'Zaal' : 'Veld' }) })
      const teamIds = teams.map(t => String(t.bronId))
      const thuisFilter = teamIds.length ? '(' + teamIds.map(id => pb.filter('thuisBronId = {:id}', { id })).join(' || ') + ')' : "thuisNaam = {:naam}"
      const wedstrijden = await pb.collection('catalogus_wedstrijden').getFullList({ filter: pb.filter(thuisFilter + " && seizoen = {:seizoen} && locatieAdres != ''" + (zaal ? " && datum = {:datum}" : ""), { naam: tegenstander, seizoen: officieel.seizoen, datum: item.datum }) })
      const adressen = [...new Set(wedstrijden.map(w => String(w.locatieAdres)))]
      if (adressen.length === 1) { if (actief) zet({ locatieAdres: adressen[0] }); return }
      if (zaal) return
      const clubIds = [...new Set(teams.map(t => t.clubBronId))]
      const lijst = await pb.collection('catalogus_clubs').getFullList({ filter: pb.filter('naam = {:naam}', { naam: tegenstander }) })
      for (const id of clubIds) lijst.push(await pb.collection('catalogus_clubs').getFirstListItem(pb.filter('bronId = {:id}', { id })))
      const clubAdressen = [...new Set(lijst.map(c => String(c.adres || '')).filter(Boolean))]
      if (actief && clubAdressen.length === 1) zet({ locatieAdres: clubAdressen[0] })
    })().catch(e => { if (actief) setFout(foutTekst(e)) })
    return () => { actief = false }
  }, [actiefTeam?.id, info, item.clubId, tegenstander, item.thuis, zaal, item.datum, item.locatieAdres])
  const reis = schatting?.bestemming === bestemming && schatting?.vertrek === vertrek && schatting?.team === actiefTeam?.id ? schatting.minuten : null
  const voorstel = info && reis != null ? berekenVerzamelen(item.datum, tijdWaarde(item.spelen) || '', reis, info.effectief) : null
  useEffect(() => {
    if (item.verzamelModus === 'handmatig' || item.soort !== 'wedstrijd') return
    const tijd = voorstel?.tijd || '', datum = voorstel?.datum || ''
    if (item.verzamelen !== tijd || (item.verzamelDatum || '') !== datum) zet({ verzamelen: tijd, verzamelDatum: datum, verzamelModus: 'automatisch' })
  }, [voorstel?.tijd, voorstel?.datum, item.verzamelen, item.verzamelDatum, item.verzamelModus, item.soort])
  useEffect(() => {
    setSchatting(null); setFout(''); setBezig(false)
    if (!actiefTeam || !info || !vertrek || !bestemming) return
    let actief = true
    setBezig(true)
    pb.send(`/api/hockey/reiscache/team/${actiefTeam.id}`, { method: 'POST', body: { vertrekAdres: vertrek, locatieAdres: bestemming } }).then(data => {
      if (actief && typeof data.minuten === 'number') setSchatting({ minuten: data.minuten, bestemming, vertrek, team: actiefTeam.id })
    }).catch(e => { if (actief) setFout(foutTekst(e)) }).finally(() => { if (actief) setBezig(false) })
    return () => { actief = false }
  }, [actiefTeam?.id, info, vertrek, bestemming])
  return { info, vertrek, bestemming, reis, voorstel, fout, bezig, actiefTeam }
}
