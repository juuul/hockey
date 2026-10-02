/// <reference path="../pb_data/types.d.ts" />

// Uitnodiging: is er al een herinnering gestuurd (na 3 dagen nog niet aangenomen)
migrate((app) => {
  const c = app.findCollectionByNameOrId("uitnodigingen")
  c.fields.add(new BoolField({ name: "herinnerd" }))
  app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("uitnodigingen")
  c.fields.removeByName("herinnerd")
  app.save(c)
})
