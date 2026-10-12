migrate(app => {
  const c = app.findCollectionByNameOrId("programma")
  c.fields.add(new TextField({ name: "verzamelModus", max: 20 }))
  app.save(c)
  for (const p of app.findRecordsByFilter("programma", "", "", 0, 0)) {
    p.set("verzamelModus", p.getString("verzamelen") ? "handmatig" : "automatisch")
    app.save(p)
  }
}, () => { throw new Error("Herstel via gecontroleerde back-up") })
