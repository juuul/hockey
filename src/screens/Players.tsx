import { useState } from 'react'
import { useHockey } from '../context/HockeyContext'
import { useAccount } from '../context/AccountContext'
import { OPSTELLINGEN_PER_SPELVORM, opstellingTekst, Player } from '../types'
import AddPlayerModal from '../components/AddPlayerModal'
import DeletePlayerModal from '../components/DeletePlayerModal'
import { tel } from '../statistiek'
import './Players.css'
import './Account.css'

export default function Players({ openAccount }: { openAccount: () => void }) {
  const { gebruiker, actiefTeam } = useAccount()
  const { spelers, addSpeler, deleteSpeler, zetMeedoen, doelpunten, spelvorm, opstelling, kiesOpstelling, magBewerken, sync, live } = useHockey()
  const syncTeken = (sync && (sync.offline || sync.fout)) || (live && !live.verbonden) ? ' ⚠' : (sync && sync.wachtend) || live?.wachtend ? ' ⏳' : ''
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string; naam: string } | null>(null)

  const aantalMee = spelers.filter(s => s.meedoen).length

  const handleDelete = (id: string, naam: string) => {
    setPlayerToDelete({ id, naam })
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    if (playerToDelete) {
      deleteSpeler(playerToDelete.id)
      tel('speler-verwijderd')
      setShowDeleteModal(false)
      setPlayerToDelete(null)
    }
  }

  const handleAddPlayer = (naam: string) => {
    addSpeler(naam)
    tel('speler-toegevoegd')
    setShowAddModal(false)
  }

  const schakel = (player: Player) => {
    zetMeedoen(player.id, !player.meedoen)
    tel(player.meedoen ? 'afgemeld' : 'aangemeld')
  }

  return (
    <div className="players-screen">
      <button className="account-knop" onClick={openAccount}>
        <span aria-hidden="true">👤</span>
        <span className="account-knop-tekst">
          {gebruiker ? `${actiefTeam ? actiefTeam.naam : 'Zonder team'} · ${gebruiker.name || gebruiker.email}${syncTeken}` : 'Inloggen'}
        </span>
        <span aria-hidden="true">›</span>
      </button>
      <div className="spelvorm-kop">Aantal spelers (met keeper)</div>
      <div className="spelvorm" role="radiogroup" aria-label="Aantal spelers">
        {([11, 9, 6] as const).map(v => (
          <button
            key={v}
            role="radio"
            aria-checked={spelvorm === v}
            className={`spelvorm-knop ${spelvorm === v ? 'actief' : ''}`}
            onClick={() => { if (v !== spelvorm) { kiesOpstelling(OPSTELLINGEN_PER_SPELVORM[v][0]); tel(`spelvorm-${v}`) } }}
            disabled={!magBewerken}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="spelvorm" role="radiogroup" aria-label="Opstelling">
        {OPSTELLINGEN_PER_SPELVORM[spelvorm].map(naam => (
          <button
            key={naam}
            role="radio"
            aria-checked={opstelling === naam}
            className={`spelvorm-knop ${opstelling === naam ? 'actief' : ''}`}
            onClick={() => { kiesOpstelling(naam); tel(`opstelling-${naam}`) }}
            disabled={!magBewerken}
          >
            {opstellingTekst(naam)}
          </button>
        ))}
      </div>

      <div className="section-header">
        <div className="section-title">Wie doet mee?</div>
        {magBewerken && <button className="btn-icon" onClick={() => setShowAddModal(true)}>+ Speler</button>}
      </div>
      <p className="players-uitleg">{magBewerken
        ? 'Tik op een speler om aan of af te melden. Wie niet meedoet, komt niet in de opstelling en niet bij de wissels.'
        : 'Alleen beheerders kunnen aan- en afmelden.'}</p>

      <div className="players-list">
        {spelers.map(player => (
          <div key={player.id} className={`player-card ${player.meedoen ? 'doet-mee' : 'doet-niet-mee'}`}>
            <button
              className="meedoen-knop"
              role="switch"
              aria-checked={player.meedoen}
              onClick={() => schakel(player)}
              disabled={!magBewerken}
            >
              <span className="player-info">
                <span className="player-naamregel">
                  <span className="player-name">{player.naam}</span>
                  {doelpunten.includes(player.id) && (
                    <span className="player-goals" aria-label={`${doelpunten.filter(d => d === player.id).length} doelpunten`}>
                      ⚽ {doelpunten.filter(d => d === player.id).length}
                    </span>
                  )}
                </span>
                <span className="player-status">{player.meedoen ? 'Doet mee' : 'Doet niet mee'}</span>
              </span>
              <span className={`player-toggle ${player.meedoen ? 'on' : ''}`} aria-hidden="true" />
            </button>
            {magBewerken && <button
              className="delete-btn"
              onClick={() => handleDelete(player.id, player.naam)}
              aria-label={`${player.naam} verwijderen`}
            >
              ✕
            </button>}
          </div>
        ))}
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-value">{aantalMee}</div>
          <div className="stat-label">Doen mee</div>
        </div>
        <div className="stat">
          <div className="stat-value">{spelers.length - aantalMee}</div>
          <div className="stat-label">Doen niet mee</div>
        </div>
      </div>

      {showAddModal && (
        <AddPlayerModal
          onAdd={handleAddPlayer}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showDeleteModal && playerToDelete && (
        <DeletePlayerModal
          playerName={playerToDelete.naam}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}
