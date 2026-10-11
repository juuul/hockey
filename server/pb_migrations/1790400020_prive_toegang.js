/// <reference path="../pb_data/types.d.ts" />
// Anonieme gastaccounts geven geen toegang meer tot namen of opstellingen.
migrate((app) => {
  for (const u of app.findRecordsByFilter("users", "gast = true", "", 0, 0)) {
    for (const t of app.findRecordsByFilter("teams", "kijkers.id ?= {:id}", "", 0, 0, { id: u.id })) {
      t.set("kijkers", t.getStringSlice("kijkers").filter((id) => id !== u.id))
      t.set("kijklink", "")
      app.save(t)
    }
    app.delete(u)
  }
}, (app) => { throw new Error("Ingetrokken gasttoegang wordt niet automatisch hersteld.") })
