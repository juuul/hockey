/// <reference path="../pb_data/types.d.ts" />

// Shoot-outs na de wedstrijd (O10 en O9): per afgesloten wedstrijd wie nam en of het raak was
// ([{ spelerId, naam, raak }]); leeg bij oudere wedstrijden en bij O11 en ouder.
migrate((app) => {
  const wedstrijden = app.findCollectionByNameOrId("wedstrijden")
  wedstrijden.fields.add(new JSONField({ name: "shootouts", maxSize: 20000 }))
  app.save(wedstrijden)
}, (app) => {
  const wedstrijden = app.findCollectionByNameOrId("wedstrijden")
  wedstrijden.fields.removeByName("shootouts")
  app.save(wedstrijden)
})
