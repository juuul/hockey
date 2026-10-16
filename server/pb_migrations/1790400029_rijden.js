// Rijbeurten blijven privé onder de bestaande programma-/teamrechten.
migrate(app => {
  const c = app.findCollectionByNameOrId("programma")
  c.fields.add(new JSONField({ name: "rijders", maxSize: 10000 }))
  app.save(c)
}, () => { throw new Error("Herstel via gecontroleerde back-up; rijbeurten niet verwijderen") })
