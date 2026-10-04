import { useState } from 'react'
import { useTerug } from '../terug'
import { useHockey } from '../context/HockeyContext'
import { GespeeldeWedstrijd, opstellingTekst } from '../types'
import { balans, clubNaam, datumTekst, perTegenstander, sorteerWedstrijden, speeltijdSeizoen, topscorers, uitslag, vindClub } from '../historie'
import { LINIE_NAAM, LINIES, minuten, opVeld } from '../speeltijd'
import WedstrijdModal from '../components/WedstrijdModal'
import DezeWedstrijd from '../components/DezeWedstrijd'
import { tel } from '../statistiek'
import '../components/Modal.css'
import './Historie.css'

const UITSLAG_TEKST = { W: 'gewonnen', G: 'gelijk', V: 'verloren' }

export default function Historie() {
  const { spelers, clubs, wedstrijden, wijzigWedstrijd, verwijderWedstrijd, hernoemClub, verwijderClub, magBeheren: magBewerken } = useHockey()
  const [open, setOpen] = useState<GespeeldeWedstrijd | null>(null)
  const [wijzig, setWijzig] = useState<GespeeldeWedstrijd | null>(null)
  const [weg, setWeg] = useState<GespeeldeWedstrijd | null>(null)
  const [club, setClub] = useState<{ id: string; naam: string } | null>(null)
  const [nieuweNaam, setNieuweNaam] = useState('')
  // Wedstrijdlijst filteren op tegenstander ('' = alle)
  const [filterClub, setFilterClub] = useState('')
  // Terugknop van de telefoon sluit de open pop-up (wijzigen heeft een eigen WedstrijdModal)
  useTerug(!!open, () => setOpen(null))
  useTerug(!!weg, () => setWeg(null))
  useTerug(!!club, () => setClub(null))

  const totaal = balans(wedstrijden)
  const scorers = topscorers(wedstrijden, spelers)
  const tegenstanders = perTegenstander(wedstrijden, clubs)
  const seizoen = speeltijdSeizoen(wedstrijden, spelers)
  // Eén lijst per speler: doelpunten en speeltijd samen (op alfabet; onbekende scorer onderaan)
  const perSpeler = [...new Set([...scorers.map(s => s.id), ...seizoen.map(s => s.id)])]
    .map(id => {
      const sc = scorers.find(s => s.id === id)
      const sz = seizoen.find(s => s.id === id)
      return { id, naam: sz?.naam ?? sc?.naam ?? 'Onbekend', goals: sc?.aantal ?? 0, seizoen: sz }
    })
    .sort((a, b) => Number(a.id === null) - Number(b.id === null) || a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' }))
  const gekozen = tegenstanders.find(t => t.clubId === filterClub)
  const zichtbareWedstrijden = sorteerWedstrijden(filterClub ? wedstrijden.filter(w => w.clubId === filterClub) : wedstrijden)
  // Balk per speler: aandeel per linie (ook wissel) van de tijd dat ze meedeed
  const verdeling = (tijd: Partial<Record<'a' | 'm' | 'v' | 'k' | 'w', number>>) => {
    const totaal = LINIES.reduce((n, l) => n + (tijd[l] ?? 0), 0)
    return (
      <span className="linie-balk" aria-hidden="true">
        {totaal > 0 && LINIES.map(l => (tijd[l] ?? 0) > 0 && <span key={l} className={`linie-deel linie-${l}`} style={{ flexGrow: tijd[l] }} />)}
      </span>
    )
  }
  const linieTekst = (tijd: Partial<Record<'a' | 'm' | 'v' | 'k' | 'w', number>>) =>
    LINIES.filter(l => minuten(tijd[l] ?? 0) > 0).map(l => `${LINIE_NAAM[l].toLowerCase()} ${minuten(tijd[l] ?? 0)}`).join(' · ')
  const naamBezet = club && nieuweNaam.trim() !== '' && vindClub(clubs, nieuweNaam)?.id !== undefined && vindClub(clubs, nieuweNaam)?.id !== club.id

  // Wie kan er gescoord hebben: wie toen meedeed (met de huidige naam als die speler nog bestaat), anders het hele team
  const kandidatenVoor = (w: GespeeldeWedstrijd) =>
    (w.spelers.length ? w.spelers : spelers)
      .map(sp => ({ id: sp.id, naam: spelers.find(x => x.id === sp.id)?.naam ?? sp.naam }))
      .sort((a, b) => a.naam.localeCompare(b.naam))

  const scorerRegels = (w: GespeeldeWedstrijd) =>
    topscorers([w], spelers).map(s => `${s.naam}${s.aantal > 1 ? ` ${s.aantal}×` : ''}`).join(', ')

  if (wedstrijden.length === 0 && clubs.length === 0) {
    return (
      <div className="historie">
        <DezeWedstrijd />
        <p className="historie-leeg">Nog geen afgesloten wedstrijden. Kies hierboven de tegenstander en sluit de wedstrijd na afloop af.</p>
      </div>
    )
  }

  return (
    <div className="historie">
      <DezeWedstrijd />
      {totaal.gespeeld > 0 && (
        <p className="balans-regel">
          {totaal.gespeeld} gespeeld · <span className="balans-W">{totaal.W}W</span> {totaal.G}G <span className="balans-V">{totaal.V}V</span> · doelpunten {totaal.voor} – {totaal.tegen}
        </p>
      )}

      {perSpeler.length > 0 && (
        <section>
          <h2 className="section-title">Spelers</h2>
          {seizoen.length > 0 && (
            <div className="linie-legenda" aria-hidden="true">
              {LINIES.map(l => <span key={l} className="linie-legenda-item"><span className={`linie-stip linie-${l}`} />{LINIE_NAAM[l].toLowerCase()}</span>)}
            </div>
          )}
          <div className="historie-lijst">
            {perSpeler.map(sp => (
              <div
                key={sp.id ?? 'onbekend'}
                className="historie-regel speeltijd-regel"
                aria-label={`${sp.naam}: ${sp.goals} doelpunten${sp.seizoen ? `, ${minuten(opVeld(sp.seizoen.tijd))} minuten in het veld; ${linieTekst(sp.seizoen.tijd)}` : ''}`}
              >
                <span className="speeltijd-kop">
                  <span className="regel-naam">{sp.naam}</span>
                  {sp.goals > 0 && <span className="regel-waarde">⚽ {sp.goals}</span>}
                  {sp.seizoen && <span className="regel-sub speler-min">{minuten(opVeld(sp.seizoen.tijd))} min</span>}
                </span>
                {sp.seizoen && verdeling(sp.seizoen.tijd)}
              </div>
            ))}
          </div>
          {seizoen.length > 0 && <p className="historie-uitleg">Minuten in het veld; de balk toont de verdeling over de linies (wissel = op de bank). Alleen wedstrijden waarin de klok liep.</p>}
        </section>
      )}

      {tegenstanders.length > 0 && (
        <section>
          <div className="wedstrijden-kop">
            <h2 className="section-title">Wedstrijden</h2>
            <select className="club-filter" value={filterClub} onChange={e => setFilterClub(e.target.value)} aria-label="Filter op tegenstander">
              <option value="">Alle clubs</option>
              {tegenstanders.map(t => <option key={t.clubId} value={t.clubId}>{t.naam}</option>)}
            </select>
          </div>
          {gekozen && (
            <div className="club-balans">
              <span className="regel-sub">
                {gekozen.balans.gespeeld === 0 ? 'Nog niet tegen gespeeld' : `${gekozen.balans.W}W ${gekozen.balans.G}G ${gekozen.balans.V}V · ${gekozen.balans.voor} – ${gekozen.balans.tegen}`}
              </span>
              {magBewerken && gekozen.bestaat && (
                <button className="btn btn-secondary" onClick={() => { setClub({ id: gekozen.clubId, naam: gekozen.naam }); setNieuweNaam(gekozen.naam) }}>Club wijzigen</button>
              )}
            </div>
          )}
          <div className="historie-lijst">
            {zichtbareWedstrijden.map(w => (
              <button key={w.id} className="historie-regel wedstrijd-regel" onClick={() => setOpen(w)}>
                <span className="regel-tekst">
                  <span className="regel-naam">{clubNaam(w, clubs)}</span>
                  <span className="regel-sub">{datumTekst(w.datum)} · {w.thuis ? 'thuis' : 'uit'}</span>
                </span>
                <span className={`uitslag ${uitslag(w)}`} aria-label={UITSLAG_TEKST[uitslag(w)]}>{w.wij} – {w.zij}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {open && (
        <div className="modal show" onClick={() => setOpen(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{clubNaam(open, clubs)}</div>
            <div className="modal-subtitle">{datumTekst(open.datum)} · {open.thuis ? 'thuis' : 'uit'}</div>
            <div className="detail">
              <div className={`uitslag groot ${uitslag(open)}`}>{open.wij} – {open.zij}</div>
              <p className="detail-regel">{UITSLAG_TEKST[uitslag(open)]}</p>
              {open.doelpunten.length > 0 && <p className="detail-regel">⚽ {scorerRegels(open)}</p>}
              <p className="detail-regel">{open.spelers.length} speelsters · {opstellingTekst(open.opstelling)}</p>
              {open.spelers.some(sp => sp.tijd) && (
                <div className="detail-speeltijd">
                  {[...open.spelers].filter(sp => sp.tijd).sort((a, b) => opVeld(b.tijd!) - opVeld(a.tijd!)).map(sp => (
                    <div key={sp.id} className="detail-speeltijd-regel">
                      <span className="speeltijd-kop">
                        <span className="regel-naam">{spelers.find(x => x.id === sp.id)?.naam ?? sp.naam}</span>
                        <span className="regel-waarde">{minuten(opVeld(sp.tijd!))} min</span>
                      </span>
                      {verdeling(sp.tijd!)}
                      <span className="regel-sub">{linieTekst(sp.tijd!)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions detail-knoppen">
              {magBewerken && <button className="btn btn-gevaar" onClick={() => { setWeg(open); setOpen(null) }}>Verwijderen</button>}
              {magBewerken && <button className="btn btn-secondary" onClick={() => { setWijzig(open); setOpen(null) }}>Wijzigen</button>}
              <button className="btn btn-primary" onClick={() => setOpen(null)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {wijzig && (
        <WedstrijdModal
          titel="Wedstrijd wijzigen"
          start={{ datum: wijzig.datum, clubId: wijzig.clubId, thuis: wijzig.thuis }}
          bevestig="Opslaan"
          clubVerplicht
          stand={{ zij: wijzig.zij, doelpunten: wijzig.doelpunten }}
          kandidaten={kandidatenVoor(wijzig)}
          onOpslaan={(info, naam, stand) => { wijzigWedstrijd(wijzig.id, info, naam, stand); tel('wedstrijd-gewijzigd'); setWijzig(null) }}
          onClose={() => setWijzig(null)}
        />
      )}

      {weg && (
        <div className="modal show">
          <div className="modal-content">
            <div className="modal-title">Wedstrijd verwijderen?</div>
            <div className="modal-subtitle">{clubNaam(weg, clubs)}, {datumTekst(weg.datum)}: {weg.wij} – {weg.zij}. De doelpunten tellen dan niet meer mee.</div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setWeg(null)}>Annuleren</button>
              <button className="btn btn-primary knop-rood" onClick={() => { verwijderWedstrijd(weg.id); tel('wedstrijd-verwijderd'); setWeg(null) }}>Verwijderen</button>
            </div>
          </div>
        </div>
      )}

      {club && (
        <div className="modal show" onClick={() => setClub(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Club</div>
            <input className="modal-input" value={nieuweNaam} onChange={e => setNieuweNaam(e.target.value)} aria-label="Naam van de club" />
            {naamBezet && <p className="modal-subtitle">Die naam bestaat al.</p>}
            <p className="modal-subtitle">Verwijderen haalt de club uit de keuzelijst. Oude wedstrijden blijven staan.</p>
            <div className="modal-actions detail-knoppen">
              <button className="btn btn-gevaar" onClick={() => { verwijderClub(club.id); tel('club-verwijderd'); setClub(null); setFilterClub('') }}>Verwijderen</button>
              <button className="btn btn-secondary" onClick={() => setClub(null)}>Annuleren</button>
              <button
                className="btn btn-primary"
                disabled={!nieuweNaam.trim() || !!naamBezet}
                onClick={() => { hernoemClub(club.id, nieuweNaam); tel('club-hernoemd'); setClub(null) }}
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
