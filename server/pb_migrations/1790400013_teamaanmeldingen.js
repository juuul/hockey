/// <reference path="../pb_data/types.d.ts" />

// Vlag 'teamaanmeldingen' op een gebruiker: krijgt (naast de superadmins) de mails over nieuwe teams en mag ze in
// de app zien en goedkeuren, zonder superadmin te zijn (dus zonder alle teams te zien). Niemand kan de vlag bij
// zichzelf zetten. Aan voor het gewone account van de eigenaar (op id: geen e-mailadres in de openbare repo;
// bestaat het account niet, bv. op een testserver, dan gebeurt er niets).
const ID = "hazywlk6iifivar"

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new BoolField({ name: "teamaanmeldingen" }))
  users.updateRule = "id = @request.auth.id && gast = false && @request.body.superadmin:isset = false && @request.body.gast:isset = false && @request.body.teamaanmeldingen:isset = false"
  app.save(users)

  const aanmeldingen = app.findCollectionByNameOrId("aanmeldingen")
  const MAG = '@request.auth.id != "" && (@request.auth.superadmin = true || @request.auth.teamaanmeldingen = true)'
  aanmeldingen.listRule = MAG
  aanmeldingen.viewRule = MAG
  aanmeldingen.deleteRule = MAG
  app.save(aanmeldingen)

  try {
    const u = app.findRecordById("users", ID)
    u.set("teamaanmeldingen", true)
    app.save(u)
  } catch (_) {}
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("teamaanmeldingen")
  users.updateRule = "id = @request.auth.id && gast = false && @request.body.superadmin:isset = false && @request.body.gast:isset = false"
  app.save(users)
  const aanmeldingen = app.findCollectionByNameOrId("aanmeldingen")
  const SA = '@request.auth.id != "" && @request.auth.superadmin = true'
  aanmeldingen.listRule = SA
  aanmeldingen.viewRule = SA
  aanmeldingen.deleteRule = SA
  app.save(aanmeldingen)
})
