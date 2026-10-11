/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  app.save(new Collection({ name: "catalogus_kalenders", type: "base", listRule: "", viewRule: "", createRule: null, updateRule: null, deleteRule: null, fields: [
    { type: "text", name: "bronId", required: true }, { type: "text", name: "naam", required: true },
    { type: "text", name: "seizoen", required: true }, { type: "text", name: "district" },
    { type: "text", name: "spelvorm", required: true }, { type: "text", name: "doelgroep" },
    { type: "text", name: "bron", required: true }, { type: "json", name: "dagen", maxSize: 30000 },
    { type: "json", name: "autoLeeftijden" },
  ], indexes: ["CREATE UNIQUE INDEX idx_kalender_bron ON catalogus_kalenders (bronId)"] }))
  const clubs = app.findCollectionByNameOrId("catalogus_clubs")
  clubs.fields.add(new TextField({ name: "district" })); app.save(clubs)
  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.add(new JSONField({ name: "planningKalenders", maxSize: 3000 }))
  teams.updateRule += ' && @request.body.planningKalenders:isset = false'
  app.save(teams)
  const programma = app.findCollectionByNameOrId("programma")
  programma.fields.add(new JSONField({ name: "bronPlanning", maxSize: 2000 }))
  app.save(programma)
}, () => { throw new Error("Speeldagen terugzetten vereist een gecontroleerde back-up") })
