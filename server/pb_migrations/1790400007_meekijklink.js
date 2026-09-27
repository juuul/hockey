/// <reference path="../pb_data/types.d.ts" />

// Meekijklink per team: een verborgen gast-account dat kijker is in het team. Het wachtwoord van die gast staat in
// 'kijklink' op het team (alleen zichtbaar voor leden) en in de link. Een nieuwe link = nieuw wachtwoord.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new BoolField({ name: "gast" }))
  // Een gast kan zichzelf niet wijzigen of verwijderen (anders kan één meekijker de link voor iedereen breken)
  users.updateRule = "id = @request.auth.id && gast = false && @request.body.superadmin:isset = false && @request.body.gast:isset = false"
  users.deleteRule = "id = @request.auth.id && gast = false"
  app.save(users)

  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.add(new TextField({ name: "kijklink", max: 100 }))
  // Leden mogen de link lezen, maar alleen via /api/hockey/kijklink maken of vernieuwen
  teams.updateRule = '@request.auth.id != "" && (@request.auth.superadmin = true || beheerders.id ?= @request.auth.id) && @request.body.kijklink:isset = false'
  app.save(teams)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("gast")
  users.updateRule = "id = @request.auth.id && @request.body.superadmin:isset = false"
  users.deleteRule = "id = @request.auth.id"
  app.save(users)
  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.removeByName("kijklink")
  teams.updateRule = '@request.auth.id != "" && (@request.auth.superadmin = true || beheerders.id ?= @request.auth.id)'
  app.save(teams)
})
