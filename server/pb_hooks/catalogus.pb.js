/// <reference path="../pb_data/types.d.ts" />
// Import alleen via een lokale beheeropdracht, geen publiek schrijfendpoint.
$app.rootCmd.addCommand(new Command({ use: "catalogus-import", run: (cmd, args) => {
  if (!args.length) throw new Error("Geef een lokaal JSON-bestand op")
  const data = JSON.parse(toString($os.readFile(args[0])))
  require(`${__hooks}/catalogus.js`).importeer($app, data)
  if (data.taakId) {
    const t = $app.findRecordById("catalogus_taken", data.taakId)
    t.set("status", "klaar"); t.set("fout", ""); $app.save(t)
  }
  console.log("Catalogus bijgewerkt: " + data.clubs.length + " clubs, " + data.teams.length + " teams, " + data.wedstrijden.length + " wedstrijden")
} }))
$app.rootCmd.addCommand(new Command({ use: "catalogus-kalenders", run: (cmd, args) => {
  const lijst = JSON.parse(toString($os.readFile(args[0])))
  $app.runInTransaction((tx) => {
    if (!Array.isArray(lijst) || lijst.length > 500) throw new Error("Ongeldig aantal kalenders")
    for (const data of lijst) {
      if (!/^\d{4}-\d{4}$/.test(data.seizoen) || !["Veld", "Zaal"].includes(data.spelvorm) || !Array.isArray(data.dagen) || data.dagen.some(d => !/^\d{4}-\d\d-\d\d$/.test(d.datum) || !["speeldag", "reserve", "slotdag"].includes(d.status))) throw new Error("Ongeldige kalender")
      const [start, einde] = data.seizoen.split("-")
      if (Number(einde) !== Number(start) + 1 || data.dagen.some(d => d.datum < start + "-07-01" || d.datum >= einde + "-08-01")) throw new Error("Kalenderdatum buiten het bronseizoen")
      let r
      try { r = tx.findFirstRecordByData("catalogus_kalenders", "bronId", data.bronId) } catch (_) { r = new Record(tx.findCollectionByNameOrId("catalogus_kalenders")) }
      for (const k of ["bronId", "naam", "seizoen", "district", "spelvorm", "doelgroep", "bron", "dagen", "autoLeeftijden"]) r.set(k, data[k])
      tx.save(r)
    }
    for (const team of tx.findRecordsByFilter("teams", "officieelTeam != ''", "", 0, 0)) require(`${__hooks}/catalogus.js`).synchroniseer(tx, team)
  })
  console.log("Kalenders bijgewerkt: " + lijst.length)
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
routerAdd("GET", "/api/hockey/catalogus/omgeving/{id}/kalenders", (e) => {
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError("Log eerst in")
  const team = e.app.findRecordById("teams", e.request.pathValue("id"))
  if (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id)) throw new ForbiddenError("Alleen beheerders")
  const officieel = e.app.findRecordById("catalogus_teams", team.getString("officieelTeam"))
  return e.json(200, { kalenders: require(`${__hooks}/catalogus.js`).kalendersVoor(e.app, team, officieel) })
})
routerAdd("POST", "/api/hockey/catalogus/omgeving/{id}/kalenders", (e) => {
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError("Log eerst in")
  const team = e.app.findRecordById("teams", e.request.pathValue("id"))
  if (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id)) throw new ForbiddenError("Alleen beheerders")
  const ids = e.requestInfo().body.kalenders
  if (!Array.isArray(ids) || ids.length > 4 || !team.getString("officieelTeam")) throw new BadRequestError("Kies maximaal vier kalenders voor een gekoppeld team")
  const officieel = e.app.findRecordById("catalogus_teams", team.getString("officieelTeam"))
  for (const id of ids) if (e.app.findRecordById("catalogus_kalenders", String(id)).getString("seizoen") !== officieel.getString("seizoen")) throw new BadRequestError("Kies kalenders uit hetzelfde seizoen")
  e.app.runInTransaction(tx => {
    team.set("planningKalenders", [...new Set(ids)]); tx.save(team)
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
  const veld = String(e.requestInfo().body.veld || "")
  e.app.runInTransaction(tx => {
    const record = tx.findRecordById("programma", p.id), omgeving = tx.findRecordById("teams", team.id)
    require(`${__hooks}/catalogus.js`).herstel(tx, record, omgeving, veld)
  })
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
  for (const veld of ["bronId", "bronBasis", "bronWijziging", "bronStatus", "bronPlanning"]) e.record.set(veld, e.record.original().get(veld))
  e.next()
}, "programma")
onRecordCreateRequest((e) => {
  e.record.set("bronId", ""); e.record.set("bronStatus", ""); e.record.set("bronBasis", null); e.record.set("bronWijziging", null); e.record.set("bronPlanning", null)
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
  if (e.record.getString("bronId") || e.record.getString("bronPlanning")) {
    e.app.runInTransaction((tx) => {
      const team = tx.findRecordById("teams", e.record.getString("team"))
      let ids = []
      try { ids = JSON.parse(team.getString("bronGenegeerd") || "[]") || [] } catch (_) {}
      let planning
      try { planning = JSON.parse(e.record.getString("bronPlanning") || "null") } catch (_) {}
      team.set("bronGenegeerd", [...new Set([...ids, e.record.getString("bronId"), planning?.id].filter(Boolean))])
      tx.save(team)
    })
  }
  e.next()
}, "programma")
