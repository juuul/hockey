/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  app.save(new Collection({ name: "app_config", type: "base", listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null, fields: [
    { type: "text", name: "sleutel", required: true }, { type: "json", name: "waarde", maxSize: 2000 },
  ], indexes: ["CREATE UNIQUE INDEX idx_app_config_sleutel ON app_config (sleutel)"] }))
  const t = app.findCollectionByNameOrId("teams")
  t.fields.add(new JSONField({ name: "reisInstellingen", maxSize: 2000 }))
  t.updateRule += ' && @request.body.reisInstellingen:isset = false'; app.save(t)
  const c = app.findCollectionByNameOrId("catalogus_clubs")
  c.fields.add(new TextField({ name: "adres", max: 300 })); app.save(c)
  const w = app.findCollectionByNameOrId("catalogus_wedstrijden")
  w.fields.add(new TextField({ name: "locatieAdres", max: 300 })); app.save(w)
  const p = app.findCollectionByNameOrId("programma")
  p.fields.add(new TextField({ name: "locatieAdres", max: 300 }))
  p.fields.add(new TextField({ name: "verzamelDatum", max: 10 }))
  p.fields.add(new JSONField({ name: "reisMinuten", maxSize: 100 }))
  app.save(p)
  const s = app.settings()
  s.rateLimits.rules.push({ label: "POST /api/hockey/reistijd/", audience: "", duration: 3600, maxRequests: 30 })
  app.save(s)
}, () => { throw new Error("Herstel via gecontroleerde back-up") })
