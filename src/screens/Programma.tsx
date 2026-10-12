import ProgrammaTijd from '../components/ProgrammaTijd'
import { useState } from 'react'
import VerzameltijdBerekenen from '../components/VerzameltijdBerekenen'
import { navigatieLink } from '../verzamelen'
import Speeldagen from '../components/Speeldagen'
import { useHockey } from '../context/HockeyContext'
import { useAccount } from '../context/AccountContext'
import { begeleidingTekst, NIET_NODIG, ProgrammaItem } from '../types'
import { foutTekst, pb, type TeamInstellingen } from '../server'
import { datumTekst, vandaag } from '../historie'
import { pbId } from '../sync'
import { tel } from '../statistiek'
import ResetModal from '../components/ResetModal'
import '../components/Modal.css'
import '../components/WedstrijdModal.css'
import './Players.css'
import './Programma.css'
import { useTerug } from '../terug'

// Standaard voor een begeleidingsplek bij thuis/uit: niet nodig, of nog te bepalen
const standaardPlek = (thuis: boolean, inst: TeamInstellingen) =>
  (thuis ? inst.thuisGeenBegeleiding : inst.uitGeenBegeleiding) ? NIET_NODIG : ''

const LEEG_ITEM = (inst: TeamInstellingen): ProgrammaItem => ({
  id: pbId(), datum: vandaag(), tot: '', soort: 'wedstrijd', clubId: '', tegenstander: '', thuis: true,
  verzamelModus: 'automatisch', verzamelen: '', verzamelDatum: '', reisMinuten: null, locatieAdres: '', spelen: '', fruit: '', begeleider1: standaardPlek(true, inst), begeleider2: standaardPlek(true, inst), notitie: '',
})

// Tabblad Programma: wedstrijden met tijden, fruit en spelbegeleiding. Beurten van je eigen kind(eren) vallen op
export default function Programma({ naarDashboard }: { naarDashboard: () => void }) {
  const { programma, bewaarProgramma, spelers, clubs, magBeheren: magBewerken, wedstrijd, zetWedstrijd, allesResetten, score, timer, wedstrijden, afgesloten } = useHockey()
  const { mijnKinderen, zetMijnKinderen, teamInstellingen, actiefTeam } = useAccount()
  const [planningOpen, setPlanningOpen] = useState(false)
  const [bewerk, setBewerk] = useState<ProgrammaItem | null>(null)
  const [standaardOpen, setStandaardOpen] = useState(false)
  const [klaarVraag, setKlaarVraag] = useState<ProgrammaItem | null>(null)

  // 'Op het veld zetten': de gegevens van deze datum worden 'Deze wedstrijd', daarna naar het Dashboard voor de opstelling.
  // Staat er nog een wedstrijd open (stand of timer), dan eerst vragen: dan begint er een nieuwe
  // Na afsluiten staat alleen de uitslag nog op het Dashboard: dan zonder vraag een nieuwe wedstrijd beginnen
  const openWedstrijd = !wedstrijd.afgesloten && (score.wij + score.zij > 0 || timer.opgebouwd > 0 || timer.gestartOp !== null)
  const klaarzetten = (p: ProgrammaItem, nieuw: boolean) => {
    if (nieuw) allesResetten()
    zetWedstrijd({ datum: p.datum, clubId: p.clubId || null, thuis: p.thuis, programmaId: p.id })
    tel('wedstrijd-klaargezet')
    setKlaarVraag(null)
    naarDashboard()
  }
  const opVeld = (p: ProgrammaItem) => (openWedstrijd ? setKlaarVraag(p) : klaarzetten(p, !!wedstrijd.afgesloten))
  const [kiesKind, setKiesKind] = useState(false)
  const [alleenMijn, setAlleenMijn] = useState(false)
  // Standaard alleen wat nog komt; voorbije datums pas op verzoek
  const [toonGeweest, setToonGeweest] = useState(false)

  const naam = (id: string) => spelers.find(s => s.id === id)?.naam ?? ''
  const clubNaam = (p: ProgrammaItem) => clubs.find(c => c.id === p.clubId)?.naam ?? p.tegenstander
  const beurten = (p: ProgrammaItem) => {
    const uit: string[] = []
    if (p.soort !== 'wedstrijd') return uit
    if (mijnKinderen.includes(p.fruit)) uit.push('fruit')
    if (mijnKinderen.includes(p.begeleider1) || mijnKinderen.includes(p.begeleider2)) uit.push('begeleiding')
    return uit
  }

  const vandaagStr = vandaag()
  const gesorteerd = [...programma].sort((a, b) => a.datum.localeCompare(b.datum))
  const komend = gesorteerd.filter(p => (p.tot || p.datum) >= vandaagStr)
  const geweest = gesorteerd.filter(p => (p.tot || p.datum) < vandaagStr).reverse()
  // Al gespeeld (afgesloten): de wedstrijd die net is afgesloten, of een opgeslagen wedstrijd op die datum tegen die club
  const gespeeld = (p: ProgrammaItem) =>
    p.soort !== 'wedstrijd' ? undefined
    : (afgesloten && p.id === wedstrijd.programmaId ? afgesloten : undefined)
      ?? (p.clubId ? wedstrijden.find(w => w.datum === p.datum && w.clubId === p.clubId) : undefined)
  const kalenderLinks = [...new Set(programma.map(p => p.bronPlanning?.bron).filter((bron): bron is string => !!bron))]
  const volgendeId = komend.find(p => p.soort === 'wedstrijd' && !gespeeld(p))?.id
  const zichtbaar = (lijst: ProgrammaItem[]) => (alleenMijn ? lijst.filter(p => beurten(p).length > 0) : lijst)

  // Onderin elk kaartje (beheerders): Wijzigen, en bij komende wedstrijden Op het veld zetten
  const knoppen = (p: ProgrammaItem, isGeweest: boolean) => (
    <div className="prog-knoppenrij">
      <button className="btn btn-secondary" onClick={() => setBewerk(p)}>✏️ Wijzigen</button>
      {p.soort === 'wedstrijd' && !isGeweest && p.id !== wedstrijd.programmaId && !gespeeld(p) && (
        <button className={`btn ${p.id === volgendeId ? 'btn-primary' : 'btn-secondary'}`} onClick={() => opVeld(p)}>🏑 Op het veld zetten</button>
      )}
    </div>
  )

  const kaart = (p: ProgrammaItem, isGeweest = false) => {
    const mijn = beurten(p)
    const datum = p.tot ? `${datumTekst(p.datum)} – ${datumTekst(p.tot)}` : datumTekst(p.datum)
    const inhoud = p.soort === 'vrij' ? (
      <>
        <div className="prog-kop">
          <span className="prog-datum">{datum}</span>
        </div>
        <div className="prog-vrij">{p.notitie || 'Geen wedstrijd'}</div>
        {magBewerken && knoppen(p, isGeweest)}
      </>
    ) : (
      <>
        <div className="prog-kop">
          <span className="prog-datum">{datum}</span>
          {clubNaam(p) && <span className="prog-waar">{p.thuis ? 'Thuis' : 'Uit'}</span>}
          {p.id === volgendeId && <span className="prog-label volgende">Volgende</span>}
        </div>
        {gespeeld(p)
          ? <div className="prog-klaar">✅ Gespeeld {gespeeld(p)!.wij} – {gespeeld(p)!.zij}</div>
          : p.id === wedstrijd.programmaId && <div className="prog-klaar">✅ Staat nu klaar onder 🏑</div>}
        <div className={`prog-tegen ${clubNaam(p) ? '' : 'onbekend'}`}>{clubNaam(p) || 'Tegenstander nog niet bekend'}</div>
        <ProgrammaTijd item={p} bewaar={bewaarProgramma} bewerkbaar={magBewerken} />
        <div className={`prog-regel ${mijn.includes('fruit') ? 'mijn' : ''}`}>
          <span aria-hidden="true">🍎</span><span>fruit: {naam(p.fruit) || '–'}</span>
        </div>
        <div className={`prog-regel ${mijn.includes('begeleiding') ? 'mijn' : ''}`}>
          <span aria-hidden="true">🚗</span>
          <span>begeleiding: {begeleidingTekst(p, naam)}</span>
        </div>
        {p.bronPlanning && !p.bronId && <div className="prog-regel">{p.bronPlanning.spelvorm} · {p.bronPlanning.status === 'reserve' ? 'Reservedag — alleen als nodig' : p.bronPlanning.status === 'slotdag' ? 'Voorlopige slotdag' : p.bronPlanning.spelvorm === 'Zaal' ? 'Mogelijke zaal-speeldag' : 'Voorlopige speeldag'} {p.bronPlanning.omschrijving && !/^\d+$/.test(p.bronPlanning.omschrijving) ? ` · ${p.bronPlanning.omschrijving}` : ''}</div>}
        {p.locatieAdres?.trim() ? <a className="btn btn-secondary" href={navigatieLink(p.locatieAdres)} target="_blank" rel="noreferrer">Navigeer naar wedstrijd</a> : <button type="button" className="btn btn-secondary" disabled title="Wedstrijdadres nog niet bekend">Navigeer naar wedstrijd</button>}
        {p.locatie && <div className="prog-regel">📍 {p.locatie}</div>}
        {p.bronStatus && /cancel/i.test(p.bronStatus) && <div className="prog-regel">Afgelast volgens de officiële bron</div>}
        {!!Object.keys(p.bronWijziging || {}).length && <div className="prog-regel">De officiële gegevens zijn gewijzigd; jouw aanpassing is behouden.</div>}
        {p.notitie && <div className="prog-regel notitie">{p.notitie}</div>}
        {mijn.length > 0 && (
          <div className="prog-labels">{mijn.map(b => <span key={b} className="prog-label mijn">Jij: {b}</span>)}</div>
        )}
        {magBewerken && knoppen(p, isGeweest)}
      </>
    )
    const klasse = `prog-kaart ${p.soort} ${mijn.length ? 'mijn' : ''} ${isGeweest ? 'geweest' : ''} ${p.id === volgendeId ? 'volgende' : ''}`
    return <div key={p.id} className={klasse}>{inhoud}</div>
  }

  return (
    <div className="programma">
      <section className="prog-kind">
        <div className="prog-kind-kop">
          <span className="prog-kind-titel">Mijn kind</span>
          {mijnKinderen.filter(naam).map(id => <span key={id} className="prog-chip">{naam(id)}</span>)}
          <button className="prog-kind-kies" onClick={() => setKiesKind(true)}>{mijnKinderen.length ? 'Wijzig' : 'Kies'}</button>
        </div>
        {mijnKinderen.length > 0 ? (
          <button className={`prog-filter ${alleenMijn ? 'actief' : ''}`} onClick={() => setAlleenMijn(!alleenMijn)} aria-pressed={alleenMijn}>
            {alleenMijn ? '✓ Alleen mijn beurten' : 'Alleen mijn beurten'}
          </button>
        ) : (
          <p className="prog-uitleg">Kies je kind: dan zie je meteen wanneer jij fruit meeneemt of begeleidt.</p>
        )}
      </section>

      {kalenderLinks.length > 0 && <div className="prog-filters">{kalenderLinks.map((bron, i) => <a key={bron} className="btn btn-secondary" href={bron} target="_blank" rel="noreferrer">Speelkalender{kalenderLinks.length > 1 ? ` ${i + 1}` : ''}</a>)}</div>}
      <div className="prog-filters">
        <button className={`prog-filter ${toonGeweest ? 'actief' : ''}`} onClick={() => setToonGeweest(!toonGeweest)} aria-pressed={toonGeweest}>
          ⇄ {toonGeweest ? 'Geweest' : 'Nog te spelen'}
        </button>
        {magBewerken && <button className="prog-filter" onClick={() => setStandaardOpen(true)}>Begeleiding</button>}
      </div>
      {magBewerken && actiefTeam?.officieelTeam && <button className="btn btn-secondary" onClick={() => setPlanningOpen(true)}>Speeldagen plannen · veld en zaal</button>}
      {planningOpen && <Speeldagen dicht={() => setPlanningOpen(false)} />}
      {magBewerken && <button className="btn btn-primary prog-toevoegen" onClick={() => setBewerk(LEEG_ITEM(teamInstellingen))}>+ Datum toevoegen</button>}

      {programma.length === 0 && <p className="prog-uitleg midden">Nog geen programma.{magBewerken ? ' Voeg de eerste datum toe.' : ''}</p>}
      {programma.length > 0 && <h2 className="section-title">{toonGeweest ? 'Geweest (nieuwste eerst)' : 'Nog te spelen'}</h2>}
      {(toonGeweest ? zichtbaar(geweest) : zichtbaar(komend)).map(p => kaart(p, toonGeweest))}
      {programma.length > 0 && (toonGeweest ? zichtbaar(geweest) : zichtbaar(komend)).length === 0 && (
        <p className="prog-uitleg midden">
          {alleenMijn ? (toonGeweest ? 'Geen eerdere beurten van jouw kind.' : 'Geen beurten meer voor jouw kind.') : toonGeweest ? 'Nog niets geweest.' : 'Alles is gespeeld.'}
        </p>
      )}

      {kiesKind && <KindKiezen gekozen={mijnKinderen} onKlaar={ids => { zetMijnKinderen(ids); tel('kind-gekozen'); setKiesKind(false) }} onClose={() => setKiesKind(false)} />}
      {bewerk && <ProgrammaModal start={bewerk} onClose={() => setBewerk(null)} />}
      {standaardOpen && <StandaardBegeleiding onClose={() => setStandaardOpen(false)} />}
      {klaarVraag && (
        <ResetModal
          titel="Nieuwe wedstrijd op het veld zetten?"
          regels={[
            { icoon: '⚽', tekst: `Er staat nog een wedstrijd op het veld (${score.wij} – ${score.zij}). Sluit die eerst af in Historie als je hem wilt bewaren.` },
            { icoon: '🔀', tekst: 'De nieuwe wedstrijd begint met een geloote opstelling; wissels, score en timer op 0' },
          ]}
          bevestig="Ja, op het veld zetten"
          onConfirm={() => klaarzetten(klaarVraag, true)}
          onCancel={() => setKlaarVraag(null)}
        />
      )}
    </div>
  )
}

function KindKiezen({ gekozen, onKlaar, onClose }: { gekozen: string[]; onKlaar: (ids: string[]) => void; onClose: () => void }) {
  useTerug(true, onClose)
  const { spelers } = useHockey()
  const [ids, setIds] = useState(gekozen)
  const wissel = (id: string) => setIds(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Mijn kind</div>
        <div className="modal-subtitle">Je kunt er meer kiezen.</div>
        <div className="modal-options">
          {[...spelers].sort((a, b) => a.naam.localeCompare(b.naam)).map(s => (
            <button key={s.id} className={`modal-option ${ids.includes(s.id) ? 'selected' : ''}`} onClick={() => wissel(s.id)} aria-pressed={ids.includes(s.id)}>
              <span className="modal-option-name">{s.naam}</span>
              {ids.includes(s.id) && <span className="modal-option-place">✓</span>}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" onClick={() => onKlaar(ids)}>Klaar</button>
        </div>
      </div>
    </div>
  )
}

const NIEUWE_CLUB = '__nieuw__'

function ProgrammaModal({ start, onClose }: { start: ProgrammaItem; onClose: () => void }) {
  useTerug(true, onClose)
  const { spelers, clubs, programma, clubToevoegen, bewaarProgramma, verwijderProgramma } = useHockey()
  const { teamInstellingen } = useAccount()
  const [p, setP] = useState<ProgrammaItem>(start)
  // Thuis/uit omzetten: begeleidingsplekken zonder gekozen ouder volgen de standaard van het team
  const zetThuis = (thuis: boolean) => {
    const plek = (b: string) => (b === '' || b === NIET_NODIG ? standaardPlek(thuis, teamInstellingen) : b)
    setP({ ...p, thuis, locatieAdres: '', begeleider1: plek(p.begeleider1), begeleider2: plek(p.begeleider2) })
  }
  const [bronFout, setBronFout] = useState('')
  const [herstellen, setHerstellen] = useState(false)
  const [nieuweClub, setNieuweClub] = useState<string | null>(null)
  const [wegVraag, setWegVraag] = useState(false)
  useTerug(wegVraag, () => setWegVraag(false))
  const bestaat = programma.some(x => x.id === start.id)
  const zet = (velden: Partial<ProgrammaItem>) => setP({ ...p, ...velden })
  const spelerKeuzes = [...spelers].sort((a, b) => a.naam.localeCompare(b.naam))

  const opslaan = () => {
    let item = { ...p, reisMinuten: null }
    if (p.soort === 'wedstrijd' && nieuweClub !== null && nieuweClub.trim()) {
      const id = clubToevoegen(nieuweClub)
      item = { ...item, clubId: id, tegenstander: nieuweClub.trim() }
    } else if (p.soort === 'wedstrijd') {
      item = { ...item, tegenstander: clubs.find(c => c.id === p.clubId)?.naam ?? (p.bronId ? p.tegenstander : '') }
    }
    if (item.soort === 'vrij') item = { ...item, clubId: '', tegenstander: '', verzamelen: '', verzamelDatum: '', reisMinuten: null, locatieAdres: '', spelen: '', fruit: '', begeleider1: '', begeleider2: '' }
    else item = { ...item, tot: '' }
    if (item.tot && item.tot < item.datum) item = { ...item, tot: '' }
    bewaarProgramma(item)
    tel(bestaat ? 'programma-gewijzigd' : 'programma-toegevoegd')
    onClose()
  }

  // Hoe vaak iemand dit seizoen al fruit heeft / begeleidt (geweest en gepland, zonder deze datum)
  const anderen = programma.filter(x => x.id !== p.id && x.soort === 'wedstrijd')
  const telFruit = (id: string) => anderen.filter(x => x.fruit === id).length
  const telBegeleiding = (id: string) => anderen.filter(x => x.begeleider1 === id || x.begeleider2 === id).length

  const spelerSelect = (label: string, veld: 'fruit' | 'begeleider1' | 'begeleider2') => {
    const fruit = veld === 'fruit'
    const tel = fruit ? telFruit : telBegeleiding
    // Wie het minst aan de beurt was bovenaan
    const keuzes = [...spelerKeuzes].sort((a, b) => tel(a.id) - tel(b.id) || a.naam.localeCompare(b.naam))
    return (
      <label className="prog-veld">
        {label}
        <select className="modal-input" value={p[veld]} onChange={e => zet({ [veld]: e.target.value })}>
          {fruit ? (
            <option value="">Nog niemand</option>
          ) : (
            <>
              <option value="">Nog te bepalen</option>
              <option value={NIET_NODIG}>Niet nodig</option>
            </>
          )}
          {keuzes.map(s => (
            <option key={s.id} value={s.id}>
              {fruit ? s.naam : `Ouder van ${s.naam}`} · {fruit ? '🍎' : '🚗'} {tel(s.id)}×
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{bestaat ? 'Datum wijzigen' : 'Datum toevoegen'}</div>
        <div className="prog-velden">
          <label className="prog-veld">
            Datum
            <input type="date" className="modal-input" value={p.datum} onChange={e => e.target.value && zet({ datum: e.target.value })} />
          </label>
          <div className="keuze-knoppen" role="radiogroup" aria-label="Soort">
            {(['wedstrijd', 'vrij'] as const).map(s => (
              <button key={s} role="radio" aria-checked={p.soort === s} className={`keuze-knop ${p.soort === s ? 'actief' : ''}`} onClick={() => zet({ soort: s })}>
                {s === 'wedstrijd' ? 'Wedstrijd' : 'Geen wedstrijd'}
              </button>
            ))}
          </div>

          {p.soort === 'vrij' ? (
            <>
              <label className="prog-veld">
                Omschrijving
                <input className="modal-input" placeholder="bijv. Herfstvakantie" value={p.notitie} onChange={e => zet({ notitie: e.target.value })} />
              </label>
              <label className="prog-veld">
                Tot en met (bij een periode)
                <input type="date" className="modal-input" value={p.tot} onChange={e => zet({ tot: e.target.value })} />
              </label>
            </>
          ) : (
            <>
              <label className="prog-veld">
                Tegenstander
                <select
                  className="modal-input"
                  value={nieuweClub !== null ? NIEUWE_CLUB : p.clubId}
                  onChange={e => { if (e.target.value === NIEUWE_CLUB) setNieuweClub(''); else { setNieuweClub(null); zet({ clubId: e.target.value, tegenstander: clubs.find(c => c.id === e.target.value)?.naam || '', locatieAdres: '' }) } }}
                >
                  <option value="">{p.bronId && !p.clubId ? p.tegenstander : 'Nog niet bekend'}</option>
                  {[...clubs].sort((a, b) => a.naam.localeCompare(b.naam)).map(c => <option key={c.id} value={c.id}>{c.naam}</option>)}
                  <option value={NIEUWE_CLUB}>+ Nieuwe club…</option>
                </select>
              </label>
              {nieuweClub !== null && (
                <input className="modal-input" placeholder="Naam van de club" value={nieuweClub} onChange={e => setNieuweClub(e.target.value)} autoFocus />
              )}
              <div className="keuze-knoppen" role="radiogroup" aria-label="Thuis of uit">
                {[true, false].map(t => (
                  <button key={String(t)} role="radio" aria-checked={p.thuis === t} className={`keuze-knop ${p.thuis === t ? 'actief' : ''}`} onClick={() => zetThuis(t)}>
                    {t ? 'Thuis' : 'Uit'}
                  </button>
                ))}
              </div>
              <ProgrammaTijd item={p} bewaar={setP} bewerkbaar />
              <label className="prog-veld">Locatie
                <input className="modal-input" maxLength={200} value={p.locatie || ''} onChange={e => zet({ locatie: e.target.value })} />
              </label>
              <VerzameltijdBerekenen item={p} zet={zet} />
              {p.bronStatus && /cancel/i.test(p.bronStatus) && <p className="account-uitleg">Deze wedstrijd is volgens de officiële bron afgelast.</p>}
              {spelerSelect('🍎 Fruit', 'fruit')}
              {spelerSelect('🚗 Spelbegeleiding 1', 'begeleider1')}
              {spelerSelect('🚗 Spelbegeleiding 2', 'begeleider2')}
              <label className="prog-veld">
                Opmerking (mag leeg)
                <input className="modal-input" value={p.notitie} onChange={e => zet({ notitie: e.target.value })} />
              </label>
            </>
          )}
          {p.bronId && <p className="account-uitleg">Officiële wedstrijd. Verzameltijd en taken zijn eigen gegevens; handmatige wijzigingen blijven bij een bronupdate behouden.</p>}
          {Object.entries(p.bronWijziging || {}).map(([veld, waarde]) => <div key={veld}>
            <p className="account-uitleg">Officiële {({ datum: 'datum', spelen: 'aanvangstijd', thuis: 'thuis/uit', tegenstander: 'tegenstander', locatie: 'locatie', locatieAdres: 'wedstrijdadres' } as Record<string, string>)[veld]}: {typeof waarde === 'boolean' ? waarde ? 'thuis' : 'uit' : waarde}. Jouw aanpassing is behouden.</p>
            <button className="btn btn-secondary" onClick={async () => {
              try {
                await pb.send(`/api/hockey/catalogus/programma/${p.id}/herstel`, { method: 'POST', body: { veld } })
                // Sluit de editor zodat de herstelde serverstand via sync wordt opgehaald.
                onClose()
              } catch (e) { setBronFout(foutTekst(e)) }
            }}>Gebruik officiële waarde</button>
          </div>)}
          {bronFout && <p className="account-melding fout" role="alert">{bronFout}</p>}
          {bestaat && p.soort === 'wedstrijd' && (p.bronId || p.bronPlanning) && <button className="btn btn-secondary" disabled={herstellen} onClick={async () => {
            setBronFout('')
            setHerstellen(true)
            try {
              await pb.send(`/api/hockey/catalogus/programma/${p.id}/herstel`, { method: 'POST', body: { veld: 'alles' } })
              onClose()
            } catch (e) { setBronFout(foutTekst(e)) }
            finally { setHerstellen(false) }
          }}>{herstellen ? 'Herstellen…' : 'Herstel brongegevens'}</button>}
          {bestaat && <button className="btn btn-gevaar" onClick={() => setWegVraag(true)}>Verwijderen</button>}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" onClick={opslaan}>Opslaan</button>
        </div>

        {wegVraag && (
          <div className="modal show">
            <div className="modal-content">
              <div className="modal-title">Datum verwijderen?</div>
              <div className="modal-subtitle">{datumTekst(p.datum)} verdwijnt uit het programma.</div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setWegVraag(false)}>Annuleren</button>
                <button className="btn btn-primary knop-rood" onClick={() => { verwijderProgramma(p.id); tel('programma-verwijderd'); onClose() }}>Verwijderen</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Per team: bij uit- of thuiswedstrijden standaard geen spelbegeleiding van ons nodig
function StandaardBegeleiding({ onClose }: { onClose: () => void }) {
  useTerug(true, onClose)
  const { teamInstellingen, zetTeamInstellingen } = useAccount()
  const schakel = (sleutel: 'uitGeenBegeleiding' | 'thuisGeenBegeleiding', label: string, uitleg: string) => (
    <button
      className={`prog-schakel ${teamInstellingen[sleutel] ? 'aan' : ''}`}
      role="switch"
      aria-checked={teamInstellingen[sleutel]}
      onClick={() => { zetTeamInstellingen({ ...teamInstellingen, [sleutel]: !teamInstellingen[sleutel] }); tel(`standaard-${sleutel}`) }}
    >
      <span className="prog-schakel-tekst">
        <span className="prog-schakel-naam">{label}</span>
        <span className="prog-schakel-uitleg">{uitleg}</span>
      </span>
      <span className={`player-toggle ${teamInstellingen[sleutel] ? 'on' : ''}`} aria-hidden="true" />
    </button>
  )
  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Standaard spelbegeleiding</div>
        <div className="modal-subtitle">Geldt voor nieuwe datums en als je thuis/uit omzet. Een gekozen ouder blijft staan.</div>
        <div className="prog-velden">
          {schakel('uitGeenBegeleiding', 'Uitwedstrijd: geen begeleiding nodig', 'Bij uitwedstrijden regelt de thuisclub de spelbegeleiding.')}
          {schakel('thuisGeenBegeleiding', 'Thuiswedstrijd: geen begeleiding nodig', 'Staat dit uit, dan zijn bij thuiswedstrijden twee ouders van ons team nodig.')}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Klaar</button>
        </div>
      </div>
    </div>
  )
}
