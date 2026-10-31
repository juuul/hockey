migrate(app => {
  const c = app.findCollectionByNameOrId("catalogus_taken")
  c.fields.add(new TextField({ name: "opnieuwNa", max: 40 }))
  c.fields.add(new NumberField({ name: "pogingen", min: 0, onlyInt: true }))
  app.save(c)
}, app => { throw new Error("Wachtende bronherpogingen behouden") })
