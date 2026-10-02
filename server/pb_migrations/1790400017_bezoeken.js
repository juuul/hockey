/// <reference path="../pb_data/types.d.ts" />

// Per keer inloggen of de app openen (inlog verversen) één regel, voor het overzicht 'Gebruik per team' van de
// superadmin. Niemand kan dit via de API lezen of schrijven (alleen de hooks); na 180 dagen opgeruimd.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  app.save(new Collection({
    type: "base",
    name: "bezoeken",
    fields: [
      { type: "relation", name: "user", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { type: "autodate", name: "created", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_bezoeken_user ON bezoeken (user, created)"],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId("bezoeken"))
})
