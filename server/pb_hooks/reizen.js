function json(r, veld) { try { return JSON.parse(r.getString(veld) || "null") } catch (_) { return null } }
function globaal(app) {
  let waarden = {}
  try { waarden = json(app.findFirstRecordByData("app_config", "sleutel", "verzamelen"), "waarde") || {} } catch (_) {}
  return { voorbereidingMinuten: waarden.voorbereidingMinuten ?? 30, bufferMinuten: waarden.bufferMinuten ?? 5 }
}
function valideer(body, team) {
  const uit = {}
  for (const veld of ["voorbereidingMinuten", "bufferMinuten"]) {
    const v = body[veld]
    if (team && v === null) continue
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 360) throw new BadRequestError("Kies hele minuten tussen 0 en 360")
    uit[veld] = v
  }
  if (team) {
    if (typeof body.vertrekAdres !== "string" || body.vertrekAdres.length > 300) throw new BadRequestError("Vertrekadres is te lang")
    uit.vertrekAdres = body.vertrekAdres.trim()
  }
  return uit
}
function teamInfo(app, team) {
  const standaard = globaal(app), eigen = json(team, "reisInstellingen") || {}
  let clubAdres = ""
  if (team.getString("officieelTeam")) {
    const officieel = app.findRecordById("catalogus_teams", team.getString("officieelTeam"))
    const club = app.findFirstRecordByData("catalogus_clubs", "bronId", officieel.getString("clubBronId"))
    clubAdres = club.getString("adres")
  }
  return { globaal: standaard, eigen, effectief: { ...standaard, ...eigen, vertrekAdres: eigen.vertrekAdres || clubAdres }, clubAdres, googleBeschikbaar: !!$os.getenv("GOOGLE_MAPS_API_KEY") }
}
function beheerder(e) {
  if (!e.auth || e.auth.collection().name !== "users" || e.auth.getBool("gast")) throw new UnauthorizedError("Log eerst in")
  const team = e.app.findRecordById("teams", e.request.pathValue("id"))
  if (!e.auth.getBool("superadmin") && !team.getStringSlice("beheerders").includes(e.auth.id)) throw new ForbiddenError("Alleen de beheerder van dit team")
  return team
}
function routeMinuten(response) {
  const duur = response?.routes?.[0]?.duration
  if (typeof duur !== "string" || !/^\d+(\.\d+)?s$/.test(duur)) throw new BadRequestError("Geen reistijd gevonden; vul de minuten zelf in")
  const minuten = Math.ceil(Number(duur.slice(0, -1)) / 60)
  if (!Number.isFinite(minuten) || minuten < 0 || minuten > 1440) throw new BadRequestError("Reistijd valt buiten het bereik")
  return minuten
}
function haalReistijd(vertrek, bestemming, sleutel, transport) {
  let response
  try {
    response = (transport || $http.send)({ url: "https://routes.googleapis.com/directions/v2:computeRoutes", method: "POST", timeout: 15,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": sleutel, "X-Goog-FieldMask": "routes.duration" },
      body: JSON.stringify({ origin: { address: vertrek.trim() }, destination: { address: bestemming.trim() }, travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", computeAlternativeRoutes: false, languageCode: "nl-NL" }),
    })
  } catch (_) { throw new BadRequestError("Reistijd ophalen lukt nu niet; vul de minuten zelf in") }
  if (response.statusCode !== 200) throw new BadRequestError("Google Maps kon geen reistijd ophalen; vul de minuten zelf in")
  return routeMinuten(response.json)
}
function valideerProgramma(e) {
  const b = e.requestInfo().body
  const waarde = json(e.record, "reisMinuten")
  if (Object.prototype.hasOwnProperty.call(b, "reisMinuten") && waarde !== null && (typeof waarde !== "number" || !Number.isInteger(waarde) || waarde < 0 || waarde > 1440)) throw new BadRequestError("Reistijd moet hele minuten tussen 0 en 1440 zijn")
}
module.exports = { haalReistijd, valideerProgramma, globaal, valideer, teamInfo, beheerder, routeMinuten }
