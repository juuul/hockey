/// <reference path="../pb_data/types.d.ts" />

// Bezoek: willekeurig toestel-id uit de app (geen naam of IP), om unieke meekijk-toestellen te tellen
migrate((app) => {
  const c = app.findCollectionByNameOrId("bezoeken")
  c.fields.add(new TextField({ name: "toestel", max: 40 }))
  app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("bezoeken")
  c.fields.removeByName("toestel")
  app.save(c)
})
