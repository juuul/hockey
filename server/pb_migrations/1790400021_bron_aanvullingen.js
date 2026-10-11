/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.add(new JSONField({ name: "bronGenegeerd", hidden: true, maxSize: 20000 }))
  teams.updateRule += ' && @request.body.bronGenegeerd:isset = false'
  app.save(teams)
  const p = app.findCollectionByNameOrId("programma")
  p.fields.add(new TextField({ name: "locatie", max: 200 }))
  p.fields.add(new TextField({ name: "bronStatus", max: 40 }))
  app.save(p)
}, (app) => { throw new Error("Herstel via gecontroleerde back-up") })
