migrate(app => {
  const c = app.findCollectionByNameOrId("wedstrijden")
  c.fields.getByName("opstelling").max = 40
  app.save(c)
}, () => { throw new Error("Herstel via gecontroleerde back-up") })
