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
  // Terugknop van de telefoon sluit de open pop-up (wijzigen heeft een eigen WedstrijdModal)
  useTerug(!!open, () => setOpen(null))
  useTerug(!!weg, () => setWeg(null))
  useTerug(!!club, () => setClub(null))

  const totaal = balans(wedstrijden)
  const scorers = topscorers(wedstrijden, spelers)
  const tegenstanders = perTegenstander(wedstrijden, clubs)
  const seizoen = speeltijdSeizoen(wedstrijden, spelers)
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
      <div className="balans" aria-label="Balans">
        <div className="balans-vak"><span className="balans-getal">{totaal.gespeeld}</span><span className="balans-naam">gespeeld</span></div>
        <div className="balans-vak W"><span className="balans-getal">{totaal.W}</span><span className="balans-naam">gewonnen</span></div>
        <div className="balans-vak G"><span className="balans-getal">{totaal.G}</span><span className="balans-naam">gelijk</span></div>
        <div className="balans-vak V"><span className="balans-getal">{totaal.V}</span><span className="balans-naam">verloren</span></div>
      </div>
      {totaal.gespeeld > 0 && <p className="doelsaldo">Doelpunten {totaal.voor} – {totaal.tegen}</p>}

      {scorers.length > 0 && (
        <section>
          <h2 className="section-title">Topscorers</h2>
          <ol className="historie-lijst">
            {scorers.map(s => (
              <li key={s.id ?? 'onbekend'} className="historie-regel">
                <span className="regel-naam">{s.naam}</span>
                <span className="regel-waarde">⚽ {s.aantal}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {seizoen.length > 0 && (
        <section>
          <h2 className="section-title">Speeltijd</h2>
          <p className="historie-uitleg">Minuten in het veld, en per linie hoe de tijd verdeeld was (wissel = op de bank). Alleen wedstrijden waarin de klok liep.</p>
          <div className="linie-legenda" aria-hidden="true">
            {LINIES.map(l => <span key={l} className="linie-legenda-item"><span className={`linie-stip linie-${l}`} />{LINIE_NAAM[l]}</span>)}
          </div>
          <div className="historie-lijst">
            {seizoen.map(s => (
              <div key={s.id} className="historie-regel speeltijd-regel" aria-label={`${s.naam}: ${minuten(opVeld(s.tijd))} minuten in het veld; ${linieTekst(s.tijd)}`}>
                <span className="speeltijd-kop">
                  <span className="regel-naam">{s.naam}</span>
                  <span className="regel-waarde">{minuten(opVeld(s.tijd))} min</span>
                </span>
                {verdeling(s.tijd)}
                <span className="regel-sub">{s.wedstrijden} {s.wedstrijden === 1 ? 'wedstrijd' : 'wedstrijden'} · gem. {minuten(opVeld(s.tijd) / s.wedstrijden)} min</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {wedstrijden.length > 0 && (
        <section>
          <h2 className="section-title">Wedstrijden</h2>
          <div className="historie-lijst">
            {sorteerWedstrijden(wedstrijden).map(w => (
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

      {tegenstanders.length > 0 && (
        <section>
          <h2 className="section-title">Tegenstanders</h2>
          {magBewerken && <p className="historie-uitleg">Tik op een club om de naam te wijzigen of te verwijderen.</p>}
          <div className="historie-lijst">
            {tegenstanders.map(t => (
              <button
                key={t.clubId}
                className="historie-regel wedstrijd-regel"
                disabled={!t.bestaat || !magBewerken}
                onClick={() => { setClub({ id: t.clubId, naam: t.naam }); setNieuweNaam(t.naam) }}
              >
                <span className="regel-tekst">
                  <span className="regel-naam">{t.naam}</span>
                  <span className="regel-sub">
                    {t.balans.gespeeld === 0 ? 'nog niet gespeeld' : `${t.balans.W}W ${t.balans.G}G ${t.balans.V}V · ${t.balans.voor} – ${t.balans.tegen}`}
                  </span>
                </span>
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
              <button className="btn btn-gevaar" onClick={() => { verwijderClub(club.id); tel('club-verwijderd'); setClub(null) }}>Verwijderen</button>
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
