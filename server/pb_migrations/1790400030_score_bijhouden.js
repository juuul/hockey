// Een wedstrijd zonder score niet als fictief 0–0-gelijkspel meetellen.
// Bestaande wedstrijden behouden hun uitslag (standaard false).
migrate((app) => {
  const wedstrijden = app.findCollectionByNameOrId("wedstrijden")
  wedstrijden.fields.add(new BoolField({ name: "scoreNietBijgehouden" }))
  app.save(wedstrijden)
}, (app) => {
  const wedstrijden = app.findCollectionByNameOrId("wedstrijden")
  wedstrijden.fields.removeByName("scoreNietBijgehouden")
  app.save(wedstrijden)
})
