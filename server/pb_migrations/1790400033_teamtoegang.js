// Zelf aansluiten stuurt direct een uitnodiging; blokkades zijn uitsluitend beheerbaar via de serverroutes.
migrate(app => {
  const aanvragen = app.findCollectionByNameOrId("toegangsaanvragen")
  aanvragen.fields.add(new BoolField({ name: "automatisch" }))
  aanvragen.fields.add(new BoolField({ name: "gezien" }))
  aanvragen.fields.getByName("status").values = ["nieuw", "toegelaten", "afgewezen", "geblokkeerd"]
  app.save(aanvragen)
  const teams = app.findCollectionByNameOrId("teams")
  const beheer = '@request.auth.id != "" && (@request.auth.superadmin = true || team.beheerders.id ?= @request.auth.id)'
  app.save(new Collection({ name: "teamblokkades", type: "base", listRule: beheer, viewRule: beheer,
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "team", collectionId: teams.id, maxSelect: 1, required: true, cascadeDelete: true },
      { type: "email", name: "email", required: true },
      { type: "text", name: "naam", max: 60 },
      { type: "autodate", name: "created", onCreate: true },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_teamblokkade_email ON teamblokkades (team, email)'],
  }))
}, app => { throw new Error("Blokkades mogen niet door een rollback verdwijnen") })
