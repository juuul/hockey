routerAdd("GET", "/api/hockey/verzamelinstellingen", e => {
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError("Log eerst in")
  return e.json(200, { ...require(`${__hooks}/reizen.js`).globaal(e.app), googleBeschikbaar: !!$os.getenv("GOOGLE_MAPS_API_KEY") })
})
routerAdd("POST", "/api/hockey/verzamelinstellingen", e => {
  if (!e.auth || e.auth.collection().name !== "users" || !e.auth.getBool("superadmin")) throw new ForbiddenError("Alleen superadmins")
  const waarde = require(`${__hooks}/reizen.js`).valideer(e.requestInfo().body, false)
  let r
  try { r = e.app.findFirstRecordByData("app_config", "sleutel", "verzamelen") } catch (_) { r = new Record(e.app.findCollectionByNameOrId("app_config")); r.set("sleutel", "verzamelen") }
  r.set("waarde", waarde); e.app.save(r)
  return e.json(200, waarde)
})
routerAdd("GET", "/api/hockey/verzamelinstellingen/team/{id}", e => {
  const h = require(`${__hooks}/reizen.js`), team = h.beheerder(e)
  return e.json(200, h.teamInfo(e.app, team))
})
routerAdd("POST", "/api/hockey/verzamelinstellingen/team/{id}", e => {
  const h = require(`${__hooks}/reizen.js`), team = h.beheerder(e)
  team.set("reisInstellingen", h.valideer(e.requestInfo().body, true)); e.app.save(team)
  return e.json(200, h.teamInfo(e.app, team))
})
routerAdd("POST", "/api/hockey/reistijd/team/{id}", e => {
  const h = require(`${__hooks}/reizen.js`); h.beheerder(e)
  const b = e.requestInfo().body
  for (const veld of ["vertrekAdres", "locatieAdres"]) if (typeof b[veld] !== "string" || !b[veld].trim() || b[veld].length > 300) throw new BadRequestError("Vul vertrekadres en wedstrijdadres in")
  if (b.vertrekAdres.trim().toLowerCase() === b.locatieAdres.trim().toLowerCase()) return e.json(200, { minuten: 0 })
  const cache = require(`${__hooks}/reiscache.js`), r = cache.zoek(e.app, b.vertrekAdres, b.locatieAdres), opgeslagen = cache.resultaat(r)
  if (opgeslagen) return e.json(200, opgeslagen)
  if (r?.getString("status") === "nieuw") throw new BadRequestError("Deze reistijd wordt nog berekend; probeer later opnieuw of vul minuten in")
  const sleutel = $os.getenv("GOOGLE_MAPS_API_KEY")
  if (!sleutel) throw new BadRequestError("Nog geen opgeslagen reistijd voor deze adressen; vul de minuten zelf in")
  return e.json(200, { minuten: h.haalReistijd(b.vertrekAdres, b.locatieAdres, sleutel), bron: "Google Maps" })
})

onRecordCreateRequest(e => { require(`${__hooks}/reizen.js`).valideerProgramma(e); e.next() }, "programma")
onRecordUpdateRequest(e => { require(`${__hooks}/reizen.js`).valideerProgramma(e); e.next() }, "programma")
