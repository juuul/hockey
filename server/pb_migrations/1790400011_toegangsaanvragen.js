/// <reference path="../pb_data/types.d.ts" />

// Ouders vragen zelf toegang aan via een aanmeldlink van het team (geen e-mailadressen verzamelen door de beheerder).
// Beheerders krijgen een mail en laten toe (als kijker of beheerder) of wijzen af. Toelaten = de gewone uitnodiging,
// met naam en kind al ingevuld.
migrate((app) => {
  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.add(new TextField({ name: "aanvraaglink", max: 100 }))
  teams.updateRule = '@request.auth.id != "" && (@request.auth.superadmin = true || beheerders.id ?= @request.auth.id) && @request.body.kijklink:isset = false && @request.body.aanvraaglink:isset = false'
  app.save(teams)

  const BEHEERDER = '@request.auth.id != "" && (@request.auth.superadmin = true || team.beheerders.id ?= @request.auth.id)'
  app.save(new Collection({
    type: "base",
    name: "toegangsaanvragen",
    fields: [
      { type: "relation", name: "team", collectionId: teams.id, maxSelect: 1, required: true, cascadeDelete: true },
      { type: "text", name: "naam", required: true, max: 60 },
      { type: "email", name: "email", required: true },
      { type: "text", name: "kindId", max: 40 },
      { type: "text", name: "kindNaam", max: 60 },
      { type: "text", name: "terug", required: true, max: 200 },
      { type: "text", name: "token", hidden: true },
      { type: "select", name: "status", values: ["nieuw", "toegelaten", "afgewezen"], maxSelect: 1, required: true },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    listRule: BEHEERDER,
    viewRule: BEHEERDER,
    createRule: null,
    updateRule: null,
    deleteRule: BEHEERDER,
  }))

  const uitnodigingen = app.findCollectionByNameOrId("uitnodigingen")
  uitnodigingen.fields.add(new TextField({ name: "naam", max: 60 }))
  uitnodigingen.fields.add(new JSONField({ name: "kinderen", maxSize: 2000 }))
  app.save(uitnodigingen)

  const settings = app.settings()
  settings.rateLimits.rules = [
    ...settings.rateLimits.rules.filter((r) => r.label !== "POST /api/hockey/aanvraag/"),
    { label: "POST /api/hockey/aanvraag/", audience: "", duration: 3600, maxRequests: 5 },
  ]
  app.save(settings)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("toegangsaanvragen"))
})
