/// <reference path="../pb_data/types.d.ts" />
// Import alleen via een lokale beheeropdracht, geen publiek schrijfendpoint.
$app.rootCmd.addCommand(new Command({ use: "catalogus-import", run: (cmd, args) => {
  if (!args.length) throw new Error("Geef een lokaal JSON-bestand op")
  const data = JSON.parse(String.fromCharCode.apply(null, $os.readFile(args[0])))
  require(`${__hooks}/catalogus.js`).importeer($app, data)
  if (data.taakId) {
    const t = $app.findRecordById("catalogus_taken", data.taakId)
    t.set("status", "klaar"); t.set("fout", ""); $app.save(t)
  }
  console.log("Catalogus bijgewerkt: " + data.clubs.length + " clubs, " + data.teams.length + " teams, " + data.wedstrijden.length + " wedstrijden")
} }))
$app.rootCmd.addCommand(new Command({ use: "catalogus-taken", run: () => {
  const taken = $app.findRecordsByFilter("catalogus_taken", "status = 'nieuw' || (status = 'bezig' && updated < {:oud})", "created", 3, 0, { oud: new Date(Date.now() - 10 * 60 * 1000).toISOString() })
  console.log(JSON.stringify(taken.map((t) => ({ id: t.id, clubBronId: t.getString("clubBronId"), teamBronId: t.getString("teamBronId"), pouleId: t.getString("pouleId"), seizoen: t.getString("teamBronId") ? t.getString("sleutel").split(":")[2] : "" }))))
} }))
$app.rootCmd.addCommand(new Command({ use: "catalogus-taakstatus", run: (cmd, args) => {
  const t = $app.findRecordById("catalogus_taken", args[0])
  t.set("status", args[1]); t.set("fout", args[1] === "fout" ? "Bron tijdelijk niet bereikbaar; probeer later opnieuw." : ""); $app.save(t)
} }))
routerAdd("POST", "/api/hockey/catalogus/club/{id}/ververs", (e) => {
  const c = e.app.findRecordById("catalogus_clubs", e.request.pathValue("id"))
  require(`${__hooks}/catalogus.js`).zetTaak(e.app, c)
  return e.json(200, { ok: true })
})
routerAdd("POST", "/api/hockey/catalogus/team/{id}/ververs", (e) => {
  const t = e.app.findRecordById("catalogus_teams", e.request.pathValue("id"))
  const c = e.app.findFirstRecordByData("catalogus_clubs", "bronId", t.getString("clubBronId"))
  require(`${__hooks}/catalogus.js`).zetTaak(e.app, c, t)
  return e.json(200, { ok: true })
})
// Alleen openbare omgevingsnamen en id's, nooit leden, spelers, e-mail of deelbare tokens.
routerAdd("GET", "/api/hockey/catalogus/team/{id}/omgevingen", (e) => {
  const id = e.app.findRecordById("catalogus_teams", e.request.pathValue("id")).id
  const lijst = e.app.findRecordsByFilter("teams", "officieelTeam = {:id} && vindbaar = true", "naam", 100, 0, { id })
  return e.json(200, lijst.map((t) => ({ id: t.id, naam: t.getString("naam"), omgevingNaam: t.getString("omgevingNaam") })))
})
routerAdd("POST", "/api/hockey/catalogus/omgeving/{id}/aanvraag", (e) => {
  const h = require(`${__hooks}/hockey.js`)
  const team = e.app.findRecordById("teams", e.request.pathValue("id"))
  if (!team.getBool("vindbaar") || !team.getString("officieelTeam")) throw new NotFoundError("Teamomgeving niet gevonden")
  return e.json(200, h.maakAanvraag(e.app, team, e.requestInfo().body))
})
routerAdd("POST", "/api/hockey/catalogus/omgeving/{id}/koppel", (e) => {
  if (!e.auth || e.auth.collection().name !== "users" || e.auth.getBool("gast")) throw new UnauthorizedError("Log eerst in")
  const team = e.app.findRecordById("teams", e.request.pathValue("id"))
  if (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id)) throw new ForbiddenError("Alleen beheerders")
  const officieel = e.app.findRecordById("catalogus_teams", String(e.requestInfo().body.officieelTeam || ""))
  // Een gekoppelde omgeving niet naar een ander officieel team/seizoen verplaatsen.
  if (team.getString("officieelTeam") && team.getString("officieelTeam") !== officieel.id) throw new BadRequestError("Dit team is al gekoppeld; maak voor een ander seizoen een nieuwe omgeving.")
  e.app.runInTransaction((tx) => {
    team.set("officieelTeam", officieel.id)
    tx.save(team)
    require(`${__hooks}/catalogus.js`).synchroniseer(tx, team)
  })
  return e.json(200, { ok: true })
})
// Maak een eigen omgeving voor een bevestigd bestaand account, zonder opnieuw naam/email te vragen.
routerAdd("POST", "/api/hockey/catalogus/omgeving", (e) => {
  if (!e.auth || e.auth.collection().name !== "users" || e.auth.getBool("gast") || !e.auth.verified()) throw new UnauthorizedError("Log in met een bevestigd account")
  const b = e.requestInfo().body
  const officieel = e.app.findRecordById("catalogus_teams", String(b.officieelTeam || ""))
  let id
  e.app.runInTransaction((tx) => {
    const team = new Record(tx.findCollectionByNameOrId("teams"))
    const extra = String(b.omgevingNaam || "").trim().slice(0, 40)
    team.set("naam", (officieel.getString("naam") + " · " + officieel.getString("seizoen") + (extra ? " · " + extra : "")).slice(0, 60))
    team.set("omgevingNaam", extra); team.set("officieelTeam", officieel.id)
    team.set("vindbaar", true); team.set("beheerders", [e.auth.id]); tx.save(team)
    require(`${__hooks}/catalogus.js`).synchroniseer(tx, team)
    id = team.id
  })
  return e.json(200, { id })
})
// Bronwaarden herstellen is een expliciete beheeractie per wedstrijdveld.
routerAdd("POST", "/api/hockey/catalogus/programma/{id}/herstel", (e) => {
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError("Log eerst in")
  const p = e.app.findRecordById("programma", e.request.pathValue("id"))
  const team = e.app.findRecordById("teams", p.getString("team"))
  if (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id)) throw new ForbiddenError("Alleen beheerders")
  const w = e.app.findFirstRecordByData("catalogus_wedstrijden", "bronId", p.getString("bronId"))
  const officieel = e.app.findRecordById("catalogus_teams", team.getString("officieelTeam"))
  const thuis = w.getString("thuisBronId") === officieel.getString("bronId")
  const velden = { datum: w.getString("datum"), spelen: w.getString("spelen"), thuis, tegenstander: w.getString(thuis ? "uitNaam" : "thuisNaam"), locatie: w.getString("locatie") }
  const veld = String(e.requestInfo().body.veld || "")
  if (!Object.hasOwn(velden, veld)) throw new BadRequestError("Onbekend wedstrijdveld")
  p.set(veld, velden[veld])
  e.app.save(p)
  require(`${__hooks}/catalogus.js`).synchroniseer(e.app, team)
  return e.json(200, { ok: true })
})
// Alleen teams die werkelijk in gebruik zijn regelmatig verversen, geen rondgang door heel Nederland.
cronAdd("catalogus", "30 7 * * *", () => {
  const h = require(`${__hooks}/catalogus.js`)
  for (const team of $app.findRecordsByFilter("teams", "officieelTeam != ''", "", 0, 0)) {
    const t = $app.findRecordById("catalogus_teams", team.getString("officieelTeam"))
    const c = $app.findFirstRecordByData("catalogus_clubs", "bronId", t.getString("clubBronId"))
    h.zetTaak($app, c, t)
  }
})
// Bronmetadata is serverbeheer; een oude/offline client mag deze niet verwijderen of vervalsen.
onRecordUpdateRequest((e) => {
  for (const veld of ["bronId", "bronBasis", "bronWijziging", "bronStatus"]) e.record.set(veld, e.record.original().get(veld))
  e.next()
}, "programma")
onRecordCreateRequest((e) => {
  e.record.set("bronId", ""); e.record.set("bronStatus", ""); e.record.set("bronBasis", null); e.record.set("bronWijziging", null)
  e.next()
}, "programma")
// Laatste beheerder beschermen bij rollen wijzigen; serverimports vallen niet onder requesthooks.
onRecordUpdateRequest((e) => {
  if (e.record.original().getStringSlice("beheerders").length && !e.record.getStringSlice("beheerders").length) throw new BadRequestError("Wijs eerst een andere beheerder aan")
  e.next()
}, "teams")
onRecordDeleteRequest((e) => {
  const teams = e.app.findRecordsByFilter("teams", "beheerders.id ?= {:id}", "", 0, 0, { id: e.record.id })
  if (teams.some(t => t.getStringSlice("beheerders").length === 1)) throw new BadRequestError("Draag je team eerst over aan een andere beheerder")
  e.next()
}, "users")

// Bewust verwijderde officiële wedstrijden niet opnieuw aanmaken bij een bronupdate.
onRecordDeleteRequest((e) => {
  if (e.record.getString("bronId")) {
    e.app.runInTransaction((tx) => {
      const team = tx.findRecordById("teams", e.record.getString("team"))
      let ids = []
      try { ids = JSON.parse(team.getString("bronGenegeerd") || "[]") || [] } catch (_) {}
      team.set("bronGenegeerd", [...new Set([...ids, e.record.getString("bronId")])])
      tx.save(team)
    })
  }
  e.next()
}, "programma")
