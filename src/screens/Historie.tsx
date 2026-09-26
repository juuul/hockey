import { useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { GespeeldeWedstrijd, opstellingTekst } from '../types'
import { balans, clubNaam, datumTekst, perTegenstander, sorteerWedstrijden, topscorers, uitslag, vindClub } from '../historie'
import WedstrijdModal from '../components/WedstrijdModal'
import { tel } from '../statistiek'
import '../components/Modal.css'
import './Historie.css'

const UITSLAG_TEKST = { W: 'gewonnen', G: 'gelijk', V: 'verloren' }

export default function Historie() {
  const { spelers, clubs, wedstrijden, wijzigWedstrijd, verwijderWedstrijd, hernoemClub, verwijderClub, magBewerken } = useHockey()
  const [open, setOpen] = useState<GespeeldeWedstrijd | null>(null)
  const [wijzig, setWijzig] = useState<GespeeldeWedstrijd | null>(null)
  const [weg, setWeg] = useState<GespeeldeWedstrijd | null>(null)
  const [club, setClub] = useState<{ id: string; naam: string } | null>(null)
  const [nieuweNaam, setNieuweNaam] = useState('')

  const totaal = balans(wedstrijden)
  const scorers = topscorers(wedstrijden, spelers)
  const tegenstanders = perTegenstander(wedstrijden, clubs)
  const naamBezet = club && nieuweNaam.trim() !== '' && vindClub(clubs, nieuweNaam)?.id !== undefined && vindClub(clubs, nieuweNaam)?.id !== club.id

  const scorerRegels = (w: GespeeldeWedstrijd) =>
    topscorers([w], spelers).map(s => `${s.naam}${s.aantal > 1 ? ` ${s.aantal}×` : ''}`).join(', ')

  if (wedstrijden.length === 0 && clubs.length === 0) {
    return (
      <div className="historie">
        <p className="historie-leeg">Nog geen wedstrijden. Sluit een wedstrijd af onderaan het Dashboard (scroll omlaag).</p>
      </div>
    )
  }

  return (
    <div className="historie">
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
          titel={`Wijzigen: ${wijzig.wij} – ${wijzig.zij}`}
          start={{ datum: wijzig.datum, clubId: wijzig.clubId, thuis: wijzig.thuis }}
          bevestig="Opslaan"
          clubVerplicht
          onOpslaan={(info, naam) => { wijzigWedstrijd(wijzig.id, info, naam); tel('wedstrijd-gewijzigd'); setWijzig(null) }}
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
