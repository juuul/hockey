/// <reference path="../pb_data/types.d.ts" />

// Programma per team (tabblad Programma): wedstrijden met verzamel-/aanvangstijd, fruit en spelbegeleiding,
// en regels zonder wedstrijd (reservedatum, vakantie). Plus per gebruiker welke speelsters 'mijn kind' zijn.
migrate((app) => {
  const teams = app.findCollectionByNameOrId("teams")
  const INGELOGD = '@request.auth.id != ""'
  const LID = `${INGELOGD} && (@request.auth.superadmin = true || team.beheerders.id ?= @request.auth.id || team.kijkers.id ?= @request.auth.id)`
  const BEHEER = `${INGELOGD} && (@request.auth.superadmin = true || team.beheerders.id ?= @request.auth.id)`
  app.save(new Collection({
    type: "base",
    name: "programma",
    fields: [
      { type: "relation", name: "team", collectionId: teams.id, maxSelect: 1, required: true, cascadeDelete: true },
      { type: "text", name: "datum", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { type: "text", name: "tot", pattern: "^(\\d{4}-\\d{2}-\\d{2})?$" },
      { type: "select", name: "soort", values: ["wedstrijd", "vrij"], maxSelect: 1, required: true },
      { type: "text", name: "clubId", max: 40 },
      { type: "text", name: "tegenstander", max: 60 },
      { type: "bool", name: "thuis" },
      { type: "text", name: "verzamelen", pattern: "^(\\d{2}:\\d{2})?$" },
      { type: "text", name: "spelen", pattern: "^(\\d{2}:\\d{2})?$" },
      { type: "text", name: "fruit", max: 40 },
      { type: "text", name: "begeleider1", max: 40 },
      { type: "text", name: "begeleider2", max: 40 },
      { type: "text", name: "notitie", max: 200 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_programma_team ON programma (team)"],
    listRule: LID,
    viewRule: LID,
    createRule: BEHEER,
    updateRule: `${BEHEER} && @request.body.team:isset = false`,
    deleteRule: BEHEER,
  }))

  // 'Mijn kinderen' per team: { "<teamId>": ["<spelerId>", ...] }. De gebruiker zelf mag dit wijzigen (updateRule users)
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new JSONField({ name: "kinderen", maxSize: 5000 }))
  app.save(users)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("programma"))
  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("kinderen")
  app.save(users)
})
