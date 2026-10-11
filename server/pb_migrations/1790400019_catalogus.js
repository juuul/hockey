/// <reference path="../pb_data/types.d.ts" />
// Openbare brongegevens zijn gescheiden van de bestaande privéteamomgevingen.
migrate((app) => {
  const tijd = [{ type: "autodate", name: "created", onCreate: true }, { type: "autodate", name: "updated", onCreate: true, onUpdate: true }]
  const openbaar = { listRule: "", viewRule: "", createRule: null, updateRule: null, deleteRule: null }
  app.save(new Collection({ name: "catalogus_clubs", type: "base", ...openbaar, fields: [
    { type: "text", name: "bronId", required: true }, { type: "text", name: "naam", required: true },
    { type: "text", name: "plaats" }, { type: "text", name: "gecontroleerd" }, ...tijd,
  ], indexes: ["CREATE UNIQUE INDEX idx_catalogus_club_bron ON catalogus_clubs (bronId)"] }))
  app.save(new Collection({ name: "catalogus_teams", type: "base", ...openbaar, fields: [
    { type: "text", name: "bronId", required: true }, { type: "text", name: "clubBronId", required: true },
    { type: "text", name: "naam", required: true }, { type: "text", name: "seizoen", required: true },
    { type: "text", name: "geslacht" }, { type: "text", name: "leeftijd" }, { type: "text", name: "categorie" },
    { type: "text", name: "spelvorm" }, { type: "text", name: "klasse" }, { type: "text", name: "pouleId" },
    { type: "text", name: "gecontroleerd" }, { type: "bool", name: "actief" }, ...tijd,
  ], indexes: ["CREATE UNIQUE INDEX idx_catalogus_team_bron ON catalogus_teams (bronId, seizoen)"] }))
  app.save(new Collection({ name: "catalogus_wedstrijden", type: "base", ...openbaar, fields: [
    { type: "text", name: "bronId", required: true }, { type: "text", name: "seizoen", required: true },
    { type: "text", name: "thuisBronId", required: true }, { type: "text", name: "uitBronId", required: true },
    { type: "text", name: "datum", required: true }, { type: "text", name: "spelen" },
    { type: "text", name: "thuisNaam" }, { type: "text", name: "uitNaam" }, { type: "text", name: "locatie" },
    { type: "text", name: "status" }, { type: "json", name: "uitslag" },
    { type: "text", name: "gecontroleerd" }, ...tijd,
  ], indexes: ["CREATE UNIQUE INDEX idx_catalogus_wedstrijd_bron ON catalogus_wedstrijden (bronId)"] }))
  app.save(new Collection({ name: "catalogus_taken", type: "base", listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null, fields: [
    { type: "text", name: "sleutel", required: true }, { type: "text", name: "clubBronId", required: true },
    { type: "text", name: "teamBronId" }, { type: "text", name: "pouleId" }, { type: "text", name: "status" },
    { type: "text", name: "fout" }, ...tijd,
  ], indexes: ["CREATE UNIQUE INDEX idx_catalogus_taak ON catalogus_taken (sleutel)"] }))
  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.add(new RelationField({ name: "officieelTeam", collectionId: app.findCollectionByNameOrId("catalogus_teams").id, maxSelect: 1 }))
  teams.fields.add(new BoolField({ name: "vindbaar" }))
  teams.fields.add(new TextField({ name: "omgevingNaam", max: 40 }))
  teams.updateRule += ' && @request.body.officieelTeam:isset = false'
  app.save(teams)
  const aanmeldingen = app.findCollectionByNameOrId("aanmeldingen")
  aanmeldingen.fields.add(new RelationField({ name: "officieelTeam", collectionId: app.findCollectionByNameOrId("catalogus_teams").id, maxSelect: 1 }))
  aanmeldingen.fields.add(new TextField({ name: "omgevingNaam", max: 40 }))
  app.save(aanmeldingen)
  const programma = app.findCollectionByNameOrId("programma")
  programma.fields.add(new TextField({ name: "bronId", max: 40 }))
  programma.fields.add(new JSONField({ name: "bronBasis", maxSize: 2000 }))
  programma.fields.add(new JSONField({ name: "bronWijziging", maxSize: 2000 }))
  programma.indexes.push("CREATE UNIQUE INDEX idx_programma_bron ON programma (team, bronId) WHERE bronId != ''")
  app.save(programma)
  const s = app.settings()
  s.rateLimits.rules.push({ label: "POST /api/hockey/catalogus/", audience: "", duration: 3600, maxRequests: 30 })
  app.save(s)
}, (app) => {
  throw new Error("Catalogus terugzetten vereist een gecontroleerde back-up; privégegevens blijven behouden.")
})
