/// <reference path="../pb_data/types.d.ts" />

// Mails over nieuwe teams alleen nog naar de superadmin: vlag 'teamaanmeldingen' weer uit voor het gewone account
// van de eigenaar (op id, zie 1790400013). En geen mail meer bij inloggen vanaf een nieuwe plek (authAlert).
const ID = "hazywlk6iifivar"

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.authAlert.enabled = false
  app.save(users)

  try {
    const u = app.findRecordById("users", ID)
    u.set("teamaanmeldingen", false)
    app.save(u)
  } catch (_) {}
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.authAlert.enabled = true
  app.save(users)

  try {
    const u = app.findRecordById("users", ID)
    u.set("teamaanmeldingen", true)
    app.save(u)
  } catch (_) {}
})
