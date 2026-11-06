// Blokkades gelden ook voor handmatig uitnodigen en directe wijzigingen in de ledenlijst.
onRecordCreate(e => {
  require(`${__hooks}/teamtoegang.js`).controleer(e.app, e.record.getString("team"), e.record.getString("email")); e.next()
}, "uitnodigingen")
onRecordUpdate(e => {
  const h = require(`${__hooks}/teamtoegang.js`)
  for (const id of [...e.record.getStringSlice("beheerders"), ...e.record.getStringSlice("kijkers")]) {
    const user = e.app.findRecordById("users", id)
    h.controleer(e.app, e.record.id, user.email())
  }
  e.next()
}, "teams")
routerAdd("POST", "/api/hockey/teamtoegang/{team}", e => {
  const h = require(`${__hooks}/teamtoegang.js`), b = e.requestInfo().body
  const team = e.app.findRecordById("teams", e.request.pathValue("team"))
  h.beheerder(e, team)
  if (b.actie === "blokkeren") h.blokkeer(e.app, team, b.email, b.naam, e.auth.id)
  else if (b.actie === "deblokkeren") h.deblokkeer(e.app, team, String(b.id || ""), String(b.terug || ""))
  else throw new BadRequestError("Onbekende actie")
  return e.json(200, { ok: true })
})
// Alleen het eigen lidmaatschap opzeggen; gegevens en overige leden blijven staan.
routerAdd("POST", "/api/hockey/team/{team}/verlaten", e => {
  if (!e.auth || e.auth.collection().name !== "users" || e.auth.getBool("gast")) throw new UnauthorizedError("Log eerst in met je eigen account")
  require(`${__hooks}/teamtoegang.js`).verlaten(e.app, e.request.pathValue("team"), e.auth)
  return e.json(200, { ok: true })
})
